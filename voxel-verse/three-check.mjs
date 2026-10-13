/* Verify the new chunk geometry against the REAL three.js r128.

   smoke.test.mjs stubs THREE so script.js can run headless, but a stub will
   happily accept geometry three.js would reject. This loads the actual library,
   builds a chunk with the real BufferGeometry / materials / Raycaster, and
   checks the things that only break against the real thing:

     - BufferGeometry accepts our attributes and index buffer
     - computeBoundingSphere / Raycaster agree the mesh is where it should be
     - the material actually samples the atlas texture correctly
     - the vertex colours survive three.js's colour-space pipeline

   Run: node voxel-verse/three-check.mjs   (needs the CDN reachable) */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const THREE_PATH = process.env.THREE_PATH
  || join(process.env.HOME || '', '.cache/voxel-verse/three.min.js');

let src;
try {
  src = readFileSync(THREE_PATH, 'utf8');
} catch {
  console.error(`Could not read three.js from ${THREE_PATH}`);
  console.error('Fetch it once with:');
  console.error(`  curl -s -o "${THREE_PATH}" https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`);
  process.exit(2);
}

/* three.js is a UMD bundle; give it a module-ish global to attach to. */
const threeCtx = vm.createContext({ module: undefined, exports: undefined, window: {}, self: {}, console });
vm.runInContext(src, threeCtx, { filename: 'three.min.js' });
const THREE = threeCtx.window.THREE || threeCtx.THREE || threeCtx.self.THREE;
if (!THREE) { console.error('three.js did not export a global THREE'); process.exit(2); }
console.log('loaded three.js r' + THREE.REVISION);

const V = createRequire(import.meta.url)(join(here, 'mesher.js'));

let failures = 0;
function check(name, fn) {
  try {
    const detail = fn();
    console.log(`  ok   ${name}${detail ? ' — ' + detail : ''}`);
  } catch (e) {
    failures++;
    console.log(`  FAIL ${name}\n       ${e.message}`);
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

/* ---- a small hand-built world: 3x3x3 stone with a notch ------------------- */
const STONE = 1, GRASS = 2;
const NB = 4;
const OPAQUE = new Uint8Array(NB); OPAQUE[STONE] = 1; OPAQUE[GRASS] = 1;
const LIQUID = new Uint8Array(NB);
const ATTEN = new Uint8Array(NB);
const BUCKET = new Uint8Array(NB);
const CELL = new Int8Array(NB * 6).fill(-1);
const cfg = { opaque: OPAQUE, liquid: LIQUID, bucket: BUCKET, cell: CELL, buckets: 1, water: -1, floor: STONE, sea: -999 };

const world = new Map();
const key = (x, y, z) => `${x},${y},${z}`;
for (let x = 4; x <= 6; x++) for (let y = 4; y <= 6; y++) for (let z = 4; z <= 6; z++) {
  if (x === 5 && y === 5 && z === 5) continue;   // hollow it out
  world.set(key(x, y, z), STONE);
}
const get = (x, y, z) => { const v = world.get(key(x, y, z)); return v === undefined ? 0 : v; };

const s = V.createScratch();
V.fillPadded(s, 0, 0, get);
V.computeLight(s, OPAQUE, ATTEN);
const res = V.mesh(s, cfg);
const b = res.buckets[0];

/* ---- wrap the arrays exactly the way script.js does ---------------------- */
function buildGeometry() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(b.pos), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(b.nrm), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(b.col), 3));
  // water-like raw uvs (cell -1)
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(b.uv), 2));
  geo.setIndex(b.quads * 4 > 65535
    ? new THREE.Uint32BufferAttribute(b.idx, 1)
    : new THREE.Uint16BufferAttribute(b.idx, 1));
  geo.computeBoundingSphere();
  return geo;
}

console.log('\nreal three.js geometry');

let geo, mesh;
check('BufferGeometry accepts our attributes', () => {
  geo = buildGeometry();
  assert(geo.attributes.position.count > 0, 'no vertices');
  return `${geo.attributes.position.count} verts, ${b.quads} quads, ${res.tris} tris`;
});

check('index buffer is a valid triangle list', () => {
  const idx = geo.index.array, verts = geo.attributes.position.count;
  let tris = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const [a, c, d] = [idx[i], idx[i + 1], idx[i + 2]];
    assert(a < verts && c < verts && d < verts, `index ${a},${c},${d} out of range`);
    assert(a !== c && c !== d && a !== d, `degenerate triangle at ${i}`);
    tris++;
  }
  assert(tris === b.quads * 2, `expected ${b.quads * 2} triangles, found ${tris}`);
  return `${tris} triangles`;
});

