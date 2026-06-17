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

// Weapon Inventory variables
let playerWeaponIndex = 1; // 0=Fists, 1=Pistol, 2=Shotgun, 3=Uzi, 4=RPG
let playerAmmo = {
    0: Infinity, // Fists
    1: Infinity, // Pistol
    2: 30,       // Shotgun
    3: 150,      // Uzi
    4: 6         // RPG
};

// Mission variables
let currentMission = null;
let missionPayphone = { x: 788, y: 756, radius: 15, active: true };
let notifTimer = 0;

// Initialize game
function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    
    // Set dynamic sizing
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

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
    document.addEventListener('keydown', (e) => {
        if (!e.key) return;
        const key = e.key.toLowerCase();
        const code = e.code ? e.code.toLowerCase() : '';
        keys[key] = true;
        if (code) keys[code] = true;
        
        // Weapon switching 1-5
        if (['1', '2', '3', '4', '5'].includes(key)) {
            playerWeaponIndex = parseInt(key) - 1;
            if (typeof audioSystem !== 'undefined') audioSystem.playPunch(); // click sound
        }

        // Horn key H
        if (key === 'h') {
            if (player.inCar && typeof audioSystem !== 'undefined') {
                audioSystem.playHorn(true);
            }
        }

        // Prevent scrolling with arrows and space
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
            e.preventDefault();
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (!e.key) return;
        const key = e.key.toLowerCase();
        const code = e.code ? e.code.toLowerCase() : '';
        keys[key] = false;
        if (code) keys[code] = false;

        // Stop Horn
        if (key === 'h') {
            if (typeof audioSystem !== 'undefined') {
                audioSystem.playHorn(false);
            }
        }
    });

    window.addEventListener('wheel', (e) => {
        if (e.deltaY > 0) {
            playerWeaponIndex = (playerWeaponIndex + 1) % 5;
        } else {
            playerWeaponIndex = (playerWeaponIndex - 1 + 5) % 5;
        }
        if (typeof audioSystem !== 'undefined') audioSystem.playPunch(); // click sound
    });

    setupTouchControls();

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

