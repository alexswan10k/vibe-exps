// HUD + menus: hotbar, inventory, crafting grid, recipe book, chat, vitals.
import { BLOCK_NAME, httpBase, resolveServerUrl } from "./config.js";
import { SHAPED_CLIENT, SMELT_CLIENT } from "./recipes.js";
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
    // pointer drag-and-drop state (see slotDragStart/dragMove/dragUp below)
    this.drag = null; // {kind:'inv'|'grid'|'chest'|'result', idx, x0, y0, active, srcEl}
    this._suppressClick = false; // a real drag just ended: swallow the trailing click
    this.nearTable = false;
    this.onGridPut = null;
    this.onGridTake = null;
    this.onCraftTake = null;
    this.onAutoFill = null;
    this.onCraftDirect = null; // (recipeId, n) => void — 1-click server-side craft
    this.bookQuery = "";
    this.bookFilter = "all";
    this.bookPage = 0;
    this.bookPageSize = 6;
    this._bookRows = []; // sorted/filtered rows from the last renderBook (for paging)
    this.onChatClosed = null;
    // injected by main.js (needs the player): show/hide the mouse pointer
    this.requestLock = null;
    this.releaseLock = null;
    this.onChat = null;
    this.onRespawn = null;
    this.  onEat = null;
    this.onMoveItem = null;
    this.onChestTake = null; // (cs) => void — drag chest cell -> inventory
    this.onChestPut = null; // (slot, cs, all) => void — drag inventory -> chest cell
    this.onTrade = null; // (villagerId, slot) => void — wired in main.js to net.trade
    this.tradeId = null;
    this._hintToken = 0;
    this._players = []; // latest [{id,name,p,yaw,hp,dead}] via setPlayers (merger: net.on("players"))
    this._settings = this.loadSettings();
    window.voxSettings = { ...this._settings };
    window.voxGetPlayerName = () => (this.el("screen-name")?.value ?? "").trim().slice(0, 16)
      || (this.el("menu-name")?.value ?? "").trim().slice(0, 16) || "player";
    this.buildSlots();
    this.bindKeys();
    this.bindWheel();
    this.initMenus();
    // drag ghost + drop live at document level (slots come and go on re-render)
    document.addEventListener("pointermove", (e) => this.dragMove(e));
    document.addEventListener("pointerup", (e) => this.dragUp(e));
    document.addEventListener("pointercancel", () => this.dragCancel());
  }

  buildSlots() {
    const hb = this.el("hotbar");
    hb.innerHTML = "";
    for (let i = 0; i < 9; i++) {
      const d = document.createElement("div");
      d.className = "slot";
      d.dataset.i = i;
      d.addEventListener("click", () => { if (this.consumeDragClick()) return; this.hotbarSel = i; this.renderHotbar(); });
      d.addEventListener("pointerdown", (e) => this.slotDragStart(e, "inv", i));
      hb.appendChild(d);
    }
    const inv = this.el("inv-grid");
    inv.innerHTML = "";
    for (let i = 0; i < 36; i++) {
      const d = document.createElement("div");
      d.className = "slot";
      d.dataset.i = i;
      d.addEventListener("click", () => this.clickInv(i));
      d.addEventListener("dblclick", () => this.eatInv(i));
      d.addEventListener("pointerdown", (e) => this.slotDragStart(e, "inv", i));
      inv.appendChild(d);
    }
    const rb = this.el("craft-grid");
    rb.innerHTML = "";
    for (let g = 0; g < 9; g++) {
      const d = document.createElement("div");
      d.className = "slot";
      d.dataset.g = g;
      d.addEventListener("click", (e) => { if (this.consumeDragClick()) return; this.clickGrid(g, e.shiftKey); });
      d.addEventListener("pointerdown", (e) => this.slotDragStart(e, "grid", g));
      rb.appendChild(d);
    }
    rb.classList.add("small");
    this.el("craft-result").addEventListener("click", () => {
      if (this.consumeDragClick()) return;
      if (this.gridResult?.id) this.onCraftTake?.();
    });
    this.el("craft-result").addEventListener("pointerdown", (e) => this.slotDragStart(e, "result", 0));
    this.el("trade-close")?.addEventListener("click", () => this.hideTrades());
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
      d.innerHTML = `<div class="out" style="background-image:url(${itemIconURL(r.out.id)})"></div>
        <div class="lbl"><b>${r.name}</b><small class="desc">${r.desc ?? ""}</small><div class="ing"></div><small class="need"></small></div>
        <div class="acts"><button class="craft1">Craft</button><button class="fill" title="fill the crafting grid instead">▦</button></div>`;
      d.querySelector(".craft1").addEventListener("click", (e) => {
        e.stopPropagation();
        if (!d.classList.contains("ok")) return;
        const max = Number(d.dataset.max ?? 1);
        const n = e.shiftKey ? max : 1;
        if (this.onCraftDirect) this.onCraftDirect(r.id, n);
        else this.onAutoFill?.(r);
      });
      d.querySelector(".fill").addEventListener("click", (e) => {
        e.stopPropagation();
        this.onAutoFill?.(r);
      });
      book.appendChild(d);
    }
    // furnace cheat-sheet (static)
    const sm = this.el("book-smelt-list");
    if (sm) {
      sm.textContent = SMELT_CLIENT.map((s) => `${s.inName}+${s.fuel}→${s.outName}`).join(" · ");
    }
    // search + filters (reset to first page on any change)
    this.el("book-search")?.addEventListener("input", (e) => {
      this.bookQuery = e.target.value.trim().toLowerCase();
      this.bookPage = 0;
      this.renderBook();
      this.fitLayout();
    });
    this.el("book-filters")?.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      this.bookFilter = b.dataset.cat;
      for (const x of this.el("book-filters").children) x.classList.toggle("on", x === b);
      this.bookPage = 0;
      this.renderBook();
      this.fitLayout();
    });
    // pager
    this.el("book-prev")?.addEventListener("click", () => {
      if (this.bookPage > 0) { this.bookPage--; this.applyPage(); }
    });
    this.el("book-next")?.addEventListener("click", () => {
      this.bookPage++; this.applyPage();
    });
    addEventListener("resize", () => { if (this.invOpen) this.fitLayout(); });
  }

  bookCost(r) {
    const m = new Map();
    for (const id of r.pat) if (id) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }

  renderBook() {
    const book = this.el("recipe-book");
    if (!book) return;
    const counts = {};
    for (const s of this.slots) if (s?.id) counts[s.id] = (counts[s.id] ?? 0) + s.n;
    const rows = [];
    for (const d of book.children) {
      const r = SHAPED_CLIENT.find((x) => x.id === d.dataset.id);
      if (!r) continue;
      const cost = this.bookCost(r);
      let afford = Infinity;
      const missing = [];
      for (const [id, n] of cost) {
        const have = counts[id] ?? 0;
        afford = Math.min(afford, Math.floor(have / n));
        if (have < n) missing.push({ id, need: n - have });
      }
      if (afford === Infinity) afford = 0;
      const tableOk = !r.needsTable || this.nearTable;
      const ok = afford >= 1 && tableOk;
      // filters
      const q = this.bookQuery;
      const hay = `${r.name} ${r.desc ?? ""} ${[...cost.keys()].map((id) => BLOCK_NAME[id] ?? "").join(" ")}`.toLowerCase();
      let show = !q || hay.includes(q);
      if (show && this.bookFilter === "ok") show = ok;
      else if (show && ["tools", "blocks", "basics", "food"].includes(this.bookFilter)) show = r.cat === this.bookFilter;
      d.classList.toggle("ok", ok);
      d.dataset.max = String(afford);
      // ingredient chips: icon + have/need
      const ing = d.querySelector(".ing");
      ing.innerHTML = [...cost.entries()].map(([id, n]) => {
        const have = counts[id] ?? 0;
        const cls = have >= n ? "h" : "m";
        const nm = BLOCK_NAME[id] ?? `?${id}`;
        return `<span class="${cls}" title="${nm}: have ${have}, need ${n}"><i style="background-image:url(${itemIconURL(id)})"></i>${have}/${n}</span>`;
      }).join("");
      const need = d.querySelector(".need");
      need.textContent = ok
        ? (afford > 1 ? `ready ×${afford} (shift-click = all)` : "ready — click Craft")
        : [...(!tableOk ? ["needs table nearby"] : []), ...missing.map(({ id, need: k }) => `need ${BLOCK_NAME[id]}×${k}`)].join(" · ");
      const btn = d.querySelector(".craft1");
      btn.disabled = !ok;
      btn.textContent = ok && afford > 1 ? "Craft" : "Craft";
      rows.push({ d, ok, show, miss: missing.length, name: r.name });
    }
    // craftable first, then fewest missing, then name
    rows.sort((a, b) => Number(b.ok) - Number(a.ok) || a.miss - b.miss || a.name.localeCompare(b.name));
    for (const { d } of rows) book.appendChild(d);
    this._bookRows = rows;
    const pages = Math.max(1, Math.ceil(rows.filter((r) => r.show).length / this.bookPageSize));
    if (this.bookPage > pages - 1) this.bookPage = pages - 1;
    this.applyPage();
  }

  /** Show only the current page slice (no scrolling — pager flips pages). */
  applyPage() {
    const book = this.el("recipe-book");
    if (!book || this._bookRows.length === 0) return;
    const vis = this._bookRows.filter((r) => r.show);
    const pages = Math.max(1, Math.ceil(vis.length / this.bookPageSize));
    if (this.bookPage > pages - 1) this.bookPage = pages - 1;
    if (this.bookPage < 0) this.bookPage = 0;
    const start = this.bookPage * this.bookPageSize;
    const onPage = new Set(vis.slice(start, start + this.bookPageSize).map((r) => r.d));
    for (const { d, show } of this._bookRows) {
      d.style.display = show && onPage.has(d) ? "" : "none";
    }
    const info = this.el("book-pageinfo");
    if (info) {
      info.textContent = vis.length === 0
        ? "no recipes match"
        : `${start + 1}–${Math.min(start + this.bookPageSize, vis.length)} of ${vis.length}`;
    }
    const prev = this.el("book-prev"), next = this.el("book-next");
    if (prev) prev.disabled = this.bookPage <= 0;
    if (next) next.disabled = this.bookPage >= pages - 1;
  }

  /**
   * Shrink-to-fit: measure the book area and pick a page size so the whole
   * panel fits the viewport with zero scrolling. Called on open / resize /
   * filter change (never during gameplay ticks).
   */
  fitLayout() {
    if (!this.invOpen) return;
    const book = this.el("recipe-book");
    const panel = book?.closest(".inv-panel");
    if (!book || !panel) return;
    const first = [...book.children].find((d) => d.style.display !== "none");
    const rowH = (first ? first.offsetHeight : 80) + 6;
    const availH = book.clientHeight;
    this.bookPageSize = Math.max(1, Math.floor((availH + 6) / Math.max(1, rowH)));
    this.applyPage();
    // belt + braces: if the panel still overflows (short viewport), drop a row per round
    let guard = 30;
    while (panel.scrollHeight > panel.clientHeight + 1 && this.bookPageSize > 1 && guard-- > 0) {
      this.bookPageSize--;
      this.applyPage();
    }
  }

  // A real drag just ended (pointerup): swallow the trailing click so a drop
  // doesn't also select/deposit/take. Returns true when it ate the click.
  consumeDragClick() {
    if (!this._suppressClick) return false;
    this._suppressClick = false;
    return true;
  }

  clickInv(i) {
    if (this.consumeDragClick()) return;
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

  static EDIBLE = new Set([104, 107, 115, 132, 133, 134, 135, 136, 142, 143]);

  eatInv(i) {
    const s = this.slots[i];
    if (s?.id && UI.EDIBLE.has(s.id)) this.onEat?.(i);
  }

  // ---------- pointer drag-and-drop between slots ----------
  // Click-click (swapIdx) still works: a press without movement never becomes
  // a drag, and the trailing click after a real drag is swallowed (see
  // consumeDragClick). Moves go through the same server-authoritative seams
  // as clicks (onMoveItem/onGridPut/onGridTake/onCraftTake + chest hooks).
  slotDragStart(e, kind, idx) {
    if (this.drag) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const cell = e.target?.closest?.(".slot") ?? null;
    this.drag = { kind, idx, x0: e.clientX, y0: e.clientY, active: false, srcEl: cell, hiEl: null };
  }

  dragSourceFilled() {
    const d = this.drag;
    if (!d) return false;
    if (d.kind === "inv") return !!this.slots[d.idx]?.id;
    if (d.kind === "grid") return !!this.gridCells[d.idx]?.id;
    if (d.kind === "result") return !!this.gridResult?.id;
    if (d.kind === "chest") return !!d.srcEl?.querySelector?.(".icon");
    return false;
  }

  dragGhost(e) {
    let g = document.getElementById("drag-ghost");
    if (!g) {
      g = document.createElement("div");
      g.id = "drag-ghost";
      document.body.appendChild(g);
    }
    if (!g.firstChild && this.drag?.srcEl) {
      // clone the source visuals (icon + count), not the data
      for (const sel of [".icon", ".cnt"]) {
        const n = this.drag.srcEl.querySelector(sel);
        if (n) g.appendChild(n.cloneNode(true));
      }
    }
    g.style.display = "block";
    g.style.left = `${e.clientX - 24}px`;
    g.style.top = `${e.clientY - 24}px`;
  }

  dragHighlight(e) {
    const d = this.drag;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.(".slot") ?? null;
    if (el !== d.hiEl) {
      d.hiEl?.classList.remove("drop-hi");
      d.hiEl = el;
      el?.classList.add("drop-hi");
    }
  }

  dragMove(e) {
    const d = this.drag;
    if (!d) return;
    if (!d.active) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 8) return;
      if (!this.dragSourceFilled()) { this.drag = null; return; } // empty cell: plain click
      d.active = true;
      this._suppressClick = true; // swallow the click landing after this drag
      this.swapIdx = null; // drag replaces click-click selection
      this.renderInv();
    }
    this.dragGhost(e);
    this.dragHighlight(e);
  }

  dragTargetAt(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.(".slot, #craft-result") ?? null;
    if (!el) return null;
    if (el.dataset.cs !== undefined && el.dataset.cs !== "") return { kind: "chest", idx: Number(el.dataset.cs) };
    if (el.dataset.g !== undefined && el.dataset.g !== "") return { kind: "grid", idx: Number(el.dataset.g) };
    if (el.dataset.i !== undefined && el.dataset.i !== "") return { kind: "inv", idx: Number(el.dataset.i) };
    if (el.id === "craft-result") return { kind: "result", idx: 0 };
    return null;
  }

  dragUp(e) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    document.getElementById("drag-ghost")?.remove();
    d.hiEl?.classList.remove("drop-hi");
    if (!d.active) return; // plain click: existing click handlers run
    const t = this.dragTargetAt(e);
    if (!t) return;
    const shift = window.voxShiftDown === true;
    if (d.kind === "inv" && t.kind === "inv" && d.idx !== t.idx) this.onMoveItem?.(d.idx, t.idx);
    else if (d.kind === "inv" && t.kind === "grid") this.onGridPut?.(d.idx, t.idx, shift);
    else if (d.kind === "inv" && t.kind === "chest") this.onChestPut?.(d.idx, t.idx, shift);
    else if (d.kind === "grid" && (t.kind === "inv")) this.onGridTake?.(d.idx);
    else if (d.kind === "chest" && (t.kind === "inv")) this.onChestTake?.(d.idx);
    else if (d.kind === "result" && (t.kind === "inv")) this.onCraftTake?.();
    this.swapIdx = null;
    this.renderInv();
  }

  dragCancel() {
    this.drag = null;
    document.getElementById("drag-ghost")?.remove();
    document.querySelectorAll(".slot.drop-hi").forEach((el) => el.classList.remove("drop-hi"));
  }

  bindWheel() {
    const cycle = (e) => {
      if (this.chatFocused()) return;
      if (e.deltaY > 0) this.hotbarSel = (this.hotbarSel + 1) % 9;
      else if (e.deltaY < 0) this.hotbarSel = (this.hotbarSel + 8) % 9;
      else return;
      this.renderHotbar();
      e.preventDefault();
    };
    this.el("hotbar")?.addEventListener("wheel", cycle, { passive: false });
    // game canvas container (#game holds the renderer canvas)
    this.el("game")?.addEventListener("wheel", cycle, { passive: false });
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
      if (e.code === "Escape" || e.key === "Escape") {
        if (this.invOpen) this.toggleInv(false);
        if (this.el("trade-modal")?.style.display !== "none") this.hideTrades(false);
        if (this.el("screen-settings")?.style.display !== "none") this.toggleSettings(false);
      }
      if (e.code === "KeyH") this.toggleHelp();
      if (e.code === "KeyO") this.toggleSettings();
      if (e.code === "Tab") {
        e.preventDefault();
        if (!e.repeat) this.showPlayers(true);
      }
      if (e.code === "KeyG") {
        const s = this.slots[this.hotbarSel];
        if (s?.id && UI.EDIBLE.has(s.id)) this.onEat?.(this.hotbarSel);
      }
    });
    this.el("chat-input").addEventListener("focus", () => this.releaseLock?.());
    document.addEventListener("keyup", (e) => {
      if (e.code === "Tab") this.showPlayers(false);
    });
    addEventListener("blur", () => this.showPlayers(false));
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
    if (this.invOpen) {
      this.releaseLock?.(); this.renderInv(); this.renderGrid(); this.renderBook();
      requestAnimationFrame(() => this.fitLayout());
    }
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
    const hpN = Math.max(0, Math.ceil(hp));
    const maxN = Math.max(1, Math.ceil(maxHp));
    const huN = Math.max(0, Math.ceil(hunger));
    const hearts = "❤".repeat(Math.max(0, Math.ceil(hp / 2))) + "🖤".repeat(Math.max(0, Math.ceil((maxHp - hp) / 2)));
    const drum = "🍖".repeat(Math.ceil(hunger / 2));
    this.el("vitals").innerHTML =
      `<span class="hp" title="health ${hpN}/${maxN}">${hearts || "💀"}</span>` +
      `<span class="vnum" title="health ${hpN}/${maxN}">${hpN}/${maxN}</span>` +
      `<span class="hunger" title="hunger ${huN}/20">${drum}</span>` +
      `<span class="vnum" title="hunger ${huN}/20">${huN}/20</span>`;
    this.el("dead").style.display = dead ? "flex" : "none";
    if (dead) this.updateDeathStats();
  }

  chatMsg(from, msg) {
    const log = this.el("chat-log");
    const d = document.createElement("div");
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    d.innerHTML = `<b></b><span></span>`;
    d.children[0].textContent = `[${hh}:${mm}] ${from}: `;
    d.children[1].textContent = msg;
    log.appendChild(d);
    while (log.children.length > 60) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }

  status(t) { this.el("status").textContent = t; }
  hint(t) {
    // Cheap + timer-safe: skip redundant DOM writes (called per-frame by the
    // contextual hint) and reuse a single expiry timer instead of arming a
    // new 3.5s timeout on every call.
    if (t === this._hintLast) return;
    this._hintLast = t;
    const tok = ++this._hintToken;
    this.el("hint").textContent = t;
    if (this._hintTimer) { clearTimeout(this._hintTimer); this._hintTimer = null; }
    if (!t) return;
    this._hintTimer = setTimeout(() => {
      this._hintTimer = null;
      if (tok === this._hintToken) {
        this._hintLast = "";
        this.el("hint").textContent = "";
      }
    }, 3500);
  }

  pulse() {
    const c = this.el("crosshair");
    c.classList.remove("hit");
    void c.offsetWidth; // restart animation
    c.classList.add("hit");
  }

  /** Villager trade modal. offers: [{give:{id,n}, get:{id,n}}]. */
  showTrades(villagerId, offers) {
    this.tradeId = villagerId;
    const modal = this.el("trade-modal");
    const list = this.el("trade-list");
    if (!modal || !list) return;
    list.innerHTML = "";
    for (let i = 0; i < (offers ?? []).length; i++) {
      const o = offers[i] ?? {};
      const row = document.createElement("div");
      row.className = "trade-row";
      const giveBg = o.give?.id ? `background-image:url(${itemIconURL(o.give.id)})` : "background:#222";
      const getBg = o.get?.id ? `background-image:url(${itemIconURL(o.get.id)})` : "background:#222";
      const giveName = iconFor(o.give?.id)?.name ?? "?";
      const getName = iconFor(o.get?.id)?.name ?? "?";
      row.innerHTML = `<div class="ticon" style="${giveBg}"></div>` +
        `<span class="tamt">${giveName} ×${o.give?.n ?? 1}</span>` +
        `<span class="tarrow">→</span>` +
        `<div class="ticon" style="${getBg}"></div>` +
        `<span class="tamt">${getName} ×${o.get?.n ?? 1}</span>`;
      const btn = document.createElement("button");
      btn.textContent = "BUY";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.onTrade?.(this.tradeId, i);
      });
      row.appendChild(btn);
      list.appendChild(row);
    }
    if (!(offers ?? []).length) list.textContent = "no trades — try another villager";
    modal.style.display = "flex";
    // pointer lock must go so the cursor can click BUY
    this.releaseLock?.();
  }

  hideTrades(relock = true) {
    const modal = this.el("trade-modal");
    if (modal) modal.style.display = "none";
    this.tradeId = null;
    if (relock) this.requestLock?.();
  }

  tradeOpen() {
    return this.el("trade-modal")?.style.display !== "none";
  }

  breakProgress(fracOrNull) {
    const b = this.el("breakbar");
    if (fracOrNull === null) { b.style.display = "none"; return; }
    b.style.display = "block";
    b.firstElementChild.style.width = `${Math.min(100, fracOrNull * 100)}%`;
  }

  // ---------- menu/overlay screens (title, TAB list, settings, death stats) ----------

  initMenus() {
    // title screen: prefill name, Play only hides UI (join flow stays in main.js)
    const nameInput = this.el("screen-name");
    let saved = null;
    try { saved = localStorage.getItem("vox-name") ?? localStorage.getItem("voxelcoop.name"); } catch { /* noop */ }
    if (nameInput) {
      nameInput.value = saved ?? this.el("menu-name")?.value ?? `player${Math.floor(Math.random() * 99)}`;
      nameInput.addEventListener("input", () => {
        const n = window.voxGetPlayerName();
        try { localStorage.setItem("vox-name", n); } catch { /* noop */ }
        const menuName = this.el("menu-name");
        if (menuName) menuName.value = n;
      });
    }
    this.el("screen-play")?.addEventListener("click", () => {
      const n = window.voxGetPlayerName();
      try {
        localStorage.setItem("vox-name", n);
        localStorage.setItem("voxelcoop.name", n); // compat with main.js join flow
      } catch { /* noop */ }
      const menuName = this.el("menu-name");
      if (menuName) menuName.value = n;
      this.el("screen-title").style.display = "none";
      this.requestLock?.();
    });
    // MOTD: same-origin server status, static tip stays on failure
    (async () => {
      try {
        const base = httpBase(resolveServerUrl());
        if (!base.startsWith("http")) return;
        const r = await fetch(`${base}/api/status`);
        const s = await r.json();
        const m = this.el("screen-motd");
        if (m && s) m.textContent = `server: ${s.players} online · seed ${s.seed} · ${s.motd ?? "welcome!"}`;
      } catch { /* keep static tip */ }
    })();
    // death screen fallback: main.js already wires #respawn-btn + onRespawn;
    // this only fires when the merger hasn't (no double-respawn).
    this.el("respawn-btn")?.addEventListener("click", () => {
      if (this.onRespawn) return;
      const n = window.voxNet;
      if (n?.respawn) n.respawn();
      else if (n?.send) n.send({ t: "respawn" });
    });
    // settings controls
    const s = this._settings;
    const vol = this.el("menu-volume"), ren = this.el("menu-render");
    const mm = this.el("menu-minimapchk"), wx = this.el("menu-weatherchk");
    if (vol) {
      vol.value = String(s.volume);
      vol.addEventListener("input", () => this.saveSettings({ volume: Number(vol.value) }));
    }
    if (ren) {
      ren.value = String(s.renderDist);
      ren.addEventListener("change", () => this.saveSettings({ renderDist: Number(ren.value) }));
    }
    if (mm) {
      mm.checked = s.showMinimap;
      mm.addEventListener("change", () => this.saveSettings({ showMinimap: mm.checked }));
    }
    if (wx) {
      wx.checked = s.showWeather;
      wx.addEventListener("change", () => this.saveSettings({ showWeather: wx.checked }));
    }
    this.applySettings();
    this.el("menu-gear")?.addEventListener("click", () => this.toggleSettings());
    this.el("menu-settings-close")?.addEventListener("click", () => this.toggleSettings(false));
  }

  loadSettings() {
    const get = (k, fb) => {
      try {
        const v = localStorage.getItem(k);
        return v === null ? fb : v;
      } catch { return fb; }
    };
    const vol = Math.min(100, Math.max(0, Number(get("vox-volume", 80)) || 0));
    const rd = [2, 4, 6, 8].includes(Number(get("vox-render-dist", 6))) ? Number(get("vox-render-dist", 6)) : 6;
    return {
      volume: vol,
      renderDist: rd,
      showMinimap: get("vox-minimap", "1") !== "0",
      showWeather: get("vox-weather", "1") !== "0",
    };
  }

  saveSettings(patch) {
    Object.assign(this._settings, patch);
    try {
      localStorage.setItem("vox-volume", String(this._settings.volume));
      localStorage.setItem("vox-render-dist", String(this._settings.renderDist));
      localStorage.setItem("vox-minimap", this._settings.showMinimap ? "1" : "0");
      localStorage.setItem("vox-weather", this._settings.showWeather ? "1" : "0");
    } catch { /* noop */ }
    this.applySettings();
  }

  applySettings() {
    window.voxSettings = { ...this._settings };
    // minimap visibility applies directly; volume/renderDist need main.js/audio hooks (see report)
    const mmc = document.getElementById("minimap");
    if (mmc) mmc.style.display = this._settings.showMinimap ? "" : "none";
    try { window.voxAudio?.setVolume?.(this._settings.volume / 100); } catch { /* merger wires audio */ }
  }

  toggleSettings(force) {
    const p = this.el("screen-settings");
    if (!p) return;
    const show = force ?? p.style.display === "none";
    p.style.display = show ? "flex" : "none";
    if (show) this.releaseLock?.();
    else this.requestLock?.();
  }

  /** Merger hook: net.on("players", (m) => ui.setPlayers(m.list)). */
  setPlayers(list) {
    this._players = Array.isArray(list) ? list : [];
    if (this.el("screen-players")?.style.display !== "none") this.renderPlayers();
    if (this.el("dead")?.style.display !== "none") this.updateDeathStats();
  }

  showPlayers(show) {
    const p = this.el("screen-players");
    if (!p) return;
    p.style.display = show ? "flex" : "none";
    if (show) this.renderPlayers();
  }

  renderPlayers() {
    const list = this.el("screen-players-list");
    if (!list) return;
    list.innerHTML = "";
    const me = window.voxGetPlayerName?.() ?? "";
    let eye = null;
    try { eye = window.player?.pos ?? null; } catch { /* noop */ }
    const rows = [...this._players].sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
    if (!rows.length) list.textContent = "no players seen yet";
    for (const pl of rows) {
      const d = document.createElement("div");
      d.className = "screen-prow" + (pl.dead ? " dead" : "") + (pl.name === me ? " me" : "");
      const nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = pl.name ?? `#${pl.id ?? "?"}`;
      const hp = document.createElement("span");
      hp.className = "hp";
      hp.textContent = pl.dead ? "☠" : `❤${Math.max(0, Math.ceil(pl.hp ?? 20))}`;
      const st = document.createElement("span");
      st.className = "st";
      st.textContent = pl.dead ? "dead" : "alive";
      d.append(nm, hp, st);
      if (Array.isArray(pl.p) && eye) {
        const dist = document.createElement("span");
        dist.className = "dist";
        dist.textContent = `${Math.round(Math.hypot(pl.p[0] - eye.x, pl.p[2] - eye.z))}m`;
        d.appendChild(dist);
      }
      list.appendChild(d);
    }
  }

  /** Death stats: players msg carries no kills, so show online/alive counts. */
  updateDeathStats() {
    const panel = this.el("dead")?.querySelector(".dead-panel");
    if (!panel) return;
    let stats = document.getElementById("screen-death-stats");
    if (!stats) {
      stats = document.createElement("div");
      stats.id = "screen-death-stats";
      panel.insertBefore(stats, panel.querySelector("button"));
    }
    const online = this._players.length;
    const alive = this._players.filter((p) => !p.dead).length;
    stats.textContent = online > 0
      ? `${online} player${online === 1 ? "" : "s"} online · ${alive} alive — respawn to rejoin`
      : "respawn to rejoin the world";
  }
}
