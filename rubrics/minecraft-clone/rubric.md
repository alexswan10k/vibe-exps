# Minecraft Clone — Grading Rubric

Score each submission 0–3 per criterion. Total 36 points. Be visual: open every demo via `file://` and `http://` and play for 2 minutes.

| # | Criterion | 0 | 1 | 2 | 3 |
|---|-----------|---|---|---|---|
| 1 | **File-safety** | Fails on `file://` (CORS / module errors) | Loads but with console errors / requires server | Works on both `file://` and `http://`, one minor warning | Clean on both, no console errors, no build step |
| 2 | **World & terrain** | Flat single layer / no generation | Flat with random bumps | Procedural hills via noise + trees + bedrock | Hills + trees + seed + credible Minecraft terrain shape |
| 3 | **Block fidelity** | <4 indistinguishable blocks | 4–6 blocks, textures barely distinct | ≥8 blocks with distinct 16×16 textures, grass top/side/bottom correct | ≥10 blocks, pixel-perfect palette, transparency for glass |
| 4 | **Break / place** | Missing one or both | Break or place works but unreliable raycast | Both work with outline + adjacent-face placement | + crack animation, hold-to-mine, correct face placement |
| 5 | **First-person controls** | No pointer lock / no mouse look | Pointer lock but jittery / no WASD | Smooth pointer lock + WASD + jump | + sprint, sneak, scroll wheel, 1–9, ESC unlock |
| 6 | **Physics & collision** | Falls through world / flies | Gravity but walks through blocks | Solid floor + basic AABB so you stand on blocks | Full AABB, cannot phase through walls, jump arcs correct |
| 7 | **HUD / UI** | No hotbar or crosshair | Hotbar or crosshair present | Hotbar (1–9, highlight) + crosshair + click-to-play overlay | + block outline, F3 coords, inventory picker, pause menu |
| 8 | **Visual polish** | Unrecognisable as Minecraft | Vaguely Minecraft (skyr, fog) | Sky + fog + clouds + credible lighting, performant | Day/night, shadows/ambient, particle break effects, 60fps |
| 9 | **Robustness** | Crashes on resize / spam | Handles resize | Handles resize + rapid break/place + edge of world | + localStorage save, regenerate, pointer-lock edge cases |
|10 | **Code quality** | Unreadable / single 3k line function | Works but messy | Readable, commented chunk / world / player separation | Clean, small, well-structured, still single-file-lean |
|11 | **Bonus / wow** | Nothing beyond P0 | One P2 bonus (water, sound, biomes) | Two P2 bonuses with polish | Three+ bonuses that genuinely feel like Minecraft |
|12 | **Fidelity to prompt** | Ignores constraints (uses ESM/importmap) | Follows most constraints, one violation | Follows all technical constraints exactly | Follows all constraints + self-checklist, CDN UMD only |

### How to grade

1. Open `rubrics/minecraft-clone/<model>/index.html` via **double-click** (`file://`). Check console (F12) for CORS.
2. Also open via `http://` (e.g. `npx serve` or GitHub Pages).
3. Play: look around, walk, jump, break 5 blocks, place 5 blocks, switch hotbar, test edge of world, resize window.
4. Note failure modes verbatim (e.g. "uses importmap → fails on file://").
5. Score 0–3 per row, sum, rank. Ties broken by visual polish.

### Pass / fail gate

A submission **fails outright** if it does not work on `file://` or uses `type="module"` / `importmap` / `fetch('./…')` without fallback. Mark 0 for File-safety and flag as `FAIL` regardless of other scores.
