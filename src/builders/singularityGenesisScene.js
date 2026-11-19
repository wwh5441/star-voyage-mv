import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { mulberry32, clamp, smoothstep } from "../core/math.js";
import { buildStarfield } from "./cosmicPrimitives.js";
import { buildGargantuaBlackHole } from "./gargantuaBlackHole.js";

// Custom GLSL3 MRT S21A Genesis Pinpoint Shader (exact pixel-for-pixel match to S20's final dead-center pinpoint!)
function createGenesisPinpointMaterial() {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uPower: { value: 1.0 } },
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
      uniform float uPower;
      in vec2 vUv;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float core = exp(-r * r * 26.0) * 2.4;
        float halo = exp(-r * 4.5) * 0.85;
        float streak = exp(-abs(p.y) * 24.0) * exp(-abs(p.x) * 2.0) * 0.75;
        vec3 col = vec3(1.0, 0.97, 0.88) * core + vec3(1.0, 0.78, 0.40) * halo + vec3(0.55, 0.90, 1.0) * streak;
        float a = clamp((core + halo + streak) * uPower, 0.0, 1.0);
        gColor = vec4(col * uPower, a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Custom GLSL3 MRT Tidal Disruption Star-Stream Shader (S21B: luminous stellar plasma rivers torn apart & spiraling into the Black Hole!)
function createTidalStreamMaterial() {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPower: { value: 1.0 }
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
      in float vT;
      in float vSeed;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        // Flows INWARD (from vT = 0 outer space -> vT = 1 event horizon throat!)
        float pulse = pow(0.5 + 0.5 * sin(vT * 14.0 - uTime * 6.5 + vSeed), 4.0);
        float endFade = smoothstep(0.0, 0.14, vT) * smoothstep(1.0, 0.86, vT);
        vec3 outerCyan = vec3(0.36, 0.84, 1.0);
        vec3 midGold = vec3(1.0, 0.72, 0.28);
        vec3 hotWhite = vec3(1.0, 0.96, 0.84);
        vec3 col = mix(outerCyan, midGold, smoothstep(0.15, 0.72, vT));
        col = mix(col, hotWhite, clamp(pulse * 0.8 + smoothstep(0.78, 1.0, vT) * 0.65, 0.0, 1.0));
        float a = clamp((0.24 + pulse * 0.72) * endFade * uPower, 0.0, 1.0);
        gColor = vec4(col * (1.1 + pulse * 1.4), a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Custom GLSL3 MRT Relativistic Einstein-Rosen Wormhole Tunnel Shader (S21C: crossing the photon sphere into warped light!)
function createWormholeTunnelMaterial() {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    uniforms: {
      uTime: { value: 0 },
      uBass: { value: 0 },
      uProgress: { value: 0 }
    },
    vertexShader: `
      precision highp float;
      in vec3 position;
      in vec2 uv;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      uniform float uTime;
      out vec2 vUv;
      void main() {
        vUv = uv;
        // Gentle gravitational wave distortion along the wormhole throat
        vec3 p = position;
        float twist = sin(p.z * 0.08 + uTime * 2.2) * 1.2;
        p.x += twist * (1.0 - uv.y);
        p.y += cos(p.z * 0.07 - uTime * 1.9) * 1.0 * (1.0 - uv.y);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uBass;
      uniform float uProgress;
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

      void main() {
        float ang = vUv.x * 6.283185;
        // High-speed blue-shifted relativistic starlight streaks rushing down the wormhole!
        float streaks = noise(vec2(cos(ang) * 6.0 + sin(ang) * 6.0, vUv.y * 12.0 - uTime * 7.5));
        float fine = noise(vec2(cos(ang) * 16.0, vUv.y * 28.0 - uTime * 14.0));
        float rings = pow(0.5 + 0.5 * sin(vUv.y * 42.0 - uTime * 12.0), 6.0);

        float env = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.15, vUv.y);
        vec3 colDeepViolet = vec3(0.32, 0.18, 0.78);
        vec3 colBlueShift = vec3(0.24, 0.82, 1.0);
        vec3 colGoldFold = vec3(1.0, 0.84, 0.44);

        vec3 col = mix(colDeepViolet, colBlueShift, clamp(streaks * 0.9 + fine * 0.4, 0.0, 1.0));
        col = mix(col, colGoldFold, clamp(rings * 0.85 + uProgress * 0.35, 0.0, 1.0));

        float a = clamp(env * (0.28 + streaks * 0.52 + fine * 0.32 + rings * 0.55) * (0.95 + uBass * 0.35), 0.0, 1.0);
        gColor = vec4(col * (1.05 + rings * 1.15 + uBass * 0.35), a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Custom GLSL3 MRT 4D Interstellar Tesseract / Tensor Lattice Shader (S22: inside the singularity -> crystallizing into S23's AI Operators!)
function createTesseractLineMaterial() {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uCrystallize: { value: 0.0 },
      uBass: { value: 0.0 }
    },
    vertexShader: `
      precision highp float;
      in vec3 position;
      in float aT;
      in float aAxis;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      out float vT;
      out float vAxis;
      out float vDepth;
      void main() {
        vT = aT;
        vAxis = aAxis;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uCrystallize;
      uniform float uBass;
      in float vT;
      in float vAxis;
      in float vDepth;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        float distFade = smoothstep(55.0, 4.0, vDepth);
        float pulse = pow(0.5 + 0.5 * sin(vT * 18.0 - uTime * 5.5 + vAxis * 2.1), 5.0);
        vec3 colGold = vec3(1.0, 0.80, 0.38);
        vec3 colCyan = vec3(0.32, 0.86, 1.0);
        vec3 colWhite = vec3(1.0, 0.96, 0.88);
        vec3 baseCol = vAxis > 0.5 ? colGold : colCyan;
        vec3 col = mix(baseCol, colWhite, pulse * 0.78);
        float a = clamp((0.20 + pulse * 0.65) * distFade * uCrystallize * (0.95 + uBass * 0.35), 0.0, 1.0);
        gColor = vec4(col * (1.0 + pulse * 1.4), a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// S21A / S21B / S21C / S22: Original 4-Act Cosmic Genesis & Singularity Odyssey (174.5 - 197.1s, ZERO recycled scenes!)
export function buildSingularityGenesisScene() {
  const scene = new THREE.Scene();
  const rand = mulberry32(21999);
  // EXACT SAME starfield seed & count as S20 (3400, 560, 20209) so S20 -> S21A is 100% pixel-seamless ONE-TAKE!
  const starfield = buildStarfield(3400, 560, 20209);
  scene.add(starfield);

  // === ACT 1 & 2 ASSETS: GARGANTUA BLACK HOLE + GENESIS PINPOINT + TIDAL STAR-STREAMS ===
  const gargantua = buildGargantuaBlackHole();
  scene.add(gargantua.group);

  const genesisMat = createGenesisPinpointMaterial();
  const genesisPinpoint = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), genesisMat);
  scene.add(genesisPinpoint);

  // Relativistic Explosion Shockwave Ring for S21B's 03:04 Quasar/Singularity Detonation!
  const blastRingMat = createCelMaterial({
    color: 0xfff2c2, emissive: 0xffc048, emissiveStrength: 3.4,
    unlit: true, noInk: true, transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
  });
  const blastRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.08, 64), blastRingMat);
  blastRing.visible = false;
  scene.add(blastRing);

  // S21B: 32 Sweeping Parabolic Tidal Disruption Star-Streams pouring from outer space straight into the Black Hole!
  const tidalPos = [], tidalT = [], tidalSeed = [];
  for (let i = 0; i < 32; i++) {
    const ang0 = (i / 32) * Math.PI * 2 + (rand() - 0.5) * 0.25;
    const elev = (rand() - 0.5) * 14.0;
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const f = k / 6; // 0 = far outer starfield (r=34), 1 = event horizon (r=2.8)
      const r = 34.0 * Math.pow(1.0 - f, 1.35) + 2.8;
      const a = ang0 + f * 3.2; // Spirals rapidly as angular momentum accelerates!
      const y = elev * Math.pow(1.0 - f, 1.6) + Math.sin(a) * r * 0.14;
      pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    for (let s = 0; s < 28; s++) {
      const t0 = s / 28, t1 = (s + 1) / 28;
      const a = curve.getPoint(t0), b = curve.getPoint(t1);
      tidalPos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      tidalT.push(t0, t1);
      tidalSeed.push(i * 1.15, i * 1.15);
    }
  }
  const tidalGeo = new THREE.BufferGeometry();
  tidalGeo.setAttribute("position", new THREE.Float32BufferAttribute(tidalPos, 3));
  tidalGeo.setAttribute("aT", new THREE.Float32BufferAttribute(tidalT, 1));
  tidalGeo.setAttribute("aSeed", new THREE.Float32BufferAttribute(tidalSeed, 1));
  const tidalMat = createTidalStreamMaterial();
  const tidalStreams = new THREE.LineSegments(tidalGeo, tidalMat);
  scene.add(tidalStreams);

  // === ACT 3 ASSETS (S21C): RELATIVISTIC EINSTEIN-ROSEN WORMHOLE LIGHT-TUNNEL ===
  const wormholeGroup = new THREE.Group();
  scene.add(wormholeGroup);

  const wormholeMat = createWormholeTunnelMaterial();
  const wormholeGeo = new THREE.CylinderGeometry(7.2, 7.2, 130, 48, 36, true);
  wormholeGeo.rotateX(Math.PI / 2);
  const wormholeMesh = new THREE.Mesh(wormholeGeo, wormholeMat);
  wormholeMesh.position.z = -50;
  wormholeGroup.add(wormholeMesh);

  // 14 Folded Relativistic Golden-Cyan Light Rings rushing past the camera inside the wormhole
  const whRingGold = createCelMaterial({
    color: 0xffe89e, emissive: 0xffb830, emissiveStrength: 2.6,
    unlit: true, noInk: true, transparent: true, opacity: 0.65,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const whRingCyan = createCelMaterial({
    color: 0x9cf4ff, emissive: 0x38d2ff, emissiveStrength: 2.5,
    unlit: true, noInk: true, transparent: true, opacity: 0.58,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const whRings = [];
  for (let i = 0; i < 14; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(5.6 + (i % 3) * 0.55, 0.055, 8, 48), i % 2 === 0 ? whRingGold : whRingCyan);
    wormholeGroup.add(r);
    whRings.push({ mesh: r, z0: -i * 9.0 });
  }

  // Blinding white-gold wormhole exit singularity light straight ahead at z = -115
  const exitLightMat = createGenesisPinpointMaterial();
  const exitLight = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), exitLightMat);
  exitLight.position.set(0, 0, -110);
  wormholeGroup.add(exitLight);

  // === ACT 4 ASSETS (S22): INFINITE 4D INTERSTELLAR TESSERACT / TENSOR OPERATOR SPACE ===
  const tesseractGroup = new THREE.Group();
  scene.add(tesseractGroup);

  const tessPos = [], tessT = [], tessAxis = [];
  const gridSpan = 28.0;
  const gridStep = 4.0;
  for (let a = -3; a <= 3; a++) {
    for (let b = -3; b <= 3; b++) {
      const c1 = a * gridStep, c2 = b * gridStep;
      // Z-rays (deep golden infinite time-strings!)
      tessPos.push(c1, c2, -gridSpan, c1, c2, gridSpan);
      tessT.push(0, 1); tessAxis.push(1.0, 1.0);
      // X-beams (cyan spatial tensor axes!)
      tessPos.push(-gridSpan, c1, c2, gridSpan, c1, c2);
      tessT.push(0, 1); tessAxis.push(0.0, 0.0);
      // Y-pillars (alternating gold/cyan!)
      tessPos.push(c1, -gridSpan, c2, c1, gridSpan, c2);
      tessT.push(0, 1); tessAxis.push((a + b) % 2 === 0 ? 1.0 : 0.0, (a + b) % 2 === 0 ? 1.0 : 0.0);
    }
  }
  const tessGeo = new THREE.BufferGeometry();
  tessGeo.setAttribute("position", new THREE.Float32BufferAttribute(tessPos, 3));
  tessGeo.setAttribute("aT", new THREE.Float32BufferAttribute(tessT, 1));
  tessGeo.setAttribute("aAxis", new THREE.Float32BufferAttribute(tessAxis, 1));
  const tessMat = createTesseractLineMaterial();
  tesseractGroup.add(new THREE.LineSegments(tessGeo, tessMat));

  // Central Awakened 4D Hypercube Operator Core (2 nested rotating golden & cyan wireframe cubes + blazing core!)
  const hyperCore = new THREE.Group();
  tesseractGroup.add(hyperCore);
  const cubeGoldMat = createCelMaterial({ color: 0xffe49e, emissive: 0xffb830, emissiveStrength: 2.8, unlit: true, noInk: true, wireframe: true });
  const cubeCyanMat = createCelMaterial({ color: 0x9cf4ff, emissive: 0x38d2ff, emissiveStrength: 2.6, unlit: true, noInk: true, wireframe: true });
  const outerCube = new THREE.Mesh(new THREE.BoxGeometry(5.2, 5.2, 5.2), cubeGoldMat);
  const innerCube = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.8, 2.8), cubeCyanMat);
  const coreOrb = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.95, 2),
    createCelMaterial({ color: 0xfff6d8, emissive: 0xffc84d, emissiveStrength: 3.2, unlit: true, noInk: true })
  );
  hyperCore.add(outerCube, innerCube, coreOrb);

  // S22 Climax: Piercing Vertical Penetrating Light Beam shooting BOTH STRAIGHT UP (+Y) & DOWN (-Y) -> launches directly into S23!
  const vBeamMat = new THREE.RawShaderMaterial({
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
        float distFromCenter = abs(vUv.y * 2.0 - 1.0);
        float pulse = pow(0.5 + 0.5 * sin(distFromCenter * 24.0 - uTime * 16.0), 4.0);
        float core = pow(vCore, 1.6);
        float env = smoothstep(1.0, 0.12, distFromCenter);
        vec3 col = mix(vec3(0.38, 0.88, 1.0), vec3(1.0, 0.94, 0.72), core * 0.75 + pulse * 0.4);
        float a = clamp(env * (core * 0.85 + 0.15) * (0.8 + pulse * 0.55) * uPower, 0.0, 1.0);
        gColor = vec4(col * (1.25 + pulse * 1.4) * uPower, a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
  const verticalBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 120.0, 24, 16, true), vBeamMat);
  verticalBeam.visible = false;
  scene.add(verticalBeam);

  const verticalCoreMat = createCelMaterial({
    color: 0xffffff, emissive: 0xffe89e, emissiveStrength: 3.4,
    unlit: true, noInk: true, transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const verticalCore = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 120.0, 12, 1, true), verticalCoreMat);
  verticalCore.visible = false;
  scene.add(verticalCore);

  return {
    scene,
    update(submode, u, time, camera, audio) {
      const bass = audio ? audio.bass : 0;
      const s = smoothstep(0.0, 1.0, u);

      // Hide all act groups first, then activate the exact act!
      gargantua.group.visible = false;
      genesisPinpoint.visible = false;
      blastRing.visible = false;
      tidalStreams.visible = false;
      wormholeGroup.visible = false;
      tesseractGroup.visible = false;
      verticalBeam.visible = false;
      verticalCore.visible = false;
      starfield.visible = true;

      if (submode === "genesis") {
        // === S21A (174.5 - 178.0s, 3.5s): 100% Pixel-Seamless ONE-TAKE from S20 end!
        // Exact same starfield + exact same starting camera pose (44.11, 58.0, 80.74, fov=62) gliding smoothly inward toward the lone pinpoint!
        // Holds pure lone pinpoint until 02:57.0 (u = 0.714), THEN begins steady linear growth into Gargantua Black Hole! ===
        const localT = u * 3.5;
        const growLin = clamp((u - 0.714) / 0.286, 0.0, 1.0); // Strictly linear 0 -> 1 from 02:57 to 02:58!
        gargantua.group.visible = growLin > 0.005;
        gargantua.group.scale.setScalar(Math.max(0.001, growLin * 0.14));
        gargantua.funnelLines.visible = false;

        // Smooth camera glide from S20 exact end pose -> S21B exact start pose (0, 0.7, 25.5, fov=38)!
        const s20EndPos = new THREE.Vector3(Math.sin(0.50) * 92.0, 58.0, Math.cos(0.50) * 92.0);
        const s21BStartPos = new THREE.Vector3(0.0, 0.7, 25.5);
        const glide = smoothstep(0.0, 1.0, u);
        camera.position.copy(s20EndPos).lerp(s21BStartPos, glide);
        camera.fov = 62.0 * (1.0 - glide) + 38.0 * glide;
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();

        // Match S20 final pinpoint apparent size (world diameter 42 * 0.14 = 5.88 -> 5.88 / 18 = 0.3267) and smoothly scale as camera approaches!
        genesisPinpoint.visible = true;
        const breathe = 0.012 * Math.sin(localT * 3.5);
        const pScale = 0.3267 * (1.0 - glide) + (0.24 + breathe) * glide;
        genesisPinpoint.scale.setScalar(pScale);
        genesisMat.uniforms.uPower.value = 1.35 + growLin * 0.20;
        genesisPinpoint.quaternion.copy(camera.quaternion);

        gargantua.update(localT, camera, bass);
        return { sunDir: new THREE.Vector3(-0.6, 0.5, 0.6), clearColor: 0x040610, shadowBounds: null };
      }

      if (submode === "devour") {
        // === S21B (178.0 - 184.0s, exact 02:58 - 03:04 6.0s!):
        // 0.00..0.82 (02:58 - 03:02.9): Strictly STEADY LINEAR bit-by-bit growth (0.14 -> 0.92) + 32 Tidal Disruption Star-Streams!
        // 0.82..1.00 (03:02.9 - 03:04.0): UNCONTROLLABLE RUNAWAY CRITICAL EXPANSION (0.92 -> 2.35) & QUASAR EXPLOSION into S21C! ===
        const localT = u * 6.0;
        const linearGrow = 0.14 + clamp(u / 0.82, 0.0, 1.0) * 0.78; // Steady constant rate 0.14 -> 0.92!
        const explodeU = clamp((u - 0.82) / 0.18, 0.0, 1.0);
        const runaway = Math.pow(explodeU, 2.4) * 1.45; // Sudden uncontrollable blowup only in final 1.1s!

        gargantua.group.visible = true;
        gargantua.group.scale.setScalar((linearGrow + runaway) * (1.0 + bass * 0.04 + explodeU * 0.15));
        gargantua.funnelLines.visible = u > 0.15;

        // 32 GLSL3 Tidal Disruption Star-Streams torn from deep space & spiraling into the steadily growing accretion disk!
        tidalStreams.visible = true;
        tidalStreams.rotation.y = localT * 0.14;
        tidalMat.uniforms.uTime.value = localT * (1.0 + explodeU * 1.4);
        tidalMat.uniforms.uPower.value = smoothstep(0.0, 0.25, u) * (0.95 + bass * 0.30 + explodeU * 1.1);

        // Pinpoint gently fades out as infant black hole grows, then flares blindingly on final uncontrollable explosion (u > 0.82)!
        const earlyFade = 1.0 - smoothstep(0.0, 0.28, u);
        if (earlyFade > 0.01) {
          genesisPinpoint.visible = true;
          genesisPinpoint.scale.setScalar(0.24 * earlyFade);
          genesisMat.uniforms.uPower.value = 1.55 * earlyFade;
        } else if (explodeU > 0.01) {
          genesisPinpoint.visible = true;
          genesisPinpoint.scale.setScalar(0.35 + Math.pow(explodeU, 1.8) * 6.8);
          genesisMat.uniforms.uPower.value = Math.pow(explodeU, 1.3) * 3.8;

          blastRing.visible = true;
          blastRing.scale.setScalar(2.0 + Math.pow(explodeU, 0.75) * 42.0);
          blastRingMat.uniforms.uOpacity.value = Math.sin(explodeU * Math.PI) * 1.0;
        }

        // Seamless camera handoff from S21A end (0, 0.7, 25.5) -> steady accelerating dive straight into the blazing photon ring!
        const ang = u * 1.35;
        const dist = 25.5 - u * 14.5 - Math.pow(explodeU, 1.6) * 5.2;
        const shake = Math.pow(u, 2.2) * 0.08 + Math.pow(explodeU, 1.5) * (0.32 + bass * 0.18);
        camera.fov = 38 + u * 14 + Math.pow(explodeU, 1.5) * 20;
        camera.position.set(
          Math.sin(ang) * dist + Math.sin(time * 58) * shake,
          0.7 + Math.sin(u * Math.PI) * 4.8 - u * 0.6 + Math.cos(time * 51) * shake,
          Math.cos(ang) * dist
        );
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        if (genesisPinpoint.visible) genesisPinpoint.quaternion.copy(camera.quaternion);
        if (blastRing.visible) blastRing.quaternion.copy(camera.quaternion);
        gargantua.update(3.5 + localT, camera, bass);
        return { sunDir: new THREE.Vector3(-0.6, 0.5, 0.6), clearColor: 0x03040a, shadowBounds: null };
      }

      if (submode === "wormhole") {
        // === S21C (184.0 - 191.0s, 7.0s): Wormhole Light-Corridor -> Second half crystallizes 4D Tesseract lines for 100% seamless ONE-TAKE into S22! ===
        const localT = u * 7.0;
        const whFade = 1.0 - smoothstep(0.68, 1.0, u);
        const tessIn = smoothstep(0.42, 0.96, u);
        const settle = smoothstep(0.55, 1.0, u);

        wormholeGroup.visible = whFade > 0.01;
        if (wormholeGroup.visible) {
          wormholeMat.uniforms.uTime.value = localT;
          wormholeMat.uniforms.uBass.value = bass * whFade - (1.0 - whFade) * 1.5;
          wormholeMat.uniforms.uProgress.value = u;

          const span = 14 * 9.0;
          for (let i = 0; i < whRings.length; i++) {
            const r = whRings[i];
            const z = (((r.z0 + localT * 38.0 + 115.0) % span) + span) % span - 115.0;
            r.mesh.position.z = z;
            r.mesh.rotation.z = localT * (i % 2 === 0 ? 0.6 : -0.5) + i * 0.4;
            r.mesh.scale.setScalar((1.0 + bass * 0.12) * whFade);
          }
          whRingGold.uniforms.uOpacity.value = 0.65 * whFade;
          whRingCyan.uniforms.uOpacity.value = 0.58 * whFade;

          exitLightMat.uniforms.uPower.value = (0.6 + Math.pow(u, 1.4) * 1.8 + bass * 0.35) * whFade;
          exitLight.scale.setScalar(0.8 + Math.pow(u, 1.6) * 2.0);
        }

        // Second half (u > 0.40): 4D Tesseract coordinate lines crystallize right inside the wormhole!
        tesseractGroup.visible = tessIn > 0.005;
        if (tesseractGroup.visible) {
          tessMat.uniforms.uTime.value = localT;
          tessMat.uniforms.uCrystallize.value = tessIn;
          tessMat.uniforms.uBass.value = bass;
          tesseractGroup.rotation.z = localT * 0.04;
          outerCube.rotation.set(localT * 0.35, localT * 0.48, localT * 0.22);
          innerCube.rotation.set(-localT * 0.55, localT * 0.65, -localT * 0.38);
          hyperCore.scale.setScalar(smoothstep(0.62, 1.0, u) * 0.45);
          coreOrb.scale.setScalar(0.85 + bass * 0.35);
        }

        // Smooth camera handoff from wormhole rush -> EXACT S22 start pose at u = 1.0!
        const endPos = new THREE.Vector3(Math.sin(-0.55) * 16.5, 3.5, Math.cos(-0.55) * 16.5);
        const shake = (0.06 + bass * 0.09) * (1.0 - settle);
        const whPos = new THREE.Vector3(
          Math.sin(localT * 1.1) * 1.4 + Math.sin(time * 58) * shake,
          Math.cos(localT * 0.9) * 1.1 + Math.cos(time * 51) * shake,
          10.0
        );
        camera.position.copy(whPos).lerp(endPos, settle);

        const whLook = new THREE.Vector3(Math.sin(localT * 0.7) * 2.2, Math.cos(localT * 0.6) * 1.8, -80.0);
        const lookPt = whLook.lerp(new THREE.Vector3(0, 0, 0), settle);
        camera.fov = (56 + Math.sin(u * Math.PI) * 12) * (1.0 - settle) + 46.0 * settle;
        camera.lookAt(lookPt);
        const roll = (Math.sin(localT * 0.85) * 0.35 + u * 0.55) * (1.0 - settle);
        camera.rotation.z += roll;
        camera.updateProjectionMatrix();
        return { sunDir: new THREE.Vector3(0, 1, 0), clearColor: 0x050412, shadowBounds: null };
      }

      // === S22 (191.0 - 197.1s, 6.1s): Seamless ONE-TAKE continuation inside the 4D Tesseract -> S23 AI Operators! ===
      const localT = 7.0 + u * 6.1; // Continuous clock straight from S21C end (7.0s)!
      tesseractGroup.visible = true;

      // Gently dissolve the Tesseract grid & hypercube into the blazing vertical beam in the final 30% (u = 0.68..0.99)
      // so S22 hands off cleanly into S23's exact vertical Skip-Connection beam!
      const tessKeep = 1.0 - smoothstep(0.68, 0.99, u);
      tessMat.uniforms.uTime.value = localT;
      tessMat.uniforms.uCrystallize.value = tessKeep;
      tessMat.uniforms.uBass.value = bass;

      tesseractGroup.rotation.z = localT * 0.04;
      outerCube.rotation.set(localT * 0.35, localT * 0.48, localT * 0.22);
      innerCube.rotation.set(-localT * 0.55, localT * 0.65, -localT * 0.38);
      coreOrb.scale.setScalar((0.85 + smoothstep(0.0, 0.7, u) * 0.45 + bass * 0.42) * Math.max(0.01, tessKeep));
      hyperCore.scale.setScalar((0.45 + smoothstep(0.0, 0.45, u) * 0.55) * Math.max(0.01, tessKeep));

      // S22 Climax (u = 0.45 -> 1.00): Awakened 4D Core fires a piercing VERTICAL LIGHT BEAM both UP (+Y) & DOWN (-Y) -> launches straight into S23!
      const beamU = smoothstep(0.45, 0.88, u);
      verticalBeam.visible = beamU > 0.01;
      verticalCore.visible = beamU > 0.01;
      if (verticalBeam.visible) {
        vBeamMat.uniforms.uTime.value = localT;
        vBeamMat.uniforms.uPower.value = beamU * (1.0 + bass * 0.35);
        verticalBeam.scale.set(0.35 + beamU * 0.95, Math.max(0.02, beamU), 0.35 + beamU * 0.95);
        verticalCore.scale.set(0.5 + beamU * 0.85, Math.max(0.02, beamU), 0.5 + beamU * 0.85);
        verticalCoreMat.uniforms.uOpacity.value = beamU * 0.92;
      }

      // Smoothly orbits & settles at u = 1.0 onto S23's EXACT starting camera pose (0.0, 1.8, 15.0, fov = 44.0)!
      const handoff = smoothstep(0.52, 1.0, u);
      const orbitAng = (-0.55 + s * 1.15) * (1.0 - handoff); // Returns cleanly to 0.0 at u=1.0!
      const dist = THREE.MathUtils.lerp(16.5 - s * 4.5, 15.0, handoff);
      camera.fov = THREE.MathUtils.lerp(46.0 + s * 6.0, 44.0, handoff);
      camera.position.set(
        Math.sin(orbitAng) * dist,
        THREE.MathUtils.lerp(3.5 - s * 1.2 + Math.sin(u * Math.PI) * 0.8, 1.8, handoff),
        Math.cos(orbitAng) * dist
      );
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();

      return { sunDir: new THREE.Vector3(0.5, 0.7, 0.5), clearColor: 0x040510, shadowBounds: null };
    }
  };
}
