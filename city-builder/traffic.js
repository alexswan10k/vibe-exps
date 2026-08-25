// Traffic: cars commute along roads between homes and workplaces.
// Purely decorative, but it makes the city feel alive and visualises
// whether your road network actually connects things.

class TrafficSystem {
    constructor(city) {
        this.city = city;
        this.cars = [];
        this.spawnTimer = 0;
    }

    update(deltaMs) {
        const city = this.city;

        // Spawn rate scales with population; capped for performance
        this.spawnTimer += deltaMs;
        const maxCars = clamp(Math.floor(this.cityPopulationProxy() / 10), 0, 60);
        if (this.cars.length < maxCars && this.spawnTimer > 700 / Math.max(1, Math.sqrt(maxCars))) {
            this.spawnTimer = 0;
            this.trySpawnCar();
        }

        for (let i = this.cars.length - 1; i >= 0; i--) {
            const car = this.cars[i];
            car.progress += car.speed * (deltaMs / 1000);

            while (car.progress >= 1) {
                car.progress -= 1;
                car.pathIndex++;
                if (car.pathIndex >= car.path.length - 1) {
                    this.cars.splice(i, 1);
                    break;
                }
            }

            if (!this.cars[i]) continue;
            const from = car.path[car.pathIndex];
            const to = car.path[car.pathIndex + 1];
            if (from && to) {
                car.x = lerp(from.x, to.x, car.progress);
                car.y = lerp(from.y, to.y, car.progress);
                car.angle = Math.atan2(to.y - from.y, to.x - from.x);
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
            if (b.state !== 'built') continue;
            if (b.type === 'residential' && b.pop > 2) homes.push(b);
            else if ((b.type === 'commercial' || b.type === 'industrial') && b.jobs > 2) workplaces.push(b);
        }
        if (homes.length === 0 || workplaces.length === 0) return;

        const home = randomOf(Math.random, homes);
        const work = randomOf(Math.random, workplaces);

        const start = this.entranceOf(home);
        const end = this.entranceOf(work);
        if (!start || !end) return;

        const path = this.findPath(start, end);
        if (!path || path.length < 2) return;

        this.cars.push({
            x: path[0].x,
            y: path[0].y,
            angle: 0,
            path,
            pathIndex: 0,
            progress: 0,
            speed: 2.5 + Math.random() * 1.5,
            color: pickColor([0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6, 0xecf0f1, 0x16a085], Math.random)
        });
    }

    // Road tile next to a building where cars enter/leave
    entranceOf(building) {
        const city = this.city;
        for (const adj of city.adjacentTiles(building)) {
            if (!city.inBounds(adj.x, adj.y)) continue;
            const b = city.buildingAt(adj.x, adj.y);
            if (b && b.type === 'road') return { x: adj.x, y: adj.y };
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
                const b = city.buildingAt(nx, ny);
                if (!(b && b.type === 'road')) continue;
                cameFrom.set(nKey, current);
                queue.push({ x: nx, y: ny });
            }
        }
        return null;
    }
}

window.TrafficSystem = TrafficSystem;
