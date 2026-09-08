// voxel-coop server: plain-HTTP LAN server (no TLS), static client + WS game loop.
// Run: deno task dev   ->   http://<lan-ip>:8000/

import { B, BLOCK_NAME, HARDNESS, TOOL_CLASS, ClientMsg, FurnaceWire, InvSlot, SWORD_MULT, ServerMsg, Vec3, pickTier, requiredTier } from "./protocol.ts";
import { PORT } from "./protocol.ts";
import { World } from "./world.ts";
import { Players, Player } from "./players.ts";
import { MobSim, mobDrops } from "./mobs.ts";
import { dropFor, giveItems, removeItems, countOf, matchGrid, canFit, isStackable, smeltTick, SMELT_TIME, FurnaceState } from "./crafting.ts";
import { lanIps, serveClientFile, withCors } from "../../shared.ts";

const CLIENT_DIR = new URL("../client", import.meta.url).pathname;
const SAVE_WORLD = new URL("../data/world.json", import.meta.url).pathname;
const SAVE_PLAYERS = new URL("../data/players.json", import.meta.url).pathname;

const world = await World.loadOrCreate(SAVE_WORLD);
const players = new Players();
const mobs = new MobSim();
const furnaces = new Map<string, FurnaceState & { owner: number }>();
const spawn = world.findSpawn();

// ---- player persistence (pos + inventory across restarts) ----
interface SavedPlayer { name: string; p: Vec3; slots: InvSlot[] }
let savedPlayers: Record<string, SavedPlayer> = {};
try {
  savedPlayers = JSON.parse(await Deno.readTextFile(SAVE_PLAYERS));
} catch { /* first run */ }
async function persistPlayers(): Promise<void> {
  try {
    const d: Record<string, SavedPlayer> = { ...savedPlayers };
    for (const pl of players.all.values()) {
      d[pl.name] = { name: pl.name, p: pl.p, slots: pl.slots };
    }
    await Deno.mkdir(SAVE_PLAYERS.split("/").slice(0, -1).join("/"), { recursive: true });
    await Deno.writeTextFile(SAVE_PLAYERS, JSON.stringify(d));
  } catch (e) { console.error("[players] save failed:", e); }
}

function send(sock: WebSocket, msg: ServerMsg): void {
  if (sock.readyState === WebSocket.OPEN) sock.send(JSON.stringify(msg));
}
function broadcast(msg: ServerMsg, exceptId?: number): void {
  const raw = JSON.stringify(msg);
  for (const pl of players.all.values()) {
    if (pl.id !== exceptId && pl.socket && pl.socket.readyState === WebSocket.OPEN) {
      pl.socket.send(raw);
    }
  }
}
function sendVitals(pl: Player): void {
  if (pl.socket) {
    send(pl.socket, { t: "vitals", hp: Math.ceil(pl.hp), maxHp: pl.maxHp, hunger: Math.floor(pl.hunger), dead: pl.dead });
  }
}
function sendInv(pl: Player): void {
  if (pl.socket) send(pl.socket, { t: "inv", slots: pl.slots });
}
function sendGrid(pl: Player): void {
  const nearTable = world.hasBlockNear(pl.p[0], pl.p[1], pl.p[2], B.CRAFT_TABLE, 4);
  const recipe = matchGrid(pl.grid.map((c) => c.id), !nearTable);
  const result = recipe && (!recipe.needsTable || nearTable)
    ? { id: recipe.out.id, n: recipe.out.n }
    : { id: 0, n: 0 };
  if (pl.socket) send(pl.socket, { t: "grid", cells: pl.grid, result });
}

const fkey = (x: number, y: number, z: number) => `${x},${y},${z}`;

// ---- edit validation ----
const lastEdit = new Map<number, number>();
const lastAttack = new Map<number, number>();
function checkRate(id: number): boolean {
  const now = Date.now();
  const prev = lastEdit.get(id) ?? 0;
  if (now - prev < 80) return false; // ~12 edits/sec cap
  lastEdit.set(id, now);
  return true;
}

