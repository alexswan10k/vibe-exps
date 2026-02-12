class Chunk {
    constructor(x, y, size) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.grid = []; // 2D array: 1 = wall, 0 = path
        this.collectibles = [];

        // Initialize with walls
        for (let ry = 0; ry < this.size; ry++) {
            this.grid[ry] = [];
            for (let rx = 0; rx < this.size; rx++) {
                this.grid[ry][rx] = 1;
            }
        }
    }

    getKey() {
        return `${this.x},${this.y}`;
    }

    toWorld(localX, localY) {
        return {
            x: this.x * this.size + localX,
            y: this.y * this.size + localY
        };
    }

    toLocal(worldX, worldY) {
        return {
            x: worldX - this.x * this.size,
            y: worldY - this.y * this.size
        };
    }
}

class MazeWorld {
    constructor(chunkSize = 20) {
        this.chunkSize = chunkSize;
        this.chunks = new Map();
        // Start with initial chunk
        this.generateChunk(0, 0);
    }

    getChunk(cx, cy) {
        const key = `${cx},${cy}`;
        if (this.chunks.has(key)) {
            return this.chunks.get(key);
        }
        return this.generateChunk(cx, cy);
    }

    getTile(wx, wy) {
        const cx = Math.floor(wx / this.chunkSize);
        const cy = Math.floor(wy / this.chunkSize);
        const chunk = this.getChunk(cx, cy);

        // Modular arithmetic in JS for negative numbers: ((a % n) + n) % n
        const lx = ((wx % this.chunkSize) + this.chunkSize) % this.chunkSize;
        const ly = ((wy % this.chunkSize) + this.chunkSize) % this.chunkSize;

        return chunk.grid[ly][lx];
    }

    // Check if a tile is a wall (blocks movement)
    isWall(wx, wy) {
        return this.getTile(wx, wy) === 1;
    }

    generateChunk(cx, cy) {
        const newChunk = new Chunk(cx, cy, this.chunkSize);
        this.chunks.set(newChunk.getKey(), newChunk);

        // Generation Algorithm: Recursive Backtracker with Neighbor Awareness
        const stack = [];
        const visited = new Set();

        // Find entrances from neighbors
        const entrances = this.findEntrances(cx, cy);

        let startX = 1;
        let startY = 1;

        if (entrances.length > 0) {
            // Pick a random entrance to start from
            const ent = entrances[Math.floor(Math.random() * entrances.length)];
            startX = ent.x;
            startY = ent.y;
        } else if (cx === 0 && cy === 0) {
            // Force center start for first chunk (if desired, or just use 1,1)
            startX = Math.floor(this.chunkSize / 2);
            startY = Math.floor(this.chunkSize / 2);
        }

        // Carve start
        newChunk.grid[startY][startX] = 0;
        visited.add(`${startX},${startY}`);
        stack.push({ x: startX, y: startY });

        // Force connection to all entrances (make sure they are open)
        for (const ent of entrances) {
            newChunk.grid[ent.y][ent.x] = 0;
            // Add to stack to ensure we branch from them too if we want fully connected
            // But main loop usually handles it if we just carve them.
            // Let's rely on random walk eventually hitting them or starting from one.
        }

        while (stack.length > 0) {
            const current = stack[stack.length - 1]; // Peak
            const neighbors = this.getUnvisitedNeighbors(current.x, current.y, newChunk, visited);

            if (neighbors.length > 0) {
                const next = neighbors[Math.floor(Math.random() * neighbors.length)];

                // Carve wall between
                const wallX = (current.x + next.x) / 2;
                const wallY = (current.y + next.y) / 2;
                newChunk.grid[wallY][wallX] = 0;
                newChunk.grid[next.y][next.x] = 0;

                visited.add(`${next.x},${next.y}`);
                stack.push(next);
            } else {
                stack.pop();
            }
        }

        // Ensure connectivity to future neighbors (Exits)
        // We randomly punch 1 hole on each edge if there wasn't an entrance there?
        // Actually, just punching holes on edges is enough. The next chunk will see them as entrances.
        this.createExits(newChunk);

        // Add collectibles
        this.spawnCollectibles(newChunk);

        return newChunk;
    }

