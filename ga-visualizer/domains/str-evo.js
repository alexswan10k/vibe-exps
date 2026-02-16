/**
 * Genetic Algorithm Visualizer
 * Domain: String Evolution
 */

class StringEvolutionManager {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.targetPhrase = " TO BE OR NOT TO BE";
        this.popSize = 200;
        this.mutationRate = 0.01;

        // This problem doesn't really have a "frame count" lifespan,
        // but we need to tick the GA loop.
        // We can just do selection every frame or every N frames?
        // Usually String GA is instant-generation.
        // To visualize it, we can just run one generation per key-frame or run it fast.

        this.agents = [];
        this.matingPool = [];
        this.generation = 1;

        this.bestPhrase = "";

        this.init();
    }

    setTargetPhrase(phrase) {
        this.targetPhrase = phrase.toUpperCase();
        this.init();
    }

    init() {
        this.agents = [];
        for (let i = 0; i < this.popSize; i++) {
            const genes = [];
            for (let j = 0; j < this.targetPhrase.length; j++) {
                genes.push(this.randomChar());
            }
            this.agents.push({ dna: new DNA(genes), fitness: 0, phrase: genes.join('') });
        }
    }

    randomChar() {
        const c = Math.floor(Math.random() * (122 - 63 + 1)) + 63;
        if (c === 63) return 32; // space
        if (c === 64) return 46; // .
        return Math.floor(Math.random() * 96) + 32; // All ASCII printable roughly
    }

    randomCharSimple() {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ .";
        return chars.charAt(Math.floor(Math.random() * chars.length));
    }

    update(count) {
        // String evolution doesn't have a physics step.
        // We just return true immediately to trigger next generation.
        // OR we can use this to throttle.
        return true;
    }

    evaluate() {
        let maxFit = 0;
        let totalFit = 0;

        this.bestPhrase = "";

        for (let agent of this.agents) {
            let score = 0;
            const genes = agent.dna.genes;
            agent.phrase = genes.join('');

            for (let i = 0; i < this.targetPhrase.length; i++) {
                if (genes[i] === this.targetPhrase[i]) {
                    score++;
                }
            }

            // Exponential fitness
            agent.fitness = Math.pow(2, score);

            if (agent.fitness > maxFit) {
                maxFit = agent.fitness;
                this.bestPhrase = agent.phrase;
            }
            totalFit += agent.fitness;
        }

        // Normalize
        for (let agent of this.agents) {
            agent.fitness /= maxFit;
        }

        // Mating Pool
        this.matingPool = [];
        for (let agent of this.agents) {
            const n = Math.floor(agent.fitness * 100);
            for (let i = 0; i < n; i++) {
                this.matingPool.push(agent);
            }
        }

        this.stats = { maxFit: maxFit, avgFit: totalFit / this.agents.length };
        return this.stats;
    }

    selection() {
        const newAgents = [];
        for (let i = 0; i < this.agents.length; i++) {
            let childDNA;
            if (this.matingPool.length > 0) {
                const parentA = this.matingPool[Math.floor(Math.random() * this.matingPool.length)];
                const parentB = this.matingPool[Math.floor(Math.random() * this.matingPool.length)];
                childDNA = parentA.dna.crossover(parentB.dna);

                childDNA.mutation(this.mutationRate, (gene) => {
                    return this.randomCharSimple();
                });
            } else {
                // Fallback
                const genes = [];
                for (let j = 0; j < this.targetPhrase.length; j++) genes.push(this.randomCharSimple());
                childDNA = new DNA(genes);
            }

            newAgents.push({ dna: childDNA, fitness: 0, phrase: "" });
        }
        this.agents = newAgents;
    }

    draw(renderer) {
        // Custom drawing for string evolution
        // Clear logic is handled by main renderer usually, but we draw text here.
        const ctx = renderer.ctx;
        const w = renderer.width;
        const h = renderer.height;

        ctx.fillStyle = "#e0e0ff";
        ctx.font = "24px 'JetBrains Mono'";
        ctx.textAlign = "center";

        ctx.fillText("Target: " + this.targetPhrase, w / 2, h / 2 - 50);

        ctx.fillStyle = "#00ff9d";
        ctx.font = "40px 'JetBrains Mono'";
        ctx.fillText(this.bestPhrase, w / 2, h / 2 + 20);

        // Draw some population samples
        ctx.fillStyle = "#8888aa";
        ctx.font = "12px 'JetBrains Mono'";
        for (let i = 0; i < Math.min(20, this.agents.length); i++) {
            ctx.fillText(this.agents[i].phrase, w / 2, h / 2 + 80 + i * 15);
        }
    }
}
