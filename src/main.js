import * as THREE from "three";
import { MV_DURATION, getActAt } from "../data/timeline.js";
import { MoebiusPostPipeline } from "./core/postPipeline.js";
import { createSceneRegistry } from "./scenes/sceneRegistry.js";
import { WecAudioController } from "./audio/wecAudioController.js";
import { OverlayController } from "./ui/overlayController.js";
import { PlayerControls } from "./ui/playerControls.js";

const params = new URLSearchParams(window.location.search);
const isHeadless = params.get("headless") === "1";
if (isHeadless || params.get("clean") === "1") {
  document.body.classList.add("headless-mode");
}

const viewport = document.getElementById("gl-viewport");
function getViewportSize() {
  const rect = viewport.getBoundingClientRect();
  return { w: Math.max(2, Math.floor(rect.width)), h: Math.max(2, Math.floor(rect.height)) };
}

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", stencil: false, depth: false });
const dpr = isHeadless ? 1 : Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(dpr);
const initSz = getViewportSize();
renderer.setSize(initSz.w, initSz.h, false);
viewport.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(36, initSz.w / initSz.h, 0.12, 650.0);
const pipeline = new MoebiusPostPipeline(renderer, initSz.w * dpr, initSz.h * dpr);
const scenes = createSceneRegistry();
const overlay = new OverlayController();
const audio = new WecAudioController("./assets/xinghang.wec");

const STORAGE_KEY_TIME = "xinghang_last_t";
function loadSavedTime() {
  const fromQuery = parseFloat(params.get("t"));
  if (Number.isFinite(fromQuery) && fromQuery >= 0 && fromQuery < MV_DURATION) return fromQuery;
  try {
    const saved = parseFloat(localStorage.getItem(STORAGE_KEY_TIME));
    if (Number.isFinite(saved) && saved >= 0 && saved < MV_DURATION - 0.5) return saved;
  } catch {}
  return 0.0;
}
let lastPersistMs = 0;
function persistTime(t, force = false) {
  const now = performance.now();
  if (!force && now - lastPersistMs < 350) return;
  lastPersistMs = now;
  try {
    localStorage.setItem(STORAGE_KEY_TIME, Math.max(0, Math.min(MV_DURATION, t)).toFixed(2));
  } catch {}
}

let started = false;
let manualTime = loadSavedTime();

// Deterministic 150 BPM energy envelope for offline headless 30fps rendering
const detEnergy = { bass: 0, mid: 0, high: 0 };
function sampleDeterministicEnergy(t) {
  const beatPeriod = 0.40; // 150 BPM
  const beatPhase = ((t % beatPeriod) + beatPeriod) % beatPeriod / beatPeriod;
  const kick = Math.pow(Math.max(0, 1.0 - beatPhase * 2.4), 2.0);
  const intensity = t < 20.0 ? 0.25 : t < 174.5 ? 0.65 : t < 257.0 ? 0.85 : 0.45;
  detEnergy.bass = (0.18 + kick * 0.58) * intensity;
  detEnergy.mid = (0.22 + Math.sin(t * 7.85) * 0.14 + 0.14) * intensity;
  detEnergy.high = (0.15 + Math.abs(Math.sin(t * 15.7)) * 0.25) * intensity;
  return detEnergy;
}

// Sync CSS animations & transitions deterministically in headless capture mode
function syncCssAnimationsAt(t) {
  if (!isHeadless) return;
  const actInfo = getActAt(t);
  const act = actInfo.act;
  const endLayer = document.getElementById("black-card-layer");
  if (endLayer) {
    const titleElapsedMs = act.endCard && t >= act.t0 + 1.75 ? (t - (act.t0 + 1.75)) * 1000 : 0;
    for (const anim of endLayer.getAnimations({ subtree: true })) {
      anim.pause();
      anim.currentTime = Math.max(0, titleElapsedMs);
    }
  }
}

function renderFrameAt(t) {
  const clamped = Math.max(0, Math.min(MV_DURATION - 0.001, t));
  const actInfo = getActAt(clamped);
  const { act, u } = actInfo;
  const energy = isHeadless && !audio.isPlaying ? sampleDeterministicEnergy(clamped) : audio.sampleEnergy();

  overlay.update(clamped, actInfo);
  syncCssAnimationsAt(clamped);

  const mod = scenes[act.scene];
  if (mod) {
    camera.up.set(0, 1, 0);
    const cfg =
      act.submode !== undefined
        ? mod.update(act.submode, u, clamped, camera, energy)
        : mod.update(u, clamped, camera, energy);

    pipeline.render(mod.scene, camera, {
      time: clamped,
      inkStrength: act.inkStrength ?? 1.05,
      bloomStrength: (act.bloomStrength ?? 0.6) + energy.bass * 0.25,
      sunDir: cfg.sunDir,
      shadowBounds: cfg.shadowBounds,
      clearColor: cfg.clearColor
    });
  }
  return actInfo;
}

// Pre-compile all unique scene shaders upfront to eliminate mid-playback / first-frame hitching
function warmupAllScenes() {
  const seen = new Set();
  for (const key of Object.keys(scenes)) {
    const mod = scenes[key];
    if (mod && mod.scene && !seen.has(mod.scene)) {
      seen.add(mod.scene);
      try {
        renderer.compile(mod.scene, camera);
      } catch {}
    }
  }
}
warmupAllScenes();

window.MV_DURATION = MV_DURATION;
window.READY = true;
window.renderAt = (t) => {
  if (!isHeadless) audio.pause();
  started = false;
  manualTime = t;
  const info = renderFrameAt(t);
  if (!isHeadless) controls.update(t, false, info.act.label);
};

const controls = new PlayerControls({
  onStart: async () => {
    if (started) return;
    started = true;
    controls.hideCurtain();
    await audio.playFrom(manualTime);
  },
  onTogglePlay: async () => {
    if (!started) {
      started = true;
      controls.hideCurtain();
      await audio.playFrom(manualTime);
      return;
    }
    if (audio.isPlaying) {
      audio.pause();
      persistTime(audio.getCurrentTime(), true);
    } else {
      const resumeAt = audio.getCurrentTime() >= MV_DURATION - 0.1 ? 0.0 : null;
      await audio.playFrom(resumeAt);
    }
  },
  onSeek: (sec) => {
    if (!started) {
      started = true;
      controls.hideCurtain();
    }
    manualTime = Math.max(0, Math.min(MV_DURATION, sec));
    audio.seek(manualTime);
    persistTime(manualTime, true);
  },
  onSpeedChange: (rate) => {
    audio.setPlaybackRate(rate);
  }
});

window.addEventListener("resize", () => {
  const sz = getViewportSize();
  const curDpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(curDpr);
  renderer.setSize(sz.w, sz.h, false);
  camera.aspect = sz.w / sz.h;
  camera.updateProjectionMatrix();
  pipeline.setSize(sz.w * curDpr, sz.h * curDpr);
});

function tick() {
  requestAnimationFrame(tick);
  const t = started ? audio.getCurrentTime() : manualTime;
  const info = renderFrameAt(t);
  if (started) {
    controls.update(t, audio.isPlaying, info.act.label);
    persistTime(t);
  }
}

const initInfo = renderFrameAt(manualTime);
if (!isHeadless) {
  controls.update(manualTime, false, initInfo.act.label);
  tick();
}
