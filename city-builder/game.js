// Main Game Module
// Note: All dependencies are expected to be loaded globally

class Game {
    constructor() {
        // Game state
        this.state = {
            isRunning: false,
            isPaused: false,
            gameSpeed: 1,
            lastUpdateTime: 0,
            selectedBuilding: null,
            notifications: []
        };
        
        // Game components
        this.grid = null;
        this.resourceManager = null;
        this.inputManager = null;
        this.uiManager = null;
        this.trafficManager = null;
        this.renderer = null;
        
        // Game configuration
        this.config = {
            gridWidth: 50,
            gridHeight: 50,
            cellSize: 32,
            initialMoney: 50000,
            updateInterval: 1000 // Update resources every second
        };

        // Assign global building types to instance
        this.buildingTypes = window.BUILDING_TYPES;
        
        // Initialize game
        this.init();
    }
    
    // Initialize game
    init() {
        // Create grid
        this.grid = new CityGrid(this.config.gridWidth, this.config.gridHeight, this.config.cellSize);

        // Create resource manager
        this.resourceManager = new ResourceManager();

        // Create input manager
        this.inputManager = new InputManager(this);

        // Create UI manager
        this.uiManager = new UIManager(this);

        // Create traffic manager
        this.trafficManager = new TrafficManager(this);

        // Create renderer
        this.renderer = new Renderer(this);

        // Show welcome message
        this.showNotification('Welcome! Select a building to start. Right-click to pan.', 'info');

        // Set up game loop
        this.lastUpdateTime = Date.now();

        // Start game
        this.start();
    }
    
    // Start game
    start() {
        this.state.isRunning = true;
        this.state.isPaused = false;
        this.gameLoop();
    }
    
    // Stop game
    stop() {
        this.state.isRunning = false;
    }
    
    // Game loop
    gameLoop() {
        if (!this.state.isRunning) return;
        
        const currentTime = Date.now();
        const deltaTime = (currentTime - this.lastUpdateTime) * this.state.gameSpeed;
        
        // Update game state
        if (!this.state.isPaused) {
            this.update(deltaTime);
        }
        
        // Render
        this.render();
        
        // Schedule next frame
        requestAnimationFrame(() => this.gameLoop());
        
        this.lastUpdateTime = currentTime;
    }
    
    // Update game state
    update(deltaTime) {
        // Update resources
        this.resourceManager.updateResources(this.grid.getAllBuildings(), deltaTime);
        
        // Update population and jobs
        this.updatePopulation();
        
        // Check for resource shortages
        this.checkResourceShortages();

        // Update traffic
        if (this.trafficManager) {
            this.trafficManager.update(deltaTime);
        }
    }
    
    // Update population
    updatePopulation() {
        const buildings = this.grid.getAllBuildings();
        const totalPopulation = this.resourceManager.resources.population;
        const totalJobs = this.resourceManager.resources.jobs;
        
        // Reset all building populations and jobs
        buildings.forEach(building => {
            building.population = 0;
            building.jobs = 0;
        });
        
        // Assign population to residential buildings
        let remainingPopulation = totalPopulation;
        const residentialBuildings = buildings.filter(b => b.type.id === 'residential');
        
        for (const building of residentialBuildings) {
            if (remainingPopulation <= 0) break;
            
            const availableSpace = building.type.populationCapacity - building.population;
            const populationToAdd = Math.min(remainingPopulation, availableSpace);
            
            building.populate(populationToAdd);
            remainingPopulation -= populationToAdd;
        }
        
        // Assign jobs to commercial and industrial buildings
        let remainingJobs = totalJobs;
        const jobBuildings = buildings.filter(b => b.type.id === 'commercial' || b.type.id === 'industrial');
        
        for (const building of jobBuildings) {
            if (remainingJobs <= 0) break;
            
            const availableJobs = building.type.jobCapacity - building.jobs;
            const jobsToAdd = Math.min(remainingJobs, availableJobs);
            
            building.assignJobs(jobsToAdd);
            remainingJobs -= jobsToAdd;
        }
    }
    
    // Check for resource shortages
    checkResourceShortages() {
        const resources = this.resourceManager.resources;
        
        // Check power shortage
        if (resources.power.available < 0) {
            this.showNotification('Power shortage! Build more power plants.', 'warning');
        }
        
        // Check water shortage
        if (resources.water.available < 0) {
            this.showNotification('Water shortage! Build more water plants.', 'warning');
        }
        
        // Check happiness
        if (resources.happiness < 30) {
            this.showNotification('Citizens are unhappy! Improve services.', 'warning');
        }
    }
    
