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

function hash3(x: number, y: number, z: number, seed: number): number {
  // same discipline as hash2, extended to 3 inputs (imul coerces to int32 —
  // large constants wrap but stay deterministic).
  let h = seed | 0;
  h = Math.imul(h ^ Math.imul(x | 0, 374761393), 668265263);
  h = Math.imul(h ^ Math.imul(y | 0, 2246822519), 3266489917);
  h = Math.imul(h ^ Math.imul(z | 0, 668265263), 374761393);
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

// Trilinear value noise in 3D (for caves). Same lattice discipline as vnoise.
function vnoise3(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = smooth(xf), v = smooth(yf), w = smooth(zf);
  const c000 = hash3(xi, yi, zi, seed);
  const c100 = hash3(xi + 1, yi, zi, seed);
  const c010 = hash3(xi, yi + 1, zi, seed);
  const c110 = hash3(xi + 1, yi + 1, zi, seed);
  const c001 = hash3(xi, yi, zi + 1, seed);
  const c101 = hash3(xi + 1, yi, zi + 1, seed);
  const c011 = hash3(xi, yi + 1, zi + 1, seed);
  const c111 = hash3(xi + 1, yi + 1, zi + 1, seed);
  const x00 = c000 + (c100 - c000) * u;
  const x10 = c010 + (c110 - c010) * u;
  const x01 = c001 + (c101 - c001) * u;
  const x11 = c011 + (c111 - c011) * u;
  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
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

// Cave mouths: walk-in 1-wide, 3-tall staircases descending from a surface
// notch. Every step is exactly 1 down with full headroom, walkable both ways.
// Two orientations (eastward + southward, picked by hash) so entrances don't
// all line up. Rarity ~1/650 columns on an 8-block grid. A 3x3 porch is
// cleared above the notch so mouths read from a distance; stairs pierce the
// tunnel network on the way down, and below the last step you spelunk out.
const MOUTH_KEEP = 0.93;
function mouthDir(mx: number, mz: number, seed: number): number {
  return hash2(mx ^ 0x5bd1, mz ^ 0x11fd, seed ^ 0x90e1) < 0.5 ? 0 : 1; // 0=E, 1=S
}
export function mouthOriginAt(mx: number, mz: number, seed: number): number {
  // returns surface height, or -1 for "no mouth here"
  if ((mx & 7) !== 0 || (mz & 7) !== 0) return -1; // grid-aligned (cheap to scan)
  if (hash2(mx, mz, seed ^ 0x90e1) < MOUTH_KEEP) return -1;
  const h = terrainHeight(mx, mz, seed);
  if (h <= SEA_LEVEL + 1 || h < 14) return -1; // no ocean/beach mouths, need depth
  if (treeAt(mx, mz, seed)) return -1; // no floating trees over the notch
  return h;
}

// 0 = not a stair cell, 1 = stair corridor (air), 2 = load-bearing stair floor.
function stairCell(x: number, y: number, z: number, seed: number): number {
  if (y < 4) return 0;
  // eastward stairs live on rows with (z&7)==0, southward on cols with (x&7)==0
  for (let m = 0; m < 2; m++) {
    if (m === 0 && (z & 7) !== 0) continue;
    if (m === 1 && (x & 7) !== 0) continue;
    const along = m === 0 ? x : z;
    const fixed = m === 0 ? z : x;
    const g = along - ((((along % 8) + 8) % 8)); // greatest multiple of 8 <= along
    for (let mo = g; mo >= along - 30; mo -= 8) {
      const mx = m === 0 ? mo : fixed;
      const mz = m === 0 ? fixed : mo;
      if (hash2(mx, mz, seed ^ 0x90e1) < MOUTH_KEEP) continue;
      if (mouthDir(mx, mz, seed) !== m) continue;
      const h = terrainHeight(mx, mz, seed);
      if (h <= SEA_LEVEL + 1 || h < 14) continue;
      if (treeAt(mx, mz, seed)) continue;
      const t = along - mo;
      const bottom = Math.max(6, h - 14);
      if (t < 0 || t > h - bottom) continue;
      // never behead a trunk where the stair crosses a lower slope sideways
      if (treeAt(x, z, seed) && y > terrainHeight(x, z, seed)) continue;
      if (y >= h - t && y <= h - t + 2) return 1;
      if (y === h - t - 1) return 2;
    }
  }
  return 0;
}

// True if (x,y,z) is within 1 block of any stair corridor/floor: the stair
// shell. Worms never carve the shell, so the walkway keeps walls + a support
// pillar underneath and never floats, opens into a void sideways, or loses
// its ceiling. Pockets may still open at distance >= 2 (see carvedAt).
function nearStair(x: number, y: number, z: number, seed: number): boolean {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (stairCell(x + dx, y + dy, z + dz, seed) !== 0) return true;
      }
    }
  }
  return false;
}

