/**
 * Utility functions for inventory management and common operations
 */

/**
 * Add items to an inventory
 * @param {InventoryItem[]} inventory - The inventory array to modify
 * @param {string} tag - The item type to add
 * @param {number} quantity - The quantity to add (default: 1)
 */
function addToInventory(inventory, tag, quantity = 1) {
    const existingItem = inventory.find(item => item.tag === tag);
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        inventory.push({ tag, quantity });
    }
}

/**
 * Remove items from an inventory
 * @param {InventoryItem[]} inventory - The inventory array to modify
 * @param {string} tag - The item type to remove
 * @param {number} quantity - The quantity to remove (default: 1)
 * @returns {boolean} True if items were successfully removed
 */
function removeFromInventory(inventory, tag, quantity = 1) {
    const itemIndex = inventory.findIndex(item => item.tag === tag);
    if (itemIndex > -1) {
        const item = inventory[itemIndex];
        item.quantity -= quantity;
        if (item.quantity <= 0) {
            inventory.splice(itemIndex, 1);
        }
        return true;
    }
    return false;
}

/**
 * Get the quantity of a specific item in an inventory
 * @param {InventoryItem[]} inventory - The inventory array to check
 * @param {string} tag - The item type to check
 * @returns {number} The quantity of the item (0 if not found)
 */
function getInventoryQuantity(inventory, tag) {
    const item = inventory.find(item => item.tag === tag);
    return item ? item.quantity : 0;
}

/**
 * Check if an inventory has at least a certain quantity of an item
 * @param {InventoryItem[]} inventory - The inventory array to check
 * @param {string} tag - The item type to check
 * @param {number} quantity - The minimum quantity required (default: 1)
 * @returns {boolean} True if the inventory has enough of the item
 */
function hasInventoryItem(inventory, tag, quantity = 1) {
    return getInventoryQuantity(inventory, tag) >= quantity;
}

/**
 * Calculate distance between two points
 * @param {number} x1 - First point X coordinate
 * @param {number} y1 - First point Y coordinate
 * @param {number} x2 - Second point X coordinate
 * @param {number} y2 - Second point Y coordinate
 * @returns {number} The Euclidean distance between the points
 */
function calculateDistance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/**
 * Clamp a value between min and max
 * @param {number} value - The value to clamp
 * @param {number} min - The minimum value
 * @param {number} max - The maximum value
 * @returns {number} The clamped value
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Check if a point is within a rectangular area
 * @param {number} x - X coordinate to check
 * @param {number} y - Y coordinate to check
 * @param {Area} area - The area to check against
 * @returns {boolean} True if the point is within the area
 */
function isPointInArea(x, y, area) {
    const minX = Math.min(area.start.x, area.end.x);
    const maxX = Math.max(area.start.x, area.end.x);
    const minY = Math.min(area.start.y, area.end.y);
    const maxY = Math.max(area.start.y, area.end.y);

    return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

/**
 * Get the center point of an area
 * @param {Area} area - The area to get center of
 * @returns {Object} Center coordinates {x, y}
 */
function getAreaCenter(area) {
    return {
        x: Math.floor((area.start.x + area.end.x) / 2),
        y: Math.floor((area.start.y + area.end.y) / 2)
    };
}

/**
 * Generate a random integer between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random float between min and max
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random float
 */
function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}
