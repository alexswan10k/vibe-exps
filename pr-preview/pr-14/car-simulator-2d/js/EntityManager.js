class EntityManager {
    constructor(world) {
        this.world = world;
    }

    spawnBox(x, y) {
        const box = Matter.Bodies.rectangle(x, y, 50, 50, {
            density: 0.005,
            friction: 0.5,
            restitution: 0.5,
            render: { fillStyle: '#3498db' }
        });
        Matter.Composite.add(this.world, box);
    }

    spawnDestructibleCrate(x, y) {
        const crate = Matter.Bodies.rectangle(x, y, 60, 60, {
            label: 'destructible',
            render: { fillStyle: '#e67e22', strokeStyle: '#d35400', lineWidth: 2 },
            density: 0.002,
            friction: 0.8
        });

        Matter.Composite.add(this.world, crate);
    }

    explodeCrate(body) {
        // Remove original
        Matter.Composite.remove(this.world, body);

        // Add debris
        const x = body.position.x;
        const y = body.position.y;

        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                const debris = Matter.Bodies.rectangle(x - 20 + i * 20, y - 20 + j * 20, 20, 20, {
                    density: 0.002,
                    friction: 0.8,
                    render: { fillStyle: '#d35400' }
                });
                // Add random velocity for explosion effect
                Matter.Body.setVelocity(debris, {
                    x: (Math.random() - 0.5) * 10,
                    y: (Math.random() - 0.5) * 10
                });
                Matter.Composite.add(this.world, debris);
            }
        }
    }

    clearAll() {
        // Clear all bodies except player and ground components
        // Note: Ground components might just be static bodies. We need to be careful.
        // We can just query all bodies and check labels.
        const bodies = Matter.Composite.allBodies(this.world);
        bodies.forEach(body => {
            // Keep Ground, Chassis, Wheels, Constraints (if bodies?)
            // Constraints are not bodies.
            if (body.label !== 'chassis' && body.label !== 'wheel' && body.label !== 'ground') {
                Matter.Composite.remove(this.world, body);
            }
        });
    }
}
