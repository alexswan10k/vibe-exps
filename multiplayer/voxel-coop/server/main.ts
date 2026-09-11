// voxel-coop server: plain-HTTP LAN server (no TLS), static client + WS game loop.
// Run: deno task dev   ->   http://<lan-ip>:8000/

import { B, BLOCK_NAME, HARDNESS, TOOL_CLASS, WALK_THROUGH, ClientMsg, FurnaceWire, InvSlot, SWORD_MULT, ServerMsg, Vec3, pickTier, requiredTier } from "./protocol.ts";
import { PORT } from "./protocol.ts";
import { World } from "./world.ts";
import { Players, Player, emptyGrid, emptyInv } from "./players.ts";
import { MobSim, mobDrops } from "./mobs.ts";
import { dropFor, giveItems, removeItems, countOf, matchGrid, canFit, isStackable, craftDirect, smeltTick, smeltInputFor, smeltOutput, SMELT_TIME, FurnaceState, VILLAGER_TRADES } from "./crafting.ts";
import { lanIps, serveClientFile, withCors } from "../../shared.ts";

const CLIENT_DIR = new URL("../client", import.meta.url).pathname;
const SAVE_WORLD = new URL("../data/world.json", import.meta.url).pathname;
const SAVE_PLAYERS = new URL("../data/players.json", import.meta.url).pathname;

const world = await World.loadOrCreate(SAVE_WORLD);
const players = new Players();
const mobs = new MobSim();
mobs.peaceful = Deno.args.includes("--peaceful") || Deno.args.includes("--peace");
const furnaces = new Map<string, FurnaceState & { owner: number }>();
let spawn = world.findSpawn();

/** Unique display names: if base is taken by a live player, append _2/_3… (fits 16 chars). */
function uniqueName(raw: string): string {
  const base = raw.slice(0, 16) || "player";
  const taken = new Set([...players.all.values()].map((p) => p.name));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const suffix = `_${i}`;
    const cand = base.slice(0, 16 - suffix.length) + suffix;
    if (!taken.has(cand)) return cand;
  }
  return `${base.slice(0, 11)}_${Date.now() % 10000}`;
}

// ---- chat rate-limit: max 5 msgs / 5s per player ----
const chatTimes = new Map<number, number[]>();
function checkChatRate(id: number): boolean {
  const now = Date.now();
  const arr = chatTimes.get(id) ?? [];
  const recent = arr.filter((t) => now - t < 5000);
  if (recent.length >= 5) {
    chatTimes.set(id, recent);
    return false;
  }
  recent.push(now);
  chatTimes.set(id, recent);
  return true;
}

// ---- player persistence (pos + inventory + bed/home spawns across restarts) ----
interface SavedPlayer { name: string; p: Vec3; slots: InvSlot[]; bed?: Vec3; home?: Vec3; stats?: { kills: number; deaths: number; fished: number } }
let savedPlayers: Record<string, SavedPlayer> = {};
try {
  savedPlayers = JSON.parse(await Deno.readTextFile(SAVE_PLAYERS));
} catch { /* first run */ }
async function persistPlayers(): Promise<void> {
  try {
    const d: Record<string, SavedPlayer> = { ...savedPlayers };
    for (const pl of players.all.values()) {
      d[pl.name] = { name: pl.name, p: pl.p, slots: pl.slots, bed: pl.bedSpawn ?? undefined, home: pl.home ?? undefined, stats: { ...pl.stats } };
    }
    await Deno.mkdir(SAVE_PLAYERS.split("/").slice(0, -1).join("/"), { recursive: true });
    await Deno.writeTextFile(SAVE_PLAYERS, JSON.stringify(d));
  } catch (e) { console.error("[players] save failed:", e); }
}

function send(sock: WebSocket, msg: ServerMsg): void {
  if (sock.readyState === WebSocket.OPEN) sock.send(JSON.stringify(msg));
}
/** Route to a player via websocket or, for legacy poll clients, the outbox. */
function sendTo(pl: Player, msg: ServerMsg): void {
  if (pl.socket) {
    send(pl.socket, msg);
  } else if (pl.isPoll) {
    pl.outbox.push(msg);
    if (pl.outbox.length > 150) pl.outbox.splice(0, pl.outbox.length - 150);
  }
}
function broadcast(msg: ServerMsg, exceptId?: number): void {
  for (const pl of players.all.values()) {
    if (pl.id !== exceptId) sendTo(pl, msg);
  }
}
function sendVitals(pl: Player): void {
  sendTo(pl, { t: "vitals", hp: Math.ceil(pl.hp), maxHp: pl.maxHp, hunger: Math.floor(pl.hunger), dead: pl.dead });
}
function sendInv(pl: Player): void {
  sendTo(pl, { t: "inv", slots: pl.slots });
}
function sendGrid(pl: Player): void {
  const nearTable = world.hasBlockNear(pl.p[0], pl.p[1], pl.p[2], B.CRAFT_TABLE, 4);
  const recipe = matchGrid(pl.grid.map((c) => c.id), !nearTable);
  const result = recipe && (!recipe.needsTable || nearTable)
    ? { id: recipe.out.id, n: recipe.out.n }
    : { id: 0, n: 0 };
  sendTo(pl, { t: "grid", cells: pl.grid, result });
}

