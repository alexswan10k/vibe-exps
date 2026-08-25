// Economy: treasury, RCI market demand, population pool, happiness,
// land value and the monthly budget cycle.

class Economy {
    constructor() {
        this.money = CONFIG.START_MONEY;

        // Population / jobs are a city-wide pool assigned to serviced buildings
        this.population = 0;
        this.housedPopulation = 0;
        this.employed = 0;
        this.happiness = 55;

        // Wired to the active city by the Game (needed for land value queries)
        this.cityRef = null;

        // Market demand per zone type, roughly -1..1
        this.demand = { residential: 0, commercial: 0, industrial: 0 };

        // Calendar
        this.day = 1;          // absolute day count starting at 1
        this.lastMonthNet = 0;
        this.lastTaxIncome = 0;
        this.lastUpkeep = 0;
        this.history = [];     // last N months' net

        this._nextMonthlyCheck = CONFIG.DAYS_PER_MONTH;
    }

    tick() {
        // The day counter advances once per simulation tick
        if (this.day >= this._nextMonthlyCheck) {
            this._nextMonthlyCheck += CONFIG.DAYS_PER_MONTH;
            this.collectMonthlyTaxes();
        }
    }

    get dateLabel() {
        const dayOfMonth = ((this.day - 1) % CONFIG.DAYS_PER_MONTH) + 1;
        const month = Math.floor((this.day - 1) / CONFIG.DAYS_PER_MONTH) + 1;
        return `Y${Math.floor((month - 1) / 12) + 1} M${((month - 1) % 12) + 1} D${dayOfMonth}`;
    }

    // --- Capacities from currently built & serviced buildings ---
    capacities(city, services) {
        let housing = 0;         // serviced residential capacity
        let jobs = 0;            // serviced job capacity
        for (const b of city.buildings.values()) {
            if (b.state !== 'built' || INFRASTRUCTURE[b.type]) continue;
            const lvl = levelDef(b.type, b.level);
            const serviced = b.connected && (!b._needsPower || b.powered) && (!b._needsWater || b.watered);
            if (!serviced) continue;
            housing += lvl.capacity;
            jobs += lvl.jobCapacity;
        }
        return { housing, jobs };
    }

    // --- Demand model (RCI) ---
    updateDemand(city, services) {
        const { housing, jobs } = this.capacities(city, services);
        const workforceTarget = Math.floor(this.population * 0.62);
        const unemployed = Math.max(0, workforceTarget - this.employed);
        const openJobs = Math.max(0, jobs - this.employed);

        // People move in when there are jobs to fill and homes available
        const dRes = (jobs * 1.15 + 30 - this.population * 0.9) / 120 + openJobs / 200;
        this.demand.residential = clamp(dRes, -1, 1);

        // Businesses open when there are workers to hire
        const base = 0.08 + (unemployed / 70);
        this.demand.commercial = clamp(base - Math.max(0, jobs * 0.45 - workforceTarget) / 100, -1, 1);
        this.demand.industrial = clamp(base - Math.max(0, jobs * 0.55 - workforceTarget) / 100, -1, 1);

        return this.demand;
    }

    // --- Population dynamics ---
    updatePopulation(city, services, ticksDeltaMs) {
        const { housing } = this.capacities(city, services);

        // Only serviced, connected housing can hold people
        let target = housing;
        if (this.happiness < 35) target = Math.floor(target * 0.6);

        const seconds = ticksDeltaMs / 1000;
        if (this.population < target) {
            const rate = 1.5 + (this.happiness / 100) * 5;
            this.population = Math.min(target, this.population + rate * seconds);
        } else if (this.population > target) {
            this.population = Math.max(target, this.population - 10 * seconds);
        }

        // Assign residents to buildings and workers to workplaces
        this.assignPopulation(city, services);
    }

    assignPopulation(city, services) {
        let popRemaining = Math.floor(this.population);

        for (const b of city.buildings.values()) {
            if (b.type !== 'residential' || b.state !== 'built') { b.pop = 0; continue; }
            const lvl = levelDef('residential', b.level);
            const ok = b.connected && (!b._needsPower || b.powered) && (!b._needsWater || b.watered);
            if (!ok) { b.pop = 0; continue; }
            const take = Math.min(popRemaining, lvl.capacity);
            b.pop = take;
            popRemaining -= take;
        }
        this.housedPopulation = Math.floor(this.population) - popRemaining;

        const workforce = Math.floor(this.housedPopulation * 0.62);
        let jobsRemaining = workforce;

        for (const b of city.buildings.values()) {
            if ((b.type !== 'commercial' && b.type !== 'industrial') || b.state !== 'built') { b.jobs = 0; continue; }
            const lvl = levelDef(b.type, b.level);
            const ok = b.connected && (!b._needsPower || b.powered) && (!b._needsWater || b.watered);
            if (!ok) { b.jobs = 0; continue; }
            const take = Math.min(jobsRemaining, lvl.jobCapacity);
            b.jobs = take;
            jobsRemaining -= take;
        }
        this.employed = workforce - jobsRemaining;
    }

