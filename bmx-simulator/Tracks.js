function samplePath(cmds) {
    const pts = [{ x: cmds[0].x, y: cmds[0].y }];
    let cx = cmds[0].x;
    let cy = cmds[0].y;
    const push = (x, y) => {
        pts.push({ x, y });
        cx = x;
        cy = y;
    };
    const STEP = 12;
    for (let i = 1; i < cmds.length; i++) {
        const c = cmds[i];
        if (c.type === "line") {
            const d = Math.hypot(c.x - cx, c.y - cy);
            const n = Math.max(1, Math.ceil(d / STEP));
            for (let k = 1; k <= n; k++)
                push(cx + ((c.x - cx) * k) / n, cy + ((c.y - cy) * k) / n);
        } else if (c.type === "quadratic") {
            const d = Math.hypot(c.x - cx, c.y - cy);
            const n = Math.max(8, Math.ceil(d / STEP));
            for (let t = 1; t <= n; t++) {
                const u = t / n;
                const a = 1 - u;
                push(
                    a * a * cx + 2 * a * u * c.cpx + u * u * c.x,
                    a * a * cy + 2 * a * u * c.cpy + u * u * c.y,
                );
            }
        } else if (c.type === "bezier") {
            const d = Math.hypot(c.x - cx, c.y - cy);
            const n = Math.max(10, Math.ceil(d / STEP));
            for (let t = 1; t <= n; t++) {
                const u = t / n;
                const a = 1 - u;
                push(
                    a * a * a * cx +
                        3 * a * a * u * c.cp1x +
                        3 * a * u * u * c.cp2x +
                        u * u * u * c.x,
                    a * a * a * cy +
                        3 * a * a * u * c.cp1y +
                        3 * a * u * u * c.cp2y +
                        u * u * u * c.y,
                );
            }
        }
    }
    return pts;
}

function detectCorners(pts) {
    const w = 4;
    const n = pts.length;
    const turns = new Array(n).fill(0);
    for (let i = w; i < n - w; i++) {
        const a1 = Math.atan2(pts[i].y - pts[i - w].y, pts[i].x - pts[i - w].x);
        const a2 = Math.atan2(pts[i + w].y - pts[i].y, pts[i + w].x - pts[i].x);
        turns[i] = MathUtils.normalizeAngle(a2 - a1);
    }
    const regions = [];
    let start = -1;
    let acc = 0;
    let apex = -1;
    let apexVal = 0;
    for (let i = 1; i < n; i++) {
        if (Math.abs(turns[i]) > 0.04) {
            if (start < 0) {
                start = i;
                acc = 0;
                apex = i;
                apexVal = 0;
            }
            acc += turns[i];
            if (Math.abs(turns[i]) > apexVal) {
                apexVal = Math.abs(turns[i]);
                apex = i;
            }
        } else if (start >= 0) {
            if (i - start >= 4)
                regions.push({ i0: start, i1: i - 1, acc, apex });
            start = -1;
        }
    }
    if (start >= 0 && n - start >= 4)
        regions.push({ i0: start, i1: n - 1, acc, apex });

    const merged = [];
    for (const r of regions) {
        const last = merged[merged.length - 1];
        if (
            last &&
            r.i0 - last.i1 <= 3 &&
            Math.sign(r.acc) === Math.sign(last.acc)
        ) {
            last.i1 = r.i1;
            last.acc += r.acc;
            if (Math.abs(turns[r.apex]) > Math.abs(turns[last.apex]))
                last.apex = r.apex;
        } else {
            merged.push({ ...r });
        }
    }
    if (merged.length >= 2) {
        const first = merged[0];
        const last = merged[merged.length - 1];
        if (
            first.i0 <= 4 &&
            last.i1 >= n - 5 &&
            Math.sign(first.acc) === Math.sign(last.acc)
        ) {
            last.i1 = first.i1;
            last.acc += first.acc;
            if (Math.abs(turns[first.apex]) > Math.abs(turns[last.apex]))
                last.apex = first.apex;
            merged.pop();
        }
    }
    return merged.filter((r) => {
        const cnt = ((r.i1 - r.i0 + n) % n) + 1;
        let len = 0;
        for (let k = 1; k < cnt; k++) {
            const a = pts[(r.i0 + k - 1) % n];
            const b = pts[(r.i0 + k) % n];
            len += MathUtils.distance(a.x, a.y, b.x, b.y);
        }
        return Math.abs(r.acc) >= 0.6 && len > 60;
    });
}

