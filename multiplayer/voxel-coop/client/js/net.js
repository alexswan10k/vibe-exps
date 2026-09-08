// WebSocket client: connect, send helpers, message dispatch, auto-reconnect.
import { httpBase } from "./config.js";
export class Net {
  constructor() {
    this.ws = null;
    this.handlers = {};
    this.connected = false;
    this.url = "";
    this.name = "";
    this.wantClose = false;
  }

  on(type, fn) {
    (this.handlers[type] ??= []).push(fn);
  }

  emit(type, msg) {
    for (const fn of this.handlers[type] ?? []) {
      try { fn(msg); } catch (e) { console.error("[net]", type, e); }
    }
  }

  connect(url, name) {
    this.wantClose = false;
    this.url = url;
    this.name = name;
    try { localStorage.setItem("voxelcoop.server", url); } catch { /* noop */ }
    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      this.connected = true;
      this.send({ t: "hello", name });
      this.emit("open", {});
    };
    this.ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      this.emit(m.t, m);
      this.emit("*", m);
    };
    this.ws.onclose = () => {
      this.connected = false;
      this.emit("close", {});
      if (!this.wantClose) {
        setTimeout(() => { if (!this.wantClose) this.connect(url, name); }, 2500);
      }
    };
    this.ws.onerror = () => { try { this.ws.close(); } catch { /* noop */ } };
  }

  disconnect() {
    this.wantClose = true;
    try { this.ws?.close(); } catch { /* noop */ }
  }

  send(m) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  reqChunk(cx, cz) { this.send({ t: "reqChunk", cx, cz }); }
  edit(op, x, y, z, block, heldItem) { this.send({ t: "edit", op, x, y, z, block, heldItem }); }
  move(p, yaw, pitch) { this.send({ t: "move", p, yaw, pitch }); }
  gridPut(slot, g, all) { this.send({ t: "gridPut", slot, g, all }); }
  gridTake(g) { this.send({ t: "gridTake", g }); }
  craftTake() { this.send({ t: "craftTake" }); }
  smelt(action, x, y, z) { this.send({ t: "smelt", action, x, y, z }); }
  attackMob(id, weapon) { this.send({ t: "attackMob", id, weapon }); }
  chat(msg) { this.send({ t: "chat", msg }); }
  respawn() { this.send({ t: "respawn" }); }
  eat(slot) { this.send({ t: "eat", slot }); }
  fall(dmg) { this.send({ t: "fall", dmg }); }
  moveItem(from, to) { this.send({ t: "moveItem", from, to }); }
}

// Legacy HTTP-poll transport for devices without working websockets.
// Same method/handler surface as Net; batches outgoing, polls at ~4Hz.
export class PollNet {
  constructor() {
    this.handlers = {};
    this.connected = false;
    this.base = "";
    this.name = "";
    this.id = -1;
    this.queue = [];
    this.timer = null;
    this.flushing = false;
    this.wantClose = false;
  }

  on(type, fn) {
    (this.handlers[type] ??= []).push(fn);
  }

  emit(type, msg) {
    for (const fn of this.handlers[type] ?? []) {
      try { fn(msg); } catch (e) { console.error("[poll]", type, e); }
    }
  }

  async connect(url, name) {
    this.wantClose = false;
    this.base = httpBase(url);
    this.name = name;
    try { localStorage.setItem("voxelcoop.server", url); } catch { /* noop */ }
    try {
      const r = await fetch(`${this.base}/api/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) throw new Error(`join ${r.status}`);
      const welcome = await r.json();
      this.id = welcome.id;
      this.connected = true;
      this.emit("welcome", welcome);
      this.emit("open", {});
      this.timer = setInterval(() => this.flush(), 250);
      void this.flush();
    } catch (e) {
      console.error("[poll] join failed", e);
      this.emit("close", {});
      if (!this.wantClose) setTimeout(() => { if (!this.wantClose) this.connect(url, name); }, 2500);
    }
  }

  disconnect() {
    this.wantClose = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.connected = false;
  }

  send(m) {
    // coalesce movement: only the latest position matters
    if (m.t === "move") {
      this.queue = this.queue.filter((q) => q.t !== "move");
    }
    this.queue.push(m);
  }

  async flush() {
    if (this.flushing || this.wantClose || this.id < 0) return;
    this.flushing = true;
    try {
      const msgs = this.queue;
      this.queue = [];
      const r = await fetch(`${this.base}/api/poll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: this.id, msgs }),
      });
      if (!r.ok) throw new Error(`poll ${r.status}`);
      const data = await r.json();
      for (const m of data.msgs ?? []) {
        this.emit(m.t, m);
        this.emit("*", m);
      }
    } catch (e) {
      console.error("[poll] flush failed", e);
      this.disconnect();
      this.emit("close", {});
      if (!this.wantClose) setTimeout(() => { if (!this.wantClose) this.connect(this.base, this.name); }, 2500);
    } finally {
      this.flushing = false;
    }
  }

  reqChunk(cx, cz) { this.send({ t: "reqChunk", cx, cz }); }
  edit(op, x, y, z, block, heldItem) { this.send({ t: "edit", op, x, y, z, block, heldItem }); }
  move(p, yaw, pitch) { this.send({ t: "move", p, yaw, pitch }); }
  gridPut(slot, g, all) { this.send({ t: "gridPut", slot, g, all }); }
  gridTake(g) { this.send({ t: "gridTake", g }); }
  craftTake() { this.send({ t: "craftTake" }); }
  smelt(action, x, y, z) { this.send({ t: "smelt", action, x, y, z }); }
  attackMob(id, weapon) { this.send({ t: "attackMob", id, weapon }); }
  chat(msg) { this.send({ t: "chat", msg }); }
  respawn() { this.send({ t: "respawn" }); }
  eat(slot) { this.send({ t: "eat", slot }); }
  fall(dmg) { this.send({ t: "fall", dmg }); }
  moveItem(from, to) { this.send({ t: "moveItem", from, to }); }
}
