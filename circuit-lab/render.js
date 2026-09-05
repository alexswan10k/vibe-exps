"use strict";
/* ---------- SVG rendering: parts live at edge midpoints ---------- */
const NS='http://www.w3.org/2000/svg';
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function symbolSVG(c, node){
  // NB: symbol artwork is drawn around local (0,0), so rotation is about
  // the local origin — passing global coords here flings parts off-canvas.
  const v = node.rot?`rotate(${node.rot})`:'';
  const g0=`<g transform="translate(${node.x} ${node.y}) ${v}">`;
  const ink='stroke="#d7e0ff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"';
  const thin='stroke="#d7e0ff" stroke-width="2" fill="none" stroke-linecap="round"';
  const accent=`stroke="#ffd166" stroke-width="2.4" fill="none" stroke-linecap="round"`;
  let s='';
  switch(c.type){
    case 'R': s=`<path d="M-42 0 L-26 0 L-21 -12 L-11 12 L-1 -12 L9 12 L19 -12 L26 0 L42 0" ${accent}/>`;break;
    case 'C': s=`<line x1="-42" y1="0" x2="-6" y2="0" ${ink}/><line x1="-6" y1="-16" x2="-6" y2="16" ${ink}/><line x1="6" y1="-16" x2="6" y2="16" ${ink}/><line x1="6" y1="0" x2="42" y2="0" ${ink}/>`;break;
    case 'L': s=`<line x1="-42" y1="0" x2="-28" y2="0" ${ink}/><path d="M-28 0 a7 9 0 1 1 14 0 a7 9 0 1 1 14 0 a7 9 0 1 1 14 0 a7 9 0 1 1 14 0" ${accent}/><line x1="28" y1="0" x2="42" y2="0" ${ink}/>`;break;
    case 'D': s=`<line x1="-42" y1="0" x2="-10" y2="0" ${ink}/><path d="M-10 -13 L-10 13 L14 0 Z" ${accent}/><line x1="14" y1="-13" x2="14" y2="13" ${ink}/><line x1="14" y1="0" x2="42" y2="0" ${ink}/>`;break;
    case 'LED': s=`<line x1="-42" y1="0" x2="-10" y2="0" ${ink}/><path d="M-10 -13 L-10 13 L14 0 Z" ${accent}/><line x1="14" y1="-13" x2="14" y2="13" ${ink}/><line x1="14" y1="0" x2="42" y2="0" ${ink}/><path d="M-2 -16 L6 -26 M8 -16 L16 -26" stroke="#5df08d" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M6 -26 l4 0 -4 3 M16 -26 l4 0 -4 3" stroke="#5df08d" stroke-width="1.8" fill="none"/>`;break;
    case 'V': case 'BAT': {
      if(c.type==='V') s=`<circle cx="0" cy="0" r="20" ${accent}/><text x="0" y="-24" text-anchor="middle" font-size="13" fill="#ffd166">+</text><text x="0" y="8" text-anchor="middle" font-size="15" fill="#d7e0ff">⎓</text><line x1="-42" y1="0" x2="-20" y2="0" ${ink}/><line x1="20" y1="0" x2="42" y2="0" ${ink}/>`;
      else s=`<line x1="-42" y1="0" x2="-4" y2="0" ${ink}/><line x1="-4" y1="-16" x2="-4" y2="16" ${ink}/><line x1="8" y1="-6" x2="8" y2="6" ${ink}/><line x1="8" y1="0" x2="42" y2="0" ${ink}/>`;
      break; }
    case 'SW': s=`<circle cx="-30" cy="0" r="3" fill="#d7e0ff"/><circle cx="30" cy="0" r="3" fill="#d7e0ff"/><line x1="-42" y1="0" x2="-30" y2="0" ${ink}/><line x1="30" y1="0" x2="42" y2="0" ${ink}/><line x1="-30" y1="0" x2="26" y2="-16" ${accent}/>`;break;
    case 'FUSE': s=`<rect x="-26" y="-9" width="52" height="18" rx="3" ${thin}/><line x1="-26" y1="0" x2="-14" y2="0" ${thin}/><line x1="-42" y1="0" x2="-26" y2="0" ${ink}/><line x1="26" y1="0" x2="42" y2="0" ${ink}/>`;break;
    case 'W': s=`<line x1="-42" y1="0" x2="42" y2="0" stroke="#5aa9ff" stroke-width="2.4" stroke-dasharray="7 5"/>`;break;
    case 'SPK': s=`<path d="M-20 -12 L-6 -12 L10 0 L-6 12 L-20 12 Z" ${thin}/><path d="M14 -10 a14 14 0 0 1 0 20 M20 -16 a22 22 0 0 1 0 32" ${thin}/><line x1="-42" y1="0" x2="-20" y2="0" ${ink}/>`;break;
    case 'M': s=`<circle cx="0" cy="0" r="19" ${thin}/><text x="0" y="6" text-anchor="middle" font-size="15" fill="#d7e0ff">M</text><line x1="-42" y1="0" x2="-19" y2="0" ${ink}/><line x1="19" y1="0" x2="42" y2="0" ${ink}/>`;break;
    case 'QN': case 'QP': {
      const up = c.type==='QN';
      s=`<line x1="-34" y1="-22" x2="-10" y2="-22" ${ink}/><line x1="-34" y1="22" x2="-10" y2="22" ${ink}/><line x1="-10" y1="-26" x2="-10" y2="26" ${accent}/><line x1="-34" y1="0" x2="-10" y2="0" ${ink}/><line x1="-10" y1="0" x2="12" y2="${up?14:14}" ${ink}/><line x1="12" y1="${up?14:-14}" x2="12" y2="${up?34:-34}" ${ink}/><circle cx="2" cy="0" r="30" ${thin}/><path d="M12 ${up?22: -22} l-7 ${up?-9:9} M12 ${up?22:-22} l7 1" ${accent}/>`;
      break; }
    case 'OPAMP': s=`<path d="M-28 -26 L30 0 L-28 26 Z" ${thin}/><text x="-16" y="-8" font-size="14" fill="#d7e0ff">−</text><text x="-16" y="16" font-size="14" fill="#d7e0ff">+</text><line x1="-42" y1="-13" x2="-24" y2="-13" ${ink}/><line x1="-42" y1="13" x2="-24" y2="13" ${ink}/><line x1="30" y1="0" x2="44" y2="0" ${ink}/>`;break;
    case 'GND': s=`<line x1="0" y1="-30" x2="0" y2="-8" ${ink}/><line x1="-14" y1="-8" x2="14" y2="-8" ${ink}/><line x1="-9" y1="0" x2="9" y2="0" ${ink}/><line x1="-4" y1="8" x2="4" y2="8" ${ink}/>`;break;
    case 'VCC': case 'PORT': s=`<circle cx="0" cy="0" r="4" fill="#ffd166"/><line x1="0" y1="4" x2="0" y2="30" ${ink}/>`;break;
    default: s=`<rect x="-30" y="-14" width="60" height="28" rx="6" ${thin}/>`;
  }
  const lbl = esc(c.value?`${c.id} · ${c.value}`:c.id);
  return `${g0}${s}<text x="0" y="40" text-anchor="middle" font-size="11.5" fill="#9aa3c7" font-family="inherit" style="paint-order:stroke" stroke="#070b18" stroke-width="5" stroke-linejoin="round">${lbl}</text></g>`;
}
function routePath(t, n){
  // manhattan: go along the longer axis first from terminal
  const dx=n.x-t.x, dy=n.y-t.y;
  if(Math.abs(dx)<4||Math.abs(dy)<4) return `M${t.x} ${t.y} L${n.x} ${n.y}`;
  if(Math.abs(dx)>=Math.abs(dy)) return `M${t.x} ${t.y} L${n.x} ${t.y} L${n.x} ${n.y}`;
  return `M${t.x} ${t.y} L${t.x} ${n.y} L${n.x} ${n.y}`;
}

