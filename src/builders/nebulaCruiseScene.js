import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { mulberry32, clamp, smoothstep } from "../core/math.js";
import { buildStarfield, buildStarArkShip } from "./cosmicPrimitives.js";

// Custom GLSL3 MRT Volumetric FBM Nebula Cloud Curtain ("Pillars of Creation" teal-indigo + sunlit amber-gold rims!)
// Zero hard geometric edges, zero lumpy dodecahedrons!
function createVolumetricNebulaMaterial(primaryHex, rimHex, seed = 1.0, baseOpacity = 0.62) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uLightBoost: { value: 1.0 },
      uSeed: { value: seed },
      uOpacity: { value: baseOpacity },
      uPrimary: { value: new THREE.Color(primaryHex) },
      uRim: { value: new THREE.Color(rimHex) }
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
      uniform float uLightBoost;
      uniform float uSeed;
      uniform float uOpacity;
      uniform vec3 uPrimary;
      uniform vec3 uRim;
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
          p *= 2.04;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        // Ultra-soft radial Gaussian envelope so plane borders are 100% invisible!
        float env = exp(-r * r * 2.3) * smoothstep(1.0, 0.16, r);

        vec2 q = vUv * 3.4 + vec2(uSeed * 2.3, uTime * 0.03);
        float n1 = fbm(q);
        float n2 = fbm(q * 2.1 + vec2(n1 * 1.4, -uTime * 0.04));
        float density = smoothstep(0.24, 0.84, n1 * 0.55 + n2 * 0.45);

        // Luminous sunlit rim highlights along the cloud ridges
        float ridge = smoothstep(0.42, 0.78, n2) * (1.0 - smoothstep(0.78, 0.96, n2));
        vec3 col = mix(uPrimary, uRim, clamp(ridge * 1.35 + n2 * 0.35, 0.0, 1.0));

        float a = clamp(env * density * uOpacity * uLightBoost, 0.0, 1.0);
        gColor = vec4(col * (0.95 + ridge * 0.95) * a * 1.25, a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Custom GLSL3 MRT Pure White-Gold "Light of Consciousness" Aura wrapping the Flagship
function createConsciousnessAuraMaterial() {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
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
      uniform float uTime;
      uniform float uIntensity;
      in vec2 vUv;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float core = exp(-r * r * 14.0) * 1.4;
        float halo = exp(-r * 3.8) * 0.65;
        float streak = exp(-abs(p.y) * 22.0) * exp(-abs(p.x) * 2.2) * 0.45;
        float breathe = 0.92 + 0.08 * sin(uTime * 3.2);
        vec3 col = vec3(1.0, 0.97, 0.88) * core + vec3(1.0, 0.82, 0.48) * halo + vec3(0.68, 0.92, 1.0) * streak;
        float a = clamp((core + halo + streak) * uIntensity * breathe, 0.0, 1.0);
        gColor = vec4(col * uIntensity * breathe, a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Compact Flanking Wedge Cruiser (100% consistent with S17/S18 fleet!)
function createFlankingCruiser(armorMat, darkMat, cyanMat, wakeMat, scale = 0.65) {
  const g = new THREE.Group();
  const wedgeGeo = new THREE.ConeGeometry(2.0, 7.6, 4);
  wedgeGeo.rotateY(Math.PI / 4);
  wedgeGeo.rotateX(-Math.PI / 2);
  wedgeGeo.scale(1.15, 0.24, 1.0);
  g.add(new THREE.Mesh(wedgeGeo, armorMat));

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 0.72), darkMat);
  bridge.position.set(0, 0.75, 2.1);
  g.add(bridge);

  [-0.75, 0, 0.75].forEach((x) => {
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), cyanMat);
    core.position.set(x, 0, 3.85);
    g.add(core);
  });

  const wake = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.02, 16.0, 8, 1, true), wakeMat);
  wake.rotation.x = Math.PI / 2;
  wake.position.set(0, 0, 11.8);
  g.add(wake);

  g.scale.setScalar(scale);
  return { group: g, wake };
}

