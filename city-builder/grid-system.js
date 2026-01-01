// Grid System Module
// Note: CityGrid class is expected to be used globally

class CityGrid {
    constructor(width, height, cellSize = 32) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;
        
        // Initialize grid with empty cells
        this.buildings = Array(height).fill(null).map(() => Array(width).fill(null));
        
        // Track grid state for optimization
        this.dirtyCells = new Set();
        this.buildingCount = 0;
    }
    
    // Get building at specific grid position
    getBuildingAt(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return null;
        }
        return this.buildings[y][x];
    }
    
    // Set building at specific grid position
    setBuildingAt(x, y, building) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return false;
        }
        
        const oldBuilding = this.buildings[y][x];
        
        // If building is changing
        if (oldBuilding !== building) {
            // If removing a building
            if (oldBuilding && !building) {
                this.buildingCount--;
            }
            // If adding a building
            else if (!oldBuilding && building) {
                this.buildingCount++;
            }
            
            this.buildings[y][x] = building;
            this.dirtyCells.add(`${x},${y}`);
        }
        
        return true;
    }
    
    // Check if position is valid
    isValidPosition(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }
    
    // Get all buildings in the grid
    getAllBuildings() {
        const buildings = new Set();
        
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const building = this.buildings[y][x];
                if (building) {
                    buildings.add(building);
                }
            }
        }
        
        return Array.from(buildings);
    }
    
    // Get buildings in a specific area
    getBuildingsInArea(x, y, width, height) {
        const buildings = new Set();
        
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                const building = this.getBuildingAt(x + dx, y + dy);
                if (building) {
                    buildings.add(building);
                }
            }
        }
        
        return Array.from(buildings);
    }
    
    // Get empty cells in a specific area
    getEmptyCellsInArea(x, y, width, height) {
        const emptyCells = [];
        
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                if (!this.getBuildingAt(x + dx, y + dy)) {
                    emptyCells.push({ x: x + dx, y: y + dy });
                }
            }
        }
        
        return emptyCells;
    }
    
    // Check if area is completely empty
    isAreaEmpty(x, y, width, height) {
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                if (this.getBuildingAt(x + dx, y + dy)) {
                    return false;
                }
            }
        }
        return true;
    }
    
    // Get adjacent buildings to a position
    getAdjacentBuildings(x, y) {
        const adjacent = [];
        const directions = [
            { dx: -1, dy: 0 },  // left
            { dx: 1, dy: 0 },   // right
            { dx: 0, dy: -1 },  // up
            { dx: 0, dy: 1 }    // down
        ];
        
        for (const dir of directions) {
            const building = this.getBuildingAt(x + dir.dx, y + dir.dy);
            if (building) {
                adjacent.push(building);
            }
        }
        
        return adjacent;
    }
    
    // Get all buildings of a specific type
    getBuildingsByType(typeId) {
        return this.getAllBuildings().filter(building => building.type.id === typeId);
    }
    
    // Count buildings of a specific type
    countBuildingsByType(typeId) {
        return this.getBuildingsByType(typeId).length;
    }
    
    // Get total population
    getTotalPopulation() {
        return this.getAllBuildings().reduce((total, building) => {
            return total + building.population;
        }, 0);
    }
    
    // Get total jobs
    getTotalJobs() {
        return this.getAllBuildings().reduce((total, building) => {
            return total + building.jobs;
        }, 0);
    }
    
    // Get total power consumption
    getTotalPowerConsumption() {
        return this.getAllBuildings().reduce((total, building) => {
            return total + building.type.powerConsumption;
        }, 0);
    }
    
    // Get total power production
    getTotalPowerProduction() {
        return this.getAllBuildings().reduce((total, building) => {
            return total + building.type.powerProduction;
        }, 0);
    }
    
    // Get total water consumption
    getTotalWaterConsumption() {
        return this.getAllBuildings().reduce((total, building) => {
            return total + building.type.waterConsumption;
        }, 0);
    }
    
    // Get total water production
    getTotalWaterProduction() {
        return this.getAllBuildings().reduce((total, building) => {
            return total + building.type.waterProduction;
        }, 0);
    }
    
    // Get total tax revenue
    getTotalTaxRevenue() {
        return this.getAllBuildings().reduce((total, building) => {
            return total + building.type.taxRevenue;
        }, 0);
    }
    
    // Get total maintenance cost
    getTotalMaintenanceCost() {
        return this.getAllBuildings().reduce((total, building) => {
            return total + building.type.maintenance;
        }, 0);
    }
    
    // Get total happiness impact
    getTotalHappinessImpact() {
        return this.getAllBuildings().reduce((total, building) => {
            return total + building.type.happinessImpact;
        }, 0);
    }
    
    // Clear the grid
    clear() {
        this.buildings = Array(this.height).fill(null).map(() => Array(this.width).fill(null));
        this.dirtyCells.clear();
        this.buildingCount = 0;
    }
    
    // Resize the grid
    resize(newWidth, newHeight) {
        // Create new grid
        const newBuildings = Array(newHeight).fill(null).map(() => Array(newWidth).fill(null));
        
        // Copy existing buildings that fit in the new grid
        const copyWidth = Math.min(this.width, newWidth);
        const copyHeight = Math.min(this.height, newHeight);
        
        for (let y = 0; y < copyHeight; y++) {
            for (let x = 0; x < copyWidth; x++) {
                newBuildings[y][x] = this.buildings[y][x];
            }
        }
        
        // Update grid properties
        this.width = newWidth;
        this.height = newHeight;
        this.buildings = newBuildings;
        this.dirtyCells.clear();
        
        // Recalculate building count
        this.buildingCount = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.buildings[y][x]) {
                    this.buildingCount++;
                }
            }
        }
    }
    
    // Get grid statistics
    getStatistics() {
        return {
            totalBuildings: this.buildingCount,
            totalPopulation: this.getTotalPopulation(),
            totalJobs: this.getTotalJobs(),
            totalPowerConsumption: this.getTotalPowerConsumption(),
            totalPowerProduction: this.getTotalPowerProduction(),
            totalWaterConsumption: this.getTotalWaterConsumption(),
            totalWaterProduction: this.getTotalWaterProduction(),
            totalTaxRevenue: this.getTotalTaxRevenue(),
            totalMaintenanceCost: this.getTotalMaintenanceCost(),
            totalHappinessImpact: this.getTotalHappinessImpact()
        };
    }
    
    // Convert grid coordinates to world coordinates
    gridToWorld(gridX, gridY) {
        return {
            x: gridX * this.cellSize,
            y: gridY * this.cellSize
        };
    }
    
    // Convert world coordinates to grid coordinates
    worldToGrid(worldX, worldY) {
        return {
            x: Math.floor(worldX / this.cellSize),
            y: Math.floor(worldY / this.cellSize)
        };
    }
    
    // Get dirty cells for rendering optimization
    getDirtyCells() {
        return Array.from(this.dirtyCells).map(cell => {
            const [x, y] = cell.split(',').map(Number);
            return { x, y };
        });
    }
    
    // Clear dirty cells
    clearDirtyCells() {
        this.dirtyCells.clear();
    }

    // Serialize grid data
    serialize() {
        const serializedBuildings = [];
        const uniqueBuildings = this.getAllBuildings();

        for (const building of uniqueBuildings) {
            serializedBuildings.push({
                typeId: building.type.id,
                x: building.x,
                y: building.y,
                population: building.population,
                jobs: building.jobs,
                id: building.id
            });
        }

        return {
            width: this.width,
            height: this.height,
            cellSize: this.cellSize,
            buildings: serializedBuildings
        };
    }

    // Deserialize grid data
    deserialize(data) {
        // Clear current grid
        this.clear();

        // Restore dimensions if needed
        if (data.width !== this.width || data.height !== this.height) {
            this.resize(data.width, data.height);
        }

        // Restore buildings
        if (data.buildings && Array.isArray(data.buildings)) {
            for (const bData of data.buildings) {
                try {
                    // Create building using the global factory function
                    const building = window.createBuilding(bData.typeId, bData.x, bData.y);

                    // Restore stats
                    building.population = bData.population;
                    building.jobs = bData.jobs;
                    building.id = bData.id;

                    // Place on grid
                    window.placeBuilding(building, this);

                    // Restore building count manually since setBuildingAt increments it
                    // but we might want to ensure it matches
                } catch (e) {
                    console.error('Failed to restore building:', e);
                }
            }
        }
    }
}
