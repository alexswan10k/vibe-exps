// Shaped crafting recipes. Patterns are 3x3 row-major, 0 = empty.
// Matching trims empty borders (allows translation) and allows mirroring.
import { B, I, InvSlot } from "./protocol.ts";

const L = B.LOG, P = B.PLANKS, C = B.COBBLE, S = I.STICK, K = I.COAL, G = I.IRON_INGOT;
const N = I.GOLD_INGOT, D = I.DIAMOND, W = I.WOOL, A = I.APPLE;

export interface ShapedRecipe {
  id: string;
  name: string;
  needsTable: boolean; // also gated by size (3-wide never fits the 2x2)
  pat: number[]; // length 9
  out: { id: number; n: number };
}

export const SHAPED: ShapedRecipe[] = [
  { id: "planks", name: "Oak Planks ×4", needsTable: false, pat: [L, 0, 0, 0, 0, 0, 0, 0, 0], out: { id: P, n: 4 } },
  { id: "pine_planks", name: "Pine Planks ×4", needsTable: false, pat: [B.PINE_LOG, 0, 0, 0, 0, 0, 0, 0, 0], out: { id: P, n: 4 } },
  { id: "sandstone", name: "Sandstone ×4", needsTable: false, pat: [B.SAND, B.SAND, 0, B.SAND, B.SAND, 0, 0, 0, 0], out: { id: B.SANDSTONE, n: 4 } },
  { id: "reed_sticks", name: "Sticks ×2", needsTable: false, pat: [B.REEDS, 0, 0, 0, 0, 0, 0, 0, 0], out: { id: S, n: 2 } },
  { id: "sticks", name: "Sticks ×4", needsTable: false, pat: [P, 0, 0, P, 0, 0, 0, 0, 0], out: { id: S, n: 4 } },
  { id: "table", name: "Crafting Table", needsTable: false, pat: [P, P, 0, P, P, 0, 0, 0, 0], out: { id: B.CRAFT_TABLE, n: 1 } },
  { id: "torch", name: "Torches ×4", needsTable: false, pat: [K, 0, 0, S, 0, 0, 0, 0, 0], out: { id: B.TORCH, n: 4 } },
  { id: "furnace", name: "Furnace", needsTable: true, pat: [C, C, C, C, 0, C, C, C, C], out: { id: B.FURNACE, n: 1 } },
  { id: "wood_pick", name: "Wooden Pickaxe", needsTable: true, pat: [P, P, P, 0, S, 0, 0, S, 0], out: { id: I.WOOD_PICK, n: 1 } },
  { id: "stone_pick", name: "Stone Pickaxe", needsTable: true, pat: [C, C, C, 0, S, 0, 0, S, 0], out: { id: I.STONE_PICK, n: 1 } },
  { id: "iron_pick", name: "Iron Pickaxe", needsTable: true, pat: [G, G, G, 0, S, 0, 0, S, 0], out: { id: I.IRON_PICK, n: 1 } },
  { id: "wood_sword", name: "Wooden Sword", needsTable: true, pat: [0, P, 0, 0, P, 0, 0, S, 0], out: { id: I.WOOD_SWORD, n: 1 } },
  { id: "stone_sword", name: "Stone Sword", needsTable: true, pat: [0, C, 0, 0, C, 0, 0, S, 0], out: { id: I.STONE_SWORD, n: 1 } },
  { id: "iron_sword", name: "Iron Sword", needsTable: true, pat: [0, G, 0, 0, G, 0, 0, S, 0], out: { id: I.IRON_SWORD, n: 1 } },
  { id: "wood_axe", name: "Wooden Axe", needsTable: true, pat: [P, P, 0, P, S, 0, 0, S, 0], out: { id: I.WOOD_AXE, n: 1 } },
  { id: "stone_axe", name: "Stone Axe", needsTable: true, pat: [C, C, 0, C, S, 0, 0, S, 0], out: { id: I.STONE_AXE, n: 1 } },
  { id: "iron_axe", name: "Iron Axe", needsTable: true, pat: [G, G, 0, G, S, 0, 0, S, 0], out: { id: I.IRON_AXE, n: 1 } },
  { id: "wood_shovel", name: "Wooden Shovel", needsTable: true, pat: [0, P, 0, 0, S, 0, 0, S, 0], out: { id: I.WOOD_SHOVEL, n: 1 } },
  { id: "stone_shovel", name: "Stone Shovel", needsTable: true, pat: [0, C, 0, 0, S, 0, 0, S, 0], out: { id: I.STONE_SHOVEL, n: 1 } },
  { id: "iron_shovel", name: "Iron Shovel", needsTable: true, pat: [0, G, 0, 0, S, 0, 0, S, 0], out: { id: I.IRON_SHOVEL, n: 1 } },
  { id: "gold_pick", name: "Gold Pickaxe", needsTable: true, pat: [N, N, N, 0, S, 0, 0, S, 0], out: { id: I.GOLD_PICK, n: 1 } },
  { id: "diamond_pick", name: "Diamond Pickaxe", needsTable: true, pat: [D, D, D, 0, S, 0, 0, S, 0], out: { id: I.DIAMOND_PICK, n: 1 } },
  { id: "gold_axe", name: "Gold Axe", needsTable: true, pat: [N, N, 0, N, S, 0, 0, S, 0], out: { id: I.GOLD_AXE, n: 1 } },
  { id: "diamond_axe", name: "Diamond Axe", needsTable: true, pat: [D, D, 0, D, S, 0, 0, S, 0], out: { id: I.DIAMOND_AXE, n: 1 } },
  { id: "gold_shovel", name: "Gold Shovel", needsTable: true, pat: [0, N, 0, 0, S, 0, 0, S, 0], out: { id: I.GOLD_SHOVEL, n: 1 } },
  { id: "diamond_shovel", name: "Diamond Shovel", needsTable: true, pat: [0, D, 0, 0, S, 0, 0, S, 0], out: { id: I.DIAMOND_SHOVEL, n: 1 } },
  { id: "gold_sword", name: "Gold Sword", needsTable: true, pat: [0, N, 0, 0, N, 0, 0, S, 0], out: { id: I.GOLD_SWORD, n: 1 } },
  { id: "diamond_sword", name: "Diamond Sword", needsTable: true, pat: [0, D, 0, 0, D, 0, 0, S, 0], out: { id: I.DIAMOND_SWORD, n: 1 } },
  { id: "fence", name: "Fence ×3", needsTable: true, pat: [P, S, P, P, S, P, 0, 0, 0], out: { id: B.FENCE, n: 3 } },
  { id: "stone_brick", name: "Stone Bricks ×4", needsTable: false, pat: [C, C, 0, C, C, 0, 0, 0, 0], out: { id: B.STONE_BRICK, n: 4 } },
  { id: "ladder", name: "Ladder ×3", needsTable: true, pat: [S, 0, S, S, S, S, S, 0, S], out: { id: B.LADDER, n: 3 } },
  { id: "bed", name: "Bed", needsTable: true, pat: [P, P, P, W, W, W, 0, 0, 0], out: { id: B.BED, n: 1 } },
  { id: "golden_apple", name: "Golden Apple", needsTable: true, pat: [N, N, N, N, A, N, N, N, N], out: { id: I.GOLDEN_APPLE, n: 1 } },
];

