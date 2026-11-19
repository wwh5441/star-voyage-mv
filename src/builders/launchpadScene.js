import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { mulberry32, clamp, smoothstep } from "../core/math.js";
import { buildStarfield } from "./cosmicPrimitives.js";

// Acts 01–03: Starrail Approach -> Reactor Countdown -> 脱轨赴星海 Liftoff!
export function buildLaunchpadScene() {
  const scene = new THREE.Scene();
  scene.add(buildStarfield(2400, 460, 202601));

  // Night-to-ignition sky dome
  const skyCv = document.createElement("canvas");
  skyCv.width = 16;
  skyCv.height = 256;
  const sctx = skyCv.getContext("2d");
  const grad = sctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, "#050713");
  grad.addColorStop(0.55, "#111636");
  grad.addColorStop(0.80, "#2b2552");
  grad.addColorStop(0.92, "#3f2e5e");
  grad.addColorStop(1.0, "#1d1836");
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 16, 256);
  const skyMat = createCelMaterial({
    color: 0xffffff,
    map: new THREE.CanvasTexture(skyCv),
    unlit: true,
    noInk: true,
    side: THREE.BackSide,
    depthWrite: false
  });
  const skyDome = new THREE.Mesh(new THREE.CylinderGeometry(380, 380, 190, 64, 1, true), skyMat);
  skyDome.position.y = 70;
  scene.add(skyDome);

  // Steppe plain + 1-point perspective Starrail
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420, 40, 40).rotateX(-Math.PI / 2),
    createCelMaterial({
      color: 0x3b355c,
      shadowColor: 0x1d1934,
      patternMode: 3,
      patternScale: new THREE.Vector2(18, 18),
      patternStrength: 0.75,
      rimStrength: 0.04
    })
  );
  scene.add(ground);

  const ballast = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.28, 152),
    createCelMaterial({ color: 0x5c5678, shadowColor: 0x2c2846 })
  );
  ballast.position.set(0, 0.12, -46);
  scene.add(ballast);

  const railMat = createCelMaterial({ color: 0xd0d6eb, shadowColor: 0x52567a, rimStrength: 0.45, rimColor: 0xffe4b5 });
  [-0.76, 0.76].forEach((rx) => {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 152), railMat.clone());
    r.position.set(rx, 0.33, -46);
    scene.add(r);
  });

  const sleeperMat = createCelMaterial({ color: 0x4b3f52, shadowColor: 0x241d30 });
  sleeperMat.defines = { USE_INSTANCING: "" };
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(2.55, 0.12, 0.32), sleeperMat, 100);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 100; i++) {
    dummy.position.set(0, 0.25, 28 - i * 1.42);
    dummy.updateMatrix();
    sleepers.setMatrixAt(i, dummy.matrix);
  }
  scene.add(sleepers);

  // Launch Complex at z = -112
  const padGroup = new THREE.Group();
  padGroup.position.set(0, 0, -112);
  scene.add(padGroup);

  const concrete = new THREE.Mesh(
    new THREE.BoxGeometry(30, 2.4, 24),
    createCelMaterial({ color: 0x7b7891, shadowColor: 0x393556 })
  );
  concrete.position.y = 1.2;
  padGroup.add(concrete);

  // Floodlight towers
  const poleMat = createCelMaterial({ color: 0x9fa4bc, shadowColor: 0x454868 });
  const bulbMat = createCelMaterial({ color: 0xfff3d1, emissive: 0xffdf9a, emissiveStrength: 2.6, unlit: true, noInk: true });
  [-26, 26].forEach((px) => {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 15, 6), poleMat);
    mast.position.set(px, 7.5, 4);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 12), bulbMat);
    bulb.position.set(px, 15.2, 4);
    padGroup.add(mast, bulb);
  });

  // 4 Articulated Tulip Service Trusses
  const trussPivots = [];
  const trussMat = createCelMaterial({ color: 0xd8d2be, shadowColor: 0x5c557d, rimStrength: 0.35 });
  for (let idx = 0; idx < 4; idx++) {
    const baseRot = new THREE.Group();
    baseRot.rotation.y = (idx * Math.PI) / 2 + Math.PI / 4;
    padGroup.add(baseRot);

    const pivot = new THREE.Group();
    pivot.position.set(4.8, 2.4, 0);
    baseRot.add(pivot);

    // Tilt ONE unified truss sub-group so rails, rungs, and top collar stay 100% solidly connected (ZERO floating rungs!)
    const armBody = new THREE.Group();
    armBody.rotation.z = 0.14;
    pivot.add(armBody);

    const boomLen = 23.0;
    // 4 solid corner truss chords (front/back x left/right) forming a true 3D lattice tower!
    [[-0.42, -0.55], [-0.42, 0.55], [0.42, -0.55], [0.42, 0.55]].forEach(([bx, bz]) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.24, boomLen, 0.24), trussMat);
      c.position.set(bx, boomLen * 0.5, bz);
      armBody.add(c);
    });
    const braceMat = createCelMaterial({ color: 0xc2bcab, shadowColor: 0x4e486e, partId: 40 + idx });
    for (let k = 1; k <= 7; k++) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.22, 1.34), braceMat);
      rung.position.set(0, k * 2.85, 0);
      armBody.add(rung);
    }
    const collar = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.5, 2.2), braceMat);
    collar.position.set(-0.55, boomLen - 1.0, 0);
    armBody.add(collar);
    trussPivots.push(pivot);
  }

  // Deep-Space Ark Launch Vehicle ("星航号运载箭")
  const rocketGroup = new THREE.Group();
  rocketGroup.position.set(0, 2.4, 0);
  padGroup.add(rocketGroup);

  const hullWhite = createCelMaterial({
    color: 0xf4eee0,
    shadowColor: 0x6a5f8e,
    patternMode: 2,
    patternScale: new THREE.Vector2(6, 10),
    patternStrength: 0.7,
    rimStrength: 0.42
  });
  const hullBlue = createCelMaterial({ color: 0x4e6496, shadowColor: 0x29325c, rimStrength: 0.35 });
  const amberRing = createCelMaterial({ color: 0xe69738, shadowColor: 0x73463d });
  const reactorGlowMat = createCelMaterial({
    color: 0x9cf2ff,
    emissive: 0x4ddbff,
    emissiveStrength: 2.2,
    unlit: true,
    noInk: true
  });

  const core = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.32, 18.5, 24), hullWhite);
  core.position.y = 9.8;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.18, 1.2, 24), amberRing);
  band.position.y = 16.8;
  const coreRing = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.12, 10, 32), reactorGlowMat);
  coreRing.rotation.x = Math.PI / 2;
  coreRing.position.y = 14.2;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.16, 5.8, 24), hullWhite);
  nose.position.y = 21.95;
  rocketGroup.add(core, band, coreRing, nose);

  for (let i = 0; i < 4; i++) {
    const bWrap = new THREE.Group();
    bWrap.rotation.y = (i * Math.PI) / 2 + Math.PI / 4;
    rocketGroup.add(bWrap);
    const booster = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 1.44, 13.8, 20),
      i % 2 === 0 ? hullWhite.clone() : hullBlue.clone()
    );
    booster.position.set(1.95, 7.1, 0);
    booster.rotation.z = 0.088;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.9, 0.14), amberRing);
    fin.position.set(3.05, 1.35, 0);
    bWrap.add(booster, fin);
  }

  // Blazing Exhaust Plume
  const plumeOuter = new THREE.Mesh(
    new THREE.ConeGeometry(3.6, 17.5, 24, 1, true),
    createCelMaterial({
      color: 0xffb84d,
      emissive: 0xffa630,
      emissiveStrength: 3.0,
      unlit: true,
      noInk: true,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    })
  );
  plumeOuter.rotation.x = Math.PI;
  plumeOuter.position.y = -8.2;
  const plumeCore = new THREE.Mesh(
    new THREE.ConeGeometry(1.85, 11.5, 20),
    createCelMaterial({ color: 0xfffbe8, emissive: 0xfff4cc, emissiveStrength: 4.2, unlit: true, noInk: true })
  );
  plumeCore.rotation.x = Math.PI;
  plumeCore.position.y = -5.2;
  rocketGroup.add(plumeOuter, plumeCore);

  // Soft Volumetric Searchlight Cone
  const beamGeo = new THREE.ConeGeometry(13.5, 68, 32, 1, true);
  beamGeo.translate(0, -34, 0);
  beamGeo.rotateZ(Math.PI / 2);
  const beamMat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      precision highp float;
      uniform mat4 modelMatrix; uniform mat4 viewMatrix; uniform mat4 projectionMatrix;
      in vec3 position; in vec3 normal; in vec2 uv;
      out vec2 vUv; out vec3 vNW; out vec3 vPW;
      void main() {
        vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0);
        vPW = wp.xyz; vNW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      layout(location = 0) out vec4 gColor; layout(location = 1) out vec4 gNormalId;
      uniform vec3 cameraPosition; in vec2 vUv; in vec3 vNW; in vec3 vPW;
      void main() {
        float edgeFade = pow(abs(dot(normalize(vNW), normalize(cameraPosition - vPW))), 1.65);
        float lenFade = smoothstep(0.0, 0.78, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
        float a = edgeFade * lenFade * 0.42;
        gColor = vec4(vec3(1.0, 0.93, 0.76) * a, a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
  const searchlight = new THREE.Mesh(beamGeo, beamMat);
  searchlight.position.set(0, 23.5, 0);
  padGroup.add(searchlight);

  // Rolling 3D Cel Smoke Bank around Pad Trench
  const smokeGroup = new THREE.Group();
  padGroup.add(smokeGroup);
  const smokePuffs = [];
  const rand = mulberry32(4075);
  const puffGeo = new THREE.IcosahedronGeometry(1.0, 3);
  for (let i = 0; i < 54; i++) {
    const ring = i < 18 ? 0 : i < 38 ? 1 : 2;
    const angle = i * 2.39996 + rand() * 0.4;
    const dist = ring === 0 ? 3.2 + rand() * 5.0 : ring === 1 ? 8.5 + rand() * 9.0 : 17.0 + rand() * 10.0;
    const bx = Math.cos(angle) * dist * 1.45;
    const bz = Math.sin(angle) * dist * 0.44;
    const rad = (ring === 0 ? 3.2 : ring === 1 ? 4.2 : 5.0) * (0.75 + rand() * 0.45);
    const nearFlame = clamp(1.0 - Math.hypot(bx * 0.6, bz) / 22.0, 0, 1);
    const puff = new THREE.Mesh(
      puffGeo,
      createCelMaterial({
        color: new THREE.Color().lerpColors(new THREE.Color(0x52456e), new THREE.Color(0xffd27d), Math.pow(nearFlame, 1.35)),
        shadowColor: new THREE.Color().lerpColors(new THREE.Color(0x282142), new THREE.Color(0x694d75), nearFlame),
        emissive: 0xff9f38,
        emissiveStrength: Math.pow(nearFlame, 2.2) * 1.25,
        partId: 200 + (i % 9),
        rimStrength: nearFlame * 0.6,
        rimColor: 0xffe49e
      })
    );
    puff.position.set(bx, rad * 0.42 - 0.5, bz);
    smokeGroup.add(puff);
    smokePuffs.push({ mesh: puff, bx, bz, rad, phase: rand() * Math.PI * 2 });
  }

  return {
    scene,
    update(submode, u, time, camera, audio) {
      const bass = audio ? audio.bass : 0;
      reactorGlowMat.uniforms.uEmissiveStrength.value = 1.6 + bass * 2.2 + Math.sin(time * 4.0) * 0.4;

      if (submode === "approach") {
        smokeGroup.visible = false;
        plumeOuter.visible = false;
        plumeCore.visible = false;
        searchlight.visible = true;
        rocketGroup.position.y = 2.4;
        trussPivots.forEach((p) => { p.rotation.z = 0; });
        searchlight.rotation.y = Math.PI + Math.sin(time * 0.45) * 0.36;
        searchlight.rotation.z = -0.05;

        camera.fov = 38;
        camera.position.set(0, 2.0, 24.0 - u * 22.0);
        camera.lookAt(0, 8.2, -112);
        camera.updateProjectionMatrix();
        skyMat.uniforms.uColor.value.setHex(0x888cc4);
        return { sunDir: new THREE.Vector3(-0.35, 0.45, 0.82), clearColor: 0x060814, shadowBounds: null };
      }

      // S03A -> S03B -> S03C: 10.3s Unbroken ONE-TAKE using the EXACT SAME S01/S04/S05 launchpad & rocket asset!
      if (submode === "s03_bottom" || submode === "s03_top" || submode === "s03_bloom") {
        const p = submode === "s03_bottom"
          ? (u * 3.4) / 10.3
          : submode === "s03_top"
            ? (3.4 + u * 3.4) / 10.3
            : (6.8 + u * 3.5) / 10.3;

        smokeGroup.visible = true;
        plumeOuter.visible = false;
        plumeCore.visible = false;
        searchlight.visible = false;
        rocketGroup.position.y = 2.4;

        // Trusses remain 100% clamped (0) through S03A & S03B, then bloom smoothly outward (0 -> -0.45) in S03C,
        // handing off 1:1 into S04 (-0.45 -> -0.72)!
        const bloom = smoothstep(0.66, 0.99, p);
        trussPivots.forEach((pv) => { pv.rotation.z = -bloom * 0.45; });

        for (const sp of smokePuffs) {
          const g = 0.16 + p * 0.09; // Ends at 0.25 -> exact match to S04 start!
          sp.mesh.scale.set(sp.rad * g, sp.rad * 0.65 * g, sp.rad * g);
          sp.mesh.position.y = sp.rad * 0.25 * g - 0.8;
        }

        // Continuous 10.3s One-Take camera orbiting the exact padGroup at (0, 0, -112):
        // S03A (0..0.33): Low at rocket base (y=3.6) looking steeply UP ->
        // S03B (0.33..0.66): Spirals up to the top nosecone (y=26.0) ->
        // S03C (0.66..1.00): Pulls gracefully back into S04's exact framing as the 4 Tulip Trusses bloom open!
        const riseT = smoothstep(0.0, 0.66, p);
        const pullT = smoothstep(0.64, 1.0, p);
        const ang = THREE.MathUtils.lerp(-2.35, -0.55, p); // Ends at -0.55 -> 1:1 with S04 start!
        const r = 12.5 + riseT * 3.5 + pullT * 8.0;        // Ends at 24.0 -> 1:1 with S04 start!
        const camY = THREE.MathUtils.lerp(3.6, 26.2, riseT) - pullT * 20.7; // Ends at 5.5 -> 1:1 with S04 start!
        const lookY = THREE.MathUtils.lerp(14.5, 22.0, riseT) - pullT * 9.5; // Ends at 12.5 -> 1:1 with S04 start!

        camera.fov = THREE.MathUtils.lerp(42, 35, pullT); // Ends at 35 -> 1:1 with S04 start!
        camera.position.set(Math.sin(ang) * r, camY, -112 + Math.cos(ang) * r);
        camera.lookAt(0, lookY, -112);
        camera.updateProjectionMatrix();
        skyMat.uniforms.uColor.value.setRGB(0.76 + p * 0.04, 0.72, 0.92);
        return { sunDir: new THREE.Vector3(0.45, 0.55, 0.70), clearColor: 0x090a1a, shadowBounds: null };
      }

      if (submode === "closeup") {
        // S04: Seamless continuation from S03C! 4 Tulip Trusses continue blooming from -0.45 -> -0.72 (fully open)!
        smokeGroup.visible = true;
        plumeOuter.visible = false;
        plumeCore.visible = false;
        searchlight.visible = false;
        rocketGroup.position.y = 2.4;
        const finishRetract = -0.45 - smoothstep(0.0, 0.45, u) * 0.27;
        trussPivots.forEach((p) => { p.rotation.z = finishRetract; });
        for (const sp of smokePuffs) {
          const g = 0.25 + u * 0.25;
          sp.mesh.scale.set(sp.rad * g, sp.rad * 0.65 * g, sp.rad * g);
          sp.mesh.position.y = sp.rad * 0.25 * g - 0.8;
        }

        const ang = -0.55 + u * 1.15;
        const r = 24.0 - u * 4.5;
        camera.fov = 35;
        camera.position.set(Math.sin(ang) * r, 5.5 + u * 15.5, -112 + Math.cos(ang) * r);
        camera.lookAt(0, 12.5 + u * 6.5, -112);
        camera.updateProjectionMatrix();
        skyMat.uniforms.uColor.value.setRGB(0.8 + u * 0.35, 0.72, 0.92);
        return { sunDir: new THREE.Vector3(0.45, 0.55, 0.70), clearColor: 0x090a1a, shadowBounds: null };
      }

      // Act 03: LIFTOFF! 脱轨赴星海 · 点火越尘埃 — High-thrust rapid climb clearing tower into upper sky!
      smokeGroup.visible = true;
      plumeOuter.visible = true;
      plumeCore.visible = true;
      searchlight.visible = false;

      // Trusses remain wide-open at -0.72 (already bloomed open across S03C -> S04!)
      trussPivots.forEach((p) => { p.rotation.z = -0.72; });

      // Strong exponential liftoff acceleration: clears the 23-unit tower by u=0.35 and rockets 135 units high!
      const climbT = Math.pow(clamp((u - 0.03) / 0.97, 0, 1), 2.35);
      const climbY = climbT * 135.0;
      rocketGroup.position.y = 2.4 + climbY;

      const flick = 0.92 + 0.14 * Math.sin(time * 52.0) + bass * 0.22;
      const tailStretch = 0.62 + climbT * 0.42;
      plumeOuter.scale.set(0.62 * flick, tailStretch * flick, 0.62 * flick);
      plumeCore.scale.set(0.55 * flick, (0.58 + climbT * 0.32) * flick, 0.55 * flick);

      const swell = smoothstep(0.0, 0.38, u);
      for (const sp of smokePuffs) {
        const g = (0.55 + 0.85 * swell) * (1.0 + 0.08 * Math.sin(time * 2.8 + sp.phase));
        sp.mesh.scale.set(sp.rad * 1.42 * g, sp.rad * 0.92 * g, sp.rad * 1.15 * g);
        sp.mesh.position.x = sp.bx * (0.75 + 0.45 * swell);
        sp.mesh.position.y = sp.rad * 0.48 * g - 0.4;
      }

      skyMat.uniforms.uColor.value.setRGB(1.48 - climbT * 0.65, 0.92 - climbT * 0.32, 0.72 + climbT * 0.35);
      const shake = (0.065 + bass * 0.08) * (1.0 - climbT * 0.55);
      camera.fov = 38 + climbT * 8.0;
      camera.position.set(
        Math.sin(time * 42) * shake,
        3.2 + climbT * 9.5 + Math.cos(time * 47) * shake,
        -54.0 + u * 10.0
      );
      camera.lookAt(0, 13.0 + climbY * 0.92, -112);
      camera.updateProjectionMatrix();
      return { sunDir: new THREE.Vector3(0.0, 0.35, 0.93), clearColor: 0x161126, shadowBounds: null };
    }
  };
}
