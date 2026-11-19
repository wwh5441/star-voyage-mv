import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { clamp, mulberry32, smoothstep } from "../core/math.js";
import { buildStarfield } from "./cosmicPrimitives.js";

const QUAD_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`;

// GLSL3 Volumetric Cryogenic LOX Vapor Plume billowing off the Starship outside the glass dome
const VAPOR_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormalId;
uniform float uTime;
uniform float uSeed;
uniform float uOpacity;
in vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.05; a *= 0.5; }
  return v;
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float n = fbm(vec2(vUv.x * 3.2 - uTime * 0.35 + uSeed, vUv.y * 4.5 + uTime * 0.22));
  float mask = smoothstep(1.0, 0.18, length(p * vec2(1.05, 0.92)) - (n - 0.45) * 0.52);
  vec3 col = mix(vec3(0.45, 0.72, 0.98), vec3(0.92, 0.96, 1.0), n);
  float a = mask * uOpacity;
  if (a < 0.015) discard;
  gColor = vec4(col, a);
  gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
}
`;

// GLSL3 Volumetric Searchlight Beam slicing through the night sky
const BEAM_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormalId;
uniform vec3 uColor;
uniform float uOpacity;
in vec2 vUv;
void main() {
  float radial = smoothstep(0.5, 0.0, abs(vUv.x - 0.5));
  float vertical = smoothstep(0.0, 0.14, vUv.y) * smoothstep(1.0, 0.12, vUv.y);
  float a = pow(radial, 2.0) * vertical * uOpacity;
  if (a < 0.01) discard;
  gColor = vec4(uColor, a);
  gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
}
`;

// GLSL3 Holographic 3D Earth Globe (Latitude/Longitude Grid + Fresnel Scanline Rim)
const HOLO_EARTH_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPosition;
in vec3 position;
in vec3 normal;
in vec2 uv;
out vec2 vUv;
out vec3 vWorldNormal;
out vec3 vViewDir;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const HOLO_EARTH_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormalId;
uniform float uTime;
uniform float uGoMix;
in vec2 vUv;
in vec3 vWorldNormal;
in vec3 vViewDir;
void main() {
  float lat = abs(sin(vUv.y * 3.14159 * 14.0));
  float lon = abs(sin((vUv.x + uTime * 0.04) * 3.14159 * 24.0));
  float grid = smoothstep(0.92, 0.995, lat) + smoothstep(0.94, 0.995, lon) * 0.85;
  float fresnel = pow(1.0 - max(0.0, dot(normalize(vWorldNormal), normalize(vViewDir))), 2.2);
  float scan = 0.78 + 0.22 * sin(vUv.y * 90.0 - uTime * 4.2);

  vec3 baseCol = mix(vec3(0.45, 0.78, 0.92), vec3(0.96, 0.78, 0.42), 0.35 + uGoMix * 0.45);
  vec3 col = baseCol * (0.45 + grid * 1.05 + fresnel * 1.15) * scan;
  float a = clamp(0.18 + grid * 0.50 + fresnel * 0.62, 0.0, 0.88);
  gColor = vec4(col, a);
  gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
}
`;

// Moebius Ligne-Claire Vintage-Futuristic Telemetry Strip (Plum-Navy + Warm Ivory/Amber + Dusty Teal)
function createConsoleStripTexture() {
  const cv = document.createElement("canvas");
  cv.width = 1024;
  cv.height = 128;
  const ctx = cv.getContext("2d");
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;

  const labels = ["LOX-PRESS", "CH4-TEMP", "ARK-CORE", "GUIDANCE", "STARRAIL", "FLIGHT-SYS", "ORBIT-WIN", "GO-POLL"];

  function update(u, time, goMix) {
    ctx.clearRect(0, 0, 1024, 128);
    ctx.fillStyle = "rgba(22, 22, 48, 0.94)";
    ctx.fillRect(0, 0, 1024, 128);

    const cellW = 128;
    for (let i = 0; i < 8; i++) {
      const ox = i * cellW;
      const isGo = goMix > i * 0.11;
      const stroke = isGo ? "rgba(235, 178, 86, 0.88)" : "rgba(218, 206, 180, 0.62)";
      const accent = isGo ? "#f2c166" : "#e8dfc8";
      const subAcc = "#7cc8dc";

      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.strokeRect(ox + 6, 8, cellW - 12, 112);

      ctx.fillStyle = accent;
      ctx.font = "700 13px 'SF Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText(labels[i], ox + 14, 28);

      if (i % 2 === 0) {
        for (let b = 0; b < 6; b++) {
          const h = 16 + 44 * (0.5 + 0.5 * Math.sin(time * 2.2 + i * 1.3 + b * 0.85));
          ctx.fillStyle = b === 5 || isGo ? "#e8a848" : subAcc;
          ctx.fillRect(ox + 16 + b * 16, 108 - h, 10, h);
        }
      } else {
        ctx.strokeStyle = isGo ? "#f2c166" : subAcc;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let x = 0; x < 96; x += 6) {
          const y = 74 + Math.sin(x * 0.12 + time * 4.0 + i) * 20;
          if (x === 0) ctx.moveTo(ox + 16 + x, y);
          else ctx.lineTo(ox + 16 + x, y);
        }
        ctx.stroke();
      }
    }
    tex.needsUpdate = true;
  }

  return { tex, update };
}

