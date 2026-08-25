class HeightField {
    constructor(logicalW, logicalH, cell = 6) {
        this.cell = cell;
        this.cols = Math.ceil(logicalW / cell);
        this.rows = Math.ceil(logicalH / cell);
        this.data = new Float32Array(this.cols * this.rows);
    }

    smooth() {
        const src = this.data.slice();
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                let sum = 0;
                let n = 0;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        const rr = r + dr;
                        const cc = c + dc;
                        if (rr < 0 || cc < 0 || rr >= this.rows || cc >= this.cols) continue;
                        sum += src[rr * this.cols + cc];
                        n++;
                    }
                }
                this.data[r * this.cols + c] = sum / n;
            }
        }
    }

    add(c, r, v) {
        if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return;
        const i = r * this.cols + c;
        if (v > this.data[i]) this.data[i] = v;
    }

    buildFrom(track) {
        for (const f of track.features || []) {
            if (f.type === 'berm') this.rasterStrip(f);
            else if (f.type === 'wall') this.rasterWall(f);
            else if (f.type === 'roller') this.rasterRollerBand(f);
        }
        this.smooth();
    }

    rasterStrip(f) {
        const cs = this.cell;
        const P = f.pts;
        const n = P.length;
        if (n < 2) return;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of P) {
            minX = Math.min(minX, p.x - f.off1);
            maxX = Math.max(maxX, p.x + f.off1);
            minY = Math.min(minY, p.y - f.off1);
            maxY = Math.max(maxY, p.y + f.off1);
        }
        const c0 = Math.max(0, Math.floor(minX / cs));
        const c1 = Math.min(this.cols - 1, Math.ceil(maxX / cs));
        const r0 = Math.max(0, Math.floor(minY / cs));
        const r1 = Math.min(this.rows - 1, Math.ceil(maxY / cs));
        for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) {
                const wx = (c + 0.5) * cs;
                const wy = (r + 0.5) * cs;
                let bestD2 = Infinity;
                let bestI = -1;
                let bestT = 0;
                for (let i = 0; i < n - 1; i++) {
                    const ax = P[i].x;
                    const ay = P[i].y;
                    const bx = P[i + 1].x;
                    const by = P[i + 1].y;
                    const ex = bx - ax;
                    const ey = by - ay;
                    const l2 = ex * ex + ey * ey;
                    let t = l2 > 0 ? ((wx - ax) * ex + (wy - ay) * ey) / l2 : 0;
                    t = MathUtils.clamp(t, 0, 1);
                    const dx = wx - (ax + ex * t);
                    const dy = wy - (ay + ey * t);
                    const d2 = dx * dx + dy * dy;
                    if (d2 < bestD2) {
                        bestD2 = d2;
                        bestI = i;
                        bestT = t;
                    }
                }
                if (bestI < 0) continue;
                const nx = P[bestI].nx + (P[bestI + 1].nx - P[bestI].nx) * bestT;
                const ny = P[bestI].ny + (P[bestI + 1].ny - P[bestI].ny) * bestT;
                const dx = wx - P[bestI].x;
                const dy = wy - P[bestI].y;
                const d = dx * nx + dy * ny;
                if (d < f.off0 || d > f.off1) continue;
                const t = (d - f.off0) / (f.off1 - f.off0);
                const along = (bestI + bestT) / (n - 1);
                const e = MathUtils.clamp(Math.min(along, 1 - along) / 0.22, 0, 1);
                const taper = e * e * (3 - 2 * e);
                this.add(c, r, f.h * t * t * (3 - 2 * t) * taper);
            }
        }
    }

    rasterRollerBand(f) {
        const cs = this.cell;
        const midX = (f.x1 + f.x2) / 2;
        const midY = (f.y1 + f.y2) / 2;
        const pad = f.w + cs * 2;
        const c0 = Math.max(0, Math.floor((Math.min(f.x1, f.x2) - pad) / cs));
        const c1 = Math.min(this.cols - 1, Math.ceil((Math.max(f.x1, f.x2) + pad) / cs));
        const r0 = Math.max(0, Math.floor((Math.min(f.y1, f.y2) - pad) / cs));
        const r1 = Math.min(this.rows - 1, Math.ceil((Math.max(f.y1, f.y2) + pad) / cs));
        for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) {
                const wx = (c + 0.5) * cs;
                const wy = (r + 0.5) * cs;
                const rx = wx - midX;
                const ry = wy - midY;
                const su = rx * f.ux + ry * f.uy;
                const sn = rx * -f.uy + ry * f.ux;
                if (Math.abs(sn) > f.halfAcross) continue;
                const cl = MathUtils.clamp(Math.abs(su) / f.w, 0, 1);
                const v = 0.5 * (1 + Math.cos(Math.PI * cl));
                const edgeFade = MathUtils.clamp((f.halfAcross - Math.abs(sn)) / 6, 0, 1);
                this.add(c, r, f.h * v * edgeFade);
            }
        }
    }

    rasterWall(f) {
        const cs = this.cell;
        const dx = f.x2 - f.x1;
        const dy = f.y2 - f.y1;
        const len = Math.hypot(dx, dy);
        const ux = dx / len;
        const uy = dy / len;
        const px = -uy * f.side;
        const py = ux * f.side;
        const pad = f.w + cs * 2;
        const c0 = Math.max(0, Math.floor((Math.min(f.x1, f.x2) - pad) / cs));
        const c1 = Math.min(this.cols - 1, Math.ceil((Math.max(f.x1, f.x2) + pad) / cs));
        const r0 = Math.max(0, Math.floor((Math.min(f.y1, f.y2) - pad) / cs));
        const r1 = Math.min(this.rows - 1, Math.ceil((Math.max(f.y1, f.y2) + pad) / cs));
        for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) {
                const wx = (c + 0.5) * cs;
                const wy = (r + 0.5) * cs;
                const rx = wx - f.x1;
                const ry = wy - f.y1;
                const s = rx * ux + ry * uy;
                if (s < 0 || s > len) continue;
                const d = (rx * px + ry * py);
                if (d < 0 || d > f.w) continue;
                const t = d / f.w;
                this.add(c, r, f.h * t * t * (3 - 2 * t));
            }
        }
    }

    sample(x, y) {
        const cs = this.cell;
        const fx = x / cs - 0.5;
        const fy = y / cs - 0.5;
        const cx = Math.floor(fx);
        const cy = Math.floor(fy);
        const tx = fx - cx;
        const ty = fy - cy;
        const x0 = MathUtils.clamp(cx, 0, this.cols - 1);
        const x1 = MathUtils.clamp(cx + 1, 0, this.cols - 1);
        const y0 = MathUtils.clamp(cy, 0, this.rows - 1);
        const y1 = MathUtils.clamp(cy + 1, 0, this.rows - 1);
        const h00 = this.data[y0 * this.cols + x0];
        const h10 = this.data[y0 * this.cols + x1];
        const h01 = this.data[y1 * this.cols + x0];
        const h11 = this.data[y1 * this.cols + x1];
        return MathUtils.lerp(
            MathUtils.lerp(h00, h10, tx),
            MathUtils.lerp(h01, h11, tx),
            ty
        );
    }
}
