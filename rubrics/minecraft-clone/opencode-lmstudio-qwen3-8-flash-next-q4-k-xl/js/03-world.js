/* world storage + procedural generation (terrain, biomes, water, trees) */
'use strict';

const World = (() => {
  const SX = CFG.SX, SY = CFG.SY, SZ = CFG.SZ;
  let data = null, base = null, biomeMap = null;   // Uint8Array world + snapshot + per-column biome
  let seed = 0, noise = null;
  const edits = new Map();                          // idx -> id (player changes vs generated)

  const CXN = SX / CFG.CHUNK, CZN = SZ / CFG.CHUNK;
  const idx = (x, y, z) => x + SX * (z + SZ * y);
  const inB = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < SX && y < SY && z < SZ;

  function get(x, y, z) { return inB(x, y, z) ? data[idx(x, y, z)] : B.AIR; }
  // for meshing: treat outside horizontally as solid so no ugly cross-section walls at the map edge
  function getMesh(x, y, z) {
    if (y < 0) return B.STONE;
    if (y >= SY) return B.AIR;
    if (x < 0 || z < 0 || x >= SX || z >= SZ) return B.STONE;
    return data[idx(x, y, z)];
  }

  /* ---------- generation ---------- */
  function heightAt(nx, nz) {
    const n1 = noise.fbm(nx * .9, nz * .9, 4, 2, .5);          // rolling hills
    let h = CFG.SEA + 3 + n1 * 9;
    const m = noise.fbm(nx * .35 + 7.3, nz * .35 - 4.1, 3, 2, .5); // mountain mask
    if (m > .18) h += (m - .18) * 60;
    const d = noise.fbm(nx * 2.2 + 30, nz * 2.2 - 12, 2, 2, .5);   // roughness
    return clamp(Math.round(h + d * 2), 1, SY - 12);
  }

  function biomeAt(nx, nz) {
    const t = noise.fbm(nx * .3 + 90, nz * .3 + 70, 3, 2, .5);   // temperature
    const p = noise.fbm(nx * .4 - 40, nz * .4 + 120, 3, 2, .5);  // precipitation
    if (t > .28 && p < .05) return 2;      // desert
    if (p > .2) return 1;                  // forest
    return 0;                              // plains
  }

  function generate(s) {
    seed = s >>> 0;
    noise = makeNoise(seed);
    data = new Uint8Array(SX * SY * SZ);
    biomeMap = new Uint8Array(SX * SZ);
    edits.clear();

    const SEA = CFG.SEA;
    for (let x = 0; x < SX; x++) {
      for (let z = 0; z < SZ; z++) {
        const h = heightAt(x / 16, z / 16);
        let bio = biomeAt(x / 16, z / 16);
        if (h > SEA + 24) bio = 3;                       // snowy peaks
        biomeMap[x + SX * z] = bio;

        for (let y = 0; y <= h; y++) {
          let id;
          if (y === 0) id = B.BEDROCK;
          else if (y < h - 3) id = B.STONE;
          else if (y < h) id = (bio === 2 || h <= SEA + 1) ? B.SAND : B.DIRT;
          else { // surface block
            if (h > SEA + 24) id = B.SNOW;
            else if (bio === 2) id = B.SAND;
            else if (h <= SEA + 1) id = B.SAND;
            else id = B.GRASS;
          }
          data[idx(x, y, z)] = id;
        }
        for (let y = h + 1; y <= SEA; y++) data[idx(x, y, z)] = B.WATER;   // lakes / ocean
      }
    }

    // trees: deterministic per column hash, spaced via cooldown map
    const cool = new Uint8Array(SX * SZ);
    for (let x = 2; x < SX - 2; x++) {
      for (let z = 2; z < SZ - 2; z++) {
        const bio = biomeMap[x + SX * z];
        if (bio === 2) continue;
        const density = bio === 1 ? .05 : .007;
        if (noise.hash3(x, z, seed) >= density) continue;
        if (cool[x + SX * z]) continue;
        // find surface
        let h = -1;
        for (let y = SY - 12; y > CFG.SEA; y--) { const id = data[idx(x, y, z)]; if (id !== B.AIR && id !== B.WATER) { h = y; break; } }
        if (h < 0 || data[idx(x, h, z)] !== (bio === 3 ? B.SNOW : B.GRASS)) continue;

        const th = 4 + ((noise.hash3(x + 11, z - 7, seed) * 3) | 0);
        if (h + th + 2 >= SY - 8) continue;
        for (let i = 1; i <= th; i++) data[idx(x, h + i, z)] = B.LOG;
        const ty = h + th;
        for (let dy = -2; dy <= 2; dy++) {
          const r = dy >= 1 ? 1 : 2;
          for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
            if (Math.abs(dx) === r && Math.abs(dz) === r && (dy < 1 || noise.hash3(x + dx, z + dz, seed + ty) > .5)) continue;
            const yy = ty + dy;
            for (let cx2 = -2; cx2 <= 2; cx2++) for (let cz2 = -2; cz2 <= 2; cz2++) cool[x + dx + cx2 + SX * (z + dz + cz2)] = 4;
            const i2 = idx(x + dx, yy, z + dz);
            if (data[i2] === B.AIR) data[i2] = B.LEAVES;
          }
        }
      }
    }

    base = new Uint8Array(data);   // snapshot for diff-based saving
  }

  /* ---------- edits ---------- */
  function set(x, y, z, id) {
    if (!inB(x, y, z)) return;
    const i = idx(x, y, z);
    data[i] = id;
    if (id === base[i]) edits.delete(i); else edits.set(i, id);
  }

  function applyEdits(map) {          // map: idx -> id  (from save file)
    for (const [i, id] of map) { i |= 0; data[i] = id; base && (base[i] === id ? edits.delete(i) : edits.set(i, id)); }
  }

  /* falling sand/gravel: settle one column instantly */
  function settle(x, z) {
    let moved = false;
    for (let pass = 0; pass < SY; pass++) {
      let any = false;
      for (let y = 1; y < SY - 1; y++) {
        const id = data[idx(x, y, z)];
        if (!BLOCKS[id] || !BLOCKS[id].falls) continue;
        const below = getMesh(x, y - 1, z);
        if (below === B.AIR || below === B.WATER) {
          set(x, y, z, below); set(x, y - 1, z, id);
          any = true; moved = true;
        }
      }
      if (!any) break;
    }
    return moved;
  }

  function surfaceY(x, z) {           // topmost solid block y at column (for spawn)
    for (let y = SY - 1; y > 0; y--) { const id = get(x, y, z); if (id !== B.AIR && id !== B.WATER) return y; }
    return 1;
  }

  function biomeName(x, z) {
    if (!biomeMap || !inB(Math.floor(x), 0, Math.floor(z))) return '-';
    const b = biomeMap[Math.floor(x) + SX * Math.floor(z)];
    return ['Plains', 'Forest', 'Desert', 'Snowy Peaks'][b];
  }

  return {
    generate, get, getMesh, set, applyEdits, settle, surfaceY, biomeName, idx, inB,
    CXN, CZN,
    get seed() { return seed; },
    get edits() { return edits; },
    get data() { return data; }
  };
})();
