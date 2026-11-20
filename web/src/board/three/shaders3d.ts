// WebGL1 / WebGL2 bilan mos GLSL ES 1.00 shaderlar: soya xaritasi, PBR yoritish, signal to'lqini va bloom.

export const SHADOW_VERT = `
attribute vec3 aPos;
uniform mat4 uLightVP;
varying float vDepth;
void main() {
  vec4 p = uLightVP * vec4(aPos, 1.0);
  vDepth = p.z * 0.5 + 0.5;
  gl_Position = p;
}
`;

export const SHADOW_FRAG = `
precision highp float;
varying float vDepth;
vec4 packDepth(float d) {
  vec4 enc = vec4(1.0, 255.0, 65025.0, 16581375.0) * clamp(d, 0.0, 0.99999);
  enc = fract(enc);
  enc -= enc.yzww * vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0);
  return enc;
}
void main() {
  gl_FragColor = packDepth(vDepth);
}
`;

export const MAIN_VERT = `
attribute vec3 aPos;
attribute vec3 aNorm;
attribute vec2 aUV;
attribute vec4 aCol;
attribute vec4 aMat;

uniform mat4 uVP;
uniform mat4 uLightVP;

varying vec3 vWorld;
varying vec3 vNorm;
varying vec2 vUV;
varying vec3 vCol;
varying vec4 vMat;
varying vec4 vShadowPos;

void main() {
  vWorld = aPos;
  vNorm = aNorm;
  vUV = aUV;
  vCol = aCol.rgb;
  vMat = aMat;
  vShadowPos = uLightVP * vec4(aPos, 1.0);
  gl_Position = uVP * vec4(aPos, 1.0);
}
`;

