/**
 * Aether Crucible — Procedural Web Audio Engine
 * Standalone real-time sound synthesis & dynamic generative ambient music.
 */

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.isMuted = false;
    this.musicVolume = 0.45;
    this.sfxVolume = 0.7;

    // Music Sequencing State
    this.isPlayingMusic = false;
    this.musicTimer = null;
    this.currentSector = 0;
    this.combatTension = 0; // 0.0 to 1.0
    this.stepIndex = 0;

    // Sector scales (MIDI note arrays)
    this.scales = [
      [48, 51, 55, 58, 60, 63, 67, 70], // Sector 1: Mystical Dorian (C minorish)
      [46, 49, 53, 56, 58, 61, 65, 68], // Sector 2: Molten Phrygian (A# Phrygian)
      [53, 57, 60, 64, 65, 69, 72, 76], // Sector 3: Glacial Lydian (F Lydian)
      [45, 48, 51, 54, 57, 60, 63, 66]  // Sector 4: Void Locrian (A Locrian)
    ];
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.startMusic();
    } catch (e) {
      console.warn("WebAudio initialization failed or not supported:", e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMute(mute) {
    this.isMuted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 1, this.ctx.currentTime, 0.05);
    }
  }

  setMusicVolume(v) {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.05);
    }
  }

  setSfxVolume(v) {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
    }
  }

  midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // ==========================================
  // GENERATIVE MUSIC ENGINE
  // ==========================================
  startMusic() {
    if (this.isPlayingMusic || !this.ctx) return;
    this.isPlayingMusic = true;
    this.stepIndex = 0;
    this.playMusicStep();
  }

  stopMusic() {
    this.isPlayingMusic = false;
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  setTension(t) {
    this.combatTension = Math.max(0, Math.min(1, t));
  }

  setSector(s) {
    this.currentSector = Math.max(0, Math.min(this.scales.length - 1, s));
  }

  playMusicStep() {
    if (!this.isPlayingMusic || !this.ctx) return;

    const scale = this.scales[this.currentSector] || this.scales[0];
    const now = this.ctx.currentTime;
    const tempo = 110 + this.combatTension * 35; // 110 - 145 BPM
    const stepDuration = 60 / tempo / 2; // 8th note duration

    // 1. Bass drone on beat 0 and 8
    if (this.stepIndex % 8 === 0) {
      const rootMidi = scale[0] - 12;
      this.playSynthNote(this.midiToFreq(rootMidi), now, stepDuration * 7.5, 'sawtooth', 0.15 + this.combatTension * 0.1, 120 + this.combatTension * 250);
    }

    // 2. Arpeggio / Melodic shimmer
    if (Math.random() < 0.65 + this.combatTension * 0.3) {
      const noteMidi = scale[Math.floor(Math.random() * scale.length)];
      const dur = stepDuration * (0.8 + Math.random() * 1.5);
      const wave = this.currentSector === 2 ? 'sine' : (this.currentSector === 1 ? 'sawtooth' : 'triangle');
      this.playSynthNote(this.midiToFreq(noteMidi), now, dur, wave, 0.08, 600 + this.combatTension * 1200);
    }

    // 3. Ambient Pad Chord on measure starts
    if (this.stepIndex % 16 === 0) {
      const chordNotes = [scale[0], scale[2] || scale[1], scale[4] || scale[3]];
      chordNotes.forEach(m => {
        this.playSynthNote(this.midiToFreq(m), now, stepDuration * 14, 'sine', 0.04, 400);
      });
    }

    // 4. Tension Beat / Sub Pulse
    if (this.combatTension > 0.25 && (this.stepIndex % 4 === 0 || (this.combatTension > 0.6 && this.stepIndex % 2 === 0))) {
      this.playPercussion(now, 60, 0.08, 0.15 * this.combatTension);
    }

    this.stepIndex = (this.stepIndex + 1) % 64;
    this.musicTimer = setTimeout(() => this.playMusicStep(), stepDuration * 1000);
  }

  playSynthNote(freq, time, duration, type = 'sine', volume = 0.1, filterFreq = 1000) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, time);

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(volume, time + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start(time);
      osc.stop(time + duration + 0.05);
    } catch (e) {}
  }

  playPercussion(time, startFreq, duration, volume) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, time);
      osc.frequency.exponentialRampToValueAtTime(25, time + duration);

      gain.gain.setValueAtTime(volume, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(gain);
      gain.connect(this.musicGain);

      osc.start(time);
      osc.stop(time + duration);
    } catch (e) {}
  }

  // ==========================================
  // PROCEDURAL SOUND EFFECTS
  // ==========================================

  playPrimaryCast(element) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    switch (element) {
      case 'pyros':
        this.playNoise(now, 0.12, 600, 'bandpass', 0.25);
        this.playTone(now, 180, 70, 0.12, 'sawtooth', 0.15);
        break;
      case 'hydros':
        this.playNoise(now, 0.16, 450, 'lowpass', 0.22);
        this.playTone(now, 320, 220, 0.15, 'sine', 0.18);
        break;
      case 'voltos':
        this.playTone(now, 850 + Math.random() * 300, 150, 0.08, 'sawtooth', 0.2);
        this.playNoise(now, 0.07, 2400, 'highpass', 0.18);
        break;
      case 'cryos':
        this.playTone(now, 920, 1150, 0.14, 'triangle', 0.2);
        this.playTone(now, 1380, 1720, 0.14, 'sine', 0.12);
        break;
      case 'toxis':
        this.playTone(now, 140, 240, 0.15, 'sine', 0.22);
        this.playNoise(now, 0.18, 800, 'bandpass', 0.15);
        break;
      case 'aether':
        this.playTone(now, 480, 120, 0.2, 'sine', 0.25);
        this.playTone(now, 240, 60, 0.2, 'triangle', 0.2);
        break;
    }
  }

  playSecondaryCast(element) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    switch (element) {
      case 'pyros': // Fireball Blast
        this.playTone(now, 140, 30, 0.45, 'sawtooth', 0.4);
        this.playNoise(now, 0.4, 400, 'lowpass', 0.5);
        break;
      case 'hydros': // Torrent
        this.playTone(now, 260, 120, 0.5, 'sine', 0.35);
        this.playNoise(now, 0.45, 900, 'bandpass', 0.4);
        break;
      case 'voltos': // Thunder Strike
        this.playTone(now, 1200, 80, 0.35, 'sawtooth', 0.45);
        this.playNoise(now, 0.35, 1800, 'highpass', 0.4);
        break;
      case 'cryos': // Glacial Lance / Nova
        this.playTone(now, 600, 1400, 0.3, 'triangle', 0.35);
        this.playTone(now, 1200, 400, 0.35, 'sine', 0.25);
        break;
      case 'toxis': // Corrosive Bomb
        this.playTone(now, 180, 90, 0.4, 'sawtooth', 0.35);
        this.playNoise(now, 0.38, 1100, 'lowpass', 0.35);
        break;
      case 'aether': // Singularity Collapse
        this.playTone(now, 380, 40, 0.6, 'sine', 0.5);
        this.playTone(now, 90, 25, 0.7, 'triangle', 0.4);
        break;
    }
  }

  playReaction(reactionName) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    switch (reactionName) {
      case 'STEAM_BURST':
        this.playNoise(now, 0.35, 1500, 'bandpass', 0.35);
        this.playTone(now, 300, 500, 0.25, 'sine', 0.15);
        break;
      case 'HYDRO_ELECTRIC':
        this.playTone(now, 950, 200, 0.22, 'sawtooth', 0.4);
        this.playTone(now, 1450, 400, 0.22, 'square', 0.2);
        this.playNoise(now, 0.15, 3000, 'highpass', 0.3);
        break;
      case 'GLACIAL_SHATTER':
        this.playTone(now, 1600, 400, 0.2, 'triangle', 0.45);
        this.playTone(now, 2200, 800, 0.18, 'sine', 0.35);
        this.playNoise(now, 0.25, 2500, 'highpass', 0.3);
        break;
      case 'BIO_DETONATION':
        this.playTone(now, 120, 30, 0.5, 'sawtooth', 0.45);
        this.playNoise(now, 0.45, 600, 'lowpass', 0.45);
        break;
      case 'CRYO_THERMAL':
        this.playTone(now, 400, 1200, 0.25, 'triangle', 0.35);
        this.playNoise(now, 0.3, 1200, 'bandpass', 0.3);
        break;
      case 'SINGULARITY_NOVA':
        this.playTone(now, 600, 35, 0.7, 'sine', 0.55);
        this.playTone(now, 120, 25, 0.8, 'sawtooth', 0.4);
        this.playNoise(now, 0.5, 500, 'lowpass', 0.4);
        break;
      default:
        this.playTone(now, 440, 220, 0.2, 'triangle', 0.3);
    }
  }

  playFlaskThrow() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.playTone(now, 350, 700, 0.18, 'sine', 0.25);
  }

  playDash() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.playNoise(now, 0.16, 1200, 'bandpass', 0.3);
    this.playTone(now, 200, 600, 0.14, 'sine', 0.2);
  }

  playPlayerHurt() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.playTone(now, 160, 60, 0.2, 'sawtooth', 0.35);
    this.playNoise(now, 0.15, 800, 'lowpass', 0.3);
  }

  playShieldBreak() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.playTone(now, 800, 200, 0.3, 'sine', 0.4);
    this.playNoise(now, 0.25, 2000, 'highpass', 0.35);
  }

  playEnemyDeath() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.playTone(now, 180 + Math.random() * 60, 40, 0.15, 'sawtooth', 0.2);
  }

  playPickup() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.playTone(now, 660, 880, 0.12, 'sine', 0.25);
  }

  playRoomClear() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      this.playTone(now + i * 0.08, freq, freq, 0.3, 'triangle', 0.22);
    });
  }

  playBossRoar() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.playTone(now, 110, 45, 1.2, 'sawtooth', 0.5);
    this.playTone(now, 75, 30, 1.2, 'sawtooth', 0.4);
    this.playNoise(now, 1.0, 400, 'lowpass', 0.45);
  }

  playVictoryFanfare() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880, 740, 880, 1108.73];
    notes.forEach((f, i) => {
      this.playTone(now + i * 0.12, f, f, 0.4, 'triangle', 0.3);
    });
  }

  playUIClick() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.playTone(now, 800, 1200, 0.04, 'sine', 0.15);
  }

  // --- Helper Synthesizer Primitives ---

  playTone(time, startFreq, endFreq, duration, type = 'sine', volume = 0.2) {
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(startFreq, time);
      osc.frequency.exponentialRampToValueAtTime(Math.max(10, endFreq), time + duration);

      gain.gain.setValueAtTime(volume, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(time);
      osc.stop(time + duration);
    } catch (e) {}
  }

  playNoise(time, duration, filterFreq = 1000, filterType = 'lowpass', volume = 0.2) {
    try {
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(filterFreq, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      whiteNoise.start(time);
      whiteNoise.stop(time + duration);
    } catch (e) {}
  }
}

// Global singleton instance
window.soundSystem = new SoundSystem();
