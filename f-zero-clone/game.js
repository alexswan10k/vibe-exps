// F-Zero Clone - Main Game Logic

// --- Constants & Config ---
const TRACK_SIZE = 2048; // Size of the texture/collision map
const WORLD_SCALE = 10;   // Scale the 3D plane relative to the map
const SHIP_MAX_SPEED = 2.0;
const SHIP_ACCEL = 0.02;
const SHIP_BRAKE = 0.05;
const FRICTION = 0.98;
const GRASS_FRICTION = 0.90;
const TURN_SPEED = 0.04;
const DRIFT_MULTIPLIER = 1.5; // Turning is sharper when drifting
const GRIP = 0.95; // How fast velocity aligns with forward direction
const DRIFT_GRIP = 0.85; // Lower grip when sliding (Q/E)

// --- Game State ---
const state = {
    x: TRACK_SIZE / 2, // Start in middle of map coordinates
    y: TRACK_SIZE / 2,
    vx: 0,
    vy: 0,
    angle: 0,
    speed: 0,
    lap: 1,
    maxLaps: 3,
    checkpoints: 0,
    keys: {
        ArrowUp: false,
        ArrowDown: false,
        ArrowLeft: false,
        ArrowRight: false,
        q: false,
        e: false
    }
};

// --- Globals ---
let scene, camera, renderer;
let trackPlane, shipMesh;
let collisionCtx;
let lastTime = performance.now();

// UI Elements
const speedEl = document.getElementById('speedometer');
const lapEl = document.getElementById('lap-counter');

// --- Initialization ---
function init() {
    // 1. Generate Track & Collision Map
    generateTrack();

    // 2. Setup Three.js
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    scene.fog = new THREE.Fog(0x87CEEB, 20, 150);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: false }); // F-Zero is pixelated!
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // 3. Create World
    setupWorld();

    // 4. Input handling
    window.addEventListener('keydown', (e) => { if (state.keys.hasOwnProperty(e.key)) state.keys[e.key] = true; });
    window.addEventListener('keyup', (e) => { if (state.keys.hasOwnProperty(e.key)) state.keys[e.key] = false; });
    window.addEventListener('resize', onWindowResize, false);

    // 5. Start Loop
    requestAnimationFrame(gameLoop);
}

// --- Track Generation ---
function generateTrack() {
    // We create a canvas, draw the track on it, and use it for BOTH the 3D texture and the 2D collision logic.
    const canvas = document.createElement('canvas');
    canvas.width = TRACK_SIZE;
    canvas.height = TRACK_SIZE;
    collisionCtx = canvas.getContext('2d', { willReadFrequently: true });

    // Background (Grass/Dirt - Off track)
    collisionCtx.fillStyle = '#8B4513'; // Dirt brown
    collisionCtx.fillRect(0, 0, TRACK_SIZE, TRACK_SIZE);

    // Draw the track (Asphalt - On track)
    // We'll draw a simple loop using overlapping thick strokes
    collisionCtx.lineCap = 'round';
    collisionCtx.lineJoin = 'round';

    // Outer walls (for visual boundary, we'll extract exact pixel colors for collision)
    collisionCtx.strokeStyle = '#333333'; // Dark grey road
    collisionCtx.lineWidth = 120; // Road width

    collisionCtx.beginPath();
    // A simple kidney-bean shape
    collisionCtx.moveTo(TRACK_SIZE * 0.3, TRACK_SIZE * 0.8);
    collisionCtx.lineTo(TRACK_SIZE * 0.7, TRACK_SIZE * 0.8);
    collisionCtx.arcTo(TRACK_SIZE * 0.9, TRACK_SIZE * 0.8, TRACK_SIZE * 0.9, TRACK_SIZE * 0.5, 200);
    collisionCtx.lineTo(TRACK_SIZE * 0.9, TRACK_SIZE * 0.3);
    collisionCtx.arcTo(TRACK_SIZE * 0.9, TRACK_SIZE * 0.1, TRACK_SIZE * 0.5, TRACK_SIZE * 0.1, 200);
    collisionCtx.lineTo(TRACK_SIZE * 0.2, TRACK_SIZE * 0.1);
    collisionCtx.arcTo(TRACK_SIZE * 0.1, TRACK_SIZE * 0.1, TRACK_SIZE * 0.1, TRACK_SIZE * 0.5, 150);
    collisionCtx.lineTo(TRACK_SIZE * 0.1, TRACK_SIZE * 0.6);
    collisionCtx.arcTo(TRACK_SIZE * 0.1, TRACK_SIZE * 0.8, TRACK_SIZE * 0.3, TRACK_SIZE * 0.8, 150);

    collisionCtx.stroke();

    // Draw start/finish line
    collisionCtx.fillStyle = '#FFFFFF';
    collisionCtx.fillRect(TRACK_SIZE * 0.45, TRACK_SIZE * 0.8 - 60, 20, 120);

    // Set starting position explicitly on the straightaway
    state.x = TRACK_SIZE * 0.5;
    state.y = TRACK_SIZE * 0.8;
    state.angle = Math.PI; // Facing left (along the bottom straight)

    // Create the Three.js texture from this canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter; // Pixelated look
    texture.minFilter = THREE.NearestFilter;

    // Create the ground plane
    const geometry = new THREE.PlaneGeometry(TRACK_SIZE / WORLD_SCALE, TRACK_SIZE / WORLD_SCALE);
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    trackPlane = new THREE.Mesh(geometry, material);
    trackPlane.rotation.x = -Math.PI / 2; // Lay flat
    // Center the plane so map coordinates (0,0) correspond to top-left, not center.
    // Actually, it's easier to leave it centered and map coordinates.
    // ThreeJS Plane 0,0 is center. Canvas 0,0 is top left.
}