export const MAIN_FRAG = `
precision highp float;

varying vec3 vWorld;
varying vec3 vNorm;
varying vec2 vUV;
varying vec3 vCol;
varying vec4 vMat;
varying vec4 vShadowPos;

uniform sampler2D uTex;
uniform sampler2D uShadowMap;
uniform float uUseTex;
uniform float uTexAlphaDiscard;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uSkyCol;
uniform vec3 uGroundCol;
uniform vec3 uClearCol;
uniform vec3 uPulseCol;
uniform float uTime;
uniform float uMotion;
uniform float uDirect;
uniform vec2 uShadowTexel;
uniform vec3 uLightPos[8];
uniform vec3 uLightCol[8];

float unpackDepth(vec4 rgba) {
  return dot(rgba, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0));
}

float calcShadow(vec4 sp, vec3 n, vec3 l) {
  vec3 p = sp.xyz / max(sp.w, 0.0001) * 0.5 + 0.5;
  if (p.x < 0.01 || p.x > 0.99 || p.y < 0.01 || p.y > 0.99 || p.z > 0.995) return 1.0;
  float bias = max(0.0022 * (1.0 - dot(n, l)), 0.0007);
  float sum = 0.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      float d = unpackDepth(texture2D(uShadowMap, p.xy + vec2(float(x), float(y)) * uShadowTexel));
      sum += (p.z - bias <= d) ? 1.0 : 0.0;
    }
  }
  return mix(0.26, 1.0, sum / 9.0);
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec3 base = vCol;
  float outAlpha = 1.0;
  if (uUseTex > 0.5) {
    vec4 tex = texture2D(uTex, vUV);
    if (uTexAlphaDiscard > 0.5) {
      if (tex.a < 0.04) discard;
      outAlpha = tex.a;
    } else {
      base *= tex.rgb;
    }
  }

  vec3 N = normalize(vNorm);
  vec3 V = normalize(uCamPos - vWorld);
  vec3 L = normalize(uSunDir);
  vec3 H = normalize(L + V);

  float rough = clamp(vMat.x, 0.08, 1.0);
  float metal = clamp(vMat.y, 0.0, 1.0);
  float emissive = max(0.0, vMat.z);
  float pulseCoord = vMat.w;

  // Yarim sferik studiya yorug'ligi
  float hemi = N.y * 0.5 + 0.5;
  vec3 ambient = mix(uGroundCol, uSkyCol, hemi) * base * (1.0 - metal * 0.45);

  // Asosiy quyosh/lampa yorug'ligi + yumshoq soya
  float NdotL = max(dot(N, L), 0.0);
  float shadow = NdotL > 0.0 ? calcShadow(vShadowPos, N, L) : 1.0;
  float shininess = mix(140.0, 8.0, rough * rough);
  float specNorm = (shininess + 8.0) / 25.13;
  vec3 F0 = mix(vec3(0.04), base, metal);
  float fresnel = pow(1.0 - max(dot(H, V), 0.0), 4.0);
  vec3 F = F0 + (vec3(1.0) - F0) * fresnel;
  vec3 spec = F * (pow(max(dot(N, H), 0.0), shininess) * specNorm * 0.36);
  vec3 diff = base * (1.0 - metal) * 0.85;
  vec3 direct = (diff + spec) * NdotL * shadow * 1.15;

  // Kontur (rim) yorug'ligi: qirralarni ajratib ko'rsatadi
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.18;
  vec3 rimLight = uSkyCol * rim * (0.4 + metal * 0.8);

  // Yonib turgan LED va elementlardan dinamik nuqtaviy yorug'lik
  vec3 pts = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    vec3 lp = uLightPos[i] - vWorld;
    float d2 = dot(lp, lp);
    if (d2 > 1.0 && dot(uLightCol[i], uLightCol[i]) > 0.001) {
      float att = 1.0 / (1.0 + d2 * 0.00028);
      vec3 ldir = lp * inversesqrt(d2);
      float ndl = max(dot(N, ldir), 0.0);
      pts += uLightCol[i] * base * ndl * att * 0.85;
    }
  }

  // Yoniq sim bo'ylab yuguruvchi signal to'lqini
  float pulseBoost = 0.0;
  if (emissive > 0.5 && pulseCoord > 0.01 && uMotion > 0.5) {
    float wave = pow(max(0.0, sin(pulseCoord * 0.11 - uTime * 7.2)), 6.0);
    pulseBoost = wave * 0.85;
  }

  vec3 emCol = base * emissive + uPulseCol * pulseBoost;
  vec3 col = ambient + direct + rimLight + pts + emCol;

  // Uzoq masofa tumani (stol chetlari fon bilan yumshoq qo'shiladi)
  float camDist = length(uCamPos - vWorld);
  float fog = clamp((camDist - 1250.0) / 1100.0, 0.0, 1.0);
  col = mix(col, uClearCol, fog);

  if (uDirect > 0.5) {
    gl_FragColor = vec4(aces(col), outAlpha);
  } else if (uTexAlphaDiscard > 0.5) {
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), outAlpha);
  } else {
    float specPeak = max(max(spec.r, spec.g), spec.b);
    float bloom = clamp(emissive * 0.45 + pulseBoost * 0.65 + max(0.0, specPeak - 0.5) * 0.4, 0.0, 1.0);
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), bloom);
  }
}
`;

export const QUAD_VERT = `
attribute vec2 aPos;
varying vec2 vUV;
void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const EXTRACT_FRAG = `
precision mediump float;
uniform sampler2D uScene;
varying vec2 vUV;
void main() {
  vec4 c = texture2D(uScene, vUV);
  gl_FragColor = vec4(c.rgb * c.a, 1.0);
}
`;

export const BLUR_FRAG = `
precision mediump float;
uniform sampler2D uTex;
uniform vec2 uStep;
varying vec2 vUV;
void main() {
  vec3 s = texture2D(uTex, vUV).rgb * 0.227027;
  s += texture2D(uTex, vUV + uStep * 1.384615).rgb * 0.316216;
  s += texture2D(uTex, vUV - uStep * 1.384615).rgb * 0.316216;
  s += texture2D(uTex, vUV + uStep * 3.230769).rgb * 0.070270;
  s += texture2D(uTex, vUV - uStep * 3.230769).rgb * 0.070270;
  gl_FragColor = vec4(s, 1.0);
}
`;

export const COMPOSITE_FRAG = `
precision mediump float;
uniform sampler2D uScene;
uniform sampler2D uBloom;
varying vec2 vUV;

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec3 scene = texture2D(uScene, vUV).rgb;
  vec3 bloom = texture2D(uBloom, vUV).rgb;
  vec3 col = aces(scene + bloom * 0.95);
  vec2 d = vUV - 0.5;
  col *= 1.0 - dot(d, d) * 0.18;
  gl_FragColor = vec4(col, 1.0);
}
`;
