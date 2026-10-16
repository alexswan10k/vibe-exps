"use strict";
/* ============================================================
   Modular Synth — rack UI.

   Owns every DOM node in the rack and reconciles it against state.
   Cable geometry comes from module coordinates plus cached jack offsets,
   so drawing a cable never measures the DOM. The old implementation gave
   every cable its own requestAnimationFrame loop, each doing three
   getBoundingClientRect calls and a re-render every frame.
   ============================================================ */

const SVG_NS = "http://www.w3.org/2000/svg";

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}

function svg(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const key in attrs) node.setAttribute(key, attrs[key]);
    return node;
}

/** Rounds a rack coordinate onto the snap grid. */
function snapToGrid(value) {
    return Math.round(value / RACK_GRID) * RACK_GRID;
}

/**
 * A cable hanging under its own weight.
 * Returns the path data plus the point halfway along it, which is where the
 * voltage readout sits.
 */
function cablePath(x1, y1, x2, y2) {
    const sag = Math.max(26, Math.min(190, Math.hypot(x2 - x1, y2 - y1) * 0.38));
    const p0 = { x: x1, y: y1 };
    const p1 = { x: x1, y: y1 + sag };
    const p2 = { x: x2, y: y2 + sag };
    const p3 = { x: x2, y: y2 };
    return {
        d: "M " + x1 + " " + y1 + " C " + p1.x + " " + p1.y + ", " + p2.x + " " + p2.y + ", " + x2 + " " + y2,
        // Cubic Bezier evaluated at t = 0.5.
        mid: {
            x: (p0.x + 3 * p1.x + 3 * p2.x + p3.x) / 8,
            y: (p0.y + 3 * p1.y + 3 * p2.y + p3.y) / 8,
        },
    };
}

/* ============================================================
   Controls
   ============================================================ */

function createKnob(spec, onChange) {
    const wrap = el("div", "control");
    const dial = el("div", "knob");
    dial.tabIndex = 0;
    dial.setAttribute("role", "slider");
    dial.setAttribute("aria-label", spec.name);
    dial.setAttribute("aria-valuemin", "0");
    dial.setAttribute("aria-valuemax", "100");

    const label = el("span", "control-label", spec.name);
    const readout = el("span", "control-value");
    wrap.append(dial, label, readout);

    let value = spec.default;
    let drag = null;

    function paint() {
        dial.style.setProperty("--rot", (-135 + value * 270).toFixed(2) + "deg");
        dial.setAttribute("aria-valuenow", String(Math.round(value * 100)));
        const shown = spec.display ? spec.display(value) : Math.round(value * 100) + "%";
        readout.textContent = shown;
        dial.title = spec.name + ": " + shown + "  (drag, shift = fine, double-click = reset)";
    }

    function commit(next) {
        value = clamp01(next);
        paint();
        onChange(value);
    }

    dial.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        dial.setPointerCapture(e.pointerId);
        drag = { y: e.clientY, value };
        dial.classList.add("dragging");
    });

    dial.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const gain = (e.shiftKey ? 0.2 : 1) * 0.005;
        commit(drag.value + (drag.y - e.clientY) * gain);
    });

    const endDrag = (e) => {
        if (!drag) return;
        drag = null;
        dial.classList.remove("dragging");
        if (dial.hasPointerCapture(e.pointerId)) dial.releasePointerCapture(e.pointerId);
    };
    dial.addEventListener("pointerup", endDrag);
    dial.addEventListener("pointercancel", endDrag);

    dial.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        commit(spec.default);
    });

    dial.addEventListener("wheel", (e) => {
        e.preventDefault();
        e.stopPropagation();
        commit(value + (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 0.005 : 0.02));
    }, { passive: false });

    dial.addEventListener("keydown", (e) => {
        const step = e.shiftKey ? 0.005 : 0.02;
        if (e.key === "ArrowUp" || e.key === "ArrowRight") { commit(value + step); e.preventDefault(); }
        else if (e.key === "ArrowDown" || e.key === "ArrowLeft") { commit(value - step); e.preventDefault(); }
        else if (e.key === "Home") { commit(spec.default); e.preventDefault(); }
    });

    return { el: wrap, setValue(v) { value = v; paint(); }, getValue() { return value; } };
}

