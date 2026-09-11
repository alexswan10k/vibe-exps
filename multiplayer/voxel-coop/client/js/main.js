// voxel-coop client entry: scene, networking, chunk streaming, mining, day/night.
import { B, CHUNK, WORLD_H, HARDNESS, PICK_MULT, toolMultFor, isPlaceable, WALK_THROUGH, resolveServerUrl, httpBase } from "./config.js";
import { Net, PollNet } from "./net.js";
import { WorldClient, makeMaterials } from "./world.js";
import { Player } from "./player.js";
import { Entities } from "./entities.js";
import { Touch } from "./touch.js";
import { CrackOverlay, Particles } from "./fx.js";
import { Hand } from "./hand.js";
import { UI } from "./ui.js";
import { audio } from "./audio.js";

const RENDER_DIST = 6;
const UNLOAD_DIST = 8;
const $ = (id) => document.getElementById(id);

// ---------- three.js setup ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3e9ed6);
scene.fog = new THREE.Fog(0x3e9ed6, 40, 150);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
// sRGB output: textures are authored in sRGB and decoded on upload, so the
// framebuffer must re-encode — otherwise mids crush (dark everything) while
// bright blocks still clip. Light levels below are tuned for this pipeline.
renderer.outputEncoding = THREE.sRGBEncoding;
// real-time shadows: single 1024 cascade glued to the player (see applyTime).
// cheap enough on desktop; auto-off on touch / legacy poll mode, P toggles.
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
let shadowsOn = true;
try { shadowsOn = localStorage.getItem("voxelcoop.shadows") !== "0"; } catch { /* noop */ }
renderer.shadowMap.enabled = shadowsOn;
$("game").appendChild(renderer.domElement);
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const ambient = new THREE.AmbientLight(0xffffff, 0.65);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 0.75);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
{
  // ortho box around the player; light position/target move every frame in applyTime
  const S = 45;
  const c = sun.shadow.camera;
  c.left = -S; c.right = S; c.top = S; c.bottom = -S; c.near = 1; c.far = 220;
  c.updateProjectionMatrix();
}
sun.shadow.bias = -0.0008;
scene.add(sun);
scene.add(sun.target);
function setShadows(on) {
  shadowsOn = on;
  renderer.shadowMap.enabled = on;
  sun.castShadow = on;
  try { localStorage.setItem("voxelcoop.shadows", on ? "1" : "0"); } catch { /* noop */ }
  // toggling shadowMap at runtime needs a material refresh
  scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  ui.hint(on ? "shadows on" : "shadows off (faster)");
}

