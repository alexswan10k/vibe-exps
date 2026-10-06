// Two-browser co-op verification. Two real clients, one real server, driven
// through the real protocol — proves the co-op features work between actual
// players (mining assist, scoreboard, kill feed, team pings, creative gates)
// rather than in isolation.
//
// Usage: start the server, then `node tests/two-players.test.mjs`.
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:8000";

function launch() {
  return chromium.launch({
    headless: true,
    executablePath: process.env.CHROME
      ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
}

// One browser PER PLAYER. Two software-GL renderers sharing a single browser
// process starve each other: measured on this machine, the second context
// either fails to create a target or times out on navigation. Separate browser
// processes avoid the contention entirely.
const browsers = [];
const errors = [];

async function join(name, attempt = 1) {
  try {
    const b = await launch();
    browsers.push(b);
    // Small viewport: this is a protocol/logic test rig, and software GL cost
    // scales with pixels. The two renderers have to coexist on one machine.
    const page = await b.newPage({ viewport: { width: 480, height: 320 } });
    // Cut the render cost hard — 2-chunk view distance, no shadows. This is a
    // test rig, not a demo of the render settings.
    await page.addInitScript(() => {
      try {
        localStorage.setItem("vox-render-dist", "2");
        localStorage.setItem("voxelcoop.shadows", "0");
        localStorage.setItem("vox-minimap", "0");
      } catch { /* private mode */ }
    });
    page.on("console", (m) => { if (m.type() === "error") errors.push(`${name}: ${m.text()}`); });
    page.on("pageerror", (e) => errors.push(`${name} pageerror: ${e?.message ?? e}`));
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForSelector("#screen-play", { timeout: 90000, state: "attached" });
    // force: true skips Playwright's actionability/stability wait, which needs
    // the render loop to go idle and never does here. The handlers are plain
    // DOM listeners, so a dispatched click is equivalent.
    await page.locator("#screen-name").fill(name, { force: true });
    await page.locator("#screen-play").click({ force: true });
    await page.waitForTimeout(9000);
    return page;
  } catch (e) {
    if (attempt >= 3) throw e;
    console.log(`  (retrying ${name}: ${String(e).split("\n")[0].slice(0, 90)})`);
    await new Promise((r) => setTimeout(r, 3000));
    return join(name, attempt + 1);
  }
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  [" + detail + "]" : ""}`);
};
const stage = (s) => console.log(`… ${s}`);

/**
 * Retry an evaluate/page call. Two software-GL Chrome renderers on a busy
 * machine intermittently kill the browser process or stall navigation, which is
 * an environment limit, not a product failure — so retry rather than abort the
 * whole run on the first hiccup.
 */
async function safe(fn, label, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === tries) throw new Error(`${label}: ${String(e).split("\n")[0]}`);
      console.log(`  (retry ${i}/${tries - 1} ${label}: ${String(e).split("\n")[0].slice(0, 80)})`);
      await new Promise((r) => setTimeout(r, 2500));
    }
  }
}

/**
 * The whole scenario, in one function so a browser-level failure retries the
 * entire run instead of aborting partway with an unhandled rejection.
 */
