// HUD + menus: hotbar, inventory, crafting grid, chat, vitals, connect menu.
import { BLOCK_NAME } from "./config.js";

const ICON_COLOR = {
  1: "#55aa35", 2: "#7a5230", 3: "#888", 4: "#e3d79b", 5: "#5a3a1a",
  6: "#2c7a2c", 7: "#a0713d", 8: "#222", 9: "#f4f6f8", 10: "#4472dd",
  11: "#555", 12: "#b08a6a", 13: "#8a5a20", 14: "#555558", 15: "#ffcf4d",
  16: "#777", 101: "#8a5f30", 102: "#1a1a1a", 103: "#e8e8e8", 104: "#f0a0a0",
  105: "#eee", 106: "#fff", 108: "#a0713d", 109: "#888", 110: "#e8e8e8",
  111: "#a0713d", 113: "#888",
};

export function iconFor(id) {
  if (!id) return null;
  const color = ICON_COLOR[id] ?? "#f0f";
  const name = BLOCK_NAME[id] ?? `?${id}`;
  return { color, name };
}

export class UI {
  constructor() {
    this.el = (id) => document.getElementById(id);
    this.hotbarSel = 0;
    this.slots = [];
    this.gridCells = Array.from({ length: 9 }, () => ({ id: 0, n: 0 }));
    this.gridResult = { id: 0, n: 0 };
    this.invOpen = false;
    this.swapIdx = null;
    this.nearTable = false;
    this.onGridPut = null;
    this.onGridTake = null;
    this.onCraftTake = null;
    this.onChat = null;
    this.onRespawn = null;
    this.onEat = null;
    this.onMoveItem = null;
    this.buildSlots();
    this.bindKeys();
  }

  buildSlots() {
    const hb = this.el("hotbar");
    hb.innerHTML = "";
    for (let i = 0; i < 9; i++) {
      const d = document.createElement("div");
      d.className = "slot";
      d.dataset.i = i;
      d.addEventListener("click", () => { this.hotbarSel = i; this.renderHotbar(); });
      hb.appendChild(d);
    }
    const inv = this.el("inv-grid");
    inv.innerHTML = "";
    for (let i = 0; i < 36; i++) {
      const d = document.createElement("div");
      d.className = "slot";
      d.dataset.i = i;
      d.addEventListener("click", () => this.clickInv(i));
      inv.appendChild(d);
    }
    const rb = this.el("craft-grid");
    rb.innerHTML = "";
    for (let g = 0; g < 9; g++) {
      const d = document.createElement("div");
      d.className = "slot";
      d.dataset.g = g;
      d.addEventListener("click", (e) => this.clickGrid(g, e.shiftKey));
      rb.appendChild(d);
    }
    rb.classList.add("small");
    this.el("craft-result").addEventListener("click", () => {
      if (this.gridResult?.id) this.onCraftTake?.();
    });
  }

  clickInv(i) {
    if (this.swapIdx === null) {
      if (this.slots[i]?.id) { this.swapIdx = i; this.renderInv(); }
    } else if (this.swapIdx === i) {
      this.swapIdx = null;
      this.renderInv();
    } else {
      // second, different slot: swap them (inventory management)
      this.onMoveItem?.(this.swapIdx, i);
      this.swapIdx = null;
      this.renderInv();
    }
  }

  clickGrid(g, all) {
    if (this.swapIdx !== null) {
      // deposit from selected inventory slot (click = 1, shift-click = stack)
      this.onGridPut?.(this.swapIdx, g, all);
    } else {
      // take back into inventory
      this.onGridTake?.(g);
    }
  }

