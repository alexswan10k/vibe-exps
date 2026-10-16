/* ============================================================
   Modular Synth — smoke tests.

   Runs the browser scripts inside a VM with a mock Web Audio graph, so
   the real voice factories and the real engine are exercised without a
   browser. Run: node smoke-test.mjs
   ============================================================ */

import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/* ---------- mock Web Audio ---------- */

/**
 * Resolves a param's value at audio-clock time `t`.
 *
 * The old mock applied every automation instantly, which made the whole
 * sequencer untestable: a gate looked permanently open because
 * linearRampToValueAtTime set `.value` straight away. Automation is a timed
 * list here, so a step that is scheduled into the future stays in the future.
 *
 * Only the event types this codebase actually schedules are modelled. Ramping
 * anchors on the preceding set/hold, which holds because smoothTo() always
 * calls cancelAndHoldAtTime() immediately before it ramps.
 */
function paramValueAt(param, t) {
    const events = param.automation.slice().sort((a, b) => a.t - b.t || a.seq - b.seq);
    let value = param.baseValue;
    let anchor = param.baseValue;
    let anchorT = param.baseTime;
    for (const e of events) {
        if (e.t > t) break;
        if (e.k === "hold" || e.k === "set") {
            anchor = e.v;
            anchorT = e.t;
            value = e.v;
        } else if (e.k === "ramp") {
            const span = e.t - anchorT;
            const f = span > 0 ? Math.min(1, Math.max(0, (t - anchorT) / span)) : 1;
            value = anchor + (e.v - anchor) * f;
        } else if (e.k === "target") {
            const dt = Math.max(0, t - anchorT);
            value = e.v + (anchor - e.v) * Math.exp(-dt / e.c);
        }
    }
    return value;
}

function mockParam(ctx) {
    const param = {
        isAudioParam: true,
        owner: null,
        value: 0,
        baseValue: 0,
        baseTime: -Infinity,
        automation: [],
        _seq: 0,
        setValueAtTime(v, t) {
            this.value = v;
            // A set cancels everything after it.
            this.automation = this.automation.filter((e) => e.t <= t);
            this.automation.push({ k: "set", v, t, seq: this._seq++ });
            return this;
        },
        linearRampToValueAtTime(v, t) {
            this.value = v;
            this.automation.push({ k: "ramp", v, t, seq: this._seq++ });
            return this;
        },
        setTargetAtTime(v, t, c) {
            this.value = v;
            this.automation.push({ k: "target", v, t, c, seq: this._seq++ });
            return this;
        },
        cancelScheduledValues(t) {
            this.automation = this.automation.filter((e) => e.t < t);
            return this;
        },
        cancelAndHoldAtTime(t) {
            // Freeze wherever the param would have been at t, then drop the rest.
            const held = paramValueAt(this, t);
            this.automation = this.automation.filter((e) => e.t < t);
            this.automation.push({ k: "hold", v: held, t, seq: this._seq++ });
            return this;
        },
        valueAt(t) {
            const intrinsic = paramValueAt(this, t);
            if (!this.owner || !this.owner.paramInputs || !this.owner.paramInputs.length) return intrinsic;
            // Real AudioParams sum whatever is patched into them, which is how
            // an envelope into a VCA or an LFO into a cutoff works. Without this
            // the mock cannot tell a working CV path from a dropped cable, and
            // dropped CV cables is exactly the bug this suite exists to catch.
            const seen = new Set([this.owner]);
            let modulation = 0;
            for (const src of this.owner.paramInputs) modulation += outputAt(src, t, seen);
            return intrinsic + modulation;
        },
        connect(dest) {
            ctx.log.push({ type: "connect", param: true, dest });
            if (this.owner && this.owner.paramInputs) this.owner.paramInputs.push(this.owner);
            return dest;
        },
        disconnect() { return this; },
    };
    return param;
}

function mockNode(ctx, kind) {
    const node = {
        kind,
        sample: 0,
        connections: [],
        inputs: [],
        paramInputs: [],
        started: false,
        stopped: false,
        connect(dest) {
            if (dest && dest.isAudioParam) {
                // Patched into an AudioParam. That is modulation, not audio,
                // so it must not join the signal-sum.
                if (dest.owner && dest.owner.paramInputs) dest.owner.paramInputs.push(node);
            } else {
                node.connections.push(dest);
                if (dest && dest.inputs) dest.inputs.push(node);
            }
            ctx.log.push({ type: "connect", from: node, to: dest });
            return dest;
        },
        disconnect(dest) {
            if (dest && dest.isAudioParam) {
                const i = dest.owner.paramInputs.indexOf(node);
                if (i >= 0) dest.owner.paramInputs.splice(i, 1);
            } else if (dest === undefined) {
                for (const d of node.connections) {
                    const i = d.inputs.indexOf(node);
                    if (i >= 0) d.inputs.splice(i, 1);
                }
                node.connections = [];
            } else {
                const i = node.connections.indexOf(dest);
                if (i >= 0) node.connections.splice(i, 1);
                else ctx.log.push({ type: "disconnect-miss", from: node, to: dest });
                const j = dest.inputs.indexOf(node);
                if (j >= 0) dest.inputs.splice(j, 1);
            }
            ctx.log.push({ type: "disconnect", from: node, to: dest });
            return node;
        },
        start() { node.started = true; return node; },
        stop() { node.stopped = true; return node; },
        getByteTimeDomainData(buffer) { buffer.fill(Math.round(128 + node.sample * 127)); },
        getFloatTimeDomainData(buffer) { buffer.fill(node.sample); },
    };
    for (const name of ["frequency", "detune", "gain", "Q", "delayTime", "offset"]) {
        node[name] = mockParam(ctx);
        node[name].owner = node;
    }
    // Real defaults matter here. GainNode.gain starts at 1, not 0; with a 0
    // default every CV path silently multiplies to silence, which is exactly
    // the failure this suite is meant to be able to see.
    if (kind === "gain") {
        node.gain.value = 1;
        node.gain.baseValue = 1;
    }
    node.fftSize = 2048;
    node.smoothingTimeConstant = 0;
    ctx.nodes.add(node);
    return node;
}

/**
 * Signal value of a node at time `t`.
 * `seen` terminates feedback loops, so the delay's recirculating path decays
 * to nothing rather than recursing forever.
 */
function outputAt(node, t, seen) {
    if (seen.has(node) || seen.size > 64) return 0;
    seen.add(node);
    let value = 0;
    if (node.kind === "constant") {
        value = node.offset.valueAt(t);
    } else if (node.kind === "osc") {
        value = Math.sin(2 * Math.PI * node.frequency.valueAt(t) * t);
    } else if (node.kind === "bufferSource") {
        // Play the looped buffer out at t, which is all the noise voice needs.
        const data = node.buffer && node.buffer.getChannelData(0);
        if (data && data.length) {
            value = data[Math.floor(t * node.buffer.sampleRate) % data.length];
        }
    } else {
        for (const src of node.inputs) value += outputAt(src, t, seen);
    }
    seen.delete(node);
    if (node.kind === "gain") value *= node.gain.valueAt(t);
    return value;
}

