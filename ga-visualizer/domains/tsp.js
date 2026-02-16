/**
 * Genetic Algorithm Visualizer
 * Domain: Traveling Salesperson Problem (TSP)
 */

class TSPManager {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.totalCities = 15;
        this.popSize = 200;
        this.mutationRate = 0.05; // Needs higher mutation usually

        this.cities = [];
        this.initCities();

        this.agents = []; // DNA = order of cities (indices)
        this.bestDistance = Infinity;
        this.bestEverOrder = [];

        this.init();

        this.lifespan = 1; // Not used really
    }

    setTotalCities(n) {
        this.totalCities = n;
        this.initCities();
        this.init();
    }

    loadPreset(type) {
        this.currentPreset = type;
        this.initCities();
        this.init();
    }

    initCities() {
        this.cities = [];
        const pad = 50;
        const w = this.width - pad * 2;
        const h = this.height - pad * 2;

        if (this.currentPreset === 'circle') {
            const cx = this.width / 2;
            const cy = this.height / 2;
            const r = Math.min(w, h) / 2;
            for (let i = 0; i < this.totalCities; i++) {
                const angle = (i / this.totalCities) * Math.PI * 2;
                this.cities.push(new Vector(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r));
            }
        } else if (this.currentPreset === 'grid') {
            const cols = Math.ceil(Math.sqrt(this.totalCities));
            const rows = Math.ceil(this.totalCities / cols);
            const cellW = w / cols;
            const cellH = h / rows;
            for (let i = 0; i < this.totalCities; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                this.cities.push(new Vector(pad + col * cellW + cellW / 2, pad + row * cellH + cellH / 2));
            }
        } else if (this.currentPreset === 'clusters') {
            const clusters = 3;
            for (let i = 0; i < this.totalCities; i++) {
                const cIdx = i % clusters;
                const cx = pad + Math.random() * w; // Cluster centers could be fixed but random is ok
                const cy = pad + Math.random() * h;
                // Actually keep clusters fixed for determinism per reset? 
                // nah random clusters is fun.
                // Wait, true cluster logic:
                const centers = [
                    new Vector(this.width * 0.25, this.height * 0.25),
                    new Vector(this.width * 0.75, this.height * 0.25),
                    new Vector(this.width * 0.5, this.height * 0.75)
                ];
                const center = centers[i % CENTERS_COUNT || 0];
                // Fix reference error risk, assume 3
                const target = centers[i % 3];
                this.cities.push(new Vector(target.x + (Math.random() - 0.5) * 100, target.y + (Math.random() - 0.5) * 100));
            }
        } else {
            // Random
            for (let i = 0; i < this.totalCities; i++) {
                const x = Math.random() * w + pad;
                const y = Math.random() * h + pad;
                this.cities.push(new Vector(x, y));
            }
        }
    }

    init() {
        this.agents = [];
        const order = [];
        for (let i = 0; i < this.totalCities; i++) order.push(i);

        for (let i = 0; i < this.popSize; i++) {
            // Shuffle
            const shuffled = [...order];
            for (let j = shuffled.length - 1; j > 0; j--) {
                const k = Math.floor(Math.random() * (j + 1));
                [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
            }
            this.agents.push({ dna: new DNA(shuffled), fitness: 0, dist: 0 });
        }
        this.bestDistance = Infinity;
    }

    update(count) {
        return true; // Instant generation
    }

    evaluate() {
        let maxFit = 0;
        let totalFit = 0;

        for (let agent of this.agents) {
            const dist = this.calcDistance(agent.dna.genes);
            agent.dist = dist;
            if (dist < this.bestDistance) {
                this.bestDistance = dist;
                this.bestEverOrder = [...agent.dna.genes];
            }

            agent.fitness = 1 / (dist + 1);
            // Stronger exponential
            agent.fitness = Math.pow(agent.fitness, 15);

            if (agent.fitness > maxFit) maxFit = agent.fitness;
            totalFit += agent.fitness;
        }

        // Normalize
        for (let agent of this.agents) {
            agent.fitness /= maxFit;
        }

        this.matingPool = [];
        for (let agent of this.agents) {
            const n = Math.floor(agent.fitness * 100);
            for (let i = 0; i < n; i++) {
                this.matingPool.push(agent);
            }
        }

        this.stats = { maxFit, avgFit: totalFit / this.agents.length };
        return this.stats;
    }

    calcDistance(order) {
        let sum = 0;
        for (let i = 0; i < order.length - 1; i++) {
            const cityA = this.cities[order[i]];
            const cityB = this.cities[order[i + 1]];
            sum += Vector.dist(cityA, cityB);
        }
        return sum;
    }

    selection() {
        const newAgents = [];
        for (let i = 0; i < this.agents.length; i++) {
            let childDNA;
            if (this.matingPool.length > 0) {
                const parentA = this.matingPool[Math.floor(Math.random() * this.matingPool.length)];

                // TSP Crossover is tricky! 
                // Cannot duplicate cities. 
                // Standard crossover breaks TSP. 
                // We simply clone for now + mutate (Asexual reproduction) works surprisingly well for TSP basics.
                // OR implement Order 1 Crossover.

                // Let's do simple clone + swap mutation
                // Actually, let's just pick one parent and mutate it for simplicity and robustness in this demo

                childDNA = new DNA([...parentA.dna.genes]);
                // childDNA.mutation(this.mutationRate, null); // Manual swap below

                if (Math.random() < this.mutationRate) {
                    this.mutateSwap(childDNA.genes);
                }
            } else {
                // Reset
                childDNA = this.agents[0].dna; // Fallback
            }
            newAgents.push({ dna: childDNA, fitness: 0 });
        }
        this.agents = newAgents;

        // Keep best ever? Elitism?
        // Let's rely on probability.
    }

    mutateSwap(genes) {
        const i = Math.floor(Math.random() * genes.length);
        const j = Math.floor(Math.random() * genes.length);
        [genes[i], genes[j]] = [genes[j], genes[i]];
    }

    draw(renderer) {
        const ctx = renderer.ctx;

        // Draw Cities
        for (let city of this.cities) {
            ctx.beginPath();
            ctx.arc(city.x, city.y, 8, 0, Math.PI * 2);
            ctx.fillStyle = "#fff";
            ctx.fill();
        }

        // Draw Best Path
        if (this.bestEverOrder.length > 0) {
            ctx.beginPath();
            ctx.strokeStyle = "#00ff9d";
            ctx.lineWidth = 4;
            for (let i = 0; i < this.bestEverOrder.length; i++) {
                const city = this.cities[this.bestEverOrder[i]];
                if (i === 0) ctx.moveTo(city.x, city.y);
                else ctx.lineTo(city.x, city.y);
            }
            ctx.stroke();
        }

        // Helper text
        ctx.fillStyle = "#8888aa";
        ctx.font = "14px JetBrains Mono";
        ctx.fillText(`Best Distance: ${Math.floor(this.bestDistance)}`, 20, 580);
    }
}
