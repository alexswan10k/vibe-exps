// Resource Management Module
// Note: ResourceManager class is expected to be used globally

class ResourceManager {
    constructor() {
        // Initial resources
        this.resources = {
            money: 50000,
            power: { available: 0, consumption: 0, production: 0 },
            water: { available: 0, consumption: 0, production: 0 },
            population: 0,
            jobs: 0,
            happiness: 50
        };
        
        // Resource history for charts and analysis
        this.history = {
            money: [],
            power: [],
            water: [],
            population: [],
            jobs: [],
            happiness: []
        };
        
        // Maximum history length
        this.maxHistoryLength = 100;
        
        // Callbacks for resource changes
        this.callbacks = new Map();
        
        // Game time tracking
        this.gameTime = 0;
        this.lastUpdateTime = Date.now();
    }
    
    // Update resources based on game state
    updateResources(buildings, deltaTime) {
        // Calculate resource production and consumption
        const stats = this.calculateResourceStats(buildings);
        
        // Update power
        this.resources.power.production = stats.totalPowerProduction;
        this.resources.power.consumption = stats.totalPowerConsumption;
        this.resources.power.available = Math.max(0, stats.totalPowerProduction - stats.totalPowerConsumption);
        
        // Update water
        this.resources.water.production = stats.totalWaterProduction;
        this.resources.water.consumption = stats.totalWaterConsumption;
        this.resources.water.available = Math.max(0, stats.totalWaterProduction - stats.totalWaterConsumption);
        
        // Update population and jobs
        this.resources.population = stats.totalPopulation;
        this.resources.jobs = stats.totalJobs;
        
        // Calculate money change
        const moneyChange = stats.totalTaxRevenue - stats.totalMaintenanceCost;
        this.resources.money += moneyChange * (deltaTime / 1000); // Per second
        
        // Calculate happiness
        this.calculateHappiness(stats);
        
        // Update game time
        this.gameTime += deltaTime;
        
        // Record history
        this.recordHistory();
        
        // Notify callbacks
        this.notifyCallbacks('resourcesUpdated', {
            resources: this.resources,
            stats: stats,
            deltaTime: deltaTime
        });
    }
    
    // Calculate resource statistics from buildings
    calculateResourceStats(buildings) {
        const stats = {
            totalPowerProduction: 0,
            totalPowerConsumption: 0,
            totalWaterProduction: 0,
            totalWaterConsumption: 0,
            totalPopulation: 0,
            totalJobs: 0,
            totalTaxRevenue: 0,
            totalMaintenanceCost: 0,
            totalHappinessImpact: 0,
            buildingCount: 0
        };
        
        for (const building of buildings) {
            stats.totalPowerProduction += building.type.powerProduction;
            stats.totalPowerConsumption += building.type.powerConsumption;
            stats.totalWaterProduction += building.type.waterProduction;
            stats.totalWaterConsumption += building.type.waterConsumption;
            stats.totalPopulation += building.population;
            stats.totalJobs += building.jobs;

            // Calculate tax revenue based on occupancy
            let occupancyRate = 1;
            if (building.type.populationCapacity > 0) {
                occupancyRate = building.population / building.type.populationCapacity;
            } else if (building.type.jobCapacity > 0) {
                occupancyRate = building.jobs / building.type.jobCapacity;
            } else {
                // For utility buildings, no occupancy tax scaling (flat rate if any)
                occupancyRate = 1;
            }

            stats.totalTaxRevenue += building.type.taxRevenue * occupancyRate;
            stats.totalMaintenanceCost += building.type.maintenance;
            stats.totalHappinessImpact += building.type.happinessImpact;
            stats.buildingCount++;
        }
        
        return stats;
    }
    
    // Calculate happiness based on various factors
    calculateHappiness(stats) {
        let happiness = 50; // Base happiness
        
        // Impact from power availability
        const powerRatio = stats.totalPowerConsumption > 0 ? 
            stats.totalPowerProduction / stats.totalPowerConsumption : 1;
        happiness += (powerRatio - 1) * 20;
        
        // Impact from water availability
        const waterRatio = stats.totalWaterConsumption > 0 ? 
            stats.totalWaterProduction / stats.totalWaterConsumption : 1;
        happiness += (waterRatio - 1) * 20;
        
        // Impact from job availability
        const jobRatio = stats.totalPopulation > 0 ? 
            stats.totalJobs / stats.totalPopulation : 1;
        happiness += (jobRatio - 1) * 30;
        
        // Impact from building happiness
        happiness += stats.totalHappinessImpact;
        
        // Clamp happiness between 0 and 100
        this.resources.happiness = Math.max(0, Math.min(100, happiness));
    }
    