    findEntrances(cx, cy) {
        const entrances = [];

        // Check Top (0, -1) -> Neighbor Bottom Row (y=size-1)
        const topKey = `${cx},${cy - 1}`;
        if (this.chunks.has(topKey)) {
            const topChunk = this.chunks.get(topKey);
            for (let x = 1; x < this.chunkSize; x += 2) {
                if (topChunk.grid[this.chunkSize - 1][x] === 0) {
                    entrances.push({ x: x, y: 0 });
                }
            }
        }

        // Check Bottom (0, 1) -> Neighbor Top Row (y=0)
        const bottomKey = `${cx},${cy + 1}`;
        if (this.chunks.has(bottomKey)) {
            const bottomChunk = this.chunks.get(bottomKey);
            for (let x = 1; x < this.chunkSize; x += 2) {
                if (bottomChunk.grid[0][x] === 0) {
                    entrances.push({ x: x, y: this.chunkSize - 1 });
                }
            }
        }

        // Check Left (-1, 0) -> Neighbor Right Row (x=size-1)
        const leftKey = `${cx - 1},${cy}`;
        if (this.chunks.has(leftKey)) {
            const leftChunk = this.chunks.get(leftKey);
            for (let y = 1; y < this.chunkSize; y += 2) {
                if (leftChunk.grid[y][this.chunkSize - 1] === 0) {
                    entrances.push({ x: 0, y: y });
                }
            }
        }

        // Check Right (1, 0) -> Neighbor Left Row (x=0)
        const rightKey = `${cx + 1},${cy}`;
        if (this.chunks.has(rightKey)) {
            const rightChunk = this.chunks.get(rightKey);
            for (let y = 1; y < this.chunkSize; y += 2) {
                if (rightChunk.grid[y][0] === 0) {
                    entrances.push({ x: this.chunkSize - 1, y: y });
                }
            }
        }

        return entrances;
    }

    getUnvisitedNeighbors(x, y, chunk, visited) {
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

            // Stay within chunk bounds (padding of 1 usually kept for walls, but we might carve edges)
            // We want to keep edges as walls UNLESS we specifically carve an exit.
            // So standard generation keeps 1 cell buffer.
            if (nx > 0 && nx < this.chunkSize - 1 && ny > 0 && ny < this.chunkSize - 1) {
                if (!visited.has(`${nx},${ny}`)) {
                    neighbors.push({ x: nx, y: ny });
                }
            }
        }
        return neighbors;
    }

    createExits(chunk) {
        // Randomly add exits on edges to ensure infinite growth
        // Top
        if (!this.chunks.has(`${chunk.x},${chunk.y - 1}`)) {
            const x = 1 + 2 * Math.floor(Math.random() * ((this.chunkSize - 2) / 2));
            chunk.grid[0][x] = 0;
            chunk.grid[1][x] = 0; // ensure connection to inner maze
        }
        // Bottom
        if (!this.chunks.has(`${chunk.x},${chunk.y + 1}`)) {
            const x = 1 + 2 * Math.floor(Math.random() * ((this.chunkSize - 2) / 2));
            chunk.grid[this.chunkSize - 1][x] = 0;
            chunk.grid[this.chunkSize - 2][x] = 0;
        }
        // Left
        if (!this.chunks.has(`${chunk.x - 1},${chunk.y}`)) {
            const y = 1 + 2 * Math.floor(Math.random() * ((this.chunkSize - 2) / 2));
            chunk.grid[y][0] = 0;
            chunk.grid[y][1] = 0;
        }
        // Right
        if (!this.chunks.has(`${chunk.x + 1},${chunk.y}`)) {
            const y = 1 + 2 * Math.floor(Math.random() * ((this.chunkSize - 2) / 2));
            chunk.grid[y][this.chunkSize - 1] = 0;
            chunk.grid[y][this.chunkSize - 2] = 0;
        }
    }

    spawnCollectibles(chunk) {
        for (let y = 1; y < this.chunkSize - 1; y++) {
            for (let x = 1; x < this.chunkSize - 1; x++) {
                if (chunk.grid[y][x] === 0) {
                    if (Math.random() < 0.05) { // 5% chance
                        chunk.collectibles.push({
                            // Store world coords for easier collision
                            ...chunk.toWorld(x, y),
                            // Also store local mainly for rendering if needed, 
                            // but world is better for game logic
                            localX: x, localY: y
                        });
                    }
                }
            }
        }
    }
}

