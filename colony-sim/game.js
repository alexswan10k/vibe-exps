/**
 * Main Game class managing the colony simulation
 */
class Game {
    /**
     * @param {GameConfig} [config] - Optional game configuration
     */
    constructor(config = {}) {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
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

        this.init();

        // Initialize managers AFTER init so map exists
        this.inputManager = new InputManager(this);
        this.renderer = new Renderer(this);
        this.uiManager = new UIManager(this);
        this.taskManager = new TaskManager(this);

        this.loadSpriteSheet();
        this.gameLoop();
    }

    loadSpriteSheet() {
        this.spriteSheet = new Image();
        this.spriteSheet.onload = () => {
            this.spriteSheetLoaded = true;
            console.log('Sprite sheet loaded successfully');
        };
        this.spriteSheet.onerror = () => {
            console.error('Failed to load sprite sheet');
        };
        this.spriteSheet.src = 'terrain.png';
    }

    init() {
        this.canvas.width = window.innerWidth - 600;
        this.canvas.height = window.innerHeight;
        this.generateMap();
        this.createInitialPawns();
        this.generateResources();
    }

    generateMap() {
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
            const distance = Math.sqrt((pawn.x - x) ** 2 + (pawn.y - y) ** 2);
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

        // Update tasks
        this.tasks = this.tasks.filter(task => !task.completed);
    }

    /**
     * Render the game using the renderer
     */
    render() {
        this.renderer.render();
    }

    /**
     * Update UI using the UI manager
     */
    updateUI() {
        this.uiManager.updateUI();
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
        this.update();
        this.render();
        this.updateUI();
        requestAnimationFrame(() => this.gameLoop());
    }
}
