"use strict";
/* ============================================================
   Modular Synth — pure DSP timing and envelope maths.
   No audio nodes here: these classes only decide *what* should
   happen and *when*. audio-engine.js executes the decisions.
   Every class in this file is unit-tested by smoke-test.mjs.
   ============================================================ */

/** How far ahead of the audio clock the scheduler queues events. */
const SCHEDULE_AHEAD = 0.12;

/** How often the scheduler wakes up. Must be well under SCHEDULE_AHEAD. */
const SCHEDULER_TICK_MS = 25;

/** Pre-roll after Run is engaged, so the first step is not late. */
const SEQUENCER_PREROLL = 0.06;

/* ============================================================
   ADSR envelope
   ============================================================ */

/**
 * Models an ADSR as an explicit state machine.
 *
 * The old implementation read `param.value` to know where the envelope
 * was when the gate opened or closed. `.value` is only the value at the
 * end of the last render quantum, so retriggering mid-ramp jumped.
 * Here the level is computed analytically instead, which means the
 * envelope can be retriggered at any moment without a discontinuity.
 */
class Adsr {
    constructor() {
        this.a = 0.25;
        this.d = 0.45;
        this.s = 0.45;
        this.r = 0.45;
        this.stage = "idle";
        this.stageStart = 0;
        this.startLevel = 0;
    }

    /** Knob values 0..1 in, seconds out. */
    get attack() { return Math.max(0.0005, CURVES.ms(this.a)); }
    get decay() { return Math.max(0.001, CURVES.ms(this.d)); }
    get release() { return Math.max(0.001, CURVES.ms(this.r)); }
    get sustain() { return this.s; }

    /** Output level at audio-clock time `t`. */
    levelAt(t) {
        const e = t - this.stageStart;
        switch (this.stage) {
            case "attack": {
                if (e >= this.attack) return this.sustain;
                return this.startLevel + (1 - this.startLevel) * (e / this.attack);
            }
            case "decay": {
                if (e >= this.decay) return this.sustain;
                return 1 + (this.sustain - 1) * (e / this.decay);
            }
            case "release":
                if (e >= this.release) return 0;
                return this.startLevel * (1 - e / this.release);
            default:
                return 0;
        }
    }

    gateOn(t) {
        // Retrigger from wherever we are, rather than from 0.
        this.startLevel = this.levelAt(t);
        this.stageStart = t;
        if (this.startLevel < 1) this.stage = "attack";
        else this.stage = "decay";
    }

    gateOff(t) {
        if (this.stage === "idle" || this.stage === "release") return false;
        this.startLevel = this.levelAt(t);
        this.stageStart = t;
        this.stage = "release";
        return true;
    }

    /** Schedule this envelope's shape onto an AudioParam. */
    applyTo(param, now) {
        const level = this.levelAt(now);
        param.cancelScheduledValues(now);
        param.setValueAtTime(level, now);

        if (this.stage === "attack") {
            param.linearRampToValueAtTime(1, now + Math.max(0.0005, this.attack - (now - this.stageStart)));
            param.linearRampToValueAtTime(this.sustain, now + Math.max(0.0005, this.attack - (now - this.stageStart)) + this.decay);
            this.stage = "decay";
            this.stageStart = now;
            this.startLevel = 1;
        } else if (this.stage === "decay") {
            param.linearRampToValueAtTime(this.sustain, now + Math.max(0.0005, this.decay - (now - this.stageStart)));
        } else if (this.stage === "release") {
            param.linearRampToValueAtTime(0, now + Math.max(0.0005, this.release - (now - this.stageStart)));
            this.stageStart = now;
            this.startLevel = 0;
        }
        return level;
    }
}

/* ============================================================
   Gate follower
   ============================================================ */

/**
 * Turns a gate signal into discrete gate-on / gate-off events.
 * Hysteresis keeps a signal sitting near the threshold from chattering.
 */
class GateFollower {
    constructor(onThreshold = 0.5, offThreshold = 0.35) {
        this.onThreshold = onThreshold;
        this.offThreshold = offThreshold;
        this.open = false;
    }

