/**
 * InputManager class for handling all user input events
 */
class InputManager {
    /**
     * @param {Game} game - Reference to the game instance
     */
    constructor(game) {
        this.game = game;
        this.setupEventListeners();
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        this.game.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.game.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.game.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.game.canvas.addEventListener('contextmenu', (e) => this.handleRightClick(e));
        this.game.canvas.addEventListener('wheel', (e) => this.handleMouseWheel(e));

        document.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Task buttons
        document.getElementById('chop-trees').addEventListener('click', () => {
            this.game.taskManager.setTaskMode('chop');
        });

        document.getElementById('mine-iron').addEventListener('click', () => {
            this.game.taskManager.setTaskMode('mine');
        });

        document.getElementById('mine-stone').addEventListener('click', () => {
            this.game.taskManager.setTaskMode('mine_stone');
        });

        document.getElementById('harvest-plants').addEventListener('click', () => {
            this.game.taskManager.setTaskMode('harvest_plant');
        });

        // Build buttons
        document.getElementById('build-wall').addEventListener('click', () => {
            this.game.buildMode = 'wall';
            this.game.currentTaskType = null;
            this.game.canvas.style.cursor = 'crosshair';
            this.game.uiManager.updateModeIndicator();
            this.game.uiManager.updateButtonStates();
        });

        document.getElementById('build-table').addEventListener('click', () => {
            this.game.buildMode = 'table';
            this.game.currentTaskType = null;
            this.game.canvas.style.cursor = 'crosshair';
            this.game.uiManager.updateModeIndicator();
            this.game.uiManager.updateButtonStates();
        });

        document.getElementById('build-storage').addEventListener('click', () => {
            this.game.taskManager.setStorageMode();
        });

        // Craft buttons
        document.getElementById('craft-food').addEventListener('click', () => {
            this.game.taskManager.craftItem('food');
        });

        document.getElementById('craft-tools').addEventListener('click', () => {
            this.game.taskManager.craftItem('tools');
        });
    }

    /**
     * Handle mouse down events
     * @param {MouseEvent} e - Mouse event
     */
    handleMouseDown(e) {
        if (this.game.currentTaskType || this.game.buildMode) {
            const rect = this.game.canvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left + this.game.camera.x) / (this.game.tileSize * this.game.zoom));
            const y = Math.floor((e.clientY - rect.top + this.game.camera.y) / (this.game.tileSize * this.game.zoom));

            this.game.isSelectingArea = true;
            this.game.selectionStart = { x, y };
            this.game.areaSelection = { start: { x, y }, end: { x, y } };
        }
    }

    /**
     * Handle mouse move events
     * @param {MouseEvent} e - Mouse event
     */
    handleMouseMove(e) {
        const rect = this.game.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left + this.game.camera.x) / (this.game.tileSize * this.game.zoom));
        const y = Math.floor((e.clientY - rect.top + this.game.camera.y) / (this.game.tileSize * this.game.zoom));

        if (this.game.isSelectingArea && this.game.areaSelection) {
            this.game.areaSelection.end = { x, y };
        } else {
            this.game.hoveredTile = { x, y };
        }
    }

    /**
     * Handle mouse up events
     * @param {MouseEvent} e - Mouse event
     */
    handleMouseUp(e) {
        if (this.game.isSelectingArea && this.game.areaSelection) {
            this.game.isSelectingArea = false;
            if (this.game.currentTaskType === 'storage') {
                this.game.storageArea = this.game.areaSelection;
                this.game.areaSelection = null;
                this.game.currentTaskType = null;
                this.game.canvas.style.cursor = 'default';
                this.game.uiManager.updateModeIndicator();
                this.game.uiManager.updateButtonStates();
            } else if (this.game.buildMode) {
                this.game.taskManager.buildInArea();
                this.game.areaSelection = null;
                this.game.buildMode = null;
                this.game.canvas.style.cursor = 'default';
                this.game.uiManager.updateModeIndicator();
                this.game.uiManager.updateButtonStates();
            } else {
                this.game.taskManager.createTasksFromArea();
                this.game.areaSelection = null;
                this.game.currentTaskType = null;
                this.game.canvas.style.cursor = 'default';
                this.game.uiManager.updateModeIndicator();
                this.game.uiManager.updateButtonStates();
            }
        }
    }

    /**
     * Handle right click events
     * @param {MouseEvent} e - Mouse event
     */
    handleRightClick(e) {
        e.preventDefault();
        e.stopPropagation();
        this.game.taskManager.cancelSelection();
    }

    /**
     * Handle key down events
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeyDown(e) {
        const moveSpeed = 10;
        switch (e.key) {
            case 'ArrowUp':
            case 'w':
                this.game.camera.y = Math.max(0, this.game.camera.y - moveSpeed);
                break;
            case 'ArrowDown':
            case 's':
                this.game.camera.y = Math.min((this.game.mapHeight * this.game.tileSize * this.game.zoom) - this.game.canvas.height, this.game.camera.y + moveSpeed);
                break;
            case 'ArrowLeft':
            case 'a':
                this.game.camera.x = Math.max(0, this.game.camera.x - moveSpeed);
                break;
            case 'ArrowRight':
            case 'd':
                this.game.camera.x = Math.min((this.game.mapWidth * this.game.tileSize * this.game.zoom) - this.game.canvas.width, this.game.camera.x + moveSpeed);
                break;
            case 'Escape':
                this.game.taskManager.cancelSelection();
                break;
        }
    }

    /**
     * Handle mouse wheel events
     * @param {WheelEvent} e - Wheel event
     */
    handleMouseWheel(e) {
        e.preventDefault();
        const zoomSpeed = 0.1;
        const oldZoom = this.game.zoom;

        if (e.deltaY < 0) {
            // Zoom in
            this.game.zoom = Math.min(this.game.maxZoom, this.game.zoom + zoomSpeed);
        } else {
            // Zoom out
            this.game.zoom = Math.max(this.game.minZoom, this.game.zoom - zoomSpeed);
        }

        // Adjust camera to zoom towards mouse position
        if (oldZoom !== this.game.zoom) {
            const rect = this.game.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const worldX = (mouseX + this.game.camera.x) / (this.game.tileSize * oldZoom);
            const worldY = (mouseY + this.game.camera.y) / (this.game.tileSize * oldZoom);

            this.game.camera.x = worldX * this.game.tileSize * this.game.zoom - mouseX;
            this.game.camera.y = worldY * this.game.tileSize * this.game.zoom - mouseY;

            // Ensure camera stays within bounds
            this.game.camera.x = Math.max(0, Math.min((this.game.mapWidth * this.game.tileSize * this.game.zoom) - this.game.canvas.width, this.game.camera.x));
            this.game.camera.y = Math.max(0, Math.min((this.game.mapHeight * this.game.tileSize * this.game.zoom) - this.game.canvas.height, this.game.camera.y));
        }
    }
}
