/* Tests for voxel-verse/textures.js — the block texture generator.

   The old generator scattered Math.random() speckle on a flat colour, which
   meant nothing about it could be asserted: it was different on every run, it
   had no structure to test, and its output could only be judged by eye. These
   tests cover the properties that actually make a texture usable:

     * deterministic — same input, same bytes, every run and every machine
     * tileable — opposite edges match, so large flat areas don't show a seam
     * not flat — every tile has internal luminance variation
     * alpha is meaningful — cutouts are exactly 0 or 255, glass is see-through
     * material-specific — bark has vertical grain, planks have horizontal
     * structurally correct — per-face tiles, atlas layout, every block mapped

   Run: node --test "voxel-verse/*.test.mjs"
*/
import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';

const V = createRequire(import.meta.url)('./textures.js');
const { TILE, COLS, ROWS, CELL, ATLAS_NAMES, PER_FACE, buildTile, buildAtlas,
  hash2i, valueNoise, fbm, ridge, mix, rgbOf, PAL, C } = V;

/* ---------------------------------------------------------------- helpers */

/* Luminance of one texel, 0..255. */
function lum(t, x, y) {
  const i = ((y | 0) * TILE + (x | 0)) * 4;
  return t.data[i] * 0.3 + t.data[i + 1] * 0.6 + t.data[i + 2] * 0.1;
}
function rgb(t, x, y) {
  const i = ((y | 0) * TILE + (x | 0)) * 4;
  return [t.data[i], t.data[i + 1], t.data[i + 2]];
}
function alpha(t, x, y) {
  return t.data[((y | 0) * TILE + (x | 0)) * 4 + 3];
}
/* Luminance range across a whole tile — the "is this actually textured" number. */
function contrast(t) {
  let lo = 255, hi = 0;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const a = alpha(t, x, y);
    if (a === 0) continue;                       // ignore cutouts
    const l = lum(t, x, y);
    if (l < lo) lo = l;
    if (l > hi) hi = l;
  }
  return hi - lo;
}
/* Mean absolute luminance difference between horizontally adjacent texels.
   High = high-frequency detail; low = smooth gradients. */
function horizontalDetail(t) {
  let sum = 0, n = 0;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE - 1; x++) {
    if (alpha(t, x, y) === 0 || alpha(t, x + 1, y) === 0) continue;
    sum += Math.abs(lum(t, x, y) - lum(t, x + 1, y));
    n++;
  }
  return n ? sum / n : 0;
}
function verticalDetail(t) {
  let sum = 0, n = 0;
  for (let y = 0; y < TILE - 1; y++) for (let x = 0; x < TILE; x++) {
    if (alpha(t, x, y) === 0 || alpha(t, x, y + 1) === 0) continue;
    sum += Math.abs(lum(t, x, y) - lum(t, x, y + 1));
    n++;
  }
  return n ? sum / n : 0;
}
const tiles = {};
for (const n of ATLAS_NAMES) tiles[n] = buildTile(n);
const waterTile = buildTile('water');

/* ------------------------------------------------------------ determinism */

test('tiles are byte-for-byte identical across builds', () => {
  // The old generator used Math.random, so every reload produced a different
  // world. Two builds of the same tile must match exactly.
  for (const name of ATLAS_NAMES) {
    const a = buildTile(name), b = buildTile(name);
    assert.deepEqual(Array.from(a.data), Array.from(b.data), `${name} is not deterministic`);
  }
});

test('no painter reaches for Math.random', () => {
  // Guard the property structurally rather than by reading the source: stub the
  // global and confirm every tile is still byte-identical.
  const real = Math.random;
  let called = 0;
  Math.random = () => { called++; return real(); };
  try {
    for (const name of ATLAS_NAMES) buildTile(name);
  } finally {
    Math.random = real;
  }
  assert.equal(called, 0, `textures called Math.random ${called} time(s), so they change per reload`);
});

