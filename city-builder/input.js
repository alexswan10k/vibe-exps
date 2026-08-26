// Input: Tool-based user interaction.
// - Pan & Zoom
// - Drag-line road building
// - Drag-rectangle zoning & dezoning
// - Point-and-click infrastructure & civic placement
// - Bulldoze demolition
// - Mobile touch controls with active event listeners

// TOOLS is defined in building-types.js

class InputManager {
    constructor(game) {
        this.game = game;
        this.canvas = document.getElementById('pixi-canvas');

        this.tool = TOOLS.SELECT;
        this.hoverTile = null;

        this.mouse = { x: 0, y: 0, down: false, button: 0 };
        this.dragMode = null;      // null | 'pan' | 'paint' | 'rect' | 'road_line'
        this.dragStart = null;
        this.dragRect = null;
        this.roadLine = null;
        this.lastPaintTile = null;

        this._bindEvents();
    }

    setTool(tool) {
        this.tool = tool;
        this.dragRect = null;
        this.roadLine = null;
        if (this.game.ui) this.game.ui.refreshToolbar();
    }

    isPaintingZones() {
        return this.dragMode === 'rect';
    }

    isDraggingRoad() {
        return this.dragMode === 'road_line';
    }

    // --- Coordinate helpers ---
    updatePosition(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        let x = clientX - rect.left;
        let y = clientY - rect.top;

        const renderer = this.game.renderer;
        if (renderer && renderer.app && rect.width > 0 && rect.height > 0) {
            this._scaleX = renderer.app.renderer.width / rect.width;
            this._scaleY = renderer.app.renderer.height / rect.height;
            x *= this._scaleX;
            y *= this._scaleY;
        }
        this.mouse.x = x;
        this.mouse.y = y;

        if (!renderer || !renderer.app) return;
        const world = renderer.screenToWorld(x, y);
        const gx = Math.floor(world.x / CONFIG.CELL);
        const gy = Math.floor(world.y / CONFIG.CELL);
        this.hoverTile = { x: gx, y: gy, worldX: world.x, worldY: world.y };
    }

    _bindEvents() {
        this._onDown = (e) => this.onMouseDown(e);
        this._onMove = (e) => this.onMouseMove(e);
        this._onUp = (e) => this.onMouseUp(e);
        this._onWheel = (e) => this.onWheel(e);
        this._onContext = (e) => e.preventDefault();
        this._onKey = (e) => this.onKeyDown(e);

        this.canvas.addEventListener('mousedown', this._onDown);
        window.addEventListener('mousemove', this._onMove);
        window.addEventListener('mouseup', this._onUp);
        this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
        this.canvas.addEventListener('contextmenu', this._onContext);
        document.addEventListener('keydown', this._onKey);

        // Touch event handlers with active listeners
        this._pinch = null;
        this._onTouchStart = (e) => this.onTouchStart(e);
        this._onTouchMove = (e) => this.onTouchMove(e);
        this._onTouchEnd = (e) => this.onTouchEnd(e);
        this.canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
        this.canvas.addEventListener('touchend', this._onTouchEnd);
    }

    onMouseDown(e) {
        this.updatePosition(e.clientX, e.clientY);
        this.mouse.down = true;
        this.mouse.button = e.button;
        this._downClient = { x: e.clientX, y: e.clientY };

        if (e.button === 2 || e.button === 1) {
            this.startPan();
            return;
        }

        const tile = this.hoverTile;
        if (!tile) return;

        switch (this.tool) {
            case TOOLS.SELECT:
                this.startPan();
                break;
            case TOOLS.ROAD:
                this.dragMode = 'road_line';
                this.dragStart = { x: tile.x, y: tile.y };
                this.roadLine = { tiles: [{ x: tile.x, y: tile.y }] };
                break;
            case TOOLS.BULLDOZE:
                this.dragMode = 'paint';
                this.lastPaintTile = null;
                this.paintAt(tile);
                break;
            case TOOLS.ZONE_R:
            case TOOLS.ZONE_C:
            case TOOLS.ZONE_I:
            case TOOLS.DEZONE:
                this.dragMode = 'rect';
                this.dragStart = { x: tile.x, y: tile.y };
                this.dragRect = { x: tile.x, y: tile.y, w: 1, h: 1 };
                break;
            default:
                // Infrastructure and civic buildings
                this.game.placeInfrastructure(this.tool, tile.x, tile.y);
                break;
        }
    }

