/* textures.js — procedural block textures for the voxel-verse chunk atlas.

   The old generator scattered uncorrelated single-pixel dots on a flat base
   colour (`Math.random()` speckle). At a glance that reads as static, not as a
   material: no grain, no direction, no clusters, and — because the randomness
   came from Math.random — a *different* world texture on every reload.

   What's here instead:

     * deterministic. Every value comes from an integer hash of its own
       coordinates, so the same block always looks the same, across reloads and
       across machines. No Math.random anywhere.
     * value noise + fBm, not speckle. Smooth interpolated noise gives cloud-like
       mottling that reads as stone or bark; one-pixel dots never do.
     * tileable. The noise lattice wraps at the tile's period, so a texture's
       opposite edges match and large flat areas don't show a seam grid.
     * per-face. Grass has a grass top and a dirt-with-fringe side; logs have
       bark on the sides and rings on the ends. One tile for all six faces is
       what makes procedural blocks look procedural.
     * a real alpha channel, so leaves get cutout holes and the alphaTest on the
       leaf material actually has something to cut.

   No DOM and no three.js: a tile is a plain RGBA buffer, which is what makes
   this unit-testable in Node. script.js blits the finished atlas into a canvas.

   Plain global script, like mesher.js. No imports, no build step. */
(function (root) {
'use strict';

const TILE = 32;      // texels per tile edge
/* The grid is sized to the tiles we actually have, not rounded up to a power of
   two for its own sake: 15 tiles fit in 4x4, giving a 128x128 atlas. The old
   16x16 layout used 13 of 256 cells — 95% empty canvas, which is 4x the memory
   for nothing and is what made mipmapping unusable (every reduced mip level
   averaged a tile with blank canvas).

   `ATLAS_NAMES.length` must stay <= COLS*ROWS; a test asserts the grid is
   neither mostly empty nor close to full. If you add tiles, widen the grid. */
const COLS = 4, ROWS = 4;   // 16 cells, 128x128 atlas

/* ---- deterministic noise -------------------------------------------------
   hash2i is an integer avalanche: neighbouring inputs give unrelated outputs,
   and the same input always gives the same value on every machine and reload. */
function hash2i(x, y, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695040)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const lerp = (a, b, t) => a + (b - a) * t;
/* Smoothstep the interpolation weights. Linear interpolation gives you visible
   diamond creases along the lattice; smoothstep hides them. */
const smooth = (t) => t * t * (3 - 2 * t);

/* Bilinear value noise on a lattice of `period` cells, wrapping in both axes.
   Wrapping is what makes the tile seamless: the lattice at x=period is the same
   as x=0, so the tile's right edge joins its left edge. */
function valueNoise(x, y, period, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const x0 = ((xi % period) + period) % period, y0 = ((yi % period) + period) % period;
  const x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
  const a = hash2i(x0, y0, seed), b = hash2i(x1, y0, seed);
  const c = hash2i(x0, y1, seed), d = hash2i(x1, y1, seed);
  const u = smooth(xf), v = smooth(yf);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

/* Fractal noise: octaves of value noise at doubling frequency and halving
   amplitude. u,v are normalised 0..1 across the tile; `period` is the lattice
   cells across the tile at the first octave. Each octave doubles its period too,
   so every octave wraps and the sum stays tileable. */
function fbm(u, v, period, octaves, seed, gain) {
  gain = gain === undefined ? 0.5 : gain;
  let sum = 0, amp = 1, norm = 0, p = period;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(u * p, v * p, p, seed + o * 7919);
    norm += amp;
    amp *= gain;
    p *= 2;
  }
  return sum / norm;
}

/* Ridged noise — good for cracks and veins, where you want a thin bright line
   rather than a soft blob. */
function ridge(u, v, period, seed) {
  return 1 - Math.abs(fbm(u, v, period, 3, seed) * 2 - 1);
}

/* ---- colour helpers ------------------------------------------------------ */
/* Colours are handled as plain [r,g,b] triples rather than hex ints, because
   these painters mix iteratively — mixing an already-mixed colour back down
   toward a darker one is the whole point, and that means passing results back
   in. `rgbOf` converts a palette hex at the point of definition instead. */
function rgbOf(hex) { return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]; }
/* Clamp t so a mix can never leave 0..255. |0 truncates toward zero but does not
   bound the result, so an out-of-range t (a threshold compared the wrong way
   round, a divisor that went to zero) silently produces colours like 510 that
   only get clamped later, by whatever buffer happens to receive them. */
const clamp01 = (t) => t < 0 ? 0 : t > 1 ? 1 : t;
function mix(a, b, t) {
  t = clamp01(t);
  return [lerp(a[0], b[0], t) | 0, lerp(a[1], b[1], t) | 0, lerp(a[2], b[2], t) | 0];
}
function shade(c, f) { return [c[0] * f | 0, c[1] * f | 0, c[2] * f | 0]; }

/* A tile is a plain RGBA byte buffer. Drawing into it rather than a canvas keeps
   this module free of DOM so the tests can run it in Node. */
function tile() {
  const data = new Uint8ClampedArray(TILE * TILE * 4);
  return {
    data,
    set(x, y, c, a) {
      if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
      const i = ((y | 0) * TILE + (x | 0)) * 4;
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2];
      data[i + 3] = a === undefined ? 255 : a;
    },
    get(x, y) {
      const i = ((((y % TILE) + TILE) % TILE) * TILE + (((x % TILE) + TILE) % TILE)) * 4;
      return [data[i], data[i + 1], data[i + 2], data[i + 3]];
    },
    fill(c, a) { for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) this.set(x, y, c, a); },
  };
}

