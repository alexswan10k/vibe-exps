// Car module

class Car {
    constructor(x, y, angle = 0, isPlayerCar = false, color = '#0000FF') {
        this.x = x;
        this.y = y;
        this.width = 45 + Math.random() * 10;
        this.height = 22 + Math.random() * 6;
        this.angle = angle;
        this.speed = 0;
        this.vx = 0;
        this.vy = 0;
        this.maxSpeed = 6;
        this.acceleration = 0.15;
        this.turnSpeed = 0.08; // Increased for tighter turns
        this.color = color;
        this.isPlayerCar = isPlayerCar;

        // Damage mechanics
        this.health = 100;
        this.exploded = false;

        this.targetDirection = angle;
        this.lastIntersection = null;
        this.destination = null;
        this.stuckTimer = 0;
        this.lastPosition = { x: x, y: y };
        this.positionHistory = [];
    }

    update(keys, buildings, cars, roads, trafficLights, worldSize) {
        if (this.exploded) {
            // Check if we need to spawn smoke
            if (typeof particleSystem !== 'undefined' && Math.random() < 0.1) {
                particleSystem.addSmoke(this.x + this.width / 2, this.y + this.height / 2);
            }
            return; // Don't move if exploded
        }

        if (this.health < 40 && typeof particleSystem !== 'undefined' && Math.random() < 0.2) {
            particleSystem.addSmoke(this.x + this.width / 2, this.y + this.height / 2);
        }

        if (this.isPlayerCar) {
            this.updatePlayerCar(keys, buildings, cars, worldSize);
        } else {
            this.updateAICar(buildings, cars, roads, trafficLights, worldSize);
        }
    }

    updatePlayerCar(keys, buildings, cars, worldSize) {
        let force = 0;
        let isBraking = false;

        if (keys['w'] || keys['arrowup']) {
            force = this.acceleration;
        } else if (keys['s'] || keys['arrowdown']) {
            force = -this.acceleration;
        } else {
            // Apply slight natural deceleration
            this.vx *= 0.98;
            this.vy *= 0.98;
        }

        if (keys[' ']) {
            force = -this.acceleration * 1.5;
            isBraking = true;
        }

        // Only turn if moving
        if (Math.abs(this.speed) > 0.5) {
            let speedRatio = Math.min(this.speed / (this.maxSpeed * 0.5), 1.0); // Make turning responsive at lower speeds too
            if (keys['a'] || keys['arrowleft']) {
                this.angle -= this.turnSpeed * Math.sign(this.speed);
            }
            if (keys['d'] || keys['arrowright']) {
                this.angle += this.turnSpeed * Math.sign(this.speed);
            }
        }

        let forwardV = this.vx * Math.cos(this.angle) + this.vy * Math.sin(this.angle);
        let lateralV = -this.vx * Math.sin(this.angle) + this.vy * Math.cos(this.angle);

        forwardV += force;

        // Forward friction
        forwardV *= 0.98;

        // Lateral friction (grip vs drifting)
        let lateralGrip = isBraking ? 0.94 : 0.82; // Handbrake slides more
        lateralV *= lateralGrip;

        // Skid marks for drifting or braking
        if (Math.abs(lateralV) > 1.2 || (isBraking && Math.abs(forwardV) > 1.5)) {
            let backWheelX = this.x + this.width / 2 - Math.cos(this.angle) * this.width * 0.35;
            let backWheelY = this.y + this.height / 2 - Math.sin(this.angle) * this.width * 0.35;

            if (typeof particleSystem !== 'undefined') {
                particleSystem.addSkidMark(backWheelX, backWheelY, this.angle, this.height * 0.7, 0.4);
            }
        }

        // Convert back to global velocity
        this.vx = forwardV * Math.cos(this.angle) - lateralV * Math.sin(this.angle);
        this.vy = forwardV * Math.sin(this.angle) + lateralV * Math.cos(this.angle);

        this.speed = Math.sign(forwardV) * Math.sqrt(this.vx * this.vx + this.vy * this.vy);

        // Cap max speed
        if (Math.abs(this.speed) > this.maxSpeed) {
            let ratio = this.maxSpeed / Math.abs(this.speed);
            this.vx *= ratio;
            this.vy *= ratio;
            this.speed = Math.sign(this.speed) * this.maxSpeed;
        }

        let newX = this.x + this.vx;
        let newY = this.y + this.vy;

        // Check collision with buildings only (not other cars for player)
        if (!this.isCollidingWithBuildings(newX, newY, buildings)) { // Wait, player car should collide with cars too realistically, but kept to original logic for now
            this.x = newX;
            this.y = newY;
        } else {
            // Bounce back on collision with buildings
            let impactSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (impactSpeed > 2) {
                this.takeDamage(impactSpeed * 5); // Take damage on crash
            }

            this.vx *= -0.5;
            this.vy *= -0.5;
            this.speed *= -0.5;
        }

        // Keep car in world bounds
        this.x = Math.max(0, Math.min(worldSize.width - this.width, this.x));
        this.y = Math.max(0, Math.min(worldSize.height - this.height, this.y));
    }