function createSwitch(spec, onChange) {
    const wrap = el("div", "control");
    const toggle = el("div", "toggle");
    toggle.tabIndex = 0;
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("aria-label", spec.name);
    const label = el("span", "control-label", spec.name);
    const readout = el("span", "control-value");
    wrap.append(toggle, label, readout);

    let value = spec.default;

    function commit(next) {
        value = next ? 1 : 0;
        paint();
        onChange(value);
    }

    function paint() {
        toggle.classList.toggle("on", !!value);
        toggle.setAttribute("aria-checked", value ? "true" : "false");
        readout.textContent = value ? "ON" : "OFF";
    }

    toggle.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        commit(!value);
    });
    toggle.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { commit(!value); e.preventDefault(); }
    });

    return { el: wrap, setValue(v) { value = v; paint(); }, getValue() { return value; } };
}

function createSelect(spec, onChange) {
    const wrap = el("div", "control");
    const box = el("div", "select");
    box.tabIndex = 0;
    box.setAttribute("role", "button");
    box.setAttribute("aria-label", spec.name);
    const label = el("span", "control-label", spec.name);
    wrap.append(box, label);

    let value = spec.default;

    function commit() {
        paint();
        onChange(value);
    }

    function paint() {
        box.textContent = spec.options[Math.min(spec.options.length - 1, Math.round(value))];
        box.title = spec.name + ": " + box.textContent;
    }

    box.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        value = (Math.round(value) + 1) % spec.options.length;
        commit();
    });
    box.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            value = (Math.round(value) + 1) % spec.options.length;
            commit();
            e.preventDefault();
        }
    });

    return { el: wrap, setValue(v) { value = v; paint(); }, getValue() { return value; } };
}

function createControl(spec, onChange) {
    if (spec.type === "switch") return createSwitch(spec, onChange);
    if (spec.type === "select") return createSelect(spec, onChange);
    return createKnob(spec, onChange);
}

function createJack(jackId, dir, label) {
    const group = el("div", "io-group");
    const socket = el("div", "jack " + dir);
    socket.dataset.jack = jackId;
    socket.title = label + " · " + (dir === "in" ? "input" : "output");
    group.append(socket, el("span", "jack-label", label));
    return { group, socket };
}

/* ============================================================
   Panels
   ============================================================ */

const PANEL_DRAWERS = {};

/** Sequencer: a gate button and a pitch knob per step. */
PANEL_DRAWERS.sequencer = function (host, moduleId, actions) {
    const grid = el("div", "seq-grid");
    const steps = [];
    for (let i = 0; i < SEQUENCER_STEPS; i++) {
        const cell = el("div", "seq-cell");
        const knob = createKnob(
            { id: "cv" + i, name: "", type: "knob", default: 0.5, display: () => "" },
            (value) => actions.setStep(moduleId, i, { cv: value })
        );
        knob.el.classList.add("seq-knob");
        const gate = el("button", "seq-gate", String(i + 1));
        gate.title = "Step " + (i + 1) + " gate";
        gate.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            actions.toggleStep(moduleId, i);
        });
        cell.append(knob.el, gate);
        grid.appendChild(cell);
        steps.push({ knob, gate });
    }
    host.appendChild(grid);
    return {
        sync(module, state) {
            const data = state.steps[moduleId];
            if (!data) return;
            data.forEach((step, i) => {
                steps[i].knob.setValue(step.cv);
                steps[i].gate.classList.toggle("on", !!step.gate);
            });
        },
        frame(engine) {
            const voice = engine.getVoice(moduleId);
            if (!voice || !voice.visualStep) return;
            const current = voice.visualStep();
            steps.forEach((s, i) => s.gate.classList.toggle("playing", i === current));
        },
    };
};

