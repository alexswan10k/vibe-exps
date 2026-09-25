import { B, VehicleKind, VehicleWire, Vec3 } from "./protocol.ts";
import { World } from "./world.ts";

export interface Vehicle {
  id: number;
  kind: VehicleKind;
  p: Vec3;
  yaw: number;
  rider: number;
  attachedTo: number;
  fuel: number;
  speed: number;
  control: number;
  cellX: number;
  cellY: number;
  cellZ: number;
  travelX: number;
  travelZ: number;
  nextX: number | null;
  nextY: number;
  nextZ: number | null;
}

interface SavedVehicle {
  id: number;
  kind: VehicleKind;
  p: Vec3;
  yaw: number;
  attachedTo?: number;
  fuel?: number;
  speed?: number;
  cellX?: number;
  cellY?: number;
  cellZ?: number;
  travelX?: number;
  travelZ?: number;
  nextX?: number | null;
  nextY?: number;
  nextZ?: number | null;
}

export const MAX_VEHICLES = 40;
export const LOCOMOTIVE_FUEL = 120;
export const LOCOMOTIVE_MAX_SPEED = 6;

let nextId = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function travelForYaw(yaw: number): [number, number] {
  const x = -Math.sin(yaw);
  const z = -Math.cos(yaw);
  return Math.abs(x) >= Math.abs(z) ? [Math.sign(x) || 1, 0] : [0, Math.sign(z) || 1];
}

export class VehicleSim {
  vehicles = new Map<number, Vehicle>();
  savePath: string;

  constructor(savePath: string) {
    this.savePath = savePath;
  }

  static async loadOrCreate(savePath: string): Promise<VehicleSim> {
    const v = new VehicleSim(savePath);
    try {
      const raw = await Deno.readTextFile(savePath);
      const d = JSON.parse(raw);
      for (const s of (d.vehicles ?? []) as SavedVehicle[]) {
        if ((s.kind !== "boat" && s.kind !== "cart" && s.kind !== "locomotive") ||
            !Array.isArray(s.p) || s.p.length !== 3 || !s.p.every(Number.isFinite)) continue;
        const id = Number.isInteger(s.id) && s.id > 0 ? s.id : nextId++;
        nextId = Math.max(nextId, id + 1);
        const yaw = Number.isFinite(s.yaw) ? s.yaw : 0;
        const travel = travelForYaw(yaw);
        const cellX = Number.isInteger(s.cellX) ? s.cellX! : Math.floor(s.p[0]);
        const cellZ = Number.isInteger(s.cellZ) ? s.cellZ! : Math.floor(s.p[2]);
        const cellY = Number.isInteger(s.cellY) ? s.cellY! : Math.floor(s.p[1]);
        const savedTravelX = s.travelX === travel[0] || s.travelX === -travel[0] ? s.travelX! : travel[0];
        const savedTravelZ = s.travelZ === travel[1] || s.travelZ === -travel[1] ? s.travelZ! : travel[1];
        v.vehicles.set(id, {
          id,
          kind: s.kind,
          p: [s.p[0], s.p[1], s.p[2]],
          yaw,
          rider: 0,
          attachedTo: Number.isInteger(s.attachedTo) ? s.attachedTo! : 0,
          fuel: s.kind === "locomotive" ? clamp(Number(s.fuel) || 0, 0, LOCOMOTIVE_FUEL) : 0,
          speed: s.kind === "locomotive" ? clamp(Number(s.speed) || 0, -LOCOMOTIVE_MAX_SPEED, LOCOMOTIVE_MAX_SPEED) : 0,
          control: 0,
          cellX,
          cellY,
          cellZ,
          travelX: savedTravelX,
          travelZ: savedTravelZ,
          nextX: Number.isInteger(s.nextX) ? s.nextX! : null,
          nextY: Number.isInteger(s.nextY) ? s.nextY! : cellY,
          nextZ: Number.isInteger(s.nextZ) ? s.nextZ! : null,
        });
      }
      console.log(`[vehicles] loaded ${v.vehicles.size} vehicles from ${savePath}`);
    } catch { /* first run */ }
    return v;
  }

  async save(): Promise<void> {
    try {
      await Deno.mkdir(this.savePath.split("/").slice(0, -1).join("/"), { recursive: true });
      const d = {
        vehicles: [...this.vehicles.values()].map((v) => ({
          id: v.id,
          kind: v.kind,
          p: v.p,
          yaw: v.yaw,
          attachedTo: v.attachedTo,
          fuel: v.fuel,
          speed: v.speed,
          cellX: v.cellX,
          cellY: v.cellY,
          cellZ: v.cellZ,
          travelX: v.travelX,
          travelZ: v.travelZ,
          nextX: v.nextX,
          nextY: v.nextY,
          nextZ: v.nextZ,
        })),
      };
      await Deno.writeTextFile(this.savePath, JSON.stringify(d));
    } catch (e) { console.error("[vehicles] save failed:", e); }
  }

