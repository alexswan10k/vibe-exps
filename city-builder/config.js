// Central game tuning constants

const CONFIG = {
    GRID_W: 64,
    GRID_H: 64,
    CELL: 32,

    START_MONEY: 40000,
    TICK_MS: 100,          // one simulation tick at 1x speed
    DAY_TICKS: 10,         // 1 in-game day per second at 1x
    DAYS_PER_MONTH: 24,

    SPEEDS: [1, 2, 4],

    COSTS: {
        zone: { residential: 12, commercial: 18, industrial: 28 },
        dezoneRefund: 0.5,   // fraction of zone cost returned
        road: 25,
        bulldozeFee: 10,     // demolishing a developed building
        park: 300,
        power: 2000,
        water: 1600
    },

    UPGKEEP_PER_MONTH: {
        roadPerTile: 1.0,
        park: 8,
        power: 75,
        water: 60
    },

    TAXES_PER_MONTH: {
        residentialPerResident: 3.6,
        commercialPerJob: 5.5,
        industrialPerJob: 4.5
    },

    DEV: {
        CHECK_EVERY_TICKS: 10,        // development scan cadence (~1s)
        CONSTRUCTION_TICKS: 40,       // empty lot -> level 1
        UPGRADE_TICKS: 110,           // level N -> N+1 while eligible
        ABANDON_AFTER_TICKS: 80,      // unserved for this long -> abandoned
        DEMOLISH_AFTER_TICKS: 300,    // abandoned this long -> cleared
        UNSERVED_RECOVERY: 2,         // decay of the unserved counter per good tick
        ROAD_ACCESS_DIST: 1,          // lots must front a road to develop
        MIN_DEMAND_TO_BUILD: 0.10,
        MIN_DEMAND_TO_UPGRADE: 0.25,
        UPGRADE_MIN_OCCUPANCY: 0.7,
        LAND_VALUE_FOR_LEVEL: [0, 16, 30]  // indexed by CURRENT level: L1->2 needs 16, L2->3 needs 30
    }
};

window.CONFIG = CONFIG;
