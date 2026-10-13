# Voxel Verse

Co-op voxel survival in the browser. Infinite terrain, day/night cycle, mobs,
dungeons, and multiplayer over a room code. No build step — open `index.html`.

```
index.html        markup + HUD
style.css         HUD and menu styling
script.js         game: world, physics, mobs, UI, net, persistence
mesher.js         chunk mesher: face culling, skylight, ambient occlusion
textures.js       procedural block textures, no DOM
```

`script.js`, `mesher.js` and `textures.js` are plain scripts that share one
global scope. `mesher.js` publishes `VoxelMesher` and `textures.js` publishes
`VoxelTextures`; neither knows about three.js or the DOM.

## Rendering

The chunk renderer is the interesting part of this project.

Each chunk is meshed into **one geometry per material** rather than one instanced
cube per block. The pipeline in `mesher.js`, per chunk:

1. **`fillPadded`** copies the chunk plus a 1-cell ring into a `(16+2)³` volume.
   The ring is what lets ambient occlusion and skylight sample neighbours without
   any cross-chunk light state. Everything above the world's terrain ceiling is
   recorded as air without a lookup at all.
2. **`computeLight`** floods sunlight straight down every column, then bleeds it
   sideways with a breadth-first pass. Light travelling *down* costs only the
   destination medium's attenuation; light travelling *sideways* costs one level
   per step, so caves, tunnels and overhangs get graded falloff instead of
   either full brightness or pitch black. Water and leaves filter light as it
   passes through them, and the shaft value caps how bright a medium can get
   laterally — without that cap a lit air column beside the sea would flood the
   water at full strength.
3. **`mesh`** emits only the faces you can see, and bakes a smooth
   ambient-occlusion × skylight value per vertex into vertex colours. A corner
   touched by three neighbours is darker than one touched by none, graded across
   the four levels in between.

Block picking (`VoxelMesher.raycast`) walks the voxel grid directly instead of
intersecting triangles, so it costs a handful of array reads regardless of how
much geometry is on screen and can never pick a stale transform.

### What that buys

