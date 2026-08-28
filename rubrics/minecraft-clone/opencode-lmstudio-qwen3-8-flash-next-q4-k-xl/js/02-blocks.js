/* block registry */
'use strict';

const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, LOG: 5, LEAVES: 6, SAND: 7,
  GLASS: 8, PLANKS: 9, BEDROCK: 10, GRAVEL: 11, BRICK: 12, SNOW: 13, WATER: 14
};

// hardness = seconds to break by hand; tiles per face group
const BLOCKS = {
  [B.AIR]:    { name: 'Air', solid: false },
  [B.GRASS]:  { name: 'Grass Block', tiles: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' }, hardness: .25, sound: 'grass', pc: [106, 152, 66] },
  [B.DIRT]:   { name: 'Dirt', tiles: { top: 'dirt', bottom: 'dirt', side: 'dirt' }, hardness: .25, sound: 'grass', pc: [134, 96, 67] },
  [B.STONE]:  { name: 'Stone', tiles: { top: 'stone', bottom: 'stone', side: 'stone' }, hardness: .6, sound: 'stone', pc: [127, 127, 130] },
  [B.COBBLE]: { name: 'Cobblestone', tiles: { top: 'cobble', bottom: 'cobble', side: 'cobble' }, hardness: .7, sound: 'stone', pc: [110, 110, 113] },
  [B.LOG]:    { name: 'Oak Log', tiles: { top: 'log_top', bottom: 'log_top', side: 'log_side' }, hardness: .5, sound: 'wood', pc: [104, 80, 48] },
  [B.LEAVES]: { name: 'Leaves', tiles: { top: 'leaves', bottom: 'leaves', side: 'leaves' }, hardness: .18, sound: 'grass', pc: [54, 108, 34] },
  [B.SAND]:   { name: 'Sand', tiles: { top: 'sand', bottom: 'sand', side: 'sand' }, hardness: .25, sound: 'sand', pc: [219, 207, 163], falls: true },
  [B.GLASS]:  { name: 'Glass', tiles: { top: 'glass', bottom: 'glass', side: 'glass' }, hardness: .2, sound: 'glass', pc: [205, 235, 245] },
  [B.PLANKS]: { name: 'Oak Planks', tiles: { top: 'planks', bottom: 'planks', side: 'planks' }, hardness: .5, sound: 'wood', pc: [162, 130, 78] },
  [B.BEDROCK]:{ name: 'Bedrock', tiles: { top: 'bedrock', bottom: 'bedrock', side: 'bedrock' }, hardness: Infinity, sound: 'stone', pc: [85, 85, 88], placeable: false },
  [B.GRAVEL]: { name: 'Gravel', tiles: { top: 'gravel', bottom: 'gravel', side: 'gravel' }, hardness: .3, sound: 'sand', pc: [128, 120, 116], falls: true },
  [B.BRICK]:  { name: 'Bricks', tiles: { top: 'brick', bottom: 'brick', side: 'brick' }, hardness: .8, sound: 'stone', pc: [150, 87, 68] },
  [B.SNOW]:   { name: 'Snow Block', tiles: { top: 'snow', bottom: 'dirt', side: 'snow_side' }, hardness: .2, sound: 'grass', pc: [240, 245, 250] },
  [B.WATER]:  { name: 'Water', tiles: { top: 'water', bottom: 'water', side: 'water' }, hardness: Infinity, liquid: true, solid: false, breakable: false }
};

// default face tile lookup (face: 0 +x,1 -x,2 +y,3 -y,4 +z,5 -z)
function blockTile(id, face) {
  const t = BLOCKS[id].tiles;
  return face === 2 ? t.top : face === 3 ? t.bottom : t.side;
}

const isOpaque = (id) => id !== B.AIR && id !== B.WATER && id !== B.GLASS;
const isSolid = (id) => id !== B.AIR && id !== B.WATER && BLOCKS[id] !== undefined;
