// High-Fidelity Layered PixiJS Renderer:
// - 4 Density Tiers for Residential, Commercial, and Industrial zones
// - Full Civic and Infrastructure architecture (Fire, Police, Hospital, School, Wind Turbines, Bridges, City Hall)
// - Day / Sunset / Night ambiance lighting with glowing windows and streetlights
// - Animated fire flames, smoke particles, spinning wind turbines, and emergency water cannons
// - 9 Diagnostic Overlays (Power, Water, Land Value, Fire Hazard, Crime, Health, Education, Traffic, Pollution)

const OVERLAYS = {
    NONE: 'none',
    POWER: 'power',
    WATER: 'water',
    LAND: 'land',
    FIRE: 'fire',
    CRIME: 'crime',
    HEALTH: 'health',
    EDUCATION: 'education',
    TRAFFIC: 'traffic',
    POLLUTION: 'pollution'
};

const TIME_OF_DAY = { DAY: 'day', SUNSET: 'sunset', NIGHT: 'night' };

class Renderer {
    constructor(game) {
        this.game = game;
        this.container = document.getElementById('pixi-canvas');

        this.camera = { x: 0, y: 0, zoom: 1 };
        this.timeOfDay = TIME_OF_DAY.DAY;

        this.buildingGraphics = new Map();
        this._colorCache = new Map();

        this._boundResize = this.handleResize.bind(this);
        this._boundRender = this.render.bind(this);

        this._overlayLastDrawn = 0;
        this._overlayDrawnVersion = -1;

        // Particle systems (smoke, fire embers, water spray)
        this.particles = [];

        this.init();
    }

    // --- Colour helpers ---
    typeColor(typeKey) {
        if (!this._colorCache.has(typeKey)) {
            const def = INFRASTRUCTURE[typeKey];
            const hexString = def ? null : (ZONES[typeKey] ? ZONES[typeKey].color : '#cccccc');
            const fallback = {
                road: '#78909c', bridge: '#8d6e63', park: '#66bb6a', power: '#fdd835',
                wind_turbine: '#4db6ac', water: '#4fc3f7', water_pump: '#0288d1',
                fire_station: '#e53935', police_station: '#1e88e5', hospital: '#ab47bc',
                school: '#ffb300', city_hall: '#d4af37'
            }[typeKey];
            const src = hexString || fallback || '#cccccc';
            this._colorCache.set(typeKey, parseInt(src.replace('#', ''), 16));
        }
        return this._colorCache.get(typeKey);
    }

    shade(color, factor) {
        let r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
        if (factor >= 1) {
            r += (255 - r) * (factor - 1);
            g += (255 - g) * (factor - 1);
            b += (255 - b) * (factor - 1);
        } else {
            r *= factor; g *= factor; b *= factor;
        }
        return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
    }

    seedOf(id) {
        let hash = 0;
        const str = String(id);
        for (let i = 0; i < str.length; i++) hash = ((hash * 31) + str.charCodeAt(i)) | 0;
        return Math.abs(hash);
    }

    // --- Lifecycle ---
    init() {
        const startRenderer = () => {
            const width = this.container.clientWidth || 800;
            const height = this.container.clientHeight || 600;

            try {
                this.app = new PIXI.Application({
                    width, height,
                    backgroundColor: 0x2b5d88,   // Ocean surrounding island
                    antialias: true,
                    resolution: window.devicePixelRatio || 1,
                    autoDensity: true
                });
            } catch (e) {
                try {
                    this.app = new PIXI.Application({
                        width, height, backgroundColor: 0x2b5d88,
                        forceCanvas: true, autoDensity: true
                    });
                } catch (e2) {
                    console.error('Could not initialise PixiJS', e2);
                    return;
                }
            }

            this.container.appendChild(this.app.view);
            this.handleResize();
            this.setupResizeHandling();

            this.stage = this.app.stage;
            this.terrainG = new PIXI.Container();
            this.zoneG = new PIXI.Graphics();
            this.buildingLayer = new PIXI.Container();
            this.overlayG = new PIXI.Graphics();
            this.fxG = new PIXI.Graphics();
            this.particlesG = new PIXI.Graphics();
            this.nightG = new PIXI.Graphics();
            this.cursorG = new PIXI.Graphics();

            this.terrainBase = new PIXI.Graphics();
            this.terrainDetail = new PIXI.Graphics();
            this.terrainG.addChild(this.terrainBase, this.terrainDetail);

            this.stage.addChild(
                this.terrainG, this.zoneG, this.buildingLayer,
                this.overlayG, this.fxG, this.particlesG, this.nightG, this.cursorG
            );

            this.drawTerrain();
            this.centerCamera();

            this.app.ticker.add(this._boundRender);
        };

        if (this.container.clientWidth > 0 && this.container.clientHeight > 0) startRenderer();
        else requestAnimationFrame(startRenderer);
    }

