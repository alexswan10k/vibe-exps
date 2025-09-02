/**
 * Pawn class representing colonists in the game
 */
class Pawn {
    /**
     * @param {number} x - Initial X coordinate
     * @param {number} y - Initial Y coordinate
     * @param {string} name - Name of the pawn
     */
    constructor(x, y, name) {
        this.x = x;
        this.y = y;
        this.name = name;
        this.hunger = 100;
        this.sleep = 100;
        this.task = null;
        this.speed = 0.05;
        this.inventory = []; // Array of {tag, quantity}
        this.maxWeight = 50; // Maximum weight a pawn can carry
    }

    /**
     * Update the pawn's state
     * @param {Game} game - Reference to the game instance
     */
    update(game) {
        // Decrease needs over time
        this.hunger = Math.max(0, this.hunger - 0.1);
        this.sleep = Math.max(0, this.sleep - 0.05);

        // Handle critical needs
        if (this.hunger < 20 && hasInventoryItem(this.inventory, 'food', 1)) {
            this.eat(game);
        } else if (this.sleep < 20) {
            this.sleepAction();
        } else if (this.task) {
            this.executeTask(game);
        } else {
            // Try to pick up the nearest available task from the queue
            if (game.taskQueue.length > 0) {
                const nearestTask = game.getNearestAvailableTask(this);
                if (nearestTask) {
                    // Remove the task from the queue
                    const taskIndex = game.taskQueue.indexOf(nearestTask);
                    if (taskIndex > -1) {
                        game.taskQueue.splice(taskIndex, 1);
                        this.assignTask(nearestTask);
                    }
                }
            } else {
                // Check for implicit hauling tasks
                const haulingTask = this.findImplicitHaulingTask(game);
                if (haulingTask) {
                    this.assignTask(haulingTask);
                } else {
                    // Idle behavior - wander randomly
                    if (Math.random() < 0.01) {
                        this.x += (Math.random() - 0.5) * 2;
                        this.y += (Math.random() - 0.5) * 2;
                        this.x = clamp(this.x, 0, game.mapWidth - 1);
                        this.y = clamp(this.y, 0, game.mapHeight - 1);
                    }
                }
            }
        }
    }

    /**
     * Make the pawn eat food
     * @param {Game} game - Reference to the game instance
     */
    eat(game) {
        if (hasInventoryItem(this.inventory, 'food', 1)) {
            removeFromInventory(this.inventory, 'food', 1);
            this.hunger = Math.min(100, this.hunger + 50);
        }
    }

    /**
     * Handle sleep recovery
     */
    sleepAction() {
        // Simple sleep recovery
        this.sleep = Math.min(100, this.sleep + 0.5);
    }

    /**
     * Assign a task to this pawn
     * @param {Task} task - The task to assign
     */
    assignTask(task) {
        this.task = task;
    }

    /**
     * Execute the current task
     * @param {Game} game - Reference to the game instance
     */
    executeTask(game) {
        const dx = this.task.x - this.x;
        const dy = this.task.y - this.y;
        const distance = calculateDistance(this.x, this.y, this.task.x, this.task.y);

        if (distance < 0.1) {
            // Arrived at destination
            this.performTaskAtLocation(game);
        } else {
            // Move towards destination
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
        }
    }

    /**
     * Perform the task at the current location
     * @param {Game} game - Reference to the game instance
     */
    performTaskAtLocation(game) {
        switch (this.task.type) {
            case 'chop':
            case 'mine':
                this.performHarvestTask(game);
                break;
            case 'haul':
                this.performHaulTask(game);
                break;
            case 'haul_to_storage':
                this.performHaulToStorageTask(game);
                break;
            case 'mine_stone':
                this.performMineStoneTask(game);
                break;
            case 'harvest_plant':
                this.performHarvestPlantTask(game);
                break;
            default:
                this.task.completed = true;
                this.task = null;
        }
    }

    /**
     * Perform harvesting task (chop/mine)
     * @param {Game} game - Reference to the game instance
     */
    performHarvestTask(game) {
        // Harvest the resource
        const type = game.harvestResource(this.task.x, this.task.y);
        if (type) {
            // Always drop the item on the ground by default
            game.droppedResources.push({ x: this.task.x, y: this.task.y, type: type });

            this.task.completed = true;
            this.task = null;
            game.updateUI();
        } else {
            this.task.completed = true;
            this.task = null;
        }
    }

    /**
     * Perform hauling task
     * @param {Game} game - Reference to the game instance
     */
    performHaulTask(game) {
        const carryingType = game.pickupDroppedResource(this.task.x, this.task.y, false);
        if (carryingType && this.canCarryItem(game, carryingType)) {
            addToInventory(this.inventory, carryingType, 1);
            // Drop the item at the pawn's current location since there's no centralized storage
            game.droppedResources.push({ x: Math.floor(this.x), y: Math.floor(this.y), type: carryingType });
            removeFromInventory(this.inventory, carryingType, 1);
            this.task.completed = true;
            this.task = null;
        } else {
            this.task.completed = true;
            this.task = null;
        }
    }

