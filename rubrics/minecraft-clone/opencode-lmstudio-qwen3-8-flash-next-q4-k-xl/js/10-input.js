/* input wiring: keyboard, mouse, pointer lock, touch fallback + boot */
'use strict';

const Input = (() => {
  const state = { fwd: 0, strafe: 0, jump: false, sneak: false, sprint: false };
  let keys = {}, lastWTap = 0;

  function recompute() {
    const k = (c) => !!keys[c];
    state.fwd = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
    state.strafe = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
    state.jump = !!k('Space');
    state.sneak = !!(k('ShiftLeft') || k('ShiftRight'));
    state.sprint = !!(k('ControlLeft') || k('ControlRight')) || (performance.now() - lastWTap < 320 && state.fwd > 0);
  }

  function wire(canvas) {
    addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;   // typing a seed, not playing
      if (e.code === 'F3') { e.preventDefault(); UI.debugOn = !UI.debugOn; $('debug').classList.toggle('hidden', !UI.debugOn); return; }
      const st = Game.getState();
      if ((e.code === 'KeyE' || e.code === 'KeyB' || e.code === 'KeyI')) {
        if (st === 'play') Game.openPicker(); else if (st === 'picker') Game.closePicker(true);
        return;
      }
      if (e.code === 'Escape' && st === 'picker') { Game.closePicker(true); return; }
      if (e.code === 'KeyW' && !keys.KeyW) { const t = performance.now(); if (t - lastWTap < 320) state.sprint = true; lastWTap = t; }
      keys[e.code] = true; recompute();
    });
    addEventListener('keyup', (e) => { keys[e.code] = false; recompute(); });
    addEventListener('blur', () => { keys = {}; recompute(); });

    // mouse look + buttons while pointer-locked
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas && Game.getState() === 'play') Player.look(e.movementX, e.movementY);
    });
    canvas.addEventListener('mousedown', (e) => {
      const st = Game.getState();
      if (st !== 'play' || (!touchLocked() && !Game.touchMode)) return;
      if (e.button === 0) Game.setMining(true);
      else if (e.button === 2) Game.setPlacing(true);
      else if (e.button === 1) {   // middle click: pick block
        const hit = Player.raycast();
        if (hit && BLOCKS[hit.id] && BLOCKS[hit.id].placeable !== false) UI.setSlot(UI.sel, hit.id);
      }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) Game.setMining(false);
      if (e.button === 2) Game.setPlacing(false);
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      if (Game.getState() === 'play') { e.preventDefault(); UI.scroll(e.deltaY); }
    }, { passive: false });

    // pointer lock lifecycle
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === canvas) Game.setState('play');
      else Game.onPointerLost();
    });
    document.addEventListener('pointerlockerror', () => UI.toast('Could not lock mouse — click again'));

    // menu buttons
    const startPlay = () => { Sfx.resume(); Game.requestLock(); };
    $('btn-play').addEventListener('click', (e) => { e.stopPropagation(); startPlay(); });
    $('title').addEventListener('click', (e) => { if (!e.target.closest('button, input')) startPlay(); });
    $('btn-new').addEventListener('click', () => { Sfx.resume(); Game.newWorld($('seed-input').value); startPlay(); });
    $('btn-resume').addEventListener('click', () => Game.requestLock());
    $('btn-save').addEventListener('click', () => { Game.save(); UI.toast('World saved'); });
    $('btn-regen').addEventListener('click', () => { Game.newWorld($('seed-input').value); Game.requestLock(); });
    $('btn-respawn').addEventListener('click', () => Game.respawn());

    wireTouch(canvas);
    addEventListener('pagehide', () => Game.save());
  }

  const touchLocked = () => document.pointerLockElement !== null;

  /* ---------- mobile / no-pointer-lock fallback ---------- */
  function wireTouch(canvas) {
    let stickId = null, lookId = null, lx = 0, ly = 0;
    const stick = $('stick'), knob = $('knob');

    stick.addEventListener('pointerdown', (e) => {
      stickId = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); e.stopPropagation();
    });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) moveStick(e); });
    const endStick = (e) => {
      if (e.pointerId !== stickId) return;
      stickId = null; state.fwd = 0; state.strafe = 0; knob.style.transform = '';
    };
    stick.addEventListener('pointerup', endStick);
    stick.addEventListener('pointercancel', endStick);

    function moveStick(e) {
      const r = stick.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy), max = r.width / 2;
      if (len > max) { dx *= max / len; dy *= max / len; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      state.strafe = clamp(dx / max, -1, 1);
      state.fwd = clamp(-dy / max, -1, 1);
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (!Game.touchMode || Game.getState() !== 'play') return;
      lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookId) return;
      Player.look((e.clientX - lx) * 2.2, (e.clientY - ly) * 2.2);
      lx = e.clientX; ly = e.clientY;
    });
    const endLook = (e) => { if (e.pointerId === lookId) lookId = null; };
    canvas.addEventListener('pointerup', endLook);
    canvas.addEventListener('pointercancel', endLook);

    bindHold($('t-jump'), () => state.jump = true, () => state.jump = false);
    bindHold($('t-break'), () => Game.setMining(true), () => Game.setMining(false));
    bindHold($('t-place'), () => Game.setPlacing(true), () => Game.setPlacing(false));

    function bindHold(el, down, up) {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Sfx.resume(); down(); });
      el.addEventListener('pointerup', (e) => { e.stopPropagation(); up(); });
      el.addEventListener('pointercancel', () => up());
    }
  }

  return { state, wire };
})();

/* ---------- boot ---------- */
Scene.init($('gl'));
Input.wire(Scene.renderer.domElement);
Game.boot();
