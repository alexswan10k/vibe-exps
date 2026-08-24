// World Data Generator - Liberty City
// Emits TWO artifacts:
//   CITY_GRID  : pure terrain/district/landmark tile map (NO road tiles)
//   ROAD_GRAPH : {nodes, edges} - roads defined as splines between nodes,
//                rendered & driven in continuous world space, not tiles.

function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

let rng = Math.random;
const rand = () => rng();
const randi = (min, max) => min + Math.floor(rand() * (max - min + 1));

const COLS = 100;
const ROWS = 75;
const CELL = 96;

function generateCity() {
    rng = mulberry32(0xC177);

    const cols = COLS, rows = ROWS;
    let grid = [];
    for (let y = 0; y < rows; y++) {
        grid[y] = [];
        for (let x = 0; x < cols; x++) grid[y][x] = 'B';
    }
    // Road mask (tile resolution, used only to SHAPE the network & place things)
    const mask = [];
    for (let y = 0; y < rows; y++) { mask[y] = []; for (let x = 0; x < cols; x++) mask[y][x] = 0; }
    const hwyMask = [];
    for (let y = 0; y < rows; y++) { hwyMask[y] = []; for (let x = 0; x < cols; x++) hwyMask[y][x] = 0; }

    // ============ 1. IRREGULAR ROAD NETWORK SHAPE ============
    const FORCED_V = [5, 13, 75, 86];
    const FORCED_H = [54, 60, 64];
    let vRoads = [];
    for (let c = 3; c <= 72;) {
        if (FORCED_V.every(f => Math.abs(c - f) >= 3)) vRoads.push(c);
        c += randi(4, 9);
    }
    vRoads.push(...FORCED_V);
    vRoads.sort((a, b) => a - b);

    let hRoads = [];
    for (let r = 3; r <= 70;) {
        if (FORCED_H.every(f => Math.abs(r - f) >= 3) && Math.abs(r - 36) > 3) hRoads.push(r);
        r += randi(4, 8);
    }
    hRoads.push(...FORCED_H);
    hRoads.sort((a, b) => a - b);

    const hwyCandidates = hRoads.filter(r => Math.abs(r - 36) > 4 && r < 52);
    const hwyPool = hwyCandidates.length ? hwyCandidates : hRoads;
    const hwyRow = hwyPool.reduce((best, r) => Math.abs(r - 44) < Math.abs(best - 44) ? r : best, hwyPool[0]);
    const hwyCol = vRoads.reduce((best, c) => Math.abs(c - 56) < Math.abs(best - 56) ? c : best, vRoads[0]);

    for (let r of hRoads) for (let x = 1; x < cols - 1; x++) { mask[r][x] = 1; if (r === hwyRow) hwyMask[r][x] = 1; }
    for (let c of vRoads) for (let y = 1; y < rows - 1; y++) { mask[y][c] = 1; if (c === hwyCol) hwyMask[y][c] = 1; }

    // ============ 2. WATER ============
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        if (grid[y][x] === 'B') grid[y][x] = 'B';
    }
    // Ocean & beach (wavy shoreline, east)
    const coastShift = [];
    {
        let pos = 0, s = rand() < 0.5 ? 0 : 1;
        while (pos < rows) {
            const len = randi(4, 7);
            for (let i = 0; i < len && pos < rows; i++, pos++) coastShift[pos] = s;
            s = 1 - s;
        }
    }
    for (let y = 0; y < rows; y++) {
        const coastCol = 88 - coastShift[y];
        for (let x = 86; x < cols; x++) {
            if (x > coastCol) grid[y][x] = 'W';
            else if (x === coastCol) grid[y][x] = 'W_COAST';
            else grid[y][x] = 'SAND';
        }
    }

    // River
    const phase = rand() * Math.PI * 2;
    const xBase = 46 + randi(-2, 2);
    const riverX = y => Math.max(32, Math.min(58, Math.round(xBase + 3.0 * Math.sin(y * 0.2 + phase))));
    const riverCells = [];
    const carveWater = (y, x) => {
        if (y < 1 || y >= rows - 1 || x < 1 || x >= cols - 1) return;
        if (grid[y][x] !== 'W' && grid[y][x] !== 'W_COAST' && grid[y][x] !== 'SAND') grid[y][x] = 'W';
        riverCells.push({ x, y });
    };
    for (let y = 1; y <= 34; y++) {
        const xw = riverX(y);
        carveWater(y, xw); carveWater(y, xw + 1);
        if (rand() < 0.45) carveWater(y, xw - 1);
    }
    const exitX = riverX(34);
    for (let y = 35; y <= 37; y++) for (let x = Math.max(1, exitX - 2); x <= cols - 2; x++) carveWater(y, x);
    for (let x = Math.max(1, exitX + 10); x <= cols - 2; x++) { carveWater(34, x); carveWater(38, x); }

    // Roads over water become bridges: record which masked cells sit on water
    const waterAt = (x, y) => grid[y] && (grid[y][x] === 'W');

    // Riparian greenway
    for (const rc of riverCells) {
        for (const [nx, ny] of [[rc.x - 1, rc.y], [rc.x + 1, rc.y], [rc.x, rc.y - 1], [rc.x, rc.y + 1]]) {
            if (nx < 1 || nx >= cols - 1 || ny < 1 || ny >= rows - 1) continue;
            if (grid[ny][nx] === 'B' && rand() < 0.3) grid[ny][nx] = 'PARK';
        }
    }
    // River island
    for (let ix = exitX + 12; ix <= 84; ix++) {
        let clear = true;
        for (let iy = 34; iy <= 38; iy++) if (grid[iy][ix] !== 'W') { clear = false; break; }
        if (clear) { grid[36][ix] = 'SAND'; grid[37][ix] = 'SAND'; break; }
    }

    // ============ 3. PLAZA / PARK / DISTRICTS ============
    for (let y = 40; y <= 42; y++) for (let x = 43; x <= 46; x++) {
        if (grid[y][x] === 'B' && !mask[y][x]) grid[y][x] = 'PLAZA';
    }
    const pcx = 57, pcy = 44;
    const prad = [];
    for (let i = 0; i < 16; i++) prad.push(8.0 + rand() * 2.0);
    for (let y = pcy - 10; y <= pcy + 10; y++) {
        for (let x = pcx - 11; x <= pcx + 11; x++) {
            if (x < 1 || x >= cols - 1 || y < 1 || y >= rows - 1) continue;
            if (grid[y][x] !== 'B' || mask[y][x]) continue;
            const dx = (x - pcx) / 10.2, dy = (y - pcy) / 8.2;
            const ang = Math.atan2(dy, dx);
            const bin = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 16) % 16;
            if (dx * dx + dy * dy < 1.0 + (prad[bin] - 9.0) * 0.09) grid[y][x] = 'PARK';
        }
    }
    for (let y = pcy; y <= pcy + 4; y++) for (let x = pcx - 5; x <= pcx + 3; x++) {
        if (grid[y] && grid[y][x] === 'PARK') {
            const dx = (x - (pcx - 1)) / 3.6, dy = (y - (pcy + 2)) / 2.4;
            if (dx * dx + dy * dy < 1) grid[y][x] = 'W_POND';
        }
    }
    grid[pcy + 2][pcx - 1] = 'PARK';
    grid[pcy + 2][pcx] = 'PARK';

    const paintVirgin = (x, y, tok) => { if (grid[y] && grid[y][x] === 'B' && !mask[y][x]) grid[y][x] = tok; };
    // Industrial NW
    for (let y = 1; y <= 22; y++) for (let x = 1; x <= 42; x++) {
        if (grid[y][x] !== 'B' || mask[y][x]) continue;
        const n = rand();
        paintVirgin(x, y, n < 0.22 ? 'CONT' : n < 0.58 ? 'B_IND' : 'E_DOCK');
    }
    for (let y = 23; y <= 29; y++) for (let x = 1; x <= 26; x++) {
        if (grid[y][x] === 'B' && !mask[y][x]) paintVirgin(x, y, rand() < 0.3 ? 'CONT' : 'B_IND');
    }
    // Chinatown blob
    const ccx = 19, ccy = 35;
    for (let y = ccy - 8; y <= ccy + 8; y++) for (let x = ccx - 8; x <= ccx + 8; x++) {
        if (grid[y] && grid[y][x] === 'B' && !mask[y][x]) {
            const d = Math.sqrt((x - ccx) ** 2 + (y - ccy) ** 2);
            if (d < 8.0 + rand() * 1.8) paintVirgin(x, y, rand() < 0.82 ? 'B_CT' : 'B_OLD');
        }
    }
    // Brownstone Row
    for (let y = 42; y <= 49; y++) for (let x = 1; x <= 31; x++) {
        if (grid[y][x] === 'B' && !mask[y][x]) {
            const rb = rand();
            paintVirgin(x, y, rb < 0.03 ? 'B_CHU' : rb < 0.75 ? 'B_OLD' : 'B_SUB');
        }
    }
    // Downtown radial
    const dcx = 73, dcy = 17;
    for (let y = 1; y <= 33; y++) for (let x = 55; x <= 85; x++) {
        if (grid[y][x] !== 'B' || mask[y][x]) continue;
        const d = Math.sqrt((x - dcx) ** 2 + (y - dcy) ** 2);
        if (d < 13.0 + rand() * 2.0) paintVirgin(x, y, rand() < 0.28 ? 'B_OFF' : 'B_DT');
        else if (d < 17.0) paintVirgin(x, y, rand() < 0.30 ? 'B_OFF' : rand() < 0.55 ? 'B_DT' : 'B');
    }
    // Little Italy
    for (let y = 39; y <= 51; y++) for (let x = 58; x <= 75; x++) {
        if (grid[y][x] === 'B' && !mask[y][x] && rand() < 0.8) {
            const r3 = rand();
            paintVirgin(x, y, r3 < 0.45 ? 'B_SHOP' : r3 < 0.72 ? 'B_OLD' : 'B_CT');
        }
    }
    // Suburbs
    for (let y = 52; y <= rows - 2; y++) for (let x = 1; x <= 74; x++) {
        if (grid[y][x] !== 'B' || mask[y][x]) continue;
        if (x >= 75) continue;
        if (y <= 59 && x <= 13) continue;
        const n = rand();
        paintVirgin(x, y,
            n < 0.10 ? 'POOL' :
            n < 0.22 ? 'GARDEN' :
            n < 0.40 ? 'B_VIC' :
            n < 0.50 ? 'B_RAN' :
            n < 0.515 ? 'B_CHU' : 'B_SUB');
    }
    // Fabric filler
    for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) {
        if (grid[y][x] === 'B' && !mask[y][x]) {
            const n = rand();
            if (n < 0.08) grid[y][x] = 'GARDEN';
            else if (n < 0.14) grid[y][x] = 'YARD';
        }
    }
    // Block flavor
    const REPLACEABLE = ['B', 'B_DT', 'B_CT', 'B_IND', 'B_SUB', 'B_OLD', 'B_VIC', 'B_RAN', 'B_OFF', 'B_SHOP', 'B_CHU', 'GARDEN', 'YARD', 'E_DOCK', 'CONT'];
    const stampBlock = (cx, cy, w, h, tok) => {
        for (let y = cy; y < cy + h; y++) for (let x = cx; x < cx + w; x++) {
            if (grid[y] && REPLACEABLE.indexOf(grid[y][x]) !== -1 && !mask[y][x]) grid[y][x] = tok;
        }
    };
    for (let i = 0; i < 6; i++) {
        const cx = randi(2, cols - 5), cy = randi(2, rows - 5);
        stampBlock(cx, cy, 2, 2, 'LOT');
    }
    for (let i = 0; i < 4; i++) {
        const cx = randi(2, cols - 6), cy = randi(2, rows - 5);
        stampBlock(cx, cy, 3, 2, 'DIRT');
    }

    // ============ 4. DEAD-END CUTS (guarded on mask connectivity) ============
    const maskComponents = () => {
        const seen = new Set();
        let comps = 0;
        for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) {
            const k0 = y * cols + x;
            if (!mask[y][x] || seen.has(k0)) continue;
            comps++;
            if (comps > 1) return comps;
            const q = [[x, y]];
            seen.add(k0);
            while (q.length) {
                const [cx, cy] = q.pop();
                for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
                    if (nx < 1 || ny < 1 || nx >= cols - 1 || ny >= rows - 1) continue;
                    const k = ny * cols + nx;
                    if (seen.has(k) || !mask[ny][nx]) continue;
                    seen.add(k);
                    q.push([nx, ny]);
                }
            }
        }
        return comps;
    };
    const forcedSet = new Set(FORCED_V.map(c => 'v' + c).concat(FORCED_H.map(r => 'h' + r)));
    let cuts = 0, attempts = 0;
    while (cuts < 24 && attempts++ < 240) {
        const vert = rand() < 0.5;
        const line = (vert ? vRoads : hRoads)[randi(0, (vert ? vRoads : hRoads).length - 1)];
        if (forcedSet.has((vert ? 'v' : 'h') + line)) continue;
        if (vert && line === hwyCol) continue;
        if (!vert && line === hwyRow) continue;
        const start = vert ? randi(4, rows - 12) : randi(4, cols - 12);
        const len = randi(3, 7);
        const cells = [];
        let ok = true;
        for (let i = 0; i < len; i++) {
            const cx = vert ? line : start + i;
            const cy = vert ? start + i : line;
            if (!mask[cy][cx]) { ok = false; break; }
            cells.push([cx, cy]);
        }
        if (!ok || cells.length === 0) continue;
        for (const [cx, cy] of cells) mask[cy][cx] = 0;
        if (maskComponents() !== 1) {
            for (const [cx, cy] of cells) mask[cy][cx] = 1;
        } else {
            cuts++;
        }
    }

    // ============ 5. CURVED ARTERIALS (dense polylines, world px) ============
    const catmull = (p0, p1, p2, p3, t) => {
        const t2 = t * t, t3 = t2 * t;
        return [
            0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
            0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
        ];
    };
    const splinePoints = (waypoints, step) => {
        const pts = [];
        for (let i = 0; i < waypoints.length - 1; i++) {
            const p0 = waypoints[Math.max(0, i - 1)], p1 = waypoints[i],
                  p2 = waypoints[i + 1], p3 = waypoints[Math.min(waypoints.length - 1, i + 2)];
            const seg = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
            for (let s = 0; s < seg; s++) pts.push(catmull(p0, p1, p2, p3, s / seg));
        }
        pts.push(waypoints[waypoints.length - 1]);
        return pts;
    };
    const W = cols * CELL, H = rows * CELL;
    const vespucciPts = splinePoints(
        [[14.5, 12.5], [26, 20], [34, 32], [30, 46], [38, 58], [52, 66], [64, 70]].map(p => [p[0] * CELL, p[1] * CELL]), 42);
    const algonkinPts = splinePoints(
        [[10.5, 54.5], [18, 46], [28, 40], [40, 34], [52, 30], [64, 26], [74, 20], [82, 16]].map(p => [p[0] * CELL, p[1] * CELL]), 42);
    // Endpoints of these two get snapped onto real junctions once the grid exists
    const snapToJunction = (tx, ty) => {
        for (let r = 0; r <= 4; r++) {
            for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                const key = (tx + dx) + ',' + (ty + dy);
                if (nodeIdByCell.has(key)) {
                    const n = nodes[nodeIdByCell.get(key)];
                    return [n.x, n.y];
                }
            }
        }
        return [tx * CELL, ty * CELL];
    };
    const ringPts = [];
    {
        // Irregular organic loop: layered sinusoidal radius wobble (periodic -> closes)
        const gcx = 54 * CELL, gcy = 32 * CELL;
        const brx = 24 * CELL, bry = 21 * CELL;
        const p1 = rand() * Math.PI * 2, p2 = rand() * Math.PI * 2, p3 = rand() * Math.PI * 2;
        const steps = 260;
        for (let i = 0; i <= steps; i++) {
            const th = (i / steps) * Math.PI * 2;
            const wob = 1 + 0.13 * Math.sin(3 * th + p1) + 0.09 * Math.sin(5 * th + p2) + 0.05 * Math.sin(7 * th + p3);
            ringPts.push([gcx + brx * wob * Math.cos(th), gcy + bry * wob * Math.sin(th)]);
        }
    }
    // Mark curve corridors on the mask (so nothing builds there)
    const markCurve = (pts, halfW) => {
        for (const [fx, fy] of pts) {
            const cx = Math.floor(fx / CELL), cy = Math.floor(fy / CELL);
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const nx = cx + dx, ny = cy + dy;
                if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
                const rx = nx * CELL + CELL / 2 - fx, ry = ny * CELL + CELL / 2 - fy;
                if (rx * rx + ry * ry < (halfW + CELL * 0.72) ** 2) mask[ny][nx] = 1;
            }
        }
    };

    // ============ 5b. LANDMARKS scouted EARLY so roads can serve them ============
    const nearMaskRoad = (x, y) => {
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
            if (mask[y + dy] && mask[y + dy][x + dx]) return true;
        }
        return false;
    };
    const reserveSpot = (tc, tr) => {
        for (let ring = 0; ring <= 8; ring++) {
            for (let dy = -ring; dy <= ring; dy++) {
                for (let dx = -ring; dx <= ring; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
                    const x = tc + dx, y = tr + dy;
                    if (x < 1 || x >= cols - 1 || y < 1 || y >= rows - 1) continue;
                    const t = grid[y][x];
                    if (!(t === 'B' || OPEN_TOKENS.indexOf(t) !== -1)) continue;
                    if (nearMaskRoad(x, y)) { grid[y][x] = 'RESERVED'; return { x, y }; }
                }
            }
        }
        return null;
    };
    const put = (spot, tok) => { if (spot) grid[spot.y][spot.x] = tok; };
    const landmarkPOIs = [];
    const scoutPOI = (name, tc, tr, tok) => {
        const s = reserveSpot(tc, tr);
        put(s, tok);
        if (s) landmarkPOIs.push({ name, wx: s.x * CELL + CELL / 2, wy: s.y * CELL + CELL / 2 });
    };
    scoutPOI("Police HQ", 33, 13, 'PD');
    scoutPOI("Ammu-Nation", 18, 35, 'AMMU');
    scoutPOI("Pink Palace Casino", 24, 38, 'CASINO');
    scoutPOI("Burger Shot", 48, 40, 'DINER');
    scoutPOI("General Hospital", 66, 52, 'HOSP');
    scoutPOI("Fuel Station", 21, 54, 'GAS');
    scoutPOI("Fuel Station", 58, 19, 'GAS');
    scoutPOI("Fuel Station", 69, 70, 'GAS');
    scoutPOI("Pay 'n' Spray", 62, 11, 'PNS');
    scoutPOI("Pay 'n' Spray", 38, 65, 'PNS');


    // ============ 6. BUILD THE ROAD GRAPH ============
    const nodes = [];           // {id, x, y, deg}
    const nodeIdByCell = new Map(); // "cx,cy" -> node id (orthogonal junctions)
    const getNodeAtCell = (cx, cy) => {
        const k = cx + ',' + cy;
        if (nodeIdByCell.has(k)) return nodeIdByCell.get(k);
        const id = nodes.length;
        nodes.push({ id, x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2, deg: 0 });
        nodeIdByCell.set(k, id);
        return id;
    };
    const edges = [];           // {a, b, w, kind, pts:[[x,y]..], len, cum, bridge}

    const addEdge = (a, b, pts, wIn, kind) => {
        if (pts.length < 2) return null;
        const w = Math.round(wIn * (0.93 + rand() * 0.14)); // organic width variety
        let len = 0;
        const cum = [0];
        for (let i = 1; i < pts.length; i++) {
            len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
            cum.push(len);
        }
        // Bridge detection: any sample over deep water
        let bridge = false;
        for (const [fx, fy] of pts) {
            if (waterAt(Math.floor(fx / CELL), Math.floor(fy / CELL))) { bridge = true; break; }
        }
        const e = { a: a.id, b: b.id, w, kind, pts, len, cum, bridge };
        edges.push(e);
        a.deg++; b.deg++;
        return e;
    };

    // --- Orthogonal streets -> graph ---
    // Junctions are mask cells whose neighbour-count != 2 (endpoints & crossings)
    const isM = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && mask[y][x] === 1;
    const nbCount = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => isM(x + dx, y + dy)).length;
    for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) {
        if (mask[y][x] && nbCount(x, y) !== 2) getNodeAtCell(x, y);
    }
    // Walk corridors between junctions (half-edge dedupe)
    const traced = new Set();
    for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) {
        if (!mask[y][x]) continue;
        if (!nodeIdByCell.has(x + ',' + y)) continue;
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
            let nx = x + dx, ny = y + dy;
            if (!isM(nx, ny)) continue;
            const hk = x + ',' + y + '>' + nx + ',' + ny;
            const rk = nx + ',' + ny + '>' + x + ',' + y;
            if (traced.has(hk)) continue;
            const cellsA = [[x, y]];
            let px = x, py = y;
            while (nx >= 0 && ny >= 0 && nx < cols && ny < rows && mask[ny][nx] &&
                   !nodeIdByCell.has(nx + ',' + ny)) {
                cellsA.push([nx, ny]);
                traced.add(px + ',' + py + '>' + nx + ',' + ny);
                px = nx; py = ny;
                nx += dx; ny += dy;
            }
            traced.add(px + ',' + py + '>' + nx + ',' + ny);
            if (!nodeIdByCell.has(nx + ',' + ny)) continue; // dangling into nothing
            cellsA.push([nx, ny]);
            const A = nodes[nodeIdByCell.get(cellsA[0][0] + ',' + cellsA[0][1])];
            const Bn = nodeIdByCell.get(nx + ',' + ny);
            const B = nodes[Bn];
            if (A.id === B.id) continue;
            const hw = hwyMask[cellsA[0][1]][cellsA[0][0]] || hwyMask[ny][nx];
            addEdge(A, B, cellsA.map(([cxx, cyy]) => [cxx * CELL + CELL / 2, cyy * CELL + CELL / 2]),
                    hw ? 116 : 88, hw ? 'highway' : 'street');
        }
    }

    // Paint curve corridors on the mask (after orth tracing so the junction
    // scan only ever saw the orthogonal network)
    markCurve(vespucciPts, 46);
    markCurve(algonkinPts, 46);
    markCurve(ringPts, 52);

    // --- Curves -> graph (split at junction cells shared with the mask) ---
    const addCurveEdges = (pts, w, kind) => {
        // Cells occupied by this curve
        const myCells = new Set();
        for (const [fx, fy] of pts) {
            myCells.add(Math.floor(fx / CELL) + ',' + Math.floor(fy / CELL));
        }
        // Split indices: samples on orth-junction nodes or crossing other curves' cells
        const splits = [0];
        for (let i = 1; i < pts.length - 1; i++) {
            const cx = Math.floor(pts[i][0] / CELL), cy = Math.floor(pts[i][1] / CELL);
            if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
            const k = cx + ',' + cy;
            if (nodeIdByCell.has(k)) { splits.push(i); continue; }
            // curve-curve crossing: cell masked by another curve but not mine alone
            if (mask[cy][cx] && !myCells.has(k)) continue; // own corridor
            let crossOther = false;
            if ((kind !== 'beltway') || true) {
                // check against other curves via their sample proximity
                for (const other of [vespucciPts, algonkinPts, ringPts]) {
                    if (other === pts) continue;
                    for (let j = 0; j < other.length; j += 2) {
                        if (Math.hypot(other[j][0] - pts[i][0], other[j][1] - pts[i][1]) < 55) { crossOther = true; break; }
                    }
                    if (crossOther) break;
                }
            }
            if (crossOther) splits.push(i);
        }
        splits.push(pts.length - 1);
        const uniq = [...new Set(splits)].sort((a, b) => a - b);
        for (let s = 0; s < uniq.length - 1; s++) {
            const i0 = uniq[s], i1 = uniq[s + 1];
            if (i1 - i0 < 3) continue;
            const sub = pts.slice(i0, i1 + 1);
            const [sx, sy] = sub[0], [ex, ey] = sub[sub.length - 1];
            const findNear = (x, y) => nodes.find(n => Math.hypot(n.x - x, n.y - y) < 60);
            let A = findNear(sx, sy);
            if (!A) { A = { id: nodes.length, x: sx, y: sy, deg: 0 }; nodes.push(A); }
            let B = findNear(ex, ey);
            if (!B) { B = { id: nodes.length, x: ex, y: ey, deg: 0 }; nodes.push(B); }
            if (A.id === B.id) continue;
            addEdge(A, B, sub.map(p => [p[0], p[1]]), w, kind);
        }
    };
    addCurveEdges(vespucciPts, 92, 'boulevard');
    addCurveEdges(algonkinPts, 92, 'boulevard');
    addCurveEdges(ringPts, 104, 'beltway');

    // --- POI AVENUES inserted later (after safety net prep) ---

    // --- POI AVENUES: every destination gets a road that visibly goes somewhere ---
    const nearestNodeTo = (x, y, maxD) => {
        let best = null, bd = maxD * maxD;
        for (const n of nodes) {
            const d = (n.x - x) ** 2 + (n.y - y) ** 2;
            if (d < bd) { bd = d; best = n; }
        }
        return best;
    };
    // Gather destination nodes: landmark spots + fixed anchors
    const poiNodes = [];
    const poiNames = [];
    const addPOI = (name, wx, wy) => {
        let n = nearestNodeTo(wx, wy, 340);
        if (!n || (n.deg === 0 && poiNodes.some(p => p.node === n))) {
            // floating node: stub-link it to the network
            const near = nearestNodeTo(wx, wy, Infinity);
            const stub = [[wx, wy], [near.x, near.y]];
            const nn = { id: nodes.length, x: wx, y: wy, deg: 0 };
            nodes.push(nn);
            addEdge(nn, near, stub, 88, 'street');
            n = nn;
        }
        poiNodes.push(n);
        poiNames.push(name);
    };
    for (const lp of landmarkPOIs) addPOI(lp.name, lp.wx, lp.wy);
    addPOI("Airport", 74.5 * CELL, 57 * CELL);
    addPOI("Stadium Gate", 13.5 * CELL, 57 * CELL);
    addPOI("Salty's Pier", 87 * CELL, 46.5 * CELL);
    addPOI("Marina", 89.5 * CELL, 22 * CELL);
    addPOI("Columbus Plaza", 44.5 * CELL, 41 * CELL);
    addPOI("Downtown Heart", 70 * CELL, 14 * CELL);

    // Curved avenue builder between two nodes
    const linkAvenue = (A, B) => {
        if (!A || !B || A.id === B.id) return null;
        if (edges.some(e => (e.a === A.id && e.b === B.id) || (e.a === B.id && e.b === A.id))) return null;
        const d = Math.hypot(A.x - B.x, A.y - B.y);
        if (d < 140) return null;
        const pxn = -(B.y - A.y) / d, pyn = (B.x - A.x) / d;
        const off = (rand() - 0.5) * d * 0.34;   // gentle intentional bend
        const cxp = (A.x + B.x) / 2 + pxn * off;
        const cyp = (A.y + B.y) / 2 + pyn * off;
        const pts = [];
        const segs = Math.max(8, Math.ceil(d / 44));
        for (let s = 0; s <= segs; s++) {
            const t = s / segs, it = 1 - t;
            pts.push([it * it * A.x + 2 * it * t * cxp + t * t * B.x,
                      it * it * A.y + 2 * it * t * cyp + t * t * B.y]);
        }
        const e = addEdge(A, B, pts, 92, 'boulevard');
        if (e) e.poi = true;
        return e;
    };

    // Prim's MST over POI positions -> coherent skeleton where every road has purpose
    let poiLinks = 0;
    {
        const linked = new Set([poiNodes[0].id]);
        const remaining = poiNodes.slice(1);
        while (remaining.length > 0) {
            let bi = -1, bn = null, bd = Infinity;
            for (const cand of remaining) {
                for (const lid of linked) {
                    const L = nodes[lid];
                    const d = Math.hypot(L.x - cand.x, L.y - cand.y);
                    if (d < bd) { bd = d; bi = remaining.indexOf(cand); bn = L; }
                }
            }
            const target = remaining.splice(bi, 1)[0];
            linkAvenue(bn, target);
            linked.add(target.id);
            poiLinks++;
        }
        // A few loop-closing chords so routes can cycle, not just tree-branch
        let chords = 0, tries = 0;
        while (chords < 4 && tries++ < 60) {
            const A = poiNodes[randi(0, poiNodes.length - 1)];
            const B = poiNodes[randi(0, poiNodes.length - 1)];
            if (!A || !B || A.id === B.id) continue;
            const d = Math.hypot(A.x - B.x, A.y - B.y);
            if (d < 900 || d > 2600) continue;
            if (linkAvenue(A, B)) chords++;
        }
        poiLinks += chords;
    }

    // --- Safety net: connect any leftover separate components ---
    {
        const adj = new Map();
        for (const e of edges) {
            if (!adj.has(e.a)) adj.set(e.a, []);
            if (!adj.has(e.b)) adj.set(e.b, []);
            adj.get(e.a).push(e.b);
            adj.get(e.b).push(e.a);
        }
        const comp = new Map();
        let cid = 0;
        for (const n of nodes) {
            if (comp.has(n.id) || n.deg === 0) continue;
            const q = [n.id];
            comp.set(n.id, cid);
            while (q.length) {
                const cur = q.pop();
                for (const nb of (adj.get(cur) || [])) {
                    if (!comp.has(nb)) { comp.set(nb, cid); q.push(nb); }
                }
            }
            cid++;
        }
        // connect component groups sequentially with straight links
        const byComp = new Map();
        for (const n of nodes) {
            if (n.deg === 0) continue;
            const c = comp.get(n.id);
            if (!byComp.has(c)) byComp.set(c, []);
            byComp.get(c).push(n);
        }
        const groups = [...byComp.values()];
        for (let g = 1; g < groups.length; g++) {
            let bestA = null, bestB = null, bd = Infinity;
            for (const na of groups[g - 1]) for (const nb of groups[g]) {
                const d = Math.hypot(na.x - nb.x, na.y - nb.y);
                if (d < bd) { bd = d; bestA = na; bestB = nb; }
            }
            if (bestA && bestB) addEdge(bestA, bestB, [[bestA.x, bestA.y], [bestB.x, bestB.y]], 88, 'street');
        }
    }

    // Drop degree-0 nodes
    const liveNodes = nodes.filter(n => n.deg > 0);

    // ============ 7. CLEAR BUILDINGS OFF ROAD CORRIDORS ============
    // Any grid cell whose center lies within the corridor of an edge loses its building.
    const corridorClear = (pts, halfW) => {
        for (let i = 0; i < pts.length - 1; i++) {
            const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
            const minX = Math.min(x1, x2) - halfW - CELL, maxX = Math.max(x1, x2) + halfW + CELL;
            const minY = Math.min(y1, y2) - halfW - CELL, maxY = Math.max(y1, y2) + halfW + CELL;
            const cx0 = Math.max(1, Math.floor(minX / CELL)), cx1 = Math.min(cols - 2, Math.floor(maxX / CELL));
            const cy0 = Math.max(1, Math.floor(minY / CELL)), cy1 = Math.min(rows - 2, Math.floor(maxY / CELL));
            const dx = x2 - x1, dy = y2 - y1;
            const segLen2 = dx * dx + dy * dy || 1;
            for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
                const px = cx * CELL + CELL / 2, py = cy * CELL + CELL / 2;
                let t = ((px - x1) * dx + (py - y1) * dy) / segLen2;
                t = Math.max(0, Math.min(1, t));
                const qx = x1 + dx * t, qy = y1 + dy * t;
                const d2 = (px - qx) ** 2 + (py - qy) ** 2;
                // Wide clearance: building corners can reach ~60px past their
                // cell center, so clear well beyond the carriageway edge.
                if (d2 < (halfW + 96) ** 2) {
                    const tok = grid[cy][cx];
                    if (tok === 'B' || REPLACEABLE.indexOf(tok) !== -1) grid[cy][cx] = 'YARD';
                }
            }
        }
    };
    for (const e of edges) corridorClear(e.pts, e.w / 2);

    // ============ 8. PIER, MARINA & ISLANDS ============
    for (let x = 88; x <= 96; x++) grid[46][x] = 'PIER';
    for (let y = 45; y <= 47; y++) for (let x = 95; x <= 96; x++) grid[y][x] = 'PIER';
    for (let y = 23; y <= 26; y++) for (let x = 88; x <= 90; x++) grid[y][x] = 'E_DOCK';
    for (let x = 88; x <= 89; x++) grid[22][x] = 'E_DOCK';
    for (let y = 10; y <= 13; y++) for (let x = 92; x <= 96; x++) grid[y][x] = 'SAND';
    for (let y = 10; y <= 13; y++) grid[y][91] = 'W_COAST';
    for (let y = 61; y <= 64; y++) for (let x = 91; x <= 94; x++) grid[y][x] = 'SAND';
    for (let y = 61; y <= 64; y++) grid[y][90] = 'W_COAST';

    // ============ 9. AIRPORT & STADIUM ============
    for (let y = 55; y <= 58; y++) for (let x = 76; x <= 85; x++) grid[y][x] = 'B_AIR';
    grid[56][77] = 'TERMINAL';
    grid[58][76] = 'HANGAR';
    grid[58][79] = 'HANGAR';
    grid[58][83] = 'HANGAR';
    for (let x = 76; x <= 84; x++) {
        grid[60][x] = 'APRON';
        grid[61][x] = 'RUNWAY';
        grid[62][x] = 'RUNWAY';
        grid[63][x] = 'RUNWAY';
    }
    grid[62][76] = 'RAMP_E';
    grid[57][10] = 'STADIUM';
    for (let y = 55; y <= 59; y++) for (let x = 8; x <= 12; x++) {
        if (grid[y][x] !== 'STADIUM') grid[y][x] = 'STAD_FILL';
    }

    // ============ 11. STUNT RAMPS on bridge approaches ============
    const RAMP_PROPS = [];
    {
        const bridgeEdges = edges.filter(e => e.bridge);
        for (let i = 0; i < Math.min(3, bridgeEdges.length); i++) {
            const e = bridgeEdges[i * Math.floor(bridgeEdges.length / Math.min(3, bridgeEdges.length))];
            const mid = e.pts[Math.floor(e.pts.length / 2)];
            const nxt = e.pts[Math.min(e.pts.length - 1, Math.floor(e.pts.length / 2) + 1)];
            RAMP_PROPS.push({ x: mid[0], y: mid[1], angle: Math.atan2(nxt[1] - mid[1], nxt[0] - mid[0]) });
        }
        RAMP_PROPS.push({ x: 50 * CELL, y: 70.5 * CELL, angle: 0 });
    }

    // ============ 12. ROUNDABOUTS (plaza nodes) ============
    const roundabouts = [];
    {
        const candidates = liveNodes.filter(n => n.deg >= 3);
        for (const n of candidates) {
            if (roundabouts.length >= 3) break;
            if (roundabouts.some(r => Math.hypot(r.x - n.x, r.y - n.y) < 3000)) continue;
            if (rand() < 0.5) roundabouts.push({ x: n.x, y: n.y, id: n.id });
        }
    }

    // ============ 13. WORLD BORDER ============
    for (let y = 0; y < rows; y++) {
        grid[y][0] = 'B_BORDER';
        grid[y][cols - 1] = 'W';
    }
    for (let x = 0; x < cols; x++) {
        grid[0][x] = 'B_BORDER';
        grid[rows - 1][x] = 'B_BORDER';
    }

    CITY_GRID = grid;

    return {
        nodes: liveNodes.map(n => ({ id: n.id, x: n.x, y: n.y, deg: n.deg })),
        edges: edges,
        ramps: RAMP_PROPS,
        roundabouts: roundabouts,
        poiLinks: poiLinks,
        pois: poiNames,
        curveNames: [
            { name: "Vespucci Boulevard", pts: vespucciPts },
            { name: "Algonkin Avenue", pts: algonkinPts },
            { name: "The Grand Circle", pts: ringPts }
        ]
    };
}

