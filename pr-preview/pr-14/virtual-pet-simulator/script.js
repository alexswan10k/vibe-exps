// Virtual Pet Simulator JavaScript

class VirtualPet {
    constructor() {
        this.hunger = 100;
        this.happiness = 100;
        this.energy = 100;
        this.cleanliness = 100;
        this.health = 100;
        this.careScore = 0;
        this.stage = 'Baby';
        this.sprites = {
            'Baby': '🐱',
            'Child': '🐈',
            'Teen': '😺',
            'Adult': '😸'
        };
        this.moods = {
            happy: ['Happy!', 'Content!', 'Joyful!', 'Excited!'],
            neutral: ['Okay', 'Fine', 'Meh', 'Calm'],
            sad: ['Sad', 'Unhappy', 'Lonely', 'Tired']
        };
        this.loadGame();
        this.init();
    }

    init() {
        this.updateUI();
        this.setupEventListeners();
        this.startTimers();
        this.playSound('start');
    }

    setupEventListeners() {
        document.getElementById('feed-btn').addEventListener('click', () => this.feed());
        document.getElementById('play-btn').addEventListener('click', () => this.play());
        document.getElementById('rest-btn').addEventListener('click', () => this.rest());
        document.getElementById('clean-btn').addEventListener('click', () => this.clean());
        document.getElementById('game-btn').addEventListener('click', () => this.miniGame());
        document.getElementById('walk-btn').addEventListener('click', () => this.walk());
        document.getElementById('trick-btn').addEventListener('click', () => this.teachTrick());
        document.getElementById('treat-btn').addEventListener('click', () => this.giveTreat());
        document.getElementById('vet-btn').addEventListener('click', () => this.visitVet());
    }

    startTimers() {
        setInterval(() => {
            this.decreaseStats();
            this.updateUI();
            this.saveGame();
        }, 5000); // Decrease every 5 seconds

        // Random events every 30-60 seconds
        setInterval(() => {
            if (Math.random() < 0.3) { // 30% chance
                this.randomEvent();
            }
        }, Math.random() * 30000 + 30000);
    }

    decreaseStats() {
        this.hunger = Math.max(0, this.hunger - 5);
        this.happiness = Math.max(0, this.happiness - 3);
        this.energy = Math.max(0, this.energy - 4);
        this.cleanliness = Math.max(0, this.cleanliness - 2);
        this.health = Math.max(0, this.health - 1);

        // Health affected by cleanliness
        if (this.cleanliness < 30) {
            this.health = Math.max(0, this.health - 2);
        }
    }

    feed() {
        this.hunger = Math.min(100, this.hunger + 20);
        this.careScore += 5;
        this.updateEvolution();
        this.updateUI();
        this.showMood('happy');
        this.playSound('action');
    }

    play() {
        this.happiness = Math.min(100, this.happiness + 15);
        this.energy = Math.max(0, this.energy - 10);
        this.careScore += 5;
        this.updateEvolution();
        this.updateUI();
        this.showMood('happy');
        this.playSound('action');
    }

    rest() {
        this.energy = Math.min(100, this.energy + 25);
        this.careScore += 3;
        this.updateEvolution();
        this.updateUI();
        this.showMood('happy');
        this.playSound('action');
    }

    clean() {
        this.cleanliness = Math.min(100, this.cleanliness + 30);
        this.happiness = Math.min(100, this.happiness + 5);
        this.careScore += 4;
        this.updateEvolution();
        this.updateUI();
        this.showMood('happy');
        this.playSound('action');
    }

    walk() {
        if (this.energy < 15) {
            alert("Your pet is too tired to go for a walk!");
            return;
        }

        this.happiness = Math.min(100, this.happiness + 20);
        this.energy = Math.max(0, this.energy - 15);
        this.health = Math.min(100, this.health + 5);
        this.careScore += 8;
        this.updateEvolution();
        this.updateUI();
        this.showMood('happy');
        this.playSound('action');

        // Chance of finding something during walk
        if (Math.random() < 0.3) {
            setTimeout(() => {
                alert("Your pet found a stick during the walk!");
                this.happiness = Math.min(100, this.happiness + 10);
                this.careScore += 3;
                this.updateUI();
            }, 1000);
        }
    }

