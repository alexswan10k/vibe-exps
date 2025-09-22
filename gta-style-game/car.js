// Car module

class Car {
    constructor(x, y, angle = 0, isPlayerCar = false, color = '#0000FF') {
        this.x = x;
        this.y = y;
        this.width = 45 + Math.random() * 10;
        this.height = 22 + Math.random() * 6;
        this.angle = angle;
        this.speed = 0;
        this.maxSpeed = 4;
        this.acceleration = 0.15;
        this.turnSpeed = 0.08; // Increased for tighter turns
        this.color = color;
        this.isPlayerCar = isPlayerCar;
        this.targetDirection = angle;
        this.lastIntersection = null;
        this.destination = null;
        this.stuckTimer = 0;
        this.lastPosition = { x: x, y: y };
        this.positionHistory = [];
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

        // Check collision with buildings only (not other cars for player)
        if (!this.isCollidingWithBuildings(newX, newY, buildings)) {
            this.x = newX;
            this.y = newY;
        } else {
            // Bounce back on collision with buildings
            this.speed *= -0.5;
        }

        // Keep car in world bounds
        this.x = Math.max(0, Math.min(worldSize.width - this.width, this.x));
        this.y = Math.max(0, Math.min(worldSize.height - this.height, this.y));
    }

    updateAICar(buildings, cars, roads, trafficLights, worldSize) {
        // Track position history for stuck detection
        this.positionHistory.push({ x: this.x, y: this.y });
        if (this.positionHistory.length > 10) {
            this.positionHistory.shift();
        }

        // Check if stuck (same position for too long)
        if (this.positionHistory.length === 10) {
            const firstPos = this.positionHistory[0];
            const lastPos = this.positionHistory[9];
            const distanceMoved = Math.sqrt((this.x - firstPos.x) ** 2 + (this.y - firstPos.y) ** 2);
            if (distanceMoved < 5) {
                this.stuckTimer++;
                if (this.stuckTimer > 30) { // Stuck for 30 frames
                    this.handleStuckSituation(roads);
                }
            } else {
                this.stuckTimer = 0;
            }
        }

        // Set destination if we don't have one
        if (!this.destination) {
            this.setNewDestination(roads, worldSize);
        }

        // Check if we've reached our destination
        if (this.destination) {
            const distanceToDest = Math.sqrt(
                (this.x - this.destination.x) ** 2 +
                (this.y - this.destination.y) ** 2
            );
            if (distanceToDest < 50) {
                this.destination = null; // Find new destination
            }
        }

        // Get current road and position
        let onRoad = this.isOnRoad(roads);
        let currentRoad = this.getCurrentRoad(roads);

        if (onRoad && currentRoad) {
            // On road - follow road and handle intersections
            let atIntersection = this.isAtIntersection(currentRoad);

            if (atIntersection && !this.lastIntersection) {
                // At intersection - choose direction towards destination
                this.lastIntersection = { x: Math.floor(this.x / 300) * 300, y: Math.floor(this.y / 300) * 300 };
                this.targetDirection = this.chooseSmartDirection(currentRoad, roads);
            } else if (!atIntersection) {
                this.lastIntersection = null;
            }

            // Check traffic lights
            if (atIntersection) {
                let light = trafficLights.find(l => Math.abs(l.x - (this.x + this.width / 2)) < 100 && Math.abs(l.y - (this.y + this.height / 2)) < 100);
                if (light && light.state === 'red') {
                    this.speed *= 0.85; // Gradual slowdown
                } else if (light && light.state === 'green') {
                    this.speed = Math.min(this.speed + this.acceleration * 0.2, this.maxSpeed * 0.8);
                }
            } else {
                // Normal road driving - stick to left side of road
                this.stickToLeftSide(currentRoad);
                this.speed = Math.min(this.speed + this.acceleration * 0.12, this.maxSpeed * 0.8);
            }

            // Steer towards target direction
            let angleDiff = this.targetDirection - this.angle;
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

            if (Math.abs(angleDiff) > 0.03) {
                this.angle += Math.sign(angleDiff) * this.turnSpeed * Math.min(this.speed / this.maxSpeed, 1);
            }
        } else {
            // Not on road - navigate back to road system
            this.navigateToNearestRoad(roads);
        }

        // Move car
        let newX = this.x + Math.cos(this.angle) * this.speed;
        let newY = this.y + Math.sin(this.angle) * this.speed;

        // Check collisions
        if (!this.isCollidingWithBuildings(newX, newY, buildings) &&
            !this.isCollidingWithCars(newX, newY, cars)) {
            this.x = newX;
            this.y = newY;
        } else {
            this.handleSmartCollision(buildings, cars, roads);
        }

        // Keep in world bounds with smart boundary handling
        if (this.x < 0 || this.x > worldSize.width - this.width ||
            this.y < 0 || this.y > worldSize.height - this.height) {
            this.handleBoundaryCollision(roads);
        }
    }

