class InputHandler {
    constructor() {
        this.keys = {};
        this.prevKeys = {};

        // Key mapping
        this.bindings = {
            'ArrowLeft': 'LEFT',
            'ArrowRight': 'RIGHT',
            'ArrowUp': 'UP',
            'ArrowDown': 'DOWN',
            'a': 'LEFT',
            'd': 'RIGHT',
            'w': 'UP',
            's': 'DOWN',
            ' ': 'JUMP',
            'Escape': 'PAUSE',
            'Shift': 'RUN'
        };

        this.actions = {
            LEFT: false,
            RIGHT: false,
            UP: false,
            DOWN: false,
            JUMP: false,
            PAUSE: false,
            RUN: false
        };

        this.pressed = {}; // Actions that were just pressed this frame

        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
    }

    onKeyDown(e) {
        const action = this.bindings[e.key];
        if (action) {
            this.keys[action] = true;
        }
    }

    onKeyUp(e) {
        const action = this.bindings[e.key];
        if (action) {
            this.keys[action] = false;
        }
    }

    update() {
        // Prepare pressed state for this frame
        for (const action in this.actions) {
            this.actions[action] = this.keys[action] || false;
            // "Pressed" is true only on the frame it goes from false to true
            this.pressed[action] = this.actions[action] && !this.prevKeys[action];

            this.prevKeys[action] = this.actions[action];
        }
    }

    isPressed(action) {
        return this.pressed[action];
    }

    isDown(action) {
        return this.actions[action];
    }
}
