# Retro-SNES Playable Game Hub

A standalone, serverless retro SNES development hub. Supports building C games via Docker and running them directly in the browser.

## Directory Structure
- `index.html`: The main player hub. Double-click to run locally (`file://`) or host statically.
- `build.sh`: CLI build tool to compile ROMs.
- `common/`: Shared templates (`Makefile`, `linkfile`, assembler configs, font) copied dynamically during builds.
- `<game-folder>/src/main.c`: Pure C source code for the game.

## Getting Started

### 1. Compile All Games
Requires Docker running.
```bash
./build.sh
```
Or compile a specific game (e.g. `mario-clone`):
```bash
./build.sh mario-clone
```
This outputs:
- `<game>/build/game.sfc` (Raw SNES ROM)
- `<game>/build/rom.js` (Base64 wrapper script to bypass local `file://` CORS)

### 2. Run / Play
- **Local offline (`file://`):** Double-click `index.html` to open in browser. Select a game (e.g. `?game=mario-clone` via sidebar) to auto-load using the generated `rom.js` wrapper, or drag-and-drop any `.sfc` file onto the bezel screen.
- **Hosted HTTP:** Serve the `snes` directory using any static file server. It will fetch relative `.sfc` assets automatically.

## Adding a New Game
1. Create a new folder under `snes/` (e.g. `snes/my-awesome-game/src/`).
2. Implement your game in `snes/my-awesome-game/src/main.c`.
3. Add a link to the game list in `index.html` (inside the sidebar `<nav>`).
4. Run `./build.sh my-awesome-game`. The script automatically copies the shared build templates and compiles the game.