    /**
     * Perform hauling to storage task
     * @param {Game} game - Reference to the game instance
     */
    performHaulToStorageTask(game) {
        const carryingType = game.pickupDroppedResource(this.task.x, this.task.y, false);
        if (carryingType && this.canCarryItem(game, carryingType)) {
            addToInventory(this.inventory, carryingType, 1);

            // Find a storage location to drop the item
            const storageStartX = Math.min(game.storageArea.start.x, game.storageArea.end.x);
            const storageEndX = Math.max(game.storageArea.start.x, game.storageArea.end.x);
            const storageStartY = Math.min(game.storageArea.start.y, game.storageArea.end.y);
            const storageEndY = Math.max(game.storageArea.start.y, game.storageArea.end.y);

            // Pick a random spot in the storage area
            const dropX = storageStartX + Math.floor(Math.random() * (storageEndX - storageStartX + 1));
            const dropY = storageStartY + Math.floor(Math.random() * (storageEndY - storageStartY + 1));

            // Drop the item in storage
            game.droppedResources.push({ x: dropX, y: dropY, type: carryingType });
            removeFromInventory(this.inventory, carryingType, 1);
            this.task.completed = true;
            this.task = null;
            game.updateUI();
        } else {
            this.task.completed = true;
            this.task = null;
        }
    }



    /**
     * Perform stone mining task
     * @param {Game} game - Reference to the game instance
     */
    performMineStoneTask(game) {
        // Mine stone terrain
        if (game.map[this.task.y][this.task.x] === 'stone') {
            game.map[this.task.y][this.task.x] = 'dirt';
            // Always drop the stone on the ground by default
            game.droppedResources.push({ x: this.task.x, y: this.task.y, type: 'stone' });

            this.task.completed = true;
            this.task = null;
            game.updateUI();
        } else {
            this.task.completed = true;
            this.task = null;
        }
    }

    /**
     * Perform plant harvesting task
     * @param {Game} game - Reference to the game instance
     */
    performHarvestPlantTask(game) {
        // Harvest mature plant
        const plant = game.plants.find(p => p.x === this.task.x && p.y === this.task.y);
        if (plant && plant.isMature()) {
            // Always drop the food on the ground by default
            game.droppedResources.push({ x: this.task.x, y: this.task.y, type: 'food' });

            game.plants.splice(game.plants.indexOf(plant), 1);
            game.updateUI();
        }
        this.task.completed = true;
        this.task = null;
    }

    /**
     * Calculate the current weight of the pawn's inventory
     * @param {Game} game - Reference to the game instance
     * @returns {number} - Current total weight
     */
    getCurrentWeight(game) {
        let totalWeight = 0;
        for (const item of this.inventory) {
            const itemWeight = game.itemLookup[item.tag]?.weight || 1;
            totalWeight += itemWeight * item.quantity;
        }
        return totalWeight;
    }

    /**
     * Check if the pawn can carry an additional item
     * @param {Game} game - Reference to the game instance
     * @param {string} itemType - The type of item to check
     * @returns {boolean} - Whether the pawn can carry the item
     */
    canCarryItem(game, itemType) {
        const itemWeight = game.itemLookup[itemType]?.weight || 1;
        return this.getCurrentWeight(game) + itemWeight <= this.maxWeight;
    }

    /**
     * Find implicit hauling tasks based on priorities
     * @param {Game} game - Reference to the game instance
     * @returns {Task|null} - The hauling task to perform
     */
    findImplicitHaulingTask(game) {
        if (!game.storageArea) return null;

        // Find the nearest dropped resource that we can carry
        let nearestResource = null;
        let minDistance = Infinity;

        for (const resource of game.droppedResources) {
            if (this.canCarryItem(game, resource.type)) {
                const distance = calculateDistance(this.x, this.y, resource.x, resource.y);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestResource = resource;
                }
            }
        }

        if (nearestResource) {
            // Check if the resource is already in the storage area
            const storageStartX = Math.min(game.storageArea.start.x, game.storageArea.end.x);
            const storageEndX = Math.max(game.storageArea.start.x, game.storageArea.end.x);
            const storageStartY = Math.min(game.storageArea.start.y, game.storageArea.end.y);
            const storageEndY = Math.max(game.storageArea.start.y, game.storageArea.end.y);

            const isInStorage = nearestResource.x >= storageStartX && nearestResource.x <= storageEndX &&
                               nearestResource.y >= storageStartY && nearestResource.y <= storageEndY;

            if (!isInStorage) {
                // Create a hauling task to pick up the resource
                return {
                    x: nearestResource.x,
                    y: nearestResource.y,
                    type: 'haul_to_storage',
                    resource: nearestResource
                };
            }
        }

        return null;
    }
}
