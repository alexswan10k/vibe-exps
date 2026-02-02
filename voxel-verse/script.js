// --- Simple PointerLockControls Implementation ---
// Adapted for global usage without modules
class SimplePointerLockControls {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        this.isLocked = false;
        
        // Euler for rotation
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.PI_2 = Math.PI / 2;
        this.minPolarAngle = 0;
        this.maxPolarAngle = Math.PI;

        this._onMouseMove = this.onMouseMove.bind(this);
        this._onPointerLockChange = this.onPointerLockChange.bind(this);
        this._onPointerLockError = this.onPointerLockError.bind(this);

        this.connect();
    }

    connect() {
        document.addEventListener('mousemove', this._onMouseMove, false);
        document.addEventListener('pointerlockchange', this._onPointerLockChange, false);
        document.addEventListener('pointerlockerror', this._onPointerLockError, false);
    }

    disconnect() {
        document.removeEventListener('mousemove', this._onMouseMove, false);
        document.removeEventListener('pointerlockchange', this._onPointerLockChange, false);
        document.removeEventListener('pointerlockerror', this._onPointerLockError, false);
    }

    dispose() {
        this.disconnect();
    }

    getObject() {
        return this.camera;
    }

    onMouseMove(event) {
        if (this.isLocked === false) return;

        const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
        const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

        this.euler.setFromQuaternion(this.camera.quaternion);

        this.euler.y -= movementX * 0.002;
        this.euler.x -= movementY * 0.002;

        this.euler.x = Math.max(this.PI_2 - this.maxPolarAngle, Math.min(this.PI_2 - this.minPolarAngle, this.euler.x));

        this.camera.quaternion.setFromEuler(this.euler);
    }

    onPointerLockChange() {
        if (document.pointerLockElement === this.domElement) {
            this.dispatchEvent({ type: 'lock' });
            this.isLocked = true;
        } else {
            this.dispatchEvent({ type: 'unlock' });
            this.isLocked = false;
        }
    }

    onPointerLockError() {
        console.error('PointerLockControls: Unable to use Pointer Lock API');
    }

    lock() {
        this.domElement.requestPointerLock();
    }

    unlock() {
        document.exitPointerLock();
    }

    moveForward(distance) {
        const vec = new THREE.Vector3();
        vec.setFromMatrixColumn(this.camera.matrix, 0);
        vec.crossVectors(this.camera.up, vec);
        this.camera.position.addScaledVector(vec, distance);
    }

    moveRight(distance) {
        const vec = new THREE.Vector3();
        vec.setFromMatrixColumn(this.camera.matrix, 0);
        this.camera.position.addScaledVector(vec, distance);
    }

    // Simple EventDispatcher mixin
    listeners = {};
    addEventListener(type, listener) {
        if (!this.listeners[type]) this.listeners[type] = [];
        this.listeners[type].push(listener);
    }
    dispatchEvent(event) {
        if (this.listeners[event.type]) {
            this.listeners[event.type].forEach(l => l(event));
        }
    }
}

// --- Perlin Noise Implementation ---
class Perlin {
    constructor() {
        this.p = new Uint8Array(512);
        const p = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
        190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,
        68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,
        102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,
        173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
        223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,
        178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,
        214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,
        195,78,66,215,61,156,180];
        
        for (let i = 0; i < 256; i++) {
            this.p[i] = p[i];
            this.p[i + 256] = p[i];
        }
    }

    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(t, a, b) { return a + t * (b - a); }
    grad(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    noise(x, y, z) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);

        const u = this.fade(x);
        const v = this.fade(y);
        const w = this.fade(z);

        const A = this.p[X] + Y, AA = this.p[A] + Z, AB = this.p[A + 1] + Z;
        const B = this.p[X + 1] + Y, BA = this.p[B] + Z, BB = this.p[B + 1] + Z;

        return this.lerp(w, this.lerp(v, this.lerp(u, this.grad(this.p[AA], x, y, z),
            this.grad(this.p[BA], x - 1, y, z)),
            this.lerp(u, this.grad(this.p[AB], x, y - 1, z),
                this.grad(this.p[BB], x - 1, y - 1, z))),
            this.lerp(v, this.lerp(u, this.grad(this.p[AA + 1], x, y, z - 1),
                this.grad(this.p[BA + 1], x - 1, y, z - 1)),
                this.lerp(u, this.grad(this.p[AB + 1], x, y - 1, z - 1),
                    this.grad(this.p[BB + 1], x - 1, y - 1, z - 1))));
    }
}

