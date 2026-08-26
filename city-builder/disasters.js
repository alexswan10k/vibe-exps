// Disasters & Emergency Simulation:
// - Fire outbreaks & propagation (mitigated by fire station coverage and smoke detector ordinance)
// - Meteor strikes and tornado disaster paths
// - Emergency response coordination with fire trucks and disaster notifications

class DisasterEngine {
    constructor() {
        this.activeFires = new Set();    // Set of burning Building objects
        this.disasterCooldown = 0;
    }

    tick(city, services, traffic, economy) {
        if (this.disasterCooldown > 0) this.disasterCooldown--;

        // 1. Spontaneous fire check on vulnerable buildings (low water/power, unserved, high density)
        this.checkSpontaneousFires(city, services, economy);

        // 2. Process active fires (spread, damage, extinguishment)
        this.processFires(city, traffic, services);
    }

    checkSpontaneousFires(city, services, economy) {
        // Small periodic check
        if (Math.random() > 0.08) return;

        const smokeDet = economy && economy.ordinances.has('smoke_detectors');
        const fireRiskMod = smokeDet ? 0.55 : 1.0;

        const buildings = city.allBuildings();
        if (buildings.length === 0) return;

        for (const b of buildings) {
            if (b.onFire || b.state !== 'built' || INFRASTRUCTURE[b.type]) continue;

            let risk = CONFIG.SAFETY.FIRE_BASE_CHANCE * fireRiskMod;
            if (!b.watered) risk *= 2.5;
            if (!b.powered) risk *= 1.5;
            if (b.type === 'industrial') risk *= 2.0;
            if (b.level >= 3) risk *= 1.4;

            // Fire station coverage drastically reduces fire ignition
            if (b.fireCoverage) risk *= 0.15;

            if (Math.random() < risk) {
                this.igniteBuilding(b, city);
                break; // One new spontaneous fire per check cycle max
            }
        }
    }

    igniteBuilding(b, city) {
        if (b.onFire) return;
        b.onFire = true;
        b.fireTicks = 0;
        b.pop = 0;
        b.jobs = 0;
        this.activeFires.add(b);

        city.buildingsVersion++;

        if (window.game) {
            window.game.notify(`🔥 Fire broke out at (${b.x}, ${b.y})!`, 'error');
            if (window.game.audio) window.game.audio.playSiren();
        }
    }

    extinguishBuilding(b, city) {
        if (!b.onFire) return;
        b.onFire = false;
        b.fireTicks = 0;
        b.state = 'rubble';
        this.activeFires.delete(b);
        city.buildingsVersion++;

        if (window.game) {
            window.game.notify(`🚒 Fire extinguished at (${b.x}, ${b.y})!`, 'info');
        }
    }

    processFires(city, traffic, services) {
        for (const b of Array.from(this.activeFires)) {
            // Check if building was removed/bulldozed
            if (!city.buildings.has(b.id)) {
                this.activeFires.delete(b);
                continue;
            }

            b.fireTicks++;

            // Spread fire to adjacent buildings
            if (Math.random() < CONFIG.SAFETY.FIRE_SPREAD_CHANCE) {
                for (const adj of city.adjacentTiles(b)) {
                    const neighbor = city.buildingAt(adj.x, adj.y);
                    if (neighbor && !neighbor.onFire && neighbor.state === 'built' && !INFRASTRUCTURE[neighbor.type]) {
                        this.igniteBuilding(neighbor, city);
                    }
                }
            }

            // Ensure emergency fire trucks are dispatched
            if (traffic && b.fireTicks % 20 === 1) {
                traffic.requestFireTruck(b);
            }

            // Building burnt to the ground
            if (b.fireTicks >= CONFIG.SAFETY.FIRE_BURN_TICKS) {
                b.onFire = false;
                b.state = 'rubble';
                b.fireTicks = 0;
                this.activeFires.delete(b);
                city.buildingsVersion++;

                if (window.game) {
                    window.game.notify(`🏚️ Building burned down to rubble at (${b.x}, ${b.y})`, 'warning');
                }
            }
        }
    }

    // --- Player / Scenario Disasters ---

    triggerMeteor(city, targetX, targetY) {
        const radius = 3;
        if (window.game) {
            window.game.notify(`☄️ METEOR STRIKE at (${targetX}, ${targetY})!`, 'error');
            if (window.game.audio) window.game.audio.playExplosion();
        }

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const tx = targetX + dx, ty = targetY + dy;
                if (!city.inBounds(tx, ty)) continue;
                const d = Math.hypot(dx, dy);
                if (d <= radius) {
                    const b = city.buildingAt(tx, ty);
                    if (b) {
                        if (d <= 1.5) {
                            b.onFire = false;
                            b.state = 'rubble';
                            b.pop = 0;
                            b.jobs = 0;
                        } else {
                            this.igniteBuilding(b, city);
                        }
                    }
                }
            }
        }
        city.buildingsVersion++;
    }

    triggerTornado(city, startX, startY) {
        if (window.game) {
            window.game.notify(`🌪️ TORNADO WARNING moving through the city!`, 'error');
            if (window.game.audio) window.game.audio.playSiren();
        }

        // Move tornado in a wandering path for 16 steps
        let cx = startX, cy = startY;
        const destroyed = [];

        for (let step = 0; step < 16; step++) {
            cx += Math.round((Math.random() - 0.5) * 3);
            cy += Math.round((Math.random() - 0.5) * 3);
            cx = clamp(cx, 1, city.width - 2);
            cy = clamp(cy, 1, city.height - 2);

            const b = city.buildingAt(cx, cy);
            if (b && b.type !== 'road') {
                b.state = 'rubble';
                b.pop = 0;
                b.jobs = 0;
                destroyed.push(b);
            }
        }
        city.buildingsVersion++;
    }
}

window.DisasterEngine = DisasterEngine;

