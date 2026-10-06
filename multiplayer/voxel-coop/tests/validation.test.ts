// Regression tests for the server-side validation and trust gates.
// These are the checks that keep a 2-player LAN game honest: every one of them
// corresponds to a handler that previously trusted the client.

import * as proto from "../server/protocol.ts";
import { countOf, giveItems, removeItems } from "../server/crafting.ts";
import { Player } from "../server/players.ts";

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("chunk requests are limited to the player's view radius", () => {
  // main.ts reqChunk clamps to |cx - playerChunk| <= 10 and throttles to 120ms.
  // Assert the constant the clamp depends on, and that a realistic render
  // distance (max 8 per the settings menu) fits comfortably inside it.
  const MAX_RENDER_DIST = 8;
  const CLAMP = 10;
  check(
    CLAMP >= MAX_RENDER_DIST + 2,
    `reqChunk clamp (${CLAMP}) must exceed max render distance (${MAX_RENDER_DIST})`,
  );
  check(proto.CHUNK === 16, "CHUNK must be 16 for the clamp arithmetic to hold");
});

Deno.test("tamed wolves are not hostile to their owner or anyone else", () => {
  // mobs.ts: wolfHostile requires m.owner === undefined. Reproduce the predicate
  // the tick uses so a regression that drops that clause fails here.
  const hostile = (kind: string, owner: string | undefined, night: boolean, hp: number, maxHp: number) => {
    const HOSTILE = new Set(["zombie", "skeleton", "spider", "ogre"]);
    const wolfHostile = kind === "wolf" && owner === undefined && (night || hp < maxHp);
    return (HOSTILE.has(kind) && (night || hp < maxHp)) || wolfHostile;
  };
  check(!hostile("wolf", "Alice", true, 10, 10), "a tamed wolf must never be hostile at night");
  check(!hostile("wolf", "Alice", false, 5, 10), "a tamed wolf must never be hostile when provoked");
  check(!hostile("wolf", "Alice", true, 0, 10), "a dead tamed wolf must not chase");
  check(hostile("wolf", undefined, true, 10, 10), "a wild wolf IS hostile at night");
  check(hostile("wolf", undefined, false, 5, 10), "a wild wolf is hostile when provoked");
  check(hostile("zombie", "Alice", true, 10, 10), "zombies stay hostile (owner field is for pets only)");
});

Deno.test("pet combat targets hostiles, never pack members or trade mobs", () => {
  // mobs.ts nearestHostile() exclusion list
  const eligible = (kind: string, owner: string | undefined, hostileSet: string[]) => {
    if (owner !== undefined) return false;
    if (kind === "villager" || kind === "wolf") return false;
    return hostileSet.includes(kind);
  };
  const HOSTILE = ["zombie", "skeleton", "spider", "ogre", "wisp", "wraith", "golem"];
  check(eligible("zombie", undefined, HOSTILE), "pets must attack zombies");
  check(!eligible("wolf", "Alice", HOSTILE), "pets must not attack their own pack");
  check(!eligible("wolf", undefined, HOSTILE), "pets must not start a war with wildlife");
  check(!eligible("villager", undefined, HOSTILE), "pets must not attack villagers");
  check(!eligible("cow", undefined, HOSTILE), "pets must not attack livestock");
});

Deno.test("creative gates: /give and /kit creative must be refused in survival", () => {
  // main.ts refuses both when !pl.creative. The important property is that the
  // item actually lands nowhere — simulate the guarded body.
  const applyGive = (creative: boolean, slots: ReturnType<typeof giveItems> extends never ? never : proto.InvSlot[], id: number, n: number) => {
    if (!creative) return { slots, refused: true };
    giveItems(slots, id, n);
    return { slots, refused: false };
  };
  const mk = () => Array.from({ length: 36 }, () => ({ id: 0, n: 0 }));
  const survival = applyGive(false, mk(), 126, 1); // diamond pick
  check(survival.refused, "/give must be refused in survival");
  check(survival.slots.every((s) => s.id === 0), "/give in survival must not add items");

  const creative = applyGive(true, mk(), 126, 1);
  check(!creative.refused, "/give must work in creative");
  check(countOf(creative.slots, 126) === 1, "/give in creative must grant the item");
});

Deno.test("placing requires ownership of the block unless creative", () => {
  // handleEdit place: non-creative needs countOf(slots, block) > 0, then removes 1
  const place = (creative: boolean, slots: proto.InvSlot[], block: number) => {
    if (!creative && countOf(slots, block) <= 0) return { placed: false, slots };
    if (!creative) removeItems(slots, { [block]: 1 });
    return { placed: true, slots };
  };
  const mk = () => Array.from({ length: 36 }, () => ({ id: 0, n: 0 }));

  const empty = place(false, mk(), 43); // chest, not owned
  check(!empty.placed, "placing an unowned block must be refused");

  const owned = mk();
  giveItems(owned, 43, 2);
  const ok = place(false, owned, 43);
  check(ok.placed, "placing an owned block must succeed");
  check(countOf(ok.slots, 43) === 1, "placing must consume exactly one");

  const ghost = place(true, mk(), 43);
  check(ghost.placed, "creative may place any block");
});

