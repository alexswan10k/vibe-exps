// Shared protocol: block ids, items, message types.
// NOTE: client/js/config.js mirrors these constants (can't import TS from file://).
// Keep them in sync when editing.

export const CHUNK = 16;
export const WORLD_H = 48;
export const SEA_LEVEL = 15;
export const PORT = 8000;

export const B = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  LOG: 5,
  LEAVES: 6,
  PLANKS: 7,
  BEDROCK: 8,
  SNOW: 9,
  WATER: 10,
  COAL_ORE: 11,
  IRON_ORE: 12,
  CRAFT_TABLE: 13,
  FURNACE: 14,
  TORCH: 15,
  COBBLE: 16,
  GLASS: 17,
  GOLD_ORE: 18,
  DIAMOND_ORE: 19,
  FENCE: 20,
  STONE_BRICK: 21,
  LADDER: 22,
  BED: 23,
  SANDSTONE: 24,
  CACTUS: 25,
  CLAY: 26,
  BRICK: 27,
  GRAVEL: 28,
  PINE_LOG: 29,
  PINE_LEAVES: 30,
  TALL_GRASS: 31,
  FLOWER_RED: 32,
  FLOWER_YELLOW: 33,
  MUSHROOM_RED: 34,
  MUSHROOM_BROWN: 35,
  REEDS: 36,
  TNT: 37,
  OBSIDIAN: 38,
  LAMP: 39,
  LAVA: 40,
  EMERALD_ORE: 41,
  EMERALD_BLOCK: 42,
} as const;

export const BLOCK_NAME: Record<number, string> = {
  0: "air", 1: "grass", 2: "dirt", 3: "stone", 4: "sand", 5: "log",
  6: "leaves", 7: "planks", 8: "bedrock", 9: "snow", 10: "water",
  11: "coal ore", 12: "iron ore", 13: "crafting table", 14: "furnace",
  15: "torch", 16: "cobble", 17: "glass", 18: "gold ore", 19: "diamond ore",
  20: "fence", 21: "stone bricks", 22: "ladder", 23: "bed",
  24: "sandstone", 25: "cactus", 26: "clay", 27: "brick", 28: "gravel",
  29: "pine log", 30: "pine leaves", 31: "tall grass", 32: "poppy",
  33: "dandelion", 34: "red mushroom", 35: "brown mushroom", 36: "reeds",
  37: "tnt", 38: "obsidian", 39: "lamp",
  40: "lava", 41: "emerald ore", 42: "emerald block",
  107: "cooked pork", 114: "iron sword", 115: "apple",
  116: "wood axe", 117: "stone axe", 118: "iron axe",
  119: "wood shovel", 120: "stone shovel", 121: "iron shovel",
  122: "gold ingot", 123: "diamond",
  124: "gold pick", 125: "gold sword", 126: "diamond pick", 127: "diamond sword",
  128: "gold axe", 129: "diamond axe", 130: "gold shovel", 131: "diamond shovel",
  132: "raw beef", 133: "steak", 134: "raw chicken", 135: "roast chicken",
  136: "golden apple",
  137: "bone", 138: "string",
  141: "fishing rod", 142: "fish", 143: "cooked fish", 144: "emerald",
  145: "compass",
};

// Item ids: placeable blocks reuse block id; tools/materials use 100+.
export const I = {
  STICK: 101,
  COAL: 102,
  IRON_ORE_ITEM: 112, // same as block 12 when in inventory
  IRON_INGOT: 103,
  RAW_PORK: 104,
  WOOL: 105,
  FEATHER: 106,
  COOKED_PORK: 107,
  WOOD_PICK: 108,
  STONE_PICK: 109,
  IRON_PICK: 110,
  WOOD_SWORD: 111,
  STONE_SWORD: 113,
  IRON_SWORD: 114,
  APPLE: 115,
  WOOD_AXE: 116,
  STONE_AXE: 117,
  IRON_AXE: 118,
  WOOD_SHOVEL: 119,
  STONE_SHOVEL: 120,
  IRON_SHOVEL: 121,
  GOLD_INGOT: 122,
  DIAMOND: 123,
  GOLD_PICK: 124,
  GOLD_SWORD: 125,
  DIAMOND_PICK: 126,
  DIAMOND_SWORD: 127,
  GOLD_AXE: 128,
  DIAMOND_AXE: 129,
  GOLD_SHOVEL: 130,
  DIAMOND_SHOVEL: 131,
  RAW_BEEF: 132,
  STEAK: 133,
  RAW_CHICKEN: 134,
  COOKED_CHICKEN: 135,
  GOLDEN_APPLE: 136,
  BONE: 137,
  STRING: 138,
  FISHING_ROD: 141,
  FISH: 142,
  COOKED_FISH: 143,
  EMERALD: 144,
  COMPASS: 145,
} as const;

