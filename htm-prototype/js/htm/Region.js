/**
 * Represents an HTM Region (Layer).
 * Holds the array of Columns and manages the main cycle.
 */
class Region {
    /**
     * @param {number} width - Width in columns.
     * @param {number} height - Height in columns.
     * @param {Object} config - Configuration options.
     */
    constructor(width, height, config = {}) {
        this.width = width;
        this.height = height;
        this.columns = [];

        // Initialize Columns
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                this.columns.push(new Column(this, x, y, index));
            }
        }

        // Logic Components
        this.spatialPooler = new SpatialPooler(this);
        this.temporalPooler = new TemporalPooler(this);

        this.inputData = []; // Helper to hold current input
    }

    /**
     * Initialize connections to input space.
     * @param {number} inputSize 
     */
    initialize(inputSize) {
        // We need a persistent input array reference that synapses can look at.
        // We'll update the contents of this array, but the object reference stays same?
        // Or we pass the array every time. Synapses need a stable way to read "Bit 5".
        // The implementation in Column.js creates a closure/getter over 'this.inputData'.
        // So we must ensure this.inputData is populated.

        // Fill inputData with false initially
        this.inputData = new Array(inputSize).fill(false);

        for (const col of this.columns) {
            col.connectToInput(inputSize, this.inputData);
        }
    }

    /**
     * Run one cycle of the HTM region.
     * @param {Array<boolean>} input - Binary input vector.
     */
    compute(input) {
        // Update local input data so connected synapses see the new values
        for (let i = 0; i < input.length; i++) {
            this.inputData[i] = input[i];
        }

        // 1. Next Time Step (move state to previous)
        for (const col of this.columns) {
            col.nextTimeStep();
        }

        // 2. Spatial Pooling (Activate Columns)
        this.spatialPooler.performSpatialPooling();

        // 3. Temporal Pooling (Activate Cells, Learning, Prediction)
        this.temporalPooler.performTemporalPooling();
    }

    /**
     * Get indices of columns that are predicted to be active in the NEXT timestep.
     * A column is predicted if it has at least one predictive cell.
     */
    getPredictedColumnIndices() {
        const indices = [];
        for (const col of this.columns) {
            // Check if any cell is predictive
            let isPredicted = false;
            for (const cell of col.cells) {
                if (cell.isPredictive) {
                    isPredicted = true;
                    break;
                }
            }
            if (isPredicted) {
                indices.push(col.index);
            }
        }
        return indices;
    }
}

// Global Export
window.Region = Region;
