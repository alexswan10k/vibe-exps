// Vehicle Classes, Physics, AI, and 3D Stunt Jump Module

class Car {
    constructor(x, y, angle = 0, isPlayerCar = false, color = null, type = 'sedan') {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.isPlayerCar = isPlayerCar;
        this.type = type; // 'sedan', 'supercar', 'muscle', 'taxi', 'bike', 'police', 'swat', 'ambulance', 'firetruck', 'tank'

        // Apply type-specific stats and geometry
        this.setupVehicleStats(color);

        this.speed = 0;
        this.vx = 0;
        this.vy = 0;
        this.exploded = false;
        this.health = this.maxHealth;

        // 3D Stunt Jump State
        this.isAirborne = false;
        this.airborneZ = 0;
        this.airborneVz = 0;
        this.jumpAirtime = 0;
        this.jumpStartX = x;
        this.jumpStartY = y;

        this.targetDirection = angle;
        this.lastIntersection = null;
        this.destination = null;
        this.stuckTimer = 0;
        this.positionHistory = [];
    }

    setupVehicleStats(customColor) {
        if (this.type === 'supercar') {
            this.width = 48;
            this.height = 22;
            this.maxSpeed = 8.8;
            this.acceleration = 0.24;
            this.turnSpeed = 0.085;
            this.maxHealth = 100;
            this.color = customColor || ['#E53935', '#FB8C00', '#FDD835', '#00ACC1', '#8E24AA'][Math.floor(Math.random() * 5)];
        } else if (this.type === 'muscle') {
            this.width = 47;
            this.height = 23;
            this.maxSpeed = 7.6;
            this.acceleration = 0.22;
            this.turnSpeed = 0.075;
            this.maxHealth = 130;
            this.color = customColor || ['#1E88E5', '#43A047', '#3949AB', '#D81B60'][Math.floor(Math.random() * 4)];
        } else if (this.type === 'taxi') {
            this.width = 45;
            this.height = 22;
            this.maxSpeed = 6.2;
            this.acceleration = 0.16;
            this.turnSpeed = 0.078;
            this.maxHealth = 110;
            this.color = '#FFD600'; // Bright Yellow Cab
        } else if (this.type === 'bike') {
            this.width = 30;
            this.height = 12;
            this.maxSpeed = 8.2;
            this.acceleration = 0.26;
            this.turnSpeed = 0.095;
            this.maxHealth = 60;
            this.color = customColor || '#FF1744';
        } else if (this.type === 'police') {
            this.width = 46;
            this.height = 22;
            this.maxSpeed = 7.8;
            this.acceleration = 0.20;
            this.turnSpeed = 0.08;
            this.maxHealth = 140;
            this.color = '#212121';
            this.isPolice = true;
        } else if (this.type === 'swat') {
            this.width = 54;
            this.height = 26;
            this.maxSpeed = 6.5;
            this.acceleration = 0.16;
            this.turnSpeed = 0.06;
            this.maxHealth = 260;
            this.color = '#263238';
            this.isPolice = true;
        } else if (this.type === 'ambulance') {
            this.width = 52;
            this.height = 25;
            this.maxSpeed = 6.0;
            this.acceleration = 0.15;
            this.turnSpeed = 0.065;
            this.maxHealth = 180;
            this.color = '#FFFFFF';
        } else if (this.type === 'firetruck') {
            this.width = 62;
            this.height = 26;
            this.maxSpeed = 5.8;
            this.acceleration = 0.14;
            this.turnSpeed = 0.055;
            this.maxHealth = 280;
            this.color = '#D50000';
        } else if (this.type === 'tank') {
            this.width = 56;
            this.height = 32;
            this.maxSpeed = 5.0;
            this.acceleration = 0.12;
            this.turnSpeed = 0.05;
            this.maxHealth = 600;
            this.color = '#33691E'; // Army Olive
        } else {
            // Standard Sedan
            this.width = 44 + Math.random() * 4;
            this.height = 21 + Math.random() * 3;
            this.maxSpeed = 6.4;
            this.acceleration = 0.16;
            this.turnSpeed = 0.075;
            this.maxHealth = 100;
            this.color = customColor || ['#1E88E5', '#43A047', '#F4511E', '#7E57C2', '#00897B', '#6D4C41', '#546E7A'][Math.floor(Math.random() * 7)];
        }
    }

