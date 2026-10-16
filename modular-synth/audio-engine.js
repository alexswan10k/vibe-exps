"use strict";
/* ============================================================
   Modular Synth — Web Audio graph.

   Every module type declares its ports as an explicit inputs/outputs
   map, and the UI's jack list is generated from the same table.
   Previously the two sides were hand-maintained and drifted: the patch
   code looked up output ports with `port.split('-')[2]`, but callers had
   already stripped the "-out-" segment, so every CV/Gate cable resolved to
   null and was silently dropped. There is now exactly one source of truth.
   ============================================================ */

/** Hold an AudioParam at its current value and drop its future automation. */
function cancelAndHold(param, time) {
    if (param.cancelAndHoldAtTime) {
        param.cancelAndHoldAtTime(time);
        return;
    }
    param.cancelScheduledValues(time);
    param.setValueAtTime(param.value, time);
}

/** Ramp an AudioParam, click-free. */
function smoothTo(param, value, time, ramp) {
    cancelAndHold(param, time);
    param.linearRampToValueAtTime(value, time + ramp);
}

/** Read one sample from an AnalyserNode as a -1..1 signal. */
function readSample(analyser, buffer) {
    analyser.getByteTimeDomainData(buffer);
    return (buffer[buffer.length >> 1] - 128) / 128;
}

/**
 * CV/Gate source. CV is expressed in volts, where 1V is one octave;
 * destinations scale it to whatever they need (see VOICES.oscillator).
 */
function makeCvGate(ctx, owned, init) {
    const cv = ctx.createConstantSource();
    const gate = ctx.createConstantSource();
    cv.offset.value = 0;
    gate.offset.value = 0;
    owned.push(cv, gate);
    const voice = {
        inputs: {},
        outputs: { cv, gate },
        setCV(v, time) { smoothTo(cv.offset, v, time, 0.005); },
        setGate(g, time) { smoothTo(gate.offset, g, time, 0.004); },
        // Teardown path. A stopped ConstantSourceNode keeps emitting whatever
        // value it was stopped at and ignores later automation, so this has to
        // snap to zero rather than ramp, or a module deleted mid-note would
        // leave every connected envelope stuck at sustain.
        release() {
            const now = ctx.currentTime;
            cancelAndHold(cv.offset, now);
            cv.offset.setValueAtTime(0, now);
            cancelAndHold(gate.offset, now);
            gate.offset.setValueAtTime(0, now);
        },
    };
    return init ? init(voice, { cv, gate }) : voice;
}

/** In-place gate follower over an AnalyserNode. */
function makeGateInput(ctx, owned, onChange) {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 32;
    owned.push(analyser);
    const buffer = new Uint8Array(analyser.fftSize);
    const follower = new GateFollower();
    return {
        input: analyser,
        follower,
        poll(now) {
            if (follower.update(readSample(analyser, buffer))) onChange(follower.value, now);
        },
    };
}

/* ---------- module voices ---------- */

const WAVE_TYPES = ["sine", "square", "sawtooth", "triangle"];

