class Game {
    constructor() {
        this.score = 0;
        this.target = null;
        this.options = [];
        this.gameState = 'playing'; // 'playing', 'success', 'storytelling'
        this.isGenerating = false;
        this.timer = null;
        this.geminiApiKey = ""; // Injected by user
        this.onStateChange = null;
    }

    init() {
        this.newRound();
    }

    newRound() {
        if (this.timer) clearTimeout(this.timer);
        this.gameState = 'playing';

        const randomTargetIndex = Math.floor(Math.random() * VOCABULARY.length);
        this.target = VOCABULARY[randomTargetIndex];

        let distractors = [];
        while (distractors.length < 2) {
            const randomIndex = Math.floor(Math.random() * VOCABULARY.length);
            const option = VOCABULARY[randomIndex];
            if (option.id !== this.target.id && !distractors.find(d => d.id === option.id)) {
                distractors.push(option);
            }
        }

        this.options = [this.target, ...distractors].sort(() => Math.random() - 0.5);

        if (this.onStateChange) this.onStateChange();
    }

    async callGemini(prompt) {
        if (!this.geminiApiKey) {
            console.warn("Gemini API Key not set. Hint/Story functionality will be limited.");
            return null;
        }
        this.isGenerating = true;
        if (this.onStateChange) this.onStateChange();

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                    }),
                }
            );

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error.message);
            }
            return data.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error("Gemini API Error:", error);
            return null;
        } finally {
            this.isGenerating = false;
            if (this.onStateChange) this.onStateChange();
        }
    }

    async generateClue() {
        if (!this.target || this.gameState !== 'playing' || this.isGenerating) return;
        const prompt = `You are a helpful assistant for a 3-year-old child. Write a very simple, fun, 5-8 word hint describing the sound or action of a "${this.target.word}". Do not use the word "${this.target.word}" in the hint. Keep it playful.`;

        const clue = await this.callGemini(prompt);
        if (clue) {
            this.speak(clue);
        } else {
            this.speak("Can you find it?");
        }
    }

    async generateStory() {
        if (!this.target || this.isGenerating) return;

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        this.gameState = 'storytelling';
        if (this.onStateChange) this.onStateChange();

        const prompt = `Write a cute, very short (2 sentences max) story for a 3-year-old about a friendly "${this.target.word}". Use simple words. Make it happy.`;
        const story = await this.callGemini(prompt);

        if (story) {
            this.speak(story);
        } else {
            this.gameState = 'success';
            if (this.onStateChange) this.onStateChange();
            this.speak("Good job!");
        }
    }

    handleOptionClick(option) {
        if (this.gameState !== 'playing') return;

        if (option.id === this.target.id) {
            this.gameState = 'success';
            this.score += 1;
            this.speak(`Yes! It's a ${this.target.word}!`);

            if (this.onStateChange) this.onStateChange();

            this.timer = setTimeout(() => {
                this.newRound();
            }, 4500);
        } else {
            this.speak(`Oops, that is a ${option.word}. Try again!`);
        }
    }

    speak(text, rate = 0.9) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = rate;
            utterance.pitch = 1.1;
            utterance.volume = 1;

            const voices = window.speechSynthesis.getVoices();
            // Try to find a nice child-friendly or natural voice
            const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Flo')))
                || voices.find(v => v.lang.startsWith('en') && !v.name.includes('Google') && !v.name.includes('Android'))
                || voices.find(v => v.lang.startsWith('en'));

            if (preferredVoice) utterance.voice = preferredVoice;

            window.speechSynthesis.speak(utterance);
        }
    }
}
