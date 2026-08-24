/**
 * Game entities: world objects, items on the ground, crops and zones.
 * Plain data classes — behaviour lives in JobBoard / Pawn / World.
 */
let ENTITY_ID = 1;

/** A stack of items lying on the ground. */
class ItemStack {
    constructor(x, y, type, qty) {
        this.id = ENTITY_ID++;
        this.x = x;
        this.y = y;
        this.type = type;
        this.qty = qty;
    }
}

/** A harvestable tree. Blocks movement. */
class Tree {
    constructor(x, y) {
        this.id = ENTITY_ID++;
        this.x = x;
        this.y = y;
        this.hp = CONFIG.work.chop;
        this.variant = Math.floor(hash2d(x, y, 7) * 3); // visual variety
    }
}

/** A surface iron deposit. Blocks movement. */
class IronDeposit {
    constructor(x, y) {
        this.id = ENTITY_ID++;
        this.x = x;
        this.y = y;
        this.hp = CONFIG.work.mineDeposit;
        this.richness = 2 + Math.floor(hash2d(x, y, 13) * 3);
    }
}

/** Wild berry bush: one-time food source. */
class WildBush {
    constructor(x, y) {
        this.id = ENTITY_ID++;
        this.x = x;
        this.y = y;
        this.yield = 3;
    }
}

/** A planted crop that grows over time. */
class Crop {
    constructor(x, y) {
        this.id = ENTITY_ID++;
        this.x = x;
        this.y = y;
        this.growth = 0; // 0..100
        this.growRate = 100 / (1.4 * CONFIG.dayTicks); // ripe in ~1.4 days
    }

    get mature() { return this.growth >= 100; }
}

/** A building or construction blueprint. */
class Building {
    /**
     * @param {string} type - key into CONFIG.builds
     */
    constructor(type, x, y) {
        const def = CONFIG.builds[type];
        this.id = ENTITY_ID++;
        this.type = type;
        this.x = x;
        this.y = y;
        this.blueprint = true;          // true until constructed
        this.cost = def.cost;
        this.delivered = {};            // material -> qty delivered so far
        this.progress = 0;              // ticks of construction done
        this.owner = null;              // beds/chairs remember their user
        for (const mat of Object.keys(def.cost)) this.delivered[mat] = 0;
    }

    get def() { return CONFIG.builds[this.type]; }

    /** Materials still needed before construction can begin. */
    missingMaterials() {
        const missing = {};
        for (const [mat, need] of Object.entries(this.cost)) {
            const gap = need - (this.delivered[mat] || 0);
            if (gap > 0) missing[mat] = gap;
        }
        return missing;
    }

    get materialsComplete() {
        return Object.keys(this.missingMaterials()).length === 0;
    }

    get built() { return !this.blueprint; }
}

/** Rectangular zone: stockpile or growing area. */
class Zone {
    /**
     * @param {'stockpile'|'growing'} type
     */
    constructor(type, x, y, w, h) {
        this.id = ENTITY_ID++;
        this.type = type;
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }

    contains(x, y) {
        return x >= this.x && x < this.x + this.w && y >= this.y && y < this.y + this.h;
    }

    cells() {
        const out = [];
        for (let y = this.y; y < this.y + this.h; y++)
            for (let x = this.x; x < this.x + this.w; x++) out.push({ x, y });
        return out;
    }
}

if (typeof module !== 'undefined') module.exports = { ItemStack, Tree, IronDeposit, WildBush, Crop, Building, Zone };
