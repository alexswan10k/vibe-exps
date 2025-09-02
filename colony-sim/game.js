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
        this.setupEventListeners();
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
                if (this.map[y][x] === 'grass' && Math.random() < 0.05) {
                    this.plants.push(new Plant(x, y, 0));
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

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        document.getElementById('chop-trees').addEventListener('click', () => {
            this.setTaskMode('chop');
        });

        document.getElementById('mine-iron').addEventListener('click', () => {
            this.setTaskMode('mine');
        });

        document.getElementById('mine-stone').addEventListener('click', () => {
            this.setTaskMode('mine_stone');
        });

        document.getElementById('harvest-plants').addEventListener('click', () => {
            this.setTaskMode('harvest_plant');
        });

        document.getElementById('build-wall').addEventListener('click', () => {
            this.buildMode = 'wall';
            this.currentTaskType = null;
            this.canvas.style.cursor = 'crosshair';
        });

        document.getElementById('build-table').addEventListener('click', () => {
            this.buildMode = 'table';
            this.currentTaskType = null;
            this.canvas.style.cursor = 'crosshair';
        });

        document.getElementById('build-storage').addEventListener('click', () => {
            this.setStorageMode();
        });



        document.getElementById('craft-food').addEventListener('click', () => {
            this.craftItem('food');
        });

        document.getElementById('craft-tools').addEventListener('click', () => {
            this.craftItem('tools');
        });

        // Keyboard controls for camera
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Mouse wheel zoom
        this.canvas.addEventListener('wheel', (e) => this.handleMouseWheel(e));
    }

    setTaskMode(taskType) {
        this.currentTaskType = taskType;
        this.buildMode = null;
        this.canvas.style.cursor = 'crosshair';
    }

    setStorageMode() {
        this.currentTaskType = 'storage';
        this.buildMode = null;
        this.canvas.style.cursor = 'crosshair';
    }



    handleMouseDown(e) {
        if (this.currentTaskType || this.buildMode) {
            const rect = this.canvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left + this.camera.x) / (this.tileSize * this.zoom));
            const y = Math.floor((e.clientY - rect.top + this.camera.y) / (this.tileSize * this.zoom));

            this.isSelectingArea = true;
            this.selectionStart = { x, y };
            this.areaSelection = { start: { x, y }, end: { x, y } };
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left + this.camera.x) / (this.tileSize * this.zoom));
        const y = Math.floor((e.clientY - rect.top + this.camera.y) / (this.tileSize * this.zoom));

        if (this.isSelectingArea && this.areaSelection) {
            this.areaSelection.end = { x, y };
        } else {
            this.hoveredTile = { x, y };
        }
    }

    handleMouseUp(e) {
        if (this.isSelectingArea && this.areaSelection) {
            this.isSelectingArea = false;
            if (this.currentTaskType === 'storage') {
                this.storageArea = this.areaSelection;
                this.areaSelection = null;
                this.currentTaskType = null;
                this.canvas.style.cursor = 'default';
            } else if (this.buildMode) {
                this.buildInArea();
                this.areaSelection = null;
                this.buildMode = null;
                this.canvas.style.cursor = 'default';
            } else {
                this.createTasksFromArea();
                this.areaSelection = null;
                this.currentTaskType = null;
                this.canvas.style.cursor = 'default';
            }
        }
    }

    createTasksFromArea() {
        if (!this.areaSelection) return;

        const startX = Math.min(this.areaSelection.start.x, this.areaSelection.end.x);
        const endX = Math.max(this.areaSelection.start.x, this.areaSelection.end.x);
        const startY = Math.min(this.areaSelection.start.y, this.areaSelection.end.y);
        const endY = Math.max(this.areaSelection.start.y, this.areaSelection.end.y);

        if (this.currentTaskType === 'mine_stone') {
            // For mining stone, look for stone terrain
            for (let y = startY; y <= endY; y++) {
                for (let x = startX; x <= endX; x++) {
                    if (this.map[y][x] === 'stone') {
                        this.taskQueue.push({
                            x: x,
                            y: y,
                            type: this.currentTaskType
                        });
                    }
                }
            }
        } else if (this.currentTaskType === 'harvest_plant') {
            // For harvesting plants, look for mature plants
            for (let y = startY; y <= endY; y++) {
                for (let x = startX; x <= endX; x++) {
                    const plant = this.plants.find(p => p.x === x && p.y === y);
                    if (plant && plant.growth >= 50) {
                        this.taskQueue.push({
                            x: x,
                            y: y,
                            type: this.currentTaskType,
                            plant: plant
                        });
                    }
                }
            }
        } else {
            // For chopping/mining, look for standing resources
            for (let y = startY; y <= endY; y++) {
                for (let x = startX; x <= endX; x++) {
                    const resource = this.resources.find(r => r.x === x && r.y === y);
                    if (resource) {
                        if ((this.currentTaskType === 'chop' && resource.type === 'tree') ||
                            (this.currentTaskType === 'mine' && resource.type === 'iron')) {
                            this.taskQueue.push({
                                x: x,
                                y: y,
                                type: this.currentTaskType,
                                resource: resource
                            });
                        }
                    }
                }
            }
        }
    }

    buildInArea() {
        if (!this.areaSelection) return;

        const startX = Math.min(this.areaSelection.start.x, this.areaSelection.end.x);
        const endX = Math.max(this.areaSelection.start.x, this.areaSelection.end.x);
        const startY = Math.min(this.areaSelection.start.y, this.areaSelection.end.y);
        const endY = Math.max(this.areaSelection.start.y, this.areaSelection.end.y);

        if (this.buildMode === 'wall') {
            // Find a pawn with wood to build walls
            const builderPawn = this.pawns.find(pawn => hasInventoryItem(pawn.inventory, 'wood', 1));
            if (builderPawn) {
                for (let y = startY; y <= endY; y++) {
                    for (let x = startX; x <= endX; x++) {
                        if (hasInventoryItem(builderPawn.inventory, 'wood', 1)) {
                            this.buildings.push(new Building(x, y, 'wall'));
                            removeFromInventory(builderPawn.inventory, 'wood', 1);
                        }
                    }
                }
            }
            this.updateUI();
        } else if (this.buildMode === 'table') {
            // Find a pawn with enough wood to build a table
            const builderPawn = this.pawns.find(pawn => hasInventoryItem(pawn.inventory, 'wood', 5));
            if (builderPawn) {
                const center = getAreaCenter(this.areaSelection);
                this.buildings.push(new Building(center.x, center.y, 'table'));
                removeFromInventory(builderPawn.inventory, 'wood', 5);
                this.updateUI();
            }
        }
    }

    handleKeyDown(e) {
        const moveSpeed = 10;
        switch (e.key) {
            case 'ArrowUp':
            case 'w':
                this.camera.y = Math.max(0, this.camera.y - moveSpeed);
                break;
            case 'ArrowDown':
            case 's':
                this.camera.y = Math.min((this.mapHeight * this.tileSize * this.zoom) - this.canvas.height, this.camera.y + moveSpeed);
                break;
            case 'ArrowLeft':
            case 'a':
                this.camera.x = Math.max(0, this.camera.x - moveSpeed);
                break;
            case 'ArrowRight':
            case 'd':
                this.camera.x = Math.min((this.mapWidth * this.tileSize * this.zoom) - this.canvas.width, this.camera.x + moveSpeed);
                break;
        }
    }

    handleMouseWheel(e) {
        e.preventDefault();
        const zoomSpeed = 0.1;
        const oldZoom = this.zoom;

        if (e.deltaY < 0) {
            // Zoom in
            this.zoom = Math.min(this.maxZoom, this.zoom + zoomSpeed);
        } else {
            // Zoom out
            this.zoom = Math.max(this.minZoom, this.zoom - zoomSpeed);
        }

        // Adjust camera to zoom towards mouse position
        if (oldZoom !== this.zoom) {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const worldX = (mouseX + this.camera.x) / (this.tileSize * oldZoom);
            const worldY = (mouseY + this.camera.y) / (this.tileSize * oldZoom);

            this.camera.x = worldX * this.tileSize * this.zoom - mouseX;
            this.camera.y = worldY * this.tileSize * this.zoom - mouseY;

            // Ensure camera stays within bounds
            this.camera.x = Math.max(0, Math.min((this.mapWidth * this.tileSize * this.zoom) - this.canvas.width, this.camera.x));
            this.camera.y = Math.max(0, Math.min((this.mapHeight * this.tileSize * this.zoom) - this.canvas.height, this.camera.y));
        }
    }

    focusCameraOnPawn(pawn) {
        // Zoom in a little if too far zoomed out
        if (this.zoom < 1) {
            this.zoom = 1;
        }

        // Center camera on the pawn's position
        this.camera.x = pawn.x * this.tileSize * this.zoom - this.canvas.width / 2;
        this.camera.y = pawn.y * this.tileSize * this.zoom - this.canvas.height / 2;

        // Ensure camera stays within bounds
        this.camera.x = Math.max(0, Math.min((this.mapWidth * this.tileSize * this.zoom) - this.canvas.width, this.camera.x));
        this.camera.y = Math.max(0, Math.min((this.mapHeight * this.tileSize * this.zoom) - this.canvas.height, this.camera.y));
    }





    harvestResource(x, y) {
        const resource = this.resources.find(r => r.x === x && r.y === y);
        if (resource) {
            const resourceType = resource.type === 'tree' ? 'wood' : 'iron';
            this.resources.splice(this.resources.indexOf(resource), 1);
            return resourceType;
        }
        return null;
    }

    pickupDroppedResource(x, y, addToInventory = true) {
        const droppedResource = this.droppedResources.find(r => r.x === x && r.y === y);
        if (droppedResource) {
            this.droppedResources.splice(this.droppedResources.indexOf(droppedResource), 1);
            this.updateUI();
            return droppedResource.type;
        }
        return null;
    }

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

    craftItem(itemType) {
        const recipes = {
            food: { wood: 1 },
            tools: { iron: 2, wood: 1 }
        };

        const recipe = recipes[itemType];
        if (!recipe) return false;

        // Find a pawn with enough resources to craft
        let craftingPawn = null;
        for (const pawn of this.pawns) {
            let hasAllResources = true;
            for (const [resource, amount] of Object.entries(recipe)) {
                if (!hasInventoryItem(pawn.inventory, resource, amount)) {
                    hasAllResources = false;
                    break;
                }
            }
            if (hasAllResources) {
                craftingPawn = pawn;
                break;
            }
        }

        if (!craftingPawn) return false;

        // Consume resources from pawn's inventory
        for (const [resource, amount] of Object.entries(recipe)) {
            removeFromInventory(craftingPawn.inventory, resource, amount);
        }

        // Add crafted item to pawn's inventory
        addToInventory(craftingPawn.inventory, itemType, 1);
        this.updateUI();
        return true;
    }

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

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Render map
        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                const screenX = x * this.tileSize * this.zoom - this.camera.x;
                const screenY = y * this.tileSize * this.zoom - this.camera.y;
                const tileSizeZoomed = this.tileSize * this.zoom;

                if (screenX + tileSizeZoomed < 0 || screenX > this.canvas.width ||
                    screenY + tileSizeZoomed < 0 || screenY > this.canvas.height) {
                    continue;
                }

                // Draw tile
                if (this.spriteSheetLoaded && this.spriteSheet) {
                    const sprite = this.getTileSprite(this.map[y][x]);
                    if (sprite) {
                        const sourceX = sprite.column * this.spriteConfig.tileWidth;
                        const sourceY = sprite.row * this.spriteConfig.tileHeight;
                        this.ctx.drawImage(
                            this.spriteSheet,
                            sourceX, sourceY, this.spriteConfig.tileWidth, this.spriteConfig.tileHeight,
                            screenX, screenY, tileSizeZoomed, tileSizeZoomed
                        );
                    } else {
                        // Fallback to solid color if sprite not found
                        this.ctx.fillStyle = this.getTileColor(this.map[y][x]);
                        this.ctx.fillRect(screenX, screenY, tileSizeZoomed, tileSizeZoomed);
                    }
                } else {
                    // Fallback to solid color if sprite sheet not loaded
                    this.ctx.fillStyle = this.getTileColor(this.map[y][x]);
                    this.ctx.fillRect(screenX, screenY, tileSizeZoomed, tileSizeZoomed);
                }

                // Draw grid
                this.ctx.strokeStyle = '#2c3e50';
                this.ctx.strokeRect(screenX, screenY, tileSizeZoomed, tileSizeZoomed);
            }
        }

        // Render resources
        for (const resource of this.resources) {
            const screenX = resource.x * this.tileSize * this.zoom - this.camera.x;
            const screenY = resource.y * this.tileSize * this.zoom - this.camera.y;
            const tileSizeZoomed = this.tileSize * this.zoom;

            // Check if this resource is in the task queue
            const isQueued = this.taskQueue.some(task =>
                task.x === resource.x && task.y === resource.y
            );

            // Base color
            let baseColor = resource.type === 'tree' ? '#27ae60' : '#95a5a6';

            // Highlight if queued
            if (isQueued) {
                baseColor = resource.type === 'tree' ? '#2ecc71' : '#95a5a6';
                // Add a border to show it's queued
                this.ctx.strokeStyle = '#f1c40f';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(screenX + 2 * this.zoom, screenY + 2 * this.zoom, tileSizeZoomed - 4 * this.zoom, tileSizeZoomed - 4 * this.zoom);
                // Draw appropriate icon
                if (resource.type === 'tree') {
                    this.drawChopIcon(screenX + 2 * this.zoom, screenY + 20 * this.zoom);
                } else {
                    this.drawMineIcon(screenX + 2 * this.zoom, screenY + 20 * this.zoom);
                }
            }

            this.ctx.fillStyle = baseColor;
            this.ctx.fillRect(screenX + 4 * this.zoom, screenY + 4 * this.zoom, tileSizeZoomed - 8 * this.zoom, tileSizeZoomed - 8 * this.zoom);
        }

        // Render dropped resources
        for (const droppedResource of this.droppedResources) {
            const screenX = droppedResource.x * this.tileSize * this.zoom - this.camera.x;
            const screenY = droppedResource.y * this.tileSize * this.zoom - this.camera.y;
            const tileSizeZoomed = this.tileSize * this.zoom;

            // Check if this dropped resource is in the task queue
            const isQueued = this.taskQueue.some(task =>
                task.x === droppedResource.x && task.y === droppedResource.y && task.type === 'haul'
            );

            // Base color
            let baseColor = droppedResource.type === 'wood' ? '#8b4513' : '#c0c0c0';

            // Highlight if queued
            if (isQueued) {
                baseColor = droppedResource.type === 'wood' ? '#a0522d' : '#d3d3d3';
                // Add a border to show it's queued
                this.ctx.strokeStyle = '#f1c40f';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(screenX + 6 * this.zoom, screenY + 6 * this.zoom, tileSizeZoomed - 12 * this.zoom, tileSizeZoomed - 12 * this.zoom);
                // Draw haul icon
                this.drawHaulIcon(screenX + 6 * this.zoom, screenY + 20 * this.zoom);
            }

            this.ctx.fillStyle = baseColor;
            this.ctx.fillRect(screenX + 8 * this.zoom, screenY + 8 * this.zoom, tileSizeZoomed - 16 * this.zoom, tileSizeZoomed - 16 * this.zoom);
        }

        // Render plants
        for (const plant of this.plants) {
            const screenX = plant.x * this.tileSize * this.zoom - this.camera.x;
            const screenY = plant.y * this.tileSize * this.zoom - this.camera.y;
            const tileSizeZoomed = this.tileSize * this.zoom;

            // Check if this plant is in the task queue
            const isQueued = this.taskQueue.some(task =>
                task.x === plant.x && task.y === plant.y && task.type === 'harvest_plant'
            );

            let color = '#90EE90';
            if (plant.growth > 50) color = '#32CD32';

            // Highlight if queued
            if (isQueued) {
                color = plant.growth > 50 ? '#228B22' : '#66CDAA';
                // Add a border to show it's queued
                this.ctx.strokeStyle = '#f1c40f';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(screenX + 4 * this.zoom, screenY + 4 * this.zoom, tileSizeZoomed - 8 * this.zoom, tileSizeZoomed - 8 * this.zoom);
                // Draw harvest icon
                this.drawHarvestIcon(screenX + 4 * this.zoom, screenY + 20 * this.zoom);
            }

            this.ctx.fillStyle = color;
            this.ctx.fillRect(screenX + 6 * this.zoom, screenY + 6 * this.zoom, tileSizeZoomed - 12 * this.zoom, tileSizeZoomed - 12 * this.zoom);
        }

        // Render buildings
        for (const building of this.buildings) {
            const screenX = building.x * this.tileSize * this.zoom - this.camera.x;
            const screenY = building.y * this.tileSize * this.zoom - this.camera.y;
            const tileSizeZoomed = this.tileSize * this.zoom;
            this.ctx.fillStyle = building.type === 'wall' ? '#8e44ad' : '#e67e22';
            this.ctx.fillRect(screenX, screenY, tileSizeZoomed, tileSizeZoomed);
        }

        // Render pawns
        for (const pawn of this.pawns) {
            const screenX = pawn.x * this.tileSize * this.zoom - this.camera.x;
            const screenY = pawn.y * this.tileSize * this.zoom - this.camera.y;
            const tileSizeZoomed = this.tileSize * this.zoom;
            this.ctx.fillStyle = '#f39c12';
            this.ctx.fillRect(screenX + 4 * this.zoom, screenY + 4 * this.zoom, tileSizeZoomed - 8 * this.zoom, tileSizeZoomed - 8 * this.zoom);
        }

        // Highlight selected tile
        if (this.selectedTile) {
            const screenX = this.selectedTile.x * this.tileSize * this.zoom - this.camera.x;
            const screenY = this.selectedTile.y * this.tileSize * this.zoom - this.camera.y;
            const tileSizeZoomed = this.tileSize * this.zoom;
            this.ctx.strokeStyle = '#e74c3c';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(screenX, screenY, tileSizeZoomed, tileSizeZoomed);
        }

        // Highlight hovered tile
        if (this.hoveredTile) {
            const screenX = this.hoveredTile.x * this.tileSize * this.zoom - this.camera.x;
            const screenY = this.hoveredTile.y * this.tileSize * this.zoom - this.camera.y;
            const tileSizeZoomed = this.tileSize * this.zoom;
            this.ctx.strokeStyle = '#3498db';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(screenX, screenY, tileSizeZoomed, tileSizeZoomed);
        }

        // Render selection area
        if (this.areaSelection) {
            const startX = Math.min(this.areaSelection.start.x, this.areaSelection.end.x);
            const endX = Math.max(this.areaSelection.start.x, this.areaSelection.end.x);
            const startY = Math.min(this.areaSelection.start.y, this.areaSelection.end.y);
            const endY = Math.max(this.areaSelection.start.y, this.areaSelection.end.y);

            const screenStartX = startX * this.tileSize * this.zoom - this.camera.x;
            const screenStartY = startY * this.tileSize * this.zoom - this.camera.y;
            const width = (endX - startX + 1) * this.tileSize * this.zoom;
            const height = (endY - startY + 1) * this.tileSize * this.zoom;

            this.ctx.strokeStyle = '#f1c40f';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(screenStartX, screenStartY, width, height);

            this.ctx.fillStyle = 'rgba(241, 196, 15, 0.2)';
            this.ctx.fillRect(screenStartX, screenStartY, width, height);
        }

        // Render storage area
        if (this.storageArea) {
            const startX = Math.min(this.storageArea.start.x, this.storageArea.end.x);
            const endX = Math.max(this.storageArea.start.x, this.storageArea.end.x);
            const startY = Math.min(this.storageArea.start.y, this.storageArea.end.y);
            const endY = Math.max(this.storageArea.start.y, this.storageArea.end.y);

            const screenStartX = startX * this.tileSize * this.zoom - this.camera.x;
            const screenStartY = startY * this.tileSize * this.zoom - this.camera.y;
            const width = (endX - startX + 1) * this.tileSize * this.zoom;
            const height = (endY - startY + 1) * this.tileSize * this.zoom;

            this.ctx.strokeStyle = '#f4d03f';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(screenStartX, screenStartY, width, height);

            this.ctx.fillStyle = 'rgba(244, 208, 63, 0.1)';
            this.ctx.fillRect(screenStartX, screenStartY, width, height);
        }
    }

    drawHarvestIcon(x, y) {
        // Draw a larger scythe icon at bottom left
        this.ctx.fillStyle = '#f1c40f';
        this.ctx.font = `${16 * this.zoom}px Arial`;
        this.ctx.fillText('⚒', x, y);
    }

    drawChopIcon(x, y) {
        // Draw a larger axe icon
        this.ctx.fillStyle = '#f1c40f';
        this.ctx.font = `${16 * this.zoom}px Arial`;
        this.ctx.fillText('🪓', x, y);
    }

    drawMineIcon(x, y) {
        // Draw a larger pickaxe icon
        this.ctx.fillStyle = '#f1c40f';
        this.ctx.font = `${16 * this.zoom}px Arial`;
        this.ctx.fillText('⛏', x, y);
    }

    drawHaulIcon(x, y) {
        // Draw a larger hand icon
        this.ctx.fillStyle = '#f1c40f';
        this.ctx.font = `${16 * this.zoom}px Arial`;
        this.ctx.fillText('👐', x, y);
    }

    getTileSprite(type) {
        // Map tile types to sprite names
        const spriteMap = {
            'grass': 'grass',
            'dirt': 'sand', // Use sand sprite for dirt tiles
            'stone': 'stone'
        };

        const spriteName = spriteMap[type] || 'grass'; // Default to grass
        return this.spriteConfig.images[spriteName];
    }

    getTileColor(type) {
        switch (type) {
            case 'grass': return '#2ecc71';
            case 'dirt': return '#d35400';
            case 'stone': return '#7f8c8d';
            default: return '#34495e';
        }
    }

    updateUI() {
        // Update pawn list
        const pawnList = document.getElementById('pawn-list');
        const existingItems = Array.from(pawnList.querySelectorAll('.pawn-item'));
        for (let i = 0; i < this.pawns.length; i++) {
            let pawnItem;
            if (i < existingItems.length) {
                pawnItem = existingItems[i];
            } else {
                pawnItem = document.createElement('div');
                pawnItem.className = 'pawn-item';
                pawnItem.style.cursor = 'pointer';
                pawnList.appendChild(pawnItem);
            }
            const pawn = this.pawns[i];
            const taskText = pawn.task ? ` - Task: ${pawn.task.type} (${pawn.task.x}, ${pawn.task.y})` : ' - Idle';
            pawnItem.textContent = `${pawn.name} - Hunger: ${Math.round(pawn.hunger)}, Sleep: ${Math.round(pawn.sleep)}${taskText}`;
            pawnItem.dataset.pawnIndex = i;
        }
        for (let i = this.pawns.length; i < existingItems.length; i++) {
            pawnList.removeChild(existingItems[i]);
        }

        // Add event listener to pawn-info for delegation (only once)
        const pawnInfo = document.getElementById('pawn-info');
        if (!pawnInfo.hasPawnClickListener) {
            pawnInfo.addEventListener('click', (e) => {
                let element = e.target;
                while (element && element !== pawnInfo) {
                    if (element.classList && element.classList.contains('pawn-item')) {
                        const index = parseInt(element.dataset.pawnIndex);
                        if (index >= 0 && index < this.pawns.length) {
                            this.focusCameraOnPawn(this.pawns[index]);
                        }
                        break;
                    }
                    element = element.parentElement;
                }
            });
            pawnInfo.hasPawnClickListener = true;
        }

        // Update task queue
        const taskList = document.getElementById('task-list');
        taskList.innerHTML = '';
        if (this.taskQueue.length === 0) {
            const noTasks = document.createElement('div');
            noTasks.className = 'resource-item';
            noTasks.textContent = 'No tasks in queue';
            taskList.appendChild(noTasks);
        } else {
            for (let i = 0; i < Math.min(this.taskQueue.length, 10); i++) {
                const task = this.taskQueue[i];
                const taskItem = document.createElement('div');
                taskItem.className = 'resource-item';
                taskItem.textContent = `${task.type} at (${task.x}, ${task.y})`;
                taskList.appendChild(taskItem);
            }
            if (this.taskQueue.length > 10) {
                const moreTasks = document.createElement('div');
                moreTasks.className = 'resource-item';
                moreTasks.textContent = `... and ${this.taskQueue.length - 10} more tasks`;
                taskList.appendChild(moreTasks);
            }
        }

        // Update pawn inventories
        const resourceList = document.getElementById('resource-list');
        resourceList.innerHTML = '<h3>Pawn Inventories</h3>';
        for (const pawn of this.pawns) {
            if (pawn.inventory.length > 0) {
                const pawnHeader = document.createElement('div');
                pawnHeader.className = 'resource-item';
                pawnHeader.style.fontWeight = 'bold';
                pawnHeader.textContent = `${pawn.name}:`;
                resourceList.appendChild(pawnHeader);

                for (const item of pawn.inventory) {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'resource-item';
                    itemDiv.style.marginLeft = '10px';
                    itemDiv.textContent = `${item.tag}: ${item.quantity}`;
                    resourceList.appendChild(itemDiv);
                }
            }
        }

        // Update crafted items list (now shows all crafted items across pawns)
        const craftedList = document.getElementById('crafted-list');
        craftedList.innerHTML = '<h3>All Crafted Items</h3>';
        let totalFood = 0;
        let totalTools = 0;
        for (const pawn of this.pawns) {
            for (const item of pawn.inventory) {
                if (item.tag === 'food') totalFood += item.quantity;
                if (item.tag === 'tools') totalTools += item.quantity;
            }
        }
        if (totalFood > 0) {
            const foodItem = document.createElement('div');
            foodItem.className = 'resource-item';
            foodItem.textContent = `food: ${totalFood}`;
            craftedList.appendChild(foodItem);
        }
        if (totalTools > 0) {
            const toolsItem = document.createElement('div');
            toolsItem.className = 'resource-item';
            toolsItem.textContent = `tools: ${totalTools}`;
            craftedList.appendChild(toolsItem);
        }

        // Update tile inventory display (show dropped resources on tile)
        const tileInventoryDiv = document.getElementById('tile-inventory');
        if (this.hoveredTile) {
            const { x, y } = this.hoveredTile;
            const droppedResourcesOnTile = this.droppedResources.filter(r => r.x === x && r.y === y);
            tileInventoryDiv.innerHTML = `<h3>Tile (${x}, ${y})</h3>`;
            if (droppedResourcesOnTile.length === 0) {
                tileInventoryDiv.innerHTML += '<div class="resource-item">Empty</div>';
            } else {
                for (const resource of droppedResourcesOnTile) {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'resource-item';
                    itemDiv.textContent = `${resource.type}: 1`;
                    tileInventoryDiv.appendChild(itemDiv);
                }
            }
        } else {
            tileInventoryDiv.innerHTML = '<h3>Tile Inventory</h3><div class="resource-item">Hover over a tile</div>';
        }
    }

    getNearestAvailableTask(pawn) {
        if (this.taskQueue.length === 0) return null;

        let nearestTask = null;
        let minDistance = Infinity;

        for (const task of this.taskQueue) {
            const distance = Math.sqrt((pawn.x - task.x) ** 2 + (pawn.y - task.y) ** 2);
            if (distance < minDistance) {
                minDistance = distance;
                nearestTask = task;
            }
        }

        return nearestTask;
    }

    gameLoop() {
        this.update();
        this.render();
        this.updateUI();
        requestAnimationFrame(() => this.gameLoop());
    }
}
