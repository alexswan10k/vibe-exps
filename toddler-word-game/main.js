document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    const ui = new UIManager(game);

    // Logic to handle API key
    // For now, let's look for it in localStorage or URL
    const apiKey = localStorage.getItem('GEMINI_API_KEY') || new URLSearchParams(window.location.search).get('apikey');
    if (apiKey) {
        game.geminiApiKey = apiKey;
    } else {
        console.info("To use AI hints/stories, set your Gemini API key in localStorage ('GEMINI_API_KEY') or via URL param '?apikey=...'.");
    }

    game.init();
});
