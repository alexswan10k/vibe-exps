class CarSimulator {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.world = null;
        this.vehicle = null;
        this.carChassis = null;
        this.cameraRig = null;
        this.keys = {};
        this.speedDisplay = document.getElementById('speed');
        this.gearDisplay = document.getElementById('gear');
        this.rpmDisplay = document.getElementById('rpm');
        this.fuelDisplay = document.getElementById('fuel');
        this.healthDisplay = document.getElementById('health');
        this.scoreDisplay = document.getElementById('score');
        this.minimapCanvas = document.getElementById('minimap-canvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');

        // New properties for improvements
        this.trafficVehicles = [];
        this.pedestrians = [];
        this.particles = [];
        this.audioContext = null;
        this.engineSound = null;
        this.carHealth = 100;
        this.fuel = 100;
        this.score = 0;
        this.gameTime = 0;
        this.isPaused = false;
        this.showDebug = false;

        this.init();
        this.createGround();
        this.createCar();
        this.createProceduralTown();
        this.createTraffic();
        this.setupControls();
        this.setupAudio();
        this.animate();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x87CEEB, 100, 1000);

        // Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.cameraRig = new THREE.Object3D();
        this.cameraRig.add(this.camera);
        this.scene.add(this.cameraRig);

        // Position camera initially
        this.cameraRig.position.set(0, 10, 10);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87CEEB);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('container').appendChild(this.renderer.domElement);

        // Physics World
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82, 0);
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        this.world.defaultContactMaterial.friction = 0.4;
        this.world.defaultContactMaterial.restitution = 0.3;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 50, 25);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        this.scene.add(directionalLight);

        // Resize handler
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    createGround() {
        // Ground geometry
        const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x4a5d23 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Physics ground
        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({ mass: 0 });
        groundBody.addShape(groundShape);
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        this.world.addBody(groundBody);
    }

    createCar() {
        // Car chassis
        const chassisShape = new CANNON.Box(new CANNON.Vec3(1.8, 0.4, 0.8));
        this.carChassis = new CANNON.Body({ mass: 800 });
        this.carChassis.addShape(chassisShape);
        this.carChassis.position.set(0, 2, 0);
        this.world.addBody(this.carChassis);

        // Car body group
        this.carMesh = new THREE.Group();
        this.scene.add(this.carMesh);

        // Main body
        const bodyGeometry = new THREE.BoxGeometry(4.2, 1.2, 1.8);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.1;
        body.castShadow = true;
        this.carMesh.add(body);

        // Hood
        const hoodGeometry = new THREE.BoxGeometry(1.5, 0.8, 1.6);
        const hood = new THREE.Mesh(hoodGeometry, bodyMaterial);
        hood.position.set(1.2, 0.5, 0);
        hood.castShadow = true;
        this.carMesh.add(hood);

        // Trunk
        const trunkGeometry = new THREE.BoxGeometry(1.2, 0.9, 1.6);
        const trunk = new THREE.Mesh(trunkGeometry, bodyMaterial);
        trunk.position.set(-1.4, 0.4, 0);
        trunk.castShadow = true;
        this.carMesh.add(trunk);

        // Windows
        const windowMaterial = new THREE.MeshLambertMaterial({ color: 0x87CEEB, transparent: true, opacity: 0.7 });
        const windshieldGeometry = new THREE.BoxGeometry(1.8, 0.8, 0.1);
        const windshield = new THREE.Mesh(windshieldGeometry, windowMaterial);
        windshield.position.set(0.8, 0.8, 0);
        this.carMesh.add(windshield);

        const rearWindowGeometry = new THREE.BoxGeometry(0.8, 0.6, 0.1);
        const rearWindow = new THREE.Mesh(rearWindowGeometry, windowMaterial);
        rearWindow.position.set(-1.2, 0.7, 0);
        this.carMesh.add(rearWindow);

        // Side windows
        const sideWindowGeometry = new THREE.BoxGeometry(0.1, 0.6, 1.4);
        const leftWindow = new THREE.Mesh(sideWindowGeometry, windowMaterial);
        leftWindow.position.set(0, 0.7, 0);
        this.carMesh.add(leftWindow);

        const rightWindow = new THREE.Mesh(sideWindowGeometry, windowMaterial);
        rightWindow.position.set(0, 0.7, 0);
        this.carMesh.add(rightWindow);

        // Wheels
        const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 16);
        wheelGeometry.rotateZ(Math.PI / 2);
        const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const rimMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });

        this.wheelMeshes = [];
        for (let i = 0; i < 4; i++) {
            const wheelGroup = new THREE.Group();
            const tire = new THREE.Mesh(wheelGeometry, wheelMaterial);
            const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 16), rimMaterial);
            rim.rotateZ(Math.PI / 2);
            wheelGroup.add(tire);
            wheelGroup.add(rim);
            wheelGroup.castShadow = true;
            this.scene.add(wheelGroup);
            this.wheelMeshes.push(wheelGroup);
        }

        // Raycast vehicle
        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: this.carChassis,
            indexForwardAxis: 2,
            indexRightAxis: 0,
            indexUpAxis: 1
        });

        const wheelOptions = {
            radius: 0.5,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 30,
            suspensionRestLength: 0.3,
            frictionSlip: 5,
            dampingRelaxation: 2.3,
            dampingCompression: 4.4,
            maxSuspensionForce: 100000,
            rollInfluence: 0.01,
            axleLocal: new CANNON.Vec3(1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(0, 0, 0),
            maxSuspensionTravel: 0.3,
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true
        };

        // Add wheels
        wheelOptions.chassisConnectionPointLocal.set(-1.5, -0.5, -1); // FL
        this.vehicle.addWheel(wheelOptions);

        wheelOptions.chassisConnectionPointLocal.set(1.5, -0.5, -1); // FR
        this.vehicle.addWheel(wheelOptions);

        wheelOptions.chassisConnectionPointLocal.set(-1.5, -0.5, 1); // RL
        this.vehicle.addWheel(wheelOptions);

        wheelOptions.chassisConnectionPointLocal.set(1.5, -0.5, 1); // RR
        this.vehicle.addWheel(wheelOptions);

        // Add vehicle to world
        this.vehicle.addToWorld(this.world); // Correct method for RaycastVehicle
    }

    createProceduralTown() {
        // Buildings
        for (let i = 0; i < 50; i++) {
            const x = (Math.random() - 0.5) * 800;
            const z = (Math.random() - 0.5) * 800;
            const height = Math.random() * 20 + 5;
            const width = Math.random() * 10 + 5;
            const depth = Math.random() * 10 + 5;

            // Building group
            const buildingGroup = new THREE.Group();
            buildingGroup.position.set(x, 0, z);

            // Main building
            const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
            const buildingMaterial = new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff });
            const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
            building.position.y = height / 2;
            building.castShadow = true;
            building.receiveShadow = true;
            buildingGroup.add(building);

            // Windows
            const windowMaterial = new THREE.MeshLambertMaterial({ color: 0xffff88, transparent: true, opacity: 0.8 });
            const windowRows = Math.floor(height / 2);
            const windowCols = Math.floor(width / 2);
            for (let row = 0; row < windowRows; row++) {
                for (let col = 0; col < windowCols; col++) {
                    if (Math.random() > 0.3) { // Some windows lit
                        const windowGeom = new THREE.BoxGeometry(0.8, 0.8, 0.1);
                        const windowMesh = new THREE.Mesh(windowGeom, windowMaterial);
                        windowMesh.position.set(
                            -width/2 + (col + 0.5) * (width / windowCols),
                            row * 2 + 1,
                            depth/2 + 0.05
                        );
                        buildingGroup.add(windowMesh);
                    }
                }
            }

            this.scene.add(buildingGroup);

            const buildingShape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, depth/2));
            const buildingBody = new CANNON.Body({ mass: 0 });
            buildingBody.addShape(buildingShape);
            buildingBody.position.set(x, height / 2, z);
            this.world.addBody(buildingBody);
        }

        // Trees
        for (let i = 0; i < 100; i++) {
            const x = (Math.random() - 0.5) * 1000;
            const z = (Math.random() - 0.5) * 1000;
            if (Math.abs(x) < 100 && Math.abs(z) < 100) continue; // Avoid center

            const treeGroup = new THREE.Group();
            treeGroup.position.set(x, 0, z);

            // Trunk
            const trunkGeom = new THREE.CylinderGeometry(0.5, 0.5, 3, 8);
            const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            const trunk = new THREE.Mesh(trunkGeom, trunkMat);
            trunk.position.y = 1.5;
            trunk.castShadow = true;
            treeGroup.add(trunk);

            // Leaves
            const leavesGeom = new THREE.SphereGeometry(2, 8, 6);
            const leavesMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
            const leaves = new THREE.Mesh(leavesGeom, leavesMat);
            leaves.position.y = 3.5;
            leaves.castShadow = true;
            treeGroup.add(leaves);

            this.scene.add(treeGroup);
        }

        // Street lights
        for (let i = 0; i < 40; i++) {
            const x = (Math.random() - 0.5) * 600;
            const z = (Math.random() - 0.5) * 600;

            const lightGroup = new THREE.Group();
            lightGroup.position.set(x, 0, z);

            // Pole
            const poleGeom = new THREE.CylinderGeometry(0.1, 0.1, 6, 8);
            const poleMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
            const pole = new THREE.Mesh(poleGeom, poleMat);
            pole.position.y = 3;
            pole.castShadow = true;
            lightGroup.add(pole);

            // Light
            const lightGeom = new THREE.SphereGeometry(0.3, 8, 6);
            const lightMat = new THREE.MeshBasicMaterial({ color: 0xffff88 });
            const lightMesh = new THREE.Mesh(lightGeom, lightMat);
            lightMesh.position.set(1, 5.5, 0);
            lightGroup.add(lightMesh);

            // Arm
            const armGeom = new THREE.CylinderGeometry(0.05, 0.05, 2, 8);
            const arm = new THREE.Mesh(armGeom, poleMat);
            arm.position.set(0.5, 5.5, 0);
            arm.rotation.z = Math.PI / 2;
            lightGroup.add(arm);

            this.scene.add(lightGroup);

            // Point light
            const pointLight = new THREE.PointLight(0xffff88, 0.5, 20);
            pointLight.position.set(x + 1, 5.5, z);
            this.scene.add(pointLight);
        }

        // Roads with lane markings
        const roadMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const lineMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
        for (let i = -10; i <= 10; i++) {
            // Horizontal roads
            const roadHGeometry = new THREE.PlaneGeometry(1000, 20);
            const roadH = new THREE.Mesh(roadHGeometry, roadMaterial);
            roadH.rotation.x = -Math.PI / 2;
            roadH.position.set(0, 0.01, i * 50);
            this.scene.add(roadH);

            // Center line
            const lineHGeometry = new THREE.PlaneGeometry(1000, 0.2);
            const lineH = new THREE.Mesh(lineHGeometry, lineMaterial);
            lineH.rotation.x = -Math.PI / 2;
            lineH.position.set(0, 0.02, i * 50);
            this.scene.add(lineH);

            // Vertical roads
            const roadVGeometry = new THREE.PlaneGeometry(20, 1000);
            const roadV = new THREE.Mesh(roadVGeometry, roadMaterial);
            roadV.rotation.x = -Math.PI / 2;
            roadV.position.set(i * 50, 0.01, 0);
            this.scene.add(roadV);

            // Center line
            const lineVGeometry = new THREE.PlaneGeometry(0.2, 1000);
            const lineV = new THREE.Mesh(lineVGeometry, lineMaterial);
            lineV.rotation.x = -Math.PI / 2;
            lineV.position.set(i * 50, 0.02, 0);
            this.scene.add(lineV);
        }
    }

    setupControls() {
        document.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;
            if (event.code === 'KeyP') this.togglePause();
            if (event.code === 'KeyF') this.toggleDebug();
        });
        document.addEventListener('keyup', (event) => this.keys[event.code] = false);
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseOverlay = document.getElementById('pause-overlay') || this.createPauseOverlay();
        pauseOverlay.style.display = this.isPaused ? 'flex' : 'none';
    }

    toggleDebug() {
        this.showDebug = !this.showDebug;
        const debugInfo = document.getElementById('debug-info') || this.createDebugInfo();
        debugInfo.style.display = this.showDebug ? 'block' : 'none';
    }

    createPauseOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'pause-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); display: flex; align-items: center;
            justify-content: center; z-index: 1000; color: white; font-size: 24px;
        `;
        overlay.innerHTML = '<div>PAUSED<br>Press P to resume</div>';
        document.body.appendChild(overlay);
        return overlay;
    }

    createDebugInfo() {
        const debug = document.createElement('div');
        debug.id = 'debug-info';
        debug.style.cssText = `
            position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.9); color: #00ff00; padding: 10px;
            font-family: monospace; font-size: 12px; border-radius: 5px;
            display: none; z-index: 100;
        `;
        document.getElementById('container').appendChild(debug);
        return debug;
    }

    setupAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.createEngineSound();
        } catch (e) {
            console.log('Audio not supported');
        }
    }

    createEngineSound() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(80, this.audioContext.currentTime);

        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.start();
        this.engineSound = { oscillator, gainNode };
    }

    createTraffic() {
        const trafficColors = [0xff0000, 0x0000ff, 0x00ff00, 0xffff00, 0xff00ff, 0x00ffff];

        for (let i = 0; i < 15; i++) {
            const x = (Math.random() - 0.5) * 600;
            const z = (Math.random() - 0.5) * 600;
            const color = trafficColors[Math.floor(Math.random() * trafficColors.length)];

            // Traffic car body
            const trafficCar = new THREE.Group();
            trafficCar.position.set(x, 1, z);

            const bodyGeom = new THREE.BoxGeometry(3.5, 1, 1.5);
            const bodyMat = new THREE.MeshLambertMaterial({ color });
            const body = new THREE.Mesh(bodyGeom, bodyMat);
            body.castShadow = true;
            trafficCar.add(body);

            // Simple wheels
            const wheelGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8);
            wheelGeom.rotateZ(Math.PI / 2);
            const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222222 });

            for (let j = 0; j < 4; j++) {
                const wheel = new THREE.Mesh(wheelGeom, wheelMat);
                wheel.position.set(
                    j % 2 === 0 ? -1.2 : 1.2,
                    -0.5,
                    j < 2 ? -0.6 : 0.6
                );
                trafficCar.add(wheel);
            }

            this.scene.add(trafficCar);
            this.trafficVehicles.push({
                mesh: trafficCar,
                speed: 10 + Math.random() * 20,
                direction: Math.random() * Math.PI * 2,
                lastPosition: new THREE.Vector3(x, 1, z)
            });
        }
    }

    updateCar() {
        if (this.isPaused) return;

        const maxSteerVal = Math.PI / 8;
        const maxForce = 3000; // Increased power for better acceleration
        const brakeForce = 20;

        let steer = 0;
        if (this.keys.KeyA) steer = -maxSteerVal;
        if (this.keys.KeyD) steer = maxSteerVal;

        let accel = 0;
        if (this.keys.KeyW) accel = -maxForce / 2; // Accelerate
        if (this.keys.KeyS) accel = maxForce; // Brake

        let brake = 0;
        if (this.keys.Space) brake = brakeForce;

        // Apply to front wheels (0,1)
        this.vehicle.setSteeringValue(steer, 0);
        this.vehicle.setSteeringValue(steer, 1);

        // Engine force to rear wheels (2,3)
        this.vehicle.setBrake(brake, 0);
        this.vehicle.setBrake(brake, 1);
        this.vehicle.setBrake(brake, 2);
        this.vehicle.setBrake(brake, 3);

        this.vehicle.applyEngineForce(accel, 2);
        this.vehicle.applyEngineForce(accel, 3);

        // Reset
        if (this.keys.KeyR) {
            this.carChassis.position.set(0, 2, 0);
            this.carChassis.velocity.set(0, 0, 0);
            this.carChassis.angularVelocity.set(0, 0, 0);
            this.carChassis.quaternion.set(0, 0, 0, 1);
            this.carHealth = 100;
            this.fuel = 100;
        }

        // Update meshes
        this.carMesh.position.copy(this.carChassis.position);
        this.carMesh.quaternion.copy(this.carChassis.quaternion);

        for (let i = 0; i < this.vehicle.numWheels; i++) {
            this.vehicle.updateWheelTransform(i);
            const t = this.vehicle.wheelInfos[i].worldTransform;
            this.wheelMeshes[i].position.copy(t.position);
            this.wheelMeshes[i].quaternion.copy(t.quaternion);
        }

        // Speed and RPM
        const speed = this.carChassis.velocity.length() * 3.6;
        const rpm = Math.max(800, speed * 60); // Simulate RPM based on speed (increased multiplier)
        this.speedDisplay.textContent = `Speed: ${speed.toFixed(1)} km/h`;
        this.rpmDisplay.textContent = `RPM: ${rpm.toFixed(0)}`;

        // Gear
        let gear = 'N';
        if (this.keys.KeyW) gear = 'D';
        else if (this.keys.KeyS) gear = 'R';
        this.gearDisplay.textContent = `Gear: ${gear}`;

        // Fuel consumption
        if (this.keys.KeyW || this.keys.KeyS) {
            this.fuel = Math.max(0, this.fuel - 0.02);
            this.fuelDisplay.textContent = `Fuel: ${this.fuel.toFixed(1)}%`;
        }

        // Health system - damage from collisions
        const velocity = this.carChassis.velocity.length();
        if (velocity > 50) { // High speed damage
            this.carHealth = Math.max(0, this.carHealth - 0.01);
        }

        // Update audio
        this.updateEngineSound(speed);

        // Update traffic
        this.updateTraffic();

        // Update game time and score
        this.gameTime += 1/60;
        if (this.gameTime % 5 < 1/60) { // Every 5 seconds
            this.score += Math.floor(speed);
            this.scoreDisplay.textContent = `Score: ${this.score}`;
        }

        // Update health display
        this.healthDisplay.textContent = `Health: ${this.carHealth.toFixed(1)}%`;
    }

    updateCamera() {
        const idealOffset = new THREE.Vector3(0, 5, -10);
        const idealLookAt = new THREE.Vector3(0, 0, 5);

        idealOffset.applyQuaternion(this.carMesh.quaternion);
        idealLookAt.applyQuaternion(this.carMesh.quaternion);

        idealOffset.add(this.carMesh.position);
        idealLookAt.add(this.carMesh.position);

        this.cameraRig.position.lerp(idealOffset, 0.1);
        this.camera.lookAt(idealLookAt);
    }

    updateEngineSound(speed) {
        if (!this.engineSound || !this.audioContext) return;

        const { oscillator, gainNode } = this.engineSound;
        const normalizedSpeed = Math.min(speed / 100, 1); // Normalize speed
        const frequency = 80 + normalizedSpeed * 200; // 80-280 Hz range
        const volume = normalizedSpeed * 0.1; // Volume based on speed

        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    }

    updateTraffic() {
        this.trafficVehicles.forEach(vehicle => {
            // Move traffic vehicles in their direction
            const moveX = Math.cos(vehicle.direction) * vehicle.speed * 0.016; // 60fps
            const moveZ = Math.sin(vehicle.direction) * vehicle.speed * 0.016;

            vehicle.mesh.position.x += moveX;
            vehicle.mesh.position.z += moveZ;

            // Rotate wheels slightly for effect
            vehicle.mesh.children.forEach((child, index) => {
                if (index >= 1 && index <= 4) { // Wheels
                    child.rotation.x += vehicle.speed * 0.1;
                }
            });

            // Wrap around world boundaries
            if (Math.abs(vehicle.mesh.position.x) > 500) {
                vehicle.mesh.position.x = -Math.sign(vehicle.mesh.position.x) * 500;
            }
            if (Math.abs(vehicle.mesh.position.z) > 500) {
                vehicle.mesh.position.z = -Math.sign(vehicle.mesh.position.z) * 500;
            }

            // Simple collision detection with player car
            const distance = this.carChassis.position.distanceTo(vehicle.mesh.position);
            if (distance < 5) {
                this.carHealth = Math.max(0, this.carHealth - 0.5);
                // Push cars apart
                const pushDirection = new THREE.Vector3()
                    .subVectors(vehicle.mesh.position, this.carChassis.position)
                    .normalize();
                vehicle.mesh.position.add(pushDirection.multiplyScalar(2));
            }
        });
    }

    updateDebugInfo() {
        if (!this.showDebug) return;

        const debugInfo = document.getElementById('debug-info');
        if (!debugInfo) return;

        const speed = this.carChassis.velocity.length() * 3.6;
        const pos = this.carChassis.position;

        debugInfo.innerHTML = `
            Position: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})<br>
            Speed: ${speed.toFixed(1)} km/h<br>
            Health: ${this.carHealth.toFixed(1)}%<br>
            Fuel: ${this.fuel.toFixed(1)}%<br>
            Score: ${this.score}<br>
            Time: ${this.gameTime.toFixed(1)}s<br>
            Traffic: ${this.trafficVehicles.length}<br>
            FPS: ${Math.round(1 / (1/60))}
        `;
    }

    updateMinimap() {
        const ctx = this.minimapCtx;
        const canvas = this.minimapCanvas;
        const scale = 0.5; // pixels per unit
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // Clear
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw grid
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        for (let i = -10; i <= 10; i++) {
            const x = centerX + i * 50 * scale;
            const y = centerY + i * 50 * scale;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        // Draw traffic vehicles
        ctx.fillStyle = '#ffff00';
        this.trafficVehicles.forEach(vehicle => {
            const trafficX = centerX + vehicle.mesh.position.x * scale;
            const trafficZ = centerY + vehicle.mesh.position.z * scale;
            ctx.beginPath();
            ctx.arc(trafficX, trafficZ, 2, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw car
        const carX = centerX + this.carChassis.position.x * scale;
        const carZ = centerY + this.carChassis.position.z * scale;
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(carX, carZ, 3, 0, Math.PI * 2);
        ctx.fill();

        // Direction indicator
        const dir = this.carMesh.getWorldDirection(new THREE.Vector3());
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(carX, carZ);
        ctx.lineTo(carX + dir.x * 10, carZ + dir.z * 10);
        ctx.stroke();
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (!this.isPaused) {
            this.world.step(1 / 60);
            this.updateCar();
        }

        this.updateCamera();
        this.updateMinimap();
        this.updateDebugInfo();

        this.renderer.render(this.scene, this.camera);
    }
}

try {
    new CarSimulator();
    console.log('Car simulator initialized successfully');
} catch (error) {
    console.error('Error initializing car simulator:', error);
    document.getElementById('container').innerHTML = '<div style="color: white; padding: 20px;">Error loading simulator: ' + error.message + '</div>';
}
