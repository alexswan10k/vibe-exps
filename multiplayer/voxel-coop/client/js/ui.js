// HUD + menus: hotbar, inventory, crafting grid, recipe book, chat, vitals.
import { BLOCK_NAME } from "./config.js";
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
    this._hintToken = 0;
    this.buildSlots();
    this.bindKeys();
    this.bindWheel();
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
      d.addEventListener("dblclick", () => this.eatInv(i));
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

  static EDIBLE = new Set([104, 107, 115, 132, 133, 134, 135, 136]);

  eatInv(i) {
    const s = this.slots[i];
    if (s?.id && UI.EDIBLE.has(s.id)) this.onEat?.(i);
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
      }
      if (e.code === "KeyH") this.toggleHelp();
      if (e.code === "KeyG") {
        const s = this.slots[this.hotbarSel];
        if (s?.id && UI.EDIBLE.has(s.id)) this.onEat?.(this.hotbarSel);
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
    const tok = ++this._hintToken;
    this.el("hint").textContent = t;
    if (!t) return;
    setTimeout(() => {
      if (tok === this._hintToken) this.el("hint").textContent = "";
    }, 3500);
  }

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
