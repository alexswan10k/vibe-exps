class AudioSystem {
    constructor() {
        this.ctx = null;
        
        // Loop nodes
        this.engineOsc = null;
        this.engineOsc2 = null;
        this.engineGain = null;
        this.engineFilter = null;
        
        this.driftNoise = null;
        this.driftGain = null;
        this.driftFilter = null;
        
        this.sirenOsc = null;
        this.sirenGain = null;
        this.sirenInterval = null;
        this.sirenActive = false;
        
        this.hornOsc1 = null;
        this.hornOsc2 = null;
        this.hornGain = null;
        this.hornActive = false;
        
        this.enabled = true;
    }

    init() {
        if (this.ctx) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
            this.setupEngineSound();
            this.setupDriftSound();
            console.log("Audio System Initialized successfully.");
        } catch (e) {
            console.error("Web Audio API not supported in this browser:", e);
        }
    }

    createNoiseNode(duration = 0.5) {
        if (!this.ctx) return null;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        return noise;
    }

    setupEngineSound() {
        if (!this.ctx) return;

        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc2 = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
        this.engineFilter = this.ctx.createBiquadFilter();

        this.engineOsc.type = 'sawtooth';
        this.engineOsc2.type = 'triangle';

        this.engineOsc.frequency.setValueAtTime(40, this.ctx.currentTime);
        this.engineOsc2.frequency.setValueAtTime(20, this.ctx.currentTime);

        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.setValueAtTime(150, this.ctx.currentTime);

        this.engineGain.gain.setValueAtTime(0.01, this.ctx.currentTime); // Start low

        this.engineOsc.connect(this.engineFilter);
        this.engineOsc2.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);

        this.engineOsc.start(0);
        this.engineOsc2.start(0);
    }

    setupDriftSound() {
        if (!this.ctx) return;

        // Generate white noise buffer
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        this.driftNoise = this.ctx.createBufferSource();
        this.driftNoise.buffer = buffer;
        this.driftNoise.loop = true;

        this.driftFilter = this.ctx.createBiquadFilter();
        this.driftFilter.type = 'bandpass';
        this.driftFilter.frequency.setValueAtTime(1500, this.ctx.currentTime);
        this.driftFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

        this.driftGain = this.ctx.createGain();
        this.driftGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

        this.driftNoise.connect(this.driftFilter);
        this.driftFilter.connect(this.driftGain);
        this.driftGain.connect(this.ctx.destination);

        this.driftNoise.start(0);
    }

    updateEngine(speedRatio, isAccelerating) {
        this.init();
        if (!this.ctx || !this.engineGain || !this.enabled) return;

        // Smoothly adjust pitch and filtering
        let pitch = 35 + Math.min(speedRatio, 1.0) * 110;
        if (isAccelerating) pitch += 15;

        this.engineOsc.frequency.setTargetAtTime(pitch, this.ctx.currentTime, 0.1);
        this.engineOsc2.frequency.setTargetAtTime(pitch * 0.5, this.ctx.currentTime, 0.1);

        let vol = 0.03 + Math.min(speedRatio, 1.0) * 0.12;
        if (isAccelerating) vol += 0.05;

        this.engineGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.1);
        this.engineFilter.frequency.setTargetAtTime(120 + vol * 1500, this.ctx.currentTime, 0.15);
    }

    updateDrift(intensity) {
        this.init();
        if (!this.ctx || !this.driftGain || !this.enabled) return;

        let targetGain = Math.min(intensity * 0.2, 0.15);
        this.driftGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }

    playPistol() {
        this.init();
        if (!this.ctx || !this.enabled) return;

        const osc = this.ctx.createOscillator();
        const noise = this.createNoiseNode(0.2);
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(450, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.06);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, this.ctx.currentTime);
        filter.Q.setValueAtTime(2, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

        osc.connect(gain);
        if (noise) {
            noise.connect(filter);
            filter.connect(gain);
            noise.start();
        }
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
    }

    playShotgun() {
        this.init();
        if (!this.ctx || !this.enabled) return;

        const osc = this.ctx.createOscillator();
        const noise = this.createNoiseNode(0.4);
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.15);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

        osc.connect(gain);
        if (noise) {
            noise.connect(filter);
            filter.connect(gain);
            noise.start();
        }
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }

    playMachineGun() {
        this.init();
        if (!this.ctx || !this.enabled) return;

        const osc = this.ctx.createOscillator();
        const noise = this.createNoiseNode(0.15);
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(380, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.04);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(900, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

        osc.connect(gain);
        if (noise) {
            noise.connect(filter);
            filter.connect(gain);
            noise.start();
        }
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    playRPG() {
        this.init();
        if (!this.ctx || !this.enabled) return;

        const osc = this.ctx.createOscillator();
        const noise = this.createNoiseNode(0.6);
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        // Rocket whoosh sound
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(60, this.ctx.currentTime + 0.4);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

        osc.connect(filter);
        if (noise) {
            noise.connect(filter);
            noise.start();
        }
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
    }

    playExplosion() {
        this.init();
        if (!this.ctx || !this.enabled) return;

        const noise = this.createNoiseNode(1.5);
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        
        // Deep bass rumble
        const subOsc = this.ctx.createOscillator();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(100, this.ctx.currentTime);
        subOsc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.8);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(250, this.ctx.currentTime);

        gain.gain.setValueAtTime(1.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.005, this.ctx.currentTime + 1.2);

        if (noise) {
            noise.connect(filter);
            noise.start();
        }
        subOsc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        subOsc.start();
        subOsc.stop(this.ctx.currentTime + 1.2);
    }

    playCrash(intensity = 1.0) {
        this.init();
        if (!this.ctx || !this.enabled) return;

        const noise = this.createNoiseNode(0.3);
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, this.ctx.currentTime);

        let vol = Math.min(intensity * 0.4, 0.8);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

        if (noise) {
            noise.connect(filter);
            noise.start();
        }
        filter.connect(gain);
        gain.connect(this.ctx.destination);
    }

    playPunch() {
        this.init();
        if (!this.ctx || !this.enabled) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.08);

        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    playScream() {
        this.init();
        if (!this.ctx || !this.enabled) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(300, this.ctx.currentTime + 0.4);

        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
    }

    playSiren(start = true) {
        this.init();
        if (!this.ctx || !this.enabled) return;

        if (!start) {
            this.sirenActive = false;
            if (this.sirenInterval) {
                clearInterval(this.sirenInterval);
                this.sirenInterval = null;
            }
            if (this.sirenGain) {
                this.sirenGain.gain.setValueAtTime(0, this.ctx.currentTime);
            }
            return;
        }

        if (this.sirenActive) return;
        this.sirenActive = true;

        if (!this.sirenOsc) {
            this.sirenOsc = this.ctx.createOscillator();
            this.sirenGain = this.ctx.createGain();
            
            this.sirenOsc.type = 'triangle';
            this.sirenOsc.frequency.setValueAtTime(650, this.ctx.currentTime);
            this.sirenGain.gain.setValueAtTime(0, this.ctx.currentTime);
            
            this.sirenOsc.connect(this.sirenGain);
            this.sirenGain.connect(this.ctx.destination);
            this.sirenOsc.start(0);
        }

        this.sirenGain.gain.setTargetAtTime(0.05, this.ctx.currentTime, 0.1);

        let high = true;
        this.sirenInterval = setInterval(() => {
            if (!this.sirenActive || !this.sirenOsc) return;
            let targetFreq = high ? 900 : 600;
            this.sirenOsc.frequency.linearRampToValueAtTime(targetFreq, this.ctx.currentTime + 0.38);
            high = !high;
        }, 400);
    }

    playHorn(start = true) {
        this.init();
        if (!this.ctx || !this.enabled) return;

        if (!start) {
            this.hornActive = false;
            if (this.hornGain) {
                this.hornGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
            }
            return;
        }

        if (this.hornActive) return;
        this.hornActive = true;

        if (!this.hornOsc1) {
            this.hornOsc1 = this.ctx.createOscillator();
            this.hornOsc2 = this.ctx.createOscillator();
            this.hornGain = this.ctx.createGain();

            this.hornOsc1.type = 'sine';
            this.hornOsc2.type = 'sine';

            this.hornOsc1.frequency.setValueAtTime(420, this.ctx.currentTime);
            this.hornOsc2.frequency.setValueAtTime(440, this.ctx.currentTime);

            this.hornGain.gain.setValueAtTime(0, this.ctx.currentTime);

            this.hornOsc1.connect(this.hornGain);
            this.hornOsc2.connect(this.hornGain);
            this.hornGain.connect(this.ctx.destination);

            this.hornOsc1.start(0);
            this.hornOsc2.start(0);
        }

        this.hornGain.gain.setTargetAtTime(0.12, this.ctx.currentTime, 0.03);
    }

    playMissionPassed() {
        this.init();
        if (!this.ctx || !this.enabled) return;

        // Simple arcade fanfare: C4 -> E4 -> G4 -> C5
        const notes = [261.63, 329.63, 392.00, 523.25];
        const times = [0, 0.15, 0.3, 0.45];
        
        notes.forEach((freq, i) => {
            let osc = this.ctx.createOscillator();
            let gain = this.ctx.createGain();
            
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + times[i]);
            
            gain.gain.setValueAtTime(0.1, this.ctx.currentTime + times[i]);
            gain.gain.exponentialRampToValueAtTime(0.005, this.ctx.currentTime + times[i] + 0.3);
            
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.start(this.ctx.currentTime + times[i]);
            osc.stop(this.ctx.currentTime + times[i] + 0.35);
        });
    }

    playMissionFailed() {
        this.init();
        if (!this.ctx || !this.enabled) return;

        // Melancholy arcade failure: C#4 -> C4 -> A3
        const notes = [277.18, 261.63, 220.00];
        const times = [0, 0.25, 0.5];
        
        notes.forEach((freq, i) => {
            let osc = this.ctx.createOscillator();
            let gain = this.ctx.createGain();
            
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + times[i]);
            
            gain.gain.setValueAtTime(0.12, this.ctx.currentTime + times[i]);
            gain.gain.exponentialRampToValueAtTime(0.005, this.ctx.currentTime + times[i] + 0.45);
            
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.start(this.ctx.currentTime + times[i]);
            osc.stop(this.ctx.currentTime + times[i] + 0.55);
        });
    }
}

const audioSystem = new AudioSystem();
