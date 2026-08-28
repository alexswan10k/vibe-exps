// Smart AI Traffic System following Grid Navigation & Anti-Jam Protocols
class TrafficManager {
    constructor(scene, world, trafficNodes, audioSystem, effectsManager) {
        this.scene = scene;
        this.world = world;
        this.nodes = trafficNodes;
        this.audio = audioSystem;
        this.effects = effectsManager;

        this.vehicles = [];
        this.maxTraffic = 18;

        this.initTraffic();
    }

    initTraffic() {
        if (!this.nodes || this.nodes.length < 2) return;

        const trafficColors = [
            0x3366cc, 0xdc3912, 0xff9900, 0x109618, 0x990099,
            0x3b3eac, 0x0099c6, 0xdd4477, 0x66aa00, 0xb82e2e
        ];

        for (let i = 0; i < this.maxTraffic; i++) {
            // Pick starting node and target node
            const startNodeIdx = Math.floor(Math.random() * this.nodes.length);
            const startNode = this.nodes[startNodeIdx];
            if (!startNode.connected || startNode.connected.length === 0) continue;

            const targetNode = startNode.connected[Math.floor(Math.random() * startNode.connected.length)];
            const color = trafficColors[i % trafficColors.length];
            const isTaxi = i === 1 || i === 7;

            // Visual mesh
            const carGroup = this.createAIVehicleMesh(color, isTaxi);
            carGroup.position.set(startNode.x, 0.4, startNode.z);
            this.scene.add(carGroup);

            this.vehicles.push({
                mesh: carGroup,
                currentNode: startNode,
                targetNode: targetNode,
                speed: 12 + Math.random() * 8, // target cruising speed
                currentSpeed: 12,
                heading: Math.atan2(targetNode.z - startNode.z, targetNode.x - startNode.x),
                stuckTimer: 0,
                lastPos: new THREE.Vector3(startNode.x, 0.4, startNode.z),
                laneOffset: 4.5 // Right hand drive lane offset
            });
        }
    }

