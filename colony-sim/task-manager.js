/**
 * TaskManager class for handling task creation and assignment
 */
class TaskManager {
    /**
     * @param {Game} game - Reference to the game instance
     */
    constructor(game) {
        this.game = game;
    }

    /**
     * Set task mode
     * @param {string} taskType - Type of task to set
     */
    setTaskMode(taskType) {
        this.setMode(taskType, null);
    }

    /**
     * Set storage mode
     */
    setStorageMode() {
        this.setMode('storage', null);
    }

    /**
     * Set current mode and update UI
     * @param {string} taskType - Task type to set
     * @param {string} buildMode - Build mode to set
     */
    setMode(taskType, buildMode) {
        this.game.currentTaskType = taskType;
        this.game.buildMode = buildMode;
        this.game.canvas.style.cursor = 'crosshair';
        this.game.uiManager.updateModeIndicator();
        this.game.uiManager.updateButtonStates();
    }

    /**
     * Create tasks from selected area
     */
    createTasksFromArea() {
        if (!this.game.areaSelection) return;

        const bounds = this.getAreaBounds();
        const taskType = this.game.currentTaskType;

        const taskCreators = {
            mine_stone: (x, y) => this.game.map[y][x] === 'stone' ? { x, y, type: taskType } : null,
            harvest_plant: (x, y) => {
                const plant = this.game.plants.find(p => p.x === x && p.y === y);
                return plant && plant.growth >= 50 ? { x, y, type: taskType, plant } : null;
            },
            chop: (x, y) => {
                const resource = this.game.resources.find(r => r.x === x && r.y === y);
                return resource && resource.type === 'tree' ? { x, y, type: taskType, resource } : null;
            },
            mine: (x, y) => {
                const resource = this.game.resources.find(r => r.x === x && r.y === y);
                return resource && resource.type === 'iron' ? { x, y, type: taskType, resource } : null;
            },
            stockpile_zone: null, // Handled separately
            growing_zone: null // Handled separately
        };

        if (taskType === 'stockpile_zone' || taskType === 'growing_zone') {
            this.createZone(bounds, taskType);
            return;
        }

        const createTask = taskCreators[taskType];
        if (createTask) {
            this.iterateArea(bounds, (x, y) => {
                const task = createTask(x, y);
                if (task) {
                    // Check if this task already exists in the queue
                    const taskExists = this.game.taskQueue.some(existingTask =>
                        existingTask.x === x && existingTask.y === y && existingTask.type === taskType
                    );

                    if (!taskExists) {
                        this.game.taskQueue.push(task);
                    }
                }
            });
        }
    }

    /**
     * Get bounds of selected area
     * @returns {Object} Bounds with startX, endX, startY, endY
     */
    getAreaBounds() {
        const selection = this.game.areaSelection;
        return {
            startX: Math.min(selection.start.x, selection.end.x),
            endX: Math.max(selection.start.x, selection.end.x),
            startY: Math.min(selection.start.y, selection.end.y),
            endY: Math.max(selection.start.y, selection.end.y)
        };
    }

    /**
     * Iterate over area with callback
     * @param {Object} bounds - Area bounds
     * @param {Function} callback - Function to call for each cell (x, y)
     */
    iterateArea(bounds, callback) {
        for (let y = bounds.startY; y <= bounds.endY; y++) {
            for (let x = bounds.startX; x <= bounds.endX; x++) {
                callback(x, y);
            }
        }
    }

    /**
     * Build in selected area
     */
    buildInArea() {
        if (!this.game.areaSelection) return;

        const bounds = this.getAreaBounds();
        const buildMode = this.game.buildMode;

        if (buildMode === 'wall') {
            this.buildWalls(bounds);
        } else if (buildMode === 'table') {
            this.buildTable(bounds);
        }
    }

