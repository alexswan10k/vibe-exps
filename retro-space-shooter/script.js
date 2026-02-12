class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 800;
        this.canvas.height = 600;

        this.player = new Player(this.canvas.width / 2, this.canvas.height - 50);
        this.projectiles = [];
        this.enemies = [];
        this.powerUps = [];
        this.particles = [];

        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.gameOver = false;

        this.level = 1;
        this.gameOver = false;
        this.paused = false;
        this.gameStarted = false;

        this.keys = {};
        this.lastShot = 0;
        this.shotCooldown = 200; // milliseconds
        this.scoreMultiplier = 1;
        this.multiplierTimer = 0;

        this.shake = 0;
        this.stars = [];
        this.initStars();

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        this.init();
        this.gameLoop();
    }

    initStars() {
        this.stars = [];
        for (let i = 0; i < 100; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 2,
                speed: Math.random() * 0.5 + 0.1, // Layer 1 (Far)
                brightness: Math.random()
            });
        }
        for (let i = 0; i < 50; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 2 + 1,
                speed: Math.random() * 1 + 0.5, // Layer 2 (Mid)
                brightness: Math.random()
            });
        }
        for (let i = 0; i < 20; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 3 + 1,
                speed: Math.random() * 2 + 1, // Layer 3 (Near)
                brightness: Math.random()
            });
        }
    }

    init() {
        this.setupEventListeners();
        this.spawnEnemies();
    }

    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyP') this.paused = !this.paused;
            if (e.code === 'Enter') this.gameStarted = true;
            this.keys[e.code] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        document.getElementById('restart-btn').addEventListener('click', () => {
            this.restart();
        });
    }

    update() {
        if (!this.gameStarted) return;
        if (this.gameOver) return;
        if (this.paused) return;

        this.updatePlayer();
        this.updateProjectiles();
        this.updateEnemies();
        this.updatePowerUps();
        this.updateParticles();
        this.checkCollisions();
        this.checkLevelProgress();

        if (this.shake > 0) {
            this.shake -= 1;
            if (this.shake < 0) this.shake = 0;
        }

        if (this.scoreMultiplier > 1) {
            this.multiplierTimer--;
            if (this.multiplierTimer <= 0) {
                this.scoreMultiplier = 1;
            }
        }
    }

    updatePlayer() {
        // Dash Check
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
            this.player.attemptDash();
        }
        this.player.update(); // Handle dash state

        // Movement
        if ((this.keys['ArrowLeft'] || this.keys['KeyA']) && this.player.x > 0) {
            this.player.move(-1, 0); // Use move method for dash logic integration
        }
        if ((this.keys['ArrowRight'] || this.keys['KeyD']) && this.player.x < this.canvas.width - this.player.width) {
            this.player.move(1, 0);
        }
        if ((this.keys['ArrowUp'] || this.keys['KeyW']) && this.player.y > 0) {
            this.player.move(0, -1);
        }
        if ((this.keys['ArrowDown'] || this.keys['KeyS']) && this.player.y < this.canvas.height - this.player.height) {
            this.player.move(0, 1);
        }

        // Shooting
        if ((this.keys['Space'] || this.keys['Enter']) && Date.now() - this.lastShot > this.shotCooldown) {
            this.shoot();
            this.lastShot = Date.now();
        }

        // Particle Trail
        if (Math.random() < 0.5 || this.player.isDashing) {
            const color = this.player.isDashing ? '#00ffff' : '#00ff00';
            this.particles.push(new Particle(this.player.x + this.player.width / 2, this.player.y + this.player.height, color, -1));
        }
    }

    shoot() {
        if (this.player.hasSpreadShot) {
            this.projectiles.push(new Projectile(this.player.x + this.player.width / 2 - 2, this.player.y, -5));
            this.projectiles.push(new Projectile(this.player.x + this.player.width / 2 - 2, this.player.y, -5, -0.2));
            this.projectiles.push(new Projectile(this.player.x + this.player.width / 2 - 2, this.player.y, -5, 0.2));
        } else {
            this.projectiles.push(new Projectile(this.player.x + this.player.width / 2 - 2, this.player.y, -5));
        }
        this.playSound('shoot');
    }

    updateProjectiles() {
        this.projectiles = this.projectiles.filter(projectile => {
            projectile.update();
            return projectile.y > -10;
        });
    }

    updateEnemies() {
        this.enemies.forEach(enemy => {
            enemy.update();
            if (Math.random() < 0.002) { // Random enemy shooting
                const projectile = new Projectile(enemy.x + enemy.width / 2 - 2, enemy.y + enemy.height, 3);
                this.projectiles.push(projectile);
            }
        });

        this.enemies = this.enemies.filter(enemy => enemy.y < this.canvas.height + 50);
    }

    updatePowerUps() {
        this.powerUps.forEach(powerUp => powerUp.update());
        this.powerUps = this.powerUps.filter(powerUp => powerUp.y < this.canvas.height + 50);
    }

    updateParticles() {
        this.particles.forEach(particle => particle.update());
        this.particles = this.particles.filter(particle => particle.life > 0);
    }

    checkCollisions() {
        // Player projectiles vs enemies
        this.projectiles.forEach((projectile, pIndex) => {
            if (projectile.speed > 0) return; // Skip enemy projectiles, only check player projectiles

            this.enemies.forEach((enemy, eIndex) => {
                if (this.isColliding(projectile, enemy)) {
                    this.projectiles.splice(pIndex, 1);

                    if (enemy instanceof Boss) {
                        enemy.hp -= 1;
                        this.createExplosion(projectile.x, projectile.y, '#ffff00');
                        if (enemy.hp <= 0) {
                            this.enemies.splice(eIndex, 1);
                            this.score += 500 * this.scoreMultiplier;
                            this.incrementMultiplier();
                            this.createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#ff0000');
                            this.playSound('explosion');
                            this.addShake(50);
                        }
                    } else {
                        this.enemies.splice(eIndex, 1);
                        this.score += 10 * this.scoreMultiplier;
                        this.incrementMultiplier();
                        this.createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
                        this.playSound('explosion');
                        this.addShake(5);
                    }

                    // Chance to spawn power-up
                    if (Math.random() < 0.1 || (enemy instanceof Boss)) {
                        this.powerUps.push(new PowerUp(enemy.x, enemy.y));
                    }
                }
            });
        });

        // Enemy projectiles vs player
        this.projectiles.forEach((projectile, pIndex) => {
            if (projectile.speed > 0 && this.isColliding(projectile, this.player)) {
                if (this.player.isDashing || this.player.shielded) return; // Invulnerable

                this.projectiles.splice(pIndex, 1);
                this.lives--;
                this.scoreMultiplier = 1; // Reset multiplier
                this.createExplosion(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, '#00ff00');
                this.playSound('explosion');
                this.addShake(20);
                if (this.lives <= 0) {
                    this.gameOver = true;
                }
            }
        });

        // Player vs enemies
        this.enemies.forEach((enemy, eIndex) => {
            if (this.isColliding(this.player, enemy)) {
                if (this.player.isDashing || this.player.shielded) {
                    // Dash kill!
                    this.enemies.splice(eIndex, 1);
                    this.createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
                    this.score += 50 * this.scoreMultiplier;
                    this.incrementMultiplier();
                    return;
                }

                this.enemies.splice(eIndex, 1);
                this.lives--;
                this.scoreMultiplier = 1; // Reset multiplier
                this.createExplosion(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, '#00ff00');
                this.playSound('explosion');
                this.addShake(20);
                if (this.lives <= 0) {
                    this.gameOver = true;
                }
            }
        });

        // Player vs power-ups
        this.powerUps.forEach((powerUp, pIndex) => {
            if (this.isColliding(this.player, powerUp)) {
                this.powerUps.splice(pIndex, 1);
                this.activatePowerUp(powerUp.type);
                this.playSound('powerup');
            }
        });
    }

    isColliding(obj1, obj2) {
        return obj1.x < obj2.x + obj2.width &&
            obj1.x + obj1.width > obj2.x &&
            obj1.y < obj2.y + obj2.height &&
            obj1.y + obj1.height > obj2.y;
    }

    createExplosion(x, y, color = '#ff0000') {
        for (let i = 0; i < 15; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    addShake(amount) {
        this.shake = amount;
    }

    activatePowerUp(type) {
        switch (type) {
            case 'rapidFire':
                this.shotCooldown = 100;
                setTimeout(() => this.shotCooldown = 200, 5000);
                break;
            case 'shield':
                this.player.shielded = true;
                setTimeout(() => this.player.shielded = false, 10000);
                break;
            case 'spreadShot':
                this.player.hasSpreadShot = true;
                setTimeout(() => this.player.hasSpreadShot = false, 10000);
                break;
        }
    }

    incrementMultiplier() {
        this.scoreMultiplier++;
        this.multiplierTimer = 200; // Reset timer
    }

    checkLevelProgress() {
        if (this.enemies.length === 0) {
            this.level++;
            this.spawnEnemies();
        }
    }

    spawnEnemies() {
        if (this.level % 5 === 0) {
            // Boss Level
            this.enemies.push(new Boss(this.canvas.width / 2 - 50, -100, this.level));
        } else {
            const enemyCount = 5 + this.level * 2;
            for (let i = 0; i < enemyCount; i++) {
                const x = Math.random() * (this.canvas.width - 40);
                const y = -50 - Math.random() * 200;
                this.enemies.push(new Enemy(x, y, this.level));
            }
        }
    }

    playSound(type) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        switch (type) {
            case 'shoot':
                oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.1);
                break;
            case 'explosion':
                // White noise buffer would be better, but enhancing osc for now
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(10, this.audioContext.currentTime + 0.3);
                gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.3);
                break;
            case 'powerup':
                oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
                oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.2);
                break;
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        if (this.shake > 0) {
            const dx = (Math.random() - 0.5) * this.shake;
            const dy = (Math.random() - 0.5) * this.shake;
            this.ctx.translate(dx, dy);
        }

        // Draw stars background
        this.drawBackground();

        this.player.draw(this.ctx);
        this.projectiles.forEach(projectile => projectile.draw(this.ctx));
        this.enemies.forEach(enemy => enemy.draw(this.ctx));
        this.powerUps.forEach(powerUp => powerUp.draw(this.ctx));
        this.particles.forEach(particle => particle.draw(this.ctx));

        this.ctx.restore();

        this.updateUI();
    }

    drawBackground() {
        this.stars.forEach(star => {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
            this.ctx.fillRect(star.x, star.y, star.size, star.size);
            star.y += star.speed;
            if (star.y > this.canvas.height) {
                star.y = 0;
                star.x = Math.random() * this.canvas.width;
            }
        });
    }

    updateUI() {
        document.getElementById('score').innerHTML = `Score: ${this.score} <span style="color: yellow; font-size: 0.8em;">x${this.scoreMultiplier}</span>`;
        document.getElementById('lives').textContent = `Lives: ${this.lives}`;
        document.getElementById('level').textContent = `Level: ${this.level}`;

        // Dash Cooldown UI (Canvas or DOM?) - Let's add simple DOM for now
        // Assuming we add a dash-bar div in HTML or just reuse existing UI


        if (this.gameOver) {
            document.getElementById('final-score').textContent = `Final Score: ${this.score}`;
            document.getElementById('game-over').classList.remove('hidden');
        }

        if (!this.gameStarted) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#00ffff';
            this.ctx.font = '40px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('NEON BLASTER', this.canvas.width / 2, this.canvas.height / 2 - 40);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '20px Arial';
            this.ctx.fillText('Press ENTER to Start', this.canvas.width / 2, this.canvas.height / 2 + 20);
            this.ctx.fillText('Arrows/WASD to Move', this.canvas.width / 2, this.canvas.height / 2 + 60);
            this.ctx.fillText('Space to Shoot', this.canvas.width / 2, this.canvas.height / 2 + 90);
            this.ctx.fillText('Shift to Dash', this.canvas.width / 2, this.canvas.height / 2 + 120);
            this.ctx.fillText('P to Pause', this.canvas.width / 2, this.canvas.height / 2 + 150);
        } else if (this.paused) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '40px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
        }
    }

    restart() {
        this.player = new Player(this.canvas.width / 2, this.canvas.height - 50);
        this.projectiles = [];
        this.enemies = [];
        this.powerUps = [];
        this.particles = [];
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.gameOver = false;
        this.shotCooldown = 200;
        document.getElementById('game-over').classList.add('hidden');
        this.spawnEnemies();
    }

    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.speed = 5;
        this.shielded = false;

        // Dash props
        this.dashCooldown = 0;
        this.isDashing = false;
        this.dashDuration = 0;
        this.hasSpreadShot = false;
    }

    move(dx, dy) {
        if (this.isDashing) {
            this.x += dx * this.speed * 4;
            this.y += dy * this.speed * 4;
        } else {
            this.x += dx * this.speed;
            this.y += dy * this.speed;
        }
    }

    attemptDash() {
        if (this.dashCooldown <= 0 && !this.isDashing) {
            this.isDashing = true;
            this.dashDuration = 10; // Frames
            this.dashCooldown = 120; // Frames (2 seconds)
        }
    }

    update() {
        if (this.isDashing) {
            this.dashDuration--;
            if (this.dashDuration <= 0) {
                this.isDashing = false;
            }
        }
        if (this.dashCooldown > 0) {
            this.dashCooldown--;
        }
    }

    draw(ctx) {
        const color = this.shielded || this.isDashing ? '#00ffff' : '#00ff00';

        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

        // Neon Glow
        ctx.shadowBlur = this.isDashing ? 25 : 15;
        ctx.shadowColor = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        // Draw Ship Shape (Arrowhead)
        ctx.beginPath();
        ctx.moveTo(0, -this.height / 2); // Nose
        ctx.lineTo(this.width / 2, this.height / 2); // Right wing
        ctx.lineTo(0, this.height / 4); // Rear indent
        ctx.lineTo(-this.width / 2, this.height / 2); // Left wing
        ctx.closePath();
        ctx.stroke();

        // Engine flicker
        if (Math.random() < 0.8 || this.isDashing) {
            ctx.fillStyle = this.isDashing ? '#00ffff' : '#ffff00';
            ctx.shadowBlur = 5;
            ctx.shadowColor = this.isDashing ? '#00ffff' : '#ff0000';
            ctx.beginPath();
            ctx.moveTo(-5, this.height / 4);
            ctx.lineTo(0, this.height / 4 + (this.isDashing ? 30 : 10) + Math.random() * 5);
            ctx.lineTo(5, this.height / 4);
            ctx.fill();
        }

        ctx.restore();
    }
}