    /** Feed one sample in 0..1. Returns true on a state change. */
    update(sample) {
        const next = this.open ? sample > this.offThreshold : sample > this.onThreshold;
        if (next === this.open) return false;
        this.open = next;
        return true;
    }

    get value() { return this.open ? 1 : 0; }
}

/* ============================================================
   Noise
   ============================================================ */

/**
 * Which flavour a tone position calls for, ignoring the crossfade.
 *
 * White noise is flat and far too bright to be a useful source on its own.
 * Pink has equal energy per octave, brown equal energy per frequency, which
 * is what a one-pole integrating filter gives for free.
 *
 * This is the coarse answer. The synthesiser uses noiseWeights() below, which
 * crossfades between the same three.
 */
function noiseToneCoefficients(tone) {
    if (tone < 0.5) return { white: 1, pink: 0, brown: 0 };
    if (tone < 0.8) return { white: 0, pink: 1, brown: 0 };
    return { white: 0, pink: 0, brown: 1 };
}

/**
 * Peak each raw noise flavour reaches, measured rather than guessed.
 * These filters do not produce unit-peak output, so without this the pink
 * tone clips and the brown tone is almost inaudible.
 */
const NOISE_PEAKS = { white: 1, pink: 3.4, brown: 0.26 };

/**
 * Crossfade weights for the three flavours at a given tone position.
 * White fades to pink across the first half of the knob, pink to brown
 * across the rest, and the weights always sum to one. audio-engine.js feeds
 * the same numbers to three gain nodes so the knob cannot jump.
 */
function noiseWeights(tone) {
    const t = Math.max(0, Math.min(1, tone));
    if (t < 0.5) return { white: 1 - t / 0.5, pink: t / 0.5, brown: 0 };
    return { white: 0, pink: 1 - (t - 0.5) / 0.3, brown: (t - 0.5) / 0.3 };
}

/**
 * Fills a buffer with noise of the requested flavour.
 *
 * Each flavour is normalised to the same peak and crossfaded by weight, so
 * the tone knob sweeps smoothly and the output level holds steady instead of
 * jumping as the character changes.
 *
 * The filtered flavours also carry a small DC offset — an integrator with a
 * feedback term is not perfectly unbiased — which would show up as a constant
 * on every downstream meter, so the running mean is subtracted off the end.
 */
function fillNoiseBuffer(buffer, tone, random) {
    const weights = noiseWeights(tone);

    let last = 0;
    let brownState = 0;
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
        const white = random() * 2 - 1;
        // Paul Kellet's economy pink filter.
        last = 0.99765 * last + white * 0.0990460;
        // Normalisation is applied at the output only. Dividing inside the
        // recursion would scale the accumulator's feedback term and send it
        // to Infinity within a few hundred samples.
        const pink = (last + white * 0.1848) / NOISE_PEAKS.pink;
        brownState = (brownState + 0.02 * white) / 1.02;
        const brown = brownState / NOISE_PEAKS.brown;
        const v = white * weights.white + pink * weights.pink + brown * weights.brown;
        buffer[i] = v;
        sum += v;
    }

    const offset = sum / buffer.length;
    for (let i = 0; i < buffer.length; i++) buffer[i] -= offset;
    return buffer;
}

/* ============================================================
   Sample and hold
   ============================================================ */

/**
 * Sample-and-hold with optional portamento.
 *
 * Glide matters more than it sounds: an instant S&H fed from an LFO is a
 * staircase, but a short glide makes it a random melody. Time is in seconds,
 * 0 meaning track the input exactly.
 */
class SampleHold {
    constructor() {
        this.glide = 0;
        this._value = 0;
        this._held = 0;
        this._at = null;
    }

    /**
     * The value the output should be carrying at time `t`.
     *
     * The very first capture has nothing to glide from, so it is held at its
     * target rather than starting from zero.
     */
    levelAt(t) {
        // Not yet sampled, or no glide: the target is the output.
        if (this._at === null || this.glide <= 0) return this._value;
        const elapsed = t - this._at;
        if (elapsed >= this.glide) return this._value;
        return this._held + (this._value - this._held) * Math.max(0, elapsed / this.glide);
    }