// --- Global Variables ---
let camera, scene, renderer, controls;
let raycaster;
const objects = []; // Array of meshes for raycasting
const moveState = { forward: false, backward: false, left: false, right: false, jump: false, sprint: false };
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let prevTime = performance.now();
const colorPalette = [0x55ff55, 0x8b4513, 0x808080, 0x5555ff, 0xffff55]; // Grass, Dirt, Stone, Water, Sand
let activeBlockIndex = 0;
let isLocked = false;

// Physics constants
const GRAVITY = 30.0; // m/s² (approx)
const JUMP_SPEED = 15.0;
const MOVE_SPEED = 2.5;
const PLAYER_HEIGHT = 1.6;
const PLAYER_RADIUS = 0.3;

// Voxel helper
const voxelSize = 1;
const geometry = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);

// Map to store block positions "x,y,z" -> Mesh
const blockMap = new Map();

const perlin = new Perlin();

init();
animate();

function init() {
    // 1. Scene & Fog
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    scene.fog = new THREE.Fog(0x87CEEB, 10, 60);

    // 2. Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Start slightly above ground
    camera.position.set(0, 5, 0);

    // 3. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // 4. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // 5. Controls
    controls = new SimplePointerLockControls(camera, document.body);

    const instructions = document.getElementById('instructions');
    
    instructions.addEventListener('click', function () {
        controls.lock();
    });

    controls.addEventListener('lock', function () {
        instructions.style.display = 'none';
        isLocked = true;
    });

    controls.addEventListener('unlock', function () {
        instructions.style.display = 'flex';
        isLocked = false;
        // Reset move state on unlock to prevent drifting
        moveState.forward = false;
        moveState.backward = false;
        moveState.left = false;
        moveState.right = false;
        moveState.jump = false;
    });

    // 6. Input Listeners
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('resize', onWindowResize);

    // 7. Raycaster for interaction
    raycaster = new THREE.Raycaster();

    // 8. Generate World
    generateWorld();

    // 9. UI Setup
    setupUI();
}

function generateWorld() {
    const size = 32; // Increased size slightly
    const scale = 0.05; // Noise frequency
    const heightScale = 10; // Max height variation
    
    for (let x = -size; x < size; x++) {
        for (let z = -size; z < size; z++) {
            // Generate height using 2D noise (z=0 for 2D)
            // Add offset to avoid 0,0 symmetry if desired
            const n = perlin.noise((x + 100) * scale, (z + 100) * scale, 0); 
            
            // Map noise (-1 to 1) to height (0 to heightScale)
            // We use Math.floor to get integer block levels
            const h = Math.floor((n + 1) * 0.5 * heightScale); 

            // Fill blocks from bottom up to height h
            for (let y = -2; y <= h; y++) {
                // Determine block type based on depth/height
                let type = 0; // Grass by default (top)
                
                if (y < h) {
                    type = 1; // Dirt just below surface
                }
                if (y < h - 2) {
                    type = 2; // Stone deeper down
                }
                if (y === -2) {
                    type = 2; // Bedrock/Stone floor
                }

                // Water level logic (optional)
                // if (y > h && y < 2) createBlock(x, y, z, 3); // Water
                
                createBlock(x, y, z, type);
            }

            // Trees!
            // Rare chance, only on top of grass, and not too low (beach)
            if (h > 1 && Math.random() > 0.985) {
                // Trunk
                createBlock(x, h + 1, z, 1); // Dirt/Wood (using Dirt color for trunk for now as palette is limited)
                createBlock(x, h + 2, z, 1);
                createBlock(x, h + 3, z, 1);
                
                // Leaves (Green)
                // Simple cross or blob
                createBlock(x, h + 4, z, 0); 
                createBlock(x + 1, h + 3, z, 0);
                createBlock(x - 1, h + 3, z, 0);
                createBlock(x, h + 3, z + 1, 0);
                createBlock(x, h + 3, z - 1, 0);
            }
        }
    }
}

