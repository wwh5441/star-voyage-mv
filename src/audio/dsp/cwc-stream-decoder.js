// CabronWEC (CWC-5X) Real-Time Streaming Frame Decoder
// Isomorphic zero-GC synthesis engine shared between:
//   1. AudioWorkletProcessor (real-time 128-sample WebAudio thread)
//   2. Node.js Compiler & Test Harness (roundtrip SNR & stem verification)
//   3. Client-side 16-bit PCM WAV Renderer & Live Frame Inspector

import {
  BIN_TO_MID_BAND,
  BIN_TO_SIDE_BAND,
  CWC_FRAME_N,
  CWC_HOP_M,
  CWC_NUM_PANS,
  CWC_NUM_SCALES,
  GAIN_LUT,
  MID_BANDS,
  PNS_LUT,
  PNS_MID_BANDS,
  PNS_SIDE_BANDS,
  SIDE_BANDS,
  WHISPER_LUT,
  WIN_LONG,
  WIN_NAMES,
  WIN_SHORT,
  createAdaptiveMDCTProcessor,
} from './mdct-core.js';

export function computeShortSubblockEnv(spec, winType, subEnvOut) {
  subEnvOut.fill(1);
  if (winType !== WIN_SHORT) return;
  let maxE = 1e-12;
  for (let s = 0; s < 8; s++) {
    let e = 0;
    for (let k = 72 + s; k < 1115; k += 8) {
      const v = spec[k];
      e += v * v;
    }
    subEnvOut[s] = Math.sqrt(e);
    if (subEnvOut[s] > maxE) maxE = subEnvOut[s];
  }
  let sqSum = 0;
  for (let s = 0; s < 8; s++) {
    const r = Math.max(0.14, subEnvOut[s] / maxE);
    subEnvOut[s] = r;
    sqSum += r * r;
  }
  const norm = Math.sqrt(8 / Math.max(1e-12, sqSum));
  for (let s = 0; s < 8; s++) subEnvOut[s] *= norm;
}

export function synthesizeHarmonicSbrBand(
  rawM,
  bd,
  qFill,
  scaleVal,
  winType,
  baseTop,
  subEnv,
  nextNoise,
  scratch,
  outSpec = null,
  layerGain = 1,
  srcLoOverride = -1
) {
  let zCount = 0;
  for (let k = bd.lo; k < bd.hi; k++) {
    if (rawM[k] === 0) zCount++;
  }
  if (zCount === 0 || qFill <= 0) return 0;

  const srcLo =
    srcLoOverride >= 0
      ? srcLoOverride
      : bd.lo >= 882
        ? 296
        : bd.lo >= 594
          ? 208
          : bd.lo >= 409
            ? 144
            : 72;
  const top = Math.max(srcLo + 64, Math.min(bd.lo, baseTop));
  const span8 = Math.max(16, ((top - srcLo) >> 3) << 3);
  const shift = Math.max(8, ((bd.hi - top + 7) >> 3) << 3);

  let patchP = 0;
  let srcMax = 0;
  const canPatch = scaleVal === 0 || bd.lo >= 409;
  if (canPatch) {
    for (let k = bd.lo; k < bd.hi; k++) {
      if (rawM[k] !== 0) continue;
      let sk = k - shift;
      if (sk < srcLo) sk = srcLo + (((sk - srcLo) % span8 + span8) % span8);
      const sv = sk < top ? rawM[sk] : 0;
      const a = Math.abs(sv);
      if (a > srcMax) srcMax = a;
      patchP += sv * sv;
    }
  }

  const usePatch = canPatch && patchP > 1e-10;
  const patchRms = usePatch ? Math.sqrt(patchP / zCount) : 0;
  const srcCrest = patchRms > 1e-8 ? srcMax / patchRms : 0;
  // Strictly 0 white noise on tonal/melodic frames (crest >= 2.6); ultra-soft shimmer only on flat hi-hat bursts
  const noiseMix = usePatch ? Math.max(0, Math.min(0.10, (2.6 - srcCrest) * 0.10)) : 0.35;
  const patchMix = 1 - noiseMix;
  const patchNorm = usePatch ? Math.sqrt(zCount / patchP) : 0;
  const targetRms = PNS_LUT[Math.min(220, qFill)] * (usePatch ? 1 : 0.35);

  let mixP = 0;
  let u = 0;
  for (let k = bd.lo; k < bd.hi; k++) {
    if (rawM[k] !== 0) continue;
    let v;
    if (usePatch) {
      let sk = k - shift;
      if (sk < srcLo) sk = srcLo + (((sk - srcLo) % span8 + span8) % span8);
      const sv = sk < top ? rawM[sk] * patchNorm : 0;
      v = noiseMix > 0 ? patchMix * sv + noiseMix * nextNoise() : sv;
    } else {
      v = nextNoise();
    }
    if (winType === WIN_SHORT) v *= subEnv[k & 7];
    scratch[u++] = v;
    mixP += v * v;
  }

  const scN = targetRms * Math.sqrt(zCount / (mixP + 1e-12));
  let bp = 0;
  u = 0;
  for (let k = bd.lo; k < bd.hi; k++) {
    if (rawM[k] === 0) {
      const val = scratch[u++] * scN;
      rawM[k] = val;
      if (outSpec) outSpec[k] = val * layerGain;
      bp += val * val;
    }
  }
  return bp;
}

