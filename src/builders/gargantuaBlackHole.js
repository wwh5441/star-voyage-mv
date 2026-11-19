import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { mulberry32 } from "../core/math.js";

// Custom GLSL3 MRT Relativistic Swirling Accretion Disk Shader (Keplerian shear + Doppler beaming!)
function createAccretionDiskMaterial() {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uBass: { value: 0 }
    },
    vertexShader: `
      precision highp float;
      in vec3 position;
      in vec2 uv;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      out vec2 vUv;
      out vec3 vLocalPos;
      void main() {
        vUv = uv;
        vLocalPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uBass;
      in vec2 vUv;
      in vec3 vLocalPos;
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
        vec2 p = vLocalPos.xy;
        float r = length(p);
        // Normalize radial distance across inner ISCO (2.9) -> outer edge (12.0)
        float rn = clamp((r - 2.9) / 9.1, 0.0, 1.0);
        if (rn <= 0.001 || rn >= 0.999) discard;

        float ang = atan(p.y, p.x);
        // Differential Keplerian shear: inner plasma orbits much faster than outer plasma!
        float shearAng = ang + (2.6 / (rn + 0.28)) - uTime * (1.45 / (rn + 0.35));
        float rings = sin(rn * 28.0 + fbm(vec2(cos(shearAng) * 2.5, sin(shearAng) * 2.5 + rn * 4.0)) * 3.5) * 0.5 + 0.5;
        float streaks = fbm(vec2(cos(shearAng) * 3.2, sin(shearAng) * 3.2) + vec2(rn * 6.0, -uTime * 0.4));

        // Relativistic Doppler beaming: approaching left side (-X) blazes brighter & hotter!
        float doppler = 0.72 + 0.45 * clamp(-p.x / max(r, 0.1), -1.0, 1.0);

        float innerEdge = smoothstep(0.0, 0.07, rn);
        float outerEdge = pow(smoothstep(1.0, 0.12, rn), 1.65);
        float heat = clamp((1.0 - rn) * 0.85 + streaks * 0.45 + rings * 0.25, 0.0, 1.0);

        vec3 colDeepRed = vec3(0.82, 0.22, 0.08);
        vec3 colMoltenGold = vec3(1.0, 0.56, 0.14);
        vec3 colWhiteHot = vec3(1.0, 0.96, 0.84);

        vec3 col = mix(colDeepRed, colMoltenGold, smoothstep(0.15, 0.62, heat));
        col = mix(col, colWhiteHot, smoothstep(0.68, 0.96, heat * doppler));

        float a = clamp(innerEdge * outerEdge * (0.42 + streaks * 0.65 + rings * 0.25) * doppler, 0.0, 1.0);
        gColor = vec4(col * (0.95 + heat * 1.15 + uBass * 0.35) * a, a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Custom GLSL3 MRT Interstellar Gargantua Gravitational Lensing Halo (Warped Upper & Lower Einstein Disk Arches + Photon Ring!)
function createGargantuaLensingMaterial() {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uBass: { value: 0 }
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
      uniform float uBass;
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
        vec2 p = (vUv * 2.0 - 1.0);
        float r = length(p);
        float ang = atan(p.y, p.x);

        // Shadow radius sits at r = 0.27 in billboard UV space
        float shadowR = 0.275;
        // 1. Razor-thin white-gold relativistic photon ring hugging the event horizon shadow!
        float photonRing = exp(-pow((r - shadowR) * 44.0, 2.0)) * 2.1;

        // 2. Iconic Gargantua upper & lower gravitationally-lensed arches of the rear accretion disk!
        float archBand = exp(-pow((r - 0.36) * 9.5, 2.0)) * smoothstep(0.24, 0.31, r);
        float verticalFocus = pow(abs(sin(ang)), 1.35); // Strongest arching over the top & under the bottom!
        float swirl = 0.65 + 0.35 * noise(vec2(ang * 5.0 - uTime * 1.4, r * 18.0));
        float doppler = 0.78 + 0.36 * clamp(-p.x / max(r, 0.05), -1.0, 1.0);

        // 3. Soft outer gravitational-lensing warm aureole
        float outerGlow = exp(-max(0.0, r - shadowR) * 5.5) * smoothstep(shadowR - 0.02, shadowR + 0.05, r) * 0.45;

        vec3 colGold = vec3(1.0, 0.66, 0.24);
        vec3 colWhite = vec3(1.0, 0.96, 0.85);
        vec3 colCyanRim = vec3(0.42, 0.82, 1.0);

        float archIntensity = archBand * (0.28 + verticalFocus * 0.95) * swirl * doppler;
        vec3 col = colWhite * photonRing * doppler
                 + mix(colGold, colWhite, verticalFocus * 0.5) * archIntensity * 1.35
                 + mix(colGold, colCyanRim, 0.22) * outerGlow;

        float a = clamp((photonRing + archIntensity + outerGlow) * (0.95 + uBass * 0.25), 0.0, 1.0);
        // Punch clean pitch-black event horizon void inside shadowR
        float holeMask = smoothstep(shadowR - 0.015, shadowR + 0.005, r);
        gColor = vec4(col * holeMask * (1.0 + uBass * 0.28), a * holeMask);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Custom GLSL3 MRT Dark-Glow Spacetime Gravity-Well Funnel Lines plunging into the Black Hole!
function createGravityFunnelMaterial() {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.26 }
    },
    vertexShader: `
      precision highp float;
      in vec3 position;
      in float aR;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      out float vR;
      void main() {
        vR = aR;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uOpacity;
      in float vR;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        float infall = pow(0.5 + 0.5 * sin(vR * 18.0 + uTime * 3.8), 5.0);
        float fade = smoothstep(1.0, 0.2, vR) * smoothstep(0.0, 0.12, vR);
        vec3 col = mix(vec3(0.24, 0.56, 0.95), vec3(1.0, 0.78, 0.38), infall * 0.75 + (1.0 - vR) * 0.35);
        float a = (uOpacity + infall * 0.42) * fade;
        gColor = vec4(col * (0.9 + infall * 0.9), clamp(a, 0.0, 1.0));
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Reusable Cinema-Grade Interstellar Gargantua Black Hole Rig
export function buildGargantuaBlackHole() {
  const group = new THREE.Group();

  // 1. Pitch-Black Event Horizon Void Sphere (occludes background stars & rear disk cleanly!)
  const eventHorizon = new THREE.Mesh(
    new THREE.SphereGeometry(2.55, 48, 36),
    createCelMaterial({ color: 0x020206, unlit: true, noInk: true })
  );
  group.add(eventHorizon);

  // 2. Iconic Billboarded Gravitational Lensing Halo (Warped Upper & Lower Einstein Arches + Photon Ring!)
  const lensingMat = createGargantuaLensingMaterial();
  const lensingBillboard = new THREE.Mesh(new THREE.PlaneGeometry(19.0, 19.0), lensingMat);
  group.add(lensingBillboard);

  // 3. Swirling Relativistic Accretion Disk (tilted dramatically across the void!)
  const diskMat = createAccretionDiskMaterial();
  const diskGeo = new THREE.PlaneGeometry(24.5, 24.5, 1, 1);
  const accretionDisk = new THREE.Mesh(diskGeo, diskMat);
  accretionDisk.rotation.set(Math.PI * 0.45, 0.08, -0.14);
  group.add(accretionDisk);

  // 4. Curved Spacetime Gravity-Well Funnel Lines plunging into the Singularity
  const fPos = [], fR = [];
  const funnelMaxR = 24.0;
  // 16 Concentric warped rings plunging deeper as r -> 2.8
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const r = 3.2 + Math.pow(t, 1.35) * (funnelMaxR - 3.2);
    const y = -2.2 - 14.0 / (r * 0.55 + 0.6);
    const segs = 64;
    for (let s = 0; s < segs; s++) {
      const a0 = (s / segs) * Math.PI * 2, a1 = ((s + 1) / segs) * Math.PI * 2;
      fPos.push(Math.cos(a0) * r, y, Math.sin(a0) * r, Math.cos(a1) * r, y, Math.sin(a1) * r);
      fR.push(t, t);
    }
  }
  // 24 Radial spacetime meridians curving down into the throat
  for (let m = 0; m < 24; m++) {
    const a = (m / 24) * Math.PI * 2;
    for (let s = 0; s < 24; s++) {
      const t0 = s / 24, t1 = (s + 1) / 24;
      const r0 = 3.2 + Math.pow(t0, 1.35) * (funnelMaxR - 3.2);
      const r1 = 3.2 + Math.pow(t1, 1.35) * (funnelMaxR - 3.2);
      const y0 = -2.2 - 14.0 / (r0 * 0.55 + 0.6);
      const y1 = -2.2 - 14.0 / (r1 * 0.55 + 0.6);
      fPos.push(Math.cos(a) * r0, y0, Math.sin(a) * r0, Math.cos(a) * r1, y1, Math.sin(a) * r1);
      fR.push(t0, t1);
    }
  }
  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute("position", new THREE.Float32BufferAttribute(fPos, 3));
  fGeo.setAttribute("aR", new THREE.Float32BufferAttribute(fR, 1));
  const funnelMat = createGravityFunnelMaterial();
  const funnelLines = new THREE.LineSegments(fGeo, funnelMat);
  group.add(funnelLines);

  // 6. 120 Spiraling Infalling Accretion Dust Sparks
  const rand = mulberry32(21219);
  const dustGeo = new THREE.OctahedronGeometry(0.085, 0);
  const dustGoldMat = createCelMaterial({
    color: 0xffe89e, emissive: 0xffb330, emissiveStrength: 2.8,
    unlit: true, noInk: true, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const dustSparks = [];
  for (let i = 0; i < 120; i++) {
    const m = new THREE.Mesh(dustGeo, dustGoldMat);
    group.add(m);
    dustSparks.push({
      mesh: m,
      ang0: rand() * Math.PI * 2,
      r0: 3.4 + Math.pow(rand(), 0.8) * 10.5,
      yOff: (rand() - 0.5) * 0.65,
      speed: 0.35 + rand() * 0.85,
      sc: 0.45 + rand() * 1.15
    });
  }

  return {
    group,
    funnelLines,
    update(time, camera, bass = 0) {
      lensingBillboard.quaternion.copy(camera.quaternion);
      lensingMat.uniforms.uTime.value = time;
      lensingMat.uniforms.uBass.value = bass;

      diskMat.uniforms.uTime.value = time;
      diskMat.uniforms.uBass.value = bass;

      funnelMat.uniforms.uTime.value = time;

      for (let i = 0; i < dustSparks.length; i++) {
        const ds = dustSparks[i];
        const a = ds.ang0 + time * ds.speed * (6.0 / ds.r0);
        const tiltY = Math.sin(a) * ds.r0 * 0.16 + ds.yOff;
        ds.mesh.position.set(Math.cos(a) * ds.r0, tiltY, Math.sin(a) * ds.r0);
        ds.mesh.scale.setScalar(ds.sc * (0.85 + bass * 0.35));
      }
    }
  };
}
