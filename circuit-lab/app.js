"use strict";
/* ---------- stats / errors / netlist ---------- */
function refreshStats(netlist){
  const c=layoutCost();
  document.getElementById('stParts').textContent=netlist.comps.length;
  document.getElementById('stNets').textContent=new Set(netlist.comps.flatMap(x=>x.nets)).size;
  document.getElementById('stLen').textContent=Math.round(c.len)+' px';
  document.getElementById('stCross').textContent=c.cross;
  document.getElementById('costTag').textContent=`${netlist.comps.length} parts · ✕${c.cross} crossings`;
  document.getElementById('hud').innerHTML=
    `<span><b>${esc(netlist.title||'')}</b></span><span>crossings <b>${c.cross}</b></span><span>drag junctions · scroll to zoom</span>`;
  document.getElementById('netlist').innerHTML=`<table><tr><th>part</th><th>type</th><th>value</th><th>nets</th></tr>`+
    netlist.comps.map(x=>`<tr><td>${esc(x.id)}</td><td>${esc(x.type)}</td><td>${esc(x.value||'—')}</td><td>${x.nets.map(esc).join(' · ')}</td></tr>`).join('')+`</table>`;
}
function showErrors(errors){
  const el=document.getElementById('errors');
  if(!errors.length){el.innerHTML=`<div class="ok">✓ ${'parsed clean — layout is automatic, just like mermaid.'}</div>`;return;}
  el.innerHTML=errors.map(e=>`<div class="err">line ${e.ln}: ${esc(e.msg)}</div>`).join('');
}

/* ---------- app wiring ---------- */
let current=null, renderTimer=null;
function currentDSL(){return document.getElementById('editor').value;}
function doRender(){
  const netlist=parseDSL(currentDSL());
  current=netlist;
  showErrors(netlist.errors);
  if(!netlist.comps.length&&!netlist.wires.length){document.getElementById('canvas').innerHTML='';refreshStats(netlist);return;}
  optimize(netlist);          // layered, synchronous — just lands somewhere sensible
  fitView();
  runSim();                   // sim-ui.js: DC + transient, fills the sim panel
  render(netlist);
  refreshStats(netlist);
  persistHash();
}
// fit the fresh layout into view (user pan/zoom afterwards is untouched
// until the next render, since net-dragging re-renders in place)
function fitView(){
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  layout.nets.forEach(v=>{x0=Math.min(x0,v.x);y0=Math.min(y0,v.y);x1=Math.max(x1,v.x);y1=Math.max(y1,v.y);});
  if(x0>x1){view={x:0,y:0,k:1};return;}
  const bw=x1-x0+280, bh=y1-y0+240;
  const k=clamp(Math.min(820/bw,560/bh),0.4,2);
  view={x:(x0+x1)/2-(820/k)/2, y:(y0+y1)/2-(560/k)/2, k};
}
function persistHash(){
  try{ location.hash='#dsl='+btoa(unescape(encodeURIComponent(currentDSL()))).slice(0,6000); }catch(e){}
}
function restoreHash(){
  if(location.hash.startsWith('#dsl=')){
    try{return decodeURIComponent(escape(atob(location.hash.slice(5))));}catch(e){return null;}
  }return null;
}
function loadExample(key){
  document.getElementById('editor').value=EXAMPLES[key].dsl;
  document.getElementById('exampleSel').value=key;
  doRender();
}

(function init(){
  const sel=document.getElementById('exampleSel');
  sel.innerHTML=Object.entries(EXAMPLES).map(([k,v])=>`<option value="${k}">${v.name} — ${v.sub}</option>`).join('');
  const grid=document.getElementById('exampleGrid');
  grid.innerHTML=Object.entries(EXAMPLES).map(([k,v])=>`<button data-ex="${k}"><b>${v.name}</b><span>${v.sub}</span></button>`).join('');
  grid.querySelectorAll('button').forEach(b=>b.onclick=()=>loadExample(b.dataset.ex));
  sel.onchange=()=>loadExample(sel.value);
  const fromHash=restoreHash();
  document.getElementById('editor').value=fromHash||EXAMPLES.loop.dsl;
  sel.value=fromHash?'loop':'loop';
  document.getElementById('editor').addEventListener('input',()=>{
    clearTimeout(renderTimer); renderTimer=setTimeout(()=>doRender(),350);
  });
  document.getElementById('renderBtn').onclick=()=>doRender();
  document.getElementById('layoutBtn').onclick=()=>doRender();
  document.getElementById('helpBtn').onclick=()=>document.getElementById('help').showModal();
  document.getElementById('shareBtn').onclick=async()=>{
    persistHash();
    try{await navigator.clipboard.writeText(location.href);document.getElementById('shareBtn').textContent='copied!';setTimeout(()=>document.getElementById('shareBtn').textContent='copy link',1200);}catch(e){}
  };
  document.getElementById('svgBtn').onclick=()=>{
    const blob=new Blob([document.getElementById('canvas').outerHTML],{type:'image/svg+xml'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='circuit.svg';a.click();
  };
  document.getElementById('pngBtn').onclick=()=>{
    const svg=document.getElementById('canvas');const xml=new XMLSerializer().serializeToString(svg);
    const img=new Image();
    img.onload=()=>{const c=document.createElement('canvas');c.width=1640;c.height=1120;const x=c.getContext('2d');x.fillStyle='#070b18';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);const a=document.createElement('a');a.href=c.toDataURL('image/png');a.download='circuit.png';a.click();};
    img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(xml);
  };
  doRender();
})();
