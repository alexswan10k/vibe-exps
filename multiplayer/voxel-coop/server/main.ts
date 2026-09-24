// voxel-coop server: plain-HTTP LAN server (no TLS), static client + WS game loop.
// Run: deno task dev   ->   http://<lan-ip>:8000/

import { B, BLOCK_NAME, HARDNESS, PICK_MULT, TOOL_CLASS, WALK_THROUGH, ClientMsg, FurnaceWire, InvSlot, SWORD_MULT, ServerMsg, Vec3, pickTier, requiredTier } from "./protocol.ts";
import { PORT, WORLD_H } from "./protocol.ts";
import { World } from "./world.ts";
import { Players, Player, emptyGrid, emptyInv } from "./players.ts";
import { MobSim, mobDrops } from "./mobs.ts";
import { dungeonSpawns, structureChests, lootFor, structureCenters, villageCenters } from "./structures.ts";
import { dropFor, giveItems, removeItems, countOf, matchGrid, canFit, isStackable, craftDirect, smeltTick, smeltInputFor, smeltOutput, SMELT_TIME, FurnaceState, VILLAGER_TRADES, ENGINE_FUEL } from "./crafting.ts";
import { Machines, mkey, LAVA_BURN_S, BUCKET_MB, TANK_CAP } from "./machines.ts";
import { VehicleSim } from "./vehicles.ts";
import { lanIps, serveClientFile, withCors } from "../../shared.ts";

const CLIENT_DIR = new URL("../client", import.meta.url).pathname;
const SAVE_WORLD = new URL("../data/world.json", import.meta.url).pathname;
const SAVE_PLAYERS = new URL("../data/players.json", import.meta.url).pathname;
const SAVE_MACHINES = new URL("../data/machines.json", import.meta.url).pathname;
const SAVE_VEHICLES = new URL("../data/vehicles.json", import.meta.url).pathname;

const world = await World.loadOrCreate(SAVE_WORLD);
const players = new Players();
const machines = await Machines.loadOrCreate(SAVE_MACHINES);
const vehicles = await VehicleSim.loadOrCreate(SAVE_VEHICLES);
const START_CREATIVE = Deno.args.includes("--creative");
const mobs = new MobSim();
mobs.peaceful = Deno.args.includes("--peaceful") || Deno.args.includes("--peace");
const furnaces = new Map<string, FurnaceState & { owner: number }>();
let spawn = world.findSpawn();

/**
 * Worldgen loot: structureChests() positions for this seed, kind by pos.
 * Seeded at boot / on reset; chests opened far from the settled area (or
 * before a seed pass) fill lazily on open. claimLoot makes every deal
 * one-time: looted stays looted, player rebuilds never refill.
 */
let lootKindByPos = new Map<string, string>();
function lootSalt(x: number, y: number, z: number): number {
  return ((x * 374761393 + z * 2246822519) ^ Math.imul(y, 668265263)) | 0;
}
function fillLootChest(x: number, y: number, z: number, kind: string): void {
  const c = machines.ensureChest(x, y, z);
  for (const s of lootFor(kind, lootSalt(x, y, z))) {
    Machines.chestGive(c, s.id, s.n);
  }
}
function seedStructureLoot(): void {
  lootKindByPos = new Map();
  for (const s of structureChests(world.seed)) {
    const k = mkey(s.x, s.y, s.z);
    lootKindByPos.set(k, s.kind);
    if (world.get(s.x, s.y, s.z) === B.CHEST && machines.claimLoot(s.x, s.y, s.z)) {
      fillLootChest(s.x, s.y, s.z, s.kind);
    }
  }
  console.log(`[loot] ${lootKindByPos.size} worldgen chests for seed ${world.seed}`);
}
seedStructureLoot();

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

/** Release any vehicle the player is riding (death, logout, respawn). */
function freeRide(pl: Player): void {
  const v = vehicles.byRider(pl.id);
  if (v) {
    v.rider = 0;
    sendTo(pl, { t: "ride", id: 0 });
  }
}

