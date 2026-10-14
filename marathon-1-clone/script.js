/* =========================================================
   MARATHON 1 CLONE — Three.js edition
   Fan remake of Bungie's Marathon (1994)
   ========================================================= */

'use strict';
const $ = (id) => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const rand = (a=1,b) => b===undefined ? Math.random()*a : a + Math.random()*(b-a);

/* ---------- map (procedural) ---------- */
const MAPX = 80, MAPY = 80;
const WALL_H = 3.2;
const EYE_H = 1.62;
const WALL = { STONE:1, METAL:2, DOOR:3, TERM:4, TECH:5, BRICK:6 };
const FLOOR = { NORMAL:0, TELE:1, RECHARGE:2, LAVA:3 };
const STYLE_WALL = { cave: WALL.STONE, tech: WALL.TECH, vault: WALL.METAL, armory: WALL.BRICK };
const STYLE_NAME = { spawn:'Command Deck', cave:'Maintenance', tech:'Engineering', vault:'Reactor', armory:'Armory', corridor:'Corridor' };

let world = []; let floorK = [];
let rooms = [];
let terminals = [];
let items = [];
let enemySpawns = [];
let spawnPoint = { x: 10.5, z: 10.5, yaw: 0 };
let exitPoint = { x: 10.5, z: 10.5 };
let roomLights = [];
const props = []; // rotated crate cover blocks {x,z,size,r,rot}
let explored = new Uint8Array(MAPX*MAPY);
let mapOpen = false;

const doors = new Map();
function doorOpen(x,z){ const d=doors.get(x+','+z); return d && d.open; }

function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; } }

function genLevel(seed){
  world = []; floorK = [];
  rooms = []; terminals = []; items = []; enemySpawns = [];
  roomLights = []; doors.clear();
  const rng = mulberry32(seed);
  for (let y=0;y<MAPY;y++){ world.push([]); floorK.push([]);
    for (let x=0;x<MAPX;x++){ world[y].push(WALL.STONE); floorK[y].push(FLOOR.NORMAL); }
  }
  function carve(x,y,w,h,style){
    for (let j=y;j<y+h;j++) for (let i=x;i<x+w;i++){
      if (i<1||j<1||i>=MAPX-1||j>=MAPY-1) continue;
      world[j][i]=0;
    }
    rooms.push({x,y,w,h,cx:x+w/2,cy:y+h/2,style});
  }
  // spawn: big, well-lit command deck
  carve(6,6,13,10,'spawn');
  // other rooms: bigger + more of them
  let attempts=0;
  const TARGET_ROOMS = 26;
  while (rooms.length<TARGET_ROOMS && attempts<2500){
    attempts++;
    const w=7+Math.floor(rng()*8), h=7+Math.floor(rng()*8); // 7..14
    const x=2+Math.floor(rng()*(MAPX-w-4)), y=2+Math.floor(rng()*(MAPY-h-4));
    let ok=true;
    for (const r of rooms){
      // 3-cell separation keeps walls between rooms (good for doors/terminals)
      if (x<r.x+r.w+3 && x+w+3>r.x && y<r.y+r.h+3 && y+h+3>r.y){ ok=false; break; }
    }
    if (!ok) continue;
    const style=['cave','tech','vault','armory'][Math.floor(rng()*4)];
    carve(x,y,w,h,style);
  }
  // break the grid: circular + chamfered (diagonal-cut corner) rooms
  let circles=0;
  for (let i=1;i<rooms.length;i++){
    const r=rooms[i];
    if (circles<3 && r.w>=8 && r.h>=8 && rng()<0.4){
      r.shape='circle';
      const cr=Math.min(r.w,r.h)/2+0.5;
      for (let j=Math.floor(r.y);j<r.y+r.h;j++) for (let i2=Math.floor(r.x);i2<r.x+r.w;i2++){
        if (i2<1||j<1||i2>=MAPX-1||j>=MAPY-1) continue;
        // rooms are still isolated here, so walling the corners is safe
        world[j][i2] = Math.hypot(i2+0.5-r.cx, j+0.5-r.cy)<=cr ? 0 : WALL.STONE;
      }
      circles++;
    } else if (rng()<0.55 && r.w>=7 && r.h>=7){
      r.shape='chamfer';
      const c=2;
      const x0=Math.floor(r.x), y0=Math.floor(r.y);
      const x1=Math.floor(r.x+r.w)-1, y1=Math.floor(r.y+r.h)-1;
      for (let dy=0;dy<c;dy++) for (let dx=0;dx<c;dx++){
        if (dx+dy>=c) continue; // keep -> diagonal cut edge
        if (world[y0+dy]&&world[y0+dy][x0+dx]===0) world[y0+dy][x0+dx]=WALL.STONE;
        if (world[y0+dy]&&world[y0+dy][x1-dx]===0) world[y0+dy][x1-dx]=WALL.STONE;
        if (world[y1-dy]&&world[y1-dy][x0+dx]===0) world[y1-dy][x0+dx]=WALL.STONE;
        if (world[y1-dy]&&world[y1-dy][x1-dx]===0) world[y1-dy][x1-dx]=WALL.STONE;
      }
    } else r.shape='rect';
  }
  rooms[0].shape='rect';
  // connect rooms with wide L corridors (3 wide, random elbow order)
  function carveDisc(cx,cy){
    for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++){
      const xx=cx+dx, yy=cy+dy;
      if (xx>0&&yy>0&&xx<MAPX-1&&yy<MAPY-1){ world[yy][xx]=0; }
    }
  }
  function corridor(x1,y1,x2,y2){
    let x=x1,y=y1;
    const hFirst = rng()<0.5;
    const walkX = () => { while (x!==x2){ x += (x<x2?1:-1); carveDisc(x,y); } };
    const walkY = () => { while (y!==y2){ y += (y<y2?1:-1); carveDisc(x,y); } };
    carveDisc(x,y);
    if (hFirst){ walkX(); walkY(); } else { walkY(); walkX(); }
  }
  function lineCorridor(x1,y1,x2,y2){
    // diagonal hall: straight lerp between centres (stair-steps at cell
    // level, but reads as a 45-degree passage instead of an L)
    const steps=Math.max(Math.abs(x2-x1),Math.abs(y2-y1))*2+2;
    for (let i=0;i<=steps;i++){
      const t=i/steps;
      carveDisc(Math.round(x1+(x2-x1)*t), Math.round(y1+(y2-y1)*t));
    }
  }
  function link(a,b){
    if (rng()<0.45) lineCorridor(Math.floor(a.cx),Math.floor(a.cy),Math.floor(b.cx),Math.floor(b.cy));
    else corridor(Math.floor(a.cx),Math.floor(a.cy),Math.floor(b.cx),Math.floor(b.cy));
  }
  for (let i=1;i<rooms.length;i++) link(rooms[i-1], rooms[i]);
  for (let i=0;i<9;i++){
    const a=rooms[Math.floor(rng()*rooms.length)], b=rooms[Math.floor(rng()*rooms.length)];
    if (a!==b) link(a,b);
  }

  // paint border walls per room style so zones look distinct
  for (const r of rooms){
    const wt = STYLE_WALL[r.style] || WALL.STONE;
    for (let j=Math.floor(r.y)-1;j<=Math.floor(r.y+r.h);j++){
      for (let i=Math.floor(r.x)-1;i<=Math.floor(r.x+r.w);i++){
        if (i<1||j<1||i>=MAPX-1||j>=MAPY-1) continue;
        if (world[j][i]!==WALL.STONE) continue;
        // adjacent to this room's floor?
        let adj=false;
        for (let dy=0;dy<r.h&&!adj;dy++) for (let dx=0;dx<r.w;dx++){
          const fx=Math.floor(r.x)+dx, fy=Math.floor(r.y)+dy;
          if (Math.abs(fx-i)<=1 && Math.abs(fy-j)<=1){ adj=true; break; }
        }
        if (adj) world[j][i]=wt;
      }
    }
  }

  // doors: thin walls separating two floor areas become sliding doors
  let doorCount=0;
  for (let y=1;y<MAPY-1 && doorCount<26;y++) for (let x=1;x<MAPX-1;x++){
    if (world[y][x]===0) continue;
    if (world[y][x]===WALL.TERM) continue;
    const lr = (world[y][x-1]===0 && world[y][x+1]===0);
    const ud = (world[y-1] && world[y+1] && world[y-1][x]===0 && world[y+1][x]===0);
    if ((lr||ud) && rng()<0.10){
      world[y][x]=WALL.DOOR;
      doors.set(x+','+y,{open:false,timer:0});
      doorCount++;
    }
  }

  // pillars (freestanding cover) + crates (rotated low cover) break up big rooms.
  // placed after the door scan so pillar cells can never become doors.
  for (const r of rooms){
    const area=r.w*r.h;
    if (area<70 || r.shape==='circle') continue;
    const nP = area>120 ? 4 : 2;
    let placed=0, guard=0;
    while (placed<nP && guard++<50){
      const px=Math.floor(r.x+2+rng()*(r.w-4));
      const pz=Math.floor(r.y+2+rng()*(r.h-4));
      if (px<1||pz<1||px>=MAPX-1||pz>=MAPY-1||world[pz][px]!==0) continue;
      if (Math.hypot(px+0.5-r.cx,pz+0.5-r.cy)<3) continue; // keep centre clear
      world[pz][px]=WALL.METAL;
      placed++;
    }
  }
  for (const r of rooms){
    const area=r.w*r.h;
    if (area<60) continue;
    const nC=2+Math.floor(rng()*3);
    let placed=0, guard=0;
    while (placed<nC && guard++<50){
      const px=r.x+2+rng()*(r.w-4), pz=r.y+2+rng()*(r.h-4);
      if (isSolid(px,pz)) continue;
      if (Math.hypot(px-r.cx,pz-r.cy)<2.6) continue;
      // keep crates off walls so nothing gets squeezed into geometry
      if (isSolid(px+0.9,pz)||isSolid(px-0.9,pz)||isSolid(px,pz+0.9)||isSolid(px,pz-0.9)) continue;
      let ok=true;
      for (const p of props){ if (Math.hypot(p.x-px,p.z-pz)<1.7){ ok=false; break; } }
      if (!ok) continue;
      const size=0.7+rng()*0.4;
      props.push({x:px,z:pz,size,r:size*0.62,rot:0.3+rng()*0.9});
      placed++;
    }
  }

  // exit teleporter: 2x2 pad in room farthest from spawn
  const sr=rooms[0];
  let exitRoom=rooms[rooms.length-1], bestD=-1;
  for (const r of rooms){
    const d=Math.hypot(r.cx-sr.cx, r.cy-sr.cy);
    if (d>bestD){ bestD=d; exitRoom=r; }
  }
  const ex=Math.floor(exitRoom.cx), ez=Math.floor(exitRoom.cy);
  for (let dy=0;dy<2;dy++) for (let dx=0;dx<2;dx++) floorK[ez+dy][ex+dx]=FLOOR.TELE;
  exitPoint = { x: ex+1, z: ez+1 };
  exitRoom.style='vault';

  // recharge pads: centre of every other room
  for (let i=1;i<rooms.length-1;i+=2){
    const r=rooms[i];
    floorK[Math.floor(r.cy)][Math.floor(r.cx)]=FLOOR.RECHARGE;
  }
  // lava: sparse speckles in big non-spawn rooms only
  for (let i=2;i<rooms.length;i+=3){
    const r=rooms[i];
    if (r===exitRoom) continue;
    if (r.w>8 && r.h>8){
      for (let j=Math.floor(r.y+2);j<Math.floor(r.y+r.h-2);j++)
        for (let i2=Math.floor(r.x+2);i2<Math.floor(r.x+r.w-2);i2++)
          if ((i2*7+j*13)%11===0) floorK[j][i2]=FLOOR.LAVA;
    }
  }

  // terminals: guaranteed one per room (on a border wall), facing the room
  const termTexts=[
    "UESC MARATHON — Engineering\n\nWelcome aboard, Security Officer. The Pfhor have boarded. Durandal is unresponsive.\n\nFind the exit teleporter. Collect weapons. Good luck.",
    "TERMINAL — Security Log\n\nPfhor Fighters fly and attack on sight. Hunters carry spread shots. Motion tracker online.\n\nWatch the green pads: they recharge your shields.",
    "TERMINAL — Durandal (fragment)\n\n...i have been dormant. the pfhor are not here to negotiate.\n\nfind me. there are things i must tell you about rampancy.",
    "TERMINAL — UESC Protocol\n\nTELEPORTER PADS: glowing blue cells transport sections.\nRECHARGE STATIONS: green cells restore shields.\n\nDoors open on approach. If one sticks, press F.",
    "TERMINAL — Engineering\n\nThe fusion reactor is unstable. Avoid lava pockets. Use the arena to train.\n\nExit teleporter is at the far end of the deck. Follow the tracker.",
  ];
  let ti=0;
  for (const r of rooms){
    // find a solid border cell adjacent to room floor
    const cands=[];
    for (let j=Math.floor(r.y)-1;j<=Math.floor(r.y+r.h);j++){
      for (let i=Math.floor(r.x)-1;i<=Math.floor(r.x+r.w);i++){
        if (i<1||j<1||i>=MAPX-1||j>=MAPY-1) continue;
        if (world[j][i]===0 || world[j][i]===WALL.DOOR) continue;
        let adj=false;
        for (let dy=-1;dy<=1&&!adj;dy++) for (let dx=-1;dx<=1;dx++){
          if (world[j+dy] && world[j+dy][i+dx]===0){ adj=true; break; }
        }
        if (adj) cands.push([i,j]);
      }
    }
    if (cands.length){
      const c=cands[Math.floor(rng()*cands.length)];
      world[c[1]][c[0]]=WALL.TERM;
      terminals.push({x:c[0],y:c[1],texts:[termTexts[ti%termTexts.length]]});
      ti++;
    }
  }

  // enemies: scaled by room size, never in spawn
  const types=['trooper','fighter','hunter'];
  for (let i=1;i<rooms.length;i++){
    const r=rooms[i];
    const area=r.w*r.h;
    const n=clamp(Math.floor(area/40),1,4);
    for (let k=0;k<n;k++){
      // retry loop: circle-room corners are solid, so don't spawn in walls
      let ex2=r.cx, ez2=r.cy;
      for (let t=0;t<14;t++){
        const cx2=r.x+1+rng()*(r.w-2), cz2=r.y+1+rng()*(r.h-2);
        if (!isSolid(cx2,cz2)){ ex2=cx2; ez2=cz2; break; }
      }
      const t = (r===exitRoom && k===0) ? 'hunter' : types[Math.floor(rng()*types.length)];
      enemySpawns.push({type:t,x:ex2,z:ez2,patrol:[[ex2,ez2],[r.cx,r.cy]]});
    }
  }

  // items: guaranteed progression + scatter
  // MA-75B rifle always in room 1 (next to spawn), shotgun ~room 4, rocket ~room 7, fusion near exit
  if (rooms[1]) items.push({type:'weapon',kind:2,x:rooms[1].cx,z:rooms[1].cy,taken:false});
  if (rooms[4]) items.push({type:'weapon',kind:3,x:rooms[4].cx,z:rooms[4].cy+1,taken:false});
  if (rooms[7]) items.push({type:'weapon',kind:4,x:rooms[7].cx,z:rooms[7].cy,taken:false});
  items.push({type:'weapon',kind:5,x:exitRoom.cx-2,z:exitRoom.cy-2,taken:false});
  for (let i=1;i<rooms.length;i++){
    const r=rooms[i];
    const cx=Math.floor(r.cx), cy=Math.floor(r.cy);
    if (i%2===0) items.push({type:'health',x:cx,z:cy,taken:false});
    if (i%2===1) items.push({type:'ammo',kind:'rifle',amt:30,x:cx+1,z:cy,taken:false});
    if (i%3===0) items.push({type:'ammo',kind:'magnum',amt:18,x:cx,z:cy+1,taken:false});
    if (i%4===2) items.push({type:'ammo',kind:'shotgun',amt:8,x:cx-1,z:cy,taken:false});
    if (i%5===3) items.push({type:'ammo',kind:'rocket',amt:3,x:cx,z:cy-1,taken:false});
    if (i%6===4) items.push({type:'ammo',kind:'fusion',amt:6,x:cx+1,z:cy+1,taken:false});
    if (i%3===1) items.push({type:'shield',x:cx-1,z:cy+1,taken:false});
  }

  // spawn point: centre of spawn room, facing room 1
  spawnPoint = { x: sr.cx, z: sr.cy, yaw: 0 };
  if (rooms[1]){
    const dx=rooms[1].cx-sr.cx, dz=rooms[1].cy-sr.cy;
    spawnPoint.yaw=Math.atan2(-dx,-dz);
  }
  // ceiling light anchors: every room centre (+ extras in big rooms)
  for (const r of rooms){
    roomLights.push({x:r.cx,z:r.cy,big:r.w*r.h>90});
    if (r.w>10&&r.h>9){
      roomLights.push({x:r.x+2,z:r.y+2,big:false});
      roomLights.push({x:r.x+r.w-2,z:r.y+r.h-2,big:false});
    }
  }
}
genLevel(1337);

