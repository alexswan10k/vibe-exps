// Traffic Manager Module
// Note: TrafficManager class is expected to be used globally

class TrafficManager {
    constructor(game) {
        this.game = game;
        this.cars = [];
        this.spawnTimer = 0;
        this.spawnInterval = 1000; // Spawn a car every 1 second
        this.maxCars = 50;
    }

    update(deltaTime) {
        // Spawn cars
        this.spawnTimer += deltaTime;
        if (this.spawnTimer >= this.spawnInterval && this.cars.length < this.maxCars) {
            this.spawnCar();
            this.spawnTimer = 0;
        }

        // Update existing cars
        for (let i = this.cars.length - 1; i >= 0; i--) {
            const car = this.cars[i];
            this.updateCar(car, deltaTime);
            
            // Remove cars that reached destination
            if (car.finished) {
                this.cars.splice(i, 1);
            }
        }
    }

    spawnCar() {
        const buildings = this.game.grid.getAllBuildings();
        const residential = buildings.filter(b => b.type.id === 'residential');
        const jobs = buildings.filter(b => b.type.id === 'commercial' || b.type.id === 'industrial');

        if (residential.length === 0 || jobs.length === 0) return;

        // Pick random start and end
        const startBuilding = residential[Math.floor(Math.random() * residential.length)];
        const endBuilding = jobs[Math.floor(Math.random() * jobs.length)];

        // Find path
        const path = this.findPath(startBuilding, endBuilding);
        if (path && path.length > 0) {
            this.cars.push({
                x: startBuilding.x,
                y: startBuilding.y,
                path: path,
                pathIndex: 0,
                progress: 0,
                speed: 4, // Tiles per second
                color: this.getRandomCarColor(),
                finished: false
            });
        }
    }

    findPath(start, end) {
        // Simple BFS for pathfinding on roads
        const queue = [{ x: start.x, y: start.y, path: [{ x: start.x, y: start.y }] }];
        const visited = new Set();
        visited.add(`${start.x},${start.y}`);

        while (queue.length > 0) {
            const current = queue.shift();
            
            if (current.x === end.x && current.y === end.y) {
                return current.path;
            }

            const directions = [
                { dx: 0, dy: -1 },
                { dx: 0, dy: 1 },
                { dx: -1, dy: 0 },
                { dx: 1, dy: 0 }
            ];

            for (const dir of directions) {
                const nextX = current.x + dir.dx;
                const nextY = current.y + dir.dy;
                const key = `${nextX},${nextY}`;

                if (visited.has(key)) continue;

                // Check bounds
                if (nextX < 0 || nextX >= this.game.config.gridWidth || nextY < 0 || nextY >= this.game.config.gridHeight) continue;

                // Check if passable (Road, or Start/End building)
                // We allow cars to drive ON the start and end buildings to enter/exit
                const building = this.game.grid.getBuildingAt(nextX, nextY);
                const isRoad = building && building.type.id === 'road';
                const isStart = nextX === start.x && nextY === start.y;
                const isEnd = nextX === end.x && nextY === end.y;

                if (isRoad || isStart || isEnd) {
                    visited.add(key);
                    queue.push({
                        x: nextX,
                        y: nextY,
                        path: [...current.path, { x: nextX, y: nextY }]
                    });
                }
            }
        }
        return null;
    }

    updateCar(car, deltaTime) {
        // Move car along path
        const speed = car.speed * (deltaTime / 1000);
        car.progress += speed;

        if (car.progress >= 1) {
            car.progress -= 1;
            car.pathIndex++;
            
            if (car.pathIndex >= car.path.length - 1) {
                car.finished = true;
                return;
            }
        }

        // Interpolate position
        const currentTile = car.path[car.pathIndex];
        const nextTile = car.path[car.pathIndex + 1];
        
        if (currentTile && nextTile) {
            car.x = currentTile.x + (nextTile.x - currentTile.x) * car.progress;
            car.y = currentTile.y + (nextTile.y - currentTile.y) * car.progress;
        }
    }

    getRandomCarColor() {
        const colors = [0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6, 0xecf0f1, 0x34495e];
        return colors[Math.floor(Math.random() * colors.length)];
    }
}
