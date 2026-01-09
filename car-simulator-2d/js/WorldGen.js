class WorldGen {
    constructor(world) {
        this.world = world;
        this.lastChunkIndex = -1;
        this.chunkWidth = 1500;
        // Keep track of bodies to eventually remove old chunks
        this.chunks = {};
    }

    init() {
        // Start with a safe flat platform that extends behind the car too
        this.createGround(-1000, 0, 2000);
        this.lastChunkIndex = 0;
    }

    createGround(xStart, yHeight, width) {
        const Bodies = Matter.Bodies;
        // Ensure seamless connection
        const ground = Bodies.rectangle(xStart + width / 2, 500 + yHeight, width, 100, {
            isStatic: true,
            label: 'ground',
            render: { fillStyle: '#27ae60' }
        });
        Matter.Composite.add(this.world, ground);
        return ground;
    }

    update(playerX) {
        const currentChunk = Math.floor(playerX / this.chunkWidth);

        // Generate ahead
        if (currentChunk > this.lastChunkIndex - 2) {
            // Generate next chunk
            this.generateChunk(this.lastChunkIndex + 1);
        }
    }

    generateChunk(index) {
        // Simple procedural generation
        const Bodies = Matter.Bodies;
        const xStart = index * this.chunkWidth;

        // Randomize height slightly
        const yOffset = Math.sin(index) * 100;

        const ground = this.createGround(xStart, yOffset, this.chunkWidth);

        // Maybe add some bumps (primitives)
        if (index > 0 && Math.random() > 0.5) {
            const ramp = Bodies.trapezoid(xStart + 500, 500 + yOffset - 50, 200, 100, 0.4, {
                isStatic: true,
                render: { fillStyle: '#8e44ad' },
                angle: -0.2
            });
            Matter.Composite.add(this.world, ramp);
        }

        this.lastChunkIndex = index;
    }
}
