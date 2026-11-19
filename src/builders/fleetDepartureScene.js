import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { mulberry32, clamp, smoothstep } from "../core/math.js";
import { buildStarfield, buildStarArkShip } from "./cosmicPrimitives.js";

// Custom GLSL3 MRT Volumetric Cosmic Fog Veil that literally PARTS & DISSOLVES ("迷雾全散开")!
function createPartingCosmicFogMaterial(tintHex, seedOffset = 0.0) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uParting: { value: 0.0 },
      uSeed: { value: seedOffset },
      uColor: { value: new THREE.Color(tintHex) }
    },
    vertexShader: `
      precision highp float;
      in vec3 position;
      in vec2 uv;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      out vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uParting;
      uniform float uSeed;
      uniform vec3 uColor;
      in vec2 vUv;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
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
          p *= 2.02;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float outerEnv = smoothstep(1.0, 0.18, r);
        float clearHole = smoothstep(uParting * 1.18 - 0.22, uParting * 1.18 + 0.35, r);
        float mist = fbm(vUv * 3.8 + vec2(uTime * 0.08 + uSeed, -uTime * 0.05));
        float mist2 = fbm(vUv * 7.2 - vec2(uTime * 0.11, uSeed * 1.7));
        float cloud = clamp(mist * 0.65 + mist2 * 0.35, 0.0, 1.0);

        float globalFade = 1.0 - smoothstep(0.68, 1.0, uParting);
        float a = outerEnv * clearHole * smoothstep(0.22, 0.78, cloud) * 0.72 * globalFade;
        vec3 col = mix(uColor, vec3(0.55, 0.82, 1.0), mist2 * 0.38);
        gColor = vec4(col * a * 1.25, clamp(a, 0.0, 1.0));
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Custom GLSL3 MRT Golden Cosmic Dawn God-Rays bursting through the parting mist ("迷雾全散开")!
function createDawnGodRaysMaterial() {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0.0 }
    },
    vertexShader: `
      precision highp float;
      in vec3 position;
      in vec2 uv;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      out vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uIntensity;
      in vec2 vUv;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float ang = atan(p.y, p.x);
        float rays1 = pow(0.5 + 0.5 * sin(ang * 12.0 + uTime * 0.35), 4.0);
        float rays2 = pow(0.5 + 0.5 * cos(ang * 20.0 - uTime * 0.25), 5.0);
        float rays = rays1 * 0.65 + rays2 * 0.45;
        float core = exp(-r * r * 14.0) * 1.5;
        float radial = exp(-r * 2.4) * smoothstep(1.0, 0.15, r);
        vec3 col = mix(vec3(0.42, 0.85, 1.0), vec3(1.0, 0.90, 0.62), clamp(core + rays * 0.85, 0.0, 1.0));
        float a = clamp((core + rays * radial * 0.95) * uIntensity, 0.0, 1.0);
        gColor = vec4(col * a * 1.35, a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Custom GLSL3 MRT Flowing Holographic Star-Chart Coordinate Lines ("星图展开"!)
function createStarChartLineMaterial(baseHex, pulseHex) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uUnfold: { value: 0.0 },
      uBaseColor: { value: new THREE.Color(baseHex) },
      uPulseColor: { value: new THREE.Color(pulseHex) }
    },
    vertexShader: `
      precision highp float;
      in vec3 position;
      in float aT;
      in float aRadius;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      out float vT;
      out float vRadius;
      void main() {
        vT = aT;
        vRadius = aRadius;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uUnfold;
      uniform vec3 uBaseColor;
      uniform vec3 uPulseColor;
      in float vT;
      in float vRadius;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        float reveal = smoothstep(vRadius - 0.08, vRadius + 0.08, uUnfold * 1.25);
        float pulse = pow(0.5 + 0.5 * sin(vT * 12.566 - uTime * 3.8), 4.0);
        vec3 col = mix(uBaseColor, uPulseColor, pulse * 0.75);
        float a = (0.22 + pulse * 0.50) * reveal;
        gColor = vec4(col * (1.0 + pulse * 1.2), clamp(a, 0.0, 1.0));
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Custom GLSL3 MRT Fresnel Planetary Crescent Atmosphere
function createCrescentAtmoMaterial(sunDir) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    uniforms: { uSunDir: { value: sunDir.clone().normalize() } },
    vertexShader: `
      precision highp float;
      in vec3 position;
      in vec3 normal;
      uniform mat4 modelMatrix;
      uniform mat4 viewMatrix;
      uniform mat4 projectionMatrix;
      out vec3 vWorldNormal;
      out vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform vec3 cameraPosition;
      uniform vec3 uSunDir;
      in vec3 vWorldNormal;
      in vec3 vWorldPos;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float ndv = clamp(dot(N, V), 0.0, 1.0);
        float rim = pow(1.0 - ndv, 3.2) * smoothstep(0.0, 0.16, ndv);
        float sunWrap = smoothstep(-0.25, 0.70, dot(N, normalize(uSunDir)));
        vec3 col = mix(vec3(0.95, 0.48, 0.30), vec3(1.0, 0.80, 0.48), pow(1.0 - ndv, 2.0));
        float a = clamp(rim * sunWrap * 1.3, 0.0, 1.0);
        gColor = vec4(col * a * 1.25, a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// === SHIP CLASS 1: STAR-WARS-SCALE CAPITAL WEDGE CRUISER (Tiered Triangular Dreadnought + Bridge Tower + Hangar + 5 Ion Engines!) ===
function createCapitalWedgeCruiser(mats, scale = 1.0) {
  const g = new THREE.Group();

  // Tier 1: Colossal armored triangular wedge hull (pointing forward along -Z!)
  const wedgeGeo = new THREE.ConeGeometry(3.2, 11.0, 4);
  wedgeGeo.rotateY(Math.PI / 4);
  wedgeGeo.rotateX(-Math.PI / 2);
  wedgeGeo.scale(1.15, 0.24, 1.0);
  const hullMain = new THREE.Mesh(wedgeGeo, mats.armorLight);
  g.add(hullMain);

  // Tier 2: Raised dorsal armored superstructure deck
  const superGeo = new THREE.ConeGeometry(1.9, 6.8, 4);
  superGeo.rotateY(Math.PI / 4);
  superGeo.rotateX(-Math.PI / 2);
  superGeo.scale(1.05, 0.28, 1.0);
  const hullMid = new THREE.Mesh(superGeo, mats.armorMid);
  hullMid.position.set(0, 0.52, 1.3);
  g.add(hullMid);

  // Tier 3: Iconic raised Star-Wars-style Command Bridge Tower + Sensor Domes!
  const towerNeck = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.15, 1.1), mats.dark);
  towerNeck.position.set(0, 1.15, 3.3);
  g.add(towerNeck);
  const bridgeBar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.46, 0.72), mats.armorLight);
  bridgeBar.position.set(0, 1.75, 3.3);
  g.add(bridgeBar);
  const bridgeWin = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.14, 0.76), mats.warmWin);
  bridgeWin.position.set(0, 1.78, 3.28);
  g.add(bridgeWin);
  [-0.85, 0.85].forEach((x) => {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), mats.armorMid);
    dome.position.set(x, 2.12, 3.3);
    g.add(dome);
  });

  // Illuminated side trench window strips along both flanks (gives instant colossal scale!)
  [-1, 1].forEach((side) => {
    const trench = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.14, 7.6), mats.warmWin);
    trench.position.set(side * 1.45, 0.08, 1.2);
    trench.rotation.y = side * -0.24;
    g.add(trench);
  });

  // Glowing ventral hangar bay slot
  const hangar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.24, 1.8), mats.cyanCore);
  hangar.position.set(0, -0.45, 0.2);
  g.add(hangar);

  // 5 Massive Aft Ion Engine Banks (+Z stern) with glowing cyan cores & plumes!
  const plumes = [];
  [-1.85, -0.95, 0.0, 0.95, 1.85].forEach((x, idx) => {
    const r = idx === 2 ? 0.56 : 0.42;
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r, 0.75, 14), mats.dark);
    bell.rotation.x = Math.PI / 2;
    bell.position.set(x, 0.05, 5.65);
    g.add(bell);
    const core = new THREE.Mesh(new THREE.CircleGeometry(r * 0.84, 14), mats.cyanCore);
    core.position.set(x, 0.05, 6.04);
    g.add(core);
    const pl = new THREE.Mesh(new THREE.ConeGeometry(r * 0.95, 5.8, 12, 1, true), mats.plume);
    pl.rotation.x = Math.PI / 2;
    pl.position.set(x, 0.05, 8.9);
    g.add(pl);
    plumes.push(pl);
  });

  g.scale.setScalar(scale);
  return { group: g, plumes };
}

