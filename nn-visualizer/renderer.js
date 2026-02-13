/**
 * Neural Network Learning Simulator
 * Visualization & Data
 */

class DataGenerator {
    static generateXOR(count) {
        const data = [];
        for (let i = 0; i < count; i++) {
            const x = Math.random() * 2 - 1;
            const y = Math.random() * 2 - 1;
            const label = (x > 0 && y > 0) || (x < 0 && y < 0) ? 1 : 0;
            data.push({ x, y, label });
        }
        return data;
    }

    static generateCircles(count) {
        const data = [];
        for (let i = 0; i < count; i++) {
            const r = Math.random() * 0.9;
            const theta = Math.random() * Math.PI * 2;
            const x = r * Math.cos(theta);
            const y = r * Math.sin(theta);
            const label = r > 0.5 ? 1 : 0;
            data.push({ x, y, label });
        }
        return data;
    }

    static generateSpiral(count) {
        const data = [];
        for (let i = 0; i < count; i++) {
            const label = i % 2;
            const r = (i / count) * 0.9;
            const theta = (i / count) * Math.PI * 4 + (label * Math.PI);
            const x = r * Math.cos(theta) + (Math.random() - 0.5) * 0.05;
            const y = r * Math.sin(theta) + (Math.random() - 0.5) * 0.05;
            data.push({ x, y, label });
        }
        return data;
    }

    static generateSurface(count) {
        const data = [];
        for (let i = 0; i < count; i++) {
            const x = Math.random() * 2 - 1;
            const y = Math.random() * 2 - 1;
            // Target surface: sin(x*3) * cos(y*3)
            const z = Math.sin(x * 3) * Math.cos(y * 3);
            data.push({ x, y, label: z }); // Using label as target value
        }
        return data;
    }

    static generateRipple(count) {
        const data = [];
        for (let i = 0; i < count; i++) {
            const x = Math.random() * 2 - 1;
            const y = Math.random() * 2 - 1;
            const r = Math.sqrt(x * x + y * y);
            const z = Math.sin(r * 10) / (r * 10 + 0.1);
            data.push({ x, y, label: z });
        }
        return data;
    }

    static generatePeaks(count) {
        const data = [];
        for (let i = 0; i < count; i++) {
            const x = Math.random() * 2 - 1;
            const y = Math.random() * 2 - 1;
            const z = 3 * Math.pow(1 - x, 2) * Math.exp(-(x * x) - Math.pow(y + 1, 2))
                - 10 * (x / 5 - Math.pow(x, 3) - Math.pow(y, 5)) * Math.exp(-(x * x) - (y * y))
                - 1 / 3 * Math.exp(-Math.pow(x + 1, 2) - (y * y));
            // Normalize peaks for viz
            data.push({ x, y, label: z / 8 });
        }
        return data;
    }

    static generateSaddle(count) {
        const data = [];
        for (let i = 0; i < count; i++) {
            const x = Math.random() * 2 - 1;
            const y = Math.random() * 2 - 1;
            const z = x * x - y * y;
            data.push({ x, y, label: z });
        }
        return data;
    }

    static generateTerrain(count) {
        const data = [];
        // Fixed seed-like random for consistent terrain per session
        const noise = (x, y) => {
            return Math.sin(x * 12.7) * Math.cos(y * 45.3) +
                Math.sin(x * 4.1 + y * 2.3) * 0.5 +
                Math.sin(x * 1.5 - y * 3.1) * 0.25;
        };
        for (let i = 0; i < count; i++) {
            const x = Math.random() * 2 - 1;
            const y = Math.random() * 2 - 1;
            const z = noise(x, y) / 2;
            data.push({ x, y, label: z });
        }
        return data;
    }

    static generateFractal(count) {
        const data = [];
        for (let i = 0; i < count; i++) {
            const x = Math.random() * 2 - 1;
            const y = Math.random() * 2 - 1;
            let z = 0;
            let freq = 2;
            let amp = 0.5;
            for (let f = 0; f < 4; f++) {
                z += Math.sin(x * freq + y * freq) * amp;
                freq *= 2;
                amp *= 0.5;
            }
            data.push({ x, y, label: z });
        }
        return data;
    }
}

class Camera {
    constructor() {
        this.rotX = -Math.PI / 6;
        this.rotZ = Math.PI / 4;
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
    }

    project(x, y, z, width, height) {
        // Simple 3D projection with rotation
        // Rotate around Z
        let rx = x * Math.cos(this.rotZ) - y * Math.sin(this.rotZ);
        let ry = x * Math.sin(this.rotZ) + y * Math.cos(this.rotZ);

        // Rotate around X
        let rz = z * Math.cos(this.rotX) - ry * Math.sin(this.rotX);
        ry = z * Math.sin(this.rotX) + ry * Math.cos(this.rotX);

        const s = (width / 2.5) * this.zoom;
        const px = width / 2 + rx * s + this.panX;
        const py = height / 2 + ry * (s * 0.5) + this.panY; // Foreshortened Y

        return { x: px, y: py, depth: rz };
    }
}

class Renderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.resolution = 12;
        this.camera = new Camera();
    }

    getColor(v) {
        // Topographic color ramp helper
        // -1 (Sea) -> 0 (Coast/Land) -> 1 (Mountain)
        const val = Math.min(1, Math.max(-1, v));
        let r, g, b;
        if (val < -0.2) { // Water (Deep Blue -> Cyan)
            const t = (val + 1) / 0.8;
            r = 20 * (1 - t) + 40 * t;
            g = 30 * (1 - t) + 180 * t;
            b = 120 * (1 - t) + 255 * t;
        } else if (val < 0.4) { // Land (Green -> Yellow)
            const t = (val + 0.2) / 0.6;
            r = 40 * (1 - t) + 200 * t;
            g = 150 * (1 - t) + 220 * t;
            b = 40 * (1 - t) + 100 * t;
        } else { // Mountain (Brown -> White)
            const t = (val - 0.4) / 0.6;
            r = 100 * (1 - t) + 255 * t;
            g = 60 * (1 - t) + 255 * t;
            b = 30 * (1 - t) + 255 * t;
        }
        return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
    }

    drawHeatmap(nn, mode = 'classification') {
        if (mode !== 'classification') return; // 3D problems use the projected surface now

        const res = this.resolution;
        for (let x = 0; x < this.width; x += res) {
            for (let y = 0; y < this.height; y += res) {
                const nx = (x / this.width) * 2 - 1;
                const ny = (y / this.height) * 2 - 1;
                const pred = nn.predict([nx, ny]);

                let r, g, b;
                r = Math.floor(255 * pred + 100 * (1 - pred));
                g = Math.floor(200 * (1 - pred) + 100 * pred);
                b = Math.floor(255 * (1 - pred) + 200 * pred);

                this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                this.ctx.fillRect(x, y, res, res);
            }
        }
    }

    draw3DSurface(nn) {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;
        const step = 0.08;

        // Draw background quads (Topographic Heatmap projected in 3D)
        for (let i = -1; i < 1; i += step) {
            for (let j = -1; j < 1; j += step) {
                // Get 4 corners
                const z00 = nn.predict([i, j]);
                const z10 = nn.predict([i + step, j]);
                const z01 = nn.predict([i, j + step]);
                const z11 = nn.predict([i + step, j + step]);

                const p00 = this.camera.project(i, j, z00, w, h);
                const p10 = this.camera.project(i + step, j, z10, w, h);
                const p01 = this.camera.project(i, j + step, z01, w, h);
                const p11 = this.camera.project(i + step, j + step, z11, w, h);

                // Topographic color based on average height
                const avgZ = (z00 + z10 + z01 + z11) / 4;
                ctx.fillStyle = this.getColor(avgZ);

                // Draw quad
                ctx.beginPath();
                ctx.moveTo(p00.x, p00.y);
                ctx.lineTo(p10.x, p10.y);
                ctx.lineTo(p11.x, p11.y);
                ctx.lineTo(p01.x, p01.y);
                ctx.closePath();
                ctx.fill();

                // Subtle grid line
                const alpha = Math.min(1, Math.max(0.1, (p00.depth + 1) / 2));
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.1})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }
    }

    drawData(data, mode = 'classification') {
        const w = this.width;
        const h = this.height;

        for (const pt of data) {
            let px, py;
            if (mode === 'classification') {
                px = (pt.x + 1) / 2 * w;
                py = (pt.y + 1) / 2 * h;
                this.ctx.fillStyle = pt.label === 1 ? '#ff00ff' : '#00ffff';
            } else {
                const p = this.camera.project(pt.x, pt.y, pt.label, w, h);
                px = p.x;
                py = p.y;
                const val = (pt.label + 1) / 2;
                this.ctx.fillStyle = `rgb(${Math.floor(val * 255)}, 255, ${Math.floor((1 - val) * 255)})`;
            }

            this.ctx.beginPath();
            this.ctx.arc(px, py, mode === 'classification' ? 5 : 2, 0, Math.PI * 2);
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 0.5;
            this.ctx.fill();
            this.ctx.stroke();
        }
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }
}

class LossPlotter {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.history = [];
    }

    add(loss) {
        this.history.push(loss);
        if (this.history.length > 200) this.history.shift();
        this.draw();
    }

    clear() {
        this.history = [];
        this.draw();
    }

    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.clearRect(0, 0, w, h);

        if (this.history.length < 2) return;

        const maxLoss = Math.max(...this.history, 0.1);
        ctx.beginPath();
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;

        for (let i = 0; i < this.history.length; i++) {
            const x = (i / (this.history.length - 1)) * w;
            const y = h - (this.history[i] / maxLoss) * h;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
}

class NetworkGraphRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
    }

    draw(nn) {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.clearRect(0, 0, w, h);

        const layers = [nn.layers[0].inputSize, ...nn.layers.map(l => l.outputSize)];
        const layerCount = layers.length;
        const nodeRadius = 8;

        const layerX = (i) => (i + 0.5) * (w / layerCount);
        const nodeY = (lIdx, nIdx) => {
            const totalNodes = layers[lIdx];
            return (nIdx + 0.5) * (h / totalNodes);
        };

        // Draw connections first
        nn.layers.forEach((layer, lIdx) => {
            const x1 = layerX(lIdx);
            const x2 = layerX(lIdx + 1);

            for (let i = 0; i < layer.inputSize; i++) {
                for (let j = 0; j < layer.outputSize; j++) {
                    const y1 = nodeY(lIdx, i);
                    const y2 = nodeY(lIdx + 1, j);

                    const weight = layer.weights[j][i];
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.lineWidth = Math.abs(weight) * 2;
                    ctx.strokeStyle = weight > 0 ? `rgba(255, 0, 255, ${Math.min(1, Math.abs(weight))})` : `rgba(0, 255, 255, ${Math.min(1, Math.abs(weight))})`;
                    ctx.stroke();
                }
            }
        });

        // Draw nodes
        layers.forEach((nodes, lIdx) => {
            const x = layerX(lIdx);
            for (let i = 0; i < nodes; i++) {
                const y = nodeY(lIdx, i);
                ctx.beginPath();
                ctx.arc(x, y, nodeRadius, 0, Math.PI * 2);
                ctx.fillStyle = '#fff';
                ctx.fill();
                ctx.strokeStyle = '#333';
                ctx.stroke();
            }
        });
    }
}
