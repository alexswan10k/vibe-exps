/**
 * PSO Visualizer
 * Simulation Loop
 */

class Simulation {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.iteration = 0;

        // PSO Parameters
        this.params = {
            inertia: 0.9,
            cognitive: 1.5,
            social: 1.5,
            population: 50
        };

        this.swarm = new Swarm(this.params.population, width, height);
    }

    restart() {
        this.iteration = 0;
        this.swarm = new Swarm(this.params.population, this.width, this.height);
    }

    updateParams(params) {
        this.params = { ...this.params, ...params };
        if (this.swarm.particles.length !== parseInt(this.params.population)) {
            this.restart();
        }
    }

    run() {
        this.swarm.run(this.params.inertia, this.params.cognitive, this.params.social);
        this.iteration++;
    }

    setTarget(x, y) {
        this.swarm.setTarget(x, y);
    }
}
