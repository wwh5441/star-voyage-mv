// CabronWEC (CWC-5X) Multi-Tier Real-Time AudioWorkletProcessor
// Renders 128-sample hardware audio quanta directly from pure-code CSR chunks
// across 3 live-switchable pure-code editions ('1m', '500k', 'hifi') with clickless TDAC pre-roll.

import { CWC_HOP_M } from './mdct-core.js';
import { CWCStreamDecoder } from './cwc-stream-decoder.js';

class CabronWecWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.decoders = {
      '1m': new CWCStreamDecoder(0),
      '500k': new CWCStreamDecoder(0),
      hifi: new CWCStreamDecoder(0),
      wec: new CWCStreamDecoder(0),
    };
    this.activeTier = '1m';
    this.playing = false;
    this.currentSample = 0;
    this.totalSamples = 0;
    this.totalFrames = 0;
    this.stemControls = {};

    this.hopL = new Float32Array(CWC_HOP_M);
    this.hopR = new Float32Array(CWC_HOP_M);
    this.cachedFrameIdx = -1;

    this.telemetryCounter = 0;
    this.cpuAccumMs = 0;
    this.underruns = 0;

    this.port.onmessage = (ev) => {
      const msg = ev.data || {};
      switch (msg.type) {
        case 'init':
          this.totalSamples = msg.totalSamples || 0;
          this.totalFrames = msg.totalFrames || 0;
          if (msg.tier && this.decoders[msg.tier]) this.activeTier = msg.tier;
          for (const dec of Object.values(this.decoders)) {
            dec.setTotalFrames(this.totalFrames);
          }
          break;
        case 'chunk': {
          const tier = msg.tier && this.decoders[msg.tier] ? msg.tier : '1m';
          const dec = this.decoders[tier];
          dec.ingestChunk(msg.chunkBundle);
          if (tier === this.activeTier && this.cachedFrameIdx >= 0 && msg.chunkBundle) {
            const { startFrame, frameCount } = msg.chunkBundle;
            if (this.cachedFrameIdx >= startFrame && this.cachedFrameIdx < startFrame + frameCount) {
              this.cachedFrameIdx = -1;
            }
          }
          break;
        }
        case 'wec-bundle': {
          const fresh = new CWCStreamDecoder(this.totalFrames);
          fresh.ingestChunk(msg.chunkBundle);
          fresh.setStemControls(this.stemControls);
          this.decoders.wec = fresh;
          this.activeTier = 'wec';
          if (this.totalSamples > 0) {
            this.seek(this.currentSample);
          } else {
            this.cachedFrameIdx = -1;
          }
          break;
        }
        case 'tier': {
          const nextTier = msg.tier && this.decoders[msg.tier] ? msg.tier : '1m';
          if (nextTier !== this.activeTier) {
            this.activeTier = nextTier;
            this.decoders[nextTier].setStemControls(this.stemControls);
            if (this.totalSamples > 0) {
              this.seek(this.currentSample);
            } else {
              this.cachedFrameIdx = -1;
            }
          }
          break;
        }
        case 'play':
          if (typeof msg.sampleOffset === 'number') {
            this.seek(msg.sampleOffset);
          }
          this.playing = true;
          break;
        case 'pause':
          this.playing = false;
          this.emitTelemetry(null);
          break;
        case 'seek':
          this.seek(msg.sampleOffset || 0);
          this.emitTelemetry(null);
          break;
        case 'stems':
          this.stemControls = msg.controls || {};
          for (const dec of Object.values(this.decoders)) {
            dec.setStemControls(this.stemControls);
          }
          if (this.cachedFrameIdx >= 0 && this.activeDecoder.hasFrame(this.cachedFrameIdx)) {
            this.seek(this.currentSample);
          }
          break;
        default:
          break;
      }
    };
  }

  get activeDecoder() {
    return this.decoders[this.activeTier] || this.decoders['1m'];
  }

  seek(sampleOffset) {
    const clamped = Math.max(0, Math.min(Math.max(0, this.totalSamples - 1), sampleOffset | 0));
    const targetFrame = Math.floor(clamped / CWC_HOP_M);
    const dec = this.activeDecoder;
    dec.seekToFrame(targetFrame);
    dec.decodeFrame(targetFrame, this.hopL, this.hopR, 0);
    this.cachedFrameIdx = targetFrame;
    this.currentSample = clamped;
  }

  emitTelemetry(avgQuantumMs = null) {
    const dec = this.activeDecoder;
    this.port.postMessage({
      type: 'telemetry',
      tier: this.activeTier,
      playing: this.playing,
      currentSample: this.currentSample,
      currentFrame: Math.floor(this.currentSample / CWC_HOP_M),
      loadedFrames: dec.loadedCount,
      underruns: this.underruns,
      cpuMs: avgQuantumMs,
      layerRms: [
        dec.layerRms[0],
        dec.layerRms[1],
        dec.layerRms[2],
        dec.layerRms[3],
        dec.layerRms[4],
      ],
      spectrum32: Array.from(dec.spectrum32),
    });
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    if (!out || out.length < 2) return true;
    const outL = out[0];
    const outR = out[1];
    const blockLen = outL.length;

    if (!this.playing || this.totalSamples <= 0) {
      outL.fill(0);
      outR.fill(0);
      return true;
    }

    const dec = this.activeDecoder;
    const hasPerf = typeof performance !== 'undefined';
    const t0 = hasPerf ? performance.now() : 0;

    for (let i = 0; i < blockLen; i++) {
      if (this.currentSample >= this.totalSamples) {
        outL.fill(0, i);
        outR.fill(0, i);
        this.playing = false;
        this.currentSample = 0;
        this.cachedFrameIdx = -1;
        this.port.postMessage({ type: 'ended' });
        break;
      }

      const frameIdx = Math.floor(this.currentSample / CWC_HOP_M);
      const intra = this.currentSample - frameIdx * CWC_HOP_M;

      if (frameIdx !== this.cachedFrameIdx) {
        if (!dec.hasFrame(frameIdx)) {
          this.underruns++;
          this.hopL.fill(0);
          this.hopR.fill(0);
        } else {
          dec.decodeFrame(frameIdx, this.hopL, this.hopR, 0);
        }
        this.cachedFrameIdx = frameIdx;
      }

      outL[i] = this.hopL[intra];
      outR[i] = this.hopR[intra];
      this.currentSample++;
    }

    if (hasPerf) {
      this.cpuAccumMs += performance.now() - t0;
    }

    this.telemetryCounter++;
    if (this.telemetryCounter >= 12) {
      const avgMs = hasPerf ? this.cpuAccumMs / this.telemetryCounter : null;
      this.telemetryCounter = 0;
      this.cpuAccumMs = 0;
      this.emitTelemetry(avgMs);
    }

    return true;
  }
}

registerProcessor('cabron-wec-processor', CabronWecWorkletProcessor);
