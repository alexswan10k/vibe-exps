/* core: constants, seeded RNG, noise, tiny helpers */
'use strict';

const CFG = {
  SX: 128, SY: 64, SZ: 128,   // world size in blocks
  CHUNK: 16,                  // chunk footprint (full height per chunk)
  SEA: 22,                    // sea level
  REACH: 5.2,                 // block interaction distance
  GRAVITY: 30,
  JUMP_V: 8.4,                // ~1.2 blocks
  WALK: 4.317, SPRINT: 5.612, SNEAK: 1.3,
  PW: 0.3, PH: 1.8, EYE: 1.62, EYE_SNEAK: 1.35,
  DAY_LEN: 300                // seconds per full day/night cycle
};

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* hash of arbitrary string -> uint32 seed */
function strSeed(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* classic Perlin noise with a seeded permutation table */
function makeNoise(seed) {
  const rnd = mulberry32(seed >>> 0);
  const p = new Uint8Array(512), perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];

  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  function grad(h, x, y, z) {
    h &= 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }
  function noise3(x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return lerp(
      lerp(lerp(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u),
           lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u),
           lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v),
      w);
  }
  function noise2(x, y) { return noise3(x, y, 0); }

  /* fractal brownian motion */
  function fbm(x, y, oct, lac, gain) {
    let s = 0, amp = 1, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { s += amp * noise2(x * f, y * f); norm += amp; amp *= gain; f *= lac; }
    return s / norm;
  }

  /* deterministic hash -> [0,1) */
  function hash3(a, b, c) {
    let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  return { noise2, noise3, fbm, hash3 };
}
