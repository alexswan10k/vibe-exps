// Client voxel store: chunk cache (Uint8Array per chunk) + Three.js meshing.
// Layout matches server: index = (y * CHUNK + z) * CHUNK + x.
import { B, CHUNK, WORLD_H } from "./config.js";

const OPAQUE = new Set([1, 2, 3, 4, 5, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 23]);

// --- pixel-art texture painters (16x16) ---
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967295;
  };
}

function makeCanvas(paint, seed) {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  paint(c.getContext("2d"), rng(seed));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.encoding = THREE.sRGBEncoding;
  return t;
}

function noiseFill(g, r, base, vary) {
  const [br, bg, bb] = base;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const v = (r() - 0.5) * vary;
      g.fillStyle = `rgb(${conv(br + v)},${conv(bg + v)},${conv(bb + v)})`;
      g.fillRect(x, y, 1, 1);
    }
  }
}
function conv(n) { return Math.max(0, Math.min(255, Math.floor(n * 255))); }
function blobs(g, r, color, count, size) {
  g.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = Math.floor(r() * (16 - size)), y = Math.floor(r() * (16 - size));
    g.fillRect(x, y, size, size);
  }
}

const DIRT = [0.47, 0.32, 0.17];
const GRASS_GREEN = [0.36, 0.72, 0.27];
const STONE = [0.5, 0.5, 0.52];

