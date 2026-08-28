class Vehicle {
    constructor(x, y, world) {
        this.world = world;
        this.bodies = [];
        this.createCar(x, y);
        this.prevAngularVel = 0;
        this.steerAngle = 0;
        this.targetSteerAngle = 0;
    }

    createCar(x, y) {
        const Bodies = Matter.Bodies,
            Body = Matter.Body,
            Composite = Matter.Composite,
            Constraint = Matter.Constraint;

        const group = Body.nextGroup(true);

        const chassisWidth = 160;
        const chassisHeight = 30;
        const wheelSize = 25;
        const wheelOffset = 60;

        this.chassis = Bodies.rectangle(x, y, chassisWidth, chassisHeight, {
            collisionFilter: { group: group },
            density: 0.002,
            friction: 0.5,
            frictionStatic: 0.6,
            label: 'chassis',
            render: {
                fillStyle: '#e74c3c',
                strokeStyle: '#c0392b',
                lineWidth: 3
            }
        });

        this.wheelA = Bodies.circle(x - wheelOffset, y + 25, wheelSize, {
            collisionFilter: { group: group },
            friction: 0.9,
            frictionStatic: 1.0,
            density: 0.01,
            restitution: 0.2,
            label: 'wheel',
            render: {
                fillStyle: '#333',
                strokeStyle: '#555',
                lineWidth: 3
            }
        });

        this.wheelB = Bodies.circle(x + wheelOffset, y + 25, wheelSize, {
            collisionFilter: { group: group },
            friction: 0.9,
            frictionStatic: 1.0,
            density: 0.01,
            restitution: 0.2,
            label: 'wheel',
            render: {
                fillStyle: '#333',
                strokeStyle: '#555',
                lineWidth: 3
            }
        });

        const axelA = Constraint.create({
            bodyA: this.chassis,
            bodyB: this.wheelA,
            pointA: { x: -wheelOffset, y: 10 },
            stiffness: 0.35,
            length: 42,
            damping: 0.15,
            render: { visible: true, lineWidth: 5, strokeStyle: '#7f8c8d' }
        });

        const axelB = Constraint.create({
            bodyA: this.chassis,
            bodyB: this.wheelB,
            pointA: { x: wheelOffset, y: 10 },
            stiffness: 0.35,
            length: 42,
            damping: 0.15,
            render: { visible: true, lineWidth: 5, strokeStyle: '#7f8c8d' }
        });

        this.composite = Composite.create({ label: 'Car' });
        Composite.add(this.composite, [this.chassis, this.wheelA, this.wheelB, axelA, axelB]);
        Composite.add(this.world, this.composite);
    }

    update(input) {
        if (!this.chassis || !this.wheelA || !this.wheelB) return;

        const Body = Matter.Body;
        const speed = Math.sqrt(this.chassis.velocity.x ** 2 + this.chassis.velocity.y ** 2);
        const steerSpeed = 3.5;

        // Steering input
        let steerInput = 0;
        if (input.keys.ArrowLeft) steerInput = 1;
        if (input.keys.ArrowRight) steerInput = -1;

        // Speed-dependent steering: less turn at high speed, more at low speed
        const speedFactor = Math.max(0.15, Math.min(1.0, 18 / Math.max(speed, 1)));
        const targetSteer = steerInput * steerSpeed * speedFactor;

        // Smooth steering interpolation
        this.targetSteerAngle = targetSteer;
        this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1, 0.12);

        // Apply steering torque to chassis — rotates car around its center
        const torqueScale = 0.000035 * speedFactor;
        const steerTorque = -this.steerAngle * torqueScale * Math.max(0, speed);

        // Angular damping to prevent oscillation
        this.chassis.angularVelocity *= 0.92;
        this.chassis.angularVelocity += steerTorque;

        // Throttle / Reverse — torque on wheels
        const driveTorque = 0.008;
        const reverseTorque = -0.0055;

        if (input.keys.ArrowUp) {
            this.wheelA.torque = driveTorque;
            this.wheelB.torque = driveTorque;
        } else if (input.keys.ArrowDown) {
            this.wheelA.torque = reverseTorque;
            this.wheelB.torque = reverseTorque;
        } else {
            // Engine braking when no throttle
            if (Math.abs(speed) > 0.3) {
                const speedSign = Math.sign(this.chassis.velocity.x + this.chassis.velocity.y);
                this.wheelA.torque = -speedSign * driveTorque * 0.4;
                this.wheelB.torque = -speedSign * driveTorque * 0.4;
            } else {
                this.wheelA.torque = 0;
                this.wheelB.torque = 0;
            }
        }

        // Lateral grip: reduce sideways slip at higher speeds
        const lateralGrip = speed > 2 ? 0.92 : 0.78;
        const currentVel = this.chassis.velocity;
        const angle = this.chassis.angle;

        // Decompose velocity into forward and lateral components
        const forwardVel = currentVel.x * Math.cos(angle) + currentVel.y * Math.sin(angle);
        const lateralVel = -currentVel.x * Math.sin(angle) + currentVel.y * Math.cos(angle);

        // Apply lateral grip (resists sideways sliding)
        const newLateralVel = lateralVel * lateralGrip;

        // Recompose velocity
        const newForwardX = forwardVel * Math.cos(angle) - newLateralVel * Math.sin(angle);
        const newForwardY = forwardVel * Math.sin(angle) + newLateralVel * Math.cos(angle);

        // Preserve forward velocity, apply lateral grip
        this.chassis.velocity.x = newForwardX;
        this.chassis.velocity.y = newForwardY;

        // If reversing, maintain some forward momentum damping
        if (input.keys.ArrowDown && speed > 0.3) {
            this.chassis.velocity.x *= 0.94;
            this.chassis.velocity.y *= 0.94;
        }
    }

    getPosition() {
        return this.chassis.position;
    }
}