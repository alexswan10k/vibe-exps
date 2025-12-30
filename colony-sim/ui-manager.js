/**
 * UIManager class for handling all UI updates and DOM manipulation
 */
class UIManager {
    /**
     * @param {Game} game - Reference to the game instance
     */
    constructor(game) {
        this.game = game;
        this.modeIndicator = document.getElementById('mode-indicator');
        this.cancelHint = document.getElementById('cancel-hint');
        this.setupPawnClickListener();
        this.setupTaskQueueToggle();
    }

    /**
     * Update the mode indicator display
     */
    updateModeIndicator() {
        if (!this.modeIndicator || !this.cancelHint) return;

        if (this.game.currentTaskType || this.game.buildMode) {
            let modeText = 'Mode: ';
            let description = '';

            if (this.game.currentTaskType) {
                switch (this.game.currentTaskType) {
                    case 'chop':
                        modeText += 'Chop Trees';
                        description = 'Click and drag to select trees to chop';
                        break;
                    case 'mine':
                        modeText += 'Mine Iron';
                        description = 'Click and drag to select iron deposits to mine';
                        break;
                    case 'mine_stone':
                        modeText += 'Mine Stone';
                        description = 'Click and drag to select stone tiles to mine';
                        break;
                    case 'harvest_plant':
                        modeText += 'Harvest Plants';
                        description = 'Click and drag to select mature plants to harvest';
                        break;
                    case 'storage':
                        modeText += 'Set Storage Area';
                        description = 'Click and drag to set the storage area for pawns';
                        break;
                    case 'stockpile_zone':
                        modeText += 'Stockpile Zone';
                        description = 'Create a zone for storing items';
                        break;
                    case 'growing_zone':
                        modeText += 'Growing Zone';
                        description = 'Create a zone for growing plants';
                        break;
                }
            } else if (this.game.buildMode) {
                switch (this.game.buildMode) {
                    case 'wall':
                        modeText += 'Build Wall';
                        description = 'Click and drag to select area for wall construction';
                        break;
                    case 'door':
                        modeText += 'Build Door';
                        description = 'Click to place a door';
                        break;
                    case 'table':
                        modeText += 'Build Crafting Table';
                        description = 'Click and drag to select area for crafting table';
                        break;
                    case 'bed':
                        modeText += 'Build Bed';
                        description = 'Click to place a bed';
                        break;
                    case 'chair':
                        modeText += 'Build Chair';
                        description = 'Click to place a chair';
                        break;
                }
            }

            this.modeIndicator.querySelector('.mode-text').textContent = modeText;
            this.modeIndicator.querySelector('.mode-description').textContent = description;
            this.modeIndicator.classList.add('active');
            this.cancelHint.classList.add('active');
        } else {
            this.modeIndicator.classList.remove('active');
            this.cancelHint.classList.remove('active');
        }
    }

    /**
     * Update button states
     */
    updateButtonStates() {
        // Reset all buttons
        const buttons = document.querySelectorAll('#commands button');
        buttons.forEach(button => button.classList.remove('active'));

        // Highlight active button
        if (this.game.currentTaskType) {
            switch (this.game.currentTaskType) {
                case 'chop':
                    document.getElementById('chop-trees').classList.add('active');
                    break;
                case 'mine':
                    document.getElementById('mine-iron').classList.add('active');
                    break;
                case 'mine_stone':
                    document.getElementById('mine-stone').classList.add('active');
                    break;
                case 'harvest_plant':
                    document.getElementById('harvest-plants').classList.add('active');
                    break;
                case 'storage':
                    document.getElementById('build-storage').classList.add('active');
                    break;
            }
        } else if (this.game.buildMode) {
            switch (this.game.buildMode) {
                case 'wall':
                    document.getElementById('build-wall').classList.add('active');
                    break;
                case 'door':
                    document.getElementById('build-door').classList.add('active');
                    break;
                case 'table':
                    document.getElementById('build-table').classList.add('active');
                    break;
                case 'bed':
                    document.getElementById('build-bed').classList.add('active');
                    break;
                case 'chair':
                    document.getElementById('build-chair').classList.add('active');
                    break;
            }
        }

        if (this.game.currentTaskType === 'stockpile_zone') document.getElementById('zone-stockpile').classList.add('active');
        if (this.game.currentTaskType === 'growing_zone') document.getElementById('zone-growing').classList.add('active');
    }

