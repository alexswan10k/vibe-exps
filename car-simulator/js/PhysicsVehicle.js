// Realistic Vehicle Physics, Handling, Drifting, Gearing, Nitro & Stunts
class PhysicsVehicle {
    constructor(world, scene, audioSystem, effectsManager) {
        this.world = world;
        this.scene = scene;
        this.audio = audioSystem;
        this.effects = effectsManager;

        this.carTypeIndex = 0;
        this.chassisBody = null;
        this.vehicle = null;
        this.visualModel = null;
        this.wheelMeshes = [];

        // Dynamic State
        this.speedKmh = 0;
        this.speedMs = 0;
        this.rpm = 800;
        this.currentGear = 1;
        this.isShifting = false;
        this.shiftTimer = 0;
        this.nitro = 100; // 0 - 100%
        this.isNitroActive = false;
        this.carHealth = 100;
        this.fuel = 100;

        // Steering state
        this.currentSteering = 0;

        // Drift tracking
        this.isDrifting = false;
        this.driftScore = 0;
        this.driftCombo = 1;
        this.driftAngle = 0;
        this.slipAmount = 0;

        // Stunt / Air tracking
        this.inAir = false;
        this.airTime = 0;
        this.airStartPos = null;
        this.airStartRot = null;
        this.airTotalSpin = 0;

        // Realistic Specs per car class
        this.specs = [
            { // 0: Apex Supercar
                mass: 920,
                engineForce: 6400,
                maxSpeed: 285,
                steerAngleLow: 0.66,   // ~38 degrees at slow speed (sharp city turns)
                steerAngleHigh: 0.38,  // ~22 degrees at high speed
                frontFriction: 3.6,
                rearFriction: 3.2,
                suspensionStiffness: 48,
                suspensionRestLength: 0.30,
                dampingCompression: 4.6,
                dampingRelaxation: 2.8,
                antiRollForce: 4500,
                turnInAssist: 1.45,
                downforce: 2.5
            },
            { // 1: V8 Thunder Muscle
                mass: 1180,
                engineForce: 7600,
                maxSpeed: 245,
                steerAngleLow: 0.70,   // ~40 degrees
                steerAngleHigh: 0.36,  // ~21 degrees
                frontFriction: 3.4,
                rearFriction: 2.4,     // Lower rear grip for easy throttle power slides & drifts!
                suspensionStiffness: 36,
                suspensionRestLength: 0.34,
                dampingCompression: 4.0,
                dampingRelaxation: 2.4,
                antiRollForce: 3800,
                turnInAssist: 1.3,
                downforce: 1.6
            },
            { // 2: Neon Phantom Hypercar
                mass: 840,
                engineForce: 9400,
                maxSpeed: 360,
                steerAngleLow: 0.64,   // ~37 degrees
                steerAngleHigh: 0.40,  // ~23 degrees (high aero downforce grip)
                frontFriction: 4.0,
                rearFriction: 3.6,
                suspensionStiffness: 58,
                suspensionRestLength: 0.26,
                dampingCompression: 5.8,
                dampingRelaxation: 3.4,
                antiRollForce: 5800,
                turnInAssist: 1.65,
                downforce: 3.8
            },
            { // 3: Titan 4x4 Offroad
                mass: 1550,
                engineForce: 7400,
                maxSpeed: 195,
                steerAngleLow: 0.72,   // ~41 degrees
                steerAngleHigh: 0.42,  // ~24 degrees
                frontFriction: 3.2,
                rearFriction: 3.0,
                suspensionStiffness: 30,
                suspensionRestLength: 0.52,
                dampingCompression: 3.6,
                dampingRelaxation: 2.2,
                antiRollForce: 3200,
                turnInAssist: 1.2,
                downforce: 1.2
            }
        ];

        this.initVehicle(0);
    }

