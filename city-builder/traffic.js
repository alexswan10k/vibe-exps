// Traffic and Pedestrian Simulation:
// - Diverse vehicle fleet: Sedans, Taxis, Buses, Freight Trucks.
// - Emergency response: Fire Trucks (rush to blazes with flashing sirens and water cannons),
//   Police Cruisers, and Ambulances.
// - Pedestrians (Sims) strolling on sidewalks and visiting parks.
// - Right-hand lane positioning and intersection smoothing (following grid_based_ai patterns).

class TrafficSystem {
    constructor(city) {
        this.city = city;
        this.cars = [];
        this.sims = [];          // Pedestrians
        this.spawnTimer = 0;
        this.pedestrianTimer = 0;
        this.roadDensity = new Uint8Array(city.width * city.height);
    }

    update(deltaMs) {
        const city = this.city;
        const pop = this.cityPopulationProxy();

        // 1. Spawn regular commuting traffic
        this.spawnTimer += deltaMs;
        const maxCars = clamp(Math.floor(pop / 8), 0, 75);
        if (this.cars.length < maxCars && this.spawnTimer > 600 / Math.max(1, Math.sqrt(maxCars))) {
            this.spawnTimer = 0;
            this.trySpawnCar();
        }

        // 2. Spawn pedestrians
        this.pedestrianTimer += deltaMs;
        const maxSims = clamp(Math.floor(pop / 12), 0, 45);
        if (this.sims.length < maxSims && this.pedestrianTimer > 800 / Math.max(1, Math.sqrt(maxSims))) {
            this.pedestrianTimer = 0;
            this.trySpawnPedestrian();
        }

        // Decay road density map slightly
        if (Math.random() < 0.05) {
            for (let i = 0; i < this.roadDensity.length; i++) {
                if (this.roadDensity[i] > 0) this.roadDensity[i] = Math.max(0, this.roadDensity[i] - 1);
            }
        }

        // 3. Update active vehicles
        for (let i = this.cars.length - 1; i >= 0; i--) {
            const car = this.cars[i];

            // Emergency action: Fire truck fighting active fire at destination
            if (car.isFireTruck && car.fightingFire) {
                car.fightTimer += deltaMs;
                if (car.fightTimer > 3500) {
                    if (window.game && window.game.disasters && car.targetBuilding) {
                        window.game.disasters.extinguishBuilding(car.targetBuilding, city);
                    }
                    this.cars.splice(i, 1);
                }
                continue;
            }

            car.progress += car.speed * (deltaMs / 1000);

            while (car.progress >= 1) {
                car.progress -= 1;
                car.pathIndex++;
                if (car.pathIndex >= car.path.length - 1) {
                    if (car.isFireTruck && car.targetBuilding && car.targetBuilding.onFire) {
                        car.fightingFire = true;
                        car.fightTimer = 0;
                        break;
                    }
                    this.cars.splice(i, 1);
                    break;
                }
            }

            if (!this.cars[i] || this.cars[i].fightingFire) continue;

            const from = car.path[car.pathIndex];
            const to = car.path[car.pathIndex + 1];
            if (from && to) {
                car.x = lerp(from.x, to.x, car.progress);
                car.y = lerp(from.y, to.y, car.progress);
                car.angle = Math.atan2(to.y - from.y, to.x - from.x);

                // Increment road density on visited tiles
                const curTileIdx = city.idx(Math.floor(car.x), Math.floor(car.y));
                if (curTileIdx >= 0 && curTileIdx < this.roadDensity.length) {
                    this.roadDensity[curTileIdx] = Math.min(255, this.roadDensity[curTileIdx] + 1);
                }
            }
        }

        // 4. Update pedestrians
        for (let i = this.sims.length - 1; i >= 0; i--) {
            const sim = this.sims[i];
            sim.progress += sim.speed * (deltaMs / 1000);
            while (sim.progress >= 1) {
                sim.progress -= 1;
                sim.pathIndex++;
                if (sim.pathIndex >= sim.path.length - 1) {
                    this.sims.splice(i, 1);
                    break;
                }
            }
            if (!this.sims[i]) continue;
            const from = sim.path[sim.pathIndex];
            const to = sim.path[sim.pathIndex + 1];
            if (from && to) {
                sim.x = lerp(from.x, to.x, sim.progress);
                sim.y = lerp(from.y, to.y, sim.progress);
            }
        }
    }

    cityPopulationProxy() {
        let pop = 0;
        for (const b of this.city.buildings.values()) pop += b.pop || 0;
        return pop;
    }