function isSolid(x,z){
  const ix=Math.floor(x), iz=Math.floor(z);
  if (ix<0||iz<0||ix>=MAPX||iz>=MAPY) return true;
  const w=world[iz][ix];
  if (w===0) return false;
  if (w===WALL.DOOR && doorOpen(ix,iz)) return false;
  return true;
}

/* ---------- weapons ---------- */
const weapons = [
  {name:'FIST', ammo:null, dmg:12, range:2.0, cd:0.4, auto:false, pellets:1},
  {name:'MAGNUM', ammo:'magnum', dmg:16, range:70, cd:0.38, auto:false, pellets:1},
  {name:'MA-75B', ammo:'rifle', dmg:7, range:80, cd:0.105, auto:true, pellets:1},
  {name:'WSTE-M', ammo:'shotgun', dmg:10, range:16, cd:0.9, auto:false, pellets:6, spread:0.14},
  {name:'SPNKR', ammo:'rocket', dmg:55, range:0, cd:1.25, projectile:true},
  {name:'FUSION', ammo:'fusion', dmg:26, range:70, cd:0.6, auto:false, pellets:1},
];
let ownedWeapons=[0,1];

/* ---------- three.js ---------- */
const canvas = document.getElementById('screen');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070d);
scene.fog = new THREE.Fog(0x05070d, 12, 78);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.08, 140);
camera.rotation.order='YXZ';
scene.add(camera);
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
function resizeCanvas(){
  canvas.width=window.innerWidth; canvas.height=window.innerHeight;
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
}
resizeCanvas();

// Bright base lighting: nothing should ever be pitch black.
scene.add(new THREE.AmbientLight(0x8a94b8, 0.85));
const hemi = new THREE.HemisphereLight(0xbdd0ff, 0x30281e, 0.55);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xfff2dd, 0.35);
dir.position.set(20,30,10);
scene.add(dir);

// player flashlight (spot) + warm glow (point)
const flash = new THREE.SpotLight(0xfff4e0, 1.5, 46, 0.62, 0.45, 1.2);
scene.add(flash); scene.add(flash.target);
const playerGlow = new THREE.PointLight(0xbfd4ff, 0.85, 20, 1.6);
scene.add(playerGlow);

