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

function mockParam(ctx) {
    return {
        value: 0,
        automation: [],
        setValueAtTime(v, t) { this.value = v; this.automation.push(["set", v, t]); return this; },
        linearRampToValueAtTime(v, t) { this.value = v; this.automation.push(["ramp", v, t]); return this; },
        setTargetAtTime(v, t, c) { this.value = v; this.automation.push(["target", v, t, c]); return this; },
        cancelScheduledValues(t) { this.automation.push(["cancel", t]); return this; },
        cancelAndHoldAtTime(t) { this.automation.push(["hold", t]); return this; },
        connect(dest) { ctx.log.push({ type: "connect", param: true, dest }); return dest; },
        disconnect() { return this; },
    };
}

function mockNode(ctx, kind) {
    const node = {
        kind,
        sample: 0,
        connections: [],
        started: false,
        stopped: false,
        connect(dest) {
            node.connections.push(dest);
            ctx.log.push({ type: "connect", from: node, to: dest });
            return dest;
        },
        disconnect(dest) {
            if (dest === undefined) node.connections = [];
            else {
                const i = node.connections.indexOf(dest);
                if (i >= 0) node.connections.splice(i, 1);
                else ctx.log.push({ type: "disconnect-miss", from: node, to: dest });
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
    }
    node.fftSize = 2048;
    node.smoothingTimeConstant = 0;
    return node;
}

class MockAudioContext {
    constructor() {
        this.state = "running";
        this.currentTime = 0;
        this.log = [];
        this.destination = mockNode(this, "destination");
    }
    createOscillator() { return mockNode(this, "osc"); }
    createGain() { return mockNode(this, "gain"); }
    createBiquadFilter() { return mockNode(this, "biquad"); }
    createDelay() { return mockNode(this, "delay"); }
    createAnalyser() { return mockNode(this, "analyser"); }
    createConstantSource() { return mockNode(this, "constant"); }
    createWaveShaper() { return mockNode(this, "shaper"); }
    resume() { this.state = "running"; return Promise.resolve(); }
    close() { this.state = "closed"; return Promise.resolve(); }
    advance(seconds) { this.currentTime += seconds; }
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
const CURVES = run("CURVES");
const buildPianoKeys = run("buildPianoKeys");
const noteToVolts = run("noteToVolts");
const tempoBpm = run("tempoBpm");
const cablePath = run("cablePath");
const isControlSource = run("isControlSource");
const formatCableValue = run("formatCableValue");

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
        const scheduled = () => out.automation.map((e) => e[0] + " " + e[1]).join(", ");
        assertEqual(voice.adsr.stage, "idle");
        assertEqual(out.automation.length, 0, "automation ran before any gate");

        gateAnalyser.sample = 1;
        voice.poll(0);
        // applyTo hands the attack ramp to the AudioParam, then moves to decay.
        assertEqual(voice.adsr.stage, "decay", "attack was not scheduled");
        assert(/ramp 1(\.0+)?(,|$)/.test(scheduled()), "no ramp to full scale: " + scheduled());
        assert(/ramp 0\.2(,|$)/.test(scheduled()), "no ramp down to sustain: " + scheduled());

        gateAnalyser.sample = 0;
        voice.poll(0.01);
        assertEqual(voice.adsr.stage, "release", "gate did not close the envelope");
        assert(/ramp 0(\.0+)?$/.test(scheduled()), "no ramp to silence: " + scheduled());
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