    /** Capture `sample` as the new target and start gliding toward it. */
    sample(sample, t) {
        this._held = this.levelAt(t);
        this._value = sample;
        this._at = t;
    }

    /** The target the glide is heading for. */
    get value() { return this._value; }

    /** False until the first sample has been captured. */
    get started() { return this._at !== null; }
}

/* ============================================================
   Waveshaper
   ============================================================ */

/**
 * Transfer curve for the drive stage.
 *
 * `sym` picks the odd harmonics (valve-ish, asymmetric) or the even ones
 * (clarinet-ish, symmetric). An even-symmetric curve must pass through the
 * origin or a direct-current offset appears at the output, which is why this
 * is written as a sum of odd powers: it is zero at zero for free.
 */
function waveshaperCurve(drive, sym, size) {
    const amount = drive * 100;
    const curve = new Float32Array(size);
    for (let i = 0; i < size; i++) {
        const x = (i / (size - 1)) * 2 - 1;
        // Normalised so the top of the drive range stays in range instead of
        // tearing the bus apart.
        const k = (sym === 0 ? 1 : 2) * amount;
        curve[i] = sym === 0
            ? Math.tanh(k * x) / Math.tanh(k || 1)
            : ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
}

/* ============================================================
   Sequencer
   ============================================================ */

/**
 * Lookahead step scheduler.
 *
 * The old sequencer woke on setInterval(50ms) and advanced a step when
 * `now - lastTime >= beatTime`, so every step landed up to 50ms late and
 * jittered audibly. This queues events on the audio clock instead: the
 * timer only decides *when to look ahead*, while each step is committed
 * at an exact sample-accurate time.
 */
class SequencerRuntime {
    constructor(moduleId) {
        this.moduleId = moduleId;
        this.running = false;
        this.step = 0;
        this.nextStepTime = null;
        this.pending = [];
    }

    start(ctxTime) {
        if (this.running) return;
        this.running = true;
        this.step = 0;
        this.pending = [];
        this.nextStepTime = ctxTime + SEQUENCER_PREROLL;
    }

    stop() {
        this.running = false;
        this.nextStepTime = null;
        this.pending = [];
    }

    /** Jump back to step 1 at the next opportunity. */
    reset(ctxTime) {
        this.step = 0;
        this.pending = [];
        if (this.running) this.nextStepTime = ctxTime + SEQUENCER_PREROLL;
    }

    /**
     * Queue every step that falls inside the lookahead window.
     * Returns events for the caller to schedule; returns [] when stopped.
     */
    tick(ctxTime, controls, steps) {
        if (!this.running) return [];
        if (this.nextStepTime === null) this.nextStepTime = ctxTime + SEQUENCER_PREROLL;

        const tempoKnob = controls.tempo !== undefined ? controls.tempo : 0.5;
        const gateKnob = controls.gateLen !== undefined ? controls.gateLen : 0.5;
        // Octave control shifts the whole sequence in whole octaves.
        const octave = controls.octave !== undefined ? Math.round(controls.octave * 2) : 0;

        const events = [];
        let guard = 0;
        while (this.nextStepTime < ctxTime + SCHEDULE_AHEAD && guard++ < 64) {
            const index = this.step;
            const stepSeconds = 60 / tempoBpm(tempoKnob);
            const step = steps[index] || { gate: 0, cv: 0.5 };

            events.push({
                step: index,
                time: this.nextStepTime,
                cv: quantiseVolts(step.cv) + octave,
                gate: step.gate ? 1 : 0,
                dur: gateLength(stepSeconds, gateKnob),
            });

            this.pending.push({ step: index, time: this.nextStepTime });
            this.nextStepTime += stepSeconds;
            this.step = (this.step + 1) % SEQUENCER_STEPS;
        }

        this.pending = this.pending.filter((p) => p.time > ctxTime - 1);
        return events;
    }

    /** The step that should be lit right now, or null if none is sounding. */
    visualStep(ctxTime) {
        let current = null;
        for (const p of this.pending) {
            if (p.time <= ctxTime) current = p.step;
            else break;
        }
        return current;
    }
}