/* ==========================================================================
 * HYPERBOLIA — GLSL sources
 *
 * The renderer ray-marches a cubic honeycomb of rooms that tiles 3-dimensional
 * HYPERBOLIC SPACE. Every room has six doorways and every room's six neighbours
 * are identical to itself, so the world is finite-looking and infinite at once.
 *
 * Geometry is carried in the KLEIN MODEL: H^3 is identified with all of R^3,
 * hyperbolic planes become ordinary Euclidean planes and geodesics become
 * straight lines. The lattice of rooms is therefore literally a cubic lattice
 * with spacing D = sinh(T), where T is the hyperbolic room size. Because that
 * lattice is Euclidean-periodic, the camera can be folded back near the origin
 * every frame without losing float precision.
 *
 * The hyperbolic metric is recovered on demand:
 *
 *   cosh d(a,b) = sqrt((1+|a|^2)(1+|b|^2)) - a.b        (hyperboloid model)
 *   sinh^2 d   = cosh^2 d - 1
 *   ds         = sqrt(|dk|^2 (1+|k|^2) - (k.dk)^2) / (1+|k|^2)
 *
 * so marching, lighting and fog are all done in genuine hyperbolic units.
 *
 * tools/preview.mjs is a line-for-line JS port of this fragment shader, used
 * to check the image and the geometry without a GPU. Keep the two in sync.
 * ========================================================================== */

const HYPERBOLIA_VERT = `#version 300 es
precision highp float;
void main() {
  // Fullscreen triangle from gl_VertexID — no buffers needed.
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const HYPERBOLIA_FRAG = `#version 300 es
precision highp float;

out vec4 outColor;

uniform vec2  uRes;
uniform float uTime;
uniform vec3  uRo;        // camera position, cell-LOCAL chart coords
uniform mat3  uCam;       // columns: right, up, forward (Euclidean unit, Klein)
uniform float uTanHalf;   // tan(fov/2)

uniform float uD;         // room spacing in Klein units  (D = sinh(T))
uniform float uDoor;      // doorway half-width as a fraction of C = D/2
uniform float uCurv;      // 0 = flat Euclidean lattice, 1 = hyperbolic
uniform float uFog;
uniform float uGlow;      // emissive strength
uniform float uPanel;     // wall panel detail
uniform float uPalette;   // 0 = architectural, 1 = spectral
uniform float uHead;      // carried lantern strength
uniform float uShadow;    // 0..1 soft shadow quality
uniform int   uSteps;
uniform int   uAA;        // 1 = 2x2 supersample

/* ------------------------------------------------------------------ utils */

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

// NB: named hyperAcosh, not acosh — acosh is a GLSL ES 3.0 built-in.
float hyperAcosh(float x) {
  return log(max(x, 1.0) + sqrt(max(x * x - 1.0, 0.0)));
}

/* cosh of the hyperbolic distance between two Klein points */
float coshD(vec3 a, vec3 b) {
  return sqrt((1.0 + dot(a, a)) * (1.0 + dot(b, b))) - dot(a, b);
}

/* sinh of the hyperbolic distance between two Klein points */
float sinhD(vec3 a, vec3 b) {
  float c = coshD(a, b);
  return sqrt(max(c * c - 1.0, 0.0));
}

/* ------------------------------------------------------------------- sdf */

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// Square prism punched through the cell along whichever axis it favours.
// Taking the min of the three lets the doorway appear on all six faces at once.
float sdTunnel(vec3 p, float r) {
  vec3 a = abs(p);
  float d0 = max(max(a.y, a.z) - r, a.x - 1e4);
  float d1 = max(max(a.x, a.z) - r, a.y - 1e4);
  float d2 = max(max(a.x, a.y) - r, a.z - 1e4);
  return min(d0, min(d1, d2));
}