    teachTrick() {
        if (this.energy < 10) {
            alert("Your pet is too tired to learn a trick!");
            return;
        }

        const tricks = ["Sit", "Roll over", "Play dead", "Shake paw", "Fetch"];
        const trick = tricks[Math.floor(Math.random() * tricks.length)];

        if (Math.random() < 0.7) { // 70% success rate
            this.happiness = Math.min(100, this.happiness + 15);
            this.energy = Math.max(0, this.energy - 10);
            this.careScore += 12;
            alert(`Success! Your pet learned to ${trick.toLowerCase()}!`);
            this.playSound('win');
        } else {
            this.happiness = Math.max(0, this.happiness - 5);
            this.energy = Math.max(0, this.energy - 8);
            alert(`Your pet didn't quite get the ${trick.toLowerCase()} trick. Try again later!`);
            this.playSound('lose');
        }

        this.updateEvolution();
        this.updateUI();
        this.showMood('happy');
    }

    giveTreat() {
        if (this.hunger >= 80) {
            alert("Your pet isn't hungry enough for a treat!");
            return;
        }

        this.hunger = Math.min(100, this.hunger + 15);
        this.happiness = Math.min(100, this.happiness + 25);
        this.energy = Math.min(100, this.energy + 5);
        this.careScore += 6;

        // But treats have consequences
        if (Math.random() < 0.4) { // 40% chance of getting hyper
            setTimeout(() => {
                alert("The treat made your pet hyper!");
                this.energy = Math.min(100, this.energy + 20);
                this.happiness = Math.min(100, this.happiness + 10);
                this.updateUI();
            }, 2000);
        }

        this.updateEvolution();
        this.updateUI();
        this.showMood('happy');
        this.playSound('action');
    }

    visitVet() {
        if (this.health >= 90) {
            alert("Your pet is healthy! No need for a vet visit.");
            return;
        }

        if (this.careScore < 20) {
            alert("You don't have enough care points for a vet visit!");
            return;
        }

        this.health = Math.min(100, this.health + 40);
        this.happiness = Math.max(0, this.happiness - 5); // Vet visits are stressful
        this.careScore -= 20; // Costs care points

        alert("Vet visit complete! Your pet's health has improved significantly.");
        this.updateEvolution();
        this.updateUI();
        this.showMood('neutral');
        this.playSound('action');
    }

    miniGame() {
        if (this.energy < 20) {
            alert("Your pet is too tired to play a game!");
            return;
        }

        // Choose random minigame
        const games = ['reaction', 'memory', 'pattern'];
        const gameType = games[Math.floor(Math.random() * games.length)];

        switch(gameType) {
            case 'reaction':
                this.reactionGame();
                break;
            case 'memory':
                this.memoryGame();
                break;
            case 'pattern':
                this.patternGame();
                break;
        }
    }

