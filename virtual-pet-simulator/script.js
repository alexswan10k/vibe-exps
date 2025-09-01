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

    reactionGame() {
        const startTime = Date.now();
        const delay = Math.random() * 3000 + 1000; // 1-4 seconds

        setTimeout(() => {
            const reactionTime = Date.now() - startTime;
            const userReaction = confirm("Click OK as fast as you can!");

            if (userReaction) {
                if (reactionTime < 500) {
                    this.happiness = Math.min(100, this.happiness + 30);
                    this.energy = Math.max(0, this.energy - 10);
                    this.careScore += 15;
                    alert("Amazing reflexes! Your pet is super excited!");
                    this.playSound('win');
                } else if (reactionTime < 1000) {
                    this.happiness = Math.min(100, this.happiness + 20);
                    this.energy = Math.max(0, this.energy - 12);
                    this.careScore += 10;
                    alert("Good reaction! Your pet enjoyed that!");
                    this.playSound('win');
                } else {
                    this.happiness = Math.min(100, this.happiness + 10);
                    this.energy = Math.max(0, this.energy - 15);
                    this.careScore += 5;
                    alert("Not bad! Your pet had fun!");
                    this.playSound('action');
                }
            } else {
                this.happiness = Math.max(0, this.happiness - 5);
                this.energy = Math.max(0, this.energy - 8);
                alert("Too slow! Your pet is a bit disappointed.");
                this.playSound('lose');
            }

            this.updateEvolution();
            this.updateUI();
        }, delay);
    }

    memoryGame() {
        const sequence = [];
        for (let i = 0; i < 4; i++) {
            sequence.push(Math.floor(Math.random() * 4) + 1);
        }

        let userSequence = [];
        let step = 0;

        const showSequence = () => {
            if (step < sequence.length) {
                alert(`Remember this number: ${sequence[step]}`);
                setTimeout(() => {
                    step++;
                    showSequence();
                }, 1000);
            } else {
                // Now ask for input
                for (let i = 0; i < sequence.length; i++) {
                    const guess = prompt(`Enter number ${i + 1}:`);
                    userSequence.push(parseInt(guess));
                }

                const correct = userSequence.every((num, index) => num === sequence[index]);

                if (correct) {
                    this.happiness = Math.min(100, this.happiness + 25);
                    this.energy = Math.max(0, this.energy - 15);
                    this.careScore += 12;
                    alert("Perfect memory! Your pet is impressed!");
                    this.playSound('win');
                } else {
                    this.happiness = Math.max(0, this.happiness - 8);
                    this.energy = Math.max(0, this.energy - 12);
                    alert(`Not quite! The sequence was: ${sequence.join(', ')}`);
                    this.playSound('lose');
                }

                this.updateEvolution();
                this.updateUI();
            }
        };

        showSequence();
    }

    patternGame() {
        const colors = ['Red', 'Blue', 'Green', 'Yellow'];
        const pattern = [];
        for (let i = 0; i < 3; i++) {
            pattern.push(colors[Math.floor(Math.random() * colors.length)]);
        }

        alert(`Watch the pattern: ${pattern.join(' -> ')}`);

        setTimeout(() => {
            const guess = prompt("What was the pattern? (e.g., Red -> Blue -> Green)");
            const userPattern = guess.split('->').map(s => s.trim());

            const correct = userPattern.length === pattern.length &&
                          userPattern.every((color, index) => color === pattern[index]);

            if (correct) {
                this.happiness = Math.min(100, this.happiness + 20);
                this.energy = Math.max(0, this.energy - 12);
                this.careScore += 10;
                alert("Great pattern recognition! Your pet loves learning!");
                this.playSound('win');
            } else {
                this.happiness = Math.max(0, this.happiness - 10);
                this.energy = Math.max(0, this.energy - 10);
                alert(`Close! The pattern was: ${pattern.join(' -> ')}`);
                this.playSound('lose');
            }

            this.updateEvolution();
            this.updateUI();
        }, 2000);
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
