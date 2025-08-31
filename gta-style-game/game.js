// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const WORLD_WIDTH = 4800;
const WORLD_HEIGHT = 3600;
const PLAYER_SPEED = 3;
const CAR_SPEED = 5;
const BRAKE_FORCE = 0.9;
const ACCELERATION = 0.2;
const TURN_SPEED = 0.05;

// Game variables
let canvas, ctx;
let keys = {};
let camera = {
    x: 0,
    y: 0,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT
};
let player = {
    x: 330,
    y: 330,
    width: 20,
    height: 20,
    speed: PLAYER_SPEED,
    inCar: false,
    car: null
};

let cars = [];
let buildings = [];
let roads = [];
let trafficLights = [];

// Initialize game
function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Generate city
    generateCity();

    // Create some cars
    createCars();

    // Event listeners
    document.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
    document.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

    // Start game loop
    gameLoop();
}

// Generate city layout
function generateCity() {
    roads = [];

    // Create procedural road grid
    const roadSpacing = 300; // Distance between roads
    const roadWidth = 60;

    // Horizontal roads
    for (let y = roadSpacing; y < WORLD_HEIGHT; y += roadSpacing) {
        roads.push({ x: 0, y: y, width: WORLD_WIDTH, height: roadWidth });
    }

    // Vertical roads
    for (let x = roadSpacing; x < WORLD_WIDTH; x += roadSpacing) {
        roads.push({ x: x, y: 0, width: roadWidth, height: WORLD_HEIGHT });
    }

    // Create buildings
    buildings = [];
    const numBuildings = 200; // Many more buildings for larger map
    for (let i = 0; i < numBuildings; i++) {
        let x, y, width, height;
        let attempts = 0;
        do {
            width = 60 + Math.random() * 120;
            height = 60 + Math.random() * 120;
            x = Math.random() * (WORLD_WIDTH - width);
            y = Math.random() * (WORLD_HEIGHT - height);
            attempts++;
        } while (isOverlappingRoad(x, y, width, height) && attempts < 50);

        if (attempts < 50) {
            buildings.push({ x, y, width, height });
        }
    }

    // Create traffic lights at intersections
    trafficLights = [];
    for (let x = 300; x < WORLD_WIDTH; x += 300) {
        for (let y = 300; y < WORLD_HEIGHT; y += 300) {
            trafficLights.push({ x: x, y: y, state: 'red', timer: 0 });
        }
    }
}

// Helper function to check if a building overlaps with roads
function isOverlappingRoad(x, y, width, height) {
    for (let road of roads) {
        if (x < road.x + road.width && x + width > road.x &&
            y < road.y + road.height && y + height > road.y) {
            return true;
        }
    }
    return false;
}

