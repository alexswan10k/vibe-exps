// Renderer Module using Pixi.js
// Note: PIXI is expected to be loaded globally from the HTML

class Renderer {
    constructor(game) {
        this.game = game;
        this.app = null;
        this.container = document.getElementById('pixi-canvas');
        
        // Rendering state
        this.state = {
            camera: {
                x: 0,
                y: 0,
                zoom: 1
            },
            gridSize: 32,
            showGrid: true,
            showBuildingOutlines: true
        };
        
        // Pixi.js containers
        this.stage = null;
        this.gridContainer = null;
        this.buildingContainer = null;
        this.uiContainer = null;
        
        // Graphics objects
        this.gridGraphics = null;
        this.buildingGraphics = new Map();
        this.previewGraphics = null;
        
        // Initialize renderer
        this.init();
    }
    
    // Initialize renderer
    init() {
        console.log('=== PIXI RENDERER INIT START ===');
        console.log('Initializing Pixi.js renderer...');
        console.log('Container:', this.container);
        console.log('Container exists:', !!this.container);

        // Wait for container to be properly sized
        const initRenderer = () => {
            console.log('=== INIT RENDERER FUNCTION CALLED ===');
            const width = this.container.clientWidth || 800;
            const height = this.container.clientHeight || 600;
            console.log('Container dimensions:', width, 'x', height);
            console.log('Creating Pixi Application...');

            // Create Pixi.js application
            this.app = new PIXI.Application({
                width: width,
                height: height,
                backgroundColor: 0x87CEEB, // Sky blue
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true
            });

            console.log('Pixi.js app created:', this.app);
            console.log('Canvas view:', this.app.view);

            // Add to container
            this.container.appendChild(this.app.view);

            // Create stage
            this.stage = this.app.stage;
            console.log('Stage created:', this.stage);

            // Create containers
            this.gridContainer = new PIXI.Container();
            this.buildingContainer = new PIXI.Container();
            this.uiContainer = new PIXI.Container();

            // Add containers to stage
            this.stage.addChild(this.gridContainer);
            this.stage.addChild(this.buildingContainer);
            this.stage.addChild(this.uiContainer);

            // Create a simple test rectangle to verify rendering
            const testGraphics = new PIXI.Graphics();
            testGraphics.beginFill(0xff0000);
            testGraphics.drawRect(100, 100, 100, 100);
            testGraphics.endFill();
            this.stage.addChild(testGraphics);
            console.log('Added test rectangle to stage');

            // Create grid graphics
            this.createGrid();

            // Create preview graphics
            this.previewGraphics = new PIXI.Graphics();
            this.buildingContainer.addChild(this.previewGraphics);

            // Set up camera
            this.updateCamera();

            // Set up resize handler
            window.addEventListener('resize', this.handleResize.bind(this));

            // Start render loop
            this.app.ticker.add(this.render.bind(this));
            console.log('Renderer initialization complete');
        };

        // Check if container is ready, otherwise wait
        if (this.container.clientWidth > 0 && this.container.clientHeight > 0) {
            initRenderer();
        } else {
            // Wait for next frame when container should be sized
            requestAnimationFrame(initRenderer);
        }
    }
    
    // Create grid
    createGrid() {
        this.gridGraphics = new PIXI.Graphics();
        this.gridContainer.addChild(this.gridGraphics);
        this.drawGrid();
    }
    
    // Draw grid
    drawGrid() {
        const { width, height } = this.game.grid;
        const cellSize = this.state.gridSize;
        
        // Clear graphics
        this.gridGraphics.clear();
        
        // Set grid style
        this.gridGraphics.lineStyle(1, 0xCCCCCC, 0.5);
        
        // Draw vertical lines
        for (let x = 0; x <= width; x++) {
            const worldX = x * cellSize;
            this.gridGraphics.moveTo(worldX, 0);
            this.gridGraphics.lineTo(worldX, height * cellSize);
        }
        
        // Draw horizontal lines
        for (let y = 0; y <= height; y++) {
            const worldY = y * cellSize;
            this.gridGraphics.moveTo(0, worldY);
            this.gridGraphics.lineTo(width * cellSize, worldY);
        }
    }
    