function toastAll(text: string): void {
  broadcast({ t: "toast", text });
}
function toastPl(pl: Player, text: string): void {
  sendTo(pl, { t: "toast", text });
}
/** Toast once per player (session-only). Returns true if newly unlocked. */
function unlock(pl: Player, id: string, text: string): boolean {
  if (pl.achieved.has(id)) return false;
  pl.achieved.add(id);
  toastAll(text);
  return true;
}
function sendMarkers(pl: Player): void {
  sendTo(pl, {
    t: "markers",
    spawn: [...spawn] as Vec3,
    home: pl.home ?? undefined,
    bed: pl.bedSpawn ?? undefined,
  });
}
/** Death bookkeeping shared by the main death sites (mob/fall/blast). */
function noteDeath(pl: Player, msg: string): void {
  pl.stats.deaths++;
  broadcast({ t: "chat", from: "server", msg });
  if (pl.stats.deaths === 5) toastAll(`☠ ${pl.name} has died 5 times!`);
}

/** Shared join for websocket + legacy poll transports. */
function joinGame(rawName: string, sock: WebSocket | null): Player {
  const name = uniqueName(rawName.slice(0, 16) || "player");
  const pl = players.add(name, spawn, sock);
  const saved = savedPlayers[name];
  if (saved) {
    // stale underground logout (cave, or a world that moved on without you)
    // wakes up on the surface — unless it's your own dug-out base nearby.
    // inventory and bed are still restored.
    if (Array.isArray(saved.p) && saved.p.length === 3 && saved.p.every(Number.isFinite) &&
        world.shouldRescueToSurface(saved.p[0], saved.p[1], saved.p[2])) {
      console.log(`[join] ${name} saved spot was underground — fresh spawn`);
      sendTo(pl, { t: "chat", from: "server", msg: "☀ your last spot was underground — woke up on the surface" });
    } else {
      pl.p = saved.p;
    }
    pl.slots = saved.slots.length === 36 ? saved.slots : pl.slots;
    if (Array.isArray(saved.bed) && saved.bed.length === 3 && saved.bed.every(Number.isFinite)) {
      pl.bedSpawn = saved.bed as Vec3;
    }
    if (Array.isArray(saved.home) && saved.home.length === 3 && saved.home.every(Number.isFinite)) {
      pl.home = saved.home as Vec3;
    }
    if (saved.stats && Number.isFinite(saved.stats.kills) && Number.isFinite(saved.stats.deaths) && Number.isFinite(saved.stats.fished)) {
      pl.stats = { kills: saved.stats.kills, deaths: saved.stats.deaths, fished: saved.stats.fished };
    }
  }
  console.log(`[join] ${name} (id=${pl.id}${sock ? "" : " poll"})`);
  sendInv(pl);
  sendGrid(pl);
  sendVitals(pl);
  sendMarkers(pl);
  broadcast({ t: "chat", from: "server", msg: `${name} joined` }, pl.id);
  return pl;
}

function leaveGame(pl: Player): void {
  console.log(`[leave] ${pl.name}`);
  players.remove(pl.id);
  chatTimes.delete(pl.id);
  fishCd.delete(pl.id);
  pendingReset.delete(pl.id);
  broadcast({ t: "chat", from: "server", msg: `${pl.name} left` });
  void persistPlayers();
}

const fkey = (x: number, y: number, z: number) => `${x},${y},${z}`;

// ---- weather: rolling rain storms (clients read `rain` off the time tick) ----
let rain = 0; // 0..1 intensity
let rainTarget = 0;
let rainT = 20 + Math.random() * 30; // seconds until next shift
function tickRain(dt: number): boolean {
  rainT -= dt;
  if (rainT <= 0) {
    // storm every ~4-7 min, lasting 45-90s; otherwise a dry spell
    if (rainTarget < 0.5 && Math.random() < 0.45) {
      rainTarget = 1;
      rainT = 45 + Math.random() * 45;
      broadcast({ t: "chat", from: "server", msg: "🌧 a storm rolls in — undead walk in the gloom…" });
    } else {
      rainTarget = 0;
      rainT = 150 + Math.random() * 180;
      if (rain > 0.5) broadcast({ t: "chat", from: "server", msg: "☀ the storm passes" });
    }
  }
  const before = rain;
  rain += Math.sign(rainTarget - rain) * Math.min(Math.abs(rainTarget - rain), dt / 8);
  return Math.abs(rain - before) > 0.001;
}

