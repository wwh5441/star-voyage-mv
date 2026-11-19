import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { mulberry32, clamp } from "../core/math.js";

// High-detail procedural rocky exoplanet surface (canyons, dust plains, impact basins, polar frost)
// Palette bridges directly into S12 reentry atmosphere (#b85c52 -> #eba97c) and S13 Martian wasteland
function createDetailedRockyPlanetTexture() {
  const w = 1024, h = 512;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");

  // Base terracotta-rust atmospheric latitude gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, "#e6d8cc"); // North polar frost
  grad.addColorStop(0.09, "#c46b4b");
  grad.addColorStop(0.28, "#b04e38");
  grad.addColorStop(0.52, "#d1734d");
  grad.addColorStop(0.76, "#9c4132");
  grad.addColorStop(0.92, "#b8634a");
  grad.addColorStop(1.0, "#dfd2c8"); // South polar frost
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const rand = mulberry32(11985);

  // Broad basaltic dark lowlands & highland dust plateaus
  for (let i = 0; i < 48; i++) {
    const x = rand() * w;
    const y = 52 + rand() * (h - 104);
    const rx = 38 + rand() * 140;
    const ry = 14 + rand() * 52;
    ctx.fillStyle = i % 3 === 0 ? "rgba(86, 34, 34, 0.24)" : i % 3 === 1 ? "rgba(232, 162, 110, 0.22)" : "rgba(128, 48, 36, 0.20)";
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, (rand() - 0.5) * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sweeping equatorial rift canyons (Valles-Marineris style geological scars)
  ctx.lineCap = "round";
  for (let c = 0; c < 9; c++) {
    let cx = rand() * w;
    let cy = h * (0.28 + rand() * 0.44);
    ctx.strokeStyle = c % 2 === 0 ? "rgba(62, 22, 28, 0.42)" : "rgba(244, 188, 138, 0.26)";
    ctx.lineWidth = 2.5 + rand() * 5.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    for (let s = 0; s < 7; s++) {
      cx += 22 + rand() * 38;
      cy += (rand() - 0.5) * 18;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  // Subtle impact craters with sunlit rim & dark floor
  for (let k = 0; k < 65; k++) {
    const x = rand() * w;
    const y = 60 + rand() * (h - 120);
    const r = 3 + Math.pow(rand(), 2.2) * 18;
    ctx.fillStyle = "rgba(68, 26, 30, 0.28)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(245, 192, 146, 0.28)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x - r * 0.14, y - r * 0.14, r * 0.96, 0, Math.PI * 2);
    ctx.stroke();
  }

  // High-altitude wispy ochre dust-storm bands
  for (let d = 0; d < 24; d++) {
    const y = 75 + rand() * (h - 150);
    const x = rand() * w;
    const len = 80 + rand() * 220;
    const dg = ctx.createLinearGradient(x, y, x + len, y);
    dg.addColorStop(0, "rgba(242, 188, 138, 0)");
    dg.addColorStop(0.5, "rgba(242, 188, 138, 0.18)");
    dg.addColorStop(1, "rgba(242, 188, 138, 0)");
    ctx.fillStyle = dg;
    ctx.fillRect(x, y, len, 2 + rand() * 5);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

// True MRT-compatible GLSL3 Fresnel Atmospheric Scattering Shader (zero hard outer edge!)
function createFresnelAtmosphereMaterial(sunDir) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    uniforms: {
      uSunDir: { value: sunDir.clone().normalize() },
      uInnerColor: { value: new THREE.Color(0xff9b62) },
      uOuterColor: { value: new THREE.Color(0xffd6a6) }
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
      uniform vec3 uInnerColor;
      uniform vec3 uOuterColor;
      in vec3 vWorldNormal;
      in vec3 vWorldPos;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float ndv = clamp(dot(N, V), 0.0, 1.0);
        // Smooth Fresnel crescent: peaks near horizon limb, fades cleanly toward center
        float rim = pow(1.0 - ndv, 3.0) * smoothstep(0.0, 0.22, ndv);
        // Sun-side twilight wrap so night side stays dark deep space
        float sunWrap = smoothstep(-0.32, 0.65, dot(N, normalize(uSunDir)));
        vec3 col = mix(uInnerColor, uOuterColor, pow(1.0 - ndv, 2.0));
        float alpha = rim * sunWrap * 1.15;
        gColor = vec4(col * alpha, alpha);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// MRT-compatible GLSL3 Soft Radial Parent-Star Flare + Subtle Anamorphic Streak
function createStarFlareMaterial() {
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
        float core = exp(-r * r * 42.0) * 2.2;
        float halo = exp(-r * 4.8) * 0.72;
        // Subtle horizontal anamorphic cinema lens streak
        float streak = exp(-abs(p.y) * 28.0) * exp(-abs(p.x) * 2.2) * 0.55;
        float shimmer = 0.96 + 0.04 * sin(uTime * 3.5);
        vec3 col = vec3(1.0, 0.94, 0.82) * core + vec3(1.0, 0.74, 0.45) * halo + vec3(0.75, 0.90, 1.0) * streak;
        float a = clamp((core + halo + streak) * uIntensity * shimmer, 0.0, 1.0);
        gColor = vec4(col * uIntensity * shimmer, a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// MRT-compatible GLSL3 Dark-Glow Flowing Gravity Streamlines (matches S08B's refined aesthetic!)
function createDarkGlowFieldLineMaterial(baseColorHex, flowColorHex, baseAlpha = 0.14) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uFade: { value: 1.0 },
      uBaseColor: { value: new THREE.Color(baseColorHex) },
      uFlowColor: { value: new THREE.Color(flowColorHex) },
      uAlpha: { value: baseAlpha }
    },
    vertexShader: `
      precision highp float;
      in vec3 position;
      in float aT;
      in float aPhase;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      out float vT;
      out float vPhase;
      void main() {
        vT = aT;
        vPhase = aPhase;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uFade;
      uniform vec3 uBaseColor;
      uniform vec3 uFlowColor;
      uniform float uAlpha;
      in float vT;
      in float vPhase;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        float endFade = smoothstep(0.0, 0.15, vT) * smoothstep(1.0, 0.85, vT);
        float pulse = pow(0.5 + 0.5 * sin(vT * 10.0 - uTime * 2.8 + vPhase), 4.0);
        vec3 col = mix(uBaseColor, uFlowColor, pulse * 0.78);
        float a = (uAlpha + pulse * uAlpha * 1.45) * endFade * uFade;
        gColor = vec4(col * (0.85 + pulse * 0.75), a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Helper to pack multiple 3D curves into a single LineSegments BufferGeometry with aT & aPhase
function buildStreamlineGeometry(curves, segsPerCurve = 44) {
  const pos = [];
  const aT = [];
  const aPhase = [];
  curves.forEach((curve, idx) => {
    const phase = idx * 1.37;
    for (let s = 0; s < segsPerCurve; s++) {
      const t0 = s / segsPerCurve;
      const t1 = (s + 1) / segsPerCurve;
      const p0 = curve.getPoint(t0);
      const p1 = curve.getPoint(t1);
      pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
      aT.push(t0, t1);
      aPhase.push(phase, phase);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("aT", new THREE.Float32BufferAttribute(aT, 1));
  geo.setAttribute("aPhase", new THREE.Float32BufferAttribute(aPhase, 1));
  return geo;
}

// Dynamic Plasma/Ion Slipstream Ribbon trailing behind the Ark (no stiff plastic tube!)
function createIonRibbon(sampleCount = 44) {
  const vertCount = sampleCount * 2;
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices = [];

  for (let i = 0; i < sampleCount; i++) {
    const t = i / (sampleCount - 1); // 0 = faded tail, 1 = hot engine nozzle
    uvs[i * 4 + 0] = t;
    uvs[i * 4 + 1] = 0;
    uvs[i * 4 + 2] = t;
    uvs[i * 4 + 3] = 1;
    if (i < sampleCount - 1) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);

  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uBoost: { value: 1.0 }
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
      uniform float uBoost;
      in vec2 vUv;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        float across = abs(vUv.y * 2.0 - 1.0);
        float core = exp(-across * across * 7.5);
        float edgeGlow = exp(-across * across * 2.0) * 0.45;
        float along = pow(vUv.x, 1.85) * smoothstep(1.0, 0.92, vUv.x);
        float wave = 0.85 + 0.15 * sin(vUv.x * 26.0 - uTime * 16.0);
        vec3 tailCol = vec3(0.32, 0.82, 1.0);
        vec3 nozzleCol = vec3(1.0, 0.88, 0.56);
        vec3 col = mix(tailCol, nozzleCol, smoothstep(0.45, 0.96, vUv.x));
        float intensity = (core + edgeGlow) * along * wave * uBoost;
        gColor = vec4(col * intensity * 1.45, clamp(intensity, 0.0, 1.0));
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return { mesh, geo, mat, sampleCount };
}

export function buildSlingshotTransferRig(ringPointWorld) {
  const group = new THREE.Group();

  // 1. True Slingshot Acceleration & Hyperbolic Escape Curve:
  // Winds tightly into periapsis (r: 35.6 -> 34.4 -> 36.8), then SNAPS outward along the hyperbolic escape tangent!
  const p0 = ringPointWorld(35.6, 1.92, 1.05);  // Exact S11A end
  const p1 = ringPointWorld(34.4, 1.72, 1.25);  // Periapsis dip (cocking the gravitational slingshot!)
  const p2 = ringPointWorld(38.2, 1.48, 2.40);  // SNAP release point off outer ring tangent!
  const p3 = ringPointWorld(58.0, 1.24, 5.80);  // Breaking free of Jupiter's gravity well!
  const p4 = ringPointWorld(108.0, 1.08, 12.2); // Explosive hyperbolic deep-space fling!
  const p5 = ringPointWorld(162.0, 0.99, 17.6); // Coasting toward new gravity system
  const p6 = ringPointWorld(198.0, 0.94, 20.6); // Entering new rocky planet sunlit horizon
  const slingshotCurve = new THREE.CatmullRomCurve3([p0, p1, p2, p3, p4, p5, p6]);

  // 2. Curved Slingshot Acceleration Track (5 tight luminous hyperbolic guide rails + 14 dark-glow gravity field lines)
  // Makes the curved acceleration lane & hyperbolic escape from Jupiter visually unmistakable!
  const depCurves = [];
  for (let i = -2; i <= 2; i++) {
    const rOff = i * 0.65;
    const hOff = -0.35 + Math.abs(i) * 0.14;
    depCurves.push(new THREE.CatmullRomCurve3([
      ringPointWorld(35.6 + rOff, 2.02, 0.7 + hOff),
      ringPointWorld(34.4 + rOff * 0.8, 1.72, 0.9 + hOff),
      ringPointWorld(38.2 + rOff * 1.1, 1.48, 2.1 + hOff),
      ringPointWorld(58.0 + rOff * 1.6, 1.24, 5.5 + hOff),
      ringPointWorld(108.0 + rOff * 2.4, 1.08, 11.8 + hOff)
    ]));
  }
  const slingRailMat = createDarkGlowFieldLineMaterial(0x52c8ff, 0xffdc7a, 0.32);
  const slingRailLines = new THREE.LineSegments(buildStreamlineGeometry(depCurves, 56), slingRailMat);
  group.add(slingRailLines);

  const wellCurves = [];
  for (let i = -5; i <= 5; i++) {
    if (i === 0) continue;
    const rOff = i * 2.8;
    const hOff = (i % 2 === 0 ? 1 : -1) * 0.85 - 0.6;
    wellCurves.push(new THREE.CatmullRomCurve3([
      ringPointWorld(34.5 + rOff, 2.14, hOff),
      ringPointWorld(35.0 + rOff * 1.1, 1.72, hOff + 0.8),
      ringPointWorld(48.0 + rOff * 1.45, 1.38, hOff + 3.4),
      ringPointWorld(92.0 + rOff * 2.1, 1.14, hOff + 8.8)
    ]));
  }
  const depFieldMat = createDarkGlowFieldLineMaterial(0x3a6494, 0xffbe60, 0.11);
  const depFieldLines = new THREE.LineSegments(buildStreamlineGeometry(wellCurves, 42), depFieldMat);
  group.add(depFieldLines);

  // Escape-Velocity Snap Shockwave Ring at periapsis release (p2) — pops when Ark breaks free of Jupiter's gravity!
  const escapeRingMat = createCelMaterial({
    color: 0x9cf2ff,
    emissive: 0x58dcff,
    emissiveStrength: 2.8,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const escapeRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.18, 48), escapeRingMat);
  const escapePos = slingshotCurve.getPoint(0.28);
  const escapeTan = slingshotCurve.getPoint(0.30).sub(escapePos).normalize();
  escapeRing.position.copy(escapePos);
  escapeRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), escapeTan);
  group.add(escapeRing);

  // 3. New Rocky Planetary Gravity System (monumental sunlit horizon, ZERO toy hoops!)
  const newSysPos = ringPointWorld(222.0, 0.90, 18.8);
  const newSystemGroup = new THREE.Group();
  newSystemGroup.position.copy(newSysPos);
  group.add(newSystemGroup);

  const sunDir = new THREE.Vector3(-0.78, 0.36, 0.51).normalize();

  const targetRockyPlanet = new THREE.Mesh(
    new THREE.SphereGeometry(18.0, 64, 48),
    createCelMaterial({
      color: 0xffffff,
      shadowColor: 0x1a112a,
      map: createDetailedRockyPlanetTexture(),
      colorEdges: true,
      rimStrength: 0.42,
      rimColor: 0xffa672,
      receiveShadow: false
    })
  );
  newSystemGroup.add(targetRockyPlanet);

  // True Fresnel Atmospheric Scattering Shell (soft luminous salmon-gold crescent, zero hard brown outline!)
  const atmoMat = createFresnelAtmosphereMaterial(sunDir);
  const targetAtmoShell = new THREE.Mesh(new THREE.SphereGeometry(18.75, 64, 48), atmoMat);
  newSystemGroup.add(targetAtmoShell);

  // Delicate Dark-Glow Gravitational Capture Streamlines curving gently into the new rocky world
  const capCurves = [];
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const tilt = (i % 3 - 1) * 0.24;
    const pts = [];
    for (let k = 0; k <= 5; k++) {
      const f = k / 5;
      const rad = 42.0 - f * 22.5;
      const a = ang + f * 0.72;
      pts.push(new THREE.Vector3(
        Math.cos(a) * rad,
        Math.sin(a * 0.7 + tilt) * rad * 0.28,
        Math.sin(a) * rad
      ));
    }
    capCurves.push(new THREE.CatmullRomCurve3(pts));
  }
  const capFieldMat = createDarkGlowFieldLineMaterial(0x3a6494, 0xffa86b, 0.12);
  const capFieldLines = new THREE.LineSegments(buildStreamlineGeometry(capCurves, 32), capFieldMat);
  newSystemGroup.add(capFieldLines);

  // Blazing Parent Star peeking over the upper-left limb of the new rocky planet!
  const starFlareMat = createStarFlareMaterial();
  const parentStarSprite = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), starFlareMat);
  parentStarSprite.position.set(-22.5, 14.5, -16.0);
  newSystemGroup.add(parentStarSprite);

  // Clean Midground-Left Parallax Cratered Moon (well separated from the planet's limb!)
  const parallaxMoon = new THREE.Mesh(
    new THREE.SphereGeometry(1.85, 32, 24),
    createCelMaterial({
      color: 0xd0cad8,
      shadowColor: 0x221d36,
      rimStrength: 0.6,
      rimColor: 0xffd2a8,
      receiveShadow: false
    })
  );
  parallaxMoon.position.set(-28.0, -4.5, 16.0);
  newSystemGroup.add(parallaxMoon);

  // 4. Dual Crossed Dynamic Plasma/Ion Slipstream Ribbons trailing directly behind the Ark
  const ribbonH = createIonRibbon(42);
  const ribbonV = createIonRibbon(42);
  group.add(ribbonH.mesh, ribbonV.mesh);

  const tmpPos = new THREE.Vector3();
  const tmpNext = new THREE.Vector3();
  const tmpTan = new THREE.Vector3();
  const tmpSide = new THREE.Vector3();
  const tmpUp = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const basisMat = new THREE.Matrix4();

  function updateRibbon(ribbon, sNow, trailLen, halfWidth, useUpAxis) {
    const posArr = ribbon.geo.attributes.position.array;
    for (let i = 0; i < ribbon.sampleCount; i++) {
      const f = i / (ribbon.sampleCount - 1); // 0 = tail, 1 = nozzle
      const sSample = clamp(sNow - (1.0 - f) * trailLen, 0.0, 0.998);
      slingshotCurve.getPoint(sSample, tmpPos);
      slingshotCurve.getPoint(Math.min(0.999, sSample + 0.006), tmpNext);
      tmpTan.copy(tmpNext).sub(tmpPos).normalize();
      tmpSide.crossVectors(tmpTan, worldUp).normalize();
      tmpUp.crossVectors(tmpSide, tmpTan).normalize();

      const w = halfWidth * (0.18 + Math.sin(f * Math.PI) * 0.82);
      const axis = useUpAxis ? tmpUp : tmpSide;
      const idx = i * 6;
      posArr[idx + 0] = tmpPos.x - axis.x * w;
      posArr[idx + 1] = tmpPos.y - axis.y * w;
      posArr[idx + 2] = tmpPos.z - axis.z * w;
      posArr[idx + 3] = tmpPos.x + axis.x * w;
      posArr[idx + 4] = tmpPos.y + axis.y * w;
      posArr[idx + 5] = tmpPos.z + axis.z * w;
    }
    ribbon.geo.attributes.position.needsUpdate = true;
  }

  return {
    group,
    update(u, time, camera, ark, audio, streakGroup, streaks, giantGroup, giantPlanet, giantRingSystem) {
      const bass = audio ? audio.bass : 0;

      // Departure gas giant stays visible until we've fully whipped away into deep space
      giantGroup.visible = u < 0.72;
      if (giantGroup.visible) {
        giantPlanet.rotation.y = -0.55 + time * 0.018;
        giantRingSystem.update(time, 1.0);
      }

      // Dark-glow gravitational field streamlines + curved slingshot acceleration track:
      slingRailMat.uniforms.uTime.value = time * 1.65;
      slingRailMat.uniforms.uFade.value = clamp(1.0 - (u - 0.35) / 0.32, 0.0, 1.0);
      depFieldMat.uniforms.uTime.value = time;
      depFieldMat.uniforms.uFade.value = clamp(1.0 - (u - 0.25) / 0.40, 0.0, 1.0);
      capFieldMat.uniforms.uTime.value = time;
      capFieldMat.uniforms.uFade.value = clamp((u - 0.42) / 0.40, 0.0, 1.0);
      capFieldLines.rotation.y = time * 0.04;

      // Escape-velocity snap shockwave ring pops right when Ark breaks free of Jupiter's gravity (u = 0.30..0.58)
      const escU = clamp((u - 0.30) / 0.28, 0.0, 1.0);
      escapeRing.visible = escU > 0.001 && escU < 0.99;
      if (escapeRing.visible) {
        escapeRing.scale.setScalar(1.0 + Math.pow(escU, 0.65) * 16.0);
        escapeRingMat.uniforms.uOpacity.value = Math.sin(escU * Math.PI) * 0.85;
      }

      // New rocky planet slow majestic rotation + parent star billboard facing camera
      targetRockyPlanet.rotation.y = -0.5 + time * 0.035;
      parallaxMoon.position.set(
        -27.5 + Math.sin(time * 0.18) * 3.5,
        -4.2 + Math.cos(time * 0.15) * 1.4,
        15.5 + Math.cos(time * 0.18) * 3.0
      );

      // TRUE SLINGSHOT PHYSICS PROFILE:
      // 0.00..0.32: Winding tight along periapsis curve (building kinetic tension!)
      // 0.32..0.72: EXPLOSIVE SLINGSHOT FLING! (rapid exponential acceleration breaking free of Jupiter!)
      // 0.72..1.00: Graceful capture deceleration into the new rocky planet gravity system!
      let s;
      if (u < 0.32) {
        const t = u / 0.32;
        s = 0.28 * (t * t * 0.65 + t * 0.35);
      } else if (u < 0.72) {
        const t = (u - 0.32) / 0.40;
        const accel = t * t * (3.0 - 2.0 * t); // Whip surge!
        s = 0.28 + 0.56 * (accel * 0.75 + t * 0.25);
      } else {
        const t = (u - 0.72) / 0.28;
        const decel = 1.0 - Math.pow(1.0 - t, 1.8);
        s = 0.84 + 0.155 * decel;
      }
      s = clamp(s, 0.001, 0.995);

      const pNow = slingshotCurve.getPoint(s);
      const pNext = slingshotCurve.getPoint(Math.min(0.999, s + 0.01));

      ark.scale.setScalar(0.24 + u * 0.10);
      ark.position.copy(pNow);
      tmpTan.copy(pNext).sub(pNow).normalize();
      tmpSide.crossVectors(tmpTan, worldUp).normalize();
      tmpUp.crossVectors(tmpSide, tmpTan).normalize();

      // Hard periapsis G-force bank (-34 deg) into Jupiter's gravity well, then snapping level & counter-banking on escape!
      const periTension = Math.sin(clamp(u / 0.42, 0, 1) * Math.PI);
      const escapeSnap = Math.sin(clamp((u - 0.30) / 0.45, 0, 1) * Math.PI);
      const whipBank = -0.22 * (1.0 - u) - periTension * 0.42 + escapeSnap * 0.55;
      const cosB = Math.cos(whipBank), sinB = Math.sin(whipBank);
      const bankedUp = tmpUp.clone().multiplyScalar(cosB).addScaledVector(tmpSide, sinB);
      const bankedSide = tmpSide.clone().multiplyScalar(cosB).addScaledVector(tmpUp, -sinB);
      basisMat.makeBasis(tmpTan, bankedUp, bankedSide);
      ark.quaternion.setFromRotationMatrix(basisMat);

      // Engine afterburner peaks explosively at slingshot release (u = 0.30..0.68)!
      const burn = Math.pow(Math.sin(clamp((u - 0.08) / 0.74, 0, 1) * Math.PI), 0.85);
      ark.userData.plumes.forEach((p) => {
        const sc = 1.0 + burn * 2.6 + bass * 0.65 + 0.18 * Math.sin(time * 38);
        p.scale.set(1.0 + burn * 0.32, sc, 1.0 + burn * 0.32);
      });

      const trailLen = 0.045 + burn * 0.19;
      updateRibbon(ribbonH, s, trailLen, 0.42 + burn * 0.42, false);
      updateRibbon(ribbonV, s, trailLen, 0.36 + burn * 0.36, true);
      ribbonH.mat.uniforms.uTime.value = time;
      ribbonH.mat.uniforms.uBoost.value = 0.6 + burn * 1.15;
      ribbonV.mat.uniforms.uTime.value = time;
      ribbonV.mat.uniforms.uBoost.value = 0.5 + burn * 1.0;

      // Relativistic star-streaks kick in HARD right after slingshot snap (u = 0.28..0.78)!
      const surge = Math.sin(clamp((u - 0.24) / 0.56, 0, 1) * Math.PI);
      streakGroup.visible = surge > 0.03;
      if (streakGroup.visible) {
        streakGroup.position.copy(pNow).addScaledVector(tmpTan, 34.0);
        const streakLook = new THREE.Matrix4().lookAt(
          streakGroup.position,
          pNow.clone().addScaledVector(tmpTan, 80.0),
          tmpUp
        );
        streakGroup.quaternion.setFromRotationMatrix(streakLook);
        const span = 88.0;
        streaks.forEach((st) => {
          const zNorm = (((st.baseZ + time * st.speed * (1.5 + surge * 1.4)) % span) + span) % span;
          st.mesh.position.z = zNorm - (span - 10.0);
          st.mesh.scale.set(1, 0.8 + surge * 3.4, 1);
        });
      }

      // 3-Act Slingshot Camera:
      // Act 1 (u=0..0.32): Stays low by outer ring edge as Ark dives into periapsis & ROCKETS PAST lens!
      // Act 2 (u=0.32..0.68): Explosive FOV punch (42 -> 66 deg) + subtle G-force vibration as Jupiter whips away behind!
      // Act 3 (u=0.68..1.0): Sweeps around starboard-aft to unveil monumental sunlit rocky horizon + parent star!
      const s11AEndCam = ringPointWorld(35.6 + 7.2, 1.92 + 0.14, 3.1);
      const chaseSideOffset = -2.4 + Math.pow(u, 1.25) * 5.6;
      const chaseUpOffset = 1.65 - u * 0.55;
      const chaseBackOffset = -(5.4 + surge * 3.2 - clamp((u - 0.70) / 0.30, 0, 1) * 1.8);
      const dynamicCam = pNow.clone()
        .addScaledVector(tmpTan, chaseBackOffset)
        .addScaledVector(tmpUp, chaseUpOffset)
        .addScaledVector(tmpSide, chaseSideOffset);

      const h = clamp(u / 0.30, 0, 1);
      const smoothH = h * h * (3.0 - 2.0 * h);
      const camPos = s11AEndCam.clone().lerp(dynamicCam, smoothH);

      // Subtle G-force camera tremor right at periapsis slingshot snap (u = 0.28..0.52)
      const gShake = Math.sin(clamp((u - 0.26) / 0.28, 0, 1) * Math.PI) * 0.14;
      if (gShake > 0.005) {
        camPos.x += Math.sin(time * 54.0) * gShake;
        camPos.y += Math.cos(time * 47.0) * gShake * 0.8;
      }

      const s11AEndLook = ringPointWorld(35.6 - 6.0, 1.92 - 0.28, -0.1);
      const horizonTarget = newSysPos.clone().add(new THREE.Vector3(-4.0, 2.5, 0.0));
      const planetBlend = clamp((u - 0.45) / 0.44, 0, 0.82);
      const activeLook = pNow.clone().addScaledVector(tmpTan, 10.0).lerp(horizonTarget, planetBlend);
      const lookAtPt = s11AEndLook.clone().lerp(activeLook, smoothH);

      camera.fov = 41 + Math.pow(surge, 0.85) * 24 - clamp((u - 0.74) / 0.26, 0, 1) * 2;
      camera.position.copy(camPos);
      camera.lookAt(lookAtPt);
      camera.updateProjectionMatrix();

      // Billboard parent star flare toward camera
      parentStarSprite.quaternion.copy(camera.quaternion);
      starFlareMat.uniforms.uTime.value = time;
      starFlareMat.uniforms.uIntensity.value = clamp((u - 0.25) / 0.45, 0.15, 1.0);

      return { sunDir, clearColor: 0x040610, shadowBounds: null };
    }
  };
}
