"use strict";
/* ============================================================
   Modular Synth — application state and wiring.
   ============================================================ */

class Store {
    constructor(initial) {
        this.state = initial;
        this.subscribers = new Set();
    }

    get() {
        return this.state;
    }

    set(patch) {
        this.state = Object.assign({}, this.state, patch);
        for (const fn of this.subscribers) fn(this.state);
    }

    subscribe(fn) {
        this.subscribers.add(fn);
        return () => this.subscribers.delete(fn);
    }
}

const store = new Store({
    modules: [],
    cables: [],
    steps: {},
    view: { x: 0, y: 0, k: 1 },
    patching: null,
    selected: null,
    meters: true,
});

const engine = new AudioEngine();

/* ---------- element handles ---------- */

const dom = {
    sidebar: document.getElementById("sidebar"),
    rackArea: document.getElementById("rackArea"),
    canvas: document.getElementById("rackCanvas"),
    cableLayer: document.getElementById("cableLayer"),
    hitLayer: document.getElementById("cableHitLayer"),
    status: document.getElementById("status"),
    zoomLabel: document.getElementById("zoomLabel"),
    overlay: document.getElementById("overlay"),
    fileInput: document.getElementById("patchFile"),
    power: document.getElementById("power"),
    meters: document.getElementById("btnMeters"),
};

/* ---------- helpers ---------- */

let statusTimer = null;
function setStatus(message, sticky) {
    dom.status.textContent = message || "";
    dom.status.classList.toggle("visible", !!message);
    if (statusTimer) clearTimeout(statusTimer);
    if (message && !sticky) {
        statusTimer = setTimeout(() => {
            dom.status.classList.remove("visible");
        }, 4000);
    }
}

function moduleIndex(modules) {
    const index = {};
    for (const m of modules) index[m.id] = m;
    return index;
}

function moduleById(id) {
    const state = store.get();
    for (const m of state.modules) if (m.id === id) return m;
    return null;
}

/* ---------- actions ---------- */

