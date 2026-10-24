/**
 * EVENT HORIZON — real-time Schwarzschild geodesic raytracer.
 *
 * One fragment shader integrates a photon path per pixel:
 *
 *     a = -3/2 * h^2 * r / |r|^5          (h = |r x v|, conserved)
 *
 * which is the Cartesian form of the null-geodesic equation
 * d^2u/dphi^2 + u = 3/2 * rs * u^2 for a non-rotating black hole.
 * The accretion disk is sampled whenever a ray crosses the equatorial
 * plane, with Doppler beaming and gravitational redshift applied.
 *
 * Rendering: HDR scene -> progressive supersampling (when still) -> bright
 * pass -> 4x separable blur -> ACES. Resolution adapts to hold ~60fps.
 * No dependencies, no build step.
 */
(() => {
  "use strict";

  // ------------------------------------------------------------------ setup

  const canvas = document.getElementById("stage");
  const boot = document.getElementById("boot");
  const bootMsg = document.getElementById("bootMsg");
  const toastEl = document.getElementById("toast");
  const panel = document.getElementById("panel");

  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  function fatal(message) {
    boot.classList.remove("is-hidden");
    boot.classList.add("is-error");
    bootMsg.textContent = message;
  }

  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
  });

  if (!gl) {
    fatal("This demo needs WebGL2 — try a recent Chrome, Firefox or Safari.");
    return;
  }

  const HDR = !!gl.getExtension("EXT_color_buffer_float");
  const MAX_TEX_SIZE = gl.getParameter(gl.MAX_TEXTURE_SIZE);

  // ------------------------------------------------------------------ shaders

  const VERT = `#version 300 es
  void main() {
    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }`;

  const SCENE_FRAG = `#version 300 es
  precision highp float;
  precision highp int;

  out vec4 fragColor;

  uniform vec2  uRes;
  uniform float uTime;
  uniform vec3  uCamPos;
  uniform vec3  uCamRight;
  uniform vec3  uCamUp;
  uniform vec3  uCamFwd;
  uniform float uTanHalfFov;
  uniform vec2  uJitter;

  uniform int   uSteps;
  uniform float uGravity;
  uniform float uDiskOn;
  uniform float uDiskBright;
  uniform float uTemp;
  uniform float uBeaming;
  uniform float uStars;
  uniform float uSpin;

  const float RS       = 1.0;
  const float DISK_IN  = 3.0;    // ISCO for Schwarzschild
  const float DISK_OUT = 12.5;
  const int   MAX_STEPS = 520;

  // ------------------------------------------------------------- hashing

  float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
  }

  float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash13(i);
    float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
    return mix(
      mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
      mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
      f.z
    );
  }

  float fbm3(vec3 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 3; i++) {
      sum += amp * vnoise(p);
      p = p * 2.03 + vec3(11.3, 7.7, 5.1);
      amp *= 0.5;
    }
    return sum;
  }

  float fbm4(vec3 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += amp * vnoise(p);
      p = p * 2.03 + vec3(11.3, 7.7, 5.1);
      amp *= 0.5;
    }
    return sum;
  }

  // Planck locus approximation (Tanner Helland), normalised 0..1.
  vec3 blackbody(float kelvin) {
    float t = clamp(kelvin, 1000.0, 40000.0) / 100.0;
    float r, g, b;
    if (t <= 66.0) {
      r = 255.0;
      g = 99.4708025861 * log(t) - 161.1195681661;
      b = t <= 19.0 ? 0.0 : 138.5177312231 * log(t - 10.0) - 305.0447927307;
    } else {
      r = 329.698727446 * pow(t - 60.0, -0.1332047592);
      g = 288.1221695283 * pow(t - 60.0, -0.0755148492);
      b = 255.0;
    }
    return clamp(vec3(r, g, b) / 255.0, 0.0, 1.0);
  }

  // ------------------------------------------------------------- physics

  vec3 accel(vec3 p, float h2) {
    float r2 = max(dot(p, p), 1e-6);
    float r = sqrt(r2);
    return -1.5 * uGravity * h2 * p / (r2 * r2 * r);
  }

  vec3 diskEmission(vec3 hit, vec3 rayDir, out float alpha) {
    // A hair of per-pixel radial jitter breaks up the dashed aliasing that
    // appears when the photon ring compresses the disk texture.
    float jitter = (hash13(vec3(gl_FragCoord.xy, 3.0)) - 0.5) * 0.05;
    float r = length(hit.xz) + jitter;
    float edge = smoothstep(DISK_IN * 0.96, DISK_IN * 1.16, r) *
                 (1.0 - smoothstep(DISK_OUT * 0.86, DISK_OUT, r));
    if (edge <= 0.001) {
      alpha = 0.0;
      return vec3(0.0);
    }

    // Differential rotation shears the pattern into spiral filaments.
    float omega = 0.7071 * uSpin * pow(max(r, 1.8), -1.5);
    float ang = atan(hit.z, hit.x) + omega * uTime;
    float ca = cos(ang);
    float sa = sin(ang);

    // A slow angular warp keeps the rings from looking like perfect contours.
    float warp = fbm3(vec3(ca * 1.6, sa * 1.6, 4.0));
    float lr = log(max(r, 0.001)) + (warp - 0.5) * 0.55;

    // Noise is sampled on a cylinder (angle, log radius): fine in radius and
    // coarse around the orbit, so it reads as sheared filaments instead of
    // isotropic cloud. cos/sin keep the pattern seamless across +/-pi.
    float n1 = fbm3(vec3(ca * 2.5, sa * 2.5, lr * 8.0));
    float n2 = fbm3(vec3(ca * 7.0, sa * 7.0, lr * 20.0));
    float n3 = fbm3(vec3(ca * 18.0, sa * 18.0, lr * 42.0));
    float base = 0.45 * n1 + 0.35 * n2 + 0.20 * n3;

    // Azimuthal streaks on top of the filaments.
    float streakA = 0.5 + 0.5 * sin(ang * 31.0 + r * 1.3 + n1 * 9.0);
    float streakB = 0.5 + 0.5 * sin(ang * 47.0 - r * 0.7 + n2 * 6.0);
    float filaments = 0.6 + 0.4 * (0.55 * streakA + 0.45 * streakB);

    // Higher contrast and a lower floor: dust lanes should be able to go thin
    // enough that the far side of the disk shows through.
    float n = smoothstep(0.32, 0.72, base);
    float dens = clamp(edge * (0.14 + 1.42 * n) * filaments, 0.0, 1.2);
    // Keep the very inner edge smooth; it is where the photon ring is imaged.
    dens = mix(edge * 0.85, dens, smoothstep(DISK_IN, DISK_IN * 1.35, r));
    // A soft inner rim: sharp enough to read as the ISCO, with a little width
    // so the bright edge does not collapse into a single-pixel fringe.
    float rimX = (r - DISK_IN) / (DISK_IN * 0.3);
    float rim = exp(-rimX * rimX);
    dens = clamp(dens + rim * edge * 0.55, 0.0, 1.5);

    // Temperature falls off as r^-3/4; hotter, whiter inside.
    float T = uTemp * pow(DISK_IN / max(r, DISK_IN), 0.75);

    // Keplerian orbital velocity, in units of c.
    vec3 vdir = normalize(cross(vec3(0.0, 1.0, 0.0), hit));
    float beta = min(0.62, sqrt(0.5 / max(r, 1.6)));
    vec3 toObserver = -normalize(rayDir);
    float gamma = inversesqrt(max(1e-3, 1.0 - beta * beta));
    float doppler = 1.0 / (gamma * (1.0 - beta * dot(vdir, toObserver)));

    // Gravitational redshift for light climbing out of the well.
    float grav = sqrt(max(0.02, 1.0 - RS / max(r, RS * 1.01)));
    float g = mix(1.0, doppler * grav, uBeaming);
    g = clamp(g, 0.15, 3.5);

    float Tobs = T * g;
    vec3 tint = blackbody(Tobs);

    // Emissivity falls steeply with radius so the inner disk dominates and
    // the outer disk fades into the bloom instead of fogging the frame.
    float radial = 0.35 + 1.1 * pow(DISK_IN / max(r, DISK_IN), 1.1);
    float lum = uDiskBright * dens * 0.52 * pow(g, 3.0) * radial;

    alpha = clamp(dens * 0.95, 0.0, 0.98);
    return tint * lum;
  }

  vec3 background(vec3 d) {
    vec3 col = vec3(0.0);

    // Three star layers on a cubic lattice over the sky sphere.
    for (int k = 0; k < 3; k++) {
      float N = 115.0 + 95.0 * float(k);
      vec3 p = d * N;
      vec3 cell = floor(p);
      vec3 f = p - cell;
      float h = hash13(cell + float(k) * 19.7);

      if (h > 0.976) {
        vec3 jitter = vec3(
          hash13(cell + 1.7),
          hash13(cell + 3.3),
          hash13(cell + 7.9)
        );
        float dist = length(f - (0.15 + 0.7 * jitter));
        float bright = smoothstep(0.105, 0.0, dist);
        float twinkle = 0.55 + 0.45 * hash13(cell + 12.3);
        vec3 tint = mix(
          vec3(1.0, 0.72, 0.48),
          vec3(0.62, 0.78, 1.0),
          hash13(cell + 21.1)
        );
        col += tint * bright * twinkle * (1.7 - 0.38 * float(k));
      }
    }

    // Faint galactic band + dust.
    float bandY = d.y * 4.2;
    float band = exp(-bandY * bandY);
    float neb = fbm4(d * 3.4 + 7.0);
    neb = pow(max(neb - 0.34, 0.0), 1.7) * 2.4;
    vec3 nebCol = mix(
      vec3(0.10, 0.17, 0.38),
      vec3(0.42, 0.16, 0.30),
      fbm3(d * 1.7 + 3.0)
    );
    col += nebCol * neb * band * 0.16;
    col += vec3(0.045, 0.07, 0.13) * band * 0.18;

    return col;
  }

  // ----------------------------------------------------------------- main

  void main() {
    // uJitter is a sub-pixel offset in pixels; accumulating several jittered
    // frames supersamples the thin photon ring instead of leaving it dotted.
    vec2 uv = (2.0 * gl_FragCoord.xy + 2.0 * uJitter - uRes) / uRes.y;
    vec3 rd = normalize(
      uCamFwd + uCamRight * uv.x * uTanHalfFov + uCamUp * uv.y * uTanHalfFov
    );

    vec3 pos = uCamPos;
    vec3 dir = rd;

    vec3 hvec = cross(pos, dir);
    float h2 = dot(hvec, hvec);
    vec3 acc = accel(pos, h2);

    vec3 col = vec3(0.0);
    float trans = 1.0;
    bool escaped = false;

    for (int i = 0; i < MAX_STEPS; i++) {
      if (i >= uSteps) break;

      float r2 = dot(pos, pos);
      // Crossing the horizon ends the ray: nothing behind it is visible.
      if (r2 < RS * RS) break;
      if (r2 > 70.0 * 70.0 && dot(pos, dir) > 0.0) {
        escaped = true;
        break;
      }

      float r = sqrt(r2);
      // Step proportional to the radius: fine near the horizon, coarse far
      // away where the acceleration has died off. Without the growth, rays
      // travelling outward would exhaust the step budget before reaching the
      // escape radius and the sky would go black.
      float dl = max(0.006, 0.05 * r);
      // Rays near the critical impact parameter b = 3*sqrt(3)/2 wind around
      // the photon sphere; they form the thin ring, and a coarse step puts
      // the plane crossing on the wrong side of the caustic. Refine only them.
      if (abs(sqrt(h2) - 2.5980762) < 0.45) dl *= 0.45;

      // Velocity Verlet on the photon geodesic.
      vec3 npos = pos + dir * dl + 0.5 * acc * dl * dl;
      vec3 nacc = accel(npos, h2);
      dir += 0.5 * (acc + nacc) * dl;
      acc = nacc;

      // Crossed the equatorial plane? Interpolate the crossing point.
      if (uDiskOn > 0.5 && pos.y * npos.y < 0.0) {
        float t = pos.y / (pos.y - npos.y);
        vec3 hit = mix(pos, npos, t);
        float rr = length(hit.xz);
        if (rr > DISK_IN && rr < DISK_OUT) {
          float alpha;
          vec3 emission = diskEmission(hit, dir, alpha);
          col += trans * emission;
          trans *= 1.0 - alpha;
          if (trans < 0.01) break;
        }
      }

      pos = npos;
    }

    // Rays that run out of steps are the ones trapped in the strong field.
    // Treat them as captured: sampling the sky here would sprinkle stars
    // through the shadow and dash up the photon ring.
    if (escaped) {
      col += trans * background(normalize(dir)) * uStars;
    }

    fragColor = vec4(col, 1.0);
  }`;

  const BRIGHT_FRAG = `#version 300 es
  precision highp float;
  out vec4 fragColor;

  uniform sampler2D uSrc;
  uniform vec2 uTexel;
  uniform float uThreshold;

  void main() {
    vec2 uv = gl_FragCoord.xy * uTexel;
    vec3 c = texture(uSrc, uv).rgb;
    float l = max(c.r, max(c.g, c.b));
    float k = smoothstep(uThreshold, uThreshold + 1.2, l);
    fragColor = vec4(c * k, 1.0);
  }`;

  const BLUR_FRAG = `#version 300 es
  precision highp float;
  out vec4 fragColor;

  uniform sampler2D uSrc;
  uniform vec2 uTexel;
  uniform vec2 uDir;

  void main() {
    vec2 uv = gl_FragCoord.xy * uTexel;
    vec2 o = uDir * uTexel;
    vec3 c = texture(uSrc, uv).rgb * 0.2270270270;
    c += texture(uSrc, uv + o * 1.3846153846).rgb * 0.3162162162;
    c += texture(uSrc, uv - o * 1.3846153846).rgb * 0.3162162162;
    c += texture(uSrc, uv + o * 3.2307692308).rgb * 0.0702702703;
    c += texture(uSrc, uv - o * 3.2307692308).rgb * 0.0702702703;
    fragColor = vec4(c, 1.0);
  }`;

  const ACCUM_FRAG = `#version 300 es
  precision highp float;
  out vec4 fragColor;

  uniform sampler2D uPrev;
  uniform sampler2D uCur;
  uniform vec2  uTexel;
  uniform float uWeight;

  void main() {
    vec2 uv = gl_FragCoord.xy * uTexel;
    vec3 prev = texture(uPrev, uv).rgb;
    vec3 cur  = texture(uCur,  uv).rgb;
    fragColor = vec4(mix(prev, cur, uWeight), 1.0);
  }`;

  const COMPOSITE_FRAG = `#version 300 es
  precision highp float;
  out vec4 fragColor;

  uniform sampler2D uScene;
  uniform sampler2D uBloom;
  uniform vec2 uRes;
  uniform float uExposure;
  uniform float uBloomStrength;
  uniform float uTime;

  vec3 aces(vec3 x) {
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 d = uv - 0.5;

    // A touch of lens-like chromatic aberration toward the corners.
    float ca = 0.0016 * dot(d, d);
    vec3 scene;
    scene.r = texture(uScene, uv + d * ca).r;
    scene.g = texture(uScene, uv).g;
    scene.b = texture(uScene, uv - d * ca).b;

    vec3 bloom = texture(uBloom, uv).rgb;
    vec3 col = scene + bloom * uBloomStrength;

    // A little extra chroma keeps the disk's heat gradient readable.
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(luma), col, 1.16);

    col = aces(col * uExposure);

    // Vignette
    float v = length(d * vec2(uRes.x / uRes.y, 1.0));
    col *= mix(0.68, 1.0, smoothstep(1.15, 0.28, v));

    // Gamma + dither
    col = pow(max(col, 0.0), vec3(1.0 / 2.2));
    col += (hash12(gl_FragCoord.xy + uTime) - 0.5) / 255.0;

    fragColor = vec4(col, 1.0);
  }`;

  // ------------------------------------------------------------------ gl help

  function compile(type, source, label) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      console.error(`${label} shader failed:\n${log}`);
      throw new Error(`${label} shader failed: ${log}`);
    }
    return sh;
  }

  function program(fragSource, label) {
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT, `${label} vertex`));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragSource, label));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`${label} link failed: ${gl.getProgramInfoLog(prog)}`);
    }
    return prog;
  }

  function uniformMap(prog, names) {
    const map = {};
    for (const name of names) map[name] = gl.getUniformLocation(prog, name);
    return map;
  }

  let sceneProg, brightProg, blurProg, accumProg, compositeProg;
  let uScene, uBright, uBlur, uAccum, uComposite;

  try {
    sceneProg = program(SCENE_FRAG, "scene");
    brightProg = program(BRIGHT_FRAG, "bright");
    blurProg = program(BLUR_FRAG, "blur");
    accumProg = program(ACCUM_FRAG, "accum");
    compositeProg = program(COMPOSITE_FRAG, "composite");
  } catch (err) {
    fatal(err.message);
    console.error(err);
    return;
  }

  uScene = uniformMap(sceneProg, [
    "uRes",
    "uTime",
    "uCamPos",
    "uCamRight",
    "uCamUp",
    "uCamFwd",
    "uTanHalfFov",
    "uJitter",
    "uSteps",
    "uGravity",
    "uDiskOn",
    "uDiskBright",
    "uTemp",
    "uBeaming",
    "uStars",
    "uSpin",
  ]);

  uBright = uniformMap(brightProg, ["uSrc", "uTexel", "uThreshold"]);
  uBlur = uniformMap(blurProg, ["uSrc", "uTexel", "uDir"]);
  uAccum = uniformMap(accumProg, ["uPrev", "uCur", "uTexel", "uWeight"]);
  uComposite = uniformMap(compositeProg, [
    "uScene",
    "uBloom",
    "uRes",
    "uExposure",
    "uBloomStrength",
    "uTime",
  ]);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  // ------------------------------------------------------------------ targets

  let hdr = HDR;

  function createTarget(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      hdr ? gl.RGBA16F : gl.RGBA8,
      w,
      h,
      0,
      gl.RGBA,
      hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0
    );

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(tex);
      if (hdr) {
        hdr = false;
        return createTarget(w, h);
      }
      return null;
    }

    return { tex, fbo, w, h };
  }

  function destroyTarget(t) {
    if (!t) return;
    gl.deleteFramebuffer(t.fbo);
    gl.deleteTexture(t.tex);
  }

  let sceneTarget = null;
  let bloomA = null;
  let bloomB = null;
  let accumA = null;
  let accumB = null;
  let targetW = 0;
  let targetH = 0;

  function ensureTargets(w, h) {
    if (sceneTarget && targetW === w && targetH === h) return;
    destroyTarget(sceneTarget);
    destroyTarget(bloomA);
    destroyTarget(bloomB);
    destroyTarget(accumA);
    destroyTarget(accumB);
    targetW = w;
    targetH = h;
    sceneTarget = createTarget(w, h);
    const bw = Math.max(1, Math.floor(w / 2));
    const bh = Math.max(1, Math.floor(h / 2));
    bloomA = createTarget(bw, bh);
    bloomB = createTarget(bw, bh);
    // Ping-pong pair for progressive supersampling; only meaningful in HDR,
    // where averaging many frames does not band.
    if (hdr && sceneTarget) {
      accumA = createTarget(w, h);
      accumB = createTarget(w, h);
    }
    samples = 0;
    accumSource = null;
  }

  function bindTexture(unit, tex, loc) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc, unit);
  }

  // ------------------------------------------------------------------ state

  const QUALITY = {
    auto: { steps: 220, adaptive: true, min: 0.45, max: 1.0 },
    low: { steps: 120, scale: 0.55 },
    medium: { steps: 200, scale: 0.75 },
    high: { steps: 320, scale: 0.9 },
    ultra: { steps: 480, scale: 1.0 },
  };

  const state = {
    gravity: 1,
    beaming: 1,
    spin: 1,
    diskBright: 1.15,
    temp: 6200,
    exposure: 1,
    bloom: 0.6,
    stars: 1,
    diskOn: true,
    autoOrbit: true,
    timeFlow: true,
    quality: "auto",
  };

  const cam = {
    theta: 0.55,
    phi: 0.16,
    radius: 18,
    fov: 50,
  };

  let renderScale = 0.8;
  let steps = QUALITY.auto.steps;
  let simTime = 0;
  let camTween = null;
  let frameCount = 0;
  let lastFrame = performance.now();
  let avgMs = 16.7;
  let fps = 60;
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (reducedMotion) {
    state.autoOrbit = false;
    $("autoOrbit").checked = false;
    camTween = null;
  }

  // Reframe the default view a little higher so the lensed arc reads clearly.
  cam.phi = 0.16;

  // ------------------------------------------------------------------ camera

  const camPos = new Float32Array(3);
  const camRight = new Float32Array(3);
  const camUp = new Float32Array(3);
  const camFwd = new Float32Array(3);

  function updateCameraVectors() {
    const cp = Math.cos(cam.phi);
    const x = cam.radius * cp * Math.sin(cam.theta);
    const y = cam.radius * Math.sin(cam.phi);
    const z = cam.radius * cp * Math.cos(cam.theta);

    camPos[0] = x;
    camPos[1] = y;
    camPos[2] = z;

    let len = Math.hypot(x, y, z) || 1;
    const fx = -x / len;
    const fy = -y / len;
    const fz = -z / len;
    camFwd[0] = fx;
    camFwd[1] = fy;
    camFwd[2] = fz;

    // right = normalize(cross(forward, worldUp))
    let rx = -fz;
    let ry = 0;
    let rz = fx;
    len = Math.hypot(rx, ry, rz) || 1;
    rx /= len;
    rz /= len;
    camRight[0] = rx;
    camRight[1] = 0;
    camRight[2] = rz;

    // up = cross(right, forward)
    camUp[0] = ry * fz - rz * fy;
    camUp[1] = rz * fx - rx * fz;
    camUp[2] = rx * fy - ry * fx;
  }

  function shortAngle(from, to) {
    let d = (to - from) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return from + d;
  }

  function tweenCamera(to, duration = 1100) {
    camTween = {
      fromTheta: cam.theta,
      toTheta: shortAngle(cam.theta, to.theta ?? cam.theta),
      fromPhi: cam.phi,
      toPhi: to.phi ?? cam.phi,
      fromRadius: cam.radius,
      toRadius: to.radius ?? cam.radius,
      t0: performance.now(),
      dur: duration,
    };
    velTheta = 0;
    velPhi = 0;
  }

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let velTheta = 0;
  let velPhi = 0;
  const pointers = new Map();
  let lastPinch = 0;

  function hideHint() {
    const hint = $("hint");
    if (hint) hint.classList.add("is-faded");
  }

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      camTween = null;
      velTheta = 0;
      velPhi = 0;
    }
    lastPinch = 0;
    hideHint();
  });

  canvas.addEventListener("pointermove", (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;

    if (pointers.size >= 2) {
      const pts = [...pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (lastPinch > 0 && dist > 0) {
        cam.radius = clamp(cam.radius * (lastPinch / dist), 4, 45);
        camTween = null;
      }
      lastPinch = dist;
      return;
    }

    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    cam.theta -= dx * 0.006;
    cam.phi = clamp(cam.phi + dy * 0.005, -1.35, 1.35);
    velTheta = -dx * 0.006;
    velPhi = dy * 0.005;
    camTween = null;
    hideHint();
  });

  function releasePointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) lastPinch = 0;
    if (pointers.size === 0) dragging = false;
  }

  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("lostpointercapture", releasePointer);

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      cam.radius = clamp(cam.radius * Math.exp(e.deltaY * 0.0012), 4, 45);
      camTween = null;
      hideHint();
    },
    { passive: false }
  );

  canvas.addEventListener("dblclick", () => {
    tweenCamera({ theta: 0.55, phi: 0.16, radius: 18 });
  });

  let camUiClock = 0;

  function updateCamera(dt) {
    if (camTween) {
      const t = clamp((performance.now() - camTween.t0) / camTween.dur, 0, 1);
      const e =
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      cam.theta = lerp(camTween.fromTheta, camTween.toTheta, e);
      cam.phi = lerp(camTween.fromPhi, camTween.toPhi, e);
      cam.radius = lerp(camTween.fromRadius, camTween.toRadius, e);
      if (t >= 1) camTween = null;
    } else {
      if (state.autoOrbit && !dragging && pointers.size === 0) {
        cam.theta += dt * 0.045;
      }
      if (!dragging && pointers.size === 0) {
        if (Math.abs(velTheta) > 1e-5 || Math.abs(velPhi) > 1e-5) {
          cam.theta += velTheta;
          cam.phi = clamp(cam.phi + velPhi, -1.35, 1.35);
          velTheta *= 0.93;
          velPhi *= 0.93;
        }
      }
    }

    cam.phi = clamp(cam.phi, -1.38, 1.38);
    cam.radius = clamp(cam.radius, 4, 45);

    updateCameraVectors();

    camUiClock += dt;
    if (camUiClock > 0.12) {
      camUiClock = 0;
      const distanceInput = $("distance");
      const inclinationInput = $("inclination");
      if (document.activeElement !== distanceInput) {
        distanceInput.value = cam.radius.toFixed(1);
      }
      if (document.activeElement !== inclinationInput) {
        inclinationInput.value = Math.round((cam.phi * 180) / Math.PI);
      }
      $("distanceOut").textContent = cam.radius.toFixed(1) + " rₛ";
      $("inclinationOut").textContent =
        Math.round((cam.phi * 180) / Math.PI) + "°";
    }
  }

  // ------------------------------------------------------------------ size

  let canvasW = 0;
  let canvasH = 0;

  function resize(dprCap = 1.5) {
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const w = Math.min(
      MAX_TEX_SIZE,
      Math.max(2, Math.round(canvas.clientWidth * dpr * renderScale))
    );
    const h = Math.min(
      MAX_TEX_SIZE,
      Math.max(2, Math.round(canvas.clientHeight * dpr * renderScale))
    );
    if (w === canvasW && h === canvasH) return;
    canvasW = w;
    canvasH = h;
    canvas.width = w;
    canvas.height = h;
    ensureTargets(w, h);
  }

  new ResizeObserver(() => {
    canvasW = 0;
  }).observe(canvas);

  // ------------------------------------------------------------------ render

  // Progressive supersampling: while the frame is static we jitter the camera
  // ray by a sub-pixel offset and average. 64 samples is 8x the linear
  // resolution — enough to turn the dotted photon ring into a clean curve.
  const MAX_SAMPLES = 64;

  let samples = 0;
  let accumSource = null;

  function radicalInverse(i, base) {
    let f = 1;
    let r = 0;
    while (i > 0) {
      f /= base;
      r += f * (i % base);
      i = Math.floor(i / base);
    }
    return r;
  }

  function resetAccum() {
    samples = 0;
    accumSource = null;
  }

  function drawScene(target, jx, jy) {
    const w = target.w;
    const h = target.h;

    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.viewport(0, 0, w, h);
    gl.useProgram(sceneProg);
    gl.bindVertexArray(vao);

    gl.uniform2f(uScene.uRes, w, h);
    gl.uniform1f(uScene.uTime, simTime);
    gl.uniform3fv(uScene.uCamPos, camPos);
    gl.uniform3fv(uScene.uCamRight, camRight);
    gl.uniform3fv(uScene.uCamUp, camUp);
    gl.uniform3fv(uScene.uCamFwd, camFwd);
    gl.uniform1f(
      uScene.uTanHalfFov,
      Math.tan(((cam.fov * Math.PI) / 180) * 0.5)
    );
    gl.uniform2f(uScene.uJitter, jx, jy);
    gl.uniform1i(uScene.uSteps, steps);
    gl.uniform1f(uScene.uGravity, state.gravity);
    gl.uniform1f(uScene.uDiskOn, state.diskOn ? 1 : 0);
    gl.uniform1f(uScene.uDiskBright, state.diskBright);
    gl.uniform1f(uScene.uTemp, state.temp);
    gl.uniform1f(uScene.uBeaming, state.beaming);
    gl.uniform1f(uScene.uStars, state.stars);
    gl.uniform1f(uScene.uSpin, state.spin);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function accumulateSample() {
    const w = sceneTarget.w;
    const h = sceneTarget.h;
    const next = accumSource === accumA ? accumB : accumA;

    gl.bindFramebuffer(gl.FRAMEBUFFER, next.fbo);
    gl.viewport(0, 0, w, h);
    gl.useProgram(accumProg);
    bindTexture(0, accumSource.tex, uAccum.uPrev);
    bindTexture(1, sceneTarget.tex, uAccum.uCur);
    gl.uniform2f(uAccum.uTexel, 1 / w, 1 / h);
    gl.uniform1f(uAccum.uWeight, 1 / samples);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    accumSource = next;
  }

  function renderBloom(source) {
    // Bright pass at half resolution.
    gl.bindFramebuffer(gl.FRAMEBUFFER, bloomA.fbo);
    gl.viewport(0, 0, bloomA.w, bloomA.h);
    gl.useProgram(brightProg);
    bindTexture(0, source.tex, uBright.uSrc);
    gl.uniform2f(uBright.uTexel, 1 / bloomA.w, 1 / bloomA.h);
    gl.uniform1f(uBright.uThreshold, hdr ? 1.0 : 0.62);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Separable gaussian blur, widening each iteration.
    gl.useProgram(blurProg);
    gl.uniform2f(uBlur.uTexel, 1 / bloomA.w, 1 / bloomA.h);
    const radii = [1.0, 2.0, 4.0, 8.0];
    for (const radius of radii) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, bloomB.fbo);
      gl.viewport(0, 0, bloomB.w, bloomB.h);
      bindTexture(0, bloomA.tex, uBlur.uSrc);
      gl.uniform2f(uBlur.uDir, radius, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, bloomA.fbo);
      gl.viewport(0, 0, bloomA.w, bloomA.h);
      bindTexture(0, bloomB.tex, uBlur.uSrc);
      gl.uniform2f(uBlur.uDir, 0, radius);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  function composite(source) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvasW, canvasH);
    gl.useProgram(compositeProg);
    bindTexture(0, source.tex, uComposite.uScene);
    bindTexture(1, bloomA.tex, uComposite.uBloom);
    gl.uniform2f(uComposite.uRes, canvasW, canvasH);
    gl.uniform1f(uComposite.uExposure, state.exposure);
    gl.uniform1f(uComposite.uBloomStrength, state.bloom);
    gl.uniform1f(uComposite.uTime, simTime);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function renderFrame(accumulateNow) {
    if (!sceneTarget) return;

    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);

    if (accumulateNow && accumA) {
      samples = Math.min(MAX_SAMPLES, samples + 1);
      const jx = radicalInverse(samples, 2) - 0.5;
      const jy = radicalInverse(samples, 3) - 0.5;

      if (samples === 1 || !accumSource) {
        // Seed the average with a fully written target; never mix against an
        // uninitialised texture.
        drawScene(accumA, jx, jy);
        accumSource = accumA;
      } else {
        drawScene(sceneTarget, jx, jy);
        accumulateSample();
      }

      renderBloom(accumSource);
      composite(accumSource);
      return;
    }

    resetAccum();
    drawScene(sceneTarget, 0, 0);
    renderBloom(sceneTarget);
    composite(sceneTarget);
  }

  function present() {
    if (!accumSource) return;
    composite(accumSource);
  }

  function downloadPng(url) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `event-horizon-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-")}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Captures are rendered at full device resolution — the on-screen canvas is
  // usually running at 45-100% of that, which would make the PNG soft.
  function capture() {
    if (!sceneTarget) return;

    const savedScale = renderScale;
    const savedSteps = steps;

    try {
      renderScale = 1;
      steps = Math.max(steps, 320);
      canvasW = 0;
      resize(2);
      resetAccum();
      drawScene(sceneTarget, 0, 0);
      renderBloom(sceneTarget);
      composite(sceneTarget);
      downloadPng(canvas.toDataURL("image/png"));
      toast(`Captured ${canvasW} × ${canvasH} → PNG`);
    } catch (err) {
      console.error(err);
      toast("Capture failed");
    } finally {
      renderScale = savedScale;
      steps = savedSteps;
      canvasW = 0;
      canvasH = 0;
      resize();
      resetAccum();
    }
  }

  // ------------------------------------------------------------------ loop

  function cameraSettled() {
    return (
      !dragging &&
      pointers.size === 0 &&
      !camTween &&
      Math.abs(velTheta) < 1e-5 &&
      Math.abs(velPhi) < 1e-5
    );
  }

  // Every input that changes the integrated image. If any of them moves, the
  // accumulated average no longer describes what is on screen.
  let lastSignature = "";

  function frameSignature() {
    return [
      state.gravity,
      state.beaming,
      state.spin,
      state.diskBright,
      state.temp,
      state.stars,
      state.diskOn ? 1 : 0,
      state.timeFlow ? 1 : 0,
      cam.theta,
      cam.phi,
      cam.radius,
      cam.fov,
      steps,
      canvasW,
      canvasH,
    ].join(",");
  }

  // Only a frozen, motionless frame can be averaged: the disk pattern and the
  // starfield must be identical from one sample to the next.
  function shouldAccumulate() {
    return (
      !!accumA && !state.timeFlow && !state.autoOrbit && cameraSettled()
    );
  }

  function tick(now) {
    const raw = now - lastFrame;
    lastFrame = now;

    // Ignore tab-switch gaps.
    const dt = clamp(raw, 0, 50) / 1000;
    if (raw > 0 && raw < 250) {
      fps += (1000 / raw - fps) * 0.08;
      avgMs = avgMs * 0.92 + raw * 0.08;
    }

    if (state.timeFlow) simTime += dt;

    updateCamera(dt);
    resize();

    const signature = frameSignature();
    if (signature !== lastSignature) {
      lastSignature = signature;
      resetAccum();
    }

    // A still frame is supersampled over many jittered renders. Once it has
    // converged we only re-present the result, so an idle tab costs almost
    // nothing.
    const still = shouldAccumulate();
    if (still && accumSource && samples >= MAX_SAMPLES) {
      present();
    } else {
      renderFrame(still);
    }

    frameCount++;
    if (state.quality === "auto" && (!still || samples <= 1)) {
      if (frameCount > 50 && frameCount % 30 === 0) {
        if (avgMs > 23 && renderScale > QUALITY.auto.min) {
          renderScale = Math.max(QUALITY.auto.min, renderScale - 0.035);
          canvasW = 0;
        } else if (avgMs < 15.2 && renderScale < QUALITY.auto.max) {
          renderScale = Math.min(QUALITY.auto.max, renderScale + 0.02);
          canvasW = 0;
        }
      }
    }

    // Telemetry at ~8 Hz.
    if (frameCount % 7 === 0) {
      $("statFps").textContent = Math.round(fps);
      $("statScale").textContent = `${wOrDash()}×${hOrDash()}`;
      $("statR").textContent = cam.radius.toFixed(1);
      const dilation = Math.sqrt(Math.max(0, 1 - 1 / cam.radius));
      $("statDilation").textContent = dilation.toFixed(3);
      $("statSteps").textContent = steps;
      $("statSamples").textContent = accumSource
        ? `${samples}/${MAX_SAMPLES}`
        : "live";
    }

    requestAnimationFrame(tick);
  }

  function wOrDash() {
    return canvas.width ? canvas.width : "—";
  }
  function hOrDash() {
    return canvas.height ? canvas.height : "—";
  }

  // ------------------------------------------------------------------ ui

  const sliderDefs = {
    gravity: {
      get: () => state.gravity,
      set: (v) => (state.gravity = v),
      out: "gravityOut",
      fmt: (v) => v.toFixed(2) + "×",
    },
    beaming: {
      get: () => state.beaming,
      set: (v) => (state.beaming = v),
      out: "beamingOut",
      fmt: (v) => v.toFixed(2),
    },
    spin: {
      get: () => state.spin,
      set: (v) => (state.spin = v),
      out: "spinOut",
      fmt: (v) => v.toFixed(2) + "×",
    },
    diskBright: {
      get: () => state.diskBright,
      set: (v) => (state.diskBright = v),
      out: "diskBrightOut",
      fmt: (v) => v.toFixed(2),
    },
    temp: {
      get: () => state.temp,
      set: (v) => (state.temp = v),
      out: "tempOut",
      fmt: (v) => Math.round(v) + " K",
    },
    exposure: {
      get: () => state.exposure,
      set: (v) => (state.exposure = v),
      out: "exposureOut",
      fmt: (v) => v.toFixed(2),
    },
    bloom: {
      get: () => state.bloom,
      set: (v) => (state.bloom = v),
      out: "bloomOut",
      fmt: (v) => v.toFixed(2),
    },
    stars: {
      get: () => state.stars,
      set: (v) => (state.stars = v),
      out: "starsOut",
      fmt: (v) => v.toFixed(2),
    },
    fov: {
      get: () => cam.fov,
      set: (v) => (cam.fov = v),
      out: "fovOut",
      fmt: (v) => Math.round(v) + "°",
    },
  };

  for (const [id, def] of Object.entries(sliderDefs)) {
    const input = $(id);
    const out = $(def.out);
    input.addEventListener("input", () => {
      def.set(parseFloat(input.value));
      out.textContent = def.fmt(parseFloat(input.value));
      clearPresetHighlight();
    });
  }

  $("distance").addEventListener("input", (e) => {
    cam.radius = parseFloat(e.target.value);
    camTween = null;
    $("distanceOut").textContent = cam.radius.toFixed(1) + " rₛ";
    clearPresetHighlight();
  });

  $("inclination").addEventListener("input", (e) => {
    cam.phi = (parseFloat(e.target.value) * Math.PI) / 180;
    camTween = null;
    $("inclinationOut").textContent = Math.round(parseFloat(e.target.value)) + "°";
    clearPresetHighlight();
  });

  function syncUI() {
    for (const [id, def] of Object.entries(sliderDefs)) {
      const input = $(id);
      const value = def.get();
      input.value = value;
      $(def.out).textContent = def.fmt(value);
    }
    $("diskOn").checked = state.diskOn;
    $("autoOrbit").checked = state.autoOrbit;
    $("timeFlow").checked = state.timeFlow;
    $("quality").value = state.quality;
    $("statSteps").textContent = steps;
    $("distance").value = cam.radius.toFixed(1);
    $("inclination").value = Math.round((cam.phi * 180) / Math.PI);
    $("distanceOut").textContent = cam.radius.toFixed(1) + " rₛ";
    $("inclinationOut").textContent =
      Math.round((cam.phi * 180) / Math.PI) + "°";
  }

  function clearPresetHighlight() {
    document.querySelectorAll(".chip").forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-pressed", "false");
    });
    activePreset = null;
    updateUrl();
  }

  $("diskOn").addEventListener("change", (e) => {
    state.diskOn = e.target.checked;
    clearPresetHighlight();
  });
  $("autoOrbit").addEventListener("change", (e) => {
    state.autoOrbit = e.target.checked;
  });
  $("timeFlow").addEventListener("change", (e) => {
    setTimeFlow(e.target.checked);
  });

  let orbitBeforeFreeze = false;
  let activePreset = null;

  // Keep the address bar shareable: preset, quality and the frozen flag.
  // replaceState throws on some file:// origins, hence the guard.
  function updateUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (activePreset) params.set("preset", activePreset);
      else params.delete("preset");
      if (state.quality !== "auto") params.set("quality", state.quality);
      else params.delete("quality");
      if (!state.timeFlow) params.set("frozen", "1");
      else params.delete("frozen");
      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        window.location.pathname + (query ? `?${query}` : "") + window.location.hash
      );
    } catch (_) {
      /* file:// or a locked-down origin: deep links stay read-only. */
    }
  }

  // Freezing time is the "give me a still" gesture, so it also parks the
  // auto-orbit; a motionless camera is what lets frames be supersampled.
  function setTimeFlow(on, announce = true) {
    state.timeFlow = on;
    $("timeFlow").checked = on;

    if (!on) {
      if (state.autoOrbit) {
        orbitBeforeFreeze = true;
        state.autoOrbit = false;
        $("autoOrbit").checked = false;
      }
      resetAccum();
    } else if (orbitBeforeFreeze) {
      orbitBeforeFreeze = false;
      state.autoOrbit = true;
      $("autoOrbit").checked = true;
    }

    updateUrl();
    if (announce) {
      toast(on ? "Time flowing" : "Frozen — refining still image");
    }
  }

  $("quality").addEventListener("change", (e) => {
    setQuality(e.target.value);
    clearPresetHighlight();
  });

  function setQuality(name) {
    state.quality = name;
    const q = QUALITY[name];
    if (!q) return;
    steps = q.steps;
    if (q.adaptive) {
      renderScale = clamp(renderScale, q.min, q.max);
    } else {
      renderScale = q.scale;
    }
    canvasW = 0;
    updateUrl();
  }

  // ------------------------------------------------------------------ presets

  const PRESETS = {
    interstellar: {
      state: {
        gravity: 1,
        beaming: 1,
        spin: 1,
        diskBright: 1.15,
        temp: 6200,
        exposure: 1,
        bloom: 0.9,
        stars: 1,
        diskOn: true,
        autoOrbit: true,
      },
      cam: { theta: 0.55, phi: 0.16, radius: 18 },
      fov: 50,
    },
    gargantua: {
      state: {
        gravity: 1,
        beaming: 1.25,
        spin: 0.8,
        diskBright: 1.55,
        temp: 5000,
        exposure: 1.08,
        bloom: 1.35,
        stars: 0.75,
        diskOn: true,
        autoOrbit: true,
      },
      cam: { theta: -0.35, phi: 0.085, radius: 16 },
      fov: 46,
    },
    photon: {
      state: {
        gravity: 1.35,
        beaming: 1.3,
        spin: 0.6,
        diskBright: 0.85,
        temp: 6500,
        exposure: 1.05,
        bloom: 0.85,
        stars: 1.1,
        diskOn: true,
        // A still lets the frame supersample, which is the only way the
        // sub-pixel photon ring resolves into a continuous curve.
        autoOrbit: false,
        timeFlow: false,
      },
      cam: { theta: 1.45, phi: 0.52, radius: 17 },
      fov: 55,
    },
    inferno: {
      state: {
        gravity: 1.15,
        beaming: 0.65,
        spin: 2.4,
        diskBright: 1.95,
        temp: 3600,
        exposure: 0.85,
        bloom: 1.5,
        stars: 0.45,
        diskOn: true,
        autoOrbit: true,
      },
      cam: { theta: 2.3, phi: 0.4, radius: 22 },
      fov: 58,
    },
    void: {
      state: {
        gravity: 1,
        beaming: 1,
        spin: 0.5,
        diskBright: 1,
        temp: 6200,
        exposure: 1.4,
        bloom: 1.15,
        stars: 1.9,
        diskOn: false,
        autoOrbit: true,
      },
      cam: { theta: 0.9, phi: 0.06, radius: 12 },
      fov: 48,
    },
  };

  const PRESET_TOASTS = {
    interstellar: "Interstellar — the classic edge-on view",
    gargantua: "Gargantua — brighter, warmer, wider",
    photon: "Photon ring — a still, supersampled pass around the shadow",
    inferno: "Inferno — a fast, cool-red disk",
    void: "Cold void — stars only, shadow at the centre",
  };

  function applyPreset(name, instant = false) {
    const preset = PRESETS[name];
    if (!preset) return;
    Object.assign(state, preset.state);
    activePreset = name;
    cam.fov = preset.fov;
    if (instant) {
      cam.theta = preset.cam.theta;
      cam.phi = preset.cam.phi;
      cam.radius = preset.cam.radius;
      camTween = null;
    } else {
      tweenCamera(preset.cam);
    }
    syncUI();
    document.querySelectorAll(".chip").forEach((c) => {
      const active = c.dataset.preset === name;
      c.classList.toggle("is-active", active);
      c.setAttribute("aria-pressed", String(active));
    });
    updateUrl();
    hideHint();
    return PRESET_TOASTS[name];
  }

  document.querySelectorAll("[data-preset]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const message = applyPreset(chip.dataset.preset);
      if (message) toast(message);
    });
  });

  // ------------------------------------------------------------------ chrome

  function togglePanel(visible) {
    const isVisible = !panel.classList.contains("is-collapsed");
    const nextVisible = typeof visible === "boolean" ? visible : !isVisible;
    panel.classList.toggle("is-collapsed", !nextVisible);
    $("panelToggle").setAttribute("aria-expanded", String(nextVisible));
    $("panelToggle").setAttribute(
      "aria-label",
      nextVisible ? "Collapse controls" : "Expand controls"
    );
    $("panelToggle").textContent = nextVisible ? "−" : "+";
  }

  $("panelToggle").addEventListener("click", () => togglePanel());
  $("btnPanel").addEventListener("click", () => togglePanel());

  const about = $("about");
  let lastFocused = null;

  function modalFocusables() {
    return [
      ...about.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ),
    ].filter((el) => !el.disabled && el.offsetParent !== null);
  }

  function openAbout(open) {
    if (open) {
      lastFocused = document.activeElement;
      about.hidden = false;
      about.querySelector(".modal-close").focus();
    } else {
      about.hidden = true;
      if (lastFocused && lastFocused.focus) lastFocused.focus();
      lastFocused = null;
    }
  }
  $("btnAbout").addEventListener("click", () => openAbout(true));
  about.querySelectorAll("[data-close]").forEach((el) => {
    el.addEventListener("click", () => openAbout(false));
  });

  // Keep Tab inside the dialog while it is open.
  about.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || about.hidden) return;
    const items = modalFocusables();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  $("btnShot").addEventListener("click", () => {
    toast("Capturing…");
    capture();
  });

  let uiHidden = false;
  function setUiHidden(hidden) {
    uiHidden = hidden;
    document.body.classList.toggle("ui-hidden", hidden);
  }

  $("btnHide").addEventListener("click", () => setUiHidden(true));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!about.hidden) openAbout(false);
      else setUiHidden(false);
      return;
    }
    if (!about.hidden) return;
    const tag = e.target instanceof Element ? e.target.tagName : "";
    if (/^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(tag)) return;

    switch (e.key.toLowerCase()) {
      case "h":
        setUiHidden(!uiHidden);
        break;
      case " ":
        e.preventDefault();
        setTimeFlow(!state.timeFlow);
        break;
      case "s":
        toast("Capturing…");
        capture();
        break;
      case "p":
        togglePanel();
        break;
    }
  });

  let toastTimer = 0;
  function toast(message) {
    if (!message) return;
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(
      () => toastEl.classList.remove("is-visible"),
      2200
    );
  }

  // ------------------------------------------------------------------ boot

  function start() {
    const params = new URLSearchParams(window.location.search);
    const linkedPreset = params.get("preset");
    if (linkedPreset && PRESETS[linkedPreset]) {
      applyPreset(linkedPreset, true);
    }
    const linkedQuality = params.get("quality");
    if (linkedQuality && QUALITY[linkedQuality]) {
      setQuality(linkedQuality);
    }
    if (params.get("frozen") === "1") {
      setTimeFlow(false, false);
    }

    // A slow push-in on first load, unless the visitor asked for less motion
    // or arrived via a shared preset link.
    if (!linkedPreset && !reducedMotion) {
      cam.radius = 26;
      cam.phi = 0.3;
      tweenCamera({ theta: 0.55, phi: 0.16, radius: 18 }, 2600);
    }
    updateCameraVectors();

    resize();
    syncUI();
    if (window.innerWidth < 760) togglePanel(false);

    // Give the browser one frame to settle layout before the heavy first draw.
    requestAnimationFrame(() => {
      resize();
      if (!sceneTarget) {
        fatal("WebGL2 is present but could not allocate a render target.");
        return;
      }
      renderFrame(false);
      boot.classList.add("is-hidden");
      setTimeout(() => {
        boot.style.display = "none";
      }, 1000);
      requestAnimationFrame(tick);
    });

    setTimeout(hideHint, 9000);
  }

  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    boot.style.display = "";
    boot.classList.remove("is-hidden");
    boot.classList.remove("is-error");
    bootMsg.textContent = "GPU context lost — restoring…";
  });

  canvas.addEventListener("webglcontextrestored", () => {
    window.location.reload();
  });

  // Initial camera vectors are needed before the first render.
  updateCameraVectors();
  start();
})();