class Projectile {
    constructor(x, y, speed, vx = 0) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 12; // Longer beams
        this.speed = speed;
        this.vx = vx;
        this.color = speed < 0 ? '#ffff00' : '#ff0000';
    }

    update() {
        this.y += this.speed;
        this.x += this.vx * 5;
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.restore();
    }
}

class Enemy {
    constructor(x, y, level) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.speed = 1 + level * 0.2;
        this.movePattern = Math.floor(Math.random() * 3); // 0: straight, 1: zigzag, 2: sine wave
        this.angle = 0;
        this.type = Math.floor(Math.random() * 3); // 0: Basic, 1: Chaser (Spiky), 2: Heavy (Hex)
        this.color = '#ff0000';
        if (this.type === 1) this.color = '#ff00ff'; // Purple
        if (this.type === 2) this.color = '#ff8800'; // Orange
    }

    update() {
        this.y += this.speed;

        switch (this.movePattern) {
            case 1: // Zigzag
                this.x += Math.sin(this.angle) * 2;
                break;
            case 2: // Sine wave
                this.x += Math.sin(this.angle * 0.1) * 3;
                break;
        }
        this.angle += 0.1;

        // Keep within bounds
        if (this.x < 0) this.x = 0;
        if (this.x > 780) this.x = 780;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;

        ctx.beginPath();
        if (this.type === 0) { // Basic - Triangle down
            ctx.moveTo(-10, -10);
            ctx.lineTo(10, -10);
            ctx.lineTo(0, 10);
            ctx.closePath();
        } else if (this.type === 1) { // Chaser - Spiky
            ctx.moveTo(0, 15);
            ctx.lineTo(5, 5);
            ctx.lineTo(15, 0);
            ctx.lineTo(5, -5);
            ctx.lineTo(0, -15);
            ctx.lineTo(-5, -5);
            ctx.lineTo(-15, 0);
            ctx.lineTo(-5, 5);
            ctx.closePath();
            // Rotate it a bit for effect? Nah, keeps it simple for now
        } else { // Heavy - Hexagon
            for (let i = 0; i < 6; i++) {
                const angle = i * Math.PI / 3;
                const r = 12;
                const px = Math.cos(angle) * r;
                const py = Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
        }
        ctx.stroke();

        // Inner core
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.01) * 0.2;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

class PowerUp {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
        this.speed = 2;
        const rand = Math.random();
        this.type = rand < 0.33 ? 'rapidFire' : (rand < 0.66 ? 'shield' : 'spreadShot');
        this.angle = 0;
    }

    update() {
        this.y += this.speed;
        this.angle += 0.05;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.angle);

        const color = this.type === 'rapidFire' ? '#ffff00' : (this.type === 'spreadShot' ? '#ff00ff' : '#00ffff');
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);

        ctx.fillStyle = color;
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let text = 'S';
        if (this.type === 'rapidFire') text = 'R';
        if (this.type === 'spreadShot') text = '3';
        ctx.fillText(text, 0, 0);

        ctx.restore();
    }
}

