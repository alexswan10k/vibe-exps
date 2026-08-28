// Procedural Web Audio Engine & Radio Synthesizer
class AudioSystem {
    constructor() {
        this.ctx = null;
        this.initialized = false;
        this.muted = false;
        this.radioEnabled = true;
        this.currentStation = 0; // 0: Neon Nights, 1: Cyber Horizon, 2: Midnight Cruise, 3: Off

        // Sound nodes
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;

        // Engine synth
        this.engineOsc1 = null;
        this.engineOsc2 = null;
        this.engineSub = null;
        this.engineFilter = null;
        this.engineGain = null;

        // Tire screech synth
        this.screechSource = null;
        this.screechFilter = null;
        this.screechGain = null;

        // Nitro synth
        this.nitroSource = null;
        this.nitroFilter = null;
        this.nitroGain = null;

        // Noise buffer for reuse
        this.noiseBuffer = null;

        // Radio sequencer state
        this.radioTimer = null;
        this.step = 0;
        this.tempo = 120; // BPM
        this.stationNames = ['Neon Nights', 'Cyber Horizon', 'Midnight Cruise', 'Radio Off'];
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
            if (this.ctx.state === 'suspended') {
                const resumeAudio = () => {
                    if (this.ctx && this.ctx.state === 'suspended') {
                        this.ctx.resume();
                    }
                    window.removeEventListener('click', resumeAudio);
                    window.removeEventListener('keydown', resumeAudio);
                    window.removeEventListener('touchstart', resumeAudio);
                };
                window.addEventListener('click', resumeAudio, { once: true });
                window.addEventListener('keydown', resumeAudio, { once: true });
                window.addEventListener('touchstart', resumeAudio, { once: true });
            }

            // Master gains
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);

            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
            this.sfxGain.connect(this.masterGain);

            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
            this.musicGain.connect(this.masterGain);

