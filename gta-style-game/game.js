// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

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

    // Player's car - place on road
    let playerRoad = allRoads[Math.floor(Math.random() * allRoads.length)];
    cars.push(new Car(
        playerRoad.x + playerRoad.width / 2 - 25,
        playerRoad.y + playerRoad.height / 2 - 12,
        0,
        true,
        '#FF0000'
    ));

    // Other cars - place on roads
    for (let i = 0; i < 15; i++) {
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

// Game loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Update game state
function update() {
    // Update player
    player.update(keys, world.buildings);

    // Update cars
    const worldSize = world.getWorldSize();
    const allRoads = [
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

    // Check for entering/exiting cars
    if (keys['e']) {
        if (player.inCar) {
            player.exitCar();
        } else {
            player.enterCar(cars);
        }
        keys['e'] = false; // Prevent continuous triggering
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

// Update UI
function updateUI() {
    document.getElementById('player-status').textContent = player.inCar ? 'In Car' : 'On Foot';
    document.getElementById('speed').textContent = player.inCar ? `Speed: ${Math.round(player.car.speed * 10)}` : 'Speed: 0';

    // Sync player position with car when in car
    if (player.inCar && player.car) {
        player.x = player.car.x + player.car.width / 2 - player.width / 2;
        player.y = player.car.y + player.car.height / 2 - player.height / 2;
    }
}

// Draw everything
function draw() {
    // Clear canvas
    ctx.fillStyle = '#90EE90';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Save context and apply camera transform
    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Draw all road types
    ctx.fillStyle = '#333';
    const allRoads = [
        ...world.roads,
        ...world.horizontalRoads,
        ...world.verticalRoads,
        ...world.crossroads
    ];

    for (let road of allRoads) {
        ctx.fillRect(road.x, road.y, road.width, road.height);
    }

    // Draw road markings
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    for (let road of allRoads) {
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
    for (let building of world.buildings) {
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
    for (let light of world.trafficLights) {
        ctx.fillStyle = light.state === 'red' ? '#FF0000' : '#00FF00';
        ctx.fillRect(light.x - 5, light.y - 5, 10, 10);
    }

    // Draw cars
    for (let car of cars) {
        car.draw(ctx, camera.x, camera.y);
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