  resetAll(): void {
    this.vehicles.clear();
    void this.save();
  }

  place(kind: VehicleKind, p: Vec3, yaw: number): Vehicle | null {
    if (this.vehicles.size >= MAX_VEHICLES) return null;
    const travel = travelForYaw(yaw);
    const v: Vehicle = {
      id: nextId++,
      kind,
      p: [...p] as Vec3,
      yaw,
      rider: 0,
      attachedTo: 0,
      fuel: 0,
      speed: 0,
      control: 0,
      cellX: Math.floor(p[0]),
      cellY: Math.floor(p[1]),
      cellZ: Math.floor(p[2]),
      travelX: travel[0],
      travelZ: travel[1],
      nextX: null,
      nextY: Math.floor(p[1]),
      nextZ: null,
    };
    this.vehicles.set(v.id, v);
    void this.save();
    return v;
  }

  remove(id: number): Vehicle | undefined {
    const v = this.vehicles.get(id);
    if (v) {
      this.vehicles.delete(id);
      for (const cart of this.vehicles.values()) if (cart.attachedTo === id) cart.attachedTo = 0;
      void this.save();
    }
    return v;
  }

  byRider(playerId: number): Vehicle | undefined {
    for (const v of this.vehicles.values()) {
      if (v.rider === playerId) return v;
    }
    return undefined;
  }

  setControl(playerId: number, throttle: number): boolean {
    const v = this.byRider(playerId);
    if (!v || v.kind !== "locomotive" || ![-1, 0, 1].includes(throttle)) return false;
    v.control = throttle;
    return true;
  }