function dist(a: Vec3, x: number, y: number, z: number): number {
  const dx = a[0] - (x + 0.5), dy = a[1] - (y + 0.5), dz = a[2] - (z + 0.5);
  return Math.hypot(dx, dy, dz);
}

function handleEdit(pl: Player, op: "break" | "place", x: number, y: number, z: number, block?: number, heldItem?: number): void {
  x = Math.round(x); y = Math.round(y); z = Math.round(z);
  if (!Number.isFinite(x + y + z) || y < 1 || y >= 48) return;
  if (pl.dead) return;
  if (!checkRate(pl.id)) return;
  if (dist(pl.p, x, y, z) > 7.5) {
    if (pl.socket) send(pl.socket, { t: "denied", reason: "too far" });
    return;
  }
  if (op === "break") {
    const cur = world.get(x, y, z);
    if (cur === B.AIR || cur === B.WATER) return;
    if (cur === B.BEDROCK) {
      if (pl.socket) send(pl.socket, { t: "denied", reason: "bedrock is unbreakable" });
      return;
    }
    if (HARDNESS[cur] === Infinity) return;
    world.set(x, y, z, B.AIR);
    // drop only with adequate tool
    const tier = pickTier(heldItem);
    if (tier >= requiredTier(cur) || TOOL_CLASS[cur] === "any") {
      const drop = dropFor(cur);
      if (drop) {
        const left = giveItems(pl.slots, drop.id, drop.n);
        if (left > 0) broadcast({ t: "chat", from: "server", msg: `${pl.name}'s inventory is full — lost ${BLOCK_NAME[cur]}` });
        sendInv(pl);
      }
    }
    if (world.get(x, y, z) === B.FURNACE || cur === B.FURNACE) furnaces.delete(fkey(x, y, z));
    broadcast({ t: "block", x, y, z, block: B.AIR });
  } else {
    // place
    if (block === undefined || block === B.AIR || block === B.WATER || block === B.BEDROCK) return;
    if (!Object.values(B).includes(block as 0)) return;
    const cur = world.get(x, y, z);
    if (cur !== B.AIR && cur !== B.WATER) return;
    // don't place inside yourself or the other player
    const feet: Vec3 = [x + 0.5, y + 1.0, z + 0.5];
    void feet;
    for (const other of players.all.values()) {
      if (other.dead) continue;
      const dx = Math.abs(other.p[0] - (x + 0.5));
      const dz = Math.abs(other.p[2] - (z + 0.5));
      const dyTop = other.p[1];
      const dyBot = other.p[1] - 1.8;
      if (dx < 0.75 && dz < 0.75 && y + 0.5 < dyTop && y + 0.5 > dyBot) return;
    }
    if (countOf(pl.slots, block) <= 0 && !removeItems(pl.slots, {})) {
      if (pl.socket) send(pl.socket, { t: "denied", reason: "no blocks" });
      return;
    }
    if (countOf(pl.slots, block) <= 0) return;
    removeItems(pl.slots, { [block]: 1 });
    world.set(x, y, z, block);
    sendInv(pl);
    broadcast({ t: "block", x, y, z, block });
  }
}

