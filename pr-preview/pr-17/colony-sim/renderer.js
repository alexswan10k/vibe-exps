/**
 * Renderer class for handling all game rendering
 */
class Renderer {
    /**
     * @param {Game} game - Reference to the game instance
     */
    constructor(game) {
        this.game = game;
    }

    /**
     * Main render function
     */
    render() {
        this.clearCanvas();
        this.renderMap();
        this.renderResources();
        this.renderDroppedResources();
        this.renderPlants();
        this.renderBuildings();
        this.renderPawns();
        this.renderSelectionArea();
        this.renderStorageArea();
    }

    /**
     * Clear the canvas
     */
    clearCanvas() {
        this.game.ctx.clearRect(0, 0, this.game.canvas.width, this.game.canvas.height);
    }

    /**
     * Render the game map
     */
    renderMap() {
        for (let y = 0; y < this.game.mapHeight; y++) {
            for (let x = 0; x < this.game.mapWidth; x++) {
                const screenX = x * this.game.tileSize * this.game.zoom - this.game.camera.x;
                const screenY = y * this.game.tileSize * this.game.zoom - this.game.camera.y;
                const tileSizeZoomed = this.game.tileSize * this.game.zoom;

                if (screenX + tileSizeZoomed < 0 || screenX > this.game.canvas.width ||
                    screenY + tileSizeZoomed < 0 || screenY > this.game.canvas.height) {
                    continue;
                }

                // Draw tile
                if (this.game.spriteSheetLoaded && this.game.spriteSheet) {
                    const sprite = this.getTileSprite(this.game.map[y][x]);
                    if (sprite) {
                        const sourceX = sprite.column * this.game.spriteConfig.tileWidth;
                        const sourceY = sprite.row * this.game.spriteConfig.tileHeight;
                        this.game.ctx.drawImage(
                            this.game.spriteSheet,
                            sourceX, sourceY, this.game.spriteConfig.tileWidth, this.game.spriteConfig.tileHeight,
                            screenX, screenY, tileSizeZoomed, tileSizeZoomed
                        );
                    } else {
                        // Fallback to solid color if sprite not found
                        this.game.ctx.fillStyle = this.getTileColor(this.game.map[y][x]);
                        this.game.ctx.fillRect(screenX, screenY, tileSizeZoomed, tileSizeZoomed);
                    }
                } else {
                    // Fallback to solid color if sprite sheet not loaded
                    this.game.ctx.fillStyle = this.getTileColor(this.game.map[y][x]);
                    this.game.ctx.fillRect(screenX, screenY, tileSizeZoomed, tileSizeZoomed);
                }

                // Draw grid
                this.game.ctx.strokeStyle = '#2c3e50';
                this.game.ctx.strokeRect(screenX, screenY, tileSizeZoomed, tileSizeZoomed);
            }
        }
    }

    /**
     * Render resources
     */
    renderResources() {
        for (const resource of this.game.resources) {
            const screenX = resource.x * this.game.tileSize * this.game.zoom - this.game.camera.x;
            const screenY = resource.y * this.game.tileSize * this.game.zoom - this.game.camera.y;
            const tileSizeZoomed = this.game.tileSize * this.game.zoom;

            // Check if this resource is in the task queue
            const isQueued = this.game.taskQueue.some(task =>
                task.x === resource.x && task.y === resource.y
            );

            // Base color
            let baseColor = resource.type === 'tree' ? '#27ae60' : '#95a5a6';

            // Highlight if queued
            if (isQueued) {
                baseColor = resource.type === 'tree' ? '#2ecc71' : '#95a5a6';
                // Add a border to show it's queued
                this.game.ctx.strokeStyle = '#f1c40f';
                this.game.ctx.lineWidth = 2;
                this.game.ctx.strokeRect(screenX + 6 * this.game.zoom, screenY + 6 * this.game.zoom, tileSizeZoomed - 12 * this.game.zoom, tileSizeZoomed - 12 * this.game.zoom);
                // Draw appropriate icon
                if (resource.type === 'tree') {
                    this.drawChopIcon(screenX + 6 * this.game.zoom, screenY + 20 * this.game.zoom);
                } else {
                    this.drawMineIcon(screenX + 6 * this.game.zoom, screenY + 20 * this.game.zoom);
                }
            }

            this.game.ctx.fillStyle = baseColor;
            this.game.ctx.fillRect(screenX + 8 * this.game.zoom, screenY + 8 * this.game.zoom, tileSizeZoomed - 16 * this.game.zoom, tileSizeZoomed - 16 * this.game.zoom);
        }
    }

