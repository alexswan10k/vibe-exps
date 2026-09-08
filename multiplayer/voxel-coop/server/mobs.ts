// Server-side lifeforms: passive wanderers + night zombies that chase players.

import { MobWire, Vec3, WORLD_H } from "./protocol.ts";
import { World } from "./world.ts";

export interface Mob {
  id: number;
  kind: "pig" | "cow" | "chicken" | "sheep" | "zombie";
  p: Vec3;
  hp: number;
  maxHp: number;
  dir: number; // yaw radians
  wanderT: number;
  atkCd: number;
}

const STATS: Record<string, { hp: number; speed: number; dmg: number }> = {
  pig: { hp: 10, speed: 1.6, dmg: 0 },
  cow: { hp: 12, speed: 1.3, dmg: 0 },
  chicken: { hp: 5, speed: 2.2, dmg: 0 },
  sheep: { hp: 10, speed: 1.5, dmg: 0 },
  zombie: { hp: 20, speed: 2.6, dmg: 3 },
};

export function mobDrops(kind: string): { id: number; n: number }[] {
  // item ids reused from protocol (blocks as items, 104 pork, 105 wool, 106 feather)
  switch (kind) {
    case "pig": return [{ id: 104, n: 1 + Math.floor(Math.random() * 2) }];
    case "cow": return [{ id: 104, n: 1 }];
    case "chicken": return [{ id: 106, n: 1 + Math.floor(Math.random() * 2) }];
    case "sheep": return [{ id: 105, n: 1 + Math.floor(Math.random() * 2) }];
    case "zombie": return Math.random() < 0.3 ? [{ id: 102, n: 1 }] : [];
    default: return [];
  }
}

let nextId = 1;

export class MobSim {
  mobs = new Map<number, Mob>();
  peaceful = false;

  spawn(kind: Mob["kind"], x: number, y: number, z: number): Mob {
    const m: Mob = {
      id: nextId++, kind, p: [x, y, z],
      hp: STATS[kind].hp, maxHp: STATS[kind].hp,
      dir: Math.random() * Math.PI * 2, wanderT: 0, atkCd: 0,
    };
    this.mobs.set(m.id, m);
    return m;
  }

  hurt(id: number, dmg: number): Mob | undefined {
    const m = this.mobs.get(id);
    if (!m) return undefined;
    m.hp -= dmg;
    if (m.hp <= 0) {
      this.mobs.delete(id);
      return undefined; // died
    }
    return m;
  }

  /** Keep population around players: spawn passive by day, zombies at night. */
  maintain(world: World, players: Vec3[], night: boolean): void {
    // peaceful: no zombies, evict any leftovers (e.g. after flag flip / dawn)
    if (this.peaceful) {
      for (const m of [...this.mobs.values()]) {
        if (m.kind === "zombie") this.mobs.delete(m.id);
      }
    }
    const wantPassive = Math.min(10, players.length * 5);
    const wantZombie = !this.peaceful && night ? players.length * 3 : 0;
    let passive = 0, zombies = 0;
    for (const m of this.mobs.values()) {
      if (m.kind === "zombie") zombies++;
      else passive++;
    }
    if (players.length === 0) return;
    const anchor = players[Math.floor(Math.random() * players.length)];
    const trySpawn = (kind: Mob["kind"]) => {
      const a = Math.random() * Math.PI * 2;
      const r = 12 + Math.random() * 14;
      const x = Math.round(anchor[0] + Math.cos(a) * r);
      const z = Math.round(anchor[2] + Math.sin(a) * r);
      const g = world.groundHeight(x, z);
      if (g < 2 || world.get(x, g, z) === 10) return; // don't spawn in ocean
      if (kind === "zombie" && g > 40) return;
      this.spawn(kind, x + 0.5, g + 1.2, z + 0.5);
    };
    if (passive < wantPassive) {
      const kinds = ["pig", "cow", "chicken", "sheep"] as const;
      trySpawn(kinds[Math.floor(Math.random() * kinds.length)]);
    }
    if (zombies < wantZombie) trySpawn("zombie");
    // despawn strays far from everyone
    for (const m of [...this.mobs.values()]) {
      let near = false;
      for (const p of players) {
        const dx = m.p[0] - p[0], dz = m.p[2] - p[2];
        if (dx * dx + dz * dz < 80 * 80) { near = true; break; }
      }
      if (!near) this.mobs.delete(m.id);
    }
  }

