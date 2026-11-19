import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { mulberry32 } from "../core/math.js";

const STAR_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform float uPixelRatio;
in vec3 position;
in float aSize;
in vec3 aColor;
out vec3 vColor;
void main() {
  vColor = aColor;
  vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPixelRatio;
}
`;

const STAR_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormalId;
in vec3 vColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r = length(p);
  float core = smoothstep(0.65, 0.08, r);
  float crossSpike = max(
    smoothstep(0.16, 0.0, abs(p.x)) * smoothstep(1.0, 0.0, abs(p.y)),
    smoothstep(0.16, 0.0, abs(p.y)) * smoothstep(1.0, 0.0, abs(p.x))
  );
  float a = max(core, crossSpike * 0.78);
  if (a < 0.05) discard;
  gColor = vec4(vColor * (0.88 + 0.55 * core), a);
  gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
}
`;

export function buildStarfield(count = 2400, radius = 440, seed = 2026) {
  const rand = mulberry32(seed);
  const pos = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const cols = new Float32Array(count * 3);
  const palette = [
    [1.0, 0.96, 0.88],
    [0.82, 0.92, 1.0],
    [1.0, 0.86, 0.68],
    [0.92, 0.95, 1.0]
  ];
  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1;
    const theta = rand() * Math.PI * 2;
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    const r = radius * (0.85 + 0.15 * rand());
    pos[i * 3] = r * s * Math.cos(theta);
    pos[i * 3 + 1] = r * u;
    pos[i * 3 + 2] = r * s * Math.sin(theta);
    const bright = rand();
    sizes[i] = bright > 0.96 ? 4.6 + rand() * 2.5 : 1.5 + Math.pow(bright, 2.0) * 2.5;
    const c = palette[Math.floor(rand() * palette.length)];
    const g = 0.55 + 0.78 * bright;
    cols[i * 3] = c[0] * g;
    cols[i * 3 + 1] = c[1] * g;
    cols[i * 3 + 2] = c[2] * g;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute("aColor", new THREE.BufferAttribute(cols, 3));

  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) } }
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

