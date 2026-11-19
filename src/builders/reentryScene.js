import * as THREE from "three";
import { createCelMaterial } from "../core/celMaterial.js";
import { mulberry32, clamp, smoothstep } from "../core/math.js";
import { buildStarfield, buildStarArkShip } from "./cosmicPrimitives.js";

// Aerodynamic plasma sheath geometry starting flush around the blunt circular heat-shield rim (+startX)
// and streaming smoothly backward along -X over the elongated lander like a comet tail!
function createPlasmaSheathGeometry(startX, tailX, startR, tailR, radialSegs = 48, lengthSegs = 28) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let iy = 0; iy <= lengthSegs; iy++) {
    const t = iy / lengthSegs;
    const x = startX - t * (startX - tailX);
    const r = startR + (tailR - startR) * Math.pow(t, 0.72);

    for (let ix = 0; ix <= radialSegs; ix++) {
      const u = ix / radialSegs;
      const ang = u * Math.PI * 2;
      const cy = Math.cos(ang);
      const cz = Math.sin(ang);
      positions.push(x, cy * r, cz * r);

      const nx = 0.22 * (1.0 - t);
      const nl = Math.hypot(nx, cy, cz) || 1;
      normals.push(nx / nl, cy / nl, cz / nl);
      uvs.push(u, t);
    }
  }

  const stride = radialSegs + 1;
  for (let iy = 0; iy < lengthSegs; iy++) {
    for (let ix = 0; ix < radialSegs; ix++) {
      const a = iy * stride + ix;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

// Custom GLSL3 MRT Molten Red-Orange Ablative Heat-Shield Shader
function createAblativeHeatShieldShader(shieldRadius = 1.48) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uHeat: { value: 0.0 },
      uRadius: { value: shieldRadius }
    },
    vertexShader: `
      precision highp float;
      in vec3 position;
      in vec2 uv;
      in vec3 normal;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      out vec3 vLocalPos;
      void main() {
        vLocalPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uHeat;
      uniform float uRadius;
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

      void main() {
        float r = clamp(length(vLocalPos.yz) / uRadius, 0.0, 1.0);
        float n = noise(vLocalPos.yz * 3.8 + vec2(uTime * 1.4, -uTime * 1.1));
        float n2 = noise(vLocalPos.yz * 9.5 - vec2(uTime * 2.2, uTime * 1.6));
        float blotch = n * 0.65 + n2 * 0.35;

        // Cold dark metallic/ceramic TPS base (visible right after undocking) -> molten red-orange -> white-gold rim!
        vec3 colCold = vec3(0.18, 0.19, 0.25);
        vec3 colDeepRed = vec3(0.88, 0.22, 0.05);
        vec3 colMoltenOrange = vec3(1.0, 0.48, 0.09);
        vec3 colRimGold = vec3(1.0, 0.88, 0.48);

        vec3 hotCol = mix(colDeepRed, colMoltenOrange, clamp(0.35 + blotch * 0.55 + r * 0.28, 0.0, 1.0));
        hotCol = mix(hotCol, colRimGold, smoothstep(0.76, 1.0, r) * (0.65 + 0.35 * blotch));

        vec3 finalCol = mix(colCold, hotCol * (1.05 + uHeat * 0.55), clamp(uHeat, 0.0, 1.0));
        gColor = vec4(finalCol, 1.0);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.12);
      }
    `
  });
}

