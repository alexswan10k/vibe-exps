/* procedural sound effects via Web Audio (no files) */
'use strict';

const Sfx = (() => {
  let ctx = null, master = null, noiseBuf = null, enabled = true;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = .5; master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * .3, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { return false; }
    return true;
  }

  function burst(dur, freq, q, gain, type) {
    if (!enabled || !ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const flt = ctx.createBiquadFilter(); flt.type = type || 'bandpass'; flt.frequency.value = freq; flt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + dur);
    src.connect(flt).connect(g).connect(master);
    src.start(); src.stop(ctx.currentTime + dur + .02);
  }

  const CAT = { grass: [380, 1], stone: [950, 1.6], wood: [560, 2.4], sand: [720, .8], glass: [2300, 3] };
  function catOf(id) { const s = BLOCKS[id] && BLOCKS[id].sound; return CAT[s] || CAT.stone; }

  return {
    resume() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setEnabled(v) { enabled = v; },
    breakBlock(id) { const c = catOf(id); burst(.16, c[0], c[1], .5); },
    place(id) { const c = catOf(id); burst(.07, c[0] * 1.2, c[1], .3); },
    step(id) { const c = catOf(id); burst(.045, c[0] * .8, c[1], .12); },
    jump() { burst(.05, 300, 1, .06); },
    hurt() {
      if (!enabled || !ensure()) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.setValueAtTime(240, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + .25);
      g.gain.setValueAtTime(.18, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .3);
      o.connect(g).connect(master); o.start(); o.stop(ctx.currentTime + .32);
    }
  };
})();