test('the hash is stable and spreads its inputs out', () => {
  assert.equal(hash2i(3, 7, 11), hash2i(3, 7, 11), 'same input must give same output');
  assert.notEqual(hash2i(3, 7, 11), hash2i(3, 7, 12), 'the seed must matter');
  // Neighbouring lattice points must not correlate, or noise looks like stripes.
  let close = 0;
  for (let i = 0; i < 400; i++) {
    const a = hash2i(i, 0, 5), b = hash2i(i + 1, 0, 5);
    if (Math.abs(a - b) < 0.02) close++;
  }
  assert.ok(close < 20, `${close}/400 neighbours are nearly identical — the hash is correlating`);
});

/* ------------------------------------------------------------- value noise */

test('value noise stays inside 0..1', () => {
  for (let i = 0; i < 500; i++) {
    const n = valueNoise(i * 0.37, i * 0.11, 8, 3);
    assert.ok(n >= 0 && n <= 1, `valueNoise returned ${n}`);
  }
  for (let i = 0; i < 300; i++) {
    const n = fbm((i % 17) / 17, ((i * 7) % 23) / 23, 4, 4, 11);
    assert.ok(n >= 0 && n <= 1, `fbm returned ${n}`);
  }
  const r = ridge(0.3, 0.7, 4, 5);
  assert.ok(r >= 0 && r <= 1, `ridge returned ${r}`);
});

test('value noise is continuous, not a random field', () => {
  // This is the property that separates noise from speckle: a small step in the
  // input must produce a small step in the output. Plain per-pixel hashing fails
  // this outright, which is exactly what the old textures did.
  let worst = 0;
  for (let i = 0; i < 400; i++) {
    const x = i * 0.013;
    worst = Math.max(worst, Math.abs(valueNoise(x, 0.5, 16, 3) - valueNoise(x + 1e-4, 0.5, 16, 3)));
  }
  assert.ok(worst < 0.02, `noise jumps by ${worst} over a 1e-4 step — it is not continuous`);
});

test('noise wraps, so tiles are seamless', () => {
  /* A tile's opposite edges must agree or large flat areas show a seam grid.
     The threshold is a mean-error check rather than a strict per-row one: the
     noise lattice wraps exactly, but a painter may layer a texel-indexed term
     (a pebble, a grain streak) on top, and demanding bit-exact equality on every
     row makes the test fail on harmless single-texel variation. */
  for (const name of ['dirt', 'stone', 'sand', 'grass_top', 'snow', 'bedrock', 'water']) {
    const t = name === 'water' ? waterTile : tiles[name];
    let sum = 0, n = 0, worst = 0;
    for (let y = 0; y < TILE; y++) {
      const d = Math.abs(lum(t, 0, y) - lum(t, TILE - 1, y));
      sum += d; n++; worst = Math.max(worst, d);
    }
    const mean = sum / n;
    assert.ok(mean < 12, `${name}: mean left/right edge difference is ${mean.toFixed(1)} — tile does not wrap`);
    assert.ok(worst < 60, `${name}: worst left/right row differs by ${worst.toFixed(0)}`);
  }
});

/* ------------------------------------------------------------------ colour */

test('mix interpolates and never runs off the ends', () => {
  const a = [0, 0, 0], b = [255, 255, 255];
  assert.deepEqual(mix(a, b, 0), [0, 0, 0]);
  assert.deepEqual(mix(a, b, 1), [255, 255, 255]);
  // |0 truncates toward zero, so 127.5 becomes 127
  assert.deepEqual(mix(a, b, 0.5), [127, 127, 127]);
  assert.deepEqual(mix(b, a, 0.5), [127, 127, 127], 'mixing must be symmetric');
  for (const t of [2, 5, -1]) {
    const c = mix(a, b, t);
    for (let k = 0; k < 3; k++) assert.ok(c[k] >= 0 && c[k] <= 255, `t=${t} escaped 0..255`);
  }
  assert.deepEqual(mix(a, b, 5), [255, 255, 255], 't > 1 must clamp to b');
  assert.deepEqual(mix(a, b, -5), [0, 0, 0], 't < 0 must clamp to a');
});

test('mix accepts rgb arrays, not just hex', () => {
  // This was a real bug: mixHex() bit-shifted its arguments, so passing an
  // already-mixed [r,g,b] produced black. Iterative mixing needs array support.
  const mid = mix([100, 50, 25], [200, 100, 50], 0.5);
  assert.deepEqual(mid, [150, 75, 37]);
  assert.ok(mid[0] > 0 && mid[1] > 0 && mid[2] > 0, 'array mixing produced near-black');
});

