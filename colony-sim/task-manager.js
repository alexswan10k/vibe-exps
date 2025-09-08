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
        this.game.currentTaskType = taskType;
        this.game.buildMode = null;
        this.game.canvas.style.cursor = 'crosshair';
        this.game.uiManager.updateModeIndicator();
        this.game.uiManager.updateButtonStates();
    }

    /**
     * Set storage mode
     */
    setStorageMode() {
        this.game.currentTaskType = 'storage';
        this.game.buildMode = null;
        this.game.canvas.style.cursor = 'crosshair';
        this.game.uiManager.updateModeIndicator();
        this.game.uiManager.updateButtonStates();
    }

    /**
     * Create tasks from selected area
     */
    createTasksFromArea() {
        if (!this.game.areaSelection) return;

        const startX = Math.min(this.game.areaSelection.start.x, this.game.areaSelection.end.x);
        const endX = Math.max(this.game.areaSelection.start.x, this.game.areaSelection.end.x);
        const startY = Math.min(this.game.areaSelection.start.y, this.game.areaSelection.end.y);
        const endY = Math.max(this.game.areaSelection.start.y, this.game.areaSelection.end.y);

        if (this.game.currentTaskType === 'mine_stone') {
            // For mining stone, look for stone terrain
            for (let y = startY; y <= endY; y++) {
                for (let x = startX; x <= endX; x++) {
                    if (this.game.map[y][x] === 'stone') {
                        this.game.taskQueue.push({
                            x: x,
                            y: y,
                            type: this.game.currentTaskType
                        });
                    }
                }
            }
        } else if (this.game.currentTaskType === 'harvest_plant') {
            // For harvesting plants, look for mature plants
            for (let y = startY; y <= endY; y++) {
                for (let x = startX; x <= endX; x++) {
                    const plant = this.game.plants.find(p => p.x === x && p.y === y);
                    if (plant && plant.growth >= 50) {
                        this.game.taskQueue.push({
                            x: x,
                            y: y,
                            type: this.game.currentTaskType,
                            plant: plant
                        });
                    }
                }
            }
        } else {
            // For chopping/mining, look for standing resources
            for (let y = startY; y <= endY; y++) {
                for (let x = startX; x <= endX; x++) {
                    const resource = this.game.resources.find(r => r.x === x && r.y === y);
                    if (resource) {
                        if ((this.game.currentTaskType === 'chop' && resource.type === 'tree') ||
                            (this.game.currentTaskType === 'mine' && resource.type === 'iron')) {
                            this.game.taskQueue.push({
                                x: x,
                                y: y,
                                type: this.game.currentTaskType,
                                resource: resource
                            });
                        }
                    }
                }
            }
        }
    }

    /**
     * Build in selected area
     */
    buildInArea() {
        if (!this.game.areaSelection) return;

        const startX = Math.min(this.game.areaSelection.start.x, this.game.areaSelection.end.x);
        const endX = Math.max(this.game.areaSelection.start.x, this.game.areaSelection.end.x);
        const startY = Math.min(this.game.areaSelection.start.y, this.game.areaSelection.end.y);
        const endY = Math.max(this.game.areaSelection.start.y, this.game.areaSelection.end.y);

        if (this.game.buildMode === 'wall') {
            // Find a pawn with wood to build walls
            const builderPawn = this.game.pawns.find(pawn => hasInventoryItem(pawn.inventory, 'wood', 1));
            if (builderPawn) {
                for (let y = startY; y <= endY; y++) {
                    for (let x = startX; x <= endX; x++) {
                        if (hasInventoryItem(builderPawn.inventory, 'wood', 1)) {
                            this.game.buildings.push(new Building(x, y, 'wall'));
                            removeFromInventory(builderPawn.inventory, 'wood', 1);
                        }
                    }
                }
                this.game.uiManager.updateUI();
            }
        } else if (this.game.buildMode === 'table') {
            // Find a pawn with enough wood to build a table
            const builderPawn = this.game.pawns.find(pawn => hasInventoryItem(pawn.inventory, 'wood', 5));
            if (builderPawn) {
                const center = getAreaCenter(this.game.areaSelection);
                this.game.buildings.push(new Building(center.x, center.y, 'table'));
                removeFromInventory(builderPawn.inventory, 'wood', 5);
                this.game.uiManager.updateUI();
            }
        }
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
            const distance = calculateDistance(pawn.x, pawn.y, task.x, task.y);
            if (distance < minDistance) {
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
        const recipes = {
            food: { wood: 1 },
            tools: { iron: 2, wood: 1 }
        };

        const recipe = recipes[itemType];
        if (!recipe) return false;

        // Find a pawn with enough resources to craft
        let craftingPawn = null;
        for (const pawn of this.game.pawns) {
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
        this.game.uiManager.updateUI();
        return true;
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
        if (this.game.map[y][x] === 'stone') {
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
}
