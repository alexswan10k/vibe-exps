// Structured City Grid, Stunt Park, Airport Drag Strip, Props & Physics Bodies
class WorldGen {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;

        this.buildings = [];
        this.speedTraps = [];
        this.ramps = [];
        this.dynamicProps = []; // Interactive physics objects (traffic cones, crates)
        this.trafficNodes = []; // Navigational grid nodes for AI traffic

        this.initGround();
        this.initCityGrid();
        this.initStuntPark();
        this.initAirportRunway();
        this.initInteractiveProps();
    }

    initGround() {
        // Ground Plane (Physics & Visuals)
        const groundGeom = new THREE.PlaneGeometry(3000, 3000);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x2e3d23,
            roughness: 0.9,
            metalness: 0.05
        });
        const ground = new THREE.Mesh(groundGeom, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({ mass: 0 });
        groundBody.addShape(groundShape);
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        this.world.addBody(groundBody);
    }

    // Procedural Road Canvas Texture
    static createAsphaltTexture(isIntersection = false, isRunway = false) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Asphalt base
        ctx.fillStyle = isRunway ? '#1e1e24' : '#282828';
        ctx.fillRect(0, 0, 512, 512);

        // Asphalt noise grain
        for (let i = 0; i < 4000; i++) {
            const val = Math.floor(Math.random() * 40 + 30);
            ctx.fillStyle = `rgb(${val},${val},${val})`;
            ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
        }

        if (isRunway) {
            // White runway stripes & centerline
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 14;
            ctx.setLineDash([40, 30]);
            ctx.beginPath();
            ctx.moveTo(256, 0);
            ctx.lineTo(256, 512);
            ctx.stroke();

            // Runway side lines
            ctx.setLineDash([]);
            ctx.lineWidth = 10;
            ctx.strokeRect(20, 0, 472, 512);
        } else if (!isIntersection) {
            // Road double yellow center line
            ctx.strokeStyle = '#ffbb00';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(250, 0);
            ctx.lineTo(250, 512);
            ctx.moveTo(262, 0);
            ctx.lineTo(262, 512);
            ctx.stroke();

            // White dashed lane markers
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 4;
            ctx.setLineDash([30, 30]);
            ctx.beginPath();
            ctx.moveTo(128, 0);
            ctx.lineTo(128, 512);
            ctx.moveTo(384, 0);
            ctx.lineTo(384, 512);
            ctx.stroke();

            // Outer solid edge lines
            ctx.setLineDash([]);
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(24, 0);
            ctx.lineTo(24, 512);
            ctx.moveTo(488, 0);
            ctx.lineTo(488, 512);
            ctx.stroke();
        } else {
            // Intersection crosswalk zebra stripes
            ctx.fillStyle = '#ffffff';
            for (let x = 30; x < 480; x += 30) {
                ctx.fillRect(x, 15, 18, 50);
                ctx.fillRect(x, 447, 18, 50);
                ctx.fillRect(15, x, 50, 18);
                ctx.fillRect(447, x, 50, 18);
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }

    static createNeonSignTexture(text, colorHex = '#00f3ff') {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#08080c';
        ctx.fillRect(0, 0, 512, 128);

        // Neon Glow border
        ctx.strokeStyle = colorHex;
        ctx.lineWidth = 6;
        ctx.shadowColor = colorHex;
        ctx.shadowBlur = 15;
        ctx.strokeRect(10, 10, 492, 108);

        // Neon Text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 38px "Arial Black", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = colorHex;
        ctx.shadowBlur = 20;
        ctx.fillText(text, 256, 64);

        return new THREE.CanvasTexture(canvas);
    }

    initCityGrid() {
        const roadMat = new THREE.MeshStandardMaterial({
            map: WorldGen.createAsphaltTexture(false),
            roughness: 0.85
        });
        const intersectMat = new THREE.MeshStandardMaterial({
            map: WorldGen.createAsphaltTexture(true),
            roughness: 0.85
        });
        const sidewalkMat = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.9
        });

        const neonTitles = [
            'TURBO DRIFT', 'CYBER DINER', 'SYNTH CAFE', 'HYPER MOTORS',
            'NEON ARCADE', 'APEX OIL', 'RETRO LOUNGE', 'VAPOR NIGHTS'
        ];
        const neonColors = ['#00f3ff', '#ff0055', '#ffe600', '#00ff66', '#b000ff'];

        // 6x6 City Blocks Grid
        const blockSize = 80;
        const roadWidth = 24;
        const totalSpacing = blockSize + roadWidth;
        const gridOffset = -totalSpacing * 2.5;

        // Roads Grid & AI Traffic Nodes
        for (let ix = 0; ix < 6; ix++) {
            for (let iz = 0; iz < 6; iz++) {
                const rx = gridOffset + ix * totalSpacing;
                const rz = gridOffset + iz * totalSpacing;

                // Intersection tile
                const interMesh = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, roadWidth), intersectMat);
                interMesh.rotation.x = -Math.PI / 2;
                interMesh.position.set(rx, 0.02, rz);
                interMesh.receiveShadow = true;
                this.scene.add(interMesh);

                // Add Traffic Nav Node at intersection
                this.trafficNodes.push({
                    x: rx,
                    z: rz,
                    type: 'crossroad',
                    connected: []
                });

                // Horizontal Road segment (East-West)
                if (ix < 5) {
                    const roadX = new THREE.Mesh(new THREE.PlaneGeometry(blockSize, roadWidth), roadMat);
                    roadX.rotation.x = -Math.PI / 2;
                    roadX.position.set(rx + totalSpacing / 2, 0.015, rz);
                    roadX.receiveShadow = true;
                    this.scene.add(roadX);
                }

                // Vertical Road segment (North-South)
                if (iz < 5) {
                    const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, blockSize), roadMat);
                    roadZ.rotation.x = -Math.PI / 2;
                    roadZ.rotation.z = Math.PI / 2;
                    roadZ.position.set(rx, 0.015, rz + totalSpacing / 2);
                    roadZ.receiveShadow = true;
                    this.scene.add(roadZ);
                }
            }
        }

        // Link AI Traffic Nodes
        for (let i = 0; i < this.trafficNodes.length; i++) {
            const nodeA = this.trafficNodes[i];
            for (let j = 0; j < this.trafficNodes.length; j++) {
                if (i === j) continue;
                const nodeB = this.trafficNodes[j];
                const dx = Math.abs(nodeA.x - nodeB.x);
                const dz = Math.abs(nodeA.z - nodeB.z);
                if ((dx < totalSpacing + 5 && dz < 5) || (dz < totalSpacing + 5 && dx < 5)) {
                    nodeA.connected.push(nodeB);
                }
            }
        }

        // Buildings & Sidewalk Blocks
        const buildingColors = [0x222633, 0x2a3042, 0x1f232b, 0x3b4252, 0x434c5e];

        for (let bx = 0; bx < 5; bx++) {
            for (let bz = 0; bz < 5; bz++) {
                const centerX = gridOffset + totalSpacing / 2 + bx * totalSpacing;
                const centerZ = gridOffset + totalSpacing / 2 + bz * totalSpacing;

                // Sidewalk Base Block
                const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(blockSize - 2, 0.35, blockSize - 2), sidewalkMat);
                sidewalk.position.set(centerX, 0.175, centerZ);
                sidewalk.receiveShadow = true;
                this.scene.add(sidewalk);

                // Multiple building lots per block
                const numBuildings = Math.random() > 0.4 ? 4 : 2;

                if (numBuildings === 4) {
                    const subSize = (blockSize - 14) / 2;
                    const offsets = [
                        { x: -subSize / 2 - 2, z: -subSize / 2 - 2 },
                        { x: subSize / 2 + 2, z: -subSize / 2 - 2 },
                        { x: -subSize / 2 - 2, z: subSize / 2 + 2 },
                        { x: subSize / 2 + 2, z: subSize / 2 + 2 }
                    ];

                    offsets.forEach(off => {
                        const height = Math.random() * 50 + 15;
                        const bColor = buildingColors[Math.floor(Math.random() * buildingColors.length)];
                        this.createBuilding(centerX + off.x, centerZ + off.z, subSize, height, subSize, bColor, neonTitles, neonColors);
                    });
                } else {
                    const height = Math.random() * 80 + 35; // Tower skyscraper
                    const bColor = buildingColors[Math.floor(Math.random() * buildingColors.length)];
                    this.createBuilding(centerX, centerZ, blockSize - 16, height, blockSize - 16, bColor, neonTitles, neonColors);
                }

                // Street lamps on block corners
                this.createStreetLamp(centerX - blockSize / 2 + 4, centerZ - blockSize / 2 + 4);
                this.createStreetLamp(centerX + blockSize / 2 - 4, centerZ + blockSize / 2 - 4);
            }
        }
    }

    createBuilding(x, z, width, height, depth, colorHex, titles, neonColors) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        const bMat = new THREE.MeshStandardMaterial({
            color: colorHex,
            roughness: 0.4,
            metalness: 0.3
        });

        const bMesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bMat);
        bMesh.position.y = height / 2;
        bMesh.castShadow = true;
        bMesh.receiveShadow = true;
        group.add(bMesh);

        // Windows facade (glow grids)
        const winMat = new THREE.MeshBasicMaterial({ color: Math.random() > 0.3 ? 0xfff0aa : 0x00e5ff });
        const numFloors = Math.floor(height / 4);
        for (let f = 1; f < numFloors; f++) {
            if (Math.random() > 0.25) {
                const winBand = new THREE.Mesh(new THREE.BoxGeometry(width + 0.1, 1.2, depth + 0.1), winMat);
                winBand.position.y = f * 4;
                group.add(winBand);
            }
        }

        // Storefront Neon Sign
        if (Math.random() > 0.35 && height > 20) {
            const title = titles[Math.floor(Math.random() * titles.length)];
            const nColor = neonColors[Math.floor(Math.random() * neonColors.length)];
            const signTex = WorldGen.createNeonSignTexture(title, nColor);

            const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true });
            const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), signMat);
            sign.position.set(0, 7, depth / 2 + 0.15);
            group.add(sign);
        }

        this.scene.add(group);

        // Physics Body
        const bShape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
        const bBody = new CANNON.Body({ mass: 0 });
        bBody.addShape(bShape);
        bBody.position.set(x, height / 2, z);
        this.world.addBody(bBody);

        this.buildings.push({ mesh: group, body: bBody });
    }

    createStreetLamp(x, z) {
        const lampGroup = new THREE.Group();
        lampGroup.position.set(x, 0, z);

        const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 });
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 8, 8), poleMat);
        pole.position.y = 4;
        lampGroup.add(pole);

        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.1), poleMat);
        arm.position.set(0.8, 8, 0);
        lampGroup.add(arm);

        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffbb }));
        bulb.position.set(1.5, 7.8, 0);
        lampGroup.add(bulb);

        this.scene.add(lampGroup);
    }

    initAirportRunway() {
        // Long Drag Strip Runway (1200m long x 40m wide)
        const runwayMat = new THREE.MeshStandardMaterial({
            map: WorldGen.createAsphaltTexture(false, true),
            roughness: 0.75
        });

        const runwayMesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 1200), runwayMat);
        runwayMesh.rotation.x = -Math.PI / 2;
        runwayMesh.position.set(450, 0.02, 0);
        runwayMesh.receiveShadow = true;
        this.scene.add(runwayMesh);

        // Speed Trap Camera Tower halfway along runway
        this.createSpeedTrap(450, 0, 'RUNWAY HIGH SPEED TRAP');
        this.createSpeedTrap(0, -320, 'CITY CENTER SPEED TRAP');
    }

    createSpeedTrap(x, z, label) {
        const trapGroup = new THREE.Group();
        trapGroup.position.set(x, 0, z);

        // Radar Pole & Camera
        const poleMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.7 });
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 7, 8), poleMat);
        pole.position.y = 3.5;
        trapGroup.add(pole);

        const camBox = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 1.2), new THREE.MeshStandardMaterial({ color: 0x222222 }));
        camBox.position.set(0, 6.8, 0);
        trapGroup.add(camBox);

        const flashBulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        flashBulb.position.set(0, 6.8, 0.65);
        trapGroup.add(flashBulb);

        this.scene.add(trapGroup);

        this.speedTraps.push({
            x,
            z,
            label,
            cooldown: 0,
            bulb: flashBulb
        });
    }

    initStuntPark() {
        // Stunt Park Zone (West of City: x = -420, z = 0)
        const stuntBase = new THREE.Mesh(
            new THREE.PlaneGeometry(350, 350),
            new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.8 })
        );
        stuntBase.rotation.x = -Math.PI / 2;
        stuntBase.position.set(-420, 0.02, 0);
        this.scene.add(stuntBase);

        // 1. Mega Launch Kicker Ramp
        this.createLaunchRamp(-420, -100, 20, 10, 30, Math.PI / 2);

        // 2. Giant Loop-The-Loop
        this.createStuntLoop(-420, 0, 18, 14);

        // 3. Stunt Halfpipe / Bowl
        this.createLaunchRamp(-420, 100, 25, 12, 35, -Math.PI / 2);

        // 4. Rooftop Jump Ramps
        this.createLaunchRamp(-280, -280, 16, 6, 20, 0);
    }

    createLaunchRamp(x, z, width, height, length, rotationY = 0) {
        const rampGroup = new THREE.Group();
        rampGroup.position.set(x, 0, z);
        rampGroup.rotation.y = rotationY;

        // Visual Wedge Ramp
        const rampGeom = new THREE.BoxGeometry(width, 0.5, length);
        const rampMat = new THREE.MeshStandardMaterial({ color: 0xff3d00, metalness: 0.4, roughness: 0.5 });
        const rampMesh = new THREE.Mesh(rampGeom, rampMat);
        rampMesh.position.set(0, height / 2, 0);
        rampMesh.rotation.x = Math.atan2(height, length);
        rampMesh.castShadow = true;
        rampMesh.receiveShadow = true;
        rampGroup.add(rampMesh);

        // Boost Pad Strip on ramp
        const boostMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
        const boostPad = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.7, length * 0.8), boostMat);
        boostPad.rotation.x = -Math.PI / 2 + Math.atan2(height, length);
        boostPad.position.set(0, height / 2 + 0.3, 0);
        rampGroup.add(boostPad);

        this.scene.add(rampGroup);

        // Physics Inclined Body
        const rampShape = new CANNON.Box(new CANNON.Vec3(width / 2, 0.25, length / 2));
        const rampBody = new CANNON.Body({ mass: 0 });
        rampBody.addShape(rampShape);
        rampBody.position.set(x, height / 2, z);

        const quat = new CANNON.Quaternion();
        quat.setFromEuler(Math.atan2(height, length), rotationY, 0, 'YXZ');
        rampBody.quaternion.copy(quat);

        this.world.addBody(rampBody);
    }

    createStuntLoop(x, z, radius, width) {
        const loopGroup = new THREE.Group();
        loopGroup.position.set(x, radius, z);

        const ringGeom = new THREE.TorusGeometry(radius, width / 2, 16, 40, Math.PI * 1.8);
        const ringMat = new THREE.MeshStandardMaterial({
            color: 0x00e5ff,
            metalness: 0.7,
            roughness: 0.3,
            wireframe: false
        });
        const loopMesh = new THREE.Mesh(ringGeom, ringMat);
        loopMesh.rotation.y = Math.PI / 2;
        loopGroup.add(loopMesh);

        this.scene.add(loopGroup);
    }

    initInteractiveProps() {
        // Traffic Cones & Breakable Crates scattered around stunt arena and corners
        const coneGeom = new THREE.ConeGeometry(0.3, 0.8, 8);
        const coneMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.5 });
        const crateGeom = new THREE.BoxGeometry(1.2, 1.2, 1.2);
        const crateMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 });

        // Spawn Cones
        for (let i = 0; i < 30; i++) {
            const cx = -420 + (Math.random() - 0.5) * 180;
            const cz = (Math.random() - 0.5) * 180;

            const coneMesh = new THREE.Mesh(coneGeom, coneMat);
            coneMesh.position.set(cx, 0.4, cz);
            coneMesh.castShadow = true;
            this.scene.add(coneMesh);

            const coneBody = new CANNON.Body({ mass: 5 });
            coneBody.addShape(new CANNON.Box(new CANNON.Vec3(0.2, 0.4, 0.2)));
            coneBody.position.set(cx, 0.4, cz);
            this.world.addBody(coneBody);

            this.dynamicProps.push({ mesh: coneMesh, body: coneBody });
        }

        // Spawn Wooden Crates
        for (let i = 0; i < 20; i++) {
            const bx = -420 + (Math.random() - 0.5) * 160;
            const bz = (Math.random() - 0.5) * 160;

            const crateMesh = new THREE.Mesh(crateGeom, crateMat);
            crateMesh.position.set(bx, 0.6, bz);
            crateMesh.castShadow = true;
            this.scene.add(crateMesh);

            const crateBody = new CANNON.Body({ mass: 15 });
            crateBody.addShape(new CANNON.Box(new CANNON.Vec3(0.6, 0.6, 0.6)));
            crateBody.position.set(bx, 0.6, bz);
            this.world.addBody(crateBody);

            this.dynamicProps.push({ mesh: crateMesh, body: crateBody });
        }
    }

    update(dt, playerPos, playerSpeed, onSpeedTrapTriggered) {
        // Sync dynamic props meshes with physics
        for (let i = 0; i < this.dynamicProps.length; i++) {
            const prop = this.dynamicProps[i];
            prop.mesh.position.copy(prop.body.position);
            prop.mesh.quaternion.copy(prop.body.quaternion);
        }

        // Speed Trap Trigger Check
        if (playerPos) {
            for (let i = 0; i < this.speedTraps.length; i++) {
                const trap = this.speedTraps[i];
                trap.cooldown = Math.max(0, trap.cooldown - dt);

                const dist = Math.hypot(playerPos.x - trap.x, playerPos.z - trap.z);
                if (dist < 18 && playerSpeed > 60 && trap.cooldown <= 0) {
                    trap.cooldown = 4.0; // Cooldown 4s
                    trap.bulb.material.color.setHex(0x00ffff);
                    setTimeout(() => trap.bulb.material.color.setHex(0xffffff), 300);

                    if (onSpeedTrapTriggered) {
                        onSpeedTrapTriggered(trap.label, Math.round(playerSpeed));
                    }
                }
            }
        }
    }
}
