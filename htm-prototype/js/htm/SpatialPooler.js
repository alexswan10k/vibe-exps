/**
 * Handles Spatial Pooling: Selecting active columns based on input overlap.
 * Modeled after NLA/Core/Components/SpatialPooler.cs
 */
class SpatialPooler {
    /**
     * @param {Region} region 
     */
    constructor(region) {
        this.region = region;
        this.MIN_OVERLAP = 2;       // Minimum active inputs to consider a column
        this.DESIRED_LOCAL_ACTIVITY = 10; // Number of winners per neighborhood (or global for simple)

        // Boosting Parameters
        this.activeDutyCycles = new Map(); // col.index -> float
        this.minDutyCycles = new Map();    // col.index -> float
        this.DUTY_CYCLE_PERIOD = 100;      // Moving average period
        this.BOOST_STRENGTH = 2.0;         // Max boost factor (approx)

        // Init duty cycles
        for (const col of region.columns) {
            this.activeDutyCycles.set(col.index, 0);
            this.minDutyCycles.set(col.index, 0);
        }
    }

    performSpatialPooling() {
        const columns = this.region.columns;

        // 0. Update Duty Cycles & Calculate Boost
        // Simplified: Global competition, so we compare to global average
        // In full HTM it's local neighborhood.
        let totalActiveDuty = 0;
        for (const col of columns) {
            totalActiveDuty += this.activeDutyCycles.get(col.index);
        }
        const avgActiveDuty = totalActiveDuty / columns.length;

        for (const col of columns) {
            // Update rolling average
            const currentActive = col.isActive ? 1.0 : 0.0;
            const prevDuty = this.activeDutyCycles.get(col.index);
            const newDuty = ((prevDuty * (this.DUTY_CYCLE_PERIOD - 1)) + currentActive) / this.DUTY_CYCLE_PERIOD;
            this.activeDutyCycles.set(col.index, newDuty);

            // Update Boost
            // If duty cycle is low compared to neighbors (global avg here), boost it
            // Simple linear boost function: boost = e ^ (target - actual) ? 
            // Or NLA style: if duty < minDuty, boost. 
            // Let's use simple inverse ratio
            const minDuty = 0.01 * this.DESIRED_LOCAL_ACTIVITY / columns.length; // Approximate floor

            if (newDuty < minDuty) {
                col.boost = 1.0 + (minDuty - newDuty) / minDuty * this.BOOST_STRENGTH;
            } else {
                col.boost = 1.0;
            }
        }

        // 1. Calculate Overlap
        for (const col of columns) {
            let overlap = 0;
            // Iterate proximal synapses
            for (const syn of col.proximalSynapses) {
                if (syn.isConnected && syn.isActive) {
                    overlap++;
                }
            }
            if (overlap < this.MIN_OVERLAP) {
                overlap = 0;
            } else {
                overlap = overlap * col.boost;
            }
            col.overlap = overlap;
        }

        // 2. Inhibition (Global for simplicity in prototype)
        // Select top K columns with highest overlap
        // In a real implementation, this is local. Here we do global k-winners.

        // Sort indices by overlap
        // We map to objects {col, overlap} to sort
        const candidates = columns.map(c => ({ col: c, overlap: c.overlap }));
        candidates.sort((a, b) => b.overlap - a.overlap);

        const numWinners = Math.min(this.DESIRED_LOCAL_ACTIVITY, columns.length);

        for (let i = 0; i < candidates.length; i++) {
            if (i < numWinners && candidates[i].overlap > 0) {
                candidates[i].col.isActive = true;
            } else {
                candidates[i].col.isActive = false;
            }
        }

        // 3. Learning (Update Synapses) & Boosting (Update Boost)
        // (Simplified: Always learn on active columns)
        for (const col of columns) {
            if (col.isActive) {
                for (const syn of col.proximalSynapses) {
                    if (syn.isActive) {
                        syn.incrementPermanence();
                    } else {
                        syn.decrementPermanence();
                    }
                }
            }
            // Note: Boosting logic omitted for simplicity of prototype, assume boost is stable.
        }
    }
}

// Global Export
window.SpatialPooler = SpatialPooler;
