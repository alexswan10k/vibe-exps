class ParticleSystem {
    constructor(max = 600) {
        this.particles = [];
        this.max = max;
    }

    spawn(x, y, opts = {}) {
        if (this.particles.length >= this.max) this.particles.shift();
        this.particles.push({
            x, y,
            vx: opts.vx || 0,
            vy: opts.vy || 0,
            size: opts.size || 4,
            sizeEnd: opts.sizeEnd != null ? opts.sizeEnd : opts.size || 4,
            life: opts.life || 0.6,
            age: 0,
            color: opts.color || '#999',
            drag: opts.drag != null ? opts.drag : 2,
            gravity: opts.gravity || 0
        });
    }

    burst(x, y, count, spread, opts = {}) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = MathUtils.randRange(spread * 0.3, spread);
            this.spawn(x, y, {
                ...opts,
                vx: Math.cos(a) * s + (opts.vx || 0),
                vy: Math.sin(a) * s + (opts.vy || 0),
                life: MathUtils.randRange((opts.life || 0.6) * 0.6, opts.life || 0.6)
            });
        }
    }

    confetti(x, y, count = 80) {
        for (let i = 0; i < count; i++) {
            const hue = Math.floor(Math.random() * 360);
            const a = Math.random() * Math.PI * 2;
            const s = MathUtils.randRange(60, 260);
            this.spawn(x, y, {
                vx: Math.cos(a) * s,
                vy: Math.sin(a) * s - 120,
                size: MathUtils.randRange(3, 6),
                life: MathUtils.randRange(0.8, 1.8),
                color: `hsl(${hue}, 90%, 60%)`,
                gravity: 320,
                drag: 1.2
            });
        }
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.age += dt;
            if (p.age >= p.life) {
                this.particles.splice(i, 1);
                continue;
            }
            const damp = Math.exp(-p.drag * dt);
            p.vx *= damp;
            p.vy *= damp;
            p.vy += p.gravity * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
        }
    }

    draw(ctx) {
        for (const p of this.particles) {
            const t = p.age / p.life;
            ctx.globalAlpha = 1 - t;
            ctx.fillStyle = p.color;
            const s = MathUtils.lerp(p.size, p.sizeEnd, t);
            ctx.beginPath();
            ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
}
