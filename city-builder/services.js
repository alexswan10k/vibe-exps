// Utility and Civic Services distribution:
// - Power and water flow through the connected road/bridge network.
// - Fire, Police, Health, and Education provide radial/network coverage to protect
//   citizens, suppress crime, heal illness, and educate workers for high-tech towers.
// - Funding multipliers from the municipal budget scale service capacities and effectiveness.

class Services {
    constructor(city) {
        this.city = city;
        this.poweredRoads = new Set();
        this.wateredRoads = new Set();
        this.roadDistance = new Int16Array(city.width * city.height).fill(-1);
        this.version = -1;

        // Coverage maps (tile index -> boolean or level)
        this.fireCoverage = new Uint8Array(city.width * city.height);
        this.policeCoverage = new Uint8Array(city.width * city.height);
        this.healthCoverage = new Uint8Array(city.width * city.height);
        this.educationCoverage = new Uint8Array(city.width * city.height);

        // Aggregate statistics
        this.powerProd = 0;
        this.powerDemand = 0;
        this.powerServed = 0;
        this.waterProd = 0;
        this.waterDemand = 0;
        this.waterServed = 0;
        this.brownouts = false;
        this.waterShort = false;

        this.fireScore = 100;
        this.policeScore = 100;
        this.healthScore = 70;
        this.educationScore = 50;
    }

