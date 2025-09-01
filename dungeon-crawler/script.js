// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const TILE_SIZE = 20;
const CHUNK_SIZE = 20; // Size of each chunk in tiles
const RENDER_DISTANCE = 2; // How many chunks to render around player

// Game variables
let canvas, ctx;
let chunks = {}; // Store generated chunks
let player = { x: 0, y: 0, health: 100, gold: 0, level: 1 };
let camera = { x: 0, y: 0 };
let enemies = [];
let treasures = [];
let traps = [];
let messageLog = [];
let gameRunning = false;

// Initialize game
function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    // Event listeners
    document.addEventListener('keydown', handleKeyPress);
    document.getElementById('new-game').addEventListener('click', startNewGame);
    document.getElementById('restart').addEventListener('click', startNewGame);

    startNewGame();
}

// Start a new game
function startNewGame() {
    gameRunning = true;
    chunks = {};
    enemies = [];
    treasures = [];
    traps = [];
    messageLog = [];

    // Generate initial chunks around origin
    for (let chunkX = -RENDER_DISTANCE; chunkX <= RENDER_DISTANCE; chunkX++) {
        for (let chunkY = -RENDER_DISTANCE; chunkY <= RENDER_DISTANCE; chunkY++) {
            generateChunk(chunkX, chunkY);
        }
    }

    placePlayer();
    placeEntities();
    updateCamera();
    updateUI();
    addMessage("Welcome to the infinite dungeon! Use arrow keys to move.");
    gameLoop();
}

// Generate a chunk at the given coordinates
function generateChunk(chunkX, chunkY) {
    const chunkKey = `${chunkX},${chunkY}`;
    if (chunks[chunkKey]) return chunks[chunkKey];

    // Initialize chunk with walls
    const chunk = Array(CHUNK_SIZE).fill().map(() => Array(CHUNK_SIZE).fill(1));

    // Note: Using standard Math.random() for simplicity
    // Chunks will be randomly generated each time

    let rooms = [];

    // Create rooms using BSP
    function createRooms(container, depth = 0) {
        if (depth > 2 || container.width < 8 || container.height < 8) {
            // Create a room in this leaf
            const roomWidth = Math.max(4, container.width - 2);
            const roomHeight = Math.max(4, container.height - 2);
            const roomX = container.x + Math.floor((container.width - roomWidth) / 2);
            const roomY = container.y + Math.floor((container.height - roomHeight) / 2);

            const room = {
                x: roomX,
                y: roomY,
                width: roomWidth,
                height: roomHeight,
                centerX: roomX + Math.floor(roomWidth / 2),
                centerY: roomY + Math.floor(roomHeight / 2)
            };

            rooms.push(room);

            // Carve out the room
            for (let y = room.y; y < room.y + room.height; y++) {
                for (let x = room.x; x < room.x + room.width; x++) {
                    if (x >= 0 && x < CHUNK_SIZE && y >= 0 && y < CHUNK_SIZE) {
                        chunk[y][x] = 0;
                    }
                }
            }
            return;
        }

        const splitHorizontally = container.width > container.height;
        const splitRatio = 0.45 + Math.random() * 0.1; // Split between 45-55%

        if (splitHorizontally) {
            const splitX = Math.floor(container.x + container.width * splitRatio);
            createRooms({ x: container.x, y: container.y, width: splitX - container.x, height: container.height }, depth + 1);
            createRooms({ x: splitX, y: container.y, width: container.width - (splitX - container.x), height: container.height }, depth + 1);
        } else {
            const splitY = Math.floor(container.y + container.height * splitRatio);
            createRooms({ x: container.x, y: container.y, width: container.width, height: splitY - container.y }, depth + 1);
            createRooms({ x: container.x, y: splitY, width: container.width, height: container.height - (splitY - container.y) }, depth + 1);
        }
    }

    createRooms({ x: 0, y: 0, width: CHUNK_SIZE, height: CHUNK_SIZE });

    // Connect rooms with corridors
    for (let i = 1; i < rooms.length; i++) {
        const roomA = rooms[i - 1];
        const roomB = rooms[i];
        createCorridor(chunk, roomA.centerX, roomA.centerY, roomB.centerX, roomB.centerY);
    }

    // Add connection points to chunk edges for seamless travel
    addChunkConnections(chunk, chunkX, chunkY, rooms);

    chunks[chunkKey] = chunk;
    return chunk;
}

