import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { mulberry32, clamp, smoothstep } from "../core/math.js";
import { buildStarfield, buildStarArkShip } from "./cosmicPrimitives.js";

// Custom GLSL3 MRT Spiral Galaxy Nebula Disk that IGNITES radially outward as coverage expands!
function createIgnitingGalaxyDiskMaterial() {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uIgniteR: { value: 0.0 },
      uOuterFlood: { value: 0.0 }
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
      uniform float uIgniteR;
      uniform float uOuterFlood;
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
          p *= 2.05;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;

        float ang = atan(p.y, p.x);
        // 3 sweeping logarithmic spiral arms!
        float spiral = sin(ang * 3.0 - r * 11.5 + uTime * 0.25) * 0.5 + 0.5;
        float armMask = pow(spiral, 1.8) * smoothstep(1.0, 0.12, r);
        float cloud = fbm(p * 3.8 + vec2(uTime * 0.04, -uTime * 0.03));

        // Dark dormant outer night vs ignited golden-cyan civilization coverage!
        float litMask = smoothstep(r - 0.08, r + 0.05, uIgniteR);
        float waveFront = exp(-pow((r - uIgniteR) * 18.0, 2.0));

        // S19 teal-indigo nebula continuity at start -> blazing golden-cyan galactic flood!
        vec3 darkNebula = vec3(0.10, 0.24, 0.38) * (0.28 + armMask * 0.55) * cloud;
        vec3 litGold = mix(vec3(0.28, 0.78, 1.0), vec3(1.0, 0.80, 0.42), clamp(armMask * 0.85 + (1.0 - r) * 0.45, 0.0, 1.0));
        vec3 col = mix(darkNebula, litGold * (0.55 + armMask * 0.95 + cloud * 0.45), litMask);
        col += vec3(1.0, 0.94, 0.72) * waveFront * 1.35;
        col += vec3(1.0, 0.86, 0.52) * exp(-r * r * 12.0) * (0.65 + uOuterFlood * 0.5);

        float env = smoothstep(1.0, 0.22, r);
        float a = clamp(env * (0.22 + armMask * 0.48 * (0.4 + litMask * 0.85) + waveFront * 0.75), 0.0, 1.0);
        gColor = vec4(col * a * 1.25, a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Custom GLSL3 MRT Exponential Chain-Reaction Galactic Laser Web Shader!
function createGalacticWebMaterial() {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uIgniteR: { value: 0.0 },
      uBass: { value: 0.0 }
    },
    vertexShader: `
      precision highp float;
      in vec3 position;
      in float aT;
      in float aR;
      in float aOuter;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      out float vT;
      out float vR;
      out float vOuter;
      void main() {
        vT = aT;
        vR = aR;
        vOuter = aOuter;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uIgniteR;
      uniform float uBass;
      in float vT;
      in float vR;
      in float vOuter;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        float reveal = smoothstep(vR - 0.04, vR + 0.03, uIgniteR);
        float flash = exp(-pow((vR - uIgniteR) * 16.0, 2.0));
        float pulse = pow(0.5 + 0.5 * sin(vT * 12.566 - uTime * 7.5 + vR * 8.0), 4.0);

        vec3 cyanCol = vec3(0.36, 0.86, 1.0);
        vec3 goldCol = vec3(1.0, 0.84, 0.42);
        vec3 whiteCol = vec3(1.0, 0.97, 0.86);

        vec3 col = mix(cyanCol, goldCol, clamp(0.45 + vOuter * 0.45 + pulse * 0.5, 0.0, 1.0));
        col = mix(col, whiteCol, clamp(flash * 0.9 + pulse * 0.35, 0.0, 1.0));

        float a = clamp((0.26 + pulse * 0.58 + flash * 0.85) * reveal * (0.95 + uBass * 0.35), 0.0, 1.0);
        gColor = vec4(col * (1.1 + pulse * 1.3 + flash * 1.6), a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Custom GLSL3 MRT Bold Screen-Swallowing Light Shockwave Ring Shader (blazing white-gold leading edge + wide luminous trail!)
function createLightShockwaveMaterial(trailHex = 0xffb330) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uOpacity: { value: 0.0 },
      uTrailColor: { value: new THREE.Color(trailHex) }
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
      uniform vec3 uTrailColor;
      in vec2 vUv;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0 || r < 0.35) discard;
        // Sharp blazing white-gold shock front at r = 0.92 + sweeping luminous trail behind (r = 0.45..0.92)
        float front = exp(-pow((r - 0.92) * 24.0, 2.0)) * 2.2;
        float trail = smoothstep(0.42, 0.92, r) * smoothstep(1.0, 0.92, r) * 0.85;
        vec3 col = mix(uTrailColor, vec3(1.0, 0.97, 0.88), clamp(front * 0.85, 0.0, 1.0));
        float a = clamp((front + trail) * uOpacity, 0.0, 1.0);
        gColor = vec4(col * (1.2 + front * 0.9) * uOpacity, a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Custom GLSL3 MRT Pulsing Supernova Core Sunburst (pulses on every musical beat to launch each light shockwave!)
function createCoreBurstMaterial() {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uPower: { value: 1.0 }
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
      uniform float uPower;
      in vec2 vUv;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float core = exp(-r * r * 18.0) * 2.2;
        float halo = exp(-r * 3.8) * 0.85;
        float streak = exp(-abs(p.y) * 22.0) * exp(-abs(p.x) * 1.8) * 0.85;
        vec3 col = vec3(1.0, 0.97, 0.88) * core + vec3(1.0, 0.78, 0.38) * halo + vec3(0.55, 0.90, 1.0) * streak;
        float a = clamp((core + halo + streak) * uPower, 0.0, 1.0);
        gColor = vec4(col * uPower, a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// S20: 点燃长夜 · 突破覆盖与数量的边界 (165.95 - 174.5s)
// Seamless continuation from S19's StarArk Fleet -> Exponential Chain-Reaction Star Ignition -> 360-deg Galactic Boundary Shatter!
export function buildSupernovaGateScene() {
  const scene = new THREE.Scene();
  const rand = mulberry32(20209);
  scene.add(buildStarfield(3400, 560, 20209));

  const MAX_GALAXY_R = 72.0;
  const BOUNDARY_R = 23.0; // The colossal Legacy Coverage Boundary Ring (normalized r = 0.32)!

  // === 1. IGNITING SPIRAL GALAXY DISK (Bridges S19's teal-amber nebula into blazing full-galaxy golden flood!) ===
  const galaxyGroup = new THREE.Group();
  galaxyGroup.rotation.x = -Math.PI * 0.46; // Dramatic grand tilted galactic plane
  scene.add(galaxyGroup);

  const diskMat = createIgnitingGalaxyDiskMaterial();
  const diskMesh = new THREE.Mesh(new THREE.PlaneGeometry(MAX_GALAXY_R * 2.1, MAX_GALAXY_R * 2.1), diskMat);
  galaxyGroup.add(diskMesh);

  // === 2. CONTINUITY WITH S19: OUR LEAD STARARK FLAGSHIP IGNITING THE GALACTIC ORIGIN! ===
  const flagship = buildStarArkShip();
  flagship.scale.setScalar(0.55);
  flagship.rotation.y = Math.PI / 2;
  flagship.position.set(0, 0.8, 2.0);
  scene.add(flagship);

  // === 3. 210 EXPONENTIALLY IGNITING STAR SYSTEMS (1 -> 12 -> 48 -> 210 along 3 spiral arms, inside & beyond boundary!) ===
  const starGeo = new THREE.OctahedronGeometry(0.42, 1);
  const starGoldMat = createCelMaterial({ color: 0xfff0b8, emissive: 0xffbe3b, emissiveStrength: 3.2, unlit: true, noInk: true });
  const starCyanMat = createCelMaterial({ color: 0xa6f6ff, emissive: 0x38d2ff, emissiveStrength: 3.0, unlit: true, noInk: true });
  const starDormantMat = createCelMaterial({ color: 0x263252, shadowColor: 0x101628, rimStrength: 0.3, rimColor: 0x4882b8 });

  const starSystems = [];
  // Inner Core + 3 Spiral Arms spanning R = 3.5 -> 68.0
  for (let i = 0; i < 210; i++) {
    const arm = i % 3;
    // Concentrate dense inner cluster + explosive outer arm expansion beyond BOUNDARY_R!
    const frac = Math.pow((i + 1) / 210, 0.88);
    const r = 3.2 + frac * (MAX_GALAXY_R - 5.0);
    const spiralAng = (arm * Math.PI * 2) / 3 + (r / MAX_GALAXY_R) * 4.2 + (rand() - 0.5) * (0.35 + frac * 0.45);
    const x = Math.cos(spiralAng) * r;
    const y = Math.sin(spiralAng) * r;
    const z = (rand() - 0.5) * (2.2 + frac * 3.8);

    const isOuter = r > BOUNDARY_R;
    const litMat = i % 4 === 0 ? starCyanMat : starGoldMat;
    const mesh = new THREE.Mesh(starGeo, starDormantMat);
    mesh.position.set(x, y, z);
    const baseSc = (isOuter ? 0.85 : 0.72) + rand() * 0.85;
    mesh.scale.setScalar(baseSc * 0.35);
    galaxyGroup.add(mesh);

    starSystems.push({
      mesh,
      pos: new THREE.Vector3(x, y, z),
      rNorm: r / MAX_GALAXY_R,
      isOuter,
      litMat,
      baseSc,
      isLit: false
    });
  }

  // === 4. 560+ INTERCONNECTED EXPONENTIAL LASER WEB FILAMENTS (Inner Chain-Reaction + Outer Galactic Flood!) ===
  const webPos = [], webT = [], webR = [], webOuter = [];
  function addWebLink(pA, pB, rNormB, isOuter) {
    const segs = 4;
    for (let s = 0; s < segs; s++) {
      const t0 = s / segs, t1 = (s + 1) / segs;
      const a = pA.clone().lerp(pB, t0);
      const b = pA.clone().lerp(pB, t1);
      webPos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      webT.push(t0, t1);
      const rA = a.length() / MAX_GALAXY_R;
      const rB = b.length() / MAX_GALAXY_R;
      webR.push(rA, rB);
      webOuter.push(isOuter ? 1.0 : 0.0, isOuter ? 1.0 : 0.0);
    }
  }

  // Origin connects to the first 9 inner pioneer systems
  const origin = new THREE.Vector3(0, 0, 0);
  for (let i = 0; i < 9; i++) {
    addWebLink(origin, starSystems[i].pos, starSystems[i].rNorm, false);
  }
  // Exponential branching: every star system connects outward to 2-3 nearest outer neighbors!
  for (let i = 0; i < starSystems.length; i++) {
    const cur = starSystems[i];
    const cands = [];
    for (let j = i + 1; j < starSystems.length; j++) {
      const d2 = cur.pos.distanceToSquared(starSystems[j].pos);
      if (d2 < 190.0) cands.push({ j, d2 });
    }
    cands.sort((a, b) => a.d2 - b.d2);
    for (let k = 0; k < Math.min(3, cands.length); k++) {
      const nxt = starSystems[cands[k].j];
      addWebLink(cur.pos, nxt.pos, nxt.rNorm, nxt.isOuter);
    }
  }

  const webGeo = new THREE.BufferGeometry();
  webGeo.setAttribute("position", new THREE.Float32BufferAttribute(webPos, 3));
  webGeo.setAttribute("aT", new THREE.Float32BufferAttribute(webT, 1));
  webGeo.setAttribute("aR", new THREE.Float32BufferAttribute(webR, 1));
  webGeo.setAttribute("aOuter", new THREE.Float32BufferAttribute(webOuter, 1));
  const webMat = createGalacticWebMaterial();
  galaxyGroup.add(new THREE.LineSegments(webGeo, webMat));

  // === 5. COLOSSAL 360-DEGREE "COVERAGE BOUNDARY RING" AT R = 23.0 (SHATTERS AT u = 0.45 -> "突破这边界"!) ===
  const boundaryMat = createCelMaterial({
    color: 0x7ce6ff,
    shadowColor: 0x1a3868,
    emissive: 0x28b8ff,
    emissiveStrength: 2.0,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const boundarySegGeo = new THREE.BoxGeometry(2.6, 0.55, 1.35);
  const boundaryShards = [];
  const SHARD_COUNT = 48;
  for (let i = 0; i < SHARD_COUNT; i++) {
    const ang = (i / SHARD_COUNT) * Math.PI * 2;
    const m = new THREE.Mesh(boundarySegGeo, boundaryMat);
    const bx = Math.cos(ang) * BOUNDARY_R;
    const by = Math.sin(ang) * BOUNDARY_R;
    m.position.set(bx, by, 0);
    m.rotation.z = ang + Math.PI / 2;
    galaxyGroup.add(m);
    boundaryShards.push({
      mesh: m,
      ang,
      bx,
      by,
      outSpeed: 28.0 + rand() * 32.0,
      zDrift: (rand() - 0.5) * 18.0,
      spinX: (rand() - 0.5) * 5.0,
      spinY: (rand() - 0.5) * 5.0
    });
  }

  // 5 MILLISECOND-EXACT BEAT-LOCKED LIGHT SHOCKWAVES measured directly from xinghang.mp3 (165.95 - 174.5s)!
  // u=0.08 (166.6s "呜～") -> u=0.19 (167.6s "点燃") -> u=0.31 (168.6s "长夜")
  // -> u=0.57 (170.8s EXACT CLIMAX PEAK "边界" = 360° SHATTER!) -> u=0.68 (171.8s Outer Flood Wave!)
  const shockwaveTriggers = [
    { t0: 0.08, dur: 0.32, maxR: 120, color: 0x52dcff, boost: 0.90 },
    { t0: 0.19, dur: 0.34, maxR: 135, color: 0xffc048, boost: 1.00 },
    { t0: 0.31, dur: 0.34, maxR: 145, color: 0xffd875, boost: 1.10 },
    { t0: 0.57, dur: 0.36, maxR: 195, color: 0xffe484, boost: 1.55 }, // EXACT "边界" (170.80s) 360° SHATTER WAVE!
    { t0: 0.68, dur: 0.32, maxR: 190, color: 0x48d8ff, boost: 1.25 }  // 171.80s FINAL OUTER FLOOD WAVE!
  ];
  const shockPlaneGeo = new THREE.PlaneGeometry(2.0, 2.0);
  const shockwaves = shockwaveTriggers.map((cfg) => {
    const mat = createLightShockwaveMaterial(cfg.color);
    const mesh = new THREE.Mesh(shockPlaneGeo, mat);
    mesh.visible = false;
    galaxyGroup.add(mesh);
    return { mesh, mat, ...cfg };
  });

  // Pulsing Supernova Galactic Core Sunburst (flashes on every beat!)
  const coreBurstMat = createCoreBurstMaterial();
  const coreBurst = new THREE.Mesh(new THREE.PlaneGeometry(42, 42), coreBurstMat);
  scene.add(coreBurst);

  // === 6. 120 RADIATING INTERSTELLAR FLEET SWARM TRAILS (Visualizing Exponential Quantity Explosion!) ===
  const fleetStreakGeo = new THREE.CylinderGeometry(0.06, 0.015, 3.2, 5);
  const fleetSwarm = [];
  for (let i = 0; i < 120; i++) {
    const ang = rand() * Math.PI * 2;
    const m = new THREE.Mesh(fleetStreakGeo, i % 3 === 0 ? starCyanMat : starGoldMat);
    m.rotation.z = ang - Math.PI / 2;
    m.visible = false;
    galaxyGroup.add(m);
    fleetSwarm.push({
      mesh: m,
      ang,
      delay: rand() * 0.55,
      speed: 26.0 + rand() * 34.0,
      zOff: (rand() - 0.5) * 3.2
    });
  }

  return {
    scene,
    update(u, time, camera, audio) {
      const bass = audio ? audio.bass : 0;
      const localT = u * 8.55;

      // === MILLISECOND-LOCKED 2-BEAT EXPONENTIAL COVERAGE & QUANTITY BREAKTHROUGH ===
      // Beat 1 (u = 0.00..0.57, 165.95-170.80s): Exponential ignition fills inner galaxy & builds massive pressure on R=23 Boundary Ring!
      // Beat 2 (u = 0.57..0.74, 170.80-172.25s): EXACT PEAK ON "边界" -> 360° SHATTER & OUTER GALAXY FLOOD!
      // Beat 3 (u = 0.74..0.96, 172.25-174.15s): Exact musical drop (4694 RMS at 172.2s) -> Grand dissipation leaving ONLY 1 tiny center pinpoint!
      const SHATTER_U = 0.57;
      const preBreakU = clamp(u / SHATTER_U, 0, 1);
      const breakU = clamp((u - SHATTER_U) / (1.0 - SHATTER_U), 0, 1);
      const igniteR = u < SHATTER_U
        ? (0.04 + Math.pow(preBreakU, 1.35) * 0.29)
        : (0.33 + Math.pow(clamp((u - SHATTER_U) / 0.24, 0, 1), 0.72) * 0.88);

      // Grand Dissipation locks strictly onto the 172.20s musical drop (u = 0.74 -> 0.94)!
      const dissipate = smoothstep(0.74, 0.94, u);
      const alive = 1.0 - dissipate;

      // Rotate galaxy majestically
      galaxyGroup.rotation.z = localT * 0.035;

      // Fade shockwaves & disk smoothly during final dissipation so ONLY the single center pinpoint remains!
      diskMat.uniforms.uTime.value = localT;
      diskMat.uniforms.uIgniteR.value = igniteR * alive;
      diskMat.uniforms.uOuterFlood.value = breakU * alive;
      diskMesh.visible = alive > 0.01;
      diskMesh.scale.setScalar(1.0 + dissipate * 0.35);
      if (dissipate > 0.01) {
        for (let i = 0; i < shockwaves.length; i++) {
          shockwaves[i].mat.uniforms.uOpacity.value *= alive;
        }
      }

      webMat.uniforms.uTime.value = localT;
      webMat.uniforms.uIgniteR.value = igniteR;
      webMat.uniforms.uBass.value = bass;
      // Multiply web opacity cleanly by alive via uIgniteR fade + visibility
      galaxyGroup.children.forEach((ch) => {
        if (ch.material === webMat) ch.visible = alive > 0.02;
      });
      webMat.uniforms.uBass.value = bass * alive - dissipate * 2.2;

      // Continuity Flagship at galactic origin shrinks gracefully as camera pulls out to galactic scale!
      flagship.visible = u < 0.42;
      if (flagship.visible) {
        flagship.userData.habRing.rotation.x = localT * 1.1;
        flagship.userData.coreOrb.rotation.y = localT * 1.8;
        flagship.position.set(0, 0.8, 2.0 - u * 18.0);
        flagship.scale.setScalar(0.55 * (1.0 - smoothstep(0.18, 0.42, u)));
      }

      // 210 Star Systems snap online, then dissipate cleanly into the dark void during u = 0.76..0.96!
      for (let i = 0; i < starSystems.length; i++) {
        const st = starSystems[i];
        const lit = smoothstep(st.rNorm - 0.02, st.rNorm + 0.04, igniteR);
        if (lit > 0.05 && !st.isLit) {
          st.mesh.material = st.litMat;
          st.isLit = true;
        } else if (lit <= 0.05 && st.isLit) {
          st.mesh.material = starDormantMat;
          st.isLit = false;
        }
        const pop = lit > 0.05 ? (1.0 + Math.sin(clamp(lit, 0, 1) * Math.PI) * 0.85 + bass * 0.35) : 0.38;
        st.mesh.visible = alive > 0.02;
        st.mesh.scale.setScalar(st.baseSc * pop * alive);
      }

      // 48-Segment Legacy Coverage Boundary Ring: builds maximum tension on "突-破-这-" (u=0.42..0.57) -> SHATTERS 360° AT u = 0.57 ("边界")!
      if (breakU <= 0.001) {
        const pressure = smoothstep(0.38, SHATTER_U, u);
        boundaryMat.uniforms.uOpacity.value = 0.72 + pressure * 0.28;
        for (let i = 0; i < boundaryShards.length; i++) {
          const bs = boundaryShards[i];
          const tremble = pressure * 0.35 * Math.sin(time * 48 + i);
          bs.mesh.visible = true;
          bs.mesh.position.set(bs.bx + Math.cos(bs.ang) * tremble, bs.by + Math.sin(bs.ang) * tremble, 0);
          bs.mesh.rotation.set(0, 0, bs.ang + Math.PI / 2);
          bs.mesh.scale.setScalar(1.0 + pressure * 0.15);
        }
      } else {
        const shatterFade = 1.0 - smoothstep(0.45, 0.95, breakU);
        boundaryMat.uniforms.uOpacity.value = shatterFade * 0.9;
        for (let i = 0; i < boundaryShards.length; i++) {
          const bs = boundaryShards[i];
          bs.mesh.visible = shatterFade > 0.02;
          const d = Math.pow(breakU, 0.78) * bs.outSpeed;
          bs.mesh.position.set(bs.bx + Math.cos(bs.ang) * d, bs.by + Math.sin(bs.ang) * d, bs.zDrift * breakU);
          bs.mesh.rotation.set(bs.spinX * breakU * 2.0, bs.spinY * breakU * 2.0, bs.ang + Math.PI / 2);
          bs.mesh.scale.setScalar(Math.max(0.05, shatterFade));
        }
      }

      // 6 BOLD RHYTHMIC LIGHT SHOCKWAVES blasting past the entire screen edges!
      let wavePunch = 0.0;
      for (let i = 0; i < shockwaves.length; i++) {
        const sw = shockwaves[i];
        const p = (u - sw.t0) / sw.dur;
        sw.mesh.visible = p > 0.001 && p < 1.0;
        if (sw.mesh.visible) {
          const rad = 2.0 + Math.pow(p, 0.72) * sw.maxR;
          sw.mesh.scale.setScalar(rad);
          // Stay bold & blazing all the way past the screen borders before gently fading out
          const env = smoothstep(0.0, 0.08, p) * (1.0 - smoothstep(0.68, 1.0, p));
          sw.mat.uniforms.uOpacity.value = env * sw.boost * (0.95 + bass * 0.35);
          if (p < 0.18) wavePunch = Math.max(wavePunch, Math.sin((p / 0.18) * Math.PI) * sw.boost);
        }
      }

      // Supernova Core Sunburst pulses on every beat, then condenses into ONE single tiny radiant light-point dead-center as everything else dissipates!
      coreBurst.quaternion.copy(camera.quaternion);
      coreBurstMat.uniforms.uPower.value = (0.75 + wavePunch * 0.95 + bass * 0.45) * alive + dissipate * 1.35;
      const pinpointScale = (0.9 + wavePunch * 0.55 + bass * 0.25) * alive + dissipate * 0.14;
      coreBurst.scale.setScalar(pinpointScale);

      // 120 Expanding Fleet Swarm Light-Trails dissipate cleanly away too!
      for (let i = 0; i < fleetSwarm.length; i++) {
        const fs = fleetSwarm[i];
        const age = u - fs.delay;
        fs.mesh.visible = age > 0.01 && alive > 0.02;
        if (fs.mesh.visible) {
          const rad = 2.0 + age * fs.speed * 1.45;
          fs.mesh.position.set(Math.cos(fs.ang) * rad, Math.sin(fs.ang) * rad, fs.zOff);
          const sc = clamp(age * 4.0, 0, 1) * smoothstep(MAX_GALAXY_R * 1.15, MAX_GALAXY_R * 0.6, rad) * alive;
          fs.mesh.scale.set(1.0, Math.max(0.01, (0.6 + sc * 1.8) * alive), 1.0);
        }
      }

      // === GRAND GALACTIC PULL-BACK CAMERA (With Rhythmic Shockwave FOV Kick & Impact Shake!) ===
      const impactShake = (Math.sin(clamp(breakU / 0.25, 0, 1) * Math.PI) * 0.65 + wavePunch * 0.35);
      const pull = smoothstep(0.0, 1.0, u);
      const orbitAng = -0.25 + pull * 0.75;
      const dist = 24.0 + Math.pow(pull, 1.35) * 68.0;
      const camY = 12.0 + Math.pow(pull, 1.25) * 46.0;

      camera.fov = 44 + pull * 18 + wavePunch * 4.5 + bass * 2.0;
      camera.position.set(
        Math.sin(orbitAng) * dist + Math.sin(time * 54) * impactShake,
        camY + Math.cos(time * 48) * impactShake,
        Math.cos(orbitAng) * dist
      );
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();

      return { sunDir: new THREE.Vector3(0.4, 0.85, 0.35), clearColor: 0x040610, shadowBounds: null };
    }
  };
}