class Boss {
    constructor(x, y, level) {
        this.x = x;
        this.y = y;
        this.width = 100;
        this.height = 100;
        this.hp = 50 + level * 10;
        this.maxHp = this.hp;
        this.speed = 2;
        this.angle = 0;
        this.color = '#ff0000';
        this.state = 'enter'; // enter, fight
    }

    update() {
        this.angle += 0.02;

        if (this.state === 'enter') {
            this.y += this.speed;
            if (this.y > 50) this.state = 'fight';
        } else {
            // Strafe
            this.x += Math.cos(this.angle) * 3;
            if (this.x < 0) this.x = 0;
            if (this.x > 700) this.x = 700;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4;

        ctx.beginPath();
        // Big Skull/Ship shape
        ctx.moveTo(-40, -40);
        ctx.lineTo(40, -40);
        ctx.lineTo(50, 0);
        ctx.lineTo(20, 50);
        ctx.lineTo(-20, 50);
        ctx.lineTo(-50, 0);
        ctx.closePath();
        ctx.stroke();

        // HP Bar
        ctx.restore();
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x, this.y - 20, this.width * (this.hp / this.maxHp), 10);
        ctx.strokeRect(this.x, this.y - 20, this.width, 10);
    }
}

class Particle {
    constructor(x, y, color = '#ffffff', vy = null) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 5;
        this.vy = vy !== null ? vy : (Math.random() - 0.5) * 5;
        this.life = 30;
        this.maxLife = 30;
        this.color = color;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        this.vx *= 0.95;
        this.vy *= 0.95;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 5;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x, this.y, 2, 2);
        ctx.restore();
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
});