function createBlock(x, y, z, typeIndex) {
    const key = `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
    if (blockMap.has(key)) return; // Block already exists

    const material = new THREE.MeshLambertMaterial({ 
        color: colorPalette[typeIndex],
        map: null // Could add texture here
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x * voxelSize, y * voxelSize + (voxelSize/2), z * voxelSize); // Centered
    
    // Add wireframe edge for block definition look
    const edges = new THREE.EdgesGeometry(geometry);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.1, transparent: true }));
    mesh.add(line);

    mesh.userData = { isBlock: true, x, y, z };
    
    scene.add(mesh);
    objects.push(mesh);
    blockMap.set(key, mesh);
}

function removeBlock(mesh) {
    const { x, y, z } = mesh.userData;
    const key = `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
    
    scene.remove(mesh);
    blockMap.delete(key);
    
    // Remove from objects array for raycasting
    const index = objects.indexOf(mesh);
    if (index > -1) {
        objects.splice(index, 1);
    }
    
    // Dispose resources
    mesh.geometry.dispose();
    if (mesh.material.map) mesh.material.map.dispose();
    mesh.material.dispose();
}

function setupUI() {
    const toolbar = document.getElementById('toolbar');
    colorPalette.forEach((color, index) => {
        const div = document.createElement('div');
        div.className = 'block-slot';
        div.style.backgroundColor = '#' + color.toString(16).padStart(6, '0');
        div.innerText = index + 1;
        if (index === activeBlockIndex) div.classList.add('active');
        toolbar.appendChild(div);
    });
}

function updateUI() {
    const slots = document.querySelectorAll('.block-slot');
    slots.forEach((slot, index) => {
        if (index === activeBlockIndex) slot.classList.add('active');
        else slot.classList.remove('active');
    });
}

function onKeyDown(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': moveState.forward = true; break;
        case 'ArrowLeft':
        case 'KeyA': moveState.left = true; break;
        case 'ArrowDown':
        case 'KeyS': moveState.backward = true; break;
        case 'ArrowRight':
        case 'KeyD': moveState.right = true; break;
        case 'Space': 
            if (canJump === true) velocity.y += JUMP_SPEED;
            canJump = false;
            break;
        case 'Digit1': activeBlockIndex = 0; updateUI(); break;
        case 'Digit2': activeBlockIndex = 1; updateUI(); break;
        case 'Digit3': activeBlockIndex = 2; updateUI(); break;
        case 'Digit4': activeBlockIndex = 3; updateUI(); break;
        case 'Digit5': activeBlockIndex = 4; updateUI(); break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': moveState.forward = false; break;
        case 'ArrowLeft':
        case 'KeyA': moveState.left = false; break;
        case 'ArrowDown':
        case 'KeyS': moveState.backward = false; break;
        case 'ArrowRight':
        case 'KeyD': moveState.right = false; break;
    }
}

