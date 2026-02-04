class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = Constants.TILE_SIZE;
        this.height = Constants.TILE_SIZE;

        // Physics properties
        this.vx = 0;
        this.vy = 0;
        this.grounded = false;
        // Wall interaction
        this.wallSlide = false;
        this.wallDir = 0; // -1 left, 1 right

        this.moveSpeed = Constants.PLAYER_SPEED;
        this.jumpForce = Constants.JUMP_FORCE;
        this.dashSpeed = Constants.PLAYER_SPEED * 2.5;

        this.direction = 1; // 1 right, -1 left

        // Jump buffering and Coyote time
        this.jumpBufferTime = 0.1;
        this.jumpBufferTimer = 0;
        this.coyoteTime = 0.1;
        this.coyoteTimer = 0;

        // Dash
        this.canDash = true;
        this.isDashing = false;
        this.dashTime = 0.2;
        this.dashTimer = 0;
        this.dashCooldown = 1.0;
        this.dashCooldownTimer = 0;

        this.type = 'player';
    }

    update(dt, input) {
        // Cooldowns
        if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;

        // Dash Initiation
        if (input.isPressed('RUN') && this.canDash && !this.isDashing && this.dashCooldownTimer <= 0) {
            this.startDash();
        }

        if (this.isDashing) {
            this.dashTimer -= dt;
            this.vx = this.direction * this.dashSpeed;
            this.vy = 0; // Gravity defy during dash

            // Dash particles
            if (Math.random() > 0.5) {
                window.dispatchEvent(new CustomEvent('particles-emit', {
                    detail: { x: this.x + this.width / 2, y: this.y + this.height / 2, count: 1, color: '#00f3ff' }
                }));
            }

            if (this.dashTimer <= 0) {
                this.isDashing = false;
                this.vx = this.direction * this.moveSpeed; // Return to normal speed
            }
            return; // Skip normal movement logic during dash
        }

        // Horizontal Movement
        if (input.isDown('LEFT')) {
            this.vx = -this.moveSpeed;
            this.direction = -1;
        } else if (input.isDown('RIGHT')) {
            this.vx = this.moveSpeed;
            this.direction = 1;
        } else {
            this.vx = 0;
        }

        // Wall Slide Check (Simple check, assumes Physics updates wallDir)
        // Note: Physics engine needs to populate touchingWall info, doing basic check here?
        // Actually, let's rely on physics engine to set 'touchingWall' flag if we modify it.
        // For now, simple standard platformer:

        // Jump Logic
        // Coyote time
        if (this.grounded) {
            this.coyoteTimer = this.coyoteTime;
            this.canDash = true; // Reset dash on ground
        } else {
            this.coyoteTimer -= dt;
        }

        // Jump Buffering
        if (input.isPressed('JUMP')) {
            this.jumpBufferTimer = this.jumpBufferTime;
        } else {
            this.jumpBufferTimer -= dt;
        }

        // Execute Jump
        if (this.jumpBufferTimer > 0) {
            if (this.coyoteTimer > 0) {
                // Normal Jump
                this.vy = this.jumpForce;
                this.jumpBufferTimer = 0;
                this.coyoteTimer = 0;
                this.grounded = false;

                // Particles
                window.dispatchEvent(new CustomEvent('particles-emit', {
                    detail: { x: this.x + this.width / 2, y: this.y + this.height, count: 5, color: '#ffffff' }
                }));

            } else if (this.touchingWall && !this.grounded) {
                // Wall Jump
                this.vy = this.jumpForce;
                this.vx = -this.wallContact * this.moveSpeed * 1.5; // Kick off wall
                this.jumpBufferTimer = 0;

                window.dispatchEvent(new CustomEvent('particles-emit', {
                    detail: { x: this.wallContact > 0 ? this.x + this.width : this.x, y: this.y + this.height / 2, count: 5, color: '#ffffff' }
                }));
            }
        }

        // Variable Jump Height
        if (!input.isDown('JUMP') && this.vy < 0) {
            this.vy *= 0.5;
        }
    }

    startDash() {
        this.isDashing = true;
        this.dashTimer = this.dashTime;
        this.dashCooldownTimer = this.dashCooldown;
        this.canDash = false; // Only one dash in air until land?

        window.dispatchEvent(new CustomEvent('particles-emit', {
            detail: { x: this.x + this.width / 2, y: this.y + this.height / 2, count: 10, color: '#00f3ff' }
        }));
    }
}
