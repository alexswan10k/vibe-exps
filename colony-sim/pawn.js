/**
 * Pawn: a colonist with needs, a tiny state machine and job execution logic.
 *
 * States: idle -> moving (following a path) -> working / sleeping / eating.
 * Job execution is expressed as small phase strings so a job can span
 * several trips (e.g. haul: walk to stack, pick up, walk to storage, drop).
 */
const PAWN_NAMES = ['Ada', 'Bram', 'Cleo', 'Dara', 'Edwin', 'Faye', 'Gus', 'Hana'];
const PAWN_COLORS = ['#f39c12', '#e74c3c', '#9b59b6', '#3498db', '#1abc9c', '#d35400', '#fd79a8', '#a3ae22'];

class Pawn {
    constructor(x, y, name, colorIndex) {
        this.x = x;
        this.y = y;
        this.name = name;
        this.color = PAWN_COLORS[colorIndex % PAWN_COLORS.length];
        this.hunger = 100;
        this.sleep = 100;
        this.health = 100;

        this.priorities = { chop: 2, mine: 2, grow: 2, construct: 2, craft: 2, haul: 3 };

        this.state = 'idle';       // idle | moving | working | sleeping | eating
        this.path = null;
        this.pathIdx = 0;
        this.job = null;
        this.phase = null;
        this.workLeft = 0;
        this.workTotal = 0;
        this.carry = null;         // {type, qty}
        this.bed = null;
        this.wanderCooldown = 0;
        this.eatTargetStack = null;
        this.facing = 1;
    }

    // ---- main update --------------------------------------------------------

    update(game) {
        this.game = game;
        // Needs
        this.hunger = Math.max(0, this.hunger - CONFIG.hungerRate);
        if (this.state !== 'sleeping') {
            this.sleep = Math.max(0, this.sleep - CONFIG.sleepRate);
        }
        if (this.hunger <= 0) {
            this.health -= CONFIG.healthDrainStarving;
            if (this.health <= 0) { game.killPawn(this, 'starved'); return; }
        } else if (this.hunger > 45 && this.sleep > 30 && this.health < 100) {
            this.health = Math.min(100, this.health + CONFIG.healthRegen);
        }

        // Emergency: grab food before collapsing
        if (this.hunger <= 10 && this.state !== 'eating') {
            const foodStack = this.nearestFoodStack(game);
            if (foodStack && (this.job || this.eatTargetStack !== foodStack)) {
                this.abandonJob();
                this.startEatErrand(game, foodStack);
            }
        }

        switch (this.state) {
            case 'idle': this.decide(game); break;
            case 'moving': this.tickMove(game); break;
            case 'working': this.tickWorking(game); break;
            case 'sleeping': this.tickSleeping(game); break;
            case 'eating': this.tickEating(game); break;
        }

        if (this.wanderCooldown > 0) this.wanderCooldown--;
    }

    // ---- decisions -----------------------------------------------------------

    decide(game) {
        // Finish any delivery we're still holding (e.g. after an interrupted job)
        if (this.carry) { this.startDeliverCarried(game); return; }
        // Sleep pressure
        const light = game.lightLevel();
        if (this.sleep < 16 || (light < CONFIG.nightLightLevel && this.sleep < 58)) {
            this.startSleep(game);
            return;
        }
        // Hungry with no carried food: fetch-and-eat errand
        if (this.hunger < 32 && !(this.carry && (this.carry.type === 'food' || this.carry.type === 'meal'))) {
            const stack = this.nearestFoodStack(game);
            if (stack) { this.startEatErrand(game, stack); return; }
        }
        // Pick up a real job
        const options = game.jobs.availableJobs(this);
        let best = null, bestScore = Infinity;
        for (const opt of options) {
            const d = dist(this.x, this.y, opt.job.x, opt.job.y);
            const score = opt.priority * 400 + d;
            if (score < bestScore) { bestScore = score; best = opt; }
        }
        if (best) this.takeJob(game, game.jobs.claim(best.job, this));
        else if (this.wanderCooldown === 0) this.startWander(game);
    }

