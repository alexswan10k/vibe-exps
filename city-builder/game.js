// Game orchestrator: owns the city and systems, runs the fixed-step
// simulation, exposes the player-facing API used by input + UI.

class Game {
    constructor() {
        this.city = null;
        this.services = null;
        this.economy = null;
        this.development = new DevelopmentEngine();
        this.traffic = null;
        this.renderer = null;
        this.input = null;
        this.ui = null;

        this.selected = null;
        this.overlayMode = OVERLAYS.NONE;

        this.paused = false;
        this.speedIndex = 0;
        this.simTime = 0;              // total simulated ticks
        this._accumulator = 0;
        this._lastFrame = performance.now();
        this._hudTimer = 0;
        this._warningTimes = {};
        this.running = true;

        this.startNewCity(makeRngSeed());
        this.wireSystems();

        requestAnimationFrame((t) => this.frame(t));
    }

    // --- Setup ---
    startNewCity(seed) {
        this.city = new City(CONFIG.GRID_W, CONFIG.GRID_H, seed);
        this.economy = new Economy();
        this.economy.cityRef = this.city;
        this.services = new Services(this.city);
        this.development = new DevelopmentEngine();
        this.traffic = new TrafficSystem(this.city);
        this.selected = null;
        this.simTime = 0;

        // Starter road so the first zoned lots can develop immediately
        const midX = Math.floor(CONFIG.GRID_W / 2);
        const midY = Math.floor(CONFIG.GRID_H / 2);
        for (let dx = -3; dx <= 3; dx++) {
            if (this.city.isBuildable(midX + dx, midY)) {
                this.city.addBuilding('road', midX + dx, midY);
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
            if (confirm('Abandon this city and generate a new one?')) this.resetGame();
        });

        const picker = document.getElementById('overlay-picker');
        for (const chip of picker.querySelectorAll('.chip')) {
            chip.addEventListener('click', () => this.setOverlay(chip.dataset.overlay));
        }
    }

    // --- Player API ---
    setTool(tool) {
        this.input.setTool(tool);
    }

    setOverlay(mode) {
        this.overlayMode = mode;
        const picker = document.getElementById('overlay-picker');
        for (const chip of picker.querySelectorAll('.chip')) {
            chip.classList.toggle('active', chip.dataset.overlay === mode);
        }
    }

    cycleOverlay() {
        const modes = [OVERLAYS.NONE, OVERLAYS.POWER, OVERLAYS.WATER, OVERLAYS.LAND];
        const next = modes[(modes.indexOf(this.overlayMode) + 1) % modes.length];
        this.setOverlay(next);
    }

    togglePause() {
        this.paused = !this.paused;
        document.getElementById('btn-pause').classList.toggle('active', this.paused);
        this.notify(this.paused ? 'Simulation paused' : 'Simulation resumed', 'info');
    }

    stepSpeed(direction) {
        const idx = clamp(this.speedIndex + direction, 0, CONFIG.SPEEDS.length - 1);
        if (idx === this.speedIndex) return;
        this.speedIndex = idx;
        document.getElementById('speed-label').textContent = `${CONFIG.SPEEDS[idx]}x`;
    }

    selectBuilding(b) {
        this.selected = b;
    }

    clearSelection() {
        this.selected = null;
    }

    // --- Placement / zoning actions ---
    canPlaceOnTile(x, y) {
        return this.city.isBuildable(x, y) && !this.city.buildingAt(x, y);
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
        let blocked = 0;
        let outOfMoney = false;

        outer:
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                const tx = x + dx, ty = y + dy;
                if (!this.canPlaceOnTile(tx, ty)) { blocked++; continue; }

                if (zoneId !== 0) {
                    const cost = CONFIG.COSTS.zone[zoneKey];
                    if (!this.economy.canAfford(cost)) { outOfMoney = true; break outer; }
                    // Zoning forest clears the trees automatically
                    this.economy.spend(cost);
                    this.city.setZone(tx, ty, zoneId);
                    applied++;
                } else {
                    // Dezone: refund half the original zoning cost
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
            const label = zoneKey ? `${ZONES[zoneKey].name} zone` : 'zoning cleared';
            this.notify(`${label}: ${applied} tile${applied > 1 ? 's' : ''}`, 'info');
        } else if (outOfMoney) {
            this.notify('Not enough money to zone', 'error');
        } else if (blocked > 0 && zoneKey) {
            this.notify('Cannot zone there — needs clear land near nothing built', 'error');
        }
        return applied;
    }

    canPlaceInfrastructure(typeId, x, y, size) {
        return this.city.canPlaceAt(size, x, y) &&
            this.economy.canAfford(CONFIG.COSTS[INFRASTRUCTURE[typeId].costKey]);
    }