// ---- websocket message handling ----
function onMessage(pl: Player, raw: string): void {
  let m: ClientMsg;
  try { m = JSON.parse(raw); } catch { return; }
  switch (m.t) {
    case "reqChunk": {
      const { cx, cz } = m;
      if (!Number.isInteger(cx) || !Number.isInteger(cz) || Math.abs(cx) > 64 || Math.abs(cz) > 64) return;
      if (pl.socket) send(pl.socket, { t: "chunk", cx, cz, rle: world.chunkRLE(cx, cz) });
      break;
    }
    case "edit":
      handleEdit(pl, m.op, m.x, m.y, m.z, m.block, m.heldItem);
      break;
    case "move": {
      if (pl.dead) break;
      const [nx, ny, nz] = m.p;
      if (![nx, ny, nz, m.yaw, m.pitch].every(Number.isFinite)) break;
      const dx = nx - pl.p[0], dy = ny - pl.p[1], dz = nz - pl.p[2];
      if (Math.hypot(dx, dy, dz) > 10) break; // teleport guard
      if (ny < -40 || ny > 120) break;
      pl.p = [nx, ny, nz];
      pl.yaw = m.yaw; pl.pitch = m.pitch;
      pl.lastMove = Date.now();
      break;
    }
    case "gridPut": {
      if (pl.dead) break;
      const { slot, g, all } = m;
      if (!Number.isInteger(slot) || !Number.isInteger(g) || slot < 0 || slot >= 36 || g < 0 || g >= 9) break;
      const src = pl.slots[slot];
      if (!src.id) break;
      const dst = pl.grid[g];
      if (dst.id && dst.id !== src.id) break;
      if (dst.id && (!isStackable(src.id) || dst.n >= 64)) break;
      let n = all ? src.n : 1;
      if (dst.id) n = Math.min(n, 64 - dst.n);
      dst.id = src.id;
      dst.n += n;
      src.n -= n;
      if (src.n <= 0) { src.id = 0; src.n = 0; }
      sendInv(pl);
      sendGrid(pl);
      break;
    }
    case "gridTake": {
      if (pl.dead) break;
      const g = m.g;
      if (!Number.isInteger(g) || g < 0 || g >= 9) break;
      const cell = pl.grid[g];
      if (!cell.id) break;
      const left = giveItems(pl.slots, cell.id, cell.n);
      cell.n = left;
      if (left <= 0) { cell.id = 0; cell.n = 0; }
      sendInv(pl);
      sendGrid(pl);
      break;
    }
    case "craftTake": {
      if (pl.dead) break;
      const nearTable = world.hasBlockNear(pl.p[0], pl.p[1], pl.p[2], B.CRAFT_TABLE, 4);
      const recipe = matchGrid(pl.grid.map((c) => c.id), !nearTable);
      if (!recipe) {
        if (pl.socket) send(pl.socket, { t: "denied", reason: "no recipe matches" });
        break;
      }
      if (recipe.needsTable && !nearTable) {
        if (pl.socket) send(pl.socket, { t: "denied", reason: "need a crafting table nearby" });
        break;
      }
      if (!canFit(pl.slots, recipe.out.id, recipe.out.n)) {
        if (pl.socket) send(pl.socket, { t: "denied", reason: "inventory full" });
        break;
      }
      for (const c of pl.grid) { c.id = 0; c.n = 0; }
      giveItems(pl.slots, recipe.out.id, recipe.out.n);
      sendInv(pl);
      sendGrid(pl);
      break;
    }
    case "smelt": {
      const x = Math.round(m.x), y = Math.round(m.y), z = Math.round(m.z);
      if (world.get(x, y, z) !== B.FURNACE) break;
      const k = fkey(x, y, z);
      if (m.action === "start") {
        const ex = furnaces.get(k);
        if (ex?.active) break;
        // needs 1 iron ore block + 1 coal
        if (countOf(pl.slots, B.IRON_ORE) < 1 || countOf(pl.slots, 102) < 1) {
          if (pl.socket) send(pl.socket, { t: "denied", reason: "need 1 iron ore + 1 coal" });
          break;
        }
        removeItems(pl.slots, { [B.IRON_ORE]: 1, 102: 1 });
        furnaces.set(k, { x, y, z, progress: 0, active: true, owner: pl.id });
        sendInv(pl);
        if (pl.socket) send(pl.socket, { t: "chat", from: "server", msg: `smelting started (${SMELT_TIME}s)` });
      } else {
        const ex = furnaces.get(k);
        if (ex && !ex.active && ex.progress >= 0 && (ex as { done?: boolean }).done) {
          (ex as { done?: boolean }).done = false;
          const left = giveItems(pl.slots, 103, 1);
          if (left > 0) (ex as { done?: boolean }).done = true; // inventory full, keep it
          else { furnaces.delete(k); sendInv(pl); }
        }
      }
      break;
    }
    case "attackMob": {
      if (pl.dead) break;
      // swing rate-limit: 3 hits/sec max (stops click-spam melting mobs)
      const nowAtk = Date.now();
      if (nowAtk - (lastAttack.get(pl.id) ?? 0) < 330) break;
      lastAttack.set(pl.id, nowAtk);
      const mob = mobs.mobs.get(m.id);
      if (!mob) break;
      if (dist(pl.p, mob.p[0], mob.p[1], mob.p[2]) > 4.5) break;
      const swordMult = m.weapon !== undefined ? (SWORD_MULT[m.weapon] ?? 1) : 1;
      const dmg = (m.weapon !== undefined && m.weapon >= 108 && m.weapon <= 110 ? 2 : 1) * swordMult;
      const alive = mobs.hurt(m.id, dmg);
      if (!alive) {
        for (const d of mobDrops(mob.kind)) giveItems(pl.slots, d.id, d.n);
        sendInv(pl);
      }
      break;
    }
    case "chat": {
      const msg = m.msg.slice(0, 200);
      broadcast({ t: "chat", from: pl.name, msg });
      break;
    }
    case "eat": {
      if (players.eat(pl, m.slot)) { sendInv(pl); sendVitals(pl); }
      break;
    }
    case "fall": {
      // client-predicted landing; clamped, bypasses mob-hit cooldown
      if (pl.dead) break;
      const dmg = Math.max(0, Math.min(20, Math.floor(m.dmg)));
      if (dmg <= 0) break;
      pl.hp -= dmg;
      if (pl.hp <= 0) {
        pl.hp = 0;
        pl.dead = true;
        broadcast({ t: "chat", from: "server", msg: `☠ ${pl.name} fell` });
      }
      sendVitals(pl);
      break;
    }
    case "moveItem": {
      const { from, to } = m;
      if (Number.isInteger(from) && Number.isInteger(to) &&
          from >= 0 && from < 36 && to >= 0 && to < 36 && from !== to) {
        const t = pl.slots[from];
        pl.slots[from] = pl.slots[to];
        pl.slots[to] = t;
        sendInv(pl);
      }
      break;
    }
    case "respawn": {
      if (pl.dead) {
        players.respawn(pl, spawn);
        sendVitals(pl);
        if (pl.socket) {
          send(pl.socket, { t: "chat", from: "server", msg: "respawned" });
        }
      }
      break;
    }
  }
}