  bindKeys() {
    document.addEventListener("keydown", (e) => {
      if (e.code.startsWith("Digit")) {
        const n = Number(e.code.slice(5));
        if (n >= 1 && n <= 9) { this.hotbarSel = n - 1; this.renderHotbar(); }
      }
      if (e.code === "KeyE" && !this.chatFocused()) this.toggleInv();
      if (e.code === "KeyH" && !this.chatFocused()) this.toggleHelp();
      if (e.code === "KeyG") {
        const s = this.slots[this.hotbarSel];
        if (s?.id === 104) this.onEat?.(this.hotbarSel);
      }
    });
    this.el("chat-input").addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter" && e.target.value.trim()) {
        this.onChat?.(e.target.value.trim().slice(0, 200));
        e.target.value = "";
        e.target.blur();
      }
    });
  }

  chatFocused() {
    return document.activeElement === this.el("chat-input");
  }

  toggleInv(force) {
    this.invOpen = force ?? !this.invOpen;
    this.el("inventory").style.display = this.invOpen ? "flex" : "none";
    if (this.invOpen) { this.renderInv(); this.renderGrid(); }
    if (!this.invOpen && document.pointerLockElement) document.exitPointerLock?.();
  }

  toggleHelp(force) {
    const h = this.el("help");
    const show = force ?? h.style.display === "none";
    h.style.display = show ? "flex" : "none";
    if (show) {
      try { localStorage.setItem("voxelcoop.helpSeen", "1"); } catch { /* noop */ }
      if (document.pointerLockElement) document.exitPointerLock?.();
    }
  }

  maybeShowHelp() {
    let seen = null;
    try { seen = localStorage.getItem("voxelcoop.helpSeen"); } catch { /* noop */ }
    if (!seen) this.toggleHelp(true);
  }

  setSlots(slots) {
    this.slots = slots;
    this.renderHotbar();
    if (this.invOpen) this.renderInv();
  }

  heldItem() {
    return this.slots[this.hotbarSel];
  }

  slotHTML(s) {
    if (!s?.id) return "";
    const ic = iconFor(s.id);
    return `<div class="icon" style="background:${ic.color}"></div>
      <span class="cnt">${s.n > 1 ? s.n : ""}</span>
      <span class="nm">${ic.name}</span>`;
  }

  renderHotbar() {
    const kids = this.el("hotbar").children;
    for (let i = 0; i < 9; i++) {
      kids[i].innerHTML = this.slotHTML(this.slots[i]);
      kids[i].classList.toggle("sel", i === this.hotbarSel);
    }
  }

  renderInv() {
    const kids = this.el("inv-grid").children;
    for (let i = 0; i < 36; i++) {
      kids[i].innerHTML = this.slotHTML(this.slots[i]);
      kids[i].classList.toggle("swap", i === this.swapIdx);
    }
  }

  setGrid(cells, result) {
    this.gridCells = cells;
    this.gridResult = result;
    if (this.invOpen) this.renderGrid();
  }

  renderGrid() {
    const kids = this.el("craft-grid").children;
    for (let g = 0; g < 9; g++) {
      kids[g].innerHTML = this.slotHTML(this.gridCells[g]);
      kids[g].classList.toggle("sel", false);
    }
    this.el("craft-result").innerHTML = this.slotHTML(this.gridResult);
    this.el("craft-result").style.opacity = this.gridResult?.id ? "1" : "0.35";
  }

  setNearTable(v) {
    if (v === this.nearTable) return;
    this.nearTable = v;
    this.el("craft-grid").classList.toggle("small", !v);
    this.el("craft-title").innerHTML = v
      ? `Crafting table (3×3) <small>(click item, then grid · shift-click = whole stack)</small>`
      : `Crafting (2×2) <small>(stand near a table for 3×3)</small>`;
    if (this.invOpen) this.renderGrid();
  }

  setVitals(hp, maxHp, hunger, dead) {
    const hearts = "❤".repeat(Math.max(0, Math.ceil(hp / 2))) + "🖤".repeat(Math.max(0, Math.ceil((maxHp - hp) / 2)));
    const drum = "🍖".repeat(Math.ceil(hunger / 2));
    this.el("vitals").innerHTML =
      `<span class="hp">${hearts || "💀"}</span><span class="hunger">${drum}</span>`;
    this.el("dead").style.display = dead ? "flex" : "none";
  }

  chatMsg(from, msg) {
    const log = this.el("chat-log");
    const d = document.createElement("div");
    d.innerHTML = `<b></b><span></span>`;
    d.children[0].textContent = from + ": ";
    d.children[1].textContent = msg;
    log.appendChild(d);
    while (log.children.length > 40) log.removeChild(log.firstChild);
  }

  status(t) { this.el("status").textContent = t; }
  hint(t) { this.el("hint").textContent = t; }

  breakProgress(fracOrNull) {
    const b = this.el("breakbar");
    if (fracOrNull === null) { b.style.display = "none"; return; }
    b.style.display = "block";
    b.firstElementChild.style.width = `${Math.min(100, fracOrNull * 100)}%`;
  }
}