    placeInfrastructure(typeId, x, y) {
        const def = INFRASTRUCTURE[typeId];
        if (!def) return false;
        const size = def.size;
        const cost = CONFIG.COSTS[def.costKey];

        // Footprint must be clear of water/buildings/zones
        for (let dy = 0; dy < size; dy++) {
            for (let dx = 0; dx < size; dx++) {
                if (!this.canPlaceOnTile(x + dx, y + dy)) {
                    this.notify(`Blocked: ${def.name} needs clear land`, 'error');
                    return false;
                }
            }
        }

        if (!this.economy.spend(cost)) {
            this.notify(`Not enough money ($${cost.toLocaleString()} needed)`, 'error');
            return false;
        }

        this.city.addBuilding(typeId, x, y);
        this.notify(`${def.name} built (-$${cost.toLocaleString()})`, 'info');

        // Roads under zones? Not allowed — zones are consumed by placement.
        return true;
    }

    paintRoad(x, y) {
        if (!this.city.isBuildable(x, y)) return false;
        if (this.city.buildingAt(x, y)) return false;
        if (this.city.zoneAt(x, y) !== 0) {
            this.warnThrottled('roadzone', 'Clear the zoning before building roads on it', 'warning');
            return false;
        }
        if (!this.economy.spend(CONFIG.COSTS.road)) {
            this.warnThrottled('money', 'Treasury is empty!', 'error');
            return false;
        }
        this.city.addBuilding('road', x, y);
        return true;
    }

    bulldozeAt(x, y) {
        const b = this.city.buildingAt(x, y);
        if (!b) return false;

        if (b.type === 'road') {
            this.city.removeBuilding(b);
            return true;
        }

        if (INFRASTRUCTURE[b.type]) {
            if (!this.economy.spend(CONFIG.COSTS.bulldozeFee)) return false;
            this.city.removeBuilding(b);
            this.notify(`${INFRASTRUCTURE[b.type].name} demolished`, 'info');
            return true;
        }

        // Developed private building: small fee, no refund
        if (!this.economy.spend(CONFIG.COSTS.bulldozeFee)) return false;
        this.city.removeBuilding(b);
        return true;
    }

    // --- Simulation ---
    frame(now) {
        if (!this.running) return;
        requestAnimationFrame((t) => this.frame(t));

        const realDelta = Math.min(now - this._lastFrame, 250); // tab-switch guard
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
        if (this._hudTimer >= 250) {
            this._hudTimer = 0;
            this.ui.updateHUD();
        }
    }

    simTick(deltaMs) {
        this.simTime++;
        this.economy.day++;

        // Services refresh only when something changed
        this.services.update();

        // Demand refresh at ~2Hz
        if (this.simTime % 5 === 0) {
            this.economy.updateDemand(this.city, this.services);
            this.economy.updateHappiness(this.city, this.services);
        }

        // Development engine at its own cadence internally
        this.development.tick(this.city, this.economy, this.services);

        // Population pool every tick (smooth growth)
        this.economy.updatePopulation(this.city, this.services, deltaMs);

        // Monthly budget
        this.economy.tick(1);

        // Traffic animates in real time, but only while unpaused
        this.traffic.update(deltaMs);

        // Advisory warnings, throttled
        if (this.simTime % 10 === 0) this.checkWarnings();
    }

    checkWarnings() {
        const s = this.services;
        if (s.powerShort || s.brownouts) {
            this.warnThrottled('power', 'Power demand exceeds supply — build another power plant', 'warning');
        }
        if (s.waterShort) {
            this.warnThrottled('water', 'Water demand exceeds supply — build another water tower', 'warning');
        }
        if (this.economy.money < 0) {
            this.warnThrottled('debt', 'The city is in debt! Collect taxes or cut upkeep.', 'error');
        }
    }

    warnThrottled(key, message, type) {
        const now = performance.now();
        if (now - (this._warningTimes[key] || 0) < 12000) return;
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
            localStorage.setItem('cityBuilderV2', JSON.stringify(data));
            this.notify('City saved', 'info');
        } catch (e) {
            console.error(e);
            this.notify('Save failed', 'error');
        }
    }

    loadGame() {
        try {
            const raw = localStorage.getItem('cityBuilderV2');
            if (!raw) { this.notify('No saved city found', 'error'); return; }
            const data = JSON.parse(raw);

            this.city = City.deserialize(data.city);
            this.economy = Economy.deserialize(data.economy);
            this.economy.cityRef = this.city;
            this.services = new Services(this.city);
            this.traffic = new TrafficSystem(this.city);
            this.selected = null;

            // Rebuild static terrain layer for the loaded map
            this.renderer.drawTerrain();
            this.renderer.centerCamera();
            this.notify('City loaded', 'info');
        } catch (e) {
            console.error(e);
            this.notify('Load failed — save may be corrupted', 'error');
        }
    }

    resetGame() {
        this.startNewCity(makeRngSeed());
        this.economy.cityRef = this.city;
        this.renderer.drawTerrain();
        this.renderer.centerCamera();
        this.notify('A new plot of land awaits', 'info');
    }
}

// Random seed helper kept separate so tests can stub it
function makeRngSeed() {
    return (Math.random() * 0xFFFFFFFF) >>> 0;
}

window.Game = Game;
window.makeRngSeed = makeRngSeed;