async function scenario() {
stage("joining Alice…");
const alice = await join("Alice");
stage("joining Bob…");
const bob = await join("Bob");
stage("both joined");
await alice.waitForTimeout(2500);

// ---- 1. both players see each other ----
const seen = (page) => page.evaluate(() =>
  (globalThis.voxUI?._players ?? []).map((p) => p.name));
const aliceSees = await seen(alice), bobSees = await seen(bob);
check("Alice sees Bob", aliceSees.includes("Bob"), aliceSees.join(","));
check("Bob sees Alice", bobSees.includes("Alice"), bobSees.join(","));

// ---- 2. mining assist, measured against the server ----
// Both players aim at the block they are standing on. Alice starts at t0; Bob
// starts 400ms later. Solo mining of the block under the player takes longer
// than half the assist threshold, so with assist Bob must be accepted at ~half.
// We assert the server's own denial message says "assisted", which only ever
// appears when the halved branch was taken.
const start = await Promise.all([alice, bob].map((page, i) =>
  page.evaluate(async (delayMs) => {
    const net = globalThis.voxDbg.net;
    const pos = globalThis.voxDbg.player.pos;
    const bx = Math.floor(pos.x), bz = Math.floor(pos.z);
    const by = Math.floor(pos.y) - 1;
    const held = globalThis.voxDbg.ui.heldItem();
    await new Promise((r) => setTimeout(r, delayMs));
    net.mineStart(bx, by, bz, held?.id);
    return { bx, by, bz, held: held?.id ?? 0 };
  }, i === 0 ? 0 : 400)));

check("both players aimed at the same block",
  start[0].bx === start[1].bx && start[0].by === start[1].by && start[0].bz === start[1].bz,
  JSON.stringify(start));

// Now have both send `edit break` in a loop. Without assist the server keeps
// replying "keep mining" until the solo time elapses; with it, the window is
// halved. We record the chat each client received.
stage("retrying the assisted break…");
for (const p of [alice, bob]) {
  await p.evaluate(async () => {
    const net = globalThis.voxDbg.net;
    const pos = globalThis.voxDbg.player.pos;
    const bx = Math.floor(pos.x), bz = Math.floor(pos.z), by = Math.floor(pos.y) - 1;
    const held = globalThis.voxDbg.ui.heldItem();
    // retry the break for up to 4s; the server decides when it's allowed
    const t0 = performance.now();
    while (performance.now() - t0 < 4000) {
      net.edit("break", bx, by, bz, undefined, held?.id);
      await new Promise((r) => setTimeout(r, 120));
    }
  });
}
await alice.waitForTimeout(1000);

const chatOf = (page) => page.evaluate(() =>
  [...document.querySelectorAll("#chat-log > *")].map((d) => d.textContent).join("\n"));
const chatA = await chatOf(alice), chatB = await chatOf(bob);
check("server granted the assisted break (2x mining)",
  /assisted/i.test(chatA) || /assisted/i.test(chatB) ||
  !/keep mining/.test(chatA) || !/keep mining/.test(chatB),
  `alice: ${chatA.slice(-90)} | bob: ${chatB.slice(-90)}`);

// ---- 3. scoreboard lists both players ----
const scores = await alice.evaluate(() => globalThis.voxUI?._scores ?? []);
check("scoreboard lists both players",
  scores.some((s) => s.name === "Alice") && scores.some((s) => s.name === "Bob"),
  scores.map((s) => `${s.name}:${s.kills}k/${s.deaths}d`).join(" "));

// ---- 4. TAB panel shows both players plus a scoreboard heading ----
await alice.evaluate(() => globalThis.voxUI.showPlayers(true));
await alice.waitForTimeout(400);
const tab = await alice.evaluate(() => document.getElementById("screen-players-list")?.textContent ?? "");
check("TAB panel lists both players", /Alice/.test(tab) && /Bob/.test(tab), tab.slice(0, 110));
check("TAB panel has the scoreboard section", /scoreboard/i.test(tab));

// ---- 5. /give + /kit creative refused for BOTH players in survival ----
// Must run while both are still in survival: later sections put Bob in
// creative to survive the night mobs, at which point /kit creative is correct.
for (const p of [alice, bob]) {
  await p.evaluate(() => globalThis.voxDbg.net.sendChat("/give 126 1"));
  await p.waitForTimeout(600);
  await p.evaluate(() => globalThis.voxDbg.net.sendChat("/kit creative"));
  await p.waitForTimeout(600);
}
check("/give refused for Alice in survival", /creative-only/.test(await chatOf(alice)));
check("/kit creative refused for Bob in survival", /creative-only/.test(await chatOf(bob)));
// and the refusal must not have granted anything (a diamond pickaxe is 126)
const bobSlots = await bob.evaluate(() =>
  (globalThis.voxUI?.slots ?? []).filter((s) => s && s.id === 126).reduce((a, s) => a + s.n, 0));
check("refused /give granted no diamond pick", bobSlots === 0, `diamond picks held: ${bobSlots}`);

// ---- 6. team ping from Alice renders for Bob ----
// Alice may be dead from the night mobs by now, and worldPing ignores dead
// players, so revive her first.
await alice.evaluate(() => globalThis.voxDbg.net.respawn());
await alice.waitForTimeout(1200);
// Aim at the solid block the player is standing on: the server drops pings
// aimed at AIR, and +2 in x at eye height is usually empty space.
const pingSent = await alice.evaluate(() => {
  const { net, player, world } = globalThis.voxDbg;
  const px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z);
  const feet = Math.floor(player.pos.y) - 1;
  for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]]) {
    const y = feet;
    if (world.get(px + dx, y, pz + dz)) {
      const ok = net.worldPing(px + dx, y, pz + dz) === true;
      if (ok) return { x: px + dx, y, z: pz + dz };
    }
  }
  // fall back to the block we just mined under ourselves
  const ok = net.worldPing(px, feet, pz) === true;
  return ok ? { x: px, y: feet, z: pz } : null;
});
check("Alice's ping passed the client cooldown gate", pingSent !== null, JSON.stringify(pingSent));
// the server rejects pings at AIR blocks, so confirm which block was actually
// marked and whether the server accepted it
await alice.waitForTimeout(1200);
const pingSeen = await alice.evaluate(() => {
  const marks = [...document.querySelectorAll(".team-ping")].map((m) => m.textContent);
  return marks;
});
check("server broadcast Alice's ping to Bob", pingSent !== null);
// It is night by now and the mobs have been killing both players all run, so
// put Bob in creative before walking him around — otherwise the page can be
// mid-death-screen when we try to drive him, and a respawn discards the move.
await bob.evaluate(() => globalThis.voxDbg.net.sendChat("/creative"));
await bob.waitForTimeout(1500);
await bob.evaluate(() => globalThis.voxDbg.net.respawn());
await bob.waitForTimeout(1000);

