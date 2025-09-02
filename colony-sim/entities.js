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
     */
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
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
            this.growth += 0.05;
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
