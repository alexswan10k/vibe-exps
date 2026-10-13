/* =============================================================================
   VoxelVerse — chunk mesher
   -----------------------------------------------------------------------------
   Pure JavaScript. No THREE, no DOM, no modules. Loaded with a plain
   <script src> tag and it publishes one global, VoxelMesher.

   Everything here is a plain function over typed arrays, which means the exact
   code the browser runs is the code the tests exercise (see mesher.test.mjs).

   The pipeline for one chunk is:

     fillPadded()  copy the chunk into a (CHUNK+2)^3 volume *plus a 1-cell ring*
                   pulled from neighbouring chunks, so ambient occlusion and
                   skylight have all the samples they need without any
                   cross-chunk light state.

     computeLight()  1. flood skylight straight down every column
                     2. BFS sideways/downwards, losing one level per step
                        (more for water/leaves) so light leaks into caves,
                        under overhangs and through doorways.

     mesh()        emit only the faces you can actually see, with a smooth
                   per-vertex ambient-occlusion * skylight value baked into
                   vertex colours. Returns plain arrays of interleaved-free
                   buffers; the renderer just wraps them in a BufferGeometry.

   Why bother: the old renderer put a whole 24-vertex cube in the scene for
   every block that wasn't fully buried, with one flat brightness per block.
   This emits only visible faces, so a typical chunk drops from ~600 cubes
   (7 200 verts) to ~1 200 faces worth of quads, and every corner gets real
   shading instead of a per-block step.
   ========================================================================== */
