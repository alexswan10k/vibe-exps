/**
 * Genetic Algorithm Visualizer
 * Simulation Logic
 */

class Rocket {
    constructor(dna, startX, startY) {
        this.pos = new Vector(startX, startY);
        this.vel = new Vector(0, 0);
        this.acc = new Vector(0, 0);
        this.dna = dna;
        this.fitness = 0;
        this.completed = false;
        this.crashed = false;
        this.color = null; // Will be assigned based on fitness or random
    }

    applyForce(force) {
        this.acc.add(force);
    }

    update(count, obstacles, target) {
        if (this.completed || this.crashed) return;

        const d = Vector.dist(this.pos, target);
        if (d < 10) { // Hit target
            this.completed = true;
            this.pos = target.copy(); // Snap to center
        }

        // Obstacle collision
        for (let obs of obstacles) {
            if (obs.contains(this.pos)) {
                this.crashed = true;
            }
        }

        // Boundary collision (screen edges)
        if (this.pos.x < 0 || this.pos.x > 800 || this.pos.y < 0 || this.pos.y > 600) {
            this.crashed = true;
        }

        if (!this.completed && !this.crashed) {
            this.applyForce(this.dna.genes[count]);
            this.vel.add(this.acc);
            this.pos.add(this.vel);
            this.acc.mult(0); // Reset acc
            this.vel.limit(4); // Max speed hard limit (can be parameterized)
        }
    }

    calcFitness(target) {
        const d = Vector.dist(this.pos, target);
        // Map distance to fitness. Closer = Higher.
        // If completed, huge bonus. If crashed, penalty.

        // Base fitness: 1 / distance
        this.fitness = 1 / (d + 1); // +1 to avoid Infinity

        if (this.completed) {
            this.fitness *= 10;
        }
        if (this.crashed) {
            this.fitness /= 10;
        }

        // Enhance fitness with exponential function to separate top performers
        this.fitness = Math.pow(this.fitness, 4);
    }
}

class Obstacle {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }

    contains(v) {
        return (v.x > this.x && v.x < this.x + this.w && v.y > this.y && v.y < this.y + this.h);
    }
}

class Population {
    constructor(size, mutationRate, lifespan, width, height) {
        this.rockets = [];
        this.popSize = size;
        this.matingPool = [];
        this.generation = 1;
        this.mutationRate = mutationRate;
        this.lifespan = lifespan;
        this.width = width;
        this.height = height;
        this.count = 0; // Current frame in the lifespan
        this.running = false;

        this.target = new Vector(width / 2, 50);
        this.startPos = new Vector(width / 2, height - 20);

        this.obstacles = [];
        this.setupObstacles('simple');

        this.init();
    }

    setupObstacles(type) {
        this.obstacles = [];
        if (type === 'simple') {
            this.obstacles.push(new Obstacle(this.width / 2 - 100, this.height / 2, 200, 20));
        } else if (type === 'split') {
            this.obstacles.push(new Obstacle(this.width / 2 - 150, 400, 300, 20));
            this.obstacles.push(new Obstacle(this.width / 2 - 50, 200, 100, 20));
        } else if (type === 'maze') {
            this.obstacles.push(new Obstacle(0, 300, 500, 20));
            this.obstacles.push(new Obstacle(this.width - 500, 150, 500, 20));
        } else if (type === 'complex') {
            const cx = this.width / 2;
            const cy = this.height / 2;
            this.obstacles.push(new Obstacle(cx - 200, cy + 100, 400, 20));
            this.obstacles.push(new Obstacle(cx - 200, cy - 100, 20, 220));
            this.obstacles.push(new Obstacle(cx + 180, cy - 100, 20, 220));
            this.obstacles.push(new Obstacle(cx - 100, cy - 150, 200, 20));
        }
    }

    init() {
        this.rockets = [];
        for (let i = 0; i < this.popSize; i++) {
            const dna = DNA.createRandom(this.lifespan, 0.2); // 0.2 max force
            this.rockets.push(new Rocket(dna, this.startPos.x, this.startPos.y));
        }
        this.count = 0;
        this.running = true;
    }

    run() {
        if (!this.running) return;

        let allInactive = true;
        for (let rocket of this.rockets) {
            rocket.update(this.count, this.obstacles, this.target);
            if (!rocket.crashed && !rocket.completed) {
                allInactive = false;
            }
        }

        this.count++;

        if (this.count >= this.lifespan || allInactive) {
            this.evaluate();
            this.selection();
            this.count = 0;
            this.generation++;
        }
    }

    evaluate() {
        let maxFit = 0;
        let totalFit = 0;

        for (let rocket of this.rockets) {
            rocket.calcFitness(this.target);
            if (rocket.fitness > maxFit) maxFit = rocket.fitness;
            totalFit += rocket.fitness;
        }

        // Store stats for UI
        this.stats = {
            maxFit: maxFit,
            avgFit: totalFit / this.rockets.length
        };

        // Normalize fitness
        for (let rocket of this.rockets) {
            rocket.fitness /= maxFit;
        }

        this.matingPool = [];
        // Take rockets with higher fitness and put them in the pool more times
        // Improved: Rejection Sampling or simple weighted pool
        // Simple weighted pool for now (careful with memory for huge pools)
        // Let's use rejection sampling in selection() instead? No, standard array is easier for small scale.

        for (let rocket of this.rockets) {
            const n = Math.floor(rocket.fitness * 100);
            for (let i = 0; i < n; i++) {
                this.matingPool.push(rocket);
            }
        }

        return { maxFit, avgFit: totalFit / this.rockets.length }; // Not normalized avg
    }

    selection() {
        const newRockets = [];
        for (let i = 0; i < this.rockets.length; i++) {
            // Random parent 1
            const parentA = this.matingPool[Math.floor(Math.random() * this.matingPool.length)];
            // Random parent 2
            const parentB = this.matingPool[Math.floor(Math.random() * this.matingPool.length)];

            // Handle case where pool might be empty (all died horribly with 0 fitness)
            let childDNA;
            if (parentA && parentB) {
                childDNA = parentA.dna.crossover(parentB.dna);
                childDNA.mutation(this.mutationRate, 0.2);
            } else {
                // Restart random if fail
                childDNA = DNA.createRandom(this.lifespan, 0.2);
            }

            newRockets.push(new Rocket(childDNA, this.startPos.x, this.startPos.y));
        }
        this.rockets = newRockets;
    }
}
