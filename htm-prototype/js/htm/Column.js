/**
 * Represents a Column of Cells in an HTM Region.
 * Modeled after NLA/Core/Components/Column.cs
 */
class Column {
    /**
     * @param {Region} region - Parent region.
     * @param {number} x - X coordinate.
     * @param {number} y - Y coordinate.
     * @param {number} index - Flat index in the region array.
     */
    constructor(region, x, y, index) {
        this.region = region;
        this.x = x;
        this.y = y;
        this.index = index;

        this.cells = [];
        const CELLS_PER_COLUMN = 4; // Standard default
        for (let i = 0; i < CELLS_PER_COLUMN; i++) {
            this.cells.push(new Cell(this, i));
        }

        // Spatial Pooling State
        this.overlap = 0;
        this.isActive = false;
        this.boost = 1.0;

        // Proximal Dendrite (Input connection)
        // In this simplified version, we treat the proximal dendrite as a list of synapses 
        // connected directly to the input space.
        this.proximalSynapses = [];
    }

    /**
     * Reset column state for next timestep.
     */
    nextTimeStep() {
        this.isActive = false;
        this.overlap = 0;
        for (const cell of this.cells) {
            cell.nextTimeStep();
        }
    }

    /**
     * Connects this column to a random set of input bits.
     * @param {number} inputSize - Total size of input vector.
     * @param {Object} inputValues - The actual input array object (or wrapper).
     * @param {number} potentialPct - Percentage of inputs to connect to.
     */
    connectToInput(inputSize, inputValues, potentialPct = 0.5) {
        this.proximalSynapses = [];
        for (let i = 0; i < inputSize; i++) {
            if (Math.random() < potentialPct) {
                // Initialize with random permanence
                // Some connected (>0.2), some not (<0.2)
                const perm = Math.random() < 0.2 ? 0.3 : 0.1; // Bias towards disconnected? Or random.

                // We create a wrapper object for the input bit if it's not an object
                // But for efficiency, let's assume inputValues[i] is accessible.
                // We need a way to reference the "i-th input bit".
                // Let's create a lightweight proxy object for the synapse source.
                const inputSource = {
                    get isActive() { return inputValues[i]; },
                    get wasActive() { return false; } // Input usually doesn't have history in this simple model
                };

                // Note: Proximal synapses don't belong to a segment in the same way distal ones do in this simplified view,
                // or we can treat the Column itself as having one "SharedProximalDendrite".
                // Let's reuse Synapse class but pass null as segment for now or a dummy.
                this.proximalSynapses.push(new Synapse(inputSource, null, perm));
            }
        }
    }
}

// Global Export
window.Column = Column;
