// Development engine: handles private zone construction and 4-tier upgrades.
// Buildings rise from empty lots to cottages, mid-rises, and towering skyscrapers
// when market demand, utilities, land value, and civic services (schools, hospitals, safety) align.

class DevelopmentEngine {
    constructor() {
        this.tickCounter = 0;
    }

    tick(city, economy, services) {
        this.tickCounter++;

        // Scan for new construction sites at an active cadence
        if (this.tickCounter % CONFIG.DEV.CHECK_EVERY_TICKS === 0) {
            this.scanForNewDevelopments(city, economy, services);
        }

        // Progress existing projects / health every tick
        for (const b of city.buildings.values()) {
            const zone = window.ZONES[b.type];
            if (!zone) continue; // infrastructure is not managed here

            if (b.onFire) continue; // fire engine handles burning buildings

            if (b.state === 'construction') {
                b.progressTicks++;
                if (b.progressTicks >= CONFIG.DEV.CONSTRUCTION_TICKS) {
                    b.state = 'built';
                    b.progressTicks = 0;
                    city.buildingsVersion++;
                    city.servicesVersion++;
                }
            } else if (b.state === 'built' || b.state === 'abandoned') {
                if (b.state === 'built') {
                    this.tryProgressUpgrade(b, city, economy, services);
                }
                this.trackServiceHealth(b);
                if (b.state === 'abandoned') {
                    b.abandonedTicks++;
                    if (b.abandonedTicks >= CONFIG.DEV.DEMOLISH_AFTER_TICKS) {
                        b.state = 'rubble';
                        b.abandonedTicks = 0;
                        city.buildingsVersion++;
                    }
                }
            }
        }
    }

    // --- New construction: find zoned empty lots worth developing ---
    scanForNewDevelopments(city, economy, services) {
        const lots = this.zonedEmptyLots(city);
        if (lots.length === 0) return;

        let builtThisScan = 0;
        const maxSitesPerScan = 16;

        for (const idx of lots) {
            if (builtThisScan >= maxSitesPerScan) break;

            const x = idx % city.width;
            const y = Math.floor(idx / city.width);
            const zoneId = city.zones[idx];
            const zoneKey = window.zoneByTileId(zoneId);
            if (!zoneKey) continue;

            // Road access within walking distance
            const dist = services.roadDistance[idx];
            if (dist < 0 || dist > CONFIG.DEV.ROAD_ACCESS_DIST) continue;

            // Market demand check
            if (economy.demand[zoneKey] < CONFIG.DEV.MIN_DEMAND_TO_BUILD) continue;

            // Start construction at Level 1!
            city.addBuilding(zoneKey, x, y, 1, 'construction');
            builtThisScan++;
        }
    }

    zonedEmptyLots(city) {
        const lots = [];
        for (let i = 0; i < city.zones.length; i++) {
            if (city.zones[i] === 0) continue;
            const x = i % city.width;
            const y = Math.floor(i / city.width);
            if (city.buildingAt(x, y)) continue;
            if (!city.isBuildable(x, y)) continue;
            lots.push(i);
        }
        return lots;
    }

    // --- Upgrades: denser buildings where demand and land value justify ---
    tryProgressUpgrade(b, city, economy, services) {
        if (b.level >= maxLevel(b.type)) return;

        const nextLevel = b.level + 1;
        const reqLandValue = CONFIG.DEV.LAND_VALUE_FOR_LEVEL[b.level] || 12;
        const curLandValue = economy.landValue(b.x, b.y);

        // Tier 4 high-density requirements
        let civicPass = true;
        if (nextLevel === 4) {
            civicPass = b.policeCoverage && b.fireCoverage && (b.educationCoverage || services.educationScore >= CONFIG.DEV.MIN_EQ_FOR_LEVEL4);
        }

        const eligible =
            economy.demand[b.type] >= CONFIG.DEV.MIN_DEMAND_TO_UPGRADE &&
            b.connected && b.powered && (b.level === 1 || b.watered) &&
            (b.pop + b.jobs) > 0 &&
            civicPass &&
            this.occupancyRatio(b) >= CONFIG.DEV.UPGRADE_MIN_OCCUPANCY &&
            curLandValue >= reqLandValue;

        if (eligible) {
            b.progressTicks++;
            if (b.progressTicks >= CONFIG.DEV.UPGRADE_TICKS) {
                // Upgrade in place via a fresh construction phase
                b.level = nextLevel;
                b.state = 'construction';
                b.progressTicks = 0;
                b.pop = 0;
                b.jobs = 0;
                city.buildingsVersion++;
                city.servicesVersion++;
            }
        } else {
            b.progressTicks = Math.max(0, b.progressTicks - 2);
        }
    }

    occupancyRatio(b) {
        const lvl = levelDef(b.type, b.level);
        const cap = lvl.capacity > 0 ? lvl.capacity : lvl.jobCapacity;
        const used = lvl.capacity > 0 ? b.pop : b.jobs;
        return cap > 0 ? used / cap : 0;
    }

    // --- Abandonment & Recovery ---
    trackServiceHealth(b) {
        const served = b.connected &&
            (!b._needsPower || b.powered) &&
            (!b._needsWater || b.watered);

        if (served) {
            if (b.unservedTicks > 0 && this.tickCounter % 2 === 0) {
                b.unservedTicks -= CONFIG.DEV.UNSERVED_RECOVERY;
            }
            if (b.state === 'abandoned' && b.unservedTicks <= 0) {
                b.state = 'built';
                b.abandonedTicks = 0;
                b.pop = 0;
                b.jobs = 0;
                window.game && window.game.city && (window.game.city.buildingsVersion++);
            }
            return;
        }

        b.unservedTicks++;
        if (b.state !== 'abandoned' && b.unservedTicks >= CONFIG.DEV.ABANDON_AFTER_TICKS) {
            b.state = 'abandoned';
            b.abandonedTicks = 0;
            b.pop = 0;
            b.jobs = 0;
            window.game && window.game.city && (window.game.city.buildingsVersion++);
        }
    }
}

window.DevelopmentEngine = DevelopmentEngine;
