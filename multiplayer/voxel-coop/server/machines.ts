// BuildCraft-lite: chests (27-slot storage), stirling engines (fuel -> power),
// pipes (chest-to-chest item transport over PIPE blocks), quarries (9x9 auto-miner),
// tanks (16000 mB fluid storage), fluid pipes (tank-to-tank flow) and pumps
// (tap adjacent natural water/lava into tanks, engine-powered).
// All state persists to data/machines.json. Tick is driven by server/main.ts.

import { B, FluidKind, InvSlot } from "./protocol.ts";
import { ENGINE_FUEL, MAX_STACK, dropFor, isStackable } from "./crafting.ts";
import type { World } from "./world.ts";

export const CHEST_SIZE = 27;
export const QUARRY_R = 4; // 9x9 footprint
export const TANK_CAP = 16000; // mB (16 buckets)
export const BUCKET_MB = 1000;
export const LAVA_BURN_S = 120; // seconds per 1000 mB lava in an engine
export const PUMP_MB = 1000; // mB generated per pump cycle
export const PUMP_PERIOD = 3; // seconds per pump cycle while powered

export interface ChestState { x: number; y: number; z: number; slots: InvSlot[] }
export interface EngineState { x: number; y: number; z: number; burnLeft: number; burnMax: number }
export interface TankState { x: number; y: number; z: number; fluid: FluidKind | null; amount: number } // amount in mB
export interface QuarryState {
  x: number; y: number; z: number; owner: number;
  step: number; // next cell index (0..81*layers)
  cooldown: number; done: boolean;
}

export const mkey = (x: number, y: number, z: number) => `${x},${y},${z}`;

export function emptyChestSlots(): InvSlot[] {
  return Array.from({ length: CHEST_SIZE }, () => ({ id: 0, n: 0 }));
}

const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const;

export class Machines {
  chests = new Map<string, ChestState>();
  engines = new Map<string, EngineState>();
  quarries = new Map<string, QuarryState>();
  tanks = new Map<string, TankState>();
  pumps = new Set<string>(); // positions of PUMP blocks (stateless, validated vs world)
  savePath: string;
  private pipeT = 0;
  private quarryT = 0;
  private fluidT = 0;
  private pumpT = 0;

  constructor(savePath: string) {
    this.savePath = savePath;
  }

  static async loadOrCreate(savePath: string): Promise<Machines> {
    const m = new Machines(savePath);
    try {
      const raw = await Deno.readTextFile(savePath);
      const d = JSON.parse(raw);
      for (const [k, v] of Object.entries(d.chests ?? {})) {
        const c = v as { x: number; y: number; z: number; slots: InvSlot[] };
        if (Array.isArray(c.slots)) {
          const slots = emptyChestSlots();
          for (let i = 0; i < Math.min(slots.length, c.slots.length); i++) {
            const s = c.slots[i];
            if (s && Number.isInteger(s.id) && Number.isInteger(s.n) && s.n > 0) {
              slots[i] = { id: s.id, n: Math.min(s.n, MAX_STACK) };
            }
          }
          m.chests.set(k, { x: c.x, y: c.y, z: c.z, slots });
        }
      }
      for (const [k, v] of Object.entries(d.engines ?? {})) {
        const e = v as EngineState;
        if (Number.isFinite(e.burnLeft)) m.engines.set(k, { x: e.x, y: e.y, z: e.z, burnLeft: e.burnLeft, burnMax: e.burnMax ?? 0 });
      }
      for (const [k, v] of Object.entries(d.quarries ?? {})) {
        const q = v as QuarryState;
        if (Number.isInteger(q.step)) m.quarries.set(k, { x: q.x, y: q.y, z: q.z, owner: q.owner ?? 0, step: q.step, cooldown: 0, done: !!q.done });
      }
      for (const [k, v] of Object.entries(d.tanks ?? {})) {
        const t = v as TankState;
        if (Number.isInteger(t.amount) && (t.fluid === "water" || t.fluid === "lava" || t.fluid === null)) {
          m.tanks.set(k, { x: t.x, y: t.y, z: t.z, fluid: t.amount > 0 ? t.fluid : null, amount: Math.max(0, Math.min(TANK_CAP, t.amount)) });
        }
      }
      for (const k of (d.pumps ?? []) as string[]) {
        if (typeof k === "string") m.pumps.add(k);
      }
      console.log(`[machines] loaded ${m.chests.size} chests, ${m.engines.size} engines, ${m.quarries.size} quarries, ${m.tanks.size} tanks, ${m.pumps.size} pumps`);
    } catch { /* first run */ }
    return m;
  }

