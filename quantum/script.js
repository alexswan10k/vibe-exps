/* Quantum Wave Lab — 2D time-dependent Schrödinger equation via split-step Fourier */
(function () {
  'use strict';

  const stage = document.getElementById('stage');
  const ctx = stage.getContext('2d', { alpha: false });
  const ui = document.getElementById('ui');
  document.getElementById('toggleUi').addEventListener('click', () => ui.classList.toggle('collapsed'));

  // --- state ---
  let size = 128;
  let hbar = 1.0, mass = 1.0, dt = 0.05;
  let stepsPerFrame = 1;
  let gain = 1.0;
  let phaseColor = 1;
  let potFade = 0.6;
  let wallH = 40;
  let brushR = 4;
  let brushMode = 'wall';
  let pkgSig = 4.0, pkgKx = 2.0, pkgKy = 0.0;

  let re, im, V;
  let buf; // Uint8ClampedArray
  let tmpRe, tmpIm;
  let t = 0;
  let playing = true;
  let stepCount = 0;

  // mouse
  let mouse = { x:0, y:0, down:false, button:0, moved:false, downX:0, downY:0 };
  let painting = false;

  // fps
  let lastT = performance.now(), fpsAcc=0, fpsFrames=0, fps=0;

  function alloc() {
    const n = size*size;
    re = new Float32Array(n);
    im = new Float32Array(n);
    V = new Float32Array(n);
    buf = new Uint8ClampedArray(n*4);
    tmpRe = new Float32Array(size);
    tmpIm = new Float32Array(size);
    dropPacket(size/2, size/2, (Math.random()*size)|0, (Math.random()*size)|0, false);
    // actually just empty + one packet at center
    re.fill(0); im.fill(0); V.fill(0);
    dropPacket(size/2, size/2);
  }

  // --- FFT ---
  // in-place 1D complex FFT. invert=false: forward (exp -2πi/N); invert=true: inverse + /N
  function fft(reArr, imArr, invert) {
    const n = reArr.length;
    // bit reversal
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let tr = reArr[i]; reArr[i] = reArr[j]; reArr[j] = tr;
        let ti = imArr[i]; imArr[i] = imArr[j]; imArr[j] = ti;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (invert ? 2 : -2) * Math.PI / len;
      const wlenRe = Math.cos(ang), wlenIm = Math.sin(ang);
      const half = len >> 1;
      for (let i = 0; i < n; i += len) {
        let wRe = 1, wIm = 0;
        for (let j = 0; j < half; j++) {
          const uRe = reArr[i+j], uIm = imArr[i+j];
          const vRe = reArr[i+j+half]*wRe - imArr[i+j+half]*wIm;
          const vIm = reArr[i+j+half]*wIm + imArr[i+j+half]*wRe;
          reArr[i+j] = uRe + vRe;
          imArr[i+j] = uIm + vIm;
          reArr[i+j+half] = uRe - vRe;
          imArr[i+j+half] = uIm - vIm;
          const nwRe = wRe*wlenRe - wIm*wlenIm;
          const nwIm = wRe*wlenIm + wIm*wlenRe;
          wRe = nwRe; wIm = nwIm;
        }
      }
    }
    if (invert) {
      for (let i = 0; i < n; i++) { reArr[i] /= n; imArr[i] /= n; }
    }
  }

  function fftRows(reA, imA, invert) {
    for (let y = 0; y < size; y++) {
      const off = y*size;
      for (let x = 0; x < size; x++) { tmpRe[x]=reA[off+x]; tmpIm[x]=imA[off+x]; }
      fft(tmpRe, tmpIm, invert);
      for (let x = 0; x < size; x++) { reA[off+x]=tmpRe[x]; imA[off+x]=tmpIm[x]; }
    }
  }
  function fftCols(reA, imA, invert) {
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) { tmpRe[y]=reA[y*size+x]; tmpIm[y]=imA[y*size+x]; }
      fft(tmpRe, tmpIm, invert);
      for (let y = 0; y < size; y++) { reA[y*size+x]=tmpRe[y]; imA[y*size+x]=tmpIm[y]; }
    }
  }

  // --- physics step ---
  function halfPotential(dt_) {
    const half = dt_ * 0.5 / hbar;
    const n = size*size;
    for (let i = 0; i < n; i++) {
      const phi = V[i] * half; // V * dt/(2ℏ)
      const c = Math.cos(phi), s = Math.sin(phi);
      // ψ *= exp(-i phi)
      const nr = re[i]*c + im[i]*s;
      const ni = im[i]*c - re[i]*s;
      re[i] = nr; im[i] = ni;
    }
  }

  function stepQ(dt_) {
    halfPotential(dt_);
    // kinetic: FFT forward
    fftRows(re, im, false);
    fftCols(re, im, false);
    // multiply in k-space
    const twoPi = 2*Math.PI;
    const kfactor = hbar * dt_ / (2*mass); // ℏ dt/(2m)
    for (let y = 0; y < size; y++) {
      const ky = (y < size/2 ? y : y - size) * twoPi / size;
      for (let x = 0; x < size; x++) {
        const kx = (x < size/2 ? x : x - size) * twoPi / size;
        const k2 = kx*kx + ky*ky;
        const theta = kfactor * k2; // ℏ k² dt/(2m)
        const c = Math.cos(theta), s = Math.sin(theta);
        const i = y*size + x;
        const nr = re[i]*c + im[i]*s;
        const ni = im[i]*c - re[i]*s;
        re[i] = nr; im[i] = ni;
      }
    }
    // inverse FFT
    fftRows(re, im, true);
    fftCols(re, im, true);
    halfPotential(dt_);
    t += dt_;
    stepCount++;
  }

  // --- seeding ---
  function dropPacket(cx, cy, kxOverride, kyOverride, normalize) {
    const sig = pkgSig;
    const kx = (kxOverride === undefined) ? pkgKx : kxOverride;
    const ky = (kyOverride === undefined) ? pkgKy : kyOverride;
    // normalize not needed for amplitude; accumulate
    let norm = 0;
    const ps = new Float32Array(size*size);
    // first build on temp? We'll just add to fields
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - cx, dy = y - cy;
        const r2 = (dx*dx + dy*dy) / (2*sig*sig);
        const amp = Math.exp(-r2);
        const phase = kx*dx + ky*dy;
        const i = y*size + x;
        re[i] += amp * Math.cos(phase);
        im[i] += amp * Math.sin(phase);
        norm += amp*amp;
      }
    }
    // not strict normalize (multiple packets)
  }

  function clearFields() {
    re.fill(0); im.fill(0); V.fill(0); t = 0; stepCount = 0;
  }

  function presetDoubleSlit() {
    clearFields();
    const mid = (size/2)|0;
    const thickness = 3;
    const slitHalf = 6;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // vertical barrier at x = mid, with two slits
        if (Math.abs(x - mid) < thickness) {
          const dy = y - size/2;
          const inSlit = (Math.abs(dy) > slitHalf && Math.abs(dy) < slitHalf+6);
          // barrier everywhere except slits
          const isSlit = (Math.abs(dy) < slitHalf) || (Math.abs(Math.abs(dy)- (slitHalf+6)) < 3);
          // simpler: open two slits
          if (!(Math.abs(dy) < 8 || (Math.abs(dy) > 16 && Math.abs(dy) < 24))) {
            V[y*size+x] = wallH;
          }
        }
      }
    }
    dropPacket(size*0.2, size/2);
  }

  function presetRing() {
    clearFields();
    const cx = size/2, cy = size/2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const r = Math.hypot(x-cx, y-cy);
        if (r > size*0.25 && r < size*0.28) V[y*size+x] = wallH;
        if (r > size*0.38 && r < size*0.41) V[y*size+x] = wallH*0.6;
      }
    }
    dropPacket(cx, cy);
  }

  // --- rendering ---
  function hsvToRgb(h, s, v) {
    // h in radians
    let hh = (h / (2*Math.PI)) % 1; if (hh < 0) hh += 1;
    const i = Math.floor(hh*6) % 6;
    const f = hh*6 - Math.floor(hh*6);
    const p = v*(1-s), q = v*(1-f*s), t = v*(1-(1-f)*s);
    switch (i) {
      case 0: return [v,t,p];
      case 1: return [q,v,t];
      case 2: return [p,v,q];
      case 3: return [p,q,v];
      case 4: return [t,p,v];
      default: return [v,p,q];
    }
  }

  function normCalc() {
    let n = 0;
    for (let i = 0; i < size*size; i++) n += (re[i]*re[i]+im[i]*im[i]) * (1/size)*(1/size); // fft normalized? amplitude not normalized by size in amplitude sense
    // Actually discrete sum over grid approximates ∫|ψ|² dx dy with dx=1, so norm = sum ρ
    let s = 0;
    for (let i = 0; i < size*size; i++) s += re[i]*re[i] + im[i]*im[i];
    return s;
  }

  // display normalization tracked
  let maxRhoEMA = 0;

  function renderQ() {
    const n = size*size;
    // find max rho
    let maxRho = 1e-9;
    for (let i = 0; i < n; i++) {
      const rho = re[i]*re[i] + im[i]*im[i];
      if (rho > maxRho) maxRho = rho;
    }
    if (maxRhoEMA === 0) maxRhoEMA = maxRho;
    maxRhoEMA = maxRhoEMA*0.9 + maxRho*0.1;
    const amp = gain / Math.sqrt(maxRhoEMA + 1e-9);

    const d = buf;
    let off = 0;
    for (let i = 0; i < n; i++) {
      const rho = re[i]*re[i] + im[i]*im[i];
      let val = Math.sqrt(rho) * amp;
      if (val > 1) val = 1;
      let r, g, b;
      if (phaseColor) {
        const h = Math.atan2(im[i], re[i]);
        [r,g,b] = hsvToRgb(h, 1, val);
      } else {
        r = g = b = val;
      }
      // potential darken
      if (V[i] > 0) {
        const pn = Math.min(1, V[i] / (wallH || 1));
        const shade = 1 - pn * potFade;
        r *= shade; g *= shade; b *= shade;
        // also tint walls
        if (pn > 0.5) { r = r*0.4 + 0.2; g = g*0.4 + 0.05; b = b*0.4 + 0.05; } // reddish wall
      }
      d[off] = (r*255)|0;
      d[off+1] = (g*255)|0;
      d[off+2] = (b*255)|0;
      d[off+3] = 255;
      off += 4;
    }

    // scale to stage
    if (!renderQ._tmp) renderQ._tmp = document.createElement('canvas');
    const tc = renderQ._tmp;
    if (tc.width !== size || tc.height !== size) { tc.width = size; tc.height = size; }
    const tctx = tc.getContext('2d');
    try { tctx.putImageData(new ImageData(d, size, size), 0, 0); } catch (e) { /* polyfill */ }

    const cW = stage.width, cH = stage.height;
    ctx.fillStyle = '#02040a'; ctx.fillRect(0,0,cW,cH);
    const scale = Math.max(cW/size, cH/size);
    const dw = size*scale, dh = size*scale;
    const dx = (cW-dw)/2, dy = (cH-dh)/2;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tc, dx, dy, dw, dh);
    ctx.imageSmoothingEnabled = true;
  }

  function Cw_safe(cW){return cW/2;}

  // I'll rewrite vignette properly inside render instead of above hack.
  // Actually above uses Cw_safe; ok.

  // --- resize canvas ---
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    stage.width = window.innerWidth * dpr;
    stage.height = window.innerHeight * dpr;
    stage.style.width = window.innerWidth+'px';
    stage.style.height = window.innerHeight+'px';
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // --- brush / painting ---
  function gridCoord(px, py) {
    const cW = stage.width, cH = stage.height;
    const scale = Math.max(cW/size, cH/size);
    const dw = size*scale, dh = size*scale;
    const dx = (cW-dw)/2, dy = (cH-dh)/2;
    return { gx: (px - dx)/scale, gy: (py - dy)/scale };
  }
  function applyBrush(px, py) {
    const { gx, gy } = gridCoord(px, py);
    const ix = Math.floor(gx), iy = Math.floor(gy);
    const mode = (mouse.button === 2) ? 'erase' : brushMode;
    for (let dy = -brushR; dy <= brushR; dy++) {
      for (let dx = -brushR; dx <= brushR; dx++) {
        const x = ix + dx, y = iy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        if (dx*dx + dy*dy > brushR*brushR) continue;
        const i = y*size + x;
        if (mode === 'wall') V[i] = Math.min(wallH, V[i] + wallH*0.25);
        else V[i] = Math.max(0, V[i] - wallH*0.3);
      }
    }
  }

  function evToStage(e) {
    const rect = stage.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, btn: e.button };
  }

  stage.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const {x,y,btn} = evToStage(e);
    mouse.down = true; mouse.button = btn; mouse.moved = false; mouse.downX = x; mouse.downY = y;
    mouse.x = x; mouse.y = y;
    painting = true;
    if (!playing) { /* allow painting while paused */ }
    if (btn !== 2) {
      // potential pause? keep playing
    }
    applyBrush(x,y);
  });
  window.addEventListener('mousemove', (e) => {
    const {x,y} = evToStage(e);
    mouse.x = x; mouse.y = y;
    if (mouse.downX !== null) {
      const dd = Math.hypot(x - mouse.downX, y - mouse.downY);
      if (dd > 4) mouse.moved = true;
    }
    if (mouse.down && painting) applyBrush(x,y);
  });
  window.addEventListener('mouseup', (e) => {
    const {x,y} = evToStage(e);
    mouse.down = false; painting = false;
    // if not moved much, drop packet
    const dd = Math.hypot(x - mouse.downX, y - mouse.downY);
    if (dd <= 6 && e.button !== 2) {
      const { gx, gy } = gridCoord(x, y);
      if (gx >= 0 && gy >= 0 && gx < size && gy < size) dropPacket(gx, gy);
    }
    mouse.button = 0;
  });
  stage.addEventListener('contextmenu', (e) => e.preventDefault());

  // --- controls wiring ---
  const playBtn = document.getElementById('playBtn');
  playBtn.addEventListener('click', () => { playing = !playing; playBtn.textContent = playing ? '⏸ Pause' : '▶ Play'; playBtn.classList.toggle('active', playing); });

  document.getElementById('stepBtn').addEventListener('click', () => { for (let i=0;i<stepsPerFrame;i++) stepQ(dt); renderQ(); });
  document.getElementById('clearBtn').addEventListener('click', () => { clearFields(); renderQ(); });
  document.getElementById('dropBtn').addEventListener('click', () => { dropPacket(size/2, size/2); renderQ(); });
  document.getElementById('sizeSelect').addEventListener('change', (e) => { size = +e.target.value; alloc(); scalarUI(); renderQ(); });
  document.getElementById('stepsSlider').addEventListener('input', (e) => { stepsPerFrame = +e.target.value; document.getElementById('stepsVal').textContent = stepsPerFrame; });
  document.getElementById('brushMode').addEventListener('change', (e) => brushMode = e.target.value);
  document.getElementById('brushRSlider').addEventListener('input', (e) => { brushR = +e.target.value; document.getElementById('brushRVal').textContent = brushR; });
  document.getElementById('wallHSlider').addEventListener('input', (e) => { wallH = +e.target.value; document.getElementById('wallHVal').textContent = wallH; });
  document.getElementById('presetSlit').addEventListener('click', () => { presetDoubleSlit(); renderQ(); });
  document.getElementById('presetBox').addEventListener('click', () => { presetRing(); renderQ(); });

  function wireRange(id, valId, fmt, setter, after) {
    const sl = document.getElementById(id);
    sl.addEventListener('input', (e) => {
      const v = +e.target.value;
      document.getElementById(valId).textContent = fmt(v);
      setter(v);
      if (after) after(v);
    });
  }
  wireRange('hbarSlider','hbarVal', v=>v.toFixed(1), v=>hbar=v);
  wireRange('massSlider','massVal', v=>v.toFixed(1), v=>mass=v);
  wireRange('dtSlider','dtVal', v=>v.toFixed(2), v=>dt=v);
  wireRange('sigSlider','sigVal', v=>v.toFixed(1), v=>pkgSig=v);
  wireRange('kxSlider','kxVal', v=>v.toFixed(1), v=>pkgKx=v);
  wireRange('kySlider','kyVal', v=>v.toFixed(1), v=>pkgKy=v);
  wireRange('gainSlider','gainVal', v=>v.toFixed(1), v=>gain=v);
  wireRange('phaseSlider','phaseVal', v=>v.toFixed(0), v=>{ phaseColor = v|0; });
  wireRange('potSlider','potVal', v=>v.toFixed(1), v=>potFade=v);

  function scalarUI() {
    const IDS = ['sizeVal']; document.getElementById('sizeVal').textContent = size;
  }

  // keyboard
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); playing = !playing; playBtn.textContent = playing ? '⏸ Pause' : '▶ Play'; playBtn.classList.toggle('active', playing); }
    if (e.code === 'KeyC') { clearFields(); renderQ(); }
  });

  // initial
  alloc();
  playBtn.classList.add('active');
  renderQ();

  // main loop
  let wallBtnLabel = document.getElementById('wallBtn');
  wallBtnLabel.textContent = '🧪 Barriers';
  function loop() {
    if (playing) {
      for (let i = 0; i < stepsPerFrame; i++) stepQ(dt);
    }
    renderQ();
    // fps
    const now = performance.now();
    fpsFrames++; fpsAcc += now - lastT; lastT = now;
    if (fpsAcc > 500) { fps = Math.round(fpsFrames*1000/fpsAcc); fpsFrames=0; fpsAcc=0; document.getElementById('fps').textContent = fps; }
    document.getElementById('t').textContent = t.toFixed(2);
    document.getElementById('norm').textContent = normCalc().toFixed(2);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
