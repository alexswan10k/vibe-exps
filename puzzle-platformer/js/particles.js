class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    emit(x, y, count, color = '#fff') {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: Utils.randomRange(-100, 100),
                vy: Utils.randomRange(-200, 0),
                life: 1.0,
                color: color,
                size: Utils.randomRange(2, 5)
            });
        }
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt * 2; // Fade out speed
            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 500 * dt; // Gravity
        }
    }

    draw(renderer) {
        // Need access to ctx to set globalAlpha
        const ctx = renderer.ctx;
        ctx.save();
        ctx.translate(-renderer.camera.x, -renderer.camera.y);

        for (const p of this.particles) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
        }

        ctx.restore();
    }
}
