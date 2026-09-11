// Client voxel store: chunk cache (Uint8Array per chunk) + Three.js meshing.
// Layout matches server: index = (y * CHUNK + z) * CHUNK + x.
import { B, CHUNK, WORLD_H } from "./config.js";

const OPAQUE = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 23, 24, 25, 26, 27, 28, 29, 30]);
// Walk-through vegetation (mirrors server WALK_THROUGH): cross-quad billboards.
const PLANTS = new Set([31, 32, 33, 34, 35, 36]);

// --- pixel-art texture painters (16x16) ---
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967295;
  };
}

function makeCanvas(paint, seed) {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  paint(c.getContext("2d"), rng(seed));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.encoding = THREE.sRGBEncoding;
  return t;
}

function noiseFill(g, r, base, vary) {
  const [br, bg, bb] = base;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const v = (r() - 0.5) * vary;
      g.fillStyle = `rgb(${conv(br + v)},${conv(bg + v)},${conv(bb + v)})`;
      g.fillRect(x, y, 1, 1);
    }
  }
}
function conv(n) { return Math.max(0, Math.min(255, Math.floor(n * 255))); }
function blobs(g, r, color, count, size) {
  g.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = Math.floor(r() * (16 - size)), y = Math.floor(r() * (16 - size));
    g.fillRect(x, y, size, size);
  }
}

const DIRT = [0.47, 0.32, 0.17];
const GRASS_GREEN = [0.36, 0.72, 0.27];
const STONE = [0.5, 0.5, 0.52];

