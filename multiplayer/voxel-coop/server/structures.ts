// Structures worldgen: village sites (surface) + underground dungeons.
//
// PURE + deterministic: every layout derives from integer hashes of (seed,x,z).
// No Math.random anywhere; same seed -> same structures.
//
// BLOCK-ID NOTES (protocol.ts): B.CHEST (43) exists with machine inventories,
// so dungeons and the new scatter/landmark structures get REAL loot chests
// (filled deterministically by main.ts via structureChests/lootFor). There is
// still NO crop block, so farm "crops" stay tall-grass / flower decor.
// Symbolic B.* / I.* names are used throughout.
//
// TERRAIN MIRROR: hash2/smooth/vnoise/terrainHeight/biomeAt below are verbatim
// copies of the world.ts formulas. They are duplicated (not imported) to avoid
// a world<->structures module cycle: world.ts imports the overlay fns from
// here. If world.ts terrain ever changes, update the mirror to match.

import { B, I, SEA_LEVEL, WORLD_H } from "./protocol.ts";
import type { World } from "./world.ts";

// ---------- terrain mirror (must match world.ts) ----------

function hash2(x: number, z: number, seed: number): number {
  let h = seed | 0;
  h = Math.imul(h ^ Math.imul(x | 0, 374761393), 668265263) ^ Math.imul(z | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

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

function terrainHeight(x: number, z: number, seed: number): number {
  const cont = vnoise(x * 0.008, z * 0.008, seed);
  const hills = vnoise(x * 0.035 + 100, z * 0.035 - 100, seed ^ 0x111);
  const det = vnoise(x * 0.15, z * 0.15, seed ^ 0x222);
  let h = 8 + cont * 24 + (hills - 0.5) * 10 + (det - 0.5) * 3;
  if (cont > 0.62) h += (cont - 0.62) * 40;
  return Math.max(2, Math.min(WORLD_H - 14, Math.floor(h)));
}

const BIOME = {
  OCEAN: 0, BEACH: 1, DESERT: 2, SAVANNA: 3, PLAINS: 4, FOREST: 5,
  JUNGLE: 6, TAIGA: 7, TUNDRA: 8, SWAMP: 9, MOUNTAIN: 10,
} as const;

function biomeAt(x: number, z: number, seed: number, hh?: number): number {
  const h = hh ?? terrainHeight(x, z, seed);
  if (h <= SEA_LEVEL - 2) return BIOME.OCEAN;
  if (h <= SEA_LEVEL + 1) return BIOME.BEACH;
  let temp = vnoise(x * 0.004 + 900, z * 0.004 - 300, seed ^ 0xb10c);
  const moist = vnoise(x * 0.005 - 700, z * 0.005 + 200, seed ^ 0xb20e);
  temp -= Math.max(0, h - 18) * 0.012;
  if (h >= 27) return BIOME.TUNDRA;
  if (h >= 23) return BIOME.MOUNTAIN;
  if (temp > 0.60 && moist < 0.42) return BIOME.DESERT;
  if (temp > 0.56 && moist < 0.52) return BIOME.SAVANNA;
  if (moist > 0.58 && temp > 0.50) return BIOME.JUNGLE;
  if (moist > 0.57 && h <= SEA_LEVEL + 4) return BIOME.SWAMP;
  if (temp < 0.30) return BIOME.TUNDRA;
  if (temp < 0.40) return BIOME.TAIGA;
  if (moist > 0.50) return BIOME.FOREST;
  return BIOME.PLAINS;
}

// ---------- villages ----------

export interface VillageCenter { x: number; z: number }

interface House {
  hx: number; hz: number; fy: number;
  door: number; // 0=N(-z) 1=E(+x) 2=S(+z) 3=W(-x)
  doorOff: number; // -1..1 lateral offset of the door on its side
  hasBed: boolean; hasTable: boolean;
}

interface PathSeg { x1: number; z1: number; x2: number; z2: number }

interface Village {
  cx: number; cz: number;
  houses: House[];
  well: { x: number; z: number };
  farm: { x: number; z: number; w: number; d: number };
  paths: PathSeg[];
  minX: number; maxX: number; minZ: number; maxZ: number;
  topY: number;
}

const VIL_CELL = 224; // candidate lattice spacing (world is unbounded; villages cluster near origin where players spawn)
const VIL_WANT = 5;

// numeric salts (all plain int32 literals — deterministic, no randomness)
const S_VIL_ORDER = 0x71a1;
const S_VIL_JITTER = 0x71a2;
const S_VIL_HOUSE = 0x71a3;
const S_VIL_FARM = 0x71a4;
const S_VIL_CROP = 0x71a5;

function slopeAt(x: number, z: number, seed: number, h: number): number {
  return Math.max(
    Math.abs(terrainHeight(x + 6, z, seed) - h),
    Math.abs(terrainHeight(x - 6, z, seed) - h),
    Math.abs(terrainHeight(x, z + 6, seed) - h),
    Math.abs(terrainHeight(x, z - 6, seed) - h),
  );
}

function villageSiteScore(x: number, z: number, seed: number): number {
  // pass level that accepts this site: 1 = strict (plains-ish, flat),
  // 2 = relaxed (any dry land), 3 = desperate (anything not water). -1 = reject.
  const h = terrainHeight(x, z, seed);
  if (h <= SEA_LEVEL + 1) return -1;
  const slope = slopeAt(x, z, seed, h);
  const bio = biomeAt(x, z, seed, h);
  const plainsish = bio === BIOME.PLAINS || bio === BIOME.SAVANNA ||
    bio === BIOME.FOREST || bio === BIOME.TAIGA;
  if (plainsish && h >= SEA_LEVEL + 2 && h <= 24 && slope <= 2) return 1;
  if (h >= SEA_LEVEL + 2 && h <= 26 && slope <= 3) return 2;
  if (slope <= 5) return 3;
  return -1;
}

function doorCell(h: House): { x: number; z: number } {
  switch (h.door) {
    case 0: return { x: h.hx + h.doorOff, z: h.hz - 2 };
    case 1: return { x: h.hx + 2, z: h.hz + h.doorOff };
    case 2: return { x: h.hx + h.doorOff, z: h.hz + 2 };
    default: return { x: h.hx - 2, z: h.hz + h.doorOff };
  }
}

function buildVillageLayout(cx: number, cz: number, seed: number): Village {
  const nH = 3 + Math.floor(hash2(cx, cz, seed ^ S_VIL_HOUSE) * 3); // 3..5 houses
  const houses: House[] = [];
  for (let i = 0; i < nH; i++) {
    const ang = hash2(cx + i * 31, cz - i * 17, seed ^ S_VIL_HOUSE) * Math.PI * 2 +
      (i * Math.PI * 2) / nH;
    const dist = 10 + hash2(cx - i * 13, cz + i * 29, seed ^ (S_VIL_HOUSE + 1)) * 4; // 10..14
    const hx = Math.round(cx + Math.cos(ang) * dist);
    const hz = Math.round(cz + Math.sin(ang) * dist);
    let fy = -Infinity;
    for (let ox = -2; ox <= 2; ox++) {
      for (let oz = -2; oz <= 2; oz++) {
        const hh = terrainHeight(hx + ox, hz + oz, seed);
        if (hh > fy) fy = hh;
      }
    }
    houses.push({
      hx, hz, fy,
      door: Math.floor(hash2(hx, hz, seed ^ (S_VIL_HOUSE + 2)) * 4) % 4,
      doorOff: Math.floor(hash2(hx * 3 + 1, hz * 3 - 1, seed ^ (S_VIL_HOUSE + 3)) * 3) - 1,
      hasBed: hash2(hx * 5 - 2, hz * 5 + 3, seed ^ (S_VIL_HOUSE + 4)) > 0.4,
      hasTable: hash2(hx * 7 + 4, hz * 7 - 3, seed ^ (S_VIL_HOUSE + 5)) > 0.5,
    });
  }
  // well and farm on opposite-ish hashed offsets (7..11 out, stays in bbox)
  const wa = hash2(cx + 101, cz - 103, seed ^ S_VIL_FARM) * Math.PI * 2;
  const well = {
    x: Math.round(cx + Math.cos(wa) * 9),
    z: Math.round(cz + Math.sin(wa) * 9),
  };
  const fa = wa + Math.PI + (hash2(cx - 107, cz + 109, seed ^ S_VIL_FARM) - 0.5);
  const farm = {
    x: Math.round(cx + Math.cos(fa) * 9) - 3,
    z: Math.round(cz + Math.sin(fa) * 9) - 2,
    w: 6, d: 4,
  };
  // L-shaped 1-wide gravel paths: plaza -> each house door, well, farm.
  const paths: PathSeg[] = [];
  const addPath = (tx: number, tz: number) => {
    paths.push({ x1: Math.min(cx, tx), z1: cz, x2: Math.max(cx, tx), z2: cz });
    paths.push({ x1: tx, z1: Math.min(cz, tz), x2: tx, z2: Math.max(cz, tz) });
  };
  for (const h of houses) {
    const d = doorCell(h);
    addPath(d.x, d.z);
  }
  addPath(well.x, well.z);
  addPath(farm.x + 3, farm.z + 2);
  let topY = 0;
  for (const h of houses) topY = Math.max(topY, h.fy + 3);
  topY = Math.max(topY, terrainHeight(cx, cz, seed) + 3); // lamp post
  return {
    cx, cz, houses, well, farm, paths,
    minX: cx - 20, maxX: cx + 20, minZ: cz - 20, maxZ: cz + 20,
    topY: Math.min(topY + 1, WORLD_H - 1),
  };
}

const villageCache = new Map<number, Village[]>();

function getVillages(seed: number): Village[] {
  const hit = villageCache.get(seed);
  if (hit) return hit;
  // deterministic candidate order: 5x5 lattice cells around origin, sorted by hash
  const cells: { gx: number; gz: number; ord: number }[] = [];
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      if (gx === 0 && gz === 0) continue; // keep spawn clearing free
      cells.push({ gx, gz, ord: hash2(gx, gz, seed ^ S_VIL_ORDER) });
    }
  }
  cells.sort((a, b) => a.ord - b.ord);
  const picked: Village[] = [];
  for (let pass = 1; pass <= 3 && picked.length < VIL_WANT; pass++) {
    for (const c of cells) {
      if (picked.length >= VIL_WANT) break;
      const px = c.gx * VIL_CELL +
        Math.floor((hash2(c.gx, c.gz, seed ^ S_VIL_JITTER) - 0.5) * 160);
      const pz = c.gz * VIL_CELL +
        Math.floor((hash2(c.gz, c.gx, seed ^ (S_VIL_JITTER + 1)) - 0.5) * 160);
      if (villageSiteScore(px, pz, seed) === pass) {
        picked.push(buildVillageLayout(px, pz, seed));
      }
    }
  }
  // paranoia fallback (nearly unreachable): pad with best-effort sites so the
  // count never drops below 3, still fully deterministic.
  for (const c of cells) {
    if (picked.length >= 3) break;
    if (picked.some((v) => Math.abs(v.cx - c.gx * VIL_CELL) < VIL_CELL)) continue;
    const px = c.gx * VIL_CELL, pz = c.gz * VIL_CELL;
    if (terrainHeight(px, pz, seed) > SEA_LEVEL + 1) {
      picked.push(buildVillageLayout(px, pz, seed));
    }
  }
  if (villageCache.size > 8) {
    const first = villageCache.keys().next().value;
    if (first !== undefined) villageCache.delete(first);
  }
  villageCache.set(seed, picked);
  return picked;
}