  nearestLocomotive(p: Vec3, radius: number): Vehicle | null {
    let best: Vehicle | null = null;
    let bestD = radius * radius;
    for (const v of this.vehicles.values()) {
      if (v.kind !== "locomotive") continue;
      const d = (v.p[0] - p[0]) ** 2 + (v.p[1] - p[1]) ** 2 + (v.p[2] - p[2]) ** 2;
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  }

  refuel(id: number, seconds: number): number {
    const v = this.vehicles.get(id);
    if (!v || v.kind !== "locomotive") return 0;
    v.fuel = clamp(v.fuel + Math.max(0, seconds), 0, LOCOMOTIVE_FUEL);
    void this.save();
    return v.fuel;
  }

  tick(dt: number, world: World, onUpdate: (vehicle: Vehicle) => void): void {
    for (const v of this.vehicles.values()) {
      if (v.kind !== "locomotive") continue;
      const active = v.rider !== 0 && v.control !== 0;
      for (const cart of this.vehicles.values()) if (cart.attachedTo === v.id) cart.attachedTo = 0;
      if (active && v.fuel > 0) v.fuel = Math.max(0, v.fuel - dt);
      const target = active && v.fuel > 0
        ? v.control * (v.control > 0 ? LOCOMOTIVE_MAX_SPEED : LOCOMOTIVE_MAX_SPEED * 0.55)
        : 0;
      v.speed += (target - v.speed) * Math.min(1, dt * 1.8);
      if (Math.abs(v.speed) < 0.02) v.speed = 0;
      const touched = this.moveLocomotive(v, dt, world);
      if (v.rider !== 0) onUpdate(v);
      for (const cart of touched) if (cart.rider !== 0) onUpdate(cart);
    }
  }

  private railYAt(world: World, x: number, z: number, nearY: number): number {
    for (let y = Math.floor(nearY) + 1; y >= Math.floor(nearY) - 3; y--) {
      if (world.get(x, y, z) === B.RAIL) return y;
    }
    return -1;
  }

  private vehicleAtCell(x: number, z: number, exceptId: number): Vehicle | undefined {
    for (const v of this.vehicles.values()) {
      if (v.id !== exceptId && Math.floor(v.p[0]) === x && Math.floor(v.p[2]) === z) return v;
    }
    return undefined;
  }

  private cartAtCell(x: number, z: number): Vehicle | undefined {
    for (const v of this.vehicles.values()) {
      if (v.kind === "cart" && Math.floor(v.p[0]) === x && Math.floor(v.p[2]) === z) return v;
    }
    return undefined;
  }

  private ensureCell(v: Vehicle, world: World): boolean {
    const y = this.railYAt(world, v.cellX, v.cellZ, v.p[1]);
    if (y < 0) {
      const x = Math.floor(v.p[0]);
      const z = Math.floor(v.p[2]);
      const found = this.railYAt(world, x, z, v.p[1]);
      if (found < 0) { v.speed = 0; return false; }
      v.cellX = x; v.cellY = found; v.cellZ = z;
      v.p[0] = x + 0.5;
      v.p[2] = z + 0.5;
    } else {
      v.cellY = y;
    }
    if (v.nextX === null && v.nextZ === null && Math.abs(v.speed) < 0.01) {
      v.p[0] = v.cellX + 0.5;
      v.p[2] = v.cellZ + 0.5;
    }
    v.p[1] = v.cellY + 0.55;
    return true;
  }

  private chooseNext(v: Vehicle, world: World): boolean {
    const sign = v.speed >= 0 ? 1 : -1;
    const preferred: [number, number] = [v.travelX * sign, v.travelZ * sign];
    const candidates: [number, number][] = [
      preferred,
      [-preferred[1], preferred[0]],
      [preferred[1], -preferred[0]],
    ];
    for (const [dx, dz] of candidates) {
      const nx = v.cellX + dx;
      const nz = v.cellZ + dz;
      if (world.get(nx, v.cellY, nz) !== B.RAIL) continue;
      if (this.vehicleAtCell(nx, nz, v.id)) continue;
      v.nextX = nx;
      v.nextY = v.cellY;
      v.nextZ = nz;
      v.travelX = dx;
      v.travelZ = dz;
      v.yaw = Math.atan2(-dx, -dz);
      return true;
    }
    return false;
  }

  private pullCarts(v: Vehicle, fromX: number, fromZ: number, toX: number, toZ: number, railY: number): Vehicle[] {
    const dx = toX - fromX;
    const dz = toZ - fromZ;
    const chain: Vehicle[] = [];
    let x = fromX - dx;
    let z = fromZ - dz;
    for (let i = 0; i < 16; i++) {
      const cart = this.cartAtCell(x, z);
      if (!cart) break;
      chain.push(cart);
      x -= dx;
      z -= dz;
    }
    for (let i = 0; i < chain.length; i++) {
      const cart = chain[i];
      const tx = fromX - dx * i;
      const tz = fromZ - dz * i;
      cart.p = [tx + 0.5, railY + 0.55, tz + 0.5];
      cart.attachedTo = v.id;
      cart.cellX = tx;
      cart.cellY = railY;
      cart.cellZ = tz;
      cart.travelX = dx;
      cart.travelZ = dz;
      cart.nextX = null;
      cart.nextY = railY;
      cart.nextZ = null;
      cart.yaw = Math.atan2(-dx, -dz);
      cart.speed = v.speed;
    }
    return chain;
  }

  private moveLocomotive(v: Vehicle, dt: number, world: World): Vehicle[] {
    if (!this.ensureCell(v, world)) return [];
    let remaining = Math.abs(v.speed) * dt;
    const touched = new Set<Vehicle>();
    while (remaining > 0.0001) {
      if (v.nextX === null || v.nextZ === null) {
        if (!this.chooseNext(v, world)) { v.speed = 0; break; }
      }
      const nextX = v.nextX;
      const nextZ = v.nextZ;
      if (nextX === null || nextZ === null) { v.speed = 0; break; }
      const targetX = nextX + 0.5;
      const targetZ = nextZ + 0.5;
      const dx = targetX - v.p[0];
      const dz = targetZ - v.p[2];
      const distance = Math.hypot(dx, dz);
      if (distance < 0.0001) {
        const fromX = v.cellX;
        const fromZ = v.cellZ;
        const railY = v.nextY;
        v.cellX = nextX;
        v.cellY = railY;
        v.cellZ = nextZ;
        v.p[0] = targetX;
        v.p[1] = railY + 0.55;
        v.p[2] = targetZ;
        for (const cart of this.pullCarts(v, fromX, fromZ, v.cellX, v.cellZ, railY)) touched.add(cart);
        v.nextX = null;
        v.nextZ = null;
        continue;
      }
      const step = Math.min(remaining, distance);
      v.p[0] += dx / distance * step;
      v.p[2] += dz / distance * step;
      v.p[1] = v.cellY + 0.55;
      remaining -= step;
      if (step >= distance - 0.0001) {
        const fromX = v.cellX;
        const fromZ = v.cellZ;
        const railY = v.nextY;
        v.cellX = nextX;
        v.cellY = railY;
        v.cellZ = nextZ;
        v.p[0] = targetX;
        v.p[1] = railY + 0.55;
        v.p[2] = targetZ;
        for (const cart of this.pullCarts(v, fromX, fromZ, v.cellX, v.cellZ, railY)) touched.add(cart);
        v.nextX = null;
        v.nextZ = null;
      }
    }
    return [...touched];
  }

  wire(): VehicleWire[] {
    return [...this.vehicles.values()].map((v) => ({
      id: v.id,
      kind: v.kind,
      p: [Math.round(v.p[0] * 20) / 20, Math.round(v.p[1] * 20) / 20, Math.round(v.p[2] * 20) / 20],
      yaw: Math.round(v.yaw * 100) / 100,
      rider: v.rider,
      ...(v.kind === "locomotive" ? { fuel: Math.ceil(v.fuel), speed: Math.round(v.speed * 10) / 10 } : {}),
    }));
  }
}
