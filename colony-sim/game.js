/**
 * Main Game class managing the colony simulation
 */
class Game {
    /**
     * @param {GameConfig} [config] - Optional game configuration
     */
    constructor(config = {}) {
        console.log('Game constructor started');

        this.canvas = document.getElementById('game-canvas');
        if (!this.canvas) {
            console.error('Canvas element not found!');
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            console.error('Canvas context not available!');
            return;
        }

        this.tileSize = config.tileSize || 32;
        this.mapWidth = config.mapWidth || 50;
        this.mapHeight = config.mapHeight || 50;
        this.camera = { x: 0, y: 0 };
        this.zoom = config.zoom || 1;
        this.minZoom = config.minZoom || 0.5;
        this.maxZoom = config.maxZoom || 2;
        this.selectedTile = null;
        this.pawns = [];
        this.resources = [];
        this.buildings = [];
        this.tasks = [];
        this.buildMode = null;
        this.taskQueue = [];
        this.droppedResources = [];
        this.plants = [];
        this.zones = [];
        this.storageArea = null;
        this.areaSelection = null;
        this.isSelectingArea = false;
        this.selectionStart = null;
        this.currentTaskType = null;
        this.hoveredTile = null;

        // Central item lookup
        this.itemLookup = {
            wood: { weight: 1, cost: 5 },
            stone: { weight: 2, cost: 10 },
            iron: { weight: 3, cost: 15 },
            food: { weight: 0.5, cost: 3 },
            tools: { weight: 1.5, cost: 20 }
        };

        // Sprite sheet properties
        this.spriteSheet = null;
        this.spriteSheetLoaded = false;
        this.spriteConfig = {
            width: 256,
            height: 256,
            columns: 4,
            rows: 4,
            tileWidth: 64,
            tileHeight: 64,
            images: {
                grass: { column: 0, row: 0 },
                iron: { column: 1, row: 0 },
                tree: { column: 2, row: 0 },
                sand: { column: 3, row: 0 },
                stone: { column: 0, row: 1 }
            }
        };

        console.log('Starting game initialization...');
        this.init();

        // Initialize managers AFTER init so map exists
        console.log('Initializing managers...');
        try {
            this.inputManager = new InputManager(this);
            this.renderer = new Renderer(this);
            this.uiManager = new UIManager(this);
            this.taskManager = new TaskManager(this);
            console.log('Managers initialized successfully');
            
            // Initialize UI after managers are ready
            this.uiManager.updateUI();
        } catch (error) {
            console.error('Error initializing managers:', error);
        }

        this.loadSpriteSheet();
        this.gameLoop();

        console.log('Game constructor completed');
    }

    loadSpriteSheet() {
        console.log('Loading sprite sheet...');
        this.spriteSheet = new Image();
        this.spriteSheet.onload = () => {
            this.spriteSheetLoaded = true;
            console.log('Sprite sheet loaded successfully');
        };
        this.spriteSheet.onerror = () => {
            console.error('Failed to load sprite sheet');
            // Continue with fallback colors
        };
        this.spriteSheet.src = 'terrain.png';
    }

    init() {
        console.log('Game init started');

        // Set canvas size
        this.canvas.width = window.innerWidth - 600;
        this.canvas.height = window.innerHeight;
        console.log(`Canvas size: ${this.canvas.width}x${this.canvas.height}`);

        // Generate map and entities
        console.log('Generating map...');
        this.generateMap();
        console.log(`Map generated: ${this.mapWidth}x${this.mapHeight}`);

        console.log('Creating initial pawns...');
        this.createInitialPawns();
        console.log(`Created ${this.pawns.length} pawns`);

        console.log('Generating resources...');
        this.generateResources();
        console.log(`Generated ${this.resources.length} resources`);

        console.log('Game init completed');
    }

