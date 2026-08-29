class Bike {
    constructor(x, y, angle, color, isPlayer = false) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.color = color;
        this.isPlayer = isPlayer;

        this.maxSpeed = 270;
        this.acceleration = 360;
        this.brakePower = 560;
        this.reverseMax = -120;
        this.friction = 130;
        this.turnRate = 3.4;
        this.gripGround = 9;
        this.gripAir = 1.7;
        this.gravity = 1500;
        this.hopVz = 330;
        // Whip authority in the air. A rider spins a real 360 at roughly 12 rad/s,
        // so unloaded the bike rotates far faster than ground steering allows.
        // Measured reachable whip: flat hop 2.7 rad, lip launch 3.7, fast-lip
        // hop 4.5 — trickSpin sits between a casual hop and a committed lip.
        this.airSpin = 1.9; // multiplier on ground turn rate while airborne
        this.trickSpin = 3.4; // rad of whip that pays out the landing boost
        this.speedScale = 1;

        this.vx = 0;
        this.vy = 0;
        this.air = 0;
        this.vz = 0;
        this.z = 0;

        this.state = "normal";
        this.crashTimer = 0;
        this.launchCd = 0;
        this.lastSlope = 0;
        this.recentSlope = 0;

        this.currentLap = 0;
        this.lapsCompleted = -1;
        this.currentWaypoint = 0;
        this.lastPassedWaypoint = -1;
        this.lastCheckpointIdx = 0;
        this.distanceToNextWaypoint = 0;
        this.finished = false;
        this.finishTime = 0;

        this.spinAccum = 0;
        this.pendingTrick = false;
        this.trickCounted = false;

        this.skidMarks = [];
        this.skidEmitAcc = 0;
        this.skidSmokeAcc = 0;
        this.onEvent = null;

        this.forwardSpeed = 0;
        this.lateralSpeed = 0;
    }

    get speedNorm() {
        return MathUtils.clamp(
            Math.abs(this.forwardSpeed) / this.maxSpeed,
            0,
            1,
        );
    }

    get progress() {
        return (
            this.lapsCompleted * 100000 +
            this.currentWaypoint * 1000 -
            Math.sqrt(this.distanceToNextWaypoint)
        );
    }

    emit(type, data) {
        if (this.onEvent) this.onEvent(type, data || {});
    }

    syncVelocities() {
        const fx = Math.cos(this.angle);
        const fy = Math.sin(this.angle);
        this.forwardSpeed = this.vx * fx + this.vy * fy;
        this.lateralSpeed = -this.vx * fy + this.vy * fx;
    }

    respawn(track) {
        const wps = track.waypoints;
        const wp = wps[this.lastCheckpointIdx % wps.length];
        const next = wps[(this.lastCheckpointIdx + 1) % wps.length];
        this.x = wp.x;
        this.y = wp.y;
        this.angle = MathUtils.angleBetween(wp.x, wp.y, next.x, next.y);
        this.vx = 0;
        this.vy = 0;
        this.air = 0;
        this.vz = 0;
        this.z = 0;
        this.state = "normal";
        this.crashTimer = 0;
        this.spinAccum = 0;
        this.pendingTrick = false;
        this.trickCounted = false;
        this.launchCd = 0.3;
        this.recentSlope = 0;
    }

    beginAir(vz, resetSpin = true) {
        this.air = 0.01;
        this.vz = vz;
        if (resetSpin) {
            this.spinAccum = 0;
            this.pendingTrick = false;
            this.trickCounted = false;
        }
    }

    update(dt, ctrl, world, track) {
        if (this.state === "crashed") {
            this.crashTimer -= dt;
            const damp = Math.exp(-6 * dt);
            this.vx *= damp;
            this.vy *= damp;
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            if (world) this.z = world.groundAt(this.x, this.y);
            if (this.crashTimer <= 0) {
                this.state = "normal";
                if (world && world.isBlocked(this.x, this.y)) {
                    this.respawn(track);
                }
            }
            this.updateSkidMarks(dt);
            return;
        }

        const grounded = this.air <= 0;
        const fx = Math.cos(this.angle);
        const fy = Math.sin(this.angle);

        let vF = this.vx * fx + this.vy * fy;
        let vL = -this.vx * fy + this.vy * fx;

        const maxEff = this.maxSpeed * this.speedScale;
        const gHere = world ? world.groundAt(this.x, this.y) : 0;

        let slopeAhead = 0;
        let dropAhead = 0;
        const spd = Math.hypot(this.vx, this.vy);
        if (world && spd > 20) {
            const ux = this.vx / spd;
            const uy = this.vy / spd;
            const L = 8 + spd * 0.045;
            const gAhead = world.groundAt(this.x + ux * L, this.y + uy * L);
            slopeAhead = (gAhead - gHere) / L;
            dropAhead = gHere - gAhead;
        }
        this.lastSlope = slopeAhead;
        this.recentSlope = Math.max(
            slopeAhead,
            this.recentSlope * Math.exp(-5 * dt),
        );

        if (grounded) {
            if (ctrl.thrust > 0.05) {
                const headroom = 1 - MathUtils.clamp(vF / maxEff, 0, 1) * 0.55;
                vF +=
                    this.acceleration *
                    ctrl.thrust *
                    dt *
                    Math.max(headroom, 0.35);
            } else if (ctrl.thrust < -0.05) {
                if (vF > 10) vF += this.brakePower * ctrl.thrust * dt;
                else
                    vF = Math.max(
                        this.reverseMax,
                        vF + this.acceleration * 0.65 * ctrl.thrust * dt,
                    );
            } else if (vF > 0) vF = Math.max(0, vF - this.friction * dt);
            else if (vF < 0) vF = Math.min(0, vF + this.friction * dt);

            vF -= slopeAhead * 480 * dt;

            if (ctrl.hop && Math.abs(vF) > 60) {
                const rampBonus = MathUtils.clamp(
                    Math.max(0, slopeAhead) * Math.abs(vF) * 1.2,
                    0,
                    200,
                );
                this.beginAir(this.hopVz + rampBonus);
                this.emit("hop");
            }
        }

        vF = MathUtils.clamp(vF, this.reverseMax, maxEff * 1.15);

        const dirScale = vF < -5 ? -1 : 1;
        const steerFactor = MathUtils.clamp(Math.abs(vF) / 130, 0, 1);
        const airFactor = grounded ? 1 : this.airSpin;
        const effTurn = this.turnRate * steerFactor * airFactor * dirScale;
        const dHeading = ctrl.turn * effTurn * dt;
        this.angle += dHeading;

        if (!grounded) {
            this.spinAccum += Math.abs(dHeading);
            if (this.spinAccum > this.trickSpin && !this.trickCounted) {
                this.pendingTrick = true;
                this.trickCounted = true;
            }
        }

        const bermBoost = grounded && gHere > 6 ? 1.9 : 1;
        const gripRate = grounded ? this.gripGround * bermBoost : this.gripAir;
        vL *= Math.exp(-gripRate * dt);

        const nfx = Math.cos(this.angle);
        const nfy = Math.sin(this.angle);
        this.vx = nfx * vF - nfy * vL;
        this.vy = nfy * vF + nfx * vL;
        this.forwardSpeed = vF;
        this.lateralSpeed = vL;

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        if (world) {
            this.launchCd -= dt;
            const gNew = world.groundAt(this.x, this.y);

            if (this.air > 0) {
                this.vz -= this.gravity * dt;
                this.air += this.vz * dt;
                if (this.air <= 0) {
                    const impact = -this.vz;
                    this.air = 0;
                    this.vz = 0;
                    this.recentSlope = 0;
                    this.launchCd = 0.35;
                    this.emit("land", { impact });
                    if (this.pendingTrick) {
                        this.pendingTrick = false;
                        vF = Math.min(maxEff * 1.15, vF + 90);
                        this.forwardSpeed = vF;
                        this.vx = nfx * vF - nfy * vL;
                        this.vy = nfy * vF + nfx * vL;
                        this.emit("trick", { boost: true });
                    }
                }
            } else if (
                dropAhead > 7 &&
                this.recentSlope > 0.1 &&
                this.launchCd <= 0 &&
                Math.abs(vF) > 70
            ) {
                const carry = MathUtils.clamp(
                    this.recentSlope * Math.abs(vF) * 3.2,
                    80,
                    430,
                );
                this.beginAir(carry);
                this.recentSlope = 0;
                this.launchCd = 0.5;
                if (dropAhead > 30) {
                    this.vx *= -0.5;
                    this.vy *= -0.5;
                    vF = nfx * this.vx + nfy * this.vy;
                    vL = -nfx * this.vy + nfy * this.vx;
                    this.forwardSpeed = vF;
                    this.lateralSpeed = vL;
                }
                this.emit("launch", { power: carry });
            }

            this.z = gNew + this.air;
        } else {
            if (this.air > 0) {
                this.vz -= this.gravity * dt;
                this.air += this.vz * dt;
                if (this.air <= 0) {
                    this.air = 0;
                    this.vz = 0;
                    this.emit("land", { impact: 300 });
                }
            }
            this.z = this.air;
        }

        if (
            grounded &&
            world &&
            this.air <= 0 &&
            world.isBlocked(this.x, this.y)
        ) {
            this.crash();
            const sp2 = Math.max(Math.hypot(this.vx, this.vy), 1);
            this.x -= (this.vx / sp2) * 8;
            this.y -= (this.vy / sp2) * 8;
            this.vx *= 0.2;
            this.vy *= 0.2;
        }

        if (grounded && Math.abs(vL) > 70 && Math.abs(vF) > 60) {
            this.skidEmitAcc += dt;
            if (this.skidEmitAcc > 0.022) {
                this.skidEmitAcc = 0;
                const rx = this.x - nfx * 12;
                const ry = this.y - nfy * 12;
                this.pushSkidMark(rx, ry);
                this.skidSmokeAcc += 1;
                if (this.skidSmokeAcc >= 3) {
                    this.skidSmokeAcc = 0;
                    this.emit("skid", { x: rx, y: ry });
                }
            }
        }

        this.updateSkidMarks(dt);
    }

    crash() {
        if (this.state !== "crashed") {
            this.state = "crashed";
            this.crashTimer = 1.15;
            this.air = 0;
            this.vz = 0;
            this.pushSkidMark(this.x, this.y, true);
            this.emit("crash");
        }
    }

    pushSkidMark(x, y, permanent = false) {
        const marks = this.skidMarks;
        let px = x;
        let py = y;
        for (let i = marks.length - 1; i >= 0; i--) {
            if (marks[i].age >= 0) {
                px = marks[i].x;
                py = marks[i].y;
                break;
            }
        }
        if (permanent) {
            px = x;
            py = y;
        }
        marks.push({ x, y, px, py, age: permanent ? -1 : 0 });
        if (marks.length > 500) {
            const idx = marks.findIndex((m) => m.age >= 0);
            if (idx >= 0) marks.splice(idx, 1);
            else marks.shift();
        }
    }

    updateSkidMarks(dt) {
        for (let i = this.skidMarks.length - 1; i >= 0; i--) {
            const m = this.skidMarks[i];
            if (m.age >= 0) {
                m.age += dt;
                if (m.age > 3) this.skidMarks.splice(i, 1);
            }
        }
    }

    drawSkidMarks(ctx) {
        ctx.lineCap = "round";
        for (const m of this.skidMarks) {
            if (m.age < 0) {
                ctx.strokeStyle = "rgba(10,10,10,0.75)";
                ctx.lineWidth = 7;
                ctx.globalAlpha = 1;
            } else {
                ctx.strokeStyle = "rgba(15,15,15,0.45)";
                ctx.lineWidth = 5;
                ctx.globalAlpha = 1 - m.age / 3;
            }
            ctx.beginPath();
            ctx.moveTo(m.px, m.py);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    draw(ctx) {
        const shadowScale = 1 / (1 + this.z / 240);
        ctx.save();
        ctx.translate(this.x, this.y + 3);
        ctx.scale(shadowScale, shadowScale * 0.8);
        ctx.fillStyle = "rgba(0,0,0,0.32)";
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.translate(this.x, this.y - this.z * 0.55);
        ctx.rotate(this.angle);

        if (this.state === "crashed") {
            ctx.rotate(Math.sin(Date.now() / 90) * 0.25);
            if (Math.floor(Date.now() / 110) % 2 === 0) ctx.globalAlpha = 0.45;
        }

        const lean = MathUtils.clamp(this.lateralSpeed / 260, -1, 1);

        ctx.fillStyle = "#0a0a0a";
        ctx.beginPath();
        ctx.arc(11, 0, 5.2, 0, Math.PI * 2);
        ctx.arc(-12, 0, 5.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#333";
        ctx.beginPath();
        ctx.arc(11, 0, 2.2, 0, Math.PI * 2);
        ctx.arc(-12, 0, 2.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#cfcfcf";
        ctx.lineWidth = 2.4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(-4, -2);
        ctx.lineTo(4, -1);
        ctx.lineTo(11, 0);
        ctx.stroke();

        ctx.save();
        ctx.translate(9, 0);
        ctx.rotate(lean * 0.5);
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(0, 8);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.rotate(lean * 0.45);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-6, 1);
        ctx.lineTo(-1, 0);
        ctx.stroke();

        ctx.fillStyle = "#fff";
        if (this.isPlayer) ctx.fillStyle = "#ffeb3b";
        ctx.beginPath();
        ctx.arc(-2, 0, 5.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        ctx.restore();
    }
}
