// Game orchestrator: coordinates City, Services, Economy, Development,
// Disasters, Traffic, Web Audio, and Renderer subsystems.

class Game {
    constructor() {
        this.city = null;
        this.services = null;
        this.economy = null;
        this.development = null;
        this.disasters = null;
        this.traffic = null;
        this.audio = new SoundFX();
        this.renderer = null;
        this.input = null;
        this.ui = null;

        this.selected = null;
        this.overlayMode = OVERLAYS.NONE;

        this.paused = false;
        this.speedIndex = 0;
        this.simTime = 0;
        this._accumulator = 0;
        this._lastFrame = performance.now();
        this._hudTimer = 0;
        this._warningTimes = {};
        this.running = true;

        this.startNewCity(makeRngSeed());
        this.wireSystems();

        requestAnimationFrame((t) => this.frame(t));
    }

    startNewCity(seed) {
        this.city = new City(CONFIG.GRID_W, CONFIG.GRID_H, seed);
        this.economy = new Economy();
        this.economy.cityRef = this.city;
        this.services = new Services(this.city);
        this.development = new DevelopmentEngine();
        this.disasters = new DisasterEngine();
        this.traffic = new TrafficSystem(this.city);
        this.selected = null;
        this.simTime = 0;

        // Starter road connecting land across the middle
        const midX = Math.floor(CONFIG.GRID_W / 2);
        const midY = Math.floor(CONFIG.GRID_H / 2);
        for (let dx = -6; dx <= 6; dx++) {
            const tx = midX + dx, ty = midY;
            if (this.city.isBuildable(tx, ty)) {
                this.city.addBuilding('road', tx, ty);
            } else if (this.city.isWater(tx, ty)) {
                this.city.addBuilding('bridge', tx, ty);
            }
        }
    }

    wireSystems() {
        this.renderer = new Renderer(this);
        this.input = new InputManager(this);
        this.ui = new UIManager(this);

        document.getElementById('btn-pause').addEventListener('click', () => this.togglePause());
        document.getElementById('btn-speed-up').addEventListener('click', () => this.stepSpeed(1));
        document.getElementById('btn-speed-down').addEventListener('click', () => this.stepSpeed(-1));
        document.getElementById('btn-save').addEventListener('click', () => this.saveGame());
        document.getElementById('btn-load').addEventListener('click', () => this.loadGame());
        document.getElementById('btn-reset').addEventListener('click', () => {
            if (confirm('Abandon this city and generate a new territory?')) this.resetGame();
        });

        const picker = document.getElementById('overlay-picker');
        if (picker) {
            for (const chip of picker.querySelectorAll('.chip')) {
                chip.addEventListener('click', () => this.setOverlay(chip.dataset.overlay));
            }
        }
    }

    setTool(tool) {
        this.input.setTool(tool);
        if (this.audio) this.audio.playClick();
    }

    setOverlay(mode) {
        this.overlayMode = mode;
        const picker = document.getElementById('overlay-picker');
        if (picker) {
            for (const chip of picker.querySelectorAll('.chip')) {
                chip.classList.toggle('active', chip.dataset.overlay === mode);
            }
        }
        if (this.audio) this.audio.playClick();
    }

    cycleOverlay() {
        const modes = [
            OVERLAYS.NONE, OVERLAYS.POWER, OVERLAYS.WATER, OVERLAYS.LAND,
            OVERLAYS.FIRE, OVERLAYS.CRIME, OVERLAYS.HEALTH, OVERLAYS.EDUCATION, OVERLAYS.TRAFFIC
        ];
        const next = modes[(modes.indexOf(this.overlayMode) + 1) % modes.length];
        this.setOverlay(next);
    }

    cycleTimeOfDay() {
        const modes = [TIME_OF_DAY.DAY, TIME_OF_DAY.SUNSET, TIME_OF_DAY.NIGHT];
        const next = modes[(modes.indexOf(this.renderer.timeOfDay) + 1) % modes.length];
        this.renderer.timeOfDay = next;
        this.notify(`Lighting: ${next.toUpperCase()}`, 'info');
    }

    togglePause() {
        this.paused = !this.paused;
        document.getElementById('btn-pause').classList.toggle('active', this.paused);
        this.notify(this.paused ? 'Simulation paused' : 'Simulation resumed', 'info');
        if (this.audio) this.audio.playClick();
    }

    stepSpeed(direction) {
        const idx = clamp(this.speedIndex + direction, 0, CONFIG.SPEEDS.length - 1);
        if (idx === this.speedIndex) return;
        this.speedIndex = idx;
        document.getElementById('speed-label').textContent = `${CONFIG.SPEEDS[idx]}x`;
        if (this.audio) this.audio.playClick();
    }

    selectBuilding(b) {
        this.selected = b;
    }

    clearSelection() {
        this.selected = null;
    }

    // --- Placement & Zoning Actions ---

    canPlaceOnTile(x, y) {
        return this.city.isBuildable(x, y) && !this.city.buildingAt(x, y);
    }

