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
}

class Renderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.resolution = 12;
    }

    drawHeatmap(nn, mode = 'classification') {
        const res = this.resolution;
        for (let x = 0; x < this.width; x += res) {
            for (let y = 0; y < this.height; y += res) {
                const nx = (x / this.width) * 2 - 1;
                const ny = (y / this.height) * 2 - 1;
                const pred = nn.predict([nx, ny]);

                let r, g, b;
                if (mode === 'classification') {
                    r = Math.floor(255 * pred + 100 * (1 - pred));
                    g = Math.floor(200 * (1 - pred) + 100 * pred);
                    b = Math.floor(255 * (1 - pred) + 200 * pred);
                } else {
                    // Regression color mapping: z from [-1, 1]
                    const val = (pred + 1) / 2; // Map to [0, 1]
                    r = Math.floor(100 + val * 155);
                    g = Math.floor(50 + val * 100);
                    b = Math.floor(200 - val * 150);
                }

                this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                this.ctx.fillRect(x, y, res, res);
            }
        }
    }

    draw3DSurface(nn) {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;
        const res = 20; // Lower resolution for grid

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;

        const project = (x, y, z) => {
            // Isometric-ish projection
            const px = w / 2 + (x - y) * (w / 2.5);
            const py = h / 2 + (x + y) * (h / 5) - z * (h / 4);
            return { x: px, y: py };
        };

        for (let i = -1; i <= 1; i += 0.1) {
            ctx.beginPath();
            for (let j = -1; j <= 1; j += 0.1) {
                const z = nn.predict([i, j]);
                const p = project(i, j, z);
                if (j === -1) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
        }

        for (let j = -1; j <= 1; j += 0.1) {
            ctx.beginPath();
            for (let i = -1; i <= 1; i += 0.1) {
                const z = nn.predict([i, j]);
                const p = project(i, j, z);
                if (i === -1) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
        }
    }

    drawData(data, mode = 'classification') {
        for (const pt of data) {
            const px = (pt.x + 1) / 2 * this.width;
            const py = (pt.y + 1) / 2 * this.height;

            this.ctx.beginPath();
            this.ctx.arc(px, py, mode === 'classification' ? 5 : 3, 0, Math.PI * 2);
            if (mode === 'classification') {
                this.ctx.fillStyle = pt.label === 1 ? '#ff00ff' : '#00ffff';
            } else {
                const val = (pt.label + 1) / 2;
                this.ctx.fillStyle = `rgb(${Math.floor(val * 255)}, 255, ${Math.floor((1 - val) * 255)})`;
            }
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
