/* chunk mesher: merged per-chunk geometry, face culling + cheap vertex AO */
'use strict';

const Mesh = (() => {
  const CH = CFG.CHUNK, SY = CFG.SY;

  // face table: normal, 4 corners (CCW from outside), shade. uv a(0,0) b(1,0) c(1,1) d(0,1)
  const FACES = [
    { n: [1, 0, 0],  na: 0, ia: [1, 2], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: .74 },
    { n: [-1, 0, 0], na: 0, ia: [1, 2], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: .74 },
    { n: [0, 1, 0],  na: 1, ia: [0, 2], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1.0 },
    { n: [0, -1, 0], na: 1, ia: [0, 2], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: .55 },
    { n: [0, 0, 1],  na: 2, ia: [0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: .87 },
    { n: [0, 0, -1], na: 2, ia: [0, 1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: .87 }
  ];
  const AO_MUL = [.52, .71, .86, 1];

  // shared materials + atlas texture
  const atlasTex = new THREE.CanvasTexture(Tex.atlasCanvas);
  atlasTex.magFilter = atlasTex.minFilter = THREE.NearestFilter;
  atlasTex.generateMipmaps = false;
  atlasTex.encoding = THREE.sRGBEncoding;
  const solidMat = new THREE.MeshLambertMaterial({ map: atlasTex, vertexColors: true, alphaTest: .5 });
  const waterMat = new THREE.MeshLambertMaterial({ map: atlasTex, vertexColors: true, transparent: true, opacity: .78, depthWrite: false, side: THREE.DoubleSide });

  const chunks = [];                 // flat list of {cx,cz,solid,water}
  const dirty = new Set();

  function aoAt(x, y, z) { return isOpaque(World.getMesh(x, y, z)) ? 1 : 0; }

  function buildChunk(ch) {
    const x0 = ch.cx * CH, z0 = ch.cz * CH;
    const buf = { s: { pos: [], norm: [], uv: [], col: [], idx: [] }, w: { pos: [], norm: [], uv: [], col: [], idx: [] } };

    for (let lx = 0; lx < CH; lx++) for (let lz = 0; lz < CH; lz++) {
      const x = x0 + lx, z = z0 + lz;
      for (let y = 0; y < SY; y++) {
        const id = World.getMesh(x, y, z);
        if (id === B.AIR) continue;
        const isWater = id === B.WATER;
        const g = isWater ? buf.w : buf.s;

        for (let f = 0; f < 6; f++) {
          const F = FACES[f];
          const nb = World.getMesh(x + F.n[0], y + F.n[1], z + F.n[2]);
          if (nb === id || isOpaque(nb)) continue;

          const rect = Tex.uv(blockTile(id, f));
          const base = g.pos.length / 3;
          for (let ci = 0; ci < 4; ci++) {
            let c = F.c[ci];
            // water surface sits slightly lower
            const yy = isWater && F.n[1] === 1 ? .875 : c[1];
            g.pos.push(x + c[0], y + yy, z + c[2]);
            g.norm.push(F.n[0], F.n[1], F.n[2]);

            // AO from the three neighbors around this corner (on the neighbor side of the face)
            const nx = x + F.n[0], ny = y + F.n[1], nz = z + F.n[2];
            const o1 = c[F.ia[0]] ? 1 : -1, o2 = c[F.ia[1]] ? 1 : -1;
            const p1 = [nx, ny, nz], p2 = [nx, ny, nz], pc = [nx, ny, nz];
            p1[F.ia[0]] += o1; p2[F.ia[1]] += o2; pc[F.ia[0]] += o1; pc[F.ia[1]] += o2;
            const s1 = aoAt(p1[0], p1[1], p1[2]), s2 = aoAt(p2[0], p2[1], p2[2]), sc = aoAt(pc[0], pc[1], pc[2]);
            const ao = (s1 && s2) ? 0 : 3 - (s1 + s2 + sc);

            g.uv.push(ci === 0 || ci === 3 ? rect.u0 : rect.u1, ci < 2 ? rect.v0 : rect.v1);
            const m = F.s * AO_MUL[ao];
            g.col.push(m, m, m);
          }
          g.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
    }

    makeMesh(ch, 'solid', buf.s, solidMat, 0);
    makeMesh(ch, 'water', buf.w, waterMat, 1);
  }

  function makeMesh(ch, key, g, mat, order) {
    if (ch[key]) { Scene.group.remove(ch[key]); ch[key].geometry.dispose(); ch[key] = null; }
    if (!g.pos.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.norm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 3));
    geo.setIndex(g.idx);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = order;
    Scene.group.add(mesh);
    ch[key] = mesh;
  }

  function init() {
    for (const ch of chunks) {           // drop meshes from a previous world
      if (ch.solid) { Scene.group.remove(ch.solid); ch.solid.geometry.dispose(); }
      if (ch.water) { Scene.group.remove(ch.water); ch.water.geometry.dispose(); }
    }
    chunks.length = 0;
    for (let cx = 0; cx < World.CXN; cx++) for (let cz = 0; cz < World.CZN; cz++)
      chunks.push({ cx, cz, solid: null, water: null });
    dirty.clear();
    chunks.forEach((c) => dirty.add(c.cx + ',' + c.cz));
  }

  function markDirty(x, z) {
    let cx = (x / CH) | 0, cz = (z / CH) | 0;
    const add = (a, b) => { if (a >= 0 && b >= 0 && a < World.CXN && b < World.CZN) dirty.add(a + ',' + b); };
    add(cx, cz);
    if (x % CH === 0) add(cx - 1, cz); if (x % CH === CH - 1) add(cx + 1, cz);
    if (z % CH === 0) add(cx, cz - 1); if (z % CH === CH - 1) add(cx, cz + 1);
  }

  function flush(maxPerFrame) {
    let n = 0;
    for (const key of dirty) {
      const [cx, cz] = key.split(',').map(Number);
      const ch = chunks[cx * World.CZN + cz];
      buildChunk(ch);
      dirty.delete(key);
      if (++n >= maxPerFrame) break;
    }
    return n > 0 || dirty.size > 0 ? true : false;
  }

  // hide chunks beyond render distance (cheap streaming)
  function updateVisible(px, pz, distChunks) {
    for (const ch of chunks) {
      const dx = ch.cx - (px / CH | 0), dz = ch.cz - (pz / CH | 0);
      const vis = Math.max(Math.abs(dx), Math.abs(dz)) <= distChunks;
      if (ch.solid) ch.solid.visible = vis;
      if (ch.water) ch.water.visible = vis;
    }
  }

  return { init, buildAll: () => chunks.forEach(buildChunk), markDirty, flush, updateVisible, get list() { return chunks; }, materials: () => ({ solidMat, waterMat }) };
})();
