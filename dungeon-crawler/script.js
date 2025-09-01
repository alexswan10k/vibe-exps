// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const TILE_SIZE = 20;
const ROOM_SIZE = 8; // Size of each room in tiles
const CORRIDOR_LENGTH = 4; // Length of corridors between rooms
const GENERATION_DISTANCE = 3; // How many rooms ahead to generate

// Game variables
let canvas, ctx;
let rooms = {}; // Store generated rooms by coordinates
let player = { x: 0, y: 0, health: 100, gold: 0, level: 1 };
let camera = { x: 0, y: 0 };
let currentRoom = null; // Current room the player is in
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
    rooms = {};
    enemies = [];
    treasures = [];
    traps = [];
    messageLog = [];

    // Create the starting room
    createStartingRoom();

    placePlayer();
    placeEntities();
    updateCamera();
    updateUI();
    addMessage("Welcome to the infinite dungeon! Use arrow keys to move.");
    gameLoop();
}

// Create the starting room
function createStartingRoom() {
    const roomKey = '0,0';
    const room = {
        x: 0,
        y: 0,
        width: ROOM_SIZE,
        height: ROOM_SIZE,
        exits: [],
        parent: null,
        depth: 0,
        tiles: Array(ROOM_SIZE).fill().map(() => Array(ROOM_SIZE).fill(0))
    };

    // Generate random exits (1-4 exits)
    const numExits = Math.floor(Math.random() * 4) + 1;
    const directions = [
        { dx: 0, dy: -1, name: 'north' },
        { dx: 0, dy: 1, name: 'south' },
        { dx: -1, dy: 0, name: 'west' },
        { dx: 1, dy: 0, name: 'east' }
    ];

    // Shuffle directions and pick first numExits
    const shuffledDirections = [...directions].sort(() => Math.random() - 0.5);
    for (let i = 0; i < numExits; i++) {
        const dir = shuffledDirections[i];
        const exitX = dir.dx === 0 ? Math.floor(Math.random() * (ROOM_SIZE - 2)) + 1 : (dir.dx === -1 ? 0 : ROOM_SIZE - 1);
        const exitY = dir.dy === 0 ? Math.floor(Math.random() * (ROOM_SIZE - 2)) + 1 : (dir.dy === -1 ? 0 : ROOM_SIZE - 1);

        room.exits.push({
            x: exitX,
            y: exitY,
            direction: dir.name,
            connected: false,
            targetRoom: null
        });
    }

    rooms[roomKey] = room;
    currentRoom = room;
}

// Generate a room adjacent to an exit
function generateRoomAtExit(parentRoom, exitIndex) {
    const exit = parentRoom.exits[exitIndex];
    if (exit.connected) return;

    // Calculate exit world position
    const exitWorldX = parentRoom.x + exit.x;
    const exitWorldY = parentRoom.y + exit.y;

    // Generate room at a random position within a large radius (not just adjacent)
    const minDistance = ROOM_SIZE + CORRIDOR_LENGTH;
    const maxDistance = ROOM_SIZE * 3; // Allow rooms to be placed up to 3 room sizes away

    let attempts = 0;
    let newRoomX, newRoomY;

    do {
        // Generate random angle and distance
        const angle = Math.random() * Math.PI * 2; // Random direction
        const distance = minDistance + Math.random() * (maxDistance - minDistance);

        newRoomX = Math.round(exitWorldX + Math.cos(angle) * distance);
        newRoomY = Math.round(exitWorldY + Math.sin(angle) * distance);

        attempts++;
        if (attempts > 20) {
            // Give up after too many attempts
            exit.connected = true;
            return;
        }
    } while (checkRoomOverlap(newRoomX, newRoomY));

    // Check if room already exists at this position
    const roomKey = `${newRoomX},${newRoomY}`;
    if (rooms[roomKey]) {
        // Connect to existing room
        connectRooms(parentRoom, rooms[roomKey], exit);
        return;
    }

    // Create new room
    const newRoom = {
        x: newRoomX,
        y: newRoomY,
        width: ROOM_SIZE,
        height: ROOM_SIZE,
        exits: [],
        parent: parentRoom,
        depth: parentRoom.depth + 1,
        tiles: Array(ROOM_SIZE).fill().map(() => Array(ROOM_SIZE).fill(0))
    };

    // Generate exits for new room (but avoid the direction we came from)
    const oppositeDirection = getOppositeDirection(exit.direction);
    generateRoomExits(newRoom, oppositeDirection);

    // Connect the rooms with a corridor
    connectRooms(parentRoom, newRoom, exit);

    // Store the room
    rooms[roomKey] = newRoom;

    // Spawn some entities in the new room
    spawnEntitiesInRoom(newRoom);

    // If player is close, generate more rooms ahead
    if (newRoom.depth < GENERATION_DISTANCE) {
        generateRoomsAhead(newRoom);
    }
}