/** Shared join for websocket + legacy poll transports. */
function joinGame(rawName: string, sock: WebSocket | null): Player {
  const name = uniqueName(rawName.slice(0, 16) || "player");
  const pl = players.add(name, spawn, sock);
  if (START_CREATIVE && !pl.creative) {
    pl.creative = true;
    queueMicrotask(() => {
      sendTo(pl, { t: "gamemode", creative: true });
      sendTo(pl, { t: "chat", from: "server", msg: "✨ server started creative-first — F fly · C blocks · X bow" });
    });
  }
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
  freeRide(pl);
  players.remove(pl.id);
  chatTimes.delete(pl.id);
  fishCd.delete(pl.id);
  pearlCd.delete(pl.id);
  worldPingCd.delete(pl.id);
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

// ---- lightning storm: starts only under heavy rain, strikes near players ----
let storm = 0; // 0 off, 1 on, 2 severe
let stormT = 50 + Math.random() * 60; // seconds until next storm shift
let strikeT = 8; // seconds until next strike while active
function doStrike(): void {
  const online = [...players.all.values()].filter((p) => !p.dead);
  if (online.length === 0) return;
  const target = online[Math.floor(Math.random() * online.length)];
  const sx = Math.floor(target.p[0] + (Math.random() * 48 - 24));
  const sz = Math.floor(target.p[2] + (Math.random() * 48 - 24));
  const sy = world.groundHeight(sx, sz) + 1;
  if (sy < 1 || sy >= 48) return;
  const dmg = 6 + Math.floor(Math.random() * 3); // 6-8
  for (const pl of players.all.values()) {
    if (pl.dead) continue;
    const d = Math.hypot(pl.p[0] - (sx + 0.5), pl.p[1] - (sy + 0.5), pl.p[2] - (sz + 0.5));
    if (d < 3) {
      const before = pl.hp;
      players.hurt(pl, dmg);
      sendVitals(pl);
      if (pl.dead && before > 0) noteDeath(pl, `⚡ ${pl.name} was struck by lightning`);
    }
  }
  for (const m of [...mobs.mobs.values()]) {
    const d = Math.hypot(m.p[0] - (sx + 0.5), m.p[1] - (sy + 0.5), m.p[2] - (sz + 0.5));
    if (d < 3) {
      const alive = mobs.hurt(m.id, dmg);
      if (!alive) broadcast({ t: "chat", from: "server", msg: `⚡ lightning slew a ${m.kind}` });
      else broadcast({ t: "mobHit", id: m.id });
    }
  }
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if (dx * dx + dz * dz > 4) continue;
      const gy = world.groundHeight(sx + dx, sz + dz);
      if (world.get(sx + dx, gy, sz + dz) === B.GRASS) {
        world.set(sx + dx, gy, sz + dz, B.DIRT);
        broadcast({ t: "block", x: sx + dx, y: gy, z: sz + dz, block: B.DIRT });
      }
    }
  }
  broadcast({ t: "strike", x: sx, y: sy, z: sz });
}
function tickStorm(dt: number): boolean {
  const before = storm;
  stormT -= dt;
  if (stormT <= 0) {
    if (storm === 0) {
      if (rain > 0.7 && Math.random() < 0.5) {
        storm = Math.random() < 0.25 ? 2 : 1;
        stormT = 45 + Math.random() * 45;
        strikeT = 2 + Math.random() * 3;
        toastAll(storm === 2 ? "⛈ a SEVERE lightning storm strikes!" : "⛈ a lightning storm rolls in — take cover!");
      } else {
        stormT = 20 + Math.random() * 30;
      }
    } else {
      storm = 0;
      stormT = 60 + Math.random() * 90;
      toastAll("⛈ the lightning passes");
    }
  }
  if (storm > 0) {
    strikeT -= dt;
    if (strikeT <= 0) {
      strikeT = storm === 2 ? 6 + Math.random() * 4 : 9 + Math.random() * 5;
      doStrike();
    }
  }
  return storm !== before;
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
        if (cur === B.CHEST || cur === B.ENGINE || cur === B.QUARRY || cur === B.PIPE || cur === B.TANK || cur === B.FLUID_PIPE || cur === B.PUMP) machines.removeAt(bx, byy, bz);
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
const lastTpFix = new Map<number, number>(); // rubber-band cooldown per player
/** Authoritative teleport: moves the player AND tells their client to snap.
 *  respawn/spawn/home previously moved only the server copy — the client kept
 *  playing from the old spot (every edit "too far", mobs hunting a ghost). */
function sendTp(pl: Player): void {
  sendTo(pl, { t: "tp", p: [...pl.p] as Vec3 });
}
const quarryLossWarn = new Map<string, number>();
const lastAttack = new Map<number, number>();
const pearlCd = new Map<number, number>();
const worldPingCd = new Map<number, number>();
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

/**
 * Server-side trust gate for client-claimed items. Honest clients always send
 * an item that is actually in their inventory; spoofed ids (diamond pick on
 * empty hands, warhammer without crafting it) fall back to bare hands.
 * Creative bypasses: infinite blocks by design.
 */
function ownedTier(pl: Player, heldItem?: number): number {
  if (pl.creative) return pickTier(heldItem);
  if (heldItem === undefined) return 0;
  return countOf(pl.slots, heldItem) > 0 ? pickTier(heldItem) : 0;
}
function ownedWeapon(pl: Player, weapon?: number): number | undefined {
  if (weapon === undefined) return undefined;
  if (pl.creative) return weapon;
  return countOf(pl.slots, weapon) > 0 ? weapon : undefined;
}

function handleEdit(pl: Player, op: "break" | "place", x: number, y: number, z: number, block?: number, heldItem?: number): void {
  x = Math.round(x); y = Math.round(y); z = Math.round(z);
  if (!Number.isFinite(x + y + z) || y < 1 || y >= 48) return;
  if (pl.dead) return;
  if (!checkRate(pl.id)) return;
  if (dist(pl.p, x, y, z) > (pl.creative ? 12 : 7.5)) {
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
    // wrench: instant pickup of machines (chest keeps nothing — contents spill to you)
    const isMachine = cur === B.CHEST || cur === B.ENGINE || cur === B.QUARRY || cur === B.PIPE || cur === B.TANK || cur === B.FLUID_PIPE || cur === B.PUMP;
    world.set(x, y, z, B.AIR);
    if (cur === B.CHEST) {
      const chest = machines.removeAt(x, y, z);
      if (chest) {
        for (const s of chest.slots) {
          if (s.id) {
            const left = giveItems(pl.slots, s.id, s.n);
            if (left > 0) broadcast({ t: "chat", from: "server", msg: `${pl.name}'s inventory is full — lost ${BLOCK_NAME[s.id] ?? s.id} x${left} from chest` });
          }
        }
        sendInv(pl);
      }
    } else {
      if (cur === B.TANK) {
        const t = machines.tanks.get(mkey(x, y, z));
        if (t && t.amount > 0) {
          sendTo(pl, { t: "chat", from: "server", msg: `🧪 tank broken — lost ${t.amount} mB ${t.fluid}` });
        }
      }
      machines.removeAt(x, y, z);
    }
    // drop only with adequate tool (creative always drops to itself / keeps block)
    // NOTE: tier resolves server-side from actual inventory — a spoofed
    // heldItem id the player doesn't own counts as bare hands (tier 0).
    if (!pl.creative) {
      const tier = ownedTier(pl, heldItem);
      if (tier >= requiredTier(cur) || TOOL_CLASS[cur] === "any") {
        const drop = dropFor(cur);
        if (drop) {
          const left = giveItems(pl.slots, drop.id, drop.n);
          if (left > 0) broadcast({ t: "chat", from: "server", msg: `${pl.name}'s inventory is full — lost ${BLOCK_NAME[cur]}` });
          sendInv(pl);
        }
      }
    } else {
      // creative: breaking a machine refunds the block itself
      if (isMachine) {
        giveItems(pl.slots, cur, 1);
        sendInv(pl);
      }
    }
    if (world.get(x, y, z) === B.FURNACE || cur === B.FURNACE) furnaces.delete(fkey(x, y, z));
    broadcast({ t: "block", x, y, z, block: B.AIR });
    if (cur === B.DIAMOND_ORE && (pl.creative || ownedTier(pl, heldItem) >= requiredTier(cur) || TOOL_CLASS[cur] === "any")) {
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
    if (!pl.creative && countOf(pl.slots, block) <= 0) {
      sendTo(pl, { t: "denied", reason: "none of those in inventory" });
      return;
    }
    if (!pl.creative) {
      removeItems(pl.slots, { [block]: 1 });
    } else if (countOf(pl.slots, block) <= 0) {
      // creative placing a block you don't carry: conjure one stack silently
      giveItems(pl.slots, block, 1);
    }
    world.set(x, y, z, block);
    if (block === B.CHEST) machines.ensureChest(x, y, z);
    if (block === B.ENGINE) machines.ensureEngine(x, y, z);
    if (block === B.TANK) machines.ensureTank(x, y, z);
    if (block === B.PUMP) machines.ensurePump(x, y, z);
    if (block === B.QUARRY) {
      machines.ensureQuarry(x, y, z, pl.id);
      toastAll(`⛏ ${pl.name} deployed a quarry — feed its engine fuel!`);
    }
    if (block === B.QUARRY || block === B.ENGINE || block === B.TANK || block === B.PUMP) void machines.save();
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
  machines.resetAll();
  seedStructureLoot();
  vehicles.resetAll();
  furnaces.clear();
  fuses.length = 0;
  pendingFish.length = 0;
  worldPingCd.clear();
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
  broadcast({ t: "time", time: world.time, rain, storm });
  broadcast({ t: "chat", from: "server", msg: `🌍 ${by} reset the world (seed ${seed})` });
  console.log(`[reset] by ${by}, seed=${seed}`);
}

// /reset needs a confirm (no take-backs): first call stages, second runs.
const pendingReset = new Map<number, { seed: number | null; at: number }>();

function idName(id: number): string {
  return BLOCK_NAME[id] ?? `item ${id}`;
}

function setCreative(pl: Player, creative: boolean): void {
  pl.creative = creative;
  if (creative) {
    pl.hp = pl.maxHp;
    pl.hunger = 20;
    pl.dead = false;
    sendVitals(pl);
    unlock(pl, "creative", `✨ ${pl.name} entered CREATIVE mode — fly (double-Space), infinite blocks!`);
  } else {
    broadcast({ t: "chat", from: "server", msg: `${pl.name} returned to survival` });
  }
  sendTo(pl, { t: "gamemode", creative });
  sendTo(pl, { t: "chat", from: "server", msg: creative ? "✨ CREATIVE: F toggles fly · X shoots bow · chests/pipes/quarry free to place" : "survival mode" });
}

function nearestEngine(pl: Player, r: number): { x: number; y: number; z: number } | null {
  const px = Math.floor(pl.p[0]), py = Math.floor(pl.p[1]), pz = Math.floor(pl.p[2]);
  let best: { x: number; y: number; z: number } | null = null;
  let bestD = r * r;
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        const x = px + dx, y = py + dy, z = pz + dz;
        if (world.get(x, y, z) !== B.ENGINE) continue;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bestD) { bestD = d; best = { x, y, z }; }
      }
    }
  }
  return best;
}

