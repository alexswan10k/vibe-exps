"use strict";
/* ============================================================
   sim-ui.js — simulation DOM layer: schematic overlay badges,
   results panel, scope plot, control wiring.
   Engine lives in sim.js. Classic script, file:// safe.
   (Only touches app.js globals inside event handlers / runSim,
   which always run after every script has loaded.)
   ============================================================ */

function fmtV(v){
  if(!isFinite(v)) return '—';
  const a = Math.abs(v);
  if(a < 1) return (v * 1000).toPrecision(3) + 'mV';
  if(a < 1000) return v.toPrecision(3) + 'V';
  return (v / 1000).toPrecision(3) + 'kV';
}
function fmtI(i){
  if(!isFinite(i)) return '—';
  const a = Math.abs(i);
  if(a < 1e-6) return (i * 1e9).toPrecision(3) + 'nA';
  if(a < 1e-3) return (i * 1e6).toPrecision(3) + 'µA';
  if(a < 1) return (i * 1e3).toPrecision(3) + 'mA';
  return i.toPrecision(3) + 'A';
}
function voltColor(v, lo, hi){
  if(!(hi > lo)) return '#9aa3c7';
  return `hsl(${210 - 210 * (v - lo) / (hi - lo)} 85% 68%)`;
}
function checked(id){
  try { const el = document.getElementById(id); return !!(el && el.checked); }
  catch(e){ return false; }
}

/* voltage badges on nets + current labels on parts */
function simOverlay(){
  if(!simState.dc || !simState.dc.ok) return '';
  if(!checked('showV') && !checked('showI')) return '';
  const N = layout.nets, Vs = simState.dc.voltages;
  const vs = [...Vs.values()].filter(isFinite);
  const lo = Math.min(...vs), hi = Math.max(...vs);
  let s = '';
  if(checked('showV')) N.forEach(v => {
    const val = Vs.get(v.id);
    if(val === undefined || !isFinite(val)) return;
    const txt = fmtV(val), col = voltColor(val, lo, hi), w = txt.length * 6.6 + 13;
    s += `<g transform="translate(${v.x + 12} ${v.y + 10})" font-family="inherit">`
      + `<rect width="${w.toFixed(0)}" height="17" rx="8.5" fill="#0f1528" opacity="0.92" stroke="${col}" stroke-width="1.1"/>`
      + `<text x="${(w / 2).toFixed(0)}" y="12.5" text-anchor="middle" font-size="10.5" fill="${col}">${esc(txt)}</text></g>`;
  });
  if(checked('showI')){
    const im = new Map((simState.dc.compCurrents || []).map(e => [e.id, e.I]));
    layout.edges.forEach(e => {
      if(!e.comp) return;
      const I = im.get(e.comp.id);
      if(I === undefined || !isFinite(I)) return;
      s += `<text x="${e.px}" y="${e.py - 30}" text-anchor="middle" font-size="10.5" fill="#4ecdc4" font-family="inherit" style="paint-order:stroke" stroke="#070b18" stroke-width="4">${esc(fmtI(I))}</text>`;
    });
    Object.entries(simState._cent).forEach(([id, p]) => {
      const I = im.get(id + ' ▸C');
      if(I === undefined || !isFinite(I)) return;
      s += `<text x="${p.x}" y="${p.y - 46}" text-anchor="middle" font-size="10.5" fill="#4ecdc4" font-family="inherit" style="paint-order:stroke" stroke="#070b18" stroke-width="4">Ic ${esc(fmtI(I))}</text>`;
    });
  }
  return s;
}

/* run both analyses for the current netlist, then refresh the panel */
function runSim(){
  simState._cent = {};
  const nl = current;
  try { simState.dc = simulateDC(nl); }
  catch(e){ simState.dc = { ok: false, error: String((e && e.message) || e) }; }
  const tMs = parseFloat((document.getElementById('tStop') || {}).value);
  const stim = (document.getElementById('stimSel') || {}).value || 'auto';
  try {
    simState.tran = simulateTran(nl, { tStop: isFinite(tMs) && tMs > 0 ? tMs / 1000 : undefined, stimulus: stim });
  }
  catch(e){ simState.tran = { ran: false, reason: String((e && e.message) || e) }; }
  renderSimPanel();
}

