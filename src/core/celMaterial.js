import * as THREE from "three";

let nextAutoPartId = 1;
export function allocPartId() {
  return nextAutoPartId++;
}

export const SHARED_LIGHT_UNIFORMS = {
  uSunDir: { value: new THREE.Vector3(0.65, 0.55, 0.52).normalize() },
  uSunColor: { value: new THREE.Color(0xfff3dc) },
  uShadowTint: { value: new THREE.Color(0x5d558c) },
  uAmbientColor: { value: new THREE.Color(0x282643) },
  uShadowMap: { value: null },
  uShadowMatrix: { value: new THREE.Matrix4() },
  uShadowEnabled: { value: 0.0 },
  uTime: { value: 0.0 }
};

const VERT_COMMON = /* glsl */ `
precision highp float;

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
uniform mat4 uShadowMatrix;

in vec3 position;
in vec3 normal;
in vec2 uv;
#ifdef USE_INSTANCING
in mat4 instanceMatrix;
#endif

out vec3 vWorldPos;
out vec3 vLocalPos;
out vec3 vWorldNormal;
out vec2 vUv;
out vec4 vShadowCoord;
out float vInstanceSalt;

void main() {
  mat4 localModel = modelMatrix;
  float salt = 0.0;
  #ifdef USE_INSTANCING
    localModel = modelMatrix * instanceMatrix;
    salt = fract(float(gl_InstanceID) * 0.0719 + 0.013);
  #endif
  vLocalPos = position;
  vec4 wp = localModel * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  mat3 m3 = mat3(localModel);
  vWorldNormal = normalize(m3 * normal);
  vUv = uv;
  vShadowCoord = uShadowMatrix * wp;
  vInstanceSalt = salt;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG_CEL = /* glsl */ `
precision highp float;

layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormalId;

uniform vec3 cameraPosition;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uShadowTint;
uniform vec3 uAmbientColor;
uniform sampler2D uShadowMap;
uniform float uShadowEnabled;
uniform float uReceiveShadow;
uniform float uTime;

uniform vec3 uColor;
uniform vec3 uShadowColor;
uniform vec3 uEmissive;
uniform float uEmissiveStrength;
uniform float uPartId;
uniform float uInkMask;
uniform float uColorEdgeFlag;
uniform float uRimStrength;
uniform vec3 uRimColor;
uniform float uPatternMode;
uniform vec2 uPatternScale;
uniform float uPatternStrength;
uniform sampler2D uMap;
uniform float uUseMap;
uniform samplerCube uEnvMap;
uniform float uEnvReflect;
uniform float uOpacity;
uniform float uUnlit;
uniform float uAmbientBoost;

in vec3 vWorldPos;
in vec3 vLocalPos;
in vec3 vWorldNormal;
in vec2 vUv;
in vec4 vShadowCoord;
in float vInstanceSalt;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x),
    mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm2(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise2(p);
    p = p * 2.07 + vec2(13.1, 7.7);
    a *= 0.5;
  }
  return s;
}

float vnoise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i + vec3(0,0,0)), hash13(i + vec3(1,0,0)), f.x),
        mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x),
        mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}

float fbm3(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * vnoise3(p);
    p = p * 2.05 + vec3(5.2, 1.3, 8.7);
    a *= 0.5;
  }
  return s;
}

float sampleHardCelShadow(vec4 sc) {
  if (uShadowEnabled < 0.5 || uReceiveShadow < 0.5) return 1.0;
  vec3 proj = sc.xyz / max(sc.w, 0.0001);
  proj = proj * 0.5 + 0.5;
  if (proj.x < 0.002 || proj.x > 0.998 || proj.y < 0.002 || proj.y > 0.998 || proj.z > 0.999) {
    return 1.0;
  }
  float bias = 0.0022;
  float sum = 0.0;
  vec2 texel = vec2(1.0 / 2048.0);
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      float d = texture(uShadowMap, proj.xy + vec2(float(x), float(y)) * texel).r;
      sum += (proj.z - bias <= d) ? 1.0 : 0.0;
    }
  }
  return smoothstep(0.32, 0.68, sum / 9.0);
}

