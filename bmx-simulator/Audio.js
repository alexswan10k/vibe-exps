class Sfx {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.tickAcc = 0;
    }

    init() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return;
        }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.7;
        this.master.connect(this.ctx.destination);

        const len = this.ctx.sampleRate * 1.5;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

        const windSrc = this.ctx.createBufferSource();
        windSrc.buffer = this.noiseBuf;
        windSrc.loop = true;
        this.windFilter = this.ctx.createBiquadFilter();
        this.windFilter.type = 'bandpass';
        this.windFilter.frequency.value = 480;
        this.windFilter.Q.value = 0.8;
        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0;
        windSrc.connect(this.windFilter).connect(this.windGain).connect(this.master);
        windSrc.start();
    }

    setMuted(m) {
        this.muted = m;
        if (this.master) this.master.gain.value = m ? 0 : 0.7;
    }

    toggleMute() {
        this.setMuted(!this.muted);
        return this.muted;
    }

    update(dt, speedNorm, active) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const target = active ? Math.pow(MathUtils.clamp(speedNorm, 0, 1), 1.4) * 0.22 : 0;
        this.windGain.gain.setTargetAtTime(target, now, 0.08);

        if (active && speedNorm > 0.06) {
            this.tickAcc += dt * (14 + speedNorm * 46);
            while (this.tickAcc >= 1) {
                this.tickAcc -= 1;
                this.playTick(speedNorm);
            }
        } else {
            this.tickAcc = 0;
        }
    }

    playTone(freq, dur, type = 'sine', gain = 0.15, freqEnd = null, delay = 0) {
        if (!this.ctx) return;
        const t0 = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
        g.gain.setValueAtTime(gain, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        osc.connect(g).connect(this.master);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
    }

    playNoise(dur, filterFreq, gain = 0.3, type = 'lowpass', delay = 0) {
        if (!this.ctx) return;
        const t0 = this.ctx.currentTime + delay;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const f = this.ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = filterFreq;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(gain, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        src.connect(f).connect(g).connect(this.master);
        src.start(t0);
        src.stop(t0 + dur + 0.02);
    }

    playTick(speedNorm) {
        this.playTone(1500 + speedNorm * 900 + Math.random() * 300, 0.025, 'square', 0.035);
    }

    crash() {
        this.playNoise(0.3, 320, 0.5);
        this.playTone(130, 0.28, 'sine', 0.35, 45);
    }

    land() {
        this.playNoise(0.12, 420, 0.22);
        this.playTone(90, 0.12, 'sine', 0.2, 55);
    }

    hop() {
        this.playTone(240, 0.1, 'triangle', 0.12, 480);
    }

    whoosh() {
        this.playNoise(0.32, 900, 0.16, 'bandpass');
    }

    trick() {
        this.playTone(320, 0.16, 'sawtooth', 0.1, 950);
        this.playTone(640, 0.14, 'square', 0.06, 1280, 0.05);
    }

    countdown(n) {
        if (n > 0) this.playTone(440, 0.12, 'sine', 0.25);
        else {
            this.playTone(880, 0.4, 'sine', 0.3);
            this.playTone(1760, 0.3, 'sine', 0.1, null, 0.02);
        }
    }

    finish() {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((f, i) => this.playTone(f, 0.22, 'triangle', 0.2, null, i * 0.11));
        this.playNoise(0.5, 4000, 0.06, 'highpass', 0.44);
    }

    lap() {
        this.playTone(660, 0.09, 'sine', 0.15);
        this.playTone(990, 0.12, 'sine', 0.15, null, 0.08);
    }
}
