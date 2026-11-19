import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { mulberry32, clamp, smoothstep } from "../core/math.js";
import { buildStarfield } from "./cosmicPrimitives.js";

// Custom GLSL3 MRT Endless Glowing "No-Finish-Line" Starlight Horizon Track ("星际长跑 · 没有终点的线")
function createEndlessTrackMaterial() {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uBass: { value: 0 },
      uFade: { value: 1.0 }
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
      uniform float uFade;
      in vec2 vUv;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        float across = abs(vUv.y * 2.0 - 1.0);
        float centerLine = exp(-across * across * 95.0) * 1.8;
        float sideRails = exp(-pow((across - 0.55) * 16.0, 2.0)) * 0.45;
        float glow = exp(-across * across * 6.5) * 0.32;
        float dash = 0.72 + 0.28 * sin(vUv.x * 160.0 - uTime * 28.0);
        float endFade = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.82, vUv.x);

        vec3 col = vec3(1.0, 0.90, 0.58) * centerLine + vec3(0.36, 0.84, 1.0) * (sideRails + glow);
        float a = clamp((centerLine + sideRails + glow) * dash * endFade * (0.9 + uBass * 0.35) * uFade, 0.0, 1.0);
        gColor = vec4(col * (1.1 + uBass * 0.35), a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Compute exact 15-joint 3D Human Sprint Pose locked to 150 BPM (0.40s per footstep)
function computeRunnerSkeleton(phase, joints) {
  const stride = Math.sin(phase);
  const strideC = Math.cos(phase);
  const bounce = Math.abs(stride) * 0.30;

  const pelvisY = 1.92 + bounce;
  joints.pelvis.set(0.0, pelvisY, 0.0);
  joints.chest.set(0.34, pelvisY + 1.05, 0.0);
  joints.neck.set(0.46, pelvisY + 1.32, 0.0);
  joints.head.set(0.54, pelvisY + 1.66, 0.0);

  const twist = strideC * 0.14;
  joints.lShoulder.set(joints.chest.x - twist, joints.chest.y + 0.04, -0.34);
  joints.rShoulder.set(joints.chest.x + twist, joints.chest.y + 0.04, 0.34);
  joints.lHip.set(joints.pelvis.x + twist * 0.5, pelvisY - 0.08, -0.20);
  joints.rHip.set(joints.pelvis.x - twist * 0.5, pelvisY - 0.08, 0.20);

  function solveLeg(hip, knee, ankle, legPhase) {
    const hipAng = Math.cos(legPhase) * 0.88 + 0.14;
    const kneeFlex = 0.22 + Math.max(0, -Math.sin(legPhase)) * 1.35 + Math.max(0, Math.cos(legPhase)) * 0.18;
    const kx = hip.x + Math.sin(hipAng) * 0.96;
    const ky = hip.y - Math.cos(hipAng) * 0.96;
    knee.set(kx, ky, hip.z);
    const shinAng = hipAng - kneeFlex;
    ankle.set(kx + Math.sin(shinAng) * 0.96, Math.max(0.04, ky - Math.cos(shinAng) * 0.96), hip.z);
  }
  solveLeg(joints.lHip, joints.lKnee, joints.lAnkle, phase);
  solveLeg(joints.rHip, joints.rKnee, joints.rAnkle, phase + Math.PI);

  function solveArm(shoulder, elbow, hand, armPhase) {
    const shAng = Math.cos(armPhase) * 0.82 - 0.08;
    const elbBend = 1.25 + Math.cos(armPhase) * 0.35;
    const ex = shoulder.x + Math.sin(shAng) * 0.62;
    const ey = shoulder.y - Math.cos(shAng) * 0.62;
    elbow.set(ex, ey, shoulder.z * 1.12);
    const foreAng = shAng + elbBend;
    hand.set(ex + Math.sin(foreAng) * 0.58, ey - Math.cos(foreAng) * 0.58, shoulder.z * 0.96);
  }
  solveArm(joints.lShoulder, joints.lElbow, joints.lHand, phase + Math.PI);
  solveArm(joints.rShoulder, joints.rElbow, joints.rHand, phase);
}

// Build a continuous, graceful calligraphic 3D cursive "Sign" signature path floating in mid-air!
// Centered around (4.2, 2.5, 0.0) so it frames heroically in front of the seamless S25A->S25B camera!
function createCursiveSignCurve() {
  const ox = 4.2, oy = 2.45;
  const pts2D = [
    // Capital cursive "S"
    [-2.4, 1.35], [-3.2, 1.55], [-3.55, 1.05], [-3.1, 0.45], [-2.15, -0.05], [-2.55, -0.75], [-3.45, -0.70],
    // Connecting sweep -> "i"
    [-2.1, -0.45], [-1.55, 0.38], [-1.45, -0.58],
    // -> "g" loop & descender
    [-0.75, 0.12], [-0.15, 0.38], [-0.65, -0.25], [-0.15, -0.35], [-0.05, 0.25],
    [-0.35, -1.25], [-0.85, -1.45], [-0.55, -0.82],
    // -> "n" arches
    [0.25, 0.25], [0.45, -0.52], [0.85, 0.28], [1.28, 0.22], [1.45, -0.52],
    // Grand sweeping calligraphic underline flourish!
    [2.35, -0.32], [3.35, -0.08], [2.45, -0.88], [0.25, -1.05], [-2.65, -1.08]
  ];
  const pts3D = pts2D.map(([x, y], idx) =>
    new THREE.Vector3(ox + x, oy + y, Math.sin(idx * 0.35) * 0.18)
  );
  return new THREE.CatmullRomCurve3(pts3D, false, "catmullrom", 0.42);
}

// S25A (214.6-218.3s, "runner") -> S25B (218.3-222.5s, "sign")
// 100% Seamless One-Take Metamorphosis:
// Dense Radiant Starlight Human Sprinting on the 150 BPM Drum Beat -> Bursts into 420 Stardust Points -> Coalesces into a Luminous Pen Writing "Sign" in Mid-Air!
export function buildStarRunnerScene() {
  const scene = new THREE.Scene();
  const rand = mulberry32(25101);
  scene.add(buildStarfield(3400, 560, 20209));

  // === 1. ENDLESS STARLIGHT "NO-FINISH-LINE" HORIZON TRACK ===
  const trackMat = createEndlessTrackMaterial();
  const trackMesh = new THREE.Mesh(new THREE.PlaneGeometry(240, 6.5), trackMat);
  trackMesh.rotation.x = -Math.PI / 2;
  trackMesh.position.set(20, 0.0, 0);
  scene.add(trackMesh);

  // === 2. RADIANT, DENSE, SUBSTANTIAL STARLIGHT HUMAN RUNNER (420 Volumetric Stardust Points + Soft Inner Light Aura!) ===
  const runnerGroup = new THREE.Group();
  scene.add(runnerGroup);

  const joints = {
    pelvis: new THREE.Vector3(), chest: new THREE.Vector3(), neck: new THREE.Vector3(), head: new THREE.Vector3(),
    lShoulder: new THREE.Vector3(), rShoulder: new THREE.Vector3(),
    lElbow: new THREE.Vector3(), rElbow: new THREE.Vector3(),
    lHand: new THREE.Vector3(), rHand: new THREE.Vector3(),
    lHip: new THREE.Vector3(), rHip: new THREE.Vector3(),
    lKnee: new THREE.Vector3(), rKnee: new THREE.Vector3(),
    lAnkle: new THREE.Vector3(), rAnkle: new THREE.Vector3()
  };

  const bonePairs = [
    ["pelvis", "chest"], ["chest", "neck"], ["neck", "head"],
    ["chest", "lShoulder"], ["lShoulder", "lElbow"], ["lElbow", "lHand"],
    ["chest", "rShoulder"], ["rShoulder", "rElbow"], ["rElbow", "rHand"],
    ["pelvis", "lHip"], ["lHip", "lKnee"], ["lKnee", "lAnkle"],
    ["pelvis", "rHip"], ["rHip", "rKnee"], ["rKnee", "rAnkle"]
  ];

  // Glowing golden constellation skeleton lines
  const skelPos = new Float32Array(bonePairs.length * 2 * 3);
  const skelGeo = new THREE.BufferGeometry();
  skelGeo.setAttribute("position", new THREE.BufferAttribute(skelPos, 3));
  const skelMat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uOpacity: { value: 0.9 } },
    vertexShader: `
      precision highp float;
      in vec3 position;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uOpacity;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        gColor = vec4(1.0, 0.90, 0.62, uOpacity);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
  const skelLines = new THREE.LineSegments(skelGeo, skelMat);
  skelLines.frustumCulled = false;
  runnerGroup.add(skelLines);

  // Soft Inner Luminous Volumetric Core Glow along torso & head (makes the runner look rich, dense & substantial!)
  const auraCoreMat = createCelMaterial({
    color: 0xffe49e, emissive: 0xffb830, emissiveStrength: 2.2,
    unlit: true, noInk: true, transparent: true, opacity: 0.36,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const torsoGlow = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.95, 8, 16), auraCoreMat);
  const headGlow = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), auraCoreMat);
  runnerGroup.add(torsoGlow, headGlow);

  // 420 Rich, Dense Volumetric Stardust Particles (form Runner in S25A -> Morph seamlessly into Luminous Fountain Pen in S25B!)
  const whiteGoldMat = createCelMaterial({ color: 0xfff8dc, emissive: 0xffd266, emissiveStrength: 3.4, unlit: true, noInk: true });
  const goldStarMat = createCelMaterial({ color: 0xffe89e, emissive: 0xffb330, emissiveStrength: 3.2, unlit: true, noInk: true });
  const cyanStarMat = createCelMaterial({ color: 0xa6f6ff, emissive: 0x38d2ff, emissiveStrength: 3.0, unlit: true, noInk: true });
  const starDotGeo = new THREE.OctahedronGeometry(0.082, 0);

  // Exact 420-point handoff cloud shared 1:1 with S24 operatorsScene.js (seed 24250)!
  const handoffRand = mulberry32(24250);
  const bodyStars = [];
  for (let i = 0; i < 420; i++) {
    // Weighted anatomical distribution: thicker, brighter glow along torso, head, thighs & arms!
    const isHead = i < 48;
    const isTorso = !isHead && i < 140;
    const boneIdx = isHead ? 2 : isTorso ? 0 : (i % bonePairs.length);
    const tBone = isHead ? (0.45 + rand() * 0.55) : rand();
    const thick = isHead ? 0.26 : isTorso ? 0.36 : 0.17;
    const ang = rand() * Math.PI * 2;
    const rad = Math.pow(rand(), 0.55) * thick;
    const localOff = new THREE.Vector3(Math.cos(ang) * rad, (rand() - 0.5) * thick * 0.65, Math.sin(ang) * rad);
    const scatterPos = new THREE.Vector3(
      0.4 + (handoffRand() - 0.5) * 7.8,
      0.35 + handoffRand() * 4.0,
      (handoffRand() - 0.5) * 4.6
    );

    // Target position on the Luminous Fountain Pen in S25B (local pen space: nib tip at (0,0,0), barrel extends along (+0.55, +0.85, +0.25)!)
    const penF = i / 420; // 0 = sharp blazing gold nib tip, 1 = sleek pen barrel tail
    const penLen = 3.2;
    const penR = penF < 0.16 ? (penF / 0.16) * 0.19 : (0.19 * (1.0 - (penF - 0.16) * 0.45));
    const penAng = rand() * Math.PI * 2;
    const penLocal = new THREE.Vector3(
      Math.cos(penAng) * penR,
      penF * penLen,
      Math.sin(penAng) * penR
    );

    const pickMat = i % 5 === 0 ? cyanStarMat : i % 2 === 0 ? whiteGoldMat : goldStarMat;
    const m = new THREE.Mesh(starDotGeo, pickMat);
    const sc = isHead || isTorso ? (0.85 + rand() * 0.85) : (0.68 + rand() * 0.78);
    m.scale.setScalar(sc);
    runnerGroup.add(m);
    bodyStars.push({ mesh: m, boneIdx, tBone, localOff, scatterPos, penLocal, sc, delay: rand() * 0.12, swirlPhase: rand() * 6.28 });
  }

  // === 3. S25B LUMINOUS CALLIGRAPHIC "Sign" IN MID-AIR + STARDUST FOUNTAIN PEN ===
  const signCurve = createCursiveSignCurve();
  const SIGN_SEGS = 220;
  const signTubeGeo = new THREE.TubeGeometry(signCurve, SIGN_SEGS, 0.038, 10, false);
  const signHaloGeo = new THREE.TubeGeometry(signCurve, SIGN_SEGS, 0.068, 10, false);
  const signCoreMat = createCelMaterial({
    color: 0xfff6d4, emissive: 0xffc64a, emissiveStrength: 1.55,
    unlit: true, noInk: true
  });
  const signHaloMat = createCelMaterial({
    color: 0xffbe42, emissive: 0xff9820, emissiveStrength: 1.05,
    unlit: true, noInk: true, transparent: true, opacity: 0.20,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const signCoreMesh = new THREE.Mesh(signTubeGeo, signCoreMat);
  const signHaloMesh = new THREE.Mesh(signHaloGeo, signHaloMat);
  const signTotalIdx = signTubeGeo.index.count;
  signTubeGeo.setDrawRange(0, 0);
  signHaloGeo.setDrawRange(0, 0);
  scene.add(signCoreMesh, signHaloMesh);

  // Subtle glowing dot above the cursive "i" in "Sign" (pops right as the pen finishes!)
  const iDotMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.082, 1), signCoreMat);
  iDotMesh.position.set(4.2 - 1.50, 2.45 + 0.88, 0.05);
  iDotMesh.visible = false;
  scene.add(iDotMesh);

  // Sleek translucent luminous Fountain Pen core silhouette (appears smoothly once the 420 stardust points coalesce into the pen!)
  const penGroup = new THREE.Group();
  const penBarrelMat = createCelMaterial({
    color: 0xfff0c2, emissive: 0xffb830, emissiveStrength: 1.45,
    unlit: true, noInk: true, transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const penNib = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.65, 12), penBarrelMat);
  penNib.rotation.x = Math.PI;
  penNib.position.y = 0.32;
  penGroup.add(penNib);
  const penShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.18, 2.65, 16), penBarrelMat);
  penShaft.position.y = 1.92;
  penGroup.add(penShaft);
  // Tilted calligraphic holding angle (nib at (0,0,0), barrel leaning up-right-back!)
  penGroup.rotation.set(0.28, 0.15, -0.52);
  scene.add(penGroup);

  // 48 Blazing Golden Ink-Sparks shedding off the pen nib as it writes "Sign" in mid-air!
  const inkSparks = [];
  for (let i = 0; i < 48; i++) {
    const m = new THREE.Mesh(starDotGeo, i % 3 === 0 ? cyanStarMat : goldStarMat);
    m.visible = false;
    scene.add(m);
    inkSparks.push({
      mesh: m,
      vx: (rand() - 0.5) * 2.2,
      vy: 0.4 + rand() * 1.8,
      vz: (rand() - 0.5) * 1.8,
      phase: rand()
    });
  }

  // === 4. DRUM-LOCKED FOOTSTRIKE SHOCK-RIPPLES & TRAILING STARDUST SPARKS (S25A) ===
  const rippleGeo = new THREE.RingGeometry(0.28, 0.42, 36);
  rippleGeo.rotateX(-Math.PI / 2);
  const footRipples = [0, 1, 2, 3].map((idx) => {
    const mat = createCelMaterial({
      color: idx % 2 === 0 ? 0xffe89e : 0x9cf4ff,
      emissive: idx % 2 === 0 ? 0xffb830 : 0x38d2ff,
      emissiveStrength: 3.0,
      unlit: true, noInk: true, transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
    });
    const mesh = new THREE.Mesh(rippleGeo, mat);
    scene.add(mesh);
    return { mesh, mat };
  });

  const trailGeo = new THREE.CylinderGeometry(0.016, 0.006, 1.2, 5);
  trailGeo.rotateZ(Math.PI / 2);
  const trailSparks = [];
  for (let i = 0; i < 64; i++) {
    const m = new THREE.Mesh(trailGeo, i % 2 === 0 ? goldStarMat : cyanStarMat);
    scene.add(m);
    trailSparks.push({ mesh: m, yOff: 0.25 + rand() * 3.4, zOff: (rand() - 0.5) * 1.6, speed: 10.0 + rand() * 14.0, offset: rand() * 24.0 });
  }

  const tmpPos = new THREE.Vector3();
  const tmpPenWorld = new THREE.Vector3();
  const upVec = new THREE.Vector3(0, 1, 0);

  return {
    scene,
    update(submode, u, time, camera, audio) {
      if (typeof submode === "number") {
        audio = camera; camera = time; time = u; u = submode; submode = "runner";
      }
      const bass = audio ? audio.bass : 0;
      const isSign = submode === "sign";

      if (!isSign) {
        // === S25A (214.6 - 218.3s, 3.7s): Dense Radiant Starlight Human Sprinting on 150 BPM Drums! ===
        const localT = u * 3.7;
        signCoreMesh.visible = false;
        signHaloMesh.visible = false;
        iDotMesh.visible = false;
        penGroup.visible = false;
        inkSparks.forEach((sp) => { sp.mesh.visible = false; });

        const BEAT_PERIOD = 0.40;
        const beatIndexFloat = (time - 214.50) / BEAT_PERIOD;
        const stridePhase = beatIndexFloat * Math.PI;
        computeRunnerSkeleton(stridePhase, joints);

        const formU = smoothstep(0.0, 0.22, u);
        skelLines.visible = true;
        skelMat.uniforms.uOpacity.value = formU * 0.85;
        for (let b = 0; b < bonePairs.length; b++) {
          const pA = joints[bonePairs[b][0]], pB = joints[bonePairs[b][1]];
          const i6 = b * 6;
          skelPos[i6 + 0] = pA.x; skelPos[i6 + 1] = pA.y; skelPos[i6 + 2] = pA.z;
          skelPos[i6 + 3] = pB.x; skelPos[i6 + 4] = pB.y; skelPos[i6 + 5] = pB.z;
        }
        skelGeo.attributes.position.needsUpdate = true;

        // Inner volumetric torso & head glow cores (thick, luminous presence!)
        torsoGlow.visible = formU > 0.1;
        headGlow.visible = formU > 0.1;
        auraCoreMat.uniforms.uOpacity.value = formU * (0.36 + bass * 0.14);
        torsoGlow.position.copy(joints.pelvis).lerp(joints.chest, 0.5);
        const torsoDir = joints.chest.clone().sub(joints.pelvis).normalize();
        torsoGlow.quaternion.setFromUnitVectors(upVec, torsoDir);
        headGlow.position.copy(joints.head);

        for (let i = 0; i < bodyStars.length; i++) {
          const bs = bodyStars[i];
          const pair = bonePairs[bs.boneIdx];
          tmpPos.copy(joints[pair[0]]).lerp(joints[pair[1]], bs.tBone).add(bs.localOff);
          const lockU = smoothstep(bs.delay * 0.8, bs.delay * 0.8 + 0.24, u);
          bs.mesh.position.copy(bs.scatterPos).lerp(tmpPos, lockU);
          const coalesceSwirl = Math.sin(lockU * Math.PI);
          if (coalesceSwirl > 0.005) {
            bs.mesh.position.x += Math.cos(bs.swirlPhase + localT * 3.6) * coalesceSwirl * 0.65;
            bs.mesh.position.y += Math.sin(bs.swirlPhase * 1.2 + localT * 3.2) * coalesceSwirl * 0.45;
            bs.mesh.position.z += Math.sin(bs.swirlPhase + localT * 3.0) * coalesceSwirl * 0.55;
          }
          bs.mesh.scale.setScalar(THREE.MathUtils.lerp(1.0, bs.sc * (0.95 + bass * 0.35), lockU));
        }

        // Drum-locked footstrike ripples
        const curBeat = Math.floor(beatIndexFloat);
        const fracBeat = beatIndexFloat - curBeat;
        for (let k = 0; k < footRipples.length; k++) {
          const age = fracBeat + k * 0.85;
          const fr = footRipples[k];
          const active = age >= 0 && age < 2.2 && formU > 0.25;
          fr.mesh.visible = active;
          if (active) {
            const isLeft = ((curBeat - k) % 2) === 0;
            fr.mesh.position.set(0.65 - age * 4.8, 0.04, isLeft ? -0.22 : 0.22);
            fr.mesh.scale.setScalar(0.6 + Math.pow(age, 0.72) * 4.2);
            fr.mat.uniforms.uOpacity.value = clamp((1.0 - age / 2.2) * 0.95 * formU, 0, 1);
          }
        }

        trackMesh.visible = true;
        trackMat.uniforms.uTime.value = localT;
        trackMat.uniforms.uBass.value = bass;
        trackMat.uniforms.uFade.value = smoothstep(0.0, 0.24, u);

        for (let i = 0; i < trailSparks.length; i++) {
          const ts = trailSparks[i];
          const d = (localT * ts.speed + ts.offset) % 24.0;
          ts.mesh.position.set(0.8 - d, ts.yOff, ts.zOff);
          const fade = clamp(1.0 - d / 24.0, 0, 1) * formU;
          ts.mesh.scale.set(0.6 + fade * 1.4, 1.0, 1.0);
          ts.mesh.visible = fade > 0.02;
        }

        const stepKick = Math.pow(Math.max(0, 1.0 - fracBeat * 3.2), 2.0) * 0.14 * formU;
        const sweep = smoothstep(0.0, 1.0, u);
        camera.fov = 42 + sweep * 6 + stepKick * 3.5;
        camera.position.set(-2.2 + sweep * 6.4, 2.15 - stepKick * 0.5 + sweep * 0.45, 7.8 - sweep * 0.8);
        camera.lookAt(1.8 + sweep * 2.4, 2.0 + sweep * 0.35, 0.0);
        camera.updateProjectionMatrix();
        return { sunDir: new THREE.Vector3(0.6, 0.7, 0.5), clearColor: 0x040510, shadowBounds: null };
      }

      // === S25B (218.3 - 222.5s, 4.2s): 100% SEAMLESS ONE-TAKE! ===
      // Runner's 420 stardust points burst & swirl into a Luminous Fountain Pen writing "Sign" in mid-air across the starry sky!
      const localT = u * 4.2;
      const morphU = smoothstep(0.0, 0.28, u);    // 0.00..0.28: Runner dissolves -> 420 stars swirl & coalesce into the Luminous Pen!
      const writeU = smoothstep(0.24, 0.94, u);   // 0.24..0.94: Pen sweeps across the cosmos writing calligraphic "Sign"!

      // Fade out runner skeleton, inner aura, track & foot ripples smoothly over u = 0..0.22
      const runnerFade = 1.0 - smoothstep(0.0, 0.18, u);
      skelLines.visible = runnerFade > 0.01;
      skelMat.uniforms.uOpacity.value = runnerFade * 0.85;
      torsoGlow.visible = runnerFade > 0.01;
      headGlow.visible = runnerFade > 0.01;
      auraCoreMat.uniforms.uOpacity.value = runnerFade * 0.36;
      footRipples.forEach((fr) => { fr.mesh.visible = false; });
      trailSparks.forEach((ts) => { ts.mesh.visible = false; });

      const trackFade = 1.0 - smoothstep(0.0, 0.32, u);
      trackMesh.visible = trackFade > 0.01;
      trackMat.uniforms.uTime.value = 3.7 + localT;
      trackMat.uniforms.uFade.value = trackFade;

      // Keep runner skeleton frozen at exact 218.3s stride pose as the launch point for the 420 stars!
      const endStridePhase = ((218.30 - 214.50) / 0.40) * Math.PI;
      computeRunnerSkeleton(endStridePhase, joints);

      // Position Luminous Pen nib right at the live writing tip along the cursive "Sign" curve!
      const nibPos = signCurve.getPoint(clamp(writeU, 0.0, 1.0));
      penGroup.visible = morphU > 0.35;
      penGroup.position.copy(nibPos);
      // Graceful calligraphic wrist tilt as the pen sweeps each letter
      penGroup.rotation.set(
        0.28 + Math.sin(writeU * 18.0) * 0.08,
        0.15 + Math.cos(writeU * 14.0) * 0.10,
        -0.52 + Math.sin(writeU * 12.0) * 0.12
      );
      penGroup.updateMatrixWorld();
      penBarrelMat.uniforms.uOpacity.value = smoothstep(0.22, 0.42, u) * 0.45;

      // Morph all 420 stardust particles seamlessly from the Runner's body -> swirling arc -> forming the Luminous Pen!
      const swirlArc = Math.sin(morphU * Math.PI);
      for (let i = 0; i < bodyStars.length; i++) {
        const bs = bodyStars[i];
        const pair = bonePairs[bs.boneIdx];
        tmpPos.copy(joints[pair[0]]).lerp(joints[pair[1]], bs.tBone).add(bs.localOff);
        tmpPenWorld.copy(bs.penLocal).applyMatrix4(penGroup.matrixWorld);

        const pMorph = smoothstep(bs.delay * 0.6, bs.delay * 0.6 + 0.24, u);
        bs.mesh.position.copy(tmpPos).lerp(tmpPenWorld, pMorph);
        // Dramatic mid-air stardust swirl right as the runner breaks apart into the pen!
        if (swirlArc > 0.01) {
          bs.mesh.position.x += Math.cos(bs.swirlPhase + localT * 4.0) * swirlArc * 1.45;
          bs.mesh.position.y += Math.sin(bs.swirlPhase * 1.3 + localT * 3.5) * swirlArc * 1.25;
          bs.mesh.position.z += Math.sin(bs.swirlPhase + localT * 3.0) * swirlArc * 1.15;
        }
        bs.mesh.scale.setScalar(bs.sc * (0.85 - pMorph * 0.22 + bass * 0.25));
      }

      // Draw the glowing 3D calligraphic "Sign" stroke progressively right behind the pen's nib!
      signCoreMesh.visible = writeU > 0.005;
      signHaloMesh.visible = writeU > 0.005;
      const drawCount = Math.floor(signTotalIdx * writeU);
      signTubeGeo.setDrawRange(0, drawCount);
      signHaloGeo.setDrawRange(0, drawCount);

      // Pop the glowing dot over the "i" right after the "i" stroke is written (u > 0.56)!
      const dotU = smoothstep(0.56, 0.68, u);
      iDotMesh.visible = dotU > 0.01;
      iDotMesh.scale.setScalar(dotU * (1.0 + bass * 0.35));

      // Blazing golden ink-sparks shedding off the pen nib as it writes!
      for (let i = 0; i < inkSparks.length; i++) {
        const sp = inkSparks[i];
        sp.mesh.visible = writeU > 0.02 && writeU < 0.99;
        if (sp.mesh.visible) {
          const age = (localT * 1.8 + sp.phase) % 1.0;
          sp.mesh.position.set(
            nibPos.x + sp.vx * age * 1.2,
            nibPos.y + sp.vy * age * 1.1 - age * age * 0.9,
            nibPos.z + sp.vz * age * 1.2
          );
          sp.mesh.scale.setScalar((1.0 - age) * 0.95);
        }
      }

      // Seamless Camera Handoff from S25A end (4.2, 2.6, 7.0, lookAt(4.2, 2.35, 0), fov=48)
      // Pulls back slightly & holds a regal heroic view framing the entire glowing mid-air "Sign" signature!
      const camEase = smoothstep(0.0, 1.0, u);
      camera.fov = 48 - camEase * 4;
      camera.position.set(
        4.2 + Math.sin(camEase * 0.6) * 0.8,
        2.6 + camEase * 0.3,
        7.0 + camEase * 2.8
      );
      camera.lookAt(4.2, 2.35, 0.0);
      camera.updateProjectionMatrix();

      return { sunDir: new THREE.Vector3(0.6, 0.7, 0.5), clearColor: 0x040610, shadowBounds: null };
    }
  };
}