const ATMO_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
in vec3 position;
in vec3 normal;
out vec3 vWorldNormal;
out vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const ATMO_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormalId;
uniform vec3 cameraPosition;
uniform vec3 uSunDir;
uniform vec3 uGlowColor;
uniform float uIntensity;
in vec3 vWorldNormal;
in vec3 vWorldPos;
void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float rim = pow(clamp(1.0 + dot(N, V), 0.0, 1.0), 2.8);
  float sunWeight = smoothstep(-0.35, 0.55, dot(-N, uSunDir));
  vec3 col = mix(uGlowColor * 0.45, uGlowColor * 1.45 + vec3(0.25, 0.22, 0.12), sunWeight);
  float a = rim * uIntensity * (0.28 + 0.72 * sunWeight);
  gColor = vec4(col * a * 1.6, a);
  gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
}
`;

export function buildCelEarth(radius, opts = {}) {
  const group = new THREE.Group();
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 128, 96),
    createCelMaterial({
      color: 0xffffff,
      shadowColor: opts.nightSide ? 0x161c36 : 0x3b4875,
      patternMode: 5,
      colorEdges: true,
      rimStrength: 0.34,
      rimColor: 0x8fd6ff,
      castShadow: false,
      receiveShadow: false
    })
  );
  group.add(globe);

  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.036, 96, 64),
    new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: ATMO_VERT,
      fragmentShader: ATMO_FRAG,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uSunDir: globe.material.uniforms.uSunDir,
        uGlowColor: { value: new THREE.Color(opts.glowColor || 0x5dbdff) },
        uIntensity: { value: opts.atmoIntensity !== undefined ? opts.atmoIntensity : 1.25 }
      }
    })
  );
  group.add(atmo);
  group.userData.globe = globe;
  return group;
}

export function createJupiterTexture() {
  const cv = document.createElement("canvas");
  cv.width = 1024;
  cv.height = 512;
  const ctx = cv.getContext("2d");
  const bands = [
    [0.0, "#b89f86"], [0.12, "#dfd0b8"], [0.22, "#c27549"],
    [0.34, "#f0e3cc"], [0.46, "#b9653c"], [0.58, "#eadbc2"],
    [0.68, "#cc8658"], [0.80, "#dfd2bc"], [0.90, "#a9927c"]
  ];
  for (let y = 0; y < 512; y++) {
    const v = y / 512;
    let col = bands[0][1];
    for (let b = 0; b < bands.length; b++) {
      const wave = Math.sin(y * 0.06 + b) * 0.008;
      if (v + wave >= bands[b][0]) col = bands[b][1];
    }
    ctx.fillStyle = col;
    ctx.fillRect(0, y, 1024, 1);
  }
  const gx = 420, gy = 332;
  [
    [84, 48, "#e8d6bd"],
    [70, 38, "#cf643c"],
    [50, 26, "#b24328"],
    [28, 14, "#df7c52"]
  ].forEach(([rx, ry, c]) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(gx, gy, rx, ry, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a2520";
    ctx.lineWidth = 3;
    ctx.stroke();
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function createMarsGlobeTexture() {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 256;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#d4794a";
  ctx.fillRect(0, 0, 512, 256);
  const rand = mulberry32(19760720);
  for (let i = 0; i < 45; i++) {
    ctx.fillStyle = rand() > 0.5 ? "#b05632" : "#e39b6d";
    ctx.beginPath();
    ctx.ellipse(rand() * 512, 35 + rand() * 186, 20 + rand() * 65, 10 + rand() * 28, rand(), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#f5efe6";
  ctx.fillRect(0, 0, 512, 24);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function buildTrajectoryArc(points, radius = 0.045, color = 0xffca63) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, 180, radius, 8, false);
  const mat = createCelMaterial({
    color,
    emissive: color,
    emissiveStrength: 1.25,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.92
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.totalIndices = geo.index.count;
  mesh.userData.setProgress = (p) => {
    const clamped = Math.max(0, Math.min(1, p));
    const count = Math.floor((clamped * mesh.userData.totalIndices) / 3) * 3;
    geo.setDrawRange(0, count);
  };
  return mesh;
}

// Hero Deep-Space Interstellar Ark Vessel ("星航号")
export function buildStarArkShip() {
  const ship = new THREE.Group();

  const hullCream = createCelMaterial({
    color: 0xf4eee0,
    shadowColor: 0x676094,
    patternMode: 2,
    patternScale: new THREE.Vector2(8, 6),
    patternStrength: 0.85,
    rimStrength: 0.42
  });
  const hullSlate = createCelMaterial({
    color: 0x7b83a3,
    shadowColor: 0x3b3f66,
    patternMode: 2,
    patternScale: new THREE.Vector2(10, 4),
    patternStrength: 0.8
  });
  const goldTrim = createCelMaterial({ color: 0xe8b95c, shadowColor: 0x785a46, rimStrength: 0.5 });
  const warmWin = createCelMaterial({
    color: 0xffe6a6,
    emissive: 0xffc65c,
    emissiveStrength: 2.0,
    unlit: true
  });
  const coreCyan = createCelMaterial({
    color: 0x9cf2ff,
    emissive: 0x4ddbff,
    emissiveStrength: 2.6,
    unlit: true,
    noInk: true
  });

  // Forward Nose Cone + Needle Antenna
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.35, 16), hullCream);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 2.85;
  ship.add(nose);

  const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.035, 1.45, 8), goldTrim);
  needle.rotation.z = -Math.PI / 2;
  needle.position.x = 4.15;
  ship.add(needle);

  // Command Bridge Module with glowing amber viewport strip
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.56, 1.2, 16), hullCream.clone());
  bridge.rotation.z = -Math.PI / 2;
  bridge.position.x = 1.6;
  ship.add(bridge);

  const bridgeWin = new THREE.Mesh(new THREE.CylinderGeometry(0.505, 0.505, 0.16, 16), warmWin);
  bridgeWin.rotation.z = -Math.PI / 2;
  bridgeWin.position.x = 1.85;
  ship.add(bridgeWin);

  // Central Structural Truss Spine + 4 Diamond-Quilted Cryo Tanks
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 4.4, 12), hullSlate);
  spine.rotation.z = -Math.PI / 2;
  spine.position.x = -0.7;
  ship.add(spine);

  const tankMat = createCelMaterial({
    color: 0x9ab58a,
    shadowColor: 0x495b70,
    patternMode: 1,
    patternScale: new THREE.Vector2(10, 6),
    patternStrength: 0.95
  });
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.35, 8, 16), tankMat.clone());
    tank.rotation.z = Math.PI / 2;
    tank.position.set(-0.95, Math.cos(a) * 0.58, Math.sin(a) * 0.58);
    ship.add(tank);
  }

  // Rotating Centrifuge Habitat Ring + 4 Spokes + Lit Habitat Windows!
  const habRing = new THREE.Group();
  habRing.position.x = 0.55;
  ship.add(habRing);

  const torus = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.16, 12, 36), hullCream.clone());
  torus.rotation.y = Math.PI / 2;
  habRing.add(torus);

  const ringGlow = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.055, 8, 36), warmWin);
  ringGlow.rotation.y = Math.PI / 2;
  ringGlow.position.x = 0.13;
  habRing.add(ringGlow);

  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.10, 2.55, 0.10), goldTrim.clone());
    spoke.rotation.x = (i * Math.PI) / 4;
    habRing.add(spoke);
  }

  // Glowing "Consciousness Core" Beacon Sphere in mid-spine
  const coreOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 1), coreCyan);
  coreOrb.position.set(-2.35, 0, 0);
  ship.add(coreOrb);

  // Aft Fusion Drive Ring & 4 Engine Nozzles + Plume Cones
  const aftRing = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.88, 0.65, 20), hullSlate.clone());
  aftRing.rotation.z = -Math.PI / 2;
  aftRing.position.x = -2.95;
  ship.add(aftRing);

  const plumes = [];
  const plumeMat = createCelMaterial({
    color: 0xffd06e,
    emissive: 0xffb338,
    emissiveStrength: 3.0,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.88
  });

  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.30, 0.52, 16), goldTrim.clone());
    bell.rotation.z = Math.PI / 2;
    bell.position.set(-3.45, Math.cos(a) * 0.44, Math.sin(a) * 0.44);
    ship.add(bell);

    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.26, 2.6, 14), plumeMat);
    plume.rotation.z = Math.PI / 2;
    plume.position.set(-4.95, Math.cos(a) * 0.44, Math.sin(a) * 0.44);
    ship.add(plume);
    plumes.push(plume);
  }

  ship.userData.habRing = habRing;
  ship.userData.coreOrb = coreOrb;
  ship.userData.plumes = plumes;
  return ship;
}