// pooled torch lights + flame glow sprites. Baked flood-fill in world.js
// guarantees every torch tints its walls (no pop-in at the pool edge); the
// pool adds live flicker + speculars where the eye actually is.
const TORCH_LIGHTS = 12;
const TORCH_DIST = 22;
const torchPool = [];
function makeFlameTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, "rgba(255,240,200,1)");
  grad.addColorStop(0.25, "rgba(255,190,90,0.85)");
  grad.addColorStop(0.55, "rgba(255,120,30,0.28)");
  grad.addColorStop(1, "rgba(255,90,10,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}
const flameTex = makeFlameTexture();
for (let i = 0; i < TORCH_LIGHTS; i++) {
  // modest intensity + tight decay: a warm pool near the flame, not a
  // nuclear glow — the baked flood-fill already carries torchlight further
  const l = new THREE.PointLight(0xffa845, 0, TORCH_DIST, 2);
  scene.add(l);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: flameTex, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  s.scale.set(1.1, 1.1, 1);
  scene.add(s);
  torchPool.push({ light: l, sprite: s });
}
// dedicated hand light: carrying a torch lights the way like a lantern
const heldLight = new THREE.PointLight(0xffb45e, 0, 17, 2);
scene.add(heldLight);
let cachedNear = [];
let lastTorchSearch = 0;
function updateTorchLights(now) {
  // re-search nearest infrequently (sort over all torches), flicker every frame
  if (now - lastTorchSearch > 250) {
    lastTorchSearch = now;
    cachedNear = world.nearestTorches(player.pos, TORCH_LIGHTS, 34);
  }
  for (let i = 0; i < TORCH_LIGHTS; i++) {
    const p = torchPool[i];
    if (i < cachedNear.length) {
      p.light.position.set(cachedNear[i][0], cachedNear[i][1], cachedNear[i][2]);
      p.sprite.position.copy(p.light.position);
      const f = Math.sin(now / 130 + i * 2.1) * 0.14 + Math.sin(now / 47 + i * 1.3) * 0.06;
      p.light.intensity = 1.1 + f;
      p.sprite.material.opacity = 0.75 + f * 0.9;
      const s = 1.0 + f * 0.35;
      p.sprite.scale.set(s, s, 1);
      p.sprite.visible = true;
    } else {
      p.light.intensity = 0;
      p.sprite.visible = false;
    }
  }
  // held torch lantern
  try {
    const held = window.voxUI?.heldItem?.();
    const eye = player.eye();
    if (held?.id === B.TORCH && !dead) {
      const d = player.lookDir();
      heldLight.position.set(eye.x + d.x * 0.6, eye.y - 0.15, eye.z + d.z * 0.6);
      heldLight.intensity = 1.0 + Math.sin(now / 120) * 0.1 + Math.sin(now / 43) * 0.05;
    } else {
      heldLight.intensity = 0;
    }
  } catch { /* UI not ready yet */ }
}

const world = new WorldClient(scene, makeMaterials());

// visible sun + moon + stars (the directional light alone shows no disc)
function skyDisc(color, r, opacity) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, fog: false, depthWrite: false }),
  );
  m.renderOrder = -10;
  m.frustumCulled = false;
  scene.add(m);
  return m;
}
const sunDisc = skyDisc(0xffdd55, 14, 1);
const sunGlow = skyDisc(0xffeeaa, 26, 0.25);
const moonDisc = skyDisc(0xe8ecf4, 10, 0.9);
const starGeo = new THREE.BufferGeometry();
{
  const N = 420, pos = new Float32Array(N * 3), R = 420;
  for (let i = 0; i < N; i++) {
    const t = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1;
    const s = Math.sqrt(1 - u * u);
    pos[i * 3] = Math.cos(t) * s * R;
    pos[i * 3 + 1] = Math.abs(u) * R * 0.98 + 2;
    pos[i * 3 + 2] = Math.sin(t) * s * R;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
}
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
  color: 0xffffff, size: 1.6, sizeAttenuation: false,
  transparent: true, opacity: 0, fog: false, depthWrite: false,
}));
stars.renderOrder = -10;
stars.frustumCulled = false;
scene.add(stars);
window.voxSky = { sunDisc, sunGlow, moonDisc, stars }; // handy for screenshots/tests
const player = new Player(camera, renderer.domElement);
player.onFallDamage = (dmg) => net.fall(dmg);
const crack = new CrackOverlay(scene);
const particles = new Particles(scene);

// approx block colors for debris particles
const BREAK_COLORS = {
  1: 0x5cb84a, 2: 0x7a5230, 3: 0x808080, 4: 0xd9c78c, 5: 0x5a3a1a,
  6: 0x228b22, 7: 0x9c6f34, 8: 0x1e1e1e, 9: 0xeeeeee, 11: 0x555555,
  12: 0xc08a5a, 13: 0x8a5a20, 14: 0x6b6b6e, 15: 0xffcf4d, 16: 0x737373,
  17: 0xcfe4ec, 18: 0xf4c20d, 19: 0x5ff2e0, 20: 0x9c6f34, 21: 0x8c8c90,
  22: 0x8a5f30, 23: 0xc22f2f, 24: 0xd6c48c, 25: 0x3f8f38, 26: 0x9ea6b5,
  27: 0x9e4030, 28: 0x857c72, 29: 0x5a3a1a, 30: 0x1a5230, 31: 0x4da64a,
  32: 0xd42a2a, 33: 0xf2d024, 34: 0xc22f2f, 35: 0x7a5a38, 36: 0x6bad4d,
};
function breakColor(block) {
  return BREAK_COLORS[block] ?? 0xffffff;
}
const entities = new Entities(scene);
const ui = new UI();
scene.add(camera); // the held-item viewmodel rides on the camera
const hand = new Hand(camera, world.materials);
window.voxHand = hand; // handy for screenshots/tests
window.voxUI = ui;
window.voxDbg = { renderer, sun, scene, setShadows };
// damage vignette overlay (styled in style.css) + mute button; created here if missing
if (!document.getElementById("dmg-vignette")) {
  const d = document.createElement("div");
  d.id = "dmg-vignette";
  document.body.appendChild(d);
}
if (!document.getElementById("mute-btn")) {
  const b = document.createElement("button");
  b.id = "mute-btn";
  b.textContent = "🔊";
  b.title = "mute (M)";
  b.addEventListener("click", () => audio.toggleMute());
  document.body.appendChild(b);
}
function flashDamage() {
  const d = document.getElementById("dmg-vignette");
  if (!d) return;
  d.classList.remove("show");
  void d.offsetWidth;
  d.classList.add("show");
}
let net = null;
let welcomed = false;
let connectEpoch = 0;