const VOICES = {
    oscillator(ctx, owned) {
        const osc = ctx.createOscillator();
        const level = ctx.createGain();
        const fm = ctx.createGain();
        // V/Oct lands on detune, which is exponential: 1 volt -> 1200 cents -> 1 octave.
        const voct = ctx.createGain();
        fm.gain.value = 500;
        voct.gain.value = 1200;
        osc.connect(level);
        fm.connect(osc.frequency);
        voct.connect(osc.detune);
        osc.start();
        owned.push(osc, level, fm, voct);
        return {
            inputs: { voct, fm },
            outputs: { out: level },
            setControl(id, v) {
                const now = ctx.currentTime;
                if (id === "freq") osc.frequency.setTargetAtTime(CURVES.hz(v), now, 0.02);
                else if (id === "wave") osc.type = WAVE_TYPES[Math.min(3, Math.max(0, Math.round(v)))];
                else if (id === "level") level.gain.setTargetAtTime(v, now, 0.02);
            },
        };
    },

    lfo(ctx, owned) {
        const osc = ctx.createOscillator();
        const amp = ctx.createGain();
        osc.connect(amp);
        osc.start();
        owned.push(osc, amp);
        return {
            inputs: {},
            outputs: { out: amp },
            setControl(id, v) {
                const now = ctx.currentTime;
                // amt is in volts, so it is a musical sweep when patched to V/Oct.
                if (id === "freq") osc.frequency.setTargetAtTime(CURVES.lfoRate(v), now, 0.02);
                else if (id === "amt") amp.gain.setTargetAtTime(v, now, 0.02);
            },
        };
    },

    vcf(ctx, owned) {
        const filter = ctx.createBiquadFilter();
        const mod = ctx.createGain();
        filter.type = "lowpass";
        mod.gain.value = 1000; // 1 volt of CV = 1kHz of cutoff
        mod.connect(filter.frequency);
        owned.push(filter, mod);
        return {
            inputs: { in: filter, mod },
            outputs: { out: filter },
            setControl(id, v) {
                const now = ctx.currentTime;
                if (id === "cutoff") filter.frequency.setTargetAtTime(CURVES.cutoff(v), now, 0.02);
                else if (id === "res") filter.Q.setTargetAtTime(v * 20, now, 0.02);
            },
        };
    },

    vca(ctx, owned) {
        const vca = ctx.createGain();
        const cv = ctx.createGain();
        vca.gain.value = 0;
        cv.connect(vca.gain); // sums with the offset control
        owned.push(vca, cv);
        return {
            inputs: { in: vca, cv },
            outputs: { out: vca },
            setControl(id, v) {
                if (id === "offset") vca.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
            },
        };
    },

    envelope(ctx, owned) {
        const out = ctx.createConstantSource();
        out.offset.value = 0;
        out.start();
        owned.push(out);

        const adsr = new Adsr();
        const gateIn = makeGateInput(ctx, owned, (value, now) => {
            if (value) adsr.gateOn(now);
            else adsr.gateOff(now);
            adsr.applyTo(out.offset, now);
        });

        return {
            inputs: { gate: gateIn.input },
            outputs: { out },
            adsr,
            poll: (now) => gateIn.poll(now),
            setControl(id, v) {
                adsr[id] = v;
                // Re-lay the current stage so live tweaks take effect immediately.
                if (gateIn.follower.open || adsr.stage !== "idle") adsr.applyTo(out.offset, ctx.currentTime);
            },
            level() { return adsr.levelAt(ctx.currentTime); },
        };
    },

    delay(ctx, owned) {
        const input = ctx.createGain();
        const delay = ctx.createDelay(2);
        const fb = ctx.createGain();
        const wet = ctx.createGain();
        const dry = ctx.createGain();
        const out = ctx.createGain();
        input.connect(dry); dry.connect(out);
        input.connect(delay);
        delay.connect(wet); wet.connect(out);
        delay.connect(fb); fb.connect(delay);
        owned.push(input, delay, fb, wet, dry, out);
        return {
            inputs: { in: input },
            outputs: { out },
            setControl(id, v) {
                const now = ctx.currentTime;
                if (id === "time") delay.delayTime.setTargetAtTime(CURVES.delayTime(v), now, 0.05);
                else if (id === "fb") fb.gain.setTargetAtTime(CURVES.feedback(v), now, 0.02);
                else if (id === "mix") {
                    wet.gain.setTargetAtTime(v, now, 0.02);
                    dry.gain.setTargetAtTime(1 - v * 0.7, now, 0.02);
                }
            },
        };
    },

    mixer(ctx, owned) {
        const master = ctx.createGain();
        const ch = [ctx.createGain(), ctx.createGain(), ctx.createGain()];
        for (const g of ch) { g.connect(master); owned.push(g); }
        owned.push(master);
        return {
            inputs: { in1: ch[0], in2: ch[1], in3: ch[2] },
            outputs: { out: master },
            setControl(id, v) {
                const now = ctx.currentTime;
                if (id === "master") master.gain.setTargetAtTime(v, now, 0.02);
                else if (id.startsWith("lvl")) ch[Number(id.slice(3)) - 1].gain.setTargetAtTime(v, now, 0.02);
            },
        };
    },

    output(ctx, owned) {
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        owned.push(gain);
        return {
            inputs: { in: gain },
            outputs: {},
            setControl(id, v) {
                if (id === "vol") gain.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
            },
        };
    },

    oscilloscope(ctx, owned) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0;
        owned.push(analyser);
        let buffer = new Uint8Array(analyser.fftSize);
        return {
            inputs: { in: analyser },
            outputs: {},
            setControl(id, v) {
                if (id !== "zoom") return;
                // 256..2048 samples, so the visible window runs ~5ms..43ms.
                const fftSize = Math.round(256 * Math.pow(8, v));
                const clamped = Math.min(2048, Math.max(256, fftSize));
                if (clamped === analyser.fftSize) return;
                analyser.fftSize = clamped;
                buffer = new Uint8Array(clamped);
            },
            analyser,
            buffer: () => buffer,
        };
    },

    keyboard(ctx, owned) {
        const voice = makeCvGate(ctx, owned);
        voice.noteOn = (note) => {
            voice.setCV(noteToVolts(note), ctx.currentTime);
            voice.setGate(1, ctx.currentTime);
        };
        voice.noteOff = () => voice.setGate(0, ctx.currentTime);
        return voice;
    },

    midi_in(ctx, owned) {
        const voice = makeCvGate(ctx, owned);
        voice.noteOn = (note) => {
            voice.setCV(noteToVolts(note), ctx.currentTime);
            voice.setGate(1, ctx.currentTime);
        };
        voice.noteOff = () => voice.setGate(0, ctx.currentTime);
        return voice;
    },

    sequencer(ctx, owned) {
        const voice = makeCvGate(ctx, owned);
        const runtime = new SequencerRuntime();
        const resetIn = makeGateInput(ctx, owned, (value, now) => {
            if (value) runtime.reset(now);
        });
        let steps = defaultSteps();

        voice.inputs = { reset: resetIn.input };
        voice.runtime = runtime;
        voice.setSteps = (next) => { steps = next; };
        voice.getSteps = () => steps;
        voice.setControl = (id, v) => {
            if (id === "run") {
                if (v) runtime.start(ctx.currentTime);
                else runtime.stop();
            }
        };
        voice.scheduleStep = (ev) => {
            const { cv, gate } = voice.outputs;
            smoothTo(cv.offset, ev.cv, ev.time, 0.004);
            smoothTo(gate.offset, ev.gate, ev.time, 0.004);
            if (ev.gate) smoothTo(gate.offset, 0, ev.time + ev.dur, 0.004);
        };
        voice.poll = (now) => resetIn.poll(now);
        voice.visualStep = () => runtime.visualStep(ctx.currentTime);
        return voice;
    },
};