// Generate exits for a room, avoiding a specific direction
function generateRoomExits(room, avoidDirection = null) {
    const directions = [
        { dx: 0, dy: -1, name: 'north' },
        { dx: 0, dy: 1, name: 'south' },
        { dx: -1, dy: 0, name: 'west' },
        { dx: 1, dy: 0, name: 'east' }
    ];

    // Filter out the direction we came from
    const availableDirections = directions.filter(dir => dir.name !== avoidDirection);

    // Generate 1-3 exits from available directions
    const numExits = Math.floor(Math.random() * 3) + 1;
    const shuffledDirections = [...availableDirections].sort(() => Math.random() - 0.5);

    for (let i = 0; i < Math.min(numExits, shuffledDirections.length); i++) {
        const dir = shuffledDirections[i];
        const exitX = dir.dx === 0 ? Math.floor(Math.random() * (ROOM_SIZE - 2)) + 1 : (dir.dx === -1 ? 0 : ROOM_SIZE - 1);
        const exitY = dir.dy === 0 ? Math.floor(Math.random() * (ROOM_SIZE - 2)) + 1 : (dir.dy === -1 ? 0 : ROOM_SIZE - 1);

        room.exits.push({
            x: exitX,
            y: exitY,
            direction: dir.name,
            connected: false,
            targetRoom: null
        });
    }

    // Ensure at least one exit if this is a dead end (depth > 2)
    if (room.exits.length === 0 && room.depth > 2) {
        const randomDir = availableDirections[Math.floor(Math.random() * availableDirections.length)];
        const exitX = randomDir.dx === 0 ? Math.floor(Math.random() * (ROOM_SIZE - 2)) + 1 : (randomDir.dx === -1 ? 0 : ROOM_SIZE - 1);
        const exitY = randomDir.dy === 0 ? Math.floor(Math.random() * (ROOM_SIZE - 2)) + 1 : (randomDir.dy === -1 ? 0 : ROOM_SIZE - 1);

        room.exits.push({
            x: exitX,
            y: exitY,
            direction: randomDir.name,
            connected: false,
            targetRoom: null
        });
    }
}

// Get the opposite direction
function getOppositeDirection(direction) {
    switch (direction) {
        case 'north': return 'south';
        case 'south': return 'north';
        case 'west': return 'east';
        case 'east': return 'west';
    }
    return null;
}

// Check if a room would overlap with existing rooms
function checkRoomOverlap(roomX, roomY) {
    const checkArea = ROOM_SIZE + 2; // Add some buffer

    for (const roomKey in rooms) {
        const existingRoom = rooms[roomKey];
        const dx = Math.abs((roomX + ROOM_SIZE / 2) - (existingRoom.x + ROOM_SIZE / 2));
        const dy = Math.abs((roomY + ROOM_SIZE / 2) - (existingRoom.y + ROOM_SIZE / 2));

        if (dx < checkArea && dy < checkArea) {
            return true; // Overlap detected
        }
    }
    return false;
}

// Connect two rooms with a corridor
function connectRooms(roomA, roomB, exit) {
    // Create corridor between the exit and the corresponding entrance in roomB
    const corridorStartX = roomA.x + exit.x;
    const corridorStartY = roomA.y + exit.y;

    // Find the corresponding entrance in roomB
    let corridorEndX, corridorEndY;
    switch (exit.direction) {
        case 'north':
            corridorEndX = roomB.x + Math.floor(ROOM_SIZE / 2);
            corridorEndY = roomB.y + ROOM_SIZE - 1;
            break;
        case 'south':
            corridorEndX = roomB.x + Math.floor(ROOM_SIZE / 2);
            corridorEndY = roomB.y;
            break;
        case 'west':
            corridorEndX = roomB.x + ROOM_SIZE - 1;
            corridorEndY = roomB.y + Math.floor(ROOM_SIZE / 2);
            break;
        case 'east':
            corridorEndX = roomB.x;
            corridorEndY = roomB.y + Math.floor(ROOM_SIZE / 2);
            break;
    }

    // Create the corridor
    createCorridorBetweenPoints(corridorStartX, corridorStartY, corridorEndX, corridorEndY);

    // Mark the exit as connected
    exit.connected = true;
    exit.targetRoom = roomB;
}

