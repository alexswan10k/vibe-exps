/* ============================================================
   VOXEL VERSE v2 — "PERFECT" update
   Infinite terrain · day/night · survival · mobs · drops ·
   particles · minimap · persistence · P2P co-op + bots
   ============================================================ */
'use strict';

/* ---------- utils ---------- */
const $ = id => document.getElementById(id);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rand = (a=1,b)=> b===undefined ? Math.random()*a : a+Math.random()*(b-a);
const randi = (a,b)=>Math.floor(rand(a,b+1));
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
function toast(msg, ms=2600){ const d=document.createElement('div'); d.className='toast'; d.textContent=msg; $('toast-root').appendChild(d); setTimeout(()=>d.remove(), ms); }
function chatAdd(name, text, me=false){ const log=$('chat-log'); const d=document.createElement('div'); d.className='chat-msg'; d.innerHTML=`<b style="color:${me?'#ffe14d':'#7dd3fc'}">${escapeHtml(name)}</b>: ${escapeHtml(text)}`; log.appendChild(d); while(log.children.length>7) log.firstChild.remove(); setTimeout(()=>{ if(d.parentNode) d.remove(); }, 12000); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ---------- audio (procedural, no assets) ---------- */
const AudioSys = {
  ctx:null, enabled:true,
  ensure(){ if(this.ctx||!this.enabled) return; try{ this.ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} },
  blip(freq=440,dur=0.08,type='square',vol=0.12,slide=0){ if(!this.enabled) return; this.ensure(); if(!this.ctx) return;
    const t=this.ctx.currentTime, o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,t); if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),t+dur);
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t+dur+0.02); },
  noise(dur=0.12,vol=0.15,low=400){ if(!this.enabled) return; this.ensure(); if(!this.ctx) return;
    const t=this.ctx.currentTime, len=this.ctx.sampleRate*dur, buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
    const s=this.ctx.createBufferSource(); s.buffer=buf; const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=low;
    const g=this.ctx.createGain(); g.gain.value=vol; s.connect(f); f.connect(g); g.connect(this.ctx.destination); s.start(t); },
  break(){this.noise(0.12,0.2,900);}, place(){this.blip(220,0.09,'square',0.12);},
  step(){this.noise(0.05,0.05,500);}, hit(){this.blip(160,0.1,'sawtooth',0.15,-80);},
  hurt(){this.blip(110,0.25,'sawtooth',0.2,-40);}, pop(){this.blip(660,0.12,'sine',0.15,440);},
  eat(){this.blip(330,0.08,'triangle',0.15); setTimeout(()=>this.blip(440,0.08,'triangle',0.15),90);},
  splash(){this.noise(0.3,0.18,1200);}, level(){[523,659,784,1046].forEach((f,i)=>setTimeout(()=>this.blip(f,0.15,'triangle',0.14),i*110));}
};

/* ---------- controls ---------- */
class SimplePointerLockControls {
  constructor(camera, domElement){ this.camera=camera; this.domElement=domElement; this.isLocked=false;
    this.euler=new THREE.Euler(0,0,0,'YXZ'); this.PI_2=Math.PI/2;
    this._mm=this.onMouseMove.bind(this); this._plc=this.onPointerLockChange.bind(this);
    document.addEventListener('mousemove',this._mm,false); document.addEventListener('pointerlockchange',this._plc,false);
    this.listeners={}; }
  addEventListener(t,l){ (this.listeners[t]=this.listeners[t]||[]).push(l); }
  dispatchEvent(e){ (this.listeners[e.type]||[]).forEach(l=>l(e)); }
  onMouseMove(e){ if(!this.isLocked) return; this.rotate(e.movementX||0, e.movementY||0); }
  onPointerLockChange(){ if(document.pointerLockElement===this.domElement){ this.isLocked=true; this.dispatchEvent({type:'lock'}); }
    else { this.isLocked=false; this.dispatchEvent({type:'unlock'}); } }
  lock(){ this.domElement.requestPointerLock(); } unlock(){ document.exitPointerLock(); }
  rotate(mx,my){ const s=Settings.sens*0.0022; this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.y-=mx*s; this.euler.x-=my*s; this.euler.x=clamp(this.euler.x,-this.PI_2+0.01,this.PI_2-0.01);
    this.camera.quaternion.setFromEuler(this.euler); }
  moveForward(d){ const v=new THREE.Vector3(); v.setFromMatrixColumn(this.camera.matrix,0); v.crossVectors(this.camera.up,v); this.camera.position.addScaledVector(v,d); }
  moveRight(d){ const v=new THREE.Vector3(); v.setFromMatrixColumn(this.camera.matrix,0); this.camera.position.addScaledVector(v,d); }
}

