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

        this.moveSpeed = Constants.PLAYER_SPEED;
        this.jumpForce = Constants.JUMP_FORCE;

        this.direction = 1; // 1 right, -1 left

        // Jump buffering and Coyote time
        this.jumpBufferTime = 0.1;
        this.jumpBufferTimer = 0;
        this.coyoteTime = 0.1;
        this.coyoteTimer = 0;

        this.type = 'player';
    }

    update(dt, input) {
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

        // Jump Logic

        // Coyote time: we can jump shortly after leaving ground
        if (this.grounded) {
            this.coyoteTimer = this.coyoteTime;
        } else {
            this.coyoteTimer -= dt;
        }

        // Jump Buffering: remember jump press shortly before landing
        if (input.isPressed('JUMP')) {
            this.jumpBufferTimer = this.jumpBufferTime;
        } else {
            this.jumpBufferTimer -= dt;
        }

        // Execute Jump
        if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
            this.vy = this.jumpForce;
            this.jumpBufferTimer = 0;
            this.coyoteTimer = 0;
            this.grounded = false; // Immediately unground
        }

        // Variable Jump Height (release space to cut jump short)
        if (!input.isDown('JUMP') && this.vy < 0) {
            this.vy *= 0.5; // Dampen upward velocity
        }
    }
}
