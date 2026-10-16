/* ============================================================
   Modular Synth — DOM harness.

   The repo has no jsdom and no headless browser, so this provides just
   enough DOM for app.js and ui-manager.js to run end to end: the page
   boots, the default patch is built, cables are connected in the audio
   graph, and modules can be patched and removed.

   Run: node ui-test.mjs
   ============================================================ */

import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/* ---------- minimal DOM ---------- */

const SVG_NS = "http://www.w3.org/2000/svg";

let nodeSeq = 0;

class FakeNode {
    constructor(tag, ns) {
        this.tagName = String(tag).toUpperCase();
        this.namespaceURI = ns || null;
        this.uid = nodeSeq++;
        this.childNodes = [];
        this.parentNode = null;
        this.attributes = {};
        this.dataset = {};
        this.style = makeStyle();
        this.listeners = new Map();
        this._text = "";
        this.value = 0;
        this.width = 300;
        this.height = 150;
        this.disabled = false;
        this.draggable = false;
        this.tabIndex = -1;
        this.title = "";
    }

    get children() { return this.childNodes; }

    get className() { return this.attributes.class || ""; }
    set className(value) { this.attributes.class = String(value); }

    get classList() {
        const owner = this;
        const read = () => (owner.attributes.class || "").split(/\s+/).filter(Boolean);
        const write = (list) => { owner.attributes.class = list.join(" "); };
        return {
            add(...names) { const l = read(); for (const n of names) if (!l.includes(n)) l.push(n); write(l); },
            remove(...names) { write(read().filter((n) => !names.includes(n))); },
            contains(name) { return read().includes(name); },
            toggle(name, force) {
                const has = read().includes(name);
                const want = force === undefined ? !has : !!force;
                if (want && !has) this.add(name);
                if (!want && has) this.remove(name);
                return want;
            },
        };
    }

    get textContent() {
        if (this.childNodes.length === 0) return this._text;
        return this.childNodes.map((c) => c.textContent).join("");
    }
    set textContent(value) { this._text = String(value); this.childNodes = []; }

    get offsetHeight() { return 40 + this.childNodes.length * 4; }

    append(...nodes) {
        for (const node of nodes) this.appendChild(typeof node === "string" ? new FakeNode("span") : node);
    }

    appendChild(node) {
        node.parentNode = this;
        this.childNodes.push(node);
        this._text = "";
        return node;
    }

    remove() {
        if (!this.parentNode) return;
        const i = this.parentNode.childNodes.indexOf(this);
        if (i >= 0) this.parentNode.childNodes.splice(i, 1);
        this.parentNode = null;
    }

    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name]; }

    matches(selector) {
        if (selector.startsWith(".")) return this.classList.contains(selector.slice(1));
        return this.tagName === selector.toUpperCase();
    }

    closest(selector) {
        let node = this;
        while (node) {
            if (node.matches && node.matches(selector)) return node;
            node = node.parentNode;
        }
        return null;
    }

    getBoundingClientRect() {
        return { left: 0, top: 0, right: 100, bottom: 40, width: 100, height: 40 };
    }

    addEventListener(type, fn) {
        if (!this.listeners.has(type)) this.listeners.set(type, []);
        this.listeners.get(type).push(fn);
    }

    dispatch(type, event) {
        const base = {
            type,
            target: this,
            currentTarget: this,
            button: 0,
            buttons: 1,
            preventDefault() {},
            stopPropagation() {},
            clientX: 0,
            clientY: 0,
            shiftKey: false,
            metaKey: false,
            ctrlKey: false,
            repeat: false,
            code: "",
            key: "",
        };
        for (const fn of this.listeners.get(type) || []) fn(Object.assign(base, event));
    }

    click() { this.dispatch("click", {}); }
    setPointerCapture() {}
    releasePointerCapture() {}
    hasPointerCapture() { return false; }
    getContext() { return make2DContext(); }
    focus() {}
}

function makeStyle() {
    // Custom properties live in their own map: in a real CSSStyleDeclaration
    // `style["--x"]` is not how you read a custom property back, so storing
    // them as ordinary keys would let a test pass against a fake API.
    const custom = new Map();
    const style = {
        setProperty(name, value) { custom.set(name, String(value)); },
        getPropertyValue(name) { return custom.get(name) || ""; },
        removeProperty(name) { custom.delete(name); },
    };
    for (const name of ["transform", "width", "left", "top", "visibility", "zIndex"]) {
        style[name] = "";
    }
    return style;
}

function make2DContext() {
    return {
        canvas: null,
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 1,
        fillRect() {},
        clearRect() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        arc() {},
        stroke() {},
        fill() {},
    };
}

const registry = new Map();

function register(id, node) {
    node.attributes.id = id;
    registry.set(id, node);
    return node;
}

