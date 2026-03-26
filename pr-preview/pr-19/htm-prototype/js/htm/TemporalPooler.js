/**
 * Handles Temporal Pooling: Sequence memory, activate cells, learning, prediction.
 * Modeled after NLA/Core/Components/TemporalPooler.cs
 */
class TemporalPooler {
    /**
     * @param {Region} region 
     */
    constructor(region) {
        this.region = region;
    }

    performTemporalPooling() {
        const columns = this.region.columns;

        // Phase 1: Activate Cells (based on Column activation + Predictive State)
        for (const col of columns) {
            if (col.isActive) {
                let buPredicted = false; // Was this column predicted?
                let learningCellChosen = false;

                // Check if any cell in this column was predictive in previous step
                for (const cell of col.cells) {
                    if (cell.wasPredictive) {
                        const matchingSeg = cell.getBestMatchingSegment(true); // check prev time
                        if (matchingSeg && matchingSeg.isActiveFromPrev) {
                            buPredicted = true;
                            cell.isActive = true;

                            // If we have a matching segment, we reinforce it
                            // "Learning" state usually implies we will add/update segments
                            // Here we just mark it for update
                            if (matchingSeg.isActiveFromPrev) { // redundant check?
                                learningCellChosen = true;
                                cell.isLearning = true;
                                matchingSeg.adapt(true); // Reinforce
                            }
                        }
                    }
                }

                // If no cell was predictive, "Burst" the column (all cells active)
                if (!buPredicted) {
                    for (const cell of col.cells) {
                        cell.isActive = true;
                    }
                }

                // If we didn't pick a learning cell yet (e.g. burst), pick the best matching one
                // ie. the one that *closest* matched previous input, to start learning this transition.
                if (!learningCellChosen) {
                    let bestCell = null;
                    let bestSeg = null;

                    // Find cell with best matching segment
                    // NLA logic: _GetBestMatchingNeuron
                    let maxPotential = -1;

                    for (const cell of col.cells) {
                        const seg = cell.getBestMatchingSegment(true);
                        const potential = seg ? seg.getPotentialPrevActiveSynapseCount() : 0;

                        if (potential > maxPotential) {
                            maxPotential = potential;
                            bestCell = cell;
                            bestSeg = seg;
                        }
                    }

                    // If no segments at all, pick 'least used' cell or random? 
                    // NLA: "orderby q.Dendrites.Count ascending"
                    if (!bestCell) {
                        // Pick cell with fewest segments
                        let minSegs = 99999;
                        for (const cell of col.cells) {
                            if (cell.segments.length < minSegs) {
                                minSegs = cell.segments.length;
                                bestCell = cell;
                            }
                        }
                    }

                    if (bestCell) {
                        bestCell.isLearning = true;
                        // Create a new segment if we didn't find a good match
                        // NLA logic: if (supdate == null) ...
                        if (!bestSeg) {
                            bestSeg = bestCell.createSegment();
                        }
                        // Add synapses to this segment from *previous* active cells
                        this._learnOnSegment(bestSeg);
                    }
                }
            }
        }

        // Phase 2: Calculate Predictive State for NEXT step
        for (const col of columns) {
            for (const cell of col.cells) {
                // Check all segments to see if they are active given CURRENT active cells
                for (const seg of cell.segments) {
                    if (seg.isActive) { // based on *current* active cells
                        cell.isPredictive = true;
                        break;
                    }
                }
            }
        }

        // Phase 3: Punish Incorrect Predictions
        // If a segment was active FROM PREV (predicted this timestep), but the cell did NOT become active,
        // then the prediction was wrong. We should slightly weaken those synapses.
        for (const col of columns) {
            if (!col.isActive) {
                // If column is not active, any cell that predicted it should be punished
                for (const cell of col.cells) {
                    if (cell.wasPredictive) {
                        // Find the segment that caused the prediction
                        // Optimization: cell.getBestMatchingSegment(true) might return the one
                        // But strictly we should check which one WAS active.
                        for (const seg of cell.segments) {
                            if (seg.isActiveFromPrev) {
                                seg.adapt(false); // Negative reinforcement
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Adds synapses to a segment from currently active cells (which were active in prev step relative to when this is called? 
     * WAIT: The context of 'compute' is: 
     *   Input(t) arrives. 
     *   Columns(t) Active. 
     *   Cells(t) Active (Bursts or specific). 
     *   Learn: Connect Cells(t) to Cells(t-1).
     * 
     * But we don't have global access to "All active cells from t-1" easily unless we iterate.
     * 
     * In NLA: `TemporalPoolerCalculateUpdates` looks at `StatePrev`.
     * If I am a learning cell NOW, I want to connect to cells that were active PREVIOUSLY.
     */
    _learnOnSegment(segment) {
        // Find all cells that were active in the previous timestep
        // In a real optimized HTM, we keep a list. Here we iterate.
        const prevActiveCells = [];
        for (const col of this.region.columns) {
            for (const cell of col.cells) {
                if (cell.wasActive) {
                    prevActiveCells.push(cell);
                }
            }
        }

        // Subsample if too many?
        // Connect to them
        for (const prevCell of prevActiveCells) {
            // Don't connect if already connected?
            // Segment.addSynapse should check duplicates? 
            // Simplify: Just add random subset of 20? 
            if (Math.random() < 0.5) { // Subsample
                segment.addSynapse(prevCell, 0.5); // Initial permanence
            }
        }
    }
}

// Global Export
window.TemporalPooler = TemporalPooler;