interface Trimmed { w: number; h: number; cells: number[]; }

function trim(pat: number[]): Trimmed {
  let x0 = 3, y0 = 3, x1 = -1, y1 = -1;
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      if (pat[y * 3 + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
  }
  if (x1 < 0) return { w: 0, h: 0, cells: [] };
  const cells: number[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) cells.push(pat[y * 3 + x]);
  }
  return { w: x1 - x0 + 1, h: y1 - y0 + 1, cells };
}

function mirror(pat: number[]): number[] {
  const out = new Array(9).fill(0);
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) out[y * 3 + (2 - x)] = pat[y * 3 + x];
  }
  return out;
}

const NORM = SHAPED.map((r) => ({ r, a: trim(r.pat), b: trim(mirror(r.pat)) }));

function same(a: Trimmed, b: Trimmed): boolean {
  if (a.w !== b.w || a.h !== b.h) return false;
  return a.cells.every((v, i) => v === b.cells[i]);
}

/** Match a 9-cell grid (ids) against recipes. smallOnly = 2x2 inventory grid. */
export function matchGrid(cells: number[], smallOnly: boolean): ShapedRecipe | null {
  if (smallOnly) {
    // table-only cells occupied -> no match
    for (const i of [2, 5, 6, 7, 8]) if (cells[i]) return null;
  }
  const t = trim(cells);
  if (t.w === 0) return null;
  if (smallOnly && (t.w > 2 || t.h > 2)) return null;
  for (const { r, a, b } of NORM) {
    if (smallOnly && r.needsTable) continue;
    if (same(t, a) || same(t, b)) return r;
  }
  return null;
}

