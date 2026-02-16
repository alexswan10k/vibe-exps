/**
 * PSO Visualizer
 * UI Manager & Main Loop
 */

class FitnessGraph {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.history = [];
    }

    add(best) {
        this.history.push(best);
        if (this.history.length > 200) this.history.shift();
        this.draw();
    }

    draw() {
        if (!this.canvas) return;
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        if (this.history.length < 2) return;

        // Find range
        let max = -Infinity;
        let min = Infinity;
        for (let v of this.history) {
            if (v > max) max = v;
            if (v < min) min = v;
        }

        if (max === min) max = min + 1;

        this.ctx.beginPath();
        this.ctx.strokeStyle = '#00ff9d';
        this.ctx.lineWidth = 2;

        for (let i = 0; i < this.history.length; i++) {
            const x = (i / (this.history.length - 1)) * w;
            // Normalize y: 0 at bottom, 1 at top. 
            // Value min -> h, Value max -> 0
            const val = this.history[i];
            const norm = (val - min) / (max - min);
            const y = h - (norm * h);

            if (i === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
        }
        this.ctx.stroke();
    }

    clear() {
        this.history = [];
        if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

class UIManager {
    constructor() {
        this.renderer = new Renderer('mainCanvas');
        this.simulation = new Simulation(this.renderer.width, this.renderer.height);
        this.fitnessGraph = new FitnessGraph('fitnessCanvas');

        this.isRunning = false;
        this.animationId = null;
        this.speed = 1;
        this.autoRotate = false;

        this.bindControls();
        this.updateStats();

        // Initial Draw
        // Set initial camera based on default scenario (target)
        this.setCameraForScenario(this.simulation.swarm.currentScenario);
        this.renderer.clear();
        this.renderer.drawSwarm(this.simulation.swarm);
    }

    setCameraForScenario(scenario) {
        if (scenario === 'target') {
            this.renderer.camera.angle = 0;
            this.renderer.camera.pitch = 0;
            this.renderer.camera.zoom = 1.0;
        } else {
            this.renderer.camera.angle = Math.PI / 4;
            this.renderer.camera.pitch = Math.PI / 3;
            this.renderer.camera.zoom = 0.8; // Zoom out a bit for 3D
        }
    }

    bindControls() {
        // Buttons
        document.getElementById('btnStart').addEventListener('click', () => {
            if (this.isRunning) {
                this.pause();
                document.getElementById('btnStart').textContent = "RESUME";
            } else {
                this.start();
                document.getElementById('btnStart').textContent = "PAUSE";
            }
        });

        document.getElementById('btnReset').addEventListener('click', () => {
            this.reset();
        });

        // Scenario Selector
        const sScenario = document.getElementById('selectScenario');
        if (sScenario) {
            sScenario.addEventListener('change', (e) => {
                const scenario = e.target.value;
                this.simulation.swarm.setScenario(scenario);
                this.setCameraForScenario(scenario);
                this.reset();
            });
        }

        // Sliders
        // Sliders
        const bindSlider = (id, paramKey, valId, eventType = 'input') => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener(eventType, (e) => {
                const val = parseFloat(e.target.value);
                document.getElementById(valId).textContent = val;

                const params = {};
                params[paramKey] = val;
                this.simulation.updateParams(params);
            });
        };

        bindSlider('sliderInertia', 'inertia', 'valInertia');
        bindSlider('sliderCognitive', 'cognitive', 'valCognitive');
        bindSlider('sliderSocial', 'social', 'valSocial');
        bindSlider('sliderInertia', 'inertia', 'valInertia');
        bindSlider('sliderCognitive', 'cognitive', 'valCognitive');
        bindSlider('sliderSocial', 'social', 'valSocial');
        // Use 'change' for population to avoid rapid restarts during drag
        bindSlider('sliderPopSize', 'population', 'valPopSize', 'change');

        // Speed Slider
        const speedSlider = document.getElementById('sliderSpeed');
        if (speedSlider) {
            speedSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                document.getElementById('valSpeed').textContent = val + 'x';
                this.speed = val;
            });
        }

        // Auto Rotate Checkbox
        const autoRotateCheck = document.getElementById('checkAutoRotate');
        if (autoRotateCheck) {
            autoRotateCheck.addEventListener('change', (e) => {
                this.autoRotate = e.target.checked;
            });
        }

        // Canvas Interaction (Camera Rotate or Target)
        this.renderer.canvas.addEventListener('mousemove', (e) => {
            if (e.buttons === 1) { // Left click drag
                if (this.simulation.swarm.currentScenario === 'target') {
                    // In 2D mode, maybe drag to move target?
                    // Or just ignore drag for visual stability
                } else {
                    // Rotate camera
                    this.renderer.camera.angle += e.movementX * 0.01;
                    this.renderer.camera.pitch += e.movementY * 0.01;

                    if (!this.isRunning) {
                        this.renderer.clear();
                        this.renderer.drawSwarm(this.simulation.swarm);
                    }
                }
            }
        });

        this.renderer.canvas.addEventListener('mousedown', (e) => {
            if (this.simulation.swarm.currentScenario === 'target') {
                const rect = this.renderer.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                this.simulation.setTarget(x, y);

                if (!this.isRunning) {
                    this.renderer.clear();
                    this.renderer.drawSwarm(this.simulation.swarm);
                }
            }
        });
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.animate();
        }
    }

    pause() {
        this.isRunning = false;
        cancelAnimationFrame(this.animationId);
    }

    reset() {
        this.pause();
        // Preserve scenario
        const scenario = this.simulation.swarm.currentScenario;
        this.simulation.restart();
        this.simulation.swarm.setScenario(scenario);

        // Reset Params from UI
        this.simulation.updateParams({
            inertia: parseFloat(document.getElementById('sliderInertia').value),
            cognitive: parseFloat(document.getElementById('sliderCognitive').value),
            social: parseFloat(document.getElementById('sliderSocial').value),
            population: parseInt(document.getElementById('sliderPopSize').value)
        });

        this.fitnessGraph.clear();
        this.renderer.clear();
        this.renderer.drawSwarm(this.simulation.swarm);
        this.updateStats();

        document.getElementById('btnStart').textContent = "START SWARM";
    }

    animate() {
        if (!this.isRunning) return;

        // Speed Control Logic
        // If speed > 1, run multiple steps per frame
        // If speed < 1, skip frames

        let steps = 1;

        if (this.speed >= 1) {
            steps = Math.round(this.speed);
        } else {
            // e.g. speed 0.1 -> run once every 10 frames
            // speed 0.5 -> run once every 2 frames
            if (Math.random() > this.speed) {
                steps = 0;
            }
        }

        for (let i = 0; i < steps; i++) {
            this.simulation.run();
        }

        // Auto Rotate
        if (this.autoRotate && this.simulation.swarm.currentScenario !== 'target') {
            this.renderer.camera.angle += 0.005;
        }

        // Draw
        this.renderer.clear();
        this.renderer.drawSwarm(this.simulation.swarm);

        // Stats
        this.updateStats();

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    updateStats() {
        document.getElementById('valIteration').textContent = this.simulation.iteration;
        if (this.simulation.swarm) {
            const fit = this.simulation.swarm.globalBestFitness;
            document.getElementById('valBestFitness').textContent = fit.toFixed(4);
            this.fitnessGraph.add(fit);
        }
    }
}

// Start
const app = new UIManager();
