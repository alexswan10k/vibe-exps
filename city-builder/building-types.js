// Definitions for infrastructure buildings, public services, and developable zones.
//
// Zones (residential/commercial/industrial) are painted on land; the
// development engine grows private buildings on them over time through
// construction sites and level upgrades across 4 density tiers.

// --- Infrastructure & Civic Services ---

const INFRASTRUCTURE = {
    road: {
        id: 'road',
        name: 'Road',
        category: 'transport',
        size: 1,
        costKey: 'road',
        upkeepKey: 'roadPerTile'
    },
    bridge: {
        id: 'bridge',
        name: 'Bridge',
        category: 'transport',
        size: 1,
        costKey: 'bridge',
        upkeepKey: 'bridgePerTile'
    },
    park: {
        id: 'park',
        name: 'City Park',
        category: 'parks',
        size: 1,
        costKey: 'park',
        upkeepKey: 'park',
        landValueBonus: 8,
        happinessBonus: 3
    },
    power: {
        id: 'power',
        name: 'Coal Power Plant',
        category: 'utilities',
        size: 2,
        costKey: 'power',
        upkeepKey: 'power',
        powerProduction: 280,
        waterConsumption: 6,
        pollutionRadius: 6,
        jobs: 8
    },
    wind_turbine: {
        id: 'wind_turbine',
        name: 'Wind Turbine',
        category: 'utilities',
        size: 1,
        costKey: 'wind_turbine',
        upkeepKey: 'wind_turbine',
        powerProduction: 80,
        waterConsumption: 0,
        pollutionRadius: 0,
        jobs: 2
    },
    water: {
        id: 'water',
        name: 'Water Tower',
        category: 'utilities',
        size: 2,
        costKey: 'water',
        upkeepKey: 'water',
        waterProduction: 220,
        powerConsumption: 6,
        jobs: 5
    },
    water_pump: {
        id: 'water_pump',
        name: 'Water Pump Station',
        category: 'utilities',
        size: 1,
        costKey: 'water_pump',
        upkeepKey: 'water_pump',
        waterProduction: 130,
        powerConsumption: 4,
        jobs: 3
    },
    fire_station: {
        id: 'fire_station',
        name: 'Fire Department',
        category: 'services',
        size: 2,
        costKey: 'fire_station',
        upkeepKey: 'fire_station',
        coverageRadius: 18,
        powerConsumption: 6,
        waterConsumption: 4,
        jobs: 10
    },
    police_station: {
        id: 'police_station',
        name: 'Police Precinct',
        category: 'services',
        size: 2,
        costKey: 'police_station',
        upkeepKey: 'police_station',
        coverageRadius: 20,
        powerConsumption: 6,
        waterConsumption: 4,
        jobs: 12
    },
    hospital: {
        id: 'hospital',
        name: 'General Hospital',
        category: 'services',
        size: 2,
        costKey: 'hospital',
        upkeepKey: 'hospital',
        coverageRadius: 22,
        powerConsumption: 12,
        waterConsumption: 10,
        jobs: 24
    },
    school: {
        id: 'school',
        name: 'Community School',
        category: 'services',
        size: 2,
        costKey: 'school',
        upkeepKey: 'school',
        coverageRadius: 20,
        powerConsumption: 8,
        waterConsumption: 6,
        jobs: 16
    },
    city_hall: {
        id: 'city_hall',
        name: 'City Hall',
        category: 'civic',
        size: 2,
        costKey: 'city_hall',
        upkeepKey: 'city_hall',
        landValueBonus: 14,
        happinessBonus: 6,
        powerConsumption: 10,
        waterConsumption: 8,
        jobs: 20
    }
};

// --- Zones and their 4-Tier Development Levels ---
// capacity    = residents housed at this level
// jobCapacity = jobs provided at this level
// power / water = consumption per unit at this level

const ZONES = {
    residential: {
        id: 'residential',
        zoneId: 1,
        name: 'Residential',
        color: '#4caf50',
        costKey: 'residential',
        levels: [
            { name: 'Small Cottage', capacity: 6, jobCapacity: 0, power: 2, water: 1 },
            { name: 'Townhouse Row', capacity: 18, jobCapacity: 0, power: 6, water: 4 },
            { name: 'Apartment Complex', capacity: 48, jobCapacity: 0, power: 16, water: 12 },
            { name: 'High-Rise Tower', capacity: 110, jobCapacity: 0, power: 38, water: 28 }
        ]
    },
    commercial: {
        id: 'commercial',
        zoneId: 2,
        name: 'Commercial',
        color: '#42a5f5',
        costKey: 'commercial',
        levels: [
            { name: 'Corner Store', capacity: 0, jobCapacity: 6, power: 3, water: 2 },
            { name: 'Shopping Arcade', capacity: 0, jobCapacity: 18, power: 9, water: 6 },
            { name: 'Commercial Plaza', capacity: 0, jobCapacity: 48, power: 22, water: 15 },
            { name: 'Corporate Skyscraper', capacity: 0, jobCapacity: 120, power: 50, water: 32 }
        ]
    },
    industrial: {
        id: 'industrial',
        zoneId: 3,
        name: 'Industrial',
        color: '#ffb300',
        costKey: 'industrial',
        happinessPenalty: true,
        levels: [
            { name: 'Workshop', capacity: 0, jobCapacity: 10, power: 8, water: 5 },
            { name: 'Factory Yard', capacity: 0, jobCapacity: 28, power: 20, water: 12 },
            { name: 'Heavy Manufacturing', capacity: 0, jobCapacity: 60, power: 42, water: 24 },
            { name: 'High-Tech Complex', capacity: 0, jobCapacity: 130, power: 75, water: 40 }
        ]
    }
};

const ZONE_KEYS = ['residential', 'commercial', 'industrial'];

function zoneByTileId(tileZone) {
    return ZONE_KEYS[tileZone - 1] || null;
}

function maxLevel(zoneId) {
    return ZONES[zoneId] ? ZONES[zoneId].levels.length : 1;
}

function levelDef(zoneId, level) {
    if (!ZONES[zoneId]) return { name: 'Unknown', capacity: 0, jobCapacity: 0, power: 0, water: 0 };
    const clampedLevel = Math.max(1, Math.min(level, ZONES[zoneId].levels.length));
    return ZONES[zoneId].levels[clampedLevel - 1];
}

const TOOLS = {
    SELECT: 'select',
    BULLDOZE: 'bulldoze',
    ROAD: 'road',
    ZONE_R: 'zone_residential',
    ZONE_C: 'zone_commercial',
    ZONE_I: 'zone_industrial',
    DEZONE: 'dezone',
    PARK: 'park',
    POWER: 'power',
    WIND_TURBINE: 'wind_turbine',
    WATER: 'water',
    WATER_PUMP: 'water_pump',
    FIRE_STATION: 'fire_station',
    POLICE_STATION: 'police_station',
    HOSPITAL: 'hospital',
    SCHOOL: 'school',
    CITY_HALL: 'city_hall'
};

window.INFRASTRUCTURE = INFRASTRUCTURE;
window.ZONES = ZONES;
window.ZONE_KEYS = ZONE_KEYS;
window.TOOLS = TOOLS;
window.zoneByTileId = zoneByTileId;
window.maxLevel = maxLevel;
window.levelDef = levelDef;
