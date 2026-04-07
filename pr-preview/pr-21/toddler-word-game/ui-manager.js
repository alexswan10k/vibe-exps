class UIManager {
    constructor(game) {
        this.game = game;
        this.game.onStateChange = () => this.render();

        this.scoreDisplay = document.getElementById('score-display-val');
        this.targetWord = document.getElementById('target-word');
        this.optionsGrid = document.getElementById('options-grid');
        this.clueBtn = document.getElementById('clue-btn');
        this.actionBar = document.getElementById('action-bar');
        this.confettiContainer = document.getElementById('confetti-container');

        this.initEvents();
    }

    initEvents() {
        this.clueBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.game.generateClue();
        });

        document.getElementById('speak-target-btn').addEventListener('click', () => {
            this.game.speak(this.game.target.word);
        });
    }

    render() {
        const { target, options, gameState, score, isGenerating } = this.game;

        // Update Score
        this.scoreDisplay.textContent = score;

        // Update Target Word
        this.targetWord.textContent = target ? target.word : 'Loading...';

        // Update Clue Button State
        this.clueBtn.style.display = gameState === 'playing' ? 'flex' : 'none';
        if (isGenerating && gameState === 'playing') {
            this.clueBtn.classList.add('loading');
            this.clueBtn.innerHTML = '<div class="spinner"></div>';
        } else {
            this.clueBtn.classList.remove('loading');
            this.clueBtn.innerHTML = '<i data-lucide="sparkles"></i>';
        }

        // Render Options
        this.optionsGrid.innerHTML = '';
        options.forEach(option => {
            const button = document.createElement('button');
            button.className = 'option-card';

            const isCorrect = (gameState === 'success' || gameState === 'storytelling') && option.id === target.id;
            const isWrong = (gameState === 'success' || gameState === 'storytelling') && option.id !== target.id;

            if (isCorrect) button.classList.add('correct');
            if (isWrong) button.classList.add('wrong');
            if (gameState !== 'playing') button.disabled = true;

            button.innerHTML = `
                <div class="icon-wrapper" style="color: ${option.color}">
                    <i data-lucide="${option.icon}" class="lucide-icon"></i>
                </div>
            `;

            button.onclick = () => this.game.handleOptionClick(option);
            this.optionsGrid.appendChild(button);
        });

        // Render Action Bar
        this.actionBar.innerHTML = '';
        if (gameState === 'success' || gameState === 'storytelling') {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'actions-container animate-in';

            if (gameState === 'success') {
                const storyBtn = document.createElement('button');
                storyBtn.className = 'btn-story';
                storyBtn.disabled = isGenerating;
                storyBtn.innerHTML = isGenerating
                    ? '<div class="spinner"></div><span>Making Magic...</span>'
                    : '<i data-lucide="book-open"></i><span>Story Time!</span><i data-lucide="sparkles"></i>';
                storyBtn.onclick = () => this.game.generateStory();
                actionsDiv.appendChild(storyBtn);
            }

            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn btn-indigo';
            nextBtn.innerHTML = '<span>Next</span><i data-lucide="arrow-right"></i>';
            nextBtn.onclick = () => this.game.newRound();
            actionsDiv.appendChild(nextBtn);

            this.actionBar.appendChild(actionsDiv);

            if (gameState === 'storytelling' && !isGenerating) {
                const indicator = document.createElement('div');
                indicator.className = 'story-indicator pulse';
                indicator.innerHTML = '<i data-lucide="volume-2"></i><span>Reading a story...</span>';
                this.actionBar.appendChild(indicator);
            }
        }

        // Confetti
        if (gameState === 'success' || gameState === 'storytelling') {
            this.showConfetti();
        } else {
            this.hideConfetti();
        }

        // Initialize Lucide Icons
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    showConfetti() {
        if (this.confettiContainer.children.length > 0) return;

        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
        for (let i = 0; i < 30; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.top = Math.random() * 100 + '%';
            confetti.style.animationDuration = (0.5 + Math.random()) + 's';
            confetti.style.animationDelay = Math.random() * 0.2 + 's';
            this.confettiContainer.appendChild(confetti);
        }
    }

    hideConfetti() {
        this.confettiContainer.innerHTML = '';
    }
}
