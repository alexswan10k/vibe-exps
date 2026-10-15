/* ==========================================================================
 * HYPERBOLIA — application shell
 *
 * Wires the renderer, the player, the Poincaré panel and the DOM controls
 * into one frame loop. All tunable state lives in a single `params` object so
 * the shader, the physics and the readouts can never disagree.
 * ========================================================================== */

(function bootstrapHyperbolia() {
  const canvas = document.getElementById("scene");
  const diskCanvas = document.getElementById("disk");

  let renderer;
  try {
    renderer = new HyperRenderer(canvas);
  } catch (err) {
    document.getElementById("fatal").style.display = "flex";
    document.getElementById("fatal-msg").textContent = err.message;
    return;
  }

  const player = new HyperPlayer();
  const disk = new PoincareDisk(diskCanvas);

  /* ------------------------------------------------------------- params */

  const params = {
    room: 1.15, // hyperbolic room size T
    door: 0.42, // doorway half-width as a fraction of half a room
    fog: 0.22,
    glow: 1.0,
    panel: 1.0,
    palette: 0.0,
    head: 0.9,
    shadow: 0.7,
    curv: 1.0, // 1 = hyperbolic, 0 = flat Euclidean lattice
    quality: 1.0,
    aa: false,
    speed: 3.2,
    fov: 72,
    showDisk: true,
  };

  /** Klein spacing implied by the current room size. */
  const kleinD = () => (params.curv > 0.5 ? Math.sinh(params.room) : params.room);

  /* --------------------------------------------------------------- HUD */

  const hud = {
    fps: document.getElementById("hud-fps"),
    dist: document.getElementById("hud-dist"),
    res: document.getElementById("hud-res"),
    steps: document.getElementById("hud-steps"),
    tile: document.getElementById("hud-tile"),
    diskHyper: document.getElementById("disk-hyper"),
    diskRadius: document.getElementById("disk-radius"),
    diskSide: document.getElementById("disk-side"),
  };

  let hudTick = 0;

  const marchSteps = () => Math.round(56 + params.quality * 104);

  function updateHud() {
    const cam = player.camera;
    const k = cam.klein;
    const D = kleinD();
    hud.fps.textContent = renderer.fps.toFixed(0);
    hud.dist.textContent = cam.odometer.toFixed(1);
    hud.res.textContent =
      `${Math.round(renderer.scale * 100)}% · ${canvas.width}×${canvas.height}`;
    const steps = marchSteps();
    hud.steps.textContent = params.aa ? `${steps} ×4` : String(steps);
    hud.tile.textContent =
      params.curv > 0.5
        ? `T ${params.room.toFixed(2)} → ${Math.sinh(params.room).toFixed(3)}`
        : `flat ${params.room.toFixed(2)}`;

    const r = disk.readout();
    hud.diskHyper.textContent = r.hyper.toFixed(2);
    hud.diskRadius.textContent = r.diskR.toFixed(5);
    hud.diskSide.textContent = r.side.toFixed(4);
  }

  /* -------------------------------------------------------------- input */

  const overlay = document.getElementById("overlay");
  const dismiss = () => {
    overlay.classList.add("gone");
    canvas.requestPointerLock();
  };
  overlay.addEventListener("click", dismiss);
  document.getElementById("resume").addEventListener("click", (e) => {
    e.stopPropagation();
    dismiss();
  });

  canvas.addEventListener("click", () => {
    if (overlay.classList.contains("gone")) canvas.requestPointerLock();
  });

  document.addEventListener("pointerlockchange", () => {
    player.pointerLocked = document.pointerLockElement === canvas;
    document.body.classList.toggle("locked", player.pointerLocked);
  });

  document.addEventListener("mousemove", (e) => {
    player.onMouseMove(e.movementX || 0, e.movementY || 0);
  });

  window.addEventListener("keydown", (e) => {
    player.onKeyDown(e);
    if (e.code === "Escape" && document.pointerLockElement) document.exitPointerLock();
    if (e.code === "KeyP" || e.code === "KeyF") return;
    const map = {
      Digit1: () => setParam("curv", params.curv > 0.5 ? 0 : 1),
      Digit2: () => disk.reset(),
      Digit3: () => setParam("curv", params.curv > 0.5 ? 0 : 1),
      KeyH: () => togglePanel("ui"),
      KeyG: () => disk.reset(),
    };
    if (map[e.code]) map[e.code]();
    if (e.code === "KeyG") e.preventDefault();
  });

  window.addEventListener("keyup", (e) => player.onKeyUp(e));
  // Losing focus mid-stride would otherwise leave the player walking forever.
  window.addEventListener("blur", () => player.releaseAll());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) player.releaseAll();
  });

  /* ------------------------------------------------------------ controls */

  function setParam(name, value) {
    params[name] = value;
    const el = document.querySelector(`input[data-param="${name}"]`);
    if (el) el.value = String(value);
    const out = document.querySelector(`output[data-param="${name}"]`);
    if (out) out.textContent = fmt(name, value);
    if (name === "showDisk") {
      document.getElementById("disk-panel").classList.toggle("collapsed", !value);
    }
  }

  function fmt(name, v) {
    switch (name) {
      case "room":
      case "door":
        return Number(v).toFixed(2);
      case "fog":
      case "glow":
      case "shadow":
      case "speed":
      case "head":
        return Number(v).toFixed(2);
      case "palette":
      case "panel":
      case "curv":
      case "quality":
        return Math.round(Number(v) * 100) + "%";
      case "fov":
        return Math.round(Number(v)) + "°";
      default:
        return String(v);
    }
  }

  document.querySelectorAll("input[data-param]").forEach((el) => {
    const name = el.dataset.param;
    const out = document.querySelector(`output[data-param="${name}"]`);
    if (out) out.textContent = fmt(name, el.value);
    const isToggle = el.type === "checkbox";
    const read = () => (isToggle ? el.checked : parseFloat(el.value));
    el.addEventListener("input", () => setParam(name, read()));
    if (isToggle && el.dataset.param === "showDisk") {
      document
        .getElementById("disk-panel")
        .classList.toggle("collapsed", !el.checked);
    }
  });

  function togglePanel(id) {
    document.getElementById(id).classList.toggle("collapsed");
    const el = document.querySelector(`input[data-param="showDisk"]`);
    if (id === "disk-panel" && el) el.checked = !el.checked;
  }
  document.querySelectorAll("[data-toggle]").forEach((b) =>
    b.addEventListener("click", () => togglePanel(b.dataset.toggle))
  );

  document.getElementById("tiling").addEventListener("change", (e) => {
    disk.setIndex(parseInt(e.target.value, 10));
  });

  const PRESETS = {
    hall: { curv: 1, room: 1.15, door: 0.42, fog: 0.22, glow: 1.0, palette: 0.0 },
    infinite: { curv: 1, room: 1.9, door: 0.46, fog: 0.15, glow: 1.35, palette: 0.0 },
    flat: { curv: 0, room: 2.6, door: 0.46, fog: 0.26, glow: 1.0, palette: 0.0 },
    neon: { curv: 1, room: 1.5, door: 0.5, fog: 0.2, glow: 1.8, palette: 1.0 },
  };

  document.querySelectorAll("[data-preset]").forEach((b) =>
    b.addEventListener("click", () => {
      const p = PRESETS[b.dataset.preset];
      if (!p) return;
      Object.entries(p).forEach(([k, v]) => setParam(k, v));
      document.querySelectorAll("[data-preset]").forEach((x) =>
        x.classList.toggle("active", x === b)
      );
    })
  );

  /* --------------------------------------------------------- scene build */

  function buildCameraMatrix() {
    const { e1, e2, e3 } = player.camera.tangentFrame();
    // Column-major: right, up, forward.
    return new Float32Array([
      e1[0], e1[1], e1[2],
      e2[0], e2[1], e2[2],
      e3[0], e3[1], e3[2],
    ]);
  }

  /* --------------------------------------------------------------- loop */

  let prev = performance.now();
  const yaw0 = { v: 0 };

  function frame(now) {
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;

    // Track per-frame deltas for the 2D walk.
    const yawBefore = player.camera.yaw;
    const forwardBefore = player.forwardOdometer || 0;

    const D = kleinD();
    player.world = {
      D,
      door: params.door,
      margin: 0.16,
      eyeHeight: 0.32,
    };
    player.speed = params.speed;
    player.update(dt);

    const yawDelta = player.camera.yaw - yawBefore;
    const forwardDelta = (player.forwardOdometer || 0) - forwardBefore;
    disk.update(dt, forwardDelta, yawDelta);

    renderer.resize();

    // Cell-LOCAL coordinates. The shader derives the cell index from each
    // marching point, so the image depends only on where you stand and which
    // way you face — which is what lets the camera be folded back by whole
    // cells whenever its raw chart coordinates get large.
    const folded = player.camera.folded(D);

    renderer.draw(
      {
        camPos: folded.k,
        camMat: buildCameraMatrix(),
        fov: params.fov,
        D,
        door: params.door,
        curv: params.curv,
        fog: params.fog,
        glow: params.glow,
        panel: params.panel,
        palette: params.palette,
        head: params.head,
        shadow: params.shadow,
        steps: marchSteps(),
        aa: params.aa,
      },
      now
    );

    if (params.showDisk) disk.draw();

    if (++hudTick % 8 === 0) updateHud();

    requestAnimationFrame(frame);
  }

  // Seed the player standing on the floor of the centre room, looking down +z.
  player.camera.reseat();
  requestAnimationFrame(frame);

  window.addEventListener("resize", () => {
    renderer.resize();
    disk.resize();
  });

  // Expose a tiny handle for debugging from the console.
  window.HYPERBOLIA = { params, player, renderer, disk, setParam };
})();
