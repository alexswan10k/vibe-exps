// Client voxel store: chunk cache (Uint8Array per chunk) + Three.js meshing.
// Layout matches server: index = (y * CHUNK + z) * CHUNK + x.
import { B, CHUNK, WORLD_H } from "./config.js";

const OPAQUE = new Set([1, 2, 3, 4, 5, 7, 8, 9, 11, 12, 13, 14, 16]);

function px(n) { return Math.floor(n * 255); }

// tiny deterministic rng for textures
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967295;
  };
}

function canvasTex(base, vary, seed, topStrip) {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const g = c.getContext("2d");
  const r = rng(seed);
  const [br, bg, bb] = base;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const v = (r() - 0.5) * vary;
      g.fillStyle = `rgb(${px((br + v))},${px((bg + v))},${px((bb + v))})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  if (topStrip) {
    // grass-style: green top rows with jagged edge
    const rr = rng(seed + 99);
    for (let x = 0; x < 16; x++) {
      const depth = 3 + Math.floor(rr() * 3);
      for (let y = 0; y < depth; y++) {
        const v = (rr() - 0.5) * 0.08;
        g.fillStyle = `rgb(${px(0.33 + v)},${px(0.75 + v)},${px(0.3 + v)})`;
        g.fillRect(x, y, 1, 1);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.encoding = THREE.sRGBEncoding;
  return t;
}

export function makeMaterials() {
  const M = (tex, opts = {}) =>
    new THREE.MeshLambertMaterial({ map: tex, ...opts });
  const flat = (r, g, b, opts = {}) =>
    new THREE.MeshLambertMaterial({ color: new THREE.Color(r, g, b), ...opts });
  return {
    [B.GRASS]: M(canvasTex([0.45, 0.3, 0.15], 0.09, 11, true)),
    [B.DIRT]: M(canvasTex([0.45, 0.3, 0.15], 0.1, 12)),
    [B.STONE]: M(canvasTex([0.5, 0.5, 0.52], 0.07, 13)),
    [B.SAND]: M(canvasTex([0.85, 0.78, 0.55], 0.07, 14)),
    [B.LOG]: M(canvasTex([0.35, 0.22, 0.1], 0.12, 15)),
    [B.LEAVES]: M(canvasTex([0.15, 0.5, 0.15], 0.16, 16)),
    [B.PLANKS]: M(canvasTex([0.6, 0.42, 0.2], 0.06, 17)),
    [B.BEDROCK]: M(canvasTex([0.12, 0.12, 0.13], 0.12, 18)),
    [B.SNOW]: M(canvasTex([0.92, 0.93, 0.95], 0.04, 19)),
    [B.WATER]: new THREE.MeshLambertMaterial({
      color: 0x3355dd, transparent: true, opacity: 0.7,
    }),
    [B.COAL_ORE]: M(canvasTex([0.4, 0.4, 0.42], 0.08, 21)),
    [B.IRON_ORE]: M(canvasTex([0.55, 0.45, 0.38], 0.08, 22)),
    [B.CRAFT_TABLE]: M(canvasTex([0.55, 0.38, 0.18], 0.1, 23)),
    [B.FURNACE]: M(canvasTex([0.35, 0.35, 0.37], 0.09, 24)),
    [B.TORCH]: flat(1.0, 0.8, 0.3, { emissive: 0xaa6611 }),
    [B.COBBLE]: M(canvasTex([0.45, 0.45, 0.47], 0.12, 26)),
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
    c[WorldClient.idx(x - cx * CHUNK, y, z - cz * CHUNK)] = v;
    this.remesh(cx, cz);
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
      this.dummy.scale.set(1, 1, 1);
      group.add(mesh);
    }
    this.scene.add(group);
    this.meshes.set(key, group);
    this.torches.set(key, torchList);
  }

  /** Nearest torch positions to p ( block coords ), up to `n` within `maxDist`. */
  nearestTorches(p, n, maxDist) {
    const scored = [];
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
