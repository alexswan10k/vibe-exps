// Authoritative voxel world: seeded terrain gen, block overrides, persistence.
// Coordinates: x,z unbounded, y in [0, WORLD_H).

import { B, CHUNK, WORLD_H, SEA_LEVEL, encodeRLE } from "./protocol.ts";

function hash2(x: number, z: number, seed: number): number {
  // 32-bit integer hash — must use Math.imul (plain * overflows doubles
  // past 2^53 and destroys uniformity).
  let h = seed | 0;
  h = Math.imul(h ^ Math.imul(x | 0, 374761393), 668265263) ^ Math.imul(z | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

// Deterministic value-noise height, no deps.
function vnoise(x: number, z: number, seed: number): number {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = smooth(xf), v = smooth(zf);
  const a = hash2(xi, zi, seed);
  const b = hash2(xi + 1, zi, seed);
  const c = hash2(xi, zi + 1, seed);
  const d = hash2(xi + 1, zi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function terrainHeight(x: number, z: number, seed: number): number {
  const cont = vnoise(x * 0.008, z * 0.008, seed); // continents / oceans
  const hills = vnoise(x * 0.035 + 100, z * 0.035 - 100, seed ^ 0x111); // rolling hills
  const det = vnoise(x * 0.15, z * 0.15, seed ^ 0x222); // detail
  let h = 8 + cont * 24 + (hills - 0.5) * 10 + (det - 0.5) * 3;
  if (cont > 0.62) h += (cont - 0.62) * 40; // mountain ranges
  return Math.max(2, Math.min(WORLD_H - 14, Math.floor(h)));
}

/** 0..1 forest density mask. */
export function forestAt(x: number, z: number, seed: number): number {
  return vnoise(x * 0.02 + 500, z * 0.02 - 500, seed ^ 0x333);
}

export function treeAt(x: number, z: number, seed: number): boolean {
  const dense = forestAt(x, z, seed) > 0.55;
  const thresh = dense ? 0.93 : 0.993; // forests vs lone trees
  return hash2(x, z, seed ^ 0x51ab) > thresh;
}

const key = (x: number, y: number, z: number) => `${x},${y},${z}`;

export class World {
  seed: number;
  overrides = new Map<string, number>(); // player edits (incl. placed & removed)
  time = 0.25; // 0..1, 0.25 = morning
  savePath: string;
  private saveTimer = 0;

  constructor(seed: number, savePath: string) {
    this.seed = seed;
    this.savePath = savePath;
  }

  static async loadOrCreate(savePath: string): Promise<World> {
    try {
      const raw = await Deno.readTextFile(savePath);
      const d = JSON.parse(raw);
      const w = new World(d.seed ?? 1337, savePath);
      w.time = d.time ?? 0.25;
      for (const [k, v] of Object.entries(d.overrides ?? {})) w.overrides.set(k, v as number);
      console.log(`[world] loaded ${w.overrides.size} overrides from ${savePath}`);
      return w;
    } catch {
      const w = new World(Math.floor(Math.random() * 1e9), savePath);
      console.log(`[world] new world, seed=${w.seed}`);
      return w;
    }
  }

  async save(): Promise<void> {
    try {
      await Deno.mkdir(this.savePath.split("/").slice(0, -1).join("/"), { recursive: true });
      const d = { seed: this.seed, time: this.time, overrides: Object.fromEntries(this.overrides) };
      await Deno.writeTextFile(this.savePath, JSON.stringify(d));
    } catch (e) {
      console.error("[world] save failed:", e);
    }
  }

  // Base terrain block (before overrides). Returns B.* id.
  baseBlock(x: number, y: number, z: number): number {
    if (y < 0 || y >= WORLD_H) return B.AIR;
    if (y === 0) return B.BEDROCK;
    const h = terrainHeight(x, z, this.seed);
    if (y <= h - 4) {
      // ores sprinkled in stone
      const r = hash2(x * 3 + y * 7, z * 5 - y, this.seed ^ 0x0e3);
      if (y < h - 1 && r > 0.986 && y <= 22) return B.COAL_ORE;
      if (y < h - 2 && r > 0.993 && y <= 14) return B.IRON_ORE;
      const r2 = hash2(x * 5 - y * 3, z * 7 + y, this.seed ^ 0x60d);
      if (y < h - 3 && r2 > 0.9965 && y <= 9) return B.DIAMOND_ORE;
      if (y < h - 2 && r2 > 0.9945 && y <= 12) return B.GOLD_ORE;
      return B.STONE;
    }
    if (y < h) return B.DIRT;
    if (y === h) {
      if (h <= SEA_LEVEL + 1) return B.SAND;
      if (h >= 27) return B.SNOW;
      return B.GRASS;
    }
    // above surface
    if (y <= SEA_LEVEL) return B.WATER;
    // per-column tree check: is (x,z) part of a tree rooted nearby?
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const tx = x - dx, tz = z - dz;
        if (!treeAt(tx, tz, this.seed)) continue;
        const th = terrainHeight(tx, tz, this.seed);
        if (th <= SEA_LEVEL + 1 || th >= 28) continue; // not on beach / snow
        const trunkH = 4 + Math.floor(hash2(tx, tz, this.seed ^ 0x77) * 2); // 4-5
        const top = th + trunkH;
        if (dx === 0 && dz === 0 && y > th && y <= top) return B.LOG;
        // leaf canopy: two full layers, a ring, then a cap
        const dy = y - top;
        const adx = Math.abs(dx), adz = Math.abs(dz);
        if (dy === -2 || dy === -1) {
          if (adx <= 2 && adz <= 2 && !(adx === 2 && adz === 2)) return B.LEAVES;
        } else if (dy === 0) {
          if (adx + adz <= 2 && !(adx === 0 && adz === 0)) return B.LEAVES;
        } else if (dy === 1) {
          if (adx + adz <= 1) return B.LEAVES;
        }
      }
    }
    return B.AIR;
  }

  get(x: number, y: number, z: number): number {
    x = Math.round(x); y = Math.round(y); z = Math.round(z);
    if (y < 0 || y >= WORLD_H) return B.AIR;
    const k = key(x, y, z);
    const o = this.overrides.get(k);
    if (o !== undefined) return o;
    return this.baseBlock(x, y, z);
  }

  set(x: number, y: number, z: number, v: number): void {
    x = Math.round(x); y = Math.round(y); z = Math.round(z);
    if (y < 1 || y >= WORLD_H) return; // never edit bedrock layer / out of range
    const k = key(x, y, z);
    if (v === B.AIR) {
      // removing: record AIR only if base wasn't air
      if (this.baseBlock(x, y, z) === B.AIR) this.overrides.delete(k);
      else this.overrides.set(k, B.AIR);
    } else {
      if (this.baseBlock(x, y, z) === v) this.overrides.delete(k);
      else this.overrides.set(k, v);
    }
  }

  isSolid(x: number, y: number, z: number): boolean {
    const b = this.get(x, y, z);
    return b !== B.AIR && b !== B.WATER && b !== B.LADDER; // ladders are climb-through
  }

  /** True if `block` exists within `r` blocks (cube) of pos. */
  hasBlockNear(x: number, y: number, z: number, block: number, r: number): boolean {
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

  groundHeight(x: number, z: number): number {
    for (let y = WORLD_H - 1; y >= 0; y--) {
      if (this.isSolid(x, y, z)) return y;
    }
    return 0;
  }

  findSpawn(): [number, number, number] {
    for (let r = 0; r < 400; r += 8) {
      const x = r === 0 ? 0.5 : Math.floor(hash2(r, 7, this.seed) * r * 2 - r) + 0.5;
      const z = r === 0 ? 0.5 : Math.floor(hash2(r, 13, this.seed) * r * 2 - r) + 0.5;
      const xi = Math.floor(x), zi = Math.floor(z);
      const h = terrainHeight(xi, zi, this.seed);
      if (h <= SEA_LEVEL + 1 || h >= 26) continue;
      const top = this.get(xi, h, zi);
      if (top !== B.GRASS && top !== B.SAND) continue;
      // clear headroom: no trunks/leaves (or player builds) above
      let clear = true;
      for (let y = h + 1; y <= h + 7; y++) {
        if (this.get(xi, y, zi) !== B.AIR) { clear = false; break; }
      }
      if (!clear) continue;
      return [xi + 0.5, h + 2.5, zi + 0.5];
    }
    return [0.5, 30, 0.5];
  }

  chunkData(cx: number, cz: number): Uint8Array {
    const out = new Uint8Array(CHUNK * WORLD_H * CHUNK);
    let i = 0;
    for (let y = 0; y < WORLD_H; y++) {
      for (let z = 0; z < CHUNK; z++) {
        for (let x = 0; x < CHUNK; x++) {
          out[i++] = this.get(cx * CHUNK + x, y, cz * CHUNK + z);
        }
      }
    }
    return out;
  }

  chunkRLE(cx: number, cz: number): number[] {
    return encodeRLE(this.chunkData(cx, cz));
  }

  tick(dt: number): void {
    this.time = (this.time + dt / 600) % 1; // 10-min full day
    this.saveTimer += dt;
    if (this.saveTimer > 30) {
      this.saveTimer = 0;
      void this.save();
    }
  }

  isNight(): boolean {
    return this.time < 0.02 || this.time > 0.52;
  }
}