    /** Walk whatever we're carrying to a stockpile cell. */
    startDeliverCarried(game) {
        const dest = game.jobs.findStockpileCell(this.carry.type);
        if (!dest) {
            game.world.dropItems(Math.round(this.x), Math.round(this.y), this.carry.type, this.carry.qty);
            this.carry = null;
            this.wanderCooldown = 90;
            return;
        }
        const path = findPath((x, y) => game.world.isWalkable(x, y),
            Math.round(this.x), Math.round(this.y), dest.x, dest.y);
        if (!path) {
            game.world.dropItems(Math.round(this.x), Math.round(this.y), this.carry.type, this.carry.qty);
            this.carry = null;
            return;
        }
        this.phase = 'selfdeliver';
        this.setPath(path.length > 1 ? path.slice(1) : []);
        if (this.path.length === 0) { this.dropCarried(game); this.resetToIdle(); }
        else this.state = 'moving';
    }

    startWander(game) {
        const spot = game.world.randomWalkableNear(
            Math.round(this.x), Math.round(this.y), CONFIG.wanderRadius);
        this.wanderCooldown = 120 + Math.floor(Math.random() * 240);
        if (!spot) return;
        const path = findPath((x, y) => game.world.isWalkable(x, y),
            Math.round(this.x), Math.round(this.y), spot.x, spot.y);
        if (path && path.length > 1) {
            this.setPath(path.slice(1)); // skip standing tile
            this.phase = 'wander';
            this.state = 'moving';
        }
    }

    startSleep(game) {
        // Prefer an owned/free bed
        let bed = game.world.buildingList.find(b =>
            b.type === 'bed' && b.built &&
            (b.owner === this.name || b.owner === null));
        if (bed) {
            bed.owner = this.name;
            this.bed = bed;
            const path = findPath((x, y) => game.world.isWalkable(x, y),
                Math.round(this.x), Math.round(this.y), bed.x, bed.y);
            if (path) {
                this.setPath(path.length > 1 ? path.slice(1) : []);
                this.phase = 'sleep_goto';
                this.state = this.path && this.path.length ? 'moving' : 'sleeping';
                return;
            }
        }
        this.bed = null;
        this.state = 'sleeping'; // sleep where we stand
    }

    startEatErrand(game, stack) {
        this.eatTargetStack = stack;
        const path = findPath((x, y) => game.world.isWalkable(x, y),
            Math.round(this.x), Math.round(this.y), stack.x, stack.y);
        if (!path) { this.eatTargetStack = null; this.wanderCooldown = 60; return; }
        this.setPath(path.length > 1 ? path.slice(1) : []);
        this.phase = 'eat_goto';
        this.state = this.path && this.path.length ? 'moving' : 'arrived';
        if (this.state === 'arrived') this.arriveAtErrand(game);
    }

    nearestFoodStack(game) {
        let best = null, bestD = Infinity;
        for (const s of game.world.stackList) {
            if (s.type !== 'food' && s.type !== 'meal') continue;
            const d = dist(this.x, this.y, s.x, s.y);
            if (d < bestD) { bestD = d; best = s; }
        }
        return best;
    }

    // ---- job setup ------------------------------------------------------------

