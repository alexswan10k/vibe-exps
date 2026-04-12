class Level {
    constructor(physics) {
        this.physics = physics;
        this.tiles = [];
        this.entities = []; // Active entities (Collectibles, Blocks)
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

        // Tutorial Collectibles
        this.addEntity(new Collectible(700, this.groundY - 200));
        this.addEntity(new Collectible(1000, this.groundY - 350));

        // Tutorial Push Block
        this.addEntity(new PushBlock(400, this.groundY - 100)); // Should fall

        this.lastX = 1500;
    }

    update(playerX, dt) {
        // Generate more level as player advances
        if (playerX + Constants.SCREEN_WIDTH * 1.5 > this.lastX) {
            this.generateChunk();
        }

        // Update entities
        for (let i = this.entities.length - 1; i >= 0; i--) {
            const ent = this.entities[i];
            ent.update(dt);

            // Remove if marked (e.g. collected)
            if (ent.remove) {
                this.entities.splice(i, 1);
            }
        }
    }

    generateChunk() {
        const startX = this.lastX;
        const width = Utils.randomInt(800, 1500);
        const endX = startX + width;

        // Random gap?
        let floorY = this.groundY;
        if (Math.random() > 0.3) {
            const gap = Utils.randomInt(100, 200);
            // Floor after gap
            this.addPlatform(startX + gap, floorY, width - gap, Constants.TILE_SIZE * 2);
        } else {
            // Continuous floor
            this.addPlatform(startX, this.groundY, width, Constants.TILE_SIZE * 2);
        }

        // Add Random Platforms & Entities
        let currentX = startX + 200;
        while (currentX < endX - 200) {
            const platWidth = Utils.randomInt(100, 300);
            const platHeight = 30;
            const platY = this.groundY - Utils.randomInt(100, 350);

            this.addPlatform(currentX, platY, platWidth, platHeight);

            // Chance for collectible on platform
            if (Math.random() > 0.3) {
                this.addEntity(new Collectible(
                    currentX + platWidth / 2 - 10,
                    platY - 40
                ));
            }

            // Chance for push block
            if (Math.random() > 0.8) {
                this.addEntity(new PushBlock(
                    currentX + platWidth / 2 - 24,
                    platY - 60
                ));
            }

            currentX += platWidth + Utils.randomInt(100, 400); // Space out
        }

        this.lastX = endX;
    }

    addPlatform(x, y, w, h) {
        const tile = { x, y, width: w, height: h };
        this.tiles.push(tile);
        this.physics.addStatic(tile);
    }

    addEntity(ent) {
        this.entities.push(ent);
        if (ent.type === 'collectible') {
            this.physics.addTrigger(ent);
        } else if (ent.type === 'block') {
            this.physics.addBody(ent);
        }
    }
}