class MazeGame {
    constructor() {
        this.canvas = document.getElementById('mazeCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.scoreElement = document.getElementById('score');
        this.timerElement = document.getElementById('timer');

        this.cellSize = 25; // Visual size in pixels
        this.world = new MazeWorld(21); // Size 21 makes (2n+1) logic easier for walls

        // Player starts in middle of first chunk
        const startVal = Math.floor(this.world.chunkSize / 2);
        this.player = { x: startVal, y: startVal }; // World Coordinates (Grid Units)

        this.camera = {
            x: 0,
            y: 0
        };

        this.score = 0;
        this.startTime = Date.now();
        this.explored = new Set(); // Stores "x,y" of world visited

        this.keys = {};

        // Audio context
        this.audioCtx = null;

        this.particles = [];

        this.moveHistory = [];
        this.autoMode = false;
        this.lastMoveTime = 0;
        this.moveDelay = 100;
        this.lastDirection = null;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.startGameLoop();
        this.initAudio();
    }

    initAudio() {
        // Init on first interaction usually, but let's try
        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (!this.keys[e.key]) {
                this.keys[e.key] = true;
                this.handleInput(e.key);
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });

        const autoButton = document.getElementById('autoButton');
        autoButton.addEventListener('click', () => {
            this.toggleAutoMode();
        });

        // Touch controls
        this.setupTouchControls();
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

    findBestDirection() {
        const directions = [
            { x: 0, y: -1, name: 'up' },    // up
            { x: 1, y: 0, name: 'right' },  // right
            { x: 0, y: 1, name: 'down' },  // down
            { x: -1, y: 0, name: 'left' }  // left
        ];

        let bestDirection = null;
        let bestScore = -Infinity;

        for (const dir of directions) {
            const newX = this.player.x + dir.x;
            const newY = this.player.y + dir.y;

            // Check walls using World coordinates
            if (this.world.isWall(newX, newY)) {
                continue;
            }

            let score = 0;

            // Base score (valid move)
            score += 10;

            // 1. Prefer unvisited nodes (Exploration)
            if (!this.explored.has(`${newX},${newY}`)) {
                score += 50;
            }

            // 2. Penalize recently visited (Anti-loop)
            // We need a history structure. Let's add it if missing or reuse 'explored' carefully?
            // "explored" is permanent. We need "recentMoves".
            // Let's check this.moveHistory
            if (this.moveHistory) {
                const recentVisits = this.moveHistory.filter(m => m.x === newX && m.y === newY).length;
                score -= recentVisits * 20;
            }

            // 3. Momentum (keep going same way)
            if (this.lastDirection) {
                if (dir.x === this.lastDirection.x && dir.y === this.lastDirection.y) {
                    score += 5;
                }
            }

            // 4. Collectibles Helper
            // Check if any collectible is visible in this direction
            // (Simplified: just check immediate surroundings or chunks?)
            // For now, simple greedy: if next tile has coin, HUGE bonus
            // We'd need to check chunk for specific coin at newX, newY
            if (this.hasCollectibleAt(newX, newY)) {
                score += 100;
            }

            if (score > bestScore) {
                bestScore = score;
                bestDirection = dir;
            }
        }

        return bestDirection;
    }

    hasCollectibleAt(x, y) {
        const cx = Math.floor(x / this.world.chunkSize);
        const cy = Math.floor(y / this.world.chunkSize);
        const chunk = this.world.getChunk(cx, cy);
        return chunk.collectibles.some(c => c.x === x && c.y === y);
    }

    setupTouchControls() {
        // Reuse existing button logic but call handleInput directly
        const bindBtn = (id, key) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const trigger = (e) => {
                e.preventDefault();
                this.handleInput(key);
            };
            btn.addEventListener('touchstart', trigger, { passive: false });
            btn.addEventListener('mousedown', trigger);
        };

        bindBtn('upBtn', 'ArrowUp');
        bindBtn('downBtn', 'ArrowDown');
        bindBtn('leftBtn', 'ArrowLeft');
        bindBtn('rightBtn', 'ArrowRight');
    }