// Create a corridor between two world points
function createCorridorBetweenPoints(startX, startY, endX, endY) {
    const dx = Math.abs(endX - startX);
    const dy = Math.abs(endY - startY);

    if (dx > dy) {
        // Horizontal-first corridor
        const stepX = startX < endX ? 1 : -1;
        const stepY = startY < endY ? 1 : -1;

        for (let x = startX; x !== endX + stepX; x += stepX) {
            setCorridorTile(x, startY, 0);
        }
        for (let y = startY; y !== endY + stepY; y += stepY) {
            setCorridorTile(endX, y, 0);
        }
    } else {
        // Vertical-first corridor
        const stepX = startX < endX ? 1 : -1;
        const stepY = startY < endY ? 1 : -1;

        for (let y = startY; y !== endY + stepY; y += stepY) {
            setCorridorTile(startX, y, 0);
        }
        for (let x = startX; x !== endX + stepX; x += stepX) {
            setCorridorTile(x, endY, 0);
        }
    }
}

// Set a corridor tile (creates a new room for corridors if needed)
function setCorridorTile(worldX, worldY, value) {
    // First check if this coordinate is already in an existing room
    for (const roomKey in rooms) {
        const room = rooms[roomKey];
        const localX = worldX - room.x;
        const localY = worldY - room.y;

        // Check if this coordinate is within this room's actual tile array bounds
        if (localX >= 0 && localY >= 0 &&
            localX < room.tiles[0].length && localY < room.tiles.length) {
            room.tiles[localY][localX] = value;
            return;
        }
    }

    // If not in an existing room, create a 1x1 "corridor room"
    const corridorKey = `corridor_${worldX}_${worldY}`;
    if (!rooms[corridorKey]) {
        rooms[corridorKey] = {
            x: worldX,
            y: worldY,
            width: 1,
            height: 1,
            exits: [],
            parent: null,
            depth: -1, // Special depth for corridors
            tiles: [[value]],
            isCorridor: true
        };
    } else {
        rooms[corridorKey].tiles[0][0] = value;
    }
}

// Generate rooms ahead of the player
function generateRoomsAhead(room) {
    room.exits.forEach((exit, index) => {
        if (!exit.connected) {
            // Check if player is close enough to this potential room
            const roomCenterX = room.x + ROOM_SIZE / 2;
            const roomCenterY = room.y + ROOM_SIZE / 2;
            const distance = Math.abs(roomCenterX - player.x) + Math.abs(roomCenterY - player.y);

            if (distance < GENERATION_DISTANCE * ROOM_SIZE) {
                generateRoomAtExit(room, index);
            }
        }
    });
}

// Set a tile value at world coordinates
function setTile(worldX, worldY, value) {
    // Find which room contains this coordinate
    for (const roomKey in rooms) {
        const room = rooms[roomKey];
        const localX = worldX - room.x;
        const localY = worldY - room.y;

        // Check if this coordinate is within this room's actual dimensions
        if (localX >= 0 && localY >= 0 && localX < room.tiles[0].length && localY < room.tiles.length) {
            room.tiles[localY][localX] = value;
            return;
        }
    }
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

// Ensure all rooms are connected by analyzing connectivity and adding corridors
function ensureConnectivity(chunk, rooms) {
    if (rooms.length <= 1) return;

    // Create a connectivity graph
    const connected = new Set();
    const toConnect = [...rooms];

    // Start with the first room
    connected.add(0);
    toConnect.shift();

    // Keep connecting rooms until all are connected
    while (toConnect.length > 0) {
        let bestConnection = null;
        let bestDistance = Infinity;

        // Find the closest unconnected room to any connected room
        for (let i = 0; i < toConnect.length; i++) {
            const unconnectedRoom = toConnect[i];

            for (let j = 0; j < rooms.length; j++) {
                if (connected.has(j)) {
                    const connectedRoom = rooms[j];
                    const distance = Math.abs(unconnectedRoom.centerX - connectedRoom.centerX) +
                                   Math.abs(unconnectedRoom.centerY - connectedRoom.centerY);

                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestConnection = { from: j, to: i };
                    }
                }
            }
        }

        if (bestConnection) {
            const fromRoom = rooms[bestConnection.from];
            const toRoom = toConnect[bestConnection.to];

            // Create corridor between the rooms
            createCorridor(chunk, fromRoom.centerX, fromRoom.centerY, toRoom.centerX, toRoom.centerY);

            // Mark the room as connected and remove from toConnect
            connected.add(rooms.indexOf(toRoom));
            toConnect.splice(bestConnection.to, 1);
        } else {
            // Fallback: just connect to the first room
            break;
        }
    }

    // Additional connectivity check: ensure no isolated corridors
    connectIsolatedAreas(chunk);
}

