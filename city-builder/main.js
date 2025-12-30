// Main Entry Point for City Builder Game
console.log('=== MAIN.JS LOADED ===');

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== DOM CONTENT LOADED ===');

    try {
        // Create full game instance
        console.log('=== CREATING GAME INSTANCE ===');
        const game = new Game();
        
        console.log('=== GAME CREATED SUCCESSFULLY ===');
        console.log('Game instance:', game);
        
        // Initialize React UI
        if (window.initReactUI) {
            console.log('=== INITIALIZING REACT UI ===');
            window.initReactUI(game);
        }
        
        // Make globally accessible
        window.cityBuilderGame = game;
        
        console.log('=== GAME INITIALIZED SUCCESSFULLY ===');
    } catch (error) {
        console.error('=== ERROR INITIALIZING GAME ===', error);
        
        // Fallback to simple game if full game fails
        console.log('=== FALLING BACK TO SIMPLE GAME ===');
        const fallbackGame = new SimpleGame();
        window.cityBuilderGame = fallbackGame;
    }
});

// Simple fallback game implementation
class SimpleGame {
    constructor() {
        this.state = {
            isRunning: true,
            isPaused: false,
            money: 10000,
            population: 0,
            notifications: []
        };

        this.init();
    }

    init() {
        console.log('=== SIMPLE GAME INIT ===');
        this.createRenderer();
        this.startGameLoop();
    }

    createRenderer() {
        console.log('=== CREATING SIMPLE RENDERER ===');
        const container = document.getElementById('pixi-canvas');
        if (!container) {
            console.error('Container not found!');
            return;
        }

        try {
            this.app = new PIXI.Application({
                width: 800,
                height: 600,
                backgroundColor: 0x87CEEB,
                antialias: true
            });

            container.appendChild(this.app.view);

            // Create a test rectangle
            const graphics = new PIXI.Graphics();
            graphics.beginFill(0xff0000);
            graphics.drawRect(100, 100, 100, 100);
            graphics.endFill();
            this.app.stage.addChild(graphics);
        } catch (error) {
            console.error('Error creating simple Pixi application:', error);
        }
    }

    startGameLoop() {
        const gameLoop = () => {
            if (this.state.isRunning && !this.state.isPaused) {
                // Simple game update logic
            }
            requestAnimationFrame(gameLoop);
        };
        gameLoop();
    }
}
