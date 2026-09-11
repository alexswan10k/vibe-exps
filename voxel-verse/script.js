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
const Settings = { sens:1, renderDist:4, shadows:true, clouds:true, sound:true, mode:'survival', seed:1337, fov:75 };
const State = {
  started:false, dead:false, fly:false, sprint:false, inWater:false, headInWater:false,
  health:20, maxHealth:20, hunger:20, xp:0, day:1,
  time:0.32, // 0..1, 0.25=sunrise
  activeBlock:0, inventory:{}, creative:false,
  playerId:'p'+Math.random().toString(36).slice(2,8), playerName:'Steve', playerColor:'#ff5555',
  yaw:0
};
const HOTBAR = [0,1,2,5,9,10,11,12,4]; // 9 slots -> block types

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
  const n=opts.noise??90;
  for(let i=0;i<n;i++){ g.fillStyle=`rgba(${randi(0,40)},${randi(0,40)},${randi(0,40)},0.18)`; g.fillRect(randi(0,31),randi(0,31),randi(1,3),randi(1,3)); }
  for(let i=0;i<(opts.spark??0);i++){ g.fillStyle='rgba(255,255,255,0.5)'; g.fillRect(randi(0,31),randi(0,31),2,2); }
  if(opts.top){ g.fillStyle=opts.top; g.fillRect(0,0,32,10); }
  if(opts.mortar){ g.strokeStyle='rgba(255,255,255,0.55)'; g.lineWidth=2;
    for(let y=8;y<32;y+=8){ g.beginPath(); g.moveTo(0,y); g.lineTo(32,y); g.stroke(); }
    for(let y=0;y<32;y+=8){ const off=(y/8)%2?8:0; for(let x=off;x<32;x+=16){ g.beginPath(); g.moveTo(x,y); g.lineTo(x,y+8); g.stroke(); } } }
  if(opts.frame){ g.strokeStyle='rgba(255,255,255,0.9)'; g.lineWidth=3; g.strokeRect(1,1,30,30); }
  const t=new THREE.CanvasTexture(c); t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter; return t;
}

/* ---------- three globals ---------- */
let camera, scene, renderer, controls, raycaster, sunLight, hemi, moonMesh, sunMesh, stars, cloudsMesh, blockOutline;
let chunkMeshes, mobGroup, pickupGroup, particleGroup, remoteGroup;
const CHUNK=16, SEA=4, MAXH=22;
const chunks=new Map();
const overrides=new Map(); // "wx,wy,wz" -> type|null
const materials=[]; // per block type (single material w/ texture; grass uses side tex)
const boxGeo=new THREE.BoxGeometry(1,1,1);
const dummy=new THREE.Object3D();
const moveState={forward:false,backward:false,left:false,right:false};
const velocity=new THREE.Vector3(); const direction=new THREE.Vector3();
let prevTime=performance.now(), canJump=false, lastChunkUpdate=0, stepAcc=0, hungerTick=0, saveTick=0, netTick=0, minimapTick=0;
const GRAV=30, JUMP=12, SPEED=4.4, FLY_SPEED=9, RADIUS=0.42, HEIGHT=1.7, REACH=7;

