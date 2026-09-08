// Shaped crafting recipes. Patterns are 3x3 row-major, 0 = empty.
// Matching trims empty borders (allows translation) and allows mirroring.
import { B, I, InvSlot } from "./protocol.ts";

const L = B.LOG, P = B.PLANKS, C = B.COBBLE, S = I.STICK, K = I.COAL, G = I.IRON_INGOT;

export interface ShapedRecipe {
  id: string;
  name: string;
  needsTable: boolean; // also gated by size (3-wide never fits the 2x2)
  pat: number[]; // length 9
  out: { id: number; n: number };
}

export const SHAPED: ShapedRecipe[] = [
  { id: "planks", name: "Oak Planks ×4", needsTable: false, pat: [L, 0, 0, 0, 0, 0, 0, 0, 0], out: { id: P, n: 4 } },
  { id: "sticks", name: "Sticks ×4", needsTable: false, pat: [P, 0, 0, P, 0, 0, 0, 0, 0], out: { id: S, n: 4 } },
  { id: "table", name: "Crafting Table", needsTable: false, pat: [P, P, 0, P, P, 0, 0, 0, 0], out: { id: B.CRAFT_TABLE, n: 1 } },
  { id: "torch", name: "Torches ×4", needsTable: false, pat: [K, 0, 0, S, 0, 0, 0, 0, 0], out: { id: B.TORCH, n: 4 } },
  { id: "furnace", name: "Furnace", needsTable: true, pat: [C, C, C, C, 0, C, C, C, C], out: { id: B.FURNACE, n: 1 } },
  { id: "wood_pick", name: "Wooden Pickaxe", needsTable: true, pat: [P, P, P, 0, S, 0, 0, S, 0], out: { id: I.WOOD_PICK, n: 1 } },
  { id: "stone_pick", name: "Stone Pickaxe", needsTable: true, pat: [C, C, C, 0, S, 0, 0, S, 0], out: { id: I.STONE_PICK, n: 1 } },
  { id: "iron_pick", name: "Iron Pickaxe", needsTable: true, pat: [G, G, G, 0, S, 0, 0, S, 0], out: { id: I.IRON_PICK, n: 1 } },
  { id: "wood_sword", name: "Wooden Sword", needsTable: true, pat: [0, P, 0, 0, P, 0, 0, S, 0], out: { id: I.WOOD_SWORD, n: 1 } },
  { id: "stone_sword", name: "Stone Sword", needsTable: true, pat: [0, C, 0, 0, C, 0, 0, S, 0], out: { id: I.STONE_SWORD, n: 1 } },
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
const UNSTACKABLE: Set<number> = new Set([I.WOOD_PICK, I.STONE_PICK, I.IRON_PICK, I.WOOD_SWORD, I.STONE_SWORD]);

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
    case B.COAL_ORE: return { id: I.COAL, n: 1 };
    case B.IRON_ORE: return { id: B.IRON_ORE, n: 1 }; // smelt in furnace
    case B.COBBLE: return { id: B.COBBLE, n: 1 };
    case B.CRAFT_TABLE: return { id: B.CRAFT_TABLE, n: 1 };
    case B.FURNACE: return { id: B.FURNACE, n: 1 };
    case B.TORCH: return { id: B.TORCH, n: 1 };
    case B.LEAVES: return Math.random() < 0.12 ? { id: I.STICK, n: 1 } : null;
    default: return null;
  }
}

// --- furnace: 1 iron ore (+1 coal consumed at start) -> 1 ingot over SMELT_TIME ---
export const SMELT_TIME = 8;

export interface FurnaceState {
  x: number; y: number; z: number;
  progress: number; // 0..SMELT_TIME
  active: boolean;
}

export function smeltTick(f: FurnaceState, dt: number): boolean {
  if (!f.active) return false;
  f.progress += dt;
  if (f.progress >= SMELT_TIME) {
    f.active = false;
    f.progress = 0;
    return true; // done -> grant ingot
  }
  return false;
}