// --- inventory helpers (slots array, id 0 = empty, max stack 64, tools don't stack) ---
export const MAX_STACK = 64;
const UNSTACKABLE: Set<number> = new Set([I.WOOD_PICK, I.STONE_PICK, I.IRON_PICK, I.WOOD_SWORD, I.STONE_SWORD, I.IRON_SWORD, I.WOOD_AXE, I.STONE_AXE, I.IRON_AXE, I.WOOD_SHOVEL, I.STONE_SHOVEL, I.IRON_SHOVEL, I.GOLD_PICK, I.GOLD_SWORD, I.DIAMOND_PICK, I.DIAMOND_SWORD, I.GOLD_AXE, I.DIAMOND_AXE, I.GOLD_SHOVEL, I.DIAMOND_SHOVEL]);

export function isStackable(id: number): boolean {
  return !UNSTACKABLE.has(id);
}

export function countOf(slots: InvSlot[], id: number): number {
  let n = 0;
  for (const s of slots) if (s.id === id) n += s.n;
  return n;
}

export function canAfford(slots: InvSlot[], cost: Record<number, number>): boolean {
  for (const [k, v] of Object.entries(cost)) {
    if (countOf(slots, Number(k)) < v) return false;
  }
  return true;
}

export function removeItems(slots: InvSlot[], cost: Record<number, number>): boolean {
  if (!canAfford(slots, cost)) return false;
  for (const [k, v] of Object.entries(cost)) {
    let need = v;
    const id = Number(k);
    for (const s of slots) {
      if (need <= 0) break;
      if (s.id === id) {
        const take = Math.min(s.n, need);
        s.n -= take;
        need -= take;
        if (s.n <= 0) { s.id = 0; s.n = 0; }
      }
    }
  }
  return true;
}

/** Add items, stacking first then filling empty slots. Returns leftover count. */
export function giveItems(slots: InvSlot[], id: number, n: number): number {
  if (isStackable(id)) {
    for (const s of slots) {
      if (n <= 0) break;
      if (s.id === id && s.n < MAX_STACK) {
        const room = MAX_STACK - s.n;
        const add = Math.min(room, n);
        s.n += add;
        n -= add;
      }
    }
  }
  for (const s of slots) {
    if (n <= 0) break;
    if (s.id === 0) {
      if (isStackable(id)) {
        const add = Math.min(MAX_STACK, n);
        s.id = id; s.n = add; n -= add;
      } else {
        s.id = id; s.n = 1; n -= 1;
      }
    }
  }
  return n;
}

/** Would `n` of `id` fit in slots? (non-mutating) */
export function canFit(slots: InvSlot[], id: number, n: number): boolean {
  if (!isStackable(id)) {
    return slots.some((s) => s.id === 0);
  }
  let room = 0;
  for (const s of slots) {
    if (s.id === id) room += MAX_STACK - s.n;
    else if (s.id === 0) room += MAX_STACK;
  }
  return room >= n;
}

// --- direct crafting (1-click recipe book): ingredients straight from inventory ---
/** Ingredient cost for one unit of a shaped recipe (id -> count). */
export function recipeCost(r: ShapedRecipe): Record<number, number> {
  const m: Record<number, number> = {};
  for (const id of r.pat) if (id) m[id] = (m[id] ?? 0) + 1;
  return m;
}