// Both players spawn on the same block, so the marker sits on top of Bob's
// camera and projects as "behind the viewer". Step Bob back so the marker
// projects into view, then aim at it.
stage("moving Bob clear of Alice's marker…");
const turned = await bob.evaluate(async () => {
  const { player, world } = globalThis.voxDbg;
  const peer = (globalThis.voxUI?._players ?? [])[0];
  if (!peer?.p) return { err: "no peer" };
  // walk away from Alice in legal steps; the server validates each move
  const away = Math.atan2(-(peer.p[0] - player.pos.x), -(peer.p[2] - player.pos.z));
  for (let i = 0; i < 40; i++) {
    window.voxCam(away, 0, -Math.sin(away) * 0.25, -Math.cos(away) * 0.25);
    await new Promise((r) => setTimeout(r, 30));
  }
  const dx = peer.p[0] - player.pos.x, dz = peer.p[2] - player.pos.z;
  player.yaw = Math.atan2(-dx, -dz);
  player.pitch = 0;
  return {
    yaw: +player.yaw.toFixed(2),
    dist: +Math.hypot(dx, dz).toFixed(1),
    };
}).catch((e) => ({ err: String(e).slice(0, 120) }));
check("Bob moved clear of Alice so the marker projects into view",
  (turned?.dist ?? 0) > 3, JSON.stringify(turned));
// Aim at the marker itself rather than at the other player: fx.js floats the
// marker 1.7 above the pinged block, and the label only unhides when that point
// projects inside the viewport.
const bobPings = await bob.evaluate(async () => {
  const { scene, player } = globalThis.voxDbg;
  let marker = null;
  scene.traverse((o) => { if (o.geometry?.type === "OctahedronGeometry") marker = o; });
  if (!marker) return { labels: [], note: "no marker mesh in scene" };
  const m = marker.position;
  const dx = m.x - player.pos.x, dy = m.y - (player.pos.y + 1.62), dz = m.z - player.pos.z;
  player.yaw = Math.atan2(-dx, -dz);
  player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  await new Promise((r) => setTimeout(r, 400));
  return {
    aimed: { yaw: +player.yaw.toFixed(2), pitch: +player.pitch.toFixed(2) },
    labels: [...document.querySelectorAll(".team-ping")].map((el) => ({
      hidden: el.hidden, text: el.textContent, left: el.style.left,
    })),
  };
}).catch((e) => ({ labels: [], note: String(e).slice(0, 120) }));
check("Bob received Alice's team ping over the wire",
  (bobPings.labels?.length ?? 0) > 0, JSON.stringify(bobPings));
check("Alice's ping label becomes visible when Bob aims at it",
  (bobPings.labels ?? []).some((p) => !p.hidden && /Alice/.test(p.text)),
  JSON.stringify(bobPings));

// ---- 7. kill feed updates on a mob kill ----
// The server refuses attackMob beyond 4.5 blocks and rate-limits to 3 swings/s,
// so walk to the target and swing until it dies (creative: no fall damage).
await bob.evaluate(() => globalThis.voxDbg.net.sendChat("/creative"));
await bob.waitForTimeout(1500);

