// World Generation, Representation, and Environment Rendering Module

class World {
    constructor(grid, graph) {
        this.grid = grid;
        this.height = grid.length;
        this.width = grid[0].length;

        this.buildings = [];
        this.trafficLights = [];
        this.waterTiles = [];
        this.sandTiles = [];
        this.parkTiles = [];
        this.poolTiles = [];
        this.plazaTiles = [];
        this.runwayTiles = [];
        this.pierTiles = [];
        this.openTiles = []; // Parking lots & construction sites (open ground)
        this.containerStacks = [];
        this.landmarks = []; // Pay 'n' Spray, Ammu-Nation, Diner, Hospital, Police HQ, Gas, Casino
        this.stuntRamps = [];

        // Road graph: nodes + spline edges (roads live in world space, not tiles)
        this.nodes = graph ? graph.nodes : [];
        this.edges = graph ? graph.edges : [];
        this.roundabouts = graph ? graph.roundabouts : [];
        this.rampProps = graph ? graph.ramps : [];

        this.convertToObjects();
        this.mergeBuildings();
        this.prepGraph();
        this.populateWorldProps();
    }

    static loadFromEmbedded() {
        const lines = WORLD_DATA.trim().split('\n');
        const grid = lines.map(line => line.trim().split(/\s+/));
        return new World(grid, typeof ROAD_GRAPH !== 'undefined' ? ROAD_GRAPH : null);
    }

