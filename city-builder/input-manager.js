// Input Manager Module
// Note: InputManager class is expected to be used globally

class InputManager {
    constructor(game) {
        this.game = game;
        this.canvas = null;
        this.grid = null;
        
        // Input state
        this.mouse = {
            x: 0,
            y: 0,
            worldX: 0,
            worldY: 0,
            gridX: 0,
            gridY: 0,
            isDown: false,
            button: 0,
            lastClickX: 0,
            lastClickY: 0
        };
        
        // Selected building type
        this.selectedBuildingType = null;
        
        // UI state
        this.uiState = {
            isDragging: false,
            dragStartX: 0,
            dragStartY: 0,
            dragStartScreenX: 0, // Add explicit initialization
            dragStartScreenY: 0,
            initialCameraX: 0,
            initialCameraY: 0,
            initialZoom: 1,
            isPlacingBuilding: false,
            isDeleting: false,
            placementValid: false,
            hoveredBuilding: null,
            lastPlacedX: -1,
            lastPlacedY: -1,
            lastDeletedX: -1,
            lastDeletedY: -1
        };
        
        // Event listeners
        this.listeners = new Map();
        
        // Initialize
        this.init();
    }
    
    // Initialize input manager
    init() {
        // Get canvas element
        this.canvas = document.getElementById('pixi-canvas');
        if (!this.canvas) {
            console.error('Canvas element not found');
            return;
        }
        
        // Get grid from game
        this.grid = this.game.grid;
        
        // Add event listeners
        this.addEventListeners();
    }
    
    // Add event listeners
    addEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        this.canvas.addEventListener('click', this.handleClick.bind(this));
        this.canvas.addEventListener('contextmenu', this.handleRightClick.bind(this));
        
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
        
