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
        this.training = false;
        this.learningRate = 0.1;
        this.batchSize = 20;
        this.epoch = 0;
        this.datasetType = 'XOR';
        this.hiddenLayers = [8, 8]; // Default topology

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
        const count = 300;
        if (this.datasetType === 'XOR') this.data = DataGenerator.generateXOR(count);
        else if (this.datasetType === 'Circles') this.data = DataGenerator.generateCircles(count);
        else if (this.datasetType === 'Spiral') this.data = DataGenerator.generateSpiral(count);
        else if (this.datasetType === 'Surface3D') this.data = DataGenerator.generateSurface(count);

        this.nn = new NeuralNetwork({
            inputSize: 2,
            hiddenLayers: [...this.hiddenLayers],
            activation: this.datasetType === 'Surface3D' ? 'tanh' : 'sigmoid',
            outputType: this.datasetType === 'Surface3D' ? 'regression' : 'classification',
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
        if (this.datasetType === 'Surface3D') {
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
