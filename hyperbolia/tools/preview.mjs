/* ==========================================================================
 * HYPERBOLIA — CPU reference renderer (development harness)
 *
 * A faithful JS port of the fragment shader in shaders.js, used to preview
 * the image without a GPU and to regression-test the geometry. It is not
 * loaded by index.html.
 *
 *   node tools/preview.mjs [out.png] [width] [height] [--flat] [--room=T]
 * ========================================================================== */

import zlib from "node:zlib";
import fs from "node:fs";

/* ------------------------------------------------------------------ math */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const norm = (a) => scale(a, 1 / (Math.hypot(...a) || 1));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mix = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

function fract(x) {
  return x - Math.floor(x);
}
function hash13(x, y, z) {
  let px = fract(x * 0.1031),
    py = fract(y * 0.1031),
    pz = fract(z * 0.1031);
  const d = px * pz + py * py + pz * px + 31.32 * (pz + py + px);
  px += d;
  py += d;
  pz += d;
  return fract((px + py) * pz);
}
const acosh = (x) => Math.log(Math.max(x, 1) + Math.sqrt(Math.max(x * x - 1, 0)));

/* ---------------------------------------------------------------- params */
const argv = process.argv.slice(2);
const outFile = argv.find((a) => !a.startsWith("-") && !/^\d+$/.test(a)) || "/tmp/hyperbolia.png";
const W = parseInt(argv[argv.indexOf(outFile) + 1] || "720", 10);
const H = parseInt(argv[argv.indexOf(outFile) + 2] || "405", 10);

const KEY = parseFloat(process.env.KEY || '2.5');
const STEP = parseFloat(process.env.STEP || '0.82');
const P = {
  curv: argv.includes("--flat") ? 0 : 1,
  room: 1.15,
  door: 0.42,
  fog: 0.22,
  glow: 1.0,
  panel: 1.0,
  palette: 0.0,
  head: 0.9,
  shadow: 0.7,
  steps: 160,
  fov: 72,
  yaw: 0,
  pitch: 0,
  eye: 0.24,
  z: 0,
};

// Any --name=value overrides any numeric field, so terms can be isolated.
for (const a of argv) {
  const m = /^--([a-zA-Z_]+)=(.*)$/.exec(a);
  if (!m) continue;
  if (m[1] === "debug") P.debug = m[2];
  else if (m[1] in P) P[m[1]] = parseFloat(m[2]);
}

const D = P.curv > 0.5 ? Math.sinh(P.room) : P.room;

