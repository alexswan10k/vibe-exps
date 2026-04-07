const Utils = {
    randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,

    shuffleArray: (array) => {
        const newArr = [...array];
        for (let i = newArr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
        }
        return newArr;
    },

    // Rotates a matrix 90 degrees clockwise
    rotateMatrix: (matrix) => {
        const N = matrix.length;
        const rotated = Array.from({ length: N }, () => Array(N).fill(0));
        for (let y = 0; y < N; y++) {
            for (let x = 0; x < N; x++) {
                rotated[x][N - 1 - y] = matrix[y][x];
            }
        }
        return rotated;
    },

    // Generates the Standard 7-bag
    generateBag: () => {
        return Utils.shuffleArray([1, 2, 3, 4, 5, 6, 7]);
    }
};

class ParticleSystem {
    constructor() {
        this.particles = [];
        this.shakeTime = 0;
        this.shakeIntensity = 0;
    }

    // Call when clearing lines or dropping a bomb
    addScreenShake(durationMs, intensity) {
        this.shakeTime = durationMs;
        this.shakeIntensity = intensity;
    }

    createExplosion(x, y, color, count = 20, speedMultiplier = 1) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = (Math.random() * 4 + 1) * speedMultiplier;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                decay: Math.random() * 0.02 + 0.02,
                color: color,
                size: Math.random() * 4 + 2
            });
        }
    }

    createBlockTrail(x, y, w, h, color) {
        for (let i = 0; i < 2; i++) {
            this.particles.push({
                x: x + Math.random() * w,
                y: y + Math.random() * h,
                vx: (Math.random() - 0.5) * 0.5,
                vy: -(Math.random() * 1.5 + 0.5),
                life: 1.0,
                decay: 0.05,
                color: color,
                size: Math.random() * 2 + 1
            });
        }
    }

    update(dt) {
        if (this.shakeTime > 0) {
            this.shakeTime -= dt;
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay * (dt / 16.6); // Scale decay by roughly 60fps frame delta
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        ctx.save();
        for (const p of this.particles) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        ctx.restore();
    }
}
