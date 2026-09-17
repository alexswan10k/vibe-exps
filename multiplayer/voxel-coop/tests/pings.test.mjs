import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const source = readFileSync(new URL("server/main.ts", root), "utf8");
const branch = source.match(/    case "worldPing": \{([\s\S]*?)\n    \}\n    case "chat":/)[1];
const messages = [];
const pl = { id: 1, name: "Builder", p: [0.5, 20.5, 0.5], dead: false };
const context = vm.createContext({
  pl, m: { x: 0, y: 20, z: 1 }, players: { all: new Map([[1, pl]]) },
  worldPingCd: new Map(), WORLD_H: 48, B: { AIR: 0 },
  world: { get: () => 3 }, Date: { now: () => 0 },
  dist: (p, x, y, z) => Math.hypot(p[0] - x - 0.5, p[1] - y - 0.5, p[2] - z - 0.5),
  broadcast: (m) => messages.push(m),
});
const dispatch = () => vm.runInContext(`switch ('worldPing') { case 'worldPing': {${branch}\n}}`, context);
dispatch();
assert.equal(messages.length, 1);
assert.equal(messages[0].name, "Builder");
assert.equal(messages[0].ttl, 15000);
context.Date.now = () => 999;
dispatch();
assert.equal(messages.length, 1);
context.Date.now = () => 1000;
dispatch();
assert.equal(messages.length, 2);
context.Date.now = () => 2000;
pl.dead = true;
dispatch();
assert.equal(messages.length, 2);
pl.dead = false;
dispatch();
assert.equal(messages.length, 3);

const load = async (path) => {
  const text = readFileSync(new URL(path, root), "utf8");
  return await import(`data:text/javascript;base64,${Buffer.from(text.replace('import { httpBase } from "./config.js";', 'const httpBase = (url) => url;')).toString("base64")}`);
};
const { Net, PollNet } = await load("client/js/net.js");
const previousPerformance = globalThis.performance;
let now = 0;
Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => now } });
try {
  for (const Transport of [Net, PollNet]) {
    now = 0;
    const net = new Transport();
    const sent = [];
    net.send = (m) => sent.push(m);
    assert.equal(net.worldPing(0, 20, 1), false);
    net.connected = true;
    assert.equal(net.worldPing(0, 20, 1), true);
    now = 999;
    assert.equal(net.worldPing(0, 20, 1), false);
    now = 1000;
    assert.equal(net.worldPing(0, 20, 1), true);
    assert.equal(sent.length, 2);
    assert.equal(sent[1].t, "worldPing");
  }
} finally {
  Object.defineProperty(globalThis, "performance", { configurable: true, value: previousPerformance });
}
const { TeamPings } = await load("client/js/fx.js");
assert.equal(typeof TeamPings, "function");
console.log("PASS: server dispatch, both client cooldown boundaries, TeamPings export");