/* ---- palette -------------------------------------------------------------
   Each material gets a dark/base/light triple derived by hand. Deriving all
   three from one colour with a fixed multiplier looks worse — the ratios that
   read as "stone" are not the ratios that read as "wood". */
const PAL = {
  grass:    { dark: 0x2f6b28, base: 0x4e9c3f, light: 0x74c95a },
  dirt:     { dark: 0x5c3d1e, base: 0x8a5f31, light: 0xa87a45 },
  stone:    { dark: 0x6e6e77, base: 0x8d8d94, light: 0xadadb4 },
  sand:     { dark: 0xcbb267, base: 0xe3d089, light: 0xf3e6b4 },
  log:      { dark: 0x3f2a15, base: 0x6b4a26, light: 0x8d6636 },
  leaves:   { dark: 0x1d5c28, base: 0x2f8f3a, light: 0x54bd5c },
  snow:     { dark: 0xd2dcec, base: 0xf2f7ff, light: 0xffffff },
  bedrock:  { dark: 0x111116, base: 0x23232a, light: 0x3c3c47 },
  planks:   { dark: 0x8a6236, base: 0xc49a5a, light: 0xdcb87e },
  glass:    { dark: 0x9fd4ee, base: 0xbfe8ff, light: 0xffffff },
  brick:    { dark: 0x8c3d28, base: 0xb05136, light: 0xc9704f },
  glow:     { dark: 0xc78a1e, base: 0xffd34d, light: 0xfff2b0 },
  obsidian: { dark: 0x140e26, base: 0x2a1e4f, light: 0x5b4a8f },
  water:    { dark: 0x2a52c4, base: 0x3b6df6, light: 0x6f9dff },
};

/* Same palette, pre-converted to [r,g,b] so painters can mix iteratively without
   re-parsing hex on every pixel. Built here rather than beside the helpers
   because it depends on PAL. */
const C = {};
for (const k in PAL) C[k] = { dark: rgbOf(PAL[k].dark), base: rgbOf(PAL[k].base), light: rgbOf(PAL[k].light) };

/* ---- tile painters -------------------------------------------------------
   Each fills a 32x32 tile. `p` is the painter; `u,v` are normalised coords. */

