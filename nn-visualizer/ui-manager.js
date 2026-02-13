/**
 * Neural Network Learning Simulator
 * UI & Main Loop
 */

class App {
    constructor() {
        this.nn = null;
        this.renderer = new Renderer('mainCanvas');
        this.graphRenderer = new NetworkGraphRenderer('graphCanvas');
        this.data = [];
        this.training = false;
        this.learningRate = 0.1;
        this.batchSize = 10;
        this.epoch = 0;

        this.initEventListeners();
        this.reset();
        this.loop();
    }

    initEventListeners() {
        document.getElementById('btnStart').onclick = () => this.training = !this.training;
        document.getElementById('btnReset').onclick = () => this.reset();
        document.getElementById('selectDataset').onchange = (e) => this.reset(e.target.value);

        document.getElementById('sliderLR').oninput = (e) => {
            this.learningRate = parseFloat(e.target.value);
            document.getElementById('valLR').innerText = this.learningRate;
            if (this.nn) this.nn.learningRate = this.learningRate;
        };
    }

    reset(datasetType = 'XOR') {
        const count = 200;
        if (datasetType === 'XOR') this.data = DataGenerator.generateXOR(count);
        else if (datasetType === 'Circles') this.data = DataGenerator.generateCircles(count);
        else if (datasetType === 'Spiral') this.data = DataGenerator.generateSpiral(count);

        this.nn = new NeuralNetwork({
            inputSize: 2,
            hiddenLayers: [4, 4],
            activation: 'sigmoid',
            learningRate: this.learningRate
        });

        this.epoch = 0;
        this.training = false;
        document.getElementById('valEpoch').innerText = '0';
    }

    trainStep() {
        if (!this.training) return;

        const inputs = this.data.map(d => [d.x, d.y]);
        const labels = this.data.map(d => d.label);

        const loss = this.nn.train(inputs, labels, this.batchSize);
        this.epoch++;

        document.getElementById('valEpoch').innerText = this.epoch;
        document.getElementById('valLoss').innerText = loss.toFixed(4);
    }

    loop() {
        this.trainStep();

        this.renderer.clear();
        this.renderer.drawHeatmap(this.nn);
        this.renderer.drawData(this.data);

        this.graphRenderer.draw(this.nn);

        requestAnimationFrame(() => this.loop());
    }
}

window.onload = () => {
    window.app = new App();
};