// One cubic room with six doorways, repeated on an infinite lattice.
float map(vec3 k, out vec3 q, out vec3 cid) {
  cid = floor(k / uD + 0.5);
  q   = k - cid * uD;
  float C  = uD * 0.5;
  float dr = uDoor * C;
  return max(sdBox(q, vec3(C)), -sdTunnel(q, dr));
}

float mapD(vec3 k) { vec3 a, b; return map(k, a, b); }

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(1.0, -1.0) * (0.0007 + 0.0009 * length(p));
  return normalize(e.xyy * mapD(p + e.xyy) + e.yyx * mapD(p + e.yyx) +
                   e.yxy * mapD(p + e.yxy) + e.xxx * mapD(p + e.xxx));
}

// Euclidean chart normal -> hyperbolic (Minkowski) normal.
//
// The hyperbolic line element in this chart is ds^2 = dx^T G dx with
// G = I - x x^T / T^2, where T^2 = 1 + |x|^2. Since T^2 - |x|^2 = 1, the
// inverse is exactly G^-1 = I + x x^T. The hyperbolic normal is therefore
// G^-1 applied to the Euclidean gradient.
vec3 toHyperNormal(vec3 x, vec3 g) {
  return normalize(g + x * dot(x, g));
}

float calcAO(vec3 p, vec3 n) {
  float occ = 0.0, sca = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 0.012 + 0.13 * float(i) / 4.0;
    occ += (h - mapD(p + n * h)) * sca;
    sca *= 0.72;
  }
  return clamp(1.0 - 2.4 * occ, 0.0, 1.0);
}

// Hyperbolic length of a chart displacement in direction rd.
//
// Following the curve x(t) in the spatial chart, P(t) = (sqrt(1+|x|^2), x),
// so dP = ((x.xdot)/T, xdot) and  ds^2 = -<dP,dP> = |xdot|^2 - (x.xdot)^2/T^2.
// Hence  ds = sqrt(|dk|^2 (1+|k|^2) - (k.dk)^2) / sqrt(1+|k|^2).
float hypStep(vec3 k, vec3 rd) {
  float T = sqrt(1.0 + dot(k, k));
  return sqrt(max(dot(rd, rd) * (T * T) - pow(dot(k, rd), 2.0), 0.0)) / T;
}

float softShadow(vec3 ro, vec3 rd, float mint, float maxt) {
  float res = 1.0, t = mint;
  int n = int(8.0 + 26.0 * uShadow);
  for (int i = 0; i < 40; i++) {
    if (i >= n) break;
    float h = mapD(ro + rd * t);
    res = min(res, 10.0 * h / t);
    t += clamp(h, 0.02, 0.35);
    if (res < 0.03 || t > maxt) break;
  }
  return clamp(res, 0.0, 1.0);
}

bool march(vec3 ro, vec3 rd, out float t, out vec3 cid, out vec3 q) {
  t = 0.015; cid = vec3(0.0); q = vec3(0.0);
  for (int i = 0; i < 200; i++) {
    if (i >= uSteps) break;
    vec3 p = ro + rd * t;
    float d = map(p, q, cid);
    float eps = 0.0006 + 0.0013 * t;
    if (d < eps) return true;
    float hf = mix(1.0, hypStep(p, rd), uCurv);
    t += max(d * 0.82 / hf, eps * 0.85);
    if (t > 110.0) break;
  }
  return false;
}

/* -------------------------------------------------------------- material */

// Wall tint: near-neutral architecture with a little per-room variation.
vec3 cellTint(vec3 cid) {
  float h  = hash13(cid * 1.37 + 0.5);
  float h2 = hash13(cid * 0.71 + 9.2);
  vec3 arch = mix(vec3(0.26, 0.27, 0.31), vec3(0.46, 0.42, 0.36), h);
  arch = mix(arch, vec3(0.20, 0.28, 0.40), h2 * 0.55);
  vec3 spec = 0.55 + 0.45 * cos(6.28318 * (h + vec3(0.0, 0.33, 0.67)));
  return mix(arch, spec, uPalette);
}