// Add connection points at chunk edges for seamless travel between chunks
function addChunkConnections(chunk, chunkX, chunkY, rooms) {
    // Create connection points on all four edges
    const connections = [];

    // Use chunk coordinates to create deterministic but varied connection patterns
    const seed = chunkX * 1000 + chunkY;

    // North edge (top)
    for (let x = 2; x < CHUNK_SIZE - 2; x += 3) {
        // Create connections based on chunk coordinates for consistency
        if ((chunkX + chunkY + x) % 4 === 0) {
            connections.push({ x: x, y: 0, direction: 'north' });
            // Create a small corridor extending inward
            for (let y = 0; y < 3; y++) {
                if (y < CHUNK_SIZE) chunk[y][x] = 0;
            }
        }
    }

    // South edge (bottom)
    for (let x = 2; x < CHUNK_SIZE - 2; x += 3) {
        if ((chunkX + chunkY + x) % 4 === 1) {
            connections.push({ x: x, y: CHUNK_SIZE - 1, direction: 'south' });
            for (let y = CHUNK_SIZE - 3; y < CHUNK_SIZE; y++) {
                if (y >= 0) chunk[y][x] = 0;
            }
        }
    }

    // West edge (left)
    for (let y = 2; y < CHUNK_SIZE - 2; y += 3) {
        if ((chunkX + chunkY + y) % 4 === 2) {
            connections.push({ x: 0, y: y, direction: 'west' });
            for (let x = 0; x < 3; x++) {
                if (x < CHUNK_SIZE) chunk[y][x] = 0;
            }
        }
    }

    // East edge (right)
    for (let y = 2; y < CHUNK_SIZE - 2; y += 3) {
        if ((chunkX + chunkY + y) % 4 === 3) {
            connections.push({ x: CHUNK_SIZE - 1, y: y, direction: 'east' });
            for (let x = CHUNK_SIZE - 3; x < CHUNK_SIZE; x++) {
                if (x >= 0) chunk[y][x] = 0;
            }
        }
    }

    // Ensure at least some connections exist
    if (connections.length === 0) {
        // Force create connections on each edge
        const midX = Math.floor(CHUNK_SIZE / 2);
        const midY = Math.floor(CHUNK_SIZE / 2);

        connections.push({ x: midX, y: 0, direction: 'north' });
        for (let y = 0; y < 3; y++) {
            chunk[y][midX] = 0;
        }

        connections.push({ x: midX, y: CHUNK_SIZE - 1, direction: 'south' });
        for (let y = CHUNK_SIZE - 3; y < CHUNK_SIZE; y++) {
            chunk[y][midX] = 0;
        }

        connections.push({ x: 0, y: midY, direction: 'west' });
        for (let x = 0; x < 3; x++) {
            chunk[midY][x] = 0;
        }

        connections.push({ x: CHUNK_SIZE - 1, y: midY, direction: 'east' });
        for (let x = CHUNK_SIZE - 3; x < CHUNK_SIZE; x++) {
            chunk[midY][x] = 0;
        }
    }

    // Connect edge connections to nearby rooms
    connections.forEach(conn => {
        // Find the nearest room and connect to it
        let nearestRoom = null;
        let minDistance = Infinity;

        rooms.forEach(room => {
            const distance = Math.abs(conn.x - room.centerX) + Math.abs(conn.y - room.centerY);
            if (distance < minDistance) {
                minDistance = distance;
                nearestRoom = room;
            }
        });

        if (nearestRoom) {
            createCorridor(chunk, conn.x, conn.y, nearestRoom.centerX, nearestRoom.centerY);
        }
    });
}

