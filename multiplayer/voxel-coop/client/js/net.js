// WebSocket client: connect, send helpers, message dispatch, auto-reconnect.
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
  craft(recipe, fromTable) { this.send({ t: "craft", recipe, fromTable }); }
  smelt(action, x, y, z) { this.send({ t: "smelt", action, x, y, z }); }
  attackMob(id, weapon) { this.send({ t: "attackMob", id, weapon }); }
  chat(msg) { this.send({ t: "chat", msg }); }
  respawn() { this.send({ t: "respawn" }); }
  eat(slot) { this.send({ t: "eat", slot }); }
  fall(dmg) { this.send({ t: "fall", dmg }); }
  moveItem(from, to) { this.send({ t: "moveItem", from, to }); }
}