// ---- pointer focus rules (minecraft-style) ----
ui.requestLock = () => player.lock();
ui.releaseLock = () => { if (document.pointerLockElement) document.exitPointerLock(); };
function menuVisible() { return $("menu").style.display !== "none"; }
function relockIfClear() {
  if (myId >= 0 && !dead && !ui.invOpen && !ui.helpOpen() && !ui.chatFocused() &&
      !menuVisible() && net?.connected) {
    player.lock();
  }
}
ui.onChatClosed = () => relockIfClear();
player.onLockChange = (locked) => {
  if (!locked) {
    // stop mining the moment look disengages
    mouseSafeRelease();
    // Esc with nothing open = pause menu (closing it re-locks via toggleHelp)
    if (myId >= 0 && !dead && !ui.invOpen && !ui.helpOpen() && !ui.chatFocused() &&
        !menuVisible() && net?.connected) {
      ui.toggleHelp(true);
    }
  }
};

let myId = -1;
let serverTime = 0.25;
let dead = false;
let pendingChunks = new Set();
let lastStream = 0;
let lastMoveSend = 0;
let breaking = null; // {x,y,z,block,prog,need}
function clearBreak() {
  breaking = null;
  ui.breakProgress(null);
  crack.hide();
}
let spawnPos = [0.5, 30, 0.5];

function decodeRLE(rle) {
  const out = new Uint8Array(CHUNK * WORLD_H * CHUNK);
  let o = 0;
  for (let i = 0; i < rle.length; i += 2) {
    out.fill(rle[i], o, o + rle[i + 1]);
    o += rle[i + 1];
  }
  return out;
}

// ---------- day/night ----------
function applyTime(t) {
  serverTime = t;
  // t: 0 = sunrise... map to sun angle
  const ang = (t - 0.25) * Math.PI * 2; // 0.25 -> morning
  const elev = Math.sin(ang);
  const day = Math.max(0, Math.min(1, elev * 2 + 0.25));
  const night = 1 - day;
  const sky = new THREE.Color(0x3e9ed6).lerp(new THREE.Color(0x060913), night * 0.92);
  scene.background = sky;
  scene.fog.color.copy(sky);
  ambient.intensity = 0.55 * day + 0.04;
  sun.intensity = 0.55 * Math.max(0, day);
  sun.position.set(
    player.pos.x + Math.cos(ang) * 60,
    Math.max(8, elev * 80),
    player.pos.z + 30,
  );
  sun.target.position.copy(player.pos);
  // sun/moon discs ride the same direction as the light; stars hang overhead
  const eye = player.eye();
  const sd = new THREE.Vector3().copy(sun.position).sub(player.pos).normalize();
  for (const [m, s] of [[sunDisc, 1], [sunGlow, 1], [moonDisc, -1]]) {
    m.position.copy(eye).addScaledVector(sd, 380 * s);
    m.lookAt(camera.position);
  }
  const sunUp = Math.max(0, Math.min(1, elev * 3 + 0.25));
  sunDisc.material.opacity = sunUp;
  sunGlow.material.opacity = 0.25 * sunUp;
  moonDisc.material.opacity = 0.9 * night;
  stars.position.copy(eye);
  stars.material.opacity = night * 0.9;
}

// ---------- chunk streaming ----------
function streamChunks() {
  const pcx = Math.floor(player.pos.x / CHUNK);
  const pcz = Math.floor(player.pos.z / CHUNK);
  for (let dx = -RENDER_DIST; dx <= RENDER_DIST; dx++) {
    for (let dz = -RENDER_DIST; dz <= RENDER_DIST; dz++) {
      if (dx * dx + dz * dz > (RENDER_DIST + 0.5) ** 2) continue;
      const cx = pcx + dx, cz = pcz + dz;
      const k = `${cx},${cz}`;
      if (!world.chunks.has(k) && !pendingChunks.has(k)) {
        pendingChunks.add(k);
        net.reqChunk(cx, cz);
      }
    }
  }
  // unload far chunks so long walks don't leak meshes (nearest torch lights unaffected)
  for (const k of [...world.chunks.keys()]) {
    const [cx, cz] = k.split(",").map(Number);
    if (Math.hypot(cx - pcx, cz - pcz) > UNLOAD_DIST) {
      pendingChunks.delete(k);
      world.dropChunk(cx, cz);
    }
  }
}