// === SHIP CLASS 2: TWIN-BOOM COLONY CARRIER / FRIGATE (Nebulon / Mon-Calamari Industrial Sci-Fi Silhouette!) ===
function createColonyFrigate(mats, scale = 1.0) {
  const g = new THREE.Group();

  // Central spine + twin armored forward cargo booms
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.75, 6.2), mats.armorMid);
  g.add(spine);

  [-0.95, 0.95].forEach((x) => {
    const boom = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.65, 4.4), mats.armorLight);
    boom.position.set(x, 0.05, -0.9);
    g.add(boom);
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 2.2, 10), mats.dark);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(x, -0.42, 0.2);
    g.add(pod);
  });

  // Glowing golden command bridge bar
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.42, 1.1), mats.armorLight);
  bridge.position.set(0, 0.58, -1.6);
  g.add(bridge);
  const win = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.14, 1.14), mats.warmWin);
  win.position.set(0, 0.60, -1.62);
  g.add(win);

  // 3 Aft Ion Thrusters
  const plumes = [];
  [-0.65, 0, 0.65].forEach((x) => {
    const pl = new THREE.Mesh(new THREE.ConeGeometry(0.30, 4.0, 10, 1, true), mats.plume);
    pl.rotation.x = Math.PI / 2;
    pl.position.set(x, 0, 5.1);
    g.add(pl);
    plumes.push(pl);
  });

  g.scale.setScalar(scale);
  return { group: g, plumes };
}

