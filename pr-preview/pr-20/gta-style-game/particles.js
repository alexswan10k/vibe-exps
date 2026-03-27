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
            intensity: Math.abs(intensity), // Ensure positive alpha
            life: 800 // High life duration for skidmarks to stay longer
        });

        // limit skid marks array
        if (this.skidMarks.length > 2000) {
            this.skidMarks.shift();
        }
    }

    addSmoke(x, y) {
        this.effects.push({
            type: 'smoke',
            x: x + (Math.random() - 0.5) * 10,
            y: y + (Math.random() - 0.5) * 10,
            vx: (Math.random() - 0.5) * 1,
            vy: (Math.random() - 0.5) * 1 - 0.5,
            life: 60 + Math.random() * 20,
            maxLife: 80,
            size: 5 + Math.random() * 10
        });
    }

    addExplosion(x, y) {
        for (let i = 0; i < 40; i++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = Math.random() * 6 + 1;
            this.effects.push({
                type: 'fire',
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 20 + Math.random() * 30,
                maxLife: 50,
                color: Math.random() > 0.5 ? '#FF5500' : '#FFDD00',
                size: 4 + Math.random() * 8
            });
        }
    }

    update(deltaTime) {
        // Fade older skid marks slowly
        for (let i = this.skidMarks.length - 1; i >= 0; i--) {
            this.skidMarks[i].life--;
            if (this.skidMarks[i].life <= 0) {
                this.skidMarks[i].intensity *= 0.98; // fade out quickly once dying
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
            ctx.fillStyle = `rgba(10, 10, 10, ${Math.min(0.8, Math.max(0, mark.intensity))})`;
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
                let alpha = (p.life / p.maxLife) * 0.5;
                ctx.fillStyle = `rgba(100, 100, 100, ${alpha})`;
            } else if (p.type === 'fire') {
                let alpha = p.life / p.maxLife;
                // Add transparency to hex color
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
