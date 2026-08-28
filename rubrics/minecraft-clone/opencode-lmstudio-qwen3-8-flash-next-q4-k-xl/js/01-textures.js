/* procedural 16x16 textures -> atlas + icons + sky/cloud/crack textures */
'use strict';

const TILE = 16, ATLAS_COLS = 8;
const TILE_NAMES = [
  'grass_top', 'grass_side', 'dirt', 'stone', 'cobble', 'log_side', 'log_top', 'leaves',
  'sand', 'glass', 'planks', 'bedrock', 'gravel', 'brick', 'snow', 'water', 'snow_side'
];

const Tex = (() => {
  const rnd = mulberry32(987654321); // fixed seed -> identical textures every run
  const canvases = {};               // tile name -> 16x16 canvas (for icons)
  let atlasCanvas = null;

  function newTile() {
    const c = document.createElement('canvas');
    c.width = TILE; c.height = TILE;
    return [c, c.getContext('2d')];
  }
  function px(ctx, x, y, r, g, b, a) {
    ctx.fillStyle = 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + (a === undefined ? 1 : a) + ')';
    ctx.fillRect(x, y, 1, 1);
  }
  // fill with base color + per-pixel brightness jitter
  function noisy(ctx, r, g, b, amt) {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const j = (rnd() * 2 - 1) * amt;
      px(ctx, x, y, r + j * r * 0.5, g + j * g * 0.5, b + j * b * 0.5);
    }
  }
  function specks(ctx, n, dr, dg, db, amt) {
    for (let i = 0; i < n; i++) {
      const x = (rnd() * TILE) | 0, y = (rnd() * TILE) | 0, j = rnd() * amt;
      px(ctx, x, y, dr + j * 40, dg + j * 40, db + j * 40);
    }
  }

  const painters = {
    grass_top(c) { noisy(c, 106, 152, 66, .35); specks(c, 40, 92, 140, 58, .6); specks(c, 25, 120, 170, 80, .5); },
    dirt(c) { noisy(c, 134, 96, 67, .35); specks(c, 30, 110, 78, 52, .5); },
    grass_side(c) {
      painters.dirt(c);
      for (let x = 0; x < TILE; x++) {
        const h = 3 + ((rnd() * 2.4) | 0); // ragged grass edge
        for (let y = 0; y < h; y++) {
          const j = rnd() * 30 - 15;
          px(c, x, y, 106 + j, 152 + j, 66 + j);
        }
      }
    },
    stone(c) { noisy(c, 127, 127, 130, .22); specks(c, 26, 108, 108, 112, .4); },
    cobble(c) {
      painters.stone(c);
      // dark mortar grid with jitter -> cobbles
      for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) {
        const ox = (gx * 4 + ((rnd() * 2) | 0)) % TILE, oy = (gy * 4 + ((rnd() * 2) | 0)) % TILE;
        for (let i = 0; i < 4; i++) { px(c, (ox + i) % TILE, gy * 4, 70, 70, 73); px(c, gx * 4, (oy + i) % TILE, 70, 70, 73); }
      }
      specks(c, 18, 96, 96, 100, .5);
    },
    log_side(c) {
      noisy(c, 104, 80, 48, .25);
      for (let x = 0; x < TILE; x += 3 + ((rnd() * 2) | 0)) {
        for (let y = 0; y < TILE; y++) if (rnd() > .25) px(c, x % TILE, y, 78, 58, 34);
      }
    },
    log_top(c) {
      noisy(c, 150, 116, 68, .18);
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
        const d = Math.hypot(x - 7.5, y - 7.5);
        if ((d | 0) % 2 === 0 && d > 1.5) px(c, x, y, 116, 88, 50);
      }
    },
    leaves(c) {
      noisy(c, 54, 108, 34, .5);
      specks(c, 70, 38, 82, 24, .6); specks(c, 30, 78, 140, 52, .5);
    },
    sand(c) { noisy(c, 219, 207, 163, .14); specks(c, 18, 205, 190, 145, .4); },
    glass(c) {
      c.clearRect(0, 0, TILE, TILE);
      for (let i = 0; i < TILE; i++) { // frame + highlights
        px(c, i, 0, 205, 235, 245); px(c, i, TILE - 1, 205, 235, 245);
        px(c, 0, i, 205, 235, 245); px(c, TILE - 1, i, 205, 235, 245);
      }
      for (let i = 3; i < 9; i++) { px(c, i, 12 - i + 2, 235, 250, 255); px(c, i + 1, 12 - i + 2, 235, 250, 255); }
    },
    planks(c) {
      noisy(c, 162, 130, 78, .18);
      for (let y = 0; y < TILE; y += 4) for (let x = 0; x < TILE; x++) px(c, x, y, 96, 74, 42); // board seams
      for (let y = 0; y < TILE; y += 4) { const sx = ((y / 4) * 5 + 3) % TILE; for (let k = y + 1; k < y + 4; k++) px(c, sx, k, 96, 74, 42); }
      specks(c, 14, 140, 110, 64, .5);
    },
    bedrock(c) {
      noisy(c, 85, 85, 88, .5);
      specks(c, 60, 45, 45, 48, .7); specks(c, 30, 120, 120, 124, .5);
    },
    gravel(c) {
      noisy(c, 128, 120, 116, .35);
      specks(c, 50, 96, 90, 86, .6); specks(c, 30, 150, 142, 136, .5);
    },
    brick(c) {
      noisy(c, 150, 87, 68, .2);
      for (let y = 0; y < TILE; y += 4) for (let x = 0; x < TILE; x++) px(c, x, y, 176, 176, 176); // mortar rows
      for (let y = 0; y < TILE; y += 4) { const off = ((y / 4) % 2) * 4; for (let k = 0; k < 4; k++) px(c, (off + k * 8) % TILE, y + 1 + (k % 3), 176, 176, 176); }
    },
    snow(c) { noisy(c, 240, 245, 250, .07); specks(c, 14, 222, 232, 244, .4); },
    snow_side(c) {
      painters.dirt(c);
      for (let x = 0; x < TILE; x++) {
        const h = 5 + ((rnd() * 2.4) | 0); // ragged snow cap over dirt
        for (let y = 0; y < h; y++) { const j = rnd() * 16 - 8; px(c, x, y, 238 + j, 244 + j, 250); }
      }
    },
    water(c) { noisy(c, 60, 100, 217, .18); specks(c, 22, 90, 130, 235, .5); }
  };

  function build() {
    for (const name of TILE_NAMES) {
      const [c, ctx] = newTile();
      painters[name](ctx);
      canvases[name] = c;
    }
    const rows = Math.ceil(TILE_NAMES.length / ATLAS_COLS);
    atlasCanvas = document.createElement('canvas');
    atlasCanvas.width = ATLAS_COLS * TILE; atlasCanvas.height = rows * TILE;
    const actx = atlasCanvas.getContext('2d');
    actx.imageSmoothingEnabled = false;
    TILE_NAMES.forEach((n, i) => {
      actx.drawImage(canvases[n], (i % ATLAS_COLS) * TILE, ((i / ATLAS_COLS) | 0) * TILE);
    });
  }

  // uv rect for a tile name (CanvasTexture flipY=true -> v grows upward from canvas bottom)
  function uv(name) {
    const i = TILE_NAMES.indexOf(name), col = i % ATLAS_COLS, row = (i / ATLAS_COLS) | 0;
    const W = ATLAS_COLS * TILE, H = Math.ceil(TILE_NAMES.length / ATLAS_COLS) * TILE, e = 0.15;
    return {
      u0: (col * TILE + e) / W, u1: ((col + 1) * TILE - e) / W,
      v0: 1 - ((row + 1) * TILE - e) / H, v1: 1 - (row * TILE + e) / H
    };
  }

  /* ---- crack overlay stages (standalone textures, full-image UVs) ---- */
  function crackCanvases() {
    const out = [];
    for (let s = 0; s < 10; s++) {
      const [c, ctx] = newTile();
      const lines = 2 + s * 2;
      ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = 1;
      for (let i = 0; i < lines; i++) {
        let x = 8 + (rnd() * 4 - 2), y = 8 + (rnd() * 4 - 2);
        const ang = rnd() * Math.PI * 2, len = 3 + s * 1.2;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += Math.cos(ang + (rnd() - .5)) * len / 4; y += Math.sin(ang + (rnd() - .5)) * len / 4; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      out.push(c);
    }
    return out;
  }

  /* ---- hotbar/picker icon: isometric cube from top+side tiles ---- */
  function blockIcon(canvas, def) {
    canvas.width = 48; canvas.height = 48;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const side = canvases[def.tiles.side], top = canvases[def.tiles.top];
    const cx = 24, w = 17, t = 9, h = 16, y0 = 5;
    function face(tex, ox, oy, ux, uy, vx, vy) { // unit square -> parallelogram
      ctx.save();
      ctx.setTransform(ux / TILE, uy / TILE, vx / TILE, vy / TILE, ox, oy);
      ctx.drawImage(tex, 0, 0);
      ctx.restore();
    }
    // top: O=W, U=S-W=(w,t), V=N-W=(w,-t)
    face(top, cx - w, y0 + t, w, t, w, -t);
    // left: O=W+(0,h), U=S-W=(w,t), V=(0,h)
    ctx.save(); ctx.setTransform(w / TILE, t / TILE, 0, h / TILE, cx - w, y0 + t + h);
    ctx.drawImage(side, 0, 0); ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.moveTo(cx - w, y0 + t); ctx.lineTo(cx, y0 + 2 * t); ctx.lineTo(cx, y0 + 2 * t + h); ctx.lineTo(cx - w, y0 + t + h); ctx.closePath(); ctx.fill();
    // right: O=S+(0,h), U=E-S=(w,-t), V=(0,h)
    ctx.save(); ctx.setTransform(w / TILE, -t / TILE, 0, h / TILE, cx, y0 + 2 * t + h);
    ctx.drawImage(side, 0, 0); ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,.15)';
    ctx.beginPath(); ctx.moveTo(cx, y0 + 2 * t); ctx.lineTo(cx + w, y0 + t); ctx.lineTo(cx + w, y0 + t + h); ctx.lineTo(cx, y0 + 2 * t + h); ctx.closePath(); ctx.fill();
  }

  /* ---- hearts ---- */
  const HEART = [' X.X. ', 'XXXXXX', 'XXXXXX', '.XXXX.', '..XX..', '......'];
  function heart(state) { // 'full' | 'half' | 'empty'
    const c = document.createElement('canvas'); c.width = 9; c.height = 8;
    const ctx = c.getContext('2d');
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
      if (HEART[y][x] !== 'X') continue;
      let col = null;
      const leftHalf = x < 3;
      if (state === 'full' || (state === 'half' && leftHalf)) col = '#e0252b'; else col = '#3a1012';
      ctx.fillStyle = col; ctx.fillRect(x + 1, y + 1, 1, 1);
    }
    return c.toDataURL();
  }

  /* ---- clouds: blocky blobs on transparent tile (wrapped for tiling) ---- */
  function cloudCanvas() {
    const S = 64, [c, ctx] = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = S; return [cv, cv.getContext('2d')]; })();
    const r2 = mulberry32(5150);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 14; i++) {
      const x = (r2() * S) | 0, y = (r2() * (S / 2)) | 0, w = 6 + ((r2() * 18) | 0), h = 5 + ((r2() * 9) | 0);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) ctx.fillRect(x + dx * S, y + dy * S, w, h);
    }
    return c;
  }

  /* ---- sun / moon squares ---- */
  function discCanvas(core, edge) {
    const [c, ctx] = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 32; return [cv, cv.getContext('2d')]; })();
    ctx.fillStyle = core; ctx.fillRect(4, 4, 24, 24);
    ctx.fillStyle = edge; ctx.fillRect(2, 6, 28, 20); ctx.fillRect(6, 2, 20, 28);
    return c;
  }

  build();
  return {
    atlasCanvas, crackCanvases, blockIcon, heart, cloudCanvas, discCanvas,
    uv: (n) => uv(n), tile: (n) => canvases[n]
  };
})();
