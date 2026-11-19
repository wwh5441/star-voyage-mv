import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { smoothstep, easeOutQuart, clamp } from "../core/math.js";
import { buildStarfield, buildCelEarth, buildStarArkShip } from "./cosmicPrimitives.js";

// Act 03B (00:49.0 - 00:57.1): 引力无法阻碍 · 物种向天外
// High-altitude Karman-line Stage Separation, Fairing Jettison & Tearing Free of the 3D Gravity Well!
export function buildGravityBreakScene() {
  const scene = new THREE.Scene();
  scene.add(buildStarfield(2600, 460, 4901));

  // Curved Earth far below rushing away as altitude climbs past 100km
  const earth = buildCelEarth(38.0, { glowColor: 0x6ecaff, atmoIntensity: 1.45 });
  earth.position.set(0.0, -42.5, -8.0);
  scene.add(earth);

  // 3D Warped Gravity-Well Funnel Grid ("引力井") trying to drag the vessel downward!
  const gravGroup = new THREE.Group();
  gravGroup.position.set(0, -1.8, 0);
  scene.add(gravGroup);

  const gravRingMat = createCelMaterial({
    color: 0x9b82f5,
    emissive: 0x7358d9,
    emissiveStrength: 1.35,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.72
  });
  const gravBreakMat = createCelMaterial({
    color: 0xffc864,
    emissive: 0xffa638,
    emissiveStrength: 1.9,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.82
  });

  const wellRings = [];
  for (let i = 0; i < 8; i++) {
    const r = 1.6 + i * 1.15;
    const y = -Math.pow(1.0 / (0.35 + i * 0.28), 1.35) * 2.2;
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(r, i < 2 ? 0.042 : 0.026, 8, 64),
      i === 0 ? gravBreakMat : gravRingMat
    );
    torus.rotation.x = Math.PI / 2;
    torus.position.y = y;
    gravGroup.add(torus);
    wellRings.push({ mesh: torus, baseY: y, idx: i });
  }

  // Radial Gravity-Well Meridian Lines curving down into Earth's well
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const pts = [];
    for (let s = 0; s <= 12; s++) {
      const f = s / 12;
      const r = 1.6 + f * 8.5;
      const y = -Math.pow(1.0 / (0.35 + f * 2.1), 1.35) * 2.2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
    }
    const line = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.016, 5, false),
      gravRingMat
    );
    gravGroup.add(line);
  }

  // Rocket Upper Stack Assembly (pointing +Y upward toward deep space!)
  const stack = new THREE.Group();
  scene.add(stack);

  // Inner Interstellar Ark Payload revealed as fairings split open!
  const arkPayload = buildStarArkShip();
  arkPayload.scale.setScalar(0.46);
  arkPayload.rotation.z = Math.PI / 2; // Point nosecone straight UP (+Y)
  arkPayload.position.y = 1.35;
  stack.add(arkPayload);

  // Two Clamshell Payload Fairing Halves that split & peel outward!
  const fairingMat = createCelMaterial({
    color: 0xf4eee0,
    shadowColor: 0x625b8c,
    patternMode: 2,
    patternScale: new THREE.Vector2(6, 8),
    patternStrength: 0.85,
    side: THREE.DoubleSide
  });
  const fairingL = new THREE.Group();
  const fairingR = new THREE.Group();
  const shellGeo = new THREE.CylinderGeometry(0.18, 0.92, 3.8, 16, 1, true, 0, Math.PI);
  const fMeshL = new THREE.Mesh(shellGeo, fairingMat);
  fMeshL.rotation.y = Math.PI / 2;
  fairingL.add(fMeshL);
  fairingL.position.set(0, 1.85, 0);

  const fMeshR = new THREE.Mesh(shellGeo, fairingMat.clone());
  fMeshR.rotation.y = -Math.PI / 2;
  fairingR.add(fMeshR);
  fairingR.position.set(0, 1.85, 0);
  stack.add(fairingL, fairingR);

  // Spent 1st Stage Core + 4 Strap-On Boosters peeling away & tumbling back into the gravity well!
  const spentCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.78, 4.2, 20),
    createCelMaterial({ color: 0xd8d3c8, shadowColor: 0x524c7a, patternMode: 2, patternScale: new THREE.Vector2(6, 8) })
  );
  spentCore.position.y = -2.4;
  stack.add(spentCore);

  const boosterMatA = createCelMaterial({ color: 0xf2ece0, shadowColor: 0x5f588a });
  const boosterMatB = createCelMaterial({ color: 0x4e6496, shadowColor: 0x29325c });
  const boosters = [];
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const b = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.52, 3.8, 16),
      i % 2 === 0 ? boosterMatA.clone() : boosterMatB.clone()
    );
    stack.add(b);
    boosters.push({ mesh: b, a });
  }

  // Cyan-Gold Second-Stage Fusion Ignition Flash + Expanding Shock Ring ("物种 · 向天外")
  const shockRingMat = createCelMaterial({
    color: 0x9cf2ff,
    emissive: 0x52d4ff,
    emissiveStrength: 3.2,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide
  });
  const shockRing = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.32, 48), shockRingMat);
  shockRing.rotation.x = Math.PI / 2;
  stack.add(shockRing);

  // High-speed vertical slipstream streaks rushing downward (-Y) past the ascending ship to sell 11.2 km/s escape velocity!
  const streakMat = createCelMaterial({
    color: 0x9cf2ff,
    emissive: 0x52d4ff,
    emissiveStrength: 2.0,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const streaks = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2 + (i % 3) * 0.4;
    const rad = 2.8 + (i % 7) * 1.45;
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 2.2 + (i % 4) * 0.9, 5), streakMat);
    const y0 = ((i * 3.7) % 36) - 14;
    st.position.set(Math.cos(a) * rad, y0, Math.sin(a) * rad);
    scene.add(st);
    streaks.push({ mesh: st, x: Math.cos(a) * rad, z: Math.sin(a) * rad, y0, sp: 26.0 + (i % 5) * 7.5 });
  }

  return {
    scene,
    update(u, time, camera, audio) {
      const bass = audio ? audio.bass : 0;

      // Strong continuous vertical ascent speed from u=0 -> 1, surging exponentially after stage ignition!
      const surgeT = smoothstep(0.38, 1.0, u);
      const ascentY = u * 14.0 + Math.pow(u, 2.25) * 36.0;

      earth.userData.globe.rotation.y = 1.6 + time * 0.025;
      earth.position.y = -39.5 - ascentY * 0.42;

      // Move entire stack rapidly skyward while preserving the exact crisp stage-separation & fairing-split speed!
      stack.position.y = ascentY * 0.55;

      // Phase 1 (u: 0.0 -> 0.48, "引力无法阻碍"): Boosters & 1st stage detach & fall swiftly into receding gravity well!
      const sepT = smoothstep(0.06, 0.72, u);
      const sepEase = easeOutQuart(sepT);
      spentCore.position.y = -2.4 - sepT * sepT * 14.5;
      spentCore.rotation.z = sepT * 0.35;

      boosters.forEach(({ mesh, a }) => {
        const radial = 1.02 + sepEase * 5.2;
        const drop = -2.2 - sepT * sepT * 13.0;
        mesh.position.set(Math.cos(a) * radial, drop, Math.sin(a) * radial);
        mesh.rotation.set(Math.sin(a) * sepT * 1.45, 0, -Math.cos(a) * sepT * 1.45);
      });

      // Fairing halves split cleanly open at u = 0.22 -> 0.76 revealing the gleaming Ark!
      const fairT = smoothstep(0.22, 0.76, u);
      fairingL.position.set(-fairT * 3.8, 1.85 - fairT * 3.2, 0);
      fairingL.rotation.z = fairT * 0.95;
      fairingR.position.set(fairT * 3.8, 1.85 - fairT * 3.2, 0);
      fairingR.rotation.z = -fairT * 0.95;

      // Phase 2 (u: 0.48 -> 1.0, "物种 · 向天外"): Unmistakable Afterburner Kick — Ark punches ahead & rockets away from camera into deep space!
      const speciesKick = smoothstep(0.48, 1.0, u);
      const kickPow = Math.pow(speciesKick, 2.75);
      const arkBoostY = 1.35 + kickPow * 44.0;
      arkPayload.position.y = arkBoostY;
      arkPayload.userData.habRing.rotation.x = time * (1.5 + speciesKick * 3.5);
      arkPayload.userData.plumes.forEach((p) => {
        const sc = 0.45 + speciesKick * 2.1 + bass * 0.45;
        p.scale.set(0.8 + speciesKick * 0.35, sc, 0.8 + speciesKick * 0.35);
      });

      // High-speed vertical slipstream streaks surge 5x faster & stretch dramatically on "物种向天外"!
      const streakVel = 1.0 + speciesKick * 4.8;
      streaks.forEach((s) => {
        const relY = (((s.y0 - time * s.sp * streakVel) % 36) + 36) % 36 - 14;
        s.mesh.position.set(s.x, stack.position.y + arkBoostY * 0.65 + relY, s.z);
        s.mesh.scale.y = 0.85 + speciesKick * 3.8;
      });

      // Crisp Escape-Velocity Ignition Shockwave bursting right at "物种向天外" (u = 0.48 -> 0.82)
      const shockP = clamp((u - 0.48) / 0.34, 0, 1);
      shockRing.position.y = 0.6;
      shockRing.scale.setScalar(0.8 + shockP * 11.5);
      shockRingMat.uniforms.uOpacity.value = shockP > 0 && shockP < 1 ? (1.0 - shockP) * 0.95 : 0.0;

      // Gravity well drops rapidly behind the escaping spacecraft
      gravGroup.position.y = -1.4 - ascentY * 0.38 - kickPow * 12.0;
      gravGroup.rotation.y = time * 0.3;
      wellRings.forEach(({ mesh, baseY, idx }) => {
        const snap = 1.0 + speciesKick * (idx === 0 ? 1.8 : 0.6);
        mesh.scale.set(snap, snap, 1);
        mesh.position.y = baseY - speciesKick * idx * 0.55;
      });

      // Chase camera lags slightly behind the Ark's afterburner kick + FOV warp punch (40° -> 58°) so you visibly feel the ship rocket away!
      const camTrackY = stack.position.y + 1.35 + kickPow * 25.5;
      const rumble = Math.sin(clamp((u - 0.48) / 0.22, 0, 1) * Math.PI) * 0.16;
      const camAng = -0.35 + u * 0.88;
      const camY = camTrackY + 3.6 - u * 5.2 - speciesKick * 3.4 + Math.cos(time * 55) * rumble;
      const camR = 8.8 - u * 0.6 + speciesKick * 5.2;
      camera.fov = 40 + speciesKick * 18.0;
      camera.position.set(
        Math.sin(camAng) * camR + Math.sin(time * 48) * rumble,
        camY,
        Math.cos(camAng) * camR
      );
      camera.lookAt(0, stack.position.y + arkBoostY * 0.92, 0);
      camera.updateProjectionMatrix();

      return {
        sunDir: new THREE.Vector3(0.68, 0.46, 0.56),
        clearColor: 0x050714,
        shadowBounds: null
      };
    }
  };
}