    updateAICar(buildings, cars, roads, trafficLights, worldSize) {
        // Track position history for stuck detection
        this.positionHistory.push({ x: this.x, y: this.y });
        if (this.positionHistory.length > 20) {
            this.positionHistory.shift();
            const firstPos = this.positionHistory[0];
            const distanceMoved = Math.sqrt((this.x - firstPos.x) ** 2 + (this.y - firstPos.y) ** 2);
            if (distanceMoved < 10) {
                this.stuckTimer++;
                if (this.stuckTimer > 30) {
                    this.handleStuckSituation(roads);
                    return; // Skip standard update to allow unstucking
                }
            } else {
                this.stuckTimer = 0;
            }
        }

        let onRoad = this.isOnRoad(roads);
        let currentRoad = this.getCurrentRoad(roads);

        // Sensor logic (Obstacle Avoidance)
        let hasObstacleAhead = this.detectObstacleAhead(buildings, cars);

        let targetAccel = this.acceleration * 0.1;
        let maxCruise = this.maxSpeed * 0.6; // AI drives a bit slower usually

        if (this.isPolice && !this.exploded && typeof player !== 'undefined') {
            // Police AI: aggressively pursue player
            maxCruise = this.maxSpeed;
            targetAccel = this.acceleration * 0.4;

            let targetX = player.inCar && player.car ? player.car.x + player.car.width / 2 : player.x + player.width / 2;
            let targetY = player.inCar && player.car ? player.car.y + player.car.height / 2 : player.y + player.height / 2;

            // Aim slightly ahead of player if they are moving
            if (player.inCar && player.car && Math.abs(player.car.speed) > 2) {
                targetX += player.car.vx * 15;
                targetY += player.car.vy * 15;
            }

            let dx = targetX - (this.x + this.width / 2);
            let dy = targetY - (this.y + this.height / 2);
            this.targetDirection = Math.atan2(dy, dx);

            if (hasObstacleAhead) {
                this.speed *= 0.85; // Brake, but police are aggressive
            } else {
                this.speed = Math.min(this.speed + targetAccel, maxCruise);
            }
        } else {
            // Standard AI Logic
            if (hasObstacleAhead) {
                this.speed *= 0.8; // Brake for obstacle
            } else {
                this.speed = Math.min(this.speed + targetAccel, maxCruise);
            }

            if (onRoad && currentRoad) {
                let atIntersection = this.isAtIntersection(currentRoad, roads);

                if (atIntersection) {
                    // Check traffic lights
                    let light = trafficLights.find(l => Math.abs(l.x - (this.x + this.width / 2)) < 150 && Math.abs(l.y - (this.y + this.height / 2)) < 150);
                    if (light && light.state === 'red') {
                        // Very basic check to ensure light is generally in front of us
                        let dx = light.x - this.x;
                        let dy = light.y - this.y;
                        let angleToLight = Math.atan2(dy, dx);
                        let angleDiff = Math.abs(Math.atan2(Math.sin(this.angle - angleToLight), Math.cos(this.angle - angleToLight)));
                        if (angleDiff < Math.PI / 3) {
                            this.speed *= 0.7; // Brake for red light
                        }
                    }

                    if (!this.lastIntersection) {
                        this.lastIntersection = { x: Math.floor(this.x / 300) * 300, y: Math.floor(this.y / 300) * 300 };
                        // Pick random valid direction
                        this.targetDirection = this.chooseSmartDirection(currentRoad);
                    }
                } else {
                    this.lastIntersection = null;
                    this.stickToRightSide(currentRoad);
                }
            } else {
                this.navigateToNearestRoad(roads);
            }
        }

        // Steer towards target direction
        if (Math.abs(this.speed) > 0.5) {
            let angleDiff = Math.atan2(Math.sin(this.targetDirection - this.angle), Math.cos(this.targetDirection - this.angle));
            if (Math.abs(angleDiff) > 0.05) {
                this.angle += Math.sign(angleDiff) * this.turnSpeed * Math.min(this.speed / maxCruise, 1.0);
            }
        }

        // Apply velocity vectors
        this.vx = Math.cos(this.angle) * this.speed;
        this.vy = Math.sin(this.angle) * this.speed;

        let newX = this.x + this.vx;
        let newY = this.y + this.vy;

        // Final physical collisions
        if (!this.isCollidingWithBuildings(newX, newY, buildings) &&
            !this.isCollidingWithCars(newX, newY, cars)) {
            this.x = newX;
            this.y = newY;
        } else {
            this.handleSmartCollision(buildings, cars, roads);
        }

        // Keep in world bounds
        if (this.x < 0 || this.x > worldSize.width - this.width ||
            this.y < 0 || this.y > worldSize.height - this.height) {
            this.handleBoundaryCollision(roads, worldSize); // pass worldSize properly here
        }
    }

