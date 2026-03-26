// UI Manager Module - Simplified version that doesn't use React
// Note: UIManager class is expected to be used globally

class UIManager {
    constructor(game) {
        this.game = game;
        
        // Initialize UI
        this.init();
    }
    
    // Initialize UI
    init() {
        // Set up resource update callbacks
        this.game.resourceManager.addCallback('resourcesUpdated', this.handleResourcesUpdated.bind(this));
        this.game.resourceManager.addCallback('moneySpent', this.handleMoneySpent.bind(this));
        this.game.resourceManager.addCallback('moneyAdded', this.handleMoneyAdded.bind(this));
        
        // Set up building selection callbacks
        this.game.onBuildingSelected = this.handleBuildingSelected.bind(this);
        this.game.onBuildingDeselected = this.handleBuildingDeselected.bind(this);
        
        // Set up game state callbacks
        this.game.onGamePaused = this.handleGamePaused.bind(this);
        this.game.onGameResumed = this.handleGameResumed.bind(this);
        this.game.onGameSpeedChanged = this.handleGameSpeedChanged.bind(this);
        
        // Set up notification callbacks
        this.game.onNotification = this.handleNotification.bind(this);
        
        // Set up button event listeners
        this.setupButtonListeners();
    }
    
    // Setup button event listeners
    setupButtonListeners() {
        // Building selection buttons
        const buildingButtons = document.querySelectorAll('.building-btn');
        buildingButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const buildingType = e.target.dataset.building;
                this.handleBuildingSelect(buildingType);
            });
        });
        
        // Game control buttons
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => this.game.togglePause());
        }
        
        const speedBtn = document.getElementById('speed-btn');
        if (speedBtn) {
            speedBtn.addEventListener('click', () => this.game.changeGameSpeed());
        }
        
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.game.saveGame());
        }
        
        const loadBtn = document.getElementById('load-btn');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.game.loadGame());
        }
    }
    
    // Handle resources updated
    handleResourcesUpdated(data) {
        const resources = data.resources;
        
        // Update money display
        const moneyValue = document.getElementById('money-value');
        if (moneyValue) {
            moneyValue.textContent = `$${Math.floor(resources.money).toLocaleString()}`;
        }
        
        // Update population display
        const populationValue = document.getElementById('population-value');
        if (populationValue) {
            populationValue.textContent = Math.floor(resources.population);
        }
        
        // Update power display
        const powerValue = document.getElementById('power-value');
        if (powerValue) {
            powerValue.textContent = `${Math.floor(resources.power.available)} / ${Math.floor(resources.power.consumption)}`;
        }
        
        // Update water display
        const waterValue = document.getElementById('water-value');
        if (waterValue) {
            waterValue.textContent = `${Math.floor(resources.water.available)} / ${Math.floor(resources.water.consumption)}`;
        }
        
        // Update happiness display
        const happinessValue = document.getElementById('happiness-value');
        if (happinessValue) {
            happinessValue.textContent = `${Math.floor(resources.happiness)}%`;
        }
    }
    
    // Handle money spent
    handleMoneySpent(data) {
        // Update money display
        const moneyValue = document.getElementById('money-value');
        if (moneyValue) {
            moneyValue.textContent = `$${Math.floor(data.remaining).toLocaleString()}`;
        }
        
        // Show notification
        this.game.showNotification(`Spent $${Math.floor(data.amount).toLocaleString()}`, 'info');
    }
    
    // Handle money added
    handleMoneyAdded(data) {
        // Update money display
        const moneyValue = document.getElementById('money-value');
        if (moneyValue) {
            moneyValue.textContent = `$${Math.floor(data.total).toLocaleString()}`;
        }
        
        // Show notification
        this.game.showNotification(`Earned $${Math.floor(data.amount).toLocaleString()}`, 'info');
    }
    
    // Handle building selected
    handleBuildingSelected(building) {
        // Update selected building info
        const buildingDetails = document.getElementById('building-details');
        if (buildingDetails && building) {
            const type = building.type;
            buildingDetails.innerHTML = `
                <p><strong>Type:</strong> ${type.name}</p>
                <p><strong>Position:</strong> (${building.x}, ${building.y})</p>
                ${type.populationCapacity > 0 ? `<p><strong>Population:</strong> ${building.population} / ${type.populationCapacity}</p>` : ''}
                ${type.jobCapacity > 0 ? `<p><strong>Jobs:</strong> ${building.jobs} / ${type.jobCapacity}</p>` : ''}
                <p><strong>Cost:</strong> $${type.cost.toLocaleString()}</p>
            `;
        } else if (buildingDetails) {
            buildingDetails.innerHTML = '<p>No building selected</p>';
        }
    }
    
    // Handle building deselected
    handleBuildingDeselected() {
        // Clear selected building info
        const buildingDetails = document.getElementById('building-details');
        if (buildingDetails) {
            buildingDetails.innerHTML = '<p>No building selected</p>';
        }
    }
    
    // Handle game paused
    handleGamePaused() {
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.textContent = 'Resume';
        }
    }
    
    // Handle game resumed
    handleGameResumed() {
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.textContent = 'Pause';
        }
    }
    
    // Handle game speed changed
    handleGameSpeedChanged(speed) {
        const speedBtn = document.getElementById('speed-btn');
        if (speedBtn) {
            speedBtn.textContent = `Speed: ${speed}x`;
        }
    }
    
    // Handle notification
    handleNotification(notification) {
        // Add notification to UI
        const notificationList = document.getElementById('notification-list');
        if (notificationList) {
            const notificationEl = document.createElement('div');
            notificationEl.className = `notification ${notification.type}`;
            notificationEl.textContent = notification.message;
            notificationList.appendChild(notificationEl);
            
            // Auto-remove notification after 5 seconds
            setTimeout(() => {
                if (notificationEl.parentNode) {
                    notificationEl.parentNode.removeChild(notificationEl);
                }
            }, 5000);
            
            // Keep only last 10 notifications
            while (notificationList.children.length > 10) {
                notificationList.removeChild(notificationList.firstChild);
            }
        }
    }
    
    // Handle building selection
    handleBuildingSelect(typeId) {
        // Update button states
        const buttons = document.querySelectorAll('.building-btn');
        buttons.forEach(button => {
            if (button.dataset.building === typeId) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        
        // Notify game
        if (this.game.inputManager) {
            this.game.inputManager.selectBuildingType(typeId);
        }
    }
    
    // Update UI state
    setState(newState) {
        // This method is kept for compatibility but doesn't do anything in simplified version
    }
    
    // Get UI state
    getState() {
        return this.state || {};
    }
    
    // Show notification
    showNotification(message, type = 'info') {
        const notification = { message, type, timestamp: Date.now() };
        this.handleNotification(notification);
    }
    
    // Update selected building info
    updateSelectedBuildingInfo(building) {
        this.handleBuildingSelected(building);
    }
    
    // Clear notifications
    clearNotifications() {
        const notificationList = document.getElementById('notification-list');
        if (notificationList) {
            notificationList.innerHTML = '';
        }
    }
    
    // Destroy UI
    destroy() {
        // Remove event listeners
        const buildingButtons = document.querySelectorAll('.building-btn');
        buildingButtons.forEach(button => {
            button.removeEventListener('click', this.handleBuildingSelect);
        });
        
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.removeEventListener('click', this.game.togglePause);
        }
        
        const speedBtn = document.getElementById('speed-btn');
        if (speedBtn) {
            speedBtn.removeEventListener('click', this.game.changeGameSpeed);
        }
        
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            saveBtn.removeEventListener('click', this.game.saveGame);
        }
        
        const loadBtn = document.getElementById('load-btn');
        if (loadBtn) {
            loadBtn.removeEventListener('click', this.game.loadGame);
        }
    }
}
