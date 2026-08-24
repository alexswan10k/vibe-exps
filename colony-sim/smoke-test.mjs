/**
 * Headless smoke test for colony-sim core logic (no DOM).
 * Loads the browser scripts into a vm sandbox and simulates ticks.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const DIR = new URL('.', import.meta.url).pathname;
const FILES = [
    'config.js', 'utils.js', 'noise.js', 'pathfinding.js',
    'entities.js', 'task-manager.js', 'pawn.js', 'world.js'
];

const sandbox = {
    console,
    Math,
    JSON,
    performance: { now: () => Date.now() },
    result: {}
};
vm.createContext(sandbox);

for (const f of FILES) {
    const code = fs.readFileSync(path.join(DIR, f), 'utf8');
    try {
        vm.runInContext(code, sandbox, { filename: f });
    } catch (err) {
        console.error(`✗ ${f} threw while loading:`, err.message);
        process.exit(1);
    }
}
console.log('✓ all core scripts load cleanly');

// Top-level const/class don't attach to the sandbox object; export explicitly.
Object.assign(sandbox, vm.runInContext(
    '({ CONFIG, PALETTE, ValueNoise, findPath, tileKey, ItemStack, Tree, IronDeposit, WildBush, Crop, Building, Zone, JobBoard, Pawn, World })',
    sandbox
));
const { CONFIG } = sandbox;

let failures = 0;
function assert(cond, msg) {
    if (cond) console.log('  ✓', msg);
    else { console.error('  ✗ FAIL:', msg); failures++; }
}

// ---- 1. World generation ------------------------------------------------
console.log('\n[1] World generation');
const w1 = new sandbox.World(CONFIG.mapWidth, CONFIG.mapHeight, 42);
const w2 = new sandbox.World(CONFIG.mapWidth, CONFIG.mapHeight, 42);
assert(w1.tiles.every((t, i) => t === w2.tiles[i]), 'generation is deterministic per seed');

const counts = { water: 0, sand: 0, grass: 0, dirt: 0, rock: 0 };
for (let i = 0; i < w1.tiles.length; i++) {
    const t = w1.tiles[i];
    if (t === w1.TILES.WATER) counts.water++;
    else if (t === w1.TILES.SAND) counts.sand++;
    else if (t === w1.TILES.GRASS) counts.grass++;
    else if (t === w1.TILES.DIRT) counts.dirt++;
    else counts.rock++;
}
console.log('   terrain mix:', counts);
assert(counts.grass > 500, 'has substantial grass');
assert(counts.water > 30 && counts.water < 2000, 'has some (not too much) water');
assert(counts.rock > 20, 'has quarryable rock');
assert(w1.treeList.length > 40, `trees clustered (${w1.treeList.length})`);
assert(w1.depositList.length > 3, `iron deposits exist (${w1.depositList.length})`);
assert(w1.bushList.length > 5, `wild bushes exist (${w1.bushList.length})`);

// ---- 2. Pathfinding --------------------------------------------------------
console.log('\n[2] Pathfinding');
// find an open grass area
let open = null;
for (let y = 5; y < 50 && !open; y++) {
    for (let x = 5; x < 50 && !open; x++) {
        let clear = true;
        for (let dy = -1; dy <= 1 && clear; dy++)
            for (let dx = -1; dx <= 1 && clear; dx++)
                if (!w1.isWalkable(x + dx, y + dy)) clear = false;
        if (clear) open = { x, y };
    }
}
assert(!!open, 'found an open area');
const passable = (x, y) => w1.isWalkable(x, y);

if (open) {
    const p1 = sandbox.findPath(passable, open.x, open.y, open.x + 4, open.y);
    assert(p1 !== null && p1.length >= 5, 'straight-line path found');
    assert(p1.every(n => passable(n.x, n.y)), 'path stays walkable');

    // Long wall with a single gap: build a vertical wall of buildings
    const wx = open.x + 2;
    const wallTiles = new Set();
    for (let y = Math.max(1, open.y - 12); y <= Math.min(w1.height - 2, open.y + 12); y++) {
        if (y === open.y) continue; // gap
        // Only place where terrain itself is walkable, so the gap stays meaningful
        if (!passable(wx, y)) continue;
        const tree = w1.trees.get(sandbox.tileKey(wx, y));
        if (tree) w1.removeTree(tree);
        w1.addBuilding(new sandbox.Building('wall', wx, y));
        wallTiles.add(sandbox.tileKey(wx, y));
    }
    assert(wallTiles.size > 6, 'wall placed');
    const blocked = sandbox.findPath(passable, open.x, open.y, open.x + 4, open.y);
    assert(blocked !== null, 'route past the wall exists');
    if (blocked) {
        assert(!blocked.some(n => wallTiles.has(sandbox.tileKey(n.x, n.y))),
            'path never crosses an actual wall tile');
    }
}

// ---- 3. Full simulation -----------------------------------------------------
console.log('\n[3] Simulated colony (chop -> haul -> build -> craft)');
{
    // Fresh deterministic world for scenario testing
    const world = new sandbox.World(48, 48, 7);
    const logs = [];
    const game = {
        tick: 1000,
        world,
        zones: [],
        pawns: [],
        messages: [],
        hintsShown: new Set(),
        jobs: null,
        lightLevel: () => 1,
        toolsBuffActive: () => false,
        log(text, cls) { logs.push(text); },
        hintOnce(key, text) {},
        killPawn(pawn) { pawn.dead = true; },
        onBuildingCompleted() {},
        dayNumber: 0, day: 0,
        timeOfDay: () => 0.5
    };
    const board = new sandbox.JobBoard(game);
    game.jobs = board;

    // Home base
    let home = null;
    outer:
    for (let r = 0; r < 24; r++) {
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            if (world.isWalkable(24 + dx, 24 + dy)) { home = { x: 24 + dx, y: 24 + dy }; break outer; }
        }
    }
    assert(!!home, 'home tile found');

    // Stockpile zone next to home
    let zx = home.x + 2, zy = home.y;
    while (!world.isWalkable(zx, zy)) zy--;
    game.zones.push(new sandbox.Zone('stockpile', zx, zy, 3, 2));

    // Two pawns
    for (let i = 0; i < 2; i++) {
        const spot = world.randomWalkableNear(home.x, home.y, 3) || home;
        game.pawns.push(new sandbox.Pawn(spot.x + 0.5, spot.y + 0.5, 'T' + i, i));
    }

    // Drop wood outside the stockpile
    const dropSpot = world.randomWalkableNear(home.x - 2, home.y, 2) || home;
    world.dropItems(dropSpot.x, dropSpot.y, 'wood', 10);

    // Nearest tree for chopping
    let tree = null, bestD = Infinity;
    for (const t of world.treeList) {
        const d = Math.abs(t.x - home.x) + Math.abs(t.y - home.y);
        if (d < bestD) { bestD = d; tree = t; }
    }
    assert(!!tree, 'a tree exists to chop');
    if (tree) board.post('chop_tree', tree.x, tree.y, tree);

    // A building blueprint needing materials
    let site = null;
    for (const cand of [[home.x + 1, home.y - 1], [home.x - 1, home.y - 1], [home.x + 1, home.y], [home.x - 1, home.y]]) {
        if (world.isWalkable(cand[0], cand[1])) { site = { x: cand[0], y: cand[1] }; break; }
    }
    assert(!!site, 'buildable site found');
    const blueprint = new sandbox.Building('table', site.x, site.y);
    world.addBuilding(blueprint);
    // Materials pile next to site
    const matSpot = world.randomWalkableNear(site.x, site.y, 2) || site;
    world.dropItems(matSpot.x, matSpot.y, 'wood', 12);

    // Run the sim
    const MAX_TICKS = 12000;
    let chopped = false, hauled = false, built = false;
    for (game.tick = 1000; game.tick < 1000 + MAX_TICKS; game.tick++) {
        if (game.tick % 20 === 0) board.update();

        for (const crop of world.cropList) {
            if (crop.growth < 100) crop.growth += crop.growRate;
        }
        let died = false;
        for (const p of [...game.pawns]) {
            if (!p.dead) { p.update(game); if (p.dead) died = true; }
        }
        if (died) game.pawns = game.pawns.filter(p => !p.dead);

        if (!chopped && !world.treeList.includes(tree)) chopped = true;
        if (!hauled && world.stackList.some(s =>
            s.type === 'wood' &&
            game.zones[0].contains(s.x, s.y))) hauled = true;
        if (!built && blueprint.built) built = true;

        if (built && chopped && hauled) break;
    }
    console.log(`   simulated ${game.tick - 999} ticks`);
    assert(chopped, 'tree was chopped');
    assert(hauled, 'loose wood got hauled into the stockpile');
    assert(built, 'blueprint was delivered-to and constructed');

    // Crafting flow: raw food is available, cook meals
    world.dropItems(home.x, home.y, 'food', 6);
    board.craftQueue.push('meal');
    board.update();
    const beforeMeals = world.countItemType('meal');
    let crafted = false;
    for (; game.tick < 1000 + MAX_TICKS * 2; game.tick++) {
        if (game.tick % 20 === 0) board.update();
        for (const p of [...game.pawns]) if (!p.dead) p.update(game);
        if (world.countItemType('meal') > beforeMeals) { crafted = true; break; }
        if (board.jobs.length === 0 && !board.craftQueue.length) break;
    }
    assert(crafted, `meals were cooked at the table (${world.countItemType('meal')} meals)`);

    // Farming flow
    game.zones.push(new sandbox.Zone('growing', zx, zy + 2, 2, 2));
    let planted = false, harvestedFood = false;
    const foodBefore = world.countItemType('food');
    for (; game.tick < 1000 + MAX_TICKS * 3; game.tick++) {
        if (game.tick % 20 === 0) board.update();
        for (const crop of world.cropList) {
            if (crop.growth < 100) crop.growth += crop.growRate;
        }
        for (const p of [...game.pawns]) if (!p.dead) p.update(game);
        if (!planted && world.cropList.length > 0) planted = true;
        if (planted && world.countItemType('food') > foodBefore + 4) { harvestedFood = true; break; }
    }
    assert(planted, 'crops were planted in the growing zone');
    assert(harvestedFood, 'crops grew and were harvested for food');

    // No pawn died of starvation during the run (they should have eaten)
    const starved = logs.filter(l => l.includes('died'));
    assert(starved.length === 0, `nobody starved (${starved.join('; ')})`);

    console.log('\n   message log sample:', logs.slice(0, 6));
}

// ---- verdict ------------------------------------------------------------------
console.log(failures === 0 ? '\nALL SMOKE TESTS PASSED' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