        // Keyboard events
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }
    
    // Handle mouse wheel
    handleWheel(event) {
        event.preventDefault();
        if (!this.game.renderer || !this.game.renderer.state) return;

        const zoomSpeed = 0.1;
        const delta = event.deltaY > 0 ? -zoomSpeed : zoomSpeed;
        const newZoom = (this.game.renderer.state.camera.zoom || 1) + delta;
        this.game.setCameraZoom(newZoom);
    }

    // Handle mouse down
    handleMouseDown(event) {
        this.updateMousePosition(event);
        this.mouse.isDown = true;
        this.mouse.button = event.button;
        
        // Right click (button 2) always pans
        if (event.button === 2) {
            this.startDragging();
            return;
        }

        // Left click
        // If we are in "Delete Mode"
        if (this.selectedBuildingType === 'delete') {
            this.uiState.isDeleting = true;
            this.deleteBuildingAt(this.mouse.worldX, this.mouse.worldY);
            this.uiState.lastDeletedX = this.mouse.gridX;
            this.uiState.lastDeletedY = this.mouse.gridY;
        }
        // If we are in "Placement Mode" (a building type is selected)
        else if (this.selectedBuildingType) {
            this.uiState.isPlacingBuilding = true;
            this.updatePlacementValidity();

            // Place immediately on mouse down for responsiveness
            if (this.uiState.placementValid) {
                this.placeBuilding();
                this.uiState.lastPlacedX = this.mouse.gridX;
                this.uiState.lastPlacedY = this.mouse.gridY;
            }
        } else {
            // Default Mode: Select or Pan
            const building = this.getBuildingAtPosition(this.mouse.worldX, this.mouse.worldY);
            if (building) {
                this.game.selectBuilding(building);
            }
            else {
                // If clicked on empty space, deselect and start panning
                this.game.deselectBuilding();
                this.startDragging();
            }
        }
    }

    // Start dragging operation
    startDragging() {
        this.uiState.isDragging = true;
        this.uiState.dragStartScreenX = this.mouse.x;
        this.uiState.dragStartScreenY = this.mouse.y;

        // Store initial camera position to calculate relative movement
        // We need to access the renderer's camera state
        if (this.game.renderer) {
            this.uiState.initialCameraX = this.game.renderer.state.camera.x;
            this.uiState.initialCameraY = this.game.renderer.state.camera.y;
            this.uiState.initialZoom = this.game.renderer.state.camera.zoom;
        }
    }
    
    // Handle mouse move
    handleMouseMove(event) {
        this.updateMousePosition(event);
        
        // Update hovered building
        this.uiState.hoveredBuilding = this.getBuildingAtPosition(this.mouse.worldX, this.mouse.worldY);
        
        // Handle deletion mode
        if (this.uiState.isDeleting && this.mouse.isDown) {
            if (this.uiState.lastDeletedX !== this.mouse.gridX ||
                this.uiState.lastDeletedY !== this.mouse.gridY) {
                this.deleteBuildingAt(this.mouse.worldX, this.mouse.worldY);
                this.uiState.lastDeletedX = this.mouse.gridX;
                this.uiState.lastDeletedY = this.mouse.gridY;
            }
        }

        // Update placement validity if placing a building
        if (this.uiState.isPlacingBuilding) {
            this.updatePlacementValidity();

            // Handle Drag-to-Place
            if (this.mouse.isDown) {
                // Only place if we are on a new tile to avoid spamming
                if (this.uiState.lastPlacedX !== this.mouse.gridX ||
                    this.uiState.lastPlacedY !== this.mouse.gridY) {

                    if (this.uiState.placementValid) {
                        this.placeBuilding();
                        this.uiState.lastPlacedX = this.mouse.gridX;
                        this.uiState.lastPlacedY = this.mouse.gridY;
                    }
                }
            }
        }
        
        // Handle dragging (Camera Panning)
        if (this.uiState.isDragging && this.game.renderer) {
            // Calculate screen delta
            const screenDx = this.mouse.x - this.uiState.dragStartScreenX;
            const screenDy = this.mouse.y - this.uiState.dragStartScreenY;

            // Convert to world delta (divide by zoom)
            // We subtract from initial position because dragging mouse RIGHT should move camera LEFT (to pull world RIGHT)
            const zoom = this.uiState.initialZoom || 1;
            const newCamX = this.uiState.initialCameraX - (screenDx / zoom);
            const newCamY = this.uiState.initialCameraY - (screenDy / zoom);
            
            this.game.setCameraPosition(newCamX, newCamY);
        }
    }
    
    // Handle mouse up
    handleMouseUp(event) {
        this.mouse.isDown = false;
        this.uiState.isDragging = false;
        this.uiState.isDeleting = false;
        
        // Reset last placed/deleted positions so next click always works
        this.uiState.lastPlacedX = -1;
        this.uiState.lastPlacedY = -1;
        this.uiState.lastDeletedX = -1;
        this.uiState.lastDeletedY = -1;
        
        this.uiState.isPlacingBuilding = false;
    }
    
    // Handle mouse leave
    handleMouseLeave(event) {
        this.mouse.isDown = false;
        this.uiState.isDragging = false;
        this.uiState.isPlacingBuilding = false;
        this.uiState.isDeleting = false;
        this.uiState.hoveredBuilding = null;
    }

    // Delete building at world position
    deleteBuildingAt(worldX, worldY) {
        const building = this.getBuildingAtPosition(worldX, worldY);
        if (building) {
            this.game.removeBuilding(building);
        }
    }
    
    // Handle mouse click
    handleClick(event) {
        this.updateMousePosition(event);
        this.mouse.lastClickX = this.mouse.x;
        this.mouse.lastClickY = this.mouse.y;
        
        // Check if clicking on a building
        const building = this.getBuildingAtPosition(this.mouse.worldX, this.mouse.worldY);
        if (building) {
            this.game.selectBuilding(building);
        }
    }
    
    // Handle right click
    handleRightClick(event) {
        event.preventDefault();
        
        // Deselect building if right-clicking
        this.game.deselectBuilding();
    }
    
    // Handle touch start
    handleTouchStart(event) {
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            this.updateMousePosition(touch);
            this.handleMouseDown({ ...event, button: 0 });
        }
    }
    
    // Handle touch move
    handleTouchMove(event) {
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            this.updateMousePosition(touch);
            this.handleMouseMove({ ...event, button: 0 });
        }
    }
    
    // Handle touch end
    handleTouchEnd(event) {
        this.handleMouseUp({ ...event, button: 0 });
    }
    
    // Handle key down
    handleKeyDown(event) {
        // Handle keyboard shortcuts
        switch (event.key) {
            case 'Escape':
                this.game.deselectBuilding();
                this.selectedBuildingType = null;
                this.updateBuildingButtons();
                break;
            case '1':
                this.selectBuildingType('residential');
                break;
            case '2':
                this.selectBuildingType('commercial');
                break;
            case '3':
                this.selectBuildingType('industrial');
                break;
            case '4':
                this.selectBuildingType('power');
                break;
            case '5':
                this.selectBuildingType('water');
                break;
            case ' ':
                event.preventDefault();
                this.handlePause();
                break;
            case '+':
            case '=':
                this.handleSpeedChange();
                break;
            case '-':
                this.handleSpeedChange(-1);
                break;
        }
    }
    
    // Handle key up
    handleKeyUp(event) {
        // Handle key release events if needed
    }
    
    // Handle building selection
    handleBuildingSelect(event) {
        const buildingType = event.target.dataset.building;
        this.selectBuildingType(buildingType);
    }
    
    // Select building type
    selectBuildingType(typeId) {
        this.selectedBuildingType = typeId;
        this.updateBuildingButtons();
        
        // If we were placing a building, update validity
        if (this.uiState.isPlacingBuilding) {
            this.updatePlacementValidity();
        }
    }
    
    // Update building button states
    updateBuildingButtons() {
        const buildingButtons = document.querySelectorAll('.building-btn');
        buildingButtons.forEach(button => {
            if (button.dataset.building === this.selectedBuildingType) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }
    
    // Handle pause button
    handlePause() {
        this.game.togglePause();
    }
    
    // Handle speed change
    handleSpeedChange(direction = 1) {
        this.game.changeGameSpeed(direction);
    }
    
    // Handle save button
    handleSave() {
        this.game.saveGame();
    }
    
    // Handle load button
    handleLoad() {
        this.game.loadGame();
    }
    
    // Update mouse position
    updateMousePosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = event.clientX - rect.left;
        this.mouse.y = event.clientY - rect.top;
        
        // Convert to world coordinates
        this.mouse.worldX = this.game.screenToWorldX(this.mouse.x);
        this.mouse.worldY = this.game.screenToWorldY(this.mouse.y);
        
        // Convert to grid coordinates
        const gridPos = this.grid.worldToGrid(this.mouse.worldX, this.mouse.worldY);
        this.mouse.gridX = gridPos.x;
        this.mouse.gridY = gridPos.y;
    }
    
    // Get building at position
    getBuildingAtPosition(worldX, worldY) {
        const gridPos = this.grid.worldToGrid(worldX, worldY);
        return this.grid.getBuildingAt(gridPos.x, gridPos.y);
    }
    
    // Update placement validity
    updatePlacementValidity() {
        if (!this.selectedBuildingType) {
            this.uiState.placementValid = false;
            return;
        }
        
        if (this.selectedBuildingType === 'delete') {
            this.uiState.placementValid = true;
            return;
        }

        const buildingType = this.game.buildingTypes[this.selectedBuildingType];
        if (!buildingType) {
            this.uiState.placementValid = false;
            return;
        }
        
        // Check if building can be placed at current position
        this.uiState.placementValid = this.game.canPlaceBuilding(
            buildingType, 
            this.mouse.gridX, 
            this.mouse.gridY
        );
    }
    
    // Place building
    placeBuilding() {
        if (!this.selectedBuildingType || !this.uiState.placementValid) {
            return;
        }
        
        const buildingType = this.game.buildingTypes[this.selectedBuildingType];
        if (!buildingType) {
            return;
        }
        
        // Try to place the building
        this.game.placeBuilding(buildingType, this.mouse.gridX, this.mouse.gridY);
    }
    
    // Get current mouse position
    getMousePosition() {
        return {
            screen: { x: this.mouse.x, y: this.mouse.y },
            world: { x: this.mouse.worldX, y: this.mouse.worldY },
            grid: { x: this.mouse.gridX, y: this.mouse.gridY }
        };
    }
    
    // Get selected building type
    getSelectedBuildingType() {
        return this.selectedBuildingType;
    }
    
    // Get placement validity
    isPlacementValid() {
        return this.uiState.placementValid;
    }
    
    // Get hovered building
    getHoveredBuilding() {
        return this.uiState.hoveredBuilding;
    }
    
    // Check if mouse is down
    isMouseDown() {
        return this.mouse.isDown;
    }
    
    // Check if dragging
    isDragging() {
        return this.uiState.isDragging;
    }
    
    // Check if placing building
    isPlacingBuilding() {
        return this.uiState.isPlacingBuilding;
    }
    
    // Remove all event listeners
    destroy() {
        // Remove event listeners
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
        this.canvas.removeEventListener('click', this.handleClick);
        this.canvas.removeEventListener('contextmenu', this.handleRightClick);
        
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        
        // Clear listeners
        this.listeners.clear();
    }
}
