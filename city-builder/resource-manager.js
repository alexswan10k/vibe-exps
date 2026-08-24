// Resource Management Module
// Note: ResourceManager class is expected to be used globally

class ResourceManager {
    constructor() {
        // Initial resources
        // Note: population is persistent state that grows/shrinks over time.
        // Jobs = number of filled jobs (assigned to commercial/industrial buildings).
        this.resources = {
            money: 50000,
            power: { available: 0, consumption: 0, production: 0, shortage: false },
            water: { available: 0, consumption: 0, production: 0, shortage: false },
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
        
        // History recording timer (record once per second of game time)
        this.historyTimer = 0;
        
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
        this.resources.power.shortage = stats.totalPowerProduction < stats.totalPowerConsumption;
        
        // Update water
        this.resources.water.production = stats.totalWaterProduction;
        this.resources.water.consumption = stats.totalWaterConsumption;
        this.resources.water.available = Math.max(0, stats.totalWaterProduction - stats.totalWaterConsumption);
        this.resources.water.shortage = stats.totalWaterProduction < stats.totalWaterConsumption;
        
        // Note: population and jobs are NOT recomputed from buildings here.
        // They are persistent state managed by Game.growPopulation(), which
        // distributes them into buildings. We just expose the capacities.
        this.resources.housingCapacity = stats.housingCapacity;
        this.resources.jobCapacity = stats.jobCapacity;
        
        // Calculate money change (taxes scale with occupancy, set by Game)
        const moneyChange = stats.totalTaxRevenue - stats.totalMaintenanceCost;
        this.resources.money += moneyChange * (deltaTime / 1000); // Per second
        
        // Calculate happiness
        this.calculateHappiness(stats);
        
        // Update game time
        this.gameTime += deltaTime;
        
        // Record history once per second of game time
        this.historyTimer += deltaTime;
        if (this.historyTimer >= 1000) {
            this.historyTimer -= 1000;
            this.recordHistory();
        }
        
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
            housingCapacity: 0,
            jobCapacity: 0,
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
            stats.housingCapacity += building.type.populationCapacity;
            stats.jobCapacity += building.type.jobCapacity;
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
    // Runs AFTER Game has distributed population/jobs into buildings.
    calculateHappiness(stats) {
        let happiness = 50; // Base happiness
        
        // Impact from power availability
        if (stats.totalPowerConsumption > 0) {
            happiness += this.resources.power.shortage ? -25 : 10;
        }
        
        // Impact from water availability
        if (stats.totalWaterConsumption > 0) {
            happiness += this.resources.water.shortage ? -25 : 10;
        }
        
        // Impact from unemployment (workforce = share of population that wants work)
        const workforce = this.resources.population * WORKFORCE_RATIO;
        if (workforce >= 1) {
            const employmentRate = Math.min(1, stats.totalJobs / workforce);
            happiness -= (1 - employmentRate) * 30;
        }
        
        // Impact from buildings (parks positive, industrial negative)
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
                shortage: this.resources.power.shortage,
                ratio: this.resources.power.consumption > 0 ? 
                    this.resources.power.production / this.resources.power.consumption : 1
            },
            water: {
                available: this.resources.water.available,
                consumption: this.resources.water.consumption,
                production: this.resources.water.production,
                shortage: this.resources.water.shortage,
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
            power: { available: 0, consumption: 0, production: 0, shortage: false },
            water: { available: 0, consumption: 0, production: 0, shortage: false },
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
        this.historyTimer = 0;
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
        
        // Ensure fields added in later versions exist
        this.resources.power.shortage = !!this.resources.power.shortage;
        this.resources.water.shortage = !!this.resources.water.shortage;
        
        this.historyTimer = 0;
        this.lastUpdateTime = Date.now();
        
        this.notifyCallbacks('resourcesLoaded', null);
    }
}

// Share of population that wants a job
const WORKFORCE_RATIO = 0.6;

// Make globally available
window.WORKFORCE_RATIO = WORKFORCE_RATIO;