    /**
     * Render dropped resources
     */
    renderDroppedResources() {
        for (const droppedResource of this.game.droppedResources) {
            const screenX = droppedResource.x * this.game.tileSize * this.game.zoom - this.game.camera.x;
            const screenY = droppedResource.y * this.game.tileSize * this.game.zoom - this.game.camera.y;
            const tileSizeZoomed = this.game.tileSize * this.game.zoom;

            // Check if this dropped resource is in the task queue
            const isQueued = this.game.taskQueue.some(task =>
                task.x === droppedResource.x && task.y === droppedResource.y && (task.type === 'haul' || task.type === 'haul_to_storage')
            );

            // Base color
            let baseColor = droppedResource.type === 'wood' ? '#8b4513' : '#c0c0c0';

            // Highlight if queued
            if (isQueued) {
                baseColor = droppedResource.type === 'wood' ? '#a0522d' : '#d3d3d3';
                // Add a border to show it's queued
                this.game.ctx.strokeStyle = '#f1c40f';
                this.game.ctx.lineWidth = 2;
                this.game.ctx.strokeRect(screenX + 10 * this.game.zoom, screenY + 10 * this.game.zoom, tileSizeZoomed - 20 * this.game.zoom, tileSizeZoomed - 20 * this.game.zoom);
                // Draw haul icon
                this.drawHaulIcon(screenX + 10 * this.game.zoom, screenY + 20 * this.game.zoom);
            }

            this.game.ctx.fillStyle = baseColor;
            this.game.ctx.fillRect(screenX + 12 * this.game.zoom, screenY + 12 * this.game.zoom, tileSizeZoomed - 24 * this.game.zoom, tileSizeZoomed - 24 * this.game.zoom);
        }
    }

    /**
     * Render plants
     */
    renderPlants() {
        for (const plant of this.game.plants) {
            const screenX = plant.x * this.game.tileSize * this.game.zoom - this.game.camera.x;
            const screenY = plant.y * this.game.tileSize * this.game.zoom - this.game.camera.y;
            const tileSizeZoomed = this.game.tileSize * this.game.zoom;

            // Check if this plant is in the task queue
            const isQueued = this.game.taskQueue.some(task =>
                task.x === plant.x && task.y === plant.y && task.type === 'harvest_plant'
            );

            let color = '#90EE90';
            if (plant.growth > 50) color = '#32CD32';

            // Highlight if queued
            if (isQueued) {
                color = plant.growth > 50 ? '#228B22' : '#66CDAA';
                // Add a border to show it's queued
                this.game.ctx.strokeStyle = '#f1c40f';
                this.game.ctx.lineWidth = 2;
                this.game.ctx.strokeRect(screenX + 4 * this.game.zoom, screenY + 4 * this.game.zoom, tileSizeZoomed - 8 * this.game.zoom, tileSizeZoomed - 8 * this.game.zoom);
                // Draw harvest icon
                this.drawHarvestIcon(screenX + 4 * this.game.zoom, screenY + 20 * this.game.zoom);
            }

            this.game.ctx.fillStyle = color;
            this.game.ctx.fillRect(screenX + 6 * this.game.zoom, screenY + 6 * this.game.zoom, tileSizeZoomed - 12 * this.game.zoom, tileSizeZoomed - 12 * this.game.zoom);
        }
    }

    /**
     * Render buildings
     */
    renderBuildings() {
        for (const building of this.game.buildings) {
            const screenX = building.x * this.game.tileSize * this.game.zoom - this.game.camera.x;
            const screenY = building.y * this.game.tileSize * this.game.zoom - this.game.camera.y;
            const tileSizeZoomed = this.game.tileSize * this.game.zoom;
            this.game.ctx.fillStyle = building.type === 'wall' ? '#8e44ad' : '#e67e22';
            this.game.ctx.fillRect(screenX, screenY, tileSizeZoomed, tileSizeZoomed);
        }
    }

    /**
     * Render pawns
     */
    renderPawns() {
        for (const pawn of this.game.pawns) {
            const screenX = pawn.x * this.game.tileSize * this.game.zoom - this.game.camera.x;
            const screenY = pawn.y * this.game.tileSize * this.game.zoom - this.game.camera.y;
            const tileSizeZoomed = this.game.tileSize * this.game.zoom;
            this.game.ctx.fillStyle = '#f39c12';
            this.game.ctx.fillRect(screenX + 4 * this.game.zoom, screenY + 4 * this.game.zoom, tileSizeZoomed - 8 * this.game.zoom, tileSizeZoomed - 8 * this.game.zoom);
        }
    }

    /**
     * Render selection area
     */
    renderSelectionArea() {
        if (this.game.areaSelection) {
            const startX = Math.min(this.game.areaSelection.start.x, this.game.areaSelection.end.x);
            const endX = Math.max(this.game.areaSelection.start.x, this.game.areaSelection.end.x);
            const startY = Math.min(this.game.areaSelection.start.y, this.game.areaSelection.end.y);
            const endY = Math.max(this.game.areaSelection.start.y, this.game.areaSelection.end.y);

            const screenStartX = startX * this.game.tileSize * this.game.zoom - this.game.camera.x;
            const screenStartY = startY * this.game.tileSize * this.game.zoom - this.game.camera.y;
            const width = (endX - startX + 1) * this.game.tileSize * this.game.zoom;
            const height = (endY - startY + 1) * this.game.tileSize * this.game.zoom;

            this.game.ctx.strokeStyle = '#f1c40f';
            this.game.ctx.lineWidth = 2;
            this.game.ctx.strokeRect(screenStartX, screenStartY, width, height);

            this.game.ctx.fillStyle = 'rgba(241, 196, 15, 0.2)';
            this.game.ctx.fillRect(screenStartX, screenStartY, width, height);
        }
    }

