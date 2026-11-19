import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { clamp, smoothstep } from "../core/math.js";
import {
  buildStarfield,
  buildCelEarth,
  createJupiterTexture,
  createMarsGlobeTexture,
  buildTrajectoryArc
} from "./cosmicPrimitives.js";

// Act 13: 星际长跑 · 将人类的名字刻在光年 (Grand Solar-to-Galactic Diorama)
export function buildLightyearScene() {
  const scene = new THREE.Scene();
  scene.add(buildStarfield(2800, 460, 202613));

  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 46),
    createCelMaterial({ color: 0x13184a, unlit: true, noInk: true, depthWrite: false })
  );
  bg.position.z = -18;
  scene.add(bg);

  const sunCenter = new THREE.Vector3(-12.2, 4.4, -4.0);
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(2.7, 48, 36),
    createCelMaterial({ color: 0xfff8dc, emissive: 0xffe49c, emissiveStrength: 2.2, unlit: true, noInk: true })
  );
  sun.position.copy(sunCenter);
  scene.add(sun);

  const orbitSpecs = [
    { r: 4.0, col: 0x9b705c, dashed: false },
    { r: 5.5, col: 0xd9a86c, dashed: true },
    { r: 7.2, col: 0xd8a26e, dashed: false },
    { r: 9.8, col: 0x58a8c4, dashed: true },
    { r: 12.6, col: 0x58b8d8, dashed: false },
    { r: 15.8, col: 0xc46d68, dashed: false },
    { r: 18.2, col: 0x7c74a8, dashed: true },
    { r: 24.4, col: 0xc99c6e, dashed: false }
  ];
  orbitSpecs.forEach((o) => {
    const curve = new THREE.EllipseCurve(sunCenter.x, sunCenter.y, o.r, o.r * 0.92, -Math.PI * 0.55, Math.PI * 0.35, false, 0);
    const pts = curve.getPoints(150).map((p) => new THREE.Vector3(p.x, p.y, -4.0));
    if (!o.dashed) {
      scene.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 140, 0.024, 6, false),
          createCelMaterial({ color: o.col, unlit: true, noInk: true, transparent: true, opacity: 0.72 })
        )
      );
    } else {
      for (let k = 0; k < pts.length - 2; k += 4) {
        scene.add(
          new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.LineCurve3(pts[k], pts[k + 2]), 2, 0.02, 5, false),
            createCelMaterial({ color: o.col, unlit: true, noInk: true, transparent: true, opacity: 0.55 })
          )
        );
      }
    }
  });

  const venus = new THREE.Mesh(
    new THREE.SphereGeometry(0.76, 36, 28),
    createCelMaterial({ color: 0xf0dfc0, shadowColor: 0x62567a, patternMode: 4, patternScale: new THREE.Vector2(4, 5), patternStrength: 1.4, colorEdges: true })
  );
  venus.position.set(-5.25, 2.35, -3.5);
  scene.add(venus);

  const earth = buildCelEarth(0.98, { glowColor: 0x5dbdff, atmoIntensity: 1.45 });
  earth.position.set(0.35, 2.45, -3.2);
  scene.add(earth);

  const mars = new THREE.Mesh(
    new THREE.SphereGeometry(0.68, 36, 28),
    createCelMaterial({ color: 0xffffff, shadowColor: 0x4c3759, map: createMarsGlobeTexture(), colorEdges: true })
  );
  mars.position.set(2.05, -2.55, -3.1);
  scene.add(mars);

  const jupiter = new THREE.Mesh(
    new THREE.SphereGeometry(1.92, 48, 36),
    createCelMaterial({ color: 0xffffff, shadowColor: 0x524675, map: createJupiterTexture(), colorEdges: true, rimStrength: 0.22 })
  );
  jupiter.position.set(7.85, -1.12, -2.6);
  jupiter.rotation.set(0.12, -0.35, 0.28);
  scene.add(jupiter);

  // Golden Humanity Light-Year Ribbon launching from Earth -> Mars -> Jupiter -> Deep Space
  const grandArc = buildTrajectoryArc([
    new THREE.Vector3(0.35, 2.45, -3.05),
    new THREE.Vector3(-2.6, 0.65, -2.95),
    new THREE.Vector3(-1.4, -1.75, -2.9),
    new THREE.Vector3(2.05, -2.55, -2.8),
    new THREE.Vector3(5.35, -2.45, -2.6),
    new THREE.Vector3(8.15, -0.55, -2.4),
    new THREE.Vector3(13.5, 1.45, -2.4)
  ], 0.062, 0xffd982);
  scene.add(grandArc);

  return {
    scene,
    update(u, time, camera) {
      earth.userData.globe.rotation.y = 1.4 + time * 0.14;
      jupiter.rotation.y = -0.35 + time * 0.08;
      mars.rotation.y = 0.5 + time * 0.12;
      grandArc.userData.setProgress(clamp(0.08 + u * 0.92, 0, 1));

      camera.fov = 34;
      camera.position.set(0.15 + u * 0.5, 0.15, 14.2 - u * 0.9);
      camera.lookAt(0.35, 0.12, -3.2);
      camera.updateProjectionMatrix();
      return { sunDir: new THREE.Vector3(-0.88, 0.36, 0.31), clearColor: 0x0e133b, shadowBounds: null };
    }
  };
}

