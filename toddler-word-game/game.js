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

        let clue = null;

        // Try API if key exists
        if (this.geminiApiKey) {
            const prompt = `You are a helpful assistant for a 3-year-old child. Write a very simple, fun, 5-8 word hint describing the sound or action of a "${this.target.word}". Do not use the word "${this.target.word}" in the hint. Keep it playful.`;
            clue = await this.callGemini(prompt);
        }

        // Fallback to static
        if (!clue) {
            clue = this.getStaticContent(STATIC_HINTS, GENERIC_HINT_TEMPLATES);
        }

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

        let story = null;

        // Try API if key exists
        if (this.geminiApiKey) {
            const prompt = `Write a cute, very short (2 sentences max) story for a 3-year-old about a friendly "${this.target.word}". Use simple words. Make it happy.`;
            story = await this.callGemini(prompt);
        }

        // Fallback to static
        if (!story) {
            // Simulate a brief delay so it feels like "making magic"
            await new Promise(r => setTimeout(r, 600));
            story = this.getStaticContent(STATIC_STORIES, GENERIC_STORY_TEMPLATES);
        }

        if (story) {
            this.speak(story);
        } else {
            this.gameState = 'success';
            if (this.onStateChange) this.onStateChange();
            this.speak("Good job!");
        }
    }

    getStaticContent(specificMap, genericTemplates) {
        const id = this.target.id;
        const word = this.target.word;
        const color = this.target.color; // Used in some templates

        let options = specificMap[id];
        if (!options || options.length === 0) {
            options = genericTemplates;
        }

        const template = options[Math.floor(Math.random() * options.length)];
        return template.replace(/{word}/g, word).replace(/{color}/g, this.getColorName(color));
    }

    getColorName(hex) {
        // Simple mapping for common tailwind-ish hexes if needed, or just return basic names
        // Since we don't have a huge map, we'll try to guess or return "pretty"
        // Actually, let's just use the hex or ignore it.
        // Better: return a generic "colorful" if unknown?
        // Let's make a tiny map for the specific colors we use
        const map = {
            '#ef4444': 'red', '#3b82f6': 'blue', '#b45309': 'brown', '#fb923c': 'orange',
            '#facc15': 'yellow', '#94a3b8': 'gray', '#eab308': 'gold', '#93c5fd': 'light blue',
            '#06b6d4': 'cyan', '#0ea5e9': 'sky blue', '#059669': 'green', '#818cf8': 'indigo',
            '#f43f5e': 'pink', '#a855f7': 'purple', '#2563eb': 'dark blue', '#14b8a6': 'teal',
            '#6b7280': 'gray', '#ec4899': 'pink', '#16a34a': 'green', '#a5b4fc': 'pale purple',
            '#f59e0b': 'amber', '#10b981': 'emerald', '#ea580c': 'orange', '#f472b6': 'pink',
            '#8b5cf6': 'violet', '#6366f1': 'blue', '#64748b': 'slate', '#475569': 'dark gray',
            '#22c55e': 'green', '#1e40af': 'blue', '#fb7185': 'pink', '#fbbf24': 'yellow',
        };
        return map[hex] || 'pretty';
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