/* ---------- persistence ---------- */
const SAVE_KEY='voxel-verse-v2-save';
function saveGame(){
  try{
    const ov={}; overrides.forEach((v,k)=>{ ov[k]=v; });
    localStorage.setItem(SAVE_KEY, JSON.stringify({ seed:Settings.seed, time:State.time, day:State.day,
      pos:[camera.position.x,camera.position.y,camera.position.z], inv:State.inventory, overrides:ov, mode:Settings.mode }));
  }catch(e){}
}
function loadGame(){
  try{ const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null'); if(!s) return null;
    if(s.seed!==undefined){ Settings.seed=s.seed; $('world-seed').value=s.seed; }
    Object.entries(s.overrides||{}).forEach(([k,v])=>overrides.set(k,v));
    State.time=s.time??0.32; State.day=s.day??1; State.inventory=s.inv||{};
    if(s.mode) Settings.mode=s.mode;
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
      // cull fully-hidden opaque blocks
      if(isOpaque(t)){
        if(isOpaque(rawBlock(wx+1,wy,wz))&&isOpaque(rawBlock(wx-1,wy,wz))&&isOpaque(rawBlock(wx,wy+1,wz))&&isOpaque(rawBlock(wx,wy-1,wz))&&isOpaque(rawBlock(wx,wy,wz+1))&&isOpaque(rawBlock(wx,wy,wz-1))) continue;
      }
      byType[t].push([wx,wy,wz]);
    }
    byType.forEach((list,ti)=>{
      if(!list.length) return;
      const mesh=new THREE.InstancedMesh(boxGeo, materials[ti], list.length);
      list.forEach((p,i)=>{ dummy.position.set(p[0],p[1],p[2]); dummy.rotation.set(0,0,0); dummy.updateMatrix(); mesh.setMatrixAt(i,dummy.matrix); });
      mesh.instanceMatrix.needsUpdate=true; mesh.castShadow=ti!==BLOCK.WATER; mesh.receiveShadow=true;
      mesh.userData.blockType=ti;
      this.meshes.push(mesh); chunkMeshes.add(mesh);
    });
  }
  dispose(){ this.meshes.forEach(m=>{chunkMeshes.remove(m); m.dispose();}); this.meshes=[]; this.mobs.forEach(m=>m.dispose()); this.mobs=[]; this.blocks.clear(); }
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
  }
  dispose(){ scene.remove(this.mesh); mobGroup.remove(this.mesh); }
  update(dt){
    if(this.dead) return;
    this.flash=Math.max(0,this.flash-dt); this.bodyMat.emissive=new THREE.Color(this.flash>0?0x881111:0x000000);
    const pp=camera.position; const dist=this.pos.distanceTo(pp);
    const night=State.time<0.22||State.time>0.78;
    if(this.def.hostile){
      if(dist<24&&(night||this.key==='skeleton')){ this.dir.copy(pp).sub(this.pos); this.dir.y=0; this.dir.normalize(); this.moving=true;
        if(dist<1.8&&!State.dead){ damagePlayer(this.def.dmg, this.def.name); this.vel.y=3; }
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
  }
}

/* ---------- pickups & particles ---------- */
const pickups=[];
function spawnPickup(x,y,z,block,food){
  const m=new THREE.Mesh(new THREE.BoxGeometry(0.35,0.35,0.35), materials[block]||materials[0]);
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
function spawnBreakParticles(x,y,z,block,n=10){
  const col=new THREE.Color(BLOCK_DEF[block]?.color??0xffffff);
  for(let i=0;i<n;i++){
    const m=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,0.12), new THREE.MeshBasicMaterial({color:col}));
    m.position.set(x+rand(-0.3,0.3),y+rand(-0.3,0.3),z+rand(-0.3,0.3));
    scene.add(m); particleGroup.add(m);
    particles.push({mesh:m,vel:new THREE.Vector3(rand(-3,3),rand(2,6),rand(-3,3)),life:rand(0.4,0.9)});
  }
}
function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.life-=dt;
    p.vel.y-=12*dt; p.mesh.position.addScaledVector(p.vel,dt);
    if(p.life<=0){ scene.remove(p.mesh); particleGroup.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); particles.splice(i,1); } }
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
function damagePlayer(n,src){
  if(State.dead||State.creative||!State.started) return;
  State.health-=n; AudioSys.hurt();
  $('damage-vignette').classList.add('hit'); setTimeout(()=>$('damage-vignette').classList.remove('hit'),250);
  renderVitals();
  if(State.health<=0){ State.health=0; die(src); }
}
function heal(n){ State.health=clamp(State.health+n,0,State.maxHealth); renderVitals(); }
function die(src){
  State.dead=true; document.exitPointerLock&&document.exitPointerLock();
  $('death-msg').textContent=`${src||'The void'} got you. Day ${State.day}. Respawning keeps your buildings!`;
  $('death-screen').classList.remove('hidden'); AudioSys.blip(80,0.6,'sawtooth',0.2,-40);
}

/* ---------- inventory ---------- */
function addItem(block,n=1){ State.inventory[block]=(State.inventory[block]||0)+n; renderToolbar(); }
function takeItem(block,n=1){ if(State.creative) return true; if((State.inventory[block]||0)>=n){ State.inventory[block]-=n; renderToolbar(); return true; } return false; }
function countItem(b){ return State.creative?'∞':(State.inventory[b]||0); }

