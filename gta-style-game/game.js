// Game Core Engine, Rendering, District System, Landmarks, and Physics Loop

const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;

// Game variables
let canvas, ctx;
let keys = {};
let camera = { x: 0, y: 0, width: 900, height: 700 };
let mouseX = 0, mouseY = 0;
let isMouseDown = false;
let world;
let player;
let pedestrians = [];
let cars = [];
let lastTime = 0;
let fps = 0, frameCount = 0, lastFpsUpdate = 0;
let gameTime = 0;
let score = 0;
let distanceTraveled = 0;
let lastPlayerPos = { x: 0, y: 0 };
let allRoads = [];

// UI & Minimap Variables
let minimapCanvas, minimapCtx;
const DAY_LENGTH = 70000;
let timeOfDay = 0.5;
let lightLevel = 1.0;

let playerHealth = 100;
let playerArmor = 50;
let wantedLevel = 0;
let playerMoney = 800;

// Weapon Inventory
let playerWeaponIndex = 1; // 0=Fists, 1=Pistol, 2=Shotgun, 3=Uzi, 4=RPG
let playerAmmo = {
    0: Infinity,
    1: Infinity,
    2: 30,
    3: 180,
    4: 6
};

// District Tracking
let currentDistrict = "";
let districtBannerTimer = 0;

// Landmark Interaction Timers
let pnsCooldown = 0;
let shopCooldown = 0;

// Mission variables
let currentMission = null;
let missionPayphones = [
    { x: 1050, y: 950, radius: 15, active: true },
    { x: 3200, y: 1500, radius: 15, active: true },
    { x: 1500, y: 2800, radius: 15, active: true }
];
let notifTimer = 0;
let stuntBannerTimer = 0;
let radioBannerTimer = 0;

// Death / Arrest State
let gameState = 'playing'; // 'playing' | 'wasted' | 'busted'
let gameStateTimer = 0;
let invulnTimer = 0;
let deathFee = 0;

// Weather System
let weatherState = 'clear';
let weatherTimer = 35000;
let weatherTarget = 0;
let weatherIntensity = 0;
let rainDrops = [];
let lightningFlash = 0;
let boltPoints = null;
let boltLife = 0;

// Police Helicopter
let helicopter = null;

// Service Cooldowns
let gasCooldown = 0;
let casinoCooldown = 0;

// Ambient light (day/night cycle dimmed by storms)
let ambient = 1.0;

// Safe-driving score accumulator
let safeDrivingTime = 0;