/** Handful (3-6) of village sites for this seed, spread across the map. */
export function villageCenters(seed: number): VillageCenter[] {
  return getVillages(seed).map((v) => ({ x: v.cx, z: v.cz }));
}

// Stamp rule shared by buildVillage/buildDungeon: on a fresh world get() can
// only differ from the overlay block when a cave/stair/porch carve won (AIR)
// or a stalactite tooth won (STONE, dungeon shell only). Both win over
// structures in baseBlock, so stamping must leave those cells alone.
function stampWins(cur: number, b: number): boolean {
  if (b !== B.AIR && cur === B.AIR) return false;
  if (b !== B.STONE && cur === B.STONE) return false;
  return true;
}

function onSeg(s: PathSeg, x: number, z: number): boolean {
  return x >= s.x1 && x <= s.x2 && z >= s.z1 && z <= s.z2;
}

/**
 * Village overlay block for (x,y,z), or undefined when no structure covers it.
 * Only ever returns blocks at/above the column surface (y >= surfaceH) —
 * terrain below the surface is never touched. Takes surfaceH from the caller
 * (world.ts colInfo) so the height isn't recomputed.
 */
export function villageBlockAt(
  x: number, y: number, z: number, seed: number, surfaceH: number,
): number | undefined {
  if (y >= WORLD_H) return undefined;
  if (surfaceH <= SEA_LEVEL + 1) return undefined; // never build on water
  const villages = getVillages(seed);
  for (const v of villages) {
    if (x < v.minX || x > v.maxX || z < v.minZ || z > v.maxZ || y > v.topY) continue;
    // --- houses (5x5, floor fy, walls fy+1..fy+2, roof fy+3) ---
    for (const h of v.houses) {
      const dx = x - h.hx, dz = z - h.hz;
      if (dx < -2 || dx > 2 || dz < -2 || dz > 2) continue;
      const hc = terrainHeight(x, z, seed);
      if (y < hc || hc <= SEA_LEVEL + 1) return undefined;
      const fy = h.fy;
      if (y <= fy) return y === fy ? B.PLANKS : B.COBBLE; // floor + foundation fill (above-surface only)
      if (y === fy + 3) return B.PLANKS; // roof
      if (y !== fy + 1 && y !== fy + 2) return undefined;
      const adx = Math.abs(dx), adz = Math.abs(dz);
      if (adx < 2 && adz < 2) {
        // interior: clear to air, torch center, bed/table in some houses
        if (dx === 0 && dz === 0 && y === fy + 2) return B.TORCH;
        if (y === fy + 1) {
          if (dx === -1 && dz === 0 && h.hasBed) return B.BED;
          if (dx === 1 && dz === 0 && h.hasTable) return B.CRAFT_TABLE;
        }
        return B.AIR;
      }
      // perimeter
      const corner = adx === 2 && adz === 2;
      if (corner) return B.LOG;
      const d = doorCell(h);
      if (x === d.x && z === d.z) return B.AIR; // 1x2 door gap
      const mid = (dx === 0 && adz === 2) || (adz === 0 && adx === 2);
      if (mid) return B.GLASS;
      return B.PLANKS;
    }
    // --- well (3x3 cobble ring + water, fence corner posts) ---
    {
      const dx = x - v.well.x, dz = z - v.well.z;
      if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) {
        const hc = terrainHeight(x, z, seed);
        if (y < hc || hc <= SEA_LEVEL + 1) return undefined;
        if (y === hc) return (dx === 0 && dz === 0) ? B.WATER : B.COBBLE;
        if ((y === hc + 1 || y === hc + 2) && Math.abs(dx) === 1 && Math.abs(dz) === 1) {
          return B.FENCE;
        }
        return undefined;
      }
    }
    // --- farm (6x4 dirt + tall-grass/flower decor; no crop block exists) ---
    {
      const lx = x - v.farm.x, lz = z - v.farm.z;
      if (lx >= 0 && lx < v.farm.w && lz >= 0 && lz < v.farm.d) {
        const hc = terrainHeight(x, z, seed);
        if (y < hc || hc <= SEA_LEVEL + 1) return undefined;
        const cornerF = (lx === 0 || lx === v.farm.w - 1) && (lz === 0 || lz === v.farm.d - 1);
        if (y === hc) return B.DIRT;
        if (y === hc + 1) {
          if (cornerF) return B.FENCE;
          const r = hash2(x, z, seed ^ S_VIL_CROP);
          if (r < 0.12) return B.FLOWER_YELLOW;
          if (r < 0.55) return B.TALL_GRASS;
          return B.AIR;
        }
        return undefined;
      }
    }
    // --- lamp-post plaza (5x5 gravel, fence post + lamp) ---
    {
      const dx = x - v.cx, dz = z - v.cz;
      if (Math.abs(dx) <= 2 && Math.abs(dz) <= 2) {
        const hc = terrainHeight(x, z, seed);
        if (y < hc || hc <= SEA_LEVEL + 1) return undefined;
        if (dx === 0 && dz === 0) {
          if (y === hc + 1 || y === hc + 2) return B.FENCE;
          if (y === hc + 3) return B.LAMP;
        }
        if (y === hc) return B.GRAVEL;
        return undefined;
      }
    }
    // --- paths (1-wide gravel, surface only) ---
    if (y === surfaceH) {
      for (const s of v.paths) {
        if (onSeg(s, x, z)) return B.GRAVEL;
      }
    }
    return undefined;
  }
  return undefined;
}