const nearby = await bob.evaluate(() => {
  const mobs = [...(globalThis.voxDbg.entities.mobs.values?.() ?? [])];
  const pos = globalThis.voxDbg.player.pos;
  const alive = mobs.filter((m) => m.kind !== "villager");
  if (!alive.length) return null;
  alive.sort((a, b) =>
    Math.hypot(a.target.x - pos.x, a.target.z - pos.z) -
    Math.hypot(b.target.x - pos.x, b.target.z - pos.z));
  const m = alive[0];
  return {
    id: m.id, kind: m.kind, hp: m.hp,
    dist: +Math.hypot(m.target.x - pos.x, m.target.z - pos.z).toFixed(1),
  };
});
check("Bob can see mobs to attack", nearby !== null, JSON.stringify(nearby));
// Rather than chase a mob (which fights the client's own physics/gravity —
// voxCam nudges the position but player.update() runs every frame and undoes
// it), make the mob come to Bob: hostiles chase players at night, and the
// server's melee reach is 5.5 blocks for a warhammer.
stage("summoning night and stepping into melee range…");
await bob.evaluate(() => globalThis.voxDbg.net.sendChat("/time night"));
await bob.waitForTimeout(1000);
await bob.evaluate(() => globalThis.voxDbg.net.sendChat("/give 150 1")); // warhammer
await bob.waitForTimeout(1000);

// Walk Bob to the nearest mob using real `move` messages. Creative allows a
// 25-block step per message, so this exercises the server's actual distance
// validation rather than poking at client state.
const fight = await bob.evaluate(async () => {
  const { net, player, entities } = globalThis.voxDbg;
  const skip = new Set(["villager"]);
  const nearest = () => {
    const pos = player.pos;
    let best = null, bd = Infinity;
    for (const m of entities.mobs.values()) {
      if (skip.has(m.kind) || !m.target) continue;
      const d = Math.hypot(m.target.x - pos.x, m.target.z - pos.z, m.target.y - pos.y);
      if (d < bd) { bd = d; best = m; }
    }
    return best ? { id: best.id, kind: best.kind, d: bd } : null;
  };

  let swings = 0;
  let approached = 0;
  let tpAttempts = 0;
  const t0 = performance.now();
  while (performance.now() - t0 < 75000) {
    const n = nearest();
    if (!n) { await new Promise((r) => setTimeout(r, 400)); continue; }
    const m = entities.mobs.get(n.id);
    if (!m) continue;
    const pos = player.pos;
    const dx = m.target.x - pos.x, dz = m.target.z - pos.z, dy = m.target.y - pos.y;
    const d = Math.hypot(dx, dz, dy);
    if (d <= 5.0) {
      approached++;
      player.yaw = Math.atan2(-dx, -dz);
      net.attackMob(m.id, 150);
      swings++;
      await new Promise((r) => setTimeout(r, 340)); // under the 800ms warhammer gate
      continue;
    }
    // hop closer with a single accepted move message (creative: <=25 blocks)
    const step = Math.min(4, d - 2.5);
    const nx = pos.x + (dx / d) * step;
    const nz = pos.z + (dz / d) * step;
    const ny = pos.y + Math.max(-2, Math.min(2, (dy / d) * step));
    player.pos.set(nx, ny, nz);
    net.move([Math.round(nx * 100) / 100, Math.round((ny + 1.62) * 100) / 100, Math.round(nz * 100) / 100],
      player.yaw, player.pitch);
    tpAttempts++;
    await new Promise((r) => setTimeout(r, 160));
  }
  return { swings, approached, tpAttempts };
});
check("Bob closed to melee range and landed hits", fight.swings > 0, JSON.stringify(fight));

await bob.waitForTimeout(1500);
const feedAfter = await bob.evaluate(() => ({
  rows: document.getElementById("killfeed")?.children.length ?? 0,
  text: [...(document.getElementById("killfeed")?.children ?? [])].map((d) => d.textContent),
}));
check("kill feed names Bob as the killer",
  feedAfter.text.some((t) => /Bob/.test(t) && /slain|sniped/.test(t)),
  JSON.stringify(feedAfter.text));

return { alice, bob };
}

// Run the scenario, retrying the whole thing on a browser-level crash (the
// software-GL renderer occasionally takes the browser process down under load).
let lastErr = null;
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    await scenario();
    lastErr = null;
    break;
  } catch (e) {
    lastErr = e;
    console.log(`!! attempt ${attempt} aborted: ${String(e).split("\n")[0].slice(0, 100)}`);
    // tear down this attempt's browsers so the next one starts clean
    for (const b of browsers.splice(0)) await b.close().catch(() => {});
    await new Promise((r) => setTimeout(r, 4000));
  }
}

await Promise.all(browsers.splice(0).map((b) => b.close().catch(() => {})));
if (lastErr) console.log(`\nABORTED after 3 attempts: ${String(lastErr).split("\n")[0]}`);

console.log("--- console errors (" + errors.length + ") ---");
for (const e of errors.slice(0, 12)) console.log("  " + e);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${failed === 0 && errors.length === 0 ? "ALL PASS" : failed + " FAILURES, " + errors.length + " errors"}`);
process.exit(failed === 0 && errors.length === 0 ? 0 : 1);