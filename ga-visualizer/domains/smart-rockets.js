/**
 * Genetic Algorithm Visualizer
 * Domain: Smart Rockets
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
    }

    applyForce(force) {
        this.acc.add(force);
    }

    update(count, obstacles, target) {
        if (this.completed || this.crashed) return;

        const d = Vector.dist(this.pos, target);
        if (d < 16) { // Hit target (radius roughly)
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
            // Guard against running out of genes if lifespan changes mid-sim
            if (count < this.dna.genes.length) {
                this.applyForce(this.dna.genes[count]);
            }
            this.vel.add(this.acc);
            this.pos.add(this.vel);
            this.acc.mult(0); // Reset acc
            this.vel.limit(4); // Max speed
        }
    }

    calcFitness(target) {
        const d = Vector.dist(this.pos, target);
        this.fitness = 1 / (d + 1);

        if (this.completed) this.fitness *= 10;
        if (this.crashed) this.fitness /= 10;

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

class SmartRocketsManager {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.lifespan = 400;
        this.popSize = 100;
        this.mutationRate = 0.01;

        this.target = new Vector(width / 2, 50);
        this.startPos = new Vector(width / 2, height - 20);

        this.obstacles = [];
        this.rockets = [];
        this.matingPool = [];

        this.loadPreset('simple');
        this.init();
    }

    loadPreset(type) {
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
            const genes = [];
            for (let j = 0; j < this.lifespan; j++) {
                const vec = Vector.random2D();
                vec.mult(Math.random() * 0.2); // maxForce
                genes.push(vec);
            }
            this.rockets.push(new Rocket(new DNA(genes), this.startPos.x, this.startPos.y));
        }
    }

    update(count) {
        let allInactive = true;
        for (let rocket of this.rockets) {
            rocket.update(count, this.obstacles, this.target);
            if (!rocket.crashed && !rocket.completed) {
                allInactive = false;
            }
        }
        return allInactive;
    }

    evaluate() {
        let maxFit = 0;
        let totalFit = 0;

        for (let rocket of this.rockets) {
            rocket.calcFitness(this.target);
            if (rocket.fitness > maxFit) maxFit = rocket.fitness;
            totalFit += rocket.fitness;
        }

        for (let rocket of this.rockets) {
            rocket.fitness /= maxFit;
        }

        this.matingPool = [];
        for (let rocket of this.rockets) {
            const n = Math.floor(rocket.fitness * 100);
            for (let i = 0; i < n; i++) {
                this.matingPool.push(rocket);
            }
        }

        this.stats = { maxFit, avgFit: totalFit / this.rockets.length };
        return this.stats;
    }

    selection() {
        const newRockets = [];
        for (let i = 0; i < this.rockets.length; i++) {
            // Safety: if pool is empty (all 0 fitness), random
            let childDNA;
            if (this.matingPool.length > 0) {
                const parentA = this.matingPool[Math.floor(Math.random() * this.matingPool.length)];
                const parentB = this.matingPool[Math.floor(Math.random() * this.matingPool.length)];
                childDNA = parentA.dna.crossover(parentB.dna);

                // Mutation Function for Vectors
                childDNA.mutation(this.mutationRate, (gene) => {
                    const newGene = Vector.random2D();
                    newGene.mult(Math.random() * 0.2);
                    return newGene;
                });
            } else {
                const genes = [];
                for (let j = 0; j < this.lifespan; j++) {
                    const vec = Vector.random2D();
                    vec.mult(Math.random() * 0.2);
                    genes.push(vec);
                }
                childDNA = new DNA(genes);
            }

            newRockets.push(new Rocket(childDNA, this.startPos.x, this.startPos.y));
        }
        this.rockets = newRockets;
    }

    draw(renderer) {
        renderer.drawObstacles(this.obstacles);
        renderer.drawTarget(this.target);
        renderer.drawPopulation({ rockets: this.rockets });
    }
}