// Emissive accent: a vivid hue per room, so the receding door frames read as a
// shimmering infinite lattice rather than a flat white tunnel.
vec3 cellAccent(vec3 cid) {
  float h = hash13(cid * 2.17 + 3.1);
  vec3 vivid = 0.55 + 0.45 * cos(6.28318 * (h + vec3(0.0, 0.33, 0.67)));
  return mix(vivid, vec3(1.0, 0.72, 0.42), uPalette);
}

// A thin bright line hugging the doorway edge. The argument must be the two
// IN-PLANE coordinates of the face — the third component is pinned at C and
// would otherwise swamp the max().
float frameRing(vec2 v, float dr, float C) {
  float mx = max(abs(v.x), abs(v.y));
  float w = 0.05 * C;
  return smoothstep(w, 0.0, abs(mx - (dr + w * 1.1)));
}

/* ----------------------------------------------------------------- shade */

vec3 shade(vec3 ro, vec3 rd, float t, vec3 cid, vec3 q, out float outDist) {
  vec3 p = ro + rd * t;

  outDist = coshD(p, ro);
  if (uCurv < 0.5) outDist = length(p - ro);

  float C = uD * 0.5;
  float dr = uDoor * C;

  vec3 nE = calcNormal(p);                 // Euclidean (Klein) normal
  vec3 n  = toHyperNormal(p, nE);          // hyperbolic normal
  vec3 v  = normalize(ro - p);             // surface -> eye

  /* ---- which face are we on? ---- */
  vec3 a     = abs(q);
  vec3 dFace = C - a;                      // distance to each of the 6 planes
  float dmin = min(dFace.x, min(dFace.y, dFace.z));
  bool onY   = dFace.y <= dmin + 1e-6;
  bool onX   = dFace.x <= dmin + 1e-6;
  bool onFloor = onY && a.y >= a.x && a.y >= a.z;
  bool onCeil  = onY && !onFloor;

  /* ---- surface detail ---- */
  vec2 uv = onX ? q.yz : (onY ? q.xz : q.xy);

  // Recessed panel grid.
  float pc = C * 0.5;
  vec2 g = abs(fract(uv / pc + 0.5) - 0.5) * pc;
  float seam = 1.0 - smoothstep(0.008 * C, 0.030 * C, min(g.x, g.y));

  // Rivet grid.
  float rc = C * 0.25;
  float rivet = smoothstep(0.055 * C, 0.02 * C,
      length(abs(fract(uv / rc + 0.5) - 0.5) * rc) - 0.008 * C) * 0.5;

  // Dado: the lower band of each wall is a darker plinth.
  float wallV = onX ? q.y : q.z;
  float plinth = smoothstep(0.26 * C, 0.32 * C, abs(wallV) + 0.16 * C);
  float dado = (onFloor || onCeil) ? 1.0 : plinth;

  vec3 tint = cellTint(cid);
  float matMul = onFloor ? 0.62 : (onCeil ? 0.92 : 1.0);
  vec3 albedo = tint * matMul;
  albedo *= 0.62 + 0.38 * rivet;
  albedo *= 1.0 - 0.5 * seam * uPanel;
  albedo *= mix(0.42, 1.0, dado);

  /* ---- emissive: corner filaments + doorway frames ---- */
  float edgeD = min(max(dFace.x, dFace.y), min(max(dFace.x, dFace.z),
                                             max(dFace.y, dFace.z)));
  float fil = smoothstep(0.09 * C + 0.002, 0.0, edgeD);

  float fr = 0.0;
  if (onX) fr = max(fr, frameRing(q.yz, dr, C));
  if (onY) fr = max(fr, frameRing(q.xz, dr, C));
  if (!onX && !onY) fr = max(fr, frameRing(q.xy, dr, C));

  vec3 emit = cellAccent(cid);
  vec3 glow = emit * (fil * 0.34 + fr * 1.05) * uGlow;

  /* ---- room lamp at the cell centre ---- */
  vec3 lp = cid * uD;
  float shL = sinhD(p, lp);
  float attL = 1.0 / (1.0 + 2.6 * shL * shL);
  vec3 l = normalize(lp - p);              // surface -> lamp

  float lam = max(dot(n, l), 0.0);
  lam = lam * lam * (3.0 - 2.0 * lam);     // soft wrap
  float baseLight = mix(1.0, 0.55 + 0.45 * hash13(cid * 3.1), uPalette);

  vec3 col = albedo * tint * lam * attL * 2.5 * baseLight;
  col += vec3(1.0, 0.93, 0.82) * pow(max(dot(n, normalize(l - v)), 0.0), 42.0) * attL * 1.4;

  if (uShadow > 0.01) {
    float s = softShadow(p + nE * 0.01, l, 0.02, min(shL * 0.85, 6.0));
    col *= mix(1.0, s, uShadow);
  }

  /* ---- carried lantern ---- */
  float shH = sinhD(p, ro);
  float attH = 1.0 / (1.0 + 3.2 * shH * shH);
  vec3 hl = normalize(ro - p);             // surface -> lantern
  float lamH = max(dot(n, hl), 0.0);
  lamH = lamH * lamH * (3.0 - 2.0 * lamH);
  col += albedo * vec3(1.0, 0.72, 0.45) * lamH * attH * uHead * 1.1;
  col += vec3(1.0, 0.75, 0.50) * pow(max(dot(n, normalize(hl - v)), 0.0), 60.0) * attH * uHead;

  /* ---- ambient ---- */
  float ao = calcAO(p, n);
  col += albedo * vec3(0.042, 0.052, 0.078) * ao;
  col *= mix(0.45, 1.0, ao);
  col += glow * ao;

  /* ---- fog, measured in hyperbolic distance ---- */
  float fogD = mix(length(p - ro), outDist, uCurv);
  float f = 1.0 - exp(-fogD * uFog);
  // Luminous haze rather than black: the vanishing point should glow.
  col = mix(col, vec3(0.012, 0.028, 0.055), clamp(f, 0.0, 1.0));

  return col;
}