    createAIVehicleMesh(colorHex, isTaxi = false) {
        const group = new THREE.Group();

        const bodyMat = new THREE.MeshStandardMaterial({
            color: isTaxi ? 0xffcc00 : colorHex,
            roughness: 0.3,
            metalness: 0.5
        });
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x111115, roughness: 0.1, metalness: 0.9 });
        const blackMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 });

        // Lower body
        const lower = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.6, 1.8), bodyMat);
        lower.position.y = 0.35;
        lower.castShadow = true;
        group.add(lower);

        // Cabin
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 1.5), glassMat);
        cabin.position.set(-0.2, 0.85, 0);
        cabin.castShadow = true;
        group.add(cabin);

        // Taxi roof sign
        if (isTaxi) {
            const sign = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
            sign.position.set(-0.2, 1.2, 0);
            group.add(sign);
        }

        // Headlights
        const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffee });
        const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.35), hlMat);
        hlL.position.set(1.9, 0.4, 0.6);
        const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.35), hlMat);
        hlR.position.set(1.9, 0.4, -0.6);
        group.add(hlL);
        group.add(hlR);

        // Taillights
        const tlMat = new THREE.MeshBasicMaterial({ color: 0xff1111 });
        const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.35), tlMat);
        tlL.position.set(-1.9, 0.4, 0.6);
        const tlR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.35), tlMat);
        tlR.position.set(-1.9, 0.4, -0.6);
        group.add(tlL);
        group.add(tlR);

        // 4 Wheels
        const wheelGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12);
        wheelGeom.rotateZ(Math.PI / 2);
        const wheelPositions = [
            { x: 1.2, z: 0.85 },
            { x: 1.2, z: -0.85 },
            { x: -1.2, z: 0.85 },
            { x: -1.2, z: -0.85 }
        ];

        wheelPositions.forEach(p => {
            const wheel = new THREE.Mesh(wheelGeom, blackMat);
            wheel.position.set(p.x, 0.35, p.z);
            wheel.castShadow = true;
            group.add(wheel);
        });

        return group;
    }

    update(dt, playerChassisBody, onPlayerCollision) {
        if (!this.vehicles.length) return;

        const playerPos = playerChassisBody ? playerChassisBody.position : null;

        for (let i = 0; i < this.vehicles.length; i++) {
            const v = this.vehicles[i];

            // 1. Navigation towards target node with right-side lane offset
            const targetX = v.targetNode.x;
            const targetZ = v.targetNode.z;

            // Lane vector
            const dx = targetX - v.mesh.position.x;
            const dz = targetZ - v.mesh.position.z;
            const distToTarget = Math.hypot(dx, dz);

            // Target Heading
            const targetAngle = Math.atan2(dz, dx);
            let angleDiff = targetAngle - v.heading;

            // Normalize angle diff between -PI and PI
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            // Smooth steering rotation
            v.heading += angleDiff * Math.min(1.0, dt * 5);
            v.mesh.rotation.y = -v.heading;

            // 2. Obstacle Detection (Player Car & Other AI Vehicles)
            let obstacleAhead = false;

            // Check distance to player
            if (playerPos) {
                const distPlayer = Math.hypot(playerPos.x - v.mesh.position.x, playerPos.z - v.mesh.position.z);
                if (distPlayer < 14) {
                    // Check if player is in front
                    const toPlayerX = playerPos.x - v.mesh.position.x;
                    const toPlayerZ = playerPos.z - v.mesh.position.z;
                    const dot = Math.cos(v.heading) * toPlayerX + Math.sin(v.heading) * toPlayerZ;
                    if (dot > 0 && distPlayer < 10) {
                        obstacleAhead = true;
                    }
                }
            }

            // Check distance to other AI cars
            for (let j = 0; j < this.vehicles.length; j++) {
                if (i === j) continue;
                const other = this.vehicles[j];
                const distOther = Math.hypot(other.mesh.position.x - v.mesh.position.x, other.mesh.position.z - v.mesh.position.z);
                if (distOther < 9) {
                    const toOtherX = other.mesh.position.x - v.mesh.position.x;
                    const toOtherZ = other.mesh.position.z - v.mesh.position.z;
                    const dot = Math.cos(v.heading) * toOtherX + Math.sin(v.heading) * toOtherZ;
                    if (dot > 0) {
                        obstacleAhead = true;
                        break;
                    }
                }
            }

            // Smooth acceleration or braking
            const targetSpeed = obstacleAhead ? 0 : v.speed;
            v.currentSpeed = THREE.MathUtils.lerp(v.currentSpeed, targetSpeed, dt * (obstacleAhead ? 6 : 2));

            // Move vehicle forward
            v.mesh.position.x += Math.cos(v.heading) * v.currentSpeed * dt;
            v.mesh.position.z += Math.sin(v.heading) * v.currentSpeed * dt;

            // Rotate wheels
            v.mesh.children.forEach(child => {
                if (child.geometry && child.geometry.type === 'CylinderGeometry') {
                    child.rotation.x += v.currentSpeed * dt * 2.5;
                }
            });

            // 3. Node Arrival & Intersection Routing (Avoid 180 u-turns)
            if (distToTarget < 12) {
                const nextOptions = v.targetNode.connected.filter(n => n !== v.currentNode);
                if (nextOptions.length > 0) {
                    v.currentNode = v.targetNode;
                    v.targetNode = nextOptions[Math.floor(Math.random() * nextOptions.length)];
                } else if (v.targetNode.connected.length > 0) {
                    v.currentNode = v.targetNode;
                    v.targetNode = v.targetNode.connected[0];
                }
            }

            // 4. Anti-Jam / Unstick Logic (Skill requirement)
            const movedDist = v.mesh.position.distanceTo(v.lastPos);
            if (movedDist < 0.2 && !obstacleAhead) {
                v.stuckTimer += dt;
                if (v.stuckTimer > 4.0) {
                    // Jammed: pick new target or teleport forward
                    v.stuckTimer = 0;
                    if (v.targetNode.connected.length > 0) {
                        v.targetNode = v.targetNode.connected[Math.floor(Math.random() * v.targetNode.connected.length)];
                    }
                }
            } else {
                v.stuckTimer = 0;
            }
            v.lastPos.copy(v.mesh.position);

            // 5. Physics Collision with Player Vehicle
            if (playerPos) {
                const pDist = Math.hypot(playerPos.x - v.mesh.position.x, playerPos.z - v.mesh.position.z);
                if (pDist < 3.8) {
                    // Collision impact!
                    const pushDir = new THREE.Vector3(
                        v.mesh.position.x - playerPos.x,
                        0.2,
                        v.mesh.position.z - playerPos.z
                    ).normalize();

                    // Push AI vehicle
                    v.mesh.position.addScaledVector(pushDir, 2.5);
                    v.currentSpeed *= 0.2;

                    // Push player chassis with recoil impulse
                    const recoil = new CANNON.Vec3(-pushDir.x * 3000, 500, -pushDir.z * 3000);
                    playerChassisBody.applyImpulse(recoil, playerChassisBody.position);

                    const collisionImpact = playerChassisBody.velocity.length() * 0.15;
                    if (this.audio) this.audio.playCrash(collisionImpact);
                    if (this.effects) this.effects.spawnCrashSparks(v.mesh.position.clone(), pushDir);

                    if (onPlayerCollision) {
                        onPlayerCollision(collisionImpact);
                    }
                }
            }
        }
    }
}