/**
 * Imperative stamp of one village (same layout the overlay produces).
 * With the world.ts overlay hooked up this is a no-op: cells where the base
 * terrain already yields the structure block are dropped by World.set, and
 * cells where a cave/staircase carve won (base AIR) are skipped so stamping
 * never plugs tunnels or stair shafts. Useful for tests and for stamping
 * without the hook.
 */
export function buildVillage(world: World, seed: number, cx: number, cz: number): void {
  const v = getVillages(seed).find((vv) => vv.cx === cx && vv.cz === cz);
  if (!v) return;
  for (let x = v.minX; x <= v.maxX; x++) {
    for (let z = v.minZ; z <= v.maxZ; z++) {
      const h = terrainHeight(x, z, seed);
      for (let y = Math.max(h, 1); y <= v.topY && y < WORLD_H; y++) {
        const b = villageBlockAt(x, y, z, seed, h);
        if (b === undefined) continue;
        if (!stampWins(world.get(x, y, z), b)) continue; // carve won — leave the hole
        world.set(x, y, z, b);
      }
    }
  }
}

// ---------- dungeons ----------

export interface DungeonSpawn { x: number; y: number; z: number }

interface Dungeon {
  rx: number; rz: number;
  dx: number; dz: number; // interior origin (5x5x3 room: dx..dx+4, dz..dz+4)
  floorY: number; // interior floor level (air floorY..floorY+2)
  second: boolean;
}