test('every palette entry has a dark, base and light that are ordered', () => {
  for (const k in PAL) {
    const c = C[k];
    assert.ok(c, `palette ${k} has no converted colours`);
    assert.ok(c.dark.every((v, i) => v <= c.base[i]), `${k}.dark is not darker than base`);
    assert.ok(c.base.every((v, i) => v <= c.light[i]), `${k}.base is not darker than light`);
  }
});

/* ------------------------------------------------------------ every tile */

test('every tile is painted, and only cutout tiles have holes', () => {
  for (const name of ATLAS_NAMES) {
    const t = tiles[name];
    assert.equal(t.data.length, TILE * TILE * 4, `${name} has the wrong buffer size`);
    // Count texels that are actually visible: alpha > 0. Requiring alpha === 255
    // would wrongly fail glass, which is deliberately translucent.
    let visible = 0;
    for (let i = 0; i < TILE * TILE; i++) if (t.data[i * 4 + 3] > 0) visible++;
    assert.ok(visible > TILE * TILE * 0.6, `${name} is only ${visible}/${TILE * TILE} visible texels`);
    // Nothing may be fully transparent except leaves, which is the only
    // material whose holes are the point.
    if (name !== 'leaves') {
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
        assert.notEqual(alpha(t, x, y), 0, `${name} has a hole at ${x},${y} — only leaves may`);
      }
    }
  }
});

test('every tile has real internal variation', () => {
  // A flat tile reads as untextured no matter what colour it is. The old
  // speckle passed this trivially but for the wrong reason; fBm should pass it
  // with structure.
  for (const name of ATLAS_NAMES) {
    const c = contrast(tiles[name]);
    assert.ok(c > 10, `${name} is nearly flat (contrast ${c.toFixed(1)})`);
  }
});

test('texel colours stay in gamut', () => {
  for (const name of ATLAS_NAMES) {
    for (let i = 0; i < TILE * TILE; i++) {
      for (let k = 0; k < 3; k++) {
        assert.ok(tiles[name].data[i * 4 + k] >= 0 && tiles[name].data[i * 4 + k] <= 255,
          `${name} texel ${i} channel ${k} is out of range`);
      }
    }
  }
});

/* -------------------------------------------------------------- materials */

test('cutouts are binary, so alphaTest has a clean edge', () => {
  // Leaves rely on alphaTest. Partial alpha here would give ragged translucent
  // fringes instead of clean holes.
  const leaves = tiles.leaves;
  let holes = 0, solid = 0;
  for (let i = 0; i < TILE * TILE; i++) {
    const a = leaves.data[i * 4 + 3];
    assert.ok(a === 0 || a === 255, `leaves has partial alpha ${a} — alphaTest will leave fringing`);
    if (a === 0) holes++; else solid++;
  }
  assert.ok(holes > 40, `leaves has only ${holes} cutout texels, not enough to read as foliage`);
  assert.ok(holes < TILE * TILE * 0.5, `leaves is ${holes}/${TILE * TILE} holes — more gap than leaf`);
});

test('glass is see-through but has a solid frame', () => {
  const g = tiles.glass;
  assert.equal(alpha(g, 0, 0), 245, 'the glass frame corner must be nearly opaque');
  /* Sample the pane away from the diagonal highlight, which is painted brighter
     on purpose — checking the centre happened to land exactly on the streak and
     read as opaque. Take the median of the interior instead of one texel. */
  const inside = [];
  for (let y = 3; y < TILE - 3; y++) for (let x = 3; x < TILE - 3; x++) inside.push(alpha(g, x, y));
  inside.sort((a, b) => a - b);
  const median = inside[inside.length >> 1];
  assert.ok(median < 140, `the glass pane median alpha is ${median} — not see-through`);
  assert.ok(median > 30, `the glass pane median alpha is ${median} — glass would be invisible`);
  // every texel needs *some* alpha, or glass vanishes completely
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    assert.ok(alpha(g, x, y) > 0, `glass texel ${x},${y} is fully transparent`);
  }
  // and the highlight streak must actually be brighter than the pane
  const streakMax = Math.max(...Array.from({ length: 24 }, (_, i) => alpha(g, 6 + i, 26 - i)));
  assert.ok(streakMax > median + 30, 'the glass highlight streak is not visible');
});

