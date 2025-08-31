// Player module

class Player {
    constructor(x, y, worldSize) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
        this.speed = 3;
        this.inCar = false;
        this.car = null;
        this.worldWidth = worldSize.width;
        this.worldHeight = worldSize.height;
    }

    update(keys, buildings) {
        if (this.inCar) {
            // Player is in car, movement handled by car
            return;
        }

        let dx = 0, dy = 0;

        if (keys['w'] || keys['arrowup']) dy -= this.speed;
        if (keys['s'] || keys['arrowdown']) dy += this.speed;
        if (keys['a'] || keys['arrowleft']) dx -= this.speed;
        if (keys['d'] || keys['arrowright']) dx += this.speed;

        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
            dx *= 0.707;
            dy *= 0.707;
        }

        let newX = this.x + dx;
        let newY = this.y + dy;

        // Check collision with buildings
        if (!this.isCollidingWithBuildings(newX, newY, buildings)) {
            this.x = newX;
            this.y = newY;
        }

        // Keep player in world bounds
        this.x = Math.max(0, Math.min(this.worldWidth - this.width, this.x));
        this.y = Math.max(0, Math.min(this.worldHeight - this.height, this.y));
    }

    isCollidingWithBuildings(x, y, buildings) {
        for (let building of buildings) {
            if (x < building.x + building.width && x + this.width > building.x &&
                y < building.y + building.height && y + this.height > building.y) {
                return true;
            }
        }
        return false;
    }

    enterCar(cars) {
        for (let car of cars) {
            if (Math.abs(this.x + this.width / 2 - (car.x + car.width / 2)) < 50 &&
                Math.abs(this.y + this.height / 2 - (car.y + car.height / 2)) < 50) {
                this.inCar = true;
                this.car = car;
                car.isPlayerCar = true; // Take control of this car
                return true;
            }
        }
        return false;
    }

    exitCar() {
        if (this.car) {
            this.car.isPlayerCar = false; // Return control to AI
        }
        this.inCar = false;
        this.car = null;
    }

    draw(ctx, cameraX, cameraY) {
        if (!this.inCar) {
            ctx.fillStyle = '#FF69B4';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            // Add simple face
            ctx.fillStyle = '#000';
            ctx.fillRect(this.x + 5, this.y + 5, 3, 3); // left eye
            ctx.fillRect(this.x + 12, this.y + 5, 3, 3); // right eye
            ctx.fillRect(this.x + 7, this.y + 12, 6, 2); // mouth
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Player;
}