  async save(): Promise<void> {
    try {
      await Deno.mkdir(this.savePath.split("/").slice(0, -1).join("/"), { recursive: true });
      const d = {
        chests: Object.fromEntries(this.chests),
        engines: Object.fromEntries(this.engines),
        quarries: Object.fromEntries(this.quarries),
        tanks: Object.fromEntries(this.tanks),
        pumps: [...this.pumps],
      };
      await Deno.writeTextFile(this.savePath, JSON.stringify(d));
    } catch (e) { console.error("[machines] save failed:", e); }
  }

  resetAll(): void {
    this.chests.clear();
    this.engines.clear();
    this.quarries.clear();
    this.tanks.clear();
    this.pumps.clear();
    void this.save();
  }

  ensureChest(x: number, y: number, z: number): ChestState {
    const k = mkey(x, y, z);
    let c = this.chests.get(k);
    if (!c) {
      c = { x, y, z, slots: emptyChestSlots() };
      this.chests.set(k, c);
    }
    return c;
  }

  ensureEngine(x: number, y: number, z: number): EngineState {
    const k = mkey(x, y, z);
    let e = this.engines.get(k);
    if (!e) {
      e = { x, y, z, burnLeft: 0, burnMax: 0 };
      this.engines.set(k, e);
    }
    return e;
  }

  ensureQuarry(x: number, y: number, z: number, owner: number): QuarryState {
    const k = mkey(x, y, z);
    let q = this.quarries.get(k);
    if (!q) {
      q = { x, y, z, owner, step: 0, cooldown: 0, done: false };
      this.quarries.set(k, q);
    }
    return q;
  }

  /** Called when a machine block is mined/exploded: drop contents, forget state. */
  removeAt(x: number, y: number, z: number): ChestState | null {
    const k = mkey(x, y, z);
    const c = this.chests.get(k) ?? null;
    this.chests.delete(k);
    this.engines.delete(k);
    this.quarries.delete(k);
    this.tanks.delete(k);
    this.pumps.delete(k);
    return c;
  }

  ensureTank(x: number, y: number, z: number): TankState {
    const k = mkey(x, y, z);
    let t = this.tanks.get(k);
    if (!t) {
      t = { x, y, z, fluid: null, amount: 0 };
      this.tanks.set(k, t);
    }
    return t;
  }

  ensurePump(x: number, y: number, z: number): void {
    this.pumps.add(mkey(x, y, z));
  }

  /** Add fluid to a tank (same kind or empty). Returns leftover mB. */
  static tankGive(t: TankState, fluid: FluidKind, mb: number): number {
    if (t.fluid !== null && t.fluid !== fluid) return mb;
    if (t.fluid === null && mb > 0) t.fluid = fluid;
    const room = TANK_CAP - t.amount;
    const add = Math.min(room, mb);
    t.amount += add;
    return mb - add;
  }

  /** Take up to mb from a tank. Returns mB actually taken. */
  static tankTake(t: TankState, mb: number): number {
    const take = Math.min(t.amount, mb);
    t.amount -= take;
    if (t.amount <= 0) { t.amount = 0; t.fluid = null; }
    return take;
  }

  hasMachine(x: number, y: number, z: number): boolean {
    const k = mkey(x, y, z);
    return this.chests.has(k) || this.engines.has(k) || this.quarries.has(k);
  }

  engineBurning(x: number, y: number, z: number): boolean {
    const e = this.engines.get(mkey(x, y, z));
    return !!e && e.burnLeft > 0;
  }

  /** Any adjacent engine with burnLeft > 0 powers this position. */
  poweredAt(x: number, y: number, z: number): boolean {
    for (const [dx, dy, dz] of DIRS) {
      if (this.engineBurning(x + dx, y + dy, z + dz)) return true;
    }
    return false;
  }

  /** Try to add fuel item; returns seconds added (0 = not fuel). */
  fuelSeconds(itemId: number): number {
    return ENGINE_FUEL[itemId] ?? 0;
  }

