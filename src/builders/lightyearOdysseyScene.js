import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { clamp, mulberry32, smoothstep } from "../core/math.js";
import {
  buildStarfield,
  buildStarArkShip,
  buildCelEarth,
  createMarsGlobeTexture,
  createJupiterTexture
} from "./cosmicPrimitives.js";

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

// Pinpoint-of-Light Starship Flare (crisp light-year scale)
const PINPOINT_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormalId;
uniform float uIntensity;
in vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float core = exp(-r * 10.0);
  float halo = exp(-r * 3.2) * 0.4;
  float spikeH = exp(-abs(p.y) * 36.0) * exp(-abs(p.x) * 3.5);
  float spikeV = exp(-abs(p.x) * 36.0) * exp(-abs(p.y) * 3.5);
  vec3 col = vec3(1.0, 0.96, 0.84) * (core * 2.2 + (spikeH + spikeV) * 1.05) + vec3(1.0, 0.78, 0.35) * halo;
  float a = clamp((core + halo + (spikeH + spikeV) * 0.85) * smoothstep(1.0, 0.1, r) * uIntensity, 0.0, 1.0);
  if (a < 0.01) discard;
  gColor = vec4(col, a);
  gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
}
`;

// Unified Milky Way Spiral Galaxy Disk:
// Dark, sleeping indigo-silver during S27 ("星辰流浪") ->
// Ignites in ONE singular radiant golden Supernova Wave during S28A ("点燃这长夜")!
const GALAXY_IGNITE_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormalId;
uniform float uTime;
uniform float uOpacity;
uniform float uIgniteFront;
uniform float uCoreFlash;
in vec2 vUv;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float ang = atan(p.y, p.x);

  float arms = sin(ang * 4.0 - r * 10.5 + uTime * 0.28) * 0.5 + 0.5;
  float fine = sin(ang * 8.0 - r * 16.0 - uTime * 0.18) * 0.5 + 0.5;
  float armMask = pow(arms, 1.85) * 0.76 + pow(fine, 2.5) * 0.24;

  // Radial ignition front sweeps outward ONLY during S28A!
  float lit = smoothstep(uIgniteFront + 0.10, uIgniteFront - 0.14, r) * step(0.005, uIgniteFront);
  float shockRing = exp(-pow((r - uIgniteFront) * 18.0, 2.0)) * smoothstep(0.01, 0.12, uIgniteFront) * smoothstep(1.08, 0.75, uIgniteFront);
  float core = exp(-r * 4.2);

  // Dark sleeping cosmos colors (S27) -> Blazing golden ignited galaxy (S28A)
  vec3 sleepCol = mix(vec3(0.08, 0.14, 0.34), vec3(0.24, 0.44, 0.72), armMask);
  vec3 litCol = mix(vec3(0.95, 0.65, 0.22), vec3(1.0, 0.90, 0.58), armMask);
  vec3 col = mix(sleepCol, litCol, lit);

  // The ONE strong-light climax burst at the galactic core & shockwave front!
  col += vec3(1.0, 0.96, 0.84) * (core * (0.28 + uCoreFlash * 2.4) + shockRing * 2.3);

  float radialFade = smoothstep(1.0, 0.12, r);
  float a = clamp((armMask * (0.38 + lit * 0.46) + core * (0.35 + uCoreFlash * 0.65) + shockRing * 0.95) * radialFade * uOpacity, 0.0, 1.0);
  if (a < 0.01) discard;
  gColor = vec4(col, a);
  gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
}
`;

// GLSL3 Elastic Observable Universe Horizon Membrane that Bulges & Tears Open (S28B One-Take!)
const MEMBRANE_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform float uTime;
uniform float uBulge;
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  vec2 p = uv * 2.0 - 1.0;
  float r = length(p);
  float push = exp(-r * r * 2.8) * uBulge * 7.5;
  float ripple = sin(r * 16.0 - uTime * 6.5) * 0.25 * uBulge * exp(-r * 1.4);
  vec3 displaced = position + vec3(0.0, 0.0, push + ripple);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(displaced, 1.0);
}
`;

const MEMBRANE_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormalId;
uniform float uTime;
uniform float uTear;
uniform float uFade;
in vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float ang = atan(p.y, p.x);
  float edgeNoise = sin(ang * 5.0 + uTime * 2.2) * 0.045 + cos(ang * 9.0 - uTime * 1.7) * 0.025;
  float holeR = uTear * 1.18 + edgeNoise * smoothstep(0.0, 0.25, uTear);
  if (r < holeR - 0.015) discard;
  float lat = abs(sin(r * 22.0 - uTime * 1.2));
  float lon = abs(sin(ang * 12.0));
  float grid = smoothstep(0.92, 0.99, lat) + smoothstep(0.94, 0.995, lon) * 0.65;
  float rimDist = abs(r - holeR);
  float tearRim = exp(-rimDist * 26.0) * smoothstep(0.01, 0.14, uTear);
  float outerFade = smoothstep(1.0, 0.55, r);
  vec3 shellCol = mix(vec3(0.08, 0.16, 0.42), vec3(0.24, 0.56, 0.92), grid);
  shellCol += vec3(1.0, 0.82, 0.42) * tearRim * 2.4 + vec3(0.55, 0.96, 1.0) * tearRim * 1.0;
  float a = clamp((0.34 + grid * 0.52 + tearRim * 1.05) * outerFade * uFade, 0.0, 1.0);
  if (a < 0.01) discard;
  gColor = vec4(shellCol, a);
  gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
}
`;