    /**
     * Build walls in the specified area
     * @param {Object} bounds - Area bounds
     */
    buildWalls(bounds) {
        const builderPawn = this.findPawnWithResources('wood', 1);
        if (!builderPawn) return;

        let wallsBuilt = 0;
        this.iterateArea(bounds, (x, y) => {
            if (hasInventoryItem(builderPawn.inventory, 'wood', 1)) {
                // Check if there's already a building at this location
                const existingBuilding = this.game.buildings.find(b => b.x === x && b.y === y);
                if (!existingBuilding) {
                    this.game.buildings.push(new Building(x, y, 'wall'));
                    removeFromInventory(builderPawn.inventory, 'wood', 1);
                    wallsBuilt++;
                }
            }
        });

        if (wallsBuilt > 0) {
            this.game.uiManager.updateUI();
        }
    }

    /**
     * Build a table at the center of the area
     * @param {Object} bounds - Area bounds
     */
    buildTable(bounds) {
        const builderPawn = this.findPawnWithResources('wood', 5);
        if (!builderPawn) return;

        const center = getAreaCenter(this.game.areaSelection);

        // Check if there's already a building at this location
        const existingBuilding = this.game.buildings.find(b => b.x === center.x && b.y === center.y);
        if (!existingBuilding) {
            this.game.buildings.push(new Building(center.x, center.y, 'table'));
            removeFromInventory(builderPawn.inventory, 'wood', 5);
            this.game.uiManager.updateUI();
        }
    }

    /**
     * Find a pawn with sufficient resources
     * @param {string} resourceType - Type of resource needed
     * @param {number} amount - Amount required
     * @returns {Pawn|null} Pawn with resources or null
     */
    findPawnWithResources(resourceType, amount) {
        return this.game.pawns.find(pawn => hasInventoryItem(pawn.inventory, resourceType, amount));
    }

    /**
     * Cancel current selection
     */
    cancelSelection() {
        if (this.game.isSelectingArea || this.game.currentTaskType || this.game.buildMode) {
            this.game.isSelectingArea = false;
            this.game.areaSelection = null;
            this.game.selectionStart = null;
            this.game.currentTaskType = null;
            this.game.buildMode = null;
            this.game.canvas.style.cursor = 'default';
            this.game.uiManager.updateModeIndicator();
            this.game.uiManager.updateButtonStates();
        }
    }

    /**
     * Get nearest available task for a pawn
     * @param {Pawn} pawn - The pawn to find tasks for
     * @returns {Task|null} The nearest available task
     */
    getNearestAvailableTask(pawn) {
        if (this.game.taskQueue.length === 0) return null;

        let nearestTask = null;
        let minDistance = Infinity;

        for (const task of this.game.taskQueue) {
            // Skip tasks that are too far for the pawn to handle
            const distance = calculateDistance(pawn.x, pawn.y, task.x, task.y);
            if (distance < minDistance && distance < 20) { // Limit task distance to prevent pawns going too far
                minDistance = distance;
                nearestTask = task;
            }
        }

        return nearestTask;
    }

    /**
     * Assign task to pawn and remove from queue
     * @param {Pawn} pawn - The pawn to assign the task to
     * @param {Task} task - The task to assign
     */
    assignTaskToPawn(pawn, task) {
        // Remove the task from the queue
        const taskIndex = this.game.taskQueue.indexOf(task);
        if (taskIndex > -1) {
            this.game.taskQueue.splice(taskIndex, 1);
            pawn.assignTask(task);
        }
    }

    /**
     * Craft an item
     * @param {string} itemType - Type of item to craft
     * @returns {boolean} True if crafting was successful
     */
    craftItem(itemType) {
        const recipe = this.getRecipe(itemType);
        if (!recipe) return false;

        const craftingPawn = this.findPawnWithRecipe(recipe);
        if (!craftingPawn) return false;

        this.consumeRecipeResources(craftingPawn, recipe);
        addToInventory(craftingPawn.inventory, itemType, 1);
        this.game.uiManager.updateUI();
        return true;
    }

    /**
     * Get crafting recipe for item type
     * @param {string} itemType - Type of item
     * @returns {Object|null} Recipe object or null
     */
    getRecipe(itemType) {
        const recipes = {
            food: { wood: 1 },
            tools: { iron: 2, wood: 1 }
        };
        return recipes[itemType] || null;
    }

    /**
     * Find a pawn that has all resources for a recipe
     * @param {Object} recipe - Recipe requirements
     * @returns {Pawn|null} Pawn with resources or null
     */
    findPawnWithRecipe(recipe) {
        return this.game.pawns.find(pawn =>
            Object.entries(recipe).every(([resource, amount]) =>
                hasInventoryItem(pawn.inventory, resource, amount)
            )
        );
    }

