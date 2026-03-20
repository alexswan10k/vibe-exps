class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.collisionCanvas = document.createElement('canvas');
        this.collisionCanvas.width = this.canvas.width;
        this.collisionCanvas.height = this.canvas.height;
        this.collisionCtx = this.collisionCanvas.getContext('2d', { willReadFrequently: true });

        this.lapDisplay = document.getElementById('lap-display');
        this.posDisplay = document.getElementById('pos-display');
        this.timeDisplay = document.getElementById('time-display');
        this.trackNameDisplay = document.getElementById('track-name');
        this.crashOverlay = document.getElementById('crash-overlay');
        this.messageOverlay = document.getElementById('message-overlay');

        this.mainMenu = document.getElementById('main-menu');
        this.trackList = document.getElementById('track-list');

        this.lastTime = 0;
        this.isRunning = false;

        this.currentTrackIndex = 0;
        this.track = null;

        this.bikes = [];
        this.playerBike = null;
        this.aiControllers = [];

        this.raceTimer = 0;
        this.raceFinished = false;
        this.postRaceTimer = 0;

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        if (this.track) {
            this.collisionCanvas.width = this.track.logicalWidth;
            this.collisionCanvas.height = this.track.logicalHeight;
            this.track.draw(this.collisionCtx, true); // Redraw collision map

            // Calculate scale and offset to center the logical track on the physical screen
            const scaleX = this.canvas.width / this.collisionCanvas.width;
            const scaleY = this.canvas.height / this.collisionCanvas.height;
            // Pad by 5% so it's not immediately touching the edge
            this.renderScale = Math.min(scaleX, scaleY) * 0.95;

            this.offsetX = (this.canvas.width - this.collisionCanvas.width * this.renderScale) / 2;
            this.offsetY = (this.canvas.height - this.collisionCanvas.height * this.renderScale) / 2;
        }
    }

    init() {
        Input.init();

        // Build Track Menu
        this.trackList.innerHTML = '';
        TrackData.forEach((track, index) => {
            const btn = document.createElement('button');
            btn.className = 'track-btn';
            btn.innerText = track.name;
            btn.onclick = () => this.startGame(index);
            this.trackList.appendChild(btn);
        });

        this.mainMenu.style.display = 'flex'; // Show main menu initially
        this.lastTime = performance.now();
        this.isRunning = true;
        requestAnimationFrame((t) => this.loop(t));
    }

    startGame(index) {
        this.mainMenu.style.display = 'none';
        this.loadTrack(index);
    }

    loadTrack(index) {
        if (index >= TrackData.length) {
            this.messageOverlay.innerText = "ALL TRACKS COMPLETED!";
            this.messageOverlay.style.display = 'block';
            setTimeout(() => {
                this.mainMenu.style.display = 'flex';
                this.messageOverlay.style.display = 'none';
                this.track = null; // stop game updates
            }, 3000);
            return;
        }

        this.currentTrackIndex = index;
        this.track = TrackData[index];
        this.raceTimer = 0;
        this.raceFinished = false;
        this.postRaceTimer = 0;
        this.messageOverlay.style.display = 'none';
        this.trackNameDisplay.innerText = this.track.name;

        // Force resize to set up correct canvas scaling based on new track's logical bounds
        this.resize();

        this.bikes = [];
        this.aiControllers = [];

        const colors = ['#f44336', '#2196f3', '#9c27b0', '#ff9800'];

        for (let i = 0; i < 4; i++) {
            const start = this.track.startLines[i];
            const isPlayer = (i === 0);
            const bike = new Bike(start.x, start.y, start.angle, colors[i], isPlayer);

            this.bikes.push(bike);
            if (isPlayer) {
                this.playerBike = bike;
            } else {
                this.aiControllers.push(new AIController(bike));
            }
        }
    }

    loop(timestamp) {
        if (!this.isRunning) return;

        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        if (this.track) {
            this.update(Math.min(dt, 0.1));
            this.draw();
        }

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        if (!this.raceFinished) {
            this.raceTimer += dt;
        } else {
            this.postRaceTimer += dt;
            if (this.postRaceTimer > 3) {
                this.loadTrack(this.currentTrackIndex + 1);
                return;
            }
        }

        // Player Input
        if (this.playerBike) {
            let thrust = Input.isUp() ? 1 : (Input.isDown() ? -1 : 0);
            let turnDir = 0;
            if (Input.isLeft()) turnDir = -1;
            if (Input.isRight()) turnDir = 1;

            if (!this.raceFinished) {
                this.playerBike.update(dt, thrust, turnDir, this.collisionCtx);
            } else {
                this.playerBike.update(dt, 0, 0, this.collisionCtx);
            }

            this.crashOverlay.style.display = this.playerBike.state === 'crashed' ? 'block' : 'none';
        }

        // AI Update
        for (const ai of this.aiControllers) {
            if (!this.raceFinished) {
                ai.update(dt, this.track, this.collisionCtx);
            } else {
                ai.bike.update(dt, 0, 0, this.collisionCtx);
            }
        }

        this.checkWaypointsAndLaps();
        this.updateHUD();
    }

    checkWaypointsAndLaps() {
        for (const bike of this.bikes) {
            const wp = this.track.waypoints[bike.currentWaypoint];

            // Advance waypoint if close
            if (MathUtils.distance(bike.x, bike.y, wp.x, wp.y) < 100) {
                bike.lastPassedWaypoint = bike.currentWaypoint;
                bike.currentWaypoint = (bike.currentWaypoint + 1) % this.track.waypoints.length;

                // Track Laps
                if (bike.currentWaypoint === 1 && bike.lastPassedWaypoint === 0) {
                    bike.lapsCompleted++;
                    if (bike === this.playerBike && bike.lapsCompleted >= this.track.laps) {
                        this.raceFinished = true;
                        this.messageOverlay.innerText = "TRACK FINISHED!";
                        this.messageOverlay.style.display = 'block';
                    }
                }
            }

            // Calc distance to next for ranking
            const nextWp = this.track.waypoints[bike.currentWaypoint];
            bike.distanceToNextWaypoint = MathUtils.distanceSq(bike.x, bike.y, nextWp.x, nextWp.y);
        }

        // Keep them sorted by laps, then waypoints, then distance to next
        this.bikes.sort((a, b) => {
            if (a.lapsCompleted !== b.lapsCompleted) return b.lapsCompleted - a.lapsCompleted;
            if (a.currentWaypoint !== b.currentWaypoint) return b.currentWaypoint - a.currentWaypoint;
            return a.distanceToNextWaypoint - b.distanceToNextWaypoint;
        });
    }

    updateHUD() {
        const l = Math.min(Math.max(1, this.playerBike.lapsCompleted + 1), this.track.laps);
        this.lapDisplay.innerText = `Lap: ${l}/${this.track.laps}`;

        const pos = this.bikes.indexOf(this.playerBike) + 1;
        this.posDisplay.innerText = `Pos: ${pos}/${this.bikes.length}`;

        this.timeDisplay.innerText = `Time: ${this.raceTimer.toFixed(2)}`;
    }

    draw() {
        if (!this.track) return;

        // Wash the screen in the concrete background color first
        this.ctx.fillStyle = this.track.grassColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.renderScale, this.renderScale);

        this.track.draw(this.ctx, false);

        // Draw skid marks
        for (const bike of this.bikes) {
            bike.drawSkidMarks(this.ctx);
        }

        for (const bike of this.bikes) {
            if (!bike.isPlayer) bike.draw(this.ctx);
        }
        if (this.playerBike) this.playerBike.draw(this.ctx);

        this.ctx.restore();
    }
}

window.onload = () => {
    const game = new Game();
    game.init();
};