/* Grass, seen from above: mown-looking mottling plus a few bright blades. */
function grassTop(p) {
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const u = x / TILE, v = y / TILE;
    const n = fbm(u, v, 4, 3, 11);
    let c = mix(C.grass.dark, C.grass.base, n);
    // a second, tighter noise picks out sunlit clumps
    if (fbm(u, v, 8, 2, 29) > 0.62) c = mix(c, C.grass.light, 0.55);
    p.set(x, y, c);
  }
  // sparse blades: short vertical strokes, the one directional cue that makes
  // grass read as grass rather than as green static
  for (let i = 0; i < 34; i++) {
    const x = (hash2i(i, 1, 5) * TILE) | 0, y = (hash2i(i, 2, 5) * TILE) | 0;
    const h = 2 + ((hash2i(i, 3, 5) * 2) | 0);
    const c = mix(C.grass.light, C.grass.base, hash2i(i, 4, 5));
    for (let k = 0; k < h; k++) p.set(x, (y + k) % TILE, c);
  }
}

/* Grass seen from the side: dirt, with a band of grass hanging over the top
   edge. The fringe depth varies per column so it doesn't read as a printed
   stripe, and a couple of blades dangle below it. */
function grassSide(p) {
  const fringe = new Int32Array(TILE);
  for (let x = 0; x < TILE; x++) {
    fringe[x] = 7 + Math.round(fbm(x / TILE, 0.3, 5, 2, 77) * 5);
  }
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const u = x / TILE, v = y / TILE;
    if (y < fringe[x]) {
      const c = mix(C.grass.dark, C.grass.base, fbm(u, v, 4, 3, 11));
      p.set(x, y, c);
    } else {
      const c = mix(C.dirt.dark, C.dirt.base, fbm(u, v, 4, 3, 21));
      // shadow line where the grass overhangs the dirt
      p.set(x, y, y === fringe[x] ? shade(c, 0.66) : c);
    }
  }
  // dangling blades below the fringe
  for (let i = 0; i < 12; i++) {
    const x = (hash2i(i, 7, 9) * TILE) | 0;
    const extra = 1 + ((hash2i(i, 8, 9) * 4) | 0);
    for (let k = 1; k <= extra; k++) {
      const y = fringe[x] + k;
      if (y < TILE) p.set(x, y, mix(C.grass.dark, C.grass.base, 0.4));
    }
  }
}

/* Dirt: fBm clumps plus scattered darker pebbles from a second threshold. */
function dirt(p) {
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const u = x / TILE, v = y / TILE;
    const n = fbm(u, v, 4, 3, 21);
    let c = mix(C.dirt.dark, C.dirt.base, n);
    if (fbm(u, v, 8, 2, 31) > 0.66) c = mix(c, C.dirt.light, 0.6);
    if (fbm(u, v, 6, 2, 41) < 0.30) c = shade(c, 0.74);   // pebbles / shadowed clumps
    p.set(x, y, c);
  }
}

/* Stone: broad mottling plus a ridged crack network. The ridges are what stop
   it looking like grey static — they're the only long straight-ish features. */
function stone(p) {
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const u = x / TILE, v = y / TILE;
    const n = fbm(u, v, 3, 3, 51);
    let c = mix(C.stone.dark, C.stone.base, n);
    if (fbm(u, v, 8, 2, 61) > 0.60) c = mix(c, C.stone.light, 0.5);
    const r = ridge(u, v, 4, 71);
    if (r > 0.88) c = shade(c, 0.80);
    else if (r < 0.10) c = mix(c, C.stone.light, 0.22);
    p.set(x, y, c);
  }
}

/* Sand: fine, high-frequency grain. Low amplitude — sand is nearly uniform. */
function sand(p) {
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const u = x / TILE, v = y / TILE;
    const n = fbm(u, v, 12, 2, 81);
    let c = mix(C.sand.dark, C.sand.base, n);
    if (hash2i(x, y, 91) > 0.965) c = C.sand.light;
    else if (hash2i(x, y, 92) > 0.965) c = shade(c, 0.92);
    p.set(x, y, c);
  }
}