// ---- TNT: lit fuses + authoritative explosions ----
interface Fuse { x: number; y: number; z: number; at: number; by: string }
const fuses: Fuse[] = [];
// ---- fishing: pending catches resolve in the tick loop ----
interface PendingFish { plId: number; at: number }
const pendingFish: PendingFish[] = [];
const fishCd = new Map<number, number>();
// Villager trade table lives in crafting.ts (single source of truth).
const TRADES: { give: { id: number; n: number }; get: { id: number; n: number } }[] = VILLAGER_TRADES;
const BLAST_R = 5;
const BLAST_IMMUNE = new Set<number>([B.BEDROCK, B.OBSIDIAN, B.WATER]);

function explode(x: number, y: number, z: number, by: string): void {
  const r = BLAST_R;
  const chain: Fuse[] = [];
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d > r) continue;
        const bx = x + dx, byy = y + dy, bz = z + dz;
        if (byy < 1 || byy >= 48) continue;
        const cur = world.get(bx, byy, bz);
        if (cur === B.AIR || BLAST_IMMUNE.has(cur)) continue;
        // falloff: rim blocks survive more often (jagged crater, not a sphere)
        if (d > 2 && Math.random() < (d - 2) / r * 0.6) continue;
        if (cur === B.TNT) {
          world.set(bx, byy, bz, B.AIR);
          broadcast({ t: "block", x: bx, y: byy, z: bz, block: B.AIR });
          chain.push({ x: bx, y: byy, z: bz, at: Date.now() + 400 + Math.random() * 300, by });
          continue;
        }
        if (cur === B.FURNACE) furnaces.delete(fkey(bx, byy, bz));
        world.set(bx, byy, bz, B.AIR);
        broadcast({ t: "block", x: bx, y: byy, z: bz, block: B.AIR });
      }
    }
  }
  for (const c of chain) fuses.push(c);
  // hurt players with falloff (obisidian shelters work — immune blocks stay)
  for (const pl of players.all.values()) {
    if (pl.dead) continue;
    const d = Math.hypot(pl.p[0] - (x + 0.5), pl.p[1] - (y + 0.5), pl.p[2] - (z + 0.5));
    if (d < 8) {
      const dmg = Math.max(1, Math.round(24 * (1 - d / 8)));
      const before = pl.hp;
      players.hurt(pl, dmg);
      sendVitals(pl);
      if (pl.dead && before > 0) noteDeath(pl, `💥 ${pl.name} was blown up${by ? ` by ${by}` : ""}`);
    }
  }
  // shred mobs near the blast
  for (const m of [...mobs.mobs.values()]) {
    const d = Math.hypot(m.p[0] - (x + 0.5), m.p[1] - (y + 0.5), m.p[2] - (z + 0.5));
    if (d < 7) {
      const alive = mobs.hurt(m.id, Math.round(40 * (1 - d / 7)));
      if (!alive) broadcast({ t: "chat", from: "server", msg: `💥 ${by || "someone"} blew up a ${m.kind}` });
      else broadcast({ t: "mobHit", id: m.id });
    }
  }
  broadcast({ t: "boom", x, y, z, r });
  console.log(`[boom] at ${x},${y},${z} by ${by}`);
}

function tickFuses(): void {
  if (fuses.length === 0) return;
  const now = Date.now();
  for (let i = fuses.length - 1; i >= 0; i--) {
    if (fuses[i].at <= now) {
      const f = fuses.splice(i, 1)[0];
      explode(f.x, f.y, f.z, f.by);
    }
  }
}

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
    sendTo(pl, { t: "denied", reason: "too far" });
    return;
  }
  if (op === "break") {
    const cur = world.get(x, y, z);
    if (cur === B.AIR || cur === B.WATER) return;
    if (cur === B.BEDROCK) {
      sendTo(pl, { t: "denied", reason: "bedrock is unbreakable" });
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
    if (cur === B.DIAMOND_ORE && (tier >= requiredTier(cur) || TOOL_CLASS[cur] === "any")) {
      unlock(pl, "diamond", `💎 ${pl.name} mined diamond!`);
    }
  } else {
    // place
    if (block === undefined || block === B.AIR || block === B.WATER || block === B.BEDROCK || block === B.LAVA) return;
    if (!(Object.values(B) as number[]).includes(block)) return;
    const cur = world.get(x, y, z);
    // walk-through flora doesn't block placement — it gets replaced
    if (cur !== B.AIR && cur !== B.WATER && !WALK_THROUGH.has(cur)) return;
    // don't place inside any live player (feet..head box)
    for (const other of players.all.values()) {
      if (other.dead) continue;
      const dx = Math.abs(other.p[0] - (x + 0.5));
      const dz = Math.abs(other.p[2] - (z + 0.5));
      if (dx < 0.75 && dz < 0.75 && y + 0.5 < other.p[1] && y + 0.5 > other.p[1] - 1.8) return;
    }
    // don't place inside mobs either
    for (const mob of mobs.mobs.values()) {
      const dx = Math.abs(mob.p[0] - (x + 0.5));
      const dz = Math.abs(mob.p[2] - (z + 0.5));
      if (dx < 0.8 && dz < 0.8 && y + 0.5 < mob.p[1] + 0.6 && y + 0.5 > mob.p[1] - 1.2) return;
    }
    if (countOf(pl.slots, block) <= 0) {
      sendTo(pl, { t: "denied", reason: "none of those in inventory" });
      return;
    }
    removeItems(pl.slots, { [block]: 1 });
    world.set(x, y, z, block);
    sendInv(pl);
    broadcast({ t: "block", x, y, z, block });
  }
}

