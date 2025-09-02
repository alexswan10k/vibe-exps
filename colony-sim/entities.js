/**
 * Game entity classes
 */

/**
 * Represents a resource in the game world
 */
class Resource {
    /**
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} type - Type of resource (tree, iron, etc.)
     */
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
    }
}

/**
 * Represents a building in the game world
 */
class Building {
    /**
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} type - Type of building (wall, table, etc.)
     */
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
    }
}

/**
 * Represents a dropped resource on the ground
 */
class DroppedResource {
    /**
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} type - Type of resource (wood, iron, stone, etc.)
     * @param {number} quantity - Quantity of the resource (default 1)
     */
    constructor(x, y, type, quantity = 1) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.quantity = quantity;
    }

    /**
     * Get the maximum stack size for this resource type
     * @returns {number} Maximum stack size
     */
    getMaxStackSize() {
        return this.type === 'food' ? 50 : 25;
    }

    /**
     * Check if this stack can accept more of the same resource type
     * @param {string} resourceType - Type of resource to add
     * @param {number} amount - Amount to add
     * @returns {boolean} Whether the stack can accept the resources
     */
    canStack(resourceType, amount = 1) {
        return this.type === resourceType && this.quantity + amount <= this.getMaxStackSize();
    }

    /**
     * Add resources to this stack
     * @param {number} amount - Amount to add
     * @returns {number} Amount actually added
     */
    addToStack(amount) {
        const spaceAvailable = this.getMaxStackSize() - this.quantity;
        const amountToAdd = Math.min(amount, spaceAvailable);
        this.quantity += amountToAdd;
        return amountToAdd;
    }
}

/**
 * Represents a plant in the game world
 */
class Plant {
    /**
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} growth - Initial growth level (0-100)
     */
    constructor(x, y, growth) {
        this.x = x;
        this.y = y;
        this.growth = growth;
    }

    /**
     * Update the plant's growth
     */
    update() {
        if (this.growth < 100) {
            this.growth += 0.5; // Increased growth rate for faster testing
        }
    }

    /**
     * Check if the plant is mature (ready for harvest)
     * @returns {boolean} True if the plant is mature
     */
    isMature() {
        return this.growth >= 50;
    }
}
