// First-person controller: pointer lock, WASD, AABB collision vs WorldClient.
import { B, WALK_THROUGH } from "./config.js";

export const GRAVITY = 28;
export const JUMP = 9.5;
export const SPEED = 4.6;
export const SPEED_SPRINT = 6.9;
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
    this.sprinting = false;
    this._now = 0;
    this.lastGroundT = -10;
    this.jumpBufT = -10;
    this.fallStart = null;
    this.onFallDamage = null; // (amount) => void — server owns hp, client predicts
    this.onLockChange = null; // (locked) => void
    this.flying = false; // creative flight (double-Space toggles, server gamemode gates damage)
    this.sailing = false; // riding a boat (server ride msg drives this)
    this.ridingCart = false; // riding a minecart (glides along rails)
    this.cartAxis = null; // 'x' | 'z' while on connected rails
    this.cartDir = 1; // travel sign along the axis
    this._lastSpace = -10;
    this._prevSpace = false; // Space state last frame (edge-detect for swim jump)
    this.euler = new THREE.Euler(0, 0, 0, "YXZ");

    document.addEventListener("keydown", (e) => {
      if (document.activeElement && document.activeElement.tagName === "INPUT") return;
      this.keys[e.code] = true;
      if (e.code === "Space") {
        // double-tap Space toggles creative flight (server still gates damage/loot)
        if (this._now - this._lastSpace < 0.32 && window.voxCreative) {
          this.flying = !this.flying;
          this.vel.set(0, 0, 0);
          this.fallStart = null;
          try { window.voxUI?.hint?.(this.flying ? "✨ flying (double-Space to land)" : "walking"); } catch { /* noop */ }
        }
        this._lastSpace = this._now;
        this.jumpBufT = this._now;
      }
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
          if (b !== B.AIR && b !== B.WATER && b !== B.LAVA && b !== B.LADDER && !WALK_THROUGH.has(b)) {
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

  onLadder(world) {
    const xi = Math.floor(this.pos.x), zi = Math.floor(this.pos.z);
    for (const y of [Math.floor(this.pos.y), Math.floor(this.pos.y + 1.2)]) {
      if (world.get(xi, y, zi) === B.LADDER) return true;
    }
    return false;
  }

  update(dt, world) {
    // sync camera
    this._now += dt;
    // Edge-detect Space here (not in the keydown handler): touch buttons and
    // key-repeat never fire keydown, so the handler's jumpBufT can't be the
    // swim-jump signal — keys.Space state is the only thing all inputs share.
    const spaceDown = !!this.keys.Space;
    const spacePressed = spaceDown && !this._prevSpace;
    this._prevSpace = spaceDown;
    if (this.onGround) this.lastGroundT = this._now;
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

    if (this.flying && window.voxCreative) {
      // creative flight: Space up, Shift down, fast + no collision damage
      const up = (this.keys.Space ? 1 : 0) - ((this.keys.ShiftLeft || this.keys.ShiftRight) ? 1 : 0);
      const spd = 11;
      this.vel.x += (dx * spd - this.vel.x) * Math.min(1, 8 * dt);
      this.vel.z += (dz * spd - this.vel.z) * Math.min(1, 8 * dt);
      this.vel.y += (up * 9 - this.vel.y) * Math.min(1, 8 * dt);
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
      this.pos.y += this.vel.y * dt;
      // light collision: stop on walls but never stick
      if (this.collides(world, this.pos.x, this.pos.y, this.pos.z)) {
        this.pos.x -= this.vel.x * dt;
        this.pos.z -= this.vel.z * dt;
        this.pos.y -= this.vel.y * dt;
        this.vel.multiplyScalar(0.3);
      }
      this.sprinting = false;
      this.onGround = false;
      this.fallStart = null;
      if (this.pos.y < -40) { this.pos.y = 32; this.vel.set(0, 0, 0); }
      return;
    }
    if (!window.voxCreative) this.flying = false;

    const water = this.inWater(world);
    // Waterline zone: feet out of the water but the surface within reach
    // (water just below the feet). Swim physics + the shore assist stay live
    // through the breach — otherwise upward velocity dies the instant
    // inWater() goes false and a 1-high bank is unclimbable.
    const swimUp = spaceDown && moving && !this.sailing && !this.ridingCart &&
      world.get(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.2), Math.floor(this.pos.z)) === B.WATER;
    const ladder = !water && !swimUp && !this.sailing && !this.ridingCart && this.onLadder(world);
    const sprintKey = this.keys.ShiftLeft || this.keys.ShiftRight;
    this.sprinting = !!(sprintKey && moving && this.onGround && !ladder && !this.sailing && !this.ridingCart);
    const base = sprintKey ? SPEED_SPRINT : SPEED;
    const maxSp = moving ? base * (water ? 0.5 : 1) : 0;
    const accel = this.onGround ? 14 : 4;
    this.vel.x += (dx * maxSp - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (dz * maxSp - this.vel.z) * Math.min(1, accel * dt);

    if (this.sailing) {
      // boat: fast on water, sluggish on land; floats at the surface, no gravity
      const wx = Math.floor(this.pos.x), wz = Math.floor(this.pos.z);
      let surf = null;
      for (let dy = 1; dy >= -3; dy--) {
        if (world.get(wx, Math.floor(this.pos.y) + dy, wz) === B.WATER) {
          surf = Math.floor(this.pos.y) + dy + 1;
          break;
        }
      }
      const spd = (sprintKey ? 10.5 : 7.5) * (surf !== null ? 1 : 0.35);
      const maxSp = moving ? spd : 0;
      this.vel.x += (dx * maxSp - this.vel.x) * Math.min(1, 8 * dt);
      this.vel.z += (dz * maxSp - this.vel.z) * Math.min(1, 8 * dt);
      const targetY = surf !== null ? surf + 0.32 : this.pos.y;
      this.vel.y += ((targetY - this.pos.y) * 10 - this.vel.y) * Math.min(1, 10 * dt);
      this.sprinting = !!(sprintKey && moving);
      this.onGround = false;
      this.fallStart = null;
    } else if (this.ridingCart) {
      // minecart: throttle along the rail axis with momentum, brake/reverse on S
      const xi = Math.floor(this.pos.x), zi = Math.floor(this.pos.z);
      let railY = null;
      for (let dy = 1; dy >= -2; dy--) {
        if (world.get(xi, Math.floor(this.pos.y) + dy, zi) === B.RAIL) {
          railY = Math.floor(this.pos.y) + dy;
          break;
        }
      }
      let ax = this.cartAxis;
      if (railY !== null) {
        const xConn = world.get(xi + 1, railY, zi) === B.RAIL || world.get(xi - 1, railY, zi) === B.RAIL;
        const zConn = world.get(xi, railY, zi + 1) === B.RAIL || world.get(xi, railY, zi - 1) === B.RAIL;
        if (xConn && !zConn) ax = "x";
        else if (zConn && !xConn) ax = "z";
        this.cartAxis = ax;
      }
      const fwx = -Math.sin(this.yaw), fwz = -Math.cos(this.yaw);
      if (ax === "x" && Math.abs(fwx) > 0.3) this.cartDir = Math.sign(fwx);
      else if (ax === "z" && Math.abs(fwz) > 0.3) this.cartDir = Math.sign(fwz);
      const MAXV = 9;
      let tvx = 0, tvz = 0;
      if (f !== 0 && ax && railY !== null) {
        if (ax === "x") tvx = this.cartDir * f * MAXV;
        else tvz = this.cartDir * f * MAXV;
      }
      const k = Math.min(1, (f !== 0 ? 3.5 : 1.4) * dt);
      this.vel.x += (tvx - this.vel.x) * k;
      this.vel.z += (tvz - this.vel.z) * k;
      if (!ax || railY === null) { // derailed: roll to a stop
        this.vel.x *= Math.pow(0.05, dt);
        this.vel.z *= Math.pow(0.05, dt);
      }
      const targetY = railY !== null ? railY + 0.55 : this.pos.y;
      this.vel.y += ((targetY - this.pos.y) * 12 - this.vel.y) * Math.min(1, 12 * dt);
      this.sprinting = false;
      this.onGround = false;
      this.fallStart = null;
    } else if (ladder) {
      // climb: Space up, Shift sneak down, else grip (no fall)
      this.vel.y += (((this.keys.Space ? 3.2 : 0) + (sprintKey ? -2.5 : 0) - this.vel.y)) * Math.min(1, 10 * dt);
      this.fallStart = null;
      this.onGround = false;
    } else if (water || swimUp) {
      if (spacePressed) {
        // jump out of the water (Minecraft-like): the impulse coasts ~1 block
        // past the surface, enough to clear a 1-high bank. Holding Space
        // keeps you rising; letting go sinks.
        this.vel.y = 8;
        this.jumpBufT = -10;
      } else if (spaceDown) {
        this.vel.y += ((5 - this.vel.y)) * Math.min(1, 10 * dt);
      } else {
        this.vel.y += ((-2 - this.vel.y)) * Math.min(1, 6 * dt);
      }
      // shore assist: swimming into a bank with Space held pops you onto it.
      // Without this the swim velocity bleeds off the instant inWater() goes
      // false and a 1-block shore is unclimbable (bob against the wall).
      if (spaceDown && moving) {
        const px = this.pos.x + dx * 0.55, pz = this.pos.z + dz * 0.55;
        const ahead = world.get(Math.floor(px), Math.floor(this.pos.y), Math.floor(pz));
        if (ahead !== undefined && ahead !== B.AIR && ahead !== B.WATER && ahead !== B.LAVA && ahead !== B.LADDER && !WALK_THROUGH.has(ahead)) {
          const top = Math.floor(this.pos.y) + 1 + 0.02;
          const lift = top - this.pos.y;
          if (lift > 0.02 && lift <= 1.25 && !this.collides(world, this.pos.x, top, this.pos.z)) {
            this.pos.y = top;
            this.vel.y = Math.max(this.vel.y, 2);
          }
        }
      }
    } else {
      this.vel.y -= GRAVITY * dt;
      if (this.vel.y < -28) this.vel.y = -28;
      const coyote = this._now - this.lastGroundT < 0.12;
      const buffered = this._now - this.jumpBufT < 0.12;
      if (buffered && coyote) {
        this.vel.y = JUMP;
        this.onGround = false;
        this.lastGroundT = -10;
        this.jumpBufT = -10;
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
