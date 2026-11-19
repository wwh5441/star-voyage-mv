// CabronWEC (CWC-5X) Dependency-Free Pure-JS Entropy Engine
// Implements:
// 1. Safe Base91 Printable ASCII Codec (zero quote/backslash escapes in JS module strings)
// 2. 32-bit Carryless Byte-Aligned Range Coder (Subbotin) with 14-bit CDF lookup
// 3. Context-Split 2D (Run, Level) Sparse Chunk Packer & CSR Unpacker

import {
  CWC_NUM_PANS,
  CWC_NUM_SCALES,
  MID_BANDS,
  SIDE_BANDS,
} from './mdct-core.js';

export const B91_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~-';

const B91_DEC = new Int16Array(128).fill(-1);
for (let i = 0; i < 91; i++) {
  B91_DEC[B91_ALPHABET.charCodeAt(i)] = i;
}

const RC_TOP = 1 << 24;
const RC_BOT = 1 << 16;
const TOT_BITS = 14;
const TOT = 1 << TOT_BITS;

export function encodeBase91(bytes) {
  let b = 0;
  let n = 0;
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    b |= bytes[i] << n;
    n += 8;
    if (n > 13) {
      let v = b & 8191;
      if (v > 88) {
        b >>= 13;
        n -= 13;
      } else {
        v = b & 16383;
        b >>= 14;
        n -= 14;
      }
      out += B91_ALPHABET[v % 91] + B91_ALPHABET[(v / 91) | 0];
    }
  }
  if (n > 0) {
    out += B91_ALPHABET[b % 91];
    if (n > 7 || b > 90) {
      out += B91_ALPHABET[(b / 91) | 0];
    }
  }
  return out;
}

export function decodeBase91(str) {
  let v = -1;
  let b = 0;
  let n = 0;
  const maxBytes = Math.ceil((str.length * 14) / 8) + 4;
  const tmp = new Uint8Array(maxBytes);
  let w = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    const c = code < 128 ? B91_DEC[code] : -1;
    if (c < 0) continue;
    if (v < 0) {
      v = c;
    } else {
      v += c * 91;
      b |= v << n;
      n += (v & 8191) > 88 ? 13 : 14;
      do {
        tmp[w++] = b & 255;
        b >>= 8;
        n -= 8;
      } while (n > 7);
      v = -1;
    }
  }
  if (v >= 0) {
    tmp[w++] = (b | (v << n)) & 255;
  }
  return tmp.subarray(0, w);
}

export function rangeEncodeStream(symArr, alphaSize = 256) {
  const len = symArr.length;
  if (len === 0) return new Uint8Array([0, 0, 0, 0]);

  const counts = new Uint32Array(alphaSize);
  for (let i = 0; i < len; i++) counts[symArr[i]]++;

  const freq = new Uint16Array(alphaSize);
  let sum = 0;
  let maxSym = 0;
  let maxF = 0;
  for (let s = 0; s < alphaSize; s++) {
    if (counts[s] > 0) {
      const f = Math.max(1, Math.round((counts[s] * TOT) / len));
      freq[s] = f;
      sum += f;
      if (f > maxF) {
        maxF = f;
        maxSym = s;
      }
    }
  }
  let diff = TOT - sum;
  if (diff !== 0) {
    if (freq[maxSym] + diff >= 1) {
      freq[maxSym] += diff;
    } else {
      while (diff < 0) {
        for (let s = 0; s < alphaSize && diff < 0; s++) {
          if (freq[s] > 1) {
            freq[s]--;
            diff++;
          }
        }
      }
    }
  }

  const cum = new Uint16Array(alphaSize + 1);
  for (let s = 0; s < alphaSize; s++) cum[s + 1] = cum[s] + freq[s];

  const out = [
    (len >>> 24) & 255,
    (len >>> 16) & 255,
    (len >>> 8) & 255,
    len & 255,
    alphaSize - 1,
  ];
  const maskBytes = Math.ceil(alphaSize / 8);
  for (let mb = 0; mb < maskBytes; mb++) {
    let m = 0;
    for (let b = 0; b < 8; b++) {
      if (mb * 8 + b < alphaSize && freq[mb * 8 + b] > 0) m |= 1 << b;
    }
    out.push(m);
  }
  for (let s = 0; s < alphaSize; s++) {
    if (freq[s] > 0) {
      const v = freq[s] - 1;
      if (v < 128) out.push(v);
      else out.push(128 | (v & 127), v >>> 7);
    }
  }

  let low = 0;
  let range = 0xffffffff;
  for (let i = 0; i < len; i++) {
    const s = symArr[i];
    const r = (range >>> TOT_BITS) >>> 0;
    low = (low + ((r * cum[s]) >>> 0)) >>> 0;
    range = (r * freq[s]) >>> 0;
    while (
      ((low ^ ((low + range) >>> 0)) >>> 0) < RC_TOP ||
      (range < RC_BOT && ((range = (-low & (RC_BOT - 1)) >>> 0), true))
    ) {
      out.push(low >>> 24);
      range = (range << 8) >>> 0;
      low = (low << 8) >>> 0;
    }
  }
  for (let i = 0; i < 4; i++) {
    out.push(low >>> 24);
    low = (low << 8) >>> 0;
  }
  return new Uint8Array(out);
}

