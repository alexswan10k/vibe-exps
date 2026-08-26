// Economy: treasury, tax rates, department funding, city ordinances,
// milestones, RCI market demand, population pool, happiness and monthly budget.

class Economy {
    constructor() {
        this.money = CONFIG.START_MONEY;

        this.population = 0;
        this.housedPopulation = 0;
        this.employed = 0;
        this.happiness = 65;

        this.cityRef = null;

        // Market demand per zone type (-1..1)
        this.demand = { residential: 0, commercial: 0, industrial: 0 };

        // Tax Rates (0% to 20%, default 9%)
        this.taxRates = {
            residential: CONFIG.DEFAULT_TAX_RATES.residential,
            commercial: CONFIG.DEFAULT_TAX_RATES.commercial,
            industrial: CONFIG.DEFAULT_TAX_RATES.industrial
        };

        // Department Budget Funding Multipliers (0.0 to 1.5)
        this.funding = { ...CONFIG.DEFAULT_FUNDING };

        // Active Ordinances (Set of ordinance IDs)
        this.ordinances = new Set();

        // City Milestones
        this.currentMilestoneIdx = 0;

        // Calendar & Accounting
        this.day = 1;
        this.lastMonthNet = 0;
        this.lastTaxIncome = 0;
        this.lastUpkeep = 0;
        this.lastOrdinancesCost = 0;
        this.history = [];

        this.breakdown = {
            taxRes: 0, taxCom: 0, taxInd: 0,
            upkeepRoads: 0, upkeepUtilities: 0, upkeepServices: 0,
            upkeepCivic: 0, ordinancesCost: 0, totalIncome: 0, totalExpenses: 0, net: 0
        };

        this._nextMonthlyCheck = CONFIG.DAYS_PER_MONTH;
    }

