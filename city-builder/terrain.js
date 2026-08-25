// Procedural terrain generation: grass, a meandering river, forest clusters.
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

    // --- River: random walk from top edge to bottom edge ---
    let x = Math.floor(width * (0.3 + rng() * 0.4));
    const amp = 2 + rng() * 3;
    const freq = 0.12 + rng() * 0.1;
    const phase = rng() * Math.PI * 2;
    const riverWidth = 2;

    for (let y = 0; y < height; y++) {
        x += Math.round(Math.sin(y * freq + phase) * amp * 0.35 + (rng() - 0.5) * 1.2);
        x = clamp(x, riverWidth, width - 1 - riverWidth);
        for (let dx = -riverWidth; dx <= riverWidth; dx++) {
            // Slightly ragged banks
            if (Math.abs(dx) === riverWidth && rng() < 0.4) continue;
            const tx = clamp(x + dx, 0, width - 1);
            tiles[y * width + tx] = TERRAIN.WATER;
        }
    }

    // --- Forest clusters ---
    const clusters = Math.floor((width * height) / 260);
    for (let c = 0; c < clusters; c++) {
        const cx = Math.floor(rng() * width);
        const cy = Math.floor(rng() * height);
        const size = 3 + Math.floor(rng() * 6);
        for (let i = 0; i < size; i++) {
            const tx = clamp(cx + Math.floor((rng() - 0.5) * 5), 0, width - 1);
            const ty = clamp(cy + Math.floor((rng() - 0.5) * 5), 0, height - 1);
            const idx = ty * width + tx;
            if (tiles[idx] === TERRAIN.GRASS) {
                tiles[idx] = TERRAIN.TREES;
            }
        }
    }

    // --- Guarantee a clear buildable area at the centre of the map ---
    const midX = Math.floor(width / 2);
    const midY = Math.floor(height / 2);
    const clearRadius = 5;
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
