/* HUD + menus: hotbar, hearts, block picker, debug overlay, options */
'use strict';

const UI = (() => {
  const HOTBAR_DEFAULT = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANKS, B.LOG, B.LEAVES, B.GLASS, B.SAND];
  const PICKER_IDS = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANKS, B.LOG, B.LEAVES, B.SAND, B.GRAVEL, B.GLASS, B.BRICK, B.SNOW, B.WATER];
  let hotbar = HOTBAR_DEFAULT.slice(), sel = 0;

  const OPTS = Object.assign({ fov: 70, rd: 5, sens: 100, sound: true }, loadOpts());
  function loadOpts() { try { return JSON.parse(localStorage.getItem('mc1_opts') || '{}'); } catch (e) { return {}; } }
  function saveOpts() { try { localStorage.setItem('mc1_opts', JSON.stringify(OPTS)); } catch (e) {} }

  let heartsFull = null, heartsEmpty = null, heartsHalf = null;
  function buildHearts() { heartsFull = Tex.heart('full'); heartsHalf = Tex.heart('half'); heartsEmpty = Tex.heart('empty'); }

  function hearts(hp) {
    const el = $('hearts'); if (!el || !heartsFull) return;
    let html = '';
    for (let i = 0; i < 10; i++) {
      const src = hp >= (i + 1) * 2 ? heartsFull : hp > i * 2 ? heartsHalf : heartsEmpty;
      html += '<img class="hb-icon" src="' + src + '">';
    }
    el.innerHTML = html;
  }

  function buildHotbar() {
    const bar = $('hotbar'); bar.innerHTML = '';
    hotbar.forEach((id, i) => {
      const s = document.createElement('div');
      s.className = 'slot' + (i === sel ? ' sel' : '');
      if (id) { const c = document.createElement('canvas'); drawInto(c, id); s.appendChild(c); }
      s.addEventListener('click', () => select(i));
      bar.appendChild(s);
    });
  }
  function drawInto(canvas, id) { Tex.blockIcon(canvas, BLOCKS[id]); }

  function refreshSel() {
    const slots = $('hotbar').children;
    for (let i = 0; i < slots.length; i++) slots[i].classList.toggle('sel', i === sel);
    itemToast(BLOCKS[hotbar[sel]] ? BLOCKS[hotbar[sel]].name : '');
  }

  function select(i) { sel = ((i % 9) + 9) % 9; refreshSel(); }
  function scroll(d) { select(sel + (d > 0 ? 1 : -1)); }

  let toastT = null;
  function itemToast(name) {
    const el = $('item-name'); if (!name) return;
    el.textContent = name; el.style.opacity = 1;
    clearTimeout(toastT); toastT = setTimeout(() => el.style.opacity = 0, 1400);
  }

  let msgT = null;
  function toast(msg) {
    const el = $('toast'); el.textContent = msg; el.style.opacity = 1;
    clearTimeout(msgT); msgT = setTimeout(() => el.style.opacity = 0, 2200);
  }

  /* ---------- block picker ---------- */
  function buildPicker() {
    const grid = $('picker-grid'); grid.innerHTML = '';
    PICKER_IDS.forEach((id) => {
      const d = document.createElement('div');
      d.className = 'pk'; d.title = BLOCKS[id].name;
      const c = document.createElement('canvas'); Tex.blockIcon(c, BLOCKS[id]);
      d.appendChild(c);
      d.addEventListener('click', () => Game.pickIntoSlot(id));
      grid.appendChild(d);
    });
  }

  /* ---------- screens ---------- */
  function showScreen(name) {
    ['title', 'pause', 'picker', 'death'].forEach((s) => $(s).classList.toggle('hidden', s !== name));
    $('hud').classList.toggle('hidden', !!name);
    if (Game && Game.touchMode) $('touch').classList.toggle('hidden', !!name);
  }

  function applyOpts() {
    Scene.camera.fov = OPTS.fov; Scene.camera.updateProjectionMatrix();
    Scene.setRenderDist(OPTS.rd);
    Sfx.setEnabled(OPTS.sound);
    $('val-fov').textContent = OPTS.fov + '°';
    $('val-rd').textContent = OPTS.rd * CFG.CHUNK + 'm';
    $('val-sens').textContent = OPTS.sens;
  }

  function wireOptions() {
    const bind = (id, key, after) => {
      const el = $(id); el.value = OPTS[key];
      el.addEventListener('input', () => { OPTS[key] = +el.value; saveOpts(); applyOpts(); if (after) after(); });
    };
    bind('opt-fov', 'fov'); bind('opt-rd', 'rd'); bind('opt-sens', 'sens');
    const snd = $('opt-sound'); snd.checked = OPTS.sound;
    snd.addEventListener('change', () => { OPTS.sound = snd.checked; saveOpts(); applyOpts(); });
  }

  function init() {
    buildHearts(); hearts(20); buildHotbar(); buildPicker(); wireOptions();
    // Java-style menus: dirt texture behind pause/picker/death, see-through panorama dimming on the title
    const url = Tex.tile('dirt').toDataURL();
    document.querySelectorAll('.screen').forEach((s) => {
      s.classList.add('dirt-bg');
      if (s.id === 'title') {
        s.style.backgroundImage = 'linear-gradient(rgba(6,10,20,.25), rgba(6,10,20,.4))';
      } else {
        s.style.backgroundImage = 'linear-gradient(rgba(6,10,20,.78), rgba(6,10,20,.9)), url(' + url + ')';
        s.style.backgroundSize = 'auto, 72px 72px';
      }
    });
    const splashes = ['Also try Terraria!', '100% JavaScript!', 'No build step required!', 'Do not dig straight down!', 'file:// approved!'];
    $('splash').textContent = splashes[(Math.random() * splashes.length) | 0];
  }

  return {
    init, hearts, select, scroll, refreshSel, itemToast, toast, showScreen, applyOpts, buildHotbar,
    sens: () => OPTS.sens * .00003,
    selectedBlock: () => hotbar[sel],
    setSlot(i, id) { hotbar[i] = id; buildHotbar(); refreshSel(); },
    get sel() { return sel; },
    get hotbarArr() { return hotbar; },
    setHotbar(arr) { if (arr && arr.length === 9) { hotbar = arr.slice(); buildHotbar(); } },
    OPTS,
    debugOn: false
  };
})();
