/**
 * Small shared helpers: seeded RNG, hashing, inventory ops, math.
 */

/** Create a deterministic PRNG (mulberry32). */
function makeRNG(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Deterministic pseudo-random value in [0,1) for a tile coordinate. */
function hash2d(x, y, seed) {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Euclidean distance. */
function dist(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

/** Chebyshev distance (king-move count). */
function chebyshev(x1, y1, x2, y2) {
    return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
}

function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

/** Map key for a tile coordinate. */
function tileKey(x, y) {
    return x + ',' + y;
}

/** Add quantity of an item type to an inventory array [{type, qty}]. */
function invAdd(inv, type, qty) {
    const slot = inv.find(s => s.type === type);
    if (slot) slot.qty += qty;
    else inv.push({ type, qty });
}

/** Remove quantity from inventory. Returns amount actually removed. */
function invRemove(inv, type, qty) {
    const idx = inv.findIndex(s => s.type === type);
    if (idx === -1) return 0;
    const slot = inv[idx];
    const taken = Math.min(slot.qty, qty);
    slot.qty -= taken;
    if (slot.qty <= 0) inv.splice(idx, 1);
    return taken;
}

function invCount(inv, type) {
    const slot = inv.find(s => s.type === type);
    return slot ? slot.qty : 0;
}

/** Format ticks-since-dawn as a clock string. */
function formatClock(time01) {
    const totalMin = Math.floor(time01 * 24 * 60);
    const h = String(Math.floor(totalMin / 60)).padStart(2, '0');
    const m = String(totalMin % 60).padStart(2, '0');
    return h + ':' + m;
}

if (typeof module !== 'undefined') module.exports = { makeRNG, hash2d, dist, chebyshev, clamp, lerp, tileKey, invAdd, invRemove, invCount, formatClock };
