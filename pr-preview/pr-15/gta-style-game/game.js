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
let mouseX = 0;
let mouseY = 0;
let isMouseDown = false;
let world;
let player;
let pedestrians = [];
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

// UI & Minimap Variables
let minimapCanvas, minimapCtx;
const DAY_LENGTH = 60000; // 60 seconds per day cycle
let timeOfDay = 0; // 0 = midnight, 0.5 = noon, 1.0 = midnight
let lightLevel = 1;

let playerHealth = 100;
let playerArmor = 50;
let wantedLevel = 0;
let playerMoney = 500;

// Initialize game
function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    minimapCanvas = document.getElementById('minimap-canvas');
    if (minimapCanvas) {
        minimapCanvas.width = 200;
        minimapCanvas.height = 200;
        minimapCtx = minimapCanvas.getContext('2d');
    }

    // Load world from embedded data
    world = World.loadFromEmbedded();
    console.log(world.toString()); // Display the world map in console

    // Find a valid spawn point for player (nearest road to center)
    const worldSize = world.getWorldSize();
    let centerX = worldSize.width / 2;
    let centerY = worldSize.height / 2;
    let spawnX = centerX;
    let spawnY = centerY;

    let allValidRoads = [...world.roads, ...world.horizontalRoads, ...world.verticalRoads, ...world.crossroads];
    if (allValidRoads.length > 0) {
        let bestRoad = allValidRoads[0];
        let minDist = Infinity;
        for (let r of allValidRoads) {
            let dist = Math.pow(r.x + r.width / 2 - centerX, 2) + Math.pow(r.y + r.height / 2 - centerY, 2);
            if (dist < minDist) {
                minDist = dist;
                bestRoad = r;
            }
        }
        spawnX = bestRoad.x + bestRoad.width / 2;
        spawnY = bestRoad.y + bestRoad.height / 2;
    }

    player = new Player(spawnX, spawnY, worldSize);

    // Create cars
    createCars();

    // Create pedestrians
    for (let i = 0; i < 40; i++) {
        pedestrians.push(new Pedestrian(Math.random() * worldSize.width, Math.random() * worldSize.height, worldSize));
    }

    // Event listeners
    document.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
    document.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    });

    canvas.addEventListener('mousedown', (e) => {
        isMouseDown = true;
    });

    canvas.addEventListener('mouseup', (e) => {
        isMouseDown = false;
    });

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
    for (let i = 0; i < 45; i++) {
        let road = allRoads[Math.floor(Math.random() * allRoads.length)];
        let x, y, angle;

        // Determine if it's a horizontal or vertical road and position accordingly
        if (road.type === 'horizontal' || road.width > road.height) {
            // Horizontal road
            x = road.x + Math.random() * road.width;
            y = road.y + road.height / 2 - 12;
            angle = Math.random() < 0.5 ? 0 : Math.PI; // Left or right
        } else if (road.type === 'vertical' || road.height > road.width) {
            // Vertical road
            x = road.x + road.width / 2 - 22;
            y = road.y + Math.random() * road.height;
            angle = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2; // Up or down
        } else {
            // Crossroad
            x = road.x + road.width / 2;
            y = road.y + road.height / 2;
            angle = 0;
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

    // 0 = midnight, 0.5 = noon, 1.0 = midnight
    timeOfDay = Math.abs((gameTime % DAY_LENGTH) / DAY_LENGTH);
    // Light is max (1.0) around 0.5, and min (0.2) around 0 and 1.0
    lightLevel = 0.2 + 0.8 * Math.max(0, Math.sin((timeOfDay - 0.25) * Math.PI * 2));

    // Update game state
    update(deltaTime);

    // Draw everything
    draw();
    drawMinimap();

    requestAnimationFrame(gameLoop);
}

// Update game state
function update(deltaTime) {
    if (typeof particleSystem !== 'undefined') {
        particleSystem.update(deltaTime);
    }

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

    // Check if player is in an exploded car
    if (player.inCar && player.car && player.car.exploded) {
        player.exitCar();
        playerHealth -= 20; // Player takes damage from explosion!
        if (playerHealth < 0) playerHealth = 0;
    }

    // Update player
    player.update(keys, world.buildings);

    // Update cars
    const worldSize = world.getWorldSize();
    // Update Global AllRoads array
    allRoads = [
        ...world.roads,
        ...world.horizontalRoads,
        ...world.verticalRoads,
        ...world.crossroads
    ];

    for (let car of cars) {
        car.update(keys, world.buildings, cars, allRoads, world.trafficLights, worldSize);
    }

    // Weapons logic
    if (typeof weaponSystem !== 'undefined') {
        if (!player.inCar) {
            // Only shoot / aim if mouse is down
            if (isMouseDown) {
                let targetWorldX = mouseX + camera.x;
                let targetWorldY = mouseY + camera.y;

                let dx = targetWorldX - (player.x + player.width / 2);
                let dy = targetWorldY - (player.y + player.height / 2);
                let angle = Math.atan2(dy, dx);

                player.overrideAngle = angle;
                weaponSystem.shoot(
                    player.x + player.width / 2 + Math.cos(angle) * 15,
                    player.y + player.height / 2 + Math.sin(angle) * 15,
                    angle, 'player'
                );
            } else {
                player.overrideAngle = null;
            }
        } else {
            player.overrideAngle = null;
        }

        weaponSystem.update(deltaTime, world.buildings, cars, worldSize);
    }

    // Update pedestrians
    for (let ped of pedestrians) {
        ped.update(world.buildings, cars, player, allRoads);
    }

    // Wanted Level Police Logic
    if (wantedLevel > 0) {
        let policeCount = cars.filter(c => c.isPolice && !c.exploded).length;
        if (policeCount < wantedLevel) {
            // Spawn a police car near player
            let spawnX = player.x + (Math.random() > 0.5 ? 800 : -800);
            let spawnXClamped = Math.max(0, Math.min(worldSize.width, spawnX));
            let spawnY = player.y + (Math.random() > 0.5 ? 800 : -800);
            let spawnYClamped = Math.max(0, Math.min(worldSize.height, spawnY));

            let newPolice = new Car(spawnXClamped, spawnYClamped, 0, false, '#222222');
            newPolice.isPolice = true;
            newPolice.maxSpeed = 6 + wantedLevel * 0.5; // Faster based on wanted level
            cars.push(newPolice);
        }

        // Make police chase player
        for (let car of cars) {
            if (car.isPolice && !car.exploded) {
                car.destination = { x: player.x, y: player.y }; // relentlessly pursue
            }
        }
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
    // Sync player position with car when in car
    if (player.inCar && player.car) {
        player.x = player.car.x + player.car.width / 2 - player.width / 2;
        player.y = player.car.y + player.car.height / 2 - player.height / 2;
    }

    // Update HUD elements
    const moneyEl = document.getElementById('money');
    if (moneyEl) moneyEl.textContent = `$${playerMoney.toString().padStart(8, '0')}`;

    const healthBar = document.getElementById('health-bar');
    if (healthBar) {
        healthBar.style.width = `${Math.max(0, playerHealth)}%`;
        if (playerHealth <= 25) {
            healthBar.classList.add('low-health');
        } else {
            healthBar.classList.remove('low-health');
        }
    }

    const armorBar = document.getElementById('armor-bar');
    if (armorBar) armorBar.style.width = `${Math.max(0, playerArmor)}%`;

    // Update Wanted Level Stars
    for (let i = 1; i <= 5; i++) {
        const star = document.getElementById(`star-${i}`);
        if (star) {
            if (i <= wantedLevel) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        }
    }
}

function drawMinimap() {
    if (!minimapCtx || !player) return;

    // Clear minimap
    minimapCtx.fillStyle = '#228B22'; // Grass color
    minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);

    minimapCtx.save();

    // Center minimap on player
    minimapCtx.translate(minimapCanvas.width / 2, minimapCanvas.height / 2);

    // Scale down the world
    const scale = 0.04;
    minimapCtx.scale(scale, scale);
    minimapCtx.translate(-player.x - player.width / 2, -player.y - player.height / 2);

    // Draw roads
    minimapCtx.fillStyle = '#444';
    for (let road of allRoads) {
        minimapCtx.fillRect(road.x, road.y, road.width, road.height);
    }

    // Draw buildings
    minimapCtx.fillStyle = '#8B4513';
    for (let b of world.buildings) {
        minimapCtx.fillRect(b.x, b.y, b.width, b.height);
    }

    // Draw cars
    minimapCtx.fillStyle = '#FF0000';
    for (let car of cars) {
        if (!car.isPlayerCar) {
            minimapCtx.fillRect(car.x, car.y, car.width, car.height);
        }
    }

    // Draw player
    minimapCtx.fillStyle = '#00FFFF';
    minimapCtx.beginPath();
    minimapCtx.arc(player.x + player.width / 2, player.y + player.height / 2, 60, 0, Math.PI * 2);
    minimapCtx.fill();

    minimapCtx.restore();
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
    // Generate sky color interpolating based on lightLevel
    const r = Math.floor(135 * lightLevel);
    const g = Math.floor(206 * lightLevel);
    const b = Math.floor(235 * lightLevel);

    // Draw sky gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, `rgb(${r}, ${g}, ${b})`); // Sky blue scaled down
    gradient.addColorStop(1, `rgb(${Math.floor(152 * lightLevel)}, ${Math.floor(251 * lightLevel)}, ${Math.floor(152 * lightLevel)})`); // Light green scaled
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

    if (typeof particleSystem !== 'undefined') {
        particleSystem.drawSkidMarks(ctx);
    }

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

        // Draw pedestrians
        for (let ped of pedestrians) {
            if (ped.state === 'dead' && ped.x > building.x && ped.x < building.x + building.width && ped.y > building.y && ped.y < building.y + building.height) {
                // hide dead bodies under buildings? or just draw generally
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
        if (!player.inCar && !car.exploded) {
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

    // Draw living pedestrians
    for (let ped of pedestrians) {
        ped.draw(ctx);
    }

    // Draw Darkness overlay if night
    const darkness = 1.0 - lightLevel;
    if (darkness > 0.1) { // 0.1 threshold to not draw if full day
        ctx.fillStyle = `rgba(5, 5, 20, ${darkness * 0.85})`;
        // Huge rect to cover camera
        ctx.fillRect(camera.x - CANVAS_WIDTH, camera.y - CANVAS_HEIGHT, CANVAS_WIDTH * 3, CANVAS_HEIGHT * 3);

        // Draw headlights over the darkness using lighter composition
        ctx.globalCompositeOperation = 'lighter';
        for (let car of cars) {
            // Check if car is on screen
            if (car.x > camera.x - car.width * 2 && car.x < camera.x + CANVAS_WIDTH + car.width * 2 &&
                car.y > camera.y - car.height * 2 && car.y < camera.y + CANVAS_HEIGHT + car.height * 2) {

                // Headlight parameters
                const lightLength = 300;
                const lightWidth = 100;

                ctx.save();
                ctx.translate(car.x + car.width / 2, car.y + car.height / 2);
                ctx.rotate(car.angle);

                // Create gradient for headlight beam
                const grad = ctx.createLinearGradient(car.width / 2, 0, car.width / 2 + lightLength, 0);
                grad.addColorStop(0, `rgba(255, 255, 200, ${0.4 * darkness})`);
                grad.addColorStop(1, 'rgba(255, 255, 200, 0)');

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(car.width / 2, -car.height / 2 + 5);
                ctx.lineTo(car.width / 2 + lightLength, -lightWidth / 2);
                ctx.lineTo(car.width / 2 + lightLength, lightWidth / 2);
                ctx.lineTo(car.width / 2, car.height / 2 - 5);
                ctx.closePath();
                ctx.fill();

                ctx.restore();
            }
        }
        ctx.globalCompositeOperation = 'source-over'; // reset
    }

    // Draw explosive/smoke effects OVER EVERYTHING else but under HUD
    if (typeof particleSystem !== 'undefined') {
        particleSystem.drawEffects(ctx);
    }

    // Draw bullets
    if (typeof weaponSystem !== 'undefined') {
        weaponSystem.draw(ctx);
    }

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