export function rangeDecodeStream(buf, offset = 0) {
  let pos = offset;
  const len =
    ((buf[pos] << 24) | (buf[pos + 1] << 16) | (buf[pos + 2] << 8) | buf[pos + 3]) >>> 0;
  pos += 4;
  if (len === 0) return { data: new Uint8Array(0), nextOffset: pos };

  const alphaSize = buf[pos++] + 1;
  const maskBytes = Math.ceil(alphaSize / 8);
  const active = new Uint8Array(alphaSize);
  for (let mb = 0; mb < maskBytes; mb++) {
    const m = buf[pos++];
    for (let b = 0; b < 8; b++) {
      if (m & (1 << b) && mb * 8 + b < alphaSize) active[mb * 8 + b] = 1;
    }
  }

  const freq = new Uint16Array(alphaSize);
  const cum = new Uint16Array(alphaSize + 1);
  const lut = new Uint8Array(TOT);
  for (let s = 0; s < alphaSize; s++) {
    if (active[s]) {
      const b0 = buf[pos++];
      const v = b0 & 128 ? (b0 & 127) | (buf[pos++] << 7) : b0;
      freq[s] = v + 1;
    }
    cum[s + 1] = cum[s] + freq[s];
    lut.fill(s, cum[s], cum[s + 1]);
  }

  let low = 0;
  let range = 0xffffffff;
  let code = 0;
  for (let i = 0; i < 4; i++) {
    code = ((code << 8) | (buf[pos++] || 0)) >>> 0;
  }

  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const r = (range >>> TOT_BITS) >>> 0;
    const count = Math.min(TOT - 1, (((code - low) >>> 0) / r) | 0);
    const s = lut[count];
    out[i] = s;
    low = (low + ((r * cum[s]) >>> 0)) >>> 0;
    range = (r * freq[s]) >>> 0;
    while (
      ((low ^ ((low + range) >>> 0)) >>> 0) < RC_TOP ||
      (range < RC_BOT && ((range = (-low & (RC_BOT - 1)) >>> 0), true))
    ) {
      code = ((code << 8) | (buf[pos++] || 0)) >>> 0;
      range = (range << 8) >>> 0;
      low = (low << 8) >>> 0;
    }
  }
  return { data: out, nextOffset: pos };
}

/**
 * Packs an array of structured CWC-5X frame objects into a single self-contained Base91 string.
 * Each frame object: { winType, scales: Uint8Array(17), pans: Int8Array(5), midNz: [{k, q}], sideNz: [{k, q}] }
 * where q is non-zero signed integer in [-qMax..-1, +1..+qMax].
 */