const FINALE_QUAD_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`;

// GLSL3 Soft Volumetric Harmonic Ripple Ring
const RIPPLE_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormalId;
uniform float uPhase;
uniform float uOpacity;
uniform vec3 uColor;
in vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float targetR = 0.08 + uPhase * 0.88;
  float band = exp(-pow((r - targetR) * 24.0, 2.0));
  float a = band * (1.0 - uPhase) * uOpacity;
  if (a < 0.01) discard;
  gColor = vec4(uColor * (1.2 + band * 0.6), a);
  gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
}
`;

// GLSL3 Eternal North Star 4-Point Diffraction Cross & Cosmic Aurora Veil (S30 -> S31)
const NORTH_STAR_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormalId;
uniform float uTime;
uniform float uIntensity;
in vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float core = exp(-r * 9.5);
  float halo = exp(-r * 2.4) * 0.42;
  float spikeH = exp(-abs(p.y) * 42.0) * exp(-abs(p.x) * 3.2);
  float spikeV = exp(-abs(p.x) * 42.0) * exp(-abs(p.y) * 3.2);
  float diag = exp(-abs(p.x - p.y) * 38.0) * exp(-r * 5.2) * 0.35 +
               exp(-abs(p.x + p.y) * 38.0) * exp(-r * 5.2) * 0.35;
  float breathe = 0.90 + 0.10 * sin(uTime * 1.45);
  vec3 col = mix(vec3(0.45, 0.78, 1.0), vec3(1.0, 0.88, 0.58), clamp(core * 1.6 + halo, 0.0, 1.0));
  col += vec3(1.0, 0.98, 0.90) * (core * 1.6 + (spikeH + spikeV) * 0.95 + diag);
  float a = clamp((core + halo + (spikeH + spikeV) * 0.85 + diag) * smoothstep(1.0, 0.1, r) * uIntensity * breathe, 0.0, 1.0);
  if (a < 0.008) discard;
  gColor = vec4(col, a);
  gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
}
`;

// High-Res Horizontal "101010101010..." Binary String Texture matching S28B's transformed ribbons!
function createBinaryMicroThreadTexture(seed = 2901) {
  const w = 1024, h = 128;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, w, h);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "400 42px 'SF Mono', 'Menlo', 'Consolas', monospace";

  const count = 32;
  const step = w / count;
  for (let i = 0; i < count; i++) {
    const bit = ((i * 7 + seed) % 11 === 0 ? (i + 1) : i) % 2 === 0 ? "1" : "0";
    const x = (i + 0.5) * step;
    if (bit === "1") {
      ctx.shadowColor = "rgba(255, 206, 92, 0.85)";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "rgba(255, 232, 168, 0.95)";
    } else {
      ctx.shadowColor = "rgba(82, 214, 255, 0.72)";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "rgba(138, 232, 255, 0.85)";
    }
    ctx.fillText(bit, x, h * 0.52);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

// GLSL3 Faint Glimmering "101010101010..." Micro-Light Thread Shader
// Matches S28B's MULTIVERSE_RIBBON_FRAG (uBinMorph=1.0) bit-for-bit at u=0 for a 100% pixel-seamless one-take!
const MICRO_THREAD_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormalId;
uniform sampler2D uBinTex;
uniform float uTime;
uniform float uSeed;
uniform float uOpacity;
in vec2 vUv;
void main() {
  float wave = sin(vUv.x * 10.0 + uTime * 0.9 + uSeed) * 0.22 +
               cos(vUv.x * 5.0 - uTime * 0.6 + uSeed * 1.7) * 0.15;
  float dy = (vUv.y - 0.5) - wave;
  float d = abs(dy);

  vec2 buv = vec2(vUv.x * 3.5 - uTime * (0.14 + fract(uSeed) * 0.08) + uSeed, dy * 3.6 + 0.5);
  vec4 bin = (buv.y >= 0.0 && buv.y <= 1.0) ? texture(uBinTex, buv) : vec4(0.0);
  float fineLine = exp(-d * 65.0) * 0.38;
  float endFade = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);

  vec3 col = bin.rgb * 1.15 + vec3(0.85, 0.78, 0.55) * fineLine;
  float a = max(bin.a, fineLine) * endFade * uOpacity;
  if (a < 0.01) discard;
  gColor = vec4(col, a);
  gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
}
`;

