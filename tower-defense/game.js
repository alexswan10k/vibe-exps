class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.map = new GameMap();
        this.renderer = new Renderer(this.canvas, this);
        this.ui = new UIManager(this);

        this.enemies = [];
        this.towers = [];
        this.projectiles = [];
        this.particles = [];

        // Game State
        this.money = 100;
        this.lives = 20;
        this.currentWave = 0;
        this.waveActive = false;
        this.gameOver = false;

        // Input State
        this.selectedTowerType = 'basic';
        this.selectedTower = null;
        this.hoverCol = null;
        this.hoverRow = null;

        // Wave Management
        this.waveQueue = [];
        this.waveTimer = 0;

        this.setupInput();
        this.loop();
    }

    setupInput() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const gridPos = pixelToGrid(mouseX, mouseY, TILE_SIZE);
            this.hoverCol = gridPos.col;
            this.hoverRow = gridPos.row;
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.hoverCol = null;
            this.hoverRow = null;
        });

        this.canvas.addEventListener('click', () => {
            if (this.gameOver) return;
            this.handleGridClick();
        });
    }

    handleGridClick() {
        if (this.hoverCol === null || this.hoverRow === null) return;

        // Check if clicking on existing tower
        const existingTower = this.towers.find(t => t.col === this.hoverCol && t.row === this.hoverRow);
        if (existingTower) {
            this.selectedTower = existingTower;
            this.selectedTowerType = null; // Deselect placement
            this.ui.updateSelectionUI(null);
            return;
        }

        // Try to place tower
        if (this.selectedTowerType) {
            this.placeTower(this.hoverCol, this.hoverRow, this.selectedTowerType);
        } else {
             this.selectedTower = null; // Clicked on empty space with no tool
        }
    }

    selectTowerType(type) {
        this.selectedTowerType = type;
        this.selectedTower = null;
    }

    getTowerConfig(type) {
        return TOWERS[type];
    }

    placeTower(col, row, type) {
        if (!this.map.isBuildable(col, row)) return;

        const config = TOWERS[type];
        if (this.money < config.cost) return;

        this.money -= config.cost;
        this.towers.push(new Tower(col, row, type));
        this.map.setOccupied(col, row);
    }

    startWave() {
        if (this.waveActive || this.currentWave >= WAVES.length) return;

        const waveConfig = WAVES[this.currentWave];
        this.currentWave++;
        this.waveActive = true;

        // Populate wave queue
        this.waveQueue = [];
        for (let i = 0; i < waveConfig.count; i++) {
            this.waveQueue.push({
                type: waveConfig.type,
                delay: i * waveConfig.interval
            });
        }

        this.waveStartTime = Date.now();
    }

    spawnEnemy(typeKey) {
        const config = ENEMIES[typeKey];
        const waypoints = this.map.getWaypointsPixels();
        this.enemies.push(new Enemy(waypoints, config));
    }

    restart() {
        this.money = 100;
        this.lives = 20;
        this.currentWave = 0;
        this.waveActive = false;
        this.gameOver = false;
        this.enemies = [];
        this.towers = [];
        this.projectiles = [];
        this.particles = [];
        this.map.init(); // Reset grid
        this.waveQueue = [];
    }

    update() {
        if (this.gameOver) return;

        // Wave Spawning logic
        if (this.waveActive) {
            const now = Date.now();
            const elapsedTime = now - this.waveStartTime;

            // Check if we need to spawn
            // We iterate backwards to remove spawned items easily
            for (let i = this.waveQueue.length - 1; i >= 0; i--) {
                if (elapsedTime >= this.waveQueue[i].delay) {
                    this.spawnEnemy(this.waveQueue[i].type);
                    this.waveQueue.splice(i, 1);
                }
            }

            if (this.waveQueue.length === 0 && this.enemies.length === 0) {
                this.waveActive = false;
            }
        }

        // Update Entities
        this.towers.forEach(t => t.update(this.enemies, (p) => this.projectiles.push(p)));

        this.enemies.forEach(e => {
            e.update();
            if (e.reachedEnd) {
                this.lives--;
                if (this.lives <= 0) {
                    this.lives = 0;
                    this.gameOver = true;
                    this.ui.showGameOver(this.currentWave);
                }
            }
        });

        this.projectiles.forEach(p => {
            p.update();
            if (p.hasHit) {
                this.handleProjectileHit(p);
            }
        });

        this.particles.forEach(p => p.update());

        // Cleanup
        this.enemies = this.enemies.filter(e => !e.markedForDeletion);
        this.projectiles = this.projectiles.filter(p => !p.markedForDeletion);
        this.particles = this.particles.filter(p => !p.markedForDeletion);

        this.ui.update();
    }

    spawnParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color, Math.random() * 2 + 1, Math.random() * 20 + 10));
        }
    }

    handleProjectileHit(projectile) {
        if (projectile.isAoE) {
            // AoE Damage
            this.spawnParticles(projectile.x, projectile.y, '#e74c3c', 20); // Big explosion
            this.enemies.forEach(enemy => {
                const dist = getDistance(projectile, enemy);
                if (dist <= projectile.aoeRadius + enemy.radius) {
                    this.damageEnemy(enemy, projectile.damage);
                }
            });
        } else {
            // Single Target Damage
            if (projectile.target && !projectile.target.markedForDeletion) {
                this.damageEnemy(projectile.target, projectile.damage);
                this.spawnParticles(projectile.x, projectile.y, projectile.color, 5);
            }
        }
    }

    damageEnemy(enemy, damage) {
        const killed = enemy.takeDamage(damage);
        if (killed) {
            this.money += enemy.reward;
            this.spawnParticles(enemy.x, enemy.y, enemy.color, 15);
        }
    }

    loop() {
        this.update();
        this.renderer.render();
        requestAnimationFrame(() => this.loop());
    }
}