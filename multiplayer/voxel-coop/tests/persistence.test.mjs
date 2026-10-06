// Furnace persistence across a restart, driven over the HTTP-poll transport so
// it needs no browser or GPU.
//
//   node tests/persistence.test.mjs             # phase 1: start a smelt
//   <restart the server>
//   node tests/persistence.test.mjs --verify    # phase 2: assert it came back
//
// What this covers: furnace state lives in main.ts, not world.ts, so it was
// never written to disk at all. A finished-but-uncollected smelt (done=true,
// held because the owner's inventory was full) or an in-progress one vanished on
// restart even though the input item had already been removed from the player's
// inventory — silent item loss.
import { readFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:8000";
const VERIFY_ONLY = process.argv.includes("--verify");

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  [" + detail + "]" : ""}`);
};

if (VERIFY_ONLY) {
  const restored = JSON.parse(readFileSync(new URL("../data/furnaces.json", import.meta.url)));
  const list = restored.list ?? [];
  check("furnace state survived the restart", list.length > 0,
    `${list.length} entr(ies): ${JSON.stringify(list)}`);
  check("restored entries are well-formed",
    list.every((f) => [f.x, f.y, f.z, f.owner].every(Number.isFinite)), JSON.stringify(list));
  console.log(list.some((f) => f.done === true)
    ? "\nNOTE: a finished (done) smelt was restored — the exact state that used to be lost."
    : "\nNOTE: the restored entry was mid-smelt rather than a finished `done` one.");
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\n${bad === 0 ? "RESTART OK" : bad + " FAILURES"}`);
  process.exit(bad === 0 ? 0 : 1);
}

// ---- minimal poll client ----
const post = async (path, body) => (await fetch(`${BASE}${path}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})).json();

const welcome = await post("/api/join", { name: "PersistProbe" });
const tx = [];   // client -> server
const rx = [];   // server -> client (never sent back)
const send = (m) => tx.push(m);
async function pump(rounds = 4) {
  for (let i = 0; i < rounds; i++) {
    const r = await post("/api/poll", { id: welcome.id, msgs: tx.splice(0) });
    for (const m of r.msgs ?? []) rx.push(m);
    await new Promise((res) => setTimeout(res, 250));
  }
}
const chat = (msg) => { send({ t: "chat", msg }); return pump(3); };
const last = (t) => rx.filter((m) => m.t === t).pop();
const inv = () => last("inv")?.slots ?? [];
const chats = () => rx.filter((m) => m.t === "chat").map((m) => m.msg);
const countItem = (slots, id) =>
  slots.filter((s) => s?.id === id).reduce((a, s) => a + (s?.n ?? 0), 0);

console.log(`joined ${welcome.name} (id=${welcome.id}) at ${welcome.spawn}`);
await pump();

// 1. creative, then stock smeltable input
await chat("/creative");
await chat("/give 12 4"); // iron ore — the smelt input
await chat("/give 102 8"); // coal — the smelt FUEL (the server requires both)
await pump();
check("creative /give stocked iron ore + coal",
  countItem(inv(), 12) === 4 && countItem(inv(), 102) === 8,
  `iron ore: ${countItem(inv(), 12)}, coal: ${countItem(inv(), 102)}`);

// 2. place a furnace. The server refuses placement into non-air, into water, or
//    inside a live player's box, and we can't read the world from a poll client,
//    so try neighbours until one sticks.
const [sx, sy, sz] = welcome.spawn.map(Math.floor);
let target = null;
for (const [dx, dy, dz] of [
  [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [1, 0, 1], [-1, 0, -1],
  [2, 0, 0], [0, 0, 2], [1, 1, 0], [0, 1, 0], [0, 2, 0], [1, 0, 2],
]) {
  const at = [sx + dx, sy + dy, sz + dz];
  const before = rx.length;
  send({ t: "edit", op: "place", x: at[0], y: at[1], z: at[2], block: 14 });
  await pump(2);
  if (rx.slice(before).some((m) => m.t === "block" && m.block === 14)) { target = at; break; }
}
check("server accepted the furnace placement", target !== null,
  `placed at ${target?.join(",") ?? "nowhere"}`);

// 3. start the smelt
if (!target) {
  console.log("\nno furnace could be placed — cannot continue");
  process.exit(1);
}
send({ t: "smelt", action: "start", x: target[0], y: target[1], z: target[2] });
await pump();
check("server accepted the smelt", chats().some((m) => /smelting started/.test(m)),
  `${chats().slice(-2).join(" | ")} · rx: ${rx.slice(-8).map((m) => m.t).join(",")}`);
check("smelt consumed the iron ore", countItem(inv(), 12) === 3,
  `iron ore left: ${countItem(inv(), 12)}`);

// 4. restart the server NOW, mid-smelt. SMELT_TIME is 8s, so kill it inside
//    that window to prove an *in-progress* smelt is restored too.
console.log(`\n>>> restart the server now (SIGTERM) — the smelt at ${target.join(",")} is mid-progress`);
console.log(`>>> then run:  node tests/persistence.test.mjs --verify`);

const failed = results.filter((r) => !r.ok).length;
console.log(`\nphase 1: ${failed === 0 ? "ALL PASS" : failed + " FAILURES"}`);
process.exit(failed === 0 ? 0 : 1);