    /**
     * Consume resources from pawn's inventory for recipe
     * @param {Pawn} pawn - Pawn to consume from
     * @param {Object} recipe - Recipe requirements
     */
    consumeRecipeResources(pawn, recipe) {
        Object.entries(recipe).forEach(([resource, amount]) => {
            removeFromInventory(pawn.inventory, resource, amount);
        });
    }

    /**
     * Harvest resource at location
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {string|null} Type of resource harvested
     */
    harvestResource(x, y) {
        const resource = this.game.resources.find(r => r.x === x && r.y === y);
        if (resource) {
            const resourceType = resource.type === 'tree' ? 'wood' : 'iron';
            this.game.resources.splice(this.game.resources.indexOf(resource), 1);
            return resourceType;
        }
        return null;
    }

    /**
     * Harvest plant at location
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {string|null} Type of resource harvested
     */
    harvestPlant(x, y) {
        const plant = this.game.plants.find(p => p.x === x && p.y === y);
        if (plant && plant.isMature()) {
            this.game.plants.splice(this.game.plants.indexOf(plant), 1);
            return 'food';
        }
        return null;
    }

    /**
     * Mine stone at location
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {string|null} Type of resource mined
     */
    mineStone(x, y) {
        if (this.game.map && this.game.map[y] && this.game.map[y][x] === 'stone') {
            this.game.map[y][x] = 'dirt';
            return 'stone';
        }
        return null;
    }

    /**
     * Drop resource at location
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} type - Type of resource
     * @param {number} quantity - Quantity to drop
     */
    dropResource(x, y, type, quantity = 1) {
        // Validate coordinates
        if (!this.game.map || x < 0 || x >= this.game.mapWidth || y < 0 || y >= this.game.mapHeight) {
            return;
        }

        // Try to stack with existing resources at this location
        const existingStack = this.game.droppedResources.find(r => r.x === x && r.y === y && r.canStack(type, quantity));

        if (existingStack) {
            // Add to existing stack
            const amountAdded = existingStack.addToStack(quantity);
            if (amountAdded < quantity) {
                // If stack is full, create a new stack with remaining quantity
                const remaining = quantity - amountAdded;
                this.game.droppedResources.push(new DroppedResource(x, y, type, remaining));
            }
        } else {
            // Create new stack
            this.game.droppedResources.push(new DroppedResource(x, y, type, quantity));
        }

        this.game.uiManager.updateUI();
    }

    /**
     * Pick up dropped resource at location
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {boolean} addToInventory - Whether to add to inventory
     * @returns {Object|null} Resource pickup result
     */
    pickupDroppedResource(x, y, addToInventory = true) {
        const droppedResource = this.game.droppedResources.find(r => r.x === x && r.y === y);
        if (droppedResource) {
            const resourceType = droppedResource.type;
            const quantity = droppedResource.quantity;

            if (addToInventory) {
                this.game.droppedResources.splice(this.game.droppedResources.indexOf(droppedResource), 1);
                this.game.uiManager.updateUI();
                return { type: resourceType, quantity: quantity };
            } else {
                // For checking if pawn can carry, don't remove yet
                return { type: resourceType, quantity: quantity };
            }
        }
        return null;
    }
    /**
     * Create a zone from bounds
     * @param {Object} bounds 
     * @param {string} type 
     */
    createZone(bounds, type) {
        const width = bounds.endX - bounds.startX + 1;
        const height = bounds.endY - bounds.startY + 1;

        if (type === 'stockpile_zone') {
            this.game.zones.push(new StockpileZone(bounds.startX, bounds.startY, width, height));
            // Update legacy storageArea for compatibility if needed, or just use zones
            this.game.storageArea = { start: { x: bounds.startX, y: bounds.startY }, end: { x: bounds.endX, y: bounds.endY } };
        } else if (type === 'growing_zone') {
            this.game.zones.push(new GrowingZone(bounds.startX, bounds.startY, width, height));
        }

        this.game.uiManager.updateUI();
    }
}