    /**
     * Update all UI elements
     */
    updateUI() {
        this.updatePawnList();
        this.updateTaskQueue();
        this.updateResourceLists();
        this.updateTileInventory();
    }

    /**
     * Update the pawn list display
     */
    updatePawnList() {
        const pawnList = document.getElementById('pawn-list');
        const existingItems = Array.from(pawnList.querySelectorAll('.pawn-item'));
        for (let i = 0; i < this.game.pawns.length; i++) {
            let pawnItem;
            if (i < existingItems.length) {
                pawnItem = existingItems[i];
            } else {
                pawnItem = document.createElement('div');
                pawnItem.className = 'pawn-item';
                pawnItem.style.cursor = 'pointer';
                pawnList.appendChild(pawnItem);
            }
            const pawn = this.game.pawns[i];
            const currentWeight = pawn.getCurrentWeight(this.game);
            const taskText = pawn.task ? ` - Task: ${pawn.task.type} (${pawn.task.x}, ${pawn.task.y})` : ' - Idle';
            pawnItem.textContent = `${pawn.name} - Hunger: ${Math.round(pawn.hunger)}, Sleep: ${Math.round(pawn.sleep)}, Weight: ${currentWeight}/${pawn.maxWeight}${taskText}`;
            pawnItem.dataset.pawnIndex = i;
        }
        for (let i = this.game.pawns.length; i < existingItems.length; i++) {
            pawnList.removeChild(existingItems[i]);
        }
    }

    /**
     * Update the task queue display
     */
    updateTaskQueue() {
        const taskList = document.getElementById('task-list');
        taskList.innerHTML = '';
        if (this.game.taskQueue.length === 0) {
            const noTasks = document.createElement('div');
            noTasks.className = 'resource-item';
            noTasks.textContent = 'No tasks in queue';
            taskList.appendChild(noTasks);
        } else {
            for (let i = 0; i < Math.min(this.game.taskQueue.length, 10); i++) {
                const task = this.game.taskQueue[i];
                const taskItem = document.createElement('div');
                taskItem.className = 'resource-item';
                taskItem.textContent = `${task.type} at (${task.x}, ${task.y})`;
                taskList.appendChild(taskItem);
            }
            if (this.game.taskQueue.length > 10) {
                const moreTasks = document.createElement('div');
                moreTasks.className = 'resource-item';
                moreTasks.textContent = `... and ${this.game.taskQueue.length - 10} more tasks`;
                taskList.appendChild(moreTasks);
            }
        }
    }

    /**
     * Update resource lists (pawn inventories and crafted items)
     */
    updateResourceLists() {
        this.updatePawnInventories();
        this.updateCraftedItems();
    }

    /**
     * Update pawn inventories display
     */
    updatePawnInventories() {
        const resourceList = document.getElementById('resource-list');
        resourceList.innerHTML = '<h3>Pawn Inventories</h3>';
        for (const pawn of this.game.pawns) {
            if (pawn.inventory.length > 0) {
                const pawnHeader = document.createElement('div');
                pawnHeader.className = 'resource-item';
                pawnHeader.style.fontWeight = 'bold';
                pawnHeader.textContent = `${pawn.name}:`;
                resourceList.appendChild(pawnHeader);

                for (const item of pawn.inventory) {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'resource-item';
                    itemDiv.style.marginLeft = '10px';
                    itemDiv.textContent = `${item.tag}: ${item.quantity}`;
                    resourceList.appendChild(itemDiv);
                }
            }
        }
    }