    /**
     * Render storage area
     */
    renderStorageArea() {
        if (this.game.storageArea) {
            const startX = Math.min(this.game.storageArea.start.x, this.game.storageArea.end.x);
            const endX = Math.max(this.game.storageArea.start.x, this.game.storageArea.end.x);
            const startY = Math.min(this.game.storageArea.start.y, this.game.storageArea.end.y);
            const endY = Math.max(this.game.storageArea.start.y, this.game.storageArea.end.y);

            const screenStartX = startX * this.game.tileSize * this.game.zoom - this.game.camera.x;
            const screenStartY = startY * this.game.tileSize * this.game.zoom - this.game.camera.y;
            const width = (endX - startX + 1) * this.game.tileSize * this.game.zoom;
            const height = (endY - startY + 1) * this.game.tileSize * this.game.zoom;

            this.game.ctx.strokeStyle = '#f4d03f';
            this.game.ctx.lineWidth = 3;
            this.game.ctx.strokeRect(screenStartX, screenStartY, width, height);

            this.game.ctx.fillStyle = 'rgba(244, 208, 63, 0.1)';
            this.game.ctx.fillRect(screenStartX, screenStartY, width, height);
        }
    }

    /**
     * Render highlighted tiles
     */
    renderHighlightedTiles() {
        // Highlight selected tile
        if (this.game.selectedTile) {
            const screenX = this.game.selectedTile.x * this.game.tileSize * this.game.zoom - this.game.camera.x;
            const screenY = this.game.selectedTile.y * this.game.tileSize * this.game.zoom - this.game.camera.y;
            const tileSizeZoomed = this.game.tileSize * this.game.zoom;
            this.game.ctx.strokeStyle = '#e74c3c';
            this.game.ctx.lineWidth = 3;
            this.game.ctx.strokeRect(screenX, screenY, tileSizeZoomed, tileSizeZoomed);
        }

        // Highlight hovered tile
        if (this.game.hoveredTile) {
            const screenX = this.game.hoveredTile.x * this.game.tileSize * this.game.zoom - this.game.camera.x;
            const screenY = this.game.hoveredTile.y * this.game.tileSize * this.game.zoom - this.game.camera.y;
            const tileSizeZoomed = this.game.tileSize * this.game.zoom;
            this.game.ctx.strokeStyle = '#3498db';
            this.game.ctx.lineWidth = 2;
            this.game.ctx.strokeRect(screenX, screenY, tileSizeZoomed, tileSizeZoomed);
        }
    }

    /**
     * Draw harvest icon
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    drawHarvestIcon(x, y) {
        // Draw a larger scythe icon at bottom left
        this.game.ctx.fillStyle = '#f1c40f';
        this.game.ctx.font = `${16 * this.game.zoom}px Arial`;
        this.game.ctx.fillText('⚒', x, y);
    }

    /**
     * Draw chop icon
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    drawChopIcon(x, y) {
        // Draw a larger axe icon
        this.game.ctx.fillStyle = '#f1c40f';
        this.game.ctx.font = `${16 * this.game.zoom}px Arial`;
        this.game.ctx.fillText('🪓', x, y);
    }

    /**
     * Draw mine icon
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    drawMineIcon(x, y) {
        // Draw a larger pickaxe icon
        this.game.ctx.fillStyle = '#f1c40f';
        this.game.ctx.font = `${16 * this.game.zoom}px Arial`;
        this.game.ctx.fillText('⛏', x, y);
    }

    /**
     * Draw haul icon
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    drawHaulIcon(x, y) {
        // Draw a larger hand icon
        this.game.ctx.fillStyle = '#f1c40f';
        this.game.ctx.font = `${16 * this.game.zoom}px Arial`;
        this.game.ctx.fillText('👐', x, y);
    }

    /**
     * Get tile sprite
     * @param {string} type - Tile type
     * @returns {Object|null} Sprite configuration
     */
    getTileSprite(type) {
        // Map tile types to sprite names
        const spriteMap = {
            'grass': 'grass',
            'dirt': 'sand', // Use sand sprite for dirt tiles
            'stone': 'stone'
        };

        const spriteName = spriteMap[type] || 'grass'; // Default to grass
        return this.game.spriteConfig.images[spriteName];
    }

    /**
     * Get tile color
     * @param {string} type - Tile type
     * @returns {string} Color string
     */
    getTileColor(type) {
        switch (type) {
            case 'grass': return '#2ecc71';
            case 'dirt': return '#d35400';
            case 'stone': return '#7f8c8d';
            default: return '#34495e';
        }
    }
}
