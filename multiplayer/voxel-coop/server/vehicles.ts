// Rideable vehicles: boats (fast water travel) + minecarts (rail gliders).
// Movement is rider-driven (the rider's move messages carry both), so the sim
// is a dumb-but-authoritative registry: placement validation, occupancy,
// break-to-item, persistence. Tick-free; snapshots broadcast by server/main.ts.

import { VehicleKind, VehicleWire, Vec3 } from "./protocol.ts";

export interface Vehicle {
  id: number;
  kind: VehicleKind;
  p: Vec3;
  yaw: number;
  rider: number; // player id, 0 = free
}

export const MAX_VEHICLES = 40;

let nextId = 1;

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
      for (const s of (d.vehicles ?? []) as { id: number; kind: VehicleKind; p: Vec3; yaw: number }[]) {
        if ((s.kind === "boat" || s.kind === "cart") && Array.isArray(s.p) && s.p.length === 3 && s.p.every(Number.isFinite)) {
          const id = Number.isInteger(s.id) && s.id > 0 ? s.id : nextId++;
          nextId = Math.max(nextId, id + 1);
          v.vehicles.set(id, { id, kind: s.kind, p: [s.p[0], s.p[1], s.p[2]], yaw: Number.isFinite(s.yaw) ? s.yaw : 0, rider: 0 });
        }
      }
      console.log(`[vehicles] loaded ${v.vehicles.size} vehicles from ${savePath}`);
    } catch { /* first run */ }
    return v;
  }

  async save(): Promise<void> {
    try {
      await Deno.mkdir(this.savePath.split("/").slice(0, -1).join("/"), { recursive: true });
      const d = {
        vehicles: [...this.vehicles.values()].map((v) => ({ id: v.id, kind: v.kind, p: v.p, yaw: v.yaw })),
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
    const v: Vehicle = { id: nextId++, kind, p: [...p] as Vec3, yaw, rider: 0 };
    this.vehicles.set(v.id, v);
    void this.save();
    return v;
  }

  remove(id: number): Vehicle | undefined {
    const v = this.vehicles.get(id);
    if (v) {
      this.vehicles.delete(id);
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

  wire(): VehicleWire[] {
    return [...this.vehicles.values()].map((v) => ({
      id: v.id, kind: v.kind,
      p: [Math.round(v.p[0] * 20) / 20, Math.round(v.p[1] * 20) / 20, Math.round(v.p[2] * 20) / 20],
      yaw: Math.round(v.yaw * 100) / 100, rider: v.rider,
    }));
  }
}
