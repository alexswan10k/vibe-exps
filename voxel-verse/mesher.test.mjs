/* Tests for voxel-verse/mesher.js — the code the browser actually loads.
   Run:  node --test voxel-verse/

   mesher.js publishes a global and also assigns module.exports when it can
   see one, so this exercises the shipped file rather than a copy.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const V = createRequire(import.meta.url)(join(here, 'mesher.js'));

const { CHUNK, Y0, Y1, YS, PW, createScratch, fillPadded, computeLight, mesh, raycast, faceHidden } = V;

/* --- tiny block type table: 0 air, 1 stone, 2 water, 3 leaves, 4 glass --- */
const NB = 5;
const OPAQUE = new Uint8Array(NB); OPAQUE[1] = 1;              // stone only
const LIQUID = new Uint8Array(NB); LIQUID[2] = 1;              // water
const ATTEN = new Uint8Array(NB); ATTEN[2] = 2; ATTEN[3] = 1;
const BUCKET = new Uint8Array(NB);
const CELL = new Int8Array(NB * 6).fill(0);
const cfg = { opaque: OPAQUE, liquid: LIQUID, bucket: BUCKET, cell: CELL, buckets: 1, water: 2, sea: -999 };

/* Build a world out of a sparse map and mesh it as a single chunk at (0,0). */
function build(map, over) {
  const get = (x, y, z) => { const v = map.get(`${x},${y},${z}`); return v === undefined ? 0 : v; };
  const s = createScratch();
  fillPadded(s, 0, 0, get);
  computeLight(s, OPAQUE, ATTEN);
  return { s, result: mesh(s, over ? { ...cfg, ...over } : cfg), get };
}
/* Pin the skylight term to a constant so vertex colour becomes a pure function
   of ambient occlusion times face shading — which makes AO ratios exact. */
const AO_ONLY = { lightMin: 0.75, lightRange: 0 };
const key = (x, y, z) => `${x},${y},${z}`;

/* Read a value out of a padded volume by *world* coordinates. The padded
   volume carries a 1-cell ring, so world x sits at index x+1. */
function pad(s, arr, x, y, z) {
  const ly = y - Y0;
  if (ly < 0 || ly >= YS) return null;
  return arr[ly * PW * PW + (z + 1) * PW + (x + 1)];
}
const lightAt = (s, x, y, z) => pad(s, s.pl, x, y, z);

/* ---------------------------------------------------------------- winding */

test('every face is wound counter-clockwise seen from outside', () => {
  for (let f = 0; f < 6; f++) {
    const c = V.faceCorners[f];
    const n = V.FACE_N[f];
    const sub = (a, b) => a.map((v, i) => v - b[i]);
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const d = cross(sub(c[1], c[0]), sub(c[2], c[0]));
    const dot = d[0] * n[0] + d[1] * n[1] + d[2] * n[2];
    assert.equal(dot, 1, `face ${f} cross product must point along the normal`);
  }
});

/* ------------------------------------------------------------ face culling */

test('face culling rules', () => {
  const h = (a, b) => faceHidden(a, b, OPAQUE, LIQUID);
  assert.equal(h(1, 0), false, 'stone against air is visible');
  assert.equal(h(1, 1), true, 'stone against stone is buried');
  assert.equal(h(1, 2), false, 'stone beside water stays visible — it is the sea floor');
  assert.equal(h(1, 3), false, 'stone beside leaves stays visible (leaves are a shell)');
  assert.equal(h(1, 4), false, 'stone behind glass is visible, so you can see it through the pane');
  assert.equal(h(2, 0), false, 'water surface is visible');
  assert.equal(h(2, 1), true, 'water against stone is hidden — the stone already covers it');
  assert.equal(h(2, 2), true, 'internal water faces are dropped');
  assert.equal(h(2, 4), false, 'water against glass stays visible');
  assert.equal(h(2, 3), false, 'water against leaves stays visible');
  assert.equal(h(3, 3), true, 'leaf canopy keeps only its shell');
  assert.equal(h(3, 1), true, 'leaf against stone is hidden');
  assert.equal(h(3, 4), true, 'leaf against glass is buried');
  assert.equal(h(4, 4), true, 'glass against glass is merged');
  assert.equal(h(4, 1), true, 'glass against stone is hidden');
  assert.equal(h(0, 0), false, 'air never draws anything');
});

