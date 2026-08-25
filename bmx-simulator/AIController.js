class AIController {
    constructor(bike, skill = null) {
        this.bike = bike;
        this.skill = skill != null ? skill : MathUtils.randRange(0.86, 1.04);
        this.baseMaxSpeed = bike.maxSpeed;
        this.laneOffset = MathUtils.randRange(-26, 26);
        this.stuckTimer = 0;
        this.reversingTimer = 0;
        this.reverseTurningDir = Math.random() < 0.5 ? 1 : -1;
    }

    computeTarget(track) {
        const wps = track.waypoints;
        const n = wps.length;
        const bike = this.bike;

        const pts = [{ x: bike.x, y: bike.y }];
        let idx = bike.currentWaypoint;
        for (let k = 0; k < 4; k++) {
            pts.push(wps[(idx + k) % n]);
        }

        let lookahead = 110 + Math.abs(bike.forwardSpeed) * 0.55;
        let target = pts[pts.length - 1];
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1];
            const b = pts[i];
            const segLen = Math.max(MathUtils.distance(a.x, a.y, b.x, b.y), 1);
            if (lookahead <= segLen) {
                const t = lookahead / segLen;
                target = { x: MathUtils.lerp(a.x, b.x, t), y: MathUtils.lerp(a.y, b.y, t), a, b };
                break;
            }
            lookahead -= segLen;
            if (i === pts.length - 1) {
                target = { x: b.x, y: b.y, a, b };
            }
        }
        return target;
    }

    curvatureAhead(track) {
        const wps = track.waypoints;
        const n = wps.length;
        const i = this.bike.currentWaypoint;
        const a = wps[i];
        const b = wps[(i + 1) % n];
        const c = wps[(i + 2) % n];
        const angA = Math.atan2(b.y - a.y, b.x - a.x);
        const angB = Math.atan2(c.y - b.y, c.x - b.x);
        return Math.abs(MathUtils.angleDiff(angB, angA));
    }

    update(dt, track, world, playerProgress) {
        const bike = this.bike;

        const delta = playerProgress - bike.progress;
        bike.speedScale = MathUtils.clamp(1 + delta * 0.00004 * (2 - this.skill), 0.93, 1.12);

        if (bike.state === 'crashed') {
            this.stuckTimer += dt;
            if (this.stuckTimer > 0.5) {
                this.reversingTimer = 0.9;
                this.stuckTimer = 0;
                this.reverseTurningDir = Math.random() < 0.5 ? 1 : -1;
            }
            bike.update(dt, { thrust: 0, turn: 0, hop: false }, world, track);
            return;
        }

        if (this.reversingTimer > 0) {
            this.reversingTimer -= dt;
            bike.update(dt, { thrust: -1, turn: this.reverseTurningDir, hop: false }, world, track);
            return;
        }

        const target = this.computeTarget(track);

        let tx = target.x;
        let ty = target.y;
        if (target.a && target.b) {
            const dx = target.b.x - target.a.x;
            const dy = target.b.y - target.a.y;
            const len = Math.max(Math.hypot(dx, dy), 1);
            tx += (-dy / len) * this.laneOffset;
            ty += (dx / len) * this.laneOffset;
        }

        const desiredAngle = Math.atan2(ty - bike.y, tx - bike.x);
        const diff = MathUtils.angleDiff(desiredAngle, bike.angle);
        const turn = MathUtils.clamp(diff * 3.4 * this.skill, -1, 1);

        const sharp = this.curvatureAhead(track);
        const maxEff = bike.maxSpeed * bike.speedScale;
        const desiredSpeed = maxEff * this.skill * MathUtils.clamp(1.25 - sharp * 1.35, 0.42, 1.05);

        let thrust;
        if (bike.forwardSpeed < desiredSpeed - 8) thrust = 1;
        else if (bike.forwardSpeed > desiredSpeed + 25) thrust = -0.7;
        else thrust = 0;

        if (Math.abs(diff) > Math.PI / 2 && bike.forwardSpeed > maxEff * 0.3) thrust = -0.7;

        let hop = false;
        if (sharp < 0.22 && bike.z <= 0 && bike.forwardSpeed > maxEff * 0.75 && Math.random() < dt * 0.35) {
            hop = true;
        }

        if (Math.abs(bike.forwardSpeed) < 6 && thrust >= 0) {
            this.stuckTimer += dt;
            if (this.stuckTimer > 0.9) {
                this.reversingTimer = 1.1;
                this.stuckTimer = 0;
                this.reverseTurningDir = Math.random() < 0.5 ? 1 : -1;
            }
        } else {
            this.stuckTimer = 0;
        }

        bike.update(dt, { thrust, turn, hop }, world, track);
    }
}
