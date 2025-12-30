/**
 * Pathfinding module using A* algorithm
 */

class Pathfinding {
    /**
     * @param {Game} game - Reference to the game instance
     */
    constructor(game) {
        this.game = game;
    }

    /**
     * Find a path from start to end
     * @param {Object} start - {x, y}
     * @param {Object} end - {x, y}
     * @returns {Array<{x, y}>|null} Array of path nodes or null if no path found
     */
    findPath(start, end) {
        // Round coordinates to integers
        const startX = Math.round(start.x);
        const startY = Math.round(start.y);
        const endX = Math.round(end.x);
        const endY = Math.round(end.y);

        if (startX === endX && startY === endY) {
            return [];
        }

        const openSet = [];
        const closedSet = new Set();
        const cameFrom = new Map();

        const gScore = new Map(); // Cost from start to node
        const fScore = new Map(); // Cost from start to node + heuristic to end

        const startKey = `${startX},${startY}`;
        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic({x: startX, y: startY}, {x: endX, y: endY}));

        openSet.push({
            x: startX,
            y: startY,
            f: fScore.get(startKey)
        });

        while (openSet.length > 0) {
            // Get node with lowest fScore
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
            const currentKey = `${current.x},${current.y}`;

            if (current.x === endX && current.y === endY) {
                return this.reconstructPath(cameFrom, current);
            }

            closedSet.add(currentKey);

            const neighbors = this.getNeighbors(current);
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y}`;
                if (closedSet.has(neighborKey)) continue;

                const tentativeGScore = gScore.get(currentKey) + this.getMovementCost(current, neighbor);

                if (!gScore.has(neighborKey) || tentativeGScore < gScore.get(neighborKey)) {
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeGScore);
                    const h = this.heuristic(neighbor, {x: endX, y: endY});
                    fScore.set(neighborKey, tentativeGScore + h);

                    const existingOpenNode = openSet.find(n => n.x === neighbor.x && n.y === neighbor.y);
                    if (!existingOpenNode) {
                        openSet.push({
                            x: neighbor.x,
                            y: neighbor.y,
                            f: fScore.get(neighborKey)
                        });
                    } else {
                        existingOpenNode.f = fScore.get(neighborKey);
                    }
                }
            }
        }

        return null; // No path found
    }

    /**
     * Heuristic function (Manhattan distance)
     */
    heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    /**
     * Get neighbors of a node
     */
    getNeighbors(node) {
        const neighbors = [];
        const dirs = [
            {x: 0, y: -1},
            {x: 0, y: 1},
            {x: -1, y: 0},
            {x: 1, y: 0},
            // Diagonals (optional, but lets add them with higher cost)
            {x: -1, y: -1},
            {x: 1, y: -1},
            {x: -1, y: 1},
            {x: 1, y: 1}
        ];

        for (const dir of dirs) {
            const x = node.x + dir.x;
            const y = node.y + dir.y;

            if (this.isValidLocation(x, y)) {
                neighbors.push({x, y});
            }
        }
        return neighbors;
    }

    /**
     * Check if location is valid (within bounds and walkable)
     */
    isValidLocation(x, y) {
        if (x < 0 || x >= this.game.mapWidth || y < 0 || y >= this.game.mapHeight) {
            return false;
        }

        // Check for buildings that block movement
        const building = this.game.buildings.find(b => b.x === x && b.y === y);
        if (building && building.type === 'wall') {
            return false;
        }

        // Check for resources that might block movement?
        // For now, let's say trees block movement unless they are the target
        // But the target might be the tree itself (to chop it).
        // So we need to consider if we are "arriving" at the target.
        // But findPath is generic.
        // Let's assume trees are walkable but high cost, or non-walkable.
        // Typically in games, you can't walk through trees.

        const resource = this.game.resources.find(r => r.x === x && r.y === y);
        if (resource && resource.type === 'tree') {
             // We can walk into a tree tile only if it's the destination?
             // But for now let's make them blocking.
             // Wait, if I want to chop a tree, I need to stand next to it or on it?
             // The game logic `distance < 0.1` suggests standing on it.
             // So trees must be walkable.
             return true;
        }

        return true;
    }

    /**
     * Get cost of moving from one node to another
     */
    getMovementCost(from, to) {
        // Base cost is 1 for straight, 1.4 for diagonal
        const isDiagonal = from.x !== to.x && from.y !== to.y;
        let cost = isDiagonal ? 1.4 : 1.0;

        // Terrain costs
        const terrain = this.game.map[to.y][to.x];
        if (terrain === 'stone') cost += 0.5; // Walking on stone is slightly harder?

        // Check if there is a resource (e.g. tree) which makes it slower
        const resource = this.game.resources.find(r => r.x === to.x && r.y === to.y);
        if (resource && resource.type === 'tree') {
            cost += 2.0; // Walking through forest is slow
        }

        return cost;
    }

    /**
     * Reconstruct path from cameFrom map
     */
    reconstructPath(cameFrom, current) {
        const path = [current];
        const currentKey = (node) => `${node.x},${node.y}`;

        while (cameFrom.has(currentKey(current))) {
            current = cameFrom.get(currentKey(current));
            path.unshift(current);
        }
        return path;
    }
}