const DUN_REGION = 64; // 1 dungeon per 4x4-chunk region (hashed gate)
const S_DUN = 0xd9e5;
const S_DUN_POS = 0xd9e6;
const S_DUN_Y = 0xd9e7;
const S_DUN_WALL = 0xd9e8;

const dungeonCache = new Map<number, Map<string, Dungeon | null>>();

function dungeonForRegion(rx: number, rz: number, seed: number): Dungeon | null {
  let per = dungeonCache.get(seed);
  if (!per) {
    per = new Map();
    if (dungeonCache.size > 8) {
      const first = dungeonCache.keys().next().value;
      if (first !== undefined) dungeonCache.delete(first);
    }
    dungeonCache.set(seed, per);
  }
  const k = rx + "," + rz;
  const hit = per.get(k);
  if (hit !== undefined) return hit;
  let out: Dungeon | null = null;
  if (hash2(rx, rz, seed ^ S_DUN) < 0.30) {
    const dx = rx * DUN_REGION + 8 +
      Math.floor(hash2(rx, rz, seed ^ S_DUN_POS) * 48);
    const dz = rz * DUN_REGION + 8 +
      Math.floor(hash2(rz, rx, seed ^ (S_DUN_POS + 1)) * 48);
    const floorY = 10 + Math.floor(hash2(rx ^ 0x5bd1, rz ^ 0x11fd, seed ^ S_DUN_Y) * 8); // 10..17
    // validate: every shell column must be dry land with 3+ solid above the
    // ceiling (ceiling at floorY+3 needs h >= floorY+7). Lava sits at y<=8 and
    // the shell floor is at floorY-1 >= 9, so lava/obsidian/bedrock can't collide.
    let minH = Infinity;
    for (let ox = -1; ox <= 5 && minH >= floorY + 7; ox++) {
      for (let oz = -1; oz <= 5; oz++) {
        const hh = terrainHeight(dx + ox, dz + oz, seed);
        if (hh < minH) minH = hh;
        if (minH < floorY + 7) break;
      }
    }
    if (minH >= floorY + 7) {
      out = {
        rx, rz, dx, dz, floorY,
        second: hash2(rx * 3 - 5, rz * 3 + 7, seed ^ (S_DUN_Y + 1)) > 0.7,
      };
    }
  }
  per.set(k, out);
  return out;
}

/**
 * Skeleton spawn positions for the MERGE step (no spawner block exists, so
 * mobs must be spawned by main.ts — see report snippet). Scans regions
 * [-6..6]^2 around origin (the settled area); the overlay itself works in
 * every region, unbounded.
 */
export function dungeonSpawns(seed: number): DungeonSpawn[] {
  const out: DungeonSpawn[] = [];
  for (let rx = -6; rx <= 6; rx++) {
    for (let rz = -6; rz <= 6; rz++) {
      const d = dungeonForRegion(rx, rz, seed);
      if (!d) continue;
      out.push({ x: d.dx + 2, y: d.floorY + 1, z: d.dz + 2 });
      if (d.second) out.push({ x: d.dx + 1, y: d.floorY + 1, z: d.dz + 3 });
    }
  }
  return out;
}

/**
 * Dungeon overlay block for (x,y,z), or undefined when no dungeon covers it.
 * Interior 5x3x5 air, 1-thick shell (cobble floor, stone-brick walls/ceiling),
 * one wall torch, 1-2 furnaces (NO chest block exists in B — loot is skipped,
 * skeletons spawn via dungeonSpawns). Only replaces deep stone-zone cells, so
 * bedrock/lava/water can never be touched (see y-range + validation).
 */
export function dungeonBlockAt(
  x: number, y: number, z: number, seed: number, _surfaceH: number,
): number | undefined {
  if (y < 9 || y > 21) return undefined; // cheap gate: whole dungeon lives here
  const rx = Math.floor(x / DUN_REGION), rz = Math.floor(z / DUN_REGION);
  // cheap gate: region hash before any terrain work
  if (hash2(rx, rz, seed ^ S_DUN) >= 0.30) return undefined;
  const d = dungeonForRegion(rx, rz, seed);
  if (!d) return undefined;
  const ox = x - d.dx, oz = z - d.dz; // interior 0..4, shell -1..5
  if (ox < -1 || ox > 5 || oz < -1 || oz > 5) return undefined;
  const fy = d.floorY;
  if (y < fy - 1 || y > fy + 3) return undefined;
  const interior = ox >= 0 && ox <= 4 && oz >= 0 && oz <= 4;
  if (interior && y >= fy && y <= fy + 2) {
    // LOOT CHEST: real B.CHEST, filled by main.ts (structureChests/lootFor).
    if (y === fy && ox === 0 && oz === 0) return B.CHEST;
    if (y === fy && ox === 4 && oz === 4) return B.FURNACE;
    return B.AIR;
  }
  if (y === fy - 1) return B.COBBLE; // floor
  if (y === fy + 3) return B.STONE_BRICK; // ceiling (1-thick, 3+ solid above by validation)
  // walls (border ring, mid levels): torch at north-wall center, else brick/cobble mix
  if (ox === 2 && oz === -1 && y === fy + 1) return B.TORCH;
  return hash2(x * 3 + y * 7, z * 5 - y, seed ^ S_DUN_WALL) < 0.3 ? B.COBBLE : B.STONE_BRICK;
}