    // --- Happiness ---
    updateHappiness(city, services) {
        let happiness = 55;

        let powerNeeders = 0, poweredOk = 0;
        let waterNeeders = 0, wateredOk = 0;
        let industryCount = 0;
        let parkCount = 0;

        for (const b of city.buildings.values()) {
            if (b.state !== 'built') continue;
            if (b.type === 'park') parkCount++;
            if (INFRASTRUCTURE[b.type]) continue;
            if (b.type === 'industrial') industryCount++;
            if (b._needsPower) { powerNeeders++; if (b.powered) poweredOk++; }
            if (b._needsWater) { waterNeeders++; if (b.watered) wateredOk++; }
        }

        if (powerNeeders > 0) {
            const ratio = poweredOk / powerNeeders;
            happiness += ratio > 0.999 ? 12 : -22 * (1 - ratio);
        }
        if (waterNeeders > 0) {
            const ratio = wateredOk / waterNeeders;
            happiness += ratio > 0.999 ? 12 : -22 * (1 - ratio);
        }

        const workforceTarget = Math.floor(this.housedPopulation * 0.62);
        if (workforceTarget >= 2) {
            const empRate = Math.min(1, this.employed / workforceTarget);
            happiness -= (1 - empRate) * 26;
        }

        happiness += Math.min(8, 3 * Math.sqrt(parkCount));
        happiness -= Math.min(14, 2.5 * Math.sqrt(industryCount));

        this.happiness = clamp(Math.round(happiness), 0, 100);
    }

    // --- Land value at a tile: drives density upgrades and tax yield ---
    landValue(x, y) {
        const city = this.cityRef;
        if (!city) return 10;

        let value = 10;
        const R = 4;

        for (let dy = -R; dy <= R; dy++) {
            for (let dx = -R; dx <= R; dx++) {
                const tx = x + dx, ty = y + dy;
                if (!city.inBounds(tx, ty)) continue;
                const t = city.terrainAt(tx, ty);
                if (t === TERRAIN.WATER && (Math.abs(dx) <= 1 && Math.abs(dy) <= 1)) value += 8;
                const b = city.buildingAt(tx, ty);
                if (!b || b.state !== 'built') continue;
                if (b.type === 'park') value += 7;
                else if (b.type === 'industrial') value -= 3;
            }
        }

        value = clamp(value, 0, 60);
        return Math.round(value);
    }

    taxMultiplier(landValue) {
        return 0.75 + landValue / 48;
    }

    // --- Monthly budget ---
    collectMonthlyTaxes() {
        const city = this.cityRef;
        if (!city) return;

        let income = 0;
        let upkeep = 0;

        for (const b of city.buildings.values()) {
            if (b.state !== 'built') continue;
            const def = INFRASTRUCTURE[b.type];
            if (def) {
                const key = def.upkeepKey;
                if (key === 'roadPerTile') upkeep += CONFIG.UPGKEEP_PER_MONTH.roadPerTile;
                else upkeep += CONFIG.UPGKEEP_PER_MONTH[key] || 0;

                income += (def.jobs || 0) * 1.5 * this.taxMultiplier(this.landValue(b.x, b.y));
                continue;
            }

            const lvMult = this.taxMultiplier(this.landValue(b.x, b.y));
            const lvl = levelDef(b.type, b.level);
            const levelBonus = 1 + (b.level - 1) * 0.35;

            if (b.type === 'residential') {
                income += b.pop * CONFIG.TAXES_PER_MONTH.residentialPerResident * levelBonus * lvMult;
            } else if (b.type === 'commercial') {
                income += b.jobs * CONFIG.TAXES_PER_MONTH.commercialPerJob * levelBonus * lvMult;
            } else if (b.type === 'industrial') {
                income += b.jobs * CONFIG.TAXES_PER_MONTH.industrialPerJob * levelBonus * lvMult;
            }
        }

        this.lastTaxIncome = income;
        this.lastUpkeep = upkeep;
        this.lastMonthNet = income - upkeep;
        this.money += this.lastMonthNet;

        this.history.push({ net: this.lastMonthNet });
        if (this.history.length > 36) this.history.shift();
    }

    canAfford(amount) {
        return this.money >= amount;
    }

    spend(amount) {
        if (amount <= 0) return true;
        if (this.money < amount) return false;
        this.money -= amount;
        return true;
    }

    earn(amount) {
        this.money += amount;
    }

    serialize() {
        return {
            money: this.money,
            day: this.day,
            population: this.population,
            employed: this.employed,
            happiness: this.happiness,
            history: this.history,
            nextMonthlyCheck: this._nextMonthlyCheck
        };
    }

    static deserialize(data) {
        const econ = new Economy();
        econ.money = data.money ?? econ.money;
        econ.day = data.day ?? 1;
        econ.population = data.population ?? 0;
        econ.employed = data.employed ?? 0;
        econ.happiness = data.happiness ?? 55;
        econ.history = data.history || [];
        econ._nextMonthlyCheck = data.nextMonthlyCheck || CONFIG.DAYS_PER_MONTH;
        return econ;
    }
}

window.Economy = Economy;