void main() {
  vec3 N = normalize(vWorldNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWorldPos);

  vec3 baseCol = uColor;
  float alpha = uOpacity;

  if (uUseMap > 0.5) {
    vec4 texel = texture(uMap, vUv);
    baseCol *= texel.rgb;
    alpha *= texel.a;
  }

  // Pattern Modes:
  // 1: Soyuz diamond quilt
  // 2: Aerospace panel seams & rivets
  // 3: Smooth organic Moebius regolith / Martian contour patches + fine stipple (ZERO blocky squares!)
  // 4: Volga airlock canvas weave
  // 5: Infinite-resolution 3D Procedural Cel Earth (continents + shelves + clouds!)
  if (uPatternMode > 0.5 && uPatternMode < 1.5) {
    vec2 q = vUv * uPatternScale;
    float d1 = abs(fract(q.x + q.y) - 0.5);
    float d2 = abs(fract(q.x - q.y) - 0.5);
    float seam = 1.0 - smoothstep(0.0, 0.045, min(d1, d2));
    baseCol *= mix(1.0, 1.0 - 0.18 * uPatternStrength, seam);
  } else if (uPatternMode > 1.5 && uPatternMode < 2.5) {
    vec2 g = fract(vUv * uPatternScale);
    float seam = (g.x < 0.022 || g.y < 0.028) ? 1.0 : 0.0;
    vec2 rv = fract(vUv * uPatternScale * 4.0) - 0.5;
    float rivet = ((g.x < 0.12 || g.x > 0.88) && length(rv) < 0.13) ? 1.0 : 0.0;
    baseCol *= 1.0 - seam * 0.15 * uPatternStrength - rivet * 0.20 * uPatternStrength;
  } else if (uPatternMode > 2.5 && uPatternMode < 3.5) {
    // Organic smooth FBM dust/sand patches + fine stipple grain
    vec2 wp = vWorldPos.xz * (uPatternScale.x * 0.045);
    float n = fbm2(wp) * 0.72 + fbm2(wp * 2.9 + 11.4) * 0.28;
    float contour = floor(n * 4.5) / 4.5;
    float fineGrain = hash12(floor(vWorldPos.xz * 85.0)) - 0.5;
    baseCol *= mix(1.0 - 0.12 * uPatternStrength, 1.0 + 0.10 * uPatternStrength, contour) + fineGrain * 0.035;
  } else if (uPatternMode > 3.5 && uPatternMode < 4.5) {
    float rib = sin(vUv.y * uPatternScale.y * 6.28318);
    baseCol *= 1.0 + 0.055 * uPatternStrength * rib;
  } else if (uPatternMode > 4.5 && uPatternMode < 5.5) {
    // Infinite-resolution 3D Procedural Earth on unit sphere direction!
    vec3 dir = normalize(vLocalPos);
    float polar = abs(dir.y);
    float h = fbm3(dir * 2.65 + vec3(1.7, 3.4, 2.1));
    float detail = fbm3(dir * 8.5 + vec3(4.2, -1.8, 5.1));
    float elev = h * 0.82 + detail * 0.18;

    vec3 deepSea = vec3(0.12, 0.42, 0.62);
    vec3 shelfSea = vec3(0.22, 0.64, 0.75);
    vec3 greenLand = vec3(0.49, 0.69, 0.45);
    vec3 ochreSteppe = vec3(0.84, 0.65, 0.45);
    vec3 highCream = vec3(0.92, 0.88, 0.79);

    if (polar > 0.84 - detail * 0.08) {
      baseCol = vec3(0.94, 0.95, 0.98);
    } else if (elev > 0.515) {
      if (elev < 0.558) baseCol = greenLand;
      else if (elev < 0.635) baseCol = ochreSteppe;
      else baseCol = highCream;
    } else if (elev > 0.472) {
      baseCol = shelfSea;
    } else {
      baseCol = deepSea;
    }

    // Swirled cel cloud islands above oceans & continents
    vec3 cCoord = dir * 3.8 + vec3(detail * 0.85, -detail * 0.45, 2.6);
    float clouds = fbm3(cCoord);
    if (clouds > 0.575 && polar < 0.86) {
      baseCol = vec3(0.96, 0.97, 0.99);
    }
  }

  // Optional 3D spherical environment reflection (Leonov's gold visor & Sputnik polished hull)
  if (uEnvReflect > 0.01) {
    vec3 R = reflect(-V, N);
    vec3 envCol = texture(uEnvMap, R).rgb;
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.0);
    vec3 goldTint = vec3(1.06, 0.94, 0.74);
    baseCol = mix(baseCol, envCol * goldTint, clamp(uEnvReflect + fresnel * 0.2, 0.0, 0.96));
  }

  vec3 finalCol = baseCol;

  if (uUnlit < 0.5) {
    float ndl = dot(N, uSunDir);
    float shadowVis = sampleHardCelShadow(vShadowCoord);
    float rawLight = min(ndl * 0.5 + 0.5, shadowVis * 0.85 + 0.15);
    if (ndl < 0.02 || shadowVis < 0.5) {
      rawLight = min(rawLight, 0.30);
    }

    vec3 coolShadow = mix(baseCol * uShadowTint * 1.18, uShadowColor, 0.42);
    vec3 midLit = baseCol * mix(vec3(1.0), uSunColor, 0.30);
    vec3 warmHi = baseCol * uSunColor * 1.12 + vec3(0.03, 0.025, 0.015);

    float shadowStep = smoothstep(0.43, 0.46, rawLight);
    float hiStep = smoothstep(0.85, 0.89, rawLight) * shadowVis;

    finalCol = mix(coolShadow, midLit, shadowStep);
    finalCol = mix(finalCol, warmHi, hiStep);
    finalCol += baseCol * (uAmbientColor * 0.22 + vec3(uAmbientBoost));

    if (uRimStrength > 0.001) {
      float rim = pow(1.0 - max(dot(N, V), 0.0), 3.2);
      float sunSide = smoothstep(-0.25, 0.45, ndl);
      finalCol += uRimColor * step(0.52, rim) * uRimStrength * (0.35 + 0.65 * sunSide);
    }
  }

  finalCol += uEmissive * uEmissiveStrength;

  gColor = vec4(finalCol, alpha);

  float pid = fract(uPartId * 0.137931 + vInstanceSalt + 0.071);
  float encodedId = (uInkMask > 0.5) ? (0.06 + pid * 0.88) : 0.0;
  if (uColorEdgeFlag > 0.5 && encodedId > 0.0) {
    encodedId = -encodedId;
  }
  gNormalId = vec4(N * 0.5 + 0.5, encodedId);
}
`;

export function createCelMaterial(opts = {}) {
  const partId = opts.partId !== undefined ? opts.partId : allocPartId();
  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT_COMMON,
    fragmentShader: FRAG_CEL,
    transparent: Boolean(opts.transparent),
    wireframe: Boolean(opts.wireframe),
    depthWrite: opts.depthWrite !== undefined ? opts.depthWrite : !opts.transparent,
    side: opts.side !== undefined ? opts.side : THREE.FrontSide,
    blending: opts.blending || THREE.NormalBlending,
    uniforms: {
      uSunDir: SHARED_LIGHT_UNIFORMS.uSunDir,
      uSunColor: SHARED_LIGHT_UNIFORMS.uSunColor,
      uShadowTint: SHARED_LIGHT_UNIFORMS.uShadowTint,
      uAmbientColor: SHARED_LIGHT_UNIFORMS.uAmbientColor,
      uShadowMap: SHARED_LIGHT_UNIFORMS.uShadowMap,
      uShadowMatrix: SHARED_LIGHT_UNIFORMS.uShadowMatrix,
      uShadowEnabled: SHARED_LIGHT_UNIFORMS.uShadowEnabled,
      uReceiveShadow: { value: opts.receiveShadow === false ? 0.0 : 1.0 },
      uTime: SHARED_LIGHT_UNIFORMS.uTime,

      uColor: { value: new THREE.Color(opts.color !== undefined ? opts.color : 0xdad6cc) },
      uShadowColor: { value: new THREE.Color(opts.shadowColor !== undefined ? opts.shadowColor : 0x575086) },
      uEmissive: { value: new THREE.Color(opts.emissive !== undefined ? opts.emissive : 0x000000) },
      uEmissiveStrength: { value: opts.emissiveStrength !== undefined ? opts.emissiveStrength : 1.0 },
      uPartId: { value: partId },
      uInkMask: { value: opts.noInk ? 0.0 : 1.0 },
      uColorEdgeFlag: { value: opts.colorEdges ? 1.0 : 0.0 },
      uRimStrength: { value: opts.rimStrength !== undefined ? opts.rimStrength : 0.14 },
      uRimColor: { value: new THREE.Color(opts.rimColor !== undefined ? opts.rimColor : 0xfff0d4) },
      uPatternMode: { value: opts.patternMode || 0.0 },
      uPatternScale: { value: opts.patternScale || new THREE.Vector2(8, 8) },
      uPatternStrength: { value: opts.patternStrength !== undefined ? opts.patternStrength : 1.0 },
      uMap: { value: opts.map || null },
      uUseMap: { value: opts.map ? 1.0 : 0.0 },
      uEnvMap: { value: opts.envMap || null },
      uEnvReflect: { value: opts.envReflect || 0.0 },
      uOpacity: { value: opts.opacity !== undefined ? opts.opacity : 1.0 },
      uUnlit: { value: opts.unlit ? 1.0 : 0.0 },
      uAmbientBoost: { value: opts.ambientBoost || 0.0 }
    }
  });
  mat.userData.isCelMaterial = true;
  mat.userData.castsShadow = opts.castShadow !== false && !opts.unlit && !opts.transparent;
  return mat;
}

const SHADOW_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
in vec3 position;
#ifdef USE_INSTANCING
in mat4 instanceMatrix;
#endif
void main() {
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
    m = modelMatrix * instanceMatrix;
  #endif
  gl_Position = projectionMatrix * viewMatrix * m * vec4(position, 1.0);
}
`;

const SHADOW_FRAG = /* glsl */ `
precision highp float;
out vec4 fragColor;
void main() {
  fragColor = vec4(gl_FragCoord.z, 0.0, 0.0, 1.0);
}
`;

export function createShadowDepthMaterial(instanced = false) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: SHADOW_VERT,
    fragmentShader: SHADOW_FRAG,
    defines: instanced ? { USE_INSTANCING: "" } : {}
  });
}