function buildDocument() {
    for (const id of [
        "sidebar", "rackArea", "rackCanvas", "cableLayer", "cableHitLayer",
        "status", "zoomLabel", "overlay", "patchFile", "btnMeters",
        "btnSave", "btnLoad", "btnClear", "btnReset", "btnFit", "btnZoomOut", "btnZoomIn",
    ]) register(id, new FakeNode(id === "cableLayer" || id === "cableHitLayer" ? "svg" : "div"));

    // The rack fills a plausible viewport so fit() and zoom() do something sane.
    registry.get("rackArea").getBoundingClientRect = () => ({
        left: 0, top: 0, right: 1200, bottom: 700, width: 1200, height: 700,
    });

    const power = new FakeNode("button");
    register("power", power);
    power.disabled = false;

    const fileInput = new FakeNode("input");
    register("patchFile", fileInput);
    fileInput.files = [];

    // The rack grid and major grid, as children of the rack area, mirroring
    // index.html. The UI reaches them by class, so this has to be real: a
    // querySelector stub returning null would quietly skip grid wiring.
    for (const className of ["rack-grid", "rack-grid-major"]) {
        const layer = new FakeNode("div");
        layer.className = className;
        registry.get("rackArea").appendChild(layer);
    }

    const document = {
        createElement(tag) { return new FakeNode(tag); },
        createElementNS(ns, tag) { return new FakeNode(tag, ns); },
        getElementById(id) { return registry.get(id) || null; },
        querySelector(selector) {
            const wanted = selector.replace(/^\./, "");
            const find = (node) => {
                for (const child of node.childNodes || []) {
                    if (child.className === wanted) return child;
                    const hit = find(child);
                    if (hit) return hit;
                }
                return null;
            };
            return find(registry.get("rackArea"));
        },
    };
    return document;
}

/* ---------- harness ---------- */

let passed = 0;
const failures = [];
let group = "";

function describe(name, fn) { group = name; fn(); }

async function it(name, fn) {
    try {
        await fn();
        passed++;
    } catch (err) {
        failures.push(group + " :: " + name + "\n    " + (err && err.message));
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message || "assertion failed");
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error((message || "values differ") + ": expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual));
    }
}

/* ---------- environment ---------- */

const document = buildDocument();
const frames = [];

const context = vm.createContext({
    console,
    Math,
    JSON,
    Object,
    Array,
    Set,
    Map,
    Error,
    Number,
    Boolean,
    Date,
    String,
    isFinite,
    parseInt,
    parseFloat,
    document,
    navigator: {},
    window: {
        AudioContext: class {
            constructor() { this.state = "running"; this.currentTime = 0; this.destination = new FakeNode("node"); }
            resume() { return Promise.resolve(); }
            close() { return Promise.resolve(); }
            createOscillator() { return node("osc"); }
            createGain() { const n = node("gain"); n.gain.value = 1; n.gain.baseValue = 1; return n; }
            createBiquadFilter() { return node("biquad"); }
            createDelay() { return node("delay"); }
            createAnalyser() { return node("analyser"); }
            createConstantSource() { return node("constant"); }
            createWaveShaper() { const n = node("shaper"); n.curve = null; return n; }
            createBufferSource() { const n = node("bufferSource"); n.loop = false; n.buffer = null; return n; }
            createBuffer(channels, length, rate) {
                const data = [];
                for (let c = 0; c < channels; c++) data.push(new Float32Array(length));
                return {
                    numberOfChannels: channels,
                    length,
                    sampleRate: rate,
                    getChannelData(c) { return data[c]; },
                };
            }
        },
        addEventListener() {},
        confirm: () => true,
    },
    requestAnimationFrame(fn) { frames.push(fn); return frames.length; },
    cancelAnimationFrame() {},
    setTimeout: () => 0,
    clearTimeout: () => {},
    Blob: class {},
    URL: { createObjectURL: () => "blob:x", revokeObjectURL: () => {} },
});

/**
 * A mock audio node. `kind` matters: the graph walker and the buffer-source
 * lookup both need to tell a ConstantSourceNode from a GainNode, and every
 * factory used to return an indistinguishable "node".
 */
function node(kind = "node") {
    const n = new FakeNode(kind);
    n.kind = kind;
    n.connections = [];
    n.start = () => { n.started = true; };
    n.stop = () => { n.stopped = true; };
    // Upstream/downstream edges, and modulation edges into AudioParams.
    // Without these the harness cannot tell a wired module from an
    // unconnected one, so a patch that silently failed looked correct.
    n.inputs = [];
    n.paramInputs = [];
    n.connect = (dest) => {
        if (dest && dest.isAudioParam) {
            if (dest.owner && dest.owner.paramInputs) dest.owner.paramInputs.push(n);
        } else {
            n.connections.push(dest);
            if (dest && dest.inputs) dest.inputs.push(n);
        }
        return dest;
    };
    n.disconnect = (dest) => {
        if (dest === undefined) {
            for (const d of n.connections) {
                if (d && d.inputs) {
                    const i = d.inputs.indexOf(n);
                    if (i >= 0) d.inputs.splice(i, 1);
                }
            }
            n.connections = [];
        } else if (dest && dest.isAudioParam) {
            const i = dest.owner.paramInputs.indexOf(n);
            if (i >= 0) dest.owner.paramInputs.splice(i, 1);
        } else {
            const i = n.connections.indexOf(dest);
            if (i >= 0) n.connections.splice(i, 1);
            if (dest && dest.inputs) {
                const j = dest.inputs.indexOf(n);
                if (j >= 0) dest.inputs.splice(j, 1);
            }
        }
        return n;
    };
    // Byte data has to reflect `sample` too. It is hardcoded to the 128
    // midpoint here, which silently pins every gate follower to "closed" —
    // so any module clocked by a gate appeared dead.
    n.getByteTimeDomainData = (buffer) => {
        for (let i = 0; i < buffer.length; i++) buffer[i] = Math.round(128 + n.sample * 127);
    };
    n.getFloatTimeDomainData = (buffer) => buffer.fill(n.sample);
    for (const name of ["frequency", "detune", "gain", "Q", "delayTime", "offset"]) {
        const p = makeParam();
        p.owner = n;
        n[name] = p;
    }
    n.isAudioParam = false;
    return n;
}

