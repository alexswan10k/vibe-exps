"use strict";
/* ============================================================
   sim.js — circuit simulation: MNA DC + transient (Newton-Raphson)
   Pure logic, no DOM. Classic script, file:// safe.

   Conventions: matrix rows sum currents LEAVING a node; z holds
   currents ENTERING from independent sources. Plain `wire`s merge
   nets (union-find) before analysis. Every non-ground node gets a
   GMIN shunt so floating sections can't go singular.
   Models: R/SW/FUSE/W/SPK/M resistive · V/BAT voltage source ·
   I current source · D/LED Shockley diode · QN/QP Ebers-Moll ·
   OPAMP ideal VCVS (gain 1e5, unlimited) · C open / L short at DC,
   backward-Euler companions in transient.
   ============================================================ */
const GMIN = 1e-12, OPGAIN = 1e5;

// overlay/probe state shared with render.js + sim-ui.js
let simState = { dc: null, tran: null, _cent: {} };

/* ---------- value + source parsing ---------- */
function parseEng(s){
  const m = String(s ?? '').trim().match(/^([+-]?[\d.]+(?:e[+-]?\d+)?)\s*([a-zA-Zµ]*)(.*)$/);
  if(!m) return NaN;
  if(m[3] && /^\d/.test(m[3].trim())) return NaN; // "1N4007"/"2N2222" are part numbers, not values
  const k = { k: 1e3, K: 1e3, M: 1e6, m: 1e-3, u: 1e-6, U: 1e-6, 'µ': 1e-6, n: 1e-9, N: 1e-9, p: 1e-12 }[(m[2] || '')[0] || ''];
  return k === undefined ? parseFloat(m[1]) : parseFloat(m[1]) * k;
}
function compR(c, def){ const v = parseEng(c.value); return isFinite(v) && v > 0 ? v : def; }
function resOf(c){
  switch(c.type){
    case 'R': return compR(c, 1e3);
    case 'SW': return /open|off/i.test(c.value || '') ? 1e9 : compR(c, 0.2);
    case 'FUSE': return 0.05;
    case 'W': return 1e-3;
    case 'SPK': return compR(c, 8);
    case 'M': return compR(c, 12);
    default: return NaN;
  }
}
// V/BAT/I value: "9V" DC · "12VAC" 50Hz sine (RMS) · "SIN(peak freq)" / "SIN(offset peak freq)"
function parseSource(c){
  const raw = String(c.value || '').trim(), up = raw.toUpperCase().replace(/\s+/g, '');
  const ms = up.match(/^SIN\(([^)]+)\)/);
  if(ms){
    const a = ms[1].split(/[,;]/).map(Number).filter(isFinite);
    if(a.length === 1) return { kind: 'sine', off: 0, peak: a[0], f: 50 };
    if(a.length === 2) return { kind: 'sine', off: 0, peak: a[0], f: a[1] };
    if(a.length >= 3) return { kind: 'sine', off: a[0], peak: a[1], f: a[2] };
    return { kind: 'sine', off: 0, peak: 1, f: 50 };
  }
  if(/AC/.test(up)){ const r = parseEng(raw); return { kind: 'sine', off: 0, peak: (isFinite(r) && r > 0 ? r : 12) * Math.SQRT2, f: 50 }; }
  const d = parseEng(raw);
  return { kind: 'dc', dc: isFinite(d) ? d : (c.type === 'I' ? 1e-3 : 5) };
}
function srcValOf(o, t, stim){
  if(stim === 'step' && o.src.kind === 'dc') return t <= 0 ? 0 : o.src.dc;
  const s = o.src;
  return s.kind === 'sine' ? s.off + s.peak * Math.sin(2 * Math.PI * s.f * t) : s.dc;
}

