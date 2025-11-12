/**
 * Main entry point for the colony simulation game
 */

// Initialize the game when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing game...');
    
    try {
        // Check if all required classes are available
        if (typeof Game === 'undefined') {
            throw new Error('Game class not found. Make sure all scripts are loaded correctly.');
        }
        
        // Create and start the game
        console.log('Creating game instance...');
        const game = new Game();
        
        // Make game globally accessible for debugging (optional)
        window.game = game;
        
        console.log('Colony simulation initialized successfully');
    } catch (error) {
        console.error('Failed to initialize colony simulation:', error);
        
        // Show error message on the page
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            background: #e74c3c;
            color: white;
            padding: 15px;
            border-radius: 5px;
            z-index: 10000;
            max-width: 400px;
        `;
        errorDiv.innerHTML = `
            <h3>Game Initialization Error</h3>
            <p>${error.message}</p>
            <p>Check the console for more details.</p>
        `;
        document.body.appendChild(errorDiv);
        
        // Also log the full error stack
        console.error('Full error:', error);
    }
});
