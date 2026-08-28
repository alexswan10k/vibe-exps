// Arcade HUD Dashboard, Minimap, Touch Controls & Settings UI
class UIManager {
    constructor(callbacks) {
        this.callbacks = callbacks;

        this.speedGaugeCanvas = document.getElementById('gauge-canvas');
        this.speedGaugeCtx = this.speedGaugeCanvas ? this.speedGaugeCanvas.getContext('2d') : null;

        this.minimapCanvas = document.getElementById('minimap-canvas');
        this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;

        this.stuntBanner = document.getElementById('stunt-banner');
        this.driftScoreEl = document.getElementById('drift-score');
        this.driftMultiplierEl = document.getElementById('drift-multiplier');
        this.nitroBarFill = document.getElementById('nitro-fill');
        this.healthBarFill = document.getElementById('health-fill');
        this.gearEl = document.getElementById('gear-val');
        this.speedDigitalEl = document.getElementById('speed-digital');
        this.stationTicker = document.getElementById('station-ticker');
        this.challengeTimerEl = document.getElementById('challenge-timer');

        this.touchKeys = {};
        this.initTouch();
        this.initButtons();
    }

    showBanner(text, durationMs = 2500) {
        if (!this.stuntBanner) return;
        this.stuntBanner.textContent = text;
        this.stuntBanner.classList.add('visible');
        clearTimeout(this.bannerTimer);
        this.bannerTimer = setTimeout(() => {
            if (this.stuntBanner) this.stuntBanner.classList.remove('visible');
        }, durationMs);
    }

