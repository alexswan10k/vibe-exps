// Pixel-art icons for non-block items (blocks reuse their textures via world.js).
import { blockIconURL } from "./world.js";

const cache = new Map();

function cv() {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  return [c, c.getContext("2d")];
}
function R(g, x, y, w, h, color) { g.fillStyle = color; g.fillRect(x, y, w, h); }
function diag(g, x0, y0, len, w, color) {
  g.fillStyle = color;
  for (let i = 0; i < len; i++) g.fillRect(x0 + i, y0 + i, w, w);
}

function paintStick(g) { diag(g, 3, 3, 10, 2, "#8a5f30"); diag(g, 3, 3, 10, 1, "#a97c46"); }
function paintCoal(g) { R(g, 4, 5, 8, 7, "#141414"); R(g, 5, 4, 6, 9, "#1e1e1e"); R(g, 5, 5, 2, 2, "#3a3a3a"); }
function paintIngot(g) {
  R(g, 3, 6, 10, 5, "#d8d8dc"); R(g, 3, 6, 10, 1, "#ffffff");
  R(g, 3, 10, 10, 1, "#9a9aa0"); R(g, 4, 4, 8, 2, "#c4c4c8");
}
function paintPork(g) {
  R(g, 3, 5, 10, 7, "#e08a8a"); R(g, 3, 5, 10, 2, "#f0b0b0"); R(g, 3, 10, 10, 2, "#c06a6a");
}
function paintBeef(g) {
  R(g, 3, 5, 10, 7, "#a83232"); R(g, 3, 5, 10, 2, "#c85858"); R(g, 3, 10, 10, 2, "#7a2020");
  R(g, 5, 6, 3, 3, "#e8c8c8");
}
function paintSteak(g) {
  R(g, 3, 5, 10, 7, "#6b3a20"); R(g, 3, 5, 10, 2, "#8a5028");
  R(g, 3, 5, 10, 1, "#3a2010"); R(g, 3, 11, 10, 1, "#3a2010");
  R(g, 4, 6, 4, 2, "#a87038"); // sear marks
}
function paintRawChicken(g) {
  R(g, 4, 4, 7, 9, "#e8b8a8"); R(g, 4, 4, 7, 2, "#f4d0c0");
  R(g, 10, 2, 3, 4, "#f4f4f4"); R(g, 4, 11, 7, 2, "#c89888"); // drumstick bone
}
function paintCookedChicken(g) {
  R(g, 4, 4, 7, 9, "#b8722e"); R(g, 4, 4, 7, 2, "#d89a4e");
  R(g, 10, 2, 3, 4, "#f4f4f4"); R(g, 4, 11, 7, 2, "#7a4a1a");
}
function paintGoldenApple(g) {
  R(g, 4, 5, 8, 9, "#f4c20d"); R(g, 4, 5, 8, 2, "#ffe27a");
  R(g, 4, 12, 8, 2, "#a8800a"); R(g, 5, 6, 2, 4, "#fff2b0");
  R(g, 7, 2, 2, 3, "#6b4423"); R(g, 9, 2, 4, 2, "#3fa34d");
}
function paintGoldIngot(g) {
  R(g, 3, 6, 10, 5, "#f4c20d"); R(g, 3, 6, 10, 1, "#ffe27a");
  R(g, 3, 10, 10, 1, "#a8800a"); R(g, 4, 4, 8, 2, "#e0aa10");
}
function paintDiamond(g) {
  R(g, 5, 2, 6, 12, "#5ff2e0"); R(g, 5, 2, 6, 2, "#d0fff8");
  R(g, 3, 5, 10, 4, "#3ed0c0"); R(g, 5, 9, 6, 5, "#2aa898");
  R(g, 6, 5, 2, 3, "#ffffff");
}
function paintCookedPork(g) {
  R(g, 3, 5, 10, 7, "#a85838"); R(g, 3, 5, 10, 2, "#c07850");
  R(g, 3, 5, 10, 1, "#6b3a20"); R(g, 3, 11, 10, 1, "#6b3a20");
  R(g, 3, 5, 1, 7, "#6b3a20"); R(g, 12, 5, 1, 7, "#6b3a20"); // browned edges
}
function paintApple(g) {
  R(g, 4, 5, 8, 9, "#d42a2a"); R(g, 4, 5, 8, 2, "#ef6a5a");
  R(g, 4, 12, 8, 2, "#8f1616"); R(g, 5, 6, 2, 4, "#f49a8a");
  R(g, 7, 2, 2, 3, "#6b4423"); R(g, 9, 2, 4, 2, "#3fa34d"); // stem + leaf
}
function paintWool(g) {
  R(g, 3, 4, 10, 9, "#e8e8e8");
  R(g, 4, 5, 2, 2, "#ffffff"); R(g, 9, 8, 2, 2, "#cfcfcf"); R(g, 6, 9, 3, 2, "#ffffff");
}
function paintFeather(g) { diag(g, 3, 12, 9, 1, "#cccccc"); diag(g, 5, 4, 6, 3, "#f4f4f4"); R(g, 10, 2, 3, 3, "#ffffff"); }

