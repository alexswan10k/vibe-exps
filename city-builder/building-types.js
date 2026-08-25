// Definitions for infrastructure buildings and developable zones.
//
// Zones (residential/commercial/industrial) are painted on land; the
// development engine grows private buildings on them over time through
// construction sites and level upgrades.

// --- Infrastructure ---

const INFRASTRUCTURE = {
    road: {
        id: 'road',
        name: 'Road',
        size: 1,
        costKey: 'road',
        upkeepKey: 'roadPerTile'
    },
    park: {
        id: 'park',
        name: 'Park',
        size: 1,
        costKey: 'park',
        upkeepKey: 'park'
    },
    power: {
        id: 'power',
        name: 'Coal Power Plant',
        size: 2,
        costKey: 'power',
        upkeepKey: 'power',
        powerProduction: 260,
        waterConsumption: 5,
        jobs: 8
    },
    water: {
        id: 'water',
        name: 'Water Tower',
        size: 2,
        costKey: 'water',
        upkeepKey: 'water',
        waterProduction: 200,
        powerConsumption: 6,
        jobs: 5
    }
};

// --- Zones and their development levels ---
// capacity   = residents housed at this level
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
            { name: 'Small House', capacity: 6, jobCapacity: 0, power: 3, water: 2 },
            { name: 'Townhouses', capacity: 18, jobCapacity: 0, power: 8, water: 6 },
            { name: 'Apartment Block', capacity: 48, jobCapacity: 0, power: 20, water: 15 }
        ]
    },
    commercial: {
        id: 'commercial',
        zoneId: 2,
        name: 'Commercial',
        color: '#42a5f5',
        costKey: 'commercial',
        levels: [
            { name: 'Corner Shop', capacity: 0, jobCapacity: 6, power: 4, water: 3 },
            { name: 'Office Block', capacity: 0, jobCapacity: 18, power: 11, water: 8 },
            { name: 'Shopping Mall', capacity: 0, jobCapacity: 42, power: 26, water: 20 }
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
            { name: 'Workshop', capacity: 0, jobCapacity: 10, power: 10, water: 6 },
            { name: 'Factory', capacity: 0, jobCapacity: 26, power: 24, water: 14 },
            { name: 'Heavy Industry', capacity: 0, jobCapacity: 54, power: 46, water: 28 }
        ]
    }
};

const ZONE_KEYS = ['residential', 'commercial', 'industrial'];

function zoneByTileId(tileZone) {
    return ZONE_KEYS[tileZone - 1] || null;
}

function maxLevel(zoneId) {
    return ZONES[zoneId].levels.length;
}

function levelDef(zoneId, level) {
    return ZONES[zoneId].levels[level - 1];
}

window.INFRASTRUCTURE = INFRASTRUCTURE;
window.ZONES = ZONES;
window.ZONE_KEYS = ZONE_KEYS;
window.zoneByTileId = zoneByTileId;
window.maxLevel = maxLevel;
window.levelDef = levelDef;