    setupResizeHandling() {
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => this.handleResize());
            this.resizeObserver.observe(this.container);
        }
        window.addEventListener('resize', this._boundResize);
    }

    handleResize() {
        if (!this.app || !this.container) return;
        this.app.renderer.resize(this.container.clientWidth, this.container.clientHeight);
        this.updateCamera();
    }

    destroy() {
        if (this.resizeObserver) this.resizeObserver.disconnect();
        window.removeEventListener('resize', this._boundResize);
        if (this.app) {
            this.app.ticker.remove(this._boundRender);
            this.container.removeChild(this.app.view);
            this.app.destroy(true);
        }
        this.app = null;
        this.buildingGraphics.clear();
    }

    // --- Camera ---
    worldSize() {
        return { w: CONFIG.GRID_W * CONFIG.CELL, h: CONFIG.GRID_H * CONFIG.CELL };
    }

    centerCamera() {
        const size = this.worldSize();
        this.camera.x = size.w / 2;
        this.camera.y = size.h / 2;
        this.updateCamera();
    }

    updateCamera() {
        if (!this.stage) return;
        this.stage.position.set(
            -this.camera.x * this.camera.zoom + this.app.renderer.width / 2,
            -this.camera.y * this.camera.zoom + this.app.renderer.height / 2
        );
        this.stage.scale.set(this.camera.zoom);
    }

    moveCamera(dxWorld, dyWorld) {
        this.camera.x -= dxWorld / this.camera.zoom;
        this.camera.y -= dyWorld / this.camera.zoom;
        this.clampCamera();
        this.updateCamera();
    }

    setZoom(zoom, anchorScreenX, anchorScreenY) {
        const clamped = clamp(zoom, 0.06, 2.8);
        if (clamped === this.camera.zoom) return;
        const anchor = this.screenToWorld(anchorScreenX, anchorScreenY);
        this.camera.zoom = clamped;
        this.camera.x = anchor.x - (anchorScreenX - this.app.renderer.width / 2) / clamped;
        this.camera.y = anchor.y - (anchorScreenY - this.app.renderer.height / 2) / clamped;
        this.clampCamera();
        this.updateCamera();
    }

    clampCamera() {
        const size = this.worldSize();
        const margin = 1200;
        this.camera.x = clamp(this.camera.x, -margin, size.w + margin);
        this.camera.y = clamp(this.camera.y, -margin, size.h + margin);
    }

    screenToWorld(sx, sy) {
        return {
            x: (sx - this.app.renderer.width / 2) / this.camera.zoom + this.camera.x,
            y: (sy - this.app.renderer.height / 2) / this.camera.zoom + this.camera.y
        };
    }

    // --- Frame loop ---
    render() {
        if (!this.app || !this.stage || !this.game.city) return;

        this.syncZoneLayer();
        this.renderBuildings();
        this.renderOverlay();
        this.renderTrafficAndSims();
        this.renderParticles();
        this.renderNightOverlay();
        this.renderCursor();
    }

    // --- Terrain ---
    drawTerrain() {
        const city = this.game.city;
        const cell = CONFIG.CELL;
        const base = this.terrainBase;
        const detail = this.terrainDetail;
        base.clear();
        detail.clear();

        // Land mass with rich grass gradient tone
        base.beginFill(0x6ca34b);
        base.drawRect(0, 0, city.width * cell, city.height * cell);
        base.endFill();

        // Water tiles with deep blue & turquoise accents
        base.beginFill(0x3b82a6);
        for (let y = 0; y < city.height; y++) {
            for (let x = 0; x < city.width; x++) {
                if (city.terrain[y * city.width + x] === TERRAIN.WATER) {
                    base.drawRect(x * cell, y * cell, cell, cell);
                }
            }
        }
        base.endFill();

        // Shore foam and sand banks
        base.lineStyle(2.5, 0x8bd5eb, 0.85);
        for (let y = 0; y < city.height; y++) {
            for (let x = 0; x < city.width; x++) {
                if (city.terrain[y * city.width + x] !== TERRAIN.WATER) continue;
                const px = x * cell, py = y * cell;
                if (city.terrainAt(x, y - 1) !== TERRAIN.WATER) { base.moveTo(px, py); base.lineTo(px + cell, py); }
                if (y < city.height - 1 && city.terrainAt(x, y + 1) !== TERRAIN.WATER) { base.moveTo(px, py + cell); base.lineTo(px + cell, py + cell); }
                if (city.terrainAt(x - 1, y) !== TERRAIN.WATER) { base.moveTo(px, py); base.lineTo(px, py + cell); }
                if (x < city.width - 1 && city.terrainAt(x + 1, y) !== TERRAIN.WATER) { base.moveTo(px + cell, py); base.lineTo(px + cell, py + cell); }
            }
        }
        base.lineStyle(0);

        // Clustered procedural trees with depth
        const treeShades = [0x2e7d32, 0x388e3c, 0x1b5e20];
        for (let y = 0; y < city.height; y++) {
            for (let x = 0; x < city.width; x++) {
                const idx = y * city.width + x;
                if (city.terrain[idx] !== TERRAIN.TREES) continue;
                const v = city.variants[idx];
                const px = x * cell + cell / 2;
                const py = y * cell + cell / 2;
                const jitter = ((v * 37) % 7) - 3;

                detail.beginFill(0x000000, 0.2);
                detail.drawEllipse(px + jitter + 2, py + cell * 0.32, cell * 0.32, cell * 0.12);
                detail.endFill();

                detail.beginFill(0x5d4037);
                detail.drawRect(px + jitter - 1.5, py, 3, cell * 0.35);
                detail.endFill();

                detail.beginFill(treeShades[v % treeShades.length]);
                detail.drawCircle(px + jitter, py - cell * 0.12, cell * 0.32);
                detail.endFill();

                detail.beginFill(0xffffff, 0.15);
                detail.drawCircle(px + jitter - cell * 0.08, py - cell * 0.20, cell * 0.10);
                detail.endFill();
            }
        }
    }

    // --- Zones ---
    syncZoneLayer() {
        if (this._zoneDrawnVersion === this.game.city.zonesVersion &&
            this._zoneTool === this.game.input.tool) return;
        this._zoneDrawnVersion = this.game.city.zonesVersion;
        this._zoneTool = this.game.input.tool;

        const g = this.zoneG;
        g.clear();
        const city = this.game.city;
        const cell = CONFIG.CELL;

        const zoneAlpha = { residential: 0.28, commercial: 0.26, industrial: 0.26 };
        for (let y = 0; y < city.height; y++) {
            for (let x = 0; x < city.width; x++) {
                const z = city.zones[y * city.width + x];
                if (!z) continue;
                const key = window.zoneByTileId(z);
                const color = parseInt(ZONES[key].color.replace('#', ''), 16);
                g.beginFill(color, zoneAlpha[key]);
                g.drawRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
                g.endFill();
                g.lineStyle(1, color, 0.5);
                g.drawRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
                g.lineStyle(0);
            }
        }
    }

    // --- Buildings ---
    buildingSignature(b) {
        let sig = `${b.type}|${b.level}|${b.state}|${b.variant}|${b.onFire ? 'F' : 'f'}`;

        if (b.type === 'road' || b.type === 'bridge') {
            const city = this.game.city;
            const isR = (x, y) => city.isRoadTile(x, y) ? 1 : 0;
            sig += `|${isR(b.x, b.y - 1)}${isR(b.x, b.y + 1)}${isR(b.x - 1, b.y)}${isR(b.x + 1, b.y)}`;
        }

        const zoneDef = ZONES[b.type];
        if (zoneDef) {
            if (b.state === 'construction' || b.state === 'abandoned') {
                sig += `|${Math.round((b.progressTicks / CONFIG.DEV.CONSTRUCTION_TICKS) * 6)}`;
            }
            if (b.state === 'built') {
                const lvl = levelDef(b.type, b.level);
                const cap = lvl.capacity > 0 ? lvl.capacity : lvl.jobCapacity;
                const used = lvl.capacity > 0 ? b.pop : b.jobs;
                sig += `|o${Math.round(cap > 0 ? (used / cap) * 4 : 0)}`;
                sig += b.powered ? 'P' : 'p';
                sig += b.watered ? 'W' : 'w';
                sig += b.connected ? 'C' : 'c';
                sig += b.fireCoverage ? 'F' : 'f';
                sig += b.policeCoverage ? 'L' : 'l';
            }
        }
        return sig;
    }

    renderBuildings() {
        const city = this.game.city;

        for (const [id, graphics] of this.buildingGraphics) {
            if (!city.buildings.has(id)) {
                this.buildingLayer.removeChild(graphics);
                graphics.destroy();
                this.buildingGraphics.delete(id);
            }
        }

        for (const b of city.buildings.values()) {
            let graphics = this.buildingGraphics.get(b.id);
            if (!graphics) {
                graphics = new PIXI.Graphics();
                this.buildingLayer.addChild(graphics);
                this.buildingGraphics.set(b.id, graphics);
            }
            const sig = this.buildingSignature(b);
            if (graphics._sig !== sig) {
                this.drawBuilding(graphics, b);
                graphics._sig = sig;
            }
        }
    }

    drawBuilding(graphics, b) {
        graphics.clear();
        const cell = CONFIG.CELL;
        const w = cell, h = cell;

        if (b.state === 'rubble') return this.drawRubble(graphics, b, b.x * cell, b.y * cell, w, h);
        if (b.onFire) return this.drawBurning(graphics, b, b.x * cell, b.y * cell, w, h);

        if (b.type === 'road') return this.drawRoad(graphics, b, b.x * cell, b.y * cell, w, h);
        if (b.type === 'bridge') return this.drawBridge(graphics, b, b.x * cell, b.y * cell, w, h);
        if (b.type === 'park') return this.drawPark(graphics, b, b.x * cell, b.y * cell, w, h);
        if (b.type === 'power') return this.drawPowerPlant(graphics, b, b.x * cell, b.y * cell, w * 2, h * 2);
        if (b.type === 'wind_turbine') return this.drawWindTurbine(graphics, b, b.x * cell, b.y * cell, w, h);
        if (b.type === 'water') return this.drawWaterTower(graphics, b, b.x * cell, b.y * cell, w * 2, h * 2);
        if (b.type === 'water_pump') return this.drawWaterPump(graphics, b, b.x * cell, b.y * cell, w, h);
        if (b.type === 'fire_station') return this.drawFireStation(graphics, b, b.x * cell, b.y * cell, w * 2, h * 2);
        if (b.type === 'police_station') return this.drawPoliceStation(graphics, b, b.x * cell, b.y * cell, w * 2, h * 2);
        if (b.type === 'hospital') return this.drawHospital(graphics, b, b.x * cell, b.y * cell, w * 2, h * 2);
        if (b.type === 'school') return this.drawSchool(graphics, b, b.x * cell, b.y * cell, w * 2, h * 2);
        if (b.type === 'city_hall') return this.drawCityHall(graphics, b, b.x * cell, b.y * cell, w * 2, h * 2);

        // Zoned private developments across 4 tiers
        if (b.state === 'construction') return this.drawConstructionSite(graphics, b, b.x * cell, b.y * cell, w, h);
        if (b.type === 'residential') return this.drawResidential(graphics, b, b.x * cell, b.y * cell, w, h);
        if (b.type === 'commercial') return this.drawCommercial(graphics, b, b.x * cell, b.y * cell, w, h);
        if (b.type === 'industrial') return this.drawIndustrial(graphics, b, b.x * cell, b.y * cell, w, h);
    }

    dropShadow(g, x, y, w, h) {
        g.beginFill(0x000000, 0.22);
        g.drawRect(x + 2, y + 3, w, h);
        g.endFill();
    }

    serviceBadges(g, b, x, y, w) {
        const icons = [];
        if (b.connected === false) icons.push({ c: 0xff7043 });
        if (b.powered === false) icons.push({ c: 0xffca28 });
        if (b.watered === false) icons.push({ c: 0x4fc3f7 });

        let bx = x + w - icons.length * 6 - 2;
        for (const icon of icons) {
            g.beginFill(icon.c, 0.95);
            g.drawCircle(bx, y + 5, 2.5);
            g.endFill();
            bx += 6;
        }
    }

    occupancyBar(g, b, x, y, w, h) {
        const lvl = levelDef(b.type, b.level);
        const cap = lvl.capacity > 0 ? lvl.capacity : lvl.jobCapacity;
        if (cap <= 0) return;
        const used = lvl.capacity > 0 ? b.pop : b.jobs;
        const ratio = used / cap;
        const pad = 3;
        const barY = y + h - pad - 2;

        g.beginFill(0x000000, 0.45);
        g.drawRoundedRect(x + pad, barY, w - pad * 2, 2.5, 1);
        g.endFill();

        if (ratio > 0.02) {
            g.beginFill(lvl.capacity > 0 ? 0x81d4fa : 0xa5d6a7);
            g.drawRoundedRect(x + pad, barY, Math.max(1, (w - pad * 2) * ratio), 2.5, 1);
            g.endFill();
        }
    }

    // --- Residential 4-Tier Designs ---
    drawResidential(g, b, x, y, w, h) {
        if (b.state === 'abandoned') return this.drawAbandoned(g, b, x, y, w, h);
        const seed = this.seedOf(b.id);
        const wallA = 0xf5eedc, roofA = 0xc0392b, roofB = 0x962d22;

        if (b.level === 1) {
            // Small Cottage
            this.dropShadow(g, x + 4, y + 4, w - 8, h - 10);
            g.beginFill(wallA);
            g.drawRect(x + 4, y + h * 0.42, w - 8, h * 0.48);
            g.endFill();
            g.beginFill(roofA);
            g.moveTo(x + 2, y + h * 0.44); g.lineTo(x + w / 2, y + h * 0.08); g.lineTo(x + w - 2, y + h * 0.44);
            g.closePath(); g.endFill();
            // Door & Windows
            g.beginFill(0x5d4037);
            g.drawRect(x + w * 0.42, y + h * 0.68, w * 0.16, h * 0.22);
            g.endFill();
            g.beginFill(((seed >> 1) & 1) ? 0xffeb3b : 0xbbdefb);
            g.drawRect(x + w * 0.14, y + h * 0.52, w * 0.18, h * 0.15);
            g.drawRect(x + w * 0.68, y + h * 0.52, w * 0.18, h * 0.15);
            g.endFill();
        } else if (b.level === 2) {
            // Townhouse Row
            this.dropShadow(g, x + 2, y + 4, w - 4, h - 8);
            g.beginFill(wallA);
            g.drawRect(x + 2, y + h * 0.30, w - 4, h * 0.62);
            g.endFill();
            g.beginFill(roofA);
            g.moveTo(x + 1, y + h * 0.34); g.lineTo(x + w * 0.27, y + h * 0.06); g.lineTo(x + w * 0.53, y + h * 0.34);
            g.moveTo(x + w * 0.47, y + h * 0.34); g.lineTo(x + w * 0.73, y + h * 0.06); g.lineTo(x + w - 1, y + h * 0.34);
            g.closePath(); g.endFill();
            for (let i = 0; i < 4; i++) {
                const lit = ((seed >> i) & 1) === 1;
                g.beginFill(lit ? 0xffeb3b : 0xcfe8ff);
                g.drawRect(x + w * (0.06 + (i % 2) * 0.48), y + h * (0.42 + Math.floor(i / 2) * 0.14), w * 0.16, h * 0.11);
                g.endFill();
            }
        } else if (b.level === 3) {
            // Brick Apartment Complex
            const topY = y - h * 0.55;
            this.dropShadow(g, x + 2, y + 4, w - 4, h - 8);
            g.beginFill(0xd7ccc8);
            g.drawRect(x + 2, topY, w - 4, y + h - 4 - topY);
            g.endFill();
            g.beginFill(0x8d6e63);
            g.drawRect(x + 2, topY, w - 4, 4);
            g.endFill();
            for (let row = 0; row < 4; row++) {
                for (let col = 0; col < 3; col++) {
                    const lit = ((seed >> (row * 3 + col)) & 1) === 1;
                    g.beginFill(lit ? 0xffeb3b : 0x90caf9, 0.95);
                    g.drawRect(x + w * (0.12 + col * 0.27), topY + 8 + row * ((h * 0.62) / 4), w * 0.17, h * 0.10);
                    g.endFill();
                }
            }
        } else {
            // Tier 4: Luxury High-Rise Tower (Tall, Glass Balconies, Penthouse)
            const topY = y - h * 1.25;
            this.dropShadow(g, x + 2, y + 4, w - 4, h - 8);
            g.beginFill(0x37474f);
            g.drawRect(x + 2, topY, w - 4, y + h - 4 - topY);
            g.endFill();
            g.beginFill(0x0288d1);
            g.drawRect(x + 4, topY + 4, w - 8, y + h - 8 - topY);
            g.endFill();
            // Penthouse pool & spire
            g.beginFill(0x00e676);
            g.drawRect(x + w * 0.25, topY - 5, w * 0.5, 5);
            g.endFill();
            g.lineStyle(2, 0xe0e0e0);
            g.moveTo(x + w * 0.5, topY - 5); g.lineTo(x + w * 0.5, topY - 14);
            g.lineStyle(0);
            for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 2; col++) {
                    g.beginFill(((seed + row + col) % 2 === 0) ? 0xfff59d : 0x81d4fa, 0.9);
                    g.drawRect(x + w * (0.15 + col * 0.42), topY + 6 + row * ((h * 1.1) / 8), w * 0.28, h * 0.08);
                    g.endFill();
                }
            }
        }

        this.serviceBadges(g, b, x, y, w);
        this.occupancyBar(g, b, x, y, w, h);
    }

    // --- Commercial 4-Tier Designs ---
    drawCommercial(g, b, x, y, w, h) {
        if (b.state === 'abandoned') return this.drawAbandoned(g, b, x, y, w, h);
        const seed = this.seedOf(b.id);
        const accent = 0x1976d2;

        if (b.level === 1) {
            // Corner Shop
            this.dropShadow(g, x + 3, y + 4, w - 6, h - 8);
            g.beginFill(0xfff3e0);
            g.drawRect(x + 3, y + h * 0.36, w - 6, h * 0.56);
            g.endFill();
            for (let i = 0; i < 4; i++) {
                g.beginFill(i % 2 ? 0xe53935 : 0xffffff);
                g.drawRect(x + 3 + i * ((w - 6) / 4), y + h * 0.36, (w - 6) / 4, h * 0.12);
                g.endFill();
            }
            g.beginFill(0x4e342e);
            g.drawRect(x + w * 0.34, y + h * 0.62, w * 0.32, h * 0.30);
            g.endFill();
        } else if (b.level === 2) {
            // Shopping Arcade / Office Block
            this.dropShadow(g, x + 2, y + 4, w - 4, h - 8);
            g.beginFill(accent);
            g.drawRect(x + 2, y + 2, w - 4, h - 6);
            g.endFill();
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 2; col++) {
                    g.beginFill(((seed >> (row * 2 + col)) & 1) ? 0xfff59d : 0xe8f4fd);
                    g.drawRect(x + w * (0.12 + col * 0.42), y + h * (0.22 + row * 0.23), w * 0.34, h * 0.18);
                    g.endFill();
                }
            }
        } else if (b.level === 3) {
            // Commercial Plaza / Mid-Rise Glass
            const topY = y - h * 0.75;
            this.dropShadow(g, x + 2, y + 4, w - 4, h - 8);
            g.beginFill(0x1565c0);
            g.drawRect(x + 2, topY, w - 4, y + h - 4 - topY);
            g.endFill();
            for (let row = 0; row < 6; row++) {
                g.beginFill(row % 2 ? 0xdceefc : 0x90caf9, 0.92);
                g.drawRect(x + 4, topY + 6 + row * ((y + h - 10 - topY) / 6), w - 8, (y + h - 10 - topY) / 6 - 2);
                g.endFill();
            }
            g.beginFill(0xe53935);
            g.drawRect(x + w * 0.14, topY - 7, w * 0.72, 6);
            g.endFill();
        } else {
            // Tier 4: Mega Corporate Glass Skyscraper
            const topY = y - h * 1.5;
            this.dropShadow(g, x + 2, y + 4, w - 4, h - 8);
            g.beginFill(0x0d47a1);
            g.drawRect(x + 2, topY, w - 4, y + h - 4 - topY);
            g.endFill();
            // Sleek blue glass cladding & lit logo
            for (let row = 0; row < 10; row++) {
                g.beginFill(((seed + row) % 3 === 0) ? 0xffd54f : 0xe1f5fe, 0.95);
                g.drawRect(x + 4, topY + 6 + row * ((y + h - 12 - topY) / 10), w - 8, (y + h - 12 - topY) / 10 - 2);
                g.endFill();
            }
            g.beginFill(0xffd600);
            g.drawCircle(x + w * 0.5, topY - 6, 4);
            g.endFill();
        }

        this.serviceBadges(g, b, x, y, w);
        this.occupancyBar(g, b, x, y, w, h);
    }

    // --- Industrial 4-Tier Designs ---
    drawIndustrial(g, b, x, y, w, h) {
        if (b.state === 'abandoned') return this.drawAbandoned(g, b, x, y, w, h);
        const base = 0xd8a047;

        if (b.level === 1) {
            // Workshop
            this.dropShadow(g, x + 3, y + 4, w - 6, h - 8);
            g.beginFill(base);
            g.drawRect(x + 3, y + h * 0.42, w - 6, h * 0.5);
            g.endFill();
            g.beginFill(0x8d6e63);
            g.drawRect(x + w * 0.72, y + h * 0.16, w * 0.12, h * 0.30);
            g.endFill();
        } else if (b.level === 2) {
            // Factory Yard
            this.dropShadow(g, x + 2, y + 4, w - 4, h - 8);
            g.beginFill(base);
            g.drawRect(x + 2, y + h * 0.28, w - 4, h * 0.64);
            g.endFill();
            g.beginFill(0x8d6e63);
            g.drawRect(x + w * 0.72, y - h * 0.02, w * 0.13, h * 0.34);
            g.endFill();
        } else if (b.level === 3) {
            // Heavy Manufacturing
            this.dropShadow(g, x + 2, y + 4, w - 4, h - 8);
            g.beginFill(this.shade(base, 0.9));
            g.drawRect(x + 1, y - h * 0.18, w - 2, y + h - 4 - (y - h * 0.18));
            g.endFill();
            g.beginFill(0x8d6e63);
            g.drawRect(x + w * 0.14, y - h * 0.42, w * 0.13, h * 0.5);
            g.drawRect(x + w * 0.40, y - h * 0.34, w * 0.13, h * 0.42);
            g.endFill();
        } else {
            // Tier 4: High-Tech Advanced Complex (Clean, modern silver/cyan)
            this.dropShadow(g, x + 2, y + 4, w - 4, h - 8);
            g.beginFill(0x455a64);
            g.drawRect(x + 2, y - h * 0.4, w - 4, y + h - 4 - (y - h * 0.4));
            g.endFill();
            g.beginFill(0x00bcd4);
            g.drawRect(x + 4, y - h * 0.35, w - 8, 4);
            g.endFill();
            g.beginFill(0x26c6da, 0.85);
            g.drawCircle(x + w * 0.5, y + h * 0.3, w * 0.22);
            g.endFill();
        }

        this.serviceBadges(g, b, x, y, w);
        this.occupancyBar(g, b, x, y, w, h);
    }

    // --- Infrastructure & Civic Buildings ---

    drawRoad(g, b, x, y, w, h) {
        const city = this.game.city;
        const top = city.isRoadTile(b.x, b.y - 1);
        const bottom = city.isRoadTile(b.x, b.y + 1);
        const left = city.isRoadTile(b.x - 1, b.y);
        const right = city.isRoadTile(b.x + 1, b.y);

        g.beginFill(0x546e7a);
        g.drawRect(x, y, w, h);
        g.endFill();

        const arm = w * 0.5;
        const off = (w - arm) / 2;
        const midX = x + w / 2, midY = y + h / 2;

        g.beginFill(0x37474f);
        if (top) g.drawRect(x + off, y, arm, h / 2);
        if (bottom) g.drawRect(x + off, midY, arm, h / 2);
        if (left) g.drawRect(x, y + off, w / 2, arm);
        if (right) g.drawRect(midX, y + off, w / 2, arm);
        g.drawRect(x + off, y + off, arm, arm);
        g.endFill();

        // Yellow center dashes
        g.beginFill(0xffeb3b, 0.9);
        if (top || bottom) g.drawRect(midX - 1, y + 2, 2, h - 4);
        if (left || right) g.drawRect(x + 2, midY - 1, w - 4, 2);
        g.endFill();
    }

    drawBridge(g, b, x, y, w, h) {
        // Wooden/steel river bridge with piers
        g.beginFill(0x3e2723);
        g.drawRect(x, y, w, h);
        g.endFill();
        g.beginFill(0x795548);
        g.drawRect(x + 2, y + 2, w - 4, h - 4);
        g.endFill();
        // Bridge railings
        g.beginFill(0xd7ccc8);
        g.drawRect(x, y, w, 2);
        g.drawRect(x, y + h - 2, w, 2);
        g.endFill();
    }

    drawPark(g, b, x, y, w, h) {
        g.beginFill(0x81c784);
        g.drawRect(x + 1, y + 1, w - 2, h - 2);
        g.endFill();
        // Pond
        g.beginFill(0x4fc3f7);
        g.drawCircle(x + w * 0.6, y + h * 0.6, w * 0.22);
        g.endFill();
        // Trees
        g.beginFill(0x2e7d32);
        g.drawCircle(x + w * 0.25, y + h * 0.35, w * 0.18);
        g.drawCircle(x + w * 0.75, y + h * 0.28, w * 0.15);
        g.endFill();
    }

    drawPowerPlant(g, b, x, y, w, h) {
        this.dropShadow(g, x, y, w, h);
        g.beginFill(0x9e9e9e);
        g.drawRect(x + w * 0.05, y + h * 0.05, w * 0.90, h * 0.90);
        g.endFill();
        // Cooling towers
        const cx = x + w * 0.3;
        g.beginFill(0xe0e0e0);
        g.drawRect(cx - w * 0.15, y + h * 0.2, w * 0.3, h * 0.7);
        g.drawRect(cx + w * 0.25, y + h * 0.2, w * 0.3, h * 0.7);
        g.endFill();
        // Generator hall
        g.beginFill(0x424242);
        g.drawRect(x + w * 0.55, y + h * 0.45, w * 0.38, h * 0.48);
        g.endFill();
    }

    drawWindTurbine(g, b, x, y, w, h) {
        // Base mast
        g.beginFill(0x000000, 0.2);
        g.drawCircle(x + w * 0.5 + 2, y + h * 0.85 + 2, w * 0.15);
        g.endFill();
        g.beginFill(0xeeeeee);
        g.drawRect(x + w * 0.46, y + h * 0.2, w * 0.08, h * 0.65);
        g.endFill();
        // Hub
        const hubX = x + w * 0.5, hubY = y + h * 0.2;
        g.beginFill(0x00bcd4);
        g.drawCircle(hubX, hubY, 3.5);
        g.endFill();
        // Spinning blades
        const angle = (performance.now() / 300);
        for (let i = 0; i < 3; i++) {
            const a = angle + (i * Math.PI * 2) / 3;
            g.lineStyle(2, 0xffffff);
            g.moveTo(hubX, hubY);
            g.lineTo(hubX + Math.cos(a) * (w * 0.38), hubY + Math.sin(a) * (w * 0.38));
        }
        g.lineStyle(0);
    }

    drawWaterTower(g, b, x, y, w, h) {
        this.dropShadow(g, x, y, w, h);
        g.beginFill(0xb3e5fc, 0.4);
        g.drawRect(x + 2, y + 2, w - 4, h - 4);
        g.endFill();
        // Dual Tanks
        g.beginFill(0x0288d1);
        g.drawCircle(x + w * 0.35, y + h * 0.45, w * 0.22);
        g.drawCircle(x + w * 0.68, y + h * 0.55, w * 0.22);
        g.endFill();
    }

    drawWaterPump(g, b, x, y, w, h) {
        g.beginFill(0x0277bd);
        g.drawRect(x + 2, y + 2, w - 4, h - 4);
        g.endFill();
        g.beginFill(0x4fc3f7);
        g.drawCircle(x + w * 0.5, y + h * 0.5, w * 0.25);
        g.endFill();
    }

    drawFireStation(g, b, x, y, w, h) {
        this.dropShadow(g, x, y, w, h);
        g.beginFill(0xb71c1c);
        g.drawRect(x + 3, y + 3, w - 6, h - 6);
        g.endFill();
        // Yellow doors / garage bays
        g.beginFill(0xffeb3b);
        g.drawRect(x + w * 0.15, y + h * 0.55, w * 0.3, h * 0.38);
        g.drawRect(x + w * 0.55, y + h * 0.55, w * 0.3, h * 0.38);
        g.endFill();
        // Roof siren
        g.beginFill(0xff1744);
        g.drawCircle(x + w * 0.5, y + h * 0.25, 4);
        g.endFill();
    }

    drawPoliceStation(g, b, x, y, w, h) {
        this.dropShadow(g, x, y, w, h);
        g.beginFill(0x1565c0);
        g.drawRect(x + 3, y + 3, w - 6, h - 6);
        g.endFill();
        // Roof antenna & badge
        g.beginFill(0xffffff);
        g.drawRect(x + w * 0.2, y + h * 0.4, w * 0.6, h * 0.45);
        g.endFill();
        g.beginFill(0xffd600);
        g.drawCircle(x + w * 0.5, y + h * 0.62, 5);
        g.endFill();
    }

    drawHospital(g, b, x, y, w, h) {
        this.dropShadow(g, x, y, w, h);
        g.beginFill(0xf5f5f5);
        g.drawRect(x + 3, y + 3, w - 6, h - 6);
        g.endFill();
        // Red Cross
        const cx = x + w * 0.5, cy = y + h * 0.5;
        g.beginFill(0xd50000);
        g.drawRect(cx - 3, cy - 12, 6, 24);
        g.drawRect(cx - 12, cy - 3, 24, 6);
        g.endFill();
    }

    drawSchool(g, b, x, y, w, h) {
        this.dropShadow(g, x, y, w, h);
        g.beginFill(0xef6c00);
        g.drawRect(x + 3, y + 3, w - 6, h - 6);
        g.endFill();
        // Clock Tower
        g.beginFill(0xffe082);
        g.drawRect(x + w * 0.35, y + h * 0.15, w * 0.3, h * 0.7);
        g.endFill();
        g.beginFill(0x3e2723);
        g.drawCircle(x + w * 0.5, y + h * 0.35, 4);
        g.endFill();
    }

    drawCityHall(g, b, x, y, w, h) {
        this.dropShadow(g, x, y, w, h);
        g.beginFill(0xfff8e1);
        g.drawRect(x + 3, y + 3, w - 6, h - 6);
        g.endFill();
        // Golden Dome
        g.beginFill(0xffd700);
        g.drawCircle(x + w * 0.5, y + h * 0.35, w * 0.25);
        g.endFill();
        // Classical Pillars
        g.beginFill(0x757575);
        for (let i = 0; i < 4; i++) {
            g.drawRect(x + w * (0.18 + i * 0.2), y + h * 0.55, w * 0.08, h * 0.38);
        }
        g.endFill();
    }

    drawConstructionSite(g, b, x, y, w, h) {
        g.beginFill(0x8d6e63);
        g.drawRect(x + 1, y + 1, w - 2, h - 2);
        g.endFill();
        // Crane
        g.lineStyle(2, 0xff5722);
        g.moveTo(x + w * 0.8, y + h * 0.9); g.lineTo(x + w * 0.8, y + h * 0.1);
        g.lineTo(x + w * 0.2, y + h * 0.1);
        g.lineStyle(0);
        // Progress bar
        const pct = clamp(b.progressTicks / CONFIG.DEV.CONSTRUCTION_TICKS, 0, 1);
        g.beginFill(0x000000, 0.5);
        g.drawRect(x + 3, y + h - 6, w - 6, 4);
        g.endFill();
        g.beginFill(0xffca28);
        g.drawRect(x + 3, y + h - 6, Math.max(1, (w - 6) * pct), 4);
        g.endFill();
    }

    drawAbandoned(g, b, x, y, w, h) {
        g.beginFill(0x78909c);
        g.drawRect(x + 3, y + h * 0.3, w - 6, h * 0.62);
        g.endFill();
        g.beginFill(0x37474f);
        g.drawRect(x + w * 0.15, y + h * 0.5, w * 0.2, h * 0.15);
        g.drawRect(x + w * 0.65, y + h * 0.5, w * 0.2, h * 0.15);
        g.endFill();
    }

    drawBurning(g, b, x, y, w, h) {
        // Charred frame with animated flickering flames
        g.beginFill(0x212121);
        g.drawRect(x + 2, y + 2, w - 4, h - 4);
        g.endFill();

        const flicker = Math.sin(performance.now() / 80) * 3;
        g.beginFill(0xff5722);
        g.moveTo(x + 3, y + h - 3);
        g.lineTo(x + w * 0.3, y + h * 0.2 + flicker);
        g.lineTo(x + w * 0.6, y + h * 0.4 - flicker);
        g.lineTo(x + w * 0.8, y + h * 0.1 + flicker);
        g.lineTo(x + w - 3, y + h - 3);
        g.closePath();
        g.endFill();

        g.beginFill(0xffeb3b);
        g.drawCircle(x + w * 0.5, y + h * 0.5 + flicker, w * 0.22);
        g.endFill();
    }

    drawRubble(g, b, x, y, w, h) {
        g.beginFill(0x424242);
        g.drawRect(x + 2, y + 2, w - 4, h - 4);
        g.endFill();
        g.beginFill(0x616161);
        g.drawRect(x + w * 0.2, y + h * 0.3, w * 0.4, h * 0.2);
        g.drawRect(x + w * 0.5, y + h * 0.6, w * 0.3, h * 0.25);
        g.endFill();
    }

    // --- Traffic & Pedestrians Rendering ---
    renderTrafficAndSims() {
        const traffic = this.game.traffic;
        const g = this.fxG;
        g.clear();
        if (!traffic) return;

        const cell = CONFIG.CELL;

        // Render Pedestrians (Sims)
        for (const sim of traffic.sims) {
            const sx = (sim.x + 0.5 + sim.sideOffset) * cell;
            const sy = (sim.y + 0.5 + sim.sideOffset) * cell;
            g.beginFill(sim.color);
            g.drawCircle(sx, sy, 2);
            g.endFill();
        }

        // Render Vehicles
        for (const car of traffic.cars) {
            const cx = (car.x + 0.5) * cell;
            const cy = (car.y + 0.5) * cell;
            const cos = Math.cos(car.angle), sin = Math.sin(car.angle);
            let len = cell * 0.34, wid = cell * 0.18;

            if (car.vType === 'bus') { len = cell * 0.52; wid = cell * 0.20; }
            else if (car.vType === 'truck' || car.isFireTruck) { len = cell * 0.44; wid = cell * 0.22; }

            const pts = [
                [cx + cos * len / 2 - sin * wid / 2, cy + sin * len / 2 + cos * wid / 2],
                [cx - cos * len / 2 - sin * wid / 2, cy - sin * len / 2 + cos * wid / 2],
                [cx - cos * len / 2 + sin * wid / 2, cy - sin * len / 2 - cos * wid / 2],
                [cx + cos * len / 2 + sin * wid / 2, cy + sin * len / 2 - cos * wid / 2]
            ];

            g.beginFill(car.color);
            g.moveTo(pts[0][0], pts[0][1]);
            g.lineTo(pts[1][0], pts[1][1]);
            g.lineTo(pts[2][0], pts[2][1]);
            g.lineTo(pts[3][0], pts[3][1]);
            g.closePath();
            g.endFill();

            // Fire truck flashing siren / water spray
            if (car.isFireTruck) {
                const flashRed = (Math.floor(performance.now() / 150) % 2 === 0);
                g.beginFill(flashRed ? 0xff1744 : 0xffffff);
                g.drawCircle(cx, cy, 3.5);
                g.endFill();

                if (car.fightingFire && car.targetBuilding) {
                    // Spray water cannon stream toward burning building
                    const tx = (car.targetBuilding.x + 0.5) * cell;
                    const ty = (car.targetBuilding.y + 0.5) * cell;
                    g.lineStyle(3, 0x4fc3f7, 0.85);
                    g.moveTo(cx, cy);
                    g.lineTo(tx, ty);
                    g.lineStyle(0);
                }
            }
        }
    }

    // --- Smoke & Ambient Particles ---
    renderParticles() {
        const g = this.particlesG;
        g.clear();
        const city = this.game.city;
        const cell = CONFIG.CELL;

        // Emit industrial chimney smoke
        if (Math.random() < 0.3) {
            for (const b of city.buildings.values()) {
                if (b.type === 'power' || (b.type === 'industrial' && b.level >= 2 && b.state === 'built') || b.onFire) {
                    this.particles.push({
                        x: (b.x + 0.5) * cell + (Math.random() - 0.5) * 8,
                        y: (b.y + 0.2) * cell,
                        vx: (Math.random() - 0.5) * 0.4 - 0.2,
                        vy: -0.6 - Math.random() * 0.5,
                        r: 2 + Math.random() * 2,
                        alpha: b.onFire ? 0.8 : 0.45,
                        color: b.onFire ? 0x212121 : 0xeeeeee,
                        life: 1.0
                    });
                }
            }
        }

        // Update & render particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.r += 0.08;
            p.life -= 0.02;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            g.beginFill(p.color, p.alpha * p.life);
            g.drawCircle(p.x, p.y, p.r);
            g.endFill();
        }
    }

    // --- Day / Night Lighting ---
    renderNightOverlay() {
        const g = this.nightG;
        g.clear();
        if (this.timeOfDay === TIME_OF_DAY.DAY) return;

        const size = this.worldSize();
        const alpha = this.timeOfDay === TIME_OF_DAY.SUNSET ? 0.35 : 0.65;
        const color = this.timeOfDay === TIME_OF_DAY.SUNSET ? 0xf57c00 : 0x0a1128;

        g.beginFill(color, alpha);
        g.drawRect(-500, -500, size.w + 1000, size.h + 1000);
        g.endFill();
    }

    // --- Diagnostic Overlays ---
    renderOverlay() {
        const mode = this.game.overlayMode;
        if (mode === OVERLAYS.NONE) {
            if (this._overlayDrawnVersion !== 0) { this.overlayG.clear(); this._overlayDrawnVersion = 0; }
            return;
        }

        const now = performance.now();
        if (now - this._overlayLastDrawn < 300) return;
        this._overlayLastDrawn = now;

        const g = this.overlayG;
        g.clear();
        const city = this.game.city;
        const services = this.game.services;
        const economy = this.game.economy;
        const traffic = this.game.traffic;
        const cell = CONFIG.CELL;

        if (mode === OVERLAYS.POWER || mode === OVERLAYS.WATER) {
            const reach = mode === OVERLAYS.POWER ? services.poweredRoads : services.wateredRoads;
            const tint = mode === OVERLAYS.POWER ? 0xffca28 : 0x4fc3f7;

            for (const idx of reach) {
                const x = (idx % city.width) * cell;
                const y = Math.floor(idx / city.width) * cell;
                g.beginFill(tint, 0.35);
                g.drawRect(x + 2, y + 2, cell - 4, cell - 4);
                g.endFill();
            }
        } else if (mode === OVERLAYS.LAND) {
            for (let y = 0; y < city.height; y++) {
                for (let x = 0; x < city.width; x++) {
                    if (city.terrainAt(x, y) === TERRAIN.WATER) continue;
                    const v = economy.landValue(x, y);
                    g.beginFill(0x4caf50, clamp(v / 120, 0.05, 0.55));
                    g.drawRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
                    g.endFill();
                }
            }
        } else if (mode === OVERLAYS.FIRE || mode === OVERLAYS.CRIME || mode === OVERLAYS.HEALTH || mode === OVERLAYS.EDUCATION) {
            let cov = services.fireCoverage;
            let tint = 0xe53935;
            if (mode === OVERLAYS.CRIME) { cov = services.policeCoverage; tint = 0x1e88e5; }
            else if (mode === OVERLAYS.HEALTH) { cov = services.healthCoverage; tint = 0xab47bc; }
            else if (mode === OVERLAYS.EDUCATION) { cov = services.educationCoverage; tint = 0xffb300; }

            for (let y = 0; y < city.height; y++) {
                for (let x = 0; x < city.width; x++) {
                    const val = cov[y * city.width + x];
                    if (val > 0) {
                        g.beginFill(tint, clamp(val / 100, 0.1, 0.5));
                        g.drawRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
                        g.endFill();
                    }
                }
            }
        } else if (mode === OVERLAYS.TRAFFIC) {
            for (let y = 0; y < city.height; y++) {
                for (let x = 0; x < city.width; x++) {
                    const density = traffic.roadDensity[y * city.width + x];
                    if (density > 0) {
                        g.beginFill(0xff3d00, clamp(density / 30, 0.15, 0.65));
                        g.drawRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
                        g.endFill();
                    }
                }
            }
        }
    }

    // --- Cursor & Previews ---
    renderCursor() {
        const g = this.cursorG;
        g.clear();
        const input = this.game.input;
        if (!input) return;
        const cell = CONFIG.CELL;

        // Selection highlight
        if (this.game.selected) {
            const b = this.game.selected;
            const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 220);
            g.lineStyle(3, 0xffeb3b, pulse);
            const size = INFRASTRUCTURE[b.type] ? INFRASTRUCTURE[b.type].size : 1;
            g.drawRect(b.x * cell - 2, b.y * cell - 2, size * cell + 4, size * cell + 4);
            g.lineStyle(0);
        }

        // Zone rectangle drag preview
        if (input.isPaintingZones() && input.dragRect) {
            const r = input.dragRect;
            const key = input.tool.replace('zone_', '');
            const valid = this.game.canZoneRect(r.x, r.y, r.w, r.h);
            const color = parseInt((ZONES[key] ? ZONES[key].color : '#ffffff').replace('#', ''), 16);
            g.beginFill(valid ? color : 0xef5350, 0.25);
            g.drawRect(r.x * cell, r.y * cell, r.w * cell, r.h * cell);
            g.endFill();
            g.lineStyle(2, valid ? color : 0xef5350, 0.9);
            g.drawRect(r.x * cell, r.y * cell, r.w * cell, r.h * cell);
            g.lineStyle(0);
            return;
        }

        // Straight line road drag preview
        if (input.isDraggingRoad() && input.roadLine) {
            const line = input.roadLine;
            for (const pt of line.tiles) {
                const isWater = this.game.city.isWater(pt.x, pt.y);
                g.beginFill(isWater ? 0x8d6e63 : 0xcfd8dc, 0.4);
                g.drawRect(pt.x * cell + 1, pt.y * cell + 1, cell - 2, cell - 2);
                g.endFill();
                g.lineStyle(2, 0x4caf50, 0.9);
                g.drawRect(pt.x * cell + 1, pt.y * cell + 1, cell - 2, cell - 2);
                g.lineStyle(0);
            }
            return;
        }

        if (!input.hoverTile) return;
        const gx = input.hoverTile.x, gy = input.hoverTile.y;
        const tool = input.tool;

        if (tool === 'select' || tool === 'bulldoze') {
            if (tool === 'bulldoze') {
                g.lineStyle(2, 0xef5350, 0.95);
                g.drawRect(gx * cell + 1, gy * cell + 1, cell - 2, cell - 2);
                g.lineStyle(0);
            }
            return;
        }

        if (tool.startsWith('zone_')) {
            const key = tool.replace('zone_', '');
            const ok = this.game.canPlaceOnTile(gx, gy);
            const color = parseInt(ZONES[key].color.replace('#', ''), 16);
            g.beginFill(ok ? color : 0xef5350, 0.3);
            g.drawRect(gx * cell + 1, gy * cell + 1, cell - 2, cell - 2);
            g.endFill();
            g.lineStyle(2, ok ? color : 0xef5350, 0.9);
            g.drawRect(gx * cell + 1, gy * cell + 1, cell - 2, cell - 2);
            g.lineStyle(0);
        } else if (tool === 'road') {
            const isWater = this.game.city.isWater(gx, gy);
            const ok = isWater ? this.game.canPlaceBridge(gx, gy) : this.game.canPlaceRoad(gx, gy);
            g.beginFill(isWater ? 0x8d6e63 : 0xcfd8dc, 0.45);
            g.drawRect(gx * cell + 1, gy * cell + 1, cell - 2, cell - 2);
            g.endFill();
            g.lineStyle(2, ok ? 0x2e7d32 : 0xef5350, 0.95);
            g.drawRect(gx * cell + 1, gy * cell + 1, cell - 2, cell - 2);
            g.lineStyle(0);
        } else {
            const infra = INFRASTRUCTURE[tool];
            if (!infra) return;
            const size = infra.size;
            const ok = this.game.canPlaceInfrastructure(tool, gx, gy, size);
            g.lineStyle(2, ok ? 0x2e7d32 : 0xef5350, 0.95);
            g.drawRect(gx * cell, gy * cell, size * cell, size * cell);
            g.lineStyle(0);
        }
    }
}

window.Renderer = Renderer;
window.OVERLAYS = OVERLAYS;
window.TIME_OF_DAY = TIME_OF_DAY;
