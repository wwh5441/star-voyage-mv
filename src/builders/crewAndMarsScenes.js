import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { mulberry32, smoothstep } from "../core/math.js";
import { buildStarfield } from "./cosmicPrimitives.js";

// S03: 100% Pure-Code 3D Crew Dragon / Starship Cockpit — Curved Cupola Window, 3 Telemetry Touch Consoles, Helmeted Pilot & Launch Tower Outside
export function buildCrewCockpitScene() {
  const scene = new THREE.Scene();
  const rand = mulberry32(3031);
  scene.add(buildStarfield(1400, 260, 3031));

  const cabinMat = createCelMaterial({ color: 0xe6e8ee, shadowColor: 0x626b82, patternMode: 2, patternScale: new THREE.Vector2(8, 8), patternStrength: 0.7 });
  const darkTrimMat = createCelMaterial({ color: 0x262c3d, shadowColor: 0x121520 });
  const suitMat = createCelMaterial({ color: 0xf4f4f0, shadowColor: 0x8690a8, patternMode: 4, patternScale: new THREE.Vector2(6, 12), patternStrength: 0.6, rimStrength: 0.35 });
  const visorMat = createCelMaterial({ color: 0xffc86b, shadowColor: 0x6b3f19, emissive: 0x4dd0e1, emissiveStrength: 0.35, rimStrength: 0.65, rimColor: 0x80f2ff });
  const screenCyanMat = createCelMaterial({ color: 0x70ecff, emissive: 0x00c8ff, emissiveStrength: 1.9, unlit: true, noInk: true });
  const screenGoldMat = createCelMaterial({ color: 0xffd56b, emissive: 0xff9f1c, emissiveStrength: 1.7, unlit: true, noInk: true });

  // Curved spacecraft cabin shell (ribs + overhead console)
  for (let i = 0; i < 6; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.22, 8, 28, Math.PI * 1.15), cabinMat);
    rib.position.set(0, 0.2, 2.5 - i * 1.45);
    rib.rotation.z = -0.24;
    scene.add(rib);
  }
  const floor = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.4, 9.0), darkTrimMat);
  floor.position.set(0, -2.2, -1.0);
  scene.add(floor);

  // Curved Panoramic Cupola Window Frame (front wall)
  const winFrame = new THREE.Mesh(new THREE.TorusGeometry(2.65, 0.34, 10, 28), darkTrimMat);
  winFrame.position.set(0, 1.35, -4.6);
  scene.add(winFrame);

  // Exterior night sky + distant lit Starbase gantry visible through cupola
  const starGeo = new THREE.BufferGeometry();
  const sPos = [];
  for (let i = 0; i < 320; i++) {
    sPos.push((rand() - 0.5) * 32, -2 + rand() * 18, -14 - rand() * 14);
  }
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(sPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xf7f4eb, size: 0.28 })));

  const extTower = new THREE.Mesh(new THREE.BoxGeometry(1.4, 12, 1.4), darkTrimMat);
  extTower.position.set(2.4, 1.2, -14.0);
  scene.add(extTower);
  const extFlood = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 10), screenGoldMat);
  extFlood.position.set(1.6, 3.8, -13.2);
  scene.add(extFlood);

  // 3 Angled SpaceX-style Touch-Screen Flight Consoles
  const screens = [];
  [-1.65, 0.0, 1.65].forEach((x, idx) => {
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.96, 0.14), darkTrimMat);
    bezel.position.set(x, -0.35, -2.55 + Math.abs(x) * 0.22);
    bezel.rotation.set(-0.35, -x * 0.22, 0);
    scene.add(bezel);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 0.78), idx === 1 ? screenCyanMat : screenGoldMat);
    panel.position.set(0, 0, 0.08);
    bezel.add(panel);
    screens.push(panel);
  });

  // Contoured Crew Seat + Helmeted Astronaut (Foreground 3/4 view)
  const crew = new THREE.Group();
  crew.position.set(-0.55, -1.6, 0.45);
  crew.rotation.y = 0.28;

  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(1.45, 2.35, 0.28), darkTrimMat);
  seatBack.position.set(0, 1.1, 0.55);
  seatBack.rotation.x = -0.18;
  crew.add(seatBack);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.58, 0.85, 8, 16), suitMat);
  torso.position.set(0, 0.95, 0.05);
  crew.add(torso);

  const chestPack = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.24), darkTrimMat);
  chestPack.position.set(0, 1.05, -0.42);
  crew.add(chestPack);

  const neckRing = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.07, 8, 18), darkTrimMat);
  neckRing.rotation.x = Math.PI / 2;
  neckRing.position.set(0, 1.72, 0.02);
  crew.add(neckRing);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 2.08, 0.02);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 16), suitMat);
  headGroup.add(helmet);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.44, 18, 14, -Math.PI * 0.38, Math.PI * 0.76, Math.PI * 0.25, Math.PI * 0.48), visorMat);
  visor.position.set(0, 0.02, -0.08);
  visor.rotation.y = Math.PI;
  headGroup.add(visor);
  crew.add(headGroup);

  // Right arm reaching toward center flight console
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.85, 6, 12), suitMat);
  arm.position.set(0.62, 1.05, -0.58);
  arm.rotation.set(1.15, 0.2, -0.35);
  crew.add(arm);

  scene.add(crew);

  // Floating zero-g telemetry dust motes
  const dust = [];
  for (let i = 0; i < 24; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), screenCyanMat);
    d.position.set((rand() - 0.5) * 5.0, (rand() - 0.5) * 3.0, -3.5 + rand() * 4.5);
    scene.add(d);
    dust.push({ mesh: d, y0: d.position.y, ph: rand() * 6.28 });
  }

  return {
    scene,
    update(u, time, camera, audio) {
      const bass = audio ? audio.bass : 0;
      headGroup.rotation.y = -0.15 + Math.sin(u * Math.PI) * 0.28;
      headGroup.rotation.x = -0.06 - u * 0.14;
      screens.forEach((sc, i) => {
        sc.material.uniforms.uEmissiveStrength.value = 1.5 + 0.4 * Math.sin(time * 4.5 + i * 1.4) + bass * 0.6;
      });
      dust.forEach((d) => {
        d.mesh.position.y = d.y0 + Math.sin(time * 1.4 + d.ph) * 0.18;
      });

      camera.fov = 40;
      camera.position.set(2.35 - u * 1.55, 0.65 + u * 0.35, 2.35 - u * 1.15);
      camera.lookAt(-0.15, 0.52, -2.2);
      camera.updateProjectionMatrix();

      return { sunDir: new THREE.Vector3(-0.5, 0.55, -0.68), clearColor: 0x0b1024, shadowBounds: null };
    }
  };
}

