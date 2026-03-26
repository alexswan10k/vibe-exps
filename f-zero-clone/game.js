/**
 * F-Zero Clone - Mode 7 style renderer using HTML5 Canvas (CPU Raycaster approach)
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const width = canvas.width;
const height = canvas.height;

// Game State
let gameState = {
    x: 200,          // Track map coordinates
    y: 750,
    angle: 0,        // Facing right by default? Actually standard math has 0 = East
    speed: 0,
    maxSpeed: 8,     // Map pixels per frame
    acceleration: 0.1,
    friction: 0.95,
    turnSpeed: 0.05,
    lap: 1,
    checkpoints: [false, false, false], // Very simple checkpoint system
};

// Controls
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
});
window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

// Assets (from assets.js)
let trackTexture, trackData, carSprite, skyTexture;

// Render Setup
const fov = Math.PI / 3; // 60 degrees
const halfFov = fov / 2;
const projectionPlaneY = height / 2; // Horizon line

// We need image data for fast pixel access for the track
function initAssets() {
    const trackCanvas = generateTrackTexture();
    trackTexture = trackCanvas;

    // Get track pixel data
    const tCtx = trackCanvas.getContext('2d', { willReadFrequently: true });
    trackData = tCtx.getImageData(0, 0, trackSize, trackSize);

    carSprite = generateCarSprite();
    skyTexture = generateSkyTexture();
}

function update() {
    // Handle Input
    if (keys.ArrowUp) {
        gameState.speed += gameState.acceleration;
    } else if (keys.ArrowDown) {
        gameState.speed -= gameState.acceleration * 1.5; // Brakes are stronger
    } else {
        // Natural friction
        gameState.speed *= gameState.friction;
    }

    // Cap speed
    gameState.speed = Math.max(-2, Math.min(gameState.speed, gameState.maxSpeed));

    // Turn (only turn if moving, turning radius depends on speed)
    if (Math.abs(gameState.speed) > 0.1) {
        let turnAmount = gameState.turnSpeed * (gameState.speed / gameState.maxSpeed);
        if (gameState.speed < 0) turnAmount *= -1; // Reverse steering

        if (keys.ArrowLeft) gameState.angle -= turnAmount;
        if (keys.ArrowRight) gameState.angle += turnAmount;
    }

    // Update Position
    gameState.x += Math.cos(gameState.angle) * gameState.speed;
    gameState.y += Math.sin(gameState.angle) * gameState.speed;

    // Keep on track texture (wrap around for infinite map, though we have a circuit)
    if (gameState.x < 0) gameState.x += trackSize;
    if (gameState.x >= trackSize) gameState.x -= trackSize;
    if (gameState.y < 0) gameState.y += trackSize;
    if (gameState.y >= trackSize) gameState.y -= trackSize;

    // Update HUD
    const speedKmh = Math.abs(Math.round((gameState.speed / gameState.maxSpeed) * 450));
    document.getElementById('speedometer').innerText = speedKmh + " km/h";

    // Simple lap logic based on position
    checkLap();
}

function checkLap() {
    // Very rudimentary lap detection based on bounding boxes on the map
    // We expect the player to go clockwise: bottom -> left -> top -> right -> bottom

    // Checkpoint 1: top left corner
    if (gameState.x > 150 && gameState.x < 250 && gameState.y > 150 && gameState.y < 250) {
        gameState.checkpoints[0] = true;
    }
    // Checkpoint 2: top right corner
    if (gameState.checkpoints[0] && gameState.x > 750 && gameState.x < 850 && gameState.y > 150 && gameState.y < 250) {
        gameState.checkpoints[1] = true;
    }
    // Checkpoint 3: bottom right corner
    if (gameState.checkpoints[1] && gameState.x > 750 && gameState.x < 850 && gameState.y > 550 && gameState.y < 650) {
        gameState.checkpoints[2] = true;
    }

    // Finish line: near x=140..260, y=750 (bottom left)
    if (gameState.checkpoints[0] && gameState.checkpoints[1] && gameState.checkpoints[2]) {
        if (gameState.x > 100 && gameState.x < 300 && gameState.y > 700 && gameState.y < 800) {
            gameState.lap++;
            gameState.checkpoints = [false, false, false];
            if (gameState.lap > 3) {
                document.getElementById('lap-counter').innerText = "FINISH!";
            } else {
                document.getElementById('lap-counter').innerText = "LAP " + gameState.lap + "/3";
            }
        }
    }
}

// Mode 7 rendering function using ImageData
function render() {
    // 1. Clear & draw sky
    // Sky wraps based on angle
    let skyOffsetX = ((gameState.angle / (Math.PI * 2)) * skyTexture.width) % skyTexture.width;
    if (skyOffsetX < 0) skyOffsetX += skyTexture.width;

    ctx.drawImage(skyTexture, -skyOffsetX, 0, skyTexture.width, height / 2);
    ctx.drawImage(skyTexture, skyTexture.width - skyOffsetX, 0, skyTexture.width, height / 2);

    // Pre-calculate view vectors
    const dirX = Math.cos(gameState.angle);
    const dirY = Math.sin(gameState.angle);

    // The view plane length determines FOV
    const fovScale = Math.tan(halfFov);
    // plane is perpendicular to dir
    const planeX = -Math.sin(gameState.angle) * fovScale;
    const planeY = Math.cos(gameState.angle) * fovScale;

    // Height of camera above ground
    const camHeight = 30;

    // Get screen ImageData to write directly for the floor
    const screenData = ctx.getImageData(0, projectionPlaneY, width, height / 2);
    const pixels = screenData.data;

    // Scanline rendering for the floor (from horizon down to bottom of screen)
    for (let y = 0; y < height / 2; y++) {
        // Current y position compared to the center of the screen (the horizon)
        const p = y + 1;

        // Distance to the row.
        // We use (height/2) / p to map scanlines exponentially further away as they approach horizon
        const rowDistance = camHeight * (height / 2) / p;

        // Step vector for this row
        // Leftmost ray
        const rayDirX0 = dirX - planeX;
        const rayDirY0 = dirY - planeY;

        // Rightmost ray
        const rayDirX1 = dirX + planeX;
        const rayDirY1 = dirY + planeY;

        // Real world coordinates of the leftmost point in this row
        let floorX = gameState.x + rowDistance * rayDirX0;
        let floorY = gameState.y + rowDistance * rayDirY0;

        // How much to step in world space per screen pixel
        const floorStepX = rowDistance * (rayDirX1 - rayDirX0) / width;
        const floorStepY = rowDistance * (rayDirY1 - rayDirY0) / width;

        for (let x = 0; x < width; x++) {
            // Get texture coordinates, mask with bitwise AND for repeating texture
            // Using size-1 assumes trackSize is a power of 2 (1024)
            const tx = Math.floor(floorX) & (trackSize - 1);
            const ty = Math.floor(floorY) & (trackSize - 1);

            // Fetch color from track map
            const texOffset = (ty * trackSize + tx) * 4;

            // Write to screen buffer
            const screenOffset = (y * width + x) * 4;

            // Simple depth shading (fog)
            // Range 0 to 1, higher y = closer = brighter
            const shade = Math.min(1, y / (height / 4));

            pixels[screenOffset] = trackData.data[texOffset] * shade;         // R
            pixels[screenOffset + 1] = trackData.data[texOffset + 1] * shade; // G
            pixels[screenOffset + 2] = trackData.data[texOffset + 2] * shade; // B
            pixels[screenOffset + 3] = 255;                                   // A

            // Step to next pixel
            floorX += floorStepX;
            floorY += floorStepY;
        }
    }

    // Put floor data back to canvas
    ctx.putImageData(screenData, 0, projectionPlaneY);

    // 3. Draw car sprite
    // Center bottom of screen
    const carW = carSprite.width * 3; // Scale up
    const carH = carSprite.height * 3;
    const carX = (width - carW) / 2;
    // Bobs slightly based on speed
    const bob = Math.sin(Date.now() / 50) * (gameState.speed * 0.5);
    const carY = height - carH - 10 + bob;

    ctx.drawImage(carSprite, carX, carY, carW, carH);
}

// Main Loop
function loop() {
    update();
    render();
    requestAnimationFrame(loop);
}

// Start
initAssets();
// Start player near the finish line pointing UP (which on our map is -y, but let's see how our angles work)
// Math.PI * 1.5 is pointing UP (North)
gameState.angle = Math.PI * 1.5;
gameState.x = 200;
gameState.y = 850;

loop();
