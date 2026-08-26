// Central game tuning constants

const CONFIG = {
    GRID_W: 256,           // Mega Regional Map (256x256 = 65,536 tiles)
    GRID_H: 256,
    CELL: 32,

    START_MONEY: 100000,   // Starting capital for mega regional development
    TICK_MS: 100,          // one simulation tick at 1x speed
    DAY_TICKS: 10,         // 1 in-game day per second at 1x
    DAYS_PER_MONTH: 24,

    SPEEDS: [1, 2, 4],

    // Placement Costs
    COSTS: {
        zone: { residential: 15, commercial: 20, industrial: 30 },
        dezoneRefund: 0.5,   // fraction of zone cost returned
        road: 25,
        bridge: 60,          // road placed over water
        bulldozeFee: 10,     // demolishing a developed building
        park: 300,
        power: 2000,         // coal plant
        wind_turbine: 800,   // clean green power
        water: 1600,         // water tower
        water_pump: 1200,    // water pump (coastal/river)
        fire_station: 1500,  // fire department
        police_station: 1800,// police station
        hospital: 3000,      // medical center
        school: 2200,        // elementary & high school
        city_hall: 5000      // civic landmark
    },

    // Monthly Upkeep per building/facility (at 100% budget funding)
    UPKEEP_PER_MONTH: {
        roadPerTile: 0.8,
        bridgePerTile: 1.5,
        park: 8,
        power: 75,
        wind_turbine: 25,
        water: 60,
        water_pump: 45,
        fire_station: 90,
        police_station: 100,
        hospital: 150,
        school: 110,
        city_hall: 120
    },

    // Base Tax Revenues per resident / worker per month at standard 9% tax rate
    TAXES_PER_MONTH: {
        residentialPerResident: 3.8,
        commercialPerJob: 5.8,
        industrialPerJob: 4.8
    },

    DEFAULT_TAX_RATES: {
        residential: 9,
        commercial: 9,
        industrial: 9
    },

    // Department budget categories and default funding (1.0 = 100%)
    DEFAULT_FUNDING: {
        roads: 1.0,
        fire: 1.0,
        police: 1.0,
        health: 1.0,
        education: 1.0,
        power: 1.0,
        water: 1.0
    },

    // City Ordinances
    ORDINANCES: {
        transit: { id: 'transit', name: 'Free Public Transit', costPerMonth: 120, trafficReduction: 0.35, happyBonus: 4 },
        smoke_detectors: { id: 'smoke_detectors', name: 'Smoke Detector Mandate', costPerMonth: 60, fireRiskReduction: 0.45, happyBonus: 2 },
        neighborhood_watch: { id: 'neighborhood_watch', name: 'Neighborhood Watch', costPerMonth: 75, crimeReduction: 0.40, happyBonus: 3 },
        clean_energy: { id: 'clean_energy', name: 'Clean Energy Subsidies', costPerMonth: 140, greenBonus: 0.25, happyBonus: 5 },
        tourism_drive: { id: 'tourism_drive', name: 'Tourism Promotion', costPerMonth: 110, comDemandBonus: 0.20, comTaxBonus: 0.15 }
    },

    // City Milestones
    MILESTONES: [
        { pop: 0, title: 'Settlement', reward: 0, desc: 'Lay down your first roads and utilities.' },
        { pop: 250, title: 'Hamlet', reward: 5000, desc: 'A modest community taking root.' },
        { pop: 1000, title: 'Village', reward: 10000, desc: 'Unlocked Wind Turbines & Schools.' },
        { pop: 3000, title: 'Town', reward: 20000, desc: 'Unlocked Police Stations & Fire Stations.' },
        { pop: 10000, title: 'City', reward: 40000, desc: 'Unlocked Hospitals & City Hall.' },
        { pop: 25000, title: 'Metropolis', reward: 75000, desc: 'High-density skyscrapers rising high.' },
        { pop: 60000, title: 'Megalopolis', reward: 150000, desc: 'The pinnacle of urban planning!' }
    ],

    // Development engine tuning
    DEV: {
        CHECK_EVERY_TICKS: 4,         // check every 400ms for fast responsive building
        CONSTRUCTION_TICKS: 20,       // 2.0s construction phase
        UPGRADE_TICKS: 80,            // level N -> N+1 while eligible
        ABANDON_AFTER_TICKS: 120,     // unserved for this long -> abandoned
        DEMOLISH_AFTER_TICKS: 300,    // abandoned this long -> cleared
        UNSERVED_RECOVERY: 2,         // decay of the unserved counter per good tick
        ROAD_ACCESS_DIST: 4,          // lots within 4 tiles of a road develop
        MIN_DEMAND_TO_BUILD: 0.04,
        MIN_DEMAND_TO_UPGRADE: 0.15,
        UPGRADE_MIN_OCCUPANCY: 0.65,
        LAND_VALUE_FOR_LEVEL: [0, 12, 24, 40], // L1->2 needs 12, L2->3 needs 24, L3->4 needs 40
        MIN_EQ_FOR_LEVEL4: 50,         // Level 4 requires educated workforce
        MIN_HEALTH_FOR_LEVEL4: 45
    },

    // Disaster & public safety parameters
    SAFETY: {
        FIRE_BASE_CHANCE: 0.0015,     // per unserved/dense building tick
        FIRE_SPREAD_CHANCE: 0.035,    // spread to adjacent buildings per tick
        FIRE_BURN_TICKS: 90,          // ticks before building turns to rubble
        CRIME_BASE_RATE: 0.002,
        DISASTER_COOLDOWN_TICKS: 300
    }
};

window.CONFIG = CONFIG;