// High-Res Horizontal "101010101010..." Binary String Texture for S28B Ribbons -> S29 Micro-Light Threads!
function createBinaryLineTexture(seed = 2890) {
  const w = 1024, h = 128;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, w, h);

  const rand = mulberry32(seed);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "500 44px 'SF Mono', 'Menlo', 'Consolas', monospace";

  const count = 32;
  const step = w / count;
  for (let i = 0; i < count; i++) {
    const bit = (i + (rand() > 0.72 ? 1 : 0)) % 2 === 0 ? "1" : "0";
    const x = (i + 0.5) * step;
    if (bit === "1") {
      ctx.shadowColor = "rgba(255, 206, 92, 0.85)";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "rgba(255, 232, 168, 0.96)";
    } else {
      ctx.shadowColor = "rgba(82, 214, 255, 0.75)";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "rgba(138, 232, 255, 0.88)";
    }
    ctx.fillText(bit, x, h * 0.52);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

// GLSL3 Higher-Dimensional Multiverse Aurora Ribbon that Gradually Morphs into "101010101010..." Strings!
const MULTIVERSE_RIBBON_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormalId;
uniform sampler2D uBinTex;
uniform float uTime;
uniform float uSeed;
uniform float uOpacity;
uniform float uBinMorph;
in vec2 vUv;
void main() {
  // Preserve 100% of the organic sinuous neural-filament curvature even after morphing into 101010... strings!
  float wave = sin(vUv.x * 10.0 + uTime * 0.9 + uSeed) * 0.22 +
               cos(vUv.x * 5.0 - uTime * 0.6 + uSeed * 1.7) * 0.15;
  float dy = (vUv.y - 0.5) - wave;
  float d = abs(dy);

  // Pure aurora ribbon (first half of S28B)
  float core = exp(-d * 18.0);
  float glow = exp(-d * 5.0) * 0.45;
  vec3 auroraCol = mix(vec3(0.42, 0.26, 0.88), vec3(0.28, 0.84, 1.0), vUv.x);
  auroraCol = mix(auroraCol, vec3(1.0, 0.86, 0.52), core * 0.72);
  float auroraA = (core + glow);

  // Crisp "101010101010..." binary string flowing along the exact same curve (second half of S28B!)
  vec2 buv = vec2(vUv.x * 3.5 - uTime * (0.14 + fract(uSeed) * 0.08) + uSeed, dy * 3.6 + 0.5);
  vec4 binSample = (buv.y >= 0.0 && buv.y <= 1.0) ? texture(uBinTex, buv) : vec4(0.0);
  float fineLine = exp(-d * 65.0) * 0.35;
  vec3 binCol = binSample.rgb * 1.15 + vec3(0.85, 0.78, 0.55) * fineLine;
  float binA = max(binSample.a, fineLine);

  float endFade = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
  vec3 col = mix(auroraCol * (0.9 + core * 0.5), binCol, uBinMorph);
  float a = mix(auroraA, binA, uBinMorph) * endFade * uOpacity;
  if (a < 0.01) discard;
  gColor = vec4(col, a);
  gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
}
`;

function buildRenCharacterCurves() {
  const apex = new THREE.Vector3(-7.4, 0.0, -8.0);
  const splitPt = new THREE.Vector3(-2.6, 0.0, -8.1);

  const downCurve = new THREE.CatmullRomCurve3([
    apex.clone(),
    new THREE.Vector3(-5.0, 0.0, -8.05),
    splitPt.clone(),
    new THREE.Vector3(1.4, -2.0, -8.25),
    new THREE.Vector3(5.8, -5.8, -8.55),
    new THREE.Vector3(10.4, -10.8, -8.9)
  ]);

  const upCurve = new THREE.CatmullRomCurve3([
    apex.clone(),
    new THREE.Vector3(-5.0, 0.0, -8.05),
    splitPt.clone(),
    new THREE.Vector3(1.4, 2.0, -8.25),
    new THREE.Vector3(5.8, 5.8, -8.55),
    new THREE.Vector3(10.6, 11.2, -8.9)
  ]);

  return { downCurve, upCurve, splitPt };
}

function makeEscortDart(steelMat, glowMat) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.ConeGeometry(0.32, 2.1, 4), steelMat);
  hull.rotation.x = Math.PI / 2;
  hull.rotation.z = Math.PI / 4;
  hull.scale.set(1.35, 1.0, 0.42);
  g.add(hull);
  const eng = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.7, 8, 1, true), glowMat);
  eng.rotation.x = -Math.PI / 2;
  eng.position.z = -1.75;
  g.add(eng);
  return g;
}

// ============================================================================
// UNIFIED ONE-TAKE ODYSSEY: S26B (lightyear) -> S27 (voyage) -> S28A (ignite)
// Zero cuts, zero starfield jumps, and ONLY ONE strong-light climax (S28A)!
// ============================================================================
export function buildLightyearOdysseyScene() {
  const scene = new THREE.Scene();
  const rand = mulberry32(27289);

  // One continuous 3800-star deep cosmos shared seamlessly across S26B -> S27 -> S28A -> S28B
  scene.add(buildStarfield(3800, 620, 27289));

  // --------------------------------------------------------------------------
  // ZONE 1 (z ~ -8): S26B Solar System + Carved Calligraphic 「人」
  // --------------------------------------------------------------------------
  const renZone = new THREE.Group();
  scene.add(renZone);

  const solarAnchor = new THREE.Group();
  solarAnchor.position.set(-10.5, 0.0, -7.8);
  renZone.add(solarAnchor);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(1.05, 32, 24),
    createCelMaterial({ color: 0xfff8dc, emissive: 0xffd56b, emissiveStrength: 1.5, unlit: true, noInk: true })
  );
  sun.position.set(-3.2, 0.8, 0.0);
  solarAnchor.add(sun);

  // Complete 360-degree planetary orbits (with stored materials so they dissolve smoothly at S26B end!)
  const orbitMats = [];
  [2.2, 3.8, 5.6, 7.6].forEach((r, idx) => {
    const curve = new THREE.EllipseCurve(-3.2, 0.8, r, r * 0.88, 0, Math.PI * 2, false, 0);
    const pts = curve.getPoints(120).map((p) => new THREE.Vector3(p.x, p.y, 0.0));
    const oMat = createCelMaterial({
      color: idx === 1 ? 0x6ce3ff : idx === 2 ? 0xe07b5e : 0xd9b377,
      emissive: idx === 1 ? 0x3ec5ff : 0xc48b44,
      emissiveStrength: 0.4,
      unlit: true,
      noInk: true,
      transparent: true,
      opacity: 0.62
    });
    orbitMats.push(oMat);
    solarAnchor.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 120, 0.02, 6, true), oMat));
  });

  const earth = buildCelEarth(0.46, { glowColor: 0x5dbdff, atmoIntensity: 1.35 });
  earth.position.set(-1.1, 0.55, 0.05);
  solarAnchor.add(earth);

  const mars = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 28, 20),
    createCelMaterial({ color: 0xffffff, shadowColor: 0x4c3759, map: createMarsGlobeTexture(), colorEdges: true })
  );
  mars.position.set(0.65, -0.35, 0.08);
  solarAnchor.add(mars);

  const jupiter = new THREE.Mesh(
    new THREE.SphereGeometry(0.82, 32, 24),
    createCelMaterial({ color: 0xffffff, shadowColor: 0x524675, map: createJupiterTexture(), colorEdges: true, rimStrength: 0.25 })
  );
  jupiter.position.set(2.45, 0.35, 0.0);
  solarAnchor.add(jupiter);

  const renCoreMat = createCelMaterial({
    color: 0xffefbd,
    emissive: 0xffc44d,
    emissiveStrength: 0.52,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 1.0
  });

  const linkNodes = [
    new THREE.Vector3(-11.6, 0.55, -7.75),
    new THREE.Vector3(-9.85, -0.35, -7.72),
    new THREE.Vector3(-8.5, 0.30, -7.85),
    new THREE.Vector3(-7.4, 0.0, -8.0)
  ];
  const launchCurve = new THREE.CatmullRomCurve3(linkNodes);
  const launchGeo = new THREE.TubeGeometry(launchCurve, 72, 0.055, 8, false);
  renZone.add(new THREE.Mesh(launchGeo, renCoreMat));

  const nodeRingMat = createCelMaterial({
    color: 0xffe6a3,
    emissive: 0xffbe42,
    emissiveStrength: 0.45,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.78
  });
  const nodeRings = linkNodes.map((pos, i) => {
    const rm = new THREE.Mesh(new THREE.TorusGeometry(0.52 + i * 0.07, 0.026, 8, 36), nodeRingMat);
    rm.position.copy(pos);
    renZone.add(rm);
    return { mesh: rm, thresh: i / (linkNodes.length - 1) };
  });

  const { downCurve, upCurve, splitPt } = buildRenCharacterCurves();
  const downCoreGeo = new THREE.TubeGeometry(downCurve, 96, 0.12, 10, false);
  const upCoreGeo = new THREE.TubeGeometry(upCurve, 96, 0.12, 10, false);
  renZone.add(new THREE.Mesh(downCoreGeo, renCoreMat), new THREE.Mesh(upCoreGeo, renCoreMat));

  function makePinpointShip() {
    const g = new THREE.Group();
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 12, 10),
      createCelMaterial({ color: 0xffffff, emissive: 0xffe699, emissiveStrength: 1.5, unlit: true, noInk: true })
    );
    const flareMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: QUAD_VERT,
      fragmentShader: PINPOINT_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uIntensity: { value: 0.8 } }
    });
    const flare = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 1.75), flareMat);
    g.add(dot, flare);
    return { group: g, flare, flareMat };
  }
  const pinDown = makePinpointShip();
  const pinUp = makePinpointShip();
  renZone.add(pinDown.group, pinUp.group);

  const splitRingMat = createCelMaterial({
    color: 0xfff0be,
    emissive: 0xffc857,
    emissiveStrength: 0.75,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.0
  });
  const splitRing = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.045, 10, 48), splitRingMat);
  splitRing.position.copy(splitPt);
  renZone.add(splitRing);

  // --------------------------------------------------------------------------
  // ZONE 2 (z: -8 -> -56): S27 Living Consciousness Star-River + Unified StarArk Armada!
  // Emerges DIRECTLY out of the carved golden 「人」 and sails toward the sleeping Spiral Galaxy!
  // --------------------------------------------------------------------------
  const dustGeo = new THREE.OctahedronGeometry(0.14, 0);
  const goldDustMat = createCelMaterial({ color: 0xfff0be, emissive: 0xffc44d, emissiveStrength: 0.9, unlit: true, noInk: true });
  const cyanDustMat = createCelMaterial({ color: 0x9cf2ff, emissive: 0x3ec8ff, emissiveStrength: 0.9, unlit: true, noInk: true });

  // 220 Dissolving-to-Armada Particles:
  // First 160 sit along 「人」 strokes; 60 sit around the Solar System & orbits!
  // At S26B end (u = 0.76..1.00), ALL of them lift off & begin spiraling toward the armada formation;
  // at S27 start (u = 0.00..0.34), they converge directly onto the StarArk & 16 Escort hulls to forge the fleet!
  const riverParticles = [];
  for (let i = 0; i < 220; i++) {
    let bx, by, bz, tVal, isSolar = false;
    if (i < 160) {
      const isDown = i % 2 === 0;
      tVal = rand();
      const basePt = (isDown ? downCurve : upCurve).getPointAt(tVal);
      bx = basePt.x + (rand() - 0.5) * 1.3;
      by = basePt.y + (rand() - 0.5) * 1.3;
      bz = basePt.z + (rand() - 0.5) * 1.1;
    } else {
      isSolar = true;
      tVal = 0.0;
      const ang = rand() * Math.PI * 2;
      const rad = 1.2 + rand() * 6.8;
      bx = -13.7 + Math.cos(ang) * rad;
      by = 0.8 + Math.sin(ang) * rad * 0.88;
      bz = -7.8 + (rand() - 0.5) * 0.8;
    }
    const m = new THREE.Mesh(dustGeo, i % 3 === 0 ? cyanDustMat : goldDustMat);
    m.position.set(bx, by, bz);
    scene.add(m);

    // Assign each particle to either the flagship (0) or one of the 16 escorts (1..16) so they physically forge the ships!
    const shipIdx = i % 17;
    let fx = 0, fy = 0, fz = 0;
    if (shipIdx > 0) {
      const ei = shipIdx - 1;
      const side = ei % 2 === 0 ? -1 : 1;
      const rank = Math.floor(ei / 2) + 1;
      fx = side * (2.2 + rank * 1.05);
      fy = ((ei % 4) - 1.5) * 0.85;
      fz = rank * 1.65;
    }

    riverParticles.push({
      mesh: m,
      isSolar,
      t: tVal,
      bx, by, bz,
      fx, fy, fz,
      swirlR: 2.2 + rand() * 8.5,
      swirlAng: rand() * Math.PI * 2,
      zTravel: 18.0 + rand() * 34.0,
      sc: 0.38 + rand() * 0.82
    });
  }

  // Unified StarArk Flagship + 16 Armada Escorts emerging from 「人」 and sailing into the sleeping galaxy!
  const armadaGroup = new THREE.Group();
  armadaGroup.visible = false;
  scene.add(armadaGroup);

  const steelMat = createCelMaterial({
    color: 0xeef2f8,
    shadowColor: 0x4d5878,
    patternMode: 2,
    patternScale: new THREE.Vector2(8, 14),
    rimStrength: 0.55,
    rimColor: 0xffe494
  });
  const cyanIonMat = createCelMaterial({
    color: 0x8ef4ff,
    emissive: 0x2ed4ff,
    emissiveStrength: 1.5,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const goldIonMat = createCelMaterial({
    color: 0xffe8a3,
    emissive: 0xffb833,
    emissiveStrength: 1.5,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.82,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const flagshipWrap = new THREE.Group();
  const flagship = buildStarArkShip();
  flagship.scale.setScalar(0.75);
  flagship.rotation.y = Math.PI / 2; // +X nose faces -Z toward the galaxy!
  flagshipWrap.add(flagship);

  // Subtle Consciousness Aura Ring around the StarArk ("意识之光" — clean, not blinding!)
  const auraRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.55, 0.08, 10, 48),
    createCelMaterial({ color: 0xfff3cc, emissive: 0xffcc5c, emissiveStrength: 1.6, unlit: true, noInk: true, transparent: true, opacity: 0.75 })
  );
  flagshipWrap.add(auraRing);
  armadaGroup.add(flagshipWrap);

  const escorts = [];
  for (let i = 0; i < 16; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const rank = Math.floor(i / 2) + 1;
    const ship = makeEscortDart(steelMat, i % 3 === 0 ? goldIonMat : cyanIonMat);
    ship.rotation.y = Math.PI; // Nose faces -Z
    const ox = side * (2.2 + rank * 1.05);
    const oy = ((i % 4) - 1.5) * 0.85;
    const oz = rank * 1.65;
    ship.position.set(ox, oy, oz);
    armadaGroup.add(ship);
    escorts.push({ mesh: ship, ox, oy, oz, phase: i * 0.7 });
  }

  // --------------------------------------------------------------------------
  // ZONE 3 (z = -62): Grand 4-Arm Spiral Milky Way
  // Sleeping dark indigo in S27 ("星辰流浪") -> THE ONE STRONG-LIGHT IGNITION in S28A ("点燃这长夜")!
  // --------------------------------------------------------------------------
  const galaxyPivot = new THREE.Group();
  galaxyPivot.position.set(0, 0, -62.0);
  galaxyPivot.rotation.x = 0.62;
  scene.add(galaxyPivot);

  const galaxyMat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: QUAD_VERT,
    fragmentShader: GALAXY_IGNITE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.0 },
      uIgniteFront: { value: 0.0 },
      uCoreFlash: { value: 0.0 }
    }
  });
  const galaxyDisk = new THREE.Mesh(new THREE.PlaneGeometry(54, 54), galaxyMat);
  galaxyDisk.rotation.x = -Math.PI / 2;
  galaxyPivot.add(galaxyDisk);

  // 360 Spiral-Arm Star Clusters: calm silver-blue in S27 -> ignite into radiant golden suns in S28A!
  const starGeo = new THREE.OctahedronGeometry(0.20, 0);
  const sleepStarMat = createCelMaterial({ color: 0x7cb4f5, emissive: 0x3264b8, emissiveStrength: 0.55, unlit: true, noInk: true });
  const litStarMat = createCelMaterial({ color: 0xfff4cc, emissive: 0xffc03d, emissiveStrength: 2.6, unlit: true, noInk: true });
  const galaxyStars = [];
  for (let i = 0; i < 360; i++) {
    const arm = i % 4;
    const t = Math.pow(rand(), 0.72);
    const r = 1.6 + t * 23.0;
    const ang = arm * (Math.PI * 0.5) + r * 0.30 + (rand() - 0.5) * 0.5;
    const m = new THREE.Mesh(starGeo, sleepStarMat);
    m.position.set(Math.cos(ang) * r, (rand() - 0.5) * 0.8, Math.sin(ang) * r);
    const sc = (0.45 + rand() * 1.15) * (1.25 - t * 0.4);
    m.scale.setScalar(sc);
    galaxyPivot.add(m);
    galaxyStars.push({ mesh: m, rNorm: r / 24.5, baseScale: sc });
  }

  // THE ONE AND ONLY Strong-Light Supernova Flash Sphere at the Galactic Core (fires ONLY in S28A!)
  const novaFlashMat = createCelMaterial({
    color: 0xffffff,
    emissive: 0xffe69c,
    emissiveStrength: 4.5,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const novaFlashSphere = new THREE.Mesh(new THREE.SphereGeometry(2.6, 24, 18), novaFlashMat);
  galaxyPivot.add(novaFlashSphere);

  // --------------------------------------------------------------------------
  // ZONE 4 (z = -78 -> -135): S28B Observable Universe Membrane Tear -> Multiverse Ocean!
  // Positioned directly beyond the ignited Milky Way so S28A flows 100% ONE-TAKE into S28B!
  // --------------------------------------------------------------------------
  const horizonGroup = new THREE.Group();
  horizonGroup.position.set(0, 0, -78.0);
  horizonGroup.visible = false;
  scene.add(horizonGroup);

  const membraneMat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: MEMBRANE_VERT,
    fragmentShader: MEMBRANE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uBulge: { value: 0 },
      uTear: { value: 0 },
      uFade: { value: 1.0 }
    }
  });
  const membraneMesh = new THREE.Mesh(new THREE.PlaneGeometry(54, 54, 64, 64), membraneMat);
  horizonGroup.add(membraneMesh);

  const binLineTex = createBinaryLineTexture(2890);
  const multiRibbons = [];
  for (let i = 0; i < 16; i++) {
    const rMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: QUAD_VERT,
      fragmentShader: MULTIVERSE_RIBBON_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uBinTex: { value: binLineTex },
        uTime: { value: 0 },
        uSeed: { value: i * 1.37 },
        uOpacity: { value: 0.0 },
        uBinMorph: { value: 0.0 }
      }
    });
    const rib = new THREE.Mesh(new THREE.PlaneGeometry(66, 11), rMat);
    const ang = (i / 16) * Math.PI * 2;
    rib.position.set(
      Math.cos(ang) * (6.5 + (i % 4) * 3.8),
      Math.sin(ang) * (4.8 + (i % 3) * 3.2),
      -20.0 - i * 3.4
    );
    rib.rotation.z = ang * 0.45 + (i % 2 === 0 ? 0.28 : -0.28);
    rib.rotation.y = (((i * 31) % 100) / 100 - 0.5) * 0.36;
    horizonGroup.add(rib);
    multiRibbons.push({ mesh: rib, mat: rMat });
  }

  const bubbleMatA = createCelMaterial({
    color: 0x9cf2ff,
    emissive: 0x3ec8ff,
    emissiveStrength: 1.0,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.48,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const bubbleMatB = createCelMaterial({
    color: 0xffe49c,
    emissive: 0xffb83d,
    emissiveStrength: 1.1,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.48,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const universeBubbles = [];
  for (let i = 0; i < 14; i++) {
    const rad = 1.2 + rand() * 3.2;
    const grp = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(rad * 0.35, 16, 12), i % 2 === 0 ? bubbleMatB : bubbleMatA);
    const shell = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.06, 10, 48), i % 2 === 0 ? bubbleMatA : bubbleMatB);
    const shell2 = new THREE.Mesh(new THREE.TorusGeometry(rad * 0.82, 0.04, 8, 42), i % 2 === 0 ? bubbleMatB : bubbleMatA);
    shell2.rotation.x = Math.PI * 0.42;
    grp.add(core, shell, shell2);
    const a = (i / 14) * Math.PI * 2 + 0.3;
    const dist = 8.5 + rand() * 14.0;
    grp.position.set(Math.cos(a) * dist, Math.sin(a) * dist * 0.7, -20.0 - rand() * 32.0);
    horizonGroup.add(grp);
    universeBubbles.push({ group: grp, shell, shell2, spd: 0.3 + rand() * 0.5 });
  }

  const tearWaveMat = createCelMaterial({
    color: 0xfff4d4,
    emissive: 0xffcc5c,
    emissiveStrength: 2.2,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const tearWaveRing = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.14, 10, 64), tearWaveMat);
  horizonGroup.add(tearWaveRing);

  const bridgeSpark = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.30, 0),
    createCelMaterial({ color: 0xfff8dc, emissive: 0xffd066, emissiveStrength: 2.0, unlit: true, noInk: true })
  );
  bridgeSpark.visible = false;
  horizonGroup.add(bridgeSpark);

  const tmpPt = new THREE.Vector3();

  return {
    scene,
    update(submode, u, time, camera, audio) {
      const bass = audio ? audio.bass : 0;
      const isLightyear = submode === "lightyear";
      const isVoyage = submode === "voyage";
      const isIgnite = submode === "ignite";
      const isHorizon = submode === "horizon_break";

      // Continuous monotonic clock across all 30.6 seconds (S26B -> S27 -> S28A -> S28B)!
      const seqT =
        isLightyear ? u * 9.1 :
        isVoyage ? 9.1 + u * 8.6 :
        isIgnite ? 17.7 + u * 5.1 :
        22.8 + u * 7.8;

      earth.userData.globe.rotation.y = 1.4 + seqT * 0.16;
      mars.rotation.y = 0.5 + seqT * 0.14;
      jupiter.rotation.y = -0.35 + seqT * 0.09;
      galaxyPivot.rotation.y = seqT * 0.12;
      galaxyMat.uniforms.uTime.value = seqT;

      // ====================================================================
      // ACT 1: S26B ("将人类的名字 · 刻在光年") — Crisp, Zero Strong Light!
      // ====================================================================
      if (isLightyear) {
        renZone.visible = true;
        armadaGroup.visible = false;
        novaFlashSphere.visible = false;
        horizonGroup.visible = false;

        // Sleeping galaxy stays faint in far background
        galaxyPivot.visible = true;
        galaxyMat.uniforms.uOpacity.value = 0.22;
        galaxyMat.uniforms.uIgniteFront.value = 0.0;
        galaxyMat.uniforms.uCoreFlash.value = 0.0;

        // Gradual disintegration at the end of S26B (u = 0.74..1.00):
        // Solar System, orbits, AND 「人」 strokes gently dissolve bit-by-bit into converging stardust that forges the Armada!
        const dissolveS26 = smoothstep(0.74, 1.00, u);
        renCoreMat.uniforms.uOpacity.value = 1.0 - dissolveS26 * 0.58;
        nodeRingMat.uniforms.uOpacity.value = 0.78 * (1.0 - dissolveS26 * 0.75);
        orbitMats.forEach((om) => { om.uniforms.uOpacity.value = 0.62 * (1.0 - dissolveS26 * 0.82); });
        const solarScale = 1.0 - dissolveS26 * 0.62;
        solarAnchor.scale.setScalar(Math.max(0.05, solarScale));

        const launchProg = clamp(u / 0.18, 0, 1);
        const lCount = launchGeo.index ? launchGeo.index.count : 0;
        launchGeo.setDrawRange(0, Math.floor((lCount * launchProg) / 3) * 3);

        nodeRings.forEach((nr) => {
          nr.mesh.visible = launchProg >= nr.thresh - 0.02;
        });

        const splitProg = clamp((u - 0.18) / 0.82, 0, 1);
        const dTotal = downCoreGeo.index ? downCoreGeo.index.count : 0;
        const uTotal = upCoreGeo.index ? upCoreGeo.index.count : 0;
        downCoreGeo.setDrawRange(0, Math.floor((dTotal * splitProg) / 3) * 3);
        upCoreGeo.setDrawRange(0, Math.floor((uTotal * splitProg) / 3) * 3);

        if (splitProg > 0.001) {
          pinDown.group.visible = dissolveS26 < 0.85;
          downCurve.getPointAt(splitProg, tmpPt);
          pinDown.group.position.copy(tmpPt);
          pinDown.flareMat.uniforms.uIntensity.value = 0.8 * (1.0 - dissolveS26);
          pinUp.group.visible = dissolveS26 < 0.85;
          upCurve.getPointAt(splitProg, tmpPt);
          pinUp.group.position.copy(tmpPt);
          pinUp.flareMat.uniforms.uIntensity.value = 0.8 * (1.0 - dissolveS26);
        } else if (launchProg > 0.02) {
          pinDown.group.visible = true;
          launchCurve.getPointAt(launchProg, tmpPt);
          pinDown.group.position.copy(tmpPt);
          pinUp.group.visible = false;
        } else {
          pinDown.group.visible = false;
          pinUp.group.visible = false;
        }

        const splitPhase = clamp((splitProg - 0.24) / 0.20, 0, 1);
        splitRing.visible = splitPhase > 0.01 && splitPhase < 0.99;
        splitRing.scale.setScalar(0.4 + splitPhase * 3.2);
        splitRingMat.uniforms.uOpacity.value = Math.sin(splitPhase * Math.PI) * 0.65;

        // During u = 0.74..1.00, ALL particles lift off the dissolving Solar System & 「人」 and begin spiraling inward toward the Armada hulls!
        const gatherS26 = dissolveS26 * 0.42; // 0 -> 0.42 by end of S26B; S27 continues seamlessly from 0.42 -> 1.00!
        riverParticles.forEach((rp, idx) => {
          const vis = rp.isSolar ? dissolveS26 > 0.04 : (rp.t <= splitProg && splitProg > 0.01);
          rp.mesh.visible = vis;
          if (vis) {
            const swirlAng = rp.swirlAng + seqT * 1.4;
            const vortex = Math.sin(gatherS26 * Math.PI) * 2.2;
            const tx = rp.fx + Math.cos(swirlAng) * vortex;
            const ty = rp.fy + Math.sin(swirlAng) * vortex;
            const tz = -10.0 + rp.fz;
            rp.mesh.position.set(
              THREE.MathUtils.lerp(rp.bx, tx, gatherS26),
              THREE.MathUtils.lerp(rp.by + Math.sin(seqT * 2.2 + idx) * 0.14, ty, gatherS26),
              THREE.MathUtils.lerp(rp.bz, tz, gatherS26)
            );
            rp.mesh.scale.setScalar(rp.sc * (0.72 + gatherS26 * 0.45));
          }
        });

        // Continuous zoom-out + 90-degree roll -> exact end-pose handed off to S27!
        const panT = smoothstep(0.06, 0.85, u);
        const rollAng = smoothstep(0.28, 0.94, u) * (Math.PI * 0.5);

        camera.fov = 38 + u * 10.0; // ends at 48
        camera.up.set(-Math.sin(rollAng), Math.cos(rollAng), 0); // ends at (-1, 0, 0)
        camera.position.set(
          THREE.MathUtils.lerp(-9.5, 1.5, panT),
          THREE.MathUtils.lerp(0.2, 0.3, panT),
          4.2 + u * 30.8 // ends at 35.0
        );
        camera.lookAt(
          THREE.MathUtils.lerp(-9.5, 1.5, panT),
          THREE.MathUtils.lerp(0.1, 0.3, panT),
          -8.4
        );
        camera.updateProjectionMatrix();

        pinDown.flare.quaternion.copy(camera.quaternion);
        pinUp.flare.quaternion.copy(camera.quaternion);
        return { sunDir: new THREE.Vector3(-0.75, 0.42, 0.50), clearColor: 0x05081a, shadowBounds: null };
      }

      // ====================================================================
      // ACT 2: S27 ("呜～ 意识之光 / 星辰流浪") — 100% ONE-TAKE FROM S26B!
      // The golden 「人」 awakens into the Consciousness Star-River & Armada sailing to the sleeping Milky Way!
      // ====================================================================
      if (isVoyage) {
        horizonGroup.visible = false;
        // Finish dissolving the remaining Solar System & 「人」 smoothly from S26B's exact 0.42 opacity -> 0.0!
        const remDissolve = smoothstep(0.0, 0.28, u);
        renZone.visible = remDissolve < 0.99;
        renCoreMat.uniforms.uOpacity.value = 0.42 * (1.0 - remDissolve);
        nodeRingMat.uniforms.uOpacity.value = 0.20 * (1.0 - remDissolve);
        orbitMats.forEach((om) => { om.uniforms.uOpacity.value = 0.11 * (1.0 - remDissolve); });
        solarAnchor.scale.setScalar(Math.max(0.01, 0.38 * (1.0 - remDissolve)));
        pinDown.group.visible = false;
        pinUp.group.visible = false;
        splitRing.visible = false;

        // Armada advances smoothly from z = -10 -> -54 as the dissolving particles converge directly onto each hull!
        const fleetZ = THREE.MathUtils.lerp(-10.0, -54.0, smoothstep(0.04, 1.0, u));
        // Particles seamlessly continue gathering from 0.42 (S26B end) -> 1.00 (locked onto the hulls at u=0.28), then trail behind as stardust wakes!
        const gatherS27 = 0.42 + smoothstep(0.0, 0.28, u) * 0.58;
        const wakeSpread = smoothstep(0.28, 0.95, u);

        riverParticles.forEach((rp, idx) => {
          rp.mesh.visible = true;
          const swirlAng = rp.swirlAng + seqT * 1.4;
          const vortex = Math.sin(gatherS27 * Math.PI) * 2.2;
          const shipX = rp.fx + Math.cos(swirlAng) * (vortex + wakeSpread * rp.swirlR * 0.55);
          const shipY = rp.fy + Math.sin(swirlAng) * (vortex + wakeSpread * rp.swirlR * 0.35);
          const shipZ = fleetZ + rp.fz + wakeSpread * (4.0 + (idx % 12) * 1.4);
          rp.mesh.position.set(
            THREE.MathUtils.lerp(rp.bx, shipX, gatherS27),
            THREE.MathUtils.lerp(rp.by, shipY, gatherS27),
            THREE.MathUtils.lerp(rp.bz, shipZ, gatherS27)
          );
          rp.mesh.scale.setScalar(rp.sc * (0.95 - wakeSpread * 0.35 + bass * 0.2));
        });

        // Unified StarArk + 16 Escorts solidify smoothly right as the converging stardust locks onto them (u = 0.08..0.32)!
        const fleetForge = smoothstep(0.08, 0.32, u);
        armadaGroup.visible = fleetForge > 0.01;
        armadaGroup.position.set(0, 0, fleetZ);
        armadaGroup.scale.setScalar(0.18 + fleetForge * 0.82);
        auraRing.rotation.z = seqT * 1.2;
        escorts.forEach((e, idx) => {
          const shipReady = smoothstep(0.10 + (idx % 4) * 0.04, 0.34 + (idx % 4) * 0.04, u);
          e.mesh.visible = shipReady > 0.02;
          e.mesh.scale.setScalar(0.2 + shipReady * 0.8);
          e.mesh.position.y = e.oy + Math.sin(seqT * 1.8 + e.phase) * 0.14;
        });

        // Sleeping dark-indigo Spiral Galaxy grows grandly ahead as the armada approaches (ZERO strong light!)
        galaxyPivot.visible = true;
        galaxyMat.uniforms.uOpacity.value = 0.22 + smoothstep(0.10, 0.85, u) * 0.68;
        galaxyMat.uniforms.uIgniteFront.value = 0.0;
        galaxyMat.uniforms.uCoreFlash.value = 0.0;
        novaFlashSphere.visible = false;
        galaxyStars.forEach((st) => {
          st.mesh.material = sleepStarMat;
          st.mesh.scale.setScalar(st.baseScale * 0.85);
        });

        // 100% SEAMLESS ONE-TAKE CAMERA from S26B's exact end-pose:
        // Starts at (1.5, 0.3, 35.0), up=(-1, 0, 0), fov=48 ->
        // smoothly unrolls upright (90 -> 0 deg) & sails forward to (0, 10.5, -24.0) overlooking the sleeping Milky Way!
        const unrollT = smoothstep(0.0, 0.42, u);
        const rollAng = (1.0 - unrollT) * (Math.PI * 0.5);
        const sailT = smoothstep(0.0, 1.0, u);

        camera.fov = THREE.MathUtils.lerp(48.0, 44.0, sailT);
        camera.up.set(-Math.sin(rollAng), Math.cos(rollAng), 0);
        camera.position.set(
          THREE.MathUtils.lerp(1.5, 0.0, sailT),
          THREE.MathUtils.lerp(0.3, 10.5, smoothstep(0.25, 1.0, u)),
          THREE.MathUtils.lerp(35.0, -24.0, sailT)
        );
        camera.lookAt(
          THREE.MathUtils.lerp(1.5, 0.0, sailT),
          THREE.MathUtils.lerp(0.3, 0.0, sailT),
          THREE.MathUtils.lerp(-8.4, -62.0, smoothstep(0.05, 0.95, u))
        );
        camera.updateProjectionMatrix();

        return { sunDir: new THREE.Vector3(0.25, 0.6, -0.75), clearColor: 0x050716, shadowBounds: null };
      }

      // ====================================================================
      // ACT 3: S28A ("呜～ 点燃这长夜") — 100% ONE-TAKE FROM S27!
      // THE ONE AND ONLY STRONG-LIGHT CLIMAX: StarArk ignites the entire sleeping Milky Way!
      // ====================================================================
      if (isIgnite) {
        renZone.visible = false;
        riverParticles.forEach((rp) => { rp.mesh.visible = false; });

        // StarArk glides smoothly into the sleeping dark galactic core until 04:07.0 (u = 0.57)!
        // ZERO light sphere & ZERO ignition before 04:07.0 (u < 0.57)!
        const plungeT = clamp(u / 0.57, 0, 1);
        armadaGroup.visible = u < 0.60;
        armadaGroup.position.set(0, 0, THREE.MathUtils.lerp(-54.0, -62.0, plungeT));
        armadaGroup.scale.setScalar(Math.max(0.01, 1.0 - smoothstep(0.45, 0.60, u) * 0.92));

        // THE ONE STRONG-LIGHT SUPERNOVA IGNITION WAVE: triggers strictly AFTER 04:07.0 (u >= 0.57)!
        const igniteFront = u < 0.57 ? 0.0 : smoothstep(0.57, 0.99, u) * 1.15;
        const corePeak = u < 0.57 ? 0.0 : Math.exp(-Math.pow((u - 0.65) * 8.5, 2.0));

        galaxyPivot.visible = true;
        galaxyMat.uniforms.uOpacity.value = 0.92;
        galaxyMat.uniforms.uIgniteFront.value = igniteFront;
        galaxyMat.uniforms.uCoreFlash.value = u < 0.57 ? 0.0 : (corePeak + smoothstep(0.57, 0.78, u) * 0.42);

        // Blazing core light sphere appears STRICTLY after 04:07.0 (u >= 0.57), never before!
        novaFlashSphere.visible = u >= 0.57 && corePeak > 0.02;
        novaFlashSphere.scale.setScalar(0.5 + corePeak * 4.4 + bass * 0.55);
        novaFlashMat.uniforms.uOpacity.value = corePeak * 0.95;

        galaxyStars.forEach((st) => {
          const isLit = st.rNorm <= igniteFront && igniteFront > 0.02;
          st.mesh.material = isLit ? litStarMat : sleepStarMat;
          const pulse = isLit ? 1.25 + 0.45 * Math.sin(st.rNorm * 9.0 - seqT * 5.5) + bass * 0.45 : 0.85;
          st.mesh.scale.setScalar(st.baseScale * Math.max(0.5, pulse));
        });

        // Subtle preview of the Observable Universe Membrane emerging behind the ignited galaxy in the last 30% of S28A!
        const memIntro = smoothstep(0.68, 1.0, u);
        horizonGroup.visible = memIntro > 0.01;
        if (horizonGroup.visible) {
          membraneMesh.visible = true;
          membraneMat.uniforms.uTime.value = seqT;
          membraneMat.uniforms.uBulge.value = memIntro * 0.15;
          membraneMat.uniforms.uTear.value = 0.0;
          membraneMat.uniforms.uFade.value = memIntro * 0.72;
          tearWaveRing.visible = false;
          bridgeSpark.visible = false;
          multiRibbons.forEach((rb) => { rb.mesh.visible = false; });
          universeBubbles.forEach((ub) => { ub.group.visible = false; });
        }

        // 100% SEAMLESS ONE-TAKE CAMERA from S27's exact end-pose (0, 10.5, -24.0) -> ends cleanly centered at (0, 3.2, -45.0) for S28B!
        camera.fov = 44.0 + smoothstep(0.0, 1.0, u) * 10.0; // ends at 54
        camera.up.set(0, 1, 0);
        camera.position.set(
          Math.sin(u * Math.PI) * 4.8, // smoothly returns to x=0 at u=1.0!
          THREE.MathUtils.lerp(10.5, 2.2, smoothstep(0.0, 1.0, u)),
          THREE.MathUtils.lerp(-24.0, -52.0, smoothstep(0.0, 1.0, u))
        );
        camera.lookAt(0, THREE.MathUtils.lerp(0.0, 0.0, u), THREE.MathUtils.lerp(-62.0, -78.0, smoothstep(0.5, 1.0, u)));
        camera.updateProjectionMatrix();

        return { sunDir: new THREE.Vector3(0.4, 0.85, 0.35), clearColor: 0x050614, shadowBounds: null };
      }

      // ====================================================================
      // ACT 4: S28B ("突破这边界") — 100% ONE-TAKE FROM S28A!
      // Flies straight past the ignited Milky Way & tears right through the Observable Universe Membrane into the Multiverse!
      // ====================================================================
      renZone.visible = false;
      armadaGroup.visible = false;
      novaFlashSphere.visible = false;
      riverParticles.forEach((rp) => { rp.mesh.visible = false; });

      // The ignited Milky Way glides right past behind the camera as we dive forward through z = -62 -> -78!
      const galBehindFade = 1.0 - smoothstep(0.18, 0.45, u);
      galaxyPivot.visible = galBehindFade > 0.01;
      galaxyMat.uniforms.uOpacity.value = 0.92 * galBehindFade;
      galaxyMat.uniforms.uIgniteFront.value = 1.15;
      galaxyMat.uniforms.uCoreFlash.value = 0.35 * galBehindFade;

      const calmFade = 1.0 - smoothstep(0.76, 0.98, u);
      horizonGroup.visible = true;

      // Membrane bulges under pressure (u = 0..0.34), then TEARS OPEN like liquid spacetime (u = 0.26..0.72)!
      const bulge = 0.15 + smoothstep(0.0, 0.34, u) * 0.85 * (1.0 - smoothstep(0.42, 0.68, u));
      const tear = smoothstep(0.26, 0.72, u);
      const memFade = (0.72 + smoothstep(0.0, 0.15, u) * 0.28) * (1.0 - smoothstep(0.62, 0.78, u));
      membraneMesh.visible = memFade > 0.01;
      membraneMat.uniforms.uTime.value = seqT;
      membraneMat.uniforms.uBulge.value = bulge + bass * 0.22;
      membraneMat.uniforms.uTear.value = tear;
      membraneMat.uniforms.uFade.value = memFade;

      const waveT = clamp((u - 0.26) / 0.36, 0, 1);
      tearWaveRing.visible = waveT > 0.01 && waveT < 0.99;
      tearWaveRing.scale.setScalar(0.6 + waveT * 11.5);
      tearWaveMat.uniforms.uOpacity.value = Math.sin(waveT * Math.PI) * 0.78;

      // Phase 3 (u = 0.28..1.00): Multiverse ribbons appear, then GRADUALLY MORPH bit-by-bit into "101010101010..." strings!
      // Keep the "101010..." strings alive right to u = 1.00 so S29 pulls rapidly back from them!
      const ribbonIn = smoothstep(0.26, 0.50, u);
      const binMorph = smoothstep(0.54, 0.96, u);
      multiRibbons.forEach((rb, idx) => {
        rb.mesh.visible = ribbonIn > 0.01;
        rb.mat.uniforms.uTime.value = seqT;
        rb.mat.uniforms.uOpacity.value = ribbonIn * (0.65 + binMorph * 0.25);
        // Stagger each ribbon's morph slightly so they crystallize into 10101010... bit by bit!
        const localMorph = smoothstep(0.50 + (idx % 5) * 0.05, 0.88 + (idx % 3) * 0.04, u);
        rb.mat.uniforms.uBinMorph.value = localMorph;
      });

      const bubbleVis = smoothstep(0.28, 0.54, u) * (1.0 - smoothstep(0.68, 0.94, u));
      universeBubbles.forEach((ub) => {
        ub.group.visible = bubbleVis > 0.01;
        ub.group.scale.setScalar(0.35 + bubbleVis * 0.75);
        ub.shell.rotation.y = seqT * ub.spd;
        ub.shell2.rotation.z = -seqT * ub.spd * 0.8;
      });

      bridgeSpark.visible = false;

      // 100% SEAMLESS ONE-TAKE CAMERA from S28A's exact end-pose (0, 2.2, -52.0, fov=54) -> settles right amidst the 101010... strings!
      camera.fov = 54.0 + smoothstep(0.16, 0.44, u) * 12.0 - smoothstep(0.58, 0.98, u) * 16.0;
      camera.up.set(0, 1, 0);
      camera.position.set(
        Math.sin(u * Math.PI) * 0.8 * calmFade,
        THREE.MathUtils.lerp(2.2, 0.0, smoothstep(0.0, 0.45, u)),
        THREE.MathUtils.lerp(-52.0, -90.0, smoothstep(0.0, 0.98, u))
      );
      camera.lookAt(0, 0, -120.0);
      camera.updateProjectionMatrix();

      return { sunDir: new THREE.Vector3(0.4, 0.6, 0.7), clearColor: 0x040510, shadowBounds: null };
    }
  };
}