function bermFromRegion(pts, reg, roadHalf) {
    const n = pts.length;
    const count = ((reg.i1 - reg.i0 + n) % n) + 1;
    const i0 = reg.i0;

    const at = (k) => pts[(i0 + k) % n];
    // The bank belongs on the outside of the turn, and the region's signed turn
    // already says which side that is. Probing the deviation at the apex instead
    // puts the bank on the inside whenever the apex lands near the end of the
    // region, where the lookahead has already left the corner.
    const turn = Math.sign(reg.acc) || 1;

    const sub = [];
    for (let k = 0; k < count; k++) {
        const p = at(k);
        const a = at((k - 1 + count) % count);
        const b = at((k + 1) % count);
        let ex = b.x - a.x;
        let ey = b.y - a.y;
        const el = Math.max(Math.hypot(ex, ey), 0.001);
        ex /= el;
        ey /= el;
        // Perpendicular to travel, swung to the outside of the turn.
        const nx = ey * turn;
        const ny = -ex * turn;
        sub.push({ x: p.x, y: p.y, nx, ny });
    }

    let arcLen = 0;
    for (let k = 1; k < count; k++) {
        arcLen += MathUtils.distance(
            at(k - 1).x,
            at(k - 1).y,
            at(k).x,
            at(k).y,
        );
    }
    const R = Math.max(45, arcLen / Math.abs(reg.acc));
    // Banked, not painted: the face has to be steep enough for the camber in Bike
    // to steer with, and it has to run far enough inward that the bike finds it
    // before the front end wants to run wide.
    const h = MathUtils.clamp(3000 / R, 18, 32);

    return {
        type: "berm",
        pts: sub,
        off0: roadHalf * 0.15,
        off1: roadHalf - 2,
        h,
    };
}

// Straights measured on the sampled centerline, never on a path command's chord.
// A chord can cut across a curve by more than the road is wide, and a roller set
// square to that chord lands half off the tarmac.
function straightRuns(pts, minLen = 170) {
    const n = pts.length;
    const w = 3;
    const straight = new Array(n).fill(false);
    for (let i = w; i < n - w; i++) {
        const a = Math.atan2(pts[i].y - pts[i - w].y, pts[i].x - pts[i - w].x);
        const b = Math.atan2(pts[i + w].y - pts[i].y, pts[i + w].x - pts[i].x);
        straight[i] = Math.abs(MathUtils.normalizeAngle(b - a)) < 0.03;
    }
    const runs = [];
    let start = -1;
    for (let i = 0; i <= n; i++) {
        if (i < n && straight[i]) {
            if (start < 0) start = i;
            continue;
        }
        if (start >= 0) {
            let len = 0;
            for (let k = start + 1; k < i; k++) {
                len += MathUtils.distance(
                    pts[k - 1].x,
                    pts[k - 1].y,
                    pts[k].x,
                    pts[k].y,
                );
            }
            if (len >= minLen) {
                const a = pts[start];
                const b = pts[i - 1];
                const L = Math.max(MathUtils.distance(a.x, a.y, b.x, b.y), 1);
                runs.push({
                    ax: a.x,
                    ay: a.y,
                    bx: b.x,
                    by: b.y,
                    len,
                    ux: (b.x - a.x) / L,
                    uy: (b.y - a.y) / L,
                });
            }
            start = -1;
        }
    }
    return runs.sort((a, b) => b.len - a.len);
}

class Track {
    constructor(config) {
        this.name = config.name;
        this.laps = config.laps || 3;
        this.startLines = config.startLines;
        this.finishLine = config.finishLine;
        this.waypoints = config.waypoints;
        this.pathCommands = config.pathCommands;
        this.clutter = config.clutter || [];
        this.grassColor = config.grassColor || "#26282c";
        this.asphaltColor = config.asphaltColor || "#17181c";
        this.curbColor = config.curbColor || "#ff9800";
        this.lineWidth = config.lineWidth || 80;

        this.logicalWidth = config.logicalWidth || 1000;
        this.logicalHeight = config.logicalHeight || 1000;
        this.wpRadius = Math.max(70, this.lineWidth * 1.15);

        this.pathSamples = samplePath(this.pathCommands);
        this.features = this.generateFeatures(config);
        this.staticCanvas = null;
        this.heightField = null;
    }

