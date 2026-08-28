// Main Game Coordinator: Physics World, Three.js Rendering, Camera System & Game Loop
class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.world = null;

        // Subsystems
        this.audio = null;
        this.effects = null;
        this.worldGen = null;
        this.vehicle = null;
        this.traffic = null;
        this.challenges = null;
        this.ui = null;

        // Camera Modes: 'chase', 'cockpit', 'hood', 'orbit'
        this.cameraModes = ['chase', 'cockpit', 'hood', 'orbit'];
        this.currentCamIdx = 0;
        this.orbitAngle = 0;

        // Input
        this.keys = {};
        this.isPaused = false;
        this.lastTime = performance.now();

        this.init();
    }

    init() {
        // 1. Scene & Renderer
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2500);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;

        const container = document.getElementById('container');
        if (container) {
            container.innerHTML = '';
            container.appendChild(this.renderer.domElement);
        }

        // 2. Physics World (Cannon.js)
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82, 0);
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        this.world.defaultContactMaterial.friction = 0.4;
        this.world.defaultContactMaterial.restitution = 0.2;

        // 3. Subsystems
        this.audio = new AudioSystem();
        this.effects = new EffectsManager(this.scene, this.camera, this.renderer);
        this.worldGen = new WorldGen(this.scene, this.world);
        this.vehicle = new PhysicsVehicle(this.world, this.scene, this.audio, this.effects);
        this.traffic = new TrafficManager(this.scene, this.world, this.worldGen.trafficNodes, this.audio, this.effects);
        this.challenges = new Challenges(this.scene, this.audio);

        // 4. UI Manager & Callbacks
        this.ui = new UIManager({
            onSelectCar: (typeIdx) => {
                this.vehicle.switchCar(typeIdx);
                const carInfo = CarModels.CAR_TYPES[typeIdx];
                this.ui.showBanner(`${carInfo.name.toUpperCase()} - ${carInfo.desc}`);
            },
            onToggleCam: () => this.cycleCamera(),
            onToggleWeather: () => this.effects.cycleWeather(),
            onCycleRadio: () => this.audio.cycleStation(),
            onReset: () => {
                this.vehicle.reset();
                this.ui.showBanner('CAR RESET');
            },
            onSelectChallenge: (mode) => {
                this.challenges.startChallenge(mode);
                this.ui.showBanner(`MODE: ${mode.toUpperCase()}`);
            }
        });

        this.setupKeyboard();
        this.setupResize();

        // Banner welcome
        this.ui.showBanner('DRIVE, DRIFT & HIT STUNT RAMPS!', 3000);

        // Start Loop
        requestAnimationFrame((time) => this.loop(time));
    }

    cycleCamera() {
        this.currentCamIdx = (this.currentCamIdx + 1) % this.cameraModes.length;
        const name = this.cameraModes[this.currentCamIdx].toUpperCase();
        this.ui.showBanner(`CAMERA: ${name}`);
        return name;
    }

    setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            if (this.audio && !this.audio.initialized) {
                this.audio.init();
            }

            this.keys[e.code] = true;

            if (e.code === 'KeyC') {
                this.cycleCamera();
            } else if (e.code === 'KeyT') {
                const w = this.effects.cycleWeather();
                this.ui.showBanner(`WEATHER: ${w}`);
            } else if (e.code === 'KeyM') {
                const r = this.audio.cycleStation();
                this.ui.showBanner(`RADIO: ${r}`);
            } else if (e.code === 'KeyR') {
                this.vehicle.reset();
                this.ui.showBanner('CAR RESET');
            } else if (e.code === 'KeyH') {
                if (this.audio) this.audio.playHorn();
            } else if (e.code === 'Digit1') {
                this.vehicle.switchCar(0);
                this.ui.showBanner('APEX SUPERCAR');
            } else if (e.code === 'Digit2') {
                this.vehicle.switchCar(1);
                this.ui.showBanner('V8 THUNDER MUSCLE');
            } else if (e.code === 'Digit3') {
                this.vehicle.switchCar(2);
                this.ui.showBanner('NEON CYBER HYPERCAR');
            } else if (e.code === 'Digit4') {
                this.vehicle.switchCar(3);
                this.ui.showBanner('TITAN 4x4 OFFROAD');
            } else if (e.code === 'KeyP') {
                this.isPaused = !this.isPaused;
                this.ui.showBanner(this.isPaused ? 'GAME PAUSED' : 'GAME RESUMED');
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    setupResize() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    updateCamera(dt) {
        if (!this.vehicle || !this.vehicle.visualModel) return;

        const carMesh = this.vehicle.visualModel.mesh;
        const carQuat = carMesh.quaternion;
        const carPos = carMesh.position;
        const speedMs = this.vehicle.chassisBody.velocity.length();

        const mode = this.cameraModes[this.currentCamIdx];

        if (mode === 'chase') {
            // Dynamic Chase Cam: Behind (-X) and Above (+Y)
            const chaseDist = 7.2 + (speedMs * 0.07);
            const chaseHeight = 3.0 + (speedMs * 0.015);

            const offset = new THREE.Vector3(-chaseDist, chaseHeight, 0).applyQuaternion(carQuat);
            const targetPos = carPos.clone().add(offset);
            const lookTarget = carPos.clone().add(new THREE.Vector3(14, 0.9, 0).applyQuaternion(carQuat));

            this.camera.position.lerp(targetPos, Math.min(1.0, dt * 10));
            if (!this.currentLookAt) this.currentLookAt = lookTarget.clone();
            this.currentLookAt.lerp(lookTarget, Math.min(1.0, dt * 12));
            this.camera.lookAt(this.currentLookAt);

            // Dynamic FOV on speed / nitro
            const targetFov = 70 + (speedMs * 0.45) + (this.vehicle.isNitroActive ? 12 : 0);
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, Math.min(115, targetFov), dt * 6);
            this.camera.updateProjectionMatrix();

        } else if (mode === 'cockpit') {
            // First-person cockpit interior
            const isOffroad = this.vehicle.carTypeIndex === 3;
            const eyeOffset = new THREE.Vector3(0.05, isOffroad ? 1.35 : 0.88, -0.35).applyQuaternion(carQuat);
            const eyePos = carPos.clone().add(eyeOffset);
            const lookTarget = carPos.clone().add(new THREE.Vector3(25, 0.85, -0.35).applyQuaternion(carQuat));

            this.camera.position.copy(eyePos);
            this.camera.lookAt(lookTarget);
            this.camera.fov = 78;
            this.camera.updateProjectionMatrix();

        } else if (mode === 'hood') {
            // Low Bumper / Hood Cam
            const hoodOffset = new THREE.Vector3(2.3, 0.7, 0).applyQuaternion(carQuat);
            const hoodPos = carPos.clone().add(hoodOffset);
            const lookTarget = carPos.clone().add(new THREE.Vector3(30, 0.4, 0).applyQuaternion(carQuat));

            this.camera.position.copy(hoodPos);
            this.camera.lookAt(lookTarget);
            this.camera.fov = 85;
            this.camera.updateProjectionMatrix();

        } else if (mode === 'orbit') {
            // Drone Orbit Heli Cam
            this.orbitAngle += dt * 0.4;
            const orbitDist = 18;
            const orbitH = 8;
            this.camera.position.set(
                carPos.x + Math.cos(this.orbitAngle) * orbitDist,
                carPos.y + orbitH,
                carPos.z + Math.sin(this.orbitAngle) * orbitDist
            );
            this.camera.lookAt(carPos.clone().add(new THREE.Vector3(0, 1, 0)));
            this.camera.fov = 65;
            this.camera.updateProjectionMatrix();
        }
    }

    loop(currentTime) {
        requestAnimationFrame((time) => this.loop(time));

        const dt = Math.min(0.05, (currentTime - this.lastTime) / 1000);
        this.lastTime = currentTime;

        if (!this.isPaused) {
            // Merge Keyboard + Touch Keys
            const combinedKeys = Object.assign({}, this.keys, this.ui ? this.ui.touchKeys : {});

            // Physics Step
            this.world.step(1 / 60, dt, 3);

            // Update Vehicle
            this.vehicle.update(dt, combinedKeys, (stuntMsg) => {
                this.ui.showBanner(stuntMsg);
            });

            // Update World Props & Speed Traps
            this.worldGen.update(
                dt,
                this.vehicle.chassisBody.position,
                this.vehicle.speedKmh,
                (label, speed) => {
                    this.ui.showBanner(`📸 ${label}: ${speed} KM/H!`);
                    if (this.audio) this.audio.playCheckpoint();
                }
            );

            // Update AI Traffic
            this.traffic.update(dt, this.vehicle.chassisBody, (impact) => {
                this.vehicle.carHealth = Math.max(0, this.vehicle.carHealth - impact * 12);
                this.ui.showBanner(`💥 CRASH! HEALTH -${Math.round(impact * 12)}%`);
            });

            // Update Challenges
            this.challenges.update(
                dt,
                this.vehicle.chassisBody.position,
                this.vehicle.driftScore,
                (eventMsg) => this.ui.showBanner(eventMsg)
            );

            // Update Effects & Particles
            this.effects.update(dt, this.vehicle.chassisBody.position);
        }

        // Update Camera
        this.updateCamera(dt);

        // Update HUD
        if (this.ui) {
            this.ui.update(this.vehicle, this.traffic ? this.traffic.vehicles : null, this.challenges);
        }

        // Render Frame
        this.renderer.render(this.scene, this.camera);
    }
}

// Instantiate on load
window.addEventListener('DOMContentLoaded', () => {
    try {
        window.game = new Game();
    } catch (err) {
        console.error('Failed to initialize Car Simulator:', err);
    }
});
