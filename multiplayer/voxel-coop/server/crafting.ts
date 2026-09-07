// Crafting recipes, block drops, smelting. All validation server-side.

import { B, I, InvSlot } from "./protocol.ts";

export interface Recipe {
  id: string;
  name: string;
  needsTable: boolean;
  // required items (itemId -> count), shapeless for simplicity
  in: Record<number, number>;
  out: { id: number; n: number };
}

export const RECIPES: Recipe[] = [
  { id: "planks", name: "Oak Planks ×4", needsTable: false, in: { [B.LOG]: 1 }, out: { id: B.PLANKS, n: 4 } },
  { id: "sticks", name: "Sticks ×4", needsTable: false, in: { [B.PLANKS]: 2 }, out: { id: I.STICK, n: 4 } },
  { id: "table", name: "Crafting Table", needsTable: false, in: { [B.PLANKS]: 4 }, out: { id: B.CRAFT_TABLE, n: 1 } },
  { id: "torch", name: "Torches ×4", needsTable: false, in: { [I.COAL]: 1, [I.STICK]: 1 }, out: { id: B.TORCH, n: 4 } },
  { id: "furnace", name: "Furnace", needsTable: true, in: { [B.COBBLE]: 8 }, out: { id: B.FURNACE, n: 1 } },
  { id: "wood_pick", name: "Wooden Pickaxe", needsTable: true, in: { [B.PLANKS]: 3, [I.STICK]: 2 }, out: { id: I.WOOD_PICK, n: 1 } },
  { id: "stone_pick", name: "Stone Pickaxe", needsTable: true, in: { [B.COBBLE]: 3, [I.STICK]: 2 }, out: { id: I.STONE_PICK, n: 1 } },
  { id: "iron_pick", name: "Iron Pickaxe", needsTable: true, in: { [I.IRON_INGOT]: 3, [I.STICK]: 2 }, out: { id: I.IRON_PICK, n: 1 } },
  { id: "wood_sword", name: "Wooden Sword", needsTable: true, in: { [B.PLANKS]: 2, [I.STICK]: 1 }, out: { id: I.WOOD_SWORD, n: 1 } },
  { id: "stone_sword", name: "Stone Sword", needsTable: true, in: { [B.COBBLE]: 2, [I.STICK]: 1 }, out: { id: I.STONE_SWORD, n: 1 } },
];

export function findRecipe(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
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

export function tryCraft(slots: InvSlot[], recipeId: string): { ok: boolean; reason?: string } {
  const r = findRecipe(recipeId);
  if (!r) return { ok: false, reason: "unknown recipe" };
  if (!canAfford(slots, r.in)) return { ok: false, reason: "missing ingredients" };
  // simulate: only commit if output fits
  const backup = slots.map((s) => ({ ...s }));
  removeItems(slots, r.in);
  const left = giveItems(slots, r.out.id, r.out.n);
  if (left > 0) {
    for (let i = 0; i < slots.length; i++) slots[i] = backup[i];
    return { ok: false, reason: "inventory full" };
  }
  return { ok: true };
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
