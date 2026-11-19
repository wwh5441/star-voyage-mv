import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { mulberry32, smoothstep } from "../core/math.js";
import { buildStarfield, buildTrajectoryArc, buildStarArkShip } from "./cosmicPrimitives.js";

// S08 Split into 2 Clean, Distinct Shots:
// - S08A ("explore_future", 65.0-68.8s): 耶～ 探未来 — Sleek Ark Cruiser firing a clean long-range golden-cyan scanner sweep toward 3 distant frontier beacons
// - S08B ("deduce_veins",   68.8-73.5s): 推演这 · 宇宙命脉 — Uncluttered Golden Galactic Core + 2 Astrolabe Rings + 16 Clean Radial Veins + 24 Zipping Photons
export function buildCosmicVeinsScene() {
  const scene = new THREE.Scene();
  scene.add(buildStarfield(2400, 440, 2026088));

  const rand = mulberry32(10588);
  const nodeGold = createCelMaterial({ color: 0xffe494, emissive: 0xffb330, emissiveStrength: 2.2, unlit: true, noInk: true });
  const nodeCyan = createCelMaterial({ color: 0x80f2ff, emissive: 0x3ac8ff, emissiveStrength: 2.1, unlit: true, noInk: true });
  const ringGoldMat = createCelMaterial({ color: 0xffd578, emissive: 0xffa824, emissiveStrength: 1.55, unlit: true, noInk: true, transparent: true, opacity: 0.8 });
  const ringCyanMat = createCelMaterial({ color: 0x7ce6ff, emissive: 0x26b6ff, emissiveStrength: 1.45, unlit: true, noInk: true, transparent: true, opacity: 0.65 });

  // =========================================================================
  // SHOT A: S08A · 探未来深空扫描 (Clean Ship + Forward Scanner Cone + 3 Frontier Beacons)
  // =========================================================================
  const futureGroup = new THREE.Group();
  scene.add(futureGroup);

  const ark = buildStarArkShip();
  ark.scale.setScalar(0.55);
  // buildStarArkShip nose is +X; +Math.PI/2 rotates +X -> -Z (straight forward into deep space!)
  ark.rotation.y = Math.PI / 2;
  futureGroup.add(ark);

  // Forward-flight slipstream streaks rushing toward +Z past the cruising Ark
  const streakMat = createCelMaterial({
    color: 0x9cf2ff,
    emissive: 0x4fd8ff,
    emissiveStrength: 1.8,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const flightStreaks = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rad = 2.4 + (i % 5) * 1.3;
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 2.4, 5), streakMat);
    st.rotation.x = Math.PI / 2;
    const z0 = -((i * 2.1) % 38);
    st.position.set(Math.cos(a) * rad, Math.sin(a) * rad * 0.65, z0);
    futureGroup.add(st);
    flightStreaks.push({ mesh: st, x: Math.cos(a) * rad, y: Math.sin(a) * rad * 0.65, z0, sp: 24 + (i % 4) * 6 });
  }

  // Translucent long-range cyan-gold scanner cone projecting straight ahead from the bow
  const scanCone = new THREE.Mesh(
    new THREE.ConeGeometry(4.2, 22.0, 32, 1, true),
    createCelMaterial({
      color: 0x7ce6ff,
      emissive: 0x38c0ff,
      emissiveStrength: 1.2,
      unlit: true,
      noInk: true,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  scanCone.rotation.x = Math.PI / 2;
  scanCone.position.set(0, 0, -12.5);
  futureGroup.add(scanCone);

  // 3 Expanding Sonar/Scanner Pulse Rings shooting forward from the ship's bow into the future!
  const scanRings = [];
  for (let i = 0; i < 3; i++) {
    const sr = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.032, 8, 48), i === 0 ? ringGoldMat.clone() : ringCyanMat.clone());
    futureGroup.add(sr);
    scanRings.push({ mesh: sr, phase: i / 3 });
  }

  // 3 Distant Frontier Star Beacons illuminating ahead in deep space
  const beacons = [
    new THREE.Vector3(-4.5, 1.8, -24),
    new THREE.Vector3( 0.8, 0.4, -30),
    new THREE.Vector3( 5.4, 2.2, -26)
  ].map((pos, idx) => {
    const bGrp = new THREE.Group();
    bGrp.position.copy(pos);
    bGrp.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), idx === 1 ? nodeGold : nodeCyan));
    const bRing = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.026, 8, 36), idx === 1 ? ringGoldMat : ringCyanMat);
    bGrp.add(bRing);
    futureGroup.add(bGrp);
    return { grp: bGrp, ring: bRing };
  });

  // =========================================================================
  // SHOT B: S08B · 推演宇宙命脉 (Restored: 3D Spacetime Curvature Grid + 3 Gravity Wells + Galactic Spiral + Neural Deduction Slingshot!)
  // =========================================================================
  const veinsGroup = new THREE.Group();
  scene.add(veinsGroup);

  // 1. TRUE TRANSPARENT 3D QUAD SPACETIME GRAVITY FIELD LINES (引力线 — ZERO solid blue slab, ZERO diagonal triangle clutter!)
  const wells = [
    { x: -5.2, z:  2.2, mass: 6.2, r: 0.78, col: 0x7ce6ff },
    { x:  4.4, z: -2.6, mass: 6.8, r: 0.88, col: 0xffd578 },
    { x: -0.4, z: -9.8, mass: 9.8, r: 1.20, col: 0xffe494 }
  ];

  // Build 4x dense woven-silk spacetime gravity lines (112 x 112 lines x 88 sub-segments each) with subtle dark-glow flow!
  const lineCount = 112;
  const subDiv = 88;
  const gridSpan = 38.0;
  const segVerts = [];
  const segDepths = [];
  for (let i = 0; i <= lineCount; i++) {
    const f = (i / lineCount - 0.5) * gridSpan;
    for (let j = 0; j < subDiv; j++) {
      const a0 = (j / subDiv - 0.5) * gridSpan;
      const a1 = ((j + 1) / subDiv - 0.5) * gridSpan;
      // Smooth X-parallel gravity curve
      segVerts.push(a0, 0, f, a1, 0, f);
      segDepths.push(0, 0);
      // Smooth Z-parallel gravity curve
      segVerts.push(f, 0, a0, f, 0, a1);
      segDepths.push(0, 0);
    }
  }
  const gravLineGeo = new THREE.BufferGeometry();
  const gravBaseXZ = new Float32Array(segVerts);
  gravLineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(segVerts), 3));
  gravLineGeo.setAttribute("aDepth", new THREE.BufferAttribute(new Float32Array(segDepths), 1));

  // MRT-compatible WebGL2 GLSL3 Dynamic Flowing Gravity-Field Line Shader (flowing energy currents streaming along every gravity line into the 3 deep funnels!)
  const gravLineMat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0.0 },
      uOpacity: { value: 1.0 },
      uScanZ: { value: -40.0 }
    },
    vertexShader: /* glsl */ `
      precision highp float;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      in vec3 position;
      in float aDepth;
      out float vDepth;
      out float vRadialFade;
      out vec2 vXZ;
      void main() {
        vDepth = aDepth;
        vXZ = position.xz;
        float dist = length(position.xz);
        vRadialFade = 1.0 - smoothstep(12.5, 20.0, dist);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uScanZ;
      in float vDepth;
      in float vRadialFade;
      in vec2 vXZ;
      void main() {
        // Directional radar scan-wave sweeps forward along -Z (vXZ.y > uScanZ is revealed!)
        float revealed = smoothstep(uScanZ - 1.2, uScanZ + 2.2, vXZ.y);
        if (revealed < 0.01) discard;
        float scanLine = exp(-pow((vXZ.y - uScanZ) * 0.9, 2.0)) * smoothstep(-26.0, -18.0, uScanZ);

        float wellGlow = clamp(vDepth * 0.18, 0.0, 1.0);
        // Subtle, moody low-key flowing shimmer ("暗光流动") gliding along the dense spacetime gravity lines!
        float wave1 = 0.5 + 0.5 * sin(vXZ.x * 0.52 - uTime * 3.2 + vXZ.y * 0.38);
        float wave2 = 0.5 + 0.5 * sin(length(vXZ - vec2(-0.4, -9.8)) * 0.85 - uTime * 4.4);
        float darkFlow = pow(wave1, 3.2) * 0.5 + pow(wave2, 3.0) * 0.6;

        vec3 dimSlateBlue = vec3(0.18, 0.44, 0.68);
        vec3 deepAmber    = vec3(0.86, 0.64, 0.30);
        vec3 col = mix(dimSlateBlue, deepAmber, clamp(wellGlow * 0.85 + darkFlow * 0.25, 0.0, 1.0));
        col *= (0.48 + wellGlow * 0.68 + darkFlow * 0.72);
        col += vec3(0.55, 0.92, 1.0) * scanLine * 1.45;
        float alpha = ((0.055 + wellGlow * 0.22 + darkFlow * 0.20) * revealed + scanLine * 0.55) * vRadialFade * uOpacity;
        if (alpha < 0.015) discard;
        gColor = vec4(col, alpha);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
  const spacetimeGrid = new THREE.LineSegments(gravLineGeo, gravLineMat);
  spacetimeGrid.position.set(0, -1.2, -3.5);
  veinsGroup.add(spacetimeGrid);

  // Precompute steady, deeply-curved static spacetime geometry for the 38x38 gravity lines (ZERO jitter/bouncing!)
  {
    const pAttr = gravLineGeo.attributes.position;
    const dAttr = gravLineGeo.attributes.aDepth;
    for (let i = 0; i < pAttr.count; i++) {
      const x = gravBaseXZ[i * 3];
      const z = gravBaseXZ[i * 3 + 2];
      let dip = 0;
      for (let k = 0; k < wells.length; k++) {
        const w = wells[k];
        const d2 = (x - w.x) * (x - w.x) + (z - w.z) * (z - w.z);
        dip -= w.mass / (1.0 + d2 * 0.24);
      }
      pAttr.setY(i, dip);
      dAttr.setX(i, Math.max(0, -dip));
    }
    pAttr.needsUpdate = true;
    dAttr.needsUpdate = true;
  }

  // 2. 3 Clean Celestial Bodies perched cleanly above their 3 deep spacetime gravity funnels (removed redundant clutter rings & spiral!)
  const wellMeshes = wells.map((w, idx) => {
    const g = new THREE.Group();
    g.position.set(w.x, -0.4 - idx * 0.25, w.z - 3.5);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(w.r, 24, 18), idx === 0 ? nodeCyan : nodeGold);
    g.add(orb);
    veinsGroup.add(g);
    return { g, orb };
  });

  // 3. Neural Network Synaptic Nodes + Candidate Deduction Branches -> 1 Locked Golden Geodesic
  const neuralNodes = [];
  const nodeCoords = [
    new THREE.Vector3(-4.2, 0.8,  5.5),
    new THREE.Vector3( 0.2, 0.5,  3.2),
    new THREE.Vector3( 3.8, 0.9,  1.2),
    new THREE.Vector3(-2.6, 0.4, -2.5),
    new THREE.Vector3( 2.8, 0.3, -5.2),
    new THREE.Vector3(-0.4, 0.2, -9.8 - 3.5)
  ];
  nodeCoords.forEach((p, idx) => {
    const nd = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), idx % 2 === 0 ? nodeCyan : nodeGold);
    nd.position.copy(p);
    veinsGroup.add(nd);
    neuralNodes.push(nd);
  });

  const branchConfigs = [
    [new THREE.Vector3(-1.5, 0.4, 9.5), new THREE.Vector3(-3.8, 0.65, 5.8), new THREE.Vector3(-5.6, 0.4, 1.5), new THREE.Vector3(-8.2, 0.2, -5.5)],
    [new THREE.Vector3(-1.5, 0.4, 9.5), new THREE.Vector3( 1.8, 0.6, 5.5), new THREE.Vector3( 4.6, 0.35, 0.8), new THREE.Vector3( 8.6, 0.2, -5.2)],
    [new THREE.Vector3( 0.2, 0.5, 3.2), new THREE.Vector3(-2.6, 0.4, -1.2), new THREE.Vector3(-4.8, 0.25, -5.8), new THREE.Vector3(-7.4, 0.1, -12.0)],
    [new THREE.Vector3( 0.2, 0.5, 3.2), new THREE.Vector3( 2.8, 0.35, -1.8), new THREE.Vector3( 5.2, 0.2, -6.8), new THREE.Vector3( 6.8, 0.15, -13.2)]
  ];
  const candidateBranches = branchConfigs.map((pts) => {
    const arc = buildTrajectoryArc(pts, 0.014, 0x62e2ff);
    veinsGroup.add(arc);
    return arc;
  });

  const optimalPts = [
    new THREE.Vector3(-1.8,  0.35, 10.2),
    new THREE.Vector3(-2.4,  0.15,  4.2),
    new THREE.Vector3( 0.8, -0.05, -1.8),
    new THREE.Vector3( 2.0, -0.15, -7.2),
    new THREE.Vector3(-0.4, -0.25, -13.3),
    new THREE.Vector3(-1.2,  0.40, -21.0)
  ];
  const optimalArc = buildTrajectoryArc(optimalPts, 0.044, 0xffe082);
  veinsGroup.add(optimalArc);
  const optimalCurve = new THREE.CatmullRomCurve3(optimalPts);

  const photons = [];
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), i % 3 === 0 ? nodeCyan : nodeGold);
    veinsGroup.add(m);
    photons.push({ mesh: m, offset: i / 18, speed: 0.68 + (i % 3) * 0.18 });
  }

  return {
    scene,
    update(submode, u, time, camera, audio) {
      const bass = audio ? audio.bass : 0;
      const mid = audio ? audio.mid : 0;

      if (submode === "explore_future") {
        // === S08A -> S08B TRUE CINEMA ONE-TAKE ===
        // 1) Monotonic forward camera glide (ZERO backwards rubber-band reversal!)
        // 2) Directional GLSL3 scan-wave sweeps forward from StarArk, literally painting the 112x112 Spacetime Grid into existence!
        // 3) StarArk glides right onto the start of S08B's golden geodesic!
        futureGroup.visible = true;
        veinsGroup.visible = u > 0.18;

        const scanSweep = smoothstep(0.18, 1.0, u);
        const scanZ = THREE.MathUtils.lerp(15.0, -25.0, scanSweep);

        ark.visible = true;
        ark.scale.setScalar(0.82);
        ark.position.set(
          THREE.MathUtils.lerp(0.0, -1.8, smoothstep(0.35, 1.0, u)),
          0.35 + Math.sin(time * 1.8) * 0.08,
          THREE.MathUtils.lerp(11.8, 10.2, u)
        );
        ark.rotation.set(0.02, Math.PI / 2, -0.08 * (1.0 - u));
        ark.userData.habRing.rotation.x = time * 1.3;
        ark.userData.plumes.forEach((p) => { p.scale.set(0.85, 1.0 + bass * 0.4, 0.85); });

        flightStreaks.forEach((s) => {
          const z = (((s.z0 + time * s.sp + 38) % 44) + 44) % 44 - 38;
          s.mesh.position.set(s.x, s.y, z);
          s.mesh.visible = scanSweep < 0.85;
        });

        scanCone.visible = scanSweep < 0.92;
        scanCone.position.set(ark.position.x, ark.position.y, ark.position.z - 12.2);
        scanRings.forEach((sr) => {
          sr.mesh.visible = scanSweep < 0.95;
          const p = (time * 0.75 + sr.phase) % 1.0;
          sr.mesh.position.set(ark.position.x, ark.position.y, ark.position.z - 1.5 - p * 22.0);
          sr.mesh.scale.setScalar(0.6 + p * 3.8);
          sr.mesh.material.uniforms.uOpacity.value = (1.0 - p) * 0.82 * (1.0 - scanSweep * 0.65);
        });

        beacons.forEach((b, i) => {
          b.grp.visible = scanSweep < 0.88;
          b.ring.rotation.z = time * (0.9 + i * 0.2);
          b.grp.scale.setScalar((0.7 + mid * 0.2) * (1.0 - scanSweep * 0.7));
        });

        // Spacetime grid & 3 wells materialize strictly behind the advancing scanZ radar front!
        if (veinsGroup.visible) {
          gravLineMat.uniforms.uTime.value = time;
          gravLineMat.uniforms.uOpacity.value = 1.0;
          gravLineMat.uniforms.uScanZ.value = scanZ;
          wellMeshes.forEach((wm, idx) => {
            const wZ = wells[idx].z;
            const wVis = smoothstep(wZ - 2.5, wZ + 2.5, -scanZ * -1.0); // wait: reveal when scanZ passes wZ!
            const wShow = smoothstep(wZ + 2.5, wZ - 2.0, scanZ);
            wm.orb.visible = wShow > 0.02;
            wm.orb.scale.setScalar(Math.max(0.01, wShow * 0.96));
          });
          candidateBranches.forEach((br) => { br.visible = false; });
          neuralNodes.forEach((nd) => { nd.visible = false; });
          optimalArc.userData.setProgress(0.0);
          photons.forEach((ph) => { ph.mesh.visible = false; });
        }

        // Smooth MONOTONIC FORWARD & UPWARD glide -> ends at (-3.2, 5.2, 10.5, lookAt (0.2, -1.0, -8.5), fov=44)!
        camera.fov = THREE.MathUtils.lerp(39.0, 44.0, u);
        camera.position.set(
          THREE.MathUtils.lerp(-4.2, -3.2, u),
          THREE.MathUtils.lerp(2.4, 5.2, smoothstep(0.0, 1.0, u)),
          THREE.MathUtils.lerp(16.2, 10.5, u)
        );
        camera.lookAt(
          THREE.MathUtils.lerp(0.0, 0.2, u),
          THREE.MathUtils.lerp(0.2, -1.0, smoothstep(0.2, 1.0, u)),
          THREE.MathUtils.lerp(-6.0, -8.5, u)
        );
      } else {
        // === S08B: 推演宇宙命脉 — 100% CONTINUOUS FORWARD ONE-TAKE FROM S08A! ===
        // StarArk (at real scale!) surfs directly along the newly deduced golden geodesic through the 3 gravity wells!
        futureGroup.visible = true;
        flightStreaks.forEach((s) => { s.mesh.visible = false; });
        scanCone.visible = false;
        scanRings.forEach((sr) => { sr.mesh.visible = false; });
        beacons.forEach((b) => { b.grp.visible = false; });

        const shipT = smoothstep(0.0, 0.96, u);
        const shipPt = optimalCurve.getPoint(shipT);
        const shipNext = optimalCurve.getPoint(Math.min(1.0, shipT + 0.02));
        ark.visible = true;
        ark.scale.setScalar(0.82);
        ark.position.copy(shipPt);
        ark.lookAt(shipNext);
        ark.rotateY(-Math.PI / 2); // Align StarArk +X nose along tangent!
        ark.userData.habRing.rotation.x = time * 1.3;
        ark.userData.plumes.forEach((p) => { p.scale.set(0.85, 1.05 + bass * 0.45, 0.85); });

        veinsGroup.visible = true;
        gravLineMat.uniforms.uTime.value = time;
        gravLineMat.uniforms.uOpacity.value = 1.0;
        gravLineMat.uniforms.uScanZ.value = -40.0; // Fully revealed!

        wellMeshes.forEach((wm) => {
          wm.orb.visible = true;
          wm.orb.scale.setScalar(0.96 + bass * 0.22);
        });

        const pruneFade = 1.0 - smoothstep(0.42, 0.85, u);
        candidateBranches.forEach((br, idx) => {
          br.userData.setProgress(smoothstep(idx * 0.05, 0.45 + idx * 0.05, u));
          br.visible = pruneFade > 0.03;
        });

        neuralNodes.forEach((nd, i) => {
          nd.visible = true;
          nd.rotation.y = time * 1.8 + i;
          nd.scale.setScalar(0.85 + mid * 0.65);
        });

        optimalArc.userData.setProgress(smoothstep(0.02, 0.88, u));
        photons.forEach((ph) => {
          ph.mesh.visible = true;
          const t = (time * ph.speed + ph.offset) % 1.0;
          ph.mesh.position.copy(optimalCurve.getPoint(t));
          ph.mesh.scale.setScalar(0.8 + bass * 0.6);
        });

        // Continues the EXACT SAME forward glide from (-3.2, 5.2, 10.5, fov=44) -> (+0.8, 2.2, -3.5, fov=54)!
        camera.fov = 44.0 + u * 10.0;
        camera.position.set(
          THREE.MathUtils.lerp(-3.2, 0.8, u),
          THREE.MathUtils.lerp(5.2, 2.2, u),
          THREE.MathUtils.lerp(10.5, -3.5, u)
        );
        camera.lookAt(0.2 - u * 0.6, -1.0 + u * 0.5, -8.5 - u * 8.0);
      }

      camera.updateProjectionMatrix();
      return { sunDir: new THREE.Vector3(0.5, 0.6, 0.6), clearColor: 0x050716, shadowBounds: null };
    }
  };
}
