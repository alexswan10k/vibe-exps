class AIController {
    constructor(bike) {
        this.bike = bike;

        this.baseMaxSpeed = bike.maxSpeed * (0.75 + Math.random() * 0.2);
        this.bike.maxSpeed = this.baseMaxSpeed;
        this.steeringError = (Math.random() - 0.5) * 0.2;
    }

    update(dt, track, collisionCtx) {
        if (this.bike.state === 'crashed') {
            this.bike.update(dt, false, 0, collisionCtx);
            return;
        }

        const wp = track.waypoints[this.bike.currentWaypoint];
        if (!wp) return;

        const targetAngle = MathUtils.angleBetween(this.bike.x, this.bike.y, wp.x, wp.y);
        const diff = MathUtils.angleDiff(targetAngle, this.bike.angle);

        let turnDir = 0;
        let thrust = true;

        const noisyDiff = diff + this.steeringError;

        if (Math.abs(noisyDiff) > 0.05) {
            turnDir = Math.sign(noisyDiff);
        }

        // Slow down for tight corners
        if (Math.abs(noisyDiff) > Math.PI / 3 && this.bike.speed > this.bike.maxSpeed * 0.5) {
            thrust = false;
        }

        // Help with turning around if pointing wrong way
        if (Math.abs(noisyDiff) > Math.PI / 2) {
            thrust = this.bike.speed < this.bike.maxSpeed * 0.4;
        }

        this.bike.update(dt, thrust, turnDir, collisionCtx);
    }
}