// ---------- mining ----------
function breakTime(block, heldId) {
  const base = HARDNESS[block];
  if (base === undefined || base === Infinity) return Infinity;
  const mult = toolMultFor(block, heldId);
  const isStone = [3, 11, 12, 14, 16, 18, 19, 21, 24, 27].includes(block);
  if (isStone) {
    // stone-likes without any tool are brutally slow (mult 1 here = bare hands)
    if (mult <= 1) return base * 3.3;
    return base / mult;
  }
  return base / mult;
}

const mouse = { left: false, right: false };
let lastSwing = 0;

function tryAttack() {
  const nowSwing = performance.now();
  if (nowSwing - lastSwing < 330) return false;
  const hitMob = entities.pickMob(player.eye(), player.lookDir());
  if (hitMob === null) return false;
  lastSwing = nowSwing;
  const held = ui.heldItem();
  net.attackMob(hitMob, held?.id);
  hand.swing();
  ui.pulse(); // instant feedback; mobHit echo pulses again on confirm
  return true;
}

function mouseSafeRelease() {
  mouse.left = false;
  clearBreak();
}

const touch = new Touch(player, {
  mine: (down) => {
    if (!net?.connected || ui.invOpen || dead) return;
    mouse.left = down;
    if (!down) clearBreak();
  },
  place: () => { if (net?.connected && !ui.invOpen && !dead) doPlace(); },
  attack: () => { if (net?.connected && !ui.invOpen && !dead) tryAttack(); },
  inv: () => ui.toggleInv(),
});
if (!("ontouchstart" in window) && !(navigator.maxTouchPoints > 0)) {
  $("touch-toggle").style.display = "none";
}
// shadows default off on touch devices + legacy poll mode (old iPads) unless the user chose
try {
  if (localStorage.getItem("voxelcoop.shadows") === null &&
      (touch.enabled || new URLSearchParams(location.search).get("transport") === "poll" ||
       (("ontouchstart" in window) && navigator.maxTouchPoints > 0))) {
    renderer.shadowMap.enabled = false;
    sun.castShadow = false;
    shadowsOn = false;
  }
} catch { /* noop */ }

renderer.domElement.addEventListener("mousedown", (e) => {
  if (!net?.connected || ui.invOpen || dead) return;
  if (!player.locked) { player.lock(); return; }
  if (e.button === 0) {
    // holding LMB on a mob auto-swings (see tickBreaking); single click hits now
    tryAttack();
    mouse.left = true;
    breaking = null;
  } else if (e.button === 2) {
    doPlace();
  }
});
addEventListener("mouseup", (e) => {
  if (e.button === 0) { mouse.left = false; clearBreak(); }
});
addEventListener("contextmenu", (e) => e.preventDefault());

function doPlace() {
  const hit = world.raycast(player.eye(), player.lookDir(), 6);
  if (!hit) return;
  // interactables first (MC behaviour): table opens crafting, furnace smelts, bed sets spawn
  if (hit.block === B.CRAFT_TABLE) { ui.toggleInv(true); return; }
  if (hit.block === B.FURNACE) { net.smelt("start", hit.x, hit.y, hit.z); return; }
  if (hit.block === B.BED) { net.setBed(hit.x, hit.y, hit.z); ui.hint("🛏 spawn set — you'll wake up here"); return; }
  const held = ui.heldItem();
  if (!held || !isPlaceable(held.id)) {
    ui.hint("select a block in hotbar (1-9) to place");
    return;
  }
  // flowers/grass don't block placement — the new block replaces them
  const tx = WALK_THROUGH.has(hit.block) ? hit.x : hit.x + hit.nx;
  const ty = WALK_THROUGH.has(hit.block) ? hit.y : hit.y + hit.ny;
  const tz = WALK_THROUGH.has(hit.block) ? hit.z : hit.z + hit.nz;
  net.edit("place", tx, ty, tz, held.id, held.id);
  hand.swing();
  audio.place();
}

