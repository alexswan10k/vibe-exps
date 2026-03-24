class Tetromino {
    constructor(type) {
        this.type = type;
        this.shape = SHAPES[type];
        this.color = COLORS[type];

        // Initial position (center top)
        this.x = Math.floor(CONSTANTS.COLS / 2) - Math.floor(this.shape[0].length / 2);
        this.y = 0;
    }

    rotate() {
        if (this.type === 4 || this.type === 8) return; // O shape and Bomb don't rotate
        this.shape = Utils.rotateMatrix(this.shape);
    }

    rotateCounterClockwise() {
        if (this.type === 4 || this.type === 8) return;
        this.rotate();
        this.rotate();
        this.rotate(); // 3 clockwise = 1 counter-clockwise
    }
}
