// Procedural terrain generation: grass, a sweeping regional river, forest clusters.
// Tile codes: 0 = grass, 1 = water, 2 = trees. High nibble of variants = shade.

const TERRAIN = {
    GRASS: 0,
    WATER: 1,
    TREES: 2
};

function generateTerrain(width, height, seed) {
    const rng = makeRng(seed);
    const tiles = new Uint8Array(width * height);
    const variants = new Uint8Array(width * height);

    // Grass shade variants for a natural patchwork
    for (let i = 0; i < tiles.length; i++) {
        variants[i] = Math.floor(rng() * 4);
    }

    // --- Major River: natural wandering sine wave from top to bottom edge ---
    let x = Math.floor(width * (0.35 + rng() * 0.3));
    const amp = 8 + rng() * 12;
    const freq = 0.025 + rng() * 0.02;
    const phase = rng() * Math.PI * 2;
    const riverWidth = 3;

    for (let y = 0; y < height; y++) {
        x += Math.round(Math.sin(y * freq + phase) * amp * 0.22 + (rng() - 0.5) * 1.2);
        x = clamp(x, riverWidth + 3, width - 3 - riverWidth);
        for (let dx = -riverWidth; dx <= riverWidth; dx++) {
            // Softly ragged natural riverbanks
            if (Math.abs(dx) === riverWidth && rng() < 0.35) continue;
            const tx = clamp(x + dx, 0, width - 1);
            tiles[y * width + tx] = TERRAIN.WATER;
        }
    }

    // --- Forest clusters across the mega continent ---
    const clusters = Math.floor((width * height) / 320);
    for (let c = 0; c < clusters; c++) {
        const cx = Math.floor(rng() * width);
        const cy = Math.floor(rng() * height);
        const size = 5 + Math.floor(rng() * 10);
        for (let i = 0; i < size; i++) {
            const tx = clamp(cx + Math.floor((rng() - 0.5) * 8), 0, width - 1);
            const ty = clamp(cy + Math.floor((rng() - 0.5) * 8), 0, height - 1);
            const idx = ty * width + tx;
            if (tiles[idx] === TERRAIN.GRASS) {
                tiles[idx] = TERRAIN.TREES;
            }
        }
    }

    // --- Guarantee a clear buildable area at the centre of the map ---
    const midX = Math.floor(width / 2);
    const midY = Math.floor(height / 2);
    const clearRadius = 12;
    for (let y = midY - clearRadius; y <= midY + clearRadius; y++) {
        for (let x2 = midX - clearRadius; x2 <= midX + clearRadius; x2++) {
            if (x2 >= 0 && x2 < width && y >= 0 && y < height) {
                const idx = y * width + x2;
                if (tiles[idx] !== TERRAIN.GRASS) {
                    tiles[idx] = TERRAIN.GRASS;
                }
                variants[idx] = 0;
            }
        }
    }

    return { tiles, variants };
}

window.TERRAIN = TERRAIN;
window.generateTerrain = generateTerrain;
