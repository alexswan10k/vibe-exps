class UI {
    constructor(entityManager) {
        this.entityManager = entityManager;
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('btn-spawn-crate').addEventListener('click', () => {
            const camX = -window.game.render.bounds.min.x + window.innerWidth / 2;
            // Wait, render.bounds.min.x IS the left coordinate.
            // Center of screen X = bounds.min.x + (width/2)
            const x = window.game.render.bounds.min.x + window.innerWidth / 2;
            const y = window.game.render.bounds.min.y + window.innerHeight / 3;

            this.entityManager.spawnDestructibleCrate(x, y);
        });

        document.getElementById('btn-spawn-box').addEventListener('click', () => {
            const x = window.game.render.bounds.min.x + window.innerWidth / 2;
            const y = window.game.render.bounds.min.y + window.innerHeight / 3;
            this.entityManager.spawnBox(x, y);
        });

        document.getElementById('btn-clear').addEventListener('click', () => {
            this.entityManager.clearAll();
        });
    }
}
