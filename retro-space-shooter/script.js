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

        this.keys = {};
        this.lastShot = 0;
        this.shotCooldown = 200; // milliseconds

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        this.init();
        this.gameLoop();
    }

    init() {
        this.setupEventListeners();
        this.spawnEnemies();
    }

    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
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
        if (this.gameOver) return;

        this.updatePlayer();
        this.updateProjectiles();
        this.updateEnemies();
        this.updatePowerUps();
        this.updateParticles();
        this.checkCollisions();
        this.checkLevelProgress();
    }

    updatePlayer() {
        // Movement
        if ((this.keys['ArrowLeft'] || this.keys['KeyA']) && this.player.x > 0) {
            this.player.x -= this.player.speed;
        }
        if ((this.keys['ArrowRight'] || this.keys['KeyD']) && this.player.x < this.canvas.width - this.player.width) {
            this.player.x += this.player.speed;
        }
        if ((this.keys['ArrowUp'] || this.keys['KeyW']) && this.player.y > 0) {
            this.player.y -= this.player.speed;
        }
        if ((this.keys['ArrowDown'] || this.keys['KeyS']) && this.player.y < this.canvas.height - this.player.height) {
            this.player.y += this.player.speed;
        }

        // Shooting
        if ((this.keys['Space'] || this.keys['Enter']) && Date.now() - this.lastShot > this.shotCooldown) {
            this.shoot();
            this.lastShot = Date.now();
        }
    }

    shoot() {
        const projectile = new Projectile(this.player.x + this.player.width / 2 - 2, this.player.y, -5);
        this.projectiles.push(projectile);
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
                    this.enemies.splice(eIndex, 1);
                    this.score += 10;
                    this.createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
                    this.playSound('explosion');

                    // Chance to spawn power-up
                    if (Math.random() < 0.1) {
                        this.powerUps.push(new PowerUp(enemy.x, enemy.y));
                    }
                }
            });
        });

        // Enemy projectiles vs player
        this.projectiles.forEach((projectile, pIndex) => {
            if (projectile.speed > 0 && this.isColliding(projectile, this.player)) {
                this.projectiles.splice(pIndex, 1);
                this.lives--;
                this.createExplosion(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
                this.playSound('explosion');
                if (this.lives <= 0) {
                    this.gameOver = true;
                }
            }
        });

        // Player vs enemies
        this.enemies.forEach((enemy, eIndex) => {
            if (this.isColliding(this.player, enemy)) {
                this.enemies.splice(eIndex, 1);
                this.lives--;
                this.createExplosion(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
                this.playSound('explosion');
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

    createExplosion(x, y) {
        for (let i = 0; i < 10; i++) {
            this.particles.push(new Particle(x, y));
        }
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
        }
    }

    checkLevelProgress() {
        if (this.enemies.length === 0) {
            this.level++;
            this.spawnEnemies();
        }
    }

    spawnEnemies() {
        const enemyCount = 5 + this.level * 2;
        for (let i = 0; i < enemyCount; i++) {
            const x = Math.random() * (this.canvas.width - 40);
            const y = -50 - Math.random() * 200;
            this.enemies.push(new Enemy(x, y, this.level));
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
                oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.3);
                gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
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

        // Draw stars background
        this.drawStars();

        this.player.draw(this.ctx);
        this.projectiles.forEach(projectile => projectile.draw(this.ctx));
        this.enemies.forEach(enemy => enemy.draw(this.ctx));
        this.powerUps.forEach(powerUp => powerUp.draw(this.ctx));
        this.particles.forEach(particle => particle.draw(this.ctx));

        this.updateUI();
    }

    drawStars() {
        this.ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 100; i++) {
            const x = (i * 37) % this.canvas.width;
            const y = (i * 23 + Date.now() * 0.05) % this.canvas.height;
            this.ctx.fillRect(x, y, 1, 1);
        }
    }

    updateUI() {
        document.getElementById('score').textContent = `Score: ${this.score}`;
        document.getElementById('lives').textContent = `Lives: ${this.lives}`;
        document.getElementById('level').textContent = `Level: ${this.level}`;

        if (this.gameOver) {
            document.getElementById('final-score').textContent = `Final Score: ${this.score}`;
            document.getElementById('game-over').classList.remove('hidden');
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
        this.width = 20;
        this.height = 20;
        this.speed = 5;
        this.shielded = false;
    }

    draw(ctx) {
        ctx.fillStyle = this.shielded ? '#00ffff' : '#00ff00';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Draw ship details
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(this.x + 8, this.y - 5, 4, 5);
        ctx.fillRect(this.x + 6, this.y + 15, 8, 3);
    }
}

class Projectile {
    constructor(x, y, speed) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 8;
        this.speed = speed;
    }

    update() {
        this.y += this.speed;
    }

    draw(ctx) {
        ctx.fillStyle = this.speed < 0 ? '#ffff00' : '#ff0000';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class Enemy {
    constructor(x, y, level) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
        this.speed = 1 + level * 0.2;
        this.movePattern = Math.floor(Math.random() * 3); // 0: straight, 1: zigzag, 2: sine wave
        this.angle = 0;
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
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Draw enemy details
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(this.x + 8, this.y + 18, 4, 2);
        ctx.fillRect(this.x + 6, this.y + 2, 2, 2);
        ctx.fillRect(this.x + 12, this.y + 2, 2, 2);
    }
}

class PowerUp {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 15;
        this.height = 15;
        this.speed = 2;
        this.type = Math.random() < 0.5 ? 'rapidFire' : 'shield';
    }

    update() {
        this.y += this.speed;
    }

    draw(ctx) {
        ctx.fillStyle = this.type === 'rapidFire' ? '#ffff00' : '#00ffff';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Draw power-up symbol
        ctx.fillStyle = '#000000';
        if (this.type === 'rapidFire') {
            ctx.fillRect(this.x + 5, this.y + 5, 5, 5);
        } else {
            ctx.fillRect(this.x + 7, this.y + 2, 1, 11);
            ctx.fillRect(this.x + 2, this.y + 7, 11, 1);
        }
    }
}

class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 30;
        this.color = `hsl(${Math.random() * 60 + 30}, 100%, 50%)`;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        this.vx *= 0.98;
        this.vy *= 0.98;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.life / 30;
        ctx.fillRect(this.x, this.y, 2, 2);
        ctx.globalAlpha = 1;
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
});
