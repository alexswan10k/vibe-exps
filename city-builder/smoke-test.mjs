/**
 * Headless Smoke Test for City Builder / SimCity Clone (Node.js VM Sandbox).
 * Tests all 16 game modules and simulates full DOM startup of `new Game()`.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const DIR = new URL('.', import.meta.url).pathname;
const ALL_FILES = [
    'utils.js',
    'config.js',
    'terrain.js',
    'building-types.js',
    'city.js',
    'services.js',
    'economy.js',
    'disasters.js',
    'audio.js',
    'traffic.js',
    'development.js',
    'renderer.js',
    'input.js',
    'ui.js',
    'game.js'
];

// Mock minimal DOM for headless verification
function createMockElement(tag, id = '') {
    const classList = new Set();
    const children = [];
    const listeners = {};
    const dataset = {};
    const style = {};

    const el = {
        tagName: tag.toUpperCase(),
        id,
        dataset,
        style,
        width: 800,
        height: 600,
        clientWidth: 800,
        clientHeight: 600,
        innerHTML: '',
        textContent: '',
        classList: {
            add: (c) => classList.add(c),
            remove: (c) => classList.delete(c),
            toggle: (c, force) => {
                if (force === true) classList.add(c);
                else if (force === false) classList.delete(c);
                else if (classList.has(c)) classList.delete(c);
                else classList.add(c);
            },
            contains: (c) => classList.has(c)
        },
        appendChild: (child) => { children.push(child); return child; },
        removeChild: (child) => {
            const idx = children.indexOf(child);
            if (idx >= 0) children.splice(idx, 1);
            return child;
        },
        prepend: (child) => { children.unshift(child); },
        children,
        get lastChild() { return children[children.length - 1]; },
        addEventListener: (event, handler) => {
            listeners[event] = listeners[event] || [];
            listeners[event].push(handler);
        },
        removeEventListener: (event, handler) => {
            if (!listeners[event]) return;
            const idx = listeners[event].indexOf(handler);
            if (idx >= 0) listeners[event].splice(idx, 1);
        },
        querySelectorAll: (sel) => [],
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
        getContext: (type) => ({
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 1,
            fillRect: () => {},
            strokeRect: () => {},
            clearRect: () => {}
        })
    };
    return el;
}

const domElements = {
    'hud': createMockElement('header', 'hud'),
    'hud-date': createMockElement('span', 'hud-date'),
    'hud-money': createMockElement('span', 'hud-money'),
    'hud-net': createMockElement('span', 'hud-net'),
    'hud-pop': createMockElement('span', 'hud-pop'),
    'hud-milestone': createMockElement('span', 'hud-milestone'),
    'hud-jobs': createMockElement('span', 'hud-jobs'),
    'hud-happy': createMockElement('span', 'hud-happy'),
    'demand-res': createMockElement('div', 'demand-res'),
    'demand-com': createMockElement('div', 'demand-com'),
    'demand-ind': createMockElement('div', 'demand-ind'),
    'overlay-picker': createMockElement('div', 'overlay-picker'),
    'btn-budget': createMockElement('button', 'btn-budget'),
    'btn-disasters': createMockElement('button', 'btn-disasters'),
    'btn-lighting': createMockElement('button', 'btn-lighting'),
    'btn-audio': createMockElement('button', 'btn-audio'),
    'btn-pause': createMockElement('button', 'btn-pause'),
    'btn-speed-down': createMockElement('button', 'btn-speed-down'),
    'btn-speed-up': createMockElement('button', 'btn-speed-up'),
    'speed-label': createMockElement('span', 'speed-label'),
    'news-ticker': createMockElement('div', 'news-ticker'),
    'ticker-text': createMockElement('span', 'ticker-text'),
    'pixi-canvas': createMockElement('div', 'pixi-canvas'),
    'minimap-canvas': createMockElement('canvas', 'minimap-canvas'),
    'info-content': createMockElement('div', 'info-content'),
    'city-vitals': createMockElement('div', 'city-vitals'),
    'notifications': createMockElement('div', 'notifications'),
    'btn-save': createMockElement('button', 'btn-save'),
    'btn-load': createMockElement('button', 'btn-load'),
    'btn-reset': createMockElement('button', 'btn-reset'),
    'toolbar': createMockElement('div', 'toolbar'),
    'budget-modal': createMockElement('div', 'budget-modal'),
    'btn-close-budget': createMockElement('button', 'btn-close-budget'),
    'budget-body': createMockElement('div', 'budget-body'),
    'disaster-modal': createMockElement('div', 'disaster-modal'),
    'btn-close-disaster': createMockElement('button', 'btn-close-disaster'),
    'disaster-fire': createMockElement('button', 'disaster-fire'),
    'disaster-meteor': createMockElement('button', 'disaster-meteor'),
    'disaster-tornado': createMockElement('button', 'disaster-tornado'),
    'boot-error': createMockElement('div', 'boot-error')
};

// Mock PixiJS Application & Containers
const mockPIXI = {
    Application: class {
        constructor() {
            this.view = createMockElement('canvas');
            this.stage = new mockPIXI.Container();
            this.renderer = {
                width: 800,
                height: 600,
                resize: (w, h) => { this.renderer.width = w; this.renderer.height = h; }
            };
            this.ticker = { add: () => {}, remove: () => {} };
        }
        destroy() {}
    },
    Container: class {
        constructor() {
            this.children = [];
            this.position = { set: () => {} };
            this.scale = { set: () => {} };
        }
        addChild(...c) { this.children.push(...c); }
        removeChild(c) {}
    },
    Graphics: class {
        constructor() {
            this.position = { set: () => {} };
            this.scale = { set: () => {} };
        }
        clear() { return this; }
        beginFill() { return this; }
        endFill() { return this; }
        lineStyle() { return this; }
        drawRect() { return this; }
        drawRoundedRect() { return this; }
        drawCircle() { return this; }
        drawEllipse() { return this; }
        moveTo() { return this; }
        lineTo() { return this; }
        closePath() { return this; }
        destroy() {}
    }
};

const sandbox = {
    console,
    Math,
    JSON,
    Uint8Array,
    Int16Array,
    Set,
    Map,
    Array,
    PIXI: mockPIXI,
    performance: { now: () => Date.now() },
    document: {
        getElementById: (id) => domElements[id] || null,
        createElement: (tag) => createMockElement(tag),
        addEventListener: () => {}
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    setInterval: () => {},
    setTimeout: (cb) => { cb(); },
    ResizeObserver: class {
        observe() {}
        disconnect() {}
    }
};
sandbox.window = sandbox;
vm.createContext(sandbox);

console.log('Loading all 16 game modules into headless test sandbox...');
for (const f of ALL_FILES) {
    const code = fs.readFileSync(path.join(DIR, f), 'utf8');
    try {
        vm.runInContext(code, sandbox, { filename: f });
    } catch (err) {
        console.error(`✗ ${f} threw while loading:`, err.message);
        process.exit(1);
    }
}
console.log('✓ All 16 game modules loaded cleanly without syntax errors');

Object.assign(sandbox, vm.runInContext(
    '({ CONFIG, TERRAIN, INFRASTRUCTURE, ZONES, ZONE_KEYS, TOOLS, TOOL_GROUPS, zoneByTileId, maxLevel, levelDef, City, Building, Services, Economy, DisasterEngine, TrafficSystem, DevelopmentEngine, Game, makeRng, makeRngSeed, clamp, lerp })',
    sandbox
));

const { CONFIG, TERRAIN, INFRASTRUCTURE, ZONES, TOOLS, City, Services, Economy, DisasterEngine, TrafficSystem, DevelopmentEngine, Game } = sandbox;

let failures = 0;
function assert(cond, msg) {
    if (cond) console.log('  ✓', msg);
    else { console.error('  ✗ FAIL:', msg); failures++; }
}

// ----------------------------------------------------
// 1. Terrain & Bridge Placement
// ----------------------------------------------------
console.log('\n[1] Testing Terrain & River Bridging');
const city = new City(CONFIG.GRID_W, CONFIG.GRID_H, 12345);
assert(city.width === CONFIG.GRID_W && city.height === CONFIG.GRID_H, `city grid dimension matches config (${city.width}x${city.height})`);
assert(city.terrain.some(t => t === TERRAIN.WATER), 'terrain includes river/water');
assert(city.terrain.some(t => t === TERRAIN.GRASS), 'terrain includes grass');

let waterTile = null;
for (let y = 0; y < city.height && !waterTile; y++) {
    for (let x = 0; x < city.width && !waterTile; x++) {
        if (city.isWater(x, y)) waterTile = { x, y };
    }
}
assert(waterTile !== null, 'found water tile for bridge test');
if (waterTile) {
    const bridge = city.addBuilding('bridge', waterTile.x, waterTile.y);
    assert(city.isRoadTile(waterTile.x, waterTile.y), 'bridge is recognized as a road tile');
    assert(city.buildingAt(waterTile.x, waterTile.y) === bridge, 'bridge stored in tile index');
}

// ----------------------------------------------------
// 2. Multi-Service Grid & Radial Coverage
// ----------------------------------------------------
console.log('\n[2] Testing Multi-Service Grid & Radial Coverage');
const economy = new Economy();
economy.cityRef = city;
const services = new Services(city);

const midX = 20, midY = 20;
for (let i = 0; i <= 6; i++) {
    city.addBuilding('road', midX + i, midY);
}

const powerPlant = city.addBuilding('power', midX, midY - 2);
const waterTower = city.addBuilding('water', midX + 2, midY - 2);
const fireStation = city.addBuilding('fire_station', midX, midY + 1);
const policeStation = city.addBuilding('police_station', midX + 2, midY + 1);

services.update(economy);

assert(services.powerProd >= 280, `power production registered (${services.powerProd} MW)`);
assert(services.waterProd >= 220, `water production registered (${services.waterProd} units)`);
assert(services.fireCoverage[city.idx(midX, midY)] > 0, 'fire station covers road tile');
assert(services.policeCoverage[city.idx(midX, midY)] > 0, 'police station covers road tile');

// ----------------------------------------------------
// 3. Fast & Responsive 4-Tier Zoning & Upgrades
// ----------------------------------------------------
console.log('\n[3] Testing 4-Tier Zoning & Upgrades');
const dev = new DevelopmentEngine();

const resX = midX + 4, resY = midY - 1;
city.setZone(resX, resY, ZONES.residential.zoneId);

economy.demand.residential = 0.5;
services.update(economy);

dev.scanForNewDevelopments(city, economy, services);
const house = city.buildingAt(resX, resY);
assert(house !== null, 'house commenced construction immediately upon zoning near road');
assert(house.level === 1, 'starts at tier 1');

// Finish construction
house.state = 'built';
house.progressTicks = 0;
services.update(economy);

assert(house.state === 'built', 'house in built state');
assert(house.connected === true, 'house connected to road');
assert(house.powered === true, 'house powered');
assert(house.watered === true, 'house watered');

// Test population assignment
economy.population = 6;
economy.assignPopulation(city, services);
assert(house.pop > 0, `residents moved into house (${house.pop} residents)`);

// Test upgrade to Tier 2
economy.demand.residential = 0.8;
house.progressTicks = CONFIG.DEV.UPGRADE_TICKS;
dev.tryProgressUpgrade(house, city, economy, services);
assert(house.level === 2, 'house upgraded to tier 2 townhouse');

// ----------------------------------------------------
// 4. Disasters & Fire Response
// ----------------------------------------------------
console.log('\n[4] Testing Disasters & Firefighting System');
const disasters = new DisasterEngine();
const traffic = new TrafficSystem(city);

house.state = 'built';
disasters.igniteBuilding(house, city);
assert(house.onFire === true, 'house caught fire');
assert(disasters.activeFires.has(house), 'disaster engine tracks active fire');

traffic.requestFireTruck(house);
const fireTruck = traffic.cars.find(c => c.isFireTruck);
assert(fireTruck !== undefined, 'fire truck dispatched from fire station');

disasters.extinguishBuilding(house, city);
assert(house.onFire === false, 'fire extinguished');
assert(house.state === 'rubble', 'burnt structure left as rubble');

// ----------------------------------------------------
// 5. Budget, Tax Sliders & Ordinances
// ----------------------------------------------------
console.log('\n[5] Testing Economy, Tax Rates & Ordinances');
economy.taxRates.residential = 12;
economy.taxRates.commercial = 7;
economy.toggleOrdinance('transit');
assert(economy.ordinances.has('transit'), 'public transit ordinance enacted');

economy.collectMonthlyTaxes();
assert(economy.breakdown.ordinancesCost > 0, 'ordinance cost billed in budget');
assert(economy.breakdown.taxRes >= 0, 'tax collection processed');

// ----------------------------------------------------
// 6. Full Orchestrator: new Game() Startup Test
// ----------------------------------------------------
console.log('\n[6] Testing full browser startup via new Game()');
let gameInstance = null;
try {
    gameInstance = new Game();
    assert(gameInstance !== null, 'new Game() successfully instantiated');
    assert(gameInstance.city !== null, 'game city generated');
    assert(gameInstance.renderer !== null, 'game renderer initialized');
    assert(gameInstance.ui !== null, 'game UI initialized');
    assert(gameInstance.input !== null, 'game input manager initialized');
} catch (err) {
    console.error('  ✗ FAIL: new Game() threw:', err);
    failures++;
}

// Verdict
console.log(failures === 0 ? '\n===============================\n✓ ALL SMOKE TESTS PASSED (100%)\n===============================' : `\n❌ ${failures} FAILURE(S) DETECTED`);
process.exit(failures === 0 ? 0 : 1);
