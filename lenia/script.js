/* Lenia — continuous cellular automaton (artificial life) */
(function () {
  'use strict';

  const stage = document.getElementById('stage');
  const ctx = stage.getContext('2d', { alpha: false });
  const ui = document.getElementById('ui');
  const toggleUi = document.getElementById('toggleUi');
  const plot = document.getElementById('plot');
  const pctx = plot.getContext('2d');

  // state
  let W = 128, H = 128;
  let field = new Float32Array(W * H);
  let nextField = new Float32Array(W * H);
  let displayBuf = null; // Uint8ClampedArray
  let prevBuf = null;

  let R = 9;
  let mu = 0.5, sig = 0.15;
  let m = 0.2, s = 0.04, dt = 0.05;
  let stepsPerFrame = 2;
  let playing = false;
  let stepCount = 0;
  let totalLife = 0;

  let cmap = 'bio';
  let glow = 0.7;
  let trail = 0.0;

  let brushMode = 'add';
  let brushR = 6;
  let brushS = 0.6;

  // history (ring)
  const MAXHIST = 90;
  let history = []; // array of Float32Array clones
  let historyPaused = false; // scrubbing
  let scrubIndex = -1; // -1 = live

  let kernel = null; // {w: Float32Array, size, R}

  // mouse
  let mouse = { x: 0, y: 0, down: false, button: 0, inside: false };
  let painting = false;

  // fps
  let lastT = performance.now();
  let fpsAcc = 0, fpsFrames = 0, fps = 0;

  // colormaps
  const COLORMAPS = {
    bio: [[0,0,0,0],[0.15,0.05,0.25,0.6],[0.35,0.15,0.6,0.9],[0.6,0.3,0.95,1],[1,0.7,1,1]],
    magma: [[0,0,0,0],[0.2,0.05,0.0,0.6],[0.7,0.2,0.05,0.9],[0.95,0.6,0.1,1],[1,0.95,0.7,1]],
    viridis: [[0,0.0,0.05,0.1],[0.25,0.15,0.3,0.4],[0.5,0.4,0.6,0.2],[0.75,0.85,0.5,0.1],[1,0.98,0.9,0.15]],
    ice: [[0,0.02,0.05,0.12],[0.25,0.1,0.4,0.7],[0.5,0.3,0.7,0.95],[0.75,0.6,0.9,1],[1,0.9,1,1]],
    mono: [[0,0,0,0],[0.2,0.25,0.25,0.25],[0.5,0.55,0.55,0.55],[0.8,0.85,0.85,0.85],[1,1,1,1]],
  };
  // each stop: [t, r,g,b] 0..1

  function sampleCmap(t) {
    t = Math.max(0, Math.min(1, t));
    const stops = COLORMAPS[cmap];
    // find segment
    let i = 0;
    while (i < stops.length - 2 && t > stops[i+1][0]) i++;
    const a = stops[i], b = stops[i+1];
    const u = (t - a[0]) / (b[0] - a[0] + 1e-9);
    return [
      a[1] + (b[1]-a[1])*u,
      a[2] + (b[2]-a[2])*u,
      a[3] + (b[3]-a[3])*u
    ];
  }

  function buildKernel() {
    const size = 2 * R + 1;
    const w = new Float32Array(size * size);
    let sum = 0;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const rr = Math.sqrt(dx*dx+dy*dy) / R;
        let v = 0;
        if (rr <= 1) {
          v = Math.exp(-Math.pow(rr - mu, 2) / (2 * sig * sig));
        }
        w[(dy+R)*size + (dx+R)] = v;
        sum += v;
      }
    }
    if (sum > 0) for (let i = 0; i < w.length; i++) w[i] /= sum;
    kernel = { w, size, R, sum };
    drawPlot();
  }

  function growthVal(u) {
    const g = Math.exp(-Math.pow(u - m, 2) / (2 * s * s));
    return 2 * g - 1;
  }

  function resizeGrid(n) {
    W = n; H = n;
    field = new Float32Array(W * H);
    nextField = new Float32Array(W * H);
    displayBuf = new Uint8ClampedArray(W * H * 4);
    prevBuf = new Uint8ClampedArray(W * H * 4);
    buildKernel();
    history = [];
    scrubIndex = -1;
    historyPaused = false;
    document.getElementById('scrubSlider').max = 0;
    document.getElementById('scrubSlider').value = 0;
    document.getElementById('scrubLabel').textContent = 'live';
    stepCount = 0;
    seedBlob();
  }

  function idx(x, y) { return y * W + x; }

  function stepSim() {
    if (historyPaused) return;
    const k = kernel;
    const sz = k.size, RR = k.R;
    const ks = k.w;
    const dt_ = dt;
    // convolution + growth
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let acc = 0;
        for (let ky = 0; ky < sz; ky++) {
          const sy = y + ky - RR;
          const yy = (sy < 0) ? sy + H : (sy >= H ? sy - H : sy);
          const rowOff = yy * W;
          const krowOff = ky * sz;
          for (let kx = 0; kx < sz; kx++) {
            let sx = x + kx - RR;
            if (sx < 0) sx += W;
            else if (sx >= W) sx -= W;
            acc += ks[krowOff + kx] * field[rowOff + sx];
          }
        }
        const u = acc;
        // inline growth
        const du = u - m;
        const g = 2 * Math.exp(-(du*du)/(2*s*s)) - 1;
        let nv = field[y*W+x] + dt_ * g;
        if (nv < 0) nv = 0; else if (nv > 1) nv = 1;
        nextField[y*W+x] = nv;
      }
    }
    // swap
    const tmp = field; field = nextField; nextField = tmp;
    stepCount++;
    // history
    if (history.length >= MAXHIST) history.shift();
    history.push(field.slice());
    // update scrubber max
    const sl = document.getElementById('scrubSlider');
    sl.max = history.length;
    if (scrubIndex === -1) sl.value = history.length;
    // life total
    let t = 0;
    for (let i = 0; i < field.length; i++) t += field[i];
    totalLife = t / field.length;
  }

  function renderField(fld) {
    if (!displayBuf) return;
    const d = displayBuf;
    let off = 0;
    for (let i = 0; i < fld.length; i++) {
      const v = fld[i];
      const rgb = sampleCmap(Math.pow(v, 0.7));
      const nr = (rgb[0]*255)|0, ng = (rgb[1]*255)|0, nb = (rgb[2]*255)|0;
      if (trail > 0 && prevBuf) {
        const a = trail;
        d[off]   = (prevBuf[off]*a + nr*(1-a))|0;
        d[off+1] = (prevBuf[off+1]*a + ng*(1-a))|0;
        d[off+2] = (prevBuf[off+2]*a + nb*(1-a))|0;
      } else {
        d[off]=nr; d[off+1]=ng; d[off+2]=nb;
      }
      prevBuf[off]=nr; prevBuf[off+1]=ng; prevBuf[off+2]=nb; prevBuf[off+3]=255;
      d[off+3]=255;
      off += 4;
    }
    const img = (typeof ImageData !== 'undefined') ? new ImageData(d, W, H) : { data: d, width: W, height: H };
    // draw scaled
    const cW = stage.width, cH = stage.height;
    // use temp canvas for scaling
    if (!renderField._tmp) renderField._tmp = document.createElement('canvas');
    const tc = renderField._tmp;
    if (tc.width !== W || tc.height !== H) { tc.width = W; tc.height = H; }
    const tctx = tc.getContext('2d');
    tctx.putImageData(img, 0, 0);
    // clear
    ctx.fillStyle = '#03040a';
    ctx.fillRect(0, 0, cW, cH);
    // maintain aspect: fill screen (stretch slightly) — use cover
    const scale = Math.max(cW / W, cH / H);
    const dw = W * scale, dh = H * scale;
    const dx = (cW - dw) / 2, dy = (cH - dh) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tc, dx, dy, dw, dh);
    if (glow > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, glow * 0.5);
      ctx.filter = `blur(${(glow*12)|0 + 4}px)`;
      ctx.drawImage(tc, dx, dy, dw, dh);
      ctx.restore();
      ctx.filter = 'none';
    }
    // vignette
    const g = ctx.createRadialGradient(cW/2, cH/2, cW*0.3, cW/2, cH/2, cW*0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,cW,cH);
  }

  function seedBlob(cx, cy, radius) {
    const cx_ = (cx === undefined) ? W/2 : cx;
    const cy_ = (cy === undefined) ? H/2 : cy;
    const r = (radius === undefined) ? Math.min(W,H)*0.12 : radius;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - cx_, y - cy_);
        const v = Math.exp(-Math.pow(d / r, 2) * 2);
        field[y*W+x] = Math.min(1, field[y*W+x] + v * 0.9);
      }
    }
  }

  function clearField() { field.fill(0); nextField.fill(0); if (prevBuf) prevBuf.fill(0); history = []; stepCount = 0; scrubIndex = -1; historyPaused = false; }

  function randomSoup() {
    clearField();
    const n = 4 + ((Math.random()*4)|0);
    for (let i = 0; i < n; i++) {
      const x = 20 + Math.random()*(W-40);
      const y = 20 + Math.random()*(H-40);
      const r = 4 + Math.random()*14;
      seedBlob(x, y, r);
    }
  }

  function mutate() {
    const jitter = (v, amt) => Math.max(0.001, v + (Math.random()-0.5)*amt);
    R = Math.max(5, Math.min(16, R + ((Math.random()-0.5)*4)|0));
    mu = Math.min(0.9, Math.max(0.1, jitter(mu, 0.15)));
    sig = Math.min(0.35, Math.max(0.03, jitter(sig, 0.08)));
    m = Math.min(0.4, Math.max(0.05, jitter(m, 0.08)));
    s = Math.min(0.12, Math.max(0.005, jitter(s, 0.03)));
    dt = Math.min(0.2, Math.max(0.01, jitter(dt, 0.04)));
    syncUIFromState();
    buildKernel();
    clearField();
    randomSoup();
    playing = true;
    updatePlayBtn();
  }

  const PRESETS = [
    { R:9, mu:0.5, sig:0.15, m:0.2, s:0.04, dt:0.05 },
    { R:13, mu:0.45, sig:0.12, m:0.15, s:0.015, dt:0.1 },
    { R:7, mu:0.35, sig:0.2, m:0.28, s:0.06, dt:0.06 },
    { R:10, mu:0.6, sig:0.1, m:0.12, s:0.02, dt:0.08 },
  ];
  function randomPreset() {
    const p = PRESETS[(Math.random()*PRESETS.length)|0];
    R=p.R; mu=p.mu; sig=p.sig; m=p.m; s=p.s; dt=p.dt;
    syncUIFromState();
    buildKernel();
    clearField();
    randomSoup();
    playing = true;
    updatePlayBtn();
  }

  function syncUIFromState() {
    setSlider('RSlider','RVal', R, v=>v.toFixed(0));
    setSlider('muSlider','muVal', mu, v=>v.toFixed(2));
    setSlider('sigSlider','sigVal', sig, v=>v.toFixed(2));
    setSlider('mSlider','mVal', m, v=>v.toFixed(2));
    setSlider('sSlider','sVal', s, v=>v.toFixed(3));
    setSlider('dtSlider','dtVal', dt, v=>v.toFixed(2));
    document.getElementById('stepsSlider').value = stepsPerFrame;
    document.getElementById('stepsVal').textContent = stepsPerFrame;
    document.getElementById('brushRSlider').value = brushR;
    document.getElementById('brushRVal').textContent = brushR;
    document.getElementById('brushSSlider').value = brushS;
    document.getElementById('brushSVal').textContent = brushS.toFixed(1);
    document.getElementById('cmapSelect').value = cmap;
    document.getElementById('glowSlider').value = glow;
    document.getElementById('glowVal').textContent = glow.toFixed(1);
    document.getElementById('trailSlider').value = trail;
    document.getElementById('trailVal').textContent = trail.toFixed(2);
    document.getElementById('brushMode').value = brushMode;
  }
  function setSlider(sliderId, valId, value, fmt) {
    const sl = document.getElementById(sliderId);
    sl.value = value;
    document.getElementById(valId).textContent = fmt(value);
  }

  function updatePlayBtn() {
    const b = document.getElementById('playBtn');
    b.textContent = playing ? '⏸ Pause' : '▶ Play';
    b.classList.toggle('active', playing);
  }

  function drawPlot() {
    const w = plot.width, h = plot.height;
    pctx.fillStyle = 'rgba(0,0,0,0.5)';
    pctx.fillRect(0,0,w,h);
    // kernel profile: K as function of r normalized distance 0..1
    pctx.strokeStyle = 'rgba(180,180,180,0.7)';
    pctx.lineWidth = 1.5;
    pctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const r = i/100;
      let v = 0;
      if (r <= 1) v = Math.exp(-Math.pow(r - mu,2)/(2*sig*sig));
      const x = i/100 * (w-4)+2;
      const y = h - 4 - v * (h-8);
      if (i===0) pctx.moveTo(x,y); else pctx.lineTo(x,y);
    }
    pctx.stroke();
    // growth G(u) for u in 0..1, x maps u
    pctx.strokeStyle = '#ffffff';
    pctx.lineWidth = 2;
    pctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const u = i/100;
      const g = growthVal(u); // -1..1
      const gn = (g+1)/2;
      const x = i/100 * (w-4)+2;
      const y = h - 4 - gn * (h-8);
      if (i===0) pctx.moveTo(x,y); else pctx.lineTo(x,y);
    }
    pctx.stroke();
    // zero line
    pctx.strokeStyle = 'rgba(255,255,255,0.15)';
    pctx.beginPath();
    pctx.moveTo(2, h/2); pctx.lineTo(w-2, h/2); pctx.stroke();
  }

  // brush application in grid coords
  function gridCoord(px, py) {
    // map screen to grid via same transform as render (cover)
    const cW = stage.width, cH = stage.height;
    const scale = Math.max(cW / W, cH / H);
    const dw = W * scale, dh = H * scale;
    const dx = (cW - dw) / 2, dy = (cH - dh) / 2;
    const gx = (px - dx) / scale;
    const gy = (py - dy) / scale;
    return { gx, gy };
  }

  function applyBrush(px, py) {
    const { gx, gy } = gridCoord(px, py);
    const ri = brushR;
    const ix = Math.floor(gx), iy = Math.floor(gy);
    for (let dy = -ri; dy <= ri; dy++) {
      for (let dx = -ri; dx <= ri; dx++) {
        const x = ix + dx, y = iy + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const d2 = dx*dx+dy*dy;
        if (d2 > ri*ri) continue;
        const falloff = Math.exp(-d2/(ri*ri*0.5+1));
        const i = y*W+x;
        const mode = (mouse.button === 2) ? 'erase' : brushMode;
        if (mode === 'add') {
          field[i] = Math.min(1, field[i] + brushS * falloff * 0.15);
        } else if (mode === 'erase') {
          field[i] = Math.max(0, field[i] - brushS * falloff * 0.2);
        } else { // nudge
          field[i] = Math.min(1, field[i] + brushS * falloff * 0.6);
        }
      }
    }
  }

  function enterLive() {
    historyPaused = false;
    scrubIndex = -1;
    const sl = document.getElementById('scrubSlider');
    sl.value = history.length;
    document.getElementById('scrubLabel').textContent = 'live';
  }

  // event wiring
  toggleUi.addEventListener('click', () => ui.classList.toggle('collapsed'));

  const playBtn = document.getElementById('playBtn');
  playBtn.addEventListener('click', () => { playing = !playing; if (playing) enterLive(); updatePlayBtn(); });
  document.getElementById('stepBtn').addEventListener('click', () => { enterLive(); stepSim(); renderField(field); });
  document.getElementById('clearBtn').addEventListener('click', () => { clearField(); renderField(field); });
  document.getElementById('randomSoupBtn').addEventListener('click', () => { clearField(); randomSoup(); enterLive(); renderField(field); });
  document.getElementById('seedBlobBtn').addEventListener('click', () => { clearField(); seedBlob(); enterLive(); renderField(field); });
  document.getElementById('mutateBtn').addEventListener('click', mutate);
  document.getElementById('presetsBtn').addEventListener('click', randomPreset);

  document.getElementById('stepsSlider').addEventListener('input', (e) => { stepsPerFrame = +e.target.value; document.getElementById('stepsVal').textContent = stepsPerFrame; });
  document.getElementById('gridSelect').addEventListener('change', (e) => resizeGrid(+e.target.value));

  function wireRange(id, valId, fmt, setter) {
    const sl = document.getElementById(id);
    sl.addEventListener('input', (e) => {
      const v = +e.target.value;
      document.getElementById(valId).textContent = fmt(v);
      setter(v);
      buildKernel();
      drawPlot();
    });
  }
  wireRange('RSlider','RVal', v=>v.toFixed(0), v=>{R=v;});
  wireRange('muSlider','muVal', v=>v.toFixed(2), v=>{mu=v;});
  wireRange('sigSlider','sigVal', v=>v.toFixed(2), v=>{sig=v;});
  wireRange('mSlider','mVal', v=>v.toFixed(2), v=>{m=v;});
  wireRange('sSlider','sVal', v=>v.toFixed(3), v=>{s=v;});
  wireRange('dtSlider','dtVal', v=>v.toFixed(2), v=>{dt=v;});

  document.getElementById('brushRSlider').addEventListener('input', (e)=>{ brushR=+e.target.value; document.getElementById('brushRVal').textContent=brushR; });
  document.getElementById('brushSSlider').addEventListener('input', (e)=>{ brushS=+e.target.value; document.getElementById('brushSVal').textContent=brushS.toFixed(1); });
  document.getElementById('brushMode').addEventListener('change', (e)=> brushMode=e.target.value);
  document.getElementById('cmapSelect').addEventListener('change', (e)=> { cmap=e.target.value; renderField(historyPaused && scrubIndex>=0 && scrubIndex<history.length ? history[scrubIndex] : field); });
  document.getElementById('glowSlider').addEventListener('input', (e)=>{ glow=+e.target.value; document.getElementById('glowVal').textContent=glow.toFixed(1); });
  document.getElementById('trailSlider').addEventListener('input', (e)=>{ trail=+e.target.value; document.getElementById('trailVal').textContent=trail.toFixed(2); });

  const scrubSlider = document.getElementById('scrubSlider');
  scrubSlider.addEventListener('input', (e) => {
    const v = +e.target.value;
    const L = history.length;
    if (v >= L || L === 0) {
      enterLive();
    } else {
      historyPaused = true;
      playing = false;
      updatePlayBtn();
      scrubIndex = v;
      document.getElementById('scrubLabel').textContent = `#${v} / ${L}`;
      renderField(history[scrubIndex]);
    }
  });

  document.getElementById('favBtn').addEventListener('click', () => {
    // download current params+field as json
    const payload = {
      R,mu,sig,m,s,dt, W,H,
      field: Array.from(field),
      cmap
    };
    const blob = new Blob([JSON.stringify(payload)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lenia-favorite-${Date.now()}.json`;
    a.click();
  });
  document.getElementById('exportBtn').addEventListener('click', () => {
    const url = stage.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = `lenia-${Date.now()}.png`; a.click();
  });

  // mouse
  function evToStage(e) {
    const rect = stage.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, btn: e.button };
  }
  stage.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const {x,y,btn} = evToStage(e);
    mouse.down = true; mouse.button = btn; mouse.x=x; mouse.y=y;
    painting = true;
    enterLive();
    applyBrush(x,y);
  });
  window.addEventListener('mousemove', (e) => {
    const {x,y} = evToStage(e);
    mouse.x=x; mouse.y=y;
    if (mouse.down && painting) {
      if (mouse.button===2) brushMode='erase';
      applyBrush(x,y);
    }
  });
  window.addEventListener('mouseup', (e) => {
    mouse.down = false; painting = false;
  });
  stage.addEventListener('contextmenu', (e) => e.preventDefault());
  stage.addEventListener('mouseleave', () => { mouse.down=false; painting=false; });

  // keyboard
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); playing = !playing; if (playing) enterLive(); updatePlayBtn(); }
    if (e.code === 'KeyC') { clearField(); renderField(field); }
    if (e.code === 'KeyR') randomPreset();
  });

  // resize canvas to window
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    stage.width = window.innerWidth * dpr;
    stage.height = window.innerHeight * dpr;
    stage.style.width = window.innerWidth+'px';
    stage.style.height = window.innerHeight+'px';
    renderField(historyPaused && scrubIndex>=0 && scrubIndex<history.length ? history[scrubIndex] : field);
  }
  window.addEventListener('resize', resizeCanvas);

  // initial
  resizeCanvas();
  R=9; mu=0.5; sig=0.15; m=0.2; s=0.04; dt=0.05; stepsPerFrame=2; brushR=6; brushS=0.6; cmap='bio'; glow=0.7; trail=0.0; brushMode='add';
  syncUIFromState();
  resizeGrid(128);
  seedBlob();
  renderField(field);
  playing = true;
  updatePlayBtn();

  // main loop
  function loop(ts) {
    const now = performance.now();
    if (playing && !historyPaused) {
      for (let i = 0; i < stepsPerFrame; i++) stepSim();
    }
    const showField = (historyPaused && scrubIndex>=0 && scrubIndex<history.length) ? history[scrubIndex] : field;
    renderField(showField);

    // fps
    fpsFrames++;
    fpsAcc += now - lastT;
    lastT = now;
    if (fpsAcc > 500) {
      fps = Math.round(fpsFrames * 1000 / fpsAcc);
      fpsFrames = 0; fpsAcc = 0;
      document.getElementById('fps').textContent = fps;
    }
    document.getElementById('stepCount').textContent = stepCount;
    document.getElementById('cells').textContent = totalLife.toFixed(3);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