    tick() {
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

    get milestone() {
        return CONFIG.MILESTONES[this.currentMilestoneIdx] || CONFIG.MILESTONES[0];
    }

    // --- Capacities from currently built & serviced buildings ---
    capacities(city, services) {
        let housing = 0;
        let jobs = 0;
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

        // Tax sensitivity: 9% is neutral. Above 9% suppresses demand, below 9% stimulates it.
        const resTaxMod = (9 - this.taxRates.residential) * 0.055;
        const comTaxMod = (9 - this.taxRates.commercial) * 0.055;
        const indTaxMod = (9 - this.taxRates.industrial) * 0.055;

        // Ordinance bonuses
        const comOrdBonus = this.ordinances.has('tourism_drive') ? 0.20 : 0;

        // Residents seek jobs and affordable living
        const dRes = ((jobs * 1.15 + 35 - this.population * 0.88) / 110 + openJobs / 180) + resTaxMod;
        this.demand.residential = clamp(dRes, -1, 1);

        // Businesses open when workers are available and education/tourism is high
        const eqBoost = ((services ? services.educationScore : 50) - 50) / 200;
        const baseCom = 0.10 + (unemployed / 65) + comTaxMod + comOrdBonus + eqBoost;
        this.demand.commercial = clamp(baseCom - Math.max(0, jobs * 0.45 - workforceTarget) / 90, -1, 1);

        // Industrial demand
        const baseInd = 0.10 + (unemployed / 65) + indTaxMod;
        this.demand.industrial = clamp(baseInd - Math.max(0, jobs * 0.55 - workforceTarget) / 90, -1, 1);

        return this.demand;
    }

    // --- Population dynamics ---
    updatePopulation(city, services, ticksDeltaMs) {
        const { housing } = this.capacities(city, services);

        let target = housing;
        if (this.happiness < 40) target = Math.floor(target * 0.65);

        const seconds = ticksDeltaMs / 1000;
        if (this.population < target) {
            const rate = 1.8 + (this.happiness / 100) * 6;
            this.population = Math.min(target, this.population + rate * seconds);
        } else if (this.population > target) {
            this.population = Math.max(target, this.population - 12 * seconds);
        }

        this.assignPopulation(city, services);
        this.checkMilestones();
    }

    assignPopulation(city, services) {
        let popRemaining = Math.floor(this.population);

        for (const b of city.buildings.values()) {
            if (b.type !== 'residential' || b.state !== 'built' || b.onFire) { b.pop = 0; continue; }
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
            if ((b.type !== 'commercial' && b.type !== 'industrial') || b.state !== 'built' || b.onFire) { b.jobs = 0; continue; }
            const lvl = levelDef(b.type, b.level);
            const ok = b.connected && (!b._needsPower || b.powered) && (!b._needsWater || b.watered);
            if (!ok) { b.jobs = 0; continue; }
            const take = Math.min(jobsRemaining, lvl.jobCapacity);
            b.jobs = take;
            jobsRemaining -= take;
        }
        this.employed = workforce - jobsRemaining;
    }

    checkMilestones() {
        const pop = Math.floor(this.population);
        for (let i = CONFIG.MILESTONES.length - 1; i >= 0; i--) {
            if (pop >= CONFIG.MILESTONES[i].pop && i > this.currentMilestoneIdx) {
                this.currentMilestoneIdx = i;
                const m = CONFIG.MILESTONES[i];
                this.earn(m.reward);
                if (window.game && window.game.notify) {
                    window.game.notify(`🎉 Milestone Reached: ${m.title}! +$${m.reward.toLocaleString()}`, 'info');
                }
                if (window.game && window.game.audio) {
                    window.game.audio.playMilestone();
                }
                break;
            }
        }
    }

    // --- Happiness ---
    updateHappiness(city, services) {
        let happiness = 60;

        let powerNeeders = 0, poweredOk = 0;
        let waterNeeders = 0, wateredOk = 0;
        let industryCount = 0;
        let parkCount = 0;
        let cityHallCount = 0;

        for (const b of city.buildings.values()) {
            if (b.state !== 'built') continue;
            if (b.type === 'park') parkCount++;
            if (b.type === 'city_hall') cityHallCount++;
            if (INFRASTRUCTURE[b.type]) continue;
            if (b.type === 'industrial') industryCount++;
            if (b._needsPower) { powerNeeders++; if (b.powered) poweredOk++; }
            if (b._needsWater) { waterNeeders++; if (b.watered) wateredOk++; }
        }

        if (powerNeeders > 0) {
            const ratio = poweredOk / powerNeeders;
            happiness += ratio > 0.99 ? 10 : -25 * (1 - ratio);
        }
        if (waterNeeders > 0) {
            const ratio = wateredOk / waterNeeders;
            happiness += ratio > 0.99 ? 10 : -25 * (1 - ratio);
        }

        const workforceTarget = Math.floor(this.housedPopulation * 0.62);
        if (workforceTarget >= 2) {
            const empRate = Math.min(1, this.employed / workforceTarget);
            happiness -= (1 - empRate) * 28;
        }

        // Civic services contribution
        if (services) {
            happiness += (services.fireScore - 80) * 0.15;
            happiness += (services.policeScore - 80) * 0.18;
            happiness += (services.healthScore - 60) * 0.20;
            happiness += (services.educationScore - 50) * 0.15;
        }

        // Tax rate penalties (above 9% hurts happiness)
        const avgTax = (this.taxRates.residential + this.taxRates.commercial + this.taxRates.industrial) / 3;
        happiness -= (avgTax - 9) * 2.2;

        happiness += Math.min(10, 3.5 * Math.sqrt(parkCount));
        if (cityHallCount > 0) happiness += 6;
        happiness -= Math.min(16, 2.8 * Math.sqrt(industryCount));

        // Ordinances bonuses
        for (const ordId of this.ordinances) {
            const def = CONFIG.ORDINANCES[ordId];
            if (def && def.happyBonus) happiness += def.happyBonus;
        }

        this.happiness = clamp(Math.round(happiness), 0, 100);
    }

    // --- Land Value (0-100) ---
    landValue(x, y) {
        const city = this.cityRef;
        if (!city) return 15;

        let value = 15;
        const R = 4;

        for (let dy = -R; dy <= R; dy++) {
            for (let dx = -R; dx <= R; dx++) {
                const tx = x + dx, ty = y + dy;
                if (!city.inBounds(tx, ty)) continue;
                const t = city.terrainAt(tx, ty);
                if (t === TERRAIN.WATER && (Math.abs(dx) <= 1 && Math.abs(dy) <= 1)) value += 10;
                const b = city.buildingAt(tx, ty);
                if (!b || b.state !== 'built') continue;
                if (b.type === 'park') value += 8;
                else if (b.type === 'city_hall') value += 14;
                else if (b.type === 'hospital') value += 5;
                else if (b.type === 'school') value += 6;
                else if (b.type === 'industrial') value -= 4;
            }
        }

        value = clamp(value, 0, 100);
        return Math.round(value);
    }

    taxMultiplier(landVal) {
        return 0.75 + landVal / 50;
    }

    // --- Monthly Budget Collection ---
    collectMonthlyTaxes() {
        const city = this.cityRef;
        if (!city) return;

        let taxRes = 0, taxCom = 0, taxInd = 0;
        let upkeepRoads = 0, upkeepUtilities = 0, upkeepServices = 0, upkeepCivic = 0;

        const resRateMult = this.taxRates.residential / 9;
        const comRateMult = this.taxRates.commercial / 9;
        const indRateMult = this.taxRates.industrial / 9;

        for (const b of city.buildings.values()) {
            if (b.state === 'rubble') continue;
            const def = INFRASTRUCTURE[b.type];

            if (def) {
                let baseUpkeep = 0;
                const key = def.upkeepKey;
                if (key === 'roadPerTile') baseUpkeep = CONFIG.UPKEEP_PER_MONTH.roadPerTile;
                else if (key === 'bridgePerTile') baseUpkeep = CONFIG.UPKEEP_PER_MONTH.bridgePerTile;
                else baseUpkeep = CONFIG.UPKEEP_PER_MONTH[key] || 0;

                // Department funding scales upkeep
                let fundingMult = 1.0;
                if (def.category === 'transport') fundingMult = this.funding.roads || 1.0;
                else if (def.category === 'utilities') fundingMult = (def.id.includes('water') ? this.funding.water : this.funding.power) || 1.0;
                else if (def.category === 'services') {
                    if (def.id === 'fire_station') fundingMult = this.funding.fire || 1.0;
                    else if (def.id === 'police_station') fundingMult = this.funding.police || 1.0;
                    else if (def.id === 'hospital') fundingMult = this.funding.health || 1.0;
                    else if (def.id === 'school') fundingMult = this.funding.education || 1.0;
                }

                const actualUpkeep = baseUpkeep * fundingMult;
                if (def.category === 'transport') upkeepRoads += actualUpkeep;
                else if (def.category === 'utilities') upkeepUtilities += actualUpkeep;
                else if (def.category === 'services') upkeepServices += actualUpkeep;
                else upkeepCivic += actualUpkeep;

                continue;
            }

            if (b.state !== 'built' || b.onFire) continue;

            const lvMult = this.taxMultiplier(this.landValue(b.x, b.y));
            const levelBonus = 1 + (b.level - 1) * 0.40;

            if (b.type === 'residential') {
                taxRes += b.pop * CONFIG.TAXES_PER_MONTH.residentialPerResident * levelBonus * lvMult * resRateMult;
            } else if (b.type === 'commercial') {
                const tourBonus = this.ordinances.has('tourism_drive') ? 1.15 : 1.0;
                taxCom += b.jobs * CONFIG.TAXES_PER_MONTH.commercialPerJob * levelBonus * lvMult * comRateMult * tourBonus;
            } else if (b.type === 'industrial') {
                taxInd += b.jobs * CONFIG.TAXES_PER_MONTH.industrialPerJob * levelBonus * lvMult * indRateMult;
            }
        }

        // Ordinances monthly costs
        let ordinancesCost = 0;
        for (const ordId of this.ordinances) {
            const def = CONFIG.ORDINANCES[ordId];
            if (def && def.costPerMonth) ordinancesCost += def.costPerMonth;
        }

        const totalIncome = taxRes + taxCom + taxInd;
        const totalExpenses = upkeepRoads + upkeepUtilities + upkeepServices + upkeepCivic + ordinancesCost;
        const net = totalIncome - totalExpenses;

        this.breakdown = {
            taxRes, taxCom, taxInd,
            upkeepRoads, upkeepUtilities, upkeepServices, upkeepCivic,
            ordinancesCost, totalIncome, totalExpenses, net
        };

        this.lastTaxIncome = totalIncome;
        this.lastUpkeep = totalExpenses - ordinancesCost;
        this.lastOrdinancesCost = ordinancesCost;
        this.lastMonthNet = net;

        this.money += net;

        this.history.push({ net, income: totalIncome, expense: totalExpenses });
        if (this.history.length > 48) this.history.shift();

        if (window.game && window.game.audio && net > 0) {
            window.game.audio.playCash();
        }
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

    toggleOrdinance(ordId) {
        if (this.ordinances.has(ordId)) {
            this.ordinances.delete(ordId);
            return false;
        } else {
            this.ordinances.add(ordId);
            return true;
        }
    }

    serialize() {
        return {
            money: this.money,
            day: this.day,
            population: this.population,
            employed: this.employed,
            happiness: this.happiness,
            taxRates: { ...this.taxRates },
            funding: { ...this.funding },
            ordinances: Array.from(this.ordinances),
            currentMilestoneIdx: this.currentMilestoneIdx,
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
        econ.happiness = data.happiness ?? 65;
        econ.taxRates = data.taxRates || { ...CONFIG.DEFAULT_TAX_RATES };
        econ.funding = data.funding || { ...CONFIG.DEFAULT_FUNDING };
        econ.ordinances = new Set(data.ordinances || []);
        econ.currentMilestoneIdx = data.currentMilestoneIdx || 0;
        econ.history = data.history || [];
        econ._nextMonthlyCheck = data.nextMonthlyCheck || CONFIG.DAYS_PER_MONTH;
        return econ;
    }
}

window.Economy = Economy;