    // Precompute edge geometry & lookup structures for the road graph
    prepGraph() {
        this.nodeEdges = new Map();
        for (const e of this.edges) {
            if (!this.nodeEdges.has(e.a)) this.nodeEdges.set(e.a, []);
            if (!this.nodeEdges.has(e.b)) this.nodeEdges.set(e.b, []);
            this.nodeEdges.get(e.a).push(e);
            this.nodeEdges.get(e.b).push(e);
            e.cum = [0];
            let len = 0;
            for (let i = 1; i < e.pts.length; i++) {
                len += Math.hypot(e.pts[i][0] - e.pts[i - 1][0], e.pts[i][1] - e.pts[i - 1][1]);
                e.cum.push(len);
            }
            e.len = len;
            // bbox for culling
            let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
            for (const p of e.pts) {
                if (p[0] < bx0) bx0 = p[0]; if (p[0] > bx1) bx1 = p[0];
                if (p[1] < by0) by0 = p[1]; if (p[1] > by1) by1 = p[1];
            }
            e.bbox = { x0: bx0, y0: by0, x1: bx1, y1: by1 };
        }
        // Spatial buckets (288px cells) fed by dense sampling
        this.edgeBuckets = new Map();
        for (const e of this.edges) {
            for (let d = 0; d <= e.len; d += 48) {
                const p = this.pointAtDist(e, d);
                const k = Math.floor(p.x / 288) + ',' + Math.floor(p.y / 288);
                if (!this.edgeBuckets.has(k)) this.edgeBuckets.set(k, new Set());
                this.edgeBuckets.get(k).add(e);
            }
        }
        // Bridge corridors: standing here means solid deck beneath your feet,
        // so water death/sinking checks must stand down.
        this.bridgeCells = new Set();
        for (const e of this.edges) {
            if (!e.bridge) continue;
            const half = e.w / 2 + 14;
            for (let d = 0; d <= e.len; d += 24) {
                const p = this.pointAtDist(e, d);
                const cx48 = Math.floor(p.x / 48), cy48 = Math.floor(p.y / 48);
                for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
                    const qx = (cx48 + dx) * 48 + 24, qy = (cy48 + dy) * 48 + 24;
                    if (Math.hypot(qx - p.x, qy - p.y) < half + 24) {
                        this.bridgeCells.add((cx48 + dx) + ',' + (cy48 + dy));
                    }
                }
            }
        }
        // Traffic lights at real junctions (3+ arms), never on roundabouts
        const raIds = new Set(this.roundabouts.map(r => r.id));
        this.nodeLight = new Map();
        this.trafficLights = [];
        for (const n of this.nodes) {
            const deg = (this.nodeEdges.get(n.id) || []).length;
            if (deg >= 3 && !raIds.has(n.id) && Math.random() < 0.6) {
                const light = { x: n.x, y: n.y, state: Math.random() < 0.5 ? 'red' : 'green', timer: Math.random() * 300, node: n.id };
                this.trafficLights.push(light);
                this.nodeLight.set(n.id, light);
            }
        }
    }

    pointAtDist(e, d) {
        if (d <= 0) d = 0;
        if (d > e.len) d = e.len;
        // linear scan over cumulative lengths
        let i = 1;
        while (i < e.cum.length && e.cum[i] < d) i++;
        i = Math.min(i, e.cum.length - 1);
        const t = (d - e.cum[i - 1]) / ((e.cum[i] - e.cum[i - 1]) || 1);
        const ax = e.pts[i - 1][0], ay = e.pts[i - 1][1];
        const bx = e.pts[i][0], by = e.pts[i][1];
        return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, ang: Math.atan2(by - ay, bx - ax) };
    }

    projectOnEdge(e, x, y) {
        let best = { dist: 0, off: Infinity };
        for (let i = 1; i < e.pts.length; i++) {
            const ax = e.pts[i - 1][0], ay = e.pts[i - 1][1];
            const bx = e.pts[i][0], by = e.pts[i][1];
            const dx = bx - ax, dy = by - ay;
            const l2 = dx * dx + dy * dy || 1;
            let t = ((x - ax) * dx + (y - ay) * dy) / l2;
            t = Math.max(0, Math.min(1, t));
            const qx = ax + dx * t, qy = ay + dy * t;
            const d2 = (x - qx) ** 2 + (y - qy) ** 2;
            if (d2 < best.off * best.off || best.off === Infinity) {
                best = { dist: e.cum[i - 1] + Math.sqrt(l2) * t, off: Math.sqrt(d2) };
            }
        }
        return best;
    }

    nearestEdge(x, y) {
        const bx = Math.floor(x / 288), by = Math.floor(y / 288);
        let cands = null;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const arr = this.edgeBuckets.get((bx + dx) + ',' + (by + dy));
            if (arr) {
                if (!cands) cands = new Set();
                for (const e of arr) cands.add(e);
            }
        }
        if (!cands) return null;
        let best = null, bd = Infinity;
        for (const e of cands) {
            const p = this.projectOnEdge(e, x, y);
            if (p.off < bd) { bd = p.off; best = { edge: e, dist: p.dist, off: p.off }; }
        }
        return best;
    }

    nearestLanePoint(x, y) {
        const ne = this.nearestEdge(x, y);
        if (!ne) return null;
        const p = this.pointAtDist(ne.edge, ne.dist);
        return { x: p.x, y: p.y, ang: p.ang, edge: ne.edge, dist: ne.dist };
    }

    // True when the position sits on a bridge deck spanning water
    onBridge(x, y) {
        return this.bridgeCells.has(Math.floor(x / 48) + ',' + Math.floor(y / 48));
    }

    convertToObjects() {
        const cellSize = 96;

        this.buildings = [];
        this.trafficLights = [];
        this.waterTiles = [];
        this.sandTiles = [];
        this.parkTiles = [];
        this.poolTiles = [];
        this.plazaTiles = [];
        this.runwayTiles = [];
        this.pierTiles = [];
        this.openTiles = [];
        this.containerStacks = [];
        this.landmarks = [];
        this.stuntRamps = [];

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const gameX = x * cellSize;
                const gameY = y * cellSize;
                const tile = this.grid[y][x];

                if (tile === 'W' || tile === 'W_COAST' || tile === 'W_POND') {
                    this.waterTiles.push({ x: gameX, y: gameY, width: cellSize, height: cellSize, type: tile });
                } else if (tile === 'SAND') {
                    this.sandTiles.push({ x: gameX, y: gameY, width: cellSize, height: cellSize });
                } else if (tile === 'PARK' || tile === 'GARDEN') {
                    this.parkTiles.push({ x: gameX, y: gameY, width: cellSize, height: cellSize, type: tile });
                } else if (tile === 'POOL') {
                    this.poolTiles.push({ x: gameX, y: gameY, width: cellSize, height: cellSize });
                } else if (tile === 'PLAZA') {
                    this.plazaTiles.push({ x: gameX, y: gameY, width: cellSize, height: cellSize });
                } else if (tile === 'RUNWAY') {
                    this.runwayTiles.push({ x: gameX, y: gameY, width: cellSize, height: cellSize });
                } else if (tile === 'APRON') {
                    this.runwayTiles.push({ x: gameX, y: gameY, width: cellSize, height: cellSize, apron: true });
                } else if (tile === 'PIER') {
                    this.pierTiles.push({ x: gameX, y: gameY, width: cellSize, height: cellSize });
                } else if (tile === 'LOT' || tile === 'DIRT') {
                    this.openTiles.push({ x: gameX, y: gameY, width: cellSize, height: cellSize, kind: tile });
                } else if (tile === 'GAS') {
                    // Fuel Station - repairs vehicles for cash
                    this.landmarks.push({
                        type: 'gas',
                        name: "Fuel Station",
                        icon: '⛽',
                        x: gameX,
                        y: gameY,
                        width: cellSize,
                        height: cellSize,
                        bayX: gameX + cellSize / 2,
                        bayY: gameY + cellSize / 2
                    });
                    this.buildings.push({ x: gameX + 20, y: gameY + 20, width: 26, height: 56, style: 'gas' });
                } else if (tile === 'CASINO') {
                    // Pink Palace Casino
                    this.landmarks.push({
                        type: 'casino',
                        name: "Pink Palace Casino",
                        icon: '🎰',
                        x: gameX,
                        y: gameY,
                        width: cellSize,
                        height: cellSize,
                        bayX: gameX + cellSize / 2,
                        bayY: gameY + cellSize / 2
                    });
                    this.buildings.push({ x: gameX, y: gameY, width: cellSize, height: cellSize, style: 'casino' });
                } else if (tile === 'HANGAR') {
                    this.buildings.push({ x: gameX + 4, y: gameY + 4, width: cellSize - 8, height: cellSize - 8, style: 'hangar' });
                } else if (tile === 'B_AIR') {
                    this.buildings.push({ x: gameX + 6, y: gameY + 6, width: cellSize - 12, height: cellSize - 12, style: 'airport' });
                } else if (tile === 'TERMINAL') {
                    // Huge terminal: anchor tile is its top-left corner, spans 4x2 tiles
                    this.buildings.push({ x: gameX, y: gameY, width: cellSize * 4, height: cellSize * 2, style: 'terminal' });
                } else if (tile === 'STADIUM') {
                    // Huge stadium: anchor is the center, spans 5x5 tiles
                    this.buildings.push({
                        x: gameX - 2 * cellSize - 6, y: gameY - 2 * cellSize - 6,
                        width: cellSize * 5 - 12, height: cellSize * 5 - 12,
                        style: 'stadium'
                    });
                } else if (tile === 'CONT') {
                    // 'STAD_FILL', 'E_DOCK' are open ground - intentionally ignored
                    this.containerStacks.push({ x: gameX, y: gameY, width: cellSize, height: cellSize });
                    // Container stacks act as solid buildings
                    this.buildings.push({
                        x: gameX + 8, y: gameY + 8, width: cellSize - 16, height: cellSize - 16,
                        style: 'container', color: ['#D32F2F', '#1976D2', '#388E3C', '#F57C00'][(x + y) % 4]
                    });
                } else if (tile === 'PNS') {
                    // Pay 'n' Spray Garage
                    this.landmarks.push({
                        type: 'pns',
                        name: "Pay 'n' Spray",
                        icon: '🔧',
                        x: gameX,
                        y: gameY,
                        width: cellSize,
                        height: cellSize,
                        bayX: gameX + cellSize / 2,
                        bayY: gameY + cellSize / 2
                    });
                    this.buildings.push({ x: gameX, y: gameY, width: cellSize, height: cellSize, style: 'pns' });
                } else if (tile === 'AMMU') {
                    // Ammu-Nation Store
                    this.landmarks.push({
                        type: 'ammu',
                        name: "Ammu-Nation",
                        icon: '🔫',
                        x: gameX,
                        y: gameY,
                        width: cellSize,
                        height: cellSize,
                        bayX: gameX + cellSize / 2,
                        bayY: gameY + cellSize / 2
                    });
                    this.buildings.push({ x: gameX, y: gameY, width: cellSize, height: cellSize, style: 'ammu' });
                } else if (tile === 'DINER') {
                    // Burger Shot / Diner
                    this.landmarks.push({
                        type: 'diner',
                        name: "Burger Shot",
                        icon: '🍔',
                        x: gameX,
                        y: gameY,
                        width: cellSize,
                        height: cellSize,
                        bayX: gameX + cellSize / 2,
                        bayY: gameY + cellSize / 2
                    });
                    this.buildings.push({ x: gameX, y: gameY, width: cellSize, height: cellSize, style: 'diner' });
                } else if (tile === 'HOSP') {
                    // Hospital
                    this.landmarks.push({
                        type: 'hospital',
                        name: "General Hospital",
                        icon: '➕',
                        x: gameX,
                        y: gameY,
                        width: cellSize,
                        height: cellSize,
                        bayX: gameX + cellSize / 2,
                        bayY: gameY + cellSize / 2
                    });
                    this.buildings.push({ x: gameX, y: gameY, width: cellSize, height: cellSize, style: 'hospital' });
                } else if (tile === 'PD') {
                    // Police Department
                    this.landmarks.push({
                        type: 'police',
                        name: "Police HQ",
                        icon: '🛡️',
                        x: gameX,
                        y: gameY,
                        width: cellSize,
                        height: cellSize,
                        bayX: gameX + cellSize / 2,
                        bayY: gameY + cellSize / 2
                    });
                    this.buildings.push({ x: gameX, y: gameY, width: cellSize, height: cellSize, style: 'police' });
                } else if (tile.startsWith('RAMP_')) {
                    let angle = 0;
                    if (tile === 'RAMP_E') angle = 0;
                    if (tile === 'RAMP_S') angle = Math.PI / 2;
                    if (tile === 'RAMP_W') angle = Math.PI;
                    if (tile === 'RAMP_N') angle = -Math.PI / 2;

                    this.stuntRamps.push({ x: gameX + cellSize / 2, y: gameY + cellSize / 2, angle: angle });
                } else if (tile.startsWith('B')) {
                    // Building with distinct style
                    let style = 'standard';
                    if (tile === 'B_DT') style = 'downtown';
                    if (tile === 'B_CT') style = 'chinatown';
                    if (tile === 'B_IND') style = 'industrial';
                    if (tile === 'B_SUB') style = 'suburb';
                    if (tile === 'B_OLD') style = 'brownstone';
                    if (tile === 'B_BORDER') style = 'border';

                    this.buildings.push({
                        x: gameX + (style === 'border' ? 0 : 6),
                        y: gameY + (style === 'border' ? 0 : 6),
                        width: cellSize - (style === 'border' ? 0 : 12),
                        height: cellSize - (style === 'border' ? 0 : 12),
                        style: style,
                        tileX: x,
                        tileY: y,
                        spanX: 1,
                        spanY: 1,
                        mergeable: style !== 'border'
                    });
                }
            }
        }
    }

    // Greedily merge adjacent same-style single-tile buildings into bigger
    // footprints so the city doesn't read as a uniform grid of boxes.
    mergeBuildings() {
        const MERGEABLE = ['standard', 'downtown', 'chinatown', 'industrial', 'suburb', 'brownstone'];
        const singles = this.buildings.filter(b => b.mergeable && MERGEABLE.indexOf(b.style) !== -1);
        if (singles.length === 0) return;
        const rest = this.buildings.filter(b => !(b.mergeable && MERGEABLE.indexOf(b.style) !== -1));

        const map = new Map();
        for (let b of singles) map.set(b.tileX + ',' + b.tileY, b);
        const GAP = 12;

        let didMerge = true;
        let guard = 0;
        while (didMerge && guard++ < 400) {
            didMerge = false;
            for (let b of singles) {
                if (b.dead) continue;
                // Merge with right neighbor
                let nb = map.get((b.tileX + b.spanX) + ',' + b.tileY);
                if (nb && !nb.dead && nb.style === b.style && nb.spanY === b.spanY &&
                    nb.y === b.y && nb.height === b.height && Math.random() < 0.72) {
                    b.width += nb.width + GAP;
                    b.spanX += nb.spanX;
                    nb.dead = true;
                    didMerge = true;
                    continue;
                }
                // Merge with bottom neighbor
                nb = map.get(b.tileX + ',' + (b.tileY + b.spanY));
                if (nb && !nb.dead && nb.style === b.style && nb.spanX === b.spanX &&
                    nb.x === b.x && nb.width === b.width && Math.random() < 0.72) {
                    b.height += nb.height + GAP;
                    b.spanY += nb.spanY;
                    nb.dead = true;
                    didMerge = true;
                }
            }
        }
        this.buildings = rest.concat(singles.filter(b => !b.dead));
    }

    populateWorldProps() {
        if (typeof propsManager === 'undefined') return;
        propsManager.clear();

        const cellSize = 96;

        // 1. Add Stunt Ramps (airport tile + graph bridge approaches)
        for (let ramp of this.stuntRamps) {
            propsManager.addProp('ramp', ramp.x, ramp.y, { angle: ramp.angle });
        }
        for (let ramp of this.rampProps) {
            propsManager.addProp('ramp', ramp.x, ramp.y, { angle: ramp.angle });
        }

        // 1b. Roundabout fountains
        for (let r of this.roundabouts) {
            propsManager.addProp('fountain', r.x, r.y);
        }

        // 2. Add Palm Trees on Beach & Coastal areas
        for (let sand of this.sandTiles) {
            if (Math.random() < 0.45) {
                propsManager.addProp('tree_palm', sand.x + 20 + Math.random() * (cellSize - 40), sand.y + 20 + Math.random() * (cellSize - 40));
            }
        }

        // 2b. Beach umbrellas & deck chairs
        let umbrellaColors = ['#EF5350', '#AB47BC', '#FFCA28', '#29B6F6'];
        let ui = 0;
        for (let sand of this.sandTiles) {
            if (Math.random() < 0.14) {
                propsManager.addProp('umbrella',
                    sand.x + 25 + Math.random() * (cellSize - 50),
                    sand.y + 25 + Math.random() * (cellSize - 50),
                    { color: umbrellaColors[ui++ % umbrellaColors.length] });
            }
            if (Math.random() < 0.09) {
                propsManager.addProp('deckchair',
                    sand.x + 20 + Math.random() * (cellSize - 40),
                    sand.y + 20 + Math.random() * (cellSize - 40));
            }
        }

        // 2c. Plaza fountains & benches
        for (let pl of this.plazaTiles) {
            if (((pl.x / cellSize) + (pl.y / cellSize)) % 3 === 0) {
                propsManager.addProp('fountain', pl.x + cellSize / 2, pl.y + cellSize / 2);
            }
            if (Math.random() < 0.4) {
                propsManager.addProp('bench', pl.x + 15 + Math.random() * (cellSize - 30), pl.y + 15 + Math.random() * (cellSize - 30));
            }
        }

        // 2c-b. Pier lamps & benches
        for (let p of this.pierTiles) {
            if (Math.random() < 0.4) {
                propsManager.addProp('street_lamp', p.x + 14 + Math.random() * (cellSize - 28), p.y + 14);
            }
            if (Math.random() < 0.18) {
                propsManager.addProp('bench', p.x + 20 + Math.random() * (cellSize - 40), p.y + cellSize / 2);
            }
        }

        // 2c-c. Parking lots & construction sites
        for (let o of this.openTiles) {
            if (o.kind === 'LOT') {
                if (Math.random() < 0.5) propsManager.addProp('street_lamp', o.x + 10, o.y + 10);
                if (Math.random() < 0.35) propsManager.addProp('trash_can', o.x + o.width - 16, o.y + o.height - 12);
            } else if (o.kind === 'DIRT') {
                if (Math.random() < 0.3) propsManager.addProp('trash_can', o.x + 20 + Math.random() * (cellSize - 40), o.y + 20 + Math.random() * (cellSize - 40));
            }
        }

        // 2c-d. Riverside benches facing the water
        for (let p of this.parkTiles) {
            const tx = Math.round(p.x / cellSize), ty = Math.round(p.y / cellSize);
            const above = this.grid[ty - 1] && this.grid[ty - 1][tx];
            if (above && (above === 'W' || above === 'W_COAST' || above === 'W_POND') && Math.random() < 0.5) {
                propsManager.addProp('bench', p.x + cellSize / 2 + (Math.random() * 20 - 10), p.y + 16);
            }
        }

        // 2d. Parked airliner on the airport apron (with invisible collision box)
        let apronTiles = this.runwayTiles.filter(r => r.apron);
        let planeX, planeY;
        if (apronTiles.length > 0) {
            const minXp = Math.min(...apronTiles.map(t => t.x));
            const maxXp = Math.max(...apronTiles.map(t => t.x + t.width));
            const minYp = Math.min(...apronTiles.map(t => t.y));
            const maxYp = Math.max(...apronTiles.map(t => t.y + t.height));
            planeX = (minXp + maxXp) / 2;
            planeY = (minYp + maxYp) / 2;
        } else {
            planeX = 42.5 * cellSize;
            planeY = 34.5 * cellSize;
        }
        propsManager.addProp('plane', planeX, planeY, { angle: -0.05 });
        this.buildings.push({ x: planeX - 80, y: planeY - 52, width: 160, height: 104, style: 'invisible' });

        // 3. Add Oak Trees & Benches in Central Park
        for (let park of this.parkTiles) {
            if (Math.random() < 0.6) {
                propsManager.addProp('tree_oak', park.x + 20 + Math.random() * (cellSize - 40), park.y + 20 + Math.random() * (cellSize - 40));
            }
            if (Math.random() < 0.3) {
                propsManager.addProp('bench', park.x + 30 + Math.random() * (cellSize - 60), park.y + 30 + Math.random() * (cellSize - 60));
            }
        }

        // 4. Street furniture along the road graph (sampled along edges)
        for (let e of this.edges) {
            for (let d = 60; d < e.len; d += 260) {
                const p = this.pointAtDist(e, d);
                const rx = -Math.sin(p.ang), ry = Math.cos(p.ang);
                const sideOff = e.w / 2 + 10;
                const r = Math.random();
                if (r < 0.3) {
                    propsManager.addProp('street_lamp', p.x + rx * sideOff, p.y + ry * sideOff);
                } else if (r < 0.45) {
                    propsManager.addProp('hydrant', p.x - rx * sideOff, p.y - ry * sideOff);
                } else if (r < 0.6) {
                    propsManager.addProp('parking_meter', p.x + rx * sideOff, p.y + ry * sideOff);
                } else if (r < 0.7) {
                    propsManager.addProp('trash_can', p.x - rx * sideOff, p.y - ry * sideOff);
                }
            }
        }

        // 5. Scatter Collectibles throughout the city
        // Cash piles on random road edges
        for (let i = 0; i < 60; i++) {
            const r = this.edges[Math.floor(Math.random() * this.edges.length)];
            if (r) {
                const p = this.pointAtDist(r, Math.random() * r.len);
                propsManager.addPickup('cash', p.x, p.y, 100 + Math.floor(Math.random() * 200));
            }
        }

        // Medkits near Hospital and in Park
        for (let lm of this.landmarks) {
            if (lm.type === 'hospital') {
                propsManager.addPickup('health', lm.bayX - 30, lm.bayY + 30, 50);
                propsManager.addPickup('health', lm.bayX + 30, lm.bayY + 30, 50);
            } else if (lm.type === 'police') {
                propsManager.addPickup('armor', lm.bayX - 30, lm.bayY + 30, 50);
                propsManager.addPickup('star', lm.bayX + 30, lm.bayY + 30, 1);
            } else if (lm.type === 'ammu') {
                propsManager.addPickup('weapon', lm.bayX - 30, lm.bayY + 30, 1);
            }
        }

        // Police Bribe Stars in hidden alleys
        for (let i = 0; i < 14; i++) {
            let b = this.buildings[Math.floor(Math.random() * this.buildings.length)];
            if (b && b.style !== 'border') {
                propsManager.addPickup('star', b.x - 15, b.y - 15, 1);
            }
        }
    }

    getWorldSize() {
        return {
            width: this.width * 96,
            height: this.height * 96
        };
    }

    drawTerrain(ctx, camera, time, lightLevel) {
        const viewMargin = 120;
        const minX = camera.x - viewMargin;
        const maxX = camera.x + camera.width + viewMargin;
        const minY = camera.y - viewMargin;
        const maxY = camera.y + camera.height + viewMargin;

        // 1. Draw Sand / Beach
        ctx.fillStyle = '#EED8AE'; // Warm golden beach sand
        for (let s of this.sandTiles) {
            if (s.x >= minX && s.x <= maxX && s.y >= minY && s.y <= maxY) {
                ctx.fillRect(s.x, s.y, s.width, s.height);
                // Subtle sand texture specks
                ctx.fillStyle = '#DEC090';
                ctx.fillRect(s.x + 20, s.y + 15, 3, 2);
                ctx.fillRect(s.x + 65, s.y + 50, 4, 2);
                ctx.fillStyle = '#EED8AE';
            }
        }

        // 2. Draw Park Grass & Gardens
        ctx.fillStyle = '#388E3C'; // Vibrant park green
        for (let p of this.parkTiles) {
            if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) {
                ctx.fillRect(p.x, p.y, p.width, p.height);
                // Park stone footpath
                ctx.fillStyle = '#C8B88A';
                ctx.fillRect(p.x + p.width * 0.4, p.y, p.width * 0.2, p.height);
                ctx.fillStyle = '#388E3C';
            }
        }

        // 3. Draw Swimming Pools in Suburbs
        for (let pool of this.poolTiles) {
            if (pool.x >= minX && pool.x <= maxX && pool.y >= minY && pool.y <= maxY) {
                // Concrete patio
                ctx.fillStyle = '#D6D6C8';
                ctx.fillRect(pool.x + 10, pool.y + 10, pool.width - 20, pool.height - 20);
                // Pool water
                ctx.fillStyle = '#00B4D8';
                ctx.fillRect(pool.x + 18, pool.y + 18, pool.width - 36, pool.height - 36);
                // Pool shimmer
                let shimmer = Math.sin(time * 0.003 + pool.x) * 0.2 + 0.8;
                ctx.fillStyle = `rgba(255, 255, 255, ${0.25 * shimmer})`;
                ctx.fillRect(pool.x + 24, pool.y + 24, pool.width - 48, 4);
            }
        }

        // 3b. Draw City Plaza paving
        for (let pl of this.plazaTiles) {
            if (pl.x >= minX && pl.x <= maxX && pl.y >= minY && pl.y <= maxY) {
                ctx.fillStyle = '#9E9E9E';
                ctx.fillRect(pl.x, pl.y, pl.width, pl.height);
                // Paving stone grid lines
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(pl.x + pl.width / 2, pl.y);
                ctx.lineTo(pl.x + pl.width / 2, pl.y + pl.height);
                ctx.moveTo(pl.x, pl.y + pl.height / 2);
                ctx.lineTo(pl.x + pl.width, pl.y + pl.height / 2);
                ctx.stroke();
            }
        }

        // 3c. Draw Airport Runway & Apron
        for (let rw of this.runwayTiles) {
            if (rw.x >= minX && rw.x <= maxX && rw.y >= minY && rw.y <= maxY) {
                if (rw.apron) {
                    // Concrete apron with yellow taxi guide line
                    ctx.fillStyle = '#4E4E4E';
                    ctx.fillRect(rw.x, rw.y, rw.width, rw.height);
                    ctx.strokeStyle = 'rgba(255, 214, 0, 0.55)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([14, 10]);
                    ctx.beginPath();
                    ctx.moveTo(rw.x + 8, rw.y + rw.height / 2);
                    ctx.lineTo(rw.x + rw.width - 8, rw.y + rw.height / 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                } else {
                    // Dark asphalt runway
                    ctx.fillStyle = '#2C2C2C';
                    ctx.fillRect(rw.x, rw.y, rw.width, rw.height);
                    // White centerline dashes
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
                    ctx.lineWidth = 3;
                    ctx.setLineDash([26, 18]);
                    ctx.beginPath();
                    ctx.moveTo(rw.x + 6, rw.y + rw.height / 2);
                    ctx.lineTo(rw.x + rw.width - 6, rw.y + rw.height / 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    // Threshold stripes on west end
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                    for (let i = 8; i < rw.height - 8; i += 11) {
                        ctx.fillRect(rw.x + 4, rw.y + i, 9, 5);
                    }
                }
            }
        }

        // 3b. Draw Parking Lots & Construction Sites
        for (let o of this.openTiles) {
            if (o.x < minX || o.x > maxX || o.y < minY || o.y > maxY) continue;
            if (o.kind === 'LOT') {
                // Asphalt lot with painted stalls
                ctx.fillStyle = '#3A3A3A';
                ctx.fillRect(o.x, o.y, o.width, o.height);
                ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                for (let i = 12; i < o.width - 8; i += 22) {
                    ctx.moveTo(o.x + i, o.y + 10);
                    ctx.lineTo(o.x + i, o.y + 38);
                    ctx.moveTo(o.x + i, o.y + o.height - 38);
                    ctx.lineTo(o.x + i, o.y + o.height - 10);
                }
                ctx.stroke();
            } else {
                // Construction site: churned dirt with tracks & debris
                ctx.fillStyle = '#96825D';
                ctx.fillRect(o.x, o.y, o.width, o.height);
                ctx.fillStyle = '#7A6A4C';
                for (let i = 0; i < 5; i++) {
                    const bx = o.x + ((i * 37 + o.x) % (o.width - 24));
                    const by = o.y + ((i * 53 + o.y) % (o.height - 20));
                    ctx.fillRect(bx, by, 18 + (i % 3) * 6, 8 + (i % 2) * 5);
                }
                ctx.strokeStyle = '#5C5038';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(o.x + 8, o.y + o.height - 14);
                ctx.quadraticCurveTo(o.x + o.width / 2, o.y + o.height / 2, o.x + o.width - 8, o.y + 14);
                ctx.stroke();
            }
        }

        // 3c. Draw Wooden Piers over Water
        for (let p of this.pierTiles) {
            if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue;
            // Dark water beneath
            ctx.fillStyle = '#023E8A';
            ctx.fillRect(p.x, p.y, p.width, p.height);
            // Planked deck
            for (let i = 0; i < p.height; i += 10) {
                ctx.fillStyle = (i / 10) % 2 === 0 ? '#A1887F' : '#8D6E63';
                ctx.fillRect(p.x + 4, p.y + i + 1, p.width - 8, 8);
            }
            // Support posts
            ctx.fillStyle = '#5D4037';
            ctx.fillRect(p.x + 2, p.y + 4, 5, 5);
            ctx.fillRect(p.x + p.width - 7, p.y + 4, 5, 5);
            ctx.fillRect(p.x + 2, p.y + p.height - 9, 5, 5);
            ctx.fillRect(p.x + p.width - 7, p.y + p.height - 9, 5, 5);
        }

        // 4. Draw Water (Ocean, Shoreline, River and Ponds) with Animated Waves
        for (let w of this.waterTiles) {
            if (w.x >= minX && w.x <= maxX && w.y >= minY && w.y <= maxY) {
                if (w.type === 'W_POND') {
                    // Park Pond (Deep teal)
                    ctx.fillStyle = '#007799';
                    ctx.fillRect(w.x, w.y, w.width, w.height);
                    let wave = Math.sin(time * 0.003 + w.x * 0.05) * 3;
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.fillRect(w.x + 15, w.y + 30 + wave, 40, 2);
                } else if (w.type === 'W_COAST') {
                    // Coastline wave foam
                    ctx.fillStyle = '#0096C7';
                    ctx.fillRect(w.x, w.y, w.width, w.height);
                    let waveOffset = Math.sin(time * 0.002 + w.y * 0.04) * 8;
                    // White frothy foam edge
                    ctx.fillStyle = 'rgba(240, 250, 255, 0.75)';
                    ctx.fillRect(w.x - 4 + waveOffset, w.y, 8, w.height);
                } else {
                    // Deep ocean / river water
                    ctx.fillStyle = '#023E8A';
                    ctx.fillRect(w.x, w.y, w.width, w.height);
                    let wave1 = Math.sin(time * 0.002 + w.x * 0.03 + w.y * 0.02) * 5;
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
                    ctx.fillRect(w.x + 20, w.y + 25 + wave1, 55, 3);
                    ctx.fillRect(w.x + 50, w.y + 65 - wave1, 35, 2.5);
                }
            }
        }

        // 5. ROAD GRAPH - continuous spline carriageways between nodes
        this.drawRoadGraph(ctx, minX, maxX, minY, maxY);

    }

    // Render the road graph: roundabout plazas, bridge beds, sidewalks,
    // asphalt, and centerline markings for every edge in view.
    drawRoadGraph(ctx, minX, maxX, minY, maxY) {
        const visible = e => e.bbox.x1 >= minX - 150 && e.bbox.x0 <= maxX + 150 &&
                             e.bbox.y1 >= minY - 150 && e.bbox.y0 <= maxY + 150;
        const trace = e => {
            ctx.beginPath();
            ctx.moveTo(e.pts[0][0], e.pts[0][1]);
            for (let i = 1; i < e.pts.length; i++) ctx.lineTo(e.pts[i][0], e.pts[i][1]);
        };

        // 0. Roundabout plazas
        for (const r of this.roundabouts) {
            if (r.x < minX - 200 || r.x > maxX + 200 || r.y < minY - 200 || r.y > maxY + 200) continue;
            ctx.fillStyle = '#9E9E9E';
            ctx.beginPath();
            ctx.arc(r.x, r.y, 74, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#757575';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(r.x, r.y, 52, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 1. Underlays: bridge water beds & railings
        for (const e of this.edges) {
            if (!visible(e)) continue;
            if (!e.bridge) continue;
            ctx.strokeStyle = '#023E8A';
            ctx.lineWidth = e.w + 26;
            trace(e); ctx.stroke();
            ctx.strokeStyle = '#78909C';
            ctx.lineWidth = e.w + 12;
            trace(e); ctx.stroke();
        }

        // 2. Sidewalks
        ctx.strokeStyle = '#A0A0A0';
        for (const e of this.edges) {
            if (!visible(e) || e.bridge) continue;
            ctx.lineWidth = e.w + 14;
            trace(e); ctx.stroke();
        }

        // 3. Asphalt
        for (const e of this.edges) {
            if (!visible(e)) continue;
            ctx.strokeStyle = e.kind === 'highway' ? '#1A1A1A' : '#212121';
            ctx.lineWidth = e.w;
            trace(e); ctx.stroke();
        }

        // 4. Markings
        for (const e of this.edges) {
            if (!visible(e)) continue;
            if (e.kind === 'highway' || e.kind === 'boulevard' || e.kind === 'beltway') {
                // Double yellow (yellow stroke with dark core)
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 5;
                trace(e); ctx.stroke();
                ctx.strokeStyle = e.kind === 'highway' ? '#1A1A1A' : '#212121';
                ctx.lineWidth = 1.6;
                trace(e); ctx.stroke();
            } else {
                ctx.strokeStyle = 'rgba(255,255,255,0.45)';
                ctx.lineWidth = 2.5;
                ctx.setLineDash([16, 22]);
                trace(e); ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        // 5. Junction patches so node areas read as one surface
        ctx.fillStyle = '#212121';
        for (const n of this.nodes) {
            if (n.deg < 3 || n.x < minX - 100 || n.x > maxX + 100 || n.y < minY - 100 || n.y > maxY + 100) continue;
            ctx.beginPath();
            ctx.arc(n.x, n.y, 46, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.lineCap = 'butt';
    }

    drawLandmarks(ctx, camera, time) {
        for (let lm of this.landmarks) {
            let flash = Math.sin(time * 0.006) * 0.3 + 0.7;

            // Interactive Zone Bay Marker on Ground
            ctx.save();
            ctx.translate(lm.bayX, lm.bayY);

            if (lm.type === 'pns') {
                // Yellow/Black bay
                ctx.fillStyle = `rgba(255, 215, 0, ${0.3 * flash})`;
                ctx.beginPath();
                ctx.arc(0, 0, 35, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 3;
                ctx.stroke();

                ctx.fillStyle = '#FFD700';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText("PAY 'N' SPRAY", 0, -42);
            } else if (lm.type === 'ammu') {
                // Red Gun shop bay
                ctx.fillStyle = `rgba(255, 50, 50, ${0.3 * flash})`;
                ctx.beginPath();
                ctx.arc(0, 0, 35, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#FF3333';
                ctx.lineWidth = 3;
                ctx.stroke();

                ctx.fillStyle = '#FF3333';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText("AMMU-NATION", 0, -42);
            } else if (lm.type === 'diner') {
                // Orange Diner bay
                ctx.fillStyle = `rgba(255, 150, 0, ${0.3 * flash})`;
                ctx.beginPath();
                ctx.arc(0, 0, 35, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#FF9900';
                ctx.lineWidth = 3;
                ctx.stroke();

                ctx.fillStyle = '#FF9900';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText("BURGER SHOT ($20)", 0, -42);
            } else if (lm.type === 'gas') {
                // Green Fuel Station forecourt
                ctx.fillStyle = `rgba(102, 187, 106, ${0.28 * flash})`;
                ctx.beginPath();
                ctx.arc(0, 0, 38, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#66BB6A';
                ctx.lineWidth = 3;
                ctx.setLineDash([10, 6]);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = '#66BB6A';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText("⛽ FUEL & REPAIR ($50)", 0, -46);
            } else if (lm.type === 'casino') {
                // Pink Casino entrance glow
                let pulse = Math.sin(time * 0.005) * 0.15 + 0.35;
                ctx.fillStyle = `rgba(255, 64, 129, ${pulse})`;
                ctx.beginPath();
                ctx.arc(0, 0, 40, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#FF4081';
                ctx.lineWidth = 3;
                ctx.stroke();

                ctx.fillStyle = Math.floor(time / 400) % 2 === 0 ? '#FF4081' : '#F8BBD0';
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText("♦ CASINO ♦", 0, -48);
            }
            ctx.restore();
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = World;
}
