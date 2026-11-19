import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { clamp, smoothstep } from "../core/math.js";
import { buildStarfield, buildCelEarth } from "./cosmicPrimitives.js";
import { createMultiTrackStarRing } from "./planetaryRing.js";

// S07: 星图展开 · 迷雾全散开 — Clean, Spacious Multi-Orbit Star-Ring Orrery (多轨星环星图)
// Elevated 3/4 cosmic view looking across 6 concentric planetary orbits (ZERO planet overlap, ZERO tangled X-lines!)
// Unlit planets & orbits start dormant grey -> light up ONE BY ONE from inner orbit to outer orbit via crisp zig-zag jumps -> mist clears & starry sky awakens!
export function buildStarchartScene() {
  const scene = new THREE.Scene();

  const baseStars = buildStarfield(1600, 440, 202604);
  scene.add(baseStars);
  const brightStars = buildStarfield(2400, 380, 202699);
  brightStars.visible = false;
  scene.add(brightStars);

  // Grand tilted Multi-Orbit Star-Ring Plane (tilted cleanly toward the elevated camera so every orbit is wide open!)
  const orrery = new THREE.Group();
  orrery.rotation.set(0.18, 0.0, -0.06);
  scene.add(orrery);

  // Central Golden Star (Sun) at the heart of the multi-orbit star-ring
  const sunCore = new THREE.Mesh(
    new THREE.SphereGeometry(1.45, 32, 24),
    createCelMaterial({ color: 0xfff2c2, emissive: 0xffb330, emissiveStrength: 2.3, unlit: true, noInk: true })
  );
  orrery.add(sunCore);

  const sunCorona = new THREE.Mesh(
    new THREE.TorusGeometry(2.05, 0.035, 8, 72),
    createCelMaterial({ color: 0xffe082, emissive: 0xffae19, emissiveStrength: 1.6, unlit: true, noInk: true, transparent: true, opacity: 0.72 })
  );
  sunCorona.rotation.x = Math.PI / 2;
  orrery.add(sunCorona);

  // 5 Concentric Planetary Orbits (DARK before their turn, lighting up RING BY RING outward!)
  // + 6th Final Target: a LONG interstellar probe beam shooting FAR OUT into deep space to ignite ONE tiny distant pinpoint star!
  const dormantGrey = new THREE.Color(0x282d3a);
  const dormantShadow = new THREE.Color(0x11141d);
  const dimTrackCol = new THREE.Color(0x161b29);

  const orbitSpecs = [
    { orbitR:  3.8, angle: -2.45, r: 0.78, tIgnite: 0.05, type: "earth",  litCol: 0x52a8e8, litShad: 0x1a3860, trackCol: 0x62d9ff },
    { orbitR:  6.2, angle: -1.98, r: 0.66, tIgnite: 0.17, type: "mars",   litCol: 0xe07043, litShad: 0x5c221c, trackCol: 0xff9b54 },
    { orbitR:  8.8, angle: -1.52, r: 1.05, tIgnite: 0.29, type: "saturn", litCol: 0xebc678, litShad: 0x634426, trackCol: 0xffd578 },
    { orbitR: 11.6, angle: -1.06, r: 0.88, tIgnite: 0.42, type: "ice",    litCol: 0x5cd8f5, litShad: 0x1b4670, trackCol: 0x7ce6ff },
    { orbitR: 14.5, angle: -0.62, r: 0.82, tIgnite: 0.55, type: "amber",  litCol: 0xf09c48, litShad: 0x5e2c1c, trackCol: 0xffbe5c }
  ];

  const orbits = orbitSpecs.map((spec, idx) => {
    const trackMat = createCelMaterial({
      color: dimTrackCol.clone(),
      emissive: spec.trackCol,
      emissiveStrength: 0.0,
      unlit: true,
      noInk: true,
      transparent: true,
      opacity: 0.08
    });
    const trackMesh = new THREE.Mesh(new THREE.TorusGeometry(spec.orbitR, idx % 2 === 0 ? 0.044 : 0.034, 8, 120), trackMat);
    trackMesh.rotation.x = Math.PI / 2;
    orrery.add(trackMesh);

    const echoMat = createCelMaterial({
      color: spec.trackCol,
      emissive: spec.trackCol,
      emissiveStrength: 1.2,
      unlit: true,
      noInk: true,
      transparent: true,
      opacity: 0.0
    });
    const echoMesh = new THREE.Mesh(new THREE.TorusGeometry(spec.orbitR + 0.24, 0.015, 6, 120), echoMat);
    echoMesh.rotation.x = Math.PI / 2;
    orrery.add(echoMesh);

    const pGrp = new THREE.Group();
    const px = Math.cos(spec.angle) * spec.orbitR;
    const pz = Math.sin(spec.angle) * spec.orbitR;
    pGrp.position.set(px, 0, pz);

    let bodyMat = null;
    let bodyObj = null;
    let satRing = null;

    if (spec.type === "earth") {
      bodyObj = buildCelEarth(spec.r, { glowColor: 0x62d9ff, atmoIntensity: 1.15 });
      pGrp.add(bodyObj);
    } else {
      bodyMat = createCelMaterial({
        color: dormantGrey.clone(),
        shadowColor: dormantShadow.clone(),
        patternMode: spec.type === "saturn" || spec.type === "ice" ? 4 : 3,
        patternScale: new THREE.Vector2(6, 10),
        emissive: spec.trackCol,
        emissiveStrength: 0.0,
        rimStrength: 0.05,
        rimColor: spec.trackCol
      });
      bodyObj = new THREE.Mesh(new THREE.SphereGeometry(spec.r, 32, 24), bodyMat);
      pGrp.add(bodyObj);

      if (spec.type === "saturn") {
        satRing = createMultiTrackStarRing(spec.r, {
          innerScale: 1.32,
          outerScale: 2.35,
          tint: 0xf5d693,
          accent: 0x7ce6ff,
          startColor: dormantGrey.getHex(),
          emissiveStrength: 0.0,
          shardCount: 32,
          seed: 7702
        });
        satRing.group.rotation.set(Math.PI * 0.44, 0.22, 0.14);
        pGrp.add(satRing.group);
      }
    }

    const pulseMat = createCelMaterial({
      color: spec.trackCol,
      emissive: spec.trackCol,
      emissiveStrength: 2.4,
      unlit: true,
      noInk: true,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const pulseRing = new THREE.Mesh(new THREE.RingGeometry(spec.r * 1.15, spec.r * 1.42, 48), pulseMat);
    pulseRing.rotation.x = Math.PI / 2;
    pGrp.add(pulseRing);

    orrery.add(pGrp);
    return {
      spec,
      pGrp,
      basePos: new THREE.Vector3(px, 0, pz),
      trackMat,
      echoMat,
      bodyObj,
      bodyMat,
      satRing,
      litCol: new THREE.Color(spec.litCol),
      litShad: new THREE.Color(spec.litShad),
      trackLitCol: new THREE.Color(spec.trackCol),
      pulseRing,
      pulseMat
    };
  });

  // === CHAIN OF DEEP-SPACE PINPOINT STARS CONTINUING ENDLESSLY UNTIL SHOT CUT ("到了一个不要停，继续往后，直到画面切换"!) ===
  const farStarPos1 = new THREE.Vector3(24.5, 2.0, -5.2);
  const farStarPos2 = new THREE.Vector3(38.5, 4.2, -9.8);
  const farBeyondPos = new THREE.Vector3(68.0, 8.8, -19.5); // Infinite frontier ray extending until u = 1.0!

  function makePinpointStar(pos, tIgnite) {
    const grp = new THREE.Group();
    grp.position.copy(pos);
    const coreMat = createCelMaterial({
      color: 0xfff8dc,
      emissive: 0xffe082,
      emissiveStrength: 0.0,
      unlit: true,
      noInk: true,
      transparent: true,
      opacity: 0.0
    });
    grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), coreMat));

    const fMat = createCelMaterial({
      color: 0xfff5cc,
      emissive: 0xffd575,
      emissiveStrength: 2.8,
      unlit: true,
      noInk: true,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const fH = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.045, 3.6, 6), fMat);
    fH.rotation.z = Math.PI / 2;
    const fV = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.045, 3.6, 6), fMat);
    const fD = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.035, 2.2, 6), fMat);
    fD.rotation.x = Math.PI / 2;
    grp.add(fH, fV, fD);

    const pMat = createCelMaterial({
      color: 0xffe699,
      emissive: 0xffc845,
      emissiveStrength: 2.6,
      unlit: true,
      noInk: true,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const pulse = new THREE.Mesh(new THREE.RingGeometry(0.58, 0.65, 48), pMat);
    grp.add(pulse);
    orrery.add(grp);
    return { grp, coreMat, fMat, fH, fV, fD, pulse, pMat, tIgnite };
  }

  const farStars = [
    makePinpointStar(farStarPos1, 0.72),
    makePinpointStar(farStarPos2, 0.86)
  ];

  // Clean Monotonic Outward Jump Segments: Orbit 0->1->2->3->4 -> Far Star 1 -> Far Star 2 -> Endless Frontier Ray (never stops until u = 1.0!)
  const upAxis = new THREE.Vector3(0, 1, 0);
  const nodePositions = [...orbits.map((o) => o.basePos), farStarPos1, farStarPos2, farBeyondPos];
  const nodeTimes = [0.05, 0.17, 0.29, 0.42, 0.55, 0.72, 0.86, 1.02];
  const jumpSegments = [];
  for (let i = 0; i < nodePositions.length - 1; i++) {
    const pA = nodePositions[i];
    const pB = nodePositions[i + 1];
    const dir = pB.clone().sub(pA);
    const fullLen = dir.length();
    const isInterstellar = i >= 4;
    const mat = createCelMaterial({
      color: isInterstellar ? 0xfff0b3 : 0xffe082,
      emissive: isInterstellar ? 0xffc845 : 0xffb330,
      emissiveStrength: isInterstellar ? 2.4 : 1.9,
      unlit: true,
      noInk: true,
      transparent: true,
      opacity: 0.9
    });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(isInterstellar ? 0.028 : 0.034, isInterstellar ? 0.028 : 0.034, 1.0, 8), mat);
    mesh.quaternion.setFromUnitVectors(upAxis, dir.clone().normalize());
    orrery.add(mesh);
    jumpSegments.push({
      mesh,
      pA,
      dirNorm: dir.clone().normalize(),
      fullLen,
      t0: nodeTimes[i],
      t1: nodeTimes[i + 1]
    });
  }

  // Soft Feathered Cosmic Mist Clouds parting left/right ("迷雾全散开")
  function makeSoftCloudTex(r, g, b) {
    const cv = document.createElement("canvas");
    cv.width = 256;
    cv.height = 256;
    const ctx = cv.getContext("2d");
    const gr = ctx.createRadialGradient(128, 128, 10, 128, 128, 124);
    gr.addColorStop(0.0, `rgba(${r},${g},${b},0.85)`);
    gr.addColorStop(0.45, `rgba(${r},${g},${b},0.35)`);
    gr.addColorStop(0.78, `rgba(${r},${g},${b},0.06)`);
    gr.addColorStop(1.0, `rgba(${r},${g},${b},0.0)`);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.NoColorSpace;
    return tex;
  }
  const mistTex = makeSoftCloudTex(76, 98, 148);
  const mistClouds = [-1, 1].map((side) => {
    const mat = createCelMaterial({ color: 0xffffff, map: mistTex, unlit: true, noInk: true, transparent: true, opacity: 0.42, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(34, 22), mat);
    mesh.position.set(side * 6.5, 4.5, 5.5);
    scene.add(mesh);
    return { mesh, mat, side, baseX: side * 6.5 };
  });

  // Soft Awakening Nebular Glow ("星空开始有light了")
  const skyGlowTex = makeSoftCloudTex(140, 210, 255);
  const skyGlowMat = createCelMaterial({
    color: 0xffffff,
    map: skyGlowTex,
    emissive: 0xffe082,
    emissiveStrength: 0.55,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const skyGlow = new THREE.Mesh(new THREE.PlaneGeometry(86, 44), skyGlowMat);
  skyGlow.position.set(0, 2, -42);
  scene.add(skyGlow);

  const tmpCol = new THREE.Color();

  return {
    scene,
    update(submode, u, time, camera, audio) {
      const mid = audio ? audio.mid : 0;

      // Gentle majestic celestial orrery rotation
      orrery.rotation.y = -0.18 + u * 0.42;
      sunCore.scale.setScalar(1.0 + mid * 0.14);
      sunCorona.rotation.z = time * 0.45;

      // 1. Light up each concentric orbital track & planet ONE BY ONE from inner orbit to outer orbit!
      orbits.forEach((o, idx) => {
        const lit = smoothstep(o.spec.tIgnite - 0.02, o.spec.tIgnite + 0.1, u);

        // Orbit star-ring track stays DARK (opacity 0.08, zero glow) until its turn, then lights up RING BY RING!
        tmpCol.copy(dimTrackCol).lerp(o.trackLitCol, lit);
        o.trackMat.uniforms.uColor.value.copy(tmpCol);
        o.trackMat.uniforms.uEmissiveStrength.value = lit * (1.6 + mid * 0.4);
        o.trackMat.uniforms.uOpacity.value = 0.08 + lit * 0.85;
        o.echoMat.uniforms.uOpacity.value = lit * 0.45;

        // Planet blooms from dormant cold grey -> vibrant full color!
        if (o.spec.type === "earth") {
          o.bodyObj.userData.globe.rotation.y = 1.6 + time * 0.08;
        } else {
          o.bodyObj.rotation.y = time * (0.22 + idx * 0.04);
          tmpCol.copy(dormantGrey).lerp(o.litCol, lit);
          o.bodyMat.uniforms.uColor.value.copy(tmpCol);
          tmpCol.copy(dormantShadow).lerp(o.litShad, lit);
          o.bodyMat.uniforms.uShadowColor.value.copy(tmpCol);
          o.bodyMat.uniforms.uRimStrength.value = 0.14 + lit * 0.52;
          o.bodyMat.uniforms.uEmissiveStrength.value = o.spec.type === "star" ? lit * (2.4 + mid * 0.6) : lit * 0.28;

          if (o.satRing) {
            tmpCol.copy(dormantGrey).lerp(new THREE.Color(0xffffff), lit);
            o.satRing.ringMat.uniforms.uColor.value.copy(tmpCol);
            o.satRing.ringMat.uniforms.uEmissiveStrength.value = lit * 0.32;
            o.satRing.shardMat.uniforms.uColor.value.copy(tmpCol);
            o.satRing.update(time, lit);
          }
        }

        // Expanding orbital ignition ripple
        const pulseT = clamp((u - o.spec.tIgnite) / 0.18, 0, 1);
        o.pulseRing.scale.setScalar(0.9 + pulseT * 2.6);
        o.pulseMat.uniforms.uOpacity.value = pulseT > 0 && pulseT < 1 ? (1.0 - pulseT) * 0.92 : 0.0;
      });

      // 2. Clean sequential golden jump segments connecting each newly lit orbit!
      jumpSegments.forEach((js) => {
        const p = clamp((u - js.t0) / Math.max(0.001, js.t1 - js.t0), 0, 1);
        js.mesh.visible = p > 0.005;
        if (js.mesh.visible) {
          const curLen = js.fullLen * p;
          js.mesh.scale.set(1, curLen, 1);
          js.mesh.position.copy(js.pA).addScaledVector(js.dirNorm, curLen * 0.5);
        }
      });

      // 2B. Ignite each distant pinpoint star sequentially while the beam keeps pushing endlessly onward!
      farStars.forEach((fs, idx) => {
        const farLit = smoothstep(fs.tIgnite - 0.02, fs.tIgnite + 0.08, u);
        fs.coreMat.uniforms.uOpacity.value = farLit;
        fs.coreMat.uniforms.uEmissiveStrength.value = farLit * (3.2 + mid * 1.0);
        fs.fMat.uniforms.uOpacity.value = farLit * (0.9 + 0.1 * Math.sin(time * 9.0 + idx));
        const fScale = farLit * (0.85 + 0.25 * Math.sin(time * 6.0 + idx) + mid * 0.35);
        fs.fH.scale.set(1, fScale, 1);
        fs.fV.scale.set(1, fScale, 1);
        fs.fD.scale.set(1, fScale, 1);

        const farPulseT = clamp((u - fs.tIgnite) / 0.16, 0, 1);
        fs.pulse.lookAt(camera.position);
        fs.pulse.scale.setScalar(0.6 + farPulseT * 5.2);
        fs.pMat.uniforms.uOpacity.value = farPulseT > 0 && farPulseT < 1 ? (1.0 - farPulseT) * 0.95 : 0.0;
      });

      // 3. Soft mist clouds part left/right and dissolve away ("迷雾全散开")
      const mistClear = smoothstep(0.08, 0.65, u);
      mistClouds.forEach((mc) => {
        mc.mesh.position.x = mc.baseX + mc.side * mistClear * 18.0;
        mc.mat.uniforms.uOpacity.value = Math.max(0, 0.42 * (1.0 - mistClear));
      });

      // 4. Entire starry sky awakens with radiant light once the multi-orbit star-ring & distant stars ignite!
      const skyAwaken = smoothstep(0.52, 0.96, u);
      brightStars.visible = skyAwaken > 0.05;
      brightStars.rotation.y = time * 0.015;
      skyGlowMat.uniforms.uOpacity.value = skyAwaken * (0.24 + mid * 0.08);

      // Camera NEVER stops — continuously sweeps outward following the infinite deep-space beam until the shot cuts!
      const farPan = smoothstep(0.55, 1.0, u);
      camera.fov = 42 + farPan * 8.0;
      camera.position.set(
        -2.5 + u * 10.5 + farPan * 14.0,
        12.5 + u * 5.5 + farPan * 2.5,
        18.5 + u * 14.5
      );
      camera.lookAt(
        farPan * 22.0,
        -0.4 + farPan * 4.2,
        -farPan * 7.5
      );
      camera.updateProjectionMatrix();

      const bgR = Math.round(5 + skyAwaken * 9);
      const bgG = Math.round(7 + skyAwaken * 15);
      const bgB = Math.round(18 + skyAwaken * 30);
      return { sunDir: new THREE.Vector3(0.55, 0.72, 0.42), clearColor: (bgR << 16) | (bgG << 8) | bgB, shadowBounds: null };
    }
  };
}