function setupWorld() {
    scene.add(trackPlane);

    // Simple Ship (Triangle)
    const shipGeo = new THREE.ConeGeometry(0.5, 1.5, 3);
    // Cone by default points up (+Y).
    // To make it point +X (angle 0), rotate -90 deg on Z.
    shipGeo.rotateZ(-Math.PI / 2);
    // Then lay it flat by rotating -90 deg on X.
    shipGeo.rotateX(-Math.PI / 2);
    const shipMat = new THREE.MeshBasicMaterial({ color: 0x00aaff });
    shipMesh = new THREE.Mesh(shipGeo, shipMat);
    shipMesh.position.y = 0.5; // Hover slightly
    scene.add(shipMesh);
}

// --- Physics & Logic ---
function updatePhysics(dt) {
    // 1. Acceleration & Braking
    if (state.keys.ArrowUp) {
        state.speed += SHIP_ACCEL;
    } else if (state.keys.ArrowDown) {
        state.speed -= SHIP_BRAKE;
    }

    // 2. Turning & Drifting (F-Zero Style)
    let currentTurnSpeed = TURN_SPEED;
    let currentGrip = GRIP;

    // If drifting (Q/E), turn sharper but lose grip (slide sideways)
    if (state.keys.q || state.keys.e) {
        currentTurnSpeed *= DRIFT_MULTIPLIER;
        currentGrip = DRIFT_GRIP;
    }

    if (state.keys.ArrowLeft) state.angle += currentTurnSpeed;
    if (state.keys.ArrowRight) state.angle -= currentTurnSpeed;

    // Cap speed
    if (state.speed > SHIP_MAX_SPEED) state.speed = SHIP_MAX_SPEED;
    if (state.speed < -SHIP_MAX_SPEED/2) state.speed = -SHIP_MAX_SPEED/2;

    // 3. Calculate Intent Vector (Where the nose points)
    const intentVx = Math.cos(state.angle) * state.speed;
    const intentVy = -Math.sin(state.angle) * state.speed; // Canvas Y is down, Math Y is up, careful here. We'll use standard math and invert later if needed.

    // 4. Apply Grip (Lerp actual velocity towards intent velocity)
    // This creates the sliding sensation. If Grip is 1.0, it turns on rails.
    state.vx = state.vx * (1 - currentGrip) + intentVx * currentGrip;
    state.vy = state.vy * (1 - currentGrip) + intentVy * currentGrip;

    // 5. Collision Detection (Check pixel color under ship)
    // We sample slightly ahead of the ship to prevent getting stuck
    const checkX = state.x + state.vx * 2;
    const checkY = state.y + state.vy * 2;

    let onTrack = false;
    let hitWall = false;

    if (checkX >= 0 && checkX < TRACK_SIZE && checkY >= 0 && checkY < TRACK_SIZE) {
        const pixel = collisionCtx.getImageData(Math.floor(checkX), Math.floor(checkY), 1, 1).data;
        // r, g, b, a
        // Asphalt is #333333 (rgb 51,51,51) or Start line is #FFFFFF (255,255,255)
        // Dirt is #8B4513 (rgb 139, 69, 19)

        // Helper to check color proximity
        const isColor = (r, g, b, targetR, targetG, targetB, threshold = 20) => {
            return Math.abs(r - targetR) < threshold &&
                   Math.abs(g - targetG) < threshold &&
                   Math.abs(b - targetB) < threshold;
        };

        if (isColor(pixel[0], pixel[1], pixel[2], 51, 51, 51, 50)) {
            onTrack = true; // Road
        } else if (isColor(pixel[0], pixel[1], pixel[2], 255, 255, 255, 50)) {
            onTrack = true; // Start line
            checkLap(checkX, checkY);
        } else if (isColor(pixel[0], pixel[1], pixel[2], 139, 69, 19, 50)) {
            // Off track - slow down drastically
            state.vx *= GRASS_FRICTION;
            state.vy *= GRASS_FRICTION;
            state.speed *= GRASS_FRICTION;
        } else {
            // Out of bounds / Wall (In our simple map, anything else is a wall or edge)
            hitWall = true;
        }
    } else {
        hitWall = true; // Edge of map
    }

    if (hitWall) {
        // Nudge back BEFORE reversing velocity
        state.x -= state.vx * 2;
        state.y -= state.vy * 2;

        // Simple bounce
        state.vx *= -0.5;
        state.vy *= -0.5;
        state.speed *= 0.5;
    } else {
        // Apply general friction and move
        state.vx *= FRICTION;
        state.vy *= FRICTION;
        state.speed *= FRICTION;

        state.x += state.vx;
        state.y += state.vy;
    }
}