const actions = {
    moduleById,

    selectModule(id) {
        if (store.get().selected === id) return;
        store.set({ selected: id });
    },

    moveModule(id, x, y) {
        const state = store.get();
        const modules = state.modules.map((m) => (m.id === id ? Object.assign({}, m, { x, y }) : m));
        store.set({ modules });
    },

    setControl(moduleId, controlId, value) {
        const state = store.get();
        let touched = null;
        const modules = state.modules.map((m) => {
            if (m.id !== moduleId) return m;
            if (m.controls[controlId] === value) return m;
            touched = Object.assign({}, m, { controls: Object.assign({}, m.controls, { [controlId]: value }) });
            return touched;
        });
        if (!touched) return;
        store.set({ modules });
        engine.applyControls(touched);
    },

    removeModule(id) {
        // Removing a module has to drop its cables and kill its audio nodes.
        const state = store.get();
        if (!moduleById(id)) return;
        engine.removeModule(id);
        engine.stepsById.delete(id);
        store.set({
            modules: state.modules.filter((m) => m.id !== id),
            cables: state.cables.filter((c) => {
                const from = parseJackId(c.from);
                const to = parseJackId(c.to);
                return from.moduleId !== id && to.moduleId !== id;
            }),
            selected: store.get().selected === id ? null : store.get().selected,
        });
    },

    armPatch(jackId) {
        const current = store.get().patching;
        if (current === jackId) {
            actions.cancelPatch();
            return;
        }
        // Clicking a second jack completes the cable immediately.
        if (current && canPatch(current, jackId)) {
            actions.completePatch(current, jackId);
            return;
        }
        store.set({ patching: jackId });
        ui.setPatchSource(jackId);
    },

    completePatch(from, to) {
        const state = store.get();
        const problem = cableProblem({ from, to }, moduleIndex(state.modules));
        if (problem) {
            setStatus(problem);
            actions.cancelPatch();
            return;
        }
        const duplicate = state.cables.some((c) => c.from === from && c.to === to);
        if (duplicate) {
            setStatus("Those jacks are already patched together.");
            actions.cancelPatch();
            return;
        }
        const cable = { id: "c" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), from, to };
        const cables = state.cables.concat(cable);
        store.set({ cables });
        engine.syncTopology(cables);
        actions.cancelPatch();
    },

    cancelPatch() {
        store.set({ patching: null });
        ui.setPatchSource(null);
    },

    removeCable(cableId) {
        const cables = store.get().cables.filter((c) => c.id !== cableId);
        store.set({ cables });
        engine.syncTopology(cables);
    },

    toggleStep(seqId, index) {
        const steps = store.get().steps;
        const current = steps[seqId] || defaultSteps();
        const next = current.slice();
        next[index] = Object.assign({}, next[index], { gate: next[index].gate ? 0 : 1 });
        store.set({ steps: Object.assign({}, steps, { [seqId]: next }) });
        engine.setSteps(seqId, next);
    },

    setStep(seqId, index, patch) {
        const steps = store.get().steps;
        const current = steps[seqId] || defaultSteps();
        const next = current.slice();
        next[index] = Object.assign({}, next[index], patch);
        store.set({ steps: Object.assign({}, steps, { [seqId]: next }) });
        engine.setSteps(seqId, next);
    },

    noteOn(moduleId, note) {
        const voice = engine.getVoice(moduleId);
        if (voice && voice.noteOn) voice.noteOn(note);
    },

    noteOff(moduleId) {
        const voice = engine.getVoice(moduleId);
        if (voice && voice.noteOff) voice.noteOff();
    },

    onViewChange(view) {
        if (store.get().view === view) return;
        store.set({ view });
        dom.zoomLabel.textContent = Math.round(view.k * 100) + "%";
    },

    addModule(type, rackPoint) {
        const state = store.get();
        const id = nextModuleId(type, state.modules);
        let drop = rackPoint;
        if (!drop) {
            const rect = dom.rackArea.getBoundingClientRect();
            drop = ui.rackPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
        const module = makeModule(type, id, drop.x, drop.y);
        const modules = state.modules.concat(module);
        const patch = { modules };
        if (type === "sequencer") {
            patch.steps = Object.assign({}, state.steps, { [id]: state.steps[id] || defaultSteps() });
        }
        store.set(patch);
        engine.addModule(module);
        if (type === "sequencer") engine.setSteps(id, store.get().steps[id]);
        engine.syncTopology(store.get().cables);
    },

    clear() {
        const state = store.get();
        if (state.modules.length && !window.confirm("Clear the rack? This cannot be undone.")) return;
        engine.disposeAll();
        engine.stepsById.clear();
        store.set({ modules: [], cables: [], steps: {}, selected: null });
        engine.syncTopology([]);
    },

    reset() {
        applyPatch(defaultPatch());
        setStatus("Default patch loaded.");
    },

    save() {
        const blob = new Blob([JSON.stringify(serializePatch(store.get()), null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "synth-patch.json";
        link.click();
        URL.revokeObjectURL(url);
    },

    async load(file) {
        try {
            const text = await file.text();
            const { patch, errors } = normalizePatch(JSON.parse(text));
            applyPatch(patch);
            setStatus(errors.length ? "Loaded with " + errors.length + " issue(s): " + errors[0] : "Patch loaded.");
        } catch (err) {
            setStatus("Could not read that file: " + err.message);
        }
    },

    fit() {
        ui.fit(store.get().modules);
    },

    zoom(factor) {
        ui.zoomBy(factor);
    },

    toggleMeters() {
        const on = !store.get().meters;
        store.set({ meters: on });
        ui.setMeters(on);
        dom.meters.setAttribute("aria-pressed", on ? "true" : "false");
        dom.meters.classList.toggle("on", on);
    },
};

/* ---------- patch application ---------- */

function applyPatch(patch) {
    engine.disposeAll();
    engine.stepsById.clear();
    engine.syncTopology([]);
    store.set({ modules: [], cables: [], steps: patch.steps || {}, selected: null, patching: null });
    ui.setPatchSource(null);

    store.set({ modules: patch.modules, cables: patch.cables });
    for (const module of patch.modules) {
        engine.addModule(module);
        if (module.type === "sequencer") engine.setSteps(module.id, store.get().steps[module.id] || defaultSteps());
    }
    engine.syncTopology(patch.cables);
    requestAnimationFrame(() => ui.fit(patch.modules));
}

function defaultPatch() {
    const modules = [
        makeModule("sequencer", "sequencer_1", 30, 30, { tempo: 0.42, run: 1, gateLen: 0.5, octave: 0.4 }),
        makeModule("oscillator", "oscillator_1", 30, 250, { freq: 0.28, wave: 1, level: 0.7 }),
        makeModule("vcf", "vcf_1", 240, 250, { cutoff: 0.5, res: 0.22 }),
        makeModule("envelope", "envelope_1", 450, 250, { a: 0.2, d: 0.5, s: 0.3, r: 0.45 }),
        makeModule("vca", "vca_1", 450, 440, { offset: 0 }),
        makeModule("output", "output_1", 640, 440, { vol: 0.55 }),
        makeModule("oscilloscope", "oscilloscope_1", 240, 440, { zoom: 0.3 }),
    ];

    const pattern = [0, 0.25, 0.583, 0, 0, 0.917, 0.25, 0];
    const gates = [1, 0, 1, 1, 0, 1, 1, 0];
    const steps = {
        sequencer_1: pattern.map((cv, i) => ({ cv, gate: gates[i] })),
    };

    const cable = (from, to, id) => ({ id, from, to });
    const cables = [
        cable("sequencer_1-out-cv", "oscillator_1-in-voct", "c1"),
        cable("sequencer_1-out-gate", "envelope_1-in-gate", "c2"),
        cable("oscillator_1-out-out", "vcf_1-in-in", "c3"),
        cable("oscillator_1-out-out", "oscilloscope_1-in-in", "c4"),
        cable("vcf_1-out-out", "vca_1-in-in", "c5"),
        cable("envelope_1-out-out", "vca_1-in-cv", "c6"),
        cable("vca_1-out-out", "output_1-in-in", "c7"),
    ];

    return { modules, cables, steps, view: null };
}

/* ---------- UI ---------- */

const ui = new RackUI({
    engine,
    rackArea: dom.rackArea,
    canvas: dom.canvas,
    cableLayer: dom.cableLayer,
    hitLayer: dom.hitLayer,
    actions,
});

store.subscribe((state) => ui.render(state));
ui.setView(store.get().view);
dom.zoomLabel.textContent = "100%";

/* ---------- sidebar ---------- */

for (const type of MODULE_ORDER) {
    const def = MODULE_DEFS[type];
    const item = el("div", "module-item");
    item.draggable = true;
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.append(
        el("span", "module-item-abbr", def.abbr || def.name),
        el("span", "module-item-name", def.name)
    );
    item.title = "Drag into the rack, or click to add " + def.name;

    item.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", type);
        e.dataTransfer.effectAllowed = "copy";
    });
    item.addEventListener("click", () => actions.addModule(type));
    item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            actions.addModule(type);
        }
    });
    dom.sidebar.appendChild(item);
}

