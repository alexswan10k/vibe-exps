// Transparent-pass sort order for chunk geometry.
//
// Water, glass and tank are `transparent: true`, so they go into three.js's
// transparent render list, which is sorted BACK-TO-FRONT by a depth key. That
// key is computed in projectObject as
//     z = setFromMatrixPosition(object.matrixWorld).applyMatrix4(projScreen)
// i.e. the object's ORIGIN — not its geometry bounds, and not the bounds of
// its InstancedMesh instances.
//
// Chunk groups used to be created at the world origin with every instance
// matrix carrying absolute world coordinates, so EVERY water/glass/tank mesh in
// the entire view had the same z. painterSortStable then fell through to
// object.id, meaning transparent blocks drew in chunk *load* order rather than
// by distance: standing at a shore you could see a distant chunk's water blend
// over the near one.
//
// The fix anchors each chunk group at the centre of its own volume and emits
// instance matrices relative to that anchor. World positions are unchanged —
// this test pins that down too, by checking the reconstructed world position of
// every instance still lands on a voxel of the mesh's own block type.
//
// Needs a running server (it loads the real page + the real three.js), same
// tier as tests/two-players.test.mjs.
import { strict as assert } from "node:assert";
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:8000";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME
    ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

try {
  const page = await browser.newPage({ viewport: { width: 320, height: 240 } });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => !!window.voxDbg?.world, null, { timeout: 90000 });

  const r = await page.evaluate(() => {
    const { world, camera, scene } = window.voxDbg;
    const T = globalThis.THREE;
    const CHUNK = 16, H = 48;
    const idx = (x, y, z) => (y * CHUNK + z) * CHUNK + x;
    const STONE = 3, WATER = 10, GLASS = 17;

    // A 3x3 grid, every chunk loaded — deterministic, no streaming. Water spans
    // chunk borders so cross-chunk transparency is actually exercised.
    for (let cx = -1; cx <= 1; cx++) {
      for (let cz = -1; cz <= 1; cz++) {
        const d = new Uint8Array(CHUNK * CHUNK * H);
        for (let x = 0; x < CHUNK; x++) {
          for (let z = 0; z < CHUNK; z++) {
            const wx = cx * CHUNK + x, wz = cz * CHUNK + z;
            const pool = wx >= -6 && wx <= 22 && wz >= -6 && wz <= 6;
            for (let y = 0; y < 12; y++) {
              if (y < 10) { d[idx(x, y, z)] = STONE; continue; }
              if (pool && y === 10) { d[idx(x, y, z)] = WATER; continue; }
              if (y === 11 && wx === 18 && wz >= -3 && wz <= 3) d[idx(x, y, z)] = GLASS;
            }
          }
        }
        world.chunks.set(`${cx},${cz}`, d);
      }
    }
    for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) world.remesh(cx, cz);

    // Off-axis camera so no two chunk centres share a view depth.
    camera.position.set(34, 20, 27);
    camera.lookAt(8, 11, -8);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
    scene.updateMatrixWorld(true);
    const projScreen = new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const forward = new T.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

    const chunks = [];
    const tmp = new T.Matrix4();
    const wp = new T.Vector3();

    for (const key of [...world.meshes.keys()].sort()) {
      const g = world.meshes.get(key);
      const [cx, cz] = key.split(",").map(Number);
      g.updateMatrixWorld(true);
      // Depth along the view axis — this, not euclidean distance, is what the
      // sort key tracks.
      const viewDepth = new T.Vector3(
        g.position.x - camera.position.x,
        g.position.y - camera.position.y,
        g.position.z - camera.position.z,
      ).dot(forward);
      const entry = { key, viewDepth, pos: [g.position.x, g.position.y, g.position.z], z: null, instances: 0 };

      for (const m of g.children) {
        if (!m.isInstancedMesh) continue;
        for (let i = 0; i < m.count; i++) {
          m.getMatrixAt(i, tmp);
          wp.setFromMatrixPosition(tmp).applyMatrix4(g.matrixWorld);
          entry.instances++;
          // Sanity: the world position must be a whole number plus 0.5 on x/z
          // (blocks are 1x1x1 centred on integer cells).
          const fx = Math.abs(wp.x - Math.floor(wp.x) - 0.5);
          const fz = Math.abs(wp.z - Math.floor(wp.z) - 0.5);
          if (fx > 1e-3 || fz > 1e-3) entry.misaligned = (entry.misaligned ?? 0) + 1;
        }
        if (m.material?.transparent) {
          const z = new T.Vector3().setFromMatrixPosition(m.matrixWorld).applyMatrix4(projScreen).z;
          entry.z = entry.z === null ? z : (entry.z + z) / 2;
          entry.transparent = true;
        }
      }
      chunks.push(entry);
    }
    return { chunks, worldH: H, chunk: CHUNK };
  });

  const seen = r.chunks.length;
  assert.equal(seen, 9, "expected the full 3x3 synthetic grid to be meshed");

  // 1. Every chunk group is anchored at the centre of its own volume. This is
  //    what gives the transparent pass a meaningful depth key.
  for (const c of r.chunks) {
    const [cx, cz] = c.key.split(",").map(Number);
    assert.deepEqual(
      c.pos,
      [cx * r.chunk + r.chunk / 2, r.worldH / 2, cz * r.chunk + r.chunk / 2],
      `chunk ${c.key} is not anchored at its volume centre (got ${c.pos})`,
    );
  }

  // 2. Instances are still on whole block cells: the anchor re-bases the geometry
  //    without moving it.
  const totalInstances = r.chunks.reduce((n, c) => n + c.instances, 0);
  assert.ok(totalInstances > 1000, `synthetic scene too small (${totalInstances} instances)`);
  for (const c of r.chunks) {
    assert.equal(c.misaligned, undefined, `${c.instances - (c.misaligned ?? 0)}/${c.instances} instances in chunk ${c.key} drifted off the block grid`);
  }

  // 3. The actual fix: transparent meshes must not all share one sort key.
  const trans = r.chunks.filter((c) => c.transparent);
  assert.ok(trans.length >= 4, `expected transparent geometry in several chunks, got ${trans.length}`);
  const distinct = new Set(trans.map((c) => c.z.toFixed(9))).size;
  assert.ok(
    distinct > 1,
    `all ${trans.length} transparent chunks share one sort depth — they would draw in load order`,
  );

  // 4. And the order must actually be back-to-front: along the view axis, the
  //    projected depth must increase. (Euclidean distance is NOT the right
  //    proxy — lateral offset adds to distance but not to view depth, so two
  //    chunks at very different distances can legitimately share a depth.)
  const byDepth = [...trans].sort((a, b) => a.viewDepth - b.viewDepth);
  for (let i = 1; i < byDepth.length; i++) {
    if (byDepth[i].viewDepth - byDepth[i - 1].viewDepth < 0.5) continue; // effectively level
    assert.ok(
      byDepth[i].z > byDepth[i - 1].z,
      `chunk ${byDepth[i].key} (depth ${byDepth[i].viewDepth.toFixed(1)}) sorts in front of `
      + `chunk ${byDepth[i - 1].key} (depth ${byDepth[i - 1].viewDepth.toFixed(1)}): `
      + `${byDepth[i - 1].z.toFixed(6)} -> ${byDepth[i].z.toFixed(6)}`,
    );
  }

  console.log(
    `PASS: ${seen} chunks anchored at volume centre, ${totalInstances} instances still on the block grid, `
    + `transparent sort spans ${distinct} depths across ${trans.length} chunks in back-to-front order`,
  );
} finally {
  await browser.close();
}