/**
 * An AudioParam that actually moves over time.
 *
 * The UI harness used no-op params, so `offset.value` never changed and any
 * module that ramps an AudioParam over time — the sample and hold's glide, the
 * envelope — was untestable here. This tracks the same event kinds as the
 * engine harness so `valueAt(t)` resolves a real ramp.
 */
function makeParam() {
    let seq = 0;
    const events = [];
    const param = {
        isAudioParam: true,
        owner: null,
        value: 0,
        baseValue: 0,
        automation: events,
        setValueAtTime(v, t) {
            this.value = v;
            for (let i = events.length - 1; i >= 0; i--) {
                if (events[i].t > t) events.splice(i, 1);
            }
            events.push({ k: "set", v, t, seq: seq++ });
            return this;
        },
        linearRampToValueAtTime(v, t) {
            this.value = v;
            events.push({ k: "ramp", v, t, seq: seq++ });
            return this;
        },
        setTargetAtTime(v, t, c) {
            this.value = v;
            events.push({ k: "target", v, t, c, seq: seq++ });
            return this;
        },
        cancelScheduledValues(t) {
            for (let i = events.length - 1; i >= 0; i--) {
                if (events[i].t >= t) events.splice(i, 1);
            }
            return this;
        },
        cancelAndHoldAtTime(t) {
            const held = param.valueAt(t);
            for (let i = events.length - 1; i >= 0; i--) {
                if (events[i].t >= t) events.splice(i, 1);
            }
            events.push({ k: "hold", v: held, t, seq: seq++ });
            return this;
        },
        connect() { return this; },
        disconnect() { return this; },
        valueAt(t) {
            const sorted = events.slice().sort((a, b) => a.t - b.t || a.seq - b.seq);
            let value = this.baseValue;
            let anchor = this.baseValue;
            let anchorT = -Infinity;
            for (const e of sorted) {
                if (e.t > t) break;
                if (e.k === "set" || e.k === "hold") {
                    anchor = e.v;
                    anchorT = e.t;
                    value = e.v;
                } else if (e.k === "ramp") {
                    const span = e.t - anchorT;
                    const f = span > 0 ? Math.min(1, Math.max(0, (t - anchorT) / span)) : 1;
                    value = anchor + (e.v - anchor) * f;
                } else if (e.k === "target") {
                    value = e.v + (anchor - e.v) * Math.exp(-Math.max(0, t - anchorT) / e.c);
                }
            }
            return value;
        },
    };
    return param;
}

/**
 * Signal value of a node at time `t`.
 * Mirrors the engine harness so a patch can be checked for actually carrying
 * audio. `seen` terminates the delay's feedback loop.
 */
function outputAt(node, t, seen) {
    if (!node || (seen.has(node) || seen.size > 64)) return 0;
    seen.add(node);
    let value = 0;
    if (node.kind === "constant") {
        value = node.offset.valueAt(t);
    } else if (node.kind === "osc") {
        value = Math.sin(2 * Math.PI * node.frequency.valueAt(t) * t);
    } else if (node.kind === "bufferSource") {
        const data = node.buffer && node.buffer.getChannelData(0);
        if (data && data.length) value = data[Math.floor(t * node.buffer.sampleRate) % data.length];
    } else {
        for (const src of node.inputs) value += outputAt(src, t, seen);
    }
    seen.delete(node);
    if (node.kind === "gain") value *= node.gain.valueAt(t);
    return value;
}

/**
 * Push the audio clock's value of every node a live voice owns into `.sample`,
 * so analysers report what the graph is really carrying. Mirrors
 * engine.ctx.refresh() in the engine harness; without it a test can only poke
 * samples by hand and cannot prove a patch carries audio.
 */
function refreshGraph(engine) {
    const now = engine.ctx.currentTime;
    for (const voice of engine.voices.values()) {
        for (const node of voice.owned || []) {
            node.sample = Math.max(-2, Math.min(2, outputAt(node, now, new Set())));
        }
    }
}

const errors = [];
vm.runInContext("window.addEventListener = window.addEventListener || function(){};", context);
for (const file of ["constants.js", "patch.js", "dsp.js", "audio-engine.js", "ui-manager.js", "app.js"]) {
    try {
        vm.runInContext(fs.readFileSync(path.join(here, file), "utf8"), context, { filename: file });
    } catch (err) {
        errors.push("loading " + file + ": " + err.message);
    }
}

const run = (expression) => vm.runInContext(expression, context);

function flushFrames() {
    let guard = 0;
    while (frames.length && guard++ < 50) frames.shift()();
}

/** Drain the microtask queue so awaited async handlers finish. */
async function settle() {
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    flushFrames();
}

function collect(node, predicate, out = []) {
    for (const child of node.childNodes) {
        if (predicate(child)) out.push(child);
        collect(child, predicate, out);
    }
    return out;
}

const modules = () => run("store").get().modules;
const cables = () => run("store").get().cables;
const engine = () => run("engine");
const ui = () => run("ui");
const actions = () => run("actions");

/* ============================================================ */

await it("all scripts load without a syntax or load error", () => {
    assert(errors.length === 0, errors.join("; "));
});