// Moebius Ligne-Claire Architectural Blueprint Telemetry Walls (Plum-Indigo + Warm Parchment Gold + Dusty Teal)
function createFlankingWallTexture(side = "left") {
  const cv = document.createElement("canvas");
  cv.width = 1024;
  cv.height = 512;
  const ctx = cv.getContext("2d");
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;

  function update(t, goMix) {
    ctx.clearRect(0, 0, 1024, 512);
    ctx.fillStyle = "rgba(24, 23, 52, 0.94)";
    ctx.fillRect(0, 0, 1024, 512);

    const accent = goMix > 0.55 ? "#f2c166" : "#e8dfc8";
    const teal = "#7cc8dc";
    const dim = "rgba(214, 198, 170, 0.20)";

    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(14, 14, 996, 484);

    ctx.strokeStyle = dim;
    ctx.lineWidth = 1;
    for (let x = 64; x < 1000; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 70); ctx.lineTo(x, 480); ctx.stroke();
    }
    for (let y = 96; y < 480; y += 64) {
      ctx.beginPath(); ctx.moveTo(28, y); ctx.lineTo(996, y); ctx.stroke();
    }

    ctx.fillStyle = accent;
    ctx.font = "700 22px 'SF Mono', monospace";
    ctx.textAlign = "left";
    if (side === "left") {
      ctx.fillText("STARRAIL LAUNCH // ARK CORE & PROPELLANT", 36, 52);
      const tanks = ["CORE-LOX", "CORE-CH4", "BOOST-A", "BOOST-B"];
      tanks.forEach((nm, i) => {
        const bx = 56 + i * 110;
        const pct = 0.86 + 0.12 * Math.sin(t * 1.2 + i * 0.9);
        ctx.strokeStyle = accent; ctx.lineWidth = 2;
        ctx.strokeRect(bx, 110, 66, 290);
        ctx.fillStyle = i % 2 === 0 ? "rgba(124, 200, 220, 0.72)" : "rgba(232, 168, 72, 0.78)";
        ctx.fillRect(bx + 4, 396 - pct * 282, 58, pct * 282);
        ctx.fillStyle = "#f4eee0";
        ctx.font = "700 14px 'SF Mono', monospace";
        ctx.fillText(nm, bx, 430);
      });
      const cx = 740, cy = 265;
      [115, 68, 24].forEach((rad, ri) => {
        const n = ri === 0 ? 16 : ri === 1 ? 8 : 4;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, 9, 0, Math.PI * 2);
          ctx.fillStyle = goMix > 0.4 ? "#f2c166" : teal;
          ctx.fill();
        }
      });
    } else {
      ctx.fillText("ORBITAL WINDOW // ASCENT PROFILE & GO-POLL", 36, 52);
      ctx.strokeStyle = "#f2c166";
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let x = 0; x <= 560; x += 12) {
        const f = x / 560;
        const y = 430 - Math.pow(f, 0.58) * 310;
        if (x === 0) ctx.moveTo(54 + x, y);
        else ctx.lineTo(54 + x, y);
      }
      ctx.stroke();
      const mf = (t * 0.14) % 1.0;
      const mx = 54 + mf * 560;
      const my = 430 - Math.pow(mf, 0.58) * 310;
      ctx.fillStyle = "#fff6dc";
      ctx.beginPath(); ctx.arc(mx, my, 8, 0, Math.PI * 2); ctx.fill();

      const checks = ["PROP   GO", "GNC    GO", "FIDO   GO", "RANGE  GO", "FLIGHT GO", "LINK   GO"];
      ctx.font = "700 24px 'SF Mono', monospace";
      checks.forEach((txt, i) => {
        const active = goMix > i * 0.12 || t > 1.2;
        ctx.fillStyle = active ? (goMix > 0.5 ? "#f2c166" : "#f4eee0") : "rgba(180, 175, 195, 0.4)";
        ctx.fillText("● " + txt, 680, 145 + i * 52);
      });
    }
    tex.needsUpdate = true;
  }

  return { tex, update };
}