/* ------------------------------------------------------------------ sdf */
function sdBox(p, b) {
  const q = [Math.abs(p[0]) - b[0], Math.abs(p[1]) - b[1], Math.abs(p[2]) - b[2]];
  const mx = Math.max(q[0], 0),
    my = Math.max(q[1], 0),
    mz = Math.max(q[2], 0);
  return Math.hypot(mx, my, mz) + Math.min(Math.max(q[0], q[1], q[2]), 0);
}
function sdTunnel(p, r) {
  const a = p.map(Math.abs);
  const d0 = Math.max(Math.max(a[1], a[2]) - r, a[0] - 1e4);
  const d1 = Math.max(Math.max(a[0], a[2]) - r, a[1] - 1e4);
  const d2 = Math.max(Math.max(a[0], a[1]) - r, a[2] - 1e4);
  return Math.min(d0, d1, d2);
}
let OUT_CID = [0, 0, 0];
let OUT_Q = [0, 0, 0];
function map(k) {
  const cid = [0, 1, 2].map((i) => Math.floor(k[i] / D + 0.5));
  const q = [0, 1, 2].map((i) => k[i] - cid[i] * D);
  OUT_CID = cid;
  OUT_Q = q;
  const C = D * 0.5;
  const dr = P.door * C;
  return Math.max(sdBox(q, [C, C, C]), -sdTunnel(q, dr));
}
function calcNormal(p) {
  const e = 0.0007 + 0.0009 * Math.hypot(...p);
  const acc = [0, 0, 0];
  for (const [a, b, c] of [
    [e, -e, -e],
    [-e, -e, e],
    [-e, e, -e],
    [e, e, e],
  ]) {
    const d = map([p[0] + a, p[1] + b, p[2] + c]);
    acc[0] += a * d;
    acc[1] += b * d;
    acc[2] += c * d;
  }
  return norm(acc);
}
function toHyperNormal(x, g) {
  return norm(g.map((v, i) => v + x[i] * dot(x, g)));
}
function calcAO(p, n) {
  let occ = 0,
    sca = 1;
  for (let i = 0; i < 5; i++) {
    const h = 0.012 + (0.13 * i) / 4;
    occ += (h - map([p[0] + n[0] * h, p[1] + n[1] * h, p[2] + n[2] * h])) * sca;
    sca *= 0.72;
  }
  return clamp(1 - 2.4 * occ, 0, 1);
}
function coshD(a, b) {
  return Math.sqrt((1 + dot(a, a)) * (1 + dot(b, b))) - dot(a, b);
}
function hypStep(k, rd) {
  const T = Math.sqrt(1 + dot(k, k));
  return Math.sqrt(Math.max(dot(rd, rd) * T * T - dot(k, rd) ** 2, 0)) / T;
}
function softShadow(ro, rd, mint, maxt) {
  let res = 1,
    t = mint;
  const n = Math.round(8 + 26 * P.shadow);
  for (let i = 0; i < 40; i++) {
    if (i >= n) break;
    const h = map([ro[0] + rd[0] * t, ro[1] + rd[1] * t, ro[2] + rd[2] * t]);
    res = Math.min(res, (10 * h) / t);
    t += clamp(h, 0.02, 0.35);
    if (res < 0.03 || t > maxt) break;
  }
  return clamp(res, 0, 1);
}
function cellTint(cid) {
  const h = hash13(cid[0] * 1.37 + 0.5, cid[1] * 1.37 + 0.5, cid[2] * 1.37 + 0.5);
  const h2 = hash13(cid[0] * 0.71 + 9.2, cid[1] * 0.71 + 9.2, cid[2] * 0.71 + 9.2);
  let a = [mix(0.26, 0.46, h), mix(0.27, 0.42, h), mix(0.31, 0.36, h)];
  a = a.map((c, i) => mix(c, [0.2, 0.28, 0.4][i], h2 * 0.55));
  const spec = [0, 1, 2].map(
    (i) => 0.55 + 0.45 * Math.cos(2 * Math.PI * (h + [0, 0.33, 0.67][i]))
  );
  return a.map((c, i) => mix(c, spec[i], P.palette));
}
function frameRing(v, dr, C) {
  // v must be the two IN-PLANE coordinates of the face; the third component
  // is pinned at C and would otherwise swamp the max().
  // A thin bright line hugging the doorway edge, not a wide band.
  const mx = Math.max(Math.abs(v[0]), Math.abs(v[1]));
  const w = 0.05 * C;
  return smoothstep(w, 0.0, Math.abs(mx - (dr + w * 1.1)));
}
/** The ring for whichever face the surface point actually lies on. */
function frameAt(q, a, C, dr, dFace) {
  const ring = [
    frameRing([q[1], q[2]], dr, C),
    frameRing([q[0], q[2]], dr, C),
    frameRing([q[0], q[1]], dr, C),
  ];
  const dmin = Math.min(...dFace);
  let fr = 0;
  for (let i = 0; i < 3; i++) if (dFace[i] <= dmin + 1e-9) fr = Math.max(fr, ring[i]);
  return fr;
}

