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
        this.taskCooldown = 0; // Frames to wait before implicit hauling after task completion
        this.lastTaskType = null; // Track last task type to prevent loops

        // Job Priorities (Lower is higher priority, 0 = disabled)
        this.workPriorities = {
            doctor: 1,
            bed_rest: 1,
            warden: 3,
            handle: 3,
            cook: 3,
            hunt: 3,
            construct: 3,
            grow: 3,
            mine: 3,
            plant_cut: 3,
            smith: 3,
            tailor: 3,
            art: 3,
            craft: 3,
            haul: 3,
            clean: 3,
            research: 3
        };
    }

    /**
     * Update the pawn's state
     * @param {Game} game - Reference to the game instance
     */
    update(game) {
        // Update cooldown
        this.taskCooldown = Math.max(0, this.taskCooldown - 1);

        // Decrease needs over time
        this.hunger = Math.max(0, this.hunger - 0.1);
        this.sleep = Math.max(0, this.sleep - 0.05);

        // Handle critical needs
        if (this.hunger < 20 && hasInventoryItem(this.inventory, 'food', 1)) {
            this.eat(game);
        } else if (this.sleep < 20) {
            this.sleepAction(game);
        } else if (this.task) {
            this.executeTask(game);
        } else {
            // Use Priority System to find task
            const priorityTask = this.findPriorityTask(game);
            if (priorityTask) {
                // Remove the task from the queue if it was there
                const taskIndex = game.taskQueue.indexOf(priorityTask);
                if (taskIndex > -1) {
                    game.taskQueue.splice(taskIndex, 1);
                }
                this.assignTask(priorityTask);
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
     * Find the highest priority task available
     * @param {Game} game 
     * @returns {Task|null}
     */
    findPriorityTask(game) {
        // Map work types to task types
        const workTypeMap = {
            construct: ['build'],
            grow: ['harvest_plant'],
            mine: ['mine', 'mine_stone'],
            plant_cut: ['chop'],
            craft: ['craft'],
            haul: ['haul', 'haul_to_storage']
        };

        // Sort priorities (ascending, excluding 0)
        const sortedPriorities = Object.entries(this.workPriorities)
            .filter(([_, priority]) => priority > 0)
            .sort((a, b) => a[1] - b[1]);

        for (const [workType, _] of sortedPriorities) {
            const taskTypes = workTypeMap[workType];
            if (!taskTypes) continue;

            // Find nearest task of these types
            let nearestTask = null;
            let minDistance = Infinity;

            for (const task of game.taskQueue) {
                if (taskTypes.includes(task.type)) {
                    // Skip tasks that are too far for the pawn to handle
                    const distance = calculateDistance(this.x, this.y, task.x, task.y);
                    if (distance < minDistance && distance < 100) { // Increased range
                        minDistance = distance;
                        nearestTask = task;
                    }
                }
            }

            if (nearestTask) return nearestTask;
        }

        // Fallback to implicit hauling if enabled
        if (this.workPriorities.haul > 0) {
            return this.findImplicitHaulingTask(game);
        }

        return null;
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
    /**
     * Handle sleep recovery
     * @param {Game} game
     */
    sleepAction(game) {
        // Find a bed
        let bed = null;
        if (game.buildings) {
            bed = game.buildings.find(b => b.type === 'bed' && (!b.owner || b.owner === this.name));
        }

        if (bed) {
            // Move to bed if not there
            const distance = calculateDistance(this.x, this.y, bed.x, bed.y);
            if (distance > 0.5) {
                this.x += (bed.x - this.x) * 0.1;
                this.y += (bed.y - this.y) * 0.1;
            } else {
                this.sleep = Math.min(100, this.sleep + 1.0); // Faster sleep in bed
            }
        } else {
            // Sleep on ground
            this.sleep = Math.min(100, this.sleep + 0.5);
        }
    }

    /**
     * Assign a task to this pawn
     * @param {Task} task - The task to assign
     */
    assignTask(task) {
        this.task = task;
        this.lastTaskType = task.type;
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
                this.taskCooldown = 60; // Prevent immediate implicit hauling
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
            // Drop the item on the ground (will stack automatically)
            game.dropResource(this.task.x, this.task.y, type, 1);

            // Create a hauling task for the resource if storage area exists
            if (game.storageArea) {
                game.taskQueue.push({
                    x: this.task.x,
                    y: this.task.y,
                    type: 'haul_to_storage',
                    pickedUp: false
                });
            }

            this.task.completed = true;
            this.task = null;
            this.taskCooldown = 60; // Prevent immediate implicit hauling
        } else {
            this.task.completed = true;
            this.task = null;
            this.taskCooldown = 60; // Prevent immediate implicit hauling
        }
    }

    /**
     * Perform hauling task - FIXED to prevent infinite loops
     * @param {Game} game - Reference to the game instance
     */
    performHaulTask(game) {
        const pickupResult = game.pickupDroppedResource(this.task.x, this.task.y, false); // Don't add to inventory yet

        if (pickupResult && this.canCarryItem(game, pickupResult.type)) {
            // Check if we're already carrying something
            if (this.inventory.length === 0) {
                // Pick up the resource
                game.pickupDroppedResource(this.task.x, this.task.y, true); // Actually pick it up
                addToInventory(this.inventory, pickupResult.type, pickupResult.quantity);

                // Find storage area and move there
                if (game.storageArea) {
                    const storageStartX = Math.min(game.storageArea.start.x, game.storageArea.end.x);
                    const storageEndX = Math.max(game.storageArea.start.x, game.storageArea.end.x);
                    const storageStartY = Math.min(game.storageArea.start.y, game.storageArea.end.y);
                    const storageEndY = Math.max(game.storageArea.start.y, game.storageArea.end.y);

                    // Pick a random spot in the storage area
                    const dropX = storageStartX + Math.floor(Math.random() * (storageEndX - storageStartX + 1));
                    const dropY = storageStartY + Math.floor(Math.random() * (storageEndY - storageStartY + 1));

                    // Update task to move to storage location
                    this.task.x = dropX;
                    this.task.y = dropY;
                    this.task.type = 'haul_to_storage';
                } else {
                    // No storage, just keep the item
                    this.task.completed = true;
                    this.task = null;
                    this.taskCooldown = 60;
                }
            } else {
                // Already carrying something, cancel this task
                this.task.completed = true;
                this.task = null;
                this.taskCooldown = 60;
            }
        } else {
            this.task.completed = true;
            this.task = null;
            this.taskCooldown = 60; // Prevent immediate implicit hauling
        }
    }

    /**
     * Perform hauling to storage task
     * @param {Game} game - Reference to the game instance
     */
    performHaulToStorageTask(game) {
        if (!this.task.pickedUp) {
            // Pick up the resource
            const pickupResult = game.pickupDroppedResource(this.task.x, this.task.y, true);
            if (pickupResult && this.canCarryItem(game, pickupResult.type)) {
                const { type, quantity } = pickupResult;
                addToInventory(this.inventory, type, quantity);

                // Find a storage location to move to
                const storageStartX = Math.min(game.storageArea.start.x, game.storageArea.end.x);
                const storageEndX = Math.max(game.storageArea.start.x, game.storageArea.end.x);
                const storageStartY = Math.min(game.storageArea.start.y, game.storageArea.end.y);
                const storageEndY = Math.max(game.storageArea.start.y, game.storageArea.end.y);

                // Pick a random spot in the storage area
                const dropX = storageStartX + Math.floor(Math.random() * (storageEndX - storageStartX + 1));
                const dropY = storageStartY + Math.floor(Math.random() * (storageEndY - storageStartY + 1));

                // Update task to move to storage location
                this.task.x = dropX;
                this.task.y = dropY;
                this.task.pickedUp = true;
            } else {
                // Can't pick up, cancel task
                this.task.completed = true;
                this.task = null;
                this.taskCooldown = 60;
            }
        } else {
            // Drop the resource in storage
            // Find the resource in inventory (assuming we only carry one type at a time for simplicity)
            if (this.inventory.length > 0) {
                const item = this.inventory[0];
                game.dropResource(Math.floor(this.x), Math.floor(this.y), item.tag, item.quantity);
                removeFromInventory(this.inventory, item.tag, item.quantity);
            }
            this.task.completed = true;
            this.task = null;
            this.taskCooldown = 60; // Prevent immediate implicit hauling
        }
    }

    /**
     * Perform stone mining task
     * @param {Game} game - Reference to the game instance
     */
    performMineStoneTask(game) {
        // Mine stone terrain using standardized method
        const type = game.mineStone(this.task.x, this.task.y);
        if (type) {
            // Drop the stone on the ground (will stack automatically)
            game.dropResource(this.task.x, this.task.y, type, 1);

            // Stone will be hauled implicitly by idle pawns, not automatically

            this.task.completed = true;
            this.task = null;
            this.taskCooldown = 60; // Prevent immediate implicit hauling
        } else {
            this.task.completed = true;
            this.task = null;
            this.taskCooldown = 60; // Prevent immediate implicit hauling
        }
    }

    /**
     * Perform plant harvesting task
     * @param {Game} game - Reference to the game instance
     */
    performHarvestPlantTask(game) {
        // Harvest plant using standardized method
        const type = game.harvestPlant(this.task.x, this.task.y);
        if (type) {
            // Drop the food on the ground (will stack automatically)
            game.dropResource(this.task.x, this.task.y, type, 1);

            // Create a hauling task for the food if storage area exists
            if (game.storageArea) {
                game.taskQueue.push({
                    x: this.task.x,
                    y: this.task.y,
                    type: 'haul_to_storage',
                    pickedUp: false
                });
            }

            this.task.completed = true;
            this.task = null;
            this.taskCooldown = 60; // Prevent immediate implicit hauling
        } else {
            this.task.completed = true;
            this.task = null;
            this.taskCooldown = 60; // Prevent immediate implicit hauling
        }
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
        if (!game.storageArea || this.taskCooldown > 0) return null;

        // Find the nearest dropped resource that we can carry
        let nearestResource = null;
        let minDistance = Infinity;

        for (const resource of game.droppedResources) {
            // Skip resources that are already in storage
            const storageStartX = Math.min(game.storageArea.start.x, game.storageArea.end.x);
            const storageEndX = Math.max(game.storageArea.start.x, game.storageArea.end.x);
            const storageStartY = Math.min(game.storageArea.start.y, game.storageArea.end.y);
            const storageEndY = Math.max(game.storageArea.start.y, game.storageArea.end.y);

            const isInStorage = resource.x >= storageStartX && resource.x <= storageEndX &&
                resource.y >= storageStartY && resource.y <= storageEndY;

            if (!isInStorage && this.canCarryItem(game, resource.type)) {
                const distance = calculateDistance(this.x, this.y, resource.x, resource.y);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestResource = resource;
                }
            }
        }

        if (nearestResource) {
            // Create a hauling task to pick up the resource
            return {
                x: nearestResource.x,
                y: nearestResource.y,
                type: 'haul_to_storage',
                resource: nearestResource,
                pickedUp: false
            };
        }

        return null;
    }
}