/* ------------------------------------------------------------ face counts */

test('a lone block emits 6 faces', () => {
  const { result } = build(new Map([[key(4, 4, 4), 1]]));
  assert.equal(result.buckets[0].quads, 6);
  assert.equal(result.tris, 12);
});

test('interior faces of a solid block are dropped', () => {
  const m = new Map();
  for (let x = 3; x <= 5; x++) for (let y = 3; y <= 5; y++) for (let z = 3; z <= 5; z++) m.set(key(x, y, z), 1);
  const { result } = build(m);
  // 3x3x3 solid: 27 blocks, only the 6*9 = 54 outside faces survive
  assert.equal(result.blocks, 27);
  assert.equal(result.buckets[0].quads, 54);
});

test('a buried block costs nothing but its own footprint', () => {
  const withCentre = new Map();
  const without = new Map();
  for (let x = 3; x <= 5; x++) for (let y = 3; y <= 5; y++) for (let z = 3; z <= 5; z++) {
    withCentre.set(key(x, y, z), 1);
    if (x !== 4 || y !== 4 || z !== 4) without.set(key(x, y, z), 1);
  }
  // Filling the hollow middle buries its 6 inner faces, so the solid cube is
  // *cheaper* despite having one more block.
  assert.equal(build(without).result.tris - build(withCentre).result.tris, 12);
});

test('a 2x2x1 slab emits 16 faces', () => {
  const m = new Map();
  for (let x = 0; x < 2; x++) for (let z = 0; z < 2; z++) m.set(key(x, 4, 0 + z), 1);
  const { result } = build(m);
  assert.equal(result.buckets[0].quads, 16);
});

test('glass merges into itself but still shows its shell', () => {
  const m = new Map();
  m.set(key(2, 2, 2), 4); m.set(key(3, 2, 2), 4);
  const { result } = build(m);
  assert.equal(result.buckets[0].quads, 10);
});

/* -------------------------------------------------------------- geometry */

test('positions land on the lattice and normals are axis-aligned', () => {
  const { result } = build(new Map([[key(4, 4, 4), 1]]));
  const p = result.buckets[0].pos, n = result.buckets[0].nrm;
  assert.equal(p.length % 3, 0);
  for (let i = 0; i < p.length; i++) assert.ok(Number.isInteger(p[i]), 'vertex coords are whole numbers');
  for (let i = 0; i < n.length; i += 3) {
    const len = Math.abs(n[i]) + Math.abs(n[i + 1]) + Math.abs(n[i + 2]);
    assert.equal(len, 1);
  }
});

test('indices reference existing vertices and stay in range', () => {
  const m = new Map();
  for (let x = 0; x < 6; x++) for (let z = 0; z < 6; z++) m.set(key(x, 3, z), 1);
  const { result } = build(m);
  const g = result.buckets[0];
  const verts = g.pos.length / 3;
  assert.equal(g.idx.length, g.quads * 6);
  for (const i of g.idx) assert.ok(i >= 0 && i < verts);
});