/* ============================================================
   Engine
   ============================================================ */

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.voices = new Map();
        this.connections = new Map();
        this.stepsById = new Map();
        this.frameCallbacks = new Set();
        this._frame = null;
    }

    get ready() { return !!this.ctx; }

    async start() {
        if (this.ctx) {
            if (this.ctx.state === "suspended") await this.ctx.resume();
            return;
        }
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) throw new Error("This browser has no Web Audio support.");
        this.ctx = new Ctor({ latencyHint: "interactive" });
        if (this.ctx.state === "suspended") await this.ctx.resume();
        this._startFrames();
    }

    /* ---------- lifecycle ---------- */

    addModule(module) {
        if (!this.ctx || this.voices.has(module.id)) return;
        const factory = VOICES[module.type];
        if (!factory) return;
        const owned = [];
        const voice = factory(this.ctx, owned);
        voice.owned = owned;
        voice.moduleId = module.id;
        voice.type = module.type;
        this.voices.set(module.id, voice);
        this.applyControls(module);
        if (module.type === "sequencer") {
            voice.setSteps(this.stepsById.get(module.id) || defaultSteps());
        }
    }

    /**
     * Tear a module down completely.
     * This used to be dead code: Clear and Load only dropped UI state, so
     * oscillators kept running and every repatch left another connection
     * hanging off mixer and delay inputs.
     */
    removeModule(id) {
        const voice = this.voices.get(id);
        if (!voice) return;
        for (const cableId of Array.from(this.connections.keys())) {
            const conn = this.connections.get(cableId);
            if (conn.fromModuleId === id || conn.toModuleId === id) this.disconnectCable(cableId);
        }
        if (voice.runtime) voice.runtime.stop();
        if (voice.release) voice.release();
        for (const node of voice.owned || []) {
            try { if (typeof node.stop === "function") node.stop(); } catch (e) { /* already stopped */ }
            try { if (typeof node.disconnect === "function") node.disconnect(); } catch (e) { /* not connected */ }
        }
        this.voices.delete(id);
    }

    disposeAll() {
        for (const id of Array.from(this.voices.keys())) this.removeModule(id);
    }

    stop() {
        if (this._frame) cancelAnimationFrame(this._frame);
        this._frame = null;
        this.frameCallbacks.clear();
        this.disposeAll();
        if (this.ctx) this.ctx.close();
        this.ctx = null;
    }

    /* ---------- parameters ---------- */

    applyControls(module) {
        const voice = this.voices.get(module.id);
        if (!voice) return;
        // The scheduler reads tempo/gateLen/octave straight off the voice,
        // so the snapshot has to be kept current.
        voice.controls = { ...module.controls };
        if (!voice.setControl) return;
        for (const spec of MODULE_DEFS[module.type].controls) {
            voice.setControl(spec.id, module.controls[spec.id]);
        }
    }

    setSteps(moduleId, steps) {
        this.stepsById.set(moduleId, steps);
        const voice = this.voices.get(moduleId);
        if (voice && voice.setSteps) voice.setSteps(steps);
    }

    /* ---------- patching ---------- */

    /**
     * Reconcile the audio graph against the cable list.
     *
     * Only the difference is applied: removed cables get disconnected, new
     * cables get connected, and untouched cables are left alone. The old
     * code tore down and rebuilt every connection on each patch change,
     * which glitched and leaked.
     */
    syncTopology(cables) {
        if (!this.ctx) return;
        const wanted = new Set();

        for (const cable of cables) {
            wanted.add(cable.id);
            const existing = this.connections.get(cable.id);
            if (existing && existing.from === cable.from && existing.to === cable.to) continue;
            if (existing) this.disconnectCable(cable.id);
            this.connectCable(cable);
        }

        for (const cableId of Array.from(this.connections.keys())) {
            if (!wanted.has(cableId)) this.disconnectCable(cableId);
        }
    }

    connectCable(cable) {
        const from = parseJackId(cable.from);
        const to = parseJackId(cable.to);
        if (!from || !to) return;
        const srcVoice = this.voices.get(from.moduleId);
        const dstVoice = this.voices.get(to.moduleId);
        if (!srcVoice || !dstVoice) return;

        const src = srcVoice.outputs[from.portId];
        const dst = dstVoice.inputs[to.portId];
        if (!src || !dst) {
            console.warn("[synth] no such port:", cable.from, "->", cable.to);
            return;
        }
        try {
            src.connect(dst);
        } catch (err) {
            console.warn("[synth] could not connect", cable.from, "->", cable.to, err);
            return;
        }
        this.connections.set(cable.id, {
            from: cable.from,
            to: cable.to,
            fromModuleId: from.moduleId,
            toModuleId: to.moduleId,
            src,
            dst,
        });
    }

    disconnectCable(cableId) {
        const conn = this.connections.get(cableId);
        if (!conn) return;
        try { conn.src.disconnect(conn.dst); } catch (e) { /* was never connected */ }
        this.connections.delete(cableId);
    }

    /* ---------- per-frame work ---------- */

    _startFrames() {
        const loop = () => {
            const now = this.ctx.currentTime;
            // Nothing in here may throw: this loop owns the sequencer clock,
            // and a single failure would stop every sequence for good.
            try {
                for (const voice of this.voices.values()) {
                    if (voice.runtime && voice.runtime.running) {
                        const events = voice.runtime.tick(now, voice.controls || {}, voice.getSteps());
                        for (const ev of events) voice.scheduleStep(ev);
                    }
                    if (voice.poll) voice.poll(now);
                }
            } catch (err) {
                console.error("[synth] scheduler frame failed", err);
            }
            for (const cb of this.frameCallbacks) {
                try {
                    cb(now, this);
                } catch (err) {
                    console.error("[synth] frame callback failed", err);
                }
            }
            this._frame = requestAnimationFrame(loop);
        };
        this._frame = requestAnimationFrame(loop);
    }

    onFrame(cb) {
        this.frameCallbacks.add(cb);
        return () => this.frameCallbacks.delete(cb);
    }

    /* ---------- metering ---------- */

    /**
     * Metering tap for an output port.
     *
     * The analyser hangs off the output as a side branch rather than sitting
     * in series, so it never touches the signal path, and several cables from
     * the same jack share one tap. Taps are made lazily, so an unpatched rack
     * costs nothing.
     */
    _tap(voice, portId) {
        if (!voice.taps) voice.taps = new Map();
        let tap = voice.taps.get(portId);
        if (!tap) {
            const analyser = this.ctx.createAnalyser();
            analyser.fftSize = 32;
            analyser.smoothingTimeConstant = 0;
            // Float rather than byte data, so a CV of 0.4 V survives intact.
            const buffer = new Float32Array(analyser.fftSize);
            voice.owned.push(analyser);
            voice.outputs[portId].connect(analyser);
            tap = { analyser, buffer };
            voice.taps.set(portId, tap);
        }
        return tap;
    }

    /** Live signal on the output feeding `jackId`, or null if it cannot be read. */
    measureOutput(jackId) {
        const parsed = parseJackId(jackId);
        if (!parsed || parsed.dir !== "out") return null;
        const voice = this.voices.get(parsed.moduleId);
        if (!voice || !voice.outputs || !voice.outputs[parsed.portId]) return null;

        const tap = this._tap(voice, parsed.portId);
        tap.analyser.getFloatTimeDomainData(tap.buffer);

        const buffer = tap.buffer;
        let sumSquares = 0;
        let peak = 0;
        for (let i = 0; i < buffer.length; i++) {
            const v = buffer[i];
            sumSquares += v * v;
            const magnitude = v < 0 ? -v : v;
            if (magnitude > peak) peak = magnitude;
        }

        return {
            cv: isControlSource(voice.type, parsed.portId),
            signed: buffer[buffer.length >> 1],
            rms: Math.sqrt(sumSquares / buffer.length),
            peak,
        };
    }

    getVoice(id) {
        return this.voices.get(id);
    }
}