/* ---------- prep: merge wires, index nodes, branches ---------- */
function simPrep(netlist){
  const parent = new Map();
  const find = n => {
    if(!parent.has(n)) parent.set(n, n);
    while(parent.get(n) !== n){ parent.set(n, parent.get(parent.get(n))); n = parent.get(n); }
    return n;
  };
  netlist.comps.forEach(c => c.nets.forEach(find));
  netlist.wires.forEach(w => { find(w.a); find(w.b); parent.set(find(w.a), find(w.b)); });
  const canon = n => find(n);
  const reps = [...new Set([...parent.keys()].map(canon))];
  const gnd = reps.find(n => n.toUpperCase() === 'GND')
    || reps.find(n => GROUND.has(n.toUpperCase()) || isBotRail(n))
    || reps[0];
  const idx = new Map();
  reps.forEach(n => { if(n !== gnd) idx.set(n, idx.size); });
  const info = netlist.comps.map(c => {
    const o = { c };
    if(c.type === 'V' || c.type === 'BAT' || c.type === 'I') o.src = parseSource(c);
    const r = resOf(c);
    if(isFinite(r)) o.R = r;
    if(c.type === 'D' || c.type === 'LED') o.dio = { Vf: c.type === 'LED' ? 2.0 : 0.7 };
    if(c.type === 'C') o.C = compR(c, 1e-6);
    if(c.type === 'L') o.L = compR(c, 10e-3);
    if(c.type === 'QN') o.bjt = { pol: 1, Bf: 150 };
    if(c.type === 'QP') o.bjt = { pol: -1, Bf: 80 };
    return o;
  });
  const branches = [], brOf = new Map();
  info.forEach(o => {
    const t = o.c.type;
    if(t === 'V' || t === 'BAT' || t === 'OPAMP'){
      brOf.set(o.c, branches.length);
      branches.push({ c: o.c, kind: t === 'OPAMP' ? 'op' : 'v', o });
    }
  });
  return { canon, idx, nv: idx.size, branches, brOf, info, gnd, reps, all: [...parent.keys()] };
}

