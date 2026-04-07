class Node {
    constructor(row, col) {
        this.row = row;
        this.col = col;
        this.isStart = false;
        this.isEnd = false;
        this.isWall = false;
        this.distance = Infinity;
        this.isVisited = false;
        this.previousNode = null;

        // A* specific
        this.f = Infinity;
        this.g = Infinity;
        this.h = 0;
    }
}

class PathfindingVisualizer {
    constructor() {
        this.gridContainer = document.getElementById('grid-container');
        this.visualizeBtn = document.getElementById('visualize-btn');
        this.clearBoardBtn = document.getElementById('clear-board-btn');
        this.clearPathBtn = document.getElementById('clear-path-btn');
        this.algorithmSelect = document.getElementById('algorithm-select');
        this.speedSlider = document.getElementById('speed-slider');
        this.visitedCountEl = document.getElementById('visited-count');
        this.pathLengthEl = document.getElementById('path-length');

        this.grid = [];
        this.nodes = []; // Flat array for DOM elements
        this.rows = 20;
        this.cols = 50;

        this.startNodePos = { row: 10, col: 10 };
        this.endNodePos = { row: 10, col: 40 };

        this.isMousePressed = false;
        this.draggedNodeType = null; // 'start', 'end', or null (drawing walls)
        this.isVisualizing = false;
        this.abortController = null;

        this.init();
    }

    init() {
        this.calculateGridSize();
        window.addEventListener('resize', () => {
            if (!this.isVisualizing) {
                this.calculateGridSize();
                this.createGrid();
            }
        });

        this.createGrid();
        this.setupEventListeners();
    }

    calculateGridSize() {
        const header = document.querySelector('header');
        const availableHeight = window.innerHeight - header.offsetHeight - 40; // 40 for padding
        const availableWidth = window.innerWidth - 40;

        const nodeSize = 25; // 25px width/height + borders

        // Calculate max rows and cols that fit
        this.rows = Math.max(10, Math.floor(availableHeight / nodeSize));
        this.cols = Math.max(10, Math.floor(availableWidth / nodeSize));

        // Ensure start/end are within bounds
        this.startNodePos.row = Math.floor(this.rows / 2);
        this.startNodePos.col = Math.floor(this.cols / 4);
        this.endNodePos.row = Math.floor(this.rows / 2);
        this.endNodePos.col = Math.floor(this.cols * 3 / 4);

        this.gridContainer.style.gridTemplateColumns = `repeat(${this.cols}, ${nodeSize}px)`;
    }

    createGrid() {
        this.gridContainer.innerHTML = '';
        this.grid = [];
        this.nodes = [];
        this.updateStats(0, 0);

        for (let row = 0; row < this.rows; row++) {
            const currentRow = [];
            for (let col = 0; col < this.cols; col++) {
                const node = new Node(row, col);

                if (row === this.startNodePos.row && col === this.startNodePos.col) node.isStart = true;
                if (row === this.endNodePos.row && col === this.endNodePos.col) node.isEnd = true;

                currentRow.push(node);

                const nodeEl = document.createElement('div');
                nodeEl.id = `node-${row}-${col}`;
                nodeEl.className = 'node';
                if (node.isStart) nodeEl.classList.add('node-start');
                if (node.isEnd) nodeEl.classList.add('node-end');

                // Mouse Events
                nodeEl.addEventListener('mousedown', (e) => this.handleMouseDown(node, row, col, e));
                nodeEl.addEventListener('mouseenter', () => this.handleMouseEnter(node, row, col));
                nodeEl.addEventListener('mouseup', () => this.handleMouseUp());

                this.gridContainer.appendChild(nodeEl);
                this.nodes.push(nodeEl);
            }
            this.grid.push(currentRow);
        }

        // Handle mouse up outside grid
        document.addEventListener('mouseup', () => this.handleMouseUp());
    }

    getNodeEl(row, col) {
        return document.getElementById(`node-${row}-${col}`);
    }

    handleMouseDown(node, row, col, event) {
        if (this.isVisualizing) return;
        event.preventDefault(); // Prevent default dragging

        this.isMousePressed = true;

        if (node.isStart) {
            this.draggedNodeType = 'start';
        } else if (node.isEnd) {
            this.draggedNodeType = 'end';
        } else {
            this.draggedNodeType = null;
            this.toggleWall(node, row, col);
        }
    }