function paintDirt(g, r) { noiseFill(g, r, DIRT, 0.1); }
function paintGrassTop(g, r) { noiseFill(g, r, GRASS_GREEN, 0.12); }
function paintGrassSide(g, r) {
  noiseFill(g, r, DIRT, 0.1);
  const rr = rng(913);
  for (let x = 0; x < 16; x++) {
    const depth = 3 + Math.floor(rr() * 3);
    for (let y = 0; y < depth; y++) {
      const v = (rr() - 0.5) * 0.1;
      g.fillStyle = `rgb(${conv(GRASS_GREEN[0] + v)},${conv(GRASS_GREEN[1] + v)},${conv(GRASS_GREEN[2] + v)})`;
      g.fillRect(x, y, 1, 1);
    }
  }
}
function paintBark(g, r) {
  noiseFill(g, r, [0.32, 0.21, 0.1], 0.08);
  // dark vertical stripes
  for (let x = 0; x < 16; x++) {
    if (x % 4 === 1) {
      g.fillStyle = "rgba(30,18,6,0.55)";
      g.fillRect(x, 0, 1, 16);
    }
  }
}
function paintRings(g, r) {
  noiseFill(g, r, [0.62, 0.45, 0.24], 0.06);
  g.fillStyle = "rgba(70,45,20,0.7)";
  // concentric squares
  for (let k = 0; k < 4; k++) {
    const o = k * 2;
    g.fillRect(o, o, 16 - o * 2, 1);
    g.fillRect(o, 15 - o, 16 - o * 2, 1);
    g.fillRect(o, o, 1, 16 - o * 2);
    g.fillRect(15 - o, o, 1, 16 - o * 2);
  }
}
function paintStone(g, r) { noiseFill(g, r, STONE, 0.07); }
function paintCoalOre(g, r) { paintStone(g, r); blobs(g, r, "#141414", 6, 2); }
function paintIronOre(g, r) { paintStone(g, r); blobs(g, r, "#d9975f", 6, 2); }
function paintPlanks(g, r) {
  noiseFill(g, r, [0.6, 0.43, 0.21], 0.05);
  g.fillStyle = "rgba(60,38,15,0.8)";
  for (let y = 3; y < 16; y += 4) g.fillRect(0, y, 16, 1);
  g.fillRect(4, 0, 1, 3); g.fillRect(11, 4, 1, 4); g.fillRect(5, 8, 1, 4); g.fillRect(12, 12, 1, 4);
}
function paintTableTop(g, r) {
  paintPlanks(g, r);
  g.fillStyle = "rgba(40,24,8,0.9)";
  g.fillRect(0, 0, 16, 1); g.fillRect(0, 15, 16, 1);
  g.fillRect(0, 0, 1, 16); g.fillRect(15, 0, 1, 16);
  g.fillRect(7, 1, 2, 14); g.fillRect(1, 7, 14, 2);
}
function paintTableSide(g, r) {
  paintPlanks(g, r);
  g.fillStyle = "rgba(40,24,8,0.85)";
  g.fillRect(0, 0, 16, 2);
}
function paintFurnace(g, r) {
  noiseFill(g, r, [0.42, 0.42, 0.44], 0.08);
  g.fillStyle = "rgba(20,20,22,0.7)";
  for (let y = 3; y < 16; y += 4) g.fillRect(0, y, 16, 1);
}
function paintFurnaceFront(g, r) {
  paintFurnace(g, r);
  g.fillStyle = "#0a0a0a";
  g.fillRect(5, 8, 6, 6);
  g.fillStyle = "#3a3a3a";
  g.fillRect(5, 8, 6, 1);
}
function paintCobble(g, r) {
  noiseFill(g, r, [0.45, 0.45, 0.47], 0.06);
  g.fillStyle = "rgba(25,25,28,0.8)";
  // jittered mortar grid
  for (let i = 0; i < 4; i++) {
    const y = i * 4 + Math.floor(r() * 2);
    g.fillRect(0, y, 16, 1);
    const x = i * 4 + Math.floor(r() * 2);
    g.fillRect(x, 0, 1, 16);
  }
}
function paintLeaves(g, r) {
  noiseFill(g, r, [0.13, 0.45, 0.13], 0.14);
  blobs(g, r, "rgba(8,30,8,0.8)", 14, 1);
}
function paintSand(g, r) { noiseFill(g, r, [0.85, 0.78, 0.55], 0.07); }
function paintSnow(g, r) { noiseFill(g, r, [0.92, 0.93, 0.95], 0.04); }
function paintBedrock(g, r) { noiseFill(g, r, [0.12, 0.12, 0.13], 0.14); }
function paintWater(g) { g.fillStyle = "#4472dd"; g.fillRect(0, 0, 16, 16); }
function paintGlass(g, r) {
  noiseFill(g, r, [0.78, 0.88, 0.92], 0.05);
  g.fillStyle = "rgba(255,255,255,0.9)";
  g.fillRect(2, 2, 4, 1); g.fillRect(2, 2, 1, 4); // shine corner
  g.fillStyle = "rgba(120,150,170,0.9)";
  g.fillRect(0, 0, 16, 1); g.fillRect(0, 15, 16, 1);
  g.fillRect(0, 0, 1, 16); g.fillRect(15, 0, 1, 16); // frame
}
function paintGoldOre(g, r) { paintStone(g, r); blobs(g, r, "#f4c20d", 6, 2); }
function paintDiamondOre(g, r) { paintStone(g, r); blobs(g, r, "#5ff2e0", 5, 2); }
function paintFence(g, r) {
  noiseFill(g, r, [0.6, 0.43, 0.21], 0.05);
  g.fillStyle = "rgba(35,22,8,0.9)";
  g.fillRect(0, 0, 16, 16); // gaps read as dark (full-cube fence)
  g.fillStyle = "#9c6f34";
  g.fillRect(2, 0, 3, 16); g.fillRect(11, 0, 3, 16); // posts
  g.fillRect(0, 3, 16, 3); g.fillRect(0, 10, 16, 3); // rails
}
function paintBrick(g, r) {
  noiseFill(g, r, [0.55, 0.55, 0.57], 0.05);
  g.fillStyle = "rgba(25,25,28,0.85)";
  for (let y = 0; y < 16; y += 4) g.fillRect(0, y, 16, 1);
  for (let y = 0; y < 16; y += 4) {
    const off = (y / 4) % 2 === 0 ? 0 : 4;
    for (let x = off; x < 16; x += 8) g.fillRect(x, y, 1, 4);
  }
}
function paintLadder(g, r) {
  g.fillStyle = "#3a2c14"; g.fillRect(0, 0, 16, 16);
  noiseFill(g, r, [0.55, 0.4, 0.2], 0.06);
  g.fillStyle = "#8a5f30";
  g.fillRect(1, 0, 3, 16); g.fillRect(12, 0, 3, 16); // rails
  for (let y = 2; y < 16; y += 4) g.fillRect(1, y, 14, 2); // rungs
}
function paintBedSide(g, r) {
  noiseFill(g, r, [0.6, 0.43, 0.21], 0.05);
  g.fillStyle = "#c22f2f"; g.fillRect(0, 0, 16, 6); // blanket over foot
  g.fillStyle = "#e8e8e8"; g.fillRect(0, 6, 16, 3); // sheet
}
function paintBedTop(g, r) {
  noiseFill(g, r, [0.76, 0.18, 0.18], 0.05);
  g.fillStyle = "#e8e8e8"; g.fillRect(0, 10, 16, 6); // pillow end
}
function paintTorchIcon(g, r) {
  g.fillStyle = "#8a5f30"; g.fillRect(7, 6, 2, 10);
  noiseFill(g, r, [1.0, 0.8, 0.3], 0.1);
  g.fillStyle = "#ffcf4d"; g.fillRect(5, 1, 6, 6);
  g.fillStyle = "#fff08a"; g.fillRect(6, 2, 3, 3);
}
function paintSandstone(g, r) {
  noiseFill(g, r, [0.84, 0.76, 0.53], 0.06);
  g.fillStyle = "rgba(120,100,60,0.8)";
  g.fillRect(0, 13, 16, 1); // chisel line near the base
  g.fillStyle = "rgba(255,250,230,0.5)";
  g.fillRect(0, 0, 16, 1); // sun-bleached top edge
}
function paintCactusSide(g, r) {
  noiseFill(g, r, [0.25, 0.55, 0.22], 0.1);
  for (let x = 1; x < 16; x += 4) {
    g.fillStyle = "rgba(15,60,15,0.6)";
    g.fillRect(x, 0, 1, 16); // ribs
  }
  g.fillStyle = "#e8f0d8";
  for (let i = 0; i < 10; i++) {
    g.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1, 1); // spikes
  }
}
function paintCactusTop(g, r) {
  noiseFill(g, r, [0.32, 0.62, 0.28], 0.08);
  g.fillStyle = "rgba(15,60,15,0.7)";
  g.fillRect(0, 0, 16, 1); g.fillRect(0, 15, 16, 1);
  g.fillRect(0, 0, 1, 16); g.fillRect(15, 0, 1, 16);
}
function paintClay(g, r) { noiseFill(g, r, [0.62, 0.65, 0.72], 0.06); }
function paintBrickRed(g, r) {
  noiseFill(g, r, [0.62, 0.25, 0.18], 0.06);
  g.fillStyle = "rgba(220,215,205,0.85)"; // pale mortar
  for (let y = 0; y < 16; y += 4) g.fillRect(0, y, 16, 1);
  for (let y = 0; y < 16; y += 4) {
    const off = (y / 4) % 2 === 0 ? 0 : 4;
    for (let x = off; x < 16; x += 8) g.fillRect(x, y, 1, 4);
  }
}
function paintGravel(g, r) {
  noiseFill(g, r, [0.52, 0.48, 0.44], 0.08);
  const tones = ["#6b625a", "#7a7068", "#57504a", "#8a7f74"];
  for (let i = 0; i < 26; i++) {
    g.fillStyle = tones[Math.floor(r() * tones.length)];
    g.fillRect(Math.floor(r() * 15), Math.floor(r() * 15), 2, 1);
    g.fillRect(Math.floor(r() * 15), Math.floor(r() * 15), 1, 2);
  }
}
function paintPineBark(g, r) {
  noiseFill(g, r, [0.25, 0.17, 0.1], 0.09);
  for (let x = 0; x < 16; x++) {
    if (x % 3 === 0) {
      g.fillStyle = "rgba(15,8,3,0.6)";
      g.fillRect(x, 0, 1, 16);
    }
  }
}
function paintPineRings(g, r) {
  noiseFill(g, r, [0.5, 0.36, 0.2], 0.07);
  g.fillStyle = "rgba(50,32,14,0.75)";
  for (let k = 0; k < 4; k++) {
    const o = k * 2;
    g.fillRect(o, o, 16 - o * 2, 1);
    g.fillRect(o, 15 - o, 16 - o * 2, 1);
    g.fillRect(o, o, 1, 16 - o * 2);
    g.fillRect(15 - o, o, 1, 16 - o * 2);
  }
}
function paintPineLeaves(g, r) {
  noiseFill(g, r, [0.1, 0.32, 0.18], 0.13);
  blobs(g, r, "rgba(6,22,10,0.8)", 14, 1);
}
// --- transparent cross-quad flora: backgrounds stay empty, only pixels drawn
function paintTallGrass(g, r) {
  g.clearRect(0, 0, 16, 16);
  for (let i = 0; i < 9; i++) {
    const x = 1 + Math.floor(r() * 14);
    const h = 5 + Math.floor(r() * 8);
    const v = (r() - 0.5) * 0.12;
    g.fillStyle = `rgb(${conv(0.3 + v)},${conv(0.62 + v)},${conv(0.25 + v)})`;
    g.fillRect(x, 16 - h, 1, h);
    if (r() < 0.5) g.fillRect(x + (r() < 0.5 ? 1 : -1), 16 - h + 2, 1, 3); // bent tip
  }
}
function paintFlower(g, r, head) {
  g.clearRect(0, 0, 16, 16);
  g.fillStyle = "#2f7a24";
  g.fillRect(7, 7, 2, 9); // stem
  g.fillRect(4, 10, 3, 1); g.fillRect(9, 12, 3, 1); // leaves
  g.fillStyle = head;
  g.fillRect(5, 3, 6, 5); // petals
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.fillRect(7, 4, 2, 2); // heart
}
function paintFlowerRed(g, r) { paintFlower(g, r, "#d42a2a"); }
function paintFlowerYellow(g, r) { paintFlower(g, r, "#f2d024"); }
function paintMushroom(g, r, cap, dots) {
  g.clearRect(0, 0, 16, 16);
  g.fillStyle = "#ddd5c2";
  g.fillRect(7, 8, 2, 8); // stem
  g.fillStyle = cap;
  g.fillRect(4, 4, 8, 5); // cap
  g.fillRect(5, 3, 6, 1);
  if (dots) {
    g.fillStyle = "#ffffff";
    g.fillRect(5, 5, 2, 2); g.fillRect(9, 6, 2, 2); g.fillRect(7, 4, 1, 1);
  }
}
function paintMushroomRed(g, r) { paintMushroom(g, r, "#c22f2f", true); }
function paintMushroomBrown(g, r) { paintMushroom(g, r, "#7a5a38", false); }
function paintReeds(g, r) {
  g.clearRect(0, 0, 16, 16);
  for (const x of [4, 8, 11]) {
    const v = (r() - 0.5) * 0.1;
    g.fillStyle = `rgb(${conv(0.42 + v)},${conv(0.68 + v)},${conv(0.3 + v)})`;
    g.fillRect(x, 0, 2, 16);
    g.fillStyle = "rgba(60,90,40,0.9)";
    g.fillRect(x, 4, 2, 1); g.fillRect(x, 10, 2, 1); // joints
  }
}

