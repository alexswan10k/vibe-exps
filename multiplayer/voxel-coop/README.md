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
- furnace: 1 iron ore + 1 coal → 1 iron ingot (8s)
- torches emit real flickering point light (nearest 6, pooled)
- fall damage, swing rate-limit (3 hits/sec) on mob attacks
- lifeforms: pigs, cows, chickens, sheep; zombies hunt at night and **burn in
  daylight**. Click mobs to hit them (hit-flash + knockback, 3 swings/sec);
  stone sword drops a zombie in 4 hits. Drops: pork/wool/feather/coal.
- recipe **book** under the crafting grid: green = buildable with what you're
  carrying, pattern preview included, click to auto-fill the grid.
- day/night cycle, chat (T), coop player avatars + name tags
- world + inventories persist across restarts
- touch controls for iPad: tap 📱 for joystick + drag-look + jump/mine/place/
  attack/inventory buttons (hold ⛏️ to mine, tap hotbar slots to select)

## Protocol (WS JSON)

`hello → welcome`, `reqChunk → chunk` (RLE), `edit → block`,
`move → players` (10Hz), `mobs` (2Hz), `inv`, `vitals`, `time`, `chat`,
`craft`, `smelt`, `attackMob`, `eat`, `moveItem`, `respawn`.
