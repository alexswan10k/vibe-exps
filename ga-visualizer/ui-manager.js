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

        this.population = new Population(
            this.popSize,
            this.mutationRate,
            this.lifespan,
            this.renderer.width,
            this.renderer.height
        );

        this.isRunning = false;
        this.animationId = null;

        this.bindControls();
        this.updateStats();

        // Initial Draw
        this.renderer.drawObstacles(this.population.obstacles);
        this.renderer.drawTarget(this.population.target);
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

        // Sliders
        const sPop = document.getElementById('sliderPopSize');
        sPop.addEventListener('input', (e) => {
            this.popSize = parseInt(e.target.value);
            document.getElementById('valPopSize').textContent = this.popSize;
            // Changing pop size requires reset usually, or we can adjust next gen?
            // For sim simplicity, let's just update the param for next reset, 
            // OR we can trigger a reset if the user drags it. 
            // Let's just update the value for next reset to avoid jarring resets while dragging.
        });

        const sMut = document.getElementById('sliderMutation');
        sMut.addEventListener('input', (e) => {
            this.mutationRate = parseFloat(e.target.value);
            document.getElementById('valMutation').textContent = this.mutationRate;
            this.population.mutationRate = this.mutationRate;
        });

        const sLife = document.getElementById('sliderLifespan');
        sLife.addEventListener('input', (e) => {
            this.lifespan = parseInt(e.target.value);
            document.getElementById('valLifespan').textContent = this.lifespan;
            this.population.lifespan = this.lifespan;
        });

        const sSpeed = document.getElementById('sliderSpeed');
        sSpeed.addEventListener('input', (e) => {
            this.speed = parseInt(e.target.value);
            document.getElementById('valSpeed').textContent = this.speed;
        });

        const sObstacle = document.getElementById('selectObstacle');
        sObstacle.addEventListener('change', (e) => {
            this.population.setupObstacles(e.target.value);
            this.reset(); // Force reset on map change
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
        this.population = new Population(
            this.popSize,
            this.mutationRate,
            this.lifespan,
            this.renderer.width,
            this.renderer.height
        );
        this.population.setupObstacles(document.getElementById('selectObstacle').value);

        this.fitnessGraph.clear();
        this.updateStats();

        this.renderer.clear();
        this.renderer.drawObstacles(this.population.obstacles);
        this.renderer.drawTarget(this.population.target);
        this.renderer.drawPopulation(this.population);

        document.getElementById('btnStart').textContent = "START EVOLUTION";
    }

    animate() {
        if (!this.isRunning) return;

        // Speed loop
        for (let n = 0; n < this.speed; n++) {
            this.population.run();
        }

        // Draw every frame (or skip if super fast? nah draw every frame for smoothness)
        this.renderer.clear();
        this.renderer.drawObstacles(this.population.obstacles);
        this.renderer.drawTarget(this.population.target);
        this.renderer.drawPopulation(this.population);
        this.renderer.drawStats(this.population.generation, this.population.count, this.population.lifespan);

        // Update stats UI if gen changed (simplification: check if count is 0)
        if (this.population.count === 0) {
            this.updateStats();
            // Also update graph
            // We need to capture the fitness stats from the *previous* generation strictly speaking,
            // but we can check if we just reset count.
            // Actually `evaluate` returns stats.
        }

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    updateStats() {
        document.getElementById('valGeneration').textContent = this.population.generation;

        if (this.population.stats) {
            const max = this.population.stats.maxFit;
            const avg = this.population.stats.avgFit;

            document.getElementById('valMaxFitness').textContent = max.toFixed(4);
            document.getElementById('valAvgFitness').textContent = avg.toFixed(4);

            this.fitnessGraph.add(max, avg);
        }
    }
}

// Start
const app = new UIManager();