function paintHandle(g) { diag(g, 3, 12, 9, 2, "#8a5f30"); }
function paintPick(g, head) {
  paintHandle(g);
  R(g, 2, 2, 12, 3, head); R(g, 2, 2, 2, 5, head); R(g, 12, 2, 2, 5, head);
  R(g, 2, 2, 12, 1, "#ffffff");
}
function paintSword(g, blade) {
  R(g, 7, 1, 2, 9, blade); R(g, 7, 1, 1, 9, "#ffffff");
  R(g, 4, 10, 8, 2, "#8a5f30"); R(g, 7, 12, 2, 4, "#6b4423");
}
function paintAxe(g, head) {
  paintHandle(g);
  R(g, 3, 1, 8, 6, head); R(g, 3, 1, 8, 1, "#ffffff");
  R(g, 9, 3, 3, 5, head); // beard
}
function paintShovel(g, head) {
  diag(g, 4, 8, 6, 2, "#8a5f30");
  R(g, 8, 1, 4, 6, head); R(g, 8, 1, 1, 6, "#ffffff");
  R(g, 9, 6, 2, 2, head);
}

const PAINTERS = {
  101: paintStick, 102: paintCoal, 103: paintIngot, 104: paintPork,
  105: paintWool, 106: paintFeather, 107: paintCookedPork, 115: paintApple,
  108: (g) => paintPick(g, "#a0713d"), 109: (g) => paintPick(g, "#888888"),
  110: (g) => paintPick(g, "#d8d8dc"),
  111: (g) => paintSword(g, "#a0713d"), 113: (g) => paintSword(g, "#888888"),
  114: (g) => paintSword(g, "#d8d8dc"),
  116: (g) => paintAxe(g, "#a0713d"), 117: (g) => paintAxe(g, "#888888"),
  118: (g) => paintAxe(g, "#d8d8dc"),
  119: (g) => paintShovel(g, "#a0713d"), 120: (g) => paintShovel(g, "#888888"),
  121: (g) => paintShovel(g, "#d8d8dc"),
  122: paintGoldIngot, 123: paintDiamond,
  124: (g) => paintPick(g, "#f4c20d"), 125: (g) => paintSword(g, "#f4c20d"),
  126: (g) => paintPick(g, "#5ff2e0"), 127: (g) => paintSword(g, "#5ff2e0"),
  128: (g) => paintAxe(g, "#f4c20d"), 129: (g) => paintAxe(g, "#5ff2e0"),
  130: (g) => paintShovel(g, "#f4c20d"), 131: (g) => paintShovel(g, "#5ff2e0"),
  132: paintBeef, 133: paintSteak, 134: paintRawChicken, 135: paintCookedChicken,
  136: paintGoldenApple,
};

export function itemIconURL(id) {
  if (!id) return "";
  if (id >= 1 && id <= 36) return blockIconURL(id);
  const hit = cache.get(id);
  if (hit) return hit;
  const paint = PAINTERS[id];
  if (!paint) return "";
  const [c, g] = cv();
  paint(g);
  const url = c.toDataURL();
  cache.set(id, url);
  return url;
}