// Create L-shaped corridor between two points in a chunk
function createCorridor(chunk, x1, y1, x2, y2) {
    const horizontalFirst = Math.random() < 0.5;

    if (horizontalFirst) {
        // Horizontal corridor
        const startX = Math.min(x1, x2);
        const endX = Math.max(x1, x2);
        for (let x = startX; x <= endX; x++) {
            if (x >= 0 && x < CHUNK_SIZE && y1 >= 0 && y1 < CHUNK_SIZE) {
                chunk[y1][x] = 0;
            }
        }
        // Vertical corridor
        const startY = Math.min(y1, y2);
        const endY = Math.max(y1, y2);
        for (let y = startY; y <= endY; y++) {
            if (x2 >= 0 && x2 < CHUNK_SIZE && y >= 0 && y < CHUNK_SIZE) {
                chunk[y][x2] = 0;
            }
        }
    } else {
        // Vertical corridor first
        const startY = Math.min(y1, y2);
        const endY = Math.max(y1, y2);
        for (let y = startY; y <= endY; y++) {
            if (x1 >= 0 && x1 < CHUNK_SIZE && y >= 0 && y < CHUNK_SIZE) {
                chunk[y][x1] = 0;
            }
        }
        // Horizontal corridor
        const startX = Math.min(x1, x2);
        const endX = Math.max(x1, x2);
        for (let x = startX; x <= endX; x++) {
            if (x >= 0 && x < CHUNK_SIZE && y2 >= 0 && y2 < CHUNK_SIZE) {
                chunk[y2][x] = 0;
            }
        }
    }
}

// Seeded random number generator for consistent chunk generation
function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

// Place player on a valid floor tile
function placePlayer() {
    // Generate the starting chunk first
    const startChunk = generateChunk(0, 0);

    // Find a valid starting position in the chunk
    // Try multiple approaches to ensure we find a floor tile

    // First, try to find a position in the center area
    for (let y = 5; y < CHUNK_SIZE - 5; y++) {
        for (let x = 5; x < CHUNK_SIZE - 5; x++) {
            if (startChunk[y][x] === 0) {
                player = { x: x, y: y, health: 100, gold: 0, level: 1 };
                return;
            }
        }
    }

    // If center doesn't work, try the entire chunk
    for (let y = 1; y < CHUNK_SIZE - 1; y++) {
        for (let x = 1; x < CHUNK_SIZE - 1; x++) {
            if (startChunk[y][x] === 0) {
                player = { x: x, y: y, health: 100, gold: 0, level: 1 };
                return;
            }
        }
    }

    // Last resort: force create a floor tile at the center
    const centerX = Math.floor(CHUNK_SIZE / 2);
    const centerY = Math.floor(CHUNK_SIZE / 2);
    startChunk[centerY][centerX] = 0;
    player = { x: centerX, y: centerY, health: 100, gold: 0, level: 1 };
}

// Update camera to follow player
function updateCamera() {
    camera.x = player.x * TILE_SIZE - CANVAS_WIDTH / 2;
    camera.y = player.y * TILE_SIZE - CANVAS_HEIGHT / 2;
}

// Get tile at world coordinates
function getTile(worldX, worldY) {
    const chunkX = Math.floor(worldX / CHUNK_SIZE);
    const chunkY = Math.floor(worldY / CHUNK_SIZE);
    const localX = worldX - chunkX * CHUNK_SIZE;
    const localY = worldY - chunkY * CHUNK_SIZE;

    const chunk = generateChunk(chunkX, chunkY);
    return chunk[localY][localX];
}

// Place entities (treasures, traps, enemies)
function placeEntities() {
    treasures = [];
    traps = [];
    enemies = [];

    // Place treasures in nearby chunks
    for (let i = 0; i < 20; i++) {
        let x, y;
        do {
            x = player.x + Math.floor(Math.random() * 40) - 20;
            y = player.y + Math.floor(Math.random() * 40) - 20;
        } while (getTile(x, y) !== 0 || (x === player.x && y === player.y));
        treasures.push({ x, y, collected: false });
    }

    // Place traps in nearby chunks
    for (let i = 0; i < 30; i++) {
        let x, y;
        do {
            x = player.x + Math.floor(Math.random() * 40) - 20;
            y = player.y + Math.floor(Math.random() * 40) - 20;
        } while (getTile(x, y) !== 0 || (x === player.x && y === player.y));
        traps.push({ x, y, triggered: false });
    }

    // Place enemies in nearby chunks
    for (let i = 0; i < 10; i++) {
        let x, y;
        do {
            x = player.x + Math.floor(Math.random() * 40) - 20;
            y = player.y + Math.floor(Math.random() * 40) - 20;
        } while (getTile(x, y) !== 0 || (x === player.x && y === player.y));
        enemies.push({ x, y, health: 20 + Math.floor(Math.random() * 20), attack: 5 + Math.floor(Math.random() * 5) });
    }
}