    // Render buildings
    renderBuildings() {
        const buildings = this.game.grid.getAllBuildings();
        
        // Remove graphics for buildings that no longer exist
        for (const [buildingId, graphics] of this.buildingGraphics) {
            if (!buildings.find(b => b.id === buildingId)) {
                this.buildingContainer.removeChild(graphics);
                this.buildingGraphics.delete(buildingId);
            }
        }
        
        // Add/update graphics for existing buildings
        for (const building of buildings) {
            if (!this.buildingGraphics.has(building.id)) {
                // Create new graphics
                const graphics = new PIXI.Graphics();
                this.buildingContainer.addChild(graphics);
                this.buildingGraphics.set(building.id, graphics);
            }
            
            // Update graphics
            this.updateBuildingGraphics(building);
        }
    }
    
    // Update building graphics
    updateBuildingGraphics(building) {
        const graphics = this.buildingGraphics.get(building.id);
        if (!graphics) return;
        
        // Clear graphics
        graphics.clear();
        
        // Get building properties
        const { type, x, y } = building;
        const cellSize = this.state.gridSize;
        const width = type.size.width * cellSize;
        const height = type.size.height * cellSize;
        const worldX = x * cellSize;
        const worldY = y * cellSize;
        
        // Draw building base
        graphics.beginFill(type.color);
        graphics.drawRect(worldX, worldY, width, height);
        graphics.endFill();
        
        // Draw building outline
        graphics.lineStyle(2, 0x000000, 0.8);
        graphics.drawRect(worldX, worldY, width, height);
        
        // Draw population/job indicators for residential/commercial/industrial
        if (type.populationCapacity > 0 || type.jobCapacity > 0) {
            const barWidth = width - 4;
            const barHeight = 4;
            const barY = worldY + height - 8;
            
            // Background
            graphics.beginFill(0x333333);
            graphics.drawRect(worldX + 2, barY, barWidth, barHeight);
            graphics.endFill();
            
            // Population fill
            if (type.populationCapacity > 0) {
                const populationWidth = (building.population / type.populationCapacity) * barWidth;
                graphics.beginFill(0x3498db);
                graphics.drawRect(worldX + 2, barY, populationWidth, barHeight);
                graphics.endFill();
            }
            
            // Jobs fill
            if (type.jobCapacity > 0) {
                const jobWidth = (building.jobs / type.jobCapacity) * barWidth;
                graphics.beginFill(0x2ecc71);
                graphics.drawRect(worldX + 2, barY + barHeight + 1, jobWidth, barHeight);
                graphics.endFill();
            }
        }
        
        // Draw building icon/label
        const style = new PIXI.TextStyle({
            fontFamily: 'Arial',
            fontSize: 12,
            fill: 0xFFFFFF,
            align: 'center'
        });
        
        const text = new PIXI.Text(type.name.substring(0, 3), style);
        text.anchor.set(0.5);
        text.position.set(worldX + width / 2, worldY + height / 2);
        graphics.addChild(text);
    }
    
    // Render building preview
    renderPreview() {
        const inputManager = this.game.inputManager;
        const selectedType = inputManager.getSelectedBuildingType();
        
        if (!selectedType || !inputManager.isPlacingBuilding()) {
            this.previewGraphics.clear();
            return;
        }
        
        const buildingType = this.game.buildingTypes[selectedType];
        const mousePos = inputManager.getMousePosition();
        const gridPos = this.game.grid.worldToGrid(mousePos.world.x, mousePos.world.y);
        
        // Clear preview
        this.previewGraphics.clear();
        
        // Calculate preview position
        const cellSize = this.state.gridSize;
        const previewX = gridPos.x * cellSize;
        const previewY = gridPos.y * cellSize;
        const previewWidth = buildingType.size.width * cellSize;
        const previewHeight = buildingType.size.height * cellSize;
        
        // Set preview style based on validity
        if (inputManager.isPlacementValid()) {
            this.previewGraphics.lineStyle(2, 0x2ecc71, 0.8);
            this.previewGraphics.beginFill(buildingType.color, 0.3);
        } else {
            this.previewGraphics.lineStyle(2, 0xe74c3c, 0.8);
            this.previewGraphics.beginFill(0xe74c3c, 0.1);
        }
        
        // Draw preview
        this.previewGraphics.drawRect(previewX, previewY, previewWidth, previewHeight);
        this.previewGraphics.endFill();
    }
    