/* ---------- perlin (seeded) ---------- */
class Perlin {
  constructor(seed=1337){ this.p=new Uint8Array(512);
    const base=[151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
    let s=seed>>>0; const rnd=()=> (s=(s*1664525+1013904223)>>>0)/4294967296;
    const p=base.slice(); for(let i=255;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [p[i],p[j]]=[p[j],p[i]]; }
    for(let i=0;i<256;i++){ this.p[i]=p[i]; this.p[i+256]=p[i]; } }
  fade(t){return t*t*t*(t*(t*6-15)+10);} lerp(t,a,b){return a+t*(b-a);}
  grad(h,x,y,z){ h&=15; const u=h<8?x:y, v=h<4?y:(h===12||h===14?x:z); return ((h&1)===0?u:-u)+((h&2)===0?v:-v); }
  noise(x,y,z){ const X=Math.floor(x)&255,Y=Math.floor(y)&255,Z=Math.floor(z)&255;
    x-=Math.floor(x); y-=Math.floor(y); z-=Math.floor(z);
    const u=this.fade(x),v=this.fade(y),w=this.fade(z), P=this.p;
    const A=P[X]+Y,AA=P[A]+Z,AB=P[A+1]+Z,B=P[X+1]+Y,BA=P[B]+Z,BB=P[B+1]+Z;
    return this.lerp(w,this.lerp(v,this.lerp(u,this.grad(P[AA],x,y,z),this.grad(P[BA],x-1,y,z)),this.lerp(u,this.grad(P[AB],x,y-1,z),this.grad(P[BB],x-1,y-1,z))),this.lerp(v,this.lerp(u,this.grad(P[AA+1],x,y,z-1),this.grad(P[BA+1],x-1,y,z-1)),this.lerp(u,this.grad(P[AB+1],x,y-1,z-1),this.grad(P[BB+1],x-1,y-1,z-1)))); }
}
let perlin = new Perlin(1337);

/* ---------- settings & state ---------- */
const Settings = { sens:1, renderDist:4, shadows:true, clouds:true, sound:true, mode:'survival', difficulty:'normal', seed:1337, fov:75, quality:'auto', pixelRatio:Math.min(devicePixelRatio||1,1.5) };
const State = {
  started:false, dead:false, fly:false, sprint:false, inWater:false, headInWater:false,
  health:20, maxHealth:20, hunger:20, xp:0, day:1, prot:0,
  time:0.32, // 0..1, 0.25=sunrise
  activeBlock:0, inventory:{}, creative:false,
  playerId:'p'+Math.random().toString(36).slice(2,8), playerName:'Steve', playerColor:'#ff5555',
  yaw:0
};
const HOTBAR = [0,1,2,5,9,10,11,12,4]; // 9 slots -> block types
State.hotbar=[...HOTBAR]; // reorderable via drag; persisted in save

/* ---------- blocks ---------- */
const BLOCK = { GRASS:0, DIRT:1, STONE:2, WATER:3, SAND:4, WOOD:5, LEAVES:6, SNOW:7, BEDROCK:8, PLANKS:9, GLASS:10, BRICK:11, GLOW:12, OBSIDIAN:13 };
const BLOCK_DEF = [
  {name:'Grass',   color:0x5fd35f, opaque:true},
  {name:'Dirt',    color:0x8a5a2b, opaque:true},
  {name:'Stone',   color:0x8d8d94, opaque:true},
  {name:'Water',   color:0x3b6df6, opaque:false, liquid:true},
  {name:'Sand',    color:0xe8d27a, opaque:true},
  {name:'Log',     color:0x6b4a26, opaque:true},
  {name:'Leaves',  color:0x2f9e44, opaque:false},
  {name:'Snow',    color:0xf4f8ff, opaque:true},
  {name:'Bedrock', color:0x23232a, opaque:true, unbreakable:true},
  {name:'Planks',  color:0xc49a5a, opaque:true},
  {name:'Glass',   color:0xbfe8ff, opaque:false},
  {name:'Brick',   color:0xb05136, opaque:true},
  {name:'Glow',    color:0xffd34d, opaque:true, light:true},
  {name:'Obsidian',color:0x2a1e4f, opaque:true},
];
function makePixelTexture(hex, opts={}){
  const c=document.createElement('canvas'); c.width=c.height=32; const g=c.getContext('2d');
  const base='#'+hex.toString(16).padStart(6,'0'); g.fillStyle=base; g.fillRect(0,0,32,32);
  // two-tone pixel noise for depth (dark + light speckles)
  const n=opts.noise??110;
  for(let i=0;i<n;i++){ g.fillStyle=`rgba(0,0,0,0.16)`; g.fillRect(randi(0,31),randi(0,31),randi(1,2),randi(1,2)); }
  for(let i=0;i<n*0.5;i++){ g.fillStyle=`rgba(255,255,255,0.10)`; g.fillRect(randi(0,31),randi(0,31),1,1); }
  for(let i=0;i<(opts.spark??0);i++){ g.fillStyle='rgba(255,255,255,0.55)'; g.fillRect(randi(0,31),randi(0,31),2,2); }
  if(opts.top){ g.fillStyle=opts.top; g.fillRect(0,0,32,10);
    g.fillStyle='rgba(0,0,0,0.25)'; for(let x=0;x<32;x+=4) g.fillRect(x,10,2,2); // jagged grass edge
    g.fillStyle='rgba(255,255,255,0.12)'; g.fillRect(0,0,32,2); }
  if(opts.rings){ g.strokeStyle='rgba(0,0,0,0.35)'; g.lineWidth=2;
    g.strokeRect(4,4,24,24); g.strokeRect(9,9,14,14); g.fillStyle='rgba(255,255,255,0.08)'; g.fillRect(0,0,4,32); }
  if(opts.mortar){ g.strokeStyle='rgba(255,255,255,0.55)'; g.lineWidth=2;
    for(let y=8;y<32;y+=8){ g.beginPath(); g.moveTo(0,y); g.lineTo(32,y); g.stroke(); }
    for(let y=0;y<32;y+=8){ const off=(y/8)%2?8:0; for(let x=off;x<32;x+=16){ g.beginPath(); g.moveTo(x,y); g.lineTo(x,y+8); g.stroke(); } } }
  if(opts.frame){ g.strokeStyle='rgba(255,255,255,0.9)'; g.lineWidth=3; g.strokeRect(1,1,30,30);
    g.fillStyle='rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(4,28); g.lineTo(12,4); g.lineTo(18,4); g.lineTo(10,28); g.fill(); }
  if(opts.waves){ g.fillStyle='rgba(255,255,255,0.22)'; for(let y=4;y<32;y+=8) for(let x=0;x<32;x+=4) g.fillRect(x+((y/8)%2)*2,y,3,1); }
  const t=new THREE.CanvasTexture(c); t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter; return t;
}

/* ---------- three globals ---------- */
let camera, scene, renderer, controls, raycaster, sunLight, moonLight, hemi, ambLight, moonMesh, sunMesh, sunGlow, stars, cloudsMesh, cloudsMesh2, blockOutline, torchLight;
let skyDome=null, skyU=null;
let chunkMeshes, mobGroup, pickupGroup, particleGroup, remoteGroup;
let waterMats=[]; // animated water/glass materials
const CHUNK=16, SEA=4, MAXH=22;
const chunks=new Map();
const overrides=new Map(); // "wx,wy,wz" -> type|null
const materials=[]; // per block type (single material w/ texture; grass uses side tex)
const boxGeo=new THREE.BoxGeometry(1,1,1);
const pickupGeo=new THREE.BoxGeometry(0.35,0.35,0.35);
/* Baked directional face shading — cheap "GI base": tops bright, sides mid, bottom dark.
   BoxGeometry vertex order: +x(0-3), -x(4-7), +y(8-11), -y(12-15), +z(16-19), -z(20-23).
   Multiplies with the texture (materials use vertexColors) at zero runtime cost. */
function paintFaceShading(geo, shades){
  const n=geo.attributes.position.count, col=new Float32Array(n*3);
  for(let f=0;f<6;f++){ const s=shades[f];
    for(let v=0;v<4;v++){ const i=f*4+v; col[i*3]=s; col[i*3+1]=s; col[i*3+2]=s; } }
  geo.setAttribute('color', new THREE.BufferAttribute(col,3));
}
paintFaceShading(boxGeo, [0.82,0.82,1.0,0.5,0.7,0.7]);
paintFaceShading(pickupGeo, [0.85,0.85,1.0,0.55,0.75,0.75]);
const _aoCol=new THREE.Color(); // reused for per-instance AO tint
const glowLights=[]; // pooled point lights for nearby glowstone
const glowSet=new Set(); // "x,y,z" of placed glowstone blocks
const cloudMats=[]; // cloud materials (tinted by time of day)
const haloPool=[]; let haloMat=null; // additive glow halos on nearby lamps
let glowTick=0, blobTex=null, glowSpriteTex=null;
const dummy=new THREE.Object3D();
const moveState={forward:false,backward:false,left:false,right:false};
const velocity=new THREE.Vector3(); const direction=new THREE.Vector3();
let prevTime=performance.now(), canJump=false, lastChunkUpdate=0, stepAcc=0, hungerTick=0, saveTick=0, netTick=0, minimapTick=0;
let outlineTick=0, clockCache='', autoQTier=0, autoQCooldown=0, lowFpsTime=0, highFpsTime=0;
const particleGeo=new THREE.BoxGeometry(0.12,0.12,0.12);
const particleMatCache=new Map();
const GRAV=30, JUMP=12, SPEED=4.4, FLY_SPEED=9, RADIUS=0.42, HEIGHT=1.7, REACH=7;

/* ---------- persistence ---------- */
const SAVE_KEY='voxel-verse-v2-save';
function saveGame(){
  try{
    const ov={}; overrides.forEach((v,k)=>{ ov[k]=v; });
    localStorage.setItem(SAVE_KEY, JSON.stringify({ seed:Settings.seed, time:State.time, day:State.day,
      pos:[camera.position.x,camera.position.y,camera.position.z], inv:State.inventory, overrides:ov, mode:Settings.mode, diff:Settings.difficulty, hb:State.hotbar }));
  }catch(e){}
}
function loadGame(){
  try{ const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null'); if(!s) return null;
    if(s.seed!==undefined){ Settings.seed=s.seed; $('world-seed').value=s.seed; }
    Object.entries(s.overrides||{}).forEach(([k,v])=>{ overrides.set(k,v);
      if(v===BLOCK.GLOW) glowSet.add(k); });
    State.time=s.time??0.32; State.day=s.day??1; State.inventory=s.inv||{};
    if(s.mode){ Settings.mode=s.mode; const om=$('opt-mode'); if(om) om.value=s.mode; }
    if(s.diff){ Settings.difficulty=s.diff; const od=$('opt-diff'); if(od) od.value=s.diff; }
    if(Array.isArray(s.hb)&&s.hb.length===9&&s.hb.every(b=>BLOCK_DEF[b])) State.hotbar=[...s.hb];
    return s;
  }catch(e){ return null; }
}

/* ---------- world gen ---------- */
function heightAt(wx,wz){
  const s1=perlin.noise(wx*0.028, wz*0.028, 0);
  const s2=perlin.noise(wx*0.09+100, wz*0.09+100, 0)*0.35;
  const m=perlin.noise(wx*0.008+500, wz*0.008+500, 0); // mountain mask
  let h=Math.floor((s1+1)*0.5*14 + (s2+1)*0.5*4 + Math.max(0,m)*10);
  return clamp(h, 1, MAXH);
}
function worldKey(x,y,z){ return `${x},${y},${z}`; }
function getOverride(x,y,z){ const k=worldKey(x,y,z); return overrides.has(k)?overrides.get(k):undefined; } // undefined = no override
function rawBlock(x,y,z){
  const ov=getOverride(x,y,z); if(ov!==undefined) return ov; // may be null
  const h=heightAt(x,z);
  if(y===-5) return BLOCK.BEDROCK;
  if(y<-5) return null;
  if(y<=h){
    if(y===h){ if(y<=SEA+1) return BLOCK.SAND; if(y>=16) return BLOCK.SNOW; return BLOCK.GRASS; }
    if(y>h-4) return BLOCK.DIRT; return BLOCK.STONE;
  }
  if(y<=SEA) return BLOCK.WATER;
  return null;
}
function getBlock(x,y,z){
  const ix=Math.round(x),iy=Math.round(y),iz=Math.round(z);
  const cx=Math.floor(ix/CHUNK),cz=Math.floor(iz/CHUNK);
  const ch=chunks.get(`${cx},${cz}`);
  if(ch){ const rx=ix-cx*CHUNK, rz=iz-cz*CHUNK; const v=ch.blocks.get(`${rx},${iy},${rz}`); if(v!==undefined||ch.generated) return v??null; }
  return rawBlock(ix,iy,iz);
}
function setBlock(x,y,z,type,opts={}){
  const ix=Math.round(x),iy=Math.round(y),iz=Math.round(z);
  overrides.set(worldKey(ix,iy,iz), type);
  trackGlow(ix,iy,iz,type);
  const cx=Math.floor(ix/CHUNK),cz=Math.floor(iz/CHUNK);
  const ch=chunks.get(`${cx},${cz}`);
  if(ch){ const rx=ix-cx*CHUNK, rz=iz-cz*CHUNK;
    if(type===null) ch.blocks.delete(`${rx},${iy},${rz}`); else ch.blocks.set(`${rx},${iy},${rz}`,type);
    ch.build();
    // rebuild neighbours at borders
    if(rx===0) chunks.get(`${cx-1},${cz}`)?.build();
    if(rx===CHUNK-1) chunks.get(`${cx+1},${cz}`)?.build();
    if(rz===0) chunks.get(`${cx},${cz-1}`)?.build();
    if(rz===CHUNK-1) chunks.get(`${cx},${cz+1}`)?.build();
  }
  if(!opts.silent){ AudioSys.place(); spawnBreakParticles(ix,iy,iz,type??BLOCK.DIRT,6); }
  if(!opts.remote) Net.broadcastBlock(ix,iy,iz,type);
  saveTick=0.4; // debounce-ish
}
function isOpaque(t){ return t!==null&&t!==undefined&&BLOCK_DEF[t]?.opaque; }

/* ---------- chunk ---------- */
class Chunk{
  constructor(cx,cz){ this.cx=cx; this.cz=cz; this.blocks=new Map(); this.meshes=[]; this.mobs=[]; this.generated=false; this.generate(); this.generated=true; this.build(); }
  generate(){
    for(let x=0;x<CHUNK;x++) for(let z=0;z<CHUNK;z++){
      const wx=this.cx*CHUNK+x, wz=this.cz*CHUNK+z;
      const h=heightAt(wx,wz);
      for(let y=-5;y<=Math.max(h,SEA);y++){
        let t=null;
        if(y===-5) t=BLOCK.BEDROCK;
        else if(y<=h){ if(y===h){ t = y<=SEA+1?BLOCK.SAND:(y>=16?BLOCK.SNOW:BLOCK.GRASS); } else if(y>h-4) t=BLOCK.DIRT; else t=BLOCK.STONE; }
        else if(y<=SEA) t=BLOCK.WATER;
        const ov=getOverride(wx,y,wz); if(ov!==undefined) t=ov;
        if(t!==null&&t!==undefined) this.blocks.set(`${x},${y},${z}`,t);
      }
      // trees + flowers
      const surfH=h; const topOv=getOverride(wx,surfH,wz);
      const top=(topOv!==undefined?topOv:this.blocks.get(`${x},${surfH},${z}`));
      if(top===BLOCK.GRASS && getOverride(wx,surfH+1,wz)===undefined){
        const r=Math.random();
        if(r>0.985 && Math.abs(wx)+Math.abs(wz)>6){ const th=3+randi(0,2);
          for(let i=1;i<=th;i++) this.blocks.set(`${x},${surfH+i},${z}`,BLOCK.WOOD);
          for(let dx=-2;dx<=2;dx++) for(let dz=-2;dz<=2;dz++) for(let dy=0;dy<=1;dy++){
            if(Math.abs(dx)===2&&Math.abs(dz)===2&&dy===1) continue;
            const k=`${x+dx},${surfH+th+dy},${z+dz}`;
            if(!this.blocks.has(k)&&!(dx===0&&dz===0&&dy===0)) this.blocks.set(k,BLOCK.LEAVES);
          }
          this.blocks.set(`${x},${surfH+th+2},${z}`,BLOCK.LEAVES);
        }
      }
    }
  }
  build(){
    this.meshes.forEach(m=>{ chunkMeshes.remove(m); m.dispose&&m.dispose(); }); this.meshes=[];
    const byType=BLOCK_DEF.map(()=>[]);
    for(const [key,t] of this.blocks){
      const [sx,sy,sz]=key.split(',').map(Number);
      const wx=this.cx*CHUNK+sx, wy=sy, wz=this.cz*CHUNK+sz;
      let shade=1;
      // cull fully-hidden opaque blocks (reuse neighbour samples for cheap AO)
      if(isOpaque(t)){
        const xp=isOpaque(rawBlock(wx+1,wy,wz)), xn=isOpaque(rawBlock(wx-1,wy,wz));
        const yp=isOpaque(rawBlock(wx,wy+1,wz)), yn=isOpaque(rawBlock(wx,wy-1,wz));
        const zp=isOpaque(rawBlock(wx,wy,wz+1)), zn=isOpaque(rawBlock(wx,wy,wz-1));
        if(xp&&xn&&yp&&yn&&zp&&zn) continue;
        // fake sky light + bounce: covered blocks go dark, crevices get graded
        shade = yp ? 0.55 : 1.0;
        shade -= ((xp?1:0)+(xn?1:0)+(zp?1:0)+(zn?1:0))*0.06;
        if(wy<SEA) shade-=0.08; // underwater murk
        shade=Math.max(0.35,shade);
      }
      byType[t].push([wx,wy,wz,shade]);
    }
    byType.forEach((list,ti)=>{
      if(!list.length) return;
      const mesh=new THREE.InstancedMesh(boxGeo, materials[ti], list.length);
      list.forEach((p,i)=>{ dummy.position.set(p[0],p[1],p[2]); dummy.rotation.set(0,0,0); dummy.updateMatrix(); mesh.setMatrixAt(i,dummy.matrix);
        if(mesh.setColorAt) mesh.setColorAt(i, _aoCol.setScalar(p[3])); });
      if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true; mesh.castShadow=ti!==BLOCK.WATER; mesh.receiveShadow=true;
      mesh.userData.blockType=ti;
      this.meshes.push(mesh); chunkMeshes.add(mesh);
    });
  }
  dispose(){ this.meshes.forEach(m=>{chunkMeshes.remove(m); m.dispose();}); this.meshes=[]; this.mobs.forEach(m=>m.dispose()); this.mobs=[]; this.blocks.clear(); }
}

/* Line-of-sight through voxels: stepped sample, opaque blocks stop sight.
   Used so mobs can't hit you through walls. Only called on attack attempts. */
function hasLOS(ax,ay,az,bx,by,bz){
  const dx=bx-ax, dy=by-ay, dz=bz-az;
  const dist=Math.sqrt(dx*dx+dy*dy+dz*dz);
  const steps=Math.max(2,Math.ceil(dist/0.4));
  for(let i=1;i<steps;i++){
    const t=i/steps;
    const b=getBlock(ax+dx*t, ay+dy*t, az+dz*t);
    if(b!==null&&b!==undefined&&BLOCK_DEF[b].opaque) return false;
  }
  return true;
}

/* ---------- mobs ---------- */
const MOBDEF={
  pig:{color:0xf4a7c3,scale:0.85,speed:1.6,hp:10,hostile:false,name:'Pig'},
  cow:{color:0x7a5230,scale:1.0,speed:1.1,hp:14,hostile:false,name:'Cow'},
  sheep:{color:0xe8e8e8,scale:0.9,speed:1.3,hp:8,hostile:false,name:'Sheep'},
  zombie:{color:0x3f7a3f,scale:1.0,speed:2.6,hp:20,hostile:true,name:'Zombie',dmg:3},
  skeleton:{color:0xd8d8d8,scale:0.95,speed:2.2,hp:16,hostile:true,name:'Skeleton',dmg:2},
};
const mobs=[];
class Mob{
  constructor(x,y,z,key){ this.key=key; this.def=MOBDEF[key];
    this.pos=new THREE.Vector3(x,y,z); this.vel=new THREE.Vector3();
    this.hp=this.def.hp; this.maxHp=this.def.hp;
    this.dir=new THREE.Vector3(rand(-1,1),0,rand(-1,1)).normalize();
    this.timer=rand(1,3); this.moving=false; this.flash=0; this.dead=false;
    this.atkCd=0; // per-mob attack cooldown — without this, contact = 180 dps instant death
    const g=new THREE.Group();
    const mat=new THREE.MeshLambertMaterial({color:this.def.color});
    this.bodyMat=mat;
    const body=new THREE.Mesh(new THREE.BoxGeometry(this.def.scale,this.def.scale,this.def.scale*1.2),mat);
    body.position.y=this.def.scale/2; body.castShadow=true; g.add(body); this.body=body;
    const head=new THREE.Mesh(new THREE.BoxGeometry(this.def.scale*0.7,this.def.scale*0.6,this.def.scale*0.6),mat);
    head.position.set(0,this.def.scale*1.15,this.def.scale*0.55); head.castShadow=true; g.add(head);
    if(this.def.hostile){ const e1=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,0.05),new THREE.MeshBasicMaterial({color:0xff2222})); e1.position.set(-0.15,this.def.scale*1.2,this.def.scale*0.86); g.add(e1);
      const e2=e1.clone(); e2.position.x=0.15; g.add(e2); }
    g.position.copy(this.pos); scene.add(g); mobGroup.add(g); this.mesh=g;
    // soft contact blob: grounds the mob even where shadow-map res is coarse
    this.blob=new THREE.Sprite(new THREE.SpriteMaterial({map:ensureBlobTex(),transparent:true,opacity:0.35,depthWrite:false}));
    this.blob.scale.set(this.def.scale*1.6,this.def.scale*1.6,1);
    scene.add(this.blob);
  }
  hurt(dmg,from){ if(this.dead) return; this.hp-=dmg; this.flash=0.15; AudioSys.hit();
    const d=this.pos.clone().sub(from); d.y=0; d.normalize(); this.vel.addScaledVector(d,5); this.vel.y=4;
    spawnBreakParticles(this.pos.x,this.pos.y+0.6,this.pos.z,BLOCK.GRASS,8);
    if(this.hp<=0) this.kill(); }
  kill(){ this.dead=true; AudioSys.pop();
    spawnBreakParticles(this.pos.x,this.pos.y+0.6,this.pos.z,BLOCK.DIRT,16);
    // drops
    if(!this.def.hostile){ spawnPickup(this.pos.x,this.pos.y+1,this.pos.z, Math.random()<0.5?BLOCK.GRASS:BLOCK.DIRT, 'food'); }
    else { if(Math.random()<0.6) spawnPickup(this.pos.x,this.pos.y+1,this.pos.z,BLOCK.GLOW,'bone'); State.xp+=5; }
    scene.remove(this.mesh); mobGroup.remove(this.mesh);
    if(this.blob){ scene.remove(this.blob); this.blob.material.dispose(); this.blob=null; }
  }
  dispose(){ scene.remove(this.mesh); mobGroup.remove(this.mesh);
    if(this.blob){ scene.remove(this.blob); this.blob.material.dispose(); this.blob=null; } }
  update(dt){
    if(this.dead) return;
    this.flash=Math.max(0,this.flash-dt); this.bodyMat.emissive=new THREE.Color(this.flash>0?0x881111:0x000000);
    const pp=camera.position; const dist=this.pos.distanceTo(pp);
    const night=State.time<0.22||State.time>0.78;
    if(this.def.hostile){
      this.atkCd-=dt;
      const canHunt=Settings.difficulty!=='peaceful';
      if(canHunt&&dist<24&&(night||this.key==='skeleton')){ this.dir.copy(pp).sub(this.pos); this.dir.y=0; this.dir.normalize(); this.moving=true;
        // fair melee: 0.9s cooldown + must actually see you (no wall-hits)
        if(dist<1.8&&!State.dead&&this.atkCd<=0){
          if(hasLOS(this.pos.x,this.pos.y+0.9,this.pos.z, camera.position.x,camera.position.y-0.3,camera.position.z)){
            this.atkCd=0.9;
            const d=Math.max(1,Math.round(this.def.dmg*dmgScale()));
            Dbg.log('MOB',`${this.key} melee -${d} @${dist.toFixed(1)}m LOS-ok`);
            damagePlayer(d, this.def.name); this.vel.y=3;
          }
        }
      } else { this.timer-=dt; if(this.timer<=0){ this.timer=rand(1,3); this.moving=Math.random()>0.5; if(this.moving) this.dir.set(rand(-1,1),0,rand(-1,1)).normalize(); } }
      if(!night&&this.key==='zombie'&&Math.random()<dt*0.2){ this.hurt(2,this.pos.clone().add(new THREE.Vector3(0,5,0))); } // burn in sun
    } else {
      this.timer-=dt;
      if(this.timer<=0){ this.timer=rand(1,4); this.moving=Math.random()>0.4; if(this.moving) this.dir.set(rand(-1,1),0,rand(-1,1)).normalize(); }
      if(dist<6&&Math.random()<dt*0.5){ this.dir.copy(this.pos).sub(pp); this.dir.y=0; this.dir.normalize(); this.moving=true; } // shy
    }
    this.vel.y-=GRAV*dt;
    const sp=this.def.speed*(this.moving?1:0);
    const vx=this.dir.x*sp, vz=this.dir.z*sp;
    // X
    this.pos.x+=vx*dt; if(collide(this.pos,RADIUS*this.def.scale,this.def.scale+0.4,false)){ this.pos.x-=vx*dt; this.dir.multiplyScalar(-1); if(this.vel.y===0)this.vel.y=7; }
    this.pos.z+=vz*dt; if(collide(this.pos,RADIUS*this.def.scale,this.def.scale+0.4,false)){ this.pos.z-=vz*dt; this.dir.multiplyScalar(-1); if(this.vel.y===0)this.vel.y=7; }
    this.pos.y+=this.vel.y*dt;
    if(collide(this.pos,RADIUS*this.def.scale,this.def.scale+0.4,true)){ if(this.vel.y<0){ this.pos.y-=this.vel.y*dt; this.vel.y=0; } else { this.pos.y-=this.vel.y*dt; this.vel.y=0; } }
    if(this.pos.y<-30){ this.pos.y=30; this.vel.y=0; }
    this.mesh.position.copy(this.pos);
    if(this.moving) this.mesh.rotation.y=Math.atan2(this.dir.x,this.dir.z);
    this.body.position.y=this.def.scale/2+Math.abs(Math.sin(performance.now()*0.01))*(this.moving?0.12:0.02);
    // blob shadow: snap to ground below, fade with height/distance
    if(this.blob){
      const bx=Math.round(this.pos.x), bz=Math.round(this.pos.z);
      let gy=null;
      for(let y=Math.floor(this.pos.y);y>this.pos.y-8;y--){ const b=getBlock(bx,y,bz);
        if(b!==null&&b!==undefined&&!BLOCK_DEF[b].liquid){ gy=y+1.03; break; } }
      const dCam=this.pos.distanceTo(camera.position);
      if(gy===null||dCam>48){ this.blob.visible=false; }
      else{
        const hAbove=Math.max(0,this.pos.y-gy);
        this.blob.visible=true;
        this.blob.position.set(this.pos.x,gy,this.pos.z);
        this.blob.material.opacity=clamp(0.38-hAbove*0.09,0,0.38)*(dCam>30?0.5:1);
      }
    }
  }
}