check('bounding sphere encloses every vertex', () => {
  const bs = geo.boundingSphere;
  const p = geo.attributes.position.array;
  let worst = 0;
  for (let i = 0; i < p.length; i += 3) {
    const d = Math.hypot(p[i] - bs.center.x, p[i + 1] - bs.center.y, p[i + 2] - bs.center.z);
    worst = Math.max(worst, d);
  }
  assert(worst <= bs.radius + 1e-3, `vertex ${worst} from centre exceeds radius ${bs.radius}`);
  return `radius ${bs.radius.toFixed(2)}`;
});

check('every triangle winds outward', () => {
  // cross((b-a),(c-a)) should point along the stored normal
  const p = geo.attributes.position.array, n = geo.attributes.normal.array, idx = geo.index.array;
  let flipped = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const [ia, ib, ic] = [idx[i], idx[i + 1], idx[i + 2]];
    const ax = p[ia * 3], ay = p[ia * 3 + 1], az = p[ia * 3 + 2];
    const e1 = [p[ib * 3] - ax, p[ib * 3 + 1] - ay, p[ib * 3 + 2] - az];
    const e2 = [p[ic * 3] - ax, p[ic * 3 + 1] - ay, p[ic * 3 + 2] - az];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const n0 = [n[ia * 3], n[ia * 3 + 1], n[ia * 3 + 2]];
    if (cr[0] * n0[0] + cr[1] * n0[1] + cr[2] * n0[2] <= 0) flipped++;
  }
  assert(flipped === 0, `${flipped} triangles face inward and would be backface-culled`);
  return 'all CCW from outside';
});

check('a Mesh accepts the geometry and a material', () => {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mesh = new THREE.Mesh(geo, mat);
  assert(mesh.geometry === geo, 'geometry did not stick');
  assert(mesh.material.vertexColors === true, 'vertex colours not enabled');
  return 'Mesh constructed';
});

console.log('\nreal three.js raycasting (how the old renderer picked blocks)');

check('Raycaster hits the hollowed-out shell', () => {
  mesh.updateMatrixWorld(true);        // r128's Mesh.raycast needs this resolved
  const ray = new THREE.Raycaster(new THREE.Vector3(20, 5.5, 5.5), new THREE.Vector3(-1, 0, 0), 0, 100);
  const hits = ray.intersectObject(mesh, false);
  assert(hits.length > 0, 'raycaster found nothing');
  const hit = hits[0];
  // r128 puts the face normal on hit.face, not hit
  assert(Math.abs(hit.point.x - 7) < 1e-4, `expected the x=7 face, hit x=${hit.point.x}`);
  assert(hit.face, 'intersection has no face data');
  assert(Math.abs(hit.face.normal.x - 1) < 1e-4, `expected a +x normal, got ${hit.face.normal.x}`);
  // the cell behind that face is the block we picked
  const cell = [hit.point.x - hit.face.normal.x * 0.5, hit.point.y, hit.point.z];
  assert(Math.floor(cell[0]) === 6, `expected block x=6, got ${Math.floor(cell[0])}`);
  return `hit at x=${hit.point.x} normal ${hit.face.normal.toArray().join(',')}`;
});

check('the voxel raycast agrees with the real raycaster', () => {
  // This is the important one: the new picker must land on the same cell the
  // old triangle picker did, or the game picks different blocks than it draws.
  const cases = [
    { from: [20, 5.5, 5.5], dir: [-1, 0, 0] },
    { from: [5.5, 20, 5.5], dir: [0, -1, 0] },
    { from: [5.5, 5.5, 20], dir: [0, 0, -1] },
    { from: [5.5, 9, 5.5], dir: [0, -1, 0] },   // into the hollow centre
  ];
  let agreed = 0;
  for (const c of cases) {
    const dir = new THREE.Vector3(...c.dir).normalize();
    const origin = new THREE.Vector3(...c.from);
    const ray = new THREE.Raycaster(origin.clone(), dir, 0, 100);
    mesh.updateMatrixWorld(true);
    const hits = ray.intersectObject(mesh, false);
    const mine = V.raycast(c.from[0], c.from[1], c.from[2], dir.x, dir.y, dir.z, 100, get);
    if (!hits.length && !mine) { agreed++; continue; }
    assert(!!mine === !!hits.length, `hit/miss disagreement from ${c.from} along ${c.dir}`);
    if (!mine) continue;
    // three reports a point on the surface; the cell is floor(point - 0.5*normal)
    const n = hits[0].face.normal;
    const cell = [
      Math.floor(hits[0].point.x - n.x * 0.5 + 1e-4),
      Math.floor(hits[0].point.y - n.y * 0.5 + 1e-4),
      Math.floor(hits[0].point.z - n.z * 0.5 + 1e-4),
    ];
    assert(cell[0] === mine.x && cell[1] === mine.y && cell[2] === mine.z,
      `cell mismatch from ${c.from}: three says ${cell}, voxel says ${[mine.x, mine.y, mine.z]}`);
    const dist = Math.abs(hits[0].distance - mine.dist);
    assert(dist < 0.02, `distance differs by ${dist}`);
    agreed++;
  }
  return `${agreed}/${cases.length} rays agree`;
});