    takeJob(game, job) {
        this.job = job;
        this.state = 'moving';
        const w = game.world;
        switch (job.type) {
            case 'chop_tree':
            case 'mine_deposit':
            case 'harvest_bush':
            case 'harvest_crop':
                this.phase = 'work_goto';
                this.workLeft = job.target.hp || CONFIG.work.harvest;
                this.workTotal = this.workLeft;
                break;
            case 'mine_rock':
                this.phase = 'work_goto';
                this.workLeft = CONFIG.work.mineRock;
                this.workTotal = this.workLeft;
                break;
            case 'plant_crop':
                this.phase = 'work_goto';
                this.workLeft = CONFIG.work.plant;
                this.workTotal = this.workLeft;
                break;
            case 'build_site': {
                const b = job.data.building;
                this.phase = 'work_goto';
                this.workLeft = CONFIG.work.construct * (1 - b.progress / CONFIG.work.construct);
                this.workTotal = CONFIG.work.construct;
                break;
            }
            case 'craft_item': {
                const table = this.nearestTable(game);
                if (!table) {
                    game.log(`${this.name} wants to craft but there is no crafting table.`, 'warn');
                    game.jobs.cancel(job);
                    this.resetToIdle();
                    return;
                }
                const recipe = CONFIG.recipes[job.data.item];
                const picks = game.jobs.findIngredients(recipe);
                if (!picks) {
                    // Ingredients vanished between post & claim; try again later.
                    game.jobs.release(job);
                    game.jobs.unreachableUntil.set('craft_item:' + tileKey(table.x, table.y), game.tick + 300);
                    this.resetToIdle();
                    return;
                }
                job.data.table = table;
                break;
            }
            case 'haul_item':
                this.phase = 'haul_pickup';
                break;
            case 'deliver_material':
                this.phase = 'haul_pickup';
                break;
            default:
                game.jobs.complete(job);
                this.resetToIdle();
        }

        if (!this.job) return;

        const tx = job.type === 'craft_item' ? job.data.table.x : job.x;
        const ty = job.type === 'craft_item' ? job.data.table.y : job.y;
        const path = findPath((x, y) => game.world.isWalkable(x, y),
            Math.round(this.x), Math.round(this.y), tx, ty);
        if (!path) {
            game.jobs.markUnreachable(job);
            game.jobs.release(job);
            this.resetToIdle();
            return;
        }
        // Standing still is valid for many jobs (already adjacent).
        this.setPath(path.length > 1 ? path.slice(1) : []);
        if (this.path.length === 0) this.arrivedForJob(game);
    }

    nearestTable(game) {
        let best = null, bestD = Infinity;
        for (const b of game.world.buildingList) {
            if (b.type !== 'table' || !b.built) continue;
            const d = dist(this.x, this.y, b.x, b.y);
            if (d < bestD) { bestD = d; best = b; }
        }
        return best;
    }

    resetToIdle() {
        this.job = null;
        this.phase = null;
        this.path = null;
        this.state = 'idle';
    }

    abandonJob() {
        if (this.job) this.game.jobs.release(this.job);
        this.resetToIdle();
    }

    setPath(nodes) {
        this.path = nodes;
        this.pathIdx = 0;
    }

    // ---- movement ---------------------------------------------------------------

    tickMove(game) {
        if (!this.path || this.pathIdx >= this.path.length) {
            this.arriveCommon(game);
            return;
        }
        const node = this.path[this.pathIdx];
        // Mid-path obstacle? (someone built a wall across the route)
        if (!game.world.isWalkable(node.x, node.y)) {
            const path = findPath((x, y) => game.world.isWalkable(x, y),
                Math.round(this.x), Math.round(this.y), node.x, node.y);
            if (path) {
                this.setPath(path.slice(1));
            } else {
                this.onRouteBlocked(game);
                return;
            }
        }
        const speed = CONFIG.pawnSpeed / 60;
        const target = this.path[this.pathIdx];
        const dx = target.x + 0.5 - this.x;
        const dy = target.y + 0.5 - this.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (Math.abs(dx) > 0.01) this.facing = dx > 0 ? 1 : -1;
        if (d <= speed) {
            this.x = target.x + 0.5;
            this.y = target.y + 0.5;
            this.pathIdx++;
            if (this.pathIdx >= this.path.length) this.arriveCommon(game);
        } else {
            this.x += (dx / d) * speed;
            this.y += (dy / d) * speed;
        }
    }

    onRouteBlocked(game) {
        if (this.phase === 'wander' || this.phase === 'eat_goto') {
            this.resetToIdle();
            this.wanderCooldown = 90;
            return;
        }
        if (this.job) {
            game.jobs.markUnreachable(this.job);
            game.jobs.release(this.job);
        }
        this.resetToIdle();
    }