export class CWCStreamDecoder {
  constructor(totalFrames = 0) {
    this.mdct = createAdaptiveMDCTProcessor(CWC_FRAME_N);
    this.totalFrames = totalFrames;
    // Map frameIdx -> chunk slot using compact chunk table
    this.chunks = [];
    this.frameToChunk = new Int16Array(Math.max(1, totalFrames)).fill(-1);
    this.loadedCount = 0;

    // Pre-allocated zero-GC synthesis buffers (reused on every 2048-sample frame)
    this.rawMid = new Float64Array(CWC_HOP_M);
    this.specMid = new Float64Array(CWC_HOP_M);
    this.specSide = new Float64Array(CWC_HOP_M);
    this.outMidN = new Float64Array(CWC_FRAME_N);
    this.outSideN = new Float64Array(CWC_FRAME_N);
    this.olaL = new Float64Array(CWC_HOP_M);
    this.olaR = new Float64Array(CWC_HOP_M);
    this.noiseScratch = new Float64Array(640);
    this.subEnv = new Float64Array(8);
    this.bandSteps = new Float64Array(MID_BANDS.length);
    this.sideSteps = new Float64Array(4);
    this._layerPow = new Float64Array(5);

    // Real-time 5-layer stem controls
    this.stemGains = new Float32Array([1, 1, 1, 1, 1]);
    this.stemMutes = new Uint8Array(5);
    this.stemSolos = new Uint8Array(5);
    this.effectiveGains = new Float32Array([1, 1, 1, 1, 1]);
    this.masterGain = 0.98;

    // Telemetry outputs updated on every decoded frame
    this.layerRms = new Float32Array(5);
    this.spectrum32 = new Float32Array(32);
    this.currentFrame = 0;
  }

  setTotalFrames(totalFrames) {
    if (this.frameToChunk.length < totalFrames) {
      const next = new Int16Array(totalFrames).fill(-1);
      next.set(this.frameToChunk.subarray(0, Math.min(totalFrames, this.frameToChunk.length)));
      this.frameToChunk = next;
    }
    this.totalFrames = totalFrames;
  }

  /**
   * Ingests an unpacked CSR chunk bundle produced by unpackBase91Chunk().
   */
  ingestChunk(chunkBundle) {
    if (!chunkBundle || typeof chunkBundle.startFrame !== 'number') return;
    const { startFrame, frameCount } = chunkBundle;
    const endFrame = Math.min(this.totalFrames, startFrame + frameCount);
    if (this.frameToChunk.length < endFrame) {
      this.setTotalFrames(endFrame);
    }
    const slot = this.chunks.length;
    this.chunks.push(chunkBundle);
    let newlyLoaded = 0;
    for (let f = startFrame; f < endFrame; f++) {
      if (this.frameToChunk[f] < 0) newlyLoaded++;
      this.frameToChunk[f] = slot;
    }
    this.loadedCount += newlyLoaded;
  }

