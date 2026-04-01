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

    // F-Zero specific machine stats (Blue Falcon proxy)
    maxSpeed: 12,       // Map pixels per frame
    accelPhase1: 0.25,  // Fast initial acceleration
    accelPhase2: 0.05,  // Slower high-end acceleration
    coastFriction: 0.995, // Extremely slippery when off gas
    brakePower: 0.6,

    turnBase: 0.055,    // Base turning speed
    turnDrop: 0.02,     // How much turn speed drops at max speed
    gripForward: 0.99,  // Almost perfectly aligns to forward when driving normally
    gripSlide: 0.92,    // Slides outward significantly when using L/R
    gripBlast: 1.0,     // Locks velocity to forward angle instantly (mashing gas)

    lap: 1,
    checkpoints: [false, false, false], // Very simple checkpoint system
    bounceTimer: 0,  // For screen shake effect

    // Input history for advanced mechanics
    framesSinceAccel: 0,
    isBlastTurning: false
};

// Controls
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    q: false,
    e: false,
    Q: false,
    E: false
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

    // Calculate current speed (magnitude)
    gameState.speed = Math.sqrt(gameState.vx * gameState.vx + gameState.vy * gameState.vy);

    // 1. INPUT TRACKING (For Blast Turning)
    // Blast turning is achieved in F-Zero by mashing the accelerator while turning.
    // It prevents drifting outward but drops your speed slightly.
    if (keys.ArrowUp) {
        if (gameState.framesSinceAccel > 0 && gameState.framesSinceAccel < 15 && gameState.angularVelocity !== 0) {
            gameState.isBlastTurning = true;
        }
        gameState.framesSinceAccel = 0;
    } else {
        gameState.framesSinceAccel++;
        gameState.isBlastTurning = false;
    }

    // 2. TURNING
    gameState.angularVelocity = 0;
    if (gameState.speed > 0.5) {
        // Turning radius depends heavily on speed in F-Zero. Max speed = wider turns.
        const speedRatio = gameState.speed / gameState.maxSpeed;
        let turnAmount = gameState.turnBase - (gameState.turnDrop * speedRatio);

        // If holding a slide button (L/R) AND steering in that direction, turn is sharper
        if ((keys.q || keys.Q) && keys.ArrowLeft) turnAmount *= 1.3;
        if ((keys.e || keys.E) && keys.ArrowRight) turnAmount *= 1.3;

        // Blast turning sharpens the turn even more
        if (gameState.isBlastTurning) turnAmount *= 1.5;

        // Reversing logic
        const dotProduct = (gameState.vx * forwardX) + (gameState.vy * forwardY);
        if (dotProduct < -0.5) turnAmount *= -1;

        if (keys.ArrowLeft) {
            gameState.angle -= turnAmount;
            gameState.angularVelocity = -turnAmount;
        }
        if (keys.ArrowRight) {
            gameState.angle += turnAmount;
            gameState.angularVelocity = turnAmount;
        }
    }

    // 3. ACCELERATION AND FRICTION
    let thrust = 0;
    if (keys.ArrowUp) {
        // F-Zero two-phase acceleration: fast initially, slows down at high end
        if (gameState.speed < gameState.maxSpeed * 0.6) {
            thrust = gameState.accelPhase1;
        } else {
            thrust = gameState.accelPhase2;
        }
    } else if (keys.ArrowDown) {
        thrust = -gameState.brakePower;
    }

    // Apply thrust along the facing angle
    gameState.vx += forwardX * thrust;
    gameState.vy += forwardY * thrust;

    // Apply "Ice" friction if coasting
    if (!keys.ArrowUp && !keys.ArrowDown) {
        gameState.vx *= gameState.coastFriction;
        gameState.vy *= gameState.coastFriction;
    }

    // 4. GRIP & DRIFT MECHANICS
    // In F-Zero, the ship's velocity vector constantly tries to align with its facing angle.
    // How fast it aligns depends on the "grip".

    let currentGrip = gameState.gripForward;

    // Slide Turning (L/R) drops grip significantly, allowing the momentum vector to slide outward
    if ((keys.q || keys.Q) || (keys.e || keys.E)) {
        currentGrip = gameState.gripSlide;
    }

    // Blast Turning locks the velocity vector to the facing angle instantly (perfect grip),
    // but costs a bit of speed as a penalty.
    if (gameState.isBlastTurning) {
        currentGrip = gameState.gripBlast;
        gameState.vx *= 0.98; // Speed penalty for blast turning
        gameState.vy *= 0.98;
    }

    // Calculate the target velocity (where the ship wants to go based on facing angle and current speed)
    // We only re-align if we are moving forward
    const dotProduct = (gameState.vx * forwardX) + (gameState.vy * forwardY);
    if (dotProduct > 0.1) {
        const targetVx = forwardX * gameState.speed;
        const targetVy = forwardY * gameState.speed;

        // Lerp current velocity towards the facing angle based on Grip
        gameState.vx += (targetVx - gameState.vx) * currentGrip;
        gameState.vy += (targetVy - gameState.vy) * currentGrip;
    }

    // Limit Max Speed
    gameState.speed = Math.sqrt(gameState.vx * gameState.vx + gameState.vy * gameState.vy);
    if (gameState.speed > gameState.maxSpeed) {
        const ratio = gameState.maxSpeed / gameState.speed;
        gameState.vx *= ratio;
        gameState.vy *= ratio;
    }

    // 5. COLLISION DETECTION (Wall Bumping & Scraping)
    let nextX = gameState.x + gameState.vx;
    let nextY = gameState.y + gameState.vy;

    if (isWall(nextX, nextY)) {
        // Hit a wall! Calculate bounce angle.
        // F-Zero treats walls differently depending on attack angle.
        // A head-on collision stops you dead. A shallow collision lets you scrape.

        // We do this by finding the wall normal. Since we only have a bitmask,
        // we approximate by checking adjacent pixels.
        const hitX = isWall(nextX, gameState.y);
        const hitY = isWall(gameState.x, nextY);

        if (hitX && !hitY) {
            // Hit a vertical wall
            gameState.vx *= -0.4; // Bounce
            gameState.vy *= 0.9;  // Scrape friction
            nextX = gameState.x + gameState.vx;
        } else if (hitY && !hitX) {
            // Hit a horizontal wall
            gameState.vy *= -0.4; // Bounce
            gameState.vx *= 0.9;  // Scrape friction
            nextY = gameState.y + gameState.vy;
        } else {
            // Hit a corner or head-on
            gameState.vx *= -0.5;
            gameState.vy *= -0.5;
            nextX = gameState.x + gameState.vx;
            nextY = gameState.y + gameState.vy;
        }

        // Heavy speed penalty for hitting walls
        gameState.vx *= 0.7;
        gameState.vy *= 0.7;
        gameState.bounceTimer = 15;
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