/* ---------- pickups & particles ---------- */
const pickups=[];
function spawnPickup(x,y,z,block,food){
  const m=new THREE.Mesh(pickupGeo, materials[block]||materials[0]);
  m.position.set(x,y,z); scene.add(m); pickupGroup.add(m);
  pickups.push({mesh:m,block,food,vel:new THREE.Vector3(rand(-2,2),5,rand(-2,2)),life:60});
}
function updatePickups(dt){
  for(let i=pickups.length-1;i>=0;i--){ const p=pickups[i]; p.life-=dt;
    p.vel.y-=GRAV*0.6*dt; p.mesh.position.addScaledVector(p.vel,dt); p.mesh.rotation.y+=dt*3; p.mesh.rotation.x+=dt*2;
    const d=p.mesh.position.distanceTo(camera.position);
    if(d<3){ p.mesh.position.lerp(new THREE.Vector3(camera.position.x,camera.position.y-0.4,camera.position.z),dt*6); }
    if(d<1.1||p.life<=0){
      if(d<1.4){
        if(p.food==='food'){ heal(4); toast('🍎 +4 HP (yummy!)'); AudioSys.eat(); }
        else { addItem(p.block,1); AudioSys.pop(); }
      }
      scene.remove(p.mesh); pickupGroup.remove(p.mesh); pickups.splice(i,1);
    }
  }
}
const particles=[];
function particleMatFor(block){
  if(!particleMatCache.has(block)){
    const col=new THREE.Color(BLOCK_DEF[block]?.color??0xffffff);
    particleMatCache.set(block,new THREE.MeshBasicMaterial({color:col}));
  }
  return particleMatCache.get(block);
}
function spawnBreakParticles(x,y,z,block,n=10){
  if(particles.length>220) return; // cap for perf
  const mat=particleMatFor(block??0);
  const count = Settings.pixelRatio<1.2 ? Math.ceil(n*0.6) : n; // fewer particles on low quality
  for(let i=0;i<count;i++){
    const m=new THREE.Mesh(particleGeo, mat);
    m.position.set(x+rand(-0.3,0.3),y+rand(-0.3,0.3),z+rand(-0.3,0.3));
    scene.add(m); particleGroup.add(m);
    particles.push({mesh:m,vel:new THREE.Vector3(rand(-3,3),rand(2,6),rand(-3,3)),life:rand(0.4,0.9)});
  }
}
function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.life-=dt;
    p.vel.y-=12*dt; p.mesh.position.addScaledVector(p.vel,dt);
    const s=Math.max(0.3,p.life); p.mesh.scale.set(s,s,s);
    if(p.life<=0){ scene.remove(p.mesh); particleGroup.remove(p.mesh); particles.splice(i,1); } }
}

/* ---------- collision ---------- */
function collide(pos,r,h,legs){
  const step=0.5;
  const minY=(pos.y-h)+(legs?0:step), maxY=pos.y;
  const x0=Math.round(pos.x-r),x1=Math.round(pos.x+r),y0=Math.round(minY),y1=Math.round(maxY),z0=Math.round(pos.z-r),z1=Math.round(pos.z+r);
  for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++) for(let z=z0;z<=z1;z++){ const b=getBlock(x,y,z); if(b!==null&&b!==undefined&&!BLOCK_DEF[b].liquid) return true; }
  return false;
}

/* ---------- player damage/heal ---------- */
/* ---------- diagnostics: damage/death event log ----------
   Every hit, death and respawn is recorded with full context so mystery
   deaths can be traced. Shown on the death screen, mirrored to console. */
const Dbg={ events:[], max:80,
  log(type,msg){
    this.events.push({t:performance.now()/1000, day:State.day, type, msg});
    if(this.events.length>this.max) this.events.shift();
    try{ console.log(`[VV:${type}]`,msg); }catch(e){}
  },
  ctx(){
    let hn=0, hd=Infinity, hk='';
    if(typeof mobs!=='undefined') for(const m of mobs){
      if(!m.dead&&m.def.hostile){ const d=m.pos.distanceTo(camera.position); hn++; if(d<hd){ hd=d; hk=m.key; } }
    }
    const p=camera.position;
    return `@(${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}) HP${State.health}/${State.maxHealth} Hu${State.hunger} ${Settings.difficulty}${State.prot>0?' PROT'+State.prot.toFixed(1):''}${State.headInWater?' HEADWATER':State.inWater?' INWATER':''} vy${(typeof velocity!=='undefined'?velocity.y:0).toFixed(1)} hostiles:${hn}${hn?` near:${hk}@${hd.toFixed(1)}m`:''}`;
  },
  text(){ return this.events.map(e=>`D${e.day} T+${e.t.toFixed(1)}s [${e.type}] ${e.msg}`).join('\n')||'(empty)'; }
};
let lastHitTimer=0;
function flashLastHit(src,n){
  const el=$('last-hit'); if(!el) return;
  el.textContent=`💔 -${n} ${src}`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(lastHitTimer); lastHitTimer=setTimeout(()=>el.classList.remove('show'),2600);
}
function renderDeathLog(){
  const el=$('death-log'); if(!el) return;
  const lines=Dbg.events.slice(-14).map(e=>`D${e.day} T+${e.t.toFixed(1)}s [${e.type}] ${e.msg}`);
  el.textContent=lines.join('\n')||'No events logged.';
  el.scrollTop=el.scrollHeight;
}
function damagePlayer(n,src){
  if(State.dead||State.creative||!State.started) return;
  if(State.prot>0){ Dbg.log('BLOCK',`${src} ${n} blocked by spawn protection`); return; } // spawn protection
  const hp0=State.health;
  State.health-=n; AudioSys.hurt();
  $('damage-vignette').classList.add('hit'); setTimeout(()=>$('damage-vignette').classList.remove('hit'),250);
  renderVitals(); flashLastHit(src,n);
  Dbg.log('DMG',`-${n} ${src} · HP ${hp0}→${Math.max(0,State.health)} · ${Dbg.ctx()}`);
  if(State.health<=0){ State.health=0; die(src); }
}
function heal(n){ State.health=clamp(State.health+n,0,State.maxHealth); renderVitals(); }
/* difficulty: peaceful = no hostile spawns, no mob damage; easy = half damage */
function dmgScale(){ return Settings.difficulty==='peaceful'?0:Settings.difficulty==='easy'?0.5:1; }
function clearHostiles(range){
  let n=0;
  for(let i=mobs.length-1;i>=0;i--){ const m=mobs[i];
    if(m.def.hostile&&m.pos.distanceTo(camera.position)<range){
      spawnBreakParticles(m.pos.x,m.pos.y+0.8,m.pos.z,BLOCK.GLOW,10);
      m.dispose(); mobs.splice(i,1); n++;
    } }
  return n;
}
function die(src){
  State.dead=true; document.exitPointerLock&&document.exitPointerLock();
  $('inventory-panel').classList.add('hidden'); if(dragOp) endItemDrag(true);
  Dbg.log('DEATH',`${src} killed you · ${Dbg.ctx()}`);
  $('death-msg').textContent=`${src||'The void'} got you. Day ${State.day}. Respawning keeps your buildings!`;
  $('death-screen').classList.remove('hidden'); renderDeathLog(); AudioSys.blip(80,0.6,'sawtooth',0.2,-40);
}

/* ---------- inventory ---------- */
function addItem(block,n=1){ State.inventory[block]=(State.inventory[block]||0)+n; renderToolbar(); if(invOpen()&&!dragOp) renderInvPanel(); }
function takeItem(block,n=1){ if(State.creative) return true; if((State.inventory[block]||0)>=n){ State.inventory[block]-=n; renderToolbar(); if(invOpen()&&!dragOp) renderInvPanel(); return true; } return false; }
function countItem(b){ return State.creative?'∞':(State.inventory[b]||0); }