/* Log, seen from the side: bark. The noise is sampled with the vertical
   coordinate compressed, which stretches the features into vertical streaks —
   wood grain. Sampling both axes equally (as every other material does) would
   give you blobs. */
function logSide(p) {
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const n = fbm(x / TILE, y / TILE * 0.22, 6, 3, 101);
    let c = mix(C.log.dark, C.log.base, n);
    // deep grooves: narrow, dark, and continuous top to bottom
    const groove = ridge(x / TILE * 1.0, y / TILE * 0.12, 7, 111);
    if (groove > 0.86) c = shade(c, 0.66);
    else if (groove < 0.16) c = mix(c, C.log.light, 0.30);
    p.set(x, y, c);
  }
  // a couple of knots
  for (let i = 0; i < 2; i++) {
    const kx = (hash2i(i, 1, 121) * TILE) | 0, ky = (hash2i(i, 2, 121) * TILE) | 0;
    for (let r = 3; r >= 1; r--) {
      const c = r === 1 ? shade(C.log.dark, 0.8) : mix(C.log.base, C.log.dark, 0.5);
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= r) p.set((kx + dx + TILE) % TILE, (ky + dy + TILE) % TILE, c);
      }
    }
  }
}

/* Log, seen from the end: growth rings around a heartwood centre, bark at the
   rim. The ring term is the *dominant* signal — mixing it with fBm at equal
   weight is what turned the end grain into one unreadable dark disc. */
function logTop(p) {
  const c = (TILE - 1) / 2;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const dx = x - c, dy = y - c;
    const d = Math.sqrt(dx * dx + dy * dy) / c;   // 0 at centre, ~1.4 at corners
    if (d > 0.86) {                                // bark ring around the edge
      const t = fbm(x / TILE, y / TILE, 6, 2, 101);
      p.set(x, y, mix(C.log.dark, C.log.base, t * 0.7 + 0.15));
      continue;
    }
    // Growth rings. `rings` is a triangle-ish wave: sharp V at each ring so the
    // lines are thin and distinct. A raw sine spends most of its range near 0
    // when you take a high power of it, which shades the whole face dark — so
    // the wave is remapped to 0..1 first and the darkening only applies in the
    // narrow trough.
    const wobble = (fbm(x / TILE, y / TILE, 5, 2, 131) - 0.5) * 0.05;
    const wave = 0.5 + 0.5 * Math.sin((d + wobble) * Math.PI * 9);
    const rings = 1 - Math.abs(wave * 2 - 1);      // 1 at the ring, 0 between
    let col = mix(C.log.base, C.log.light, 0.25 + rings * 0.5);
    if (rings < 0.30) col = mix(col, C.log.dark, 0.45);   // thin dark ring line
    // heartwood: slightly darker, warmer core
    col = mix(col, C.log.dark, Math.max(0, 1 - d * 2.0) * 0.22);
    p.set(x, y, col);
  }
}

/* Leaves: mottled green with real cutout holes. The holes are what the
   material's alphaTest is for — without an alpha channel, alphaTest is a no-op
   and leaves render as solid green cubes.

   The gap field is thresholded *relative to its own range*. fbm is a weighted
   average of 0..1 values, so its actual output only spans roughly 0.31..0.66 —
   a hardcoded threshold like 0.30 sits below its minimum and cuts nothing at
   all, which is exactly the bug that shipped solid green leaves. Normalising by
   the measured min/max makes the cutout ratio a property of the art rather than
   a magic number. */
const LEAF_GAP = fbmField(3, 2, 141);
function leaves(p) {
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const u = x / TILE, v = y / TILE;
    const gap = LEAF_GAP.norm(y * TILE + x);
    if (gap < 0.28) { p.set(x, y, [0, 0, 0], 0); continue; }
    let c = mix(C.leaves.dark, C.leaves.base, fbm(u, v, 6, 3, 151));
    if (fbm(u, v, 8, 2, 157) > 0.58) c = mix(c, C.leaves.light, 0.55);
    // rim-light the edge of each gap so leaves read as a mass with depth, not a
    // hole-punched sheet
    if (gap < 0.38) c = mix(c, C.leaves.light, 0.35);
    p.set(x, y, c, 255);
  }
}

