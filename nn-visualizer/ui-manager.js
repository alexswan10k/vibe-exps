/**
 * Neural Network Learning Simulator
 * UI & Main Loop
 */

class App {
    constructor() {
        this.nn = null;
        this.renderer = new Renderer('mainCanvas');
        this.graphRenderer = new NetworkGraphRenderer('graphCanvas');
        this.lossPlotter = new LossPlotter('lossCanvas');
        this.data = [];
        this.datasetType = 'Surface3D';
        this.hiddenLayers = [12, 12, 12];
        this.learningRate = 0.1;
        this.batchSize = 32;
        this.training = false;
        this.epoch = 0;

        this.initEventListeners();
        this.renderTopologyUI();
        this.reset();
        this.loop();
    }

    initEventListeners() {
        document.getElementById('btnStart').onclick = () => {
            this.training = !this.training;
            document.getElementById('btnStart').innerText = this.training ? 'PAUSE TRAINING' : 'RESUME TRAINING';
        };
        document.getElementById('btnReset').onclick = () => this.reset();
        document.getElementById('selectDataset').onchange = (e) => {
            this.datasetType = e.target.value;
            this.reset();
        };

        document.getElementById('sliderLR').oninput = (e) => {
            this.learningRate = parseFloat(e.target.value);
            document.getElementById('valLR').innerText = this.learningRate;
            if (this.nn) this.nn.learningRate = this.learningRate;
        };

        const canvas = document.getElementById('mainCanvas');
        let isDragging = false;
        let lastX, lastY;

        canvas.onmousedown = (e) => {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        };

        window.onmouseup = () => isDragging = false;

        window.onmousemove = (e) => {
            if (!isDragging || this.datasetType === 'XOR' || this.datasetType === 'Circles' || this.datasetType === 'Spiral') return;

            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;

            if (e.buttons === 1) { // Left click: Rotation
                this.renderer.camera.rotZ += dx * 0.01;
                this.renderer.camera.rotX += dy * 0.01;
            } else if (e.buttons === 2) { // Right click: Pan
                this.renderer.camera.panX += dx;
                this.renderer.camera.panY += dy;
            }

            lastX = e.clientX;
            lastY = e.clientY;
        };

        canvas.onwheel = (e) => {
            if (this.datasetType === 'XOR' || this.datasetType === 'Circles' || this.datasetType === 'Spiral') return;
            e.preventDefault();
            this.renderer.camera.zoom *= (e.deltaY > 0 ? 0.9 : 1.1);
        };

        canvas.oncontextmenu = (e) => e.preventDefault();

        document.getElementById('btnAddLayer').onclick = () => this.addLayer();
        document.getElementById('btnRemoveLayer').onclick = () => this.removeLayer();
    }

    renderTopologyUI() {
        const container = document.getElementById('layers-container');
        container.innerHTML = '';
        this.hiddenLayers.forEach((size, idx) => {
            const div = document.createElement('div');
            div.className = 'layer-control';
            div.innerHTML = `
                <span>Layer ${idx + 1}</span>
                <input type="number" value="${size}" min="1" max="16" onchange="app.updateLayerSize(${idx}, this.value)">
            `;
            container.appendChild(div);
        });
    }

    addLayer() {
        if (this.hiddenLayers.length < 5) {
            this.hiddenLayers.push(8);
            this.renderTopologyUI();
            this.reset();
        }
    }

    removeLayer() {
        if (this.hiddenLayers.length > 1) {
            this.hiddenLayers.pop();
            this.renderTopologyUI();
            this.reset();
        }
    }

    updateLayerSize(idx, size) {
        this.hiddenLayers[idx] = parseInt(size);
        this.reset();
    }

    reset() {
        const count = 400;
        const is3D = ['Surface3D', 'Ripple', 'Peaks', 'Saddle', 'Terrain', 'Fractal'].includes(this.datasetType);

        if (this.datasetType === 'XOR') this.data = DataGenerator.generateXOR(count);
        else if (this.datasetType === 'Circles') this.data = DataGenerator.generateCircles(count);
        else if (this.datasetType === 'Spiral') this.data = DataGenerator.generateSpiral(count);
        else if (this.datasetType === 'Surface3D') this.data = DataGenerator.generateSurface(count);
        else if (this.datasetType === 'Ripple') this.data = DataGenerator.generateRipple(count);
        else if (this.datasetType === 'Peaks') this.data = DataGenerator.generatePeaks(count);
        else if (this.datasetType === 'Saddle') this.data = DataGenerator.generateSaddle(count);
        else if (this.datasetType === 'Terrain') this.data = DataGenerator.generateTerrain(count);
        else if (this.datasetType === 'Fractal') this.data = DataGenerator.generateFractal(count);

        this.nn = new NeuralNetwork({
            inputSize: 2,
            hiddenLayers: [...this.hiddenLayers],
            activation: is3D ? 'tanh' : 'sigmoid',
            outputType: is3D ? 'regression' : 'classification',
            learningRate: this.learningRate
        });

        this.epoch = 0;
        this.training = false;
        this.lossPlotter.clear();
        document.getElementById('btnStart').innerText = 'BEGIN TRAINING';
        document.getElementById('valEpoch').innerText = '0';
        document.getElementById('valLoss').innerText = '0.0000';
    }

    trainStep() {
        if (!this.training) return;

        const inputs = this.data.map(d => [d.x, d.y]);
        const labels = this.data.map(d => d.label);

        const loss = this.nn.train(inputs, labels, this.batchSize);
        this.epoch++;

        if (this.epoch % 2 === 0) {
            this.lossPlotter.add(loss);
            document.getElementById('valEpoch').innerText = this.epoch;
            document.getElementById('valLoss').innerText = loss.toFixed(4);
        }
    }

    loop() {
        this.trainStep();

        this.renderer.clear();
        const is3D = ['Surface3D', 'Ripple', 'Peaks', 'Saddle', 'Terrain', 'Fractal'].includes(this.datasetType);

        if (is3D) {
            this.renderer.drawHeatmap(this.nn, 'regression');
            this.renderer.draw3DSurface(this.nn);
            this.renderer.drawData(this.data, 'regression');
        } else {
            this.renderer.drawHeatmap(this.nn, 'classification');
            this.renderer.drawData(this.data, 'classification');
        }

        this.graphRenderer.draw(this.nn);

        requestAnimationFrame(() => this.loop());
    }
}

window.onload = () => {
    window.app = new App();
};