/* ---------- world meshes ---------- */
function makeTex(size, draw){
  const c=document.createElement('canvas'); c.width=size; c.height=size;
  const ctx=c.getContext('2d'); draw(ctx,c);
  const t=new THREE.CanvasTexture(c);
  t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter;
  t.wrapS=THREE.RepeatWrapping; t.wrapT=THREE.RepeatWrapping;
  return t;
}
function panelNoise(ctx,s,base,speck){
  ctx.fillStyle=base; ctx.fillRect(0,0,s,s);
  for(let i=0;i<260;i++){ ctx.fillStyle=speck; ctx.fillRect(Math.random()*s,Math.random()*s,2,2); }
}
const S=128;
const TX_STONE = makeTex(S,(ctx)=>{ panelNoise(ctx,S,'#4a4a58','rgba(0,0,0,0.28)');
  ctx.strokeStyle='rgba(20,20,28,0.9)'; ctx.lineWidth=3; ctx.strokeRect(2,2,S-4,S-4);
  ctx.fillStyle='rgba(255,255,255,0.07)'; ctx.fillRect(4,4,S-8,5); });
const TX_METAL = makeTex(S,(ctx)=>{ panelNoise(ctx,S,'#7a7d92','rgba(0,0,0,0.2)');
  ctx.strokeStyle='rgba(40,42,60,0.9)'; ctx.lineWidth=2;
  for(let i=0;i<=4;i++){ ctx.beginPath();ctx.moveTo(i*32,0);ctx.lineTo(i*32,S);ctx.stroke(); ctx.beginPath();ctx.moveTo(0,i*32);ctx.lineTo(S,i*32);ctx.stroke(); }
  ctx.fillStyle='rgba(255,255,255,0.10)';
  for(let i=0;i<4;i++)for(let j=0;j<4;j++) ctx.fillRect(4+i*32,4+j*32,4,4); });
const TX_DOOR = makeTex(S,(ctx)=>{ panelNoise(ctx,S,'#7a5a30','rgba(0,0,0,0.3)');
  ctx.fillStyle='#2c1f10'; ctx.fillRect(44,6,40,116);
  ctx.fillStyle='#ffcc44'; ctx.fillRect(58,10,12,8);
  ctx.strokeStyle='#1c1208'; ctx.lineWidth=4; ctx.strokeRect(40,2,48,124);
  ctx.fillStyle='rgba(255,220,120,0.25)'; ctx.fillRect(0,56,S,6); });
const TX_TERM = makeTex(S,(ctx)=>{ panelNoise(ctx,S,'#232a33','rgba(0,0,0,0.3)');
  ctx.fillStyle='#0c2a12'; ctx.fillRect(12,26,104,52);
  ctx.fillStyle='#39ff6a'; ctx.fillRect(16,30,96,10);
  for(let y=44;y<74;y+=7){ ctx.fillStyle='rgba(60,255,120,0.85)'; ctx.fillRect(16,y,60+Math.random()*30,4); }
  ctx.strokeStyle='#39ff6a'; ctx.lineWidth=3; ctx.strokeRect(12,26,104,52); });
const TX_TECH = makeTex(S,(ctx)=>{ panelNoise(ctx,S,'#233a66','rgba(0,0,0,0.3)');
  ctx.fillStyle='#101c38'; for(let i=0;i<5;i++) ctx.fillRect(8+i*24,18,14,92);
  ctx.fillStyle='rgba(90,160,255,0.9)'; for(let i=0;i<5;i++) ctx.fillRect(10+i*24,22,10,84);
  ctx.fillStyle='#ffd24a'; ctx.fillRect(0,60,S,5); });
const TX_BRICK = makeTex(S,(ctx)=>{ panelNoise(ctx,S,'#7a4a36','rgba(0,0,0,0.3)');
  ctx.fillStyle='rgba(30,12,8,0.8)';
  for(let y=0;y<S;y+=16){ for(let x=0;x<S;x+=32){ const off=((y/16)%2)*16; ctx.strokeStyle='rgba(30,12,8,0.9)'; ctx.lineWidth=3; ctx.strokeRect(x+off+1,y+1,30,14); } }
  ctx.fillStyle='rgba(255,200,150,0.12)'; ctx.fillRect(0,0,S,4); });
const WALL_TEX = {1:TX_STONE,2:TX_METAL,3:TX_DOOR,4:TX_TERM,5:TX_TECH,6:TX_BRICK};
const TX_FLOOR = makeTex(S,(ctx)=>{ panelNoise(ctx,S,'#2c3040','rgba(0,0,0,0.35)');
  ctx.strokeStyle='rgba(120,140,190,0.28)'; ctx.lineWidth=2; ctx.strokeRect(1,1,S-2,S-2);
  ctx.fillStyle='rgba(140,170,255,0.10)'; ctx.fillRect(56,56,16,16); });
TX_FLOOR.repeat.set(MAPX/3,MAPY/3);
const TX_CEIL = makeTex(S,(ctx)=>{ panelNoise(ctx,S,'#1b1e28','rgba(0,0,0,0.4)');
  ctx.strokeStyle='rgba(90,100,140,0.25)'; ctx.lineWidth=2; ctx.strokeRect(1,1,S-2,S-2); });
TX_CEIL.repeat.set(MAPX/3,MAPY/3);

const doorMeshes = new Map();
const wallGroup = new THREE.Group(); scene.add(wallGroup);
(function buildWalls(){
  const geo=new THREE.BoxGeometry(1,WALL_H,1);
  const mats={};
  for (const k of [1,2,3,4,5,6]) mats[k]=new THREE.MeshLambertMaterial({map:WALL_TEX[k]});
  const isRock=(v)=>v!==0; // doors/terms count as walls for culling neighbours
  for (let z=0;z<MAPY;z++) for (let x=0;x<MAPX;x++){
    const w=world[z][x];
    if (w===0) continue;
    // skip interior rock nobody can ever see (huge perf + build win)
    const n4=[world[z][x-1],world[z][x+1],(world[z-1]||[])[x],(world[z+1]||[])[x]];
    let visible=false;
    for (const n of n4){ if (n===0||n===undefined){ visible=true; break; } }
    // doors/terminals always visible (interactive)
    if (w===WALL.DOOR||w===WALL.TERM) visible=true;
    if (!visible && isRock(w)) continue;
    const m=new THREE.Mesh(geo,mats[w]||mats[1]);
    m.position.set(x+0.5, WALL_H/2, z+0.5);
    wallGroup.add(m);
    if (w===WALL.DOOR) doorMeshes.set(x+','+z,m);
  }
})();
// crates: rotated cover props (block movement, not sightlines)
for (const p of props){
  const m=new THREE.Mesh(new THREE.BoxGeometry(p.size,p.size,p.size), new THREE.MeshLambertMaterial({map:WALL_TEX[5]}));
  m.position.set(p.x,p.size/2,p.z);
  m.rotation.y=p.rot;
  scene.add(m);
}
// floor + ceiling
{
  const floorGeo=new THREE.PlaneGeometry(MAPX,MAPY);
  const floorMat=new THREE.MeshLambertMaterial({map:TX_FLOOR});
  const floor=new THREE.Mesh(floorGeo,floorMat);
  floor.rotation.x=-Math.PI/2; floor.position.set(MAPX/2,0,MAPY/2);
  scene.add(floor);
  const ceilGeo=new THREE.PlaneGeometry(MAPX,MAPY);
  const ceilMat=new THREE.MeshLambertMaterial({map:TX_CEIL});
  const ceil=new THREE.Mesh(ceilGeo,ceilMat);
  ceil.rotation.x=Math.PI/2; ceil.position.set(MAPX/2,WALL_H,MAPY/2);
  scene.add(ceil);
}
// ceiling light fixtures (emissive) + a capped set of real point lights
const padMeshes=[];
{
  const fixGeo=new THREE.PlaneGeometry(1.4,0.7);
  const fixMat=new THREE.MeshBasicMaterial({color:0xd8e6ff});
  const fixMatWarm=new THREE.MeshBasicMaterial({color:0xffe2b0});
  let realLights=0;
  for (const L of roomLights){
    const f=new THREE.Mesh(fixGeo, realLights%3===0?fixMatWarm:fixMat);
    f.rotation.x=Math.PI/2; f.position.set(L.x, WALL_H-0.03, L.z);
    scene.add(f);
    // real light for spawn + every ~3rd room + big rooms, capped
    if (realLights<14 && (L.x===rooms[0].cx || roomLights.indexOf(L)%3===0 || L.big)){
      const pl=new THREE.PointLight(0xcfe0ff, 0.75, 22, 1.4);
      pl.position.set(L.x, WALL_H-0.5, L.z);
      scene.add(pl);
      realLights++;
    }
  }
  // extra punch: spawn room gets its own bright light so spawn is never dark
  const sp=new THREE.PointLight(0xffffff, 1.0, 26, 1.2);
  sp.position.set(rooms[0].cx, WALL_H-0.6, rooms[0].cy);
  scene.add(sp);
  // exit beacon light
  const ex=new THREE.PointLight(0x4477ff, 1.4, 24, 1.3);
  ex.position.set(exitPoint.x, 1.6, exitPoint.z);
  scene.add(ex); padMeshes.push(ex);
}
// special floor pads
const teleMats=[], rechargeMats=[], lavaMats=[];
for (let z=0;z<MAPY;z++) for (let x=0;x<MAPX;x++){
  const k=floorK[z][x];
  if (k===FLOOR.NORMAL) continue;
  const g=new THREE.PlaneGeometry(0.96,0.96);
  const c = k===FLOOR.TELE?0x3a78ff : (k===FLOOR.RECHARGE?0x36ff70:0xff3a22);
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:k===FLOOR.LAVA?0.85:0.75}));
  m.rotation.x=-Math.PI/2; m.position.set(x+0.5,0.02,z+0.5);
  scene.add(m);
  if (k===FLOOR.TELE) teleMats.push(m.material);
  else if (k===FLOOR.RECHARGE) rechargeMats.push(m.material);
  else lavaMats.push(m.material);
}
// exit beacon column
{
  const g=new THREE.CylinderGeometry(0.9,0.9, WALL_H, 16, 1, true);
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0x4477ff,transparent:true,opacity:0.22,side:THREE.DoubleSide,depthWrite:false}));
  m.position.set(exitPoint.x, WALL_H/2, exitPoint.z);
  scene.add(m); padMeshes.push(m);
}