dom.rackArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
});

dom.rackArea.addEventListener("drop", (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("text/plain");
    if (!MODULE_DEFS[type]) return;
    actions.addModule(type, ui.rackPoint(e.clientX, e.clientY));
});

/* ---------- header ---------- */

document.getElementById("btnSave").addEventListener("click", () => actions.save());
document.getElementById("btnLoad").addEventListener("click", () => dom.fileInput.click());
document.getElementById("btnClear").addEventListener("click", () => actions.clear());
document.getElementById("btnReset").addEventListener("click", () => actions.reset());
document.getElementById("btnFit").addEventListener("click", () => actions.fit());
document.getElementById("btnZoomOut").addEventListener("click", () => actions.zoom(1 / 1.2));
document.getElementById("btnZoomIn").addEventListener("click", () => actions.zoom(1.2));
dom.meters.addEventListener("click", () => actions.toggleMeters());

dom.fileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) actions.load(file);
    e.target.value = "";
});

/* ---------- global keys ---------- */

window.addEventListener("keydown", (e) => {
    if (isTypingTarget(e.target)) return;

    if (e.key === "Escape") {
        if (store.get().patching) actions.cancelPatch();
        else actions.selectModule(null);
        return;
    }

    if ((e.key === "Delete" || e.key === "Backspace") && store.get().selected) {
        e.preventDefault();
        actions.removeModule(store.get().selected);
        return;
    }

    // Computer keyboard drives the on-screen keyboard.
    if (engine.ready && !e.repeat && !e.metaKey && !e.ctrlKey) {
        const key = e.key.toLowerCase();
        if (COMPUTER_KEY_MAP[key] !== undefined) {
            const target = firstKeyboardModule();
            if (target) {
                e.preventDefault();
                actions.noteOn(target, 48 + COMPUTER_KEY_MAP[key]);
            }
        }
    }
});