test('an exposed water surface sits slightly below the block top', () => {
  const { result } = build(new Map([[key(4, 4, 4), 2]]));
  const p = result.buckets[0].pos;
  const SURFACE = 4 + 1 - 0.12; // the exposed surface is dropped by an eighth
  // collect the water block's own vertices (x and z span 4..5)
  const verts = [];
  for (let i = 0; i < p.length; i += 3) {
    if (p[i] >= 4 && p[i] <= 5 && p[i + 2] >= 4 && p[i + 2] <= 5) verts.push([p[i], p[i + 1], p[i + 2]]);
  }
  assert.equal(verts.length, 24, 'all six faces emitted');
  const top = verts.filter(v => Math.abs(v[1] - SURFACE) < 1e-6);
  assert.equal(top.length, 12, 'top face + four side tops reach the lowered surface');
  const bottom = verts.filter(v => v[1] === 4);
  assert.equal(bottom.length, 12, 'bottom face plus the side bases stay at y=4');
  // nothing pokes above the dropped surface
  assert.ok(Math.max(...verts.map(v => v[1])) < 5, 'no vertex above the water line');
});

/* ------------------------------------------------------------------- AO */

/* Geometry is emitted in blocks (scanning y, then z, then x) and within a block
   in face order +Y -Y +X -X +Z -Z, 4 verts each. So the faces of the nth block
   occupy verts [n*24, n*24+24). Most tests here place exactly one block, so
   block 0 is unambiguous. */
function faceVerts(g, blockIndex, face) {
  const out = [];
  for (let k = 0; k < 4; k++) {
    const v = blockIndex * 24 + face * 4 + k;
    out.push({
      pos: [g.pos[v * 3], g.pos[v * 3 + 1], g.pos[v * 3 + 2]],
      nrm: [g.nrm[v * 3], g.nrm[v * 3 + 1], g.nrm[v * 3 + 2]],
      uv: [g.uv[v * 2], g.uv[v * 2 + 1]],
      shade: g.col[v * 3 + 1],
    });
  }
  return out;
}

/* Shade of a specific vertex, located by position AND the face it belongs to —
   position alone is ambiguous because several faces share each corner. */
function shadeAt(g, blockIndex, face, p) {
  return faceVerts(g, blockIndex, face).find(v => v.pos.join(',') === p.join(','))?.shade;
}

test('ambient occlusion darkens only the corners a neighbour covers', () => {
  // one block with neighbours above and beside it on the +x side
  const m = new Map([
    [key(4, 4, 4), 1],
    [key(5, 5, 4), 1],
    [key(5, 4, 5), 1],
  ]);
  const { result } = build(m, AO_ONLY);
  const g = result.buckets[0];
  const plusX = faceVerts(g, 0, 2); // face index 2 is +X
  for (const v of plusX) assert.deepEqual(v.nrm, [1, 0, 0]);

  // corner (x=1,y=1,z=1) of the +x face has a solid on both tangent sides
  const byPos = new Map(plusX.map(v => [v.pos.join(','), v.shade]));
  const deep = byPos.get('5,5,5');      // occluded on both sides -> ao 0
  const mid = byPos.get('5,5,4');       // one side -> ao 2
  const open = byPos.get('5,4,4');      // neither -> ao 3
  assert.ok(deep < mid, `deep ${deep} < mid ${mid}`);
  assert.ok(mid < open, `mid ${mid} < open ${open}`);
  // AO_LUT ratios 0.42 / 0.82 / 1.0
  assert.ok(Math.abs(mid / open - 0.82) < 1e-6, `mid ratio ${mid / open}`);
  assert.ok(Math.abs(deep / open - 0.42) < 1e-6, `deep ratio ${deep / open}`);
  assert.equal(plusX.length, 4);
});

test('a corner covered by two solids is darker than one covered by a single solid', () => {
  // both cases put block 0 at (4,4,4) with a neighbour above-right of it
  const both = build(new Map([
    [key(4, 4, 4), 1], [key(5, 5, 4), 1], [key(5, 4, 5), 1],
  ]), AO_ONLY).result.buckets[0];
  const one = build(new Map([
    [key(4, 4, 4), 1], [key(5, 5, 4), 1],
  ]), AO_ONLY).result.buckets[0];
  // the +x face of block 0, corner (5,5,5): two occluders -> ao 0, one -> ao 2
  assert.ok(shadeAt(both, 0, 2, [5, 5, 5]) < shadeAt(one, 0, 2, [5, 5, 5]),
    'two occluders darken the shared corner further');
  // AO_LUT[0]=0.42 vs AO_LUT[2]=0.82
  assert.ok(Math.abs(shadeAt(both, 0, 2, [5, 5, 5]) / shadeAt(one, 0, 2, [5, 5, 5]) - 0.42 / 0.82) < 1e-6);
});