/* ---------- sky / env ---------- */
let _skyCol=new THREE.Color(), _dayCol=new THREE.Color(0x87ceeb), _duskCol=new THREE.Color(0xff9a56), _nightCol=new THREE.Color(0x060a1a);
// sky-dome gradient stops (authored as final sRGB — the dome shader bypasses tone mapping)
const _topCol=new THREE.Color(), _horCol=new THREE.Color(), _cloudCol=new THREE.Color();
const _dayTop=new THREE.Color(0x2f7fe0), _dayHor=new THREE.Color(0xaad9f2);
const _duskTop=new THREE.Color(0x2a3a6e), _duskHor=new THREE.Color(0xff9a56);
const _nightTop=new THREE.Color(0x02030a), _nightHor=new THREE.Color(0x0d1626);
const _cloudDay=new THREE.Color(0xffffff), _cloudDusk=new THREE.Color(0xffc4a3), _cloudNight=new THREE.Color(0x2a3550);
let _waterT=0;
function updateSky(dt){
  State.time=(State.time+dt/600)%1; // 10-min day
  if(State.time<0.005) { State.day++; toast(`☀️ Day ${State.day} — you survived!`); AudioSys.level(); }
  const t=State.time, ang=(t-0.25)*Math.PI*2; // sunrise t=0.25
  const sunH=Math.sin(ang), dayF=clamp(sunH*1.5+0.25,0,1);
  const night=1-dayF;
  const sunDir=new THREE.Vector3(Math.cos(ang),Math.max(0.12,sunH),0.35).normalize();
  // snap shadow frustum to a 2m grid so shadows don't shimmer as you walk
  const tx=Math.round(camera.position.x/2)*2, ty=Math.round(camera.position.y/2)*2, tz=Math.round(camera.position.z/2)*2;
  sunLight.target.position.set(tx,ty,tz);
  sunLight.position.set(tx,ty,tz).addScaledVector(sunDir,90);
  sunLight.intensity=0.12+dayF*0.95;
  sunLight.color.setHSL(0.1,0.45+ (1-dayF)*0.2,0.5+dayF*0.5);
  // moon fill from the opposite side: nights keep their shape
  moonLight.position.set(tx,ty,tz).addScaledVector(sunDir,-70);
  moonLight.target.position.set(tx,ty,tz);
  moonLight.intensity=night*0.35;
  hemi.intensity=0.3+dayF*0.55;
  hemi.color.setHSL(0.58,0.5,0.35+dayF*0.5);
  hemi.groundColor.setHSL(0.08,0.45,0.18+dayF*0.18+(dayF<0.35?(0.35-dayF)*0.35:0)); // warm ground bounce at dusk
  ambLight.intensity=0.16+dayF*0.14;
  // sky-dome gradient (replaces the old flat background color)
  let top=_topCol.copy(_dayTop), hor=_horCol.copy(_dayHor);
  if(dayF<0.35){ const k=1-dayF/0.35; top.lerp(_duskTop,k); hor.lerp(_duskHor,k); }
  top.lerp(_nightTop, night*0.9); hor.lerp(_nightHor, night*0.9);
  if(skyU){
    skyU.topColor.value.copy(top); skyU.horizonColor.value.copy(hor);
    skyU.sunDir.value.copy(sunDir);
    skyU.sunColor.value.setHSL(0.11,0.75,clamp(0.55+ (1-dayF)*0.15,0,0.75));
    skyU.sunI.value=clamp(sunH*1.5+0.3,0,1);
    skyU.moonDir.value.copy(sunDir).negate();
    skyU.nightF.value=night;
    skyDome.position.copy(camera.position);
  }
  scene.fog.color.copy(hor); // fog melts into the horizon
  scene.fog.near=24+dayF*10; scene.fog.far=90+dayF*30-night*20;
  sunMesh.position.set(camera.position.x+Math.cos(ang)*300, sunH*300, camera.position.z-200);
  if(sunGlow){ sunGlow.position.copy(sunMesh.position); sunGlow.material.opacity=clamp(sunH+0.2,0,0.55); }
  moonMesh.position.set(camera.position.x-Math.cos(ang)*300, -sunH*300, camera.position.z+200);
  stars.material.opacity=night*0.9;
  stars.position.set(camera.position.x,0,camera.position.z);
  stars.rotation.y+=dt*0.005;
  // clouds pick up dusk pink / night blue
  _cloudCol.copy(_cloudDay);
  if(dayF<0.35) _cloudCol.lerp(_cloudDusk, 1-dayF/0.35);
  _cloudCol.lerp(_cloudNight, night*0.9);
  for(const cm of cloudMats) cm.color.copy(_cloudCol);
  // water shimmer + night glow
  _waterT+=dt;
  for(const m of waterMats){ if(m.map) m.map.offset.set((_waterT*0.03)%1,(_waterT*0.015)%1); m.opacity=0.62+Math.sin(_waterT*2)*0.06; m.emissiveIntensity=0.3+night*0.5; }
  // torch glow: warm light at night or when holding glowstone (with flame flicker)
  if(torchLight){
    const holdingGlow=State.hotbar[State.activeBlock]===BLOCK.GLOW;
    const target=clamp(night*0.9+(holdingGlow?0.8:0)+(State.headInWater?0:0),0,1.4);
    const flick=0.9+0.1*Math.sin(_waterT*13)+0.05*Math.sin(_waterT*29+1.7);
    torchLight.intensity+=(target*flick-torchLight.intensity)*Math.min(1,dt*4);
    torchLight.position.set(camera.position.x,camera.position.y+0.3,camera.position.z);
  }
  // pooled glowstone lights (throttled — world scan)
  glowTick-=dt; if(glowTick<=0){ glowTick=0.4; updateGlowLights(night); }
  // underwater tint
  const uw=$('underwater'); if(uw) uw.style.opacity=State.headInWater?1:0;
  // clouds drift (follow player to avoid popping)
  if(cloudsMesh&&cloudsMesh.visible){ cloudsMesh.position.set(camera.position.x+((_waterT*1.2)%200)-100,0,camera.position.z); }
  if(cloudsMesh2&&cloudsMesh2.visible){ cloudsMesh2.position.set(camera.position.x-((_waterT*0.7)%200)+100,0,camera.position.z+40); }
  // clock UI (throttled: only on minute change)
  const hh=Math.floor(((t+0.25)%1)*24), mm=Math.floor((((t+0.25)%1)*24%1)*60);
  const icon=(sunH>0?'☀':'🌙');
  const clk=`${icon} Day ${State.day} — ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
  if(clk!==clockCache){ clockCache=clk; $('clock').textContent=clk; }
  // spawn hostiles at night (never in peaceful)
  if(Settings.difficulty!=='peaceful'&&night>0.7&&mobs.length<14&&Math.random()<dt*0.35){
    const a=rand(0,Math.PI*2), r=rand(14,22);
    const x=Math.round(camera.position.x+Math.cos(a)*r), z=Math.round(camera.position.z+Math.sin(a)*r);
    const y=heightAt(x,z)+1;
    if(getBlock(x,y,z)===null){ mobs.push(new Mob(x+0.5,y,z+0.5, Math.random()<0.6?'zombie':'skeleton')); }
  }
  // despawn far mobs
  for(let i=mobs.length-1;i>=0;i--){ const m=mobs[i]; if(m.dead||m.pos.distanceTo(camera.position)>70){ m.dispose(); mobs.splice(i,1); } }
}
/* ---------- lighting rig helpers ---------- */
function refreshShadowMaterials(){
  // toggling shadowMap.enabled needs a material recompile to take effect reliably
  scene.traverse(o=>{ if(o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.needsUpdate=true); } });
}
function setShadows(on){
  Settings.shadows=on; sunLight.castShadow=on; renderer.shadowMap.enabled=on;
  refreshShadowMaterials();
  const cb=$('opt-shadows'); if(cb) cb.checked=on;
}
function setShadowSize(s){
  if(!sunLight||sunLight.shadow.mapSize.x===s) return;
  sunLight.shadow.mapSize.set(s,s);
  if(sunLight.shadow.map){ sunLight.shadow.map.dispose(); sunLight.shadow.map=null; }
}
function setLowFx(on){ document.body.classList.toggle('lowfx',!!on); }
function trackGlow(ix,iy,iz,type){
  const k=ix+','+iy+','+iz;
  if(type===BLOCK.GLOW) glowSet.add(k); else glowSet.delete(k);
}
function updateGlowLights(nightF){
  // nearest ≤4 glowstone blocks get a real light; throttled by caller
  const px=camera.position.x, py=camera.position.y, pz=camera.position.z;
  const R2=26*26;
  let cand = glowSet.size>600 ? [...glowSet].filter((_,i)=>i%3===0) : [...glowSet];
  const best=[];
  for(const k of cand){
    const o=k.indexOf(','), o2=k.indexOf(',',o+1);
    const x=+k.slice(0,o), y=+k.slice(o+1,o2), z=+k.slice(o2+1);
    const dx=x-px, dy=y-py, dz=z-pz, d2=dx*dx+dy*dy+dz*dz;
    if(d2>R2) continue;
    best.push([d2,x,y,z]);
  }
  best.sort((a,b)=>a[0]-b[0]);
  const base=0.45+nightF*1.0;
  glowLights.forEach((L,i)=>{
    if(best[i]){
      L.position.set(best[i][1]+0.5,best[i][2]+0.6,best[i][3]+0.5);
      L.intensity=base*(0.9+0.1*Math.sin(_waterT*11+i*2.1)+0.05*Math.sin(_waterT*23+i*1.3));
    } else L.intensity=0;
  });
  // additive halos ride on the same scan — lamps visibly bloom at night
  if(haloMat) haloMat.opacity=0.12+nightF*0.45;
  haloPool.forEach((s,i)=>{
    if(best[i]){ s.visible=true; s.position.set(best[i][1]+0.5,best[i][2]+0.7,best[i][3]+0.5); }
    else s.visible=false;
  });
}
function ensureGlowSpriteTex(){
  if(glowSpriteTex) return glowSpriteTex;
  const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d');
  const grad=g.createRadialGradient(64,64,4,64,64,64);
  grad.addColorStop(0,'rgba(255,220,150,1)'); grad.addColorStop(0.35,'rgba(255,180,90,0.45)'); grad.addColorStop(1,'rgba(255,150,50,0)');
  g.fillStyle=grad; g.fillRect(0,0,128,128);
  glowSpriteTex=new THREE.CanvasTexture(c); glowSpriteTex.encoding=THREE.sRGBEncoding; return glowSpriteTex;
}
/* Gradient sky dome shader: day/dusk/night blend, sun disc + corona,
   moon glow, horizon haze. One draw call, follows the camera. */
function createSkyDome(){
  skyU={
    topColor:{value:new THREE.Color(0x2f7fe0)},
    horizonColor:{value:new THREE.Color(0xaad9f2)},
    sunDir:{value:new THREE.Vector3(0,1,0)},
    sunColor:{value:new THREE.Color(0xffdf9e)},
    sunI:{value:1},
    moonDir:{value:new THREE.Vector3(0,-1,0)},
    nightF:{value:0},
  };
  const mat=new THREE.ShaderMaterial({
    uniforms:skyU, side:THREE.BackSide, depthWrite:false, fog:false,
    vertexShader:`varying vec3 vDir;
      void main(){ vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`varying vec3 vDir;
      uniform vec3 topColor, horizonColor, sunColor;
      uniform vec3 sunDir, moonDir;
      uniform float sunI, nightF;
      void main(){
        vec3 d=normalize(vDir);
        float h=d.y;
        vec3 col;
        if(h>=0.0){ col=mix(horizonColor, topColor, pow(h,0.55)); }
        else { col=mix(horizonColor, horizonColor*0.3, clamp(-h*4.0,0.0,1.0)); }
        float s=max(dot(d,normalize(sunDir)),0.0);
        float disc=smoothstep(0.99925,0.99965,s);
        col+=sunColor*disc*2.0*sunI;
        col+=sunColor*pow(s,600.0)*0.6*sunI;
        col+=sunColor*pow(s,10.0)*0.18*sunI;
        float m=max(dot(d,normalize(moonDir)),0.0);
        col+=vec3(0.55,0.65,1.0)*pow(m,800.0)*1.2*nightF;
        col+=vec3(0.4,0.5,0.9)*pow(m,24.0)*0.12*nightF;
        col+=horizonColor*pow(1.0-abs(h),6.0)*0.35;
        gl_FragColor=vec4(col,1.0);
      }`,
  });
  skyDome=new THREE.Mesh(new THREE.SphereGeometry(800,24,16), mat);
  skyDome.frustumCulled=false; skyDome.renderOrder=-10;
  scene.add(skyDome);
}
function ensureBlobTex(){
  if(blobTex) return blobTex;
  const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d');
  const grad=g.createRadialGradient(32,32,4,32,32,30);
  grad.addColorStop(0,'rgba(0,0,0,0.55)'); grad.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=grad; g.fillRect(0,0,64,64);
  blobTex=new THREE.CanvasTexture(c); return blobTex;
}
/* ---------- auto quality ---------- */
function autoQualityTick(dt, fps){
  if(Settings.quality!=='auto') return;
  autoQCooldown-=dt;
  if(fps<42){ lowFpsTime+=dt; highFpsTime=0; } else if(fps>57){ highFpsTime+=dt; lowFpsTime=0; } else { lowFpsTime=0; highFpsTime=0; }
  if(lowFpsTime>2.5&&autoQCooldown<=0){
    lowFpsTime=0; autoQCooldown=4;
    if(autoQTier===0&&Settings.pixelRatio>1.25){ Settings.pixelRatio=1.25; renderer.setPixelRatio(Settings.pixelRatio); toast('⚡ Auto-quality: resolution lowered for smooth FPS'); }
    else if(autoQTier===1&&Settings.pixelRatio>1){ Settings.pixelRatio=1; renderer.setPixelRatio(Settings.pixelRatio); toast('⚡ Auto-quality: resolution lowered'); }
    else if(autoQTier>=2&&Settings.shadows){ setShadows(false); setLowFx(true); toast('⚡ Auto-quality: shadows off (toggle in menu)'); }
    autoQTier++;
  } else if(highFpsTime>12&&autoQCooldown<=0&&autoQTier>0){
    // step back up slowly
    highFpsTime=0; autoQCooldown=8; autoQTier--;
    if(autoQTier===1){ Settings.pixelRatio=1.25; renderer.setPixelRatio(Settings.pixelRatio); }
    if(autoQTier===0){ Settings.pixelRatio=Math.min(devicePixelRatio||1,1.5); renderer.setPixelRatio(Settings.pixelRatio); }
  }
}

