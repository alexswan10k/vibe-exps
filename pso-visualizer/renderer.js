/**
 * PSO Visualizer
 * 3D Renderer
 */

class Renderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        // Camera / Projection Params
        this.camera = {
            angle: Math.PI / 4,
            pitch: Math.PI / 3,
            zoom: 1.0,
            x: 0,
            y: 0
        };
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    // Convert world (x,y,z) to screen (sx, sy)
    project(x, y, z) {
        // Center of screen
        const cx = this.width / 2;
        const cy = this.height / 2;

        // Normalize x,y to center relative [-width/2, width/2]
        let wx = x - this.width / 2;
        let wy = y - this.height / 2;

        // Rotate Y (Spin)
        let rx = wx * Math.cos(this.camera.angle) - wy * Math.sin(this.camera.angle);
        let ry = wx * Math.sin(this.camera.angle) + wy * Math.cos(this.camera.angle);

        // Rotate X (Pitch) - "tilt" ry and z
        // z is "up", ry is "depth"
        // flatten z into y screen coord

        // Isometric-like projection
        // Screen X = rx
        // Screen Y = ry * cos(pitch) - z * sin(pitch)

        let sx = cx + rx * this.camera.zoom;
        let sy = cy + (ry * Math.cos(this.camera.pitch) - z * Math.sin(this.camera.pitch)) * this.camera.zoom;

        return { x: sx, y: sy, depth: ry }; // depth for sorting if needed
    }

    drawSwarm(swarm) {
        if (!swarm) return;

        const zScale = 50;

        // Draw Terrain First
        this.drawTerrain(swarm.currentScenario, swarm.width, swarm.height);

        // Draw Target if in target mode
        if (swarm.currentScenario === 'target') {
            const pt = this.project(swarm.target.x, swarm.target.y, 0);

            // Pulse effect for target
            const time = Date.now() * 0.005;
            const radius = 12 + Math.sin(time) * 3;

            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = '#ff3366';
            this.drawCircle(pt.x, pt.y, radius, '#ff3366');
            this.ctx.shadowBlur = 0;
            // Target core
            this.drawCircle(pt.x, pt.y, 4, '#ffffff');
        }

        // Draw Particles
        this.ctx.globalCompositeOperation = 'screen';

        for (let p of swarm.particles) {
            let z = 0;
            if (swarm.currentScenario !== 'target') {
                z = p.position.z * zScale;
            }

            const proj = this.project(p.position.x, p.position.y, z);

            // Determine opacity/size based on fitness (relative)
            // if we have global best, we could scale. simpler: rely on predefined color blending.
            // Let's make particles slightly larger if they are close to the best
            const isBest = (p.bestFitness === swarm.globalBestFitness);
            const radius = isBest ? 6 : 3.5;
            const glow = isBest ? 25 : 12;

            // Draw Trail
            if (p.history.length > 1) {
                this.ctx.beginPath();
                this.ctx.lineWidth = isBest ? 2 : 1.5;
                for (let i = 0; i < p.history.length; i++) {
                    let h = p.history[i];
                    let hz = (swarm.currentScenario !== 'target') ? h.z * zScale : 0;
                    let hp = this.project(h.x, h.y, hz);

                    // Gradient opacity for trail
                    const opacity = Math.pow(i / p.history.length, 2) * 0.8;
                    this.ctx.strokeStyle = p.color;
                    this.ctx.globalAlpha = opacity;

                    if (i === 0) this.ctx.moveTo(hp.x, hp.y);
                    else this.ctx.lineTo(hp.x, hp.y);
                }
                this.ctx.stroke();
                this.ctx.globalAlpha = 1.0;
            }

            // Draw Particle with Glow
            this.ctx.shadowBlur = glow;
            this.ctx.shadowColor = p.color;

            this.ctx.beginPath();
            this.ctx.arc(proj.x, proj.y, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = isBest ? '#ffffff' : p.color;
            this.ctx.fill();

            // Inner core
            this.ctx.shadowBlur = 0;
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(proj.x, proj.y, radius * 0.4, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.globalCompositeOperation = 'source-over';
    }

    drawTerrain(scenario, width, height) {
        if (!Scenarios[scenario] || scenario === 'target') return;

        this.ctx.lineWidth = 1;

        const steps = 35; // slightly higher resolution
        const stepX = width / steps;
        const stepY = height / steps;
        const zScale = 50;

        // Terrain color function based on scenario
        const getColor = (val, maxZ) => {
            // we map val to a smooth cool palette (purple -> cyan -> green)
            // assume val is generally 0 to maxZ approx
            const t = Math.max(0, Math.min(1, val / maxZ));
            const hue = 280 - (t * 140); // 280 (purple) to 140 (green)
            return `hsla(${hue}, 80%, 60%, 0.25)`;
        };

        let maxZEstimate = scenario === 'rastrigin' ? 80 : (scenario === 'ackley' ? 22 : 10);

        // Draw Grid Lines X
        for (let i = 0; i <= steps; i++) {
            this.ctx.beginPath();
            for (let j = 0; j <= steps; j++) {
                const x = i * stepX;
                const y = j * stepY;

                const nx = (x / width) * 4 - 2;
                const ny = (y / height) * 4 - 2;
                let z = Scenarios[scenario](nx, ny);

                const col = getColor(z, maxZEstimate);

                z *= zScale;
                const p = this.project(x, y, z);

                if (j === 0) {
                    this.ctx.moveTo(p.x, p.y);
                    this.ctx.strokeStyle = col; // start with first color
                }
                else {
                    this.ctx.lineTo(p.x, p.y);
                }
            }
            // To do true gradient lines per segment is slow, so we just use the average or let it be uniform per line
            this.ctx.stroke();
        }

        // Draw Grid Lines Y
        for (let j = 0; j <= steps; j++) {
            this.ctx.beginPath();
            for (let i = 0; i <= steps; i++) {
                const x = i * stepX;
                const y = j * stepY;

                const nx = (x / width) * 4 - 2;
                const ny = (y / height) * 4 - 2;
                let z = Scenarios[scenario](nx, ny);

                const col = getColor(z, maxZEstimate);
                if (i === 0) this.ctx.strokeStyle = col;

                z *= zScale;
                const p = this.project(x, y, z);

                if (i === 0) this.ctx.moveTo(p.x, p.y);
                else this.ctx.lineTo(p.x, p.y);
            }
            this.ctx.stroke();
        }
    }

    drawCircle(x, y, r, color) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, r, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();
    }
}
