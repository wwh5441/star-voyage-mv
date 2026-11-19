import * as THREE from "three";
import { SHARED_LIGHT_UNIFORMS, createShadowDepthMaterial } from "./celMaterial.js";

const QUAD_VERT = /* glsl */ `
precision highp float;
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const BLOOM_EXTRACT_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tColor;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 outBloom;
void main() {
  vec3 c = vec3(0.0);
  c += texture(tColor, vUv + vec2(-1.0, -1.0) * uTexel).rgb;
  c += texture(tColor, vUv + vec2( 1.0, -1.0) * uTexel).rgb;
  c += texture(tColor, vUv + vec2(-1.0,  1.0) * uTexel).rgb;
  c += texture(tColor, vUv + vec2( 1.0,  1.0) * uTexel).rgb;
  c *= 0.25;
  float lum = max(max(c.r, c.g), c.b);
  float knee = smoothstep(0.88, 1.35, lum);
  outBloom = vec4(c * knee, 1.0);
}
`;

const BLOOM_BLUR_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tInput;
uniform vec2 uDir;
in vec2 vUv;
out vec4 outBlur;
void main() {
  const float w[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
  vec3 sum = texture(tInput, vUv).rgb * w[0];
  for (int i = 1; i < 5; i++) {
    vec2 off = uDir * float(i) * 1.65;
    sum += texture(tInput, vUv + off).rgb * w[i];
    sum += texture(tInput, vUv - off).rgb * w[i];
  }
  outBlur = vec4(sum, 1.0);
}
`;

const COMPOSITE_MOEBIUS_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D tColor;
uniform sampler2D tNormalId;
uniform sampler2D tDepth;
uniform sampler2D tBloom;

uniform vec2 uResolution;
uniform float uNear;
uniform float uFar;
uniform float uInkStrength;
uniform float uBloomStrength;
uniform float uTime;

in vec2 vUv;
out vec4 outFinal;

float linearizeDepth(float d) {
  float z = d * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / max(uFar + uNear - z * (uFar - uNear), 0.0001);
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec2 texel = 1.0 / uResolution;

  // Subtle organic hand-ink micro-wobble (~0.28px) so straight 3D lines breathe like French Ligne-Claire ink
  vec2 wobble = vec2(
    valueNoise(vUv * uResolution * 0.045) - 0.5,
    valueNoise(vUv * uResolution * 0.045 + 31.7) - 0.5
  ) * texel * 0.52;

  vec2 uv = clamp(vUv + wobble, texel, 1.0 - texel);

  vec4 centerCol = texture(tColor, vUv);
  vec4 centerNI = texture(tNormalId, uv);
  float rawAlpha = centerNI.a;
  float inkActive = abs(rawAlpha) > 0.001 ? 1.0 : 0.0;
  float colorEdgeActive = rawAlpha < -0.001 ? 1.0 : 0.0;
  float centerId = abs(rawAlpha);
  vec3 centerN = centerNI.rgb * 2.0 - 1.0;
  float centerDepth = linearizeDepth(texture(tDepth, uv).r);

  // Distance-attenuated ink sampling radius (crisp foreground bolts, delicate horizon lines)
  float distFactor = clamp(1.18 - 0.24 * log2(max(centerDepth * 0.12, 1.0)), 0.62, 1.22);
  vec2 stepUv = texel * distFactor;

  float maxIdDiff = 0.0;
  float depthGradX = 0.0;
  float depthGradY = 0.0;
  float normDiffAcc = 0.0;
  float colDiffAcc = 0.0;
  float anyInkNeighbor = inkActive;

  const float kx[9] = float[](-1.0, 0.0, 1.0, -2.0, 0.0, 2.0, -1.0, 0.0, 1.0);
  const float ky[9] = float[](-1.0, -2.0, -1.0, 0.0, 0.0, 0.0, 1.0, 2.0, 1.0);

  int idx = 0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 sUv = clamp(uv + vec2(float(x), float(y)) * stepUv, texel, 1.0 - texel);
      vec4 ni = texture(tNormalId, sUv);
      float nId = abs(ni.a);
      if (nId > 0.001) anyInkNeighbor = 1.0;

      if (x != 0 || y != 0) {
        maxIdDiff = max(maxIdDiff, abs(nId - centerId));
        vec3 n = ni.rgb * 2.0 - 1.0;
        normDiffAcc = max(normDiffAcc, 1.0 - clamp(dot(centerN, n), -1.0, 1.0));

        if (colorEdgeActive > 0.5 || ni.a < -0.001) {
          vec3 sc = texture(tColor, sUv).rgb;
          colDiffAcc = max(colDiffAcc, length(sc - centerCol.rgb));
        }
      }

      float ld = linearizeDepth(texture(tDepth, sUv).r);
      depthGradX += kx[idx] * ld;
      depthGradY += ky[idx] * ld;
      idx++;
    }
  }

  float relDepthEdge = length(vec2(depthGradX, depthGradY)) / max(centerDepth, 0.35);
  float idEdge = smoothstep(0.003, 0.008, maxIdDiff);
  float depthEdge = smoothstep(0.18, 0.36, relDepthEdge);
  float normalEdge = smoothstep(0.28, 0.52, normDiffAcc);
  float colorEdge = smoothstep(0.11, 0.22, colDiffAcc);

  float edge = max(max(idEdge * 0.92, depthEdge), max(normalEdge * 0.85, colorEdge * 0.80));
  edge *= anyInkNeighbor * uInkStrength;
  edge = clamp(edge, 0.0, 1.0);

  vec3 col = centerCol.rgb;

  // Moebius diagonal pen hatching inside cool-violet cel shadow zones (only on inked solid surfaces)
  if (inkActive > 0.5) {
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    // Detect cool shadow tint (blue/violet dominance + lower luminance)
    float coolBias = clamp((col.b - col.g * 0.78) * 3.2, 0.0, 1.0);
    if (lum < 0.46 && coolBias > 0.08) {
      vec2 px = vUv * uResolution;
      float wave1 = sin((px.x + px.y) * 0.92 + wobble.x * 180.0);
      float lineMask = smoothstep(-0.35, 0.15, wave1);
      float hatchAmt = smoothstep(0.46, 0.16, lum) * coolBias * 0.22;
      col *= mix(1.0, 0.74, (1.0 - lineMask) * hatchAmt * 3.4);

      if (lum < 0.24) {
        float wave2 = sin((px.x - px.y) * 0.88);
        float crossMask = smoothstep(-0.42, 0.12, wave2);
        col *= mix(1.0, 0.82, (1.0 - crossMask) * coolBias);
      }
    }
  }

  // Deep warm-indigo comic ink line (#131020)
  vec3 inkColor = vec3(0.072, 0.062, 0.125);
  col = mix(col, inkColor, edge * 0.94);

  // Add HDR Bloom (rocket ignition, searchlights, atmospheric limb, glowing dials)
  vec3 bloom = texture(tBloom, vUv).rgb;
  col += bloom * uBloomStrength;

  // Soft filmic shoulder + warm archival paper grain + subtle vignette
  col = col / (vec3(1.0) + col * 0.18);
  float grain = hash21(vUv * uResolution + fract(uTime * 7.13) * 100.0) - 0.5;
  col += grain * 0.018;

  vec2 vigUv = vUv * 2.0 - 1.0;
  float vig = 1.0 - dot(vigUv * vec2(0.55, 0.72), vigUv * vec2(0.55, 0.72)) * 0.22;
  col *= clamp(vig, 0.72, 1.0);

  // Linear -> sRGB gammaish film curve
  col = pow(max(col, vec3(0.0)), vec3(0.92));

  outFinal = vec4(col, 1.0);
}
`;

export class MoebiusPostPipeline {
  constructor(renderer, width, height) {
    this.renderer = renderer;
    this.width = width;
    this.height = height;

    // 1. Orthographic Sun Shadow Target (2048x2048 depth texture)
    this.shadowSize = 2048;
    this.shadowTarget = new THREE.WebGLRenderTarget(this.shadowSize, this.shadowSize, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType
    });
    this.shadowTarget.depthTexture = new THREE.DepthTexture(this.shadowSize, this.shadowSize, THREE.UnsignedIntType);
    this.shadowCam = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.5, 160);
    this.shadowMatStd = createShadowDepthMaterial(false);
    this.shadowMatInst = createShadowDepthMaterial(true);

    // 2. WebGL2 MRT Target (Attachment 0: HDR Color, Attachment 1: WorldNormal + PartID, DepthTexture)
    this._buildRenderTargets(width, height);

    // 3. Fullscreen Post Quad Scene
    this.quadGeo = new THREE.PlaneGeometry(2, 2);
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.bloomExtractMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: QUAD_VERT,
      fragmentShader: BLOOM_EXTRACT_FRAG,
      uniforms: {
        tColor: { value: null },
        uTexel: { value: new THREE.Vector2(1 / width, 1 / height) }
      }
    });

    this.bloomBlurMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: QUAD_VERT,
      fragmentShader: BLOOM_BLUR_FRAG,
      uniforms: {
        tInput: { value: null },
        uDir: { value: new THREE.Vector2(1 / width, 0) }
      }
    });

    this.compositeMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: QUAD_VERT,
      fragmentShader: COMPOSITE_MOEBIUS_FRAG,
      uniforms: {
        tColor: { value: null },
        tNormalId: { value: null },
        tDepth: { value: null },
        tBloom: { value: null },
        uResolution: { value: new THREE.Vector2(width, height) },
        uNear: { value: 0.1 },
        uFar: { value: 1000.0 },
        uInkStrength: { value: 1.05 },
        uBloomStrength: { value: 0.55 },
        uTime: { value: 0.0 }
      }
    });

    this.quadMesh = new THREE.Mesh(this.quadGeo, this.compositeMat);
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quadMesh);
  }

  _buildRenderTargets(w, h) {
    if (this.mrt) this.mrt.dispose();
    if (this.bloomA) this.bloomA.dispose();
    if (this.bloomB) this.bloomB.dispose();

    const rw = Math.max(2, Math.floor(w));
    const rh = Math.max(2, Math.floor(h));

    this.mrt = new THREE.WebGLRenderTarget(rw, rh, {
      count: 2,
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true
    });
    // Normal/ID attachment MUST use NearestFilter so PartID never interpolates false intermediate IDs!
    this.mrt.textures[0].minFilter = THREE.LinearFilter;
    this.mrt.textures[0].magFilter = THREE.LinearFilter;
    this.mrt.textures[1].minFilter = THREE.NearestFilter;
    this.mrt.textures[1].magFilter = THREE.NearestFilter;
    this.mrt.depthTexture = new THREE.DepthTexture(rw, rh, THREE.UnsignedIntType);
    this.mrt.depthTexture.minFilter = THREE.NearestFilter;
    this.mrt.depthTexture.magFilter = THREE.NearestFilter;

    const bw = Math.max(2, Math.floor(rw * 0.5));
    const bh = Math.max(2, Math.floor(rh * 0.5));
    this.bloomA = new THREE.WebGLRenderTarget(bw, bh, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter
    });
    this.bloomB = new THREE.WebGLRenderTarget(bw, bh, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter
    });
  }

  setSize(w, h) {
    this.width = w;
    this.height = h;
    this._buildRenderTargets(w, h);
    this.bloomExtractMat.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.compositeMat.uniforms.uResolution.value.set(w, h);
  }

  renderShadowPass(scene, sunDir, shadowBounds) {
    if (!shadowBounds) {
      SHARED_LIGHT_UNIFORMS.uShadowEnabled.value = 0.0;
      return;
    }
    const { center, radius } = shadowBounds;
    const cam = this.shadowCam;
    cam.left = -radius;
    cam.right = radius;
    cam.top = radius;
    cam.bottom = -radius;
    cam.near = 0.5;
    cam.far = radius * 4.0;
    cam.position.copy(center).addScaledVector(sunDir, radius * 2.0);
    cam.lookAt(center);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);

    SHARED_LIGHT_UNIFORMS.uShadowMatrix.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);

    const savedMaterials = [];
    scene.traverse((obj) => {
      if (obj.isMesh && (obj.visible || obj.userData.shadowCasterOnly)) {
        const casts = obj.material && obj.material.userData && obj.material.userData.castsShadow;
        savedMaterials.push({ obj, mat: obj.material, vis: obj.visible });
        if (casts) {
          obj.visible = true;
          obj.material = obj.isInstancedMesh ? this.shadowMatInst : this.shadowMatStd;
        } else {
          obj.visible = false;
        }
      }
    });

    this.renderer.setRenderTarget(this.shadowTarget);
    this.renderer.setClearColor(0xffffff, 1);
    this.renderer.clear(true, true, false);
    this.renderer.render(scene, cam);

    for (let i = 0; i < savedMaterials.length; i++) {
      const s = savedMaterials[i];
      s.obj.material = s.mat;
      s.obj.visible = s.vis;
    }

    SHARED_LIGHT_UNIFORMS.uShadowMap.value = this.shadowTarget.depthTexture;
    SHARED_LIGHT_UNIFORMS.uShadowEnabled.value = 1.0;
  }

  render(scene, camera, opts = {}) {
    const {
      time = 0,
      inkStrength = 1.05,
      bloomStrength = 0.55,
      sunDir = null,
      shadowBounds = null,
      clearColor = 0x060814
    } = opts;

    SHARED_LIGHT_UNIFORMS.uTime.value = time;
    if (sunDir) SHARED_LIGHT_UNIFORMS.uSunDir.value.copy(sunDir).normalize();

    this.renderShadowPass(scene, SHARED_LIGHT_UNIFORMS.uSunDir.value, shadowBounds);

    // 1. MRT Scene Render
    this.renderer.setRenderTarget(this.mrt);
    this.renderer.setClearColor(clearColor, 0.0);
    this.renderer.clear(true, true, false);
    this.renderer.render(scene, camera);

    // 2. Half-Res Bloom Extract + Two-Axis Gaussian Blur (2 iterations for wide soft glow)
    const bw = this.bloomA.width;
    const bh = this.bloomA.height;

    this.quadMesh.material = this.bloomExtractMat;
    this.bloomExtractMat.uniforms.tColor.value = this.mrt.textures[0];
    this.renderer.setRenderTarget(this.bloomA);
    this.renderer.render(this.quadScene, this.quadCam);

    this.quadMesh.material = this.bloomBlurMat;
    for (let i = 0; i < 2; i++) {
      this.bloomBlurMat.uniforms.tInput.value = this.bloomA.texture;
      this.bloomBlurMat.uniforms.uDir.value.set((1.0 / bw) * (i + 1), 0);
      this.renderer.setRenderTarget(this.bloomB);
      this.renderer.render(this.quadScene, this.quadCam);

      this.bloomBlurMat.uniforms.tInput.value = this.bloomB.texture;
      this.bloomBlurMat.uniforms.uDir.value.set(0, (1.0 / bh) * (i + 1));
      this.renderer.setRenderTarget(this.bloomA);
      this.renderer.render(this.quadScene, this.quadCam);
    }

    // 3. Final Moebius / Ligne-Claire Ink + Hatching + Paper Grain Composite to Screen
    this.quadMesh.material = this.compositeMat;
    this.compositeMat.uniforms.tColor.value = this.mrt.textures[0];
    this.compositeMat.uniforms.tNormalId.value = this.mrt.textures[1];
    this.compositeMat.uniforms.tDepth.value = this.mrt.depthTexture;
    this.compositeMat.uniforms.tBloom.value = this.bloomA.texture;
    this.compositeMat.uniforms.uNear.value = camera.near;
    this.compositeMat.uniforms.uFar.value = camera.far;
    this.compositeMat.uniforms.uInkStrength.value = inkStrength;
    this.compositeMat.uniforms.uBloomStrength.value = bloomStrength;
    this.compositeMat.uniforms.uTime.value = time;

    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCam);
  }
}