// ---- HTTP + WS server ----
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return withCors(new Response(null, { status: 204 }));

  if (url.pathname === "/ws") {
    if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return withCors(new Response("expected websocket", { status: 400 }));
    }
    const { socket, response } = Deno.upgradeWebSocket(req);
    let pl: Player | null = null;

    socket.onmessage = (ev) => {
      const data = typeof ev.data === "string" ? ev.data : "";
      // first message must be hello
      if (!pl) {
        try {
          const m = JSON.parse(data);
          if (m.t !== "hello") { socket.close(1008, "hello first"); return; }
          const name = String(m.name || "player").slice(0, 16);
          pl = players.add(name, spawn, socket);
          // restore saved inventory/pos
          const saved = savedPlayers[name];
          if (saved) {
            pl.p = saved.p;
            pl.slots = saved.slots.length === 36 ? saved.slots : pl.slots;
          }
          console.log(`[join] ${name} (id=${pl.id})`);
          send(socket, { t: "welcome", id: pl.id, seed: world.seed, spawn: pl.p, time: world.time, motd: "voxel-coop 🧱" });
          sendInv(pl);
          sendGrid(pl);
          sendVitals(pl);
          broadcast({ t: "chat", from: "server", msg: `${name} joined` }, pl.id);
        } catch { socket.close(1008, "bad hello"); }
        return;
      }
      onMessage(pl, data);
    };
    socket.onclose = () => {
      if (pl) {
        console.log(`[leave] ${pl.name}`);
        players.remove(pl.id);
        broadcast({ t: "chat", from: "server", msg: `${pl.name} left` });
        void persistPlayers();
      }
    };
    socket.onerror = () => { try { socket.close(); } catch { /* noop */ } };
    return response;
  }

  if (url.pathname === "/api/status") {
    return withCors(Response.json({
      game: "voxel-coop",
      seed: world.seed,
      time: world.time,
      players: players.all.size,
      names: [...players.all.values()].map((p) => p.name),
    }));
  }

  // static client
  const file = await serveClientFile(CLIENT_DIR, url.pathname);
  if (file) return file;
  return withCors(new Response("not found", { status: 404 }));
}

