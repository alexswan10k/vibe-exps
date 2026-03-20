class Renderer {
    constructor(ctx, nextCtx, particleSystem) {
        this.ctx = ctx;
        this.nextCtx = nextCtx;
        this.particles = particleSystem;
        this.blockSize = CONSTANTS.BLOCK_SIZE;
        this.width = CONSTANTS.WIDTH;
        this.height = CONSTANTS.HEIGHT;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.nextCtx.clearRect(0, 0, this.nextCtx.canvas.width, this.nextCtx.canvas.height);
    }

    drawBlock(ctx, x, y, color, isGhost = false) {
        if (isGhost) {
            ctx.fillStyle = 'transparent';
            ctx.globalAlpha = 0.3;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.strokeRect(x * this.blockSize + 1, y * this.blockSize + 1, this.blockSize - 2, this.blockSize - 2);
            ctx.fillStyle = color;
            ctx.fillRect(x * this.blockSize + 4, y * this.blockSize + 4, this.blockSize - 8, this.blockSize - 8);
            ctx.globalAlpha = 1.0;
        } else {
            ctx.fillStyle = color;
            ctx.shadowBlur = 12;
            ctx.shadowColor = color;
            ctx.fillRect(x * this.blockSize, y * this.blockSize, this.blockSize, this.blockSize);

            // Inner highlight
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fillRect(x * this.blockSize, y * this.blockSize, this.blockSize, this.blockSize / 5);
        }
    }

    drawGrid(board) {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;

        for (let r = 0; r <= CONSTANTS.ROWS; r++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, r * this.blockSize);
            this.ctx.lineTo(this.width, r * this.blockSize);
            this.ctx.stroke();
        }
        for (let c = 0; c <= CONSTANTS.COLS; c++) {
            this.ctx.beginPath();
            this.ctx.moveTo(c * this.blockSize, 0);
            this.ctx.lineTo(c * this.blockSize, this.height);
            this.ctx.stroke();
        }

        for (let r = 0; r < CONSTANTS.ROWS; r++) {
            for (let c = 0; c < CONSTANTS.COLS; c++) {
                if (board.grid[r][c] !== 0) {
                    this.drawBlock(this.ctx, c, r, COLORS[board.grid[r][c]]);
                }
            }
        }
    }

    drawPiece(ctx, piece, offsetX = 0, offsetY = 0, isGhost = false) {
        if (!piece) return;

        for (let r = 0; r < piece.shape.length; r++) {
            for (let c = 0; c < piece.shape[r].length; c++) {
                if (piece.shape[r][c] !== 0) {
                    this.drawBlock(ctx, piece.x + c + offsetX, piece.y + r + offsetY, piece.color, isGhost);
                }
            }
        }
    }

    drawGhost(board, piece) {
        if (!piece || piece.type === 8) return;

        const ghost = new Tetromino(piece.type);
        ghost.shape = piece.shape;
        ghost.x = piece.x;
        ghost.y = piece.y;

        while (board.isValidPos(ghost, ghost.x, ghost.y + 1)) {
            ghost.y++;
        }

        this.drawPiece(this.ctx, ghost, 0, 0, true);
    }

    drawNextPiece(piece) {
        if (!piece) return;

        const cols = piece.shape[0].length;
        const rows = piece.shape.length;
        const offsetX = (4 - cols) / 2;
        const offsetY = (4 - rows) / 2;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (piece.shape[r][c] !== 0) {
                    this.drawBlock(this.nextCtx, c + offsetX, r + offsetY, piece.color);
                }
            }
        }
    }

    render(board, piece, nextPiece) {
        this.ctx.save();

        if (this.particles.shakeTime > 0) {
            const dx = (Math.random() - 0.5) * this.particles.shakeIntensity;
            const dy = (Math.random() - 0.5) * this.particles.shakeIntensity;
            this.ctx.translate(dx, dy);
        }

        this.clear();
        this.drawGrid(board);
        this.drawGhost(board, piece);
        this.drawPiece(this.ctx, piece);
        this.particles.draw(this.ctx);

        this.ctx.restore();

        this.drawNextPiece(nextPiece);
    }
}