/* ---------------------------------------------------------------- shade */
function shade(ro, rd, t) {
  const p = [ro[0] + rd[0] * t, ro[1] + rd[1] * t, ro[2] + rd[2] * t];
  const cid = OUT_CID;
  const q = OUT_Q;
  const C = D * 0.5;
  const dr = P.door * C;

  const nE = calcNormal(p);
  const n = toHyperNormal(p, nE);
  const v = norm(sub(ro, p));

  const a = q.map(Math.abs);
  const ax = Math.abs(q[0]),
    ay = Math.abs(q[1]),
    az = Math.abs(q[2]);
  const uv = ax >= ay && ax >= az ? [q[1], q[2]] : ay >= az ? [q[0], q[2]] : [q[0], q[1]];

  // Recessed panel grid on the wall.
  const px_ = C * 0.5;
  const gx = Math.abs(fract(uv[0] / px_ + 0.5) - 0.5) * px_;
  const gy = Math.abs(fract(uv[1] / px_ + 0.5) - 0.5) * px_;
  const seam = 1 - smoothstep(0.008 * C, 0.030 * C, Math.min(gx, gy));

  // Which face are we on? Drives the floor/wall material split.
  const dFace = [C - a[0], C - a[1], C - a[2]];
  const dmin = Math.min(...dFace);
  const onFloor = dFace[1] <= dmin + 1e-9 && ay > ax && ay >= az;
  const onCeil = dFace[1] <= dmin + 1e-9 && !onFloor;

  // Dado: the lower third of each wall is a darker plinth.
  const wallV = dFace[0] <= dmin + 1e-9 ? q[1] : q[2];
  const plinth = smoothstep(0.26 * C, 0.32 * C, Math.abs(wallV) + 0.16 * C);
  const dado = onFloor || onCeil ? 1 : plinth;

  const rivet =
    smoothstep(
      0.055 * C,
      0.02 * C,
      Math.hypot(
        Math.abs(fract(uv[0] / (C * 0.25) + 0.5) - 0.5) * (C * 0.25),
        Math.abs(fract(uv[1] / (C * 0.25) + 0.5) - 0.5) * (C * 0.25)
      ) - 0.008 * C
    ) * 0.5;

  const tint = cellTint(cid);

  // Distance to the nearest wall EDGE = second-smallest face distance.
  const edgeD = Math.min(
    Math.max(dFace[0], dFace[1]),
    Math.max(dFace[0], dFace[2]),
    Math.max(dFace[1], dFace[2])
  );
  const fil = smoothstep(0.09 * C + 0.002, 0.0, edgeD);
  const fr = frameAt(q, a, C, dr, dFace);

  // Architecture stays near-neutral; the emissive lattice carries the colour,
  // so the receding door frames read as a shimmering infinite grid.
  const ah = hash13(cid[0] * 2.17 + 3.1, cid[1] * 2.17 + 3.1, cid[2] * 2.17 + 3.1);
  const emit = [0, 1, 2].map((i) => {
    const vivid = 0.55 + 0.45 * Math.cos(2 * Math.PI * (ah + [0.0, 0.33, 0.67][i]));
    const warm = [1.0, 0.72, 0.42];
    return vivid * (1 - P.palette) + warm[i] * P.palette;
  });
  const glowAmt = fil * 0.34 + fr * 1.05;
  if (P.debug === "glow") return [glowAmt, glowAmt, glowAmt];
  if (P.debug === "fr") return [fr, fr, fr];
  if (P.debug === "fil") return [fil, fil, fil];
  if (P.debug === "albedo") return albedo;
  if (P.debug === "ao") return [ao, ao, ao];

  // Floor reads as a darker polished slab; ceiling slightly brighter.
  const matMul = onFloor ? 0.62 : onCeil ? 0.92 : 1.0;
  const albedo = tint.map((c, i) => {
    let v = c * matMul;
    v *= 0.62 + 0.38 * rivet;
    v *= 1 - 0.5 * seam * P.panel;
    v *= mix(0.42, 1.0, dado);
    return v;
  });

  const ao = calcAO(p, n);

  const lp = [cid[0] * D, cid[1] * D, cid[2] * D];
  const shL = Math.sqrt(Math.max(coshD(p, lp) ** 2 - 1, 0));
  const attL = 1 / (1 + 2.6 * shL * shL);
  const l = norm(sub(lp, p));   // surface -> lamp
  let lam = Math.max(dot(n, l), 0);
  lam = lam * lam * (3 - 2 * lam);
  const hv = norm(sub(l, v));
  const spec = Math.max(dot(n, hv), 0) ** 42;

  const shH = Math.sqrt(Math.max(coshD(p, ro) ** 2 - 1, 0));
  const attH = 1 / (1 + 3.2 * shH * shH);
  const hl = norm(sub(ro, p));  // surface -> lantern
  let lamH = Math.max(dot(n, hl), 0);
  lamH = lamH * lamH * (3 - 2 * lamH);
  const hv2 = norm(sub(hl, v));
  const specH = Math.max(dot(n, hv2), 0) ** 60;

  const shadowMul = P.shadow > 0.01 ? mix(1, softShadow([p[0] + nE[0] * 0.01, p[1] + nE[1] * 0.01, p[2] + nE[2] * 0.01], l, 0.02, Math.min(shL * 0.85, 6)), P.shadow) : 1;

  const baseLight = P.palette > 0 ? 0.55 + 0.45 * hash13(cid[0] * 3.1, cid[1] * 3.1, cid[2] * 3.1) : 1;

  let col = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    let c = albedo[i] * tint[i] * lam * attL * KEY * baseLight;
    c += [1.0, 0.93, 0.82][i] * spec * attL * 1.4;
    c *= shadowMul;
    c += albedo[i] * [1.0, 0.72, 0.45][i] * lamH * attH * P.head * 1.1;
    c += [1.0, 0.75, 0.5][i] * specH * attH * P.head;
    c += albedo[i] * [0.042, 0.052, 0.078][i] * ao;
    c *= mix(0.45, 1.0, ao);
    c += emit[i] * glowAmt * P.glow * ao;
    col[i] = c;
  }

  const fogD =
    P.curv > 0.5 ? acosh(Math.max(coshD(p, ro), 1)) : Math.hypot(...sub(p, ro));
  const f = clamp(1 - Math.exp(-fogD * P.fog), 0, 1);
  // Luminous haze rather than black: the vanishing point should glow.
  const fogCol = [0.012, 0.028, 0.055];
  col = col.map((c, i) => mix(c, fogCol[i], f));
  return col;
}

