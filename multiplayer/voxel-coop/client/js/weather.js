// Weather FX: lightning strikes + storm dimming. Client-only, no new server msgs.
// Server sends {t:"strike";x,y,z} and time msgs with optional `storm`.
// Respects window.voxSettings?.showWeather !== false. Uses global THREE.
let sceneRef = null;
let storm = 0;
const bolts = [];
let actx = null;

function enabled() {
  try {
    return window.voxSettings?.showWeather !== false;
  } catch {
    return true;
  }
}

export function initWeather(scene) {
  sceneRef = scene;
}

export function onTime(m) {
  try {
    if (m && typeof m.storm === "number") storm = m.storm;
  } catch { /* noop */ }
}

export function setStorm(v) {
  storm = Number(v) || 0;
}

export function getStorm() {
  return storm;
}

function distTo(m, p) {
  try {
    const px = p?.x ?? (Array.isArray(p) ? p[0] : 0);
    const py = p?.y ?? (Array.isArray(p) ? p[1] : 0);
    const pz = p?.z ?? (Array.isArray(p) ? p[2] : 0);
    return Math.hypot((m.x ?? 0) - px, (m.y ?? 0) - py, (m.z ?? 0) - pz);
  } catch {
    return 0;
  }
}

function flashScreen() {
  try {
    const d = document.createElement("div");
    d.id = "storm-flash";
    d.style.cssText = "position:fixed;inset:0;background:#fff;opacity:0.7;pointer-events:none;z-index:9999;transition:opacity 0.35s;";
    document.body.appendChild(d);
    requestAnimationFrame(() => { d.style.opacity = "0"; });
    setTimeout(() => d.remove(), 400);
  } catch { /* noop */ }
}

function thunder(dist) {
  try {
    const delayMs = Math.min(4000, Math.max(0, (dist / 343) * 1000));
    const vol = Math.max(0.05, 1 - dist / 90);
    setTimeout(() => {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        actx ??= new AC();
        if (actx.state === "suspended") void actx.resume();
        const dur = 1.2 + Math.random() * 0.8;
        const buf = actx.createBuffer(1, Math.floor(actx.sampleRate * dur), actx.sampleRate);
        const ch = buf.getChannelData(0);
        for (let i = 0; i < ch.length; i++) {
          ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 2);
        }
        const src = actx.createBufferSource();
        src.buffer = buf;
        const f = actx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = 110 + Math.random() * 90;
        const g = actx.createGain();
        g.gain.value = vol * 0.9;
        src.connect(f);
        f.connect(g);
        g.connect(actx.destination);
        src.start();
      } catch { /* noop */ }
    }, delayMs);
  } catch { /* noop */ }
}

export function onStrike(m, playerPos) {
  if (!enabled()) return;
  if (!sceneRef || typeof THREE === "undefined") return;
  try {
    const x = Number(m?.x) || 0;
    const y = Number(m?.y) || 0;
    const z = Number(m?.z) || 0;
    const segs = 9;
    const top = 22;
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const spread = 2.2 * (1 - t * 0.4);
      pts.push(new THREE.Vector3(
        x + (Math.random() - 0.5) * spread,
        y + top * (1 - t),
        z + (Math.random() - 0.5) * spread,
      ));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0xd8ecff, transparent: true, opacity: 1 });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    sceneRef.add(line);
    bolts.push({ line, mat, life: 0.4 });
    flashScreen();
    thunder(distTo({ x, y, z }, playerPos));
  } catch { /* noop */ }
}

export function updateWeather(dt) {
  // fade bolts (~0.4s)
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    try {
      b.life -= dt;
      b.mat.opacity = Math.max(0, b.life / 0.4);
      if (b.life <= 0) {
        sceneRef?.remove(b.line);
        b.line.geometry?.dispose?.();
        b.mat.dispose?.();
        bolts.splice(i, 1);
      }
    } catch {
      bolts.splice(i, 1);
    }
  }
  // storm dimming on top of applyTime (which already handles rain gloom)
  if (storm > 0 && enabled()) {
    try {
      const bg = sceneRef?.background;
      if (bg && bg.isColor) bg.multiplyScalar(Math.max(0.55, 1 - Math.min(1, storm) * 0.25));
      if (sceneRef?.fog?.color) sceneRef.fog.color.copy(bg);
    } catch { /* noop */ }
  }
}