let view={x:0,y:0,k:1};
function render(netlist){
  const svg=document.getElementById('canvas');
  const W=820,H=560;
  svg.setAttribute('viewBox',`${view.x} ${view.y} ${W/view.k} ${H/view.k}`);
  let defs=`<defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0 H0 V24" fill="none" stroke="#1a2340" stroke-width="1"/></pattern></defs>`;
  let bg=`<rect x="${view.x-200}" y="${view.y-200}" width="${W/view.k+400}" height="${H/view.k+400}" fill="#070b18"/><rect x="${view.x-200}" y="${view.y-200}" width="${W/view.k+400}" height="${H/view.k+400}" fill="url(#grid)"/>`;
  // title block
  bg+=`<text x="${view.x+14}" y="${view.y+28}" font-size="15" fill="#e8ecff" font-weight="bold">${esc(netlist.title||'')}</text>`;
  bg+=`<text x="${view.x+14}" y="${view.y+46}" font-size="11" fill="#9aa3c7">${netlist.comps.length} parts · ${new Set(netlist.comps.flatMap(c=>c.nets)).size} nets · drag junctions to tweak · scroll to zoom</text>`;
  const N=layout.nets;
  const wireStyle=`stroke="#5aa9ff" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.9"`;
  let wires='', parts='';
  // degree of nets for junction dots
  const deg={};
  netlist.comps.forEach(c=>c.nets.forEach(n=>deg[n]=(deg[n]||0)+1));
  netlist.wires.forEach(w=>{deg[w.a]=(deg[w.a]||0)+1;deg[w.b]=(deg[w.b]||0)+1;});
  // drawn edges: orthogonal polyline, part riding its longest segment
  const line=p=>p.map((q,i)=>(i?'L':'M')+q.x+' '+q.y).join(' ');
  layout.edges.forEach(e=>{
    const A=N.get(e.a),B=N.get(e.b); if(!A||!B||!e.pts)return;
    if(!e.comp){
      wires+=`<path d="${line(e.pts)}" ${wireStyle} stroke-dasharray="7 5"/>`;
      return;
    }
    wires+=`<path d="${line(e.pts)}" ${wireStyle}/>`;
    parts+=symbolSVG(e.comp,{x:e.px,y:e.py,rot:e.rot??(e.horiz?0:90)});
  });
  // 1-pin terminators hang off their net
  netlist.comps.forEach(c=>{
    if(c.nets.length!==1)return;
    const np=N.get(c.nets[0]); if(!np)return;
    if(c.type==='GND'){
      const node={x:np.x,y:np.y+38,rot:0};
      wires+=`<path d="M${np.x} ${np.y} L${np.x} ${np.y+8}" ${wireStyle}/>`;
      parts+=symbolSVG(c,node);
    } else { // VCC / PORT
      const node={x:np.x,y:np.y-38,rot:0};
      wires+=`<path d="M${np.x} ${np.y} L${np.x} ${np.y-8}" ${wireStyle}/>`;
      parts+=symbolSVG(c,node);
    }
  });
  // 3-pin parts sit at their nets' centroid with a stub per pin
  netlist.comps.forEach(c=>{
    if(c.nets.length!==3)return;
    const pts=c.nets.map(n=>N.get(n)); if(pts.some(p=>!p))return;
    const cx=(pts[0].x+pts[1].x+pts[2].x)/3, cy=(pts[0].y+pts[1].y+pts[2].y)/3;
    const offs = c.type==='OPAMP'
      ? [{x:cx-42,y:cy+13},{x:cx-42,y:cy-13},{x:cx+44,y:cy}]
      : [{x:cx-34,y:cy-22},{x:cx-34,y:cy},{x:cx-34,y:cy+22}];
    c.nets.forEach((n,idx)=>{
      wires+=`<path d="${routePath(offs[idx],N.get(n))}" ${wireStyle}/>`;
    });
    parts+=symbolSVG(c,{x:cx,y:cy,rot:0});
    simState._cent[c.id]={x:cx,y:cy}; // for the sim current overlay
  });
  // nets
  let nets='';
  N.forEach(v=>{
    const up=v.id.toUpperCase();
    const isP=POWER.has(up), isG=GROUND.has(up);
    const d=deg[v.id]||0;
    const fill=isP?'#ffd166':isG?'#5df08d':'#5aa9ff';
    if(d>2) nets+=`<circle cx="${v.x}" cy="${v.y}" r="5" fill="${fill}" stroke="#070b18" stroke-width="2" data-net="${esc(v.id)}"/>`;
    else nets+=`<circle cx="${v.x}" cy="${v.y}" r="3.4" fill="none" stroke="${fill}" stroke-width="2" data-net="${esc(v.id)}"/>`;
    nets+=`<text x="${v.x+9}" y="${v.y-8}" font-size="11" fill="${isP||isG?'#ffd166':'#9aa3c7'}" font-weight="${isP||isG?'bold':'normal'}" style="paint-order:stroke" stroke="#070b18" stroke-width="4">${esc(v.id)}</text>`;
  });
  svg.innerHTML=defs+bg+wires+nets+parts+simOverlay();
  attachDrag(svg, netlist);
}

