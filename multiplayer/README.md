# multiplayer/ — local-network games (backend required)

These games **cannot** be hosted on the static site — each one runs a local
Deno server on your LAN (plain `http://`, no TLS/certs) that serves its own
client + handles realtime play over WebSocket.

## Pattern (all games follow this)

```
multiplayer/<game>/
  deno.json            # `deno task dev` starts the server
  server/main.ts       # entry: HTTP + WS on 0.0.0.0:<port>, serves ../client/
  server/...           # game logic, split by domain (world, players, etc.)
  client/index.html    # served statically by the server (same-origin => no CORS pain)
  client/js/...        # split client logic
  data/                # gitignored saves (world, players)
```

Conventions:
- **No TLS, no certs.** Plain HTTP + `ws://`. Bind `0.0.0.0` and print LAN IPs.
- **Serve the client from the server.** Primary flow is `http://<host>:<port>/`
  (same-origin, so no CORS issues at all). `file://` is best-effort only.
- **CORS `*` anyway** (see `../shared.ts`) so `file://` or cross-port fetch still works.
- **WebSocket JSON protocol** per game, types in `server/protocol.ts`, mirrored in
  `client/js/config.js` (no build step, so keep them in sync by hand).
- **Ports:** voxel-coop `8000`, future games pick the next free `800x`.
- Each game README documents controls + protocol briefly.

## Run

```sh
cd multiplayer/voxel-coop
deno task dev
# then open http://<your-lan-ip>:8000/ on both machines
```

Requirements: [Deno](https://deno.land) 2.x. No npm, no build.
