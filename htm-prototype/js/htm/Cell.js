/**
 * Represents a Neuron (Cell) in an HTM Column.
 * Modeled after NLA/Core/Components/Neuron.cs
 */
class Cell {
    /**
     * @param {Column} column - The parent column.
     * @param {number} index - Index within the column.
     */
    constructor(column, index) {
        this.column = column;
        this.index = index;

        this.segments = [];

        // State
        this.isActive = false;
        this.wasActive = false;

        this.isPredictive = false;
        this.wasPredictive = false;

        this.isLearning = false;
        this.wasLearning = false;
    }

    /**
     * Prepare for the next timestep. 
     * Moves current state to previous state and resets current state.
     */
    nextTimeStep() {
        this.wasActive = this.isActive;
        this.wasPredictive = this.isPredictive;
        this.wasLearning = this.isLearning;

        this.isActive = false;
        this.isPredictive = false;
        this.isLearning = false;
    }

    /**
     * Create a new segment on this cell.
     */
    createSegment() {
        const segment = new Segment(this);
        this.segments.push(segment);
        return segment;
    }

    /**
     * Returns the segment that was most active in the previous timestep.
     * Useful for learning which segment caused a prediction (or should have).
     */
    getBestMatchingSegment(isPrevious = true) {
        let bestSegment = null;
        let maxCount = -1;

        for (const segment of this.segments) {
            const count = isPrevious ? segment.getPotentialPrevActiveSynapseCount() : segment.getActiveSynapseCount(); // Note: implementation details might vary on 'potential' vs 'connected'

            if (count > maxCount) {
                maxCount = count;
                bestSegment = segment;
            }
        }

        // Only return if it meets a minimum threshold to be considered "matching"
        if (maxCount < (bestSegment ? bestSegment.LEARNING_THRESHOLD : 1)) {
            return null;
        }

        return bestSegment;
    }
}

// Global Export
window.Cell = Cell;