/** Playable keyboard, positioned from the white-key layout. */
PANEL_DRAWERS.keyboard = function (host, moduleId, actions) {
    const { whites, blacks } = buildPianoKeys(48, 2);
    const board = el("div", "keyboard");
    const whiteKeys = [];
    const blackKeys = [];

    for (const key of whites) {
        const node = el("div", "key white");
        const hint = COMPUTER_KEY_MAP[key.note - 48];
        if (hint) node.appendChild(el("span", "key-hint", hint));
        node.dataset.note = key.note;
        node.title = noteName(key.note);
        board.appendChild(node);
        whiteKeys.push({ note: key.note, node });
    }
    for (const key of blacks) {
        const node = el("div", "key black");
        node.style.left = key.leftPct + "%";
        node.dataset.note = key.note;
        node.title = noteName(key.note);
        board.appendChild(node);
        blackKeys.push({ note: key.note, node });
    }

    host.appendChild(board);
    const all = whiteKeys.concat(blackKeys);
    let held = null;

    const on = (note) => { held = note; actions.noteOn(moduleId, note); paint(); };
    const off = () => { if (held === null) return; held = null; actions.noteOff(moduleId); paint(); };

    function paint() {
        for (const key of all) key.node.classList.toggle("on", key.note === held);
    }

    board.addEventListener("pointerdown", (e) => {
        const node = e.target.closest(".key");
        if (!node) return;
        e.preventDefault();
        board.setPointerCapture(e.pointerId);
        on(Number(node.dataset.note));
    });
    board.addEventListener("pointermove", (e) => {
        if (held === null || !e.buttons) return;
        const node = e.target.closest(".key");
        if (!node) return;
        const note = Number(node.dataset.note);
        if (note !== held) on(note);
    });
    board.addEventListener("pointerup", off);
    board.addEventListener("pointercancel", off);
    board.addEventListener("pointerleave", off);

    return {
        sync() {},
        frame() {},
    };
};

/** A live look at the noise flavour, drawn as a waveform. */
PANEL_DRAWERS.noise = function (host, moduleId, actions) {
    const canvas = el("canvas", "noise-canvas");
    canvas.width = 300;
    canvas.height = 64;
    host.appendChild(canvas);
    const ctx2d = canvas.getContext("2d");
    let tone = -1;

    return {
        sync(module) { tone = module.controls.tone; },
        frame(engine) {
            const voice = engine.getVoice(moduleId);
            const buffer = voice && voice.preview ? voice.preview() : null;
            const w = canvas.width;
            const h = canvas.height;

            ctx2d.fillStyle = "#0b0d0c";
            ctx2d.fillRect(0, 0, w, h);
            ctx2d.strokeStyle = "rgba(255,255,255,0.08)";
            ctx2d.beginPath();
            ctx2d.moveTo(0, h / 2);
            ctx2d.lineTo(w, h / 2);
            ctx2d.stroke();

            if (!buffer) return;
            // One row per crossing, which is what actually distinguishes the
            // three flavours: white is a solid block, brown is sparse arcs.
            const rows = 22;
            ctx2d.strokeStyle = "#7CFF6B";
            ctx2d.lineWidth = 1;
            for (let row = 0; row < rows; row++) {
                ctx2d.beginPath();
                let started = false;
                for (let i = 0; i < buffer.length; i++) {
                    const x = (i / buffer.length) * w;
                    const y = 4 + ((row + 0.5) / rows) * (h - 8);
                    if (!started) { ctx2d.moveTo(x, y); started = true; }
                    else ctx2d.lineTo(x, y);
                }
                ctx2d.globalAlpha = 0.25 + 0.75 * (1 - row / rows);
                ctx2d.stroke();
            }
            ctx2d.globalAlpha = 1;
        },
    };
};

/** MIDI status. */
PANEL_DRAWERS.midi = function (host, moduleId, actions) {
    const status = el("div", "midi-status", "…");
    host.appendChild(status);
    return {
        sync() {},
        setStatus(text) { status.textContent = text; },
        frame() {},
    };
};

/** Oscilloscope. */
PANEL_DRAWERS.scope = function (host, moduleId, actions) {
    const canvas = el("canvas", "scope-canvas");
    canvas.width = 380;
    canvas.height = 130;
    host.appendChild(canvas);
    const ctx2d = canvas.getContext("2d");
    return {
        sync() {},
        frame(engine) {
            const voice = engine.getVoice(moduleId);
            ctx2d.fillStyle = "#0b0d0c";
            ctx2d.fillRect(0, 0, canvas.width, canvas.height);
            if (!voice || !voice.analyser) return;
            const buffer = voice.buffer();
            voice.analyser.getByteTimeDomainData(buffer);
            ctx2d.strokeStyle = "#7CFF6B";
            ctx2d.lineWidth = 2;
            ctx2d.beginPath();
            const step = canvas.width / buffer.length;
            for (let i = 0; i < buffer.length; i++) {
                const y = ((buffer[i] - 128) / 128) * (canvas.height / 2 - 2) + canvas.height / 2;
                if (i === 0) ctx2d.moveTo(0, y);
                else ctx2d.lineTo(i * step, y);
            }
            ctx2d.stroke();
            ctx2d.strokeStyle = "rgba(124,255,107,0.18)";
            ctx2d.lineWidth = 1;
            ctx2d.beginPath();
            ctx2d.moveTo(0, canvas.height / 2);
            ctx2d.lineTo(canvas.width, canvas.height / 2);
            ctx2d.stroke();
        },
    };
};

