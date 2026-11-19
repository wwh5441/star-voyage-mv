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

// GLSL3 Volumetric Cryogenic LOX Vapor Storm billowing downward from the engine bells (S03A & S03C)
const CRYO_STORM_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormalId;
uniform float uTime;
uniform float uSeed;
uniform float uOpacity;
uniform float uWarmMix;
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
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.06; a *= 0.5; }
  return v;
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float n = fbm(vec2(vUv.x * 3.4 + uSeed, vUv.y * 4.8 + uTime * 0.72));
  float mask = smoothstep(0.95, 0.16, length(p * vec2(1.05, 0.92)) - (n - 0.44) * 0.54);
  vec3 coolCol = mix(vec3(0.55, 0.80, 0.98), vec3(0.96, 0.97, 1.0), n);
  vec3 warmCol = mix(vec3(0.95, 0.62, 0.28), vec3(1.0, 0.92, 0.72), n);
  vec3 col = mix(coolCol, warmCol, uWarmMix * 0.65);
  float a = mask * uOpacity;
  if (a < 0.015) discard;
  gColor = vec4(col, a);
  gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
}
`;

// GLSL3 Flickering Methalox Pre-Ignition Engine Flame Tongue (S02C Authentic Rocket Pre-Ignition!)
const PREIGN_FLAME_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormalId;
uniform float uTime;
uniform float uIgnition;
uniform float uSeed;
in vec2 vUv;
void main() {
  // vUv.y = 1 at nozzle exit -> 0 at flame tip
  float x = abs(vUv.x - 0.5) * 2.0;
  float flicker = 0.85 + 0.15 * sin(uTime * 42.0 + vUv.y * 16.0 + uSeed);
  float width = mix(0.18, 0.88, pow(vUv.y, 0.65)) * flicker;
  float radial = smoothstep(width, width * 0.15, x);
  float axial = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
  // Blue-white methalox core near nozzle -> fiery amber-orange outer flame!
  float coreMask = smoothstep(0.45, 0.0, x) * smoothstep(0.35, 0.92, vUv.y);
  vec3 col = mix(vec3(1.0, 0.48, 0.12), vec3(1.0, 0.88, 0.45), vUv.y);
  col = mix(col, vec3(0.65, 0.90, 1.0), coreMask * 0.82);
  float a = radial * axial * uIgnition;
  if (a < 0.015) discard;
  gColor = vec4(col * (1.2 + coreMask * 0.8), a);
  gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
}
`;

// Sculpted Parabolic Rocket Engine Bell Geometry (authentic aerospace curve, zero crude cylinders!)
function createEngineBellGeometry(scale = 1.0) {
  const pts = [
    new THREE.Vector2(0.28 * scale, 1.45 * scale),
    new THREE.Vector2(0.22 * scale, 1.05 * scale),
    new THREE.Vector2(0.42 * scale, 0.62 * scale),
    new THREE.Vector2(0.68 * scale, 0.20 * scale),
    new THREE.Vector2(0.84 * scale, -0.35 * scale),
    new THREE.Vector2(0.90 * scale, -0.78 * scale)
  ];
  return new THREE.LatheGeometry(pts, 24);
}

