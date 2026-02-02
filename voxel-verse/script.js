// --- Simple PointerLockControls Implementation ---
class SimplePointerLockControls {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        this.isLocked = false;
        
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
        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;
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

    onPointerLockError() { console.error('PointerLockControls: Error'); }
    lock() { this.domElement.requestPointerLock(); }
    unlock() { document.exitPointerLock(); }
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

// --- Perlin Noise ---
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
        for (let i = 0; i < 256; i++) { this.p[i] = p[i]; this.p[i + 256] = p[i]; }
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
        x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
        const u = this.fade(x), v = this.fade(y), w = this.fade(z);
        const A = this.p[X] + Y, AA = this.p[A] + Z, AB = this.p[A + 1] + Z;
        const B = this.p[X + 1] + Y, BA = this.p[B] + Z, BB = this.p[B + 1] + Z;
        return this.lerp(w, this.lerp(v, this.lerp(u, this.grad(this.p[AA], x, y, z), this.grad(this.p[BA], x - 1, y, z)),
            this.lerp(u, this.grad(this.p[AB], x, y - 1, z), this.grad(this.p[BB], x - 1, y - 1, z))),
            this.lerp(v, this.lerp(u, this.grad(this.p[AA + 1], x, y, z - 1), this.grad(this.p[BA + 1], x - 1, y, z - 1)),
                this.lerp(u, this.grad(this.p[AB + 1], x, y - 1, z - 1), this.grad(this.p[BB + 1], x - 1, y - 1, z - 1))));
    }
}

// --- Constants & Globals ---
const perlin = new Perlin();
const CHUNK_SIZE = 16;
const RENDER_DISTANCE = 4; // Chunks radius
const CHUNK_HEIGHT_SCALE = 20;

const BLOCK_TYPES = {
    GRASS: 0,
    DIRT: 1,
    STONE: 2,
    WATER: 3,
    SAND: 4,
    WOOD: 5,
    LEAVES: 6,
    SNOW: 7,
    BEDROCK: 8
};

const COLOR_PALETTE = [
    0x55ff55, // Grass
    0x8b4513, // Dirt
    0x808080, // Stone
    0x5555ff, // Water
    0xffff55, // Sand
    0x654321, // Wood
    0x228b22, // Leaves
    0xffffff, // Snow
    0x222222  // Bedrock
];
// 0: Grass, 1: Dirt, 2: Stone, 3: Water, 4: Sand, 5: Wood, 6: Leaves, 7: Snow, 8: Bedrock

let camera, scene, renderer, controls, raycaster;
const moveState = { forward: false, backward: false, left: false, right: false };
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let prevTime = performance.now();
let isLocked = false;
let activeBlockIndex = 0;

// Physics
const GRAVITY = 30.0;
const JUMP_SPEED = 12.0;
const MOVE_SPEED = 2.5;
const PLAYER_HEIGHT = 1.6;
const PLAYER_RADIUS = 0.45;

// World Data
const chunks = new Map(); // "x,z" -> Chunk
const chunkMeshes = new THREE.Group(); // Holds all chunk meshes

// Geometry reused for all blocks
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

// Materials (One per type)
const materials = COLOR_PALETTE.map(c => new THREE.MeshLambertMaterial({ color: c }));

// --- Chunk Class ---
class Chunk {
    constructor(cx, cz) {
        this.cx = cx;
        this.cz = cz;
        this.blocks = new Map(); // "x,y,z" (relative) -> type
        this.instancedMeshes = []; // Array of InstancedMesh
        this.dirty = false;
        
        this.generate();
        this.build();
    }

