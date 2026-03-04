class Bike {
    constructor(x, y, angle, color, isPlayer = false) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.color = color;
        this.isPlayer = isPlayer;

        this.speed = 0;
        this.maxSpeed = 250; // pixels per second
        this.acceleration = 300;
        this.friction = 150;
        this.turnSpeed = Math.PI; // radians per second

        this.state = 'normal';
        this.crashTimer = 0;
        this.crashDuration = 1.0; // seconds

        // Racing stats
        this.currentLap = 0;
        this.lapsCompleted = -1; // -1 means before crossing start line first time
        this.currentWaypoint = 0;
        this.lastPassedWaypoint = -1;
        this.distanceToNextWaypoint = 0; // used for sorting positions

        this.skidMarks = []; // Array of {x, y, age}

        this.lastSafeX = x;
        this.lastSafeY = y;
        this.lastSafeAngle = angle;
    }

    resetRotation(x, y, angle) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = 0;
        this.state = 'normal';
        this.lapsCompleted = -1;
        this.currentWaypoint = 0;
        this.lastPassedWaypoint = -1;
        this.skidMarks = [];
    }

    update(dt, thrust, turnDir, collisionCtx) {
        if (this.state === 'crashed') {
            this.crashTimer -= dt;
            if (this.crashTimer <= 0) {
                this.state = 'normal';
            }
            // Still slide a bit while crashed with high friction
            this.speed = Math.max(0, this.speed - this.friction * 4 * dt);
        } else {
            // Steering - proportional to speed
            if (this.speed > 5) {
                const speedFactor = Math.min(this.speed / 100, 1.0); // Don't turn on a dime at very low speed, but turn well at mid speed
                this.angle += turnDir * this.turnSpeed * dt * speedFactor;
            }

            // Acceleration & Friction
            if (thrust) {
                this.speed += this.acceleration * dt;
            } else {
                this.speed -= this.friction * dt;
            }

            this.speed = MathUtils.clamp(this.speed, 0, this.maxSpeed);

            // Record skid marks if turning and going fast
            if (Math.abs(turnDir) > 0 && this.speed > this.maxSpeed * 0.7) {
                if (Math.random() < 0.3) {
                    this.skidMarks.push({ x: this.x, y: this.y, age: 0 });
                }
            }
        }

        // Apply velocity
        const dx = Math.cos(this.angle) * this.speed * dt;
        const dy = Math.sin(this.angle) * this.speed * dt;

        this.x += dx;
        this.y += dy;

        // Check collision (if we moved)
        if (this.state !== 'crashed' && collisionCtx && this.speed > 0) {
            // Read pixel from collision map
            // Round coordinates to make sure we query inside the canvas efficiently
            const px = Math.floor(MathUtils.clamp(this.x, 0, collisionCtx.canvas.width - 1));
            const py = Math.floor(MathUtils.clamp(this.y, 0, collisionCtx.canvas.height - 1));

            const imgData = collisionCtx.getImageData(px, py, 1, 1).data;
            // Since off-track is black [0,0,0] and safe is white, if Red channel is low, we're off track
            if (imgData[0] < 128) {
                this.crash();
                // Bounce back slightly
                this.x -= dx * 2;
                this.y -= dy * 2;
                this.speed *= 0.2; // lose massive speed
            } else {
                // Save safe position occasionally? 
                if (Math.random() < 0.1) {
                    this.lastSafeX = this.x;
                    this.lastSafeY = this.y;
                    this.lastSafeAngle = this.angle;
                }
            }
        }
    }

    crash() {
        if (this.state !== 'crashed') {
            this.state = 'crashed';
            this.crashTimer = this.crashDuration;
            // Add a skid mark precisely when we crash
            this.skidMarks.push({ x: this.x, y: this.y, age: -1 }); // Special negative age for permanent crash mark
        }
    }

    drawSkidMarks(ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        for (let i = this.skidMarks.length - 1; i >= 0; i--) {
            const mark = this.skidMarks[i];
            if (mark.age >= 0) {
                mark.age += 0.016; // Approx tick
                if (mark.age > 2) { // 2 seconds fade
                    this.skidMarks.splice(i, 1);
                    continue;
                }
            }
            ctx.beginPath();
            ctx.arc(mark.x, mark.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Blinking effect when crashed
        if (this.state === 'crashed') {
            const timeMs = Date.now();
            if (Math.floor(timeMs / 100) % 2 === 0) {
                ctx.globalAlpha = 0.5;
            }
        }

        // Draw bike body (Top down view)
        // Chassis
        ctx.fillStyle = this.color;
        ctx.fillRect(-10, -4, 20, 8);

        // Handlebars
        ctx.fillStyle = '#111';
        ctx.fillRect(5, -12, 4, 24);

        // Front Tire
        ctx.fillStyle = '#000';
        ctx.fillRect(10, -3, 8, 6);

        // Rear Tire
        ctx.fillRect(-14, -3, 8, 6);

        // Rider Head
        ctx.fillStyle = '#fff';
        if (this.isPlayer) {
            ctx.fillStyle = '#ffeb3b'; // Player has yellow helmet
        }
        ctx.beginPath();
        ctx.arc(-2, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }
}
