// Development engine: the heart of the simulation. Zoned land develops on
// its own when there is market demand, road access and utility capacity.
// Buildings rise from construction sites through levels, and are abandoned
// (then demolished) when services fail.

class DevelopmentEngine {
    constructor() {
        this.tickCounter = 0;
    }

    tick(city, economy, services) {
        this.tickCounter++;

        // Full scan for new construction sites at a relaxed cadence
        if (this.tickCounter % CONFIG.DEV.CHECK_EVERY_TICKS === 0) {
            this.scanForNewDevelopments(city, economy, services);
        }

        // Progress existing projects / health every tick
        for (const b of city.buildings.values()) {
            const zone = window.ZONES[b.type];
            if (!zone) continue; // infrastructure is not managed here

            if (b.state === 'construction') {
                b.progressTicks++;
                if (b.progressTicks >= CONFIG.DEV.CONSTRUCTION_TICKS) {
                    b.state = 'built';
                    b.progressTicks = 0;
                    city.buildingsVersion++;   // renderer + services refresh
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
                        city.removeBuilding(b); // zone remains; lot may redevelop
                    }
                }
            }
        }
    }

    // --- New construction: find zoned empty lots worth developing ---
    scanForNewDevelopments(city, economy, services) {
        const lots = this.zonedEmptyLots(city);

        for (const idx of lots) {
            const x = idx % city.width;
            const y = Math.floor(idx / city.width);
            const zoneId = city.zones[idx];
            const zoneKey = window.zoneByTileId(zoneId);
            if (!zoneKey) continue;

            // Road access within walking distance
            if (services.roadDistance[idx] < 0 ||
                services.roadDistance[idx] > CONFIG.DEV.ROAD_ACCESS_DIST) continue;

            // Market demand
            if (economy.demand[zoneKey] < CONFIG.DEV.MIN_DEMAND_TO_BUILD) continue;

            // Utilities must exist in the city before anything gets built
            const hasUtilities = services.powerProd > 0 && services.waterProd > 0;
            if (!hasUtilities) continue;

            // Start construction!
            city.addBuilding(zoneKey, x, y, 1, 'construction');
        }
    }

    zonedEmptyLots(city) {
        // Cheap enough to recompute: zones are ≤ 4096 tiles, scan runs ~1/s
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
        const eligible =
            economy.demand[b.type] >= CONFIG.DEV.MIN_DEMAND_TO_UPGRADE &&
            b.connected && b.powered && b.watered &&
            (b.pop + b.jobs) > 0 &&
            this.occupancyRatio(b) >= CONFIG.DEV.UPGRADE_MIN_OCCUPANCY &&
            economy.landValue(b.x, b.y) >= CONFIG.DEV.LAND_VALUE_FOR_LEVEL[b.level];

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

    // --- Abandonment: cut the services and the building dies ---
    trackServiceHealth(b) {
        const served = b.connected &&
            (!b._needsPower || b.powered) &&
            (!b._needsWater || b.watered);

        if (served) {
            if (b.unservedTicks > 0 && this.tickCounter % 2 === 0) {
                b.unservedTicks -= CONFIG.DEV.UNSERVED_RECOVERY;
            }
            if (b.state === 'abandoned' && b.unservedTicks <= 0) {
                // Repopulate an abandoned building once services return
                b.state = 'built';
                b.abandonedTicks = 0;
                b.pop = 0;
                b.jobs = 0;
            }
            return;
        }

        b.unservedTicks++;
        if (b.state !== 'abandoned' && b.unservedTicks >= CONFIG.DEV.ABANDON_AFTER_TICKS) {
            b.state = 'abandoned';
            b.abandonedTicks = 0;
            b.pop = 0;
            b.jobs = 0;
        }
    }
}

window.DevelopmentEngine = DevelopmentEngine;
