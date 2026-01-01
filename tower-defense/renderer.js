class Renderer {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.game = game;

        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawMap();
        this.drawPath();
        this.drawTowers();
        this.drawEnemies();
        this.drawProjectiles();
        this.drawParticles();
        this.drawPlacementPreview();
        this.drawRangeIndicator();
    }

    drawMap() {
        // Draw background
        this.ctx.fillStyle = '#34495e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid lines (subtle)
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;

        for (let x = 0; x <= MAP_WIDTH; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * TILE_SIZE, 0);
            this.ctx.lineTo(x * TILE_SIZE, CANVAS_HEIGHT);
            this.ctx.stroke();
        }

        for (let y = 0; y <= MAP_HEIGHT; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * TILE_SIZE);
            this.ctx.lineTo(CANVAS_WIDTH, y * TILE_SIZE);
            this.ctx.stroke();
        }
    }

    drawPath() {
        const waypoints = this.game.map.getWaypointsPixels();
        if (waypoints.length < 2) return;

        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        // Draw path border
        this.ctx.lineWidth = 40;
        this.ctx.strokeStyle = '#2c3e50';
        this.ctx.beginPath();
        this.ctx.moveTo(waypoints[0].x, waypoints[0].y);
        for (let i = 1; i < waypoints.length; i++) {
            this.ctx.lineTo(waypoints[i].x, waypoints[i].y);
        }
        this.ctx.stroke();

        // Draw path inner
        this.ctx.lineWidth = 30;
        this.ctx.strokeStyle = '#7f8c8d';
        this.ctx.beginPath();
        this.ctx.moveTo(waypoints[0].x, waypoints[0].y);
        for (let i = 1; i < waypoints.length; i++) {
            this.ctx.lineTo(waypoints[i].x, waypoints[i].y);
        }
        this.ctx.stroke();
    }

    drawTowers() {
        for (const tower of this.game.towers) {
            tower.draw(this.ctx);
        }
    }

    drawEnemies() {
        for (const enemy of this.game.enemies) {
            enemy.draw(this.ctx);
        }
    }

    drawProjectiles() {
        for (const projectile of this.game.projectiles) {
            projectile.draw(this.ctx);
        }
    }

    drawParticles() {
        for (const particle of this.game.particles) {
            particle.draw(this.ctx);
        }
    }

    drawPlacementPreview() {
        const { hoverCol, hoverRow, selectedTowerType } = this.game;

        if (hoverCol === null || hoverRow === null || !selectedTowerType) return;

        const x = hoverCol * TILE_SIZE;
        const y = hoverRow * TILE_SIZE;

        const isBuildable = this.game.map.isBuildable(hoverCol, hoverRow);

        this.ctx.fillStyle = isBuildable ? 'rgba(46, 204, 113, 0.5)' : 'rgba(231, 76, 60, 0.5)';
        this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        this.ctx.strokeStyle = isBuildable ? '#2ecc71' : '#e74c3c';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
    }

    drawRangeIndicator() {
         const { hoverCol, hoverRow, selectedTowerType, selectedTower } = this.game;

         let x, y, range;

         // Priority to hovering placement
         if (selectedTowerType && hoverCol !== null && hoverRow !== null) {
             x = hoverCol * TILE_SIZE + TILE_SIZE / 2;
             y = hoverRow * TILE_SIZE + TILE_SIZE / 2;
             range = this.game.getTowerConfig(selectedTowerType).range * TILE_SIZE;
         } else if (selectedTower) {
             x = selectedTower.x;
             y = selectedTower.y;
             range = selectedTower.config.range * TILE_SIZE;
         } else {
             return;
         }

         this.ctx.beginPath();
         this.ctx.arc(x, y, range, 0, Math.PI * 2);
         this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
         this.ctx.fill();
         this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
         this.ctx.lineWidth = 1;
         this.ctx.setLineDash([5, 5]);
         this.ctx.stroke();
         this.ctx.setLineDash([]);
    }
}