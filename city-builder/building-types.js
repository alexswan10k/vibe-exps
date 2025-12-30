// Building Types Module
// Note: All classes and constants are expected to be used globally

class BuildingType {
    constructor(id, name, color, cost, maintenance, powerConsumption, waterConsumption, 
                powerProduction, waterProduction, populationCapacity, jobCapacity, 
                taxRevenue, happinessImpact, size = { width: 1, height: 1 }) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.cost = cost;
        this.maintenance = maintenance;
        this.powerConsumption = powerConsumption;
        this.waterConsumption = waterConsumption;
        this.powerProduction = powerProduction;
        this.waterProduction = waterProduction;
        this.populationCapacity = populationCapacity;
        this.jobCapacity = jobCapacity;
        this.taxRevenue = taxRevenue;
        this.happinessImpact = happinessImpact;
        this.size = size;
    }
    
    getNetPower() {
        return this.powerProduction - this.powerConsumption;
    }
    
    getNetWater() {
        return this.waterProduction - this.waterConsumption;
    }
    
    getProfit() {
        return this.taxRevenue - this.maintenance;
    }
}

// Define all building types
const RESIDENTIAL = new BuildingType(
    'residential',
    'Residential',
    '#3498db',
    1000,
    50,
    10,
    5,
    0,
    0,
    100,
    0,
    200,
    5,
    { width: 1, height: 1 }
);

const COMMERCIAL = new BuildingType(
    'commercial',
    'Commercial',
    '#2ecc71',
    1500,
    75,
    15,
    8,
    0,
    0,
    0,
    50,
    300,
    0,
    { width: 1, height: 1 }
);

const INDUSTRIAL = new BuildingType(
    'industrial',
    'Industrial',
    '#e67e22',
    2000,
    100,
    25,
    12,
    0,
    0,
    0,
    100,
    400,
    -10,
    { width: 1, height: 1 }
);

const POWER_PLANT = new BuildingType(
    'power',
    'Power Plant',
    '#f1c40f',
    5000,
    200,
    5,
    10,
    500,
    0,
    0,
    20,
    100,
    -5,
    { width: 2, height: 2 }
);

const WATER_PLANT = new BuildingType(
    'water',
    'Water Plant',
    '#3498db',
    4000,
    150,
    10,
    5,
    0,
    400,
    0,
    15,
    80,
    -3,
    { width: 2, height: 2 }
);

// All building types
const BUILDING_TYPES = {
    residential: RESIDENTIAL,
    commercial: COMMERCIAL,
    industrial: INDUSTRIAL,
    power: POWER_PLANT,
    water: WATER_PLANT
};

// Building class instances
class Building {
    constructor(type, x, y) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.population = 0;
        this.jobs = 0;
        this.id = `${type.id}_${x}_${y}_${Date.now()}`;
    }
    
    populate(count) {
        this.population = Math.min(count, this.type.populationCapacity);
    }
    
    assignJobs(count) {
        this.jobs = Math.min(count, this.type.jobCapacity);
    }
    
    getPopulationPercentage() {
        if (this.type.populationCapacity === 0) return 0;
        return Math.round((this.population / this.type.populationCapacity) * 100);
    }
    
    getJobPercentage() {
        if (this.type.jobCapacity === 0) return 0;
        return Math.round((this.jobs / this.type.jobCapacity) * 100);
    }
}

// Factory function to create buildings
function createBuilding(typeId, x, y) {
    const type = BUILDING_TYPES[typeId];
    if (!type) {
        throw new Error(`Unknown building type: ${typeId}`);
    }
    return new Building(type, x, y);
}

// Helper function to get building type by ID
function getBuildingType(id) {
    return BUILDING_TYPES[id];
}

// Helper function to validate building placement
function canPlaceBuilding(buildingType, grid, x, y) {
    // Check if coordinates are valid (non-negative)
    if (x < 0 || y < 0) {
        return false;
    }

    // Check if building fits within grid
    if (x + buildingType.size.width > grid.width || y + buildingType.size.height > grid.height) {
        return false;
    }

    // Check if all cells are empty
    for (let dx = 0; dx < buildingType.size.width; dx++) {
        for (let dy = 0; dy < buildingType.size.height; dy++) {
            if (grid.getBuildingAt(x + dx, y + dy)) {
                return false;
            }
        }
    }

    return true;
}

// Helper function to place building on grid
function placeBuilding(building, grid) {
    const { type, x, y } = building;
    
    for (let dx = 0; dx < type.size.width; dx++) {
        for (let dy = 0; dy < type.size.height; dy++) {
            grid.setBuildingAt(x + dx, y + dy, building);
        }
    }
    
    return true;
}

// Helper function to remove building from grid
function removeBuilding(building, grid) {
    const { type, x, y } = building;
    
    for (let dx = 0; dx < type.size.width; dx++) {
        for (let dy = 0; dy < type.size.height; dy++) {
            grid.setBuildingAt(x + dx, y + dy, null);
        }
    }
    
    return true;
}

// Make everything globally available
window.BuildingType = BuildingType;
window.RESIDENTIAL = RESIDENTIAL;
window.COMMERCIAL = COMMERCIAL;
window.INDUSTRIAL = INDUSTRIAL;
window.POWER_PLANT = POWER_PLANT;
window.WATER_PLANT = WATER_PLANT;
window.BUILDING_TYPES = BUILDING_TYPES;
window.Building = Building;
window.createBuilding = createBuilding;
window.getBuildingType = getBuildingType;
window.canPlaceBuilding = canPlaceBuilding;
window.placeBuilding = placeBuilding;
window.removeBuilding = removeBuilding;