/** Burn one fuel item from pl inventory into engine at pos. Returns success. */
function refuelEngine(pl: Player, pos: { x: number; y: number; z: number }): boolean {
  // lava bucket first (hands the empty bucket back)
  if (countOf(pl.slots, 157) >= 1) {
    if (!pl.creative) {
      removeItems(pl.slots, { 157: 1 });
      giveItems(pl.slots, 155, 1);
    }
    const e = machines.ensureEngine(pos.x, pos.y, pos.z);
    e.burnLeft += LAVA_BURN_S;
    e.burnMax = Math.max(e.burnMax, e.burnLeft);
    sendInv(pl);
    sendTo(pl, { t: "chat", from: "server", msg: `🔥 engine fueled +${LAVA_BURN_S}s (lava bucket)` });
    void machines.save();
    return true;
  }
  const FUEL_PRIORITY = [48, 153, 102, 5, 29, 7, 101];
  for (const id of FUEL_PRIORITY) {
    const secs = ENGINE_FUEL[id];
    if (!secs || countOf(pl.slots, id) < 1) continue;
    removeItems(pl.slots, { [id]: 1 });
    const e = machines.ensureEngine(pos.x, pos.y, pos.z);
    e.burnLeft += secs;
    e.burnMax = Math.max(e.burnMax, e.burnLeft);
    sendInv(pl);
    sendTo(pl, { t: "chat", from: "server", msg: `🔥 engine fueled +${secs}s (${idName(id)})` });
    void machines.save();
    return true;
  }
  return false;
}

