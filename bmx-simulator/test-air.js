// node test-air.js — is the spin-for-boost loop actually earnable, and is it earned?
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

const flat = { isBlocked: () => false, groundAt: () => 0 };

// Launch with `vz` off a flat straight and hold (or not hold) the bars.
function flight({ vz, turn, frames = 30 }) {
    const b = new Bike(0, 0, 0, "#f00");
    const ev = [];
    b.onEvent = (t) => ev.push(t);
    for (let i = 0; i < frames; i++)
        b.update(1 / 60, { thrust: 1, turn: 0, hop: false }, flat, null);
    const rollSpeed = b.forwardSpeed;
    b.beginAir(vz);
    let before = rollSpeed;
    for (let i = 0; i < 240 && b.air > 0; i++) {
        before = b.forwardSpeed;
        b.update(1 / 60, { thrust: 0, turn, hop: false }, flat, null);
    }
    return {
        rollSpeed,
        spin: b.spinAccum,
        tricked: ev.includes("trick"),
        landed: ev.includes("land"),
        gain: b.forwardSpeed - before,
    };
}

const plainHop = flight({ vz: 330, turn: 1 }); // a hop from flat ground
const lip = flight({ vz: 430, turn: 1 }); // committed launch off a lip
const lazy = flight({ vz: 430, turn: 0 }); // same air, no whip

ck(
    plainHop.landed && lip.landed && lazy.landed,
    "all land",
    JSON.stringify([plainHop.landed, lip.landed, lazy.landed]),
);
ck(
    !plainHop.tricked,
    `casual hop must not pay out (${plainHop.spin.toFixed(2)} rad)`,
);
ck(
    lip.tricked,
    `a committed whip must earn the boost (${lip.spin.toFixed(2)} rad)`,
);
ck(lazy.spin < 0.01, "no bars, no spin", lazy.spin.toFixed(3));
ck(!lazy.tricked, "big air alone is not a trick");
ck(lip.rollSpeed < 250, `need speed headroom to see the boost (${lip.rollSpeed.toFixed(0)})`);
ck(lip.gain > 60, `landing boost applied (${lip.gain.toFixed(0)})`);
ck(
    Math.abs(lazy.gain) < 1,
    "unrewarded landing adds nothing",
    lazy.gain.toFixed(1),
);