function checkLap(x, y) {
    // Extremely basic lap logic. If we cross the white box going right-to-left roughly.
    // In a real game we'd need checkpoints.
    // For simplicity, just debounce.
    if (state.checkpoints === 0) {
        state.lap++;
        state.checkpoints = 1; // Prevent immediate re-trigger
        setTimeout(() => { state.checkpoints = 0; }, 5000); // 5 sec cooldown
        lapEl.innerText = `LAP ${state.lap}/${state.maxLaps}`;
    }
}

function updateCameraAndMesh() {
    // Map 2D coordinates (0 to TRACK_SIZE) to 3D Plane coordinates (-PlaneSize/2 to +PlaneSize/2)
    const planeSize = TRACK_SIZE / WORLD_SCALE;
    const worldX = (state.x - TRACK_SIZE / 2) / WORLD_SCALE;
    const worldZ = (state.y - TRACK_SIZE / 2) / WORLD_SCALE; // Canvas Y maps to 3D Z

    // Update Ship
    shipMesh.position.set(worldX, 0.5, worldZ);
    shipMesh.rotation.y = state.angle; // Adjust angle to match 3D space

    // Mode 7 Camera logic
    const camDistance = 8;
    const camHeight = 4;

    // Position camera behind ship
    // Canvas angle 0 is +X, angle Pi is -X.
    // X is cos, Y (which maps to Z here) is -sin
    const offsetX = -Math.cos(state.angle) * camDistance;
    const offsetZ = Math.sin(state.angle) * camDistance; // +Z because Canvas Y is down, 3D Z is forward/back.

    camera.position.set(worldX + offsetX, camHeight, worldZ + offsetZ);

    // We want to look slightly ahead of the ship, not directly down at it, to mimic the F-zero view.
    const lookAheadX = worldX + Math.cos(state.angle) * 10;
    const lookAheadZ = worldZ - Math.sin(state.angle) * 10;

    // To make the ship face away from the camera properly, its rotation needs to match the angle.
    // Angle 0 points right (+X). Rotation Y in ThreeJS: positive is counter-clockwise looking from top.
    // So angle 0 -> rotation 0 (points +X if unrotated geo points +X)
    shipMesh.rotation.y = state.angle;

    camera.lookAt(lookAheadX, 0, lookAheadZ);
}

function updateUI() {
    // Display speed in roughly km/h based on our arbitrary units
    const displaySpeed = Math.floor(Math.abs(state.speed) * 150);
    speedEl.innerText = `${displaySpeed} km/h`;
}

// --- Main Loop ---
function gameLoop(now) {
    requestAnimationFrame(gameLoop);

    const dt = now - lastTime;
    lastTime = now;

    // Cap dt to prevent massive jumps if tab is backgrounded
    if (dt > 100) return;

    updatePhysics(dt);
    updateCameraAndMesh();
    updateUI();

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Start
init();