/** Returns true if msg was a slash command (handled, not broadcast). */
function handleChatCommand(pl: Player, msg: string): boolean {
  if (!msg.startsWith("/")) return false;
  const parts = msg.slice(1).trim().split(/\s+/);
  const cmd = (parts[0] ?? "").toLowerCase();
  const arg = parts.slice(1).join(" ").trim();
  switch (cmd) {
    case "help":
      sendTo(pl, { t: "chat", from: "server", msg: "commands: /help /players /spawn /sethome /home /locate <tower|ruin|cabin|hut|temple|shrine|village|dungeon> /rain /stats /time <0..1|day|night|morning> /reset [seed] /storm /creative /survival /gamemode <c|s> /give <item> [n] /kit <starter|tools|buildcraft|weapons|fluids|vehicles> /fuel · Q team ping" });
      sendTo(pl, { t: "chat", from: "server", msg: "machines: chest (F open) + engine (F panel/RMB, burns coal/oil/lava) + pipe + quarry (9x9). fluids: pump (taps water/lava) + fluid pipe + tank (16 buckets) + bucket (F scoop/deposit)." });
      sendTo(pl, { t: "chat", from: "server", msg: "vehicles: boat (RMB on water, sail fast) + rails + minecart (W/S throttle on rails). F hops in/out, LMB breaks a free one." });
      return true;
    case "players": {
      const names = [...players.all.values()].map((p) => p.name);
      sendTo(pl, { t: "chat", from: "server", msg: `online (${names.length}): ${names.join(", ")}` });
      return true;
    }
    case "spawn":
      pl.p = [...spawn] as Vec3;
      pl.lastMove = Date.now();
      sendTp(pl);
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
      sendTp(pl);
      sendPlayersSnapshot();
      sendTo(pl, { t: "chat", from: "server", msg: "🏠 teleported home" });
      return true;
    }
    case "locate": {
      const want = (parts[1] ?? "").toLowerCase();
      const spots: { x: number; z: number; kind: string }[] = [
        ...structureCenters(world.seed),
        ...villageCenters(world.seed).map((v) => ({ x: v.x, z: v.z, kind: "village" })),
        ...dungeonSpawns(world.seed).map((s) => ({ x: s.x, z: s.z, kind: "dungeon" })),
      ];
      const kinds = [...new Set(spots.map((s) => s.kind))].sort();
      const pool = want ? spots.filter((s) => s.kind === want) : spots;
      if (pool.length === 0) {
        sendTo(pl, { t: "chat", from: "server", msg: `unknown type "${want}" — try: ${kinds.join(", ")}` });
        return true;
      }
      let best = pool[0], bd = Infinity;
      for (const s of pool) {
        const d = Math.hypot(s.x - pl.p[0], s.z - pl.p[2]);
        if (d < bd) { bd = d; best = s; }
      }
      const dx = best.x - pl.p[0], dz = best.z - pl.p[2];
      const dir = Math.abs(dx) > Math.abs(dz) * 2 ? (dx > 0 ? "east" : "west")
        : Math.abs(dz) > Math.abs(dx) * 2 ? (dz > 0 ? "south" : "north")
        : (dz > 0 ? "south-" : "north-") + (dx > 0 ? "east" : "west");
      sendTo(pl, { t: "chat", from: "server", msg: `📍 nearest ${best.kind}: ${Math.round(bd)}m ${dir} (${Math.round(best.x)}, ${Math.round(best.z)})` });
      return true;
    }
    case "rain": {
      rainTarget = rainTarget > 0.5 ? 0 : 1;
      rainT = rainTarget > 0.5 ? 60 : 200;
      broadcast({ t: "chat", from: "server", msg: `${pl.name} ${rainTarget > 0.5 ? "summoned a storm 🌧" : "cleared the skies ☀"}` });
      return true;
    }
    case "storm": {
      storm = storm === 0 ? 1 : storm === 1 ? 2 : 0;
      if (storm === 0) {
        stormT = 60 + Math.random() * 90;
        toastAll("⛈ the lightning passes");
        broadcast({ t: "chat", from: "server", msg: `${pl.name} calmed the storm ☀` });
      } else {
        stormT = 45 + Math.random() * 45;
        strikeT = 2 + Math.random() * 3;
        toastAll(storm === 2 ? "⛈ a SEVERE lightning storm strikes!" : "⛈ a lightning storm rolls in — take cover!");
        broadcast({ t: "chat", from: "server", msg: `${pl.name} summoned ${storm === 2 ? "a SEVERE storm ⛈" : "a storm ⛈"}` });
      }
      broadcast({ t: "time", time: world.time, rain, storm });
      return true;
    }
    case "stats":
      sendTo(pl, { t: "chat", from: "server", msg: `kills ${pl.stats.kills} · deaths ${pl.stats.deaths} · fished ${pl.stats.fished}` });
      return true;
    case "creative":
    case "gamemode": {
      const a = (parts[1] ?? arg).toLowerCase();
      const wantCreative = cmd === "creative" ? true : a.startsWith("c") ? true : a.startsWith("s") ? false : !pl.creative;
      if (cmd === "gamemode" && !a.startsWith("c") && !a.startsWith("s") && a !== "") {
        sendTo(pl, { t: "chat", from: "server", msg: "usage: /gamemode <creative|survival>" });
        return true;
      }
      setCreative(pl, wantCreative);
      return true;
    }
    case "survival":
      setCreative(pl, false);
      return true;
    case "give": {
      const id = Number(parts[1]);
      const n = Math.max(1, Math.min(64 * 4, Math.floor(Number(parts[2] ?? 1)) || 1));
      if (!Number.isInteger(id) || id <= 0 || id > 200 || !(BLOCK_NAME[id] ?? idName(id))) {
        sendTo(pl, { t: "chat", from: "server", msg: "usage: /give <item-id> [n] — e.g. /give 43 1 (chest), /give 126 1 (diamond pick)" });
        return true;
      }
      // fill across stacks (up to 4 stacks worth)
      let remaining = n;
      while (remaining > 0) {
        const chunk = Math.min(64, remaining);
        const left = giveItems(pl.slots, id, chunk);
        remaining = remaining - chunk + left;
        if (left > 0) break;
      }
      sendInv(pl);
      sendTo(pl, { t: "chat", from: "server", msg: `✨ gave ${n}× ${BLOCK_NAME[id] ?? idName(id)}` });
      return true;
    }
    case "kit": {
      const which = (parts[1] ?? "starter").toLowerCase();
      const kits: Record<string, [number, number][]> = {
        starter: [[7, 32], [15, 16], [104, 4], [108, 1]],
        tools: [[110, 1], [118, 1], [121, 1], [114, 1], [15, 16]],
        buildcraft: [[43, 2], [44, 16], [45, 2], [46, 1], [102, 16], [153, 8]],
        weapons: [[148, 1], [149, 32], [150, 1], [151, 1], [152, 1], [136, 2]],
        fluids: [[49, 16], [50, 2], [51, 1], [155, 4], [102, 8]],
        vehicles: [[158, 1], [159, 1], [52, 32]],
        creative: [[43, 4], [44, 64], [45, 4], [46, 2], [126, 1], [127, 1], [148, 1], [149, 64]],
      };
      const kit = kits[which];
      if (!kit) {
        sendTo(pl, { t: "chat", from: "server", msg: "usage: /kit <starter|tools|buildcraft|weapons|fluids|vehicles|creative>" });
        return true;
      }
      for (const [id, cnt] of kit) giveItems(pl.slots, id, cnt);
      sendInv(pl);
      sendTo(pl, { t: "chat", from: "server", msg: `🎁 kit ${which} granted` });
      return true;
    }
    case "fuel": {
      // refuel nearest burning-capable engine within 6 blocks from inventory
      const e = nearestEngine(pl, 6);
      if (!e) {
        sendTo(pl, { t: "chat", from: "server", msg: "no engine nearby — place one next to your quarry/pipes" });
        return true;
      }
      if (refuelEngine(pl, e)) return true;
      sendTo(pl, { t: "chat", from: "server", msg: "need fuel (coal/oil/coal block/logs) in inventory" });
      return true;
    }
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
      broadcast({ t: "time", time: world.time, rain, storm });
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
      if (Math.hypot(dx, dy, dz) > (pl.creative ? 25 : 10)) {
        // desync (missed teleport, lag spike): the client is somewhere the
        // server isn't — snap it back to the authoritative position instead of
        // stranding it (every edit would fail "too far" forever). Cooled down.
        const now = Date.now();
        if (now - (lastTpFix.get(pl.id) ?? 0) > 2000) {
          lastTpFix.set(pl.id, now);
          sendTp(pl);
        }
        break; // creative fly is fast
      }
      if (ny < -10) {
        // fell out of the world (fresh-join chunk race, severe lag): surface
        // rescue. Bedrock at y=0 is unbreakable, so nothing legit is this low.
        freeRide(pl);
        if (pl.bedSpawn && world.get(pl.bedSpawn[0], pl.bedSpawn[1] - 2, pl.bedSpawn[2]) !== B.BED &&
            world.get(pl.bedSpawn[0], pl.bedSpawn[1] - 1, pl.bedSpawn[2]) !== B.BED) {
          pl.bedSpawn = null;
        }
        players.respawn(pl, spawn);
        sendVitals(pl);
        sendTp(pl); // client must wake up where the server put it (bed or spawn)
        break;
      }
      if (ny < -40 || ny > 120) break;
      pl.p = [nx, ny, nz];
      pl.yaw = m.yaw; pl.pitch = m.pitch;
      pl.lastMove = Date.now();
      // rider-driven vehicles follow their rider
      const rv = vehicles.byRider(pl.id);
      if (rv) {
        rv.p = [nx, ny, nz];
        rv.yaw = m.yaw;
      }
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
      // Spoofed weapon ids fall back to fists (see ownedWeapon above).
      const weapon = ownedWeapon(pl, m.weapon);
      // swing rate-limit: 3 hits/sec max (warhammer is slower: 800ms)
      const nowAtk = Date.now();
      const needGap = weapon === 150 ? 800 : weapon === 152 ? 500 : 330;
      if (nowAtk - (lastAttack.get(pl.id) ?? 0) < needGap) break;
      lastAttack.set(pl.id, nowAtk);
      const mob = mobs.mobs.get(m.id);
      if (!mob) break;
      if (dist(pl.p, mob.p[0], mob.p[1], mob.p[2]) > (weapon === 150 ? 5.5 : 4.5)) break;
      // tamed wolves are off-limits to everyone but their owner (mobs agent
      // reads (pl as {name?:string}).name; owner stored as player name string)
      const mobOwner = (mob as { owner?: unknown }).owner;
      if (typeof mobOwner === "string" && mobOwner && mobOwner !== pl.name) {
        sendTo(pl, { t: "denied", reason: `that's ${mobOwner}'s wolf!` });
        break;
      }
      const swordMult = weapon !== undefined ? (SWORD_MULT[weapon] ?? 1) : 1;
      const isPick = weapon !== undefined && PICK_MULT[weapon] !== undefined;
      let dmg = (weapon === undefined ? 2 : isPick ? 2 : 1) * swordMult;
      const isFire = weapon === 152;
      const isHammer = weapon === 150;
      if (isFire) dmg += 2; // burn bonus
      // small knockback away from the player (big shoves knock mobs out of
      // reach and make melee miserable; warhammer launches)
      const kx = mob.p[0] - pl.p[0], kz = mob.p[2] - pl.p[2];
      const kl = Math.hypot(kx, kz) || 1;
      const kb = isHammer ? 1.6 : 0.45;
      mob.p[0] += (kx / kl) * kb;
      mob.p[2] += (kz / kl) * (isHammer ? 2.2 : 1.1);
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
    case "pearl": {
      if (pl.dead) break;
      if (![m.dx, m.dy, m.dz].every(Number.isFinite)) break;
      let dx = m.dx, dy = m.dy, dz = m.dz;
      const len = Math.hypot(dx, dy, dz);
      if (!Number.isFinite(len) || len < 1e-6) {
        sendTo(pl, { t: "denied", reason: "bad direction" });
        break;
      }
      dx /= len; dy /= len; dz /= len;
      const nowPearl = Date.now();
      if (nowPearl - (pearlCd.get(pl.id) ?? 0) < 1000) {
        sendTo(pl, { t: "denied", reason: "pearl cooling down" });
        break;
      }
      if (countOf(pl.slots, 147) < 1) {
        sendTo(pl, { t: "denied", reason: "need an ender pearl" });
        break;
      }
      const [ex, ey, ez] = pl.p;
      let lastFree: [number, number, number] | null = null;
      for (let s = 0.5; s <= 12; s += 0.25) {
        const bx = Math.floor(ex + dx * s), by = Math.floor(ey + dy * s), bz = Math.floor(ez + dz * s);
        // Stop at walls/ceilings (land just before them); open throws keep
        // every free spot so flat-ground blinks work, not just wall shots.
        if (by < 1 || by + 1 >= 48) break;
        if (world.isSolid(bx, by, bz)) break;
        if (!world.isSolid(bx, by, bz) && !world.isSolid(bx, by + 1, bz)) {
          lastFree = [bx, by, bz];
        }
      }
      if (!lastFree) {
        sendTo(pl, { t: "denied", reason: "no room to land" });
        break;
      }
      pearlCd.set(pl.id, nowPearl);
      removeItems(pl.slots, { 147: 1 });
      pl.p = [lastFree[0] + 0.5, lastFree[1] + 1.5, lastFree[2] + 0.5];
      pl.lastMove = Date.now();
      sendInv(pl);
      sendPlayersSnapshot();
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
    case "worldPing": {
      if (players.all.get(pl.id) !== pl || pl.dead) break;
      const { x, y, z } = m;
      if (![x, y, z].every(Number.isInteger) || y < 0 || y >= WORLD_H) break;
      if (!(dist(pl.p, x, y, z) <= 48)) break;
      const nowPing = Date.now();
      if (nowPing - (worldPingCd.get(pl.id) ?? -Infinity) < 1000) break;
      if (world.get(x, y, z) === B.AIR) break;
      worldPingCd.set(pl.id, nowPing);
      broadcast({ t: "worldPing", id: pl.id, name: pl.name, x, y, z, ttl: 15000 });
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
      if (pl.dead || pl.creative) break;
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
        freeRide(pl);
        // bed gone? fall back to world spawn instead of stranding the player
        if (pl.bedSpawn && world.get(pl.bedSpawn[0], pl.bedSpawn[1] - 2, pl.bedSpawn[2]) !== B.BED &&
            world.get(pl.bedSpawn[0], pl.bedSpawn[1] - 1, pl.bedSpawn[2]) !== B.BED) {
          pl.bedSpawn = null;
        }
        players.respawn(pl, spawn);
        sendVitals(pl);
        sendTp(pl); // client must wake up where the server put it (bed or spawn)
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
    case "shoot": {
      // bow shot: needs bow + arrow, 1s cooldown, hitscan mobs within 24 blocks
      if (pl.dead) break;
      if (![m.dx, m.dy, m.dz].every(Number.isFinite)) break;
      const nowShoot = Date.now();
      if (nowShoot - (lastAttack.get(pl.id) ?? 0) < 900) break;
      if (countOf(pl.slots, 148) < 1) {
        sendTo(pl, { t: "denied", reason: "need a bow" });
        break;
      }
      if (!pl.creative && countOf(pl.slots, 149) < 1) {
        sendTo(pl, { t: "denied", reason: "need arrows" });
        break;
      }
      let dx = m.dx, dy = m.dy, dz = m.dz;
      const len = Math.hypot(dx, dy, dz) || 1;
      dx /= len; dy /= len; dz /= len;
      lastAttack.set(pl.id, nowShoot);
      if (!pl.creative) {
        removeItems(pl.slots, { 149: 1 });
        sendInv(pl);
      }
      broadcast({ t: "shot", from: [...pl.p] as Vec3, dx, dy, dz }, pl.id);
      // hitscan: nearest mob within ~1.2 blocks of the ray, max 24 blocks
      let bestId = -1, bestS = 24;
      for (const mob of mobs.mobs.values()) {
        const ox = mob.p[0] - pl.p[0], oy = mob.p[1] - pl.p[1], oz = mob.p[2] - pl.p[2];
        const s = ox * dx + oy * dy + oz * dz;
        if (s < 1 || s > 24) continue;
        const perp = Math.hypot(ox - dx * s, oy - dy * s, oz - dz * s);
        if (perp < 1.3 && s < bestS) { bestS = s; bestId = mob.id; }
      }
      if (bestId >= 0) {
        const mob = mobs.mobs.get(bestId);
        if (mob) {
          broadcast({ t: "mobHit", id: mob.id });
          const alive = mobs.hurt(mob.id, 7);
          if (!alive) {
            for (const d of mobDrops(mob.kind)) giveItems(pl.slots, d.id, d.n);
            sendInv(pl);
            pl.stats.kills++;
            if (mob.kind === "ogre") unlock(pl, "ogre", `👹 ${pl.name} sniped an OGRE!`);
          }
        }
      }
      break;
    }
    case "chestOpen": {
      if (pl.dead) break;
      const x = Math.round(m.x), y = Math.round(m.y), z = Math.round(m.z);
      if (![x, y, z].every(Number.isFinite) || y < 1 || y >= 48) break;
      if (world.get(x, y, z) !== B.CHEST) {
        sendTo(pl, { t: "denied", reason: "no chest there" });
        break;
      }
      if (dist(pl.p, x, y, z) > (pl.creative ? 12 : 7.5)) {
        sendTo(pl, { t: "denied", reason: "too far" });
        break;
      }
      const c = machines.ensureChest(x, y, z);
      // lazy worldgen loot: first open deals the deterministic contents
      const kind = lootKindByPos.get(mkey(x, y, z));
      if (kind && machines.claimLoot(x, y, z)) fillLootChest(x, y, z, kind);
      sendTo(pl, { t: "chest", x, y, z, slots: c.slots.map((s) => ({ ...s })) });
      break;
    }
    case "chestPut": {
      if (pl.dead) break;
      const x = Math.round(m.x), y = Math.round(m.y), z = Math.round(m.z);
      if (world.get(x, y, z) !== B.CHEST) break;
      if (dist(pl.p, x, y, z) > (pl.creative ? 12 : 7.5)) break;
      const { slot, cs, all } = m;
      if (!Number.isInteger(slot) || !Number.isInteger(cs) || slot < 0 || slot >= 36 || cs < 0 || cs >= 27) break;
      const c = machines.ensureChest(x, y, z);
      const src = pl.slots[slot];
      if (!src.id) break;
      const dst = c.slots[cs];
      if (dst.id && dst.id !== src.id) break;
      if (dst.id && (!isStackable(src.id) || dst.n >= 64)) break;
      let n = all ? src.n : 1;
      if (dst.id) n = Math.min(n, 64 - dst.n);
      if (!pl.creative) {
        dst.id = src.id;
        dst.n += n;
        src.n -= n;
        if (src.n <= 0) { src.id = 0; src.n = 0; }
      } else {
        // creative: copy (shift = whole stack)
        dst.id = src.id;
        dst.n = Math.min(64, dst.n + (all ? 64 - dst.n : 1));
      }
      sendInv(pl);
      sendTo(pl, { t: "chest", x, y, z, slots: c.slots.map((s) => ({ ...s })) });
      void machines.save();
      break;
    }
    case "chestTake": {
      if (pl.dead) break;
      const x = Math.round(m.x), y = Math.round(m.y), z = Math.round(m.z);
      if (world.get(x, y, z) !== B.CHEST) break;
      if (dist(pl.p, x, y, z) > (pl.creative ? 12 : 7.5)) break;
      const cs = m.cs;
      if (!Number.isInteger(cs) || cs < 0 || cs >= 27) break;
      const c = machines.ensureChest(x, y, z);
      const cell = c.slots[cs];
      if (!cell.id) break;
      if (!pl.creative) {
        const left = giveItems(pl.slots, cell.id, cell.n);
        cell.n = left;
        if (left <= 0) { cell.id = 0; cell.n = 0; }
      } else {
        giveItems(pl.slots, cell.id, Math.min(cell.n, 64));
      }
      sendInv(pl);
      sendTo(pl, { t: "chest", x, y, z, slots: c.slots.map((s) => ({ ...s })) });
      void machines.save();
      break;
    }
    case "engineFuel": {
      if (pl.dead) break;
      const e = nearestEngine(pl, 6);
      if (!e) {
        sendTo(pl, { t: "denied", reason: "no engine nearby" });
        break;
      }
      if (!refuelEngine(pl, e)) {
        sendTo(pl, { t: "denied", reason: "need coal/oil/logs in inventory" });
      }
      break;
    }
    case "bucketFill": {
      // scoop water/lava into an empty bucket (source block is NOT consumed)
      if (pl.dead) break;
      const x = Math.round(m.x), y = Math.round(m.y), z = Math.round(m.z);
      if (![x, y, z].every(Number.isFinite) || y < 0 || y >= 48) break;
      const b = world.get(x, y, z);
      if (b !== B.WATER && b !== B.LAVA) {
        sendTo(pl, { t: "denied", reason: "need water or lava" });
        break;
      }
      if (dist(pl.p, x, y, z) > (pl.creative ? 12 : 7.5)) {
        sendTo(pl, { t: "denied", reason: "too far" });
        break;
      }
      if (!pl.creative && countOf(pl.slots, 155) < 1) {
        sendTo(pl, { t: "denied", reason: "need an empty bucket (craft: 3 iron)" });
        break;
      }
      const id = b === B.LAVA ? 157 : 156;
      if (!pl.creative) removeItems(pl.slots, { 155: 1 });
      giveItems(pl.slots, id, 1);
      sendInv(pl);
      sendTo(pl, { t: "chat", from: "server", msg: b === B.LAVA ? "🪣 scooped lava — engine fuel!" : "🪣 scooped water" });
      break;
    }
    case "tankUse": {
      // hold a bucket, aim at a tank: full bucket deposits, empty withdraws
      if (pl.dead) break;
      const x = Math.round(m.x), y = Math.round(m.y), z = Math.round(m.z);
      if (![x, y, z].every(Number.isFinite) || y < 1 || y >= 48) break;
      if (world.get(x, y, z) !== B.TANK) {
        sendTo(pl, { t: "denied", reason: "no tank there" });
        break;
      }
      if (dist(pl.p, x, y, z) > (pl.creative ? 12 : 7.5)) {
        sendTo(pl, { t: "denied", reason: "too far" });
        break;
      }
      const t = machines.ensureTank(x, y, z);
      const held = m.held;
      if (held === 156 || held === 157) {
        const fluid = held === 157 ? "lava" : "water";
        if (t.fluid !== null && t.fluid !== fluid) {
          sendTo(pl, { t: "denied", reason: `tank holds ${t.fluid}` });
          break;
        }
        if (t.amount + BUCKET_MB > TANK_CAP) {
          sendTo(pl, { t: "denied", reason: "tank is full" });
          break;
        }
        if (!pl.creative && countOf(pl.slots, held) < 1) {
          sendTo(pl, { t: "denied", reason: "hold the bucket in your inventory" });
          break;
        }
        if (!pl.creative) removeItems(pl.slots, { [held]: 1 });
        giveItems(pl.slots, 155, 1);
        Machines.tankGive(t, fluid, BUCKET_MB);
        sendInv(pl);
        sendTo(pl, { t: "chat", from: "server", msg: `🧪 tank: ${t.amount}/${TANK_CAP} mB ${t.fluid}` });
        void machines.save();
      } else {
        // empty bucket (or nothing held but one in pocket): withdraw 1 bucket
        if (!t.fluid || t.amount < BUCKET_MB) {
          sendTo(pl, { t: "denied", reason: "tank is empty" });
          break;
        }
        if (!pl.creative && countOf(pl.slots, 155) < 1) {
          sendTo(pl, { t: "denied", reason: "need an empty bucket" });
          break;
        }
        const fid = t.fluid === "lava" ? 157 : 156;
        const fname = t.fluid;
        if (!pl.creative) removeItems(pl.slots, { 155: 1 });
        Machines.tankTake(t, BUCKET_MB);
        giveItems(pl.slots, fid, 1);
        sendInv(pl);
        sendTo(pl, { t: "chat", from: "server", msg: `🪣 drew 1 bucket of ${fname} — tank: ${t.amount}/${TANK_CAP} mB` });
        void machines.save();
      }
      break;
    }
    case "gamemode": {
      const mode = String(m.mode ?? "").toLowerCase();
      setCreative(pl, mode.startsWith("c"));
      break;
    }
    case "vehiclePlace": {
      if (pl.dead) break;
      const kind = m.kind === "cart" ? "cart" : m.kind === "boat" ? "boat" : null;
      if (!kind) break;
      const x = Math.round(m.x), y = Math.round(m.y), z = Math.round(m.z);
      if (![x, y, z].every(Number.isFinite) || y < 0 || y >= 48) break;
      if (dist(pl.p, x, y, z) > (pl.creative ? 12 : 7.5)) {
        sendTo(pl, { t: "denied", reason: "too far" });
        break;
      }
      const needId = kind === "boat" ? 158 : 159;
      if (!pl.creative && countOf(pl.slots, needId) < 1) {
        sendTo(pl, { t: "denied", reason: kind === "boat" ? "need a boat" : "need a minecart" });
        break;
      }
      if (kind === "boat") {
        if (world.get(x, y, z) !== B.WATER) {
          sendTo(pl, { t: "denied", reason: "boats need water — aim at water" });
          break;
        }
      } else {
        if (world.get(x, y, z) !== B.RAIL) {
          sendTo(pl, { t: "denied", reason: "carts need rails — aim at rails" });
          break;
        }
      }
      if (!pl.creative) removeItems(pl.slots, { [needId]: 1 });
      const v = vehicles.place(kind, [x + 0.5, y + (kind === "boat" ? 1.0 : 0.55), z + 0.5], pl.yaw);
      if (!v) {
        if (!pl.creative) giveItems(pl.slots, needId, 1);
        sendTo(pl, { t: "denied", reason: "too many vehicles" });
        break;
      }
      sendInv(pl);
      broadcast({ t: "vehicles", list: vehicles.wire() });
      break;
    }
    case "vehicleEnter": {
      if (pl.dead) break;
      const v = vehicles.vehicles.get(m.id);
      if (!v) {
        sendTo(pl, { t: "denied", reason: "no such vehicle" });
        break;
      }
      if (v.rider !== 0) {
        sendTo(pl, { t: "denied", reason: v.rider === pl.id ? "already riding" : "occupied" });
        break;
      }
      if (dist(pl.p, v.p[0], v.p[1], v.p[2]) > 5) {
        sendTo(pl, { t: "denied", reason: "too far" });
        break;
      }
      freeRide(pl);
      v.rider = pl.id;
      sendTo(pl, { t: "ride", id: v.id, kind: v.kind });
      broadcast({ t: "vehicles", list: vehicles.wire() });
      break;
    }
    case "vehicleExit": {
      if (pl.dead) break;
      freeRide(pl);
      broadcast({ t: "vehicles", list: vehicles.wire() });
      break;
    }
    case "vehicleBreak": {
      if (pl.dead) break;
      const v = vehicles.vehicles.get(m.id);
      if (!v) break;
      if (v.rider !== 0) {
        sendTo(pl, { t: "denied", reason: v.rider === pl.id ? "hop out first (F)" : "occupied" });
        break;
      }
      if (dist(pl.p, v.p[0], v.p[1], v.p[2]) > 5.5) {
        sendTo(pl, { t: "denied", reason: "too far" });
        break;
      }
      vehicles.remove(m.id);
      giveItems(pl.slots, v.kind === "boat" ? 158 : 159, 1);
      sendInv(pl);
      broadcast({ t: "vehicles", list: vehicles.wire() });
      break;
    }
    case "give": {
      const id = Math.floor(m.id);
      const n = Math.max(1, Math.min(256, Math.floor(m.n) || 1));
      if (!Number.isInteger(id) || id <= 0 || id > 200 || !idName(id)) break;
      if (!pl.creative) {
        sendTo(pl, { t: "denied", reason: "creative mode only (/creative)" });
        break;
      }
      giveItems(pl.slots, id, n);
      sendInv(pl);
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
          send(socket, { t: "welcome", id: pl.id, seed: world.seed, spawn: pl.p, time: world.time, rain, motd: "voxel-coop 🧱", creative: pl.creative });
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
      mode: START_CREATIVE ? "creative" : mobs.peaceful ? "peaceful" : "survival",
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

let mobT = 0, slowT = 0, guardT = 0;
setInterval(() => {
  const dt = 0.1;
  world.tick(dt);
  if (tickRain(dt)) mobs.rain = rain; else mobs.rain = rain;
  tickStorm(dt);
  tickFuses();
  // mob damage callback routes to vitals (name included so tamed wolves can
  // follow owners — mobs side reads (pl as {name?:string}).name defensively)
  const wrappers = [...players.all.values()].map((pl) => ({
    p: pl.p,
    name: pl.name,
    hurt: (dmg: number, src?: string) => {
      const before = pl.hp;
      players.hurt(pl, dmg);
      if (pl.hp !== before) sendVitals(pl);
      if (pl.dead && before > 0) {
        noteDeath(pl, src ? `☠ ${pl.name} was slain by ${src}` : `☠ ${pl.name} died`);
      }
    },
  }));
  mobs.tick(dt, world, wrappers, world.isNight());
  if (players.tick(dt, mobs.peaceful)) {
    for (const pl of players.all.values()) sendVitals(pl);
  }
  // dead riders (starvation/void bypass noteDeath) drop their vehicles
  for (const pl of players.all.values()) {
    if (pl.dead) freeRide(pl);
  }
  // lava burns: feet block or head block is LAVA (hurt() 0.6s cd gates dps)
  for (const pl of players.all.values()) {
    if (pl.dead || pl.creative) continue;
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
    if (vehicles.vehicles.size > 0) broadcast({ t: "vehicles", list: vehicles.wire() });
  }
  // dungeon guardians: every ~10s, dungeons near players get a skeleton
  // (maintain() culls far strays, so top up instead of spawning once at boot)
  guardT += dt;
  if (guardT >= 10) {
    guardT = 0;
    if (players.all.size > 0) {
      const pos = players.positions();
      for (const s of dungeonSpawns(world.seed)) {
        let nearPl = false;
        for (const p of pos) {
          const d = Math.hypot(p[0] - s.x, p[2] - s.z);
          if (d < 64) { nearPl = true; break; }
        }
        if (!nearPl) continue;
        let guards = 0;
        for (const m of mobs.mobs.values()) {
          if (m.kind !== "skeleton") continue;
          if (Math.hypot(m.p[0] - s.x, m.p[2] - s.z) < 10) { guards++; break; }
        }
        if (guards === 0) mobs.spawn("skeleton", s.x + 0.5, s.y + 1.2, s.z + 0.5);
      }
    }
  }
  // players broadcast at 10Hz
  for (const pl of players.all.values()) {
    sendTo(pl, { t: "players", list: players.wire(pl.id) });
  }
  // BuildCraft machines: engines burn, pipes shuttle, quarries dig.
  // Quarry output routing: adjacent chest -> pipe network -> owner inventory.
  machines.tick(dt, world, {
    onBlock: (x, y, z, block) => broadcast({ t: "block", x, y, z, block }),
    onQuarryOutput: (q, id, n) => {
      // 1) adjacent chest with room
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]] as const) {
        const c = machines.chests.get(mkey(q.x + dx, q.y + dy, q.z + dz));
        if (c && world.get(q.x + dx, q.y + dy, q.z + dz) === B.CHEST) {
          const left = Machines.chestGive(c, id, n);
          if (left <= 0) return;
          n = left;
        }
      }
      // 2) pipe network to a reachable chest
      const dest = machines.findPipeTarget(world, q.x, q.y, q.z, id, n);
      if (dest) {
        const left = Machines.chestGive(dest, id, n);
        if (left <= 0) return;
        n = left;
      }
      // 3) owner inventory fallback, then any online player (quarries are
      // shared infrastructure — previously output vanished silently when the
      // owner was offline or full, with no ground-drop system to catch it)
      const owner = players.all.get(q.owner);
      const recipients = owner
        ? [owner, ...[...players.all.values()].filter((p) => p.id !== owner.id)]
        : [...players.all.values()];
      for (const r of recipients) {
        const left = giveItems(r.slots, id, n);
        sendInv(r);
        if (left <= 0) return;
        n = left;
      }
      // Still no room anywhere: warn (throttled) instead of voiding silently.
      const qk = `${q.x},${q.y},${q.z}`;
      const lastWarn = quarryLossWarn.get(qk) ?? 0;
      if (Date.now() - lastWarn > 15000) {
        quarryLossWarn.set(qk, Date.now());
        broadcast({ t: "chat", from: "server", msg: `⛏ quarry @ ${q.x},${q.y},${q.z} voided ${BLOCK_NAME[id] ?? id} x${n} — all storage full` });
      }
    },
    onEngineUpdate: () => {},
  });
  let machineT = (globalThis as { __machineT?: number }).__machineT ?? 0;
  machineT += dt;
  if (machineT >= 2) {
    machineT = 0;
    if (machines.engines.size > 0 || machines.quarries.size > 0 || machines.tanks.size > 0 || machines.pumps.size > 0) {
      broadcast({
        t: "machines",
        engines: [...machines.engines.values()].map((e) => ({
          x: e.x, y: e.y, z: e.z,
          burning: e.burnLeft > 0,
          progress: e.burnMax > 0 ? e.burnLeft / e.burnMax : 0,
        })),
        quarries: [...machines.quarries.values()].map((q) => ({
          x: q.x, y: q.y, z: q.z,
          powered: machines.poweredAt(q.x, q.y, q.z),
          done: q.done,
        })),
        tanks: [...machines.tanks.values()].map((t) => ({
          x: t.x, y: t.y, z: t.z, fluid: t.fluid, amount: t.amount,
        })),
      });
    }
  }
  (globalThis as { __machineT?: number }).__machineT = machineT;
  // furnaces
  let furnaceChanged = false;
  for (const [k, f] of furnaces) {
    if (f.active) {
      const done = smeltTick(f, dt);
      furnaceChanged = true;
      if (done) {
        // smeltTick leaves active=false/progress=0; the output is granted
        // below, or held as ready-for-pickup (done=true) when the owner is
        // offline or full — the smelt/take handler collects it later.
        // Previously the entry was always deleted: offline/full = item lost.
        const owner = players.all.get(f.owner);
        const out = smeltOutput(f.input ?? B.IRON_ORE) ?? { id: 103, n: 1 };
        if (owner) {
          const left = giveItems(owner.slots, out.id, out.n);
          sendInv(owner);
          if (left > 0) {
            (f as { done?: boolean }).done = true;
            if (owner.socket) {
              send(owner.socket, { t: "chat", from: "server", msg: "smelt done — inventory full, collect at the furnace" });
            }
          } else {
            if (owner.socket) {
              send(owner.socket, { t: "chat", from: "server", msg: `⛏ smelt complete: +${out.n} ${BLOCK_NAME[out.id] ?? out.id}` });
            }
            furnaces.delete(k);
          }
        } else {
          // owner offline: hold the finished smelt for later pickup
          (f as { done?: boolean }).done = true;
        }
      }
    }
  }
  slowT += dt;
  if (slowT >= 2 || furnaceChanged) {
    if (slowT >= 2) {
      slowT = 0;
      broadcast({ t: "time", time: world.time, rain, storm });
      void persistPlayers();
      void machines.save(); // chests/engines/quarries persist alongside players
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
      x: f.x, y: f.y, z: f.z, progress: f.progress / SMELT_TIME,
      ready: (f as { done?: boolean }).done === true,
    }));
    if (states.length > 0) broadcast({ t: "smeltState", states });
  }
}, 100);

Deno.addSignalListener("SIGINT", () => {
  console.log("\nsaving…");
  void Promise.all([world.save(), persistPlayers(), machines.save(), vehicles.save()]).then(() => Deno.exit(0));
});

console.log(`\n  🧱 voxel-coop server on :${PORT}${mobs.peaceful ? "  [PEACEFUL — no hostiles, no hunger]" : ""}${START_CREATIVE ? "  [CREATIVE-FIRST — fly + infinite blocks]" : ""}`);
console.log(`  local:  http://localhost:${PORT}/`);
for (const ip of lanIps()) console.log(`  lan:    http://${ip}:${PORT}/`);
console.log(`  share the lan URL with player 2 — same Wi-Fi, no certs, plain http.\n`);

Deno.serve({ hostname: "0.0.0.0", port: PORT }, handler);
