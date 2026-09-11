// Top-down minimap: reads cached chunk voxels straight from WorldClient.
// North = -z up. Player arrow, mobs (red), other players (cyan), spawn (green).
import { B, WORLD_H } from "./config.js";

const COLOR = {
  1: "#5cb84a", 2: "#7a5230", 3: "#808080", 4: "#d9c78c", 5: "#5a3a1a",
  6: "#2f7a24", 7: "#9c6f34", 8: "#1e1e1e", 9: "#eef2f5", 10: "#3355dd",
  11: "#555555", 12: "#c08a5a", 13: "#8a5a20", 14: "#6b6b6e", 15: "#ffcf4d",
  16: "#737373", 17: "#cfe4ec", 18: "#f4c20d", 19: "#5ff2e0", 20: "#9c6f34",
  21: "#8c8c90", 22: "#8a5f30", 23: "#c22f2f", 24: "#d6c48c", 25: "#3f8f38",
  26: "#9ea6b5", 27: "#9e4030", 28: "#857c72", 29: "#4a2f16", 30: "#1a5230",
  37: "#c22f2f", 38: "#241a3f", 39: "#ffe9a8",
};

export class Minimap {
  constructor(size = 132, range = 40) {
    this.size = size;
    this.range = range;
    this.cv = document.getElementById("minimap");
    this.on = true;
    try {
      const saved = localStorage.getItem("voxelcoop.minimap");
      if (saved === "0") this.on = false;
    } catch { /* noop */ }
    this.applyVis();
  }
  toggle() {
    this.on = !this.on;
    try { localStorage.setItem("voxelcoop.minimap", this.on ? "1" : "0"); } catch { /* noop */ }
    this.applyVis();
    return this.on;
  }
  applyVis() {
    if (this.cv) this.cv.style.display = this.on ? "block" : "none";
  }
  draw(world, player, entities, spawnPos, night) {
    if (!this.on || !this.cv || !world) return;
    const g = this.cv.getContext("2d");
    const S = this.size, R = this.range;
    const px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z);
    g.fillStyle = night ? "#0a0f1e" : "#06121f";
    g.fillRect(0, 0, S, S);
    const cell = S / (R * 2 + 1);
    for (let dx = -R; dx <= R; dx++) {
      for (let dz = -R; dz <= R; dz++) {
        const x = px + dx, z = pz + dz;
        let col = "#000";
        for (let y = WORLD_H - 1; y >= 0; y--) {
          const b = world.get(x, y, z);
          if (b === undefined) { col = "#111"; break; } // unloaded
          if (b === B.AIR) continue;
          if (b === B.WATER) { col = COLOR[10]; break; }
          col = COLOR[b] ?? "#888";
          break;
        }
        g.fillStyle = col;
        g.fillRect((dx + R) * cell, (dz + R) * cell, cell + 0.5, cell + 0.5);
      }
    }
    const dot = (wx, wz, color, r = 2.5) => {
      const dx = wx - player.pos.x, dz = wz - player.pos.z;
      if (Math.abs(dx) > R || Math.abs(dz) > R) return;
      g.fillStyle = color;
      g.beginPath();
      g.arc(S / 2 + dx * cell, S / 2 + dz * cell, r, 0, 7);
      g.fill();
    };
    if (spawnPos) dot(spawnPos[0], spawnPos[2], "#44dd44", 3);
    if (entities) {
      for (const [, e] of entities.mobs ?? []) {
        if (e.node) dot(e.node.position.x, e.node.position.z, "#ff4444", 2);
      }
      for (const [, e] of entities.remotes ?? []) {
        if (e.group) dot(e.group.position.x, e.group.position.z, "#44ddff", 3);
      }
    }
    // player arrow (yaw)
    g.save();
    g.translate(S / 2, S / 2);
    g.rotate(-player.yaw);
    g.fillStyle = "#ffe14d";
    g.beginPath();
    g.moveTo(0, -6); g.lineTo(4, 4); g.lineTo(-4, 4);
    g.closePath(); g.fill();
    g.restore();
    // rain ring
    if (night) {
      g.strokeStyle = "rgba(120,140,200,0.35)";
      g.strokeRect(1, 1, S - 2, S - 2);
    }
  }
}