  hasFrame(frameIdx) {
    if (frameIdx < 0 || frameIdx >= this.totalFrames) return true;
    return this.frameToChunk[frameIdx] >= 0;
  }

  /**
   * Returns human-readable mathematical summary of a single frame for the Live Deck Inspector.
   */
  inspectFrame(frameIdx) {
    if (frameIdx < 0 || frameIdx >= this.totalFrames) return null;
    const slot = this.frameToChunk[frameIdx];
    if (slot < 0) return null;
    const ch = this.chunks[slot];
    const lf = frameIdx - ch.startFrame;
    const winType = ch.winTypes[lf];
    const scBase = lf * CWC_NUM_SCALES;
    const panBase = lf * CWC_NUM_PANS;
    const mStart = ch.midOff[lf];
    const mEnd = ch.midOff[lf + 1];
    const sStart = ch.sideOff[lf];
    const sEnd = ch.sideOff[lf + 1];

    const scalesM = [];
    for (let bi = 0; bi < MID_BANDS.length; bi++) {
      const v = ch.scales[scBase + bi];
      const sbrV = bi >= 4 ? ch.scales[scBase + 17 + (bi - 4)] : 0;
      const name = MID_BANDS[bi].label.split(' ')[0];
      if (v > 0 && v <= 210) scalesM.push(`${name}:${v}${sbrV ? `+F${sbrV}` : ''}`);
      else if (sbrV > 0) scalesM.push(`${name}:SBR${sbrV}`);
      else scalesM.push(`${name}:0`);
    }
    const pnsM = [
      `PNS[12.0–15.5k]=${ch.scales[scBase + 10]}`,
      `PNS[15.5–19.6k]=${ch.scales[scBase + 11]}`,
    ];
    const pans = [];
    for (let bi = 0; bi < CWC_NUM_PANS; bi++) {
      pans.push(`Pan${bi}=${(ch.pans[panBase + bi] / 20).toFixed(2)}`);
    }
    const sampleAtoms = [];
    const showN = Math.min(18, mEnd - mStart);
    for (let p = 0; p < showN; p++) {
      const k = ch.midIdx[mStart + p];
      const q = ch.midQ[mStart + p];
      sampleAtoms.push(`X[${k}]=${q > 0 ? '+' : ''}${q}`);
    }
    return {
      winName: WIN_NAMES[winType] || 'LONG_4096',
      midNzCount: mEnd - mStart,
      sideNzCount: sEnd - sStart,
      scalesM,
      pnsM,
      pans,
      atomsPreview: sampleAtoms.join('  ') + (mEnd - mStart > showN ? `  … (+${mEnd - mStart - showN} sparse atoms)` : ''),
    };
  }

  /**
   * @param {{ gains?: ArrayLike<number>, mutes?: ArrayLike<boolean | number>, solos?: ArrayLike<boolean | number>, masterGain?: number }} [opts]
   */
  setStemControls(opts = {}) {
    const { gains, mutes, solos, masterGain } = opts;
    if (gains) for (let i = 0; i < 5; i++) this.stemGains[i] = gains[i];
    if (mutes) for (let i = 0; i < 5; i++) this.stemMutes[i] = mutes[i] ? 1 : 0;
    if (solos) for (let i = 0; i < 5; i++) this.stemSolos[i] = solos[i] ? 1 : 0;
    if (typeof masterGain === 'number') this.masterGain = masterGain;

    let anySolo = false;
    for (let i = 0; i < 5; i++) {
      if (this.stemSolos[i]) {
        anySolo = true;
        break;
      }
    }
    for (let i = 0; i < 5; i++) {
      const active = anySolo ? this.stemSolos[i] === 1 : this.stemMutes[i] === 0;
      this.effectiveGains[i] = active ? this.stemGains[i] : 0;
    }
  }

