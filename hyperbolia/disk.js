/* ==========================================================================
 * HYPERBOLIA — Poincaré disk panel
 *
 * A 2D shadow of the walk. The hyperbolic plane fits inside the unit disk,
 * tiles shrink without bound toward the boundary, and a walker travelling in
 * a straight line forever spirals toward that boundary without arriving.
 *
 * The walker's position follows the player's actual motion in the 3D view:
 * forward distance advances t, and the accumulated yaw curves the geodesic.
 * ========================================================================== */

const TILINGS = [
  { p: 7, q: 3, label: "{7,3} heptagonal" },
  { p: 5, q: 4, label: "{5,4} pentagonal" },
  { p: 8, q: 3, label: "{8,3} octagonal" },
  { p: 6, q: 4, label: "{6,4} hexagonal" },
  { p: 4, q: 6, label: "{4,6} square" },
];

class PoincareDisk {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.index = 0;
    this.rings = 4;
    this.cache = new Map();
    /** Hyperbolic distance travelled along the walk. */
    this.t = 0;
    /** Total turning; this is what curves the geodesic. */
    this.phi = 0;
    this.autoplay = true;
    this.playRate = 0.85;
    this.tiles = this.tilesFor(0);
  }

  tilesFor(i) {
    const spec = TILINGS[i];
    const key = `${spec.p},${spec.q},${this.rings}`;
    if (!this.cache.has(key)) {
      const t = buildTiling(spec.p, spec.q, this.rings);
      // Nearest-first, so the draw loop can stop early once tiles are too
      // small on screen to see. A {7,3} tiling grows explosively — five rings
      // is already ten thousand polygons.
      t.sort(
        (a, b) =>
          Math.hypot(...a[0]) - Math.hypot(...b[0])
      );
      this.cache.set(key, t);
    }
    return this.cache.get(key);
  }

  setIndex(i) {
    this.index = ((i % TILINGS.length) + TILINGS.length) % TILINGS.length;
    this.tiles = this.tilesFor(this.index);
  }

  reset() {
    this.t = 0;
    this.phi = 0;
  }

  /**
   * Advance the walk.
   * @param {number} dt        seconds
   * @param {number} forward   hyperbolic distance moved this frame (0 if idle)
   * @param {number} yawDelta  turn this frame, radians
   */
  update(dt, forward, yawDelta) {
    if (this.autoplay && !forward) forward = this.playRate * dt;
    this.t += Math.abs(forward);
    this.phi += yawDelta * 0.55;
  }

  /** Point at hyperbolic distance t along the walker geodesic. */
  walker() {
    const r = Math.tanh(this.t / 2);
    const a = this.phi * (this.t || 1e-9);
    return [r * Math.cos(a), r * Math.sin(a)];
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  draw() {
    this.resize();
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) * 0.44;

    // The boundary is infinitely far away — draw it as the event horizon.
    ctx.save();
    const bg = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
    bg.addColorStop(0, "#0a0f1e");
    bg.addColorStop(0.75, "#070b16");
    bg.addColorStop(1, "#02040a");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();

    const toScreen = (v) => [cx + v[0] * R, cy - v[1] * R];

    /* ---- tiles ---------------------------------------------------------- */
    // Only the innermost few hundred are worth drawing; the rest are sub-pixel
    // and cost more than they show.
    const p = TILINGS[this.index].p;
    const shrink = 0.88;
    const budget = this.tiles.length;
    ctx.lineJoin = "round";
    for (let ti = 0; ti < budget; ti++) {
      const tile = this.tiles[ti];
      const rr = Math.hypot(tile[0][0], tile[0][1]);
      const fade = Math.max(0, 1 - Math.pow(rr, 4));
      if (fade < 0.02) break;
      const hot = Math.max(0, 1 - rr * 1.1);
      ctx.beginPath();
      for (let i = 0; i < p; i++) {
        const [x, y] = toScreen([tile[i][0] * shrink, tile[i][1] * shrink]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(${30 + hot * 40}, ${58 + hot * 60}, ${104 + hot * 70}, ${
        0.06 + fade * 0.10 + hot * 0.14
      })`;
      ctx.fill();
      ctx.strokeStyle = `rgba(120, 200, 240, ${0.12 + fade * 0.5})`;
      ctx.lineWidth = Math.max(0.5, R * 0.0035) * (0.7 + fade);
      ctx.stroke();
    }

    /* ---- the walker's geodesic ---------------------------------------- */
    ctx.beginPath();
    const N = 220;
    for (let i = 0; i <= N; i++) {
      const tt = (i / N) * Math.min(this.t, 22);
      const a = this.phi * (tt || 1e-9);
      const rr = Math.tanh(tt / 2);
      const [x, y] = toScreen([rr * Math.cos(a), rr * Math.sin(a)]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(255, 196, 92, 0.85)";
    ctx.lineWidth = Math.max(1, R * 0.012);
    ctx.lineCap = "round";
    ctx.stroke();

    /* ---- unit ticks along the geodesic --------------------------------- */
    ctx.font = `${Math.max(8, R * 0.075)}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let n = 1; n <= 10 && n <= this.t; n++) {
      const tt = n;
      const a = this.phi * tt;
      const rr = Math.tanh(tt / 2);
      const [x, y] = toScreen([rr * Math.cos(a), rr * Math.sin(a)]);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.2, R * 0.012), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 214, 140, 0.95)";
      ctx.fill();
      ctx.fillStyle = "rgba(255, 224, 180, 0.75)";
      ctx.fillText(String(n), x, y - R * 0.045);
    }

    /* ---- walker marker --------------------------------------------------- */
    const w = this.walker();
    const [wx, wy] = toScreen(w);
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 380);
    ctx.beginPath();
    ctx.arc(wx, wy, R * (0.035 + pulse * 0.02), 0, Math.PI * 2);
    ctx.fillStyle = "#ffd27a";
    ctx.shadowColor = "rgba(255, 180, 60, 0.9)";
    ctx.shadowBlur = R * 0.14;
    ctx.fill();
    ctx.shadowBlur = 0;

    /* ---- origin ---------------------------------------------------------- */
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.014, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(150, 220, 255, 0.9)";
    ctx.lineWidth = Math.max(1, R * 0.006);
    ctx.stroke();

    /* ---- boundary -------------------------------------------------------- */
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(120, 190, 240, 0.5)";
    ctx.lineWidth = Math.max(1, R * 0.006);
    ctx.stroke();

    ctx.restore();
  }

  /** Numbers for the panel readout, kept out of the canvas so they never
   *  collide with the tiling. */
  readout() {
    const w = this.walker();
    return {
      hyper: this.t,
      diskR: Math.hypot(w[0], w[1]),
      side: this.tileSide(),
      label: TILINGS[this.index].label,
    };
  }

  tileSide() {
    const t = this.tiles[0];
    return disk.hypDist(t[0], t[1]);
  }
}
