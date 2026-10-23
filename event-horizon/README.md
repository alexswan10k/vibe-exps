# Event Horizon

A real-time black hole rendered in a single WebGL2 fragment shader. No
dependencies, no build step — open `index.html`.

The point of the project is that nothing is faked with a lens-distortion pass:

- Every pixel integrates its own photon path through curved spacetime.
- The shadow, the doubled arcs above and below, and the thin photon ring are
  all consequences of the same geodesic equation.
- The accretion disk is shaded with a radial temperature profile, Keplerian
  Doppler beaming and gravitational redshift.
- The starfield behind the hole is lensed by the same integration.

## The physics

For a non-rotating (Schwarzschild) black hole, null geodesics obey

```
d²u/dφ² + u = (3/2) · rs · u²,    u = 1/r
```

which the shader integrates in Cartesian form:

```
a = −(3/2) · h² · r / |r|⁵,       h = |r × v| (conserved)
```

with units `G = c = rs = 1` and a velocity-Verlet step. Rays are stopped when
they cross `r = 1` (the horizon) or escape past `r = 70`.

The disk lives in the equatorial plane between `r = 3` (the ISCO) and
`r = 12.5`. Each time a ray crosses `y = 0`, the crossing point is interpolated
and shaded:

| Quantity | Model |
| --- | --- |
| Temperature | `T ∝ r^(−3/4)` |
| Orbital speed | `β = √(M/r)`, `M = 0.5` |
| Doppler factor | `δ = 1 / (γ(1 − β·n))` |
| Gravitational redshift | `√(1 − rs/r)` |
| Observed temperature | `T · δ · √(1 − rs/r)` |
| Beaming | `brightness ∝ g³` (artistic; bolometric is `g⁴`) |

`g` is the product of the Doppler and gravitational factors. The side of the
disk rotating toward the camera is therefore brighter and bluer.

## Rendering

```
index.html    markup + HUD
styles.css    panel, modal, responsive layout
main.js       GL setup, shaders, camera, presets, UI
```

Per frame:

1. **Scene** — geodesic integration into an `RGBA16F` target (falls back to
   `RGBA8` if float color buffers are unavailable).
2. **Bright pass** — half resolution, soft threshold.
3. **Bloom** — four widening separable Gaussian pairs.
4. **Composite** — exposure, ACES tonemapping, saturation, vignette and dither.

Resolution adapts between 45% and 100% of the device-pixel-capped size to hold
roughly 60 fps. The step budget is selectable from 120 to 480; the default is
220. `prefers-reduced-motion` disables the intro dolly and auto-orbit.

## Controls

- Drag to orbit, scroll or pinch to zoom, double-click to reset the view.
- `Space` freezes time, `S` captures a PNG, `H` hides the UI, `P` toggles the
  console.
- Presets: Interstellar, Gargantua, Photon ring, Inferno, Cold void.
- Deep links: `?preset=photon`, optionally with `&quality=high`.

## Notes

- WebGL2 is required. The demo is `file://`-safe.
- The shadow has a radius of about `2.6 rs` (`5.2 rs` across) — larger than the
  horizon at `1 rs` — because light grazing the photon sphere at `1.5 rs` is
  bent around the hole.
- `uGravity` is an artistic multiplier on the geodesic acceleration, not a
  different metric; leave it at `1` for the physically faithful view.
