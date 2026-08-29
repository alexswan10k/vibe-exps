class Game {
    constructor() {
        this.canvas = document.getElementById("game-canvas");
        this.ctx = this.canvas.getContext("2d");

        this.collisionCanvas = document.createElement("canvas");
        this.collisionCtx = this.collisionCanvas.getContext("2d", {
            willReadFrequently: true,
        });
        this.collisionData = null;

        this.lapDisplay = document.getElementById("lap-display");
        this.posDisplay = document.getElementById("pos-display");
        this.timeDisplay = document.getElementById("time-display");
        this.speedDisplay = document.getElementById("speed-display");
        this.lastLapDisplay = document.getElementById("lastlap-display");
        this.bestLapDisplay = document.getElementById("bestlap-display");
        this.trackNameDisplay = document.getElementById("track-name");
        this.crashOverlay = document.getElementById("crash-overlay");
        this.wrongWayOverlay = document.getElementById("wrongway-overlay");
        this.wrongWayT = 0;
        this.messageOverlay = document.getElementById("message-overlay");
        this.resultsPanel = document.getElementById("results");
        this.resultsRows = document.getElementById("results-rows");
        this.resultsTitle = document.getElementById("results-title");
        this.minimap = document.getElementById("minimap");
        this.minimapCtx = this.minimap ? this.minimap.getContext("2d") : null;
        this.minimapBg = null;

        this.mainMenu = document.getElementById("main-menu");
        this.trackList = document.getElementById("track-list");

        this.audio = new Sfx();
        this.particles = new ParticleSystem();
        this.floatingTexts = [];

        this.camera = { x: 0, y: 0, zoom: 1 };
        this.shake = 0;
        this.vignette = null;

        this.lastTime = 0;
        this.isRunning = false;

        this.currentTrackIndex = 0;
        this.track = null;
        this.state = "menu";

        this.bikes = [];
        this.playerBike = null;
        this.aiControllers = [];
        this.finishOrder = [];

        this.raceTimer = 0;
        this.countdownTimer = 0;
        this.lastCountdownNum = null;
        this.postRaceTimer = 0;
        this.msgTimeout = null;

        this.lapStartT = 0;
        this.lastLap = null;
        this.bestLap = null;

        this.resize();
        window.addEventListener("resize", () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        const g = this.ctx.createRadialGradient(
            this.canvas.width / 2,
            this.canvas.height / 2,
            Math.min(this.canvas.width, this.canvas.height) * 0.45,
            this.canvas.width / 2,
            this.canvas.height / 2,
            Math.max(this.canvas.width, this.canvas.height) * 0.75,
        );
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,0.45)");
        this.vignette = g;

        if (this.track) {
            const scaleX = this.canvas.width / this.track.logicalWidth;
            const scaleY = this.canvas.height / this.track.logicalHeight;
            this.fitZoom = Math.min(scaleX, scaleY) * 0.95;
        }
    }

    init() {
        Input.init();

        this.trackList.innerHTML = "";
        TrackData.forEach((track, index) => {
            const btn = document.createElement("button");
            btn.className = "track-btn";
            btn.innerText = track.name;
            const best = this.loadBest(track.name);
            if (best) {
                const sub = document.createElement("span");
                sub.className = "track-btn-best";
                sub.innerText = `Best lap ${MathUtils.formatTime(best)}`;
                btn.appendChild(sub);
            }
            btn.onclick = () => {
                this.audio.init();
                this.startGame(index);
            };
            this.trackList.appendChild(btn);
        });

        this.mainMenu.style.display = "flex";
        this.lastTime = performance.now();
        this.isRunning = true;
        requestAnimationFrame((t) => this.loop(t));
    }

    loadBest(name) {
        try {
            const v = localStorage.getItem(`urbnbmx_best_${name}`);
            return v ? parseFloat(v) : null;
        } catch {
            return null;
        }
    }

    saveBest(name, t) {
        try {
            localStorage.setItem(`urbnbmx_best_${name}`, String(t));
        } catch {}
    }

    startGame(index) {
        this.mainMenu.style.display = "none";
        this.hideResults();
        this.loadTrack(index);
    }

    backToMenu() {
        this.state = "menu";
        this.track = null;
        this.hideResults();
        this.messageOverlay.style.display = "none";
        this.crashOverlay.style.display = "none";
        this.mainMenu.style.display = "flex";
        this.refreshMenuBests();
    }

    refreshMenuBests() {
        this.trackList.innerHTML = "";
        TrackData.forEach((track, index) => {
            const btn = document.createElement("button");
            btn.className = "track-btn";
            btn.innerText = track.name;
            const best = this.loadBest(track.name);
            if (best) {
                const sub = document.createElement("span");
                sub.className = "track-btn-best";
                sub.innerText = `Best lap ${MathUtils.formatTime(best)}`;
                btn.appendChild(sub);
            }
            btn.onclick = () => {
                this.audio.init();
                this.startGame(index);
            };
            this.trackList.appendChild(btn);
        });
    }

    loadTrack(index) {
        if (index >= TrackData.length) {
            this.backToMenu();
            return;
        }

        this.currentTrackIndex = index;
        this.track = TrackData[index];
        this.track.buildStaticCanvas();

        this.collisionCanvas.width = this.track.logicalWidth;
        this.collisionCanvas.height = this.track.logicalHeight;
        this.track.draw(this.collisionCtx, true);
        this.collisionData = this.collisionCtx.getImageData(
            0,
            0,
            this.track.logicalWidth,
            this.track.logicalHeight,
        );

        const lw = this.track.logicalWidth;
        const lh = this.track.logicalHeight;
        const data = this.collisionData;
        this.world = {
            isBlocked: (x, y) => {
                if (x < 0 || y < 0 || x >= lw || y >= lh) return true;
                const idx = ((y | 0) * lw + (x | 0)) * 4;
                return data.data[idx] < 128;
            },
            groundAt: (x, y) =>
                this.track.heightField
                    ? this.track.heightField.sample(x, y)
                    : 0,
        };

        this.raceTimer = 0;
        this.countdownTimer = 3.6;
        this.lastCountdownNum = null;
        this.postRaceTimer = 0;
        this.finishOrder = [];
        this.floatingTexts = [];
        this.particles.particles.length = 0;
        this.lapStartT = 0;
        this.lastLap = null;
        this.bestLap = this.loadBest(this.track.name);
        this.shake = 0;
        this.messageOverlay.style.display = "none";
        this.crashOverlay.style.display = "none";
        this.wrongWayT = 0;
        if (this.wrongWayOverlay) this.wrongWayOverlay.style.display = "none";
        this.hideResults();
        this.trackNameDisplay.innerText = this.track.name;
        this.buildMinimapBg();

        this.bikes = [];
        this.aiControllers = [];

        const colors = ["#f44336", "#2196f3", "#9c27b0", "#ff9800"];
        for (let i = 0; i < 4; i++) {
            const start = this.track.startLines[i];
            const isPlayer = i === 0;
            const bike = new Bike(
                start.x,
                start.y,
                start.angle,
                colors[i],
                isPlayer,
            );
            bike.onEvent = (type, d) => this.onBikeEvent(bike, type, d);
            this.bikes.push(bike);
            if (isPlayer) {
                this.playerBike = bike;
            } else {
                this.aiControllers.push(new AIController(bike));
            }
        }

        const scaleX = this.canvas.width / lw;
        const scaleY = this.canvas.height / lh;
        this.fitZoom = Math.min(scaleX, scaleY) * 0.95;
        this.camera.x = this.playerBike.x;
        this.camera.y = this.playerBike.y;
        this.camera.zoom = this.fitZoom;
        this.state = "countdown";
        this.updateHUD();
    }

    buildMinimapBg() {
        if (!this.minimap || !this.minimapCtx) return;
        const mw = 168;
        const mh = Math.round(
            (mw * this.track.logicalHeight) / this.track.logicalWidth,
        );
        this.minimap.width = mw;
        this.minimap.height = mh;
        this.minimapScale = mw / this.track.logicalWidth;
        const bg = document.createElement("canvas");
        bg.width = mw;
        bg.height = mh;
        const bctx = bg.getContext("2d");
        bctx.drawImage(this.track.staticCanvas, 0, 0, mw, mh);
        this.minimapBg = bg;
    }

    showMsg(text, dur = 1.2, cls = "") {
        clearTimeout(this.msgTimeout);
        this.messageOverlay.className = cls;
        this.messageOverlay.innerText = text;
        this.messageOverlay.style.display = "block";
        void this.messageOverlay.offsetWidth;
        if (dur > 0) {
            this.msgTimeout = setTimeout(() => {
                this.messageOverlay.style.display = "none";
            }, dur * 1000);
        }
    }

    hideMsg() {
        clearTimeout(this.msgTimeout);
        this.messageOverlay.style.display = "none";
    }

    addFloatText(text, x, y, color = "#fff", size = 20, life = 1.4) {
        this.floatingTexts.push({ text, x, y, age: 0, life, color, size });
    }

    onBikeEvent(bike, type, d) {
        switch (type) {
            case "skid":
                this.particles.spawn(d.x, d.y, {
                    vx: MathUtils.randRange(-25, 25),
                    vy: MathUtils.randRange(-25, 25),
                    size: 5,
                    sizeEnd: 11,
                    life: 0.55,
                    color: "rgba(160,160,165,0.7)",
                    drag: 3,
                });
                break;
            case "hop":
                if (bike.isPlayer) this.audio.hop();
                this.particles.burst(bike.x, bike.y, 6, 60, {
                    size: 3.5,
                    life: 0.4,
                    color: "#8a8578",
                    drag: 4,
                });
                break;
            case "launch":
                if (bike.isPlayer) {
                    this.audio.whoosh();
                    if (d.power > 240) {
                        this.addFloatText(
                            "BIG AIR!",
                            bike.x,
                            bike.y - 26,
                            "#7CFC00",
                            22,
                        );
                    }
                    this.shake = Math.max(this.shake, 4);
                }
                break;
            case "bump":
                this.particles.burst(d.x, d.y, 5, 120, {
                    size: 3,
                    life: 0.35,
                    color: "#d8d3c6",
                    drag: 5,
                });
                if (bike.isPlayer) {
                    this.shake = Math.max(
                        this.shake,
                        Math.min(6, d.power * 0.02),
                    );
                    const now = performance.now();
                    if (now - (this.lastBumpSfx || 0) > 140) {
                        this.lastBumpSfx = now;
                        this.audio.bump();
                    }
                }
                break;
            case "land": {
                this.particles.burst(bike.x, bike.y, 10, 90, {
                    size: 4,
                    sizeEnd: 9,
                    life: 0.5,
                    color: "#9c8f7c",
                    drag: 4,
                });
                if (bike.isPlayer) {
                    this.audio.land();
                    this.shake = Math.min(7, 2 + (d.impact || 0) * 0.012);
                }
                break;
            }
            case "trick":
                this.addFloatText(
                    bike.isPlayer ? "360 AIR! +BOOST" : "TRICK!",
                    bike.x,
                    bike.y - 24,
                    "#ffeb3b",
                    bike.isPlayer ? 22 : 14,
                );
                if (bike.isPlayer) this.audio.trick();
                break;
            case "crash":
                this.particles.burst(bike.x, bike.y, 16, 130, {
                    size: 4,
                    sizeEnd: 10,
                    life: 0.7,
                    color: "#b0a794",
                    drag: 3,
                });
                if (bike.isPlayer) {
                    this.audio.crash();
                    this.shake = 12;
                } else {
                    this.particles.burst(bike.x, bike.y, 4, 60, {
                        size: 3,
                        life: 0.4,
                        color: "#888",
                        drag: 4,
                    });
                }
                break;
        }
    }

    loop(timestamp) {
        if (!this.isRunning) return;

        let dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;
        dt = Math.min(dt, 0.05);

        if (Input.consume("mute")) {
            const muted = this.audio.toggleMute();
            this.showMsg(muted ? "MUTED" : "SOUND ON", 0.8);
        }

        if (this.track) {
            this.update(dt);
            this.draw();
        }

        Input.clearFrame();
        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        if (Input.consume("menu")) {
            this.backToMenu();
            return;
        }

        this.updateCamera(dt);
        this.particles.update(dt);

        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const f = this.floatingTexts[i];
            f.age += dt;
            f.y -= 28 * dt;
            if (f.age > f.life) this.floatingTexts.splice(i, 1);
        }

        this.audio.update(
            dt,
            this.playerBike ? this.playerBike.speedNorm : 0,
            this.state === "racing",
        );

        if (this.state === "countdown") {
            this.countdownTimer -= dt;
            const n = Math.ceil(this.countdownTimer - 0.6);
            if (n !== this.lastCountdownNum) {
                this.lastCountdownNum = n;
                if (n > 0) {
                    this.showMsg(String(n), 0.9, "pop");
                    this.audio.countdown(n);
                }
            }
            if (this.countdownTimer <= 0.6) {
                this.state = "racing";
                this.showMsg("GO!", 0.9, "pop go");
                this.audio.countdown(0);
            }
            return;
        }

        if (this.state === "racing") {
            this.raceTimer += dt;
        }

        const racing = this.state === "racing";

        if (
            Input.consume("respawn") &&
            racing &&
            this.playerBike.state !== "crashed"
        ) {
            this.playerBike.respawn(this.track);
        }

        if (this.playerBike) {
            let thrust = 0;
            let turn = 0;
            if (racing) {
                if (Input.isUp()) thrust = 1;
                else if (Input.isDown()) thrust = -1;
                if (Input.isLeft()) turn = -1;
                if (Input.isRight()) turn = 1;
            }
            const hop = racing && Input.consume("hop");
            this.playerBike.update(
                dt,
                { thrust, turn, hop },
                this.world,
                this.track,
            );
            this.crashOverlay.style.display =
                this.playerBike.state === "crashed" ? "block" : "none";
        }

        const playerProgress = this.playerBike ? this.playerBike.progress : 0;
        for (const ai of this.aiControllers) {
            if (racing) {
                ai.update(dt, this.track, this.world, playerProgress);
            } else {
                ai.bike.update(
                    dt,
                    { thrust: 0, turn: 0, hop: false },
                    this.world,
                    this.track,
                );
            }
        }

        this.resolveContacts();
        this.checkWaypointsAndLaps();
        this.updateWrongWay(dt);
        this.updateHUD();

        if (this.state === "finished") {
            this.postRaceTimer += dt;
            if (
                this.resultsPanel.style.display === "block" &&
                Math.floor(this.postRaceTimer * 2) !==
                    Math.floor((this.postRaceTimer - dt) * 2)
            ) {
                this.buildResults();
            }
            if (Input.consume("respawn")) {
                this.loadTrack(this.currentTrackIndex);
                return;
            }
            if (this.postRaceTimer > 8 || Input.consume("confirm")) {
                this.hideResults();
                this.loadTrack(this.currentTrackIndex + 1);
            }
        }
    }

    // Bikes are solid to each other: push out of overlap and trade momentum along
    // the contact normal. You can hop over a rival, but not ride through one.
    resolveContacts() {
        const bikes = this.bikes;
        const R = 22;
        for (let i = 0; i < bikes.length; i++) {
            for (let j = i + 1; j < bikes.length; j++) {
                const a = bikes[i];
                const b = bikes[j];
                if (a.air > 10 || b.air > 10) continue;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const d = Math.hypot(dx, dy);
                if (d >= R || d < 0.001) continue;
                const nx = dx / d;
                const ny = dy / d;
                const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
                if (closing > 0) {
                    const imp = closing * 0.65;
                    a.vx -= nx * imp;
                    a.vy -= ny * imp;
                    b.vx += nx * imp;
                    b.vy += ny * imp;
                    a.syncVelocities();
                    b.syncVelocities();
                }
                const push = (R - d) * 0.5;
                this.nudge(a, -nx * push, -ny * push);
                this.nudge(b, nx * push, ny * push);
                if (closing > 70) {
                    const hit = a.isPlayer ? a : b;
                    this.onBikeEvent(hit, "bump", {
                        x: hit.x,
                        y: hit.y,
                        power: closing,
                    });
                }
            }
        }
    }

    nudge(bike, ox, oy) {
        const x = bike.x + ox;
        const y = bike.y + oy;
        if (!this.world.isBlocked(x, y)) {
            bike.x = x;
            bike.y = y;
        }
    }

    updateWrongWay(dt) {
        const el = this.wrongWayOverlay;
        if (!el) return;
        const p = this.playerBike;
        if (this.state !== "racing" || !p || p.state === "crashed") {
            this.wrongWayT = 0;
            el.style.display = "none";
            return;
        }
        const wp = this.track.waypoints[p.currentWaypoint];
        const gx = wp.x - p.x;
        const gy = wp.y - p.y;
        const spd = Math.hypot(p.vx, p.vy);
        const dist = Math.hypot(gx, gy);
        const drivingAway =
            spd > 45 && p.vx * gx + p.vy * gy < -0.5 * spd * dist;
        this.wrongWayT = drivingAway ? this.wrongWayT + dt : 0;
        el.style.display = this.wrongWayT > 1 ? "block" : "none";
    }

    checkWaypointsAndLaps() {
        const wps = this.track.waypoints;
        for (const bike of this.bikes) {
            const wp = wps[bike.currentWaypoint];
            if (
                MathUtils.distance(bike.x, bike.y, wp.x, wp.y) <
                this.track.wpRadius
            ) {
                bike.lastCheckpointIdx = bike.currentWaypoint;
                bike.lastPassedWaypoint = bike.currentWaypoint;
                bike.currentWaypoint = (bike.currentWaypoint + 1) % wps.length;

                if (
                    bike.currentWaypoint === 1 &&
                    bike.lastPassedWaypoint === 0
                ) {
                    bike.lapsCompleted++;
                    if (bike.isPlayer) this.onPlayerCrossLine();
                    if (
                        !bike.finished &&
                        bike.lapsCompleted >= this.track.laps
                    ) {
                        bike.finished = true;
                        bike.finishTime = this.raceTimer;
                        this.finishOrder.push(bike);
                        if (bike.isPlayer) this.finishRace();
                    }
                }
            }

            const nextWp = wps[bike.currentWaypoint];
            bike.distanceToNextWaypoint = MathUtils.distanceSq(
                bike.x,
                bike.y,
                nextWp.x,
                nextWp.y,
            );
        }

        this.bikes.sort((a, b) => {
            if (a.finished && b.finished) return a.finishTime - b.finishTime;
            if (a.finished) return -1;
            if (b.finished) return 1;
            if (a.lapsCompleted !== b.lapsCompleted)
                return b.lapsCompleted - a.lapsCompleted;
            if (a.currentWaypoint !== b.currentWaypoint)
                return b.currentWaypoint - a.currentWaypoint;
            return a.distanceToNextWaypoint - b.distanceToNextWaypoint;
        });
    }

    onPlayerCrossLine() {
        const t = this.raceTimer;
        const p = this.playerBike;
        if (p.lapsCompleted === 0) {
            this.lapStartT = t;
        } else {
            const lapTime = t - this.lapStartT;
            this.lastLap = lapTime;
            this.lapStartT = t;
            let isBest = false;
            if (this.bestLap == null || lapTime < this.bestLap) {
                this.bestLap = lapTime;
                this.saveBest(this.track.name, lapTime);
                isBest = true;
            }
            this.audio.lap();
            this.addFloatText(
                `${isBest ? "BEST LAP " : "LAP "}${MathUtils.formatTime(lapTime)}`,
                p.x,
                p.y - 30,
                isBest ? "#ffeb3b" : "#fff",
                20,
            );
        }
    }

    finishRace() {
        this.state = "finished";
        this.postRaceTimer = 0;
        this.audio.finish();
        this.particles.confetti(this.playerBike.x, this.playerBike.y, 90);
        this.addFloatText(
            "FINISH!",
            this.playerBike.x,
            this.playerBike.y - 34,
            "#ffeb3b",
            26,
            2,
        );
        setTimeout(() => {
            if (this.state === "finished") this.buildResults(true);
        }, 900);
    }

    buildResults(final = false) {
        const standings = [...this.bikes].sort((a, b) => {
            if (a.finished && b.finished) return a.finishTime - b.finishTime;
            if (a.finished) return -1;
            if (b.finished) return 1;
            return b.progress - a.progress;
        });

        this.resultsTitle.innerText = final ? "FINISHED!" : "RACE COMPLETE";
        this.resultsRows.innerHTML = "";

        const winnerTime =
            standings[0] && standings[0].finished
                ? standings[0].finishTime
                : null;

        standings.forEach((bike, i) => {
            const row = document.createElement("div");
            row.className = `result-row${bike.isPlayer ? " you" : ""}`;
            const pos = document.createElement("span");
            pos.className = "res-pos";
            pos.innerText = `${i + 1}`;
            const chip = document.createElement("span");
            chip.className = "res-chip";
            chip.style.background = bike.color;
            const name = document.createElement("span");
            name.className = "res-name";
            name.innerText = bike.isPlayer ? "YOU" : `BOT ${i + 1}`;
            const time = document.createElement("span");
            time.className = "res-time";
            if (bike.finished) {
                time.innerText =
                    winnerTime != null && bike.finishTime > winnerTime
                        ? `+${(bike.finishTime - winnerTime).toFixed(2)}`
                        : MathUtils.formatTime(bike.finishTime);
            } else {
                time.innerText = "DNF";
            }
            row.append(pos, chip, name, time);
            this.resultsRows.appendChild(row);
        });

        const stats = document.createElement("div");
        stats.className = "results-stats";
        const stat = (label, value) => {
            const row = document.createElement("div");
            const cap = document.createElement("span");
            cap.className = "stat-label";
            cap.innerText = label;
            row.append(cap, ` ${value}`);
            return row;
        };
        stats.append(
            stat(
                "Total",
                MathUtils.formatTime(
                    this.playerBike.finishTime || this.raceTimer,
                ),
            ),
            stat("Last lap", MathUtils.formatTime(this.lastLap)),
            stat("Best lap", MathUtils.formatTime(this.bestLap)),
        );
        this.resultsRows.appendChild(stats);
        this.resultsPanel.style.display = "flex";
    }

    hideResults() {
        if (this.resultsPanel) this.resultsPanel.style.display = "none";
    }

    updateCamera(dt) {
        const p = this.playerBike;
        if (!p) return;
        const smooth = 1 - Math.exp(-5 * dt);
        const tx = p.x + p.vx * 0.35;
        const ty = p.y + p.vy * 0.35;
        this.camera.x += (tx - this.camera.x) * smooth;
        this.camera.y += (ty - this.camera.y) * smooth;

        const base = this.fitZoom * 2.15;
        const targetZoom = base * (1 - p.speedNorm * 0.17);
        this.camera.zoom +=
            (targetZoom - this.camera.zoom) * (1 - Math.exp(-2.5 * dt));

        const halfW = this.canvas.width / (2 * this.camera.zoom);
        const halfH = this.canvas.height / (2 * this.camera.zoom);
        const lw = this.track.logicalWidth;
        const lh = this.track.logicalHeight;
        this.camera.x =
            halfW * 2 >= lw
                ? lw / 2
                : MathUtils.clamp(this.camera.x, halfW, lw - halfW);
        this.camera.y =
            halfH * 2 >= lh
                ? lh / 2
                : MathUtils.clamp(this.camera.y, halfH, lh - halfH);

        this.shake *= Math.exp(-7 * dt);
        if (this.shake < 0.05) this.shake = 0;
    }

    updateHUD() {
        const p = this.playerBike;
        if (!p) return;
        const l = Math.min(Math.max(1, p.lapsCompleted + 1), this.track.laps);
        this.lapDisplay.innerText = `LAP ${l}/${this.track.laps}`;
        const pos = this.bikes.indexOf(p) + 1;
        this.posDisplay.innerText = `POS ${pos}/${this.bikes.length}`;
        this.timeDisplay.innerText = MathUtils.formatTime(this.raceTimer);
        this.speedDisplay.innerText = `${Math.round(Math.abs(p.forwardSpeed) * 0.5)} km/h`;
        this.lastLapDisplay.innerText = `LAST ${MathUtils.formatTime(this.lastLap)}`;
        this.bestLapDisplay.innerText = `BEST ${MathUtils.formatTime(this.bestLap)}`;
    }

    draw() {
        if (!this.track) return;

        const ctx = this.ctx;
        ctx.fillStyle = "#0b0c10";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        const shakeX = this.shake
            ? MathUtils.randRange(-this.shake, this.shake)
            : 0;
        const shakeY = this.shake
            ? MathUtils.randRange(-this.shake, this.shake)
            : 0;
        ctx.translate(
            this.canvas.width / 2 + shakeX,
            this.canvas.height / 2 + shakeY,
        );
        ctx.scale(this.camera.zoom, this.camera.zoom);
        ctx.translate(-this.camera.x, -this.camera.y);

        this.track.draw(ctx, false);

        for (const bike of this.bikes) {
            bike.drawSkidMarks(ctx);
        }

        for (const bike of this.bikes) {
            if (!bike.isPlayer) bike.draw(ctx);
        }
        if (this.playerBike) this.playerBike.draw(ctx);

        this.particles.draw(ctx);

        ctx.restore();

        for (const f of this.floatingTexts) {
            const sx =
                (f.x - this.camera.x) * this.camera.zoom +
                this.canvas.width / 2;
            const sy =
                (f.y - this.camera.y) * this.camera.zoom +
                this.canvas.height / 2;
            const t = f.age / f.life;
            ctx.globalAlpha = 1 - t * t;
            ctx.font = `bold ${f.size}px 'Courier New', monospace`;
            ctx.textAlign = "center";
            ctx.fillStyle = f.color;
            ctx.strokeStyle = "rgba(0,0,0,0.7)";
            ctx.lineWidth = 3;
            ctx.strokeText(f.text, sx, sy);
            ctx.fillText(f.text, sx, sy);
        }
        ctx.globalAlpha = 1;

        if (this.vignette) {
            ctx.fillStyle = this.vignette;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        this.drawMinimap();
    }

    drawMinimap() {
        if (!this.minimapCtx || !this.minimapBg) return;
        const mctx = this.minimapCtx;
        const mw = this.minimap.width;
        const mh = this.minimap.height;
        mctx.clearRect(0, 0, mw, mh);
        mctx.globalAlpha = 0.9;
        mctx.drawImage(this.minimapBg, 0, 0);
        mctx.globalAlpha = 1;

        const s = this.minimapScale;
        const halfW = this.canvas.width / (2 * this.camera.zoom);
        const halfH = this.canvas.height / (2 * this.camera.zoom);
        mctx.strokeStyle = "rgba(255,255,255,0.35)";
        mctx.lineWidth = 1;
        mctx.strokeRect(
            (this.camera.x - halfW) * s,
            (this.camera.y - halfH) * s,
            halfW * 2 * s,
            halfH * 2 * s,
        );

        for (const bike of this.bikes) {
            const x = bike.x * s;
            const y = bike.y * s;
            mctx.beginPath();
            mctx.arc(x, y, bike.isPlayer ? 4.5 : 3.2, 0, Math.PI * 2);
            mctx.fillStyle = bike.color;
            mctx.fill();
            if (bike.isPlayer) {
                mctx.strokeStyle = "#fff";
                mctx.lineWidth = 1.5;
                mctx.stroke();
            }
        }
    }
}

window.onload = () => {
    const game = new Game();
    game.init();
};
