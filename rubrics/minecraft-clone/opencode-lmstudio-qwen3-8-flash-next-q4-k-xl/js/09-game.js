/* game state machine: interaction (mine/place/pick), save/load, screens, main loop */
'use strict';

const Game = (() => {
  let state = 'title', touchMode = false;
  let mining = false, placing = false, placeCd = 0;
  let mineTarget = null, mineProgress = 0;
  let saveDirty = false, saveTimer = 0, fpsSmooth = 60, debugT = 0;

  /* ---------- world lifecycle ---------- */
  function parseSeed(s) {
    s = (s || '').trim();
    if (!s) return (Math.random() * 0xFFFFFFFF) >>> 0;
    if (/^-?\d+$/.test(s)) return (+s) >>> 0;
    return strSeed(s);
  }

  function buildWorld(seed, loadSave) {
    World.generate(seed);
    let loaded = 0;
    const raw = safeGet('mc_save_' + seed);
    if (loadSave && raw) {
      try {
        const j = JSON.parse(raw);
        const map = new Map();
        for (let i = 0; i < j.e.length; i += 2) map.set(j.e[i], j.e[i + 1]);
        World.applyEdits(map);
        loaded = j.e.length / 2;
        if (j.hotbar) UI.setHotbar(j.hotbar);
        if (typeof j.tod === 'number') Scene.tod = j.tod;
      } catch (e) { console.warn('save load failed', e); }
    }
    Mesh.init(); Mesh.buildAll();
    const sx = CFG.SX / 2, sz = CFG.SZ / 2;
    Player.spawnAt(sx + .5, World.surfaceY(sx | 0, sz | 0) + 1.02, sz + .5);
    safeSet('mc_last_seed', String(seed));
    return loaded;
  }

  function newWorld(seedStr) {
    const seed = parseSeed(seedStr);
    const n = buildWorld(seed, true);
    Player.respawn();
    UI.toast(n ? 'World "' + World.seed + '" — ' + n + ' saved edits restored' : 'New world generated (seed ' + World.seed + ')');
  }

  /* ---------- persistence ---------- */
  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function save() {
    const e = [];
    for (const [i, id] of World.edits) e.push(i, id);
    const j = { seed: World.seed, e, hotbar: UI.hotbarArr, tod: Scene.tod };
    safeSet('mc_save_' + World.seed, JSON.stringify(j));
    saveDirty = false;
  }

  /* ---------- pointer lock / screens ---------- */
  let intentionalUnlock = false;
  function requestLock() {
    const c = Scene.renderer.domElement;
    if (touchMode) { setState('play'); return; }
    try {
      const p = c.requestPointerLock();
      if (p && p.catch) p.catch(() => {});   // Chrome security cooldown after ESC — stay paused, user clicks again
    } catch (e) {}
  }

  function setState(s) {
    state = s;
    UI.showScreen(s === 'play' ? null : s);
    if (s !== 'play') { mining = placing = false; Scene.hideCrack(); }
  }
  const getState = () => state;

  function openPicker() { if (state !== 'play' && state !== 'picker') return; intentionalUnlock = true; document.exitPointerLock(); setState('picker'); $('picker-slot').textContent = UI.sel + 1; }
  function closePicker(relock) { setState('pause'); intentionalUnlock = false; if (relock) requestLock(); }

  function die() { setState('dead'); intentionalUnlock = true; document.exitPointerLock(); }
  function respawn() { Player.respawn(); setState('play'); requestLock(); }
  function damage(n) { Player.damage(n); }

  /* ---------- interaction ---------- */
  function pickIntoSlot(id) { UI.setSlot(UI.sel, id); closePicker(true); }

  function tryPlace() {
    if (!mineTarget) return;
    const t = mineTarget;
    const bx = t.x + t.nx, by = t.y + t.ny, bz = t.z + t.nz;
    if (!World.inB(bx, by, bz)) return;
    const cur = World.get(bx, by, bz);
    if (cur !== B.AIR && cur !== B.WATER) return;
    const id = UI.selectedBlock();
    if (!id || !BLOCKS[id]) return;
    if (BLOCKS[id].solid !== false && Player.overlapsBlock(bx, by, bz)) return;   // can't place inside yourself
    World.set(bx, by, bz, id);
    Sfx.place(id);
    Mesh.markDirty(bx, bz);
    if (BLOCKS[id].falls) { if (World.settle(bx, bz)) Mesh.markDirty(bx, bz); }
    saveDirty = true;
  }

  function interact(dt) {
    const hit = Player.raycast();
    mineTarget = hit;
    if (hit) Scene.setOutline(hit.x, hit.y, hit.z); else Scene.hideOutline();

    // mining (hold left button)
    if (mining && hit && BLOCKS[hit.id].hardness !== Infinity) {
      const key = hit.x + ',' + hit.y + ',' + hit.z;
      if (mineTargetKey !== key) { mineTargetKey = key; mineProgress = 0; }
      mineProgress += dt / BLOCKS[hit.id].hardness;
      Scene.setCrack(hit.x, hit.y, hit.z, Math.min(9, (mineProgress * 10) | 0));
      if (mineProgress >= 1) {
        const pc = BLOCKS[hit.id].pc || [128, 128, 128];
        World.set(hit.x, hit.y, hit.z, B.AIR);
        Scene.burst(hit.x, hit.y, hit.z, pc);
        Sfx.breakBlock(hit.id);
        Mesh.markDirty(hit.x, hit.z);
        if (World.settle(hit.x, hit.z)) Mesh.markDirty(hit.x, hit.z);   // gravity sand/gravel
        mineProgress = 0; saveDirty = true;
      }
    } else { Scene.hideCrack(); mineTargetKey = null; mineProgress = 0; }

    // placing (hold right button with cooldown)
    placeCd -= dt;
    if (placing && placeCd <= 0) { tryPlace(); placeCd = .22; }
  }
  let mineTargetKey = null;

  /* ---------- debug overlay ---------- */
  function updateDebug(dt, inp) {
    if (!UI.debugOn) return;
    debugT -= dt; if (debugT > 0) return; debugT = .25;
    const p = Player.pos, cam = Scene.camera;
    const dir = ['south', 'west', 'north', 'east'][((Math.round(((cam.rotation.y % 6.28318) + 6.28318) % 6.28318 / (Math.PI / 2))) % 4)];
    const t = Scene.tod, hours = ((t * 24 + 6) % 24), mins = (hours % 1) * 60;
    const vis = Mesh.list.filter((c) => c.solid && c.solid.visible).length;
    $('debug').textContent =
      'Minecraft Clone (Web)  fps ' + Math.round(fpsSmooth) + '\n' +
      'XYZ: ' + p.x.toFixed(2) + ' / ' + p.y.toFixed(2) + ' / ' + p.z.toFixed(2) + '\n' +
      'Block: ' + Math.floor(p.x) + ' ' + Math.floor(p.y) + ' ' + Math.floor(p.z) + '   Facing: ' + dir + '\n' +
      'Chunk: ' + ((p.x / CFG.CHUNK) | 0) + ',' + ((p.z / CFG.CHUNK) | 0) + ' in ' + World.CXN + ',' + World.CZN + '   visible ' + vis + '\n' +
      'Biome: ' + World.biomeName(p.x, p.z) + '   Time: ' + String(hours | 0).padStart(2, '0') + ':' + String(mins | 0).padStart(2, '0') + '\n' +
      'Seed: ' + World.seed + '   Edits: ' + World.edits.size;
    $('debug').classList.remove('hidden');
  }

  /* ---------- main loop ---------- */
  let last = performance.now();

  function render() { Scene.renderer.render(Scene.getScene(), Scene.camera); }

  /* ---------- boot ---------- */
  function boot() {
    touchMode = !('requestPointerLock' in Scene.renderer.domElement) || matchMedia('(pointer:coarse)').matches;
    UI.init();
    UI.applyOpts();

    const lastSeed = safeGet('mc_last_seed');
    let loaded = 0, seed;
    if (lastSeed !== null && safeGet('mc_save_' + lastSeed)) {
      seed = parseSeed(lastSeed);
      loaded = buildWorld(seed, true);
      $('load-hint').textContent = 'Saved world found for seed "' + World.seed + '" (' + loaded + ' edits) — Click to Play resumes it.';
    } else {
      seed = parseSeed('');
      buildWorld(seed, false);
    }
    $('seed-input').value = String(World.seed);

    setState('title');
    requestAnimationFrame(frameBody);
  }

  // main loop body (re-arms itself each frame)
  function frameBody(now) {
    requestAnimationFrame(frameBody);
    let dt = (now - last) / 1000; last = now;
    if (dt > .05) dt = .05;
    fpsSmooth += (1 / Math.max(dt, 1e-4) - fpsSmooth) * .08;

    const inp = Input.state;
    if (state === 'play') {
      Player.update(dt, inp);
      interact(dt);
      Scene.setUnderwater(Player.inWater());
      updateDebug(dt, inp);
      saveTimer += dt;
      if (saveDirty && saveTimer > 4) { saveTimer = 0; save(); }
    } else if (state === 'title') {
      const a = now * .00006, cx = CFG.SX / 2, cz = CFG.SZ / 2;
      Scene.camera.position.set(cx + Math.cos(a) * 34, World.surfaceY(cx | 0, cz | 0) + 16, cz + Math.sin(a) * 34);
      Scene.camera.lookAt(cx, World.surfaceY(cx | 0, cz | 0) + 8, cz);
    }

    Mesh.flush(2);
    Mesh.updateVisible(Player.pos.x, Player.pos.z, UI.OPTS.rd);
    Scene.update(dt, Scene.camera.position);
    render();
  }

  return {
    boot, newWorld, save, requestLock, setState, getState, openPicker, closePicker, die, respawn,
    damage, pickIntoSlot, get touchMode() { return touchMode; },
    setMining(v) { mining = v; }, setPlacing(v) { placing = v; },
    onPointerLost: () => state === 'play' && !intentionalUnlock ? setState('pause') : (intentionalUnlock = false),
    get intentionalUnlock() { return intentionalUnlock; }
  };
})();
