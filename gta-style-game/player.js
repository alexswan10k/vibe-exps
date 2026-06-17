// Player module

class Player {
    constructor(x, y, worldSize) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
        this.speed = 3.2;
        this.inCar = false;
        this.car = null;
        this.worldWidth = worldSize.width;
        this.worldHeight = worldSize.height;
        this.overrideAngle = null;
        this.angle = 0;
    }

    update(keys, buildings) {
        if (this.inCar) {
            // Player is in car, movement handled by car
            return;
        }

        let dx = 0, dy = 0;
        let isMoving = false;

        if (keys['w'] || keys['keyw'] || keys['arrowup']) {
            dy -= this.speed;
            isMoving = true;
        }
        if (keys['s'] || keys['keys'] || keys['arrowdown']) {
            dy += this.speed;
            isMoving = true;
        }
        if (keys['a'] || keys['keya'] || keys['arrowleft']) {
            dx -= this.speed;
            isMoving = true;
        }
        if (keys['d'] || keys['keyd'] || keys['arrowright']) {
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
        if (isMoving) {
            this.angle = Math.atan2(dy, dx);
        }
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
        if (Math.abs(this.x + this.width / 2 - (car.x + car.width / 2)) < 65 &&
            Math.abs(this.y + this.height / 2 - (car.y + car.height / 2)) < 65) {
            this.inCar = true;
            this.car = car;
            car.isPlayerCar = true; // Take control of this car

            // Initialize velocity for drifting
            car.vx = Math.cos(car.angle) * car.speed;
            car.vy = Math.sin(car.angle) * car.speed;

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

            let drawAngle = this.angle;
            if (this.overrideAngle !== undefined && this.overrideAngle !== null) {
                drawAngle = this.overrideAngle;
            }
            ctx.rotate(drawAngle);

            // Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            ctx.fillRect(-8 + 2, -10 + 2, 16, 20);

            // Legs walking animation
            if (this.isMoving) {
                let walkCycle = Math.sin(Date.now() * 0.015) * 6;
                ctx.fillStyle = '#000080'; // Jeans color
                // Left leg
                ctx.fillRect(-6 + walkCycle, -8, 8, 5);
                // Right leg
                ctx.fillRect(-6 - walkCycle, 3, 8, 5);
            } else {
                ctx.fillStyle = '#000080';
                ctx.fillRect(-6, -7, 6, 5);
                ctx.fillRect(-6, 2, 6, 5);
            }

            // Torso (shoulders along Y-axis)
            ctx.fillStyle = '#4169E1'; // Royal blue shirt
            ctx.fillRect(-5, -10, 10, 20);

            // Head (centered)
            ctx.fillStyle = '#FDBCB4'; // Skin tone
            ctx.beginPath();
            ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
            ctx.fill();

            // Hair (on the back/West side of head)
            ctx.fillStyle = '#8B4513'; // Brown hair
            ctx.beginPath();
            ctx.arc(-2, 0, 4.5, Math.PI / 2, 3 * Math.PI / 2);
            ctx.fill();
            ctx.fillRect(-4, -4.5, 3, 9); // hair bulk

            // Eyes (looking East)
            ctx.fillStyle = '#FFF'; // Whites
            ctx.fillRect(2, -3, 1.5, 1.5);
            ctx.fillRect(2, 1.5, 1.5, 1.5);
            ctx.fillStyle = '#000'; // Pupils
            ctx.fillRect(3, -2.5, 1, 1);
            ctx.fillRect(3, 2, 1, 1);

            // Weapon drawing overlay
            if (this.overrideAngle !== undefined && this.overrideAngle !== null) {
                // Determine current weapon type from game state
                let currentWeapon = 1; // default to pistol
                if (typeof playerWeaponIndex !== 'undefined') {
                    currentWeapon = playerWeaponIndex;
                }
                
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 2.5;
                ctx.fillStyle = '#222';

                // Fists/Melee is 0, Pistol is 1, Shotgun is 2, Uzi/SMG is 3, RPG is 4
                if (currentWeapon === 1) {
                    // Pistol: single hand forward
                    ctx.beginPath();
                    ctx.moveTo(3, -5);
                    ctx.lineTo(12, -5); // gun barrel
                    ctx.stroke();
                } else if (currentWeapon === 2) {
                    // Shotgun: two hands, long barrel
                    ctx.lineWidth = 3.5;
                    ctx.beginPath();
                    ctx.moveTo(0, -5);
                    ctx.lineTo(16, -2); // barrel
                    ctx.stroke();
                } else if (currentWeapon === 3) {
                    // Machine gun: short dual barrel
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(3, -6);
                    ctx.lineTo(14, -6);
                    ctx.moveTo(3, 3);
                    ctx.lineTo(12, 3);
                    ctx.stroke();
                } else if (currentWeapon === 4) {
                    // RPG: Huge launcher on shoulder
                    ctx.fillStyle = '#2b3a2b'; // green launcher
                    ctx.strokeStyle = '#1a241a';
                    ctx.fillRect(-5, -12, 22, 5); // RPG tube
                    ctx.fillStyle = '#4f4f4f'; // metal head
                    ctx.beginPath();
                    ctx.moveTo(17, -13);
                    ctx.lineTo(22, -9.5);
                    ctx.lineTo(17, -6);
                    ctx.closePath();
                    ctx.fill();
                }
            } else {
                // Hands resting at sides
                ctx.fillStyle = '#FDBCB4'; // Skin tone hands
                ctx.beginPath();
                ctx.arc(2, -9, 2, 0, Math.PI * 2);
                ctx.arc(2, 9, 2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Player;
}