function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    minimapCanvas = document.getElementById('minimap-canvas');
    if (minimapCanvas) {
        minimapCanvas.width = 220;
        minimapCanvas.height = 220;
        minimapCtx = minimapCanvas.getContext('2d');
    }

    // Load world from procedural multi-district layout
    world = World.loadFromEmbedded();

    // Spawn player in Downtown
    const worldSize = world.getWorldSize();
    let spawnX = 3300;
    let spawnY = 1500;

    let validRoads = [...world.horizontalRoads, ...world.verticalRoads];
    if (validRoads.length > 0) {
        let best = validRoads[0];
        let minDist = Infinity;
        for (let r of validRoads) {
            let d = (r.x + r.width / 2 - spawnX) ** 2 + (r.y + r.height / 2 - spawnY) ** 2;
            if (d < minDist) {
                minDist = d;
                best = r;
            }
        }
        spawnX = best.x + best.width / 2;
        spawnY = best.y + best.height / 2;
    }

    player = new Player(spawnX, spawnY, worldSize);

    // Create diverse vehicles
    createCars();
    createBoats();
    initRainPool();

    // Create pedestrians
    for (let i = 0; i < 80; i++) {
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
            if (typeof audioSystem !== 'undefined') audioSystem.playPunch();
        }

        // In-Car Radio Switcher (R Key)
        if (key === 'r') {
            if (player.inCar && typeof audioSystem !== 'undefined') {
                let stationName = audioSystem.nextStation();
                showRadioBanner(stationName);
            }
        }

        // Horn (H Key)
        if (key === 'h') {
            if (player.inCar && typeof audioSystem !== 'undefined') {
                audioSystem.playHorn(true);
            }
        }

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
        if (typeof audioSystem !== 'undefined') audioSystem.playPunch();
    });

    setupTouchControls();

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    });

    canvas.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        if (typeof audioSystem !== 'undefined') audioSystem.init();
    });

    canvas.addEventListener('mouseup', () => {
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

function createCars() {
    const allRoads = [
        ...world.roads,
        ...world.horizontalRoads,
        ...world.verticalRoads,
        ...world.crossroads
    ];

    const carTypes = ['sedan', 'supercar', 'muscle', 'taxi', 'bike', 'sedan', 'supercar', 'muscle'];

    for (let i = 0; i < 64; i++) {
        let road = allRoads[Math.floor(Math.random() * allRoads.length)];
        let x, y, angle;

        if (road.type === 'horizontal' || road.width > road.height) {
            x = road.x + Math.random() * road.width;
            y = road.y + road.height / 2 - 12;
            angle = Math.random() < 0.5 ? 0 : Math.PI;
        } else if (road.type === 'vertical' || road.height > road.width) {
            x = road.x + road.width / 2 - 22;
            y = road.y + Math.random() * road.height;
            angle = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        } else {
            x = road.x + road.width / 2;
            y = road.y + road.height / 2;
            angle = 0;
        }

        let type = carTypes[Math.floor(Math.random() * carTypes.length)];
        cars.push(new Car(x, y, angle, false, null, type));
    }

    // Spawn parked special vehicles near landmarks
    for (let lm of world.landmarks) {
        if (lm.type === 'hospital') {
            cars.push(new Car(lm.bayX + 50, lm.bayY - 20, 0, false, '#FFF', 'ambulance'));
        } else if (lm.type === 'police') {
            cars.push(new Car(lm.bayX + 50, lm.bayY - 20, 0, false, '#212121', 'police'));
        }
    }
}

function createBoats() {
    // Moored off the beach - steal one and take to the open sea!
    const spots = [
        { x: 50.4 * 96, y: 11 * 96, color: '#ECEFF1', angle: Math.PI },
        { x: 50.4 * 96, y: 26 * 96, color: '#FF7043', angle: Math.PI },
        { x: 52.2 * 96, y: 19 * 96, color: '#26C6DA', angle: 0 }
    ];
    for (let s of spots) {
        cars.push(new Boat(s.x, s.y, s.angle, s.color));
    }
}

function initRainPool() {
    rainDrops = [];
    for (let i = 0; i < 240; i++) {
        rainDrops.push({
            x: Math.random() * 2000,
            y: Math.random() * 1000,
            len: 12 + Math.random() * 14,
            spd: 15 + Math.random() * 10,
            drift: 2.2 + Math.random() * 1.6
        });
    }
}

function gameLoop(currentTime = 0) {
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    frameCount++;
    if (currentTime - lastFpsUpdate >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastFpsUpdate = currentTime;
    }

    gameTime += deltaTime;

    // Day/Night Cycle (0 = midnight, 0.5 = noon, 1.0 = midnight)
    timeOfDay = Math.abs((gameTime % DAY_LENGTH) / DAY_LENGTH);
    lightLevel = 0.25 + 0.75 * Math.max(0, Math.sin((timeOfDay - 0.25) * Math.PI * 2));
    ambient = lightLevel * (1 - 0.30 * weatherIntensity);

    update(deltaTime);
    draw();
    drawMinimap();

    requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
    if (typeof particleSystem !== 'undefined') {
        particleSystem.update(deltaTime);
    }

    updateWeather(deltaTime);

    // Wasted / Busted state: world freezes, overlay counts down to respawn
    if (gameState !== 'playing') {
        gameStateTimer -= deltaTime;
        if (gameStateTimer <= 0) respawnPlayer();
        updateCamera();
        updateUI();
        return;
    }

    if (invulnTimer > 0) invulnTimer--;

    const prevX = player.x;
    const prevY = player.y;

    // Enter / Exit Cars
    if (keys['e']) {
        if (player.inCar) {
            player.exitCar();
        } else {
            for (let car of cars) {
                if (Math.abs(player.x + player.width / 2 - (car.x + car.width / 2)) < 55 &&
                    Math.abs(player.y + player.height / 2 - (car.y + car.height / 2)) < 55) {
                    player.enterCar(car);
                    if (typeof audioSystem !== 'undefined') {
                        let stName = audioSystem.radioStations[audioSystem.currentStation].name;
                        showRadioBanner(stName);
                    }
                    break;
                }
            }
        }
        keys['e'] = false;
    }

    if (player.inCar && player.car && player.car.exploded) {
        player.exitCar();
        playerHealth = Math.max(0, playerHealth - 25);
    }

    player.update(keys, world.buildings);

    // Drowning: deep water is deadly on foot
    let pFootX = player.x + player.width / 2;
    let pFootY = player.y + player.height / 2;
    if (!player.inCar && isInDeepWater(pFootX, pFootY)) {
        damagePlayer(0.9);
        if (typeof particleSystem !== 'undefined' && Math.random() < 0.3) {
            particleSystem.addWaterSplash(pFootX, pFootY);
        }
    }

    // BUSTED: caught on foot by a slow-moving cop car
    if (wantedLevel > 0 && !player.inCar) {
        for (let car of cars) {
            if (car.isPolice && !car.exploded && Math.abs(car.speed) < 1.6) {
                let d = Math.sqrt((pFootX - car.x - car.width / 2) ** 2 + (pFootY - car.y - car.height / 2) ** 2);
                if (d < 58) {
                    startBusted();
                    break;
                }
            }
        }
    }

    const worldSize = world.getWorldSize();
    allRoads = [
        ...world.roads,
        ...world.horizontalRoads,
        ...world.verticalRoads,
        ...world.crossroads
    ];

    for (let car of cars) {
        car.update(keys, world.buildings, cars, allRoads, world.trafficLights, worldSize);
    }

    // Props & Collectibles Manager update
    if (typeof propsManager !== 'undefined') {
        propsManager.update(player, cars, this);
    }

    // Weapons logic
    if (typeof weaponSystem !== 'undefined') {
        if (!player.inCar) {
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

    // Pedestrians
    for (let ped of pedestrians) {
        ped.update(world.buildings, cars, player, allRoads);
    }

    // District Tracking & HUD Banner
    let px = player.inCar && player.car ? player.car.x + player.car.width / 2 : player.x + player.width / 2;
    let py = player.inCar && player.car ? player.car.y + player.car.height / 2 : player.y + player.height / 2;
    let distName = getDistrictNameAt(px, py);
    if (distName !== currentDistrict) {
        currentDistrict = distName;
        showDistrictBanner(currentDistrict);
    }

    // Interactive Landmark Services
    updateLandmarkInteractions(px, py);

    // Wanted Level & Police Escalation
    if (wantedLevel > 0) {
        let policeCount = cars.filter(c => c.isPolice && !c.exploded).length;
        let tankCount = cars.filter(c => c.type === 'tank' && !c.exploded).length;
        if (policeCount < wantedLevel + 1) {
            let spawnX = player.x + (Math.random() > 0.5 ? 900 : -900);
            let spawnY = player.y + (Math.random() > 0.5 ? 900 : -900);
            spawnX = Math.max(50, Math.min(worldSize.width - 50, spawnX));
            spawnY = Math.max(50, Math.min(worldSize.height - 50, spawnY));

            let pType = 'police';
            if (wantedLevel >= 5 && tankCount < 2) pType = 'tank';
            else if (wantedLevel >= 4) pType = 'swat';
            let newPolice = new Car(spawnX, spawnY, 0, false, null, pType);
            if (pType === 'tank') newPolice.isPolice = true;
            cars.push(newPolice);
        }

        for (let car of cars) {
            if (car.isPolice && !car.exploded) {
                car.destination = { x: player.x, y: player.y };
            }
        }

        // Police gunfire & tank cannon shells
        const pcx = player.inCar && player.car ? player.car.x + player.car.width / 2 : player.x + player.width / 2;
        const pcy = player.inCar && player.car ? player.car.y + player.car.height / 2 : player.y + player.height / 2;
        for (let car of cars) {
            if (car.exploded || !car.isPolice || car.isPlayerCar || car.isBoat) continue;
            const cx = car.x + car.width / 2;
            const cy = car.y + car.height / 2;
            const d = Math.sqrt((pcx - cx) ** 2 + (pcy - cy) ** 2);

            if (car.type === 'tank') {
                car.shellTimer = (car.shellTimer === undefined ? 150 : car.shellTimer) - 1;
                if (car.shellTimer <= 0 && d < 560 && d > 90) {
                    car.shellTimer = 150 + Math.random() * 90;
                    let ang = Math.atan2(pcy - cy, pcx - cx) + (Math.random() - 0.5) * 0.06;
                    weaponSystem.shootNPC(cx + Math.cos(ang) * 42, cy + Math.sin(ang) * 42, ang, 'shell');
                    if (typeof particleSystem !== 'undefined') {
                        particleSystem.addSmoke(cx + Math.cos(ang) * 42, cy + Math.sin(ang) * 42);
                    }
                }
            } else if (wantedLevel >= 2) {
                car.gunTimer = (car.gunTimer === undefined ? 0 : car.gunTimer) - 1;
                if (car.gunTimer <= 0 && d < 430) {
                    car.gunTimer = 50 + Math.random() * 60;
                    let tx = pcx, ty = pcy;
                    if (player.inCar && player.car) {
                        tx += player.car.vx * 12; // lead the target
                        ty += player.car.vy * 12;
                    }
                    let ang = Math.atan2(ty - cy, tx - cx) + (Math.random() - 0.5) * 0.08;
                    weaponSystem.shootNPC(cx + Math.cos(ang) * 26, cy + Math.sin(ang) * 26, ang, 'pistol');
                    if (typeof particleSystem !== 'undefined') {
                        particleSystem.addSparks(cx + Math.cos(ang) * 26, cy + Math.sin(ang) * 26, 0, 0, 3);
                    }
                }
            }
        }
    }

    updateHelicopter();

    updateCamera();
    updateScoring(prevX, prevY, deltaTime);

    // Active Mission Updates
    if (currentMission) {
        currentMission.timer -= deltaTime;
        if (currentMission.timer <= 0) {
            failMission("TIME IS UP!");
        } else {
            if (currentMission.type === 'taxi') {
                let pass = currentMission.passenger;
                if (!pass.pickedUp) {
                    let d = Math.sqrt((px - pass.x) ** 2 + (py - pass.y) ** 2);
                    if (player.inCar && player.car && d < 60 && Math.abs(player.car.speed) < 0.8) {
                        pass.pickedUp = true;
                        showMissionNotification("PASSENGER INSIDE", "Deliver them to the green target zone!");
                    }
                } else {
                    let d = Math.sqrt((px - currentMission.destination.x) ** 2 + (py - currentMission.destination.y) ** 2);
                    if (d < currentMission.destination.size && Math.abs(player.car.speed) < 0.8) {
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

            let activePolice = cars.find(c => c.isPolice && !c.exploded);
            if (activePolice && wantedLevel > 0) {
                audioSystem.playSiren(true);
            } else {
                audioSystem.playSiren(false);
            }
        }
    }

    updateUI();

    // Traffic light timing
    for (let light of world.trafficLights) {
        light.timer++;
        if (light.timer > 300) {
            light.state = light.state === 'red' ? 'green' : 'red';
            light.timer = 0;
        }
    }
}

function updateLandmarkInteractions(px, py) {
    if (pnsCooldown > 0) pnsCooldown--;
    if (shopCooldown > 0) shopCooldown--;
    if (gasCooldown > 0) gasCooldown--;
    if (casinoCooldown > 0) casinoCooldown--;

    for (let lm of world.landmarks) {
        let dist = Math.sqrt((px - lm.bayX) ** 2 + (py - lm.bayY) ** 2);

        if (lm.type === 'pns' && player.inCar && player.car && dist < 45 && pnsCooldown === 0) {
            // Pay 'n' Spray Trigger!
            if (player.car.health < player.car.maxHealth || wantedLevel > 0) {
                pnsCooldown = 180;
                let newColor = ['#E53935', '#1E88E5', '#43A047', '#FDD835', '#8E24AA', '#00ACC1', '#FB8C00'][Math.floor(Math.random() * 7)];
                player.car.color = newColor;
                player.car.health = player.car.maxHealth;
                wantedLevel = 0;

                if (typeof particleSystem !== 'undefined') {
                    particleSystem.addSprayMist(player.car.x + player.car.width / 2, player.car.y + player.car.height / 2, newColor);
                }
                if (typeof audioSystem !== 'undefined') {
                    audioSystem.playSpray();
                    audioSystem.playPickup('star');
                }
                showMissionNotification("PAY 'N' SPRAY", "Vehicle Repaired & Repainted! Wanted Level Cleared!", 3500);
            }
        } else if (lm.type === 'ammu' && !player.inCar && dist < 40) {
            const hint = document.getElementById('controls-hint');
            if (hint) hint.textContent = "AMMU-NATION: Press E to buy Combat Pack ($150)";
            if (keys['e'] && shopCooldown === 0 && playerMoney >= 150) {
                shopCooldown = 60;
                playerMoney -= 150;
                playerArmor = 100;
                playerAmmo[2] += 20;
                playerAmmo[3] += 100;
                playerAmmo[4] += 3;
                if (typeof audioSystem !== 'undefined') audioSystem.playPickup('weapon');
                showMissionNotification("AMMU-NATION", "Combat Pack Purchased! Full Armor & Ammo!", 2500);
                keys['e'] = false;
            }
        } else if (lm.type === 'diner' && !player.inCar && dist < 40) {
            const hint = document.getElementById('controls-hint');
            if (hint) hint.textContent = "BURGER SHOT: Press E to eat a Value Meal ($20)";
            if (keys['e'] && shopCooldown === 0 && playerMoney >= 20) {
                shopCooldown = 60;
                playerMoney -= 20;
                playerHealth = 100;
                if (typeof audioSystem !== 'undefined') audioSystem.playPickup('health');
                showMissionNotification("BURGER SHOT", "Delicious! Health Restored to 100%!", 2500);
                keys['e'] = false;
            }
        } else if (lm.type === 'gas' && player.inCar && player.car && dist < 55 && gasCooldown === 0) {
            const hint = document.getElementById('controls-hint');
            if (hint) hint.textContent = "FUEL STATION: Stop in the bay to repair ($50)";
            if (Math.abs(player.car.speed) < 0.6 && player.car.health < player.car.maxHealth && playerMoney >= 50) {
                gasCooldown = 120;
                playerMoney -= 50;
                player.car.health = player.car.maxHealth;

                if (typeof particleSystem !== 'undefined') {
                    particleSystem.addSprayMist(player.car.x + player.car.width / 2, player.car.y + player.car.height / 2, '#66BB6A');
                }
                if (typeof audioSystem !== 'undefined') audioSystem.playSpray();
                showMissionNotification("FUEL STATION", "Vehicle repaired for $50!", 2200);
            }
        } else if (lm.type === 'casino' && !player.inCar && dist < 45 && casinoCooldown === 0) {
            const hint = document.getElementById('controls-hint');
            if (hint) hint.textContent = "PINK PALACE CASINO: Press E to gamble $100";
            if (keys['e'] && playerMoney >= 100) {
                casinoCooldown = 90;
                if (Math.random() < 0.47) {
                    playerMoney += 150; // net +$50
                    score += 150;
                    if (typeof audioSystem !== 'undefined') {
                        audioSystem.playJackpot();
                        audioSystem.playPickup('cash');
                    }
                    if (typeof particleSystem !== 'undefined') {
                        particleSystem.addCashSparkles(px, py);
                    }
                    showMissionNotification("JACKPOT!", "The reels align! +$150!", 2500);
                } else {
                    playerMoney -= 100;
                    if (typeof audioSystem !== 'undefined') audioSystem.playMissionFailed();
                    showMissionNotification("HOUSE WINS", "The casino keeps your $100...", 2500);
                }
                keys['e'] = false;
            }
        }
    }
}

function showDistrictBanner(districtName) {
    const banner = document.getElementById('district-banner');
    const title = document.getElementById('district-name');
    if (banner && title) {
        title.textContent = districtName;
        banner.style.display = 'block';
        banner.classList.remove('fade-out');
        setTimeout(() => {
            if (banner) banner.style.display = 'none';
        }, 3500);
    }
}

function showRadioBanner(stationName) {
    const radioEl = document.getElementById('radio-banner');
    if (radioEl) {
        radioEl.textContent = `📻 ${stationName}`;
        radioEl.style.display = 'block';
        clearTimeout(radioBannerTimer);
        radioBannerTimer = setTimeout(() => {
            if (radioEl) radioEl.style.display = 'none';
        }, 2800);
    }
}

function showStuntBonus(distFeet, airtimeSecs, rewardCash) {
    playerMoney += rewardCash;
    score += rewardCash;
    const banner = document.getElementById('stunt-banner');
    const desc = document.getElementById('stunt-desc');
    if (banner && desc) {
        desc.innerHTML = `Distance: <b>${distFeet}ft</b> | Airtime: <b>${airtimeSecs}s</b><br><span style="color:#00FF66">+$${rewardCash} REWARD</span>`;
        banner.style.display = 'block';
        clearTimeout(stuntBannerTimer);
        stuntBannerTimer = setTimeout(() => {
            if (banner) banner.style.display = 'none';
        }, 3200);
    }
}

function updateScoring(prevX, prevY, deltaTime) {
    const currentX = player.x;
    const currentY = player.y;
    const distance = Math.sqrt((currentX - prevX) ** 2 + (currentY - prevY) ** 2);

    if (distance > 0) {
        distanceTraveled += distance;
        score += Math.floor(distance * 0.1);
    }

    if (player.inCar && player.car) {
        safeDrivingTime = (safeDrivingTime || 0) + deltaTime;
        if (safeDrivingTime > 1000) {
            score += 10;
            safeDrivingTime = 0;
        }
    }
}

function updateUI() {
    if (player.inCar && player.car) {
        player.x = player.car.x + player.car.width / 2 - player.width / 2;
        player.y = player.car.y + player.car.height / 2 - player.height / 2;
    }

    const moneyEl = document.getElementById('money');
    if (moneyEl) moneyEl.textContent = `$${playerMoney.toString().padStart(8, '0')}`;

    // Clock & Weather
    const clockEl = document.getElementById('clock');
    if (clockEl) {
        let totalMin = Math.floor(timeOfDay * 24 * 60);
        let hh = Math.floor(totalMin / 60) % 24;
        let mm = totalMin % 60;
        clockEl.textContent = `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
    }
    const weatherIconEl = document.getElementById('weather-icon');
    if (weatherIconEl) {
        weatherIconEl.textContent = { 'clear': '☀️', 'cloud': '⛅', 'rain': '🌧️', 'storm': '⛈️' }[weatherState] || '☀️';
    }

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

    const weaponIconEl = document.getElementById('weapon-icon');
    const ammoEl = document.getElementById('ammo');
    const weaponEmojis = ['👊', '🔫', '🎯', '🔥', '🚀'];

    if (weaponIconEl && typeof playerWeaponIndex !== 'undefined') {
        weaponIconEl.textContent = weaponEmojis[playerWeaponIndex];
    }
    if (ammoEl && typeof playerAmmo !== 'undefined' && typeof playerWeaponIndex !== 'undefined') {
        let amt = playerAmmo[playerWeaponIndex];
        ammoEl.textContent = amt === Infinity ? '∞' : amt;
    }

    // Mission Panel
    const missionPanel = document.getElementById('mission-panel');
    if (missionPanel) {
        if (currentMission) {
            missionPanel.style.display = 'block';
            document.getElementById('mission-title').textContent = currentMission.name;
            let inst = "";
            if (currentMission.type === 'taxi') {
                inst = currentMission.passenger.pickedUp ? "Deliver customer to green zone" : "Find passenger marked in magenta";
            } else if (currentMission.type === 'escape') {
                inst = "Survive wanted level 3 police chase!";
            } else if (currentMission.type === 'assassination') {
                inst = "Destroy maroon mob vehicle!";
            }
            document.getElementById('mission-instruction').textContent = inst;

            let secsTotal = Math.max(0, Math.floor(currentMission.timer / 1000));
            let mins = Math.floor(secsTotal / 60);
            let secs = secsTotal % 60;
            document.getElementById('mission-timer').textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            missionPanel.style.display = 'none';
        }
    }

    // Wanted Stars
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

    minimapCtx.fillStyle = '#1B5E20'; // Base terrain green
    minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);

    minimapCtx.save();
    minimapCtx.translate(minimapCanvas.width / 2, minimapCanvas.height / 2);

    const scale = 0.035;
    minimapCtx.scale(scale, scale);
    minimapCtx.translate(-player.x - player.width / 2, -player.y - player.height / 2);

    // Draw Water
    minimapCtx.fillStyle = '#023E8A';
    for (let w of world.waterTiles) {
        minimapCtx.fillRect(w.x, w.y, w.width, w.height);
    }

    // Draw Sand
    minimapCtx.fillStyle = '#EED8AE';
    for (let s of world.sandTiles) {
        minimapCtx.fillRect(s.x, s.y, s.width, s.height);
    }

    // Draw Roads
    minimapCtx.fillStyle = '#333333';
    for (let road of allRoads) {
        minimapCtx.fillRect(road.x, road.y, road.width, road.height);
    }

    // Draw Buildings
    minimapCtx.fillStyle = '#555555';
    for (let b of world.buildings) {
        minimapCtx.fillRect(b.x, b.y, b.width, b.height);
    }

    // Draw Runways & Aprons
    if (world.runwayTiles) {
        minimapCtx.fillStyle = '#3A3A3A';
        for (let rw of world.runwayTiles) {
            minimapCtx.fillRect(rw.x, rw.y, rw.width, rw.height);
        }
    }

    // Draw Landmarks with colored blips
    for (let lm of world.landmarks) {
        if (lm.type === 'pns') minimapCtx.fillStyle = '#FFD700'; // Gold wrench
        else if (lm.type === 'ammu') minimapCtx.fillStyle = '#FF3333'; // Red gun
        else if (lm.type === 'diner') minimapCtx.fillStyle = '#FF9900'; // Orange burger
        else if (lm.type === 'hospital') minimapCtx.fillStyle = '#FFFFFF'; // White cross
        else if (lm.type === 'police') minimapCtx.fillStyle = '#2979FF'; // Blue shield
        else if (lm.type === 'gas') minimapCtx.fillStyle = '#66BB6A'; // Green fuel
        else if (lm.type === 'casino') minimapCtx.fillStyle = '#FF4081'; // Pink casino

        minimapCtx.beginPath();
        minimapCtx.arc(lm.bayX, lm.bayY, 90, 0, Math.PI * 2);
        minimapCtx.fill();
    }

    // Draw Cars & Boats
    for (let car of cars) {
        if (!car.isPlayerCar) {
            minimapCtx.fillStyle = car.isBoat ? '#26C6DA' : (car.isPolice ? '#2979FF' : '#FF5555');
            minimapCtx.fillRect(car.x, car.y, car.width, car.height);
        }
    }

    // Draw Player
    minimapCtx.fillStyle = '#00FFFF';
    minimapCtx.beginPath();
    minimapCtx.arc(player.x + player.width / 2, player.y + player.height / 2, 70, 0, Math.PI * 2);
    minimapCtx.fill();

    // Draw Helicopter blip (blinking)
    if (helicopter && Math.floor(Date.now() / 300) % 2 === 0) {
        minimapCtx.fillStyle = '#FF1744';
        minimapCtx.beginPath();
        minimapCtx.arc(helicopter.x, helicopter.y, 90, 0, Math.PI * 2);
        minimapCtx.fill();
    }

    // Mission blips
    if (currentMission) {
        if (currentMission.type === 'taxi') {
            let pass = currentMission.passenger;
            let dest = currentMission.destination;
            if (!pass.pickedUp) {
                minimapCtx.fillStyle = '#FF00FF';
                minimapCtx.beginPath();
                minimapCtx.arc(pass.x, pass.y, 100, 0, Math.PI * 2);
                minimapCtx.fill();
            } else {
                minimapCtx.fillStyle = '#00FF00';
                minimapCtx.beginPath();
                minimapCtx.arc(dest.x, dest.y, 130, 0, Math.PI * 2);
                minimapCtx.fill();
            }
        } else if (currentMission.type === 'assassination') {
            let target = currentMission.target;
            if (target && !target.exploded) {
                minimapCtx.fillStyle = '#FF1744';
                minimapCtx.beginPath();
                minimapCtx.arc(target.x + target.width / 2, target.y + target.height / 2, 110, 0, Math.PI * 2);
                minimapCtx.fill();
            }
        }
    } else {
        // Draw Payphone blips
        minimapCtx.fillStyle = '#FFFF00';
        for (let phone of missionPayphones) {
            if (phone.active) {
                minimapCtx.beginPath();
                minimapCtx.arc(phone.x, phone.y, 80, 0, Math.PI * 2);
                minimapCtx.fill();
            }
        }
    }

    minimapCtx.restore();
}

function draw() {
    // Sky gradient background (dimmed by storms)
    const r = Math.floor(135 * ambient);
    const g = Math.floor(206 * ambient);
    const b = Math.floor(235 * ambient);

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, `rgb(${r}, ${g}, ${b})`);
    gradient.addColorStop(1, `rgb(${Math.floor(152 * ambient)}, ${Math.floor(251 * ambient)}, ${Math.floor(152 * ambient)})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // 1. Draw Base Grass
    ctx.fillStyle = '#2E7D32';
    ctx.fillRect(camera.x - 100, camera.y - 100, canvas.width + 200, canvas.height + 200);

    // 2. Draw Terrain (Beaches, Oceans with waves, Central Park, Swimming Pools)
    world.drawTerrain(ctx, camera, gameTime, lightLevel);

    // 3. Draw Roads, Sidewalks, and Markings
    const viewMargin = 120;
    const minX = camera.x - viewMargin;
    const maxX = camera.x + camera.width + viewMargin;
    const minY = camera.y - viewMargin;
    const maxY = camera.y + camera.height + viewMargin;

    // Sidewalks
    ctx.fillStyle = '#A0A0A0';
    for (let road of allRoads) {
        if (road.x >= minX && road.x <= maxX && road.y >= minY && road.y <= maxY) {
            ctx.fillRect(road.x - 8, road.y - 8, road.width + 16, road.height + 16);
        }
    }

    // Curbs
    ctx.fillStyle = '#757575';
    for (let road of allRoads) {
        if (road.x >= minX && road.x <= maxX && road.y >= minY && road.y <= maxY) {
            ctx.fillRect(road.x - 2, road.y - 2, road.width + 4, road.height + 4);
        }
    }

    // Dark Asphalt
    ctx.fillStyle = '#212121';
    for (let road of allRoads) {
        if (road.x >= minX && road.x <= maxX && road.y >= minY && road.y <= maxY) {
            ctx.fillRect(road.x, road.y, road.width, road.height);
        }
    }

    // Road Markings (Yellow double lines & white dashed lane dividers)
    for (let road of allRoads) {
        if (road.x < minX || road.x > maxX || road.y < minY || road.y > maxY) continue;

        ctx.lineWidth = 2;
        if (road.type === 'horizontal' || road.width > road.height) {
            ctx.strokeStyle = '#FFD700';
            ctx.beginPath();
            ctx.moveTo(road.x, road.y + road.height / 2 - 2);
            ctx.lineTo(road.x + road.width, road.y + road.height / 2 - 2);
            ctx.moveTo(road.x, road.y + road.height / 2 + 2);
            ctx.lineTo(road.x + road.width, road.y + road.height / 2 + 2);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            ctx.setLineDash([8, 12]);
            ctx.beginPath();
            ctx.moveTo(road.x, road.y + road.height * 0.25);
            ctx.lineTo(road.x + road.width, road.y + road.height * 0.25);
            ctx.moveTo(road.x, road.y + road.height * 0.75);
            ctx.lineTo(road.x + road.width, road.y + road.height * 0.75);
            ctx.stroke();
            ctx.setLineDash([]);
        } else if (road.type === 'vertical' || road.height > road.width) {
            ctx.strokeStyle = '#FFD700';
            ctx.beginPath();
            ctx.moveTo(road.x + road.width / 2 - 2, road.y);
            ctx.lineTo(road.x + road.width / 2 - 2, road.y + road.height);
            ctx.moveTo(road.x + road.width / 2 + 2, road.y);
            ctx.lineTo(road.x + road.width / 2 + 2, road.y + road.height);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            ctx.setLineDash([8, 12]);
            ctx.beginPath();
            ctx.moveTo(road.x + road.width * 0.25, road.y);
            ctx.lineTo(road.x + road.width * 0.25, road.y + road.height);
            ctx.moveTo(road.x + road.width * 0.75, road.y);
            ctx.lineTo(road.x + road.width * 0.75, road.y + road.height);
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            // Crossroads Zebra stripes
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            let w = road.width, h = road.height;
            for (let i = 10; i < w - 10; i += 12) {
                ctx.fillRect(road.x + i, road.y + 2, 6, 10);
                ctx.fillRect(road.x + i, road.y + h - 12, 6, 10);
            }
            for (let i = 10; i < h - 10; i += 12) {
                ctx.fillRect(road.x + 2, road.y + i, 10, 6);
                ctx.fillRect(road.x + w - 12, road.y + i, 10, 6);
            }
        }
    }

    // 4. Draw Skid Marks
    if (typeof particleSystem !== 'undefined') {
        particleSystem.drawSkidMarks(ctx);
    }

    // 5. Draw Interactive Landmark Zone Markers
    world.drawLandmarks(ctx, camera, gameTime);

    // 6. Draw 3D Parallax Buildings
    drawBuildings3D(ctx);

    // 7. Draw Traffic Lights
    for (let light of world.trafficLights) {
        if (light.x < minX || light.x > maxX || light.y < minY || light.y > maxY) continue;

        ctx.strokeStyle = '#444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(light.x, light.y);
        ctx.lineTo(light.x, light.y - 35);
        ctx.stroke();

        ctx.fillStyle = '#222';
        ctx.fillRect(light.x - 7, light.y - 32, 14, 26);

        ctx.fillStyle = light.state === 'red' ? '#FF3333' : '#440000';
        ctx.beginPath();
        ctx.arc(light.x, light.y - 23, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = light.state === 'green' ? '#33FF33' : '#004400';
        ctx.beginPath();
        ctx.arc(light.x, light.y - 12, 4.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // 8. Draw Props & World Pickups
    if (typeof propsManager !== 'undefined') {
        propsManager.draw(ctx, camera, gameTime, lightLevel);
    }

    // 9. Draw Cars
    for (let car of cars) {
        if (car.x >= minX && car.x <= maxX && car.y >= minY && car.y <= maxY) {
            car.draw(ctx, camera.x, camera.y);

            // Car entry indicator 'E'
            if (!player.inCar && !car.exploded) {
                let d = Math.sqrt((player.x + player.width / 2 - (car.x + car.width / 2)) ** 2 + (player.y + player.height / 2 - (car.y + car.height / 2)) ** 2);
                if (d < 60) {
                    ctx.fillStyle = '#FFFF00';
                    ctx.font = 'bold 14px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('E: Enter', car.x + car.width / 2, car.y - 12);
                }
            }
        }
    }

    // 10. Draw Player
    player.draw(ctx, camera.x, camera.y);

    // 11. Draw Pedestrians
    for (let ped of pedestrians) {
        if (ped.x >= minX && ped.x <= maxX && ped.y >= minY && ped.y <= maxY) {
            ped.draw(ctx);
        }
    }

    // 11b. Draw Police Helicopter (4+ stars)
    drawHelicopter(ctx);

    // 12. Night Darkness & Headlight Beams
    const darkness = 1.0 - ambient;
    if (darkness > 0.1) {
        ctx.fillStyle = `rgba(5, 5, 25, ${darkness * 0.82})`;
        ctx.fillRect(camera.x - 50, camera.y - 50, canvas.width + 100, canvas.height + 100);

        ctx.globalCompositeOperation = 'lighter';
        for (let car of cars) {
            if (car.x >= minX && car.x <= maxX && car.y >= minY && car.y <= maxY && !car.exploded) {
                const lightLength = 280;
                const lightWidth = 90;

                ctx.save();
                ctx.translate(car.x + car.width / 2, car.y + car.height / 2);
                ctx.rotate(car.angle);

                const grad = ctx.createLinearGradient(car.width / 2, 0, car.width / 2 + lightLength, 0);
                grad.addColorStop(0, `rgba(255, 255, 210, ${0.45 * darkness})`);
                grad.addColorStop(1, 'rgba(255, 255, 210, 0)');

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(car.width / 2, -car.height / 2 + 4);
                ctx.lineTo(car.width / 2 + lightLength, -lightWidth / 2);
                ctx.lineTo(car.width / 2 + lightLength, lightWidth / 2);
                ctx.lineTo(car.width / 2, car.height / 2 - 4);
                ctx.closePath();
                ctx.fill();

                ctx.restore();
            }
        }

        // Helicopter searchlight locked onto the player
        if (helicopter) {
            const hx = helicopter.x;
            const hy = helicopter.y;
            const px = player.x + player.width / 2;
            const py = player.y + player.height / 2;
            const ang = Math.atan2(py - hy, px - hx);
            const beamLen = Math.sqrt((px - hx) ** 2 + (py - hy) ** 2);

            ctx.save();
            ctx.translate(hx, hy);
            ctx.rotate(ang);
            const spotGrad = ctx.createLinearGradient(0, 0, beamLen, 0);
            spotGrad.addColorStop(0, `rgba(255, 255, 200, ${0.5 * Math.max(darkness, 0.25)})`);
            spotGrad.addColorStop(1, 'rgba(255, 255, 200, 0)');
            ctx.fillStyle = spotGrad;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(beamLen, -110);
            ctx.lineTo(beamLen, 110);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        ctx.globalCompositeOperation = 'source-over';
    }

    // 13. Explosions & Particles
    if (typeof particleSystem !== 'undefined') {
        particleSystem.drawEffects(ctx);
    }

    // 14. Weapon Projectiles
    if (typeof weaponSystem !== 'undefined') {
        weaponSystem.draw(ctx);
    }

    // 15. Draw Payphones
    for (let phone of missionPayphones) {
        if (phone.active && !currentMission) {
            let flash = Math.sin(gameTime * 0.008) * 0.2 + 0.8;
            ctx.fillStyle = `rgba(255, 215, 0, ${0.25 * flash})`;
            ctx.beginPath();
            ctx.arc(phone.x, phone.y, 25, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#FFD700';
            ctx.fillRect(phone.x - 8, phone.y - 12, 16, 24);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(phone.x - 8, phone.y - 12, 16, 24);

            ctx.fillStyle = '#000';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('📞', phone.x, phone.y);

            let dist = Math.sqrt((player.x + player.width / 2 - phone.x) ** 2 + (player.y + player.height / 2 - phone.y) ** 2);
            if (dist < 40 && !player.inCar) {
                ctx.fillStyle = '#FFFF99';
                ctx.font = 'bold 12px Arial';
                ctx.fillText('E: Answer Phone', phone.x, phone.y - 20);

                if (keys['e']) {
                    startRandomMission();
                    keys['e'] = false;
                }
            }
        }
    }

    // 16. Mission Target Indicators
    if (currentMission) {
        if (currentMission.type === 'taxi') {
            let pass = currentMission.passenger;
            let dest = currentMission.destination;
            if (!pass.pickedUp) {
                let bounce = Math.sin(gameTime * 0.01) * 6;
                ctx.fillStyle = '#00FF00';
                ctx.beginPath();
                ctx.moveTo(pass.x, pass.y - 15 + bounce);
                ctx.lineTo(pass.x - 6, pass.y - 24 + bounce);
                ctx.lineTo(pass.x + 6, pass.y - 24 + bounce);
                ctx.closePath();
                ctx.fill();
            } else {
                let flash = Math.sin(gameTime * 0.008) * 0.2 + 0.6;
                ctx.fillStyle = `rgba(0, 255, 0, ${0.2 * flash})`;
                ctx.beginPath();
                ctx.arc(dest.x, dest.y, dest.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#00FF00';
                ctx.lineWidth = 2.5;
                ctx.stroke();
            }
        } else if (currentMission.type === 'assassination') {
            let target = currentMission.target;
            if (target && !target.exploded) {
                let bounce = Math.sin(gameTime * 0.01) * 6;
                ctx.fillStyle = '#FF1744';
                ctx.beginPath();
                ctx.moveTo(target.x + target.width / 2, target.y - 16 + bounce);
                ctx.lineTo(target.x + target.width / 2 - 7, target.y - 25 + bounce);
                ctx.lineTo(target.x + target.width / 2 + 7, target.y - 25 + bounce);
                ctx.closePath();
                ctx.fill();
            }
        }
    }

    ctx.restore();

    // 17. Weather Effects (screen space)
    // Wet sheen over everything during rain
    if (weatherIntensity > 0.05) {
        ctx.fillStyle = `rgba(25, 45, 75, ${0.10 * weatherIntensity})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Rain streaks
    if (weatherIntensity > 0.03) {
        const activeCount = Math.floor(rainDrops.length * weatherIntensity);
        ctx.strokeStyle = 'rgba(185, 215, 255, 0.42)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i < activeCount; i++) {
            let d = rainDrops[i];
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x - d.drift * 2.2, d.y - d.len);
        }
        ctx.stroke();
    }

    // Lightning bolt
    if (boltLife > 0 && boltPoints) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 230, 0.95)';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#BFE3FF';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        boltPoints.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.stroke();
        ctx.restore();
    }

    // Lightning flash
    if (lightningFlash > 0.02) {
        ctx.fillStyle = `rgba(240, 246, 255, ${lightningFlash * 0.5})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function drawBuildings3D(ctx) {
    const camCenterX = camera.x + canvas.width / 2;
    const camCenterY = camera.y + canvas.height / 2;
    const viewMargin = 120;
    const minX = camera.x - viewMargin;
    const maxX = camera.x + camera.width + viewMargin;
    const minY = camera.y - viewMargin;
    const maxY = camera.y + camera.height + viewMargin;

    for (let building of world.buildings) {
        if (building.x < minX || building.x > maxX || building.y < minY || building.y > maxY) continue;

        let screenX = (building.x + building.width / 2) - camCenterX;
        let screenY = (building.y + building.height / 2) - camCenterY;

        let prFactor = building.style === 'downtown' ? 0.22 : 0.14;
        let offsetX = screenX * prFactor;
        let offsetY = screenY * prFactor;

        let b1x = building.x, b1y = building.y;
        let b2x = building.x + building.width, b2y = building.y;
        let b3x = building.x + building.width, b3y = building.y + building.height;
        let b4x = building.x, b4y = building.y + building.height;

        let r1x = b1x + offsetX, r1y = b1y + offsetY;
        let r2x = b2x + offsetX, r2y = b2y + offsetY;
        let r3x = b3x + offsetX, r3y = b3y + offsetY;
        let r4x = b4x + offsetX, r4y = b4y + offsetY;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.moveTo(b1x, b1y);
        ctx.lineTo(b2x, b2y);
        ctx.lineTo(r2x + 8, r2y + 8);
        ctx.lineTo(r3x + 8, r3y + 8);
        ctx.lineTo(r4x + 8, r4y + 8);
        ctx.lineTo(b4x, b4y);
        ctx.closePath();
        ctx.fill();

        // Shaded Walls
        let wallColor = '#5D4037';
        if (building.style === 'downtown') wallColor = '#263238';
        if (building.style === 'chinatown') wallColor = '#B71C1C';
        if (building.style === 'industrial') wallColor = '#455A64';
        if (building.style === 'suburb') wallColor = '#795548';

        if (offsetX > 0) {
            ctx.fillStyle = wallColor;
            ctx.beginPath();
            ctx.moveTo(b1x, b1y);
            ctx.lineTo(b4x, b4y);
            ctx.lineTo(r4x, r4y);
            ctx.lineTo(r1x, r1y);
            ctx.closePath();
            ctx.fill();
        }
        if (offsetX < 0) {
            ctx.fillStyle = '#1A1A1A';
            ctx.beginPath();
            ctx.moveTo(b2x, b2y);
            ctx.lineTo(b3x, b3y);
            ctx.lineTo(r3x, r3y);
            ctx.lineTo(r2x, r2y);
            ctx.closePath();
            ctx.fill();
        }
        if (offsetY > 0) {
            ctx.fillStyle = wallColor;
            ctx.beginPath();
            ctx.moveTo(b1x, b1y);
            ctx.lineTo(b2x, b2y);
            ctx.lineTo(r2x, r2y);
            ctx.lineTo(r1x, r1y);
            ctx.closePath();
            ctx.fill();
        }
        if (offsetY < 0) {
            ctx.fillStyle = '#111111';
            ctx.beginPath();
            ctx.moveTo(b3x, b3y);
            ctx.lineTo(b4x, b4y);
            ctx.lineTo(r4x, r4y);
            ctx.lineTo(r3x, r3y);
            ctx.closePath();
            ctx.fill();
        }

        // Roof
        if (building.style === 'downtown') {
            // Cyan glass skyscraper roof
            const roofGrad = ctx.createLinearGradient(r1x, r1y, r3x, r3y);
            roofGrad.addColorStop(0, '#00ACC1');
            roofGrad.addColorStop(1, '#006064');
            ctx.fillStyle = roofGrad;
        } else if (building.style === 'chinatown') {
            // Red / Gold Pagoda roof
            ctx.fillStyle = '#C62828';
        } else if (building.style === 'industrial') {
            // Corrugated metal gray
            ctx.fillStyle = '#78909C';
        } else if (building.style === 'suburb') {
            ctx.fillStyle = '#D84315';
        } else if (building.style === 'container') {
            ctx.fillStyle = building.color || '#D32F2F';
        } else if (building.style === 'pns') {
            ctx.fillStyle = '#F57F17';
        } else if (building.style === 'ammu') {
            ctx.fillStyle = '#B71C1C';
        } else if (building.style === 'diner') {
            ctx.fillStyle = '#E65100';
        } else {
            ctx.fillStyle = '#8D6E63';
        }

        ctx.beginPath();
        ctx.moveTo(r1x, r1y);
        ctx.lineTo(r2x, r2y);
        ctx.lineTo(r3x, r3y);
        ctx.lineTo(r4x, r4y);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Downtown Helipad / AC
        if (building.style === 'downtown') {
            ctx.strokeStyle = '#FFF';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(r1x + building.width / 2, r1y + building.height / 2, building.width * 0.18, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#FFF';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('H', r1x + building.width / 2, r1y + building.height / 2);
        }

        // Chinatown Neon Signs
        if (building.style === 'chinatown') {
            let neonFlash = Math.sin(gameTime * 0.01) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(255, 235, 59, ${neonFlash})`;
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('龙 DRAGON WOK 龙', r1x + building.width / 2, r1y + building.height / 2);
        }
    }
}

function setupTouchControls() {
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
        }
    };

    bindButton('btn-action', 'e');
    bindButton('btn-brake', ' ');
}

function updateCamera() {
    const worldSize = world.getWorldSize();
    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;

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
        setTimeout(() => {
            if (banner) banner.style.display = 'none';
        }, duration);
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
            name: 'TAXI FARE',
            passenger: { x: passengerX, y: passengerY, pickedUp: false },
            destination: { x: destX, y: destY, size: 45 },
            timer: 60000,
            reward: 1200
        };
        showMissionNotification("TAXI MISSION", "Pick up passenger in magenta and drive to green target zone!");
    } else if (type === 'escape') {
        currentMission = {
            type: 'escape',
            name: 'POLICE CHASE',
            timer: 45000,
            reward: 1800
        };
        wantedLevel = 3;
        showMissionNotification("POLICE CHASE", "Lose wanted stars or survive 45 seconds!");
    } else if (type === 'assassination') {
        const worldSize = world.getWorldSize();
        let spawnX = player.x + (Math.random() > 0.5 ? 700 : -700);
        let spawnY = player.y + (Math.random() > 0.5 ? 700 : -700);
        spawnX = Math.max(100, Math.min(worldSize.width - 100, spawnX));
        spawnY = Math.max(100, Math.min(worldSize.height - 100, spawnY));

        let targetCar = new Car(spawnX, spawnY, 0, false, '#800000', 'muscle');
        targetCar.health = 250;
        targetCar.maxSpeed = 6.2;
        cars.push(targetCar);

        currentMission = {
            type: 'assassination',
            name: 'MOB HIT',
            target: targetCar,
            timer: 75000,
            reward: 2500
        };
        showMissionNotification("ELIMINATE TARGET", "Find and destroy the maroon mob vehicle!");
    }
}

function passMission() {
    if (!currentMission) return;
    playerMoney += currentMission.reward;
    score += currentMission.reward;
    showMissionNotification("MISSION PASSED!", `+$${currentMission.reward}`);
    if (typeof audioSystem !== 'undefined') audioSystem.playMissionPassed();

    playerAmmo[2] = Math.min(playerAmmo[2] + 12, 50);
    playerAmmo[3] = Math.min(playerAmmo[3] + 60, 300);
    playerAmmo[4] = Math.min(playerAmmo[4] + 2, 8);

    currentMission = null;
}

function failMission(reason = "") {
    if (!currentMission) return;
    showMissionNotification("MISSION FAILED", reason || "Busted!");
    if (typeof audioSystem !== 'undefined') audioSystem.playMissionFailed();

    if (currentMission.type === 'assassination' && currentMission.target) {
        currentMission.target.exploded = true;
    }
    currentMission = null;
}

// ============ PLAYER DAMAGE & DEATH SYSTEM ============

function damagePlayer(amount) {
    if (gameState !== 'playing' || invulnTimer > 0) return;
    if (playerArmor > 0) {
        playerArmor -= amount;
        if (playerArmor < 0) {
            playerHealth += playerArmor;
            playerArmor = 0;
        }
    } else {
        playerHealth -= amount;
    }
    if (playerHealth <= 0) {
        playerHealth = 0;
        startWasted();
    }
}

function startWasted() {
    if (gameState !== 'playing') return;
    gameState = 'wasted';
    gameStateTimer = 4200;
    deathFee = Math.min(playerMoney, 300);
    if (player.inCar) player.exitCar();
    showDeathOverlay('WASTED', `Hospital bills: -$${deathFee}`, 'wasted');
    if (typeof audioSystem !== 'undefined') audioSystem.playMissionFailed();
}

function startBusted() {
    if (gameState !== 'playing') return;
    gameState = 'busted';
    gameStateTimer = 4200;
    deathFee = Math.min(playerMoney, 150);
    if (player.inCar) player.exitCar();
    wantedLevel = 0;
    showDeathOverlay('BUSTED', `Bail & confiscated ammo: -$${deathFee}`, 'busted');
    if (typeof audioSystem !== 'undefined') audioSystem.playMissionFailed();
}

function respawnPlayer() {
    const isWasted = gameState === 'wasted';
    const wantType = isWasted ? 'hospital' : 'police';

    // Respawn at the nearest hospital or police HQ
    let target = null, bestDist = Infinity;
    for (let lm of world.landmarks) {
        if (lm.type !== wantType) continue;
        let d = (lm.bayX - player.x) ** 2 + (lm.bayY - player.y) ** 2;
        if (d < bestDist) {
            bestDist = d;
            target = lm;
        }
    }

    let spawn = target ? snapToNearestRoad(target.bayX, target.bayY) : { x: player.x, y: player.y };
    player.x = spawn.x - player.width / 2;
    player.y = spawn.y - player.height / 2;

    playerMoney = Math.max(0, playerMoney - deathFee);
    playerHealth = 100;
    playerArmor = 0;
    wantedLevel = 0;
    helicopter = null;
    playerAmmo[2] = Math.floor(playerAmmo[2] / 2);
    playerAmmo[3] = Math.floor(playerAmmo[3] / 2);
    playerAmmo[4] = Math.floor(playerAmmo[4] / 2);

    invulnTimer = 240;
    gameState = 'playing';
    hideDeathOverlay();
    showMissionNotification(
        isWasted ? "DISCHARGED" : "RELEASED",
        isWasted ? "Patched up at General Hospital. Stay sharp out there." : "The cops kept your ammo. Try to stay out of trouble."
    );
}

function snapToNearestRoad(x, y) {
    let best = null, bd = Infinity;
    for (let r of [...world.horizontalRoads, ...world.verticalRoads]) {
        let d = (r.x + r.width / 2 - x) ** 2 + (r.y + r.height / 2 - y) ** 2;
        if (d < bd) {
            bd = d;
            best = r;
        }
    }
    return best ? { x: best.x + best.width / 2, y: best.y + best.height / 2 } : { x, y };
}

function showDeathOverlay(title, subtitle, cls) {
    const overlay = document.getElementById('death-overlay');
    const titleEl = document.getElementById('death-title');
    const subEl = document.getElementById('death-sub');
    if (overlay && titleEl && subEl) {
        titleEl.textContent = title;
        subEl.textContent = subtitle;
        overlay.className = cls;
        overlay.style.display = 'flex';
    }
}

function hideDeathOverlay() {
    const overlay = document.getElementById('death-overlay');
    if (overlay) overlay.style.display = 'none';
}

// ============ WATER HELPERS ============

function isInDeepWater(px, py) {
    if (typeof world === 'undefined' || !world.waterTiles) return false;
    for (let w of world.waterTiles) {
        if (px >= w.x && px <= w.x + w.width && py >= w.y && py <= w.y + w.height) {
            return w.type === 'W';
        }
    }
    return false;
}

// ============ WEATHER SYSTEM ============

function updateWeather(deltaTime) {
    weatherTimer -= deltaTime;

    if (weatherTimer <= 0) {
        if (weatherState === 'clear') {
            weatherState = 'cloud';
            weatherTarget = 0.35;
            weatherTimer = 16000 + Math.random() * 10000;
        } else if (weatherState === 'cloud') {
            if (Math.random() < 0.65) {
                weatherState = 'rain';
                weatherTarget = 0.7;
                weatherTimer = 24000 + Math.random() * 12000;
            } else {
                weatherState = 'clear';
                weatherTarget = 0;
                weatherTimer = 45000 + Math.random() * 25000;
            }
        } else if (weatherState === 'rain') {
            if (Math.random() < 0.5) {
                weatherState = 'storm';
                weatherTarget = 1.0;
                weatherTimer = 18000 + Math.random() * 12000;
            } else {
                weatherState = 'clear';
                weatherTarget = 0;
                weatherTimer = 45000 + Math.random() * 25000;
            }
        } else {
            weatherState = 'clear';
            weatherTarget = 0;
            weatherTimer = 50000 + Math.random() * 30000;
        }
    }

    // Smooth intensity easing toward the state's target
    weatherIntensity += (weatherTarget - weatherIntensity) * 0.015;
    if (weatherTarget === 0 && weatherIntensity < 0.01) weatherIntensity = 0;

    // Rain ambience volume
    if (typeof audioSystem !== 'undefined' && audioSystem.updateRain) {
        audioSystem.updateRain(weatherIntensity);
    }

    // Lightning strikes during storms
    lightningFlash *= 0.90;
    if (boltLife > 0) boltLife--;
    if (weatherState === 'storm' && weatherIntensity > 0.8 && Math.random() < 0.008) {
        strikeLightning();
    }

    // Move rain drops (screen space)
    const activeCount = Math.floor(rainDrops.length * weatherIntensity);
    for (let i = 0; i < activeCount; i++) {
        let d = rainDrops[i];
        d.y += d.spd;
        d.x += d.drift;
        if (d.y > canvas.height + 20) {
            d.y = -20 - Math.random() * 40;
            d.x = Math.random() * (canvas.width + 80) - 40;
        }
        if (d.x > canvas.width + 40) d.x -= canvas.width + 80;
    }
}

function strikeLightning() {
    lightningFlash = 1;
    boltLife = 7;
    boltPoints = [];
    let bx = Math.random() * canvas.width;
    let by = 0;
    const endY = canvas.height * (0.35 + Math.random() * 0.25);
    boltPoints.push({ x: bx, y: by });
    while (by < endY) {
        by += 18 + Math.random() * 30;
        bx += (Math.random() - 0.5) * 46;
        boltPoints.push({ x: bx, y: Math.min(by, endY) });
    }
    if (typeof audioSystem !== 'undefined') {
        setTimeout(() => audioSystem.playThunder(), 120 + Math.random() * 700);
    }
}

// ============ POLICE HELICOPTER ============

function updateHelicopter() {
    const wanted = wantedLevel >= 4;

    if (!helicopter && wanted && gameState === 'playing') {
        helicopter = {
            x: player.x + 500,
            y: player.y - 420,
            angle: 0,
            rotor: 0,
            orbit: Math.random() * Math.PI * 2,
            gunTimer: 140
        };
        showMissionNotification("AIR SUPPORT", "Police chopper inbound. Keep moving!", 3000);
    }

    if (!helicopter) return;
    const h = helicopter;
    h.rotor += 0.9;

    // Wanted level dropped: fly away and despawn
    if (!wanted || gameState !== 'playing') {
        h.x += 7;
        h.y -= 5;
        const ws = world.getWorldSize();
        if (h.x > ws.width + 400 || h.y < -600) helicopter = null;
        return;
    }

    // Circle strafing above the player
    h.orbit += 0.006;
    const tx = player.x + player.width / 2 + Math.cos(h.orbit) * 180;
    const ty = player.y + player.height / 2 + Math.sin(h.orbit) * 180;
    const dx = tx - h.x;
    const dy = ty - h.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const sp = Math.min(d * 0.028, 5.2);
    h.angle = Math.atan2(dy, dx);
    h.x += dx / d * sp;
    h.y += dy / d * sp;

    // Door gunner bursts
    h.gunTimer--;
    if (h.gunTimer <= 0) {
        h.gunTimer = 85 + Math.random() * 70;
        const pcx = player.inCar && player.car ? player.car.x + player.car.width / 2 : player.x + player.width / 2;
        const pcy = player.inCar && player.car ? player.car.y + player.car.height / 2 : player.y + player.height / 2;
        const base = Math.atan2(pcy - h.y, pcx - h.x);
        for (let i = -1; i <= 1; i++) {
            weaponSystem.shootNPC(h.x, h.y, base + i * 0.09 + (Math.random() - 0.5) * 0.04, 'pistol');
        }
        if (typeof particleSystem !== 'undefined') {
            particleSystem.addSparks(h.x + Math.cos(base) * 22, h.y + Math.sin(base) * 22, 0, 0, 4);
        }
    }
}

function drawHelicopter(ctx) {
    if (!helicopter) return;
    const h = helicopter;

    // Ground shadow offset below the chopper
    ctx.save();
    ctx.translate(h.x + 55, h.y + 70);
    ctx.scale(1, 0.55);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.angle);

    // Tail boom
    ctx.fillStyle = '#37474F';
    ctx.fillRect(-38, -3, 30, 6);
    // Tail fin
    ctx.fillStyle = '#263238';
    ctx.fillRect(-44, -10, 6, 12);
    // Spinning tail rotor
    ctx.strokeStyle = '#90A4AE';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-41, -12 + Math.sin(h.rotor * 2) * 6);
    ctx.lineTo(-41, 2 - Math.sin(h.rotor * 2) * 6);
    ctx.stroke();

    // Body
    ctx.fillStyle = '#2E4053';
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cockpit glass
    ctx.fillStyle = 'rgba(135, 206, 250, 0.9)';
    ctx.beginPath();
    ctx.ellipse(14, -2, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Skids
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, 14); ctx.lineTo(14, 14);
    ctx.moveTo(-8, 10); ctx.lineTo(-8, 14);
    ctx.moveTo(10, 10); ctx.lineTo(10, 14);
    ctx.stroke();

    // Main rotor mast + spinning blades
    ctx.fillStyle = '#455A64';
    ctx.fillRect(-2, -2, 4, 4);
    ctx.strokeStyle = 'rgba(210, 225, 235, 0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(h.rotor) * 46, Math.sin(h.rotor) * 46);
    ctx.lineTo(-Math.cos(h.rotor) * 46, -Math.sin(h.rotor) * 46);
    ctx.stroke();

    // Blinking nav light
    if (Math.floor(Date.now() / 220) % 2 === 0) {
        ctx.fillStyle = '#FF1744';
        ctx.beginPath();
        ctx.arc(-20, -6, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

window.onload = init;