    // Render game
    render() {
        // Update renderer
        if (this.renderer) {
            this.renderer.render();
        }
    }
    
    // Place building
    placeBuilding(type, gridX, gridY) {
        // Check if building can be placed
        if (!canPlaceBuilding(type, this.grid, gridX, gridY)) {
            this.showNotification('Cannot place building here.', 'error');
            return false;
        }
        
        // Check if player can afford the building
        if (!this.resourceManager.canAfford(type.cost)) {
            this.showNotification('Not enough money to build.', 'error');
            return false;
        }
        
        // Spend money
        this.resourceManager.spendMoney(type.cost);
        
        // Create building
        const building = createBuilding(type.id, gridX, gridY);
        
        // Place building on grid
        placeBuilding(building, this.grid);
        
        // Show notification
        this.showNotification(`Built ${type.name} for $${type.cost.toLocaleString()}`, 'info');
        
        return true;
    }
    
    // Remove building
    removeBuilding(building) {
        // Calculate refund (50% of cost)
        const refund = Math.floor(building.type.cost * 0.5);
        if (refund > 0) {
            this.resourceManager.addMoney(refund);
        }

        // Remove from grid
        removeBuilding(building, this.grid);
        
        // Show notification
        const refundMsg = refund > 0 ? ` (Refunded $${refund.toLocaleString()})` : '';
        this.showNotification(`Removed ${building.type.name}${refundMsg}`, 'info');
        
        // Deselect building if it was selected
        if (this.state.selectedBuilding === building) {
            this.deselectBuilding();
        }
    }
    
    // Select building
    selectBuilding(building) {
        // Deselect previous building
        this.deselectBuilding();
        
        // Select new building
        this.state.selectedBuilding = building;
        
        // Update UI
        if (this.uiManager) {
            this.uiManager.updateSelectedBuildingInfo(building);
        }
        
        // Highlight building in renderer
        if (this.renderer) {
            this.renderer.highlightBuilding(building, true);
        }
        
        // Notify callbacks
        if (this.onBuildingSelected) {
            this.onBuildingSelected(building);
        }
    }
    
    // Deselect building
    deselectBuilding() {
        if (this.state.selectedBuilding) {
            // Remove highlight from renderer
            if (this.renderer) {
                this.renderer.highlightBuilding(this.state.selectedBuilding, false);
            }
            
            // Clear selection
            const previousBuilding = this.state.selectedBuilding;
            this.state.selectedBuilding = null;
            
            // Update UI
            if (this.uiManager) {
                this.uiManager.updateSelectedBuildingInfo(null);
            }
            
            // Notify callbacks
            if (this.onBuildingDeselected) {
                this.onBuildingDeselected();
            }
        }
    }
    
    // Can place building
    canPlaceBuilding(type, gridX, gridY) {
        return canPlaceBuilding(type, this.grid, gridX, gridY);
    }
    
    // Toggle pause
    togglePause() {
        this.state.isPaused = !this.state.isPaused;
        
        // Update UI
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.textContent = this.state.isPaused ? 'Resume' : 'Pause';
        }
        
