// voxel-coop client entry: scene, networking, chunk streaming, mining, day/night.
import { B, CHUNK, WORLD_H, HARDNESS, PICK_MULT, isPlaceable, resolveServerUrl, httpBase } from "./config.js";
import { Net } from "./net.js";
import { WorldClient, makeMaterials } from "./world.js";
import { Player } from "./player.js";
import { Entities } from "./entities.js";
import { UI } from "./ui.js";

const RENDER_DIST = 4;
const $ = (id) => document.getElementById(id);

// ---------- three.js setup ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 30, 110);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
$("game").appendChild(renderer.domElement);
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const ambient = new THREE.AmbientLight(0xffffff, 0.65);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 0.75);
scene.add(sun);
scene.add(sun.target);

// pooled torch lights: only the nearest few get a real light (perf)
const TORCH_LIGHTS = 6;
const torchPool = [];
for (let i = 0; i < TORCH_LIGHTS; i++) {
  const l = new THREE.PointLight(0xffa845, 0, 14, 2);
  scene.add(l);
  torchPool.push(l);
}
function updateTorchLights() {
  const near = world.nearestTorches(player.pos, TORCH_LIGHTS, 26);
  for (let i = 0; i < TORCH_LIGHTS; i++) {
    if (i < near.length) {
      torchPool[i].position.set(near[i][0], near[i][1], near[i][2]);
      // flicker
      torchPool[i].intensity = 1.0 + Math.sin(performance.now() / 130 + i * 2.1) * 0.12;
    } else {
      torchPool[i].intensity = 0;
    }
  }
}

const world = new WorldClient(scene, makeMaterials());
const player = new Player(camera, renderer.domElement);
player.onFallDamage = (dmg) => net.fall(dmg);
const entities = new Entities(scene);
const ui = new UI();
const net = new Net();

let myId = -1;
let serverTime = 0.25;
let dead = false;
let pendingChunks = new Set();
let lastStream = 0;
let lastMoveSend = 0;
let breaking = null; // {x,y,z,block,prog,need}
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
  const sky = new THREE.Color(0x87ceeb).lerp(new THREE.Color(0x060913), night * 0.92);
  scene.background = sky;
  scene.fog.color.copy(sky);
  ambient.intensity = 0.65 * day + 0.18;
  sun.intensity = 0.75 * Math.max(0, day);
  sun.position.set(
    player.pos.x + Math.cos(ang) * 60,
    Math.max(8, elev * 80),
    player.pos.z + 30,
  );
  sun.target.position.copy(player.pos);
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
}

// ---------- mining ----------
function breakTime(block, heldId) {
  const base = HARDNESS[block];
  if (base === undefined || base === Infinity) return Infinity;
  const mult = PICK_MULT[heldId] ?? 1;
  const isPickable = [3, 11, 12, 14, 16].includes(block);
  if (isPickable) {
    if (!PICK_MULT[heldId]) return base * 3.3; // by hand: very slow
    return base / mult;
  }
  return base / (PICK_MULT[heldId] ? 1.5 : 1);
}

const mouse = { left: false, right: false };
renderer.domElement.addEventListener("mousedown", (e) => {
  if (!net.connected || ui.invOpen || dead) return;
  if (!player.locked) { player.lock(); return; }
  if (e.button === 0) {
    // attack mob first?
    const hitMob = entities.pickMob(player.eye(), player.lookDir());
    if (hitMob !== null) {
      const held = ui.heldItem();
      net.attackMob(hitMob, held?.id);
      return;
    }
    mouse.left = true;
    breaking = null;
  } else if (e.button === 2) {
    doPlace();
  }
});
addEventListener("mouseup", (e) => {
  if (e.button === 0) { mouse.left = false; breaking = null; ui.breakProgress(null); }
});
addEventListener("contextmenu", (e) => e.preventDefault());

function doPlace() {
  const hit = world.raycast(player.eye(), player.lookDir(), 6);
  if (!hit) return;
  const held = ui.heldItem();
  if (!held || !isPlaceable(held.id)) {
    ui.hint("select a block in hotbar (1-9) to place");
    return;
  }
  const tx = hit.x + hit.nx, ty = hit.y + hit.ny, tz = hit.z + hit.nz;
  net.edit("place", tx, ty, tz, held.id, held.id);
}

