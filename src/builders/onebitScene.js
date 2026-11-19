import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { mulberry32, clamp, smoothstep } from "../core/math.js";
import { buildStarfield } from "./cosmicPrimitives.js";

// Generate ultra-crisp high-res vertical binary "0" & "1" stream texture (8 lanes x 24 rows)
function createBinaryStreamTexture(seed = 1501) {
  const w = 512, h = 1024;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, w, h);

  const rand = mulberry32(seed);
  const cols = 8;
  const rows = 24;
  const cellW = w / cols;
  const cellH = h / rows;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 32px 'SF Mono', 'Menlo', 'Consolas', monospace";

  for (let c = 0; c < cols; c++) {
    const cx = (c + 0.5) * cellW;
    // Leave subtle vertical spacing between sparse high-taste streams
    const activeDensity = 0.52 + rand() * 0.34;
    for (let r = 0; r < rows; r++) {
      if (rand() > activeDensity) continue;
      const cy = (r + 0.5) * cellH;
      const isOne = rand() > 0.44;
      const bright = 0.55 + rand() * 0.45;
      if (isOne) {
        // Radiant warm gold "1"
        ctx.shadowColor = "rgba(255, 200, 72, 0.9)";
        ctx.shadowBlur = 10;
        ctx.fillStyle = bright > 0.85
          ? `rgba(255, 250, 224, ${bright.toFixed(2)})`
          : `rgba(255, 210, 108, ${bright.toFixed(2)})`;
        ctx.fillText("1", cx, cy);
      } else {
        // Crisp cool ice-cyan "0"
        ctx.shadowColor = "rgba(72, 216, 255, 0.85)";
        ctx.shadowBlur = 8;
        ctx.fillStyle = `rgba(126, 232, 255, ${(bright * 0.82).toFixed(2)})`;
        ctx.fillText("0", cx, cy);
      }
    }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

// Custom GLSL3 MRT Rising "01" Binary Data Stream Shader (scrolls cleanly UPWARD into the starry sky!)
function createRisingBinaryStreamMaterial(tex, speed = 0.28, phase = 0.0, laneOffset = 0.0) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uMap: { value: tex },
      uTime: { value: 0 },
      uSpeed: { value: speed },
      uPhase: { value: phase },
      uLaneOffset: { value: laneOffset },
      uIntensity: { value: 1.0 }
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
      uniform sampler2D uMap;
      uniform float uTime;
      uniform float uSpeed;
      uniform float uPhase;
      uniform float uLaneOffset;
      uniform float uIntensity;
      in vec2 vUv;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;

      void main() {
        // Scroll digits strictly UPWARD (increasing y samples lower texture rows over time)
        vec2 suv = vec2(vUv.x * 0.5 + uLaneOffset, vUv.y * 2.2 - uTime * uSpeed + uPhase);
        vec4 texel = texture(uMap, suv);

        // Smooth launch fade at the quantization plane (vUv.y = 0) & graceful fade into deep space (vUv.y = 1)
        float vertFade = smoothstep(0.0, 0.14, vUv.y) * smoothstep(1.0, 0.72, vUv.y);
        // Subtle ascending light pulse sweeping up the stream
        float surge = 0.72 + 0.55 * pow(0.5 + 0.5 * sin(vUv.y * 9.0 - uTime * 4.5 + uPhase * 6.28), 3.0);

        float a = texel.a * vertFade * uIntensity;
        vec3 col = texel.rgb * surge * (1.15 + uIntensity * 0.35);
        gColor = vec4(col * a, a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Custom GLSL3 MRT Surging Red-Orange/Magenta Analog Fervor Wave ("这狂热" boiling below the 1-Bit quantization plane!)
function createAnalogFervorWaveMaterial() {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uFervor: { value: 1.0 }
    },
    vertexShader: `
      precision highp float;
      in vec3 position;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      uniform float uTime;
      uniform float uFervor;
      out float vHeight;
      out float vDist;
      void main() {
        vec3 p = position;
        float dist = length(p.xz);
        vDist = dist;
        // Slow, majestic, hypnotic molten fervor swell (ZERO high-frequency jitter!)
        float rawWave = sin(p.x * 0.45 + uTime * 1.15) * cos(p.z * 0.42 - uTime * 0.95) * (1.15 + uFervor * 0.65)
                      + sin(dist * 0.55 - uTime * 1.65) * (0.55 + uFervor * 0.35);
        p.y += rawWave;
        vHeight = clamp((rawWave + 1.8) / 3.6, 0.0, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uFervor;
      in float vHeight;
      in float vDist;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        float radialFade = smoothstep(23.0, 3.5, vDist);
        // Fiery crimson -> solar orange -> hot magenta-gold crests ("这狂热")
        vec3 colDeep = vec3(0.82, 0.14, 0.36);
        vec3 colFlame = vec3(1.0, 0.44, 0.12);
        vec3 colCrest = vec3(1.0, 0.84, 0.42);
        vec3 col = mix(colDeep, colFlame, smoothstep(0.15, 0.65, vHeight));
        col = mix(col, colCrest, smoothstep(0.70, 0.98, vHeight));
        float a = (0.20 + vHeight * 0.46) * radialFade * (0.75 + uFervor * 0.55);
        gColor = vec4(col * (1.1 + vHeight * 0.75 + uFervor * 0.35), clamp(a, 0.0, 1.0));
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Build dense wireframe wave grid for the analog fervor -> 1-bit quantized floor
function buildWaveGridGeometry(size = 38, lines = 44, segs = 48) {
  const pos = [];
  const half = size * 0.5;
  for (let i = 0; i <= lines; i++) {
    const v = -half + (i / lines) * size;
    for (let s = 0; s < segs; s++) {
      const u0 = -half + (s / segs) * size;
      const u1 = -half + ((s + 1) / segs) * size;
      // X-line
      pos.push(u0, 0, v, u1, 0, v);
      // Z-line
      pos.push(v, 0, u0, v, 0, u1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return geo;
}

// S15: 极简一比特 · 量化这狂热 ("01" Binary Data Streams Ascending from Quantized Fervor into the Starry Sky!)
export function buildOneBitScene() {
  const scene = new THREE.Scene();
  scene.add(buildStarfield(2600, 460, 202608));

  // === 1. LOWER ZONE (y = -4.2): BOILING RED-ORANGE/MAGENTA ANALOG FERVOR STORM ("这狂热") ===
  const waveMat = createAnalogFervorWaveMaterial();
  const waveGrid = new THREE.LineSegments(buildWaveGridGeometry(42, 46, 52), waveMat);
  waveGrid.position.y = -4.2;
  scene.add(waveGrid);

  // 56 Graceful, Slowly-Rising Crimson/Orange Fervor Embers gliding up from the molten wave into the y = -1.2 Slicer Plane
  const fervorRand = mulberry32(15999);
  const emberGeo = new THREE.OctahedronGeometry(0.10, 0);
  const emberMatRed = createCelMaterial({
    color: 0xff5a36, emissive: 0xff2e14, emissiveStrength: 2.5,
    unlit: true, noInk: true, transparent: true, opacity: 0.82,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const emberMatMagenta = createCelMaterial({
    color: 0xff70b8, emissive: 0xe62488, emissiveStrength: 2.3,
    unlit: true, noInk: true, transparent: true, opacity: 0.78,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const fervorEmbers = [];
  for (let i = 0; i < 56; i++) {
    const m = new THREE.Mesh(emberGeo, i % 3 === 0 ? emberMatMagenta : emberMatRed);
    scene.add(m);
    fervorEmbers.push({
      mesh: m,
      ang: fervorRand() * Math.PI * 2,
      rad: 1.5 + Math.pow(fervorRand(), 0.75) * 12.5,
      speed: 0.85 + fervorRand() * 0.85,
      phase: fervorRand() * 3.6,
      sz: 0.65 + fervorRand() * 0.95
    });
  }

  // === 1B. MIDDLE PLANE (y = -1.2): CALM, RAZOR-SHARP 1-BIT QUANTIZATION SLICER ===
  const threshRingMat = createCelMaterial({
    color: 0xdff8ff,
    emissive: 0x62e2ff,
    emissiveStrength: 2.0,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.20,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const threshRing = new THREE.Mesh(new THREE.RingGeometry(1.5, 14.8, 64), threshRingMat);
  threshRing.rotation.x = -Math.PI / 2;
  threshRing.position.y = -1.2;
  scene.add(threshRing);

  const scanPulseMat = createCelMaterial({
    color: 0xffe89e,
    emissive: 0xffc048,
    emissiveStrength: 2.6,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const scanPulseRing = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.0, 64), scanPulseMat);
  scanPulseRing.rotation.x = -Math.PI / 2;
  scanPulseRing.position.y = -1.16;
  scene.add(scanPulseRing);

  // Clean, serene concentric reference rings on the quantization plane (NO violently popping boxes!)
  const rand = mulberry32(15159);
  [3.4, 7.2, 12.2].forEach((rr) => {
    const rMesh = new THREE.Mesh(new THREE.RingGeometry(rr - 0.04, rr + 0.04, 64), threshRingMat);
    rMesh.rotation.x = -Math.PI / 2;
    rMesh.position.y = -1.18;
    scene.add(rMesh);
  });

  // === 2. HERO: 28 CLEAN, SILKY-SMOOTH "01" BINARY DATA STREAM RIBBONS RISING SKYWARD! ===
  const binTexA = createBinaryStreamTexture(1501);
  const binTexB = createBinaryStreamTexture(1502);

  const streamGroup = new THREE.Group();
  scene.add(streamGroup);

  const streams = [];
  const ringConfigs = [
    { count: 8, r: 3.4, height: 42.0, width: 2.5, tilt: -0.04, speedBase: 0.22 },
    { count: 10, r: 7.2, height: 46.0, width: 3.0, tilt: -0.07, speedBase: 0.18 },
    { count: 10, r: 12.2, height: 50.0, width: 3.5, tilt: -0.10, speedBase: 0.15 }
  ];

  ringConfigs.forEach((cfg, rIdx) => {
    const geo = new THREE.PlaneGeometry(cfg.width, cfg.height, 1, 1);
    geo.translate(0, cfg.height * 0.5, 0);
    for (let i = 0; i < cfg.count; i++) {
      const ang = (i / cfg.count) * Math.PI * 2 + rIdx * 0.28;
      const mat = createRisingBinaryStreamMaterial(
        i % 2 === 0 ? binTexA : binTexB,
        cfg.speedBase + rand() * 0.14,
        rand() * 4.0,
        (i % 4) * 0.25
      );
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(Math.cos(ang) * cfg.r, -1.2, Math.sin(ang) * cfg.r);
      // Face toward center/camera radially + gently lean inward toward the starry zenith!
      mesh.rotation.y = -ang + Math.PI / 2;
      mesh.rotation.x = cfg.tilt;
      streamGroup.add(mesh);
      streams.push({ mesh, mat, delay: rIdx * 0.12 + (i % 4) * 0.04 });
    }
  });

  // === 3. 90 RISING VERTICAL LIGHT-FILAMENTS & MICRO-BITS STREAMING SKYWARD ===
  const filamentGeo = new THREE.CylinderGeometry(0.018, 0.008, 3.8, 5);
  const filGoldMat = createCelMaterial({
    color: 0xffe89e, emissive: 0xffbe42, emissiveStrength: 2.6,
    unlit: true, noInk: true, transparent: true, opacity: 0.78,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const filCyanMat = createCelMaterial({
    color: 0x8cf2ff, emissive: 0x38d0ff, emissiveStrength: 2.5,
    unlit: true, noInk: true, transparent: true, opacity: 0.72,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const filaments = [];
  for (let i = 0; i < 48; i++) {
    const ang = rand() * Math.PI * 2;
    const rad = 1.6 + Math.pow(rand(), 0.85) * 13.5;
    const m = new THREE.Mesh(filamentGeo, i % 2 === 0 ? filGoldMat : filCyanMat);
    scene.add(m);
    filaments.push({
      mesh: m,
      ang,
      rad,
      speed: 5.5 + rand() * 6.5,
      offset: rand() * 46.0,
      len: 0.65 + rand() * 1.4
    });
  }

  return {
    scene,
    update(u, time, camera, audio) {
      const bass = audio ? audio.bass : 0;
      const localT = u * 8.3; // Smooth local shot time (0..8.3s) — ZERO time*factor(u) velocity spikes!

      // Smooth intensity escalation when "量化 · 这狂热" hits at u = 0.45
      const fervorSurge = smoothstep(0.38, 0.78, u);
      waveMat.uniforms.uTime.value = localT;
      waveMat.uniforms.uFervor.value = 0.45 + fervorSurge * 0.95;

      // 56 Graceful Crimson/Magenta Fervor Embers rise smoothly from y = -4.8 and dissolve cleanly at the y = -1.2 Slicer!
      for (let i = 0; i < fervorEmbers.length; i++) {
        const eb = fervorEmbers[i];
        const cycle = (localT * eb.speed + eb.phase) % 3.6;
        const y = -4.8 + cycle;
        eb.mesh.position.set(Math.cos(eb.ang) * eb.rad, y, Math.sin(eb.ang) * eb.rad);
        const snapShrink = smoothstep(3.6, 3.0, cycle);
        eb.mesh.scale.setScalar(eb.sz * snapShrink * (0.75 + fervorSurge * 0.45));
      }

      // Calm expanding quantization scan ring at y = -1.2
      const pulseR = (localT * 0.38) % 1.0;
      scanPulseRing.scale.setScalar(1.5 + pulseR * 15.5);
      scanPulseMat.uniforms.uOpacity.value = Math.sin(pulseR * Math.PI) * (0.55 + fervorSurge * 0.30);
      threshRingMat.uniforms.uOpacity.value = 0.14 + fervorSurge * 0.16;

      // Silky-smooth soaring "01" binary data streams (constant clean upward velocity, ZERO strobe/jitter!)
      const streamRiseU = smoothstep(0.02, 0.38, u);
      const streamClock = localT + fervorSurge * 0.85; // Smooth continuous phase advance without velocity explosion!
      for (let i = 0; i < streams.length; i++) {
        const st = streams[i];
        const act = smoothstep(st.delay, st.delay + 0.24, streamRiseU + u * 0.4);
        st.mat.uniforms.uTime.value = streamClock;
        st.mat.uniforms.uIntensity.value = act * (0.72 + fervorSurge * 0.52 + bass * 0.14);
        st.mesh.visible = act > 0.01;
      }

      streamGroup.rotation.y = localT * 0.035;

      // Smooth rising vertical light filaments streaming straight into the stars from y = -1.2
      for (let i = 0; i < filaments.length; i++) {
        const f = filaments[i];
        const y = -1.2 + ((localT * f.speed + f.offset) % 46.0);
        const funnel = 1.0 - clamp((y + 1.2) / 65.0, 0, 0.36);
        f.mesh.position.set(Math.cos(f.ang) * f.rad * funnel, y, Math.sin(f.ang) * f.rad * funnel);
        f.mesh.scale.set(1, f.len * (0.75 + fervorSurge * 0.55), 1);
      }

      // Serene, sweeping cinema camera framing both the crimson fervor below & the soaring 01 streams above,
      // then smoothly tilting skyward in the final 30% straight into S16!
      const skyTilt = smoothstep(0.55, 1.0, u);
      const orbitAng = -0.35 + u * 0.72;
      const camR = 14.8 - skyTilt * 5.0;
      camera.fov = 42 + fervorSurge * 4 + skyTilt * 7;
      camera.position.set(
        Math.sin(orbitAng) * camR,
        0.8 + u * 3.6,
        Math.cos(orbitAng) * camR
      );
      camera.lookAt(
        0,
        -0.6 + Math.pow(skyTilt, 1.35) * 19.0,
        0
      );
      camera.updateProjectionMatrix();

      return { sunDir: new THREE.Vector3(0.45, 0.78, 0.42), clearColor: 0x050714, shadowBounds: null };
    }
  };
}