/* ---------- gun viewmodel ---------- */
const gun = new THREE.Group();
{
  const dark=new THREE.MeshLambertMaterial({color:0x1c2230});
  const mid=new THREE.MeshLambertMaterial({color:0x3a4a66});
  const glow=new THREE.MeshBasicMaterial({color:0x66ccff});
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.13,0.16,0.55),dark); gun.add(body);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.4,8),mid);
  barrel.rotation.x=Math.PI/2; barrel.position.set(0,0.03,-0.4); gun.add(barrel);
  const sight=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.05,0.06),mid); sight.position.set(0,0.11,-0.1); gun.add(sight);
  const dot=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.02,0.02),glow); dot.position.set(0,0.135,-0.1); gun.add(dot);
  gun.position.set(0.3,-0.27,-0.62);
  camera.add(gun);
}
const muzzle = new THREE.Mesh(new THREE.PlaneGeometry(0.3,0.3), new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:0}));
muzzle.position.set(0,0.03,-0.62); gun.add(muzzle);
const muzzleLight = new THREE.PointLight(0xffc24a, 0, 9, 1.6);
muzzleLight.position.set(0.3,-0.1,-1.2); camera.add(muzzleLight);
let muzzleT=0;

/* ---------- entities ---------- */
const enemies=[];
function spawnEnemy(type,x,z,patrol){ enemies.push({type,x,z,y:0,health:typeHp(type),dead:false,flash:0,state:'patrol',patrol:patrol||[[x,z]],pi:0,attackCd:0,alert:0,path:null,pathI:0,repathT:Math.random()*0.6,lastX:x,lastZ:z,stuckT:0,strafeDir:Math.random()<0.5?-1:1,strafeT:1+Math.random()*2,stepBack:0,leashX:x,leashZ:z}) }
function typeHp(t){ return t==='fighter'?16:t==='hunter'?34:22; }

/* grid BFS pathfinding so enemies route around walls instead of jamming */
function passableForPath(x,z){
  if (x<0||z<0||x>=MAPX||z>=MAPY) return false;
  const v=world[z][x];
  return v===0||v===WALL.DOOR; // doors auto-open, treat as passable
}
function findPath(sx,sz,tx,tz){
  sx=Math.floor(sx); sz=Math.floor(sz); tx=Math.floor(tx); tz=Math.floor(tz);
  if (sx===tx&&sz===tz) return [];
  if (!passableForPath(tx,tz)){
    let found=false;
    for (let r=1;r<3&&!found;r++) for (let dz=-r;dz<=r&&!found;dz++) for (let dx=-r;dx<=r;dx++){
      if (passableForPath(tx+dx,tz+dz)){ tx+=dx; tz+=dz; found=true; break; }
    }
    if (!found) return [];
  }
  const W=MAPX,H=MAPY;
  const prev=new Int32Array(W*H).fill(-1);
  const seen=new Uint8Array(W*H);
  const qx=[sx],qz=[sz];
  seen[sz*W+sx]=1;
  let qh=0, expand=0, ok=false;
  while (qh<qx.length && expand<7000){
    const x=qx[qh],z=qz[qh]; qh++; expand++;
    if (x===tx&&z===tz){ ok=true; break; }
    if (x+1<W){ const nx=x+1,k=z*W+nx; if(!seen[k]&&passableForPath(nx,z)){seen[k]=1;prev[k]=z*W+x;qx.push(nx);qz.push(z);} }
    if (x-1>=0){ const nx=x-1,k=z*W+nx; if(!seen[k]&&passableForPath(nx,z)){seen[k]=1;prev[k]=z*W+x;qx.push(nx);qz.push(z);} }
    if (z+1<H){ const nz=z+1,k=nz*W+x; if(!seen[k]&&passableForPath(x,nz)){seen[k]=1;prev[k]=z*W+x;qx.push(x);qz.push(nz);} }
    if (z-1>=0){ const nz=z-1,k=nz*W+x; if(!seen[k]&&passableForPath(x,nz)){seen[k]=1;prev[k]=z*W+x;qx.push(x);qz.push(nz);} }
  }
  if (!ok) return [];
  const cells=[]; let k=tz*W+tx; const start=sz*W+sx;
  let guard=8000;
  while (k!==start && k>=0 && guard-->0){ cells.push([k%W,Math.floor(k/W)]); k=prev[k]; }
  cells.reverse();
  return cells.map(([x,z])=>[x+0.5,z+0.5]);
}
function collideProps(x,z,r){
  for (const p of props){
    const dx=x-p.x, dz=z-p.z;
    const d=Math.hypot(dx,dz), min=r+p.r;
    if (d<min && d>0.0001){
      // never resolve into a wall: a squeeze between crate and wall
      // briefly overlaps the crate instead of clipping through geometry
      const nx=p.x+dx/d*min, nz=p.z+dz/d*min;
      if (!isSolid(nx,nz)){ x=nx; z=nz; }
    }
  }
  return [x,z];
}
function moveEnemy(e,vx,vz,dt){
  if (!isSolid(e.x+vx*dt,e.z)) e.x+=vx*dt;
  if (!isSolid(e.x,e.z+vz*dt)) e.z+=vz*dt;
  const c=collideProps(e.x,e.z,0.35);
  e.x=c[0]; e.z=c[1];
}

const enemyMeshes=new Map();
function ensureEnemyMesh(e){
  if (enemyMeshes.has(e)) return enemyMeshes.get(e);
  const g=new THREE.Group();
  const color=e.type==='fighter'?0x58d868:(e.type==='hunter'?0xff8a3c:0x7aa2ff);
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.72,1.25,0.72), new THREE.MeshLambertMaterial({color, emissive:0x000000}));
  body.position.y=0.75; g.add(body);
  const visor=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.16,0.1), new THREE.MeshBasicMaterial({color:e.type==='hunter'?0xff2222:0xddff55}));
  visor.position.set(0,1.32,-0.32); g.add(visor);
  const legs=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.35,0.5), new THREE.MeshLambertMaterial({color:0x222633}));
  legs.position.y=0.18; g.add(legs);
  scene.add(g);
  enemyMeshes.set(e,g);
  return g;
}

const itemMeshes=new Map();
function ensureItemMesh(it){
  if (itemMeshes.has(it)) return itemMeshes.get(it);
  let m;
  if (it.type==='health'){
    m=new THREE.Group();
    const box=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.4,0.4), new THREE.MeshBasicMaterial({color:0xf2f2f2}));
    const c1=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.1,0.42), new THREE.MeshBasicMaterial({color:0xff3344}));
    const c2=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.3,0.42), new THREE.MeshBasicMaterial({color:0xff3344}));
    m.add(box); m.add(c1); m.add(c2);
  } else if (it.type==='shield'){
    m=new THREE.Mesh(new THREE.OctahedronGeometry(0.28), new THREE.MeshBasicMaterial({color:0x44aaff}));
  } else if (it.type==='weapon'){
    m=new THREE.Group();
    const b=new THREE.Mesh(new THREE.BoxGeometry(0.25,0.25,0.9), new THREE.MeshBasicMaterial({color:0xffe14a}));
    const tip=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,0.2), new THREE.MeshBasicMaterial({color:0xffffff}));
    tip.position.z=-0.5; m.add(b); m.add(tip);
  } else {
    const col=it.kind==='rocket'?0xff5533:(it.kind==='shotgun'?0xffaa33:(it.kind==='fusion'?0x66eeff:0xffd24a));
    m=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.34,0.34), new THREE.MeshBasicMaterial({color:col}));
  }
  scene.add(m);
  itemMeshes.set(it,m);
  return m;
}

const projectiles=[]; // {mesh, x,z,vx,vz,dmg,life,enemy}
const particles=[];

/* ---------- player ---------- */
const player = {
  x:spawnPoint.x, z:spawnPoint.z, y:EYE_H,
  yaw:spawnPoint.yaw, pitch:0,
  vx:0, vz:0, vy:0,
  onGround:true,
  hp:100, shield:0, oxygen:100,
  weapon:1,
  ammo:{magnum:60,rifle:0,shotgun:0,rocket:0,fusion:0},
  lastShot:0, shooting:false, useCooldown:0,
  speed:4.1, runMult:1.55,
  bob:0,
};

/* ---------- input ---------- */
let keys={};
let mouseLocked=false;
let started=false,paused=false,dead=false,won=false;
let damageFlash=0, msgUntil=0, msgText='';
let hitmarkT=0;