function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    camera.width = canvas.width;
    camera.height = canvas.height;
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

    // Update active mission
    if (currentMission) {
        currentMission.timer -= deltaTime;
        if (currentMission.timer <= 0) {
            failMission("TIME IS UP!");
        } else {
            if (currentMission.type === 'taxi') {
                let pass = currentMission.passenger;
                if (!pass.pickedUp) {
                    let px = player.inCar && player.car ? player.car.x + player.car.width/2 : player.x + player.width/2;
                    let py = player.inCar && player.car ? player.car.y + player.car.height/2 : player.y + player.height/2;
                    let dx = px - pass.x;
                    let dy = py - pass.y;
                    let dist = Math.sqrt(dx*dx + dy*dy);
                    
                    if (player.inCar && player.car && dist < 55 && Math.abs(player.car.speed) < 0.8) {
                        pass.pickedUp = true;
                        showMissionNotification("PASSENGER INSIDE", "Deliver them to the green target zone!");
                    }
                } else {
                    let px = player.inCar && player.car ? player.car.x + player.car.width/2 : player.x + player.width/2;
                    let py = player.inCar && player.car ? player.car.y + player.car.height/2 : player.y + player.height/2;
                    let dx = px - currentMission.destination.x;
                    let dy = py - currentMission.destination.y;
                    let dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < currentMission.destination.size && Math.abs(player.car.speed) < 0.8) {
                        passMission();
                    }
                }
            } else if (currentMission.type === 'escape') {
                if (wantedLevel === 0) {
                    passMission();
                }
            } else if (currentMission.type === 'assassination') {
                if (currentMission.target && currentMission.target.exploded) {
                    passMission();
                }
            }
        }
    }

    // Notification banner timer
    if (notifTimer > 0) {
        notifTimer -= deltaTime;
        if (notifTimer <= 0) {
            const banner = document.getElementById('big-notification');
            if (banner) banner.style.display = 'none';
        }
    }

    // Audio updates
    if (typeof audioSystem !== 'undefined') {
        if (player.inCar && player.car) {
            let speedRatio = Math.abs(player.car.speed) / player.car.maxSpeed;
            let isAccelerating = keys['w'] || keys['keyw'] || keys['arrowup'];
            audioSystem.updateEngine(speedRatio, isAccelerating);

            let lateralV = -player.car.vx * Math.sin(player.car.angle) + player.car.vy * Math.cos(player.car.angle);
            let drift = Math.abs(lateralV);
            if (keys[' ']) drift += 1.5;
            audioSystem.updateDrift(drift);

            if (player.car.isPolice && !player.car.exploded) {
                audioSystem.playSiren(true);
            } else {
                audioSystem.playSiren(false);
            }
        } else {
            audioSystem.updateEngine(0, false);
            audioSystem.updateDrift(0);

            // Play sirens if police are actively chasing
            let activePolice = cars.find(c => c.isPolice && !c.exploded);
            if (activePolice && wantedLevel > 0) {
                audioSystem.playSiren(true);
            } else {
                audioSystem.playSiren(false);
            }
        }
    }

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

    // Update Weapon Box
    const weaponIconEl = document.getElementById('weapon-icon');
    const ammoEl = document.getElementById('ammo');
    const weaponEmojis = ['👊', '🔫', '🎯', '🔥', '🚀']; // Fists, Pistol, Shotgun, Uzi, RPG

    if (weaponIconEl && typeof playerWeaponIndex !== 'undefined') {
        weaponIconEl.textContent = weaponEmojis[playerWeaponIndex];
    }
    if (ammoEl && typeof playerAmmo !== 'undefined' && typeof playerWeaponIndex !== 'undefined') {
        let amt = playerAmmo[playerWeaponIndex];
        ammoEl.textContent = amt === Infinity ? '∞' : amt;
    }

    // Update Mission Panel
    const missionPanel = document.getElementById('mission-panel');
    if (missionPanel) {
        if (currentMission) {
            missionPanel.style.display = 'block';
            document.getElementById('mission-title').textContent = currentMission.name;
            
            let inst = "";
            if (currentMission.type === 'taxi') {
                inst = currentMission.passenger.pickedUp ? "Deliver customer to green zone" : "Find passenger marked in green";
            } else if (currentMission.type === 'escape') {
                inst = "Lose wanted level or survive wanted level 3!";
            } else if (currentMission.type === 'assassination') {
                inst = "Destroy target maroon car (chase red arrow)";
            }
            document.getElementById('mission-instruction').textContent = inst;

            // Timer display mm:ss
            let secsTotal = Math.max(0, Math.floor(currentMission.timer / 1000));
            let mins = Math.floor(secsTotal / 60);
            let secs = secsTotal % 60;
            document.getElementById('mission-timer').textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            missionPanel.style.display = 'none';
        }
    }

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

    // Draw mission targets on minimap
    if (currentMission) {
        if (currentMission.type === 'taxi') {
            let pass = currentMission.passenger;
            let dest = currentMission.destination;
            if (!pass.pickedUp) {
                minimapCtx.fillStyle = '#FF00FF'; // passenger blip (magenta)
                minimapCtx.beginPath();
                minimapCtx.arc(pass.x, pass.y, 80, 0, Math.PI * 2);
                minimapCtx.fill();
            } else {
                minimapCtx.fillStyle = '#00FF00'; // destination blip (green)
                minimapCtx.beginPath();
                minimapCtx.arc(dest.x, dest.y, 120, 0, Math.PI * 2);
                minimapCtx.fill();
            }
        } else if (currentMission.type === 'assassination') {
            let target = currentMission.target;
            if (target && !target.exploded) {
                minimapCtx.fillStyle = '#FF3333'; // target blip (red)
                minimapCtx.beginPath();
                minimapCtx.arc(target.x + target.width/2, target.y + target.height/2, 90, 0, Math.PI * 2);
                minimapCtx.fill();
            }
        }
    } else if (typeof missionPayphone !== 'undefined' && missionPayphone.active) {
        // Draw payphone blip
        minimapCtx.fillStyle = '#FFFF00'; // payphone (yellow)
        minimapCtx.beginPath();
        minimapCtx.arc(missionPayphone.x, missionPayphone.y, 75, 0, Math.PI * 2);
        minimapCtx.fill();
    }

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
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, `rgb(${r}, ${g}, ${b})`); // Sky blue scaled down
    gradient.addColorStop(1, `rgb(${Math.floor(152 * lightLevel)}, ${Math.floor(251 * lightLevel)}, ${Math.floor(152 * lightLevel)})`); // Light green scaled
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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

    // Draw sidewalks first (large concrete bases under the roads)
    ctx.fillStyle = '#a0a0a0'; // Concrete sidewalk color
    for (let road of allRoads) {
        ctx.fillRect(road.x - 8, road.y - 8, road.width + 16, road.height + 16);
    }

    // Draw curbs (darker concrete border)
    ctx.fillStyle = '#7a7a7a';
    for (let road of allRoads) {
        ctx.fillRect(road.x - 2, road.y - 2, road.width + 4, road.height + 4);
    }

    // Draw asphalt (road bed)
    ctx.fillStyle = '#222222'; // Dark asphalt
    for (let road of allRoads) {
        ctx.fillRect(road.x, road.y, road.width, road.height);
    }

    // Draw markings (yellow centerlines and white lanes)
    for (let road of allRoads) {
        ctx.lineWidth = 2;
        if (road.type === 'horizontal' || road.width > road.height) {
            // Double yellow line in the center
            ctx.strokeStyle = '#FFD700';
            ctx.beginPath();
            ctx.moveTo(road.x, road.y + road.height / 2 - 2);
            ctx.lineTo(road.x + road.width, road.y + road.height / 2 - 2);
            ctx.moveTo(road.x, road.y + road.height / 2 + 2);
            ctx.lineTo(road.x + road.width, road.y + road.height / 2 + 2);
            ctx.stroke();

            // Dashed white lane dividers (left & right lanes)
            ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            ctx.setLineDash([8, 12]);
            ctx.beginPath();
            // top half divider
            ctx.moveTo(road.x, road.y + road.height * 0.25);
            ctx.lineTo(road.x + road.width, road.y + road.height * 0.25);
            // bottom half divider
            ctx.moveTo(road.x, road.y + road.height * 0.75);
            ctx.lineTo(road.x + road.width, road.y + road.height * 0.75);
            ctx.stroke();
            ctx.setLineDash([]);
        } else if (road.type === 'vertical' || road.height > road.width) {
            // Double yellow line in the center
            ctx.strokeStyle = '#FFD700';
            ctx.beginPath();
            ctx.moveTo(road.x + road.width / 2 - 2, road.y);
            ctx.lineTo(road.x + road.width / 2 - 2, road.y + road.height);
            ctx.moveTo(road.x + road.width / 2 + 2, road.y);
            ctx.lineTo(road.x + road.width / 2 + 2, road.y + road.height);
            ctx.stroke();

            // Dashed white lane dividers
            ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            ctx.setLineDash([8, 12]);
            ctx.beginPath();
            // left half divider
            ctx.moveTo(road.x + road.width * 0.25, road.y);
            ctx.lineTo(road.x + road.width * 0.25, road.y + road.height);
            // right half divider
            ctx.moveTo(road.x + road.width * 0.75, road.y);
            ctx.lineTo(road.x + road.width * 0.75, road.y + road.height);
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            // Crossroads/Intersections
            // Draw crosswalk stripes (zebra crossing) on all 4 entrances
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            let w = road.width;
            let h = road.height;
            // Zebra horizontal (top & bottom)
            for (let i = 10; i < w - 10; i += 12) {
                ctx.fillRect(road.x + i, road.y + 2, 6, 10);
                ctx.fillRect(road.x + i, road.y + h - 12, 6, 10);
            }
            // Zebra vertical (left & right)
            for (let i = 10; i < h - 10; i += 12) {
                ctx.fillRect(road.x + 2, road.y + i, 10, 6);
                ctx.fillRect(road.x + w - 12, road.y + i, 10, 6);
            }
        }
    }

    if (typeof particleSystem !== 'undefined') {
        particleSystem.drawSkidMarks(ctx);
    }

    // Draw buildings with 3D parallax extrusion
    const camCenterX = camera.x + canvas.width / 2;
    const camCenterY = camera.y + canvas.height / 2;

    for (let building of world.buildings) {
        // Calculate camera-relative screen offset for 3D depth effect
        let screenX = (building.x + building.width / 2) - camCenterX;
        let screenY = (building.y + building.height / 2) - camCenterY;

        // Projection factors (tweak to change building height)
        let prFactor = 0.16; 
        let offsetX = screenX * prFactor;
        let offsetY = screenY * prFactor;

        // Base Corners
        let b1x = building.x, b1y = building.y;
        let b2x = building.x + building.width, b2y = building.y;
        let b3x = building.x + building.width, b3y = building.y + building.height;
        let b4x = building.x, b4y = building.y + building.height;

        // Roof Corners
        let r1x = b1x + offsetX, r1y = b1y + offsetY;
        let r2x = b2x + offsetX, r2y = b2y + offsetY;
        let r3x = b3x + offsetX, r3y = b3y + offsetY;
        let r4x = b4x + offsetX, r4y = b4y + offsetY;

        // Draw Shadows of the walls and building
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.moveTo(b1x, b1y);
        ctx.lineTo(b2x, b2y);
        ctx.lineTo(r2x + 8, r2y + 8);
        ctx.lineTo(r3x + 8, r3y + 8);
        ctx.lineTo(r4x + 8, r4y + 8);
        ctx.lineTo(b4x, b4y);
        ctx.closePath();
        ctx.fill();

        // Render Walls (only walls facing the camera)
        // Left Wall
        if (offsetX > 0) {
            ctx.fillStyle = '#653c24'; // Shaded wall brown
            ctx.beginPath();
            ctx.moveTo(b1x, b1y);
            ctx.lineTo(b4x, b4y);
            ctx.lineTo(r4x, r4y);
            ctx.lineTo(r1x, r1y);
            ctx.closePath();
            ctx.fill();
        }
        // Right Wall
        if (offsetX < 0) {
            ctx.fillStyle = '#422412'; // Darker shaded wall brown
            ctx.beginPath();
            ctx.moveTo(b2x, b2y);
            ctx.lineTo(b3x, b3y);
            ctx.lineTo(r3x, r3y);
            ctx.lineTo(r2x, r2y);
            ctx.closePath();
            ctx.fill();
        }
        // Top Wall
        if (offsetY > 0) {
            ctx.fillStyle = '#7c4c30'; // Lighter brown wall
            ctx.beginPath();
            ctx.moveTo(b1x, b1y);
            ctx.lineTo(b2x, b2y);
            ctx.lineTo(r2x, r2y);
            ctx.lineTo(r1x, r1y);
            ctx.closePath();
            ctx.fill();
        }
        // Bottom Wall
        if (offsetY < 0) {
            ctx.fillStyle = '#311a0d'; // Darkest brown wall
            ctx.beginPath();
            ctx.moveTo(b3x, b3y);
            ctx.lineTo(b4x, b4y);
            ctx.lineTo(r4x, r4y);
            ctx.lineTo(r3x, r3y);
            ctx.closePath();
            ctx.fill();
        }

        // Draw Roof
        const roofGradient = ctx.createLinearGradient(r1x, r1y, r3x, r3y);
        roofGradient.addColorStop(0, '#a55c32'); // Terracotta roof color
        roofGradient.addColorStop(1, '#82421f');
        ctx.fillStyle = roofGradient;
        ctx.beginPath();
        ctx.moveTo(r1x, r1y);
        ctx.lineTo(r2x, r2y);
        ctx.lineTo(r3x, r3y);
        ctx.lineTo(r4x, r4y);
        ctx.closePath();
        ctx.fill();

        // Roof Border
        ctx.strokeStyle = '#5c2d14';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Roof Details: Helipad or Air Conditioner boxes
        ctx.fillStyle = '#555';
        ctx.fillRect(r1x + building.width * 0.3, r1y + building.height * 0.3, building.width * 0.4, building.height * 0.4);
        ctx.strokeStyle = '#333';
        ctx.strokeRect(r1x + building.width * 0.3, r1y + building.height * 0.3, building.width * 0.4, building.height * 0.4);
        
        // Helipad circle
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(r1x + building.width / 2, r1y + building.height / 2, building.width * 0.15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('H', r1x + building.width / 2, r1y + building.height / 2);
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
        ctx.fillRect(camera.x - canvas.width, camera.y - canvas.height, canvas.width * 3, canvas.height * 3);

        // Draw headlights over the darkness using lighter composition
        ctx.globalCompositeOperation = 'lighter';
        for (let car of cars) {
            // Check if car is on screen
            if (car.x > camera.x - car.width * 2 && car.x < camera.x + canvas.width + car.width * 2 &&
                car.y > camera.y - car.height * 2 && car.y < camera.y + canvas.height + car.height * 2) {

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

    // Draw Payphone
    if (typeof missionPayphone !== 'undefined' && missionPayphone.active && !currentMission) {
        let flash = Math.sin(Date.now() * 0.015) * 0.2 + 0.8;
        ctx.fillStyle = `rgba(255, 215, 0, ${0.25 * flash})`;
        ctx.beginPath();
        ctx.arc(missionPayphone.x, missionPayphone.y, 30, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFF00'; // yellow phone booth
        ctx.fillRect(missionPayphone.x - 8, missionPayphone.y - 12, 16, 24);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.8;
        ctx.strokeRect(missionPayphone.x - 8, missionPayphone.y - 12, 16, 24);

        ctx.fillStyle = '#000';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📞', missionPayphone.x, missionPayphone.y);

        let dist = Math.sqrt((player.x + player.width/2 - missionPayphone.x)**2 + (player.y + player.height/2 - missionPayphone.y)**2);
        if (dist < 40 && !player.inCar) {
            ctx.fillStyle = '#FFFF99';
            ctx.font = 'bold 12px Arial';
            ctx.fillText('E: Answer Phone', missionPayphone.x, missionPayphone.y - 20);

            if (keys['e']) {
                startRandomMission();
                keys['e'] = false; // consume E
            }
        }
    }

    // Draw active mission targets
    if (currentMission) {
        if (currentMission.type === 'taxi') {
            let pass = currentMission.passenger;
            let dest = currentMission.destination;
            if (!pass.pickedUp) {
                // Draw passenger
                ctx.fillStyle = '#FF00FF'; // magenta shirt
                ctx.beginPath();
                ctx.arc(pass.x, pass.y, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#FDBCB4'; // skin head
                ctx.beginPath();
                ctx.arc(pass.x, pass.y - 8, 4, 0, Math.PI * 2);
                ctx.fill();

                // Blinking green indicator
                let bounce = Math.sin(Date.now() * 0.015) * 6;
                ctx.fillStyle = '#00FF00';
                ctx.beginPath();
                ctx.moveTo(pass.x, pass.y - 15 + bounce);
                ctx.lineTo(pass.x - 5, pass.y - 23 + bounce);
                ctx.lineTo(pass.x + 5, pass.y - 23 + bounce);
                ctx.closePath();
                ctx.fill();
            } else {
                // Draw destination zone
                let flash = Math.sin(Date.now() * 0.012) * 0.2 + 0.6;
                ctx.fillStyle = `rgba(0, 255, 0, ${0.2 * flash})`;
                ctx.beginPath();
                ctx.arc(dest.x, dest.y, dest.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = `rgba(0, 255, 0, ${flash})`;
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(dest.x, dest.y, dest.size, 0, Math.PI * 2);
                ctx.stroke();

                ctx.fillStyle = '#00FF00';
                ctx.font = 'bold 12px Arial';
                ctx.fillText('TARGET ZONE', dest.x, dest.y - dest.size - 5);
            }
        } else if (currentMission.type === 'assassination') {
            let target = currentMission.target;
            if (target && !target.exploded) {
                let bounce = Math.sin(Date.now() * 0.015) * 6;
                ctx.fillStyle = '#FF3333';
                ctx.beginPath();
                ctx.moveTo(target.x + target.width/2, target.y - 15 + bounce);
                ctx.lineTo(target.x + target.width/2 - 6, target.y - 23 + bounce);
                ctx.lineTo(target.x + target.width/2 + 6, target.y - 23 + bounce);
                ctx.closePath();
                ctx.fill();
            }
        }
    }

    // Restore context
    ctx.restore();
}

function setupTouchControls() {
    // Add click handler for the toggle button (works on desktop & mobile)
    const toggleBtn = document.getElementById('btn-toggle-touch');
    const touchPanel = document.getElementById('touch-controls');
    
    if (toggleBtn && touchPanel) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (touchPanel.style.display === 'block') {
                touchPanel.style.display = 'none';
            } else {
                touchPanel.style.display = 'block';
            }
            if (typeof audioSystem !== 'undefined') audioSystem.playPunch();
        });
    }

    const joystickZone = document.getElementById('joystick-zone');
    const joystickKnob = document.getElementById('joystick-knob');
    let joystickActive = false;
    let joystickOrigin = { x: 0, y: 0 };
    const maxDistance = 40;

    if (joystickZone) {
        // Touch events
        joystickZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            joystickActive = true;
            const touch = e.touches[0];
            const rect = joystickZone.getBoundingClientRect();
            joystickOrigin = { x: rect.width / 2, y: rect.height / 2 };
            updateJoystick(touch.clientX - rect.left, touch.clientY - rect.top);
        }, { passive: false });

        joystickZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!joystickActive) return;
            const touch = e.touches[0];
            const rect = joystickZone.getBoundingClientRect();
            updateJoystick(touch.clientX - rect.left, touch.clientY - rect.top);
        }, { passive: false });

        // Mouse events for joystick testing on desktop
        joystickZone.addEventListener('mousedown', (e) => {
            joystickActive = true;
            const rect = joystickZone.getBoundingClientRect();
            joystickOrigin = { x: rect.width / 2, y: rect.height / 2 };
            updateJoystick(e.clientX - rect.left, e.clientY - rect.top);
        });

        document.addEventListener('mousemove', (e) => {
            if (!joystickActive) return;
            const rect = joystickZone.getBoundingClientRect();
            updateJoystick(e.clientX - rect.left, e.clientY - rect.top);
        });

        const resetJoystick = () => {
            joystickActive = false;
            joystickKnob.style.transform = `translate(0px, 0px)`;
            keys['w'] = false;
            keys['a'] = false;
            keys['s'] = false;
            keys['d'] = false;
        };

        joystickZone.addEventListener('touchend', resetJoystick);
        joystickZone.addEventListener('touchcancel', resetJoystick);
        document.addEventListener('mouseup', resetJoystick);

        function updateJoystick(x, y) {
            let dx = x - joystickOrigin.x;
            let dy = y - joystickOrigin.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > maxDistance) {
                dx = (dx / distance) * maxDistance;
                dy = (dy / distance) * maxDistance;
            }

            joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;

            keys['w'] = dy < -10;
            keys['s'] = dy > 10;
            keys['a'] = dx < -10;
            keys['d'] = dx > 10;
        }
    }

    const bindButton = (id, key) => {
        const btn = document.getElementById(id);
        if (btn) {
            // Touch
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                keys[key] = true;
                btn.style.backgroundColor = 'rgba(255, 255, 255, 0.4)';
            }, { passive: false });
            const resetBtn = (e) => {
                e.preventDefault();
                keys[key] = false;
                btn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            };
            btn.addEventListener('touchend', resetBtn);
            btn.addEventListener('touchcancel', resetBtn);

            // Mouse
            btn.addEventListener('mousedown', (e) => {
                keys[key] = true;
                btn.style.backgroundColor = 'rgba(255, 255, 255, 0.4)';
            });
            btn.addEventListener('mouseup', () => {
                keys[key] = false;
                btn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            });
            btn.addEventListener('mouseleave', () => {
                keys[key] = false;
                btn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            });
        }
    };

    bindButton('btn-action', 'e');
    bindButton('btn-brake', ' ');
}