  /** BFS over PIPE blocks from (sx,sy,sz): find nearest chest with room for `id`. */
  findPipeTarget(world: World, sx: number, sy: number, sz: number, id: number, n: number): ChestState | null {
    const seen = new Set<string>([mkey(sx, sy, sz)]);
    const queue: [number, number, number, number][] = [[sx, sy, sz, 0]];
    const dests: ChestState[] = [];
    while (queue.length > 0) {
      const [x, y, z, d] = queue.shift()!;
      if (d > 32) continue;
      for (const [dx, dy, dz] of DIRS) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        const kk = mkey(nx, ny, nz);
        if (seen.has(kk)) continue;
        seen.add(kk);
        const b = world.get(nx, ny, nz);
        if (b === B.PIPE) {
          queue.push([nx, ny, nz, d + 1]);
        } else if (b === B.CHEST) {
          const c = this.chests.get(kk) ?? this.ensureChest(nx, ny, nz);
          if (chestRoom(c, id, n) > 0) dests.push(c);
        }
      }
    }
    return dests[0] ?? null;
  }

  /** BFS over FLUID_PIPE blocks: nearest tank accepting `fluid` with room. */
  findFluidTarget(world: World, sx: number, sy: number, sz: number, fluid: FluidKind, mb: number): TankState | null {
    const seen = new Set<string>([mkey(sx, sy, sz)]);
    const queue: [number, number, number, number][] = [[sx, sy, sz, 0]];
    while (queue.length > 0) {
      const [x, y, z, d] = queue.shift()!;
      if (d > 32) continue;
      for (const [dx, dy, dz] of DIRS) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        const kk = mkey(nx, ny, nz);
        if (seen.has(kk)) continue;
        seen.add(kk);
        const b = world.get(nx, ny, nz);
        if (b === B.FLUID_PIPE) {
          queue.push([nx, ny, nz, d + 1]);
        } else if (b === B.TANK) {
          const t = this.tanks.get(kk) ?? this.ensureTank(nx, ny, nz);
          if ((t.fluid === null || t.fluid === fluid) && TANK_CAP - t.amount >= Math.min(mb, BUCKET_MB)) return t;
        }
      }
    }
    return null;
  }

  /** Suck one fuel item from adjacent chests (lava buckets excluded — handled
   *  via tanks/buckets), or lava from adjacent tanks. Returns true if lit. */
  private suckFuel(e: EngineState): boolean {
    // lava first: adjacent tanks with >= 1 bucket of lava
    for (const [dx, dy, dz] of DIRS) {
      const t = this.tanks.get(mkey(e.x + dx, e.y + dy, e.z + dz));
      if (t && t.fluid === "lava" && t.amount >= BUCKET_MB) {
        Machines.tankTake(t, BUCKET_MB);
        e.burnLeft = LAVA_BURN_S;
        e.burnMax = Math.max(e.burnMax, LAVA_BURN_S);
        return true;
      }
    }
    for (const [dx, dy, dz] of DIRS) {
      const c = this.chests.get(mkey(e.x + dx, e.y + dy, e.z + dz));
      if (!c) continue;
      for (const s of c.slots) {
        const secs = this.fuelSeconds(s.id);
        if (s.id && secs > 0) {
          s.n -= 1;
          if (s.n <= 0) { s.id = 0; s.n = 0; }
          e.burnLeft = secs;
          e.burnMax = Math.max(e.burnMax, secs);
          return true;
        }
      }
    }
    return false;
  }
  static chestGive(c: ChestState, id: number, n: number): number {
    if (isStackable(id)) {
      for (const s of c.slots) {
        if (n <= 0) break;
        if (s.id === id && s.n < MAX_STACK) {
          const add = Math.min(MAX_STACK - s.n, n);
          s.n += add; n -= add;
        }
      }
    }
    for (const s of c.slots) {
      if (n <= 0) break;
      if (s.id === 0) {
        if (isStackable(id)) {
          const add = Math.min(MAX_STACK, n);
          s.id = id; s.n = add; n -= add;
        } else { s.id = id; s.n = 1; n -= 1; }
      }
    }
    return n;
  }

  tick(
    dt: number,
    world: World,
    hooks: {
      onBlock: (x: number, y: number, z: number, block: number) => void;
      onQuarryOutput: (q: QuarryState, id: number, n: number) => void;
      onEngineUpdate: () => void;
    },
  ): void {
    // engines burn down whenever lit (they power adjacent quarries/pipes).
    // Dry engines auto-suck lava from adjacent tanks, else fuel from chests.
    let enginesChanged = false;
    for (const e of this.engines.values()) {
      if (e.burnLeft > 0) {
        e.burnLeft -= dt;
        if (e.burnLeft <= 0) { e.burnLeft = 0; e.burnMax = 0; }
        enginesChanged = true;
      }
      if (e.burnLeft <= 0) {
        if (this.suckFuel(e)) enginesChanged = true;
      }
    }
    if (enginesChanged) hooks.onEngineUpdate();

    // pipes: every 0.4s each source chest next to a pipe pushes 1 stack-item
    // to the nearest reachable chest with room.
    this.pipeT += dt;
    if (this.pipeT >= 0.4) {
      this.pipeT = 0;
      for (const c of this.chests.values()) {
        if (world.get(c.x, c.y, c.z) !== B.CHEST) continue;
        let touchesPipe = false;
        for (const [dx, dy, dz] of DIRS) {
          if (world.get(c.x + dx, c.y + dy, c.z + dz) === B.PIPE) { touchesPipe = true; break; }
        }
        if (!touchesPipe) continue;
        if (!this.poweredAt(c.x, c.y, c.z) && !pipePoweredNearby(world, this, c.x, c.y, c.z)) continue;
        const src = c.slots.find((s) => s.id !== 0 && s.n > 0);
        if (!src) continue;
        const dest = this.findPipeTarget(world, c.x, c.y, c.z, src.id, 1);
        if (!dest || dest === c) continue;
        // move a single item
        src.n -= 1;
        const movedId = src.id;
        if (src.n <= 0) { src.id = 0; src.n = 0; }
        const left = Machines.chestGive(dest, movedId, 1);
        if (left > 0) Machines.chestGive(c, movedId, left); // bounce back if raced
      }
    }

    // quarries: every 0.7s while powered, mine the next cell in the 9x9
    // shaft below the block (skips the quarry's own y level).
    this.quarryT += dt;
    if (this.quarryT >= 0.7) {
      const steps = Math.floor(this.quarryT / 0.7);
      this.quarryT -= steps * 0.7;
      for (let s = 0; s < steps; s++) {
        for (const q of this.quarries.values()) {
          if (q.done) continue;
          if (world.get(q.x, q.y, q.z) !== B.QUARRY) continue;
          if (!this.poweredAt(q.x, q.y, q.z)) continue;
          this.mineNext(world, q, hooks);
        }
      }
    }

    // pumps: every PUMP_PERIOD while powered, tap adjacent natural water/lava
    // (lava preferred) into an adjacent tank or the fluid-pipe network.
    // Source blocks are NOT consumed — pumps are infinite taps, rate-limited.
    this.pumpT += dt;
    if (this.pumpT >= PUMP_PERIOD) {
      this.pumpT = 0;
      for (const k of [...this.pumps]) {
        const [px, py, pz] = k.split(",").map(Number);
        if (world.get(px, py, pz) !== B.PUMP) { this.pumps.delete(k); continue; }
        if (!this.poweredAt(px, py, pz)) continue;
        let fluid: FluidKind | null = null;
        for (const [dx, dy, dz] of DIRS) {
          const b = world.get(px + dx, py + dy, pz + dz);
          if (b === B.LAVA) { fluid = "lava"; break; }
          if (b === B.WATER && fluid === null) fluid = "water";
        }
        if (!fluid) continue;
        let mb = PUMP_MB;
        for (const [dx, dy, dz] of DIRS) {
          if (mb <= 0) break;
          const t = this.tanks.get(mkey(px + dx, py + dy, pz + dz));
          if (t && world.get(px + dx, py + dy, pz + dz) === B.TANK) {
            mb = Machines.tankGive(t, fluid, mb);
          }
        }
        if (mb > 0) {
          const dest = this.findFluidTarget(world, px, py, pz, fluid, mb);
          if (dest) mb = Machines.tankGive(dest, fluid, mb);
        }
      }
    }

    // fluid pipes: every 0.5s balance tanks over the network — fuller tanks
    // push up to 500 mB into emptier compatible tanks. Needs engine power.
    this.fluidT += dt;
    if (this.fluidT >= 0.5) {
      this.fluidT = 0;
      for (const t of this.tanks.values()) {
        if (world.get(t.x, t.y, t.z) !== B.TANK) continue;
        if (!t.fluid || t.amount < 1500) continue;
        let touchesPipe = false;
        for (const [dx, dy, dz] of DIRS) {
          if (world.get(t.x + dx, t.y + dy, t.z + dz) === B.FLUID_PIPE) { touchesPipe = true; break; }
        }
        if (!touchesPipe) continue;
        if (!this.poweredAt(t.x, t.y, t.z) && !pipePoweredNearby(world, this, t.x, t.y, t.z, B.FLUID_PIPE)) continue;
        const dest = this.findFluidTarget(world, t.x, t.y, t.z, t.fluid, 500);
        if (!dest || dest === t || dest.amount >= t.amount - 250) continue;
        const move = Math.min(500, Math.floor((t.amount - dest.amount) / 2));
        if (move < 50) continue;
        const taken = Machines.tankTake(t, move);
        const left = Machines.tankGive(dest, t.fluid, taken);
        if (left > 0) Machines.tankGive(t, dest.fluid ?? t.fluid, left);
      }
    }
  }

  private mineNext(
    world: World,
    q: QuarryState,
    hooks: { onBlock: (x: number, y: number, z: number, block: number) => void; onQuarryOutput: (qq: QuarryState, id: number, n: number) => void },
  ): void {
    const W = QUARRY_R * 2 + 1; // 9
    const layers = Math.max(1, q.y - 2); // down to y=2 (never bedrock floor)
    const total = W * W * layers;
    while (q.step < total) {
      const i = q.step++;
      const lx = (i % W) - QUARRY_R;
      const lz = (Math.floor(i / W) % W) - QUARRY_R;
      const ly = q.y - 1 - Math.floor(i / (W * W));
      const bx = q.x + lx, by = ly, bz = q.z + lz;
      if (by < 2) { q.done = true; return; }
      const cur = world.get(bx, by, bz);
      if (cur === B.AIR || cur === B.WATER || cur === B.LAVA || cur === B.BEDROCK) continue;
      // never eat machine blocks themselves
      if (cur === B.CHEST || cur === B.ENGINE || cur === B.QUARRY || cur === B.PIPE || cur === B.TANK || cur === B.FLUID_PIPE || cur === B.PUMP) continue;
      const drop = quarryDropFor(cur);
      world.set(bx, by, bz, B.AIR);
      hooks.onBlock(bx, by, bz, B.AIR);
      if (drop) hooks.onQuarryOutput(q, drop.id, drop.n);
      return; // one block per step
    }
    q.done = true;
  }
}