/* ---------- coop net (BroadcastChannel + PeerJS) ---------- */
const Net={
  bc:null, peer:null, conns:new Map(), room:null, isHost:false,
  init(){
    try{ this.bc=new BroadcastChannel('voxel-verse-v2'); this.bc.onmessage=e=>this.onMsg(e.data,'local'); }catch(e){}
    setInterval(()=>{ if(State.started&&!State.dead) this.broadcast({t:'pos',id:State.playerId,name:State.playerName,color:State.playerColor,x:+camera.position.x.toFixed(2),y:+camera.position.y.toFixed(2),z:+camera.position.z.toFixed(2)}); },120);
  },
  broadcast(m){ try{ this.bc&&this.bc.postMessage(m); }catch(e){}
    this.conns.forEach(c=>{ try{ c.open&&c.send(m); }catch(e){} }); },
  broadcastBlock(x,y,z,type){ this.broadcast({t:'block',id:State.playerId,x,y,z,type}); },
  sendChat(text){ const m={t:'chat',id:State.playerId,name:State.playerName,text}; this.broadcast(m); chatAdd(State.playerName+' (you)',text,true); },
  onMsg(m,src){
    if(!m||m.id===State.playerId) return;
    if(m.t==='pos') RemotePlayers.update(m);
    else if(m.t==='block'){ setBlock(m.x,m.y,m.z,m.type,{remote:true,silent:true}); }
    else if(m.t==='chat'){ chatAdd(m.name||'Friend', m.text); AudioSys.pop(); }
    else if(m.t==='hello'){ RemotePlayers.update(m); this.broadcast({t:'pos',id:State.playerId,name:State.playerName,color:State.playerColor,x:camera.position.x,y:camera.position.y,z:camera.position.z}); }
  },
  host(code){
    this.room=code; this.isHost=true;
    $('coop-info').textContent='Hosting room '+code+' …';
    try{
      this.peer=new Peer('voxel-verse-'+code);
      this.peer.on('open',()=>{ $('coop-info').textContent='✅ Hosting! Share code: '+code; $('coop-status').innerHTML=`🟢 Room <b>${code}</b> (host)`; toast('Hosting room '+code); });
      this.peer.on('connection',c=>{ c.on('data',d=>this.onMsg(d,'peer')); c.on('open',()=>{ this.conns.set(c.peer,c); c.send({t:'hello',id:State.playerId,name:State.playerName,color:State.playerColor,x:camera.position.x,y:camera.position.y,z:camera.position.z}); }); });
      this.peer.on('error',e=>{ $('coop-info').textContent='Peer error: '+e.type+' (local-tab co-op still works)'; });
    }catch(e){ $('coop-info').textContent='P2P unavailable, local-tab co-op still works.'; }
  },
  join(code){
    this.room=code; this.isHost=false;
    $('coop-info').textContent='Joining '+code+' …';
    try{
      this.peer=new Peer();
      this.peer.on('open',()=>{
        const c=this.peer.connect('voxel-verse-'+code,{reliable:true});
        c.on('open',()=>{ this.conns.set(c.peer,c); $('coop-info').textContent='✅ Joined room '+code; $('coop-status').innerHTML=`🟢 Room <b>${code}</b> (guest)`; toast('Joined room '+code); c.send({t:'hello',id:State.playerId,name:State.playerName,color:State.playerColor,x:camera.position.x,y:camera.position.y,z:camera.position.z}); });
        c.on('data',d=>this.onMsg(d,'peer'));
        c.on('error',()=>{ $('coop-info').textContent='Could not reach host (is their tab open?). Local-tab co-op still works.'; });
      });
      this.peer.on('error',e=>{ $('coop-info').textContent='Join failed ('+e.type+'). Host must click HOST first.'; });
    }catch(e){ $('coop-info').textContent='P2P unavailable.'; }
  }
};
const RemotePlayers={
  map:new Map(),
  update(m){
    let r=this.map.get(m.id);
    if(!r){
      const g=new THREE.Group();
      const col=new THREE.Color(m.color||'#55ccff');
      const body=new THREE.Mesh(new THREE.BoxGeometry(0.6,1.0,0.35),new THREE.MeshLambertMaterial({color:col}));
      body.position.y=0.5; body.castShadow=true; g.add(body);
      const head=new THREE.Mesh(new THREE.BoxGeometry(0.45,0.45,0.45),new THREE.MeshLambertMaterial({color:0xf2c89b}));
      head.position.y=1.25; g.add(head);
      const cv=document.createElement('canvas'); cv.width=256; cv.height=64; const cx=cv.getContext('2d');
      cx.fillStyle='rgba(0,0,0,0.6)'; cx.fillRect(0,0,256,64); cx.fillStyle='#fff'; cx.font='bold 32px sans-serif'; cx.textAlign='center'; cx.fillText((m.name||'Friend').slice(0,12),128,42);
      const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),depthTest:false})); sp.scale.set(2.4,0.6,1); sp.position.y=2.0; g.add(sp);
      scene.add(g); remoteGroup.add(g);
      r={mesh:g,last:performance.now()}; this.map.set(m.id,r); this.renderList();
    }
    r.mesh.position.set(m.x,m.y-1.6,m.z); r.last=performance.now(); r.name=m.name;
    // face local player
    r.mesh.lookAt(camera.position.x, r.mesh.position.y, camera.position.z);
  },
  renderList(){
    const el=$('player-list'); el.innerHTML=`<div>🙂 ${escapeHtml(State.playerName)} (you)</div>`+[...this.map.values()].map(r=>`<div>🧑 ${escapeHtml(r.name||'Friend')}</div>`).join('');
  },
  prune(){ const now=performance.now(); let changed=false;
    for(const [id,r] of this.map){ if(now-r.last>8000){ scene.remove(r.mesh); remoteGroup.remove(r.mesh); this.map.delete(id); changed=true; } }
    if(changed) this.renderList(); }
};
/* helper bot */
let bot=null;
function spawnBot(){
  if(bot){ toast('Bot already helping!'); return; }
  bot=new Mob(camera.position.x+2, camera.position.y+1, camera.position.z+2, 'sheep');
  bot.isBot=true; bot.hp=9999; bot.def={...bot.def, hostile:false, speed:3.4};
  bot.bodyMat.color.set(0x55ccff);
  toast('🤖 Helper bot joined! It follows you and glows at night.');
  chatAdd('BOT','Woof! I mean… beep! I follow you. 🐾');
}

/* ---------- UI renders ---------- */
function renderToolbar(){
  const tb=$('toolbar'); tb.innerHTML='';
  State.hotbar.forEach((b,i)=>{
    const d=document.createElement('div'); d.className='block-slot'+(i===State.activeBlock?' active':'');
    d.dataset.slot=i;
    d.style.backgroundImage=`url(${blockIcon(b)})`;
    d.innerHTML=`<span class="k">${i+1}</span><span class="t">${BLOCK_DEF[b].name}</span><span class="n">${countItem(b)}</span>`;
    d.title=BLOCK_DEF[b].name+' — click to select, drag to reorder';
    d.onpointerdown=e=>beginItemDrag(e,{kind:'hotbar',idx:i,block:b});
    tb.appendChild(d);
  });
}
/* ---------- GUI drag & drop (custom pointer engine: mouse + touch) ---------- */
let dragOp=null;
const invOpen=()=>!$('inventory-panel').classList.contains('hidden');
function beginItemDrag(e,payload){
  if(e.pointerType==='mouse'&&e.button!==0) return;
  e.preventDefault(); e.stopPropagation();
  const noDrag=payload.kind==='panel'&&!State.creative&&((State.inventory[payload.block]||0)<=0);
  dragOp={...payload,sx:e.clientX,sy:e.clientY,active:false,ghost:null,over:null,noDrag};
}
function dropTargetAt(x,y){
  const el=document.elementFromPoint(x,y); if(!el) return null;
  const s=el.closest?el.closest('[data-slot]'):null;
  if(s) return {kind:'hotbar',idx:+s.dataset.slot,el:s}; // hotbar slots live in the toolbar AND the inventory panel
  return null;
}
function clearDragHL(){ document.querySelectorAll('.drop-target').forEach(el=>el.classList.remove('drop-target')); }
function validDropTarget(op,t){
  if(!t||t.kind!=='hotbar') return false;
  if(op.kind==='hotbar') return true;
  return State.creative||((State.inventory[op.block]||0)>0);
}
function applyDrop(op,t){
  if(op.kind==='hotbar'&&t.kind==='hotbar'){
    if(op.idx!==t.idx){ const h=State.hotbar; [h[op.idx],h[t.idx]]=[h[t.idx],h[op.idx]]; toast('🔀 Swapped slots'); }
    State.activeBlock=t.idx;
  } else if(op.kind==='panel'&&t.kind==='hotbar'){
    State.hotbar[t.idx]=op.block; State.activeBlock=t.idx;
    toast(`✅ ${BLOCK_DEF[op.block].name} → slot ${t.idx+1}`);
  }
  renderToolbar(); if(invOpen()) renderInvPanel(); saveGame(); AudioSys.blip(700,0.06,'square',0.08);
}
function clickSlot(op){
  if(op.kind==='hotbar'){ State.activeBlock=op.idx; renderToolbar(); if(invOpen()) renderInvPanel(); AudioSys.blip(500+op.idx*60,0.05,'square',0.08); }
  else if(State.creative||((State.inventory[op.block]||0)>0)){
    State.hotbar[State.activeBlock]=op.block; renderToolbar(); renderInvPanel(); saveGame();
    AudioSys.blip(700,0.06,'square',0.08); toast(`✅ ${BLOCK_DEF[op.block].name} → slot ${State.activeBlock+1}`);
  } else { toast(`Need ${BLOCK_DEF[op.block].name}! Mine some first ⛏️`); AudioSys.blip(140,0.15,'square',0.12); }
}
function endItemDrag(cancelled){
  if(!dragOp) return; const op=dragOp; dragOp=null;
  if(op.ghost) op.ghost.remove(); clearDragHL();
  if(cancelled||!State.started) return;
  if(op.active){ if(op.over) applyDrop(op,op.over); }
  else clickSlot(op);
}
function setInventoryOpen(open){
  const will=open===undefined?!invOpen():open;
  if(will===invOpen()) return;
  if(will){
    if(!State.started||State.dead) return;
    renderInvPanel(); $('inventory-panel').classList.remove('hidden');
    if(document.pointerLockElement&&document.exitPointerLock) document.exitPointerLock();
    AudioSys.blip(600,0.06,'square',0.08);
  } else {
    $('inventory-panel').classList.add('hidden'); if(dragOp) endItemDrag(true);
    if(State.started&&!State.dead&&!isTouch){ try{controls.lock();}catch(e){} }
  }
}
function renderInvPanel(){
  const g=$('inv-grid'); if(!g) return;
  $('inv-sub').textContent=State.creative?'∞ everything':'counts update as you mine';
  // hotbar row inside the panel: this is the reliable rearrange surface on desktop,
  // where pointer-lock means the bottom toolbar has no cursor to drag with
  const hr=$('inv-hotbar-row'); hr.innerHTML='';
  State.hotbar.forEach((b,i)=>{
    const d=document.createElement('div'); d.className='block-slot'+(i===State.activeBlock?' active':'');
    d.dataset.slot=i; d.style.backgroundImage=`url(${blockIcon(b)})`;
    d.innerHTML=`<span class="k">${i+1}</span><span class="t">${BLOCK_DEF[b].name}</span><span class="n">${countItem(b)}</span>`;
    d.title=BLOCK_DEF[b].name+' — drag to move, click to select';
    d.onpointerdown=e=>beginItemDrag(e,{kind:'hotbar',idx:i,block:b});
    hr.appendChild(d);
  });
  g.innerHTML='';
  BLOCK_DEF.forEach((def,b)=>{
    const empty=!State.creative&&(State.inventory[b]||0)<=0;
    const c=document.createElement('div'); c.className='inv-cell'+(empty?' empty':'');
    c.dataset.inv=b; c.style.backgroundImage=`url(${blockIcon(b)})`;
    c.innerHTML=`<span class="n">${countItem(b)}</span><span class="t">${def.name}</span>`;
    c.title=def.name+(empty?' (none left)':' — drag to hotbar or click to assign');
    c.onpointerdown=e=>beginItemDrag(e,{kind:'panel',block:b});
    g.appendChild(c);
  });
}
const _iconCache={};
function blockIcon(b){
  if(_iconCache[b]) return _iconCache[b];
  const c=document.createElement('canvas'); c.width=c.height=48; const g=c.getContext('2d');
  g.fillStyle='#'+BLOCK_DEF[b].color.toString(16).padStart(6,'0'); g.fillRect(0,0,48,48);
  for(let i=0;i<60;i++){ g.fillStyle='rgba(0,0,0,0.15)'; g.fillRect(randi(0,47),randi(0,47),2,2); }
  if(b===BLOCK.GRASS){ g.fillStyle='#5fd35f'; g.fillRect(0,0,48,14); }
  if(b===BLOCK.BRICK){ g.strokeStyle='rgba(255,255,255,.6)'; for(let y=12;y<48;y+=12){g.beginPath();g.moveTo(0,y);g.lineTo(48,y);g.stroke();} }
  if(b===BLOCK.GLASS){ g.strokeStyle='#fff'; g.lineWidth=4; g.strokeRect(2,2,44,44); g.fillStyle='rgba(255,255,255,.25)'; g.fillRect(0,0,48,48); }
  if(b===BLOCK.GLOW){ g.fillStyle='#fff8b0'; g.fillRect(10,10,28,28); }
  if(b===BLOCK.WATER){ g.fillStyle='rgba(255,255,255,.3)'; for(let y=6;y<48;y+=12) g.fillRect(0,y,48,2); }
  return _iconCache[b]=c.toDataURL();
}
function renderVitals(){
  $('hearts').innerHTML='❤️'.repeat(Math.ceil(State.health/2))+'🖤'.repeat(Math.floor((State.maxHealth-State.health)/2));
  $('hunger').innerHTML='🍖'.repeat(Math.ceil(State.hunger/2))+'▫️'.repeat(Math.floor((20-State.hunger)/2));
}
function drawMinimap(){
  const c=$('minimap'), g=c.getContext('2d'); const R=8, px=Math.round(camera.position.x), pz=Math.round(camera.position.z);
  const S=132, cell=S/(2*R+1);
  g.fillStyle='#06121f'; g.fillRect(0,0,S,S);
  for(let dx=-R;dx<=R;dx++) for(let dz=-R;dz<=R;dz++){
    const x=px+dx, z=pz+dz; let col='#0a1520';
    // scan down from a clamped top: most columns resolve in 2-4 steps
    for(let y=Math.min(MAXH+6,Math.ceil(camera.position.y)+8);y>=-5;y--){ const b=getBlock(x,y,z); if(b===BLOCK.WATER){ col='#3b6df6'; break; } if(b!==null&&b!==undefined){ col='#'+BLOCK_DEF[b].color.toString(16).padStart(6,'0'); break; } }
    // shade by height for depth
    g.fillStyle=col; g.fillRect((dx+R)*cell, (dz+R)*cell, cell+0.5, cell+0.5);
  }
  // player arrow (rotates with yaw)
  g.save(); g.translate(66,66); g.rotate(-State.yaw||0);
  g.fillStyle='#ffe14d'; g.beginPath(); g.moveTo(0,-6); g.lineTo(4,4); g.lineTo(-4,4); g.closePath(); g.fill(); g.restore();
  // mobs dots
  g.fillStyle='#ff5555'; mobs.forEach(m=>{ const dx=m.pos.x-px, dz=m.pos.z-pz; if(Math.abs(dx)<R&&Math.abs(dz)<R) g.fillRect(66+dx*(S/(2*R+1))-1,66+dz*(S/(2*R+1))-1,3,3); });
}