await it("builds the sidebar from the module table", () => {
    const items = registry.get("sidebar").childNodes;
    const defs = run("MODULE_DEFS");
    assertEqual(items.length, Object.keys(defs).length, "wrong number of sidebar items");
    assertEqual(items[0].childNodes[0].textContent, defs.oscillator.abbr, "first item is not the oscillator");
    // Every type in the table has to reach the sidebar, or a module exists that
    // cannot be added. Comparing counts alone would not catch a rename.
    const listed = items.map((item) => item.childNodes[1].textContent);
    for (const name of Object.values(defs).map((d) => d.name)) {
        assert(listed.includes(name), "sidebar is missing " + name);
    }
});

/* ============================================================
   Rack grid
   ============================================================ */

await it("snaps a dragged module onto the grid", async () => {
    await settle();
    registry.get("power").click();
    await settle();

    const target = modules()[0];
    const grid = run("RACK_GRID");
    actions().moveModule(target.id, 137, 213);
    const moved = modules().find((m) => m.id === target.id);
    assert(moved.x % grid === 0, "x landed off the grid: " + moved.x);
    assert(moved.y % grid === 0, "y landed off the grid: " + moved.y);
    assertEqual(moved.x, 140, "137 should snap to 140 at a grid of " + grid);
    assertEqual(moved.y, 220, "213 should snap to 220 at a grid of " + grid);
});

await it("keeps every module on the grid in the default patch", async () => {
    await settle();
    registry.get("power").click();
    await settle();
    const grid = run("RACK_GRID");
    for (const m of modules()) {
        assert(m.x % grid === 0 && m.y % grid === 0,
            m.type + " sits off the grid at " + m.x + "," + m.y);
    }
});

await it("lets neighbours tile edge to edge without a gap", async () => {
    await settle();
    registry.get("power").click();
    await settle();
    const grid = run("RACK_GRID");
    // Two modules at the same x, dropped side by side: the second should start
    // exactly where the first ends.
    const a = modules()[0];
    const width = run("MODULE_DEFS")[a.type].width;
    assert(width % grid === 0, a.type + " is " + width + "px wide, off the grid");
    actions().moveModule(a.id, 100, 100);
    const at = modules().find((m) => m.id === a.id);
    assertEqual(at.x, 100, "100 is not on the grid");
    assertEqual(at.x + width, 100 + width, "width and position disagree");
});

await it("draws the grid in rack units and follows the pan and zoom", async () => {
    await settle();
    registry.get("power").click();
    await settle();

    const gridEl = registry.get("rackArea").childNodes.find((n) => n.className === "rack-grid");
    assert(gridEl, "no grid element in the rack area");
    assert(ui().grid === gridEl, "the UI is not pointed at the grid element");

    const grid = run("RACK_GRID");
    ui().setView({ x: 0, y: 0, k: 1 });
    assertEqual(gridEl.style.getPropertyValue("--grid-size"), grid + "px", "wrong cell size at 100%");

    ui().setView({ x: 0, y: 0, k: 2 });
    assertEqual(gridEl.style.getPropertyValue("--grid-size"), grid * 2 + "px", "the grid did not scale with zoom");

    // The offset is applied modulo the major spacing, so a long pan cannot
    // drift the grid away from the modules it is supposed to line up with.
    ui().setView({ x: 100000, y: 0, k: 1 });
    const offset = parseFloat(gridEl.style.getPropertyValue("--grid-x"));
    assert(offset >= 0 && offset <= grid * run("RACK_GRID_MAJOR"),
        "grid offset drifted out of range: " + offset);
});

await it("powers on loads the default patch", async () => {
    registry.get("power").click();
    await settle();
    assert(modules().length >= 6, "expected a default patch, got " + modules().length);
    assert(cables().length >= 6, "expected cables, got " + cables().length);
});

await it("renders one element per module and one group per cable", () => {
    flushFrames();
    const canvas = registry.get("rackCanvas");
    const moduleEls = collect(canvas, (n) => n.classList.contains("module"));
    assertEqual(moduleEls.length, modules().length, "module element count");
    const cableEls = collect(registry.get("cableLayer"), (n) => n.classList.contains("cable"));
    assertEqual(cableEls.length, cables().length, "cable element count");
});

await it("wires the default patch into the audio graph", () => {
    const connections = engine().connections;
    assertEqual(connections.size, cables().length, "not every default cable reached the audio graph");
});

await it("draws a path for every cable once jacks are measured", () => {
    flushFrames();
    for (const entry of ui().cables.values()) {
        assert(typeof entry.line.getAttribute("d") === "string", "a cable has no path data");
        assert(entry.line.getAttribute("d").startsWith("M "), "malformed cable path");
    }
});

await it("renders every jack the patch refers to", () => {
    const jacks = new Set();
    for (const entry of ui().modules.values()) for (const socket of entry.jacks) jacks.add(socket.dataset.jack);
    for (const cable of cables()) {
        assert(jacks.has(cable.from), "no socket for " + cable.from);
        assert(jacks.has(cable.to), "no socket for " + cable.to);
    }
});

await it("arms a patch from a jack and refuses illegal drops", () => {
    const osc = modules().find((m) => m.type === "oscillator");
    const source = osc.id + "-out-out";
    actions().armPatch(source);
    assertEqual(run("store").get().patching, source, "patch did not arm");
    assert(!ui().canDrop(osc.id + "-in-voct"), "a module was allowed to patch into itself");
    const vcf = modules().find((m) => m.type === "vcf");
    assert(ui().canDrop(vcf.id + "-in-in"), "a legal drop was refused");
    assert(!ui().canDrop(osc.id + "-out-out"), "output to output was allowed");
    actions().cancelPatch();
    assertEqual(run("store").get().patching, null, "cancel left the patch armed");
});

