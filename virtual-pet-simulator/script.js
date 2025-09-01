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

    miniGame() {
        if (this.energy < 20) {
            alert("Your pet is too tired to play a game!");
            return;
        }

        const number = Math.floor(Math.random() * 10) + 1;
        const guess = prompt("Guess a number between 1 and 10:");
        
        if (parseInt(guess) === number) {
            this.happiness = Math.min(100, this.happiness + 25);
            this.energy = Math.max(0, this.energy - 15);
            this.careScore += 10;
            alert("Correct! Your pet is thrilled!");
            this.playSound('win');
        } else {
            this.happiness = Math.max(0, this.happiness - 10);
            this.energy = Math.max(0, this.energy - 10);
            alert(`Wrong! The number was ${number}. Your pet is disappointed.`);
            this.playSound('lose');
        }
        
        this.updateEvolution();
        this.updateUI();
    }

    randomEvent() {
        const events = [
            { message: "Your pet found a shiny object!", effect: () => { this.happiness += 10; this.careScore += 5; } },
            { message: "Your pet got sick from poor cleanliness!", effect: () => { this.health -= 20; this.happiness -= 15; } },
            { message: "Your pet had a great dream!", effect: () => { this.energy += 15; this.happiness += 10; } },
            { message: "Your pet is feeling lonely!", effect: () => { this.happiness -= 10; } }
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
