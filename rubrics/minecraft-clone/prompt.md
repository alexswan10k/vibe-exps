# Minecraft Clone — Model Prompt

> **Copy-paste this prompt verbatim to each model under test.** The model should produce a single self-contained folder `rubrics/minecraft-clone/<model-name>/` that runs by opening `index.html` directly.

---

You are building a **faithful clone of Minecraft: Java Edition** as a single-page web app using only HTML, CSS, and vanilla JavaScript.

The output must be a **standalone demo** that runs by double-clicking `index.html` — it must work both via `file://` (no server) and via `http://` (GitHub Pages). Optimise for correctness, performance, and visual fidelity to the original game.

## 1. Core objective

Recreate the **classic Survival/Creative experience** — a first-person 3D voxel sandbox where the player can explore a procedurally generated world, break and place blocks, and navigate with Minecraft-accurate controls and physics. Visual style, textures, and UI should be **as close to Java Edition as possible** (pixelated 16×16 textures, hotbar, crosshair, block outlines, fog).

## 2. Technical constraints (NON-NEGOTIABLE)

These exist to keep the demo `file://`-safe. Violating them is an automatic failure.

* **No build step.** Do not use npm, Vite, Webpack, Parcel, or any bundler. No `package.json`, no `node_modules`.
* **No Babel, no TypeScript, no JSX, no transpilation.** Write plain HTML + CSS + vanilla JS that the browser parses directly.
* **CDN only via plain `<script src="https://…">` UMD builds.** Allowed example:
  ```html
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  ```
  This exposes `THREE` globally. **Do NOT use** `<script type="module">`, `import`, `importmap`, or `es-module-shims` — they break `file://` with CORS errors. If you need a library, find its UMD/global build on cdnjs or unpkg.
* **No `fetch()` of local files** (e.g. `fetch('./data.json')` fails on `file://`). Inline data or generate it procedurally. `fetch()` to a CDN is OK but prefer not to.
* **Self-contained folder.** Everything the demo needs must live inside its own folder (`index.html` + optional `style.css` + optional `script.js` + optional local images). Use **relative paths only**. Opening `index.html` with a double-click must work without a server.
* **Keep it to 1–3 files ideally.** A single `index.html` that inlines CSS/JS is perfect. `index.html` + `style.css` + `script.js` is also fine. Do not create deep `src/` trees.
* **No external server, no backend, no WebSocket.**

If you need textures, **generate them procedurally via `<canvas>`** or use tiny data-URI sprites. Do not rely on local image files that may not exist.

## 3. Gameplay requirements

Implement in priority order. Must-haves are required; nice-to-haves are scored as bonus.

### Must-have (P0 — a bare demo fails without these)

* **First-person voxel world** rendered in 3D (Three.js rendering is recommended but not mandatory). Blocks are 1×1×1 cubes with pixelated textures.
* **Procedural terrain** — at minimum a flat-ish world with hills using Perlin/Simplex/noise. A finite world (e.g. 64×64 or 32×32 chunks, 32–64 blocks high) is acceptable. Infinite streaming is a bonus but not required if performance suffers. Include a few **trees** (trunk + leaves) and a **bedrock/ground layer**.
* **Block types (≥8):** Grass Block, Dirt, Stone, Wood Log (oak), Leaves, Sand, Glass (semi-transparent), Planks, Cobblestone. Use distinct 16×16 pixelated textures per face (grass: top green, side dirt+grass, bottom dirt).
* **Break & place:** Left-click (or hold) to break the targeted block with a **crack animation** and short break time; Right-click to place the currently selected block adjacent to the targeted face. Show a **dark wireframe / outline** on the looked-at block. Raycast from the camera.
* **Pointer lock + mouse look** (click to lock, `ESC` to unlock), **WASD to move**, **Space to jump**, **Shift to sneak / descend** (or Ctrl), gravity + jump physics, and **AABB collision** with blocks so the player cannot walk through terrain and can stand on blocks. Prevent falling through the world (floor at y=0).
* **Hotbar (slots 1–9):** Visual bar at bottom centre with 9 slots, selected slot highlighted. Number keys `1`–`9` and mouse wheel to change selection. Placing uses the selected block type.
* **Crosshair** centre-screen, **fog** in the distance, **sky colour** matching Minecraft (light blue `#8ED0FF` or similar), optional clouds.
* **Performance:** Maintain ~60 fps on a mid-range laptop. Use frustum culling / greedy meshing / chunking or at minimum only render nearby blocks. No 1 mesh per block naïvely across 100k blocks.