/* ----------------------------------------------------------------- march */
const HITS = { hit: 0, miss: 0, tSum: 0 };
function render(ro, rd) {
  let t = 0.015;
  for (let i = 0; i < 200; i++) {
    if (i >= P.steps) break;
    const p = [ro[0] + rd[0] * t, ro[1] + rd[1] * t, ro[2] + rd[2] * t];
    const d = map(p);
    const eps = 0.0006 + 0.0013 * t;
    if (d < eps) { HITS.hit++; HITS.tSum += t; return shade(ro, rd, t); }
    const hf = mix(1, hypStep(p, rd), P.curv);
    t += Math.max((d * STEP) / hf, eps * 0.85);
    if (t > 110) break;
  }
  HITS.miss++;
  const s = clamp(rd[1] * 0.5 + 0.5, 0, 1);
  return [0, 1, 2].map((i) => mix([0.004, 0.005, 0.01][i], [0.015, 0.02, 0.04][i], s));
}

/* -------------------------------------------------------------- camera */
const ro = [0, (P.eye - 0.5) * D, P.z];
const cy = Math.cos(P.yaw),
  sy = Math.sin(P.yaw);
const cp = Math.cos(P.pitch),
  sp = Math.sin(P.pitch);
const fwd = norm([sy * cp, sp, cy * cp]);
const right = norm(cross(fwd, [0, 1, 0]));
const up = cross(right, fwd);

/* ----------------------------------------------------------------- main */
const px = Buffer.alloc(W * H * 3);
const stats = { lo: Infinity, hi: -Infinity, sum: 0, n: 0, over1: 0 };
const tanHalf = Math.tan((P.fov * Math.PI) / 360);
const t0 = Date.now();
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const sx = ((x + 0.5) * 2 - W) / H;
    const syy = -((y + 0.5) * 2 - H) / H;
    const rd = norm([
      fwd[0] + tanHalf * (sx * right[0] + syy * up[0]),
      fwd[1] + tanHalf * (sx * right[1] + syy * up[1]),
      fwd[2] + tanHalf * (sx * right[2] + syy * up[2]),
    ]);
    let c = render(ro, rd);
    for (const v of c) {
      stats.lo = Math.min(stats.lo, v);
      stats.hi = Math.max(stats.hi, v);
      stats.sum += v;
      stats.n++;
      if (v > 1) stats.over1++;
    }
    c = c.map((v) => v * 1.05);
    c = c.map((v) => (v * (2.51 * v + 0.03)) / (v * (2.43 * v + 0.59) + 0.14));
    c = c.map((v) => Math.pow(Math.max(v, 0), 1 / 2.2));
    const vx = (x + 0.5) / W,
      vy = (y + 0.5) / H;
    const vig = 0.55 + 0.45 * (16 * vx * vy * (1 - vx) * (1 - vy)) ** 0.22;
    c = c.map((v) => clamp(v * vig, 0, 1));
    const o = (y * W + x) * 3;
    px[o] = c[0] * 255;
    px[o + 1] = c[1] * 255;
    px[o + 2] = c[2] * 255;
  }
}
process.stderr.write(
  `hits ${HITS.hit} misses ${HITS.miss} meanT ${(HITS.tSum / Math.max(1, HITS.hit)).toFixed(2)}\n` +
  `rendered ${W}x${H} in ${Date.now() - t0}ms | linear lo=${stats.lo.toFixed(3)} ` +
    `hi=${stats.hi.toFixed(2)} mean=${(stats.sum / stats.n).toFixed(3)} ` +
    `over1=${((100 * stats.over1) / stats.n).toFixed(1)}%\n`
);

/* ------------------------------------------------------------------ png */
function crc32(buf) {
  let c,
    t = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const raw = Buffer.alloc(H * (W * 3 + 1));
for (let y = 0; y < H; y++) {
  raw[y * (W * 3 + 1)] = 0;
  px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 2;
fs.writeFileSync(
  outFile,
  Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
);
process.stderr.write(`wrote ${outFile}\n`);