// S13: 100% Pure-Code 3D Mars Touchdown — Stainless-Steel Starship Descending onto Rust-Ochre Martian Soil with Articulated Legs & Dust Ring
export function buildMarsTouchdownScene() {
  const scene = new THREE.Scene();
  const rand = mulberry32(13131);

  const marsSoilMat = createCelMaterial({ color: 0xc96c45, shadowColor: 0x6b2f24, patternMode: 3, patternScale: new THREE.Vector2(14, 14), patternStrength: 1.0 });
  const steelMat = createCelMaterial({ color: 0xdce3eb, shadowColor: 0x5c667d, patternMode: 2, patternScale: new THREE.Vector2(8, 16), patternStrength: 0.9, rimStrength: 0.42, rimColor: 0xffb380 });
  const darkMetalMat = createCelMaterial({ color: 0x2c3242, shadowColor: 0x151824 });
  const flameMat = createCelMaterial({ color: 0xffe49e, emissive: 0xff8c24, emissiveStrength: 2.5, unlit: true, noInk: true, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false });
  const dustMat = createCelMaterial({ color: 0xd98a62, shadowColor: 0x7d3d28, rimStrength: 0.3, rimColor: 0xffcfa3 });

  // Sculpted Martian rust-ochre terrain + distant mesas
  const groundGeo = new THREE.PlaneGeometry(160, 160, 48, 48);
  groundGeo.rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const r = Math.hypot(x, z);
    const flatPad = smoothstep(5.0, 18.0, r);
    const h = (Math.sin(x * 0.08) * Math.cos(z * 0.09) * 2.4 + Math.sin(x * 0.22 + z * 0.17) * 0.8) * flatPad;
    pos.setY(i, h);
  }
  groundGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(groundGeo, marsSoilMat));

  // Distant Moebius Martian mesas
  for (let i = 0; i < 7; i++) {
    const ang = -Math.PI * 0.85 + (i / 6) * Math.PI * 0.7;
    const dist = 52 + rand() * 24;
    const mesa = new THREE.Mesh(new THREE.CylinderGeometry(4 + rand() * 5, 9 + rand() * 7, 8 + rand() * 10, 7), marsSoilMat);
    mesa.position.set(Math.cos(ang) * dist, 3.5, Math.sin(ang) * dist);
    scene.add(mesa);
  }

  // Descending Elongated StarArk Lander (1:1 unified asset with S11B front module & S12 reentry lander!)
  const ship = new THREE.Group();

  const goldTrimMat = createCelMaterial({ color: 0xe8b95c, shadowColor: 0x785a46, rimStrength: 0.55 });
  const warmWinMat = createCelMaterial({ color: 0xffe6a6, emissive: 0xffc65c, emissiveStrength: 2.0, unlit: true });
  const charredShieldMat = createCelMaterial({
    color: 0x221d26,
    shadowColor: 0x100d14,
    emissive: 0xff5a18,
    emissiveStrength: 0.28, // Subtle glowing residual reentry heat right after S12!
    rimStrength: 0.75,
    rimColor: 0xffa654,
    side: THREE.DoubleSide
  });

  // 1. Charred Convex Circular Ablative Heat-Shield Base (y = 1.6..2.4, facing downward!)
  const shieldR = 3.25;
  const shieldPts = [];
  for (let i = 0; i <= 14; i++) {
    const f = i / 14;
    const rad = f * shieldR;
    const bulge = -Math.cos(f * Math.PI * 0.5) * 0.72; // Bulges downward (-Y), y increases -0.72 -> 0 so normals face outward (-Y)!
    shieldPts.push(new THREE.Vector2(rad, bulge));
  }
  const shieldGeo = new THREE.LatheGeometry(shieldPts, 36);
  const heatShield = new THREE.Mesh(shieldGeo, charredShieldMat);
  heatShield.position.y = 2.4;
  ship.add(heatShield);

  // Dark retention collar rim around the circular heat-shield base
  const rimCollar = new THREE.Mesh(new THREE.TorusGeometry(shieldR - 0.04, 0.18, 10, 36), darkMetalMat);
  rimCollar.rotation.x = Math.PI / 2;
  rimCollar.position.y = 2.38;
  ship.add(rimCollar);

  // 2. Elongated Tapered Lander Hull (matches S12's sleek curved-taper profile 1:1!)
  const bodyPts = [
    new THREE.Vector2(3.10, 0.0),
    new THREE.Vector2(2.82, 1.6),
    new THREE.Vector2(2.34, 4.9),
    new THREE.Vector2(2.08, 8.5),
    new THREE.Vector2(1.86, 10.4)
  ];
  const bodyGeo = new THREE.LatheGeometry(bodyPts, 32);
  const hull = new THREE.Mesh(bodyGeo, steelMat);
  hull.position.y = 2.4;
  ship.add(hull);

  // Signature StarArk 360-deg Glowing Amber Command Bridge Viewport Strip
  const bridgeWin = new THREE.Mesh(new THREE.CylinderGeometry(2.06, 2.12, 0.72, 28), warmWinMat);
  bridgeWin.position.y = 10.6;
  ship.add(bridgeWin);

  // 2 Compact Stabilizer / Leg-Fairing Fins on lower flanks (matches S12!)
  [-2.55, 2.55].forEach((z) => {
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 3.8, 1.15), darkMetalMat);
    flap.position.set(0, 5.2, z);
    ship.add(flap);
  });

  // 3. Original StarArk Pointed Conical Nosecone + Signature Gold Needle Antenna!
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.86, 6.4, 28), steelMat);
  nose.position.y = 16.0;
  ship.add(nose);

  const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.14, 3.9, 8), goldTrimMat);
  needle.position.y = 21.1;
  ship.add(needle);

  // 4 Articulated Telescoping Landing Legs deploying outward from the circular heat-shield collar
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const legPivot = new THREE.Group();
    legPivot.position.set(Math.cos(a) * 2.95, 2.45, Math.sin(a) * 2.95);
    legPivot.rotation.y = -a;
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 3.9, 8), darkMetalMat);
    strut.position.set(0.85, -1.35, 0);
    strut.rotation.z = 0.44;
    legPivot.add(strut);
    const footPad = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.78, 0.24, 10), steelMat);
    footPad.position.set(1.68, -3.1, 0);
    legPivot.add(footPad);
    ship.add(legPivot);
    legs.push(legPivot);
  }

  // 3 Center Raptor Landing Plumes firing through the base heat-shield center port
  const plumes = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const pl = new THREE.Mesh(new THREE.ConeGeometry(0.72, 5.2, 12, 1, true), flameMat);
    pl.position.set(Math.cos(a) * 0.68, -1.5, Math.sin(a) * 0.68);
    pl.rotation.x = Math.PI;
    ship.add(pl);
    plumes.push(pl);
  }
  scene.add(ship);

  // Expanding 3D cel-shaded ochre dust shock-ring clouds
  const dustPuffs = [];
  for (let i = 0; i < 32; i++) {
    const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85 + rand() * 0.9, 1), dustMat);
    const ang = (i / 32) * Math.PI * 2 + rand() * 0.2;
    scene.add(puff);
    dustPuffs.push({ mesh: puff, ang, r0: 1.5 + rand() * 3.0, sp: 3.0 + rand() * 2.5, ph: rand() * 6.28 });
  }

  return {
    scene,
    update(u, time, camera, audio) {
      const bass = audio ? audio.bass : 0;

      // Smooth powered descent into firm touchdown at u = 0.72
      const touchU = smoothstep(0.0, 0.72, u);
      const alt = Math.pow(1 - touchU, 2.2) * 14.0;
      ship.position.y = 0.75 + alt;

      // Legs deploy before touchdown
      const legU = smoothstep(0.15, 0.55, u);
      legs.forEach((lg) => { lg.rotation.z = (1 - legU) * 0.65; });

      // Engines throttle down after touchdown
      const throttle = Math.max(0.02, 1.0 - smoothstep(0.68, 0.88, u));
      plumes.forEach((pl) => {
        pl.visible = throttle > 0.04;
        pl.scale.set(0.8 + bass * 0.3, throttle * (0.85 + bass * 0.35), 0.8 + bass * 0.3);
      });

      // Dust ring erupts outward on approach & touchdown
      const dustAmp = smoothstep(0.12, 0.65, u);
      dustPuffs.forEach((dp) => {
        const r = dp.r0 + ((time * dp.sp + dp.ph) % 14.0) * (0.4 + dustAmp * 0.9);
        dp.mesh.position.set(Math.cos(dp.ang) * r, 0.55 + Math.sin(r * 0.35) * 0.85, Math.sin(dp.ang) * r);
        dp.mesh.scale.setScalar(dustAmp * (0.65 + (r / 15.0) * 1.35));
      });

      // Heroic low-angle camera pushing in toward the landing legs kissing Martian soil
      camera.fov = 38;
      camera.position.set(14.5 - u * 4.5, 2.6 + (1 - touchU) * 2.2, 16.5 - u * 3.8);
      camera.lookAt(0, 3.8 + alt * 0.45, 0);
      camera.updateProjectionMatrix();

      return { sunDir: new THREE.Vector3(0.68, 0.38, 0.62), clearColor: 0x3b1f2b, shadowBounds: null };
    }
  };
}

