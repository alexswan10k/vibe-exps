class Entity {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.markedForDeletion = false;
    }

    update() {}
    draw(ctx) {}
}

class Enemy extends Entity {
    constructor(waypoints, typeConfig) {
        super(waypoints[0].x, waypoints[0].y);
        this.waypoints = waypoints;
        this.currentWaypointIndex = 1;
        this.hp = typeConfig.hp;
        this.maxHp = typeConfig.hp;
        this.speed = typeConfig.speed;
        this.reward = typeConfig.reward;
        this.color = typeConfig.color;
        this.radius = typeConfig.radius;
        this.reachedEnd = false;
    }

    update() {
        if (this.currentWaypointIndex >= this.waypoints.length) {
            this.reachedEnd = true;
            this.markedForDeletion = true;
            return;
        }

        const target = this.waypoints[this.currentWaypointIndex];
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.speed) {
            this.x = target.x;
            this.y = target.y;
            this.currentWaypointIndex++;
        } else {
            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.markedForDeletion = true;
            return true; // Killed
        }
        return false; // Still alive
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // HP Bar
        const hpPct = this.hp / this.maxHp;
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - 10, this.y - this.radius - 8, 20, 4);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - 10, this.y - this.radius - 8, 20 * hpPct, 4);
    }
}

class Tower extends Entity {
    constructor(col, row, typeKey) {
        const x = col * TILE_SIZE + TILE_SIZE / 2;
        const y = row * TILE_SIZE + TILE_SIZE / 2;
        super(x, y);
        this.col = col;
        this.row = row;
        this.type = typeKey;
        this.config = TOWERS[typeKey];
        this.cooldown = 0;
        this.angle = 0;
    }

    update(enemies, addProjectile) {
        if (this.cooldown > 0) {
            this.cooldown -= 1/60; // Assuming 60 FPS
        }

        if (this.cooldown <= 0) {
            const target = this.findTarget(enemies);
            if (target) {
                this.fire(target, addProjectile);
                this.cooldown = 1 / this.config.rate;
            }
        }
    }

    findTarget(enemies) {
        // Find closest enemy in range
        let closest = null;
        let minDist = Infinity;
        const rangePx = this.config.range * TILE_SIZE;

        for (const enemy of enemies) {
            const dist = getDistance(this, enemy);
            if (dist <= rangePx && dist < minDist) {
                minDist = dist;
                closest = enemy;
            }
        }
        return closest;
    }

    fire(target, addProjectile) {
        // Update angle to face target
        this.angle = Math.atan2(target.y - this.y, target.x - this.x);

        addProjectile(new Projectile(this.x, this.y, target, this.config));
    }

    draw(ctx) {
        // Base
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(this.x - 20, this.y - 20, 40, 40);

        // Turret (rotatable)
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        ctx.fillStyle = this.config.color;
        if (this.type === 'sniper') {
             ctx.fillRect(-10, -10, 30, 20); // Long barrel
        } else if (this.type === 'aoe') {
             ctx.beginPath();
             ctx.arc(0, 0, 15, 0, Math.PI * 2); // Round cannon
             ctx.fill();
        } else {
            ctx.fillRect(-10, -10, 20, 20);
            ctx.fillRect(0, -5, 25, 10); // Barrel
        }
        
        ctx.restore();
    }
}

class Projectile extends Entity {
    constructor(x, y, target, config) {
        super(x, y);
        this.target = target;
        this.speed = config.projectileSpeed;
        this.damage = config.damage;
        this.radius = 4;
        this.color = config.color;
        this.isAoE = config.radius !== undefined;
        this.aoeRadius = config.radius ? config.radius * TILE_SIZE : 0;
    }

    update() {
        if (this.target.markedForDeletion && !this.isAoE) {
            this.markedForDeletion = true; 
            return;
        }

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.speed) {
            this.x = this.target.x;
            this.y = this.target.y;
            this.hit();
        } else {
            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
        }
    }

    hit() {
        this.markedForDeletion = true;
        this.hasHit = true; 
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Particle extends Entity {
    constructor(x, y, color, speed, life) {
        super(x, y);
        this.color = color;
        this.life = life;
        this.maxLife = life;
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.radius = Math.random() * 3 + 1;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        if (this.life <= 0) {
            this.markedForDeletion = true;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}