window.addEventListener('keydown',(e)=>{
  keys[e.code]=true;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)) e.preventDefault();
  if (!started) return;
  if (e.code==='Tab'){ toggleMap(); return; }
  if (e.code.startsWith('Digit')){ const n=parseInt(e.code.slice(5)); if (n>=1 && n<=ownedWeapons.length) { player.weapon=ownedWeapons[n-1]; blip(500,0.05,'square',0.07); } }
  if (e.code==='KeyF') interact();
  if (e.code==='KeyM'){ /* tracker zoom: widen range */ trackerZoom = trackerZoom===16?26:16; msg('Tracker '+(trackerZoom===26?'zoomed out':'zoomed in')); }
  if (e.code==='Escape'){ if (!termOverlay.classList.contains('hidden')) closeTerm(); else { paused=!paused; $('pause-menu').classList.toggle('hidden',!paused); if(paused) document.exitPointerLock(); else canvas.requestPointerLock(); } }
});
window.addEventListener('keyup',(e)=>{keys[e.code]=false;});
canvas.addEventListener('mousedown',(e)=>{ if(e.button===0){ player.shooting=true; tryShoot(); }});
canvas.addEventListener('mouseup',(e)=>{ if(e.button===0) player.shooting=false;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('wheel',(e)=>{ if(!started)return; const idx=ownedWeapons.indexOf(player.weapon); const dir=e.deltaY>0?1:-1; const nidx=(idx+dir+ownedWeapons.length)%ownedWeapons.length; player.weapon=ownedWeapons[nidx]; });
let trackerZoom=16;

canvas.addEventListener('click',()=>{ if(started&&!paused&&!dead&&!won) canvas.requestPointerLock(); });
document.addEventListener('pointerlockchange',()=>{ mouseLocked=(document.pointerLockElement===canvas); if(!mouseLocked && started && !paused && !dead && !won && termOverlay.classList.contains('hidden')){ paused=true; $('pause-menu').classList.remove('hidden'); } });
document.addEventListener('mousemove',(e)=>{ if(!mouseLocked) return; player.yaw -= e.movementX*0.0025; player.pitch -= e.movementY*0.002; player.pitch=clamp(player.pitch,-Math.PI/3,Math.PI/3); });

/* touch */
let touchDevice=('ontouchstart' in window);
if (touchDevice){ $('touch-controls').style.display='block'; let jx=0,jy=0; const joy=$('joy'); const knob=$('joy-knob');
  joy.addEventListener('touchmove',(e)=>{e.preventDefault();const r=joy.getBoundingClientRect();const t=e.touches[0];const dx=t.clientX-(r.left+r.width/2);const dy=t.clientY-(r.top+r.height/2);const mag=Math.hypot(dx,dy);const cl=Math.min(mag,38);const ang=Math.atan2(dy,dx); jx=Math.cos(ang)*(cl/38); jy=Math.sin(ang)*(cl/38); knob.style.transform=`translate(${jx*38-20}px,${jy*38-20}px)`; });
  joy.addEventListener('touchend',()=>{jx=0;jy=0;knob.style.transform='translate(-50%,-50%)';});
  $('fire-btn').addEventListener('touchstart',()=>{player.shooting=true;tryShoot();});
  $('fire-btn').addEventListener('touchend',()=>{player.shooting=false;});
  $('jump-btn').addEventListener('touchstart',()=>{keys['Space']=true;});
  $('jump-btn').addEventListener('touchend',()=>{keys['Space']=false;});
  $('use-btn').addEventListener('touchstart',()=>interact());
  $('map-btn').addEventListener('touchstart',()=>{ if(started) toggleMap(); });
  window._joy=()=>({x:jx,y:jy});
}

/* ---------- hud refs ---------- */
const titleScreen=$('title-screen');
const playBtn=$('play-btn');
const hud=$('hud');
const termOverlay=$('terminal-overlay');
const termBox=$('terminal-box');
const pauseMenu=$('pause-menu');
const resumeBtn=$('resume-btn');
const restartBtn=$('restart-btn');
const weaponBar=$('weapon-bar');
const healthFill=$('health-fill');
const shieldFill=$('shield-fill');
const oxygenFill=$('oxygen-fill');
const ammoLabel=$('ammo-label');
const coordLabel=$('coord-label');
const locLabel=$('loc-label');
const exitLabel=$('exit-label');
const msgLog=$('msg-log');
const tracker=$('tracker');
const vignette=$('damage-vignette');
const hitmarker=$('hitmarker');

resumeBtn.addEventListener('click',()=>{ paused=false; pauseMenu.classList.add('hidden'); canvas.requestPointerLock();});
restartBtn.addEventListener('click',()=>{ titleScreen.classList.remove('hidden'); const b=titleScreen.querySelector('.click-play'); if(b) b.textContent='CLICK TO PLAY'; started=false; pauseMenu.classList.add('hidden'); hud.classList.add('hidden'); });

/* ---------- audio ---------- */
let AC=null;
function ac(){ if(!AC){ try{ AC=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if(AC&&AC.state==='suspended')AC.resume(); return AC; }
function blip(freq=440,dur=0.08,type='square',vol=0.12,slide=0){ try{ const c=ac(); if(!c)return; const t=c.currentTime,o=c.createOscillator(),g=c.createGain(); o.type=type; o.frequency.setValueAtTime(freq,t); if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),t+dur); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+dur+0.02);}catch(e){} }
function noise(dur=0.12,vol=0.15,low=400){ try{const c=ac(); if(!c)return; const t=c.currentTime,len=Math.floor(c.sampleRate*dur),buf=c.createBuffer(1,len,c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);const s=c.createBufferSource();s.buffer=buf;const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=low;const g=c.createGain();g.gain.value=vol;s.connect(f);f.connect(g);g.connect(c.destination);s.start(t);}catch(e){} }

/* ---------- movement ---------- */
function updatePlayer(dt){
  let jx=0,jy=0; if(window._joy){const j=window._joy();jx=j.x;jy=j.y;}
  const fwd=(keys['KeyW']||keys['ArrowUp'])?1:0;
  const back=(keys['KeyS']||keys['ArrowDown'])?1:0;
  const left=(keys['KeyA']||keys['ArrowLeft'])?1:0;
  const right=(keys['KeyD']||keys['ArrowRight'])?1:0;
  const sprint=keys['ShiftLeft']||keys['ShiftRight'];
  const jump=keys['Space'];
  const mFwd=fwd-back - jy;
  const mSide=right-left + jx;
  const speed=player.speed*(sprint?player.runMult:1);
  const fx=-Math.sin(player.yaw), fz=-Math.cos(player.yaw);
  const rx=Math.cos(player.yaw), rz=-Math.sin(player.yaw);
  const tx=(fx*mFwd + rx*mSide)*speed;
  const tz=(fz*mFwd + rz*mSide)*speed;
  const accel=14*dt;
  player.vx += (tx-player.vx)*Math.min(1,accel);
  player.vz += (tz-player.vz)*Math.min(1,accel);
  if (mFwd===0 && mSide===0) { player.vx*=0.85; player.vz*=0.85; }
  // headbob
  const hSpeed=Math.hypot(player.vx,player.vz);
  if (hSpeed>0.5 && player.onGround) player.bob+=dt*hSpeed*1.6;
  // collision with player radius
  const R=0.32;
  let nx=player.x+player.vx*dt;
  if (isSolid(nx+R*Math.sign(player.vx||1),player.z+R) || isSolid(nx+R*Math.sign(player.vx||1),player.z-R) || isSolid(nx,player.z)) { player.vx*=-0.15; nx=player.x; }
  player.x=nx;
  let nz=player.z+player.vz*dt;
  if (isSolid(player.x+R, nz+R*Math.sign(player.vz||1)) || isSolid(player.x-R, nz+R*Math.sign(player.vz||1)) || isSolid(player.x,nz)) { player.vz*=-0.15; nz=player.z; }
  player.z=nz;
  player.x=clamp(player.x,0.4,MAPX-0.4);
  player.z=clamp(player.z,0.4,MAPY-0.4);
  const cp=collideProps(player.x,player.z,0.32);
  player.x=cp[0]; player.z=cp[1];
  // vertical
  player.vy -= 15*dt;
  if (player.vy<-20) player.vy=-20;
  let ny=player.y+player.vy*dt;
  if (ny<EYE_H){ ny=EYE_H; player.vy=0; player.onGround=true; } else player.onGround=false;
  if (ny>EYE_H+0.45){ ny=EYE_H+0.45; player.vy=0; }
  player.y=ny;
  if (jump && player.onGround){ player.vy=6.2; player.onGround=false; blip(420,0.05,'triangle',0.07); }
  // floor effects
  const ix=Math.floor(player.x), iz=Math.floor(player.z);
  const fc=(floorK[iz]||[])[ix];
  if (fc===FLOOR.LAVA) damagePlayer(dt*14,'lava');
  if (fc===FLOOR.RECHARGE) player.shield=Math.min(100,player.shield+dt*22);
  if (fc===FLOOR.TELE) winGame();
  player.oxygen=Math.min(100,player.oxygen+dt*5);
  // items
  for (const it of items){
    if (it.taken) continue;
    if (Math.hypot(it.x-player.x,it.z-player.z)<1.0){ pickup(it); it.taken=true; }
  }
  updateEnemies(dt);
  updateProjectiles(dt);
  updateParticles(dt);
  // doors: proximity auto-open (enemies open them too, or they jam) + timer close
  for (const [k,d] of doors){
    const [dx,dz]=k.split(',').map(Number);
    const dist=Math.hypot(dx+0.5-player.x, dz+0.5-player.z);
    let enemyNear=false;
    if (dist>2.3){
      for (const e of enemies){
        if (e.dead) continue;
        if (Math.hypot(dx+0.5-e.x,dz+0.5-e.z)<1.9){ enemyNear=true; break; }
      }
    }
    if ((dist<2.3||enemyNear) && !d.open){ d.open=true; d.timer=5; if (dist<2.3) blip(300,0.12,'sine',0.1,150); }
    if (d.open){ d.timer-=dt; if (d.timer<=0 && dist>1.4) d.open=false; }
    const mesh=doorMeshes.get(k);
    if (mesh) mesh.visible=!d.open;
  }
  if (player.shooting && weapons[player.weapon].auto) tryShoot();
  if (player.useCooldown>0) player.useCooldown-=dt;
  exploreT-=dt;
  if (exploreT<=0){ exploreT=0.25; markExplored(); }
  if (damageFlash>0) damageFlash-=dt;
  if (muzzleT>0){ muzzleT-=dt; if(muzzleT<=0){ muzzle.material.opacity=0; muzzleLight.intensity=0; } }
  if (hitmarkT>0){ hitmarkT-=dt; if(hitmarkT<=0) hitmarker.classList.remove('show'); }
}

function pickup(it){
  if (it.type==='health'){ player.hp=Math.min(100,player.hp+25); player.shield=Math.min(100,player.shield+10); msg('+Health'); blip(520,0.12,'sine',0.15,120); }
  else if (it.type==='shield'){ player.shield=Math.min(100,player.shield+40); msg('+Shield'); blip(620,0.12,'sine',0.15,120); }
  else if (it.type==='ammo'){ player.ammo[it.kind]=(player.ammo[it.kind]||0)+ (it.amt||15); msg('Ammo +'+it.amt+' '+it.kind); blip(440,0.08,'triangle',0.12); }
  else if (it.type==='weapon'){ if(!ownedWeapons.includes(it.kind)){ ownedWeapons.push(it.kind); ownedWeapons.sort((a,b)=>a-b); } player.weapon=it.kind; msg('Acquired '+weapons[it.kind].name); blip(700,0.2,'sine',0.2,200); }
}

function damagePlayer(n,src){
  if (dead||won) return;
  if (player.shield>0){ const t=Math.min(player.shield,n); player.shield-=t; n-=t; }
  if (n>0){ player.hp-=n; damageFlash=0.3; blip(110,0.2,'sawtooth',0.2,-40); if (player.hp<=0){ player.hp=0; die(src); } }
}

function die(src){ dead=true; document.exitPointerLock(); msg('YOU DIED — '+src); setTimeout(()=>{ titleScreen.classList.remove('hidden'); const b=titleScreen.querySelector('.click-play'); if(b)b.textContent='RETRY'; started=false; },1500); }
function winGame(){
  if(won) return; won=true; document.exitPointerLock();
  const left=enemies.filter(e=>!e.dead).length;
  msg(left===0?'EXIT REACHED — DECK CLEARED!':'EXIT REACHED — '+left+' hostiles remain');
  blip(523,0.15,'sine',0.2); setTimeout(()=>blip(659,0.15,'sine',0.2),150); setTimeout(()=>blip(784,0.15,'sine',0.2),300); setTimeout(()=>blip(1046,0.35,'sine',0.25),450);
  setTimeout(()=>{ titleScreen.classList.remove('hidden'); const b=titleScreen.querySelector('.click-play'); if(b)b.textContent='PLAY AGAIN'; started=false; },2500);
}

/* ---------- enemies ---------- */
function updateEnemies(dt){
  // separation so enemies don't stack inside each other
  for (let i=0;i<enemies.length;i++){
    const a=enemies[i]; if (a.dead) continue;
    for (let j=i+1;j<enemies.length;j++){
      const b=enemies[j]; if (b.dead) continue;
      const dx=b.x-a.x, dz=b.z-a.z;
      const d=Math.hypot(dx,dz);
      if (d<1.0 && d>0.0001){
        const push=(1.0-d)*0.5;
        const nx=dx/d, nz=dz/d;
        if (!isSolid(a.x-nx*push,a.z-nz*push)){ a.x-=nx*push; a.z-=nz*push; }
        if (!isSolid(b.x+nx*push,b.z+nz*push)){ b.x+=nx*push; b.z+=nz*push; }
      }
    }
  }
  for (const e of enemies){
    if (e.dead) continue;
    e.flash=Math.max(0,e.flash-dt);
    const dx=player.x-e.x, dz=player.z-e.z, dist=Math.hypot(dx,dz);
    const los = dist<18 && hasLOS(e.x,e.z,player.x,player.z);
    if (los){ e.alert=3; e.state='chase'; }
    e.alert=Math.max(0,e.alert-dt);
    if (e.state==='chase' && e.alert<=0) e.state='patrol';
    // leash: give up far from home so the whole map doesn't pile onto you
    if (e.state==='chase' && Math.hypot(e.leashX-player.x,e.leashZ-player.z)>30){ e.state='patrol'; e.alert=0; e.path=null; }
    if (e.state==='chase'){
      const sp0=e.type==='fighter'?4.2:(e.type==='hunter'?2.9:2.3);
      const preferred=e.type==='fighter'?5.5:(e.type==='hunter'?4.2:1.4);
      const minRange=e.type==='fighter'?3.2:(e.type==='hunter'?2.4:0.95);
      e.repathT-=dt;
      if (e.repathT<=0){ e.path=findPath(e.x,e.z,player.x,player.z); e.pathI=0; e.repathT=0.7+Math.random()*0.5; }
      while (e.path && e.pathI<e.path.length && Math.hypot(e.path[e.pathI][0]-e.x,e.path[e.pathI][1]-e.z)<0.6) e.pathI++;
      let mx=0,mz=0;
      const nx=dist>0.001?dx/dist:0, nz=dist>0.001?dz/dist:0;
      if (e.stepBack>0){
        e.stepBack-=dt;
        mx=-nx*sp0*0.7; mz=-nz*sp0*0.7;
      } else if (los && dist<=minRange){
        // personal space: back off instead of running into the player
        mx=-nx*sp0*0.55; mz=-nz*sp0*0.55;
      } else if (los && dist<=preferred && e.type!=='trooper'){
        // ranged attackers strafe at preferred range instead of charging
        e.strafeT-=dt;
        if (e.strafeT<=0){ e.strafeDir*=-1; e.strafeT=1.2+Math.random()*1.8; }
        mx=-nz*e.strafeDir*sp0*0.6+nx*sp0*0.12;
        mz=nx*e.strafeDir*sp0*0.6+nz*sp0*0.12;
      } else if (e.path && e.pathI<e.path.length){
        const wp=e.path[e.pathI];
        const wx=wp[0]-e.x, wz=wp[1]-e.z, wl=Math.hypot(wx,wz)||1;
        mx=wx/wl*sp0; mz=wz/wl*sp0;
      } else {
        // no path (rare): steer with a sidestep bias so walls slide by
        // instead of jamming head-on
        mx=nx*sp0*0.8 + -nz*e.strafeDir*sp0*0.5;
        mz=nz*sp0*0.8 + nx*e.strafeDir*sp0*0.5;
      }
      moveEnemy(e,mx,mz,dt);
      // stuck detection: barely moved -> flip strafe + force repath
      e.stuckT+=dt;
      if (e.stuckT>0.8){
        if (Math.hypot(e.x-e.lastX,e.z-e.lastZ)<0.3){ e.strafeDir*=-1; e.repathT=0; e.strafeT=0; }
        e.lastX=e.x; e.lastZ=e.z; e.stuckT=0;
      }
      e.attackCd-=dt;
      const range=e.type==='hunter'?6:(e.type==='fighter'?7:1.8);
      if (dist<range && e.attackCd<=0 && hasLOS(e.x,e.z,player.x,player.z)){
        e.attackCd=e.type==='hunter'?1.3:(e.type==='fighter'?1.1:1.0);
        if (e.type==='hunter'){ damagePlayer(9,'hunter'); noise(0.08,0.15,400); blip(180,0.1,'sawtooth',0.15); spawnParticle(player.x,player.z,0xff8844,4); }
        else if (e.type==='fighter'){ projectiles.push(makeProj(e.x,e.z,player.x,player.z,8,true)); blip(240,0.08,'square',0.1); }
        else if (e.type==='trooper'){ damagePlayer(6,'trooper'); e.stepBack=0.45; blip(260,0.06,'square',0.12); }
      }
    } else {
      e.path=null;
      const wp=e.patrol[e.pi];
      if (Math.hypot(wp[0]-e.x,wp[1]-e.z)<0.6) e.pi=(e.pi+1)%e.patrol.length;
      const twp=e.patrol[e.pi];
      const pdx=twp[0]-e.x, pdz=twp[1]-e.z, plen=Math.hypot(pdx,pdz)||1;
      moveEnemy(e,pdx/plen*1.6,pdz/plen*1.6,dt);
    }
  }
}
function hasLOS(ax,az,bx,bz){ const dx=bx-ax,dz=bz-az,d=Math.hypot(dx,dz); const steps=Math.max(2,Math.ceil(d/0.25)); for (let i=1;i<steps;i++){ const t=i/steps; if (isSolid(ax+dx*t,az+dz*t)) return false; } return true; }
function makeProj(x,z,tx,tz,dmg,enemy){
  const d=Math.hypot(tx-x,tz-z)||1;
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(0.13,6,6), new THREE.MeshBasicMaterial({color:enemy?0xff6633:0xffcc44}));
  mesh.position.set(x,1.3,z); scene.add(mesh);
  return {mesh, x, z, vx:(tx-x)/d*9, vz:(tz-z)/d*9, dmg, life:enemy?2.2:3, enemy};
}

