// Mirrors server/protocol.ts (no build step — keep in sync by hand).
export const CHUNK = 16;
export const WORLD_H = 48;
export const SEA_LEVEL = 15;

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, LOG: 5, LEAVES: 6,
  PLANKS: 7, BEDROCK: 8, SNOW: 9, WATER: 10, COAL_ORE: 11, IRON_ORE: 12,
  CRAFT_TABLE: 13, FURNACE: 14, TORCH: 15, COBBLE: 16,
};

export const BLOCK_NAME = {
  0: "air", 1: "grass", 2: "dirt", 3: "stone", 4: "sand", 5: "log",
  6: "leaves", 7: "planks", 8: "bedrock", 9: "snow", 10: "water",
  11: "coal ore", 12: "iron ore", 13: "crafting table", 14: "furnace",
  15: "torch", 16: "cobble",
  101: "stick", 102: "coal", 103: "iron ingot", 104: "pork",
  105: "wool", 106: "feather", 108: "wood pick", 109: "stone pick",
  110: "iron pick", 111: "wood sword", 113: "stone sword",
};

export const HARDNESS = {
  1: 0.7, 2: 0.6, 3: 4.0, 4: 0.55, 5: 1.8, 6: 0.3, 7: 1.8,
  8: Infinity, 9: 0.7, 10: Infinity, 11: 4.5, 12: 5.5,
  13: 1.8, 14: 4.5, 15: 0.15, 16: 4.0,
};

export const PICK_MULT = { 108: 2.2, 109: 4.2, 110: 6.5 };

export const RECIPES = [
  { id: "planks", name: "Oak Planks ×4", needsTable: false, in: { 5: 1 }, out: "7 ×4" },
  { id: "sticks", name: "Sticks ×4", needsTable: false, in: { 7: 2 }, out: "sticks ×4" },
  { id: "table", name: "Crafting Table", needsTable: false, in: { 7: 4 }, out: "table" },
  { id: "torch", name: "Torches ×4", needsTable: false, in: { 102: 1, 101: 1 }, out: "torches ×4" },
  { id: "furnace", name: "Furnace (needs table)", needsTable: true, in: { 16: 8 }, out: "furnace" },
  { id: "wood_pick", name: "Wooden Pickaxe (needs table)", needsTable: true, in: { 7: 3, 101: 2 }, out: "wood pick" },
  { id: "stone_pick", name: "Stone Pickaxe (needs table)", needsTable: true, in: { 16: 3, 101: 2 }, out: "stone pick" },
  { id: "iron_pick", name: "Iron Pickaxe (needs table)", needsTable: true, in: { 103: 3, 101: 2 }, out: "iron pick" },
  { id: "wood_sword", name: "Wooden Sword (needs table)", needsTable: true, in: { 7: 2, 101: 1 }, out: "wood sword" },
  { id: "stone_sword", name: "Stone Sword (needs table)", needsTable: true, in: { 16: 2, 101: 1 }, out: "stone sword" },
];

export function isPlaceable(id) {
  return Number.isInteger(id) && id >= 1 && id <= 16 && id !== 8 && id !== 10;
}

/** Resolve which server to connect to.
 *  Priority: ?server= param > saved > same-origin (if not file://) > localhost:8000 */
export function resolveServerUrl() {
  const q = new URLSearchParams(location.search).get("server");
  if (q) return normalize(q);
  try {
    const saved = localStorage.getItem("voxelcoop.server");
    if (saved) return saved;
  } catch { /* private mode */ }
  if (location.protocol.startsWith("http") && location.host) {
    return `ws://${location.host}/ws`;
  }
  return "ws://localhost:8000/ws";
}

function normalize(v) {
  v = v.trim();
  if (v.startsWith("http")) return v.replace(/^http/, "ws").replace(/\/$/, "") + "/ws";
  if (v.startsWith("ws")) return v;
  return `ws://${v.replace(/\/$/, "")}/ws`;
}

export function httpBase(wsUrl) {
  return wsUrl.replace(/^ws/, "http").replace(/\/ws$/, "");
}
