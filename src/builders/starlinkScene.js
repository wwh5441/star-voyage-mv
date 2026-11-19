import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { mulberry32, clamp, smoothstep } from "../core/math.js";
import { buildStarfield, buildStarArkShip } from "./cosmicPrimitives.js";

// High-detail procedural Martian planet texture matching S11B/S12/S13 + twilight city-light clusters of Mars Base Alpha!
function createMartianNetworkGlobeTexture() {
  const w = 1024, h = 512;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, "#d8c4b8");
  grad.addColorStop(0.10, "#b85c42");
  grad.addColorStop(0.32, "#9a4230");
  grad.addColorStop(0.55, "#c46444");
  grad.addColorStop(0.78, "#823328");
  grad.addColorStop(1.0, "#c8b4aa");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const rand = mulberry32(14149);

  // Broad dark basaltic plains & dusty plateaus
  for (let i = 0; i < 45; i++) {
    const x = rand() * w;
    const y = 50 + rand() * (h - 100);
    ctx.fillStyle = i % 2 === 0 ? "rgba(62, 22, 28, 0.28)" : "rgba(232, 152, 102, 0.20)";
    ctx.beginPath();
    ctx.ellipse(x, y, 40 + rand() * 130, 14 + rand() * 44, (rand() - 0.5) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Canyon scars
  ctx.lineCap = "round";
  for (let c = 0; c < 8; c++) {
    let cx = rand() * w;
    let cy = h * (0.25 + rand() * 0.5);
    ctx.strokeStyle = "rgba(52, 18, 24, 0.44)";
    ctx.lineWidth = 2.5 + rand() * 4.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    for (let s = 0; s < 6; s++) {
      cx += 25 + rand() * 35;
      cy += (rand() - 0.5) * 16;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  // Keep base planet dark-rust & pristine so the single Citadel spark -> wildfire expansion reads dramatically!
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

// Custom GLSL3 MRT Soft Fresnel Martian Atmosphere Rim (zero hard outer edge!)
function createMarsAtmosphereMaterial(sunDir) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    uniforms: {
      uSunDir: { value: sunDir.clone().normalize() }
    },
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
        float rim = pow(1.0 - ndv, 3.2) * smoothstep(0.0, 0.18, ndv);
        float sunWrap = smoothstep(-0.35, 0.65, dot(N, normalize(uSunDir)));
        vec3 col = mix(vec3(0.95, 0.44, 0.28), vec3(1.0, 0.78, 0.48), pow(1.0 - ndv, 1.8));
        float a = clamp(rim * (0.35 + 0.85 * sunWrap) * 1.25, 0.0, 1.0);
        gColor = vec4(col * a * 1.2, a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Custom GLSL3 MRT Soft Feathered Volumetric Downlink Coverage Cone (zero hard solid triangles!)
function createDownlinkConeMaterial(tintHex = 0x52e0ff) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.0 },
      uColor: { value: new THREE.Color(tintHex) }
    },
    vertexShader: `
      precision highp float;
      in vec3 position;
      in vec2 uv;
      in vec3 normal;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      out vec2 vUv;
      out float vEdge;
      void main() {
        vUv = uv;
        vec3 nView = normalize(mat3(modelViewMatrix) * normal);
        vEdge = abs(nView.z);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uColor;
      in vec2 vUv;
      in float vEdge;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        // vUv.y: 1 = satellite apex, 0 = ground footprint
        float along = smoothstep(0.0, 0.22, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
        float scan = 0.72 + 0.28 * sin(vUv.y * 24.0 + uTime * 7.5);
        float soft = pow(vEdge, 1.35);
        float a = along * soft * scan * uOpacity;
        gColor = vec4(uColor * a * 1.3, a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Custom GLSL3 MRT Flowing Optical Laser Line Shader (used for inter-satellite mesh + orbital tracks + deep-space relay!)
function createOpticalPulseLineMaterial(baseHex, pulseHex, baseAlpha = 0.22) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uAlpha: { value: baseAlpha },
      uBaseColor: { value: new THREE.Color(baseHex) },
      uPulseColor: { value: new THREE.Color(pulseHex) }
    },
    vertexShader: `
      precision highp float;
      in vec3 position;
      in float aT;
      in float aSeed;
      in float aActive;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      out float vT;
      out float vSeed;
      out float vActive;
      void main() {
        vT = aT;
        vSeed = aSeed;
        vActive = aActive;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uAlpha;
      uniform vec3 uBaseColor;
      uniform vec3 uPulseColor;
      in float vT;
      in float vSeed;
      in float vActive;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        float packet = pow(0.5 + 0.5 * sin(vT * 12.566 - uTime * 6.5 + vSeed), 6.0);
        vec3 col = mix(uBaseColor, uPulseColor, packet * 0.85);
        float a = (uAlpha + packet * 0.72) * vActive;
        gColor = vec4(col * (1.0 + packet * 1.4), clamp(a, 0.0, 1.0));
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Custom GLSL3 MRT Deep-Space Optical Relay Beam Shader (pierces from orbiting StarArk straight into the distant starfield!)
function createDeepSpaceBeamMaterial() {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uPower: { value: 0.0 }
    },
    vertexShader: `
      precision highp float;
      in vec3 position;
      in vec2 uv;
      in vec3 normal;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      out vec2 vUv;
      out float vCore;
      void main() {
        vUv = uv;
        vec3 nView = normalize(mat3(modelViewMatrix) * normal);
        vCore = abs(nView.z);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uPower;
      in vec2 vUv;
      in float vCore;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        // vUv.y: 0 = StarArk emitter, 1 = deep space infinity
        float pulse = pow(0.5 + 0.5 * sin(vUv.y * 28.0 - uTime * 18.0), 4.0);
        float fade = smoothstep(0.0, 0.04, vUv.y) * pow(1.0 - vUv.y, 0.75);
        float core = pow(vCore, 1.8);
        vec3 col = mix(vec3(0.32, 0.86, 1.0), vec3(1.0, 0.96, 0.82), core * 0.7 + pulse * 0.45);
        float a = clamp(fade * (core * 0.85 + 0.15) * (0.75 + pulse * 0.65) * uPower, 0.0, 1.0);
        gColor = vec4(col * (1.25 + pulse * 1.35) * a, a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Sleek, jewel-like precision Mars-Starlink Optical Relay Satellite (NO bulky LEGO boxes!)
function createPrecisionRelaySat(bodyMat, wingMat, beaconMat) {
  const sat = new THREE.Group();
  const bus = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.24), bodyMat);
  sat.add(bus);
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.95), wingMat);
  wingL.position.set(0, 0.04, 0.58);
  sat.add(wingL);
  const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.95), wingMat);
  wingR.position.set(0, 0.04, -0.58);
  sat.add(wingR);
  const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), beaconMat);
  beacon.position.y = -0.06;
  sat.add(beacon);
  return sat;
}

export function buildStarlinkScene() {
  const scene = new THREE.Scene();
  scene.add(buildStarfield(2400, 420, 14141));

  const sunDir = new THREE.Vector3(-0.72, 0.48, 0.50).normalize();

  // === 1. THE RIGHT PLANET: OUR NEW RED-RUST ROCKY WORLD (100% consistent with S11B / S12 / S13!) ===
  const marsRadius = 26.0;
  const marsCenter = new THREE.Vector3(0, -23.4, -9.0);

  const marsWorld = new THREE.Mesh(
    new THREE.SphereGeometry(marsRadius, 64, 48),
    createCelMaterial({
      color: 0xffffff,
      shadowColor: 0x1d1129,
      map: createMartianNetworkGlobeTexture(),
      colorEdges: true,
      rimStrength: 0.45,
      rimColor: 0xffa672,
      receiveShadow: false
    })
  );
  marsWorld.position.copy(marsCenter);
  scene.add(marsWorld);

  // Soft GLSL3 Fresnel Martian Atmospheric Limb
  const atmoShell = new THREE.Mesh(
    new THREE.SphereGeometry(marsRadius * 1.032, 64, 48),
    createMarsAtmosphereMaterial(sunDir)
  );
  atmoShell.position.copy(marsCenter);
  scene.add(atmoShell);

  // === 2. MARTIAN CITADEL GROUND HUB (荒原建城邦 — glowing amber colony & central uplink spire!) ===
  const citadelPos = marsCenter.clone().add(new THREE.Vector3(-2.4, marsRadius - 0.1, 2.2));
  // Snap strictly onto the planetary surface
  const citadelNormal = citadelPos.clone().sub(marsCenter).normalize();
  citadelPos.copy(marsCenter).addScaledVector(citadelNormal, marsRadius + 0.06);

  const citadelGroup = new THREE.Group();
  citadelGroup.position.copy(citadelPos);
  citadelGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), citadelNormal);
  scene.add(citadelGroup);

  const goldBeaconMat = createCelMaterial({
    color: 0xffe89e,
    emissive: 0xffb330,
    emissiveStrength: 3.0,
    unlit: true,
    noInk: true
  });
  const cyanBeaconMat = createCelMaterial({
    color: 0xa6f6ff,
    emissive: 0x3ad4ff,
    emissiveStrength: 3.0,
    unlit: true,
    noInk: true
  });

  // Glowing golden dome cluster of Mars Base Alpha
  const mainDome = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), goldBeaconMat);
  citadelGroup.add(mainDome);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const sub = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), goldBeaconMat);
    sub.position.set(Math.cos(a) * 0.68, 0, Math.sin(a) * 0.68);
    citadelGroup.add(sub);
  }

  // Expanding concentric surface coverage ripples on the Martian surface around the Citadel & ground hubs!
  const rippleMatGold = createCelMaterial({
    color: 0xffd87a, emissive: 0xffaa30, emissiveStrength: 2.2,
    unlit: true, noInk: true, transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
  });
  const rippleMatCyan = createCelMaterial({
    color: 0x80f2ff, emissive: 0x26d0ff, emissiveStrength: 2.2,
    unlit: true, noInk: true, transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
  });

  // 5 Ground Coverage Ripple Anchors (move dynamically to the exact sub-satellite nadir point -> ZERO crooked beam angles!)
  const groundHubs = [0, 1, 2, 3, 4].map((idx) => {
    const hubGroup = new THREE.Group();
    scene.add(hubGroup);

    const rMat = (idx % 2 === 0 ? rippleMatGold : rippleMatCyan).clone();
    const ringA = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.92, 40), rMat);
    ringA.rotation.x = -Math.PI / 2;
    hubGroup.add(ringA);
    const ringB = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.88, 40), rMat.clone());
    ringB.rotation.x = -Math.PI / 2;
    hubGroup.add(ringB);
    return { hubGroup, pos: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0), ringA, ringB, delay: idx * 0.10 };
  });

  // === 2B. "星火在这膨胀" (u = 0.46 -> 1.0): Surface Ignition Wave + 52 Domino Colony Sparks + Curved Surface Light-Vein Highways! ===
  // Spherical-cap golden ignition wave ring that hugs Mars's exact curvature as it sweeps outward from Mars Base Alpha!
  const waveRingMat = createCelMaterial({
    color: 0xffe89e,
    emissive: 0xffb830,
    emissiveStrength: 3.2,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const waveRing = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.04, 72), waveRingMat);
  waveRing.rotation.x = -Math.PI / 2;
  const wavePivot = new THREE.Group();
  wavePivot.position.copy(marsCenter);
  wavePivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), citadelNormal);
  wavePivot.add(waveRing);
  scene.add(wavePivot);

  // 52 Martian Colony Sparks scattered across the visible upper hemisphere, ordered by angular distance from Citadel!
  const sparkRand = mulberry32(14520);
  const sparkGeo = new THREE.SphereGeometry(0.18, 10, 8);
  const sparkHaloGeo = new THREE.RingGeometry(0.22, 0.46, 20);
  const sparkHaloMat = createCelMaterial({
    color: 0xffcf6e, emissive: 0xff9f1c, emissiveStrength: 2.2,
    unlit: true, noInk: true, transparent: true, opacity: 0.65,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
  });
  const colonySparks = [];
  // Tangent basis around citadelNormal so we can place sparks cleanly on the curved Martian cap
  const tRight = new THREE.Vector3(1, 0, 0).cross(citadelNormal).normalize();
  const tFwd = new THREE.Vector3().crossVectors(citadelNormal, tRight).normalize();

  for (let i = 0; i < 52; i++) {
    // Spread from theta = 0.07 rad (near Citadel) out to 0.68 rad (across the entire visible curved Martian horizon!)
    const theta = 0.07 + Math.pow(sparkRand(), 0.78) * 0.62;
    const phi = sparkRand() * Math.PI * 2;
    const sinT = Math.sin(theta), cosT = Math.cos(theta);
    const n = citadelNormal.clone().multiplyScalar(cosT)
      .addScaledVector(tRight, sinT * Math.cos(phi))
      .addScaledVector(tFwd, sinT * Math.sin(phi))
      .normalize();
    // Keep on the visible camera-facing upper hemisphere
    if (n.y < 0.45) n.y = 0.55 + sparkRand() * 0.35;
    n.normalize();
    const angDist = Math.acos(clamp(n.dot(citadelNormal), -1, 1));
    const p = marsCenter.clone().addScaledVector(n, marsRadius + 0.12);

    const g = new THREE.Group();
    g.position.copy(p);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    const core = new THREE.Mesh(sparkGeo, i % 5 === 0 ? cyanBeaconMat : goldBeaconMat);
    const sz = 0.65 + sparkRand() * 1.15;
    core.scale.setScalar(sz);
    g.add(core);
    const halo = new THREE.Mesh(sparkHaloGeo, sparkHaloMat);
    halo.rotation.x = -Math.PI / 2;
    halo.scale.setScalar(sz * 1.2);
    g.add(halo);
    g.scale.setScalar(0.001);
    g.visible = false;
    scene.add(g);
    colonySparks.push({ group: g, normal: n, pos: p, angDist, targetScale: sz });
  }
  colonySparks.sort((a, b) => a.angDist - b.angDist);

  // Curved Geodesic Surface Light-Vein Highways connecting each colony spark to its nearest earlier-ignited neighbor!
  const veinPos = [];
  const veinT = [];
  const veinSeed = [];
  const veinAngDist = []; // Activation threshold per vertex
  const SEGS_PER_VEIN = 8;
  for (let i = 0; i < colonySparks.length; i++) {
    const cur = colonySparks[i];
    // Connect to Citadel for the innermost 6 sparks, otherwise to nearest closer spark!
    let parentN = citadelNormal;
    if (i >= 6) {
      let bestD = 1e9;
      for (let j = 0; j < i; j++) {
        const d = cur.pos.distanceToSquared(colonySparks[j].pos);
        if (d < bestD) { bestD = d; parentN = colonySparks[j].normal; }
      }
    }
    for (let s = 0; s < SEGS_PER_VEIN; s++) {
      const f0 = s / SEGS_PER_VEIN;
      const f1 = (s + 1) / SEGS_PER_VEIN;
      const n0 = parentN.clone().lerp(cur.normal, f0).normalize();
      const n1 = parentN.clone().lerp(cur.normal, f1).normalize();
      const p0 = marsCenter.clone().addScaledVector(n0, marsRadius + 0.14);
      const p1 = marsCenter.clone().addScaledVector(n1, marsRadius + 0.14);
      veinPos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
      veinT.push(f0, f1);
      veinSeed.push(i * 0.9, i * 0.9);
      veinAngDist.push(cur.angDist, cur.angDist);
    }
  }
  const veinActiveArr = new Float32Array(veinAngDist.length);
  const veinGeo = new THREE.BufferGeometry();
  veinGeo.setAttribute("position", new THREE.Float32BufferAttribute(veinPos, 3));
  veinGeo.setAttribute("aT", new THREE.Float32BufferAttribute(veinT, 1));
  veinGeo.setAttribute("aSeed", new THREE.Float32BufferAttribute(veinSeed, 1));
  veinGeo.setAttribute("aActive", new THREE.BufferAttribute(veinActiveArr, 1));
  const surfaceVeinMat = createOpticalPulseLineMaterial(0xffb840, 0xfff0b8, 0.52);
  const surfaceVeins = new THREE.LineSegments(veinGeo, surfaceVeinMat);
  scene.add(surfaceVeins);

  // === 3. LAYER 1: SLEEK ORBITAL CONSTELLATION (36 Precision Satellites + 84 Expanding Orbital Spark Nodes) ===
  const satBodyMat = createCelMaterial({ color: 0xe6edf6, shadowColor: 0x454e6b, rimStrength: 0.55, rimColor: 0xffd275 });
  const satWingMat = createCelMaterial({ color: 0x1c4a82, shadowColor: 0x0b1f3d, rimStrength: 0.65, rimColor: 0x7ce6ff });

  const shells = [
    { rotX: 0.22, rotY: 0.12, r: marsRadius + 3.4, count: 14, speed: 0.13, isCyan: false },
    { rotX: -0.28, rotY: -0.30, r: marsRadius + 5.0, count: 12, speed: 0.10, isCyan: true },
    { rotX: -0.14, rotY: 0.44, r: marsRadius + 6.6, count: 10, speed: 0.08, isCyan: false }
  ];

  const allSats = [];
  const shellGroups = [];
  const orbitTrackCurves = [];

  shells.forEach((sh, sIdx) => {
    const sg = new THREE.Group();
    sg.position.copy(marsCenter);
    sg.rotation.set(sh.rotX, sh.rotY, 0);
    scene.add(sg);

    // Thin delicate orbital guide line (0.14 opacity dark-glow, NOT thick neon plastic torus!)
    const ringPts = [];
    for (let k = 0; k <= 72; k++) {
      const a = (k / 72) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(Math.cos(a) * sh.r, Math.sin(a) * sh.r, 0));
    }
    const trackGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
    const trackLine = new THREE.Line(
      trackGeo,
      createCelMaterial({
        color: sh.isCyan ? 0x62e2ff : 0xffd275,
        emissive: sh.isCyan ? 0x26c6da : 0xffa630,
        emissiveStrength: 1.0,
        unlit: true,
        noInk: true,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    sg.add(trackLine);
    orbitTrackCurves.push(trackLine);

    const satsInShell = [];
    for (let i = 0; i < sh.count; i++) {
      const a0 = (i / sh.count) * Math.PI * 2;
      const sat = createPrecisionRelaySat(satBodyMat, satWingMat, sh.isCyan ? cyanBeaconMat : goldBeaconMat);
      sg.add(sat);
      const obj = { mesh: sat, group: sg, a0, r: sh.r, speed: sh.speed, worldPos: new THREE.Vector3(), shellIdx: sIdx };
      satsInShell.push(obj);
      allSats.push(obj);
    }
    shellGroups.push({ group: sg, sats: satsInShell });
  });

  // 84 Additional Glittering Orbital "Star-Spark" Micro-Nodes that bloom across all 3 shells during "星火在这膨胀" (u = 0.46 -> 1.0)!
  const orbSparkRand = mulberry32(14840);
  const orbSparkGeo = new THREE.OctahedronGeometry(0.11, 0);
  const orbitalSparks = [];
  shellGroups.forEach(({ group }, sIdx) => {
    const rShell = shells[sIdx].r;
    const speedShell = shells[sIdx].speed * 1.15;
    for (let i = 0; i < 28; i++) {
      const a0 = orbSparkRand() * Math.PI * 2;
      const rOff = (orbSparkRand() - 0.5) * 1.1;
      const zOff = (orbSparkRand() - 0.5) * 1.2;
      const m = new THREE.Mesh(orbSparkGeo, i % 3 === 0 ? cyanBeaconMat : goldBeaconMat);
      m.visible = false;
      group.add(m);
      orbitalSparks.push({ mesh: m, group, a0, r: rShell + rOff, zOff, speed: speedShell, delay: orbSparkRand() * 0.42 });
    }
  });

  // === 4. DYNAMIC INTER-SATELLITE + GROUND + MOTHERSHIP LASER MESH (Single High-Speed GLSL3 LineSegments!) ===
  // Max edges: 36 intra-shell + 28 cross-shell + 12 ground links + 8 mothership relay links = 84 crisp glowing laser lines!
  const MAX_LINKS = 96;
  const linkPos = new Float32Array(MAX_LINKS * 2 * 3);
  const linkT = new Float32Array(MAX_LINKS * 2);
  const linkSeed = new Float32Array(MAX_LINKS * 2);
  const linkActive = new Float32Array(MAX_LINKS * 2);
  for (let i = 0; i < MAX_LINKS; i++) {
    linkT[i * 2 + 0] = 0.0;
    linkT[i * 2 + 1] = 1.0;
    linkSeed[i * 2 + 0] = i * 1.13;
    linkSeed[i * 2 + 1] = i * 1.13;
  }
  const linkGeo = new THREE.BufferGeometry();
  linkGeo.setAttribute("position", new THREE.BufferAttribute(linkPos, 3));
  linkGeo.setAttribute("aT", new THREE.BufferAttribute(linkT, 1));
  linkGeo.setAttribute("aSeed", new THREE.BufferAttribute(linkSeed, 1));
  linkGeo.setAttribute("aActive", new THREE.BufferAttribute(linkActive, 1));

  const laserMeshMat = createOpticalPulseLineMaterial(0x4fd8ff, 0xffe48c, 0.36);
  const laserMesh = new THREE.LineSegments(linkGeo, laserMeshMat);
  laserMesh.frustumCulled = false;
  scene.add(laserMesh);

  // Soft Feathered Volumetric Downlink Coverage Cones (5 active cones linking overhead sats -> 5 ground hubs!)
  const coneGeo = new THREE.ConeGeometry(1.0, 1.0, 24, 1, true);
  coneGeo.translate(0, -0.5, 0); // Apex at origin (0,0,0), base at y = -1.0
  const downlinkCones = groundHubs.map((hub, idx) => {
    const mat = createDownlinkConeMaterial(idx % 2 === 0 ? 0xffcf75 : 0x52e0ff);
    const mesh = new THREE.Mesh(coneGeo, mat);
    scene.add(mesh);
    return { mesh, mat, hub };
  });

  // === 5. LAYER 3: ORBITING HEADLESS STARARK MOTHERSHIP (High-Orbit Deep-Space Optical Relay!) ===
  // Exact same headless StarArk that remained in high orbit after S12 undocking!
  const mothership = buildStarArkShip();
  for (let i = 0; i < 4; i++) {
    if (mothership.children[i]) mothership.children[i].visible = false;
  }
  mothership.scale.setScalar(0.58);
  const mothershipPos = new THREE.Vector3(7.6, 8.6, -12.5);
  mothership.position.copy(mothershipPos);
  const deepBeamDir = new THREE.Vector3(0.68, 0.62, -0.39).normalize();
  // Align StarArk's own forward axis (+X) strictly coaxial (0 deg / 180 deg straight!) with the deep-space optical beam!
  mothership.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), deepBeamDir);
  scene.add(mothership);

  // Piercing Deep-Space Optical Communication Beam shooting 100% STRAIGHT out of StarArk's forward relay array!
  const deepBeamMat = createDeepSpaceBeamMaterial();
  const deepBeamGeo = new THREE.CylinderGeometry(0.55, 0.08, 120.0, 20, 12, true);
  deepBeamGeo.translate(0, 60.0, 0);
  const deepBeam = new THREE.Mesh(deepBeamGeo, deepBeamMat);
  deepBeam.position.copy(mothershipPos);
  deepBeam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), deepBeamDir);
  scene.add(deepBeam);

  // Inner razor-sharp white-gold optical laser core inside the deep-space beam
  const deepCoreGeo = new THREE.CylinderGeometry(0.08, 0.04, 120.0, 12, 1, true);
  deepCoreGeo.translate(0, 60.0, 0);
  const deepCoreMat = createCelMaterial({
    color: 0xffffff, emissive: 0x9cf2ff, emissiveStrength: 3.2,
    unlit: true, noInk: true, transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const deepCore = new THREE.Mesh(deepCoreGeo, deepCoreMat);
  deepCore.position.copy(mothershipPos);
  deepCore.quaternion.copy(deepBeam.quaternion);
  scene.add(deepCore);

  // 24 Light-Speed Star-Spark Pulses streaming out along the deep-space beam into the distant galaxy!
  const deepSparkGeo = new THREE.CylinderGeometry(0.05, 0.02, 2.8, 6);
  const deepSparks = [];
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(deepSparkGeo, i % 2 === 0 ? goldBeaconMat : cyanBeaconMat);
    m.quaternion.copy(deepBeam.quaternion);
    m.visible = false;
    scene.add(m);
    deepSparks.push({ mesh: m, offset: (i / 24) * 90.0, speed: 55.0 + (i % 5) * 12.0 });
  }

  const upVec = new THREE.Vector3(0, 1, 0);
  const tmpDir = new THREE.Vector3();

  return {
    scene,
    update(u, time, camera, audio) {
      const bass = audio ? audio.bass : 0;

      // Subtle Martian rotation
      marsWorld.rotation.y = -0.35 + time * 0.015;

      // Update orbiting StarArk Mothership (gentle station-keeping high above the constellation)
      mothership.userData.habRing.rotation.x = time * 1.1;
      mothership.userData.coreOrb.rotation.y = time * 1.8;
      mothership.userData.plumes.forEach((p) => { p.scale.set(0.5, 0.35, 0.5); });
      mothership.position.set(
        mothershipPos.x + Math.sin(time * 0.25) * 0.35,
        mothershipPos.y + Math.cos(time * 0.22) * 0.22,
        mothershipPos.z
      );
      deepBeam.position.copy(mothership.position);
      deepCore.position.copy(mothership.position);

      // Update all 36 orbital relay satellites & compute their live world positions
      shellGroups.forEach(({ group, sats }) => {
        group.updateMatrixWorld();
        sats.forEach((s) => {
          const ang = s.a0 + time * s.speed;
          s.mesh.position.set(Math.cos(ang) * s.r, Math.sin(ang) * s.r, 0);
          s.mesh.lookAt(0, 0, 0);
          s.worldPos.copy(s.mesh.position).applyMatrix4(group.matrixWorld);
        });
      });

      // === BUILD LIVE 3-LAYER LASER MESH (Expansion wave radiates outward from Mars Citadel!) ===
      const expandU = smoothstep(0.02, 0.72, u);
      const deepRelayU = smoothstep(0.45, 0.76, u);
      let cursor = 0;

      function writeLink(pA, pB, active) {
        if (cursor >= MAX_LINKS) return;
        const i6 = cursor * 6;
        linkPos[i6 + 0] = pA.x; linkPos[i6 + 1] = pA.y; linkPos[i6 + 2] = pA.z;
        linkPos[i6 + 3] = pB.x; linkPos[i6 + 4] = pB.y; linkPos[i6 + 5] = pB.z;
        linkActive[cursor * 2 + 0] = active;
        linkActive[cursor * 2 + 1] = active;
        cursor++;
      }

      // Layer 1A: Intra-shell inter-satellite laser rings (only draw links above the visible hemisphere, expanding outward from Citadel!)
      shellGroups.forEach(({ sats }) => {
        for (let i = 0; i < sats.length; i++) {
          const sA = sats[i];
          const sB = sats[(i + 1) % sats.length];
          if (sA.worldPos.y < -4.0 && sB.worldPos.y < -4.0) continue;
          const distFromCitadel = sA.worldPos.distanceTo(citadelPos) / 28.0;
          const act = smoothstep(distFromCitadel * 0.65, distFromCitadel * 0.65 + 0.16, expandU);
          writeLink(sA.worldPos, sB.worldPos, act);
        }
      });

      // Layer 1B: Cross-shell 3D geodesic laser bridges between adjacent orbital shells!
      const s0 = shellGroups[0].sats;
      const s1 = shellGroups[1].sats;
      const s2 = shellGroups[2].sats;
      for (let i = 0; i < s1.length; i++) {
        const sat = s1[i];
        if (sat.worldPos.y < -1.5) continue;
        // Connect to nearest satellite in shell 0 & shell 2
        let near0 = s0[0], best0 = 1e9;
        for (let j = 0; j < s0.length; j++) {
          const d = sat.worldPos.distanceToSquared(s0[j].worldPos);
          if (d < best0) { best0 = d; near0 = s0[j]; }
        }
        if (best0 < 120) {
          const distF = sat.worldPos.distanceTo(citadelPos) / 28.0;
          writeLink(sat.worldPos, near0.worldPos, smoothstep(distF * 0.72, distF * 0.72 + 0.18, expandU) * 0.9);
        }
        let near2 = s2[0], best2 = 1e9;
        for (let j = 0; j < s2.length; j++) {
          const d = sat.worldPos.distanceToSquared(s2[j].worldPos);
          if (d < best2) { best2 = d; near2 = s2[j]; }
        }
        if (best2 < 140) {
          const distF = sat.worldPos.distanceTo(citadelPos) / 28.0;
          writeLink(sat.worldPos, near2.worldPos, smoothstep(distF * 0.78, distF * 0.78 + 0.18, expandU) * 0.85);
        }
      }

      // Layer 2: Strictly Nadir-Straight (180-deg coaxial, ZERO crooked angle!) Downlink Beams & Sub-Satellite Surface Ripples!
      const overheadSats = allSats
        .filter((s) => s.worldPos.y > 2.2)
        .sort((a, b) => b.worldPos.y - a.worldPos.y);

      downlinkCones.forEach(({ mesh, mat, hub }, idx) => {
        const sat = overheadSats[idx % Math.max(1, overheadSats.length)];
        if (!sat) {
          mesh.visible = false;
          hub.hubGroup.visible = false;
          return;
        }
        // Compute exact sub-satellite nadir point straight down on the Martian surface (0-deg deviation from satellite optical axis!)
        hub.normal.copy(sat.worldPos).sub(marsCenter).normalize();
        hub.pos.copy(marsCenter).addScaledVector(hub.normal, marsRadius + 0.08);
        hub.hubGroup.position.copy(hub.pos);
        hub.hubGroup.quaternion.setFromUnitVectors(upVec, hub.normal);

        const hubAct = smoothstep(hub.delay, hub.delay + 0.22, expandU);
        mesh.visible = hubAct > 0.01;
        hub.hubGroup.visible = hubAct > 0.01;
        writeLink(hub.pos, sat.worldPos, hubAct * 1.15);

        // Align soft volumetric downlink cone strictly nadir-straight from satellite -> sub-satellite footprint!
        tmpDir.copy(hub.normal).negate();
        const dist = sat.worldPos.distanceTo(hub.pos);
        mesh.position.copy(sat.worldPos);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), tmpDir);
        mesh.scale.set(2.0 + bass * 0.25, dist, 2.0 + bass * 0.25);
        mat.uniforms.uTime.value = time;
        mat.uniforms.uOpacity.value = hubAct * 0.28;

        // Expanding holographic surface coverage ripples centered strictly underneath the beam!
        const rA = (time * 0.55 + hub.delay * 2.0) % 1.0;
        const rB = (time * 0.55 + hub.delay * 2.0 + 0.5) % 1.0;
        hub.ringA.scale.setScalar(0.5 + rA * 4.0);
        hub.ringA.material.uniforms.uOpacity.value = Math.sin(rA * Math.PI) * 0.65 * hubAct;
        hub.ringB.scale.setScalar(0.5 + rB * 4.0);
        hub.ringB.material.uniforms.uOpacity.value = Math.sin(rB * Math.PI) * 0.55 * hubAct;
      });

      // Layer 3: Constellation -> Orbiting StarArk Mothership Relay Convergence + Deep-Space Optical Beam into the Stars!
      if (deepRelayU > 0.01) {
        // Pick 5 highest/closest satellites to fire converging optical relay beams into StarArk!
        const sorted = allSats
          .filter((s) => s.worldPos.y > 2.5)
          .sort((a, b) => a.worldPos.distanceToSquared(mothership.position) - b.worldPos.distanceToSquared(mothership.position));
        for (let k = 0; k < Math.min(5, sorted.length); k++) {
          writeLink(sorted[k].worldPos, mothership.position, deepRelayU * 1.25);
        }
      }

      // Clear any unused link slots
      for (let i = cursor; i < MAX_LINKS; i++) {
        linkActive[i * 2 + 0] = 0.0;
        linkActive[i * 2 + 1] = 0.0;
      }
      linkGeo.attributes.position.needsUpdate = true;
      linkGeo.attributes.aActive.needsUpdate = true;
      laserMeshMat.uniforms.uTime.value = time;

      // === "星火 · 在这膨胀" (u = 0.46 -> 1.00): 3-Level Wildfire Expansion! ===
      const sparkExpandU = smoothstep(0.45, 0.96, u);
      const waveTheta = 0.02 + Math.pow(sparkExpandU, 0.85) * 0.74;

      // 1. Golden spherical-cap ignition wave sweeping across Mars's exact curvature!
      waveRing.visible = sparkExpandU > 0.005 && sparkExpandU < 0.98;
      if (waveRing.visible) {
        const capR = marsRadius * Math.sin(waveTheta);
        const capY = marsRadius * Math.cos(waveTheta) + 0.16;
        waveRing.position.set(0, capY, 0);
        waveRing.scale.setScalar(Math.max(0.2, capR));
        waveRingMat.uniforms.uOpacity.value = Math.sin(sparkExpandU * Math.PI) * 0.92;
      }

      // 2. Domino-igniting 52 Martian Colony Sparks + Curved Surface Light-Vein Highways!
      for (let i = 0; i < colonySparks.length; i++) {
        const cs = colonySparks[i];
        const lit = smoothstep(cs.angDist - 0.03, cs.angDist + 0.08, waveTheta);
        cs.group.visible = lit > 0.01;
        if (cs.group.visible) {
          // Brief pop-flash overshoot right as each colony spark ignites!
          const pop = 1.0 + Math.sin(lit * Math.PI) * 0.55;
          cs.group.scale.setScalar(lit * pop * (0.95 + bass * 0.25));
        }
      }
      for (let i = 0; i < veinAngDist.length; i++) {
        veinActiveArr[i] = smoothstep(veinAngDist[i] - 0.02, veinAngDist[i] + 0.10, waveTheta);
      }
      veinGeo.attributes.aActive.needsUpdate = true;
      surfaceVeinMat.uniforms.uTime.value = time;

      // 3. 84 Glittering Orbital Star-Sparks blooming across the 3 shells!
      for (let i = 0; i < orbitalSparks.length; i++) {
        const os = orbitalSparks[i];
        const lit = smoothstep(os.delay, os.delay + 0.22, sparkExpandU);
        os.mesh.visible = lit > 0.01;
        if (os.mesh.visible) {
          const ang = os.a0 + time * os.speed;
          os.mesh.position.set(Math.cos(ang) * os.r, Math.sin(ang) * os.r, os.zOff);
          os.mesh.scale.setScalar(lit * (0.85 + 0.35 * Math.sin(time * 8.0 + i)));
        }
      }

      // Ignite the piercing Deep-Space Optical Communication Beam + 24 Light-Speed Star-Spark Pulses into the galaxy!
      const beamPower = smoothstep(0.50, 0.76, u);
      deepBeam.visible = beamPower > 0.01;
      deepCore.visible = beamPower > 0.01;
      deepBeamMat.uniforms.uTime.value = time;
      deepBeamMat.uniforms.uPower.value = beamPower * (0.95 + bass * 0.25);
      deepCoreMat.uniforms.uOpacity.value = beamPower * 0.85;

      for (let i = 0; i < deepSparks.length; i++) {
        const ds = deepSparks[i];
        ds.mesh.visible = beamPower > 0.15;
        if (ds.mesh.visible) {
          const dist = (time * ds.speed + ds.offset) % 90.0;
          ds.mesh.position.copy(mothership.position).addScaledVector(deepBeamDir, dist);
          const sc = beamPower * (1.0 - dist / 95.0);
          ds.mesh.scale.set(1.0 + sc * 0.6, 0.6 + sc * 1.4, 1.0 + sc * 0.6);
        }
      }

      // === 3-PHASE CINEMA CAMERA ===
      // 0..0.35: Low oblique orbit above the glowing Martian Citadel & curved rust horizon
      // 0.35..0.72: Pulls back & arcs higher unveiling the entire glowing golden-cyan constellation web blanketing Mars
      // 0.72..1.00: Tilts gracefully upward toward orbiting StarArk firing the deep-space optical beam into the stars!
      const pullU = smoothstep(0.0, 0.85, u);
      const skyTilt = smoothstep(0.52, 1.0, u);
      camera.fov = 40 + pullU * 7;
      camera.position.set(
        -5.8 + u * 6.5,
        6.2 + pullU * 5.2,
        11.2 + pullU * 9.5
      );
      camera.lookAt(
        -1.2 + skyTilt * 4.2,
        2.4 + skyTilt * 4.4,
        -9.5 - skyTilt * 2.5
      );
      camera.updateProjectionMatrix();

      return { sunDir, clearColor: 0x050714, shadowBounds: null };
    }
  };
}
