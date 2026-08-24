/**
 * JobBoard: central place where all work is posted, claimed and completed.
 * Replaces the old ad-hoc task queue. Pawns claim jobs matching their
 * work priorities; the board auto-posts derived jobs (hauling, planting,
 * harvesting, blueprint deliveries).
 */
class JobBoard {
    constructor(game) {
        this.game = game;
        this.jobs = [];
        this.nextId = 1;
        this.craftQueue = []; // {recipe} requested via UI
        this._haulJobByStack = new Map();   // stackId -> jobId
        this._plantJobByCell = new Map();   // "x,y" -> jobId
        this._harvestJobByCrop = new Map(); // cropId -> jobId
        this._deliverJobsByBuilding = new Map(); // buildingId -> [jobIds]
        this._buildJobByBuilding = new Map();    // buildingId -> jobId
        this.unreachableUntil = new Map();  // "type:x,y" -> tick
    }

    /** Post a new job. Returns the job. */
    post(type, x, y, target = null, data = {}) {
        const job = {
            id: this.nextId++,
            type, x, y, target, data,
            claimedBy: null,
            createdTick: this.game.tick
        };
        this.jobs.push(job);
        return job;
    }

    cancel(job) {
        if (job.claimedBy) job.claimedBy.abandonJob();
        this._forget(job);
    }

    _forget(job) {
        const i = this.jobs.indexOf(job);
        if (i !== -1) this.jobs.splice(i, 1);
        if (job.type === 'haul_item' && job.target) this._haulJobByStack.delete(job.target.id);
        if (job.type === 'deliver_material' && job.data.building) {
            const list = this._deliverJobsByBuilding.get(job.data.building.id);
            if (list) {
                const j = list.indexOf(job.id);
                if (j !== -1) list.splice(j, 1);
            }
        }
        if (job.type === 'plant_crop') this._plantJobByCell.delete(tileKey(job.x, job.y));
        if (job.type === 'harvest_crop' && job.target) this._harvestJobByCrop.delete(job.target.id);
        if (job.type === 'build_site' && job.data.building) this._buildJobByBuilding.delete(job.data.building.id);
    }

    complete(job) {
        this._forget(job);
    }

    categoryOf(job) { return CONFIG.jobCategoryOf[job.type] || null; }

    /** Is a job of this type already posted at this tile? */
    hasJob(type, x, y) {
        return this.jobs.some(j => j.type === type && j.x === x && j.y === y);
    }

    /**
     * All unclaimed jobs a pawn could take, respecting priorities,
     * cooldowns on unreachable targets, and basic feasibility.
     */
    availableJobs(pawn) {
        const now = this.game.tick;
        const out = [];
        for (const job of this.jobs) {
            if (job.claimedBy) continue;
            const cat = this.categoryOf(job);
            if (!cat || !(pawn.priorities[cat] > 0)) continue;
            const cdKey = job.type + ':' + tileKey(job.x, job.y);
            const until = this.unreachableUntil.get(cdKey);
            if (until && now < until) continue;
            out.push({ job, priority: pawn.priorities[cat] });
        }
        return out;
    }

    claim(job, pawn) {
        job.claimedBy = pawn;
        return job;
    }

    release(job) {
        job.claimedBy = null;
    }

    // ---- derived job maintenance (called periodically by Game) -------------

    update() {
        this.ensureHaulJobs();
        this.ensurePlantAndHarvestJobs();
        this.ensureBuildJobs();
        this.ensureCraftJobs();
        this.validateJobs();
    }

    /** Haul loose stacks that lie outside every stockpile zone to storage. */
    ensureHaulJobs() {
        const zones = this.game.zones.filter(z => z.type === 'stockpile');
        for (const stack of [...this.game.world.stackList]) {
            if (this._haulJobByStack.has(stack.id)) continue;
            const inZone = zones.some(z => z.contains(stack.x, stack.y));
            if (inZone) continue;
            const job = this.post('haul_item', stack.x, stack.y, stack);
            this._haulJobByStack.set(stack.id, job.id);
        }
    }

    /** Plant crops on empty growing-zone cells; harvest mature ones. */
    ensurePlantAndHarvestJobs() {
        const growZones = this.game.zones.filter(z => z.type === 'growing');
        for (const zone of growZones) {
            for (const cell of zone.cells()) {
                const key = tileKey(cell.x, cell.y);
                if (this.game.world.crops.has(key)) continue;
                if (this._plantJobByCell.has(key)) continue;
                if (!this.game.world.isWalkable(cell.x, cell.y)) continue;
                const t = this.game.world.tileAt(cell.x, cell.y);
                if (t === this.game.world.TILES.WATER || t === this.game.world.TILES.SAND) continue;
                const job = this.post('plant_crop', cell.x, cell.y);
                this._plantJobByCell.set(key, job.id);
            }
        }
        for (const crop of [...this.game.world.cropList]) {
            if (!crop.mature) continue;
            if (this._harvestJobByCrop.has(crop.id)) continue;
            const job = this.post('harvest_crop', crop.x, crop.y, crop);
            this._harvestJobByCrop.set(crop.id, job.id);
        }
    }

