class Game {
    constructor(board, renderer, particleSystem) {
        this.board = board;
        this.renderer = renderer;
        this.particles = particleSystem;

        this.state = 'START'; // START, PLAYING, PAUSED, GAMEOVER
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.dropInterval = CONSTANTS.BASE_DROP_INTERVAL;

        this.lastTime = performance.now();
        this.dropCounter = 0;
        this.gravityCounter = 0;
        this.gravityTickRate = 50; // ms between true gravity falls

        this.currentPiece = null;
        this.nextPiece = null;
        this.bag = [];

        this.gravityActive = false;

        this.scoreDisplay = document.getElementById('score-display');
        this.linesDisplay = document.getElementById('lines-display');
        this.levelDisplay = document.getElementById('level-display');
        this.finalScore = document.getElementById('final-score');

        this.gameOverScreen = document.getElementById('game-over-screen');
        this.pauseScreen = document.getElementById('pause-screen');

        this.initControls();

        document.getElementById('restart-btn').addEventListener('click', () => this.reset());
        document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());

        // Focus handling so game can pause when user clicks out
        window.addEventListener('blur', () => {
            if (this.state === 'PLAYING') this.togglePause();
        });
    }

    init() {
        this.reset();
        requestAnimationFrame((time) => this.loop(time));
    }

    reset() {
        this.board.getEmptyGrid();
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.dropInterval = CONSTANTS.BASE_DROP_INTERVAL;
        this.updateStats();

        this.bag = [];
        this.spawnPiece();
        this.state = 'PLAYING';
        this.lastTime = performance.now();
        this.gameOverScreen.classList.add('hidden');
        this.pauseScreen.classList.add('hidden');
    }

    getNextType() {
        if (this.bag.length === 0) {
            this.bag = Utils.generateBag();
        }
        return this.bag.pop();
    }

    spawnPiece() {
        if (!this.nextPiece) {
            this.nextPiece = new Tetromino(this.getNextType());
        }
        this.currentPiece = this.nextPiece;

        // 5% chance for a bomb replacing next piece
        // Or if you only want it occasionally:
        if (Math.random() < 0.05) {
            this.nextPiece = new Tetromino(8); // BOMB
        } else {
            this.nextPiece = new Tetromino(this.getNextType());
        }

        if (!this.board.isValidPos(this.currentPiece, this.currentPiece.x, this.currentPiece.y)) {
            this.state = 'GAMEOVER';
            this.finalScore.innerText = this.score;
            this.gameOverScreen.classList.remove('hidden');
        }
    }

    togglePause() {
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            this.pauseScreen.classList.remove('hidden');
        } else if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
            this.lastTime = performance.now();
            this.pauseScreen.classList.add('hidden');
        }
    }

    updateStats() {
        this.scoreDisplay.innerText = this.score;
        this.linesDisplay.innerText = this.lines;
        this.levelDisplay.innerText = this.level;
    }

    addScore(clearedLines) {
        if (clearedLines > 0) {
            const lineMultiplier = [0, 40, 100, 300, 1200];
            this.score += lineMultiplier[clearedLines] * this.level;
            this.lines += clearedLines;

            this.level = Math.floor(this.lines / CONSTANTS.LINES_PER_LEVEL) + 1;

            this.dropInterval = Math.max(
                CONSTANTS.MIN_DROP_INTERVAL,
                CONSTANTS.BASE_DROP_INTERVAL * Math.pow(CONSTANTS.SPEED_MULTIPLIER, this.level - 1)
            );

            this.updateStats();
        }
    }

    drop() {
        if (this.board.isValidPos(this.currentPiece, this.currentPiece.x, this.currentPiece.y + 1)) {
            this.currentPiece.y++;
        } else {
            this.lockPiece();
        }
        this.dropCounter = 0;
    }

    lockPiece() {
        if (this.currentPiece.type === 8) {
            const destroyed = this.board.explodeBomb(this.currentPiece);
            this.score += destroyed * 10 * this.level;
            this.updateStats();
        } else {
            this.board.lockPiece(this.currentPiece);
        }

        const cleared = this.board.clearLines();
        this.addScore(cleared);

        this.gravityActive = true;
        this.gravityCounter = 0;
        this.currentPiece = null; // Hide current piece during gravity animation
    }

    hardDrop() {
        while (this.board.isValidPos(this.currentPiece, this.currentPiece.x, this.currentPiece.y + 1)) {
            this.currentPiece.y++;
            this.score += 2;
        }
        this.lockPiece();
        this.updateStats();
    }

    moveDown() {
        if (this.board.isValidPos(this.currentPiece, this.currentPiece.x, this.currentPiece.y + 1)) {
            this.currentPiece.y++;
            this.score += 1;
            this.updateStats();
        }
        this.dropCounter = 0;
    }

    moveHorizontal(dir) {
        if (this.board.isValidPos(this.currentPiece, this.currentPiece.x + dir, this.currentPiece.y)) {
            this.currentPiece.x += dir;
        }
    }

    rotate() {
        this.currentPiece.rotate();

        if (!this.board.isValidPos(this.currentPiece, this.currentPiece.x, this.currentPiece.y)) {
            this.currentPiece.x += 1;
            if (!this.board.isValidPos(this.currentPiece, this.currentPiece.x, this.currentPiece.y)) {
                this.currentPiece.x -= 2;
                if (!this.board.isValidPos(this.currentPiece, this.currentPiece.x, this.currentPiece.y)) {
                    this.currentPiece.x += 1;
                    this.currentPiece.rotateCounterClockwise();
                }
            }
        }
    }

    initControls() {
        document.addEventListener('keydown', (e) => {
            // Prevent default scrolling for arrows and space
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                e.preventDefault();
            }

            if (e.key === 'p' || e.key === 'P') {
                this.togglePause();
                return;
            }
            if (this.state !== 'PLAYING') return;
            if (this.gravityActive) return; // Ignore input while blocks are settling

            switch (e.key) {
                case 'ArrowLeft':
                    this.moveHorizontal(-1);
                    break;
                case 'ArrowRight':
                    this.moveHorizontal(1);
                    break;
                case 'ArrowDown':
                    this.moveDown();
                    break;
                case 'ArrowUp':
                    this.rotate();
                    break;
                case ' ':
                    this.hardDrop();
                    break;
            }
        });
    }

    loop(time = 0) {
        const dt = time - this.lastTime;
        this.lastTime = time;

        if (this.state === 'PLAYING') {
            this.particles.update(dt);

            if (this.gravityActive) {
                this.gravityCounter += dt;
                if (this.gravityCounter >= this.gravityTickRate) {
                    const moved = this.board.applyTrueGravity();
                    if (!moved) {
                        const cleared = this.board.clearLines();
                        if (cleared > 0) {
                            this.addScore(cleared);
                            this.gravityCounter = 0;
                        } else {
                            this.gravityActive = false;
                            this.spawnPiece();
                        }
                    }
                    this.gravityCounter = 0;
                }
            }
            else if (this.currentPiece) {
                this.dropCounter += dt;
                if (this.dropCounter >= this.dropInterval) {
                    this.drop();
                }
            }

            this.renderer.render(this.board, this.currentPiece, this.nextPiece);
        } else if (this.state === 'GAMEOVER' || this.state === 'PAUSED') {
            // Keep rendering particles and board even if paused/game over
            this.particles.update(dt);
            this.renderer.render(this.board, this.currentPiece, this.nextPiece);
        }

        requestAnimationFrame((t) => this.loop(t));
    }
}
