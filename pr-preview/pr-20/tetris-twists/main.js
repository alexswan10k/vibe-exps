window.onload = () => {
    // We instantiate components once they are all loaded.
    const canvas = document.getElementById('game-canvas');
    const nextCanvas = document.getElementById('next-piece-canvas');
    const ctx = canvas.getContext('2d');
    const nextCtx = nextCanvas.getContext('2d');

    const particleSystem = new ParticleSystem();
    const renderer = new Renderer(ctx, nextCtx, particleSystem);
    const board = new Board(particleSystem);

    // Pass everything into Game to orchestrate
    const game = new Game(board, renderer, particleSystem);
    game.init();
};