    initVehicle(typeIndex = 0) {
        this.carTypeIndex = typeIndex;
        const spec = this.specs[typeIndex];

        // Clean up previous
        if (this.vehicle) {
            this.vehicle.removeFromWorld(this.world);
        }
        if (this.chassisBody) {
            this.world.removeBody(this.chassisBody);
        }
        if (this.visualModel) {
            this.scene.remove(this.visualModel.mesh);
        }
        this.wheelMeshes.forEach(w => this.scene.remove(w));
        this.wheelMeshes = [];

        // 1. Create Physics Chassis with Lower Center of Mass
        const isOffroad = typeIndex === 3;
        const halfLength = isOffroad ? 2.1 : 2.2;
        const halfHeight = isOffroad ? 0.45 : 0.35;
        const halfWidth = isOffroad ? 1.1 : 1.0;

        const chassisShape = new CANNON.Box(new CANNON.Vec3(halfLength, halfHeight, halfWidth));
        this.chassisBody = new CANNON.Body({ mass: spec.mass });

        // Center of Mass is positioned low to eliminate excessive roll and tip-overs
        this.chassisBody.addShape(chassisShape, new CANNON.Vec3(0, isOffroad ? 0.25 : 0.05, 0));
        this.chassisBody.position.set(0, 2.5, 0);

        // Low angular damping so vehicle can rotate and yaw naturally in turns
        this.chassisBody.angularDamping = 0.04;
        this.chassisBody.linearDamping = 0.01;
        this.world.addBody(this.chassisBody);

        // 2. Create Raycast Vehicle
        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: this.chassisBody,
            indexForwardAxis: 0, // X is Forward
            indexRightAxis: 2,   // Z is Right
            indexUpAxis: 1       // Y is Up
        });

        const wheelOptions = {
            radius: isOffroad ? 0.55 : 0.42,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: spec.suspensionStiffness,
            suspensionRestLength: spec.suspensionRestLength,
            frictionSlip: spec.frontFriction,
            dampingRelaxation: spec.dampingRelaxation,
            dampingCompression: spec.dampingCompression,
            maxSuspensionForce: 100000,
            rollInfluence: 0.005, // Very low roll influence to prevent tripping/flipping
            axleLocal: new CANNON.Vec3(0, 0, 1),
            chassisConnectionPointLocal: new CANNON.Vec3(0, 0, 0),
            maxSuspensionTravel: isOffroad ? 0.45 : 0.28,
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true
        };

        const xF = 1.45;
        const xR = -1.45;
        const zDist = isOffroad ? 1.15 : 1.05;
        const yOffset = isOffroad ? -0.1 : -0.15;

        // Front Left (0)
        wheelOptions.frictionSlip = spec.frontFriction;
        wheelOptions.chassisConnectionPointLocal.set(xF, yOffset, -zDist);
        this.vehicle.addWheel(wheelOptions);

        // Front Right (1)
        wheelOptions.frictionSlip = spec.frontFriction;
        wheelOptions.chassisConnectionPointLocal.set(xF, yOffset, zDist);
        this.vehicle.addWheel(wheelOptions);

        // Rear Left (2)
        wheelOptions.frictionSlip = spec.rearFriction;
        wheelOptions.chassisConnectionPointLocal.set(xR, yOffset, -zDist);
        this.vehicle.addWheel(wheelOptions);

        // Rear Right (3)
        wheelOptions.frictionSlip = spec.rearFriction;
        wheelOptions.chassisConnectionPointLocal.set(xR, yOffset, zDist);
        this.vehicle.addWheel(wheelOptions);

        this.vehicle.addToWorld(this.world);

        // 3. Create Visual 3D Meshes
        this.visualModel = CarModels.createCarMesh(typeIndex);
        this.scene.add(this.visualModel.mesh);

        this.wheelMeshes = CarModels.createWheelMeshes(typeIndex);
        this.wheelMeshes.forEach(w => this.scene.add(w));
    }

    switchCar(typeIndex) {
        if (typeIndex === this.carTypeIndex) return;
        const currentPos = this.chassisBody.position.clone();
        const currentQuat = this.chassisBody.quaternion.clone();

        this.initVehicle(typeIndex);

        this.chassisBody.position.copy(currentPos);
        this.chassisBody.position.y += 0.5;
        this.chassisBody.quaternion.copy(currentQuat);
        this.chassisBody.velocity.set(0, 0, 0);
        this.chassisBody.angularVelocity.set(0, 0, 0);
        this.currentSteering = 0;
    }

    reset() {
        this.chassisBody.position.set(0, 2.0, 0);
        this.chassisBody.velocity.set(0, 0, 0);
        this.chassisBody.angularVelocity.set(0, 0, 0);
        this.chassisBody.quaternion.set(0, 0, 0, 1);
        this.currentSteering = 0;
        this.carHealth = 100;
        this.fuel = 100;
        this.nitro = 100;
        this.isDrifting = false;
        this.driftScore = 0;
        this.driftCombo = 1;
    }

    update(dt, keys, onStuntCallback) {
        const spec = this.specs[this.carTypeIndex];
        this.speedMs = this.chassisBody.velocity.length();
        this.speedKmh = this.speedMs * 3.6;

        // Vehicle Heading Vectors
        const fwdDir = new THREE.Vector3(1, 0, 0).applyQuaternion(this.visualModel.mesh.quaternion);
        const rightDir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.visualModel.mesh.quaternion);
        const upDir = new THREE.Vector3(0, 1, 0).applyQuaternion(this.visualModel.mesh.quaternion);
        const velVec = new THREE.Vector3(
            this.chassisBody.velocity.x,
            this.chassisBody.velocity.y,
            this.chassisBody.velocity.z
        );

        const forwardSpeed = velVec.dot(fwdDir);
        const lateralSpeed = velVec.dot(rightDir);

        // 1. Realistic Progressive Steering System
        let steerInput = 0;
        if (keys.KeyA || keys.ArrowLeft) steerInput += 1; // Turn Left (-Z)
        if (keys.KeyD || keys.ArrowRight) steerInput -= 1; // Turn Right (+Z)

        // Speed-dependent max steering angle (generous angle across all speeds)
        // High speed still allows ~22° - 24° so car can turn sharply and dynamically
        const speedRatio = Math.min(1.0, this.speedKmh / 220);
        const maxSteerAngle = THREE.MathUtils.lerp(spec.steerAngleLow, spec.steerAngleHigh, speedRatio);
        const targetSteer = steerInput * maxSteerAngle;

        // Smooth steering response rate (fast & responsive interpolation)
        const steerSpeed = steerInput !== 0 ? 11.0 : 15.0; // returns to center faster
        this.currentSteering = THREE.MathUtils.lerp(this.currentSteering, targetSteer, Math.min(1.0, dt * steerSpeed));

        // Ackermann Steering geometry: inside wheel turns slightly sharper for clean radius
        let steerLeft = this.currentSteering;
        let steerRight = this.currentSteering;
        if (this.currentSteering > 0) { // Turning Left
            steerLeft = this.currentSteering * 1.06;
            steerRight = this.currentSteering * 0.94;
        } else if (this.currentSteering < 0) { // Turning Right
            steerLeft = this.currentSteering * 0.94;
            steerRight = this.currentSteering * 1.06;
        }

        this.vehicle.setSteeringValue(steerLeft, 0);
        this.vehicle.setSteeringValue(steerRight, 1);

        // Steering wheel visual rotation in cockpit
        if (this.visualModel && this.visualModel.steeringWheel) {
            this.visualModel.steeringWheel.rotation.x = -this.currentSteering * 2.2;
        }

        // 2. Throttle, Reverse & Nitro
        let throttle = 0;
        if (keys.KeyW || keys.ArrowUp) throttle = 1;
        if (keys.KeyS || keys.ArrowDown) throttle = -0.6;

        // Nitro Boost
        this.isNitroActive = false;
        if ((keys.ShiftLeft || keys.ShiftRight || keys.KeyN) && throttle > 0 && this.nitro > 0) {
            this.isNitroActive = true;
            this.nitro = Math.max(0, this.nitro - dt * 25);
            throttle *= 1.65;

            // Apply forward rocket impulse
            const impulse = new CANNON.Vec3(fwdDir.x * 3200, 0, fwdDir.z * 3200);
            this.chassisBody.applyForce(impulse, this.chassisBody.position);

            // Nitro flames
            const backwardDir = fwdDir.clone().negate();
            this.visualModel.exhaustPoints.forEach(pt => {
                const worldPt = pt.clone().applyQuaternion(this.visualModel.mesh.quaternion).add(this.visualModel.mesh.position);
                this.effects.spawnNitroFlame(worldPt, backwardDir);
            });
        } else {
            this.nitro = Math.min(100, this.nitro + dt * 6);
        }

        if (this.audio) {
            this.audio.updateNitro(this.isNitroActive);
        }

        // 3. Handbrake, Braking & Friction Tuning
        const handbrake = !!keys.Space;
        const isBraking = handbrake || (throttle < 0 && forwardSpeed > 1.5);

        // Front & Rear dynamic friction slip
        let frontFric = spec.frontFriction;
        let rearFric = spec.rearFriction;

        if (handbrake) {
            rearFric = 0.55; // Break rear traction into drift
            frontFric = spec.frontFriction * 1.15; // Keep front planted
        }

        this.vehicle.wheelInfos[0].frictionSlip = frontFric;
        this.vehicle.wheelInfos[1].frictionSlip = frontFric;
        this.vehicle.wheelInfos[2].frictionSlip = rearFric;
        this.vehicle.wheelInfos[3].frictionSlip = rearFric;

        // Apply engine drive force
        const engineForce = throttle * spec.engineForce;

        // 4WD for Titan, RWD for Sports/Muscle/Hypercar
        const isAWD = this.carTypeIndex === 3;
        if (isAWD) {
            this.vehicle.applyEngineForce(engineForce * 0.4, 0);
            this.vehicle.applyEngineForce(engineForce * 0.4, 1);
            this.vehicle.applyEngineForce(engineForce * 0.6, 2);
            this.vehicle.applyEngineForce(engineForce * 0.6, 3);
        } else {
            // Limited Slip Differential (LSD) feel on rear wheels
            this.vehicle.applyEngineForce(engineForce, 2);
            this.vehicle.applyEngineForce(engineForce, 3);
        }

        // Realistic Brake Bias (65% Front / 35% Rear)
        const frontBrake = isBraking && !handbrake ? 60 : 0;
        const rearBrake = handbrake ? 90 : (isBraking ? 35 : 0);

        this.vehicle.setBrake(frontBrake, 0);
        this.vehicle.setBrake(frontBrake, 1);
        this.vehicle.setBrake(rearBrake, 2);
        this.vehicle.setBrake(rearBrake, 3);

        // Taillight glow on braking
        if (this.visualModel && this.visualModel.taillightMat) {
            this.visualModel.taillightMat.emissiveIntensity = isBraking ? 3.2 : 1.0;
        }

        // 4. Dynamic Turn-In Torque & Cornering Physics Assist
        // In real cars, front lateral tire grip creates a yaw moment proportional to speed and steer angle.
        // This ensures the car actively rotates into turns even during full throttle acceleration!
        if (Math.abs(this.currentSteering) > 0.01 && this.speedMs > 2.0) {
            const numGroundWheels = this.getGroundWheelsCount();
            if (numGroundWheels >= 2) {
                // Natural yaw torque assistance based on car speed and steer input
                const speedFactor = Math.min(1.2, this.speedMs / 18.0);
                const yawTorqueMag = this.currentSteering * spec.mass * 8.5 * speedFactor * spec.turnInAssist;
                const yawTorque = new CANNON.Vec3(0, yawTorqueMag, 0);
                this.chassisBody.torque.vadd(yawTorque, this.chassisBody.torque);

                // Apply downforce over the front axle to ensure front tire bite
                const frontAxlePos = this.chassisBody.position.clone();
                frontAxlePos.vadd(new CANNON.Vec3(fwdDir.x * 1.5, 0, fwdDir.z * 1.5), frontAxlePos);
                const frontBite = this.speedMs * 120 * spec.turnInAssist;
                this.chassisBody.applyForce(new CANNON.Vec3(0, -frontBite, 0), frontAxlePos);
            }
        }

        // 5. Anti-Roll Sway Bar Simulation
        this.applyAntiRollBars(spec.antiRollForce);

        // 6. Aerodynamic Downforce at Speed
        if (this.speedMs > 5.0) {
            const downforceMag = this.speedMs * this.speedMs * spec.downforce * 0.45;
            this.chassisBody.applyForce(new CANNON.Vec3(0, -downforceMag, 0), this.chassisBody.position);
        }

        // 7. Sync Visual Meshes with Physics Body
        this.visualModel.mesh.position.copy(this.chassisBody.position);
        this.visualModel.mesh.quaternion.copy(this.chassisBody.quaternion);

        for (let i = 0; i < this.vehicle.numWheels; i++) {
            this.vehicle.updateWheelTransform(i);
            const t = this.vehicle.wheelInfos[i].worldTransform;
            this.wheelMeshes[i].position.copy(t.position);
            this.wheelMeshes[i].quaternion.copy(t.quaternion);
        }

        // 8. Drift Angle, Slip Calculation & Counter-Steer Stability
        const latSpeedAbs = Math.abs(lateralSpeed);
        this.slipAmount = latSpeedAbs / Math.max(4, this.speedMs);

        if (this.speedMs > 6.0) {
            this.driftAngle = Math.atan2(latSpeedAbs, Math.abs(forwardSpeed)) * (180 / Math.PI);
        } else {
            this.driftAngle = 0;
        }

        const isSkidding = (this.driftAngle > 12.0 || handbrake) && this.speedMs > 5.0;
        this.isDrifting = isSkidding;

        if (this.isDrifting) {
            const pointsGained = Math.round(this.driftAngle * (this.speedKmh / 40) * this.driftCombo * dt * 25);
            this.driftScore += pointsGained;
            this.driftCombo = Math.min(5.0, this.driftCombo + dt * 0.5);
            this.nitro = Math.min(100, this.nitro + dt * 10);

            // Countersteering stabilization torque (assists holding long drifts)
            const slideSign = Math.sign(lateralSpeed);
            const counterSteer = -this.currentSteering * slideSign;
            if (counterSteer > 0) {
                // Player is countersteering correctly -> stabilize drift yaw rate!
                const stabilizeTorque = new CANNON.Vec3(0, -slideSign * spec.mass * 3.5, 0);
                this.chassisBody.torque.vadd(stabilizeTorque, this.chassisBody.torque);
            }

            // Spawn skid marks & tire smoke
            for (let i = 2; i < 4; i++) {
                const wPos = this.wheelMeshes[i].position.clone();
                this.effects.addSkidMark(i, wPos, fwdDir, true);
                this.effects.spawnTireSmoke(wPos, this.slipAmount);
            }
        } else {
            this.driftCombo = Math.max(1.0, this.driftCombo - dt * 1.5);
            for (let i = 0; i < 4; i++) {
                this.effects.addSkidMark(i, this.wheelMeshes[i].position, fwdDir, false);
            }
        }

        if (this.audio) {
            this.audio.updateScreech(this.isDrifting ? this.slipAmount : 0);
        }

        // 9. Stunt & Big Air Detection
        const numGroundWheels = this.getGroundWheelsCount();
        if (numGroundWheels === 0 && this.chassisBody.position.y > 1.2) {
            if (!this.inAir) {
                this.inAir = true;
                this.airTime = 0;
                this.airStartPos = this.chassisBody.position.clone();
                this.airStartRot = this.chassisBody.quaternion.clone();
            }
            this.airTime += dt;
        } else if (this.inAir && numGroundWheels >= 2) {
            // Landed smoothly!
            if (this.airTime > 0.5) {
                const stuntPoints = Math.round(this.airTime * 700 * this.driftCombo);
                this.nitro = Math.min(100, this.nitro + 30);
                if (this.audio) this.audio.playStuntChime();
                if (onStuntCallback) {
                    onStuntCallback(`BIG AIR ${this.airTime.toFixed(1)}s! +${stuntPoints}`);
                }
            }
            this.inAir = false;
            this.airTime = 0;
        }

        // 10. Transmission & RPM Simulation
        const gearTopSpeeds = [0, 48, 95, 145, 195, 250, 340];
        let targetGear = 1;
        for (let g = 1; g < gearTopSpeeds.length; g++) {
            if (this.speedKmh >= gearTopSpeeds[g - 1] - 4) {
                targetGear = g;
            }
        }

        if (targetGear !== this.currentGear && !this.isShifting && this.speedKmh > 8) {
            this.isShifting = true;
            this.shiftTimer = 0.16;
            this.currentGear = targetGear;
            if (this.audio && Math.random() > 0.3) {
                this.audio.playBlowOff();
            }
        }

        if (this.isShifting) {
            this.shiftTimer -= dt;
            if (this.shiftTimer <= 0) this.isShifting = false;
        }

        const minSpd = gearTopSpeeds[this.currentGear - 1];
        const maxSpd = gearTopSpeeds[this.currentGear] || 360;
        const gearProgress = Math.max(0, (this.speedKmh - minSpd) / Math.max(1, maxSpd - minSpd));

        let targetRpm = 850 + gearProgress * 6150;
        if (throttle <= 0) targetRpm = Math.max(850, targetRpm * 0.65);
        if (this.isShifting) targetRpm *= 0.52;

        this.rpm = THREE.MathUtils.lerp(this.rpm, Math.min(7500, targetRpm), dt * 12);

        if (this.audio) {
            this.audio.updateEngine(this.rpm, throttle > 0, this.isShifting, this.carTypeIndex);
        }

        // Fuel
        if (throttle !== 0) {
            this.fuel = Math.max(0, this.fuel - dt * 0.06);
        }
    }

    getGroundWheelsCount() {
        let count = 0;
        for (let i = 0; i < 4; i++) {
            if (this.vehicle.wheelInfos[i].isInContact) count++;
        }
        return count;
    }

    applyAntiRollBars(antiRollForce) {
        // Front Axle Anti-Roll (Wheels 0 & 1)
        const w0 = this.vehicle.wheelInfos[0];
        const w1 = this.vehicle.wheelInfos[1];
        if (w0.isInContact && w1.isInContact) {
            const travel0 = w0.suspensionLength;
            const travel1 = w1.suspensionLength;
            const antiRollDiff = (travel0 - travel1) * antiRollForce;
            const upDir = new CANNON.Vec3(0, 1, 0);

            // Apply counter forces on front wheel connection points
            const f0 = new CANNON.Vec3(0, antiRollDiff, 0);
            const f1 = new CANNON.Vec3(0, -antiRollDiff, 0);
            this.chassisBody.applyForce(f0, w0.chassisConnectionPointWorld);
            this.chassisBody.applyForce(f1, w1.chassisConnectionPointWorld);
        }

        // Rear Axle Anti-Roll (Wheels 2 & 3)
        const w2 = this.vehicle.wheelInfos[2];
        const w3 = this.vehicle.wheelInfos[3];
        if (w2.isInContact && w3.isInContact) {
            const travel2 = w2.suspensionLength;
            const travel3 = w3.suspensionLength;
            const antiRollDiff = (travel2 - travel3) * antiRollForce;

            const f2 = new CANNON.Vec3(0, antiRollDiff, 0);
            const f3 = new CANNON.Vec3(0, -antiRollDiff, 0);
            this.chassisBody.applyForce(f2, w2.chassisConnectionPointWorld);
            this.chassisBody.applyForce(f3, w3.chassisConnectionPointWorld);
        }
    }
}