test('bark grain runs vertically and plank grain runs horizontally', () => {
  /* Direction is what makes wood read as wood, and the test has to be phrased
     carefully: "vertical grain" means the streaks are elongated *along* y, so
     colour changes slowly as you walk down a column. That makes adjacent rows
     SIMILAR and adjacent columns DIFFERENT — so vertical grain shows up as high
     horizontal detail, not high vertical detail. Getting this backwards makes the
     assertion pass for the wrong material entirely. */
  const bark = tiles.log_side, plank = tiles.planks;
  assert.ok(horizontalDetail(bark) > verticalDetail(bark),
    `log_side should vary faster across than down (h=${horizontalDetail(bark).toFixed(1)} v=${verticalDetail(bark).toFixed(1)}) — grain is not vertical`);
  assert.ok(verticalDetail(plank) > horizontalDetail(plank),
    `planks should vary faster down than across (v=${verticalDetail(plank).toFixed(1)} h=${horizontalDetail(plank).toFixed(1)}) — grain is not horizontal`);
});

test('log ends show concentric rings, not a dark disc', () => {
  // The earlier version mixed the ring term at equal weight with fBm and applied
  // a power curve that spent most of its range near zero, which turned the whole
  // face into one unreadable dark blob.
  const t = tiles.log_top;
  const c = (TILE - 1) / 2;
  assert.ok(contrast(t) > 20, `log_top has too little contrast (${contrast(t).toFixed(1)})`);
  // brightness must vary with distance from the centre — that is what a ring is
  const centre = lum(t, Math.round(c), Math.round(c));
  const ring = lum(t, Math.round(c) + 6, Math.round(c));
  const rim = lum(t, 3, Math.round(c));
  assert.ok(Math.abs(centre - ring) > 8 || Math.abs(ring - rim) > 8,
    `log_top luminance is flat from centre (${centre.toFixed(0)}) to rim (${rim.toFixed(0)}) — no rings`);
  // and the corners (outside the bark rim) must be bark-coloured, not black
  assert.ok(lum(t, 0, 0) > 20, `log_top corner is black (${lum(t, 0, 0).toFixed(0)})`);
});

test('grass sides are dirt with a grass fringe along the top', () => {
  const t = tiles.grass_side;
  const isGreen = (x, y) => { const p = rgb(t, x, y); return p[1] > p[0] && p[1] > p[2]; };
  // the top row must be entirely grass
  let topGreen = 0;
  for (let x = 0; x < TILE; x++) if (isGreen(x, 0)) topGreen++;
  assert.equal(topGreen, TILE, `only ${topGreen}/${TILE} texels in the top row are grass`);
  // and the bottom row must be entirely dirt
  let bottomGreen = 0;
  for (let x = 0; x < TILE; x++) if (isGreen(x, TILE - 1)) bottomGreen++;
  assert.equal(bottomGreen, 0, `${bottomGreen}/${TILE} texels in the bottom row are still grass — no dirt below the fringe`);
  // the fringe must not be a flat band: its depth has to vary per column
  const depths = [];
  for (let x = 0; x < TILE; x++) {
    let d = 0;
    while (d < TILE && isGreen(x, d)) d++;
    depths.push(d);
  }
  assert.ok(Math.max(...depths) - Math.min(...depths) >= 2,
    `fringe depth is a constant ${depths[0]}px — it reads as a printed stripe`);
  assert.ok(Math.min(...depths) >= 4 && Math.max(...depths) <= 16,
    `fringe depth ranges ${Math.min(...depths)}..${Math.max(...depths)}, expected a band in the upper third`);
});