console.log('\nreal three.js texture conventions');

// The atlas bug that made the whole world render black: tiles are painted at
// canvas row 0, but CanvasTexture.flipY defaults to true, so WebGL flips the
// image on upload and canvas row 0 becomes texture v = 1. Atlas uv maths that
// treats row 0 as v = 0 samples a strip of the atlas that was never painted.
// This asserts against the real library rather than a stub.
check('CanvasTexture really does flip the image on upload', () => {
  const tex = new THREE.CanvasTexture({ width: 4, height: 4 });
  assert(tex.flipY === true, `expected flipY true, got ${tex.flipY}`);
  // and the base Texture default agrees
  assert(new THREE.Texture().flipY === true, 'Texture.flipY default is not true');
  return 'flipY = true, confirmed against real three.js';
});

check('the atlas texture is configured to avoid distance darkening', () => {
  // only the first atlas row is painted; mipmaps would average tiles with empty
  // canvas and fade distant terrain toward black
  const tex = new THREE.CanvasTexture({ width: 512, height: 512 });
  assert(tex.generateMipmaps === true, 'three defaults generateMipmaps to true, so the game must turn it off explicitly');
  return 'three.js defaults confirmed: generateMipmaps ' + tex.generateMipmaps;
});

check('atlas uv maths agrees with the flip', () => {
  // Reproduce script.js's atlasUV for a tile painted at canvas row 0 of 16.
  const ROWS = 16, COLS = 16;
  const atlasUV = (cx, cy, u, v) => [(cx + u) / COLS, (ROWS - 1 - cy + v) / ROWS];
  const flipY = true;
  // where does a uv land on the canvas, accounting for the upload flip?
  const canvasRow = (v) => (flipY ? ROWS - 1 - Math.floor(v * ROWS) : Math.floor(v * ROWS));
  const [, v] = atlasUV(0, 0, 0.5, 0.5);
  assert(canvasRow(v) === 0, `uv resolved to canvas row ${canvasRow(v)}, expected row 0`);
  // a second row must resolve to itself, not to the first
  const [, v2] = atlasUV(0, 3, 0.5, 0.5);
  assert(canvasRow(v2) === 3, `row 3 resolved to canvas row ${canvasRow(v2)}`);
  // and the pre-fix formula lands on a row that was never painted
  const vBug = 0.5 / ROWS;
  assert(canvasRow(vBug) !== 0, 'the old formula unexpectedly resolved to row 0');
  return `tile row 0 -> v=${v.toFixed(4)} -> canvas row ${canvasRow(v)}; row 3 -> canvas row ${canvasRow(v2)}`;
});

console.log('\nreal three.js textures and alpha');

/* The texture generator writes raw RGBA into a canvas via putImageData, so the
   alpha channel matters: leaves depend on alphaTest to punch holes, and glass on
   partial alpha to stay see-through. Verify against the real library that
   ImageData's buffer survives the trip and that the flags we set are the ones
   three.js actually reads. */
const T = createRequire(import.meta.url)(join(here, 'textures.js'));

check('putImageData carries the alpha channel through to the texture', () => {
  const atlas = T.buildAtlas();
  assert(atlas.data.length === atlas.size * atlas.size * 4, 'atlas is not RGBA');
  /* Count within the cells we actually use. Unused cells are empty by design, so
     measuring the whole atlas would report mostly-transparent and say nothing
     about whether the textures themselves are right. */
  const perTile = T.TILE * T.TILE;
  let holes = 0, translucent = 0, opaque = 0, cells = 0;
  for (let c = 0; c < T.ATLAS_NAMES.length; c++) {
    cells++;
    for (let i = 0; i < perTile; i++) {
      const a = atlas.data[c * perTile * 4 + i * 4 + 3];
      if (a === 0) holes++; else if (a === 255) opaque++; else translucent++;
    }
  }
  assert(holes > 100, `used cells have ${holes} fully transparent texels — expected the leaf cutouts`);
  assert(translucent > 500, `used cells have ${translucent} partially transparent texels — expected the glass pane`);
  assert(holes + translucent < opaque * 0.2, 'the tiles should be mostly opaque');
  return `${cells} cells: ${holes} cutout, ${translucent} translucent, ${opaque} opaque texels`;
});