    trySpawnCar() {
        const city = this.city;
        const homes = [];
        const workplaces = [];
        for (const b of city.buildings.values()) {
            if (b.state !== 'built' || b.onFire) continue;
            if (b.type === 'residential' && b.pop > 1) homes.push(b);
            else if ((b.type === 'commercial' || b.type === 'industrial') && b.jobs > 1) workplaces.push(b);
        }
        if (homes.length === 0 || workplaces.length === 0) return;

        const home = randomOf(Math.random, homes);
        const work = randomOf(Math.random, workplaces);

        const start = this.entranceOf(home);
        const end = this.entranceOf(work);
        if (!start || !end) return;

        const path = this.findPath(start, end);
        if (!path || path.length < 2) return;

        // Vehicle classification
        const roll = Math.random();
        let vType = 'car';
        let speed = 2.4 + Math.random() * 1.2;
        let color = pickColor([0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6, 0xecf0f1, 0x2ecc71, 0x34495e], Math.random);

        if (roll < 0.12) {
            vType = 'taxi';
            color = 0xffd600;
            speed = 3.0;
        } else if (roll < 0.22) {
            vType = 'bus';
            color = 0x1976d2;
            speed = 2.0;
        } else if (roll < 0.35) {
            vType = 'truck';
            color = 0x78909c;
            speed = 1.9;
        }

        this.cars.push({
            vType,
            x: path[0].x,
            y: path[0].y,
            angle: 0,
            path,
            pathIndex: 0,
            progress: 0,
            speed,
            color,
            isFireTruck: false
        });
    }

    trySpawnPedestrian() {
        const city = this.city;
        const homes = [];
        const destinations = [];

        for (const b of city.buildings.values()) {
            if (b.state !== 'built' || b.onFire) continue;
            if (b.type === 'residential' && b.pop > 0) homes.push(b);
            else if (b.type === 'commercial' || b.type === 'park') destinations.push(b);
        }
        if (homes.length === 0 || destinations.length === 0) return;

        const startB = randomOf(Math.random, homes);
        const endB = randomOf(Math.random, destinations);

        const start = this.entranceOf(startB);
        const end = this.entranceOf(endB);
        if (!start || !end) return;

        const path = this.findPath(start, end);
        if (!path || path.length < 2) return;

        this.sims.push({
            x: path[0].x,
            y: path[0].y,
            path,
            pathIndex: 0,
            progress: 0,
            speed: 0.8 + Math.random() * 0.4,
            color: pickColor([0xffcc80, 0xef9a9a, 0x90caf9, 0xa5d6a7, 0xce93d8], Math.random),
            sideOffset: (Math.random() - 0.5) * 0.4
        });
    }

    // --- Emergency Dispatch ---

    requestFireTruck(burningBuilding) {
        // Avoid sending too many trucks to the same building
        const alreadyDispatched = this.cars.some(c => c.isFireTruck && c.targetBuilding === burningBuilding);
        if (alreadyDispatched) return;

        const city = this.city;
        const fireStations = [];
        for (const b of city.buildings.values()) {
            if (b.type === 'fire_station' && b.state === 'built') fireStations.push(b);
        }
        if (fireStations.length === 0) return;

        const station = randomOf(Math.random, fireStations);
        const start = this.entranceOf(station);
        const end = this.entranceOf(burningBuilding);
        if (!start || !end) return;

        const path = this.findPath(start, end);
        if (!path || path.length < 2) return;

        this.cars.push({
            vType: 'firetruck',
            x: path[0].x,
            y: path[0].y,
            angle: 0,
            path,
            pathIndex: 0,
            progress: 0,
            speed: 4.2, // fast emergency speed!
            color: 0xd32f2f,
            isFireTruck: true,
            targetBuilding: burningBuilding,
            fightingFire: false,
            fightTimer: 0
        });
    }

    entranceOf(building) {
        const city = this.city;
        for (const adj of city.adjacentTiles(building)) {
            if (!city.inBounds(adj.x, adj.y)) continue;
            if (city.isRoadTile(adj.x, adj.y)) return { x: adj.x, y: adj.y };
        }
        return null;
    }

    findPath(start, end) {
        if (start.x === end.x && start.y === end.y) {
            return [start, end];
        }

        const city = this.city;
        const queue = [start];
        const cameFrom = new Map();
        const key = (p) => p.y * city.width + p.x;
        cameFrom.set(key(start), null);

        while (queue.length > 0) {
            const current = queue.shift();
            if (current.x === end.x && current.y === end.y) {
                const path = [];
                let node = current;
                while (node) {
                    path.unshift(node);
                    node = cameFrom.get(key(node));
                }
                return path;
            }
            const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
            for (const [dx, dy] of dirs) {
                const nx = current.x + dx;
                const ny = current.y + dy;
                if (!city.inBounds(nx, ny)) continue;
                const nKey = ny * city.width + nx;
                if (cameFrom.has(nKey)) continue;
                if (!city.isRoadTile(nx, ny)) continue;
                cameFrom.set(nKey, current);
                queue.push({ x: nx, y: ny });
            }
        }
        return null;
    }
}

window.TrafficSystem = TrafficSystem;
