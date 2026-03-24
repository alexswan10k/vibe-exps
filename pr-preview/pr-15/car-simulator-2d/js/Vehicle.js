class Vehicle {
    constructor(x, y, world) {
        this.world = world;
        this.bodies = [];
        this.createCar(x, y);
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

        // Chassis
        this.chassis = Bodies.rectangle(x, y, chassisWidth, chassisHeight, {
            collisionFilter: { group: group },
            density: 0.002,
            friction: 0.5,
            label: 'chassis',
            render: {
                fillStyle: '#e74c3c',
                strokeStyle: '#c0392b',
                lineWidth: 3
            }
        });

        // Wheels
        this.wheelA = Bodies.circle(x - wheelOffset, y + 25, wheelSize, {
            collisionFilter: { group: group },
            friction: 0.9,
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
            density: 0.01,
            restitution: 0.2,
            label: 'wheel',
            render: {
                fillStyle: '#333',
                strokeStyle: '#555',
                lineWidth: 3
            }
        });

        // Suspension (Constraints)
        const axelA = Constraint.create({
            bodyA: this.chassis,
            bodyB: this.wheelA,
            pointA: { x: -wheelOffset, y: 10 },
            stiffness: 0.2,
            length: 45,
            damping: 0.1,
            render: { visible: true, lineWidth: 5, strokeStyle: '#7f8c8d' }
        });

        const axelB = Constraint.create({
            bodyA: this.chassis,
            bodyB: this.wheelB,
            pointA: { x: wheelOffset, y: 10 },
            stiffness: 0.2,
            length: 45,
            damping: 0.1,
            render: { visible: true, lineWidth: 5, strokeStyle: '#7f8c8d' }
        });

        this.composite = Composite.create({ label: 'Car' });
        Composite.add(this.composite, [this.chassis, this.wheelA, this.wheelB, axelA, axelB]);
        Composite.add(this.world, this.composite);
    }

    update(input) {
        if (!this.chassis || !this.wheelA || !this.wheelB) return;

        const Body = Matter.Body;
        const speed = 0.5;

        if (input.keys.ArrowUp) {
            this.wheelA.torque = speed;
            this.wheelB.torque = speed;
        }

        if (input.keys.ArrowDown) {
            this.wheelA.torque = -speed;
            this.wheelB.torque = -speed;
        }

        // Air control
        if (input.keys.ArrowLeft) {
            Body.applyForce(this.chassis, { x: this.chassis.position.x - 20, y: this.chassis.position.y }, { x: 0, y: -0.005 });
            Body.applyForce(this.chassis, { x: this.chassis.position.x + 20, y: this.chassis.position.y }, { x: 0, y: 0.005 });
        }

        if (input.keys.ArrowRight) {
            Body.applyForce(this.chassis, { x: this.chassis.position.x - 20, y: this.chassis.position.y }, { x: 0, y: 0.005 });
            Body.applyForce(this.chassis, { x: this.chassis.position.x + 20, y: this.chassis.position.y }, { x: 0, y: -0.005 });
        }
    }

    getPosition() {
        return this.chassis.position;
    }
}