/* ---------- dense solver (partial pivot) ---------- */
function solveLin(A, z){
  const n = z.length, M = A.map((r, i) => [...r, z[i]]);
  for(let c = 0; c < n; c++){
    let p = c;
    for(let r = c + 1; r < n; r++) if(Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if(Math.abs(M[p][c]) < 1e-14) return null;
    const t = M[c]; M[c] = M[p]; M[p] = t;
    for(let r = c + 1; r < n; r++){
      const f = M[r][c] / M[c][c];
      if(f) for(let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for(let r = n - 1; r >= 0; r--){ let s = M[r][n]; for(let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
  return x;
}

/* ---------- piecewise-linear devices + region iteration ----------
   No exponentials anywhere in the solver: diodes are open / Vf
   sources, BJTs are OFF / ACTIVE (0.7V + β source) / SAT (0.7V +
   0.2V). Every round is a LINEAR solve; violators flip regions until
   all are consistent (or a region repeats → genuinely oscillatory,
   reported honestly). Deterministic, instant, and each part's region
   (off/active/saturated) is a useful readout by itself. */
const VF_DIODE = 0.7, VF_LED = 2.0, VBE_ON = 0.7, VCE_SAT = 0.2;
const BJT_FWD = 0.6; // OFF→ACTIVE threshold (hysteresis vs the 0.7 source)
/* ---------- system assembly (linear in x, given regions) ---------- */
function buildLinear(P, regions, t, stim, dt, state){
  // dynamic branches (ON diodes, BJT junctions) append after static ones
  let N = P.nv + P.branches.length;
  const dyn = new Map(); // comp -> {dio} | {vbe} | {vbe,vce}
  P.info.forEach(o => {
    const rg = regions.get(o.c.id) || 'off';
    if(o.dio && rg === 'on') dyn.set(o.c, { dio: N++ });
    else if(o.bjt && rg === 'act') dyn.set(o.c, { vbe: N++ });
    else if(o.bjt && rg === 'sat') dyn.set(o.c, { vbe: N++, vce: N++ });
  });
  const A = Array.from({ length: N }, () => new Array(N).fill(0));
  const z = new Array(N).fill(0);
  const ri = n => P.idx.get(P.canon(n));
  P.idx.forEach(i => { A[i][i] += GMIN; });
  const addG = (a, b, G) => {
    const ia = ri(a), ib = ri(b);
    if(ia !== undefined && ib !== undefined){ A[ia][ia] += G; A[ib][ib] += G; A[ia][ib] -= G; A[ib][ia] -= G; }
    else if(ia !== undefined) A[ia][ia] += G;
    else if(ib !== undefined) A[ib][ib] += G;
  };
  const addI = (a, b, I) => { // current flowing a -> b
    const ia = ri(a), ib = ri(b);
    if(ia !== undefined) z[ia] -= I;
    if(ib !== undefined) z[ib] += I;
  };
  const vBranch = (bi, a, b, V) => { // ideal voltage source, current a -> b
    const ia = ri(a), ib = ri(b);
    if(ia !== undefined){ A[ia][bi] += 1; A[bi][ia] += 1; }
    if(ib !== undefined){ A[ib][bi] -= 1; A[bi][ib] -= 1; }
    z[bi] = V;
  };
  P.info.forEach(o => {
    const c = o.c, [n0, n1] = c.nets;
    if(o.R !== undefined) addG(n0, n1, 1 / o.R);
    else if(c.type === 'I') addI(n0, n1, srcValOf(o, t, stim));
    else if(c.type === 'C'){
      if(dt > 0){
        const Geq = o.C / dt, vp = state.vc.get(c.id) || 0;
        addG(n0, n1, Geq); addI(n0, n1, -Geq * vp);
      } // DC: open
    }
    else if(c.type === 'L'){
      if(dt > 0){
        const Gt = dt / o.L, ip = state.il.get(c.id) || 0;
        addG(n0, n1, Gt); addI(n0, n1, ip);
      }
      else addG(n0, n1, 1e3); // DC: 1mΩ short
    }
    else if(o.dio){
      // first net is the anode; ON = ideal Vf source, OFF = open
      if((regions.get(c.id) || 'off') === 'on') vBranch(dyn.get(c).dio, n0, n1, o.dio.Vf);
    }
    else if(o.bjt){
      const rg = regions.get(c.id) || 'off';
      if(rg !== 'off'){
        const [nc, nb, ne] = c.nets, Bf = o.bjt.Bf, D = dyn.get(c);
        // Branch current x[br] flows node→pin = conventional into-device
        // current. NPN ACTIVE = 0.7V junction + β source c→e (pin c
        // sinks β·Ib from the node, pin e returns (β+1)·Ib); PNP mirrors
        // it (emitter sources, collector returns). SAT adds a 0.2V branch.
        if(o.bjt.pol > 0){
          vBranch(D.vbe, nb, ne, VBE_ON);
          if(rg === 'act'){
            const ic = ri(nc), ie = ri(ne);
            if(ic !== undefined) A[ic][D.vbe] += Bf;
            if(ie !== undefined) A[ie][D.vbe] += -Bf;
          } else vBranch(D.vce, nc, ne, VCE_SAT);
        } else {
          vBranch(D.vbe, ne, nb, VBE_ON);
          if(rg === 'act'){
            const ic = ri(nc), ie = ri(ne);
            if(ic !== undefined) A[ic][D.vbe] += -Bf;
            if(ie !== undefined) A[ie][D.vbe] += Bf;
          } else vBranch(D.vce, ne, nc, VCE_SAT);
        }
      }
    }
  });
  P.branches.forEach((br, k) => {
    const bi = P.nv + k;
    if(br.kind === 'v'){
      const [a, b] = br.c.nets;
      vBranch(bi, a, b, srcValOf(br.o, t, stim));
    } else { // ideal op-amp: Vout - A*(V+ - V-) = 0
      const [nP, nN, nO] = br.c.nets, io = ri(nO), ip = ri(nP), in_ = ri(nN);
      if(io !== undefined){ A[io][bi] += 1; A[bi][io] += 1; }
      if(ip !== undefined) A[bi][ip] -= OPGAIN;
      if(in_ !== undefined) A[bi][in_] += OPGAIN;
      z[bi] = 0;
    }
  });
  return { A, z, dyn };
}

/* ---------- region iteration ----------
   Start everything OFF, linear-solve, flip every violated region,
   repeat. Diodes: Vd > Vf → on; on-current < 0 → off. NPN: Vbe >
   0.6 → active; active with Ib < 0 → off, Vce < 0.2 → saturated;
   saturated with Ic > β·Ib → active, Ib < 0 → off (PNP mirrored).
   A repeated region set means no stable bias point (astable) —
   reported honestly instead of "converged" to garbage. */
function solveRegions(P, t, stim, dt, state, seed){
  const regions = new Map();
  P.info.forEach(o => {
    if(o.dio || o.bjt) regions.set(o.c.id, (seed && seed.get(o.c.id)) || 'off');
  });
  const seen = new Set();
  for(let round = 0; round < 40; round++){
    const S = buildLinear(P, regions, t, stim, dt, state);
    const x = solveLin(S.A, S.z);
    if(!x) return { ok: false, error: 'singular matrix — shorted source or floating section?' };
    const Vv = n => { const r = P.canon(n); return r === P.gnd ? 0 : x[P.idx.get(r)]; };
    // flip only the worst violator per round (currents normalized to
    // mA so they compare with volts); flipping everything at once
    // ping-pongs when two diodes violate in opposite directions
    let worst = null;
    const consider = (sev, id, to) => { if(sev > 0 && (!worst || sev > worst[0])) worst = [sev, id, to]; };
    P.info.forEach(o => {
      const c = o.c, rg = regions.get(c.id);
      if(o.dio){
        const [a, b] = c.nets;
        if(rg === 'off') consider(Vv(a) - Vv(b) - o.dio.Vf - 0.002, c.id, 'on');
        else consider(-x[S.dyn.get(c).dio] / 1e-3, c.id, 'off');
      } else if(o.bjt){
        const [nc, nb, ne] = c.nets, Bf = o.bjt.Bf;
        if(o.bjt.pol > 0){
          const Vbe = Vv(nb) - Vv(ne), Vce = Vv(nc) - Vv(ne), D = S.dyn.get(c);
          if(rg === 'off') consider(Vbe - BJT_FWD, c.id, 'act');
          else if(rg === 'act'){
            const Ib = x[D.vbe];
            consider(-Ib / 1e-3, c.id, 'off');
            consider(VCE_SAT - 0.005 - Vce, c.id, 'sat');
          } else {
            const Ib = x[D.vbe], Ic = x[D.vce];
            consider(-Ib / 1e-3, c.id, 'off');
            consider((Ic - Bf * Ib * 0.98) / 1e-3, c.id, 'act');
          }
        } else {
          const Veb = Vv(ne) - Vv(nb), Vec = Vv(ne) - Vv(nc), D = S.dyn.get(c);
          if(rg === 'off') consider(Veb - BJT_FWD, c.id, 'act');
          else if(rg === 'act'){
            const Ie = (1 + Bf) * x[D.vbe];
            consider(-Ie / 1e-3, c.id, 'off');
            consider(VCE_SAT - 0.005 - Vec, c.id, 'sat');
          } else {
            const Ie = x[D.vbe] + x[D.vce], Ic = -x[D.vce];
            consider(-Ie / 1e-3, c.id, 'off');
            consider((-Ic - Bf * Ie * 0.98) / 1e-3, c.id, 'act');
          }
        }
      }
    });
    if(!worst) return { ok: true, x, regions: new Map(regions), dyn: S.dyn, rounds: round + 1 };
    regions.set(worst[1], worst[2]);
    const sig = [...regions.entries()].map(([k, v]) => k + ':' + v).join(',');
    if(seen.has(sig)) return { ok: false, error: 'no stable bias point (region oscillation — astable?)', regions: new Map(regions) };
    seen.add(sig);
  }
  return { ok: false, error: 'region iteration did not settle in 40 rounds' };
}

/* ---------- result extraction ---------- */
function simExtract(P, x, regions, dyn, t, stim, dt, state){
  const Vr = new Map();
  P.idx.forEach((i, rep) => Vr.set(rep, x[i]));
  Vr.set(P.gnd, 0);
  const voltages = new Map();
  P.all.forEach(n => voltages.set(n, Vr.get(P.canon(n))));
  const Vv = n => voltages.get(n);
  const cur = [];
  P.info.forEach(o => {
    const c = o.c;
    if(c.nets.length === 1) return;
    const [a, b] = c.nets, Va = Vv(a), Vb = Vv(b);
    if(o.R !== undefined) cur.push({ id: c.id, I: (Va - Vb) / o.R });
    else if(c.type === 'V' || c.type === 'BAT') cur.push({ id: c.id, I: x[P.nv + P.brOf.get(c)] });
    else if(c.type === 'I') cur.push({ id: c.id, I: srcValOf(o, t, stim) });
    else if(o.dio){
      const rg = regions.get(c.id) || 'off';
      cur.push({ id: c.id, I: rg === 'on' ? x[dyn.get(c).dio] : 0, st: rg });
    }
    else if(o.C !== undefined) cur.push({ id: c.id, I: dt > 0 ? (o.C / dt) * ((Va - Vb) - (state.vc.get(c.id) || 0)) : 0 });
    else if(o.L !== undefined) cur.push({ id: c.id, I: dt > 0 ? state.il.get(c.id) : (Va - Vb) * 1e3 });
    else if(o.bjt){
      const rg = regions.get(c.id) || 'off', Bf = o.bjt.Bf, D = dyn.get(c) || {};
      let Ic = 0, Ib = 0;
      if(rg === 'act' && D.vbe !== undefined){
        if(o.bjt.pol > 0){ Ib = x[D.vbe]; Ic = Bf * Ib; }
        else { Ib = -x[D.vbe]; Ic = -Bf * Ib; }
      } else if(rg === 'sat'){
        if(o.bjt.pol > 0){ Ib = x[D.vbe]; Ic = x[D.vce]; }
        else { Ib = -x[D.vbe]; Ic = -x[D.vce]; }
      }
      const st = rg === 'act' ? 'active' : rg;
      cur.push({ id: c.id + ' ▸C', I: Ic, st });
      cur.push({ id: c.id + ' ▸B', I: Ib, st });
    }
    else if(c.type === 'OPAMP') cur.push({ id: c.id + ' ▸out', I: -x[P.nv + P.brOf.get(c)] });
  });
  return { voltages, compCurrents: cur, gnd: P.gnd };
}

/* ---------- public: DC ---------- */
function simulateDC(netlist){
  if(!netlist.comps.length) return { ok: false, error: 'empty circuit' };
  const P = simPrep(netlist);
  const r = solveRegions(P, 0, 'drawn', 0, null, null);
  if(!r.ok) return { ok: false, error: r.error, gnd: P.gnd };
  return { ok: true, rounds: r.rounds, ...simExtract(P, r.x, r.regions, r.dyn, 0, 'drawn', 0, null) };
}

/* ---------- public: transient ---------- */
function simulateTran(netlist, o = {}){
  const P = simPrep(netlist);
  const sines = P.info.filter(i => i.src && i.src.kind === 'sine');
  const Cs = P.info.filter(i => i.C !== undefined), Ls = P.info.filter(i => i.L !== undefined);
  if(!Cs.length && !Ls.length && !sines.length)
    return { ran: false, reason: 'DC-only circuit — add C, L, or an AC/SIN source for transient' };
  const Rmax = Math.max(1, ...P.info.filter(i => i.R !== undefined).map(i => i.R));
  const Cmax = Math.max(0, ...Cs.map(i => i.C)), Lmax = Math.max(0, ...Ls.map(i => i.L));
  const cands = [];
  if(sines.length) cands.push(2.5 / Math.min(...sines.map(i => i.src.f)));
  if(Cmax && Lmax) cands.push(3 * 2 * Math.PI * Math.sqrt(Lmax * Cmax));
  if(Cmax) cands.push(5 * Rmax * Cmax);
  if(Lmax) cands.push(5 * Lmax / Math.max(Rmax, 1));
  const tStop = o.tStop || clamp(Math.max(...cands, 1e-3), 20e-6, 2);
  const steps = clamp(Math.round(o.steps || 400), 50, 2000), dt = tStop / steps;
  let stim = o.stimulus || 'auto';
  if(stim === 'auto') stim = sines.length ? 'drawn' : 'step';
  const state = { vc: new Map(), il: new Map() };
  const Volt = (x, n) => { const r = P.canon(n); return r === P.gnd ? 0 : x[P.idx.get(r)]; };
  let x, regions, dyn = new Map();
  if(stim === 'drawn'){
    const r = solveRegions(P, 0, stim, 0, null, null);
    if(!r.ok) return { ran: false, reason: r.error };
    x = r.x; regions = r.regions; dyn = r.dyn;
    Cs.forEach(i => state.vc.set(i.c.id, Volt(x, i.c.nets[0]) - Volt(x, i.c.nets[1])));
    Ls.forEach(i => state.il.set(i.c.id, (Volt(x, i.c.nets[0]) - Volt(x, i.c.nets[1])) * 1e3));
  } else {
    x = new Array(P.nv + P.branches.length).fill(0);
    regions = new Map();
    Cs.forEach(i => state.vc.set(i.c.id, 0));
    Ls.forEach(i => state.il.set(i.c.id, 0));
  }
  let probes = (o.probes || []).filter(n => P.reps.includes(P.canon(n)));
  if(!probes.length) probes = P.reps.filter(n => n !== P.gnd && !isTopRail(n) && !isBotRail(n)).slice(0, 6);
  if(!probes.length) probes = P.reps.filter(n => n !== P.gnd).slice(0, 6);
  const times = [], traces = {};
  probes.forEach(p => { traces[p] = []; });
  const rec = t => { times.push(t); probes.forEach(p => traces[p].push(Volt(x, p))); };
  rec(0);
  for(let s = 1; s <= steps; s++){
    const t = s * dt;
    const r = solveRegions(P, t, stim, dt, state, regions);
    if(!r.ok) return { ran: false, reason: `t=${t.toFixed(6)}s: ${r.error}` };
    x = r.x; regions = r.regions; dyn = r.dyn;
    Cs.forEach(i => state.vc.set(i.c.id, Volt(x, i.c.nets[0]) - Volt(x, i.c.nets[1])));
    Ls.forEach(i => state.il.set(i.c.id, state.il.get(i.c.id) + (dt / i.L) * (Volt(x, i.c.nets[0]) - Volt(x, i.c.nets[1]))));
    rec(t);
  }
  const lastDyn = dyn;
  return { ran: true, tStop, dt, steps, stim, times, traces, probes, gnd: P.gnd, final: simExtract(P, x, regions, lastDyn || new Map(), tStop, stim, dt, state) };
}
