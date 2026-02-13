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
        this.regularization = 0.0;
        this.noise = 0.0;
        this.activation = 'tanh';
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

        document.getElementById('sliderReg').oninput = (e) => {
            this.regularization = parseFloat(e.target.value);
            document.getElementById('valReg').innerText = this.regularization.toFixed(4);
            if (this.nn) this.nn.regularizationRate = this.regularization;
        };

        document.getElementById('sliderNoise').onchange = (e) => {
            this.noise = parseFloat(e.target.value);
            document.getElementById('valNoise').innerText = this.noise.toFixed(2);
            this.reset();
        };
        // Also update text on input without resetting
        document.getElementById('sliderNoise').oninput = (e) => {
            document.getElementById('valNoise').innerText = parseFloat(e.target.value).toFixed(2);
        };

        document.getElementById('selectActivation').onchange = (e) => {
            this.activation = e.target.value;
            this.reset();
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

        // Mobile Redesign: Tab Bar Navigation
        const tabs = document.querySelectorAll('.tab-item');
        const controls = document.getElementById('controlsSidebar');
        const stats = document.getElementById('statsSidebar');

        tabs.forEach(tab => {
            tab.onclick = () => {
                const target = tab.dataset.tab;

                // Update tab UI
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Update Panel UI
                controls.classList.remove('active');
                stats.classList.remove('active');

                if (target === 'settings') {
                    controls.classList.add('active');
                } else if (target === 'stats') {
                    stats.classList.add('active');
                }
                // 'simulation' tab just hides everything, showing the canvas
            };
        });

        document.getElementById('btnAddLayer').onclick = () => this.addLayer();
        document.getElementById('btnRemoveLayer').onclick = () => this.removeLayer();

        // Touch Events for Mobile (Refined & Fixed)
        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                isDragging = true;
                const touch = e.touches[0];
                lastX = touch.clientX;
                lastY = touch.clientY;

                // For 3D rotation we want to capture the gesture
                const is3D = ['Surface3D', 'Ripple', 'Peaks', 'Saddle', 'Terrain', 'Fractal'].includes(this.datasetType);
                if (is3D) {
                    e.preventDefault();
                }
            }
        }, { passive: false });

        window.addEventListener('touchend', () => isDragging = false);
        window.addEventListener('touchcancel', () => isDragging = false);

        window.addEventListener('touchmove', (e) => {
            if (!isDragging || e.touches.length !== 1) return;

            const is3D = ['Surface3D', 'Ripple', 'Peaks', 'Saddle', 'Terrain', 'Fractal'].includes(this.datasetType);
            if (!is3D) return;

            const touch = e.touches[0];
            const dx = touch.clientX - lastX;
            const dy = touch.clientY - lastY;

            this.renderer.camera.rotZ += dx * 0.01;
            this.renderer.camera.rotX += dy * 0.01;

            lastX = touch.clientX;
            lastY = touch.clientY;

            // Allow control via prevent-default for non-passive listeners
            e.preventDefault();
        }, { passive: false });
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
        const isHard = ['TwoSpirals', 'Checkerboard', 'Terrain', 'Fractal'].includes(this.datasetType);
        const count = isHard ? 1000 : 400; // More data for complex patterns
        const is3D = ['Surface3D', 'Ripple', 'Peaks', 'Saddle', 'Terrain', 'Fractal'].includes(this.datasetType);

        if (this.datasetType === 'XOR') this.data = DataGenerator.generateXOR(count, this.noise);
        else if (this.datasetType === 'Circles') this.data = DataGenerator.generateCircles(count, this.noise);
        else if (this.datasetType === 'Spiral') this.data = DataGenerator.generateSpiral(count, this.noise);
        else if (this.datasetType === 'TwoSpirals') this.data = DataGenerator.generateTwoSpirals(count, this.noise);
        else if (this.datasetType === 'Checkerboard') this.data = DataGenerator.generateCheckerboard(count, this.noise);
        else if (this.datasetType === 'Surface3D') this.data = DataGenerator.generateSurface(count, this.noise);
        else if (this.datasetType === 'Ripple') this.data = DataGenerator.generateRipple(count, this.noise);
        else if (this.datasetType === 'Peaks') this.data = DataGenerator.generatePeaks(count, this.noise);
        else if (this.datasetType === 'Saddle') this.data = DataGenerator.generateSaddle(count, this.noise);
        else if (this.datasetType === 'Terrain') this.data = DataGenerator.generateTerrain(count, this.noise);
        else if (this.datasetType === 'Fractal') this.data = DataGenerator.generateFractal(count, this.noise);

        // Determine activation: use user selection, but override for 3D if needed?
        // Actually, user selection is fine for 2D. for 3D regression, tanh is usually best but relu can work.
        // Let's trust the user, but maybe default to tanh in UI if they haven't touched it?
        // The UI init value is 'tanh'.

        this.nn = new NeuralNetwork({
            inputSize: 2,
            hiddenLayers: [...this.hiddenLayers],
            activation: this.activation,
            outputType: is3D ? 'regression' : 'classification',
            learningRate: this.learningRate,
            regularizationRate: this.regularization
        });

        this.epoch = 0;
        this.training = false;
        this.lossPlotter.clear();
        document.getElementById('btnStart').innerText = 'BEGIN TRAINING';
        document.getElementById('valEpoch').innerText = '0';
        document.getElementById('valLoss').innerText = '0.0000';

        const badge = document.getElementById('badge-mode');
        if (badge) {
            badge.innerText = is3D ? '3D Regression' : '2D Classification';
        }
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
