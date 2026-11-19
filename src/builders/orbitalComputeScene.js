import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { mulberry32, clamp, smoothstep } from "../core/math.js";
import { buildStarfield } from "./cosmicPrimitives.js";

// Custom GLSL3 MRT Volumetric Milky Way Galactic Band Shader (replaces crude CircleGeometry + RingGeometry!)
function createMilkyWayBandMaterial() {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 }
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
        // Soft elongated galactic band stretching horizontally across the sky
        float bandEnv = exp(-p.y * p.y * 5.2) * smoothstep(1.0, 0.15, abs(p.x));
        float coreEnv = exp(-(p.x * p.x * 2.6 + p.y * p.y * 8.5));

        float clouds = fbm(vUv * vec2(6.5, 3.2) + vec2(0.02 * uTime, 0.0));
        float dustLane = smoothstep(0.38, 0.68, fbm(vUv * vec2(9.0, 5.5) + 4.2));
        // Dark cosmic dust rift cutting gently along the center of the Milky Way
        float rift = 1.0 - exp(-p.y * p.y * 38.0) * dustLane * 0.65;

        vec3 outerBlue = vec3(0.24, 0.46, 0.88);
        vec3 midCyan = vec3(0.45, 0.78, 1.0);
        vec3 warmCore = vec3(1.0, 0.82, 0.52);

        vec3 col = mix(outerBlue, midCyan, clouds) * bandEnv * rift * 0.75;
        col += warmCore * coreEnv * (0.65 + clouds * 0.55) * rift;

        float a = clamp((bandEnv * 0.55 + coreEnv * 0.65) * rift, 0.0, 1.0);
        gColor = vec4(col, a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Custom GLSL3 MRT Soft Sun-Synchronous Solar Glare (24/7 uninterrupted solar power for orbital AI compute!)
function createSolarPowerFlareMaterial() {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
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
      in vec2 vUv;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float core = exp(-r * r * 36.0) * 2.0;
        float halo = exp(-r * 4.5) * 0.65;
        float streak = exp(-abs(p.y) * 26.0) * exp(-abs(p.x) * 2.0) * 0.5;
        vec3 col = vec3(1.0, 0.96, 0.85) * core + vec3(1.0, 0.76, 0.42) * halo + vec3(0.75, 0.92, 1.0) * streak;
        float a = clamp(core + halo + streak, 0.0, 1.0);
        gColor = vec4(col, a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Custom GLSL3 MRT High-Speed Optical Inter-Satellite Tensor Laser Mesh ("Starmind" Optical Mesh!)
function createTensorLaserMeshMaterial() {
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
      in float aActive;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      out float vT;
      out float vSeed;
      out float vActive;
      void main() {
        vT = aT;
        vSeed = aSeed;
        vActive = aActive;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uPower;
      in float vT;
      in float vSeed;
      in float vActive;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        float packet1 = pow(0.5 + 0.5 * sin(vT * 12.566 - uTime * 8.5 + vSeed), 6.0);
        float packet2 = pow(0.5 + 0.5 * sin(vT * 12.566 + uTime * 6.0 - vSeed * 1.7), 6.0);
        float p = max(packet1, packet2);
        vec3 baseCol = vec3(0.28, 0.78, 1.0);
        vec3 tensorCol = vec3(1.0, 0.88, 0.48);
        vec3 col = mix(baseCol, tensorCol, packet1 * 0.85);
        float a = (0.24 + p * 0.76) * vActive * uPower;
        gColor = vec4(col * (1.0 + p * 1.55), clamp(a, 0.0, 1.0));
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Custom GLSL3 MRT Converged Galactic Compute Optical Beam (piercing straight through the Milky Way!)
function createGalacticComputeBeamMaterial() {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uPower: { value: 1.0 }
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
        float pulse = pow(0.5 + 0.5 * sin(vUv.y * 32.0 - uTime * 20.0), 4.0);
        float fade = smoothstep(0.0, 0.05, vUv.y) * pow(1.0 - vUv.y, 0.65);
        float core = pow(vCore, 1.85);
        vec3 col = mix(vec3(0.36, 0.86, 1.0), vec3(1.0, 0.90, 0.58), core * 0.65 + pulse * 0.45);
        float a = clamp(fade * (core * 0.85 + 0.15) * (0.7 + pulse * 0.65) * uPower, 0.0, 1.0);
        gColor = vec4(col * (1.2 + pulse * 1.4) * a, a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// SpaceX "AI1" Orbital AI Data Center Satellite:
// Colossal 75m-class golden photovoltaic solar wings + glowing cyan GPU/Tensor compute core + white infrared thermal radiators!
function createSpaceXAI1Satellite(mats, scale = 1.0, detail = true) {
  const g = new THREE.Group();

  // Central high-density AI tensor-compute bus spine
  const bus = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.52, 0.72), mats.darkHull);
  g.add(bus);

  // Glowing cyan AI tensor-core compute strips along both sides of the bus
  const coreStrip = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.14, 0.78), mats.cyanCore);
  g.add(coreStrip);

  // Optical Inter-Satellite Laser Terminal Nodes (front + rear)
  const laserNode = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), mats.goldCore);
  laserNode.position.set(1.05, 0, 0);
  g.add(laserNode);

  // Colossal 75m-class Deployable Golden Solar Wings (unfolding symmetrically along +Z and -Z!)
  const wingL = new THREE.Group();
  wingL.position.set(0, 0, 0.42);
  const panelL = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.04, 5.2), mats.goldSolar);
  panelL.position.z = 2.65;
  wingL.add(panelL);
  g.add(wingL);

  const wingR = new THREE.Group();
  wingR.position.set(0, 0, -0.42);
  const panelR = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.04, 5.2), mats.goldSolar);
  panelR.position.z = -2.65;
  wingR.add(panelR);
  g.add(wingR);

  // White Vacuum Infrared Thermal Radiator Fins (perpendicular to solar wings, dumping AI compute heat to deep space!)
  if (detail) {
    const radTop = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.85, 0.04), mats.radiator);
    radTop.position.set(0, 1.25, 0);
    g.add(radTop);
    const radBot = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.85, 0.04), mats.radiator);
    radBot.position.set(0, -1.25, 0);
    g.add(radBot);
  }

  g.scale.setScalar(scale);
  return { group: g, wingL, wingR };
}