function renderSimPanel(){
  const tag = document.getElementById('simTag'), msg = document.getElementById('simMsg');
  const dc = simState.dc, tr = simState.tran;
  if(!dc || !dc.ok){
    tag.textContent = 'no solution';
    msg.innerHTML = `<div class="err">DC: ${esc(dc ? dc.error : '—')}</div>`;
    document.getElementById('simV').innerHTML = '';
    document.getElementById('simI').innerHTML = '';
    drawPlot();
    return;
  }
  tag.textContent = `DC ✓ ${dc.rounds} rounds${tr && tr.ran ? ` · ${(tr.tStop * 1000).toPrecision(3)} ms transient` : ''}`;
  const hasGnd = [...dc.voltages.keys()].some(n => n.toUpperCase() === 'GND');
  msg.innerHTML = (hasGnd ? '' : `<div class="warn">no GND net — voltages relative to ${esc(dc.gnd)}</div>`)
    + (tr && !tr.ran ? `<div class="warn">${esc(tr.reason)}</div>` : `<div class="ok">✓ DC converged · MNA + piecewise-linear regions</div>`);
  const vRows = [...dc.voltages.entries()].sort((a, b) => a[0] === dc.gnd ? -1 : b[0] === dc.gnd ? 1 : a[0] < b[0] ? -1 : 1);
  document.getElementById('simV').innerHTML = '<tr><th>net</th><th style="text-align:right">V</th></tr>' +
    vRows.map(([n, v]) => `<tr><td>${esc(n)}${n === dc.gnd ? ' ⏚' : ''}</td><td style="text-align:right">${esc(fmtV(v))}</td></tr>`).join('');
  document.getElementById('simI').innerHTML = '<tr><th>part</th><th>state</th><th style="text-align:right">I (in → out)</th></tr>' +
    (dc.compCurrents || []).map(e => `<tr><td>${esc(e.id)}</td><td>${esc(e.st || '—')}</td><td style="text-align:right">${esc(fmtI(e.I))}</td></tr>`).join('');
  // probe checkboxes (preserve selection across re-renders)
  const prev = new Set([...document.querySelectorAll('#probes input:checked')].map(i => i.value));
  const first = prev.size === 0;
  const nets = tr && tr.ran ? tr.probes : [...dc.voltages.keys()].filter(n => n !== dc.gnd).slice(0, 6);
  document.getElementById('probes').innerHTML = nets.map(n =>
    `<label><input type="checkbox" value="${esc(n)}" ${first || prev.has(n) ? 'checked' : ''} /> ${esc(n)}</label>`).join('');
  drawPlot();
}

function drawPlot(){
  const cv = document.getElementById('plot');
  if(!cv) return;
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  ctx.fillStyle = '#070b18'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#1a2340'; ctx.lineWidth = 1;
  for(let gx = 0; gx <= W; gx += 64){ ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
  for(let gy = 0; gy <= H; gy += 50){ ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
  const tr = simState.tran;
  ctx.font = '12px ui-monospace,Menlo,monospace';
  if(!tr || !tr.ran){
    ctx.fillStyle = '#9aa3c7';
    ctx.fillText(tr ? tr.reason : 'no transient', 16, H / 2);
    return;
  }
  const sel = [...document.querySelectorAll('#probes input:checked')].map(i => i.value).filter(n => tr.traces[n]);
  if(!sel.length){ ctx.fillStyle = '#9aa3c7'; ctx.fillText('tick a probe net below', 16, H / 2); return; }
  let lo = 0, hi = 0;
  sel.forEach(k => tr.traces[k].forEach(v => { lo = Math.min(lo, v); hi = Math.max(hi, v); }));
  if(hi - lo < 1e-9){ hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.15; hi += pad; lo -= pad;
  const L = 56, R = 14, T = 26, B = 22;
  const X = t => L + (t / tr.tStop) * (W - L - R);
  const Y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const pal = ['#ffd166', '#4ecdc4', '#ff5d7a', '#5aa9ff', '#5df08d', '#c792ea'];
  sel.forEach((k, i) => {
    ctx.strokeStyle = pal[i % pal.length]; ctx.lineWidth = 1.8; ctx.beginPath();
    tr.times.forEach((t, j) => { const x = X(t), y = Y(tr.traces[k][j]); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
    ctx.fillStyle = pal[i % pal.length];
    ctx.fillText(k, L + 6 + i * 64, 16);
  });
  ctx.fillStyle = '#9aa3c7';
  ctx.fillText(fmtV(hi), 6, T + 4);
  ctx.fillText(fmtV(lo), 6, H - B + 4);
  const unit = tr.tStop >= 1 ? [1, 's'] : tr.tStop >= 1e-3 ? [1e3, 'ms'] : [1e6, 'µs'];
  ctx.fillText(0 + '', L, H - 6);
  const end = (tr.tStop * unit[0]).toPrecision(3) + ' ' + unit[1];
  ctx.fillText(end, W - R - ctx.measureText(end).width, H - 6);
}

/* control wiring — elements exist already; app.js globals resolve at event time */
document.getElementById('runSimBtn').onclick = () => doRender();
document.getElementById('stimSel').onchange = () => doRender();
document.getElementById('tStop').onchange = () => doRender();
document.getElementById('showV').onchange = () => { if(current) render(current); };
document.getElementById('showI').onchange = () => { if(current) render(current); };
document.getElementById('probes').addEventListener('change', () => drawPlot());
