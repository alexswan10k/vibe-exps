// City Builder Game Tests using Deno
import { assertEquals, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Import our game modules
import { CityGrid } from './grid-system.js';
import { ResourceManager } from './resource-manager.js';
import { BUILDING_TYPES, createBuilding, canPlaceBuilding, placeBuilding } from './building-types.js';

Deno.test("CityGrid - Basic Grid Operations", () => {
    const grid = new CityGrid(10, 10, 32);

    // Test grid dimensions
    assertEquals(grid.width, 10);
    assertEquals(grid.height, 10);
    assertEquals(grid.cellSize, 32);

    // Test initial state
    assertEquals(grid.buildingCount, 0);
    assertEquals(grid.getBuildingAt(0, 0), null);
});

Deno.test("CityGrid - Building Placement", () => {
    const grid = new CityGrid(10, 10, 32);
    const building = createBuilding('residential', 2, 3);

    // Test building creation
    assertEquals(building.type.id, 'residential');
    assertEquals(building.x, 2);
    assertEquals(building.y, 3);

    // Test placement validation
    assert(canPlaceBuilding(building.type, grid, 2, 3));

    // Test placement
    assert(placeBuilding(building, grid));
    assertEquals(grid.getBuildingAt(2, 3), building);
    assertEquals(grid.buildingCount, 1);
});

Deno.test("CityGrid - Statistics Calculation", () => {
    const grid = new CityGrid(10, 10, 32);

    // Place some buildings
    const residential = createBuilding('residential', 0, 0);
    const commercial = createBuilding('commercial', 1, 0);
    const powerPlant = createBuilding('power', 2, 0);

    placeBuilding(residential, grid);
    placeBuilding(commercial, grid);
    placeBuilding(powerPlant, grid);

    const stats = grid.getStatistics();

    // Test building count - power plant is 2x2 so counts as 4 buildings in grid
    assertEquals(stats.totalBuildings, 6);

    // Test resource calculations
    assertEquals(stats.totalPowerProduction, 500); // Power plant produces 500
    assertEquals(stats.totalPowerConsumption, 30); // Residential + Commercial + Power plant consumption
    assertEquals(stats.totalWaterConsumption, 23); // Residential + Commercial + Power plant consumption
    assertEquals(stats.totalTaxRevenue, 600); // All buildings' tax revenue
});

Deno.test("ResourceManager - Basic Resource Management", () => {
    const resourceManager = new ResourceManager();

    // Test initial resources
    assertEquals(resourceManager.resources.money, 10000);
    assertEquals(resourceManager.resources.power.available, 0);
    assertEquals(resourceManager.resources.population, 0);

    // Test spending money
    assert(resourceManager.spendMoney(1000));
    assertEquals(resourceManager.resources.money, 9000);

    // Test insufficient funds
    assert(!resourceManager.spendMoney(10000));
    assertEquals(resourceManager.resources.money, 9000);
});

Deno.test("ResourceManager - Resource Updates", () => {
    const resourceManager = new ResourceManager();

    // Create mock buildings
    const buildings = [
        createBuilding('residential', 0, 0),
        createBuilding('commercial', 1, 0),
        createBuilding('power', 2, 0)
    ];

    // Update resources
    resourceManager.updateResources(buildings, 1000);

    // Check power calculations
    assertEquals(resourceManager.resources.power.production, 500);
    assertEquals(resourceManager.resources.power.consumption, 30); // 10 + 15 + 5
    assertEquals(resourceManager.resources.power.available, 470); // 500 - 30

    // Check water calculations - available is clamped to 0 minimum
    assertEquals(resourceManager.resources.water.production, 0);
    assertEquals(resourceManager.resources.water.consumption, 23); // 5 + 8 + 10
    assertEquals(resourceManager.resources.water.available, 0); // max(0, 0 - 23)
});

Deno.test("Building Types - Building Properties", () => {
    const residential = BUILDING_TYPES.residential;
    const commercial = BUILDING_TYPES.commercial;
    const powerPlant = BUILDING_TYPES.power;

    // Test residential properties
    assertEquals(residential.name, 'Residential');
    assertEquals(residential.cost, 1000);
    assertEquals(residential.populationCapacity, 100);
    assertEquals(residential.jobCapacity, 0);

    // Test commercial properties
    assertEquals(commercial.name, 'Commercial');
    assertEquals(commercial.cost, 1500);
    assertEquals(commercial.populationCapacity, 0);
    assertEquals(commercial.jobCapacity, 50);

    // Test power plant properties
    assertEquals(powerPlant.name, 'Power Plant');
    assertEquals(powerPlant.cost, 5000);
    assertEquals(powerPlant.powerProduction, 500);
    assertEquals(powerPlant.size.width, 2);
    assertEquals(powerPlant.size.height, 2);
});

Deno.test("Building Types - Building Creation and Validation", () => {
    const grid = new CityGrid(10, 10, 32);

    // Test building creation
    const building = createBuilding('residential', 0, 0);
    assertEquals(building.type.id, 'residential');
    assertEquals(building.x, 0);
    assertEquals(building.y, 0);

    // Test placement validation
    assert(canPlaceBuilding(building.type, grid, 0, 0));
    assert(!canPlaceBuilding(building.type, grid, -1, 0)); // Out of bounds

    // Test placement
    assert(placeBuilding(building, grid));
    assertEquals(grid.getBuildingAt(0, 0), building);
});

Deno.test("ResourceManager - Happiness Calculation", () => {
    const resourceManager = new ResourceManager();

    // Create buildings with different happiness impacts
    const buildings = [
        createBuilding('residential', 0, 0), // +5 happiness
        createBuilding('industrial', 1, 0),  // -10 happiness
        createBuilding('industrial', 2, 0),  // -10 happiness (more consumption)
        createBuilding('industrial', 3, 0),  // -10 happiness (even more consumption)
    ];

    // Update resources
    resourceManager.updateResources(buildings, 1000);

    // Check happiness calculation
    // Base happiness (50) + building impacts (-30) = 20
    // With high power consumption and no production, happiness should be low
    assert(resourceManager.resources.happiness < 30); // Should be reduced due to power shortage
});

Deno.test("CityGrid - Area Operations", () => {
    const grid = new CityGrid(10, 10, 32);

    // Place buildings
    const building1 = createBuilding('residential', 0, 0);
    const building2 = createBuilding('commercial', 2, 2);
    placeBuilding(building1, grid);
    placeBuilding(building2, grid);

    // Test area emptiness
    assert(!grid.isAreaEmpty(0, 0, 1, 1)); // Building at 0,0
    assert(grid.isAreaEmpty(1, 1, 1, 1)); // Empty area

    // Test adjacent buildings - buildings at (0,0) and (2,2), so (1,1) is not adjacent to either
    const adjacent = grid.getAdjacentBuildings(1, 1);
    assertEquals(adjacent.length, 0); // (1,1) is not adjacent to (0,0) or (2,2)

    // Test building counts by type
    assertEquals(grid.countBuildingsByType('residential'), 1);
    assertEquals(grid.countBuildingsByType('commercial'), 1);
    assertEquals(grid.countBuildingsByType('industrial'), 0);
});