test('an isolated block has no ambient occlusion, only face shading', () => {
  const { result } = build(new Map([[key(4, 4, 4), 1]]), AO_ONLY);
  const g = result.buckets[0];
  // FACE_SHADE is [+y 1.00, -y 0.50, +x/-x 0.82, +z/-z 0.88]
  const expect = { 0: 0.75, 1: 0.75 * 0.50, 2: 0.75 * 0.82, 3: 0.75 * 0.82, 4: 0.75 * 0.88, 5: 0.75 * 0.88 };
  for (const [face, want] of Object.entries(expect)) {
    for (const v of faceVerts(g, 0, Number(face))) {
      assert.ok(Math.abs(v.shade - want) < 1e-6, `face ${face} shade ${v.shade} != ${want}`);
    }
  }
});

test('face shading and ambient occlusion are independent', () => {
  // same scene, light pinned vs. light free: AO ratios must survive either way
  const m = new Map([[key(4, 4, 4), 1], [key(5, 5, 4), 1], [key(5, 4, 5), 1]]);
  const lit = build(m).result.buckets[0];
  const pinned = build(m, AO_ONLY).result.buckets[0];
  for (let i = 0; i < lit.pos.length / 3; i++) {
    assert.deepEqual(lit.pos.slice(i * 3, i * 3 + 3), pinned.pos.slice(i * 3, i * 3 + 3));
  }
  // the ordering of corners is preserved; only the absolute values change
  const rank = (g) => {
    const idx = [];
    for (let i = 0; i < g.pos.length / 3; i++) {
      if (g.nrm[i * 3] !== 1) continue;
      idx.push([g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2], g.col[i * 3 + 1]]);
    }
    return idx.sort((a, b) => a[3] - b[3]).map(v => v.slice(0, 3).join(',')).join('|');
  };
  assert.equal(rank(lit), rank(pinned));
});

/* ----------------------------------------------------------------- light */

test('open sky is full strength', () => {
  const { s } = build(new Map([[key(5, 5, 5), 1]]));
  assert.equal(lightAt(s, 5, 6, 5), 15);
});

test('a sealed pocket gets no light at all', () => {
  const m = new Map();
  for (let x = 4; x <= 6; x++) for (let y = 4; y <= 6; y++) for (let z = 4; z <= 6; z++) m.set(key(x, y, z), 1);
  m.delete(key(5, 5, 5)); // hollow centre
  const { s } = build(m);
  assert.equal(lightAt(s, 5, 5, 5), 0);
});

/* A corridor running along x, completely sealed except for one doorway, so
   daylight can only reach the interior through that opening.

     x = 2..8, z = 4..6   floor at y=2, roof at y=5
     x = 2..8             side walls at z=4 and z=6 for y=3,4
     x = 2..8, z=5        hollow interior at y=3,4
     x = 1                solid end cap, y=2..5
     x = 9                solid wall, y=2..5, minus a doorway at y=3,4, z=5 */
function corridorMap() {
  const m = new Map();
  for (let x = 2; x <= 8; x++) {
    for (const z of [4, 5, 6]) {
      m.set(key(x, 2, z), 1);   // floor
      m.set(key(x, 5, z), 1);   // roof
    }
    m.set(key(x, 3, 4), 1);     // side walls
    m.set(key(x, 4, 4), 1);
    m.set(key(x, 3, 6), 1);
    m.set(key(x, 4, 6), 1);
    m.set(key(x, 3, 5), 0);     // hollow interior
    m.set(key(x, 4, 5), 0);
  }
  for (let y = 2; y <= 5; y++) for (const z of [4, 5, 6]) m.set(key(1, y, z), 1);
  for (let y = 2; y <= 5; y++) for (const z of [4, 5, 6]) m.set(key(9, y, z), 1);
  m.set(key(9, 3, 5), 0);       // the doorway
  m.set(key(9, 4, 5), 0);
  return m;
}