  /** Exposed to open sky? (for zombie sunburn) */
  exposed(world: World, m: Mob): boolean {
    const x = Math.floor(m.p[0]), z = Math.floor(m.p[2]);
    for (let y = Math.floor(m.p[1]) + 1; y < WORLD_H; y++) {
      if (world.isSolid(x, y, z)) return false;
    }
    return true;
  }

  tick(dt: number, world: World, players: { p: Vec3; hurt: (dmg: number) => void }[], night: boolean): void {
    for (const m of [...this.mobs.values()]) {
      const st = STATS[m.kind];
      m.atkCd -= dt;
      // zombies burn in daylight (no drops — only player kills pay out)
      if (m.kind === "zombie" && !night && !this.peaceful && this.exposed(world, m)) {
        m.hp -= 2.5 * dt;
        if (m.hp <= 0) this.mobs.delete(m.id);
        continue;
      }
      if (m.kind === "zombie") {
        // chase nearest player within 24 blocks
        let best: { p: Vec3; hurt: (dmg: number) => void } | null = null;
        let bestD = 24 * 24;
        for (const pl of players) {
          if (pl.p[1] < -20) continue;
          const dx = pl.p[0] - m.p[0], dz = pl.p[2] - m.p[2];
          const d = dx * dx + dz * dz;
          if (d < bestD) { bestD = d; best = pl; }
        }
        if (best) {
          const dx = best.p[0] - m.p[0], dz = best.p[2] - m.p[2];
          const len = Math.hypot(dx, dz) || 1;
          m.dir = Math.atan2(-dx, -dz);
          this.step(m, (dx / len) * st.speed * dt, (dz / len) * st.speed * dt, world);
          if (bestD < 2.6 && Math.abs(best.p[1] - m.p[1]) < 2.5 && m.atkCd <= 0) {
            m.atkCd = 1.0;
            best.hurt(st.dmg);
          }
        } else {
          this.wander(m, dt, world, st.speed * 0.4);
        }
      } else {
        this.wander(m, dt, world, st.speed);
      }
      // gravity: sit on ground
      const g = world.groundHeight(Math.floor(m.p[0]), Math.floor(m.p[2]));
      const targetY = g + 1.1;
      m.p[1] += (targetY - m.p[1]) * Math.min(1, dt * 8);
    }
  }

  private wander(m: Mob, dt: number, world: World, speed: number): void {
    m.wanderT -= dt;
    if (m.wanderT <= 0) {
      m.wanderT = 2 + Math.random() * 4;
      if (Math.random() < 0.55) m.dir = Math.random() * Math.PI * 2;
      else m.dir = m.dir; // idle this cycle
    }
    if (Math.random() < 0.5) return; // idle half the time
    const dx = -Math.sin(m.dir) * speed * dt;
    const dz = -Math.cos(m.dir) * speed * dt;
    this.step(m, dx, dz, world);
  }

  private step(m: Mob, dx: number, dz: number, world: World): void {
    const nx = m.p[0] + dx, nz = m.p[2] + dz;
    const fromG = world.groundHeight(Math.floor(m.p[0]), Math.floor(m.p[2]));
    const toG = world.groundHeight(Math.floor(nx), Math.floor(nz));
    if (toG - fromG > 2) return; // wall: don't walk off cliffs / into cliffs
    if (world.get(Math.round(nx), Math.round(m.p[1]), Math.round(nz)) === 10) return; // avoid water
    m.p[0] = nx; m.p[2] = nz;
  }

  wire(): MobWire[] {
    return [...this.mobs.values()].map((m) => ({
      id: m.id, kind: m.kind,
      p: [Math.round(m.p[0] * 20) / 20, Math.round(m.p[1] * 20) / 20, Math.round(m.p[2] * 20) / 20],
      hp: Math.max(0, Math.ceil(m.hp)), maxHp: m.maxHp,
    }));
  }
}