            this.createNoiseBuffer();
            this.setupEngineSynth();
            this.setupScreechSynth();
            this.setupNitroSynth();
            this.startRadio();

            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio initialization failed:', e);
        }
    }

    createNoiseBuffer() {
        const bufferSize = this.ctx.sampleRate * 2;
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
    }

    setupEngineSynth() {
        // Engine oscillators
        this.engineOsc1 = this.ctx.createOscillator();
        this.engineOsc1.type = 'sawtooth';
        this.engineOsc1.frequency.setValueAtTime(60, this.ctx.currentTime);

        this.engineOsc2 = this.ctx.createOscillator();
        this.engineOsc2.type = 'triangle';
        this.engineOsc2.frequency.setValueAtTime(120, this.ctx.currentTime);

        this.engineSub = this.ctx.createOscillator();
        this.engineSub.type = 'sine';
        this.engineSub.frequency.setValueAtTime(30, this.ctx.currentTime);

        // Lowpass filter for throatiness
        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.setValueAtTime(300, this.ctx.currentTime);
        this.engineFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

        this.engineOsc1.connect(this.engineFilter);
        this.engineOsc2.connect(this.engineFilter);
        this.engineSub.connect(this.engineFilter);

        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.sfxGain);

        this.engineOsc1.start();
        this.engineOsc2.start();
        this.engineSub.start();
    }

    setupScreechSynth() {
        if (!this.noiseBuffer) return;
        this.screechSource = this.ctx.createBufferSource();
        this.screechSource.buffer = this.noiseBuffer;
        this.screechSource.loop = true;

        this.screechFilter = this.ctx.createBiquadFilter();
        this.screechFilter.type = 'bandpass';
        this.screechFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
        this.screechFilter.Q.setValueAtTime(6.0, this.ctx.currentTime);

        this.screechGain = this.ctx.createGain();
        this.screechGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

        this.screechSource.connect(this.screechFilter);
        this.screechFilter.connect(this.screechGain);
        this.screechGain.connect(this.sfxGain);

        this.screechSource.start();
    }

    setupNitroSynth() {
        if (!this.noiseBuffer) return;
        this.nitroSource = this.ctx.createBufferSource();
        this.nitroSource.buffer = this.noiseBuffer;
        this.nitroSource.loop = true;

        this.nitroFilter = this.ctx.createBiquadFilter();
        this.nitroFilter.type = 'lowpass';
        this.nitroFilter.frequency.setValueAtTime(800, this.ctx.currentTime);
        this.nitroFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

        this.nitroGain = this.ctx.createGain();
        this.nitroGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

        this.nitroSource.connect(this.nitroFilter);
        this.nitroFilter.connect(this.nitroGain);
        this.nitroGain.connect(this.sfxGain);

        this.nitroSource.start();
    }

    updateEngine(rpm, isThrottle, isShifting, carType = 0) {
        if (!this.initialized || !this.ctx || this.ctx.state !== 'running') return;

        const now = this.ctx.currentTime;
        const normalizedRPM = Math.max(0, Math.min(1, (rpm - 800) / (7500 - 800)));

        // Base frequency range depending on car type
        let baseFreq = 50 + normalizedRPM * 280;
        let subFreq = baseFreq * 0.5;
        let osc2Ratio = 1.5;

        if (carType === 1) { // Muscle Car (deep rumble)
            baseFreq = 40 + normalizedRPM * 220;
            subFreq = baseFreq * 0.5;
            osc2Ratio = 2.0;
        } else if (carType === 2) { // Hypercar (high pitch screamer)
            baseFreq = 70 + normalizedRPM * 420;
            subFreq = baseFreq * 0.25;
            osc2Ratio = 1.33;
        } else if (carType === 3) { // Offroad 4x4 (heavy chug)
            baseFreq = 45 + normalizedRPM * 180;
            subFreq = baseFreq * 0.5;
            osc2Ratio = 1.0;
        }

        this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.04);
        this.engineOsc2.frequency.setTargetAtTime(baseFreq * osc2Ratio, now, 0.04);
        this.engineSub.frequency.setTargetAtTime(subFreq, now, 0.04);

        // Filter opens with RPM and throttle
        const filterCutoff = 250 + normalizedRPM * 2200 + (isThrottle ? 600 : 0);
        this.engineFilter.frequency.setTargetAtTime(filterCutoff, now, 0.05);

        // Volume
        let vol = 0.04 + normalizedRPM * 0.12;
        if (isThrottle) vol += 0.05;
        if (isShifting) vol *= 0.25;

        this.engineGain.gain.setTargetAtTime(vol, now, 0.04);
    }

    updateScreech(slipAmount) {
        if (!this.initialized || !this.screechGain) return;
        const now = this.ctx.currentTime;
        const clampedSlip = Math.min(1.0, Math.max(0, slipAmount));
        const targetVol = clampedSlip > 0.1 ? clampedSlip * 0.25 : 0;
        const targetFreq = 1200 + clampedSlip * 800;

        this.screechGain.gain.setTargetAtTime(targetVol, now, 0.06);
        this.screechFilter.frequency.setTargetAtTime(targetFreq, now, 0.06);
    }

    updateNitro(active) {
        if (!this.initialized || !this.nitroGain) return;
        const now = this.ctx.currentTime;
        const targetVol = active ? 0.22 : 0.0;
        this.nitroGain.gain.setTargetAtTime(targetVol, now, 0.08);
        if (active) {
            this.nitroFilter.frequency.setTargetAtTime(1400, now, 0.1);
        }
    }

    playBackfire() {
        if (!this.initialized || !this.ctx) return;
        const now = this.ctx.currentTime;

        // Rapid noise burst
        const source = this.ctx.createBufferSource();
        source.buffer = this.noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800 + Math.random() * 600, now);
        filter.Q.setValueAtTime(2.0, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        source.start(now);
        source.stop(now + 0.09);
    }

    playBlowOff() {
        if (!this.initialized || !this.ctx) return;
        const now = this.ctx.currentTime;

        for (let i = 0; i < 3; i++) {
            const time = now + i * 0.05;
            const source = this.ctx.createBufferSource();
            source.buffer = this.noiseBuffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(2800 - i * 400, time);
            filter.Q.setValueAtTime(8.0, time);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.18 / (i + 1), time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

            source.connect(filter);
            filter.connect(gain);
            gain.connect(this.sfxGain);

            source.start(time);
            source.stop(time + 0.05);
        }
    }

    playCrash(intensity = 1.0) {
        if (!this.initialized || !this.ctx) return;
        const now = this.ctx.currentTime;
        const clampedIntensity = Math.min(2.0, Math.max(0.2, intensity));

        // Sub thud
        const thudOsc = this.ctx.createOscillator();
        thudOsc.type = 'sine';
        thudOsc.frequency.setValueAtTime(140, now);
        thudOsc.frequency.exponentialRampToValueAtTime(20, now + 0.3);

        const thudGain = this.ctx.createGain();
        thudGain.gain.setValueAtTime(0.5 * clampedIntensity, now);
        thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        thudOsc.connect(thudGain);
        thudGain.connect(this.sfxGain);
        thudOsc.start(now);
        thudOsc.stop(now + 0.36);

        // Metal crunch
        const crunchSource = this.ctx.createBufferSource();
        crunchSource.buffer = this.noiseBuffer;

        const crunchFilter = this.ctx.createBiquadFilter();
        crunchFilter.type = 'lowpass';
        crunchFilter.frequency.setValueAtTime(2000, now);
        crunchFilter.frequency.exponentialRampToValueAtTime(300, now + 0.25);

        const crunchGain = this.ctx.createGain();
        crunchGain.gain.setValueAtTime(0.4 * clampedIntensity, now);
        crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        crunchSource.connect(crunchFilter);
        crunchFilter.connect(crunchGain);
        crunchGain.connect(this.sfxGain);
        crunchSource.start(now);
        crunchSource.stop(now + 0.31);
    }

    playHorn() {
        if (!this.initialized || !this.ctx) return;
        const now = this.ctx.currentTime;

        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc1.frequency.setValueAtTime(440, now); // A4
        osc2.frequency.setValueAtTime(554.37, now); // C#5

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.setValueAtTime(0.25, now + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.36);
        osc2.stop(now + 0.36);
    }

    playStuntChime() {
        if (!this.initialized || !this.ctx) return;
        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

        notes.forEach((freq, i) => {
            const time = now + i * 0.08;
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, time);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.2, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(time);
            osc.stop(time + 0.35);
        });
    }

    playCheckpoint() {
        if (!this.initialized || !this.ctx) return;
        const now = this.ctx.currentTime;
        const notes = [440, 554, 659, 880];

        notes.forEach((freq, i) => {
            const time = now + i * 0.05;
            const osc = this.ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, time);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.25, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(time);
            osc.stop(time + 0.3);
        });
    }

    // --- Procedural Synthwave Radio ---
    startRadio() {
        if (this.radioTimer) clearInterval(this.radioTimer);
        this.step = 0;

        const intervalMs = (60 / (this.tempo * 4)) * 1000; // 16th note interval
        this.radioTimer = setInterval(() => this.tickRadio(), intervalMs);
    }

    cycleStation() {
        this.currentStation = (this.currentStation + 1) % 4;
        if (this.currentStation === 0) this.tempo = 120;
        if (this.currentStation === 1) this.tempo = 128;
        if (this.currentStation === 2) this.tempo = 105;

        this.startRadio();
        return this.stationNames[this.currentStation];
    }

    getStationName() {
        return this.stationNames[this.currentStation];
    }

    tickRadio() {
        if (!this.initialized || !this.ctx || this.currentStation === 3 || this.muted) return;
        const now = this.ctx.currentTime;
        const s = this.step % 32;

        // Tracks definition
        if (this.currentStation === 0) {
            // Track 1: Neon Nights (Key: D minor)
            const bassNotes = [146.83, 146.83, 146.83, 146.83, 116.54, 116.54, 130.81, 130.81]; // D3, D3, D3, D3, Bb2, Bb2, C3, C3
            const leadNotes = [587.33, 659.25, 698.46, 880.00, 783.99, 698.46, 659.25, 587.33];

            // Bass on 8th notes
            if (s % 2 === 0) {
                const noteIndex = Math.floor(s / 4) % bassNotes.length;
                this.playSynthNote(bassNotes[noteIndex], 0.12, 'sawtooth', 0.15, now, 500);
            }

            // Lead arpeggios
            if (s % 4 === 0 || s % 6 === 0) {
                const note = leadNotes[(s + 2) % leadNotes.length];
                this.playSynthNote(note, 0.2, 'square', 0.08, now, 1800);
            }

            // Drums (Kick on 1 & 3, Snare on 2 & 4, Hi-hat on 16ths)
            if (s % 8 === 0) this.playKick(now);
            if (s % 8 === 4) this.playSnare(now);
            if (s % 2 === 1) this.playHiHat(now, 0.04);
        } else if (this.currentStation === 1) {
            // Track 2: Cyber Horizon (Key: A minor - faster)
            const bassNotes = [110.0, 110.0, 130.81, 130.81, 98.0, 98.0, 87.31, 87.31]; // A2, C3, G2, F2
            const leadNotes = [440.0, 523.25, 659.25, 783.99, 880.0, 659.25, 587.33, 523.25];

            if (s % 2 === 0) {
                const noteIndex = Math.floor(s / 4) % bassNotes.length;
                this.playSynthNote(bassNotes[noteIndex], 0.1, 'sawtooth', 0.18, now, 700);
            }

            if (s % 2 === 1 && (s % 8 > 2)) {
                const note = leadNotes[s % leadNotes.length];
                this.playSynthNote(note, 0.15, 'triangle', 0.1, now, 2200);
            }

            if (s % 4 === 0) this.playKick(now);
            if (s % 8 === 4) this.playSnare(now);
            this.playHiHat(now, 0.03);
        } else if (this.currentStation === 2) {
            // Track 3: Midnight Cruise (Chillwave - slow)
            const bassNotes = [130.81, 130.81, 146.83, 146.83, 110.0, 110.0, 98.0, 98.0];
            const chordNotes = [261.63, 329.63, 392.00, 523.25];

            if (s % 4 === 0) {
                const noteIndex = Math.floor(s / 8) % bassNotes.length;
                this.playSynthNote(bassNotes[noteIndex], 0.3, 'sine', 0.25, now, 350);
            }

            if (s % 8 === 0) {
                chordNotes.forEach((freq, idx) => {
                    this.playSynthNote(freq, 0.6, 'triangle', 0.04, now + idx * 0.02, 1200);
                });
            }

            if (s % 8 === 0) this.playKick(now);
            if (s % 8 === 4) this.playSnare(now);
            if (s % 4 === 2) this.playHiHat(now, 0.05);
        }

        this.step++;
    }

    playSynthNote(freq, duration, type, volume, time, cutoff) {
        const osc = this.ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(cutoff, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        osc.start(time);
        osc.stop(time + duration + 0.02);
    }

    playKick(time) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(30, time + 0.1);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(time);
        osc.stop(time + 0.13);
    }

    playSnare(time) {
        const source = this.ctx.createBufferSource();
        source.buffer = this.noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1500, time);
        filter.Q.setValueAtTime(1.5, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        source.start(time);
        source.stop(time + 0.16);
    }

    playHiHat(time, vol = 0.05) {
        const source = this.ctx.createBufferSource();
        source.buffer = this.noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(7000, time);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        source.start(time);
        source.stop(time + 0.05);
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime);
        }
        return this.muted;
    }
}
