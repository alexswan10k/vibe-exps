"use strict";
/* ============================================================
   Modular Synth — static tables and tuning helpers.
   Loaded first; everything else reads from here.
   ============================================================ */

/** Number of steps on every sequencer. Used everywhere; no more magic 8s. */
const SEQUENCER_STEPS = 8;

/** Rack canvas grid, in rack units. Modules snap to this when dropped. */
const RACK_GRID = 10;

const ZOOM_MIN = 0.35;
const ZOOM_MAX = 2.2;

/* ---------- control curves ----------
   Knob travel is always 0..1. `curve` decides how that maps to a
   real-world value. Keeping the mapping in one place means the engine
   and the readout can never disagree about what a knob means. */

const CURVES = {
    linear: (v) => v,
    /** 0..1 -> 20Hz..4000Hz */
    hz: (v) => 20 * Math.pow(200, v),
    /** 0..1 -> 20Hz..20kHz */
    cutoff: (v) => 20 * Math.pow(1000, v),
    /** 0..1 -> 0.05Hz..20Hz (bipolar-ish LFO range) */
    lfoRate: (v) => 0.05 * Math.pow(400, v),
    /** 0..1 -> 0.5ms..8s */
    ms: (v) => 0.0005 * Math.pow(16000, v),
    /** 0..1 -> 0..800ms */
    delayTime: (v) => v * 0.8,
    /** 0..1 -> 0..0.95 feedback, deliberately shy of runaway */
    feedback: (v) => v * 0.95,
};

const fmtHz = (hz) => (hz >= 1000 ? (hz / 1000).toFixed(2) + "k" : hz.toFixed(hz < 10 ? 2 : 0));
const fmtMs = (s) => (s >= 1 ? s.toFixed(2) + "s" : (s * 1000).toFixed(s < 0.1 ? 1 : 0) + "ms");
const fmtPct = (v) => (v * 100).toFixed(0) + "%";

/* ---------- module definitions ----------
   `controls` drives the generic knob/select rendering.
   `inputs`/`outputs` drive the jack panel AND are validated against the
   audio engine by smoke-test.mjs — that test is what stops a declared
   port from silently failing to exist in the DSP graph. */