function tickBreaking(dt) {
  // touch mode has no pointer lock; the MINE button is the gate instead
  if (!mouse.left || (!player.locked && !touch.enabled) || ui.invOpen || dead) {
    if (breaking) clearBreak();
    return;
  }
  // holding LMB on a mob keeps swinging; otherwise mine the aimed block
  if (tryAttack()) {
    clearBreak();
    return;
  }
  const hit = world.raycast(player.eye(), player.lookDir(), 6);
  if (!hit) { clearBreak(); return; }
  const key = `${hit.x},${hit.y},${hit.z}`;
  if (!breaking || breaking.key !== key) {
    const held = ui.heldItem();
    const need = breakTime(hit.block, held?.id);
    if (!Number.isFinite(need)) {
      ui.hint(hit.block === 8 ? "bedrock is unbreakable" : "can't break that");
      clearBreak();
      mouse.left = false;
      return;
    }
    breaking = { key, x: hit.x, y: hit.y, z: hit.z, block: hit.block, prog: 0, need };
  }
  breaking.prog += dt;
  ui.breakProgress(breaking.prog / breaking.need);
  crack.show(breaking.x, breaking.y, breaking.z, breaking.prog / breaking.need);
  // occasional chip puff while grinding away
  const nowPuff = performance.now();
  if (nowPuff - (breaking.lastPuff ?? 0) > 300) {
    breaking.lastPuff = nowPuff;
    particles.burst(breaking.x + 0.5, breaking.y + 0.5, breaking.z + 0.5, breakColor(breaking.block), 2);
  }
  // keep swinging while grinding (swing() itself gates on the in-flight swing)
  if (nowPuff - (breaking.lastSwing ?? 0) > 450) {
    breaking.lastSwing = nowPuff;
    hand.swing();
  }
  if (breaking.prog >= breaking.need) {
    const held = ui.heldItem();
    net.edit("break", breaking.x, breaking.y, breaking.z, undefined, held?.id);
    particles.burst(breaking.x + 0.5, breaking.y + 0.5, breaking.z + 0.5, breakColor(breaking.block), 14);
    audio.breakBlock();
    clearBreak();
  }
}

// furnace / bed interact
addEventListener("keydown", (e) => {
  if (e.code === "KeyM" && !ui.chatFocused()) { audio.toggleMute(); return; }
  if (e.code === "KeyP" && !ui.chatFocused()) { setShadows(!shadowsOn); return; }
  if (e.code === "KeyF" && !ui.chatFocused()) {
    const hit = world.raycast(player.eye(), player.lookDir(), 6);
    if (hit && hit.block === B.FURNACE) net.smelt("start", hit.x, hit.y, hit.z);
    else if (hit && hit.block === B.BED) { net.setBed(hit.x, hit.y, hit.z); ui.hint("🛏 spawn set — you'll wake up here"); }
  }
  if (e.code === "KeyT" && !ui.chatFocused()) {
    e.preventDefault();
    ui.el("chat-input").focus();
  }
});