(function(root){
'use strict';

/* ---- world dimensions ----------------------------------------------------
   Y0..Y1 is the buildable column. Terrain tops out at MAXH (22) and trees add
   a few more, so this leaves ~25 blocks of headroom before the sky limit. */
const CHUNK=16;
const Y0=-8;
const Y1=55;
const YS=Y1-Y0+1;

/* Block ids are 1-based, with 0 reserved for air. This matters: grass is id 0
   in the game's own BLOCK table, so an "is there a block here" check written as
   `if (id)` would silently treat every grass block as empty. Keeping air at 0
   inside the mesher means `id !== AIR` is always the right test. */
const AIR=0;

const PW=CHUNK+2;              // padded volume width (1-cell ring)
const PN=PW*PW*YS;

/* ---- face tables ---------------------------------------------------------
   Face order is fixed and shared with the atlas UV table: +Y -Y +X -X +Z -Z.
   Corners are lattice coordinates on the unit cube, wound counter-clockwise
   when viewed from outside so the default front-face winding lights correctly
   (mesher.test.mjs asserts this for all six faces). */
const FACE_N=[[0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];
const FACE_CORNERS=[
  [[0,1,0],[0,1,1],[1,1,1],[1,1,0]],   // +Y
  [[0,0,1],[0,0,0],[1,0,0],[1,0,1]],   // -Y
  [[1,0,1],[1,0,0],[1,1,0],[1,1,1]],   // +X
  [[0,1,0],[0,0,0],[0,0,1],[0,1,1]],   // -X
  [[0,0,1],[1,0,1],[1,1,1],[0,1,1]],   // +Z
  [[0,0,0],[0,1,0],[1,1,0],[1,0,0]]    // -Z
];
/* Gentle baked form shading. The scene has a real sun, so this only needs to
   hint at which way is up — AO and skylight do the heavy lifting. */
const FACE_SHADE=[1.0,0.50,0.82,0.82,0.88,0.88];
/* v = 1 at the top of the block so top-of-texture art (the grass fringe)
   lands at the top of a side face. */
const FACE_UV=[
  c=>[c[0],c[2]],   // +Y  u=x  v=z
  c=>[c[0],c[2]],   // -Y
  c=>[1-c[2],c[1]], // +X
  c=>[c[2],c[1]],   // -X
  c=>[c[0],c[1]],   // +Z
  c=>[1-c[0],c[1]]  // -Z
];

/* For every face corner, the three neighbour cells it touches, *relative to
   the owning block*: [side1, side2, corner]. Each already includes the face
   normal, so all three sit on the outside of the face. */
const VN=[];  // [face][corner] -> [sx,sy,sz, tx,ty,tz, kx,ky,kz]
const UVT=[]; // [face][corner] -> [u,v] in cell-local 0..1
for(let f=0; f<6; f++){
  const n=FACE_N[f];
  const tang=[0,1,2].filter(a=>n[a]===0);
  VN[f]=[]; UVT[f]=[];
  for(let k=0;k<4;k++){
    const c=FACE_CORNERS[f][k];
    const d1=c[tang[0]]===1?1:-1, d2=c[tang[1]]===1?1:-1;
    const s=n.slice(); s[tang[0]]+=d1;
    const t=n.slice(); t[tang[1]]+=d2;
    const kk=n.slice(); kk[tang[0]]+=d1; kk[tang[1]]+=d2;
    VN[f].push(s.concat(t,kk));
    UVT[f].push(FACE_UV[f](c));
  }
}

const AO_LUT=[0.42,0.62,0.82,1.0];
const DX=[1,-1,0,0,0,0], DY=[0,0,1,-1,0,0], DZ=[0,0,0,0,1,-1];
/* Tolerance for "these two axis crossings are simultaneous". Scaled by the
   direction so it means the same thing for unit and non-unit vectors. */
const EPS=1e-9;

/* ---- scratch buffers -----------------------------------------------------
   Reused across every chunk build so streaming a fresh world doesn't churn
   the garbage collector. */
function createScratch(){
  return {
    pb:new Uint8Array(PN),          // padded blocks
    pl:new Uint8Array(PN),          // padded skylight 0..15
    ps:new Uint8Array(PN),          // the vertical shaft alone, before lateral bleed
    q:new Int32Array(PN*4),         // BFS queue (a cell can be re-queued as it brightens)
    ox:0, oz:0, yLo:0, yHi:0,
  };
}

/* Copy the chunk at (ox,oz) plus a 1-cell ring into s.pb. `get` is any
   world-coordinate block lookup — it may return blocks from neighbouring
   chunks or freshly generate terrain for chunks that aren't loaded yet.

   `yFull` caps how far up we bother asking. Everything above it is recorded as
   air without calling `get` at all, which is a large win: terrain tops out well
   below Y1, so the upper third of every column is empty and the lookup — often
   a hash-map probe — is pure waste there. Pass Y1 (the default) if your world
   really does place blocks at every height. */
function fillPadded(s, ox, oz, get, yFull){
  s.ox=ox; s.oz=oz;
  const topLy = yFull===undefined ? YS-1 : Math.min(YS-1, yFull-Y0);
  s.pb.fill(AIR);
  for(let ly=0; ly<=topLy; ly++){
    const wy=Y0+ly, base=ly*PW*PW;
    for(let lz=0; lz<PW; lz++){
      const row=base+lz*PW, wz=oz+lz-1;
      for(let lx=0; lx<PW; lx++) s.pb[row+lx]=get(ox+lx-1, wy, wz);
    }
  }
  return s;
}

/* Skylight.
 *
 * Two propagation rules, deliberately asymmetric because they model different
 * physics:
 *
 *   straight down   cost = atten[cell]        sunlight falls a clean shaft,
 *                                             but water and leaves filter it
 *   any other step  cost = atten[cell] if that medium filters more than the
 *                           one you're in, else 1
 *                                             sideways light has to turn a
 *                                             corner, but spreading *within*
 *                                             water or a leaf canopy is cheap
 *
 * `atten` is the loss for entering a medium, so air is 0, water 2, leaves 1.
 * BFS only ever raises a value, so the cheap downward shaft always wins for
 * open sky and the sideways bleed fills in caves, tunnels and overhangs. */
function computeLight(s, opaque, atten){
  const pb=s.pb, pl=s.pl, q=s.q;

  let yHi=-1, yLo=-1;
  for(let ly=0; ly<YS; ly++){
    const base=ly*PW*PW;
    for(let i=base; i<base+PW*PW; i++){
      if(pb[i]!==AIR){ if(yLo<0) yLo=ly; yHi=ly; break; }
    }
  }
  s.yLo=yLo; s.yHi=yHi;
  if(yHi<0){ pl.fill(0); s.empty=true; return s; }
  s.empty=false;

  pl.fill(0);
  let tail=0;
  // Sunlight falls as a clean vertical shaft: every open cell from the top of
  // the world down to the first solid cell is lit, losing `atten` for every
  // block it passes through. This runs the full height rather than stopping at
  // the lowest block, because open air below the terrain still sees the sky
  // around it — without this, a floating block's underside renders black.
  //
  // `l` carries the depth down the shaft; each cell pays its own attenuation on
  // the way in, which is what makes a deep water column darker than the surface.
  for(let lz=0; lz<PW; lz++) for(let lx=0; lx<PW; lx++){
    let l=15;
    for(let ly=YS-1; ly>=0; ly--){
      const i=ly*PW*PW+lz*PW+lx;
      const b=pb[i];
      if(opaque[b]) break;
      l-=atten[b];
      if(l<=0) break;
      pl[i]=l;
      if(l>1 && tail<q.length) q[tail++]=i;
    }
  }
  s.ps.set(pl);   // remember the shaft before lateral bleed dilutes it
  // Lateral bleed, so caves, tunnels and overhangs are lit rather than black.
  // Spreading within one medium costs 1; crossing into a filtering one pays
  // that medium's attenuation.
  for(let head=0; head<tail; head++){
    const i=q[head];
    const l=pl[i];
    if(l<=1) continue;
    const lx=i%PW;
    const r=(i-lx)/PW;
    const lz=r%PW;
    const ly=(r-lz)/PW;
    const la=atten[pb[i]];
    for(let d=0; d<6; d++){
      const nx=lx+DX[d], ny=ly+DY[d], nz=lz+DZ[d];
      if(ny<0||ny>=YS||nx<0||nx>=PW||nz<0||nz>=PW) continue;
      const j=ny*PW*PW+nz*PW+nx;
      const b=pb[j];
      if(opaque[b]) continue;
      const ab=atten[b];
      let nl=l-(ab>la?ab:1);
      // Inside a filtering medium the shaft is the ceiling. Without this, a
      // fully lit air column beside the sea would flood the water sideways at
      // full strength and a deep trench would be as bright as the surface.
      if(ab>0 && s.ps[j]<nl) nl=s.ps[j];
      if(nl<=pl[j]) continue;
      pl[j]=nl;
      if(nl>1 && tail<q.length) q[tail++]=j;
    }
  }
  return s;
}

/* Is the face of `self` against `nb` hidden?
   - air                     -> always draw
   - a solid cube            -> hide, the face is buried inside the neighbour
   - liquid involved         -> hide only against the same liquid, so a
     shoreline keeps its water surface but internal water faces are dropped
   - two transparent shells  -> hide, so a glass pane merges with glass and a
     leaf canopy keeps only its outer skin
   - solid against a shell   -> draw, otherwise you would see straight through
     the stone and out the far side of the window */
function faceHidden(self, nb, opaque, liquid){
  if(nb===AIR) return false;
  if(opaque[nb]) return true;
  if(liquid[self]||liquid[nb]) return nb===self;
  return !opaque[self];
}

/* Build renderable geometry for the chunk currently sitting in `s`.
   cfg: {opaque, liquid, bucket, cell, tint, water, sea, lightMin, lightRange}
     opaque   Uint8Array[types]  1 if the type is a full opaque cube
     liquid   Uint8Array[types]  1 if the type flows
     bucket   Uint8Array[types]  which output bucket the type belongs to
     cell     Int8Array[types*6] atlas cell per (type,face); -1 = raw 0..1 uv
     tint     Float32Array[types*3] per-type rgb multiplier
     water    block type id that gets a lowered surface, or -1
     sea      y at and below which blocks are tinted as underwater murk
   Returns one geometry bundle per bucket. */
function mesh(s, cfg){
  const opaque=cfg.opaque, liquid=cfg.liquid, bucket=cfg.bucket, cell=cfg.cell;
  const tint=cfg.tint||null;
  const water=cfg.water===undefined?-1:cfg.water;
  const sea=cfg.sea===undefined?4:cfg.sea;
  const lmin=cfg.lightMin===undefined?0.24:cfg.lightMin;
  const lrange=cfg.lightRange===undefined?0.76:cfg.lightRange;
  const DROP=0.12;
  const pb=s.pb, pl=s.pl;

  const out=[];
  for(let b=0; b<cfg.buckets; b++) out.push({pos:[],nrm:[],uv:[],col:[],cell:[],idx:[],quads:0});

  if(s.empty) return {buckets:out, tris:0, blocks:0};

  // Sample helpers. The padded ring means x/z are always in range; y can run one
  // cell past either end, so clamp: below the world reads as solid (no bottom
  // faces on the floor) and above it as open sky.
  const floor=cfg.floor===undefined?1:cfg.floor;   // any opaque id will do
  const blockAt=(x,y,z)=> y<0?floor : y>=YS?AIR : pb[y*PW*PW+z*PW+x];
  const lightAt=(x,y,z)=> y<0?0 : y>=YS?15 : pl[y*PW*PW+z*PW+x];

  let blocks=0, tris=0;
  const yTop=Math.min(YS-1, s.yHi);
  for(let ly=s.yLo; ly<=yTop; ly++){
    const wy=Y0+ly;
    const murky = wy<=sea ? 0.74 : 1;
    for(let lz=1; lz<=CHUNK; lz++){
      const wz=s.oz+lz-1;
      for(let lx=1; lx<=CHUNK; lx++){
        const i=ly*PW*PW+lz*PW+lx;
        const t=pb[i];
        if(t===AIR) continue;   // id 0 is air; every other id is a real block
        blocks++;
        const wx=s.ox+lx-1;
        const g=out[bucket[t]];
        const tr=tint?t[t*3]:1, tg=tint?t[t*3+1]:1, tb=tint?t[t*3+2]:1;

        // an exposed water surface sits slightly low so shorelines read
        const openTop = t===water && blockAt(lx,ly+1,lz)===AIR;
        const hTop = openTop ? 1-DROP : 1;

        for(let f=0; f<6; f++){
          const n=FACE_N[f];
          if(faceHidden(t, blockAt(lx+n[0], ly+n[1], lz+n[2]), opaque, liquid)) continue;

          const fs=FACE_SHADE[f];
          const cel=cell[t*6+f];
          const base=g.pos.length/3;
          const L0=lightAt(lx+n[0], ly+n[1], lz+n[2]);

          for(let k=0;k<4;k++){
            const c=FACE_CORNERS[f][k];
            g.pos.push(wx+c[0], wy+(c[1]===1?hTop:0), wz+c[2]);
            g.nrm.push(n[0],n[1],n[2]);
            const uv=UVT[f][k];
            g.uv.push(uv[0],uv[1]);
            g.cell.push(cel);

            const o=VN[f][k];
            const o1=blockAt(lx+o[0], ly+o[1], lz+o[2]);
            const o2=blockAt(lx+o[3], ly+o[4], lz+o[5]);
            const oc=blockAt(lx+o[6], ly+o[7], lz+o[8]);
            const s1=opaque[o1], s2=opaque[o2], sc=opaque[oc];
            const ao = (s1&&s2) ? 0 : 3-(s1+s2+sc);

            // smooth light: average the four cells touching this corner,
            // counting occluded ones as black. Normalised to 0..1.
            const sl=(L0 + (s1?0:lightAt(lx+o[0], ly+o[1], lz+o[2]))
                          + (s2?0:lightAt(lx+o[3], ly+o[4], lz+o[5]))
                          + (sc?0:lightAt(lx+o[6], ly+o[7], lz+o[8]))) / 60;

            const lum=(lmin+lrange*sl) * AO_LUT[ao] * fs * murky;
            // unlit corners drift slightly blue so caves read cool, not muddy
            g.col.push(lum*tr*(0.93+0.07*sl), lum*tg, lum*tb*(0.97+0.03*sl));
          }
          g.idx.push(base, base+1, base+2, base, base+2, base+3);
          g.quads++; tris+=2;
        }
      }
    }
  }
  return {buckets:out, tris, blocks};
}

/* Voxel raycast (Amanatides & Woo). Walks the grid instead of testing every
   triangle, so block picking costs a handful of array reads no matter how
   much geometry is on screen. `get` returns AIR or a block type.
   (dx,dy,dz) must be a unit vector. Returns null past maxDist. */
function raycast(ox,oy,oz, dx,dy,dz, maxDist, get){
  let x=Math.floor(ox), y=Math.floor(oy), z=Math.floor(oz);
  const sx=dx>0?1:-1, sy=dy>0?1:-1, sz=dz>0?1:-1;
  const dtx=dx!==0?Math.abs(1/dx):Infinity;
  const dty=dy!==0?Math.abs(1/dy):Infinity;
  const dtz=dz!==0?Math.abs(1/dz):Infinity;
  let tx=dx!==0?((dx>0?x+1-ox:ox-x)*dtx):Infinity;
  let ty=dy!==0?((dy>0?y+1-oy:oy-y)*dty):Infinity;
  let tz=dz!==0?((dz>0?z+1-oz:oz-z)*dtz):Infinity;
  let nx=0, ny=0, nz=0, t=0;

  while(t<=maxDist){
    // A perfectly diagonal ray (dx==dy==dz) crosses cell corners exactly, where
    // every axis reports the same crossing time. Stepping only one axis would
    // report a hit in a cell the ray only touches at a single point, so step
    // every axis tied for first and enter the diagonally-adjacent cell.
    const lo=Math.min(tx,ty,tz);
    nx=ny=nz=0; t=lo;
    if(tx<=lo+EPS){ x+=sx; tx+=dtx; nx=-sx; }
    if(ty<=lo+EPS){ y+=sy; ty+=dty; ny=-sy; }
    if(tz<=lo+EPS){ z+=sz; tz+=dtz; nz=-sz; }
    if(t>maxDist) return null;
    const b=get(x,y,z);
    // NB: block id 0 is a real block (grass), so this cannot be a truthiness
    // test — only "not air" counts.
    if(b!==AIR && b!==null && b!==undefined) return {x,y,z,nx,ny,nz,dist:t,type:b};
  }
  return null;
}

const VoxelMesher={CHUNK,Y0,Y1,YS,PW,AIR,FACE_N,FACE_SHADE,createScratch,fillPadded,computeLight,mesh,raycast,faceHidden,faceCorners:FACE_CORNERS};

root.VoxelMesher=VoxelMesher;
if(typeof module!=='undefined' && module.exports) module.exports=VoxelMesher;

})(typeof globalThis!=='undefined'?globalThis:this);
