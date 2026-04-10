class Pedestrian {
    constructor(x, y, worldSize) {
        this.x = x;
        this.y = y;
        this.width = 14;
        this.height = 14;
        this.speed = 0.5 + Math.random() * 0.5;
        this.angle = Math.random() * Math.PI * 2;
        this.worldSize = worldSize;
        this.state = 'walk'; // walk, flee, dead
        this.health = 20;
        this.color = `hsl(${Math.random() * 360}, 70%, 50%)`;
        this.timer = 0;
    }

    update(buildings, cars, player, roads) {
        if (this.state === 'dead') return;

        // Flee logic
        // Check if player is shooting or nearby in a fast car
        let dx = this.x - player.x;
        let dy = this.y - player.y;
        let distToPlayer = Math.sqrt(dx * dx + dy * dy);

        if (distToPlayer < 200 && (player.inCar && Math.abs(player.car.speed) > 3 || (player.overrideAngle !== null))) {
            this.state = 'flee';
            this.angle = Math.atan2(dy, dx); // run away from player
            this.speed = 2.5;
        } else if (this.state === 'flee') {
            this.speed *= 0.99;
            if (this.speed < 1) {
                this.state = 'walk';
                this.speed = 0.5 + Math.random() * 0.5;
            }
        } else {
            // Wandering
            this.timer++;
            if (this.timer > 120) {
                this.timer = 0;
                this.angle += (Math.random() - 0.5) * Math.PI;
            }
        }

        let newX = this.x + Math.cos(this.angle) * this.speed;
        let newY = this.y + Math.sin(this.angle) * this.speed;

        // rudimentary collision
        let collision = false;
        for (let b of buildings) {
            if (newX > b.x - 10 && newX < b.x + b.width + 10 &&
                newY > b.y - 10 && newY < b.y + b.height + 10) {
                collision = true;
                break;
            }
        }

        if (collision) {
            this.angle += Math.PI; // turnaround
        } else {
            this.x = newX;
            this.y = newY;
        }

        // Keep in bounds
        this.x = Math.max(0, Math.min(this.worldSize.width - this.width, this.x));
        this.y = Math.max(0, Math.min(this.worldSize.height - this.height, this.y));

        // Check if hit by a car
        for (let car of cars) {
            if (Math.abs(car.speed) > 1 && !car.exploded) {
                // box check
                if (this.x > car.x - 10 && this.x < car.x + car.width + 10 &&
                    this.y > car.y - 10 && this.y < car.y + car.height + 10) {
                    this.die();
                    if (typeof particleSystem !== 'undefined') {
                        particleSystem.addSmoke(this.x, this.y); // blood/dirt effect
                    }
                    if (car.isPlayerCar && typeof wantedLevel !== 'undefined') {
                        if (wantedLevel < 2) wantedLevel = 2; // Hit and run
                    }
                }
            }
        }
    }

    takeDamage(amt) {
        if (this.state === 'dead') return;
        this.health -= amt;
        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        this.state = 'dead';
        this.color = '#880000'; // dead
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Draw shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-this.width / 2 + 1, -this.height / 2 + 1, this.width, this.height);

        if (this.state === 'dead') {
            // Draw blood pool
            ctx.fillStyle = '#880000';
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Draw person (shoulders/head)
            ctx.fillStyle = this.color;
            ctx.fillRect(-8, -this.width / 2 + 2, 16, this.width - 4);
            ctx.fillStyle = '#FDBCB4';
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}