/* ---------- drag / pan / zoom ---------- */
function svgPoint(svg, evt){
  const m=svg.getScreenCTM(); if(!m)return {x:evt.clientX,y:evt.clientY};
  return new DOMPoint(evt.clientX,evt.clientY).matrixTransform(m.inverse());
}
function attachDrag(svg, netlist){
  let drag=null;
  svg.onmousedown=e=>{
    const t=e.target.closest('[data-net]');
    const p=svgPoint(svg,e);
    if(t&&t.dataset.net){
      const v=layout.nets.get(t.dataset.net);
      drag={kind:'net',id:t.dataset.net,dx:v.x-p.x,dy:v.y-p.y};
    } else drag={kind:'pan',sx:e.clientX,sy:e.clientY,vx:view.x,vy:view.y};
    // grabbing a junction captures the pointer; plain mousedown has no
    // pointer id, so guard it (used to throw and kill the gesture)
    if(e.pointerId!==undefined&&svg.setPointerCapture){try{svg.setPointerCapture(e.pointerId);}catch(_){}}
  };
  svg.onmousemove=e=>{
    if(!drag)return;
    if(drag.kind==='pan'){
      const r=svg.getBoundingClientRect();
      view.x=drag.vx-(e.clientX-drag.sx)*( (svg.viewBox.baseVal.width)/r.width );
      view.y=drag.vy-(e.clientY-drag.sy)*( (svg.viewBox.baseVal.height)/r.height );
      render(netlist); return;
    }
    const p=svgPoint(svg,e);
    const v=layout.nets.get(drag.id); if(!v)return;
    v.x=p.x+drag.dx;
    if(!v.rail)v.y=p.y+drag.dy;
    render(netlist);
  };
  svg.onmouseup=()=>{drag=null; refreshStats(netlist);};
  svg.onmouseleave=()=>{drag=null;};
  svg.onwheel=e=>{e.preventDefault();view.k=Math.min(3,Math.max(.5,view.k*(e.deltaY<0?1.1:0.9)));render(netlist);},{passive:false};
}
