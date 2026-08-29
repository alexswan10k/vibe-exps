# LM Studio Dashboard

Standalone `file://` dashboard for LM Studio's local server (`http://localhost:1234`).

**Open:** `lmstudio-dashboard/index.html` as `file:///` — no build, no server needed. LM Studio already sends `Access-Control-Allow-Origin: *`.

## What works with zero helpers
- Loaded models, catalog, context lengths, capabilities
- Live inference: phase (prompt eval → reasoning → generating), TTFT, instant/avg tok/s, p50 latency, reasoning vs content split, context window gauge, live tok/s + latency chart, SSE inspector, event log
- Throughput bench (`POST /v1/chat/completions` with `usage` + `stats` for speculative decoding) + playground streaming
- Ping + auto-poll, CORS diagnostics

All of that is in `index.html` alone.

## Optional Deno bridge
The HTTP API doesn't expose `sizeBytes`/`paramsString`/`queued`/`parallel`/`status` from `lms ps --json`. If you want those extra fields:

```bash
deno run --allow-run --allow-net --allow-env lmstudio-dashboard/bridge.ts
# or: cd lmstudio-dashboard && deno run --allow-run --allow-net --allow-env bridge.ts
# custom port: deno run --allow-run --allow-net --allow-env lmstudio-dashboard/bridge.ts --port 1235
```

Dashboard auto-detects `http://localhost:1235/lms-ps` when it's running; otherwise stays fully standalone. Config collapsed under **Advanced — optional Deno bridge** in the Live panel.

No Python needed.