// Acts 15 & 16 (S29 -> S30 -> S31): 100% Pixel-Seamless One-Take from S28B!
// S29 ("一比特的微光"): Rapid Cosmic Pull-Back from S28B's exact frame (z=-90 -> z=0) revealing 180 sinuous "101010..." micro-light threads!
// S30 ("向尽头跃迁"): All binary micro-light threads accelerate into a transcendent golden warp -> S31 ("意识不灭") Eternal North Star!
export function buildFinaleOneBitScene() {
  const scene = new THREE.Scene();
  // Exact same 3800-star deep cosmos as S26B-S28B!
  const starfield = buildStarfield(3800, 620, 27289);
  scene.add(starfield);

  const binTexA = createBinaryMicroThreadTexture(2890);
  const binTexB = createBinaryMicroThreadTexture(2907);

  // Offset by z = -78 to match S28B's horizonGroup bit-for-bit!
  const threadsGroup = new THREE.Group();
  threadsGroup.position.set(0, 0, -78.0);
  scene.add(threadsGroup);

  const threads = [];
  const totalThreads = 180;
  for (let i = 0; i < totalThreads; i++) {
    const isInner = i < 16;
    const tMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: FINALE_QUAD_VERT,
      fragmentShader: MICRO_THREAD_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uBinTex: { value: isInner ? binTexA : (i % 2 === 0 ? binTexA : binTexB) },
        uTime: { value: 30.6 },
        uSeed: { value: i * 1.37 },
        uOpacity: { value: 0.90 }
      }
    });

    const len = isInner ? 66 : (105 + ((i * 23) % 65));
    const h = isInner ? 11.0 : (11.0 + ((i * 13) % 6));
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, h), tMat);

    let bx, by, bz;
    if (isInner) {
      const ang = (i / 16) * Math.PI * 2;
      const radX = 6.5 + (i % 4) * 3.8;
      const radY = 4.8 + (i % 3) * 3.2;
      bx = Math.cos(ang) * radX;
      by = Math.sin(ang) * radY;
      bz = -20.0 - i * 3.4;
      mesh.rotation.z = ang * 0.45 + (i % 2 === 0 ? 0.28 : -0.28);
    } else {
      const idx = i - 16;
      const col = idx % 14;
      const row = Math.floor(idx / 14);
      const jitterX = (((idx * 37) % 100) / 100 - 0.5) * 24.0;
      const jitterY = (((idx * 53) % 100) / 100 - 0.5) * 18.0;
      bx = ((col / 13) * 2.0 - 1.0) * 170.0 + jitterX;
      by = ((row / 11) * 2.0 - 1.0) * 98.0 + jitterY;
      bz = -15.0 - ((idx * 41) % 95);
      mesh.rotation.z = (((idx * 17) % 100) / 100 - 0.5) * Math.PI;
    }

    mesh.position.set(bx, by, bz);
    mesh.rotation.y = (((i * 31) % 100) / 100 - 0.5) * 0.36;

    threadsGroup.add(mesh);
    threads.push({ mesh, mat: tMat, bx, by, bz, baseRotZ: mesh.rotation.z, isInner });
  }

  // Relativistic White-Gold Light-Needle & 120 Hyperspace Star-Streaks (S30 "向尽头跃迁"!)
  const warpBeamMat = createCelMaterial({
    color: 0xfff8e2,
    emissive: 0xffd26b,
    emissiveStrength: 2.6,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const warpStreak = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.36, 120, 16), warpBeamMat);
  warpStreak.rotation.x = Math.PI / 2;
  warpStreak.position.z = -130;
  scene.add(warpStreak);

  const hyperGeo = new THREE.CylinderGeometry(0.018, 0.018, 9.0, 6);
  hyperGeo.rotateX(Math.PI / 2);
  const hyperMat = createCelMaterial({
    color: 0xfff2c8,
    emissive: 0xffc657,
    emissiveStrength: 1.8,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const hyperStreaks = [];
  for (let i = 0; i < 120; i++) {
    const ang = (i * 2.39996) % (Math.PI * 2);
    const rad = 2.2 + ((i * 19) % 100) * 0.22;
    const bz = -165 + ((i * 41) % 100) * 1.25;
    const hm = new THREE.Mesh(hyperGeo, hyperMat);
    hm.position.set(Math.cos(ang) * rad, Math.sin(ang) * rad, bz);
    scene.add(hm);
    hyperStreaks.push({ mesh: hm, bz, spd: 42 + (i % 7) * 7 });
  }

  // Eternal Distant Golden North Star (4-Point Diffraction Cross) for S30 finale & S31 Endcard ("意识不灭")
  const northStarMat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FINALE_QUAD_VERT,
    fragmentShader: NORTH_STAR_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0.0 }
    }
  });
  const northStar = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), northStarMat);
  northStar.position.set(0, 0.4, -120);
  scene.add(northStar);

  return {
    scene,
    update(submode, u, time, camera, audio) {
      const mid = audio ? audio.mid : 0;
      const bass = audio ? audio.bass : 0;

      const outroT =
        submode === "glimmer" ? u * 8.6 :
        submode === "leap" ? 8.6 + u * 12.85 :
        21.45 + u * 10.9;
      // Continuous shader clock seamlessly continuing S28B's ending seqT = 30.6!
      const syncT = 30.6 + outroT;

      const isGlimmer = submode === "glimmer";
      const isLeap = submode === "leap";
      const isEndcard = submode === "endcard";

      // S31 (t >= 278.45s): Crisp 0.48s Implosion-Collapse-to-Black Animation ("收缩到黑"), then pure dead silence!
      if (isEndcard) {
        threadsGroup.visible = false;
        warpStreak.visible = false;
        hyperStreaks.forEach((hs) => { hs.mesh.visible = false; });

        const collapseSec = u * 10.9; // elapsed seconds since 278.45s
        const collapseT = clamp(collapseSec / 0.18, 0, 1);

        if (collapseT < 1.0) {
          // Razor-fast 0.18s violent CRT-snap implosion from swollen peak -> horizontal razor line -> dead black!
          const snapY = Math.pow(1.0 - collapseT, 4.2);
          const snapX = Math.pow(1.0 - clamp((collapseT - 0.22) / 0.78, 0, 1), 3.0);
          northStar.visible = true;
          northStar.scale.set(Math.max(0.001, 6.05 * snapX), Math.max(0.001, 6.05 * snapY), 1.0);
          northStarMat.uniforms.uTime.value = outroT;
          northStarMat.uniforms.uIntensity.value = 3.7 * Math.pow(1.0 - collapseT, 1.8);

          const starCollapse = Math.max(0.001, Math.pow(1.0 - collapseT, 3.0));
          starfield.visible = collapseT < 0.72;
          starfield.scale.setScalar(starCollapse);

          camera.fov = 64.0 - collapseT * 30.0;
          camera.position.set(0, 0, -104.0 - collapseT * 10.0);
          camera.lookAt(0, 0, -120.0);
          camera.updateProjectionMatrix();
        } else {
          northStar.visible = false;
          starfield.visible = false;
        }
        return { sunDir: new THREE.Vector3(0.5, 0.6, 0.6), clearColor: 0x000000, shadowBounds: null };
      }
      starfield.visible = true;
      starfield.scale.setScalar(1.0);
      threadsGroup.visible = true;

      const pullBackT = isGlimmer ? smoothstep(0.0, 0.72, u) : 1.0;
      const leapT = isGlimmer ? 0.0 : smoothstep(0.06, 0.56, u);

      const threadVis = isGlimmer ? 0.90 : (1.0 - smoothstep(0.20, 0.58, u)) * 0.90;

      threads.forEach((th, idx) => {
        const show = threadVis > 0.015;
        th.mesh.visible = show;
        if (show) {
          th.mat.uniforms.uTime.value = syncT;
          const outerReveal = th.isInner ? 1.0 : smoothstep(0.02, 0.36, pullBackT);
          const breathe = th.isInner ? 1.0 : (0.80 + 0.20 * Math.sin(outroT * 1.1 + idx * 0.9));
          th.mat.uniforms.uOpacity.value = threadVis * outerReveal * breathe;

          const warpZ = isLeap ? leapT * 115.0 : 0.0;
          th.mesh.position.set(th.bx, th.by, th.bz + warpZ);
        }
      });

      // Phase 1 of S30 (u = 0.08..0.58): Clean Radial Hyperspace Star-Streaks only (removed ugly center cylinder!)
      const streakVis = isLeap ? smoothstep(0.08, 0.22, u) * (1.0 - smoothstep(0.46, 0.64, u)) : 0.0;
      warpStreak.visible = false;

      hyperMat.uniforms.uOpacity.value = streakVis * 0.78;
      hyperStreaks.forEach((hs) => {
        hs.mesh.visible = streakVis > 0.01;
        if (hs.mesh.visible) {
          const z = (((hs.bz + outroT * hs.spd + 165) % 125) + 125) % 125 - 165;
          hs.mesh.position.z = z;
          hs.mesh.scale.set(1, 1, 0.6 + streakVis * 1.8);
        }
      });

      // Phase 2 of S30 (u = 0.42..1.00, "意识不灭" final crescendo):
      // The Star EXPONENTIALLY SWELLS LARGER & BRIGHTER all the way to u = 1.00 (286.85s),
      // then HARD-CUTS in 1 frame to pitch-black dead silence right as the music abruptly stops!
      const starIn = isLeap ? smoothstep(0.38, 0.62, u) : 0.0;
      const swell = isLeap ? Math.pow(smoothstep(0.55, 1.00, u), 2.1) : 0.0;
      northStar.visible = starIn > 0.01;
      if (northStar.visible) {
        northStar.scale.setScalar(0.85 + swell * 5.2 + bass * 0.25);
        northStarMat.uniforms.uTime.value = outroT;
        northStarMat.uniforms.uIntensity.value = starIn * (0.92 + swell * 2.8 + mid * 0.35);
      }

      // Camera:
      // S29: Pixel-seamless handoff from S28B (z=-90 -> z=0) revealing 180 sinuous 101010... threads!
      // S30: Warps forward (z=0 -> -68), then accelerates straight into the exponentially swelling Star (z=-68 -> -104) -> INSTANT BLACKOUT at 286.85s!
      const camZ = isGlimmer
        ? (-90.0 + pullBackT * 80.0 + u * 10.0)
        : (THREE.MathUtils.lerp(0.0, -72.0, smoothstep(0.0, 0.58, u)) - swell * 32.0);
      const camX = isGlimmer ? Math.sin(outroT * 0.18) * 3.5 * pullBackT : Math.sin(outroT * 0.18) * 3.5 * (1.0 - leapT);
      const camY = isGlimmer ? Math.cos(outroT * 0.15) * 2.2 * pullBackT : 0.25 * (1.0 - swell);

      camera.fov = isGlimmer
        ? (50.0 + pullBackT * 12.0)
        : (62.0 - smoothstep(0.0, 0.25, u) * 22.0 + streakVis * 14.0 + swell * 24.0);
      camera.position.set(camX, camY, camZ);
      camera.lookAt(0, 0.4 * (1.0 - swell), -120.0);
      camera.updateProjectionMatrix();

      return { sunDir: new THREE.Vector3(0.5, 0.6, 0.6), clearColor: 0x040510, shadowBounds: null };
    }
  };
}
