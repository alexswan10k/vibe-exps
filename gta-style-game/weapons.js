class Bullet {
    constructor(x, y, angle, speed, damage, owner, isRPG = false) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = speed;
        this.damage = damage;
        this.owner = owner; // 'player' or 'enemy'
        this.isRPG = isRPG;
        this.life = isRPG ? 75 : 100; // frames before disappearing
        this.width = isRPG ? 7 : 4;
        this.active = true;
    }

    update(buildings, cars, worldSize) {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        this.life--;

        if (this.life <= 0 ||
            this.x < 0 || this.x > worldSize.width ||
            this.y < 0 || this.y > worldSize.height) {
            if (this.isRPG) {
                this.explode(cars, buildings);
            } else {
                this.active = false;
            }
            return;
        }

        // Check collisions with buildings
        for (let b of buildings) {
            if (this.x > b.x && this.x < b.x + b.width &&
                this.y > b.y && this.y < b.y + b.height) {
                if (this.isRPG) {
                    this.explode(cars, buildings);
                } else {
                    this.active = false;
                    if (typeof particleSystem !== 'undefined') {
                        particleSystem.addSmoke(this.x, this.y); // spark effect
                    }
                }
                return;
            }
        }

        // Check collisions with cars
        for (let car of cars) {
            if (!car.exploded &&
                this.x > car.x && this.x < car.x + car.width &&
                this.y > car.y && this.y < car.y + car.height) {
                
                if (this.isRPG) {
                    this.explode(cars, buildings);
                } else {
                    this.active = false;
                    car.takeDamage(this.damage);
                    if (typeof particleSystem !== 'undefined') {
                        particleSystem.addSmoke(this.x, this.y);
                    }
                    if (this.owner === 'player' && typeof wantedLevel !== 'undefined') {
                        if (wantedLevel === 0) wantedLevel = 1;
                    }
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
                    
                    if (this.isRPG) {
                        this.explode(cars, buildings);
                    } else {
                        this.active = false;
                        ped.takeDamage(this.damage);
                        if (typeof particleSystem !== 'undefined') {
                            particleSystem.addSmoke(this.x, this.y);
                        }
                        if (this.owner === 'player' && typeof wantedLevel !== 'undefined') {
                            if (wantedLevel < 3) wantedLevel = 3; // Murder!
                        }
                    }
                    return;
                }
            }
        }
    }

    explode(cars, buildings) {
        this.active = false;
        if (typeof particleSystem !== 'undefined') {
            particleSystem.addExplosion(this.x, this.y);
            // Spawn extra debris/smoke particles
            for (let i = 0; i < 15; i++) {
                particleSystem.addSmoke(this.x, this.y);
            }
        }
        if (typeof audioSystem !== 'undefined') {
            audioSystem.playExplosion();
        }

        const radius = 120;

        // Splash damage to cars
        for (let car of cars) {
            if (car.exploded) continue;
            let cx = car.x + car.width / 2;
            let cy = car.y + car.height / 2;
            let dist = Math.sqrt((cx - this.x) ** 2 + (cy - this.y) ** 2);
            if (dist < radius) {
                let dmg = Math.floor((1 - dist / radius) * 110);
                car.takeDamage(dmg);
            }
        }

        // Splash damage to pedestrians
        if (typeof pedestrians !== 'undefined') {
            for (let ped of pedestrians) {
                if (ped.state === 'dead') continue;
                let dist = Math.sqrt((ped.x - this.x) ** 2 + (ped.y - this.y) ** 2);
                if (dist < radius) {
                    let dmg = Math.floor((1 - dist / radius) * 100);
                    ped.takeDamage(dmg);
                }
            }
        }

        // Splash damage to player
        if (typeof player !== 'undefined' && !player.inCar) {
            let px = player.x + player.width / 2;
            let py = player.y + player.height / 2;
            let dist = Math.sqrt((px - this.x) ** 2 + (py - this.y) ** 2);
            if (dist < radius) {
                let dmg = Math.floor((1 - dist / radius) * 60);
                if (typeof playerArmor !== 'undefined' && playerArmor > 0) {
                    playerArmor -= dmg;
                    if (playerArmor < 0) {
                        playerHealth += playerArmor;
                        playerArmor = 0;
                    }
                } else if (typeof playerHealth !== 'undefined') {
                    playerHealth -= dmg;
                }
                if (typeof playerHealth !== 'undefined' && playerHealth < 0) {
                    playerHealth = 0;
                }
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        if (this.isRPG) {
            // Draw RPG rocket body
            ctx.fillStyle = '#2b3a2b'; // green rocket body
            ctx.fillRect(-8, -2.5, 12, 5);
            ctx.fillStyle = '#4f4f4f'; // metal head
            ctx.beginPath();
            ctx.moveTo(4, -3);
            ctx.lineTo(10, 0);
            ctx.lineTo(4, 3);
            ctx.closePath();
            ctx.fill();

            // Fins
            ctx.fillStyle = '#111';
            ctx.fillRect(-8, -4, 2, 8);

            // Rocket flame/smoke trail
            if (typeof particleSystem !== 'undefined' && Math.random() < 0.4) {
                let tailX = this.x - Math.cos(this.angle) * 10;
                let tailY = this.y - Math.sin(this.angle) * 10;
                particleSystem.addSmoke(tailX, tailY);
            }
        } else {
            ctx.fillStyle = '#FFFF00'; // yellowish bullet
            ctx.fillRect(-this.width / 2, -1, this.width, 2);

            // Bullet trail
            ctx.fillStyle = 'rgba(255, 255, 0, 0.45)';
            ctx.fillRect(-this.width / 2 - 15, -1, 15, 2);
        }
        ctx.restore();
    }
}

class WeaponSystem {
    constructor() {
        this.bullets = [];
        this.fireRateTimer = 0;
    }

    shoot(x, y, angle, owner = 'player') {
        if (this.fireRateTimer > 0) return false;

        if (owner === 'player') {
            const index = playerWeaponIndex;
            // Check ammo
            if (playerAmmo[index] <= 0) return false;

            if (index === 0) {
                // Fists: punch close-range
                this.fireRateTimer = 18;
                if (typeof audioSystem !== 'undefined') audioSystem.playPunch();
                
                // Deal melee damage
                this.meleeAttack(x, y, angle);
                return true;
            } else if (index === 1) {
                // Pistol: single bullet
                this.bullets.push(new Bullet(x, y, angle, 19, 16, owner, false));
                this.fireRateTimer = 16;
                if (typeof audioSystem !== 'undefined') audioSystem.playPistol();
                return true;
            } else if (index === 2) {
                // Shotgun: 5 pellets spread
                for (let i = -2; i <= 2; i++) {
                    let spreadAngle = angle + i * 0.07;
                    this.bullets.push(new Bullet(x, y, spreadAngle, 16 + Math.random() * 2, 10, owner, false));
                }
                playerAmmo[2]--;
                this.fireRateTimer = 45;
                if (typeof audioSystem !== 'undefined') audioSystem.playShotgun();
                return true;
            } else if (index === 3) {
                // Machine Gun: rapid fire
                let spreadAngle = angle + (Math.random() - 0.5) * 0.08;
                this.bullets.push(new Bullet(x, y, spreadAngle, 20, 12, owner, false));
                playerAmmo[3]--;
                this.fireRateTimer = 5;
                if (typeof audioSystem !== 'undefined') audioSystem.playMachineGun();
                return true;
            } else if (index === 4) {
                // RPG: slow moving rocket
                let b = new Bullet(x, y, angle, 9, 100, owner, true);
                this.bullets.push(b);
                playerAmmo[4]--;
                this.fireRateTimer = 85;
                if (typeof audioSystem !== 'undefined') audioSystem.playRPG();
                return true;
            }
        } else {
            // Enemy shooting (police, mafia etc) - default to pistol stats
            this.bullets.push(new Bullet(x, y, angle, 12, 10, owner, false));
            this.fireRateTimer = 25;
            if (typeof audioSystem !== 'undefined') audioSystem.playPistol();
            return true;
        }
        return false;
    }

    meleeAttack(x, y, angle) {
        let reach = 35;
        let punchX = x + Math.cos(angle) * reach;
        let punchY = y + Math.sin(angle) * reach;

        // Check if we hit a pedestrian
        if (typeof pedestrians !== 'undefined') {
            for (let ped of pedestrians) {
                if (ped.state === 'dead') continue;
                let dist = Math.sqrt((ped.x - punchX) ** 2 + (ped.y - punchY) ** 2);
                if (dist < 25) {
                    ped.takeDamage(12);
                    if (typeof wantedLevel !== 'undefined' && wantedLevel === 0) {
                        wantedLevel = 1; // Assault!
                    }
                    return;
                }
            }
        }

        // Check if we hit a car
        if (typeof cars !== 'undefined') {
            for (let car of cars) {
                if (car.exploded) continue;
                let cx = car.x + car.width / 2;
                let cy = car.y + car.height / 2;
                let dist = Math.sqrt((cx - punchX) ** 2 + (cy - punchY) ** 2);
                if (dist < 35) {
                    car.takeDamage(4); // kick car
                    return;
                }
            }
        }
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
