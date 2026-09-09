// Mirrors server/crafting.ts SHAPED (no build step — keep patterns in sync by hand).
// L=log P=planks C=cobble S=stick K=coal G=ingot N=gold D=diamond W=wool A=apple,
// 3x3 row-major, 0 = empty.
// cat: basics | tools | blocks | food — used for picker filters. desc: 1-line usage hint.
const L = 5, P = 7, C = 16, S = 101, K = 102, G = 103;
const N = 122, D = 123, W = 105, A = 115;

export const SHAPED_CLIENT = [
  { id: "planks", name: "Oak Planks ×4", needsTable: false, cat: "basics", desc: "logs → building blocks", out: { id: 7, n: 4 }, pat: [L, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: "sticks", name: "Sticks ×4", needsTable: false, cat: "basics", desc: "handles for every tool", out: { id: 101, n: 4 }, pat: [P, 0, 0, P, 0, 0, 0, 0, 0] },
  { id: "table", name: "Crafting Table", needsTable: false, cat: "blocks", desc: "unlocks 3×3 recipes nearby", out: { id: 13, n: 1 }, pat: [P, P, 0, P, P, 0, 0, 0, 0] },
  { id: "torch", name: "Torches ×4", needsTable: false, cat: "blocks", desc: "light vs night zombies", out: { id: 15, n: 4 }, pat: [K, 0, 0, S, 0, 0, 0, 0, 0] },
  { id: "furnace", name: "Furnace", needsTable: true, cat: "blocks", desc: "smelt ore, pork, sand", out: { id: 14, n: 1 }, pat: [C, C, C, C, 0, C, C, C, C] },
  { id: "wood_pick", name: "Wooden Pickaxe", needsTable: true, cat: "tools", desc: "mine stone + coal", out: { id: 108, n: 1 }, pat: [P, P, P, 0, S, 0, 0, S, 0] },
  { id: "stone_pick", name: "Stone Pickaxe", needsTable: true, cat: "tools", desc: "mine iron ore", out: { id: 109, n: 1 }, pat: [C, C, C, 0, S, 0, 0, S, 0] },
  { id: "iron_pick", name: "Iron Pickaxe", needsTable: true, cat: "tools", desc: "fastest mining", out: { id: 110, n: 1 }, pat: [G, G, G, 0, S, 0, 0, S, 0] },
  { id: "wood_axe", name: "Wooden Axe", needsTable: true, cat: "tools", desc: "chop logs fast", out: { id: 116, n: 1 }, pat: [P, P, 0, P, S, 0, 0, S, 0] },
  { id: "stone_axe", name: "Stone Axe", needsTable: true, cat: "tools", desc: "chop faster, hits hard", out: { id: 117, n: 1 }, pat: [C, C, 0, C, S, 0, 0, S, 0] },
  { id: "iron_axe", name: "Iron Axe", needsTable: true, cat: "tools", desc: "fastest chopping", out: { id: 118, n: 1 }, pat: [G, G, 0, G, S, 0, 0, S, 0] },
  { id: "wood_shovel", name: "Wooden Shovel", needsTable: true, cat: "tools", desc: "dig dirt/sand fast", out: { id: 119, n: 1 }, pat: [0, P, 0, 0, S, 0, 0, S, 0] },
  { id: "stone_shovel", name: "Stone Shovel", needsTable: true, cat: "tools", desc: "dig faster", out: { id: 120, n: 1 }, pat: [0, C, 0, 0, S, 0, 0, S, 0] },
  { id: "iron_shovel", name: "Iron Shovel", needsTable: true, cat: "tools", desc: "fastest digging", out: { id: 121, n: 1 }, pat: [0, G, 0, 0, S, 0, 0, S, 0] },
  { id: "wood_sword", name: "Wooden Sword", needsTable: true, cat: "tools", desc: "4 dmg", out: { id: 111, n: 1 }, pat: [0, P, 0, 0, P, 0, 0, S, 0] },
  { id: "stone_sword", name: "Stone Sword", needsTable: true, cat: "tools", desc: "6 dmg, zombie in 4 hits", out: { id: 113, n: 1 }, pat: [0, C, 0, 0, C, 0, 0, S, 0] },
  { id: "iron_sword", name: "Iron Sword", needsTable: true, cat: "tools", desc: "8 dmg", out: { id: 114, n: 1 }, pat: [0, G, 0, 0, G, 0, 0, S, 0] },
  { id: "gold_pick", name: "Gold Pickaxe", needsTable: true, cat: "tools", desc: "very fast, stone-tier", out: { id: 124, n: 1 }, pat: [N, N, N, 0, S, 0, 0, S, 0] },
  { id: "diamond_pick", name: "Diamond Pickaxe", needsTable: true, cat: "tools", desc: "mines everything, fastest", out: { id: 126, n: 1 }, pat: [D, D, D, 0, S, 0, 0, S, 0] },
  { id: "gold_axe", name: "Gold Axe", needsTable: true, cat: "tools", desc: "very fast chopping", out: { id: 128, n: 1 }, pat: [N, N, 0, N, S, 0, 0, S, 0] },
  { id: "diamond_axe", name: "Diamond Axe", needsTable: true, cat: "tools", desc: "fastest chopping, 9 dmg", out: { id: 129, n: 1 }, pat: [D, D, 0, D, S, 0, 0, S, 0] },
  { id: "gold_shovel", name: "Gold Shovel", needsTable: true, cat: "tools", desc: "very fast digging", out: { id: 130, n: 1 }, pat: [0, N, 0, 0, S, 0, 0, S, 0] },
  { id: "diamond_shovel", name: "Diamond Shovel", needsTable: true, cat: "tools", desc: "fastest digging", out: { id: 131, n: 1 }, pat: [0, D, 0, 0, S, 0, 0, S, 0] },
  { id: "gold_sword", name: "Gold Sword", needsTable: true, cat: "tools", desc: "5 dmg, fast to make", out: { id: 125, n: 1 }, pat: [0, N, 0, 0, N, 0, 0, S, 0] },
  { id: "diamond_sword", name: "Diamond Sword", needsTable: true, cat: "tools", desc: "10 dmg, zombie in 2 hits", out: { id: 127, n: 1 }, pat: [0, D, 0, 0, D, 0, 0, S, 0] },
  { id: "fence", name: "Fence ×3", needsTable: true, cat: "blocks", desc: "pens + rails", out: { id: 20, n: 3 }, pat: [P, S, P, P, S, P, 0, 0, 0] },
  { id: "stone_brick", name: "Stone Bricks ×4", needsTable: false, cat: "blocks", desc: "2×2 cobble, no table", out: { id: 21, n: 4 }, pat: [C, C, 0, C, C, 0, 0, 0, 0] },
  { id: "ladder", name: "Ladder ×3", needsTable: true, cat: "blocks", desc: "climb with Space", out: { id: 22, n: 3 }, pat: [S, 0, S, S, S, S, S, 0, S] },
  { id: "bed", name: "Bed", needsTable: true, cat: "blocks", desc: "right-click to set spawn", out: { id: 23, n: 1 }, pat: [P, P, P, W, W, W, 0, 0, 0] },
  { id: "golden_apple", name: "Golden Apple", needsTable: true, cat: "food", desc: "full heal +10 hunger", out: { id: 136, n: 1 }, pat: [N, N, N, N, A, N, N, N, N] },
];

/** Furnace cheat-sheet for the picker (mirrors server SMELT_RECIPES). */
export const SMELT_CLIENT = [
  { inId: 12, inName: "iron ore", fuel: "coal", outId: 103, outName: "iron ingot" },
  { inId: 104, inName: "raw pork", fuel: "coal", outId: 107, outName: "cooked pork" },
  { inId: 4, inName: "sand", fuel: "coal", outId: 17, outName: "glass" },
  { inId: 18, inName: "gold ore", fuel: "coal", outId: 122, outName: "gold ingot" },
  { inId: 132, inName: "raw beef", fuel: "coal", outId: 133, outName: "steak" },
  { inId: 134, inName: "raw chicken", fuel: "coal", outId: 135, outName: "roast chicken" },
];