/** Imperative stamp of one region's dungeon (no-op with the overlay hooked up; same carve-wins rule as buildVillage). */
export function buildDungeon(world: World, seed: number, rx: number, rz: number): void {
  const d = dungeonForRegion(rx, rz, seed);
  if (!d) return;
  for (let x = d.dx - 1; x <= d.dx + 5; x++) {
    for (let z = d.dz - 1; z <= d.dz + 5; z++) {
      for (let y = d.floorY - 1; y <= d.floorY + 3; y++) {
        if (y < 1 || y >= WORLD_H) continue;
        const b = dungeonBlockAt(x, y, z, seed, 0);
        if (b === undefined) continue;
        if (!stampWins(world.get(x, y, z), b)) continue; // carve won — leave it
        world.set(x, y, z, b);
      }
    }
  }
}

// ---------- surface scatter structures (variety pack) ----------
//
// One small structure per ~112-block lattice cell (45% of cells), jittered.
// Kinds: watchtower (open biomes), ruin (any dry land, also the fallback when
// the hashed kind's biome misses), lonely cabin (taiga/forest/plains),
// witch hut (swamp). Pure + deterministic like everything above.

export type ScatKind = "tower" | "ruin" | "cabin" | "hut";

export interface Scatter {
  kind: ScatKind;
  sx: number; sz: number; gy: number;
  r: number; // bbox radius (cells within sx±r, sz±r may hold blocks)
}

export const SCAT_CELL = 112;
const S_SCAT_GATE = 0x5ca0;
const S_SCAT_POS = 0x5ca1;
const S_SCAT_KIND = 0x5ca2;
const S_RUIN_F = 0x5ca3;
const S_RUIN_W = 0x5ca4;
const S_HUT_DECO = 0x5ca5;

/** Anchor position for a lattice cell (no terrain calls — cheap bbox pretest). */
function scatterAnchor(gx: number, gz: number, seed: number): { sx: number; sz: number } {
  const sx = gx * SCAT_CELL +
    Math.floor((hash2(gx, gz, seed ^ S_SCAT_POS) - 0.5) * 64);
  const sz = gz * SCAT_CELL +
    Math.floor((hash2(gz, gx, seed ^ (S_SCAT_POS + 1)) - 0.5) * 64);
  return { sx, sz };
}

function scatterForCell(gx: number, gz: number, seed: number): Scatter | null {
  if (hash2(gx, gz, seed ^ S_SCAT_GATE) >= 0.45) return null;
  const { sx, sz } = scatterAnchor(gx, gz, seed);
  const gy = terrainHeight(sx, sz, seed);
  if (gy <= SEA_LEVEL + 1 || gy >= 27) return null; // dry lowland only
  const bio = biomeAt(sx, sz, seed, gy);
  const want = hash2(sx, sz, seed ^ S_SCAT_KIND);
  let kind: ScatKind = "ruin";
  if (want < 0.30) {
    if (bio === BIOME.PLAINS || bio === BIOME.FOREST || bio === BIOME.SAVANNA) kind = "tower";
  } else if (want < 0.55) {
    kind = "ruin";
  } else if (want < 0.80) {
    if (bio === BIOME.TAIGA || bio === BIOME.FOREST || bio === BIOME.PLAINS) kind = "cabin";
  } else {
    if (bio === BIOME.SWAMP) kind = "hut";
  }
  // keep clear of villages (their bbox is ±20, checked cheaply)
  for (const v of getVillages(seed)) {
    if (Math.abs(sx - v.cx) < 28 && Math.abs(sz - v.cz) < 28) return null;
  }
  return { kind, sx, sz, gy, r: 4 };
}

function towerBlock(lx: number, dy: number, lz: number): number | undefined {
  const ax = Math.abs(lx), az = Math.abs(lz);
  const rim = Math.max(ax, az) === 2;
  // corner legs, ground to platform
  if (ax === 2 && az === 2 && dy >= 0 && dy <= 7) return B.COBBLE;
  // ladder strip up the south face to the platform hole
  if (lx === 2 && lz === 0 && dy >= 1 && dy <= 8) return B.LADDER;
  if (dy === 8 && Math.max(ax, az) <= 2) {
    if (lx === 2 && lz === 0) return B.AIR; // climb-out hole
    return B.PLANKS; // platform
  }
  // railing, with a gap at the ladder hole
  if (dy === 9 && rim) {
    if (lx === 2 && lz === 0) return B.AIR;
    return B.FENCE;
  }
  if (dy === 9) {
    if (lx === -1 && lz === -1) return B.CHEST; // lookout cache
    if (lx === 1 && lz === 1) return B.TORCH;
    return undefined;
  }
  return undefined;
}

function ruinBlock(
  x: number, lx: number, dy: number, lz: number, seed: number,
): number | undefined {
  const m = Math.max(Math.abs(lx), Math.abs(lz));
  if (m > 3) return undefined;
  // cache pad: forced cobble footing with the chest on top (slopes can't bury it)
  if (lx === 2 && lz === 2) {
    if (dy === 0) return B.COBBLE;
    if (dy === 1) return B.CHEST; // half-buried cache
    return undefined;
  }
  // patchy cobble floor
  if (dy === 0 && m <= 2) {
    return hash2(x, x * 3 + lz, seed ^ S_RUIN_F) > 0.45 ? B.COBBLE : undefined;
  }
  // tall corners, broken curtain walls with a south door gap
  if (Math.abs(lx) === 3 && Math.abs(lz) === 3 && dy >= 1 && dy <= 4) return B.COBBLE;
  if (m === 3 && dy >= 1 && dy <= 3) {
    if (lz === 3 && (lx === -1 || lx === 0)) return B.AIR; // door
    const wh = 1 + Math.floor(hash2(x, dy * 9 + lz, seed ^ S_RUIN_W) * 3); // 1..3
    if (dy > wh) return undefined;
    return hash2(x * 5 + dy, lz * 7, seed ^ (S_RUIN_W + 1)) < 0.3 ? B.STONE_BRICK : B.COBBLE;
  }
  if (dy === 1) {
    if (lx === -2 && lz === -2) return B.FURNACE;
  }
  if (lx === 0 && lz === 0 && dy === 2) return B.TORCH; // eerie marker
  return undefined;
}

