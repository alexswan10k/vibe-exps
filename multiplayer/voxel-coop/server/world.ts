// Authoritative voxel world: seeded terrain gen, block overrides, persistence.
// Coordinates: x,z unbounded, y in [0, WORLD_H).

import { B, CHUNK, WORLD_H, SEA_LEVEL, WALK_THROUGH, encodeRLE } from "./protocol.ts";

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

// Biomes: picked per column from temperature + moisture fields with an
// altitude cooldown (mountains are cold, shores are beaches). Thresholds were
// tuned by census over generated terrain, not by gut feel (see task notes).
export const BIOME = {
  OCEAN: 0, BEACH: 1, DESERT: 2, SAVANNA: 3, PLAINS: 4, FOREST: 5,
  JUNGLE: 6, TAIGA: 7, TUNDRA: 8, SWAMP: 9, MOUNTAIN: 10,
} as const;

export function biomeAt(x: number, z: number, seed: number, hh?: number): number {
  const h = hh ?? terrainHeight(x, z, seed);
  if (h <= SEA_LEVEL - 2) return BIOME.OCEAN; // lake/ocean floor
  if (h <= SEA_LEVEL + 1) return BIOME.BEACH; // shores + shallows
  let temp = vnoise(x * 0.004 + 900, z * 0.004 - 300, seed ^ 0xb10c);
  const moist = vnoise(x * 0.005 - 700, z * 0.005 + 200, seed ^ 0xb20e);
  temp -= Math.max(0, h - 18) * 0.012; // altitude cools
  if (h >= 27) return BIOME.TUNDRA; // snowcaps (surface is snow anyway)
  if (h >= 23) return BIOME.MOUNTAIN; // high exposed rock
  if (temp > 0.60 && moist < 0.42) return BIOME.DESERT;
  if (temp > 0.56 && moist < 0.52) return BIOME.SAVANNA;
  if (moist > 0.58 && temp > 0.50) return BIOME.JUNGLE;
  if (moist > 0.57 && h <= SEA_LEVEL + 4) return BIOME.SWAMP;
  if (temp < 0.30) return BIOME.TUNDRA; // cold barrens
  if (temp < 0.40) return BIOME.TAIGA;
  if (moist > 0.50) return BIOME.FOREST;
  return BIOME.PLAINS;
}

// Tree kinds: 0 = none, 1 = oak, 2 = pine (taiga spire), 3 = jungle giant.
export function treeTypeAt(x: number, z: number, seed: number): number {
  const h = terrainHeight(x, z, seed);
  if (h <= SEA_LEVEL + 1 || h >= 26) return 0;
  const bio = biomeAt(x, z, seed);
  let dens: number;
  switch (bio) {
    case BIOME.DESERT:
    case BIOME.BEACH:
    case BIOME.TUNDRA:
    case BIOME.MOUNTAIN:
    case BIOME.OCEAN:
      return 0;
    case BIOME.SAVANNA: dens = 0.97; break;
    case BIOME.PLAINS: dens = 0.988; break;
    case BIOME.FOREST: dens = 0.87; break;
    case BIOME.JUNGLE: dens = 0.82; break;
    case BIOME.TAIGA: dens = 0.89; break;
    case BIOME.SWAMP: dens = 0.95; break;
    default: dens = 0.99;
  }
  if (hash2(x, z, seed ^ 0x51ab) <= dens) return 0;
  if (bio === BIOME.TAIGA) return 2;
  if (bio === BIOME.JUNGLE) return 3;
  return 1;
}

export function treeAt(x: number, z: number, seed: number): boolean {
  return treeTypeAt(x, z, seed) !== 0;
}