// Seconds to break by hand (Infinity = unbreakable)
export const HARDNESS: Record<number, number> = {
  1: 0.7, 2: 0.6, 3: 4.0, 4: 0.55, 5: 1.8, 6: 0.3, 7: 1.8,
  8: Infinity, 9: 0.7, 10: Infinity, 11: 4.5, 12: 5.5,
  13: 1.8, 14: 4.5, 15: 0.15, 16: 4.0, 17: 0.4, 18: 5.5, 19: 6.5,
  20: 1.8, 21: 4.0, 22: 0.4, 23: 1.2,
  24: 3.5, 25: 0.4, 26: 0.6, 27: 4.0, 28: 0.6, 29: 1.8, 30: 0.3,
  31: 0.05, 32: 0.05, 33: 0.05, 34: 0.05, 35: 0.05, 36: 0.3,
  37: 0.5, 38: 14.0, 39: 0.4,
  40: Infinity, 41: 5.5, 42: 4.0,
};

// Walk-through vegetation: no collision, no selection box in the way of
// placement (placing into them replaces them), still breakable for drops.
export const WALK_THROUGH: Set<number> = new Set([31, 32, 33, 34, 35, 36]);

// Which tool class speeds up which blocks. "pick" for stone/ores, "any" otherwise.
export const TOOL_CLASS: Record<number, "pick" | "any"> = {
  1: "any", 2: "any", 3: "pick", 4: "any", 5: "any", 6: "any", 7: "any",
  8: "pick", 9: "any", 10: "any", 11: "pick", 12: "pick",
  13: "any", 14: "pick", 15: "any", 16: "pick", 17: "any", 18: "pick",
  19: "pick", 20: "any", 21: "pick", 22: "any", 23: "any",
  24: "pick", 25: "any", 26: "any", 27: "pick", 28: "any", 29: "any",
  30: "any", 31: "any", 32: "any", 33: "any", 34: "any", 35: "any", 36: "any",
  37: "any", 38: "pick", 39: "any",
  40: "any", 41: "pick", 42: "pick",
};

export const PICK_MULT: Record<number, number> = {
  108: 2.2, 109: 4.2, 110: 6.5, 124: 8.0, 126: 10,
};
// Axe-effective: log / planks / table / fence / ladder / bed. Shovel-effective: grass / dirt / sand / snow.
export const AXE_MULT: Record<number, number> = {
  116: 2.2, 117: 4.2, 118: 6.5, 128: 8.0, 129: 10,
};
export const SHOVEL_MULT: Record<number, number> = {
  119: 2.2, 120: 4.2, 121: 6.5, 130: 8.0, 131: 10,
};
export const AXE_BLOCKS = new Set([5, 7, 13, 20, 22, 23, 29]);
export const SHOVEL_BLOCKS = new Set([1, 2, 4, 9, 26, 28]);
export function toolMultFor(block: number, heldId: number | undefined): number {
  if (heldId === undefined) return 1;
  if (PICK_MULT[heldId] && (block === 3 || block === 11 || block === 12 || block === 14 || block === 16 || block === 24 || block === 27 || block === 38 || block === 41 || block === 42)) return PICK_MULT[heldId];
  if (AXE_MULT[heldId] && AXE_BLOCKS.has(block)) return AXE_MULT[heldId];
  if (SHOVEL_MULT[heldId] && SHOVEL_BLOCKS.has(block)) return SHOVEL_MULT[heldId];
  if (PICK_MULT[heldId] || AXE_MULT[heldId] || SHOVEL_MULT[heldId]) return 1.5; // wrong tool: slight edge
  return 1;
}
export const SWORD_MULT: Record<number, number> = {
  111: 4, 113: 6, 114: 8,
  116: 5, 117: 7, 118: 9, // axes hit hard, swing slow (rate-limit handles it)
  119: 2, 120: 3, 121: 4, // shovels are weak weapons
  125: 5, 127: 10, // gold sword = wood tier, diamond sword = endgame
  128: 6, 129: 9, 130: 3, 131: 5,
};