function paintDirt(g, r) { noiseFill(g, r, DIRT, 0.1); }
function paintGrassTop(g, r) { noiseFill(g, r, GRASS_GREEN, 0.12); }
function paintGrassSide(g, r) {
  noiseFill(g, r, DIRT, 0.1);
  const rr = rng(913);
  for (let x = 0; x < 16; x++) {
    const depth = 3 + Math.floor(rr() * 3);
    for (let y = 0; y < depth; y++) {
      const v = (rr() - 0.5) * 0.1;
      g.fillStyle = `rgb(${conv(GRASS_GREEN[0] + v)},${conv(GRASS_GREEN[1] + v)},${conv(GRASS_GREEN[2] + v)})`;
      g.fillRect(x, y, 1, 1);
    }
  }
}
function paintBark(g, r) {
  noiseFill(g, r, [0.32, 0.21, 0.1], 0.08);
  // dark vertical stripes
  for (let x = 0; x < 16; x++) {
    if (x % 4 === 1) {
      g.fillStyle = "rgba(30,18,6,0.55)";
      g.fillRect(x, 0, 1, 16);
    }
  }
}
function paintRings(g, r) {
  noiseFill(g, r, [0.62, 0.45, 0.24], 0.06);
  g.fillStyle = "rgba(70,45,20,0.7)";
  // concentric squares
  for (let k = 0; k < 4; k++) {
    const o = k * 2;
    g.fillRect(o, o, 16 - o * 2, 1);
    g.fillRect(o, 15 - o, 16 - o * 2, 1);
    g.fillRect(o, o, 1, 16 - o * 2);
    g.fillRect(15 - o, o, 1, 16 - o * 2);
  }
}
function paintStone(g, r) { noiseFill(g, r, STONE, 0.07); }
function paintCoalOre(g, r) { paintStone(g, r); blobs(g, r, "#141414", 6, 2); }
function paintIronOre(g, r) { paintStone(g, r); blobs(g, r, "#d9975f", 6, 2); }
function paintPlanks(g, r) {
  noiseFill(g, r, [0.6, 0.43, 0.21], 0.05);
  g.fillStyle = "rgba(60,38,15,0.8)";
  for (let y = 3; y < 16; y += 4) g.fillRect(0, y, 16, 1);
  g.fillRect(4, 0, 1, 3); g.fillRect(11, 4, 1, 4); g.fillRect(5, 8, 1, 4); g.fillRect(12, 12, 1, 4);
}
function paintTableTop(g, r) {
  paintPlanks(g, r);
  g.fillStyle = "rgba(40,24,8,0.9)";
  g.fillRect(0, 0, 16, 1); g.fillRect(0, 15, 16, 1);
  g.fillRect(0, 0, 1, 16); g.fillRect(15, 0, 1, 16);
  g.fillRect(7, 1, 2, 14); g.fillRect(1, 7, 14, 2);
}
function paintTableSide(g, r) {
  paintPlanks(g, r);
  g.fillStyle = "rgba(40,24,8,0.85)";
  g.fillRect(0, 0, 16, 2);
}
function paintFurnace(g, r) {
  noiseFill(g, r, [0.42, 0.42, 0.44], 0.08);
  g.fillStyle = "rgba(20,20,22,0.7)";
  for (let y = 3; y < 16; y += 4) g.fillRect(0, y, 16, 1);
}
function paintFurnaceFront(g, r) {
  paintFurnace(g, r);
  g.fillStyle = "#0a0a0a";
  g.fillRect(5, 8, 6, 6);
  g.fillStyle = "#3a3a3a";
  g.fillRect(5, 8, 6, 1);
}
function paintCobble(g, r) {
  noiseFill(g, r, [0.45, 0.45, 0.47], 0.06);
  g.fillStyle = "rgba(25,25,28,0.8)";
  // jittered mortar grid
  for (let i = 0; i < 4; i++) {
    const y = i * 4 + Math.floor(r() * 2);
    g.fillRect(0, y, 16, 1);
    const x = i * 4 + Math.floor(r() * 2);
    g.fillRect(x, 0, 1, 16);
  }
}
function paintLeaves(g, r) {
  noiseFill(g, r, [0.13, 0.45, 0.13], 0.14);
  blobs(g, r, "rgba(8,30,8,0.8)", 14, 1);
}
function paintSand(g, r) { noiseFill(g, r, [0.85, 0.78, 0.55], 0.07); }
function paintSnow(g, r) { noiseFill(g, r, [0.92, 0.93, 0.95], 0.04); }
function paintBedrock(g, r) { noiseFill(g, r, [0.12, 0.12, 0.13], 0.14); }
function paintWater(g) { g.fillStyle = "#4472dd"; g.fillRect(0, 0, 16, 16); }
function paintGlass(g, r) {
  noiseFill(g, r, [0.78, 0.88, 0.92], 0.05);
  g.fillStyle = "rgba(255,255,255,0.9)";
  g.fillRect(2, 2, 4, 1); g.fillRect(2, 2, 1, 4); // shine corner
  g.fillStyle = "rgba(120,150,170,0.9)";
  g.fillRect(0, 0, 16, 1); g.fillRect(0, 15, 16, 1);
  g.fillRect(0, 0, 1, 16); g.fillRect(15, 0, 1, 16); // frame
}
function paintGoldOre(g, r) { paintStone(g, r); blobs(g, r, "#f4c20d", 6, 2); }
function paintDiamondOre(g, r) { paintStone(g, r); blobs(g, r, "#5ff2e0", 5, 2); }
function paintFence(g, r) {
  noiseFill(g, r, [0.6, 0.43, 0.21], 0.05);
  g.fillStyle = "rgba(35,22,8,0.9)";
  g.fillRect(0, 0, 16, 16); // gaps read as dark (full-cube fence)
  g.fillStyle = "#9c6f34";
  g.fillRect(2, 0, 3, 16); g.fillRect(11, 0, 3, 16); // posts
  g.fillRect(0, 3, 16, 3); g.fillRect(0, 10, 16, 3); // rails
}
function paintBrick(g, r) {
  noiseFill(g, r, [0.55, 0.55, 0.57], 0.05);
  g.fillStyle = "rgba(25,25,28,0.85)";
  for (let y = 0; y < 16; y += 4) g.fillRect(0, y, 16, 1);
  for (let y = 0; y < 16; y += 4) {
    const off = (y / 4) % 2 === 0 ? 0 : 4;
    for (let x = off; x < 16; x += 8) g.fillRect(x, y, 1, 4);
  }
}
function paintLadder(g, r) {
  g.fillStyle = "#3a2c14"; g.fillRect(0, 0, 16, 16);
  noiseFill(g, r, [0.55, 0.4, 0.2], 0.06);
  g.fillStyle = "#8a5f30";
  g.fillRect(1, 0, 3, 16); g.fillRect(12, 0, 3, 16); // rails
  for (let y = 2; y < 16; y += 4) g.fillRect(1, y, 14, 2); // rungs
}
function paintBedSide(g, r) {
  noiseFill(g, r, [0.6, 0.43, 0.21], 0.05);
  g.fillStyle = "#c22f2f"; g.fillRect(0, 0, 16, 6); // blanket over foot
  g.fillStyle = "#e8e8e8"; g.fillRect(0, 6, 16, 3); // sheet
}
function paintBedTop(g, r) {
  noiseFill(g, r, [0.76, 0.18, 0.18], 0.05);
  g.fillStyle = "#e8e8e8"; g.fillRect(0, 10, 16, 6); // pillow end
}
function paintTorchIcon(g, r) {
  g.fillStyle = "#8a5f30"; g.fillRect(7, 6, 2, 10);
  noiseFill(g, r, [1.0, 0.8, 0.3], 0.1);
  g.fillStyle = "#ffcf4d"; g.fillRect(5, 1, 6, 6);
  g.fillStyle = "#fff08a"; g.fillRect(6, 2, 3, 3);
}