await it("creates a cable from a completed patch and connects it", () => {
    actions().addModule("mixer");
    const mixer = modules().find((m) => m.type === "mixer");
    const vca = modules().find((m) => m.type === "vca");
    const from = vca.id + "-out-out";
    const to = mixer.id + "-in-in2";
    assert(!cables().some((c) => c.from === from && c.to === to), "already patched");
    actions().completePatch(from, to);
    const made = cables().find((c) => c.from === from && c.to === to);
    assert(made, "cable was not created");
    assert(engine().connections.has(made.id), "cable did not reach the audio graph");
});

await it("rejects a backwards cable with a message", () => {
    const before = cables().length;
    const vca = modules().find((m) => m.type === "vca");
    actions().completePatch(vca.id + "-in-cv", vca.id + "-out-out");
    assertEqual(cables().length, before, "an invalid cable was created");
    assert(registry.get("status").textContent.length > 0, "no error was surfaced");
});

await it("deletes a cable when it is clicked", () => {
    flushFrames();
    const target = cables()[cables().length - 1];
    const before = cables().length;
    // The hit path is the click target: the draw layer is pointer-events none.
    ui().cables.get(target.id).hit.dispatch("pointerdown", {});
    assertEqual(cables().length, before - 1, "the cable survived being clicked");
    assert(!engine().connections.has(target.id), "the audio connection survived");
});

await it("highlights a cable when the pointer is over its hit target", () => {
    flushFrames();
    const cable = cables()[0];
    const entry = ui().cables.get(cable.id);
    registry.get("cableHitLayer").dispatch("pointerover", { target: entry.hit });
    assert(entry.group.classList.contains("hover"), "hover not reflected on the visible cable");
    registry.get("cableHitLayer").dispatch("pointerout", { target: entry.hit });
    assert(!entry.group.classList.contains("hover"), "hover not cleared");
});

await it("removes a module, its cables and its audio nodes", () => {
    flushFrames();
    const mixer = modules().find((m) => m.type === "mixer");
    const vca = modules().find((m) => m.type === "vca");
    actions().completePatch(vca.id + "-out-out", mixer.id + "-in-in3");
    assert(cables().some((c) => c.to.startsWith(mixer.id)), "could not patch the mixer");
    assert(engine().getVoice(mixer.id), "no audio voice for the module");

    actions().removeModule(mixer.id);

    assert(!modules().some((m) => m.id === mixer.id), "module still in state");
    assert(!cables().some((c) => c.from.startsWith(mixer.id) || c.to.startsWith(mixer.id)), "cables still in state");
    assertEqual(engine().getVoice(mixer.id), undefined, "audio voice still alive");
    for (const conn of engine().connections.values()) {
        assert(!conn.from.startsWith(mixer.id) && !conn.to.startsWith(mixer.id), "audio connection survived");
    }
    flushFrames();
    const moduleEls = collect(registry.get("rackCanvas"), (n) => n.classList.contains("module"));
    assertEqual(moduleEls.length, modules().length, "stale module element left in the DOM");
});

await it("adds a module from the sidebar", () => {
    flushFrames();
    const before = modules().length;
    registry.get("sidebar").childNodes[0].click();
    flushFrames();
    assertEqual(modules().length, before + 1, "module not added");
    const moduleEls = collect(registry.get("rackCanvas"), (n) => n.classList.contains("module"));
    assertEqual(moduleEls.length, modules().length, "module element not rendered");
    assert(engine().getVoice(modules()[modules().length - 1].id), "no audio voice for the new module");
});

await it("drives a knob from a pointer drag", () => {
    flushFrames();
    const target = modules().find((m) => m.type === "output");
    const entry = ui().modules.get(target.id);
    const widget = entry.widgets.vol;
    const dial = widget.el.childNodes[0];
    const before = target.controls.vol;

    dial.dispatch("pointerdown", { clientY: 100, pointerId: 1 });
    dial.dispatch("pointermove", { clientY: 40, pointerId: 1, shiftKey: false });
    dial.dispatch("pointerup", { pointerId: 1 });

    // State updates are immutable, so re-read the module.
    const after = modules().find((m) => m.id === target.id).controls.vol;
    assert(after > before, "knob did not increase on an upward drag: " + before + " -> " + after);
    assertEqual(widget.getValue(), after, "widget and state disagree");
});

await it("resets a knob on double click", () => {
    const target = modules().find((m) => m.type === "output");
    const dial = ui().modules.get(target.id).widgets.vol.el.childNodes[0];
    dial.dispatch("dblclick", {});
    const after = modules().find((m) => m.id === target.id).controls.vol;
    assertEqual(after, run("MODULE_DEFS").output.controls.find((c) => c.id === "vol").default, "knob did not reset");
});

await it("fine-tunes a knob with shift held", () => {
    const target = modules().find((m) => m.type === "output");
    const dial = ui().modules.get(target.id).widgets.vol.el.childNodes[0];
    dial.dispatch("pointerdown", { clientY: 100, pointerId: 2 });
    dial.dispatch("pointermove", { clientY: 40, pointerId: 2, shiftKey: true });
    dial.dispatch("pointerup", { pointerId: 2 });
    const after = modules().find((m) => m.id === target.id).controls.vol;
    assert(Math.abs(after - 0.6) < 0.02, "shift drag should move about 0.06, got " + after);
});