// Representative face per block for inventory icons (data URLs, cached).
const ICON_PAINT = {
  1: [paintGrassTop, 110], 2: [paintDirt, 12], 3: [paintStone, 13],
  4: [paintSand, 14], 5: [paintRings, 150], 6: [paintLeaves, 16],
  7: [paintPlanks, 17], 8: [paintBedrock, 18], 9: [paintSnow, 19],
  10: [paintWater, 0], 11: [paintCoalOre, 21], 12: [paintIronOre, 22],
  13: [paintTableTop, 230], 14: [paintFurnaceFront, 240],
  15: [paintTorchIcon, 7], 16: [paintCobble, 26], 17: [paintGlass, 27],
  18: [paintGoldOre, 28], 19: [paintDiamondOre, 29], 20: [paintFence, 30],
  21: [paintBrick, 31], 22: [paintLadder, 32], 23: [paintBedTop, 33],
  24: [paintSandstone, 34], 25: [paintCactusSide, 35], 26: [paintClay, 36],
  27: [paintBrickRed, 37], 28: [paintGravel, 38], 29: [paintPineRings, 39],
  30: [paintPineLeaves, 40], 31: [paintTallGrass, 41], 32: [paintFlowerRed, 42],
  33: [paintFlowerYellow, 43], 34: [paintMushroomRed, 44], 35: [paintMushroomBrown, 45],
  36: [paintReeds, 46],
};
const iconCache = new Map();
export function blockIconURL(block) {
  const hit = iconCache.get(block);
  if (hit) return hit;
  const [paint, seed] = ICON_PAINT[block] ?? [paintStone, 1];
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  paint(c.getContext("2d"), rng(seed));
  const url = c.toDataURL();
  iconCache.set(block, url);
  return url;
}

