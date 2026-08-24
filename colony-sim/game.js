/**
 * Game: owns the world, pawns, job board and time. Runs a fixed-step
 * simulation inside requestAnimationFrame, with pause and speed controls.
 */
class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.world = new World(CONFIG.mapWidth, CONFIG.mapHeight, CONFIG.gen.seed);
        this.jobs = new JobBoard(this);
        this.pawns = [];
        this.zones = [];
        this.messages = [];
        this.hintsShown = new Set();

        this.camera = { x: 0, y: 0 };
        this.zoom = 1.2;

        this.tool = 'select';
        this.dragSelection = null;
        this.dragPreview = null;
        this.hoveredTile = null;
        this.selectedPawn = null;

        // Time
        const dayStartOffset = Math.floor(CONFIG.dayTicks * 0.3); // begin ~7am
        this.tick = dayStartOffset;
        this.day = 0;
        this.paused = false;
        this.speed = 1;

        // Simulation loop state
        this._tickBudget = 0;
        this._lastFrame = performance.now();

        this.renderer = new Renderer(this);
        this.input = new InputManager(this);
        this.ui = new UIManager(this);

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.initColony();

        requestAnimationFrame(t => this.frame(t));
    }

    // ---- setup -----------------------------------------------------------------

    resize() {
        this.canvas.width = this.canvas.clientWidth || 800;
        this.canvas.height = this.canvas.clientHeight || 600;
        this.clampCamera();
    }

    initColony() {
        const w = this.world;
        const cx = Math.floor(w.width / 2), cy = Math.floor(w.height / 2);

        // Find a walkable base spot near the centre
        let home = null;
        outer:
        for (let r = 0; r < 20; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (w.isWalkable(cx + dx, cy + dy)) { home = { x: cx + dx, y: cy + dy }; break outer; }
                }
            }
        }
        if (!home) home = { x: cx, y: cy };
        this.home = home;

        // Colonists
        const shuffledNames = [...PAWN_NAMES].sort(() => Math.random() - 0.5);
        for (let i = 0; i < CONFIG.startPawns; i++) {
            const spot = w.randomWalkableNear(home.x, home.y, 4) || home;
            this.pawns.push(new Pawn(spot.x + 0.5, spot.y + 0.5, shuffledNames[i], i));
        }

        // Starting supplies scattered near home
        let slot = 0;
        for (const [type, qty] of Object.entries(CONFIG.startSupplies)) {
            const spot = w.randomWalkableNear(home.x + slot, home.y + 1, 2) ||
                w.randomWalkableNear(home.x, home.y, 4) || home;
            w.dropItems(spot.x, spot.y, type, qty);
            slot++;
        }

        this.centerOn(home.x, home.y);

        this.log('Your colonists arrive with some supplies.', 'good');
        this.hintOnce('start',
            'Tip: place a Stockpile Zone, mark trees to chop, and build a crafting table.');
    }

    // ---- time ---------------------------------------------------------------------

    get dayNumber() { return Math.floor(this.tick / CONFIG.dayTicks); }

    timeOfDay() {
        return (this.tick % CONFIG.dayTicks) / CONFIG.dayTicks;
    }

    /** 0 at midnight -> 1 at noon, smooth. */
    lightLevel() {
        const t = this.timeOfDay();
        return clamp(-Math.cos(t * Math.PI * 2) * 0.62 + 0.5, 0, 1);
    }

    toolsBuffActive() {
        return this.world.countItemType('tools') > 0;
    }

    setSpeed(s) {
        this.speed = s;
        this.paused = false;
        this.ui.refreshSoon = true;
    }

    togglePause() {
        this.paused = !this.paused;
        this.ui.refreshSoon = true;
    }

    // ---- frame loop -------------------------------------------------------------------

    frame(nowMs) {
        const dtSec = clamp((nowMs - this._lastFrame) / 1000, 0, 0.1);
        this._lastFrame = nowMs;

        this.input.tickCamera(dtSec);

        if (!this.paused) {
            this._tickBudget += dtSec * this.speed * 60;
            let steps = Math.min(Math.floor(this._tickBudget), CONFIG.maxCatchUpTicks * this.speed);
            this._tickBudget -= steps;
            while (steps-- > 0) this.tickUpdate();
        }

        this.renderer.render(dtSec);
        this.ui.frame(nowMs);
        requestAnimationFrame(t => this.frame(t));
    }

    tickUpdate() {
        this.tick++;

        // Day rollover
        if (this.dayNumber !== this.day) {
            this.day = this.dayNumber;
            this.onNewDay();
        }

        // Crop growth
        for (const crop of this.world.cropList) {
            if (crop.growth < 100) crop.growth = Math.min(100, crop.growth + crop.growRate);
        }

        // Derived jobs periodically
        if (this.tick % 20 === 0) this.jobs.update();

        // Pawns
        let died = false;
        for (const p of [...this.pawns]) {
            if (!p.dead) {
                p.update(this);
                if (p.dead) died = true;
            }
        }
        if (died) this.pawns = this.pawns.filter(p => !p.dead);
    }

    onNewDay() {
        // Tools wear out
        if (this.world.countItemType('tools') > 0) {
            const stack = this.world.stackList.find(s => s.type === 'tools');
            stack.qty -= 1;
            if (stack.qty <= 0) this.world.removeStack(stack);
        }

        // Nightfall notice happens via clock; morning may bring company
        if (this.day >= 1 &&
            this.pawns.length > 0 &&
            this.pawns.length < CONFIG.maxPawns &&
            this.world.countItemType('food') >= CONFIG.migrantFoodRequirement &&
            Math.random() < 0.55) {
            this.spawnMigrant();
        }
    }

    spawnMigrant() {
        const w = this.world;
        for (let attempt = 0; attempt < 30; attempt++) {
            const side = Math.floor(Math.random() * 4);
            let x, y;
            if (side === 0) { x = Math.floor(Math.random() * w.width); y = 1; }
            else if (side === 1) { x = Math.floor(Math.random() * w.width); y = w.height - 2; }
            else if (side === 2) { x = 1; y = Math.floor(Math.random() * w.height); }
            else { x = w.width - 2; y = Math.floor(Math.random() * w.height); }
            const spot = w.randomWalkableNear(x, y, 4);
            if (!spot) continue;
            const name = PAWN_NAMES.find(n => !this.pawns.some(p => p.name === n)) || 'Wanderer';
            const pawn = new Pawn(spot.x + 0.5, spot.y + 0.5, name, this.pawns.length);
            this.pawns.push(pawn);
            this.log(`${name} joined the colony, drawn by your food stores.`, 'good');
            return;
        }
    }

    // ---- actions --------------------------------------------------------------------

    setTool(key) {
        this.tool = key;
        const toolDef = TOOLS[key];
        this.canvas.style.cursor = toolDef && toolDef.kind !== 'select' ? 'crosshair' : 'default';
        if (toolDef && toolDef.kind === 'craft') {
            this.requestCraft(toolDef.item);
            this.tool = 'select';
            this.canvas.style.cursor = 'default';
        }
        this.ui.refreshSoon = true;
    }

    requestCraft(item) {
        const hasTable = this.world.buildingList.some(b => b.type === 'table' && b.built);
        if (!hasTable) {
            this.log('Crafting needs a built crafting table first.', 'warn');
            this.hintOnce('table', 'Build → Crafting Table. It costs wood, delivered by haulers.');
            return;
        }
        this.jobs.craftQueue.push(item);
        this.jobs.update();
        const recipe = CONFIG.recipes[item];
        const inputs = Object.entries(recipe.inputs)
            .map(([m, q]) => `${q} ${CONFIG.items[m].name.toLowerCase()}`).join(', ');
        this.log(`Queued: ${CONFIG.items[item].name} (${inputs}).`);
    }

    killPawn(pawn, cause) {
        pawn.dead = true;
        if (pawn.carry) {
            this.world.dropItems(Math.round(pawn.x), Math.round(pawn.y), pawn.carry.type, pawn.carry.qty);
            pawn.carry = null;
        }
        if (pawn.job) this.jobs.release(pawn.job);
        this.log(`${pawn.name} has died of starvation.`, 'bad');
        if (this.pawns.every(p => p.dead)) {
            this.ui.showGameOver(this.day + 1);
        }
    }

    onBuildingCompleted(b) {
        if (b.type === 'table') this.hintOnce('firstTable', 'The table is ready — use Craft to cook meals or make tools.');
        if (b.type === 'bed') this.hintOnce('firstBed', 'Colonists will claim beds when they sleep.');
    }

    // ---- helpers -----------------------------------------------------------------------

    log(text, cls = '') {
        this.messages.push({
            text, cls,
            day: this.day + 1,
            time: formatClock(this.timeOfDay())
        });
        if (this.messages.length > 80) this.messages.shift();
        if (this.ui) this.ui._msgCount = null; // force refresh
    }

    hintOnce(key, text) {
        if (this.hintsShown.has(key)) return;
        this.hintsShown.add(key);
        this.log(text, 'hint');
    }

    centerOn(x, y) {
        const ts = CONFIG.tileSize * this.zoom;
        this.camera.x = x * ts - this.canvas.width / 2;
        this.camera.y = y * ts - this.canvas.height / 2;
        this.clampCamera();
    }

    clampCamera() {
        const ts = CONFIG.tileSize * this.zoom;
        const maxX = this.world.width * ts - this.canvas.width;
        const maxY = this.world.height * ts - this.canvas.height;
        this.camera.x = maxX <= 0 ? maxX / 2 : clamp(this.camera.x, 0, maxX);
        this.camera.y = maxY <= 0 ? maxY / 2 : clamp(this.camera.y, 0, maxY);
    }
}

if (typeof module !== 'undefined') module.exports = { Game };
