// Debug script to check actual values
import { CityGrid } from './grid-system.js';
import { ResourceManager } from './resource-manager.js';
import { BUILDING_TYPES, createBuilding, canPlaceBuilding, placeBuilding } from './building-types.js';

console.log("=== DEBUGGING CITY BUILDER ===");

// Test grid statistics
console.log("\n--- Grid Statistics Test ---");
const grid = new CityGrid(10, 10, 32);
const residential = createBuilding('residential', 0, 0);
const commercial = createBuilding('commercial', 1, 0);
const powerPlant = createBuilding('power', 2, 0);

placeBuilding(residential, grid);
placeBuilding(commercial, grid);
placeBuilding(powerPlant, grid);

const stats = grid.getStatistics();
console.log("Stats:", stats);
console.log("Expected tax revenue: 600, Actual:", stats.totalTaxRevenue);

// Test resource updates
console.log("\n--- Resource Updates Test ---");
const resourceManager = new ResourceManager();
const buildings = [
    createBuilding('residential', 0, 0),
    createBuilding('commercial', 1, 0),
    createBuilding('power', 2, 0)
];

resourceManager.updateResources(buildings, 1000);
console.log("Resources:", resourceManager.resources);
console.log("Expected water available: -23, Actual:", resourceManager.resources.water.available);

// Test building placement validation
console.log("\n--- Building Placement Test ---");
const grid2 = new CityGrid(10, 10, 32);
const building = createBuilding('residential', 0, 0);
console.log("Can place at (0,0):", canPlaceBuilding(building.type, grid2, 0, 0));
console.log("Can place at (-1,0):", canPlaceBuilding(building.type, grid2, -1, 0));

// Test adjacent buildings
console.log("\n--- Adjacent Buildings Test ---");
const grid3 = new CityGrid(10, 10, 32);
const building1 = createBuilding('residential', 0, 0);
const building2 = createBuilding('commercial', 2, 2);
placeBuilding(building1, grid3);
placeBuilding(building2, grid3);

const adjacent = grid3.getAdjacentBuildings(1, 1);
console.log("Adjacent buildings at (1,1):", adjacent.length);
console.log("Adjacent buildings:", adjacent.map(b => `${b.type.name} at (${b.x},${b.y})`));

// Test happiness calculation
console.log("\n--- Happiness Calculation Test ---");
const resourceManager2 = new ResourceManager();
const buildings2 = [
    createBuilding('residential', 0, 0), // +5 happiness
    createBuilding('industrial', 1, 0),  // -10 happiness
    createBuilding('power', 2, 0)        // -5 happiness
];

resourceManager2.updateResources(buildings2, 1000);
console.log("Happiness:", resourceManager2.resources.happiness);
console.log("Expected: < 50, Actual:", resourceManager2.resources.happiness);