// Create cars
function createCars() {
    // Player's car - place on road
    let playerRoad = findNearestRoad(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    cars.push({
        x: playerRoad.x + 30,
        y: playerRoad.y + 30,
        width: 50,
        height: 25,
        angle: 0,
        speed: 0,
        maxSpeed: CAR_SPEED,
        acceleration: ACCELERATION,
        turnSpeed: TURN_SPEED,
        color: '#FF0000',
        isPlayerCar: true,
        targetDirection: 0,
        lastIntersection: null
    });

    // Other cars - place on roads
    const carColors = ['#0000FF', '#00FF00', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080'];
    for (let i = 0; i < 40; i++) { // Many more cars for larger map
        let road = roads[Math.floor(Math.random() * roads.length)];
        let x, y, angle;

        // Determine if it's a horizontal or vertical road and position accordingly
        if (road.width > road.height) {
            // Horizontal road
            x = road.x + Math.random() * road.width;
            y = road.y + road.height / 2 - 12;
            angle = Math.random() < 0.5 ? 0 : Math.PI; // Left or right
        } else {
            // Vertical road
            x = road.x + road.width / 2 - 22;
            y = road.y + Math.random() * road.height;
            angle = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2; // Up or down
        }

        cars.push({
            x: x,
            y: y,
            width: 45 + Math.random() * 10,
            height: 22 + Math.random() * 6,
            angle: angle,
            speed: Math.random() * 2,
            maxSpeed: CAR_SPEED * 0.8,
            acceleration: ACCELERATION * 0.8,
            turnSpeed: TURN_SPEED * 0.8,
            color: carColors[Math.floor(Math.random() * carColors.length)],
            isPlayerCar: false,
            targetDirection: angle,
            lastIntersection: null
        });
    }
}

// Find the nearest road to a given position
function findNearestRoad(x, y) {
    let nearestRoad = roads[0];
    let minDistance = Infinity;

    for (let road of roads) {
        let distance;
        if (road.width > road.height) {
            // Horizontal road
            distance = Math.abs(y - (road.y + road.height / 2));
        } else {
            // Vertical road
            distance = Math.abs(x - (road.x + road.width / 2));
        }

        if (distance < minDistance) {
            minDistance = distance;
            nearestRoad = road;
        }
    }

    return nearestRoad;
}

// Game loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Update game state
function update() {
    if (player.inCar) {
        updateCar(player.car);
    } else {
        updatePlayer();
    }

    // Update other cars
    for (let car of cars) {
        if (!car.isPlayerCar) {
            updateAICar(car);
        }
    }

    // Update camera
    updateCamera();

    // Check for entering/exiting cars
    if (keys['e']) {
        if (player.inCar) {
            exitCar();
        } else {
            enterCar();
        }
        keys['e'] = false; // Prevent continuous triggering
    }

    updateUI();

    // Update traffic lights
    for (let light of trafficLights) {
        light.timer++;
        if (light.timer > 300) {
            light.state = light.state === 'red' ? 'green' : 'red';
            light.timer = 0;
        }
    }
}

// Update player (on foot)
function updatePlayer() {
    let dx = 0, dy = 0;

    if (keys['w'] || keys['arrowup']) dy -= player.speed;
    if (keys['s'] || keys['arrowdown']) dy += player.speed;
    if (keys['a'] || keys['arrowleft']) dx -= player.speed;
    if (keys['d'] || keys['arrowright']) dx += player.speed;

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
        dx *= 0.707;
        dy *= 0.707;
    }

    let newX = player.x + dx;
    let newY = player.y + dy;

    // Check collision with buildings
    if (!isCollidingWithBuildings(newX, newY, player.width, player.height)) {
        player.x = newX;
        player.y = newY;
    }

    // Keep player in world bounds
    player.x = Math.max(0, Math.min(WORLD_WIDTH - player.width, player.x));
    player.y = Math.max(0, Math.min(WORLD_HEIGHT - player.height, player.y));
}

// Update car
function updateCar(car) {
    if (keys['w'] || keys['arrowup']) {
        car.speed = Math.min(car.speed + car.acceleration, car.maxSpeed);
    } else if (keys['s'] || keys['arrowdown']) {
        car.speed = Math.max(car.speed - car.acceleration * 2, -car.maxSpeed * 0.5);
    } else {
        car.speed *= 0.95; // Friction
    }

    if (keys[' ']) {
        car.speed *= BRAKE_FORCE;
    }

    if (keys['a'] || keys['arrowleft']) {
        car.angle -= car.turnSpeed * (car.speed / car.maxSpeed);
    }
    if (keys['d'] || keys['arrowright']) {
        car.angle += car.turnSpeed * (car.speed / car.maxSpeed);
    }

    let newX = car.x + Math.cos(car.angle) * car.speed;
    let newY = car.y + Math.sin(car.angle) * car.speed;

    // Check collision with buildings and other cars
    if (!isCollidingWithBuildings(newX, newY, car.width, car.height) &&
        !isCollidingWithCars(newX, newY, car.width, car.height, car)) {
        car.x = newX;
        car.y = newY;
    } else {
        // Bounce back on collision
        car.speed *= -0.5;
    }

    // Keep car in world bounds
    car.x = Math.max(0, Math.min(WORLD_WIDTH - car.width, car.x));
    car.y = Math.max(0, Math.min(WORLD_HEIGHT - car.height, car.y));

    // Update player position to match car
    player.x = car.x + car.width / 2 - player.width / 2;
    player.y = car.y + car.height / 2 - player.height / 2;
}

// Update AI car
function updateAICar(car) {
    // Accelerate
    car.speed = Math.min(car.speed + car.acceleration * 0.1, car.maxSpeed * 0.5);

    // Check if car is on a road
    let onRoad = isOnRoad(car.x + car.width / 2, car.y + car.height / 2);

    if (onRoad) {
        // On road - follow road direction and handle intersections
        let currentRoad = getCurrentRoad(car.x + car.width / 2, car.y + car.height / 2);
        if (currentRoad) {
            // Check if at intersection
            let atIntersection = isAtIntersection(car.x + car.width / 2, car.y + car.height / 2, currentRoad);

            if (atIntersection && !car.lastIntersection) {
                // Just entered intersection - choose direction
                car.lastIntersection = { x: Math.floor(car.x / 300) * 300, y: Math.floor(car.y / 300) * 300 };
                car.targetDirection = chooseDirection(car, currentRoad);
            } else if (!atIntersection) {
                // Not at intersection - reset intersection flag
                car.lastIntersection = null;
            }

            // Check traffic light
            if (atIntersection) {
                let light = trafficLights.find(l => Math.abs(l.x - (car.x + car.width / 2)) < 100 && Math.abs(l.y - (car.y + car.height / 2)) < 100);
                if (light && light.state === 'red') {
                    car.speed *= 0.8;
                }
            }

            // Steer towards target direction
            let angleDiff = car.targetDirection - car.angle;
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

            if (Math.abs(angleDiff) > 0.1) {
                car.angle += Math.sign(angleDiff) * car.turnSpeed * 0.5;
            }
        }
    } else {
        // Not on road - try to get back to road
        let nearestRoad = findNearestRoad(car.x + car.width / 2, car.y + car.height / 2);
        if (nearestRoad) {
            let targetX = nearestRoad.x + nearestRoad.width / 2;
            let targetY = nearestRoad.y + nearestRoad.height / 2;

            let dx = targetX - (car.x + car.width / 2);
            let dy = targetY - (car.y + car.height / 2);
            let targetAngle = Math.atan2(dy, dx);

            let angleDiff = targetAngle - car.angle;
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

            car.angle += Math.sign(angleDiff) * car.turnSpeed * 0.3;
        }
    }

    // Move car
    let newX = car.x + Math.cos(car.angle) * car.speed;
    let newY = car.y + Math.sin(car.angle) * car.speed;

    // Check collision with buildings and other cars
    if (!isCollidingWithBuildings(newX, newY, car.width, car.height) &&
        !isCollidingWithCars(newX, newY, car.width, car.height, car)) {
        car.x = newX;
        car.y = newY;
    } else {
        // Collision - try different direction
        car.angle += Math.PI + (Math.random() - 0.5) * 0.5;
        car.speed *= 0.5;
    }

    // Keep in world bounds
    if (car.x < 0 || car.x > WORLD_WIDTH - car.width) {
        car.angle = Math.PI - car.angle;
    }
    if (car.y < 0 || car.y > WORLD_HEIGHT - car.height) {
        car.angle = -car.angle;
    }
}

// Check if a point is on a road
function isOnRoad(x, y) {
    for (let road of roads) {
        if (x >= road.x && x <= road.x + road.width &&
            y >= road.y && y <= road.y + road.height) {
            return true;
        }
    }
    return false;
}

// Get the current road a point is on
function getCurrentRoad(x, y) {
    for (let road of roads) {
        if (x >= road.x && x <= road.x + road.width &&
            y >= road.y && y <= road.y + road.height) {
            return road;
        }
    }
    return null;
}

// Check if a point is at an intersection
function isAtIntersection(x, y, currentRoad) {
    let intersectionX = Math.round(x / 300) * 300;
    let intersectionY = Math.round(y / 300) * 300;

    // Check if we're close to an intersection point
    return Math.abs(x - intersectionX) < 100 && Math.abs(y - intersectionY) < 100;
}

// Choose a direction at an intersection
function chooseDirection(car, currentRoad) {
    let possibleDirections = [];

    // Determine current direction
    let currentDir = Math.abs(car.angle) < Math.PI / 4 ? 0 : // East
                     Math.abs(car.angle - Math.PI / 2) < Math.PI / 4 ? 1 : // North
                     Math.abs(car.angle + Math.PI / 2) < Math.PI / 4 ? 3 : // South
                     2; // West

    // Add possible turns
    if (currentRoad.width > currentRoad.height) {
        // On horizontal road - can go left, right, or straight
        possibleDirections = [0, Math.PI]; // Left or right
    } else {
        // On vertical road - can go up, down, or straight
        possibleDirections = [Math.PI / 2, -Math.PI / 2]; // Up or down
    }

    // Randomly choose a direction
    return possibleDirections[Math.floor(Math.random() * possibleDirections.length)];
}

// Enter car
function enterCar() {
    for (let car of cars) {
        if (Math.abs(player.x + player.width / 2 - (car.x + car.width / 2)) < 50 &&
            Math.abs(player.y + player.height / 2 - (car.y + car.height / 2)) < 50) {
            player.inCar = true;
            player.car = car;
            car.isPlayerCar = true; // Take control of this car
            break;
        }
    }
}

// Exit car
function exitCar() {
    if (player.car) {
        player.car.isPlayerCar = false; // Return control to AI
    }
    player.inCar = false;
    player.car = null;
}

// Update UI
function updateUI() {
    document.getElementById('player-status').textContent = player.inCar ? 'In Car' : 'On Foot';
    document.getElementById('speed').textContent = player.inCar ? `Speed: ${Math.round(player.car.speed * 10)}` : 'Speed: 0';
}

// Draw everything
function draw() {
    // Clear canvas
    ctx.fillStyle = '#90EE90';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Save context and apply camera transform
    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Draw roads
    ctx.fillStyle = '#333';
    for (let road of roads) {
        ctx.fillRect(road.x, road.y, road.width, road.height);
    }

    // Draw road markings
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    for (let road of roads) {
        ctx.beginPath();
        if (road.width > road.height) {
            // Horizontal road
            ctx.moveTo(road.x, road.y + road.height / 2);
            ctx.lineTo(road.x + road.width, road.y + road.height / 2);
        } else {
            // Vertical road
            ctx.moveTo(road.x + road.width / 2, road.y);
            ctx.lineTo(road.x + road.width / 2, road.y + road.height);
        }
        ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw buildings
    ctx.fillStyle = '#8B4513';
    for (let building of buildings) {
        ctx.fillRect(building.x, building.y, building.width, building.height);
        // Add windows to buildings
        ctx.fillStyle = '#FFFF99';
        for (let wx = building.x + 10; wx < building.x + building.width - 10; wx += 20) {
            for (let wy = building.y + 10; wy < building.y + building.height - 10; wy += 20) {
                ctx.fillRect(wx, wy, 8, 8);
            }
        }
        ctx.fillStyle = '#8B4513';
    }

    // Draw traffic lights
    for (let light of trafficLights) {
        ctx.fillStyle = light.state === 'red' ? '#FF0000' : '#00FF00';
        ctx.fillRect(light.x - 5, light.y - 5, 10, 10);
    }

    // Draw cars
    for (let car of cars) {
        drawDetailedCar(car);
    }

    // Draw player
    if (!player.inCar) {
        ctx.fillStyle = '#FF69B4';
        ctx.fillRect(player.x, player.y, player.width, player.height);
        // Add simple face
        ctx.fillStyle = '#000';
        ctx.fillRect(player.x + 5, player.y + 5, 3, 3); // left eye
        ctx.fillRect(player.x + 12, player.y + 5, 3, 3); // right eye
        ctx.fillRect(player.x + 7, player.y + 12, 6, 2); // mouth
    }

    // Restore context
    ctx.restore();
}

// Draw a detailed car with wheels, windows, etc.
function drawDetailedCar(car) {
    ctx.save();
    ctx.translate(car.x + car.width / 2, car.y + car.height / 2);
    ctx.rotate(car.angle);

    let halfWidth = car.width / 2;
    let halfHeight = car.height / 2;

    // Car body
    ctx.fillStyle = car.color;
    ctx.fillRect(-halfWidth, -halfHeight, car.width, car.height);

    // Car roof (darker shade)
    ctx.fillStyle = shadeColor(car.color, -20);
    ctx.fillRect(-halfWidth + 5, -halfHeight + 2, car.width - 10, car.height - 8);

    // Windows
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(-halfWidth + 8, -halfHeight + 4, car.width - 16, car.height - 12);

    // Wheels
    ctx.fillStyle = '#333';
    let wheelSize = Math.min(car.width * 0.15, car.height * 0.4);
    // Front wheels
    ctx.fillRect(-halfWidth + wheelSize, -halfHeight - wheelSize/2, wheelSize, wheelSize);
    ctx.fillRect(halfWidth - wheelSize * 2, -halfHeight - wheelSize/2, wheelSize, wheelSize);
    // Back wheels
    ctx.fillRect(-halfWidth + wheelSize, halfHeight - wheelSize/2, wheelSize, wheelSize);
    ctx.fillRect(halfWidth - wheelSize * 2, halfHeight - wheelSize/2, wheelSize, wheelSize);

    // Wheel rims (lighter)
    ctx.fillStyle = '#CCC';
    ctx.fillRect(-halfWidth + wheelSize + 2, -halfHeight - wheelSize/2 + 2, wheelSize - 4, wheelSize - 4);
    ctx.fillRect(halfWidth - wheelSize * 2 + 2, -halfHeight - wheelSize/2 + 2, wheelSize - 4, wheelSize - 4);
    ctx.fillRect(-halfWidth + wheelSize + 2, halfHeight - wheelSize/2 + 2, wheelSize - 4, wheelSize - 4);
    ctx.fillRect(halfWidth - wheelSize * 2 + 2, halfHeight - wheelSize/2 + 2, wheelSize - 4, wheelSize - 4);

    // Headlights
    ctx.fillStyle = '#FFFF00';
    ctx.fillRect(-halfWidth, -halfHeight + 5, 3, 4);
    ctx.fillRect(halfWidth - 3, -halfHeight + 5, 3, 4);

    // Taillights
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(-halfWidth, halfHeight - 9, 3, 4);
    ctx.fillRect(halfWidth - 3, halfHeight - 9, 3, 4);

    ctx.restore();
}

// Helper function to shade colors
function shadeColor(color, percent) {
    let num = parseInt(color.replace("#", ""), 16);
    let amt = Math.round(2.55 * percent);
    let R = (num >> 16) + amt;
    let G = (num >> 8 & 0x00FF) + amt;
    let B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

// Collision detection functions
function isCollidingWithBuildings(x, y, width, height) {
    for (let building of buildings) {
        if (x < building.x + building.width && x + width > building.x &&
            y < building.y + building.height && y + height > building.y) {
            return true;
        }
    }
    return false;
}

function isCollidingWithCars(x, y, width, height, excludeCar = null) {
    for (let car of cars) {
        if (car === excludeCar) continue;
        if (x < car.x + car.width && x + width > car.x &&
            y < car.y + car.height && y + height > car.y) {
            return true;
        }
    }
    return false;
}

function updateCamera() {
    // Camera follows the player
    camera.x = player.x - CANVAS_WIDTH / 2;
    camera.y = player.y - CANVAS_HEIGHT / 2;

    // Keep camera within world bounds
    camera.x = Math.max(0, Math.min(WORLD_WIDTH - CANVAS_WIDTH, camera.x));
    camera.y = Math.max(0, Math.min(WORLD_HEIGHT - CANVAS_HEIGHT, camera.y));
}

// Start the game when page loads
window.onload = init;
