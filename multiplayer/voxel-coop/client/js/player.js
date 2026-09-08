// First-person controller: pointer lock, WASD, AABB collision vs WorldClient.
import { B } from "./config.js";

export const GRAVITY = 28;
export const JUMP = 9.5;
export const SPEED = 4.6;
export const EYE = 1.62;
const RADIUS = 0.32;

export class Player {
  constructor(camera, dom) {
    this.cam = camera;
    this.dom = dom;
    this.pos = new THREE.Vector3(0.5, 30, 0.5); // feet
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.keys = {};
    this.locked = false;
    this.onGround = false;
    this.fallStart = null;
    this.onFallDamage = null; // (amount) => void — server owns hp, client predicts
    this.onLockChange = null; // (locked) => void
    this.euler = new THREE.Euler(0, 0, 0, "YXZ");

    document.addEventListener("keydown", (e) => {
      if (document.activeElement && document.activeElement.tagName === "INPUT") return;
      this.keys[e.code] = true;
      if (["Space", "ArrowUp"].includes(e.code)) e.preventDefault();
    });
    document.addEventListener("keyup", (e) => { this.keys[e.code] = false; });
    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch));
    });
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.dom;
      this.onLockChange?.(this.locked);
    });
  }

  lock() {
    // no-op on touch devices (no pointer lock API)
    if (typeof this.dom.requestPointerLock !== "function") return false;
    if (document.pointerLockElement === this.dom) return true;
    try {
      const r = this.dom.requestPointerLock();
      if (r && typeof r.catch === "function") r.catch(() => {});
    } catch { /* must be called from a user gesture; canvas click retries */ }
    return true;
  }

  eye() {
    return new THREE.Vector3(this.pos.x, this.pos.y + EYE, this.pos.z);
  }

  lookDir() {
    const d = new THREE.Vector3(0, 0, -1);
    d.applyEuler(this.euler.set(this.pitch, this.yaw, 0));
    return d;
  }

  collides(world, x, y, z) {
    // AABB feet..feet+1.8, radius RADIUS. Unknown chunks (undefined) = non-solid.
    const minX = Math.floor(x - RADIUS), maxX = Math.floor(x + RADIUS);
    const minY = Math.floor(y), maxY = Math.floor(y + 1.8);
    const minZ = Math.floor(z - RADIUS), maxZ = Math.floor(z + RADIUS);
    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          const b = world.get(bx, by, bz);
          if (b === undefined) continue;
          if (b !== B.AIR && b !== B.WATER) {
            // precise AABB overlap: block box vs player box
            const px0 = x - RADIUS, px1 = x + RADIUS;
            const py0 = y, py1 = y + 1.8;
            const pz0 = z - RADIUS, pz1 = z + RADIUS;
            if (bx + 1 > px0 && bx < px1 && by + 1 > py0 && by < py1 && bz + 1 > pz0 && bz < pz1) {
              return b;
            }
          }
        }
      }
    }
    return 0;
  }

  inWater(world) {
    const b = world.get(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.4), Math.floor(this.pos.z));
    return b === B.WATER;
  }

  update(dt, world) {
    // sync camera
    this.euler.set(this.pitch, this.yaw, 0);
    this.cam.quaternion.setFromEuler(this.euler);
    this.cam.position.copy(this.eye());

    const f = (this.keys.KeyW ? 1 : 0) - (this.keys.KeyS ? 1 : 0);
    const s = (this.keys.KeyD ? 1 : 0) - (this.keys.KeyA ? 1 : 0);
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let dx = (-sin * f + cos * s);
    let dz = (-cos * f - sin * s);
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    const moving = f !== 0 || s !== 0;

    const water = this.inWater(world);
    const maxSp = moving ? SPEED * (water ? 0.5 : 1) * (this.keys.ShiftLeft ? 1.5 : 1) : 0;
    const accel = this.onGround ? 14 : 4;
    this.vel.x += (dx * maxSp - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (dz * maxSp - this.vel.z) * Math.min(1, accel * dt);

    if (water) {
      this.vel.y += ((-2 - this.vel.y)) * Math.min(1, 6 * dt);
      if (this.keys.Space) this.vel.y = 3.5;
    } else {
      this.vel.y -= GRAVITY * dt;
      if (this.vel.y < -28) this.vel.y = -28;
      if (this.keys.Space && this.onGround) {
        this.vel.y = JUMP;
        this.onGround = false;
      }
    }

    // integrate axis by axis (3 substeps to avoid tunneling)
    const steps = 3;
    for (let i = 0; i < steps; i++) {
      const sdt = dt / steps;
      const ox = this.pos.x;
      this.pos.x += this.vel.x * sdt;
      if (this.collides(world, this.pos.x, this.pos.y, this.pos.z)) {
        this.pos.x = ox;
        this.vel.x = 0;
      }
      const oz = this.pos.z;
      this.pos.z += this.vel.z * sdt;
      if (this.collides(world, this.pos.x, this.pos.y, this.pos.z)) {
        this.pos.z = oz;
        this.vel.z = 0;
      }
      const oy = this.pos.y;
      this.pos.y += this.vel.y * sdt;
      const hit = this.collides(world, this.pos.x, this.pos.y, this.pos.z);
      if (hit) {
        if (this.vel.y < 0) {
          // snap feet onto the block top, fall back to last safe pos
          const snapped = Math.floor(this.pos.y) + 1.002;
          this.pos.y = this.collides(world, this.pos.x, snapped, this.pos.z) ? oy : snapped;
          this.onGround = true;
          // fall damage
          if (this.fallStart !== null) {
            const fall = this.fallStart - this.pos.y;
            this.fallStart = null;
            if (fall > 4 && this.onFallDamage) this.onFallDamage(Math.floor(fall - 3));
          }
        } else {
          this.pos.y = oy;
        }
        this.vel.y = 0;
      } else if (this.vel.y < -1) {
        this.onGround = false;
        if (this.fallStart === null) this.fallStart = oy;
      }
    }

    if (this.pos.y < -40) {
      this.pos.set(0.5, 32, 0.5);
      this.vel.set(0, 0, 0);
    }
  }
}