/** ADSR shape, with a live playhead at the current level. */
PANEL_DRAWERS.envelope = function (host, moduleId, actions) {
    const canvas = el("canvas", "env-canvas");
    canvas.width = 340;
    canvas.height = 96;
    host.appendChild(canvas);
    const ctx2d = canvas.getContext("2d");
    let cachedKey = "";

    return {
        sync() { cachedKey = ""; },
        frame(engine) {
            const voice = engine.getVoice(moduleId);
            if (!voice || !voice.adsr) return;
            const a = voice.adsr;
            const key = [a.a, a.d, a.s, a.r].join(",");
            const dirty = key !== cachedKey;
            if (dirty) cachedKey = key;

            const w = canvas.width;
            const h = canvas.height;
            const pad = 6;
            const total = a.attack + a.decay + 0.4 + a.release || 1;
            const xOf = (t) => pad + (t / total) * (w - pad * 2);
            const yOf = (level) => h - pad - level * (h - pad * 2);

            if (dirty) {
                ctx2d.clearRect(0, 0, w, h);
                ctx2d.strokeStyle = "rgba(255,255,255,0.10)";
                ctx2d.lineWidth = 1;
                ctx2d.beginPath();
                ctx2d.moveTo(pad, yOf(0));
                ctx2d.lineTo(w - pad, yOf(0));
                ctx2d.stroke();

                ctx2d.strokeStyle = "#7CFF6B";
                ctx2d.lineWidth = 2;
                ctx2d.beginPath();
                ctx2d.moveTo(pad, yOf(0));
                ctx2d.lineTo(xOf(a.attack), yOf(1));
                ctx2d.lineTo(xOf(a.attack + a.decay), yOf(a.sustain));
                ctx2d.lineTo(xOf(a.attack + a.decay + 0.4), yOf(a.sustain));
                ctx2d.lineTo(xOf(total), yOf(0));
                ctx2d.stroke();
            }

            const level = voice.level();
            ctx2d.fillStyle = "#7CFF6B";
            ctx2d.beginPath();
            ctx2d.arc(w - pad - 3, yOf(level), 4, 0, Math.PI * 2);
            ctx2d.fill();
        },
    };
};

/* ============================================================
   Rack
   ============================================================ */

class RackUI {
    constructor(options) {
        this.actions = options.actions;
        this.engine = options.engine;
        this.rackArea = options.rackArea;
        this.canvas = options.canvas;
        this.cableLayer = options.cableLayer;
        this.hitLayer = options.hitLayer;
        this.grid = options.grid || null;

        this.modules = new Map();
        this.cables = new Map();
        this.jackOffsets = new Map();
        this.pointer = null;
        this.view = { x: 0, y: 0, k: 1 };
        this._patchFrom = null;
        this._dragging = null;
        this._panning = null;
        this._spaceDown = false;
        this._measureQueued = false;
        this._dirty = true;
        this.meters = true;

        this._preview = svg("path", { class: "cable-preview" });
        this.cableLayer.appendChild(this._preview);

        this._bindRack();
        this._bindCableHover();
    }

    /* ---------- view ---------- */

    setView(view) {
        this.view = view;
        this.canvas.style.transform = "translate(" + view.x + "px," + view.y + "px) scale(" + view.k + ")";
        this._paintGrid();
        // Readouts are counter-scaled to the zoom, so they need redrawing.
        this._redrawCables();
        this.actions.onViewChange(view);
    }