await it("keeps the zoom in range", () => {
    for (let i = 0; i < 40; i++) actions().zoom(1.5);
    assert(ui().view.k <= run("ZOOM_MAX"), "zoom escaped above the maximum: " + ui().view.k);
    for (let i = 0; i < 80; i++) actions().zoom(0.5);
    assert(ui().view.k >= run("ZOOM_MIN"), "zoom escaped below the minimum: " + ui().view.k);
});

await it("applies the rack transform to the canvas", () => {
    const transform = registry.get("rackCanvas").style.transform;
    assert(/^translate\(-?[\d.]+px,-?[\d.]+px\) scale\([\d.]+\)$/.test(transform), "bad transform: " + transform);
});

await it("clears the rack and tears every voice down", () => {
    actions().clear();
    flushFrames();
    assertEqual(modules().length, 0, "modules remain");
    assertEqual(cables().length, 0, "cables remain");
    assertEqual(engine().voices.size, 0, "audio voices remain");
    assertEqual(engine().connections.size, 0, "audio connections remain");
    assertEqual(collect(registry.get("rackCanvas"), (n) => n.classList.contains("module")).length, 0, "DOM modules remain");
});

await it("reloads the default patch after clearing", () => {
    actions().reset();
    flushFrames();
    assert(modules().length >= 6, "default patch did not come back");
    assertEqual(engine().connections.size, cables().length, "graph not rebuilt");
});

await it("draws a frame with every module type present", () => {
    actions().clear();
    flushFrames();
    for (const type of run("MODULE_ORDER")) actions().addModule(type);
    flushFrames();
    assertEqual(modules().length, Object.keys(run("MODULE_DEFS")).length, "not every module type added");

    // Every panel must survive being drawn, and must not take the engine loop down.
    for (const entry of Object.values(ui().modules)) {
        assert(entry.live && typeof entry.live.frame === "function", entry.moduleId + " panel has no frame()");
        assert(typeof entry.live.sync === "function", entry.moduleId + " panel has no sync()");
    }
    ui().frame();
    ui().frame();
});

await it("keeps the sequencer clock advancing", () => {
    actions().clear();
    actions().addModule("sequencer");
    const seq = modules().find((m) => m.type === "sequencer");
    const voice = engine().getVoice(seq.id);
    actions().setControl(seq.id, "run", 1);
    assert(voice.runtime.running, "run did not start the clock");
    const before = voice.runtime.step;
    run("engine").ctx.currentTime += 1;
    flushFrames();
    assert(voice.runtime.step !== before || voice.runtime.pending.length > 0, "clock never advanced");
});

/* ============================================================
   Cables: layering and readouts
   ============================================================ */

/**
 * Drive a metering tap with a known level. In a browser the analyser sees the
 * real signal; here it reads a `sample` property off the analyser node.
 */
function meter(moduleId, port, level) {
    engine().measureOutput(moduleId + "-out-" + port);
    engine().getVoice(moduleId).taps.get(port).analyser.sample = level;
}

await it("restores the default patch for the cable tests", () => {
    actions().reset();
    flushFrames();
    assert(cables().length > 0, "test needs cables");
});

await it("draws cables above modules but aims clicks below them", () => {
    const cableIds = cables().map((c) => c.id);
    const visible = collect(registry.get("cableLayer"), (n) => n.classList.contains("cable"));
    const hit = collect(registry.get("cableHitLayer"), (n) => n.classList.contains("cable-hit"));
    assertEqual(visible.length, cableIds.length, "cable lines are not all in the top layer");
    assertEqual(hit.length, cableIds.length, "hit targets are not all in the bottom layer");
    // The top layer must hold no hit targets, or it would block the modules.
    const strays = collect(registry.get("cableLayer"), (n) => n.classList.contains("cable-hit"));
    assertEqual(strays.length, 0, "hit targets leaked into the top layer");
});

await it("puts a readout on every cable, positioned at its midpoint", () => {
    for (const entry of ui().cables.values()) {
        assert(entry.readout, "a cable has no readout");
        assert(entry.halo, "a cable has no glow layer");
        assert(entry.readout.getAttribute("x") !== null, "a readout has no position");
        assertEqual(entry.hit.getAttribute("d"), entry.line.getAttribute("d"), "hit target and line disagree");
        assertEqual(entry.halo.getAttribute("d"), entry.line.getAttribute("d"), "glow and line disagree");
    }
});

await it("shows a live voltage on a control cable", () => {
    const cable = cables().find((c) => c.from.indexOf("sequencer") === 0 && c.to.indexOf("oscillator") !== -1);
    assert(cable, "default patch has no sequencer to oscillator CV cable");
    meter("sequencer_1", "cv", 0.42);
    ui().frame();
    const entry = ui().cables.get(cable.id);
    assertEqual(entry.readout.textContent, "+0.42V", "wrong readout for a 0.42 V control cable");
    assert(entry.readout.classList.contains("on"), "a live control cable is not highlighted");
});

await it("shows a level in dB on an audio cable", () => {
    const cable = cables().find((c) => c.from.indexOf("oscillator") === 0);
    assert(cable, "default patch has no oscillator cable");
    meter("oscillator_1", "out", 0.5);
    ui().frame();
    assertEqual(ui().cables.get(cable.id).readout.textContent, "-6.0dB", "wrong readout for a half-scale audio cable");
});