    /** Deliver materials to blueprints; post construction when ready. */
    ensureBuildJobs() {
        for (const b of this.game.world.buildingList) {
            if (!b.blueprint) continue;
            let deliverList = this._deliverJobsByBuilding.get(b.id) || [];

            const missing = b.missingMaterials();
            for (const [mat, qty] of Object.entries(missing)) {
                // Count deliveries already queued for this material.
                const pending = this.jobs.filter(j =>
                    j.type === 'deliver_material' &&
                    j.data.building === b && j.data.material === mat
                ).reduce((sum, j) => sum + j.data.qty, 0);

                // Count stacks already sitting on the site.
                const onSite = (this.game.world.stacksAt(b.x, b.y) || [])
                    .filter(s => s.type === mat)
                    .reduce((sum, s) => sum + s.qty, 0);

                const shortfall = qty - pending - Math.min(onSite, qty - pending);
                if (shortfall <= 0) continue;
                const job = this.post('deliver_material', b.x, b.y, null, {
                    building: b, material: mat, qty: shortfall
                });
                deliverList.push(job.id);
            }
            this._deliverJobsByBuilding.set(b.id, deliverList);

            if (b.materialsComplete && !this._buildJobByBuilding.has(b.id)) {
                const job = this.post('build_site', b.x, b.y, b, { building: b });
                this._buildJobByBuilding.set(b.id, job.id);
            }
        }
    }

    /** Turn player craft requests into jobs (feasibility checked at claim time). */
    ensureCraftJobs() {
        while (this.craftQueue.length > 0) {
            const item = this.craftQueue.shift();
            if (!CONFIG.recipes[item]) continue;
            this.post('craft_item', -1, -1, null, { item });
        }
        // Point pending craft jobs at a table so pawns score them sensibly.
        const table = this.game.world.buildingList.find(b => b.type === 'table' && b.built);
        if (table) {
            for (const job of this.jobs) {
                if (job.type === 'craft_item') { job.x = table.x; job.y = table.y; }
            }
        }
    }

    /** Drop jobs whose target vanished or became invalid. */
    validateJobs() {
        for (const job of [...this.jobs]) {
            switch (job.type) {
                case 'chop_tree':
                    if (!this.game.world.trees.get(tileKey(job.x, job.y))) this.cancel(job);
                    break;
                case 'mine_deposit':
                    if (!this.game.world.deposits.get(tileKey(job.x, job.y))) this.cancel(job);
                    break;
                case 'mine_rock':
                    if (this.game.world.tileAt(job.x, job.y) !== this.game.world.TILES.ROCK) this.cancel(job);
                    break;
                case 'harvest_bush':
                    if (!this.game.world.bushes.get(tileKey(job.x, job.y))) this.cancel(job);
                    break;
                case 'harvest_crop':
                    if (!this.game.world.crops.get(tileKey(job.x, job.y))) this.cancel(job);
                    break;
                case 'haul_item':
                    // A claimed job whose stack was picked up is mid-delivery — leave it alone.
                    if (!job.claimedBy && !this.game.world.stackList.includes(job.target)) this.cancel(job);
                    break;
                case 'deliver_material': {
                    const b = job.data.building;
                    if (!b || !b.blueprint || !this.game.world.buildingList.includes(b)) this.cancel(job);
                    else if ((b.delivered[job.data.material] || 0) >= b.cost[job.data.material]) this.cancel(job);
                    break;
                }
                case 'build_site': {
                    const b = job.data.building;
                    if (!b || !b.blueprint || !this.game.world.buildingList.includes(b)) this.cancel(job);
                    break;
                }
                case 'craft_item': {
                    const hasTable = this.game.world.buildingList.some(b => b.type === 'table' && b.built);
                    const recipe = CONFIG.recipes[job.data.item];
                    if (!hasTable || !recipe || !this.findIngredients(recipe)) this.cancel(job);
                    break;
                }
            }
        }
    }

    // ---- resource queries used by crafting & hauling ------------------------

    /** Find a stockpile cell able to hold an item type. Returns {x,y} or null. */
    findStockpileCell(type) {
        const zones = this.game.zones.filter(z => z.type === 'stockpile');
        let emptyFallback = null;
        for (const zone of zones) {
            for (const cell of zone.cells()) {
                const here = this.game.world.stacksAt(cell.x, cell.y);
                if (!this.game.world.isWalkable(cell.x, cell.y)) continue;
                if (!here || here.length === 0) {
                    if (!emptyFallback) emptyFallback = cell;
                    continue;
                }
                if (here.length === 1 && here[0].type === type) {
                    if (here[0].qty < CONFIG.stockpileCellCap) return cell;
                }
            }
        }
        return emptyFallback;
    }

    /**
     * Locate ingredients for a recipe across ground/stockpiled stacks.
     * Returns [{stack, take}] or null if unavailable.
     */
    findIngredients(recipe) {
        const picks = [];
        for (const [mat, need] of Object.entries(recipe.inputs)) {
            let remaining = need;
            for (const stack of this.game.world.stackList) {
                if (stack.type !== mat || remaining <= 0) continue;
                const take = Math.min(remaining, stack.qty);
                picks.push({ stack, take });
                remaining -= take;
                if (remaining <= 0) break;
            }
            if (remaining > 0) return null;
        }
        return picks;
    }

    /** Consume ingredient stacks (call only after findIngredients returned picks). */
    consumePicks(picks) {
        for (const p of picks) {
            p.stack.qty -= p.take;
            if (p.stack.qty <= 0) this.game.world.removeStack(p.stack);
        }
    }

    markUnreachable(job, durationTicks = 600) {
        this.unreachableUntil.set(job.type + ':' + tileKey(job.x, job.y), this.game.tick + durationTicks);
    }
}

if (typeof module !== 'undefined') module.exports = { JobBoard };
