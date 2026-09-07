// Connected players: vitals (hp/hunger), survival tick, inventories.

import { InvSlot, PublicPlayer, Vec3 } from "./protocol.ts";
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
  hungerT: number;
  hurtCd: number;
  socket: WebSocket | null;
  lastMove: number;
}

export function emptyInv(): InvSlot[] {
  return Array.from({ length: 36 }, () => ({ id: 0, n: 0 }));
}

let nextId = 1;

export class Players {
  all = new Map<number, Player>();

  add(name: string, spawn: Vec3, sock: WebSocket): Player {
    const p: Player = {
      id: nextId++,
      name: (name || "player").slice(0, 16),
      p: [...spawn] as Vec3, yaw: 0, pitch: 0,
      hp: 20, maxHp: 20, hunger: 20, dead: false,
      slots: emptyInv(), hungerT: 0, hurtCd: 0,
      socket: sock, lastMove: Date.now(),
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
    pl.p = [...spawn] as Vec3;
    pl.hp = pl.maxHp;
    pl.hunger = 20;
    pl.dead = false;
  }

  eat(pl: Player, slotIdx: number): boolean {
    const s = pl.slots[slotIdx];
    if (!s || s.id !== 104 || s.n <= 0) return false; // only raw pork for now (+4 hunger, heals 2)
    s.n -= 1;
    if (s.n <= 0) { s.id = 0; s.n = 0; }
    pl.hunger = Math.min(20, pl.hunger + 4);
    pl.hp = Math.min(pl.maxHp, pl.hp + 2);
    return true;
  }

  /** Hunger drains, starvation damages, regen when full. Returns true if vitals changed. */
  tick(dt: number): boolean {
    let changed = false;
    for (const pl of this.all.values()) {
      if (pl.hurtCd > 0) pl.hurtCd -= dt;
      if (pl.dead) continue;
      pl.hungerT += dt;
      if (pl.hungerT > 12) {
        pl.hungerT = 0;
        if (pl.hunger > 0) {
          pl.hunger -= 1;
          changed = true;
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
