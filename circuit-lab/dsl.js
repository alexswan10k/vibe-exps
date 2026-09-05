
"use strict";
/* ============================================================
   Circuit Lab — relational DSL -> netlist -> optimized SVG
   ============================================================ */

/* ---------- seeded RNG (re-seed each run for variety) ---------- */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

/* ---------- component type table ---------- */
const TYPES = {
  R:{pins:2,label:'resistor'}, C:{pins:2,label:'capacitor'}, L:{pins:2,label:'inductor'},
  D:{pins:2,label:'diode'}, LED:{pins:2,label:'LED'}, V:{pins:2,label:'DC source'},
  I:{pins:2,label:'current source'}, BAT:{pins:2,label:'battery'}, SW:{pins:2,label:'switch'}, FUSE:{pins:2,label:'fuse'},
  W:{pins:2,label:'jumper'}, SPK:{pins:2,label:'speaker'}, M:{pins:2,label:'motor'},
  QN:{pins:3,label:'NPN'}, QP:{pins:3,label:'PNP'}, OPAMP:{pins:3,label:'op-amp'},
  GND:{pins:1,label:'ground'}, VCC:{pins:1,label:'supply'}, PORT:{pins:1,label:'port'},
};
const POWER = new Set(['VCC','V+','VDD','5V','9V','12V','3V3','VIN','VCC1']);
const GROUND = new Set(['GND','0V','GND1','VSS','VEE']);

function inferType(id){
  const s = id.toUpperCase();
  if(s.startsWith('LED')) return 'LED';
  if(s.startsWith('QN')||s==='Q'||s.startsWith('Q')) return 'QN';
  if(s.startsWith('QP')) return 'QP';
  if(s.startsWith('U')||s.startsWith('OP')) return 'OPAMP';
  const c = s[0];
  if(c==='R')return 'R'; if(c==='C')return 'C'; if(c==='L')return 'L';
  if(c==='I')return 'I';
  if(c==='D')return 'D'; if(c==='V'||c==='B')return c==='B'?'BAT':'V';
  if(c==='S'&&s.startsWith('SP'))return 'SPK'; if(c==='S')return 'SW';
  if(c==='F')return 'FUSE'; if(c==='J'||c==='W')return 'W';
  if(c==='M')return 'M'; if(c==='G')return 'GND'; if(c==='P')return 'VCC';
  return 'R';
}

/* ---------- DSL parser ---------- */
function parseDSL(src){
  const comps=[]; const wires=[]; const errors=[]; let title='untitled circuit';
  const lines = src.split('\n');
  lines.forEach((raw,idx)=>{
    const ln = idx+1;
    let line = raw.trim();
    if(!line || line.startsWith('#')) return;
    if(line.startsWith('//')) return;
    const mTitle = line.match(/^title\s*:\s*(.+)$/i);
    if(mTitle){ title = mTitle[1].trim(); return; }
    // chain form: segments joined by - or -- (spaces required): A - B, A -- R1 10k -- B
    if(/\s-{1,2}\s/.test(line)){
      try{ parseChain(line, comps, wires, errors, ln); }
      catch(e){ errors.push({ln, msg:String(e.message||e)}); }
      return;
    }
    const toks = line.split(/\s+/);
    const head = toks[0].toUpperCase();
    if(head==='WIRE'){
      if(toks.length!==3){ errors.push({ln,msg:`wire needs 2 nets: wire N1 N2`}); return; }
      wires.push({a:toks[1], b:toks[2], ln}); return;
    }
    if(toks.length<3){ errors.push({ln,msg:`can't parse: "${raw.trim()}". Want: ID TYPE VALUE NET… or A -- R1 10k -- B`}); return; }
    const id = toks[0];
    let type = toks[1].toUpperCase();
    if(!TYPES[type]){ errors.push({ln,msg:`${id}: unknown type "${toks[1]}" — try R C L D LED V QN QP OPAMP GND VCC`}); return; }
    const need = TYPES[type].pins;
    // 1-pin: ID TYPE NET
    if(need===1){
      const nets = toks.slice(2);
      if(nets.length!==1){ errors.push({ln,msg:`${id} (${type}) takes exactly 1 net`}); return; }
      comps.push({id, type, value:'', nets, ln}); return;
    }
    // value = optional single token before the nets (e.g. "10k", "2N2222", "9V").
    // Disambiguated by token COUNT, not content: nets routinely contain
    // digits (N1, OUT2), so content sniffing misfires.
    let rest = toks.slice(2), value='', nets=[];
    if(rest.length===need){ nets=rest; }
    else if(rest.length===need+1){ value=rest[0]; nets=rest.slice(1); }
    else { errors.push({ln,msg:`${id} (${type}) wants ${need} nets${need===2?' + optional value':''}, got "${rest.join(' ')}"`}); return; }
    if(nets.length!==need){ errors.push({ln,msg:`${id}: expected ${need} nets, got ${nets.length}`}); return; }
    comps.push({id, type, value, nets, ln});
  });
  // duplicate id check
  const seen=new Set();
  comps.forEach(c=>{ if(seen.has(c.id.toUpperCase())) errors.push({ln:c.ln,msg:`duplicate id "${c.id}"`}); seen.add(c.id.toUpperCase()); });
  return {comps, wires, errors, title};
}