/* ---------- interaction ---------- */
function raycastCenter(maxDist=REACH){
  raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
  const hits=raycaster.intersectObjects(chunkMeshes.children);
  if(hits.length&&hits[0].distance<=maxDist) return hits[0];
  return null;
}
function updateOutline(force=false){
  if(!force && outlineTick>0) return;
  outlineTick=0.08; // ~12Hz instead of 60Hz
  // yaw for minimap arrow
  const e=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ'); State.yaw=e.y;
  const hit=raycastCenter();
  if(hit){
    const mesh=hit.object; mesh.getMatrixAt(hit.instanceId,dummy.matrix);
    dummy.matrix.decompose(dummy.position,dummy.quaternion,dummy.scale);
    blockOutline.visible=true; blockOutline.position.set(Math.round(dummy.position.x),Math.round(dummy.position.y),Math.round(dummy.position.z));
    // subtle pulse on highlight
    const s=1.02+Math.sin(performance.now()*0.008)*0.015; blockOutline.scale.set(s,s,s);
    const lbl=$('block-highlight-label'); lbl.style.display='block'; lbl.textContent=BLOCK_DEF[mesh.userData.blockType]?.name||'';
  } else { blockOutline.visible=false; $('block-highlight-label').style.display='none'; }
}
function tryBreak(){
  // block raycast FIRST: a mob only wins the click if it's actually in front of the block
  // (old order let mobs steal clicks — and hits — through walls)
  const hit=raycastCenter();
  const blockDist=hit?hit.distance:Infinity;
  raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
  const mh=raycaster.intersectObjects(mobGroup.children,true);
  if(mh.length&&mh[0].distance<blockDist){
    let o=mh[0].object, root=o;
    while(root.parent&&root.parent!==scene&&root.parent!==mobGroup) root=root.parent;
    const mob=mobs.find(m=>m.mesh===root||m.mesh.children.includes(o)||root===m.mesh);
    const target=mob||mobs.sort((a,b)=>a.pos.distanceTo(camera.position)-b.pos.distanceTo(camera.position))[0];
    if(target&&target.pos.distanceTo(camera.position)<4.5){ target.hurt(State.creative?100:4, camera.position); if(bot) bot.hurt(0,camera.position); return; }
  }
  if(!hit) return;
  const mesh=hit.object; mesh.getMatrixAt(hit.instanceId,dummy.matrix);
  dummy.matrix.decompose(dummy.position,dummy.quaternion,dummy.scale);
  const bx=Math.round(dummy.position.x),by=Math.round(dummy.position.y),bz=Math.round(dummy.position.z);
  const b=getBlock(bx,by,bz);
  if(b===BLOCK.BEDROCK&&!State.creative){ toast('🪨 Bedrock is unbreakable!'); return; }
  if(b===null||b===undefined) return;
  AudioSys.break(); spawnBreakParticles(bx,by,bz,b,12);
  setBlock(bx,by,bz,null);
  if(!State.creative&&b!==BLOCK.WATER){ addItem(b,1); if(b===BLOCK.GRASS&&Math.random()<0.12){ heal(2); toast('🍎 You found an apple! +2 HP'); } }
  State.hunger=Math.max(0,State.hunger-0.15); renderVitals();
}
function tryPlace(){
  const hit=raycastCenter(); if(!hit) return;
  const mesh=hit.object; mesh.getMatrixAt(hit.instanceId,dummy.matrix);
  dummy.matrix.decompose(dummy.position,dummy.quaternion,dummy.scale);
  const bx=Math.round(dummy.position.x),by=Math.round(dummy.position.y),bz=Math.round(dummy.position.z);
  const n=hit.face?hit.face.normal:new THREE.Vector3(0,1,0);
  const tx=bx+Math.round(n.x),ty=by+Math.round(n.y),tz=bz+Math.round(n.z);
  const p=camera.position;
  if(Math.abs(tx-p.x)<0.9&&Math.abs(tz-p.z)<0.9&&ty<Math.ceil(p.y)&&ty>Math.ceil(p.y)-2.2) return; // don't suffocate
  const block=State.hotbar[State.activeBlock];
  if(getBlock(tx,ty,tz)!==null&&getBlock(tx,ty,tz)!==undefined) return;
  if(!takeItem(block,1)){ toast(`Need ${BLOCK_DEF[block].name}! Mine some first ⛏️`); AudioSys.blip(140,0.15,'square',0.12); return; }
  setBlock(tx,ty,tz,block);
}

/* ---------- chunk streaming ---------- */
function updateChunks(){
  const px=camera.position.x, pz=camera.position.z;
  const ccx=Math.floor(px/CHUNK), ccz=Math.floor(pz/CHUNK);
  const R=Settings.renderDist, active=new Set();
  for(let x=-R;x<=R;x++) for(let z=-R;z<=R;z++){
    if(x*x+z*z>R*R+2) continue;
    const k=`${ccx+x},${ccz+z}`; active.add(k);
    if(!chunks.has(k)) chunks.set(k,new Chunk(ccx+x,ccz+z));
  }
  for(const [k,c] of chunks){ if(!active.has(k)){ c.dispose(); chunks.delete(k); } }
  // passive mob trickle
  if(mobs.length<10&&Math.random()<0.06){
    const a=rand(0,Math.PI*2), r=rand(8,20);
    const x=Math.round(px+Math.cos(a)*r), z=Math.round(pz+Math.sin(a)*r), h=heightAt(x,z);
    if(getBlock(x,h,z)===BLOCK.GRASS&&getBlock(x,h+1,z)===null){ mobs.push(new Mob(x+0.5,h+1,z+0.5, pick(['pig','pig','cow','sheep','chicken'].filter(k=>MOBDEF[k]) .length?pick(['pig','cow','sheep']):'pig'))); }
  }
}