/* Snow: almost flat, with a cold shadow in the mottle and a few sparkles. */
function snow(p) {
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const u = x / TILE, v = y / TILE;
    const c = mix(C.snow.dark, C.snow.base, fbm(u, v, 3, 2, 161));
    p.set(x, y, c);
  }
  for (let i = 0; i < 12; i++) {
    const x = (hash2i(i, 3, 171) * TILE) | 0, y = (hash2i(i, 4, 171) * TILE) | 0;
    p.set(x, y, C.snow.light);
  }
}

/* Bedrock: chunky and high-contrast, one of the few materials where big
   low-frequency variation is right. */
function bedrock(p) {
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const u = x / TILE, v = y / TILE;
    const n = fbm(u, v, 2, 3, 181, 0.62);
    let c = mix(C.bedrock.dark, C.bedrock.base, n);
    if (fbm(u, v, 5, 2, 191) > 0.68) c = mix(c, C.bedrock.light, 0.7);
    p.set(x, y, c);
  }
}

/* Planks: four horizontal boards with dark seams, grain running *along* each
   board, and staggered end joints.

   Getting the grain direction right means compressing the axis the grain does
   NOT run along — here y — while leaving x at full frequency. Sampling x and y
   equally would give vertical streaks instead, which is the classic mistake and
   looks like paint drips. */
function planks(p) {
  const BOARD = 8;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const board = Math.floor(y / BOARD);
    const inBoard = y % BOARD;
    // grain runs horizontally: x varies fast, y is held nearly constant
    const grain = fbm(x / TILE, (y % BOARD) / BOARD, 10, 3, 201 + board * 17);
    let c = mix(C.planks.dark, C.planks.base, grain * 0.7 + 0.3);
    if (inBoard === 0) c = shade(C.planks.dark, 0.72);          // seam between boards
    else if (inBoard === 1) c = mix(c, C.planks.light, 0.30); // lit top edge
    else if (inBoard === BOARD - 1) c = shade(c, 0.88);            // shadow under it
    p.set(x, y, c);
    // end joint, staggered per board
    const jx = (board * 11 + 7) % TILE;
    if (x === jx && inBoard > 0) p.set(x, y, shade(C.planks.dark, 0.78));
  }
  // nail heads, two per board
  for (let board = 0; board < 4; board++) {
    const y = board * BOARD + 4;
    for (const x of [board % 2 ? 6 : 25, board % 2 ? 25 : 6]) {
      p.set(x, y, shade(C.planks.dark, 0.55));
      p.set(x + 1, y, mix(C.planks.dark, C.planks.light, 0.35));
    }
  }
}

/* Glass: an opaque frame, a lightly tinted pane you can see through, and one
   diagonal highlight streak. The pane alpha is high enough to actually tint —
   too low and the block reads as invisible, which makes glass blocks useless
   to build with. */
function glass(p) {
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const edge = x === 0 || y === 0 || x === TILE - 1 || y === TILE - 1;
    if (edge) { p.set(x, y, C.glass.base, 245); continue; }
    if (x === 1 || y === 1 || x === TILE - 2 || y === TILE - 2) { p.set(x, y, C.glass.dark, 190); continue; }
    // pane: faint tint, with a slight vertical gradient so it catches light
    const tint = 96 + Math.round((1 - y / TILE) * 26);
    p.set(x, y, C.glass.base, tint);
  }
  // highlight streak — the detail that says "glass" more than any tint does
  for (let i = 0; i < 12; i++) {
    for (let k = 0; k < 2; k++) {
      p.set(6 + i + k, 26 - i, C.glass.light, 165);
      p.set(6 + i + k, 25 - i, C.glass.light, 90);
    }
  }
}

/* Brick: four courses, each offset by half a brick from the one below, with
   pale mortar lines. */
