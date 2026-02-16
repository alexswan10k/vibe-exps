/**
 * Particle Swarm Optimization Visualizer
 * Core PSO Logic
 */

class Vector {
    constructor(x, y, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    add(v) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
    }

    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        this.z -= v.z;
        return this;
    }

    mult(n) {
        this.x *= n;
        this.y *= n;
        this.z *= n;
        return this;
    }

    div(n) {
        if (n !== 0) {
            this.x /= n;
            this.y /= n;
            this.z /= n;
        }
        return this;
    }

    limit(max) {
        const magSq = this.magSq();
        if (magSq > max * max) {
            this.normalize();
            this.mult(max);
        }
        return this;
    }

    magSq() {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }

    mag() {
        return Math.sqrt(this.magSq());
    }

    normalize() {
        const m = this.mag();
        if (m !== 0) {
            this.div(m);
        }
        return this;
    }

    copy() {
        return new Vector(this.x, this.y, this.z);
    }

    static dist(v1, v2) {
        const dx = v1.x - v2.x;
        const dy = v1.y - v2.y;
        const dz = v1.z - v2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    static sub(v1, v2) {
        return new Vector(v1.x - v2.x, v1.y - v2.y, v1.z - v2.z);
    }

    static random2D() {
        const angle = Math.random() * Math.PI * 2;
        return new Vector(Math.cos(angle), Math.sin(angle), 0);
    }
}

const Scenarios = {
    // x, y are normalized -1 to 1 for calculation, mapped to canvas width/height

    sphere: (x, y) => {
        // Simple bowl
        return x * x + y * y;
    },

    rastrigin: (x, y) => {
        // Waves
        const A = 10;
        return 2 * A + (x * x - A * Math.cos(2 * Math.PI * x)) + (y * y - A * Math.cos(2 * Math.PI * y));
    },

    ackley: (x, y) => {
        // Complex peak
        const p1 = -20 * Math.exp(-0.2 * Math.sqrt(0.5 * (x * x + y * y)));
        const p2 = -Math.exp(0.5 * (Math.cos(2 * Math.PI * x) + Math.cos(2 * Math.PI * y)));
        return p1 + p2 + Math.E + 20;
    },

    target: (x, y, tx, ty) => {
        // Original moving target logic
        // Only return distance for consistency
        const dx = x - tx;
        const dy = y - ty;
        return Math.sqrt(dx * dx + dy * dy);
    }
};

class Particle {
    constructor(x, y) {
        this.position = new Vector(x, y, 0);
        this.velocity = Vector.random2D().mult(Math.random() * 2 + 1);
        this.acceleration = new Vector(0, 0);

        this.bestPosition = this.position.copy();
        this.bestFitness = Infinity; // Minimize

        this.history = [];
        this.color = `hsl(${Math.random() * 60 + 180}, 100%, 50%)`;
    }

    update(inertia, cognitive, social, globalBestPos) {
        // v(t+1) = w * v(t) + c1 * r1 * (pbest - x(t)) + c2 * r2 * (gbest - x(t))
        // Note: Velocity updates happen in 2D (x,y) plane for optimization. 
        // Z is just the result/fitness.

        this.velocity.mult(inertia);

        let cognitiveForce = Vector.sub(this.bestPosition, this.position);
        cognitiveForce.mult(cognitive * Math.random());

        let socialForce = Vector.sub(globalBestPos, this.position);
        socialForce.mult(social * Math.random());

        this.velocity.add(cognitiveForce);
        this.velocity.add(socialForce);
        this.velocity.limit(10);

        this.position.add(this.velocity);
        this.acceleration.mult(0);

        this.history.push(this.position.copy());
        if (this.history.length > 20) {
            this.history.shift();
        }
    }

    evaluate(scenario, width, height, targetPos) {
        let val;

        // Normalize position to domain space (e.g. -5.12 to 5.12 for Rastrigin)
        // Let's assume standardized domain -2 to 2 for visualization simplicity
        // Map 0..width to -2..2
        const nx = (this.position.x / width) * 4 - 2;
        const ny = (this.position.y / height) * 4 - 2;

        if (scenario === 'target') {
            // Use raw pixels for target mode
            val = Scenarios.target(this.position.x, this.position.y, targetPos.x, targetPos.y);
        } else if (Scenarios[scenario]) {
            val = Scenarios[scenario](nx, ny);
        } else {
            val = 0;
        }

        this.position.z = val; // Store for visualization height

        if (val < this.bestFitness) {
            this.bestFitness = val;
            this.bestPosition = this.position.copy();
        }

        return val;
    }

    checkEdges(width, height) {
        if (this.position.x > width) {
            this.position.x = width;
            this.velocity.x *= -1;
        } else if (this.position.x < 0) {
            this.position.x = 0;
            this.velocity.x *= -1;
        }

        if (this.position.y > height) {
            this.position.y = height;
            this.velocity.y *= -1;
        } else if (this.position.y < 0) {
            this.position.y = 0;
            this.velocity.y *= -1;
        }
    }
}

class Swarm {
    constructor(size, width, height) {
        this.particles = [];
        this.width = width;
        this.height = height;
        this.globalBestPos = new Vector(width / 2, height / 2);
        this.globalBestFitness = Infinity;

        this.target = new Vector(width - 50, 50);
        this.currentScenario = 'target';

        for (let i = 0; i < size; i++) {
            this.particles.push(new Particle(Math.random() * width, Math.random() * height));
        }
    }

    setScenario(name) {
        this.currentScenario = name;
        this.globalBestFitness = Infinity;
        for (let p of this.particles) {
            p.bestFitness = Infinity;
        }
    }

    run(inertia, cognitive, social) {
        let currentBestFitness = Infinity; // Local to this frame if needed, but we track global

        for (let p of this.particles) {
            const fitness = p.evaluate(this.currentScenario, this.width, this.height, this.target);

            if (fitness < this.globalBestFitness) {
                this.globalBestFitness = fitness;
                this.globalBestPos = p.position.copy();
            }

            p.update(inertia, cognitive, social, this.globalBestPos);
            p.checkEdges(this.width, this.height);
        }
    }

    setTarget(x, y) {
        this.target = new Vector(x, y);
        if (this.currentScenario === 'target') {
            this.globalBestFitness = Infinity;
            for (let p of this.particles) p.bestFitness = Infinity;
        }
    }
}
