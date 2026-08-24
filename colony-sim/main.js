/**
 * Bootstrap: start the game once the DOM is ready.
 */
document.addEventListener('DOMContentLoaded', () => {
    try {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) throw new Error('Canvas element not found.');
        if (typeof Game === 'undefined') throw new Error('Game class missing — check script tags.');

        window.game = new Game(canvas);
    } catch (err) {
        console.error('Failed to initialize colony simulation:', err);

        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed; inset: auto 20px 20px auto; max-width: 420px;
            background: #7c2418; color: #fff; padding: 14px 18px;
            border-radius: 8px; z-index: 10000; font-family: monospace;
            box-shadow: 0 6px 24px rgba(0,0,0,.5);`;
        errorDiv.innerHTML = `<b>Failed to start</b><br>${err.message}`;
        document.body.appendChild(errorDiv);
    }
});