// Representative face per block for inventory icons (data URLs, cached).
const ICON_PAINT = {
  1: [paintGrassTop, 110], 2: [paintDirt, 12], 3: [paintStone, 13],
  4: [paintSand, 14], 5: [paintRings, 150], 6: [paintLeaves, 16],
  7: [paintPlanks, 17], 8: [paintBedrock, 18], 9: [paintSnow, 19],
  10: [paintWater, 0], 11: [paintCoalOre, 21], 12: [paintIronOre, 22],
  13: [paintTableTop, 230], 14: [paintFurnaceFront, 240],
  15: [paintTorchIcon, 7], 16: [paintCobble, 26], 17: [paintGlass, 27],
  18: [paintGoldOre, 28], 19: [paintDiamondOre, 29], 20: [paintFence, 30],
  21: [paintBrick, 31], 22: [paintLadder, 32], 23: [paintBedTop, 33],
};
const iconCache = new Map();
export function blockIconURL(block) {
  const hit = iconCache.get(block);
  if (hit) return hit;
  const [paint, seed] = ICON_PAINT[block] ?? [paintStone, 1];
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  paint(c.getContext("2d"), rng(seed));
  const url = c.toDataURL();
  iconCache.set(block, url);
  return url;
}

export function makeMaterials() {
  const M = (tex, opts = {}) => new THREE.MeshLambertMaterial({ map: tex, ...opts });
  const dirt = M(makeCanvas(paintDirt, 12));
  const stone = M(makeCanvas(paintStone, 13));
  const planks = M(makeCanvas(paintPlanks, 17));
  const grassSide = M(makeCanvas(paintGrassSide, 11));
  const grassTop = M(makeCanvas(paintGrassTop, 110));
  const bark = M(makeCanvas(paintBark, 15));
  const rings = M(makeCanvas(paintRings, 150));
  const tableSide = M(makeCanvas(paintTableSide, 23));
  const tableTop = M(makeCanvas(paintTableTop, 230));
  const furnace = M(makeCanvas(paintFurnace, 24));
  const furnaceFront = M(makeCanvas(paintFurnaceFront, 240));
  const bedSide = M(makeCanvas(paintBedSide, 34));
  const bedTop = M(makeCanvas(paintBedTop, 33));
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z
  return {
    [B.GRASS]: [grassSide, grassSide, grassTop, dirt, grassSide, grassSide],
    [B.DIRT]: dirt,
    [B.STONE]: stone,
    [B.SAND]: M(makeCanvas(paintSand, 14)),
    [B.LOG]: [bark, bark, rings, rings, bark, bark],
    [B.LEAVES]: M(makeCanvas(paintLeaves, 16)),
    [B.PLANKS]: planks,
    [B.BEDROCK]: M(makeCanvas(paintBedrock, 18)),
    [B.SNOW]: M(makeCanvas(paintSnow, 19)),
    [B.WATER]: new THREE.MeshLambertMaterial({ color: 0x3355dd, transparent: true, opacity: 0.7 }),
    [B.COAL_ORE]: M(makeCanvas(paintCoalOre, 21)),
    [B.IRON_ORE]: M(makeCanvas(paintIronOre, 22)),
    [B.CRAFT_TABLE]: [tableSide, tableSide, tableTop, planks, tableSide, tableSide],
    [B.FURNACE]: [furnace, furnace, stone, stone, furnaceFront, furnace],
    [B.TORCH]: new THREE.MeshLambertMaterial({ color: 0xffcf4d, emissive: 0xaa6611 }),
    [B.COBBLE]: M(makeCanvas(paintCobble, 26)),
    [B.GLASS]: M(makeCanvas(paintGlass, 27), { transparent: true, opacity: 0.85 }),
    [B.GOLD_ORE]: M(makeCanvas(paintGoldOre, 28)),
    [B.DIAMOND_ORE]: M(makeCanvas(paintDiamondOre, 29)),
    [B.FENCE]: M(makeCanvas(paintFence, 30)),
    [B.STONE_BRICK]: M(makeCanvas(paintBrick, 31)),
    [B.LADDER]: M(makeCanvas(paintLadder, 32)),
    [B.BED]: [bedSide, bedSide, bedTop, planks, bedSide, bedSide],
  };
}