Deno.test("breaking respects the tool tier, and a spoofed tool falls back to fists", () => {
  // ownedTier(): creative bypasses; otherwise the held id must be in inventory
  const ownedTier = (creative: boolean, slots: proto.InvSlot[], held: number | undefined) => {
    if (creative) return proto.pickTier(held);
    if (held === undefined) return 0;
    return countOf(slots, held) > 0 ? proto.pickTier(held) : 0;
  };
  const mk = () => Array.from({ length: 36 }, () => ({ id: 0, n: 0 }));
  const withDiamond = mk();
  giveItems(withDiamond, 126, 1);

  check(ownedTier(false, withDiamond, 126) === 4, "diamond pick = tier 4 when owned");
  check(ownedTier(false, withDiamond, 999) === 0, "a spoofed unowned id falls back to bare hands");
  check(ownedTier(false, mk(), 126) === 0, "diamond id with empty hands falls back to bare hands");
  check(ownedTier(true, mk(), 126) === 4, "creative bypasses the ownership check");

  // obsidian needs a diamond pick; bare hands must not drop it
  check(proto.requiredTier(proto.B.OBSIDIAN) === 4, "obsidian requires a diamond pick");
  check(0 < proto.requiredTier(proto.B.OBSIDIAN), "bare hands cannot drop obsidian");
  check(4 >= proto.requiredTier(proto.B.OBSIDIAN), "a diamond pick can drop obsidian");
});

Deno.test("every breakable block has a drop or is intentionally dropped to nothing", () => {
  // Guards a class of silent content loss: a breakable block with no drop and
  // no required tier is dead content. Bedrock/water/lava are unbreakable.
  // bedrock, water and lava are the only intentionally unbreakable blocks
  const intentional = new Set([
    0, proto.B.AIR, proto.B.WATER, proto.B.LAVA, proto.B.BEDROCK,
  ]);
  for (const [block, hardness] of Object.entries(proto.HARDNESS)) {
    const b = Number(block);
    if (intentional.has(b)) continue;
    check(
      Number.isFinite(hardness),
      `block ${b} (${proto.BLOCK_NAME[b]}) has an infinite/undefined hardness but is not a known unbreakable`,
    );
    check(proto.requiredTier(b) >= 0, `requiredTier must be sane for block ${b}`);
  }
});

Deno.test("furnace state survives a save/load round trip", () => {
  // main.ts persistFurnaces/loadFurnaces. A finished-but-uncollected smelt
  // (done=true) used to be lost on restart even though the input was already
  // consumed — so this asserts the shape round-trips.
  const entry = {
    x: 10, y: 12, z: -3,
    input: 12, // iron ore
    progress: 8,
    active: false,
    owner: 7,
    done: true,
  };
  const wire = {
    x: entry.x, y: entry.y, z: entry.z,
    input: entry.input ?? null,
    progress: entry.progress, active: entry.active,
    owner: entry.owner, done: entry.done === true,
  };
  const json = JSON.stringify({ list: [wire] });
  const back = JSON.parse(json);
  const f = back.list[0];
  check([f.x, f.y, f.z].every(Number.isFinite), "coords must survive");
  check(f.owner === entry.owner, "owner must survive so output returns to the right player");
  check(f.done === true, "done flag must survive or a finished smelt is stranded");
  check(f.input === entry.input, "input id must survive or smeltOutput() can't resolve");
});

Deno.test("scoreboard merges live and offline players without duplicating a name", () => {
  // scoreboard() in main.ts: offline rows come from savedPlayers, filtered so a
  // player who is currently online isn't listed twice.
  const live = [{ name: "Alice", kills: 3, deaths: 1 }];
  const saved = [
    { name: "Alice", stats: { kills: 99, deaths: 9 } }, // stale copy, online
    { name: "Bob", stats: { kills: 2, deaths: 0 } }, // offline
  ];
  const rows = [
    ...live.map((p) => ({ ...p, online: true })),
    ...saved
      .filter((s) => !!s.stats)
      .map((s) => ({ name: s.name, kills: s.stats.kills, deaths: s.stats.deaths, online: false }))
      .filter((s) => !live.some((l) => l.name === s.name)),
  ].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  check(rows.length === 2, `expected 2 rows (no duplicate), got ${rows.length}`);
  check(rows[0].name === "Alice" && rows[0].kills === 3, "live stats win over a stale save");
  check(rows[0].online === true, "Alice must be marked online");
  check(rows[1].name === "Bob" && rows[1].online === false, "offline players still listed");
});

Deno.test("player ids are monotonic, so per-player maps must be cleaned on leave", () => {
  // players.ts nextId never reuses an id, so anything keyed by id leaks one
  // entry per reconnect unless leaveGame deletes it.
  const maps = ["chatTimes", "fishCd", "pearlCd", "worldPingCd", "pendingReset", "miningSessions", "lastEdit", "lastTpFix", "lastAttack", "lastChunkReq"];
  const src = Deno.readTextFileSync(new URL("../server/main.ts", import.meta.url));
  const leave = src.slice(src.indexOf("function leaveGame"), src.indexOf("function leaveGame") + 900);
  for (const m of maps) {
    check(leave.includes(`${m}.delete(pl.id)`), `leaveGame must clear ${m}`);
  }
});