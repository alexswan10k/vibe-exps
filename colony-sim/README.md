# Colony Simulation Game

A colony management simulation in vanilla JavaScript — no build step, no
dependencies. Mark trees for chopping, quarry rock, farm crops, haul goods to
stockpiles, and keep your colonists fed and rested through the night.

## 🎮 Gameplay

- **Orders**: drag-select trees, iron deposits, rocky ground, or ripe plants —
  colonists pathfind to them and do the work.
- **Zones**: place *stockpile* zones (haulers bring loose goods there) and
  *growing* zones (growers plant and harvest crops automatically).
- **Build**: place blueprints for walls, doors, tables, beds and chairs.
  Blueprints need materials delivered before a builder finishes them.
- **Craft**: at a crafting table, cook meals from raw food or make tools
  (tools speed up all work but wear out each day).
- **Needs**: colonists eat when hungry (raw food or cooked meals), sleep in
  beds at night, and starve if food runs out. Lose everyone and the colony falls.
- **Time**: day/night cycle with pause and 1×/2×/4× speeds. New colonists may
  join if you have food to spare.

### Controls

| Input | Action |
| --- | --- |
| Left click / drag | Use selected tool |
| Right click / Esc | Cancel tool |
| WASD / arrows | Pan camera |
| Mouse wheel | Zoom to cursor |
| Middle drag | Pan camera |
| Space | Pause |
| 1 / 2 / 3 | Game speed |

## 🚀 Getting started

Open `index.html` in any modern browser.

## 🏗️ Architecture

Classic scripts loaded in dependency order (no modules, no tooling):

| File | Responsibility |
| --- | --- |
| `config.js` | All tunables: balance rates, recipes, build costs, world-gen parameters |
| `utils.js` | Seeded RNG, hashing, inventory helpers, math |
| `noise.js` | Value noise + fBm for terrain generation |
| `pathfinding.js` | A\* on the tile grid (8-directional, corner-cut safe, multi-goal) |
| `entities.js` | Data classes: item stacks, trees, deposits, bushes, crops, buildings, zones |
| `task-manager.js` | `JobBoard`: job posting, claiming, derived-job maintenance (haul/plant/harvest/deliver/craft) |
| `pawn.js` | Colonist AI: needs, state machine, path following, job execution phases |
| `world.js` | Terrain generation, passability, spatial registries, cached ground layer |
| `renderer.js` | Canvas drawing: pre-rendered ground, depth-sorted sprites, night tint, ghosts |
| `input-manager.js` | Declarative tool system, drag selection with live counts, pan/zoom, hotkeys |
| `ui-manager.js` | DOM panels: time HUD, colonist cards, jobs, messages, tile inspector, priorities modal |
| `game.js` | Orchestration: fixed-timestep loop, day cycle, migrants, game over |
| `main.js` | Bootstrap with error overlay |

### Design notes

- **Everything is a job.** Chopping, hauling, planting, building and crafting
  are posted to one board; pawns claim work matching their priority table
  (0–4 per category). Derived jobs (deliver materials to blueprints, plant
  empty growing cells, haul loose items) are re-posted periodically by the board.
- **Paths, not straight lines.** Pawns walk real A\* routes around water,
  forests and walls; walls genuinely block movement.
- **Fixed-step simulation.** The world ticks at 60 Hz scaled by game speed,
  while rendering stays tied to requestAnimationFrame.
- **Cached ground rendering.** The terrain is drawn once to an offscreen
  canvas and blitted per frame; entities draw on top depth-sorted.
- Core logic is DOM-free and covered by a headless smoke test
  (`node colony-sim/smoke-test.mjs`) that generates a world, checks pathfinding,
  then simulates days of colony work: chop → haul → build → craft → farm.
