class Entity {
    constructor(x, y, w, h, type) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
        this.type = type;
        this.color = '#fff';
    }

    update(dt) { }
    draw(renderer) {
        renderer.drawRect(this.x, this.y, this.width, this.height, this.color);
    }
}

class PushBlock extends Entity {
    constructor(x, y) {
        super(x, y, Constants.TILE_SIZE, Constants.TILE_SIZE, 'block');
        this.color = '#ffaa00';

        // Physics props
        this.vx = 0;
        this.vy = 0;
        this.grounded = false;
        this.hasGravity = true;
    }

    // Physics handled by Physics engine, but we might want custom logic here
}

class Collectible extends Entity {
    constructor(x, y) {
        super(x, y, 20, 20, 'collectible');
        this.color = '#00ff00';
        this.remove = false;
        this.floatY = 0;
        this.floatTime = 0;
        this.baseY = y;
    }

    update(dt) {
        this.floatTime += dt * 3;
        this.floatY = Math.sin(this.floatTime) * 5;
        this.y = this.baseY + this.floatY;
    }

    onCollide(body) {
        if (body.type === 'player') {
            this.remove = true;
            // Add score or event
            window.dispatchEvent(new CustomEvent('score-add', { detail: { amount: 100 } }));
            window.dispatchEvent(new CustomEvent('particles-emit', {
                detail: { x: this.x + 10, y: this.y + 10, count: 10, color: '#00ff00' }
            }));
        }
    }

    draw(renderer) {
        renderer.drawRect(this.x, this.y, this.width, this.height, this.color, true);
    }
}
