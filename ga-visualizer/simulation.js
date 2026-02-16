/**
 * Genetic Algorithm Visualizer
 * Simulation Router
 */

// This class now acts as a wrapper for the specific domain managers
class Simulation {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.generation = 1;
        this.count = 0;
        this.activeManager = null;

        this.setDomain('smart-rockets');
    }

    setDomain(type) {
        this.count = 0;
        this.generation = 1;

        if (type === 'smart-rockets') {
            this.activeManager = new SmartRocketsManager(this.width, this.height);
        } else if (type === 'string-evolution') {
            this.activeManager = new StringEvolutionManager(this.width, this.height);
        } else if (type === 'tsp') {
            this.activeManager = new TSPManager(this.width, this.height);
        }

        // Expose params to UI if needed
        return this.activeManager;
    }

    restart() {
        if (this.activeManager && this.activeManager.init) {
            this.activeManager.init();
        }
        this.count = 0;
        this.generation = 1;
    }

    run() {
        if (!this.activeManager) return;

        const done = this.activeManager.update(this.count);
        this.count++;

        // Specific domains define their own "done" condition (lifespan end, or simple one-tick)
        // If done, or generic lifespan
        const lifespan = this.activeManager.lifespan || 1; // Default to 1 for instant sims

        if (done || this.count >= lifespan) {
            this.activeManager.evaluate();
            this.activeManager.selection();
            this.count = 0;
            this.generation++;
            // Sync generation back to manager if it tracks it independently
            if (this.activeManager.generation) this.activeManager.generation = this.generation;
        }
    }

    get stats() {
        // Return latest stats from evaluate
        // Ideally evaluate returns it, or we store it. 
        // We'll rely on the manager having run evaluate at least once.
        // For visualizer smoothness, we probably want to cache the last stats.
        // Let's grab them from the manager if exposed.

        // Hack: wrapper access
        return this.activeManager.stats || {};
    }

    // Proxy property access for internal manager if needed, or UI can access simulation.activeManager
}
