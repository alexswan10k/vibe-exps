/**
 * Renderer: draws the world via a cached ground layer plus depth-sorted
 * entities, pawns, zone overlays, blueprints, selection and the night tint.
 */
class Renderer {
    constructor(game) {
        this.game = game;
        this.canvas = game.canvas;
        this.ctx = game.ctx;
        this.time = 0; // seconds, for animations
    }

    ts() { return CONFIG.tileSize * this.game.zoom; }

    sx(x) { return x * this.ts() - this.game.camera.x; }
    sy(y) { return y * this.ts() - this.game.camera.y; }

    screenToTile(px, py) {
        return {
            x: Math.floor((px + this.game.camera.x) / this.ts()),
            y: Math.floor((py + this.game.camera.y) / this.ts())
        };
    }

    render(dtSec) {
        this.time += dtSec;
        const ctx = this.ctx;
        ctx.imageSmoothingEnabled = true;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawGround();
        this.drawZones();
        this.drawBlueprints();
        this.drawEntities();
        this.drawPawns();
        this.drawJobMarkers();
        this.drawSelection();
        this.drawHover();
        this.drawNightTint();
        this.drawDragPreview();
    }

    // ---- layers -----------------------------------------------------------

    drawGround() {
        const world = this.game.world;
        const c = world.getGroundCanvas(CONFIG.tileSize);
        if (!c) return;
        const zoom = this.game.zoom;
        // Visible source window in ground-canvas pixels
        let sx0 = Math.max(0, this.game.camera.x / zoom);
        let sy0 = Math.max(0, this.game.camera.y / zoom);
        let ex = Math.min(c.width, (this.game.camera.x + this.canvas.width) / zoom);
        let ey = Math.min(c.height, (this.game.camera.y + this.canvas.height) / zoom);
        if (ex <= sx0 || ey <= sy0) return;
        this.ctx.drawImage(c,
            sx0, sy0, ex - sx0, ey - sy0,
            sx0 * zoom - this.game.camera.x, sy0 * zoom - this.game.camera.y,
            (ex - sx0) * zoom, (ey - sy0) * zoom);
    }

    drawZones() {
        const ctx = this.ctx;
        for (const z of this.game.zones) {
            const x = this.sx(z.x), y = this.sy(z.y);
            const w = z.w * this.ts(), h = z.h * this.ts();
            if (z.type === 'stockpile') {
                ctx.fillStyle = 'rgba(244, 208, 63, 0.13)';
                ctx.strokeStyle = 'rgba(244, 208, 63, 0.75)';
            } else {
                ctx.fillStyle = 'rgba(46, 204, 113, 0.13)';
                ctx.strokeStyle = 'rgba(46, 204, 113, 0.75)';
            }
            ctx.lineWidth = 1.5;
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        }
    }

