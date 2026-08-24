class ParticleSystem {
    constructor() {
        this.skidMarks = [];
        this.effects = [];
        this.fountains = []; // active water hydrants
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
        for (let i = 0; i < 45; i++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = Math.random() * 7 + 1.5;
            this.effects.push({
                type: 'fire',
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 20 + Math.random() * 30,
                maxLife: 50,
                color: Math.random() > 0.4 ? '#FF4500' : (Math.random() > 0.5 ? '#FFA500' : '#FFD700'),
                size: 4 + Math.random() * 10
            });
        }
        this.addSparks(x, y, 0, 0, 22);
        this.addDebris(x, y, 16);
    }

    addSparks(x, y, vx = 0, vy = 0, count = 10) {
        for (let i = 0; i < count; i++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = Math.random() * 5 + 1.5;
            this.effects.push({
                type: 'spark',
                x: x,
                y: y,
                vx: Math.cos(angle) * speed + vx * 0.2,
                vy: Math.sin(angle) * speed + vy * 0.2,
                life: 15 + Math.random() * 15,
                maxLife: 30,
                color: '#FFE066',
                size: 1.5 + Math.random() * 1.5
            });
        }
    }

    addDebris(x, y, count = 8, color = null) {
        const colors = ['#888', '#555', '#333', '#a0522d', '#708090'];
        for (let i = 0; i < count; i++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = Math.random() * 4 + 1;
            this.effects.push({
                type: 'debris',
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                rot: Math.random() * Math.PI * 2,
                vrot: (Math.random() - 0.5) * 0.3,
                life: 40 + Math.random() * 30,
                maxLife: 70,
                color: color || colors[Math.floor(Math.random() * colors.length)],
                size: 2 + Math.random() * 3
            });
        }
    }

    addHydrantGush(x, y) {
        this.fountains.push({
            x: x,
            y: y,
            life: 600 // lasts ~10 seconds
        });
    }

    addCashSparkles(x, y) {
        for (let i = 0; i < 15; i++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = Math.random() * 3 + 1;
            this.effects.push({
                type: 'cash',
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1.0,
                life: 30 + Math.random() * 20,
                maxLife: 50,
                color: '#00FF66',
                symbol: '$',
                size: 10 + Math.random() * 6
            });
        }
    }

    addSprayMist(x, y, color = '#00FFCC') {
        for (let i = 0; i < 8; i++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = Math.random() * 2.5 + 0.5;
            this.effects.push({
                type: 'spray',
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 25 + Math.random() * 20,
                maxLife: 45,
                color: color,
                size: 6 + Math.random() * 8
            });
        }
    }

    addWaterSplash(x, y) {
        for (let i = 0; i < 12; i++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = Math.random() * 3 + 1;
            this.effects.push({
                type: 'water',
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 25 + Math.random() * 15,
                maxLife: 40,
                color: '#A0E6FF',
                size: 2.5 + Math.random() * 3
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

        // Update active hydrants
        for (let i = this.fountains.length - 1; i >= 0; i--) {
            let f = this.fountains[i];
            f.life--;
            // Spawn fountain particles every frame
            for (let k = 0; k < 3; k++) {
                let spread = (Math.random() - 0.5) * 2;
                this.effects.push({
                    type: 'water',
                    x: f.x + (Math.random() - 0.5) * 6,
                    y: f.y,
                    vx: spread,
                    vy: - (5 + Math.random() * 4), // shoot upwards
                    gravity: 0.18,
                    life: 35 + Math.random() * 15,
                    maxLife: 50,
                    color: Math.random() > 0.3 ? '#88D6FF' : '#E0F4FF',
                    size: 3 + Math.random() * 4
                });
            }
            if (f.life <= 0) {
                this.fountains.splice(i, 1);
            }
        }

        // Update effect particles
        for (let i = this.effects.length - 1; i >= 0; i--) {
            let p = this.effects[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;

            if (p.gravity) {
                p.vy += p.gravity;
            }

            if (p.type === 'smoke') {
                p.size += 0.25;
                p.vx *= 0.96;
                p.vy *= 0.96;
            } else if (p.type === 'fire') {
                p.vx *= 0.92;
                p.vy *= 0.92;
                p.size *= 0.94;
            } else if (p.type === 'spark') {
                p.vy += 0.08; // gravity fall
                p.vx *= 0.96;
                p.vy *= 0.96;
                p.size *= 0.95;
            } else if (p.type === 'debris') {
                p.vy += 0.1;
                p.vx *= 0.97;
                p.vy *= 0.97;
                p.rot += p.vrot;
            } else if (p.type === 'cash') {
                p.vy += 0.04;
                p.vx *= 0.95;
            } else if (p.type === 'spray') {
                p.size += 0.3;
                p.vx *= 0.92;
                p.vy *= 0.92;
            } else if (p.type === 'water') {
                if (!p.gravity) p.vy += 0.08;
                p.vx *= 0.97;
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
            ctx.save();
            if (p.type === 'smoke') {
                let alpha = (p.life / p.maxLife) * 0.5;
                ctx.fillStyle = `rgba(100, 100, 100, ${alpha})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'fire') {
                let alpha = p.life / p.maxLife;
                ctx.fillStyle = p.color;
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'spark') {
                let alpha = p.life / p.maxLife;
                ctx.fillStyle = p.color;
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'debris') {
                let alpha = Math.min(1.0, (p.life / p.maxLife) * 1.5);
                ctx.globalAlpha = alpha;
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);
            } else if (p.type === 'cash') {
                let alpha = p.life / p.maxLife;
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.font = `bold ${Math.floor(p.size)}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('$', p.x, p.y);
            } else if (p.type === 'spray') {
                let alpha = (p.life / p.maxLife) * 0.6;
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'water') {
                let alpha = (p.life / p.maxLife) * 0.7;
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }
}

const particleSystem = new ParticleSystem();
