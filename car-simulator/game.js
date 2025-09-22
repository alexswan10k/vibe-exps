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

        this.init();
        this.createGround();
        this.createCar();
        this.createProceduralTown();
        this.setupControls();
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
        const chassisShape = new CANNON.Box(new CANNON.Vec3(2, 0.5, 1));
        this.carChassis = new CANNON.Body({ mass: 800 });
        this.carChassis.addShape(chassisShape);
        this.carChassis.position.set(0, 2, 0);
        this.world.addBody(this.carChassis);

        // Car mesh
        const carGeometry = new THREE.BoxGeometry(4, 1, 2);
        const carMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        this.carMesh = new THREE.Mesh(carGeometry, carMaterial);
        this.carMesh.castShadow = true;
        this.scene.add(this.carMesh);

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

        // Wheel meshes
        this.wheelMeshes = [];
        const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 32);
        wheelGeometry.rotateZ(Math.PI / 2);
        const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });

        for (let i = 0; i < 4; i++) {
            const wheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheelMesh.castShadow = true;
            this.scene.add(wheelMesh);
            this.wheelMeshes.push(wheelMesh);
        }
    }

    createProceduralTown() {
        // Buildings
        for (let i = 0; i < 50; i++) {
            const x = (Math.random() - 0.5) * 800;
            const z = (Math.random() - 0.5) * 800;
            const height = Math.random() * 20 + 5;
            const width = Math.random() * 10 + 5;
            const depth = Math.random() * 10 + 5;

            const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
            const buildingMaterial = new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff });
            const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
            building.position.set(x, height / 2, z);
            building.castShadow = true;
            building.receiveShadow = true;
            this.scene.add(building);

            const buildingShape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, depth/2));
            const buildingBody = new CANNON.Body({ mass: 0 });
            buildingBody.addShape(buildingShape);
            buildingBody.position.set(x, height / 2, z);
            this.world.addBody(buildingBody);
        }

        // Roads
        const roadMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
        for (let i = -10; i <= 10; i++) {
            const roadHGeometry = new THREE.PlaneGeometry(1000, 20);
            const roadH = new THREE.Mesh(roadHGeometry, roadMaterial);
            roadH.rotation.x = -Math.PI / 2;
            roadH.position.set(0, 0.01, i * 50);
            this.scene.add(roadH);

            const roadVGeometry = new THREE.PlaneGeometry(20, 1000);
            const roadV = new THREE.Mesh(roadVGeometry, roadMaterial);
            roadV.rotation.x = -Math.PI / 2;
            roadV.position.set(i * 50, 0.01, 0);
            this.scene.add(roadV);
        }
    }

    setupControls() {
        document.addEventListener('keydown', (event) => this.keys[event.code] = true);
        document.addEventListener('keyup', (event) => this.keys[event.code] = false);
    }

    updateCar() {
        const maxSteerVal = Math.PI / 8;
        const maxForce = 1000;
        const brakeForce = 20;

        let steer = 0;
        if (this.keys.KeyA) steer = -maxSteerVal;
        if (this.keys.KeyD) steer = maxSteerVal;

        let accel = 0;
        if (this.keys.KeyW) accel = -maxForce / 2;
        if (this.keys.KeyS) accel = maxForce;

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

        // Speed
        const speed = this.carChassis.velocity.length() * 3.6;
        this.speedDisplay.textContent = `Speed: ${speed.toFixed(1)} km/h`;
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

    animate() {
        requestAnimationFrame(() => this.animate());

        this.world.step(1 / 60);

        this.updateCar();

        this.updateCamera();

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
