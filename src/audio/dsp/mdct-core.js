// CabronWEC (CWC-5X) Mathematical Core:
// 1. Unitary O(M log M) Adaptive Edler Bridge MDCT / TDAC IMDCT
//    (Long N = 4096 / M = 2048 <-> 8x Short N = 512 / M = 256 for zero transient pre-echo)
// 2. 24-Bark Critical-Band & 5-Layer Orthogonal Spectral/Spatial Partition
// 3. Shared 0.50 dB Least-Squares Scale & Velvet PNS Lookup Tables

export const CWC_SAMPLE_RATE = 44100;
export const CWC_FRAME_N = 4096;
export const CWC_HOP_M = 2048; // 50% overlap hop (~46.44 ms long / 8 x 5.80 ms short)
export const CWC_SHORT_N = 512;
export const CWC_SHORT_M = 256;
export const CWC_SHORT_K = CWC_HOP_M / CWC_SHORT_M; // 8 short sub-blocks per frame
export const CWC_BPM = 96.0;
export const CWC_BAR_SEC = (60 / CWC_BPM) * 4; // 2.500s per 4/4 bar

export const WIN_LONG = 0;
export const WIN_START = 1;
export const WIN_SHORT = 2;
export const WIN_STOP = 3;
export const WIN_NAMES = ['LONG_4096', 'START_BRIDGE', 'SHORT_8x512', 'STOP_BRIDGE'];

// 24 Zwicker Bark Critical Band Edges (Hz) up to 44.1 kHz Nyquist
export const BARK_EDGES_HZ = [
  0, 100, 200, 300, 400, 510, 630, 770, 920, 1080, 1270, 1480,
  1720, 2000, 2320, 2700, 3150, 3700, 4400, 5300, 6400, 7700, 9500, 12000, 15500,
];

// 5 Orthogonal Real-Time Controllable Acoustic Stems
export const CWC_STEMS = [
  { id: 'sub', code: 'L01', name: 'Sub & Bass Groove', band: '0 – 517 Hz', color: '#06B6D4' },
  { id: 'body', code: 'L02', name: 'Rhythm Guitar & Warmth', band: '517 – 1,550 Hz', color: '#38BDF8' },
  { id: 'vocal', code: 'L03', name: 'Lead Vocal & Formants', band: '1.55 – 4.48 kHz', color: '#F59E0B' },
  { id: 'air', code: 'L04', name: 'Harmonic Air & Velvet', band: '4.48 – 19.6 kHz', color: '#A78BFA' },
  { id: 'side', code: 'L05', name: 'Stereo Side Space', band: 'M/S Pan + Room', color: '#10B981' },
];

// Mid-Channel Tonal Subbands (bins 0..1115 -> 0..12.00 kHz at 10.7666 Hz/bin, Zwicker Bark-aligned)
export const MID_BANDS = [
  { lo: 0, hi: 24, layer: 0, qMax: 35, group: 0, label: 'Sub 0–258Hz' },
  { lo: 24, hi: 48, layer: 0, qMax: 33, group: 0, label: 'Bass 258–517Hz' },
  { lo: 48, hi: 96, layer: 1, qMax: 26, group: 0, label: 'LowMid 517–1034Hz' },
  { lo: 96, hi: 144, layer: 1, qMax: 24, group: 1, label: 'Body 1.03–1.55kHz' },
  { lo: 144, hi: 208, layer: 2, qMax: 19, group: 1, label: 'Presence 1.55–2.24kHz' },
  { lo: 208, hi: 296, layer: 2, qMax: 18, group: 1, label: 'Formant 2.24–3.19kHz' },
  { lo: 296, hi: 409, layer: 2, qMax: 14, group: 1, label: 'Clarity 3.19–4.40kHz' },
  { lo: 409, hi: 594, layer: 3, qMax: 9, group: 2, label: 'Brilliance 4.40–6.40kHz' },
  { lo: 594, hi: 882, layer: 3, qMax: 6, group: 2, label: 'Sibilance 6.40–9.50kHz' },
  { lo: 882, hi: 1115, layer: 3, qMax: 5, group: 2, label: 'CrispAir 9.50–12.00kHz' },
];

// High-Bark Mid Perceptual Noise Substitution (bins 1115..1820 -> 12.00..19.60 kHz, Layer 3)
export const PNS_MID_BANDS = [
  [1115, 1440],
  [1440, 1820],
];

// Side-Channel Coupled M/S Prediction + Residual Subbands (Layer 4)
// Note: band 4 (672..1115) uses pure M/S linear panning prediction (qMax = 0)
export const SIDE_BANDS = [
  { lo: 4, hi: 48, layer: 4, qMax: 18, label: 'SideLow 43–517Hz' },
  { lo: 48, hi: 144, layer: 4, qMax: 14, label: 'SideBody 517–1550Hz' },
  { lo: 144, hi: 368, layer: 4, qMax: 9, label: 'SideVocal 1.55–3.96kHz' },
  { lo: 368, hi: 672, layer: 4, qMax: 5, label: 'SideAir 3.96–7.24kHz' },
  { lo: 672, hi: 1115, layer: 4, qMax: 0, label: 'SidePan 7.24–12.00kHz' },
];