function cabinBlock(lx: number, dy: number, lz: number): number | undefined {
  const ax = Math.abs(lx), az = Math.abs(lz);
  if (Math.max(ax, az) > 2) return undefined;
  if (dy === 0) return B.PLANKS; // floor
  if (dy === 3) return B.PLANKS; // flat roof
  if (dy !== 1 && dy !== 2) return undefined;
  const rim = Math.max(ax, az) === 2;
  if (!rim) {
    // interior
    if (dy === 1) {
      if (lx === -1 && lz === 0) return B.BED;
      if (lx === 1 && lz === 1) return B.FURNACE;
    }
    if (lx === 0 && lz === 0 && dy === 2) return B.TORCH;
    return B.AIR;
  }
  if (lz === 2 && lx === 0) return B.AIR; // south door gap
  if (dy === 2 && ((ax === 2 && lz === 0) || (az === 2 && lx === 0))) return B.GLASS;
  if (ax === 2 && az === 2) return B.LOG;
  return B.PLANKS;
}

function hutBlock(
  x: number, z: number, lx: number, dy: number, lz: number, seed: number,
): number | undefined {
  const ax = Math.abs(lx), az = Math.abs(lz);
  if (Math.max(ax, az) > 2) return undefined;
  // stilts down into the mire
  if (ax === 2 && az === 2 && dy >= 0 && dy <= 2) return B.LOG;
  // ladder up the south face
  if (lx === 0 && lz === 2 && dy >= 0 && dy <= 3) return B.LADDER;
  if (dy === 3) {
    if (lx === 0 && lz === 2) return B.AIR; // climb-out hole
    return B.PLANKS; // floor
  }
  if (dy === 6) return B.PLANKS; // roof
  if (dy !== 4 && dy !== 5) return undefined;
  const rim = Math.max(ax, az) === 2;
  if (!rim) {
    if (dy === 4) {
      if (lx === -1 && lz === -1) return B.FURNACE;
      if (lx === 1 && lz === 1) return B.CHEST;
      const r = hash2(x, z, seed ^ S_HUT_DECO);
      if ((lx === -1 && lz === 1) || (lx === 1 && lz === -1)) {
        return r < 0.5 ? B.MUSHROOM_RED : B.MUSHROOM_BROWN;
      }
    }
    return B.AIR;
  }
  if (lz === 2 && lx === 0) return B.AIR; // door gap
  if (dy === 5 && ax === 2 && az === 2) return B.LOG;
  return B.PLANKS;
}

/**
 * Scatter-structure overlay block, or undefined when no structure covers it.
 * Surface-only (y >= surfaceH), same contract as villageBlockAt.
 * NOTE: anchors jitter ±32 across cell borders, so lookup scans the 3x3
 * cells around (x,z) — generation (scatterForCell) stays per-cell.
 */
export function scatterBlockAt(
  x: number, y: number, z: number, seed: number, surfaceH: number,
): number | undefined {
  if (y >= WORLD_H || surfaceH <= SEA_LEVEL + 1) return undefined;
  const cgx = Math.floor(x / SCAT_CELL), cgz = Math.floor(z / SCAT_CELL);
  for (let gx = cgx - 1; gx <= cgx + 1; gx++) {
    for (let gz = cgz - 1; gz <= cgz + 1; gz++) {
      // cheap gate: anchor-in-cell means only nearby anchors can cover (x,z)
      const { sx, sz } = scatterAnchor(gx, gz, seed);
      if (Math.abs(x - sx) > 4 || Math.abs(z - sz) > 4) continue;
      const s = scatterForCell(gx, gz, seed);
      if (!s) continue;
      const lx = x - s.sx, lz = z - s.sz;
      if (Math.abs(lx) > s.r || Math.abs(lz) > s.r) continue;
      const hc = terrainHeight(x, z, seed);
      if (y < hc || hc <= SEA_LEVEL + 1) return undefined;
      const dy = y - s.gy;
      if (dy < 0) return undefined;
      switch (s.kind) {
        case "tower": return towerBlock(lx, dy, lz);
        case "ruin": return ruinBlock(x, lx, dy, lz, seed);
        case "cabin": return cabinBlock(lx, dy, lz);
        case "hut": return hutBlock(x, z, lx, dy, lz, seed);
      }
    }
  }
  return undefined;
}

// ---------- biome landmarks (rare, big) ----------
//
// One candidate per ~320-block cell: desert temples (DESERT) and mountain
// shrines (MOUNTAIN/TUNDRA). Tried at up to 4 jittered spots per cell so a
// missing biome doesn't nuke the whole cell deterministically.

export type LandmarkKind = "temple" | "shrine";

export interface Landmark {
  kind: LandmarkKind;
  sx: number; sz: number; gy: number;
  r: number;
}

export const LM_CELL = 320;
const S_LM = 0x1a94;
const S_LM_POS = 0x1a95;

function landmarkCandidates(gx: number, gz: number, seed: number): { sx: number; sz: number }[] {
  const out: { sx: number; sz: number }[] = [];
  for (let i = 0; i < 4; i++) {
    out.push({
      sx: gx * LM_CELL + Math.floor((hash2(gx * 4 + i, gz, seed ^ S_LM_POS) - 0.5) * 240),
      sz: gz * LM_CELL + Math.floor((hash2(gz, gx * 4 + i, seed ^ (S_LM_POS + 1)) - 0.5) * 240),
    });
  }
  return out;
}

function landmarkForCell(gx: number, gz: number, seed: number): Landmark | null {
  if (hash2(gx, gz, seed ^ S_LM) >= 0.8) return null; // 1 in 5 cells
  // kind first: otherwise common mountain/tundra always beats rare desert
  const wantTemple = hash2(gx, gz, seed ^ (S_LM + 7)) < 0.5;
  for (const c of landmarkCandidates(gx, gz, seed)) {
    const gy = terrainHeight(c.sx, c.sz, seed);
    if (gy <= SEA_LEVEL + 1 || gy >= 30) continue;
    const bio = biomeAt(c.sx, c.sz, seed, gy);
    let kind: LandmarkKind | null = null;
    if (wantTemple) {
      if (bio === BIOME.DESERT) kind = "temple";
    } else if (bio === BIOME.MOUNTAIN || bio === BIOME.TUNDRA) kind = "shrine";
    if (!kind) continue;
    // keep clear of villages
    let clash = false;
    for (const v of getVillages(seed)) {
      if (Math.abs(c.sx - v.cx) < 32 && Math.abs(c.sz - v.cz) < 32) { clash = true; break; }
    }
    if (clash) continue;
    return { kind, sx: c.sx, sz: c.sz, gy, r: kind === "temple" ? 5 : 4 };
  }
  return null;
}

