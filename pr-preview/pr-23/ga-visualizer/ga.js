/**
 * Genetic Algorithm Visualizer
 * Core GA Logic & Helpers
 */

class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    add(v) {
        this.x += v.x;
        this.y += v.y;
        return this; // Chaining
    }

    mult(n) {
        this.x *= n;
        this.y *= n;
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
        return this.x * this.x + this.y * this.y;
    }

    mag() {
        return Math.sqrt(this.magSq());
    }

    normalize() {
        const m = this.mag();
        if (m !== 0) {
            this.mult(1 / m);
        }
        return this;
    }

    copy() {
        return new Vector(this.x, this.y);
    }

    static dist(v1, v2) {
        const dx = v1.x - v2.x;
        const dy = v1.y - v2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    static random2D() {
        const angle = Math.random() * Math.PI * 2;
        return new Vector(Math.cos(angle), Math.sin(angle));
    }
}

class DNA {
    constructor(genes) {
        this.genes = genes;
    }

    crossover(partner) {
        const newGenes = [];
        // Random midpoint crossover
        const mid = Math.floor(Math.random() * this.genes.length);

        for (let i = 0; i < this.genes.length; i++) {
            if (i > mid) {
                newGenes[i] = this.deepCopy(this.genes[i]);
            } else {
                newGenes[i] = this.deepCopy(partner.genes[i]);
            }
        }
        return new DNA(newGenes);
    }

    mutation(rate, mutateFn) {
        if (!mutateFn) return;
        for (let i = 0; i < this.genes.length; i++) {
            if (Math.random() < rate) {
                this.genes[i] = mutateFn(this.genes[i]);
            }
        }
    }

    deepCopy(gene) {
        // Helper to clone genes if they are objects (like Vectors)
        if (gene instanceof Vector) {
            return gene.copy();
        }
        return gene; // Primitives (numbers, chars) are passed by value
    }
}
