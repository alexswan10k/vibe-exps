class Game {
    constructor() {
        this.lastTime = 0;
        this.accumulator = 0;
        this.step = 1 / 60; // Fixed time step
        this.maxFrame = 0.1; // Max time to simulate per frame (prevent spiral of death)

        this.isRunning = false;
        this.isPaused = false;

        this.score = 0;

        // UI Elements
        this.scoreDisplay = document.getElementById('score-display');
        this.pauseOverlay = document.getElementById('pause-overlay');
        this.startScreen = document.getElementById('start-screen');

        window.addEventListener('score-add', (e) => {
            this.score += e.detail.amount;
            this.updateScore();
        });

        this.entities = [];
    }

    init() {
        this.input = new InputHandler();
        this.renderer = new Renderer();
        this.physics = new Physics();

        // Initialize Player and Level (placeholders for now)
        // this.player = ... will be set in reset()
        // this.level = ...

        this.reset();

        requestAnimationFrame((time) => this.loop(time));
    }

    reset() {
        this.physics.reset();

        // Create Player
        this.player = new Player(100, 300);
        this.physics.addBody(this.player);

        // Create Level
        this.level = new Level(this.physics);
        this.level.generateStartingArea();

        this.score = 0;
        this.updateScore();
        this.isRunning = false; // Wait for start
        this.startScreen.classList.remove('hidden');
    }

    start() {
        this.isRunning = true;
        this.startScreen.classList.add('hidden');
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            this.pauseOverlay.classList.remove('hidden');
        } else {
            this.pauseOverlay.classList.add('hidden');
        }
    }

    loop(time) {
        if (!this.lastTime) this.lastTime = time;
        let delta = (time - this.lastTime) / 1000;
        this.lastTime = time;

        if (delta > this.maxFrame) delta = this.maxFrame; // Cap delta time

        this.accumulator += delta;

        if (this.isRunning) {
            // Handle Start/Pause inputs
            if (this.input.isPressed('PAUSE')) {
                this.togglePause();
            }

            if (!this.isPaused) {
                while (this.accumulator >= this.step) {
                    this.update(this.step);
                    this.accumulator -= this.step;
                }
            }
        } else {
            if (this.input.isPressed('JUMP')) { // Space to start
                this.start();
            }
        }

        this.input.update(); // Update input state (prevKeys = currentKeys)

        this.draw();
        requestAnimationFrame((time) => this.loop(time));
    }

    update(dt) {
        // Update Level (Generation)
        this.level.update(this.player.x);

        // Update Player
        this.player.update(dt, this.input);

        // Update Physics
        this.physics.update(dt);

        // Camera Follow
        // Lerp camera towards player
        let targetCamX = this.player.x - Constants.SCREEN_WIDTH / 3; // Keep player in left third
        targetCamX = Math.max(0, targetCamX); // Check bounds

        this.renderer.setCamera(targetCamX, 0); // Y lock for now

        // Check Fall off
        if (this.player.y > Constants.SCREEN_HEIGHT + 200) {
            this.gameOver();
        }

        // Simple Score (Distance)
        const distScore = Math.floor(this.player.x / 100);
        if (distScore > this.score) {
            this.score = distScore;
            this.updateScore();
        }
    }

    draw() {
        this.renderer.clear();
        this.renderer.drawLevel(this.level);

        // Draw Level Entities
        if (this.level && this.level.entities) {
            for (const ent of this.level.entities) {
                ent.draw(this.renderer);
            }
        }

        this.renderer.drawPlayer(this.player);
    }

    updateScore() {
        this.scoreDisplay.innerText = `Range: ${this.score}m`;
    }

    gameOver() {
        // Quick reset for now
        this.reset();
    }
}