// Connect any isolated floor areas that aren't reachable from the main path
function connectIsolatedAreas(chunk) {
    const visited = Array(CHUNK_SIZE).fill().map(() => Array(CHUNK_SIZE).fill(false));
    const queue = [];

    // Start flood fill from center
    const centerX = Math.floor(CHUNK_SIZE / 2);
    const centerY = Math.floor(CHUNK_SIZE / 2);

    if (chunk[centerY][centerX] === 0) {
        queue.push({ x: centerX, y: centerY });
        visited[centerY][centerX] = true;
    }

    // Flood fill to mark all reachable areas
    while (queue.length > 0) {
        const current = queue.shift();

        // Check all 4 directions
        const directions = [
            { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }
        ];

        for (const dir of directions) {
            const newX = current.x + dir.x;
            const newY = current.y + dir.y;

            if (newX >= 0 && newX < CHUNK_SIZE && newY >= 0 && newY < CHUNK_SIZE &&
                chunk[newY][newX] === 0 && !visited[newY][newX]) {
                visited[newY][newX] = true;
                queue.push({ x: newX, y: newY });
            }
        }
    }

    // Find isolated areas and connect them
    for (let y = 1; y < CHUNK_SIZE - 1; y++) {
        for (let x = 1; x < CHUNK_SIZE - 1; x++) {
            if (chunk[y][x] === 0 && !visited[y][x]) {
                // Found an isolated area, connect it to the nearest visited area
                connectToNearestVisited(chunk, x, y, visited);
            }
        }
    }
}

// Connect an isolated tile to the nearest visited (reachable) area
function connectToNearestVisited(chunk, startX, startY, visited) {
    const queue = [{ x: startX, y: startY, distance: 0 }];
    const visitedSearch = Array(CHUNK_SIZE).fill().map(() => Array(CHUNK_SIZE).fill(false));
    visitedSearch[startY][startX] = true;

    let nearestConnection = null;
    let minDistance = Infinity;

    while (queue.length > 0) {
        const current = queue.shift();

        // Check if this position is adjacent to a visited area
        const directions = [
            { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }
        ];

        for (const dir of directions) {
            const checkX = current.x + dir.x;
            const checkY = current.y + dir.y;

            if (checkX >= 0 && checkX < CHUNK_SIZE && checkY >= 0 && checkY < CHUNK_SIZE) {
                if (visited[checkY][checkX] && chunk[checkY][checkX] === 0) {
                    // Found connection point
                    if (current.distance < minDistance) {
                        minDistance = current.distance;
                        nearestConnection = { x: checkX, y: checkY };
                    }
                }
            }
        }

        if (nearestConnection) break;

        // Continue search
        for (const dir of directions) {
            const newX = current.x + dir.x;
            const newY = current.y + dir.y;

            if (newX >= 0 && newX < CHUNK_SIZE && newY >= 0 && newY < CHUNK_SIZE &&
                chunk[newY][newX] === 0 && !visitedSearch[newY][newX]) {
                visitedSearch[newY][newX] = true;
                queue.push({ x: newX, y: newY, distance: current.distance + 1 });
            }
        }
    }

    // Create connection corridor
    if (nearestConnection) {
        createCorridor(chunk, startX, startY, nearestConnection.x, nearestConnection.y);
    }
}