export function pickTier(itemId: number | undefined): number {
  if (itemId === 126) return 4; // diamond
  if (itemId === 110) return 3;
  if (itemId === 109 || itemId === 124) return 2; // stone + gold
  if (itemId === 108) return 1;
  return 0;
}
// Minimum pick tier required to actually drop the block (else it just breaks to nothing)
export function requiredTier(block: number): number {
  if (block === 38) return 4; // obsidian needs diamond pick
  if (block === 41) return 2; // emerald needs stone pick+
  if (block === 42) return 1; // emerald block needs wood pick+
  if (block === 3 || block === 16 || block === 21 || block === 24 || block === 27) return 1; // stone-likes need wood pick+
  if (block === 11) return 1; // coal
  if (block === 12) return 2; // iron needs stone pick+
  if (block === 18 || block === 19) return 3; // gold/diamond need iron pick+
  if (block === 14) return 1;
  return 0;
}

export type Vec3 = [number, number, number];

// ---- Wire messages (JSON over WebSocket) ----
export type ClientMsg =
  | { t: "hello"; name: string }
  | { t: "reqChunk"; cx: number; cz: number }
  | { t: "edit"; op: "break" | "place"; x: number; y: number; z: number; block?: number; heldItem?: number }
  | { t: "move"; p: Vec3; yaw: number; pitch: number }
  | { t: "gridPut"; slot: number; g: number; all: boolean }
  | { t: "gridTake"; g: number }
  | { t: "craftTake" }
  | { t: "craftDirect"; id: string; n?: number }
  | { t: "smelt"; action: "start" | "take"; x: number; y: number; z: number }
  | { t: "attackMob"; id: number; weapon?: number }
  | { t: "ignite"; x: number; y: number; z: number }
  | { t: "fish" }
  | { t: "tame"; id: number }
  | { t: "askTrade"; id: number }
  | { t: "trade"; id: number; slot: number }
  | { t: "chat"; msg: string }
  | { t: "respawn" }
  | { t: "setBed"; x: number; y: number; z: number }
  | { t: "eat"; slot: number }
  | { t: "fall"; dmg: number }
  | { t: "pong"; now: number }
  | { t: "moveItem"; from: number; to: number };

export type ServerMsg =
  | { t: "welcome"; id: number; seed: number; spawn: Vec3; time: number; motd: string; rain?: number }
  | { t: "chunk"; cx: number; cz: number; rle: number[] }
  | { t: "block"; x: number; y: number; z: number; block: number }
  | { t: "players"; list: PublicPlayer[] }
  | { t: "mobs"; list: MobWire[] }
  | { t: "mobHit"; id: number }
  | { t: "inv"; slots: InvSlot[] }
  | { t: "grid"; cells: InvSlot[]; result: InvSlot }
  | { t: "vitals"; hp: number; maxHp: number; hunger: number; dead: boolean }
  | { t: "time"; time: number; rain?: number }
  | { t: "boom"; x: number; y: number; z: number; r: number }
  | { t: "toast"; text: string }
  | { t: "tradeOffers"; id: number; offers: TradeOffer[] }
  | { t: "markers"; spawn: Vec3; home?: Vec3; bed?: Vec3 }
  | { t: "reset"; seed: number; spawn: Vec3 }
  | { t: "chat"; from: string; msg: string }
  | { t: "smeltState"; states: FurnaceWire[] }
  | { t: "ping"; now: number }
  | { t: "denied"; reason: string };

export interface InvSlot {
  id: number; // 0 = empty
  n: number;
}
export interface PublicPlayer {
  id: number; name: string; p: Vec3; yaw: number; hp: number; dead: boolean;
}
export interface MobWire {
  id: number; kind: string; p: Vec3; hp: number; maxHp: number;
}
export interface FurnaceWire {
  x: number; y: number; z: number; progress: number; ready: boolean;
}
export interface TradeOffer {
  give: InvSlot; // what the player pays
  get: InvSlot; // what the villager gives
}

// RLE helpers: flat [id,count,...]
export function encodeRLE(data: Uint8Array): number[] {
  const out: number[] = [];
  let i = 0;
  while (i < data.length) {
    const v = data[i];
    let c = 1;
    while (i + c < data.length && data[i + c] === v && c < 65535) c++;
    out.push(v, c);
    i += c;
  }
  return out;
}
export function decodeRLE(rle: number[], out: Uint8Array): void {
  let o = 0;
  for (let i = 0; i < rle.length; i += 2) {
    const v = rle[i], c = rle[i + 1];
    for (let k = 0; k < c; k++) out[o++] = v;
  }
}