test('light falls off with distance from an opening', () => {
  const { s } = build(corridorMap());
  // x=10 is open sky, x=9 is the doorway, x=2 is the far end
  assert.equal(lightAt(s, 10, 4, 5), 15, 'open air outside is full daylight');
  assert.ok(lightAt(s, 9, 4, 5) > lightAt(s, 5, 4, 5), 'brighter at the doorway');
  assert.ok(lightAt(s, 5, 4, 5) > lightAt(s, 2, 4, 5), 'dimmer at the far end');
  // Skylight loses one level per cell it travels sideways, so 6 cells in from
  // the door is around 8-9 — dim, but not black. This is why the game hands you
  // glowstone: a light source is the answer to a dark corridor, not more sky.
  assert.ok(lightAt(s, 2, 4, 5) >= 6, `far end is dim but visible: ${lightAt(s, 2, 4, 5)}`);
  assert.ok(lightAt(s, 2, 3, 5) < lightAt(s, 9, 3, 5), 'floor of the tunnel is darker near the far end');
});

test('a long tunnel goes properly dark', () => {
  const { s } = build(corridorMap());
  const at = (x) => lightAt(s, x, 4, 5);
  assert.ok(at(2) <= 9, `far end of the tunnel is dark: ${at(2)}`);
  assert.ok(at(2) < at(4) && at(4) < at(6) && at(6) < at(9), `monotonic falloff: ${[2, 4, 6, 9].map(at)}`);
});

test('light does not leak through a floor', () => {
  // a slab spanning the whole padded volume, so there is no side path in
  const m = new Map();
  for (let x = -1; x <= CHUNK; x++) for (let z = -1; z <= CHUNK; z++) m.set(key(x, 5, z), 1);
  const { s } = build(m);
  assert.equal(lightAt(s, 5, 6, 5), 15, 'above the slab is open sky');
  assert.equal(lightAt(s, 5, 4, 5), 0, 'below the slab is pitch dark');
});

test('a doorway in a sealed room lights it from one side', () => {
  // a 7x7 room, floor y=2, ceiling y=6, walls at x=3/9 and z=3/9,
  // with a single doorway punched through the +x wall at y=4, z=6
  const m = new Map();
  for (let x = 3; x <= 9; x++) for (let z = 3; z <= 9; z++) {
    m.set(key(x, 2, z), 1);
    m.set(key(x, 6, z), 1);
    const wall = x === 3 || x === 9 || z === 3 || z === 9;
    if (!wall) continue;
    for (let y = 3; y <= 5; y++) m.set(key(x, y, z), 1);
  }
  for (let y = 3; y <= 5; y++) m.set(key(9, y, 6), 0); // carve the doorway
  const { s } = build(m);
  const near = lightAt(s, 8, 4, 6);   // just inside the doorway
  const far = lightAt(s, 4, 4, 6);    // far wall
  const centre = lightAt(s, 6, 4, 6);
  assert.ok(near > centre, `brighter by the door (${near} vs ${centre})`);
  assert.ok(centre > far, `and fading toward the far wall (${centre} vs ${far})`);
  assert.ok(far >= 8, `a small room stays usable at the far end: ${far}`);
  assert.equal(lightAt(s, 6, 4, 6), lightAt(s, 6, 3, 6), 'light is even across an open floor');
});