    generateFeatures(config) {
        const feats = [];
        const roadHalf = this.lineWidth / 2;
        const regions = detectCorners(this.pathSamples);
        regions.sort((a, b) => Math.abs(b.acc) - Math.abs(a.acc));
        for (const reg of regions.slice(0, 6)) {
            feats.push(bermFromRegion(this.pathSamples, reg, roadHalf));
        }

        const finishMid = {
            x: (this.finishLine.p1.x + this.finishLine.p2.x) / 2,
            y: (this.finishLine.p1.y + this.finishLine.p2.y) / 2,
        };
        const terrain = config.terrain || {};
        const runs = straightRuns(this.pathSamples).filter((r) => {
            const mx = r.ax + r.ux * r.len * 0.5;
            const my = r.ay + r.uy * r.len * 0.5;
            if (Math.hypot(mx - finishMid.x, my - finishMid.y) < 140)
                return false;
            return (
                mx > roadHalf + 8 &&
                my > roadHalf + 8 &&
                mx < this.logicalWidth - roadHalf - 8 &&
                my < this.logicalHeight - roadHalf - 8
            );
        });

        let si = 0;
        for (
            let k = 0;
            k < (terrain.walls || 0) && si < runs.length;
            k++, si++
        ) {
            feats.push(this.wallFromRun(runs[si], roadHalf));
        }
        let rollers = 0;
        for (; rollers < (terrain.rollers || 0) && si < runs.length; si++) {
            feats.push(...this.rollersFromRun(runs[si], roadHalf));
            rollers++;
        }
        return feats;
    }

    centroid() {
        let cx = 0;
        let cy = 0;
        for (const p of this.pathSamples) {
            cx += p.x;
            cy += p.y;
        }
        return {
            x: cx / this.pathSamples.length,
            y: cy / this.pathSamples.length,
        };
    }

    // A wall is the road edge with a kickplate at its foot: the ramp rises across
    // the last stretch of tarmac, so squeezing out scrubs speed and turns you along
    // the barrier instead of dropping you off the curb.
    wallFromRun(r, roadHalf) {
        const c = this.centroid();
        let nx = -r.uy;
        let ny = r.ux;
        const mx = r.ax + r.ux * r.len * 0.5;
        const my = r.ay + r.uy * r.len * 0.5;
        if (nx * (mx - c.x) + ny * (my - c.y) < 0) {
            nx = -nx;
            ny = -ny;
        }
        const rampW = MathUtils.clamp(roadHalf * 0.5, 12, 22);
        const off = roadHalf - rampW; // foot of the ramp, on the tarmac
        const t0 = r.len * 0.1;
        const t1 = r.len * 0.9;
        return {
            type: "wall",
            x1: r.ax + r.ux * t0 + nx * off,
            y1: r.ay + r.uy * t0 + ny * off,
            x2: r.ax + r.ux * t1 + nx * off,
            y2: r.ay + r.uy * t1 + ny * off,
            w: rampW,
            h: MathUtils.clamp(roadHalf * 0.8, 18, 30),
            side: 1,
        };
    }

    // Whoops, not one lonely ridge: a run long enough earns a rhythm section of
    // rollers spaced down it, each square to the road because the run is straight.
    rollersFromRun(r, roadHalf) {
        const nx = -r.uy;
        const ny = r.ux;
        const w = MathUtils.clamp(roadHalf * 0.55, 16, 26);
        const h = MathUtils.clamp(roadHalf * 0.5, 14, 22);
        const halfAcross = roadHalf - 3;
        const span = r.len * 0.8;
        const t0 = r.len * 0.1;
        // ~200px apart: about 0.8s of rhythm at race speed, so a long straight
        // becomes a whoop section instead of one lonely ridge.
        const count = MathUtils.clamp(Math.round(span / 200), 1, 3);
        const out = [];
        for (let k = 0; k < count; k++) {
            const t =
                t0 + (count === 1 ? span * 0.5 : (span * k) / (count - 1));
            const mx = r.ax + r.ux * t;
            const my = r.ay + r.uy * t;
            out.push({
                type: "roller",
                x1: mx + nx * halfAcross,
                y1: my + ny * halfAcross,
                x2: mx - nx * halfAcross,
                y2: my - ny * halfAcross,
                ux: r.ux,
                uy: r.uy,
                w,
                h,
                halfAcross,
            });
        }
        return out;
    }

