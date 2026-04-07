class Board {
    constructor(particleSystem) {
        this.grid = [];
        this.getEmptyGrid();
        this.particleSystem = particleSystem;
    }

    getEmptyGrid() {
        this.grid = Array.from({ length: CONSTANTS.ROWS }, () => Array(CONSTANTS.COLS).fill(0));
        return this.grid;
    }

    isValidPos(piece, newX, newY) {
        for (let r = 0; r < piece.shape.length; r++) {
            for (let c = 0; c < piece.shape[r].length; c++) {
                if (piece.shape[r][c] !== 0) {
                    let boardX = newX + c;
                    let boardY = newY + r;

                    // Out of bounds
                    if (boardX < 0 || boardX >= CONSTANTS.COLS || boardY >= CONSTANTS.ROWS) {
                        return false;
                    }

                    // Collision with placed blocks
                    if (boardY >= 0 && this.grid[boardY][boardX] !== 0) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    lockPiece(piece) {
        for (let r = 0; r < piece.shape.length; r++) {
            for (let c = 0; c < piece.shape[r].length; c++) {
                if (piece.shape[r][c] !== 0) {
                    let boardY = piece.y + r;
                    let boardX = piece.x + c;
                    if (boardY >= 0 && boardY < CONSTANTS.ROWS) {
                        this.grid[boardY][boardX] = piece.type; // Store color index
                    }
                }
            }
        }

        // Particle effect
        this.particleSystem.createBlockTrail(
            piece.x * CONSTANTS.BLOCK_SIZE,
            piece.y * CONSTANTS.BLOCK_SIZE,
            piece.shape[0].length * CONSTANTS.BLOCK_SIZE,
            piece.shape.length * CONSTANTS.BLOCK_SIZE,
            COLORS[piece.type]
        );
        this.particleSystem.addScreenShake(100, 2);
    }

    clearLines() {
        let linesCleared = 0;

        for (let r = CONSTANTS.ROWS - 1; r >= 0; r--) {
            let isLineFull = true;
            for (let c = 0; c < CONSTANTS.COLS; c++) {
                if (this.grid[r][c] === 0) {
                    isLineFull = false;
                    break;
                }
            }

            if (isLineFull) {
                // Clear the line visually and from grid
                for (let c = 0; c < CONSTANTS.COLS; c++) {
                    const color = COLORS[this.grid[r][c]];
                    this.particleSystem.createExplosion(
                        c * CONSTANTS.BLOCK_SIZE + CONSTANTS.BLOCK_SIZE / 2,
                        r * CONSTANTS.BLOCK_SIZE + CONSTANTS.BLOCK_SIZE / 2,
                        color, 5, 2
                    );
                    this.grid[r][c] = 0;
                }
                linesCleared++;
                this.particleSystem.addScreenShake(200, 4);
                // Note: True gravity takes care of falling blocks later
            }
        }

        return linesCleared;
    }

    applyTrueGravity() {
        let blocksMoved = false;
        // From bottom up
        for (let r = CONSTANTS.ROWS - 2; r >= 0; r--) {
            for (let c = 0; c < CONSTANTS.COLS; c++) {
                if (this.grid[r][c] !== 0 && this.grid[r + 1][c] === 0) {
                    this.grid[r + 1][c] = this.grid[r][c];
                    this.grid[r][c] = 0;
                    blocksMoved = true;
                }
            }
        }
        return blocksMoved;
    }

    explodeBomb(piece) {
        let bombX = piece.x;
        let bombY = piece.y; // 1x1

        const radius = 2; // 5x5 region
        let blocksDestroyed = 0;

        for (let r = bombY - radius; r <= bombY + radius; r++) {
            for (let c = bombX - radius; c <= bombX + radius; c++) {
                if (r >= 0 && r < CONSTANTS.ROWS && c >= 0 && c < CONSTANTS.COLS) {
                    if (this.grid[r][c] !== 0) {
                        const color = COLORS[this.grid[r][c]];
                        this.particleSystem.createExplosion(
                            c * CONSTANTS.BLOCK_SIZE + CONSTANTS.BLOCK_SIZE / 2,
                            r * CONSTANTS.BLOCK_SIZE + CONSTANTS.BLOCK_SIZE / 2,
                            color, 10, 3
                        );
                        this.grid[r][c] = 0;
                        blocksDestroyed++;
                    }
                }
            }
        }
        this.particleSystem.addScreenShake(400, 8);
        return blocksDestroyed;
    }
}