window.addEventListener("keyup", (e) => {
    if (!engine.ready) return;
    const key = e.key.toLowerCase();
    if (COMPUTER_KEY_MAP[key] === undefined) return;
    const target = firstKeyboardModule();
    if (target) actions.noteOff(target);
});

window.addEventListener("blur", () => {
    const target = firstKeyboardModule();
    if (target) actions.noteOff(target);
});

function firstKeyboardModule() {
    const found = store.get().modules.filter((m) => m.type === "keyboard");
    if (!found.length) return null;
    return store.get().selected && found.some((m) => m.id === store.get().selected)
        ? store.get().selected
        : found[0].id;
}

/* ---------- MIDI ---------- */

function attachMidi(access) {
    const inputs = Array.from(access.inputs.values());
    const entries = midiModules();
    for (const entry of entries) {
        const panel = ui.modules.get(entry.id);
        if (panel && panel.live.setStatus) panel.live.setStatus(inputs.length ? inputs.length + " device(s)" : "No device");
    }
    for (const input of inputs) {
        input.onmidimessage = (event) => {
            const [status, note, velocity] = event.data;
            const command = status & 0xf0;
            for (const entry of midiModules()) {
                if (command === 0x90 && velocity > 0) actions.noteOn(entry.id, note);
                else if (command === 0x80 || (command === 0x90 && velocity === 0)) actions.noteOff(entry.id);
            }
        };
    }
}

async function setupMidi() {
    if (!navigator.requestMIDIAccess) {
        for (const entry of midiModules()) {
            const panel = ui.modules.get(entry.id);
            if (panel && panel.live.setStatus) panel.live.setStatus("Unsupported");
        }
        return;
    }
    try {
        const access = await navigator.requestMIDIAccess();
        attachMidi(access);
        access.onstatechange = () => attachMidi(access);
    } catch (err) {
        for (const entry of midiModules()) {
            const panel = ui.modules.get(entry.id);
            if (panel && panel.live.setStatus) panel.live.setStatus("Denied");
        }
    }
}

function midiModules() {
    return store.get().modules.filter((m) => m.type === "midi_in");
}

/* ---------- boot ---------- */

dom.power.addEventListener("click", async () => {
    dom.power.disabled = true;
    try {
        await engine.start();
        dom.overlay.classList.add("hidden");
        engine.onFrame(() => ui.frame());
        applyPatch(defaultPatch());
        setupMidi();
        setStatus("Drag modules in, drag jack to jack to patch, click a cable to cut it.");
    } catch (err) {
        dom.power.disabled = false;
        setStatus("Audio failed to start: " + err.message, true);
    }
});

/* Modules added after boot still need to find an already-connected MIDI
   device. Re-run only when the set of MIDI modules actually changes. */
if (navigator.requestMIDIAccess) {
    let midiSignature = "";
    navigator.requestMIDIAccess().then((access) => {
        store.subscribe(() => {
            if (!engine.ready) return;
            const signature = midiModules().map((m) => m.id).join(",");
            if (signature === midiSignature) return;
            midiSignature = signature;
            attachMidi(access);
        });
    }).catch(() => { /* permission is requested again on power-on */ });
}