    onMouseMove(e) {
        this.updatePosition(e.clientX, e.clientY);
        if (!this.mouse.down) return;

        if (this.dragMode === 'pan') {
            const dx = (e.movementX || 0) * (this._scaleX || 1);
            const dy = (e.movementY || 0) * (this._scaleY || 1);
            this.game.renderer.moveCamera(dx, dy);
            return;
        }

        const tile = this.hoverTile;
        if (!tile) return;

        if (this.dragMode === 'paint') {
            if (!this.lastPaintTile || this.lastPaintTile.x !== tile.x || this.lastPaintTile.y !== tile.y) {
                this.paintAt(tile);
            }
        } else if (this.dragMode === 'rect') {
            const x = Math.min(this.dragStart.x, tile.x);
            const y = Math.min(this.dragStart.y, tile.y);
            const w = Math.abs(tile.x - this.dragStart.x) + 1;
            const h = Math.abs(tile.y - this.dragStart.y) + 1;
            this.dragRect = { x, y, w, h };
        } else if (this.dragMode === 'road_line') {
            // Straight orthogonal line between dragStart and current tile
            const dx = tile.x - this.dragStart.x;
            const dy = tile.y - this.dragStart.y;
            const tiles = [];

            if (Math.abs(dx) >= Math.abs(dy)) {
                // Horizontal line
                const step = dx >= 0 ? 1 : -1;
                for (let x = this.dragStart.x; x !== tile.x + step; x += step) {
                    tiles.push({ x, y: this.dragStart.y });
                }
            } else {
                // Vertical line
                const step = dy >= 0 ? 1 : -1;
                for (let y = this.dragStart.y; y !== tile.y + step; y += step) {
                    tiles.push({ x: this.dragStart.x, y });
                }
            }
            this.roadLine = { tiles };
        }
    }

    onMouseUp(e) {
        if (!this.mouse.down) return;
        this.updatePosition(e.clientX, e.clientY);

        if (this.dragMode === 'rect' && this.dragRect) {
            const zoneKey = this.tool === TOOLS.DEZONE ? null : this.tool.replace('zone_', '');
            this.game.applyZoneRect(this.dragRect.x, this.dragRect.y, this.dragRect.w, this.dragRect.h, zoneKey);
        } else if (this.dragMode === 'road_line' && this.roadLine) {
            this.game.applyRoadLine(this.roadLine.tiles);
        } else if (this.tool === TOOLS.SELECT && this.dragMode === 'pan' && this.wasClick(e)) {
            if (e.button === 2) {
                this.game.clearSelection();
            } else {
                this.handleClickSelect();
            }
        }

        this.mouse.down = false;
        this.dragMode = null;
        this.dragRect = null;
        this.roadLine = null;
        this.dragStart = null;
    }

    wasClick(e) {
        if (!this._downClient) return true;
        const dist = Math.hypot(e.clientX - this._downClient.x, e.clientY - this._downClient.y);
        return dist < 5;
    }

    handleClickSelect() {
        const tile = this.hoverTile;
        if (!tile) return;
        const b = this.game.city.buildingAt(tile.x, tile.y);
        if (b) {
            this.game.selectBuilding(b);
            if (this.game.audio) this.game.audio.playClick();
        } else {
            this.game.clearSelection();
        }
    }

    startPan() {
        this.dragMode = 'pan';
    }

    paintAt(tile) {
        this.lastPaintTile = { x: tile.x, y: tile.y };
        if (this.tool === TOOLS.BULLDOZE) this.game.bulldozeAt(tile.x, tile.y);
    }

    onWheel(e) {
        e.preventDefault();
        const renderer = this.game.renderer;
        if (!renderer || !renderer.app) return;
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const factor = e.deltaY > 0 ? 0.88 : 1.14;
        renderer.setZoom(renderer.camera.zoom * factor, sx * (renderer.app.renderer.width / rect.width), sy * (renderer.app.renderer.height / rect.height));
    }