        // Notify callbacks
        if (this.state.isPaused && this.onGamePaused) {
            this.onGamePaused();
        } else if (!this.state.isPaused && this.onGameResumed) {
            this.onGameResumed();
        }
    }
    
    // Change game speed
    changeGameSpeed(direction = 1) {
        const speeds = [0.5, 1, 2, 4, 8];
        const currentIndex = speeds.indexOf(this.state.gameSpeed);
        
        if (direction > 0) {
            // Increase speed
            if (currentIndex < speeds.length - 1) {
                this.state.gameSpeed = speeds[currentIndex + 1];
            }
        } else {
            // Decrease speed
            if (currentIndex > 0) {
                this.state.gameSpeed = speeds[currentIndex - 1];
            }
        }
        
        // Update UI
        const speedBtn = document.getElementById('speed-btn');
        if (speedBtn) {
            speedBtn.textContent = `Speed: ${this.state.gameSpeed}x`;
        }
        
        // Notify callbacks
        if (this.onGameSpeedChanged) {
            this.onGameSpeedChanged(this.state.gameSpeed);
        }
    }
    
    // Save game
    saveGame() {
        const saveData = {
            grid: this.grid.serialize ? this.grid.serialize() : null,
            resources: this.resourceManager.serialize(),
            gameState: {
                isPaused: this.state.isPaused,
                gameSpeed: this.state.gameSpeed,
                gameTime: this.resourceManager.gameTime
            },
            timestamp: Date.now()
        };
        
        // Save to localStorage
        localStorage.setItem('cityBuilderSave', JSON.stringify(saveData));
        
        // Show notification
        this.showNotification('Game saved successfully.', 'info');
    }
    
    // Load game
    loadGame() {
        // Load from localStorage
        const saveData = localStorage.getItem('cityBuilderSave');
        if (!saveData) {
            this.showNotification('No saved game found.', 'error');
            return;
        }
        
        try {
            const data = JSON.parse(saveData);
            
            // Load resources
            this.resourceManager.deserialize(data.resources);
            
            // Load game state
            this.state.isPaused = data.gameState.isPaused;
            this.state.gameSpeed = data.gameState.gameSpeed;
            
            // Update UI
            const pauseBtn = document.getElementById('pause-btn');
            if (pauseBtn) {
                pauseBtn.textContent = this.state.isPaused ? 'Resume' : 'Pause';
            }
            
            const speedBtn = document.getElementById('speed-btn');
            if (speedBtn) {
                speedBtn.textContent = `Speed: ${this.state.gameSpeed}x`;
            }
            
            // Show notification
            this.showNotification('Game loaded successfully.', 'info');
            
            // Notify callbacks
            if (this.onGameLoaded) {
                this.onGameLoaded();
            }
        } catch (error) {
            this.showNotification('Failed to load saved game.', 'error');
            console.error('Load game error:', error);
        }
    }
    
    // Show notification
    showNotification(message, type = 'info') {
        const notification = { message, type, timestamp: Date.now() };
        this.state.notifications.push(notification);
        
        // Keep only last 10 notifications
        if (this.state.notifications.length > 10) {
            this.state.notifications.shift();
        }
        
        // Notify UI manager
        if (this.uiManager) {
            this.uiManager.showNotification(message, type);
        }
        
        // Notify callbacks
        if (this.onNotification) {
            this.onNotification(notification);
        }
        
        // Auto-remove notification after 5 seconds
        setTimeout(() => {
            this.state.notifications = this.state.notifications.filter(n => n !== notification);
        }, 5000);
    }
    
    // Move camera
    moveCamera(dx, dy) {
        if (this.renderer) {
            this.renderer.moveCamera(dx, dy);
        }
    }
    
    // Set camera position
    setCameraPosition(x, y) {
        if (this.renderer) {
            this.renderer.setCameraPosition(x, y);
        }
    }
    
    // Set camera zoom
    setCameraZoom(zoom) {
        if (this.renderer) {
            this.renderer.setCameraZoom(zoom);
        }
    }
    
    // Get screen to world coordinates
    screenToWorldX(screenX) {
        if (this.renderer) {
            return this.renderer.screenToWorld(screenX, 0).x;
        }
        return 0;
    }
    
    // Get screen to world coordinates
    screenToWorldY(screenY) {
        if (this.renderer) {
            return this.renderer.screenToWorld(0, screenY).y;
        }
        return 0;
    }
    
    // Get building at screen position
    getBuildingAtScreenPosition(screenX, screenY) {
        if (this.renderer) {
            return this.renderer.getBuildingAtScreenPosition(screenX, screenY);
        }
        return null;
    }
    
    // Get game statistics
    getStatistics() {
        return {
            grid: this.grid.getStatistics(),
            resources: this.resourceManager.getSummary(),
            gameState: {
                isPaused: this.state.isPaused,
                gameSpeed: this.state.gameSpeed,
                gameTime: this.resourceManager.gameTime
            }
        };
    }
    
    // Reset game
    reset() {
        // Clear grid
        this.grid.clear();
        
        // Reset resources
        this.resourceManager.reset();
        
        // Reset game state
        this.state.isPaused = false;
        this.state.gameSpeed = 1;
        this.state.selectedBuilding = null;
        this.state.notifications = [];
        
        // Update UI
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.textContent = 'Pause';
        }
        
        const speedBtn = document.getElementById('speed-btn');
        if (speedBtn) {
            speedBtn.textContent = 'Speed: 1x';
        }
        
        // Show notification
        this.showNotification('Game reset.', 'info');
    }
    
    // Destroy game
    destroy() {
        // Stop game loop
        this.state.isRunning = false;
        
        // Destroy components
        if (this.inputManager) {
            this.inputManager.destroy();
        }
        
        if (this.renderer) {
            this.renderer.destroy();
        }
        
        if (this.uiManager) {
            this.uiManager.destroy();
        }
        
        // Clear references
        this.grid = null;
        this.resourceManager = null;
        this.inputManager = null;
        this.uiManager = null;
        this.renderer = null;
    }
}