export class WorldClient {
  constructor(scene, materials) {
    this.scene = scene;
    this.materials = materials;
    this.chunks = new Map(); // "cx,cz" -> Uint8Array
    this.meshes = new Map(); // "cx,cz" -> THREE.Group
    this.torches = new Map(); // "cx,cz" -> [[x,y,z],...] for light pooling
    this.geo = new THREE.BoxGeometry(1, 1, 1);
    this.dummy = new THREE.Object3D();
  }

  static idx(x, y, z) { return (y * CHUNK + z) * CHUNK + x; }

  setChunk(cx, cz, data) {
    this.chunks.set(`${cx},${cz}`, data);
    this.remesh(cx, cz);
    // remesh neighbours so border faces update
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (this.chunks.has(`${cx + dx},${cz + dz}`)) this.remesh(cx + dx, cz + dz);
    }
  }

  /** Drop a far-away chunk (frees meshes + data). Remaining neighbours remesh. */
  dropChunk(cx, cz) {
    const key = `${cx},${cz}`;
    const old = this.meshes.get(key);
    if (old) {
      this.scene.remove(old);
      old.children.forEach((m) => m.dispose?.());
      this.meshes.delete(key);
    }
    this.chunks.delete(key);
    this.torches.delete(key);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (this.chunks.has(`${cx + dx},${cz + dz}`)) this.remesh(cx + dx, cz + dz);
    }
  }

  get(x, y, z) {
    x = Math.round(x); y = Math.round(y); z = Math.round(z);
    if (y < 0 || y >= WORLD_H) return B.AIR;
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const c = this.chunks.get(`${cx},${cz}`);
    if (!c) return undefined; // unknown
    return c[WorldClient.idx(x - cx * CHUNK, y, z - cz * CHUNK)];
  }

  setLocal(x, y, z, v) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const c = this.chunks.get(`${cx},${cz}`);
    if (!c) return;
    const lx = x - cx * CHUNK, lz = z - cz * CHUNK;
    c[WorldClient.idx(lx, y, lz)] = v;
    this.remesh(cx, cz);
    // edits on a chunk border change face-culling in the neighbour's mesh too
    if (lx === 0) this.remesh(cx - 1, cz);
    if (lx === CHUNK - 1) this.remesh(cx + 1, cz);
    if (lz === 0) this.remesh(cx, cz - 1);
    if (lz === CHUNK - 1) this.remesh(cx, cz + 1);
  }

  remesh(cx, cz) {
    const key = `${cx},${cz}`;
    const data = this.chunks.get(key);
    if (!data) return;
    const old = this.meshes.get(key);
    if (old) {
      this.scene.remove(old);
      old.children.forEach((m) => m.dispose?.());
    }
    const group = new THREE.Group();
    const byType = new Map();
    const torchList = [];
    const getL = (x, y, z) => {
      if (y < 0 || y >= WORLD_H) return B.AIR;
      // local fast path
      const lx = x - cx * CHUNK, lz = z - cz * CHUNK;
      if (lx >= 0 && lx < CHUNK && lz >= 0 && lz < CHUNK) return data[WorldClient.idx(lx, y, lz)];
      const o = this.get(x, y, z);
      return o === undefined ? B.STONE : o; // treat unknown as opaque to avoid holes
    };
    for (let y = 0; y < WORLD_H; y++) {
      for (let z = 0; z < CHUNK; z++) {
        for (let x = 0; x < CHUNK; x++) {
          const b = data[WorldClient.idx(x, y, z)];
          if (b === B.AIR) continue;
          const wx = cx * CHUNK + x, wz = cz * CHUNK + z;
          // face culling: skip if fully buried
          if (OPAQUE.has(b)) {
            if (
              OPAQUE.has(getL(wx + 1, y, wz)) && OPAQUE.has(getL(wx - 1, y, wz)) &&
              OPAQUE.has(getL(wx, y + 1, wz)) && OPAQUE.has(getL(wx, y - 1, wz)) &&
              OPAQUE.has(getL(wx, y, wz + 1)) && OPAQUE.has(getL(wx, y, wz - 1))
            ) continue;
          } else if (b === B.WATER) {
            const up = getL(wx, y + 1, wz);
            if (up === B.WATER) continue; // hide submerged water sides (approx via full-cube skip)
          }
          if (!byType.has(b)) byType.set(b, []);
          byType.get(b).push([wx, y, wz]);
          if (b === B.TORCH) torchList.push([wx + 0.5, y + 0.6, wz + 0.5]);
        }
      }
    }
    for (const [b, list] of byType) {
      const mat = this.materials[b];
      if (!mat) continue;
      const mesh = new THREE.InstancedMesh(this.geo, mat, list.length);
      list.forEach(([wx, y, wz], i) => {
        this.dummy.position.set(wx + 0.5, y + 0.5, wz + 0.5);
        if (b === B.TORCH) this.dummy.scale.set(0.25, 0.6, 0.25);
        else this.dummy.scale.set(1, 1, 1);
        if (b === B.WATER) this.dummy.position.y -= 0.12;
        this.dummy.updateMatrix();
        mesh.setMatrixAt(i, this.dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.dummy.scale.set(1, 1, 1);
      group.add(mesh);
    }
    this.scene.add(group);
    this.meshes.set(key, group);
    this.torches.set(key, torchList);
  }

  /** Subtle ambient animation: water opacity pulse + torch glow flicker. */
  tickAnim(timeMs) {
    const t = timeMs / 1000;
    const water = this.materials[B.WATER];
    if (water) water.opacity = 0.62 + 0.08 * Math.sin(t * 1.6);
    const torch = this.materials[B.TORCH];
    if (torch) torch.emissiveIntensity = 1 + 0.18 * Math.sin(t * 7.3);
  }

  /** Nearest torch positions to p ( block coords ), up to `n` within `maxDist`. */
  nearestTorches(p, n, maxDist) {    const scored = [];
    for (const list of this.torches.values()) {
      for (const t of list) {
        const d2 = (t[0] - p.x) ** 2 + (t[1] - p.y) ** 2 + (t[2] - p.z) ** 2;
        if (d2 < maxDist * maxDist) scored.push([d2, t]);
      }
    }
    scored.sort((a, b) => a[0] - b[0]);
    return scored.slice(0, n).map((s) => s[1]);
  }

  hasBlockNear(x, y, z, block, r) {
    const xi = Math.round(x), yi = Math.round(y), zi = Math.round(z);
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dz = -r; dz <= r; dz++) {
          if (this.get(xi + dx, yi + dy, zi + dz) === block) return true;
        }
      }
    }
    return false;
  }

  /** Voxel DDA raycast. Returns {x,y,z,nx,ny,nz,block} or null. */
  raycast(origin, dir, maxDist) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = Math.sign(dir.x), stepY = Math.sign(dir.y), stepZ = Math.sign(dir.z);
    const tDeltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity;
    const fx = origin.x - x, fy = origin.y - y, fz = origin.z - z;
    let tMaxX = stepX !== 0 ? (stepX > 0 ? (1 - fx) : fx) * tDeltaX : Infinity;
    let tMaxY = stepY !== 0 ? (stepY > 0 ? (1 - fy) : fy) * tDeltaY : Infinity;
    let tMaxZ = stepZ !== 0 ? (stepZ > 0 ? (1 - fz) : fz) * tDeltaZ : Infinity;
    let nx = 0, ny = 0, nz = 0, t = 0;
    for (let i = 0; i < 128; i++) {
      const b = this.get(x, y, z);
      if (b !== undefined && b !== B.AIR && b !== B.WATER) {
        if (t > 0) return { x, y, z, nx, ny, nz, block: b };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0; }
      else if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0; }
      else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ; }
      if (t > maxDist) return null;
    }
    return null;
  }
}