    stickToLeftSide(currentRoad) {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;

        if (currentRoad.width > currentRoad.height) {
            // Horizontal road - stick to left side (top of road)
            const leftSideY = currentRoad.y + this.height / 2 + 5; // Left side of horizontal road
            const distanceFromLeft = centerY - leftSideY;

            if (Math.abs(distanceFromLeft) > 3) {
                // Steer towards left side
                const steerDirection = distanceFromLeft > 0 ? -1 : 1;
                this.angle += steerDirection * this.turnSpeed * 0.3;
            }
        } else {
            // Vertical road - stick to left side (left of road)
            const leftSideX = currentRoad.x + this.width / 2 + 5; // Left side of vertical road
            const distanceFromLeft = centerX - leftSideX;

            if (Math.abs(distanceFromLeft) > 3) {
                // Steer towards left side
                const steerDirection = distanceFromLeft > 0 ? -1 : 1;
                this.angle += steerDirection * this.turnSpeed * 0.3;
            }
        }
    }

    setNewDestination(roads, worldSize) {
        // Choose a random road intersection as destination
        const intersections = [];
        const gridSize = 300;

        for (let y = 0; y < worldSize.height; y += gridSize) {
            for (let x = 0; x < worldSize.width; x += gridSize) {
                // Check if this grid position has roads
                let hasRoads = false;
                for (let road of roads) {
                    if (x >= road.x - 50 && x <= road.x + road.width + 50 &&
                        y >= road.y - 50 && y <= road.y + road.height + 50) {
                        hasRoads = true;
                        break;
                    }
                }
                if (hasRoads) {
                    intersections.push({ x: x + gridSize/2, y: y + gridSize/2 });
                }
            }
        }

        if (intersections.length > 0) {
            this.destination = intersections[Math.floor(Math.random() * intersections.length)];
        }
    }

    chooseSmartDirection(currentRoad, roads) {
        const directions = [];
        const currentAngle = this.angle;

        // Determine current direction
        let currentDir = Math.abs(currentAngle) < Math.PI / 4 ? 0 : // East
                         Math.abs(currentAngle - Math.PI / 2) < Math.PI / 4 ? 1 : // North
                         Math.abs(currentAngle + Math.PI / 2) < Math.PI / 4 ? 3 : // South
                         2; // West

        // Add possible directions based on road type
        if (currentRoad.width > currentRoad.height) {
            // Horizontal road
            directions.push(0, Math.PI); // Left and right
        } else {
            // Vertical road
            directions.push(Math.PI / 2, -Math.PI / 2); // Up and down
        }

        // If we have a destination, choose direction towards it
        if (this.destination) {
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;

            let bestDirection = directions[0];
            let bestScore = Infinity;

            for (let direction of directions) {
                const testX = centerX + Math.cos(direction) * 100;
                const testY = centerY + Math.sin(direction) * 100;
                const distance = Math.sqrt((testX - this.destination.x) ** 2 + (testY - this.destination.y) ** 2);
                if (distance < bestScore) {
                    bestScore = distance;
                    bestDirection = direction;
                }
            }

            return bestDirection;
        }

        // No destination, choose randomly
        return directions[Math.floor(Math.random() * directions.length)];
    }