function templeBlock(lx: number, dy: number, lz: number): number | undefined {
  const m = Math.max(Math.abs(lx), Math.abs(lz));
  if (m > 4) return undefined;
  const chamber = Math.abs(lx) <= 1 && Math.abs(lz) <= 1;
  const corridor = lx === 0 && lz >= 0 && lz <= 4;
  if (dy === 1 || dy === 2) {
    if (chamber || corridor) {
      if (dy === 1) {
        if ((lx === -1 || lx === 1) && lz === -1) return B.CHEST; // burial goods
      }
      return B.AIR;
    }
  }
  if (dy === 0) {
    if (lx === 0 && lz === 0) return B.TNT; // trapped floor…
    return B.SANDSTONE;
  }
  if (dy === 1 && m <= 3) return B.SANDSTONE;
  if (dy === 2 && m <= 2) return B.SANDSTONE;
  if (dy === 3 && m <= 1) return B.SANDSTONE;
  if (dy === 4 && (lx === 0 || lz === 0) && m <= 1) return B.SANDSTONE; // cap
  // door pillars + beacon
  if ((lx === -1 || lx === 1) && lz === 4 && (dy === 2 || dy === 3)) return B.SANDSTONE;
  if (lx === 0 && lz === 0 && dy === 5) return B.LAMP;
  return undefined;
}

function shrineBlock(lx: number, dy: number, lz: number): number | undefined {
  if (Math.max(Math.abs(lx), Math.abs(lz)) > 3) return undefined;
  if (dy === 0) return lx * lx + lz * lz <= 9 ? B.COBBLE : undefined;
  if (dy < 1 || dy > 5) return undefined;
  const px = Math.abs(lx) === 2, pz = Math.abs(lz) === 2;
  if (px && pz) {
    if (dy <= 4) return B.STONE_BRICK; // pillars
    return B.LAMP;
  }
  if (lx === 0 && lz === 0) {
    if (dy === 1) return B.COBBLE; // pedestal
    if (dy === 2) return B.EMERALD_BLOCK; // relic
    return undefined;
  }
  if (lx === 1 && lz === 0 && dy === 1) return B.CHEST; // offering cache
  return undefined;
}

/** Landmark overlay block (surface-only, same contract as villageBlockAt).
 *  Candidates jitter ±120 across cell borders, so lookup scans 3x3 cells. */
export function landmarkBlockAt(
  x: number, y: number, z: number, seed: number, surfaceH: number,
): number | undefined {
  if (y >= WORLD_H || surfaceH <= SEA_LEVEL + 1) return undefined;
  const cgx = Math.floor(x / LM_CELL), cgz = Math.floor(z / LM_CELL);
  for (let gx = cgx - 1; gx <= cgx + 1; gx++) {
    for (let gz = cgz - 1; gz <= cgz + 1; gz++) {
      // bbox pretest without terrain: candidates are deterministic positions
      let near = false;
      for (const c of landmarkCandidates(gx, gz, seed)) {
        if (Math.abs(x - c.sx) <= 5 && Math.abs(z - c.sz) <= 5) { near = true; break; }
      }
      if (!near) continue;
      const lm = landmarkForCell(gx, gz, seed);
      if (!lm) continue;
      const lx = x - lm.sx, lz = z - lm.sz;
      if (Math.abs(lx) > lm.r || Math.abs(lz) > lm.r) continue;
      const hc = terrainHeight(x, z, seed);
      if (y < hc || hc <= SEA_LEVEL + 1) return undefined;
      const dy = y - lm.gy;
      if (dy < 0) return undefined;
      return lm.kind === "temple" ? templeBlock(lx, dy, lz) : shrineBlock(lx, dy, lz);
    }
  }
  return undefined;
}

/**
 * True when (x,z) is inside a surface-structure footprint (village, scatter
 * or landmark bbox): world.ts suppresses tree roots there so trunks don't
 * grow through roofs. Bbox-only, no terrain calls except the village cache
 * (already built) — cheap enough for the colInfo tree loop.
 */
export function blocksTrees(x: number, z: number, seed: number): boolean {
  for (const v of getVillages(seed)) {
    if (x >= v.minX && x <= v.maxX && z >= v.minZ && z <= v.maxZ) return true;
  }
  {
    const cgx = Math.floor(x / SCAT_CELL), cgz = Math.floor(z / SCAT_CELL);
    for (let gx = cgx - 1; gx <= cgx + 1; gx++) {
      for (let gz = cgz - 1; gz <= cgz + 1; gz++) {
        const { sx, sz } = scatterAnchor(gx, gz, seed);
        if (Math.abs(x - sx) <= 4 && Math.abs(z - sz) <= 4) return true;
      }
    }
  }
  {
    const cgx = Math.floor(x / LM_CELL), cgz = Math.floor(z / LM_CELL);
    for (let gx = cgx - 1; gx <= cgx + 1; gx++) {
      for (let gz = cgz - 1; gz <= cgz + 1; gz++) {
        for (const c of landmarkCandidates(gx, gz, seed)) {
          if (Math.abs(x - c.sx) <= 5 && Math.abs(z - c.sz) <= 5) return true;
        }
      }
    }
  }
  return false;
}

// ---------- structure census (locate + loot) ----------

export interface StructureCenter { x: number; z: number; kind: string }

