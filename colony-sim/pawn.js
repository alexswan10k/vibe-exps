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
        this.currentPath = null; // Current path being followed
        this.pathIndex = 0; // Current index in the path
        this.actionState = 'idle'; // idle, moving, chopping, mining, hauling
        this.actionFrame = 0; // For animation
    }

    /**
     * Update the pawn's state
     * @param {Game} game - Reference to the game instance
     */
    update(game) {
        // Update cooldown
        this.taskCooldown = Math.max(0, this.taskCooldown - 1);
        this.actionFrame++;

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
            this.actionState = 'idle';
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
        this.lastTaskType = task.type;
        this.currentPath = null;
        this.pathIndex = 0;
    }

    /**
     * Execute the current task
     * @param {Game} game - Reference to the game instance
     */
    executeTask(game) {
        const dx = this.task.x - this.x;
        const dy = this.task.y - this.y;
        const distance = calculateDistance(this.x, this.y, this.task.x, this.task.y);

        if (distance < 0.5) { // Increased threshold slightly for cleaner arrival
            // Arrived at destination
            this.performTaskAtLocation(game);
            this.currentPath = null;
        } else {
            this.actionState = 'moving';
            // Pathfinding logic
            if (!this.currentPath) {
                // Generate path
                const start = { x: this.x, y: this.y };
                const end = { x: this.task.x, y: this.task.y };
                this.currentPath = game.pathfinding.findPath(start, end);
                this.pathIndex = 0;

                if (!this.currentPath || this.currentPath.length === 0) {
                    // Fallback to direct movement if no path found (e.g. adjacent or blocked)
                    // Or maybe the destination is blocked.
                    // Let's just try to move directly if pathfinding fails,
                    // or maybe we should cancel the task?
                    // For now, linear movement fallback.
                    console.log(`Pawn ${this.name} could not find path to ${this.task.x},${this.task.y}`);
                    this.currentPath = null;
                }
            }

            if (this.currentPath && this.pathIndex < this.currentPath.length) {
                const nextNode = this.currentPath[this.pathIndex];
                const nodeDx = nextNode.x - this.x;
                const nodeDy = nextNode.y - this.y;
                const nodeDist = Math.sqrt(nodeDx*nodeDx + nodeDy*nodeDy);

                if (nodeDist < 0.1) {
                    this.pathIndex++;
                } else {
                    this.x += (nodeDx / nodeDist) * this.speed;
                    this.y += (nodeDy / nodeDist) * this.speed;
                }
            } else {
                // Direct movement fallback or final approach
                const directDist = Math.sqrt(dx*dx + dy*dy);
                if (directDist > 0) {
                     this.x += (dx / directDist) * this.speed;
                     this.y += (dy / directDist) * this.speed;
                }
            }
        }
    }

    /**
     * Perform the task at the current location
     * @param {Game} game - Reference to the game instance
     */
    performTaskAtLocation(game) {
        // Set action state based on task type
        switch (this.task.type) {
            case 'chop':
                this.actionState = 'chopping';
                break;
            case 'mine':
            case 'mine_stone':
                this.actionState = 'mining';
                break;
            case 'haul':
            case 'haul_to_storage':
                this.actionState = 'hauling';
                break;
            case 'harvest_plant':
                this.actionState = 'harvesting';
                break;
        }

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
                this.actionState = 'idle';
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
