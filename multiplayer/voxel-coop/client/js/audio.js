// Tiny WebAudio synth SFX — no dependencies.
export class AudioSys {
  constructor() {
    this.ctx = null; this.master = null;
    this.muted = false;
  }
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.25;
      this.master.connect(this.ctx.destination);
    } catch { /* no audio */ }
    return this.ctx;
  }
  tone(f0, dur = 0.12, type = "square", vol = 0.6, slideTo = 0) {
    if (!this.ensure() || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur = 0.15, vol = 0.5, freq = 1200) {
    if (!this.ensure() || this.muted) return;
    const t = this.ctx.currentTime, n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }
  breakBlock() { this.noise(0.18, 0.7, 900); this.tone(180, 0.1, "triangle", 0.4, 60); }
  place() { this.tone(320, 0.08, "square", 0.4, 200); }
  hit() { this.noise(0.1, 0.6, 2500); this.tone(220, 0.08, "sawtooth", 0.4, 110); }
  pickup() { this.tone(660, 0.07, "sine", 0.5, 990); }
  eat() { this.noise(0.12, 0.5, 700); this.tone(300, 0.09, "triangle", 0.35, 150); }
  hurt() { this.tone(160, 0.25, "sawtooth", 0.6, 60); }
  splash() { this.noise(0.25, 0.5, 1800); }
  toggleMute() {
    this.muted = !this.muted;
    const b = document.getElementById("mute-btn");
    if (b) b.textContent = this.muted ? "🔇" : "🔊";
    return this.muted;
  }
}
export const audio = new AudioSys();
