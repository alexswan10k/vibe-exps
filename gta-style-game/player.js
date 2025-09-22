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
        let isMoving = false;

        if (keys['w'] || keys['arrowup']) {
            dy -= this.speed;
            isMoving = true;
        }
        if (keys['s'] || keys['arrowdown']) {
            dy += this.speed;
            isMoving = true;
        }
        if (keys['a'] || keys['arrowleft']) {
            dx -= this.speed;
            isMoving = true;
        }
        if (keys['d'] || keys['arrowright']) {
            dx += this.speed;
            isMoving = true;
        }

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

        // Update animation state
        this.isMoving = isMoving;
        this.facingDirection = this.getFacingDirection(dx, dy);
    }

    getFacingDirection(dx, dy) {
        if (dx > 0) return 'right';
        if (dx < 0) return 'left';
        if (dy > 0) return 'down';
        if (dy < 0) return 'up';
        return this.facingDirection || 'down';
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

    enterCar(car) {
        if (Math.abs(this.x + this.width / 2 - (car.x + car.width / 2)) < 50 &&
            Math.abs(this.y + this.height / 2 - (car.y + car.height / 2)) < 50) {
            this.inCar = true;
            this.car = car;
            car.isPlayerCar = true; // Take control of this car
            return true;
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
            ctx.save();
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

            // Player shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(-this.width / 2 + 1, -this.height / 2 + 1, this.width, this.height);

            // Player body (main torso)
            ctx.fillStyle = '#4169E1'; // Royal blue shirt
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

            // Player head
            ctx.fillStyle = '#FDBCB4'; // Skin color
            ctx.fillRect(-6, -this.height - 8, 12, 8);

            // Player hair
            ctx.fillStyle = '#8B4513'; // Brown hair
            ctx.fillRect(-5, -this.height - 10, 10, 4);

            // Eyes
            ctx.fillStyle = '#000';
            ctx.fillRect(-4, -this.height - 6, 2, 2); // left eye
            ctx.fillRect(2, -this.height - 6, 2, 2); // right eye

            // Eye whites
            ctx.fillStyle = '#FFF';
            ctx.fillRect(-3, -this.height - 6, 1, 1); // left eye white
            ctx.fillRect(3, -this.height - 6, 1, 1); // right eye white

            // Nose
            ctx.fillStyle = '#F0A0A0';
            ctx.fillRect(-1, -this.height - 4, 2, 1);

            // Mouth
            ctx.fillStyle = '#000';
            ctx.fillRect(-2, -this.height - 2, 4, 1);

            // Arms
            ctx.fillStyle = '#FDBCB4';
            ctx.fillRect(-this.width / 2 - 3, -this.height / 2 + 2, 3, this.height - 4); // left arm
            ctx.fillRect(this.width / 2, -this.height / 2 + 2, 3, this.height - 4); // right arm

            // Legs
            ctx.fillStyle = '#000080'; // Dark blue pants
            ctx.fillRect(-this.width / 2 + 2, this.height / 2 - 2, 6, this.height / 2); // left leg
            ctx.fillRect(this.width / 2 - 8, this.height / 2 - 2, 6, this.height / 2); // right leg

            // Shoes
            ctx.fillStyle = '#000';
            ctx.fillRect(-this.width / 2 + 1, this.height / 2 + this.height / 2 - 3, 8, 3); // left shoe
            ctx.fillRect(this.width / 2 - 9, this.height / 2 + this.height / 2 - 3, 8, 3); // right shoe

            // Add some animation based on movement
            if (this.isMoving) {
                // Slight bobbing animation
                ctx.translate(0, Math.sin(gameTime * 0.01) * 0.5);
            }

            ctx.restore();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Player;
}
