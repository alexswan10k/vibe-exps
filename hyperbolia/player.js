/* ==========================================================================
 * HYPERBOLIA — player controller
 *
 * Pure input state in, camera state out. Every method is idempotent per
 * frame; the class never touches the DOM or the renderer.
 * ========================================================================== */

const DEFAULT_KEYS = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "back",
  ArrowDown: "back",
  KeyA: "strafeL",
  ArrowLeft: "strafeL",
  KeyD: "strafeR",
  ArrowRight: "strafeR",
  KeyQ: "yawL",
  KeyE: "yawR",
  KeyR: "pitchU",
  KeyF: "pitchD",
  ShiftLeft: "boost",
  ShiftRight: "boost",
};

class HyperPlayer {
  constructor() {
    this.camera = new HyperCamera();
    this.keys = new Set();
    this.pointerLocked = false;
    this.look = { x: 0, y: 0 };
    this.velF = 0;
    this.velS = 0;
    /** Signed forward-only distance, drives the 2D walk. */
    this.forwardOdometer = 0;
    this.angV = { yaw: 0, pitch: 0 };
    this.bob = 0;
    this.speed = 3.2;
    this.sensitivity = 0.0022;
    /** Set by main so the controller can confine the player to a room. */
    this.world = { D: 1, door: 0.42, margin: 0.22, eyeHeight: 0.26 };
  }

  onKeyDown(e) {
    if (DEFAULT_KEYS[e.code]) {
      this.keys.add(DEFAULT_KEYS[e.code]);
      if (e.code.startsWith("Arrow")) e.preventDefault();
    }
  }

  onKeyUp(e) {
    if (DEFAULT_KEYS[e.code]) this.keys.delete(DEFAULT_KEYS[e.code]);
  }

  onMouseMove(dx, dy) {
    if (!this.pointerLocked) return;
    this.look.x += dx * this.sensitivity;
    this.look.y += dy * this.sensitivity;
  }

  held(action) {
    for (const code in DEFAULT_KEYS) {
      if (DEFAULT_KEYS[code] === action && this.keys.has(code)) return true;
    }
    return false;
  }

  update(dt) {
    const cam = this.camera;

    /* --- looking ---------------------------------------------------------- */
    // Mouse look is consumed immediately so it never lags a frame.
    if (this.look.x || this.look.y) {
      cam.yawBy(this.look.x);
      cam.pitchBy(-this.look.y);
      this.angV.yaw = this.look.x / Math.max(dt, 1e-3);
      this.angV.pitch = -this.look.y / Math.max(dt, 1e-3);
      this.look.x = 0;
      this.look.y = 0;
    }

    // Keyboard turning ramps so it feels like momentum, not a switch.
    const keyYaw = (this.held("yawR") ? 1 : 0) - (this.held("yawL") ? 1 : 0);
    const keyPitch = (this.held("pitchD") ? 1 : 0) - (this.held("pitchU") ? 1 : 0);
    if (keyYaw) this.angV.yaw += keyYaw * 5.5 * dt;
    if (keyPitch) this.angV.pitch += keyPitch * 5.5 * dt;
    const damp = Math.exp(-7 * dt);
    this.angV.yaw *= damp;
    this.angV.pitch *= damp;
    if (Math.abs(this.angV.yaw) > 1e-4) cam.yawBy(this.angV.yaw * dt);
    if (Math.abs(this.angV.pitch) > 1e-4)
      cam.pitchBy(Math.max(-1.45, Math.min(1.45, this.angV.pitch * dt)));
    cam.pitch = Math.max(-1.45, Math.min(1.45, cam.pitch));

    /* --- locomotion -------------------------------------------------------- */
    const boost = this.held("boost") ? 2.6 : 1;
    const targetF =
      ((this.held("forward") ? 1 : 0) - (this.held("back") ? 1 : 0)) *
      this.speed *
      boost;
    const targetS =
      ((this.held("strafeR") ? 1 : 0) - (this.held("strafeL") ? 1 : 0)) *
      this.speed *
      0.7 *
      boost;

    // Critically damped approach — snappy but never jittery.
    const accel = 1 - Math.exp(-11 * dt);
    this.velF += (targetF - this.velF) * accel;
    this.velS += (targetS - this.velS) * accel;

    cam.moveForward(this.velF * dt);
    cam.moveStrafe(this.velS * dt);
    this.forwardOdometer += this.velF * dt;

    /* --- head bob ---------------------------------------------------------- */
    const sp = Math.hypot(this.velF, this.velS);
    this.bob += sp * dt * 4.2;

    /* --- stay inside a room ------------------------------------------------ */
    // In the folded cell the floor is at y = -D/2, so standing at eye height
    // simply means y = -D/2 + eyeHeight*D. No offsetting needed.
    const { D, door, margin, eyeHeight } = this.world;
    const k = cam.kleinFolded(D).k;
    k[1] += Math.sin(this.bob) * D * 0.012;
    const eye = eyeHeight * D;
    const lo = -D * 0.5 + eye;
    const hi = D * 0.5 - eye;
    if (confineToRoom(k, D, door, margin, lo, hi)) cam.reseatFromKlein(k);
    cam.rebaseIfNeeded(D);
  }
}