// S17: 100% Pure-Code 3D Clean 5-Ship Starship V-Formation Fleet Departure Past Crescent Mars (Zero Clutter!)
export function buildCleanFleetScene() {
  const scene = new THREE.Scene();
  scene.add(buildStarfield(2000, 340, 17171));

  // Serene Crescent Mars / Planet in lower-left background
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(22, 48, 36),
    createCelMaterial({ color: 0xd47a52, shadowColor: 0x381d2a, patternMode: 3, patternScale: new THREE.Vector2(8, 8), rimStrength: 0.55, rimColor: 0xffcfa3 })
  );
  planet.position.set(-28, -14, -46);
  scene.add(planet);

  const steelMat = createCelMaterial({ color: 0xe6edf5, shadowColor: 0x525e7a, patternMode: 2, patternScale: new THREE.Vector2(6, 12), rimStrength: 0.45, rimColor: 0x80ecff });
  const darkMat = createCelMaterial({ color: 0x262c3d, shadowColor: 0x111524 });
  const ionMat = createCelMaterial({ color: 0x80f4ff, emissive: 0x00ccff, emissiveStrength: 2.3, unlit: true, noInk: true, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false });

  function makeStarship(scale = 1.0) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 4.4, 18), steelMat);
    body.rotation.x = Math.PI / 2;
    g.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.68, 2.2, 18), steelMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 3.3;
    g.add(nose);
    [-0.95, 0.95].forEach((x) => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.08, 1.8), darkMat);
      f.position.set(x, 0, -1.2);
      g.add(f);
    });
    const trail = new THREE.Mesh(new THREE.ConeGeometry(0.55, 8.5, 12, 1, true), ionMat);
    trail.rotation.x = -Math.PI / 2;
    trail.position.z = -6.4;
    g.add(trail);
    g.scale.setScalar(scale);
    return { g, trail };
  }

  // Clean 5-ship V-formation banking gracefully forward into deep space
  const fleet = new THREE.Group();
  const offsets = [
    [0, 0.6, 0, 1.15],
    [-6.2, -0.8, -5.0, 0.95],
    [6.2, -0.6, -5.0, 0.95],
    [-12.5, -2.0, -10.5, 0.8],
    [12.5, -1.8, -10.5, 0.8]
  ];
  const ships = offsets.map(([x, y, z, s]) => {
    const obj = makeStarship(s);
    obj.g.position.set(x, y, z);
    fleet.add(obj.g);
    return { ...obj, x, y, z };
  });
  scene.add(fleet);

  return {
    scene,
    update(u, time, camera, audio) {
      const bass = audio ? audio.bass : 0;
      planet.rotation.y = time * 0.03;

      fleet.position.set(-4.0 + u * 8.5, -1.5 + u * 3.8, -6.0 + u * 18.0);
      fleet.rotation.set(-0.12, 0.25 - u * 0.18, -0.18 + u * 0.14);

      ships.forEach((s, i) => {
        s.g.position.y = s.y + Math.sin(time * 1.8 + i * 1.1) * 0.28;
        s.trail.scale.set(1 + bass * 0.22, 0.85 + bass * 0.45, 1 + bass * 0.22);
      });

      camera.fov = 40;
      camera.position.set(10.5 - u * 4.5, 5.2 - u * 1.4, 20.0 - u * 3.5);
      camera.lookAt(fleet.position.x, fleet.position.y + 0.5, fleet.position.z + 2.0);
      camera.updateProjectionMatrix();

      return { sunDir: new THREE.Vector3(0.7, 0.48, 0.52), clearColor: 0x060a1b, shadowBounds: null };
    }
  };
}