    generate() {
        const scale = 0.03;
        const SEA_LEVEL = 4;
        
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const wx = this.cx * CHUNK_SIZE + x;
                const wz = this.cz * CHUNK_SIZE + z;
                
                // Height Noise
                const n = perlin.noise(wx * scale, wz * scale, 0);
                const h = Math.floor((n + 1) * 0.5 * CHUNK_HEIGHT_SCALE); // 0 to 20 height
                
                // Fill Column
                for (let y = -5; y <= Math.max(h, SEA_LEVEL); y++) {
                    let type = null;

                    if (y === -5) {
                        type = BLOCK_TYPES.BEDROCK;
                    } else if (y <= h) {
                        // Solid Ground
                        if (y === h) {
                            // Top Block
                            if (y < SEA_LEVEL + 2) type = BLOCK_TYPES.SAND; // Beach
                            else if (y > 15) type = BLOCK_TYPES.SNOW; // Peaks
                            else type = BLOCK_TYPES.GRASS;
                        } else if (y > h - 4) {
                            type = BLOCK_TYPES.DIRT;
                        } else {
                            type = BLOCK_TYPES.STONE;
                        }
                    } else if (y <= SEA_LEVEL) {
                        // Water
                        type = BLOCK_TYPES.WATER;
                    }

                    if (type !== null) {
                        this.blocks.set(`${x},${y},${z}`, type);
                    }
                }

                // Trees (Simple) - Only on Grass
                const surfaceBlock = this.blocks.get(`${x},${h},${z}`);
                if (surfaceBlock === BLOCK_TYPES.GRASS && Math.random() > 0.98) {
                    const treeHeight = 3 + Math.floor(Math.random() * 2);
                    // Trunk
                    for (let i = 1; i <= treeHeight; i++) {
                        this.blocks.set(`${x},${h+i},${z}`, BLOCK_TYPES.WOOD);
                    }
                    // Leaves (Simple top)
                    this.blocks.set(`${x},${h+treeHeight+1},${z}`, BLOCK_TYPES.LEAVES);
                    this.blocks.set(`${x+1},${h+treeHeight},${z}`, BLOCK_TYPES.LEAVES);
                    this.blocks.set(`${x-1},${h+treeHeight},${z}`, BLOCK_TYPES.LEAVES);
                    this.blocks.set(`${x},${h+treeHeight},${z+1}`, BLOCK_TYPES.LEAVES);
                    this.blocks.set(`${x},${h+treeHeight},${z-1}`, BLOCK_TYPES.LEAVES);
                }
            }
        }
    }

    build() {
        // Clear old meshes
        this.disposeMeshes();

        // Sort blocks by type to create instanced meshes
        const blocksByType = Array.from({ length: COLOR_PALETTE.length }, () => []);
        
        for (const [key, type] of this.blocks) {
            if (blocksByType[type] !== undefined) {
                const parts = key.split(',');
                const x = parseInt(parts[0]);
                const y = parseInt(parts[1]);
                const z = parseInt(parts[2]);
                blocksByType[type].push({x, y, z});
            }
        }

        // Create InstancedMesh for each type that has blocks
        blocksByType.forEach((list, typeIndex) => {
            if (list.length === 0) return;

            const mesh = new THREE.InstancedMesh(boxGeometry, materials[typeIndex], list.length);
            const dummy = new THREE.Object3D();

            list.forEach((pos, i) => {
                dummy.position.set(
                    (this.cx * CHUNK_SIZE) + pos.x,
                    pos.y,
                    (this.cz * CHUNK_SIZE) + pos.z
                );
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
            });

            mesh.instanceMatrix.needsUpdate = true;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            // Store type info for raycasting interaction later
            mesh.userData = { chunk: this, type: typeIndex };
            
            this.instancedMeshes.push(mesh);
            chunkMeshes.add(mesh);
        });
    }

    disposeMeshes() {
        this.instancedMeshes.forEach(m => {
            chunkMeshes.remove(m);
            m.dispose();
        });
        this.instancedMeshes = [];
    }

    dispose() {
        this.disposeMeshes();
        this.blocks.clear();
    }

    getBlock(rx, y, rz) {
        return this.blocks.get(`${rx},${y},${rz}`);
    }

    setBlock(rx, y, rz, type) {
        if (type === null) {
            this.blocks.delete(`${rx},${y},${rz}`);
        } else {
            this.blocks.set(`${rx},${y},${rz}`, type);
        }
        this.rebuild();
    }

    rebuild() {
        this.build();
    }
}

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 20, 80);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 1000);
    camera.position.set(0, 30, 0);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(50, 100, 50);
    dir.castShadow = true;
    scene.add(dir);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Controls
    controls = new SimplePointerLockControls(camera, document.body);
    const instructions = document.getElementById('instructions');
    instructions.addEventListener('click', () => controls.lock());
    controls.addEventListener('lock', () => {
        instructions.style.display = 'none'; isLocked = true;
    });
    controls.addEventListener('unlock', () => {
        instructions.style.display = 'flex'; isLocked = false;
        moveState.forward = false; moveState.backward = false;
        moveState.left = false; moveState.right = false;
    });
    scene.add(controls.getObject());

    // Inputs
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('resize', onWindowResize);

    raycaster = new THREE.Raycaster();
    
    // Add chunk holder
    scene.add(chunkMeshes);

    setupUI();
    
    // Initial World Load
    updateChunks();
}

