/* ==========================================================================
 * HYPERBOLIA — player controller
 *
 * Pure input state in, camera state out. Every method is idempotent per
 * frame; the class never touches the DOM or the renderer.
 * ========================================================================== */

/**
 * Key code -> action. `this.keys` holds ACTION names, never key codes, so
 * KeyW and ArrowUp feed the same action without needing a scan per query.
 */
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
    /** Actions currently held down, e.g. "forward". */
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
    const action = DEFAULT_KEYS[e.code];
    if (action) {
      this.keys.add(action);
      // Arrows would otherwise scroll the page out from under the canvas.
      if (e.code.startsWith("Arrow")) e.preventDefault();
    }
  }

  onKeyUp(e) {
    const action = DEFAULT_KEYS[e.code];
    if (action) this.keys.delete(action);
  }

  onMouseMove(dx, dy) {
    if (!this.pointerLocked) return;
    this.look.x += dx * this.sensitivity;
    this.look.y += dy * this.sensitivity;
  }

  /** True while the given action is held down by any of its keys. */
  held(action) {
    return this.keys.has(action);
  }

  /** Release everything — call on window blur so keys do not stick. */
  releaseAll() {
    this.keys.clear();
    this.velF = 0;
    this.velS = 0;
    this.angV.yaw = 0;
    this.angV.pitch = 0;
    this.look.x = 0;
    this.look.y = 0;
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

    /* --- stay inside a room ------------------------------------------------ */
    // Collide in the cell's OWN frame. Cell-local coords run -D/2..D/2, with
    // the floor at -D/2, so standing at eye height means y = -D/2 + eye*D.
    //
    // The cell offset has to be put back afterwards. Folding to the nearest
    // cell centre and reseating from those folded coords would silently drop
    // the offset, pinning the player inside whichever room they started in.
    const { D, door, margin, eyeHeight } = this.world;
    const lo = -D * 0.5 + eyeHeight * D;
    const hi = D * 0.5 - eyeHeight * D;
    const bob = Math.sin(this.bob) * D * 0.012;

    // Does a (forward, strafe) step from the current pose stay legal?
    const save = {
      P: cam.P.slice(),
      E: cam.E.map((e) => e.slice()),
      odo: cam.odometer,
    };
    const restore = () => {
      cam.P = save.P.slice();
      cam.E = save.E.map((e) => e.slice());
      cam.odometer = save.odo;
    };
    const legal = (f, s) => {
      restore();
      cam.moveForward(f);
      cam.moveStrafe(s);
      const local = cam.folded(D).k;
      local[1] += bob;
      return !confineToRoom(local, D, door, margin, lo, hi);
    };

    let df = this.velF * dt;
    let ds = this.velS * dt;
    if (!legal(df, ds)) {
      // Blocked. Slide: try each axis alone so walls guide rather than stop.
      const alongF = df !== 0 && legal(df, 0);
      const alongS = ds !== 0 && legal(0, ds);
      if (alongF) {
        ds = 0;
      } else if (alongS) {
        df = 0;
      } else {
        df = 0;
        ds = 0;
      }
    }

    restore();
    cam.moveForward(df);
    cam.moveStrafe(ds);
    this.forwardOdometer += df;
    cam.rebaseIfNeeded(D);

    /* --- head bob ---------------------------------------------------------- */
    const sp = Math.hypot(df, ds);
    this.bob += sp * dt * 4.2;
  }
}
