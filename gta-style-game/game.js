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

    // Create pedestrians
    for (let i = 0; i < 55; i++) {
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

    for (let i = 0; i < 50; i++) {
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

    update(deltaTime);
    draw();
    drawMinimap();

    requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
    if (typeof particleSystem !== 'undefined') {
        particleSystem.update(deltaTime);
    }

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

    // Wanted Level & Police AI
    if (wantedLevel > 0) {
        let policeCount = cars.filter(c => c.isPolice && !c.exploded).length;
        if (policeCount < wantedLevel) {
            let spawnX = player.x + (Math.random() > 0.5 ? 900 : -900);
            let spawnY = player.y + (Math.random() > 0.5 ? 900 : -900);
            spawnX = Math.max(50, Math.min(worldSize.width - 50, spawnX));
            spawnY = Math.max(50, Math.min(worldSize.height - 50, spawnY));

            let pType = (wantedLevel >= 4) ? 'swat' : 'police';
            let newPolice = new Car(spawnX, spawnY, 0, false, null, pType);
            cars.push(newPolice);
        }

        for (let car of cars) {
            if (car.isPolice && !car.exploded) {
                car.destination = { x: player.x, y: player.y };
            }
        }
    }

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

    // Draw Landmarks with colored blips
    for (let lm of world.landmarks) {
        if (lm.type === 'pns') minimapCtx.fillStyle = '#FFD700'; // Gold wrench
        else if (lm.type === 'ammu') minimapCtx.fillStyle = '#FF3333'; // Red gun
        else if (lm.type === 'diner') minimapCtx.fillStyle = '#FF9900'; // Orange burger
        else if (lm.type === 'hospital') minimapCtx.fillStyle = '#FFFFFF'; // White cross
        else if (lm.type === 'police') minimapCtx.fillStyle = '#2979FF'; // Blue shield

        minimapCtx.beginPath();
        minimapCtx.arc(lm.bayX, lm.bayY, 90, 0, Math.PI * 2);
        minimapCtx.fill();
    }

    // Draw Cars
    for (let car of cars) {
        if (!car.isPlayerCar) {
            minimapCtx.fillStyle = car.isPolice ? '#2979FF' : '#FF5555';
            minimapCtx.fillRect(car.x, car.y, car.width, car.height);
        }
    }

    // Draw Player
    minimapCtx.fillStyle = '#00FFFF';
    minimapCtx.beginPath();
    minimapCtx.arc(player.x + player.width / 2, player.y + player.height / 2, 70, 0, Math.PI * 2);
    minimapCtx.fill();

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
    // Sky gradient background
    const r = Math.floor(135 * lightLevel);
    const g = Math.floor(206 * lightLevel);
    const b = Math.floor(235 * lightLevel);

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, `rgb(${r}, ${g}, ${b})`);
    gradient.addColorStop(1, `rgb(${Math.floor(152 * lightLevel)}, ${Math.floor(251 * lightLevel)}, ${Math.floor(152 * lightLevel)})`);
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

    // 12. Night Darkness & Headlight Beams
    const darkness = 1.0 - lightLevel;
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

window.onload = init;
