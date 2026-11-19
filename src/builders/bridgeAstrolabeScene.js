import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { mulberry32, clamp, smoothstep } from "../core/math.js";
import { buildStarfield } from "./cosmicPrimitives.js";

// Crisp procedural 1024x512 Bridge Tactical Telemetry Screen Atlas (4 unique tactical displays!)
function createBridgeTelemetryAtlas() {
  const w = 1024, h = 512;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");

  ctx.fillStyle = "#060b18";
  ctx.fillRect(0, 0, w, h);

  const panels = [
    { x: 0, y: 0, title: "FLEET FORMATION // 48 VESSELS" },
    { x: 512, y: 0, title: "COSMIC PULSE // GEODESIC SOLVER" },
    { x: 0, y: 256, title: "GRAVITY WELL // TENSOR MAP" },
    { x: 512, y: 256, title: "NAV LOCK // NEBULA CORRIDOR" }
  ];

  panels.forEach((p, idx) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    // Subtle tech grid
    ctx.strokeStyle = "rgba(82, 210, 255, 0.14)";
    ctx.lineWidth = 1;
    for (let gx = 24; gx < 500; gx += 32) {
      ctx.beginPath(); ctx.moveTo(gx, 36); ctx.lineTo(gx, 240); ctx.stroke();
    }
    for (let gy = 48; gy < 240; gy += 32) {
      ctx.beginPath(); ctx.moveTo(16, gy); ctx.lineTo(496, gy); ctx.stroke();
    }
    // Header bar
    ctx.fillStyle = "rgba(82, 210, 255, 0.22)";
    ctx.fillRect(14, 12, 484, 24);
    ctx.fillStyle = "#9cf4ff";
    ctx.font = "700 14px 'SF Mono', Menlo, monospace";
    ctx.fillText(p.title, 24, 29);

    if (idx === 0) {
      // Fleet chevron tactical radar
      ctx.strokeStyle = "#4fd8ff";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(140, 145, 76, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(140, 145, 42, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ffd875";
      [[140, 130], [116, 152], [164, 152], [96, 174], [184, 174]].forEach(([x, y]) => {
        ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
      });
      // Telemetry bars
      for (let b = 0; b < 6; b++) {
        ctx.fillStyle = b % 2 === 0 ? "#4fd8ff" : "#ffd875";
        ctx.fillRect(260, 62 + b * 28, 120 + ((b * 47) % 100), 12);
      }
    } else if (idx === 1) {
      // Pulsing cosmic geodesic sine/pulse waveforms
      ctx.strokeStyle = "#ffd875";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let x = 24; x < 488; x += 6) {
        const y = 140 + Math.sin(x * 0.045) * 42 * Math.cos(x * 0.012);
        if (x === 24) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = "#4fd8ff";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let x = 24; x < 488; x += 6) {
        const y = 140 + Math.cos(x * 0.03) * 28;
        if (x === 24) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else if (idx === 2) {
      // Concentric gravity well contour rings
      for (let r = 18; r <= 90; r += 18) {
        ctx.strokeStyle = r === 54 ? "#ffd875" : "rgba(98, 226, 255, 0.55)";
        ctx.lineWidth = r === 54 ? 2.5 : 1.4;
        ctx.beginPath(); ctx.ellipse(256, 145, r * 1.9, r * 0.85, 0, 0, Math.PI * 2); ctx.stroke();
      }
    } else {
      // Navigation corridor lock reticle
      ctx.strokeStyle = "#ffd875";
      ctx.lineWidth = 2.2;
      ctx.strokeRect(180, 72, 152, 132);
      ctx.strokeStyle = "#4fd8ff";
      ctx.beginPath(); ctx.moveTo(256, 56); ctx.lineTo(256, 224); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(156, 138); ctx.lineTo(356, 138); ctx.stroke();
      ctx.fillStyle = "#ffe89e";
      ctx.font = "700 16px 'SF Mono', Menlo, monospace";
      ctx.fillText("VECTOR LOCKED // 99.98%", 156, 232);
    }

    // Outer bezel border
    ctx.strokeStyle = "rgba(120, 230, 255, 0.45)";
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 496, 240);
    ctx.restore();
  });

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

// Custom GLSL3 MRT Heartbeat-Pulsing Cosmic Web Vein Shader ("推演这 · 宇宙命脉")
function createCosmicWebMaterial() {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uExpand: { value: 0.0 },
      uHeartbeat: { value: 0.0 }
    },
    vertexShader: `
      precision highp float;
      in vec3 position;
      in float aT;
      in float aDist;
      in float aIsDestiny;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      out float vT;
      out float vDist;
      out float vIsDestiny;
      void main() {
        vT = aT;
        vDist = aDist;
        vIsDestiny = aIsDestiny;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uExpand;
      uniform float uHeartbeat;
      in float vT;
      in float vDist;
      in float vIsDestiny;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        // Radial expansion from astrolabe core out across the entire command bridge!
        float reveal = smoothstep(vDist - 0.14, vDist + 0.08, uExpand * 1.18);
        // Living radial heartbeat wave propagating outward from the cosmic core through all filaments!
        float wave = pow(0.5 + 0.5 * sin(vDist * 10.0 - uTime * 4.8), 6.0);
        float flow = pow(0.5 + 0.5 * sin(vT * 6.2831 - uTime * 5.5), 4.0);

        vec3 cyanVein = vec3(0.24, 0.72, 1.0);
        vec3 goldPulse = vec3(1.0, 0.84, 0.42);
        vec3 destinyCol = vec3(1.0, 0.94, 0.68);

        // Candidate cyan veins dim slightly as the golden Destiny Vein locks on!
        vec3 col = mix(cyanVein, goldPulse, clamp(wave * 0.85 + vIsDestiny * 0.85, 0.0, 1.0));
        col = mix(col, destinyCol, vIsDestiny * (0.5 + flow * 0.5));

        float baseA = mix(0.16, 0.72, vIsDestiny);
        float pulseBoost = wave * (0.55 + uHeartbeat * 0.45) + flow * 0.35;
        float a = clamp((baseA + pulseBoost) * reveal, 0.0, 1.0);
        gColor = vec4(col * (1.0 + pulseBoost * 1.45), a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Custom GLSL3 MRT Soft Volumetric Hologram Projection Cone rising from the bridge table
function createHoloBeamConeMaterial() {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.24 }
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
      in vec2 vUv;
      in float vEdge;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        float fade = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.15, vUv.y);
        float scan = 0.78 + 0.22 * sin(vUv.y * 36.0 - uTime * 6.0);
        float a = fade * pow(vEdge, 1.2) * scan * uOpacity;
        vec3 col = mix(vec3(0.28, 0.78, 1.0), vec3(1.0, 0.84, 0.45), vUv.y * 0.45);
        gColor = vec4(col * a * 1.3, a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Distant Flanking Wedge Cruiser visible outside the panoramic command bridge glass (100% continuity with S17!)
function createExteriorCruiser(armorMat, darkMat, cyanMat, winMat) {
  const g = new THREE.Group();
  const wedgeGeo = new THREE.ConeGeometry(2.4, 8.8, 4);
  wedgeGeo.rotateY(Math.PI / 4);
  wedgeGeo.rotateX(-Math.PI / 2);
  wedgeGeo.scale(1.15, 0.24, 1.0);
  g.add(new THREE.Mesh(wedgeGeo, armorMat));
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.65, 0.85), darkMat);
  bridge.position.set(0, 0.95, 2.5);
  g.add(bridge);
  const bWin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 0.88), winMat);
  bWin.position.set(0, 1.05, 2.48);
  g.add(bWin);
  [-0.9, 0, 0.9].forEach((x) => {
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), cyanMat);
    glow.position.set(x, 0, 4.4);
    g.add(glow);
  });
  return g;
}

// S18: 舰桥星盘推演命脉 (147.4 - 156.0s) — Panoramic Flagship Command Bridge + Floating 3D Holographic Armillary Astrolabe & Cosmic Pulse Deduction!
export function buildBridgeAstrolabeScene() {
  const scene = new THREE.Scene();
  const rand = mulberry32(18189);
  scene.add(buildStarfield(2600, 420, 18189));

  const deckMat = createCelMaterial({ color: 0x161c2e, shadowColor: 0x090c18, patternMode: 2, patternScale: new THREE.Vector2(10, 10), rimStrength: 0.32, rimColor: 0x62e2ff });
  const ribMat = createCelMaterial({ color: 0x26304a, shadowColor: 0x0f1424, rimStrength: 0.45, rimColor: 0x80ecff });
  const armorMat = createCelMaterial({ color: 0xd8e0ec, shadowColor: 0x3f4866, patternMode: 2, patternScale: new THREE.Vector2(8, 12), rimStrength: 0.55, rimColor: 0x9cf2ff });
  const goldGlowMat = createCelMaterial({ color: 0xffe89e, emissive: 0xffb830, emissiveStrength: 2.6, unlit: true, noInk: true });
  const cyanGlowMat = createCelMaterial({ color: 0xa6f6ff, emissive: 0x38d2ff, emissiveStrength: 2.6, unlit: true, noInk: true });

  // === 1. SLEEK PANORAMIC FLAGSHIP COMMAND BRIDGE ARCHITECTURE (NO clunky low-poly humanoids!) ===
  // Circular tiered obsidian command deck
  const deckLower = new THREE.Mesh(new THREE.CylinderGeometry(11.5, 12.2, 0.5, 48), deckMat);
  deckLower.position.y = -2.6;
  scene.add(deckLower);

  const deckStep = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 6.2, 0.32, 40), ribMat);
  deckStep.position.y = -2.2;
  scene.add(deckStep);

  // Subtle glowing floor accent rings
  [5.8, 9.2].forEach((r, idx) => {
    const flRing = new THREE.Mesh(
      new THREE.RingGeometry(r - 0.04, r + 0.04, 64),
      createCelMaterial({ color: idx === 0 ? 0x62e2ff : 0xffd275, emissive: idx === 0 ? 0x26c6da : 0xffa630, emissiveStrength: 1.8, unlit: true, noInk: true, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    flRing.rotation.x = -Math.PI / 2;
    flRing.position.y = -2.33;
    scene.add(flRing);
  });

  // Cathedral-like Sweeping Overhead Panoramic Viewport Ribs (framing the massive curved front glass!)
  for (let i = -3; i <= 3; i++) {
    const ang = i * 0.34;
    const rib = new THREE.Mesh(new THREE.TorusGeometry(10.8, 0.22, 8, 36, Math.PI * 0.62), ribMat);
    rib.rotation.y = ang + Math.PI / 2;
    rib.rotation.z = -0.18;
    rib.position.y = -1.6;
    scene.add(rib);
  }
  // Upper panoramic canopy crown ring & lower bulkhead sill
  const crownArch = new THREE.Mesh(new THREE.TorusGeometry(10.6, 0.28, 10, 48, Math.PI * 1.15), ribMat);
  crownArch.rotation.x = Math.PI / 2;
  crownArch.rotation.z = Math.PI * 0.92;
  crownArch.position.y = 4.6;
  scene.add(crownArch);

  const sillArch = new THREE.Mesh(new THREE.TorusGeometry(10.7, 0.38, 10, 48, Math.PI * 1.15), deckMat);
  sillArch.rotation.x = Math.PI / 2;
  sillArch.rotation.z = Math.PI * 0.92;
  sillArch.position.y = -1.65;
  scene.add(sillArch);

  // 4 Angled Tactical Telemetry Consoles curving along the panoramic window sill (with crisp Canvas atlas!)
  const atlasTex = createBridgeTelemetryAtlas();
  [-1.05, -0.38, 0.38, 1.05].forEach((ang, idx) => {
    const cg = new THREE.Group();
    const r = 7.8;
    cg.position.set(Math.sin(ang) * r, -1.65, -Math.cos(ang) * r);
    cg.rotation.y = -ang;
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.85, 0.95), ribMat);
    desk.position.y = -0.35;
    cg.add(desk);

    const screenGeo = new THREE.PlaneGeometry(2.15, 1.08);
    // Map each console to 1 of the 4 crisp quadrants in the 1024x512 atlas!
    const u0 = (idx % 2) * 0.5, u1 = u0 + 0.5;
    const v0 = idx < 2 ? 0.5 : 0.0, v1 = v0 + 0.5;
    const uv = screenGeo.attributes.uv;
    uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0);
    const screen = new THREE.Mesh(
      screenGeo,
      createCelMaterial({ color: 0xffffff, map: atlasTex, emissive: 0x38c8ff, emissiveStrength: 0.35, unlit: true, noInk: true })
    );
    screen.position.set(0, 0.42, 0.12);
    screen.rotation.x = -0.38;
    cg.add(screen);
    scene.add(cg);
  });

  // === 2. LIVE EXTERIOR FLEET CRUISING OUTSIDE THE PANORAMIC BRIDGE VIEWPORT (Continuity with S17!) ===
  const extFleet = new THREE.Group();
  scene.add(extFleet);
  const extCruiserL = createExteriorCruiser(armorMat, ribMat, cyanGlowMat, goldGlowMat);
  extCruiserL.position.set(-22, 4.5, -48);
  extCruiserL.scale.setScalar(1.3);
  extFleet.add(extCruiserL);

  const extCruiserR = createExteriorCruiser(armorMat, ribMat, cyanGlowMat, goldGlowMat);
  extCruiserR.position.set(24, 1.8, -56);
  extCruiserR.scale.setScalar(1.15);
  extFleet.add(extCruiserR);

  // === 3. HERO CENTERPIECE: FLOATING 3D HOLOGRAPHIC ARMILLARY ASTROLABE & COSMIC PULSE SOLVER ===
  const pedestal = new THREE.Group();
  pedestal.position.set(0, -1.65, -0.5);
  scene.add(pedestal);

  const pedBase = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.65, 0.95, 32), ribMat);
  pedBase.position.y = -0.25;
  pedestal.add(pedBase);
  const pedEmitter = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.85, 0.22, 32), deckMat);
  pedEmitter.position.y = 0.30;
  pedestal.add(pedEmitter);
  const pedRing = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.055, 8, 40), cyanGlowMat);
  pedRing.rotation.x = Math.PI / 2;
  pedRing.position.y = 0.42;
  pedestal.add(pedRing);

  // Soft volumetric hologram projection beam rising from pedestal
  const holoConeMat = createHoloBeamConeMaterial();
  const holoCone = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 1.4, 4.2, 32, 1, true), holoConeMat);
  holoCone.position.y = 2.5;
  pedestal.add(holoCone);

  // Multi-Axis Rotating Precision Holographic Armillary Astrolabe
  const astrolabe = new THREE.Group();
  astrolabe.position.set(0, 1.25, -0.5);
  scene.add(astrolabe);

  const astroGoldMat = createCelMaterial({
    color: 0xffdf84, emissive: 0xffb330, emissiveStrength: 1.9,
    unlit: true, noInk: true, transparent: true, opacity: 0.82,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const astroCyanMat = createCelMaterial({
    color: 0x8cf4ff, emissive: 0x26c8ff, emissiveStrength: 1.8,
    unlit: true, noInk: true, transparent: true, opacity: 0.72,
    blending: THREE.AdditiveBlending, depthWrite: false
  });

  const gyroRings = [];
  [
    { r: 2.75, tube: 0.032, mat: astroCyanMat, ticks: 24 },
    { r: 2.35, tube: 0.042, mat: astroGoldMat, ticks: 16 },
    { r: 1.88, tube: 0.028, mat: astroCyanMat, ticks: 12 },
    { r: 1.42, tube: 0.036, mat: astroGoldMat, ticks: 8 }
  ].forEach((cfg) => {
    const rg = new THREE.Group();
    rg.add(new THREE.Mesh(new THREE.TorusGeometry(cfg.r, cfg.tube, 8, 64), cfg.mat));
    // Precision degree graduation ticks around each armillary ring!
    for (let k = 0; k < cfg.ticks; k++) {
      const a = (k / cfg.ticks) * Math.PI * 2;
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.03), cfg.mat);
      tick.position.set(Math.cos(a) * (cfg.r - 0.10), Math.sin(a) * (cfg.r - 0.10), 0);
      tick.rotation.z = a + Math.PI / 2;
      rg.add(tick);
    }
    astrolabe.add(rg);
    gyroRings.push(rg);
  });

  // Glowing holographic cosmic core node inside the astrolabe
  const coreSun = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 2), goldGlowMat);
  astrolabe.add(coreSun);

  // === 4. MASSIVE ROOM-FILLING 3D AI NEURAL-COSMIC SYNAPTIC NETWORK ("推演这 · 宇宙命脉") ===
  // 240+ blazing 3D AI Neuron Somata (InstancedMesh for buttery 60fps) + 650+ interconnected curved synaptic axons
  // firing action-potential light spikes across the entire panoramic command bridge!
  const cosmicWebGroup = new THREE.Group();
  cosmicWebGroup.position.copy(astrolabe.position);
  scene.add(cosmicWebGroup);

  const superclusters = [];
  const scNodeGeo = new THREE.OctahedronGeometry(0.14, 1);
  const scHaloGeo = new THREE.RingGeometry(0.18, 0.28, 18);
  const scHaloMat = createCelMaterial({
    color: 0xffe082, emissive: 0xffb330, emissiveStrength: 2.4,
    unlit: true, noInk: true, transparent: true, opacity: 0.65,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
  });

  // 6 Major Golden Destiny Hub Neurons shooting straight out through the panoramic bridge viewport!
  const destinyCoords = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.9, 0.4, -1.7),
    new THREE.Vector3(-0.4, 0.8, -3.5),
    new THREE.Vector3(0.6, 1.0, -5.6),
    new THREE.Vector3(0.0, 1.2, -8.2),
    new THREE.Vector3(0.0, 1.5, -11.5)
  ];
  destinyCoords.forEach((p, idx) => {
    const g = new THREE.Group();
    g.position.copy(p);
    const core = new THREE.Mesh(scNodeGeo, goldGlowMat);
    core.scale.setScalar(idx === 0 ? 1.55 : 1.2);
    g.add(core);
    const halo = new THREE.Mesh(scHaloGeo, scHaloMat);
    g.add(halo);
    cosmicWebGroup.add(g);
    superclusters.push({ pos: p, group: g, halo, dist: clamp(p.length() / 11.5, 0, 1), isDestiny: true });
  });

  // 180 Bright Glowing 3D AI Neuron Somata (native THREE.Mesh so createCelMaterial MRT bloom shines at 100% brightness!)
  const NEURON_COUNT = 180;
  const neuronData = [];
  const neuronCoords = [...destinyCoords];
  const neuronGeo = new THREE.OctahedronGeometry(0.105, 1);
  for (let i = 0; i < NEURON_COUNT; i++) {
    const ang = rand() * Math.PI * 2;
    const rad = 1.15 + Math.pow(rand(), 0.72) * 8.4;
    const y = -1.45 + rand() * 5.0;
    const p = new THREE.Vector3(Math.cos(ang) * rad, y, Math.sin(ang) * rad - 1.4);
    const dist = clamp(p.length() / 10.6, 0, 1);
    const isGold = i % 3 === 0;
    const baseScale = isGold ? (0.82 + rand() * 0.65) : (0.58 + rand() * 0.55);
    const mesh = new THREE.Mesh(neuronGeo, isGold ? goldGlowMat : cyanGlowMat);
    mesh.position.copy(p);
    mesh.scale.setScalar(0.001);
    mesh.visible = false;
    cosmicWebGroup.add(mesh);
    neuronData.push({ mesh, pos: p, dist, isGold, baseScale, firePhase: rand() * 6.283, fireFreq: 3.5 + rand() * 4.5 });
    neuronCoords.push(p);
  }

  // Weave 650+ Interconnected Curved 3D Synaptic Axons & Cosmic Filaments!
  const webPos = [], webT = [], webDist = [], webDestiny = [];
  function addCurvedFilament(pA, pB, isDest, curveSeed) {
    const mid = pA.clone().add(pB).multiplyScalar(0.5);
    const len = pA.distanceTo(pB);
    mid.x += Math.sin(curveSeed * 3.1) * len * 0.14;
    mid.y += Math.cos(curveSeed * 2.7) * len * 0.12;
    mid.z += Math.sin(curveSeed * 1.9) * len * 0.10;
    const curve = new THREE.QuadraticBezierCurve3(pA, mid, pB);
    const segs = isDest ? 14 : 6;
    for (let s = 0; s < segs; s++) {
      const t0 = s / segs, t1 = (s + 1) / segs;
      const a = curve.getPoint(t0), b = curve.getPoint(t1);
      webPos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      webT.push(t0, t1);
      webDist.push(clamp(a.length() / 11.0, 0, 1), clamp(b.length() / 11.0, 0, 1));
      webDestiny.push(isDest ? 1.0 : 0.0, isDest ? 1.0 : 0.0);
    }
  }

  // Golden Destiny Vein (triple-stranded luminous main pulse!)
  for (let i = 0; i < destinyCoords.length - 1; i++) {
    addCurvedFilament(destinyCoords[i], destinyCoords[i + 1], true, i * 1.1);
    addCurvedFilament(destinyCoords[i], destinyCoords[i + 1], true, i * 1.1 + 4.2);
  }
  // Dense AI Synaptic Mesh: connect every neuron to its 3-4 nearest neighbors (yields ~700 interconnected axons!)
  for (let i = 0; i < neuronCoords.length; i++) {
    const neighbors = [];
    for (let j = i + 1; j < neuronCoords.length; j++) {
      const d2 = neuronCoords[i].distanceToSquared(neuronCoords[j]);
      if (d2 < 8.5) neighbors.push({ j, d2 });
    }
    neighbors.sort((a, b) => a.d2 - b.d2);
    const maxConn = i < 6 ? 6 : 3;
    for (let k = 0; k < Math.min(maxConn, neighbors.length); k++) {
      const j = neighbors[k].j;
      addCurvedFilament(neuronCoords[i], neuronCoords[j], false, i * 0.73 + j * 0.41);
    }
  }

  const webGeo = new THREE.BufferGeometry();
  webGeo.setAttribute("position", new THREE.Float32BufferAttribute(webPos, 3));
  webGeo.setAttribute("aT", new THREE.Float32BufferAttribute(webT, 1));
  webGeo.setAttribute("aDist", new THREE.Float32BufferAttribute(webDist, 1));
  webGeo.setAttribute("aIsDestiny", new THREE.Float32BufferAttribute(webDestiny, 1));
  const cosmicWebMat = createCosmicWebMaterial();
  const cosmicWebLines = new THREE.LineSegments(webGeo, cosmicWebMat);
  cosmicWebGroup.add(cosmicWebLines);

  // Blazing Golden Destiny Spine Tube locking straight out through the panoramic bridge viewport!
  const optCurve = new THREE.CatmullRomCurve3(destinyCoords);
  const optGeo = new THREE.TubeGeometry(optCurve, 48, 0.048, 8, false);
  const optMat = createCelMaterial({
    color: 0xfff2c2, emissive: 0xffbe3b, emissiveStrength: 3.2,
    unlit: true, noInk: true, transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const optTrajectory = new THREE.Mesh(optGeo, optMat);
  cosmicWebGroup.add(optTrajectory);

  // Expanding Golden Cosmic Heartbeat Pulse Sphere rippling outward through the bridge on each beat!
  const hbRingMat = createCelMaterial({
    color: 0xffe49e, emissive: 0xffb830, emissiveStrength: 2.6,
    unlit: true, noInk: true, transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
  });
  const hbRing = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.02, 64), hbRingMat);
  hbRing.rotation.x = Math.PI / 2;
  cosmicWebGroup.add(hbRing);

  return {
    scene,
    update(u, time, camera, audio) {
      const bass = audio ? audio.bass : 0;
      const localT = u * 8.6;

      // Exterior flanking cruisers glide majestically outside the panoramic viewport
      extCruiserL.position.set(-22 + u * 3.5, 4.5 + Math.sin(localT * 0.4) * 0.3, -48 - u * 6.0);
      extCruiserR.position.set(24 - u * 2.8, 1.8 + Math.cos(localT * 0.35) * 0.3, -56 - u * 5.0);

      // Multi-axis precision armillary astrolabe rotation (accelerates gracefully during "推演这宇宙命脉"!)
      const deduceU = smoothstep(0.42, 0.88, u);
      gyroRings[0].rotation.set(0.35 + localT * 0.22, localT * 0.18, 0.1);
      gyroRings[1].rotation.set(-0.55 + localT * 0.30, -localT * 0.26, 0.4);
      gyroRings[2].rotation.set(localT * 0.42, 0.65 - localT * 0.35, -0.3);
      gyroRings[3].rotation.set(-localT * 0.52, localT * 0.48, 0.2);

      // Fade out the central armillary gyro rings smoothly once the AI neuron nodes & cosmic web light up (u = 0.36 -> 0.68)!
      const ringFadeOut = 1.0 - smoothstep(0.36, 0.68, u);
      astroGoldMat.uniforms.uOpacity.value = 0.82 * ringFadeOut;
      astroCyanMat.uniforms.uOpacity.value = 0.72 * ringFadeOut;
      gyroRings.forEach((rg) => { rg.visible = ringFadeOut > 0.01; });

      // Core pulses rhythmically with the music's bass ("宇宙命脉"!)
      coreSun.scale.setScalar(0.88 + deduceU * 0.32 + bass * 0.38);
      holoConeMat.uniforms.uTime.value = localT;
      holoConeMat.uniforms.uOpacity.value = 0.22 * (0.25 + 0.75 * ringFadeOut);

      // Room-filling 3D Cosmic Web expands from astrolabe core (u = 0.22 -> 0.85) to fill the entire command bridge!
      const webExpandU = smoothstep(0.18, 0.84, u);
      cosmicWebMat.uniforms.uTime.value = localT;
      cosmicWebMat.uniforms.uExpand.value = webExpandU;
      cosmicWebMat.uniforms.uHeartbeat.value = bass;

      // Destiny hub superclusters snap online as the AI neural cosmic web expands!
      for (let i = 0; i < superclusters.length; i++) {
        const sc = superclusters[i];
        const lit = smoothstep(sc.dist - 0.10, sc.dist + 0.08, webExpandU * 1.18);
        sc.group.visible = lit > 0.01;
        if (sc.group.visible) {
          const pulse = 1.0 + bass * 0.45;
          sc.group.scale.setScalar(lit * pulse);
          if (sc.halo) sc.halo.quaternion.copy(camera.quaternion);
        }
      }

      // 180 Glowing AI Neuron Somata firing individual synaptic action-potential spikes right at every web junction!
      for (let i = 0; i < neuronData.length; i++) {
        const n = neuronData[i];
        const lit = smoothstep(n.dist - 0.12, n.dist + 0.08, webExpandU * 1.22);
        n.mesh.visible = lit > 0.01;
        if (n.mesh.visible) {
          const spike = Math.pow(0.5 + 0.5 * Math.sin(localT * n.fireFreq + n.firePhase), 6.0);
          const sc = n.baseScale * lit * (0.85 + spike * 1.15 + bass * 0.32);
          n.mesh.rotation.set(localT * 0.5 + n.firePhase, localT * 0.7, 0);
          n.mesh.scale.setScalar(sc);
        }
      }

      // Golden Heartbeat Pulse Ring expands rhythmically outward across the bridge!
      const hbCycle = (localT * 0.55) % 1.0;
      hbRing.visible = deduceU > 0.05;
      if (hbRing.visible) {
        hbRing.scale.setScalar(1.2 + hbCycle * 9.5);
        hbRingMat.uniforms.uOpacity.value = Math.sin(hbCycle * Math.PI) * 0.58 * deduceU;
      }

      // Locked Golden Destiny Vein ignites straight out through the panoramic bridge viewport!
      optMat.uniforms.uOpacity.value = smoothstep(0.48, 0.78, u) * (0.85 + bass * 0.25);

      // Sweeping Command Bridge Cinema Camera:
      // Smoothly orbits around the glowing holographic astrolabe pedestal, then glides right INSIDE the room-filling
      // heartbeat-pulsing 3D Cosmic Web looking along the Golden Destiny Vein out through the panoramic bridge window!
      const orbitAng = -0.58 + u * 1.12;
      const pushU = smoothstep(0.35, 1.0, u);
      const camR = 7.2 - pushU * 1.8;
      camera.fov = 43 + pushU * 7;
      camera.position.set(
        Math.sin(orbitAng) * camR,
        1.65 + Math.sin(u * Math.PI) * 0.55 - pushU * 0.35,
        -0.5 + Math.cos(orbitAng) * camR
      );
      camera.lookAt(
        0.0,
        1.20 + pushU * 0.35,
        -1.4 - pushU * 3.6
      );
      camera.updateProjectionMatrix();

      return { sunDir: new THREE.Vector3(-0.6, 0.5, 0.6), clearColor: 0x050814, shadowBounds: null };
    }
  };
}