function parseChain(line, comps, wires, errors, ln){
  // split on - or -- (spaces required, so negative values are safe); strip brackets
  const parts = line.split(/\s-{1,2}\s/).map(s=>s.trim().replace(/^\[/,'').replace(/\]$/,'').trim()).filter(Boolean);
  if(parts.length<2){ errors.push({ln,msg:`chain needs NET - NET or NET -- PART -- NET …`}); return; }
  const netName = s => s.split(/\s+/)[0];
  // classify an odd-position segment: component spec (2+ tokens) or plain net (1 token)
  const asComp = (spec) => {
    const st = spec.split(/\s+/).filter(Boolean);
    if(st.length<2) return null; // single token -> it's a net, i.e. a plain wire hop
    let id=st[0], type=null, value='';
    if(st.length>=3 && TYPES[st[1].toUpperCase()]){ type=st[1].toUpperCase(); value=st.slice(2).join(' '); }
    else if(st.length===2 && TYPES[st[1].toUpperCase()]){ type=st[1].toUpperCase(); value=''; } // "D1 LED"
    else if(st.length>=2 && TYPES[st[0].toUpperCase()] && st[0].length<=5){ type=st[0].toUpperCase(); id=st[0]+'_'+ln; value=st.slice(1).join(' '); }
    else { type=inferType(id); value=st.slice(1).join(' '); }
    return {id, type, value};
  };
  let pending = netName(parts[0]);   // current net
  const flushWire = (a,b) => { if(a!==b) wires.push({a, b, ln}); };
  // classify every segment up front: single token = net, 2+ tokens = component.
  // Then consume: NET (COMP NET | NET)*  — parity-independent, so mixes like
  // "A - B -- R1 10k -- C" just work.
  let i=1;
  while(i<parts.length){
    const c = asComp(parts[i]);
    if(c){
      if(TYPES[c.type].pins!==2){ errors.push({ln,msg:`${c.id} (${c.type}) has ${TYPES[c.type].pins} pins — use explicit form, not chains`}); return; }
      if(i+1>=parts.length){ errors.push({ln,msg:`${c.id} is missing its second net — want NET -- ID VALUE -- NET`}); return; }
      const nxt = asComp(parts[i+1]);
      if(nxt){ errors.push({ln,msg:`expected a net after "${parts[i]}", got another part`}); return; }
      const net = netName(parts[i+1]);
      comps.push({id:c.id,type:c.type,value:c.value,nets:[pending,net],ln});
      pending=net; i+=2;
    } else {
      const net = netName(parts[i]);
      flushWire(pending, net); pending=net; i+=1;
    }
  }
}

/* ---------- examples ---------- */
const EXAMPLES = {
loop:{name:'Resistor loop',sub:'A–B–C–D–A',
dsl:`title: Resistor loop
A -- R1 1k -- B
B -- R2 1k -- C
C -- R3 1k -- D
D -- R4 1k -- A`},
divider:{name:'Voltage divider',sub:'VCC … GND rails',
dsl:`title: Voltage divider
V1 V 9V VCC GND
VCC -- R1 10k -- OUT
OUT -- R2 10k -- GND`},
rc:{name:'RC low-pass',sub:'fc ≈ 160 Hz',
dsl:`title: RC low-pass filter
V1 V 5V IN GND
IN -- R1 1k -- OUT
OUT -- C1 1u -- GND`},
led:{name:'LED limiter',sub:'9V + 330Ω',
dsl:`title: LED with current-limiting resistor
V1 V 9V VCC GND
VCC -- R1 330 -- A
A -- D1 LED -- GND`},
bridge:{name:'Wheatstone bridge',sub:'null detector',
dsl:`title: Wheatstone bridge
V1 V 5V TOP GND
TOP -- R1 1k -- A
TOP -- R3 1k -- B
A -- R2 1k -- GND
B -- R4 1k -- GND
A -- R5 10k -- B`},
npn:{name:'NPN switch',sub:'drives an LED',
dsl:`title: NPN low-side switch
V1 V 9V VCC GND
VCC -- R1 330 -- N1
Q1 QN N1 N2 GND
VCC -- R2 10k -- N2
IN -- R3 1k -- N2`},
opamp:{name:'Inverting amp',sub:'gain ≈ −10',
dsl:`title: Inverting op-amp, gain -10
V1 V 1V IN GND
IN -- R1 1k -- N1
N1 -- R2 10k -- OUT
U1 OPAMP GND N1 OUT`},
rectifier:{name:'Bridge rectifier',sub:'AC → DC + cap',
dsl:`title: Full-wave bridge rectifier
V1 V 12VAC AC1 AC2
AC1 -- D1 1N4007 -- DC
AC2 -- D2 1N4007 -- DC
GNDX -- D3 1N4007 -- AC1
GNDX -- D4 1N4007 -- AC2
DC -- C1 1000u -- GNDX`},
rlc:{name:'Series RLC',sub:'resonant tank',
dsl:`title: Series RLC tank
V1 V 5V IN GND
IN -- R1 100 -- N1
N1 -- L1 10m -- N2
N2 -- C1 100n -- GND`},
};
