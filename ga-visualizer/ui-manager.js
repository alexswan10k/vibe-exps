/**
 * Genetic Algorithm Visualizer
 * UI Manager & Main Loop
 */

class UIManager {
    constructor() {
        this.renderer = new Renderer('mainCanvas');
        this.fitnessGraph = new FitnessGraph('fitnessCanvas');

        // Default Params
        this.popSize = 100;
        this.mutationRate = 0.01;
        this.lifespan = 400;
        this.speed = 5;

        // Generic Simulation Wrapper
        this.simulation = new Simulation(this.renderer.width, this.renderer.height);

        this.isRunning = false;
        this.animationId = null;

        this.bindControls();
        this.updateStats();

        // Initial Domain UI
        this.updateUIForDomain('smart-rockets');

        // Initial Draw
        if (this.simulation.activeManager.draw) {
            this.simulation.activeManager.draw(this.renderer);
        }
    }

    bindControls() {
        // Domain Selector
        const sDomain = document.getElementById('selectDomain');
        if (sDomain) {
            sDomain.addEventListener('change', (e) => {
                this.simulation.setDomain(e.target.value);
                this.reset();
                this.updateUIForDomain(e.target.value);
            });
        }

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

        // Sliders - Update active manager params
        const sPop = document.getElementById('sliderPopSize');
        sPop.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            document.getElementById('valPopSize').textContent = val;
            if (this.simulation.activeManager) this.simulation.activeManager.popSize = val;
        });

        const sMut = document.getElementById('sliderMutation');
        sMut.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            document.getElementById('valMutation').textContent = val;
            if (this.simulation.activeManager) this.simulation.activeManager.mutationRate = val;
        });

        const sLife = document.getElementById('sliderLifespan');
        sLife.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            document.getElementById('valLifespan').textContent = val;
            if (this.simulation.activeManager) this.simulation.activeManager.lifespan = val;
        });

        const sSpeed = document.getElementById('sliderSpeed');
        sSpeed.addEventListener('input', (e) => {
            this.speed = parseInt(e.target.value);
            document.getElementById('valSpeed').textContent = this.speed;
        });

        // Preset Selector
        const sPreset = document.getElementById('selectPreset');
        sPreset.addEventListener('change', (e) => {
            if (this.simulation.activeManager && this.simulation.activeManager.loadPreset) {
                this.simulation.activeManager.loadPreset(e.target.value);

                // Sync UI if String Evo
                // Check if we have the target phrase property exposed or just assume
                if (this.simulation.activeManager.targetPhrase) {
                    const el = document.getElementById('inputTargetPhrase');
                    if (el) el.value = this.simulation.activeManager.targetPhrase;
                }

                this.reset();
            }
        });

        // String Evo Control
        const iTarget = document.getElementById('inputTargetPhrase');
        iTarget.addEventListener('input', (e) => { // Click or Enter
            // De-bounce or just wait for explicit "change" (enter/blur)
            // "change" is better for string evo reset
        });
        iTarget.addEventListener('change', (e) => {
            if (this.simulation.activeManager && this.simulation.activeManager.setTargetPhrase) {
                this.simulation.activeManager.setTargetPhrase(e.target.value);
                this.reset();
            }
        });

        // TSP Control
        const sCities = document.getElementById('sliderCityCount');
        sCities.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            document.getElementById('valCityCount').textContent = val;
            if (this.simulation.activeManager && this.simulation.activeManager.setTotalCities) {
                this.simulation.activeManager.setTotalCities(val);
                this.reset();
            }
        });
    }

    updateUIForDomain(domain) {
        // Toggle controls
        const sPresetDiv = document.getElementById('control-preset');
        const sLifespan = document.getElementById('sliderLifespan').parentElement;

        const cTarget = document.getElementById('control-target-phrase');
        const cCities = document.getElementById('control-city-count');
        const cModel = document.getElementById('controls-model'); // Model Inspection

        // Reset visibility
        sPresetDiv.style.display = 'block'; // Always show preset now
        sLifespan.style.display = 'none';
        cTarget.style.display = 'none';
        cCities.style.display = 'none';
        if (cModel) cModel.style.display = 'none';

        // Labels
        const lblVector = document.querySelector('#controls-model label:nth-of-type(1)');
        const lblDNA = document.querySelector('#controls-model label:nth-of-type(2)');
        // Note: querySelector might pick up first label in control-group. 
        // Structure is: 
        // div (control-group) -> label, canvas
        // div (control-group) -> label, canvas
        // Let's select by structure or assume order.
        const cGroups = document.querySelectorAll('#controls-model .control-group');
        let lbl1, lbl2;
        if (cGroups.length >= 2) {
            lbl1 = cGroups[0].querySelector('label');
            lbl2 = cGroups[1].querySelector('label');
        }

        // Populate Presets
        const sPreset = document.getElementById('selectPreset');
        sPreset.innerHTML = ""; // Clear

        const addOption = (val, text) => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = text;
            sPreset.appendChild(opt);
        };

        if (domain === 'smart-rockets') {
            sLifespan.style.display = 'block';
            if (cModel) cModel.style.display = 'block'; // Show Model Inspection
            if (lbl1) lbl1.textContent = "CURRENT FORCE";
            if (lbl2) lbl2.textContent = "DNA SEQUENCE";
            addOption("simple", "Simple Barrier");
            addOption("split", "Split Path");
            addOption("maze", "Mini Maze");
            addOption("complex", "Complex");

        } else if (domain === 'string-evolution') {
            cTarget.style.display = 'block';
            if (cModel) cModel.style.display = 'block';
            if (lbl1) lbl1.textContent = "MATCH %";
            if (lbl2) lbl2.textContent = "BEST PHRASE";
            addOption("shakespeare", "To Be Or Not To Be");
            addOption("hello", "Hello World");
            addOption("alphabet", "Alphabet");
            addOption("data", "Genetic Algorithms");

        } else if (domain === 'tsp') {
            cCities.style.display = 'block';
            if (cModel) cModel.style.display = 'block';
            if (lbl1) lbl1.textContent = "TOTAL DISTANCE";
            if (lbl2) lbl2.textContent = "CITY ORDER";
            addOption("random", "Random Scatter");
            addOption("circle", "Perfect Circle");
            addOption("grid", "Grid Layout");
            addOption("clusters", "Cluster Groups");
        }

        // Trigger load of first preset
        if (this.simulation.activeManager && this.simulation.activeManager.loadPreset) {
            this.simulation.activeManager.loadPreset(sPreset.value);
        }
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

        // Restart the current simulation (preserves state like city count/target phrase)
        this.simulation.restart();

        // Sync params (only those that might have changed externally, though listeners handle this)
        // We do this to ensure UI reflects internal state if needed, or vice-versa
        // Actually listeners update manager directly. 
        // We just need to restart.

        this.fitnessGraph.clear();
        this.updateStats();

        this.renderer.clear();
        if (this.simulation.activeManager.draw) {
            this.simulation.activeManager.draw(this.renderer, this.simulation.count);
        }

        document.getElementById('btnStart').textContent = "START EVOLUTION";
    }

    animate() {
        if (!this.isRunning) return;

        // Speed loop
        for (let n = 0; n < this.speed; n++) {
            this.simulation.run();
        }

        // Draw
        this.renderer.clear();
        if (this.simulation.activeManager.draw) {
            this.simulation.activeManager.draw(this.renderer, this.simulation.count);
        }
        const lifespan = this.simulation.activeManager.lifespan || 1;
        this.renderer.drawStats(this.simulation.generation, this.simulation.count, lifespan);

        // Update stats UI if gen changed
        if (this.simulation.count === 0) {
            this.updateStats();
        }

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    updateStats() {
        document.getElementById('valGeneration').textContent = this.simulation.generation;

        if (this.simulation.stats) {
            const max = this.simulation.stats.maxFit || 0;
            const avg = this.simulation.stats.avgFit || 0;

            document.getElementById('valMaxFitness').textContent = max.toFixed(4);
            document.getElementById('valAvgFitness').textContent = avg.toFixed(4);

            this.fitnessGraph.add(max, avg);
        }
    }
}

// Start
const app = new UIManager();