// S18: 100% Pure-Code 3D Starship Command Bridge — Panoramic Viewport + Floating Multi-Ring Holographic Galaxy Astrolabe Table
export function buildBridgeAstrolabeScene() {
  const scene = new THREE.Scene();
  const rand = mulberry32(18181);
  scene.add(buildStarfield(1800, 320, 18181));

  const deckMat = createCelMaterial({ color: 0x262f45, shadowColor: 0x111626, patternMode: 2, patternScale: new THREE.Vector2(10, 10) });
  const hullMat = createCelMaterial({ color: 0xdce2ea, shadowColor: 0x5c6882 });
  const holoCyan = createCelMaterial({ color: 0x78f0ff, emissive: 0x00d0ff, emissiveStrength: 2.1, unlit: true, noInk: true, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false });
  const holoGold = createCelMaterial({ color: 0xffe082, emissive: 0xffaa00, emissiveStrength: 2.2, unlit: true, noInk: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });

  // Circular Bridge Floor & Overhead Panoramic Ribs
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(11.5, 11.5, 0.5, 32), deckMat);
  floor.position.y = -2.4;
  scene.add(floor);

  for (let i = -2; i <= 2; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.42, 9.5, 0.55), deckMat);
    const a = i * 0.38;
    rib.position.set(Math.sin(a) * 10.2, 2.2, -Math.cos(a) * 10.2);
    rib.rotation.y = -a;
    scene.add(rib);
  }
  const upperRim = new THREE.Mesh(new THREE.TorusGeometry(10.2, 0.45, 8, 36, Math.PI), hullMat);
  upperRim.rotation.x = Math.PI / 2;
  upperRim.rotation.z = Math.PI;
  upperRim.position.y = 6.2;
  scene.add(upperRim);

  // Exterior starfield outside panoramic bridge viewport
  const starGeo = new THREE.BufferGeometry();
  const sPos = [];
  for (let i = 0; i < 600; i++) {
    sPos.push((rand() - 0.5) * 90, -10 + rand() * 55, -25 - rand() * 45);
  }
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(sPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xf4f7ff, size: 0.52 })));

  // Circular Command Pedestal Table
  const table = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 2.6, 1.35, 28), hullMat);
  table.position.y = -1.5;
  scene.add(table);
  const tableRing = new THREE.Mesh(new THREE.TorusGeometry(3.35, 0.1, 8, 36), holoCyan);
  tableRing.rotation.x = Math.PI / 2;
  tableRing.position.y = -0.8;
  scene.add(tableRing);

  // Floating 3D Holographic Galaxy Astrolabe
  const holo = new THREE.Group();
  holo.position.set(0, 1.35, 0);

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.58, 1), holoGold);
  holo.add(core);

  const rings = [];
  [1.45, 2.25, 3.05, 3.75].forEach((r, idx) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.045, 8, 48), idx % 2 === 0 ? holoCyan : holoGold);
    ring.rotation.set(idx * 0.55, idx * 0.4, idx * 0.3);
    holo.add(ring);
    rings.push(ring);
  });

  // Holographic galaxy star cloud hovering above table
  const hGeo = new THREE.BufferGeometry();
  const hPos = [];
  for (let i = 0; i < 420; i++) {
    const t = rand();
    const ang = t * 8.0 + (i % 3) * 2.09 + (rand() - 0.5) * 0.4;
    const rad = 0.4 + t * 3.1;
    hPos.push(Math.cos(ang) * rad, (rand() - 0.5) * 0.5, Math.sin(ang) * rad);
  }
  hGeo.setAttribute("position", new THREE.Float32BufferAttribute(hPos, 3));
  const holoStars = new THREE.Points(hGeo, new THREE.PointsMaterial({ color: 0x80f2ff, size: 0.14 }));
  holo.add(holoStars);

  scene.add(holo);

  return {
    scene,
    update(u, time, camera, audio) {
      const bass = audio ? audio.bass : 0;
      core.rotation.y = time * 1.4;
      core.scale.setScalar(1.0 + bass * 0.35);
      holoStars.rotation.y = time * 0.55;
      rings.forEach((rg, i) => {
        rg.rotation.x += 0.008 * (i % 2 === 0 ? 1 : -1);
        rg.rotation.y += 0.012 * (1 + i * 0.2);
      });

      const ang = -0.35 + u * 0.72;
      camera.fov = 42;
      camera.position.set(Math.sin(ang) * 9.6, 2.9 - u * 0.7, Math.cos(ang) * 9.6);
      camera.lookAt(0, 1.0, -1.2);
      camera.updateProjectionMatrix();

      return { sunDir: new THREE.Vector3(0.4, 0.8, 0.5), clearColor: 0x060b1c, shadowBounds: null };
    }
  };
}