    // Record resource history
    recordHistory() {
        // Add current values to history
        this.history.money.push(this.resources.money);
        this.history.power.push(this.resources.power.available);
        this.history.water.push(this.resources.water.available);
        this.history.population.push(this.resources.population);
        this.history.jobs.push(this.resources.jobs);
        this.history.happiness.push(this.resources.happiness);
        
        // Trim history if too long
        for (const key in this.history) {
            if (this.history[key].length > this.maxHistoryLength) {
                this.history[key].shift();
            }
        }
    }
    
    // Add a resource change callback
    addCallback(eventType, callback) {
        if (!this.callbacks.has(eventType)) {
            this.callbacks.set(eventType, new Set());
        }
        this.callbacks.get(eventType).add(callback);
    }
    
    // Remove a resource change callback
    removeCallback(eventType, callback) {
        if (this.callbacks.has(eventType)) {
            this.callbacks.get(eventType).delete(callback);
        }
    }
    
    // Notify all callbacks for an event
    notifyCallbacks(eventType, data) {
        if (this.callbacks.has(eventType)) {
            for (const callback of this.callbacks.get(eventType)) {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in resource callback: ${error}`);
                }
            }
        }
    }
    
    // Spend money
    spendMoney(amount) {
        if (this.resources.money >= amount) {
            this.resources.money -= amount;
            this.notifyCallbacks('moneySpent', { amount, remaining: this.resources.money });
            return true;
        }
        return false;
    }
    
    // Add money
    addMoney(amount) {
        this.resources.money += amount;
        this.notifyCallbacks('moneyAdded', { amount, total: this.resources.money });
    }
    
    // Check if player can afford something
    canAfford(amount) {
        return this.resources.money >= amount;
    }
    
    // Get resource summary
    getSummary() {
        return {
            money: this.resources.money,
            power: {
                available: this.resources.power.available,
                consumption: this.resources.power.consumption,
                production: this.resources.power.production,
                ratio: this.resources.power.consumption > 0 ? 
                    this.resources.power.production / this.resources.power.consumption : 1
            },
            water: {
                available: this.resources.water.available,
                consumption: this.resources.water.consumption,
                production: this.resources.water.production,
                ratio: this.resources.water.consumption > 0 ? 
                    this.resources.water.production / this.resources.water.consumption : 1
            },
            population: this.resources.population,
            jobs: this.resources.jobs,
            happiness: this.resources.happiness,
            gameTime: this.gameTime
        };
    }
    
    // Get resource history
    getHistory(resourceType, length = null) {
        if (!this.history[resourceType]) {
            return [];
        }
        
        const history = this.history[resourceType];
        if (length === null) {
            return history;
        }
        
        return history.slice(-length);
    }
    
    // Reset resources
    reset() {
        this.resources = {
            money: 50000,
            power: { available: 0, consumption: 0, production: 0 },
            water: { available: 0, consumption: 0, production: 0 },
            population: 0,
            jobs: 0,
            happiness: 50
        };
        
        this.history = {
            money: [],
            power: [],
            water: [],
            population: [],
            jobs: [],
            happiness: []
        };
        
        this.gameTime = 0;
        this.lastUpdateTime = Date.now();
        
        this.notifyCallbacks('resourcesReset', null);
    }
    
    // Serialize resources for saving
    serialize() {
        return {
            resources: this.resources,
            history: this.history,
            gameTime: this.gameTime
        };
    }
    
    // Deserialize resources from saved data
    deserialize(data) {
        this.resources = data.resources;
        this.history = data.history;
        this.gameTime = data.gameTime;
        this.lastUpdateTime = Date.now();
        
        this.notifyCallbacks('resourcesLoaded', null);
    }
}
