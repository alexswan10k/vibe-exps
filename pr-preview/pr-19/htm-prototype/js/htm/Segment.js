/**
 * Represents a Distal Dendrite (Segment) of a Cell.
 * Modeled after NLA/Core/Components/DistalDendrite.cs
 */
class Segment {
    /**
     * @param {Cell} cell - The parent cell.
     */
    constructor(cell) {
        this.cell = cell;
        this.synapses = [];

        // Constants
        this.ACTIVATION_THRESHOLD = 5; // Minimum active synapses to be considered active
        this.LEARNING_THRESHOLD = 3;   // Lower threshold for learning (matching).
    }

    /**
     * Adds a synapse to this segment.
     * @param {Object} inputSource 
     * @param {number} permanence 
     */
    addSynapse(inputSource, permanence) {
        const synapse = new Synapse(inputSource, this, permanence);
        this.synapses.push(synapse);
        return synapse;
    }

    /**
     * Calculate number of active connected synapses (for current timestep activation).
     */
    getActiveSynapseCount() {
        let count = 0;
        for (const synapse of this.synapses) {
            if (synapse.isConnected && synapse.isActive) {
                count++;
            }
        }
        return count;
    }

    /**
     * Calculate number of active connected synapses from PREVIOUS timestep (for prediction).
     */
    getPrevActiveSynapseCount() {
        let count = 0;
        for (const synapse of this.synapses) {
            // Important: Temporal Memory looks at *previous* state of presynaptic cells
            if (synapse.isConnected && synapse.wasActive) {
                count++;
            }
        }
        return count;
    }

    /**
     * Calculate number of potential synapses (active but maybe not connected) from PREVIOUS timestep.
     * Used for determining the "best matching" segment for learning.
     */
    getPotentialPrevActiveSynapseCount() {
        let count = 0;
        for (const synapse of this.synapses) {
            if (synapse.wasActive) { // Ignore permanence threshold
                count++;
            }
        }
        return count;
    }

    /**
     * Is this segment active based on *current* input? 
     * (Usually used in spatial contexts, but Distal Dendrites are mostly for temporal)
     */
    get isActive() {
        return this.getActiveSynapseCount() >= this.ACTIVATION_THRESHOLD;
    }

    /**
     * Was this segment active based on *previous* input?
     * This indicates a predictive state for the cell.
     */
    get isActiveFromPrev() {
        return this.getPrevActiveSynapseCount() >= this.ACTIVATION_THRESHOLD;
    }

    /**
     * Adapts synapses: Increase permanence for active ones, decrease for inactive.
     * @param {boolean} positiveReinforcement - If true, learn. If false, unlearn (weakly).
     */
    adapt(positiveReinforcement = true) {
        for (const synapse of this.synapses) {
            if (synapse.wasActive) {
                synapse.incrementPermanence();
            } else {
                synapse.decrementPermanence();
            }
        }
    }
}

// Global Export
window.Segment = Segment;