    arriveCommon(game) {
        if (this.phase === 'wander') { this.resetToIdle(); return; }
        if (this.phase === 'selfdeliver') {
            this.dropCarried(game);
            this.resetToIdle();
            return;
        }
        if (this.phase === 'eat_goto') { this.arriveAtErrand(game); return; }
        if (this.phase === 'sleep_goto') { this.state = 'sleeping'; return; }
        this.arrivedForJob(game);
    }

    arriveAtErrand(game) {
        const s = this.eatTargetStack;
        this.eatTargetStack = null;
        if (!s || !game.world.stackList.includes(s) || (s.type !== 'food' && s.type !== 'meal')) {
            this.resetToIdle();
            return;
        }
        // Take one unit
        s.qty -= 1;
        if (s.qty <= 0) game.world.removeStack(s);
        this.carriedFood = s.type === 'meal' ? CONFIG.hungerRestoreMeal : CONFIG.hungerRestoreRaw;
        this.state = 'eating';
        this.workLeft = CONFIG.eatPauseTicks;
    }

    // ---- working ------------------------------------------------------------------

    arrivedForJob(game) {
        const job = this.job;
        if (!job) { this.resetToIdle(); return; }
        const w = game.world;

        // Validate that the thing we came for is still there & we are close enough.
        const adjOk = chebyshev(Math.round(this.x), Math.round(this.y), job.x, job.y) <= 1 ||
            (Math.round(this.x) === job.x && Math.round(this.y) === job.y);

        switch (job.type) {
            case 'haul_item':
                if (this.phase === 'haul_pickup') {
                    const stack = job.target;
                    if (!stack || !w.stackList.includes(stack)) { this.finishJob(game, false); return; }
                    if (!(Math.round(this.x) === stack.x && Math.round(this.y) === stack.y) &&
                        chebyshev(Math.round(this.x), Math.round(this.y), stack.x, stack.y) > 1) {
                        game.jobs.markUnreachable(job); this.finishJob(game, false); return;
                    }
                    // pick up
                    this.carry = { type: stack.type, qty: stack.qty };
                    w.removeStack(stack);
                    const dest = game.jobs.findStockpileCell(stack.type);
                    if (!dest) { // nowhere to put it: put it back
                        w.dropItems(stack.x, stack.y, this.carry.type, this.carry.qty);
                        this.carry = null;
                        this.finishJob(game, false);
                        return;
                    }
                    job.data.dest = dest;
                    this.phase = 'haul_drop';
                    const path = findPath((x, y) => w.isWalkable(x, y),
                        Math.round(this.x), Math.round(this.y), dest.x, dest.y);
                    if (!path) {
                        w.dropItems(Math.round(this.x), Math.round(this.y), this.carry.type, this.carry.qty);
                        this.carry = null;
                        this.finishJob(game, false);
                        return;
                    }
                    this.setPath(path.length > 1 ? path.slice(1) : []);
                    this.state = this.path.length ? 'moving' : 'working';
                    if (this.state === 'working') this.dropCarried(game);
                    return;
                } else {
                    this.dropCarried(game);
                    this.finishJob(game, true);
                    return;
                }
            case 'deliver_material': {
                if (this.phase === 'haul_pickup') {
                    const b = job.data.building;
                    const mat = job.data.material;
                    if (!b || !b.blueprint) { this.finishJob(game, false); return; }
                    // Grab material: prefer stacks already on/near the site, else any stack.
                    const source = this.findMaterialSource(game, mat, b);
                    if (!source) { this.finishJob(game, false); return; }
                    const want = b.cost[mat] - (b.delivered[mat] || 0);
                    const take = Math.min(want, source.qty);
                    this.carry = { type: mat, qty: take };
                    source.qty -= take;
                    if (source.qty <= 0) w.removeStack(source);
                    job.data.taken = take;
                    this.phase = 'haul_drop';
                    const path = findPath((x, y) => w.isWalkable(x, y),
                        Math.round(this.x), Math.round(this.y), b.x, b.y);
                    if (!path) {
                        w.dropItems(Math.round(this.x), Math.round(this.y), this.carry.type, this.carry.qty);
                        this.carry = null;
                        this.finishJob(game, false);
                        return;
                    }
                    this.setPath(path.length > 1 ? path.slice(1) : []);
                    this.state = this.path.length ? 'moving' : 'working';
                    if (this.state === 'working') this.deliverCarriedToSite(game);
                    return;
                } else {
                    this.deliverCarriedToSite(game);
                    this.finishJob(game, true);
                    return;
                }
            }
            default:
                if (!adjOk) { game.jobs.markUnreachable(job); this.finishJob(game, false); return; }
                this.state = 'working';
        }
    }

