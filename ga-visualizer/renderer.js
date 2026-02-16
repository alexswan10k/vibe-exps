/**
 * Genetic Algorithm Visualizer
 * Renderer
 */

class Renderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    }

    clear() {
        this.ctx.fillStyle = '#0a0a0f';
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    drawTarget(target) {
        this.ctx.beginPath();
        this.ctx.arc(target.x, target.y, 16, 0, Math.PI * 2);
        this.ctx.fillStyle = '#00ff9d'; // Accent color
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = 'rgba(0, 255, 157, 0.6)';
        this.ctx.fill();
        this.ctx.shadowBlur = 0; // Reset
        this.ctx.closePath();

        // Inner white dot
        this.ctx.beginPath();
        this.ctx.arc(target.x, target.y, 6, 0, Math.PI * 2);
        this.ctx.fillStyle = '#fff';
        this.ctx.fill();
        this.ctx.closePath();
    }

    drawObstacles(obstacles) {
        this.ctx.fillStyle = '#151520'; // Surface color
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 2;

        for (let obs of obstacles) {
            this.ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
            this.ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        }
    }

    drawTraj(points) {
        if (!points || points.length < 2) return;

        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x, points[i].y);
        }

        this.ctx.strokeStyle = 'rgba(0, 255, 157, 0.5)'; // Accent with transparency
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]); // Dashed line
        this.ctx.stroke();
        this.ctx.setLineDash([]); // Reset
        this.ctx.setLineDash([]); // Reset
    }

    drawVectorResult(canvas, vector) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;

        ctx.clearRect(0, 0, w, h);

        // Grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
        ctx.moveTo(0, cy); ctx.lineTo(w, cy);
        ctx.stroke();

        if (!vector) return;

        // Draw Vector
        const scale = 200; // Force is small (0.2), so scale up
        const vx = vector.x * scale;
        const vy = vector.y * scale;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + vx, cy + vy);
        ctx.strokeStyle = '#00ff9d';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Arrow head
        const angle = Math.atan2(vy, vx);
        const headLen = 8;
        ctx.beginPath();
        ctx.moveTo(cx + vx, cy + vy);
        ctx.lineTo(cx + vx - headLen * Math.cos(angle - Math.PI / 6), cy + vy - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(cx + vx - headLen * Math.cos(angle + Math.PI / 6), cy + vy - headLen * Math.sin(angle + Math.PI / 6));
        ctx.lineTo(cx + vx, cy + vy);
        ctx.fillStyle = '#00ff9d';
        ctx.fill();
    }

    drawDNATimeline(canvas, dna, currentFrame, totalFrames) {
        if (!canvas || !dna) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        // Only redraw background if needed, but for simplicity clear all
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, w, h);

        const geneW = w / totalFrames;

        // Draw genes as vertical bars based on angle/magnitude?
        // Let's just draw magnitude for now, or angle as hue?
        // Hue is better for direction.

        for (let i = 0; i < dna.genes.length; i++) {
            // Optimize: skip if too small pixels, but canvas handles it okay
            const vec = dna.genes[i];
            const angle = Math.atan2(vec.y, vec.x) + Math.PI; // 0..2PI
            const hue = (angle / (Math.PI * 2)) * 360;

            ctx.fillStyle = `hsl(${hue}, 80%, 50%)`;
            ctx.fillRect(i * geneW, 0, Math.ceil(geneW), h);
        }

        // Draw progress cursor
        const cx = (currentFrame / totalFrames) * w;
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 1, 0, 2, h);
    }

    drawPopulation(population) {
        for (let rocket of population.rockets) {
            this.drawRocket(rocket);
        }
    }

    drawRocket(rocket) {
        this.ctx.save();
        this.ctx.translate(rocket.pos.x, rocket.pos.y);
        // Rotate to velocity heading
        const theta = Math.atan2(rocket.vel.y, rocket.vel.x);
        this.ctx.rotate(theta + Math.PI / 2);

        const r = 4;

        // Color based on state
        if (rocket.completed) {
            this.ctx.fillStyle = '#00ff9d';
        } else if (rocket.crashed) {
            this.ctx.fillStyle = '#ff0055';
        } else {
            this.ctx.fillStyle = 'rgba(224, 224, 255, 0.8)';
        }

        this.ctx.beginPath();
        this.ctx.moveTo(0, -r * 2);
        this.ctx.lineTo(-r, r * 2);
        this.ctx.lineTo(r, r * 2);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.restore();
    }

    drawStats(generation, count, lifespan) {
        this.ctx.fillStyle = '#8888aa';
        this.ctx.font = '12px JetBrains Mono';
        this.ctx.fillText(`Frame: ${count} / ${lifespan}`, 10, 20);
    }
}

class FitnessGraph {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.history = [];
    }

    add(maxFit, avgFit) {
        this.history.push({ max: maxFit, avg: avgFit });
        if (this.history.length > 100) this.history.shift();
        this.draw();
    }

    draw() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        if (this.history.length < 2) return;

        // Find max value for scaling
        let peak = 0;
        for (let h of this.history) {
            if (h.max > peak) peak = h.max;
        }
        if (peak === 0) peak = 1;

        // Draw Max Fitness Line (Green)
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#00ff9d';
        this.ctx.lineWidth = 2;
        for (let i = 0; i < this.history.length; i++) {
            const x = (i / (this.history.length - 1)) * w;
            const y = h - (this.history[i].max / peak) * h;
            if (i === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
        }
        this.ctx.stroke();

        // Draw Avg Fitness Line (Blue)
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#00b8ff';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < this.history.length; i++) {
            const x = (i / (this.history.length - 1)) * w;
            const y = h - (this.history[i].avg / peak) * h;
            if (i === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
        }
        this.ctx.stroke();
    }

    clear() {
        this.history = [];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}