    navigateToNearestRoad(roads) {
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

            this.angle += Math.sign(angleDiff) * this.turnSpeed * 0.4;
            this.speed = Math.min(this.speed + this.acceleration * 0.08, this.maxSpeed * 0.6);
        }
    }

    handleSmartCollision(buildings, cars, roads) {
        // Try different directions to find a clear path
        const testDirections = [0, 0.2, -0.2, 0.4, -0.4, 0.6, -0.6];
        let bestDirection = this.angle;
        let bestDistance = 0;

        for (let angleOffset of testDirections) {
            const testAngle = this.angle + angleOffset;
            const testX = this.x + Math.cos(testAngle) * this.speed * 0.5;
            const testY = this.y + Math.sin(testAngle) * this.speed * 0.5;

            if (!this.isCollidingWithBuildings(testX, testY, buildings) &&
                !this.isCollidingWithCars(testX, testY, cars)) {
                const distanceFromCurrent = Math.abs(angleOffset);
                if (distanceFromCurrent < bestDistance || bestDistance === 0) {
                    bestDistance = distanceFromCurrent;
                    bestDirection = testAngle;
                }
            }
        }

        this.angle = bestDirection;
        this.speed *= 0.6; // Slow down on collision
    }

    handleStuckSituation(roads) {
        // Try to get unstuck by finding a clear path
        this.speed = 1.0;
        this.angle += (Math.random() - 0.5) * Math.PI; // Random turn
        this.stuckTimer = 0;

        // If still stuck, try to move to nearest road
        if (!this.isOnRoad(roads)) {
            let nearestRoad = this.findNearestRoad(roads);
            if (nearestRoad) {
                let targetX = nearestRoad.x + nearestRoad.width / 2;
                let targetY = nearestRoad.y + nearestRoad.height / 2;
                this.angle = Math.atan2(targetY - this.y, targetX - this.x);
            }
        }
    }

    handleBoundaryCollision(roads) {
        // Smart boundary handling - try to stay on roads
        this.speed *= 0.5;

        if (this.x < 0) {
            this.x = 0;
            this.angle = Math.PI - this.angle;
        } else if (this.x > worldSize.width - this.width) {
            this.x = worldSize.width - this.width;
            this.angle = Math.PI - this.angle;
        }

        if (this.y < 0) {
            this.y = 0;
            this.angle = -this.angle;
        } else if (this.y > worldSize.height - this.height) {
            this.y = worldSize.height - this.height;
            this.angle = -this.angle;
        }

        // If we're off-road, head towards nearest road
        if (!this.isOnRoad(roads)) {
            let nearestRoad = this.findNearestRoad(roads);
            if (nearestRoad) {
                let targetX = nearestRoad.x + nearestRoad.width / 2;
                let targetY = nearestRoad.y + nearestRoad.height / 2;
                this.angle = Math.atan2(targetY - this.y, targetX - this.x);
            }
        }
    }

    avoidNearbyCars(cars) {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        let avoidanceForce = 0;

        for (let car of cars) {
            if (car === this) continue;

            const otherCenterX = car.x + car.width / 2;
            const otherCenterY = car.y + car.height / 2;
            const distance = Math.sqrt((centerX - otherCenterX) ** 2 + (centerY - otherCenterY) ** 2);

            // If car is too close, slow down and steer away
            if (distance < 80 && distance > 0) {
                const avoidanceAngle = Math.atan2(otherCenterY - centerY, otherCenterX - centerX);
                const angleDiff = avoidanceAngle - this.angle;

                // Steer away from nearby car
                this.angle -= Math.sign(angleDiff) * this.turnSpeed * 0.3;
                this.speed *= 0.8; // Slow down when close to other cars
            }
        }
    }

    handleCollision(buildings) {
        // Simple collision handling - bounce away from buildings
        this.speed *= 0.7; // Slow down on collision

        // Try to steer away from buildings
        if (Math.random() > 0.5) {
            this.angle += 0.3;
        } else {
            this.angle -= 0.3;
        }

        // If speed is very low, give it a small boost to get unstuck
        if (Math.abs(this.speed) < 0.5) {
            this.speed = 1.0;
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

        // Car shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(-halfWidth + 2, -halfHeight + 2, this.width, this.height);

        // Car body with gradient (front to back)
        const bodyGradient = ctx.createLinearGradient(-halfWidth, -halfHeight, halfWidth, halfHeight);
        bodyGradient.addColorStop(0, this.shadeColor(this.color, 30)); // Front - lighter
        bodyGradient.addColorStop(0.3, this.color); // Middle
        bodyGradient.addColorStop(0.7, this.shadeColor(this.color, -10)); // Rear
        bodyGradient.addColorStop(1, this.shadeColor(this.color, -30)); // Back - darkest
        ctx.fillStyle = bodyGradient;
        ctx.fillRect(-halfWidth, -halfHeight, this.width, this.height);

        // Car outline
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(-halfWidth, -halfHeight, this.width, this.height);

        // Car roof with distinct front and back
        const roofGradient = ctx.createLinearGradient(-halfWidth + 5, -halfHeight + 2, halfWidth - 5, -halfHeight + 2);
        roofGradient.addColorStop(0, this.shadeColor(this.color, -20)); // Front roof
        roofGradient.addColorStop(0.5, this.shadeColor(this.color, -40)); // Middle roof - darkest
        roofGradient.addColorStop(1, this.shadeColor(this.color, -25)); // Back roof
        ctx.fillStyle = roofGradient;
        ctx.fillRect(-halfWidth + 5, -halfHeight + 2, this.width - 10, this.height - 8);

        // Front windshield (larger and more prominent)
        ctx.fillStyle = 'rgba(135, 206, 235, 0.9)';
        ctx.fillRect(-halfWidth + 8, -halfHeight + 4, this.width - 16, this.height - 12);

        // Rear windshield (smaller and darker)
        ctx.fillStyle = 'rgba(135, 206, 235, 0.7)';
        ctx.fillRect(-halfWidth + 8, halfHeight - 8, this.width - 16, 4);

        // Side windows with front-back distinction
        ctx.fillStyle = 'rgba(135, 206, 235, 0.8)';
        ctx.fillRect(-halfWidth + 8, -halfHeight + 4, this.width - 16, 4); // top side windows
        ctx.fillRect(-halfWidth + 8, halfHeight - 8, this.width - 16, 4); // bottom side windows

        // Wheels with more detail
        ctx.fillStyle = '#1a1a1a';
        let wheelSize = Math.min(this.width * 0.15, this.height * 0.4);
        // Front wheels
        ctx.fillRect(-halfWidth + wheelSize, -halfHeight - wheelSize/2, wheelSize, wheelSize);
        ctx.fillRect(halfWidth - wheelSize * 2, -halfHeight - wheelSize/2, wheelSize, wheelSize);
        // Back wheels
        ctx.fillRect(-halfWidth + wheelSize, halfHeight - wheelSize/2, wheelSize, wheelSize);
        ctx.fillRect(halfWidth - wheelSize * 2, halfHeight - wheelSize/2, wheelSize, wheelSize);

        // Wheel rims (metallic)
        ctx.fillStyle = '#C0C0C0';
        ctx.fillRect(-halfWidth + wheelSize + 2, -halfHeight - wheelSize/2 + 2, wheelSize - 4, wheelSize - 4);
        ctx.fillRect(halfWidth - wheelSize * 2 + 2, -halfHeight - wheelSize/2 + 2, wheelSize - 4, wheelSize - 4);
        ctx.fillRect(-halfWidth + wheelSize + 2, halfHeight - wheelSize/2 + 2, wheelSize - 4, wheelSize - 4);
        ctx.fillRect(halfWidth - wheelSize * 2 + 2, halfHeight - wheelSize/2 + 2, wheelSize - 4, wheelSize - 4);

        // Wheel spokes
        ctx.strokeStyle = '#808080';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 2) / 5;
            const x1 = -halfWidth + wheelSize + wheelSize/2 + Math.cos(angle) * (wheelSize/2 - 3);
            const y1 = -halfHeight - wheelSize/2 + wheelSize/2 + Math.sin(angle) * (wheelSize/2 - 3);
            const x2 = -halfWidth + wheelSize + wheelSize/2 + Math.cos(angle) * (wheelSize/2 - 6);
            const y2 = -halfHeight - wheelSize/2 + wheelSize/2 + Math.sin(angle) * (wheelSize/2 - 6);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        // FRONT HEADLIGHTS - Much more prominent
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-halfWidth - 2, -halfHeight + 4, 6, 7); // Left headlight
        ctx.fillRect(halfWidth - 4, -halfHeight + 4, 6, 7); // Right headlight

        // Headlight inner glow
        ctx.fillStyle = '#FFFF99';
        ctx.fillRect(-halfWidth - 1, -halfHeight + 5, 4, 5);
        ctx.fillRect(halfWidth - 3, -halfHeight + 5, 4, 5);

        // Headlight outer glow
        ctx.fillStyle = 'rgba(255, 255, 153, 0.4)';
        ctx.fillRect(-halfWidth - 4, -halfHeight + 2, 10, 11);
        ctx.fillRect(halfWidth - 6, -halfHeight + 2, 10, 11);

        // REAR TAILLIGHTS - Distinct red design
        ctx.fillStyle = '#8B0000'; // Dark red background
        ctx.fillRect(-halfWidth - 1, halfHeight - 11, 5, 6); // Left taillight background
        ctx.fillRect(halfWidth - 4, halfHeight - 11, 5, 6); // Right taillight background

        // Taillight inner lights
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(-halfWidth, halfHeight - 10, 3, 4);
        ctx.fillRect(halfWidth - 3, halfHeight - 10, 3, 4);

        // Taillight glow
        ctx.fillStyle = 'rgba(255, 68, 68, 0.4)';
        ctx.fillRect(-halfWidth - 3, halfHeight - 13, 9, 10);
        ctx.fillRect(halfWidth - 6, halfHeight - 13, 9, 10);

        // License plate (front and back)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-8, halfHeight - 3, 16, 4); // Rear plate

        // License plate text
        ctx.fillStyle = '#000';
        ctx.font = '4px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GTA', 0, halfHeight - 1);

        // Front bumper/grille
        ctx.fillStyle = '#333';
        ctx.fillRect(-halfWidth + 3, -halfHeight - 2, this.width - 6, 3);

        // Rear bumper
        ctx.fillStyle = '#333';
        ctx.fillRect(-halfWidth + 3, halfHeight - 1, this.width - 6, 3);

        // Add direction indicator - arrow on roof
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '8px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('▲', 0, -halfHeight + 8);

        // Add speed lines when moving fast
        if (Math.abs(this.speed) > 3) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 4]);
            ctx.strokeRect(-halfWidth - 5, -halfHeight - 5, this.width + 10, this.height + 10);
            ctx.setLineDash([]);
        }

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
