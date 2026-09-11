// Server-side lifeforms: passive wanderers + night zombies that chase players.

import { B, MobWire, Vec3, WORLD_H } from "./protocol.ts";
import { World } from "./world.ts";

export interface Mob {
  id: number;
  kind: "pig" | "cow" | "chicken" | "sheep" | "zombie" | "skeleton" | "spider" | "ogre" | "villager" | "wolf" | "wisp";
  p: Vec3;
  hp: number;
  maxHp: number;
  owner?: string; // player name of tamer; undefined = wild (spawn leaves unset)
  dir: number; // yaw radians
  wanderT: number;
  atkCd: number;
  fleeT: number; // >0 while fleeing after being hurt (chickens sprint)
}

const STATS: Record<string, { hp: number; speed: number; dmg: number }> = {
  pig: { hp: 10, speed: 1.6, dmg: 0 },
  cow: { hp: 12, speed: 1.3, dmg: 0 },
  chicken: { hp: 5, speed: 2.8, dmg: 0 },
  sheep: { hp: 10, speed: 1.5, dmg: 0 },
  zombie: { hp: 20, speed: 2.6, dmg: 3 },
  skeleton: { hp: 14, speed: 3.0, dmg: 3 },
  spider: { hp: 12, speed: 3.4, dmg: 2 },
  ogre: { hp: 90, speed: 1.9, dmg: 8 },
  villager: { hp: 20, speed: 1.2, dmg: 0 },
  wolf: { hp: 16, speed: 3.6, dmg: 4 },
  wisp: { hp: 8, speed: 4.2, dmg: 2 },
};

export function mobDrops(kind: string): { id: number; n: number }[] {
  // item ids reused from protocol (blocks as items, 104 pork, 105 wool, 106 feather)
  switch (kind) {
    case "pig": return [{ id: 104, n: 1 + Math.floor(Math.random() * 2) }];
    case "cow": {
      const drops = [{ id: 132, n: 1 + Math.floor(Math.random() * 2) }]; // raw beef
      if (Math.random() < 0.5) drops.push({ id: 105, n: 1 });
      return drops;
    }
    case "chicken": {
      const drops = [{ id: 134, n: 1 }]; // raw chicken
      if (Math.random() < 0.6) drops.push({ id: 106, n: 1 + Math.floor(Math.random() * 2) });
      return drops;
    }
    case "sheep": {
      const drops = [{ id: 105, n: 1 + Math.floor(Math.random() * 2) }];
      if (Math.random() < 0.5) drops.push({ id: 104, n: 1 }); // 0-1 pork
      return drops;
    }
    case "zombie": {
      const drops: { id: number; n: number }[] = [];
      if (Math.random() < 0.3) drops.push({ id: 102, n: 1 }); // coal
      if (Math.random() < 0.1) drops.push({ id: 103, n: 1 }); // iron ingot
      if (Math.random() < 0.05) drops.push({ id: 115, n: 1 }); // apple
      if (Math.random() < 0.02) drops.push({ id: 123, n: 1 }); // rare diamond
      return drops;
    }
    case "skeleton": {
      const drops: { id: number; n: number }[] = [{ id: 137, n: 1 + Math.floor(Math.random() * 2) }]; // bones
      if (Math.random() < 0.35) drops.push({ id: 138, n: 1 }); // string
      if (Math.random() < 0.04) drops.push({ id: 115, n: 1 });
      return drops;
    }
    case "spider": {
      const drops: { id: number; n: number }[] = [{ id: 138, n: 1 + Math.floor(Math.random() * 2) }]; // string
      if (Math.random() < 0.15) drops.push({ id: 104, n: 1 });
      return drops;
    }
    case "ogre": {
      return [
        { id: 123, n: 1 + Math.floor(Math.random() * 2) }, // diamonds
        { id: 133, n: 2 }, // steak feast
        { id: 137, n: 2 + Math.floor(Math.random() * 2) }, // bones
      ];
    }
    case "villager": return []; // peaceful trader; killing pays nothing
    case "wolf": return []; // sad, nothing
    case "wisp": {
      const drops: { id: number; n: number }[] = [{ id: 15, n: 2 }]; // torches
      if (Math.random() < 0.1) drops.push({ id: 144, n: 1 }); // emerald
      return drops;
    }
    default: return [];
  }
}

let nextId = 1;

export class MobSim {
  mobs = new Map<number, Mob>();
  peaceful = false;
  rain = 0; // 0..1, set by server tick — heavy rain shields undead from sun

