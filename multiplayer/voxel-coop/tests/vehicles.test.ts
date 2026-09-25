import { B } from "../server/protocol.ts";
import { VehicleSim } from "../server/vehicles.ts";
import type { World } from "../server/world.ts";

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("steam locomotive follows rails and pulls a cart", async () => {
  const path = await Deno.makeTempFile({ prefix: "voxel-loco-", suffix: ".json" });
  try {
    const world = {
      get(x: number, y: number, z: number) {
        return y === 10 && x >= 0 && x <= 6 && z === 0 ? B.RAIL : B.STONE;
      },
    } as unknown as World;
    const sim = new VehicleSim(path);
    const locomotive = sim.place("locomotive", [2.5, 10.55, 0.5], -Math.PI / 2);
    const cart = sim.place("cart", [1.5, 10.55, 0.5], -Math.PI / 2);
    check(locomotive && cart, "vehicle placement failed");
    locomotive.rider = 1;
    sim.refuel(locomotive.id, 10);
    check(sim.setControl(1, 1), "locomotive throttle was not accepted");
    for (let i = 0; i < 30; i++) sim.tick(0.1, world, () => {});
    check(locomotive.p[0] > 2.5, "locomotive did not move");
    check(cart.p[0] > 1.5, "cart was not pulled");
    check(locomotive.fuel < 10, "locomotive fuel did not burn");
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 20));
    await Deno.remove(path).catch(() => {});
  }
});