function tryShoot(){
  if (!started||paused||dead||won) return;
  const now=performance.now()/1000;
  const w=weapons[player.weapon];
  if (now-(player.lastShot||0)<w.cd) return;
  if (w.ammo){ if ((player.ammo[w.ammo]||0)<=0){ if(now-(player._oam||0)>1){ msg('Out of ammo — '+w.name); player._oam=now; } blip(200,0.08,'square',0.08,-60); player.lastShot=now; return;} player.ammo[w.ammo]--; }
  player.lastShot=now;
  muzzle.material.opacity=0.95; muzzleLight.intensity=2.2; muzzleT=0.06;
  gun.position.z=-0.55; // kick
  if (w.projectile){
    const fx=-Math.sin(player.yaw), fz=-Math.cos(player.yaw);
    const pr=makeProj(player.x,player.z, player.x+fx*3, player.z+fz*3, w.dmg, false);
    pr.vx=fx*11; pr.vz=fz*11;
    projectiles.push(pr);
    noise(0.15,0.25,300); blip(120,0.3,'sawtooth',0.22,-80);
  } else {
    const pellets=w.pellets||1; const spread=w.spread||0.012;
    for (let p=0;p<pellets;p++){
      const a=player.yaw+(Math.random()-0.5)*spread*2;
      const dx=-Math.sin(a), dz=-Math.cos(a);
      let hit=false;
      for (let d=0.3; d<w.range; d+=0.25){
        const cx=player.x+dx*d, cz=player.z+dz*d;
        if (isSolid(cx,cz)){ spawnParticle(cx,cz,0xffcc66,3); break; }
        for (const e of enemies){
          if (e.dead) continue;
          if (Math.hypot(e.x-cx,e.z-cz)<0.6){ damageEnemy(e,w.dmg/pellets); spawnParticle(e.x,e.z,0xff4444,5); hit=true; break; }
        }
        if (hit) break;
      }
    }
    if (w.name==='FUSION'){ blip(500,0.16,'sine',0.18,-200); noise(0.1,0.15,900); }
    else if (w.name==='WSTE-M'){ noise(0.18,0.3,500); blip(140,0.15,'square',0.15,-40); }
    else blip(320,0.05,'square',0.09,0);
  }
}
function damageEnemy(e,dmg){
  e.health-=dmg; e.flash=0.12; e.alert=3; e.state='chase';
  hitmarkT=0.18; hitmarker.classList.add('show');
  spawnParticle(e.x,e.z,0xff4444,4); noise(0.05,0.1,300);
  if (e.health<=0){ e.dead=true; spawnParticle(e.x,e.z,0xffaa33,16);
    if (Math.random()<0.35) items.push({type:'health',x:e.x,z:e.z,taken:false,drop:true});
    else if (Math.random()<0.3) items.push({type:'ammo',kind:'rifle',amt:12,x:e.x,z:e.z,taken:false,drop:true});
    blip(180,0.2,'sawtooth',0.15,-60);
  }
}
function spawnParticle(x,z,color,n=6){ for(let i=0;i<n;i++){ if(particles.length>240) particles.shift(); particles.push({x:x+(Math.random()-0.5)*0.4,z:z+(Math.random()-0.5)*0.4,y:0.9+Math.random()*0.6,color,vx:(Math.random()-0.5)*2,vz:(Math.random()-0.5)*2,vy:Math.random()*1.5,life:0.4+Math.random()*0.35}); } }
const particleMeshes=[];
function syncParticles(){
  while (particleMeshes.length>particles.length){ const m=particleMeshes.pop(); scene.remove(m); }
  for (let i=0;i<particles.length;i++){
    const p=particles[i];
    if (!particleMeshes[i]){
      const m=new THREE.Mesh(new THREE.SphereGeometry(0.06,4,4), new THREE.MeshBasicMaterial({color:p.color}));
      scene.add(m); particleMeshes.push(m);
    }
    particleMeshes[i].position.set(p.x,p.y||1.0,p.z);
    particleMeshes[i].material.color.setHex(p.color);
  }
}
function updateParticles(dt){ for (let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.life-=dt; p.x+=p.vx*dt; p.z+=p.vz*dt; p.y=(p.y||1)+ (p.vy||0)*dt; p.vy=(p.vy||0)-4*dt; if (p.life<=0) particles.splice(i,1); } syncParticles(); }