// Small ground vegetation for a surface column (GRASS/DIRT only, y == h+1).
// Returns a block id or B.AIR. Frequencies are per-column keep rates.
function plantAt(x: number, z: number, bio: number, seed: number): number {
  const r1 = hash2(x, z, seed ^ 0xf011);
  const r2 = hash2(x * 7 + 3, z * 7 - 1, seed ^ 0xf022);
  switch (bio) {
    case BIOME.SAVANNA:
      if (r1 > 0.62) return B.TALL_GRASS;
      break;
    case BIOME.PLAINS:
      if (r1 > 0.78) return B.TALL_GRASS;
      if (r1 < 0.03) return r2 < 0.5 ? B.FLOWER_RED : B.FLOWER_YELLOW;
      break;
    case BIOME.FOREST:
      if (r1 > 0.88) return B.TALL_GRASS;
      if (r1 < 0.02) return r2 < 0.5 ? B.MUSHROOM_RED : B.MUSHROOM_BROWN;
      break;
    case BIOME.JUNGLE:
      if (r1 > 0.70) return B.TALL_GRASS;
      if (r1 < 0.03) return r2 < 0.5 ? B.MUSHROOM_RED : B.MUSHROOM_BROWN;
      break;
    case BIOME.TAIGA:
      if (r1 > 0.92) return B.TALL_GRASS;
      break;
    case BIOME.SWAMP:
      if (r1 > 0.85) return B.TALL_GRASS;
      if (r1 < 0.04) return r2 < 0.5 ? B.MUSHROOM_RED : B.MUSHROOM_BROWN;
      break;
    default:
      break;
  }
  return B.AIR;
}

// Desert cactus column height (0 = no cactus here).
function cactusHeightAt(x: number, z: number, seed: number): number {
  const r = hash2(x, z, seed ^ 0xcac7);
  if (r <= 0.962) return 0;
  return 1 + (hash2(x * 3 + 1, z * 3 - 2, seed ^ 0xcac8) > 0.5 ? 1 : 0) +
    (hash2(x * 5 - 1, z * 5 + 4, seed ^ 0xcac9) > 0.8 ? 1 : 0);
}

// Reed (sugar-cane) column height, for wet shores. 0 = none.
function reedHeightAt(x: number, z: number, h: number, seed: number): number {
  if (h < SEA_LEVEL || h > SEA_LEVEL + 2) return 0;
  // needs water next door: lowest neighbouring column at/below sea level
  let shore = false;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    if (terrainHeight(x + dx, z + dz, seed) <= SEA_LEVEL) { shore = true; break; }
  }
  if (!shore) return 0;
  const bio = biomeAt(x, z, seed);
  const thresh = bio === BIOME.SWAMP ? 0.86 : 0.93;
  if (hash2(x, z, seed ^ 0xeeeD) <= thresh) return 0;
  return hash2(x * 3 - 5, z * 3 + 7, seed ^ 0xeeeF) > 0.7 ? 3 : 2;
}