    detectObstacleAhead(buildings, cars) {
        let sensorDist = Math.max(this.speed * 12, 40); // Look ahead based on speed
        let centerX = this.x + this.width / 2;
        let centerY = this.y + this.height / 2;

        let frontX = centerX + Math.cos(this.angle) * sensorDist;
        let frontY = centerY + Math.sin(this.angle) * sensorDist;

        let leftX = centerX + Math.cos(this.angle - 0.4) * sensorDist * 0.8;
        let leftY = centerY + Math.sin(this.angle - 0.4) * sensorDist * 0.8;

        let rightX = centerX + Math.cos(this.angle + 0.4) * sensorDist * 0.8;
        let rightY = centerY + Math.sin(this.angle + 0.4) * sensorDist * 0.8;

        let collisionFront = this.isPointColliding(frontX, frontY, buildings, cars);
        let collisionLeft = this.isPointColliding(leftX, leftY, buildings, cars);
        let collisionRight = this.isPointColliding(rightX, rightY, buildings, cars);

        // Nudge steering slightly if hitting an obstacle as an evasive maneuver
        if (collisionFront || collisionLeft || collisionRight) {
            if (collisionLeft && !collisionRight) {
                this.angle += 0.02;
                this.targetDirection += 0.02;
            } else if (collisionRight && !collisionLeft) {
                this.angle -= 0.02;
                this.targetDirection -= 0.02;
            }
        }

        return collisionFront || collisionLeft || collisionRight;
    }

    isPointColliding(px, py, buildings, cars) {
        for (let b of buildings) {
            if (px > b.x && px < b.x + b.width && py > b.y && py < b.y + b.height) {
                return true;
            }
        }
        for (let car of cars) {
            if (car === this) continue;
            // Police ignore player's car as an "obstacle" so they can ram it
            if (this.isPolice && car.isPlayerCar) continue;

            if (px > car.x - 10 && px < car.x + car.width + 10 &&
                py > car.y - 10 && py < car.y + car.height + 10) {

                // Only treat as obstacle if we are generally moving towards it
                let angleToCar = Math.atan2(car.y - this.y, car.x - this.x);
                let angleDiff = Math.abs(Math.atan2(Math.sin(angleToCar - this.angle), Math.cos(angleToCar - this.angle)));
                if (angleDiff < Math.PI / 2) return true;
            }
        }

        if (typeof player !== 'undefined' && !player.inCar && !this.isPolice) {
            if (px > player.x - 10 && px < player.x + player.width + 10 &&
                py > player.y - 10 && py < player.y + player.height + 10) {
                return true;
            }
        }
        return false;
    }