// ---- chat commands (/help /players /spawn /time /reset) ----
function sendPlayersSnapshot(): void {
  for (const q of players.all.values()) {
    sendTo(q, { t: "players", list: players.wire(q.id) });
  }
}

/** Fresh world, fresh players: new seed, no edits/mobs/furnaces, everyone
 *  teleported to the new spawn with starter inventory. savedPlayers is wiped
 *  so offline players rejoin fresh too (no spawning inside new terrain). */
function doReset(requestedSeed: number | null, by: string): void {
  const seed = requestedSeed ?? Math.floor(Math.random() * 1e9);
  world.resetWorld(seed);
  furnaces.clear();
  fuses.length = 0;
  pendingFish.length = 0;
  mobs.mobs.clear();
  spawn = world.findSpawn();
  savedPlayers = {};
  void persistPlayers();
  for (const pl of players.all.values()) {
    pl.p = [...spawn] as Vec3;
    pl.slots = emptyInv();
    giveItems(pl.slots, 15, 8); // starter torches, same as fresh join
    pl.grid = emptyGrid();
    pl.hp = pl.maxHp;
    pl.hunger = 20;
    pl.dead = false;
    pl.bedSpawn = null;
    pl.home = null;
    pl.stats = { kills: 0, deaths: 0, fished: 0 };
    pl.achieved.clear();
    pl.lastMove = Date.now();
    sendTo(pl, { t: "reset", seed, spawn: [...spawn] as Vec3 });
    sendInv(pl);
    sendGrid(pl);
    sendVitals(pl);
    sendMarkers(pl);
  }
  sendPlayersSnapshot();
  broadcast({ t: "time", time: world.time, rain });
  broadcast({ t: "chat", from: "server", msg: `🌍 ${by} reset the world (seed ${seed})` });
  console.log(`[reset] by ${by}, seed=${seed}`);
}

// /reset needs a confirm (no take-backs): first call stages, second runs.
const pendingReset = new Map<number, { seed: number | null; at: number }>();