    createGameModal(title, content) {
        // Remove existing modal if any
        const existingModal = document.getElementById('game-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal overlay
        const modal = document.createElement('div');
        modal.id = 'game-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            font-family: 'Courier New', monospace;
        `;

        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: #FFFACD;
            border: 4px solid #8B4513;
            border-radius: 8px;
            padding: 20px;
            max-width: 400px;
            width: 90%;
            text-align: center;
            box-shadow: 0 8px 16px rgba(0,0,0,0.3);
        `;

        // Add title
        const modalTitle = document.createElement('h2');
        modalTitle.textContent = title;
        modalTitle.style.cssText = `
            color: #8B4513;
            margin-bottom: 20px;
            font-size: 18px;
        `;

        // Add content
        const modalBody = document.createElement('div');
        modalBody.innerHTML = content;

        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '❌ Close';
        closeBtn.style.cssText = `
            background: #FF6347;
            border: 2px solid #8B4513;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            margin-top: 20px;
        `;
        closeBtn.onclick = () => modal.remove();

        modalContent.appendChild(modalTitle);
        modalContent.appendChild(modalBody);
        modalContent.appendChild(closeBtn);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        return { modal, modalBody, closeBtn };
    }

    reactionGame() {
        const { modal, modalBody } = this.createGameModal('⚡ Reaction Game', '<p>Get ready to click as fast as you can!</p><div id="reaction-wait">Wait for the signal...</div>');

        const delay = Math.random() * 3000 + 1000; // 1-4 seconds
        const startTime = Date.now() + delay;

        setTimeout(() => {
            const waitDiv = document.getElementById('reaction-wait');
            waitDiv.innerHTML = '<button id="reaction-btn" style="font-size: 24px; padding: 20px; background: #FFD700; border: 3px solid #FF6347;">CLICK NOW! 🚀</button>';

            const reactionBtn = document.getElementById('reaction-btn');
            reactionBtn.onclick = () => {
                const reactionTime = Date.now() - startTime;

                if (reactionTime < 500) {
                    this.happiness = Math.min(100, this.happiness + 30);
                    this.energy = Math.max(0, this.energy - 10);
                    this.careScore += 15;
                    waitDiv.innerHTML = '<p style="color: #32CD32; font-size: 18px;">🎉 Amazing reflexes!<br>Your pet is super excited!</p>';
                    this.playSound('win');
                } else if (reactionTime < 1000) {
                    this.happiness = Math.min(100, this.happiness + 20);
                    this.energy = Math.max(0, this.energy - 12);
                    this.careScore += 10;
                    waitDiv.innerHTML = '<p style="color: #32CD32; font-size: 18px;">👍 Good reaction!<br>Your pet enjoyed that!</p>';
                    this.playSound('win');
                } else {
                    this.happiness = Math.min(100, this.happiness + 10);
                    this.energy = Math.max(0, this.energy - 15);
                    this.careScore += 5;
                    waitDiv.innerHTML = '<p style="color: #FFD700; font-size: 18px;">👌 Not bad!<br>Your pet had fun!</p>';
                    this.playSound('action');
                }

                this.updateEvolution();
                this.updateUI();

                setTimeout(() => modal.remove(), 2000);
            };
        }, delay);
    }

    memoryGame() {
        const sequence = [];
        for (let i = 0; i < 4; i++) {
            sequence.push(Math.floor(Math.random() * 4) + 1);
        }

        const { modal, modalBody } = this.createGameModal('🧠 Memory Game', '<div id="memory-content"><p>Watch the sequence...</p><div id="sequence-display"></div></div>');

        let step = 0;
        const displayDiv = document.getElementById('sequence-display');

        const showSequence = () => {
            if (step < sequence.length) {
                displayDiv.textContent = sequence[step];
                displayDiv.style.cssText = 'font-size: 48px; color: #FF6347; margin: 20px;';
                setTimeout(() => {
                    displayDiv.textContent = '?';
                    setTimeout(() => {
                        step++;
                        showSequence();
                    }, 500);
                }, 1000);
            } else {
                // Now show input buttons
                const contentDiv = document.getElementById('memory-content');
                contentDiv.innerHTML = '<p>Click the numbers in the correct order:</p><div id="number-buttons"></div><div id="user-sequence"></div>';

                const buttonContainer = document.getElementById('number-buttons');
                const userSeqDiv = document.getElementById('user-sequence');

                // Create number buttons
                for (let i = 1; i <= 4; i++) {
                    const btn = document.createElement('button');
                    btn.textContent = i;
                    btn.style.cssText = 'font-size: 24px; padding: 15px; margin: 5px; background: #FFD700; border: 2px solid #8B4513; border-radius: 8px; cursor: pointer;';
                    btn.onclick = () => {
                        userSeqDiv.textContent += i + ' ';
                        if (userSeqDiv.textContent.trim().split(' ').length === sequence.length) {
                            const userSequence = userSeqDiv.textContent.trim().split(' ').map(n => parseInt(n));
                            const correct = userSequence.every((num, index) => num === sequence[index]);

                            if (correct) {
                                this.happiness = Math.min(100, this.happiness + 25);
                                this.energy = Math.max(0, this.energy - 15);
                                this.careScore += 12;
                                contentDiv.innerHTML = '<p style="color: #32CD32; font-size: 18px;">🎉 Perfect memory!<br>Your pet is impressed!</p>';
                                this.playSound('win');
                            } else {
                                this.happiness = Math.max(0, this.happiness - 8);
                                this.energy = Math.max(0, this.energy - 12);
                                contentDiv.innerHTML = `<p style="color: #FF6347; font-size: 16px;">Not quite! The sequence was:<br><strong>${sequence.join(' ')}</strong></p>`;
                                this.playSound('lose');
                            }

                            this.updateEvolution();
                            this.updateUI();
                            setTimeout(() => modal.remove(), 3000);
                        }
                    };
                    buttonContainer.appendChild(btn);
                }
            }
        };

        showSequence();
    }

    patternGame() {
        const colors = ['Red', 'Blue', 'Green', 'Yellow'];
        const colorStyles = {
            'Red': '#FF6347',
            'Blue': '#4169E1',
            'Green': '#32CD32',
            'Yellow': '#FFD700'
        };

        const pattern = [];
        for (let i = 0; i < 3; i++) {
            pattern.push(colors[Math.floor(Math.random() * colors.length)]);
        }

        const { modal, modalBody } = this.createGameModal('🎨 Pattern Game', '<div id="pattern-content"><p>Watch the pattern...</p><div id="pattern-display"></div></div>');

        let step = 0;
        const displayDiv = document.getElementById('pattern-display');

        const showPattern = () => {
            if (step < pattern.length) {
                displayDiv.textContent = pattern[step];
                displayDiv.style.cssText = `font-size: 48px; color: ${colorStyles[pattern[step]]}; margin: 20px; text-shadow: 2px 2px 0px #000;`;
                setTimeout(() => {
                    displayDiv.textContent = '?';
                    displayDiv.style.color = '#666';
                    setTimeout(() => {
                        step++;
                        showPattern();
                    }, 500);
                }, 1200);
            } else {
                // Now show color buttons
                const contentDiv = document.getElementById('pattern-content');
                contentDiv.innerHTML = '<p>Click the colors in the correct order:</p><div id="color-buttons"></div><div id="user-pattern" style="margin-top: 15px; font-size: 18px;"></div>';

                const buttonContainer = document.getElementById('color-buttons');
                const userPatternDiv = document.getElementById('user-pattern');

                // Create color buttons
                colors.forEach(color => {
                    const btn = document.createElement('button');
                    btn.textContent = '●';
                    btn.style.cssText = `font-size: 36px; padding: 15px; margin: 5px; background: ${colorStyles[color]}; border: 3px solid #8B4513; border-radius: 50%; cursor: pointer; width: 60px; height: 60px;`;
                    btn.onclick = () => {
                        userPatternDiv.innerHTML += `<span style="color: ${colorStyles[color]}; margin: 0 5px;">●</span>`;
                        const currentPattern = Array.from(userPatternDiv.children).map(span => {
                            const bgColor = span.style.color;
                            return Object.keys(colorStyles).find(key => colorStyles[key] === bgColor);
                        });

                        if (currentPattern.length === pattern.length) {
                            const correct = currentPattern.every((color, index) => color === pattern[index]);

                            if (correct) {
                                this.happiness = Math.min(100, this.happiness + 20);
                                this.energy = Math.max(0, this.energy - 12);
                                this.careScore += 10;
                                contentDiv.innerHTML = '<p style="color: #32CD32; font-size: 18px;">🎉 Great pattern recognition!<br>Your pet loves learning!</p>';
                                this.playSound('win');
                            } else {
                                this.happiness = Math.max(0, this.happiness - 10);
                                this.energy = Math.max(0, this.energy - 10);
                                const correctPattern = pattern.map(color => `<span style="color: ${colorStyles[color]};">●</span>`).join(' ');
                                contentDiv.innerHTML = `<p style="color: #FF6347; font-size: 16px;">Close! The pattern was:<br>${correctPattern}</p>`;
                                this.playSound('lose');
                            }

                            this.updateEvolution();
                            this.updateUI();
                            setTimeout(() => modal.remove(), 3000);
                        }
                    };
                    buttonContainer.appendChild(btn);
                });
            }
        };

        showPattern();
    }

    randomEvent() {
        const events = [
            { message: "Your pet found a shiny object!", effect: () => { this.happiness += 10; this.careScore += 5; } },
            { message: "Your pet got sick from poor cleanliness!", effect: () => { this.health -= 20; this.happiness -= 15; } },
            { message: "Your pet had a great dream!", effect: () => { this.energy += 15; this.happiness += 10; } },
            { message: "Your pet is feeling lonely!", effect: () => { this.happiness -= 10; } },
            { message: "Your pet discovered a new favorite toy!", effect: () => { this.happiness += 15; this.energy += 5; } },
            { message: "Your pet made a new friend in the neighborhood!", effect: () => { this.happiness += 12; this.careScore += 8; } },
            { message: "Your pet learned a new word!", effect: () => { this.happiness += 8; this.careScore += 6; } },
            { message: "Your pet had an adventure and got a bit dirty!", effect: () => { this.cleanliness -= 15; this.happiness += 10; } },
            { message: "Your pet found some extra food!", effect: () => { this.hunger += 15; this.careScore += 3; } },
            { message: "Your pet is showing off its tricks!", effect: () => { this.happiness += 12; this.energy -= 5; } },
            { message: "Your pet got into mischief and needs attention!", effect: () => { this.happiness -= 8; this.cleanliness -= 10; } },
            { message: "Your pet received a surprise visit from family!", effect: () => { this.happiness += 20; this.energy += 10; } }
        ];

        const event = events[Math.floor(Math.random() * events.length)];
        alert(event.message);
        event.effect();
        this.updateUI();
        this.playSound('event');
    }

    updateEvolution() {
        if (this.careScore >= 100 && this.stage === 'Baby') {
            this.stage = 'Child';
            this.playSound('evolve');
        } else if (this.careScore >= 200 && this.stage === 'Child') {
            this.stage = 'Teen';
            this.playSound('evolve');
        } else if (this.careScore >= 300 && this.stage === 'Teen') {
            this.stage = 'Adult';
            this.playSound('evolve');
        }
    }

    updateUI() {
        // Update bars
        document.getElementById('hunger-bar').style.width = `${this.hunger}%`;
        document.getElementById('happiness-bar').style.width = `${this.happiness}%`;
        document.getElementById('energy-bar').style.width = `${this.energy}%`;
        document.getElementById('cleanliness-bar').style.width = `${this.cleanliness}%`;
        document.getElementById('health-bar').style.width = `${this.health}%`;

        // Update values
        document.getElementById('hunger-value').textContent = this.hunger;
        document.getElementById('happiness-value').textContent = this.happiness;
        document.getElementById('energy-value').textContent = this.energy;
        document.getElementById('cleanliness-value').textContent = this.cleanliness;
        document.getElementById('health-value').textContent = this.health;

        // Update sprite
        document.querySelector('.pet-sprite').textContent = this.sprites[this.stage];

        // Update evolution
        document.getElementById('evolution').textContent = `Stage: ${this.stage}`;

        // Update mood
        this.updateMood();
    }

    updateMood() {
        const avgStat = (this.hunger + this.happiness + this.energy + this.cleanliness + this.health) / 5;
        let moodType;
        if (avgStat >= 70) {
            moodType = 'happy';
        } else if (avgStat >= 40) {
            moodType = 'neutral';
        } else {
            moodType = 'sad';
        }
        this.showMood(moodType);
    }

    showMood(type) {
        const moods = this.moods[type];
        const randomMood = moods[Math.floor(Math.random() * moods.length)];
        document.getElementById('mood').textContent = randomMood;
    }

    playSound(type) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        switch(type) {
            case 'start':
                oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
                oscillator.frequency.setValueAtTime(660, audioContext.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
                break;
            case 'action':
                oscillator.frequency.setValueAtTime(523, audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.2);
                break;
            case 'win':
                oscillator.frequency.setValueAtTime(523, audioContext.currentTime);
                oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1);
                oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2);
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
                break;
            case 'lose':
                oscillator.frequency.setValueAtTime(392, audioContext.currentTime);
                oscillator.frequency.setValueAtTime(330, audioContext.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.2);
                break;
            case 'evolve':
                oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
                oscillator.frequency.setValueAtTime(554, audioContext.currentTime + 0.1);
                oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.2);
                oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.3);
                gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.4);
                break;
            case 'event':
                oscillator.frequency.setValueAtTime(294, audioContext.currentTime);
                oscillator.frequency.setValueAtTime(370, audioContext.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.2);
                break;
        }
    }

    saveGame() {
        const gameState = {
            hunger: this.hunger,
            happiness: this.happiness,
            energy: this.energy,
            cleanliness: this.cleanliness,
            health: this.health,
            careScore: this.careScore,
            stage: this.stage
        };
        localStorage.setItem('virtualPet', JSON.stringify(gameState));
    }

    loadGame() {
        const saved = localStorage.getItem('virtualPet');
        if (saved) {
            const gameState = JSON.parse(saved);
            this.hunger = gameState.hunger || 100;
            this.happiness = gameState.happiness || 100;
            this.energy = gameState.energy || 100;
            this.cleanliness = gameState.cleanliness || 100;
            this.health = gameState.health || 100;
            this.careScore = gameState.careScore || 0;
            this.stage = gameState.stage || 'Baby';
        }
    }
}

// Initialize the pet when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new VirtualPet();
});