// ============================================================================
// S02 (10.0s - 20.0s): Curved Glass Starbase Observatory Dome + 3D Holographic Earth-Orbit Projector
// ============================================================================
export function buildMissionControlScene() {
  const scene = new THREE.Scene();
  const rand = mulberry32(202602);

  // Sparkling deep night sky outside the 180-degree panoramic glass curtain wall
  scene.add(buildStarfield(2400, 420, 202602));

  // Exact same Moebius twilight plum-indigo sky gradient as S01 & S04!
  const skyCv = document.createElement("canvas");
  skyCv.width = 16; skyCv.height = 256;
  const sctx = skyCv.getContext("2d");
  const sgrad = sctx.createLinearGradient(0, 0, 0, 256);
  sgrad.addColorStop(0.0, "#050713");
  sgrad.addColorStop(0.55, "#111636");
  sgrad.addColorStop(0.80, "#2b2552");
  sgrad.addColorStop(0.92, "#3f2e5e");
  sgrad.addColorStop(1.0, "#1d1836");
  sctx.fillStyle = sgrad;
  sctx.fillRect(0, 0, 16, 256);
  const skyTex = new THREE.CanvasTexture(skyCv);
  skyTex.colorSpace = THREE.NoColorSpace;
  scene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(240, 32, 24),
      createCelMaterial({ color: 0xffffff, map: skyTex, unlit: true, noInk: true, side: THREE.BackSide, depthWrite: false })
    )
  );

  // 100% Unified Moebius / Franco-Belgian Ligne-Claire Palette (matching S01 & S04: warm cream + plum-indigo shadows + warm gold!)
  const floorMat = createCelMaterial({ color: 0x453e66, shadowColor: 0x221d3b, ambientBoost: 0.22, patternMode: 3, patternScale: new THREE.Vector2(14, 14), patternStrength: 0.65, rimStrength: 0.16, rimColor: 0xffe4b5 });
  const ribMat = createCelMaterial({ color: 0xd8d2be, shadowColor: 0x5c557d, ambientBoost: 0.18, rimStrength: 0.35, rimColor: 0xffe4b5 });
  const steelMat = createCelMaterial({ color: 0xf4eee0, shadowColor: 0x6a5f8e, ambientBoost: 0.20, rimStrength: 0.45, rimColor: 0xffd98a });
  const deskBodyMat = createCelMaterial({ color: 0xdcd4c0, shadowColor: 0x585078, ambientBoost: 0.22, rimStrength: 0.32, rimColor: 0xffe6b0 });

  // --------------------------------------------------------------------------
  // 1. EXTERIOR ILLUMINATED LAUNCHPAD — 100% IDENTICAL TO S01 / S04 / S05 ("星航号运载箭" + 4 Tulip Trusses!)
  // --------------------------------------------------------------------------
  const extGroup = new THREE.Group();
  extGroup.position.set(0, -6.5, -56.0);
  scene.add(extGroup);

  const hullWhite = createCelMaterial({ color: 0xf4eee0, shadowColor: 0x6a5f8e, patternMode: 2, patternScale: new THREE.Vector2(6, 10), patternStrength: 0.7, rimStrength: 0.45 });
  const hullBlue = createCelMaterial({ color: 0x4e6496, shadowColor: 0x29325c, rimStrength: 0.35 });
  const amberBandMat = createCelMaterial({ color: 0xe69738, shadowColor: 0x73463d });
  const trussCreamMat = createCelMaterial({ color: 0xd8d2be, shadowColor: 0x5c557d, rimStrength: 0.35 });
  const reactorRingMat = createCelMaterial({ color: 0x9cf2ff, emissive: 0x4ddbff, emissiveStrength: 2.2, unlit: true, noInk: true });

  // Exact same Cream-White "星航号运载箭" with 4 tapered white/blue strap-on boosters!
  const arkRocket = new THREE.Group();
  arkRocket.scale.setScalar(1.35);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.32, 18.5, 24), hullWhite);
  core.position.y = 9.8;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.18, 1.2, 24), amberBandMat);
  band.position.y = 16.8;
  const coreRing = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.12, 10, 32), reactorRingMat);
  coreRing.rotation.x = Math.PI / 2;
  coreRing.position.y = 14.2;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.16, 5.8, 24), hullWhite);
  nose.position.y = 21.95;
  arkRocket.add(core, band, coreRing, nose);

  for (let i = 0; i < 4; i++) {
    const bWrap = new THREE.Group();
    bWrap.rotation.y = (i * Math.PI) / 2 + Math.PI / 4;
    arkRocket.add(bWrap);
    const bMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 1.44, 13.8, 20), i % 2 === 0 ? hullWhite : hullBlue);
    bMesh.position.set(1.95, 7.1, 0);
    bMesh.rotation.z = 0.088;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.9, 0.14), amberBandMat);
    fin.position.set(3.05, 1.35, 0);
    bWrap.add(bMesh, fin);
  }
  extGroup.add(arkRocket);

  // Exact same 4 Articulated Tulip Service Trusses cradling the rocket!
  for (let idx = 0; idx < 4; idx++) {
    const baseRot = new THREE.Group();
    baseRot.rotation.y = (idx * Math.PI) / 2 + Math.PI / 4;
    baseRot.scale.setScalar(1.35);
    extGroup.add(baseRot);

    const boomLen = 23.0;
    [-0.55, 0.55].forEach((bz) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.28, boomLen, 0.28), trussCreamMat);
      c.position.set(4.4, boomLen * 0.5, bz);
      c.rotation.z = 0.14;
      baseRot.add(c);
    });
    for (let k = 1; k <= 6; k++) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.18, 1.3), trussCreamMat);
      rung.position.set(4.4 - k * 0.36, k * 3.1, 0);
      baseRot.add(rung);
    }
  }

  // Flashing Amber Aviation Beacon atop the rocket gantry zone
  const beaconMat = createCelMaterial({ color: 0xffc857, emissive: 0xffa624, emissiveStrength: 2.6, unlit: true, noInk: true });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), beaconMat);
  beacon.position.set(0, 34.5, 0);
  extGroup.add(beacon);

  // 6 GLSL3 Volumetric Cryogenic LOX Vapor Plumes billowing off the rocket!
  const vaporMats = [];
  for (let i = 0; i < 6; i++) {
    const vMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: QUAD_VERT,
      fragmentShader: VAPOR_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uSeed: { value: i * 1.73 },
        uOpacity: { value: 0.42 }
      }
    });
    vaporMats.push(vMat);
    const vp = new THREE.Mesh(new THREE.PlaneGeometry(18 + i * 2.5, 12 + (i % 3) * 3), vMat);
    vp.position.set(-2.5 + (i - 2.5) * 4.2, 6.0 + (i % 3) * 8.5, 3.0 - i * 0.8);
    extGroup.add(vp);
  }

  // 4 GLSL3 Volumetric Searchlight Cones slicing diagonally across the night sky
  const beamConfigs = [
    { x: -24, z: -4, rotZ: -0.34, col: new THREE.Color(0x6ee0ff) },
    { x: -12, z: 2, rotZ: -0.18, col: new THREE.Color(0xffe094) },
    { x: 18, z: -2, rotZ: 0.28, col: new THREE.Color(0x6ee0ff) },
    { x: 28, z: -6, rotZ: 0.42, col: new THREE.Color(0xffd275) }
  ];
  const searchBeams = beamConfigs.map((cfg) => {
    const bMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: QUAD_VERT,
      fragmentShader: BEAM_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uColor: { value: cfg.col }, uOpacity: { value: 0.32 } }
    });
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(11, 58), bMat);
    bm.position.set(cfg.x, 22, cfg.z);
    bm.rotation.z = cfg.rotZ;
    extGroup.add(bm);
    return { mesh: bm, baseRot: cfg.rotZ };
  });

  // --------------------------------------------------------------------------
  // 2. CLEAN ARCHITECTURAL PANORAMIC OBSERVATORY HALL & 3 STEPPED COMMAND TIERS
  // (Properly sloped DOWN toward the panoramic launchpad window at z = -18, 100% solid meshes, ZERO culling glitches!)
  // --------------------------------------------------------------------------
  const hallGroup = new THREE.Group();
  scene.add(hallGroup);

  // Solid reflective midnight-slate main floor + sleek overhead architectural ceiling beams
  const mainFloor = new THREE.Mesh(new THREE.BoxGeometry(52, 0.5, 42), floorMat);
  mainFloor.position.set(0, -2.8, -1.0);
  hallGroup.add(mainFloor);

  // Panoramic Window Frame at z = -18.5 (clean vertical mullions + top/bottom header framing the Starship outside!)
  const winBottom = new THREE.Mesh(new THREE.BoxGeometry(52, 1.2, 0.8), ribMat);
  winBottom.position.set(0, -2.0, -18.5);
  const winTop = new THREE.Mesh(new THREE.BoxGeometry(52, 1.4, 1.2), ribMat);
  winTop.position.set(0, 12.2, -18.5);
  hallGroup.add(winBottom, winTop);

  for (let i = -3; i <= 3; i++) {
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.32, 14.4, 0.55), ribMat);
    mullion.position.set(i * 7.2, 5.1, -18.5);
    hallGroup.add(mullion);
  }
  // Overhead architectural ceiling ribs + warm parchment-gold light bars (Moebius Ligne-Claire, zero cyberpunk neon!)
  const ceilingLightMat = createCelMaterial({ color: 0xfff0cc, emissive: 0xe6b55c, emissiveStrength: 0.85, unlit: true, noInk: true });
  for (let z = -14; z <= 12; z += 5.5) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(52, 0.45, 0.75), ribMat);
    const by = 12.2 + (z + 14) * 0.06;
    beam.position.set(0, by, z);
    hallGroup.add(beam);
    const lightStrip = new THREE.Mesh(new THREE.BoxGeometry(36, 0.08, 0.18), ceilingLightMat);
    lightStrip.position.set(0, by - 0.28, z);
    hallGroup.add(lightStrip);
  }

  // Warm gold center-aisle floor guide strips leading the eye straight to the 3D Holo-Earth & Ark Rocket!
  [-2.6, 2.6].forEach((ax) => {
    const aisleStrip = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.04, 24.0), ceilingLightMat);
    aisleStrip.position.set(ax, -2.52, -4.5);
    hallGroup.add(aisleStrip);
  });

  // Flanking Colossal Angled Telemetry Command Walls (Left & Right of the Central Launchpad Window!)
  const leftWallDisp = createFlankingWallTexture("left");
  const rightWallDisp = createFlankingWallTexture("right");
  const leftWallScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(13.5, 6.8),
    createCelMaterial({ color: 0xffffff, map: leftWallDisp.tex, emissive: 0xe6b86a, emissiveStrength: 0.22, unlit: true, noInk: true })
  );
  leftWallScreen.position.set(-13.8, 3.8, -14.2);
  leftWallScreen.rotation.y = 0.42;
  hallGroup.add(leftWallScreen);

  const rightWallScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(13.5, 6.8),
    createCelMaterial({ color: 0xffffff, map: rightWallDisp.tex, emissive: 0xe6b86a, emissiveStrength: 0.22, unlit: true, noInk: true })
  );
  rightWallScreen.position.set(13.8, 3.8, -14.2);
  rightWallScreen.rotation.y = -0.42;
  hallGroup.add(rightWallScreen);

  // Stylized Moebius Flight Crew (warm plum-indigo suits with crisp warm rim-light!)
  const operatorMat = createCelMaterial({ color: 0x4e6496, shadowColor: 0x26284d, ambientBoost: 0.22, rimStrength: 0.48, rimColor: 0xffe4b0 });

  // 3 Stepped Amphitheater Command Rows (Rear row HIGHEST -> Front row LOWEST facing the window!)
  const consoleStrip = createConsoleStripTexture();
  const screenMat = createCelMaterial({
    color: 0xffffff,
    map: consoleStrip.tex,
    emissive: 0x5cd6ff,
    emissiveStrength: 0.55,
    unlit: true,
    noInk: true
  });

  const tierLightMats = [];
  const rowSpecs = [
    { zBase: -11.5, yBase: -2.2, pods: 7, spanX: 20.0, curveZ: 2.2 }, // Front row (lowest, closest to window)
    { zBase: -4.5,  yBase: -1.2, pods: 8, spanX: 24.0, curveZ: 2.6 }, // Mid row
    { zBase: 3.0,   yBase: -0.2, pods: 9, spanX: 28.0, curveZ: 3.0 }  // Rear row (highest)
  ];

  rowSpecs.forEach((row, rIdx) => {
    if (rIdx > 0) {
      const riser = new THREE.Mesh(new THREE.BoxGeometry(row.spanX + 8.0, row.yBase + 2.6, 6.2), floorMat);
      riser.position.set(0, -2.55 + (row.yBase + 2.6) * 0.5, row.zBase + 1.2);
      hallGroup.add(riser);
    }

    const stripMat = createCelMaterial({
      color: 0x6ee2ff,
      emissive: 0x3ec8ff,
      emissiveStrength: 1.5,
      unlit: true,
      noInk: true
    });
    tierLightMats.push(stripMat);

    for (let p = 0; p < row.pods; p++) {
      const frac = row.pods > 1 ? (p / (row.pods - 1)) * 2.0 - 1.0 : 0.0;
      if (rIdx < 2 && Math.abs(frac) < 0.22) continue;

      const px = frac * (row.spanX * 0.5);
      const pz = row.zBase - (1.0 - frac * frac) * row.curveZ;
      const pod = new THREE.Group();
      pod.position.set(px, row.yBase, pz);
      pod.rotation.y = -frac * 0.28;

      const desk = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.95, 1.05), deskBodyMat);
      desk.position.y = 0.48;
      const monitor = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.68, 0.08), screenMat);
      monitor.position.set(0, 1.28, -0.18);
      monitor.rotation.x = -0.22;
      const statusBar = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.07, 0.09), stripMat);
      statusBar.position.set(0, 0.96, 0.48);
      pod.add(desk, monitor, statusBar);

      hallGroup.add(pod);
    }
  });

  // Clean unobstructed center aisle straight out to the panoramic launchpad window (removed floating holo-globe!)
  const cyanCol = new THREE.Color(0x6ee2ff);
  const goldCol = new THREE.Color(0xffd26b);
  const cyanEm = new THREE.Color(0x3ec8ff);
  const goldEm = new THREE.Color(0xffa824);

  return {
    scene,
    update(submode, u, time, camera, audio) {
      const bass = audio ? audio.bass : 0;
      const localT = u * 4.5;

      // Exterior cryogenic vapor & sweeping searchlights
      vaporMats.forEach((vm) => { vm.uniforms.uTime.value = localT; });
      searchBeams.forEach((sb, i) => {
        sb.mesh.rotation.z = sb.baseRot + Math.sin(localT * 0.45 + i * 1.4) * 0.08;
      });
      beaconMat.uniforms.uEmissiveStrength.value = 1.6 + Math.pow(0.5 + 0.5 * Math.sin(localT * 4.5), 3.0) * 2.2;

      // Cascade "ALL SYSTEMS GO" smoothly from rear tier -> front tier across the 4.5s shot!
      const goGlobal = smoothstep(0.28, 0.88, u);
      consoleStrip.update(u, localT, goGlobal);
      leftWallDisp.update(localT, goGlobal);
      rightWallDisp.update(localT, goGlobal);

      tierLightMats.forEach((mat, idx) => {
        const tierGo = smoothstep(0.25 + (2 - idx) * 0.16, 0.50 + (2 - idx) * 0.16, u);
        mat.uniforms.uColor.value.copy(cyanCol).lerp(goldCol, tierGo);
        mat.uniforms.uEmissive.value.copy(cyanEm).lerp(goldEm, tierGo);
        mat.uniforms.uEmissiveStrength.value = 1.2 + tierGo * 0.7 + bass * 0.3;
      });

      // Clean, punchy 4.5s push-in down the unobstructed Moebius Launch Control aisle straight toward the "星航号" rocket!
      camera.fov = 46 - u * 6.0;
      camera.position.set(-1.4 + u * 1.4, 2.2 - u * 0.4, 8.8 - u * 10.5);
      camera.lookAt(0.0, 3.2 + u * 3.5, -48.0);
      camera.updateProjectionMatrix();

      return { sunDir: new THREE.Vector3(-0.4, 0.65, -0.65), clearColor: 0x050816, shadowBounds: null };
    }
  };
}