    launchStuntJump(rampAngle, speed) {
        if (this.isAirborne) return;
        this.isAirborne = true;
        this.airborneZ = 2;
        this.airborneVz = Math.min(speed * 0.85, 6.5);
        this.jumpAirtime = 0;
        this.jumpStartX = this.x;
        this.jumpStartY = this.y;

        // Boost velocity in ramp direction
        let jumpForce = speed * 1.15;
        this.vx = Math.cos(rampAngle) * jumpForce;
        this.vy = Math.sin(rampAngle) * jumpForce;
        this.angle = rampAngle;

        if (this.isPlayerCar && typeof audioSystem !== 'undefined') {
            audioSystem.playStunt();
        }
    }

    update(keys, buildings, cars, roads, trafficLights, worldSize) {
        if (this.exploded) {
            if (typeof particleSystem !== 'undefined' && Math.random() < 0.08) {
                particleSystem.addSmoke(this.x + this.width / 2, this.y + this.height / 2);
            }
            return;
        }

        // 3D Airborne Physics
        if (this.isAirborne) {
            this.jumpAirtime += 1 / 60;
            this.airborneZ += this.airborneVz;
            this.airborneVz -= 0.18; // gravity

            this.x += this.vx;
            this.y += this.vy;

            // Spawn smoke/sparks trail during flight
            if (typeof particleSystem !== 'undefined' && Math.random() < 0.3) {
                particleSystem.addSmoke(this.x + this.width / 2, this.y + this.height / 2);
            }

            if (this.airborneZ <= 0) {
                // Landed!
                this.isAirborne = false;
                this.airborneZ = 0;
                this.airborneVz = 0;

                let dist = Math.sqrt((this.x - this.jumpStartX) ** 2 + (this.y - this.jumpStartY) ** 2);
                if (this.isPlayerCar && dist > 120) {
                    let bonusCash = Math.floor(dist * 2.5);
                    if (typeof showStuntBonus !== 'undefined') {
                        showStuntBonus(Math.floor(dist), this.jumpAirtime.toFixed(1), bonusCash);
                    }
                }
                if (typeof particleSystem !== 'undefined') {
                    particleSystem.addSparks(this.x + this.width / 2, this.y + this.height / 2, 0, 0, 15);
                }
            }
            return;
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

        if (keys['w'] || keys['keyw'] || keys['arrowup']) {
            force = this.acceleration;
        } else if (keys['s'] || keys['keys'] || keys['arrowdown']) {
            force = -this.acceleration;
        } else {
            this.vx *= 0.98;
            this.vy *= 0.98;
        }

        if (keys[' ']) {
            force = -this.acceleration * 1.6;
            isBraking = true;
        }

        if (Math.abs(this.speed) > 0.4) {
            if (keys['a'] || keys['keya'] || keys['arrowleft']) {
                this.angle -= this.turnSpeed * Math.sign(this.speed);
            }
            if (keys['d'] || keys['keyd'] || keys['arrowright']) {
                this.angle += this.turnSpeed * Math.sign(this.speed);
            }
        }

        let forwardV = this.vx * Math.cos(this.angle) + this.vy * Math.sin(this.angle);
        let lateralV = -this.vx * Math.sin(this.angle) + this.vy * Math.cos(this.angle);

        forwardV += force;
        forwardV *= 0.98;

        let lateralGrip = isBraking ? 0.94 : (this.type === 'muscle' ? 0.88 : 0.82);
        lateralV *= lateralGrip;

        // Skid marks
        if (Math.abs(lateralV) > 1.2 || (isBraking && Math.abs(forwardV) > 1.5)) {
            let backWheelX = this.x + this.width / 2 - Math.cos(this.angle) * this.width * 0.35;
            let backWheelY = this.y + this.height / 2 - Math.sin(this.angle) * this.width * 0.35;
            if (typeof particleSystem !== 'undefined') {
                particleSystem.addSkidMark(backWheelX, backWheelY, this.angle, this.height * 0.7, 0.4);
            }
        }

        this.vx = forwardV * Math.cos(this.angle) - lateralV * Math.sin(this.angle);
        this.vy = forwardV * Math.sin(this.angle) + lateralV * Math.cos(this.angle);

        this.speed = Math.sign(forwardV) * Math.sqrt(this.vx * this.vx + this.vy * this.vy);

        if (Math.abs(this.speed) > this.maxSpeed) {
            let ratio = this.maxSpeed / Math.abs(this.speed);
            this.vx *= ratio;
            this.vy *= ratio;
            this.speed = Math.sign(this.speed) * this.maxSpeed;
        }

        let newX = this.x + this.vx;
        let newY = this.y + this.vy;

        let collidingCar = this.getCollidingCar(newX, newY, cars);

        if (!this.isCollidingWithBuildings(newX, newY, buildings) && !collidingCar) {
            this.x = newX;
            this.y = newY;
        } else {
            if (collidingCar) {
                this.resolveCarCollision(collidingCar);
            } else {
                let impactSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                if (impactSpeed > 2) {
                    this.takeDamage(impactSpeed * 4.5);
                    if (typeof audioSystem !== 'undefined') audioSystem.playCrash(impactSpeed);
                }
                this.vx *= -0.5;
                this.vy *= -0.5;
                this.speed *= -0.5;
            }
        }

        this.x = Math.max(0, Math.min(worldSize.width - this.width, this.x));
        this.y = Math.max(0, Math.min(worldSize.height - this.height, this.y));
    }

    updateAICar(buildings, cars, roads, trafficLights, worldSize) {
        this.positionHistory.push({ x: this.x, y: this.y });
        if (this.positionHistory.length > 20) {
            this.positionHistory.shift();
            const firstPos = this.positionHistory[0];
            const distanceMoved = Math.sqrt((this.x - firstPos.x) ** 2 + (this.y - firstPos.y) ** 2);
            if (distanceMoved < 10) {
                this.stuckTimer++;
                if (this.stuckTimer > 30) {
                    this.handleStuckSituation(roads);
                    return;
                }
            } else {
                this.stuckTimer = 0;
            }
        }

        let onRoad = this.isOnRoad(roads);
        let currentRoad = this.getCurrentRoad(roads);
        let hasObstacleAhead = this.detectObstacleAhead(buildings, cars);

        let targetAccel = this.acceleration * 0.1;
        let maxCruise = this.maxSpeed * 0.65;

        if (this.isPolice && !this.exploded && typeof player !== 'undefined') {
            maxCruise = this.maxSpeed;
            targetAccel = this.acceleration * 0.4;

            let targetX = player.inCar && player.car ? player.car.x + player.car.width / 2 : player.x + player.width / 2;
            let targetY = player.inCar && player.car ? player.car.y + player.car.height / 2 : player.y + player.height / 2;

            if (player.inCar && player.car && Math.abs(player.car.speed) > 2) {
                targetX += player.car.vx * 15;
                targetY += player.car.vy * 15;
            }

            let dx = targetX - (this.x + this.width / 2);
            let dy = targetY - (this.y + this.height / 2);
            this.targetDirection = Math.atan2(dy, dx);

            if (hasObstacleAhead) {
                this.speed *= 0.88;
            } else {
                this.speed = Math.min(this.speed + targetAccel, maxCruise);
            }
        } else {
            if (hasObstacleAhead) {
                this.speed *= 0.8;
            } else {
                this.speed = Math.min(this.speed + targetAccel, maxCruise);
            }

            if (onRoad && currentRoad) {
                let atIntersection = this.isAtIntersection(currentRoad, roads);

                if (atIntersection) {
                    let light = trafficLights.find(l => Math.abs(l.x - (this.x + this.width / 2)) < 150 && Math.abs(l.y - (this.y + this.height / 2)) < 150);
                    if (light && light.state === 'red') {
                        let dx = light.x - this.x;
                        let dy = light.y - this.y;
                        let angleToLight = Math.atan2(dy, dx);
                        let angleDiff = Math.abs(Math.atan2(Math.sin(this.angle - angleToLight), Math.cos(this.angle - angleToLight)));
                        if (angleDiff < Math.PI / 3) {
                            this.speed *= 0.7;
                        }
                    }

                    if (!this.lastIntersection) {
                        this.lastIntersection = { x: Math.floor(this.x / 300) * 300, y: Math.floor(this.y / 300) * 300 };
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

        if (Math.abs(this.speed) > 0.5) {
            let angleDiff = Math.atan2(Math.sin(this.targetDirection - this.angle), Math.cos(this.targetDirection - this.angle));
            if (Math.abs(angleDiff) > 0.05) {
                this.angle += Math.sign(angleDiff) * this.turnSpeed * Math.min(this.speed / maxCruise, 1.0);
            }
        }

        this.vx = Math.cos(this.angle) * this.speed;
        this.vy = Math.sin(this.angle) * this.speed;

        let newX = this.x + this.vx;
        let newY = this.y + this.vy;

        if (!this.isCollidingWithBuildings(newX, newY, buildings) &&
            !this.isCollidingWithCars(newX, newY, cars)) {
            this.x = newX;
            this.y = newY;
        } else {
            this.handleSmartCollision(buildings, cars, roads);
        }

        if (this.x < 0 || this.x > worldSize.width - this.width ||
            this.y < 0 || this.y > worldSize.height - this.height) {
            this.handleBoundaryCollision(roads, worldSize);
        }
    }

    detectObstacleAhead(buildings, cars) {
        let sensorDist = Math.max(this.speed * 12, 40);
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
            if (this.isPolice && car.isPlayerCar) continue;

            if (px > car.x - 10 && px < car.x + car.width + 10 &&
                py > car.y - 10 && py < car.y + car.height + 10) {
                let angleToCar = Math.atan2(car.y - this.y, car.x - this.x);
                let angleDiff = Math.abs(Math.atan2(Math.sin(angleToCar - this.angle), Math.cos(angleToCar - this.angle)));
                if (angleDiff < Math.PI / 2) return true;
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
            let targetY = currentRoad.y + currentRoad.height * 0.75;
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
            let targetX = currentRoad.x + currentRoad.width * 0.25;
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
        let normAngle = Math.atan2(Math.sin(this.angle), Math.cos(this.angle));
        let currentDir = Math.round(normAngle / (Math.PI / 2)) * (Math.PI / 2);
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
        let impactSpeed = Math.abs(this.speed);
        if (impactSpeed > 2 && Math.random() > 0.8) {
            this.takeDamage(impactSpeed * 2);
        }

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
        this.targetDirection = bestDirection;
        this.speed = 1.0;
        this.vx = Math.cos(this.angle) * this.speed;
        this.vy = Math.sin(this.angle) * this.speed;
    }

    handleStuckSituation(roads) {
        this.speed = 1.5;
        this.angle += (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
        this.targetDirection = this.angle;
        this.stuckTimer = 0;

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
        this.targetDirection = Math.atan2(Math.sin((this.angle + Math.PI)), Math.cos(this.angle + Math.PI));
        this.angle = this.targetDirection;

        if (this.x < 0) this.x = 0;
        if (this.x > worldSize.width - this.width) this.x = worldSize.width - this.width;
        if (this.y < 0) this.y = 0;
        if (this.y > worldSize.height - this.height) this.y = worldSize.height - this.height;
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
                distance = Math.abs(centerY - (road.y + road.height / 2));
            } else {
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
            if (typeof audioSystem !== 'undefined') {
                audioSystem.playExplosion();
            }
        }
    }

    getCollidingCar(x, y, cars) {
        for (let car of cars) {
            if (car === this) continue;
            if (x < car.x + car.width && x + this.width > car.x &&
                y < car.y + car.height && y + this.height > car.y) {
                return car;
            }
        }
        return null;
    }

    resolveCarCollision(other) {
        let dx = (other.x + other.width / 2) - (this.x + this.width / 2);
        let dy = (other.y + other.height / 2) - (this.y + this.height / 2);
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;

        let nx = dx / dist;
        let ny = dy / dist;

        let rvx = other.vx - this.vx;
        let rvy = other.vy - this.vy;
        let velAlongNormal = rvx * nx + rvy * ny;

        if (velAlongNormal < 0) {
            let restitution = 0.45;
            let impulseScalar = -(1 + restitution) * velAlongNormal / 2;

            this.vx -= impulseScalar * nx;
            this.vy -= impulseScalar * ny;
            this.speed = this.vx * Math.cos(this.angle) + this.vy * Math.sin(this.angle);

            other.vx += impulseScalar * nx;
            other.vy += impulseScalar * ny;
            other.speed = other.vx * Math.cos(other.angle) + other.vy * Math.sin(other.angle);
        }

        let overlap = (this.width / 2 + other.width / 2) - dist;
        if (overlap > 0) {
            this.x -= nx * overlap * 0.5;
            this.y -= ny * overlap * 0.5;
            other.x += nx * overlap * 0.5;
            other.y += ny * overlap * 0.5;
        }

        let impactSpeed = Math.abs(velAlongNormal);
        if (impactSpeed > 1.2) {
            this.takeDamage(impactSpeed * 3.5);
            other.takeDamage(impactSpeed * 3.5);
            if (typeof audioSystem !== 'undefined') audioSystem.playCrash(impactSpeed);
            if (typeof particleSystem !== 'undefined') {
                particleSystem.addDebris((this.x + other.x) / 2, (this.y + other.y) / 2, 6);
            }
        }
    }

    draw(ctx, cameraX, cameraY) {
        ctx.save();

        let cx = this.x + this.width / 2;
        let cy = this.y + this.height / 2;

        // Apply airborne visual scale & 3D shadow offset
        let zScale = 1.0 + (this.airborneZ * 0.05);

        // Ground shadow (drawn at ground level)
        if (this.isAirborne) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(this.angle);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(-this.width / 2 + this.airborneZ * 4, -this.height / 2 + this.airborneZ * 4, this.width, this.height);
            ctx.restore();
        }

        ctx.translate(cx, cy - this.airborneZ * 3);
        ctx.scale(zScale, zScale);
        ctx.rotate(this.angle);

        let halfWidth = this.width / 2;
        let halfHeight = this.height / 2;

        if (!this.isAirborne) {
            // Normal shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
            ctx.fillRect(-halfWidth + 2, -halfHeight + 2, this.width, this.height);
        }

        let displayColor = this.exploded ? '#222222' : this.color;

        if (this.type === 'bike') {
            // Motorcycle Graphics
            ctx.fillStyle = '#111';
            // Front & Back Tires
            ctx.fillRect(halfWidth - 8, -2.5, 8, 5);
            ctx.fillRect(-halfWidth, -2.5, 8, 5);

            // Bike Frame
            ctx.fillStyle = displayColor;
            ctx.fillRect(-halfWidth + 6, -3, this.width - 12, 6);

            // Handlebars
            ctx.fillStyle = '#C0C0C0';
            ctx.fillRect(halfWidth - 9, -5.5, 2, 11);

            // Rider Body on top of bike
            if (!this.exploded) {
                ctx.fillStyle = '#1565C0'; // Blue shirt
                ctx.fillRect(-halfWidth + 8, -4, 10, 8);
                ctx.fillStyle = '#FDBCB4'; // Skin head / Helmet
                ctx.beginPath();
                ctx.arc(-halfWidth + 12, 0, 3.5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
            return;
        }

        if (this.type === 'tank') {
            // Tank Body & Tracks
            ctx.fillStyle = '#1B3012'; // Dark green treads
            ctx.fillRect(-halfWidth, -halfHeight, this.width, 6);
            ctx.fillRect(-halfWidth, halfHeight - 6, this.width, 6);

            // Tank Hull
            ctx.fillStyle = displayColor;
            ctx.fillRect(-halfWidth + 4, -halfHeight + 5, this.width - 8, this.height - 10);
            ctx.strokeStyle = '#1B3012';
            ctx.lineWidth = 2;
            ctx.strokeRect(-halfWidth + 4, -halfHeight + 5, this.width - 8, this.height - 10);

            // Turret & Cannon Barrel
            ctx.fillStyle = '#254E18';
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#1B3012';
            ctx.fillRect(0, -2.5, halfWidth + 10, 5); // Long Cannon
            ctx.restore();
            return;
        }

        // Car Body Gradient
        const bodyGradient = ctx.createLinearGradient(halfWidth, -halfHeight, -halfWidth, halfHeight);
        bodyGradient.addColorStop(0, this.shadeColor(displayColor, 20));
        bodyGradient.addColorStop(0.5, displayColor);
        bodyGradient.addColorStop(1, this.shadeColor(displayColor, -25));
        ctx.fillStyle = bodyGradient;
        ctx.fillRect(-halfWidth, -halfHeight, this.width, this.height);

        // Car outline
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.8;
        ctx.strokeRect(-halfWidth, -halfHeight, this.width, this.height);

        // Wheels
        ctx.fillStyle = '#1c1c1c';
        let wheelW = Math.max(7, Math.floor(this.width * 0.2));
        let wheelH = 4;
        ctx.fillRect(halfWidth - wheelW - 4, -halfHeight - 2, wheelW, wheelH);
        ctx.fillRect(halfWidth - wheelW - 4, halfHeight - 2, wheelW, wheelH);
        ctx.fillRect(-halfWidth + 6, -halfHeight - 2, wheelW, wheelH);
        ctx.fillRect(-halfWidth + 6, halfHeight - 2, wheelW, wheelH);

        // Metallic rims
        ctx.fillStyle = '#a8a8a8';
        ctx.fillRect(halfWidth - wheelW - 2, -halfHeight - 1, wheelW - 4, 2);
        ctx.fillRect(halfWidth - wheelW - 2, halfHeight - 1, wheelW - 4, 2);
        ctx.fillRect(-halfWidth + 8, -halfHeight - 1, wheelW - 4, 2);
        ctx.fillRect(-halfWidth + 8, halfHeight - 1, wheelW - 4, 2);

        if (!this.exploded) {
            // Supercar Racing Stripes
            if (this.type === 'supercar') {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(-halfWidth, -3, this.width, 2);
                ctx.fillRect(-halfWidth, 1, this.width, 2);
                // Rear Spoiler
                ctx.fillStyle = '#111111';
                ctx.fillRect(-halfWidth - 3, -halfHeight + 2, 4, this.height - 4);
            }

            // Taxi Checkerboard Stripe
            if (this.type === 'taxi') {
                for (let i = -halfWidth + 4; i < halfWidth - 6; i += 6) {
                    ctx.fillStyle = (i % 12 === 0) ? '#000' : '#FFF';
                    ctx.fillRect(i, -halfHeight + 2, 3, 2);
                    ctx.fillRect(i, halfHeight - 4, 3, 2);
                }
                // Taxi Roof Light
                ctx.fillStyle = '#FFF';
                ctx.fillRect(-4, -4, 8, 8);
                ctx.fillStyle = '#FF9900';
                ctx.fillRect(-3, -3, 6, 6);
            }

            // Car roof
            const roofGradient = ctx.createLinearGradient(-halfWidth + 12, 0, halfWidth - 12, 0);
            roofGradient.addColorStop(0, this.shadeColor(displayColor, -10));
            roofGradient.addColorStop(1, this.shadeColor(displayColor, -30));
            ctx.fillStyle = roofGradient;
            ctx.fillRect(-halfWidth + 12, -halfHeight + 2, this.width - 24, this.height - 4);

            // Front Windshield
            ctx.fillStyle = 'rgba(135, 206, 250, 0.85)';
            ctx.beginPath();
            ctx.moveTo(halfWidth - 12, -halfHeight + 3);
            ctx.quadraticCurveTo(halfWidth - 6, 0, halfWidth - 12, halfHeight - 3);
            ctx.lineTo(halfWidth - 15, halfHeight - 3);
            ctx.quadraticCurveTo(halfWidth - 10, 0, halfWidth - 15, -halfHeight + 3);
            ctx.closePath();
            ctx.fill();

            // Rear windshield
            ctx.fillStyle = 'rgba(135, 206, 250, 0.7)';
            ctx.fillRect(-halfWidth + 12, -halfHeight + 3, 3, this.height - 6);

            // Side windows
            ctx.fillStyle = 'rgba(135, 206, 250, 0.75)';
            ctx.fillRect(-halfWidth + 15, -halfHeight + 2, this.width - 32, 2);
            ctx.fillRect(-halfWidth + 15, halfHeight - 4, this.width - 32, 2);

            // Headlights
            ctx.fillStyle = '#FFFFEE';
            ctx.fillRect(halfWidth - 3, -halfHeight + 2, 4, 3);
            ctx.fillRect(halfWidth - 3, halfHeight - 5, 4, 3);

            // Taillights
            ctx.fillStyle = '#8B0000';
            ctx.fillRect(-halfWidth - 1, -halfHeight + 2, 2, 3);
            ctx.fillRect(-halfWidth - 1, halfHeight - 5, 2, 3);

            // Emergency Roof Beacons & Sirens
            if (this.isPolice || this.type === 'ambulance' || this.type === 'firetruck') {
                let flash = Math.floor(Date.now() / 150) % 2;
                ctx.fillStyle = flash === 0 ? '#FF1744' : '#2979FF';
                ctx.fillRect(-3, -halfHeight + 4, 6, this.height - 8);
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(-1, -2, 2, 4);
            }
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Car;
}