function tickBreaking(dt) {
  if (!mouse.left || !player.locked || ui.invOpen || dead) {
    if (breaking) { breaking = null; ui.breakProgress(null); }
    return;
  }
  const hit = world.raycast(player.eye(), player.lookDir(), 6);
  if (!hit) { breaking = null; ui.breakProgress(null); return; }
  const key = `${hit.x},${hit.y},${hit.z}`;
  if (!breaking || breaking.key !== key) {
    const held = ui.heldItem();
    const need = breakTime(hit.block, held?.id);
    if (!Number.isFinite(need)) {
      ui.hint(hit.block === 8 ? "bedrock is unbreakable" : "can't break that");
      breaking = null;
      ui.breakProgress(null);
      mouse.left = false;
      return;
    }
    breaking = { key, x: hit.x, y: hit.y, z: hit.z, block: hit.block, prog: 0, need };
  }
  breaking.prog += dt;
  ui.breakProgress(breaking.prog / breaking.need);
  if (breaking.prog >= breaking.need) {
    const held = ui.heldItem();
    net.edit("break", breaking.x, breaking.y, breaking.z, undefined, held?.id);
    breaking = null;
    ui.breakProgress(null);
  }
}

// furnace interact
addEventListener("keydown", (e) => {
  if (e.code === "KeyF" && !ui.chatFocused()) {
    const hit = world.raycast(player.eye(), player.lookDir(), 6);
    if (hit && hit.block === B.FURNACE) net.smelt("start", hit.x, hit.y, hit.z);
  }
  if (e.code === "KeyT" && !ui.chatFocused()) {
    e.preventDefault();
    ui.el("chat-input").focus();
  }
});

// ---------- net handlers ----------
net.on("open", () => ui.status("connected — loading world…"));
net.on("close", () => ui.status("disconnected — retrying…"));

net.on("welcome", (m) => {
  myId = m.id;
  serverTime = m.time;
  player.pos.set(m.spawn[0], m.spawn[1], m.spawn[2]);
  spawnPos = m.spawn;
  ui.status(`playing as ${$("menu-name").value || "player"}`);
  $("menu").style.display = "none";
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
net.on("inv", (m) => ui.setSlots(m.slots));
net.on("vitals", (m) => {
  dead = m.dead;
  ui.setVitals(m.hp, m.maxHp, m.hunger, m.dead);
});
net.on("time", (m) => applyTime(m.time));
net.on("chat", (m) => ui.chatMsg(m.from, m.msg));
net.on("smeltState", (m) => {
  const s = m.states[0];
  ui.hint(s ? `smelting… ${Math.round(s.progress * 100)}%` : "");
});
net.on("denied", (m) => ui.hint(m.reason));

// ---------- menu ----------
$("menu-server").value = resolveServerUrl();
try { $("menu-name").value = localStorage.getItem("voxelcoop.name") ?? `player${Math.floor(Math.random() * 99)}`; } catch { /* noop */ }
$("menu-join").addEventListener("click", () => {
  const name = $("menu-name").value.trim().slice(0, 16) || "player";
  try { localStorage.setItem("voxelcoop.name", name); } catch { /* noop */ }
  net.disconnect();
  pendingChunks.clear();
  net.connect($("menu-server").value.trim(), name);
  ui.status("connecting…");
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

ui.onCraft = (id) => net.craft(id, false);
ui.onChat = (msg) => net.chat(msg);
ui.onRespawn = () => net.respawn();
ui.onEat = (slot) => net.eat(slot);
ui.onMoveItem = (from, to) => net.moveItem(from, to);
$("respawn-btn").addEventListener("click", () => net.respawn());
$("menu").addEventListener("click", (e) => {
  if (e.target.id === "menu" && net.connected) { $("menu").style.display = "none"; player.lock(); }
});
renderer.domElement.addEventListener("click", () => {
  if (net.connected && !ui.invOpen && !player.locked && myId >= 0) player.lock();
});

// ---------- main loop ----------
let prev = performance.now();
let lastTorch = 0;
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;

  if (myId >= 0 && net.connected) {
    if (!ui.invOpen && !dead) player.update(dt, world);
    // gravity-only update while dead/inv so camera stays sane
    player.euler.set(player.pitch, player.yaw, 0);
    camera.quaternion.setFromEuler(player.euler);
    camera.position.copy(player.eye());

    tickBreaking(dt);

    if (now - lastStream > 400) { lastStream = now; streamChunks(); }
    if (now - lastTorch > 500) {
      lastTorch = now;
      updateTorchLights();
      ui.setNearTable(world.hasBlockNear(player.pos.x, player.pos.y, player.pos.z, B.CRAFT_TABLE, 4));
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
      if (hit?.block === B.FURNACE) ui.hint("F: smelt 1 iron ore + 1 coal → iron ingot");
      else if (hit && ui.el("hint").textContent.startsWith("F: smelt")) ui.hint("");
    }
  }
  entities.update(dt, camera);
  applyTime(serverTime); // cheap enough; keeps sun glued to player
  renderer.render(scene, camera);
}
applyTime(0.25);
frame();
