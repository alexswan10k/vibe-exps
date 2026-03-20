const Input = {
    keys: {
        ArrowUp: false,
        ArrowDown: false,
        ArrowLeft: false,
        ArrowRight: false,
        w: false,
        a: false,
        s: false,
        d: false
    },

    init() {
        window.addEventListener('keydown', (e) => {
            if (this.keys.hasOwnProperty(e.key)) {
                this.keys[e.key] = true;
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            if (this.keys.hasOwnProperty(e.key)) {
                this.keys[e.key] = false;
                e.preventDefault();
            }
        });
    },

    isUp() { return this.keys.ArrowUp || this.keys.w; },
    isDown() { return this.keys.ArrowDown || this.keys.s; },
    isLeft() { return this.keys.ArrowLeft || this.keys.a; },
    isRight() { return this.keys.ArrowRight || this.keys.d; }
};