function brick(p) {
  const COURSE = 8, BW = 16, MORTAR = 2;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const course = Math.floor(y / COURSE);
    const rowIn = y % COURSE;
    const offset = (course % 2) ? BW / 2 : 0;
    const bx = (((x + offset) % BW) + BW) % BW;
    const inBrick = bx % BW;
    if (rowIn < MORTAR || inBrick < MORTAR) {
      p.set(x, y, mix(0xd8cfc0, 0xbfb3a0, hash2i(x, y, 221) * 0.5));   // mortar
      continue;
    }
    const n = fbm((x + offset) / TILE, y / TILE, 8, 3, 231 + course * 13);
    let c = mix(C.brick.dark, C.brick.base, n);
    if (inBrick === MORTAR + 1) c = mix(c, C.brick.light, 0.45);       // top-lit bevel
    if (rowIn === COURSE - 1) c = shade(c, 0.80);                          // bottom shadow
    p.set(x, y, c);
  }
}

/* Glow: warm base with brighter crystalline cells, so it reads as emitting
   rather than merely being yellow. The cell mask comes from noise, not from a
   shifted integer grid — `((x>>2)+(y>>2))%2` produces hard diagonal seams,
   which is where the grey streaks came from. */
function glow(p) {
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const u = x / TILE, v = y / TILE;
    const base = fbm(u, v, 4, 3, 241);
    let c = mix(C.glow.dark, C.glow.base, base);
    // faceted cells: quantise a mid-frequency field into blobs, then light the
    // facet edges so it catches the eye as glowing mineral
    const facet = fbm(u, v, 5, 2, 251);
    const q = Math.floor(facet * 5) / 4;               // 5 discrete levels
    if (q > 0.5) c = mix(c, C.glow.light, (q - 0.5) * 0.9);
    const edge = Math.abs(facet * 5 - Math.round(facet * 5));
    if (edge < 0.16) c = mix(c, C.glow.light, 0.35);
    if (base > 0.62) c = mix(c, C.glow.light, 0.25);
    p.set(x, y, c);
  }
}

/* Obsidian: near-black with purple facets, lit along their upper edges. */
function obsidian(p) {
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const u = x / TILE, v = y / TILE;
    const r = ridge(u, v, 5, 261);
    let c = mix(C.obsidian.dark, C.obsidian.base, fbm(u, v, 4, 3, 271));
    if (r > 0.9) c = mix(c, C.obsidian.light, 0.75);
    else if (r < 0.14) c = shade(c, 0.7);
    p.set(x, y, c);
  }
}

/* Water scrolls, so it stays out of the atlas and keeps its own repeating
   texture. It must tile seamlessly or the scroll shows a hard jump once per
   repeat.

   The sine's x-frequency has to be a WHOLE number of cycles across the tile: with
   `u * 3` it is 3, which wraps. But the noise was previously added as a phase
   shift of `* 2`, so the total phase at u=1 differed from u=0 by 3 + 2*noise —
   not a multiple of 2*PI — and the seam appeared. Adding the noise as an
   *amplitude* term instead keeps the phase exactly periodic. */
function water(p) {
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const u = x / TILE, v = y / TILE;
    const CYCLES = 3;
    const swell = fbm(u, v, 6, 2, 281);          // tileable, used as amplitude
    const wave = 0.5 + 0.5 * Math.sin(u * CYCLES * Math.PI * 2);
    let c = mix(C.water.dark, C.water.base, wave * 0.45 + swell * 0.35 + 0.1);
    if (wave > 0.86) c = mix(c, C.water.light, 0.55);
    p.set(x, y, c);
  }
}

const PAINTERS = {
  grass_top: grassTop, grass_side: grassSide,
  dirt: dirt, stone: stone, sand: sand,
  log_side: logSide, log_top: logTop,
  leaves: leaves, snow: snow, bedrock: bedrock,
  planks: planks, glass: glass, brick: brick,
  glow: glow, obsidian: obsidian,
  // water is paintable but deliberately NOT in the atlas (see ATLAS_NAMES)
  water: water,
};

