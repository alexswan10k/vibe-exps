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
    }

    update() {
        this.handleInput();
        this.updateTimer();
        this.checkCollectibleCollision();
    }

    handleInput() {
        let newX = this.player.x;
        let newY = this.player.y;

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

        if (newX >= 0 && newX < this.cols && newY >= 0 && newY < this.rows &&
            this.maze[newY][newX] === 0) {
            this.player.x = newX;
            this.player.y = newY;
            this.explored.add(`${newX},${newY}`);
            this.playMoveSound();
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
