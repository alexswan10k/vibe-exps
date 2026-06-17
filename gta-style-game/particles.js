class ParticleSystem {
    constructor() {
        this.skidMarks = [];
        this.effects = [];
    }

    addSkidMark(x, y, angle, width, intensity) {
        this.skidMarks.push({
            x: x,
            y: y,
            angle: angle,
            width: width,
            intensity: Math.abs(intensity),
            life: 800
        });

        if (this.skidMarks.length > 2000) {
            this.skidMarks.shift();
        }
    }

    addSmoke(x, y) {
        this.effects.push({
            type: 'smoke',
            x: x + (Math.random() - 0.5) * 10,
            y: y + (Math.random() - 0.5) * 10,
            vx: (Math.random() - 0.5) * 1.2,
            vy: (Math.random() - 0.5) * 1.2 - 0.6,
            life: 60 + Math.random() * 20,
            maxLife: 80,
            size: 4 + Math.random() * 8
        });
    }

    addExplosion(x, y) {
        for (let i = 0; i < 40; i++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = Math.random() * 6 + 1.5;
            this.effects.push({
                type: 'fire',
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 20 + Math.random() * 30,
                maxLife: 50,
                color: Math.random() > 0.4 ? '#FF5500' : '#FFD700',
                size: 4 + Math.random() * 8
            });
        }
        // Spawn sparks alongside explosion
        this.addSparks(x, y, 0, 0, 18);
    }

    addSparks(x, y, vx = 0, vy = 0, count = 10) {
        for (let i = 0; i < count; i++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = Math.random() * 4 + 1.5;
            this.effects.push({
                type: 'spark',
                x: x,
                y: y,
                vx: Math.cos(angle) * speed + vx * 0.2,
                vy: Math.sin(angle) * speed + vy * 0.2,
                life: 15 + Math.random() * 15,
                maxLife: 30,
                color: '#FFD700',
                size: 1.2 + Math.random() * 1.2
            });
        }
    }

    update(deltaTime) {
        // Fade older skid marks slowly
        for (let i = this.skidMarks.length - 1; i >= 0; i--) {
            this.skidMarks[i].life--;
            if (this.skidMarks[i].life <= 0) {
                this.skidMarks[i].intensity *= 0.98;
            }
            if (this.skidMarks[i].intensity < 0.02) {
                this.skidMarks.splice(i, 1);
            }
        }

        // Update effect particles
        for (let i = this.effects.length - 1; i >= 0; i--) {
            let p = this.effects[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;

            if (p.type === 'smoke') {
                p.size += 0.2;
            } else if (p.type === 'fire') {
                p.vx *= 0.92;
                p.vy *= 0.92;
                p.size *= 0.95;
            } else if (p.type === 'spark') {
                p.vy += 0.06; // gravity fall
                p.vx *= 0.96; // air resistance
                p.vy *= 0.96;
                p.size *= 0.95;
            }

            if (p.life <= 0) {
                this.effects.splice(i, 1);
            }
        }
    }

    drawSkidMarks(ctx) {
        ctx.save();
        for (let mark of this.skidMarks) {
            ctx.translate(mark.x, mark.y);
            ctx.rotate(mark.angle);
            ctx.fillStyle = `rgba(15, 15, 15, ${Math.min(0.75, Math.max(0, mark.intensity))})`;
            ctx.fillRect(-mark.width / 2, -2, mark.width, 4);
            ctx.rotate(-mark.angle);
            ctx.translate(-mark.x, -mark.y);
        }
        ctx.restore();
    }

    drawEffects(ctx) {
        for (let p of this.effects) {
            ctx.beginPath();
            if (p.type === 'smoke') {
                let alpha = (p.life / p.maxLife) * 0.45;
                ctx.fillStyle = `rgba(110, 110, 110, ${alpha})`;
            } else if (p.type === 'fire') {
                let alpha = p.life / p.maxLife;
                ctx.fillStyle = p.color;
                ctx.globalAlpha = alpha;
            } else if (p.type === 'spark') {
                let alpha = p.life / p.maxLife;
                ctx.fillStyle = p.color;
                ctx.globalAlpha = alpha;
            }
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
    }
}

const particleSystem = new ParticleSystem();