test('planks have horizontal seams and brick has offset courses', () => {
  /* Sample a row *inside* a board, not on the seam line: planks draw the seam at
     y % 8 === 0, so every other row of a course is uniformly dark and a naive
     "find dark pixels" probe reports zero structure on the rows that matter. */
  const plank = tiles.planks;
  const rowMean = (y) => { let s = 0; for (let x = 0; x < TILE; x++) s += lum(plank, x, y); return s / TILE; };
  /* Compare row *means*, not per-texel extremes: a plank row legitimately
     contains dark vertical end joints, so a "no texel below X" probe measures
     the joints rather than the board face. */
  const seamMean = rowMean(8), faceMean = rowMean(5);
  assert.ok(seamMean < faceMean * 0.75,
    `seam row mean ${seamMean.toFixed(0)} vs face ${faceMean.toFixed(0)} — boards are not separated`);
  // seams repeat every 8 rows, at the top of each board
  for (const y of [0, 8, 16, 24]) {
    assert.ok(rowMean(y) < faceMean * 0.75, `row ${y} should be a seam, mean ${rowMean(y).toFixed(0)}`);
  }
  // the lit top edge of each board sits just below its seam
  assert.ok(lum(plank, 4, 9) > lum(plank, 4, 8) * 1.2, 'the board edge is not lit');

  // brick: staggered courses, so the vertical mortar joints move between rows
  const jointsIn = (row) => {
    let n = 0;
    for (let x = 0; x < TILE; x++) {
      const p = rgb(tiles.brick, x, row);
      if (p[0] > p[1] && p[1] > p[2] && p[0] > 150) n++;   // pale grey, not red
    }
    return n;
  };
  const a = jointsIn(5), b = jointsIn(13);
  assert.ok(a >= 2 && b >= 2, `brick vertical joints: row 5 has ${a}, row 13 has ${b}`);
  // and they must not be at the same x, or the courses are not offset
  const firstJoint = (row) => { for (let x = 0; x < TILE; x++) { const p = rgb(tiles.brick, x, row); if (p[0] > p[1] && p[1] > p[2] && p[0] > 150) return x; } return -1; };
  assert.notEqual(firstJoint(5), firstJoint(13), 'brick courses line up vertically instead of being staggered');
});

test('glow and snow are bright, bedrock and obsidian are dark', () => {
  // Materials whose whole job is to be bright or dark. If a palette edit goes
  // wrong, this is the canary.
  const meanLum = (t) => {
    let s = 0, n = 0;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      if (alpha(t, x, y) === 0) continue;
      s += lum(t, x, y); n++;
    }
    return s / n;
  };
  assert.ok(meanLum(tiles.glow) > 120, `glow is too dark (${meanLum(tiles.glow).toFixed(0)})`);
  assert.ok(meanLum(tiles.snow) > 190, `snow is too dark (${meanLum(tiles.snow).toFixed(0)})`);
  assert.ok(meanLum(tiles.sand) > 150, `sand is too dark (${meanLum(tiles.sand).toFixed(0)})`);
  assert.ok(meanLum(tiles.bedrock) < 70, `bedrock is too bright (${meanLum(tiles.bedrock).toFixed(0)})`);
  assert.ok(meanLum(tiles.obsidian) < 70, `obsidian is too bright (${meanLum(tiles.obsidian).toFixed(0)})`);
});

test('water is tileable and blue, since it scrolls', () => {
  assert.equal(waterTile.data.length, TILE * TILE * 4);
  /* The sine's x-frequency must be a whole number of cycles across the tile.
     It used to be `sin((u*3 + noise*2) * 2PI)`, where the noise was a *phase*
     shift: the phase at u=1 then differed from u=0 by a non-integer number of
     cycles and the texture did not tile, so the scroll showed a hard jump. */
  let sum = 0, n = 0;
  for (let y = 0; y < TILE; y++) {
    const d = Math.abs(lum(waterTile, 0, y) - lum(waterTile, TILE - 1, y));
    sum += d; n++;
  }
  assert.ok(sum / n < 8, `water edges differ by ${(sum / n).toFixed(1)} on average — it does not tile`);
  let blue = 0;
  for (let i = 0; i < TILE * TILE; i++) {
    if (waterTile.data[i * 4 + 2] > waterTile.data[i * 4]) blue++;
  }
  assert.ok(blue > TILE * TILE * 0.9, `only ${blue}/${TILE * TILE} water texels read as blue`);
});

