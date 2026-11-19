import { MV_DURATION, ACTS } from "../../data/timeline.js";

function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export class PlayerControls {
  constructor({ onStart, onTogglePlay, onSeek, onSpeedChange }) {
    this.curtain = document.getElementById("start-curtain");
    this.btnStart = document.getElementById("btn-start");
    this.hud = document.getElementById("hud-controls");
    this.btnPlay = document.getElementById("btn-play");
    this.btnSpeed = document.getElementById("btn-speed");
    this.btnFs = document.getElementById("btn-fs");
    this.track = document.getElementById("timeline-track");
    this.fill = document.getElementById("timeline-fill");
    this.timeEl = document.getElementById("hud-time");
    this.actEl = document.getElementById("hud-act");

    this.totalStr = fmtTime(MV_DURATION);
    this.hideTimer = null;

    ACTS.forEach((act) => {
      if (act.t0 > 0) {
        const tick = document.createElement("div");
        tick.className = "timeline-tick";
        tick.style.left = `${(act.t0 / MV_DURATION) * 100}%`;
        tick.title = act.label;
        this.track.appendChild(tick);
      }
    });

    this.curtain.addEventListener("click", () => onStart());
    this.btnStart.addEventListener("click", (e) => {
      e.stopPropagation();
      onStart();
    });
    this.btnPlay.addEventListener("click", () => onTogglePlay());

    const SPEEDS = [1.0, 1.25, 1.5];
    let speedIdx = 0;
    if (this.btnSpeed) {
      this.btnSpeed.addEventListener("click", () => {
        speedIdx = (speedIdx + 1) % SPEEDS.length;
        const rate = SPEEDS[speedIdx];
        this.btnSpeed.textContent = `${rate.toFixed(rate === 1.25 ? 2 : 1)}x`;
        onSpeedChange?.(rate);
      });
    }

    let dragging = false;
    const seekFromEvent = (e) => {
      const rect = this.track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onSeek(ratio * MV_DURATION);
    };
    this.track.addEventListener("pointerdown", (e) => {
      dragging = true;
      this.track.setPointerCapture(e.pointerId);
      seekFromEvent(e);
    });
    this.track.addEventListener("pointermove", (e) => {
      if (dragging) seekFromEvent(e);
    });
    this.track.addEventListener("pointerup", () => {
      dragging = false;
    });

    this.btnFs.addEventListener("click", () => {
      const root = document.getElementById("cinema-root");
      if (!document.fullscreenElement) root.requestFullscreen?.();
      else document.exitFullscreen?.();
    });

    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        onTogglePlay();
      } else if (e.code === "ArrowRight") {
        onSeek((this._lastT || 0) + 5.0);
      } else if (e.code === "ArrowLeft") {
        onSeek((this._lastT || 0) - 5.0);
      }
    });

    document.getElementById("frame-16x9").addEventListener("mousemove", () => {
      this.hud.classList.add("is-pinned");
      clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => {
        if (this._playing) this.hud.classList.remove("is-pinned");
      }, 2400);
    });
  }

  hideCurtain() {
    this.curtain.classList.add("is-hidden");
    setTimeout(() => {
      if (this._playing) this.hud.classList.remove("is-pinned");
    }, 2000);
  }

  update(t, isPlaying, label) {
    this._lastT = t;
    this._playing = isPlaying;
    this.btnPlay.textContent = isPlaying ? "PAUSE" : "PLAY";
    this.fill.style.width = `${(t / MV_DURATION) * 100}%`;
    this.timeEl.textContent = `${fmtTime(t)} / ${this.totalStr}`;
    this.actEl.textContent = label;
  }
}
