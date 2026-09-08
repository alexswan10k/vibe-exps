// Mirrors server/crafting.ts SHAPED (no build step — keep patterns in sync by hand).
// L=log P=planks C=cobble S=stick K=coal G=ingot, 3x3 row-major, 0 = empty.
const L = 5, P = 7, C = 16, S = 101, K = 102, G = 103;

export const SHAPED_CLIENT = [
  { id: "planks", name: "Oak Planks ×4", needsTable: false, out: { id: 7, n: 4 }, pat: [L, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: "sticks", name: "Sticks ×4", needsTable: false, out: { id: 101, n: 4 }, pat: [P, 0, 0, P, 0, 0, 0, 0, 0] },
  { id: "table", name: "Crafting Table", needsTable: false, out: { id: 13, n: 1 }, pat: [P, P, 0, P, P, 0, 0, 0, 0] },
  { id: "torch", name: "Torches ×4", needsTable: false, out: { id: 15, n: 4 }, pat: [K, 0, 0, S, 0, 0, 0, 0, 0] },
  { id: "furnace", name: "Furnace", needsTable: true, out: { id: 14, n: 1 }, pat: [C, C, C, C, 0, C, C, C, C] },
  { id: "wood_pick", name: "Wooden Pickaxe", needsTable: true, out: { id: 108, n: 1 }, pat: [P, P, P, 0, S, 0, 0, S, 0] },
  { id: "stone_pick", name: "Stone Pickaxe", needsTable: true, out: { id: 109, n: 1 }, pat: [C, C, C, 0, S, 0, 0, S, 0] },
  { id: "iron_pick", name: "Iron Pickaxe", needsTable: true, out: { id: 110, n: 1 }, pat: [G, G, G, 0, S, 0, 0, S, 0] },
  { id: "wood_sword", name: "Wooden Sword", needsTable: true, out: { id: 111, n: 1 }, pat: [0, P, 0, 0, P, 0, 0, S, 0] },
  { id: "stone_sword", name: "Stone Sword", needsTable: true, out: { id: 113, n: 1 }, pat: [0, C, 0, 0, C, 0, 0, S, 0] },
];