// ---------- net handlers (attach to whichever transport is active) ----------
function attachHandlers() {
net.on("open", () => ui.status("connected — loading world…"));
net.on("close", () => ui.status("disconnected — retrying…"));

net.on("welcome", (m) => {
  welcomed = true;
  myId = m.id;
  serverTime = m.time;
  player.pos.set(m.spawn[0], m.spawn[1], m.spawn[2]);
  spawnPos = m.spawn;
  ui.status(`playing as ${$("menu-name").value || "player"}`);
  $("menu").style.display = "none";
  ui.maybeShowHelp();
  player.lock();
  streamChunks();
});

net.on("chunk", (m) => {
  pendingChunks.delete(`${m.cx},${m.cz}`);
  world.setChunk(m.cx, m.cz, decodeRLE(m.rle));
});

net.on("block", (m) => world.setLocal(m.x, m.y, m.z, m.block));
net.on("players", (m) => entities.setPlayers(m.list));
net.on("mobs", (m) => entities.setMobs(m.list));
net.on("mobHit", (m) => {
  entities.flash(m.id);
  ui.pulse();
  audio.hit();
});
let prevInvTotal = 0;
net.on("inv", (m) => {
  const total = (m.slots ?? []).reduce((a, s) => a + (s?.n ?? 0), 0);
  if (total > prevInvTotal && prevInvTotal > 0) audio.pickup();
  prevInvTotal = total;
  ui.setSlots(m.slots);
});
let pendingFill = null; // {puts:[{slot,g}]} — fired once the grid echo shows empty
function fireFill() {
  const p = pendingFill;
  pendingFill = null;
  for (const put of p.puts) net.gridPut(put.slot, put.g, false);
}
net.on("grid", (m) => {
  ui.setGrid(m.cells, m.result);
  if (pendingFill && m.cells.every((c) => !c.id)) fireFill();
});
ui.onAutoFill = (recipe) => {
  // plan one unit per pattern cell from the current inventory snapshot
  const avail = {};
  ui.slots.forEach((s, i) => {
    if (s?.id) (avail[s.id] ??= []).push({ slot: i, left: s.n });
  });
  const puts = [];
  for (let g = 0; g < 9; g++) {
    const id = recipe.pat[g];
    if (!id) continue;
    const src = (avail[id] ?? []).find((a) => a.left > 0);
    if (!src) { ui.hint("not enough materials"); return; }
    src.left -= 1;
    puts.push({ slot: src.slot, g });
  }
  // clear the grid first (takes only ever add back, so the plan stays valid)
  ui.gridCells.forEach((c, g) => { if (c.id) net.gridTake(g); });
  if (ui.gridCells.every((c) => !c.id)) {
    pendingFill = null;
    for (const put of puts) net.gridPut(put.slot, put.g, false);
  } else {
    pendingFill = { puts };
  }
};
let prevHp = -1;
let prevHunger = -1;
net.on("vitals", (m) => {
  if (m.dead && !dead) ui.releaseLock?.();
  dead = m.dead;
  if (prevHp >= 0 && m.hp < prevHp) { audio.hurt(); flashDamage(); }
  if (prevHunger >= 0 && m.hunger > prevHunger) audio.eat();
  prevHp = m.hp;
  prevHunger = m.hunger;
  ui.setVitals(m.hp, m.maxHp, m.hunger, m.dead);
});
net.on("time", (m) => applyTime(m.time));
net.on("reset", (m) => {
  // server wiped the world: drop every cached chunk (seed changed, old
  // terrain is stale), teleport to the new spawn, re-stream from scratch
  for (const k of [...world.chunks.keys()]) {
    const [cx, cz] = k.split(",").map(Number);
    world.dropChunk(cx, cz);
  }
  pendingChunks.clear();
  player.pos.set(m.spawn[0], m.spawn[1], m.spawn[2]);
  spawnPos = m.spawn;
  streamChunks();
  ui.status(`fresh world — seed ${m.seed}`);
});
net.on("chat", (m) => ui.chatMsg(m.from, m.msg));
net.on("ping", () => {
  // net.js auto-replies pong; lastPingMs drives a subtle status readout
  if (net.lastPingMs > 0) ui.status(`connected · ${Math.round(net.lastPingMs)}ms`);
});
net.on("smeltState", (m) => {
  const s = m.states[0];
  ui.hint(s ? `smelting… ${Math.round(s.progress * 100)}%` : "");
});
net.on("denied", (m) => ui.hint(m.reason));
} // attachHandlers

// ---------- menu ----------
$("menu-server").value = resolveServerUrl();
try { $("menu-name").value = localStorage.getItem("voxelcoop.name") ?? `player${Math.floor(Math.random() * 99)}`; } catch { /* noop */ }
function connectGame(serverUrl, name) {
  if (net) { try { net.disconnect(); } catch { /* noop */ } }
  pendingChunks.clear();
  myId = -1;
  welcomed = false;
  const epoch = ++connectEpoch;
  const forcePoll = new URLSearchParams(location.search).get("transport") === "poll";
  if (forcePoll) {
    net = new PollNet();
    ui.status("connecting (legacy poll mode)…");
  } else {
    net = new Net();
    ui.status("connecting…");
    // auto-fallback for devices where websockets fail (old iPads)
    setTimeout(() => {
      if (!welcomed && epoch === connectEpoch && net instanceof Net) {
        try { net.disconnect(); } catch { /* noop */ }
        net = new PollNet();
        attachHandlers();
        net.connect(serverUrl, name);
        ui.status("websocket failed — legacy poll mode…");
      }
    }, 6000);
  }
  attachHandlers();
  net.connect(serverUrl, name);
}
$("menu-join").addEventListener("click", () => {
  audio.ensure();
  const name = $("menu-name").value.trim().slice(0, 16) || "player";
  try { localStorage.setItem("voxelcoop.name", name); } catch { /* noop */ }
  connectGame($("menu-server").value.trim(), name);
});
// fetch public status for hint (works when menu served from server)
(async () => {
  try {
    const base = httpBase(resolveServerUrl());
    if (!base.startsWith("http")) return;
    const r = await fetch(`${base}/api/status`);
    const s = await r.json();
    ui.hint(`server: ${s.players} online · seed ${s.seed}`);
  } catch { /* offline / file:// without server yet */ }
})();