export function makeMaterials() {
  const M = (tex, opts = {}) => new THREE.MeshLambertMaterial({ map: tex, ...opts });
  const dirt = M(makeCanvas(paintDirt, 12));
  const stone = M(makeCanvas(paintStone, 13));
  const planks = M(makeCanvas(paintPlanks, 17));
  const grassSide = M(makeCanvas(paintGrassSide, 11));
  const grassTop = M(makeCanvas(paintGrassTop, 110));
  const bark = M(makeCanvas(paintBark, 15));
  const rings = M(makeCanvas(paintRings, 150));
  const tableSide = M(makeCanvas(paintTableSide, 23));
  const tableTop = M(makeCanvas(paintTableTop, 230));
  const furnace = M(makeCanvas(paintFurnace, 24));
  const furnaceFront = M(makeCanvas(paintFurnaceFront, 240));
  const bedSide = M(makeCanvas(paintBedSide, 34));
  const bedTop = M(makeCanvas(paintBedTop, 33));
  const cactusSide = M(makeCanvas(paintCactusSide, 35));
  const cactusTop = M(makeCanvas(paintCactusTop, 350));
  const pineBark = M(makeCanvas(paintPineBark, 351));
  const pineRings = M(makeCanvas(paintPineRings, 352));
  // cross-quad flora: alpha-tested, double-sided, top-lit via up normals
  const F = (paint, seed) => new THREE.MeshLambertMaterial({
    map: makeCanvas(paint, seed), alphaTest: 0.5, side: THREE.DoubleSide,
  });
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z
  return {
    [B.GRASS]: [grassSide, grassSide, grassTop, dirt, grassSide, grassSide],
    [B.DIRT]: dirt,
    [B.STONE]: stone,
    [B.SAND]: M(makeCanvas(paintSand, 14)),
    [B.LOG]: [bark, bark, rings, rings, bark, bark],
    [B.LEAVES]: M(makeCanvas(paintLeaves, 16)),
    [B.PLANKS]: planks,
    [B.BEDROCK]: M(makeCanvas(paintBedrock, 18)),
    [B.SNOW]: M(makeCanvas(paintSnow, 19)),
    [B.WATER]: new THREE.MeshLambertMaterial({ color: 0x3355dd, transparent: true, opacity: 0.7 }),
    [B.COAL_ORE]: M(makeCanvas(paintCoalOre, 21)),
    [B.IRON_ORE]: M(makeCanvas(paintIronOre, 22)),
    [B.CRAFT_TABLE]: [tableSide, tableSide, tableTop, planks, tableSide, tableSide],
    [B.FURNACE]: [furnace, furnace, stone, stone, furnaceFront, furnace],
    [B.TORCH]: new THREE.MeshLambertMaterial({ color: 0xffd97a, emissive: 0xff9a1f, emissiveIntensity: 1.6 }),
    [B.COBBLE]: M(makeCanvas(paintCobble, 26)),
    [B.GLASS]: M(makeCanvas(paintGlass, 27), { transparent: true, opacity: 0.85 }),
    [B.GOLD_ORE]: M(makeCanvas(paintGoldOre, 28)),
    [B.DIAMOND_ORE]: M(makeCanvas(paintDiamondOre, 29)),
    [B.FENCE]: M(makeCanvas(paintFence, 30)),
    [B.STONE_BRICK]: M(makeCanvas(paintBrick, 31)),
    [B.LADDER]: M(makeCanvas(paintLadder, 32)),
    [B.BED]: [bedSide, bedSide, bedTop, planks, bedSide, bedSide],
    [B.SANDSTONE]: M(makeCanvas(paintSandstone, 34)),
    [B.CACTUS]: [cactusSide, cactusSide, cactusTop, cactusTop, cactusSide, cactusSide],
    [B.CLAY]: M(makeCanvas(paintClay, 36)),
    [B.BRICK]: M(makeCanvas(paintBrickRed, 37)),
    [B.GRAVEL]: M(makeCanvas(paintGravel, 38)),
    [B.PINE_LOG]: [pineBark, pineBark, pineRings, pineRings, pineBark, pineBark],
    [B.PINE_LEAVES]: M(makeCanvas(paintPineLeaves, 40)),
    [B.TALL_GRASS]: F(paintTallGrass, 41),
    [B.FLOWER_RED]: F(paintFlowerRed, 42),
    [B.FLOWER_YELLOW]: F(paintFlowerYellow, 43),
    [B.MUSHROOM_RED]: F(paintMushroomRed, 44),
    [B.MUSHROOM_BROWN]: F(paintMushroomBrown, 45),
    [B.REEDS]: F(paintReeds, 46),
  };
}