export function packFramesToBase91(frames) {
  const frameCount = frames.length;
  const prevSc = new Int32Array(CWC_NUM_SCALES);
  const prevPan = new Int32Array(CWC_NUM_PANS).fill(16);

  const winSyms = new Uint8Array(frameCount);
  const scLowSyms = [];
  const scHiSyms = [];
  const panSyms = [];
  const tok2d = Array.from({ length: 8 }, () => []);
  const extRun = [];
  const extMag = [];
  const signBytes = [];
  let signAcc = 0;
  let signBitPos = 0;

  const pushSign = (neg) => {
    if (neg) signAcc |= 1 << signBitPos;
    if (++signBitPos === 8) {
      signBytes.push(signAcc);
      signAcc = 0;
      signBitPos = 0;
    }
  };

  for (let f = 0; f < frameCount; f++) {
    const fr = frames[f];
    winSyms[f] = fr.winType & 3;

    for (let i = 0; i < CWC_NUM_SCALES; i++) {
      const cur = fr.scales[i] & 255;
      const d = (cur - prevSc[i] + 256) & 255;
      if (i < 8) scLowSyms.push(d);
      else scHiSyms.push(d);
      prevSc[i] = cur;
    }

    for (let bi = 0; bi < CWC_NUM_PANS; bi++) {
      const pSym = fr.pans[bi] + 16;
      panSyms.push((pSym - prevPan[bi] + 64) & 63);
      prevPan[bi] = pSym;
    }

    // Encode Mid nonzeros: 5-bit run (0..29, 30=extRun) | 3-bit mag (0..6 => |q|=1..7, 7=extMag), 255 = EOB
    let mPtr = 0;
    const mArr = fr.midNz;
    for (let bi = 0; bi < MID_BANDS.length; bi++) {
      const scVal = fr.scales[bi];
      if (scVal === 0 || scVal > 210) continue;
      const bd = MID_BANDS[bi];
      const grp = bd.group;
      let ctx = 0;
      let curK = bd.lo;
      let lastK = bd.lo - 1;
      while (mPtr < mArr.length && mArr[mPtr].k < bd.hi) {
        const item = mArr[mPtr++];
        const z = item.k - curK;
        curK = item.k + 1;
        lastK = item.k;
        const absQ = Math.abs(item.q);
        const rCode = z >= 30 ? 30 : z;
        const mCode = absQ - 1 >= 7 ? 7 : absQ - 1;
        tok2d[grp * 2 + ctx].push((rCode << 3) | mCode);
        if (z >= 30) {
          let rem = z - 30;
          while (rem >= 255) {
            extRun.push(255);
            rem -= 255;
          }
          extRun.push(rem);
        }
        if (absQ - 1 >= 7) extMag.push(absQ - 1 - 7);
        pushSign(item.q < 0);
        ctx = z === 0 ? 0 : 1;
      }
      if (lastK < bd.hi - 1) {
        tok2d[grp * 2 + ctx].push(255);
      }
    }

    // Encode Side nonzeros for tonal Side bands 0..3 (scales[12..15])
    let sPtr = 0;
    const sArr = fr.sideNz;
    for (let bi = 0; bi < 4; bi++) {
      const scVal = fr.scales[12 + bi];
      if (scVal === 0) continue;
      const bd = SIDE_BANDS[bi];
      let ctx = 0;
      let curK = bd.lo;
      let lastK = bd.lo - 1;
      while (sPtr < sArr.length && sArr[sPtr].k < bd.hi) {
        const item = sArr[sPtr++];
        const z = item.k - curK;
        curK = item.k + 1;
        lastK = item.k;
        const absQ = Math.abs(item.q);
        const rCode = z >= 30 ? 30 : z;
        const mCode = absQ - 1 >= 7 ? 7 : absQ - 1;
        tok2d[6 + ctx].push((rCode << 3) | mCode);
        if (z >= 30) {
          let rem = z - 30;
          while (rem >= 255) {
            extRun.push(255);
            rem -= 255;
          }
          extRun.push(rem);
        }
        if (absQ - 1 >= 7) extMag.push(absQ - 1 - 7);
        pushSign(item.q < 0);
        ctx = z === 0 ? 0 : 1;
      }
      if (lastK < bd.hi - 1) {
        tok2d[6 + ctx].push(255);
      }
    }
  }

  if (signBitPos > 0) signBytes.push(signAcc);
  const signArr = Uint8Array.from(signBytes);
  const signHeader = new Uint8Array([
    (signArr.length >>> 24) & 255,
    (signArr.length >>> 16) & 255,
    (signArr.length >>> 8) & 255,
    signArr.length & 255,
  ]);

  const parts = [
    rangeEncodeStream(winSyms, 4),
    rangeEncodeStream(Uint8Array.from(scLowSyms), 256),
    rangeEncodeStream(Uint8Array.from(scHiSyms), 256),
    rangeEncodeStream(Uint8Array.from(panSyms), 64),
    ...tok2d.map((g) => rangeEncodeStream(Uint8Array.from(g), 256)),
    rangeEncodeStream(Uint8Array.from(extRun), 256),
    rangeEncodeStream(Uint8Array.from(extMag), 64),
    signHeader,
    signArr,
  ];

  let totalBytes = 0;
  for (const pt of parts) totalBytes += pt.length;
  const merged = new Uint8Array(totalBytes);
  let off = 0;
  for (const pt of parts) {
    merged.set(pt, off);
    off += pt.length;
  }
  return encodeBase91(merged);
}

/**
 * Synchronously unpacks a Base91 CWC-5X chunk into a compact, zero-GC CSR TypedArray bundle
 * ready for O(1) random-access streaming synthesis inside AudioWorklet.
 */