### Important (P1 — strong scoring impact)

* **Inventory / block picker:** Press `E` or `I` or `B` to open a simple overlay showing all block types; clicking / key selects the hotbar slot content. At minimum allow cycling through blocks without a full inventory screen.
* **Save / load** via `localStorage` (persist placed/broken blocks under a key derived from the world seed).
* **World seed / regenerate:** A seed input or "Generate new world" button. Deterministic output per seed if you use noise.
* **Lighting & day/night:** At minimum a directional light with ambient + diffuse that looks like Minecraft daylight. A full day/night cycle with a swinging sun/moon is a bonus. Keep blocks bright (Minecraft is not dark).
* **Sound:** Short click/pop sounds on place/break/step (procedural via Web Audio is fine; no external audio files required).
* **Mobile fallback:** If pointer lock is unavailable, show a message; optional on-screen joystick / touch buttons for movement + break/place.

### Bonus (P2 — differentiators)

* Survival elements: health, hunger, first block needs tool tier, falling damage.
* Crafting grid (2×2 inventory + 3×3 table).
* Water blocks with simple flow, or sand falling.
* Biomes (desert / plains / forest segments).
* Clouds, sun/moon, stars, rain.
* Sprint (`Ctrl` / double-tap `W`), FOV slider, render distance slider, pause menu.

## 4. Visual & UX spec

* Title screen / overlay on load: **"MINECRAFT — Click to Play"** with controls legend. Clicking locks the pointer and hides the overlay.
* In-game HUD: crosshair, hotbar, optional coordinates (F3-style debug line is a nice nod).
* Block break: progressive darkening cracks over ~0.3–0.6s for hard blocks, instant for soft.
* Block outline: `THREE.EdgesGeometry` or line box around the targeted block.
* Textures: 16×16 pixel art. Generate via Canvas if you cannot find a CDN texture pack. Keep the palette desaturated/earthy, not neon.
* Font: `monospace` or Minecraft-like bitmap font for HUD. No Google Fonts fetch required (system fonts only).

## 5. Libraries — allowed & recommended

You **may** use any library **if** it is a single UMD `<script>` from a CDN. Recommended:

* `Three.js r128` — `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` (global `THREE`, includes `PointerLockControls` inline or copy the ~30-line controls manually — do not `import` it)
* For noise: inline a tiny Simplex/Perlin function (e.g. 40-line `noise.js` snippet) — do not pull a heavy ESM noise library

Do **not** use React, Vue, Svelte, Next, Tailwind via npm, or any ESM-only library.

## 6. Deliverable

Produce a **single folder** that contains:

```
rubrics/minecraft-clone/<model-name>/index.html   ← primary file, works on double-click
(optional) rubrics/minecraft-clone/<model-name>/style.css
(optional) rubrics/minecraft-clone/<model-name>/script.js
```

* `index.html` must include all CSS and JS inline **or** reference `style.css`/`script.js` via relative paths **and** load any CDN library via `<script src="https://…">` **before** your script.
* No absolute paths, no `http://localhost`, no `fetch('/api')`.
* Test mentally: "If I zip this folder, send it to someone, and they double-click `index.html`, does it run?" If not, fix it.

## 7. Acceptance checklist (self-verify before finishing)

* [ ] Double-click `index.html` → world renders, no console CORS errors
* [ ] Click → pointer locks → mouse looks around smoothly
* [ ] WASD moves, Space jumps, cannot fall through ground, can stand on blocks
* [ ] Left-click breaks a block (with outline + crack), Right-click places selected block
* [ ] Hotbar visible, 1–9 switches block, scroll wheel works
* [ ] Procedural terrain with trees, fog, sky — recognizable as Minecraft
* [ ] No `type="module"`, no `importmap`, no `fetch('./…')`
* [ ] All `<script src>` are `https://` CDN URLs and placed before your code

## 8. Reference behaviour (Java Edition truths)

Match these where feasible — reviewers will compare:

* Left-click breaks, Right-click places (not the reverse). Holding left-click continuously mines.
* One block at a time; placing checks for collision with player (cannot place a block inside yourself).
* Gravity is ~20 blocks/s² feel, jump ~1.25 blocks high, sprint ~1.3× walk speed.
* Clouds at y ~ 64–80, sun is a bright square, fog starts ~0.7 × render distance.

---

**Now build it.** Start with a minimal Three.js scene that renders a 32×32 grass plain, add raycasting + break/place, then add physics + hotbar, then add procedural hills/trees and polish. Commit early and test `file://` after every library addition.
