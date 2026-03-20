class Renderer {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();

        window.addEventListener('resize', () => this.resize());

        this.camera = { x: 0, y: 0 };
        this.trauma = 0;

        window.addEventListener('shake', (e) => {
            this.addTrauma(e.detail.amount || 0.5);
        });
    }

    addTrauma(amount) {
        this.trauma = Math.min(this.trauma + amount, 1.0);
    }

    update(dt) {
        if (this.trauma > 0) {
            this.trauma = Math.max(0, this.trauma - dt * 1.5);
        }
    }

    resize() {
        this.elementWidth = window.innerWidth;
        this.elementHeight = window.innerHeight;

        // Logical resolution scaling
        // We want to keep the aspect ratio but scale up crisply
        this.canvas.width = Constants.SCREEN_WIDTH;
        this.canvas.height = Constants.SCREEN_HEIGHT;

        // CSS scaling
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.objectFit = 'contain';

        // Disable interpolation for pixel art look if needed (optional)
        this.ctx.imageSmoothingEnabled = false;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw background gradient (simulated neon sky)
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#0f0f13');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    setCamera(x, y) {
        let shakeX = 0;
        let shakeY = 0;

        if (this.trauma > 0) {
            const shake = this.trauma * this.trauma;
            const maxShake = 20;
            shakeX = maxShake * shake * (Math.random() * 2 - 1);
            shakeY = maxShake * shake * (Math.random() * 2 - 1);
        }

        this.camera.x = x + shakeX;
        this.camera.y = y + shakeY;
    }

    drawRect(x, y, w, h, color, glow = false) {
        this.ctx.save();
        this.ctx.translate(-this.camera.x, -this.camera.y);

        this.ctx.fillStyle = color;

        if (glow) {
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = color;
        }

        this.ctx.fillRect(x, y, w, h);
        this.ctx.restore();
    }

    drawPlayer(player) {
        this.ctx.save();
        this.ctx.translate(-this.camera.x, -this.camera.y);

        // Player Base
        this.ctx.fillStyle = '#00f3ff';
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = '#00f3ff';
        this.ctx.fillRect(player.x, player.y, player.width, player.height);

        // Player Eye/Detail
        this.ctx.fillStyle = '#ffffff';
        this.ctx.shadowBlur = 0;
        const eyeOffset = player.direction === 1 ? player.width - 15 : 5;
        this.ctx.fillRect(player.x + eyeOffset, player.y + 10, 10, 10);

        this.ctx.restore();
    }

    drawLevel(level) {
        // Draw tiles
        for (const tile of level.tiles) {
            // Culling optimization: only draw if on screen
            if (tile.x + tile.width > this.camera.x && tile.x < this.camera.x + Constants.SCREEN_WIDTH) {
                this.drawRect(tile.x, tile.y, tile.width, tile.height, '#ff0055', true);

                // Add a border/detail
                this.ctx.save();
                this.ctx.translate(-this.camera.x, -this.camera.y);
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(tile.x, tile.y, tile.width, tile.height);
                this.ctx.restore();
            }
        }
    }
}
