"use strict";
/* ---------- layout: dagre-style layered ranking (mermaid's approach) ----------
   Nodes = nets, edges = components/wires. Parts ride their edge, so both
   ends are connected by construction.
   1. direct edges by BFS visit order (supply outward); backward ones
      become feedback edges  2. longest-path ranking: supply rank 0,
      ground pinned bottom, stray subcircuits stacked below
   3. barycenter ordering sweeps kill crossings  4. centered x + snap
   5. orthogonal routing; multi-rank spans jog into side lanes */
const layout = { nets:new Map(), edges:[], hidden:[], cost:0, cross:0, len:0 };
const LW=760, LH=480;

function isTopRail(n){const u=n.toUpperCase();return POWER.has(u)||u.startsWith('VCC')||u.startsWith('VDD')||u.startsWith('TOP')||u.startsWith('VBUS')||u.startsWith('PWR')||/^\d+V/.test(u)||u==='VIN'||u==='V+';}
function isBotRail(n){const u=n.toUpperCase();return GROUND.has(u)||u.startsWith('GND');}
function clamp(v,a,b){ return Math.min(b,Math.max(a,v)); }

function buildLayered(netlist){
  layout.nets.clear(); layout.edges=[]; layout.hidden=[]; layout.pinPair=new Set(); layout.pullTo=new Map();
  const addNet=n=>{ if(!layout.nets.has(n))layout.nets.set(n,{id:n,x:0,y:0,rank:0,ord:0,rail:isTopRail(n)?'top':isBotRail(n)?'bot':null}); };
  netlist.comps.forEach(c=>{
    c.nets.forEach(addNet);
    if(c.nets.length===2)layout.edges.push({comp:c,a:c.nets[0],b:c.nets[1]});
    else if(c.nets.length===3){
      layout.hidden.push({a:c.nets[0],b:c.nets[1]},{a:c.nets[1],b:c.nets[2]});
      for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){layout.pinPair.add(c.nets[i]+'\n'+c.nets[j]);layout.pinPair.add(c.nets[j]+'\n'+c.nets[i]);}
    }
  });
  netlist.wires.forEach(w=>{addNet(w.a);addNet(w.b);layout.edges.push({comp:null,a:w.a,b:w.b});});
  const N=layout.nets;
  const nb=new Map();
  const link=(a,b)=>{ if(a===b)return; if(!nb.has(a))nb.set(a,new Set()); if(!nb.has(b))nb.set(b,new Set()); nb.get(a).add(b); nb.get(b).add(a); };
  [...layout.edges,...layout.hidden].forEach(e=>link(e.a,e.b));
  // visit order: BFS from supply rails first, then any stray component
  const order=new Map(); let cnt=0;
  const comps=[];
  const seeds=[...N.keys()].filter(isTopRail);
  [...seeds,...N.keys()].forEach(s=>{
    if(order.has(s))return;
    const members=[]; const q=[s]; order.set(s,cnt++);
    while(q.length){ const cur=q.shift(); members.push(cur);
      for(const m of (nb.get(cur)||[])) if(!order.has(m)){order.set(m,cnt++);q.push(m);} }
    comps.push(members);
  });
  // classify unique edges by visit order: forward (ranking) vs feedback
  const rankE=[]; const seenE=new Set();
  [...layout.edges,...layout.hidden].forEach(e=>{
    if(e.a===e.b)return;
    const k=e.a+'\n'+e.b, kr=e.b+'\n'+e.a;
    if(seenE.has(k)||seenE.has(kr))return; seenE.add(k);
    if(order.get(e.a)<order.get(e.b))rankE.push([e.a,e.b]); // forward only; rest is feedback
  });
  // longest-path ranks per connected component, stacked vertically
  const rank=new Map(); let maxRank=0;
  comps.forEach((members,ci)=>{
    const inC=new Set(members);
    const preds=new Map(members.map(v=>[v,[]]));
    const succs=new Map(members.map(v=>[v,[]]));
    rankE.forEach(([a,b])=>{ if(inC.has(a)&&inC.has(b)){preds.get(b).push(a);succs.get(a).push(b);} });
    const sorted=[...members].sort((x,y)=>order.get(x)-order.get(y));
    sorted.forEach(v=>{
      if(isTopRail(v)){ rank.set(v,0); return; }
      let r=0; preds.get(v).forEach(p=>{r=Math.max(r,rank.get(p)+1);}); rank.set(v,r);
    });
    let cMax=Math.max(...members.map(v=>rank.get(v)));
    members.forEach(v=>{ if(isBotRail(v))rank.set(v,cMax); });
    // lone signal inputs (single neighbor, e.g. IN -- R3 -- N2) drop to
    // their neighbor's row instead of floating on the top row.
    // (Multi-neighbor sources like TOP stay put — they're supply entries.)
    for(let pass=0;pass<2;pass++)
      sorted.forEach(v=>{
        if(isTopRail(v)||isBotRail(v))return;
        const all=[...(nb.get(v)||[])];
        if(all.length!==1)return;
        rank.set(v,rank.get(all[0]));
        layout.pullTo.set(v,all[0]);
      });
    cMax=Math.max(...members.map(v=>rank.get(v)));
    const lo=Math.min(...members.map(v=>rank.get(v)));
    const shift=(ci===0?-lo:maxRank+2-lo);
    members.forEach(v=>rank.set(v,rank.get(v)+shift));
    maxRank=Math.max(...members.map(v=>rank.get(v)));
  });
  N.forEach((v,id)=>{ v.rank=rank.get(id)??0; });
  layout.nb=nb; layout.maxRank=maxRank;
}
function segCross(p1,p2,p3,p4){
  const d=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const d1=d(p3,p4,p1),d2=d(p3,p4,p2),d3=d(p1,p2,p3),d4=d(p1,p2,p4);
  return ((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0));
}
// schematic cost: dominant-axis edge length (matches orthogonal drawing)
// plus a heavy crossing penalty. Shared endpoints never count.
function layoutCost(){
  const N=layout.nets, E=layout.edges;
  let len=0;
  const pts=E.map(e=>{const A=N.get(e.a),B=N.get(e.b);len+=Math.max(Math.abs(A.x-B.x),Math.abs(A.y-B.y));return [A,B];});
  let cross=0;
  for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){
    const e1=E[i],e2=E[j];
    if(e1.a===e2.a||e1.a===e2.b||e1.b===e2.a||e1.b===e2.b)continue;
    if(segCross(pts[i][0],pts[i][1],pts[j][0],pts[j][1]))cross++;
  }
  // separation: two nets must never coincide (that would read as a short).
  // Without this the greedy sweeps "optimize" by stacking everything.
  const NN=[...N.values()];
  let ov=0;
  for(let i=0;i<NN.length;i++)for(let j=i+1;j<NN.length;j++){
    const d=Math.hypot(NN[i].x-NN[j].x,NN[i].y-NN[j].y);
    if(d<96)ov+=(96-d);
  }
  return {cost:len+cross*500+ov*8, len, cross};
}
// crossing minimization: barycenter sweeps, top-down then bottom-up
function orderRanks(){
  const N=layout.nets, nb=layout.nb, maxR=layout.maxRank;
  const rows=new Map();
  N.forEach(v=>{ if(!rows.has(v.rank))rows.set(v.rank,[]); rows.get(v.rank).push(v.id); });
  // pulled-down inputs start life next to their neighbor, so same-rank
  // wires never have to cross a third junction to get home
  rows.forEach((row,r)=>{
    const pulled=row.filter(id=>layout.pullTo&&layout.pullTo.has(id));
    if(!pulled.length)return;
    const base=row.filter(id=>!layout.pullTo.has(id));
    pulled.forEach(id=>{
      const t=layout.pullTo.get(id), i=base.indexOf(t);
      if(i<0)base.push(id); else base.splice(i+1,0,id);
    });
    rows.set(r,base);
  });
  const pos=new Map();
  const reindex=r=>rows.get(r).forEach((id,i)=>pos.set(id,i));
  for(let r=0;r<=maxR;r++) if(rows.has(r))reindex(r);
  const bary=(v,otherRank)=>{
    const row=rows.get(otherRank); if(!row)return null;
    const idxs=[];
    for(const m of (nb.get(v)||[])){ const u=N.get(m); if(u&&u.rank===otherRank&&pos.has(m))idxs.push(pos.get(m)); }
    if(!idxs.length)return null;
    return idxs.reduce((a,b)=>a+b,0)/idxs.length;
  };
  const sweep=(r,adj)=>{
    const row=rows.get(r); if(!row)return;
    const key=new Map(row.map(id=>{
      // pulled-down inputs stay glued just after their neighbor
      if(layout.pullTo&&layout.pullTo.has(id))return [id,(pos.get(layout.pullTo.get(id))??0)+0.01];
      return [id,bary(id,adj)];
    }));
    row.sort((a,b)=>{const ka=key.get(a),kb=key.get(b);
      if(ka===null&&kb===null)return pos.get(a)-pos.get(b);
      if(ka===null)return 1; if(kb===null)return -1;
      return ka-kb||pos.get(a)-pos.get(b);});
    reindex(r);
  };
  for(let s=0;s<12;s++){
    for(let r=1;r<=maxR;r++)sweep(r,r-1);
    for(let r=maxR-1;r>=0;r--)sweep(r,r+1);
  }
  N.forEach((v,id)=>{ v.ord=pos.get(id)??0; });
  layout.rows=rows;
}
// x: centered rows + median relaxation; y: even rank spacing
function assignCoords(){
  const N=layout.nets, rows=layout.rows, maxR=layout.maxRank;
  const snapOn=document.getElementById('gridSnap').checked;
  const sn=v=>snapOn?Math.round(v/24)*24:v;
  let vs=maxR>0?Math.min(150,(LH-170)/maxR):0;
  vs=Math.max(vs,72);
  N.forEach(v=>{ v.y=80+v.rank*vs; });
  rows.forEach(row=>{
    const n=row.length;
    row.forEach((id,i)=>{ N.get(id).x=LW/2+(i-(n-1)/2)*150; });
  });
  for(let p=0;p<3;p++){
    N.forEach(v=>{
      const xs=[];
      for(const m of (layout.nb.get(v.id)||[])){const u=N.get(m); if(u)xs.push(u.x);}
      if(xs.length)v.x=(v.x+xs.reduce((a,b)=>a+b,0)/xs.length)/2;
    });
    rows.forEach(row=>{
      const sv=row.map(id=>N.get(id)).sort((a,b)=>a.x-b.x);
      for(let i=1;i<sv.length;i++){
        // nets sharing a 3-pin body need extra elbow room for it
        const need=layout.pinPair.has(sv[i].id+'\n'+sv[i-1].id)?170:110;
        if(sv[i].x-sv[i-1].x<need)sv[i].x=sv[i-1].x+need;
      }
      const mid=(sv[0].x+sv[sv.length-1].x)/2, sh=LW/2-mid;
      sv.forEach(v=>{v.x+=sh;});
    });
  }
  N.forEach(v=>{ v.x=sn(v.x); v.y=sn(v.y); });
}
// orthogonal routing: adjacent ranks go straight/L, long spans jog into
// side lanes (deconflicted so parallel spans don't share a lane)
function routeAll(){
  const N=layout.nets;
  const dedupe=pts=>pts.filter((p,i)=>i===0||p.x!==pts[i-1].x||p.y!==pts[i-1].y);
  const lanes=[];
  layout.edges.forEach((e,idx)=>{
    const A=N.get(e.a),B=N.get(e.b);
    let pts;
    if(e.a===e.b){const x=A.x,y=A.y;pts=[{x,y},{x:x+56,y},{x:x+56,y:y+56},{x,y:y+56}];}
    else if(A.rank===B.rank)pts=[{x:A.x,y:A.y},{x:B.x,y:B.y}];
    // adjacent ranks: horizontal stub at the source row first, so edges
    // fanning out of one net get separate vertical trunks (at their
    // target's x) instead of all piling onto the source's x
    else if(Math.abs(A.rank-B.rank)===1)pts=dedupe([{x:A.x,y:A.y},{x:B.x,y:A.y},{x:B.x,y:B.y}]);
    else{
      // side lane: nearest offset whose vertical span overlaps the least
      // of what's already routed (parallel spans need parallel lanes)
      const y1=Math.min(A.y,B.y), y2=Math.max(A.y,B.y);
      const cands=[84,-84,168,-168].map(d=>A.x+d);
      const score=lx=>lanes.reduce((s,l)=>{
        if(Math.abs(l.x-lx)>=24)return s;
        const ov=Math.min(l.b,y2)-Math.max(l.a,y1);
        return s+(ov>0?10+ov:1);
      },0)+Math.abs(lx-A.x)/840;
      let lx=cands[0],bs=score(lx);
      if(idx%2===1){lx=cands[1];bs=score(lx);} // alternate the default side
      for(const c of cands){const s=score(c);if(s<bs-0.01){bs=s;lx=c;}}
      lanes.push({x:lx,a:y1,b:y2});
      pts=dedupe([{x:A.x,y:A.y},{x:lx,y:A.y},{x:lx,y:B.y},{x:B.x,y:B.y}]);
    }
    let bi=0,bl=-1;
    for(let i=0;i<pts.length-1;i++){
      const l=Math.max(Math.abs(pts[i+1].x-pts[i].x),Math.abs(pts[i+1].y-pts[i].y));
      if(l>bl){bl=l;bi=i;}
    }
    e.pts=pts;
    e.px=(pts[bi].x+pts[bi+1].x)/2; e.py=(pts[bi].y+pts[bi+1].y)/2;
    e.horiz=Math.abs(pts[bi+1].x-pts[bi].x)>=Math.abs(pts[bi+1].y-pts[bi].y);
    // diodes/LEDs point at their second net (nets are [anode, cathode])
    if(e.comp&&(e.comp.type==='D'||e.comp.type==='LED'))
      e.rot=e.horiz?(B.x>=A.x?0:180):(B.y>=A.y?90:270);
    else e.rot=e.horiz?0:90;
  });
}
// deterministic and instant — no animation, like mermaid
function optimize(netlist){
  buildLayered(netlist);
  orderRanks();
  assignCoords();
  routeAll();
  const c=layoutCost();
  layout.cost=c.cost; layout.len=c.len; layout.cross=c.cross;
  return c;
}