// Blotchy clay/gravel patch mask for shores and lakebeds.
function shorePatchAt(x: number, z: number, seed: number): number {
  if (vnoise(x * 0.09, z * 0.09, seed ^ 0xc14) > 0.62) return B.CLAY;
  if (vnoise(x * 0.11 + 37, z * 0.11 - 91, seed ^ 0x6a4) > 0.64) return B.GRAVEL;
  return 0;
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

interface TreeRoot { dx: number; dz: number; kind: number; th: number; trunkH: number; top: number }
interface ColInfo { h: number; bio: number; trees: TreeRoot[] }

export class World {
  seed: number;
  // per-column memo: height + biome + nearby tree roots. baseBlock hits the
  // same column up to WORLD_H times per chunk, and sky cells would otherwise
  // recompute 25 neighbour terrains each. FIFO-capped (pure fn of x,z,seed).
  private colCache = new Map<string, ColInfo>();
  colInfo(x: number, z: number): ColInfo {
    const k = x + "," + z;
    const hit = this.colCache.get(k);
    if (hit) return hit;
    if (this.colCache.size > 4096) {
      const first = this.colCache.keys().next().value;
      if (first !== undefined) this.colCache.delete(first);
    }
    const h = terrainHeight(x, z, this.seed);
    const bio = biomeAt(x, z, this.seed, h);
    const trees: TreeRoot[] = [];
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const tx = x - dx, tz = z - dz;
        const kind = treeTypeAt(tx, tz, this.seed);
        if (kind === 0) continue;
        const th = terrainHeight(tx, tz, this.seed);
        if (th <= SEA_LEVEL + 1 || th >= 28) continue;
        const trunkH = kind === 3 ? 6 + Math.floor(hash2(tx, tz, this.seed ^ 0x77) * 2)
          : kind === 2 ? 5 + Math.floor(hash2(tx, tz, this.seed ^ 0x77) * 2)
          : 4 + Math.floor(hash2(tx, tz, this.seed ^ 0x77) * 2);
        trees.push({ dx, dz, kind, th, trunkH, top: th + trunkH });
      }
    }
    const c: ColInfo = { h, bio, trees };
    this.colCache.set(k, c);
    return c;
  }
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

  /** Wipe all player edits and reseed: a brand-new world on the same server. */
  resetWorld(seed: number): void {
    this.seed = seed;
    this.overrides.clear();
    this.colCache.clear();
    this.time = 0.25;
    this.saveTimer = 0;
    void this.save();
  }

  // Base terrain block (before overrides). Returns B.* id.
  baseBlock(x: number, y: number, z: number): number {
    if (y < 0 || y >= WORLD_H) return B.AIR;
    if (y === 0) return B.BEDROCK;
    if (y === 1 && hash3(x, y, z, this.seed) < 0.5) return B.BEDROCK; // rough floor, no void peeks
    const { h, bio } = this.colInfo(x, z);
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
      // emerald ore: mountain-only (MOUNTAIN + TUNDRA snowcaps), y<=28 — own
      // hash r3 so it never ties with gold/diamond on r2. Non-halo ~0.3%
      // (scarcer than gold's 0.55%, diamond-adjacent), halo ~1.0%.
      if (y < h - 2 && y <= 28 && (bio === BIOME.MOUNTAIN || bio === BIOME.TUNDRA)) {
        const r3 = hash2(x * 7 - y * 5, z * 3 + y * 11, this.seed ^ 0xe9a1);
        if (halo ? r3 > 0.99 : r3 > 0.997) return B.EMERALD_ORE;
      }
      // lava pools: deep stone only, y 2..8 (never the bedrock floor at y<=1).
      // White-noise ~3% of deep cells; neighbours co-trigger into 2-4 block pools.
      if (y >= 2 && y <= 8 && hash3(x, y, z, this.seed ^ 0x1a6a) > 0.97) return B.LAVA;
      // obsidian crust near the floor: blast-proof building prize for deep miners
      if (y <= 5 && hash3(x, y, z, this.seed ^ 0xb51) > 0.86) return B.OBSIDIAN;
      return B.STONE;
    }
    // dirt band + surface are biome-driven (stone zone above is untouched)
    if (y < h) {
      if (bio === BIOME.DESERT) {
        if (y === h - 1) return B.SAND;
        return B.SANDSTONE; // dunes sit on rock, not dirt
      }
      if (bio === BIOME.BEACH || bio === BIOME.OCEAN) {
        if (y >= h - 2) return B.SAND;
        return B.DIRT;
      }
      if (bio === BIOME.MOUNTAIN || bio === BIOME.TUNDRA) {
        if (hash3(x, y, z, this.seed ^ 0x9a4) > 0.55) return B.GRAVEL;
        return B.DIRT;
      }
      return B.DIRT;
    }
    if (y === h) {
      if (bio === BIOME.OCEAN || bio === BIOME.BEACH) {
        const patch = shorePatchAt(x, z, this.seed);
        if (patch) return patch;
        return B.SAND;
      }
      if (bio === BIOME.DESERT) return B.SAND;
      if (bio === BIOME.MOUNTAIN) {
        // exposed rock on steeps, gravel aprons elsewhere
        const slope = Math.max(
          Math.abs(terrainHeight(x + 1, z, this.seed) - h),
          Math.abs(terrainHeight(x - 1, z, this.seed) - h),
          Math.abs(terrainHeight(x, z + 1, this.seed) - h),
          Math.abs(terrainHeight(x, z - 1, this.seed) - h),
        );
        if (slope >= 3) return B.STONE;
        return hash2(x, z, this.seed ^ 0x90c4) > 0.45 ? B.GRAVEL : B.STONE;
      }
      if (h >= 27 || bio === BIOME.TUNDRA) return B.SNOW;
      if (bio === BIOME.TAIGA) {
        if (vnoise(x * 0.07 + 11, z * 0.07 - 43, this.seed ^ 0x7a16) > 0.58) return B.SNOW;
        return B.GRASS;
      }
      if (bio === BIOME.SWAMP) {
        if (h <= SEA_LEVEL + 2) {
          const patch = shorePatchAt(x, z, this.seed);
          if (patch) return patch;
        }
        if (vnoise(x * 0.08 - 17, z * 0.08 + 29, this.seed ^ 0x5a4) < 0.45) return B.DIRT;
        return B.GRASS;
      }
      return B.GRASS;
    }
    // above surface
    if (y <= SEA_LEVEL) return B.WATER;
    // desert cacti: 1-3 tall soldiers on the sand
    if (bio === BIOME.DESERT && y <= h + 3) {
      const ch = cactusHeightAt(x, z, this.seed);
      if (ch > 0 && y <= h + ch && this.baseBlock(x, h, z) === B.SAND) return B.CACTUS;
    }
    // reeds on wet shores (beach + swamp), 2-3 tall
    if (y <= h + 3) {
      const rh = reedHeightAt(x, z, h, this.seed);
      if (rh > 0 && y <= h + rh) return B.REEDS;
    }
    // ground phrases: flowers, tufts, mushrooms on grass/dirt only
    if (y === h + 1) {
      const surf = this.baseBlock(x, h, z);
      if (surf === B.GRASS || surf === B.DIRT) {
        const pl = plantAt(x, z, bio, this.seed);
        if (pl !== B.AIR) return pl;
      }
    }
    // cached nearby tree roots (computed once per column in colInfo)
    for (const root of this.colInfo(x, z).trees) {
      {
        const { dx, dz, kind, th, top } = root;
        const log = kind === 2 ? B.PINE_LOG : B.LOG;
        const leaf = kind === 2 ? B.PINE_LEAVES : B.LEAVES;
        if (dx === 0 && dz === 0 && y > th && y <= top) return log;
        // canopies: oak = broad hat, pine = narrow spire, jungle = big table
        const dy = y - top;
        const adx = Math.abs(dx), adz = Math.abs(dz);
        if (kind === 2) {
          if (dy === -3 || dy === -2) {
            if (adx <= 1 && adz <= 1 && !(adx === 1 && adz === 1)) return leaf;
          } else if (dy === -1) {
            if (adx + adz <= 1 && !(adx === 0 && adz === 0)) return leaf;
          } else if (dy === 0) {
            if (adx + adz === 1) return leaf;
          } else if (dy === 1) {
            if (adx === 0 && adz === 0) return leaf;
          }
        } else if (kind === 3) {
          if (dy === -3 || dy === -2) {
            if (adx <= 2 && adz <= 2 && !(adx === 2 && adz === 2)) return leaf;
          } else if (dy === -1) {
            if (adx <= 2 && adz <= 2 && !(adx === 2 && adz === 2)) return leaf;
          } else if (dy === 0) {
            if (adx + adz <= 2 && !(adx === 0 && adz === 0)) return leaf;
          } else if (dy === 1) {
            if (adx + adz <= 1) return leaf;
          }
        } else {
          if (dy === -2 || dy === -1) {
            if (adx <= 2 && adz <= 2 && !(adx === 2 && adz === 2)) return leaf;
          } else if (dy === 0) {
            if (adx + adz <= 2 && !(adx === 0 && adz === 0)) return leaf;
          } else if (dy === 1) {
            if (adx + adz <= 1) return leaf;
          }
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
    // ladders are climb-through, small plants are walk-through, lava is
    // waded through (damage is handled elsewhere) — never solid footing.
    // groundHeight() builds on isSolid, so lava lakes are skipped there too
    // and mobs won't path onto them as surfaces.
    return b !== B.AIR && b !== B.WATER && b !== B.LAVA && b !== B.LADDER && !WALK_THROUGH.has(b);
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

  /** True if any player edit exists within `r` of a cell (mines, builds). */
  hasEditNear(x: number, y: number, z: number, r: number): boolean {
    for (const k of this.overrides.keys()) {
      const [ox, oy, oz] = k.split(",").map(Number);
      if (Math.abs(ox - x) <= r && Math.abs(oy - y) <= r && Math.abs(oz - z) <= r) return true;
    }
    return false;
  }

  /** True if a saved logout spot should be abandoned for fresh spawn:
   *  entombed solid (stale seed, filled in), or deep below the terrain in a
   *  natural pocket — logged out in a cave, not in a player-dug base.
   *  Sleeping under a tree or in your mine keeps its spot. */
  shouldRescueToSurface(x: number, y: number, z: number): boolean {
    const xi = Math.floor(x), yf = Math.floor(y), zi = Math.floor(z);
    if (this.isSolid(xi, yf, zi) && this.isSolid(xi, yf + 1, zi)) return true; // buried
    if (yf >= terrainHeight(xi, zi, this.seed) - 1) return false; // on/above surface
    return !this.hasEditNear(xi, yf, zi, 6); // cave, not a base
  }

  findSpawn(): [number, number, number] {
    // two passes: grassland first (never a desert/cactus start), sand as fallback.
    // A spawn must be open-air surface: solid cave-free footing (no stair
    // shaft roof that collapses into the cave system), no walk-in entrance
    // within a few blocks (no waking up inside/on a hole), clear headroom.
    for (const want of [B.GRASS, B.SAND] as const) {
      for (let r = 0; r < 1200; r += 8) {
        const x = r === 0 ? 0.5 : Math.floor(hash2(r, 7, this.seed) * r * 2 - r) + 0.5;
        const z = r === 0 ? 0.5 : Math.floor(hash2(r, 13, this.seed) * r * 2 - r) + 0.5;
        const xi = Math.floor(x), zi = Math.floor(z);
        const h = terrainHeight(xi, zi, this.seed);
        if (h <= SEA_LEVEL + 1 || h >= 26) continue;
        const top = this.get(xi, h, zi);
        if (top !== want) continue;
        if (want === B.SAND && biomeAt(xi, zi, this.seed) === BIOME.DESERT) continue;
        // footing: no cave carve or stair shaft in the top 5 layers — the
        // floor you wake up on must not be a 1-thick roof over a tunnel
        let solid = true;
        for (let y = h - 4; y <= h; y++) {
          if (carvedAt(xi, y, zi, this.seed, h) || stairCell(xi, y, zi, this.seed) === 1) {
            solid = false;
            break;
          }
        }
        if (!solid) continue;
        // clear headroom: no trunks/leaves (or player builds) above.
        // walk-through plants don't block a spawn.
        let clear = true;
        for (let y = h + 1; y <= h + 7; y++) {
          const b = this.get(xi, y, zi);
          if (b !== B.AIR && !WALK_THROUGH.has(b)) { clear = false; break; }
        }
        if (!clear) continue;
        // no staircase or entrance mouth next door (checked last: costliest)
        let lonely = true;
        for (let dx = -2; dx <= 2 && lonely; dx++) {
          for (let dz = -2; dz <= 2 && lonely; dz++) {
            for (let y = h - 2; y <= h + 2; y++) {
              if (stairCell(xi + dx, y, zi + dz, this.seed) === 1) { lonely = false; break; }
            }
          }
        }
        for (let dx = -3; dx <= 3 && lonely; dx++) {
          for (let dz = -3; dz <= 3 && lonely; dz++) {
            if (mouthOriginAt(xi + dx, zi + dz, this.seed) >= 0) lonely = false;
          }
        }
        if (!lonely) continue;
        return [xi + 0.5, h + 2.5, zi + 0.5];
      }
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
