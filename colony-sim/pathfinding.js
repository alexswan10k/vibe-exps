/**
 * A* pathfinding on the world grid. 8-directional with corner-cut prevention.
 * All functions take a `passable(x, y)` callback so they stay decoupled from World.
 */

/** Minimal binary min-heap keyed by numeric priority. */
class MinHeap {
    constructor() { this.items = []; }
    get size() { return this.items.length; }
    push(item, priority) {
        const a = this.items;
        a.push({ item, priority });
        let i = a.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (a[p].priority <= a[i].priority) break;
            [a[p], a[i]] = [a[i], a[p]];
            i = p;
        }
    }
    pop() {
        const a = this.items;
        if (a.length === 0) return undefined;
        const top = a[0].item;
        const last = a.pop();
        if (a.length > 0) {
            a[0] = last;
            let i = 0;
            for (;;) {
                const l = i * 2 + 1, r = l + 1;
                let m = i;
                if (l < a.length && a[l].priority < a[m].priority) m = l;
                if (r < a.length && a[r].priority < a[m].priority) m = r;
                if (m === i) break;
                [a[m], a[i]] = [a[i], a[m]];
                i = m;
            }
        }
        return top;
    }
}

const DIRS = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1]
];

/**
 * Find a path from (sx,sy) to any goal in `goals` (array of "x,y" keys).
 * @param {Function} passable - (x,y) => boolean
 * @param {Object} start - {x, y}
 * @param {string[]} goals - tile keys, e.g. ["5,7", ...]
 * @param {number} [maxExpansions=4000]
 * @returns {Array<{x:number,y:number}>|null} Path including start and goal tiles.
 */
function findPathToGoals(passable, start, goals, maxExpansions = 4000) {
    const goalSet = new Set(goals);
    if (goalSet.size === 0) return null;

    // If already standing on a goal, trivial path.
    if (goalSet.has(tileKey(start.x, start.y))) return [{ x: start.x, y: start.y }];

    const goalList = [...goalSet].map(k => k.split(',').map(Number));
    const heuristic = (x, y) => {
        let best = Infinity;
        for (let i = 0; i < goalList.length; i++) {
            const d = chebyshev(x, y, goalList[i][0], goalList[i][1]);
            if (d < best) best = d;
        }
        return best;
    };

    const open = new MinHeap();
    const gScore = new Map();
    const cameFrom = new Map();
    const startKey = tileKey(start.x, start.y);
    gScore.set(startKey, 0);
    open.push(start, heuristic(start.x, start.y));

    let expansions = 0;
    while (open.size > 0 && expansions < maxExpansions) {
        const current = open.pop();
        const cKey = tileKey(current.x, current.y);

        if (goalSet.has(cKey)) {
            // Reconstruct
            const path = [];
            let node = current;
            while (node) {
                path.push({ x: node.x, y: node.y });
                node = cameFrom.get(tileKey(node.x, node.y));
            }
            path.reverse();
            return path;
        }

        expansions++;
        const cg = gScore.get(cKey);

        for (const [dx, dy] of DIRS) {
            const nx = current.x + dx, ny = current.y + dy;
            if (!passable(nx, ny)) continue;

            // Prevent diagonal corner cutting: both orthogonal neighbours must be passable.
            if (dx !== 0 && dy !== 0) {
                if (!passable(current.x + dx, current.y) || !passable(current.x, current.y + dy)) continue;
            }

            const nKey = tileKey(nx, ny);
            const cost = (dx !== 0 && dy !== 0) ? 1.414 : 1;
            const tentative = cg + cost;
            if (gScore.has(nKey) && gScore.get(nKey) <= tentative) continue;

            gScore.set(nKey, tentative);
            cameFrom.set(nKey, current);
            open.push({ x: nx, y: ny }, tentative + heuristic(nx, ny));
        }
    }
    return null;
}

/**
 * Convenience: path to a single tile. If the tile itself is impassable,
 * tries its walkable neighbours (useful for working on trees/walls).
 */
function findPath(passable, sx, sy, tx, ty, includeAdjacentIfBlocked = true) {
    const goals = [];
    if (passable(tx, ty)) {
        goals.push(tileKey(tx, ty));
    } else if (includeAdjacentIfBlocked) {
        for (const [dx, dy] of DIRS) {
            const nx = tx + dx, ny = ty + dy;
            if (nx === sx && ny === sy) return [{ x: sx, y: sy }];
            if (passable(nx, ny)) goals.push(tileKey(nx, ny));
        }
    }
    if (goals.length === 0) return null;
    return findPathToGoals(passable, { x: sx, y: sy }, goals);
}

if (typeof module !== 'undefined') module.exports = { MinHeap, findPath, findPathToGoals };
