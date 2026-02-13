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
}

class Renderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        // Heatmap resolution
        this.resolution = 10;
    }

    drawHeatmap(nn) {
        const res = this.resolution;
        for (let x = 0; x < this.width; x += res) {
            for (let y = 0; y < this.height; y += res) {
                // Map canvas coords to [-1, 1]
                const nx = (x / this.width) * 2 - 1;
                const ny = (y / this.height) * 2 - 1;

                const pred = nn.predict([nx, ny]);

                // Color mapping: 0 -> Cyan, 1 -> Pink
                const r = Math.floor(255 * pred + 100 * (1 - pred));
                const g = Math.floor(200 * (1 - pred) + 100 * pred);
                const b = Math.floor(255 * (1 - pred) + 200 * pred);

                this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                this.ctx.fillRect(x, y, res, res);
            }
        }
    }

    drawData(data) {
        for (const pt of data) {
            const px = (pt.x + 1) / 2 * this.width;
            const py = (pt.y + 1) / 2 * this.height;

            this.ctx.beginPath();
            this.ctx.arc(px, py, 5, 0, Math.PI * 2);
            this.ctx.fillStyle = pt.label === 1 ? '#ff00ff' : '#00ffff';
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 1;
            this.ctx.fill();
            this.ctx.stroke();
        }
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
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