/* Tiles that get a cell in the shared atlas. Water is excluded because it
   scrolls its uv offset every frame, which an atlas cell cannot do without
   dragging its neighbours along with it — it keeps a standalone repeating
   texture. */
const ATLAS_NAMES = Object.keys(PAINTERS).filter((n) => n !== 'water');

/* Per-face tile names, in the mesher's face order: +Y -Y +X -X +Z -Z.
   Anything not listed uses the same tile on all six faces. One tile per block is
   the single biggest reason procedural blocks read as "procedural": grass sides
   need dirt under a fringe, and log ends need rings rather than bark.

   Keyed by the game's BLOCK_DEF name ('Grass', 'Log', ...) so the table survives
   a reordering of the BLOCK enum. script.js owns that mapping. */
const PER_FACE = {
  Grass: ['grass_top', 'dirt', 'grass_side', 'grass_side', 'grass_side', 'grass_side'],
  Log:   ['log_top', 'log_top', 'log_side', 'log_side', 'log_side', 'log_side'],
};

/* Precompute a whole-tile fBm field once, with its measured range.
   Two reasons this exists rather than calling fbm() per texel:
     * speed — the field is walked once at module load, not TILE*TILE times per
       texture rebuild
     * correctness — a painter can threshold against a value that means the same
       thing regardless of the noise's incidental range. fbm is a weighted
       average, so it only spans roughly 0.31..0.66 for 2 octaves; a literal
       threshold of 0.3 cuts nothing at all.

   `data` holds the RAW values and `norm()` scales them to 0..1 on demand.
   Returning pre-normalised data instead would let a caller normalise twice and
   silently collapse the range — which is exactly what happened to the leaves. */
function fbmField(period, octaves, seed) {
  const f = new Float32Array(TILE * TILE);
  let lo = Infinity, hi = -Infinity;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const n = fbm(x / TILE, y / TILE, period, octaves, seed);
    f[y * TILE + x] = n;
    if (n < lo) lo = n;
    if (n > hi) hi = n;
  }
  const span = (hi - lo) || 1;
  return { data: f, min: lo, max: hi, norm: (i) => (f[i] - lo) / span };
}

/* ---- atlas assembly ------------------------------------------------------ */
const CELL = {};                       // tile name -> cell index
ATLAS_NAMES.forEach((n, i) => { CELL[n] = i; });

/* Build the finished atlas as a plain RGBA buffer, plus the cell index of each
   tile. Returns `data` sized COLS*ROWS*TILE square. */
function buildAtlas() {
  const size = COLS * TILE;
  const data = new Uint8ClampedArray(size * size * 4);
  ATLAS_NAMES.forEach((name, cell) => {
    const t = buildTile(name);
    const ox = (cell % COLS) * TILE, oy = ((cell / COLS) | 0) * TILE;
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const s = (y * TILE + x) * 4, d = ((oy + y) * size + ox + x) * 4;
        data[d] = t.data[s]; data[d + 1] = t.data[s + 1];
        data[d + 2] = t.data[s + 2]; data[d + 3] = t.data[s + 3];
      }
    }
  });
  return { data, size, cols: COLS, rows: ROWS, tile: TILE };
}

/* Render one named tile into a fresh RGBA buffer. */
function buildTile(name) {
  const paint = PAINTERS[name];
  if (!paint) throw new Error('no painter for tile "' + name + '"');
  const t = tile();
  paint(t);
  return t;
}

const VoxelTextures = {
  TILE, COLS, ROWS, CELL,
  ATLAS_NAMES, PER_FACE, PAINTERS,
  buildAtlas, buildTile,
  // exported for tests
  hash2i, valueNoise, fbm, ridge, mix, rgbOf, PAL, C,
};

root.VoxelTextures = VoxelTextures;
if (typeof module !== 'undefined' && module.exports) module.exports = VoxelTextures;

})(typeof globalThis !== 'undefined' ? globalThis : this);