class AIController {
    constructor(bike) {
        this.bike = bike;

        // Base max speed varies slightly per AI
        this.baseMaxSpeed = bike.maxSpeed * (0.85 + Math.random() * 0.15);
        this.bike.maxSpeed = this.baseMaxSpeed;

        // Pick a preferred lane (offset from waypoint) to avoid clumping
        this.laneOffsetX = (Math.random() - 0.5) * 60;
        this.laneOffsetY = (Math.random() - 0.5) * 60;

        this.stuckTimer = 0;
        this.reversingTimer = 0;
        this.reverseTurningDir = Math.random() < 0.5 ? 1 : -1;
    }

    update(dt, track, collisionCtx) {
        if (this.bike.state === 'crashed') {
            this.stuckTimer += dt;
            if (this.stuckTimer > 0.4) { // Unstuck if crashed for a little bit
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

        // Try to look slightly ahead at preferred lane offset
        const targetX = wp.x + this.laneOffsetX;
        const targetY = wp.y + this.laneOffsetY;

        const targetAngle = MathUtils.angleBetween(this.bike.x, this.bike.y, targetX, targetY);
        const diff = MathUtils.angleDiff(targetAngle, this.bike.angle);

        // Continuous steering output
        let turnDir = Math.max(-1, Math.min(1, diff * 4.0));
        let thrust = 1;

        // Slow down for tight corners
        if (Math.abs(diff) > Math.PI / 4) {
            thrust = this.bike.speed > this.bike.maxSpeed * 0.45 ? 0 : 1;
        }

        // Help with turning around if pointing wrong way
        if (Math.abs(diff) > Math.PI / 2) {
            thrust = this.bike.speed > this.bike.maxSpeed * 0.2 ? 0 : 1;
        }

        // Check if stuck while trying to move forward (bumping against unseen edge but not fully crashed yet)
        if (Math.abs(this.bike.speed) < 5 && thrust === 1) {
            this.stuckTimer += dt;
            if (this.stuckTimer > 0.8) {
                this.reversingTimer = 1.2;
                this.stuckTimer = 0;
                this.reverseTurningDir = Math.random() < 0.5 ? 1 : -1;
            }
        } else {
            this.stuckTimer = 0;
        }

        this.bike.update(dt, thrust, turnDir, collisionCtx);
    }
}