/** Returns true if msg was a slash command (handled, not broadcast). */
function handleChatCommand(pl: Player, msg: string): boolean {
  if (!msg.startsWith("/")) return false;
  const parts = msg.slice(1).trim().split(/\s+/);
  const cmd = (parts[0] ?? "").toLowerCase();
  const arg = parts.slice(1).join(" ").trim();
  switch (cmd) {
    case "help":
      sendTo(pl, { t: "chat", from: "server", msg: "commands: /help /players /spawn /sethome /home /rain /stats /time <0..1|day|night|morning> /reset [seed]" });
      return true;
    case "players": {
      const names = [...players.all.values()].map((p) => p.name);
      sendTo(pl, { t: "chat", from: "server", msg: `online (${names.length}): ${names.join(", ")}` });
      return true;
    }
    case "spawn":
      pl.p = [...spawn] as Vec3;
      pl.lastMove = Date.now();
      sendPlayersSnapshot();
      sendMarkers(pl);
      sendTo(pl, { t: "chat", from: "server", msg: "teleported to spawn" });
      return true;
    case "sethome":
      pl.home = [pl.p[0], pl.p[1], pl.p[2]];
      void persistPlayers();
      sendMarkers(pl);
      sendTo(pl, { t: "chat", from: "server", msg: "🏠 home set — /home to return" });
      return true;
    case "home": {
      if (!pl.home) {
        sendTo(pl, { t: "chat", from: "server", msg: "no home yet — stand somewhere nice and type /sethome" });
        return true;
      }
      pl.p = [...pl.home] as Vec3;
      pl.lastMove = Date.now();
      sendPlayersSnapshot();
      sendTo(pl, { t: "chat", from: "server", msg: "🏠 teleported home" });
      return true;
    }
    case "rain": {
      rainTarget = rainTarget > 0.5 ? 0 : 1;
      rainT = rainTarget > 0.5 ? 60 : 200;
      broadcast({ t: "chat", from: "server", msg: `${pl.name} ${rainTarget > 0.5 ? "summoned a storm 🌧" : "cleared the skies ☀"}` });
      return true;
    }
    case "stats":
      sendTo(pl, { t: "chat", from: "server", msg: `kills ${pl.stats.kills} · deaths ${pl.stats.deaths} · fished ${pl.stats.fished}` });
      return true;
    case "time": {
      let v: number | null = null;
      const a = arg.toLowerCase();
      if (a === "day") v = 0.3;
      else if (a === "morning") v = 0.25;
      else if (a === "night") v = 0.8;
      else if (a !== "") {
        const n = Number(a);
        if (Number.isFinite(n) && n >= 0 && n <= 1) v = n;
      }
      if (v === null) {
        sendTo(pl, { t: "chat", from: "server", msg: "usage: /time <0..1|day|night|morning>" });
        return true;
      }
      world.time = v;
      broadcast({ t: "time", time: world.time, rain });
      broadcast({ t: "chat", from: "server", msg: `${pl.name} set time to ${v}` });
      return true;
    }
    case "reset": {
      const a = arg.toLowerCase();
      const pending = pendingReset.get(pl.id);
      const fresh = !pending || Date.now() - pending.at > 30000;
      if ((a === "yes" || a === "confirm") && pending && !fresh) {
        pendingReset.delete(pl.id);
        doReset(pending.seed, pl.name);
        return true;
      }
      let seed: number | null = null;
      if (a !== "" && a !== "yes" && a !== "confirm") {
        const n = Number(a);
        if (!Number.isInteger(n) || n < 0 || n >= 2 ** 31) {
          sendTo(pl, { t: "chat", from: "server", msg: "usage: /reset [seed 0..2147483647] — then /reset yes to confirm" });
          return true;
        }
        seed = n;
      }
      pendingReset.set(pl.id, { seed, at: Date.now() });
      sendTo(pl, {
        t: "chat",
        from: "server",
        msg: `⚠ reset the world${seed !== null ? ` with seed ${seed}` : " with a random seed"}? EVERYTHING (terrain, builds, inventories) is wiped. Type /reset yes within 30s.`,
      });
      return true;
    }
    default:
      sendTo(pl, { t: "chat", from: "server", msg: `unknown command: /${cmd} (try /help)` });
      return true;
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
      sendTo(pl, { t: "chunk", cx, cz, rle: world.chunkRLE(cx, cz) });
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
        sendTo(pl, { t: "denied", reason: "no recipe matches" });
        break;
      }
      if (recipe.needsTable && !nearTable) {
        sendTo(pl, { t: "denied", reason: "need a crafting table nearby" });
        break;
      }
      if (!canFit(pl.slots, recipe.out.id, recipe.out.n)) {
        sendTo(pl, { t: "denied", reason: "inventory full" });
        break;
      }
      for (const c of pl.grid) { c.id = 0; c.n = 0; }
      giveItems(pl.slots, recipe.out.id, recipe.out.n);
      if (recipe.out.id === B.TNT) unlock(pl, "demolitionist", `🧨 ${pl.name} is a Demolitionist!`);
      sendInv(pl);
      sendGrid(pl);
      break;
    }
    case "craftDirect": {
      if (pl.dead) break;
      const nearTable = world.hasBlockNear(pl.p[0], pl.p[1], pl.p[2], B.CRAFT_TABLE, 4);
      const res = craftDirect(pl.slots, String(m.id ?? ""), Math.floor(m.n ?? 1) || 1, nearTable);
      if (!res.ok) {
        sendTo(pl, { t: "denied", reason: res.reason ?? "can't craft that" });
        break;
      }
      if (res.ok && String(m.id ?? "") === "tnt") unlock(pl, "demolitionist", `🧨 ${pl.name} is a Demolitionist!`);
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
        // pick the first smeltable input the player can afford (pork > sand > iron)
        const cands = [104, 134, 132, B.SAND, B.CLAY, B.IRON_ORE, B.GOLD_ORE];
        let input = -1;
        for (const c of cands) {
          const r = smeltInputFor(c);
          if (r && countOf(pl.slots, c) >= 1 && countOf(pl.slots, 102) >= 1) { input = c; break; }
        }
        if (input < 0) {
          sendTo(pl, { t: "denied", reason: "need iron ore, sand, or raw pork + coal" });
          break;
        }
        const recipe = smeltInputFor(input)!;
        removeItems(pl.slots, recipe.in);
        furnaces.set(k, { x, y, z, progress: 0, active: true, owner: pl.id, input });
        sendInv(pl);
        sendTo(pl, { t: "chat", from: "server", msg: `smelting started (${SMELT_TIME}s)` });
      } else {
        const ex = furnaces.get(k);
        if (ex && !ex.active && ex.progress >= 0 && (ex as { done?: boolean }).done) {
          (ex as { done?: boolean }).done = false;
          const out = smeltOutput(ex.input ?? B.IRON_ORE) ?? { id: 103, n: 1 };
          const left = giveItems(pl.slots, out.id, out.n);
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
      // tamed wolves are off-limits to everyone but their owner (mobs agent
      // reads (pl as {name?:string}).name; owner stored as player name string)
      const mobOwner = (mob as { owner?: unknown }).owner;
      if (typeof mobOwner === "string" && mobOwner && mobOwner !== pl.name) {
        sendTo(pl, { t: "denied", reason: `that's ${mobOwner}'s wolf!` });
        break;
      }
      const swordMult = m.weapon !== undefined ? (SWORD_MULT[m.weapon] ?? 1) : 1;
      const isPick = m.weapon !== undefined && m.weapon >= 108 && m.weapon <= 110;
      const dmg = (m.weapon === undefined ? 2 : isPick ? 2 : 1) * swordMult;
      // small knockback away from the player (big shoves knock mobs out of
      // reach and make melee miserable)
      const kx = mob.p[0] - pl.p[0], kz = mob.p[2] - pl.p[2];
      const kl = Math.hypot(kx, kz) || 1;
      mob.p[0] += (kx / kl) * 0.45;
      mob.p[2] += (kz / kl) * 1.1;
      broadcast({ t: "mobHit", id: mob.id });
      const alive = mobs.hurt(mob.id, dmg);
      if (!alive) {
        for (const d of mobDrops(mob.kind)) giveItems(pl.slots, d.id, d.n);
        sendInv(pl);
        pl.stats.kills++;
        if (mob.kind === "ogre") unlock(pl, "ogre", `👹 ${pl.name} slew an OGRE!`);
      }
      break;
    }
    case "ignite": {
      // F on a placed TNT block: pull it out of the world, light a 2.5s fuse
      if (pl.dead) break;
      const x = Math.round(m.x), y = Math.round(m.y), z = Math.round(m.z);
      if (![x, y, z].every(Number.isFinite) || y < 1 || y >= 48) break;
      if (dist(pl.p, x, y, z) > 7.5) {
        sendTo(pl, { t: "denied", reason: "too far" });
        break;
      }
      if (world.get(x, y, z) !== B.TNT) break;
      if (fuses.some((f) => f.x === x && f.y === y && f.z === z)) break;
      world.set(x, y, z, B.AIR);
      broadcast({ t: "block", x, y, z, block: B.AIR });
      fuses.push({ x, y, z, at: Date.now() + 2500, by: pl.name });
      broadcast({ t: "chat", from: "server", msg: `🧨 ${pl.name} lit TNT — RUN!` });
      break;
    }
    case "fish": {
      if (pl.dead) break;
      const nowFish = Date.now();
      if (nowFish - (fishCd.get(pl.id) ?? 0) < 3000) {
        sendTo(pl, { t: "denied", reason: "fishing… wait a bit" });
        break;
      }
      if (countOf(pl.slots, 141) < 1) {
        sendTo(pl, { t: "denied", reason: "need a fishing rod" });
        break;
      }
      if (!world.hasBlockNear(pl.p[0], pl.p[1], pl.p[2], B.WATER, 5)) {
        sendTo(pl, { t: "denied", reason: "need water nearby" });
        break;
      }
      fishCd.set(pl.id, nowFish);
      pendingFish.push({ plId: pl.id, at: nowFish + 4000 + Math.random() * 4000 });
      sendTo(pl, { t: "chat", from: "server", msg: "🎣 line cast… wait for a bite" });
      break;
    }
    case "tame": {
      if (pl.dead) break;
      const mob = mobs.mobs.get(m.id);
      if (!mob) {
        sendTo(pl, { t: "denied", reason: "no such mob" });
        break;
      }
      // defensive: wolf kind may not exist yet on the mobs side
      if ((mob.kind as string) !== "wolf") {
        sendTo(pl, { t: "denied", reason: "you can only tame wolves" });
        break;
      }
      if (dist(pl.p, mob.p[0], mob.p[1], mob.p[2]) > 4.5) {
        sendTo(pl, { t: "denied", reason: "too far" });
        break;
      }
      if (countOf(pl.slots, 137) < 1) {
        sendTo(pl, { t: "denied", reason: "need a bone" });
        break;
      }
      removeItems(pl.slots, { 137: 1 });
      (mob as { owner?: string }).owner = pl.name;
      sendInv(pl);
      broadcast({ t: "chat", from: "server", msg: `🐺 ${pl.name} tamed a wolf!` });
      toastAll(`🐺 ${pl.name} tamed a wolf!`);
      break;
    }
    case "askTrade": {
      if (pl.dead) break;
      const mob = mobs.mobs.get(m.id);
      if (!mob) {
        sendTo(pl, { t: "denied", reason: "no such mob" });
        break;
      }
      if ((mob.kind as string) !== "villager") {
        sendTo(pl, { t: "denied", reason: "they don't want to trade" });
        break;
      }
      if (dist(pl.p, mob.p[0], mob.p[1], mob.p[2]) > 5) {
        sendTo(pl, { t: "denied", reason: "too far" });
        break;
      }
      sendTo(pl, {
        t: "tradeOffers",
        id: mob.id,
        offers: TRADES.map((o) => ({
          give: { id: o.give.id, n: o.give.n },
          get: { id: o.get.id, n: o.get.n },
        })),
      });
      break;
    }
    case "trade": {
      if (pl.dead) break;
      const mob = mobs.mobs.get(m.id);
      if (!mob || (mob.kind as string) !== "villager") {
        sendTo(pl, { t: "denied", reason: "they don't want to trade" });
        break;
      }
      if (dist(pl.p, mob.p[0], mob.p[1], mob.p[2]) > 5) {
        sendTo(pl, { t: "denied", reason: "too far" });
        break;
      }
      const offer = TRADES[m.slot];
      if (!offer) {
        sendTo(pl, { t: "denied", reason: "bad trade" });
        break;
      }
      if (countOf(pl.slots, offer.give.id) < offer.give.n) {
        sendTo(pl, { t: "denied", reason: "can't afford that" });
        break;
      }
      removeItems(pl.slots, { [offer.give.id]: offer.give.n });
      giveItems(pl.slots, offer.get.id, offer.get.n);
      sendInv(pl);
      break;
    }
    case "chat": {
      if (!checkChatRate(pl.id)) {
        sendTo(pl, { t: "denied", reason: "chat too fast" });
        break;
      }
      const msg = m.msg.slice(0, 200);
      if (handleChatCommand(pl, msg)) break;
      broadcast({ t: "chat", from: pl.name, msg });
      break;
    }
    case "pong":
      // heartbeat reply (see ClientMsg augmentation note at top): keep WS alive.
      pl.lastMove = Date.now();
      break;
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
        noteDeath(pl, `☠ ${pl.name} fell`);
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
        // bed gone? fall back to world spawn instead of stranding the player
        if (pl.bedSpawn && world.get(pl.bedSpawn[0], pl.bedSpawn[1] - 2, pl.bedSpawn[2]) !== B.BED &&
            world.get(pl.bedSpawn[0], pl.bedSpawn[1] - 1, pl.bedSpawn[2]) !== B.BED) {
          pl.bedSpawn = null;
        }
        players.respawn(pl, spawn);
        sendVitals(pl);
        sendTo(pl, { t: "chat", from: "server", msg: pl.bedSpawn ? "respawned at your bed" : "respawned" });
      }
      break;
    }
    case "setBed": {
      if (pl.dead) break;
      const x = Math.round(m.x), y = Math.round(m.y), z = Math.round(m.z);
      if (![x, y, z].every(Number.isFinite) || y < 1 || y >= 48) break;
      if (world.get(x, y, z) !== B.BED) {
        sendTo(pl, { t: "denied", reason: "no bed there" });
        break;
      }
      if (dist(pl.p, x, y, z) > 7.5) {
        sendTo(pl, { t: "denied", reason: "too far" });
        break;
      }
      pl.bedSpawn = [x + 0.5, y + 2.5, z + 0.5];
      void persistPlayers();
      sendMarkers(pl);
      sendTo(pl, { t: "chat", from: "server", msg: "🛏 spawn set — you'll wake up here" });
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
          pl = joinGame(String(m.name || "player"), socket);
          send(socket, { t: "welcome", id: pl.id, seed: world.seed, spawn: pl.p, time: world.time, rain, motd: "voxel-coop 🧱" });
        } catch { socket.close(1008, "bad hello"); }
        return;
      }
      onMessage(pl, data);
    };
    socket.onclose = () => {
      if (pl) leaveGame(pl);
    };
    socket.onerror = () => { try { socket.close(); } catch { /* noop */ } };
    return response;
  }

  if (url.pathname === "/api/status") {
    return withCors(Response.json({
      game: "voxel-coop",
      mode: mobs.peaceful ? "peaceful" : "survival",
      seed: world.seed,
      time: world.time,
      rain,
      players: players.all.size,
      names: [...players.all.values()].map((p) => p.name),
    }));
  }

  // legacy transport for devices without working websockets (old iPads):
  // POST /api/join {name} -> welcome; POST /api/poll {id, msgs} -> {msgs}
  if (url.pathname === "/api/join" && req.method === "POST") {
    let body: { name?: unknown };
    try { body = await req.json(); } catch { return withCors(new Response("bad json", { status: 400 })); }
    const pl = joinGame(String(body.name || "player"), null);
    return withCors(Response.json({
      t: "welcome", id: pl.id, seed: world.seed, spawn: pl.p,
      time: world.time, rain, motd: "voxel-coop 🧱 (poll mode)",
    }));
  }
  if (url.pathname === "/api/poll" && req.method === "POST") {
    let body: { id?: unknown; msgs?: unknown };
    try { body = await req.json(); } catch { return withCors(new Response("bad json", { status: 400 })); }
    const pl = players.all.get(Number(body.id));
    if (!pl || !pl.isPoll) return withCors(new Response("no session", { status: 404 }));
    pl.lastPoll = Date.now();
    if (Array.isArray(body.msgs)) {
      for (const m of body.msgs.slice(0, 50)) {
        try { onMessage(pl, JSON.stringify(m)); } catch { /* skip bad msg */ }
      }
    }
    const out = pl.outbox.splice(0, 100);
    return withCors(Response.json({ msgs: out }));
  }

  // static client
  const file = await serveClientFile(CLIENT_DIR, url.pathname);
  if (file) return file;
  return withCors(new Response("not found", { status: 404 }));
}