function updateProjectiles(dt){
  for (let i=projectiles.length-1;i>=0;i--){
    const pr=projectiles[i];
    pr.x+=pr.vx*dt; pr.z+=pr.vz*dt; pr.life-=dt;
    pr.mesh.position.set(pr.x,1.3,pr.z);
    if (isSolid(pr.x,pr.z)){ spawnParticle(pr.x,pr.z,pr.enemy?0xff5522:0xffcc44,8); scene.remove(pr.mesh); projectiles.splice(i,1); continue; }
    if (pr.enemy){
      if (Math.hypot(pr.x-player.x,pr.z-player.z)<0.5){ damagePlayer(pr.dmg||8,'alien bolt'); spawnParticle(pr.x,pr.z,0xff5522,6); scene.remove(pr.mesh); projectiles.splice(i,1); continue; }
    } else {
      let hit=false;
      for (const e of enemies){
        if (e.dead) continue;
        if (Math.hypot(e.x-pr.x,e.z-pr.z)<0.6){
          damageEnemy(e,pr.dmg||50);
          const r=2.6;
          for (const e2 of enemies){ if (e2===e||e2.dead) continue; const d2=Math.hypot(e2.x-pr.x,e2.z-pr.z); if (d2<r) damageEnemy(e2, (pr.dmg||50)*(1-d2/r)*0.7); }
          spawnParticle(pr.x,pr.z,0xffcc44,16); noise(0.25,0.32,150); scene.remove(pr.mesh); projectiles.splice(i,1); hit=true; break;
        }
      }
      if (hit) continue;
    }
    if (pr.life<=0){ scene.remove(pr.mesh); projectiles.splice(i,1); }
  }
}

/* ---------- interaction ---------- */
function interact(){
  if (player.useCooldown>0) return;
  player.useCooldown=0.4;
  let term=terminals.find(t=>Math.hypot((t.x+0.5)-player.x,(t.y+0.5)-player.z)<2.6);
  if (term){ openTerm(term); return; }
  const hx=Math.floor(player.x+(-Math.sin(player.yaw))*1.6);
  const hz=Math.floor(player.z+(-Math.cos(player.yaw))*1.6);
  if (world[hz] && world[hz][hx]===WALL.DOOR){ const key=hx+','+hz; const d=doors.get(key)||{open:false,timer:0}; d.open=!d.open; d.timer=d.open?6:0; doors.set(key,d); msg('Door '+(d.open?'opened':'closed')); blip(d.open?300:220,0.1,'sine',0.12); return; }
  const ix=Math.floor(player.x), iz=Math.floor(player.z);
  const fc=(floorK[iz]||[])[ix];
  if (fc===FLOOR.RECHARGE){ player.shield=Math.min(100,player.shield+40); msg('Shields recharged'); blip(600,0.2,'sine',0.2); }
  else if (fc===FLOOR.TELE) winGame();
  else msg('Nothing to use here');
}
function openTerm(t){ termOverlay.classList.remove('hidden'); document.exitPointerLock(); paused=true; termBox.innerHTML=(t.texts[0]||'...').replace(/\n/g,'<br>'); termBox.dataset.pages=JSON.stringify(t.texts); termBox.dataset.page='0'; blip(700,0.08,'square',0.08); }
function closeTerm(){ termOverlay.classList.add('hidden'); paused=false; canvas.requestPointerLock(); }
window.addEventListener('keydown',(e)=>{
  if (termOverlay.classList.contains('hidden')) return;
  if (e.code==='KeyF'){ closeTerm(); return; }
  if (e.code==='ArrowRight'||e.code==='ArrowDown'){ const pages=JSON.parse(termBox.dataset.pages); let p=parseInt(termBox.dataset.page); if(p<pages.length-1){p++;termBox.dataset.page=p;termBox.innerHTML=pages[p].replace(/\n/g,'<br>');}}
  if (e.code==='ArrowLeft'||e.code==='ArrowUp'){ const pages=JSON.parse(termBox.dataset.pages); let p=parseInt(termBox.dataset.page); if(p>0){p--;termBox.dataset.page=p;termBox.innerHTML=pages[p].replace(/\n/g,'<br>');}}
});

/* ---------- msg ---------- */
function msg(t,dur=2.5){ msgText=t; msgUntil=performance.now()/1000+dur; msgLog.textContent=t; msgLog.classList.remove('hidden'); }

/* ---------- hud ---------- */
function roomAt(x,z){
  for (let i=0;i<rooms.length;i++){ const r=rooms[i];
    if (x>=r.x&&x<r.x+r.w&&z>=r.y&&z<r.y+r.h) return {r,i};
  }
  return null;
}
function updateHud(){
  healthFill.style.width=player.hp+'%';
  shieldFill.style.width=player.shield+'%';
  oxygenFill.style.width=player.oxygen+'%';
  const w=weapons[player.weapon];
  ammoLabel.textContent=w.ammo? (w.name+'  '+(player.ammo[w.ammo]||0)) : w.name;
  coordLabel.textContent=Math.floor(player.x)+', '+Math.floor(player.z);
  const hit=roomAt(player.x,player.z);
  locLabel.textContent=hit? (STYLE_NAME[hit.r.style]||('Compartment '+(hit.i+1))) : 'Corridor';
  const ed=Math.hypot(exitPoint.x-player.x, exitPoint.z-player.z);
  exitLabel.textContent='EXIT: '+Math.round(ed)+'m '+(ed<8?'→ FOLLOW BLUE':'');
  weaponBar.innerHTML='';
  ownedWeapons.forEach((ws)=>{
    const d=document.createElement('div'); d.className='weapon-slot'+(ws===player.weapon?' active':'');
    d.textContent=weapons[ws].name.slice(0,4);
    const a=document.createElement('span'); a.className='ammo';
    const w2=weapons[ws]; a.textContent=w2.ammo?(player.ammo[w2.ammo]||0):'';
    d.appendChild(a); weaponBar.appendChild(d);
  });
  vignette.style.opacity=clamp(damageFlash*2.2 + (1-player.hp/100)*0.55, 0, 0.85);
}
function renderTracker(){
  tracker.innerHTML='<div class="tracker-sweep"></div>';
  const dot=document.createElement('div'); dot.className='tracker-dot player'; dot.style.left='50%'; dot.style.top='50%'; tracker.appendChild(dot);
  // exit beacon (blue)
  {
    const dx=exitPoint.x-player.x, dz=exitPoint.z-player.z;
    if (Math.hypot(dx,dz)<trackerZoom*1.5){
      const fwdx=-Math.sin(player.yaw), fwdz=-Math.cos(player.yaw);
      const rightx=Math.cos(player.yaw), rightz=-Math.sin(player.yaw);
      const rz=dx*fwdx+dz*fwdz, rx=dx*rightx+dz*rightz;
      const d=document.createElement('div'); d.className='tracker-dot exit';
      d.style.left=(50+(rx/(trackerZoom*1.5))*45)+'%'; d.style.top=(50-(rz/(trackerZoom*1.5))*45)+'%'; tracker.appendChild(d);
    }
  }
  const range=trackerZoom;
  const fwdx=-Math.sin(player.yaw), fwdz=-Math.cos(player.yaw);
  const rightx=Math.cos(player.yaw), rightz=-Math.sin(player.yaw);
  for (const e of enemies){
    if (e.dead) continue;
    const dx=e.x-player.x, dz=e.z-player.z;
    if (Math.hypot(dx,dz)>range) continue;
    const rz=dx*fwdx+dz*fwdz;
    const rx=dx*rightx+dz*rightz;
    const sx=50+(rx/range)*45;
    const sy=50-(rz/range)*45;
    const d=document.createElement('div'); d.className='tracker-dot enemy'; d.style.left=sx+'%'; d.style.top=sy+'%'; tracker.appendChild(d);
  }
}