/* ------------------------------------------------------------------ main */

vec3 render(vec3 ro, vec3 rd) {
  float t; vec3 cid, q;
  if (!march(ro, rd, t, cid, q)) {
    // Escaped to the ideal boundary: a cold, unreachable infinity.
    float s = clamp(rd.y * 0.5 + 0.5, 0.0, 1.0);
    return mix(vec3(0.004, 0.005, 0.010), vec3(0.015, 0.020, 0.040), s);
  }
  float d;
  return shade(ro, rd, t, cid, q, d);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;

  vec3 fwd   = uCam[2];
  vec3 right = uCam[0];
  vec3 up    = uCam[1];
  vec3 rd = normalize(fwd + uTanHalf * (uv.x * right + uv.y * up));

  vec3 col;
  if (uAA == 1) {
    vec2 e = vec2(0.5 / uRes.y);
    col  = render(uRo, normalize(rd + right * e.x));
    col += render(uRo, normalize(rd - right * e.x));
    col += render(uRo, normalize(rd + up * e.y));
    col += render(uRo, normalize(rd - up * e.y));
    col *= 0.25;
  } else {
    col = render(uRo, rd);
  }

  // Filmic tone map.
  col = col * 1.05;
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));

  // Ordered dither to kill 8-bit banding in the deep corridors.
  col += (hash13(vec3(gl_FragCoord.xy, uTime * 60.0)) - 0.5) / 255.0;

  // Subtle vignette.
  vec2 vg = gl_FragCoord.xy / uRes;
  col *= 0.55 + 0.45 * pow(16.0 * vg.x * vg.y * (1.0 - vg.x) * (1.0 - vg.y), 0.22);

  outColor = vec4(col, 1.0);
}`;

/* Classic scripts need a global. */
if (typeof module !== 'undefined') {
  module.exports = { HYPERBOLIA_VERT, HYPERBOLIA_FRAG };
}
