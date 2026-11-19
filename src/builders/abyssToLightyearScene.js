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

// Shared GLSL3 Volumetric Abyssal Nebula Cliff Shader (MRT gColor + gNormalId)
const NEBULA_CLIFF_VERT = /* glsl */ `
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

const NEBULA_CLIFF_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormalId;
uniform float uTime;
uniform float uSeed;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uRimColor;
uniform float uOpacity;
in vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.06;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float n = fbm(vUv * vec2(3.6, 5.2) + vec2(uSeed, -uTime * 0.14));
  float n2 = fbm(vUv * vec2(7.0, 9.0) - vec2(uTime * 0.09, uSeed * 1.7));
  float dist = length(p * vec2(1.05, 0.88)) - (n - 0.45) * 0.58;
  float alpha = smoothstep(0.95, 0.18, dist);
  float rim = smoothstep(0.55, 0.25, abs(dist - 0.52)) * smoothstep(0.42, 0.78, n2);
  vec3 col = mix(uColorA, uColorB, clamp(n * 1.25, 0.0, 1.0)) + uRimColor * rim * 1.55;
  float a = alpha * uOpacity;
  if (a < 0.02) discard;
  gColor = vec4(col, a);
  gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
}
`;

// GLSL3 Swirling Galactic Spiral Dust Disk Shader (for S26B Lightyear Panorama)
const GALAXY_DISK_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormalId;
uniform float uTime;
uniform float uOpacity;
in vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float ang = atan(p.y, p.x);
  float spiral = sin(ang * 2.0 - r * 7.8 + uTime * 0.25) * 0.5 + 0.5;
  float spiral2 = sin(ang * 4.0 - r * 11.5 - uTime * 0.18) * 0.5 + 0.5;
  float dust = noise(vec2(r * 6.0, ang * 2.5) + uTime * 0.05);
  float armMask = pow(spiral, 1.6) * 0.72 + pow(spiral2, 2.2) * 0.28;
  float core = exp(-r * 3.8);
  float radialFade = smoothstep(1.0, 0.12, r);
  vec3 col = mix(vec3(0.08, 0.14, 0.36), vec3(0.18, 0.32, 0.56), armMask);
  col = mix(col, vec3(0.32, 0.34, 0.52), clamp(core * 0.7 + dust * 0.25 * armMask, 0.0, 1.0));
  float a = (armMask * 0.32 + core * 0.38) * radialFade * uOpacity;
  if (a < 0.015) discard;
  gColor = vec4(col, a);
  gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
}
`;

// Two-Pinpoint-Ship Calligraphic 「人」 Trajectories:
// Both ships fly together down the crisp upper crown of 「人」 (-6.8 -> -2.4),
// then smoothly & simultaneously part ways left (-Y -> 「丿」) and right (+Y -> 「㇏」)
// in balanced sweeping brush curves!
function buildRenCharacterCurves() {
  const apex = new THREE.Vector3(-7.4, 0.0, -8.0);
  const splitPt = new THREE.Vector3(-2.6, 0.0, -8.1);

  // Pinpoint A: Top crown -> sweeps smoothly outward-left (「丿」 after 90 deg roll)
  const downCurve = new THREE.CatmullRomCurve3([
    apex.clone(),
    new THREE.Vector3(-5.0, 0.0, -8.05),
    splitPt.clone(),
    new THREE.Vector3(1.4, -2.0, -8.25),
    new THREE.Vector3(5.8, -5.8, -8.55),
    new THREE.Vector3(10.4, -10.8, -8.9)
  ]);

  // Pinpoint B: Top crown -> simultaneously parts smoothly outward-right (「㇏」 after 90 deg roll)
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

// Pinpoint-of-Light Starship Flare (realistic light-year scale!)
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
  float halo = exp(-r * 3.0) * 0.45;
  float spikeH = exp(-abs(p.y) * 36.0) * exp(-abs(p.x) * 3.5);
  float spikeV = exp(-abs(p.x) * 36.0) * exp(-abs(p.y) * 3.5);
  vec3 col = vec3(1.0, 0.96, 0.84) * (core * 2.4 + (spikeH + spikeV) * 1.1) + vec3(1.0, 0.78, 0.35) * halo;
  float a = clamp((core + halo + (spikeH + spikeV) * 0.9) * smoothstep(1.0, 0.1, r) * uIntensity, 0.0, 1.0);
  if (a < 0.01) discard;
  gColor = vec4(col, a);
  gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
}
`;