// Handle keyboard input
function handleKeyPress(event) {
    if (!gameRunning) return;

    let newX = player.x;
    let newY = player.y;

    switch (event.key) {
        case 'ArrowUp':
            newY--;
            break;
        case 'ArrowDown':
            newY++;
            break;
        case 'ArrowLeft':
            newX--;
            break;
        case 'ArrowRight':
            newX++;
            break;
        default:
            return;
    }

    if (getTile(newX, newY) === 0) {
        player.x = newX;
        player.y = newY;
        updateCamera();
        checkCollisions();
        moveEnemies();
        updateUI();
    }
}

// Check for collisions with entities
function checkCollisions() {
    // Check treasures
    treasures.forEach((treasure, index) => {
        if (treasure.x === player.x && treasure.y === player.y && !treasure.collected) {
            treasure.collected = true;
            player.gold += 10 + Math.floor(Math.random() * 20);
            addMessage(`You found ${player.gold} gold!`);
        }
    });

    // Check traps
    traps.forEach((trap, index) => {
        if (trap.x === player.x && trap.y === player.y && !trap.triggered) {
            trap.triggered = true;
            const damage = 10 + Math.floor(Math.random() * 15);
            player.health -= damage;
            addMessage(`You stepped on a trap! Took ${damage} damage.`);
            if (player.health <= 0) {
                gameOver();
            }
        }
    });

    // Check enemies
    enemies.forEach((enemy, index) => {
        if (enemy.x === player.x && enemy.y === player.y) {
            startCombat(enemy, index);
        }
    });
}

// Move enemies randomly
function moveEnemies() {
    enemies.forEach(enemy => {
        const directions = [
            { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }
        ];
        const direction = directions[Math.floor(Math.random() * directions.length)];
        const newX = enemy.x + direction.x;
        const newY = enemy.y + direction.y;

        if (getTile(newX, newY) === 0) {
            enemy.x = newX;
            enemy.y = newY;
        }
    });
}

// Start combat with enemy
function startCombat(enemy, enemyIndex) {
    gameRunning = false;
    addMessage(`You encountered an enemy! Health: ${enemy.health}, Attack: ${enemy.attack}`);

    // Simple turn-based combat
    const playerAttack = 10 + Math.floor(Math.random() * 10);
    enemy.health -= playerAttack;
    addMessage(`You attack for ${playerAttack} damage!`);

    if (enemy.health <= 0) {
        addMessage("You defeated the enemy!");
        enemies.splice(enemyIndex, 1);
        player.gold += 5 + Math.floor(Math.random() * 10);
        gameRunning = true;
        return;
    }

    const enemyAttack = enemy.attack;
    player.health -= enemyAttack;
    addMessage(`Enemy attacks for ${enemyAttack} damage!`);

    if (player.health <= 0) {
        gameOver();
    } else {
        gameRunning = true;
    }
}

// Game over
function gameOver() {
    gameRunning = false;
    addMessage("Game Over! You died.");
}

// Add message to log
function addMessage(message) {
    messageLog.unshift(message);
    if (messageLog.length > 10) {
        messageLog.pop();
    }
    updateMessageLog();
}

// Update UI
function updateUI() {
    document.getElementById('health').textContent = player.health;
    document.getElementById('gold').textContent = player.gold;
    document.getElementById('level').textContent = player.level;
}

// Update message log display
function updateMessageLog() {
    const messageLogElement = document.getElementById('message-log');
    messageLogElement.innerHTML = messageLog.map(msg => `<div>${msg}</div>`).join('');
}

