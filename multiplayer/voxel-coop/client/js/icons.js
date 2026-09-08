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

const PAINTERS = {
  101: paintStick, 102: paintCoal, 103: paintIngot, 104: paintPork,
  105: paintWool, 106: paintFeather,
  108: (g) => paintPick(g, "#a0713d"), 109: (g) => paintPick(g, "#888888"),
  110: (g) => paintPick(g, "#d8d8dc"),
  111: (g) => paintSword(g, "#a0713d"), 113: (g) => paintSword(g, "#888888"),
};

export function itemIconURL(id) {
  if (!id) return "";
  if (id >= 1 && id <= 16) return blockIconURL(id);
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
