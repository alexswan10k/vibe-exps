/**
 * Main entry point for the colony simulation game
 */

// Initialize the game when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create and start the game
    const game = new Game();

    // Make game globally accessible for debugging (optional)
    window.game = game;

    console.log('Colony simulation initialized successfully');
});