    stickToRightSide(currentRoad) {
        if (!currentRoad) return;
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;

        let normAngle = Math.atan2(Math.sin(this.angle), Math.cos(this.angle));
        let isFacingEast = Math.abs(normAngle) < Math.PI / 4;
        let isFacingWest = Math.abs(normAngle) > Math.PI * 0.75;
        let isFacingSouth = Math.abs(normAngle - Math.PI / 2) < Math.PI / 4;
        let isFacingNorth = Math.abs(normAngle + Math.PI / 2) < Math.PI / 4;

        if (currentRoad.type === 'horizontal' || currentRoad.width > currentRoad.height) {
            // Horizontal
            let targetY = currentRoad.y + currentRoad.height * 0.75; // Eastbound default
            if (isFacingWest) targetY = currentRoad.y + currentRoad.height * 0.25;

            const distY = centerY - targetY;
            if (Math.abs(distY) > 5) {
                const steer = distY > 0 ? -1 : 1;
                this.angle += steer * this.turnSpeed * 0.2;
            } else if (isFacingEast) {
                this.targetDirection = 0;
            } else if (isFacingWest) {
                this.targetDirection = Math.PI;
            }
        } else if (currentRoad.type === 'vertical' || currentRoad.height > currentRoad.width) {
            // Vertical
            let targetX = currentRoad.x + currentRoad.width * 0.25; // Southbound default
            if (isFacingNorth) targetX = currentRoad.x + currentRoad.width * 0.75;

            const distX = centerX - targetX;
            if (Math.abs(distX) > 5) {
                const steer = distX > 0 ? -1 : 1;
                this.angle += steer * this.turnSpeed * 0.2;
            } else if (isFacingSouth) {
                this.targetDirection = Math.PI / 2;
            } else if (isFacingNorth) {
                this.targetDirection = -Math.PI / 2;
            }
        }
    }

    chooseSmartDirection(currentRoad) {
        // Randomly pick a valid 90-degree turn
        let normAngle = Math.atan2(Math.sin(this.angle), Math.cos(this.angle));
        let currentDir = Math.round(normAngle / (Math.PI / 2)) * (Math.PI / 2); // snaps to 0, PI/2, -PI/2, PI

        // Pick left, right, or straight. Don't U-turn.
        let choices = [currentDir, currentDir + Math.PI / 2, currentDir - Math.PI / 2];
        return choices[Math.floor(Math.random() * choices.length)];
    }

    navigateToNearestRoad(roads) {
        let nearestRoad = this.findNearestRoad(roads);
        if (nearestRoad) {
            let targetX = nearestRoad.x + nearestRoad.width / 2;
            let targetY = nearestRoad.y + nearestRoad.height / 2;
            this.targetDirection = Math.atan2(targetY - (this.y + this.height / 2), targetX - (this.x + this.width / 2));
            this.speed = Math.min(this.speed + this.acceleration * 0.1, this.maxSpeed * 0.5);
        }
    }

    handleSmartCollision(buildings, cars, roads) {
        // Did we hit another car or building?
        let impactSpeed = Math.abs(this.speed);
        if (impactSpeed > 2 && Math.random() > 0.8) {
            this.takeDamage(impactSpeed * 2);
        }

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
        this.targetDirection = bestDirection; // ACTUALLY REMEMBER THE NEW DIRECTION

        // Move forward into the clear path, DO NOT reverse
        this.speed = 1.0;
        this.vx = Math.cos(this.angle) * this.speed;
        this.vy = Math.sin(this.angle) * this.speed;
    }