    handleMouseEnter(node, row, col) {
        if (!this.isMousePressed || this.isVisualizing) return;

        if (this.draggedNodeType === 'start') {
            if (node.isEnd || node.isWall) return; // Don't override end or wall while dragging start

            // Remove old start
            const oldStartNode = this.grid[this.startNodePos.row][this.startNodePos.col];
            oldStartNode.isStart = false;
            this.getNodeEl(oldStartNode.row, oldStartNode.col).classList.remove('node-start');

            // Set new start
            this.startNodePos = { row, col };
            node.isStart = true;
            this.getNodeEl(row, col).classList.add('node-start');

        } else if (this.draggedNodeType === 'end') {
            if (node.isStart || node.isWall) return; // Don't override start or wall while dragging end

            // Remove old end
            const oldEndNode = this.grid[this.endNodePos.row][this.endNodePos.col];
            oldEndNode.isEnd = false;
            this.getNodeEl(oldEndNode.row, oldEndNode.col).classList.remove('node-end');

            // Set new end
            this.endNodePos = { row, col };
            node.isEnd = true;
            this.getNodeEl(row, col).classList.add('node-end');

        } else {
            // Drawing walls
            if (!node.isStart && !node.isEnd) {
                this.toggleWall(node, row, col);
            }
        }
    }

    handleMouseUp() {
        this.isMousePressed = false;
        this.draggedNodeType = null;
    }

    toggleWall(node, row, col) {
        node.isWall = !node.isWall;
        const nodeEl = this.getNodeEl(row, col);
        if (node.isWall) {
            nodeEl.classList.add('node-wall');
        } else {
            nodeEl.classList.remove('node-wall');
        }
    }

    setupEventListeners() {
        this.visualizeBtn.addEventListener('click', () => this.visualize());
        this.clearBoardBtn.addEventListener('click', () => {
            if(this.abortController) this.abortController.abort();
            this.createGrid();
        });
        this.clearPathBtn.addEventListener('click', () => {
            if(this.abortController) this.abortController.abort();
            this.clearPath();
        });
    }

