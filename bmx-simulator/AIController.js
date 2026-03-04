class AIController {
    constructor(bike) {
        this.bike = bike;

        this.baseMaxSpeed = bike.maxSpeed * (0.75 + Math.random() * 0.2);
        this.bike.maxSpeed = this.baseMaxSpeed;
        this.steeringError = (Math.random() - 0.5) * 0.2;

        this.stuckTimer = 0;
        this.reversingTimer = 0;
        this.reverseTurningDir = Math.random() < 0.5 ? 1 : -1;
    }

    update(dt, track, collisionCtx) {
        if (this.bike.state === 'crashed') {
            this.stuckTimer += dt;
            if (this.stuckTimer > 0.5) { // Unstuck if crashed for a little bit
                this.reversingTimer = 1.0;
                this.stuckTimer = 0;
                this.reverseTurningDir = Math.random() < 0.5 ? 1 : -1; // Pick a random direction to reverse out
            }
            this.bike.update(dt, 0, 0, collisionCtx);
            return;
        }

        if (this.reversingTimer > 0) {
            this.reversingTimer -= dt;
            // Reverse and turn
            this.bike.update(dt, -1, this.reverseTurningDir, collisionCtx);
            return;
        }

        const wp = track.waypoints[this.bike.currentWaypoint];
        if (!wp) return;

        const targetAngle = MathUtils.angleBetween(this.bike.x, this.bike.y, wp.x, wp.y);
        const diff = MathUtils.angleDiff(targetAngle, this.bike.angle);

        let turnDir = 0;
        let thrust = 1;

        const noisyDiff = diff + this.steeringError;

        if (Math.abs(noisyDiff) > 0.05) {
            turnDir = Math.sign(noisyDiff);
        }

        // Slow down for tight corners
        if (Math.abs(noisyDiff) > Math.PI / 3 && this.bike.speed > this.bike.maxSpeed * 0.5) {
            thrust = 0;
        }

        // Help with turning around if pointing wrong way
        if (Math.abs(noisyDiff) > Math.PI / 2) {
            thrust = this.bike.speed < this.bike.maxSpeed * 0.4 ? 1 : 0;
        }

        // Check if stuck while trying to move forward
        if (this.bike.speed < 10 && thrust === 1) {
            this.stuckTimer += dt;
            if (this.stuckTimer > 1.0) {
                this.reversingTimer = 1.0;
                this.stuckTimer = 0;
                this.reverseTurningDir = Math.random() < 0.5 ? 1 : -1;
            }
        } else {
            this.stuckTimer = 0;
        }

        this.bike.update(dt, thrust, turnDir, collisionCtx);
    }
}