    initButtons() {
        // Car Selector buttons
        document.querySelectorAll('.btn-car-select').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = parseInt(e.currentTarget.dataset.car, 10);
                document.querySelectorAll('.btn-car-select').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                if (this.callbacks.onSelectCar) this.callbacks.onSelectCar(type);
            });
        });

        // Camera Toggle
        const btnCam = document.getElementById('btn-cam');
        if (btnCam) {
            btnCam.addEventListener('click', () => {
                if (this.callbacks.onToggleCam) {
                    const camName = this.callbacks.onToggleCam();
                    btnCam.textContent = `📷 ${camName}`;
                }
            });
        }

        // Weather Toggle
        const btnWeather = document.getElementById('btn-weather');
        if (btnWeather) {
            btnWeather.addEventListener('click', () => {
                if (this.callbacks.onToggleWeather) {
                    const wName = this.callbacks.onToggleWeather();
                    btnWeather.textContent = `☀️ ${wName}`;
                }
            });
        }

        // Radio Toggle
        const btnRadio = document.getElementById('btn-radio');
        if (btnRadio) {
            btnRadio.addEventListener('click', () => {
                if (this.callbacks.onCycleRadio) {
                    const rName = this.callbacks.onCycleRadio();
                    if (this.stationTicker) this.stationTicker.textContent = `📻 ${rName}`;
                }
            });
        }

        // Reset Car
        const btnReset = document.getElementById('btn-reset-top');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                if (this.callbacks.onReset) this.callbacks.onReset();
            });
        }

        // Challenge Selector
        const selectChallenge = document.getElementById('select-challenge');
        if (selectChallenge) {
            selectChallenge.addEventListener('change', (e) => {
                if (this.callbacks.onSelectChallenge) {
                    this.callbacks.onSelectChallenge(e.target.value);
                }
            });
        }

        // Help Modal Toggle
        const btnHelp = document.getElementById('btn-help');
        const helpModal = document.getElementById('help-modal');
        const btnCloseHelp = document.getElementById('btn-close-help');
        if (btnHelp && helpModal) {
            btnHelp.addEventListener('click', () => {
                helpModal.classList.toggle('open');
            });
        }
        if (btnCloseHelp && helpModal) {
            btnCloseHelp.addEventListener('click', () => {
                helpModal.classList.remove('open');
            });
        }
    }

    initTouch() {
        const bindButton = (id, keyName) => {
            const el = document.getElementById(id);
            if (!el) return;
            const start = (e) => {
                e.preventDefault();
                this.touchKeys[keyName] = true;
                el.classList.add('pressed');
            };
            const end = (e) => {
                e.preventDefault();
                this.touchKeys[keyName] = false;
                el.classList.remove('pressed');
            };
            el.addEventListener('touchstart', start, { passive: false });
            el.addEventListener('touchend', end, { passive: false });
            el.addEventListener('touchcancel', end, { passive: false });
            el.addEventListener('mousedown', start);
            el.addEventListener('mouseup', end);
            el.addEventListener('mouseleave', end);
        };

        bindButton('btn-touch-gas', 'KeyW');
        bindButton('btn-touch-brake', 'KeyS');
        bindButton('btn-touch-nitro', 'ShiftLeft');
        bindButton('btn-touch-handbrake', 'Space');
        bindButton('btn-touch-left', 'KeyA');
        bindButton('btn-touch-right', 'KeyD');

        // Touch Joystick Support
        const joystickZone = document.getElementById('joystick-zone');
        const joystickKnob = document.getElementById('joystick-knob');
        if (joystickZone && joystickKnob) {
            let activeTouchId = null;

            const handleMove = (clientX, clientY) => {
                const rect = joystickZone.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                const maxR = 36;
                let dx = clientX - centerX;
                let dy = clientY - centerY;
                const dist = Math.hypot(dx, dy);

                if (dist > maxR) {
                    dx = (dx / dist) * maxR;
                    dy = (dy / dist) * maxR;
                }

                joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

                const deadzone = 8;
                this.touchKeys['KeyA'] = dx < -deadzone;
                this.touchKeys['KeyD'] = dx > deadzone;
                this.touchKeys['KeyW'] = dy < -deadzone;
                this.touchKeys['KeyS'] = dy > deadzone;
            };

            const resetJoy = () => {
                activeTouchId = null;
                joystickKnob.style.transform = `translate(-50%, -50%)`;
                this.touchKeys['KeyA'] = false;
                this.touchKeys['KeyD'] = false;
                this.touchKeys['KeyW'] = false;
                this.touchKeys['KeyS'] = false;
            };

            joystickZone.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const t = e.changedTouches[0];
                activeTouchId = t.identifier;
                handleMove(t.clientX, t.clientY);
            }, { passive: false });

            joystickZone.addEventListener('touchmove', (e) => {
                e.preventDefault();
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === activeTouchId) {
                        handleMove(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
                        break;
                    }
                }
            }, { passive: false });

            joystickZone.addEventListener('touchend', resetJoy, { passive: false });
            joystickZone.addEventListener('touchcancel', resetJoy, { passive: false });
        }
    }

    renderGauges(speedKmh, rpm, maxRpm = 7500) {
        if (!this.speedGaugeCtx) return;
        const ctx = this.speedGaugeCtx;
        const w = this.speedGaugeCanvas.width;
        const h = this.speedGaugeCanvas.height;
        const cx = w / 2;
        const cy = h / 2 + 10;
        const r = 85;

        ctx.clearRect(0, 0, w, h);

        // Background gauge arc
        const startAngle = Math.PI * 0.75;
        const endAngle = Math.PI * 2.25;

        ctx.beginPath();
        ctx.arc(cx, cy, r, startAngle, endAngle);
        ctx.strokeStyle = '#1e2430';
        ctx.lineWidth = 14;
        ctx.stroke();

        // RPM Active Glow Arc
        const rpmFraction = Math.min(1.0, Math.max(0, (rpm - 800) / (maxRpm - 800)));
        const currentRpmAngle = startAngle + rpmFraction * (endAngle - startAngle);

        const gradient = ctx.createLinearGradient(0, h, w, 0);
        gradient.addColorStop(0, '#00f3ff');
        gradient.addColorStop(0.7, '#00ff66');
        gradient.addColorStop(0.9, '#ffcc00');
        gradient.addColorStop(1.0, '#ff0055');

        ctx.beginPath();
        ctx.arc(cx, cy, r, startAngle, currentRpmAngle);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 14;
        ctx.stroke();

        // Tick marks
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        for (let i = 0; i <= 8; i++) {
            const angle = startAngle + (i / 8) * (endAngle - startAngle);
            const x1 = cx + Math.cos(angle) * (r - 12);
            const y1 = cy + Math.sin(angle) * (r - 12);
            const x2 = cx + Math.cos(angle) * (r - 2);
            const y2 = cy + Math.sin(angle) * (r - 2);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        // Needle
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(currentRpmAngle);
        ctx.strokeStyle = '#ff1744';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(r - 5, 0);
        ctx.stroke();
        ctx.restore();

        // Center hub
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
    }

    renderMinimap(playerChassis, trafficVehicles, checkpoints, activeCpIndex) {
        if (!this.minimapCtx) return;
        const ctx = this.minimapCtx;
        const w = this.minimapCanvas.width;
        const h = this.minimapCanvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const scale = 0.28; // scale factor

        // Clear radar
        ctx.fillStyle = '#0a0d14';
        ctx.fillRect(0, 0, w, h);

        const pX = playerChassis ? playerChassis.position.x : 0;
        const pZ = playerChassis ? playerChassis.position.z : 0;

        ctx.save();
        ctx.translate(cx, cy);

        // Draw Road Grid around player
        ctx.strokeStyle = '#1e2838';
        ctx.lineWidth = 6;
        for (let ix = -3; ix <= 3; ix++) {
            const gx = ix * 104 - pX * scale;
            ctx.beginPath();
            ctx.moveTo(gx, -cy);
            ctx.lineTo(gx, cy);
            ctx.stroke();
        }
        for (let iz = -3; iz <= 3; iz++) {
            const gz = iz * 104 - pZ * scale;
            ctx.beginPath();
            ctx.moveTo(-cx, gz);
            ctx.lineTo(cx, gz);
            ctx.stroke();
        }

        // Draw Checkpoint Race Ring on Minimap
        if (checkpoints && activeCpIndex !== undefined) {
            const cp = checkpoints[activeCpIndex];
            if (cp) {
                const cpX = (cp.x - pX) * scale;
                const cpZ = (cp.z - pZ) * scale;
                ctx.fillStyle = '#00ff66';
                ctx.beginPath();
                ctx.arc(cpX, cpZ, 6, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Draw Traffic Vehicles
        if (trafficVehicles) {
            ctx.fillStyle = '#ffaa00';
            trafficVehicles.forEach(tv => {
                const tx = (tv.mesh.position.x - pX) * scale;
                const tz = (tv.mesh.position.z - pZ) * scale;
                if (Math.abs(tx) < cx && Math.abs(tz) < cy) {
                    ctx.beginPath();
                    ctx.arc(tx, tz, 2.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        }

        // Draw Player Arrow at Center
        ctx.fillStyle = '#00f3ff';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        // Player heading line
        if (playerChassis) {
            const euler = new THREE.Euler();
            const threeQuat = new THREE.Quaternion(
                playerChassis.quaternion.x,
                playerChassis.quaternion.y,
                playerChassis.quaternion.z,
                playerChassis.quaternion.w
            );
            euler.setFromQuaternion(threeQuat, 'YXZ');
            const hAngle = -euler.y;

            ctx.strokeStyle = '#00f3ff';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(hAngle) * 12, Math.sin(hAngle) * 12);
            ctx.stroke();
        }

        ctx.restore();

        // Minimap border
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, w, h);
    }

    update(vehicle, trafficVehicles, challenges) {
        if (!vehicle) return;

        // Speed & RPM
        const speed = Math.round(vehicle.speedKmh);
        if (this.speedDigitalEl) this.speedDigitalEl.textContent = `${speed}`;
        if (this.gearEl) this.gearEl.textContent = vehicle.isShifting ? 'SHIFT' : (vehicle.currentGear === 0 ? 'R' : vehicle.currentGear);

        this.renderGauges(speed, vehicle.rpm);

        // Nitro & Health bars
        if (this.nitroBarFill) this.nitroBarFill.style.width = `${Math.max(0, Math.min(100, vehicle.nitro))}%`;
        if (this.healthBarFill) this.healthBarFill.style.width = `${Math.max(0, Math.min(100, vehicle.carHealth))}%`;

        // Drift HUD
        if (this.driftScoreEl) {
            this.driftScoreEl.textContent = `DRIFT: ${vehicle.driftScore}`;
            if (vehicle.isDrifting) {
                this.driftScoreEl.parentElement.classList.add('active');
            } else {
                this.driftScoreEl.parentElement.classList.remove('active');
            }
        }
        if (this.driftMultiplierEl) {
            this.driftMultiplierEl.textContent = `x${vehicle.driftCombo.toFixed(1)}`;
        }

        // Challenge Timer
        if (this.challengeTimerEl && challenges) {
            if (challenges.isActive) {
                this.challengeTimerEl.style.display = 'block';
                this.challengeTimerEl.textContent = `${challenges.currentMode.toUpperCase()}: ${challenges.timer.toFixed(1)}s`;
            } else {
                this.challengeTimerEl.style.display = 'none';
            }
        }

        // Minimap
        this.renderMinimap(
            vehicle.chassisBody,
            trafficVehicles,
            challenges ? challenges.checkpoints : null,
            challenges ? challenges.checkpointIndex : 0
        );
    }
}
