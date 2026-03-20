class Bullet {
    constructor(x, y, angle, speed, damage, owner) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = speed;
        this.damage = damage;
        this.owner = owner; // 'player' or 'enemy'
        this.life = 100; // frames before disappearing
        this.width = 4;
        this.active = true;
    }

    update(buildings, cars, worldSize) {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        this.life--;

        if (this.life <= 0 ||
            this.x < 0 || this.x > worldSize.width ||
            this.y < 0 || this.y > worldSize.height) {
            this.active = false;
            return;
        }

        // Check collisions with buildings
        for (let b of buildings) {
            if (this.x > b.x && this.x < b.x + b.width &&
                this.y > b.y && this.y < b.y + b.height) {
                this.active = false;
                if (typeof particleSystem !== 'undefined') {
                    particleSystem.addSmoke(this.x, this.y); // spark effect
                }
                return;
            }
        }

        // Check collisions with cars
        for (let car of cars) {
            if (!car.exploded &&
                this.x > car.x && this.x < car.x + car.width &&
                this.y > car.y && this.y < car.y + car.height) {
                this.active = false;
                car.takeDamage(this.damage);
                if (typeof particleSystem !== 'undefined') {
                    particleSystem.addSmoke(this.x, this.y); // spark/smoke effect
                }

                // If player shot a car, they get a wanted level!
                if (this.owner === 'player' && typeof wantedLevel !== 'undefined') {
                    if (wantedLevel === 0) wantedLevel = 1;
                }
                return;
            }
        }

        // Check collisions with pedestrians
        if (typeof pedestrians !== 'undefined') {
            for (let ped of pedestrians) {
                if (ped.state !== 'dead' &&
                    this.x > ped.x - ped.width && this.x < ped.x + ped.width &&
                    this.y > ped.y - ped.height && this.y < ped.y + ped.height) {
                    this.active = false;
                    ped.takeDamage(this.damage);
                    if (typeof particleSystem !== 'undefined') {
                        particleSystem.addSmoke(this.x, this.y); // impact
                    }
                    if (this.owner === 'player' && typeof wantedLevel !== 'undefined') {
                        if (wantedLevel < 3) wantedLevel = 3; // Murder!
                    }
                    return;
                }
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = '#FFFF00'; // yellowish bullet
        ctx.fillRect(-this.width / 2, -1, this.width, 2);

        // Bullet trail
        ctx.fillStyle = 'rgba(255, 255, 0, 0.4)';
        ctx.fillRect(-this.width / 2 - 15, -1, 15, 2);
        ctx.restore();
    }
}

class WeaponSystem {
    constructor() {
        this.bullets = [];
        this.fireRateTimer = 0;
    }

    shoot(x, y, angle, owner = 'player') {
        if (this.fireRateTimer <= 0) {
            this.bullets.push(new Bullet(x, y, angle, 18, 15, owner));
            this.fireRateTimer = 8; // delay between shots
            return true;
        }
        return false;
    }

    update(deltaTime, buildings, cars, worldSize) {
        if (this.fireRateTimer > 0) this.fireRateTimer--;

        for (let i = this.bullets.length - 1; i >= 0; i--) {
            let b = this.bullets[i];
            b.update(buildings, cars, worldSize);
            if (!b.active) {
                this.bullets.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        for (let b of this.bullets) {
            b.draw(ctx);
        }
    }
}

const weaponSystem = new WeaponSystem();
