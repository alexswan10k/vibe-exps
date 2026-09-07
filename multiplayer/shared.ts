// Shared helpers for all multiplayer/* games.
// Import from a game server with: import { ... } from "../../shared.ts";

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function withCors(resp: Response): Response {
  const h = new Headers(resp.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) h.set(k, v);
  return new Response(resp.body, { status: resp.status, headers: h });
}

/** LAN IPv4 addresses for printing "open http://<ip>:<port>" on startup. */
export function lanIps(): string[] {
  const out: string[] = [];
  try {
    for (const ni of Deno.networkInterfaces()) {
      if (ni.family === "IPv4" && !ni.address.startsWith("127.")) {
        out.push(ni.address);
      }
    }
  } catch { /* --allow-env/deno version without networkInterfaces */ }
  return out;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

/** Serve a file from the game's client/ dir with CORS headers. Null if missing. */
export async function serveClientFile(
  clientDir: string,
  urlPath: string,
): Promise<Response | null> {
  let rel = decodeURIComponent(urlPath.split("?")[0]);
  if (rel === "/" || rel === "") rel = "/index.html";
  if (rel.includes("..") || rel.includes("\0")) {
    return withCors(new Response("bad path", { status: 400 }));
  }
  const path = `${clientDir}${rel}`;
  try {
    const data = await Deno.readFile(path);
    const dot = rel.lastIndexOf(".");
    const ct = dot >= 0 ? (MIME[rel.slice(dot).toLowerCase()] ?? "application/octet-stream") : "application/octet-stream";
    return withCors(new Response(data, { headers: { "Content-Type": ct, "Cache-Control": "no-cache" } }));
  } catch {
    return null;
  }
}