export function unpackBase91Chunk(b91Str, startFrame, frameCount) {
  const buf = decodeBase91(b91Str);
  let off = 0;
  const nextStream = () => {
    const res = rangeDecodeStream(buf, off);
    off = res.nextOffset;
    return res.data;
  };

  const winTypes = nextStream();
  const scLow = nextStream();
  const scHi = nextStream();
  const panDeltas = nextStream();
  const tok2d = new Array(8);
  for (let i = 0; i < 8; i++) tok2d[i] = nextStream();
  const extRun = nextStream();
  const extMag = nextStream();

  const signByteLen =
    ((buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]) >>> 0;
  off += 4;
  const signBytes = buf.subarray(off, off + signByteLen);

  // Upper bound on total nonzeros = signByteLen * 8
  const maxNz = signByteLen * 8 + 16;
  const tmpMidIdx = new Uint16Array(maxNz);
  const tmpMidQ = new Int8Array(maxNz);
  const tmpSideIdx = new Uint16Array(maxNz);
  const tmpSideQ = new Int8Array(maxNz);

  const scales = new Uint8Array(frameCount * CWC_NUM_SCALES);
  const pans = new Int8Array(frameCount * CWC_NUM_PANS);
  const midOff = new Uint32Array(frameCount + 1);
  const sideOff = new Uint32Array(frameCount + 1);

  const prevSc = new Int32Array(CWC_NUM_SCALES);
  const prevPan = new Int32Array(CWC_NUM_PANS).fill(16);
  const tokPos = new Int32Array(8);
  let scLowPos = 0;
  let scHiPos = 0;
  let panPos = 0;
  let extRunPos = 0;
  let extMagPos = 0;
  let signBitIdx = 0;
  let mWrite = 0;
  let sWrite = 0;

  const popSign = () => {
    const byte = signBytes[signBitIdx >>> 3];
    const neg = (byte >>> (signBitIdx & 7)) & 1;
    signBitIdx++;
    return neg === 1;
  };

  for (let f = 0; f < frameCount; f++) {
    midOff[f] = mWrite;
    sideOff[f] = sWrite;

    const scBase = f * CWC_NUM_SCALES;
    for (let i = 0; i < CWC_NUM_SCALES; i++) {
      const d = i < 8 ? scLow[scLowPos++] : scHi[scHiPos++];
      const cur = (prevSc[i] + d) & 255;
      prevSc[i] = cur;
      scales[scBase + i] = cur;
    }

    const panBase = f * CWC_NUM_PANS;
    for (let bi = 0; bi < CWC_NUM_PANS; bi++) {
      const d = panDeltas[panPos++];
      const pSym = (prevPan[bi] + d) & 63;
      prevPan[bi] = pSym;
      pans[panBase + bi] = pSym - 16;
    }

    // Decode Mid bands 0..9
    for (let bi = 0; bi < MID_BANDS.length; bi++) {
      const scVal = scales[scBase + bi];
      if (scVal === 0 || scVal > 210) continue;
      const bd = MID_BANDS[bi];
      const grp = bd.group;
      let ctx = 0;
      let k = bd.lo;
      while (k < bd.hi) {
        const streamIdx = grp * 2 + ctx;
        const sym = tok2d[streamIdx][tokPos[streamIdx]++];
        if (sym === 255) break;
        let z = sym >>> 3;
        let qMinus1 = sym & 7;
        if (z === 30) {
          while (true) {
            const b = extRun[extRunPos++];
            z += b;
            if (b < 255) break;
          }
        }
        if (qMinus1 === 7) {
          qMinus1 += extMag[extMagPos++];
        }
        k += z;
        const neg = popSign();
        const absQ = qMinus1 + 1;
        tmpMidIdx[mWrite] = k;
        tmpMidQ[mWrite] = neg ? -absQ : absQ;
        mWrite++;
        ctx = z === 0 ? 0 : 1;
        k++;
      }
    }

    // Decode Side bands 0..3
    for (let bi = 0; bi < 4; bi++) {
      const scVal = scales[scBase + 12 + bi];
      if (scVal === 0) continue;
      const bd = SIDE_BANDS[bi];
      let ctx = 0;
      let k = bd.lo;
      while (k < bd.hi) {
        const streamIdx = 6 + ctx;
        const sym = tok2d[streamIdx][tokPos[streamIdx]++];
        if (sym === 255) break;
        let z = sym >>> 3;
        let qMinus1 = sym & 7;
        if (z === 30) {
          while (true) {
            const b = extRun[extRunPos++];
            z += b;
            if (b < 255) break;
          }
        }
        if (qMinus1 === 7) {
          qMinus1 += extMag[extMagPos++];
        }
        k += z;
        const neg = popSign();
        const absQ = qMinus1 + 1;
        tmpSideIdx[sWrite] = k;
        tmpSideQ[sWrite] = neg ? -absQ : absQ;
        sWrite++;
        ctx = z === 0 ? 0 : 1;
        k++;
      }
    }
  }
  midOff[frameCount] = mWrite;
  sideOff[frameCount] = sWrite;

  return {
    startFrame,
    frameCount,
    winTypes,
    scales,
    pans,
    midOff,
    midIdx: tmpMidIdx.slice(0, mWrite),
    midQ: tmpMidQ.slice(0, mWrite),
    sideOff,
    sideIdx: tmpSideIdx.slice(0, sWrite),
    sideQ: tmpSideQ.slice(0, sWrite),
    packedLength: b91Str.length,
  };
}
