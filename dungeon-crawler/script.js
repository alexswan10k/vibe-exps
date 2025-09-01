// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const TILE_SIZE = 20;
const MAP_WIDTH = CANVAS_WIDTH / TILE_SIZE;
const MAP_HEIGHT = CANVAS_HEIGHT / TILE_SIZE;

// Game variables
let canvas, ctx;
let gameMap = [];
let player = { x: 1, y: 1, health: 100, gold: 0, level: 1 };
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
    enemies = [];
    treasures = [];
    traps = [];
    messageLog = [];

    generateDungeon();
    placePlayer();
    placeEntities();
    updateUI();
    addMessage("Welcome to the dungeon! Use arrow keys to move.");
    gameLoop();
}

// Binary Space Partitioning for dungeon generation
function generateDungeon() {
    gameMap = Array(MAP_HEIGHT).fill().map(() => Array(MAP_WIDTH).fill(1)); // 1 = wall, 0 = floor

    let rooms = [];

    // Create rooms using BSP
    function createRooms(container, depth = 0) {
        if (depth > 3 || container.width < 12 || container.height < 12) {
            // Create a room in this leaf
            const roomWidth = Math.max(6, container.width - 4);
            const roomHeight = Math.max(6, container.height - 4);
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
                    if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
                        gameMap[y][x] = 0;
                    }
                }
            }
            return;
        }

        const splitHorizontally = container.width > container.height;
        const splitRatio = 0.4 + Math.random() * 0.2; // Split between 40-60%

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

    createRooms({ x: 0, y: 0, width: MAP_WIDTH, height: MAP_HEIGHT });

    // Connect rooms with corridors
    for (let i = 1; i < rooms.length; i++) {
        const roomA = rooms[i - 1];
        const roomB = rooms[i];

        // Create L-shaped corridor
        createCorridor(roomA.centerX, roomA.centerY, roomB.centerX, roomB.centerY);
    }
}

// Create L-shaped corridor between two points
function createCorridor(x1, y1, x2, y2) {
    // Horizontal then vertical, or vertical then horizontal
    const horizontalFirst = Math.random() < 0.5;

    if (horizontalFirst) {
        // Horizontal corridor
        const startX = Math.min(x1, x2);
        const endX = Math.max(x1, x2);
        for (let x = startX; x <= endX; x++) {
            if (x >= 0 && x < MAP_WIDTH && y1 >= 0 && y1 < MAP_HEIGHT) {
                gameMap[y1][x] = 0;
            }
        }
        // Vertical corridor
        const startY = Math.min(y1, y2);
        const endY = Math.max(y1, y2);
        for (let y = startY; y <= endY; y++) {
            if (x2 >= 0 && x2 < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
                gameMap[y][x2] = 0;
            }
        }
    } else {
        // Vertical corridor first
        const startY = Math.min(y1, y2);
        const endY = Math.max(y1, y2);
        for (let y = startY; y <= endY; y++) {
            if (x1 >= 0 && x1 < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
                gameMap[y][x1] = 0;
            }
        }
        // Horizontal corridor
        const startX = Math.min(x1, x2);
        const endX = Math.max(x1, x2);
        for (let x = startX; x <= endX; x++) {
            if (x >= 0 && x < MAP_WIDTH && y2 >= 0 && y2 < MAP_HEIGHT) {
                gameMap[y2][x] = 0;
            }
        }
    }
}

// Place player on a valid floor tile
function placePlayer() {
    player = { x: 1, y: 1, health: 100, gold: 0, level: 1 };

    // Find a valid starting position
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
        for (let x = 1; x < MAP_WIDTH - 1; x++) {
            if (gameMap[y][x] === 0) {
                player.x = x;
                player.y = y;
                return;
            }
        }
    }
}

// Place entities (treasures, traps, enemies)
function placeEntities() {
    treasures = [];
    traps = [];
    enemies = [];

    // Place treasures
    for (let i = 0; i < 10; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * MAP_WIDTH);
            y = Math.floor(Math.random() * MAP_HEIGHT);
        } while (gameMap[y][x] !== 0 || (x === player.x && y === player.y));
        treasures.push({ x, y, collected: false });
    }

    // Place traps
    for (let i = 0; i < 15; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * MAP_WIDTH);
            y = Math.floor(Math.random() * MAP_HEIGHT);
        } while (gameMap[y][x] !== 0 || (x === player.x && y === player.y));
        traps.push({ x, y, triggered: false });
    }

    // Place enemies
    for (let i = 0; i < 5; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * MAP_WIDTH);
            y = Math.floor(Math.random() * MAP_HEIGHT);
        } while (gameMap[y][x] !== 0 || (x === player.x && y === player.y));
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

    if (newX >= 0 && newX < MAP_WIDTH && newY >= 0 && newY < MAP_HEIGHT && gameMap[newY][newX] === 0) {
        player.x = newX;
        player.y = newY;
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

        if (newX >= 0 && newX < MAP_WIDTH && newY >= 0 && newY < MAP_HEIGHT && gameMap[newY][newX] === 0) {
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

    // Render map
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (gameMap[y][x] === 1) {
                ctx.fillStyle = '#333';
                ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            } else {
                ctx.fillStyle = '#111';
                ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
        }
    }

    // Render treasures
    treasures.forEach(treasure => {
        if (!treasure.collected) {
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(treasure.x * TILE_SIZE + 5, treasure.y * TILE_SIZE + 5, TILE_SIZE - 10, TILE_SIZE - 10);
        }
    });

    // Render traps
    traps.forEach(trap => {
        if (!trap.triggered) {
            ctx.fillStyle = '#8b0000';
            ctx.fillRect(trap.x * TILE_SIZE + 8, trap.y * TILE_SIZE + 8, TILE_SIZE - 16, TILE_SIZE - 16);
        }
    });

    // Render enemies
    enemies.forEach(enemy => {
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(enemy.x * TILE_SIZE + 3, enemy.y * TILE_SIZE + 3, TILE_SIZE - 6, TILE_SIZE - 6);
    });

    // Render player
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(player.x * TILE_SIZE + 2, player.y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);

    // Add lighting effect
    const gradient = ctx.createRadialGradient(
        player.x * TILE_SIZE + TILE_SIZE / 2, player.y * TILE_SIZE + TILE_SIZE / 2, 0,
        player.x * TILE_SIZE + TILE_SIZE / 2, player.y * TILE_SIZE + TILE_SIZE / 2, 150
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
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
