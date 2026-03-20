/**
 * Converts input text into Sparse Distributed Representations (SDRs).
 * Maps characters to sparse binary arrays.
 */
class Encoder {
    constructor(size = 64) {
        this.size = size;
        this.charMap = {};
    }

    /**
     * Get the encoding for a single character (or string token).
     * Returns an array of booleans.
     */
    encode(char) {
        if (!this.charMap[char]) {
            this.charMap[char] = this._generateRandomSDR(char);
        }
        return this.charMap[char];
    }

    /**
     * Decode a set of active bits (indices or boolean array) back to the most likely character.
     * @param {Array<number>} activeIndices - Array of active column indices.
     * @returns {Object} { char, confidence }
     */
    decode(activeIndices) {
        let bestChar = '?';
        let maxOverlap = -1;
        let bestConfidence = 0.0;

        // Convert input indices to Set for O(1) lookup
        const activeSet = new Set(activeIndices);

        for (const [char, sdr] of Object.entries(this.charMap)) {
            // Calculate overlap
            let overlap = 0;
            let totalBits = 0;

            for (let i = 0; i < sdr.length; i++) {
                if (sdr[i]) {
                    totalBits++;
                    if (activeSet.has(i)) {
                        overlap++;
                    }
                }
            }

            if (totalBits === 0) continue;

            if (overlap > maxOverlap) {
                maxOverlap = overlap;
                bestChar = char;
                bestConfidence = overlap / totalBits;
            }
        }

        if (maxOverlap === 0) return { char: '', confidence: 0 };

        return { char: bestChar, confidence: bestConfidence, overlap: maxOverlap };
    }

    /**
     * Generate a consistent random SDR for a token.
     */
    _generateRandomSDR(seedToken) {
        // Simple seeded randomish approach or just pure random for now.
        // For consistency in prototype without complex seed logic, we'll store it.
        // We want about 10-20% sparsity.
        const sdr = new Array(this.size).fill(false);
        const onBits = Math.floor(this.size * 0.15); // 15% active

        let indexes = new Set();
        while (indexes.size < onBits) {
            indexes.add(Math.floor(Math.random() * this.size));
        }

        for (const idx of indexes) {
            sdr[idx] = true;
        }
        return sdr;
    }
}

// Global Export
window.Encoder = Encoder;
