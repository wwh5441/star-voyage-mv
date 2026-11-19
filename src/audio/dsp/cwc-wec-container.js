// CabronWEC (CWC-5X) Lossless Binary `.wec` Container Codec (`Magic: "CWC5"`)
// Zero external dependencies. Isomorphic across Browser, AudioWorklet, and Node CLI (`wec-play`).
//
// Eliminates the +23.1% ASCII Base91 source-code tax, unifies all frames into a single
// global probability stream, applies 2D spectral-temporal scale prediction, and automatically
// selects between:
//   - Mode 0: 48-Context Inter-Frame Harmonic Per-Bin Coding (optimal for <500KB & <1MB)
//   - Mode 1: 16-Context Inter-Frame 2D Sparse (Run, Mag) Coding (optimal for Hi-Fi)
// Achieves 100% bit-exact CSR & sample-for-sample waveform equivalence with the JS editions.

import {
  CWC_NUM_PANS,
  CWC_NUM_SCALES,
  CWC_SAMPLE_RATE,
  MID_BANDS,
  SIDE_BANDS,
} from './mdct-core.js';
import { rangeDecodeStream, rangeEncodeStream } from './cwc-entropy.js';

export const WEC_MAGIC = 'CWC5';
export const WEC_HEADER_BYTES = 32;
export const WEC_VERSION = 1;

// Precomputed IEEE 802.3 CRC-32 Lookup Table
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c >>> 0;
}

/**
 * Computes IEEE 802.3 CRC-32 over a Uint8Array (optional slice [start, end)).
 */