// Procedural caves: three layers, all deterministic value-noise.
//  1. spaghetti worms — two meandering tubes (main + branch). Radius grows
//     with depth (2-wide up high, 3-4 wide deep) so tunnels are walkable.
//     A vertical sine meander keeps them 3D, not flat pancakes.
//  2. vertical shafts — narrow chimneys linking levels (rare, 2x2).
//  3. cheese chambers — low-frequency blobs: medium rooms up high, big
//     caverns deep down (up to ~9 wide, 5 tall).
// Caller guarantees y in [4, h-2]: 2+ blocks of roof everywhere, so the
// tunnel system itself never breaches the surface (mouths are the entrances).
function wormDist2(x: number, y: number, z: number, seed: number, branch: boolean): number {
  const s = branch ? 0.085 : 0.045;
  const ox = branch ? 317.7 : 0;
  const oz = branch ? -113.3 : 0;
  const sx = branch ? 0xca2e : 0xca1e;
  // meander: bend the sample point so tubes curve vertically instead of
  // running flat along y
  const bend = Math.sin(y * 0.35 + x * 0.05) * 1.6 + Math.sin(z * 0.07 + y * 0.2) * 1.6;
  const a = vnoise3((x + bend) * s + ox, y * s * 1.5, (z - bend * 0.7) * s + oz, seed ^ sx);
  const b = vnoise3((x - bend) * s + ox + 51.3, y * s * 1.5, (z + bend) * s + oz - 27.1, seed ^ (sx + 1));
  const dx = a - 0.5, dz = b - 0.5;
  return dx * dx + dz * dz;
}
function carvedAt(x: number, y: number, z: number, seed: number, h: number): boolean {
  const depth = Math.max(0, Math.min(1, (h - y) / Math.max(1, h - 4))); // 0=top 1=deep
  // main worm: R 0.04 -> 0.065 with depth (≈2-wide up high, 3-wide deep)
  const rMain = 0.04 + depth * 0.025;
  if (wormDist2(x, y, z, seed, false) < rMain * rMain) {
    if (nearStair(x, y, z, seed)) return false;
    return true;
  }
  // branch worm: thinner, only mid/deep so the surface isn't Swiss cheese
  if (depth > 0.35) {
    const rBr = 0.032 + depth * 0.015;
    if (wormDist2(x, y, z, seed, true) < rBr * rBr) {
      if (nearStair(x, y, z, seed)) return false;
      return true;
    }
  }
  // vertical shaft: columnar noise (stretched in y) — rare chimneys (~1-2%)
  if (y > 5 && y <= h - 3) {
    const sh = vnoise3(x * 0.07 + 911.7, y * 0.012, z * 0.07 - 433.1, seed ^ 0xc4a1);
    if (Math.abs(sh - 0.5) < 0.012 && hash3(x >> 1, 7, z >> 1, seed ^ 0x511f) > 0.8) {
      if (nearStair(x, y, z, seed)) return false;
      return true;
    }
  }
  // cheese chambers: big caverns are the INTERSECTION of two independent
  // low-frequency blobs (~1% shallow, ~3% deep, stable across seeds — a single
  // low-freq noise would hollow out whole 100-block regions wherever its blob
  // sits high). Medium rooms are a rare single noise throughout.
  if (y <= h - 3) {
    const n1 = vnoise3(x * 0.03 + 731.3, y * 0.036, z * 0.03 - 57.9, seed ^ 0xca3e);
    const t1 = 0.74 - depth * 0.05;
    if (n1 > t1) {
      const n2 = vnoise3(x * 0.033 + 173.1, y * 0.04, z * 0.033 + 91.7, seed ^ 0xca5e);
      if (n2 > 0.72 - depth * 0.05) {
        if (!nearStair(x, y, z, seed)) return true;
      }
    } else {
      const med = vnoise3(x * 0.055 + 41.7, y * 0.06, z * 0.055 - 91.2, seed ^ 0xca4e);
      if (med > 0.885 - depth * 0.03) {
        if (!nearStair(x, y, z, seed)) return true;
      }
    }
  }
  return false;
}

