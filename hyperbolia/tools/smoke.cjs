/* Headless smoke test: load HYPERBOLIA in real Chrome with SwiftShader,
   capture console errors and a screenshot. */
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const { spawn } = require("node:child_process");
const http = require("node:http");
const fs = require("node:fs");

const URL_ = process.argv[2] || "http://localhost:8231/index.html";
const OUT = process.argv[3] || "/tmp/hb_shot.png";
const WAIT = parseInt(process.argv[4] || "4000", 10);

const port = 9333;
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--window-size=1400,860",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=/tmp/hb-chrome-profile",
    "about:blank",
  ],
  { stdio: ["ignore", "pipe", "pipe"] }
);

let stderr = "";
chrome.stderr.on("data", (d) => (stderr += d));

const get = (path) =>
  new Promise((res, rej) => {
    http
      .get({ host: "127.0.0.1", port, path }, (r) => {
        let b = "";
        r.on("data", (d) => (b += d));
        r.on("end", () => res(JSON.parse(b)));
      })
      .on("error", rej);
  });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let targets = null;
  for (let i = 0; i < 60; i++) {
    try {
      targets = await get("/json/list");
      if (targets.find((t) => t.type === "page")) break;
    } catch {}
    await wait(250);
  }
  if (!targets) {
    console.error("chrome did not start\n" + stderr.slice(-2000));
    process.exit(1);
  }

  const WebSocket = await tryWs();
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  const logs = [];
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) =>
    new Promise((res) => {
      const i = ++id;
      pending.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params }));
    });

  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m.result);
      pending.delete(m.id);
    } else if (m.method === "Runtime.consoleAPICalled") {
      logs.push(
        m.params.type + ": " +
          m.params.args.map((a) => a.value ?? a.description ?? "").join(" ")
      );
    } else if (m.method === "Runtime.exceptionThrown") {
      const d = m.params.exceptionDetails;
      logs.push(
        "EXCEPTION: " + (d.exception?.description || d.text)
      );
    } else if (m.method === "Log.entryAdded") {
      logs.push("LOG[" + m.params.entry.level + "]: " + m.params.entry.text);
    }
  };

  await new Promise((r) => (ws.onopen = r));
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: URL_ });
  await wait(WAIT);

  // Optional setup script: dismiss the overlay, move the player, etc.
  const setup = process.env.SETUP;
  if (setup) {
    const r = await send("Runtime.evaluate", {
      expression: setup,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r?.exceptionDetails) console.log("SETUP ERROR:", r.exceptionDetails.text);
    else console.log("setup ->", JSON.stringify(r?.result?.value));
    await wait(parseInt(process.env.SETUP_WAIT || "2500", 10));
  }

  // Probe app state.
  const probe = await send("Runtime.evaluate", {
    expression: `(() => {
      const H = window.HYPERBOLIA;
      const c = document.getElementById('scene');
      return JSON.stringify({
        hasApp: !!H,
        fatal: getComputedStyle(document.getElementById('fatal')).display,
        fatalMsg: document.getElementById('fatal-msg').textContent.slice(0,900),
        canvas: c ? c.width + 'x' + c.height : null,
        fps: H ? Math.round(H.renderer.fps) : null,
        scale: H ? +H.renderer.scale.toFixed(2) : null,
        steps: H ? Math.round(H.params.quality*104)+56 : null,
        room: H ? H.params.room : null,
        fpsHud: (document.getElementById('hud-fps')||{}).textContent,
        dist: (document.getElementById('hud-dist')||{}).textContent,
        tile: (document.getElementById('hud-tile')||{}).textContent,
        diskTiles: window.PoincareDisk ? 'cls' : 'no',
      });
    })()`,
    returnByValue: true,
  });

  const shot = await send("Page.captureScreenshot", { format: "png" });
  if (shot && shot.data) fs.writeFileSync(OUT, Buffer.from(shot.data, "base64"));

  console.log("--- probe ---");
  console.log(probe?.result?.value || JSON.stringify(probe));
  console.log("--- console (" + logs.length + ") ---");
  console.log(logs.slice(0, 40).join("\n"));
  console.log("--- screenshot:", OUT, shot?.data ? "ok" : "FAILED");

  ws.close();
  chrome.kill();
  process.exit(0);
})();

async function tryWs() {
  try {
    return (await import("ws")).default;
  } catch {
    // Node 22+ has a global WebSocket.
    if (typeof WebSocket === "function") return WebSocket;
    throw new Error("need ws");
  }
}