/* ============================================================
   Cable colour and glow
   ============================================================ */

const channelsOf = (colour) => colour.match(/[\d.]+/g).map(Number);

await it("colours a cable from its signal", () => {
    const cable = cables().find((c) => c.from.indexOf("oscillator") === 0);
    const entry = ui().cables.get(cable.id);

    meter("oscillator_1", "out", 0);
    ui().frame();
    const dark = entry.line.style.stroke;

    meter("oscillator_1", "out", 1);
    ui().frame();
    const hot = entry.line.style.stroke;
    assert(dark !== hot, "cable did not change colour with the signal");

    // The ramp ends red at full scale, so clipping reads at a glance.
    const rgb = channelsOf(hot);
    assert(rgb[0] > rgb[2], "a clipping cable should read red: " + hot);
    assert(channelsOf(dark)[1] < channelsOf(hot)[1], "a loud cable should be brighter");
});

await it("swells the glow with the signal", () => {
    const cable = cables().find((c) => c.from.indexOf("oscillator") === 0);
    const entry = ui().cables.get(cable.id);

    meter("oscillator_1", "out", 0.05);
    ui().frame();
    const quietWidth = parseFloat(entry.halo.style.strokeWidth);
    const quietOpacity = parseFloat(entry.halo.style.strokeOpacity);

    meter("oscillator_1", "out", 0.95);
    ui().frame();
    assert(parseFloat(entry.halo.style.strokeWidth) > quietWidth, "glow did not widen");
    assert(parseFloat(entry.halo.style.strokeOpacity) > quietOpacity, "glow did not brighten");
    assert(parseFloat(entry.line.style.strokeWidth) > 2.4, "the core stroke did not thicken");
});

await it("runs a control cable from cold at zero volts to green when hot", () => {
    const cable = cables().find((c) => c.from.indexOf("sequencer") === 0);
    const entry = ui().cables.get(cable.id);

    meter("sequencer_1", "cv", 0);
    ui().frame();
    const zero = channelsOf(entry.line.style.stroke);
    meter("sequencer_1", "cv", 1);
    ui().frame();
    const hot = channelsOf(entry.line.style.stroke);

    assert(zero[2] > zero[0], "0 V should read cold: " + zero.join(","));
    assert(hot[1] > hot[0], "1 V should read green: " + hot.join(","));
});

await it("thickens a cable under the pointer", () => {
    const cable = cables().find((c) => c.from.indexOf("oscillator") === 0);
    const entry = ui().cables.get(cable.id);
    meter("oscillator_1", "out", 0.5);
    ui().frame();
    const resting = parseFloat(entry.line.style.strokeWidth);

    registry.get("cableHitLayer").dispatch("pointerover", { target: entry.hit });
    assert(parseFloat(entry.line.style.strokeWidth) > resting, "hover did not thicken the cable");
    registry.get("cableHitLayer").dispatch("pointerout", { target: entry.hit });
    assertEqual(parseFloat(entry.line.style.strokeWidth), resting, "hover did not restore the cable");
});

await it("reads the raw level but paints the smoothed one", () => {
    // The number has to be exact, or a -6.0 dB reading is a lie. The colour
    // wants the opposite: smoothed, so a momentary dip does not strobe.
    const cable = cables().find((c) => c.from.indexOf("oscillator") === 0);
    const entry = ui().cables.get(cable.id);

    meter("oscillator_1", "out", 0.5);
    ui().frame();
    assertEqual(entry.readout.textContent, "-6.0dB", "the readout should report the raw peak");

    const measure = engine().measureOutput("oscillator_1-out-out");
    assertEqual(measure.peak, 0.5, "the raw peak was altered by the meter ballistics");
    assert(typeof measure.level === "number", "no smoothed level for the colour to use");
    assertEqual(run("cableColor")(measure),
        run("cableColor")({ cv: false, signed: 0, peak: 0.5, level: measure.level }),
        "the cable is not painted from the smoothed level");
});

await it("keeps the readout legible instead of tinting it", () => {
    const cable = cables().find((c) => c.from.indexOf("oscillator") === 0);
    const entry = ui().cables.get(cable.id);
    meter("oscillator_1", "out", 0.02);
    ui().frame();
    // The readout's stroke is a dark outline for legibility over a module.
    assert(!entry.readout.style.stroke, "readout outline was overwritten by the cable colour");
});

await it("adds every new module type and gives it a live voice", async () => {
    await settle();
    registry.get("power").click();
    await settle();
    const defs = run("MODULE_DEFS");
    for (const type of ["noise", "samplehold", "waveshaper"]) {
        actions().addModule(type);
        const added = modules().filter((m) => m.type === type).pop();
        const voice = engine().getVoice(added.id);
        assert(voice, type + " was added but has no audio voice");
        // Ports declared in the definition must exist on the voice, and jacks
        // must have been drawn for them.
        const entry = ui().modules.get(voice.moduleId);
        for (const port of defs[type].inputs) assert(entry.jacks.some((j) => j.dataset.jack.endsWith("-in-" + port.id)), type + " is missing input jack " + port.id);
        for (const port of defs[type].outputs) assert(entry.jacks.some((j) => j.dataset.jack.endsWith("-out-" + port.id)), type + " is missing output jack " + port.id);
        ui().frame();
    }
});

