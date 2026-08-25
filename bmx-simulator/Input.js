const Input = {
    keys: {},
    pressed: new Set(),

    actionMap: {
        hop: ' ',
        respawn: 'r',
        mute: 'm',
        menu: 'escape',
        confirm: 'enter'
    },

    init() {
        window.addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();
            if (this.isTracked(k)) {
                if (!e.repeat) this.pressed.add(k);
                this.keys[k] = true;
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            const k = e.key.toLowerCase();
            if (this.isTracked(k)) {
                this.keys[k] = false;
                e.preventDefault();
            }
        });

        window.addEventListener('blur', () => {
            this.keys = {};
        });

        this.setupTouchControls();
    },

    isTracked(k) {
        return ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' '].includes(k) ||
            Object.values(this.actionMap).includes(k);
    },

    consume(action) {
        const k = this.actionMap[action];
        if (k != null && this.pressed.has(k)) {
            this.pressed.delete(k);
            return true;
        }
        return false;
    },

    clearFrame() {
        this.pressed.clear();
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

            const endJoystick = (e) => {
                e.preventDefault();
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === joystickId) {
                        joystickId = null;
                        this.resetJoystick(joystickKnob);
                        break;
                    }
                }
            };
            joystickZone.addEventListener('touchend', endJoystick, { passive: false });
            joystickZone.addEventListener('touchcancel', endJoystick, { passive: false });
        }

        const hopBtn = document.getElementById('btn-hop');
        if (hopBtn) {
            const down = (e) => {
                e.preventDefault();
                this.pressed.add(' ');
            };
            const up = (e) => {
                e.preventDefault();
            };
            hopBtn.addEventListener('touchstart', down, { passive: false });
            hopBtn.addEventListener('touchend', up, { passive: false });
            hopBtn.addEventListener('touchcancel', up, { passive: false });
            hopBtn.addEventListener('mousedown', down);
            hopBtn.addEventListener('mouseup', up);
        }

        document.getElementById('results-next')?.addEventListener('click', (e) => {
            e.currentTarget.blur();
            this.pressed.add('enter');
        });
        document.getElementById('results-menu')?.addEventListener('click', (e) => {
            e.currentTarget.blur();
            this.pressed.add('escape');
        });
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

    isUp() { return this.keys['arrowup'] || this.keys['w']; },
    isDown() { return this.keys['arrowdown'] || this.keys['s']; },
    isLeft() { return this.keys['arrowleft'] || this.keys['a']; },
    isRight() { return this.keys['arrowright'] || this.keys['d']; }
};