    findMaterialSource(game, mat, building) {
        const w = game.world;
        // Stacks already sitting on the site count first
        const here = w.stacksAt(building.x, building.y);
        if (here) {
            const s = here.find(s => s.type === mat);
            if (s) return s;
        }
        let best = null, bestD = Infinity;
        for (const stack of w.stackList) {
            if (stack.type !== mat) continue;
            const d = dist(this.x, this.y, stack.x, stack.y);
            if (d < bestD) { bestD = d; best = stack; }
        }
        return best;
    }

    deliverCarriedToSite(game) {
        const job = this.job;
        if (!job || this.phase !== 'haul_drop') return;
        const b = job.data.building;
        if (!b || !b.blueprint || !this.carry) {
            if (this.carry) game.world.dropItems(Math.round(this.x), Math.round(this.y), this.carry.type, this.carry.qty);
            this.carry = null;
            return;
        }
        const room = b.cost[job.data.material] - (b.delivered[job.data.material] || 0);
        const put = Math.min(room, this.carry.qty);
        b.delivered[job.data.material] = (b.delivered[job.data.material] || 0) + put;
        this.carry.qty -= put;
        const extra = this.carry.qty;
        this.carry = null;
        if (extra > 0) game.world.dropItems(b.x, b.y, job.data.material, extra);
    }

    dropCarried(game) {
        if (!this.carry) return;
        const dest = this.job && this.job.data.dest;
        const x = dest ? dest.x : Math.round(this.x);
        const y = dest ? dest.y : Math.round(this.y);
        game.world.dropItems(x, y, this.carry.type, this.carry.qty);
        this.carry = null;
    }

    finishJob(game, completed) {
        if (this.job) {
            if (completed) game.jobs.complete(this.job);
            else game.jobs.release(this.job);
        }
        this.resetToIdle();
        this.taskCooldown = 20;
        this.wanderCooldown = Math.max(this.wanderCooldown || 0, 12);
    }

    tickWorking(game) {
        if (!this.job) { this.resetToIdle(); return; }
        const w = game.world;
        const job = this.job;

        // Validate target still exists
        switch (job.type) {
            case 'chop_tree': if (!w.trees.get(tileKey(job.x, job.y))) { this.finishJob(game, false); return; } break;
            case 'mine_deposit': if (!w.deposits.get(tileKey(job.x, job.y))) { this.finishJob(game, false); return; } break;
            case 'mine_rock': if (w.tileAt(job.x, job.y) !== w.TILES.ROCK) { this.finishJob(game, false); return; } break;
            case 'harvest_bush': if (!w.bushes.get(tileKey(job.x, job.y))) { this.finishJob(game, false); return; } break;
            case 'harvest_crop': if (!w.crops.get(tileKey(job.x, job.y))) { this.finishJob(game, false); return; } break;
            case 'plant_crop': if (w.crops.has(tileKey(job.x, job.y))) { this.finishJob(game, false); return; } break;
            case 'build_site': {
                const b = job.data.building;
                if (!b || !b.blueprint || !w.buildingList.includes(b)) { this.finishJob(game, false); return; }
                break;
            }
            case 'craft_item': break; // validated below
        }

        const rate = game.toolsBuffActive() ? CONFIG.toolWorkBonus : 1;
        this.workLeft -= rate;

        if (this.workLeft <= 0) this.completeWork(game);
    }