const MODULE_DEFS = {
    oscillator: {
        name: "Oscillator",
        abbr: "VCO",
        width: 172,
        controls: [
            { id: "freq", name: "Freq", type: "knob", default: 0.3, curve: "hz", display: (v) => fmtHz(CURVES.hz(v)) + "Hz" },
            { id: "wave", name: "Wave", type: "select", default: 1, options: ["Sine", "Square", "Saw", "Tri"] },
            { id: "level", name: "Level", type: "knob", default: 0.7, display: fmtPct },
        ],
        inputs: [
            { id: "voct", name: "V/Oct" },
            { id: "fm", name: "FM" },
        ],
        outputs: [{ id: "out", name: "Out" }],
    },

    lfo: {
        name: "LFO",
        abbr: "LFO",
        width: 150,
        controls: [
            { id: "freq", name: "Rate", type: "knob", default: 0.35, curve: "lfoRate", display: (v) => CURVES.lfoRate(v).toFixed(2) + "Hz" },
            { id: "amt", name: "Amt", type: "knob", default: 0.4, display: (v) => (v * 1200).toFixed(0) + "¢" },
        ],
        inputs: [],
        outputs: [{ id: "out", name: "Out" }],
    },

    vcf: {
        name: "Filter",
        abbr: "VCF",
        width: 168,
        controls: [
            { id: "cutoff", name: "Cutoff", type: "knob", default: 0.55, curve: "cutoff", display: (v) => fmtHz(CURVES.cutoff(v)) + "Hz" },
            { id: "res", name: "Res", type: "knob", default: 0.15, display: fmtPct },
        ],
        inputs: [
            { id: "in", name: "In" },
            { id: "mod", name: "Mod" },
        ],
        outputs: [{ id: "out", name: "Out" }],
    },

    vca: {
        name: "Amplifier",
        abbr: "VCA",
        width: 148,
        controls: [
            // Sums with the CV input, so this is a manual offset, not a level.
            { id: "offset", name: "Offset", type: "knob", default: 0, display: fmtPct },
        ],
        inputs: [
            { id: "in", name: "In" },
            { id: "cv", name: "CV" },
        ],
        outputs: [{ id: "out", name: "Out" }],
    },

    envelope: {
        name: "Envelope",
        abbr: "ADSR",
        width: 186,
        panel: "envelope",
        controls: [
            { id: "a", name: "Attack", type: "knob", default: 0.25, curve: "ms", display: (v) => fmtMs(CURVES.ms(v)) },
            { id: "d", name: "Decay", type: "knob", default: 0.45, curve: "ms", display: (v) => fmtMs(CURVES.ms(v)) },
            { id: "s", name: "Sustain", type: "knob", default: 0.45, display: fmtPct },
            { id: "r", name: "Release", type: "knob", default: 0.45, curve: "ms", display: (v) => fmtMs(CURVES.ms(v)) },
        ],
        inputs: [{ id: "gate", name: "Gate" }],
        outputs: [{ id: "out", name: "Out" }],
    },

    delay: {
        name: "Delay",
        abbr: "DLY",
        width: 168,
        controls: [
            { id: "time", name: "Time", type: "knob", default: 0.42, curve: "delayTime", display: (v) => CURVES.delayTime(v).toFixed(3) + "s" },
            { id: "fb", name: "Fback", type: "knob", default: 0.42, curve: "feedback", display: fmtPct },
            { id: "mix", name: "Mix", type: "knob", default: 0.3, display: fmtPct },
        ],
        inputs: [{ id: "in", name: "In" }],
        outputs: [{ id: "out", name: "Out" }],
    },

    mixer: {
        name: "Mixer",
        abbr: "MIX",
        width: 178,
        controls: [
            { id: "lvl1", name: "Ch 1", type: "knob", default: 0.6, display: fmtPct },
            { id: "lvl2", name: "Ch 2", type: "knob", default: 0.6, display: fmtPct },
            { id: "lvl3", name: "Ch 3", type: "knob", default: 0.6, display: fmtPct },
            { id: "master", name: "Master", type: "knob", default: 0.7, display: fmtPct },
        ],
        inputs: [
            { id: "in1", name: "In 1" },
            { id: "in2", name: "In 2" },
            { id: "in3", name: "In 3" },
        ],
        outputs: [{ id: "out", name: "Out" }],
    },

    sequencer: {
        name: "Sequencer",
        abbr: "SEQ",
        width: 346,
        panel: "sequencer",
        controls: [
            { id: "tempo", name: "Tempo", type: "knob", default: 0.42, display: (v) => tempoBpm(v).toFixed(0) + "BPM" },
            { id: "run", name: "Run", type: "switch", default: 0 },
            { id: "gateLen", name: "Gate", type: "knob", default: 0.5, display: fmtPct },
            { id: "octave", name: "Octave", type: "knob", default: 0.4, display: (v) => "+" + Math.round(v * 2) + " oct" },
        ],
        inputs: [
            { id: "reset", name: "Reset" },
        ],
        outputs: [
            { id: "cv", name: "CV" },
            { id: "gate", name: "Gate" },
        ],
    },

    keyboard: {
        name: "Keyboard",
        abbr: "KBD",
        width: 268,
        panel: "keyboard",
        controls: [],
        inputs: [],
        outputs: [
            { id: "cv", name: "CV" },
            { id: "gate", name: "Gate" },
        ],
    },

    midi_in: {
        name: "MIDI In",
        abbr: "MIDI",
        width: 156,
        panel: "midi",
        controls: [],
        inputs: [],
        outputs: [
            { id: "cv", name: "CV" },
            { id: "gate", name: "Gate" },
        ],
    },

    oscilloscope: {
        name: "Scope",
        abbr: "SCP",
        width: 208,
        panel: "scope",
        controls: [
            { id: "zoom", name: "Time", type: "knob", default: 0.35, display: (v) => ((1 - v) * 40).toFixed(1) + "ms" },
        ],
        inputs: [{ id: "in", name: "In" }],
        outputs: [],
    },

    output: {
        name: "Output",
        abbr: "OUT",
        width: 156,
        controls: [
            { id: "vol", name: "Volume", type: "knob", default: 0.55, display: fmtPct },
        ],
        inputs: [{ id: "in", name: "L/Mono" }],
        outputs: [],
    },
};