/* ----------------------------------------------------------- per-face art */

test('grass and logs get different tiles per face', () => {
  // One tile on all six faces is the single biggest reason procedural blocks
  // look procedural: grass needs a top and a fringed side, logs need rings.
  for (const name of Object.keys(PER_FACE)) {
    const faces = PER_FACE[name];
    assert.equal(faces.length, 6, `${name} must specify all six faces`);
    for (const f of faces) {
      assert.ok(typeof f === 'string', `${name} face has a non-string tile name: ${f}`);
      assert.ok(CELL[f] !== undefined, `${name} references unknown tile "${f}"`);
    }
    assert.notDeepEqual(faces[0], faces[2],
      `${name} uses the same tile on top and side — it needs distinct art`);
  }
});

test('every PER_FACE tile exists as a painter', () => {
  for (const name of Object.keys(PER_FACE)) {
    for (const f of PER_FACE[name]) {
      assert.doesNotThrow(() => buildTile(f), `${name} references tile "${f}" with no painter`);
    }
  }
});

/* ------------------------------------------------------------------ atlas */

test('the atlas lays every tile out without overlapping', () => {
  const atlas = buildAtlas();
  assert.equal(atlas.size, COLS * TILE, 'atlas is not COLS tiles wide');
  assert.equal(atlas.size, ROWS * TILE, 'atlas is not ROWS tiles tall');
  assert.equal(atlas.data.length, atlas.size * atlas.size * 4, 'atlas buffer is the wrong size');
  assert.ok(ATLAS_NAMES.length <= COLS * ROWS,
    `${ATLAS_NAMES.length} tiles do not fit in a ${COLS}x${ROWS} grid`);

  // Each cell must equal its standalone tile, or the atlas blit is off.
  for (let c = 0; c < ATLAS_NAMES.length; c++) {
    const standalone = buildTile(ATLAS_NAMES[c]);
    const ox = (c % COLS) * TILE, oy = ((c / COLS) | 0) * TILE;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const s = (y * TILE + x) * 4, d = ((oy + y) * atlas.size + ox + x) * 4;
      for (let k = 0; k < 4; k++) {
        assert.equal(atlas.data[d + k], standalone.data[s + k],
          `cell ${c} (${ATLAS_NAMES[c]}) differs from its standalone tile at ${x},${y}`);
      }
    }
  }
});

test('atlas cells are unique and contiguous from zero', () => {
  ATLAS_NAMES.forEach((n, i) => assert.equal(CELL[n], i, `${n} should be cell ${i}`));
  const used = Object.values(CELL);
  assert.equal(new Set(used).size, used.length, 'two tiles share a cell');
});

test('water is not in the atlas, because it scrolls', () => {
  assert.ok(!ATLAS_NAMES.includes('water'), 'water must not occupy an atlas cell');
  assert.equal(CELL.water, undefined, 'water must not be in the CELL table');
  assert.ok(V.PAINTERS.water, 'but water still needs a painter for its standalone texture');
});

test('the atlas is sized to the tiles we use, not padded out to a power of two', () => {
  /* The old 16x16 layout used 13 of 256 cells — 95% empty canvas, 4x the memory
     for nothing, and the reason mipmapping darkened distant terrain. The grid
     should hug the tile count: full enough that adding a tile doesn't silently
     overflow, tight enough that the waste is bounded. */
  const usage = ATLAS_NAMES.length / (COLS * ROWS);
  assert.ok(usage >= 0.6, `atlas is only ${(usage * 100).toFixed(0)}% used — wasted memory`);
  assert.ok(usage < 1, `atlas is exactly full (${usage * 100}%) — adding a tile will overflow`);
  // and the atlas must be small in absolute terms
  const size = COLS * TILE;
  assert.ok(size <= 256, `atlas is ${size}x${size}; ${ATLAS_NAMES.length} tiles do not need this much`);
});

test('buildTile rejects an unknown tile rather than returning blank art', () => {
  // A typo in the tile table used to mean a transparent tile, which renders as a
  // hole in the world with no error anywhere.
  assert.throws(() => buildTile('nope'), /no painter/);
});