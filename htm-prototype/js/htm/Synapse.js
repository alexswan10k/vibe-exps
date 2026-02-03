/**
 * Represents a connection between a DistalDendrite (Segment) and a source Cell (or input bit).
 * Modeled after NLA/Core/Components/Synapse.cs
 */
class Synapse {
    /**
     * @param {Object} inputSource - The object this synapse is connected to (e.g. a Cell or an input object with an 'isActive' property).
     * @param {Segment} segment - The parent segment.
     * @param {number} permanence - Initial permanence value (0.0 to 1.0).
     */
    constructor(inputSource, segment, permanence = 0.2) {
        this.inputSource = inputSource;
        this.segment = segment;
        this.permanence = permanence;
        
        // Constants used for learning
        this.PERMANENCE_THRESHOLD = 0.2;
        this.PERMANENCE_INCREMENT = 0.05;
        this.PERMANENCE_DECREMENT = 0.05;
    }

    /**
     * returns true if the synapse is connected (permanence >= threshold)
     */
    get isConnected() {
        return this.permanence >= this.PERMANENCE_THRESHOLD;
    }

    /**
     * returns true if the source input is active in the current timestep.
     * Handles both Cell objects (which have an 'isActive' property) and raw input arrays.
     */
    get isActive() {
        // If inputSource is a Cell
        if (this.inputSource && typeof this.inputSource.isActive === 'boolean') {
            return this.inputSource.isActive;
        }
        // If inputSource is just a simple object wrapper for an input bit
        if (this.inputSource && this.inputSource.isActive) {
            return true;
        }
        return false;
    }

    /**
     * returns true if the source input was active in the PREVIOUS timestep.
     */
    get wasActive() {
        if (this.inputSource && typeof this.inputSource.wasActive === 'boolean') {
            return this.inputSource.wasActive;
        }
         // For simple input bits, we might assume they are "current" only, 
         // but for temporal memory we need history. 
         // For now, simpler inputs might not support temporal pooling directly.
        if (this.inputSource && this.inputSource.wasActive) {
            return true;
        }
        return false;
    }


    /**
     * Increases permanence.
     */
    incrementPermanence() {
        this.permanence = Math.min(1.0, this.permanence + this.PERMANENCE_INCREMENT);
    }

    /**
     * Decreases permanence.
     */
    decrementPermanence() {
        this.permanence = Math.max(0.0, this.permanence - this.PERMANENCE_DECREMENT);
    }
}

// Global export
window.Synapse = Synapse;
