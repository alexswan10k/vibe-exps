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
        
        // Cached integer versions of building type colors
        this._colorCache = new Map();
        
        // Per-type drawing routines
        this.buildingDrawers = {
            residential: this.drawResidential,
            commercial: this.drawCommercial,
            industrial: this.drawIndustrial,
            power: this.drawPowerPlant,
            water: this.drawWaterPlant,
            park: this.drawPark,
            road: this.renderRoad
        };
        
        // Bound handlers for proper cleanup
        this._boundResize = this.handleResize.bind(this);
        this._boundRender = this.render.bind(this);
        
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
            try {
                this.app = new PIXI.Application({
                    width: width,
                    height: height,
                    backgroundColor: 0x87CEEB, // Sky blue
                    antialias: true,
                    resolution: window.devicePixelRatio || 1,
                    autoDensity: true
                });
            } catch (e) {
                console.warn('WebGL auto-detect failed, falling back to Canvas renderer', e);
                try {
                    this.app = new PIXI.Application({
                        width: width,
                        height: height,
                        backgroundColor: 0x87CEEB,
                        antialias: true,
                        resolution: window.devicePixelRatio || 1,
                        autoDensity: true,
                        forceCanvas: true
                    });
                } catch (e2) {
                    console.error('Fatal error: Could not initialize PixiJS renderer', e2);
                    return;
                }
            }

            console.log('Pixi.js app created:', this.app);
            console.log('Canvas view:', this.app.view);

            // Add to container
            this.container.appendChild(this.app.view);

            // Sync the logical canvas size with the container and keep it in sync
            // (prevents mouse coordinates drifting when CSS stretches the canvas)
            this.handleResize();
            this.setupResizeHandling();

            // Create stage
            this.stage = this.app.stage;
            console.log('Stage created:', this.stage);

            // Create containers
            this.gridContainer = new PIXI.Container();
            this.buildingContainer = new PIXI.Container();
            this.carContainer = new PIXI.Container();
            this.uiContainer = new PIXI.Container();

            // Add containers to stage
            this.stage.addChild(this.gridContainer);
            this.stage.addChild(this.buildingContainer);
            this.stage.addChild(this.carContainer);
            this.stage.addChild(this.uiContainer);

            // Create grid graphics
            this.createGrid();
            
            // Create car graphics
            this.carGraphics = new PIXI.Graphics();
            this.carContainer.addChild(this.carGraphics);

            // Create selection highlight overlay
            this.selectionGraphics = new PIXI.Graphics();
            this.uiContainer.addChild(this.selectionGraphics);

            // Create preview graphics
            this.previewGraphics = new PIXI.Graphics();
            this.buildingContainer.addChild(this.previewGraphics);

            // Center the camera on the buildable land
            const centerX = this.game.grid.width * this.state.gridSize / 2;
            const centerY = this.game.grid.height * this.state.gridSize / 2;
            this.setCameraPosition(centerX, centerY);

            // Start render loop
            this.app.ticker.add(this._boundRender);
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
        const worldWidth = width * cellSize;
        const worldHeight = height * cellSize;
        
        // Clear graphics
        this.gridGraphics.clear();
        
        // Draw the buildable land as a grass island (water shows around it)
        this.gridGraphics.beginFill(0x9ccc65); // Grass green
        this.gridGraphics.drawRect(0, 0, worldWidth, worldHeight);
        this.gridGraphics.endFill();
        
        // Beach/shoreline edge
        this.gridGraphics.lineStyle(6, 0xedd892, 1);
        this.gridGraphics.drawRect(0, 0, worldWidth, worldHeight);
        
        // Subtle building grid on top of the grass
        this.gridGraphics.lineStyle(1, 0x000000, 0.08);
        
        // Draw vertical lines
        for (let x = 0; x <= width; x++) {
            const worldX = x * cellSize;
            this.gridGraphics.moveTo(worldX, 0);
            this.gridGraphics.lineTo(worldX, worldHeight);
        }
        
        // Draw horizontal lines
        for (let y = 0; y <= height; y++) {
            const worldY = y * cellSize;
            this.gridGraphics.moveTo(0, worldY);
            this.gridGraphics.lineTo(worldWidth, worldY);
        }
    }
    
    // Render buildings
    renderBuildings() {
        const buildings = this.game.grid.getAllBuildings();
        
        // Remove graphics for buildings that no longer exist
        for (const [buildingId, graphics] of this.buildingGraphics) {
            if (!buildings.find(b => b.id === buildingId)) {
                this.buildingContainer.removeChild(graphics);
                graphics.destroy();
                this.buildingGraphics.delete(buildingId);
            }
        }
        
        // Add/update graphics for existing buildings
        for (const building of buildings) {
            let graphics = this.buildingGraphics.get(building.id);
            if (!graphics) {
                graphics = new PIXI.Graphics();
                this.buildingContainer.addChild(graphics);
                this.buildingGraphics.set(building.id, graphics);
            }
            
            // Only redraw when something visible changed
            const signature = this.getBuildingSignature(building);
            if (graphics._sig !== signature) {
                this.updateBuildingGraphics(building, graphics, signature);
            }
        }
    }

    // Signature of everything that affects how a building is drawn
    getBuildingSignature(building) {
        const { type } = building;
        let signature = `${type.id}|${Math.round(building.population)}|${Math.round(building.jobs)}`;
        
        // Roads change appearance based on neighboring roads
        if (type.id === 'road') {
            const grid = this.game.grid;
            const isRoad = (x, y) => {
                const b = grid.getBuildingAt(x, y);
                return b && b.type.id === 'road' ? 1 : 0;
            };
            signature += `|${isRoad(building.x, building.y - 1)}${isRoad(building.x, building.y + 1)}` +
                         `${isRoad(building.x - 1, building.y)}${isRoad(building.x + 1, building.y)}`;
        }
        
        return signature;
    }
    
    // Render cars
    renderCars() {
        if (!this.game.trafficManager) return;
        
        const cars = this.game.trafficManager.cars;
        this.carGraphics.clear();
        
        const cellSize = this.state.gridSize;
        const carSize = cellSize * 0.5; // Increased size
        const offset = (cellSize - carSize) / 2;
        
        for (const car of cars) {
            const screenX = car.x * cellSize + offset;
            const screenY = car.y * cellSize + offset;
            
            // Draw car body
            this.carGraphics.beginFill(car.color);
            this.carGraphics.drawRoundedRect(screenX, screenY, carSize, carSize, 3);
            this.carGraphics.endFill();
            
            // Draw windshield/roof
            this.carGraphics.beginFill(0x222222); 
            this.carGraphics.drawRect(screenX + 3, screenY + 3, carSize - 6, carSize - 6);
            this.carGraphics.endFill();
        }
    }
    
    // Update building graphics
    updateBuildingGraphics(building, graphics = null, signature = null) {
        graphics = graphics || this.buildingGraphics.get(building.id);
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
        
        // Cache bounds for hit-testing
        graphics._bounds = { x: worldX, y: worldY, width, height };
        
        // Dispatch to the type-specific drawer
        const drawer = this.buildingDrawers[type.id];
        if (drawer) {
            drawer.call(this, graphics, building, worldX, worldY, width, height);
        } else {
            this.drawGenericBox(graphics, building, worldX, worldY, width, height);
        }
        
        // Draw occupancy bars on top of residential/commercial/industrial
        if (type.populationCapacity > 0 || type.jobCapacity > 0) {
            this.drawOccupancyBars(graphics, building, worldX, worldY, width, height);
        }
        
        graphics._sig = signature || this.getBuildingSignature(building);
    }
    
    // --- Colour helpers -----------------------------------------------------
    
    typeColorInt(type) {
        if (!this._colorCache.has(type.id)) {
            this._colorCache.set(type.id, parseInt(type.color.replace('#', ''), 16));
        }
        return this._colorCache.get(type.id);
    }
    
    // factor > 1 lightens towards white, < 1 darkens
    shade(color, factor) {
        let r = (color >> 16) & 255;
        let g = (color >> 8) & 255;
        let b = color & 255;
        
        if (factor >= 1) {
            r += (255 - r) * (factor - 1);
            g += (255 - g) * (factor - 1);
            b += (255 - b) * (factor - 1);
        } else {
            r *= factor;
            g *= factor;
            b *= factor;
        }
        
        return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
    }
    
    // Deterministic pseudo-random bits from a building id, used for window
    // lights / tree placement so each building looks stable between frames
    seedOf(building) {
        let hash = 0;
        const str = building ? String(building.id) : 'preview';
        for (let i = 0; i < str.length; i++) {
            hash = ((hash * 31) + str.charCodeAt(i)) | 0;
        }
        return Math.abs(hash);
    }
    
    drawDropShadow(graphics, x, y, width, height) {
        graphics.beginFill(0x000000, 0.18);
        graphics.drawRect(x + 2, y + 3, width, height);
        graphics.endFill();
    }
    
    // --- Building drawers ---------------------------------------------------
    
    // Cosy little house with pitched roof and windows that light up
    drawResidential(graphics, building, x, y, width, height) {
        const color = this.typeColorInt(building.type);
        const seed = this.seedOf(building);
        
        this.drawDropShadow(graphics, x, y, width, height);
        
        // Walls
        graphics.beginFill(this.shade(color, 1.25));
        graphics.drawRect(x, y + height * 0.38, width, height * 0.62);
        graphics.endFill();
        
        // Pitched roof
        graphics.beginFill(this.shade(color, 0.72));
        graphics.moveTo(x, y + height * 0.42);
        graphics.lineTo(x + width / 2, y + height * 0.04);
        graphics.lineTo(x + width, y + height * 0.42);
        graphics.closePath();
        graphics.endFill();
        
        // Door
        graphics.beginFill(0x5d4037);
        graphics.drawRect(x + width * 0.4, y + height * 0.68, width * 0.2, height * 0.32);
        graphics.endFill();
        
        // Windows (some lit at night-ish yellow)
        const winW = width * 0.18;
        const winH = height * 0.16;
        const windowPositions = [
            { wx: x + width * 0.1, wy: y + height * 0.5 },
            { wx: x + width * 0.72, wy: y + height * 0.5 }
        ];
        for (let i = 0; i < windowPositions.length; i++) {
            const lit = ((seed >> i) & 1) === 1;
            graphics.beginFill(lit ? 0xffe082 : 0xb3e5fc);
            graphics.drawRect(windowPositions[i].wx, windowPositions[i].wy, winW, winH);
            graphics.endFill();
        }
    }
    
    // Glass-front office block
    drawCommercial(graphics, building, x, y, width, height) {
        const color = this.typeColorInt(building.type);
        const seed = this.seedOf(building);
        
        this.drawDropShadow(graphics, x, y, width, height);
        
        // Body
        graphics.beginFill(color);
        graphics.drawRect(x, y, width, height);
        graphics.endFill();
        
        // Flat roof lip
        graphics.beginFill(this.shade(color, 0.7));
        graphics.drawRect(x, y, width, height * 0.14);
        graphics.endFill();
        
        // Glass window grid (3 rows x 2 cols)
        const paneW = width * 0.34;
        const paneH = height * 0.2;
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 2; col++) {
                const lit = ((seed >> (row * 2 + col)) & 1) === 1;
                graphics.beginFill(lit ? 0xfff59d : 0xe8f4fd);
                graphics.drawRect(
                    x + width * (0.11 + col * 0.44),
                    y + height * (0.22 + row * 0.24),
                    paneW,
                    paneH
                );
                graphics.endFill();
            }
        }
        
        // Entrance
        graphics.beginFill(0x37474f);
        graphics.drawRect(x + width * 0.32, y + height * 0.86, width * 0.36, height * 0.14);
        graphics.endFill();
    }
    
    // Warehouse with sawtooth roof and smoking chimney
    drawIndustrial(graphics, building, x, y, width, height) {
        const color = this.typeColorInt(building.type);
        
        this.drawDropShadow(graphics, x, y, width, height);
        
        // Main hall
        graphics.beginFill(this.shade(color, 0.95));
        graphics.drawRect(x, y + height * 0.25, width, height * 0.75);
        graphics.endFill();
        
        // Sawtooth roof (two teeth)
        graphics.beginFill(this.shade(color, 0.65));
        graphics.moveTo(x, y + height * 0.28);
        graphics.lineTo(x + width * 0.25, y + height * 0.05);
        graphics.lineTo(x + width * 0.5, y + height * 0.28);
        graphics.lineTo(x + width * 0.75, y + height * 0.05);
        graphics.lineTo(x + width, y + height * 0.28);
        graphics.closePath();
        graphics.endFill();
        
        // Big roller door
        graphics.beginFill(0x616161);
        graphics.drawRect(x + width * 0.12, y + height * 0.55, width * 0.45, height * 0.45);
        graphics.endFill();
        graphics.lineStyle(1, 0x9e9e9e, 1);
        for (let i = 1; i < 3; i++) {
            graphics.moveTo(x + width * 0.12, y + height * (0.55 + i * 0.15));
            graphics.lineTo(x + width * 0.57, y + height * (0.55 + i * 0.15));
        }
        graphics.lineStyle(0);
        
        // Chimney + smoke puffs
        graphics.beginFill(0x8d6e63);
        graphics.drawRect(x + width * 0.74, y - height * 0.02, width * 0.14, height * 0.35);
        graphics.endFill();
        graphics.beginFill(0xffffff, 0.55);
        graphics.drawCircle(x + width * 0.81, y - height * 0.1, width * 0.09);
        graphics.endFill();
        graphics.beginFill(0xffffff, 0.3);
        graphics.drawCircle(x + width * 0.88, y - height * 0.22, width * 0.12);
        graphics.endFill();
    }
    
    // Power plant: cooling tower with steam + turbine hall with bolt sign
    drawPowerPlant(graphics, building, x, y, width, height) {
        const color = this.typeColorInt(building.type);
        const seed = this.seedOf(building);
        
        this.drawDropShadow(graphics, x, y, width, height);
        
        // Concrete pad
        graphics.beginFill(0xbdbdbd);
        graphics.drawRect(x + width * 0.04, y + height * 0.06, width * 0.92, height * 0.9);
        graphics.endFill();
        
        // Cooling tower (left half)
        const cx = x + width * 0.28;
        const baseY = y + height * 0.92;
        const topY = y + height * 0.18;
        graphics.beginFill(0xeceff1);
        graphics.moveTo(cx - width * 0.16, baseY);
        graphics.lineTo(cx - width * 0.1, topY);
        graphics.lineTo(cx + width * 0.1, topY);
        graphics.lineTo(cx + width * 0.16, baseY);
        graphics.closePath();
        graphics.endFill();
        
        // Red stripe near tower top
        graphics.beginFill(0xef5350);
        graphics.drawRect(cx - width * 0.115, topY + height * 0.05, width * 0.23, height * 0.07);
        graphics.endFill();
        
        // Steam drifting from the tower
        graphics.beginFill(0xffffff, 0.5 + 0.15 * (seed % 3));
        graphics.drawCircle(cx + width * 0.03, topY - height * 0.09, width * 0.09);
        graphics.endFill();
        graphics.beginFill(0xffffff, 0.25);
        graphics.drawCircle(cx - width * 0.08, topY - height * 0.2, width * 0.12);
        graphics.endFill();
        
        // Turbine hall (right half)
        graphics.beginFill(color);
        graphics.drawRect(x + width * 0.52, y + height * 0.4, width * 0.42, height * 0.52);
        graphics.endFill();
        graphics.lineStyle(2, this.shade(color, 0.6), 1);
        graphics.drawRect(x + width * 0.52, y + height * 0.4, width * 0.42, height * 0.52);
        graphics.lineStyle(0);
        
        // Lightning bolt sign
        this.drawBolt(graphics, x + width * 0.73, y + height * 0.66, width * 0.13);
    }
    
    // Water treatment plant: two tanks and a droplet sign
    drawWaterPlant(graphics, building, x, y, width, height) {
        const color = this.typeColorInt(building.type);
        
        this.drawDropShadow(graphics, x, y, width, height);
        
        // Pad
        graphics.beginFill(this.shade(color, 1.4));
        graphics.drawRect(x + width * 0.04, y + height * 0.06, width * 0.92, height * 0.9);
        graphics.endFill();
        
        // Two storage tanks
        const tankR = width * 0.17;
        const tanks = [
            { tx: x + width * 0.28, ty: y + height * 0.38 },
            { tx: x + width * 0.66, ty: y + height * 0.62 }
        ];
        for (const tank of tanks) {
            graphics.beginFill(color);
            graphics.drawCircle(tank.tx, tank.ty, tankR);
            graphics.endFill();
            
            // Tank rim + highlight
            graphics.lineStyle(2, this.shade(color, 0.6), 1);
            graphics.drawCircle(tank.tx, tank.ty, tankR);
            graphics.lineStyle(0);
            graphics.beginFill(0xffffff, 0.4);
            graphics.drawCircle(tank.tx - tankR * 0.3, tank.ty - tankR * 0.3, tankR * 0.25);
            graphics.endFill();
        }
        
        // Connecting pipe
        graphics.lineStyle(3, 0x78909c, 1);
        graphics.moveTo(tanks[0].tx, tanks[0].ty);
        graphics.lineTo(tanks[1].tx, tanks[1].ty);
        graphics.lineStyle(0);
        
        // Droplet sign
        this.drawDroplet(graphics, x + width * 0.5, y + height * 0.82, width * 0.09);
    }
    
    // Park: lawn, pond, winding path and trees
    drawPark(graphics, building, x, y, width, height) {
        const seed = this.seedOf(building);
        
        // Lawn
        graphics.beginFill(0xaed581);
        graphics.drawRect(x, y, width, height);
        graphics.endFill();
        
        // Pond
        graphics.beginFill(0x64b5f6);
        graphics.drawEllipse(x + width * 0.66, y + height * 0.68, width * 0.24, height * 0.18);
        graphics.endFill();
        graphics.beginFill(0xffffff, 0.35);
        graphics.drawEllipse(x + width * 0.58, y + height * 0.62, width * 0.08, height * 0.05);
        graphics.endFill();
        
        // Path
        graphics.lineStyle(width * 0.1, 0xd7ccc8, 1);
        graphics.moveTo(x + width * 0.12, y + height * 0.88);
        graphics.quadraticCurveTo(x + width * 0.5, y + height * 0.55, x + width * 0.85, y + height * 0.2);
        graphics.lineStyle(0);
        
        // Trees (placement varies per park)
        const treeSpots = [
            { tx: x + width * 0.22, ty: y + height * 0.24 },
            { tx: x + width * 0.75, ty: y + height * 0.3 },
            { tx: x + width * 0.3, ty: y + height * 0.66 }
        ];
        for (let i = 0; i < treeSpots.length; i++) {
            const tree = treeSpots[(seed + i) % treeSpots.length];
            const r = width * (0.13 + ((seed >> (i * 3)) % 3) * 0.02);
            graphics.beginFill(0x6d4c41);
            graphics.drawRect(tree.tx - r * 0.15, tree.ty, r * 0.3, r * 0.7);
            graphics.endFill();
            graphics.beginFill(i % 2 === 0 ? 0x2e7d32 : 0x388e3c);
            graphics.drawCircle(tree.tx, tree.ty - r * 0.3, r);
            graphics.endFill();
        }
    }
    
    // Fallback: plain coloured box with outline
    drawGenericBox(graphics, building, x, y, width, height) {
        const color = this.typeColorInt(building.type);
        this.drawDropShadow(graphics, x, y, width, height);
        graphics.beginFill(color);
        graphics.drawRect(x, y, width, height);
        graphics.endFill();
        graphics.lineStyle(2, this.shade(color, 0.6), 0.8);
        graphics.drawRect(x, y, width, height);
        graphics.lineStyle(0);
    }
    
    // Occupancy bars: blue = residents moved in, green = jobs filled
    drawOccupancyBars(graphics, building, x, y, width, height) {
        const type = building.type;
        const barHeight = 3;
        const pad = 2;
        let barY = y + height - pad - barHeight;
        
        if (type.populationCapacity > 0) {
            graphics.beginFill(0x000000, 0.35);
            graphics.drawRoundedRect(x + pad, barY, width - pad * 2, barHeight, 1.5);
            graphics.endFill();
            
            const fill = (building.population / type.populationCapacity) * (width - pad * 2);
            if (fill > 0.5) {
                graphics.beginFill(0x64b5f6);
                graphics.drawRoundedRect(x + pad, barY, fill, barHeight, 1.5);
                graphics.endFill();
            }
            barY -= barHeight + 1;
        }
        
        if (type.jobCapacity > 0) {
            graphics.beginFill(0x000000, 0.35);
            graphics.drawRoundedRect(x + pad, barY, width - pad * 2, barHeight, 1.5);
            graphics.endFill();
            
            const fill = (building.jobs / type.jobCapacity) * (width - pad * 2);
            if (fill > 0.5) {
                graphics.beginFill(0x81c784);
                graphics.drawRoundedRect(x + pad, barY, fill, barHeight, 1.5);
                graphics.endFill();
            }
        }
    }
    
    drawBolt(graphics, cx, cy, size) {
        graphics.beginFill(0xfdd835);
        graphics.moveTo(cx + size * 0.25, cy - size);
        graphics.lineTo(cx - size * 0.55, cy + size * 0.15);
        graphics.lineTo(cx - size * 0.05, cy + size * 0.15);
        graphics.lineTo(cx - size * 0.25, cy + size);
        graphics.lineTo(cx + size * 0.55, cy - size * 0.15);
        graphics.lineTo(cx + size * 0.05, cy - size * 0.15);
        graphics.closePath();
        graphics.endFill();
    }
    
    drawDroplet(graphics, cx, cy, radius) {
        graphics.beginFill(0x29b6f6);
        graphics.moveTo(cx, cy - radius * 1.6);
        graphics.lineTo(cx + radius * 0.95, cy - radius * 0.2);
        graphics.arc(cx, cy, radius, 0, Math.PI);
        graphics.closePath();
        graphics.endFill();
    }

    // Render a road tile: pavement base, asphalt connections, lane markings
    renderRoad(graphics, building, x, y, width, height) {
        const { x: gridX, y: gridY } = building;
        const grid = this.game.grid;
        
        const neighbors = {
            top: grid.getBuildingAt(gridX, gridY - 1),
            bottom: grid.getBuildingAt(gridX, gridY + 1),
            left: grid.getBuildingAt(gridX - 1, gridY),
            right: grid.getBuildingAt(gridX + 1, gridY)
        };
        const isRoad = (b) => b && b.type.id === 'road';
        
        // Pavement covers the whole cell
        graphics.beginFill(0xcfd8dc);
        graphics.drawRect(x, y, width, height);
        graphics.endFill();
        
        // Asphalt arms towards each connected neighbour
        const asphalt = 0x555555;
        const armWidth = width * 0.5;
        const offset = (width - armWidth) / 2;
        const midX = x + width / 2;
        const midY = y + height / 2;
        
        graphics.beginFill(asphalt);
        if (isRoad(neighbors.top)) {
            graphics.drawRect(x + offset, y, armWidth, height / 2);
        }
        if (isRoad(neighbors.bottom)) {
            graphics.drawRect(x + offset, midY, armWidth, height / 2);
        }
        if (isRoad(neighbors.left)) {
            graphics.drawRect(x, y + offset, width / 2, armWidth);
        }
        if (isRoad(neighbors.right)) {
            graphics.drawRect(midX, y + offset, width / 2, armWidth);
        }
        
        // Always keep an asphalt centre so lone tiles look like a stub
        graphics.drawRect(x + offset, y + offset, armWidth, armWidth);
        graphics.endFill();
        
        // Dashed yellow lane markings along open arms
        const dashLength = Math.max(3, width * 0.14);
        const dashGap = dashLength * 0.8;
        const halfArm = width / 2;
        graphics.beginFill(0xffd54f);
        
        if (isRoad(neighbors.top)) {
            for (let d = dashGap; d < halfArm - dashLength; d += dashLength + dashGap) {
                graphics.drawRect(midX - 1, y + d, 2, dashLength);
            }
        }
        if (isRoad(neighbors.bottom)) {
            for (let d = dashGap; d < halfArm - dashLength; d += dashLength + dashGap) {
                graphics.drawRect(midX - 1, midY + d, 2, dashLength);
            }
        }
        if (isRoad(neighbors.left)) {
            for (let d = dashGap; d < halfArm - dashLength; d += dashLength + dashGap) {
                graphics.drawRect(x + d, midY - 1, dashLength, 2);
            }
        }
        if (isRoad(neighbors.right)) {
            for (let d = dashGap; d < halfArm - dashLength; d += dashLength + dashGap) {
                graphics.drawRect(midX + d, midY - 1, dashLength, 2);
            }
        }
        graphics.endFill();
    }
    
    // Render building preview
    renderPreview() {
        const inputManager = this.game.inputManager;
        const selectedType = inputManager.getSelectedBuildingType();
        
        // Clear preview
        this.previewGraphics.clear();
        this.previewGraphics.alpha = 1;

        if (!selectedType) {
            return;
        }
        
        const mousePos = inputManager.getMousePosition();
        const gridPos = this.game.grid.worldToGrid(mousePos.world.x, mousePos.world.y);
        const cellSize = this.state.gridSize;
        const previewX = gridPos.x * cellSize;
        const previewY = gridPos.y * cellSize;
        
        if (selectedType === 'delete') {
            this.previewGraphics.lineStyle(2, 0xe74c3c, 0.8);
            this.previewGraphics.beginFill(0xe74c3c, 0.3);
            this.previewGraphics.drawRect(previewX, previewY, cellSize, cellSize);
            this.previewGraphics.endFill();
            return;
        }
        
        const buildingType = this.game.buildingTypes[selectedType];
        
        // Calculate preview position
        const previewWidth = buildingType.size.width * cellSize;
        const previewHeight = buildingType.size.height * cellSize;
        const isValid = inputManager.isPlacementValid();
        
        // Draw the real building appearance as a translucent ghost
        this.previewGraphics.alpha = 0.55;
        const ghost = {
            type: buildingType,
            id: 'preview',
            x: gridPos.x,
            y: gridPos.y,
            population: 0,
            jobs: 0
        };
        const drawer = this.buildingDrawers[selectedType];
        if (drawer) {
            drawer.call(this, this.previewGraphics, ghost, previewX, previewY, previewWidth, previewHeight);
        } else {
            this.drawGenericBox(this.previewGraphics, ghost, previewX, previewY, previewWidth, previewHeight);
        }
        this.previewGraphics.alpha = 1;
        
        // Validity tint and border on top
        this.previewGraphics.beginFill(isValid ? 0x2ecc71 : 0xe74c3c, isValid ? 0.12 : 0.3);
        this.previewGraphics.drawRect(previewX, previewY, previewWidth, previewHeight);
        this.previewGraphics.endFill();
        
        this.previewGraphics.lineStyle(2, isValid ? 0x2ecc71 : 0xe74c3c, 0.9);
        this.previewGraphics.drawRect(previewX, previewY, previewWidth, previewHeight);
        this.previewGraphics.lineStyle(0);
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
        if (!this.app || !this.container) return;
        
        // Update app size
        this.app.renderer.resize(
            this.container.clientWidth,
            this.container.clientHeight
        );
        
        // Update camera
        this.updateCamera();
    }
    
    // Keep the canvas size in sync with its container.
    // A ResizeObserver catches any layout change (window resize, panel
    // reflow, fonts loading) that would otherwise stretch the canvas via CSS
    // and desynchronise mouse coordinates from the world.
    setupResizeHandling() {
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => this.handleResize());
            this.resizeObserver.observe(this.container);
        }
        window.addEventListener('resize', this._boundResize);
    }
    
    // Render loop
    render() {
        if (!this.app || !this.app.stage) return;
        
        // Render buildings
        this.renderBuildings();
        
        // Render cars
        this.renderCars();
        
        // Render selection highlight
        this.renderSelection();
        
        // Render preview
        this.renderPreview();
        
        // Update camera if needed
        if (this.state.camera.dirty) {
            this.updateCamera();
            this.state.camera.dirty = false;
        }
    }
    
    // Render selection highlight as an overlay so it survives building redraws
    renderSelection() {
        const graphics = this.selectionGraphics;
        if (!graphics) return;
        
        graphics.clear();
        
        const building = this.game.state && this.game.state.selectedBuilding;
        if (!building) return;
        
        const cellSize = this.state.gridSize;
        const width = building.type.size.width * cellSize;
        const height = building.type.size.height * cellSize;
        const worldX = building.x * cellSize;
        const worldY = building.y * cellSize;
        
        graphics.lineStyle(3, 0xFFFF00, 1);
        graphics.drawRect(worldX - 2, worldY - 2, width + 4, height + 4);
    }
    
    // Highlight building
    // Kept for API compatibility: the actual highlight is drawn each frame
    // by renderSelection() from game.state.selectedBuilding
    highlightBuilding(building, highlight = true) {
        // no-op
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
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        window.removeEventListener('resize', this._boundResize);
        
        // Stop ticker
        if (this.app && this.app.ticker) {
            this.app.ticker.remove(this._boundRender);
        }
        
        // Remove app from container
        if (this.app) {
            this.container.removeChild(this.app.view);
            
            // Destroy app
            this.app.destroy(true);
        }
        
        // Clear references
        this.app = null;
        this.stage = null;
        this.gridContainer = null;
        this.buildingContainer = null;
        this.carContainer = null;
        this.uiContainer = null;
        this.gridGraphics = null;
        this.selectionGraphics = null;
        for (const graphics of this.buildingGraphics.values()) {
            graphics.destroy();
        }
        this.buildingGraphics.clear();
        this.previewGraphics = null;
    }
}