    // Update camera
    updateCamera() {
        if (!this.stage) return;

        // Set camera position
        this.stage.position.set(
            -this.state.camera.x + this.app.renderer.width / 2,
            -this.state.camera.y + this.app.renderer.height / 2
        );

        // Set camera zoom
        this.stage.scale.set(this.state.camera.zoom);
    }
    
    // Move camera
    moveCamera(dx, dy) {
        this.state.camera.x += dx;
        this.state.camera.y += dy;
        this.updateCamera();
    }
    
    // Set camera position
    setCameraPosition(x, y) {
        this.state.camera.x = x;
        this.state.camera.y = y;
        this.updateCamera();
    }
    
    // Set camera zoom
    setCameraZoom(zoom) {
        this.state.camera.zoom = Math.max(0.1, Math.min(3, zoom));
        this.updateCamera();
    }
    
    // Convert screen coordinates to world coordinates
    screenToWorld(screenX, screenY) {
        const worldX = (screenX - this.app.renderer.width / 2) / this.state.camera.zoom + this.state.camera.x;
        const worldY = (screenY - this.app.renderer.height / 2) / this.state.camera.zoom + this.state.camera.y;
        return { x: worldX, y: worldY };
    }

    // Convert world coordinates to screen coordinates
    worldToScreen(worldX, worldY) {
        const screenX = (worldX - this.state.camera.x) * this.state.camera.zoom + this.app.renderer.width / 2;
        const screenY = (worldY - this.state.camera.y) * this.state.camera.zoom + this.app.renderer.height / 2;
        return { x: screenX, y: screenY };
    }
    
    // Handle resize
    handleResize() {
        // Update app size
        this.app.renderer.resize(
            this.container.clientWidth,
            this.container.clientHeight
        );
        
        // Update camera
        this.updateCamera();
    }
    
    // Render loop
    render() {
        // Render buildings
        this.renderBuildings();
        
        // Render preview
        this.renderPreview();
        
        // Update camera if needed
        if (this.state.camera.dirty) {
            this.updateCamera();
            this.state.camera.dirty = false;
        }
    }
    
    // Highlight building
    highlightBuilding(building, highlight = true) {
        const graphics = this.buildingGraphics.get(building.id);
        if (!graphics) return;
        
        if (highlight) {
            graphics.lineStyle(3, 0xFFFF00, 1);
            graphics.drawRect(
                graphics.x - 1.5,
                graphics.y - 1.5,
                graphics.width + 3,
                graphics.height + 3
            );
        } else {
            // Redraw building to remove highlight
            this.updateBuildingGraphics(building);
        }
    }
    
    // Get building at screen position
    getBuildingAtScreenPosition(screenX, screenY) {
        const worldPos = this.screenToWorld(screenX, screenY);
        const gridPos = this.game.grid.worldToGrid(worldPos.x, worldPos.y);
        return this.game.grid.getBuildingAt(gridPos.x, gridPos.y);
    }
    
    // Get screen bounds
    getScreenBounds() {
        return {
            left: this.screenToWorld(0, 0).x,
            right: this.screenToWorld(this.app.renderer.width, 0).x,
            top: this.screenToWorld(0, 0).y,
            bottom: this.screenToWorld(0, this.app.renderer.height).y
        };
    }
    
    // Get visible buildings
    getVisibleBuildings() {
        const bounds = this.getScreenBounds();
        const padding = this.state.gridSize;
        
        return this.game.grid.getAllBuildings().filter(building => {
            const { x, y, type } = building;
            const worldX = x * this.state.gridSize;
            const worldY = y * this.state.gridSize;
            const width = type.size.width * this.state.gridSize;
            const height = type.size.height * this.state.gridSize;
            
            return worldX + width + padding > bounds.left &&
                   worldX - padding < bounds.right &&
                   worldY + height + padding > bounds.top &&
                   worldY - padding < bounds.bottom;
        });
    }
    
    // Destroy renderer
    destroy() {
        // Remove event listeners
        window.removeEventListener('resize', this.handleResize);
        
        // Stop ticker
        this.app.ticker.remove(this.render, this);
        
        // Remove app from container
        this.container.removeChild(this.app.view);
        
        // Destroy app
        this.app.destroy(true);
        
        // Clear references
        this.app = null;
        this.stage = null;
        this.gridContainer = null;
        this.buildingContainer = null;
        this.uiContainer = null;
        this.gridGraphics = null;
        this.buildingGraphics.clear();
        this.previewGraphics = null;
    }
}
