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
    vx: 0,           // Velocity X
    vy: 0,           // Velocity Y
    angle: 0,        // Facing direction
    angularVelocity: 0, // Rate of turn for visual banking
    speed: 0,        // Magnitude of velocity
    maxSpeed: 15,    // Map pixels per frame
    acceleration: 0.2,
    braking: 0.5,
    forwardFriction: 0.98, // Natural slow down when coasting forward
    lateralFriction: 0.85, // "Grip" - higher means more drifting/sliding
    turnSpeed: 0.06,
    lap: 1,
    checkpoints: [false, false, false], // Very simple checkpoint system
    bounceTimer: 0   // For screen shake effect
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
let trackTexture, trackData, collisionData, carSprite, skyTexture;

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

    // Get collision map data
    const collisionCanvas = generateCollisionMap();
    const cCtx = collisionCanvas.getContext('2d', { willReadFrequently: true });
    collisionData = cCtx.getImageData(0, 0, trackSize, trackSize);

    carSprite = generateCarSprite();
    skyTexture = generateSkyTexture();
}

// Helper to check collision at a given coordinate
function isWall(x, y) {
    x = Math.floor(x) & (trackSize - 1);
    y = Math.floor(y) & (trackSize - 1);
    const index = (y * trackSize + x) * 4;
    // Look at Red channel: 0 is black (wall), 255 is white (track)
    return collisionData.data[index] < 128;
}

function update() {
    // Current forward vector based on facing angle
    const forwardX = Math.cos(gameState.angle);
    const forwardY = Math.sin(gameState.angle);

    // Perpendicular "right" vector for lateral movement
    const rightX = Math.cos(gameState.angle + Math.PI / 2);
    const rightY = Math.sin(gameState.angle + Math.PI / 2);

    // Calculate current speed (magnitude)
    gameState.speed = Math.sqrt(gameState.vx * gameState.vx + gameState.vy * gameState.vy);

    // Project velocity into local space (forward and lateral components)
    let localForwardVel = (gameState.vx * forwardX) + (gameState.vy * forwardY);
    let localLateralVel = (gameState.vx * rightX) + (gameState.vy * rightY);

    // Handle Turning (only turn if moving, turning radius depends on speed)
    gameState.angularVelocity = 0;
    if (gameState.speed > 0.1) {
        // Less steering power at higher speeds to emulate momentum
        const turnScale = Math.max(0.3, 1.0 - (gameState.speed / gameState.maxSpeed) * 0.3);
        let turnAmount = gameState.turnSpeed * turnScale;

        // Reversing logic
        if (localForwardVel < -0.5) turnAmount *= -1;

        if (keys.ArrowLeft) {
            gameState.angle -= turnAmount;
            gameState.angularVelocity = -turnAmount;
        }
        if (keys.ArrowRight) {
            gameState.angle += turnAmount;
            gameState.angularVelocity = turnAmount;
        }
    }

    // Handle Acceleration / Braking (applied in local forward axis)
    if (keys.ArrowUp) {
        localForwardVel += gameState.acceleration;
    } else if (keys.ArrowDown) {
        if (localForwardVel > 0) {
            localForwardVel -= gameState.braking;
            // Prevent braking from putting us into reverse instantly
            if (localForwardVel < 0) localForwardVel = 0;
        } else {
            // Reverse
            localForwardVel -= gameState.braking * 0.5;
        }
    } else {
        // Coasting friction
        localForwardVel *= gameState.forwardFriction;
    }

    // Apply Lateral Friction (This is what creates the sliding/drifting feel)
    // The hovercraft doesn't instantly snap to its forward vector, it slides
    localLateralVel *= gameState.lateralFriction;

    // Convert local velocities back to global velocities
    gameState.vx = (localForwardVel * forwardX) + (localLateralVel * rightX);
    gameState.vy = (localForwardVel * forwardY) + (localLateralVel * rightY);

    // Limit Max Speed globally
    const newSpeed = Math.sqrt(gameState.vx * gameState.vx + gameState.vy * gameState.vy);
    if (newSpeed > gameState.maxSpeed) {
        const ratio = gameState.maxSpeed / newSpeed;
        gameState.vx *= ratio;
        gameState.vy *= ratio;
    }

    // --- Collision Detection & Position Update ---
    let nextX = gameState.x + gameState.vx;
    let nextY = gameState.y + gameState.vy;

    // Independent axis collision for "scraping" against walls
    let hitWall = false;

    // Test X axis independently
    if (isWall(nextX, gameState.y)) {
        gameState.vx *= -0.5; // Bounce X
        nextX = gameState.x + gameState.vx; // Recalculate next position
        hitWall = true;
    }

    // Test Y axis independently
    if (isWall(nextX, nextY)) {
        gameState.vy *= -0.5; // Bounce Y
        nextY = gameState.y + gameState.vy; // Recalculate next position
        hitWall = true;
    }

    if (hitWall) {
        gameState.bounceTimer = 10;

        // Reduce overall speed heavily on hard impacts
        gameState.vx *= 0.8;
        gameState.vy *= 0.8;
    }

    // Move
    gameState.x = nextX;
    gameState.y = nextY;

    // Reduce bounce timer
    if (gameState.bounceTimer > 0) gameState.bounceTimer--;

    // Keep on track texture (wrap around for infinite map)
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
    let carX = (width - carW) / 2;
    // Bobs slightly based on speed
    const bob = Math.sin(Date.now() / 50) * (gameState.speed * 0.5);
    let carY = height - carH - 10 + bob;

    // Shake effect if hit a wall
    if (gameState.bounceTimer > 0) {
        const shakeX = (Math.random() - 0.5) * 10 * (gameState.bounceTimer / 10);
        const shakeY = (Math.random() - 0.5) * 10 * (gameState.bounceTimer / 10);
        carX += shakeX;
        carY += shakeY;
    }

    // Apply banking/leaning effect based on turn rate
    // We rotate the canvas slightly to simulate leaning into the turn
    ctx.save();

    // The center of rotation for the car sprite
    const centerX = carX + carW / 2;
    const centerY = carY + carH / 2;

    // Scale angular velocity up a bit to make the lean noticeable
    const leanAngle = gameState.angularVelocity * 3;

    ctx.translate(centerX, centerY);
    ctx.rotate(leanAngle);

    // Draw the car centered at the origin of our translated context
    ctx.drawImage(carSprite, -carW / 2, -carH / 2, carW, carH);

    ctx.restore();
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
