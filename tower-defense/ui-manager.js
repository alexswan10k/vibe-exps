class UIManager {
    constructor(game) {
        this.game = game;

        this.livesDisplay = document.getElementById('lives-display');
        this.moneyDisplay = document.getElementById('money-display');
        this.waveDisplay = document.getElementById('wave-display');
        this.startWaveBtn = document.getElementById('start-wave-btn');
        this.gameOverModal = document.getElementById('game-over-modal');
        this.finalWaveSpan = document.getElementById('final-wave');
        this.restartBtn = document.getElementById('restart-btn');
        this.towerSelectors = document.querySelectorAll('.tower-selector');

        this.setupListeners();
    }

    setupListeners() {
        this.startWaveBtn.addEventListener('click', () => {
            this.game.startWave();
        });

        this.restartBtn.addEventListener('click', () => {
            this.game.restart();
            this.gameOverModal.classList.add('hidden');
        });

        this.towerSelectors.forEach(selector => {
            selector.addEventListener('click', () => {
                const type = selector.dataset.type;
                this.game.selectTowerType(type);
                this.updateSelectionUI(type);
            });
        });
    }

    updateSelectionUI(selectedType) {
        this.towerSelectors.forEach(selector => {
            if (selector.dataset.type === selectedType) {
                selector.classList.add('selected');
            } else {
                selector.classList.remove('selected');
            }
        });
    }

    update() {
        this.livesDisplay.textContent = this.game.lives;
        this.moneyDisplay.textContent = `$${this.game.money}`;
        this.waveDisplay.textContent = this.game.currentWave;

        if (this.game.waveActive) {
            this.startWaveBtn.disabled = true;
            this.startWaveBtn.textContent = 'Wave In Progress...';
        } else {
            this.startWaveBtn.disabled = false;
            this.startWaveBtn.textContent = 'Start Wave';
        }

        // Disable towers if cannot afford
        this.towerSelectors.forEach(selector => {
            const cost = parseInt(selector.dataset.cost);
            if (this.game.money < cost) {
                selector.classList.add('disabled');
            } else {
                selector.classList.remove('disabled');
            }
        });
    }

    showGameOver(wavesSurvived) {
        this.finalWaveSpan.textContent = wavesSurvived;
        this.gameOverModal.classList.remove('hidden');
    }
}