// S16: SpaceX x xAI Orbital AI Compute Network ("算力穿透银河 · 引擎在高歌")
export function buildOrbitalComputeScene() {
  const scene = new THREE.Scene();
  const rand = mulberry32(16169);
  scene.add(buildStarfield(2800, 440, 16169));

  // === 1. GENUINE GLSL3 VOLUMETRIC MILKY WAY GALACTIC BAND + 24/7 SUN-SYNCHRONOUS SOLAR FLARE ===
  const mwMat = createMilkyWayBandMaterial();
  const mwPlane = new THREE.Mesh(new THREE.PlaneGeometry(240, 88), mwMat);
  mwPlane.position.set(16, 12, -110);
  mwPlane.rotation.set(0.08, -0.14, 0.34);
  scene.add(mwPlane);

  const sunFlareMat = createSolarPowerFlareMaterial();
  const sunFlare = new THREE.Mesh(new THREE.PlaneGeometry(42, 42), sunFlareMat);
  sunFlare.position.set(-48, 22, -72);
  scene.add(sunFlare);

  const mats = {
    steel: createCelMaterial({ color: 0xe2e8f0, shadowColor: 0x454f6e, patternMode: 2, patternScale: new THREE.Vector2(8, 16), patternStrength: 0.9, rimStrength: 0.55, rimColor: 0xffd580 }),
    darkHull: createCelMaterial({ color: 0x202638, shadowColor: 0x0e111d, rimStrength: 0.35, rimColor: 0x80f2ff }),
    goldSolar: createCelMaterial({ color: 0xf2ba4e, shadowColor: 0x7c4c12, patternMode: 2, patternScale: new THREE.Vector2(8, 22), patternStrength: 1.0, rimStrength: 0.6, rimColor: 0xfff0b8 }),
    radiator: createCelMaterial({ color: 0xf0f4fa, shadowColor: 0x6b7c9c, patternMode: 2, patternScale: new THREE.Vector2(10, 6), patternStrength: 0.65, rimStrength: 0.35, rimColor: 0x9cf2ff }),
    cyanCore: createCelMaterial({ color: 0x9cf4ff, emissive: 0x26d4ff, emissiveStrength: 2.6, unlit: true, noInk: true }),
    goldCore: createCelMaterial({ color: 0xffe89e, emissive: 0xffb330, emissiveStrength: 2.6, unlit: true, noInk: true })
  };

  // === 2. FOREGROUND-LEFT: STARSHIP "PEZ DISPENSER" DEPLOYING AI1 SATELLITES WITH ROARING VACUUM RAPTOR ENGINES ("引擎在高歌") ===
  const starship = new THREE.Group();
  starship.position.set(-10.2, -3.2, 5.0);
  starship.rotation.set(0.14, 0.58, -0.46);

  const hullAft = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 7.6, 24), mats.steel);
  hullAft.position.y = -3.4;
  starship.add(hullAft);

  // Pez-dispenser payload slot bay
  const bayBody = new THREE.Mesh(new THREE.CylinderGeometry(1.54, 1.54, 3.6, 22), mats.steel);
  bayBody.position.y = 2.2;
  starship.add(bayBody);
  const pezSlot = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.2, 1.85), mats.cyanCore);
  pezSlot.position.set(1.42, 2.3, 0);
  starship.add(pezSlot);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.55, 4.4, 24), mats.steel);
  nose.position.y = 6.2;
  starship.add(nose);

  // 3 Roaring Blue-White Vacuum Raptor Engine Plumes ("引擎 · 在高歌"!)
  const vacPlumeMat = createCelMaterial({
    color: 0x9cf4ff, emissive: 0x38c2ff, emissiveStrength: 2.8,
    unlit: true, noInk: true, transparent: true, opacity: 0.72,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  });
  const plumes = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const pl = new THREE.Mesh(new THREE.ConeGeometry(0.68, 7.2, 14, 1, true), vacPlumeMat);
    pl.position.set(Math.cos(a) * 0.58, -10.8, Math.sin(a) * 0.58);
    pl.rotation.x = Math.PI;
    starship.add(pl);
    plumes.push(pl);
  }
  scene.add(starship);

  // === 3. MASSIVE 3D "STARMIND" ORBITAL AI COMPUTE CONSTELLATION (26 AI1 Satellites in Precision Orbital Formation!) ===
  const clusterGroup = new THREE.Group();
  scene.add(clusterGroup);

  const nodes = [];
  // Hero freshly-dispensed AI1 unfolding its 75m solar wings right out of Starship's Pez slot!
  const heroAI1 = createSpaceXAI1Satellite(mats, 0.92, true);
  clusterGroup.add(heroAI1.group);
  nodes.push({ obj: heroAI1, base: new THREE.Vector3(-1.8, -0.4, 1.5), isHero: true, layer: 0, phase: 0 });

  // 25 Additional AI1 Orbital Data Center Nodes arranged in a sweeping 3D Sun-synchronous orbital matrix stretching toward the Milky Way!
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const z = -6.0 - row * 10.5 + (rand() - 0.5) * 2.4;
      const x = -6.0 + col * 6.2 + row * 1.4 + (rand() - 0.5) * 1.8;
      const y = -4.5 + (col % 3) * 4.4 + row * 1.1 + (rand() - 0.5) * 1.5;
      const sc = clamp(0.76 - row * 0.09, 0.34, 0.78);
      const sat = createSpaceXAI1Satellite(mats, sc, row < 2);
      sat.group.position.set(x, y, z);
      // Orient massive golden solar wings cleanly toward the 24/7 Sun on the upper-left!
      sat.group.rotation.set(0.12, -0.35 + (rand() - 0.5) * 0.2, 0.18);
      clusterGroup.add(sat.group);
      nodes.push({ obj: sat, base: new THREE.Vector3(x, y, z), isHero: false, layer: row + 1, phase: rand() * 6.28 });
    }
  }

  // === 4. HIGH-SPEED OPTICAL INTER-SATELLITE TENSOR LASER MESH (Weaving all 26 AI1 nodes into ONE Orbital Brain!) ===
  const edges = [];
  for (let i = 0; i < nodes.length; i++) {
    // Connect each AI1 node to its 3 nearest neighbors in 3D space
    const dists = [];
    for (let j = i + 1; j < nodes.length; j++) {
      const d2 = nodes[i].base.distanceToSquared(nodes[j].base);
      if (d2 < 320) dists.push({ j, d2 });
    }
    dists.sort((a, b) => a.d2 - b.d2);
    for (let k = 0; k < Math.min(3, dists.length); k++) {
      edges.push({ iA: i, iB: dists[k].j, delay: Math.min(nodes[i].layer, nodes[dists[k].j].layer) * 0.10 });
    }
  }

  const meshPos = new Float32Array(edges.length * 2 * 3);
  const meshT = new Float32Array(edges.length * 2);
  const meshSeed = new Float32Array(edges.length * 2);
  const meshActive = new Float32Array(edges.length * 2);
  for (let e = 0; e < edges.length; e++) {
    meshT[e * 2 + 0] = 0.0;
    meshT[e * 2 + 1] = 1.0;
    meshSeed[e * 2 + 0] = e * 1.17;
    meshSeed[e * 2 + 1] = e * 1.17;
  }
  const meshGeo = new THREE.BufferGeometry();
  meshGeo.setAttribute("position", new THREE.BufferAttribute(meshPos, 3));
  meshGeo.setAttribute("aT", new THREE.BufferAttribute(meshT, 1));
  meshGeo.setAttribute("aSeed", new THREE.BufferAttribute(meshSeed, 1));
  meshGeo.setAttribute("aActive", new THREE.BufferAttribute(meshActive, 1));
  const tensorMeshMat = createTensorLaserMeshMaterial();
  const tensorMesh = new THREE.LineSegments(meshGeo, tensorMeshMat);
  tensorMesh.frustumCulled = false;
  scene.add(tensorMesh);

  // === 5. CONVERGED GALACTIC COMPUTE BEAM PIERCING STRAIGHT INTO THE MILKY WAY CORE! ===
  const beamOrigin = new THREE.Vector3(6.5, 2.2, -16.0);
  const beamTarget = new THREE.Vector3(16.0, 12.0, -110.0);
  const beamDir = beamTarget.clone().sub(beamOrigin).normalize();
  const beamLen = beamTarget.distanceTo(beamOrigin);

  const mainBeamMat = createGalacticComputeBeamMaterial();
  const mainBeamGeo = new THREE.CylinderGeometry(0.95, 0.22, beamLen, 20, 12, true);
  mainBeamGeo.translate(0, beamLen * 0.5, 0);
  const mainBeam = new THREE.Mesh(mainBeamGeo, mainBeamMat);
  mainBeam.position.copy(beamOrigin);
  mainBeam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamDir);
  scene.add(mainBeam);

  return {
    scene,
    update(u, time, camera, audio) {
      const bass = audio ? audio.bass : 0;
      const localT = u * 8.2;

      mwMat.uniforms.uTime.value = localT;
      sunFlareMat.uniforms.uTime.value = localT;

      // Starship vacuum Raptor engines roar ("引擎 · 在高歌")!
      plumes.forEach((pl, idx) => {
        const sc = 0.95 + bass * 0.55 + 0.14 * Math.sin(time * 32 + idx * 2.1);
        pl.scale.set(1.0 + bass * 0.18, sc, 1.0 + bass * 0.18);
      });
      starship.position.set(-10.2 + u * 1.4, -3.2 + u * 0.9, 5.0 - u * 1.2);

      // Hero AI1 freshly dispensed from Starship Pez slot & unfolding its colossal 75m golden solar wings!
      const deployU = smoothstep(0.02, 0.42, u);
      const wingUnfold = smoothstep(0.10, 0.55, u);
      nodes.forEach((n) => {
        if (n.isHero) {
          n.obj.group.position.set(
            -5.2 + deployU * 4.8,
            -1.4 + deployU * 1.6 + Math.sin(localT * 1.2) * 0.18,
            3.2 - deployU * 2.6
          );
          n.obj.group.rotation.set(0.15, -0.35 + deployU * 0.22, 0.12);
          n.obj.wingL.scale.z = 0.08 + 0.92 * wingUnfold;
          n.obj.wingR.scale.z = 0.08 + 0.92 * wingUnfold;
        } else {
          n.obj.group.position.set(
            n.base.x,
            n.base.y + Math.sin(localT * 0.8 + n.phase) * 0.24,
            n.base.z
          );
          n.obj.wingL.scale.z = 0.65 + 0.35 * wingUnfold;
          n.obj.wingR.scale.z = 0.65 + 0.35 * wingUnfold;
        }
      });

      // Live-update Optical Inter-Satellite Tensor Laser Mesh
      const meshWaveU = smoothstep(0.08, 0.72, u);
      for (let e = 0; e < edges.length; e++) {
        const ed = edges[e];
        const pA = nodes[ed.iA].obj.group.position;
        const pB = nodes[ed.iB].obj.group.position;
        const i6 = e * 6;
        meshPos[i6 + 0] = pA.x; meshPos[i6 + 1] = pA.y; meshPos[i6 + 2] = pA.z;
        meshPos[i6 + 3] = pB.x; meshPos[i6 + 4] = pB.y; meshPos[i6 + 5] = pB.z;
        const act = smoothstep(ed.delay, ed.delay + 0.22, meshWaveU);
        meshActive[e * 2 + 0] = act;
        meshActive[e * 2 + 1] = act;
      }
      meshGeo.attributes.position.needsUpdate = true;
      meshGeo.attributes.aActive.needsUpdate = true;
      tensorMeshMat.uniforms.uTime.value = localT;
      tensorMeshMat.uniforms.uPower.value = 0.85 + bass * 0.35;

      // Converged Galactic Compute Beam surges straight into the Milky Way core!
      const beamPower = smoothstep(0.28, 0.68, u);
      mainBeam.visible = beamPower > 0.01;
      mainBeamMat.uniforms.uTime.value = localT;
      mainBeamMat.uniforms.uPower.value = beamPower * (0.95 + bass * 0.3);

      // Sweeping Orbital Cinema Camera:
      // Starts beside Starship deploying Hero AI1 -> glides smoothly right & forward through the 26-node Starmind Laser Lattice toward the Milky Way!
      camera.fov = 41 + u * 6;
      camera.position.set(
        -4.2 + u * 9.5,
        1.8 + u * 2.4,
        15.8 - u * 5.8
      );
      camera.lookAt(
        2.5 + u * 5.5,
        1.2 + u * 2.8,
        -22.0 - u * 18.0
      );
      camera.updateProjectionMatrix();

      // Keep sun flare billboarded to camera
      sunFlare.quaternion.copy(camera.quaternion);

      return { sunDir: new THREE.Vector3(-0.78, 0.38, 0.48), clearColor: 0x040610, shadowBounds: null };
    }
  };
}
