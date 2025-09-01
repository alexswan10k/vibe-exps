class MazeGame {
    constructor() {
        this.canvas = document.getElementById('mazeCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.scoreElement = document.getElementById('score');
        this.timerElement = document.getElementById('timer');

        this.cellSize = 20;
        this.cols = Math.floor(this.canvas.width / this.cellSize);
        this.rows = Math.floor(this.canvas.height / this.cellSize);

        this.maze = [];
        this.player = { x: 1, y: 1 };
        this.collectibles = [];
        this.explored = new Set();

        this.score = 0;
        this.startTime = Date.now();
        this.gameLoop = null;
        this.lastMoveTime = 0;
        this.moveDelay = 150; // milliseconds between moves
        this.autoMode = false;
        this.autoMoveDelay = 100; // faster for auto mode

        // AI memory to prevent getting stuck
        this.recentMoves = [];
        this.maxRecentMoves = 25; // Increased from 8 to prevent loops
        this.stuckCounter = 0;
        this.lastDirection = null;
        this.moveHistory = []; // Track position history
        this.maxHistory = 80; // Increased from 20 to prevent revisiting positions
        this.consecutiveSameDirection = 0;

        this.keys = {};
        this.init();
    }

    init() {
        this.generateMaze();
        this.placeCollectibles();
        this.setupEventListeners();
        this.startGameLoop();
        this.generateAmbientSound();
    }

    generateMaze() {
        // Initialize maze with walls
        for (let y = 0; y < this.rows; y++) {
            this.maze[y] = [];
            for (let x = 0; x < this.cols; x++) {
                this.maze[y][x] = 1; // 1 = wall, 0 = path
            }
        }

        // Depth-first search maze generation
        const stack = [];
        const visited = new Set();
        const startX = 1;
        const startY = 1;

        this.maze[startY][startX] = 0;
        visited.add(`${startX},${startY}`);
        stack.push({ x: startX, y: startY });

        while (stack.length > 0) {
            const current = stack[stack.length - 1];
            const neighbors = this.getUnvisitedNeighbors(current.x, current.y, visited);

            if (neighbors.length > 0) {
                const next = neighbors[Math.floor(Math.random() * neighbors.length)];
                this.removeWall(current.x, current.y, next.x, next.y);
                this.maze[next.y][next.x] = 0;
                visited.add(`${next.x},${next.y}`);
                stack.push(next);
            } else {
                stack.pop();
            }
        }
    }

    getUnvisitedNeighbors(x, y, visited) {
        const neighbors = [];
        const directions = [
            { x: 0, y: -2 }, // up
            { x: 2, y: 0 },  // right
            { x: 0, y: 2 },  // down
            { x: -2, y: 0 }  // left
        ];

        for (const dir of directions) {
            const nx = x + dir.x;
            const ny = y + dir.y;
            if (nx > 0 && nx < this.cols - 1 && ny > 0 && ny < this.rows - 1 &&
                !visited.has(`${nx},${ny}`)) {
                neighbors.push({ x: nx, y: ny });
            }
        }

        return neighbors;
    }

    removeWall(x1, y1, x2, y2) {
        const wallX = (x1 + x2) / 2;
        const wallY = (y1 + y2) / 2;
        this.maze[wallY][wallX] = 0;
    }

    placeCollectibles() {
        this.collectibles = [];
        for (let y = 1; y < this.rows - 1; y += 2) {
            for (let x = 1; x < this.cols - 1; x += 2) {
                if (this.maze[y][x] === 0 && !(x === this.player.x && y === this.player.y)) {
                    if (Math.random() < 0.1) { // 10% chance
                        this.collectibles.push({ x, y });
                    }
                }
            }
        }
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });

        // Auto explore button
        const autoButton = document.getElementById('autoButton');
        autoButton.addEventListener('click', () => {
            this.toggleAutoMode();
        });

        // Touch controls
        this.setupTouchControls();
    }

    setupTouchControls() {
        const upBtn = document.getElementById('upBtn');
        const downBtn = document.getElementById('downBtn');
        const leftBtn = document.getElementById('leftBtn');
        const rightBtn = document.getElementById('rightBtn');

        // Touch and mouse events for better mobile support
        const handleTouchStart = (key) => {
            this.keys[key] = true;
        };

        const handleTouchEnd = (key) => {
            this.keys[key] = false;
        };

        // Up button
        upBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleTouchStart('ArrowUp');
        });
        upBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleTouchEnd('ArrowUp');
        });
        upBtn.addEventListener('mousedown', () => handleTouchStart('ArrowUp'));
        upBtn.addEventListener('mouseup', () => handleTouchEnd('ArrowUp'));
        upBtn.addEventListener('mouseleave', () => handleTouchEnd('ArrowUp'));

        // Down button
        downBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleTouchStart('ArrowDown');
        });
        downBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleTouchEnd('ArrowDown');
        });
        downBtn.addEventListener('mousedown', () => handleTouchStart('ArrowDown'));
        downBtn.addEventListener('mouseup', () => handleTouchEnd('ArrowDown'));
        downBtn.addEventListener('mouseleave', () => handleTouchEnd('ArrowDown'));

        // Left button
        leftBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleTouchStart('ArrowLeft');
        });
        leftBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleTouchEnd('ArrowLeft');
        });
        leftBtn.addEventListener('mousedown', () => handleTouchStart('ArrowLeft'));
        leftBtn.addEventListener('mouseup', () => handleTouchEnd('ArrowLeft'));
        leftBtn.addEventListener('mouseleave', () => handleTouchEnd('ArrowLeft'));

        // Right button
        rightBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleTouchStart('ArrowRight');
        });
        rightBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleTouchEnd('ArrowRight');
        });
        rightBtn.addEventListener('mousedown', () => handleTouchStart('ArrowRight'));
        rightBtn.addEventListener('mouseup', () => handleTouchEnd('ArrowRight'));
        rightBtn.addEventListener('mouseleave', () => handleTouchEnd('ArrowRight'));
    }

    toggleAutoMode() {
        this.autoMode = !this.autoMode;
        const autoButton = document.getElementById('autoButton');

        if (this.autoMode) {
            autoButton.textContent = 'Stop Auto';
            autoButton.classList.add('auto-active');
        } else {
            autoButton.textContent = 'Auto Explore';
            autoButton.classList.remove('auto-active');
        }
    }

    update() {
        this.handleInput();
        this.updateTimer();
        this.checkCollectibleCollision();
    }

    handleInput() {
        const currentTime = Date.now();
        const currentDelay = this.autoMode ? this.autoMoveDelay : this.moveDelay;

        if (currentTime - this.lastMoveTime < currentDelay) {
            return; // Too soon since last move
        }

        let newX = this.player.x;
        let newY = this.player.y;

        if (this.autoMode) {
            // Auto mode: find best direction
            const direction = this.findBestDirection();
            if (direction) {
                newX += direction.x;
                newY += direction.y;
            }
        } else {
            // Manual mode: check keyboard input
            if (this.keys['ArrowUp'] || this.keys['w'] || this.keys['W']) {
                newY -= 1;
            }
            if (this.keys['ArrowDown'] || this.keys['s'] || this.keys['S']) {
                newY += 1;
            }
            if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) {
                newX -= 1;
            }
            if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) {
                newX += 1;
            }
        }

        if (newX >= 0 && newX < this.cols && newY >= 0 && newY < this.rows &&
            this.maze[newY][newX] === 0) {
            // Track recent moves and position history to prevent getting stuck
            if (this.autoMode) {
                const moveKey = `${newX - this.player.x},${newY - this.player.y}`;

                // Track consecutive same direction
                if (this.lastDirection && moveKey === this.lastDirection) {
                    this.consecutiveSameDirection++;
                } else {
                    this.consecutiveSameDirection = 1;
                }
                this.lastDirection = moveKey;

                this.recentMoves.push(moveKey);
                if (this.recentMoves.length > this.maxRecentMoves) {
                    this.recentMoves.shift();
                }

                // Track position history
                this.moveHistory.push({ x: this.player.x, y: this.player.y });
                if (this.moveHistory.length > this.maxHistory) {
                    this.moveHistory.shift();
                }

                // Simple stuck detection: if we've made the same move 4+ times in a row
                if (this.recentMoves.length >= 4) {
                    const lastFour = this.recentMoves.slice(-4);
                    if (lastFour.every(move => move === lastFour[0])) {
                        this.stuckCounter++;
                    } else {
                        this.stuckCounter = 0; // Reset if pattern broken
                    }
                }
            }

            this.player.x = newX;
            this.player.y = newY;
            this.explored.add(`${newX},${newY}`);
            this.playMoveSound();
            this.lastMoveTime = currentTime;
        }
    }

    checkCollectibleCollision() {
        this.collectibles = this.collectibles.filter(collectible => {
            if (collectible.x === this.player.x && collectible.y === this.player.y) {
                this.score += 10;
                this.scoreElement.textContent = this.score;
                this.playCollectSound();
                return false;
            }
            return true;
        });
    }

    updateTimer() {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        this.timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw maze with fog-of-war
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const isExplored = this.explored.has(`${x},${y}`);
                const isVisible = this.isInVisionRange(x, y);

                if (this.maze[y][x] === 1) {
                    if (isExplored || isVisible) {
                        this.ctx.fillStyle = '#333';
                        this.ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
                    } else {
                        this.ctx.fillStyle = '#000';
                        this.ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
                    }
                } else {
                    if (isExplored || isVisible) {
                        this.ctx.fillStyle = '#1a1a1a';
                        this.ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
                    } else {
                        this.ctx.fillStyle = '#000';
                        this.ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
                    }
                }
            }
        }

        // Draw collectibles
        this.collectibles.forEach(collectible => {
            if (this.isInVisionRange(collectible.x, collectible.y)) {
                this.ctx.fillStyle = '#ffd700';
                this.ctx.fillRect(
                    collectible.x * this.cellSize + 5,
                    collectible.y * this.cellSize + 5,
                    this.cellSize - 10,
                    this.cellSize - 10
                );
            }
        });

        // Draw player
        this.ctx.fillStyle = '#e94560';
        this.ctx.fillRect(
            this.player.x * this.cellSize + 2,
            this.player.y * this.cellSize + 2,
            this.cellSize - 4,
            this.cellSize - 4
        );
    }

    findBestDirection() {
        const directions = [
            { x: 0, y: -1, name: 'up' },    // up
            { x: 1, y: 0, name: 'right' },  // right
            { x: 0, y: 1, name: 'down' },  // down
            { x: -1, y: 0, name: 'left' }  // left
        ];

        // Calculate scores for all adjacent traversable squares
        let bestDirection = null;
        let bestScore = -Infinity;

        for (const dir of directions) {
            const newX = this.player.x + dir.x;
            const newY = this.player.y + dir.y;

            // Skip if not traversable
            if (newX < 0 || newX >= this.cols || newY < 0 || newY >= this.rows ||
                this.maze[newY][newX] !== 0) {
                continue;
            }

            let score = 0;

            // Base score for being traversable
            score += 1;

            // Penalty for each time this position has been visited
            const posKey = `${newX},${newY}`;
            const visitCount = this.moveHistory.filter(pos => pos.x === newX && pos.y === newY).length;
            score -= visitCount;

            // Bonus for continuing in the same direction
            if (this.lastDirection) {
                const [lastDx, lastDy] = this.lastDirection.split(',').map(Number);
                if (dir.x === lastDx && dir.y === lastDy) {
                    score += 2; // Same direction bonus
                }

            // Bonus for turning left (relative to current direction)
            const currentDirIndex = this.getDirectionIndex(lastDx, lastDy);
            const newDirIndex = this.getDirectionIndex(dir.x, dir.y);
            const leftTurnIndex = (currentDirIndex - 1 + 4) % 4;

            if (newDirIndex === leftTurnIndex) {
                score += 1; // Left turn bonus
            }

            // Bonus for food (collectibles) visible in this direction
            if (this.hasCollectibleInDirection(dir.x, dir.y)) {
                score += 5; // Food bonus
            }
            }

            // Choose the highest scoring direction
            if (score > bestScore) {
                bestScore = score;
                bestDirection = dir;
            }
        }

        return bestDirection;
    }

    getDirectionIndex(dx, dy) {
        if (dx === 0 && dy === -1) return 0; // up
        if (dx === 1 && dy === 0) return 1;  // right
        if (dx === 0 && dy === 1) return 2;  // down
        if (dx === -1 && dy === 0) return 3; // left
        return -1;
    }

    hasCollectibleInDirection(dirX, dirY) {
        // Check if there are any collectibles visible in this direction
        for (const collectible of this.collectibles) {
            if (this.isInVisionRange(collectible.x, collectible.y)) {
                // Check if the collectible is in the same direction
                const dx = collectible.x - this.player.x;
                const dy = collectible.y - this.player.y;

                // Normalize the direction vectors for comparison
                const collectibleDirX = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
                const collectibleDirY = dy === 0 ? 0 : (dy > 0 ? 1 : -1);

                // If the collectible is in the same direction (or same axis), return true
                if (collectibleDirX === dirX && collectibleDirY === dirY) {
                    return true;
                }
            }
        }
        return false;
    }

    isInVisionRange(x, y) {
        const dx = Math.abs(x - this.player.x);
        const dy = Math.abs(y - this.player.y);
        return dx <= 3 && dy <= 3; // Vision range of 3 cells
    }

    generateAmbientSound() {
        // Generate eerie ambient sound using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
            oscillator.type = 'sawtooth';

            gainNode.gain.setValueAtTime(0.01, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 10);

            oscillator.start();
            oscillator.stop(audioContext.currentTime + 10);
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }

    playMoveSound() {
        this.playTone(400, 0.1);
    }

    playCollectSound() {
        this.playTone(800, 0.2);
    }

    playTone(frequency, duration) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
            oscillator.type = 'square';

            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

            oscillator.start();
            oscillator.stop(audioContext.currentTime + duration);
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }

    resetStuckState() {
        // Intelligent reset: keep some useful information but clear problematic patterns
        this.stuckCounter = 0;
        this.consecutiveSameDirection = 0;

        // Clear recent moves to break patterns, but keep some position history
        this.recentMoves = [];

        // Keep the last 10 positions for context, but clear the most recent ones that might be causing loops
        if (this.moveHistory.length > 10) {
            this.moveHistory = this.moveHistory.slice(0, 10);
        }

        // Reset direction tracking
        this.lastDirection = null;
    }

    startGameLoop() {
        const loop = () => {
            this.update();
            this.render();
            this.gameLoop = requestAnimationFrame(loop);
        };
        loop();
    }
}

// Start the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MazeGame();
});
