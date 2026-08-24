/**
 * Central tuning constants for the colony simulation.
 * Everything balance-related lives here so gameplay can be adjusted in one place.
 */
const CONFIG = {
    tileSize: 32,
    mapWidth: 64,
    mapHeight: 64,

    // Camera
    minZoom: 0.5,
    maxZoom: 2.2,
    panSpeed: 9,          // tiles per second while keys held

    // Time: ticks are fixed 60/s steps. One day = DAY_TICKS ticks.
    dayTicks: 2400,
    speeds: [1, 2, 4],
    maxCatchUpTicks: 6,

    // Needs (points, 0..100). Rates are points per tick.
    hungerRate: 100 / (1.6 * 2400),   // starve in ~1.6 days without food
    sleepRate: 100 / (1.0 * 2400),    // tired after ~1 day awake
    eatPauseTicks: 45,                // time spent eating a meal
    healthDrainStarving: 0.06,
    healthRegen: 0.02,
    bedSleepMult: 2.2,
    groundSleepMult: 0.8,
    nightLightLevel: 0.28,            // below this pawns think about bed

    pawnSpeed: 3.1,                   // tiles per second
    wanderRadius: 6,

    // Work amounts (ticks of labour at rate 1)
    work: {
        chop: 70,
        mineDeposit: 90,
        mineRock: 80,
        harvest: 30,
        plant: 25,
        construct: 110,
        craft: 100
    },
    toolWorkBonus: 1.35,              // work rate multiplier while colony has tools stocked

    // Items
    items: {
        wood:  { color: '#8a5a33', name: 'Wood' },
        stone: { color: '#9aa2a8', name: 'Stone' },
        iron:  { color: '#c8763f', name: 'Iron' },
        food:  { color: '#d1335e', name: 'Raw food' },
        meal:  { color: '#e8a13c', name: 'Meal' },
        tools: { color: '#57c7e3', name: 'Tools' }
    },
    stackMax: 50,
    stockpileCellCap: 30,
    hungerRestoreRaw: 32,
    hungerRestoreMeal: 68,

    // Recipes: item -> {inputs, amount produced}
    recipes: {
        meal:  { inputs: { food: 2 },              out: 2 },
        tools: { inputs: { iron: 2, wood: 1 },     out: 1 }
    },

    // Buildings: cost is materials delivered to the blueprint before construction starts
    builds: {
        wall:  { cost: { wood: 1, stone: 1 }, walkable: false, name: 'Wall' },
        door:  { cost: { wood: 4 },           walkable: true,  name: 'Door' },
        table: { cost: { wood: 6 },           walkable: true,  name: 'Crafting table' },
        bed:   { cost: { wood: 4 },           walkable: true,  name: 'Bed' },
        chair: { cost: { wood: 2 },           walkable: true,  name: 'Chair' }
    },

    // World generation
    gen: {
        seed: 1337,
        waterLevel: 0.34,
        sandLevel: 0.395,
        rockLevel: 0.73,
        forestThreshold: 0.56,
        treeChance: 0.42,
        bushChance: 0.012,
        depositNoise: 0.72,
        depositChance: 0.16
    },

    startPawns: 3,
    startSupplies: { wood: 16, stone: 6, food: 12 },
    maxPawns: 8,
    migrantFoodRequirement: 12,

    workCategoryLabels: {
        chop: 'Chop', mine: 'Mine', grow: 'Grow',
        construct: 'Construct', craft: 'Craft', haul: 'Haul'
    },

    // Job priority base per category (lower = more urgent when equal distance weighting)
    jobCategoryOf: {
        chop_tree: 'chop', mine_deposit: 'mine', mine_rock: 'mine',
        harvest_bush: 'grow', harvest_crop: 'grow', plant_crop: 'grow',
        haul_item: 'haul', deliver_material: 'haul',
        build_site: 'construct', craft_item: 'craft'
    }
};

/** Colour palette used by the renderer. */
const PALETTE = {
    waterDeep: '#1b4f72',
    waterShore: '#2e86c1',
    sand: '#d9c38a',
    grass: '#5d9c4a',
    grassAlt: '#549144',
    dirt: '#8a6b46',
    rock: '#7c8085',
    rockAlt: '#73777c',
    nightTint: 'rgba(16,20,58,', 
    selectionFill: 'rgba(241, 196, 15, 0.18)',
    selectionStroke: '#f1c40f',
    hoverStroke: 'rgba(255,255,255,0.55)',
    queuedStroke: '#f1c40f'
};

if (typeof module !== 'undefined') module.exports = { CONFIG, PALETTE };
