import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { mulberry32, smoothstep, clamp } from "../core/math.js";
import { buildStarfield } from "./cosmicPrimitives.js";
import { buildGargantuaBlackHole } from "./gargantuaBlackHole.js";

// Custom GLSL3 MRT Flowing Operator Beam / Skip-Connection Shader
function createOperatorBeamMaterial(colA, colB) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uPower: { value: 1.0 },
      uColA: { value: new THREE.Color(colA) },
      uColB: { value: new THREE.Color(colB) }
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
      uniform vec3 uColA;
      uniform vec3 uColB;
      in vec2 vUv;
      in float vCore;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        float pulse = pow(0.5 + 0.5 * sin(vUv.y * 28.0 - uTime * 18.0), 4.0);
        float core = pow(vCore, 1.5);
        vec3 col = mix(uColA, uColB, clamp(core * 0.75 + pulse * 0.45, 0.0, 1.0));
        float a = clamp((core * 0.85 + 0.15) * (0.75 + pulse * 0.55) * uPower, 0.0, 1.0);
        gColor = vec4(col * (1.25 + pulse * 1.4) * uPower, a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Custom GLSL3 MRT Flowing Line Shader for Residual Waves, Attention Weights, SVD Drop-Lines & 8B Radial Pulses!
function createOperatorLineMaterial(baseHex, pulseHex, baseAlpha = 0.28) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPower: { value: 1.0 },
      uBaseColor: { value: new THREE.Color(baseHex) },
      uPulseColor: { value: new THREE.Color(pulseHex) },
      uAlpha: { value: baseAlpha }
    },
    vertexShader: `
      precision highp float;
      in vec3 position;
      in float aT;
      in float aSeed;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      out float vT;
      out float vSeed;
      void main() {
        vT = aT;
        vSeed = aSeed;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uPower;
      uniform vec3 uBaseColor;
      uniform vec3 uPulseColor;
      uniform float uAlpha;
      in float vT;
      in float vSeed;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        float p = pow(0.5 + 0.5 * sin(vT * 12.566 - uTime * 8.5 + vSeed), 5.0);
        vec3 col = mix(uBaseColor, uPulseColor, p * 0.85);
        float a = clamp((uAlpha + p * 0.72) * uPower, 0.0, 1.0);
        gColor = vec4(col * (1.05 + p * 1.5), a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Custom GLSL3 MRT Expanding Rhythmic Pulse Shockwave Ring (for 8 Billion Pulses Climax!)
function createPulseWaveMaterial(tintHex) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uOpacity: { value: 0.0 },
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
      uniform float uOpacity;
      uniform vec3 uColor;
      in vec2 vUv;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0 || r < 0.4) discard;
        float front = exp(-pow((r - 0.92) * 24.0, 2.0)) * 2.2;
        float trail = smoothstep(0.45, 0.92, r) * smoothstep(1.0, 0.92, r) * 0.8;
        vec3 col = mix(uColor, vec3(1.0, 0.97, 0.88), clamp(front * 0.8, 0.0, 1.0));
        float a = clamp((front + trail) * uOpacity, 0.0, 1.0);
        gColor = vec4(col * (1.2 + front) * uOpacity, a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// S23 & S24: Complete Cinema-Grade Rebuild of the Four Deep-Learning Operators Climax!
// 197.13–201.69: ResNet 剥离残差的波动 (direct handoff from S22's vertical penetrating beam!)
// 201.69–205.83: Attention 拆解注意力网的黑洞 (Gargantua dismantled by 360+ Q/K/V softmax attention laser arcs!)
// 205.83–210.10: SVD 奇异值分解星空 (260 3D stars factorized onto 3 orthogonal principal singular axes!)
// 210.10–214.62: 8B 八十亿次脉动 (Synchronized spherical humanity-scale neural pulse climax!)
export function buildOperatorsScene() {
  const scene = new THREE.Scene();
  const rand = mulberry32(23249);
  scene.add(buildStarfield(3400, 560, 20209));

  const goldMat = createCelMaterial({ color: 0xffe89e, emissive: 0xffb830, emissiveStrength: 2.8, unlit: true, noInk: true });
  const cyanMat = createCelMaterial({ color: 0xa6f6ff, emissive: 0x38d2ff, emissiveStrength: 2.8, unlit: true, noInk: true });
  const whiteMat = createCelMaterial({ color: 0xffffff, emissive: 0xfff0c2, emissiveStrength: 3.2, unlit: true, noInk: true });

  // =========================================================================
  // STAGE 0: RESNET — 加速 · 剥离残差的波动 (197.13 – 201.69s)
  // Continues directly from S22's vertical penetrating beam -> strips away 14 jagged residual noise shells!
  // =========================================================================
  const resnetGroup = new THREE.Group();
  scene.add(resnetGroup);

  // Pure Golden Identity Skip-Connection Beam ("x" — starts vertical matching S22, sweeps cleanly into a forward highway!)
  const skipMat = createOperatorBeamMaterial(0x42d8ff, 0xfff0b8);
  const skipBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 95, 24, 16, true), skipMat);
  resnetGroup.add(skipBeam);
  const skipCore = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 95, 12, 1, true), whiteMat);
  resnetGroup.add(skipCore);

  // 14 Jagged Residual Oscillation Wave Ribbons ("F(x)") that violently peel off & strip away outward!
  const resWaveMat = createOperatorLineMaterial(0xff4268, 0x48dcff, 0.55);
  const resShells = [];
  for (let i = 0; i < 14; i++) {
    const pos = [], tArr = [], seedArr = [];
    const rBase = 1.4 + (i % 5) * 0.72;
    const segs = 64;
    const freq = 5 + (i % 4) * 3;
    for (let s = 0; s < segs; s++) {
      const t0 = s / segs, t1 = (s + 1) / segs;
      const a0 = t0 * Math.PI * 2, a1 = t1 * Math.PI * 2;
      const r0 = rBase + Math.sin(a0 * freq + i) * 0.55;
      const r1 = rBase + Math.sin(a1 * freq + i) * 0.55;
      const y0 = Math.cos(a0 * (freq - 2)) * 0.45;
      const y1 = Math.cos(a1 * (freq - 2)) * 0.45;
      pos.push(Math.cos(a0) * r0, y0, Math.sin(a0) * r0, Math.cos(a1) * r1, y1, Math.sin(a1) * r1);
      tArr.push(t0, t1);
      seedArr.push(i * 1.3, i * 1.3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aT", new THREE.Float32BufferAttribute(tArr, 1));
    g.setAttribute("aSeed", new THREE.Float32BufferAttribute(seedArr, 1));
    const mesh = new THREE.LineSegments(g, resWaveMat);
    const yHome = -14.0 + i * 2.2;
    mesh.position.y = yHome;
    resnetGroup.add(mesh);
    resShells.push({ mesh, yHome, sideX: (i % 2 === 0 ? 1 : -1) * (1.2 + rand() * 1.4), delay: i * 0.045 });
  }

  // =========================================================================
  // STAGE 1: ATTENTION — 拆解 · 注意力网的黑洞 (201.69 – 205.83s)
  // Gargantua Black Hole surrounded & dismantled by 96 Q/K/V Token Nodes + 320 Attention-Weight Laser Arcs!
  // =========================================================================
  const attnGroup = new THREE.Group();
  scene.add(attnGroup);

  const gargantua = buildGargantuaBlackHole();
  gargantua.funnelLines.visible = false;
  attnGroup.add(gargantua.group);

  // 48 Event-Horizon Fracture Shards that peel & crack outward as Attention dismantles the Black Hole!
  const shardGeo = new THREE.OctahedronGeometry(0.42, 0);
  const shardMat = createCelMaterial({ color: 0x161428, shadowColor: 0x06050e, emissive: 0xffb330, emissiveStrength: 0.75, rimStrength: 0.9, rimColor: 0x9cf4ff });
  const bhShards = [];
  for (let i = 0; i < 48; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / 48);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const dir = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
    const m = new THREE.Mesh(shardGeo, shardMat);
    attnGroup.add(m);
    bhShards.push({ mesh: m, dir, spin: (rand() - 0.5) * 6.0 });
  }

  // 96 Spherical Q/K/V Multi-Head Attention Token Nodes
  const tokenGeo = new THREE.OctahedronGeometry(0.16, 1);
  const attnNodes = [];
  for (let i = 0; i < 96; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / 96);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const dir = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
    const m = new THREE.Mesh(tokenGeo, i % 3 === 0 ? goldMat : cyanMat);
    attnGroup.add(m);
    attnNodes.push({ mesh: m, dir, rBase: 6.4 + (i % 3) * 1.4, phase: rand() * 6.28 });
  }

  // 280 Glowing Softmax Attention-Weight Laser Arcs linking tokens & piercing the Black Hole!
  const attnPos = [], attnT = [], attnSeed = [];
  for (let i = 0; i < 96; i++) {
    const pA = attnNodes[i].dir.clone().multiplyScalar(attnNodes[i].rBase);
    // Connect to 2 other tokens + 1 ray directly into the singularity core!
    const targets = [
      attnNodes[(i + 17) % 96].dir.clone().multiplyScalar(attnNodes[(i + 17) % 96].rBase),
      attnNodes[(i + 41) % 96].dir.clone().multiplyScalar(attnNodes[(i + 41) % 96].rBase),
      new THREE.Vector3(0, 0, 0)
    ];
    targets.forEach((pB, k) => {
      attnPos.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z);
      attnT.push(0, 1);
      attnSeed.push(i * 0.7 + k * 2.1, i * 0.7 + k * 2.1);
    });
  }
  const attnLineGeo = new THREE.BufferGeometry();
  attnLineGeo.setAttribute("position", new THREE.Float32BufferAttribute(attnPos, 3));
  attnLineGeo.setAttribute("aT", new THREE.Float32BufferAttribute(attnT, 1));
  attnLineGeo.setAttribute("aSeed", new THREE.Float32BufferAttribute(attnSeed, 1));
  const attnLineMat = createOperatorLineMaterial(0x38d0ff, 0xffe484, 0.24);
  attnGroup.add(new THREE.LineSegments(attnLineGeo, attnLineMat));

  // =========================================================================
  // STAGE 2 & 3: SVD (奇异值分解星空) -> 8B PULSES (八十亿次脉动) (205.83 – 214.62s)
  // =========================================================================
  const svdGroup = new THREE.Group();
  scene.add(svdGroup);

  const STAR_N = 240;
  const CLUSTER_COUNT = 24;
  // 24 Macro-Cluster ("小组织") centers for S24 OP04 // 8B mitosis & recursive subdivision!
  const macroCenters = [];
  for (let c = 0; c < CLUSTER_COUNT; c++) {
    const phi = Math.acos(1 - (2 * (c + 0.5)) / CLUSTER_COUNT);
    const theta = Math.PI * (1 + Math.sqrt(5)) * c;
    const rad = 5.2 + (c % 3) * 1.8;
    macroCenters.push(new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * rad,
      Math.cos(phi) * rad * 0.8,
      Math.sin(phi) * Math.sin(theta) * rad
    ));
  }

  // 420-Point Shared Handoff Cloud (exact seed 24250 shared 1:1 with S25A Star-Runner scatterPos!)
  const handoffRand = mulberry32(24250);
  const handoffCloud = [];
  for (let i = 0; i < 420; i++) {
    handoffCloud.push(new THREE.Vector3(
      0.4 + (handoffRand() - 0.5) * 7.8,
      0.35 + handoffRand() * 4.0,
      (handoffRand() - 0.5) * 4.6
    ));
  }

  const svdStarGeo = new THREE.OctahedronGeometry(0.16, 1);
  const svdStars = [];
  for (let i = 0; i < STAR_N; i++) {
    const p3d = new THREE.Vector3((rand() - 0.5) * 20, (rand() - 0.5) * 14, (rand() - 0.5) * 16);
    const pPlane = new THREE.Vector3(p3d.x * 1.05, 0, p3d.z * 1.05);
    const axisIdx = i % 3;
    const pAxis = new THREE.Vector3(
      axisIdx === 0 ? p3d.x * 1.25 : 0,
      axisIdx === 1 ? p3d.y * 1.25 : 0,
      axisIdx === 2 ? p3d.z * 1.25 : 0
    );
    const clusterIdx = i % CLUSTER_COUNT;
    const subIdx = Math.floor(i / CLUSTER_COUNT); // 0..9 sub-cells per macro-cluster!
    // Level-1 mitosis offset (splits macro-cluster into 3 sub-groups)
    const g1Ang = (subIdx % 3) * ((Math.PI * 2) / 3) + clusterIdx * 0.7;
    const split1 = new THREE.Vector3(Math.cos(g1Ang) * 1.85, Math.sin(g1Ang * 1.3) * 1.35, Math.sin(g1Ang) * 1.85);
    // Level-2 mitosis offset (subdivides further into fine drifting micro-sparks!)
    const split2 = new THREE.Vector3((rand() - 0.5) * 6.8, (rand() - 0.5) * 5.8, (rand() - 0.5) * 6.8);

    const m = new THREE.Mesh(svdStarGeo, i % 3 === 0 ? goldMat : i % 3 === 1 ? cyanMat : whiteMat);
    svdGroup.add(m);
    svdStars.push({
      mesh: m,
      p3d,
      pPlane,
      pAxis,
      macroPos: macroCenters[clusterIdx],
      split1,
      split2,
      ph: rand() * 6.28
    });
  }

  // 260 Ultra-Fine Tertiary Micro-Sparks that bud off & dissolve into fine stardust during final subdivision!
  const microGeo = new THREE.OctahedronGeometry(0.075, 0);
  const microSparks = [];
  for (let i = 0; i < 260; i++) {
    const parent = svdStars[i % STAR_N];
    const m = new THREE.Mesh(microGeo, i % 2 === 0 ? goldMat : cyanMat);
    m.visible = false;
    svdGroup.add(m);
    microSparks.push({
      mesh: m,
      parent,
      drift: new THREE.Vector3((rand() - 0.5) * 7.5, (rand() - 0.5) * 6.5, (rand() - 0.5) * 7.5),
      delay: 0.28 + rand() * 0.25
    });
  }

  // 3 Luminous Principal Singular Value Axes (σ₁ Gold X, σ₂ Cyan Y, σ₃ Gold-White Z)
  const axisX = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 26, 10).rotateZ(Math.PI / 2), goldMat);
  const axisY = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 20, 10), cyanMat);
  const axisZ = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 22, 10).rotateX(Math.PI / 2), goldMat);
  const axesGroup = new THREE.Group();
  axesGroup.add(axisX, axisY, axisZ);
  svdGroup.add(axesGroup);

  // Live Orthogonal Projection Drop-Lines (shows every star factorizing onto σ₁/σ₂/σ₃, then morphing into 8B radial pulse rays!)
  const dropPos = new Float32Array(STAR_N * 2 * 3);
  const dropT = new Float32Array(STAR_N * 2);
  const dropSeed = new Float32Array(STAR_N * 2);
  for (let i = 0; i < STAR_N; i++) {
    dropT[i * 2 + 0] = 0; dropT[i * 2 + 1] = 1;
    dropSeed[i * 2 + 0] = i * 0.85; dropSeed[i * 2 + 1] = i * 0.85;
  }
  const dropGeo = new THREE.BufferGeometry();
  dropGeo.setAttribute("position", new THREE.BufferAttribute(dropPos, 3));
  dropGeo.setAttribute("aT", new THREE.BufferAttribute(dropT, 1));
  dropGeo.setAttribute("aSeed", new THREE.BufferAttribute(dropSeed, 1));
  const dropLineMat = createOperatorLineMaterial(0x42d4ff, 0xffe484, 0.30);
  const dropLines = new THREE.LineSegments(dropGeo, dropLineMat);
  dropLines.frustumCulled = false;
  svdGroup.add(dropLines);

  // 6 Synchronized 8-Billion-Pulse Expanding Shockwave Rings (Stage 3 Climax!)
  const pulsePlaneGeo = new THREE.PlaneGeometry(2.0, 2.0);
  const pulseWaves = [0, 1, 2, 3, 4, 5].map((i) => {
    const mat = createPulseWaveMaterial(i % 2 === 0 ? 0xffbe3b : 0x48dcff);
    const mesh = new THREE.Mesh(pulsePlaneGeo, mat);
    mesh.visible = false;
    svdGroup.add(mesh);
    return { mesh, mat, phase: i / 6 };
  });

  return {
    scene,
    update(submode, u, time, camera, audio) {
      const bass = audio ? audio.bass : 0;

      // Four rapid operator stages synced to exact lyrics (197.13 -> 214.62s)!
      const stage = time < 201.69 ? 0 : time < 205.83 ? 1 : time < 210.10 ? 2 : 3;

      resnetGroup.visible = stage === 0;
      attnGroup.visible = stage === 1;
      svdGroup.visible = stage === 2 || stage === 3;

      if (stage === 0) {
        // === RESNET: 加速 · 剥离残差的波动 (197.13 – 201.69s) ===
        const p = clamp((time - 197.13) / 4.56, 0, 1);
        const localT = p * 4.56;

        // Keep Skip-Connection Beam 100% locked dead-center VERTICAL (exact same position & angle as S22's beam — ZERO jump!)
        resnetGroup.rotation.set(0, 0, 0);

        skipMat.uniforms.uTime.value = localT;
        skipMat.uniforms.uPower.value = 1.0 + p * 0.65 + bass * 0.35;
        skipBeam.scale.set(1.0 + bass * 0.25, 1.0, 1.0 + bass * 0.25);

        resWaveMat.uniforms.uTime.value = localT;
        // Smooth fade-in of residual wave shells over p = 0.00..0.18 so S22's pure vertical beam never pops abruptly!
        const resIn = smoothstep(0.0, 0.18, p);
        resWaveMat.uniforms.uPower.value = resIn * (1.0 - smoothstep(0.55, 0.98, p)) * (0.95 + bass * 0.35);

        resShells.forEach((sh) => {
          const peel = smoothstep(sh.delay, sh.delay + 0.52, p);
          sh.mesh.position.set(
            sh.sideX * Math.pow(peel, 1.4) * 9.5,
            sh.yHome + Math.sin(localT * 3.0 + sh.delay * 10) * 0.35,
            Math.pow(peel, 1.5) * 4.5
          );
          sh.mesh.rotation.y = localT * (1.2 + peel * 3.5);
          sh.mesh.scale.setScalar((0.35 + resIn * 0.65) * (1.0 + peel * 2.2));
        });

        camera.fov = 44 + p * 14;
        camera.position.set(Math.sin(p * 1.4) * 5.2, 1.8 - p * 1.2, 15.0 - p * 4.5);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
      } else if (stage === 1) {
        // === ATTENTION: 拆解 · 注意力网的黑洞 (201.69 – 205.83s) ===
        const p = clamp((time - 201.69) / 4.14, 0, 1);
        const localT = p * 4.14;
        const dismantle = smoothstep(0.18, 0.92, p);

        gargantua.group.scale.setScalar(Math.max(0.08, (1.0 - dismantle * 0.72) * (1.0 + bass * 0.08)));
        attnGroup.rotation.y = localT * 0.35;
        attnLineMat.uniforms.uTime.value = localT;
        attnLineMat.uniforms.uPower.value = 0.65 + dismantle * 0.85 + bass * 0.35;

        // 48 Event-Horizon shards crack & peel outward from the dismantled black hole!
        for (let i = 0; i < bhShards.length; i++) {
          const sh = bhShards[i];
          const r = 2.4 + Math.pow(dismantle, 1.2) * 7.8;
          sh.mesh.position.copy(sh.dir).multiplyScalar(r);
          sh.mesh.rotation.set(localT * sh.spin, localT * sh.spin * 0.7, 0);
          sh.mesh.scale.setScalar(0.5 + Math.sin(dismantle * Math.PI) * 0.95);
        }

        // 96 Q/K/V Token Nodes pulse & expand outward as attention weights extract light!
        for (let i = 0; i < attnNodes.length; i++) {
          const an = attnNodes[i];
          const r = an.rBase + dismantle * 3.2 + Math.sin(localT * 5.0 + an.phase) * 0.35;
          an.mesh.position.copy(an.dir).multiplyScalar(r);
          an.mesh.scale.setScalar(0.85 + bass * 0.45);
        }

        camera.fov = 44 + p * 12;
        camera.position.set(Math.sin(p * 1.8) * 14.5, 2.5 - p * 1.5, Math.cos(p * 1.8) * 14.5);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        gargantua.update(localT, camera, bass);
      } else if (stage === 2) {
        // === SVD: 降维 · 奇异值分解星空 (205.83 – 210.10s) ===
        const p = clamp((time - 205.83) / 4.27, 0, 1);
        const localT = p * 4.27;
        const toPlane = smoothstep(0.06, 0.45, p);
        const toAxes = smoothstep(0.42, 0.88, p);

        axesGroup.visible = true;
        axesGroup.scale.setScalar(smoothstep(0.15, 0.55, p));
        svdGroup.rotation.y = localT * 0.32;
        svdGroup.rotation.x = 0.22 + Math.sin(localT * 0.5) * 0.08;
        pulseWaves.forEach((pw) => { pw.mesh.visible = false; });
        microSparks.forEach((ms) => { ms.mesh.visible = false; });

        dropLineMat.uniforms.uTime.value = localT;
        dropLineMat.uniforms.uPower.value = 0.55 + toAxes * 0.65;

        for (let i = 0; i < STAR_N; i++) {
          const st = svdStars[i];
          // 3D Cloud -> 2D Rank-2 Plane -> 3 Orthogonal Principal Singular Axes (σ₁, σ₂, σ₃)!
          const pCur = st.p3d.clone().lerp(st.pPlane, toPlane).lerp(st.pAxis, toAxes);
          st.mesh.position.copy(pCur);
          st.mesh.scale.setScalar(0.85 + toAxes * 0.45 + bass * 0.35);
          const i6 = i * 6;
          dropPos[i6 + 0] = pCur.x; dropPos[i6 + 1] = pCur.y; dropPos[i6 + 2] = pCur.z;
          dropPos[i6 + 3] = st.pAxis.x; dropPos[i6 + 4] = st.pAxis.y; dropPos[i6 + 5] = st.pAxis.z;
        }
        dropGeo.attributes.position.needsUpdate = true;

        camera.fov = 44 + p * 6;
        camera.position.set(Math.sin(p * 1.1) * 16.0, 4.8 - p * 1.6, Math.cos(p * 1.1) * 16.0);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
      } else {
        // === 8B PULSES: 提速 · 在八十亿次脉动 (210.10 – 214.62s) ===
        // 24 Macro-Clusters -> Recursive Mitosis & Subdivision -> Seamless Stardust Coalescence directly into S25A Star-Runner!
        const p = clamp((time - 210.10) / 4.52, 0, 1);
        const localT = p * 4.52;

        const formClusters = smoothstep(0.0, 0.20, p);   // 0.00..0.20: Snap from SVD axes into 24 tight pulsing macro-clusters
        const split1U = smoothstep(0.18, 0.46, p);       // 0.18..0.46: 1st Mitosis — each cluster splits into 3 sub-groups
        const split2U = smoothstep(0.40, 0.72, p);       // 0.40..0.72: 2nd Subdivision — breaks into hundreds of fine stardust sparks
        const gatherU = smoothstep(0.64, 1.00, p);       // 0.64..1.00: Stardust streams & converges into S25A's exact 420-point handoff cloud!
        const threadFade = 1.0 - smoothstep(0.56, 0.86, p);
        const beatPulse = 1.0 + Math.pow(Math.abs(Math.sin(localT * 7.0)), 2.5) * 0.22 + bass * 0.35;

        axesGroup.visible = false;
        // Unwind svdGroup rotation cleanly to 0 so world coordinates match S25A 1:1 at p = 1.0!
        const rotDamp = 1.0 - gatherU;
        svdGroup.rotation.y = localT * 0.42 * rotDamp;
        svdGroup.rotation.x = Math.sin(localT * 0.6) * 0.14 * rotDamp;

        // Synaptic cluster threads connect dividing cells, then dissolve cleanly as stardust begins coalescing
        dropLineMat.uniforms.uTime.value = localT * 1.6;
        dropLineMat.uniforms.uPower.value = (0.75 * (1.0 - split2U * 0.65)) * threadFade * (0.9 + bass * 0.35);

        const swirlArc = Math.sin(gatherU * Math.PI);
        for (let i = 0; i < STAR_N; i++) {
          const st = svdStars[i];
          const pCluster = st.macroPos.clone().multiplyScalar(beatPulse);
          const pDiv1 = pCluster.clone().addScaledVector(st.split1, split1U);
          const pSub = pDiv1.addScaledVector(st.split2, Math.pow(split2U, 1.15));
          const pCur = st.pAxis.clone().lerp(pSub, formClusters);

          // Stream seamlessly into the first 240 points of S25A's exact scatterPos cloud!
          const pTarget = handoffCloud[i];
          pCur.lerp(pTarget, gatherU);
          if (swirlArc > 0.005) {
            pCur.x += Math.cos(st.ph + localT * 3.2) * swirlArc * 1.1;
            pCur.y += Math.sin(st.ph * 1.3 + localT * 2.8) * swirlArc * 0.85;
            pCur.z += Math.sin(st.ph + localT * 2.5) * swirlArc * 0.9;
          }

          st.mesh.position.copy(pCur);
          // Smoothly converge radius to 0.082 (scale 0.5125 of r=0.16) to match S25A bodyStars!
          const baseSize = (1.35 - split1U * 0.42 - split2U * 0.36) * (0.9 + bass * 0.25);
          const cellSize = THREE.MathUtils.lerp(baseSize, 0.52, gatherU);
          st.mesh.visible = true;
          st.mesh.scale.setScalar(Math.max(0.01, cellSize));

          const i6 = i * 6;
          dropPos[i6 + 0] = pCluster.x; dropPos[i6 + 1] = pCluster.y; dropPos[i6 + 2] = pCluster.z;
          dropPos[i6 + 3] = pCur.x; dropPos[i6 + 4] = pCur.y; dropPos[i6 + 5] = pCur.z;
        }
        dropGeo.attributes.position.needsUpdate = true;

        // 260 Tertiary Micro-Sparks: first 180 stream into handoffCloud[240..419], remaining 80 fade gently!
        for (let i = 0; i < microSparks.length; i++) {
          const ms = microSparks[i];
          const budU = smoothstep(ms.delay * 0.85, ms.delay * 0.85 + 0.28, p);
          if (i < 180) {
            const pTarget = handoffCloud[STAR_N + i];
            const msPos = ms.parent.mesh.position.clone().addScaledVector(ms.drift, Math.pow(budU, 1.1) * (1.0 - gatherU));
            msPos.lerp(pTarget, gatherU);
            if (swirlArc > 0.005) {
              msPos.x += Math.cos(i * 0.73 + localT * 3.4) * swirlArc * 0.95;
              msPos.y += Math.sin(i * 0.91 + localT * 3.0) * swirlArc * 0.75;
              msPos.z += Math.sin(i * 0.57 + localT * 2.7) * swirlArc * 0.85;
            }
            const microSize = THREE.MathUtils.lerp(budU * (0.95 + bass * 0.3), 1.09, gatherU);
            ms.mesh.visible = microSize > 0.015;
            if (ms.mesh.visible) {
              ms.mesh.position.copy(msPos);
              ms.mesh.scale.setScalar(microSize);
            }
          } else {
            const microSize = budU * (1.0 - smoothstep(0.62, 0.94, p)) * (0.95 + bass * 0.35);
            ms.mesh.visible = microSize > 0.015;
            if (ms.mesh.visible) {
              ms.mesh.position.copy(ms.parent.mesh.position).addScaledVector(ms.drift, Math.pow(budU, 1.1));
              ms.mesh.scale.setScalar(microSize);
            }
          }
        }

        // Smooth camera glide over p = 0.54..1.00 directly into S25A's exact start pose (-2.2, 2.15, 7.8) -> lookAt(1.8, 2.0, 0.0), fov = 42.0!
        const camGlide = smoothstep(0.54, 1.0, p);
        const orbitR = 15.5 - p * 3.5;
        const orbX = Math.sin(p * 1.4) * orbitR;
        const orbY = 2.8 - p * 1.4;
        const orbZ = Math.cos(p * 1.4) * orbitR;
        camera.fov = THREE.MathUtils.lerp(46 + p * 12 + bass * 2.0, 42.0, camGlide);
        camera.position.set(
          THREE.MathUtils.lerp(orbX, -2.2, camGlide),
          THREE.MathUtils.lerp(orbY, 2.15, camGlide),
          THREE.MathUtils.lerp(orbZ, 7.8, camGlide)
        );
        camera.lookAt(
          THREE.MathUtils.lerp(0.0, 1.8, camGlide),
          THREE.MathUtils.lerp(0.0, 2.0, camGlide),
          0.0
        );
        camera.updateProjectionMatrix();

        pulseWaves.forEach((pw) => {
          const cyc = (localT * 0.78 + pw.phase) % 1.0;
          pw.mesh.visible = threadFade > 0.02;
          if (pw.mesh.visible) {
            pw.mesh.quaternion.copy(camera.quaternion);
            pw.mesh.scale.setScalar(1.5 + Math.pow(cyc, 0.75) * 28.0);
            pw.mat.uniforms.uOpacity.value = Math.sin(cyc * Math.PI) * (0.65 + bass * 0.3) * threadFade;
          }
        });
      }

      return { sunDir: new THREE.Vector3(0.5, 0.7, 0.6), clearColor: 0x040510, shadowBounds: null };
    }
  };
}
