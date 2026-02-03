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