function onMouseDown(event) {
    if (!isLocked) return;
    
    // Center of screen
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(objects, false); 

    if (intersects.length > 0) {
        const intersect = intersects[0];
        const mesh = intersect.object;
        
        // 0: Left Click (Remove)
        if (event.button === 0) {
            removeBlock(mesh);
        } 
        // 2: Right Click (Add)
        else if (event.button === 2) {
            // Calculate new position based on face normal
            const normal = intersect.face.normal;
            const pos = mesh.userData;
            
            const nx = Math.round(normal.x);
            const ny = Math.round(normal.y);
            const nz = Math.round(normal.z);

            const newX = pos.x + nx;
            const newY = pos.y + ny;
            const newZ = pos.z + nz;

            // Prevent placing block inside player
            const pPos = controls.getObject().position;
            // Simple bounding box check
            const dx = Math.abs(newX * voxelSize - pPos.x);
            const dy = Math.abs((newY * voxelSize + voxelSize/2) - (pPos.y - PLAYER_HEIGHT/2)); 
            const dz = Math.abs(newZ * voxelSize - pPos.z);
            
            if (dx < 0.8 && dz < 0.8 && newY * voxelSize < pPos.y + 1 && newY * voxelSize > pPos.y - 2) {
                // Too close to player
                return;
            }

            createBlock(newX, newY, newZ, activeBlockIndex);
        }
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Collision helper
function getBlock(x, y, z) {
    const key = `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
    return blockMap.has(key);
}

// Check if a player bounding box at (x,y,z) collides with any blocks
function checkPlayerCollision(pos) {
    const r = 0.3; // Player radius
    const h = 1.6; // Player height
    
    const ySteps = [0, 0.8, 1.5]; // Relative Y offsets (Feet, Body, Head)
    
    for (let yOff of ySteps) {
        const testY = pos.y - h + yOff; // Convert camera Y to world Y of body part
        
        // We round to nearest block coordinate
        // We are checking if the point (x, y, z) is INSIDE a block volume
        // The block volume is (bx-0.5, by-0.5, bz-0.5) to (bx+0.5, by+0.5, bz+0.5)
        
        // Simplified check: Just check the integer grid cell containing the point
        
        const points = [
            { x: pos.x, z: pos.z },
            { x: pos.x + r, z: pos.z + r },
            { x: pos.x - r, z: pos.z - r },
            { x: pos.x + r, z: pos.z - r },
            { x: pos.x - r, z: pos.z + r }
        ];

        for (let p of points) {
            // Check if block exists at this rounded integer coordinate
            // Note: Since blocks are centered at integer coords (e.g. 0,0,0), a point at 0.4,0.4,0.4 is inside block 0,0,0.
            if (getBlock(Math.round(p.x), Math.round(testY), Math.round(p.z))) return true;
        }
    }
    return false;
}

// Simple Physics
let canJump = false;

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = Math.min((time - prevTime) / 1000, 0.1);

    if (controls.isLocked === true) {
        // 1. Handle Input -> Velocity
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= GRAVITY * delta; 

        direction.z = Number(moveState.forward) - Number(moveState.backward);
        direction.x = Number(moveState.right) - Number(moveState.left);
        direction.normalize(); 

        if (moveState.forward || moveState.backward) velocity.z -= direction.z * MOVE_SPEED * 40.0 * delta;
        if (moveState.left || moveState.right) velocity.x -= direction.x * MOVE_SPEED * 40.0 * delta;

        // 2. Apply Horizontal Movement (X and Z separately)
        
        const originalPos = controls.getObject().position.clone();
        
        // Move Right/Left
        controls.moveRight(-velocity.x * delta);
        if (checkPlayerCollision(controls.getObject().position)) {
            controls.getObject().position.x = originalPos.x;
            velocity.x = 0;
        }

        // Move Forward/Back
        const posAfterX = controls.getObject().position.clone();
        controls.moveForward(-velocity.z * delta);
        if (checkPlayerCollision(controls.getObject().position)) {
            controls.getObject().position.z = posAfterX.z;
            velocity.z = 0;
        }

        // 3. Apply Vertical Movement (Y Axis)
        controls.getObject().position.y += velocity.y * delta;
        
        // Floor Collision
        if (checkPlayerCollision(controls.getObject().position)) {
            if (velocity.y < 0) {
                // Falling -> Hit floor
                // Revert Y
                controls.getObject().position.y -= velocity.y * delta; 
                velocity.y = 0;
                canJump = true;
                
                // Optional: Snap to grid to prevent micro-bouncing
                // controls.getObject().position.y = Math.ceil(controls.getObject().position.y - 1.6) + 1.6;
            } else if (velocity.y > 0) {
                // Jumping -> Hit ceiling
                controls.getObject().position.y -= velocity.y * delta;
                velocity.y = 0;
            }
        }
        
        // Raycast fallback for smoothness on flat ground
        if (velocity.y <= 0) {
            raycaster.set(controls.getObject().position, new THREE.Vector3(0, -1, 0));
            const intersects = raycaster.intersectObjects(objects);
            if (intersects.length > 0) {
                const dist = intersects[0].distance;
                if (dist < 1.65 && dist > 1.5) { // Close enough to snap
                     controls.getObject().position.y = intersects[0].point.y + 1.6;
                     velocity.y = 0;
                     canJump = true;
                }
            }
        }

        // Reset if fell out of world
        if (controls.getObject().position.y < -30) {
            velocity.y = 0;
            velocity.x = 0;
            velocity.z = 0;
            controls.getObject().position.set(0, 10, 0);
        }
    }

    prevTime = time;
    renderer.render(scene, camera);
}
