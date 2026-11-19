import * as THREE from "three";
import { MV_DURATION, getActAt } from "../data/timeline.js";
import { MoebiusPostPipeline } from "./core/postPipeline.js";
import { createSceneRegistry } from "./scenes/sceneRegistry.js";
import { WecAudioController } from "./audio/wecAudioController.js";
import { OverlayController } from "./ui/overlayController.js";

const viewport = document.getElementById("gl-viewport");
function getViewportSize() {
  const rect = viewport.getBoundingClientRect();
  return { w: Math.max(2, Math.floor(rect.width)), h: Math.max(2, Math.floor(rect.height)) };
}

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", stencil: false, depth: false });
const dpr = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(dpr);
const initSz = getViewportSize();
renderer.setSize(initSz.w, initSz.h, false);
viewport.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(36, initSz.w / initSz.h, 0.12, 650.0);
const pipeline = new MoebiusPostPipeline(renderer, initSz.w * dpr, initSz.h * dpr);
const scenes = createSceneRegistry();
const overlay = new OverlayController();
const audio = new WecAudioController("./assets/xinghang.wec");
audio.preload();

let started = false;

function renderFrameAt(t) {
  const clamped = Math.max(0, Math.min(MV_DURATION - 0.001, t));
  const actInfo = getActAt(clamped);
  const { act, u } = actInfo;
  const energy = audio.sampleEnergy();

  overlay.update(clamped, actInfo);

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
}

for (const key of Object.keys(scenes)) {
  const mod = scenes[key];
  if (mod && mod.scene) {
    try {
      renderer.compile(mod.scene, camera);
    } catch {}
  }
}

const curtain = document.getElementById("start-curtain");
async function startPlayback() {
  if (started) return;
  started = true;
  curtain.classList.add("is-hidden");
  await audio.playFrom(0);
}

curtain.addEventListener("click", startPlayback);
document.getElementById("btn-start").addEventListener("click", (e) => {
  e.stopPropagation();
  startPlayback();
});

document.getElementById("frame-16x9").addEventListener("click", async () => {
  if (!started) return startPlayback();
  if (audio.isPlaying) {
    audio.pause();
  } else {
    const resumeAt = audio.getCurrentTime() >= MV_DURATION - 0.1 ? 0.0 : null;
    await audio.playFrom(resumeAt);
  }
});

window.addEventListener("keydown", async (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    if (!started) return startPlayback();
    if (audio.isPlaying) audio.pause();
    else await audio.playFrom(audio.getCurrentTime() >= MV_DURATION - 0.1 ? 0.0 : null);
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
  const t = started ? audio.getCurrentTime() : 0;
  renderFrameAt(t);
}

renderFrameAt(0);
tick();
