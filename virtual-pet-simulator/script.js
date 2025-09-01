// Virtual Pet Simulator JavaScript

class VirtualPet {
    constructor() {
        this.hunger = 100;
        this.happiness = 100;
        this.energy = 100;
        this.careScore = 0;
        this.stage = 'Baby';
        this.sprites = {
            'Baby': '🐱',
            'Child': '🐈',
            'Teen': '😺',
            'Adult': '😸'
        };
        this.moods = {
            happy: ['Happy!', 'Content!', 'Joyful!'],
            neutral: ['Okay', 'Fine', 'Meh'],
            sad: ['Sad', 'Unhappy', 'Lonely']
        };
        this.init();
    }

    init() {
        this.updateUI();
        this.setupEventListeners();
        this.startTimers();
    }

    setupEventListeners() {
        document.getElementById('feed-btn').addEventListener('click', () => this.feed());
        document.getElementById('play-btn').addEventListener('click', () => this.play());
        document.getElementById('rest-btn').addEventListener('click', () => this.rest());
    }

    startTimers() {
        setInterval(() => {
            this.decreaseStats();
            this.updateUI();
        }, 5000); // Decrease every 5 seconds
    }

    decreaseStats() {
        this.hunger = Math.max(0, this.hunger - 5);
        this.happiness = Math.max(0, this.happiness - 3);
        this.energy = Math.max(0, this.energy - 4);
    }

    feed() {
        this.hunger = Math.min(100, this.hunger + 20);
        this.careScore += 5;
        this.updateEvolution();
        this.updateUI();
        this.showMood('happy');
    }

    play() {
        this.happiness = Math.min(100, this.happiness + 15);
        this.energy = Math.max(0, this.energy - 10);
        this.careScore += 5;
        this.updateEvolution();
        this.updateUI();
        this.showMood('happy');
    }

    rest() {
        this.energy = Math.min(100, this.energy + 25);
        this.careScore += 3;
        this.updateEvolution();
        this.updateUI();
        this.showMood('happy');
    }

    updateEvolution() {
        if (this.careScore >= 100 && this.stage === 'Baby') {
            this.stage = 'Child';
        } else if (this.careScore >= 200 && this.stage === 'Child') {
            this.stage = 'Teen';
        } else if (this.careScore >= 300 && this.stage === 'Teen') {
            this.stage = 'Adult';
        }
    }

    updateUI() {
        // Update bars
        document.getElementById('hunger-bar').style.width = `${this.hunger}%`;
        document.getElementById('happiness-bar').style.width = `${this.happiness}%`;
        document.getElementById('energy-bar').style.width = `${this.energy}%`;

        // Update values
        document.getElementById('hunger-value').textContent = this.hunger;
        document.getElementById('happiness-value').textContent = this.happiness;
        document.getElementById('energy-value').textContent = this.energy;

        // Update sprite
        document.querySelector('.pet-sprite').textContent = this.sprites[this.stage];

        // Update evolution
        document.getElementById('evolution').textContent = `Stage: ${this.stage}`;

        // Update mood
        this.updateMood();
    }

    updateMood() {
        const avgStat = (this.hunger + this.happiness + this.energy) / 3;
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
}

// Initialize the pet when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new VirtualPet();
});