// ============================================================================
// S26A (abyss) & S26B (lightyear) — Unified Modular Scene Builder
// ============================================================================
export function buildAbyssToLightyearScene() {
  const scene = new THREE.Scene();
  const rand = mulberry32(26268);

  // Shared 3600-star deep space starfield (100% matched to S27-S28B for seamless transition!)
  scene.add(buildStarfield(3600, 580, 27289));

  // --------------------------------------------------------------------------
  // LAYER A: S26A — "跨越过 · 这无垠的深渊" (Colossal Abyssal Rift + StarArk Leap)
  // --------------------------------------------------------------------------
  const abyssGroup = new THREE.Group();
  scene.add(abyssGroup);

  const cliffMats = [];
  const cliffPlanes = [];
  for (let i = 0; i < 18; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: NEBULA_CLIFF_VERT,
      fragmentShader: NEBULA_CLIFF_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uSeed: { value: i * 1.91 + 0.5 },
        uColorA: { value: side < 0 ? new THREE.Color(0x102854) : new THREE.Color(0x2d184d) },
        uColorB: { value: side < 0 ? new THREE.Color(0x1f6b8f) : new THREE.Color(0x6e3168) },
        uRimColor: { value: side < 0 ? new THREE.Color(0x74ecff) : new THREE.Color(0xffc76e) },
        uOpacity: { value: 0.52 }
      }
    });
    cliffMats.push(mat);
    const w = 18 + rand() * 14;
    const h = 28 + rand() * 18;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(
      side * (16.5 + rand() * 11.0),
      -4.0 + (rand() - 0.5) * 12.0,
      -6.0 - i * 4.2
    );
    m.rotation.y = side * (-0.35 + (rand() - 0.5) * 0.35);
    abyssGroup.add(m);
    cliffPlanes.push(m);
  }

  // Sculpted Fractured Abyss Monolith Rocks flanking both sides of the chasm
  const rockMatL = createCelMaterial({ color: 0x263864, shadowColor: 0x0c1328, rimStrength: 0.65, rimColor: 0x76ecff });
  const rockMatR = createCelMaterial({ color: 0x3f2a5e, shadowColor: 0x150d26, rimStrength: 0.65, rimColor: 0xffcf78 });
  const abyssRocks = [];
  for (let i = 0; i < 24; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.4 + rand() * 2.4, 0),
      side < 0 ? rockMatL : rockMatR
    );
    rock.scale.set(0.8 + rand() * 0.8, 1.6 + rand() * 1.8, 0.9 + rand() * 0.8);
    rock.position.set(
      side * (15.5 + rand() * 14.0),
      -10.0 + rand() * 20.0,
      -4.0 - i * 3.4
    );
    rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    abyssGroup.add(rock);
    abyssRocks.push({ mesh: rock, rotSpd: (rand() - 0.5) * 0.45 });
  }

  // Parabolic Golden Light-Bridge arcing boldly across the abyss
  const arcPts = [];
  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    const x = -22.0 + t * 44.0;
    const y = -6.8 + Math.sin(t * Math.PI) * 14.2;
    const z = -10.0 - Math.sin(t * Math.PI) * 10.5;
    arcPts.push(new THREE.Vector3(x, y, z));
  }
  const arcCurve = new THREE.CatmullRomCurve3(arcPts);
  const bridgeCoreGeo = new THREE.TubeGeometry(arcCurve, 96, 0.20, 10, false);
  const bridgeGlowGeo = new THREE.TubeGeometry(arcCurve, 96, 0.56, 10, false);
  const bridgeCoreMat = createCelMaterial({
    color: 0xfff7d6,
    emissive: 0xffcb5c,
    emissiveStrength: 3.4,
    unlit: true,
    noInk: true
  });
  const bridgeGlowMat = createCelMaterial({
    color: 0xffc857,
    emissive: 0xff9d2e,
    emissiveStrength: 2.2,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  abyssGroup.add(new THREE.Mesh(bridgeCoreGeo, bridgeCoreMat));
  abyssGroup.add(new THREE.Mesh(bridgeGlowGeo, bridgeGlowMat));

  // Unified StarArk Flagship leaping across the golden bridge!
  const arkHolder = new THREE.Group();
  const arkShip = buildStarArkShip();
  arkShip.scale.setScalar(0.82);
  // Rotate StarArk so its +X nose points along +Z for easy lookAt()
  arkShip.rotation.y = -Math.PI / 2;
  arkHolder.add(arkShip);

  const wakeMat = createCelMaterial({
    color: 0xffe9a3,
    emissive: 0xffae2e,
    emissiveStrength: 3.2,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const arkWake = new THREE.Mesh(new THREE.ConeGeometry(0.62, 7.2, 12, 1, true), wakeMat);
  arkWake.rotation.x = -Math.PI / 2;
  arkWake.position.z = -5.6;
  arkHolder.add(arkWake);
  abyssGroup.add(arkHolder);

  // 72 Golden Stardust Motes trailing along the abyssal leap arc
  const dustGeo = new THREE.OctahedronGeometry(0.14, 0);
  const dustMat = createCelMaterial({
    color: 0xfff3c4,
    emissive: 0xffc857,
    emissiveStrength: 2.6,
    unlit: true,
    noInk: true
  });
  const arcDust = [];
  for (let i = 0; i < 72; i++) {
    const t = rand();
    const p = arcCurve.getPoint(t);
    const m = new THREE.Mesh(dustGeo, dustMat);
    const ox = (rand() - 0.5) * 3.8;
    const oy = (rand() - 0.5) * 3.4;
    const oz = (rand() - 0.5) * 3.6;
    m.position.set(p.x + ox, p.y + oy, p.z + oz);
    abyssGroup.add(m);
    arcDust.push({ mesh: m, t, ox, oy, oz, sc: 0.5 + rand() * 1.1 });
  }

  // --------------------------------------------------------------------------
  // LAYER B: S26B — "将人类的名字 · 刻在光年"
  // 1) Golden beam links Solar System & Star-Constellations -> 2) Camera zooms WAY out to light-year scale ->
  // 3) Two pinpoint-of-light starships split (one UP, one DOWN) -> 4) Camera rolls 90 deg into an exact upright 「人」!
  // --------------------------------------------------------------------------
  const lightyearGroup = new THREE.Group();
  scene.add(lightyearGroup);

  // Swirling GLSL3 Milky Way Disk centered behind the light-year expanse
  const galaxyDiskMat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: NEBULA_CLIFF_VERT,
    fragmentShader: GALAXY_DISK_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.82 }
    }
  });
  const galaxyDisk = new THREE.Mesh(new THREE.PlaneGeometry(86, 86), galaxyDiskMat);
  galaxyDisk.position.set(0.0, 0.0, -20.0);
  galaxyDisk.rotation.x = -0.78;
  galaxyDisk.rotation.z = 0.22;
  lightyearGroup.add(galaxyDisk);

  // Compact Solar System Constellation Cluster on the LEFT (shrinks to a jewel when camera zooms out!)
  const solarAnchor = new THREE.Group();
  solarAnchor.position.set(-10.5, 0.0, -7.8);
  lightyearGroup.add(solarAnchor);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(1.05, 32, 24),
    createCelMaterial({ color: 0xfff8dc, emissive: 0xffd56b, emissiveStrength: 2.8, unlit: true, noInk: true })
  );
  sun.position.set(-3.2, 0.8, 0.0);
  solarAnchor.add(sun);

  [2.2, 3.8, 5.6, 7.6].forEach((r, idx) => {
    const curve = new THREE.EllipseCurve(-3.2, 0.8, r, r * 0.88, 0, Math.PI * 2, false, 0);
    const pts = curve.getPoints(120).map((p) => new THREE.Vector3(p.x, p.y, 0.0));
    solarAnchor.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 120, 0.02, 6, true),
        createCelMaterial({
          color: idx === 1 ? 0x6ce3ff : idx === 2 ? 0xe07b5e : 0xd9b377,
          emissive: idx === 1 ? 0x3ec5ff : 0xc48b44,
          emissiveStrength: 0.55,
          unlit: true,
          noInk: true,
          transparent: true,
          opacity: 0.62
        })
      )
    );
  });

  const earth = buildCelEarth(0.46, { glowColor: 0x5dbdff, atmoIntensity: 1.45 });
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

  // Balanced luminous warm-gold material for the light-year link & carved 「人」 strokes (bright & crisp, zero blowout!)
  const renCoreMat = createCelMaterial({
    color: 0xffefbd,
    emissive: 0xffc44d,
    emissiveStrength: 0.55,
    unlit: true,
    noInk: true
  });

  // Golden Beam linking Earth -> Mars -> Jupiter -> Top Apex of 「人」 (-7.4, 0.0, -8.0)
  const linkNodes = [
    new THREE.Vector3(-11.6, 0.55, -7.75), // Earth
    new THREE.Vector3(-9.85, -0.35, -7.72), // Mars
    new THREE.Vector3(-8.5, 0.30, -7.85),   // Jupiter
    new THREE.Vector3(-7.4, 0.0, -8.0)      // Top Crown Entry
  ];
  const launchCurve = new THREE.CatmullRomCurve3(linkNodes);
  const launchGeo = new THREE.TubeGeometry(launchCurve, 72, 0.055, 8, false);
  const launchRibbon = new THREE.Mesh(launchGeo, renCoreMat);
  lightyearGroup.add(launchRibbon);

  // Luminous crisp rings at each linked celestial node
  const nodeRingMat = createCelMaterial({
    color: 0xffe6a3,
    emissive: 0xffbe42,
    emissiveStrength: 0.55,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.82
  });
  const nodeRings = linkNodes.map((pos, i) => {
    const rm = new THREE.Mesh(new THREE.TorusGeometry(0.55 + i * 0.08, 0.03, 8, 36), nodeRingMat);
    rm.position.copy(pos);
    lightyearGroup.add(rm);
    return { mesh: rm, thresh: i / (linkNodes.length - 1) };
  });

  // Two-Pinpoint-Ship 「人」 Contrails (clean bright golden lines, ZERO foggy blob!)
  const { downCurve, upCurve, splitPt } = buildRenCharacterCurves();
  const downCoreGeo = new THREE.TubeGeometry(downCurve, 96, 0.12, 10, false);
  const upCoreGeo = new THREE.TubeGeometry(upCurve, 96, 0.12, 10, false);
  const downHaloGeo = downCoreGeo;
  const upHaloGeo = upCoreGeo;

  lightyearGroup.add(
    new THREE.Mesh(downCoreGeo, renCoreMat),
    new THREE.Mesh(upCoreGeo, renCoreMat)
  );

  // Two Realistic Light-Year-Scale Pinpoint-of-Light Starships (bright crisp star dots + sharp cross flare)
  function makePinpointShip() {
    const g = new THREE.Group();
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 10),
      createCelMaterial({ color: 0xffffff, emissive: 0xffe699, emissiveStrength: 1.8, unlit: true, noInk: true })
    );
    const flareMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: NEBULA_CLIFF_VERT,
      fragmentShader: PINPOINT_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uIntensity: { value: 0.85 } }
    });
    const flare = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 1.85), flareMat);
    g.add(dot, flare);
    return { group: g, flare, flareMat };
  }

  const pinDown = makePinpointShip();
  const pinUp = makePinpointShip();
  lightyearGroup.add(pinDown.group, pinUp.group);

  // Crisp golden separation ring right at splitPt when Ship B splits out of Ship A!
  const splitRingMat = createCelMaterial({
    color: 0xfff0be,
    emissive: 0xffc857,
    emissiveStrength: 0.9,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.0
  });
  const splitRing = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.05, 10, 48), splitRingMat);
  splitRing.position.copy(splitPt);
  lightyearGroup.add(splitRing);

  // 80 Bright Crisp Golden Stardust Motes along both diverging trails
  const renSparkMat = createCelMaterial({
    color: 0xfff0bf,
    emissive: 0xffc857,
    emissiveStrength: 0.65,
    unlit: true,
    noInk: true
  });
  const renSparks = [];
  for (let i = 0; i < 80; i++) {
    const isDown = i < 40;
    const t = rand();
    const p = (isDown ? downCurve : upCurve).getPoint(t);
    const m = new THREE.Mesh(dustGeo, renSparkMat);
    const ox = (rand() - 0.5) * 1.4;
    const oy = (rand() - 0.5) * 1.4;
    const oz = (rand() - 0.5) * 1.2;
    m.position.set(p.x + ox, p.y + oy, p.z + oz);
    lightyearGroup.add(m);
    renSparks.push({ mesh: m, isDown, t, ox, oy, oz, sc: 0.35 + rand() * 0.65 });
  }

  // S26B -> S27 Seamless Chorus-Drop Transition:
  // Concentric Awakening Consciousness Aperture Rings + Soft White-Gold Dive Flash at the heart of 「人」!
  const awakenGroup = new THREE.Group();
  awakenGroup.position.copy(splitPt);
  awakenGroup.visible = false;
  lightyearGroup.add(awakenGroup);

  const awakenRingMatA = createCelMaterial({
    color: 0xfff3cc,
    emissive: 0xffc857,
    emissiveStrength: 2.6,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const awakenRingMatB = createCelMaterial({
    color: 0x9cf2ff,
    emissive: 0x3ed4ff,
    emissiveStrength: 2.4,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const awakenRingA = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.12, 10, 64), awakenRingMatA);
  const awakenRingB = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.08, 10, 64), awakenRingMatB);
  awakenGroup.add(awakenRingA, awakenRingB);

  // Full-frame golden-white iris flash plane mounted right in front of the camera for the last 0.9s handoff into S27!
  const s26FlashMat = createCelMaterial({
    color: 0xfff8e6,
    emissive: 0xffe49c,
    emissiveStrength: 3.2,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const s26FlashPlane = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), s26FlashMat);
  s26FlashPlane.visible = false;
  lightyearGroup.add(s26FlashPlane);

  const tmpPt = new THREE.Vector3();

  return {
    scene,
    update(submode, u, time, camera, audio) {
      const bass = audio ? audio.bass : 0;
      const isAbyss = submode === "abyss";

      abyssGroup.visible = isAbyss;
      lightyearGroup.visible = !isAbyss;

      if (isAbyss) {
        const localT = u * 3.9;
        cliffMats.forEach((m) => {
          m.uniforms.uTime.value = localT;
        });
        abyssRocks.forEach((r) => {
          r.mesh.rotation.y += 0.004 * r.rotSpd;
        });

        const t = smoothstep(0.02, 0.96, u);
        const pt = arcCurve.getPoint(t);
        const tan = arcCurve.getTangent(t);
        arkHolder.position.copy(pt);
        arkHolder.lookAt(pt.clone().add(tan));
        arkHolder.rotateZ(-0.28 + Math.sin(t * Math.PI) * 0.42);
        arkWake.scale.set(1.0 + bass * 0.3, 1.0 + bass * 0.3, 1.0 + bass * 0.45);

        const cIdx = bridgeCoreGeo.index ? bridgeCoreGeo.index.count : 0;
        const gIdx = bridgeGlowGeo.index ? bridgeGlowGeo.index.count : 0;
        const drawFrac = Math.min(1, t + 0.03);
        bridgeCoreGeo.setDrawRange(0, Math.floor((cIdx * drawFrac) / 3) * 3);
        bridgeGlowGeo.setDrawRange(0, Math.floor((gIdx * drawFrac) / 3) * 3);

        arcDust.forEach((d, idx) => {
          const vis = d.t <= t + 0.04;
          d.mesh.visible = vis;
          if (vis) {
            const p = arcCurve.getPoint(d.t);
            d.mesh.position.set(
              p.x + d.ox,
              p.y + d.oy + Math.sin(localT * 2.2 + idx) * 0.25,
              p.z + d.oz
            );
            d.mesh.scale.setScalar(d.sc * (0.8 + bass * 0.35));
          }
        });

        camera.fov = 45 + Math.sin(u * Math.PI) * 4.0;
        camera.position.set(-8.5 + u * 16.5, 2.2 + Math.sin(u * Math.PI) * 3.8, 17.5 - u * 5.2);
        camera.lookAt(pt.x * 0.62, pt.y * 0.72, pt.z * 0.85);
        camera.updateProjectionMatrix();
        return { sunDir: new THREE.Vector3(0.45, 0.75, 0.48), clearColor: 0x040614, shadowBounds: null };
      }

      // S26B: Link Planets -> Massive Zoom-Out to Light-Year Scale -> Two Pinpoint Starships Split (DOWN + UP) -> Camera Rolls 90 deg into Upright 「人」!
      const localT = u * 9.1;
      galaxyDiskMat.uniforms.uTime.value = localT;
      galaxyDiskMat.uniforms.uOpacity.value = 0.42 + smoothstep(0.18, 0.72, u) * 0.48;
      galaxyDisk.rotation.z = 0.22 + localT * 0.022;

      earth.userData.globe.rotation.y = 1.4 + localT * 0.16;
      mars.rotation.y = 0.5 + localT * 0.14;
      jupiter.rotation.y = -0.35 + localT * 0.09;

      // Phase 1 (u = 0.00..0.18): Swift golden beam rapidly threads Earth -> Mars -> Jupiter -> Apex Star-Node
      const launchProg = clamp(u / 0.18, 0, 1);
      const lCount = launchGeo.index ? launchGeo.index.count : 0;
      launchGeo.setDrawRange(0, Math.floor((lCount * launchProg) / 3) * 3);

      nodeRings.forEach((nr) => {
        const hit = launchProg >= nr.thresh - 0.02;
        nr.mesh.visible = hit;
        if (hit) {
          const pulse = 0.9 + Math.sin(localT * 4.0 + nr.thresh * 6.0) * 0.14 + bass * 0.25;
          nr.mesh.scale.setScalar(pulse);
        }
      });

      // Phase 2 & 3 (u = 0.18..1.00): At the EXACT instant the light-point reaches splitPt,
      // it splits SIMULTANEOUSLY into TWO light-points — one curving DOWN, one curving UP, never stopping!
      const splitProg = clamp((u - 0.18) / 0.82, 0, 1);
      const downProg = splitProg;
      const upProg = splitProg;

      const dCoreTotal = downCoreGeo.index ? downCoreGeo.index.count : 0;
      const uCoreTotal = upCoreGeo.index ? upCoreGeo.index.count : 0;
      downCoreGeo.setDrawRange(0, Math.floor((dCoreTotal * downProg) / 3) * 3);
      upCoreGeo.setDrawRange(0, Math.floor((uCoreTotal * upProg) / 3) * 3);

      if (splitProg > 0.001) {
        // Use getPointAt (arc-length!) so pinpoint star-dots sit 100% dead-on the leading tips!
        pinDown.group.visible = true;
        downCurve.getPointAt(downProg, tmpPt);
        pinDown.group.position.copy(tmpPt);
        pinDown.flareMat.uniforms.uIntensity.value = 0.85 + bass * 0.28;

        pinUp.group.visible = true;
        upCurve.getPointAt(upProg, tmpPt);
        pinUp.group.position.copy(tmpPt);
        pinUp.flareMat.uniforms.uIntensity.value = 0.85 + bass * 0.28;
      } else if (launchProg > 0.02) {
        pinDown.group.visible = true;
        launchCurve.getPointAt(launchProg, tmpPt);
        pinDown.group.position.copy(tmpPt);
        pinDown.flareMat.uniforms.uIntensity.value = 0.85 + bass * 0.25;
        pinUp.group.visible = false;
      } else {
        pinDown.group.visible = false;
        pinUp.group.visible = false;
      }

      // Separation flash ring fires right when both ships part ways at splitPt (splitProg ~ 0.28)
      const splitPhase = clamp((splitProg - 0.24) / 0.20, 0, 1);
      splitRing.visible = splitPhase > 0.01 && splitPhase < 0.99;
      splitRing.scale.setScalar(0.4 + splitPhase * 3.2);
      splitRingMat.uniforms.uOpacity.value = Math.sin(splitPhase * Math.PI) * 0.65;

      // Shimmering stardust sparks appear progressively behind both pinpoint starships
      renSparks.forEach((sp, idx) => {
        const prog = sp.isDown ? downProg : upProg;
        const vis = sp.t <= prog && prog > 0.01;
        sp.mesh.visible = vis;
        if (vis) {
          const p = (sp.isDown ? downCurve : upCurve).getPoint(sp.t);
          sp.mesh.position.set(
            p.x + sp.ox,
            p.y + sp.oy + Math.sin(localT * 2.4 + idx) * 0.16,
            p.z + sp.oz
          );
          sp.mesh.scale.setScalar(sp.sc * (0.7 + bass * 0.25));
        }
      });

      // Fast Continuous Zoom-Out + Smooth 90-Degree Camera Roll, then Chorus-Drop Warp Dive into S27 (u = 0.80..1.00)!
      const panT = smoothstep(0.06, 0.80, u);
      const rollAng = smoothstep(0.28, 0.84, u) * (Math.PI * 0.5) + u * 0.03;
      const diveT = smoothstep(0.80, 1.00, u); // Final 1.8s: dive straight into the awakening 「人」 consciousness aperture!

      const camZ = (4.2 + u * 30.0) - diveT * diveT * 26.0;
      const camX = THREE.MathUtils.lerp(-9.5, 1.2, panT) * (1.0 - diveT) + splitPt.x * diveT;
      const camY = THREE.MathUtils.lerp(0.2, 0.3, panT) * (1.0 - diveT);

      camera.fov = 38 + u * 11.0 + diveT * 18.0;
      camera.up.set(-Math.sin(rollAng), Math.cos(rollAng), 0);
      camera.position.set(camX, camY, camZ);
      camera.lookAt(
        THREE.MathUtils.lerp(THREE.MathUtils.lerp(-9.5, 1.2, panT), splitPt.x, diveT),
        THREE.MathUtils.lerp(0.1, 0.0, diveT),
        -8.2
      );
      camera.updateProjectionMatrix();

      // Awakening Consciousness Aperture Rings bloom at the heart of 「人」 (u = 0.76..1.00) -> clean match-cut into S27 Warp-Gate (ZERO white flash!)
      const wakeT = smoothstep(0.76, 0.98, u);
      awakenGroup.visible = wakeT > 0.01;
      if (awakenGroup.visible) {
        awakenRingA.scale.setScalar(0.2 + wakeT * 4.2);
        awakenRingB.scale.setScalar(0.15 + wakeT * 5.6);
        awakenRingA.rotation.z = localT * 1.4;
        awakenRingB.rotation.z = -localT * 1.1;
        awakenRingMatA.uniforms.uOpacity.value = wakeT * 0.75;
        awakenRingMatB.uniforms.uOpacity.value = wakeT * 0.65;
      }
      s26FlashPlane.visible = false;

      // Keep pinpoint flares crisp & facing camera
      pinDown.flare.quaternion.copy(camera.quaternion);
      pinUp.flare.quaternion.copy(camera.quaternion);

      return { sunDir: new THREE.Vector3(-0.75, 0.42, 0.50), clearColor: 0x05081a, shadowBounds: null };
    }
  };
}