    handleStuckSituation(roads) {
        // Try to get unstuck by finding a clear path
        this.speed = 1.5;
        this.angle += (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2); // 90 degree turn
        this.targetDirection = this.angle;
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

    handleBoundaryCollision(roads, worldSize) {
        this.speed *= 0.5;

        // Just reverse direction
        this.targetDirection = Math.atan2(Math.sin((this.angle + Math.PI)), Math.cos(this.angle + Math.PI));
        this.angle = this.targetDirection;

        let halfWidth = this.width / 2;
        let halfHeight = this.height / 2;

        if (this.x < 0) this.x = 0;
        if (this.x > worldSize.width - this.width) this.x = worldSize.width - this.width;
        if (this.y < 0) this.y = 0;
        if (this.y > worldSize.height - this.height) this.y = worldSize.height - this.height;
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
        let impactSpeed = Math.abs(this.speed);
        if (impactSpeed > 2) {
            this.takeDamage(impactSpeed * 3);
        }

        // Simple collision handling - bounce away
        this.speed = -1.5; // Back up

        // Try to steer away from buildings
        if (Math.random() > 0.5) {
            this.angle += 0.5;
            this.targetDirection += 0.5;
        } else {
            this.angle -= 0.5;
            this.targetDirection -= 0.5;
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

    isAtIntersection(currentRoad, roads) {
        if (currentRoad && currentRoad.type === 'crossroad') return true;

        // An intersection is where multiple roads overlap (fallback for old layout).
        let centerX = this.x + this.width / 2;
        let centerY = this.y + this.height / 2;
        let roadCount = 0;
        for (let road of roads) {
            if (centerX >= road.x && centerX <= road.x + road.width &&
                centerY >= road.y && centerY <= road.y + road.height) {
                roadCount++;
            }
        }
        return roadCount > 1;
    }



    findNearestRoad(roads) {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        let nearestRoad = roads[0];
        let minDistance = Infinity;

        for (let road of roads) {
            let distance;
            if (road.type === 'horizontal' || road.width > road.height) {
                // Horizontal road
                distance = Math.abs(centerY - (road.y + road.height / 2));
            } else {
                // Vertical road or crossroad
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

    takeDamage(amount) {
        if (this.exploded) return;
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            this.exploded = true;
            this.speed = 0;
            this.vx = 0;
            this.vy = 0;
            if (typeof particleSystem !== 'undefined') {
                particleSystem.addExplosion(this.x + this.width / 2, this.y + this.height / 2);
            }
        }
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

        let displayColor = this.color;
        if (this.exploded) {
            displayColor = '#222222'; // Burnt husk
        }

        bodyGradient.addColorStop(0, this.shadeColor(displayColor, 30)); // Front - lighter
        bodyGradient.addColorStop(0.3, displayColor); // Middle
        bodyGradient.addColorStop(0.7, this.shadeColor(displayColor, -10)); // Rear
        bodyGradient.addColorStop(1, this.shadeColor(displayColor, -30)); // Back - darkest
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
        ctx.fillRect(-halfWidth + wheelSize, -halfHeight - wheelSize / 2, wheelSize, wheelSize);
        ctx.fillRect(halfWidth - wheelSize * 2, -halfHeight - wheelSize / 2, wheelSize, wheelSize);
        // Back wheels
        ctx.fillRect(-halfWidth + wheelSize, halfHeight - wheelSize / 2, wheelSize, wheelSize);
        ctx.fillRect(halfWidth - wheelSize * 2, halfHeight - wheelSize / 2, wheelSize, wheelSize);

        // Wheel rims (metallic)
        ctx.fillStyle = '#C0C0C0';
        ctx.fillRect(-halfWidth + wheelSize + 2, -halfHeight - wheelSize / 2 + 2, wheelSize - 4, wheelSize - 4);
        ctx.fillRect(halfWidth - wheelSize * 2 + 2, -halfHeight - wheelSize / 2 + 2, wheelSize - 4, wheelSize - 4);
        ctx.fillRect(-halfWidth + wheelSize + 2, halfHeight - wheelSize / 2 + 2, wheelSize - 4, wheelSize - 4);
        ctx.fillRect(halfWidth - wheelSize * 2 + 2, halfHeight - wheelSize / 2 + 2, wheelSize - 4, wheelSize - 4);

        // Wheel spokes
        ctx.strokeStyle = '#808080';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 2) / 5;
            const x1 = -halfWidth + wheelSize + wheelSize / 2 + Math.cos(angle) * (wheelSize / 2 - 3);
            const y1 = -halfHeight - wheelSize / 2 + wheelSize / 2 + Math.sin(angle) * (wheelSize / 2 - 3);
            const x2 = -halfWidth + wheelSize + wheelSize / 2 + Math.cos(angle) * (wheelSize / 2 - 6);
            const y2 = -halfHeight - wheelSize / 2 + wheelSize / 2 + Math.sin(angle) * (wheelSize / 2 - 6);

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
        if (this.isPolice && !this.exploded) {
            // Draw police lights on roof
            let time = Date.now() / 150;
            ctx.fillStyle = time % 2 < 1 ? '#FF0000' : '#0000FF'; // flashing red/blue
            ctx.fillRect(-2, -halfHeight + 6, 8, 4);
        } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.font = '8px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('▲', 0, -halfHeight + 8);
        }

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
