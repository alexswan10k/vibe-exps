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

        this.setupTouchControls();
    },

    setupTouchControls() {
        const btnToggle = document.getElementById('btn-toggle-touch');
        const touchControls = document.getElementById('touch-controls');
        let isTouchActive = false;

        if (!btnToggle || !touchControls) return;

        btnToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isTouchActive = !isTouchActive;
            touchControls.style.display = isTouchActive ? 'block' : 'none';
        });

        const joystickZone = document.getElementById('joystick-zone');
        const joystickKnob = document.getElementById('joystick-knob');
        let joystickId = null;
        let joystickCenter = { x: 0, y: 0 };

        if (joystickZone && joystickKnob) {
            joystickZone.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const touch = e.changedTouches[0];
                joystickId = touch.identifier;
                const rect = joystickZone.getBoundingClientRect();
                joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                this.updateJoystick(touch.clientX, touch.clientY, joystickKnob, joystickCenter);
            }, { passive: false });

            joystickZone.addEventListener('touchmove', (e) => {
                e.preventDefault();
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === joystickId) {
                        this.updateJoystick(e.changedTouches[i].clientX, e.changedTouches[i].clientY, joystickKnob, joystickCenter);
                        break;
                    }
                }
            }, { passive: false });

            joystickZone.addEventListener('touchend', (e) => {
                e.preventDefault();
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === joystickId) {
                        joystickId = null;
                        this.resetJoystick(joystickKnob);
                        break;
                    }
                }
            }, { passive: false });
        }
    },

    updateJoystick(x, y, knob, center) {
        const maxDist = 35;
        let dx = x - center.x;
        let dy = y - center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > maxDist) {
            const ratio = maxDist / dist;
            dx *= ratio;
            dy *= ratio;
        }

        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

        const threshold = 10;
        this.keys['w'] = dy < -threshold;
        this.keys['s'] = dy > threshold;
        this.keys['a'] = dx < -threshold;
        this.keys['d'] = dx > threshold;
    },

    resetJoystick(knob) {
        knob.style.transform = `translate(-50%, -50%)`;
        this.keys['w'] = false;
        this.keys['s'] = false;
        this.keys['a'] = false;
        this.keys['d'] = false;
    },

    isUp() { return this.keys.ArrowUp || this.keys.w; },
    isDown() { return this.keys.ArrowDown || this.keys.s; },
    isLeft() { return this.keys.ArrowLeft || this.keys.a; },
    isRight() { return this.keys.ArrowRight || this.keys.d; }
};