    /**
     * Update crafted items display
     */
    updateCraftedItems() {
        const craftedList = document.getElementById('crafted-list');
        craftedList.innerHTML = '<h3>All Crafted Items</h3>';
        let totalFood = 0;
        let totalTools = 0;
        for (const pawn of this.game.pawns) {
            for (const item of pawn.inventory) {
                if (item.tag === 'food') totalFood += item.quantity;
                if (item.tag === 'tools') totalTools += item.quantity;
            }
        }
        if (totalFood > 0) {
            const foodItem = document.createElement('div');
            foodItem.className = 'resource-item';
            foodItem.textContent = `food: ${totalFood}`;
            craftedList.appendChild(foodItem);
        }
        if (totalTools > 0) {
            const toolsItem = document.createElement('div');
            toolsItem.className = 'resource-item';
            toolsItem.textContent = `tools: ${totalTools}`;
            craftedList.appendChild(toolsItem);
        }
    }

    /**
     * Update tile inventory display
     */
    updateTileInventory() {
        const tileInventoryDiv = document.getElementById('tile-inventory');
        if (this.game.hoveredTile && this.game.map) {
            const { x, y } = this.game.hoveredTile;
            // Check bounds to prevent array access errors
            if (x >= 0 && x < this.game.mapWidth && y >= 0 && y < this.game.mapHeight) {
                const tileType = this.game.map[y][x];
                const standingResource = this.game.resources.find(r => r.x === x && r.y === y);
                const plant = this.game.plants.find(p => p.x === x && p.y === y);
                const droppedResourcesOnTile = this.game.droppedResources.filter(r => r.x === x && r.y === y);

                tileInventoryDiv.innerHTML = `<h3>Tile (${x}, ${y}) - ${tileType}</h3>`;

                let hasContent = false;

                // Show standing resources (trees, iron deposits)
                if (standingResource) {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'resource-item';
                    itemDiv.textContent = `${standingResource.type} (standing)`;
                    tileInventoryDiv.appendChild(itemDiv);
                    hasContent = true;
                }

                // Show plants
                if (plant) {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'resource-item';
                    const growthStatus = plant.isMature() ? 'mature' : 'growing';
                    itemDiv.textContent = `plant (${growthStatus}, ${Math.round(plant.growth)}%)`;
                    tileInventoryDiv.appendChild(itemDiv);
                    hasContent = true;
                }

                // Show mineable terrain (stone)
                if (tileType === 'stone') {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'resource-item';
                    itemDiv.textContent = 'stone (mineable)';
                    tileInventoryDiv.appendChild(itemDiv);
                    hasContent = true;
                }

                // Show dropped resources
                for (const resource of droppedResourcesOnTile) {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'resource-item';
                    itemDiv.textContent = `${resource.type} (dropped, ${resource.quantity})`;
                    tileInventoryDiv.appendChild(itemDiv);
                    hasContent = true;
                }

                if (!hasContent) {
                    tileInventoryDiv.innerHTML += '<div class="resource-item">Empty</div>';
                }
            } else {
                tileInventoryDiv.innerHTML = '<h3>Tile Inventory</h3><div class="resource-item">Out of bounds</div>';
            }
        } else {
            tileInventoryDiv.innerHTML = '<h3>Tile Inventory</h3><div class="resource-item">Hover over a tile</div>';
        }
    }

    /**
     * Focus camera on a specific pawn
     * @param {Pawn} pawn - The pawn to focus on
     */
    focusCameraOnPawn(pawn) {
        // Zoom in a little if too far zoomed out
        if (this.game.zoom < 1) {
            this.game.zoom = 1;
        }

        // Center camera on the pawn's position
        this.game.camera.x = pawn.x * this.game.tileSize * this.game.zoom - this.game.canvas.width / 2;
        this.game.camera.y = pawn.y * this.game.tileSize * this.game.zoom - this.game.canvas.height / 2;

        // Ensure camera stays within bounds
        this.game.camera.x = Math.max(0, Math.min((this.game.mapWidth * this.game.tileSize * this.game.zoom) - this.game.canvas.width, this.game.camera.x));
        this.game.camera.y = Math.max(0, Math.min((this.game.mapHeight * this.game.tileSize * this.game.zoom) - this.game.canvas.height, this.game.camera.y));
    }