    canPlaceRoad(x, y) {
        return this.city.isBuildable(x, y) && !this.city.buildingAt(x, y) && this.city.zoneAt(x, y) === 0;
    }

    canPlaceBridge(x, y) {
        return this.city.isWater(x, y) && !this.city.buildingAt(x, y);
    }

    canZoneRect(x, y, w, h) {
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                if (!this.canPlaceOnTile(x + dx, y + dy)) return false;
            }
        }
        return true;
    }

    applyZoneRect(x, y, w, h, zoneKey) {
        const zoneId = zoneKey ? ZONES[zoneKey].zoneId : 0;
        let applied = 0;
        let outOfMoney = false;

        outer:
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                const tx = x + dx, ty = y + dy;
                if (!this.canPlaceOnTile(tx, ty)) continue;

                if (zoneId !== 0) {
                    const cost = CONFIG.COSTS.zone[zoneKey];
                    if (!this.economy.canAfford(cost)) { outOfMoney = true; break outer; }
                    this.economy.spend(cost);
                    this.city.setZone(tx, ty, zoneId);
                    applied++;
                } else {
                    const prev = this.city.zoneAt(tx, ty);
                    if (prev > 0) {
                        const prevKey = window.ZONE_KEYS[prev - 1];
                        this.economy.earn(CONFIG.COSTS.zone[prevKey] * CONFIG.COSTS.dezoneRefund);
                    }
                    this.city.setZone(tx, ty, 0);
                    applied++;
                }
            }
        }

        if (applied > 0) {
            const label = zoneKey ? `${ZONES[zoneKey].name} zone` : 'Zoning cleared';
            this.notify(`${label}: ${applied} tile${applied > 1 ? 's' : ''}`, 'info');
            if (this.audio) this.audio.playPlace();
        } else if (outOfMoney) {
            this.notify('Treasury empty — cannot afford zoning', 'error');
        }
        return applied;
    }

    applyRoadLine(tiles) {
        let placedRoads = 0;
        let placedBridges = 0;

        for (const pt of tiles) {
            if (this.city.buildingAt(pt.x, pt.y)) continue;

            if (this.city.isBuildable(pt.x, pt.y)) {
                if (this.city.zoneAt(pt.x, pt.y) !== 0) continue;
                if (!this.economy.spend(CONFIG.COSTS.road)) break;
                this.city.addBuilding('road', pt.x, pt.y);
                placedRoads++;
            } else if (this.city.isWater(pt.x, pt.y)) {
                if (!this.economy.spend(CONFIG.COSTS.bridge)) break;
                this.city.addBuilding('bridge', pt.x, pt.y);
                placedBridges++;
            }
        }

        const total = placedRoads + placedBridges;
        if (total > 0) {
            this.notify(`Built ${placedRoads ? `${placedRoads} road(s) ` : ''}${placedBridges ? `${placedBridges} bridge(s)` : ''}`, 'info');
            if (this.audio) this.audio.playRoad();
        }
    }

    canPlaceInfrastructure(typeId, x, y, size) {
        const def = INFRASTRUCTURE[typeId];
        if (!def) return false;
        return this.city.canPlaceAt(size, x, y) && this.economy.canAfford(CONFIG.COSTS[def.costKey]);
    }

    placeInfrastructure(typeId, x, y) {
        const def = INFRASTRUCTURE[typeId];
        if (!def) return false;
        const size = def.size;
        const cost = CONFIG.COSTS[def.costKey];

        for (let dy = 0; dy < size; dy++) {
            for (let dx = 0; dx < size; dx++) {
                if (!this.canPlaceOnTile(x + dx, y + dy)) {
                    this.notify(`Blocked: ${def.name} needs clear land`, 'error');
                    return false;
                }
            }
        }

        if (!this.economy.spend(cost)) {
            this.notify(`Not enough funds ($${cost.toLocaleString()} required)`, 'error');
            return false;
        }

        this.city.addBuilding(typeId, x, y);
        this.notify(`${def.name} constructed (-$${cost.toLocaleString()})`, 'info');
        if (this.audio) this.audio.playPlace();
        return true;
    }

    bulldozeAt(x, y) {
        const b = this.city.buildingAt(x, y);
        if (!b) return false;

        if (b.type === 'road' || b.type === 'bridge') {
            this.city.removeBuilding(b);
            if (this.audio) this.audio.playBulldoze();
            return true;
        }

        if (!this.economy.spend(CONFIG.COSTS.bulldozeFee)) {
            this.notify('Not enough money to bulldoze', 'error');
            return false;
        }

        const name = INFRASTRUCTURE[b.type] ? INFRASTRUCTURE[b.type].name : 'Structure';
        this.city.removeBuilding(b);
        this.notify(`${name} demolished`, 'info');
        if (this.audio) this.audio.playBulldoze();
        return true;
    }

    // --- Disaster Trigger ---
    triggerDisaster(type) {
        const midX = Math.floor(CONFIG.GRID_W / 2);
        const midY = Math.floor(CONFIG.GRID_H / 2);

        if (type === 'meteor') {
            this.disasters.triggerMeteor(this.city, midX + Math.round((Math.random() - 0.5) * 16), midY + Math.round((Math.random() - 0.5) * 16));
        } else if (type === 'tornado') {
            this.disasters.triggerTornado(this.city, midX, midY);
        } else if (type === 'fire') {
            // Find a random built building
            const built = this.city.allBuildings().filter(b => b.state === 'built' && !INFRASTRUCTURE[b.type]);
            if (built.length > 0) {
                const target = randomOf(Math.random, built);
                this.disasters.igniteBuilding(target, this.city);
            }
        }
    }

    // --- Simulation Loop ---
    frame(now) {
        if (!this.running) return;
        requestAnimationFrame((t) => this.frame(t));

        const realDelta = Math.min(now - this._lastFrame, 250);
        this._lastFrame = now;

        if (!this.paused) {
            this._accumulator += realDelta * CONFIG.SPEEDS[this.speedIndex];
            let steps = 0;
            while (this._accumulator >= CONFIG.TICK_MS && steps < 30) {
                this.simTick(CONFIG.TICK_MS);
                this._accumulator -= CONFIG.TICK_MS;
                steps++;
            }
        }

        this._hudTimer += realDelta;
        if (this._hudTimer >= 200) {
            this._hudTimer = 0;
            this.ui.updateHUD();
        }
    }

    simTick(deltaMs) {
        this.simTime++;
        this.economy.day++;

        // Services update (power, water, fire, police, health, education)
        this.services.update(this.economy);

        // Demand & Happiness refresh at ~2Hz
        if (this.simTime % 5 === 0) {
            this.economy.updateDemand(this.city, this.services);
            this.economy.updateHappiness(this.city, this.services);
        }

        // Development progression
        this.development.tick(this.city, this.economy, this.services);

        // Population pool
        this.economy.updatePopulation(this.city, this.services, deltaMs);

        // Disasters & fire engine
        this.disasters.tick(this.city, this.services, this.traffic, this.economy);

        // Monthly budget cycle
        this.economy.tick();

        // Traffic & pedestrians
        this.traffic.update(deltaMs);

        // Periodic advisory checks
        if (this.simTime % 10 === 0) this.checkWarnings();
    }

    checkWarnings() {
        const s = this.services;
        if (s.brownouts) {
            this.warnThrottled('power', '⚡ Power grid capacity exceeded — build power plants', 'warning');
        }
        if (s.waterShort) {
            this.warnThrottled('water', '💧 Water shortage detected — build water towers or pumps', 'warning');
        }
        if (this.economy.money < 0) {
            this.warnThrottled('debt', '⚠️ The municipal treasury is in debt! Adjust taxes.', 'error');
        }
        if (s.fireScore < 45 && this.economy.population > 500) {
            this.warnThrottled('fire_cov', '🚒 Low fire department coverage — risk of major fires!', 'warning');
        }
    }

    warnThrottled(key, message, type) {
        const now = performance.now();
        if (now - (this._warningTimes[key] || 0) < 14000) return;
        this._warningTimes[key] = now;
        this.notify(message, type);
    }

    notify(message, type) {
        if (this.ui) this.ui.notify(message, type);
    }

    // --- Persistence ---
    saveGame() {
        try {
            const data = {
                city: this.city.serialize(),
                economy: this.economy.serialize(),
                savedAt: Date.now()
            };
            localStorage.setItem('simCityCloneSave', JSON.stringify(data));
            this.notify('💾 City saved successfully', 'info');
            if (this.audio) this.audio.playCash();
        } catch (e) {
            console.error(e);
            this.notify('Save failed', 'error');
        }
    }

    loadGame() {
        try {
            const raw = localStorage.getItem('simCityCloneSave');
            if (!raw) { this.notify('No saved city found in storage', 'error'); return; }
            const data = JSON.parse(raw);

            this.city = City.deserialize(data.city);
            this.economy = Economy.deserialize(data.economy);
            this.economy.cityRef = this.city;
            this.services = new Services(this.city);
            this.disasters = new DisasterEngine();
            this.traffic = new TrafficSystem(this.city);
            this.selected = null;

            this.renderer.drawTerrain();
            this.renderer.centerCamera();
            this.notify('📂 City loaded successfully', 'info');
            if (this.audio) this.audio.playCash();
        } catch (e) {
            console.error(e);
            this.notify('Load failed — data might be corrupt', 'error');
        }
    }

    resetGame() {
        this.startNewCity(makeRngSeed());
        this.renderer.drawTerrain();
        this.renderer.centerCamera();
        this.notify('🏞️ A fresh territory awaits your plan', 'info');
    }
}

function makeRngSeed() {
    return (Math.random() * 0xFFFFFFFF) >>> 0;
}

window.Game = Game;
window.makeRngSeed = makeRngSeed;