    handleInput(key) {
        // Resume audio if suspended (browser policy)
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        let newX = this.player.x;
        let newY = this.player.y;

        if (key === 'ArrowUp' || key === 'w' || key === 'W') newY--;
        if (key === 'ArrowDown' || key === 's' || key === 'S') newY++;
        if (key === 'ArrowLeft' || key === 'a' || key === 'A') newX--;
        if (key === 'ArrowRight' || key === 'd' || key === 'D') newX++;

        // Collision Check
        if (!this.world.isWall(newX, newY)) {
            // Track direction for momentum
            this.lastDirection = { x: newX - this.player.x, y: newY - this.player.y };

            this.player.x = newX;
            this.player.y = newY;
            this.explored.add(`${newX},${newY}`);

            // Track history (keep last 50 moves)
            this.moveHistory.push({ x: newX, y: newY });
            if (this.moveHistory.length > 50) this.moveHistory.shift();

            this.checkCollectibles();
            this.playMoveSound();
        }
    }

    checkCollectibles() {
        // Find which chunk we are in
        const cx = Math.floor(this.player.x / this.world.chunkSize);
        const cy = Math.floor(this.player.y / this.world.chunkSize);
        const chunk = this.world.getChunk(cx, cy);

        // Filter out collected
        const originalLen = chunk.collectibles.length;
        chunk.collectibles = chunk.collectibles.filter(c => {
            return !(c.x === this.player.x && c.y === this.player.y);
        });

        if (chunk.collectibles.length < originalLen) {
            this.score += 10;
            this.scoreElement.textContent = this.score;
            this.playCollectSound();

            // Spawn particles
            for (let i = 0; i < 10; i++) {
                this.particles.push(new Particle(
                    this.player.x * this.cellSize + this.cellSize / 2,
                    this.player.y * this.cellSize + this.cellSize / 2,
                    '#ffd700'
                ));
            }
        }
    }

