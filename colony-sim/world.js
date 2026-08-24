/**
 * World: terrain data, generation, passability and spatial lookups.
 * DOM-free except for the lazily built ground cache canvas.
 */
class World {
    constructor(width, height, seed) {
        this.width = width;
        this.height = height;
        this.seed = seed;

        // Tile ids
        this.TILES = { WATER: 0, SAND: 1, GRASS: 2, DIRT: 3, ROCK: 4 };

        this.tiles = new Uint8Array(width * height);
        this.shade = new Float32Array(width * height); // per-tile brightness variation

        // Spatial registries keyed by "x,y"
        this.trees = new Map();
        this.deposits = new Map();
        this.bushes = new Map();
        this.crops = new Map();
        this.buildings = new Map();
        this.stacks = new Map();

        // Flat lists for iteration
        this.treeList = [];
        this.depositList = [];
        this.bushList = [];
        this.cropList = [];
        this.buildingList = [];
        this.stackList = [];

        this.groundCanvas = null; // lazy
        this.generate();
    }

    inBounds(x, y) {
        return x >= 0 && y >= 0 && x < this.width && y < this.height;
    }

    tileAt(x, y) {
        return this.inBounds(x, y) ? this.tiles[y * this.width + x] : -1;
    }

    setTile(x, y, t) {
        if (this.inBounds(x, y)) this.tiles[y * this.width + x] = t;
    }

