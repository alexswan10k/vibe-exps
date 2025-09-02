/**
 * @typedef {Object} InventoryItem
 * @property {string} tag - The item type identifier
 * @property {number} quantity - The quantity of this item
 */

/**
 * @typedef {Object} ItemProperties
 * @property {number} weight - The weight per unit of the item
 * @property {number} cost - The cost per unit of the item
 */

/**
 * @typedef {Object} Task
 * @property {number} x - X coordinate of the task
 * @property {number} y - Y coordinate of the task
 * @property {string} type - Type of task (chop, mine, haul, etc.)
 * @property {Object} [resource] - Associated resource object
 * @property {Object} [plant] - Associated plant object
 * @property {Object} [destination] - Destination coordinates for hauling
 * @property {boolean} [completed] - Whether the task is completed
 */

/**
 * @typedef {Object} Area
 * @property {Object} start - Starting coordinates {x, y}
 * @property {number} start.x - Starting X coordinate
 * @property {number} start.y - Starting Y coordinate
 * @property {Object} end - Ending coordinates {x, y}
 * @property {number} end.x - Ending X coordinate
 * @property {number} end.y - Ending Y coordinate
 */

/**
 * @typedef {Object} Camera
 * @property {number} x - Camera X position
 * @property {number} y - Camera Y position
 */

/**
 * @typedef {Object} SpriteConfig
 * @property {number} width - Sprite sheet width
 * @property {number} height - Sprite sheet height
 * @property {number} columns - Number of columns in sprite sheet
 * @property {number} rows - Number of rows in sprite sheet
 * @property {number} tileWidth - Width of each tile in pixels
 * @property {number} tileHeight - Height of each tile in pixels
 * @property {Object.<string, {column: number, row: number}>} images - Sprite mappings
 */

/**
 * @typedef {Object} GameConfig
 * @property {number} tileSize - Size of each tile in pixels
 * @property {number} mapWidth - Width of the game map
 * @property {number} mapHeight - Height of the game map
 * @property {number} minZoom - Minimum zoom level
 * @property {number} maxZoom - Maximum zoom level
 * @property {Camera} camera - Camera configuration
 * @property {number} zoom - Current zoom level
 * @property {SpriteConfig} spriteConfig - Sprite sheet configuration
 */
