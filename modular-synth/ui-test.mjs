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
    return {
        setProperty(name, value) { this[name] = value; },
        removeProperty(name) { delete this[name]; },
    };
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

    const document = {
        createElement(tag) { return new FakeNode(tag); },
        createElementNS(ns, tag) { return new FakeNode(tag, ns); },
        getElementById(id) { return registry.get(id) || null; },
        querySelector() { return null; },
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
            createOscillator() { return node(); }
            createGain() { return node(); }
            createBiquadFilter() { return node(); }
            createDelay() { return node(); }
            createAnalyser() { return node(); }
            createConstantSource() { return node(); }
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

function node() {
    const n = new FakeNode("node");
    n.connections = [];
    n.start = () => { n.started = true; };
    n.stop = () => { n.stopped = true; };
    n.connect = (dest) => { n.connections.push(dest); return dest; };
    n.disconnect = (dest) => {
        if (dest === undefined) n.connections = [];
        else {
            const i = n.connections.indexOf(dest);
            if (i >= 0) n.connections.splice(i, 1);
        }
        return n;
    };
    n.getByteTimeDomainData = (buffer) => buffer.fill(128);
    n.getFloatTimeDomainData = (buffer) => buffer.fill(n.sample);
    for (const name of ["frequency", "detune", "gain", "Q", "delayTime", "offset"]) {
        const p = new FakeNode("param");
        p.setValueAtTime = () => p;
        p.linearRampToValueAtTime = () => p;
        p.setTargetAtTime = () => p;
        p.cancelScheduledValues = () => p;
        p.cancelAndHoldAtTime = () => p;
        p.connect = () => {};
        p.disconnect = () => p;
        n[name] = p;
    }
    return n;
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
    assertEqual(items[items.length - 1].childNodes[1].textContent, defs.output.name, "last item is not the output");
});

await it("powering on loads the default patch", async () => {
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

await it("keeps the readout legible instead of tinting it", () => {
    const cable = cables().find((c) => c.from.indexOf("oscillator") === 0);
    const entry = ui().cables.get(cable.id);
    meter("oscillator_1", "out", 0.02);
    ui().frame();
    // The readout's stroke is a dark outline for legibility over a module.
    assert(!entry.readout.style.stroke, "readout outline was overwritten by the cable colour");
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