/** Sidebar order. */
const MODULE_ORDER = Object.keys(MODULE_DEFS);

/* ---------- cable readouts ---------- */

/**
 * Control sources carry a slow signal that reads best in volts.
 * Everything else is audio, which reads best as a peak level in dB.
 */
function isControlSource(type, portId) {
    if (type === "sequencer" || type === "keyboard" || type === "midi_in") return true;
    if (type === "envelope" || type === "lfo") return portId === "out";
    return false;
}

/** Formats a measurement taken from a cable. */
function formatCableValue(measure) {
    if (!measure) return "";
    if (measure.cv) {
        const v = measure.signed;
        return (v >= 0 ? "+" : "") + v.toFixed(2) + "V";
    }
    if (measure.peak < 0.001) return "-inf";
    const db = 20 * Math.log10(measure.peak);
    return (db > -0.05 ? "0.0" : db.toFixed(1)) + "dB";
}

/* ---------- sequencer tuning ---------- */

/** Tempo knob 0..1 -> 60..240 BPM. */
function tempoBpm(knob) {
    return 60 + knob * 180;
}

/** Gate knob 0..1 -> 0.05..0.95 of a step. Capped below 1 so the gate is
    always fully closed before the next step is scheduled. */
function gateLength(stepSeconds, knob) {
    return stepSeconds * (0.05 + knob * 0.9);
}

/** Quantise a CV knob to semitones so the sequencer plays in tune. */
function quantiseVolts(v) {
    return Math.round(v * 12) / 12;
}

/* ---------- note / piano tables ---------- */

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const BASE_NOTE = 60; // C4 is 0 volts

function noteToVolts(note) {
    return (note - BASE_NOTE) / 12;
}

function noteName(note) {
    return NOTE_NAMES[note % 12] + (Math.floor(note / 12) - 1);
}

function freqToNote(freq) {
    return BASE_NOTE + 12 * Math.log2(freq / 261.6255653);
}

/**
 * Build a playable 2-octave keyboard.
 * Black keys are positioned from the white-key layout rather than
 * hardcoded percentages, which is what the old table got wrong.
 */
function buildPianoKeys(lowNote, octaves) {
    const whiteOffsets = [0, 2, 4, 5, 7, 9, 11];
    const keys = [];
    const totalWhites = 7 * octaves + 1;

    for (let i = 0; i < totalWhites; i++) {
        const note = lowNote + whiteOffsets[i % 7] + 12 * Math.floor(i / 7);
        keys.push({ note, black: false });
    }

    const whiteWidth = 100 / totalWhites;
    const blackWidth = whiteWidth * 0.62;
    const blacks = [];

    for (let i = 0; i < totalWhites - 1; i++) {
        const semitone = whiteOffsets[i % 7] + 12 * Math.floor(i / 7) + 1;
        // Skip the gap between E/F and B/C.
        const natural = semitone % 12;
        if (natural === 5 || natural === 0) continue;
        blacks.push({
            note: lowNote + semitone,
            black: true,
            leftPct: (i + 1) * whiteWidth - blackWidth / 2,
        });
    }

    return { whites: keys, blacks, whiteWidth };
}

/** Computer-keyboard note mapping: row 1 = white keys, row 2 = sharps. */
const COMPUTER_KEY_MAP = {
    a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
    k: 12, o: 13, l: 14, p: 15, ";": 16,
};