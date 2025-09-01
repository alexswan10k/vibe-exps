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
        this.maxRecentMoves = 8;
        this.stuckCounter = 0;
        this.lastDirection = null;
        this.moveHistory = []; // Track position history
        this.maxHistory = 20;
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

                // Check if we're stuck in a pattern
                if (this.recentMoves.length >= 4) {
                    const lastFour = this.recentMoves.slice(-4);
                    if (lastFour.every(move => move === lastFour[0])) {
                        this.stuckCounter++;
                    } else {
                        this.stuckCounter = 0;
                    }
                }

                // Check if we're going in circles (visited same position recently)
                const currentPos = `${newX},${newY}`;
                if (this.moveHistory.some(pos => pos.x === newX && pos.y === newY)) {
                    this.stuckCounter += 2; // Penalize revisiting positions
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
            { x: 0, y: -1 }, // up
            { x: 1, y: 0 },  // right
            { x: 0, y: 1 },  // down
            { x: -1, y: 0 }  // left
        ];

        // MOMENTUM SYSTEM: If we've been moving in the same direction for a while, keep going!
        if (this.consecutiveSameDirection >= 3 && this.lastDirection) {
            const [dx, dy] = this.lastDirection.split(',').map(Number);
            const continuedDirection = { x: dx, y: dy };

            // Check if we can continue in this direction
            const newX = this.player.x + continuedDirection.x;
            const newY = this.player.y + continuedDirection.y;

            if (newX >= 0 && newX < this.cols && newY >= 0 && newY < this.rows &&
                this.maze[newY][newX] === 0) {
                // 80% chance to continue straight when in momentum
                if (Math.random() < 0.8) {
                    return continuedDirection;
                }
            }
        }

        // If we're stuck, be completely aggressive and random
        if (this.stuckCounter > 3) {
            this.recentMoves = [];
            this.stuckCounter = 0;
            this.consecutiveSameDirection = 0;

            const validDirections = directions.filter(dir => {
                const newX = this.player.x + dir.x;
                const newY = this.player.y + dir.y;
                return newX >= 0 && newX < this.cols && newY >= 0 && newY < this.rows &&
                       this.maze[newY][newX] === 0;
            });

            if (validDirections.length > 0) {
                return validDirections[Math.floor(Math.random() * validDirections.length)];
            }
        }

        // First priority: move towards visible collectibles
        let closestCollectible = null;
        let closestDistance = Infinity;

        for (const collectible of this.collectibles) {
            if (this.isInVisionRange(collectible.x, collectible.y)) {
                const distance = Math.abs(collectible.x - this.player.x) + Math.abs(collectible.y - this.player.y);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestCollectible = collectible;
                }
            }
        }

        if (closestCollectible) {
            const dx = closestCollectible.x - this.player.x;
            const dy = closestCollectible.y - this.player.y;

            let targetDirection;
            if (Math.abs(dx) > Math.abs(dy)) {
                targetDirection = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
            } else {
                targetDirection = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
            }

            // Check if target direction is valid
            const newX = this.player.x + targetDirection.x;
            const newY = this.player.y + targetDirection.y;
            if (newX >= 0 && newX < this.cols && newY >= 0 && newY < this.rows &&
                this.maze[newY][newX] === 0) {
                return targetDirection;
            }
        }

        // Second priority: explore unexplored areas aggressively
        const unexploredDirections = directions.filter(dir => {
            const newX = this.player.x + dir.x;
            const newY = this.player.y + dir.y;
            return newX >= 0 && newX < this.cols && newY >= 0 && newY < this.rows &&
                   this.maze[newY][newX] === 0 && !this.explored.has(`${newX},${newY}`);
        });

        if (unexploredDirections.length > 0) {
            // 60% chance to pick unexplored, 40% chance to be random even with unexplored options
            if (Math.random() < 0.6) {
                return unexploredDirections[Math.floor(Math.random() * unexploredDirections.length)];
            }
        }

        // AGGRESSIVE EXPLORATION: When no clear goals, be much more random
        const validDirections = directions.filter(dir => {
            const newX = this.player.x + dir.x;
            const newY = this.player.y + dir.y;
            return newX >= 0 && newX < this.cols && newY >= 0 && newY < this.rows &&
                   this.maze[newY][newX] === 0;
        });

        if (validDirections.length > 0) {
            // Track which directions we haven't tried recently
            const untriedDirections = validDirections.filter(dir => {
                const moveKey = `${dir.x},${dir.y}`;
                return !this.recentMoves.includes(moveKey);
            });

            // Prefer untried directions, but still be somewhat random
            let chosenDirection;
            if (untriedDirections.length > 0 && Math.random() < 0.7) {
                chosenDirection = untriedDirections[Math.floor(Math.random() * untriedDirections.length)];
            } else {
                chosenDirection = validDirections[Math.floor(Math.random() * validDirections.length)];
            }

            return chosenDirection;
        }

        // No valid moves (shouldn't happen in a proper maze)
        return null;
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
