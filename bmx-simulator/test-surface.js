// node test-surface.js — wall grazes vs crashes, and banked corners steering the bike
const fs = require("fs");
const vm = require("vm");
global.window = {};
vm.runInThisContext(fs.readFileSync("MathUtils.js", "utf8"));
vm.runInThisContext(
    fs.readFileSync("Bike.js", "utf8") + "\n;globalThis.__Bike = Bike;",
);
const Bike = globalThis.__Bike;

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

// Wall face along x = 0, solid ground for x >= 0.
const wall = { isBlocked: (_x, _y) => _x >= 0, groundAt: () => 0 };

// Drive at the face with `deg` of incidence: 0 rides along the wall, 90 hits it square.
function hit(deg, frames = 40) {
    const a = Math.PI / 2 - (deg * Math.PI) / 180;
    const b = new Bike(-30, 0, a, "#f00");
    b.vx = Math.cos(a) * 220;
    b.vy = Math.sin(a) * 220;
    const ev = [];
    let grazes = 0;
    b.onEvent = (t, d) => {
        ev.push([t, d]);
        if (t === "scrape") grazes++;
    };
    // Pedal, like a rider would: otherwise coasting friction dominates the speed.
    for (let i = 0; i < frames; i++)
        b.update(1 / 60, { thrust: 1, turn: 0, hop: false }, wall, null);
    const scrape = ev.find((e) => e[0] === "scrape");
    return {
        crashed: b.state === "crashed",
        grazed: grazes > 0,
        grazes,
        power: scrape ? scrape[1].power : 0,
        free: !wall.isBlocked(b.x, b.y),
        aligned: Math.abs(MathUtils.angleDiff(b.angle, Math.PI / 2)) < 0.05,
        speed: Math.hypot(b.vx, b.vy),
    };
}

const graze20 = hit(20);
const graze30 = hit(30);
const solid45 = hit(45);
const headOn = hit(90);

ck(
    graze20.grazed && !graze20.crashed,
    "20 deg graze must bounce",
    graze20.crashed,
);
ck(
    graze30.grazed && !graze30.crashed,
    "30 deg graze must bounce",
    graze30.crashed,
);
ck(solid45.crashed, "45 deg must crash", solid45.crashed);
ck(headOn.crashed, "square hit must crash", headOn.crashed);
ck(graze20.free, "bounce pushes you out of the wall", graze20.free);
ck(graze20.aligned, "face puts you back along the wall", graze20.aligned);
ck(graze20.grazes <= 2, `one corner is one graze (${graze20.grazes})`);
ck(
    graze30.speed > 180,
    `graze keeps the run alive (${graze30.speed.toFixed(0)})`,
);
ck(headOn.speed < 60, `crash kills the run (${headOn.speed.toFixed(0)})`);
ck(graze20.power > 40, "graze reports impact for fx", graze20.power);

// Bank: ground rising toward +y, bike flat out, no steering input.
const rising = { isBlocked: () => false, groundAt: (_x, y) => y * 0.5 };
function roll(frames) {
    const b = new Bike(0, 0, 0, "#f00");
    b.vx = 220;
    b.vy = 0;
    for (let i = 0; i < frames; i++)
        b.update(1 / 60, { thrust: 0, turn: 0, hop: false }, rising, null);
    return b;
}

const banked = roll(30);
const oneFrame = roll(1);
ck(
    oneFrame.crossSlope > 0.48,
    `cross-slope read across the bike (${oneFrame.crossSlope.toFixed(3)})`,
);
ck(
    banked.angle < -0.2,
    `bank steers toward the low side (${banked.angle.toFixed(3)})`,
);
ck(banked.vy < -5, `bank carries the bike downhill (${banked.vy.toFixed(1)})`);

const noseDown = new Bike(0, 0, -Math.PI / 2, "#f00"); // already pointing downstairs
noseDown.vx = 0;
noseDown.vy = -220;
for (let i = 0; i < 30; i++)
    noseDown.update(1 / 60, { thrust: 0, turn: 0, hop: false }, rising, null);
ck(
    Math.abs(noseDown.angle + Math.PI / 2) < 0.05,
    `pointing downstairs holds its line (${noseDown.angle.toFixed(3)})`,
);