    /**
     * Set up pawn click listener for delegation
     */
    setupPawnClickListener() {
        const pawnInfo = document.getElementById('pawn-info');
        if (!pawnInfo.hasPawnClickListener) {
            pawnInfo.addEventListener('click', (e) => {
                let element = e.target;
                while (element && element !== pawnInfo) {
                    if (element.classList && element.classList.contains('pawn-item')) {
                        const index = parseInt(element.dataset.pawnIndex);
                        if (index >= 0 && index < this.game.pawns.length) {
                            this.focusCameraOnPawn(this.game.pawns[index]);
                        }
                        break;
                    }
                    element = element.parentElement;
                }
            });
            pawnInfo.hasPawnClickListener = true;
        }
    }

    /**
     * Set up task queue toggle functionality
     */
    setupTaskQueueToggle() {
        const toggleBtn = document.getElementById('toggle-task-queue');
        const taskList = document.getElementById('task-list');

        if (toggleBtn && taskList) {
            toggleBtn.addEventListener('click', () => {
                const isCollapsed = taskList.classList.contains('collapsed');
                if (isCollapsed) {
                    taskList.classList.remove('collapsed');
                    toggleBtn.textContent = '▼';
                } else {
                    taskList.classList.add('collapsed');
                    toggleBtn.textContent = '▶';
                }
            });
        }
    }

    togglePriorityModal() {
        let modal = document.getElementById('priority-modal');
        if (!modal) {
            this.createPriorityModal();
            modal = document.getElementById('priority-modal');
        }

        if (modal.style.display === 'none') {
            modal.style.display = 'block';
            this.renderPriorityTable();
        } else {
            modal.style.display = 'none';
        }
    }

    createPriorityModal() {
        const modal = document.createElement('div');
        modal.id = 'priority-modal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #2c3e50;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 20px rgba(0,0,0,0.5);
            z-index: 1000;
            max-height: 80vh;
            overflow-y: auto;
            color: white;
        `;

        const header = document.createElement('div');
        header.innerHTML = '<h3>Work Priorities <button id="close-priority-modal" style="float:right; cursor:pointer;">X</button></h3>';
        modal.appendChild(header);

        const content = document.createElement('div');
        content.id = 'priority-content';
        modal.appendChild(content);

        document.body.appendChild(modal);

        document.getElementById('close-priority-modal').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    renderPriorityTable() {
        const content = document.getElementById('priority-content');
        content.innerHTML = '';

        const table = document.createElement('table');
        table.style.cssText = 'width: 100%; border-collapse: collapse;';

        // Header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = '<th style="padding: 5px; text-align: left;">Pawn</th>';

        // Get work types from first pawn (assuming all have same structure)
        if (this.game.pawns.length > 0) {
            const workTypes = Object.keys(this.game.pawns[0].workPriorities);
            workTypes.forEach(type => {
                headerRow.innerHTML += `<th style="padding: 5px; transform: rotate(-45deg); height: 80px; white-space: nowrap;">${type}</th>`;
            });
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');
        this.game.pawns.forEach((pawn, pawnIndex) => {
            const row = document.createElement('tr');
            row.innerHTML = `<td style="padding: 5px;">${pawn.name}</td>`;

            Object.entries(pawn.workPriorities).forEach(([type, priority]) => {
                const cell = document.createElement('td');
                cell.style.padding = '5px';
                cell.style.textAlign = 'center';

                const input = document.createElement('input');
                input.type = 'number';
                input.min = 0;
                input.max = 4;
                input.value = priority;
                input.style.width = '30px';
                input.addEventListener('change', (e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 0 && val <= 4) {
                        pawn.workPriorities[type] = val;
                    }
                });

                cell.appendChild(input);
                row.appendChild(cell);
            });
            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        content.appendChild(table);
    }
}