// Custom GLSL3 MRT Silky Sweeping Plasma Sheath Shader
function createPlasmaSheathShader(opacityBoost = 0.72) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0.0 },
      uBoost: { value: opacityBoost }
    },
    vertexShader: `
      precision highp float;
      in vec3 position;
      in vec2 uv;
      in vec3 normal;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      uniform float uTime;
      out vec2 vUv;
      out vec3 vNormalView;
      void main() {
        vUv = uv;
        float flutter = sin(uv.y * 14.0 - uTime * 30.0 + uv.x * 12.566) * 0.06 * smoothstep(0.05, 0.85, uv.y);
        vec3 p = position + normal * flutter;
        vNormalView = normalize(mat3(modelViewMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uIntensity;
      uniform float uBoost;
      in vec2 vUv;
      in vec3 vNormalView;
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
        float ang = vUv.x * 6.283185;
        float streaks = fbm(vec2(cos(ang) * 2.2 + sin(ang) * 2.2, vUv.y * 5.5 - uTime * 11.0));
        float fine = noise(vec2(cos(ang) * 6.0, vUv.y * 14.0 - uTime * 20.0));

        float fresnel = pow(1.0 - abs(vNormalView.z), 1.35);
        float rimIgnition = smoothstep(0.0, 0.05, vUv.y);
        float tailFade = pow(smoothstep(1.0, 0.06, vUv.y), 1.42);

        float heat = clamp((1.0 - vUv.y * 0.85) + (streaks - 0.45) * 0.42 + (fine - 0.5) * 0.2, 0.0, 1.0);

        vec3 colRose = vec3(0.95, 0.30, 0.36);
        vec3 colOrange = vec3(1.0, 0.52, 0.14);
        vec3 colWhiteGold = vec3(1.0, 0.96, 0.80);

        vec3 col = mix(colRose, colOrange, smoothstep(0.15, 0.52, heat));
        col = mix(col, colWhiteGold, smoothstep(0.65, 0.92, heat));

        float shell = mix(0.14, 1.0, fresnel);
        float alpha = clamp(shell * rimIgnition * tailFade * (0.48 + streaks * 0.65) * uIntensity * uBoost, 0.0, 0.88);
        gColor = vec4(col * (0.72 + heat * 0.88) * alpha, alpha);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Soft Feathered GLSL3 Cloud Wisp Shader
function createCloudWispShader(tintHex) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(tintHex) },
      uOpacity: { value: 0.0 }
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
      uniform vec3 uColor;
      uniform float uOpacity;
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
        vec2 p = vUv * 2.0 - 1.0;
        float r2 = p.x * p.x * 1.15 + p.y * p.y * 2.2;
        float env = exp(-r2 * 3.2) * smoothstep(1.0, 0.25, length(p));
        float wisp = 0.55 + 0.45 * noise(vUv * vec2(5.5, 2.5));
        float a = clamp(env * wisp * uOpacity, 0.0, 1.0);
        gColor = vec4(uColor, a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// GLSL3 MRT Fresnel Planetary Horizon Glow Shader
function createHorizonAtmosphereMaterial() {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    uniforms: {
      uHeatTint: { value: 0.0 }
    },
    vertexShader: `
      precision highp float;
      in vec3 position;
      in vec3 normal;
      uniform mat4 modelMatrix;
      uniform mat4 viewMatrix;
      uniform mat4 projectionMatrix;
      out vec3 vWorldNormal;
      out vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform vec3 cameraPosition;
      uniform float uHeatTint;
      in vec3 vWorldNormal;
      in vec3 vWorldPos;
      layout(location = 0) out vec4 gColor;
      layout(location = 1) out vec4 gNormalId;
      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float ndv = clamp(dot(N, V), 0.0, 1.0);
        float rim = pow(1.0 - ndv, 3.2) * smoothstep(0.0, 0.16, ndv);
        vec3 col = mix(vec3(0.96, 0.48, 0.30), vec3(1.0, 0.82, 0.52), clamp(pow(1.0 - ndv, 1.8) + uHeatTint * 0.35, 0.0, 1.0));
        float a = clamp(rim * 1.4, 0.0, 1.0);
        gColor = vec4(col * a * 1.3, a);
        gNormalId = vec4(0.5, 0.5, 1.0, 0.0);
      }
    `
  });
}

// Elongated Detachable StarArk Forward Lander Module (100% consistent with BOTH StarArk's front & S13's Mars Lander!):
// - Local +X (x = +0.0..+0.4): Wide Convex Circular Ablative Heat-Shield Base (originally embedded inside StarArk's front socket!)
// - Local -X (x = 0.0..-4.9): Elongated stainless/cream cabin hull + amber bridge viewport band + pointed conical nosecone + gold needle antenna!
// When docked to StarArk: rotation.z = PI (heat-shield base tucked into StarArk, pointed nose forward!).
// After undocking & 180-deg RCS flip: rotation.z = 0 (massive circular heat-shield base leads straight into atmospheric fire, pointed nose trails safely behind!).
function buildElongatedArkLander() {
  const lander = new THREE.Group();

  const hullCream = createCelMaterial({
    color: 0xeaeef4,
    shadowColor: 0x434a6e,
    patternMode: 2,
    patternScale: new THREE.Vector2(8, 6),
    patternStrength: 0.85,
    rimStrength: 0.65,
    rimColor: 0xffb366
  });
  const trimDark = createCelMaterial({
    color: 0x262b3d,
    shadowColor: 0x121522,
    rimStrength: 0.55,
    rimColor: 0xffc675
  });
  const goldTrim = createCelMaterial({
    color: 0xe8b95c,
    shadowColor: 0x785a46,
    rimStrength: 0.55
  });
  const warmWin = createCelMaterial({
    color: 0xffe6a6,
    emissive: 0xffc65c,
    emissiveStrength: 2.0,
    unlit: true
  });
  const rcsMat = createCelMaterial({
    color: 0xdff8ff,
    emissive: 0x8ce8ff,
    emissiveStrength: 2.4,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  // 1. Wide Convex Circular Ablative Heat Shield Base at local +X (originally embedded in StarArk's docking socket!)
  // Points ordered from rim (y = 0) up to apex (y = +0.36) so LatheGeometry normals face strictly OUTWARD (+X)!
  const shieldR = 1.48;
  const shieldPts = [];
  for (let i = 14; i >= 0; i--) {
    const f = i / 14;
    const rad = f * shieldR;
    const bulge = Math.cos(f * Math.PI * 0.5) * 0.36;
    shieldPts.push(new THREE.Vector2(rad, bulge));
  }
  const shieldGeo = new THREE.LatheGeometry(shieldPts, 40);
  shieldGeo.rotateZ(-Math.PI / 2); // Bulge & front face point strictly toward +X!
  const heatShieldMat = createAblativeHeatShieldShader(shieldR);
  const heatShield = new THREE.Mesh(shieldGeo, heatShieldMat);
  heatShield.position.x = 0.02;
  lander.add(heatShield);

  // Dark retention collar rim & embedded docking ring around the heat-shield edge
  const rimCollar = new THREE.Mesh(new THREE.TorusGeometry(shieldR - 0.02, 0.075, 10, 40), trimDark);
  rimCollar.rotation.y = Math.PI / 2;
  rimCollar.position.x = 0.04;
  lander.add(rimCollar);

  // 3 Retro-Propulsion Landing Engine Plumes beneath the circular heat-shield base (+X -> points straight DOWN when upright in Stage 4, matching S13!)
  const retroGroup = new THREE.Group();
  const retroOuterMat = createCelMaterial({
    color: 0xffd26b,
    emissive: 0xff9a24,
    emissiveStrength: 1.85,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const retroCoreMat = createCelMaterial({
    color: 0xfff4c2,
    emissive: 0xffd86b,
    emissiveStrength: 2.2,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.90,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const py = Math.cos(a) * 0.48;
    const pz = Math.sin(a) * 0.48;
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.42, 4.2, 12, 1, true), retroOuterMat);
    outer.rotation.z = Math.PI / 2; // Tip points +X (downward when upright!)
    outer.position.set(2.35, py, pz);
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.22, 2.8, 10, 1, true), retroCoreMat);
    core.rotation.z = Math.PI / 2;
    core.position.set(1.65, py, pz);
    retroGroup.add(outer, core);
  }
  retroGroup.visible = false;
  lander.add(retroGroup);
  lander.userData.retroGroup = retroGroup;
  lander.userData.retroOuterMat = retroOuterMat;
  lander.userData.retroCoreMat = retroCoreMat;

  // 2. Elongated Tapered Lander Hull extending along -X (much sleeker & longer than a short return capsule!)
  const bodyPts = [
    new THREE.Vector2(1.42, 0.0),
    new THREE.Vector2(1.28, 0.45),
    new THREE.Vector2(1.06, 1.35),
    new THREE.Vector2(0.94, 2.35),
    new THREE.Vector2(0.84, 2.85)
  ];
  const bodyGeo = new THREE.LatheGeometry(bodyPts, 32);
  bodyGeo.rotateZ(Math.PI / 2); // Extends from x = 0 to x = -2.85
  lander.add(new THREE.Mesh(bodyGeo, hullCream));

  // Matching StarArk Command Bridge Glowing Amber Viewport Strip!
  const bridgeWin = new THREE.Mesh(new THREE.CylinderGeometry(0.935, 0.96, 0.22, 28), warmWin);
  bridgeWin.rotation.z = Math.PI / 2;
  bridgeWin.position.x = -2.25;
  lander.add(bridgeWin);

  // 2 Compact Stabilizer/Landing-Leg Fairing Fins folded flush against the elongated lower hull
  [-1.08, 1.08].forEach((z) => {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.16, 0.36), trimDark);
    fin.position.set(-0.85, 0, z);
    lander.add(fin);
  });

  // 3. Original StarArk Pointed Conical Nosecone + Gold Needle Antenna extending from x = -2.85 to -5.4!
  const noseCone = new THREE.Mesh(new THREE.ConeGeometry(0.84, 1.95, 28), hullCream);
  noseCone.rotation.z = Math.PI / 2; // Pointed tip toward -X
  noseCone.position.x = -3.825;
  lander.add(noseCone);

  const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 1.25, 8), goldTrim);
  needle.rotation.z = Math.PI / 2;
  needle.position.x = -5.25;
  lander.add(needle);

  // 4. RCS Attitude Flip Thruster Plumes (firing powerfully during the 180-deg flip after separation!)
  const rcsGeo = new THREE.ConeGeometry(0.14, 1.45, 10, 1, true);
  const rcsNose = new THREE.Mesh(rcsGeo, rcsMat);
  rcsNose.position.set(-3.2, 1.15, 0);
  lander.add(rcsNose);

  const rcsTail = new THREE.Mesh(rcsGeo, rcsMat);
  rcsTail.position.set(-0.35, -1.65, 0);
  rcsTail.rotation.z = Math.PI;
  lander.add(rcsTail);

  // 4 Telescopic Landing Legs concealed 100% INSIDE the lander hull during reentry -> extend OUT from inside the bay in Stage 4!
  const legPivots = [];
  for (let i = 0; i < 4; i++) {
    const legWrap = new THREE.Group();
    legWrap.rotation.x = (i * Math.PI) / 2 + Math.PI / 4;
    lander.add(legWrap);

    const legPivot = new THREE.Group();
    legPivot.position.set(-0.35, 0.55, 0); // Starts tucked INSIDE the hull bay!
    legPivot.visible = false;
    legWrap.add(legPivot);

    const strut = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.14, 0.18), trimDark);
    strut.position.set(0.85, 0, 0);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.30, 0.09, 12), hullCream);
    pad.rotation.z = Math.PI / 2;
    pad.position.set(1.76, 0, 0);
    legPivot.add(strut, pad);
    legPivots.push(legPivot);
  }

  lander.userData = { heatShieldMat, rcsMat, retroGroup, retroOuterMat, retroCoreMat, legPivots };
  return lander;
}

export function buildReentryScene() {
  const scene = new THREE.Scene();

  // Deep starry upper-stratosphere sky
  const stars = buildStarfield(1800, 320, 121212);
  scene.add(stars);

  // Stratified Atmospheric Sky Dome
  const bgCv = document.createElement("canvas");
  bgCv.width = 16; bgCv.height = 256;
  const ctx = bgCv.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0.0, "#040612");
  g.addColorStop(0.36, "#121530");
  g.addColorStop(0.60, "#46264a");
  g.addColorStop(0.82, "#b04c3e");
  g.addColorStop(1.0, "#f2a86e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 256);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(240, 32, 24),
    createCelMaterial({ color: 0xffffff, map: new THREE.CanvasTexture(bgCv), unlit: true, noInk: true, side: THREE.BackSide, depthWrite: false })
  );
  scene.add(dome);

  // Monumental Curved Martian Horizon glowing below
  const horizonGroup = new THREE.Group();
  horizonGroup.position.set(14.0, -96.5, -28.0);
  scene.add(horizonGroup);

  const horizonPlanet = new THREE.Mesh(
    new THREE.SphereGeometry(90.0, 64, 48),
    createCelMaterial({ color: 0xb8563f, shadowColor: 0x24122a, rimStrength: 0.72, rimColor: 0xffb370, receiveShadow: false })
  );
  horizonGroup.add(horizonPlanet);

  const horizonAtmoMat = createHorizonAtmosphereMaterial();
  horizonGroup.add(new THREE.Mesh(new THREE.SphereGeometry(92.4, 64, 48), horizonAtmoMat));

  // === STARARK MOTHERSHIP (Rear Centrifuge + Tanks + Engines ONLY — original forward nose/bridge hidden so our Detachable Lander IS its front!) ===
  const mothership = buildStarArkShip();
  // Hide original static nose, needle, bridge & bridgeWin (children[0..3]) so the detachable lander plugs directly into the front socket!
  for (let i = 0; i < 4; i++) {
    if (mothership.children[i]) mothership.children[i].visible = false;
  }
  mothership.scale.setScalar(1.15);

  // Open recessed docking socket collar right in front of the spinning centrifuge ring (x = +1.02)
  const socketCollarMat = createCelMaterial({ color: 0x252b3d, shadowColor: 0x111420 });
  const socketCollar = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.95, 0.45, 28), socketCollarMat);
  socketCollar.rotation.z = -Math.PI / 2;
  socketCollar.position.x = 1.02;
  mothership.add(socketCollar);

  const dockGlowMat = createCelMaterial({
    color: 0x9cf2ff,
    emissive: 0x52dcff,
    emissiveStrength: 2.5,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const dockRing = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.06, 8, 32), dockGlowMat);
  dockRing.rotation.y = Math.PI / 2;
  dockRing.position.x = 1.24;
  mothership.add(dockRing);
  scene.add(mothership);

  // Pyrotechnic Decoupling Flash Ring at the separation seam!
  const decoupleFlashMat = createCelMaterial({
    color: 0xe6fbff,
    emissive: 0x72e8ff,
    emissiveStrength: 3.0,
    unlit: true,
    noInk: true,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const decoupleRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.35, 36), decoupleFlashMat);
  decoupleRing.rotation.y = Math.PI / 2;
  scene.add(decoupleRing);

  // === UNIFIED REENTRY FLOW RIG ===
  const flowRig = new THREE.Group();
  scene.add(flowRig);

  const lander = buildElongatedArkLander();
  flowRig.add(lander);

  // 1. Silky Sweeping Plasma Sheath starting FLUSH at the circular heat-shield rim (x = +0.26) -> trailing cleanly over the elongated pointed lander!
  const sheathMatInner = createPlasmaSheathShader(0.76);
  const sheathMatOuter = createPlasmaSheathShader(0.46);

  const sheathInner = new THREE.Mesh(createPlasmaSheathGeometry(0.26, -11.5, 1.54, 2.30, 48, 24), sheathMatInner);
  flowRig.add(sheathInner);

  const sheathOuter = new THREE.Mesh(createPlasmaSheathGeometry(0.36, -21.0, 1.72, 3.65, 48, 28), sheathMatOuter);
  flowRig.add(sheathOuter);

  // 2. 120 Pure-Additive Incandescent Sparks peeling off the circular heat-shield rim along -X
  const sparkRand = mulberry32(12908);
  const sparkMatGold = createCelMaterial({
    color: 0xfff4cc, emissive: 0xffc04d, emissiveStrength: 2.8,
    unlit: true, noInk: true, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const sparkMatOrange = createCelMaterial({
    color: 0xffa852, emissive: 0xff5a18, emissiveStrength: 2.6,
    unlit: true, noInk: true, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const sparkGeo = new THREE.CylinderGeometry(0.015, 0.006, 1.0, 5);
  sparkGeo.rotateZ(Math.PI / 2);
  const sparkGroup = new THREE.Group();
  flowRig.add(sparkGroup);
  const sparks = [];
  for (let i = 0; i < 120; i++) {
    const m = new THREE.Mesh(sparkGeo, i % 2 === 0 ? sparkMatGold : sparkMatOrange);
    sparkGroup.add(m);
    sparks.push({
      mesh: m,
      ang: sparkRand() * Math.PI * 2,
      rad0: 1.44 + sparkRand() * 0.24,
      spread: 0.08 + sparkRand() * 0.16,
      speed: 22.0 + sparkRand() * 24.0,
      len: 0.65 + sparkRand() * 2.5,
      offset: sparkRand() * 26.0
    });
  }

  // 3. 28 Soft-Feathered GLSL3 Cloud Wisps streaming cleanly along -X
  const cloudRand = mulberry32(13850);
  const cloudMatWarm = createCloudWispShader(0xf5ba8a);
  const cloudMatDust = createCloudWispShader(0xc96d5e);
  const cloudGeo = new THREE.PlaneGeometry(1.0, 1.0);
  const cloudWisps = [];
  for (let i = 0; i < 28; i++) {
    const isNear = i < 12;
    const m = new THREE.Mesh(cloudGeo, isNear ? cloudMatWarm : cloudMatDust);
    const w = isNear ? (7.0 + cloudRand() * 11.0) : (14.0 + cloudRand() * 20.0);
    const h = isNear ? (1.1 + cloudRand() * 1.6) : (2.6 + cloudRand() * 3.8);
    m.scale.set(w, h, 1);
    flowRig.add(m);
    cloudWisps.push({
      mesh: m,
      yOff: -5.5 + cloudRand() * 11.0,
      zOff: isNear ? (2.2 + cloudRand() * 3.5) : (-6.0 - cloudRand() * 14.0),
      speed: isNear ? (24.0 + cloudRand() * 16.0) : (10.0 + cloudRand() * 8.0),
      phase: cloudRand() * 52.0
    });
  }

  return {
    scene,
    update(u, time, camera, audio) {
      const bass = audio ? audio.bass : 0;

      // === 4-STAGE CONTINUOUS CHOREOGRAPHY ===
      // Stage 1 (u = 0.00..0.16): Complete StarArk -> Pyrotechnic Separation! Elongated pointed-nose Lander slides forward out of docking socket!
      // Stage 2 (u = 0.16..0.36): 180-deg RCS Flip! Massive circular heat-shield base swings around to the front, pointed nose swings to the rear!
      // Stage 3 (u = 0.36..0.86): Blazing Heat-Shield-First Reentry Sprint! Molten red-orange circular base + silky comet sheath over elongated lander!
      // Stage 4 (u = 0.86..1.00): Cloud-break & upright base-down vertical alignment -> seamless cut into S13 Mars touchdown!
      const sepU = smoothstep(0.04, 0.22, u);
      const flip180U = smoothstep(0.14, 0.36, u);
      const plasmaIn = smoothstep(0.32, 0.46, u);
      const plasmaOut = 1.0 - smoothstep(0.78, 0.94, u);
      const plasmaPeak = clamp(plasmaIn * plasmaOut * 1.15, 0.0, 1.15);
      const uprightU = smoothstep(0.84, 1.0, u);

      // 1. FlowRig trajectory angle: shallow orbital (-0.14) -> classic -38 deg plunge (-0.66) -> vertical base-down (-PI/2) for S13!
      const entryDive = -0.14 - smoothstep(0.18, 0.42, u) * 0.52;
      const finalVertical = -Math.PI * 0.49;
      flowRig.rotation.z = entryDive * (1.0 - uprightU) + finalVertical * uprightU;

      const buffet = (0.036 + bass * 0.046) * plasmaPeak;
      flowRig.position.set(
        -0.8 + u * 2.4 + Math.sin(time * 46.0) * buffet,
        1.4 - u * 2.3 + Math.cos(time * 41.0) * buffet,
        -2.0
      );

      // 2. Elongated Lander 180-Degree RCS Flip:
      // At u = 0: rotation.z = +PI (heat-shield base tucked into StarArk docking socket on the left, pointed nosecone leading forward on the right!)
      // At u = 0.36+: rotation.z = 0 (heat-shield base leads straight into the atmospheric fire, pointed nosecone trails safely behind!)
      const flipEase = flip180U * flip180U * (3.0 - 2.0 * flip180U);
      lander.rotation.z = Math.PI * (1.0 - flipEase) + 0.10 * plasmaPeak + Math.sin(time * 7.2) * 0.02 * plasmaPeak;

      // RCS attitude jets fire strongly during the 180-deg flip (u = 0.13..0.37)
      const rcsBurn = Math.sin(clamp((u - 0.13) / 0.24, 0, 1) * Math.PI);
      lander.userData.rcsMat.uniforms.uOpacity.value = rcsBurn * 0.85;

      // Heat shield stays cold dark ceramic during undocking & flip, then blazes molten red-orange on atmospheric entry!
      lander.userData.heatShieldMat.uniforms.uTime.value = time;
      lander.userData.heatShieldMat.uniforms.uHeat.value = clamp(plasmaIn * (1.0 - uprightU * 0.45), 0.0, 1.0);

      // 3. StarArk Mothership starts COUPLED FLUSH right against the Lander's embedded heat-shield base,
      // then continuously drifts further & further up-left until it sails completely OFF-SCREEN (never pops out!)
      const driftLinear = clamp((u - 0.04) / 0.62, 0.0, 1.0);
      mothership.visible = driftLinear < 0.99;
      if (mothership.visible) {
        mothership.userData.habRing.rotation.x = time * 1.1;
        mothership.userData.coreOrb.rotation.y = time * 1.8;
        mothership.userData.plumes.forEach((p) => { p.scale.set(0.65, 0.45 + driftLinear * 0.55, 0.65); });

        // Exact coupled offset along initial orbital vector (-0.14 rad), accelerating smoothly out of frame!
        const baseX = flowRig.position.x - Math.cos(-0.14) * 1.48;
        const baseY = flowRig.position.y - Math.sin(-0.14) * 1.48;
        const driftX = Math.pow(driftLinear, 1.65) * 48.0;
        const driftY = Math.pow(driftLinear, 1.55) * 26.0;
        const driftZ = Math.pow(driftLinear, 1.4) * 22.0;
        mothership.position.set(baseX - driftX, baseY + driftY, flowRig.position.z - driftZ);
        mothership.rotation.set(0.06, 0.0, -0.14 + driftLinear * 0.14);
      }

      // 3B. Stage 4 Retro-Propulsion Burn + 4 Telescopic Landing Legs Extending OUT from INSIDE the Lander Bay (u = 0.84..0.99)!
      const retroBurn = smoothstep(0.85, 0.96, u);
      const legDeploy = smoothstep(0.84, 0.99, u);
      lander.userData.legPivots.forEach((lp) => {
        lp.visible = legDeploy > 0.01;
        if (lp.visible) {
          // Hinged strictly at the OUTER black collar rim (y = 1.36, x = -0.18) -> telescopes purely OUTWARD & DOWNWARD (NEVER pokes through the yellow heat shield!)
          lp.position.set(-0.18, 1.36, 0);
          lp.rotation.z = 0.86;
          lp.scale.set(legDeploy * 1.02, 0.4 + legDeploy * 0.6, 0.4 + legDeploy * 0.6);
        }
      });
      const rg = lander.userData.retroGroup;
      rg.visible = retroBurn > 0.01;
      if (rg.visible) {
        const flick = 0.88 + 0.22 * Math.sin(time * 58.0) + bass * 0.25;
        rg.scale.set(retroBurn * flick, 0.75 + retroBurn * 0.35, 0.75 + retroBurn * 0.35);
        lander.userData.retroOuterMat.uniforms.uOpacity.value = retroBurn * 0.85;
        lander.userData.retroCoreMat.uniforms.uOpacity.value = retroBurn * 0.95;
      }

      // Pyrotechnic decoupling flash ring fires right at the seam (u = 0.04..0.16)
      const flashU = clamp((u - 0.04) / 0.12, 0.0, 1.0);
      decoupleRing.visible = flashU > 0.001 && flashU < 0.99;
      if (decoupleRing.visible) {
        decoupleRing.position.set(flowRig.position.x - 0.25 - sepU * 1.2, flowRig.position.y + 0.05 + sepU * 0.6, flowRig.position.z);
        decoupleRing.scale.setScalar(0.85 + flashU * 3.6);
        decoupleFlashMat.uniforms.uOpacity.value = Math.sin(flashU * Math.PI) * 0.95;
      }

      // 4. Silky Sweeping Plasma Sheath & Sparks (ignite cleanly AFTER the 180-deg flip completes!)
      sheathInner.visible = plasmaPeak > 0.01;
      sheathOuter.visible = plasmaPeak > 0.01;
      if (sheathInner.visible) {
        sheathMatInner.uniforms.uTime.value = time;
        sheathMatInner.uniforms.uIntensity.value = plasmaPeak * (0.95 + bass * 0.22);
        sheathMatOuter.uniforms.uTime.value = time * 1.16 + 1.5;
        sheathMatOuter.uniforms.uIntensity.value = plasmaPeak * 0.90;
      }

      sparkGroup.visible = plasmaPeak > 0.05;
      if (sparkGroup.visible) {
        for (let i = 0; i < sparks.length; i++) {
          const sp = sparks[i];
          const dist = (time * sp.speed + sp.offset) % 26.0;
          const r = sp.rad0 + dist * sp.spread;
          sp.mesh.position.set(0.24 - dist, Math.cos(sp.ang) * r, Math.sin(sp.ang) * r);
          const fade = clamp(1.0 - dist / 26.0, 0.0, 1.0) * plasmaPeak;
          sp.mesh.scale.set(sp.len * (0.4 + fade * 0.9), 1.0, 1.0);
        }
      }

      // 5. Soft-Feathered Cloud Wisps fade in during atmospheric plunge
      const cloudVis = smoothstep(0.36, 0.58, u);
      cloudMatWarm.uniforms.uOpacity.value = cloudVis * 0.30;
      cloudMatDust.uniforms.uOpacity.value = cloudVis * 0.24;
      for (let i = 0; i < cloudWisps.length; i++) {
        const cw = cloudWisps[i];
        cw.mesh.visible = cloudVis > 0.01;
        if (cw.mesh.visible) {
          const x = 26.0 - ((time * cw.speed + cw.phase) % 52.0);
          cw.mesh.position.set(x, cw.yOff, cw.zOff);
        }
      }

      // Martian horizon rises smoothly below
      horizonGroup.position.y = -98.0 + u * 6.8;
      horizonPlanet.rotation.z = -u * 0.04;
      horizonAtmoMat.uniforms.uHeatTint.value = u;
      stars.visible = u < 0.88;

      // 6. Dynamic Camera:
      // - Stage 1 & 2: Slightly wider side view framing the complete StarArk -> seamless front separation -> 180-deg RCS flip!
      // - Stage 3 & 4: Sweeps to iconic front-3/4 oblique angle showcasing the blazing molten red-orange circular heat shield + elongated lander in comet flames!
      const camShake = buffet * 0.50;
      const camAngle = -0.08 + smoothstep(0.24, 0.72, u) * 0.64;
      const camDist = 11.4 - smoothstep(0.22, 0.56, u) * 3.0 + uprightU * 1.4;
      camera.position.set(
        flowRig.position.x + Math.sin(camAngle) * camDist - (1.0 - sepU) * 1.2 + Math.cos(time * 52.0) * camShake,
        flowRig.position.y + 0.6 - u * 1.3 + Math.sin(time * 48.0) * camShake,
        flowRig.position.z + Math.cos(camAngle) * camDist
      );
      camera.fov = 40 + plasmaPeak * 8;
      camera.lookAt(
        flowRig.position.x - 0.8 - (1.0 - sepU) * 0.8,
        flowRig.position.y + (1.0 - sepU) * 0.3,
        flowRig.position.z
      );
      camera.updateProjectionMatrix();

      return { sunDir: new THREE.Vector3(0.65, 0.45, 0.62), clearColor: 0x080b18, shadowBounds: null };
    }
  };
}