  spawn(kind: Mob["kind"], x: number, y: number, z: number): Mob {
    const m: Mob = {
      id: nextId++, kind, p: [x, y, z],
      hp: STATS[kind].hp, maxHp: STATS[kind].hp,
      dir: Math.random() * Math.PI * 2, wanderT: 0, atkCd: 0, fleeT: 0,
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
    if (m.kind === "chicken") {
      m.fleeT = 3; // sprint away for 3s when hurt
      m.dir = Math.random() * Math.PI * 2;
    }
    return m;
  }

  /** Keep population around players: spawn passive by day, zombies at night. */
  maintain(world: World, players: Vec3[], night: boolean): void {
    // peaceful: no hostiles, evict any leftovers (e.g. after flag flip / dawn)
    if (this.peaceful) {
      for (const m of [...this.mobs.values()]) {
        if (m.kind === "zombie" || m.kind === "skeleton" || m.kind === "spider" || m.kind === "ogre" || m.kind === "wolf" || m.kind === "wisp" || m.kind === "villager") this.mobs.delete(m.id);
      }
    }
    const wantPassive = Math.min(12, players.length * 5);
    const wantZombie = !this.peaceful && night ? players.length * 2 : 0;
    const wantSkeleton = !this.peaceful && night ? players.length * 1 : 0;
    const wantSpider = !this.peaceful && night ? players.length * 2 : 0;
    const wantVillager = this.peaceful ? 0 : Math.min(2, players.length);
    const wantWolf = this.peaceful ? 0 : Math.min(3, players.length);
    const wantWisp = !this.peaceful && night ? players.length * 2 : 0;
    let passive = 0, zombies = 0, skeletons = 0, spiders = 0, ogres = 0;
    let villagers = 0, wolves = 0, wisps = 0;
    for (const m of this.mobs.values()) {
      if (m.kind === "zombie") zombies++;
      else if (m.kind === "skeleton") skeletons++;
      else if (m.kind === "spider") spiders++;
      else if (m.kind === "ogre") ogres++;
      else if (m.kind === "villager") villagers++;
      else if (m.kind === "wolf") wolves++;
      else if (m.kind === "wisp") wisps++;
      else passive++;
    }
    if (players.length === 0) return;
    const anchor = players[Math.floor(Math.random() * players.length)];
    const trySpawn = (kind: Mob["kind"] | "any-passive") => {
      const a = Math.random() * Math.PI * 2;
      const r = 12 + Math.random() * 14;
      const x = Math.round(anchor[0] + Math.cos(a) * r);
      const z = Math.round(anchor[2] + Math.sin(a) * r);
      const g = world.groundHeight(x, z);
      if (g < 2 || world.get(x, g, z) === 10) return; // don't spawn in ocean
      if (kind === "zombie" && g > 40) return;
      if (kind === "any-passive") {
        // biome-flavoured herds: sheep rule the snow, chickens the hot sands,
        // pigs + cows the green lands. Ground cover decides the pool.
        const gb = world.get(x, g, z);
        let pool: Mob["kind"][];
        if (gb === B.SNOW) pool = ["sheep", "sheep", "pig", "cow"];
        else if (gb === B.SAND) pool = ["chicken", "chicken", "pig", "sheep"];
        else pool = ["pig", "cow", "chicken", "sheep"];
        kind = pool[Math.floor(Math.random() * pool.length)];
      }
      this.spawn(kind, x + 0.5, g + 1.2, z + 0.5);
    };
    // spawn restricted to ground blocks (grass/plains etc.), any height
    const trySpawnOn = (kind: Mob["kind"], allowed: number[]) => {
      const a = Math.random() * Math.PI * 2;
      const r = 12 + Math.random() * 14;
      const x = Math.round(anchor[0] + Math.cos(a) * r);
      const z = Math.round(anchor[2] + Math.sin(a) * r);
      const g = world.groundHeight(x, z);
      if (g < 2 || world.get(x, g, z) === 10) return; // don't spawn in ocean
      if (!allowed.includes(world.get(x, g, z))) return;
      this.spawn(kind, x + 0.5, g + 1.2, z + 0.5);
    };
    // wisp: cave pocket below the surface, else surface fallback at night
    const trySpawnWisp = () => {
      if (Math.random() < 0.5) {
        const a = Math.random() * Math.PI * 2;
        const r = 8 + Math.random() * 16;
        const x = Math.round(anchor[0] + Math.cos(a) * r);
        const z = Math.round(anchor[2] + Math.sin(a) * r);
        const surf = world.groundHeight(x, z);
        for (let y = Math.min(surf - 2, WORLD_H - 3); y >= 2; y--) {
          if (world.get(x, y, z) === 10) continue; // no water pockets
          if (!world.isSolid(x, y, z) && !world.isSolid(x, y + 1, z) && world.isSolid(x, y - 1, z)) {
            this.spawn("wisp", x + 0.5, y, z + 0.5);
            return;
          }
        }
      }
      trySpawn("wisp");
    };
    if (passive < wantPassive) {
      trySpawn("any-passive");
    }
    if (zombies < wantZombie) trySpawn("zombie");
    if (skeletons < wantSkeleton) trySpawn("skeleton");
    if (spiders < wantSpider) trySpawn("spider");
    if (villagers < wantVillager) trySpawnOn("villager", [B.GRASS, B.SAND]);
    if (wolves < wantWolf) trySpawnOn("wolf", [B.GRASS]);
    if (wisps < wantWisp) trySpawnWisp();
    // 👹 ogre boss: max 1, rare nightly visitor once players are around
    if (night && !this.peaceful && ogres < 1 && players.length > 0 && Math.random() < 0.06) {
      trySpawn("ogre");
    }
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

  tick(dt: number, world: World, players: { p: Vec3; hurt: (dmg: number) => void; name?: string }[], night: boolean): void {
    const overcast = this.rain > 0.5;
    const HOSTILE = new Set(["zombie", "skeleton", "spider", "ogre"]);
    for (const m of [...this.mobs.values()]) {
      const st = STATS[m.kind];
      m.atkCd -= dt;
      // undead + wisps burn in daylight — unless it's raining (overcast shields them)
      if ((m.kind === "zombie" || m.kind === "skeleton" || m.kind === "wisp") && !night && !this.peaceful && !overcast && this.exposed(world, m)) {
        m.hp -= 2.5 * dt;
        if (m.hp <= 0) this.mobs.delete(m.id);
        continue;
      }
      const hostileNow = HOSTILE.has(m.kind) && (night || m.kind === "ogre" || m.hp < m.maxHp);
      // wolf: neutral by day — hostile (chase like zombie, range 16) only at night or when provoked
      const wolfHostile = m.kind === "wolf" && (night || m.hp < m.maxHp);
      // wisp: hostile at night + in darkness (caves/under cover) — chase range 20; by day wanders
      const wispHostile = m.kind === "wisp" && (night || !this.exposed(world, m));
      // spiders are day-neutral wanderers until provoked or night falls
      if ((HOSTILE.has(m.kind) && hostileNow) || wolfHostile || wispHostile) {
        // chase nearest player within 24 blocks (ogre smells you from 32)
        const range = m.kind === "ogre" ? 32 : m.kind === "wisp" ? 20 : m.kind === "wolf" ? 16 : 24;
        let best: { p: Vec3; hurt: (dmg: number) => void } | null = null;
        let bestD = range * range;
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
          let sp = st.speed;
          if (m.kind === "skeleton") {
            // strafing archer: sidestep while closing in
            const t = Date.now() / 1000 + m.id;
            const px = -dz / len, pz = dx / len;
            this.step(m, (dx / len) * sp * dt + px * Math.sin(t * 2) * sp * 0.5 * dt, (dz / len) * sp * dt + pz * Math.sin(t * 2) * sp * 0.5 * dt, world, 2);
          } else {
            this.step(m, (dx / len) * sp * dt, (dz / len) * sp * dt, world, m.kind === "spider" ? 3 : 2);
          }
          if (bestD < 2.6 && Math.abs(best.p[1] - m.p[1]) < 2.5 && m.atkCd <= 0) {
            m.atkCd = m.kind === "ogre" ? 1.6 : 1.0;
            best.hurt(st.dmg);
          }
        } else {
          this.wander(m, dt, world, st.speed * 0.4);
        }
      } else if (m.fleeT > 0) {
        // hurt chicken: sprint straight ahead, no idle pauses
        m.fleeT -= dt;
        const dx = -Math.sin(m.dir) * st.speed * 1.6 * dt;
        const dz = -Math.cos(m.dir) * st.speed * 1.6 * dt;
        this.step(m, dx, dz, world);
      } else {
        // villager = pure wander (never hostile, never flees); others wander too
        this.wander(m, dt, world, st.speed);
      }
      // tamed owner-follow: teleport when far, trail behind when near; wander if owner gone
      if (m.owner !== undefined) {
        const owner = players.find((pl) => (pl as { name?: string }).name === m.owner);
        if (owner && owner.p[1] >= -20) {
          const dx = owner.p[0] - m.p[0], dy = owner.p[1] - m.p[1], dz = owner.p[2] - m.p[2];
          const dist = Math.hypot(dx, dy, dz);
          if (dist > 30) {
            m.p[0] = owner.p[0]; m.p[1] = owner.p[1]; m.p[2] = owner.p[2];
          } else if (dist > 3) {
            const len = Math.hypot(dx, dz) || 1;
            const sp = st.speed * 1.2;
            m.dir = Math.atan2(-dx, -dz);
            this.step(m, (dx / len) * sp * dt, (dz / len) * sp * dt, world, 2);
          }
        } else {
          this.wander(m, dt, world, st.speed * 0.5);
        }
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

  private step(m: Mob, dx: number, dz: number, world: World, maxStep = 2): void {
    const nx = m.p[0] + dx, nz = m.p[2] + dz;
    const fromG = world.groundHeight(Math.floor(m.p[0]), Math.floor(m.p[2]));
    const toG = world.groundHeight(Math.floor(nx), Math.floor(nz));
    if (toG - fromG > maxStep) return; // wall: don't walk off cliffs / into cliffs
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