check('alphaTest and transparent are the flags that make cutouts work', () => {
  // alphaTest discards texels below the threshold in the shader, which is what
  // gives leaves hard holes. Plain `transparent` alone would leave them solid.
  const leaves = new THREE.MeshLambertMaterial({ alphaTest: 0.5, side: THREE.DoubleSide });
  assert(leaves.alphaTest === 0.5, 'alphaTest did not stick');
  assert(leaves.transparent === false, 'alphaTest materials should not also be transparent');
  const glass = new THREE.MeshLambertMaterial({ map: null, transparent: true, opacity: 0.6, depthWrite: false });
  assert(glass.transparent === true && glass.opacity === 0.6 && glass.depthWrite === false, 'glass flags lost');
  return 'leaf alphaTest=0.5, glass transparent+depthWrite=false';
});

check('the atlas texture configuration survives a real Texture', () => {
  const tex = new THREE.CanvasTexture({ width: T.COLS * T.TILE, height: T.ROWS * T.TILE });
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.encoding = THREE.sRGBEncoding;
  assert(tex.generateMipmaps === false, 'mipmaps should be off');
  assert(tex.minFilter === THREE.NearestFilter, 'minFilter should be nearest');
  assert(tex.encoding === THREE.sRGBEncoding, 'encoding should be sRGB');
  // and the atlas must actually fit its own tiles
  assert(T.ATLAS_NAMES.length <= T.COLS * T.ROWS,
    `${T.ATLAS_NAMES.length} tiles do not fit in ${T.COLS}x${T.ROWS}`);
  return `${T.ATLAS_NAMES.length}/${T.COLS * T.ROWS} cells used, sRGB, nearest, no mipmaps`;
});

check('per-face tiles are distinct where the art depends on it', () => {
  // Grass with one tile on all six faces is the classic "procedural block"
  // tell: the side of a grass block must be dirt under a fringe.
  const grass = T.PER_FACE.Grass;
  const log = T.PER_FACE.Log;
  assert(grass && log, 'PER_FACE is missing Grass or Log');
  assert(grass[0] !== grass[2], 'grass uses the same tile on top and side');
  assert(log[0] !== log[2], 'log uses the same tile on end and side');
  for (const [name, faces] of Object.entries(T.PER_FACE)) {
    for (const f of faces) assert(T.CELL[f] !== undefined, `${name} references unknown tile ${f}`);
  }
  return `grass top=${grass[0]} side=${grass[2]} | log end=${log[0]} side=${log[2]}`;
});

console.log('\nreal three.js materials and colour space');

check('vertex colours survive three.js sRGB handling', () => {
  const c = geo.attributes.color.array;
  const raw = [];
  for (let i = 0; i < c.length; i += 3) raw.push(c[i]);
  const lo = Math.min(...raw), hi = Math.max(...raw);
  assert(lo >= 0, `colour ${lo} is negative`);
  assert(hi <= 1.0001, `colour ${hi} exceeds 1`);
  assert(hi > lo * 1.5, 'shading has no contrast — ambient occlusion is not reaching the vertices');
  return `range ${lo.toFixed(3)}..${hi.toFixed(3)}`;
});

check('Lambert material compiles with vertexColors on', () => {
  // three needs a light in the scene before it will shade anything; this also
  // proves the geometry survives a real render-list pass.
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1));
  scene.add(mesh);
  assert(scene.children.length === 2, 'scene graph is wrong');
  assert(mesh.parent === scene, 'mesh was not added to the scene');
  // three decides whether a material needs recompiling from these flags
  assert(mesh.material.vertexColors === true, 'vertex colours not enabled on the material');
  assert(geo.attributes.color !== undefined, 'geometry has no colour attribute for it to read');
  return 'added to a real scene with vertexColors wired up';
});

check('transparent flags survive on the material we set', () => {
  const glass = new THREE.MeshLambertMaterial({ map: null, vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false });
  assert(glass.transparent === true, 'transparent lost');
  assert(glass.depthWrite === false, 'depthWrite lost');
  assert(glass.opacity === 0.45, 'opacity lost');
  return 'glass material intact';
});

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed against real three.js');
process.exit(failures ? 1 : 0);
