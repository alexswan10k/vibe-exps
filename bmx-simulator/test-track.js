// node test-track.js — geometry audit: do the features sit on the road we drew?
const fs = require("fs");
const vm = require("vm");
global.window = {};
vm.runInThisContext(fs.readFileSync("MathUtils.js", "utf8"));
vm.runInThisContext(fs.readFileSync("Terrain.js", "utf8"));
vm.runInThisContext(
    fs.readFileSync("Tracks.js", "utf8") + "\n;globalThis.TD = TrackData;",
);
const TD = globalThis.TD;

const fails = [];
const ck = (ok, msg, got) => {
    if (!ok) fails.push(msg + " -> " + got);
};
process.on("exit", () => {
    if (fails.length) {
        process.stderr.write("FAIL\n" + fails.join("\n") + "\n");
        process.exitCode = 1;
    } else process.stdout.write("ok\n");
});

// distance from p to the painted centerline
function toRoad(pts, x, y) {
    let best = Infinity;
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const l2 = dx * dx + dy * dy || 1;
        const t = MathUtils.clamp(((x - a.x) * dx + (y - a.y) * dy) / l2, 0, 1);
        const d = Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
        if (d < best) best = d;
    }
    return best;
}

for (const t of TD) {
    const rh = t.lineWidth / 2;
    const hf = new HeightField(t.logicalWidth, t.logicalHeight, 6);
    hf.buildFrom(t);
    const tag = t.name;

    ck(
        t.lineWidth >= 84,
        `${tag}: track should be wide enough to race on`,
        t.lineWidth,
    );

    const kinds = {};
    for (const f of t.features) {
        kinds[f.type] = (kinds[f.type] || 0) + 1;
        const ring = [];
        if (f.type === "roller") {
            ring.push([f.x1, f.y1], [f.x2, f.y2]);
        } else if (f.type === "wall") {
            // footprint: the ramp band from its foot out to its lip
            const dx = f.x2 - f.x1,
                dy = f.y2 - f.y1;
            const L = Math.hypot(dx, dy) || 1;
            const nx = (-dy / L) * f.side,
                ny = (dx / L) * f.side;
            for (const s of [0, 0.5, 1]) {
                for (const tt of [0, 0.5, 1]) {
                    ring.push([
                        f.x1 + dx * tt + nx * f.w * s,
                        f.y1 + dy * tt + ny * f.w * s,
                    ]);
                }
            }
        } else {
            for (let i = 0; i < f.pts.length; i += 3) {
                for (const off of [f.off0, (f.off0 + f.off1) / 2, f.off1]) {
                    ring.push([
                        f.pts[i].x + f.pts[i].nx * off,
                        f.pts[i].y + f.pts[i].ny * off,
                    ]);
                }
            }
        }
        let worst = 0;
        for (const [x, y] of ring) {
            const d = toRoad(t.pathSamples, x, y);
            if (d > worst) worst = d;
        }
        ck(
            worst <= rh + 1,
            `${tag}: ${f.type} footprint must sit on the road (roadHalf ${rh})`,
            worst.toFixed(1),
        );
    }

    // Nothing may be built out on the grass. Probed by distance to the painted
    // centreline, not by the feature's own normal: strip normals fan out on a
    // curve, so an offset point can still be well inside the road.
    let bleed = 0;
    let bleedAt = null;
    for (const f of t.features) {
        const probe = [];
        if (f.type === "roller") probe.push([f.x1, f.y1], [f.x2, f.y2]);
        else if (f.type === "wall") {
            const dx = f.x2 - f.x1,
                dy = f.y2 - f.y1;
            const L = Math.hypot(dx, dy) || 1;
            const nx = (-dy / L) * f.side,
                ny = (dx / L) * f.side;
            for (const tt of [0, 0.5, 1])
                probe.push([
                    f.x1 + dx * tt + nx * (f.w + 14),
                    f.y1 + dy * tt + ny * (f.w + 4),
                ]);
        } else {
            for (let i = 0; i < f.pts.length; i += 3)
                probe.push([
                    f.pts[i].x + f.pts[i].nx * (f.off1 + 14),
                    f.pts[i].y + f.pts[i].ny * (f.off1 + 4),
                ]);
        }
        for (const [x, y] of probe) {
            if (x < 0 || y < 0 || x > t.logicalWidth || y > t.logicalHeight)
                continue; // sample() clamps to the border column, which is not geometry
            if (toRoad(t.pathSamples, x, y) <= rh + 8) continue; // still on the road
            const h = hf.sample(x, y);
            if (h > bleed) {
                bleed = h;
                bleedAt = `${Math.round(x)},${Math.round(y)} off-road by ${(toRoad(t.pathSamples, x, y) - rh).toFixed(0)}px`;
            }
        }
    }
    ck(
        bleed < 1.5,
        `${tag}: elevation must not bleed past the road edge (${bleedAt})`,
        bleed.toFixed(2),
    );

    for (const f of t.features) {
        if (f.type === "roller") {
            const mx = (f.x1 + f.x2) / 2,
                my = (f.y1 + f.y2) / 2;
            const h = hf.sample(mx, my);
            ck(
                h > f.h * 0.6,
                `${tag}: roller should crest at its centre`,
                h.toFixed(1),
            );
            const t1 = toRoad(t.pathSamples, mx + f.ux * 40, my + f.uy * 40);
            const t2 = toRoad(t.pathSamples, mx - f.ux * 40, my - f.uy * 40);
            ck(
                t1 < rh && t2 < rh,
                `${tag}: roller must run along a straight`,
                `${t1.toFixed(0)}/${t2.toFixed(0)}`,
            );
            ck(
                f.halfAcross <= rh,
                `${tag}: roller must not overhang the road`,
                f.halfAcross,
            );
        }
        if (f.type === "wall") {
            ck(f.h >= 18, `${tag}: wall needs a real kickplate`, f.h);
            ck(
                f.w <= rh,
                `${tag}: kickplate must fit across the road edge`,
                f.w,
            );
        }
        if (f.type === "berm") {
            const slope = f.h / (f.off1 - f.off0);
            ck(
                slope >= 0.3,
                `${tag}: berm must be banked enough to steer with`,
                slope.toFixed(2),
            );
            ck(
                f.off0 < rh * 0.3,
                `${tag}: berm should start inside the road`,
                f.off0.toFixed(0),
            );
            // The high side must be the outside of the turn. Bike steers off the
            // cross-slope, so a bank on the inside throws the rider out of the
            // corner instead of into it.
            const mid = Math.floor(f.pts.length / 2);
            const before = f.pts[Math.max(0, mid - 5)];
            const after = f.pts[Math.min(f.pts.length - 1, mid + 5)];
            const apex = f.pts[mid];
            const ux = apex.x - before.x;
            const uy = apex.y - before.y;
            const vx = after.x - apex.x;
            const vy = after.y - apex.y;
            const s = Math.sign(ux * vy - uy * vx);
            const intoTurn =
                apex.nx * (s > 0 ? -uy : uy) + apex.ny * (s > 0 ? ux : -ux);
            ck(
                intoTurn < 0,
                `${tag}: berm is banked on the inside of the turn`,
                intoTurn.toFixed(0),
            );
        }
    }
    ck((kinds.berm || 0) > 0, `${tag}: corners should be banked`, kinds.berm);
}
