# NEON DRIFT — Synthwave Outrun

A single-file, zero-dependency endless highway racer. Open `index.html` — no build step, no external assets, no network requests.

## Controls

| Key | Action |
|---|---|
| `←` / `→` (or `A`/`D`) | Steer |
| `↑` / `SPACE` (or `W`) | Nitro (hold, drains meter) |
| `↓` (or `S`) | Brake |
| `P` / `ESC` | Pause |
| `M` | Mute (persisted) |
| `ENTER` | Start / Retry |

Touch devices get on-screen ◀ / NITRO / ▶ buttons.

## Gameplay

- Speed ramps with distance (80 → 340 km/h). 3 shields; each crash costs one and grants 2s of invincibility. Third crash = WRECKED.
- Energy cores (cyan diamonds): +150 score, +30 nitro. Near-misses: +25 score, +8 nitro. Nitro doubles score rate.
- Hi-score persists in `localStorage` (`neonDriftHighScore`).

## Implementation notes

- Fixed 1280×720 logical canvas, DPR-aware (capped at 2×), CSS-scaled to viewport.
- Pseudo-3D: logical top-down space (lateral `x`, depth `z`), projected to screen with `scale = FOCAL / z`; horizon at y=320, vanishing point at center.
- Fixed-timestep physics (1/120 s accumulator), `requestAnimationFrame` render, dt clamped to 50 ms.
- Traffic spawner never completes a wall: if 3 of 4 lanes are occupied in the spawn gate window, spawning holds.
- All audio is Web Audio oscillator-generated (engine hum tracks speed, blips for pickup/hit/nitro/game-over); context created on first user gesture.
- Scanline + vignette overlays are pure CSS, `pointer-events: none`.
