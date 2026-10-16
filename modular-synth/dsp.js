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