export const PNS_SIDE_BANDS = [
  [1115, 1560],
];

// Total scale bytes per frame:
//   0..9:  MID_BANDS[0..9] tonal step (0 = pure SBR / silence)
//   10..11: PNS_MID_BANDS[0..1] (12.0–19.6 kHz)
//   12..15: SIDE_BANDS[0..3] tonal residual step
//   16:     PNS_SIDE_BANDS[0] (12.0–16.8 kHz)
//   17..22: Harmonic SBR Copy-Up / Velvet Sibilant Fill envelope for MID_BANDS[4..9] (1.55–12.0 kHz)
export const CWC_NUM_SCALES = 23;
export const CWC_NUM_PANS = 5;

// Fine 0.50 dB Least-Squares Scale Lookup Table (qG = 1..210)
export const GAIN_LUT = new Float64Array(211);
for (let q = 1; q <= 210; q++) {
  GAIN_LUT[q] = Math.pow(10, (q * 0.5 - 64) / 20);
}

// Whisper Diffuse Floor Lookup Table (encoded in scale byte 211..255 -> qW = 1..45)
export const WHISPER_LUT = new Float64Array(46);
for (let q = 1; q <= 45; q++) {
  WHISPER_LUT[q] = Math.pow(10, (q * 1.4 - 82) / 20);
}

// High-Bark Velvet PNS RMS Lookup Table (qDb = 1..220, 0.44 dB resolution)
export const PNS_LUT = new Float64Array(221);
for (let q = 1; q <= 220; q++) {
  PNS_LUT[q] = Math.pow(10, (q * 0.44 - 92) / 20);
}

// Precompute bin-to-Mid-band map for fast O(1) CSR reconstruction
export const BIN_TO_MID_BAND = new Int8Array(CWC_HOP_M).fill(-1);
for (let bi = 0; bi < MID_BANDS.length; bi++) {
  for (let k = MID_BANDS[bi].lo; k < MID_BANDS[bi].hi; k++) BIN_TO_MID_BAND[k] = bi;
}

export const BIN_TO_SIDE_BAND = new Int8Array(CWC_HOP_M).fill(-1);
for (let bi = 0; bi < 4; bi++) {
  for (let k = SIDE_BANDS[bi].lo; k < SIDE_BANDS[bi].hi; k++) BIN_TO_SIDE_BAND[k] = bi;
}

/**
 * Builds an orthonormal O(M log M) radix-2 FFT-backed DCT-IV kernel of length M.
 */
function createOrthonormalDCT4(M) {
  const H = M >> 1;
  const scale = Math.sqrt(2.0 / M);
  const twCos = new Float64Array(H);
  const twSin = new Float64Array(H);
  for (let k = 0; k < H; k++) {
    const angle = (Math.PI * (2 * k + 0.5)) / (2 * M);
    twCos[k] = Math.cos(angle);
    twSin[k] = Math.sin(angle);
  }
  const bitRev = new Int32Array(H);
  const bits = Math.round(Math.log2(H));
  for (let i = 0; i < H; i++) {
    let r = 0;
    let x = i;
    for (let b = 0; b < bits; b++) {
      r = (r << 1) | (x & 1);
      x >>= 1;
    }
    bitRev[i] = r;
  }
  const fftCos = new Float64Array(H);
  const fftSin = new Float64Array(H);
  for (let i = 0; i < H; i++) {
    const angle = (-2 * Math.PI * i) / H;
    fftCos[i] = Math.cos(angle);
    fftSin[i] = Math.sin(angle);
  }
  const re = new Float64Array(H);
  const im = new Float64Array(H);

  return function dct4(u, out) {
    for (let n = 0; n < H; n++) {
      const x0 = u[2 * n];
      const x1 = u[M - 1 - 2 * n];
      const j = bitRev[n];
      re[j] = x0 * twCos[n] + x1 * twSin[n];
      im[j] = x1 * twCos[n] - x0 * twSin[n];
    }
    for (let len = 2; len <= H; len <<= 1) {
      const half = len >> 1;
      const step = H / len;
      for (let i = 0; i < H; i += len) {
        for (let j = 0; j < half; j++) {
          const tw = j * step;
          const wr = fftCos[tw];
          const wi = fftSin[tw];
          const tr = re[i + j + half] * wr - im[i + j + half] * wi;
          const ti = re[i + j + half] * wi + im[i + j + half] * wr;
          re[i + j + half] = re[i + j] - tr;
          im[i + j + half] = im[i + j] - ti;
          re[i + j] += tr;
          im[i + j] += ti;
        }
      }
    }
    for (let k = 0; k < H; k++) {
      const r = re[k];
      const m = im[k];
      out[2 * k] = (r * twCos[k] + m * twSin[k]) * scale;
      out[M - 1 - 2 * k] = (r * twSin[k] - m * twCos[k]) * scale;
    }
  };
}