/* ---------- init ---------- */
function init(){
  scene=new THREE.Scene(); scene.background=new THREE.Color(0x87ceeb); scene.fog=new THREE.Fog(0x87ceeb,24,110);
  camera=new THREE.PerspectiveCamera(Settings.fov,innerWidth/innerHeight,0.08,1200);
  camera.position.set(8,30,8);
  hemi=new THREE.HemisphereLight(0xcfe8ff,0x6b5b3e,0.8); scene.add(hemi);
  ambLight=new THREE.AmbientLight(0xffffff,0.25); scene.add(ambLight);
  sunLight=new THREE.DirectionalLight(0xffffff,0.9); sunLight.position.set(50,100,50);
  sunLight.castShadow=Settings.shadows;
  sunLight.shadow.mapSize.set(Settings.quality==='high'?2048:1024,Settings.quality==='high'?2048:1024);
  sunLight.shadow.camera.left=-36; sunLight.shadow.camera.right=36; sunLight.shadow.camera.top=36; sunLight.shadow.camera.bottom=-36;
  sunLight.shadow.camera.near=10; sunLight.shadow.camera.far=220;
  sunLight.shadow.bias=-0.0004; sunLight.shadow.normalBias=0.5;
  scene.add(sunLight); scene.add(sunLight.target);
  // cool moon fill so nights have shape instead of flat black (no shadow cost)
  moonLight=new THREE.DirectionalLight(0x8fb4ff,0); scene.add(moonLight); scene.add(moonLight.target);
  torchLight=new THREE.PointLight(0xffb45e,0,18,1.6); scene.add(torchLight);
  // pooled warm lights for nearby glowstone (real local GI feel, capped count)
  for(let i=0;i<4;i++){ const L=new THREE.PointLight(0xffa63e,0,15,2); scene.add(L); glowLights.push(L); }
  renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Settings.pixelRatio); renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=Settings.shadows; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  // filmic pipeline: linear lighting -> ACES -> sRGB (textures decoded as sRGB below)
  renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.12;
  createSkyDome();
  $('game-root').appendChild(renderer.domElement);
  controls=new SimplePointerLockControls(camera,document.body);
  raycaster=new THREE.Raycaster(); raycaster.far=REACH;
  chunkMeshes=new THREE.Group(); mobGroup=new THREE.Group(); pickupGroup=new THREE.Group(); particleGroup=new THREE.Group(); remoteGroup=new THREE.Group();
  scene.add(chunkMeshes); scene.add(mobGroup); scene.add(pickupGroup); scene.add(particleGroup); scene.add(remoteGroup);

  // block materials with richer pixel textures
  const texOpts=[{top:'#62d862',noise:130}, {noise:130}, {noise:130}, {waves:true,noise:60}, {noise:120}, {rings:true,noise:80}, {noise:140}, {noise:50}, {noise:150}, {noise:60},{frame:true,noise:20},{mortar:true,noise:90},{spark:70,noise:60}, {spark:30,noise:120}];
  BLOCK_DEF.forEach((d,i)=>{
    const map=makePixelTexture(d.color,texOpts[i]||{});
    map.wrapS=map.wrapT=THREE.RepeatWrapping;
    map.encoding=THREE.sRGBEncoding;
    let m;
    if(d.name==='Water'){
      // phong water: sun glints + night visibility via slight emissive
      m=new THREE.MeshPhongMaterial({map, vertexColors:true, transparent:true, opacity:0.66,
        shininess:90, specular:new THREE.Color(0x88bbff),
        emissive:new THREE.Color(0x0a2038), emissiveIntensity:0.35});
      waterMats.push(m);
    } else {
      m=new THREE.MeshLambertMaterial({map, vertexColors:true});
      if(d.name==='Glass'){ m.transparent=true; m.opacity=0.45; }
      if(d.name==='Leaves'){ m.transparent=true; m.opacity=0.92; m.alphaTest=0.2; m.side=THREE.DoubleSide; }
      if(d.name==='Glow'){ m.emissive=new THREE.Color(0xcc8a1a); m.emissiveIntensity=0.9; }
    }
    materials.push(m);
  });

  // sun/moon/glow/stars/clouds
  sunMesh=new THREE.Mesh(new THREE.SphereGeometry(14,12,12),new THREE.MeshBasicMaterial({color:0xffe14d,fog:false})); sunMesh.visible=false; scene.add(sunMesh); // hidden: sky-dome shader draws the sun
  { const gc=document.createElement('canvas'); gc.width=gc.height=128; const gg=gc.getContext('2d');
    const grad=gg.createRadialGradient(64,64,8,64,64,64); grad.addColorStop(0,'rgba(255,225,77,0.9)'); grad.addColorStop(0.4,'rgba(255,200,60,0.35)'); grad.addColorStop(1,'rgba(255,200,60,0)');
    gg.fillStyle=grad; gg.fillRect(0,0,128,128);
    const gtex=new THREE.CanvasTexture(gc); gtex.encoding=THREE.sRGBEncoding;
    sunGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:gtex,transparent:true,opacity:0.5,fog:false,depthWrite:false})); sunGlow.scale.set(90,90,1); scene.add(sunGlow); }
  moonMesh=new THREE.Mesh(new THREE.SphereGeometry(10,12,12),new THREE.MeshBasicMaterial({color:0xe8ecff,fog:false})); moonMesh.visible=false; scene.add(moonMesh); // hidden: dome draws the moon glow
  { const g=new THREE.BufferGeometry(), pos=[]; for(let i=0;i<600;i++){ const a=rand(0,Math.PI*2),e=rand(0.05,Math.PI/2),r=700; pos.push(Math.cos(a)*Math.cos(e)*r,Math.sin(e)*r,Math.sin(a)*Math.cos(e)*r); }
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    stars=new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:2.2,sizeAttenuation:false,transparent:true,opacity:0,fog:false,depthWrite:false})); stars.frustumCulled=false; scene.add(stars); }
  function makeClouds(count,op,y0,y1){
    const cg=new THREE.BoxGeometry(6,1.5,4); const cm=new THREE.MeshLambertMaterial({color:0xffffff,transparent:true,opacity:op});
    cloudMats.push(cm);
    const im=new THREE.InstancedMesh(cg,cm,count);
    for(let i=0;i<count;i++){ dummy.position.set(rand(-100,100),rand(y0,y1),rand(-100,100)); const s=rand(0.7,1.8); dummy.scale.set(s,1,s*0.8); dummy.rotation.set(0,0,0); dummy.updateMatrix(); im.setMatrixAt(i,dummy.matrix); }
    dummy.scale.set(1,1,1);
    im.instanceMatrix.needsUpdate=true; im.visible=Settings.clouds; im.frustumCulled=false; scene.add(im); return im;
  }
  cloudsMesh=makeClouds(50,0.7,38,48); cloudsMesh2=makeClouds(30,0.45,44,54);
  // additive halos that sit on nearby glowstone lamps
  haloMat=new THREE.SpriteMaterial({map:ensureGlowSpriteTex(),transparent:true,opacity:0.4,blending:THREE.AdditiveBlending,depthWrite:false});
  for(let i=0;i<6;i++){ const s=new THREE.Sprite(haloMat); s.scale.set(3,3,1); s.visible=false; scene.add(s); haloPool.push(s); }
  blockOutline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.04,1.04,1.04)),new THREE.LineBasicMaterial({color:0xffe14d})); blockOutline.visible=false; scene.add(blockOutline);

  bindInputs();
  Net.init();
  const saved=loadGame();
  perlin=new Perlin(Settings.seed);
  State.inventory={0:32,1:16,2:8,5:8,9:8,10:4,11:4,12:4,4:8};
  if(saved&&saved.inv) State.inventory={...State.inventory,...saved.inv};
  if(saved&&saved.pos&&saved.pos[1]>-10){ camera.position.set(saved.pos[0],saved.pos[1]+1,saved.pos[2]); }
  else { const h=heightAt(8,8); camera.position.set(8.5,h+3,8.5); }
  State.creative=Settings.mode==='creative';
  if(State.creative) State.fly=true;
  renderToolbar(); renderVitals(); updateChunks();
  animate();
}

/* ---------- inputs ---------- */
let chatOpen=false;
function bindInputs(){
  document.addEventListener('keydown',e=>{
    if(chatOpen){ if(e.code==='Enter') submitChat(); if(e.code==='Escape') closeChat(); e.stopPropagation(); return; }
    switch(e.code){
      case 'KeyW': case 'ArrowUp': moveState.forward=true; break;
      case 'KeyS': case 'ArrowDown': moveState.backward=true; break;
      case 'KeyA': case 'ArrowLeft': moveState.left=true; break;
      case 'KeyD': case 'ArrowRight': moveState.right=true; break;
      case 'ShiftLeft': case 'ShiftRight': State.sprint=true; break;
      case 'Space':
        if(State.fly){ velocity.y=FLY_SPEED*0.7; }
        else if(canJump){ velocity.y=JUMP; canJump=false; AudioSys.blip(300,0.08,'sine',0.08,150); }
        if(e.repeat===false){ const now=performance.now(); if(now-(bindInputs._lastSpace||0)<280&&State.creative){ State.fly=!State.fly; toast(State.fly?'🕊️ Fly ON':'🚶 Fly OFF'); } bindInputs._lastSpace=now; }
        e.preventDefault(); break;
      case 'KeyF': State.fly=!State.fly; toast(State.fly?'🕊️ Fly ON (Space up / C down... actually Space/Ctrl)':'🚶 Fly OFF'); break;
      case 'KeyE': eatFood(); break;
      case 'KeyI': if(!State.started) break; setInventoryOpen(); break;
      case 'Escape': if(dragOp){ endItemDrag(true); break; } if(invOpen()){ setInventoryOpen(false); break; } break;
      case 'KeyQ': setBlock(Math.round(camera.position.x),Math.round(camera.position.y-1),Math.round(camera.position.z),BLOCK.GLOW); break;
      case 'KeyT': openChat(); e.preventDefault(); break;
      case 'KeyC': $('coop-modal').classList.toggle('hidden'); break;
      case 'KeyM': drawMinimap(); toast('🗺️ You are here (yellow dot)'); break;
      case 'KeyH': $('howto').classList.toggle('hidden'); if(!State.started) return; break;
      case 'Slash': if(!State.started) break; openChat(); e.preventDefault(); break;
    }
    if(e.code.startsWith('Digit')){ const n=+e.code.slice(5); if(n>=1&&n<=9){ State.activeBlock=n-1; renderToolbar(); } }
    if(e.code==='Enter'&&!State.started) startGame();
  });
  document.addEventListener('keyup',e=>{ switch(e.code){
    case 'KeyW': case 'ArrowUp': moveState.forward=false; break;
    case 'KeyS': case 'ArrowDown': moveState.backward=false; break;
    case 'KeyA': case 'ArrowLeft': moveState.left=false; break;
    case 'KeyD': case 'ArrowRight': moveState.right=false; break;
    case 'ShiftLeft': case 'ShiftRight': State.sprint=false; break;
    case 'Space': if(State.fly) velocity.y=0; break;
  }});
  document.addEventListener('mousedown',e=>{
    if(!State.started||!controls.isLocked&&!isTouch) return;
    if(e.button===0) tryBreak(); else if(e.button===2) tryPlace();
  });
  document.addEventListener('contextmenu',e=>e.preventDefault());
  document.addEventListener('wheel',e=>{ if(!State.started) return; State.activeBlock=(State.activeBlock+(e.deltaY>0?1:8))%9; renderToolbar(); },{passive:true});
  addEventListener('resize',()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });
  // menu buttons
  $('btn-play').onclick=startGame;
  $('btn-how').onclick=()=>$('howto').classList.toggle('hidden');
  $('btn-new-world').onclick=()=>{ Settings.seed=randi(1,99999); $('world-seed').value=Settings.seed; perlin=new Perlin(Settings.seed); overrides.clear(); glowSet.clear(); State.hotbar=[...HOTBAR]; renderToolbar(); chunks.forEach(c=>c.dispose()); chunks.clear(); mobs.forEach(m=>m.dispose()); mobs.length=0; updateChunks(); const h=heightAt(8,8); camera.position.set(8.5,h+3,8.5); toast('🌍 New world! Seed '+Settings.seed); };
  $('btn-host').onclick=()=>{ const code=($('room-code').value||randCode()).toUpperCase(); $('room-code').value=code; Net.host(code); };
  $('btn-join').onclick=()=>{ const code=($('room-code').value||'').toUpperCase(); if(!code){ toast('Enter a room code first'); return; } Net.join(code); };
  $('btn-copy-link').onclick=()=>{ const code=$('room-code').value||'????'; const txt=`Join my Voxel Verse room! Code: ${code} — open Voxel Verse, press C, enter code, JOIN.`; navigator.clipboard&&navigator.clipboard.writeText(txt); toast('📋 Invite copied!'); };
  $('btn-spawn-bot').onclick=()=>{ spawnBot(); $('coop-modal').classList.add('hidden'); };
  $('btn-coop-close').onclick=()=>$('coop-modal').classList.add('hidden');
  $('btn-respawn').onclick=()=>{ State.dead=false; State.health=State.maxHealth; State.hunger=20; renderVitals(); $('death-screen').classList.add('hidden'); const h=heightAt(Math.round(camera.position.x),Math.round(camera.position.z)); camera.position.y=h+3; velocity.set(0,0,0); const cleared=clearHostiles(24); State.prot=3; Dbg.log('RESPAWN',`cleared ${cleared} hostiles · PROT 3s · ${Dbg.ctx()}`); toast(cleared?`✨ Respawned! 🛡️ 3s protection · cleared ${cleared} hostile${cleared>1?'s':''}`:'✨ Respawned! 🛡️ 3s protection'); };
  $('btn-copy-log').onclick=()=>{ const txt=Dbg.text(); const done=()=>toast('📋 Log copied — paste it to Matt');
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done,()=>fallbackCopy(txt,done));
    else fallbackCopy(txt,done); };
  $('chat-input').addEventListener('keydown',e=>{ if(e.code==='Enter') submitChat(); e.stopPropagation(); });
  controls.addEventListener('lock',()=>{ $('menu').classList.add('hidden'); });
  controls.addEventListener('unlock',()=>{ if(State.started&&!State.dead&&!isTouch&&chatOpen===false){ /* keep playing, show menu only on Esc-hold? show small menu */ } });
  document.addEventListener('pointerlockchange',()=>{ if(!document.pointerLockElement&&State.started&&!isTouch&&!State.dead&&!chatOpen&&!invOpen()){ $('menu').classList.remove('hidden'); } });
  $('menu').addEventListener('click',e=>{ if(e.target===$('menu')&&State.started){ $('menu').classList.add('hidden'); controls.lock(); } });
  $('btn-inv').onclick=e=>{ e.stopPropagation(); setInventoryOpen(); };
  $('btn-inv-close').onclick=e=>{ e.stopPropagation(); setInventoryOpen(false); };
  window.addEventListener('pointermove',e=>{
    if(!dragOp||dragOp.noDrag) return;
    if(!dragOp.active){
      if(Math.hypot(e.clientX-dragOp.sx,e.clientY-dragOp.sy)<10) return;
      dragOp.active=true;
      const g=document.createElement('div'); g.className='drag-ghost';
      g.style.backgroundImage=`url(${blockIcon(dragOp.block)})`;
      g.style.left=dragOp.sx+'px'; g.style.top=dragOp.sy+'px';
      document.body.appendChild(g); dragOp.ghost=g;
    }
    dragOp.ghost.style.left=e.clientX+'px'; dragOp.ghost.style.top=e.clientY+'px';
    const t=dropTargetAt(e.clientX,e.clientY);
    dragOp.over=(t&&validDropTarget(dragOp,t))?t:null;
    clearDragHL(); if(dragOp.over&&dragOp.over.el) dragOp.over.el.classList.add('drop-target');
  });
  window.addEventListener('pointerup',()=>endItemDrag(false));
  window.addEventListener('pointercancel',()=>endItemDrag(true));
  initTouch();
  // settings live
  $('opt-sens').oninput=e=>Settings.sens=+e.target.value;
  $('opt-render').onchange=e=>{ Settings.renderDist=+e.target.value; updateChunks(); };
  $('opt-shadows').onchange=e=>{ setShadows(e.target.checked); if(e.target.checked){ autoQTier=0; setLowFx(false); } };
  $('opt-clouds').onchange=e=>{ Settings.clouds=e.target.checked; if(cloudsMesh)cloudsMesh.visible=Settings.clouds; if(cloudsMesh2)cloudsMesh2.visible=Settings.clouds; };
  $('opt-sound').onchange=e=>{ Settings.sound=e.target.checked; AudioSys.enabled=Settings.sound; };
  $('opt-mode').onchange=e=>{ Settings.mode=e.target.value; State.creative=Settings.mode==='creative'; renderToolbar(); toast(Settings.mode==='creative'?'🎨 Creative: infinite blocks + fly':'❤️ Survival: mine, eat, survive!'); };
  const od=$('opt-diff'); if(od) od.onchange=e=>{ Settings.difficulty=e.target.value;
    if(Settings.difficulty==='peaceful'){ const n=clearHostiles(9999); toast(n?`☮️ Peaceful! ${n} hostile${n>1?'s':''} poofed away`:'☮️ Peaceful! No monsters will spawn'); }
    else toast(Settings.difficulty==='easy'?'😌 Easy: monsters hit softer':'⚔️ Normal: monsters are dangerous at night'); };
  const q=$('opt-quality'); if(q) q.onchange=e=>{ Settings.quality=e.target.value;
    if(Settings.quality==='high'){ Settings.pixelRatio=Math.min(devicePixelRatio||1,2); autoQTier=0; setShadowSize(2048); setShadows(true); setLowFx(false); }
    else if(Settings.quality==='med'){ Settings.pixelRatio=1.25; setShadowSize(1024); setLowFx(false); }
    else if(Settings.quality==='low'){ Settings.pixelRatio=1; setShadowSize(1024); setLowFx(true); }
    else { Settings.pixelRatio=Math.min(devicePixelRatio||1,1.5); autoQTier=0; setShadowSize(1024); setLowFx(false); }
    renderer.setPixelRatio(Settings.pixelRatio); };
}
function toggleFlyDoubleTap(){ if(!State.creative) return false; State.fly=!State.fly; toast(State.fly?'🕊️ Fly ON':'🚶 Fly OFF'); return true; }
function randCode(){ return Array.from({length:4},()=> 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[randi(0,30)]).join(''); }
function startGame(){
  Settings.seed=+$('world-seed').value||1337; perlin=new Perlin(Settings.seed);
  State.playerName=$('player-name').value||'Steve';
  State.playerColor=`hsl(${randi(0,360)},80%,60%)`;
  Settings.mode=$('opt-mode').value; State.creative=Settings.mode==='creative';
  Settings.difficulty=$('opt-diff')?$('opt-diff').value:'normal';
  State.prot=3; // spawn protection on (re)start
  Settings.renderDist=+$('opt-render').value||4;
  const qv=$('opt-quality')?$('opt-quality').value:'auto'; Settings.quality=qv;
  if(qv==='high') Settings.pixelRatio=Math.min(devicePixelRatio||1,2);
  else if(qv==='med') Settings.pixelRatio=1.25;
  else if(qv==='low'){ Settings.pixelRatio=1; }
  else Settings.pixelRatio=Math.min(devicePixelRatio||1,1.5);
  if(renderer){ renderer.setPixelRatio(Settings.pixelRatio); setShadowSize(qv==='high'?2048:1024); setLowFx(qv==='low'); }
  chunks.forEach(c=>c.dispose()); chunks.clear(); updateChunks();
  State.started=true; $('menu').classList.add('hidden'); $('hud').classList.remove('hidden');
  try{ controls.lock(); }catch(e){}
  AudioSys.ensure(); AudioSys.level();
  toast(`Welcome, ${State.playerName}! ${State.creative?'🎨 Creative':'❤️ Survival'} · ${Settings.difficulty} · seed ${Settings.seed}`);
  if(State.prot>0) setTimeout(()=>toast('🛡️ Spawn protection (3s)'),800);
  setTimeout(()=>toast('💡 Press C to invite a friend to co-op!'),2500);
  RemotePlayers.renderList();
}
function eatFood(){
  if(State.inventory[BLOCK.GRASS]>0||State.inventory[BLOCK.DIRT]>0){
    if(State.health>=State.maxHealth&&State.hunger>=20){ toast('Full! Go build something 🏠'); return; }
    if(!State.creative){ if(State.inventory[BLOCK.DIRT]>0) State.inventory[BLOCK.DIRT]--; else State.inventory[BLOCK.GRASS]--; }
    heal(5); State.hunger=clamp(State.hunger+4,0,20); AudioSys.eat(); renderToolbar(); renderVitals(); toast('😋 Yum! +5 HP');
  } else toast('No food! Break grass for apples 🍎');
}
function fallbackCopy(txt,done){ const ta=document.createElement('textarea'); ta.value=txt; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); done(); }catch(e){ toast('Copy failed — screenshot the log instead'); } ta.remove(); }
function openChat(){ chatOpen=true; $('chat-input-row').classList.remove('hidden'); $('chat-input').focus(); document.exitPointerLock&&document.exitPointerLock(); }
function closeChat(){ chatOpen=false; $('chat-input-row').classList.add('hidden'); }
function submitChat(){ const v=$('chat-input').value.trim(); $('chat-input').value=''; closeChat(); if(v) Net.sendChat(v); if(State.started) try{controls.lock();}catch(e){} }

