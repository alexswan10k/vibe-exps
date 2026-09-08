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
} as const;

export const BLOCK_NAME: Record<number, string> = {
  0: "air", 1: "grass", 2: "dirt", 3: "stone", 4: "sand", 5: "log",
  6: "leaves", 7: "planks", 8: "bedrock", 9: "snow", 10: "water",
  11: "coal ore", 12: "iron ore", 13: "crafting table", 14: "furnace",
  15: "torch", 16: "cobble",
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
  WOOD_PICK: 108,
  STONE_PICK: 109,
  IRON_PICK: 110,
  WOOD_SWORD: 111,
  STONE_SWORD: 113,
} as const;

// Seconds to break by hand (Infinity = unbreakable)
export const HARDNESS: Record<number, number> = {
  1: 0.7, 2: 0.6, 3: 4.0, 4: 0.55, 5: 1.8, 6: 0.3, 7: 1.8,
  8: Infinity, 9: 0.7, 10: Infinity, 11: 4.5, 12: 5.5,
  13: 1.8, 14: 4.5, 15: 0.15, 16: 4.0,
};

// Which tool class speeds up which blocks. "pick" for stone/ores, "any" otherwise.
export const TOOL_CLASS: Record<number, "pick" | "any"> = {
  1: "any", 2: "any", 3: "pick", 4: "any", 5: "any", 6: "any", 7: "any",
  8: "pick", 9: "any", 10: "any", 11: "pick", 12: "pick",
  13: "any", 14: "pick", 15: "any", 16: "pick",
};

export const PICK_MULT: Record<number, number> = {
  108: 2.2, 109: 4.2, 110: 6.5,
};
export const SWORD_MULT: Record<number, number> = {
  111: 4, 113: 6,
};

export function pickTier(itemId: number | undefined): number {
  if (itemId === 110) return 3;
  if (itemId === 109) return 2;
  if (itemId === 108) return 1;
  return 0;
}
// Minimum pick tier required to actually drop the block (else it just breaks to nothing)
export function requiredTier(block: number): number {
  if (block === 3 || block === 16) return 1; // stone/cobble need wood pick+
  if (block === 11) return 1; // coal
  if (block === 12) return 2; // iron needs stone pick+
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
  | { t: "smelt"; action: "start" | "take"; x: number; y: number; z: number }
  | { t: "attackMob"; id: number; weapon?: number }
  | { t: "chat"; msg: string }
  | { t: "respawn" }
  | { t: "eat"; slot: number }
  | { t: "fall"; dmg: number }
  | { t: "moveItem"; from: number; to: number };

export type ServerMsg =
  | { t: "welcome"; id: number; seed: number; spawn: Vec3; time: number; motd: string }
  | { t: "chunk"; cx: number; cz: number; rle: number[] }
  | { t: "block"; x: number; y: number; z: number; block: number }
  | { t: "players"; list: PublicPlayer[] }
  | { t: "mobs"; list: MobWire[] }
  | { t: "mobHit"; id: number }
  | { t: "inv"; slots: InvSlot[] }
  | { t: "grid"; cells: InvSlot[]; result: InvSlot }
  | { t: "vitals"; hp: number; maxHp: number; hunger: number; dead: boolean }
  | { t: "time"; time: number }
  | { t: "chat"; from: string; msg: string }
  | { t: "smeltState"; states: FurnaceWire[] }
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
