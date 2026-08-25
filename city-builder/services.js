// Utility distribution: power and water flow through the road network
// (pipes/cables run under roads). A building is serviced when a road tile
// adjacent to it is reachable from a producing utility AND there is enough
// production capacity. Scarce capacity is rationed first-come-first-served
// in build order, so new buildings brown out first when you're underpowered.

class Services {
    constructor(city) {
        this.city = city;
        this.poweredRoads = new Set();   // road tile indexes reachable from power plants
        this.wateredRoads = new Set();
        this.roadDistance = new Int16Array(city.width * city.height).fill(-1);
        this.version = -1;               // city.servicesVersion last computed

        // Aggregate stats (refreshed by update())
        this.powerProd = 0;
        this.powerDemand = 0;   // potential demand from all built consumers
        this.powerServed = 0;
        this.waterProd = 0;
        this.waterDemand = 0;
        this.waterServed = 0;
        this.brownouts = false; // connected buildings that couldn't get capacity
    }

    update() {
        const city = this.city;
        if (this.version === city.servicesVersion) return;
        this.version = city.servicesVersion;

        this.poweredRoads.clear();
        this.wateredRoads.clear();

        // --- Road graph ---
        const roads = [];
        const isRoadIdx = new Set();
        for (const b of city.buildings.values()) {
            if (b.type !== 'road') continue;
            const idx = city.idx(b.x, b.y);
            roads.push(idx);
            isRoadIdx.add(idx);
        }

        const neighborsOf = (x, y) => {
            const out = [];
            if (x > 0) out.push(city.idx(x - 1, y));
            if (x < city.width - 1) out.push(city.idx(x + 1, y));
            if (y > 0) out.push(city.idx(x, y - 1));
            if (y < city.height - 1) out.push(city.idx(x, y + 1));
            return out;
        };

        const roadAdj = new Map(); // roadIdx -> [neighbour roadIdx]
        for (const idx of roads) {
            const x = idx % city.width;
            const y = Math.floor(idx / city.width);
            roadAdj.set(idx, neighborsOf(x, y).filter(n => isRoadIdx.has(n)));
        }

        // --- Flood each utility network along roads ---
        const spreadFrom = (utilityType, targetSet) => {
            const queue = [];
            for (const b of city.buildings.values()) {
                if (b.type !== utilityType) continue;
                for (const adj of city.adjacentTiles(b)) {
                    if (!city.inBounds(adj.x, adj.y)) continue;
                    const idx = city.idx(adj.x, adj.y);
                    if (isRoadIdx.has(idx)) {
                        targetSet.add(idx);
                        queue.push(idx);
                    }
                }
            }
            while (queue.length > 0) {
                const idx = queue.pop();
                for (const n of roadAdj.get(idx)) {
                    if (!targetSet.has(n)) {
                        targetSet.add(n);
                        queue.push(n);
                    }
                }
            }
        };

        spreadFrom('power', this.poweredRoads);
        spreadFrom('water', this.wateredRoads);

        // --- Distance to nearest road (drives development eligibility) ---
        const dist = this.roadDistance;
        dist.fill(-1);
        let frontier = [];
        for (const r of roads) dist[r] = 0, frontier.push(r);
        let depth = 0;
        while (frontier.length > 0 && depth < CONFIG.DEV.ROAD_ACCESS_DIST) {
            const next = [];
            for (const idx of frontier) {
                const x = idx % city.width;
                const y = Math.floor(idx / city.width);
                for (const n of neighborsOf(x, y)) {
                    if (dist[n] === -1) {
                        dist[n] = depth + 1;
                        next.push(n);
                    }
                }
            }
            frontier = next;
            depth++;
        }

        // --- Pass 1: frontage reach and demand totals ---
        this.powerProd = 0;
        this.powerDemand = 0;
        this.waterProd = 0;
        this.waterDemand = 0;
        this._infraPowerUse = 0;   // utilities' own consumption
        this._infraWaterUse = 0;

        for (const b of city.buildings.values()) {
            let touchesRoad = false;
            let onPowerGrid = false;
            let onWaterGrid = false;

            for (const adj of city.adjacentTiles(b)) {
                if (!city.inBounds(adj.x, adj.y)) continue;
                const idx = city.idx(adj.x, adj.y);
                if (!isRoadIdx.has(idx)) continue;
                touchesRoad = true;
                if (this.poweredRoads.has(idx)) onPowerGrid = true;
                if (this.wateredRoads.has(idx)) onWaterGrid = true;
            }

            const def = INFRASTRUCTURE[b.type];
            if (def) {
                b.connected = touchesRoad || b.type === 'road';
                b.powered = true;
                b.watered = true;
                b._needsPower = undefined;
                if (b.state !== 'built') continue;
                this.powerProd += def.powerProduction || 0;
                this.waterProd += def.waterProduction || 0;
                this.powerDemand += def.powerConsumption || 0;
                this.waterDemand += def.waterConsumption || 0;
                this._infraPowerUse += def.powerConsumption || 0;
                this._infraWaterUse += def.waterConsumption || 0;
                continue;
            }

            b.connected = touchesRoad;
            b._onPowerGrid = onPowerGrid;
            b._onWaterGrid = onWaterGrid;
            if (b.state !== 'built') {
                // Construction sites are not yet drawing services
                b.powered = true;
                b.watered = true;
                continue;
            }
            const lvl = levelDef(b.type, b.level);
            b._needsPower = lvl.power > 0;
            b._needsWater = lvl.water > 0;
            if (b._needsPower) this.powerDemand += lvl.power;
            if (b._needsWater) this.waterDemand += lvl.water;
        }

        // --- Pass 2: ration scarce capacity in build order ---
        let availPower = this.powerProd - this._infraPowerUse;
        let availWater = this.waterProd - this._infraWaterUse;

        this.powerServed = 0;
        this.waterServed = 0;
        this.brownouts = false;

        for (const b of city.buildings.values()) {
            if (b._needsPower === undefined) continue;
            if (b.state !== 'built') continue;
            const lvl = levelDef(b.type, b.level);

            if (!b.connected) {
                b.powered = false;
                b.watered = false;
                continue;
            }

            if (!b._needsPower) {
                b.powered = true;
            } else if (b._onPowerGrid && availPower >= lvl.power) {
                availPower -= lvl.power;
                this.powerServed += lvl.power;
                b.powered = true;
            } else {
                b.powered = false;
                this.brownouts = true;
            }

            if (!b._needsWater) {
                b.watered = true;
            } else if (b._onWaterGrid && availWater >= lvl.water) {
                availWater -= lvl.water;
                this.waterServed += lvl.water;
                b.watered = true;
            } else {
                b.watered = false;
                this.brownouts = true;
            }
        }
    }
}

window.Services = Services;