test('water attenuates light with depth', () => {
  const m = new Map();
  for (let y = 1; y <= 4; y++) m.set(key(5, y, 5), 2); // water column, open above
  m.set(key(5, 0, 5), 1);                               // floor
  const { s } = build(m);
  const seq = [4, 3, 2, 1].map(y => lightAt(s, 5, y, 5));
  for (let i = 1; i < seq.length; i++) assert.ok(seq[i] < seq[i - 1], `must dim downward: ${seq}`);
  assert.equal(seq[0], 13, 'the water surface loses 2 levels entering the water');
  assert.equal(seq[3], 7, 'four blocks of water costs 8 levels');
  assert.equal(lightAt(s, 5, 5, 5), 15, 'the air above the water is full daylight');
});

/* --------------------------------------------------------------- raycast */

test('raycast agrees with a brute-force sampler', () => {
  const m = new Map();
  m.set(key(8, 4, 4), 1);
  m.set(key(4, 4, 8), 1);
  const get = (x, y, z) => { const v = m.get(key(x, y, z)); return v === undefined ? 0 : v; };
  const brute = (o, d, max) => {
    // skip the origin cell to match DDA semantics (you can't hit a face you
    // are already behind)
    const oCell = o.map(Math.floor);
    for (let t = 0; t <= max; t += 0.005) {
      const c = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t].map(Math.floor);
      if (c[0] === oCell[0] && c[1] === oCell[1] && c[2] === oCell[2]) continue;
      if (get(c[0], c[1], c[2])) return { t, x: c[0], y: c[1], z: c[2] };
    }
    return null;
  };
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0.6, 0.8, 0], [0.3, -0.5, 0.81], [1, 1, 1]];
  for (const d of dirs) {
    const len = Math.hypot(...d);
    const u = d.map(v => v / len);
    for (const o of [[4.5, 4.5, 4.5], [0.5, 4.5, 4.5], [7.5, 4.5, 4.5]]) {
      const a = brute(o, u, 12), b = raycast(o[0], o[1], o[2], u[0], u[1], u[2], 12, get);
      assert.equal(!!b, !!a, `hit/miss mismatch for ${d} from ${o}`);
      if (a && b) {
        assert.deepEqual([b.x, b.y, b.z], [a.x, a.y, a.z], `cell mismatch for ${d} from ${o}`);
        assert.ok(Math.abs(b.dist - a.t) < 0.02, `distance ${b.dist} vs ${a.t}`);
      }
    }
  }
});

test('raycast reports the face it entered through', () => {
  const m = new Map([[key(8, 4, 4), 1]]);
  const get = (x, y, z) => (m.get(key(x, y, z)) ? 1 : 0);
  const hit = raycast(4.5, 4.5, 4.5, 1, 0, 0, 12, get);
  assert.deepEqual([hit.x, hit.y, hit.z], [8, 4, 4]);
  assert.deepEqual([hit.nx, hit.ny, hit.nz], [-1, 0, 0]);
  assert.equal(hit.type, 1);
  const up = raycast(4.5, 4.5, 4.5, 0, -1, 0, 12, get);
  assert.equal(up, null, 'nothing above');
});

test('raycast respects maxDist', () => {
  const get = (x, y, z) => (x === 8 && z === 4 ? 1 : 0);
  assert.equal(raycast(4.5, 4.5, 4.5, 1, 0, 0, 3, get), null);
  assert.ok(raycast(4.5, 4.5, 4.5, 1, 0, 0, 5, get));
});

test('raycast skips the cell it starts inside (matches front-face picking)', () => {
  const get = (x, y, z) => (x === 0 || x === 2 ? 1 : 0);
  const hit = raycast(0.5, 0.5, 0.5, 1, 0, 0, 8, get);
  assert.deepEqual([hit.x, hit.y, hit.z], [2, 0, 0]);
});

test('raycast handles a ray travelling straight down a column', () => {
  const get = (x, y, z) => (y === 4 ? 1 : 0);
  const hit = raycast(2.2, 9.5, 3.9, 0, -1, 0, 12, get);
  assert.deepEqual([hit.x, hit.y, hit.z], [2, 4, 3]);
  assert.deepEqual([hit.nx, hit.ny, hit.nz], [0, 1, 0]);
});

/* ---------------------------------------------------- determinism & scale */