class MockAudioContext {
    constructor() {
        this.state = "running";
        this.currentTime = 0;
        this.log = [];
        this.nodes = new Set();
        this.destination = mockNode(this, "destination");
    }
    createOscillator() { return mockNode(this, "osc"); }
    createGain() { return mockNode(this, "gain"); }
    createBiquadFilter() { return mockNode(this, "biquad"); }
    createDelay() { return mockNode(this, "delay"); }
    createAnalyser() { return mockNode(this, "analyser"); }
    createConstantSource() { return mockNode(this, "constant"); }
    createWaveShaper() { return mockNode(this, "shaper"); }
    createBufferSource() {
        const node = mockNode(this, "bufferSource");
        node.loop = false;
        return node;
    }
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
    resume() { this.state = "running"; return Promise.resolve(); }
    close() { this.state = "closed"; return Promise.resolve(); }
    advance(seconds) { this.currentTime += seconds; }

    /**
     * Push the audio clock's value of every node into `.sample`, so the
     * analysers report what the graph is actually carrying right now.
     * Opt-in: tests that set `.sample` by hand keep working unchanged.
     */
    refresh() {
        for (const node of this.nodes) {
            const v = outputAt(node, this.currentTime, new Set());
            node.sample = Math.max(-2, Math.min(2, v));
        }
    }
}

/* ---------- harness ---------- */

let passed = 0;
const failures = [];
let group = "";
const suite = [];

// Tests register during describe() and run in order at the end, so an async
// test can never be left dangling behind process.exit().
function describe(name, fn) {
    group = name;
    fn();
}

function it(name, fn) {
    suite.push({ group, name, fn });
}

const itAsync = it;

