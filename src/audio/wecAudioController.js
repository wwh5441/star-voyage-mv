import { MV_DURATION } from "../../data/timeline.js";
import { unpackWecContainer } from "./dsp/cwc-wec-container.js";

export class WecAudioController {
  constructor(srcUrl = "./assets/xinghang.wec") {
    this.srcUrl = srcUrl;
    this.ctx = null;
    this.worklet = null;
    this.analyser = null;
    this.freqData = null;

    this.unpacked = null;
    this.loadingPromise = null;
    this.sampleRate = 44100;
    this.totalSamples = 0;
    this.header = null;

    this._playing = false;
    this._currentTime = 0;
    this._anchorSec = 0;
    this._anchorCtxTime = 0;
    this._rate = 1.0;

    this.energy = { bass: 0, mid: 0, high: 0 };
  }

  async _ensureLoaded() {
    if (this.unpacked) return;
    if (!this.loadingPromise) {
      this.loadingPromise = (async () => {
        const resp = await fetch(this.srcUrl);
        if (!resp.ok) throw new Error(`Failed to fetch ${this.srcUrl}: ${resp.status}`);
        const ab = await resp.arrayBuffer();
        this.unpacked = unpackWecContainer(ab);
        this.header = this.unpacked.header;
        this.sampleRate = this.header.sampleRate;
        this.totalSamples = this.header.totalSamples;
      })();
    }
    await this.loadingPromise;
  }

  async _ensureGraph() {
    await this._ensureLoaded();
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ sampleRate: this.sampleRate });
      await this.ctx.audioWorklet.addModule(new URL("./dsp/cwc-worklet.js", import.meta.url));
      this.worklet = new AudioWorkletNode(this.ctx, "cabron-wec-processor", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2]
      });

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.78;
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

      this.worklet.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      this.worklet.port.postMessage({
        type: "init",
        totalSamples: this.totalSamples,
        totalFrames: this.header.totalFrames,
        tier: "wec"
      });
      this.worklet.port.postMessage({
        type: "wec-bundle",
        chunkBundle: this.unpacked
      });

      this.worklet.port.onmessage = (ev) => {
        const msg = ev.data || {};
        if (msg.type === "telemetry" && this._playing) {
          const sec = Math.max(0, (msg.currentSample - 1024) / this.sampleRate);
          this._currentTime = sec;
          this._anchorSec = sec;
          this._anchorCtxTime = this.ctx.currentTime;
        } else if (msg.type === "ended") {
          this._playing = false;
          this._currentTime = MV_DURATION;
          this._anchorSec = MV_DURATION;
        }
      };
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  async playFrom(sec = null) {
    await this._ensureGraph();
    if (sec !== null) {
      this._currentTime = Math.max(0, Math.min(MV_DURATION, sec));
    }
    this._anchorSec = this._currentTime;
    this._anchorCtxTime = this.ctx.currentTime;
    this._playing = true;
    const sOff = Math.max(0, Math.round(this._currentTime * this.sampleRate) + 1024);
    this.worklet.port.postMessage({ type: "play", sampleOffset: sOff });
  }

  pause() {
    if (this._playing) {
      this._currentTime = this.getCurrentTime();
      this._playing = false;
      if (this.worklet) this.worklet.port.postMessage({ type: "pause" });
    }
  }

  seek(sec) {
    const clamped = Math.max(0, Math.min(MV_DURATION, sec));
    this._currentTime = clamped;
    this._anchorSec = clamped;
    if (this.ctx) this._anchorCtxTime = this.ctx.currentTime;
    if (this.worklet) {
      const sOff = Math.max(0, Math.round(clamped * this.sampleRate) + 1024);
      this.worklet.port.postMessage({ type: "seek", sampleOffset: sOff });
    }
  }

  setPlaybackRate(rate) {
    this._rate = rate;
  }

  get isPlaying() {
    return this._playing;
  }

  getCurrentTime() {
    if (!this._playing || !this.ctx) return this._currentTime;
    const est = this._anchorSec + (this.ctx.currentTime - this._anchorCtxTime);
    return Math.max(0, Math.min(MV_DURATION, est));
  }

  sampleEnergy() {
    if (!this.analyser || !this.freqData || !this._playing) {
      this.energy.bass *= 0.9;
      this.energy.mid *= 0.9;
      this.energy.high *= 0.9;
      return this.energy;
    }
    this.analyser.getByteFrequencyData(this.freqData);
    let b = 0, m = 0, h = 0;
    for (let i = 1; i <= 8; i++) b += this.freqData[i];
    for (let i = 9; i <= 36; i++) m += this.freqData[i];
    for (let i = 37; i <= 96; i++) h += this.freqData[i];

    const tb = b / (8 * 255);
    const tm = m / (28 * 255);
    const th = h / (60 * 255);

    this.energy.bass = this.energy.bass * 0.7 + tb * 0.3;
    this.energy.mid = this.energy.mid * 0.72 + tm * 0.28;
    this.energy.high = this.energy.high * 0.75 + th * 0.25;
    return this.energy;
  }
}