test('meshing is deterministic', () => {
  const m = new Map();
  for (let x = 0; x < 12; x++) for (let z = 0; z < 12; z++) {
    m.set(key(x, 1 + (x * 7 + z * 3) % 5, z), (x + z) % 3 === 0 ? 2 : 1);
  }
  const a = build(m).result.buckets[0];
  const b = build(m).result.buckets[0];
  assert.deepEqual(a.pos, b.pos);
  assert.deepEqual(a.col, b.col);
  assert.deepEqual(a.idx, b.idx);
});

test('flat terrain emits far fewer triangles than a cube per block', () => {
  const m = new Map();
  for (let x = 0; x < CHUNK; x++) for (let z = 0; z < CHUNK; z++) m.set(key(x, 4, z), 1);
  const { result } = build(m);
  const oldTris = 256 * 12; // the previous renderer: one InstancedMesh cube each
  assert.ok(result.tris < oldTris * 0.6, `${result.tris} should be well under ${oldTris}`);
  assert.equal(result.tris, (256 * 2 + 4 * CHUNK) * 2);
});

test('buffer sizes scale with faces, not blocks', () => {
  const solid = new Map();
  for (let x = 0; x < CHUNK; x++) for (let z = 0; z < CHUNK; z++) for (let y = 0; y < 8; y++) solid.set(key(x, y, z), 1);
  const r = build(solid).result;
  // 16x16x8 of solid stone: only the 6 outer walls + top + bottom are visible
  assert.equal(r.blocks, CHUNK * CHUNK * 8);
  assert.equal(r.tris, (CHUNK * CHUNK * 2 + CHUNK * 8 * 4) * 2);
});

test('scratch buffers are reused between builds', () => {
  const s = createScratch();
  assert.equal(s.pb.length, PW * PW * YS);
  assert.ok(s.q.length >= s.pb.length);
});

/* ------------------------------------------------------- the yFull cap */

test('fillPadded asks about cells below the cap only', () => {
  let asked = 0;
  const get = (x, y, z) => { asked++; return y === 2 ? 1 : 0; };
  const s = createScratch();
  V.fillPadded(s, 0, 0, get, 4);
  // y from Y0 (-8) to the cap (4) inclusive
  assert.equal(asked, PW * PW * (4 - Y0 + 1));
  assert.ok(s.pb.some(v => v === 1), 'blocks below the cap were copied');
});

test('the yFull cap does not hide blocks below it', () => {
  const m = new Map();
  for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) m.set(key(x, 20, z), 1);
  const get = (x, y, z) => { const v = m.get(key(x, y, z)); return v === undefined ? 0 : v; };
  const s = createScratch();
  V.fillPadded(s, 0, 0, get, 24);          // slab at y=20, cap at 24
  computeLight(s, OPAQUE, ATTEN);
  const res = mesh(s, cfg);
  assert.equal(res.blocks, 64, 'the whole slab survived the cap');
  assert.equal(res.tris, (64 * 2 + 8 * 4) * 2);
});

test('blocks above the yFull cap are ignored, by design', () => {
  const get = (x, y, z) => (y === 40 ? 1 : 0);
  const s = createScratch();
  V.fillPadded(s, 0, 0, get, 24);          // cap well below the block
  assert.equal(pad(s, s.pb, 4, 40, 4), 0, 'the tall block was not copied');
});

test('an uncapped fillPadded keeps everything', () => {
  const get = (x, y, z) => (y === 40 ? 1 : 0);
  const s = createScratch();
  V.fillPadded(s, 0, 0, get);
  assert.equal(pad(s, s.pb, 4, 40, 4), 1);
});

test('a cap above the world height is clamped, not a buffer overrun', () => {
  const s = createScratch();
  assert.doesNotThrow(() => V.fillPadded(s, 0, 0, () => 0, Y1 + 500));
  assert.doesNotThrow(() => V.fillPadded(s, 0, 0, () => 0, -500));
});