await it("carries a signal through the new modules", async () => {
    await settle();
    registry.get("power").click();
    await settle();
    // Noise produces audio, and the drive stage bends it without muting it.
    actions().addModule("noise");
    actions().addModule("waveshaper");
    const noiseId = modules().filter((m) => m.type === "noise").pop().id;
    const driveId = modules().filter((m) => m.type === "waveshaper").pop().id;
    const from = noiseId + "-out-out";
    const to = driveId + "-in-in";
    actions().completePatch(from, to);
    // completePatch mints its own id, so match on the endpoints.
    assert(cables().some((c) => c.from === from && c.to === to),
        "could not patch noise into drive: " + registry.get("status").textContent);

    // Seed the buffer before refreshing, so there is something to read.
    const bufferSource = engine().getVoice(noiseId).owned.find((n) => n.kind === "bufferSource");
    assert(bufferSource, "no buffer source on the noise voice");
    assert(bufferSource.buffer, "the noise buffer was never built");
    const data = bufferSource.buffer.getChannelData(0);
    let anySignal = 0;
    for (let i = 0; i < data.length; i++) anySignal += Math.abs(data[i]);
    assert(anySignal > 1, "the noise buffer is empty");

    // Drive the analyser off the real graph rather than a hand-set sample.
    engine().measureOutput(driveId + "-out-out");
    refreshGraph(engine());
    const dbg = [];
    for (const [label, id] of [["noise", noiseId], ["drive", driveId]]) {
        const vo = engine().getVoice(id);
        dbg.push(label + " owned=" + vo.owned.map((n) => n.kind).join("|"));
    }
    dbg.push("noiseOutSample=" + engine().getVoice(noiseId).outputs.out.sample);
    dbg.push("driveOutSample=" + engine().getVoice(driveId).outputs.out.sample);
    const level = engine().measureOutput(driveId + "-out-out");
    assert(level, "drive output cannot be metered");
    assert(level.peak > 0.01, "nothing came out of the drive stage: peak " + level.peak + " :: " + dbg.join(" ; "));
    assert(level.peak <= 1.001, "drive stage is clipping: " + level.peak);
});

await it("gives sample and hold a stepped output rather than a ramp", async () => {
    await settle();
    registry.get("power").click();
    await settle();
    actions().addModule("samplehold");
    const shId = modules().filter((m) => m.type === "samplehold").pop().id;
    const voice = engine().getVoice(shId);
    assert(voice, "no voice for sample and hold");

    // The tap has to exist before refreshGraph can find the analyser.
    engine().measureOutput(shId + "-out-out");

    const ctx = engine().ctx;
    const seen = [];
    const held = [];
    for (let i = 0; i < 90; i++) {
        ctx.currentTime += 1 / 60;
        // Drive the input with a slow ramp; the follower clocks on each rise.
        assert(voice.inputs.in, "S&H has no input node");
        voice.inputs.in.sample = ctx.currentTime * 2;
        voice.poll(ctx.currentTime);
        held.push(voice.hold.value);
        refreshGraph(engine());
        seen.push(engine().measureOutput(shId + "-out-out").level);
    }
    assert(seen.length === 90, "no frames measured");
    const distinct = new Set(seen.map((v) => Math.round(v * 20)));
    assert(distinct.size > 1,
        "sample and hold never changed value; held targets " + [...new Set(held.map((v) => v.toFixed(2)))].join(" "));
});

await it("dims the readouts and flattens the cables when switched off", () => {
    const cable = cables().find((c) => c.from.indexOf("oscillator") === 0);
    const entry = ui().cables.get(cable.id);
    meter("oscillator_1", "out", 0.5);
    ui().frame();

    registry.get("btnMeters").click();
    assertEqual(run("store").get().meters, false, "toggle did not update state");
    assert(registry.get("cableLayer").classList.contains("meters-off"), "readouts not hidden");

    meter("oscillator_1", "out", 0.9);
    ui().frame();
    assertEqual(entry.readout.textContent, "", "readouts kept updating while hidden");
    assertEqual(entry.line.style.stroke, run("CABLE_IDLE"), "cables did not go back to a flat colour");

    registry.get("btnMeters").click();
    ui().frame();
    assertEqual(run("store").get().meters, true, "toggle did not switch back on");
    assertEqual(entry.readout.textContent, "-0.9dB", "readouts did not resume");
    // 0.25 peak would sit exactly on the idle green, so use a level off it.
    assert(entry.line.style.stroke !== run("CABLE_IDLE"), "cables did not light up again");
});

await it("removes the readout along with the cable", () => {
    const cable = cables().find((c) => c.from.indexOf("oscillator") === 0);
    actions().removeCable(cable.id);
    flushFrames();
    const visible = collect(registry.get("cableLayer"), (n) => n.classList.contains("cable"));
    const hit = collect(registry.get("cableHitLayer"), (n) => n.classList.contains("cable-hit"));
    assertEqual(visible.length, cables().length, "orphan readout left in the top layer");
    assertEqual(hit.length, cables().length, "orphan hit target left in the bottom layer");
});

/* ---------- report ---------- */

console.log("");
if (failures.length) {
    console.error("FAILURES\n");
    for (const failure of failures) console.error("  x " + failure + "\n");
}
console.log((failures.length ? "FAILED " : "ok ") + passed + " passed, " + failures.length + " failed");
process.exit(failures.length ? 1 : 0);