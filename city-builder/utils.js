// Seeded RNG and math helpers

function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function makeRngSeed() {
    return (Math.random() * 0xFFFFFFFF) >>> 0;
}

function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function randomOf(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
}

function pickColor(colors, rng) {
    return colors[Math.floor(rng() * colors.length)];
}

window.makeRng = makeRng;
window.makeRngSeed = makeRngSeed;
window.clamp = clamp;
window.lerp = lerp;
window.randomOf = randomOf;
window.pickColor = pickColor;
