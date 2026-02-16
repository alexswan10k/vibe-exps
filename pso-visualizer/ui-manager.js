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

        this.bindControls();
        this.updateStats();

        // Initial Draw
        this.renderer.clear();
        this.renderer.drawSwarm(this.simulation.swarm);
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
                this.simulation.swarm.setScenario(e.target.value);
                this.reset();
            });
        }

        // Sliders
        const bindSlider = (id, paramKey, valId) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', (e) => {
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
        bindSlider('sliderPopSize', 'population', 'valPopSize');

        // Canvas Interaction (Camera Rotate or Target)
        this.renderer.canvas.addEventListener('mousemove', (e) => {
            if (e.buttons === 1) { // Left click drag
                if (this.simulation.swarm.currentScenario === 'target') {
                    // For target mode, keep moving target logic? Or switch to 3D cam?
                    // Let's use click for target, drag for camera?
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
                // We need to unproject to get world coords... tricky without full 3D inverse
                // But for 'target' mode we assume 2D flat view? 
                // Let's assume target mode is flat for now, or just use mouse pos if we reset camera to top-down?
                // Or simplified: Just set target at mouse screen pos (approx)

                // For now, let's keep target mode as "2D" but rendered in 3D?
                // Actually, let's just allow target setting on click if in 2D mode, 
                // but this renderer is 3D default.
                // Let's skip mouse target setting for now to avoid math complexity of raycasting.
                // Or implementing a simple unproject for z=0 plane.
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

        this.simulation.run();

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