// Render game
function render() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Calculate visible chunks
    const startChunkX = Math.floor(camera.x / (CHUNK_SIZE * TILE_SIZE)) - 1;
    const endChunkX = Math.floor((camera.x + CANVAS_WIDTH) / (CHUNK_SIZE * TILE_SIZE)) + 1;
    const startChunkY = Math.floor(camera.y / (CHUNK_SIZE * TILE_SIZE)) - 1;
    const endChunkY = Math.floor((camera.y + CANVAS_HEIGHT) / (CHUNK_SIZE * TILE_SIZE)) + 1;

    // Render visible chunks
    for (let chunkY = startChunkY; chunkY <= endChunkY; chunkY++) {
        for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX++) {
            const chunk = generateChunk(chunkX, chunkY);

            // Calculate screen position for this chunk
            const screenX = chunkX * CHUNK_SIZE * TILE_SIZE - camera.x;
            const screenY = chunkY * CHUNK_SIZE * TILE_SIZE - camera.y;

            // Render chunk tiles
            for (let y = 0; y < CHUNK_SIZE; y++) {
                for (let x = 0; x < CHUNK_SIZE; x++) {
                    const tileX = screenX + x * TILE_SIZE;
                    const tileY = screenY + y * TILE_SIZE;

                    // Only render if tile is visible on screen
                    if (tileX > -TILE_SIZE && tileX < CANVAS_WIDTH && tileY > -TILE_SIZE && tileY < CANVAS_HEIGHT) {
                        if (chunk[y][x] === 1) {
                            ctx.fillStyle = '#333';
                        } else {
                            ctx.fillStyle = '#111';
                        }
                        ctx.fillRect(tileX, tileY, TILE_SIZE, TILE_SIZE);
                    }
                }
            }
        }
    }

    // Render treasures
    treasures.forEach(treasure => {
        if (!treasure.collected) {
            const screenX = treasure.x * TILE_SIZE - camera.x;
            const screenY = treasure.y * TILE_SIZE - camera.y;
            if (screenX > -TILE_SIZE && screenX < CANVAS_WIDTH && screenY > -TILE_SIZE && screenY < CANVAS_HEIGHT) {
                ctx.fillStyle = '#ffd700';
                ctx.fillRect(screenX + 5, screenY + 5, TILE_SIZE - 10, TILE_SIZE - 10);
            }
        }
    });

    // Render traps
    traps.forEach(trap => {
        if (!trap.triggered) {
            const screenX = trap.x * TILE_SIZE - camera.x;
            const screenY = trap.y * TILE_SIZE - camera.y;
            if (screenX > -TILE_SIZE && screenX < CANVAS_WIDTH && screenY > -TILE_SIZE && screenY < CANVAS_HEIGHT) {
                ctx.fillStyle = '#8b0000';
                ctx.fillRect(screenX + 8, screenY + 8, TILE_SIZE - 16, TILE_SIZE - 16);
            }
        }
    });

    // Render enemies
    enemies.forEach(enemy => {
        const screenX = enemy.x * TILE_SIZE - camera.x;
        const screenY = enemy.y * TILE_SIZE - camera.y;
        if (screenX > -TILE_SIZE && screenX < CANVAS_WIDTH && screenY > -TILE_SIZE && screenY < CANVAS_HEIGHT) {
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(screenX + 3, screenY + 3, TILE_SIZE - 6, TILE_SIZE - 6);
        }
    });

    // Render player (always centered on screen)
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(CANVAS_WIDTH / 2 - TILE_SIZE / 2 + 2, CANVAS_HEIGHT / 2 - TILE_SIZE / 2 + 2, TILE_SIZE - 4, TILE_SIZE - 4);

    // Add subtle lighting effect centered on player
    const gradient = ctx.createRadialGradient(
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0,
        CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 200
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.8, 'rgba(0, 0, 0, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

// Game loop
function gameLoop() {
    if (gameRunning) {
        render();
        requestAnimationFrame(gameLoop);
    }
}

// Start the game
init();
