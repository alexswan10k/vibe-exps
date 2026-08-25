// Layered Pixi renderer.
//   terrainG   static terrain, rebuilt on load/reset only
//   zoneG      zone tints, rebuilt when zones change
//   buildings  one Graphics per building, redrawn only when its visual
//              signature changes (level/state/occupancy/services/roads)
//   overlayG   data overlays (power/water/land value)
//   fxG        cars
//   cursorG    placement ghosts, zone-rect preview, selection highlight

const OVERLAYS = { NONE: 'none', POWER: 'power', WATER: 'water', LAND: 'land' };

class Renderer {
    constructor(game) {
        this.game = game;
        this.container = document.getElementById('pixi-canvas');

        this.camera = { x: 0, y: 0, zoom: 1 };

        this.buildingGraphics = new Map();
        this._colorCache = new Map();

        this._boundResize = this.handleResize.bind(this);
        this._boundRender = this.render.bind(this);

        this._overlayLastDrawn = 0;
        this._overlayDrawnVersion = -1;

        this.init();
    }

    // --- Colour helpers ---
    typeColor(typeKey) {
        if (!this._colorCache.has(typeKey)) {
            const def = INFRASTRUCTURE[typeKey];
            const hexString = def ? null : ZONES[typeKey].color;
            const fallback = { road: '#8fa3ad', park: '#66bb6a', power: '#fdd835', water: '#4fc3f7' }[typeKey];
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
                    backgroundColor: 0x3d7fb8,   // ocean surrounding the map
                    antialias: true,
                    resolution: window.devicePixelRatio || 1,
                    autoDensity: true
                });
            } catch (e) {
                try {
                    this.app = new PIXI.Application({
                        width, height, backgroundColor: 0x3d7fb8,
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
            this.cursorG = new PIXI.Graphics();

            this.terrainBase = new PIXI.Graphics();     // land + water fills
            this.terrainDetail = new PIXI.Graphics();   // trees etc.
            this.terrainG.addChild(this.terrainBase, this.terrainDetail);

            this.stage.addChild(
                this.terrainG, this.zoneG, this.buildingLayer,
                this.overlayG, this.fxG, this.cursorG
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
        const clamped = clamp(zoom, 0.35, 2.5);
        if (clamped === this.camera.zoom) return;
        const anchor = this.screenToWorld(anchorScreenX, anchorScreenY);
        this.camera.zoom = clamped;
        // Keep the world point under the cursor fixed
        this.camera.x = anchor.x - (anchorScreenX - this.app.renderer.width / 2) / clamped;
        this.camera.y = anchor.y - (anchorScreenY - this.app.renderer.height / 2) / clamped;
        this.clampCamera();
        this.updateCamera();
    }

    clampCamera() {
        const size = this.worldSize();
        const margin = 300;
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
        this.renderCars();
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

        // Land mass
        base.beginFill(0x74ad52);
        base.drawRect(0, 0, city.width * cell, city.height * cell);
        base.endFill();

        // Water tiles
        base.beginFill(0x4a90cb);
        for (let y = 0; y < city.height; y++) {
            for (let x = 0; x < city.width; x++) {
                if (city.terrain[y * city.width + x] === TERRAIN.WATER) {
                    base.drawRect(x * cell, y * cell, cell, cell);
                }
            }
        }
        base.endFill();

        // Shore foam where water meets land
        base.lineStyle(2, 0xa8d4ee, 0.9);
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

        // Trees
        const rngShades = [0x3e7d39, 0x357033, 0x468a40];
        for (let y = 0; y < city.height; y++) {
            for (let x = 0; x < city.width; x++) {
                const idx = y * city.width + x;
                if (city.terrain[idx] !== TERRAIN.TREES) continue;
                const v = city.variants[idx];
                const px = x * cell + cell / 2;
                const py = y * cell + cell / 2;
                const jitter = ((v * 37) % 7) - 3;

                detail.beginFill(0x000000, 0.15);
                detail.drawEllipse(px + jitter + 2, py + cell * 0.32, cell * 0.3, cell * 0.12);
                detail.endFill();

                detail.beginFill(0x6b4a2f);
                detail.drawRect(px + jitter - 1.5, py, 3, cell * 0.34);
                detail.endFill();

                detail.beginFill(rngShades[v % rngShades.length]);
                detail.drawCircle(px + jitter, py - cell * 0.12, cell * 0.3);
                detail.endFill();

                detail.beginFill(0xffffff, 0.12);
                detail.drawCircle(px + jitter - cell * 0.09, py - cell * 0.2, cell * 0.11);
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

        const zoneAlpha = { residential: 0.30, commercial: 0.26, industrial: 0.26 };
        for (let y = 0; y < city.height; y++) {
            for (let x = 0; x < city.width; x++) {
                const z = city.zones[y * city.width + x];
                if (!z) continue;
                const key = window.zoneByTileId(z);
                const color = parseInt(ZONES[key].color.replace('#', ''), 16);
                g.beginFill(color, zoneAlpha[key]);
                g.drawRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
                g.endFill();
                g.lineStyle(1, color, 0.55);
                g.drawRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
                g.lineStyle(0);
            }
        }
    }

    // --- Buildings ---
    buildingSignature(b) {
        let sig = `${b.type}|${b.level}|${b.state}|${b.variant}`;

        if (b.type === 'road') {
            const city = this.game.city;
            const road = (x, y) => {
                const n = city.buildingAt(x, y);
                return n && n.type === 'road' ? 1 : 0;
            };
            sig += `|${road(b.x, b.y - 1)}${road(b.x, b.y + 1)}${road(b.x - 1, b.y)}${road(b.x + 1, b.y)}`;
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

        if (b.type === 'road') return this.drawRoad(graphics, b, b.x * cell, b.y * cell, w, h);
        if (b.type === 'park') return this.drawPark(graphics, b, b.x * cell, b.y * cell, w, h);
        if (b.type === 'power') return this.drawPowerPlant(graphics, b, b.x * cell, b.y * cell, w * 2, h * 2);
        if (b.type === 'water') return this.drawWaterTower(graphics, b, b.x * cell, b.y * cell, w * 2, h * 2);

        // Zoned developments
        if (b.state === 'construction') return this.drawConstructionSite(graphics, b, b.x * cell, b.y * cell, w, h);
        if (b.type === 'residential') return this.drawResidential(graphics, b, b.x * cell, b.y * cell, w, h);
        if (b.type === 'commercial') return this.drawCommercial(graphics, b, b.x * cell, b.y * cell, w, h);
        if (b.type === 'industrial') return this.drawIndustrial(graphics, b, b.x * cell, b.y * cell, w, h);
    }

    dropShadow(g, x, y, w, h) {
        g.beginFill(0x000000, 0.18);
        g.drawRect(x + 2, y + 3, w, h);
        g.endFill();
    }

    serviceBadges(g, b, x, y, w) {
        const icons = [];
        if (b.connected === false) icons.push({ c: 0xff7043, label: 'R' });
        if (b.powered === false) icons.push({ c: 0xffca28, label: 'P' });
        if (b.watered === false) icons.push({ c: 0x4fc3f7, label: 'W' });

        let bx = x + w - icons.length * 7 - 2;
        for (const icon of icons) {
            g.beginFill(icon.c, 0.95);
            g.drawCircle(bx, y + 6, 3);
            g.endFill();
            bx += 7;
        }
    }

    occupancyBar(g, b, x, y, w, h) {
        const lvl = levelDef(b.type, b.level);
        const cap = lvl.capacity > 0 ? lvl.capacity : lvl.jobCapacity;
        if (cap <= 0) return;
        const used = lvl.capacity > 0 ? b.pop : b.jobs;
        const ratio = used / cap;
        const pad = 3;
        const barY = y + h - pad - 3;

        g.beginFill(0x000000, 0.4);
        g.drawRoundedRect(x + pad, barY, w - pad * 2, 3, 1.5);
        g.endFill();

        if (ratio > 0.02) {
            g.beginFill(lvl.capacity > 0 ? 0x81d4fa : 0xa5d6a7);
            g.drawRoundedRect(x + pad, barY, Math.max(1, (w - pad * 2) * ratio), 3, 1.5);
            g.endFill();
        }
    }

    // Residential levels: house -> townhouse row -> apartment block
    drawResidential(g, b, x, y, w, h) {
        if (b.state === 'abandoned') return this.drawAbandoned(g, b, x, y, w, h);
        const seed = this.seedOf(b.id);
        const wallA = 0xf3ead8, roofA = 0xb5563f, roofB = 0x8f4433;

        if (b.level === 1) {
            this.dropShadow(g, x + 4, y + 4, w - 8, h - 10);
            g.beginFill(wallA);
            g.drawRect(x + 4, y + h * 0.42, w - 8, h * 0.48);
            g.endFill();
            g.beginFill(roofA);
            g.moveTo(x + 2, y + h * 0.44);
            g.lineTo(x + w / 2, y + h * 0.08);
            g.lineTo(x + w - 2, y + h * 0.44);
            g.closePath();
            g.endFill();
            g.beginFill(roofB);
            g.drawRect(x + 2, y + h * 0.42, w - 4, 2);
            g.endFill();
            g.beginFill(0x5d4037);
            g.drawRect(x + w * 0.42, y + h * 0.68, w * 0.16, h * 0.22);
            g.endFill();
            g.beginFill(((seed >> 1) & 1) ? 0xffe082 : 0xcfe8ff);
            g.drawRect(x + w * 0.14, y + h * 0.52, w * 0.18, h * 0.15);
            g.drawRect(x + w * 0.68, y + h * 0.52, w * 0.18, h * 0.15);
            g.endFill();

            this.serviceBadges(g, b, x, y, w);
            this.occupancyBar(g, b, x, y, w, h);
        } else if (b.level === 2) {
            this.dropShadow(g, x + 2, y + 4, w - 4, h - 8);
            g.beginFill(wallA);
            g.drawRect(x + 2, y + h * 0.30, w - 4, h * 0.62);
            g.endFill();
            // Two roof sections
            g.beginFill(roofA);
            g.moveTo(x + 1, y + h * 0.34); g.lineTo(x + w * 0.27, y + h * 0.06); g.lineTo(x + w * 0.53, y + h * 0.34);
            g.moveTo(x + w * 0.47, y + h * 0.34); g.lineTo(x + w * 0.73, y + h * 0.06); g.lineTo(x + w - 1, y + h * 0.34);
            g.closePath(); g.endFill();
            // Doors + windows
            g.beginFill(0x5d4037);
            g.drawRect(x + w * 0.20, y + h * 0.72, w * 0.12, h * 0.20);
            g.drawRect(x + w * 0.62, y + h * 0.72, w * 0.12, h * 0.20);
            g.endFill();
            for (let i = 0; i < 4; i++) {
                const lit = ((seed >> i) & 1) === 1;
                g.beginFill(lit ? 0xffe082 : 0xcfe8ff);
                g.drawRect(x + w * (0.06 + (i % 2) * 0.48), y + h * (0.42 + Math.floor(i / 2) * 0.14), w * 0.16, h * 0.11);
                g.endFill();
            }
            this.serviceBadges(g, b, x, y, w);
            this.occupancyBar(g, b, x, y, w, h);
        } else {
            // Apartment block rises above its tile
            const topY = y - h * 0.55;
            this.dropShadow(g, x + 2, y + 4, w - 4, h - 8);
            g.beginFill(0xe8e0cf);
            g.drawRect(x + 2, topY, w - 4, y + h - 4 - topY);
            g.endFill();
            g.beginFill(0x9e8f78);
            g.drawRect(x + 2, topY, w - 4, 4);
            g.endFill();
            g.beginFill(0x37474f);
            g.drawRect(x + w * 0.38, y + h * 0.74, w * 0.24, h * 0.16);
            g.endFill();
            for (let row = 0; row < 4; row++) {
                for (let col = 0; col < 3; col++) {
                    const lit = ((seed >> (row * 3 + col)) & 1) === 1;
                    g.beginFill(lit ? 0xffd54f : 0x90caf9, lit ? 1 : 0.9);
                    g.drawRect(x + w * (0.12 + col * 0.27), topY + 8 + row * ((h * 0.62) / 4), w * 0.17, h * 0.10);
                    g.endFill();
                }
            }
            this.serviceBadges(g, b, x, y, w);
            this.occupancyBar(g, b, x, y, w, h);
        }
    }

    // Commercial levels: shop -> offices -> mall/tower
    drawCommercial(g, b, x, y, w, h) {
        if (b.state === 'abandoned') return this.drawAbandoned(g, b, x, y, w, h);
        const seed = this.seedOf(b.id);
        const accent = 0x1976d2;

        if (b.level === 1) {
            this.dropShadow(g, x + 3, y + 4, w - 6, h - 8);
            g.beginFill(0xfff3e0);
            g.drawRect(x + 3, y + h * 0.36, w - 6, h * 0.56);
            g.endFill();
            // Awning stripes
            for (let i = 0; i < 4; i++) {
                g.beginFill(i % 2 ? 0xe53935 : 0xffffff);
                g.drawRect(x + 3 + i * ((w - 6) / 4), y + h * 0.36, (w - 6) / 4, h * 0.12);
                g.endFill();
            }
            g.beginFill(accent);
            g.drawRect(x + 3, y + h * 0.30, w - 6, h * 0.08);
            g.endFill();
            g.beginFill(0x4e342e);
            g.drawRect(x + w * 0.34, y + h * 0.62, w * 0.32, h * 0.30);
            g.endFill();
            g.beginFill(0xffd54f, ((seed & 1) ? 0.95 : 0.4));
            g.drawRect(x + w * 0.10, y + h * 0.56, w * 0.16, h * 0.16);
            g.drawRect(x + w * 0.74, y + h * 0.56, w * 0.16, h * 0.16);
            g.endFill();

            this.serviceBadges(g, b, x, y, w);
            this.occupancyBar(g, b, x, y, w, h);
        } else if (b.level === 2) {
            this.dropShadow(g, x + 2, y + 4, w - 4, h - 8);
            g.beginFill(accent);
            g.drawRect(x + 2, y + 2, w - 4, h - 6);
            g.endFill();
            g.beginFill(this.shade(accent, 0.65));
            g.drawRect(x + 2, y + 2, w - 4, h * 0.12);
            g.endFill();
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 2; col++) {
                    const lit = ((seed >> (row * 2 + col)) & 1) === 1;
                    g.beginFill(lit ? 0xfff59d : 0xe8f4fd);
                    g.drawRect(x + w * (0.12 + col * 0.42), y + h * (0.22 + row * 0.23), w * 0.34, h * 0.18);
                    g.endFill();
                }
            }
            this.serviceBadges(g, b, x, y, w);
            this.occupancyBar(g, b, x, y, w, h);
        } else {
            const topY = y - h * 0.75;
            this.dropShadow(g, x + 2, y + 4, w - 4, h - 8);
            g.beginFill(0x265d9e);
            g.drawRect(x + 2, topY, w - 4, y + h - 4 - topY);
            g.endFill();
            // Glass bands
            for (let row = 0; row < 6; row++) {
                g.beginFill(row % 2 ? 0xdceefc : 0xbcd9f0, 0.92);
                g.drawRect(x + 4, topY + 6 + row * ((y + h - 10 - topY) / 6), w - 8, (y + h - 10 - topY) / 6 - 2);
                g.endFill();
            }
            // Rooftop sign
            g.beginFill(0xe53935);
            g.drawRect(x + w * 0.14, topY - 7, w * 0.72, 6);
            g.endFill();
            this.serviceBadges(g, b, x, y, w);
            this.occupancyBar(g, b, x, y, w, h);
        }
    }

    // Industrial levels: workshop -> factory -> heavy industry
    drawIndustrial(g, b, x, y, w, h) {
        if (b.state === 'abandoned') return this.drawAbandoned(g, b, x, y, w, h);
        const base = 0xd8a047;

        if (b.level === 1) {
            this.dropShadow(g, x + 3, y + 4, w - 6, h - 8);
            g.beginFill(base);
            g.drawRect(x + 3, y + h * 0.42, w - 6, h * 0.5);
            g.endFill();
            g.beginFill(this.shade(base, 0.7));
            g.moveTo(x + 2, y + h * 0.44); g.lineTo(x + w / 2, y + h * 0.14); g.lineTo(x + w - 2, y + h * 0.44);
            g.closePath(); g.endFill();
            g.beginFill(0x616161);
            g.drawRect(x + w * 0.18, y + h * 0.62, w * 0.4, h * 0.30);
            g.endFill();
            g.beginFill(0x8d6e63);
            g.drawRect(x + w * 0.72, y + h * 0.16, w * 0.12, h * 0.30);
            g.endFill();
            g.beginFill(0xffffff, 0.45);
            g.drawCircle(x + w * 0.78, y + h * 0.08, w * 0.08);
            g.endFill();
            this.serviceBadges(g, b, x, y, w);
            this.occupancyBar(g, b, x, y, w, h);
        } else if (b.level === 2) {
            this.dropShadow(g, x + 2, y + 4, w - 4, h - 8);
            g.beginFill(base);
            g.drawRect(x + 2, y + h * 0.28, w - 4, h * 0.64);
            g.endFill();
            g.beginFill(this.shade(base, 0.68));
            g.moveTo(x + 1, y + h * 0.30);
            g.lineTo(x + w * 0.25, y + h * 0.06); g.lineTo(x + w * 0.5, y + h * 0.30);
            g.lineTo(x + w * 0.75, y + h * 0.06); g.lineTo(x + w - 1, y + h * 0.30);
            g.closePath(); g.endFill();
            g.beginFill(0x616161);
            g.drawRect(x + w * 0.10, y + h * 0.56, w * 0.46, h * 0.36);
            g.endFill();
            g.lineStyle(1, 0x9e9e9e);
            for (let i = 1; i < 3; i++) {
                g.moveTo(x + w * 0.10, y + h * (0.56 + i * 0.12));
                g.lineTo(x + w * 0.56, y + h * (0.56 + i * 0.12));
            }
            g.lineStyle(0);
            g.beginFill(0x8d6e63);
            g.drawRect(x + w * 0.72, y - h * 0.02, w * 0.13, h * 0.34);
            g.endFill();
            g.beginFill(0xffffff, 0.5);
            g.drawCircle(x + w * 0.785, y - h * 0.1, w * 0.09);
            g.endFill();
            g.beginFill(0xffffff, 0.25);
            g.drawCircle(x + w * 0.86, y - h * 0.22, w * 0.12);
            g.endFill();
            this.serviceBadges(g, b, x, y, w);
            this.occupancyBar(g, b, x, y, w, h);
        } else {
            this.dropShadow(g, x + 2, y + 4, w - 4, h - 8);
            g.beginFill(this.shade(base, 0.9));
            g.drawRect(x + 1, y - h * 0.18, w - 2, y + h - 4 - (y - h * 0.18));
            g.endFill();
            g.beginFill(this.shade(base, 0.62));
            g.drawRect(x + 1, y - h * 0.18, w - 2, 4);
            g.endFill();
            // Two chimneys + tanks
            g.beginFill(0x8d6e63);
            g.drawRect(x + w * 0.14, y - h * 0.42, w * 0.13, h * 0.5);
            g.drawRect(x + w * 0.40, y - h * 0.34, w * 0.13, h * 0.42);
            g.endFill();
            g.beginFill(0xffffff, 0.5);
            g.drawCircle(x + w * 0.205, y - h * 0.5, w * 0.09);
            g.drawCircle(x + w * 0.465, y - h * 0.42, w * 0.08);
            g.endFill();
            g.beginFill(0x90a4ae);
            g.drawCircle(x + w * 0.76, y + h * 0.55, w * 0.16);
            g.endFill();
            g.beginFill(0xffffff, 0.3);
            g.drawCircle(x + w * 0.71, y + h * 0.49, w * 0.05);
            g.endFill();
            g.beginFill(0x616161);
            g.drawRect(x + w * 0.08, y + h * 0.62, w * 0.34, h * 0.3);
            g.endFill();
            this.serviceBadges(g, b, x, y, w);
            this.occupancyBar(g, b, x, y, w, h);
        }
    }

    // Construction site: dirt plot, materials, crane, progress bar
    drawConstructionSite(g, b, x, y, w, h) {
        g.beginFill(0xb98d5f);
        g.drawRect(x + 1, y + 1, w - 2, h - 2);
        g.endFill();
        // Dirt texture flecks
        g.beginFill(0xa67a50, 0.8);
        g.drawRect(x + w * 0.2, y + h * 0.55, w * 0.18, h * 0.1);
        g.drawRect(x + w * 0.55, y + h * 0.3, w * 0.2, h * 0.12);
        g.endFill();
        // Sand pile
        g.beginFill(0xe0c9a0);
        g.moveTo(x + w * 0.16, y + h * 0.8);
        g.lineTo(x + w * 0.3, y + h * 0.55);
        g.lineTo(x + w * 0.44, y + h * 0.8);
        g.closePath(); g.endFill();

        // Crane: mast + jib + hook
        const mastX = x + w * 0.72;
        g.lineStyle(2, 0xd84315, 1);
        g.moveTo(mastX, y + h * 0.86);
        g.lineTo(mastX, y + h * 0.05);
        g.moveTo(mastX, y + h * 0.12);
        g.lineTo(x + w * 0.18, y + h * 0.12);
        g.lineTo(mastX, y + h * 0.26);
        g.moveTo(mastX, y + h * 0.12);
        g.lineTo(x + w * 0.94, y + h * 0.12);
        g.lineStyle(1, 0xaaaaaa, 1);
        g.moveTo(x + w * 0.30, y + h * 0.12);
        g.lineTo(x + w * 0.30, y + h * 0.3);
        g.lineStyle(0);

        // Progress
        const pct = clamp(b.progressTicks / CONFIG.DEV.CONSTRUCTION_TICKS, 0, 1);
        g.beginFill(0x000000, 0.45);
        g.drawRect(x + 3, y + h - 7, w - 6, 4);
        g.endFill();
        g.beginFill(0xffca28);
        g.drawRect(x + 3, y + h - 7, Math.max(1, (w - 6) * pct), 4);
        g.endFill();
    }

    // Abandoned: grey shell, boarded windows, weeds
    drawAbandoned(g, b, x, y, w, h) {
        g.beginFill(0x9aa5a3);
        g.drawRect(x + 3, y + h * 0.3, w - 6, h * 0.62);
        g.endFill();
        g.beginFill(0x7d8886);
        g.moveTo(x + 2, y + h * 0.34); g.lineTo(x + w / 2, y + h * 0.06); g.lineTo(x + w - 2, y + h * 0.34);
        g.closePath(); g.endFill();
        // Boarded windows
        g.beginFill(0x5c6664);
        g.drawRect(x + w * 0.14, y + h * 0.5, w * 0.2, h * 0.14);
        g.drawRect(x + w * 0.66, y + h * 0.5, w * 0.2, h * 0.14);
        g.endFill();
        // Weeds
        g.beginFill(0x6f8f4f, 0.9);
        g.drawCircle(x + w * 0.12, y + h * 0.94, 1.6);
        g.drawCircle(x + w * 0.88, y + h * 0.92, 1.4);
        g.drawCircle(x + w * 0.5, y + h * 0.97, 1.5);
        g.endFill();
    }

    drawRoad(g, b, x, y, w, h) {
        const city = this.game.city;
        const isRoad = (dx, dy) => {
            const n = city.buildingAt(b.x + dx, b.y + dy);
            return !!(n && n.type === 'road');
        };
        const top = isRoad(0, -1), bottom = isRoad(0, 1), left = isRoad(-1, 0), right = isRoad(1, 0);

        g.beginFill(0xcfd8dc);
        g.drawRect(x, y, w, h);
        g.endFill();

        const arm = w * 0.5;
        const off = (w - arm) / 2;
        const midX = x + w / 2, midY = y + h / 2;

        g.beginFill(0x4d5356);
        if (top) g.drawRect(x + off, y, arm, h / 2);
        if (bottom) g.drawRect(x + off, midY, arm, h / 2);
        if (left) g.drawRect(x, y + off, w / 2, arm);
        if (right) g.drawRect(midX, y + off, w / 2, arm);
        g.drawRect(x + off, y + off, arm, arm);
        g.endFill();

        // Dashed lane markings
        const dash = Math.max(3, w * 0.16);
        const gap = dash * 0.9;
        g.beginFill(0xffd54f, 0.9);
        if (top) for (let d = gap; d < w / 2 - dash; d += dash + gap) g.drawRect(midX - 1, y + d, 2, dash);
        if (bottom) for (let d = gap; d < w / 2 - dash; d += dash + gap) g.drawRect(midX - 1, midY + d, 2, dash);
        if (left) for (let d = gap; d < w / 2 - dash; d += dash + gap) g.drawRect(x + d, midY - 1, dash, 2);
        if (right) for (let d = gap; d < w / 2 - dash; d += dash + gap) g.drawRect(midX + d, midY - 1, dash, 2);
        g.endFill();
    }

    drawPark(g, b, x, y, w, h) {
        const seed = this.seedOf(b.id);
        g.beginFill(0x8bc34a);
        g.drawRect(x + 1, y + 1, w - 2, h - 2);
        g.endFill();

        g.beginFill(0x64b5f6);
        g.drawEllipse(x + w * 0.64, y + h * 0.68, w * 0.2, h * 0.14);
        g.endFill();
        g.beginFill(0xffffff, 0.35);
        g.drawEllipse(x + w * 0.56, y + h * 0.62, w * 0.07, h * 0.04);
        g.endFill();

        g.lineStyle(w * 0.09, 0xd7ccc8, 1);
        g.moveTo(x + w * 0.14, y + h * 0.88);
        g.quadraticCurveTo(x + w * 0.5, y + h * 0.55, x + w * 0.84, y + h * 0.22);
        g.lineStyle(0);

        const spots = [
            { tx: x + w * 0.22, ty: y + h * 0.26 },
            { tx: x + w * 0.76, ty: y + h * 0.3 },
            { tx: x + w * 0.3, ty: y + h * 0.62 }
        ];
        for (let i = 0; i < spots.length; i++) {
            const tree = spots[(seed + i) % spots.length];
            const r = w * (0.12 + ((seed >> (i * 3)) % 3) * 0.02);
            g.beginFill(0x6d4c41);
            g.drawRect(tree.tx - r * 0.14, tree.ty, r * 0.28, r * 0.7);
            g.endFill();
            g.beginFill(i % 2 ? 0x2e7d32 : 0x388e3c);
            g.drawCircle(tree.tx, tree.ty - r * 0.3, r);
            g.endFill();
        }
    }

    drawPowerPlant(g, b, x, y, w, h) {
        this.dropShadow(g, x, y, w, h);
        g.beginFill(0xbdbdbd);
        g.drawRect(x + w * 0.03, y + h * 0.05, w * 0.94, h * 0.92);
        g.endFill();

        const cx = x + w * 0.28;
        g.beginFill(0xeceff1);
        g.moveTo(cx - w * 0.15, y + h * 0.92);
        g.lineTo(cx - w * 0.09, y + h * 0.2);
        g.lineTo(cx + w * 0.09, y + h * 0.2);
        g.lineTo(cx + w * 0.15, y + h * 0.92);
        g.closePath(); g.endFill();

        g.beginFill(0xef5350);
        g.drawRect(cx - w * 0.105, y + h * 0.26, w * 0.21, h * 0.07);
        g.endFill();

        g.beginFill(0xffffff, 0.5);
        g.drawCircle(cx + w * 0.02, y + h * 0.12, w * 0.08);
        g.endFill();
        g.beginFill(0xffffff, 0.25);
        g.drawCircle(cx - w * 0.09, y + h * 0.02, w * 0.11);
        g.endFill();

        g.beginFill(0x90a4ae);
        g.drawRect(x + w * 0.52, y + h * 0.42, w * 0.42, h * 0.5);
        g.endFill();
        g.lineStyle(2, 0x78909c);
        g.drawRect(x + w * 0.52, y + h * 0.42, w * 0.42, h * 0.5);
        g.lineStyle(0);
        this.drawBolt(g, x + w * 0.73, y + h * 0.67, w * 0.12);

        if (b.connected === false) this.serviceBadges(g, b, x, y, w);
    }

    drawWaterTower(g, b, x, y, w, h) {
        this.dropShadow(g, x, y, w, h);
        g.beginFill(0xb3e5fc, 0.5);
        g.drawRect(x + w * 0.03, y + h * 0.05, w * 0.94, h * 0.92);
        g.endFill();

        const tanks = [
            { tx: x + w * 0.3, ty: y + h * 0.36, r: w * 0.19 },
            { tx: x + w * 0.66, ty: y + h * 0.6, r: w * 0.19 }
        ];
        g.lineStyle(3, 0x78909c, 1);
        g.moveTo(tanks[0].tx, tanks[0].ty);
        g.lineTo(tanks[1].tx, tanks[1].ty);
        g.lineStyle(0);
        for (const tank of tanks) {
            g.beginFill(0x29b6f6);
            g.drawCircle(tank.tx, tank.ty, tank.r);
            g.endFill();
            g.lineStyle(2, 0x0288d1, 1);
            g.drawCircle(tank.tx, tank.ty, tank.r);
            g.lineStyle(0);
            g.beginFill(0xffffff, 0.4);
            g.drawCircle(tank.tx - tank.r * 0.3, tank.ty - tank.r * 0.3, tank.r * 0.25);
            g.endFill();
        }
        this.drawDroplet(g, x + w * 0.5, y + h * 0.84, w * 0.08);

        if (b.connected === false) this.serviceBadges(g, b, x, y, w);
    }

    drawBolt(g, cx, cy, size) {
        g.beginFill(0xfdd835);
        g.moveTo(cx + size * 0.25, cy - size);
        g.lineTo(cx - size * 0.55, cy + size * 0.15);
        g.lineTo(cx - size * 0.05, cy + size * 0.15);
        g.lineTo(cx - size * 0.25, cy + size);
        g.lineTo(cx + size * 0.55, cy - size * 0.15);
        g.lineTo(cx + size * 0.05, cy - size * 0.15);
        g.closePath(); g.endFill();
    }

    drawDroplet(g, cx, cy, radius) {
        g.beginFill(0x29b6f6);
        g.moveTo(cx, cy - radius * 1.7);
        g.lineTo(cx + radius * 0.95, cy - radius * 0.2);
        g.arc(cx, cy, radius, 0, Math.PI);
        g.closePath(); g.endFill();
    }

    // --- Overlays ---
    renderOverlay() {
        const mode = this.game.overlayMode;
        const version = this.game.city.zonesVersion + this.game.city.buildingsVersion + this.game.city.servicesVersion;
        if (mode === OVERLAYS.NONE) {
            if (this._overlayDrawnVersion !== 0) { this.overlayG.clear(); this._overlayDrawnVersion = 0; }
            return;
        }
        const now = performance.now();
        if (version === this._overlayDrawnVersion && now - this._overlayLastDrawn < 800) return;
        this._overlayDrawnVersion = version;
        this._overlayLastDrawn = now;

        const g = this.overlayG;
        g.clear();
        const city = this.game.city;
        const services = this.game.services;
        const economy = this.game.economy;
        const cell = CONFIG.CELL;

        if (mode === OVERLAYS.POWER || mode === OVERLAYS.WATER) {
            const reach = mode === OVERLAYS.POWER ? services.poweredRoads : services.wateredRoads;
            const tint = mode === OVERLAYS.POWER ? 0xffca28 : 0x4fc3f7;

            for (const idx of reach) {
                const x = (idx % city.width) * cell;
                const y = Math.floor(idx / city.width) * cell;
                g.beginFill(tint, 0.30);
                g.drawRect(x + 2, y + 2, cell - 4, cell - 4);
                g.endFill();
            }

            for (const b of city.buildings.values()) {
                if (b.state !== 'built' || INFRASTRUCTURE[b.type]) continue;
                const served = mode === OVERLAYS.POWER ? b.powered || !b._needsPower : b.watered || !b._needsWater;
                g.lineStyle(2, served ? 0x66bb6a : 0xef5350, 0.95);
                g.drawRect(b.x * cell + 1, b.y * cell + 1, cell - 2, cell - 2);
                g.lineStyle(0);
            }
        } else if (mode === OVERLAYS.LAND) {
            for (let y = 0; y < city.height; y++) {
                for (let x = 0; x < city.width; x++) {
                    const idx = y * city.width + x;
                    if (city.terrain[idx] === TERRAIN.WATER) continue;
                    const v = economy.landValue(x, y);
                    if (v <= 10) continue;
                    g.beginFill(0x66bb6a, clamp(v / 120, 0.04, 0.5));
                    g.drawRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
                    g.endFill();
                }
            }
        }
    }

    // --- Cars ---
    renderCars() {
        const traffic = this.game.traffic;
        const g = this.fxG;
        g.clear();
        if (!traffic) return;

        const cell = CONFIG.CELL;
        for (const car of traffic.cars) {
            const cx = (car.x + 0.5) * cell;
            const cy = (car.y + 0.5) * cell;
            const len = cell * 0.34, wid = cell * 0.18;
            const cos = Math.cos(car.angle), sin = Math.sin(car.angle);

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

            g.beginFill(0x263238, 0.85);
            g.drawCircle(cx - cos * len * 0.15, cy - sin * len * 0.15, wid * 0.32);
            g.endFill();
        }
    }

    // --- Cursor layer: ghosts, previews, selection ---
    renderCursor() {
        const g = this.cursorG;
        g.clear();
        const input = this.game.input;
        if (!input) return;

        const cell = CONFIG.CELL;

        // Selection highlight
        if (this.game.selected) {
            const b = this.game.selected;
            const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 250);
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

        // Placement ghost for single-tile tools
        const tool = input.tool;
        if (tool === 'select' || tool === 'bulldoze') {
            if (tool === 'bulldoze' && input.hoverTile) {
                g.lineStyle(2, 0xef5350, 0.9);
                g.drawRect(input.hoverTile.x * cell + 1, input.hoverTile.y * cell + 1, cell - 2, cell - 2);
                g.lineStyle(0);
            }
            return;
        }

        if (!input.hoverTile) return;
        const gx = input.hoverTile.x, gy = input.hoverTile.y;

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
            const ok = this.game.canPlaceInfrastructure('road', gx, gy, 1);
            g.beginFill(0xcfd8dc, 0.5);
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
            const ghost = { id: 'ghost', type: tool, x: gx, y: gy, level: 1, variant: 0, state: 'built', pop: 0, jobs: 0 };
            g.alpha = 0.6;
            if (tool === 'park') this.drawPark(g, ghost, gx * cell, gy * cell, cell, cell);
            else if (tool === 'power') this.drawPowerPlant(g, ghost, gx * cell, gy * cell, cell * 2, cell * 2);
            else if (tool === 'water') this.drawWaterTower(g, ghost, gx * cell, gy * cell, cell * 2, cell * 2);
            g.alpha = 1;
            g.lineStyle(2, ok ? 0x2e7d32 : 0xef5350, 0.95);
            g.drawRect(gx * cell, gy * cell, size * cell, size * cell);
            g.lineStyle(0);
        }
    }
}

window.Renderer = Renderer;
window.OVERLAYS = OVERLAYS;