// --- Infinite World Logic ---
function updateChunks() {
    const px = controls.getObject().position.x;
    const pz = controls.getObject().position.z;
    
    const currentCx = Math.floor(px / CHUNK_SIZE);
    const currentCz = Math.floor(pz / CHUNK_SIZE);

    const activeKeys = new Set();
    
    for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
        for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
            const key = `${currentCx + x},${currentCz + z}`;
            activeKeys.add(key);
            
            if (!chunks.has(key)) {
                const chunk = new Chunk(currentCx + x, currentCz + z);
                chunks.set(key, chunk);
            }
        }
    }

    for (const [key, chunk] of chunks) {
        if (!activeKeys.has(key)) {
            chunk.dispose();
            chunks.delete(key);
        }
    }
}

function getBlockGlobal(x, y, z) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    const iz = Math.round(z);

    const cx = Math.floor(ix / CHUNK_SIZE);
    const cz = Math.floor(iz / CHUNK_SIZE);
    const key = `${cx},${cz}`;
    
    const chunk = chunks.get(key);
    if (!chunk) return undefined;

    let rx = ix - (cx * CHUNK_SIZE);
    let rz = iz - (cz * CHUNK_SIZE);
    return chunk.getBlock(rx, iy, rz);
}

function setBlockGlobal(x, y, z, type) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    const iz = Math.round(z);

    const cx = Math.floor(ix / CHUNK_SIZE);
    const cz = Math.floor(iz / CHUNK_SIZE);
    const key = `${cx},${cz}`;
    
    const chunk = chunks.get(key);
    if (chunk) {
        let rx = ix - (cx * CHUNK_SIZE);
        let rz = iz - (cz * CHUNK_SIZE);
        chunk.setBlock(rx, iy, rz, type);
    }
}

function checkPlayerCollision(pos, checkLegs = true) {
    const r = PLAYER_RADIUS; 
    const h = PLAYER_HEIGHT;
    
    // Player AABB Bounds
    const minX = pos.x - r;
    const maxX = pos.x + r;
    const minZ = pos.z - r;
    const maxZ = pos.z + r;
    
    // Y Bounds
    // Step Height increased to 0.5 (knee) to prevent floor sticking
    const stepHeight = 0.5; 
    const minY = (pos.y - h) + (checkLegs ? 0 : stepHeight);
    const maxY = pos.y;

    const startX = Math.round(minX);
    const endX = Math.round(maxX);
    const startY = Math.round(minY);
    const endY = Math.round(maxY);
    const startZ = Math.round(minZ);
    const endZ = Math.round(maxZ);

    for (let x = startX; x <= endX; x++) {
        for (let y = startY; y <= endY; y++) {
            for (let z = startZ; z <= endZ; z++) {
                if (getBlockGlobal(x, y, z) !== undefined) {
                    return true;
                }
            }
        }
    }
    return false;
}

