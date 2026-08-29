// node test-contacts.js  — checks the real Game.prototype.resolveContacts
const fs = require('fs');
const vm = require('vm');
global.window = {};
vm.runInThisContext(fs.readFileSync('Game.js', 'utf8') + '\n;globalThis.__Game = Game;');
const Game = globalThis.__Game;

function bike(x, y, vx, vy, isPlayer = false, air = 0) {
    return { x, y, vx, vy, air, isPlayer, angle: 0, forwardSpeed: vx, lateralSpeed: 0, syncVelocities() { this.forwardSpeed = this.vx * Math.cos(this.angle) + this.vy * Math.sin(this.angle); } };
}
function game(bikes, blocked = () => false) {
    return { bikes, world: { isBlocked: blocked }, onBikeEvent() { }, nudge: Game.prototype.nudge };
}
const near = (a, b) => Math.abs(a - b) < 1e-6;

// 1. head-on: both bounce back, separation resolved, HUD speed refreshed
let a = bike(0, 0, 200, 0), b = bike(14, 0, -200, 0, true);
Game.prototype.resolveContacts.call(game([a, b]));
console.assert(a.vx < 0 && b.vx > 0, 'head-on must separate', a.vx, b.vx);
console.assert(Math.hypot(b.x - a.x, b.y - a.y) > 21.9, 'overlap must clear', b.x - a.x);
console.assert(near(b.forwardSpeed, b.vx), 'forwardSpeed resynced', b.forwardSpeed);

// 2. rear-end: faster follower slows, target speeds up, no bounce-through
a = bike(0, 0, 250, 0); b = bike(18, 0, 60, 0, true);
Game.prototype.resolveContacts.call(game([a, b]));
console.assert(a.vx < 250 && b.vx > 60, 'momentum transfers', a.vx, b.vx);

// 3. wall side: the bike next to the wall is not shoved into it
a = bike(0, 0, 0, 100); b = bike(0, 12, 0, -100, true);
Game.prototype.resolveContacts.call(game([a, b], (_x, y) => y > 18));
console.assert(b.y <= 18, 'no shove into wall', b.y);

// 4. hopping over a rival: no contact while airborne
a = bike(0, 0, 200, 0, false, 30); b = bike(5, 0, 0, 0, true);
Game.prototype.resolveContacts.call(game([a, b]));
console.assert(a.vx === 200 && b.vx === 0 && b.x === 5, 'airborne passes over', a.vx, b.x);

// 5. side-by-side at equal speed: no jitter
a = bike(0, 0, 200, 0); b = bike(21, 0, 200, 0, true);
Game.prototype.resolveContacts.call(game([a, b]));
console.assert(a.vx === 200 && b.vx === 200, 'no phantom drag', a.vx, b.vx);
