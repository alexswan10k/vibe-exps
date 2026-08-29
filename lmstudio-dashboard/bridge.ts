#!/usr/bin/env -S deno run --allow-run --allow-net --allow-env
/**
 * LM Studio Bridge — Deno
 * Exposes `lms ps --json` over HTTP with CORS so the file:// dashboard
 * can show `status`/`queued`/`parallel`/`size`/`params` which the plain
 * HTTP API does NOT expose. Everything else works without this.
 *
 * Run:
 *   deno run --allow-run --allow-net --allow-env lmstudio-dashboard/bridge.ts          # :1235
 *   deno run --allow-run --allow-net --allow-env lmstudio-dashboard/bridge.ts --port 1235
 *   # or: cd lmstudio-dashboard && deno run --allow-run --allow-net --allow-env bridge.ts
 *
 * Or with the task: deno task bridge
 */
const args = Deno.args;
function getArg(name: string, fallback: string): string {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}
const PORT = parseInt(getArg("--port", "1235"), 10);
const INTERVAL = parseFloat(getArg("--interval", "0.7"));
const LMS = getArg("--lms", Deno.env.get("LMS_BIN") ?? "/Users/alex/.lmstudio/bin/lms");

let state: { data: unknown[]; error: string | null; updated: number } = {
  data: [],
  error: null,
  updated: 0,
};

async function poll() {
  try {
    const cmd = new Deno.Command(LMS, { args: ["ps", "--json"], stdout: "piped", stderr: "piped" });
    const { stdout, success, stderr } = await cmd.output();
    if (!success) throw new Error(new TextDecoder().decode(stderr).trim() || `lms ps failed`);
    const text = new TextDecoder().decode(stdout);
    const data = JSON.parse(text);
    state = { data, error: null, updated: Date.now() };
  } catch (e) {
    state.error = e instanceof Error ? e.message : String(e);
    // keep old data
  }
}
setInterval(poll, INTERVAL * 1000);
poll();

Deno.serve({ port: PORT, hostname: "127.0.0.1" }, (req) => {
  const url = new URL(req.url);
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "cache-control": "no-store",
  };
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: cors });
  }
  if (url.pathname === "/lms-ps" || url.pathname === "/ps" || url.pathname === "/api/ps") {
    const body = JSON.stringify(state);
    return new Response(body, { status: 200, headers: { ...cors, "content-type": "application/json", "content-length": String(body.length) } });
  }
  if (url.pathname === "/health" || url.pathname === "/") {
    const body = JSON.stringify({ ok: true, bridge: "lmstudio-deno", port: PORT, hint: "GET /lms-ps" });
    return new Response(body, { status: 200, headers: { ...cors, "content-type": "application/json" } });
  }
  return new Response(JSON.stringify({ error: "not found, try /lms-ps" }), { status: 404, headers: cors });
});
console.log(`LM Studio bridge (deno) on http://localhost:${PORT}/lms-ps  interval ${INTERVAL}s  via ${LMS}`);
console.log(`Dashboard: open lmstudio-dashboard/index.html as file:// — auto-detects :${PORT} if this is running, otherwise fully standalone.`);