export function computeCrc32(bytes, start = 0, end = bytes.length) {
  let crc = 0xffffffff;
  for (let i = start; i < end; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatUint8Arrays(parts) {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/**
 * Encodes common frame metadata (window types, 2D predicted scales, M/S pans).
 */
function encodeFrameHeaders(frames, activeScaleMask) {
  const F = frames.length;
  const winSyms = new Uint8Array(F);
  for (let f = 0; f < F; f++) winSyms[f] = frames[f].winType & 3;

  const actStreams = [];
  for (let i = 0; i < CWC_NUM_SCALES; i++) {
    if (!(activeScaleMask & (1 << i))) continue;
    const act = new Uint8Array(F);
    for (let f = 0; f < F; f++) act[f] = frames[f].scales[i] > 0 ? 1 : 0;
    actStreams.push(rangeEncodeStream(act, 2));
  }

  // 2D spectral-temporal predictor on active nonzero scale values
  const lastNz = new Int32Array(CWC_NUM_SCALES).fill(130);
  const scDeltasTonal = [];
  const scDeltasEnv = [];
  for (let f = 0; f < F; f++) {
    const sc = frames[f].scales;
    let prevBandDelta = 0;
    for (let i = 0; i < CWC_NUM_SCALES; i++) {
      if (!(activeScaleMask & (1 << i))) {
        prevBandDelta = 0;
        continue;
      }
      const c = sc[i] & 255;
      if (c > 0) {
        const pred = Math.max(1, Math.min(254, lastNz[i] + (prevBandDelta >> 1)));
        const d = (c - pred + 256) & 255;
        const isEnv = (i >= 10 && i < 12) || i >= 16;
        if (isEnv) scDeltasEnv.push(d);
        else scDeltasTonal.push(d);
        prevBandDelta = c - lastNz[i];
        lastNz[i] = c;
      } else {
        prevBandDelta = 0;
      }
    }
  }

  const panStreams = [];
  for (let b = 0; b < CWC_NUM_PANS; b++) {
    let prev = 16;
    const arr = new Uint8Array(F);
    for (let f = 0; f < F; f++) {
      const pSym = (frames[f].pans[b] + 16) & 63;
      arr[f] = (pSym - prev + 64) & 63;
      prev = pSym;
    }
    panStreams.push(rangeEncodeStream(arr, 64));
  }

  return [
    rangeEncodeStream(winSyms, 4),
    ...actStreams,
    rangeEncodeStream(Uint8Array.from(scDeltasTonal), 256),
    rangeEncodeStream(Uint8Array.from(scDeltasEnv), 256),
    ...panStreams,
  ];
}

function decodeFrameHeaders(buf, startOff, F, activeScaleMask) {
  let off = startOff;
  const next = () => {
    const r = rangeDecodeStream(buf, off);
    off = r.nextOffset;
    return r.data;
  };

  const winTypes = next();
  const actByBand = new Array(CWC_NUM_SCALES).fill(null);
  for (let i = 0; i < CWC_NUM_SCALES; i++) {
    if (activeScaleMask & (1 << i)) actByBand[i] = next();
  }
  const scDeltasTonal = next();
  const scDeltasEnv = next();
  const panDeltas = new Array(CWC_NUM_PANS);
  for (let b = 0; b < CWC_NUM_PANS; b++) panDeltas[b] = next();

  const scales = new Uint8Array(F * CWC_NUM_SCALES);
  const lastNz = new Int32Array(CWC_NUM_SCALES).fill(130);
  let tPos = 0;
  let ePos = 0;

  for (let f = 0; f < F; f++) {
    const base = f * CWC_NUM_SCALES;
    let prevBandDelta = 0;
    for (let i = 0; i < CWC_NUM_SCALES; i++) {
      const act = actByBand[i];
      if (!act || act[f] === 0) {
        prevBandDelta = 0;
        continue;
      }
      const isEnv = (i >= 10 && i < 12) || i >= 16;
      const d = isEnv ? scDeltasEnv[ePos++] : scDeltasTonal[tPos++];
      const pred = Math.max(1, Math.min(254, lastNz[i] + (prevBandDelta >> 1)));
      const c = (pred + d) & 255;
      scales[base + i] = c;
      prevBandDelta = c - lastNz[i];
      lastNz[i] = c;
    }
  }

  const pans = new Int8Array(F * CWC_NUM_PANS);
  for (let b = 0; b < CWC_NUM_PANS; b++) {
    let prev = 16;
    const pArr = panDeltas[b];
    for (let f = 0; f < F; f++) {
      prev = (prev + pArr[f]) & 63;
      pans[f * CWC_NUM_PANS + b] = prev - 16;
    }
  }

  return { winTypes, scales, pans, nextOffset: off };
}

/**
 * Mode 0: 48-Context Inter-Frame Per-Bin Harmonic Coding
 */
function encodeAtomsMode0(frames) {
  const F = frames.length;
  const binCtx = Array.from({ length: 48 }, () => []);
  const sBinCtx = Array.from({ length: 12 }, () => []);
  const extMag = [];
  const signBytes = [];
  let signAcc = 0;
  let signBit = 0;

  const pushSign = (neg) => {
    if (neg) signAcc |= 1 << signBit;
    if (++signBit === 8) {
      signBytes.push(signAcc);
      signAcc = 0;
      signBit = 0;
    }
  };

  const prevM = new Uint8Array(2048);
  const curM = new Uint8Array(2048);
  const curMSgn = new Uint8Array(2048);
  const prevS = new Uint8Array(2048);
  const curS = new Uint8Array(2048);
  const curSSgn = new Uint8Array(2048);

  for (let f = 0; f < F; f++) {
    const fr = frames[f];
    curM.fill(0);
    curS.fill(0);
    for (let p = 0; p < fr.midNz.length; p++) {
      const it = fr.midNz[p];
      curM[it.k] = Math.abs(it.q);
      curMSgn[it.k] = it.q < 0 ? 1 : 0;
    }
    for (let p = 0; p < fr.sideNz.length; p++) {
      const it = fr.sideNz[p];
      curS[it.k] = Math.abs(it.q);
      curSSgn[it.k] = it.q < 0 ? 1 : 0;
    }

    const sameWin = f > 0 && fr.winType === 0 && frames[f - 1].winType === 0;
    for (let bi = 0; bi < MID_BANDS.length; bi++) {
      const scVal = fr.scales[bi];
      if (scVal === 0 || scVal > 210) continue;
      const bd = MID_BANDS[bi];
      const grp = bi < 2 ? 0 : bi < 4 ? 1 : bi < 6 ? 2 : 3;
      let adj = 0;
      for (let k = bd.lo; k < bd.hi; k++) {
        const pm = sameWin ? prevM[k] : 0;
        const pCls = pm === 0 ? 0 : pm <= 2 ? 1 : 2;
        const nei =
          sameWin && ((k > 0 && prevM[k - 1] > 0) || (k < 2047 && prevM[k + 1] > 0)) ? 1 : 0;
        const ctx = grp * 12 + pCls * 4 + adj * 2 + nei;
        const m = curM[k];
        const sym = m >= 8 ? 8 : m;
        binCtx[ctx].push(sym);
        if (m >= 8) extMag.push(m - 8);
        if (m > 0) pushSign(curMSgn[k] === 1);
        adj = m > 0 ? 1 : 0;
      }
    }
    prevM.set(curM);

    for (let bi = 0; bi < 4; bi++) {
      if (fr.scales[12 + bi] === 0) continue;
      const bd = SIDE_BANDS[bi];
      let adj = 0;
      for (let k = bd.lo; k < bd.hi; k++) {
        const pm = sameWin ? prevS[k] : 0;
        const pCls = pm === 0 ? 0 : pm <= 2 ? 1 : 2;
        const nei =
          sameWin && ((k > 0 && prevS[k - 1] > 0) || (k < 2047 && prevS[k + 1] > 0)) ? 1 : 0;
        const ctx = pCls * 4 + adj * 2 + nei;
        const m = curS[k];
        const sym = m >= 8 ? 8 : m;
        sBinCtx[ctx].push(sym);
        if (m >= 8) extMag.push(m - 8);
        if (m > 0) pushSign(curSSgn[k] === 1);
        adj = m > 0 ? 1 : 0;
      }
    }
    prevS.set(curS);
  }

  if (signBit > 0) signBytes.push(signAcc);
  const signArr = Uint8Array.from(signBytes);
  const signHdr = new Uint8Array([
    (signArr.length >>> 24) & 255,
    (signArr.length >>> 16) & 255,
    (signArr.length >>> 8) & 255,
    signArr.length & 255,
  ]);

  return [
    ...binCtx.map((a) => rangeEncodeStream(Uint8Array.from(a), 9)),
    ...sBinCtx.map((a) => rangeEncodeStream(Uint8Array.from(a), 9)),
    rangeEncodeStream(Uint8Array.from(extMag), 64),
    signHdr,
    signArr,
  ];
}

function decodeAtomsMode0(buf, startOff, F, winTypes, scales) {
  let off = startOff;
  const next = () => {
    const r = rangeDecodeStream(buf, off);
    off = r.nextOffset;
    return r.data;
  };

  const binCtx = new Array(48);
  for (let i = 0; i < 48; i++) binCtx[i] = next();
  const sBinCtx = new Array(12);
  for (let i = 0; i < 12; i++) sBinCtx[i] = next();
  const extMag = next();

  const signLen =
    ((buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]) >>> 0;
  off += 4;
  const signBytes = buf.subarray(off, off + signLen);

  const maxNz = signLen * 8 + 16;
  const tmpMidIdx = new Uint16Array(maxNz);
  const tmpMidQ = new Int8Array(maxNz);
  const tmpSideIdx = new Uint16Array(maxNz);
  const tmpSideQ = new Int8Array(maxNz);
  const midOff = new Uint32Array(F + 1);
  const sideOff = new Uint32Array(F + 1);

  const ctxPos = new Int32Array(48);
  const sCtxPos = new Int32Array(12);
  let extMagPos = 0;
  let signBitIdx = 0;
  let mWrite = 0;
  let sWrite = 0;

  const popSign = () => {
    const neg = (signBytes[signBitIdx >>> 3] >>> (signBitIdx & 7)) & 1;
    signBitIdx++;
    return neg === 1;
  };

  const prevM = new Uint8Array(2048);
  const curM = new Uint8Array(2048);
  const prevS = new Uint8Array(2048);
  const curS = new Uint8Array(2048);

  for (let f = 0; f < F; f++) {
    midOff[f] = mWrite;
    sideOff[f] = sWrite;
    curM.fill(0);
    curS.fill(0);
    const scBase = f * CWC_NUM_SCALES;
    const sameWin = f > 0 && winTypes[f] === 0 && winTypes[f - 1] === 0;

    for (let bi = 0; bi < MID_BANDS.length; bi++) {
      const scVal = scales[scBase + bi];
      if (scVal === 0 || scVal > 210) continue;
      const bd = MID_BANDS[bi];
      const grp = bi < 2 ? 0 : bi < 4 ? 1 : bi < 6 ? 2 : 3;
      let adj = 0;
      for (let k = bd.lo; k < bd.hi; k++) {
        const pm = sameWin ? prevM[k] : 0;
        const pCls = pm === 0 ? 0 : pm <= 2 ? 1 : 2;
        const nei =
          sameWin && ((k > 0 && prevM[k - 1] > 0) || (k < 2047 && prevM[k + 1] > 0)) ? 1 : 0;
        const ctx = grp * 12 + pCls * 4 + adj * 2 + nei;
        const sym = binCtx[ctx][ctxPos[ctx]++];
        if (sym === 0) {
          adj = 0;
        } else {
          const absQ = sym === 8 ? 8 + extMag[extMagPos++] : sym;
          const neg = popSign();
          curM[k] = absQ;
          tmpMidIdx[mWrite] = k;
          tmpMidQ[mWrite] = neg ? -absQ : absQ;
          mWrite++;
          adj = 1;
        }
      }
    }
    prevM.set(curM);

    for (let bi = 0; bi < 4; bi++) {
      if (scales[scBase + 12 + bi] === 0) continue;
      const bd = SIDE_BANDS[bi];
      let adj = 0;
      for (let k = bd.lo; k < bd.hi; k++) {
        const pm = sameWin ? prevS[k] : 0;
        const pCls = pm === 0 ? 0 : pm <= 2 ? 1 : 2;
        const nei =
          sameWin && ((k > 0 && prevS[k - 1] > 0) || (k < 2047 && prevS[k + 1] > 0)) ? 1 : 0;
        const ctx = pCls * 4 + adj * 2 + nei;
        const sym = sBinCtx[ctx][sCtxPos[ctx]++];
        if (sym === 0) {
          adj = 0;
        } else {
          const absQ = sym === 8 ? 8 + extMag[extMagPos++] : sym;
          const neg = popSign();
          curS[k] = absQ;
          tmpSideIdx[sWrite] = k;
          tmpSideQ[sWrite] = neg ? -absQ : absQ;
          sWrite++;
          adj = 1;
        }
      }
    }
    prevS.set(curS);
  }

  midOff[F] = mWrite;
  sideOff[F] = sWrite;
  return {
    midOff,
    midIdx: tmpMidIdx.slice(0, mWrite),
    midQ: tmpMidQ.slice(0, mWrite),
    sideOff,
    sideIdx: tmpSideIdx.slice(0, sWrite),
    sideQ: tmpSideQ.slice(0, sWrite),
  };
}

/**
 * Mode 1: 16-Context Inter-Frame 2D Sparse (Run, Mag) Coding
 */
function encodeAtomsMode1(frames) {
  const F = frames.length;
  const tokCtx = Array.from({ length: 16 }, () => []);
  const sTokCtx = Array.from({ length: 4 }, () => []);
  const extRun = [];
  const extMag = [];
  const signBytes = [];
  let signAcc = 0;
  let signBit = 0;

  const pushSign = (neg) => {
    if (neg) signAcc |= 1 << signBit;
    if (++signBit === 8) {
      signBytes.push(signAcc);
      signAcc = 0;
      signBit = 0;
    }
  };

  const prevMidMag = new Uint8Array(2048);
  const curMidMag = new Uint8Array(2048);

  for (let f = 0; f < F; f++) {
    const fr = frames[f];
    curMidMag.fill(0);
    const sameWin = f > 0 && fr.winType === 0 && frames[f - 1].winType === 0;

    let mPtr = 0;
    for (let bi = 0; bi < MID_BANDS.length; bi++) {
      const scVal = fr.scales[bi];
      if (scVal === 0 || scVal > 210) continue;
      const bd = MID_BANDS[bi];
      const grp = Math.min(3, bi >> 1);
      let adj = 0;
      let curK = bd.lo;
      let lastK = bd.lo - 1;
      while (mPtr < fr.midNz.length && fr.midNz[mPtr].k < bd.hi) {
        const item = fr.midNz[mPtr++];
        const hot = sameWin && prevMidMag[curK] > 0 ? 1 : 0;
        const z = item.k - curK;
        curK = item.k + 1;
        lastK = item.k;
        const absQ = Math.abs(item.q);
        curMidMag[item.k] = absQ;
        const rCode = z >= 30 ? 30 : z;
        const mCode = absQ - 1 >= 7 ? 7 : absQ - 1;
        tokCtx[grp * 4 + adj * 2 + hot].push((rCode << 3) | mCode);
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
        adj = z === 0 ? 1 : 0;
      }
      if (lastK < bd.hi - 1) {
        const hot = sameWin && prevMidMag[curK] > 0 ? 1 : 0;
        tokCtx[grp * 4 + adj * 2 + hot].push(255);
      }
    }
    prevMidMag.set(curMidMag);

    let sPtr = 0;
    for (let bi = 0; bi < 4; bi++) {
      if (fr.scales[12 + bi] === 0) continue;
      const bd = SIDE_BANDS[bi];
      let adj = 0;
      let curK = bd.lo;
      let lastK = bd.lo - 1;
      while (sPtr < fr.sideNz.length && fr.sideNz[sPtr].k < bd.hi) {
        const item = fr.sideNz[sPtr++];
        const z = item.k - curK;
        curK = item.k + 1;
        lastK = item.k;
        const absQ = Math.abs(item.q);
        const rCode = z >= 30 ? 30 : z;
        const mCode = absQ - 1 >= 7 ? 7 : absQ - 1;
        sTokCtx[(bi > 1 ? 2 : 0) + adj].push((rCode << 3) | mCode);
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
        adj = z === 0 ? 1 : 0;
      }
      if (lastK < bd.hi - 1) {
        sTokCtx[(bi > 1 ? 2 : 0) + adj].push(255);
      }
    }
  }

  if (signBit > 0) signBytes.push(signAcc);
  const signArr = Uint8Array.from(signBytes);
  const signHdr = new Uint8Array([
    (signArr.length >>> 24) & 255,
    (signArr.length >>> 16) & 255,
    (signArr.length >>> 8) & 255,
    signArr.length & 255,
  ]);

  return [
    ...tokCtx.map((a) => rangeEncodeStream(Uint8Array.from(a), 256)),
    ...sTokCtx.map((a) => rangeEncodeStream(Uint8Array.from(a), 256)),
    rangeEncodeStream(Uint8Array.from(extRun), 256),
    rangeEncodeStream(Uint8Array.from(extMag), 64),
    signHdr,
    signArr,
  ];
}

function decodeAtomsMode1(buf, startOff, F, winTypes, scales) {
  let off = startOff;
  const next = () => {
    const r = rangeDecodeStream(buf, off);
    off = r.nextOffset;
    return r.data;
  };

  const tokCtx = new Array(16);
  for (let i = 0; i < 16; i++) tokCtx[i] = next();
  const sTokCtx = new Array(4);
  for (let i = 0; i < 4; i++) sTokCtx[i] = next();
  const extRun = next();
  const extMag = next();

  const signLen =
    ((buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]) >>> 0;
  off += 4;
  const signBytes = buf.subarray(off, off + signLen);

  const maxNz = signLen * 8 + 16;
  const tmpMidIdx = new Uint16Array(maxNz);
  const tmpMidQ = new Int8Array(maxNz);
  const tmpSideIdx = new Uint16Array(maxNz);
  const tmpSideQ = new Int8Array(maxNz);
  const midOff = new Uint32Array(F + 1);
  const sideOff = new Uint32Array(F + 1);

  const tokPos = new Int32Array(16);
  const sTokPos = new Int32Array(4);
  let extRunPos = 0;
  let extMagPos = 0;
  let signBitIdx = 0;
  let mWrite = 0;
  let sWrite = 0;

  const popSign = () => {
    const neg = (signBytes[signBitIdx >>> 3] >>> (signBitIdx & 7)) & 1;
    signBitIdx++;
    return neg === 1;
  };

  const prevMidMag = new Uint8Array(2048);
  const curMidMag = new Uint8Array(2048);

  for (let f = 0; f < F; f++) {
    midOff[f] = mWrite;
    sideOff[f] = sWrite;
    curMidMag.fill(0);
    const scBase = f * CWC_NUM_SCALES;
    const sameWin = f > 0 && winTypes[f] === 0 && winTypes[f - 1] === 0;

    for (let bi = 0; bi < MID_BANDS.length; bi++) {
      const scVal = scales[scBase + bi];
      if (scVal === 0 || scVal > 210) continue;
      const bd = MID_BANDS[bi];
      const grp = Math.min(3, bi >> 1);
      let adj = 0;
      let k = bd.lo;
      while (k < bd.hi) {
        const hot = sameWin && prevMidMag[k] > 0 ? 1 : 0;
        const cIdx = grp * 4 + adj * 2 + hot;
        const sym = tokCtx[cIdx][tokPos[cIdx]++];
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
        if (qMinus1 === 7) qMinus1 += extMag[extMagPos++];
        k += z;
        const absQ = qMinus1 + 1;
        const neg = popSign();
        curMidMag[k] = absQ;
        tmpMidIdx[mWrite] = k;
        tmpMidQ[mWrite] = neg ? -absQ : absQ;
        mWrite++;
        adj = z === 0 ? 1 : 0;
        k++;
      }
    }
    prevMidMag.set(curMidMag);

    for (let bi = 0; bi < 4; bi++) {
      if (scales[scBase + 12 + bi] === 0) continue;
      const bd = SIDE_BANDS[bi];
      let adj = 0;
      let k = bd.lo;
      while (k < bd.hi) {
        const cIdx = (bi > 1 ? 2 : 0) + adj;
        const sym = sTokCtx[cIdx][sTokPos[cIdx]++];
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
        if (qMinus1 === 7) qMinus1 += extMag[extMagPos++];
        k += z;
        const absQ = qMinus1 + 1;
        const neg = popSign();
        tmpSideIdx[sWrite] = k;
        tmpSideQ[sWrite] = neg ? -absQ : absQ;
        sWrite++;
        adj = z === 0 ? 1 : 0;
        k++;
      }
    }
  }

  midOff[F] = mWrite;
  sideOff[F] = sWrite;
  return {
    midOff,
    midIdx: tmpMidIdx.slice(0, mWrite),
    midQ: tmpMidQ.slice(0, mWrite),
    sideOff,
    sideIdx: tmpSideIdx.slice(0, sWrite),
    sideQ: tmpSideQ.slice(0, sWrite),
  };
}

/**
 * Packs structured CWC-5X frames into a self-verifying binary `.wec` container (`Uint8Array`).
 * Automatically tests both Mode 0 and Mode 1 lossless atom encoders and emits the smaller file.
 *
 * @param {Array<any>} frames
 * @param {{ tierCode?: number, sampleRate?: number, totalSamples?: number }} [meta]
 */
export function packFramesToWec(frames, meta = {}) {
  const F = frames.length;
  const sampleRate = meta.sampleRate || CWC_SAMPLE_RATE;
  const totalSamples = meta.totalSamples || F * 2048;
  const tierCode = meta.tierCode || 500;

  let activeScaleMask = 0;
  for (let i = 0; i < CWC_NUM_SCALES; i++) {
    for (let f = 0; f < F; f++) {
      if (frames[f].scales[i] !== 0) {
        activeScaleMask |= 1 << i;
        break;
      }
    }
  }

  const hdrParts = encodeFrameHeaders(frames, activeScaleMask);
  const mode0Parts = encodeAtomsMode0(frames);
  const mode1Parts = encodeAtomsMode1(frames);

  const len0 = mode0Parts.reduce((s, p) => s + p.length, 0);
  const len1 = mode1Parts.reduce((s, p) => s + p.length, 0);
  const entropyMode = len0 <= len1 ? 0 : 1;
  const payload = concatUint8Arrays([...hdrParts, ...(entropyMode === 0 ? mode0Parts : mode1Parts)]);

  const out = new Uint8Array(WEC_HEADER_BYTES + payload.length);
  const dv = new DataView(out.buffer);
  out[0] = 0x43; // 'C'
  out[1] = 0x57; // 'W'
  out[2] = 0x43; // 'C'
  out[3] = 0x35; // '5'
  dv.setUint8(4, WEC_VERSION);
  dv.setUint8(5, entropyMode);
  dv.setUint16(6, tierCode, true);
  dv.setUint32(8, sampleRate, true);
  dv.setUint32(12, F, true);
  dv.setUint32(16, totalSamples, true);
  dv.setUint32(20, activeScaleMask >>> 0, true);
  dv.setUint32(24, payload.length >>> 0, true);

  out.set(payload, WEC_HEADER_BYTES);
  // Compute IEEE CRC-32 over header bytes [0..28) + payload [32..end)
  const crcInput = new Uint8Array(28 + payload.length);
  crcInput.set(out.subarray(0, 28), 0);
  crcInput.set(payload, 28);
  const crc = computeCrc32(crcInput);
  dv.setUint32(28, crc >>> 0, true);

  return out;
}

/**
 * Millisecond header & CRC-32 inspector (`wec inspect` / `wec verify` without full synthesis).
 */
export function inspectWecHeader(inputBuf) {
  const bytes =
    inputBuf instanceof Uint8Array
      ? inputBuf
      : new Uint8Array(inputBuf.buffer || inputBuf, inputBuf.byteOffset || 0, inputBuf.byteLength);
  if (bytes.length < WEC_HEADER_BYTES) {
    throw new Error(`Invalid .wec file: expected >= 32 bytes, got ${bytes.length}`);
  }
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== WEC_MAGIC) {
    throw new Error(`Unsupported .wec magic "${magic}" (expected "${WEC_MAGIC}")`);
  }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = dv.getUint8(4);
  const entropyMode = dv.getUint8(5);
  const tierCode = dv.getUint16(6, true);
  const sampleRate = dv.getUint32(8, true);
  const totalFrames = dv.getUint32(12, true);
  const totalSamples = dv.getUint32(16, true);
  const activeScaleMask = dv.getUint32(20, true);
  const payloadBytes = dv.getUint32(24, true);
  const storedCrc32 = dv.getUint32(28, true);

  if (bytes.length < WEC_HEADER_BYTES + payloadBytes) {
    throw new Error(
      `Truncated .wec payload: header declares ${payloadBytes} B, got ${bytes.length - WEC_HEADER_BYTES} B`
    );
  }

  const crcInput = new Uint8Array(28 + payloadBytes);
  crcInput.set(bytes.subarray(0, 28), 0);
  crcInput.set(bytes.subarray(WEC_HEADER_BYTES, WEC_HEADER_BYTES + payloadBytes), 28);
  const computedCrc32 = computeCrc32(crcInput);
  const crcOk = computedCrc32 === storedCrc32;

  return {
    magic,
    version,
    entropyMode,
    entropyModeName:
      entropyMode === 0 ? '48-Ctx Inter-Frame Per-Bin' : '16-Ctx Inter-Frame 2D Run-Mag',
    tierCode,
    tierLabel:
      tierCode <= 500 ? 'CWC-500K' : tierCode <= 1000 ? 'CWC-1M' : 'CWC-HiFi',
    sampleRate,
    totalFrames,
    totalSamples,
    durationSec: Number((totalSamples / sampleRate).toFixed(3)),
    activeScaleMask,
    payloadBytes,
    fileBytes: WEC_HEADER_BYTES + payloadBytes,
    crc32Hex: storedCrc32.toString(16).padStart(8, '0'),
    crcOk,
  };
}

/**
 * Verifies CRC-32 and unpacks an entire `.wec` binary container into a single CSR TypedArray
 * bundle directly compatible with `CWCStreamDecoder.ingestChunk(...)`.
 */
export function unpackWecContainer(inputBuf) {
  const bytes =
    inputBuf instanceof Uint8Array
      ? inputBuf
      : new Uint8Array(inputBuf.buffer || inputBuf, inputBuf.byteOffset || 0, inputBuf.byteLength);
  const header = inspectWecHeader(bytes);
  if (!header.crcOk) {
    throw new Error(`CRC-32 mismatch in .wec container (expected 0x${header.crc32Hex})`);
  }

  const payload = bytes.subarray(WEC_HEADER_BYTES, WEC_HEADER_BYTES + header.payloadBytes);
  const F = header.totalFrames;
  const hdrDecoded = decodeFrameHeaders(payload, 0, F, header.activeScaleMask);
  const atomsDecoded =
    header.entropyMode === 0
      ? decodeAtomsMode0(payload, hdrDecoded.nextOffset, F, hdrDecoded.winTypes, hdrDecoded.scales)
      : decodeAtomsMode1(payload, hdrDecoded.nextOffset, F, hdrDecoded.winTypes, hdrDecoded.scales);

  return {
    startFrame: 0,
    frameCount: F,
    winTypes: hdrDecoded.winTypes,
    scales: hdrDecoded.scales,
    pans: hdrDecoded.pans,
    midOff: atomsDecoded.midOff,
    midIdx: atomsDecoded.midIdx,
    midQ: atomsDecoded.midQ,
    sideOff: atomsDecoded.sideOff,
    sideIdx: atomsDecoded.sideIdx,
    sideQ: atomsDecoded.sideQ,
    packedLength: header.fileBytes,
    header,
  };
}