// === SHIP CLASS 3: SLEEK STARSHIP ESCORT ===
function createStarshipEscort(mats, scale = 1.0) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 3.4, 16), mats.armorLight);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.7, 16), mats.armorLight);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -2.55;
  g.add(nose);
  [-0.58, 0.58].forEach((x) => {
    const aft = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 1.15), mats.dark);
    aft.position.set(x * 1.1, 0, 1.1);
    g.add(aft);
  });
  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.36, 4.2, 12, 1, true), mats.plume);
  plume.rotation.x = Math.PI / 2;
  plume.position.z = 3.8;
  g.add(plume);
  g.scale.setScalar(scale);
  return { group: g, plumes: [plume] };
}

// === SHIP CLASS 4: AGILE DELTA-WING INTERCEPTOR FIGHTER (X-Wing / V-Wing Micro-Squadrons for Epic Scale Contrast!) ===
function createInterceptorFighter(mats) {
  const g = new THREE.Group();
  const fuselage = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.25, 6), mats.armorLight);
  fuselage.rotation.x = -Math.PI / 2;
  g.add(fuselage);
  // Iconic swept X-foil wings
  const wingA = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.03, 0.36), mats.armorMid);
  wingA.rotation.z = 0.24;
  wingA.position.z = 0.15;
  g.add(wingA);
  const wingB = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.03, 0.36), mats.armorMid);
  wingB.rotation.z = -0.24;
  wingB.position.z = 0.15;
  g.add(wingB);
  // Twin tiny glowing ion trails!
  const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.01, 4.5, 6, 1, true), mats.fighterTrail);
  trail.rotation.x = Math.PI / 2;
  trail.position.z = 2.85;
  g.add(trail);
  return g;
}

