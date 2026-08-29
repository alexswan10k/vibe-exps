// node test-ghost.js — checks the real Game.prototype ghost recording/playback
const fs = require("fs");
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
const vm = require("vm");
global.window = {};
global.requestAnimationFrame = () => {};
vm.runInThisContext(
    fs.readFileSync("MathUtils.js", "utf8") +
        "\n;globalThis.__MathUtils = MathUtils;",
);
vm.runInThisContext(
    fs.readFileSync("Game.js", "utf8") + "\n;globalThis.__Game = Game;",
);
const Game = globalThis.__Game;
const near = (a, b) => Math.abs(a - b) < 1e-6;

function player(state = "normal") {
    return { state, x: 10, y: 20, z: 3, angle: 1.5, lateralSpeed: 42 };
}
function recorder(raceTimer, p) {
    return { raceTimer, playerBike: p, ghostRec: [] };
}

// 1. recording stores the live pose keyed to race time
let r = recorder(4.5, player());
Game.prototype.recordGhost.call(r);
ck(
    r.ghostRec.length === 1 &&
        r.ghostRec[0].t === 4.5 &&
        r.ghostRec[0].x === 10,
    "records pose",
    r.ghostRec[0],
);

// 2. a wreck records nothing (ghost must not teleport through the crash)
r = recorder(5, player("crashed"));
Game.prototype.recordGhost.call(r);
ck(r.ghostRec.length === 0, "crashed not recorded");

// 3. saved samples become lap-relative and survive
const g = {
    ghostRec: [
        { t: 10, x: 1, y: 2, z: 0, angle: 0, lat: 0 },
        { t: 12, x: 3, y: 4, z: 0, angle: 0, lat: 0 },
    ],
    ghosts: {},
    track: { name: "T" },
    ghostIdx: 0,
    ghostBike: {},
};
Game.prototype.saveGhost.call(g, 10, 2);
ck(
    near(g.ghostData.samples[1].t, 2),
    "lap-relative time",
    g.ghostData.samples[1].t,
);
ck(g.ghosts.T === g.ghostData, "cached per track");

// playback over the saved lap
// 4. mid-interval interpolates position
ck(
    near(Game.prototype.ghostAt.call(g, 1).x, 2),
    "lerps x",
    Game.prototype.ghostAt.call(g, 1).x,
);

// 5. ahead of the ghost: no phantom rival
g.ghostIdx = 0;
ck(Game.prototype.ghostAt.call(g, 2.5) === null, "hidden when you are ahead");

// 6. new lap rewinds the read cursor instead of sticking at the end
g.ghostIdx = 1;
ck(
    near(Game.prototype.ghostAt.call(g, 0.25).x, 1.25),
    "cursor rewinds",
    g.ghostIdx,
);

// 7. heading is interpolated the short way around the circle
const wrap = {
    ghostData: {
        samples: [
            { t: 0, x: 0, y: 0, z: 0, angle: 3.0, lat: 0 },
            { t: 1, x: 0, y: 0, z: 0, angle: -3.0, lat: 0 },
        ],
    },
    ghostIdx: 0,
    ghostBike: {},
};
ck(
    Math.abs(Game.prototype.ghostAt.call(wrap, 0.5).angle) > 3.1,
    "angle takes the short path",
);

// 8. no ghost yet (first ever lap) draws nothing
ck(
    Game.prototype.ghostAt.call(
        { ghostData: null, ghostIdx: 0, ghostBike: {} },
        1,
    ) === null,
    "no ghost before first best lap",
);