    generate() {
        const rng = makeRNG(this.seed);
        const elevation = new ValueNoise(rng, 7);
        const moisture = new ValueNoise(rng, 9);
        const forest = new ValueNoise(rng, 11);
        const metal = new ValueNoise(rng, 13);
        const g = CONFIG.gen;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const u = x / (this.width - 1), v = y / (this.height - 1);
                const e = elevation.fbm(u, v, 4);
                const m = moisture.fbm(u, v, 3);
                let tile;
                if (e < g.waterLevel) tile = this.TILES.WATER;
                else if (e < g.sandLevel) tile = this.TILES.SAND;
                else if (e > g.rockLevel) tile = this.TILES.ROCK;
                else tile = m < 0.42 ? this.TILES.DIRT : this.TILES.GRASS;
                this.tiles[y * this.width + x] = tile;
                this.shade[y * this.width + x] = 0.92 + hash2d(x, y, this.seed) * 0.16;
            }
        }

        // Scatter trees on grass where forest noise is high
        for (let y = 1; y < this.height - 1; y++) {
            for (let x = 1; x < this.width - 1; x++) {
                if (this.tileAt(x, y) !== this.TILES.GRASS) continue;
                const f = forest.fbm(x / this.width, y / this.height, 3);
                if (f > g.forestThreshold && rng() < g.treeChance) {
                    this.addTree(new Tree(x, y));
                } else if (rng() < CONFIG.gen.bushChance) {
                    this.addBush(new WildBush(x, y));
                }
            }
        }

        // Iron deposits favour rock/dirt
        for (let y = 1; y < this.height - 1; y++) {
            for (let x = 1; x < this.width - 1; x++) {
                const t = this.tileAt(x, y);
                if (t !== this.TILES.ROCK && t !== this.TILES.DIRT) continue;
                const mv = metal.fbm(x / this.width, y / this.height, 3);
                if (mv > CONFIG.gen.depositNoise && rng() < CONFIG.gen.depositChance && !this.buildings.has(tileKey(x, y))) {
                    this.addDeposit(new IronDeposit(x, y));
                }
            }
        }
    }

    // ---- registry helpers -------------------------------------------------

    addTree(tree) { this.trees.set(tileKey(tree.x, tree.y), tree); this.treeList.push(tree); }
    addDeposit(dep) { this.deposits.set(tileKey(dep.x, dep.y), dep); this.depositList.push(dep); }
    addBush(bush) { this.bushes.set(tileKey(bush.x, bush.y), bush); this.bushList.push(bush); }
    addCrop(crop) { this.crops.set(tileKey(crop.x, crop.y), crop); this.cropList.push(crop); }
    addBuilding(b) { this.buildings.set(tileKey(b.x, b.y), b); this.buildingList.push(b); }
    addStack(stack) {
        const existing = this.stacks.get(tileKey(stack.x, stack.y));
        if (existing) {
            // Merge into the existing stack when possible.
            for (const s of existing) {
                if (s.type === stack.type) {
                    s.qty += stack.qty;
                    return s;
                }
            }
            existing.push(stack);
        } else {
            this.stacks.set(tileKey(stack.x, stack.y), [stack]);
        }
        this.stackList.push(stack);
        return stack;
    }

    removeTree(tree) { this._removeFrom(this.trees, this.treeList, tree); }
    removeDeposit(dep) { this._removeFrom(this.deposits, this.depositList, dep); }
    removeBush(bush) { this._removeFrom(this.bushes, this.bushList, bush); }
    removeCrop(crop) { this._removeFrom(this.crops, this.cropList, crop); }
    removeBuilding(b) { this._removeFrom(this.buildings, this.buildingList, b); }

    _removeFrom(map, list, ent) {
        map.delete(tileKey(ent.x, ent.y));
        const i = list.indexOf(ent);
        if (i !== -1) list.splice(i, 1);
    }

    removeStack(stack) {
        const arr = this.stacks.get(tileKey(stack.x, stack.y));
        if (!arr) return;
        const i = arr.indexOf(stack);
        if (i !== -1) arr.splice(i, 1);
        if (arr.length === 0) this.stacks.delete(tileKey(stack.x, stack.y));
        const li = this.stackList.indexOf(stack);
        if (li !== -1) this.stackList.splice(li, 1);
    }

    stacksAt(x, y) {
        return this.stacks.get(tileKey(x, y)) || null;
    }

    /** Drop items at a tile, merging with same-type stacks up to stackMax. */
    dropItems(x, y, type, qty) {
        let remaining = qty;
        const here = this.stacksAt(x, y);
        if (here) {
            for (const s of here) {
                if (s.type === type && s.qty < CONFIG.stackMax) {
                    const add = Math.min(CONFIG.stackMax - s.qty, remaining);
                    s.qty += add;
                    remaining -= add;
                    if (remaining <= 0) return;
                }
            }
        }
        while (remaining > 0) {
            const q = Math.min(CONFIG.stackMax, remaining);
            this.addStack(new ItemStack(x, y, type, q));
            remaining -= q;
        }
    }

    /** Total quantity of an item type across all ground stacks. */
    countItemType(type) {
        let n = 0;
        for (const s of this.stackList) if (s.type === type) n += s.qty;
        return n;
    }

    // ---- passability -------------------------------------------------------

    isWalkable(x, y) {
        if (!this.inBounds(x, y)) return false;
        const t = this.tiles[y * this.width + x];
        if (t === this.TILES.WATER || t === this.TILES.ROCK) return false;
        if (this.trees.has(tileKey(x, y))) return false;
        if (this.deposits.has(tileKey(x, y))) return false;
        const b = this.buildings.get(tileKey(x, y));
        if (b && !b.def.walkable) return false;
        return true;
    }

    /** Find a random walkable tile near a point (for spawns/wandering). */
    randomWalkableNear(cx, cy, radius, rng = Math.random) {
        for (let i = 0; i < 40; i++) {
            const x = cx + Math.floor((rng() * 2 - 1) * radius);
            const y = cy + Math.floor((rng() * 2 - 1) * radius);
            if (this.isWalkable(x, y)) return { x, y };
        }
        return null;
    }

    /**
     * Build (once) an offscreen canvas with the full ground pre-rendered.
     * Called by the renderer; requires DOM.
     */
    getGroundCanvas(tileSizePx) {
        if (this.groundCanvas && this._groundTileSize === tileSizePx) return this.groundCanvas;
        const c = document.createElement('canvas');
        c.width = this.width * tileSizePx;
        c.height = this.height * tileSizePx;
        const ctx = c.getContext('2d');
        this.renderGround(ctx, tileSizePx);
        this.groundCanvas = c;
        this._groundTileSize = tileSizePx;
        return c;
    }

    renderGround(ctx, ts) {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const t = this.tiles[y * this.width + x];
                const shade = this.shade[y * this.width + x];
                let base;
                switch (t) {
                    case this.TILES.WATER: base = PALETTE.waterDeep; break;
                    case this.TILES.SAND: base = PALETTE.sand; break;
                    case this.TILES.GRASS: base = hash2d(x, y, 3) > 0.5 ? PALETTE.grass : PALETTE.grassAlt; break;
                    case this.TILES.DIRT: base = PALETTE.dirt; break;
                    default: base = hash2d(x, y, 5) > 0.5 ? PALETTE.rock : PALETTE.rockAlt;
                }
                ctx.fillStyle = shadeColor(base, shade);
                ctx.fillRect(x * ts, y * ts, ts, ts);

                // Shoreline highlight for water next to land
                if (t === this.TILES.WATER) {
                    if (this.tileAt(x, y - 1) !== this.TILES.WATER ||
                        this.tileAt(x, y + 1) !== this.TILES.WATER ||
                        this.tileAt(x - 1, y) !== this.TILES.WATER ||
                        this.tileAt(x + 1, y) !== this.TILES.WATER) {
                        ctx.fillStyle = 'rgba(255,255,255,0.08)';
                        ctx.fillRect(x * ts, y * ts, ts, ts);
                    }
                } else if (t === this.TILES.GRASS && hash2d(x, y, 21) > 0.72) {
                    // grass tufts
                    ctx.fillStyle = 'rgba(255,255,255,0.06)';
                    ctx.fillRect(x * ts + ts * 0.25, y * ts + ts * 0.55, ts * 0.12, ts * 0.12);
                    ctx.fillRect(x * ts + ts * 0.6, y * ts + ts * 0.3, ts * 0.1, ts * 0.1);
                } else if (t === this.TILES.ROCK && hash2d(x, y, 23) > 0.8) {
                    ctx.fillStyle = 'rgba(0,0,0,0.10)';
                    ctx.fillRect(x * ts + ts * 0.3, y * ts + ts * 0.35, ts * 0.35, ts * 0.28);
                }
            }
        }
    }
}

/** Lighten/darken a hex colour by multiplying RGB with a factor. */
function shadeColor(hex, factor) {
    const n = parseInt(hex.slice(1), 16);
    const r = clamp(Math.round(((n >> 16) & 255) * factor), 0, 255);
    const g = clamp(Math.round(((n >> 8) & 255) * factor), 0, 255);
    const b = clamp(Math.round((n & 255) * factor), 0, 255);
    return `rgb(${r},${g},${b})`;
}

if (typeof module !== 'undefined') module.exports = { World };