// S17: Star-Wars-Scale 48-Vessel Interstellar Armada Departure ("星图展开 · 迷雾全散开 · 舰队启航", 139.4 - 147.4s)
export function buildCleanFleetScene() {
  const scene = new THREE.Scene();
  const rand = mulberry32(17777);
  scene.add(buildStarfield(3000, 480, 17777));

  const sunDir = new THREE.Vector3(0.72, 0.42, 0.55).normalize();

  // === 1. RECEDING CRESCENT MARS IN LOWER-LEFT DEEP BACKGROUND ===
  const marsPos = new THREE.Vector3(-42, -22, -74);
  const mars = new THREE.Mesh(
    new THREE.SphereGeometry(24, 56, 42),
    createCelMaterial({ color: 0xc25d40, shadowColor: 0x1b0f26, rimStrength: 0.55, rimColor: 0xffb370, receiveShadow: false })
  );
  mars.position.copy(marsPos);
  scene.add(mars);
  const marsAtmo = new THREE.Mesh(new THREE.SphereGeometry(24.8, 56, 42), createCrescentAtmoMaterial(sunDir));
  marsAtmo.position.copy(marsPos);
  scene.add(marsAtmo);

  // === 2. COLOSSAL UNFOLDING 3D HOLOGRAPHIC STAR-CHART AHEAD OF THE ARMADA ("星图展开") ===
  const starChartGroup = new THREE.Group();
  starChartGroup.position.set(4.0, 4.0, -76.0);
  starChartGroup.rotation.set(0.14, -0.10, 0.06);
  scene.add(starChartGroup);

  const scPos = [], scT = [], scRad = [];
  const maxChartR = 46.0;
  [10.0, 18.5, 27.5, 36.5, 46.0].forEach((r) => {
    const segs = 72, rn = r / maxChartR;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
      scPos.push(Math.cos(a0) * r, Math.sin(a0) * r, 0, Math.cos(a1) * r, Math.sin(a1) * r, 0);
      scT.push(i / segs, (i + 1) / segs);
      scRad.push(rn, rn);
    }
  });
  for (let m = 0; m < 12; m++) {
    const a = (m / 12) * Math.PI * 2;
    for (let s = 0; s < 16; s++) {
      const r0 = (s / 16) * maxChartR, r1 = ((s + 1) / 16) * maxChartR;
      scPos.push(Math.cos(a) * r0, Math.sin(a) * r0, 0, Math.cos(a) * r1, Math.sin(a) * r1, 0);
      scT.push(s / 16, (s + 1) / 16);
      scRad.push(r0 / maxChartR, r1 / maxChartR);
    }
  }
  const scGeo = new THREE.BufferGeometry();
  scGeo.setAttribute("position", new THREE.Float32BufferAttribute(scPos, 3));
  scGeo.setAttribute("aT", new THREE.Float32BufferAttribute(scT, 1));
  scGeo.setAttribute("aRadius", new THREE.Float32BufferAttribute(scRad, 1));
  const starChartMat = createStarChartLineMaterial(0x48c8ff, 0xffe082);
  starChartGroup.add(new THREE.LineSegments(scGeo, starChartMat));

  const wpGoldMat = createCelMaterial({ color: 0xffe89e, emissive: 0xffbe3b, emissiveStrength: 3.0, unlit: true, noInk: true });
  const wpCyanMat = createCelMaterial({ color: 0xa6f6ff, emissive: 0x42dcff, emissiveStrength: 2.8, unlit: true, noInk: true });
  const wpGeo = new THREE.OctahedronGeometry(0.62, 0);
  const waypoints = [];
  for (let i = 0; i < 16; i++) {
    const r = 8.0 + (i / 16) * 36.0;
    const a = i * 1.85 + 0.4;
    const m = new THREE.Mesh(wpGeo, i % 3 === 0 ? wpCyanMat : wpGoldMat);
    m.position.set(Math.cos(a) * r, Math.sin(a) * r, (rand() - 0.5) * 5.0);
    m.scale.setScalar(0.001);
    starChartGroup.add(m);
    waypoints.push({ mesh: m, rn: r / maxChartR });
  }

  // === 3. STAR-WARS-SCALE 48-VESSEL MULTI-CLASS INTERSTELLAR ARMADA ===
  const mats = {
    armorLight: createCelMaterial({ color: 0xdde4ee, shadowColor: 0x424b68, patternMode: 2, patternScale: new THREE.Vector2(10, 14), rimStrength: 0.55, rimColor: 0x9cf2ff }),
    armorMid: createCelMaterial({ color: 0x9aa6bc, shadowColor: 0x2c334c, patternMode: 2, patternScale: new THREE.Vector2(8, 8), rimStrength: 0.45, rimColor: 0xffd280 }),
    dark: createCelMaterial({ color: 0x222738, shadowColor: 0x0e111d, rimStrength: 0.35, rimColor: 0x70dcff }),
    warmWin: createCelMaterial({ color: 0xffe8a6, emissive: 0xffbe42, emissiveStrength: 2.4, unlit: true, noInk: true }),
    cyanCore: createCelMaterial({ color: 0xa6f6ff, emissive: 0x38d2ff, emissiveStrength: 2.8, unlit: true, noInk: true }),
    plume: createCelMaterial({
      color: 0xa6f6ff, emissive: 0x26c6ff, emissiveStrength: 2.8,
      unlit: true, noInk: true, transparent: true, opacity: 0.78,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    }),
    fighterTrail: createCelMaterial({
      color: 0xffe49e, emissive: 0xff9f30, emissiveStrength: 2.4,
      unlit: true, noInk: true, transparent: true, opacity: 0.65,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    })
  };

  const fleetGroup = new THREE.Group();
  scene.add(fleetGroup);

  const allPlumes = [];

  // A. CENTER COMMAND FLAGSHIP: Colossal StarArk Centrifuge Mothership (scaled up heroically!)
  const flagship = buildStarArkShip();
  flagship.scale.setScalar(1.35);
  flagship.rotation.y = Math.PI / 2; // Nose forward along -Z
  flagship.position.set(0, 1.5, -2.0);
  fleetGroup.add(flagship);

  // B. 4 COLOSSAL STAR-WARS-STYLE WEDGE CAPITAL CRUISERS flanking left, right, upper-rear & deep-front!
  const capitalConfigs = [
    { pos: new THREE.Vector3(-12.5, 4.8, -10.5), sc: 1.35 },
    { pos: new THREE.Vector3(13.5, 3.2, -13.0), sc: 1.25 },
    { pos: new THREE.Vector3(-22.0, -3.5, -26.0), sc: 1.05 },
    { pos: new THREE.Vector3(24.0, 9.5, -30.0), sc: 1.00 }
  ];
  const capitals = capitalConfigs.map((cfg, idx) => {
    const c = createCapitalWedgeCruiser(mats, cfg.sc);
    c.group.position.copy(cfg.pos);
    fleetGroup.add(c.group);
    allPlumes.push(...c.plumes);
    return { ...c, base: cfg.pos, ph: idx * 1.7 };
  });

  // C. 6 HEAVY COLONY FRIGATES staggered at multiple altitudes & depths
  const frigateConfigs = [
    { pos: new THREE.Vector3(-6.5, -2.8, 3.5), sc: 0.95 },
    { pos: new THREE.Vector3(7.4, -1.6, 2.0), sc: 0.92 },
    { pos: new THREE.Vector3(-16.5, 8.2, -4.0), sc: 0.85 },
    { pos: new THREE.Vector3(16.0, -5.2, -18.5), sc: 0.82 },
    { pos: new THREE.Vector3(2.5, 9.8, -22.0), sc: 0.80 },
    { pos: new THREE.Vector3(-9.0, -7.2, -24.0), sc: 0.78 }
  ];
  const frigates = frigateConfigs.map((cfg, idx) => {
    const f = createColonyFrigate(mats, cfg.sc);
    f.group.position.copy(cfg.pos);
    fleetGroup.add(f.group);
    allPlumes.push(...f.plumes);
    return { ...f, base: cfg.pos, ph: idx * 1.3 };
  });

  // D. 7 STARSHIP ESCORTS woven throughout the armada
  const escortConfigs = [
    { pos: new THREE.Vector3(-3.8, 4.2, 6.2), sc: 0.72 },
    { pos: new THREE.Vector3(4.4, 3.6, 5.5), sc: 0.72 },
    { pos: new THREE.Vector3(-11.0, 0.5, 8.8), sc: 0.65 },
    { pos: new THREE.Vector3(11.5, 6.5, 4.0), sc: 0.65 },
    { pos: new THREE.Vector3(-4.5, -5.8, -12.0), sc: 0.62 },
    { pos: new THREE.Vector3(19.5, 1.5, -6.5), sc: 0.60 },
    { pos: new THREE.Vector3(-19.5, 3.0, -16.0), sc: 0.58 }
  ];
  const escorts = escortConfigs.map((cfg, idx) => {
    const e = createStarshipEscort(mats, cfg.sc);
    e.group.position.copy(cfg.pos);
    fleetGroup.add(e.group);
    allPlumes.push(...e.plumes);
    return { ...e, base: cfg.pos, ph: idx * 1.1 };
  });

  // E. 30 AGILE X-FOIL INTERCEPTOR FIGHTERS weaving in 3-ship squadrons right past the colossal capital hulls!
  const fighters = [];
  for (let i = 0; i < 30; i++) {
    const squad = Math.floor(i / 3);
    const wingPos = i % 3; // 0 = lead, 1 = left wingman, 2 = right wingman
    const f = createInterceptorFighter(mats);
    const sc = 0.55 + (squad % 3) * 0.14;
    f.scale.setScalar(sc);
    fleetGroup.add(f);

    const sx = (rand() - 0.5) * 32.0;
    const sy = -4.0 + rand() * 14.0;
    const sz = 16.0 - squad * 4.5 + (wingPos === 0 ? 0 : 1.4);
    const wx = wingPos === 0 ? 0 : wingPos === 1 ? -1.35 : 1.35;
    const wy = wingPos === 0 ? 0 : -0.35;
    fighters.push({
      mesh: f,
      baseX: sx + wx,
      baseY: sy + wy,
      baseZ: sz,
      speed: 2.2 + (squad % 4) * 0.85,
      bank: (rand() - 0.5) * 0.55,
      ph: squad * 1.9 + wingPos * 0.4
    });
  }

  // === 4. PHYSICAL PARTING COSMIC FOG CURTAINS + GOLDEN DAWN GOD-RAYS ("迷雾全散开") ===
  // Paired left & right billowing fog banks that genuinely shroud the armada, then physically sweep apart!
  const fogLayers = [
    { z: -12.0, x0: -9.0, dir: -1, w: 58, h: 42, tint: 0x382868, seed: 1.2 },
    { z: -12.5, x0: 9.0, dir: 1, w: 58, h: 42, tint: 0x263f78, seed: 2.5 },
    { z: -26.0, x0: -14.0, dir: -1, w: 86, h: 58, tint: 0x4c2e76, seed: 3.7 },
    { z: -26.5, x0: 14.0, dir: 1, w: 86, h: 58, tint: 0x2a4b88, seed: 5.1 },
    { z: -44.0, x0: 0.0, dir: 0, w: 138, h: 82, tint: 0x583672, seed: 6.4 }
  ].map((cfg) => {
    const mat = createPartingCosmicFogMaterial(cfg.tint, cfg.seed);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cfg.w, cfg.h), mat);
    mesh.position.set(cfg.x0, 2.0, cfg.z);
    scene.add(mesh);
    return { mesh, mat, x0: cfg.x0, dir: cfg.dir, z0: cfg.z };
  });

  // Golden Cosmic Dawn God-Rays bursting straight through the clearing mist!
  const dawnMat = createDawnGodRaysMaterial();
  const dawnRays = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), dawnMat);
  dawnRays.position.set(4.0, 4.0, -84.0);
  scene.add(dawnRays);

  // Luminous Golden Clearing Shockwave Ring pulsing outward from the Flagship's prow as the mist parts!
  const clearWaveMat = createCelMaterial({
    color: 0xffe89e, emissive: 0xffc048, emissiveStrength: 3.0,
    unlit: true, noInk: true, transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
  });
  const clearWaveRing = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.0, 64), clearWaveMat);
  clearWaveRing.position.set(0, 1.5, -18.0);
  scene.add(clearWaveRing);

  // === 5. SUBTLE RELATIVISTIC STAR-STREAKS ===
  const streakGeo = new THREE.CylinderGeometry(0.018, 0.008, 6.2, 5);
  streakGeo.rotateX(Math.PI / 2);
  const streakMat = createCelMaterial({
    color: 0xd8f4ff, emissive: 0x7ce6ff, emissiveStrength: 2.2,
    unlit: true, noInk: true, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const streaks = [];
  for (let i = 0; i < 48; i++) {
    const a = rand() * Math.PI * 2;
    const r = 6.0 + rand() * 18.0;
    const m = new THREE.Mesh(streakGeo, streakMat);
    scene.add(m);
    streaks.push({ mesh: m, x: Math.cos(a) * r, y: Math.sin(a) * r, speed: 26.0 + rand() * 24.0, offset: rand() * 80.0 });
  }

  return {
    scene,
    update(submode, u, time, camera, audio) {
      // Support both submode ("unfold_fleet" / "mist_clear") and legacy direct call
      if (typeof submode === "number") {
        audio = camera; camera = time; time = u; u = submode; submode = "unfold_fleet";
      }
      const bass = audio ? audio.bass : 0;
      const isMistClear = submode === "mist_clear";
      // Continuous local clock across S17A (0..3.6s) + S17B (3.6..8.0s)
      const localT = isMistClear ? (3.6 + u * 4.4) : (u * 3.6);
      const totalU = clamp(localT / 8.0, 0, 1);

      // 1. Star-Chart unfolds across S17A ("星图展开"), stays gleaming & crisp in S17B!
      const unfoldU = isMistClear ? 1.0 : smoothstep(0.05, 0.92, u);
      starChartMat.uniforms.uTime.value = localT;
      starChartMat.uniforms.uUnfold.value = unfoldU;
      starChartGroup.rotation.z = 0.06 + localT * 0.015;
      waypoints.forEach((wp) => {
        const lit = smoothstep(wp.rn - 0.08, wp.rn + 0.12, unfoldU * 1.25);
        wp.mesh.visible = lit > 0.01;
        wp.mesh.scale.setScalar(lit * (0.85 + bass * 0.35));
      });

      // 2. Cosmic Fog Banks (100% seamless handoff at 02:23.0!):
      // - S17A: Looming dense cosmic mist ahead of the armada (partU = 0.04)
      // - S17B ("迷雾全散开"): Smoothly starts at partU = 0.04 and PHYSICALLY SWEEPS APART left & right revealing blazing golden cosmic dawn!
      const partU = isMistClear ? (0.04 + smoothstep(0.08, 0.84, u) * 0.96) : 0.04;
      fogLayers.forEach((fl, idx) => {
        fl.mat.uniforms.uTime.value = localT;
        fl.mat.uniforms.uParting.value = clamp(partU * 1.18 - idx * 0.04, 0.0, 1.0);
        const slideU = isMistClear ? smoothstep(0.08, 0.84, u) : 0.0;
        fl.mesh.position.x = fl.x0 + fl.dir * Math.pow(slideU, 1.2) * 34.0;
        fl.mesh.position.z = fl.z0 + (isMistClear ? u * 14.0 : 0.0);
        fl.mesh.visible = fl.mat.uniforms.uParting.value < 0.99;
      });

      // Golden Dawn God-Rays + Clearing Shockwave Ring burst smoothly through the opening gap in S17B!
      const dawnIntensity = isMistClear
        ? (0.08 + smoothstep(0.10, 0.72, u) * 0.92) * (1.0 - smoothstep(0.88, 1.0, u) * 0.20)
        : 0.08;
      dawnRays.visible = dawnIntensity > 0.01;
      dawnMat.uniforms.uTime.value = localT;
      dawnMat.uniforms.uIntensity.value = dawnIntensity * (0.95 + bass * 0.25);

      const waveU = isMistClear ? clamp((u - 0.12) / 0.55, 0, 1) : 0;
      clearWaveRing.visible = isMistClear && waveU > 0.005 && waveU < 0.99;
      if (clearWaveRing.visible) {
        clearWaveRing.position.set(0, 1.6, fleetGroup.position.z - 8.0 - waveU * 22.0);
        clearWaveRing.scale.setScalar(2.0 + Math.pow(waveU, 0.7) * 58.0);
        clearWaveMat.uniforms.uOpacity.value = Math.sin(waveU * Math.PI) * 0.85;
      }

      // 3. Monumental 48-Vessel Armada advances smoothly forward!
      flagship.userData.habRing.rotation.x = localT * 1.1;
      flagship.userData.coreOrb.rotation.y = localT * 1.8;
      flagship.userData.plumes.forEach((p) => {
        p.scale.set(1.0 + bass * 0.2, 1.0 + totalU * 0.85 + bass * 0.45, 1.0 + bass * 0.2);
      });

      fleetGroup.position.set(0, -0.5 + totalU * 0.9, 4.0 - totalU * 22.0);

      capitals.forEach((c) => {
        c.group.position.y = c.base.y + Math.sin(localT * 0.6 + c.ph) * 0.18;
      });
      frigates.forEach((f) => {
        f.group.position.y = f.base.y + Math.sin(localT * 0.85 + f.ph) * 0.22;
      });
      escorts.forEach((e) => {
        e.group.position.y = e.base.y + Math.sin(localT * 1.1 + e.ph) * 0.24;
      });

      const plumeLen = 0.85 + totalU * 0.85 + bass * 0.38;
      for (let i = 0; i < allPlumes.length; i++) {
        allPlumes[i].scale.set(1.0 + bass * 0.15, 1.0, plumeLen);
      }

      for (let i = 0; i < fighters.length; i++) {
        const ft = fighters[i];
        ft.mesh.position.set(
          ft.baseX + Math.sin(localT * 0.9 + ft.ph) * 1.2,
          ft.baseY + Math.cos(localT * 0.7 + ft.ph) * 0.65,
          ft.baseZ - localT * ft.speed
        );
        ft.mesh.rotation.z = ft.bank + Math.cos(localT * 0.9 + ft.ph) * 0.22;
      }

      // Relativistic star-streaks kick in cleanly as the mist parts in S17B!
      const streakVis = isMistClear ? smoothstep(0.18, 0.62, u) : 0.0;
      streakMat.uniforms.uOpacity.value = streakVis * 0.55;
      for (let i = 0; i < streaks.length; i++) {
        const st = streaks[i];
        st.mesh.visible = streakVis > 0.02;
        if (st.mesh.visible) {
          const z = -66.0 + ((localT * st.speed + st.offset) % 82.0);
          st.mesh.position.set(st.x, st.y, z);
        }
      }

      // 4. 100% Seamless One-Take Camera across S17A -> S17B (exact position, lookAt & FOV match at 02:23.0!):
      const fx = fleetGroup.position.x;
      const fy = fleetGroup.position.y;
      const fz = fleetGroup.position.z;
      if (!isMistClear) {
        const sA = smoothstep(0.0, 1.0, u);
        camera.fov = 44 + sA * 4; // 44 -> 48
        camera.position.set(8.8 - sA * 6.6, -2.2 + sA * 3.8, fz + 15.0 + sA * 2.0); // ends at (2.2, 1.6, fz + 17.0)
        camera.lookAt(fx + 1.0, fy + 1.6, fz - 22.0);
      } else {
        const sB = smoothstep(0.0, 1.0, u);
        camera.fov = 48 + Math.sin(sB * Math.PI) * 9; // starts seamlessly at 48!
        camera.position.set(
          2.2 - sB * 7.2,
          1.6 + sB * 4.4,
          fz + 17.0 - sB * 6.0
        );
        camera.lookAt(
          fx + 1.0 + sB * 0.4,
          fy + 1.6 + sB * 0.8,
          fz - 22.0 - sB * 14.0
        );
      }
      camera.updateProjectionMatrix();

      return { sunDir, clearColor: 0x050714, shadowBounds: null };
    }
  };
}