Measured against the previous renderer (a full 24-vertex cube for every block
that wasn't completely buried, one flat brightness value per block):

| render distance | triangles before | after | reduction |
| --- | --- | --- | --- |
| 2 | 129,024 | 22,294 | 82.7% |
| 3 | 227,328 | 39,482 | 82.6% |
| 4 | 374,784 | 65,604 | 82.5% |
| 6 | 743,424 | 130,792 | 82.4% |

Draw calls drop from up to one per block type per chunk to one or two per chunk,
because every solid block shares a single 16×16 texture atlas and one material.
Rebuilding a chunk after a block edit also got faster (~1.8 ms versus ~3.0 ms).

The visible difference is the lighting: caves fall off smoothly with depth, an
overhang shades the ground beneath it, and a deep trench reads as deep.

### One thing to be careful about

`BLOCK.GRASS` is `0`, and the mesher reserves `0` for air. Every lookup table is
indexed by `blockId + 1` through the `B()` helper for this reason. An "is there a
block here" check written as `if (id)` silently drops every grass block in the
world. `smoke.test.mjs` asserts grass is actually rendered.

## Tests

No framework, no dependencies:

```
node --test "voxel-verse/*.test.mjs"
```

`mesher.test.mjs` (35 tests) exercises the shipped mesher directly: face winding,
culling rules, ambient-occlusion ratios, the skylight propagation model, voxel
raycasting against a brute-force sampler, and determinism. `textures.test.mjs`
(27 tests) covers the texture generator: that tiles are byte-identical across
builds and never touch `Math.random`, that the noise is continuous rather than
speckled and wraps at the tile edge, that every tile has real internal contrast,
that leaf cutouts are binary so `alphaTest` gives a clean edge, that bark grain
runs vertically and plank grain horizontally, and that the atlas is sized to the
tiles it holds. `mesher.js` and `textures.js` assign `module.exports` when they
can see one, so the tests run the same files the browser loads rather than copies.

`smoke.test.mjs` (30 tests) boots the whole game headlessly against a minimal
DOM and three.js stand-in, then checks the things that only matter once the parts
are wired together: chunks mesh into merged geometry, grass survives, triangle
counts land where expected, editing a block rebuilds only that chunk's geometry,
`getBlock` and the mesher's world sampler agree, crosshair picking reports the
right face, saves round-trip, tall builds survive a reload, and every atlas UV
resolves to a painted texel.

### Textures

`textures.js` generates every block texture procedurally into plain RGBA buffers
— no canvas, no DOM, which is why it can be unit-tested in Node.

* **Deterministic.** Every value comes from an integer hash of its own
  coordinates. The old generator used `Math.random()`, so the world looked
  different on every single reload.
* **Value noise, not speckle.** Smooth interpolated fBm gives cloud-like
  mottling. The old generator scattered uncorrelated single-pixel dots on a flat
  colour, which reads as static rather than as a material.
* **Seamless.** The noise lattice wraps at the tile's period, so opposite edges
  of a tile match and large flat areas don't show a seam grid.
* **Per-face.** Grass has a grass top and a dirt-with-fringe side; logs have
  rings on the ends and bark on the sides. One tile for all six faces is the
  single biggest reason procedural blocks look procedural.
* **Real alpha.** Leaves get connected cutout holes rendered with `alphaTest`,
  so you can see sky through a canopy. Previously the material set `alphaTest`
  while the texture had no alpha channel, so it was a no-op and leaves were solid
  green cubes.

Direction matters and is easy to get backwards: bark is sampled with the
vertical axis compressed, which elongates the features into vertical streaks.
Plank grain compresses the other axis. Sampling both axes equally gives blobs.

### The texture atlas, and a trap worth knowing about

Every solid block renders from one 4×4 tile atlas (128×128). It used to be 16×16
— 13 tiles in 256 cells, 95% empty canvas. That is 4× the memory for nothing,
and it is why mipmaps had to stay off: every reduced mip level averaged a tile
together with empty canvas and darkened distant terrain toward black. If you ever
want mipmaps back, the atlas needs gutter padding between tiles.

Tiles are painted into the canvas with row 0 at the **top**, but three.js sets
`flipY = true` on every texture, which flips the image during upload so canvas
row 0 ends up at `v = 1`. The painted row `r` therefore lives at `v` in
`[1-(r+1)/ROWS, 1-r/ROWS]`, not `[r/ROWS, (r+1)/ROWS]`.

Getting that backwards does not produce a subtle artefact — it renders the entire
world black, because every face samples a strip of the canvas that was never
painted. `atlasUV()` in `script.js` handles the flip; `smoke.test.mjs` samples
the real pixel buffer to keep it honest, because a uv range check cannot catch a
sign error here (a flipped uv is still a perfectly valid 0..1 pair).

`three-check.mjs` is a separate script that validates the generated geometry
against **real three.js** — the stub in `smoke.test.mjs` would happily accept
geometry three.js rejects. It confirms the attributes and index buffer are valid,
every triangle winds outward, the voxel raycast picks the same cell the triangle
raycaster did, the `flipY` default really is `true`, and that the texture alpha
and per-face tile tables survive the trip to a real material. It needs the
library once:

```
curl -s -o ~/.cache/voxel-verse/three.min.js \
  https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
node voxel-verse/three-check.mjs
```

## Playing

Click into the canvas for mouse look.

| | |
| --- | --- |
| move | `WASD` |
| jump / fly | `Space` (double-tap to toggle fly in creative) |
| sprint | `Shift` |
| mine / place | left / right click |
| select block | `1`–`9`, or the mouse wheel |
| inventory | `I` — drag blocks onto the hotbar, or click to assign |
| eat | `E` |
| drop a torch | `Q` |
| chat | `T` |
| co-op room | `C` |
| menu | `Esc` |

Break grass for apples, kill animals for food, and place glowstone to keep
yourself safe at night. Zombies spawn in the dark.

## Multiplayer

Press `C` to host or join a room; the host shares a 4-letter code over
PeerJS (WebRTC, peer to peer — no server). Tabs on the same Wi-Fi auto-link.
`🤖 Add helper bot` drops an AI companion that follows you and fights.
