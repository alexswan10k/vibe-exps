class Level {
    constructor(physics) {
        this.physics = physics;
        this.tiles = [];
        this.lastX = 0;
        this.chunkWidth = 1000;
        this.groundY = Constants.SCREEN_HEIGHT - Constants.TILE_SIZE * 2;
    }

    generateStartingArea() {
        // Create a long floor
        this.addPlatform(0, this.groundY, 1500, Constants.TILE_SIZE * 2);

        // Some starter platforms
        this.addPlatform(600, this.groundY - 150, 200, 30);
        this.addPlatform(900, this.groundY - 300, 200, 30);

        this.lastX = 1500;
    }

    update(playerX) {
        // Generate more level as player advances
        if (playerX + Constants.SCREEN_WIDTH * 1.5 > this.lastX) {
            this.generateChunk();
        }

        // Optimize: Remove old tiles far behind (optional, preventing array bloat)
        // This is complex with physics references, so for prototype we might skip or do careful cleanup
    }

    generateChunk() {
        const startX = this.lastX;
        const width = Utils.randomInt(800, 1500);
        const endX = startX + width;

        // Random gap?
        if (Math.random() > 0.3) {
            const gap = Utils.randomInt(100, 200);
            // Floor after gap
            const floorY = this.groundY; // Keep flat for now
            this.addPlatform(startX + gap, floorY, width - gap, Constants.TILE_SIZE * 2);
        } else {
            // Continuous floor
            this.addPlatform(startX, this.groundY, width, Constants.TILE_SIZE * 2);
        }

        // Add Random Platforms
        let currentX = startX + 200;
        while (currentX < endX - 200) {
            const platWidth = Utils.randomInt(100, 300);
            const platHeight = 30;
            const platY = this.groundY - Utils.randomInt(100, 350);

            this.addPlatform(currentX, platY, platWidth, platHeight);

            currentX += platWidth + Utils.randomInt(100, 400); // Space out
        }

        this.lastX = endX;
    }

    addPlatform(x, y, w, h) {
        const tile = { x, y, width: w, height: h };
        this.tiles.push(tile);
        this.physics.addStatic(tile);
    }
}