    completeWork(game) {
        const w = game.world;
        const job = this.job;
        switch (job.type) {
            case 'chop_tree': {
                const tree = w.trees.get(tileKey(job.x, job.y));
                if (tree) { w.removeTree(tree); w.dropItems(tree.x, tree.y, 'wood', 4); }
                break;
            }
            case 'mine_deposit': {
                const dep = w.deposits.get(tileKey(job.x, job.y));
                if (dep) { w.removeDeposit(dep); w.dropItems(dep.x, dep.y, 'iron', dep.richness); }
                break;
            }
            case 'mine_rock': {
                if (w.tileAt(job.x, job.y) === w.TILES.ROCK) {
                    w.setTile(job.x, job.y, w.TILES.DIRT);
                    w.groundCanvas = null; // force ground cache rebuild
                    w.dropItems(job.x, job.y, 'stone', 2);
                }
                break;
            }
            case 'harvest_bush': {
                const bush = w.bushes.get(tileKey(job.x, job.y));
                if (bush) { w.removeBush(bush); w.dropItems(bush.x, bush.y, 'food', bush.yield); }
                break;
            }
            case 'harvest_crop': {
                const crop = w.crops.get(tileKey(job.x, job.y));
                if (crop) { w.removeCrop(crop); w.dropItems(crop.x, crop.y, 'food', 5); }
                break;
            }
            case 'plant_crop': {
                if (!w.crops.has(tileKey(job.x, job.y))) w.addCrop(new Crop(job.x, job.y));
                break;
            }
            case 'build_site': {
                const b = job.data.building;
                if (b) {
                    b.blueprint = false;
                    b.progress = CONFIG.work.construct;
                    game.onBuildingCompleted(b);
                }
                break;
            }
            case 'craft_item': {
                const itemName = job.data.item;
                const recipe = CONFIG.recipes[itemName];
                const picks = game.jobs.findIngredients(recipe);
                if (!picks) { this.finishJob(game, false); return; }
                game.jobs.consumePicks(picks);
                const table = job.data.table;
                if (!table) { this.finishJob(game, false); return; }
                game.world.dropItems(table.x, table.y, itemName, recipe.out || 1);
                break;
            }
        }
        this.finishJob(game, true);
    }

    // ---- sleeping & eating -------------------------------------------------------

    tickSleeping(game) {
        const mult = this.bed && this.bed.built &&
            Math.round(this.x) === this.bed.x && Math.round(this.y) === this.bed.y
            ? CONFIG.bedSleepMult : CONFIG.groundSleepMult;
        this.sleep = Math.min(100, this.sleep + CONFIG.sleepRate * mult * 4.2);
        if (this.sleep >= 100 || (game.lightLevel() > 0.5 && this.sleep > 65)) {
            this.bed = null;
            this.state = 'idle';
        }
    }

    tickEating(game) {
        this.workLeft--;
        if (this.workLeft <= 0) {
            this.hunger = Math.min(100, this.hunger + (this.carriedFood || CONFIG.hungerRestoreRaw));
            this.carriedFood = null;
            this.state = 'idle';
        }
    }

    /** Human readable status for UI. */
    statusText() {
        switch (this.state) {
            case 'sleeping': return this.bed ? 'Sleeping (bed)' : 'Sleeping (ground)';
            case 'eating': return 'Eating';
            case 'working': return this.job ? this.describeJob() : 'Working';
            case 'moving': return this.job ? this.describeJob() : (this.phase === 'eat_goto' ? 'Getting food' : 'Walking');
            default: return 'Idle';
        }
    }

    describeJob() {
        const labels = {
            chop_tree: 'Chopping tree', mine_deposit: 'Mining iron', mine_rock: 'Mining rock',
            harvest_bush: 'Gathering berries', harvest_crop: 'Harvesting crops',
            plant_crop: 'Planting', haul_item: 'Hauling', deliver_material: 'Delivering materials',
            build_site: 'Constructing', craft_item: 'Crafting'
        };
        return labels[this.job.type] || this.job.type;
    }
}

if (typeof module !== 'undefined') module.exports = { Pawn };
