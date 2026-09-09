# voxel-coop 🧱 — 2-player LAN Minecraft clone

Deno server (authoritative) + Three.js client. Plain `http://`, no TLS/certs:
host plays, second player joins over the same Wi-Fi.

## Run

```sh
deno task dev          # survival (default)
deno task peaceful     # no zombies, hunger tops up (chill building)
# local:  http://localhost:8000/
# player 2: http://<your-lan-ip>:8000/   (printed on startup)
```

Both players just open the URL — the client is served by the server
(same-origin, so no CORS headaches). The server prints its LAN URLs on
startup (`--allow-sys` lets it list your network interfaces).

Old iPad with broken websockets? Open the page with `?transport=poll`
(auto-fallback kicks in after 6s if websockets fail). Poll mode is plain
HTTP POST (`/api/join` + `/api/poll`), ~4Hz — playable on LAN, laggier
than sockets. Check `/api/status` for `mode` + who's online.

## Layout

```
server/main.ts    HTTP + WS, edit validation, tick loops, persistence
server/protocol.ts shared constants + wire message types (mirrored in client/js/config.js)
server/world.ts   seeded terrain gen, block overrides, chunk RLE, save/load
server/players.ts vitals, hunger, inventories, join/leave
server/mobs.ts    passive wanderers + night zombies (server-simulated)
server/crafting.ts recipes, mining drops, furnace smelting
client/js/        config, net, world (meshing), player (physics),
                  entities (mobs + remote players), ui, main
client/libs/three.min.js  vendored — works offline on LAN
data/             world.json + players.json (gitignored saves)
```

## Features

- infinite seeded terrain (hills, beaches, snow peaks, oceans, trees, ores)
- hold-to-mine with tool tiers (wood → stone → iron), bedrock unbreakable
- survival: hearts, hunger, fall damage, starvation, death/respawn
- inventory (36 slots) + Minecraft-style shaped crafting grid (2×2, 3×3 near
  a placed table): click an item, click grid cells (shift-click = whole stack),
  click the result. Translation + mirror tolerant, server-validated.
- recipe **book** v2: search, filters (all/craftable/tools/blocks/basics),
  craftable-first sort, per-ingredient have/need chips, **Craft** button for
  1-click server-side crafting (shift-click = craft max), ▦ fills the grid
  the old manual way. Furnace cheat-sheet included.
- tools: pickaxes (stone/ores), axes (logs/planks/tables, also hit hard),
  shovels (dirt/sand/grass/snow) — wood → stone → iron → gold → diamond tiers
- mining: coal → iron → **gold + diamond ores** deep down (iron pick+ to drop);
  diamond pick mines everything, diamond sword 2-shots zombies
- building: fences, stone bricks (2×2 cobble, no table), climbable ladders
  (Space up), glass from sand
- food chain: pigs → pork, cows → beef → steak (best), chickens → drumsticks;
  apples, golden apples (8 gold + apple = full heal); beds set your spawn (RMB/F)
- furnace: iron ore → ingot, gold ore → ingot, raw pork → cooked pork,
  raw beef → steak, raw chicken → roast chicken, sand → glass (8s each)
- furnace: iron ore → ingot, raw pork → cooked pork, sand → glass (8s each)
- furnace: iron/gold ore → ingots, pork/beef/chicken → cooked, sand → glass (8s each)
- glass, gold/diamond ores, fences, bricks, ladders, beds (all mine back to themselves)
- food: raw pork / cooked pork / apple (leaves + zombies drop apples, G or double-click eats)
- iron sword (8 dmg) + wood/stone swords, tool tiers wood → stone → iron
- torches emit real flickering point light (nearest 6, pooled)
- fall damage, swing rate-limit (3 hits/sec) on mob attacks
- lifeforms: pigs, cows, chickens, sheep; zombies hunt at night and **burn in
  daylight**. Click mobs to hit them (hit-flash + knockback, 3 swings/sec);
  stone sword drops a zombie in 4 hits. Drops: pork/wool/feather/coal.
- recipe **book** under the crafting grid: green = buildable with what you're
  carrying, pattern preview included, click to auto-fill the grid.
- day/night cycle with visible sun + glow, moon, and stars; chat (T, with /help /players /spawn /time), coop player avatars + name tags
- render distance 6 chunks (fog to match), far chunks unload as you walk
- unique names (_2 suffix), chat rate-limit, heartbeat ping + exponential-backoff reconnect
- feel: wheel cycles hotbar, coyote-time + jump buffer, sprint FOV kick, synth SFX (M mute), damage vignette, animated water
- real-time sun shadows (1024 PCF-soft cascade around you, P toggles, auto-off on touch) + first-person hand: arm + held block/tool/food with swing, walk-bob, switch pop, and eat animations
- world + inventories persist across restarts
- touch controls for iPad: tap 📱 for joystick + drag-look + jump/mine/place/
  attack/inventory buttons (hold ⛏️ to mine, tap hotbar slots to select)

## Protocol (WS JSON)

`hello → welcome`, `reqChunk → chunk` (RLE), `edit → block`,
`move → players` (10Hz), `mobs` (2Hz), `inv`, `vitals`, `time`, `chat`,
`craft`, `craftDirect`, `smelt`, `attackMob`, `eat`, `moveItem`, `respawn`, `ping → pong`.
