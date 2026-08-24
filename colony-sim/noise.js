/**
 * Tileable value noise with fractal octaves. Used for terrain generation.
 */
class ValueNoise {
    /**
     * @param {Function} rng - seeded random function
     * @param {number} lattice - base lattice resolution (cells across the map)
     */
    constructor(rng, lattice = 8) {
        this.lattice = lattice;
        this.grid = [];
        for (let y = 0; y <= lattice; y++) {
            this.grid[y] = [];
            for (let x = 0; x <= lattice; x++) {
                this.grid[y][x] = rng();
            }
        }
    }

    /** Smoothed value at normalized coords (u, v in [0,1]). */
    sample(u, v) {
        const x = u * this.lattice;
        const y = v * this.lattice;
        const x0 = Math.floor(x), y0 = Math.floor(y);
        const tx = this._fade(x - x0), ty = this._fade(y - y0);
        const v00 = this._at(x0, y0), v10 = this._at(x0 + 1, y0);
        const v01 = this._at(x0, y0 + 1), v11 = this._at(x0 + 1, y0 + 1);
        return lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), ty);
    }

    /** Fractal Brownian motion over several scaled copies. */
    fbm(u, v, octaves = 4, gain = 0.5) {
        let sum = 0, amp = 1, freq = 1, norm = 0;
        for (let o = 0; o < octaves; o++) {
            sum += this.sample((u * freq) % 1, (v * freq) % 1) * amp;
            norm += amp;
            amp *= gain;
            freq *= 2;
        }
        return sum / norm;
    }

    _at(x, y) {
        const xi = ((x % this.lattice) + this.lattice) % this.lattice;
        const yi = ((y % this.lattice) + this.lattice) % this.lattice;
        return this.grid[yi][xi];
    }

    _fade(t) {
        return t * t * (3 - 2 * t);
    }
}

if (typeof module !== 'undefined') module.exports = { ValueNoise };