    generateMap() {
        console.log('Generating map data...');
        this.map = [];
        for (let y = 0; y < this.mapHeight; y++) {
            this.map[y] = [];
            for (let x = 0; x < this.mapWidth; x++) {
                // Generate different terrain types
                const rand = Math.random();
                if (rand < 0.6) {
                    this.map[y][x] = 'grass';
                } else if (rand < 0.8) {
                    this.map[y][x] = 'dirt';
                } else {
                    this.map[y][x] = 'stone';
                }
            }
        }

        // Generate plants on grass
        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                if (this.map[y][x] === 'grass' && Math.random() < 0.1) {
                    // Start plants with some growth for faster testing
                    const initialGrowth = Math.random() < 0.3 ? 60 : Math.random() * 30;
                    this.plants.push(new Plant(x, y, initialGrowth));
                }
            }
        }
        console.log(`Generated ${this.plants.length} plants`);
    }

    createInitialPawns() {
        for (let i = 0; i < 3; i++) {
            const pawn = new Pawn(
                Math.floor(Math.random() * this.mapWidth),
                Math.floor(Math.random() * this.mapHeight),
                `Pawn ${i + 1}`
            );
            this.pawns.push(pawn);
        }
    }

    generateResources() {
        for (let i = 0; i < 20; i++) {
            const x = Math.floor(Math.random() * this.mapWidth);
            const y = Math.floor(Math.random() * this.mapHeight);
            const type = Math.random() < 0.5 ? 'tree' : 'iron';
            this.resources.push(new Resource(x, y, type));
        }
    }

    /**
     * Harvest resource at location
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {string|null} Type of resource harvested
     */
    harvestResource(x, y) {
        return this.taskManager.harvestResource(x, y);
    }

    /**
     * Harvest plant at location
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {string|null} Type of resource harvested
     */
    harvestPlant(x, y) {
        return this.taskManager.harvestPlant(x, y);
    }

    /**
     * Mine stone at location
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {string|null} Type of resource mined
     */
    mineStone(x, y) {
        return this.taskManager.mineStone(x, y);
    }

    /**
     * Drop a resource at the specified location
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} type - Type of resource
     * @param {number} quantity - Quantity to drop
     */
    dropResource(x, y, type, quantity = 1) {
        this.taskManager.dropResource(x, y, type, quantity);
    }

    /**
     * Pick up dropped resource at location
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {boolean} addToInventory - Whether to add to inventory
     * @returns {Object|null} Resource pickup result
     */
    pickupDroppedResource(x, y, addToInventory = true) {
        return this.taskManager.pickupDroppedResource(x, y, addToInventory);
    }

    /**
     * Assign task to nearest pawn
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    assignTask(x, y) {
        // Find nearest pawn and assign task
        let nearestPawn = null;
        let minDistance = Infinity;
        for (const pawn of this.pawns) {
            const distance = calculateDistance(pawn.x, pawn.y, x, y);
            if (distance < minDistance) {
                minDistance = distance;
                nearestPawn = pawn;
            }
        }
        if (nearestPawn) {
            nearestPawn.assignTask({ x, y, type: 'move' });
        }
    }

    /**
     * Craft an item
     * @param {string} itemType - Type of item to craft
     * @returns {boolean} True if crafting was successful
     */
    craftItem(itemType) {
        return this.taskManager.craftItem(itemType);
    }

    /**
     * Update game state
     */
    update() {
        // Update pawns
        for (const pawn of this.pawns) {
            pawn.update(this);
        }

        // Update plants
        for (const plant of this.plants) {
            plant.update();
        }

        // Clean up completed tasks
        this.tasks = this.tasks.filter(task => !task.completed);

        // Limit task queue size to prevent memory issues
        if (this.taskQueue.length > 100) {
            this.taskQueue = this.taskQueue.slice(-100);
        }
    }

    /**
     * Render the game using the renderer
     */
    render() {
        try {
            this.renderer.render();
        } catch (error) {
            console.error('Error rendering game:', error);
        }
    }

    /**
     * Update UI using the UI manager
     */
    updateUI() {
        try {
            this.uiManager.updateUI();
        } catch (error) {
            console.error('Error updating UI:', error);
        }
    }

    /**
     * Get nearest available task for a pawn
     * @param {Pawn} pawn - The pawn to find tasks for
     * @returns {Task|null} The nearest available task
     */
    getNearestAvailableTask(pawn) {
        return this.taskManager.getNearestAvailableTask(pawn);
    }

    gameLoop() {
        try {
            this.update();
            this.render();
            this.updateUI();
            requestAnimationFrame(() => this.gameLoop());
        } catch (error) {
            console.error('Error in game loop:', error);
            // Try to continue the game loop even if there's an error
            setTimeout(() => this.gameLoop(), 16); // ~60fps
        }
    }
}