    // --- Keyboard ---
    onKeyDown(e) {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        const game = this.game;

        switch (e.key) {
            case 'Escape':
                game.setTool(TOOLS.SELECT);
                game.clearSelection();
                break;
            case 'q': case 'Q': game.setTool(TOOLS.SELECT); break;
            case 'x': case 'X': case 'Delete': game.setTool(TOOLS.BULLDOZE); break;
            case 'r': case 'R': game.setTool(TOOLS.ROAD); break;
            case '1': game.setTool(TOOLS.ZONE_R); break;
            case '2': game.setTool(TOOLS.ZONE_C); break;
            case '3': game.setTool(TOOLS.ZONE_I); break;
            case '4': game.setTool(TOOLS.DEZONE); break;
            case '5': game.setTool(TOOLS.PARK); break;
            case '6': game.setTool(TOOLS.POWER); break;
            case '7': game.setTool(TOOLS.WATER); break;
            case 'o': case 'O': game.cycleOverlay(); break;
            case 't': case 'T': game.cycleTimeOfDay(); break;
            case ' ': e.preventDefault(); game.togglePause(); break;
            case '+': case '=': game.stepSpeed(1); break;
            case '-': game.stepSpeed(-1); break;
        }
    }

    // --- Touch handling ---
    onTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            const t = e.touches[0];
            this.updatePosition(t.clientX, t.clientY);
            this.mouse.down = true;
            const fake = { button: 0, movementX: 0, movementY: 0 };
            if (this.tool === TOOLS.SELECT) this.startPan();
            else this.onMouseDown({ ...fake, clientX: t.clientX, clientY: t.clientY });
        } else if (e.touches.length === 2) {
            this.dragMode = null;
            this.mouse.down = false;
            this._pinch = this.pinchState(e);
        }
    }

    onTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1 && this.mouse.down && !this._pinch) {
            const t = e.touches[0];
            const prev = this.hoverTile ? { worldX: this.hoverTile.worldX, worldY: this.hoverTile.worldY } : null;
            this.updatePosition(t.clientX, t.clientY);
            if (this.dragMode === 'pan' && prev && prev.worldX !== undefined) {
                this.game.renderer.moveCamera(
                    -(this.hoverTile.worldX - prev.worldX),
                    -(this.hoverTile.worldY - prev.worldY)
                );
            } else if (this.dragMode !== 'pan') {
                this.onMouseMove({ clientX: t.clientX, clientY: t.clientY, movementX: 0, movementY: 0 });
            }
        } else if (e.touches.length === 2 && this._pinch) {
            const next = this.pinchState(e);
            const renderer = this.game.renderer;
            const rect = this.canvas.getBoundingClientRect();
            const scaleFix = renderer.app ? renderer.app.renderer.width / rect.width : 1;
            renderer.setZoom(
                this._pinch.zoom * (next.dist / this._pinch.dist),
                next.cx * scaleFix,
                next.cy * scaleFix
            );
            this._pinch.zoom = renderer.camera.zoom;
            this._pinch.dist = next.dist;
        }
    }

    onTouchEnd(e) {
        if (e.touches.length < 2) this._pinch = null;
        if (e.touches.length === 0) {
            this.mouse.down = false;
            this.dragMode = null;
            this.dragRect = null;
            this.roadLine = null;
        }
    }

    pinchState(e) {
        const [a, b] = [e.touches[0], e.touches[1]];
        const rect = this.canvas.getBoundingClientRect();
        return {
            dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
            cx: ((a.clientX + b.clientX) / 2 - rect.left),
            cy: ((a.clientY + b.clientY) / 2 - rect.top),
            zoom: this.game.renderer ? this.game.renderer.camera.zoom : 1
        };
    }

    destroy() {
        this.canvas.removeEventListener('mousedown', this._onDown);
        window.removeEventListener('mousemove', this._onMove);
        window.removeEventListener('mouseup', this._onUp);
        this.canvas.removeEventListener('wheel', this._onWheel);
        this.canvas.removeEventListener('contextmenu', this._onContext);
        document.removeEventListener('keydown', this._onKey);
        this.canvas.removeEventListener('touchstart', this._onTouchStart);
        this.canvas.removeEventListener('touchmove', this._onTouchMove);
        this.canvas.removeEventListener('touchend', this._onTouchEnd);
    }
}

window.InputManager = InputManager;
window.TOOLS = TOOLS;