    /**
     * Keep the drawn grid locked to the rack coordinates.
     *
     * The grid lives outside the transformed canvas, so it has to be told
     * where the origin moved and how big a cell is in screen pixels. Offsetting
     * the background by the pan and scaling it by the zoom keeps a module's
     * edge sitting exactly on a line at every zoom level, which is the whole
     * point of a snapping grid.
     */
    _paintGrid() {
        if (!this.grid) return;
        const size = RACK_GRID * this.view.k;
        const major = size * RACK_GRID_MAJOR;
        // Modulo rather than a raw multiply, so a large pan cannot drift the
        // grid off by a rounding error over time.
        const x = ((this.view.x % major) + major) % major;
        const y = ((this.view.y % major) + major) % major;
        this.grid.style.setProperty("--grid-size", size + "px");
        this.grid.style.setProperty("--major-size", major + "px");
        this.grid.style.setProperty("--grid-x", x + "px");
        this.grid.style.setProperty("--grid-y", y + "px");
    }

    rackPoint(clientX, clientY) {
        const rect = this.rackArea.getBoundingClientRect();
        return {
            x: (clientX - rect.left - this.view.x) / this.view.k,
            y: (clientY - rect.top - this.view.y) / this.view.k,
        };
    }

    zoomBy(factor, clientX, clientY) {
        const rect = this.rackArea.getBoundingClientRect();
        const localX = clientX == null ? rect.width / 2 : clientX - rect.left;
        const localY = clientY == null ? rect.height / 2 : clientY - rect.top;
        const before = {
            x: (localX - this.view.x) / this.view.k,
            y: (localY - this.view.y) / this.view.k,
        };
        const k = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.view.k * factor));
        this.setView({ k, x: localX - before.x * k, y: localY - before.y * k });
    }

    fit(modules) {
        if (!modules.length) {
            this.setView({ x: 0, y: 0, k: 1 });
            return;
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const module of modules) {
            const entry = this.modules.get(module.id);
            const width = MODULE_DEFS[module.type].width;
            const height = entry && entry.el.offsetHeight ? entry.el.offsetHeight : 260;
            minX = Math.min(minX, module.x);
            minY = Math.min(minY, module.y);
            maxX = Math.max(maxX, module.x + width);
            maxY = Math.max(maxY, module.y + height);
        }
        const rect = this.rackArea.getBoundingClientRect();
        const pad = 36;
        const k = Math.max(ZOOM_MIN, Math.min(1,
            Math.min((rect.width - pad * 2) / (maxX - minX), (rect.height - pad * 2) / (maxY - minY))));
        this.setView({ k, x: pad - minX * k, y: pad - minY * k });
    }

    /* ---------- render ---------- */

    render(state) {
        const wanted = new Set(state.modules.map((m) => m.id));

        for (const [id, entry] of Array.from(this.modules)) {
            if (!wanted.has(id)) {
                entry.el.remove();
                this.modules.delete(id);
                this.jackOffsets.delete(id);
                this._dirty = true;
            }
        }
        for (const module of state.modules) {
            const entry = this.modules.get(module.id) || this._createModule(module);
            this._updateModule(entry, module, state);
        }

        const wantedCables = new Set(state.cables.map((c) => c.id));
        for (const [id, entry] of Array.from(this.cables)) {
            if (!wantedCables.has(id)) {
                this._destroyCable(entry);
                this.cables.delete(id);
            }
        }
        for (const cable of state.cables) {
            let entry = this.cables.get(cable.id);
            if (!entry) {
                entry = this._createCable();
                this.cables.set(cable.id, entry);
            }
            entry.cable = cable;
            this._drawCable(entry);
        }

        this._queueMeasure();
        this._renderPatchPreview();
    }

    _createModule(module) {
        const def = MODULE_DEFS[module.type];
        const classes = "module module-" + module.type;
        const root = el("div", def.group ? classes + " module-group-" + def.group : classes);
        root.dataset.id = module.id;
        root.style.width = def.width + "px";

        const header = el("div", "module-header");
        const name = el("span", "module-name", def.abbr || def.name);
        name.title = def.name;
        const remove = el("button", "module-remove", "×");
        remove.title = "Remove " + def.name;
        remove.setAttribute("aria-label", "Remove " + def.name);
        remove.addEventListener("pointerdown", (e) => e.stopPropagation());
        remove.addEventListener("click", (e) => {
            e.stopPropagation();
            this.actions.removeModule(module.id);
        });
        header.append(name, remove);

        const body = el("div", "module-body");
        const panel = el("div", "module-panel");
        const controls = el("div", "controls");
        const io = el("div", "io");
        body.append(panel, controls, io);
        root.append(header, body);

        const widgets = {};
        for (const spec of def.controls) {
            const widget = createControl(spec, (value) => this.actions.setControl(module.id, spec.id, value));
            controls.appendChild(widget.el);
            widgets[spec.id] = widget;
        }

        const inCol = el("div", "io-col");
        const outCol = el("div", "io-col");
        const jacks = [];
        for (const port of def.inputs) {
            const jack = createJack(makeJackId(module.id, "in", port.id), "input", port.name);
            inCol.appendChild(jack.group);
            jacks.push(jack.socket);
        }
        for (const port of def.outputs) {
            const jack = createJack(makeJackId(module.id, "out", port.id), "output", port.name);
            outCol.appendChild(jack.group);
            jacks.push(jack.socket);
        }
        if (def.outputs.length) io.append(inCol, outCol);
        else io.append(inCol);

        header.addEventListener("pointerdown", (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            this.actions.selectModule(module.id);
            const point = this.rackPoint(e.clientX, e.clientY);
            this._dragging = { id: module.id, dx: point.x - module.x, dy: point.y - module.y };
            root.classList.add("dragging");
            root.style.zIndex = "60";
        });

        this.canvas.appendChild(root);
        const drawer = PANEL_DRAWERS[def.panel];
        const live = drawer ? drawer(panel, module.id, this.actions) : { sync() {}, frame() {} };
        const entry = { el: root, panel, widgets, jacks, live, moduleId: module.id };
        this.modules.set(module.id, entry);
        this._dirty = true;
        return entry;
    }

    _updateModule(entry, module, state) {
        entry.el.style.transform = "translate(" + module.x + "px," + module.y + "px)";
        entry.el.classList.toggle("selected", state.selected === module.id);
        for (const spec of MODULE_DEFS[module.type].controls) {
            const widget = entry.widgets[spec.id];
            const value = module.controls[spec.id];
            if (widget && Math.abs(widget.getValue() - value) > 1e-6) widget.setValue(value);
        }
        entry.live.sync(module, state);
    }

    _createCable() {
        // Cables are drawn in two layers. The visible lines and readouts sit
        // above the modules, because that is how a rack looks. The fat hit
        // targets sit below them, so a cable crossing a module does not steal
        // clicks from the knobs underneath it.
        const group = svg("g", { class: "cable" });
        // Two strokes: a wide, faint halo for the glow and a crisp core on
        // top. Both are painted from the live signal every frame.
        const halo = svg("path", { class: "cable-halo" });
        const line = svg("path", { class: "cable-line" });
        const readout = svg("text", { class: "cable-value" });
        readout.setAttribute("text-anchor", "middle");
        readout.setAttribute("dominant-baseline", "central");
        group.append(halo, line, readout);
        this.cableLayer.appendChild(group);

        const hit = svg("path", { class: "cable-hit" });
        hit.dataset.cable = "";
        this.hitLayer.appendChild(hit);

        // Only the hit path is clickable: the draw layer is pointer-events
        // none so it can sit over the modules without stealing their clicks.
        const remove = () => { if (entry.cable) this.actions.removeCable(entry.cable.id); };
        hit.addEventListener("pointerdown", remove);

        const entry = { group, halo, line, readout, hit, cable: null, painted: null };
        return entry;
    }

    _destroyCable(entry) {
        entry.group.remove();
        entry.hit.remove();
    }

    _drawCable(entry) {
        const cable = entry.cable;
        if (!cable) return;
        const a = this.jackPoint(cable.from);
        const b = this.jackPoint(cable.to);
        if (!a || !b) {
            entry.group.style.visibility = "hidden";
            entry.hit.style.visibility = "hidden";
            return;
        }
        entry.group.style.visibility = "visible";
        entry.hit.style.visibility = "visible";
        const path = cablePath(a.x, a.y, b.x, b.y);
        entry.halo.setAttribute("d", path.d);
        entry.line.setAttribute("d", path.d);
        entry.hit.setAttribute("d", path.d);
        entry.readout.setAttribute("x", path.mid.x);
        entry.readout.setAttribute("y", path.mid.y);
        entry.hit.dataset.cable = cable.id;
    }

    /** Redraw every cable, e.g. after a zoom changed the readout scale. */
    _redrawCables() {
        for (const entry of this.cables.values()) this._drawCable(entry);
        this._renderPatchPreview();
    }

    /** Hover feedback, driven from the hit layer so the draw layer can stay inert. */
    _bindCableHover() {
        const set = (target, on) => {
            const id = target && target.dataset ? target.dataset.cable : "";
            const entry = id ? this.cables.get(id) : null;
            if (!entry) return;
            entry.group.classList.toggle("hover", on);
            const measure = this.meters === false || !entry.cable ? null : this.engine.measureOutput(entry.cable.from);
            this._paintCable(entry, measure);
        };
        this.hitLayer.addEventListener("pointerover", (e) => set(e.target, true));
        this.hitLayer.addEventListener("pointerout", (e) => set(e.target, false));
    }

    jackPoint(jackId) {
        const parsed = parseJackId(jackId);
        if (!parsed) return null;
        const module = this.actions.moduleById(parsed.moduleId);
        if (!module) return null;
        const offsets = this.jackOffsets.get(parsed.moduleId);
        const offset = offsets && offsets.get(jackId);
        if (!offset) return null;
        return { x: module.x + offset.dx, y: module.y + offset.dy };
    }

    /* ---------- jack measurement ---------- */

    _queueMeasure() {
        if (!this._dirty || this._measureQueued) return;
        this._measureQueued = true;
        // One batched pass per frame: reading every jack rect back to back costs
        // a single layout flush, and only happens while something is dirty.
        requestAnimationFrame(() => {
            this._measureQueued = false;
            this._dirty = false;
            for (const [id, entry] of this.modules) {
                const base = entry.el.getBoundingClientRect();
                if (!base.width) continue;
                const offsets = new Map();
                for (const socket of entry.jacks) {
                    const rect = socket.getBoundingClientRect();
                    offsets.set(socket.dataset.jack, {
                        dx: (rect.left + rect.width / 2 - base.left) / this.view.k,
                        dy: (rect.top + rect.height / 2 - base.top) / this.view.k,
                    });
                }
                this.jackOffsets.set(id, offsets);
            }
            for (const entry of this.cables.values()) this._drawCable(entry);
            this._renderPatchPreview();
        });
    }

    /* ---------- patching ---------- */

    setPatchSource(jackId) {
        this._patchFrom = jackId;
        for (const entry of this.modules.values()) {
            for (const socket of entry.jacks) {
                socket.classList.toggle("armed", socket.dataset.jack === jackId);
            }
        }
        this._renderPatchPreview();
    }

    canDrop(targetJackId) {
        return this._patchFrom ? canPatch(this._patchFrom, targetJackId) : false;
    }

    _renderPatchPreview() {
        if (!this._patchFrom || !this.pointer) {
            this._preview.setAttribute("d", "");
            return;
        }
        const from = this.jackPoint(this._patchFrom);
        if (!from) return;
        this._preview.setAttribute("d", cablePath(from.x, from.y, this.pointer.x, this.pointer.y).d);
    }

    /**
     * Paint one cable from its live measurement.
     * Quantising the drive keeps steady signals from writing styles on every
     * single frame, and the CSS transition covers the difference.
     */
    _paintCable(entry, measure) {
        const hover = entry.group.classList.contains("hover") ? 1.45 : 1;
        const colour = cableColor(measure) || CABLE_IDLE;
        const drive = Math.round(cableIntensity(measure) * 100) / 100;

        const signature = colour + "|" + drive + "|" + hover + "|" + (measure ? formatCableValue(measure) : "");
        if (signature === entry.painted) return;
        entry.painted = signature;

        entry.line.style.stroke = colour;
        entry.line.style.strokeWidth = ((2.4 + drive * 1.7) * hover).toFixed(2) + "px";
        entry.halo.style.stroke = colour;
        entry.halo.style.strokeWidth = ((5 + drive * 12) * hover).toFixed(2) + "px";
        entry.halo.style.strokeOpacity = (0.06 + drive * 0.3).toFixed(3);

        // The readout keeps its own colours: its stroke is a dark outline for
        // legibility, and a dim number next to a dark cable would be unreadable.
        if (measure) {
            entry.readout.textContent = formatCableValue(measure);
            const live = measure.cv ? Math.abs(measure.signed) > 0.005 : measure.peak > 0.001;
            entry.readout.classList.toggle("on", live);
        } else {
            entry.readout.textContent = "";
        }
    }

    /**
     * Refresh every cable's colour and glow.
     * Each measurement is a cheap sum over a 32-sample buffer, and the
     * analyser feeding it hangs off the source as a side branch.
     */
    _updateReadouts() {
        if (this.meters === false) return;
        for (const entry of this.cables.values()) {
            if (!entry.cable) continue;
            this._paintCable(entry, this.engine.measureOutput(entry.cable.from));
        }
    }

    setMeters(on) {
        this.meters = on;
        this.cableLayer.classList.toggle("meters-off", !on);
        if (on) return;
        // Back to plain, uniform cables.
        for (const entry of this.cables.values()) this._paintCable(entry, null);
    }

    /* ---------- interaction ---------- */

    _bindRack() {
        const area = this.rackArea;

        // Arm a patch from any jack, by click or by dragging out of it.
        area.addEventListener("pointerdown", (e) => {
            const socket = e.target.closest ? e.target.closest(".jack") : null;
            if (socket && e.button === 0) {
                e.preventDefault();
                e.stopPropagation();
                this.actions.armPatch(socket.dataset.jack);
                return;
            }
            if (e.button === 1 || (e.button === 0 && this._spaceDown)) {
                e.preventDefault();
                this._panning = { x: e.clientX, y: e.clientY, viewX: this.view.x, viewY: this.view.y };
                return;
            }
            if (e.button === 0 && !e.target.closest(".module") && !e.target.closest(".cable")) {
                this.actions.selectModule(null);
            }
        });

        area.addEventListener("pointermove", (e) => {
            if (this._panning) {
                this.setView({
                    ...this.view,
                    x: this._panning.viewX + (e.clientX - this._panning.x),
                    y: this._panning.viewY + (e.clientY - this._panning.y),
                });
                return;
            }
            if (this._dragging) {
                const point = this.rackPoint(e.clientX, e.clientY);
                this.actions.moveModule(
                    this._dragging.id,
                    snapToGrid(point.x - this._dragging.dx),
                    snapToGrid(point.y - this._dragging.dy)
                );
                return;
            }
            this.pointer = this.rackPoint(e.clientX, e.clientY);
            this._renderPatchPreview();
        });

        area.addEventListener("pointerup", (e) => {
            if (this._dragging) {
                const entry = this.modules.get(this._dragging.id);
                if (entry) {
                    entry.el.classList.remove("dragging");
                    entry.el.style.zIndex = "";
                }
                this._dragging = null;
            }
            if (this._panning) this._panning = null;
            if (this._patchFrom) {
                // Releasing on a jack completes the cable; releasing anywhere
                // else leaves it armed for click-to-patch.
                const socket = e.target.closest ? e.target.closest(".jack") : null;
                if (socket && this.canDrop(socket.dataset.jack)) {
                    this.actions.completePatch(this._patchFrom, socket.dataset.jack);
                }
            }
        });

        area.addEventListener("wheel", (e) => {
            e.preventDefault();
            if (e.shiftKey) {
                this.setView({ ...this.view, x: this.view.x - e.deltaY });
                return;
            }
            this.zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
        }, { passive: false });

        area.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            this.actions.cancelPatch();
        });

        area.addEventListener("pointerover", (e) => {
            const socket = e.target.closest ? e.target.closest(".jack") : null;
            if (socket) socket.classList.toggle("droppable", this.canDrop(socket.dataset.jack));
        });
        area.addEventListener("pointerout", (e) => {
            const socket = e.target.closest ? e.target.closest(".jack") : null;
            if (socket) socket.classList.remove("droppable");
        });

        window.addEventListener("keydown", (e) => {
            if (e.code === "Space" && !e.repeat && !isTypingTarget(e.target)) this._spaceDown = true;
        });
        window.addEventListener("keyup", (e) => {
            if (e.code === "Space") this._spaceDown = false;
        });
    }

    frame() {
        // A panel that throws here would take the engine's frame loop with it,
        // which would stall the sequencer, so failures are contained.
        for (const entry of this.modules.values()) {
            if (!entry.live.frame) continue;
            try {
                entry.live.frame(this.engine);
            } catch (err) {
                console.error("[synth] panel draw failed for " + entry.moduleId, err);
            }
        }
        try {
            this._updateReadouts();
        } catch (err) {
            console.error("[synth] cable readout failed", err);
        }
    }
}

function isTypingTarget(node) {
    if (!node || !node.tagName) return false;
    const tag = node.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || node.isContentEditable;
}