// ============================================================================
// BRAND-NEW S03A / S03B / S03C (16.0s - 30.5s) — 100% Unified Moebius Ligne-Claire!
//   S03A (pilot_lock):   Heroic Macro Under the Launch Mount — 19 Sculpted Engine Bells + Cryo Storm + Pre-Ignition Glow
//   S03B (console_ign):  Inside the Core Reactor Cathedral — 3 Counter-Rotating Gyroscopic Rings + GLSL3 Plasma Core
//   S03C (canopy_zenith): Sweeping Exterior Spiral Around the Cream-White "星航号" Nosecone as 4 Tulip Trusses Bloom Open!
// ============================================================================
export function buildCabinCockpitScene() {
  const scene = new THREE.Scene();
  const rand = mulberry32(3039);

  // Unified Moebius Twilight Plum-Indigo Sky & Starfield (matching S01 / S02 / S04!)
  scene.add(buildStarfield(2800, 460, 3039));

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

  // Unified Moebius Ligne-Claire Palette (Cream-White + Plum-Indigo Shadows + Warm Amber + Slate Blue)
  const hullWhite = createCelMaterial({ color: 0xf4eee0, shadowColor: 0x6a5f8e, ambientBoost: 0.2, patternMode: 2, patternScale: new THREE.Vector2(8, 12), patternStrength: 0.68, rimStrength: 0.45, rimColor: 0xffe4b0 });
  const hullBlue = createCelMaterial({ color: 0x4e6496, shadowColor: 0x29325c, ambientBoost: 0.18, rimStrength: 0.38, rimColor: 0x8ce8ff });
  const trussCream = createCelMaterial({ color: 0xd8d2be, shadowColor: 0x5c557d, ambientBoost: 0.18, rimStrength: 0.38, rimColor: 0xffe4b5 });
  const bellAlloy = createCelMaterial({ color: 0x9aa4bf, shadowColor: 0x3b3d63, ambientBoost: 0.22, patternMode: 2, patternScale: new THREE.Vector2(12, 8), patternStrength: 0.6, rimStrength: 0.55, rimColor: 0xffd275 });
  const amberBandMat = createCelMaterial({ color: 0xe69738, shadowColor: 0x73463d, ambientBoost: 0.18 });
  const cyanGlowMat = createCelMaterial({ color: 0x9cf2ff, emissive: 0x4ddbff, emissiveStrength: 2.0, unlit: true, noInk: true });
  const amberGlowMat = createCelMaterial({ color: 0xffe082, emissive: 0xffa624, emissiveStrength: 2.2, unlit: true, noInk: true });

  // --------------------------------------------------------------------------
  // LAYER 0: S03A ("箭体液压锁臂固定") — Cream-White "星航号" Hull + Hydraulic Clamp Arm Locking In + Cryo Plumes!
  // --------------------------------------------------------------------------
  const clampGroup = new THREE.Group();
  scene.add(clampGroup);

  const clampHull = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 26.0, 36), hullWhite);
  clampHull.position.set(-4.8, 0, -4.0);
  clampGroup.add(clampHull);

  const clampAmber = new THREE.Mesh(new THREE.CylinderGeometry(5.26, 5.26, 1.35, 36), amberBandMat);
  clampAmber.position.set(-4.8, 3.2, -4.0);
  const clampReactor = new THREE.Mesh(new THREE.TorusGeometry(5.28, 0.14, 10, 48), cyanGlowMat);
  clampReactor.rotation.x = Math.PI / 2;
  clampReactor.position.set(-4.8, -2.2, -4.0);
  clampGroup.add(clampAmber, clampReactor);

  for (let i = -3; i <= 3; i++) {
    const seam = new THREE.Mesh(new THREE.TorusGeometry(5.23, 0.045, 8, 48), hullBlue);
    seam.rotation.x = Math.PI / 2;
    seam.position.set(-4.8, i * 2.6, -4.0);
    clampGroup.add(seam);
  }

  const qdSocket = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.7, 16), hullBlue);
  qdSocket.rotation.z = Math.PI / 2;
  qdSocket.position.set(0.55, 0.2, -3.2);
  clampGroup.add(qdSocket);

  const lockHaloMat = createCelMaterial({ color: 0x76eaff, emissive: 0x3ac8ff, emissiveStrength: 1.8, unlit: true, noInk: true });
  const lockHalo = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.06, 10, 32), lockHaloMat);
  lockHalo.rotation.y = Math.PI / 2;
  lockHalo.position.set(0.88, 0.2, -3.2);
  clampGroup.add(lockHalo);

  const qdArmGroup = new THREE.Group();
  const armBeam = new THREE.Mesh(new THREE.BoxGeometry(8.5, 1.15, 1.4), trussCream);
  armBeam.position.set(4.8, 0.2, -3.2);
  const armHead = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.88, 1.2, 16), bellAlloy);
  armHead.rotation.z = Math.PI / 2;
  armHead.position.set(0.95, 0.2, -3.2);
  const cryoPipeTop = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 8.2, 12), bellAlloy);
  cryoPipeTop.rotation.z = Math.PI / 2;
  cryoPipeTop.position.set(4.8, 1.05, -3.2);
  const cryoPipeBot = cryoPipeTop.clone();
  cryoPipeBot.position.y = -0.65;
  qdArmGroup.add(armBeam, armHead, cryoPipeTop, cryoPipeBot);
  clampGroup.add(qdArmGroup);

  const clampMistMats = [];
  for (let i = 0; i < 10; i++) {
    const mMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: QUAD_VERT,
      fragmentShader: CRYO_STORM_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uSeed: { value: i * 1.61 }, uOpacity: { value: 0.44 }, uWarmMix: { value: 0.0 } }
    });
    clampMistMats.push(mMat);
    const mp = new THREE.Mesh(new THREE.PlaneGeometry(5.5 + (i % 3) * 2.2, 7.5 + (i % 2) * 3.0), mMat);
    mp.position.set(-0.2 + (rand() - 0.5) * 4.5, -2.5 + (i - 4.5) * 1.4, -1.6 - (i % 3) * 1.1);
    clampGroup.add(mp);
  }

  // --------------------------------------------------------------------------
  // LAYER A: S03B ("引擎集群低温预冷") — Heroic Low-Angle Macro Under 19 Sculpted Engine Bells!
  // --------------------------------------------------------------------------
  const s03aGroup = new THREE.Group();
  scene.add(s03aGroup);

  // Massive circular launch mount thrust-plate overhead
  const thrustPlate = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 8.8, 1.4, 36), hullBlue);
  thrustPlate.position.y = 4.2;
  s03aGroup.add(thrustPlate);
  const thrustSkirt = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 4.5, 36), hullWhite);
  thrustSkirt.position.y = 6.8;
  s03aGroup.add(thrustSkirt);

  // 19 Sculpted Parabolic Engine Bells (12 outer + 6 inner + 1 center) + Glowing Inner Throat Coils!
  const bellGeo = createEngineBellGeometry(0.92);
  const throatGeo = new THREE.CircleGeometry(0.76, 20);
  throatGeo.rotateX(Math.PI / 2);
  const throatMats = [];

  const bellPositions = [[0, 0]];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    bellPositions.push([Math.cos(a) * 2.55, Math.sin(a) * 2.55]);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.15;
    bellPositions.push([Math.cos(a) * 5.25, Math.sin(a) * 5.25]);
  }

  bellPositions.forEach(([bx, bz], idx) => {
    const bell = new THREE.Mesh(bellGeo, bellAlloy);
    bell.position.set(bx, 2.5, bz);
    s03aGroup.add(bell);

    // Cooling manifold ring around each bell
    const mRing = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.055, 8, 24), amberBandMat);
    mRing.rotation.x = Math.PI / 2;
    mRing.position.set(bx, 2.05, bz);
    s03aGroup.add(mRing);

    // Inner throat pre-ignition glow disc (shifts sequentially ice-cyan -> blazing amber!)
    const tMat = createCelMaterial({
      color: 0x8ceeff,
      emissive: 0x3ec8ff,
      emissiveStrength: 1.2,
      unlit: true,
      noInk: true,
      side: THREE.DoubleSide
    });
    throatMats.push({ mat: tMat, idx });
    const throat = new THREE.Mesh(throatGeo, tMat);
    throat.position.set(bx, 1.82, bz);
    s03aGroup.add(throat);
  });

  // 14 Swirling GLSL3 Cryogenic Frost Plumes pouring downward from the engine cluster!
  const s03aMistMats = [];
  for (let i = 0; i < 14; i++) {
    const mMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: QUAD_VERT,
      fragmentShader: CRYO_STORM_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uSeed: { value: i * 1.43 }, uOpacity: { value: 0.44 }, uWarmMix: { value: 0.0 } }
    });
    s03aMistMats.push(mMat);
    const mp = new THREE.Mesh(new THREE.PlaneGeometry(7.2 + (i % 3) * 2.5, 8.5 + (i % 2) * 3.0), mMat);
    const a = (i / 14) * Math.PI * 2;
    mp.position.set(Math.cos(a) * (2.5 + (i % 4) * 1.6), -1.8 + (i % 3) * 1.2, Math.sin(a) * (2.5 + (i % 3) * 1.5));
    s03aGroup.add(mp);
  }

  // --------------------------------------------------------------------------
  // LAYER B: S02C ("发射台火花预点火") — Authentic Rocket Pre-Ignition!
  // Launch Mount Hold-Down Base + 4 ROFI Sparkler Igniters Shooting 140 Sparks + GLSL3 Methalox Pre-Ignition Flames + Fiery Steam!
  // --------------------------------------------------------------------------
  const s03bGroup = new THREE.Group();
  scene.add(s03bGroup);

  // Heavy concrete launch mount deck & flame trench below the rocket base
  const padDeck = new THREE.Mesh(new THREE.BoxGeometry(28, 1.6, 18), trussCream);
  padDeck.position.set(0, -4.6, -2.0);
  s03bGroup.add(padDeck);

  // Lower skirt of Cream-White "星航号" hovering right over the launch mount + 7 visible parabolic engine bells!
  const preSkirt = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.8, 7.5, 32), hullWhite);
  preSkirt.position.set(0, 6.2, -2.0);
  const preRing = new THREE.Mesh(new THREE.CylinderGeometry(5.85, 5.85, 0.9, 32), hullBlue);
  preRing.position.set(0, 2.8, -2.0);
  s03bGroup.add(preSkirt, preRing);

  // 7 Hero Parabolic Engine Bells + GLSL3 Pre-Ignition Methalox Flame Tongues!
  const preFlameMats = [];
  const preBellX = [-3.4, -1.8, 0.0, 1.8, 3.4, -2.6, 2.6];
  const preBellZ = [-1.4, -0.4, -0.1, -0.4, -1.4, -3.2, -3.2];
  for (let i = 0; i < 7; i++) {
    const bell = new THREE.Mesh(bellGeo, bellAlloy);
    bell.position.set(preBellX[i], 1.35, preBellZ[i]);
    s03bGroup.add(bell);

    const fMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: QUAD_VERT,
      fragmentShader: PREIGN_FLAME_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uIgnition: { value: 0 }, uSeed: { value: i * 1.9 } }
    });
    preFlameMats.push(fMat);
    const flame = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 6.2), fMat);
    flame.position.set(preBellX[i], -2.2, preBellZ[i]);
    s03bGroup.add(flame);
  }

  // 4 ROFI Sparkler Igniter Posts on Left & Right of the Pad shooting 140 blazing sparks under the engine bells!
  const rofiPosts = [[-6.8, -0.8, 1], [-6.2, -3.0, 1], [6.8, -0.8, -1], [6.2, -3.0, -1]];
  rofiPosts.forEach(([rx, rz]) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 3.4, 10), hullBlue);
    post.position.set(rx, -2.2, rz);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), amberGlowMat);
    tip.position.set(rx, -0.5, rz);
    s03bGroup.add(post, tip);
  });

  const sparkGeo = new THREE.OctahedronGeometry(0.11, 0);
  const sparkMat = createCelMaterial({ color: 0xfff3c4, emissive: 0xffa824, emissiveStrength: 3.4, unlit: true, noInk: true });
  const preSparks = [];
  for (let i = 0; i < 140; i++) {
    const post = rofiPosts[i % 4];
    const m = new THREE.Mesh(sparkGeo, sparkMat);
    s03bGroup.add(m);
    preSparks.push({
      mesh: m,
      ox: post[0],
      oy: -0.5,
      oz: post[2] !== undefined ? post[1] : -1.5,
      dirX: post[2],
      vx: post[2] * (6.5 + rand() * 8.5),
      vy: 1.5 + rand() * 4.5,
      vz: (rand() - 0.5) * 3.5,
      phase: rand()
    });
  }

  // 10 Fiery Backlit Flame-Trench Steam Clouds boiling underneath the igniting bells!
  const preSteamMats = [];
  for (let i = 0; i < 10; i++) {
    const smMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: QUAD_VERT,
      fragmentShader: CRYO_STORM_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uSeed: { value: i * 1.85 }, uOpacity: { value: 0.45 }, uWarmMix: { value: 0.0 } }
    });
    preSteamMats.push(smMat);
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(8.5 + (i % 3) * 2.4, 6.2 + (i % 2) * 2.2), smMat);
    sp.position.set((i - 4.5) * 2.4, -3.2 + (i % 3) * 0.9, -0.6 - (i % 3) * 1.4);
    s03bGroup.add(sp);
  }

  // --------------------------------------------------------------------------
  // LAYER C: S03A -> S03B -> S03C (10.3s UNBROKEN ONE-TAKE!)
  // Full-Height Cream-White "星航号运载箭" (1:1 match to S01 & S04!) + 4 Strap-On Boosters + 4 Articulated Tulip Trusses!
  // Camera glides continuously from the BOTTOM launch pad looking UP (S03A) -> spirals up to the NOSECONE (S03B) ->
  // pulls out as the 4 Tulip Trusses BLOOM OPEN (S03C, 0 -> -0.45 rad) seamlessly into S04 (-0.45 -> -0.72 rad)!
  // --------------------------------------------------------------------------
  const s03cGroup = new THREE.Group();
  scene.add(s03cGroup);

  // Launchpad concrete base deck
  const s03PadBase = new THREE.Mesh(new THREE.BoxGeometry(36, 3.0, 30), trussCream);
  s03PadBase.position.y = -13.5;
  s03cGroup.add(s03PadBase);

  // Full-height Cream-White "星航号运载箭" core (exact 2x scale of launchpadScene.js: FLUSH cone-to-cylinder joint at y = +25.0!)
  const upperCore = new THREE.Mesh(new THREE.CylinderGeometry(2.30, 2.64, 37.0, 32), hullWhite);
  upperCore.position.y = 6.5; // Bottom at y=-12.0, EXACT top at y=+25.0 (radius 2.30)
  const upperBand = new THREE.Mesh(new THREE.CylinderGeometry(2.38, 2.38, 2.4, 32), amberBandMat);
  upperBand.position.y = 20.5;
  const upperRing = new THREE.Mesh(new THREE.TorusGeometry(2.46, 0.22, 10, 48), cyanGlowMat);
  upperRing.rotation.x = Math.PI / 2;
  upperRing.position.y = 15.2;
  const upperNose = new THREE.Mesh(new THREE.ConeGeometry(2.30, 11.6, 32), hullWhite);
  upperNose.position.y = 30.8; // Base EXACTLY flush at y=+25.0 (radius 2.30), tip at y=+36.6!
  const noseNeedle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 3.6, 10), amberBandMat);
  noseNeedle.position.y = 38.4;
  s03cGroup.add(upperCore, upperBand, upperRing, upperNose, noseNeedle);

  // 4 Tapered Soyuz-Style Strap-On Boosters (exact 2x proportions of launchpadScene.js!)
  for (let i = 0; i < 4; i++) {
    const bWrap = new THREE.Group();
    bWrap.rotation.y = (i * Math.PI) / 2 + Math.PI / 4;
    s03cGroup.add(bWrap);
    const booster = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44, 2.88, 27.6, 20),
      i % 2 === 0 ? hullWhite : hullBlue
    );
    booster.position.set(3.9, 2.2, 0);
    booster.rotation.z = 0.088;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.8, 0.28), amberBandMat);
    fin.position.set(6.1, -9.3, 0);
    bWrap.add(booster, fin);
  }

  // 4 Full-Height Articulated Cream-Stone Tulip Service Trusses (exact 2x proportions of launchpadScene.js, ZERO hull clipping!)
  const s03cTrusses = [];
  for (let idx = 0; idx < 4; idx++) {
    const baseRot = new THREE.Group();
    baseRot.rotation.y = (idx * Math.PI) / 2 + Math.PI / 4;
    s03cGroup.add(baseRot);

    const pivot = new THREE.Group();
    pivot.position.set(9.6, -12.0, 0);
    baseRot.add(pivot);

    const boomLen = 36.0;
    [-0.85, 0.85].forEach((bz) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.44, boomLen, 0.44), trussCream);
      c.position.set(-0.6, boomLen * 0.5, bz);
      c.rotation.z = 0.14;
      pivot.add(c);
    });
    for (let k = 1; k <= 9; k++) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.24, 1.8), trussCream);
      rung.position.set(-0.6 - k * 0.50, k * 3.6, 0);
      pivot.add(rung);
    }
    const collar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 2.8), hullBlue);
    collar.position.set(-5.6, boomLen - 1.4, 0); // Cleanly outside hull at r=4.0 -> ZERO clipping!
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), amberGlowMat);
    beacon.position.set(-5.6, boomLen + 0.3, 0);
    pivot.add(collar, beacon);
    s03cTrusses.push(pivot);
  }

  // 10 Drifting Cryogenic Vapor Clouds around the launchpad base & mid-body
  const s03cMistMats = [];
  for (let i = 0; i < 10; i++) {
    const mMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: QUAD_VERT,
      fragmentShader: CRYO_STORM_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uSeed: { value: i * 1.9 }, uOpacity: { value: 0.38 }, uWarmMix: { value: 0.0 } }
    });
    s03cMistMats.push(mMat);
    const mp = new THREE.Mesh(new THREE.PlaneGeometry(13, 9), mMat);
    const a = (i / 10) * Math.PI * 2;
    mp.position.set(Math.cos(a) * (7.5 + (i % 3) * 2.5), -9.0 + (i % 4) * 5.2, Math.sin(a) * (7.5 + (i % 3) * 2.5));
    s03cGroup.add(mp);
  }

  const darkC = new THREE.Color(0x0a0d1a);
  const blueC = new THREE.Color(0x2898ff);
  const goldC = new THREE.Color(0xffc94d);
  const darkE = new THREE.Color(0x000000);
  const blueE = new THREE.Color(0x1e88ff);
  const goldE = new THREE.Color(0xffa624);
  const cyanC = blueC;
  const cyanE = blueE;

  return {
    scene,
    update(submode, u, time, camera, audio) {
      const bass = audio ? audio.bass : 0;
      const isClamp = submode === "clamp_lock";
      const isA = submode === "pilot_lock";
      const isB = submode === "console_ign";
      const isS03Bottom = submode === "s03_bottom";
      const isS03Top = submode === "s03_top";
      const isS03Bloom = submode === "s03_bloom" || submode === "canopy_zenith";
      const isOneTakeS03 = isS03Bottom || isS03Top || isS03Bloom;

      clampGroup.visible = isClamp;
      s03aGroup.visible = isA;
      s03bGroup.visible = isB;
      s03cGroup.visible = isOneTakeS03;

      // --------------------------------------------------------------------
      // S03A: Cream-White "星航号" Hull + Hydraulic Clamp Arm Locking In + Cryo Plumes!
      // --------------------------------------------------------------------
      if (isClamp) {
        const localT = u * 4.0;
        const lockT = smoothstep(0.08, 0.58, u);
        qdArmGroup.position.x = (1.0 - lockT) * 2.4;

        const isLocked = smoothstep(0.55, 0.72, u);
        lockHaloMat.uniforms.uColor.value.copy(cyanC).lerp(goldC, isLocked);
        lockHaloMat.uniforms.uEmissive.value.copy(cyanE).lerp(goldE, isLocked);
        lockHaloMat.uniforms.uEmissiveStrength.value = 1.6 + isLocked * 1.4 + bass * 0.4;

        clampMistMats.forEach((mm) => { mm.uniforms.uTime.value = localT; });

        const jolt = Math.exp(-Math.pow((u - 0.58) * 18.0, 2.0)) * 0.14;
        camera.fov = 38 - u * 3.0;
        camera.position.set(1.8 - u * 1.2 + Math.sin(localT * 40) * jolt, -1.2 + u * 2.4, 7.6 - u * 1.8);
        camera.lookAt(-0.8, 0.2, -3.4);
        camera.updateProjectionMatrix();
        return { sunDir: new THREE.Vector3(0.65, 0.55, 0.5), clearColor: 0x080a1c, shadowBounds: null };
      }

      // --------------------------------------------------------------------
      // S02C (pilot_lock): Moody Pre-Heat Under 19 Sculpted Engine Bells: Dark (黑) -> Blue (蓝) -> Golden-Yellow (黄)!
      // --------------------------------------------------------------------
      if (isA) {
        const localT = u * 3.4;
        const bluePhase = smoothstep(0.08, 0.48, u);
        const yellowPhase = smoothstep(0.50, 0.96, u);

        throatMats.forEach(({ mat, idx }) => {
          const bLit = smoothstep(0.06 + idx * 0.016, 0.28 + idx * 0.016, u);
          const yLit = smoothstep(0.48 + idx * 0.018, 0.80 + idx * 0.018, u);
          mat.uniforms.uColor.value.copy(darkC).lerp(blueC, bLit).lerp(goldC, yLit);
          mat.uniforms.uEmissive.value.copy(darkE).lerp(blueE, bLit).lerp(goldE, yLit);
          mat.uniforms.uEmissiveStrength.value = bLit * 1.15 + yLit * 0.85 + bass * 0.25 * bLit;
        });

        // Subtle dark-space cryogenic mist (NO additive white-out!)
        s03aMistMats.forEach((mm) => {
          mm.uniforms.uTime.value = localT;
          mm.uniforms.uOpacity.value = 0.08 + bluePhase * 0.05 + yellowPhase * 0.04;
          mm.uniforms.uWarmMix.value = yellowPhase;
        });

        const ang = -0.55 + u * 1.1;
        camera.fov = 44 - u * 4.0;
        camera.position.set(Math.sin(ang) * 9.8, -3.2 + u * 1.4, Math.cos(ang) * 9.8);
        camera.lookAt(0, 2.4, 0);
        camera.updateProjectionMatrix();
        return { sunDir: new THREE.Vector3(0.4, 0.45, 0.5), clearColor: 0x050610, shadowBounds: null };
      }

      // --------------------------------------------------------------------
      // S02C ("发射台火花预点火"): ROFI Sparklers Fire -> Methalox Pre-Ignition Flames Whoosh Out of Engine Bells!
      // --------------------------------------------------------------------
      if (isB) {
        const localT = u * 3.4;
        // Phase 1 (u = 0.05..0.55): ROFI Sparklers spray 140 golden sparks inward under the engine bells!
        const sparkVis = smoothstep(0.02, 0.14, u);
        preSparks.forEach((sp) => {
          sp.mesh.visible = sparkVis > 0.01;
          if (sp.mesh.visible) {
            const age = (localT * 1.15 + sp.phase) % 1.0;
            sp.mesh.position.set(
              sp.ox + sp.vx * age,
              sp.oy + sp.vy * age - 4.8 * age * age,
              sp.oz + sp.vz * age
            );
            sp.mesh.scale.setScalar((1.0 - age * 0.7) * (0.85 + bass * 0.4));
          }
        });

        // Phase 2 (u = 0.28..1.00): Methalox Pre-Ignition Flames WHOOSH out of all 7 hero bells!
        const ignT = smoothstep(0.26, 0.72, u);
        preFlameMats.forEach((fm, idx) => {
          const stagger = smoothstep(0.24 + (idx % 3) * 0.07, 0.62 + (idx % 3) * 0.07, u);
          fm.uniforms.uTime.value = localT;
          fm.uniforms.uIgnition.value = stagger * (0.92 + bass * 0.3);
        });

        preSteamMats.forEach((sm) => {
          sm.uniforms.uTime.value = localT;
          sm.uniforms.uWarmMix.value = ignT;
          sm.uniforms.uOpacity.value = 0.35 + ignT * 0.32;
        });

        // Raw acoustic micro-rumble as pre-ignition roars!
        const rumble = ignT * (0.08 + bass * 0.12);
        camera.fov = 42 - u * 3.0;
        camera.position.set(
          -1.8 + u * 3.6 + Math.sin(localT * 46) * rumble,
          -1.8 + u * 0.9 + Math.cos(localT * 52) * rumble,
          10.8 - u * 2.2
        );
        camera.lookAt(0, -0.6, -1.6);
        camera.updateProjectionMatrix();
        return { sunDir: new THREE.Vector3(0.3, 0.5, 0.8), clearColor: 0x100b1e, shadowBounds: null };
      }

      // --------------------------------------------------------------------
      // S03A -> S03B -> S03C (10.3s UNBROKEN ONE-TAKE!):
      // Single monotonic progress p in [0, 1] across all 3 beats:
      //   p = 0.00..0.33 (S03A): Starts at the very BOTTOM of the rocket looking UPWARD, gliding up the boosters!
      //   p = 0.33..0.66 (S03B): Continues smoothly spiraling UP to the gleaming pointed NOSECONE!
      //   p = 0.66..1.00 (S03C): Pulls gracefully back as all 4 Tulip Trusses BLOOM OPEN (0 -> -0.45) right into S04!
      // --------------------------------------------------------------------
      const p = isS03Bottom
        ? (u * 3.4) / 10.3
        : isS03Top
          ? (3.4 + u * 3.4) / 10.3
          : (6.8 + u * 3.5) / 10.3;
      const localT = p * 10.3;

      // 4 Tulip Service Trusses stay clamped (0) through S03A & S03B, then bloom smoothly outward (0 -> -0.45) in S03C!
      const bloom = smoothstep(0.66, 0.99, p);
      s03cTrusses.forEach((pivot) => {
        pivot.rotation.z = -bloom * 0.45; // Matches S04 start angle (-0.45) 1:1!
      });
      s03cMistMats.forEach((mm) => {
        mm.uniforms.uTime.value = localT;
        mm.uniforms.uWarmMix.value = 0.35 * (1.0 - smoothstep(0.0, 0.35, p));
      });

      // Continuous Unbroken 10.3s One-Take Camera Curve:
      // Angle sweeps smoothly around the rocket (-1.2 -> +1.6 rad);
      // Height climbs smoothly from base (-10.5) -> nosecone zenith (+25.0) -> majestic mid-upper vantage (+17.0);
      // Radius pulls out gracefully (13.5 -> 16.5 -> 25.0) to frame all 4 blooming tulip trusses!
      const orbAng = -1.2 + p * 2.8;
      const riseT = smoothstep(0.0, 0.68, p);
      const pullT = smoothstep(0.62, 1.0, p);
      const camY = THREE.MathUtils.lerp(-10.0, 36.5, riseT) - pullT * 8.0;
      const camR = 16.5 + riseT * 4.5 + pullT * 12.0;
      const lookY = THREE.MathUtils.lerp(8.0, 27.5, riseT) - pullT * 7.5;

      camera.fov = 46 - riseT * 6.0 + pullT * 4.0;
      camera.position.set(Math.sin(orbAng) * camR, camY, Math.cos(orbAng) * camR);
      camera.lookAt(0, lookY, 0);
      camera.updateProjectionMatrix();
      return { sunDir: new THREE.Vector3(-0.6, 0.5, 0.6), clearColor: 0x080a1c, shadowBounds: null };
    }
  };
}