  /**
   * Clickless seek: resets OLA buffer and runs 2 silent pre-roll frames before targetFrame
   * so Adaptive Edler TDAC overlap state is exact at the seek boundary.
   */
  seekToFrame(targetFrame) {
    const clamped = Math.max(0, Math.min(Math.max(0, this.totalFrames - 1), targetFrame | 0));
    this.olaL.fill(0);
    this.olaR.fill(0);
    const preStart = Math.max(0, clamped - 2);
    const dummyL = this._dummyL || (this._dummyL = new Float32Array(CWC_HOP_M));
    const dummyR = this._dummyR || (this._dummyR = new Float32Array(CWC_HOP_M));
    for (let f = preStart; f < clamped; f++) {
      this.decodeFrame(f, dummyL, dummyR, 0);
    }
    this.currentFrame = clamped;
    return clamped;
  }

  /**
   * Synthesizes exactly 2048 stereo samples (1 CWC-5X frame = 46.44 ms) into outL/outR at offset.
   * Zero heap allocations during steady-state streaming.
   */
  decodeFrame(frameIdx, outL, outR, outOffset = 0) {
    this.currentFrame = frameIdx;
    const M = CWC_HOP_M;
    const rawM = this.rawMid;
    const specM = this.specMid;
    const specS = this.specSide;
    rawM.fill(0);
    specM.fill(0);
    specS.fill(0);

    const eff = this.effectiveGains;
    const g0 = eff[0];
    const g1 = eff[1];
    const g2 = eff[2];
    const g3 = eff[3];
    const g4 = eff[4];
    const layerPow = this._layerPow;
    layerPow.fill(0);

    let winType = WIN_LONG;
    const slot = frameIdx >= 0 && frameIdx < this.totalFrames ? this.frameToChunk[frameIdx] : -1;

    // Deterministic frame-indexed PRNG so PNS/whisper noise never drifts on seek
    let seed = ((frameIdx + 1) * 0x9e3779b1) ^ 0x2468ace1;
    const nextNoise = () => {
      seed ^= seed << 13;
      seed >>>= 0;
      seed ^= seed >>> 17;
      seed >>>= 0;
      seed ^= seed << 5;
      seed >>>= 0;
      const u1 = (seed >>> 0) / 4294967296 - 0.5;
      seed ^= seed << 13;
      seed >>>= 0;
      seed ^= seed >>> 17;
      seed >>>= 0;
      seed ^= seed << 5;
      seed >>>= 0;
      const u2 = (seed >>> 0) / 4294967296 - 0.5;
      return (u1 + u2) * 2.4494897;
    };

    if (slot >= 0) {
      const ch = this.chunks[slot];
      const lf = frameIdx - ch.startFrame;
      winType = ch.winTypes[lf];
      const scBase = lf * CWC_NUM_SCALES;
      const panBase = lf * CWC_NUM_PANS;

      // 1. Mid Tonal & Whisper Subbands (0..1115 bins = 0..12.00 kHz)
      for (let bi = 0; bi < MID_BANDS.length; bi++) {
        const scVal = ch.scales[scBase + bi];
        if (scVal > 0 && scVal <= 210) {
          this.bandSteps[bi] = GAIN_LUT[scVal] / MID_BANDS[bi].qMax;
        } else {
          this.bandSteps[bi] = 0;
          if (scVal > 210) {
            const bd = MID_BANDS[bi];
            const c = bd.hi - bd.lo;
            const rms = WHISPER_LUT[Math.min(45, scVal - 210)];
            let np = 0;
            for (let u = 0; u < c; u++) {
              const n = nextNoise();
              this.noiseScratch[u] = n;
              np += n * n;
            }
            const scN = rms * Math.sqrt(c / (np + 1e-12));
            const lg = eff[bd.layer];
            let bp = 0;
            for (let u = 0; u < c; u++) {
              const val = this.noiseScratch[u] * scN;
              rawM[bd.lo + u] = val;
              specM[bd.lo + u] = val * lg;
              bp += val * val;
            }
            layerPow[bd.layer] += bp;
          }
        }
      }

      const mStart = ch.midOff[lf];
      const mEnd = ch.midOff[lf + 1];
      for (let p = mStart; p < mEnd; p++) {
        const k = ch.midIdx[p];
        const q = ch.midQ[p];
        const bi = BIN_TO_MID_BAND[k];
        const step = this.bandSteps[bi];
        const val = (q < 0 ? q + 0.14 : q - 0.14) * step;
        rawM[k] = val;
        const layer = MID_BANDS[bi].layer;
        specM[k] = val * eff[layer];
        layerPow[layer] += val * val;
      }

      computeShortSubblockEnv(rawM, winType, this.subEnv);

      // 1b. Coherent Block-Aligned Spectral Extension (Zero Mirror Echo, Zero White-Noise Static)
      let highestReadyEnd = 296;
      for (let bi = 0; bi < 10; bi++) {
        if (ch.scales[scBase + bi] > 0 && ch.scales[scBase + bi] <= 210) {
          highestReadyEnd = Math.max(highestReadyEnd, MID_BANDS[bi].hi);
        }
      }

      for (let fi = 0; fi < 6; fi++) {
        const qFill = ch.scales[scBase + 17 + fi];
        const bi = 4 + fi;
        const bd = MID_BANDS[bi];
        if (qFill > 0 && ch.scales[scBase + bi] <= 210) {
          const bp = synthesizeHarmonicSbrBand(
            rawM,
            bd,
            qFill,
            ch.scales[scBase + bi],
            winType,
            highestReadyEnd,
            this.subEnv,
            nextNoise,
            this.noiseScratch,
            specM,
            eff[bd.layer]
          );
          layerPow[bd.layer] += bp;
          highestReadyEnd = Math.max(highestReadyEnd, bd.hi);
        }
      }

      // 2. Mid High-Bark Coherent Air Extension (12.00..19.60 kHz, Layer 3 — zero static hiss)
      const pnsBd = this._pnsBd || (this._pnsBd = { lo: 0, hi: 0 });
      for (let pi = 0; pi < PNS_MID_BANDS.length; pi++) {
        const qDb = ch.scales[scBase + 10 + pi];
        if (qDb <= 0) continue;
        pnsBd.lo = PNS_MID_BANDS[pi][0];
        pnsBd.hi = PNS_MID_BANDS[pi][1];
        const bp = synthesizeHarmonicSbrBand(
          rawM,
          pnsBd,
          qDb,
          0,
          winType,
          1115,
          this.subEnv,
          nextNoise,
          this.noiseScratch,
          specM,
          g3,
          409
        );
        layerPow[3] += bp;
      }

      // 3. Coupled M/S Panning Prediction + Residual Side Atoms (Layer 4)
      // Uses unmuted rawM[k] for M/S prediction so Solo L05 (Side) & linear stem summation hold 100%!
      let sideP = 0;
      for (let bi = 0; bi < CWC_NUM_PANS; bi++) {
        const bd = SIDE_BANDS[bi];
        const recPan = ch.pans[panBase + bi] * 0.05;
        if (bi < 4) {
          const scVal = ch.scales[scBase + 12 + bi];
          this.sideSteps[bi] = scVal > 0 && scVal <= 210 ? GAIN_LUT[scVal] / bd.qMax : 0;
        }
        if (recPan !== 0) {
          for (let k = bd.lo; k < bd.hi; k++) {
            const pred = recPan * rawM[k];
            specS[k] = pred;
          }
        }
      }

      const sStart = ch.sideOff[lf];
      const sEnd = ch.sideOff[lf + 1];
      for (let p = sStart; p < sEnd; p++) {
        const k = ch.sideIdx[p];
        const q = ch.sideQ[p];
        const bi = BIN_TO_SIDE_BAND[k];
        const step = this.sideSteps[bi];
        specS[k] += (q < 0 ? q + 0.14 : q - 0.14) * step;
      }

      // Apply L05 stem gain & accumulate energy across 4..1115
      for (let k = 4; k < 1115; k++) {
        const v = specS[k];
        sideP += v * v;
        specS[k] = v * g4;
      }

      // 4. Side High-Bark Coherent Air Space (12.00..16.80 kHz, Layer 4)
      for (let pi = 0; pi < PNS_SIDE_BANDS.length; pi++) {
        const qDb = ch.scales[scBase + 16 + pi];
        if (qDb <= 0) continue;
        const [lo, hi] = PNS_SIDE_BANDS[pi];
        const c = hi - lo;
        const rms = PNS_LUT[Math.min(220, qDb)];
        let spP = 0;
        for (let u = 0; u < c; u++) {
          const sv = rawM[643 + u] * 0.6;
          const sVal = g4 > 0 ? specS[643 + u] / g4 : 0;
          const v = sVal !== 0 ? sVal : (u & 8 ? sv : -sv);
          spP += v * v;
        }
        const useCoherent = spP > 1e-10;
        let np = 0;
        for (let u = 0; u < c; u++) {
          let v;
          if (useCoherent) {
            const sVal = g4 > 0 ? specS[643 + u] / g4 : 0;
            v = sVal !== 0 ? sVal : rawM[643 + u] * 0.45 * (u & 8 ? 1 : -1);
          } else {
            v = nextNoise() * 0.35;
          }
          if (winType === WIN_SHORT) v *= this.subEnv[(lo + u) & 7];
          this.noiseScratch[u] = v;
          np += v * v;
        }
        const scN = (useCoherent ? rms : rms * 0.35) * Math.sqrt(c / (np + 1e-12));
        for (let u = 0; u < c; u++) {
          const val = this.noiseScratch[u] * scN;
          sideP += val * val;
          specS[lo + u] = val * g4;
        }
      }
      layerPow[4] += sideP;
    }

    // Orthonormal unitary energy scale: frame RMS = sqrt(power / M)
    const invSqrtM = 1 / Math.sqrt(M);
    this.layerRms[0] = Math.min(1, Math.sqrt(layerPow[0]) * invSqrtM * g0 * 1.9);
    this.layerRms[1] = Math.min(1, Math.sqrt(layerPow[1]) * invSqrtM * g1 * 2.3);
    this.layerRms[2] = Math.min(1, Math.sqrt(layerPow[2]) * invSqrtM * g2 * 3.8);
    this.layerRms[3] = Math.min(1, Math.sqrt(layerPow[3]) * invSqrtM * g3 * 5.2);
    this.layerRms[4] = Math.min(1, Math.sqrt(layerPow[4]) * invSqrtM * g4 * 4.5);

    for (let b = 0; b < 32; b++) {
      const lo = Math.floor(Math.pow(1820, b / 32)) - 1;
      const hi = Math.max(lo + 1, Math.floor(Math.pow(1820, (b + 1) / 32)));
      let e = 0;
      for (let k = Math.max(0, lo); k < Math.min(1820, hi); k++) {
        e += specM[k] * specM[k] + specS[k] * specS[k];
      }
      const db = Math.log10(Math.sqrt(e / (hi - lo + 1)) + 1e-4);
      this.spectrum32[b] = Math.max(0, Math.min(1, (db + 3.2) / 3.4));
    }

    // Run 2 Adaptive Edler IMDCT transforms (Mid + Side)
    this.mdct.inverse(specM, winType, this.outMidN);
    this.mdct.inverse(specS, winType, this.outSideN);

    // Princen-Bradley TDAC overlap-add + Mid/Side -> L/R matrix + soft ceiling
    const mg = this.masterGain;
    for (let n = 0; n < M; n++) {
      const curL = this.outMidN[n] + this.outSideN[n];
      const curR = this.outMidN[n] - this.outSideN[n];
      const l = (this.olaL[n] + curL) * mg;
      const r = (this.olaR[n] + curR) * mg;
      outL[outOffset + n] = (l > 0.995 ? 0.995 : l < -0.995 ? -0.995 : l) + 0;
      outR[outOffset + n] = (r > 0.995 ? 0.995 : r < -0.995 ? -0.995 : r) + 0;
      this.olaL[n] = this.outMidN[M + n] + this.outSideN[M + n];
      this.olaR[n] = this.outMidN[M + n] - this.outSideN[M + n];
    }
  }
}
