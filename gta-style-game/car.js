// Car module

class Car {
    constructor(x, y, angle = 0, isPlayerCar = false, color = '#0000FF') {
        this.x = x;
        this.y = y;
        this.width = 45 + Math.random() * 10;
        this.height = 22 + Math.random() * 6;
        this.angle = angle;
        this.speed = 0;
        this.maxSpeed = 5;
        this.acceleration = 0.2;
        this.turnSpeed = 0.05;
        this.color = color;
        this.isPlayerCar = isPlayerCar;
        this.targetDirection = angle;
        this.lastIntersection = null;
    }

    update(keys, buildings, cars, roads, trafficLights, worldSize) {
        if (this.isPlayerCar) {
            this.updatePlayerCar(keys, buildings, cars, worldSize);
        } else {
            this.updateAICar(buildings, cars, roads, trafficLights, worldSize);
        }
    }

    updatePlayerCar(keys, buildings, cars, worldSize) {
        if (keys['w'] || keys['arrowup']) {
            this.speed = Math.min(this.speed + this.acceleration, this.maxSpeed);
        } else if (keys['s'] || keys['arrowdown']) {
            this.speed = Math.max(this.speed - this.acceleration * 2, -this.maxSpeed * 0.5);
        } else {
            this.speed *= 0.95; // Friction
        }

        if (keys[' ']) {
            this.speed *= 0.9;
        }

        if (keys['a'] || keys['arrowleft']) {
            this.angle -= this.turnSpeed * (this.speed / this.maxSpeed);
        }
        if (keys['d'] || keys['arrowright']) {
            this.angle += this.turnSpeed * (this.speed / this.maxSpeed);
        }

        let newX = this.x + Math.cos(this.angle) * this.speed;
        let newY = this.y + Math.sin(this.angle) * this.speed;

        // Check collision with buildings and other cars
        if (!this.isCollidingWithBuildings(newX, newY, buildings) &&
            !this.isCollidingWithCars(newX, newY, cars)) {
            this.x = newX;
            this.y = newY;
        } else {
            // Bounce back on collision
            this.speed *= -0.5;
        }

        // Keep car in world bounds
        this.x = Math.max(0, Math.min(worldSize.width - this.width, this.x));
        this.y = Math.max(0, Math.min(worldSize.height - this.height, this.y));
    }

    updateAICar(buildings, cars, roads, trafficLights, worldSize) {
        // Accelerate
        this.speed = Math.min(this.speed + this.acceleration * 0.1, this.maxSpeed * 0.5);

        // Check if car is on a road
        let onRoad = this.isOnRoad(roads);

        if (onRoad) {
            // On road - follow road direction and handle intersections
            let currentRoad = this.getCurrentRoad(roads);
            if (currentRoad) {
                // Check if at intersection
                let atIntersection = this.isAtIntersection(currentRoad);

                if (atIntersection && !this.lastIntersection) {
                    // Just entered intersection - choose direction
                    this.lastIntersection = { x: Math.floor(this.x / 300) * 300, y: Math.floor(this.y / 300) * 300 };
                    this.targetDirection = this.chooseDirection(currentRoad);
                } else if (!atIntersection) {
                    // Not at intersection - reset intersection flag
                    this.lastIntersection = null;
                }

                // Check traffic light
                if (atIntersection) {
                    let light = trafficLights.find(l => Math.abs(l.x - (this.x + this.width / 2)) < 100 && Math.abs(l.y - (this.y + this.height / 2)) < 100);
                    if (light && light.state === 'red') {
                        this.speed *= 0.8;
                    }
                }

                // Steer towards target direction
                let angleDiff = this.targetDirection - this.angle;
                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

                if (Math.abs(angleDiff) > 0.1) {
                    this.angle += Math.sign(angleDiff) * this.turnSpeed * 0.5;
                }
            }
        } else {
            // Not on road - try to get back to road
            let nearestRoad = this.findNearestRoad(roads);
            if (nearestRoad) {
                let targetX = nearestRoad.x + nearestRoad.width / 2;
                let targetY = nearestRoad.y + nearestRoad.height / 2;

                let dx = targetX - (this.x + this.width / 2);
                let dy = targetY - (this.y + this.height / 2);
                let targetAngle = Math.atan2(dy, dx);

                let angleDiff = targetAngle - this.angle;
                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

                this.angle += Math.sign(angleDiff) * this.turnSpeed * 0.3;
            }
        }

        // Move car
        let newX = this.x + Math.cos(this.angle) * this.speed;
        let newY = this.y + Math.sin(this.angle) * this.speed;

        // Check collision with buildings and other cars
        if (!this.isCollidingWithBuildings(newX, newY, buildings) &&
            !this.isCollidingWithCars(newX, newY, cars)) {
            this.x = newX;
            this.y = newY;
        } else {
            // Collision - try different direction
            this.angle += Math.PI + (Math.random() - 0.5) * 0.5;
            this.speed *= 0.5;
        }

        // Keep in world bounds
        if (this.x < 0 || this.x > worldSize.width - this.width) {
            this.angle = Math.PI - this.angle;
        }
        if (this.y < 0 || this.y > worldSize.height - this.height) {
            this.angle = -this.angle;
        }
    }