let lastChunkUpdate = 0;
let canJump = false;

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    let delta = Math.min((time - prevTime) / 1000, 0.1);
    prevTime = time;
    
    // Chunk updates
    if (time - lastChunkUpdate > 200) {
        updateChunks();
        lastChunkUpdate = time;
    }

    if (isLocked) {
        // Apply Forces
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= GRAVITY * delta; 

        direction.z = Number(moveState.forward) - Number(moveState.backward);
        direction.x = Number(moveState.right) - Number(moveState.left);
        direction.normalize(); 

        if (moveState.forward || moveState.backward) velocity.z -= direction.z * MOVE_SPEED * 40.0 * delta;
        if (moveState.left || moveState.right) velocity.x -= direction.x * MOVE_SPEED * 40.0 * delta;

        // Sub-stepping for robust collision
        // We split the frame into small time steps to prevent tunneling
        const steps = 5; 
        const subDelta = delta / steps;

        for (let i = 0; i < steps; i++) {
            // X Movement
            const originalPos = controls.getObject().position.clone();
            controls.moveRight(-velocity.x * subDelta);
            if (checkPlayerCollision(controls.getObject().position, false)) {
                controls.getObject().position.x = originalPos.x;
                velocity.x = 0;
            }

            // Z Movement
            const posAfterX = controls.getObject().position.clone();
            controls.moveForward(-velocity.z * subDelta);
            if (checkPlayerCollision(controls.getObject().position, false)) {
                controls.getObject().position.z = posAfterX.z;
                velocity.z = 0;
            }

            // Y Movement
            controls.getObject().position.y += velocity.y * subDelta;
            if (checkPlayerCollision(controls.getObject().position, true)) {
                if (velocity.y < 0) { // Hit floor
                    // Push out of floor slightly to prevent 'sticky' micro-collisions
                    // We revert exactly to previous safe Y
                    controls.getObject().position.y -= velocity.y * subDelta;
                    velocity.y = 0;
                    canJump = true;
                } else { // Hit ceiling
                    controls.getObject().position.y -= velocity.y * subDelta;
                    velocity.y = 0;
                }
            }
        }
        
        // World Boundary Reset
        if (controls.getObject().position.y < -30) {
            velocity.y = 0;
            controls.getObject().position.set(0, 30, 0);
        }
    }

    renderer.render(scene, camera);
}

function onMouseDown(event) {
    if (!isLocked) return;
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(chunkMeshes.children);
    if (intersects.length > 0) {
        const hit = intersects[0];
        const mesh = hit.object;
        const dummy = new THREE.Object3D();
        mesh.getMatrixAt(hit.instanceId, dummy.matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
        const bx = Math.round(dummy.position.x);
        const by = Math.round(dummy.position.y);
        const bz = Math.round(dummy.position.z);
        if (event.button === 0) {
            setBlockGlobal(bx, by, bz, null);
        } else if (event.button === 2) {
            const nx = hit.face.normal.x;
            const ny = hit.face.normal.y;
            const nz = hit.face.normal.z;
            const tx = bx + Math.round(nx);
            const ty = by + Math.round(ny);
            const tz = bz + Math.round(nz);
            const p = controls.getObject().position;
            const dx = Math.abs(tx - p.x);
            const dz = Math.abs(tz - p.z);
            if (dx < 0.8 && dz < 0.8 && ty < p.y && ty > p.y - 2.0) return;
            setBlockGlobal(tx, ty, tz, activeBlockIndex);
        }
    }
}

function setupUI() {
    const toolbar = document.getElementById('toolbar');
    toolbar.innerHTML = '';
    COLOR_PALETTE.forEach((color, index) => {
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
        case 'KeyW': moveState.forward = true; break;
        case 'KeyA': moveState.left = true; break;
        case 'KeyS': moveState.backward = true; break;
        case 'KeyD': moveState.right = true; break;
        case 'Space': if (canJump) velocity.y = JUMP_SPEED; canJump = false; break;
        case 'Digit1': activeBlockIndex = 0; updateUI(); break;
        case 'Digit2': activeBlockIndex = 1; updateUI(); break;
        case 'Digit3': activeBlockIndex = 2; updateUI(); break;
        case 'Digit4': activeBlockIndex = 3; updateUI(); break;
        case 'Digit5': activeBlockIndex = 4; updateUI(); break;
        case 'Digit6': activeBlockIndex = 5; updateUI(); break;
        case 'Digit7': activeBlockIndex = 6; updateUI(); break;
        case 'Digit8': activeBlockIndex = 7; updateUI(); break;
        case 'Digit9': activeBlockIndex = 8; updateUI(); break;
    }
}
function onKeyUp(event) {
    switch (event.code) {
        case 'KeyW': moveState.forward = false; break;
        case 'KeyA': moveState.left = false; break;
        case 'KeyS': moveState.backward = false; break;
        case 'KeyD': moveState.right = false; break;
    }
}
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Execution
init();
animate();
