class Physics {
    constructor() {
        this.bodies = [];
        this.statics = []; // Static colliders like ground
        this.triggers = []; // Collectibles, zones
    }

    addBody(body) {
        this.bodies.push(body);
    }

    addStatic(rect) {
        this.statics.push(rect);
    }

    addTrigger(trigger) {
        this.triggers.push(trigger);
    }

    reset() {
        this.bodies = [];
        this.statics = [];
        this.triggers = [];
    }

    update(dt) {
        // Integrate and Resolve World Collisions
        for (const body of this.bodies) {
            this.integrate(body, dt);
            this.resolveWorldCollisions(body);
        }

        // Resolve Body vs Body (Pushing)
        // Simple N^2 check for now (low count)
        for (let i = 0; i < this.bodies.length; i++) {
            for (let j = i + 1; j < this.bodies.length; j++) {
                const b1 = this.bodies[i];
                const b2 = this.bodies[j];

                if (Utils.rectIntersect(b1, b2)) {
                    this.resolveBodyCollision(b1, b2);
                }
            }
        }

        // Resolve Triggers
        for (let i = this.triggers.length - 1; i >= 0; i--) {
            const trigger = this.triggers[i];
            // Check against player (assuming body 0 is player usually, but let's be safe and check all or just passed specific)
            // For now, simpler: check all bodies against triggers
            for (const body of this.bodies) {
                if (body.type === 'player' && Utils.rectIntersect(body, trigger)) {
                    trigger.onCollide(body);
                    if (trigger.remove) {
                        this.triggers.splice(i, 1);
                    }
                    break;
                }
            }
        }
    }

    integrate(body, dt) {
        // Apply Gravity
        if (!body.grounded && body.hasGravity !== false) {
            body.vy += Constants.GRAVITY * dt;
        }

        // Friction / Damping for X
        if (body.grounded) {
            body.vx *= 0.8; // Ground friction
        } else {
            body.vx *= 0.95; // Air drag
        }

        // Stop small movements
        if (Math.abs(body.vx) < 10) body.vx = 0;

        // Terminal velocity
        body.vy = Utils.clamp(body.vy, -Constants.TERMINAL_VELOCITY, Constants.TERMINAL_VELOCITY);

        // Apply Velocity to Position
        body.x += body.vx * dt;
        body.y += body.vy * dt;

        // Reset grounded state - will be re-asserted in collision
        body.grounded = false;
    }

    resolveWorldCollisions(body) {
        for (const wall of this.statics) {
            if (Utils.rectIntersect(body, wall)) {
                this.resolveAABB(body, wall);
            }
        }
    }

    resolveAABB(body, wall) {
        const overlapX = (body.width / 2 + wall.width / 2) - Math.abs((body.x + body.width / 2) - (wall.x + wall.width / 2));
        const overlapY = (body.height / 2 + wall.height / 2) - Math.abs((body.y + body.height / 2) - (wall.y + wall.height / 2));

        if (overlapX < overlapY) {
            // X collision
            if (body.x < wall.x) {
                body.x -= overlapX;
            } else {
                body.x += overlapX;
            }
            body.vx = 0;
        } else {
            // Y collision
            if (body.y < wall.y) {
                body.y -= overlapY;
                body.vy = 0;
                body.grounded = true;
            } else {
                body.y += overlapY;
                if (body.vy < 0) body.vy = 0;
            }
        }
    }

    resolveBodyCollision(b1, b2) {
        // Simple resolution: push the lighter one? or just push away from center
        // Assuming b1 is player and b2 is box usually.
        // If b1 is moving fast and b2 is not...

        const overlapX = (b1.width / 2 + b2.width / 2) - Math.abs((b1.x + b1.width / 2) - (b2.x + b2.width / 2));
        const overlapY = (b1.height / 2 + b2.height / 2) - Math.abs((b1.y + b1.height / 2) - (b2.y + b2.height / 2));

        // Only push horizontally for now (Mario style)
        if (overlapX < overlapY) {
            // Determine relative direction
            if (b1.x < b2.x) {
                // b1 is left of b2
                b1.x -= overlapX * 0.5;
                b2.x += overlapX * 0.5;

                // Transfer momentum / Pushing
                if (b1.vx > 0) {
                    b2.vx = b1.vx * 0.8;
                }
            } else {
                // b1 is right of b2
                b1.x += overlapX * 0.5;
                b2.x -= overlapX * 0.5;
                if (b1.vx < 0) {
                    b2.vx = b1.vx * 0.8;
                }
            }
        } else {
            // Vertical - Land on top of each other?
            if (b1.y < b2.y) {
                b1.y -= overlapY;
                b1.grounded = true;
                b1.vy = 0;
            } else {
                b2.y -= overlapY;
                b2.grounded = true;
                b2.vy = 0;
            }
        }
    }
}