// S19: 意识之光星云远航 (156.0 - 164.6s) — Volumetric "Pillars of Creation" Nebula Canyon + Flagship Fleet Wandering Among the Stars!
export function buildNebulaCruiseScene() {
  const scene = new THREE.Scene();
  const rand = mulberry32(19199);
  scene.add(buildStarfield(3200, 480, 19199));

  // === 1. VOLUMETRIC GLSL3 NEBULA CANYON WALLS (18 Layered Teal-Indigo & Sunlit Amber-Gold Cloud Curtains!) ===
  const nebulaPalettes = [
    [0x1a5f7a, 0xf2a854], // Deep cosmic teal + warm amber rim
    [0x343f82, 0x62d8ff], // Twilight indigo + electric cyan rim
    [0x6b325c, 0xffbe68], // Rose-plum nebula + sunlit gold rim
    [0x1e6b72, 0xffd280]  // Emerald-teal + champagne gold rim
  ];

  const canyonClouds = [];
  const cloudGeo = new THREE.PlaneGeometry(1.0, 1.0);
  for (let i = 0; i < 18; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const z0 = 12.0 - i * 8.2;
    const pal = nebulaPalettes[i % nebulaPalettes.length];
    const mat = createVolumetricNebulaMaterial(pal[0], pal[1], i * 1.7 + 0.5, 0.52 + (i % 3) * 0.08);
    const mesh = new THREE.Mesh(cloudGeo, mat);
    const w = 36.0 + rand() * 24.0;
    const h = 28.0 + rand() * 22.0;
    mesh.scale.set(w, h, 1);
    mesh.position.set(
      side * (16.5 + rand() * 14.0),
      (rand() - 0.5) * 16.0,
      z0
    );
    mesh.rotation.set(0, side * -0.22, (rand() - 0.5) * 0.5);
    scene.add(mesh);
    canyonClouds.push({ mesh, mat, z0 });
  }

  // Grand Distant Nebula Horizon Backdrop + Subtle S20 Golden Rift Foreshadowing!
  const backdropMat = createVolumetricNebulaMaterial(0x283a78, 0xffb85c, 9.4, 0.65);
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(180, 110), backdropMat);
  backdrop.position.set(0, 4, -148);
  scene.add(backdrop);

  const farRiftMat = createConsciousnessAuraMaterial();
  const farRift = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), farRiftMat);
  farRift.position.set(0, 2.5, -142);
  scene.add(farRift);

  // === 2. CONTINUITY WITH S18: SUBTLE GOLDEN DESTINY CORRIDOR CURVING THROUGH THE NEBULA CANYON ===
  const corridorPts = [
    new THREE.Vector3(0, -0.8, 12),
    new THREE.Vector3(1.2, 0.2, -24),
    new THREE.Vector3(-1.4, 1.0, -68),
    new THREE.Vector3(0.0, 2.2, -135)
  ];
  const corridorCurve = new THREE.CatmullRomCurve3(corridorPts);
  const corridorGeo = new THREE.TubeGeometry(corridorCurve, 64, 0.055, 8, false);
  const corridorMat = createCelMaterial({
    color: 0xffe89e, emissive: 0xffb830, emissiveStrength: 2.2,
    unlit: true, noInk: true, transparent: true, opacity: 0.34,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  scene.add(new THREE.Mesh(corridorGeo, corridorMat));

  // === 3. UNIFIED FLEET ASSETS: STARARK FLAGSHIP + FLANKING WEDGE CRUISERS + ESCORTS ===
  const armorMat = createCelMaterial({ color: 0xe2e8f2, shadowColor: 0x3e4866, patternMode: 2, patternScale: new THREE.Vector2(8, 12), rimStrength: 0.6, rimColor: 0xffd280 });
  const darkMat = createCelMaterial({ color: 0x222738, shadowColor: 0x0e111d });
  const cyanMat = createCelMaterial({ color: 0xa6f6ff, emissive: 0x38d2ff, emissiveStrength: 2.8, unlit: true, noInk: true });
  const goldWakeMat = createCelMaterial({
    color: 0xffe89e, emissive: 0xffb330, emissiveStrength: 2.4,
    unlit: true, noInk: true, transparent: true, opacity: 0.58,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  const cyanWakeMat = createCelMaterial({
    color: 0x8cf4ff, emissive: 0x32c8ff, emissiveStrength: 2.0,
    unlit: true, noInk: true, transparent: true, opacity: 0.42,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });

  const fleetGroup = new THREE.Group();
  scene.add(fleetGroup);

  // Center Flagship: Our exact StarArk Centrifuge Mothership!
  const flagship = buildStarArkShip();
  flagship.scale.setScalar(0.85);
  flagship.rotation.y = Math.PI / 2; // Nose forward along -Z
  fleetGroup.add(flagship);

  // Pure White-Gold "Light of Consciousness" (意识之光) Aura wrapping the Flagship!
  const auraMat = createConsciousnessAuraMaterial();
  const auraSprite = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 11.5), auraMat);
  auraSprite.position.set(0, 0, -0.5);
  fleetGroup.add(auraSprite);

  // Long luminous golden wake trailing behind Flagship
  const flagWake = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.02, 26.0, 10, 1, true), goldWakeMat);
  flagWake.rotation.x = Math.PI / 2;
  flagWake.position.set(0, 0, 16.2);
  fleetGroup.add(flagWake);

  // 4 Flanking Cruisers & Escorts sailing gracefully in formation with Flagship
  const wingConfigs = [
    { pos: new THREE.Vector3(-5.8, 1.4, 4.2), sc: 0.55 },
    { pos: new THREE.Vector3(6.2, -1.1, 4.8), sc: 0.52 },
    { pos: new THREE.Vector3(-10.8, -2.4, 9.6), sc: 0.42 },
    { pos: new THREE.Vector3(11.2, 2.8, 10.4), sc: 0.40 }
  ];
  const escorts = wingConfigs.map((cfg, idx) => {
    const c = createFlankingCruiser(armorMat, darkMat, cyanMat, idx < 2 ? goldWakeMat : cyanWakeMat, cfg.sc);
    c.group.position.copy(cfg.pos);
    fleetGroup.add(c.group);
    return { ...c, base: cfg.pos, ph: idx * 1.6 };
  });

  // === 4. 130 DRIFTING NEWBORN STAR-CLUSTER DUST MOTES ("星辰流浪") ===
  const dustGeo = new THREE.OctahedronGeometry(0.11, 0);
  const dustGoldMat = createCelMaterial({
    color: 0xfff0b8, emissive: 0xffc048, emissiveStrength: 2.8,
    unlit: true, noInk: true, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const dustCyanMat = createCelMaterial({
    color: 0xa6f6ff, emissive: 0x42dcff, emissiveStrength: 2.6,
    unlit: true, noInk: true, transparent: true, opacity: 0.80,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const starDust = [];
  for (let i = 0; i < 130; i++) {
    const m = new THREE.Mesh(dustGeo, i % 3 === 0 ? dustCyanMat : dustGoldMat);
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (4.0 + rand() * 28.0);
    const y = (rand() - 0.5) * 24.0;
    const z0 = 14.0 - rand() * 145.0;
    m.scale.setScalar(0.5 + rand() * 1.4);
    scene.add(m);
    starDust.push({ mesh: m, x, y, z0, speed: 12.0 + rand() * 10.0, ph: rand() * 6.28 });
  }

  return {
    scene,
    update(u, time, camera, audio) {
      const bass = audio ? audio.bass : 0;
      const localT = u * 8.6;

      // "意识之光" illuminates the nebula walls strongly in the first half, then settles into serene glowing wonder!
      const lightPulse = 0.72 + Math.sin(clamp(u / 0.65, 0, 1) * Math.PI) * 0.45 + bass * 0.22;

      // 1. Volumetric Nebula Canyon glides smoothly past the fleet
      const span = 18 * 8.2;
      for (let i = 0; i < canyonClouds.length; i++) {
        const cc = canyonClouds[i];
        const z = (((cc.z0 + localT * 11.5 + 132.0) % span) + span) % span - 132.0;
        cc.mesh.position.z = z;
        cc.mat.uniforms.uTime.value = localT;
        cc.mat.uniforms.uLightBoost.value = lightPulse;
      }
      backdropMat.uniforms.uTime.value = localT;
      backdropMat.uniforms.uLightBoost.value = 0.85 + u * 0.35;

      // Distant S20 Rift foreshadow glow gently brightens in final 35%
      farRiftMat.uniforms.uTime.value = localT;
      farRiftMat.uniforms.uIntensity.value = 0.25 + smoothstep(0.45, 1.0, u) * 0.85;
      farRift.quaternion.copy(camera.quaternion);

      // 2. Flagship & Flanking Escorts glide poetically along the illuminated corridor
      flagship.userData.habRing.rotation.x = localT * 1.1;
      flagship.userData.coreOrb.rotation.y = localT * 1.8;
      flagship.userData.plumes.forEach((p) => {
        p.scale.set(1.0 + bass * 0.18, 1.0 + bass * 0.45, 1.0 + bass * 0.18);
      });

      const swayX = Math.sin(localT * 0.55) * 1.1;
      const swayY = Math.cos(localT * 0.45) * 0.55;
      fleetGroup.position.set(swayX, swayY, -2.0 - u * 10.0);
      fleetGroup.rotation.z = -Math.cos(localT * 0.55) * 0.12;

      auraMat.uniforms.uTime.value = localT;
      auraMat.uniforms.uIntensity.value = (0.55 + Math.sin(clamp(u / 0.65, 0, 1) * Math.PI) * 0.65) * (0.9 + bass * 0.25);
      auraSprite.quaternion.copy(camera.quaternion);

      escorts.forEach((e) => {
        e.group.position.set(
          e.base.x,
          e.base.y + Math.sin(localT * 0.8 + e.ph) * 0.22,
          e.base.z
        );
      });

      // 3. Drifting newborn star-cluster dust motes
      for (let i = 0; i < starDust.length; i++) {
        const sd = starDust[i];
        const z = (((sd.z0 + localT * sd.speed + 132.0) % 146.0) + 146.0) % 146.0 - 132.0;
        sd.mesh.position.set(sd.x, sd.y + Math.sin(localT * 0.7 + sd.ph) * 0.35, z);
      }

      // 4. Poetic 2-Phase Cinema Camera:
      // - Phase 1 ("呜～ 意识之光", u = 0..0.48): Sweeping close-to-mid starboard shot alongside the luminous Flagship
      // - Phase 2 ("星辰流浪", u = 0.48..1.00): Grand poetic pull-back & upward drift shrinking the fleet into tiny wandering sails amidst the colossal nebula!
      const pullU = smoothstep(0.32, 1.0, u);
      camera.fov = 42 + pullU * 10;
      camera.position.set(
        5.8 - u * 10.5 - pullU * 4.5,
        2.0 + pullU * 6.5,
        10.2 + pullU * 16.5 - u * 4.0
      );
      camera.lookAt(
        fleetGroup.position.x * 0.5,
        fleetGroup.position.y * 0.5 + 0.8,
        fleetGroup.position.z - 22.0
      );
      camera.updateProjectionMatrix();

      return { sunDir: new THREE.Vector3(0.65, 0.48, -0.58), clearColor: 0x050918, shadowBounds: null };
    }
  };
}