// Create a guaranteed main corridor system that runs through the entire chunk
function createMainCorridorSystem(chunk) {
    const centerX = Math.floor(CHUNK_SIZE / 2);
    const centerY = Math.floor(CHUNK_SIZE / 2);

    // Create horizontal main corridor through center
    for (let x = 1; x < CHUNK_SIZE - 1; x++) {
        chunk[centerY][x] = 0;
    }

    // Create vertical main corridor through center
    for (let y = 1; y < CHUNK_SIZE - 1; y++) {
        chunk[y][centerX] = 0;
    }

    // Create additional cross corridors for better connectivity
    const quarterX = Math.floor(CHUNK_SIZE / 4);
    const threeQuarterX = Math.floor(3 * CHUNK_SIZE / 4);
    const quarterY = Math.floor(CHUNK_SIZE / 4);
    const threeQuarterY = Math.floor(3 * CHUNK_SIZE / 4);

    // Horizontal corridors at quarter and three-quarter heights
    for (let x = 1; x < CHUNK_SIZE - 1; x++) {
        chunk[quarterY][x] = 0;
        chunk[threeQuarterY][x] = 0;
    }

    // Vertical corridors at quarter and three-quarter widths
    for (let y = 1; y < CHUNK_SIZE - 1; y++) {
        chunk[y][quarterX] = 0;
        chunk[y][threeQuarterX] = 0;
    }

    // Connect the cross corridors with diagonal corridors for even better connectivity
    createCorridor(chunk, quarterX, quarterY, centerX, centerY);
    createCorridor(chunk, threeQuarterX, quarterY, centerX, centerY);
    createCorridor(chunk, quarterX, threeQuarterY, centerX, centerY);
    createCorridor(chunk, threeQuarterX, threeQuarterY, centerX, centerY);
}

// Seeded random number generator for consistent chunk generation
function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

// Place player on a valid floor tile
function placePlayer() {
    // Place player in the center of the starting room
    const startRoom = rooms['0,0'];
    player = {
        x: startRoom.x + Math.floor(ROOM_SIZE / 2),
        y: startRoom.y + Math.floor(ROOM_SIZE / 2),
        health: 100,
        gold: 0,
        level: 1
    };
}

// Update camera to follow player
function updateCamera() {
    camera.x = player.x * TILE_SIZE - CANVAS_WIDTH / 2;
    camera.y = player.y * TILE_SIZE - CANVAS_HEIGHT / 2;
}

// Get tile at world coordinates
function getTile(worldX, worldY) {
    // Find which room contains this coordinate
    for (const roomKey in rooms) {
        const room = rooms[roomKey];
        const localX = worldX - room.x;
        const localY = worldY - room.y;

        // Check if this coordinate is within this room's actual tile array bounds
        if (localX >= 0 && localY >= 0 &&
            localX < room.tiles[0].length && localY < room.tiles.length) {
            return room.tiles[localY][localX];
        }
    }

    // If no room contains this coordinate, it's a wall
    return 1;
}

// Place entities (treasures, traps, enemies)
function placeEntities() {
    treasures = [];
    traps = [];
    enemies = [];

    // Get list of all existing rooms (excluding corridors)
    const existingRooms = Object.values(rooms).filter(room => !room.isCorridor);

    if (existingRooms.length === 0) return;

    // Place treasures in existing rooms
    for (let i = 0; i < Math.min(20, existingRooms.length * 2); i++) {
        const room = existingRooms[Math.floor(Math.random() * existingRooms.length)];
        let x, y, attempts = 0;

        do {
            x = room.x + Math.floor(Math.random() * ROOM_SIZE);
            y = room.y + Math.floor(Math.random() * ROOM_SIZE);
            attempts++;
        } while ((getTile(x, y) !== 0 || (x === player.x && y === player.y)) && attempts < 50);

        if (attempts < 50) {
            treasures.push({ x, y, collected: false });
        }
    }

    // Place traps in existing rooms
    for (let i = 0; i < Math.min(30, existingRooms.length * 3); i++) {
        const room = existingRooms[Math.floor(Math.random() * existingRooms.length)];
        let x, y, attempts = 0;

        do {
            x = room.x + Math.floor(Math.random() * ROOM_SIZE);
            y = room.y + Math.floor(Math.random() * ROOM_SIZE);
            attempts++;
        } while ((getTile(x, y) !== 0 || (x === player.x && y === player.y)) && attempts < 50);

        if (attempts < 50) {
            traps.push({ x, y, triggered: false });
        }
    }

    // Place enemies in existing rooms
    for (let i = 0; i < Math.min(10, existingRooms.length); i++) {
        const room = existingRooms[Math.floor(Math.random() * existingRooms.length)];
        let x, y, attempts = 0;

        do {
            x = room.x + Math.floor(Math.random() * ROOM_SIZE);
            y = room.y + Math.floor(Math.random() * ROOM_SIZE);
            attempts++;
        } while ((getTile(x, y) !== 0 || (x === player.x && y === player.y)) && attempts < 50);

        if (attempts < 50) {
            enemies.push({
                x, y,
                health: 20 + Math.floor(Math.random() * 20),
                attack: 5 + Math.floor(Math.random() * 5)
            });
        }
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

        // Generate new rooms if player is near exits
        generateNearbyRooms();

        checkCollisions();
        moveEnemies();
        updateUI();
    }
}