    drawBlueprints() {
        const ctx = this.ctx;
        const pulse = 0.55 + Math.sin(this.time * 4) * 0.15;
        for (const b of this.game.world.buildingList) {
            if (!b.blueprint) continue;
            const x = this.sx(b.x), y = this.sy(b.y), ts = this.ts();
            ctx.globalAlpha = pulse;
            ctx.fillStyle = '#9fb7c6';
            ctx.fillRect(x + ts * 0.12, y + ts * 0.12, ts * 0.76, ts * 0.76);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = '#ecf0f1';
            ctx.setLineDash([4, 3]);
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + ts * 0.12, y + ts * 0.12, ts * 0.76, ts * 0.76);
            ctx.setLineDash([]);
            // missing material icons
            const missing = b.missingMaterials();
            const mats = Object.entries(missing);
            if (mats.length > 0 && ts > 18) {
                ctx.font = `${Math.max(8, ts * 0.3)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillStyle = '#fff';
                let label = mats.map(([m, q]) => `${q}${m[0].toUpperCase()}`).join(' ');
                ctx.fillText(label, x + ts / 2, y - 3);
            }
        }
    }

    drawEntities() {
        const g = this.game;
        const drawables = [];
        const view = this.visibleTileBounds();
        for (const t of g.world.treeList)
            if (t.x >= view.x0 && t.x <= view.x1 && t.y >= view.y0 && t.y <= view.y1) drawables.push({ kind: 'tree', e: t });
        for (const d of g.world.depositList) drawables.push({ kind: 'deposit', e: d });
        for (const b of g.world.bushList) drawables.push({ kind: 'bush', e: b });
        for (const c of g.world.cropList) drawables.push({ kind: 'crop', e: c });
        for (const s of g.world.stackList) drawables.push({ kind: 'stack', e: s });
        for (const b of g.world.buildingList) if (!b.blueprint) drawables.push({ kind: 'building', e: b });
        drawables.sort((a, b) => a.e.y - b.e.y);
        for (const d of drawables) {
            switch (d.kind) {
                case 'tree': this.drawTree(d.e); break;
                case 'deposit': this.drawDeposit(d.e); break;
                case 'bush': this.drawBush(d.e); break;
                case 'crop': this.drawCrop(d.e); break;
                case 'stack': this.drawStack(d.e); break;
                case 'building': this.drawBuilding(d.e); break;
            }
        }
    }

    visibleTileBounds() {
        const ts = this.ts();
        return {
            x0: Math.max(0, Math.floor(this.game.camera.x / ts) - 2),
            x1: Math.min(this.game.world.width - 1, Math.ceil((this.game.camera.x + this.canvas.width) / ts) + 2),
            y0: Math.max(0, Math.floor(this.game.camera.y / ts) - 3),
            y1: Math.min(this.game.world.height - 1, Math.ceil((this.game.camera.y + this.canvas.height) / ts) + 3)
        };
    }

    // ---- entity sprites -----------------------------------------------------

    drawTree(t) {
        const ctx = this.ctx;
        const ts = this.ts();
        const cx = this.sx(t.x) + ts / 2;
        const baseY = this.sy(t.y) + ts * 0.82;
        const scale = ts / CONFIG.tileSize;
        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(cx, baseY + 2 * scale, 11 * scale, 4 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        // trunk
        ctx.fillStyle = '#6e4a2c';
        ctx.fillRect(cx - 2.5 * scale, baseY - 12 * scale, 5 * scale, 12 * scale);
        // canopy: layered circles
        const greens = ['#3f7d3a', '#48893f', '#529a47'];
        const c1 = greens[t.variant % greens.length];
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.arc(cx, baseY - 20 * scale, 11 * scale, 0, Math.PI * 2);
        ctx.arc(cx - 7 * scale, baseY - 14 * scale, 8 * scale, 0, Math.PI * 2);
        ctx.arc(cx + 7 * scale, baseY - 14 * scale, 8 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.beginPath();
        ctx.arc(cx - 3 * scale, baseY - 23 * scale, 4.5 * scale, 0, Math.PI * 2);
        ctx.fill();
    }

    drawDeposit(d) {
        const ctx = this.ctx;
        const ts = this.ts();
        const cx = this.sx(d.x) + ts / 2, cy = this.sy(d.y) + ts / 2;
        ctx.fillStyle = '#5d6266';
        ctx.beginPath();
        ctx.moveTo(cx - ts * 0.32, cy + ts * 0.28);
        ctx.lineTo(cx - ts * 0.18, cy - ts * 0.22);
        ctx.lineTo(cx + ts * 0.08, cy - ts * 0.32);
        ctx.lineTo(cx + ts * 0.32, cy + ts * 0.05);
        ctx.lineTo(cx + ts * 0.22, cy + ts * 0.30);
        ctx.closePath();
        ctx.fill();
        // rust sparkles
        ctx.fillStyle = '#c8763f';
        ctx.beginPath();
        ctx.arc(cx - ts * 0.06, cy + ts * 0.02, ts * 0.05, 0, Math.PI * 2);
        ctx.arc(cx + ts * 0.12, cy - ts * 0.10, ts * 0.04, 0, Math.PI * 2);
        ctx.fill();
    }

    drawBush(b) {
        const ctx = this.ctx;
        const ts = this.ts();
        const cx = this.sx(b.x) + ts / 2, cy = this.sy(b.y) + ts * 0.62;
        const s = ts / CONFIG.tileSize;
        ctx.fillStyle = '#2f6b33';
        ctx.beginPath();
        ctx.arc(cx - 5 * s, cy, 6 * s, 0, Math.PI * 2);
        ctx.arc(cx + 5 * s, cy, 6 * s, 0, Math.PI * 2);
        ctx.arc(cx, cy - 4 * s, 6.5 * s, 0, Math.PI * 2);
        ctx.fill();
        // berries
        ctx.fillStyle = '#d1335e';
        ctx.beginPath();
        ctx.arc(cx - 4 * s, cy - 2 * s, 1.6 * s, 0, Math.PI * 2);
        ctx.arc(cx + 3 * s, cy + 2 * s, 1.6 * s, 0, Math.PI * 2);
        ctx.arc(cx + 6 * s, cy - 3 * s, 1.4 * s, 0, Math.PI * 2);
        ctx.fill();
    }

    drawCrop(c) {
        const ctx = this.ctx;
        const ts = this.ts();
        const cx = this.sx(c.x) + ts / 2;
        const baseY = this.sy(c.y) + ts * 0.85;
        const s = ts / CONFIG.tileSize;
        const g = clamp(c.growth, 0, 100) / 100;
        const height = (4 + g * 16) * s;
        const color = c.mature ? '#d9b036' : lerpColor('#69a84f', '#a9c83a', g);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, 2 * s);
        for (const off of [-6, 0, 6]) {
            ctx.beginPath();
            ctx.moveTo(cx + off * s, baseY);
            ctx.quadraticCurveTo(cx + off * s + 2 * s, baseY - height * 0.6, cx + off * s, baseY - height);
            ctx.stroke();
        }
        if (c.mature) {
            ctx.fillStyle = '#e8c95a';
            for (const off of [-6, 0, 6]) {
                ctx.beginPath();
                ctx.ellipse(cx + off * s, baseY - height - 2 * s, 2.2 * s, 3.2 * s, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    drawStack(s) {
        const ctx = this.ctx;
        const ts = this.ts();
        const info = CONFIG.items[s.type] || { color: '#ccc' };
        const cx = this.sx(s.x) + ts / 2, cy = this.sy(s.y) + ts * 0.68;
        const s2 = ts / CONFIG.tileSize;
        ctx.fillStyle = info.color;
        ctx.beginPath();
        ctx.roundRect(cx - 7 * s2, cy - 5 * s2, 14 * s2, 9 * s2, 2.5 * s2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
        if (s.qty > 1 && ts >= 20) {
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${Math.max(8, ts * 0.26)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(String(s.qty), cx, cy - 6 * s2);
        }
    }

    drawBuilding(b) {
        const ctx = this.ctx;
        const ts = this.ts();
        const x = this.sx(b.x), y = this.sy(b.y);
        switch (b.type) {
            case 'wall':
                ctx.fillStyle = '#7d8a97';
                ctx.fillRect(x, y, ts, ts);
                ctx.fillStyle = 'rgba(255,255,255,0.16)';
                ctx.fillRect(x, y, ts, ts * 0.22);
                ctx.strokeStyle = 'rgba(0,0,0,0.35)';
                ctx.strokeRect(x + 0.5, y + 0.5, ts - 1, ts - 1);
                break;
            case 'door': {
                ctx.fillStyle = '#7a4f27';
                ctx.fillRect(x + ts * 0.12, y + ts * 0.05, ts * 0.76, ts * 0.9);
                ctx.fillStyle = '#caa15c';
                ctx.beginPath();
                ctx.arc(x + ts * 0.72, y + ts * 0.52, ts * 0.06, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'table': {
                ctx.fillStyle = '#8a5a33';
                ctx.fillRect(x + ts * 0.08, y + ts * 0.22, ts * 0.84, ts * 0.5);
                ctx.fillStyle = '#6e4526';
                ctx.fillRect(x + ts * 0.14, y + ts * 0.72, ts * 0.1, ts * 0.18);
                ctx.fillRect(x + ts * 0.76, y + ts * 0.72, ts * 0.1, ts * 0.18);
                ctx.fillStyle = '#a97744';
                ctx.fillRect(x + ts * 0.08, y + ts * 0.22, ts * 0.84, ts * 0.09);
                break;
            }
            case 'bed': {
                ctx.fillStyle = '#5d4037';
                ctx.fillRect(x + ts * 0.1, y + ts * 0.1, ts * 0.8, ts * 0.8);
                ctx.fillStyle = '#4f74c4';
                ctx.fillRect(x + ts * 0.16, y + ts * 0.3, ts * 0.68, ts * 0.55);
                ctx.fillStyle = '#ecf0f1';
                ctx.fillRect(x + ts * 0.16, y + ts * 0.16, ts * 0.68, ts * 0.2);
                break;
            }
            case 'chair': {
                ctx.fillStyle = '#8a5a33';
                ctx.fillRect(x + ts * 0.25, y + ts * 0.3, ts * 0.5, ts * 0.35);
                ctx.fillRect(x + ts * 0.25, y + ts * 0.12, ts * 0.5, ts * 0.14);
                break;
            }
        }
    }

    // ---- pawns ------------------------------------------------------------------

    drawPawns() {
        const ctx = this.ctx;
        const sorted = [...this.game.pawns].sort((a, b) => a.y - b.y);
        for (const p of sorted) this.drawPawn(p);
    }

    drawPawn(p) {
        const ctx = this.ctx;
        const ts = this.ts();
        const s = ts / CONFIG.tileSize;
        // Pawn x/y are already tile-centred floats
        const cx = this.sx(p.x);
        const cy = this.sy(p.y);

        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath();
        ctx.ellipse(cx, cy + ts * 0.36, 8 * s, 3.2 * s, 0, 0, Math.PI * 2);
        ctx.fill();

        const bob = p.state === 'moving' ? Math.sin(this.time * 14 + p.x) * 1.2 * s : 0;

        // body
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.roundRect(cx - ts * 0.22, cy - ts * 0.16 + bob, ts * 0.44, ts * 0.42, 5 * s);
        ctx.fill();

        // head
        ctx.fillStyle = '#f5cba7';
        ctx.beginPath();
        ctx.arc(cx, cy - ts * 0.22 + bob, ts * 0.17, 0, Math.PI * 2);
        ctx.fill();

        // eyes face travel direction
        ctx.fillStyle = '#2c3e50';
        const ex = cx + p.facing * ts * 0.06;
        ctx.beginPath();
        ctx.arc(ex - ts * 0.045, cy - ts * 0.24 + bob, ts * 0.023, 0, Math.PI * 2);
        ctx.arc(ex + ts * 0.045, cy - ts * 0.24 + bob, ts * 0.023, 0, Math.PI * 2);
        ctx.fill();

        // carried item
        if (p.carry) {
            ctx.fillStyle = (CONFIG.items[p.carry.type] || {}).color || '#ccc';
            ctx.beginPath();
            ctx.roundRect(cx - ts * 0.14, cy - ts * 0.48 + bob, ts * 0.28, ts * 0.18, 3 * s);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            ctx.stroke();
        }

        // sleeping indicator
        if (p.state === 'sleeping') {
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.font = `${Math.max(9, ts * 0.3)}px sans-serif`;
            ctx.textAlign = 'center';
            const float = Math.sin(this.time * 2.5) * 2 * s;
            ctx.fillText('z', cx + ts * 0.28, cy - ts * 0.3 + float);
        }

        // work progress bar
        if (p.state === 'working' && p.workTotal > 0) {
            const frac = clamp(1 - p.workLeft / p.workTotal, 0, 1);
            const bw = ts * 0.6, bh = Math.max(3, ts * 0.09);
            const bx = cx - ts * 0.3, by = cy - ts * 0.62;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(bx, by, bw, bh);
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(bx, by, bw * frac, bh);
        }
    }

    // ---- overlays -------------------------------------------------------------

    jobMarkerTargets() {
        // Tiles with queued/claimed jobs get a pulsing marker.
        const out = [];
        for (const job of this.game.jobs.jobs) {
            if (job.x < 0) continue;
            out.push(job);
        }
        return out;
    }

    drawJobMarkers() {
        const ctx = this.ctx;
        const pulse = 0.5 + Math.sin(this.time * 5) * 0.3;
        ctx.lineWidth = 1.5;
        for (const job of this.jobMarkerTargets()) {
            const ts = this.ts();
            const x = this.sx(job.x), y = this.sy(job.y);
            if (x < -ts || y < -ts || x > this.canvas.width || y > this.canvas.height) continue;
            ctx.strokeStyle = `rgba(241, 196, 15, ${pulse})`;
            ctx.strokeRect(x + ts * 0.14, y + ts * 0.14, ts * 0.72, ts * 0.72);
        }
    }

    drawSelection() {
        const sel = this.game.dragSelection;
        if (!sel) return;
        const ctx = this.ctx;
        const x0 = Math.min(sel.start.x, sel.end.x), x1 = Math.max(sel.start.x, sel.end.x);
        const y0 = Math.min(sel.start.y, sel.end.y), y1 = Math.max(sel.start.y, sel.end.y);
        const px = this.sx(x0), py = this.sy(y0);
        const w = (x1 - x0 + 1) * this.ts(), h = (y1 - y0 + 1) * this.ts();
        ctx.fillStyle = PALETTE.selectionFill;
        ctx.strokeStyle = PALETTE.selectionStroke;
        ctx.lineWidth = 2;
        ctx.fillRect(px, py, w, h);
        ctx.strokeRect(px, py, w, h);
    }

    drawHover() {
        const hover = this.game.hoveredTile;
        if (!hover || this.game.dragSelection) return;
        if (!this.game.world.inBounds(hover.x, hover.y)) return;
        const ctx = this.ctx;
        ctx.strokeStyle = PALETTE.hoverStroke;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(this.sx(hover.x) + 0.5, this.sy(hover.y) + 0.5, this.ts() - 1, this.ts() - 1);
    }

    drawNightTint() {
        const light = this.game.lightLevel();
        const darkness = (1 - light) * 0.62;
        if (darkness <= 0.01) return;
        const ctx = this.ctx;
        ctx.fillStyle = PALETTE.nightTint + darkness.toFixed(3) + ')';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // soft glow around each pawn at night
        if (darkness > 0.2) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (const p of this.game.pawns) {
                const r = this.ts() * 1.6;
                const gx = this.sx(p.x), gy = this.sy(p.y);
                const grad = ctx.createRadialGradient(gx, gy, r * 0.15, gx, gy, r);
                grad.addColorStop(0, `rgba(255,190,110,${0.16 * darkness})`);
                grad.addColorStop(1, 'rgba(255,190,110,0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(gx, gy, r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    /** Live count label while dragging an order selection. */
    drawDragPreview() {
        const preview = this.game.dragPreview;
        if (!preview) return;
        const ctx = this.ctx;
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'left';
        const text = preview.label;
        const px = preview.px + 10, py = preview.py - 10;
        const wText = ctx.measureText(text).width;
        ctx.fillStyle = 'rgba(20, 26, 38, 0.85)';
        ctx.beginPath();
        ctx.roundRect(px, py - 16, wText + 14, 24, 5);
        ctx.fill();
        ctx.fillStyle = '#ffd75e';
        ctx.fillText(text, px + 7, py);
    }

    resize() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
    }
}

/** Blend two hex colours. */
function lerpColor(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
    const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
    const bl = Math.round(lerp(pa & 255, pb & 255, t));
    return `rgb(${r},${g},${bl})`;
}

if (typeof module !== 'undefined') module.exports = { Renderer, lerpColor };
