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
        this.particleSystem = null; // New particle system
        this.audioContext = null;
        this.engineSound = null;
        this.driftSound = null; // Sound for drifting

        this.carHealth = 100;
        this.fuel = 100;
        this.score = 0;
        this.gameTime = 0;
        this.isPaused = false;
        this.showDebug = false;

        // Transmission properties
        this.currentGear = 1;
        this.gearRatios = [0, 3.5, 2.2, 1.5, 1.1, 0.9, 0.7]; // 1st to 6th gear ratios
        this.maxRPM = 7000;
        this.shiftRPM = 6500;
        this.isShifting = false;
        this.shiftTime = 0;

        this.init();
        this.createGround();
        this.createCar();
        this.createProceduralTown();
        this.createTraffic();
        this.createParticleSystem(); // Initialize particles
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

        // Lighting - IMPROVED
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        hemiLight.position.set(0, 200, 0);
        this.scene.add(hemiLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 200, 100);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 4096; // Higher resolution shadows
        directionalLight.shadow.mapSize.height = 4096;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        directionalLight.shadow.bias = -0.0005; // Fix shadow acne
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
        // Car chassis (Physics)
        const chassisWidth = 1.0; // Half-extent
        const chassisHeight = 0.4;
        const chassisLength = 2.0;
        const chassisShape = new CANNON.Box(new CANNON.Vec3(chassisLength, chassisHeight, chassisWidth));
        this.carChassis = new CANNON.Body({ mass: 800 });
        this.carChassis.addShape(chassisShape);
        this.carChassis.position.set(0, 2, 0);
        this.world.addBody(this.carChassis);

        // Car body group (Visuals)
        this.carMesh = new THREE.Group();
        this.scene.add(this.carMesh);

        // Materials
        const bodyColor = 0xff0033; // Sports Red
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: bodyColor,
            roughness: 0.2,
            metalness: 0.6
        });
        const glassMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.0,
            metalness: 0.9,
            transparent: true,
            opacity: 0.8
        });
        const detailMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
        const lightMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffaa,
            emissive: 0xffffaa,
            emissiveIntensity: 2
        });
        const tailLightMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 2
        });

        // Main Chassis (Lower Body)
        const lowerBodyGeom = new THREE.BoxGeometry(4.4, 0.6, 2.0);
        const lowerBody = new THREE.Mesh(lowerBodyGeom, bodyMaterial);
        lowerBody.position.y = 0.3;
        lowerBody.castShadow = true;
        this.carMesh.add(lowerBody);

        // Cabin (Upper Body)
        const cabinGeom = new THREE.BoxGeometry(2.2, 0.6, 1.7);
        const cabin = new THREE.Mesh(cabinGeom, glassMaterial); // Dark glass look
        cabin.position.set(-0.3, 0.9, 0);
        cabin.castShadow = true;
        this.carMesh.add(cabin);

        // Roof (Body color on top of cabin)
        const roofGeom = new THREE.BoxGeometry(2.0, 0.1, 1.75);
        const roof = new THREE.Mesh(roofGeom, bodyMaterial);
        roof.position.set(-0.3, 1.25, 0);
        this.carMesh.add(roof);

        // Spoiler
        const spoilerGroup = new THREE.Group();
        spoilerGroup.position.set(-2.0, 0.9, 0);

        const spoilerWingGeom = new THREE.BoxGeometry(0.8, 0.1, 2.2);
        const spoilerWing = new THREE.Mesh(spoilerWingGeom, bodyMaterial);
        spoilerWing.position.y = 0.3;
        spoilerGroup.add(spoilerWing);

        const strutGeom = new THREE.BoxGeometry(0.2, 0.3, 0.1);
        const strutL = new THREE.Mesh(strutGeom, detailMaterial);
        strutL.position.set(0, 0.0, 0.6);
        const strutR = new THREE.Mesh(strutGeom, detailMaterial);
        strutR.position.set(0, 0.0, -0.6);
        spoilerGroup.add(strutL);
        spoilerGroup.add(strutR);

        this.carMesh.add(spoilerGroup);

        // Headlights
        const hlGeom = new THREE.BoxGeometry(0.1, 0.2, 0.4);
        const hlL = new THREE.Mesh(hlGeom, lightMaterial);
        hlL.position.set(2.2, 0.4, 0.7);
        this.carMesh.add(hlL);

        const hlR = new THREE.Mesh(hlGeom, lightMaterial);
        hlR.position.set(2.2, 0.4, -0.7);
        this.carMesh.add(hlR);

        // Taillights
        const tlGeom = new THREE.BoxGeometry(0.1, 0.2, 0.4);
        const tlL = new THREE.Mesh(tlGeom, tailLightMaterial);
        tlL.position.set(-2.2, 0.4, 0.7);
        this.carMesh.add(tlL);

        const tlR = new THREE.Mesh(tlGeom, tailLightMaterial);
        tlR.position.set(-2.2, 0.4, -0.7);
        this.carMesh.add(tlR);

        // Wheel wells (blackouts)
        const wellGeom = new THREE.CylinderGeometry(0.55, 0.55, 2.1, 16);
        wellGeom.rotateX(Math.PI / 2);
        const wellMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

        const wellF = new THREE.Mesh(wellGeom, wellMat);
        wellF.position.set(1.4, 0.1, 0);
        this.carMesh.add(wellF);

        const wellR = new THREE.Mesh(wellGeom, wellMat);
        wellR.position.set(-1.4, 0.1, 0);
        this.carMesh.add(wellR);


        // Wheels
        const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 24);
        wheelGeometry.rotateZ(Math.PI / 2);
        const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
        const rimMaterial = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.8, roughness: 0.2 });

        this.wheelMeshes = [];
        for (let i = 0; i < 4; i++) {
            const wheelGroup = new THREE.Group();
            const tire = new THREE.Mesh(wheelGeometry, wheelMaterial);
            const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.31, 16), rimMaterial);
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
            indexForwardAxis: 0, // X is Forward
            indexRightAxis: 2,   // Z is Right
            indexUpAxis: 1       // Y is Up
        });

        const wheelOptions = {
            radius: 0.4,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 30,
            suspensionRestLength: 0.3,
            frictionSlip: 2.0,
            dampingRelaxation: 2.3,
            dampingCompression: 4.4,
            maxSuspensionForce: 100000,
            rollInfluence: 0.01,
            axleLocal: new CANNON.Vec3(0, 0, 1), // Axle along Z
            chassisConnectionPointLocal: new CANNON.Vec3(0, 0, 0),
            maxSuspensionTravel: 0.3,
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true
        };

        // Front Left (+X, -Z)
        wheelOptions.chassisConnectionPointLocal.set(1.4, -0.2, -1.1);
        this.vehicle.addWheel(wheelOptions);

        // Front Right (+X, +Z)
        wheelOptions.chassisConnectionPointLocal.set(1.4, -0.2, 1.1);
        this.vehicle.addWheel(wheelOptions);

        // Rear Left (-X, -Z)
        wheelOptions.chassisConnectionPointLocal.set(-1.4, -0.2, -1.1);
        this.vehicle.addWheel(wheelOptions);

        // Rear Right (-X, +Z)
        wheelOptions.chassisConnectionPointLocal.set(-1.4, -0.2, 1.1);
        this.vehicle.addWheel(wheelOptions);

        this.vehicle.addToWorld(this.world);

        // Wheel bodies for particles
        this.vehicle.wheelInfos.forEach((wheel) => {
            wheel.sideFriction = 3;
        });
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
                            -width / 2 + (col + 0.5) * (width / windowCols),
                            row * 2 + 1,
                            depth / 2 + 0.05
                        );
                        buildingGroup.add(windowMesh);
                    }
                }
            }

            this.scene.add(buildingGroup);

            const buildingShape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
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

    createParticleSystem() {
        // Particle system using InstancedMesh for performance
        const particleCount = 2000;
        const geometry = new THREE.PlaneGeometry(0.5, 0.5);
        const material = new THREE.MeshBasicMaterial({
            color: 0xaaaaaa,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        this.particleSystem = {
            mesh: new THREE.InstancedMesh(geometry, material, particleCount),
            particles: [],
            dummy: new THREE.Object3D(),
            nextIndex: 0
        };

        this.particleSystem.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.scene.add(this.particleSystem.mesh);

        // Initialize all instances off-screen
        for (let i = 0; i < particleCount; i++) {
            this.particleSystem.dummy.position.set(0, -1000, 0);
            this.particleSystem.dummy.updateMatrix();
            this.particleSystem.mesh.setMatrixAt(i, this.particleSystem.dummy.matrix);
        }
        this.particleSystem.mesh.instanceMatrix.needsUpdate = true;
    }

    spawnParticle(position, velocity, life, size, color) {
        const index = this.particleSystem.nextIndex;
        this.particleSystem.nextIndex = (this.particleSystem.nextIndex + 1) % this.particleSystem.mesh.count;

        this.particleSystem.particles[index] = {
            position: position.clone(),
            velocity: velocity.clone(),
            life: life,
            maxLife: life,
            size: size,
            growth: 1.05, // Grow over time
            alpha: 1.0
            // Color not implemented in basic material instancing without custom shader, keeping simple grey
        };

        this.particleSystem.dummy.position.copy(position);
        this.particleSystem.dummy.scale.set(size, size, size);
        this.particleSystem.dummy.updateMatrix();
        this.particleSystem.mesh.setMatrixAt(index, this.particleSystem.dummy.matrix);
        this.particleSystem.mesh.instanceMatrix.needsUpdate = true;
    }

    updateParticles() {
        if (!this.particleSystem) return;

        const dummy = this.particleSystem.dummy;

        // Clean up dead particles or move living ones
        for (let i = 0; i < this.particleSystem.mesh.count; i++) {
            const p = this.particleSystem.particles[i];
            if (p && p.life > 0) {
                p.life -= 1 / 60;
                p.position.add(p.velocity);
                p.size *= p.growth;
                p.alpha = p.life / p.maxLife;

                // Look at camera for billboard effect
                dummy.position.copy(p.position);
                dummy.scale.set(p.size, p.size, p.size);
                dummy.lookAt(this.camera.position);
                dummy.updateMatrix();

                this.particleSystem.mesh.setMatrixAt(i, dummy.matrix);
            } else if (p && p.life <= 0) {
                // Move offscreen
                dummy.position.set(0, -1000, 0);
                dummy.updateMatrix();
                this.particleSystem.mesh.setMatrixAt(i, dummy.matrix);
                this.particleSystem.particles[i] = null; // Clear data
            }
        }
        this.particleSystem.mesh.instanceMatrix.needsUpdate = true;
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
        const maxForce = 5000;
        const brakeForce = 20;

        let steer = 0;
        if (this.keys.KeyA) steer = maxSteerVal; // Left
        if (this.keys.KeyD) steer = -maxSteerVal; // Right

        let accel = 0;
        if (this.keys.KeyW) accel = maxForce; // Accelerate Forward (+X)
        if (this.keys.KeyS) accel = -maxForce / 2; // Reverse (-X)

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

        const speed = this.carChassis.velocity.length() * 3.6;
        this.speedDisplay.textContent = `Speed: ${speed.toFixed(1)} km/h`;

        // Transmission logic
        let targetGear = 1;
        const speedKmh = Math.abs(speed);

        if (speedKmh < 40) targetGear = 1;
        else if (speedKmh < 80) targetGear = 2;
        else if (speedKmh < 120) targetGear = 3;
        else if (speedKmh < 160) targetGear = 4;
        else if (speedKmh < 210) targetGear = 5;
        else targetGear = 6;

        if (this.currentGear !== targetGear && !this.isShifting) {
            this.isShifting = true;
            this.shiftTime = 0.2;
            this.currentGear = targetGear;
        }

        if (this.isShifting) {
            this.shiftTime -= 1 / 60;
            if (this.shiftTime <= 0) this.isShifting = false;
        }

        // RPM simulation
        const gearSpeeds = [0, 50, 95, 140, 185, 230, 280];
        const minGearSpeed = gearSpeeds[this.currentGear - 1];
        const maxGearSpeed = gearSpeeds[this.currentGear];
        const idleRPM = 800;
        let rpm = idleRPM;

        if (speedKmh > 0) {
            const gearRange = maxGearSpeed - minGearSpeed;
            const gearProgress = (speedKmh - minGearSpeed) / gearRange;
            rpm = THREE.MathUtils.lerp(idleRPM + 1000, 7000, Math.max(0, gearProgress));
        }

        if (this.isShifting) rpm *= 0.5;

        this.rpm = Math.min(this.maxRPM, rpm);
        this.rpmDisplay.textContent = `RPM: ${this.rpm.toFixed(0)}`;
        this.gearDisplay.textContent = `Gear: ${this.currentGear}`;

        // Emit particles
        if (Math.abs(speed) > 10) {
            const exhaustPos = this.carMesh.position.clone().add(
                new THREE.Vector3(-2.2, 0.3, 0.5).applyQuaternion(this.carMesh.quaternion)
            );
            if (Math.random() > 0.8) {
                this.spawnParticle(
                    exhaustPos,
                    new THREE.Vector3(-0.5, 0.05, 0).applyQuaternion(this.carMesh.quaternion),
                    0.5 + Math.random() * 0.5,
                    0.2,
                    0x555555
                );
            }

            const lateralVel = this.carChassis.velocity.dot(
                new THREE.Vector3(0, 0, 1).applyQuaternion(this.carChassis.quaternion)
            );

            if (Math.abs(lateralVel) > 5) {
                for (let i = 2; i < 4; i++) {
                    const wheelPos = this.wheelMeshes[i].position.clone();
                    wheelPos.y = 0.1;
                    this.spawnParticle(
                        wheelPos,
                        new THREE.Vector3(0, 0.05, 0),
                        1.0 + Math.random(),
                        0.5,
                        0xffffff
                    );
                }
            }
        }

        if (this.keys.KeyW || this.keys.KeyS) {
            this.fuel = Math.max(0, this.fuel - 0.02);
            this.fuelDisplay.textContent = `Fuel: ${this.fuel.toFixed(1)}%`;
        }

        const velocity = this.carChassis.velocity.length();
        if (velocity > 50) {
            this.carHealth = Math.max(0, this.carHealth - 0.01);
        }

        this.updateEngineSound(speed);
        this.updateTraffic();

        this.gameTime += 1 / 60;
        if (this.gameTime % 5 < 1 / 60) {
            this.score += Math.floor(speed);
            this.scoreDisplay.textContent = `Score: ${this.score}`;
        }

        this.healthDisplay.textContent = `Health: ${this.carHealth.toFixed(1)}%`;
    }

    updateCamera() {
        // Camera follows -X (Behind) and Looks at +X (Forward)
        const idealOffset = new THREE.Vector3(-8, 4, 0);
        const idealLookAt = new THREE.Vector3(10, 0, 0);

        idealOffset.applyQuaternion(this.carMesh.quaternion);
        idealLookAt.applyQuaternion(this.carMesh.quaternion);

        idealOffset.add(this.carMesh.position);
        idealLookAt.add(this.carMesh.position);

        this.cameraRig.position.lerp(idealOffset, 0.1);
        this.camera.lookAt(idealLookAt);

        // Dynamic FOV
        const speed = this.carChassis.velocity.length();
        const targetFOV = 75 + (speed * 0.5); // Base FOV 75, increases with speed
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, Math.min(targetFOV, 110), 0.05);
        this.camera.updateProjectionMatrix();
    }

    updateEngineSound(speed) {
        if (!this.engineSound || !this.audioContext) return;

        const { oscillator, gainNode } = this.engineSound;

        // Use RPM for frequency calculation
        // Mapping 800-7000 RPM to 60-400 Hz
        const normalizedRPM = (this.rpm - 800) / (7000 - 800);
        const frequency = 60 + normalizedRPM * 340;

        // Volume based on input and RPM
        let volume = 0.05 + normalizedRPM * 0.15;
        if (!this.keys.KeyW && !this.keys.KeyS) volume *= 0.5; // Quieter at idle/coast
        if (this.isShifting) volume *= 0.2; // Significant dip during shift

        oscillator.frequency.setTargetAtTime(frequency, this.audioContext.currentTime, 0.05);
        gainNode.gain.setTargetAtTime(volume, this.audioContext.currentTime, 0.05);
    }

    updateTraffic() {
        this.trafficVehicles.forEach(vehicle => {
            // Move traffic vehicles in their direction
            const moveX = Math.cos(vehicle.direction) * vehicle.speed * 0.016; // 60fps
            const moveZ = Math.sin(vehicle.direction) * vehicle.speed * 0.016;

            vehicle.mesh.position.x += moveX;
            vehicle.mesh.position.z += moveZ;

            // Align mesh to direction (assuming mesh forward is +X)
            vehicle.mesh.rotation.y = -vehicle.direction;

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
            FPS: ${Math.round(1 / (1 / 60))}
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

        // Direction indicator (Forward is X)
        const dir = new THREE.Vector3(1, 0, 0).applyQuaternion(this.carMesh.quaternion);
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
            this.updateParticles(); // Update particle system using custom method

            // Camera Shake
            if (this.cameraRig) {
                const speed = this.carChassis.velocity.length();
                if (speed > 20) {
                    const shake = Math.min((speed - 20) * 0.002, 0.2); // Cap shake
                    this.cameraRig.position.add(new THREE.Vector3(
                        (Math.random() - 0.5) * shake,
                        (Math.random() - 0.5) * shake,
                        (Math.random() - 0.5) * shake
                    ));
                }
            }
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