// Halo test: within ~2 blocks of a carve (slightly fatter worm / looser
// chamber). Used to boost ore rates on cave walls so tunnels sparkle.
function caveHalo(x: number, y: number, z: number, seed: number, h: number): boolean {
  const depth = Math.max(0, Math.min(1, (h - y) / Math.max(1, h - 4)));
  const rMain = 0.04 + depth * 0.025 + 0.03;
  if (wormDist2(x, y, z, seed, false) < rMain * rMain) return true;
  if (depth > 0.35) {
    const rBr = 0.032 + depth * 0.015 + 0.025;
    if (wormDist2(x, y, z, seed, true) < rBr * rBr) return true;
  }
  return vnoise3(x * 0.03 + 731.3, y * 0.036, z * 0.03 - 57.9, seed ^ 0xca3e) > 0.68;
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
    if (y === 1 && hash3(x, y, z, this.seed) < 0.5) return B.BEDROCK; // rough floor, no void peeks
    const h = terrainHeight(x, z, this.seed);
    // cave staircases (incl. the surface notch) carve first …
    if (y >= 4 && stairCell(x, y, z, this.seed) === 1) return B.AIR;
    // entrance porch: clear headroom + leaves in a 3x3 around the notch so
    // mouths read from a distance instead of hiding under a tree canopy
    if (y > h && y <= h + 2) {
      const qx = x - ((((x % 8) + 8) % 8));
      const qz = z - ((((z % 8) + 8) % 8));
      for (let ox = -1; ox <= 1; ox++) {
        for (let oz = -1; oz <= 1; oz++) {
          if (mouthOriginAt(qx + ox, qz + oz, this.seed) >= 0) {
            const mh = terrainHeight(qx + ox, qz + oz, this.seed);
            if (y > mh && y <= mh + 2 && Math.abs(x - (qx + ox)) <= 1 && Math.abs(z - (qz + oz)) <= 1) {
              return B.AIR;
            }
          }
        }
      }
    }
    // … then worms + shafts + chambers carve stone AND dirt bands (never
    // bedrock, never the top 2 roof layers)
    if (y >= 4 && y <= h - 2 && carvedAt(x, y, z, this.seed, h)) {
      // stalactites hang from cave ceilings, stalagmites rise from floors —
      // rare single-block stone teeth that make big rooms read as caves.
      // Never inside the stair corridor (checked above) and never sealing a
      // 1-tall gap (need headroom on the opposite side).
      if (y <= h - 4 && y + 1 <= h - 2 && !carvedAt(x, y + 1, z, this.seed, h)) {
        const aboveStone = y + 1 <= terrainHeight(x, z, this.seed) - 4;
        if (aboveStone && hash3(x, y, z, this.seed ^ 0x5a1) > 0.9) return B.STONE;
      }
      if (y >= 5 && y - 1 >= 4 && !carvedAt(x, y - 1, z, this.seed, h) && carvedAt(x, y + 1, z, this.seed, h)) {
        const belowStone = y - 1 <= terrainHeight(x, z, this.seed) - 4;
        if (belowStone && hash3(x, y, z, this.seed ^ 0x5a2) > 0.93) return B.STONE;
      }
      return B.AIR;
    }
    if (y <= h - 4) {
      // ores sprinkled in stone — boosted ~3x on cave walls (halo) so
      // spelunking pays: tunnels sparkle instead of running bare.
      const halo = y >= 4 && y <= h - 2 && caveHalo(x, y, z, this.seed, h);
      const r = hash2(x * 3 + y * 7, z * 5 - y, this.seed ^ 0x0e3);
      // rarest first: iron shares hash r with coal, so it must win ties
      // (a high r would otherwise always return coal first)
      if (y < h - 2) {
        if (halo ? (y <= 14 && r > 0.979) : (r > 0.993 && y <= 14)) return B.IRON_ORE;
      }
      if (halo) {
        if (y <= 22 && r > 0.958) return B.COAL_ORE;
      } else if (y < h - 1 && r > 0.986 && y <= 22) return B.COAL_ORE;
      const r2 = hash2(x * 5 - y * 3, z * 7 + y, this.seed ^ 0x60d);
      if (y < h - 3 && (halo ? (y <= 9 && r2 > 0.989) : (r2 > 0.9965 && y <= 9))) return B.DIAMOND_ORE;
      if (y < h - 2 && (halo ? (y <= 12 && r2 > 0.983) : (r2 > 0.9945 && y <= 12))) return B.GOLD_ORE;
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