/** How many units of `r` the inventory could afford (ignores table + space). */
export function maxCraftable(slots: InvSlot[], r: ShapedRecipe): number {
  const cost = recipeCost(r);
  let best = Infinity;
  for (const [k, v] of Object.entries(cost)) {
    best = Math.min(best, Math.floor(countOf(slots, Number(k)) / v));
  }
  return best === Infinity ? 0 : best;
}

export function recipeById(id: string): ShapedRecipe | null {
  return SHAPED.find((r) => r.id === id) ?? null;
}

/**
 * Craft `n` units of recipe `id` directly from inventory (no grid dance).
 * Returns {ok, made, reason}. Mutates slots on success.
 */
export function craftDirect(
  slots: InvSlot[],
  id: string,
  n: number,
  nearTable: boolean,
): { ok: boolean; made: number; reason?: string } {
  const r = recipeById(id);
  if (!r) return { ok: false, made: 0, reason: "unknown recipe" };
  if (r.needsTable && !nearTable) return { ok: false, made: 0, reason: "need a crafting table nearby" };
  n = Math.max(1, Math.min(64, Math.floor(n) || 1));
  const afford = maxCraftable(slots, r);
  if (afford < 1) return { ok: false, made: 0, reason: "not enough materials" };
  const want = Math.min(n, afford);
  // tools don't stack: cap by empty slots
  let fit = want;
  if (!isStackable(r.out.id)) {
    const empty = slots.filter((s) => s.id === 0).length;
    fit = Math.min(want, empty);
    if (fit < 1) return { ok: false, made: 0, reason: "inventory full" };
  } else if (!canFit(slots, r.out.id, r.out.n * want)) {
    // try fewer units until it fits
    fit = 0;
    for (let k = want; k >= 1; k--) {
      if (canFit(slots, r.out.id, r.out.n * k)) { fit = k; break; }
    }
    if (fit < 1) return { ok: false, made: 0, reason: "inventory full" };
  }
  const cost = recipeCost(r);
  const total: Record<number, number> = {};
  for (const [k, v] of Object.entries(cost)) total[Number(k)] = v * fit;
  removeItems(slots, total);
  giveItems(slots, r.out.id, r.out.n * fit);
  return { ok: true, made: fit };
}

// --- mining drops: block -> item granted on break (null = nothing) ---
export function dropFor(block: number): { id: number; n: number } | null {
  switch (block) {
    case B.GRASS: return { id: B.DIRT, n: 1 };
    case B.DIRT: return { id: B.DIRT, n: 1 };
    case B.STONE: return { id: B.COBBLE, n: 1 };
    case B.SAND: return { id: B.SAND, n: 1 };
    case B.LOG: return { id: B.LOG, n: 1 };
    case B.PLANKS: return { id: B.PLANKS, n: 1 };
    case B.SNOW: return { id: B.SNOW, n: 1 };
    case B.SANDSTONE: return { id: B.SANDSTONE, n: 1 };
    case B.CACTUS: return { id: B.CACTUS, n: 1 };
    case B.CLAY: return { id: B.CLAY, n: 1 };
    case B.BRICK: return { id: B.BRICK, n: 1 };
    case B.GRAVEL: return { id: B.GRAVEL, n: 1 };
    case B.PINE_LOG: return { id: B.PINE_LOG, n: 1 };
    case B.PINE_LEAVES: {
      const r = Math.random();
      if (r < 0.05) return { id: I.APPLE, n: 1 };
      if (r < 0.15) return { id: I.STICK, n: 1 };
      return null;
    }
    case B.TALL_GRASS: return null; // whispy, nothing to take
    case B.FLOWER_RED: return { id: B.FLOWER_RED, n: 1 };
    case B.FLOWER_YELLOW: return { id: B.FLOWER_YELLOW, n: 1 };
    case B.MUSHROOM_RED: return { id: B.MUSHROOM_RED, n: 1 };
    case B.MUSHROOM_BROWN: return { id: B.MUSHROOM_BROWN, n: 1 };
    case B.REEDS: return { id: B.REEDS, n: 1 };
    case B.COAL_ORE: return { id: I.COAL, n: 1 };
    case B.IRON_ORE: return { id: B.IRON_ORE, n: 1 }; // smelt in furnace
    case B.COBBLE: return { id: B.COBBLE, n: 1 };
    case B.CRAFT_TABLE: return { id: B.CRAFT_TABLE, n: 1 };
    case B.FURNACE: return { id: B.FURNACE, n: 1 };
    case B.TORCH: return { id: B.TORCH, n: 1 };
    case B.GLASS: return { id: B.GLASS, n: 1 };
    case B.GOLD_ORE: return { id: B.GOLD_ORE, n: 1 }; // smelt to ingot
    case B.DIAMOND_ORE: return { id: I.DIAMOND, n: 1 };
    case B.FENCE: return { id: B.FENCE, n: 1 };
    case B.STONE_BRICK: return { id: B.STONE_BRICK, n: 1 };
    case B.LADDER: return { id: B.LADDER, n: 1 };
    case B.BED: return { id: B.BED, n: 1 };
    case B.LEAVES: {
      const r = Math.random();
      if (r < 0.08) return { id: I.APPLE, n: 1 };
      if (r < 0.20) return { id: I.STICK, n: 1 }; // 8% apple + 12% stick
      return null;
    }
    default: return null;
  }
}