    update() {
        // Auto Explore Logic
        if (this.autoMode) {
            const now = Date.now();
            if (now - this.lastMoveTime > this.moveDelay) {
                const bestDir = this.findBestDirection();
                if (bestDir) {
                    this.handleInput(bestDir.name);
                    this.lastMoveTime = now;
                }
            }
        }

        // Update Camera to follow player smoothly or locked
        // Target camera position (centered on player)
        const targetCamX = this.player.x * this.cellSize - this.canvas.width / 2 + this.cellSize / 2;
        const targetCamY = this.player.y * this.cellSize - this.canvas.height / 2 + this.cellSize / 2;

        // Simple lerp for smoothness
        this.camera.x += (targetCamX - this.camera.x) * 0.1;
        this.camera.y += (targetCamY - this.camera.y) * 0.1;

        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update();
            if (this.particles[i].life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        this.updateTimer();
    }

    updateTimer() {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        this.timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    render() {
        // clear with dark background
        this.ctx.fillStyle = '#0f3460';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Determine visible world bounds
        const startWX = Math.floor(this.camera.x / this.cellSize);
        const startWY = Math.floor(this.camera.y / this.cellSize);
        // Add a bit of buffer
        const numCols = Math.ceil(this.canvas.width / this.cellSize) + 1;
        const numRows = Math.ceil(this.canvas.height / this.cellSize) + 1;

        for (let wy = startWY; wy <= startWY + numRows; wy++) {
            for (let wx = startWX; wx <= startWX + numCols; wx++) {
                // Determine chunk
                const isWall = this.world.isWall(wx, wy);

                // Screen coordinates
                const sx = Math.floor(wx * this.cellSize - this.camera.x);
                const sy = Math.floor(wy * this.cellSize - this.camera.y);

                // Check visibility (fog of war) or just render all? 
                // Let's implement Fog of War: only visible if in explored set OR within radius
                const isExplored = this.explored.has(`${wx},${wy}`);
                const dist = Math.sqrt(Math.pow(wx - this.player.x, 2) + Math.pow(wy - this.player.y, 2));
                const isVisible = dist < 8; // Vision radius

                if (isVisible || isExplored) {
                    if (isWall) {
                        this.ctx.fillStyle = isVisible ? '#16213e' : '#050510'; // Darker if not currently visible
                        this.ctx.fillRect(sx, sy, this.cellSize, this.cellSize);
                        // Add 3D effect / highlight
                        if (isVisible) {
                            this.ctx.fillStyle = 'rgba(255,255,255,0.05)';
                            this.ctx.fillRect(sx, sy, this.cellSize, 2); // Top highlight
                        }
                    } else {
                        // Path
                        this.ctx.fillStyle = isVisible ? '#444' : '#222';
                        // Floor texture? Simple rect for now
                        this.ctx.fillRect(sx, sy, this.cellSize, this.cellSize);
                    }
                } else {
                    // Unexplored area (black)
                    // Do nothing
                }

                // Render collectible if present at this location
                if (isVisible) { // Only show collectibles if currently visible
                    // We need to check if this tile has a collectible. 
                    // Accessing efficiently directly from world? 
                    // Iterating chunks might be faster if we have many tiles.
                    // Let's do a quick lookup helper or just iterate chunks in view?
                    // Given the loop structure, let's optimize:
                    // Actually, let's render collectibles separately by iterating visible CHUNKS to avoid per-tile check.
                }
            }
        }

        // Render Collectibles (Pass 2)
        // Find visible chunks based on view
        const startCX = Math.floor(startWX / this.world.chunkSize);
        const startCY = Math.floor(startWY / this.world.chunkSize);
        const endCX = Math.floor((startWX + numCols) / this.world.chunkSize);
        const endCY = Math.floor((startWY + numRows) / this.world.chunkSize);

        for (let cy = startCY; cy <= endCY; cy++) {
            for (let cx = startCX; cx <= endCX; cx++) {
                const chunk = this.world.getChunk(cx, cy);
                for (const c of chunk.collectibles) {
                    // Check vision
                    const dist = Math.sqrt(Math.pow(c.x - this.player.x, 2) + Math.pow(c.y - this.player.y, 2));
                    if (dist < 8) {
                        const sx = c.x * this.cellSize - this.camera.x;
                        const sy = c.y * this.cellSize - this.camera.y;

                        // Draw Coin
                        this.ctx.beginPath();
                        this.ctx.arc(sx + this.cellSize / 2, sy + this.cellSize / 2, this.cellSize / 4, 0, Math.PI * 2);
                        this.ctx.fillStyle = '#ffd700';
                        this.ctx.fill();
                        this.ctx.strokeStyle = '#eca500';
                        this.ctx.lineWidth = 2;
                        this.ctx.stroke();

                        // Sparkle (random)
                        if (Math.random() < 0.1) {
                            this.ctx.fillStyle = '#fff';
                            this.ctx.fillRect(sx + Math.random() * this.cellSize, sy + Math.random() * this.cellSize, 2, 2);
                        }
                    }
                }
            }
        }

        // Render Player
        const pSx = this.player.x * this.cellSize - this.camera.x;
        const pSy = this.player.y * this.cellSize - this.camera.y;

        // Glow
        const grad = this.ctx.createRadialGradient(
            pSx + this.cellSize / 2, pSy + this.cellSize / 2, this.cellSize / 4,
            pSx + this.cellSize / 2, pSy + this.cellSize / 2, this.cellSize * 2
        );
        grad.addColorStop(0, 'rgba(233, 69, 96, 0.4)');
        grad.addColorStop(1, 'rgba(233, 69, 96, 0)');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(pSx - this.cellSize, pSy - this.cellSize, this.cellSize * 3, this.cellSize * 3);

        this.ctx.fillStyle = '#e94560';
        // Draw square player for now
        this.ctx.fillRect(pSx + 4, pSy + 4, this.cellSize - 8, this.cellSize - 8);

        // 4. Render Particles
        this.particles.forEach(p => p.draw(this.ctx, this.camera.x, this.camera.y));
    }

    startGameLoop() {
        const loop = () => {
            this.update();
            this.render();
            this.gameLoop = requestAnimationFrame(loop);
        };
        loop();
    }

    // Audio Helpers
    playMoveSound() {
        this.playTone(300, 'square', 0.05);
    }

    playCollectSound() {
        this.playTone(600, 'sine', 0.1);
        setTimeout(() => this.playTone(900, 'sine', 0.2), 100);
    }

    playTone(freq, type, duration) {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.frequency.value = freq;
        osc.type = type;
        gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);
        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
    }
}

// Basic Particle System
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 3 + 1;
        this.speedX = (Math.random() - 0.5) * 2;
        this.speedY = (Math.random() - 0.5) * 2;
        this.life = 1.0;
        this.decay = Math.random() * 0.05 + 0.02;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= this.decay;
    }

    draw(ctx, camX, camY) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - camX, this.y - camY, this.size, this.size);
        ctx.globalAlpha = 1.0;
    }
}

// Start
document.addEventListener('DOMContentLoaded', () => {
    new MazeGame();
});
