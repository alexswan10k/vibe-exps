// Game constants
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 700;
const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;

// Game variables
let canvas, ctx;
let keys = {};
let camera = {
    x: 0,
    y: 0,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT
};
let world;
let player;
let cars = [];
let lastTime = 0;
let fps = 0;
let frameCount = 0;
let lastFpsUpdate = 0;
let gameTime = 0;
let score = 0;
let distanceTraveled = 0;
let lastPlayerPos = { x: 0, y: 0 };
let collisionCount = 0;
let safeDrivingTime = 0;
let allRoads = []; // Global roads array

// Initialize game
function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Load world from embedded data
    world = World.loadFromEmbedded();
    console.log(world.toString()); // Display the world map in console

    // Create player
    const worldSize = world.getWorldSize();
    player = new Player(worldSize.width / 2, worldSize.height / 2, worldSize);

    // Create some cars
    createCars();

    // Event listeners
    document.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
    document.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

    // Start game loop
    gameLoop();
}

// Create cars
function createCars() {
    const worldSize = world.getWorldSize();
    const carColors = ['#0000FF', '#00FF00', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080'];

    // Combine all road types for car placement
    const allRoads = [
        ...world.roads,
        ...world.horizontalRoads,
        ...world.verticalRoads,
        ...world.crossroads
    ];

    // Create AI cars
    for (let i = 0; i < 16; i++) {
        let road = allRoads[Math.floor(Math.random() * allRoads.length)];
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

        cars.push(new Car(
            x, y, angle, false,
            carColors[Math.floor(Math.random() * carColors.length)]
        ));
    }
}

// Game loop with performance optimization
function gameLoop(currentTime = 0) {
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    // Calculate FPS
    frameCount++;
    if (currentTime - lastFpsUpdate >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastFpsUpdate = currentTime;
    }

    // Update game time
    gameTime += deltaTime;

    // Update game state
    update(deltaTime);

    // Draw everything
    draw();

    requestAnimationFrame(gameLoop);
}

// Update game state
function update(deltaTime) {
    // Store previous position for distance calculation
    const prevX = player.x;
    const prevY = player.y;

    // Check for entering/exiting cars FIRST, before any position updates
    if (keys['e']) {
        if (player.inCar) {
            player.exitCar();
        } else {
            // Try to enter nearest car
            let entered = false;
            for (let car of cars) {
                if (Math.abs(player.x + player.width / 2 - (car.x + car.width / 2)) < 50 &&
                    Math.abs(player.y + player.height / 2 - (car.y + car.height / 2)) < 50) {
                    player.enterCar(car);
                    entered = true;
                    break;
                }
            }
        }
        keys['e'] = false; // Prevent continuous triggering
    }

    // Update player
    player.update(keys, world.buildings);

    // Update cars
    const worldSize = world.getWorldSize();
    // Update global allRoads array
    allRoads = [
        ...world.roads,
        ...world.horizontalRoads,
        ...world.verticalRoads,
        ...world.crossroads
    ];
    for (let car of cars) {
        car.update(keys, world.buildings, cars, allRoads, world.trafficLights, worldSize);
    }

    // Update camera
    updateCamera();

    // Update scoring system
    updateScoring(prevX, prevY, deltaTime);

    updateUI();

    // Update traffic lights
    for (let light of world.trafficLights) {
        light.timer++;
        if (light.timer > 300) {
            light.state = light.state === 'red' ? 'green' : 'red';
            light.timer = 0;
        }
    }
}

function updateScoring(prevX, prevY, deltaTime) {
    // Calculate distance traveled
    const currentX = player.x;
    const currentY = player.y;
    const distance = Math.sqrt((currentX - prevX) ** 2 + (currentY - prevY) ** 2);

    if (distance > 0) {
        distanceTraveled += distance;
        // Award points for distance traveled
        score += Math.floor(distance * 0.1);
    }

    // Award points for safe driving (no collisions)
    if (player.inCar && player.car) {
        safeDrivingTime += deltaTime;
        if (safeDrivingTime > 1000) { // Every second of safe driving
            score += 10;
            safeDrivingTime = 0;
        }
    } else {
        safeDrivingTime = 0;
    }

    // Bonus points for following traffic rules (being on roads)
    if (player.inCar && player.car) {
        const centerX = player.car.x + player.car.width / 2;
        const centerY = player.car.y + player.car.height / 2;
        let onRoad = false;

        for (let road of allRoads) {
            if (centerX >= road.x && centerX <= road.x + road.width &&
                centerY >= road.y && centerY <= road.y + road.height) {
                onRoad = true;
                break;
            }
        }

        if (onRoad) {
            score += 1; // Small bonus for staying on roads
        }
    }
}

// Update UI
function updateUI() {
    document.getElementById('player-status').textContent = player.inCar ? 'In Car' : 'On Foot';
    document.getElementById('speed').textContent = player.inCar ? `Speed: ${Math.round(player.car.speed * 10)}` : 'Speed: 0';

    // Add FPS display
    const fpsElement = document.getElementById('fps') || createFPSElement();
    fpsElement.textContent = `FPS: ${fps}`;

    // Add position display
    const posElement = document.getElementById('position') || createPositionElement();
    posElement.textContent = `Pos: ${Math.round(player.x)}, ${Math.round(player.y)}`;

    // Add car count
    const carCountElement = document.getElementById('car-count') || createCarCountElement();
    carCountElement.textContent = `Cars: ${cars.length}`;

    // Add score display
    const scoreElement = document.getElementById('score') || createScoreElement();
    scoreElement.textContent = `Score: ${score.toLocaleString()}`;

    // Add distance display
    const distanceElement = document.getElementById('distance') || createDistanceElement();
    distanceElement.textContent = `Distance: ${Math.round(distanceTraveled)}px`;

    // Add controls display
    const controlsElement = document.getElementById('controls') || createControlsElement();

    // Sync player position with car when in car
    if (player.inCar && player.car) {
        player.x = player.car.x + player.car.width / 2 - player.width / 2;
        player.y = player.car.y + player.car.height / 2 - player.height / 2;
    }
}

function createFPSElement() {
    const fpsDiv = document.createElement('div');
    fpsDiv.id = 'fps';
    fpsDiv.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        color: #00FF00;
        background: linear-gradient(135deg, rgba(0,0,0,0.8), rgba(0,0,0,0.6));
        padding: 8px 12px;
        border-radius: 8px;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        font-weight: bold;
        border: 1px solid rgba(0,255,0,0.3);
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    document.getElementById('game-container').appendChild(fpsDiv);
    return fpsDiv;
}

function createPositionElement() {
    const posDiv = document.createElement('div');
    posDiv.id = 'position';
    posDiv.style.cssText = `
        position: absolute;
        top: 50px;
        right: 10px;
        color: #87CEEB;
        background: linear-gradient(135deg, rgba(0,0,0,0.8), rgba(0,0,0,0.6));
        padding: 6px 10px;
        border-radius: 6px;
        font-family: 'Courier New', monospace;
        font-size: 11px;
        border: 1px solid rgba(135,206,235,0.3);
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    `;
    document.getElementById('game-container').appendChild(posDiv);
    return posDiv;
}

function createCarCountElement() {
    const carCountDiv = document.createElement('div');
    carCountDiv.id = 'car-count';
    carCountDiv.style.cssText = `
        position: absolute;
        top: 85px;
        right: 10px;
        color: #FFA500;
        background: linear-gradient(135deg, rgba(0,0,0,0.8), rgba(0,0,0,0.6));
        padding: 6px 10px;
        border-radius: 6px;
        font-family: 'Courier New', monospace;
        font-size: 11px;
        border: 1px solid rgba(255,165,0,0.3);
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    `;
    document.getElementById('game-container').appendChild(carCountDiv);
    return carCountDiv;
}

function createScoreElement() {
    const scoreDiv = document.createElement('div');
    scoreDiv.id = 'score';
    scoreDiv.style.cssText = `
        position: absolute;
        top: 10px;
        left: 10px;
        color: #FFD700;
        background: linear-gradient(135deg, rgba(0,0,0,0.9), rgba(0,0,0,0.7));
        padding: 10px 15px;
        border-radius: 10px;
        font-family: 'Arial', sans-serif;
        font-size: 18px;
        font-weight: bold;
        border: 2px solid rgba(255,215,0,0.5);
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
    `;
    document.getElementById('game-container').appendChild(scoreDiv);
    return scoreDiv;
}

function createDistanceElement() {
    const distanceDiv = document.createElement('div');
    distanceDiv.id = 'distance';
    distanceDiv.style.cssText = `
        position: absolute;
        top: 60px;
        left: 10px;
        color: #98FB98;
        background: linear-gradient(135deg, rgba(0,0,0,0.8), rgba(0,0,0,0.6));
        padding: 6px 10px;
        border-radius: 6px;
        font-family: 'Courier New', monospace;
        font-size: 11px;
        border: 1px solid rgba(152,251,152,0.3);
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    `;
    document.getElementById('game-container').appendChild(distanceDiv);
    return distanceDiv;
}

function createControlsElement() {
    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'controls';
    controlsDiv.style.cssText = `
        position: absolute;
        bottom: 10px;
        left: 10px;
        color: white;
        background: linear-gradient(135deg, rgba(0,0,0,0.8), rgba(0,0,0,0.6));
        padding: 12px;
        border-radius: 8px;
        font-family: 'Arial', sans-serif;
        font-size: 12px;
        border: 1px solid rgba(255,255,255,0.2);
        box-shadow: 0 3px 8px rgba(0,0,0,0.4);
    `;
    controlsDiv.innerHTML = `
        <div style="margin-bottom: 5px; font-weight: bold; color: #FFD700;">Controls:</div>
        <div>WASD / Arrow Keys - Move / Drive</div>
        <div>E - Enter/Exit Vehicle</div>
        <div>Space - Brake (in car)</div>
        <div style="margin-top: 8px; font-size: 10px; color: #87CEEB;">Walk close to cars to see entry indicator</div>
    `;
    document.getElementById('game-container').appendChild(controlsDiv);
    return controlsDiv;
}

function createGrassPattern() {
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 20;
    patternCanvas.height = 20;
    const patternCtx = patternCanvas.getContext('2d');

    // Create grass pattern
    patternCtx.fillStyle = '#228B22';
    patternCtx.fillRect(0, 0, 20, 20);

    // Add random grass blades
    patternCtx.fillStyle = '#32CD32';
    for (let i = 0; i < 8; i++) {
        const x = Math.random() * 20;
        const y = Math.random() * 20;
        const width = 1 + Math.random() * 2;
        const height = 3 + Math.random() * 4;
        patternCtx.fillRect(x, y, width, height);
    }

    return patternCanvas;
}

// Draw everything
function draw() {
    // Draw sky gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#87CEEB'); // Sky blue
    gradient.addColorStop(1, '#98FB98'); // Light green
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Save context and apply camera transform
    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Draw grass texture
    ctx.fillStyle = '#228B22';
    const grassPattern = ctx.createPattern(createGrassPattern(), 'repeat');
    ctx.fillStyle = grassPattern;
    ctx.fillRect(-1000, -1000, 3000, 3000);

    // Draw all road types with better graphics
    const allRoads = [
        ...world.roads,
        ...world.horizontalRoads,
        ...world.verticalRoads,
        ...world.crossroads
    ];

    // Draw road shadows first
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    for (let road of allRoads) {
        ctx.fillRect(road.x + 2, road.y + 2, road.width, road.height);
    }

    // Draw roads with gradient
    const roadGradient = ctx.createLinearGradient(0, 0, 0, 100);
    roadGradient.addColorStop(0, '#2F4F4F');
    roadGradient.addColorStop(1, '#1C1C1C');
    ctx.fillStyle = roadGradient;
    for (let road of allRoads) {
        ctx.fillRect(road.x, road.y, road.width, road.height);
    }

    // Draw road borders
    ctx.strokeStyle = '#696969';
    ctx.lineWidth = 3;
    for (let road of allRoads) {
        ctx.strokeRect(road.x, road.y, road.width, road.height);
    }

    // Draw road markings with better styling
    ctx.strokeStyle = '#FFFF00';
    ctx.lineWidth = 3;
    ctx.setLineDash([15, 10]);
    for (let road of allRoads) {
        ctx.beginPath();
        if (road.width > road.height) {
            // Horizontal road - draw center line
            ctx.moveTo(road.x, road.y + road.height / 2);
            ctx.lineTo(road.x + road.width, road.y + road.height / 2);
        } else {
            // Vertical road - draw center line
            ctx.moveTo(road.x + road.width / 2, road.y);
            ctx.lineTo(road.x + road.width / 2, road.y + road.height);
        }
        ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw lane markings for wider roads
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 15]);
    for (let road of allRoads) {
        if (road.width > road.height && road.width > 100) {
            // Draw lane dividers for wide horizontal roads
            ctx.beginPath();
            ctx.moveTo(road.x + road.width / 3, road.y);
            ctx.lineTo(road.x + road.width / 3, road.y + road.height);
            ctx.moveTo(road.x + 2 * road.width / 3, road.y);
            ctx.lineTo(road.x + 2 * road.width / 3, road.y + road.height);
            ctx.stroke();
        } else if (road.height > road.width && road.height > 100) {
            // Draw lane dividers for wide vertical roads
            ctx.beginPath();
            ctx.moveTo(road.x, road.y + road.height / 3);
            ctx.lineTo(road.x + road.width, road.y + road.height / 3);
            ctx.moveTo(road.x, road.y + 2 * road.height / 3);
            ctx.lineTo(road.x + road.width, road.y + 2 * road.height / 3);
            ctx.stroke();
        }
    }
    ctx.setLineDash([]);

    // Draw buildings with enhanced graphics
    for (let building of world.buildings) {
        // Building shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(building.x + 3, building.y + 3, building.width, building.height);

        // Building body with gradient effect
        const gradient = ctx.createLinearGradient(building.x, building.y, building.x + building.width, building.y + building.height);
        gradient.addColorStop(0, '#A0522D');
        gradient.addColorStop(1, '#8B4513');
        ctx.fillStyle = gradient;
        ctx.fillRect(building.x, building.y, building.width, building.height);

        // Building outline
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        ctx.strokeRect(building.x, building.y, building.width, building.height);

        // Add windows to buildings with lighting effect
        ctx.fillStyle = '#FFFF99';
        for (let wx = building.x + 10; wx < building.x + building.width - 10; wx += 20) {
            for (let wy = building.y + 10; wy < building.y + building.height - 10; wy += 20) {
                // Randomly light some windows
                if (Math.random() > 0.7) {
                    ctx.fillStyle = '#FFD700'; // Brighter for lit windows
                } else {
                    ctx.fillStyle = '#FFFF99'; // Normal window color
                }
                ctx.fillRect(wx, wy, 8, 8);

                // Window frame
                ctx.strokeStyle = '#DAA520';
                ctx.lineWidth = 1;
                ctx.strokeRect(wx, wy, 8, 8);

                ctx.fillStyle = '#FFFF99'; // Reset for next window
            }
        }

        // Add door
        ctx.fillStyle = '#4A4A4A';
        ctx.fillRect(building.x + building.width / 2 - 5, building.y + building.height - 15, 10, 15);
    }

    // Draw traffic lights with enhanced graphics
    for (let light of world.trafficLights) {
        // Traffic light pole
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(light.x, light.y);
        ctx.lineTo(light.x, light.y - 40);
        ctx.stroke();

        // Traffic light housing
        ctx.fillStyle = '#333';
        ctx.fillRect(light.x - 8, light.y - 35, 16, 30);

        // Traffic light border
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.strokeRect(light.x - 8, light.y - 35, 16, 30);

        // Red light
        ctx.fillStyle = light.state === 'red' ? '#FF4444' : '#440000';
        ctx.beginPath();
        ctx.arc(light.x, light.y - 25, 5, 0, 2 * Math.PI);
        ctx.fill();

        // Green light
        ctx.fillStyle = light.state === 'green' ? '#44FF44' : '#004400';
        ctx.beginPath();
        ctx.arc(light.x, light.y - 15, 5, 0, 2 * Math.PI);
        ctx.fill();

        // Add glow effect for active light
        if (light.state === 'red') {
            ctx.fillStyle = 'rgba(255, 68, 68, 0.3)';
            ctx.beginPath();
            ctx.arc(light.x, light.y - 25, 8, 0, 2 * Math.PI);
            ctx.fill();
        } else if (light.state === 'green') {
            ctx.fillStyle = 'rgba(68, 255, 68, 0.3)';
            ctx.beginPath();
            ctx.arc(light.x, light.y - 15, 8, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    // Draw cars
    for (let car of cars) {
        car.draw(ctx, camera.x, camera.y);

        // Draw car entry indicator when player is close
        if (!player.inCar) {
            const playerCenterX = player.x + player.width / 2;
            const playerCenterY = player.y + player.height / 2;
            const carCenterX = car.x + car.width / 2;
            const carCenterY = car.y + car.height / 2;
            const distance = Math.sqrt((playerCenterX - carCenterX) ** 2 + (playerCenterY - carCenterY) ** 2);

            if (distance < 60) {
                // Draw "E" indicator above car
                ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
                ctx.font = '16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('E', car.x + car.width / 2, car.y - 10);
            }
        }
    }

    // Draw player
    player.draw(ctx, camera.x, camera.y);

    // Restore context
    ctx.restore();
}

function updateCamera() {
    const worldSize = world.getWorldSize();
    // Camera follows the player
    camera.x = player.x - CANVAS_WIDTH / 2;
    camera.y = player.y - CANVAS_HEIGHT / 2;

    // Keep camera within world bounds
    camera.x = Math.max(0, Math.min(worldSize.width - CANVAS_WIDTH, camera.x));
    camera.y = Math.max(0, Math.min(worldSize.height - CANVAS_HEIGHT, camera.y));
}

// Start the game when page loads
window.onload = init;