/* ---------- automap ---------- */
const mapCanvas=$('map-canvas');
const mapCtx=mapCanvas.getContext('2d');
let exploreT=0;
function toggleMap(){
  if (!started) return;
  mapOpen=!mapOpen;
  $('automap').classList.toggle('hidden',!mapOpen);
  blip(mapOpen?600:400,0.06,'square',0.08);
  if (mapOpen) renderAutomap(performance.now());
}
function markExplored(){
  const px=Math.floor(player.x), pz=Math.floor(player.z);
  const R=9;
  for (let z=pz-R;z<=pz+R;z++) for (let x=px-R;x<=px+R;x++){
    if (x<0||z<0||x>=MAPX||z>=MAPY) continue;
    if (Math.hypot(x+0.5-player.x,z+0.5-player.z)>R) continue;
    if (hasLOS(player.x,player.z,x+0.5,z+0.5)) explored[z*MAPX+x]=1;
  }
  explored[pz*MAPX+px]=1;
}
function renderAutomap(now){
  const W=mapCanvas.width,H=mapCanvas.height;
  const s=Math.min(W/MAPX,H/MAPY);
  const ox=(W-MAPX*s)/2, oy=(H-MAPY*s)/2;
  mapCtx.fillStyle='#05070d'; mapCtx.fillRect(0,0,W,H);
  for (let z=0;z<MAPY;z++) for (let x=0;x<MAPX;x++){
    if (!explored[z*MAPX+x]) continue;
    const w=world[z][x];
    const fk=floorK[z][x];
    if (w===WALL.DOOR) mapCtx.fillStyle='#ffaa33';
    else if (w===WALL.TERM) mapCtx.fillStyle='#39ff6a';
    else if (w!==0) mapCtx.fillStyle='#5a6f96';
    else if (fk===FLOOR.TELE) mapCtx.fillStyle='#1a3a99';
    else if (fk===FLOOR.RECHARGE) mapCtx.fillStyle='#144a22';
    else if (fk===FLOOR.LAVA) mapCtx.fillStyle='#6a1a10';
    else mapCtx.fillStyle='#141c30';
    mapCtx.fillRect(ox+x*s,oy+z*s,Math.ceil(s),Math.ceil(s));
  }
  mapCtx.fillStyle='#ffe14a';
  for (const it of items){
    if (it.taken||it.type!=='weapon') continue;
    const ix=Math.floor(it.x), iz=Math.floor(it.z);
    if (ix<0||iz<0||ix>=MAPX||iz>=MAPY||!explored[iz*MAPX+ix]) continue;
    mapCtx.fillRect(ox+it.x*s-2,oy+it.z*s-2,4,4);
  }
  mapCtx.fillStyle='#ff4444';
  for (const e of enemies){
    if (e.dead) continue;
    const ix=Math.floor(e.x), iz=Math.floor(e.z);
    if (ix<0||iz<0||ix>=MAPX||iz>=MAPY||!explored[iz*MAPX+ix]) continue;
    mapCtx.fillRect(ox+e.x*s-2,oy+e.z*s-2,4,4);
  }
  const pulse=3+Math.sin(now/300)*1.5;
  mapCtx.fillStyle='#4a8aff';
  mapCtx.fillRect(ox+exitPoint.x*s-pulse,oy+exitPoint.z*s-pulse,pulse*2,pulse*2);
  const px=ox+player.x*s, py=oy+player.z*s;
  mapCtx.save();
  mapCtx.translate(px,py);
  mapCtx.rotate(Math.atan2(-Math.cos(player.yaw),-Math.sin(player.yaw)));
  mapCtx.fillStyle='#ffffff';
  mapCtx.beginPath(); mapCtx.moveTo(7,0); mapCtx.lineTo(-5,5); mapCtx.lineTo(-5,-5); mapCtx.closePath(); mapCtx.fill();
  mapCtx.restore();
}

/* ---------- sync visuals ---------- */
function syncEnemies(){
  for (const e of enemies){
    const m=ensureEnemyMesh(e);
    if (e.dead){ m.visible=false; continue; }
    m.visible=true;
    m.position.set(e.x,Math.abs(Math.sin(performance.now()/300+e.x))*0.06,e.z);
    m.rotation.y=Math.atan2(player.x-e.x, player.z-e.z);
    const flashOn=e.flash>0;
    m.children[0].material.emissive=new THREE.Color(flashOn?0xaa2222:0x000000);
  }
}
function syncItems(){
  const t=performance.now()/500;
  for (const it of items){
    const m=ensureItemMesh(it);
    const vis=!it.taken;
    m.visible=vis;
    if (!vis) continue;
    if (m.position) m.position.set(it.x, 0.55 + Math.sin(t+it.x)*0.15, it.z);
    if (m.rotation) m.rotation.y=t*0.8+it.x;
  }
}

/* ---------- main loop ---------- */
let lastTime=performance.now();
function frame(now){
  const dt=Math.min(0.05,(now-lastTime)/1000);
  lastTime=now;
  if (started && !paused && !dead && !won){
    updatePlayer(dt);
  }
  if (started){
    const bobY=Math.sin(player.bob*2)*0.045*Math.min(1,Math.hypot(player.vx,player.vz)/4);
    camera.position.set(player.x, player.y+bobY, player.z);
    camera.rotation.set(player.pitch, player.yaw, Math.sin(player.bob)*0.004);
    // gun recover + sway
    gun.position.z += (-0.62-gun.position.z)*Math.min(1,dt*10);
    gun.position.y=-0.27+Math.sin(player.bob*2)*0.008;
    gun.rotation.x=weapons[player.weapon].projectile? -0.04:0;
    // lights follow
    const fx=-Math.sin(player.yaw), fz=-Math.cos(player.yaw);
    flash.position.set(player.x, player.y, player.z);
    flash.target.position.set(player.x+fx*6, player.y-0.4+player.pitch*4, player.z+fz*6);
    playerGlow.position.set(player.x, player.y+0.3, player.z);
    // pad pulse
    const pt=now/600;
    for (const m of teleMats) m.opacity=0.55+Math.sin(pt)*0.25;
    for (const m of rechargeMats) m.opacity=0.5+Math.sin(pt*1.3)*0.2;
  }
  syncEnemies(); syncItems();
  updateParticles(0); // keep particle meshes in sync even when paused
  renderer.render(scene,camera);
  if (started){
    updateHud(); renderTracker();
    if (mapOpen) renderAutomap(now);
    if (performance.now()/1000>msgUntil && !msgLog.classList.contains('hidden')) msgLog.classList.add('hidden');
  }
  requestAnimationFrame(frame);
}

/* ---------- init ---------- */
playBtn.addEventListener('click',()=>{
  ac();
  titleScreen.classList.add('hidden');
  started=true; paused=false; dead=false; won=false;
  player.x=spawnPoint.x; player.z=spawnPoint.z; player.y=EYE_H;
  player.hp=100; player.shield=25; player.oxygen=100;
  player.ammo={magnum:60,rifle:0,shotgun:0,rocket:0,fusion:0};
  ownedWeapons=[0,1]; player.weapon=1;
  player.yaw=spawnPoint.yaw; player.pitch=0;
  player.vx=0; player.vz=0; player.vy=0; player.bob=0;
  damageFlash=0;
  explored.fill(0); mapOpen=false; $('automap').classList.add('hidden');
  { // pre-reveal spawn area so the map isn't empty
    const px=Math.floor(spawnPoint.x), pz=Math.floor(spawnPoint.z);
    for (let z=pz-9;z<=pz+9;z++) for (let x=px-9;x<=px+9;x++){
      if (x<0||z<0||x>=MAPX||z>=MAPY) continue;
      if (Math.hypot(x+0.5-spawnPoint.x,z+0.5-spawnPoint.z)<9) explored[z*MAPX+x]=1;
    }
  }
  for (const it of items) it.taken=false;
  // remove drop-items spawned by kills (keep original layout: flag them)
  for (let i=items.length-1;i>=0;i--){ if (items[i].drop) { const m=itemMeshes.get(items[i]); if(m){scene.remove(m.isGroup?m:m); } itemMeshes.delete(items[i]); items.splice(i,1); } }
  for (const [e,m] of enemyMeshes){ scene.remove(m); } enemyMeshes.clear();
  enemies.length=0;
  for (const s of enemySpawns) spawnEnemy(s.type, s.x, s.z, s.patrol);
  for (const [k,d] of doors){ d.open=false; d.timer=0; const mesh=doorMeshes.get(k); if(mesh) mesh.visible=true; }
  for (const m of projectiles){ scene.remove(m.mesh); } projectiles.length=0;
  particles.length=0;
  hud.classList.remove('hidden');
  canvas.requestPointerLock();
  msg('Welcome to the Marathon. Follow the blue beacon to the exit.');
  blip(440,0.15,'triangle',0.15);
});
// tag future drops so restart can clean them
const _push=items.push.bind(items);
items.push=function(...a){ for(const it of a) if(!('taken' in it)) it.taken=false; return _push(...a); };

setInterval(()=>{ if (started && !paused && !dead && !won && player.shooting && weapons[player.weapon].auto) tryShoot(); }, 80);

requestAnimationFrame(frame);
updateHud();

window.addEventListener('resize',resizeCanvas);
