// Realistic Vehicle Physics: Aerodynamics, Weight Transfer, Load-dependent Grip, Engine Braking & Drifting
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

        this.speedKmh = 0;
        this.speedMs = 0;
        this.rpm = 800;
        this.currentGear = 1;
        this.isShifting = false;
        this.shiftTimer = 0;
        this.nitro = 100;
        this.isNitroActive = false;
        this.carHealth = 100;
        this.fuel = 100;

        this.currentSteering = 0;

        this.isDrifting = false;
        this.driftScore = 0;
        this.driftCombo = 1;
        this.driftAngle = 0;
        this.slipAmount = 0;

        this.inAir = false;
        this.airTime = 0;
        this.airStartPos = null;
        this.airStartRot = null;
        this.airTotalSpin = 0;

        // Track previous velocity for acceleration calculation
        this.prevVelocity = new CANNON.Vec3(0, 0, 0);

        // Cached vectors for performance
        this._fwdDir = new THREE.Vector3();
        this._rightDir = new THREE.Vector3();
        this._velVec = new THREE.Vector3();
        this._dragForce = new CANNON.Vec3();
        this._rollForce = new CANNON.Vec3();
        this._wPos = new THREE.Vector3();

        this.specs = [
            { // 0: Apex Supercar — balanced, high grip, low drag
                mass: 920,
                engineForce: 6400,
                maxSpeed: 285,
                steerAngleLow: 0.52,
                steerAngleHigh: 0.25,
                frontFriction: 4.6,
                rearFriction: 4.4,
                suspensionStiffness: 55,
                suspensionRestLength: 0.28,
                dampingCompression: 5.2,
                dampingRelaxation: 3.2,
                antiRollForce: 5200,
                downforce: 3.0,
                dragCoefficient: 0.30,
                rollResistance: 0.012,
                frontalArea: 2.0,
                frontBrakeBias: 0.62,
                rearBrakeBias: 0.38
            },
            { // 1: V8 Thunder Muscle — rear-biased, loose, high power
                mass: 1180,
                engineForce: 7600,
                maxSpeed: 245,
                steerAngleLow: 0.58,
                steerAngleHigh: 0.26,
                frontFriction: 4.0,
                rearFriction: 3.6,
                suspensionStiffness: 38,
                suspensionRestLength: 0.34,
                dampingCompression: 4.2,
                dampingRelaxation: 2.6,
                antiRollForce: 3600,
                downforce: 1.8,
                dragCoefficient: 0.38,
                rollResistance: 0.015,
                frontalArea: 2.4,
                frontBrakeBias: 0.55,
                rearBrakeBias: 0.45
            },
            { // 2: Neon Phantom Hypercar — max grip, extreme downforce
                mass: 840,
                engineForce: 9400,
                maxSpeed: 360,
                steerAngleLow: 0.50,
                steerAngleHigh: 0.22,
                frontFriction: 5.0,
                rearFriction: 4.8,
                suspensionStiffness: 62,
                suspensionRestLength: 0.24,
                dampingCompression: 6.2,
                dampingRelaxation: 3.6,
                antiRollForce: 6200,
                downforce: 4.2,
                dragCoefficient: 0.28,
                rollResistance: 0.011,
                frontalArea: 1.9,
                frontBrakeBias: 0.60,
                rearBrakeBias: 0.40
            },
            { // 3: Titan 4x4 Offroad — heavy, loose, high clearance
                mass: 1550,
                engineForce: 7400,
                maxSpeed: 195,
                steerAngleLow: 0.60,
                steerAngleHigh: 0.30,
                frontFriction: 3.6,
                rearFriction: 3.4,
                suspensionStiffness: 32,
                suspensionRestLength: 0.52,
                dampingCompression: 3.8,
                dampingRelaxation: 2.4,
                antiRollForce: 3000,
                downforce: 1.4,
                dragCoefficient: 0.55,
                rollResistance: 0.022,
                frontalArea: 3.2,
                frontBrakeBias: 0.50,
                rearBrakeBias: 0.50
            }
        ];

        this.initVehicle(0);
    }

    initVehicle(typeIndex = 0) {
        this.carTypeIndex = typeIndex;
        const spec = this.specs[typeIndex];

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

        const isOffroad = typeIndex === 3;
        const halfLength = isOffroad ? 2.1 : 2.2;
        const halfHeight = isOffroad ? 0.45 : 0.35;
        const halfWidth = isOffroad ? 1.1 : 1.0;

        const chassisShape = new CANNON.Box(new CANNON.Vec3(halfLength, halfHeight, halfWidth));
        this.chassisBody = new CANNON.Body({ mass: spec.mass });
        this.chassisBody.addShape(chassisShape, new CANNON.Vec3(0, isOffroad ? 0.25 : 0.05, 0));
        this.chassisBody.position.set(0, 2.5, 0);
        this.chassisBody.angularDamping = 0.04;
        this.chassisBody.linearDamping = 0.01;
        this.world.addBody(this.chassisBody);

        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: this.chassisBody,
            indexForwardAxis: 0,
            indexRightAxis: 2,
            indexUpAxis: 1
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
            rollInfluence: 0.005,
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

        wheelOptions.frictionSlip = spec.frontFriction;
        wheelOptions.chassisConnectionPointLocal.set(xF, yOffset, -zDist);
        this.vehicle.addWheel(wheelOptions);

        wheelOptions.frictionSlip = spec.frontFriction;
        wheelOptions.chassisConnectionPointLocal.set(xF, yOffset, zDist);
        this.vehicle.addWheel(wheelOptions);

        wheelOptions.frictionSlip = spec.rearFriction;
        wheelOptions.chassisConnectionPointLocal.set(xR, yOffset, -zDist);
        this.vehicle.addWheel(wheelOptions);

        wheelOptions.frictionSlip = spec.rearFriction;
        wheelOptions.chassisConnectionPointLocal.set(xR, yOffset, zDist);
        this.vehicle.addWheel(wheelOptions);

        this.vehicle.addToWorld(this.world);

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
        this.prevVelocity.set(0, 0, 0);
    }

    update(dt, keys, onStuntCallback) {
        const spec = this.specs[this.carTypeIndex];
        this.speedMs = this.chassisBody.velocity.length();
        this.speedKmh = this.speedMs * 3.6;

        // Vehicle heading vectors
        const fwdDir = this._fwdDir;
        fwdDir.set(1, 0, 0).applyQuaternion(this.visualModel.mesh.quaternion);
        const rightDir = this._rightDir;
        rightDir.set(0, 0, 1).applyQuaternion(this.visualModel.mesh.quaternion);
        const velVec = this._velVec;
        velVec.set(
            this.chassisBody.velocity.x,
            this.chassisBody.velocity.y,
            this.chassisBody.velocity.z
        );

        const forwardSpeed = velVec.dot(fwdDir);
        const lateralSpeed = velVec.dot(rightDir);

        // 1. Realistic Progressive Steering System
        let steerInput = 0;
        if (keys.KeyA || keys.ArrowLeft) steerInput += 1;
        if (keys.KeyD || keys.ArrowRight) steerInput -= 1;

        // Speed-dependent max steering angle — much more aggressive reduction at high speed
        const speedRatio = Math.min(1.0, this.speedKmh / 180);
        const maxSteerAngle = THREE.MathUtils.lerp(spec.steerAngleLow, spec.steerAngleHigh, speedRatio * speedRatio);
        const targetSteer = steerInput * maxSteerAngle;

        // Much slower, more progressive steering response (realistic rack-and-pinion feel)
        const steerSpeed = steerInput !== 0 ? 4.5 : 8.0;
        this.currentSteering = THREE.MathUtils.lerp(this.currentSteering, targetSteer, Math.min(1.0, dt * steerSpeed));

        // Ackermann steering geometry
        let steerLeft = this.currentSteering;
        let steerRight = this.currentSteering;
        if (this.currentSteering > 0) {
            steerLeft = this.currentSteering * 1.06;
            steerRight = this.currentSteering * 0.94;
        } else if (this.currentSteering < 0) {
            steerLeft = this.currentSteering * 0.94;
            steerRight = this.currentSteering * 1.06;
        }

        this.vehicle.setSteeringValue(steerLeft, 0);
        this.vehicle.setSteeringValue(steerRight, 1);

        if (this.visualModel && this.visualModel.steeringWheel) {
            this.visualModel.steeringWheel.rotation.x = -this.currentSteering * 2.2;
        }

        // 2. Throttle, Reverse & Nitro
        let throttle = 0;
        if (keys.KeyW || keys.ArrowUp) throttle = 1;
        if (keys.KeyS || keys.ArrowDown) throttle = -0.6;

        this.isNitroActive = false;
        if ((keys.ShiftLeft || keys.ShiftRight || keys.KeyN) && throttle > 0 && this.nitro > 0) {
            this.isNitroActive = true;
            this.nitro = Math.max(0, this.nitro - dt * 25);
            throttle *= 1.65;
            const fwdDir = this._fwdDir;
            const impulse = new CANNON.Vec3(fwdDir.x * 3200, 0, fwdDir.z * 3200);
            this.chassisBody.applyForce(impulse, this.chassisBody.position);
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

        // 3. Handbrake & Braking
        const handbrake = !!keys.Space;
        const isBraking = handbrake || (throttle < 0 && forwardSpeed > 1.5);

        // 4. Load-dependent friction (weight transfer)
        this.updateWeightTransfer(dt, spec);

        // Base friction values
        let frontFric = spec.frontFriction;
        let rearFric = spec.rearFriction;

        if (handbrake) {
            rearFric = 0.5;
            frontFric = spec.frontFriction * 1.1;
        }

        // Apply load-dependent friction per wheel
        this.applyLoadDependentFriction(frontFric, rearFric, handbrake);

        // 5. Engine Drive Force
        const engineForce = throttle * spec.engineForce;

        // 6. Differential — 4WD or RWD
        const isAWD = this.carTypeIndex === 3;
        if (isAWD) {
            this.vehicle.applyEngineForce(engineForce * 0.4, 0);
            this.vehicle.applyEngineForce(engineForce * 0.4, 1);
            this.vehicle.applyEngineForce(engineForce * 0.6, 2);
            this.vehicle.applyEngineForce(engineForce * 0.6, 3);
        } else {
            // RWD with simulated LSD
            this.vehicle.applyEngineForce(engineForce, 2);
            this.vehicle.applyEngineForce(engineForce, 3);
        }

        // 7. Engine Braking (when throttle released and in gear)
        if (throttle <= 0 && this.speedMs > 1.5 && this.currentGear > 1) {
            const engineBrakeForce = spec.engineForce * 0.28 * (this.currentGear / 6);
            if (isAWD) {
                this.vehicle.applyEngineForce(-engineBrakeForce * 0.4, 0);
                this.vehicle.applyEngineForce(-engineBrakeForce * 0.4, 1);
                this.vehicle.applyEngineForce(-engineBrakeForce * 0.6, 2);
                this.vehicle.applyEngineForce(-engineBrakeForce * 0.6, 3);
            } else {
                this.vehicle.applyEngineForce(-engineBrakeForce * 0.85, 2);
                this.vehicle.applyEngineForce(-engineBrakeForce * 0.7, 3);
            }
        }

        // 8. Speed-dependent brake bias
        const speedRatio2 = Math.min(1.0, this.speedKmh / 200);
        const bias = THREE.MathUtils.lerp(spec.frontBrakeBias, spec.rearBrakeBias, speedRatio2);
        const frontBrake = isBraking && !handbrake ? 60 * bias : 0;
        const rearBrake = handbrake ? 90 : (isBraking ? 35 * (1 - bias) : 0);

        this.vehicle.setBrake(frontBrake, 0);
        this.vehicle.setBrake(frontBrake, 1);
        this.vehicle.setBrake(rearBrake, 2);
        this.vehicle.setBrake(rearBrake, 3);

        if (this.visualModel && this.visualModel.taillightMat) {
            this.visualModel.taillightMat.emissiveIntensity = isBraking ? 3.2 : 1.0;
        }

        // 9. Anti-Roll Sway Bars
        this.applyAntiRollBars(spec.antiRollForce);

        // 10. Aerodynamic Downforce
        if (this.speedMs > 5.0) {
            const downforceMag = this.speedMs * this.speedMs * spec.downforce * 0.45;
            this.chassisBody.applyForce(new CANNON.Vec3(0, -downforceMag, 0), this.chassisBody.position);
        }

        // 11. Aerodynamic Drag (opposes motion, proportional to v²)
        if (this.speedMs > 0.5) {
            const rho = 1.225;
            const Cd = spec.dragCoefficient;
            const A = spec.frontalArea;
            const dragMag = 0.5 * rho * Cd * A * this.speedMs * this.speedMs;
            const velNorm = velVec.clone().normalize();
            this._dragForce.set(
                -velNorm.x * dragMag,
                -velNorm.y * dragMag * 0.1, // minimal vertical drag component
                -velNorm.z * dragMag
            );
            this.chassisBody.applyForce(this._dragForce, this.chassisBody.position);
        }

        // 12. Rolling Resistance (opposes motion)
        if (this.speedMs > 0.5) {
            const normalForce = this.chassisBody.mass * 9.81;
            const rollMag = spec.rollResistance * normalForce;
            const velNorm = velVec.clone().normalize();
            this._rollForce.set(
                -velNorm.x * rollMag,
                0,
                -velNorm.z * rollMag
            );
            this.chassisBody.applyForce(this._rollForce, this.chassisBody.position);
        }

        // 13. Sync Visual Meshes
        this.visualModel.mesh.position.copy(this.chassisBody.position);
        this.visualModel.mesh.quaternion.copy(this.chassisBody.quaternion);

        for (let i = 0; i < this.vehicle.numWheels; i++) {
            this.vehicle.updateWheelTransform(i);
            const t = this.vehicle.wheelInfos[i].worldTransform;
            this.wheelMeshes[i].position.copy(t.position);
            this.wheelMeshes[i].quaternion.copy(t.quaternion);
        }

        // 14. Drift Detection & Scoring
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

            // Countersteering stabilization
            const slideSign = Math.sign(lateralSpeed);
            const counterSteer = -this.currentSteering * slideSign;
            if (counterSteer > 0) {
                const stabilizeTorque = new CANNON.Vec3(0, -slideSign * spec.mass * 2.0, 0);
                this.chassisBody.torque.vadd(stabilizeTorque, this.chassisBody.torque);
            }

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

        // 15. Stunt Detection
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

        // 16. Transmission & RPM
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

        // Update prevVelocity for next frame's weight transfer
        this.prevVelocity.copy(this.chassisBody.velocity);
    }

    getGroundWheelsCount() {
        let count = 0;
        for (let i = 0; i < 4; i++) {
            if (this.vehicle.wheelInfos[i].isInContact) count++;
        }
        return count;
    }

    updateWeightTransfer(dt, spec) {
        // Longitudinal acceleration along car's forward axis (from previous frame's velocity change)
        const fwdDir = this._fwdDir;
        const vel = this._velVec;

        const currentLongSpeed = vel.dot(fwdDir);
        const prevLongSpeed = this.prevVelocity.dot(fwdDir);
        const longAccel = (currentLongSpeed - prevLongSpeed) / Math.max(dt, 0.001);

        // Weight transfer calculation
        const wheelbase = 2.9;
        const cgHeight = 0.4;
        const g = 9.81;

        const weightTransferLong = (spec.mass * cgHeight / wheelbase) * longAccel;

        this._frontAxleLoad = Math.max(0.1, spec.mass * g * 0.55 + weightTransferLong);
        this._rearAxleLoad = Math.max(0.1, spec.mass * g * 0.45 - weightTransferLong);
    }

    applyLoadDependentFriction(frontFric, rearFric, handbrake) {
        const spec = this.specs[this.carTypeIndex];
        const g = 9.81;
        const totalStaticLoad = spec.mass * g;

        for (let i = 0; i < 4; i++) {
            const wheel = this.vehicle.wheelInfos[i];

            // Get suspension compression to estimate load on individual wheel
            const compression = Math.max(0, 1.0 - (wheel.suspensionLength / spec.suspensionRestLength));
            const suspensionLoad = compression * spec.mass * g * 0.25;

            // Calculate axle load ratio
            const axleLoadRatio = i < 2
                ? Math.max(0.3, Math.min(1.7, this._frontAxleLoad / (spec.mass * g * 0.55)))
                : Math.max(0.3, Math.min(1.7, this._rearAxleLoad / (spec.mass * g * 0.45)));

            // Base friction scaled by axle load — more load = more grip (with diminishing returns)
            const loadScale = 1.0 + (axleLoadRatio - 1.0) * 0.35;
            const clampedLoadScale = Math.max(0.65, Math.min(1.5, loadScale));

            // Suspension compression adds micro-variation
            const suspensionScale = 1.0 + compression * 0.15;

            let friction;
            if (i < 2) {
                friction = frontFric * clampedLoadScale * suspensionScale;
            } else {
                friction = rearFric * clampedLoadScale * suspensionScale;
            }

            // Clamp friction to reasonable range
            friction = Math.max(0.5, Math.min(8.0, friction));

            wheel.frictionSlip = friction;
        }
    }

    applyAntiRollBars(antiRollForce) {
        const w0 = this.vehicle.wheelInfos[0];
        const w1 = this.vehicle.wheelInfos[1];
        if (w0.isInContact && w1.isInContact) {
            const travel0 = w0.suspensionLength;
            const travel1 = w1.suspensionLength;
            const antiRollDiff = (travel0 - travel1) * antiRollForce;
            const upDir = new CANNON.Vec3(0, 1, 0);
            const f0 = new CANNON.Vec3(0, antiRollDiff, 0);
            const f1 = new CANNON.Vec3(0, -antiRollDiff, 0);
            this.chassisBody.applyForce(f0, w0.chassisConnectionPointWorld);
            this.chassisBody.applyForce(f1, w1.chassisConnectionPointWorld);
        }

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