function chestRoom(c: ChestState, id: number, n: number): number {
  if (!isStackable(id)) return c.slots.some((s) => s.id === 0) ? n : 0;
  let room = 0;
  for (const s of c.slots) {
    if (s.id === id) room += MAX_STACK - s.n;
    else if (s.id === 0) room += MAX_STACK;
  }
  return Math.min(room, n);
}

/** Pipes only run when the network is powered: an engine burning within
 *  reach of any pipe in the connected network. Cheap check from source. */
function pipePoweredNearby(world: World, m: Machines, x: number, y: number, z: number, pipe: number = B.PIPE): boolean {
  const seen = new Set<string>();
  const queue: [number, number, number][] = [[x, y, z]];
  seen.add(mkey(x, y, z));
  let steps = 0;
  while (queue.length > 0 && steps++ < 40) {
    const [cx, cy, cz] = queue.shift()!;
    if (m.poweredAt(cx, cy, cz)) return true;
    for (const [dx, dy, dz] of DIRS) {
      const nx = cx + dx, ny = cy + dy, nz = cz + dz;
      const kk = mkey(nx, ny, nz);
      if (seen.has(kk)) continue;
      seen.add(kk);
      if (world.get(nx, ny, nz) === pipe) queue.push([nx, ny, nz]);
    }
  }
  return false;
}

/** Quarry drops ignore tool tiers (it's a diamond-grade machine) but keep
 *  block->item mapping. Bedrock/lava/water handled by caller. */
function quarryDropFor(block: number): { id: number; n: number } | null {
  if (block === B.DIAMOND_ORE) return { id: 123, n: 1 };
  if (block === B.EMERALD_ORE) return { id: 144, n: 1 };
  if (block === B.OIL_ORE) return { id: 153, n: 1 };
  if (block === B.GOLD_ORE) return { id: 18, n: 1 };
  if (block === B.IRON_ORE) return { id: 12, n: 1 };
  if (block === B.COAL_ORE) return { id: 102, n: 1 };
  const d = dropFor(block);
  if (d) return d;
  // stone/dirt-like blocks with no drop mapping still yield themselves
  if (block !== B.AIR) return { id: block, n: 1 };
  return null;
}
