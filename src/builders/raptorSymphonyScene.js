import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { mulberry32, clamp, smoothstep } from "../core/math.js";
import { buildStarfield } from "./cosmicPrimitives.js";

// Custom GLSL3 MRT Supersonic Methalox Exhaust Plume with Standing Mach Shock Diamonds!
// Literally "sings" & resonates with the music's bass/mid ("引擎 · 在高歌")!
function createMethaloxPlumeMaterial(isVacuum = false) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uThrottle: { value: 1.0 },
      uBass: { value: 0.0 },
      uIsVac: { value: isVacuum ? 1.0 : 0.0 }
    },
    vertexShader: `
      precision highp float;
      in vec3 position;
      in vec2 uv;
      in vec3 normal;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      uniform float uTime;
      uniform float uBass;
      out vec2 vUv;
      out float vRim;
      void main() {
        vUv = uv;
        // High-frequency supersonic acoustic flutter expanding along the plume (uv.y: 0 = nozzle throat, 1 = tail)
        float flutter = sin(uv.y * 24.0 - uTime * 48.0) * (0.04 + uBass * 0.05) * uv.y;
        vec3 p = position + normal * flutter;
        vec3 nView = normalize(mat3(modelViewMatrix) * normal);
        vRim = abs(nView.z);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uThrottle;
      uniform float uBass;
      uniform float uIsVac;
      in vec2 vUv;
      in float vRim;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;

      void main() {
        // vUv.y: 0.0 = nozzle exit, 1.0 = far exhaust tail
        float y = vUv.y;
        float core = pow(vRim, 1.45);
        float fade = smoothstep(0.0, 0.04, y) * pow(1.0 - y, 1.35);

        // Standing Mach Shock Diamonds resonating with audio bass!
        float diamondFreq = mix(22.0, 14.0, uIsVac);
        float diamonds = pow(0.5 + 0.5 * cos(y * diamondFreq - uTime * 16.0), 5.0) * smoothstep(0.85, 0.05, y);
        float ripple = 0.86 + 0.14 * sin(y * 42.0 - uTime * 52.0);

        // Authentic SpaceX Methalox colors: incandescent white-blue core -> electric cyan -> deep plasma violet-magenta edge!
        vec3 colViolet = vec3(0.52, 0.24, 1.0);
        vec3 colCyan = vec3(0.24, 0.84, 1.0);
        vec3 colWhite = vec3(0.96, 0.99, 1.0);

        vec3 col = mix(colViolet, colCyan, clamp(core * 0.85 + (1.0 - y) * 0.35, 0.0, 1.0));
        col = mix(col, colWhite, clamp(diamonds * (0.75 + uBass * 0.45) + smoothstep(0.18, 0.0, y) * core, 0.0, 1.0));

        float intensity = (0.48 + core * 0.72 + diamonds * 0.95) * fade * ripple * uThrottle;
        float a = clamp(intensity * (0.85 + uBass * 0.35), 0.0, 1.0);
        gColor = vec4(col * intensity * (1.35 + uBass * 0.55), a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Build an intricate 3D Raptor Engine Bell (regenerative cooling ribs + glowing cherry-orange vacuum throat + manifold collar)
function buildRaptorBell(radius, height, isVac, mats) {
  const bellGroup = new THREE.Group();

  // Contoured parabolic rocket nozzle bell via LatheGeometry (opening downward along -Y)
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const f = i / 16; // 0 = top throat, 1 = bottom nozzle exit
    const r = radius * (0.34 + Math.pow(f, 0.62) * 0.66);
    const y = -f * height;
    pts.push(new THREE.Vector2(r, y));
  }
  const bellGeo = new THREE.LatheGeometry(pts, 32);
  const bellMesh = new THREE.Mesh(bellGeo, isVac ? mats.rvacBell : mats.raptorBell);
  bellGroup.add(bellMesh);

  // Glowing inner combustion throat & cherry-hot regenerative-cooling exit rim
  const rimGlow = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.99, radius * 0.04, 8, 32),
    isVac ? mats.hotRim : mats.cyanThroat
  );
  rimGlow.rotation.x = Math.PI / 2;
  rimGlow.position.y = -height;
  bellGroup.add(rimGlow);

  const throatCore = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.38, 20), mats.whiteCore);
  throatCore.rotation.x = Math.PI / 2;
  throatCore.position.y = -height * 0.12;
  bellGroup.add(throatCore);

  // Structural stiffening rings around the bell
  for (let k = 1; k <= 3; k++) {
    const f = k / 4;
    const rr = radius * (0.34 + Math.pow(f, 0.62) * 0.66) + 0.025;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.028, 6, 28), mats.darkMetal);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -f * height;
    bellGroup.add(ring);
  }

  // Supersonic Methalox Exhaust Plume streaming downward along -Y
  const plumeLen = isVac ? 24.0 : 19.0;
  const plumeTopR = radius * 0.94;
  const plumeBotR = isVac ? radius * 2.15 : radius * 1.45;
  const plumeGeo = new THREE.CylinderGeometry(plumeTopR, plumeBotR, plumeLen, 28, 18, true);
  // Flip UV.y so 0 = top nozzle exit, 1 = bottom tail!
  const uv = plumeGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setY(i, 1.0 - uv.getY(i));
  }
  plumeGeo.translate(0, -height - plumeLen * 0.5 + 0.15, 0);
  const plumeMat = createMethaloxPlumeMaterial(isVac);
  const plume = new THREE.Mesh(plumeGeo, plumeMat);
  bellGroup.add(plume);

  bellGroup.userData = { plume, plumeMat };
  return bellGroup;
}

// S16B: 引擎在高歌 (135.2 - 139.4s) — Heroic Macro Close-Up of Starship's 6-Engine Raptor/RVac Cluster Singing at Full Thrust!
export function buildRaptorSymphonyScene() {
  const scene = new THREE.Scene();
  scene.add(buildStarfield(2400, 420, 16222));

  const mats = {
    steel: createCelMaterial({ color: 0xdce4f0, shadowColor: 0x3b425c, patternMode: 2, patternScale: new THREE.Vector2(10, 8), rimStrength: 0.55, rimColor: 0x80e8ff }),
    darkMetal: createCelMaterial({ color: 0x222738, shadowColor: 0x0e101c, rimStrength: 0.45, rimColor: 0x7ce6ff }),
    raptorBell: createCelMaterial({ color: 0x525a72, shadowColor: 0x1d2030, patternMode: 2, patternScale: new THREE.Vector2(16, 6), rimStrength: 0.72, rimColor: 0x9cf2ff, side: THREE.DoubleSide }),
    rvacBell: createCelMaterial({ color: 0x624e68, shadowColor: 0x24182a, emissive: 0xff4c24, emissiveStrength: 0.35, patternMode: 2, patternScale: new THREE.Vector2(18, 8), rimStrength: 0.85, rimColor: 0xffa66b, side: THREE.DoubleSide }),
    hotRim: createCelMaterial({ color: 0xffa854, emissive: 0xff5a18, emissiveStrength: 2.6, unlit: true, noInk: true }),
    cyanThroat: createCelMaterial({ color: 0x9cf4ff, emissive: 0x38d0ff, emissiveStrength: 2.8, unlit: true, noInk: true }),
    whiteCore: createCelMaterial({ color: 0xffffff, emissive: 0xc2f6ff, emissiveStrength: 3.4, unlit: true, noInk: true })
  };

  // === HERO: STARSHIP AFT ENGINE BAY & 6-ENGINE RAPTOR CLUSTER (3 Outer RVac + 3 Inner Gimballing Center Raptors) ===
  const engineBay = new THREE.Group();
  // Tilt ship dramatically so exhaust blasts diagonally down-left across the widescreen frame!
  engineBay.rotation.set(0.28, -0.35, -0.52);
  scene.add(engineBay);

  // Gleaming stainless aft skirt & thrust puck ceiling
  const aftSkirt = new THREE.Mesh(new THREE.CylinderGeometry(3.85, 4.05, 6.5, 36, 1, true), mats.steel);
  aftSkirt.position.y = 3.2;
  engineBay.add(aftSkirt);

  const thrustPuck = new THREE.Mesh(new THREE.CylinderGeometry(3.78, 3.78, 0.45, 32), mats.darkMetal);
  thrustPuck.position.y = 0.25;
  engineBay.add(thrustPuck);

  // Cryogenic LOX/CH4 turbopump piping & radial manifolds around the thrust puck
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const pipe = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.11, 8, 20, Math.PI), mats.steel);
    pipe.position.set(Math.cos(a) * 2.1, 0.1, Math.sin(a) * 2.1);
    pipe.rotation.y = -a;
    engineBay.add(pipe);
  }

  // 3 Giant Outer Raptor Vacuum (RVac) Bells (cherry-red radiatively-cooled niobium rims!)
  const allEngines = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const rvac = buildRaptorBell(1.22, 2.55, true, mats);
    rvac.position.set(Math.cos(a) * 2.15, 0.0, Math.sin(a) * 2.15);
    engineBay.add(rvac);
    allEngines.push({ group: rvac, isCenter: false, phase: i * 2.1 });
  }

  // 3 Inner Center Gimballing Raptor Engines
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 - Math.PI / 6;
    const centerEng = buildRaptorBell(0.74, 1.75, false, mats);
    centerEng.position.set(Math.cos(a) * 0.88, 0.05, Math.sin(a) * 0.88);
    engineBay.add(centerEng);
    allEngines.push({ group: centerEng, isCenter: true, phase: i * 2.1 + 1.0 });
  }

  // === ACOUSTIC SYMPHONY RESONANCE RINGS RIPPLING DOWN THE EXHAUST ("引擎在高歌") ===
  const waveRings = [];
  const ringMatBase = createCelMaterial({
    color: 0x9cf4ff, emissive: 0x48d2ff, emissiveStrength: 2.4,
    unlit: true, noInk: true, transparent: true, opacity: 0.45,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
  });
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(2.6, 2.82, 48), ringMatBase.clone());
    m.rotation.x = Math.PI / 2;
    engineBay.add(m);
    waveRings.push({ mesh: m, phase: i / 8 });
  }

  // === 110 SUPERSONIC EXHAUST SPARKS & CRYO-PLASMA STREAKS BLASTING DOWN -Y ===
  const rand = mulberry32(16229);
  const sparkGeo = new THREE.CylinderGeometry(0.022, 0.008, 1.0, 5);
  const sparkCyanMat = createCelMaterial({
    color: 0xa6f6ff, emissive: 0x38d0ff, emissiveStrength: 3.0,
    unlit: true, noInk: true, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const sparkGoldMat = createCelMaterial({
    color: 0xffe89e, emissive: 0xffb830, emissiveStrength: 2.8,
    unlit: true, noInk: true, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const sparks = [];
  for (let i = 0; i < 110; i++) {
    const m = new THREE.Mesh(sparkGeo, i % 4 === 0 ? sparkGoldMat : sparkCyanMat);
    engineBay.add(m);
    sparks.push({
      mesh: m,
      ang: rand() * Math.PI * 2,
      r0: 0.5 + rand() * 3.1,
      spread: 0.14 + rand() * 0.22,
      speed: 26.0 + rand() * 28.0,
      offset: rand() * 32.0,
      len: 1.2 + rand() * 3.6
    });
  }

  return {
    scene,
    update(u, time, camera, audio) {
      const bass = audio ? audio.bass : 0;
      const mid = audio ? audio.mid : 0;
      const localT = u * 4.2;

      // Throttle surges smoothly from ignition ramp into roaring full-thrust symphony!
      const throttle = clamp(0.65 + smoothstep(0.0, 0.28, u) * 0.55 + bass * 0.35, 0.6, 1.45);

      // Update all 6 Raptor engines (inner 3 center engines gimbal dynamically in sync!)
      allEngines.forEach((eng) => {
        eng.group.userData.plumeMat.uniforms.uTime.value = localT;
        eng.group.userData.plumeMat.uniforms.uThrottle.value = throttle;
        eng.group.userData.plumeMat.uniforms.uBass.value = bass;
        if (eng.isCenter) {
          eng.group.rotation.x = Math.sin(localT * 2.6 + eng.phase) * 0.09;
          eng.group.rotation.z = Math.cos(localT * 2.2 + eng.phase) * 0.09;
        }
      });

      // Acoustic resonance shockwaves rippling outward down the exhaust symphony!
      waveRings.forEach((wr) => {
        const p = (localT * 0.85 + wr.phase) % 1.0;
        wr.mesh.position.y = -2.2 - p * 22.0;
        wr.mesh.scale.setScalar(0.85 + p * 2.2 + bass * 0.18);
        wr.mesh.material.uniforms.uOpacity.value = Math.sin(p * Math.PI) * (0.32 + mid * 0.28);
      });

      // Supersonic plasma sparks blasting down -Y
      for (let i = 0; i < sparks.length; i++) {
        const sp = sparks[i];
        const d = (localT * sp.speed + sp.offset) % 32.0;
        const r = sp.r0 + d * sp.spread;
        sp.mesh.position.set(Math.cos(sp.ang) * r, -1.8 - d, Math.sin(sp.ang) * r);
        sp.mesh.scale.set(1.0, sp.len * (0.7 + bass * 0.5), 1.0);
      }

      // Heroic Macro -> Dynamic Pull-Back Camera with visceral bass-driven engine rumble!
      const shake = (0.045 + bass * 0.075) * throttle;
      const pullU = smoothstep(0.0, 1.0, u);
      const orbitAng = -0.35 + pullU * 0.72;
      const dist = 7.6 + Math.pow(pullU, 1.25) * 8.2;

      camera.fov = 42 + pullU * 14 + bass * 3.0;
      camera.position.set(
        Math.sin(orbitAng) * dist + Math.sin(time * 58.0) * shake,
        -3.2 - pullU * 4.2 + Math.cos(time * 51.0) * shake,
        Math.cos(orbitAng) * dist
      );
      camera.lookAt(
        -0.6 - pullU * 1.4,
        -1.6 - pullU * 2.8,
        0.0
      );
      camera.updateProjectionMatrix();

      return { sunDir: new THREE.Vector3(-0.65, 0.55, 0.52), clearColor: 0x040610, shadowBounds: null };
    }
  };
}
