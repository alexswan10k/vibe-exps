#!/bin/bash
set -e

# Get absolute directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Common template directory
COMMON_DIR="$DIR/common"

# Function to compile a specific game directory
compile_game() {
    local game="$1"
    echo "=================================================="
    echo "Building game: $game"
    echo "=================================================="
    
    local game_dir="$DIR/$game"
    if [ ! -d "$game_dir/src" ]; then
        echo "Error: Directory '$game_dir/src' does not exist."
        exit 1
    fi
    
    # Bootstrap missing configuration files from common templates
    for file in Makefile linkfile hdr.asm data.asm pvsneslibfont.bmp; do
        if [ ! -f "$game_dir/src/$file" ]; then
            echo "-> Copying missing template $file to $game/src/..."
            cp "$COMMON_DIR/$file" "$game_dir/src/"
        fi
    done
    
    # Create build directory
    mkdir -p "$game_dir/build"

    # Regenerate graphics from their source-of-truth scripts and lint the
    # console layout. These outputs are gitignored, so a fresh clone has
    # neither src/gfx/*.bin nor src/gfx.h until this runs.
    if [ -f "$game_dir/tools/gengfx.py" ]; then
        echo "-> Generating gfx from tools/gengfx.py..."
        (cd "$game_dir" && python3 tools/gengfx.py)
    fi
    if [ -f "$game_dir/tools/checkstrings.py" ]; then
        echo "-> Linting console layout..."
        (cd "$game_dir" && python3 tools/checkstrings.py) || {
            echo "-> Error: console layout check failed (see tools/checkstrings.py)"
            exit 1
        }
    fi
    
    # Get absolute game dir for Docker volume mounting
    local abs_game_dir
    abs_game_dir="$(cd "$game_dir" && pwd)"
    
    echo "-> Running compiler in Docker (redbug26/pvsneslib-docker)..."
    docker run --rm --platform linux/386 -v "$abs_game_dir:/src" redbug26/pvsneslib-docker make -C src
    
    if [ -f "$game_dir/build/game.sfc" ]; then
        echo "-> Success! ROM built at $game/build/game.sfc"

        # Verify any .incbin'd gfx assets actually made it into the ROM.
        # The linker silently discards initialised C arrays (CAVEATS.md
        # section 3), so a clean build is NOT proof the art is present.
        local gfx_dir="$game_dir/src/gfx"
        if compgen -G "$gfx_dir/*.bin" > /dev/null 2>&1; then
            echo "-> Verifying gfx assets are present in the ROM..."
            for asset in "$gfx_dir"/*.bin; do
                if ! node -e "
                    const fs = require('fs');
                    const rom = fs.readFileSync('$game_dir/build/game.sfc');
                    const data = fs.readFileSync('$asset');
                    process.exit(rom.indexOf(data) >= 0 ? 0 : 1);
                " 2>/dev/null; then
                    echo "-> Error: $(basename "$asset") is NOT in the ROM."
                    echo "   data.asm may be missing its .incbin, or is being"
                    echo "   bootstrapped from the common template. See CAVEATS.md section 3."
                    exit 1
                fi
            done
            echo "-> All gfx assets present."
        fi

        echo "-> Generating base64 rom.js wrapper for standalone file:// support..."
        node -e "
            const fs = require('fs');
            const data = fs.readFileSync('$game_dir/build/game.sfc');
            const base64 = data.toString('base64');
            fs.writeFileSync('$game_dir/build/rom.js', 'window.snes_roms = window.snes_roms || {}; window.snes_roms[\"$game\"] = \"' + base64 + '\";');
        "
        echo "-> Success! Wrapper built at $game/build/rom.js"
    else
        echo "-> Error: ROM build failed (game.sfc not found in build directory)."
        exit 1
    fi
    echo ""
}

# Determine what to compile
if [ -n "$1" ]; then
    # Compile the specified game
    compile_game "$1"
else
    # Compile all subdirectories that have a "src" folder (except "common")
    echo "No game specified. Building all available games..."
    for d in */; do
        # Remove trailing slash
        game="${d%/}"
        if [ "$game" != "common" ] && [ -d "$game/src" ]; then
            compile_game "$game"
        fi
    done
fi
