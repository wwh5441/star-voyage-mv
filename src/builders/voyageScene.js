import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { mulberry32, clamp } from "../core/math.js";
import { buildStarfield, createJupiterTexture, buildTrajectoryArc, buildStarArkShip } from "./cosmicPrimitives.js";
import { createMultiTrackStarRing } from "./planetaryRing.js";
import { buildSlingshotTransferRig } from "./slingshotTransfer.js";

// Acts 05, 06, 10, 14: Deep-Space Voyage (Boundary Break / Gas Giant Skim / Accelerator Rings / Warp Gate)
export function buildVoyageScene() {
  const scene = new THREE.Scene();
  scene.add(buildStarfield(2800, 480, 202605));

  const ark = buildStarArkShip();
  ark.scale.setScalar(0.52);
  scene.add(ark);

  // S11 ("gasgiant"): Colossal Multi-Track Star Ring Hero + Towering Gas Giant Backdrop
  const giantGroup = new THREE.Group();
  giantGroup.position.set(14.0, -5.5, -42.0);
  scene.add(giantGroup);

  const giantPlanet = new THREE.Mesh(
    new THREE.SphereGeometry(18.5, 64, 48),
    createCelMaterial({
      color: 0xf4ece2,
      shadowColor: 0x241e3d,
      map: createJupiterTexture(),
      colorEdges: true,
      rimStrength: 0.62,
      rimColor: 0x9ed8ff,
      receiveShadow: false
    })
  );
  giantGroup.add(giantPlanet);

  const giantRingSystem = createMultiTrackStarRing(18.5, {
    innerScale: 1.26,
    outerScale: 2.85,
    tint: 0xf0d8aa,
    accent: 0xaadfff,
    emissive: 0xc99c58,
    emissiveStrength: 0.16,
    opacity: 0.92,
    shardCount: 42,
    speedScale: 0.14,
    seed: 1109
  });
  // Hide the bright cyan schematic torus threads so S11's planetary ring reads as pure natural cosmic ice & dust
  giantRingSystem.group.children.forEach((ch) => {
    if (ch.material === giantRingSystem.threadMat) ch.visible = false;
    if (ch.material === giantRingSystem.shardMat) {
      ch.scale.set(0.42, 0.24, 0.36);
    }
  });
  const giantRingEuler = new THREE.Euler(Math.PI * 0.46, 0.16, -0.20);
  giantRingSystem.group.rotation.copy(giantRingEuler);
  giantGroup.add(giantRingSystem.group);

  // Delicate close-range ice-ring fragments & sparkling dust streaming beneath the skimming ship
  const ringBoulderRand = mulberry32(11092);
  const ringBoulderMat = createCelMaterial({
    color: 0xf2e6d0,
    shadowColor: 0x3b334f,
    emissive: 0x8ad8ff,
    emissiveStrength: 0.18,
    rimStrength: 0.45,
    rimColor: 0xc2f0ff,
    noInk: true
  });
  const ringBoulders = [];
  for (let i = 0; i < 90; i++) {
    const r = 27.5 + ringBoulderRand() * 18.5;
    const ang = 1.42 + ringBoulderRand() * 1.08;
    const sz = 0.035 + Math.pow(ringBoulderRand(), 2.6) * 0.18;
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(sz, 0), ringBoulderMat);
    // Natural jagged ice-shard proportions instead of regular geometric dice
    mesh.scale.set(
      0.8 + ringBoulderRand() * 1.4,
      0.35 + ringBoulderRand() * 0.55,
      0.7 + ringBoulderRand() * 1.1
    );
    const zOff = -0.35 - ringBoulderRand() * 1.15; // Stay cleanly below Ark's flight altitude
    mesh.rotation.set(ringBoulderRand() * 6, ringBoulderRand() * 6, ringBoulderRand() * 6);
    giantRingSystem.group.add(mesh);
    ringBoulders.push({
      mesh,
      r,
      ang,
      zOff,
      speed: 0.022 + ringBoulderRand() * 0.026,
      spinX: (ringBoulderRand() - 0.5) * 0.55,
      spinY: (ringBoulderRand() - 0.5) * 0.75
    });
  }
  const giantRingQuat = new THREE.Quaternion().setFromEuler(giantRingEuler);
  const giantRingNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(giantRingQuat).normalize();
  const ringPointWorld = (r, theta, h) =>
    new THREE.Vector3(Math.cos(theta) * r, Math.sin(theta) * r, h)
      .applyQuaternion(giantRingQuat)
      .add(giantGroup.position);
  const arkBasisMat = new THREE.Matrix4();
  const arkFwd = new THREE.Vector3();
  const arkUp = new THREE.Vector3();
  const arkSide = new THREE.Vector3();

  // Modular S11B ("slingshot_transfer") Rig: Curved Periapsis Slingshot Track + Escape Shockwave + New Rocky Star System
  const slingshotRig = buildSlingshotTransferRig(ringPointWorld);
  slingshotRig.group.visible = false;
  scene.add(slingshotRig.group);

  // Corridor of 18 Glowing Golden Orbital Accelerator / Warp-Gate Rings (Acts 05, 10, 14)
  const gateGroup = new THREE.Group();
  scene.add(gateGroup);
  const gates = [];
  const gateRingMat = createCelMaterial({
    color: 0xdce2f0,
    shadowColor: 0x525685,
    rimStrength: 0.45
  });
  const gateCoreMat = createCelMaterial({
    color: 0xffd275,
    emissive: 0xffba42,
    emissiveStrength: 2.0,
    unlit: true,
    noInk: true
  });
  const gateCyanMat = createCelMaterial({
    color: 0x8ef2ff,
    emissive: 0x48d2ff,
    emissiveStrength: 2.2,
    unlit: true,
    noInk: true
  });

  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.14, 10, 36), gateRingMat);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.055, 8, 36), i % 2 === 0 ? gateCoreMat : gateCyanMat);
    g.add(outer, inner);
    // 4 Radial Gate Pylons
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.85, 0.28), gateRingMat);
      pylon.position.set(Math.cos(a) * 3.65, Math.sin(a) * 3.65, 0);
      pylon.rotation.z = a - Math.PI / 2;
      g.add(pylon);
    }
    g.position.z = -i * 9.5;
    gateGroup.add(g);
    gates.push(g);
  }

  // Streaking Cel Warp Light Lines (for Act 14 "warpgate" relativistic speed!)
  const streakGroup = new THREE.Group();
  scene.add(streakGroup);
  const rand = mulberry32(202614);
  const streakMat = createCelMaterial({
    color: 0xfff0c4,
    emissive: 0xffcf6e,
    emissiveStrength: 2.4,
    unlit: true,
    noInk: true
  });
  const streaks = [];
  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2;
    const r = 2.4 + rand() * 8.5;
    const baseZ = -rand() * 85;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 4.5 + rand() * 5.0, 5), streakMat);
    s.rotation.x = Math.PI / 2;
    s.position.set(Math.cos(a) * r, Math.sin(a) * r, baseZ);
    streakGroup.add(s);
    streaks.push({ mesh: s, baseZ, speed: 34 + rand() * 28 });
  }

  // Sweeping Golden Gas-Giant Slingshot Arc
  const slingArc = buildTrajectoryArc([
    new THREE.Vector3(-12, 2.2, -4),
    new THREE.Vector3(-3.5, 0.4, -7),
    new THREE.Vector3(3.5, -3.5, -9),
    new THREE.Vector3(14.5, -5.2, -13)
  ], 0.048, 0xffd275);
  scene.add(slingArc);

  // Pure White Light Aura wrapping the Ark's ring ("意识之光" -> expands to illuminate the night when tunnel rings fade away!)
  const shipAuraMat = createCelMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveStrength: 3.0,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const shipAuraRing = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.14, 12, 48), shipAuraMat);
  shipAuraRing.rotation.y = Math.PI / 2;
  ark.add(shipAuraRing);

  // Soft Feathered White Light Dome radiating outward to illuminate the entire dark night ("全是白光点亮黑夜")
  const glowCv = document.createElement("canvas");
  glowCv.width = 256;
  glowCv.height = 256;
  const gctx = glowCv.getContext("2d");
  const ggr = gctx.createRadialGradient(128, 128, 4, 128, 128, 124);
  ggr.addColorStop(0.0, "rgba(255,255,255,1.0)");
  ggr.addColorStop(0.28, "rgba(242,248,255,0.82)");
  ggr.addColorStop(0.62, "rgba(215,232,255,0.28)");
  ggr.addColorStop(1.0, "rgba(200,220,255,0.0)");
  gctx.fillStyle = ggr;
  gctx.fillRect(0, 0, 256, 256);
  const farGlowTex = new THREE.CanvasTexture(glowCv);
  farGlowTex.colorSpace = THREE.NoColorSpace;

  const farHaloMat = createCelMaterial({
    color: 0xffffff,
    map: farGlowTex,
    emissive: 0xf4f8ff,
    emissiveStrength: 2.0,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const farHalo = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), farHaloMat);
  const farLightGroup = new THREE.Group();
  farLightGroup.position.set(0, 0, -48.0);
  farLightGroup.add(farHalo);

  // 12 Crisp Radial White Impact Light Shafts bursting outward at the flash peak!
  const shaftMat = createCelMaterial({
    color: 0xffffff,
    emissive: 0xeaf4ff,
    emissiveStrength: 4.0,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const sh = new THREE.Mesh(new THREE.ConeGeometry(0.42, 22.0, 5), shaftMat);
    sh.position.set(Math.cos(a) * 10.5, Math.sin(a) * 10.5, 0);
    sh.rotation.z = a - Math.PI / 2;
    farLightGroup.add(sh);
  }
  farLightGroup.visible = false;
  scene.add(farLightGroup);

  // 12 Rhythmic Outward-Bursting Wave Rings ("星辰流浪" -> golden/cyan expanding waves -> "点燃这长夜" -> 100% pure white-light rings!)
  const burstRingsGroup = new THREE.Group();
  const burstRings = [];
  for (let i = 0; i < 12; i++) {
    const bMat = createCelMaterial({
      color: i % 2 === 0 ? 0xffd578 : 0x7ce6ff,
      emissive: i % 2 === 0 ? 0xffb330 : 0x4fd8ff,
      emissiveStrength: 2.2,
      unlit: true,
      noInk: true,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const bMesh = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.085, 10, 64), bMat);
    burstRingsGroup.add(bMesh);
    burstRings.push({ mesh: bMesh, mat: bMat, phase: i / 12, isGold: i % 2 === 0 });
  }
  burstRingsGroup.visible = false;
  scene.add(burstRingsGroup);

  // Brief Full-Frame Blinding White Flash Veil (only fires for ~0.4s right as Ark passes through the white light!)
  const flashVeilMat = createCelMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveStrength: 3.5,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.0,
    depthWrite: false
  });
  const flashVeil = new THREE.Mesh(new THREE.PlaneGeometry(26, 16), flashVeilMat);
  flashVeil.position.set(0, 0, 1.4);
  flashVeil.visible = false;
  scene.add(flashVeil);

  // One-Take Hexagonal Crystal Boundary Wall (appears cleanly ONLY on S10 "突破这边界" and shatters!)
  const shatterGroup = new THREE.Group();
  shatterGroup.position.set(0, 0, -14.0);
  shatterGroup.visible = false;
  scene.add(shatterGroup);

  // Genuine High-Density Full-Screen Hexagonal Crystal Barrier (693 fine 0.88-radius hexagons spanning ±25 x ±14 -> 100% corner-to-corner!)
  // Uses 10 shared radial opacity tiers (0.14 outer edges -> 1.00 center impact bullseye) for crisp fine detail & 60fps performance!
  const hexGeo = new THREE.CylinderGeometry(0.88, 0.88, 0.16, 6);
  hexGeo.rotateX(Math.PI / 2);

  const hexTierMats = [];
  for (let tier = 0; tier < 10; tier++) {
    const f = tier / 9; // 0 = outermost screen corners, 1 = 100% solid center impact bullseye
    const op = 0.14 + Math.pow(f, 1.35) * 0.86;
    hexTierMats.push(createCelMaterial({
      color: new THREE.Color(0x2c4272).lerp(new THREE.Color(0x88b8f5), f),
      shadowColor: 0x141d3a,
      emissive: 0x4a82d8,
      emissiveStrength: 0.12 + f * 0.44,
      rimStrength: 0.3 + f * 0.45,
      rimColor: 0x9cf2ff,
      noInk: f < 0.25,
      transparent: true,
      opacity: op,
      depthWrite: f > 0.85
    }));
  }

  const shatterTiles = [];
  const sRand = mulberry32(9104);
  for (let gx = -16; gx <= 16; gx++) {
    for (let gy = -10; gy <= 10; gy++) {
      const bx = gx * 1.56 + (gy % 2 === 0 ? 0 : 0.78);
      const by = gy * 1.38;
      const dist = Math.hypot(bx, by);
      const f = dist < 2.0 ? 1.0 : clamp(1.0 - (dist - 2.0) / 24.0, 0.0, 1.0);
      const tierIdx = Math.min(9, Math.floor(f * 9.99));
      const m = new THREE.Mesh(hexGeo, hexTierMats[tierIdx]);
      m.position.set(bx, by, 0);
      shatterGroup.add(m);
      const dir = new THREE.Vector3(bx, by, -2.2 - sRand() * 2.4).normalize();
      shatterTiles.push({ mesh: m, bx, by, dist, dir, spin: (sRand() - 0.5) * 4.5 });
    }
  }

  // Secondary Shatter Micro-Splinters + Shockwave Ring for explosive breakthrough impact on S10!
  const splinterMatA = createCelMaterial({ color: 0x9cf2ff, emissive: 0x4fd8ff, emissiveStrength: 2.2, unlit: true, noInk: true });
  const splinterMatB = createCelMaterial({ color: 0xffe48c, emissive: 0xffb330, emissiveStrength: 2.4, unlit: true, noInk: true });
  const splinters = [];
  for (let i = 0; i < 64; i++) {
    const sp = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.12 + sRand() * 0.22, 0),
      i % 2 === 0 ? splinterMatA : splinterMatB
    );
    const ang = sRand() * Math.PI * 2;
    const rad = 0.4 + sRand() * 3.8;
    const dir = new THREE.Vector3(Math.cos(ang) * (1.2 + sRand() * 2.2), Math.sin(ang) * (1.2 + sRand() * 2.2), (sRand() - 0.35) * 4.5);
    sp.position.set(Math.cos(ang) * rad, Math.sin(ang) * rad, 0);
    shatterGroup.add(sp);
    splinters.push({ mesh: sp, bx: sp.position.x, by: sp.position.y, dir, spin: (sRand() - 0.5) * 14.0 });
  }
  const impactRingMat = createCelMaterial({
    color: 0x9cf2ff,
    emissive: 0x62e2ff,
    emissiveStrength: 3.0,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const impactRing = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.55, 48), impactRingMat);
  shatterGroup.add(impactRing);

  return {
    scene,
    update(submode, u, time, camera, audio) {
      const bass = audio ? audio.bass : 0;
      const mid = audio ? audio.mid : 0;

      ark.userData.habRing.rotation.x = time * 1.1;
      ark.userData.coreOrb.rotation.y = time * 1.8;
      ark.userData.plumes.forEach((p) => {
        const sc = 0.95 + bass * 0.65 + 0.12 * Math.sin(time * 28);
        p.scale.set(1, sc, 1);
      });

      if (submode === "gasgiant") {
        giantGroup.visible = true;
        slingArc.visible = false;
        slingshotRig.group.visible = false;
        gateGroup.visible = false;
        streakGroup.visible = false;
        farLightGroup.visible = false;
        burstRingsGroup.visible = false;
        flashVeil.visible = false;
        shatterGroup.visible = false;
        shipAuraMat.uniforms.uOpacity.value = 0.0;

        giantPlanet.rotation.y = -0.55 + time * 0.018;
        giantRingSystem.update(time, 1.0);

        // Laminar Keplerian drift of foreground ice boulders right beneath the skimming ship
        for (let i = 0; i < ringBoulders.length; i++) {
          const b = ringBoulders[i];
          const a = b.ang - time * b.speed;
          b.mesh.position.set(Math.cos(a) * b.r, Math.sin(a) * b.r, b.zOff);
          b.mesh.rotation.x += b.spinX * 0.016;
          b.mesh.rotation.y += b.spinY * 0.016;
        }

        // S11A (90.5-93.0s): Tiny lone starship (孤帆) skimming low & gracefully right over the colossal ring
        const theta = 2.15 - u * 0.23;
        const skimR = 35.6;
        const skimH = 1.15 - u * 0.10;
        const pNow = ringPointWorld(skimR, theta, skimH);
        const pNext = ringPointWorld(skimR, theta - 0.025, skimH);

        ark.scale.setScalar(0.24);
        ark.position.copy(pNow);
        arkFwd.copy(pNext).sub(pNow).normalize();
        arkUp.copy(giantRingNormal);
        arkSide.crossVectors(arkFwd, arkUp).normalize();
        arkUp.crossVectors(arkSide, arkFwd).normalize();
        const bank = -0.22 - u * 0.06;
        const cosB = Math.cos(bank), sinB = Math.sin(bank);
        const bankedUp = arkUp.clone().multiplyScalar(cosB).addScaledVector(arkSide, sinB);
        const bankedSide = arkSide.clone().multiplyScalar(cosB).addScaledVector(arkUp, -sinB);
        arkBasisMat.makeBasis(arkFwd, bankedUp, bankedSide);
        ark.quaternion.setFromRotationMatrix(arkBasisMat);

        const camTheta = theta + 0.14;
        const camR = skimR + 5.8 + u * 1.4;
        const camH = 2.5 + u * 0.6;
        const camPos = ringPointWorld(camR, camTheta, camH);
        const lookAhead = ringPointWorld(skimR - 4.8 - u * 1.2, theta - 0.28, 0.1 - u * 0.2);

        camera.fov = 39 + u * 3;
        camera.position.copy(camPos);
        camera.lookAt(lookAhead);
        camera.updateProjectionMatrix();
        return { sunDir: new THREE.Vector3(-0.78, 0.42, 0.46), clearColor: 0x040610, shadowBounds: null };
      }

      if (submode === "slingshot_transfer") {
        slingArc.visible = false;
        slingshotRig.group.visible = true;
        gateGroup.visible = false;
        farLightGroup.visible = false;
        burstRingsGroup.visible = false;
        flashVeil.visible = false;
        shatterGroup.visible = false;
        shipAuraMat.uniforms.uOpacity.value = 0.0;
        return slingshotRig.update(u, time, camera, ark, audio, streakGroup, streaks, giantGroup, giantPlanet, giantRingSystem);
      }

      // Corridor / Boundary / Accelerator / Warp-Gate High-Speed FORWARD Flight along -Z!
      // Gates & star-streaks rush FROM deep -Z (-140) TOWARD +Z (+12) past the camera!
      ark.scale.setScalar(0.52);
      streakGroup.position.set(0, 0, 0);
      streakGroup.rotation.set(0, 0, 0);
      giantGroup.visible = false;
      slingArc.visible = false;
      slingshotRig.group.visible = false;
      gateGroup.visible = true;
      streakGroup.visible = submode === "warpgate" || submode === "boundary";

      const speed = submode === "warpgate" ? 42.0 : submode === "accelerator" ? 26.0 : 18.0;
      const totalSpan = 16 * 9.5;
      gates.forEach((g, idx) => {
        const raw = ((idx * 9.5 + time * speed) % totalSpan + totalSpan) % totalSpan;
        g.position.z = raw - (totalSpan - 12.0);
        g.rotation.z = time * 0.25 * (idx % 2 === 0 ? 1 : -1) + idx * 0.3;
        const pulse = 1.0 + bass * 0.08;
        g.scale.set(pulse, pulse, 1);
      });

      if (streakGroup.visible) {
        const span = 88.0;
        streaks.forEach((st) => {
          const zNorm = (((st.baseZ + time * st.speed) % span) + span) % span;
          st.mesh.position.z = zNorm - (span - 10.0);
        });
      }

      // Orient Ark nose (+X) pointing straight down -Z tunnel (rotation.y = +PI/2), engines firing behind toward +Z!
      const settle = submode === "boundary" ? clamp((u - 0.7) / 0.3, 0, 1) : 0;
      const swayX = Math.sin(time * 0.9) * 0.26 * (1 - settle);
      const swayY = Math.cos(time * 0.75) * 0.14 * (1 - settle);
      ark.position.set(swayX, -0.15 + swayY * (1 - settle) + settle * 0.05, -3.5 + settle * 0.3);
      ark.rotation.set(0, Math.PI / 2, -swayX * 0.35);

      if (submode === "boundary") {
        // === S09 ONE-TAKE PART 1 (73.5 - 86.6s):
        // Ark rockets down tunnel toward distant white light -> blinding high-impact white flash at u=0.86..0.92 ->
        // 100% GONE by u=0.935 -> hexagonal boundary wall ALREADY glides in from deep dark space (z=-34 -> -18) for 100% seamless S10!
        const auraIn = clamp(u / 0.25, 0, 1);
        const auraClear = 1.0 - clamp((u - 0.89) / 0.045, 0, 1);
        shipAuraMat.uniforms.uOpacity.value = auraIn * auraClear * (0.62 + bass * 0.25);
        shipAuraRing.scale.setScalar(1.0 + bass * 0.12);

        // 1. Tunnel gates clear COMPLETELY by u = 0.42 BEFORE burst wave rings begin (ZERO overlap!)
        const ringFade = clamp((u - 0.32) / 0.10, 0, 1);
        gateGroup.visible = u < 0.42;
        gateGroup.scale.setScalar(1.0 + ringFade * 3.5);

        // 2. Outward-bursting wave rings start STRICTLY FROM ZERO at u = 0.42 ("星辰流浪") — one clean wave after another!
        const burstElapsed = Math.max(0, (u - 0.42) * 13.1); // seconds elapsed since "星辰流浪"
        const burstOut = 1.0 - clamp((u - 0.87) / 0.05, 0, 1);
        const allWhiteT = clamp((u - 0.62) / 0.10, 0, 1);

        burstRingsGroup.visible = u >= 0.42 && burstOut > 0.01;
        if (burstRingsGroup.visible) {
          burstRingsGroup.position.copy(ark.position);
          const whiteCol = new THREE.Color(0xffffff);
          const goldCol = new THREE.Color(0xffd578);
          const cyanCol = new THREE.Color(0x7ce6ff);
          const waveSpacing = 0.58; // seconds between consecutive waves
          const waveLife = 1.65;    // seconds for each wave to expand outward
          burstRings.forEach((br, idx) => {
            const age = burstElapsed - idx * waveSpacing;
            if (age < 0 || age > waveLife) {
              br.mesh.visible = false;
              return;
            }
            const p = age / waveLife;
            br.mesh.visible = true;
            br.mesh.scale.setScalar(0.85 + Math.pow(p, 1.15) * 11.0);
            br.mesh.position.z = p * 7.5;
            const c = (br.isGold ? goldCol : cyanCol).clone().lerp(whiteCol, allWhiteT);
            br.mat.uniforms.uColor.value.copy(c);
            br.mat.uniforms.uEmissive.value.copy(c);
            br.mat.uniforms.uEmissiveStrength.value = 2.0 + allWhiteT * 1.8 + bass * 0.8;
            br.mat.uniforms.uOpacity.value = Math.sin(p * Math.PI) * (0.9 + bass * 0.1) * burstOut;
          });
        }

        // Pure Additive HDR Light Pass-Through (NO opaque PowerPoint white veil, NO camera near-plane clip!)
        // Symmetric sin^2 envelope over u = 0.76 -> 0.96: exact same smooth ramp-up & ramp-down speed, peaking at u = 0.86!
        const flashPhase = clamp((u - 0.76) / 0.20, 0, 1);
        const flashEnv = Math.sin(flashPhase * Math.PI);
        const flashPass = flashEnv * flashEnv; // Pure symmetric 0 -> 1 -> 0!

        const travelT = clamp(u / 0.96, 0, 1);
        const lightZ = -118.0 + Math.pow(travelT, 2.0) * 112.0; // Approaches smoothly to z=-6 (never clips camera at z=2.8!)

        farLightGroup.visible = u < 0.965;
        farLightGroup.position.set(0, 0, lightZ);
        farLightGroup.rotation.z = time * 1.2;
        farHalo.scale.setScalar(0.22 + Math.pow(travelT, 2.0) * 1.2 + flashPass * 5.2);
        farHaloMat.uniforms.uOpacity.value = (0.28 * (1.0 - clamp((u - 0.86) / 0.10, 0, 1))) + flashPass * 0.95;
        farHaloMat.uniforms.uEmissiveStrength.value = 1.6 + flashPass * 4.2;
        shaftMat.uniforms.uOpacity.value = flashPass * 0.95;

        // Keep flat opaque flashVeil OFF (pure additive HDR bloom looks 10x more natural & cinematic!)
        flashVeil.visible = false;

        // Right behind the white-light peak (u = 0.86 -> 1.0), the colossal full-screen hex barrier is ALREADY right ahead (z = -28 -> -18) filling 100% of the screen!
        const wallLead = clamp((u - 0.86) / 0.14, 0, 1);
        shatterGroup.visible = wallLead > 0.005;
        if (shatterGroup.visible) {
          shatterGroup.position.set(0, 0, -28.0 + wallLead * 10.0);
          shatterTiles.forEach((t) => {
            t.mesh.position.set(t.bx, t.by, 0);
            t.mesh.rotation.set(0, 0, 0);
          });
          splinters.forEach((sp) => { sp.mesh.visible = false; });
          impactRingMat.uniforms.uOpacity.value = 0.0;
        }

        // Smooth continuous camera & ship acceleration straight into S10 (ZERO velocity jump!)
        const leadZ = wallLead * 2.2;
        ark.position.z = -3.5 + settle * 0.3 - wallLead * 2.4;
        camera.fov = 40 + flashPass * 10.0 + wallLead * 4.0 + mid * 1.0;
        camera.position.set(2.4 - u * 1.1, 1.35 - u * 0.25, 2.8 - leadZ);
        camera.lookAt(-0.2 * (1 - settle), -0.1 * (1 - settle), -14.0 - leadZ);
        camera.updateProjectionMatrix();

        // Sky stays pure deep space (#050714) — let additive HDR Bloom carry the white light organically!
        return { sunDir: new THREE.Vector3(0.52, 0.65, 0.55), clearColor: 0x050714, shadowBounds: null };
      } else if (submode === "boundary_break") {
        // === S10 ONE-TAKE PART 2 (86.6 - 90.5s, "突破这边界"):
        // Explosive crystal shatter at u=0.25 -> followed immediately by an unmistakable afterburner acceleration surge!
        gateGroup.visible = false;
        streakGroup.visible = true;
        farLightGroup.visible = false;
        burstRingsGroup.visible = false;
        flashVeil.visible = false;
        shipAuraMat.uniforms.uOpacity.value = 0.0;

        const hitT = clamp((u - 0.24) / 0.76, 0, 1);
        const postBoost = clamp((u - 0.36) / 0.64, 0, 1);
        const boostPow = Math.pow(postBoost, 2.35);

        // Ark smashes through wall at z=-18 (u≈0.26) then KICKS into high-velocity afterburner surge!
        const arkZ = -5.6 - u * 22.0 - boostPow * 34.0;
        ark.position.set(0, -0.1 * (1 - u), arkZ);
        ark.rotation.set(0, Math.PI / 2, postBoost * 0.22);
        ark.userData.habRing.rotation.x = time * (2.2 + postBoost * 4.5);
        ark.userData.plumes.forEach((p) => {
          p.scale.set(1.0 + postBoost * 0.45, 1.15 + postBoost * 2.2 + bass * 0.5, 1.0 + postBoost * 0.45);
        });

        // Speed streaks stretch dramatically during post-breakthrough boost!
        streaks.forEach((st) => {
          st.mesh.scale.y = 1.0 + postBoost * 3.2;
        });

        // Violent, explosive shatter of hexagonal wall tiles + 64 glittering crystal micro-splinters + shockwave ring!
        shatterGroup.visible = true;
        shatterGroup.position.set(0, 0, -18.0);
        shatterTiles.forEach((t) => {
          const delay = clamp((hitT - t.dist * 0.011) * 2.1, 0, 1);
          const blast = Math.pow(delay, 1.35) * 34.0;
          t.mesh.position.set(t.bx + t.dir.x * blast, t.by + t.dir.y * blast, t.dir.z * blast * 1.35);
          t.mesh.rotation.set(delay * t.spin * 2.8, delay * t.spin * 2.1, delay * t.spin * 1.6);
        });
        splinters.forEach((sp) => {
          sp.mesh.visible = hitT > 0.01;
          if (!sp.mesh.visible) return;
          const b = Math.pow(hitT, 1.15) * 24.0;
          sp.mesh.position.set(sp.bx + sp.dir.x * b, sp.by + sp.dir.y * b, sp.dir.z * b);
          sp.mesh.rotation.set(hitT * sp.spin, hitT * sp.spin * 0.8, 0);
          sp.mesh.scale.setScalar(Math.max(0.05, 1.2 - hitT * 0.9));
        });

        const ringP = clamp((u - 0.24) / 0.34, 0, 1);
        impactRing.scale.setScalar(0.8 + ringP * 14.0);
        impactRingMat.uniforms.uOpacity.value = ringP > 0 && ringP < 1 ? (1.0 - ringP) * 0.95 : 0.0;

        // Visceral impact camera shake + dramatic FOV warp punch (44° -> 66°) lagging slightly behind Ark's surge!
        const impactShake = Math.sin(clamp((u - 0.24) / 0.24, 0, 1) * Math.PI) * 0.38;
        const sx = Math.sin(time * 68.0) * impactShake;
        const sy = Math.cos(time * 74.0) * impactShake;
        camera.fov = 44 + hitT * 6.0 + boostPow * 16.0;
        camera.position.set(1.3 - u * 1.1 + sx, 1.1 - u * 0.55 + sy, 0.6 - u * 20.0 - boostPow * 14.0);
        camera.lookAt(0, 0, arkZ - 12.0);
        camera.updateProjectionMatrix();

        return { sunDir: new THREE.Vector3(0.52, 0.65, 0.55), clearColor: 0x050714, shadowBounds: null };
      } else {
        gateGroup.scale.setScalar(1.0);
        farLightGroup.visible = false;
        burstRingsGroup.visible = false;
        flashVeil.visible = false;
        shatterGroup.visible = false;
        shipAuraMat.uniforms.uOpacity.value = 0.0;
        streaks.forEach((st) => { st.mesh.scale.y = 1.0; });
        camera.fov = submode === "warpgate" ? 48 + bass * 5.0 : 42 + mid * 2.5;
        camera.position.set(Math.sin(time * 0.6) * 0.85, 1.05, 3.4);
        camera.lookAt(0, -0.1, -18.0);
        camera.updateProjectionMatrix();
        return { sunDir: new THREE.Vector3(0.52, 0.65, 0.55), clearColor: 0x050714, shadowBounds: null };
      }
    }
  };
}