// --- furnace: 1 iron ore (+1 coal consumed at start) -> 1 ingot over SMELT_TIME ---
export const SMELT_TIME = 8;

export interface SmeltRecipe {
  in: Record<number, number>; // items consumed at start (input + fuel)
  out: { id: number; n: number }; // items granted on completion
}

// Generalized smelt table, keyed by input item id. (Apple has no recipe —
// it comes from leaf/zombie drops only.)
export const SMELT_RECIPES: Record<number, SmeltRecipe> = {
  12: { in: { 12: 1, 102: 1 }, out: { id: 103, n: 1 } }, // iron ore + coal -> iron ingot
  104: { in: { 104: 1, 102: 1 }, out: { id: 107, n: 1 } }, // raw pork + coal -> cooked pork
  4: { in: { 4: 1, 102: 1 }, out: { id: B.GLASS, n: 1 } }, // sand + coal -> glass
  26: { in: { 26: 1, 102: 1 }, out: { id: B.BRICK, n: 4 } }, // clay + coal -> brick x4
  18: { in: { 18: 1, 102: 1 }, out: { id: 122, n: 1 } }, // gold ore + coal -> gold ingot
  132: { in: { 132: 1, 102: 1 }, out: { id: 133, n: 1 } }, // raw beef + coal -> steak
  134: { in: { 134: 1, 102: 1 }, out: { id: 135, n: 1 } }, // raw chicken + coal -> roast chicken
};

/** Look up the smelt recipe for an input item id (null = not smeltable). */
export function smeltInputFor(inputId: number): SmeltRecipe | null {
  return SMELT_RECIPES[inputId] ?? null;
}

/** Output granted when smelting `inputId` completes (null = not smeltable). */
export function smeltOutput(inputId: number): { id: number; n: number } | null {
  return SMELT_RECIPES[inputId]?.out ?? null;
}

export interface FurnaceState {
  x: number; y: number; z: number;
  progress: number; // 0..SMELT_TIME
  active: boolean;
  input?: number; // input item id being smelted (e.g. 12 iron ore, 104 raw pork)
}

export function smeltTick(f: FurnaceState, dt: number): boolean {
  if (!f.active) return false;
  f.progress += dt;
  if (f.progress >= SMELT_TIME) {
    f.active = false;
    f.progress = 0;
    return true; // done -> grant smeltOutput(f.input) — see wiring note below
  }
  return false;
}

// --- furnace wiring note for server/main.ts owner (crafting.ts can't touch main.ts):
// FurnaceState gains an optional `input` field (input item id, e.g. 12 or 104).
// On "smelt/start": pick the input from the player's offered item (default 12
// for backwards compat), validate with smeltInputFor(input) + canAfford(slots,
// recipe.in), then removeItems(slots, recipe.in) and store `input` on the state.
// On smeltTick() === true: grant smeltOutput(f.input ?? 12) via giveItems.
// See the exact snippet in the task summary. ---
