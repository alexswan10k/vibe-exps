// Guard the protocol.ts <-> config.js mirror.
//
// The project has no build step, so server/protocol.ts and client/js/config.js
// must be kept in sync BY HAND. This suite is the automated check for that: it
// asserts the two agree. This closes a whole class of silent, severe bugs —
// e.g. gold/diamond ore mining computed 0.55s on the client vs 3.67s on the
// server, so the break bar finished early, the server answered "keep mining",
// and those blocks were unbreakable despite the README claiming otherwise.
//
// Written as a Deno test (not node) precisely because it must import the real
// server TypeScript module alongside the plain-JS client mirror.

import * as proto from "../server/protocol.ts";
import * as client from "../client/js/config.js";

const root = new URL("../", import.meta.url);
const readFileSync = (p: string | URL): string => Deno.readTextFileSync(p);
let checks = 0;

function same(what: string, a: unknown, b: unknown): void {
  checks++;
  const sa = JSON.stringify(a, replacer);
  const sb = JSON.stringify(b, replacer);
  if (sa !== sb) {
    throw new Error(
      `${what} differs between server/protocol.ts and client/js/config.js\n` +
      `  server: ${sa}\n  client: ${sb}`,
    );
  }
}
// Set -> array (JSON would otherwise serialise both as {})
function replacer(_k: string, v: unknown): unknown {
  return v instanceof Set ? [...v].sort((a, b) => Number(a) - Number(b)) : v;
}

// ---- 1. block ids ----
same("B block map", { ...proto.B }, { ...client.B });

// ---- 2. scalar constants ----
for (const k of ["CHUNK", "WORLD_H", "SEA_LEVEL", "PLAYER_EYE"] as const) {
  same(k, proto[k], client[k]);
}

// ---- 3. numeric tables, both directions ----
same("HARDNESS", { ...proto.HARDNESS }, { ...client.HARDNESS });
same("PICK_MULT", { ...proto.PICK_MULT }, { ...client.PICK_MULT });
same("AXE_MULT", { ...proto.AXE_MULT }, { ...client.AXE_MULT });
same("SHOVEL_MULT", { ...proto.SHOVEL_MULT }, { ...client.SHOVEL_MULT });
same("WALK_THROUGH", new Set(proto.WALK_THROUGH), new Set(client.WALK_THROUGH));

// BLOCK_NAME is a superset on the client (101-113 material/tool names the server
// lacks), so assert one-way: every server name must exist and match on client.
const clientNames: Record<number, string> = client.BLOCK_NAME;
for (const [id, name] of Object.entries(proto.BLOCK_NAME)) {
  checks++;
  if (clientNames[Number(id)] !== name) {
    throw new Error(
      `BLOCK_NAME[${id}]: server "${name}" vs client "${clientNames[Number(id)]}"`,
    );
  }
}

// ---- 4. the bug that motivated this file ----
// The client's pick-block set and "slow by hand" set must equal the server's
// TOOL_CLASS derivation, and miningSeconds() must agree for every block x tool.
const serverPickEffective = new Set(
  Object.keys(proto.TOOL_CLASS).map(Number).filter((b) => proto.TOOL_CLASS[b as keyof typeof proto.TOOL_CLASS] === "pick"),
);
same("pick-effective block set (PICK_BLOCKS)", client.PICK_BLOCKS, new Set([3, 11, 12, 14, 16, 24, 27, 38, 41, 42, 44, 45, 46, 47, 48, 49, 50, 51]));
same("slow-by-hand block set (TOOL_CLASS === pick)", client.PICK_SLOW, serverPickEffective);

const TOOLS = [
  undefined, 108, 109, 110, 124, 126, // picks
  116, 117, 118, 128, 129, // axes
  119, 120, 121, 130, 131, // shovels
];
for (let block = 0; block <= 52; block++) {
  for (const tool of TOOLS) {
    checks++;
    const serverMult = proto.toolMultFor(block, tool);
    const clientMult = client.toolMultFor(block, tool);
    if (serverMult !== clientMult) {
      throw new Error(`toolMultFor(block=${block}, held=${tool}): server ${serverMult} vs client ${clientMult}`);
    }
    // reproduce the server's miningSeconds() (main.ts) exactly
    const base = proto.HARDNESS[block];
    const expected = base === undefined || base === Infinity
      ? Infinity
      : proto.TOOL_CLASS[block as keyof typeof proto.TOOL_CLASS] === "pick" && serverMult <= 1
      ? base * 3.3
      : base / serverMult;
    const got = client.miningSeconds(block, tool, false);
    if (got !== expected) {
      throw new Error(
        `miningSeconds(block=${block}, held=${tool}): server ${expected} vs client ${got} — ` +
        `the client break bar would finish before the server accepts the break`,
      );
    }
  }
}

// ---- 5. unbreakable blocks must agree ----
for (const [block, hardness] of Object.entries(proto.HARDNESS)) {
  checks++;
  const clientInfinite = client.miningSeconds(Number(block), undefined, false) === Infinity;
  if (clientInfinite !== (hardness === Infinity)) {
    throw new Error(`block ${block} unbreakable-ness differs (HARDNESS ${hardness})`);
  }
}

// ---- 6. the placement whitelist must cover every non-special block ----
// the server rejects AIR/WATER/BEDROCK/LAVA on place (handleEdit)
for (const id of Object.values(proto.B)) {
  if (id === proto.B.AIR || id === proto.B.WATER || id === proto.B.LAVA || id === proto.B.BEDROCK) continue;
  checks++;
  if (!client.isPlaceable(id)) throw new Error(`block ${id} should be placeable`);
}
for (const id of [0, proto.B.BEDROCK, proto.B.WATER, proto.B.LAVA]) {
  checks++;
  if (client.isPlaceable(id)) throw new Error(`block ${id} should not be placeable`);
}

// ---- 7. message names must line up on both sides ----
const serverSrc = readFileSync(new URL("server/main.ts", root));
const clientMain = readFileSync(new URL("client/js/main.js", root));
const collect = (src: string, re: RegExp) => new Set([...src.matchAll(re)].map((m) => m[1]));

const protocolSrc = readFileSync(new URL("server/protocol.ts", root));
// Split the union into the two directions so each is checked against the side
// that actually speaks it (they share the `t:` literal shape).
const clientMsgBlock = protocolSrc.slice(
  protocolSrc.indexOf("export type ClientMsg"),
  protocolSrc.indexOf("export type ServerMsg"),
);
const clientDeclared = collect(clientMsgBlock, /\{\s*t:\s*"([a-zA-Z]+)"/g);
const serverDeclared = collect(protocolSrc.slice(protocolSrc.indexOf("export type ServerMsg")), /\{\s*t:\s*"([a-zA-Z]+)"/g);

const serverCases = collect(serverSrc, /case\s+"([a-zA-Z]+)":/g);
// "hello" opens the session at the websocket upgrade, not in onMessage
serverCases.add("hello");
for (const t of clientDeclared) {
  checks++;
  if (!serverCases.has(t)) throw new Error(`protocol declares message "${t}" but main.ts has no case for it`);
}
// net.js also emits local transport lifecycle events that never appear on the wire
const localOnly = new Set(["open", "close"]);
for (const t of collect(clientMain, /net\.on\("([a-zA-Z]+)"/g)) {
  if (localOnly.has(t)) continue;
  checks++;
  if (!serverDeclared.has(t)) throw new Error(`main.js handles "${t}" which is not a declared ServerMsg`);
}

Deno.test(`protocol.ts and config.js agree (${checks} assertions)`, () => {});