    update(economy) {
        const city = this.city;
        const funding = (economy && economy.funding) || CONFIG.DEFAULT_FUNDING;

        this.poweredRoads.clear();
        this.wateredRoads.clear();
        this.fireCoverage.fill(0);
        this.policeCoverage.fill(0);
        this.healthCoverage.fill(0);
        this.educationCoverage.fill(0);

        // --- Road graph (both roads and bridges) ---
        const roads = [];
        const isRoadIdx = new Set();
        for (const b of city.buildings.values()) {
            if (b.type !== 'road' && b.type !== 'bridge') continue;
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

        const roadAdj = new Map();
        for (const idx of roads) {
            const x = idx % city.width;
            const y = Math.floor(idx / city.width);
            roadAdj.set(idx, neighborsOf(x, y).filter(n => isRoadIdx.has(n)));
        }

        // --- Utility Distribution (Power & Water) ---
        const spreadFrom = (types, targetSet) => {
            const queue = [];
            for (const b of city.buildings.values()) {
                if (!types.includes(b.type)) continue;
                if (b.state === 'rubble') continue;
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
                const neighbors = roadAdj.get(idx) || [];
                for (const n of neighbors) {
                    if (!targetSet.has(n)) {
                        targetSet.add(n);
                        queue.push(n);
                    }
                }
            }
        };

        spreadFrom(['power', 'wind_turbine'], this.poweredRoads);
        spreadFrom(['water', 'water_pump'], this.wateredRoads);

        // --- Distance to nearest road (drives development eligibility) ---
        const dist = this.roadDistance;
        dist.fill(-1);
        let frontier = [];
        for (const r of roads) { dist[r] = 0; frontier.push(r); }
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

        // --- Civic Radial Coverage (Fire, Police, Health, Education) ---
        const applyCivicCoverage = (type, coverageArray, baseRadius, fundingKey) => {
            const mult = funding[fundingKey] !== undefined ? funding[fundingKey] : 1.0;
            const effRadius = Math.max(2, Math.round(baseRadius * mult));

            for (const b of city.buildings.values()) {
                if (b.type !== type || b.state !== 'built') continue;
                const cx = b.x + 0.5, cy = b.y + 0.5;
                const rInt = Math.ceil(effRadius);

                for (let dy = -rInt; dy <= rInt; dy++) {
                    for (let dx = -rInt; dx <= rInt; dx++) {
                        const tx = Math.floor(cx + dx);
                        const ty = Math.floor(cy + dy);
                        if (!city.inBounds(tx, ty)) continue;
                        const d = Math.hypot(tx - cx, ty - cy);
                        if (d <= effRadius) {
                            const idx = city.idx(tx, ty);
                            const val = Math.min(255, Math.round((1 - (d / (effRadius + 1))) * 100));
                            coverageArray[idx] = Math.max(coverageArray[idx], val);
                        }
                    }
                }
            }
        };

        applyCivicCoverage('fire_station', this.fireCoverage, 18, 'fire');
        applyCivicCoverage('police_station', this.policeCoverage, 20, 'police');
        applyCivicCoverage('hospital', this.healthCoverage, 22, 'health');
        applyCivicCoverage('school', this.educationCoverage, 20, 'education');

        // --- Pass 1: Sum capacities and potential demand ---
        this.powerProd = 0;
        this.powerDemand = 0;
        this.waterProd = 0;
        this.waterDemand = 0;
        this._infraPowerUse = 0;
        this._infraWaterUse = 0;

        const powerFunding = funding.power !== undefined ? funding.power : 1.0;
        const waterFunding = funding.water !== undefined ? funding.water : 1.0;

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

            const bIdx = city.idx(b.x, b.y);
            b.fireCoverage = this.fireCoverage[bIdx] > 0;
            b.policeCoverage = this.policeCoverage[bIdx] > 0;
            b.healthCoverage = this.healthCoverage[bIdx] > 0;
            b.educationCoverage = this.educationCoverage[bIdx] > 0;

            const def = INFRASTRUCTURE[b.type];
            if (def) {
                b.connected = touchesRoad || b.type === 'road' || b.type === 'bridge';
                b.powered = true;
                b.watered = true;
                b._needsPower = undefined;
                if (b.state !== 'built') continue;

                if (def.powerProduction) {
                    this.powerProd += Math.round(def.powerProduction * powerFunding);
                }
                if (def.waterProduction) {
                    this.waterProd += Math.round(def.waterProduction * waterFunding);
                }

                const pUse = def.powerConsumption || 0;
                const wUse = def.waterConsumption || 0;
                this.powerDemand += pUse;
                this.waterDemand += wUse;
                this._infraPowerUse += pUse;
                this._infraWaterUse += wUse;
                continue;
            }

            // Private zone building
            b.connected = touchesRoad;
            b._onPowerGrid = onPowerGrid;
            b._onWaterGrid = onWaterGrid;

            if (b.state !== 'built') {
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

        // --- Pass 2: Ration power and water capacity ---
        let availPower = this.powerProd - this._infraPowerUse;
        let availWater = this.waterProd - this._infraWaterUse;

        this.powerServed = 0;
        this.waterServed = 0;
        this.brownouts = false;
        this.waterShort = false;

        let totalCivicNeeders = 0, fireCoveredCount = 0, policeCoveredCount = 0;
        let totalHealthScore = 0, totalEqScore = 0, totalPopCount = 0;

        for (const b of city.buildings.values()) {
            if (b._needsPower === undefined) continue;
            if (b.state !== 'built') continue;
            const lvl = levelDef(b.type, b.level);

            totalCivicNeeders++;
            if (b.fireCoverage) fireCoveredCount++;
            if (b.policeCoverage) policeCoveredCount++;

            const bIdx = city.idx(b.x, b.y);
            const popOrJobs = b.pop + b.jobs;
            if (popOrJobs > 0) {
                totalPopCount += popOrJobs;
                totalHealthScore += (this.healthCoverage[bIdx] || 25) * popOrJobs;
                totalEqScore += (this.educationCoverage[bIdx] || 20) * popOrJobs;
            }

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
                this.waterShort = true;
            }
        }

        // Compute aggregate municipal scores
        this.fireScore = totalCivicNeeders > 0 ? Math.round((fireCoveredCount / totalCivicNeeders) * 100) : 100;
        this.policeScore = totalCivicNeeders > 0 ? Math.round((policeCoveredCount / totalCivicNeeders) * 100) : 100;
        this.healthScore = totalPopCount > 0 ? Math.round(totalHealthScore / totalPopCount) : 70;
        this.educationScore = totalPopCount > 0 ? Math.round(totalEqScore / totalPopCount) : 50;
    }
}

window.Services = Services;
