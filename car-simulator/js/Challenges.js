// Checkpoint Time Trial, Drift King Challenge & High Score System
class Challenges {
    constructor(scene, audioSystem) {
        this.scene = scene;
        this.audio = audioSystem;

        this.currentMode = 'freeroam'; // 'freeroam', 'timetrial', 'drift'
        this.isActive = false;
        this.timer = 0;
        this.score = 0;
        this.bestTimes = {
            timetrial: parseFloat(localStorage.getItem('car_best_timetrial') || '999.9'),
            drift: parseInt(localStorage.getItem('car_best_drift') || '0', 10)
        };

        // Checkpoint race gates
        this.checkpoints = [
            { x: 0, y: 3, z: 0, rotY: 0 },
            { x: 104, y: 3, z: 0, rotY: 0 },
            { x: 208, y: 3, z: 104, rotY: Math.PI / 2 },
            { x: 208, y: 3, z: 208, rotY: Math.PI / 2 },
            { x: 104, y: 3, z: 208, rotY: Math.PI },
            { x: -104, y: 3, z: 208, rotY: Math.PI },
            { x: -320, y: 5, z: 100, rotY: Math.PI * 0.75 },
            { x: -420, y: 8, z: 0, rotY: Math.PI / 2 },
            { x: -420, y: 12, z: -100, rotY: Math.PI / 2 },
            { x: 0, y: 3, z: -104, rotY: 0 }
        ];

        this.checkpointIndex = 0;
        this.gateMeshes = [];
        this.initGateMeshes();
    }

    initGateMeshes() {
        const ringGeom = new THREE.TorusGeometry(5, 0.4, 8, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff, wireframe: false });

        this.checkpoints.forEach((cp, i) => {
            const gate = new THREE.Mesh(ringGeom, ringMat);
            gate.position.set(cp.x, cp.y, cp.z);
            gate.rotation.y = cp.rotY;
            gate.visible = false;
            this.scene.add(gate);
            this.gateMeshes.push(gate);
        });
    }

    startChallenge(mode) {
        this.currentMode = mode;
        this.isActive = true;

        if (mode === 'timetrial') {
            this.timer = 0;
            this.checkpointIndex = 0;
            this.updateGateVisibility();
        } else if (mode === 'drift') {
            this.timer = 60.0; // 60s countdown
            this.score = 0;
            this.gateMeshes.forEach(g => g.visible = false);
        } else {
            this.isActive = false;
            this.gateMeshes.forEach(g => g.visible = false);
        }
    }

    updateGateVisibility() {
        this.gateMeshes.forEach((g, i) => {
            g.visible = this.currentMode === 'timetrial' && (i === this.checkpointIndex || i === (this.checkpointIndex + 1) % this.checkpoints.length);
            if (i === this.checkpointIndex) {
                g.material.color.setHex(0x00ff66); // Current target is bright green
            } else {
                g.material.color.setHex(0x00f3ff); // Next is cyan
            }
        });
    }

    update(dt, playerPos, driftScore, onEventCallback) {
        if (!this.isActive) return;

        if (this.currentMode === 'timetrial') {
            this.timer += dt;

            // Check if player passed through active checkpoint
            const targetCp = this.checkpoints[this.checkpointIndex];
            const dist = Math.hypot(playerPos.x - targetCp.x, playerPos.z - targetCp.z);

            if (dist < 8) {
                if (this.audio) this.audio.playCheckpoint();
                this.checkpointIndex++;

                if (this.checkpointIndex >= this.checkpoints.length) {
                    // Finished lap!
                    const finalTime = this.timer;
                    this.isActive = false;
                    this.gateMeshes.forEach(g => g.visible = false);

                    const isRecord = finalTime < this.bestTimes.timetrial;
                    if (isRecord) {
                        this.bestTimes.timetrial = finalTime;
                        localStorage.setItem('car_best_timetrial', finalTime.toFixed(2));
                    }

                    if (onEventCallback) {
                        onEventCallback(`RACE FINISHED! Time: ${finalTime.toFixed(2)}s ${isRecord ? '🏆 NEW RECORD!' : ''}`);
                    }
                } else {
                    this.updateGateVisibility();
                    if (onEventCallback) {
                        onEventCallback(`CHECKPOINT ${this.checkpointIndex}/${this.checkpoints.length}`);
                    }
                }
            }
        } else if (this.currentMode === 'drift') {
            this.timer -= dt;
            this.score = driftScore;

            if (this.timer <= 0) {
                this.isActive = false;
                this.timer = 0;
                const isRecord = this.score > this.bestTimes.drift;
                if (isRecord) {
                    this.bestTimes.drift = this.score;
                    localStorage.setItem('car_best_drift', this.score.toString());
                }

                if (onEventCallback) {
                    onEventCallback(`DRIFT CHALLENGE OVER! Score: ${this.score} ${isRecord ? '🏆 NEW RECORD!' : ''}`);
                }
            }
        }
    }
}
