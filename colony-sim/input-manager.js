/**
 * InputManager: mouse + keyboard handling and the player tool system.
 * Tools are declared declaratively so adding new orders/builds is one entry.
 */
const TOOLS = {
    select:        { kind: 'select',  name: 'Inspect',      hint: 'Click a colonist to inspect' },
    chop:          { kind: 'order',   name: 'Chop Trees',   hint: 'Drag over trees to mark them for chopping', target: 'tree',   jobType: 'chop_tree', noun: 'trees' },
    mine:          { kind: 'order',   name: 'Mine Iron',    hint: 'Drag over iron deposits to mine them',      target: 'deposit',jobType: 'mine_deposit', noun: 'deposits' },
    mine_rock:     { kind: 'order',   name: 'Mine Rock',    hint: 'Drag over rocky ground to quarry stone',    target: 'rock',   jobType: 'mine_rock', noun: 'rock tiles' },
    harvest:       { kind: 'order',   name: 'Harvest',      hint: 'Drag over bushes or ripe crops to gather food', target: 'foodPlant', jobType: null, noun: 'plants' },
    zone_stockpile:{ kind: 'zone',    name: 'Stockpile Zone',hint: 'Drag a rectangle where goods may be stored' },
    zone_growing:  { kind: 'zone',    name: 'Growing Zone', hint: 'Drag a rectangle where crops will be planted' },
    build_wall:    { kind: 'buildArea', name: 'Wall',  buildType: 'wall',  hint: 'Drag to lay out walls' },
    build_door:    { kind: 'buildOne',  name: 'Door',  buildType: 'door',  hint: 'Click to place a door' },
    build_table:   { kind: 'buildOne',  name: 'Crafting table', buildType: 'table', hint: 'Click to place a crafting table' },
    build_bed:     { kind: 'buildOne',  name: 'Bed',   buildType: 'bed',   hint: 'Click to place a bed' },
    build_chair:   { kind: 'buildOne',  name: 'Chair', buildType: 'chair', hint: 'Click to place a chair' },
    craft_meal:    { kind: 'craft',   name: 'Cook meals', item: 'meal',  hint: 'Queue cooking (2 raw food -> 2 meals)' },
    craft_tools:   { kind: 'craft',   name: 'Make tools', item: 'tools', hint: 'Queue tools (2 iron + 1 wood)' }
};

class InputManager {
    constructor(game) {
        this.game = game;
        this.keysDown = new Set();
        this.middleDrag = null;
        this.setupCanvasEvents();
        this.setupButtons();
        this.setupKeyboard();
    }

    // ---- coordinate helpers -------------------------------------------------

    tileAtEvent(e) {
        const rect = this.game.canvas.getBoundingClientRect();
        return this.game.renderer.screenToTile(e.clientX - rect.left, e.clientY - rect.top);
    }