    clearPath() {
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const node = this.grid[row][col];
                node.isVisited = false;
                node.distance = Infinity;
                node.previousNode = null;
                node.f = Infinity;
                node.g = Infinity;
                node.h = 0;

                const nodeEl = this.getNodeEl(row, col);
                nodeEl.classList.remove('node-visited', 'node-shortest-path');
            }
        }
        this.updateStats(0, 0);
        this.isVisualizing = false;
        this.setControlsDisabled(false);
    }

    setControlsDisabled(disabled) {
        this.algorithmSelect.disabled = disabled;
        this.speedSlider.disabled = disabled;
        this.clearBoardBtn.disabled = disabled;
        this.clearPathBtn.disabled = disabled;
        this.visualizeBtn.textContent = disabled ? 'Stop' : 'Visualize!';
    }

    updateStats(visited, path) {
        this.visitedCountEl.innerText = visited;
        this.pathLengthEl.innerText = path;
    }

    getDelay() {
        // Invert speed: 1 (slow) -> ~100ms, 100 (fast) -> 0ms
        const val = 101 - parseInt(this.speedSlider.value);
        return val;
    }

    async sleep(ms) {
        if(ms <= 0) return Promise.resolve();
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async checkAbort(signal) {
        if (signal && signal.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }
    }

    async visualize() {
        if (this.isVisualizing) {
            if(this.abortController) this.abortController.abort();
            return;
        }

        this.clearPath();
        this.isVisualizing = true;
        this.setControlsDisabled(true);
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        const algorithm = this.algorithmSelect.value;
        const startNode = this.grid[this.startNodePos.row][this.startNodePos.col];
        const endNode = this.grid[this.endNodePos.row][this.endNodePos.col];

        try {
            let visitedNodesInOrder = [];
            switch (algorithm) {
                case 'dijkstra':
                    visitedNodesInOrder = await this.dijkstra(this.grid, startNode, endNode, signal);
                    break;
                case 'astar':
                    visitedNodesInOrder = await this.astar(this.grid, startNode, endNode, signal);
                    break;
                case 'bfs':
                    visitedNodesInOrder = await this.bfs(this.grid, startNode, endNode, signal);
                    break;
                case 'dfs':
                    visitedNodesInOrder = await this.dfs(this.grid, startNode, endNode, signal);
                    break;
            }

            if (!signal.aborted) {
                const shortestPath = this.getNodesInShortestPathOrder(endNode);
                await this.animateShortestPath(shortestPath, signal);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Visualization stopped by user');
                this.clearPath();
            } else {
                console.error(error);
            }
        } finally {
            this.isVisualizing = false;
            this.setControlsDisabled(false);
            this.abortController = null;
        }
    }

    getUnvisitedNeighbors(node, grid) {
        const neighbors = [];
        const { col, row } = node;
        if (row > 0) neighbors.push(grid[row - 1][col]); // up
        if (row < this.rows - 1) neighbors.push(grid[row + 1][col]); // down
        if (col > 0) neighbors.push(grid[row][col - 1]); // left
        if (col < this.cols - 1) neighbors.push(grid[row][col + 1]); // right
        return neighbors.filter(neighbor => !neighbor.isVisited && !neighbor.isWall);
    }

    async animateNodeVisited(node) {
        if (!node.isStart && !node.isEnd) {
            const nodeEl = this.getNodeEl(node.row, node.col);
            nodeEl.classList.add('node-visited');
        }
    }

    // --- Algorithms ---

    async dijkstra(grid, startNode, endNode, signal) {
        const visitedNodesInOrder = [];
        startNode.distance = 0;

        // Simple unvisited nodes array (Min-heap would be faster, but this is fine for a small grid)
        const unvisitedNodes = [];
        for (const row of grid) {
            for (const node of row) {
                unvisitedNodes.push(node);
            }
        }

        while (!!unvisitedNodes.length) {
            await this.checkAbort(signal);

            // Sort to simulate priority queue
            unvisitedNodes.sort((nodeA, nodeB) => nodeA.distance - nodeB.distance);
            const closestNode = unvisitedNodes.shift();

            if (closestNode.isWall) continue;

            // If the closest node is at a distance of infinity, we are trapped
            if (closestNode.distance === Infinity) return visitedNodesInOrder;

            closestNode.isVisited = true;
            visitedNodesInOrder.push(closestNode);

            this.updateStats(visitedNodesInOrder.length, 0);
            await this.animateNodeVisited(closestNode);
            await this.sleep(this.getDelay());

            if (closestNode === endNode) return visitedNodesInOrder;

            const unvisitedNeighbors = this.getUnvisitedNeighbors(closestNode, grid);
            for (const neighbor of unvisitedNeighbors) {
                neighbor.distance = closestNode.distance + 1;
                neighbor.previousNode = closestNode;
            }
        }
        return visitedNodesInOrder;
    }

    async bfs(grid, startNode, endNode, signal) {
        const visitedNodesInOrder = [];
        const queue = [startNode];
        startNode.isVisited = true;

        while (queue.length > 0) {
            await this.checkAbort(signal);
            const currentNode = queue.shift();

            if (currentNode.isWall) continue;

            visitedNodesInOrder.push(currentNode);
            this.updateStats(visitedNodesInOrder.length, 0);
            await this.animateNodeVisited(currentNode);
            await this.sleep(this.getDelay());

            if (currentNode === endNode) return visitedNodesInOrder;

            const neighbors = this.getUnvisitedNeighbors(currentNode, grid);
            for (const neighbor of neighbors) {
                neighbor.isVisited = true;
                neighbor.previousNode = currentNode;
                queue.push(neighbor);
            }
        }
        return visitedNodesInOrder;
    }

    async dfs(grid, startNode, endNode, signal) {
        const visitedNodesInOrder = [];
        const stack = [startNode];

        // Helper map to avoid adding same node to stack multiple times
        const stackMap = new Set();
        stackMap.add(startNode);

        while (stack.length > 0) {
            await this.checkAbort(signal);
            const currentNode = stack.pop();
            stackMap.delete(currentNode);

            if (currentNode.isWall || currentNode.isVisited) continue;

            currentNode.isVisited = true;
            visitedNodesInOrder.push(currentNode);
            this.updateStats(visitedNodesInOrder.length, 0);
            await this.animateNodeVisited(currentNode);
            await this.sleep(this.getDelay());

            if (currentNode === endNode) return visitedNodesInOrder;

            const neighbors = this.getUnvisitedNeighbors(currentNode, grid);
            // Reverse neighbors so it prefers up/down/left/right in a consistent manner (similar to standard visualizers)
            for (let i = neighbors.length - 1; i >= 0; i--) {
                const neighbor = neighbors[i];
                if(!stackMap.has(neighbor)){
                    neighbor.previousNode = currentNode;
                    stack.push(neighbor);
                    stackMap.add(neighbor);
                }
            }
        }
        return visitedNodesInOrder;
    }

    heuristic(nodeA, nodeB) {
        // Manhattan distance
        return Math.abs(nodeA.row - nodeB.row) + Math.abs(nodeA.col - nodeB.col);
    }

    async astar(grid, startNode, endNode, signal) {
        const visitedNodesInOrder = [];
        const openSet = [startNode];

        startNode.g = 0;
        startNode.f = this.heuristic(startNode, endNode);

        while (openSet.length > 0) {
            await this.checkAbort(signal);

            // Find node in openSet with lowest f
            let lowestIndex = 0;
            for(let i=0; i<openSet.length; i++){
                if(openSet[i].f < openSet[lowestIndex].f) {
                    lowestIndex = i;
                }
            }

            let currentNode = openSet[lowestIndex];

            if (currentNode === endNode) {
                currentNode.isVisited = true;
                visitedNodesInOrder.push(currentNode);
                return visitedNodesInOrder;
            }

            // Remove current from openSet
            openSet.splice(lowestIndex, 1);
            currentNode.isVisited = true;
            visitedNodesInOrder.push(currentNode);

            this.updateStats(visitedNodesInOrder.length, 0);
            await this.animateNodeVisited(currentNode);
            await this.sleep(this.getDelay());

            const neighbors = this.getUnvisitedNeighbors(currentNode, grid);

            for(let neighbor of neighbors) {
                // distance from start to neighbor through current
                let tentativeG = currentNode.g + 1;

                // Is this a better path than before?
                let newPath = false;
                if(openSet.includes(neighbor)) {
                    if(tentativeG < neighbor.g) {
                        neighbor.g = tentativeG;
                        newPath = true;
                    }
                } else {
                    neighbor.g = tentativeG;
                    newPath = true;
                    openSet.push(neighbor);
                }

                if(newPath) {
                    neighbor.h = this.heuristic(neighbor, endNode);
                    neighbor.f = neighbor.g + neighbor.h;
                    neighbor.previousNode = currentNode;
                }
            }
        }

        return visitedNodesInOrder; // No path found
    }

    // --- Path Animation ---

    getNodesInShortestPathOrder(endNode) {
        const nodesInShortestPathOrder = [];
        let currentNode = endNode;
        while (currentNode !== null) {
            nodesInShortestPathOrder.unshift(currentNode);
            currentNode = currentNode.previousNode;
        }
        return nodesInShortestPathOrder;
    }

    async animateShortestPath(nodesInShortestPathOrder, signal) {
        // If path length is 1, it means we only have start node, so no path was found
        if(nodesInShortestPathOrder.length <= 1) return;

        for (let i = 0; i < nodesInShortestPathOrder.length; i++) {
            await this.checkAbort(signal);
            const node = nodesInShortestPathOrder[i];

            this.updateStats(this.visitedCountEl.innerText, i);

            if (!node.isStart && !node.isEnd) {
                const nodeEl = this.getNodeEl(node.row, node.col);
                // Remove visited class to apply shortest-path animation cleanly
                nodeEl.classList.remove('node-visited');
                nodeEl.classList.add('node-shortest-path');
                // Slower animation for path
                await this.sleep(30);
            }
        }
    }
}

// Start app
document.addEventListener('DOMContentLoaded', () => {
    new PathfindingVisualizer();
});