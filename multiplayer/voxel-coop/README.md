# voxel-coop 🧱 — 2-player LAN Minecraft clone

Deno server (authoritative) + Three.js client. Plain `http://`, no TLS/certs:
host plays, second player joins over the same Wi-Fi.

## Run

```sh
deno task dev
# local:  http://localhost:8000/
# player 2: http://<your-lan-ip>:8000/   (printed on startup)
```

Both players just open the URL — the client is served by the server
(same-origin, so no CORS headaches). `file://` also works if you pass
`?server=<lan-ip>:8000`, CORS `*` is enabled for that path.

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
- inventory (36 slots) + recipe-book crafting (planks → table → picks/swords/furnace/torches);
  table recipes require a placed table within 4 blocks (enforced server-side)
- furnace: 1 iron ore + 1 coal → 1 iron ingot (8s)
- torches emit real flickering point light (nearest 6, pooled)
- fall damage, swing rate-limit (3 hits/sec) on mob attacks
- lifeforms: pigs, cows, chickens, sheep; zombies hunt you at night (pork/wool/feather/coal drops)
- day/night cycle, chat (T), coop player avatars + name tags
- world + inventories persist across restarts

## Protocol (WS JSON)

`hello → welcome`, `reqChunk → chunk` (RLE), `edit → block`,
`move → players` (10Hz), `mobs` (2Hz), `inv`, `vitals`, `time`, `chat`,
`craft`, `smelt`, `attackMob`, `eat`, `moveItem`, `respawn`.
