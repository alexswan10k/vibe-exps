// City model: terrain, zones, buildings, tile occupancy, and emergency states.
// Pure data + queries; simulation systems operate on it.

class Building {
    constructor(id, typeId, x, y, level = 1, variant = 0) {
        this.id = id;
        this.type = typeId;        // 'road' | 'bridge' | 'park' | 'power' | 'wind_turbine' | 'water' | 'water_pump' | 'fire_station' | 'police_station' | 'hospital' | 'school' | 'city_hall' | 'residential' | 'commercial' | 'industrial'
        this.x = x;
        this.y = y;
        this.level = level;        // zone buildings: 1..4
        this.variant = variant;    // visual variation seed
        this.state = 'built';      // 'construction' | 'built' | 'abandoned' | 'rubble'
        this.progressTicks = 0;    // toward construction/upgrade completion
        this.unservedTicks = 0;    // consecutive ticks without required services
        this.abandonedTicks = 0;
        this.pop = 0;
        this.jobs = 0;
        this.powered = true;
        this.watered = true;
        this.connected = true;

        // Emergency & public safety states
        this.onFire = false;
        this.fireTicks = 0;
        this.fireCoverage = false;
        this.policeCoverage = false;
        this.healthCoverage = false;
        this.educationCoverage = false;
    }
}

class City {
    constructor(width, height, seed) {
        this.width = width;
        this.height = height;
        this.seed = seed;

        const terrain = generateTerrain(width, height, seed);
        this.terrain = terrain.tiles;
        this.variants = terrain.variants;

        // Zone layer: 0 = unzoned, 1..3 = ZONES key index + 1
        this.zones = new Uint8Array(width * height);

        this.buildings = new Map();       // id -> Building
        this.tileIndex = new Map();       // tileKey -> building id

        this.nextBuildingId = 1;

        // Version counters let the renderer / systems cache work
        this.zonesVersion = 1;
        this.buildingsVersion = 1;
        this.servicesVersion = 1;
    }

    // --- Coordinates ---
    inBounds(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    idx(x, y) {
        return y * this.width + x;
    }

    terrainAt(x, y) {
        return this.inBounds(x, y) ? this.terrain[this.idx(x, y)] : TERRAIN.WATER;
    }

    isBuildable(x, y) {
        return this.inBounds(x, y) && this.terrain[this.idx(x, y)] !== TERRAIN.WATER;
    }

    isWater(x, y) {
        return this.inBounds(x, y) && this.terrain[this.idx(x, y)] === TERRAIN.WATER;
    }

    // --- Zones ---
    zoneAt(x, y) {
        return this.inBounds(x, y) ? this.zones[this.idx(x, y)] : 0;
    }

    setZone(x, y, zoneId) {
        if (!this.inBounds(x, y)) return false;
        const i = this.idx(x, y);
        if (this.zones[i] === zoneId) return false;
        this.zones[i] = zoneId;
        this.zonesVersion++;
        return true;
    }

    // --- Buildings ---
    buildingAt(x, y) {
        const id = this.tileIndex.get(this.idx(x, y));
        return id !== undefined ? this.buildings.get(id) : null;
    }

    allBuildings() {
        return Array.from(this.buildings.values());
    }

    canPlaceAt(footprintSize, x, y) {
        for (let dy = 0; dy < footprintSize; dy++) {
            for (let dx = 0; dx < footprintSize; dx++) {
                if (!this.isBuildable(x + dx, y + dy)) return false;
                if (this.buildingAt(x + dx, y + dy)) return false;
                if (this.zoneAt(x + dx, y + dy) !== 0) return false;
            }
        }
        return true;
    }

    addBuilding(typeId, x, y, level = 1, state = 'built') {
        const def = INFRASTRUCTURE[typeId] || { size: 1 };
        const variant = Math.floor(Math.abs(Math.sin(this.nextBuildingId * 12.9898)) * 4);
        const building = new Building(
            `b${this.nextBuildingId++}`,
            typeId, x, y, level, variant
        );
        building.state = state;
        this.buildings.set(building.id, building);

        for (let dy = 0; dy < def.size; dy++) {
            for (let dx = 0; dx < def.size; dx++) {
                this.tileIndex.set(this.idx(x + dx, y + dy), building.id);
            }
        }

        this.buildingsVersion++;
        this.servicesVersion++;
        return building;
    }

    removeBuilding(building) {
        const def = INFRASTRUCTURE[building.type] || { size: 1 };
        for (let dy = 0; dy < def.size; dy++) {
            for (let dx = 0; dx < def.size; dx++) {
                const key = this.idx(building.x + dx, building.y + dy);
                if (this.tileIndex.get(key) === building.id) {
                    this.tileIndex.delete(key);
                }
            }
        }
        this.buildings.delete(building.id);
        this.buildingsVersion++;
        this.servicesVersion++;
    }

    footprintOf(building) {
        const def = INFRASTRUCTURE[building.type];
        return def ? def.size : 1;
    }

    // Tiles orthogonally adjacent to a building's perimeter (its "frontage")
    adjacentTiles(building) {
        const size = this.footprintOf(building);
        const result = [];
        for (let dx = -1; dx <= size; dx++) {
            result.push({ x: building.x + dx, y: building.y - 1 });
            result.push({ x: building.x + dx, y: building.y + size });
        }
        for (let dy = 0; dy < size; dy++) {
            result.push({ x: building.x - 1, y: building.y + dy });
            result.push({ x: building.x + size, y: building.y + dy });
        }
        return result;
    }

    isRoadTile(x, y) {
        const b = this.buildingAt(x, y);
        return !!(b && (b.type === 'road' || b.type === 'bridge'));
    }

    clear() {
        this.zones.fill(0);
        this.buildings.clear();
        this.tileIndex.clear();
        this.zonesVersion++;
        this.buildingsVersion++;
        this.servicesVersion++;
    }

    // --- Serialization ---
    serialize() {
        const buildings = [];
        for (const b of this.buildings.values()) {
            buildings.push({
                t: b.type, x: b.x, y: b.y, l: b.level, v: b.variant,
                s: b.state, p: Math.round(b.pop), j: Math.round(b.jobs),
                f: b.onFire ? 1 : 0
            });
        }
        return {
            version: 3,
            width: this.width,
            height: this.height,
            seed: this.seed,
            terrain: Array.from(this.terrain),
            variants: Array.from(this.variants),
            zones: Array.from(this.zones),
            buildings,
            nextBuildingId: this.nextBuildingId
        };
    }

    static deserialize(data) {
        const city = new City(data.width, data.height, data.seed);
        city.terrain = Uint8Array.from(data.terrain);
        city.variants = Uint8Array.from(data.variants);
        city.zones = Uint8Array.from(data.zones);

        for (const d of data.buildings || []) {
            const b = city.addBuilding(d.t, d.x, d.y, d.l || 1, d.s || 'built');
            b.variant = d.v || 0;
            b.pop = d.p || 0;
            b.jobs = d.j || 0;
            b.onFire = d.f === 1;
        }
        city.nextBuildingId = data.nextBuildingId || (city.buildings.size + 1);
        return city;
    }
}

window.City = City;
window.Building = Building;