// Tokens kept for compatibility with world.js terrain parsing
const OPEN_TOKENS = ['YARD', 'GARDEN', 'E_DOCK', 'STAD_FILL'];

let CITY_GRID = [];
let ROAD_GRAPH = null;

function getDistrictNameAt(worldX, worldY) {
    const col = Math.floor(worldX / 96);
    const row = Math.floor(worldY / 96);
    const tile = CITY_GRID[row] ? CITY_GRID[row][col] : '';

    // Named curved roads: proximity check
    if (ROAD_GRAPH) {
        for (const cv of ROAD_GRAPH.curveNames) {
            for (let i = 0; i < cv.pts.length; i += 3) {
                if (Math.hypot(cv.pts[i][0] - worldX, cv.pts[i][1] - worldY) < 78) return cv.name;
            }
        }
    }

    if (row >= 9 && row <= 14 && col >= 90) return "Gull Island";
    if (row >= 60 && row <= 65 && col >= 89) return "Pelican Cay";
    if (row >= 44 && row <= 48 && col >= 87) return "Salty's Pier";

    if (col >= 86) {
        if (tile === 'SAND') return "Ocean Beach & Marina";
        return "Liberty Sound";
    }
    if (tile === 'W') return "The Liberty River";

    if (row >= 54 && row <= 64 && col >= 75 && col < 86) return "Liberty International Airport";
    if (row >= 54 && row <= 59 && col >= 7 && col <= 13) return "Liberty Bowl Stadium";
    if (row >= 39 && row <= 43 && col >= 42 && col <= 47) return "Columbus Plaza";
    if (tile === 'PARK' || tile === 'GARDEN' || tile === 'W_POND' ||
        (row >= 34 && row <= 52 && col >= 46 && col <= 68)) return "Central Park";

    const dDowntown = Math.sqrt((col - 73) ** 2 + (row - 17) ** 2);
    if (dDowntown < 17.5) return "Downtown Financial District";
    if (row <= 29 && col <= 42) return "Port Authority Docks";
    const dChinatown = Math.sqrt((col - 19) ** 2 + (row - 35) ** 2);
    if (dChinatown < 9.0) return "Chinatown & Red Light";
    if (row >= 42 && row <= 49 && col <= 31) return "Brownstone Row";
    if (row >= 39 && row <= 51 && col >= 58 && col <= 75) return "Little Italy";
    if (row >= 52) return "Sunrise Suburbs";
    return "Midtown Liberty";
}

const __city = generateCity();
const WORLD_DATA = (() => {
    let lines = [];
    for (let y = 0; y < ROWS; y++) lines.push(CITY_GRID[y].join(' '));
    return lines.join('\n');
})();
ROAD_GRAPH = __city;
