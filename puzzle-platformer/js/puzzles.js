class Button extends Entity {
    constructor(x, y, id) {
        super(x, y + Constants.TILE_SIZE - 10, Constants.TILE_SIZE, 10, 'button');
        this.color = '#ff0055';
        this.id = id;
        this.isPressed = false;
        this.pressColor = '#550022';
        this.originalY = this.y;
    }

    update(dt) {
        // Check collision in Physics or here?
        // Physics engine handles trigger resolution. 
        // We need 'onCollide' to be persistent if body stays on it.
    }

    onCollide(body) {
        if (!this.isPressed && (body.type === 'player' || body.type === 'block')) {
            this.press();
        }
    }

    press() {
        this.isPressed = true;
        this.y = this.originalY + 5;
        this.color = this.pressColor;
        window.dispatchEvent(new CustomEvent('puzzle-trigger', { detail: { id: this.id, state: true } }));
    }

    // Reset if nothing on it? Complex without persistent collision list.
}

class Door extends Entity {
    constructor(x, y, id) {
        super(x, y, 20, Constants.TILE_SIZE * 2, 'door');
        this.color = '#ff0055';
        this.id = id;
        this.isOpen = false;
        this.targetH = 0;
        this.originalH = this.height;
    }

    open() {
        this.isOpen = true;
        // Make it non-collidable?
        // For now just shrink visuals, physics needs update
        this.remove = true; // Simple "Open" = destroy for now

        window.dispatchEvent(new CustomEvent('particles-emit', {
            detail: { x: this.x + 10, y: this.y + 20, count: 20, color: '#ff0055' }
        }));
    }
}