/* ---------- sky / env ---------- */
function updateSky(dt){
  State.time=(State.time+dt/600)%1; // 10-min day
  if(State.time<0.005) { State.day++; toast(`☀️ Day ${State.day} — you survived!`); AudioSys.level(); }
  const t=State.time, ang=(t-0.25)*Math.PI*2; // sunrise t=0.25
  const sunH=Math.sin(ang), dayF=clamp(sunH*1.5+0.25,0,1);
  const night=1-dayF;
  const sunDir=new THREE.Vector3(Math.cos(ang),Math.max(0.12,sunH),0.35).normalize();
  sunLight.position.copy(camera.position).addScaledVector(sunDir,70);
  sunLight.target.position.copy(camera.position);
  sunLight.intensity=0.25+dayF*0.75;
  hemi.intensity=0.35+dayF*0.45;
  const dayCol=new THREE.Color(0x87ceeb), duskCol=new THREE.Color(0xff9a56), nightCol=new THREE.Color(0x060a1a);
  let sky=dayCol.clone();
  if(dayF<0.35) sky.lerp(duskCol, 1-dayF/0.35);
  sky.lerp(nightCol, night*0.85);
  scene.background=sky; scene.fog.color.copy(sky);
  sunMesh.position.set(Math.cos(ang)*300, sunH*300, -200); sunMesh.visible=sunH>-0.1;
  moonMesh.position.set(-Math.cos(ang)*300, -sunH*300, 200); moonMesh.visible=sunH<0.15;
  stars.material.opacity=night*0.9;
  stars.rotation.y+=dt*0.005;
  // clouds drift
  if(cloudsMesh.visible){ cloudsMesh.position.x=(cloudsMesh.position.x+dt*1.2)%200; }
  // clock UI
  const hh=Math.floor(((t+0.25)%1)*24), mm=Math.floor((((t+0.25)%1)*24%1)*60);
  const icon=(sunH>0?'☀':'🌙');
  $('clock').textContent=`${icon} Day ${State.day} — ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
  // spawn hostiles at night
  if(night>0.7&&mobs.length<14&&Math.random()<dt*0.35){
    const a=rand(0,Math.PI*2), r=rand(14,22);
    const x=Math.round(camera.position.x+Math.cos(a)*r), z=Math.round(camera.position.z+Math.sin(a)*r);
    const y=heightAt(x,z)+1;
    if(getBlock(x,y,z)===null){ mobs.push(new Mob(x+0.5,y,z+0.5, Math.random()<0.6?'zombie':'skeleton')); }
  }
  // despawn far mobs
  for(let i=mobs.length-1;i>=0;i--){ const m=mobs[i]; if(m.dead||m.pos.distanceTo(camera.position)>70){ m.dispose(); mobs.splice(i,1); } }
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
  HOTBAR.forEach((b,i)=>{
    const d=document.createElement('div'); d.className='block-slot'+(i===State.activeBlock?' active':'');
    const texCanvas=blockIcon(b);
    d.style.backgroundImage=`url(${texCanvas})`;
    d.innerHTML=`<span class="k">${i+1}</span><span class="t">${BLOCK_DEF[b].name}</span><span class="n">${countItem(b)}</span>`;
    d.title=BLOCK_DEF[b].name;
    d.onclick=()=>{ State.activeBlock=i; renderToolbar(); AudioSys.blip(500+i*60,0.05,'square',0.08); };
    tb.appendChild(d);
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
  const c=$('minimap'), g=c.getContext('2d'); const R=10, px=Math.round(camera.position.x), pz=Math.round(camera.position.z);
  g.fillStyle='#06121f'; g.fillRect(0,0,132,132);
  for(let dx=-R;dx<=R;dx++) for(let dz=-R;dz<=R;dz++){
    const x=px+dx, z=pz+dz; let col='#000';
    for(let y=MAXH+6;y>=-5;y--){ const b=getBlock(x,y,z); if(b!==null&&b!==undefined&&!(BLOCK_DEF[b].liquid)){ col='#'+BLOCK_DEF[b].color.toString(16).padStart(6,'0'); if(BLOCK_DEF[b].liquid) col='#3b6df6'; break; } if(b===BLOCK.WATER){ col='#3b6df6'; break; } }
    g.fillStyle=col; g.fillRect((dx+R)*(132/(2*R+1)), (dz+R)*(132/(2*R+1)), 132/(2*R+1), 132/(2*R+1));
  }
  g.fillStyle='#ffe14d'; g.beginPath(); g.arc(66,66,4,0,7); g.fill();
  // mobs dots
  g.fillStyle='#ff5555'; mobs.forEach(m=>{ const dx=m.pos.x-px, dz=m.pos.z-pz; if(Math.abs(dx)<R&&Math.abs(dz)<R) g.fillRect(66+dx*6,66+dz*6,3,3); });
}

/* ---------- interaction ---------- */
function raycastCenter(maxDist=REACH){
  raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
  const hits=raycaster.intersectObjects(chunkMeshes.children);
  if(hits.length&&hits[0].distance<=maxDist) return hits[0];
  return null;
}
function updateOutline(){
  const hit=raycastCenter();
  if(hit){
    const mesh=hit.object; mesh.getMatrixAt(hit.instanceId,dummy.matrix);
    dummy.matrix.decompose(dummy.position,dummy.quaternion,dummy.scale);
    blockOutline.visible=true; blockOutline.position.set(Math.round(dummy.position.x),Math.round(dummy.position.y),Math.round(dummy.position.z));
    const lbl=$('block-highlight-label'); lbl.style.display='block'; lbl.textContent=BLOCK_DEF[mesh.userData.blockType]?.name||'';
  } else { blockOutline.visible=false; $('block-highlight-label').style.display='none'; }
}
function tryBreak(){
  // mobs first
  raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
  const mh=raycaster.intersectObjects(mobGroup.children,true);
  if(mh.length){
    let o=mh[0].object, root=o;
    while(root.parent&&root.parent!==scene&&root.parent!==mobGroup) root=root.parent;
    const mob=mobs.find(m=>m.mesh===root||m.mesh.children.includes(o)||root===m.mesh);
    const target=mob||mobs.sort((a,b)=>a.pos.distanceTo(camera.position)-b.pos.distanceTo(camera.position))[0];
    if(target&&target.pos.distanceTo(camera.position)<4.5){ target.hurt(State.creative?100:4, camera.position); if(bot) bot.hurt(0,camera.position); return; }
  }
  const hit=raycastCenter();
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
  const block=HOTBAR[State.activeBlock];
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
  scene=new THREE.Scene(); scene.background=new THREE.Color(0x87ceeb); scene.fog=new THREE.Fog(0x87ceeb,24,90);
  camera=new THREE.PerspectiveCamera(Settings.fov,innerWidth/innerHeight,0.08,1200);
  camera.position.set(8,30,8);
  hemi=new THREE.HemisphereLight(0xcfe8ff,0x6b5b3e,0.8); scene.add(hemi);
  const amb=new THREE.AmbientLight(0xffffff,0.25); scene.add(amb);
  sunLight=new THREE.DirectionalLight(0xffffff,0.9); sunLight.position.set(50,100,50);
  sunLight.castShadow=Settings.shadows;
  sunLight.shadow.mapSize.set(1024,1024); sunLight.shadow.camera.left=-40; sunLight.shadow.camera.right=40; sunLight.shadow.camera.top=40; sunLight.shadow.camera.bottom=-40;
  scene.add(sunLight); scene.add(sunLight.target);
  renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=Settings.shadows; renderer.shadowMap.type=THREE.PCFShadowMap;
  $('game-root').appendChild(renderer.domElement);
  controls=new SimplePointerLockControls(camera,document.body);
  raycaster=new THREE.Raycaster(); raycaster.far=REACH;
  chunkMeshes=new THREE.Group(); mobGroup=new THREE.Group(); pickupGroup=new THREE.Group(); particleGroup=new THREE.Group(); remoteGroup=new THREE.Group();
  scene.add(chunkMeshes); scene.add(mobGroup); scene.add(pickupGroup); scene.add(particleGroup); scene.add(remoteGroup);

  // block materials with pixel textures
  const texOpts=[{top:'#5fd35f'}, {}, {}, {}, {}, {}, {}, {}, {}, {noise:40},{frame:true,noise:10},{mortar:true},{spark:60,noise:20}, {spark:25}];
  BLOCK_DEF.forEach((d,i)=>{
    const map=makePixelTexture(d.color,texOpts[i]||{});
    const m=new THREE.MeshLambertMaterial({map});
    if(d.name==='Water'||d.name==='Glass'){ m.transparent=true; m.opacity=d.name==='Water'?0.7:0.45; }
    if(d.name==='Leaves'){ m.transparent=true; m.opacity=0.92; m.alphaTest=0.2; }
    if(d.name==='Glow'){ m.emissive=new THREE.Color(0xaa7700); }
    materials.push(m);
  });

  // sun/moon/stars/clouds
  sunMesh=new THREE.Mesh(new THREE.SphereGeometry(14,12,12),new THREE.MeshBasicMaterial({color:0xffe14d,fog:false})); scene.add(sunMesh);
  moonMesh=new THREE.Mesh(new THREE.SphereGeometry(10,12,12),new THREE.MeshBasicMaterial({color:0xe8ecff,fog:false})); scene.add(moonMesh);
  { const g=new THREE.BufferGeometry(), pos=[]; for(let i=0;i<600;i++){ const a=rand(0,Math.PI*2),e=rand(0.05,Math.PI/2),r=700; pos.push(Math.cos(a)*Math.cos(e)*r,Math.sin(e)*r,Math.sin(a)*Math.cos(e)*r); }
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    stars=new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:2.2,sizeAttenuation:false,transparent:true,opacity:0,fog:false,depthWrite:false})); scene.add(stars); }
  { const cg=new THREE.BoxGeometry(6,1.5,4); const cm=new THREE.MeshLambertMaterial({color:0xffffff,transparent:true,opacity:0.75});
    cloudsMesh=new THREE.InstancedMesh(cg,cm,60);
    for(let i=0;i<60;i++){ dummy.position.set(rand(-120,120),rand(38,48),rand(-120,120)); dummy.rotation.set(0,0,0); dummy.updateMatrix(); cloudsMesh.setMatrixAt(i,dummy.matrix); }
    cloudsMesh.instanceMatrix.needsUpdate=true; cloudsMesh.visible=Settings.clouds; scene.add(cloudsMesh); }
  blockOutline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02,1.02,1.02)),new THREE.LineBasicMaterial({color:0x111111})); blockOutline.visible=false; scene.add(blockOutline);

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
  $('btn-new-world').onclick=()=>{ Settings.seed=randi(1,99999); $('world-seed').value=Settings.seed; perlin=new Perlin(Settings.seed); overrides.clear(); chunks.forEach(c=>c.dispose()); chunks.clear(); mobs.forEach(m=>m.dispose()); mobs.length=0; updateChunks(); const h=heightAt(8,8); camera.position.set(8.5,h+3,8.5); toast('🌍 New world! Seed '+Settings.seed); };
  $('btn-host').onclick=()=>{ const code=($('room-code').value||randCode()).toUpperCase(); $('room-code').value=code; Net.host(code); };
  $('btn-join').onclick=()=>{ const code=($('room-code').value||'').toUpperCase(); if(!code){ toast('Enter a room code first'); return; } Net.join(code); };
  $('btn-copy-link').onclick=()=>{ const code=$('room-code').value||'????'; const txt=`Join my Voxel Verse room! Code: ${code} — open Voxel Verse, press C, enter code, JOIN.`; navigator.clipboard&&navigator.clipboard.writeText(txt); toast('📋 Invite copied!'); };
  $('btn-spawn-bot').onclick=()=>{ spawnBot(); $('coop-modal').classList.add('hidden'); };
  $('btn-coop-close').onclick=()=>$('coop-modal').classList.add('hidden');
  $('btn-respawn').onclick=()=>{ State.dead=false; State.health=State.maxHealth; State.hunger=20; renderVitals(); $('death-screen').classList.add('hidden'); const h=heightAt(Math.round(camera.position.x),Math.round(camera.position.z)); camera.position.y=h+3; velocity.set(0,0,0); toast('✨ Respawned!'); };
  $('chat-input').addEventListener('keydown',e=>{ if(e.code==='Enter') submitChat(); e.stopPropagation(); });
  controls.addEventListener('lock',()=>{ $('menu').classList.add('hidden'); });
  controls.addEventListener('unlock',()=>{ if(State.started&&!State.dead&&!isTouch&&chatOpen===false){ /* keep playing, show menu only on Esc-hold? show small menu */ } });
  document.addEventListener('pointerlockchange',()=>{ if(!document.pointerLockElement&&State.started&&!isTouch&&!State.dead&&!chatOpen){ $('menu').classList.remove('hidden'); } });
  $('menu').addEventListener('click',e=>{ if(e.target===$('menu')&&State.started){ $('menu').classList.add('hidden'); controls.lock(); } });
  initTouch();
  // settings live
  $('opt-sens').oninput=e=>Settings.sens=+e.target.value;
  $('opt-render').onchange=e=>{ Settings.renderDist=+e.target.value; updateChunks(); };
  $('opt-shadows').onchange=e=>{ Settings.shadows=e.target.checked; renderer.shadowMap.enabled=Settings.shadows; sunLight.castShadow=Settings.shadows; };
  $('opt-clouds').onchange=e=>{ Settings.clouds=e.target.checked; cloudsMesh.visible=Settings.clouds; };
  $('opt-sound').onchange=e=>{ Settings.sound=e.target.checked; AudioSys.enabled=Settings.sound; };
  $('opt-mode').onchange=e=>{ Settings.mode=e.target.value; State.creative=Settings.mode==='creative'; renderToolbar(); toast(Settings.mode==='creative'?'🎨 Creative: infinite blocks + fly':'❤️ Survival: mine, eat, survive!'); };
}
function toggleFlyDoubleTap(){ if(!State.creative) return false; State.fly=!State.fly; toast(State.fly?'🕊️ Fly ON':'🚶 Fly OFF'); return true; }
function randCode(){ return Array.from({length:4},()=> 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[randi(0,30)]).join(''); }
function startGame(){
  Settings.seed=+$('world-seed').value||1337; perlin=new Perlin(Settings.seed);
  State.playerName=$('player-name').value||'Steve';
  State.playerColor=`hsl(${randi(0,360)},80%,60%)`;
  Settings.mode=$('opt-mode').value; State.creative=Settings.mode==='creative';
  Settings.renderDist=+$('opt-render').value||4;
  chunks.forEach(c=>c.dispose()); chunks.clear(); updateChunks();
  State.started=true; $('menu').classList.add('hidden'); $('hud').classList.remove('hidden');
  try{ controls.lock(); }catch(e){}
  AudioSys.ensure(); AudioSys.level();
  toast(`Welcome, ${State.playerName}! ${State.creative?'🎨 Creative':'❤️ Survival'} · seed ${Settings.seed}`);
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
    updateSky(dt);
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
            if(velocity.y<-16&&!State.creative){ damagePlayer(Math.floor((-velocity.y-16)/2),'Fall'); }
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
        if(State.headInWater) damagePlayer(2,'Drowning');
        else if(State.hunger<=0) damagePlayer(1,'Starvation');
        else if(State.health<State.maxHealth&&State.hunger>14){ heal(1); State.hunger-=0.5; }
        renderVitals();
      }
      if(bot&&!bot.dead){ const d=bot.pos.distanceTo(camera.position); if(d>3){ bot.dir.copy(camera.position).sub(bot.pos); bot.dir.y=0; bot.dir.normalize(); bot.moving=true; } else bot.moving=false; if(d>60){ bot.pos.copy(camera.position); } }
      if(camera.position.y<-30){ camera.position.set(8.5,heightAt(8,8)+3,8.5); velocity.set(0,0,0); damagePlayer(4,'The void'); }
      updateOutline();
    }
    mobs.forEach(m=>m.update(dt));
    // remove dead
    for(let i=mobs.length-1;i>=0;i--) if(mobs[i].dead) mobs.splice(i,1);
    updatePickups(dt); updateParticles(dt); RemotePlayers.prune();
    // clouds follow player
    if(cloudsMesh.visible) cloudsMesh.position.set(camera.position.x,0,camera.position.z);
    // HUD
    netTick+=dt; if(netTick>0.25){ netTick=0;
      $('stats').textContent=`FPS ${fpsShow} · ${mobs.length} mobs · XYZ ${Math.round(camera.position.x)},${Math.round(camera.position.y)},${Math.round(camera.position.z)}${State.fly?' · FLY':''}${State.creative?' · CREATIVE':''}`;
    }
    minimapTick+=dt; if(minimapTick>0.6){ minimapTick=0; drawMinimap(); }
    saveTick+=dt; if(saveTick>8){ saveTick=0; saveGame(); }
  }
  renderer.render(scene,camera);
}

init();