function updateCamera() {
    const worldSize = world.getWorldSize();
    // Camera follows the player
    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;

    // Keep camera within world bounds
    camera.x = Math.max(0, Math.min(worldSize.width - canvas.width, camera.x));
    camera.y = Math.max(0, Math.min(worldSize.height - canvas.height, camera.y));
}

function showMissionNotification(title, desc, duration = 4000) {
    const banner = document.getElementById('big-notification');
    const t = document.getElementById('notif-title');
    const d = document.getElementById('notif-desc');
    if (banner && t && d) {
        t.textContent = title;
        d.textContent = desc;
        banner.style.display = 'block';
        notifTimer = duration;
    }
}

function startRandomMission() {
    let missionTypes = ['taxi', 'escape', 'assassination'];
    let type = missionTypes[Math.floor(Math.random() * missionTypes.length)];

    if (type === 'taxi') {
        let allValidRoads = [...world.horizontalRoads, ...world.verticalRoads];
        let randRoad = allValidRoads[Math.floor(Math.random() * allValidRoads.length)];
        let passengerX = randRoad.x + randRoad.width / 2;
        let passengerY = randRoad.y + randRoad.height / 2;

        let destRoad = randRoad;
        while (destRoad === randRoad) {
            destRoad = allValidRoads[Math.floor(Math.random() * allValidRoads.length)];
        }
        let destX = destRoad.x + destRoad.width / 2;
        let destY = destRoad.y + destRoad.height / 2;

        currentMission = {
            type: 'taxi',
            name: 'TAXI DRIVER',
            passenger: { x: passengerX, y: passengerY, pickedUp: false },
            destination: { x: destX, y: destY, size: 40 },
            timer: 60000,
            reward: 1200
        };
        showMissionNotification("TAXI MISSION", "Pick up the magenta passenger waving on the street!");
    } else if (type === 'escape') {
        currentMission = {
            type: 'escape',
            name: 'POLICE CHASE',
            timer: 45000,
            reward: 1800
        };
        wantedLevel = 3;
        showMissionNotification("POLICE CHASE", "Survive wanted level 3 police for 45 seconds!");
    } else if (type === 'assassination') {
        const worldSize = world.getWorldSize();
        let spawnX = player.x + (Math.random() > 0.5 ? 600 : -600);
        let spawnY = player.y + (Math.random() > 0.5 ? 600 : -600);
        spawnX = Math.max(100, Math.min(worldSize.width - 100, spawnX));
        spawnY = Math.max(100, Math.min(worldSize.height - 100, spawnY));

        let targetCar = new Car(spawnX, spawnY, 0, false, '#800000');
        targetCar.health = 220;
        targetCar.maxSpeed = 5.2;
        targetCar.isTarget = true;
        cars.push(targetCar);

        currentMission = {
            type: 'assassination',
            name: 'MOB TIE-UP',
            target: targetCar,
            timer: 75000,
            reward: 2500
        };
        showMissionNotification("ELIMINATE TARGET", "Find and destroy the maroon target car!");
    }
}

function passMission() {
    if (!currentMission) return;
    playerMoney += currentMission.reward;
    score += currentMission.reward;
    showMissionNotification("MISSION PASSED!", `+$${currentMission.reward}`);
    if (typeof audioSystem !== 'undefined') audioSystem.playMissionPassed();
    
    // Auto-replenish ammo as a bonus!
    playerAmmo[2] = Math.min(playerAmmo[2] + 8, 45);
    playerAmmo[3] = Math.min(playerAmmo[3] + 40, 250);
    playerAmmo[4] = Math.min(playerAmmo[4] + 2, 8);
    
    currentMission = null;
}

function failMission(reason = "") {
    if (!currentMission) return;
    showMissionNotification("MISSION FAILED", reason || "Busted!");
    if (typeof audioSystem !== 'undefined') audioSystem.playMissionFailed();
    
    // Clear targets
    if (currentMission.type === 'assassination' && currentMission.target) {
        currentMission.target.exploded = true; // remove target car
    }
    
    currentMission = null;
}

// Start the game when page loads
window.onload = init;