// Generate rooms near the player's current position
function generateNearbyRooms() {
    // Check all rooms for unconnected exits that are close to the player
    for (const roomKey in rooms) {
        const room = rooms[roomKey];

        room.exits.forEach((exit, index) => {
            if (!exit.connected) {
                // Calculate world position of this exit
                const exitWorldX = room.x + exit.x;
                const exitWorldY = room.y + exit.y;

                // Check if player is close enough to this exit
                const distance = Math.abs(exitWorldX - player.x) + Math.abs(exitWorldY - player.y);

                if (distance < GENERATION_DISTANCE * 2) {
                    generateRoomAtExit(room, index);
                }
            }
        });
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

    // Render all rooms
    for (const roomKey in rooms) {
        const room = rooms[roomKey];

        // Calculate screen position for this room
        const screenX = room.x * TILE_SIZE - camera.x;
        const screenY = room.y * TILE_SIZE - camera.y;

        // Render room tiles
        const roomHeight = room.tiles.length;
        const roomWidth = room.tiles[0] ? room.tiles[0].length : 0;

        for (let y = 0; y < roomHeight; y++) {
            for (let x = 0; x < roomWidth; x++) {
                const tileX = screenX + x * TILE_SIZE;
                const tileY = screenY + y * TILE_SIZE;

                // Only render if tile is visible on screen
                if (tileX > -TILE_SIZE && tileX < CANVAS_WIDTH && tileY > -TILE_SIZE && tileY < CANVAS_HEIGHT) {
                    if (room.tiles[y][x] === 1) {
                        ctx.fillStyle = '#333';
                    } else {
                        ctx.fillStyle = '#111';
                    }
                    ctx.fillRect(tileX, tileY, TILE_SIZE, TILE_SIZE);
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

// Spawn entities in a newly generated room
function spawnEntitiesInRoom(room) {
    // Skip corridor rooms
    if (room.isCorridor) return;

    // Spawn 1-3 treasures
    const numTreasures = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < numTreasures; i++) {
        let x, y, attempts = 0;
        do {
            x = room.x + Math.floor(Math.random() * ROOM_SIZE);
            y = room.y + Math.floor(Math.random() * ROOM_SIZE);
            attempts++;
        } while ((getTile(x, y) !== 0 || (x === player.x && y === player.y)) && attempts < 20);

        if (attempts < 20) {
            treasures.push({ x, y, collected: false });
        }
    }

    // Spawn 1-2 traps
    const numTraps = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < numTraps; i++) {
        let x, y, attempts = 0;
        do {
            x = room.x + Math.floor(Math.random() * ROOM_SIZE);
            y = room.y + Math.floor(Math.random() * ROOM_SIZE);
            attempts++;
        } while ((getTile(x, y) !== 0 || (x === player.x && y === player.y)) && attempts < 20);

        if (attempts < 20) {
            traps.push({ x, y, triggered: false });
        }
    }

    // Spawn 0-2 enemies
    const numEnemies = Math.floor(Math.random() * 3); // 0-2 enemies
    for (let i = 0; i < numEnemies; i++) {
        let x, y, attempts = 0;
        do {
            x = room.x + Math.floor(Math.random() * ROOM_SIZE);
            y = room.y + Math.floor(Math.random() * ROOM_SIZE);
            attempts++;
        } while ((getTile(x, y) !== 0 || (x === player.x && y === player.y)) && attempts < 20);

        if (attempts < 20) {
            enemies.push({
                x, y,
                health: 20 + Math.floor(Math.random() * 20),
                attack: 5 + Math.floor(Math.random() * 5)
            });
        }
    }
}

// Start the game
init();