    pxAtEvent(e) {
        const rect = this.game.canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    // ---- canvas events --------------------------------------------------------

    setupCanvasEvents() {
        const c = this.game.canvas;
        c.addEventListener('mousedown', e => this.onMouseDown(e));
        c.addEventListener('mousemove', e => this.onMouseMove(e));
        window.addEventListener('mouseup', e => this.onMouseUp(e));
        c.addEventListener('contextmenu', e => {
            e.preventDefault();
            this.game.setTool('select');
            this.game.selectedPawn = null;
        });
        c.addEventListener('wheel', e => this.onWheel(e), { passive: false });
    }

    onMouseDown(e) {
        if (e.button === 1) {
            this.middleDrag = { x: e.clientX, y: e.clientY };
            e.preventDefault();
            return;
        }
        if (e.button !== 0) return;

        const tool = TOOLS[this.game.tool];
        const t = this.tileAtEvent(e);
        if (!this.game.world.inBounds(t.x, t.y)) return;

        switch (tool.kind) {
            case 'select':
                this.clickSelect(e);
                break;
            case 'craft':
                this.game.setTool('select');
                break;
            case 'buildOne':
                this.placeBuilding(tool.buildType, t.x, t.y);
                break;
            case 'buildArea':
            case 'order':
            case 'zone':
                this.game.dragStart = t;
                this.game.dragSelection = { start: t, end: t };
                break;
        }
    }

    onMouseMove(e) {
        const t = this.tileAtEvent(e);
        this.game.hoveredTile = t;

        if (this.middleDrag) {
            this.game.camera.x -= (e.clientX - this.middleDrag.x);
            this.game.camera.y -= (e.clientY - this.middleDrag.y);
            this.game.clampCamera();
            this.middleDrag = { x: e.clientX, y: e.clientY };
            return;
        }

        if (this.game.dragSelection) {
            const clamped = {
                x: clamp(t.x, 0, this.game.world.width - 1),
                y: clamp(t.y, 0, this.game.world.height - 1)
            };
            this.game.dragSelection.end = clamped;
            this.updateDragPreview();
        }
    }

    onMouseUp(e) {
        if (e.button === 1 && this.middleDrag) {
            this.middleDrag = null;
            return;
        }
        if (e.button !== 0 || !this.game.dragSelection) return;

        const sel = this.normalizeSel(this.game.dragSelection);
        const tool = TOOLS[this.game.tool];
        this.game.dragSelection = null;
        this.game.dragPreview = null;
        if (!tool) return;

        switch (tool.kind) {
            case 'order': this.applyOrder(tool, sel); break;
            case 'zone': this.applyZone(tool, sel); break;
            case 'buildArea': this.applyBuildArea(tool, sel); break;
        }
        if (tool.kind !== 'select') this.game.setTool('select');
    }

    onWheel(e) {
        e.preventDefault();
        const g = this.game;
        const rect = g.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const oldZoom = g.zoom;
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        g.zoom = clamp(g.zoom * factor, CONFIG.minZoom, CONFIG.maxZoom);
        if (g.zoom === oldZoom) return;
        // Keep the point under the cursor stationary
        const wx = mx + g.camera.x, wy = my + g.camera.y;
        const scale = g.zoom / oldZoom;
        g.camera.x = wx * scale - mx;
        g.camera.y = wy * scale - my;
        g.clampCamera();
    }

    // ---- keyboard ------------------------------------------------------------

    setupKeyboard() {
        document.addEventListener('keydown', e => {
            if (e.repeat) return;
            this.keysDown.add(e.key.toLowerCase());
            switch (e.key) {
                case ' ': e.preventDefault(); this.game.togglePause(); break;
                case '1': this.game.setSpeed(1); break;
                case '2': this.game.setSpeed(2); break;
                case '3': this.game.setSpeed(4); break;
                case 'Escape':
                    this.game.setTool('select');
                    this.game.selectedPawn = null;
                    break;
            }
        });
        document.addEventListener('keyup', e => this.keysDown.delete(e.key.toLowerCase()));
    }

    /** Continuous panning; called each frame from Game.update. */
    tickCamera(dtSec) {
        const g = this.game;
        let dx = 0, dy = 0;
        if (this.keysDown.has('arrowleft') || this.keysDown.has('a')) dx -= 1;
        if (this.keysDown.has('arrowright') || this.keysDown.has('d')) dx += 1;
        if (this.keysDown.has('arrowup') || this.keysDown.has('w')) dy -= 1;
        if (this.keysDown.has('arrowdown') || this.keysDown.has('s')) dy += 1;
        if (dx === 0 && dy === 0) return;
        const v = CONFIG.panSpeed * dtSec * 60 * g.zoom;
        g.camera.x += dx * v;
        g.camera.y += dy * v;
        g.clampCamera();
    }

    // ---- tool application ------------------------------------------------------

    normalizeSel(sel) {
        return {
            x0: Math.min(sel.start.x, sel.end.x), x1: Math.max(sel.start.x, sel.end.x),
            y0: Math.min(sel.start.y, sel.end.y), y1: Math.max(sel.start.y, sel.end.y)
        };
    }

    applyOrder(tool, sel) {
        const g = this.game;
        const w = g.world;
        let count = 0;
        for (let y = sel.y0; y <= sel.y1; y++) {
            for (let x = sel.x0; x <= sel.x1; x++) {
                let ok = false;
                switch (tool.target) {
                    case 'tree': ok = w.trees.has(tileKey(x, y)); break;
                    case 'deposit': ok = w.deposits.has(tileKey(x, y)); break;
                    case 'rock': ok = w.tileAt(x, y) === w.TILES.ROCK; break;
                    case 'foodPlant': {
                        const bush = w.bushes.get(tileKey(x, y));
                        const crop = w.crops.get(tileKey(x, y));
                        ok = !!(bush || (crop && crop.mature));
                        break;
                    }
                }
                if (!ok) continue;
                if (tool.jobType === null) continue; // handled below
                if (g.jobs.hasJob(tool.jobType, x, y)) continue;
                if (g.jobs.unreachableUntil.has(tool.jobType + ':' + tileKey(x, y))) continue;
                g.jobs.post(tool.jobType, x, y, w.trees.get(tileKey(x, y)) ||
                    w.deposits.get(tileKey(x, y)) || w.bushes.get(tileKey(x, y)) ||
                    w.crops.get(tileKey(x, y)));
                count++;
            }
        }
        // harvest mixes two job types
        if (tool.target === 'foodPlant') {
            count = 0;
            for (let y = sel.y0; y <= sel.y1; y++) {
                for (let x = sel.x0; x <= sel.x1; x++) {
                    const bush = w.bushes.get(tileKey(x, y));
                    const crop = w.crops.get(tileKey(x, y));
                    if (bush && !g.jobs.hasJob('harvest_bush', x, y)) {
                        g.jobs.post('harvest_bush', x, y, bush); count++;
                    } else if (crop && crop.mature && !g.jobs.hasJob('harvest_crop', x, y)) {
                        g.jobs.post('harvest_crop', x, y, crop); count++;
                    }
                }
            }
        }
        if (count > 0) g.log(`${count} ${tool.noun} marked.`);
    }

    applyZone(tool, sel) {
        const type = tool === TOOLS.zone_stockpile ? 'stockpile' : 'growing';
        const w = sel.x1 - sel.x0 + 1, h = sel.y1 - sel.y0 + 1;
        this.game.zones.push(new Zone(type, sel.x0, sel.y0, w, h));
        this.game.log(`Placed ${type} zone (${w}×${h}).`);
        if (type === 'stockpile') {
            this.game.hintOnce('stockpiled',
                'Haulers will bring loose goods into the stockpile.');
        } else {
            this.game.hintOnce('growing',
                'Growers will plant and harvest crops here automatically.');
        }
    }

    canPlaceAt(x, y) {
        const w = this.game.world;
        if (!w.inBounds(x, y)) return false;
        const t = w.tileAt(x, y);
        if (t === w.TILES.WATER) return false;
        if (w.buildings.has(tileKey(x, y))) return false;
        if (w.trees.has(tileKey(x, y))) return false;
        if (w.deposits.has(tileKey(x, y))) return false;
        return true;
    }

    applyBuildArea(tool, sel) {
        let placed = 0;
        for (let y = sel.y0; y <= sel.y1; y++) {
            for (let x = sel.x0; x <= sel.x1; x++) {
                if (this.canPlaceAt(x, y)) {
                    this.game.world.addBuilding(new Building(tool.buildType, x, y));
                    placed++;
                }
            }
        }
        if (placed > 0) {
            this.game.log(`${placed} × ${CONFIG.builds[tool.buildType].name} blueprint(s) placed.`);
            this.game.hintOnce('blueprint',
                'Blueprints need materials delivered before builders finish them.');
        }
    }

    placeBuilding(buildType, x, y) {
        if (!this.canPlaceAt(x, y)) {
            this.game.log('Cannot build there.', 'warn');
            return;
        }
        this.game.world.addBuilding(new Building(buildType, x, y));
        this.game.log(`${CONFIG.builds[buildType].name} blueprint placed.`);
        this.game.hintOnce('blueprint',
            'Blueprints need materials delivered before builders finish them.');
        this.game.setTool('select');
    }

    clickSelect(e) {
        const g = this.game;
        const px = this.pxAtEvent(e);
        let best = null, bestD = Infinity;
        for (const p of g.pawns) {
            const sx = g.renderer.sx(p.x);
            const sy = g.renderer.sy(p.y);
            const d = dist(px.x, px.y, sx, sy);
            if (d < bestD) { bestD = d; best = p; }
        }
        g.selectedPawn = bestD < g.renderer.ts() * 0.9 ? best : null;
        if (g.selectedPawn) g.ui.refreshSoon = true;
    }

    /** Count preview while dragging. */
    updateDragPreview() {
        const g = this.game;
        const tool = TOOLS[g.tool];
        if (!tool || (tool.kind !== 'order')) { g.dragPreview = null; return; }
        const sel = this.normalizeSel(g.dragSelection);
        const w = g.world;
        let count = 0;
        for (let y = sel.y0; y <= sel.y1; y++) {
            for (let x = sel.x0; x <= sel.x1; x++) {
                switch (tool.target) {
                    case 'tree': if (w.trees.has(tileKey(x, y))) count++; break;
                    case 'deposit': if (w.deposits.has(tileKey(x, y))) count++; break;
                    case 'rock': if (w.tileAt(x, y) === w.TILES.ROCK) count++; break;
                    case 'foodPlant': {
                        if (w.bushes.has(tileKey(x, y))) count++;
                        else {
                            const c = w.crops.get(tileKey(x, y));
                            if (c && c.mature) count++;
                        }
                        break;
                    }
                }
            }
        }
        const px = this.pxOfSelCorner(sel);
        g.dragPreview = count > 0
            ? { label: `${count} ${tool.noun}`, px, py: this.rendererYOf(sel) }
            : null;
    }

    pxOfSelCorner(sel) {
        const r = this.game.renderer;
        return r.sx(sel.x0);
    }

    rendererYOf(sel) {
        const r = this.game.renderer;
        return r.sy(sel.y0);
    }

    // ---- UI buttons -------------------------------------------------------------

    setupButtons() {
        const bindTool = (id, toolKey) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', () => this.game.setTool(toolKey));
        };
        bindTool('tool-chop', 'chop');
        bindTool('tool-mine', 'mine');
        bindTool('tool-mine-rock', 'mine_rock');
        bindTool('tool-harvest', 'harvest');
        bindTool('tool-zone-stockpile', 'zone_stockpile');
        bindTool('tool-zone-growing', 'zone_growing');
        bindTool('tool-build-wall', 'build_wall');
        bindTool('tool-build-door', 'build_door');
        bindTool('tool-build-table', 'build_table');
        bindTool('tool-build-bed', 'build_bed');
        bindTool('tool-build-chair', 'build_chair');

        const bindAction = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', fn);
        };
        bindAction('tool-craft-meal', () => this.game.requestCraft('meal'));
        bindAction('tool-craft-tools', () => this.game.requestCraft('tools'));
        // Priorities button is bound by UIManager (owns the modal).

        // speed buttons
        const pauseBtn = document.getElementById('speed-pause');
        if (pauseBtn) pauseBtn.addEventListener('click', () => this.game.togglePause());
        for (const s of CONFIG.speeds) {
            const el = document.getElementById('speed-' + s);
            if (el) el.addEventListener('click', () => this.game.setSpeed(s));
        }
    }
}

if (typeof module !== 'undefined') module.exports = { TOOLS, InputManager };