/**
 * Creates an Adaptive Edler Bridge MDCT-TDAC processor supporting seamless switching
 * between N_L = 4096 (M_L = 2048) long windows and K = 8 short windows (N_S = 512, M_S = 256)
 * with exact Princen-Bradley time-domain aliasing cancellation (> 150 dB SNR).
 */
export function createAdaptiveMDCTProcessor(NL = CWC_FRAME_N, NS = CWC_SHORT_N) {
  const ML = NL >> 1;
  const MS = NS >> 1;
  const K = ML / MS;
  const pad = (ML - MS) >> 1;

  const dctL = createOrthonormalDCT4(ML);
  const dctS = createOrthonormalDCT4(MS);

  const winLong = new Float64Array(NL);
  const winStart = new Float64Array(NL);
  const winStop = new Float64Array(NL);
  const winShort = new Float64Array(NS);

  for (let n = 0; n < NL; n++) winLong[n] = Math.sin((Math.PI / NL) * (n + 0.5));
  for (let n = 0; n < NS; n++) winShort[n] = Math.sin((Math.PI / NS) * (n + 0.5));

  // START bridge: [0..ML) long sine, [ML..ML+pad) = 1.0, [ML+pad..ML+pad+MS) short right slope, rest 0
  for (let n = 0; n < ML; n++) winStart[n] = winLong[n];
  for (let n = ML; n < ML + pad; n++) winStart[n] = 1.0;
  for (let n = 0; n < MS; n++) winStart[ML + pad + n] = winShort[MS + n];

  // STOP bridge: [0..pad) = 0, [pad..pad+MS) short left slope, [pad+MS..ML) = 1.0, [ML..NL) long right slope
  for (let n = 0; n < MS; n++) winStop[pad + n] = winShort[n];
  for (let n = pad + MS; n < ML; n++) winStop[n] = 1.0;
  for (let n = ML; n < NL; n++) winStop[n] = winLong[n];

  const wins = [winLong, winStart, null, winStop];
  const foldL = new Float64Array(ML);
  const foldS = new Float64Array(MS);
  const subSpec = new Float64Array(MS);
  const subTime = new Float64Array(NS);

  function forwardSingle(pcm, offset, w, M, dct, fold, out) {
    const H = M >> 1;
    const len = pcm.length;
    for (let n = 0; n < H; n++) {
      const i3 = offset + M + H + n;
      const i2 = offset + M + H - 1 - n;
      const x3 = (i3 >= 0 && i3 < len ? pcm[i3] : 0) * w[M + H + n];
      const x2 = (i2 >= 0 && i2 < len ? pcm[i2] : 0) * w[M + H - 1 - n];
      fold[n] = -x3 - x2;

      const i0 = offset + n;
      const i1 = offset + M - 1 - n;
      const x0 = (i0 >= 0 && i0 < len ? pcm[i0] : 0) * w[n];
      const x1 = (i1 >= 0 && i1 < len ? pcm[i1] : 0) * w[M - 1 - n];
      fold[H + n] = x0 - x1;
    }
    dct(fold, out);
  }

  function inverseSingle(spec, w, M, dct, fold, out) {
    const H = M >> 1;
    dct(spec, fold);
    for (let n = 0; n < H; n++) {
      out[n] = fold[H + n] * w[n];
      out[M - 1 - n] = -fold[H + n] * w[M - 1 - n];
      out[M + H + n] = -fold[n] * w[M + H + n];
      out[M + H - 1 - n] = -fold[n] * w[M + H - 1 - n];
    }
  }

  return {
    NL,
    ML,
    NS,
    MS,
    K,
    pad,
    forward(pcm, offset, winType = WIN_LONG, specOut) {
      if (winType !== WIN_SHORT) {
        forwardSingle(pcm, offset, wins[winType], ML, dctL, foldL, specOut);
      } else {
        for (let s = 0; s < K; s++) {
          forwardSingle(pcm, offset + pad + s * MS, winShort, MS, dctS, foldS, subSpec);
          // Frequency-interleave K short blocks so all subband/Bark bin boundaries match LONG!
          for (let j = 0; j < MS; j++) {
            specOut[j * K + s] = subSpec[j];
          }
        }
      }
    },
    inverse(spec, winType = WIN_LONG, timeOut) {
      if (winType !== WIN_SHORT) {
        inverseSingle(spec, wins[winType], ML, dctL, foldL, timeOut);
      } else {
        timeOut.fill(0);
        for (let s = 0; s < K; s++) {
          for (let j = 0; j < MS; j++) {
            subSpec[j] = spec[j * K + s];
          }
          inverseSingle(subSpec, winShort, MS, dctS, foldS, subTime);
          const base = pad + s * MS;
          for (let n = 0; n < NS; n++) {
            timeOut[base + n] += subTime[n];
          }
        }
      }
    },
  };
}

export const createMDCTProcessor = createAdaptiveMDCTProcessor;