// ---- tick loops ----
// WS heartbeat: clients auto-reply {t:"pong"} which bumps pl.lastMove.
setInterval(() => {
  if (players.all.size === 0) return;
  broadcast({ t: "ping", now: Date.now() });
}, 15000);

let mobT = 0, slowT = 0;
setInterval(() => {
  const dt = 0.1;
  world.tick(dt);
  if (tickRain(dt)) mobs.rain = rain; else mobs.rain = rain;
  tickFuses();
  // mob damage callback routes to vitals (name included so tamed wolves can
  // follow owners — mobs side reads (pl as {name?:string}).name defensively)
  const wrappers = [...players.all.values()].map((pl) => ({
    p: pl.p,
    name: pl.name,
    hurt: (dmg: number) => {
      const before = pl.hp;
      players.hurt(pl, dmg);
      if (pl.hp !== before) sendVitals(pl);
      if (pl.dead && before > 0) {
        noteDeath(pl, `☠ ${pl.name} died`);
      }
    },
  }));
  mobs.tick(dt, world, wrappers, world.isNight());
  if (players.tick(dt, mobs.peaceful)) {
    for (const pl of players.all.values()) sendVitals(pl);
  }
  // lava burns: feet block or head block is LAVA (hurt() 0.6s cd gates dps)
  for (const pl of players.all.values()) {
    if (pl.dead) continue;
    const fx = Math.floor(pl.p[0]), fz = Math.floor(pl.p[2]);
    const fy = Math.floor(pl.p[1] - 1.5); // pl.p is eye height; feet + head
    if (world.get(fx, fy, fz) === B.LAVA || world.get(fx, fy + 1, fz) === B.LAVA) {
      const before = pl.hp;
      players.hurt(pl, 2);
      if (pl.hp !== before) sendVitals(pl);
      if (pl.dead && before > 0) noteDeath(pl, `🔥 ${pl.name} swam in lava`);
    }
  }
  // fishing catches resolve here
  if (pendingFish.length > 0) {
    const nowF = Date.now();
    for (let i = pendingFish.length - 1; i >= 0; i--) {
      if (pendingFish[i].at > nowF) continue;
      const pf = pendingFish.splice(i, 1)[0];
      const pl = players.all.get(pf.plId);
      if (!pl || pl.dead) continue;
      const roll = Math.random() * 100;
      let id = 142, n = 1;
      if (roll < 62) { id = 142; n = 1 + Math.floor(Math.random() * 2); }
      else if (roll < 70) { id = 138; n = 1; }
      else if (roll < 76) { id = 137; n = 1; }
      else if (roll < 81) { id = 144; n = 1; }
      else if (roll < 85) { id = 123; n = 1; }
      else if (roll < 92.5) { id = 101; n = 1; }
      else { id = 106; n = 1; }
      giveItems(pl.slots, id, n);
      sendInv(pl);
      pl.stats.fished++;
      const label = BLOCK_NAME[id] ?? ({ 101: "stick", 106: "feather" } as Record<number, string>)[id] ?? `item ${id}`;
      if (pl.stats.fished === 1) toastAll(`🎣 ${pl.name} caught their first fish!`);
      toastPl(pl, `🎣 caught ${label}${n > 1 ? ` x${n}` : ""}`);
    }
  }
  mobT += dt;
  if (mobT >= 0.5) {
    mobT = 0;
    mobs.maintain(world, players.positions(), world.isNight());
    if (mobs.mobs.size > 0 || players.all.size > 0) broadcast({ t: "mobs", list: mobs.wire() });
  }
  // players broadcast at 10Hz
  for (const pl of players.all.values()) {
    sendTo(pl, { t: "players", list: players.wire(pl.id) });
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
          const out = smeltOutput(f.input ?? B.IRON_ORE) ?? { id: 103, n: 1 };
          const left = giveItems(owner.slots, out.id, out.n);
          sendInv(owner);
          if (owner.socket) {
            send(owner.socket, left > 0
              ? { t: "chat", from: "server", msg: "smelt done but inventory full — item lost" }
              : { t: "chat", from: "server", msg: `⛏ smelt complete: +${out.n} ${BLOCK_NAME[out.id] ?? out.id}` });
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
      broadcast({ t: "time", time: world.time, rain });
      void persistPlayers();
      // evict legacy poll clients that stopped polling
      const now = Date.now();
      for (const pl of [...players.all.values()]) {
        if (pl.isPoll && now - pl.lastPoll > 15000) leaveGame(pl);
      }
      // stale WS watch: log sockets with no move/pong for 60s (no close —
      // close/evict stays with the poll path + socket onclose above).
      for (const pl of [...players.all.values()]) {
        if (!pl.isPoll && now - pl.lastMove > 60000) {
          console.log(`[stale] ${pl.name} (id=${pl.id}) idle ${Math.round((now - pl.lastMove) / 1000)}s — no move/pong`);
        }
      }
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

console.log(`\n  🧱 voxel-coop server on :${PORT}${mobs.peaceful ? "  [PEACEFUL — no hostiles, no hunger]" : ""}`);
console.log(`  local:  http://localhost:${PORT}/`);
for (const ip of lanIps()) console.log(`  lan:    http://${ip}:${PORT}/`);
console.log(`  share the lan URL with player 2 — same Wi-Fi, no certs, plain http.\n`);

Deno.serve({ hostname: "0.0.0.0", port: PORT }, handler);
