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
        this.ctx.fillStyle = '#0a0a0f'; // BG color
        this.ctx.fillRect(0, 0, this.width, this.height);
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

    drawTerrain(scenario, width, height) {
        if (!Scenarios[scenario] || scenario === 'target') return;

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;

        const steps = 20;
        const stepX = width / steps;
        const stepY = height / steps;

        // Helper to get Z scale
        // Benchmarks return varying Z ranges. Sphere ~0-8 for range -2..2. Rastrigin can be high.
        // We need to scale Z for visual consistency (~0-200px?)
        const zScale = 50;

        // Draw Grid Lines X
        for (let i = 0; i <= steps; i++) {
            this.ctx.beginPath();
            for (let j = 0; j <= steps; j++) {
                const x = i * stepX;
                const y = j * stepY;

                // Calculate Z
                const nx = (x / width) * 4 - 2;
                const ny = (y / height) * 4 - 2;
                let z = Scenarios[scenario](nx, ny) * zScale;

                // Clamp visual Z?
                // z = Math.min(z, 200);

                const p = this.project(x, y, z);
                if (j === 0) this.ctx.moveTo(p.x, p.y);
                else this.ctx.lineTo(p.x, p.y);
            }
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
                let z = Scenarios[scenario](nx, ny) * zScale;

                const p = this.project(x, y, z);
                if (i === 0) this.ctx.moveTo(p.x, p.y);
                else this.ctx.lineTo(p.x, p.y);
            }
            this.ctx.stroke();
        }
    }

    drawSwarm(swarm) {
        if (!swarm) return;

        const zScale = 50;

        // Draw Terrain First
        this.drawTerrain(swarm.currentScenario, swarm.width, swarm.height);

        // Draw Target if in target mode
        if (swarm.currentScenario === 'target') {
            const pt = this.project(swarm.target.x, swarm.target.y, 0);
            this.drawCircle(pt.x, pt.y, 10, '#ff0055');
        }

        // Draw Particles
        this.ctx.globalCompositeOperation = 'lighter';

        for (let p of swarm.particles) {
            let z = 0;
            // If we are in a 3D scenario, use particle's Z (fitness) for height
            if (swarm.currentScenario !== 'target') {
                // Re-calculate z in case it's not stored or needs scaling
                // p.position.z should be set by evaluate
                z = p.position.z * zScale;
            }

            const proj = this.project(p.position.x, p.position.y, z);

            // Draw Trail
            if (p.history.length > 1) {
                this.ctx.beginPath();
                this.ctx.strokeStyle = p.color;
                this.ctx.lineWidth = 1;
                for (let i = 0; i < p.history.length; i++) {
                    let h = p.history[i];
                    let hz = (swarm.currentScenario !== 'target') ? h.z * zScale : 0;
                    let hp = this.project(h.x, h.y, hz);
                    if (i === 0) this.ctx.moveTo(hp.x, hp.y);
                    else this.ctx.lineTo(hp.x, hp.y);
                }
                this.ctx.stroke();
            }

            // Draw Particle
            this.ctx.beginPath();
            this.ctx.arc(proj.x, proj.y, 3, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.fill();
        }

        this.ctx.globalCompositeOperation = 'source-over';
    }

    drawCircle(x, y, r, color) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, r, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();
    }
}