/* ---------- touch ---------- */
let isTouch=false;
function initTouch(){
  const tz=$('joystick-zone'),knob=$('joystick-knob'),look=$('touch-look-zone');
  $('btn-toggle-touch').onclick=e=>{ e.stopPropagation(); isTouch=!isTouch; $('touch-controls').style.display=isTouch?'block':'none'; if(isTouch){ $('menu').classList.add('hidden'); if(!State.started) startGame(); } };
  let jid=null,center={x:0,y:0};
  tz.addEventListener('touchstart',e=>{ e.preventDefault(); const t=e.changedTouches[0]; jid=t.identifier; const r=tz.getBoundingClientRect(); center={x:r.left+r.width/2,y:r.top+r.height/2}; joyMove(t.clientX,t.clientY); },{passive:false});
  tz.addEventListener('touchmove',e=>{ e.preventDefault(); for(const t of e.changedTouches) if(t.identifier===jid) joyMove(t.clientX,t.clientY); },{passive:false});
  tz.addEventListener('touchend',e=>{ for(const t of e.changedTouches) if(t.identifier===jid){ jid=null; knob.style.transform='translate(-50%,-50%)'; moveState.forward=moveState.backward=moveState.left=moveState.right=false; } },{passive:false});
  function joyMove(x,y){ const max=35; let dx=x-center.x,dy=y-center.y; const d=Math.hypot(dx,dy); if(d>max){dx*=max/d;dy*=max/d;}
    knob.style.transform=`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    moveState.forward=dy<-10; moveState.backward=dy>10; moveState.left=dx<-10; moveState.right=dx>10; }
  let lid=null,lx=0,ly=0;
  look.addEventListener('touchstart',e=>{ const t=e.changedTouches[0]; lid=t.identifier; lx=t.clientX; ly=t.clientY; },{passive:false});
  look.addEventListener('touchmove',e=>{ e.preventDefault(); for(const t of e.changedTouches) if(t.identifier===lid){ controls.rotate((t.clientX-lx)*1.6,(t.clientY-ly)*1.6); lx=t.clientX; ly=t.clientY; } },{passive:false});
  const bind=(id,fn)=>$(id).addEventListener('touchstart',e=>{ e.preventDefault(); e.stopPropagation(); fn(); },{passive:false});
  bind('btn-break',tryBreak); bind('btn-place',tryPlace);
  bind('btn-jump',()=>{ if(State.fly) velocity.y=FLY_SPEED*0.7; else if(canJump){ velocity.y=JUMP; canJump=false; } });
  bind('btn-fly-t',()=>{ State.fly=!State.fly; toast(State.fly?'🕊️ Fly ON':'🚶 Fly OFF'); });
}

/* ---------- main loop ---------- */
let fpsAcc=0,fpsN=0,fpsShow=60;
function animate(){
  requestAnimationFrame(animate);
  const now=performance.now();
  let dt=Math.min((now-prevTime)/1000,0.1); prevTime=now;
  fpsAcc+=dt; fpsN++; if(fpsAcc>=0.5){ fpsShow=Math.round(fpsN/fpsAcc); fpsAcc=0; fpsN=0; }

  if(State.started&&!State.dead){
    if(now-lastChunkUpdate>250){ updateChunks(); lastChunkUpdate=now; }
    outlineTick-=dt;
    updateSky(dt);
    autoQualityTick(dt,fpsShow);
    // physics
    const locked=controls.isLocked||isTouch;
    if(locked){
      const inWaterBlock=getBlock(camera.position.x,camera.position.y-0.5,camera.position.z)===BLOCK.WATER;
      const headBlock=getBlock(camera.position.x,camera.position.y-0.2,camera.position.z)===BLOCK.WATER;
      State.inWater=inWaterBlock; State.headInWater=headBlock;
      velocity.x-=velocity.x*10*dt; velocity.z-=velocity.z*10*dt;
      if(State.fly){ velocity.y-=velocity.y*8*dt; if(moveState.forward) velocity.z=-FLY_SPEED; if(moveState.backward) velocity.z=FLY_SPEED; if(moveState.left) velocity.x=-FLY_SPEED*0.7; if(moveState.right) velocity.x=FLY_SPEED*0.7; }
      else{
        velocity.y-=GRAV*(inWaterBlock?0.35:1)*dt;
        if(inWaterBlock) velocity.y=Math.max(velocity.y,-4);
        direction.z=Number(moveState.forward)-Number(moveState.backward);
        direction.x=Number(moveState.right)-Number(moveState.left);
        direction.normalize();
        const sp=SPEED*(State.sprint?1.7:1)*(inWaterBlock?0.6:1);
        if(moveState.forward||moveState.backward) velocity.z-=direction.z*sp*8*dt;
        if(moveState.left||moveState.right) velocity.x-=direction.x*sp*8*dt;
        if(inWaterBlock&&moveState.forward&&canJump) velocity.y=4;
      }
      direction.normalize();
      const steps=5, sd=dt/steps;
      for(let i=0;i<steps;i++){
        if(State.fly){
          controls.moveRight(-velocity.x*sd); controls.moveForward(-velocity.z*sd);
          camera.position.y+=velocity.y*sd;
          if(collide(camera.position,RADIUS,HEIGHT,true)){ camera.position.y-=velocity.y*sd; velocity.y=0; }
        } else {
          const ox=camera.position.x; controls.moveRight(-velocity.x*sd);
          if(collide(camera.position,RADIUS,HEIGHT,false)){ camera.position.x=ox; velocity.x=0; }
          const oz=camera.position.z; controls.moveForward(-velocity.z*sd);
          if(collide(camera.position,RADIUS,HEIGHT,false)){ camera.position.z=oz; velocity.z=0; }
          camera.position.y+=velocity.y*sd;
          if(collide(camera.position,RADIUS,HEIGHT,true)){
            // fall damage only for real falls — and never a 0-damage scare flash
            if(velocity.y<-16&&!State.creative){ const fd=Math.floor((-velocity.y-16)/2); if(fd>0){ Dbg.log('FALL',`impact vy ${velocity.y.toFixed(1)} → -${fd}`); damagePlayer(fd,'Fall'); toast(`💥 Ouch! ${fd} fall damage — that was a big drop`); } }
            if(velocity.y<0){ camera.position.y-=velocity.y*sd; velocity.y=0; canJump=true; }
            else { camera.position.y-=velocity.y*sd; velocity.y=0; }
          }
        }
      }
      // footsteps
      const moving=moveState.forward||moveState.backward||moveState.left||moveState.right;
      if(moving&&canJump&&!State.fly){ stepAcc+=dt*(State.sprint?2.4:1.6); if(stepAcc>0.45){ stepAcc=0; AudioSys.step(); } }
      // hunger / regen / drown
      hungerTick+=dt;
      if(hungerTick>4){ hungerTick=0;
        if(moving) State.hunger=Math.max(0,State.hunger-0.4);
        if(State.headInWater){
          if(!State.warnedDrown){ State.warnedDrown=true; toast('🌊 You\'re drowning! Swim up!'); }
          damagePlayer(2,'Drowning');
        }
        else { State.warnedDrown=false;
          if(State.hunger<=0) damagePlayer(1,'Starvation');
          else if(State.health<State.maxHealth&&State.hunger>14){ heal(1); State.hunger-=0.5; } }
        // one-time low-food warning so starvation never feels out of nowhere
        if(State.hunger<=6&&!State.warnedHungry){ State.warnedHungry=true; toast('🍖 You\'re starving! Press E to eat'); AudioSys.blip(220,0.2,'square',0.12); }
        else if(State.hunger>10) State.warnedHungry=false;
        renderVitals();
      }
      if(bot&&!bot.dead){ const d=bot.pos.distanceTo(camera.position); if(d>3){ bot.dir.copy(camera.position).sub(bot.pos); bot.dir.y=0; bot.dir.normalize(); bot.moving=true; } else bot.moving=false; if(d>60){ bot.pos.copy(camera.position); } }
      if(camera.position.y<-30){ camera.position.set(8.5,heightAt(8,8)+3,8.5); velocity.set(0,0,0); damagePlayer(4,'The void'); }
      updateOutline();
    }
    mobs.forEach(m=>m.update(dt));
    // remove dead
    for(let i=mobs.length-1;i>=0;i--) if(mobs[i].dead) mobs.splice(i,1);
    if(State.prot>0) State.prot=Math.max(0,State.prot-dt);
    updatePickups(dt); updateParticles(dt); RemotePlayers.prune();
    // HUD
    netTick+=dt; if(netTick>0.25){ netTick=0;
      $('stats').textContent=`FPS ${fpsShow} · ${mobs.length} mobs · XYZ ${Math.round(camera.position.x)},${Math.round(camera.position.y)},${Math.round(camera.position.z)}${State.fly?' · FLY':''}${State.creative?' · CREATIVE':''}${State.prot>0?' · 🛡️':''}${Settings.difficulty!=='normal'?' · '+Settings.difficulty:''}${Settings.pixelRatio<1.2?' · ⚡':''}`;
    }
    minimapTick+=dt; if(minimapTick>1.0){ minimapTick=0; drawMinimap(); }
    saveTick+=dt; if(saveTick>8){ saveTick=0; saveGame(); }
  }
  renderer.render(scene,camera);
}

init();
