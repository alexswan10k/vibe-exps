// Connected players: vitals (hp/hunger), survival tick, inventories.

import { InvSlot, PublicPlayer, ServerMsg, Vec3 } from "./protocol.ts";
import { giveItems } from "./crafting.ts";

export interface Player {
  id: number;
  name: string;
  p: Vec3;
  yaw: number;
  pitch: number;
  hp: number;
  maxHp: number;
  hunger: number; // 0..20
  dead: boolean;
  slots: InvSlot[];
  grid: InvSlot[]; // 3x3 crafting grid (2x2 inventory view uses cells 0,1,3,4)
  hungerT: number;
  hurtCd: number;
  bedSpawn: Vec3 | null; // set by sleeping in a bed (setBed), used on respawn
  socket: WebSocket | null;
  isPoll: boolean; // legacy HTTP-poll transport (no websocket)
  outbox: ServerMsg[]; // queued messages for poll players
  lastPoll: number;
  lastMove: number;
}

export function emptyInv(): InvSlot[] {
  return Array.from({ length: 36 }, () => ({ id: 0, n: 0 }));
}

export function emptyGrid(): InvSlot[] {
  return Array.from({ length: 9 }, () => ({ id: 0, n: 0 }));
}

let nextId = 1;

// Edible items: id -> { hunger restored, hp healed }.
export const FOOD: Record<number, { hunger: number; hp: number }> = {
  104: { hunger: 4, hp: 2 }, // raw pork
  107: { hunger: 8, hp: 6 }, // cooked pork
  115: { hunger: 3, hp: 1 }, // apple
  132: { hunger: 3, hp: 1 }, // raw beef
  133: { hunger: 8, hp: 8 }, // steak (best regular food)
  134: { hunger: 2, hp: 0 }, // raw chicken (risky snack)
  135: { hunger: 6, hp: 4 }, // roast chicken
  136: { hunger: 10, hp: 20 }, // golden apple (full heal)
};

export class Players {
  all = new Map<number, Player>();

  add(name: string, spawn: Vec3, sock: WebSocket | null): Player {
    const p: Player = {
      id: nextId++,
      name: (name || "player").slice(0, 16),
      p: [...spawn] as Vec3, yaw: 0, pitch: 0,
      hp: 20, maxHp: 20, hunger: 20, dead: false,
      slots: emptyInv(), hungerT: 0, hurtCd: 0,
      grid: emptyGrid(), bedSpawn: null,
      socket: sock, isPoll: sock === null, outbox: [], lastPoll: Date.now(),
      lastMove: Date.now(),
    };
    // starter kit: torches so night one isn't miserable
    giveItems(p.slots, 15, 8);
    this.all.set(p.id, p);
    return p;
  }

  remove(id: number): void {
    this.all.delete(id);
  }

  hurt(pl: Player, dmg: number): void {
    if (pl.dead || dmg <= 0) return;
    if (pl.hurtCd > 0) return;
    pl.hurtCd = 0.6;
    pl.hp -= dmg;
    if (pl.hp <= 0) {
      pl.hp = 0;
      pl.dead = true;
    }
  }

  respawn(pl: Player, spawn: Vec3): void {
    pl.p = pl.bedSpawn ? [...pl.bedSpawn] as Vec3 : [...spawn] as Vec3;
    pl.hp = pl.maxHp;
    pl.hunger = 20;
    pl.dead = false;
  }

  eat(pl: Player, slotIdx: number): boolean {
    const s = pl.slots[slotIdx];
    if (!s || s.n <= 0) return false;
    const food = FOOD[s.id];
    if (!food) return false;
    s.n -= 1;
    if (s.n <= 0) { s.id = 0; s.n = 0; }
    pl.hunger = Math.min(20, pl.hunger + food.hunger);
    pl.hp = Math.min(pl.maxHp, pl.hp + food.hp);
    return true;
  }

  /** Hunger drains, starvation damages, regen when full. Returns true if vitals changed. */
  tick(dt: number, peaceful = false): boolean {
    let changed = false;
    for (const pl of this.all.values()) {
      if (pl.hurtCd > 0) pl.hurtCd -= dt;
      if (pl.dead) continue;
      if (peaceful) {
        // MC peaceful: hunger tops up, no starvation
        if (pl.hunger < 20) { pl.hunger = Math.min(20, pl.hunger + dt * 2); changed = true; }
        if (pl.hp < pl.maxHp) { pl.hp = Math.min(pl.maxHp, pl.hp + dt * 1.5); changed = true; }
      } else {
        pl.hungerT += dt;
        if (pl.hungerT > 12) {
          pl.hungerT = 0;
          if (pl.hunger > 0) {
            pl.hunger -= 1;
            changed = true;
          }
        }
      }
      if (pl.hunger <= 0) {
        pl.hp -= dt * 1.0; // starve
        changed = true;
        if (pl.hp <= 0) { pl.hp = 0; pl.dead = true; }
      } else if (pl.hunger >= 18 && pl.hp < pl.maxHp) {
        pl.hp = Math.min(pl.maxHp, pl.hp + dt * 0.8); // regen
        changed = true;
      }
      // void death
      if (pl.p[1] < -25 && !pl.dead) {
        pl.dead = true;
        pl.hp = 0;
        changed = true;
      }
    }
    return changed;
  }

  positions(): Vec3[] {
    return [...this.all.values()].filter((p) => !p.dead).map((p) => p.p);
  }

  wire(exceptId?: number): PublicPlayer[] {
    return [...this.all.values()]
      .filter((p) => p.id !== exceptId)
      .map((p) => ({
        id: p.id, name: p.name,
        p: [Math.round(p.p[0] * 20) / 20, Math.round(p.p[1] * 20) / 20, Math.round(p.p[2] * 20) / 20],
        yaw: Math.round(p.yaw * 100) / 100, hp: Math.ceil(p.hp), dead: p.dead,
      }));
  }
}
