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
        if (this.hunger < 20 && hasInventoryItem(game.craftedItems, 'food', 1)) {
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

    /**
     * Make the pawn eat food
     * @param {Game} game - Reference to the game instance
     */
    eat(game) {
        if (hasInventoryItem(game.craftedItems, 'food', 1)) {
            removeFromInventory(game.craftedItems, 'food', 1);
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
            case 'move_to_storage':
                this.performStorageTask(game);
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
            addToInventory(this.inventory, type, 1);
            if (game.storageArea) {
                const center = getAreaCenter(game.storageArea);
                this.task.x = center.x;
                this.task.y = center.y;
                this.task.type = 'move_to_storage';
            } else {
                addToInventory(game.resourcesInventory, type, 1);
                removeFromInventory(this.inventory, type, 1);
                this.task.completed = true;
                this.task = null;
            }
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
        if (carryingType) {
            addToInventory(this.inventory, carryingType, 1);
            if (this.task.destination) {
                this.task.x = this.task.destination.x;
                this.task.y = this.task.destination.y;
                this.task.type = 'move_to_storage';
            } else {
                addToInventory(game.resourcesInventory, carryingType, 1);
                removeFromInventory(this.inventory, carryingType, 1);
                this.task.completed = true;
                this.task = null;
            }
        } else {
            this.task.completed = true;
            this.task = null;
        }
    }

    /**
     * Perform storage task (transfer items to central storage)
     * @param {Game} game - Reference to the game instance
     */
    performStorageTask(game) {
        // Transfer all items from pawn inventory to central storage
        for (const item of this.inventory) {
            addToInventory(game.resourcesInventory, item.tag, item.quantity);
        }
        this.inventory = [];
        this.task.completed = true;
        this.task = null;
    }

    /**
     * Perform stone mining task
     * @param {Game} game - Reference to the game instance
     */
    performMineStoneTask(game) {
        // Mine stone terrain
        if (game.map[this.task.y][this.task.x] === 'stone') {
            game.map[this.task.y][this.task.x] = 'dirt';
            addToInventory(this.inventory, 'stone', 1);
            if (game.storageArea) {
                const center = getAreaCenter(game.storageArea);
                this.task.x = center.x;
                this.task.y = center.y;
                this.task.type = 'move_to_storage';
            } else {
                addToInventory(game.resourcesInventory, 'stone', 1);
                removeFromInventory(this.inventory, 'stone', 1);
                this.task.completed = true;
                this.task = null;
            }
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
            addToInventory(game.craftedItems, 'food', 1);
            game.plants.splice(game.plants.indexOf(plant), 1);
            game.updateUI();
        }
        this.task.completed = true;
        this.task = null;
    }
}
