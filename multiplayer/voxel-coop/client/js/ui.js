// HUD + menus: hotbar, inventory, crafting grid, recipe book, chat, vitals.
import { BLOCK_NAME } from "./config.js";
import { SHAPED_CLIENT } from "./recipes.js";
import { itemIconURL } from "./icons.js";

export function iconFor(id) {
  if (!id) return null;
  const name = BLOCK_NAME[id] ?? `?${id}`;
  return { img: itemIconURL(id), name };
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
    this.onAutoFill = null;
    this.onChatClosed = null;
    // injected by main.js (needs the player): show/hide the mouse pointer
    this.requestLock = null;
    this.releaseLock = null;
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
    this.buildBook();
  }

  miniHTML(id) {
    if (!id) return `<span></span>`;
    return `<span style="background-image:url(${itemIconURL(id)})"></span>`;
  }

  buildBook() {
    const book = this.el("recipe-book");
    book.innerHTML = "";
    for (const r of SHAPED_CLIENT) {
      const d = document.createElement("div");
      d.className = "book-row";
      d.dataset.id = r.id;
      d.innerHTML = `<div class="mini">${r.pat.map((id) => this.miniHTML(id)).join("")}</div>
        <div class="out" style="background-image:url(${itemIconURL(r.out.id)})"></div>
        <div class="lbl"><b>${r.name}</b><small></small></div>`;
      d.addEventListener("click", () => {
        if (d.classList.contains("ok")) this.onAutoFill?.(r);
      });
      book.appendChild(d);
    }
  }

  renderBook() {
    const counts = {};
    for (const s of this.slots) if (s?.id) counts[s.id] = (counts[s.id] ?? 0) + s.n;
    const need = (r) => {
      const m = {};
      for (const id of r.pat) if (id) m[id] = (m[id] ?? 0) + 1;
      return m;
    };
    for (const d of this.el("recipe-book").children) {
      const r = SHAPED_CLIENT.find((x) => x.id === d.dataset.id);
      const m = need(r);
      const missing = Object.entries(m)
        .filter(([id, n]) => (counts[id] ?? 0) < n)
        .map(([id, n]) => `${BLOCK_NAME[id]}×${n - (counts[id] ?? 0)}`);
      const tableOk = !r.needsTable || this.nearTable;
      const ok = missing.length === 0 && tableOk;
      d.classList.toggle("ok", ok);
      d.querySelector("small").textContent = ok
        ? "click to fill grid"
        : [...(tableOk ? [] : ["needs table nearby"]), ...missing.map((s) => "need " + s)].join(" · ");
    }
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
      if (this.chatFocused()) return;
      if (e.code.startsWith("Digit")) {
        const n = Number(e.code.slice(5));
        if (n >= 1 && n <= 9) { this.hotbarSel = n - 1; this.renderHotbar(); }
      }
      if (e.code === "KeyE") this.toggleInv();
      if (e.code === "KeyH") this.toggleHelp();
      if (e.code === "KeyG") {
        const s = this.slots[this.hotbarSel];
        if (s?.id === 104) this.onEat?.(this.hotbarSel);
      }
    });
    this.el("chat-input").addEventListener("focus", () => this.releaseLock?.());
    this.el("chat-input").addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter" && e.target.value.trim()) {
        this.onChat?.(e.target.value.trim().slice(0, 200));
        e.target.value = "";
        e.target.blur();
        this.onChatClosed?.();
      } else if (e.key === "Escape") {
        e.target.blur();
        this.onChatClosed?.();
      }
    });
  }

  chatFocused() {
    return document.activeElement === this.el("chat-input");
  }

  toggleInv(force) {
    this.invOpen = force ?? !this.invOpen;
    this.el("inventory").style.display = this.invOpen ? "flex" : "none";
    // minecraft rules: opening a GUI frees the mouse, closing re-engages look
    if (this.invOpen) { this.releaseLock?.(); this.renderInv(); this.renderGrid(); this.renderBook(); }
    else this.requestLock?.();
  }

  toggleHelp(force) {
    const h = this.el("help");
    const show = force ?? h.style.display === "none";
    h.style.display = show ? "flex" : "none";
    if (show) {
      try { localStorage.setItem("voxelcoop.helpSeen", "1"); } catch { /* noop */ }
      this.releaseLock?.();
    } else {
      this.requestLock?.();
    }
  }

  helpOpen() {
    return this.el("help").style.display !== "none";
  }

  maybeShowHelp() {
    let seen = null;
    try { seen = localStorage.getItem("voxelcoop.helpSeen"); } catch { /* noop */ }
    if (!seen) this.toggleHelp(true);
  }

  setSlots(slots) {
    this.slots = slots;
    this.renderHotbar();
    if (this.invOpen) { this.renderInv(); this.renderBook(); }
  }

  heldItem() {
    return this.slots[this.hotbarSel];
  }

  slotHTML(s) {
    if (!s?.id) return "";
    const ic = iconFor(s.id);
    const bg = ic.img ? `background-image:url(${ic.img})` : "background:#f0f";
    return `<div class="icon" style="${bg}"></div>
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
    if (this.invOpen) { this.renderGrid(); this.renderBook(); }
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

  pulse() {
    const c = this.el("crosshair");
    c.classList.remove("hit");
    void c.offsetWidth; // restart animation
    c.classList.add("hit");
  }

  breakProgress(fracOrNull) {
    const b = this.el("breakbar");
    if (fracOrNull === null) { b.style.display = "none"; return; }
    b.style.display = "block";
    b.firstElementChild.style.width = `${Math.min(100, fracOrNull * 100)}%`;
  }
}
