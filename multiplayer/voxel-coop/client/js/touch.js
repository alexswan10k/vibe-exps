// Optional touch controls (iPad etc.): left joystick to move, drag right side
// to look, buttons to jump / mine (hold) / place / attack / inventory.
export class Touch {
  constructor(player, actions) {
    this.player = player;
    this.actions = actions; // {mine(down), place(), attack(), inv()}
    this.enabled = false;
    this.joyId = null;
    this.joyCX = 0;
    this.joyCY = 0;
    this.lookId = null;
    this.lookX = 0;
    this.lookY = 0;
    this.el = (id) => document.getElementById(id);
    this.bindJoystick();
    this.bindLook();
    this.bindBtn("tb-jump",
      () => { this.player.keys.Space = true; },
      () => { this.player.keys.Space = false; });
    this.bindBtn("tb-mine",
      () => this.actions.mine(true),
      () => this.actions.mine(false));
    this.bindBtn("tb-place", () => this.actions.place());
    this.bindBtn("tb-attack", () => this.actions.attack());
    this.bindBtn("tb-inv", () => this.actions.inv());
    this.el("touch-toggle").addEventListener("click", () => this.setEnabled(!this.enabled));
    // auto-enable on touch devices (remembered choice wins)
    let saved = null;
    try { saved = localStorage.getItem("voxelcoop.touch"); } catch { /* noop */ }
    if (saved !== null) this.setEnabled(saved === "1");
    else if ("ontouchstart" in window) this.setEnabled(true);
  }

  setEnabled(v) {
    this.enabled = v;
    this.el("touch-ui").style.display = v ? "block" : "none";
    this.el("touch-toggle").classList.toggle("on", v);
    try { localStorage.setItem("voxelcoop.touch", v ? "1" : "0"); } catch { /* noop */ }
    if (!v) this.releaseAll();
  }

  releaseAll() {
    for (const k of ["KeyW", "KeyA", "KeyS", "KeyD", "Space"]) this.player.keys[k] = false;
    this.actions.mine(false);
    this.joyId = null;
    this.lookId = null;
    this.el("joy-knob").style.transform = "translate(-50%,-50%)";
  }

  bindJoystick() {
    const zone = this.el("joy");
    const knob = this.el("joy-knob");
    zone.addEventListener("touchstart", (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this.joyId = t.identifier;
      const r = zone.getBoundingClientRect();
      this.joyCX = r.left + r.width / 2;
      this.joyCY = r.top + r.height / 2;
      this.stick(t.clientX, t.clientY);
    }, { passive: false });
    zone.addEventListener("touchmove", (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this.joyId) { this.stick(t.clientX, t.clientY); break; }
      }
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joyId) {
          this.joyId = null;
          knob.style.transform = "translate(-50%,-50%)";
          this.player.keys.KeyW = this.player.keys.KeyS = false;
          this.player.keys.KeyA = this.player.keys.KeyD = false;
          break;
        }
      }
    };
    zone.addEventListener("touchend", end);
    zone.addEventListener("touchcancel", end);
  }

  stick(x, y) {
    const max = 44, dead = 12;
    let dx = x - this.joyCX, dy = y - this.joyCY;
    const d = Math.hypot(dx, dy);
    if (d > max) { dx *= max / d; dy *= max / d; }
    this.el("joy-knob").style.transform =
      `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    this.player.keys.KeyW = dy < -dead;
    this.player.keys.KeyS = dy > dead;
    this.player.keys.KeyA = dx < -dead;
    this.player.keys.KeyD = dx > dead;
  }

  bindLook() {
    const zone = this.el("look-zone");
    zone.addEventListener("touchstart", (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this.lookId = t.identifier;
      this.lookX = t.clientX;
      this.lookY = t.clientY;
    }, { passive: false });
    zone.addEventListener("touchmove", (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this.lookId) {
          const dx = t.clientX - this.lookX, dy = t.clientY - this.lookY;
          this.lookX = t.clientX;
          this.lookY = t.clientY;
          this.player.yaw -= dx * 0.0045;
          this.player.pitch -= dy * 0.0045;
          this.player.pitch = Math.max(-1.55, Math.min(1.55, this.player.pitch));
          break;
        }
      }
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.lookId) { this.lookId = null; break; }
      }
    };
    zone.addEventListener("touchend", end);
    zone.addEventListener("touchcancel", end);
  }

  bindBtn(id, down, up) {
    const b = this.el(id);
    b.addEventListener("touchstart", (e) => {
      e.preventDefault();
      e.stopPropagation();
      b.classList.add("held");
      down();
    }, { passive: false });
    const end = (e) => {
      e.preventDefault();
      b.classList.remove("held");
      if (up) up();
    };
    b.addEventListener("touchend", end);
    b.addEventListener("touchcancel", end);
  }
}