    isOnRoad(roads) {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        for (let road of roads) {
            if (centerX >= road.x && centerX <= road.x + road.width &&
                centerY >= road.y && centerY <= road.y + road.height) {
                return true;
            }
        }
        return false;
    }

    getCurrentRoad(roads) {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        for (let road of roads) {
            if (centerX >= road.x && centerX <= road.x + road.width &&
                centerY >= road.y && centerY <= road.y + road.height) {
                return road;
            }
        }
        return null;
    }

    isAtIntersection(currentRoad) {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        let intersectionX = Math.round(centerX / 300) * 300;
        let intersectionY = Math.round(centerY / 300) * 300;

        // Check if we're close to an intersection point
        return Math.abs(centerX - intersectionX) < 100 && Math.abs(centerY - intersectionY) < 100;
    }

    chooseDirection(currentRoad) {
        let possibleDirections = [];

        // Determine current direction
        let currentDir = Math.abs(this.angle) < Math.PI / 4 ? 0 : // East
                         Math.abs(this.angle - Math.PI / 2) < Math.PI / 4 ? 1 : // North
                         Math.abs(this.angle + Math.PI / 2) < Math.PI / 4 ? 3 : // South
                         2; // West

        // Add possible turns
        if (currentRoad.width > currentRoad.height) {
            // On horizontal road - can go left, right, or straight
            possibleDirections = [0, Math.PI]; // Left or right
        } else {
            // On vertical road - can go up, down, or straight
            possibleDirections = [Math.PI / 2, -Math.PI / 2]; // Up or down
        }

        // Randomly choose a direction
        return possibleDirections[Math.floor(Math.random() * possibleDirections.length)];
    }

    findNearestRoad(roads) {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        let nearestRoad = roads[0];
        let minDistance = Infinity;

        for (let road of roads) {
            let distance;
            if (road.width > road.height) {
                // Horizontal road
                distance = Math.abs(centerY - (road.y + road.height / 2));
            } else {
                // Vertical road
                distance = Math.abs(centerX - (road.x + road.width / 2));
            }

            if (distance < minDistance) {
                minDistance = distance;
                nearestRoad = road;
            }
        }

        return nearestRoad;
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

    isCollidingWithCars(x, y, cars) {
        for (let car of cars) {
            if (car === this) continue;
            if (x < car.x + car.width && x + this.width > car.x &&
                y < car.y + car.height && y + this.height > car.y) {
                return true;
            }
        }
        return false;
    }

    draw(ctx, cameraX, cameraY) {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.angle);

        let halfWidth = this.width / 2;
        let halfHeight = this.height / 2;

        // Car body
        ctx.fillStyle = this.color;
        ctx.fillRect(-halfWidth, -halfHeight, this.width, this.height);

        // Car roof (darker shade)
        ctx.fillStyle = this.shadeColor(this.color, -20);
        ctx.fillRect(-halfWidth + 5, -halfHeight + 2, this.width - 10, this.height - 8);

        // Windows
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(-halfWidth + 8, -halfHeight + 4, this.width - 16, this.height - 12);

        // Wheels
        ctx.fillStyle = '#333';
        let wheelSize = Math.min(this.width * 0.15, this.height * 0.4);
        // Front wheels
        ctx.fillRect(-halfWidth + wheelSize, -halfHeight - wheelSize/2, wheelSize, wheelSize);
        ctx.fillRect(halfWidth - wheelSize * 2, -halfHeight - wheelSize/2, wheelSize, wheelSize);
        // Back wheels
        ctx.fillRect(-halfWidth + wheelSize, halfHeight - wheelSize/2, wheelSize, wheelSize);
        ctx.fillRect(halfWidth - wheelSize * 2, halfHeight - wheelSize/2, wheelSize, wheelSize);

        // Wheel rims (lighter)
        ctx.fillStyle = '#CCC';
        ctx.fillRect(-halfWidth + wheelSize + 2, -halfHeight - wheelSize/2 + 2, wheelSize - 4, wheelSize - 4);
        ctx.fillRect(halfWidth - wheelSize * 2 + 2, -halfHeight - wheelSize/2 + 2, wheelSize - 4, wheelSize - 4);
        ctx.fillRect(-halfWidth + wheelSize + 2, halfHeight - wheelSize/2 + 2, wheelSize - 4, wheelSize - 4);
        ctx.fillRect(halfWidth - wheelSize * 2 + 2, halfHeight - wheelSize/2 + 2, wheelSize - 4, wheelSize - 4);

        // Headlights
        ctx.fillStyle = '#FFFF00';
        ctx.fillRect(-halfWidth, -halfHeight + 5, 3, 4);
        ctx.fillRect(halfWidth - 3, -halfHeight + 5, 3, 4);

        // Taillights
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(-halfWidth, halfHeight - 9, 3, 4);
        ctx.fillRect(halfWidth - 3, halfHeight - 9, 3, 4);

        ctx.restore();
    }

    shadeColor(color, percent) {
        let num = parseInt(color.replace("#", ""), 16);
        let amt = Math.round(2.55 * percent);
        let R = (num >> 16) + amt;
        let G = (num >> 8 & 0x00FF) + amt;
        let B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Car;
}
