// Mirrors server/protocol.ts (no build step — keep in sync by hand).
export const CHUNK = 16;
export const WORLD_H = 48;
export const SEA_LEVEL = 15;

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, LOG: 5, LEAVES: 6,
  PLANKS: 7, BEDROCK: 8, SNOW: 9, WATER: 10, COAL_ORE: 11, IRON_ORE: 12,
  CRAFT_TABLE: 13, FURNACE: 14, TORCH: 15, COBBLE: 16, GLASS: 17,
  GOLD_ORE: 18, DIAMOND_ORE: 19, FENCE: 20, STONE_BRICK: 21, LADDER: 22, BED: 23,
};

export const BLOCK_NAME = {
  0: "air", 1: "grass", 2: "dirt", 3: "stone", 4: "sand", 5: "log",
  6: "leaves", 7: "planks", 8: "bedrock", 9: "snow", 10: "water",
  11: "coal ore", 12: "iron ore", 13: "crafting table", 14: "furnace",
  15: "torch", 16: "cobble", 17: "glass", 18: "gold ore", 19: "diamond ore",
  20: "fence", 21: "stone bricks", 22: "ladder", 23: "bed",
  101: "stick", 102: "coal", 103: "iron ingot", 104: "pork",
  105: "wool", 106: "feather", 107: "cooked pork", 108: "wood pick", 109: "stone pick",
  110: "iron pick", 111: "wood sword", 113: "stone sword", 114: "iron sword",
  115: "apple", 112: "iron ore",
  116: "wood axe", 117: "stone axe", 118: "iron axe",
  119: "wood shovel", 120: "stone shovel", 121: "iron shovel",
  122: "gold ingot", 123: "diamond",
  124: "gold pick", 125: "gold sword", 126: "diamond pick", 127: "diamond sword",
  128: "gold axe", 129: "diamond axe", 130: "gold shovel", 131: "diamond shovel",
  132: "raw beef", 133: "steak", 134: "raw chicken", 135: "roast chicken",
  136: "golden apple",
};

export const HARDNESS = {
  1: 0.7, 2: 0.6, 3: 4.0, 4: 0.55, 5: 1.8, 6: 0.3, 7: 1.8,
  8: Infinity, 9: 0.7, 10: Infinity, 11: 4.5, 12: 5.5,
  13: 1.8, 14: 4.5, 15: 0.15, 16: 4.0, 17: 0.4, 18: 5.5, 19: 6.5,
  20: 1.8, 21: 4.0, 22: 0.4, 23: 1.2,
};

export const PICK_MULT = { 108: 2.2, 109: 4.2, 110: 6.5, 124: 8.0, 126: 10 };
export const AXE_MULT = { 116: 2.2, 117: 4.2, 118: 6.5, 128: 8.0, 129: 10 };
export const SHOVEL_MULT = { 119: 2.2, 120: 4.2, 121: 6.5, 130: 8.0, 131: 10 };
const AXE_BLOCKS = new Set([5, 7, 13, 20, 22, 23]);
const SHOVEL_BLOCKS = new Set([1, 2, 4, 9]);
export function toolMultFor(block, heldId) {
  if (heldId === undefined) return 1;
  if (PICK_MULT[heldId] && [3, 11, 12, 14, 16, 18, 19, 21].includes(block)) return PICK_MULT[heldId];
  if (AXE_MULT[heldId] && AXE_BLOCKS.has(block)) return AXE_MULT[heldId];
  if (SHOVEL_MULT[heldId] && SHOVEL_BLOCKS.has(block)) return SHOVEL_MULT[heldId];
  if (PICK_MULT[heldId] || AXE_MULT[heldId] || SHOVEL_MULT[heldId]) return 1.5;
  return 1;
}

export function isPlaceable(id) {
  return Number.isInteger(id) && id >= 1 && id <= 23 && id !== 8 && id !== 10;
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
