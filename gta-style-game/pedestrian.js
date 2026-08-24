class Pedestrian {
    constructor(x, y, worldSize) {
        this.x = x;
        this.y = y;
        this.width = 14;
        this.height = 14;
        this.speed = 0.5 + Math.random() * 0.6;
        this.angle = Math.random() * Math.PI * 2;
        this.worldSize = worldSize;
        this.state = 'walk'; // 'walk', 'sit', 'flee', 'dead'
        this.health = 25;
        this.timer = 0;

        // Visual Archetypes
        let archetypes = [
            { shirt: '#1E88E5', pants: '#0D47A1', hair: '#5D4037', type: 'citizen' },
            { shirt: '#212121', pants: '#37474F', hair: '#212121', type: 'suit' }, // businessman
            { shirt: '#D81B60', pants: '#4A148C', hair: '#FBC02D', type: 'tourist' },
            { shirt: '#F4511E', pants: '#263238', hair: '#3E2723', type: 'gangster' },
            { shirt: '#00ACC1', pants: '#FFF', hair: '#8D6E63', type: 'beachgoer' }
        ];
        this.outfit = archetypes[Math.floor(Math.random() * archetypes.length)];
    }

    update(buildings, cars, player, roads) {
        if (this.state === 'dead') return;

        let px = player.inCar && player.car ? player.car.x + player.car.width / 2 : player.x + player.width / 2;
        let py = player.inCar && player.car ? player.car.y + player.car.height / 2 : player.y + player.height / 2;
        let dx = this.x - px;
        let dy = this.y - py;
        let distToPlayer = Math.sqrt(dx * dx + dy * dy);

        // Flee logic: if player is shooting or driving fast nearby
        if (distToPlayer < 220 && ((player.inCar && player.car && Math.abs(player.car.speed) > 2.8) || player.overrideAngle !== null)) {
            this.state = 'flee';
            this.angle = Math.atan2(dy, dx);
            this.speed = 2.6;
        } else if (this.state === 'flee') {
            this.speed *= 0.99;
            if (this.speed < 1.0) {
                this.state = 'walk';
                this.speed = 0.5 + Math.random() * 0.5;
            }
        } else {
            // Wandering
            this.timer++;
            if (this.timer > 140) {
                this.timer = 0;
                this.angle += (Math.random() - 0.5) * Math.PI;
            }
        }

        let newX = this.x + Math.cos(this.angle) * this.speed;
        let newY = this.y + Math.sin(this.angle) * this.speed;

        let collision = false;
        if (typeof world !== 'undefined' && world.buildingGrid) {
            const BG = 288;
            const bx0 = Math.floor((newX - 10) / BG), bx1 = Math.floor((newX + this.width + 10) / BG);
            const by0 = Math.floor((newY - 10) / BG), by1 = Math.floor((newY + this.height + 10) / BG);
            outer:
            for (let byy = by0; byy <= by1; byy++) for (let bxx = bx0; bxx <= bx1; bxx++) {
                const arr = world.buildingGrid.get(bxx + ',' + byy);
                if (!arr) continue;
                for (let b of arr) {
                    if (newX > b.x - 10 && newX < b.x + b.width + 10 &&
                        newY > b.y - 10 && newY < b.y + b.height + 10) {
                        collision = true;
                        break outer;
                    }
                }
            }
        } else {
            for (let b of buildings) {
                if (newX > b.x - 10 && newX < b.x + b.width + 10 &&
                    newY > b.y - 10 && newY < b.y + b.height + 10) {
                    collision = true;
                    break;
                }
            }
        }

        if (collision) {
            this.angle += Math.PI * 0.8;
        } else {
            this.x = newX;
            this.y = newY;
        }

        this.x = Math.max(20, Math.min(this.worldSize.width - this.width - 20, this.x));
        this.y = Math.max(20, Math.min(this.worldSize.height - this.height - 20, this.y));

        // Check if run over by cars
        for (let car of cars) {
            if (Math.abs(car.speed) > 1.2 && !car.exploded && !car.isAirborne) {
                if (this.x > car.x - 8 && this.x < car.x + car.width + 8 &&
                    this.y > car.y - 8 && this.y < car.y + car.height + 8) {
                    this.die();
                    if (typeof particleSystem !== 'undefined') {
                        particleSystem.addDebris(this.x, this.y, 6, '#880000');
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
        if (typeof audioSystem !== 'undefined') {
            audioSystem.playScream();
        }

        // Drop physical cash pickup on ground!
        if (typeof propsManager !== 'undefined') {
            let cashAmt = 30 + Math.floor(Math.random() * 70);
            propsManager.addPickup('cash', this.x, this.y, cashAmt);
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Ground shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(-this.width / 2 + 1, -this.height / 2 + 1, this.width, this.height);

        if (this.state === 'dead') {
            // Blood pool on pavement
            ctx.fillStyle = '#8B0000';
            ctx.beginPath();
            ctx.arc(0, 0, 11, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Walking animation legs
            let legWalk = (this.state === 'flee' ? Math.sin(Date.now() * 0.03) : Math.sin(Date.now() * 0.015)) * 4;
            ctx.fillStyle = this.outfit.pants;
            ctx.fillRect(-5 + legWalk, -5, 5, 4);
            ctx.fillRect(-5 - legWalk, 1, 5, 4);

            // Shoulders & Shirt
            ctx.fillStyle = this.outfit.shirt;
            ctx.fillRect(-6, -6, 12, 12);

            // Head
            ctx.fillStyle = '#FDBCB4'; // skin
            ctx.beginPath();
            ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
            ctx.fill();

            // Hair
            ctx.fillStyle = this.outfit.hair;
            ctx.beginPath();
            ctx.arc(-2, 0, 4, Math.PI / 2, 3 * Math.PI / 2);
            ctx.fill();
        }

        ctx.restore();
    }
}
