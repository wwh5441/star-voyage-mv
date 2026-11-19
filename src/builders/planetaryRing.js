import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { mulberry32 } from "../core/math.js";

// Procedural Multi-Track Planetary Ring Texture (u = radial 0..1 across C-ring / B-ring / Cassini Gap / A-ring / Encke Gap / F-ring)
function createMultiTrackRingTexture(tintHex = 0xf2d494, accentHex = 0x7ce6ff) {
  const w = 512, h = 32;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");

  const baseCol = new THREE.Color(tintHex);
  const accCol = new THREE.Color(accentHex);

  for (let x = 0; x < w; x++) {
    const r = x / (w - 1); // 0 = inner edge, 1 = outer edge
    let alpha = 0;
    let mixAcc = 0;
    let bright = 1.0;

    if (r >= 0.04 && r < 0.22) {
      // Track 1: Inner translucent C-ring gossamer tracks
      const sub = Math.sin(r * 140) * 0.5 + 0.5;
      alpha = (0.18 + sub * 0.16) * Math.sin(((r - 0.04) / 0.18) * Math.PI);
      mixAcc = 0.45;
      bright = 0.85;
    } else if (r >= 0.24 && r < 0.57) {
      // Track 2: Dense striated B-ring (rich multi-band golden/champagne tracks)
      const band1 = Math.sin(r * 95) * 0.5 + 0.5;
      const band2 = Math.sin(r * 260) * 0.5 + 0.5;
      alpha = 0.58 + band1 * 0.24 + band2 * 0.12;
      bright = 0.82 + band1 * 0.3;
    } else if (r >= 0.57 && r < 0.65) {
      // Crisp Cassini Division Gap (clear dark separation!)
      alpha = 0.02;
    } else if (r >= 0.65 && r < 0.88) {
      // Track 3: Outer A-ring with fine Encke division at r=0.81..0.83
      if (r >= 0.805 && r < 0.825) {
        alpha = 0.04;
      } else {
        const band = Math.sin(r * 180) * 0.5 + 0.5;
        alpha = 0.46 + band * 0.26;
        mixAcc = 0.18;
        bright = 0.92 + band * 0.18;
      }
    } else if (r >= 0.92 && r < 0.96) {
      // Track 4: Razor-thin braided outer F-ring guide track
      alpha = 0.72 * Math.sin(((r - 0.92) / 0.04) * Math.PI);
      mixAcc = 0.55;
      bright = 1.25;
    }

    const col = baseCol.clone().lerp(accCol, mixAcc).multiplyScalar(bright);
    const rr = Math.min(255, Math.round(col.r * 255));
    const gg = Math.min(255, Math.round(col.g * 255));
    const bb = Math.min(255, Math.round(col.b * 255));
    ctx.fillStyle = `rgba(${rr},${gg},${bb},${alpha.toFixed(3)})`;
    ctx.fillRect(x, 0, 1, h);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

// Build a RingGeometry with true radial UVs (u = radial 0..1, v = angle 0..1)
function createRadialRingGeometry(innerR, outerR, thetaSegments = 96) {
  const geo = new THREE.RingGeometry(innerR, outerR, thetaSegments, 1);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const rad = Math.hypot(x, y);
    const u = (rad - innerR) / Math.max(0.0001, outerR - innerR);
    const v = (Math.atan2(y, x) + Math.PI) / (Math.PI * 2);
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  return geo;
}

// Reusable 100% Pure-Code 3D Multi-Track Star Ring (多轨星环):
// Concentric C/B/A/F striated tracks + Cassini & Encke gaps + 48 Keplerian orbiting 3D ice shards + 2 shepherd moonlets!
export function createMultiTrackStarRing(planetRadius, opts = {}) {
  const innerR = planetRadius * (opts.innerScale || 1.28);
  const outerR = planetRadius * (opts.outerScale || 2.55);
  const group = new THREE.Group();

  const ringTex = createMultiTrackRingTexture(opts.tint || 0xf2d494, opts.accent || 0x7ce6ff);
  const ringMat = createCelMaterial({
    color: opts.startColor !== undefined ? opts.startColor : 0xffffff,
    map: ringTex,
    emissive: opts.emissive || 0xffbe4d,
    emissiveStrength: opts.emissiveStrength !== undefined ? opts.emissiveStrength : 0.28,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: opts.opacity !== undefined ? opts.opacity : 0.92,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const ringMesh = new THREE.Mesh(createRadialRingGeometry(innerR, outerR, 96), ringMat);
  group.add(ringMesh);

  // Subtle fine glowing inner & outer structural track threads (adds crisp Ligne-Claire precision)
  const threadMat = createCelMaterial({
    color: opts.accent || 0x80ecff,
    emissive: opts.accent || 0x4fd8ff,
    emissiveStrength: 1.4,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.45
  });
  const trackRadii = [
    innerR + (outerR - innerR) * 0.24,
    innerR + (outerR - innerR) * 0.65,
    innerR + (outerR - innerR) * 0.94
  ];
  trackRadii.forEach((tr) => {
    group.add(new THREE.Mesh(new THREE.TorusGeometry(tr, planetRadius * 0.009, 6, 84), threadMat));
  });

  // 48 Faceted 3D Ice/Dust Shards + 2 Shepherd Moonlets orbiting at Keplerian speeds across the tracks!
  const rand = mulberry32(opts.seed || 7711);
  const shardMat = createCelMaterial({
    color: opts.tint || 0xf5e2b8,
    shadowColor: 0x4a3d38,
    emissive: opts.emissive || 0xffbe4d,
    emissiveStrength: 0.2,
    rimStrength: 0.35
  });
  const shardCount = opts.shardCount || 44;
  const shards = [];
  for (let i = 0; i < shardCount; i++) {
    // Distribute shards strictly inside the B-ring, A-ring & F-ring tracks (avoiding Cassini gap!)
    const bandPick = i % 3;
    const tR = bandPick === 0 ? (0.26 + rand() * 0.28) : bandPick === 1 ? (0.67 + rand() * 0.13) : (0.91 + rand() * 0.05);
    const r = innerR + (outerR - innerR) * tR;
    const ang = rand() * Math.PI * 2;
    const isMoonlet = i < 2;
    const sz = isMoonlet ? planetRadius * 0.075 : planetRadius * (0.018 + rand() * 0.025);
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(sz, isMoonlet ? 1 : 0), shardMat);
    m.position.set(Math.cos(ang) * r, Math.sin(ang) * r, (rand() - 0.5) * planetRadius * 0.05);
    group.add(m);
    // Keplerian angular speed: inner tracks orbit faster than outer tracks!
    const speed = (0.38 / Math.pow(tR + 0.35, 1.3)) * (opts.speedScale || 1.0);
    shards.push({ mesh: m, r, ang, speed, zOff: m.position.z });
  }

  return {
    group,
    ringMat,
    threadMat,
    shardMat,
    update(time, lit = 1.0) {
      shards.forEach((s) => {
        const a = s.ang + time * s.speed;
        s.mesh.position.set(Math.cos(a) * s.r, Math.sin(a) * s.r, s.zOff);
        s.mesh.rotation.x = time * 1.4 + s.ang;
        s.mesh.rotation.y = time * 1.1;
      });
      threadMat.uniforms.uOpacity.value = 0.12 + lit * 0.42;
    }
  };
}
