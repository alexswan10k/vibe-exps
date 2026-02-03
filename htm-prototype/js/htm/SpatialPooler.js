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
    }

    performSpatialPooling() {
        const columns = this.region.columns;

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