/** Scatter + landmark centers in the settled area (bounded scan like dungeonSpawns). */
export function structureCenters(seed: number): StructureCenter[] {
  const out: StructureCenter[] = [];
  for (let gx = -7; gx <= 7; gx++) {
    for (let gz = -7; gz <= 7; gz++) {
      const s = scatterForCell(gx, gz, seed);
      if (s) out.push({ x: s.sx, z: s.sz, kind: s.kind });
    }
  }
  for (let gx = -3; gx <= 3; gx++) {
    for (let gz = -3; gz <= 3; gz++) {
      const lm = landmarkForCell(gx, gz, seed);
      if (lm) out.push({ x: lm.sx, z: lm.sz, kind: lm.kind });
    }
  }
  return out;
}

export interface StructureChest { x: number; y: number; z: number; kind: string }

/**
 * Every worldgen loot-chest position in the settled area: dungeon rooms plus
 * all scatter/landmark chests. main.ts fills these deterministically (see
 * lootFor + Machines.claimLoot) at boot and lazily on open.
 */
export function structureChests(seed: number): StructureChest[] {
  const out: StructureChest[] = [];
  for (let rx = -6; rx <= 6; rx++) {
    for (let rz = -6; rz <= 6; rz++) {
      const d = dungeonForRegion(rx, rz, seed);
      if (d) out.push({ x: d.dx, y: d.floorY, z: d.dz, kind: "dungeon" });
    }
  }
  for (let gx = -7; gx <= 7; gx++) {
    for (let gz = -7; gz <= 7; gz++) {
      const s = scatterForCell(gx, gz, seed);
      if (!s) continue;
      if (s.kind === "tower") out.push({ x: s.sx - 1, y: s.gy + 9, z: s.sz - 1, kind: "tower" });
      else if (s.kind === "ruin") out.push({ x: s.sx + 2, y: s.gy + 1, z: s.sz + 2, kind: "ruin" });
      else if (s.kind === "hut") out.push({ x: s.sx + 1, y: s.gy + 4, z: s.sz + 1, kind: "hut" });
    }
  }
  for (let gx = -3; gx <= 3; gx++) {
    for (let gz = -3; gz <= 3; gz++) {
      const lm = landmarkForCell(gx, gz, seed);
      if (!lm) continue;
      if (lm.kind === "temple") {
        out.push({ x: lm.sx - 1, y: lm.gy + 1, z: lm.sz - 1, kind: "temple" });
        out.push({ x: lm.sx + 1, y: lm.gy + 1, z: lm.sz - 1, kind: "temple" });
      } else {
        out.push({ x: lm.sx + 1, y: lm.gy + 1, z: lm.sz, kind: "shrine" });
      }
    }
  }
  return out;
}

// ---------- deterministic loot ----------

export interface LootStack { id: number; n: number }

const S_LOOT = 0x10f7;

function pickN(salt: number, i: number, lo: number, hi: number): number {
  return lo + Math.floor(hash2(salt, i, S_LOOT ^ 0x0dd) * (hi - lo + 1));
}

/**
 * Deterministic chest contents for a worldgen chest kind. salt should derive
 * from the chest position (main.ts hashes x/z) so every chest differs but
 * every server with the same seed deals the same loot.
 */
export function lootFor(kind: string, salt: number): LootStack[] {
  const out: LootStack[] = [];
  const bonus = hash2(salt, 999, S_LOOT);
  switch (kind) {
    case "dungeon":
      out.push({ id: I.IRON_INGOT, n: pickN(salt, 1, 2, 4) });
      out.push({ id: I.COAL, n: pickN(salt, 2, 4, 7) });
      out.push({ id: B.TORCH, n: pickN(salt, 3, 4, 8) });
      out.push({ id: I.APPLE, n: pickN(salt, 4, 2, 3) });
      out.push({ id: I.ARROW, n: pickN(salt, 5, 3, 6) });
      if (bonus > 0.75) out.push({ id: I.DIAMOND, n: 1 });
      else if (bonus > 0.55) out.push({ id: I.IRON_PICK, n: 1 });
      break;
    case "tower":
      out.push({ id: I.ARROW, n: pickN(salt, 1, 4, 8) });
      out.push({ id: I.APPLE, n: pickN(salt, 2, 2, 3) });
      out.push({ id: B.TORCH, n: pickN(salt, 3, 2, 4) });
      if (bonus > 0.7) out.push({ id: I.IRON_SWORD, n: 1 });
      else if (bonus > 0.4) out.push({ id: I.BOW, n: 1 });
      break;
    case "ruin":
      out.push({ id: I.COAL, n: pickN(salt, 1, 2, 5) });
      out.push({ id: I.STICK, n: pickN(salt, 2, 3, 6) });
      out.push({ id: I.APPLE, n: pickN(salt, 3, 1, 2) });
      if (bonus > 0.75) out.push({ id: I.GOLD_INGOT, n: pickN(salt, 4, 1, 2) });
      break;
    case "hut":
      out.push({ id: B.REEDS, n: pickN(salt, 1, 2, 4) });
      out.push({ id: I.APPLE, n: pickN(salt, 2, 1, 3) });
      out.push({ id: I.COAL, n: pickN(salt, 3, 1, 3) });
      if (bonus > 0.8) out.push({ id: I.SLIMEBALL, n: pickN(salt, 4, 1, 2) });
      break;
    case "temple":
      out.push({ id: I.GOLD_INGOT, n: pickN(salt, 1, 1, 2) });
      out.push({ id: B.TORCH, n: pickN(salt, 2, 4, 6) });
      out.push({ id: I.BONE, n: pickN(salt, 3, 1, 3) });
      if (bonus > 0.6) out.push({ id: I.DIAMOND, n: 1 });
      if (hash2(salt, 1000, S_LOOT) > 0.75) out.push({ id: I.IRON_PICK, n: 1 });
      break;
    case "shrine":
      out.push({ id: I.EMERALD, n: pickN(salt, 1, 1, 2) });
      out.push({ id: I.COOKED_PORK, n: pickN(salt, 2, 2, 3) });
      out.push({ id: I.COAL, n: pickN(salt, 3, 2, 4) });
      if (bonus > 0.7) out.push({ id: I.GOLDEN_APPLE, n: 1 });
      break;
    default:
      out.push({ id: I.APPLE, n: 2 });
      break;
  }
  return out;
}