// Two intersecting vertical quads (X shape from above) for flora.
// Base sits at y=0 of the block cell; normals point up so sun lights them
// like grass tops. UVs map the full 16x16 sprite onto each quad.
function makeCrossGeometry() {
  const g = new THREE.BufferGeometry();
  const v = new Float32Array([
    -0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0, // X-facing quad
    0, 0, -0.5, 0, 0, 0.5, 0, 1, 0.5, 0, 1, -0.5, // Z-facing quad
  ]);
  const n = new Float32Array([
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
  ]);
  const uv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1]);
  g.setAttribute("position", new THREE.BufferAttribute(v, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(n, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  return g;
}

export class WorldClient {
  constructor(scene, materials) {
    this.scene = scene;
    this.materials = materials;
    this.chunks = new Map(); // "cx,cz" -> Uint8Array
    this.meshes = new Map(); // "cx,cz" -> THREE.Group
    this.torches = new Map(); // "cx,cz" -> [[x,y,z],...] for light pooling
    this.geo = new THREE.BoxGeometry(1, 1, 1);
    this.crossGeo = makeCrossGeometry();
    this.dummy = new THREE.Object3D();
    this.shadeColor = new THREE.Color();
  }

  static idx(x, y, z) { return (y * CHUNK + z) * CHUNK + x; }

  setChunk(cx, cz, data) {
    this.chunks.set(`${cx},${cz}`, data);
    this.remesh(cx, cz);
    // remesh neighbours so border faces update
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (this.chunks.has(`${cx + dx},${cz + dz}`)) this.remesh(cx + dx, cz + dz);
    }
  }

  /** Drop a far-away chunk (frees meshes + data). Remaining neighbours remesh. */
  dropChunk(cx, cz) {
    const key = `${cx},${cz}`;
    const old = this.meshes.get(key);
    if (old) {
      this.scene.remove(old);
      old.children.forEach((m) => m.dispose?.());
      this.meshes.delete(key);
    }
    this.chunks.delete(key);
    this.torches.delete(key);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (this.chunks.has(`${cx + dx},${cz + dz}`)) this.remesh(cx + dx, cz + dz);
    }
  }

  get(x, y, z) {
    x = Math.round(x); y = Math.round(y); z = Math.round(z);
    if (y < 0 || y >= WORLD_H) return B.AIR;
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const c = this.chunks.get(`${cx},${cz}`);
    if (!c) return undefined; // unknown
    return c[WorldClient.idx(x - cx * CHUNK, y, z - cz * CHUNK)];
  }

  setLocal(x, y, z, v) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const c = this.chunks.get(`${cx},${cz}`);
    if (!c) return;
    const lx = x - cx * CHUNK, lz = z - cz * CHUNK;
    c[WorldClient.idx(lx, y, lz)] = v;
    this.remesh(cx, cz);
    // edits near a chunk border change face-culling AND baked torchlight halo
    // (HALO=4) in the neighbour's mesh too
    if (lx < 5) this.remesh(cx - 1, cz);
    if (lx >= CHUNK - 5) this.remesh(cx + 1, cz);
    if (lz < 5) this.remesh(cx, cz - 1);
    if (lz >= CHUNK - 5) this.remesh(cx, cz + 1);
  }

  remesh(cx, cz) {
    const key = `${cx},${cz}`;
    const data = this.chunks.get(key);
    if (!data) return;
    const old = this.meshes.get(key);
    if (old) {
      this.scene.remove(old);
      old.children.forEach((m) => m.dispose?.());
    }
    const group = new THREE.Group();
    const byType = new Map();
    const torchList = [];
    const getL = (x, y, z) => {
      if (y < 0 || y >= WORLD_H) return B.AIR;
      // local fast path
      const lx = x - cx * CHUNK, lz = z - cz * CHUNK;
      if (lx >= 0 && lx < CHUNK && lz >= 0 && lz < CHUNK) return data[WorldClient.idx(lx, y, lz)];
      const o = this.get(x, y, z);
      return o === undefined ? B.STONE : o; // treat unknown as opaque to avoid holes
    };
    const passable = (b) => b === B.GLASS || !OPAQUE.has(b);
    // ---- baked torchlight: flood-fill through air (Minecraft-style) ----
    // expanded volume so light bleeds correctly across chunk borders
    const HALO = 4, EW = CHUNK + HALO * 2;
    const eIdx = (ex, y, ez) => (y * EW + ez) * EW + ex;
    const light = new Uint8Array(EW * WORLD_H * EW);
    const occ = new Uint8Array(EW * WORLD_H * EW); // 1 = blocks light
    const queue = []; // growable: dense torch builds re-enqueue cells often
    let qh = 0;
    for (let ey = 0; ey < WORLD_H; ey++) {
      for (let eez = 0; eez < EW; eez++) {
        for (let eex = 0; eex < EW; eex++) {
          const wx = cx * CHUNK + eex - HALO, wz = cz * CHUNK + eez - HALO;
          const b = getL(wx, ey, wz);
          const ei = eIdx(eex, ey, eez);
          if (!passable(b)) occ[ei] = 1;
          if (b === B.TORCH) {
            light[ei] = 14;
            queue.push(ei);
          }
        }
      }
    }
    const exOf = (ei) => ei % EW;
    const ezOf = (ei) => Math.floor(ei / EW) % EW;
    const eyOf = (ei) => Math.floor(ei / (EW * EW));
    while (qh < queue.length) {
      const cur = queue[qh++];
      const lv = light[cur];
      if (lv <= 1) continue;
      const nl = lv - 1;
      const cex = exOf(cur), cey = eyOf(cur), cez = ezOf(cur);
      // 6 neighbours
      if (cex > 0) {
        const n = cur - 1;
        if (!occ[n] && light[n] < nl) {
          // water dims light faster
          const wx = cx * CHUNK + (cex - 1) - HALO, wz = cz * CHUNK + cez - HALO;
          const extra = getL(wx, cey, wz) === B.WATER ? 1 : 0;
          const fl = nl - extra;
          if (fl > 0 && light[n] < fl) { light[n] = fl; queue.push(n); }
        }
      }
      if (cex < EW - 1) {
        const n = cur + 1;
        if (!occ[n] && light[n] < nl) {
          const wx = cx * CHUNK + (cex + 1) - HALO, wz = cz * CHUNK + cez - HALO;
          const extra = getL(wx, cey, wz) === B.WATER ? 1 : 0;
          const fl = nl - extra;
          if (fl > 0 && light[n] < fl) { light[n] = fl; queue.push(n); }
        }
      }
      if (cez > 0) {
        const n = cur - EW;
        if (!occ[n] && light[n] < nl) {
          const wx = cx * CHUNK + cex - HALO, wz = cz * CHUNK + (cez - 1) - HALO;
          const extra = getL(wx, cey, wz) === B.WATER ? 1 : 0;
          const fl = nl - extra;
          if (fl > 0 && light[n] < fl) { light[n] = fl; queue.push(n); }
        }
      }
      if (cez < EW - 1) {
        const n = cur + EW;
        if (!occ[n] && light[n] < nl) {
          const wx = cx * CHUNK + cex - HALO, wz = cz * CHUNK + (cez + 1) - HALO;
          const extra = getL(wx, cey, wz) === B.WATER ? 1 : 0;
          const fl = nl - extra;
          if (fl > 0 && light[n] < fl) { light[n] = fl; queue.push(n); }
        }
      }
      if (cey > 0) {
        const n = cur - EW * EW;
        if (!occ[n] && light[n] < nl) {
          const wx = cx * CHUNK + cex - HALO, wz = cz * CHUNK + cez - HALO;
          const extra = getL(wx, cey - 1, wz) === B.WATER ? 1 : 0;
          const fl = nl - extra;
          if (fl > 0 && light[n] < fl) { light[n] = fl; queue.push(n); }
        }
      }
      if (cey < WORLD_H - 1) {
        const n = cur + EW * EW;
        if (!occ[n] && light[n] < nl) {
          const wx = cx * CHUNK + cex - HALO, wz = cz * CHUNK + cez - HALO;
          const extra = getL(wx, cey + 1, wz) === B.WATER ? 1 : 0;
          const fl = nl - extra;
          if (fl > 0 && light[n] < fl) { light[n] = fl; queue.push(n); }
        }
      }
    }
    const lightAt = (wx, y, wz) => {
      const eex = wx - cx * CHUNK + HALO, eez = wz - cz * CHUNK + HALO;
      if (eex < 0 || eex >= EW || eez < 0 || eez >= EW || y < 0 || y >= WORLD_H) return 0;
      return light[eIdx(eex, y, eez)];
    };
    // NOTE: no per-column sky table — sky is decided per block below from
    // the cell directly above it (open air => full bright, roofed => depth
    // shade). A column scan can't work: the surface block itself is opaque,
    // so every land column would read "roofed" and the whole overworld
    // would render at cave shade.
    for (let y = 0; y < WORLD_H; y++) {
      for (let z = 0; z < CHUNK; z++) {
        for (let x = 0; x < CHUNK; x++) {
          const b = data[WorldClient.idx(x, y, z)];
          if (b === B.AIR) continue;
          const wx = cx * CHUNK + x, wz = cz * CHUNK + z;
          // face culling: skip if fully buried
          if (OPAQUE.has(b)) {
            if (
              OPAQUE.has(getL(wx + 1, y, wz)) && OPAQUE.has(getL(wx - 1, y, wz)) &&
              OPAQUE.has(getL(wx, y + 1, wz)) && OPAQUE.has(getL(wx, y - 1, wz)) &&
              OPAQUE.has(getL(wx, y, wz + 1)) && OPAQUE.has(getL(wx, y, wz - 1))
            ) continue;
          } else if (b === B.WATER) {
            const up = getL(wx, y + 1, wz);
            if (up === B.WATER) continue; // hide submerged water sides (approx via full-cube skip)
          }
          if (!byType.has(b)) byType.set(b, []);
          byType.get(b).push([wx, y, wz]);
          if (b === B.TORCH) torchList.push([wx + 0.5, y + 0.6, wz + 0.5]);
        }
      }
    }
    for (const [b, list] of byType) {
      const mat = this.materials[b];
      if (!mat) continue;
      const isPlant = PLANTS.has(b);
      const mesh = new THREE.InstancedMesh(isPlant ? this.crossGeo : this.geo, mat, list.length);
      list.forEach(([wx, y, wz], i) => {
        if (isPlant) {
          // cross quads stand on the block floor, full height
          this.dummy.position.set(wx + 0.5, y, wz + 0.5);
          this.dummy.scale.set(1, 1, 1);
        } else {
          this.dummy.position.set(wx + 0.5, y + 0.5, wz + 0.5);
          if (b === B.TORCH) this.dummy.scale.set(0.25, 0.6, 0.25);
          else this.dummy.scale.set(1, 1, 1);
          if (b === B.WATER) this.dummy.position.y -= 0.12;
        }
        this.dummy.updateMatrix();
        mesh.setMatrixAt(i, this.dummy.matrix);
        // lighting: open sky above => full bright, roofed blocks fall off
        // toward ~8% by y=4 so caves stay dark (values are linear; the
        // renderer re-encodes to sRGB). Baked torch flood-fill wins near
        // flames and tints warm orange.
        if (b === B.TORCH) {
          mesh.setColorAt(i, this.shadeColor.setRGB(1, 1, 1));
        } else {
          let tl;
          if (!OPAQUE.has(b) || b === B.GLASS) {
            tl = lightAt(wx, y, wz); // transparent: its own cell
          } else {
            tl = Math.max(
              lightAt(wx + 1, y, wz), lightAt(wx - 1, y, wz),
              lightAt(wx, y + 1, wz), lightAt(wx, y - 1, wz),
              lightAt(wx, y, wz + 1), lightAt(wx, y, wz - 1),
            );
          }
          const t = tl / 14;
          const depthShade = Math.min(1, 0.08 + 0.92 * Math.max(0, (y - 4) / 20));
          // sky above? the cell overhead decides: open air (and not water)
          // => full bright surface; anything roofed falls to depth shade so
          // caves, mine tunnels and canopy floors stay dark.
          const above = getL(wx, y + 1, wz);
          const sky = (!OPAQUE.has(above) && above !== B.WATER) ? 1 : depthShade;
          const bright = Math.max(sky, Math.min(1, 0.08 + t * 0.9));
          if (t > 0.01) {
            mesh.setColorAt(i, this.shadeColor.setRGB(
              Math.min(1, bright + t * 0.16),
              Math.min(1, bright + t * 0.05),
              Math.max(0, bright - t * 0.1),
            ));
          } else {
            mesh.setColorAt(i, this.shadeColor.setRGB(bright, bright, bright));
          }
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = !isPlant; // alpha-tested quads would speckle the shadow map
      mesh.receiveShadow = true;
      this.dummy.scale.set(1, 1, 1);
      group.add(mesh);
    }
    this.scene.add(group);
    this.meshes.set(key, group);
    this.torches.set(key, torchList);
  }

  /** Subtle ambient animation: water opacity pulse + torch glow flicker. */
  tickAnim(timeMs) {
    const t = timeMs / 1000;
    const water = this.materials[B.WATER];
    if (water) water.opacity = 0.62 + 0.08 * Math.sin(t * 1.6);
    const torch = this.materials[B.TORCH];
    if (torch) torch.emissiveIntensity = 1.6 + 0.35 * Math.sin(t * 7.3) + 0.12 * Math.sin(t * 13.7);
  }

  /** Nearest torch positions to p ( block coords ), up to `n` within `maxDist`. */
  nearestTorches(p, n, maxDist) {    const scored = [];
    for (const list of this.torches.values()) {
      for (const t of list) {
        const d2 = (t[0] - p.x) ** 2 + (t[1] - p.y) ** 2 + (t[2] - p.z) ** 2;
        if (d2 < maxDist * maxDist) scored.push([d2, t]);
      }
    }
    scored.sort((a, b) => a[0] - b[0]);
    return scored.slice(0, n).map((s) => s[1]);
  }

  hasBlockNear(x, y, z, block, r) {
    const xi = Math.round(x), yi = Math.round(y), zi = Math.round(z);
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dz = -r; dz <= r; dz++) {
          if (this.get(xi + dx, yi + dy, zi + dz) === block) return true;
        }
      }
    }
    return false;
  }

  /** Voxel DDA raycast. Returns {x,y,z,nx,ny,nz,block} or null. */
  raycast(origin, dir, maxDist) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = Math.sign(dir.x), stepY = Math.sign(dir.y), stepZ = Math.sign(dir.z);
    const tDeltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity;
    const fx = origin.x - x, fy = origin.y - y, fz = origin.z - z;
    let tMaxX = stepX !== 0 ? (stepX > 0 ? (1 - fx) : fx) * tDeltaX : Infinity;
    let tMaxY = stepY !== 0 ? (stepY > 0 ? (1 - fy) : fy) * tDeltaY : Infinity;
    let tMaxZ = stepZ !== 0 ? (stepZ > 0 ? (1 - fz) : fz) * tDeltaZ : Infinity;
    let nx = 0, ny = 0, nz = 0, t = 0;
    for (let i = 0; i < 128; i++) {
      const b = this.get(x, y, z);
      if (b !== undefined && b !== B.AIR && b !== B.WATER) {
        if (t > 0) return { x, y, z, nx, ny, nz, block: b };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0; }
      else if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0; }
      else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ; }
      if (t > maxDist) return null;
    }
    return null;
  }
}