// ---- tick loops ----
let mobT = 0, slowT = 0;
setInterval(() => {
  const dt = 0.1;
  world.tick(dt);
  // mob damage callback routes to vitals
  const wrappers = [...players.all.values()].map((pl) => ({
    p: pl.p,
    hurt: (dmg: number) => {
      const before = pl.hp;
      players.hurt(pl, dmg);
      if (pl.hp !== before) sendVitals(pl);
      if (pl.dead && before > 0) {
        broadcast({ t: "chat", from: "server", msg: `☠ ${pl.name} died` });
      }
    },
  }));
  mobs.tick(dt, world, wrappers);
  if (players.tick(dt)) {
    for (const pl of players.all.values()) sendVitals(pl);
  }
  mobT += dt;
  if (mobT >= 0.5) {
    mobT = 0;
    mobs.maintain(world, players.positions(), world.isNight());
    if (mobs.mobs.size > 0 || players.all.size > 0) broadcast({ t: "mobs", list: mobs.wire() });
  }
  // players broadcast at 10Hz
  for (const pl of players.all.values()) {
    if (pl.socket && pl.socket.readyState === WebSocket.OPEN) {
      send(pl.socket, { t: "players", list: players.wire(pl.id) });
    }
  }
  // furnaces
  let furnaceChanged = false;
  for (const [k, f] of furnaces) {
    if (f.active) {
      const done = smeltTick(f, dt);
      furnaceChanged = true;
      if (done) {
        const owner = players.all.get(f.owner);
        if (owner) {
          const left = giveItems(owner.slots, 103, 1);
          sendInv(owner);
          if (owner.socket) {
            send(owner.socket, left > 0
              ? { t: "chat", from: "server", msg: "smelt done but inventory full — ingot lost" }
              : { t: "chat", from: "server", msg: "⛏ smelt complete: +1 iron ingot" });
          }
        }
        furnaces.delete(k);
      }
    }
  }
  slowT += dt;
  if (slowT >= 2 || furnaceChanged) {
    if (slowT >= 2) {
      slowT = 0;
      broadcast({ t: "time", time: world.time });
      void persistPlayers();
    }
    const states: FurnaceWire[] = [...furnaces.values()].map((f) => ({
      x: f.x, y: f.y, z: f.z, progress: f.progress / SMELT_TIME, ready: false,
    }));
    if (states.length > 0) broadcast({ t: "smeltState", states });
  }
}, 100);

Deno.addSignalListener("SIGINT", () => {
  console.log("\nsaving…");
  void Promise.all([world.save(), persistPlayers()]).then(() => Deno.exit(0));
});

console.log(`\n  🧱 voxel-coop server on :${PORT}`);
console.log(`  local:  http://localhost:${PORT}/`);
for (const ip of lanIps()) console.log(`  lan:    http://${ip}:${PORT}/`);
console.log(`  share the lan URL with player 2 — same Wi-Fi, no certs, plain http.\n`);

Deno.serve({ hostname: "0.0.0.0", port: PORT }, handler);
