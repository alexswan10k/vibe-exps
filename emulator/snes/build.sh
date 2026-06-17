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
    
    # Get absolute game dir for Docker volume mounting
    local abs_game_dir
    abs_game_dir="$(cd "$game_dir" && pwd)"
    
    echo "-> Running compiler in Docker (redbug26/pvsneslib-docker)..."
    docker run --rm --platform linux/386 -v "$abs_game_dir:/src" redbug26/pvsneslib-docker make -C src
    
    if [ -f "$game_dir/build/game.sfc" ]; then
        echo "-> Success! ROM built at $game/build/game.sfc"
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