async function runSuite() {
    for (const test of suite) {
        try {
            await test.fn();
            passed++;
        } catch (err) {
            failures.push(test.group + " :: " + test.name + "\n    " + (err && err.message ? err.message : err));
        }
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

function assertClose(actual, expected, tolerance, message) {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error((message || "values differ") + ": expected " + expected + " ±" + tolerance + ", got " + actual);
    }
}

/** Pulls the r, g and b out of a "rgb(r,g,b)" string. */
function channels(colour) {
    return String(colour).match(/[\d.]+/g).map(Number);
}

/* ---------- load the scripts ---------- */

const context = vm.createContext({
    console,
    Math,
    JSON,
    Object,
    Array,
    Set,
    Map,
    Error,
    isFinite,
    parseInt,
    parseFloat,
    window: { AudioContext: MockAudioContext },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    Blob: class {},
    URL: { createObjectURL: () => "", revokeObjectURL: () => {} },
});

for (const file of ["constants.js", "patch.js", "dsp.js", "audio-engine.js", "ui-manager.js"]) {
    vm.runInContext(fs.readFileSync(path.join(here, file), "utf8"), context, { filename: file });
}

const run = (expression) => vm.runInContext(expression, context);
const MODULE_DEFS = run("MODULE_DEFS");
const VOICES = run("VOICES");
const SEQUENCER_STEPS = run("SEQUENCER_STEPS");
const makeJackId = run("makeJackId");
const parseJackId = run("parseJackId");
const nextModuleId = run("nextModuleId");
const makeModule = run("makeModule");
const defaultSteps = run("defaultSteps");
const cableProblem = run("cableProblem");
const canPatch = run("canPatch");
const normalizePatch = run("normalizePatch");
const serializePatch = run("serializePatch");
const Adsr = run("Adsr");
const GateFollower = run("GateFollower");
const SequencerRuntime = run("SequencerRuntime");
const AudioEngine = run("AudioEngine");
const SampleHold = run("SampleHold");
const noiseToneCoefficients = run("noiseToneCoefficients");
const noiseWeights = run("noiseWeights");
const fillNoiseBuffer = run("fillNoiseBuffer");
const waveshaperCurve = run("waveshaperCurve");
const CURVES = run("CURVES");
const buildPianoKeys = run("buildPianoKeys");
const RACK_GRID = run("RACK_GRID");
const RACK_GRID_MAJOR = run("RACK_GRID_MAJOR");
const noteToVolts = run("noteToVolts");
const tempoBpm = run("tempoBpm");
const cablePath = run("cablePath");
const isControlSource = run("isControlSource");
const formatCableValue = run("formatCableValue");
const rampColor = run("rampColor");
const cableColor = run("cableColor");
const cableIntensity = run("cableIntensity");
const CV_RAMP = run("CV_RAMP");
const AUDIO_RAMP = run("AUDIO_RAMP");

const moduleById = (modules) => {
    const index = {};
    for (const m of modules) index[m.id] = m;
    return index;
};

async function newEngine() {
    const engine = new AudioEngine();
    await engine.start();
    return engine;
}

/* ============================================================
   1. Definitions
   ============================================================ */

describe("definitions", () => {
    it("every module type has a voice factory", () => {
        for (const type of Object.keys(MODULE_DEFS)) {
            assert(typeof VOICES[type] === "function", "no voice factory for " + type);
        }
    });

    it("every declared port exists on its voice", () => {
        // This is the check the original code had no way to make: the UI drew
        // jacks from MODULE_DEFS while the engine looked ports up by a
        // hand-rolled string split, and the two lists silently drifted.
        const ctx = new MockAudioContext();
        const problems = [];
        for (const [type, def] of Object.entries(MODULE_DEFS)) {
            const voice = VOICES[type](ctx, []);
            for (const port of def.inputs) {
                if (!voice.inputs || !voice.inputs[port.id]) {
                    problems.push(type + " is missing input " + port.id);
                }
            }
            for (const port of def.outputs) {
                if (!voice.outputs || !voice.outputs[port.id]) {
                    problems.push(type + " is missing output " + port.id);
                }
            }
        }
        assert(problems.length === 0, problems.join("; "));
    });

    it("voices do not expose ports the definition does not declare", () => {
        const ctx = new MockAudioContext();
        const problems = [];
        for (const [type, def] of Object.entries(MODULE_DEFS)) {
            const voice = VOICES[type](ctx, []);
            for (const port of Object.keys(voice.inputs || {})) {
                if (!def.inputs.some((p) => p.id === port)) problems.push(type + " has undeclared input " + port);
            }
            for (const port of Object.keys(voice.outputs || {})) {
                if (!def.outputs.some((p) => p.id === port)) problems.push(type + " has undeclared output " + port);
            }
        }
        assert(problems.length === 0, problems.join("; "));
    });

    it("every module width tiles on the rack grid", () => {
        // If a width is not a multiple of the snap grid, two modules dropped
        // side by side leave a gap that cannot be closed by moving either of
        // them, because both snap.
        const problems = [];
        for (const [type, def] of Object.entries(MODULE_DEFS)) {
            if (def.width % RACK_GRID !== 0) {
                problems.push(type + " is " + def.width + "px, off the " + RACK_GRID + "px grid by " + (def.width % RACK_GRID));
            }
        }
        assert(problems.length === 0, problems.join("; "));
    });

    it("every module declares a group for the panel accent", () => {
        const allowed = ["source", "process", "io"];
        for (const [type, def] of Object.entries(MODULE_DEFS)) {
            assert(allowed.includes(def.group), type + " has group \"" + def.group + "\"");
        }
    });

    it("every control has a display formatter and a sane default", () => {
        for (const [type, def] of Object.entries(MODULE_DEFS)) {
            for (const control of def.controls) {
                assert(control.default >= 0 && control.default <= 1,
                    type + "." + control.id + " default out of range: " + control.default);
                if (control.type === "knob") {
                    assert(typeof control.display === "function", type + "." + control.id + " has no display");
                }
                if (control.type === "select") {
                    assert(Array.isArray(control.options) && control.options.length > 1,
                        type + "." + control.id + " needs options");
                }
            }
        }
    });
});

/* ============================================================
   2. Patch model
   ============================================================ */

describe("patch model", () => {
    it("jack ids round trip", () => {
        for (const id of ["oscillator_1-out-out", "vcf_12-in-mod", "sequencer_3-out-cv", "keyboard_2-in-gate"]) {
            const parsed = parseJackId(id);
            assert(parsed, "could not parse " + id);
            assertEqual(makeJackId(parsed.moduleId, parsed.dir, parsed.portId), id, "round trip failed for " + id);
        }
    });

    it("jack ids survive module ids containing dashes", () => {
        const id = makeJackId("weird-id-x", "in", "mod");
        const parsed = parseJackId(id);
        assertEqual(parsed.moduleId, "weird-id-x");
        assertEqual(parsed.portId, "mod");
    });

    it("rejects nonsense", () => {
        assertEqual(parseJackId("no-markers"), null);
        assertEqual(parseJackId(null), null);
    });

    it("rejects backwards and self cables", () => {
        const modules = [
            makeModule("oscillator", "osc_1", 0, 0),
            makeModule("vcf", "vcf_1", 0, 0),
        ];
        const index = moduleById(modules);
        assert(cableProblem({ from: "vcf_1-out-out", to: "osc_1-in-voct" }, index) === null, "valid cable rejected");
        assert(cableProblem({ from: "vcf_1-in-in", to: "osc_1-in-voct" }, index), "input-to-input accepted");
        assert(cableProblem({ from: "osc_1-out-out", to: "vcf_1-out-out" }, index), "output-to-output accepted");
        assert(cableProblem({ from: "osc_1-out-out", to: "osc_1-in-voct" }, index), "self patch accepted");
    });

    it("rejects unknown ports and missing modules", () => {
        const index = moduleById([makeModule("oscillator", "osc_1", 0, 0), makeModule("vcf", "vcf_1", 0, 0)]);
        assert(cableProblem({ from: "osc_1-out-nope", to: "vcf_1-in-in" }, index), "unknown output accepted");
        assert(cableProblem({ from: "osc_1-out-out", to: "vcf_1-in-nope" }, index), "unknown input accepted");
        assert(cableProblem({ from: "ghost_1-out-out", to: "vcf_1-in-in" }, index), "missing module accepted");
    });

    it("canPatch only allows output to input on different modules", () => {
        assert(canPatch("osc_1-out-out", "vcf_1-in-in"), "legal patch rejected");
        assert(!canPatch("osc_1-in-voct", "vcf_1-in-in"), "input to input allowed");
        assert(!canPatch("osc_1-out-out", "osc_1-in-voct"), "self patch allowed");
        assert(!canPatch("garbage", "vcf_1-in-in"), "garbage accepted");
    });

    it("module ids do not collide when added in the same millisecond", () => {
        const modules = [];
        for (let i = 0; i < 3; i++) {
            const id = nextModuleId("oscillator", modules);
            modules.push(makeModule("oscillator", id, 0, 0));
        }
        assertEqual(new Set(modules.map((m) => m.id)).size, 3, "ids collided");
    });
});

/* ============================================================
   3. Patch files
   ============================================================ */

describe("patch files", () => {
    it("survives a completely malformed file", () => {
        for (const junk of [null, undefined, 42, "nope", [], { modules: "no" }]) {
            const { patch, errors } = normalizePatch(junk);
            assert(Array.isArray(patch.modules), "modules not an array for " + JSON.stringify(junk));
            assert(errors.length > 0, "no error reported for " + JSON.stringify(junk));
        }
    });

    it("drops unknown module types and dangling cables instead of throwing", () => {
        const { patch, errors } = normalizePatch({
            modules: [
                { id: "a", type: "oscillator", x: 0, y: 0 },
                { id: "b", type: "not_a_module", x: 0, y: 0 },
                { id: "c", type: "vcf", x: 200, y: 0 },
            ],
            cables: [
                { id: "k1", from: "a-out-out", to: "c-in-in" },
                { id: "k2", from: "b-out-out", to: "c-in-in" },
                { id: "k3", from: "a-out-out", to: "ghost-in-in" },
            ],
        });
        assertEqual(patch.modules.length, 2, "wrong module count");
        assertEqual(patch.cables.length, 1, "wrong cable count");
        assert(errors.length >= 2, "expected errors, got " + errors.length);
    });

    it("does not white-screen on duplicate module ids", () => {
        const { patch } = normalizePatch({
            modules: [
                { id: "same", type: "oscillator", x: 0, y: 0 },
                { id: "same", type: "oscillator", x: 10, y: 0 },
            ],
        });
        assertEqual(patch.modules.length, 2);
        assert(patch.modules[0].id !== patch.modules[1].id, "duplicate ids survived");
    });

    it("clamps and ignores junk control values", () => {
        const { patch } = normalizePatch({
            modules: [{
                id: "a", type: "oscillator", x: 0, y: 0,
                controls: { freq: 5, wave: "not a number", level: null, nonexistent: 1 },
            }],
        });
        assertEqual(patch.modules[0].controls.freq, 1, "freq not clamped");
        assertEqual(patch.modules[0].controls.level, 0.7, "null control not defaulted");
        assert(!("nonexistent" in patch.modules[0].controls), "unknown control kept");
    });

    it("round trips a patch", () => {
        const original = {
            modules: [makeModule("oscillator", "osc_1", 40, 60), makeModule("vcf", "vcf_1", 300, 60)],
            cables: [{ id: "c1", from: "osc_1-out-out", to: "vcf_1-in-in" }],
            steps: {},
            view: { x: 12, y: 34, k: 1.2 },
        };
        const { patch, errors } = normalizePatch(JSON.parse(JSON.stringify(serializePatch(original))));
        assertEqual(errors.length, 0, "round trip reported errors: " + errors.join("; "));
        assertEqual(patch.modules.length, 2);
        assertEqual(patch.cables.length, 1);
        assertEqual(patch.modules[0].x, 40);
        assertEqual(patch.view.k, 1.2);
    });

    it("gives a new sequencer a full set of steps", () => {
        const { patch } = normalizePatch({ modules: [{ id: "s", type: "sequencer", x: 0, y: 0 }] });
        assertEqual(patch.steps.s.length, SEQUENCER_STEPS);
    });
});

/* ============================================================
   4. ADSR
   ============================================================ */

describe("ADSR", () => {
    it("starts silent and rises to full on the gate", () => {
        const env = new Adsr();
        env.s = 0;
        assertEqual(env.levelAt(0), 0, "not silent at rest");
        env.gateOn(0);
        assertClose(env.levelAt(env.attack * 0.5), 0.5, 0.02, "attack is not linear");
        assertEqual(env.levelAt(env.attack * 10), 0, "sustain ignored");
    });

    it("reaches the sustain level after the decay", () => {
        const env = new Adsr();
        env.s = 0.3;
        env.gateOn(0);
        assertClose(env.levelAt(env.attack + env.decay), 0.3, 0.001, "wrong sustain");
        assertClose(env.levelAt(env.attack + env.decay + 5), 0.3, 0.001, "sustain drifted");
    });

    it("releases from the current level, not from zero", () => {
        const env = new Adsr();
        env.s = 0;
        env.gateOn(0);
        // Cut the gate halfway up the attack.
        const cut = env.attack * 0.5;
        env.gateOff(cut);
        assertClose(env.levelAt(cut), 0.5, 0.02, "level jumped when releasing");
        assertClose(env.levelAt(cut + env.release * 0.5), 0.25, 0.02, "release did not start from the cut level");
        assertEqual(env.levelAt(cut + env.release + 1), 0, "release never finished");
    });

    it("retriggering mid-release is continuous", () => {
        const env = new Adsr();
        env.s = 0;
        env.gateOn(0);
        env.gateOff(env.attack);
        const t = env.attack + env.release * 0.5;
        const before = env.levelAt(t);
        env.gateOn(t);
        assertClose(env.levelAt(t), before, 0.0001, "retrigger jumped the envelope");
        assert(env.levelAt(t + 0.001) > before, "retrigger did not resume rising");
    });

    it("ignores a gate off while already released", () => {
        const env = new Adsr();
        env.gateOff(0);
        assertEqual(env.stage, "idle", "a gate off at rest changed the stage");
    });

    it("keeps times inside a musical range", () => {
        const env = new Adsr();
        env.a = 0; env.d = 0; env.r = 0;
        assert(env.attack >= 0.0005, "attack collapsed to zero");
        env.a = 1; env.d = 1; env.r = 1;
        assert(env.attack <= 8.1 && env.attack >= 7.9, "attack range wrong: " + env.attack);
    });
});

/* ============================================================
   5. Gate follower
   ============================================================ */

describe("gate follower", () => {
    it("opens above the threshold and closes below it", () => {
        const follower = new GateFollower();
        assertEqual(follower.update(0.2), false, "opened while closed");
        assertEqual(follower.update(0.9), true, "did not open");
        assertEqual(follower.value, 1);
        assertEqual(follower.update(0.45), false, "chattered in the dead band");
        assertEqual(follower.update(0.1), true, "did not close");
        assertEqual(follower.value, 0);
    });
});

/* ============================================================
   6. Sequencer timing
   ============================================================ */

/* ============================================================
   3b. Noise, sample and hold, waveshaping
   ============================================================ */

describe("noise", () => {
    /** Deterministic 0..1 sequence, so these tests cannot flake. */
    function seededRandom(seed) {
        let state = seed >>> 0;
        return () => {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            return state / 4294967296;
        };
    }

    it("picks a flavour across the tone range", () => {
        assertEqual(noiseToneCoefficients(0).white, 1, "the bottom of the knob should be white");
        assertEqual(noiseToneCoefficients(0.65).pink, 1, "the middle should be pink");
        assertEqual(noiseToneCoefficients(0.9).brown, 1, "the top should be brown");
    });

    it("always sums its weights to one, with no dead spot", () => {
        // audio-engine.js drives three gain nodes from these, so a gap in the
        // weights is silence on the output, not just a quiet spot.
        for (let t = 0; t <= 1.0001; t += 0.01) {
            const w = noiseWeights(t);
            const total = w.white + w.pink + w.brown;
            assertClose(total, 1, 1e-9, "weights do not sum to 1 at tone " + t.toFixed(2));
            assert(total > 0.5, "output collapses at tone " + t.toFixed(2) + ": " + total);
        }
    });

    it("clamps a tone outside 0..1 instead of going silent", () => {
        for (const tone of [-1, -0.2, 1.2, 5]) {
            const w = noiseWeights(tone);
            assertClose(w.white + w.pink + w.brown, 1, 1e-9, "lost the signal at tone " + tone);
        }
    });

    it("never leaves the audio range", () => {
        for (const tone of [0, 0.25, 0.5, 0.65, 0.79, 0.8, 1]) {
            const buffer = fillNoiseBuffer(new Float32Array(4096), tone, seededRandom(7));
            for (let i = 0; i < buffer.length; i++) {
                assert(isFinite(buffer[i]), "produced a non-finite sample at tone " + tone);
                assert(buffer[i] >= -1.01 && buffer[i] <= 1.01,
                    "sample out of range at tone " + tone + ": " + buffer[i]);
            }
        }
    });

    it("is actually noise rather than a constant", () => {
        // 64k samples: the DC trim needs a long buffer to have settled, and
        // this is also the size the real voice builds.
        for (const tone of [0, 0.65, 0.95]) {
            const buffer = fillNoiseBuffer(new Float32Array(65536), tone, seededRandom(11));
            let min = Infinity, max = -Infinity, sum = 0;
            for (const v of buffer) { min = Math.min(min, v); max = Math.max(max, v); sum += v; }
            assert(max - min > 0.2, "tone " + tone + " is nearly flat, it is not noise");
            assert(Math.abs(sum / buffer.length) < 0.01,
                "tone " + tone + " carries a DC offset of " + (sum / buffer.length).toFixed(4));
        }
    });

    it("darkens monotonically as the tone knob rises", () => {
        // Zero crossings per second is the honest measure of how bright a
        // noise signal is. Mean sample-to-sample difference is not: peak-
        // normalised brown noise still steps a fair amount between samples,
        // so it reads as "bright" on that metric while being audibly dark.
        const crossings = (tone) => {
            const buffer = fillNoiseBuffer(new Float32Array(65536), tone, seededRandom(3));
            let count = 0;
            for (let i = 1; i < buffer.length; i++) {
                if ((buffer[i - 1] < 0) !== (buffer[i] < 0)) count++;
            }
            return count;
        };

        const steps = [0, 0.25, 0.5, 0.65, 0.8, 1].map(crossings);
        for (let i = 1; i < steps.length; i++) {
            assert(steps[i] < steps[i - 1],
                "tone knob got brighter past " + [0, 0.25, 0.5, 0.65, 0.8, 1][i] + ": " + steps.join(" "));
        }
        assert(steps[0] / steps[steps.length - 1] > 5,
            "white and brown are not meaningfully different: " + steps.join(" "));
    });
});

describe("sample and hold", () => {
    it("is not started until it has captured something", () => {
        const hold = new SampleHold();
        assertEqual(hold.started, false, "a fresh S&H claims to be running");
        hold.sample(0.5, 0);
        assertEqual(hold.started, true, "still not started after a capture");
    });

    it("tracks its input exactly with no glide", () => {
        const hold = new SampleHold();
        hold.sample(0.2, 0);
        assertEqual(hold.levelAt(0), 0.2, "did not hold the first sample");
        hold.sample(0.8, 1);
        assertEqual(hold.levelAt(1), 0.8, "a new sample did not take effect");
        assertEqual(hold.levelAt(5), 0.8, "the held value drifted");
    });

    it("glides to a new value instead of stepping", () => {
        const hold = new SampleHold();
        hold.glide = 0.2;
        hold.sample(0, 0);
        hold.sample(1, 0);
        const start = hold.levelAt(0);
        const middle = hold.levelAt(0.1);
        const end = hold.levelAt(0.2);
        assertEqual(start, 0, "the glide did not start where it was");
        assertClose(end, 1, 1e-9, "the glide did not arrive");
        assert(middle > 0 && middle < 1, "the glide did not pass through the middle");
        assert(hold.levelAt(0.15) > middle, "the glide is not monotonic");
    });

    it("holds after the glide has finished", () => {
        const hold = new SampleHold();
        hold.glide = 0.1;
        hold.sample(0, 0);
        hold.sample(1, 0);
        assertClose(hold.levelAt(0.1), 1, 1e-9, "did not arrive at the end of the glide");
        assertClose(hold.levelAt(99), 1, 1e-9, "kept moving after the glide ended");
    });

    it("re-anchors mid-glide without a jump", () => {
        const hold = new SampleHold();
        hold.glide = 0.4;
        hold.sample(0, 0);
        hold.sample(1, 0);
        const before = hold.levelAt(0.2);
        hold.sample(0, 0.2);
        assertClose(hold.levelAt(0.2), before, 1e-9, "retargeting the glide jumped");
    });
});

describe("waveshaper curve", () => {
    it("passes through the origin, so it adds no DC offset", () => {
        // A curve that is non-zero at x=0 puts a steady offset on every
        // downstream stage, which is a nasty thing to debug in a mixer.
        for (const sym of [0, 1]) {
            const curve = waveshaperCurve(0.8, sym, 1025);
            assertClose(curve[512], 0, 1e-6, "sym=" + sym + " curve is off centre");
        }
    });

    it("stays inside the audio range at full drive", () => {
        for (const sym of [0, 1]) {
            const curve = waveshaperCurve(1, sym, 2049);
            for (const v of curve) {
                assert(v >= -1.001 && v <= 1.001, "sym=" + sym + " curve clips: " + v);
            }
        }
    });

    it("bends the signal rather than simply amplifying it", () => {
        // Slope near zero is the small-signal gain. If that matched the slope
        // at full scale the module would just be a volume knob.
        const curve = waveshaperCurve(0.6, 1, 2049);
        const slope = (i) => Math.abs(curve[i] - curve[i + 1]);
        const smallSignal = slope(1024);
        const largeSignal = slope(1400);
        assert(smallSignal > largeSignal * 3,
            "the curve is not compressing: " + smallSignal.toFixed(4) + " vs " + largeSignal.toFixed(4));
    });

    it("keeps even and odd curves mirror-symmetric", () => {
        // Even symmetry means the waveform is rectified twice over, odd means
        // it is not. Both must be exactly symmetric or the shaper adds DC.
        for (const sym of [0, 1]) {
            const curve = waveshaperCurve(0.5, sym, 2049);
            for (const i of [200, 700, 1300, 1800]) {
                assertClose(curve[i] + curve[2048 - i], 0, 1e-6,
                    "sym=" + sym + " curve is asymmetric at " + i);
            }
        }
    });

    it("passes a signal through unchanged at zero drive", () => {
        const curve = waveshaperCurve(0, 1, 2049);
        assertClose(curve[1024 + 256], 256 / 1024, 1e-6, "zero drive is not transparent");
    });
});

describe("sequencer timing", () => {
    it("lands steps on exact audio-clock times, not timer ticks", () => {
        const seq = new SequencerRuntime("s");
        const controls = { tempo: 0.5, gateLen: 0.5, octave: 0 }; // 150 BPM -> 0.4s
        const beat = 60 / tempoBpm(controls.tempo);
        seq.start(0);
        const first = seq.tick(0, controls, defaultSteps());
        assert(first.length > 0, "nothing scheduled");
        const expected = [];
        for (let i = 0; i < first.length; i++) expected.push(seq.start ? 0.06 + beat * i : 0);
        first.forEach((event, i) => {
            assertClose(event.time, 0.06 + beat * i, 1e-9, "step " + i + " is not sample accurate");
        });
    });

    it("holds a constant interval regardless of when the timer wakes up", () => {
        const seq = new SequencerRuntime("s");
        const controls = { tempo: 0.5, gateLen: 0.5, octave: 0 };
        const beat = 60 / tempoBpm(controls.tempo);
        seq.start(0);
        const scheduled = [];
        // A badly behaved timer: jittery wake-ups, as setInterval would be.
        const wakeUps = [0.0, 0.137, 0.149, 0.402, 0.91, 1.05, 1.2];
        for (const t of wakeUps) scheduled.push(...seq.tick(t, controls, defaultSteps()));
        for (let i = 1; i < scheduled.length; i++) {
            assertClose(scheduled[i].time - scheduled[i - 1].time, beat, 1e-9, "interval drifted at step " + i);
        }
    });

    it("steps forward and wraps", () => {
        const seq = new SequencerRuntime("s");
        const controls = { tempo: 0.0, gateLen: 0.5, octave: 0 }; // 60 BPM -> 1s
        seq.start(0);
        let lastStep = null;
        for (let i = 0; i < 20; i++) {
            const events = seq.tick(i, controls, defaultSteps());
            for (const event of events) {
                if (lastStep !== null) assertEqual(event.step, (lastStep + 1) % SEQUENCER_STEPS, "did not advance");
                lastStep = event.step;
            }
        }
        assert(lastStep !== null, "never stepped");
    });

    it("quantises pitch to semitones", () => {
        const seq = new SequencerRuntime("s");
        seq.start(0);
        const steps = defaultSteps();
        steps[0] = { gate: 1, cv: 0.44 };
        const events = seq.tick(0, { tempo: 0.5, gateLen: 0.5, octave: 0 }, steps);
        assertClose(events[0].cv * 12, Math.round(events[0].cv * 12), 1e-9, "cv is not on a semitone");
    });

    it("never holds the gate past the next step", () => {
        const seq = new SequencerRuntime("s");
        const controls = { tempo: 0.5, gateLen: 1, octave: 0 };
        const beat = 60 / tempoBpm(controls.tempo);
        seq.start(0);
        const events = seq.tick(0, controls, defaultSteps());
        for (const event of events) {
            assert(event.dur <= beat, "gate of " + event.dur + " overlaps a " + beat + "s step");
        }
    });

    it("produces nothing while stopped", () => {
        const seq = new SequencerRuntime("s");
        assertEqual(seq.tick(0, { tempo: 0.5 }, defaultSteps()).length, 0);
        seq.start(0);
        seq.stop();
        assertEqual(seq.tick(0, { tempo: 0.5 }, defaultSteps()).length, 0);
    });

    it("lights the step that is actually sounding", () => {
        const seq = new SequencerRuntime("s");
        const controls = { tempo: 0.0, gateLen: 0.5, octave: 0 }; // 60 BPM -> 1s
        seq.start(0);
        seq.tick(0, controls, defaultSteps());
        assertEqual(seq.visualStep(0.05), null, "lit a step before it sounded");
        assertEqual(seq.visualStep(0.07), 0, "did not light step 1");
        assertEqual(seq.visualStep(0.98), 0, "moved on before the next step");
        // Step 2 is not queued yet, so it cannot be lit yet.
        seq.tick(1.05, controls, defaultSteps());
        assertEqual(seq.visualStep(1.05), 0, "lit a step before its start time");
        assertEqual(seq.visualStep(1.07), 1, "did not advance the light");
    });

    it("jumps back to the first step on reset", () => {
        const seq = new SequencerRuntime("s");
        seq.start(0);
        seq.tick(5, { tempo: 0.0 }, defaultSteps());
        assert(seq.step !== 0, "never advanced");
        seq.reset(5);
        assertEqual(seq.step, 0);
    });
});

/* ============================================================
   7. Tuning
   ============================================================ */

describe("tuning", () => {
    it("maps the V/Oct input so one volt is one octave", () => {
        const ctx = new MockAudioContext();
        const osc = VOICES.oscillator(ctx, []);
        assertEqual(osc.inputs.voct, osc.inputs.voct, "voct must be a gain feeding detune");
        assertEqual(osc.inputs.voct.gain.value, 1200, "voct input is not 1200 cents per volt");
    });

    it("puts C4 at zero volts", () => {
        assertEqual(noteToVolts(60), 0);
        assertEqual(noteToVolts(72), 1, "an octave up should be one volt");
        assertEqual(noteToVolts(49), -11 / 12);
    });

    it("covers a musical frequency range", () => {
        assertClose(CURVES.hz(0), 20, 0.001);
        assertClose(CURVES.hz(1), 4000, 0.001);
        assertClose(CURVES.cutoff(1), 20000, 0.001);
        assertClose(CURVES.ms(0), 0.0005, 1e-9);
        assert(CURVES.feedback(1) < 1, "feedback reaches 1 and will run away");
    });

    it("places piano black keys between their neighbours", () => {
        const { whites, blacks } = buildPianoKeys(48, 2);
        assertEqual(whites.length, 15, "wrong number of white keys");
        assertEqual(blacks.length, 10, "wrong number of black keys");
        const whiteNotes = whites.map((k) => k.note);
        for (const black of blacks) {
            const sorted = whiteNotes.slice().sort((a, b) => a - b);
            let lower = 0;
            for (const note of sorted) if (note < black.note) lower = note;
            assert(lower && black.note - lower === 1, "black key " + black.note + " is not a semitone above " + lower);
            assert(black.leftPct > 0 && black.leftPct < 100, "black key off the keyboard: " + black.leftPct);
        }
        // No C#/D# pairs, which would sit on a white-key boundary.
        for (const black of blacks) assert(!whiteNotes.includes(black.note), "duplicate note");
    });

    it("draws cables as valid path data with a midpoint", () => {
        const path = cablePath(0, 0, 100, 50);
        assert(/^M [\d.-]+ [\d.-]+ C /.test(path.d), "malformed path: " + path.d);
        // The midpoint of this curve hangs below the straight line, like a cable.
        assertClose(path.mid.x, 50, 0.001, "midpoint x is wrong");
        assert(path.mid.y > 25, "cable does not sag: " + path.mid.y);
    });

    it("reads a control source in volts and an audio source in dB", () => {
        assert(isControlSource("sequencer", "cv"), "sequencer CV is not a control source");
        assert(isControlSource("keyboard", "gate"), "keyboard gate is not a control source");
        assert(isControlSource("envelope", "out"), "envelope out is not a control source");
        assert(isControlSource("lfo", "out"), "LFO out is not a control source");
        assert(!isControlSource("oscillator", "out"), "oscillator out is not audio");
        assert(!isControlSource("vcf", "out"), "filter out is not audio");

        assertEqual(formatCableValue({ cv: true, signed: 0.42, peak: 0.42 }), "+0.42V");
        assertEqual(formatCableValue({ cv: true, signed: -0.1, peak: 0.1 }), "-0.10V");
        assertEqual(formatCableValue({ cv: false, peak: 0.5, signed: 0 }), "-6.0dB");
        assertEqual(formatCableValue({ cv: false, peak: 1, signed: 0 }), "0.0dB");
        assertEqual(formatCableValue({ cv: false, peak: 0, signed: 0 }), "-inf");
        assertEqual(formatCableValue(null), "");
    });

    it("interpolates colour ramps and clamps outside them", () => {
        const at = (stops, t) => rampColor(stops, t);
        const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
        const first = CV_RAMP[0][0];
        const last = CV_RAMP[CV_RAMP.length - 1][0];

        assert(same(at(CV_RAMP, -5), at(CV_RAMP, first)), "did not clamp below the ramp");
        assert(same(at(CV_RAMP, 5), at(CV_RAMP, last)), "did not clamp above the ramp");
        assert(!same(at(CV_RAMP, first), at(CV_RAMP, last)), "the ramp is a single flat colour");

        const mid = at(CV_RAMP, 0);
        assert(Array.isArray(mid) && mid.length === 3, "ramp did not return rgb");
        for (const channel of mid) {
            assert(Number.isInteger(channel), "channel is not an integer: " + channel);
            assert(channel >= 0 && channel <= 255, "channel out of range: " + channel);
        }

        // Halfway between two stops is the average of them.
        const a = CV_RAMP[3][1];
        const b = CV_RAMP[4][1];
        const halfway = at(CV_RAMP, (CV_RAMP[3][0] + CV_RAMP[4][0]) / 2);
        for (let i = 0; i < 3; i++) {
            assertEqual(halfway[i], Math.round((a[i] + b[i]) / 2), "channel " + i + " is not linear");
        }
    });

    it("runs control cables cold at zero volts and green when hot", () => {
        const zero = channels(cableColor({ cv: true, signed: 0, peak: 0, level: 0 }));
        const hot = channels(cableColor({ cv: true, signed: 1, peak: 1, level: 1 }));
        assert(zero[2] > zero[0], "0 V should read cold: " + zero);
        assert(hot[1] > hot[0], "1 V should read green: " + hot);
        assert(hot[1] > zero[1], "1 V should be brighter than 0 V");
    });

    it("runs audio cables to red at full scale", () => {
        const quiet = channels(cableColor({ cv: false, signed: 0, peak: 0, level: 0 }));
        const hot = channels(cableColor({ cv: false, signed: 0, peak: 1, level: 1 }));
        assert(hot[0] > hot[2], "full scale should read red: " + hot);
        assert(quiet[1] < hot[1], "full scale should be brighter than silence");
    });

    it("reports drive as a 0..1 intensity for both kinds of signal", () => {
        assertEqual(cableIntensity({ cv: true, signed: 0.5, peak: 0.5, level: 0.5 }), 0.5);
        assertEqual(cableIntensity({ cv: false, signed: 0, peak: 0.25, level: 0.25 }), 0.25);
        assertEqual(cableIntensity({ cv: true, signed: -0.5, peak: 0.5, level: -0.5 }), 0.5, "a negative CV should still drive");
        assertEqual(cableIntensity({ cv: false, signed: 0, peak: 4, level: 4 }), 1, "drive is not clamped");
        assertEqual(cableIntensity(null), 0);
        assertEqual(cableColor(null), null);
    });
});

/* ============================================================
   8. Engine graph
   ============================================================ */

describe("engine graph", () => {
    itAsync("connects CV and gate cables, which the old port lookup dropped", async () => {
        const engine = await newEngine();
        engine.addModule(makeModule("sequencer", "seq_1", 0, 0));
        engine.addModule(makeModule("envelope", "env_1", 0, 0));
        engine.syncTopology([{ id: "c1", from: "seq_1-out-gate", to: "env_1-in-gate" }]);
        assertEqual(engine.connections.size, 1, "gate cable was not made");
        const conn = engine.connections.get("c1");
        assert(conn.src && conn.dst, "connection not recorded");
        assertEqual(conn.src.kind, "constant", "gate output is not the gate source");
        assertEqual(conn.dst.kind, "analyser", "envelope gate input is not wired");
    });

    itAsync("connects every port of every module type", async () => {
        const engine = await newEngine();
        const sink = makeModule("mixer", "sink", 0, 0);
        engine.addModule(sink);
        const cables = [];
        for (const [type, def] of Object.entries(MODULE_DEFS)) {
            const id = "src_" + type;
            engine.addModule(makeModule(type, id, 0, 0));
            for (const port of def.outputs) {
                cables.push({ id: "c_" + type + "_" + port.id, from: makeJackId(id, "out", port.id), to: "sink-in-in1" });
            }
        }
        engine.syncTopology(cables);
        assertEqual(engine.connections.size, cables.length, "not every output port connected");
    });

    itAsync("does not duplicate connections when nothing changed", async () => {
        // The old rebuild-everything approach reconnected on every patch change,
        // which is how mixer and delay inputs ended up doubled up.
        const engine = await newEngine();
        engine.addModule(makeModule("oscillator", "osc_1", 0, 0));
        engine.addModule(makeModule("mixer", "mix_1", 0, 0));
        const cables = [{ id: "c1", from: "osc_1-out-out", to: "mix_1-in-in1" }];
        engine.syncTopology(cables);
        const before = engine.ctx.log.filter((e) => e.type === "connect").length;
        for (let i = 0; i < 5; i++) engine.syncTopology(cables);
        const after = engine.ctx.log.filter((e) => e.type === "connect").length;
        assertEqual(after, before, "reconnected an unchanged patch");
        assertEqual(engine.connections.size, 1);
    });

    itAsync("only touches the cables that actually changed", async () => {
        const engine = await newEngine();
        engine.addModule(makeModule("oscillator", "osc_1", 0, 0));
        engine.addModule(makeModule("vcf", "vcf_1", 0, 0));
        engine.addModule(makeModule("mixer", "mix_1", 0, 0));
        const first = { id: "c1", from: "osc_1-out-out", to: "vcf_1-in-in" };
        const second = { id: "c2", from: "vcf_1-out-out", to: "mix_1-in-in1" };
        engine.syncTopology([first]);
        const connectsAfterFirst = engine.ctx.log.filter((e) => e.type === "connect").length;
        engine.syncTopology([first, second]);
        assertEqual(engine.ctx.log.filter((e) => e.type === "connect").length, connectsAfterFirst + 1,
            "adding one cable made more than one connection");
        engine.syncTopology([first]);
        assertEqual(engine.connections.size, 1, "removed cable is still connected");
        const disconnects = engine.ctx.log.filter((e) => e.type === "disconnect");
        assertEqual(disconnects.length, 1, "expected exactly one disconnect");
    });

    itAsync("stops and disconnects everything when a module is removed", async () => {
        const engine = await newEngine();
        engine.addModule(makeModule("oscillator", "osc_1", 0, 0));
        engine.addModule(makeModule("vcf", "vcf_1", 0, 0));
        engine.syncTopology([{ id: "c1", from: "osc_1-out-out", to: "vcf_1-in-in" }]);
        const voice = engine.getVoice("osc_1");
        const sources = voice.owned.filter((n) => typeof n.start === "function");
        assert(sources.length > 0, "oscillator owns no sources");
        engine.removeModule("osc_1");
        assertEqual(engine.connections.size, 0, "cable survived the module");
        assertEqual(engine.voices.size, 1, "voice not removed");
        for (const node of sources) assert(node.stopped, "a source was left running");
    });

    itAsync("keeps the sequencer clock running after a module is re-added", async () => {
        const engine = await newEngine();
        engine.addModule(makeModule("sequencer", "seq_1", 0, 0));
        engine.removeModule("seq_1");
        engine.addModule(makeModule("sequencer", "seq_1", 0, 0, { run: 1 }));
        const voice = engine.getVoice("seq_1");
        assert(voice.runtime.running, "run control did not start the clock");
        engine.removeModule("seq_1");
        const requeued = engine.syncTopology([]);
        assertEqual(requeued, undefined);
    });

    itAsync("follows a gate through the graph into the envelope", async () => {
        const engine = await newEngine();
        engine.addModule(makeModule("envelope", "env_1", 0, 0, { a: 0.5, d: 0.5, s: 0.2, r: 0.5 }));
        engine.addModule(makeModule("sequencer", "seq_1", 0, 0));
        engine.syncTopology([{ id: "c1", from: "seq_1-out-gate", to: "env_1-in-gate" }]);

        const voice = engine.getVoice("env_1");
        const gateAnalyser = voice.inputs.gate;
        const out = voice.outputs.out.offset;
        const attack = CURVES.ms(0.5);
        const decay = CURVES.ms(0.5);
        assertEqual(voice.adsr.stage, "idle");
        assertEqual(out.automation.length, 0, "automation ran before any gate");

        gateAnalyser.sample = 1;
        voice.poll(0);
        // applyTo hands the attack ramp to the AudioParam, then moves to decay.
        assertEqual(voice.adsr.stage, "decay", "attack was not scheduled");
        assertClose(out.valueAt(attack), 1, 1e-6, "the envelope did not reach full scale");
        assertClose(out.valueAt(attack + decay), 0.2, 1e-6, "the envelope did not fall to sustain");

        gateAnalyser.sample = 0;
        voice.poll(0.01);
        assertEqual(voice.adsr.stage, "release", "gate did not close the envelope");
        assertClose(out.valueAt(0.01 + attack), 0, 1e-6, "the envelope did not return to silence");
    });

    itAsync("releases the gate when a CV source is removed", async () => {
        // A stopped ConstantSourceNode keeps emitting its last value, so a
        // keyboard deleted mid-note would otherwise hold every envelope open.
        const engine = await newEngine();
        engine.addModule(makeModule("keyboard", "kbd_1", 0, 0));
        const voice = engine.getVoice("kbd_1");
        voice.noteOn(72);
        assertEqual(voice.outputs.gate.offset.value, 1, "gate did not open");
        engine.removeModule("kbd_1");
        assertEqual(voice.outputs.gate.offset.value, 0, "gate was left open after removal");
    });

    itAsync("meters a cable from a side tap, not in series", async () => {
        const engine = await newEngine();
        engine.addModule(makeModule("sequencer", "seq_1", 0, 0));
        const voice = engine.getVoice("seq_1");
        const source = voice.outputs.cv;
        const connectsBefore = source.connections.length;

        const measure = engine.measureOutput("seq_1-out-cv");
        assert(measure, "no measurement returned");
        assertEqual(measure.cv, true, "sequencer CV should read as a control source");
        assertEqual(source.connections.length, connectsBefore + 1,
            "metering should attach a side branch, not sit in the signal path");

        // One tap per port, shared by every cable off that port.
        engine.measureOutput("seq_1-out-cv");
        assertEqual(source.connections.length, connectsBefore + 1, "a second tap was created for the same port");
    });


    itAsync("carries a running sequencer gate through to the cable meter", async () => {
        // Nothing used to assert this. The mock applied automation instantly,
        // so a gate looked permanently open and a gate that never opened were
        // the same test. With real timing it is possible to tell the three
        // candidate faults apart: the scheduler, the tap, and the colour ramp.
        const engine = await newEngine();
        const ctx = engine.ctx;
        engine.addModule(makeModule("sequencer", "seq_1", 0, 0, { tempo: 0.5, run: 1, gateLen: 0.5, octave: 0 }));
        const voice = engine.getVoice("seq_1");
        engine.setSteps("seq_1", defaultSteps().map((s, i) => (i === 0 ? { cv: 0.5, gate: 1 } : s)));

        const seen = [];
        for (let i = 0; i < 150; i++) {
            ctx.advance(1 / 60);
            // requestAnimationFrame is inert in this mock, so the engine's
            // frame is stepped by hand.
            for (const ev of voice.runtime.tick(ctx.currentTime, voice.controls, voice.getSteps())) {
                voice.scheduleStep(ev);
            }
            ctx.refresh();
            seen.push(engine.measureOutput("seq_1-out-gate").signed);
        }

        const high = Math.max(...seen);
        const low = Math.min(...seen);
        assert(high > 0.9, "the gate never opened on the cable, peak " + high.toFixed(3));
        assert(low < 0.1, "the gate never closed on the cable, floor " + low.toFixed(3));

        const colourAt = (v) => cableColor({ cv: true, signed: v, peak: Math.abs(v), rms: Math.abs(v), level: v });
        assert(colourAt(high) !== colourAt(low), "the gate swung but the cable colour never moved");
    });

    itAsync("resolves a control voltage from the mean, not one lucky sample", async () => {
        // The buffer is 32 samples; a ramp inside it means no single sample is
        // the value. Averaging is what makes a 0.4 V CV read 0.40 rather than
        // whatever the tap happened to catch.
        const engine = await newEngine();
        const ctx = engine.ctx;
        engine.addModule(makeModule("sequencer", "seq_1", 0, 0));
        const voice = engine.getVoice("seq_1");
        engine.measureOutput("seq_1-out-cv"); // creates the tap

        ctx.advance(1);
        voice.setCV(0.4, ctx.currentTime);
        ctx.advance(0.02); // past setCV's 5 ms ramp
        ctx.refresh();
        assertClose(engine.measureOutput("seq_1-out-cv").signed, 0.4, 1e-6,
            "a 0.4 V control voltage did not read 0.4");
    });

    itAsync("holds a short transient long enough to see it", async () => {
        // An ADSR spike is tens of milliseconds. Without ballistics it lands
        // between two frames and the cable never appears to move at all.
        const engine = await newEngine();
        const ctx = engine.ctx;
        engine.addModule(makeModule("envelope", "env_1", 0, 0));
        const voice = engine.getVoice("env_1");
        engine.measureOutput("env_1-out-out"); // creates the tap

        const out = voice.outputs.out.offset;
        ctx.advance(1);
        out.setValueAtTime(1, ctx.currentTime);
        ctx.refresh();
        assert(engine.measureOutput("env_1-out-out").level > 0.9, "the transient did not register");

        // Signal is over, but the meter must still be visibly alight.
        out.setValueAtTime(0, ctx.currentTime);
        ctx.advance(1 / 60);
        ctx.refresh();
        assert(engine.measureOutput("env_1-out-out").level > 0.5,
            "the transient vanished on the very next frame");

        // And it has to actually come back down rather than latching on.
        ctx.advance(2);
        ctx.refresh();
        assert(engine.measureOutput("env_1-out-out").level < 0.05,
            "the meter never fell back to rest");
    });

    itAsync("spans the sequencer's real voltage range instead of pinning", async () => {
        // The default patch runs the sequencer at +1 to +1.9 V. On the old
        // +/-1 V ramp that cable was clamped at full brightness for 98% of
        // frames and looked dead. The ramp now covers two octaves.
        const engine = await newEngine();
        const ctx = engine.ctx;
        engine.addModule(makeModule("sequencer", "seq_1", 0, 0, { run: 1, octave: 0.4 }));
        const voice = engine.getVoice("seq_1");
        assertEqual(Math.round(voice.controls.octave * 2), 1, "the octave offset moved");

        const seen = new Set();
        for (const cv of [1.0, 1.25, 1.5833, 1.9167]) {
            ctx.advance(0.1);
            voice.setCV(cv, ctx.currentTime);
            ctx.refresh();
            seen.add(cableColor(engine.measureOutput("seq_1-out-cv")));
        }
        assertEqual(seen.size, 4, "the sequencer CV range still collapses to one colour: " + [...seen].join(" "));
    });

    itAsync("meters a silence and cannot meter an input", async () => {
        const engine = await newEngine();
        engine.addModule(makeModule("oscillator", "osc_1", 0, 0));
        const measure = engine.measureOutput("osc_1-out-out");
        assert(measure, "no measurement returned");
        assertEqual(measure.cv, false, "oscillator out should read as audio");
        assertEqual(measure.peak, 0, "a silent source should meter zero");
        assertEqual(engine.measureOutput("osc_1-in-voct"), null, "metered an input jack");
        assertEqual(engine.measureOutput("nonsense"), null, "metered a malformed jack id");
    });

itAsync("applies a control snapshot to the scheduler", async () => {
        const engine = await newEngine();
        const module = makeModule("sequencer", "seq_1", 0, 0, { tempo: 0.5, run: 1, gateLen: 0.5, octave: 0 });
        engine.addModule(module);
        const voice = engine.getVoice("seq_1");
        assertEqual(voice.controls.tempo, 0.5, "controls not snapshotted onto the voice");
        module.controls.tempo = 0.9;
        engine.applyControls(module);
        assertEqual(voice.controls.tempo, 0.9, "tempo update not picked up");
    });
});

/* ---------- report ---------- */

await runSuite();

console.log("");
if (failures.length) {
    console.error("FAILURES\n");
    for (const failure of failures) console.error("  x " + failure + "\n");
}
console.log((failures.length ? "FAILED " : "ok ") + passed + " passed, " + failures.length + " failed");
process.exit(failures.length ? 1 : 0);