    strokeMainPath(ctx) {
        ctx.beginPath();
        const p = this.pathCommands;
        ctx.moveTo(p[0].x, p[0].y);
        for (let i = 1; i < p.length; i++) {
            const cmd = p[i];
            if (cmd.type === "line") ctx.lineTo(cmd.x, cmd.y);
            else if (cmd.type === "bezier")
                ctx.bezierCurveTo(
                    cmd.cp1x,
                    cmd.cp1y,
                    cmd.cp2x,
                    cmd.cp2y,
                    cmd.x,
                    cmd.y,
                );
            else if (cmd.type === "quadratic")
                ctx.quadraticCurveTo(cmd.cpx, cmd.cpy, cmd.x, cmd.y);
        }
        ctx.closePath();
    }

    draw(ctx, isCollisionMap = false) {
        if (isCollisionMap) {
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = this.lineWidth;
            ctx.lineCap = "butt";
            ctx.lineJoin = "round";
            this.strokeMainPath(ctx);
            ctx.stroke();
            if (this.clutter.length > 0) {
                ctx.fillStyle = "#000000";
                for (const c of this.clutter) {
                    ctx.beginPath();
                    if (c.type === "rect") ctx.rect(c.x, c.y, c.w, c.h);
                    else if (c.type === "circle")
                        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            // Walls are deliberately absent here: the road edge itself is the
            // barrier. Painting the wall band as passable used to open 40px of
            // grass beside it, so the track was wide in patches and narrow where
            // you expected it to be.
            return;
        }

        if (this.staticCanvas) {
            ctx.drawImage(this.staticCanvas, 0, 0);
            return;
        }
        this.renderStatic(ctx);
    }

    buildStaticCanvas() {
        this.staticCanvas = document.createElement("canvas");
        this.staticCanvas.width = this.logicalWidth;
        this.staticCanvas.height = this.logicalHeight;
        const ctx = this.staticCanvas.getContext("2d");
        this.renderStatic(ctx);
        if (this.features.length > 0) {
            this.heightField = new HeightField(
                this.logicalWidth,
                this.logicalHeight,
                6,
            );
            this.heightField.buildFrom(this);
            this.renderBermArt(ctx);
            this.renderRollerArt(ctx);
            this.renderWallDecor(ctx);
        }
    }

    renderBermArt(ctx) {
        for (const f of this.features) {
            if (f.type !== "berm") continue;
            const P = f.pts;
            const n = P.length;
            if (n < 2) continue;

            const widthAt = (t) => {
                const e = MathUtils.clamp(Math.min(t, 1 - t) / 0.22, 0, 1);
                return e * e * (3 - 2 * e);
            };
            const pt = (i, off) => ({
                x: P[i].x + P[i].nx * off,
                y: P[i].y + P[i].ny * off,
            });
            const offAt = (i, frac) => {
                const w = widthAt(i / (n - 1));
                const inner = MathUtils.lerp(f.off0 * 0.15, f.off0, w);
                const outer = MathUtils.lerp(f.off0 * 0.15, f.off1, w);
                return MathUtils.lerp(inner, outer, frac);
            };
            const strip = (fa, fb, alpha) => {
                ctx.beginPath();
                for (let i = 0; i < n; i++) {
                    const p = pt(i, offAt(i, fa));
                    if (i === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                }
                for (let i = n - 1; i >= 0; i--) {
                    const p = pt(i, offAt(i, fb));
                    ctx.lineTo(p.x, p.y);
                }
                ctx.closePath();
                ctx.fillStyle = `rgba(195,203,216,${alpha})`;
                ctx.fill();
            };

            strip(0.0, 0.42, 0.1);
            strip(0.42, 0.74, 0.17);
            strip(0.74, 1.0, 0.26);

            ctx.strokeStyle = "rgba(0,0,0,0.09)";
            ctx.lineWidth = 2;
            for (let i = 3; i < n - 2; i += 4) {
                const a = pt(i, offAt(i, 0.05));
                const b = pt(i, offAt(i, 0.95));
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }

            ctx.strokeStyle = "rgba(0,0,0,0.15)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const p = pt(i, offAt(i, 0));
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();

            ctx.strokeStyle = "rgba(255,255,255,0.32)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const p = pt(i, offAt(i, 1));
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
        }
    }

    renderRollerArt(ctx) {
        for (const f of this.features) {
            if (f.type !== "roller") continue;
            const midX = (f.x1 + f.x2) / 2;
            const midY = (f.y1 + f.y2) / 2;
            const g = ctx.createLinearGradient(
                midX - f.ux * f.w,
                midY - f.uy * f.w,
                midX + f.ux * f.w,
                midY + f.uy * f.w,
            );
            g.addColorStop(0, "rgba(205,210,220,0.03)");
            g.addColorStop(0.35, "rgba(205,210,220,0.16)");
            g.addColorStop(0.5, "rgba(212,217,227,0.24)");
            g.addColorStop(0.65, "rgba(205,210,220,0.16)");
            g.addColorStop(1, "rgba(205,210,220,0.03)");
            ctx.strokeStyle = g;
            ctx.lineWidth = f.halfAcross * 2;
            ctx.lineCap = "butt";
            ctx.beginPath();
            ctx.moveTo(f.x1, f.y1);
            ctx.lineTo(f.x2, f.y2);
            ctx.stroke();

            ctx.strokeStyle = "rgba(0,0,0,0.08)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(f.x1 + f.ux * f.w * 0.75, f.y1 + f.uy * f.w * 0.75);
            ctx.lineTo(f.x2 + f.ux * f.w * 0.75, f.y2 + f.uy * f.w * 0.75);
            ctx.stroke();

            ctx.strokeStyle = "rgba(255,255,255,0.26)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(f.x1, f.y1);
            ctx.lineTo(f.x2, f.y2);
            ctx.stroke();
        }
    }

    renderWallDecor(ctx) {
        for (const f of this.features) {
            if (f.type !== "wall") continue;
            const dx = f.x2 - f.x1;
            const dy = f.y2 - f.y1;
            const len = Math.max(Math.hypot(dx, dy), 0.001);
            const ux = dx / len;
            const uy = dy / len;
            const px = -uy * f.side;
            const py = ux * f.side;
            const l1x = f.x1 + px * f.w;
            const l1y = f.y1 + py * f.w;
            const l2x = f.x2 + px * f.w;
            const l2y = f.y2 + py * f.w;

            const grad = ctx.createLinearGradient(f.x1, f.y1, l1x, l1y);
            grad.addColorStop(0, "rgba(190,195,205,0.12)");
            grad.addColorStop(0.5, "rgba(190,195,205,0.3)");
            grad.addColorStop(1, "rgba(210,215,225,0.55)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(f.x1, f.y1);
            ctx.lineTo(f.x2, f.y2);
            ctx.lineTo(l2x, l2y);
            ctx.lineTo(l1x, l1y);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = "rgba(0,0,0,0.32)";
            ctx.lineWidth = 14;
            ctx.beginPath();
            ctx.moveTo(l1x + px * 9, l1y + py * 9);
            ctx.lineTo(l2x + px * 9, l2y + py * 9);
            ctx.stroke();

            ctx.strokeStyle = "rgba(255,255,255,0.6)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(l1x, l1y);
            ctx.lineTo(l2x, l2y);
            ctx.stroke();
        }
    }

    renderStatic(ctx) {
        ctx.lineCap = "butt";
        ctx.lineJoin = "round";

        ctx.fillStyle = this.grassColor;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        this.strokeMainPath(ctx);

        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = this.lineWidth + 18;
        ctx.stroke();

        ctx.strokeStyle = "#e8e8e8";
        ctx.lineWidth = this.lineWidth + 10;
        ctx.setLineDash([22, 22]);
        ctx.stroke();

        ctx.strokeStyle = this.curbColor;
        ctx.lineWidth = this.lineWidth + 10;
        ctx.lineDashOffset = 22;
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
        ctx.strokeStyle = this.asphaltColor;
        ctx.lineWidth = this.lineWidth;
        ctx.stroke();

        ctx.save();
        this.strokeMainPath(ctx);
        ctx.clip();
        ctx.globalAlpha = 0.05;
        for (let i = 0; i < 900; i++) {
            const x = Math.random() * ctx.canvas.width;
            const y = Math.random() * ctx.canvas.height;
            ctx.fillStyle = Math.random() < 0.5 ? "#fff" : "#000";
            ctx.fillRect(x, y, 2, 2);
        }
        ctx.restore();

        this.drawChevrons(ctx);
        this.drawStartGrid(ctx);

        ctx.lineWidth = 8;
        ctx.setLineDash([12, 12]);
        ctx.strokeStyle = "#fff";
        ctx.beginPath();
        ctx.moveTo(this.finishLine.p1.x, this.finishLine.p1.y);
        ctx.lineTo(this.finishLine.p2.x, this.finishLine.p2.y);
        ctx.stroke();
        ctx.lineDashOffset = 12;
        ctx.strokeStyle = "#111";
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;

        for (const c of this.clutter) {
            ctx.fillStyle = "rgba(0,0,0,0.35)";
            ctx.beginPath();
            if (c.type === "rect") ctx.rect(c.x + 6, c.y + 8, c.w, c.h);
            else if (c.type === "circle")
                ctx.arc(c.x + 6, c.y + 8, c.r, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = c.color || "#444";
            ctx.strokeStyle = "#15161a";
            ctx.lineWidth = 4;
            ctx.beginPath();
            if (c.type === "rect") ctx.rect(c.x, c.y, c.w, c.h);
            else if (c.type === "circle")
                ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            if (c.type === "circle") {
                ctx.strokeStyle = "rgba(255,255,255,0.15)";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(c.x, c.y, c.r * 0.65, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    }

    drawChevrons(ctx) {
        const pts = this.pathSamples;
        const startWp = this.waypoints[0];
        const spacing = 150;
        let acc = spacing * 0.7;
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.lineJoin = "miter";
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1];
            const b = pts[i];
            const segLen = MathUtils.distance(a.x, a.y, b.x, b.y);
            if (segLen === 0) continue;
            while (acc <= segLen) {
                const t = acc / segLen;
                const x = MathUtils.lerp(a.x, b.x, t);
                const y = MathUtils.lerp(a.y, b.y, t);
                const ang = Math.atan2(b.y - a.y, b.x - a.x);
                acc += spacing;
                if (MathUtils.distance(x, y, startWp.x, startWp.y) < 130)
                    continue;
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(ang);
                ctx.beginPath();
                ctx.moveTo(-6, -8);
                ctx.lineTo(4, 0);
                ctx.lineTo(-6, 8);
                ctx.stroke();
                ctx.restore();
            }
            acc -= segLen;
        }
    }

    drawStartGrid(ctx) {
        for (const s of this.startLines) {
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.angle);
            ctx.strokeStyle = "rgba(255,255,255,0.55)";
            ctx.lineWidth = 3;
            ctx.strokeRect(-19, -13, 38, 26);
            ctx.restore();
        }
    }
}

const TrackData = [
    new Track({
        name: "Beginner Oval",
        logicalWidth: 800,
        logicalHeight: 600,
        laps: 3,
        startLines: [
            { x: 400, y: 500, angle: 0 },
            { x: 400, y: 530, angle: 0 },
            { x: 350, y: 500, angle: 0 },
            { x: 350, y: 530, angle: 0 },
        ],
        finishLine: { p1: { x: 450, y: 460 }, p2: { x: 450, y: 540 } },
        waypoints: [
            { x: 450, y: 500 },
            { x: 650, y: 500 },
            { x: 700, y: 450 },
            { x: 700, y: 150 },
            { x: 650, y: 100 },
            { x: 150, y: 100 },
            { x: 100, y: 150 },
            { x: 100, y: 450 },
            { x: 150, y: 500 },
        ],
        pathCommands: [
            { type: "line", x: 200, y: 500 },
            { type: "line", x: 600, y: 500 },
            { type: "quadratic", cpx: 700, cpy: 500, x: 700, y: 400 },
            { type: "line", x: 700, y: 200 },
            { type: "quadratic", cpx: 700, cpy: 100, x: 600, y: 100 },
            { type: "line", x: 200, y: 100 },
            { type: "quadratic", cpx: 100, cpy: 100, x: 100, y: 200 },
            { type: "line", x: 100, y: 400 },
            { type: "quadratic", cpx: 100, cpy: 500, x: 200, y: 500 },
        ],
        lineWidth: 130,
        terrain: { rollers: 2 },
    }),

    new Track({
        name: "Peanut Cross",
        logicalWidth: 850,
        logicalHeight: 600,
        laps: 3,
        startLines: [
            { x: 360, y: 110, angle: 0 },
            { x: 360, y: 140, angle: 0 },
            { x: 320, y: 110, angle: 0 },
            { x: 320, y: 140, angle: 0 },
        ],
        finishLine: { p1: { x: 400, y: 70 }, p2: { x: 400, y: 150 } },
        waypoints: [
            { x: 400, y: 110 },
            { x: 600, y: 110 },
            { x: 700, y: 200 },
            { x: 600, y: 300 },
            { x: 400, y: 300 },
            { x: 200, y: 300 },
            { x: 100, y: 400 },
            { x: 200, y: 490 },
            { x: 600, y: 490 },
            { x: 700, y: 400 },
            { x: 200, y: 110 },
        ],
        pathCommands: [
            { type: "line", x: 400, y: 110 },
            { type: "line", x: 600, y: 110 },
            { type: "quadratic", cpx: 750, cpy: 110, x: 750, y: 200 },
            { type: "quadratic", cpx: 750, cpy: 300, x: 600, y: 300 },
            { type: "line", x: 200, y: 300 },
            { type: "quadratic", cpx: 50, cpy: 300, x: 50, y: 400 },
            { type: "quadratic", cpx: 50, cpy: 490, x: 200, y: 490 },
            { type: "line", x: 600, y: 490 },
            { type: "quadratic", cpx: 750, cpy: 490, x: 750, y: 400 },
            {
                type: "bezier",
                cp1x: 750,
                cp1y: 350,
                cp2x: 200,
                cp2y: 200,
                x: 200,
                y: 110,
            },
            { type: "line", x: 400, y: 110 },
        ],
        lineWidth: 96,
        terrain: { rollers: 1 },
    }),

    new Track({
        name: "Snake Run",
        logicalWidth: 850,
        logicalHeight: 600,
        laps: 3,
        startLines: [
            { x: 150, y: 460, angle: -Math.PI / 2 },
            { x: 180, y: 460, angle: -Math.PI / 2 },
            { x: 150, y: 500, angle: -Math.PI / 2 },
            { x: 180, y: 500, angle: -Math.PI / 2 },
        ],
        finishLine: { p1: { x: 110, y: 420 }, p2: { x: 190, y: 420 } },
        waypoints: [
            { x: 150, y: 420 },
            { x: 150, y: 200 },
            { x: 250, y: 100 },
            { x: 350, y: 200 },
            { x: 450, y: 300 },
            { x: 550, y: 200 },
            { x: 650, y: 100 },
            { x: 750, y: 300 },
            { x: 550, y: 500 },
            { x: 250, y: 500 },
            { x: 150, y: 420 },
        ],
        pathCommands: [
            { type: "line", x: 150, y: 420 },
            { type: "line", x: 150, y: 200 },
            { type: "quadratic", cpx: 150, cpy: 100, x: 250, y: 100 },
            { type: "quadratic", cpx: 350, cpy: 100, x: 350, y: 200 },
            { type: "quadratic", cpx: 350, cpy: 300, x: 450, y: 300 },
            { type: "quadratic", cpx: 550, cpy: 300, x: 550, y: 200 },
            { type: "quadratic", cpx: 550, cpy: 100, x: 650, y: 100 },
            { type: "quadratic", cpx: 750, cpy: 100, x: 750, y: 300 },
            { type: "quadratic", cpx: 750, cpy: 500, x: 550, y: 500 },
            { type: "line", x: 250, y: 500 },
            { type: "quadratic", cpx: 150, cpy: 500, x: 150, y: 420 },
        ],
        lineWidth: 116,
        terrain: { rollers: 2 },
    }),

    new Track({
        name: "Downtown Drift",
        logicalWidth: 900,
        logicalHeight: 950,
        laps: 3,
        startLines: [
            { x: 440, y: 550, angle: -Math.PI / 2 },
            { x: 470, y: 550, angle: -Math.PI / 2 },
            { x: 440, y: 580, angle: -Math.PI / 2 },
            { x: 470, y: 580, angle: -Math.PI / 2 },
        ],
        finishLine: { p1: { x: 410, y: 500 }, p2: { x: 490, y: 500 } },
        waypoints: [
            { x: 450, y: 480 },
            { x: 450, y: 300 },
            { x: 600, y: 200 },
            { x: 800, y: 300 },
            { x: 800, y: 600 },
            { x: 650, y: 750 },
            { x: 350, y: 750 },
            { x: 200, y: 600 },
            { x: 200, y: 400 },
            { x: 350, y: 250 },
            { x: 350, y: 100 },
            { x: 200, y: 100 },
            { x: 100, y: 250 },
            { x: 100, y: 700 },
            { x: 250, y: 850 },
            { x: 600, y: 850 },
            { x: 450, y: 600 },
        ],
        pathCommands: [
            { type: "line", x: 450, y: 600 },
            { type: "line", x: 450, y: 300 },
            { type: "quadratic", cpx: 450, cpy: 200, x: 600, y: 200 },
            { type: "quadratic", cpx: 800, cpy: 200, x: 800, y: 300 },
            { type: "line", x: 800, y: 600 },
            { type: "quadratic", cpx: 800, cpy: 750, x: 650, y: 750 },
            { type: "line", x: 350, y: 750 },
            { type: "quadratic", cpx: 200, cpy: 750, x: 200, y: 600 },
            { type: "line", x: 200, y: 400 },
            { type: "quadratic", cpx: 200, cpy: 250, x: 350, y: 250 },
            { type: "line", x: 350, y: 100 },
            { type: "quadratic", cpx: 350, cpy: 50, x: 200, y: 50 },
            { type: "quadratic", cpx: 100, cpy: 50, x: 100, y: 250 },
            { type: "line", x: 100, y: 700 },
            { type: "quadratic", cpx: 100, cpy: 850, x: 250, y: 850 },
            { type: "line", x: 600, y: 850 },
            { type: "quadratic", cpx: 600, cpy: 600, x: 450, y: 600 },
        ],
        clutter: [
            { type: "rect", x: 250, y: 400, w: 80, h: 200, color: "#3f51b5" },
            { type: "rect", x: 550, y: 400, w: 120, h: 200, color: "#f44336" },
            { type: "circle", x: 200, y: 200, r: 30, color: "#9e9e9e" },
        ],
        // 100px is the closest this loop runs alongside itself, so 84 leaves a
        // shoulder without merging the two stretches into one corridor.
        lineWidth: 84,
        terrain: { walls: 2, rollers: 1 },
    }),

    new Track({
        name: "Industrial Zone",
        logicalWidth: 1000,
        logicalHeight: 900,
        laps: 3,
        startLines: [
            { x: 150, y: 150, angle: 0 },
            { x: 150, y: 180, angle: 0 },
            { x: 110, y: 150, angle: 0 },
            { x: 110, y: 180, angle: 0 },
        ],
        finishLine: { p1: { x: 200, y: 110 }, p2: { x: 200, y: 220 } },
        waypoints: [
            { x: 200, y: 165 },
            { x: 800, y: 165 },
            { x: 800, y: 800 },
            { x: 150, y: 800 },
            { x: 150, y: 450 },
            { x: 600, y: 450 },
            { x: 450, y: 300 },
            { x: 150, y: 300 },
            { x: 150, y: 165 },
        ],
        pathCommands: [
            { type: "line", x: 200, y: 165 },
            { type: "line", x: 800, y: 165 },
            { type: "quadratic", cpx: 900, cpy: 165, x: 900, y: 265 },
            { type: "line", x: 900, y: 700 },
            { type: "quadratic", cpx: 900, cpy: 800, x: 800, y: 800 },
            { type: "line", x: 150, y: 800 },
            { type: "quadratic", cpx: 50, cpy: 800, x: 50, y: 700 },
            { type: "line", x: 50, y: 450 },
            { type: "quadratic", cpx: 50, cpy: 350, x: 150, y: 350 },
            { type: "line", x: 550, y: 350 },
            { type: "quadratic", cpx: 650, cpy: 350, x: 650, y: 250 },
            {
                type: "bezier",
                cp1x: 650,
                cp1y: 150,
                cp2x: 450,
                cp2y: 150,
                x: 450,
                y: 250,
            },
            { type: "line", x: 150, y: 250 },
            { type: "quadratic", cpx: 50, cpy: 250, x: 50, y: 165 },
            { type: "line", x: 200, y: 165 },
        ],
        clutter: [
            { type: "rect", x: 250, y: 450, w: 200, h: 250, color: "#607d8b" },
            { type: "rect", x: 400, y: 650, w: 300, h: 80, color: "#795548" },
            { type: "circle", x: 450, y: 550, r: 60, color: "#bdbdbd" },
            { type: "circle", x: 600, y: 550, r: 40, color: "#bdbdbd" },
            { type: "rect", x: 750, y: 300, w: 50, h: 350, color: "#ff9800" },
        ],
        lineWidth: 92,
        asphaltColor: "#202126",
        curbColor: "#4CAF50",
        terrain: { walls: 2, rollers: 2 },
    }),
];

// Classic script, loaded before Game.js, which reads this as a global.
window.TrackData = TrackData;