ui.onGridPut = (slot, g, all) => net.gridPut(slot, g, all);
ui.onGridTake = (g) => net.gridTake(g);
ui.onCraftTake = () => net.craftTake();
ui.onCraftDirect = (id, n) => net.craftDirect(id, n);
ui.onChat = (msg) => (net.sendChat ? net.sendChat(msg) : net.chat(msg));
ui.onRespawn = () => net.respawn();
ui.onEat = (slot) => { hand.eat(); net.eat(slot); };
ui.onMoveItem = (from, to) => net.moveItem(from, to);
$("respawn-btn").addEventListener("click", () => { net.respawn(); player.lock(); });
$("help-close").addEventListener("click", () => ui.toggleHelp(false));
$("menu").addEventListener("click", (e) => {
  if (e.target.id === "menu" && net?.connected) { $("menu").style.display = "none"; player.lock(); }
});
renderer.domElement.addEventListener("click", () => {
  if (net?.connected && !ui.invOpen && !player.locked && myId >= 0) player.lock();
});

// ---------- main loop ----------
let prev = performance.now();
let lastTorch = 0;
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;

  if (myId >= 0 && net?.connected) {
    if (!ui.invOpen && !dead) player.update(dt, world);
    // gravity-only update while dead/inv so camera stays sane
    player.euler.set(player.pitch, player.yaw, 0);
    camera.quaternion.setFromEuler(player.euler);
    camera.position.copy(player.eye());

    tickBreaking(dt);

    if (now - lastStream > 400) { lastStream = now; streamChunks(); }
    updateTorchLights(now); // search 4Hz internally, flicker every frame
    if (now - lastTorch > 500) {
      lastTorch = now;
      ui.setNearTable(world.hasBlockNear(player.pos.x, player.pos.y, player.pos.z, B.CRAFT_TABLE, 4));
      // unstick: if embedded in a block (stale spawn, lag), pop upward
      if (player.collides(world, player.pos.x, player.pos.y, player.pos.z)) {
        player.pos.y += 1;
        player.vel.set(0, 0, 0);
      }
    }
    if (now - lastMoveSend > 66) {
      lastMoveSend = now;
      net.move(
        [Math.round(player.pos.x * 100) / 100, Math.round(player.pos.y * 100) / 100, Math.round(player.pos.z * 100) / 100],
        Math.round(player.yaw * 100) / 100,
        Math.round(player.pitch * 100) / 100,
      );
    }
    // contextual hint for furnace
    if (!dead) {
      const hit = world.raycast(player.eye(), player.lookDir(), 6);
      if (hit?.block === B.FURNACE) ui.hint("F: smelt iron ore / raw pork + coal → ingot / cooked pork");
      else if (hit && ui.el("hint").textContent.startsWith("F: smelt")) ui.hint("");
    }
  }
  entities.update(dt, camera);
  particles.update(dt);
  world.tickAnim(now);
  // held-item viewmodel follows the hotbar, bobs while walking
  hand.setHeld(ui.heldItem()?.id);
  hand.update(dt, myId >= 0 && Math.hypot(player.vel.x, player.vel.z) > 0.8 && player.onGround);
  // splash on water entry
  if (myId >= 0 && net?.connected && !dead) {
    const inWater = player.inWater(world);
    if (inWater && !frame._wasInWater) {
      audio.splash();
      particles.splashBurst(player.pos.x, player.pos.y + 1, player.pos.z);
    }
    frame._wasInWater = inWater;
  }
  // sprint FOV: 75 -> 82 while sprinting (player.js owns .sprinting incl. onGround gate)
  if (window.player === undefined) window.player = player;
  {
    const targetFov = player.sprinting ? 82 : 75;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8);
      camera.updateProjectionMatrix();
    }
  }
  applyTime(serverTime); // cheap enough; keeps sun glued to player
  renderer.render(scene, camera);
}
applyTime(0.25);
frame();
