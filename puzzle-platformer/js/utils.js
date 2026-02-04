const Utils = {
    // Clamp a number between min and max
    clamp: (val, min, max) => Math.min(Math.max(val, min), max),

    // Linear interpolation
    lerp: (start, end, t) => start * (1 - t) + end * t,

    // Check intersection between two AABB (Axis aligned bounding box)
    // Rect format: {x, y, width, height}
    rectIntersect: (r1, r2) => {
        return r1.x < r2.x + r2.width &&
            r1.x + r1.width > r2.x &&
            r1.y < r2.y + r2.height &&
            r1.y + r1.height > r2.y;
    },

    // Random integer between min and max (inclusive)
    randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,

    // Random float between min and max
    randomRange: (min, max) => Math.random() * (max - min) + min,

    // Check if point is inside rect
    pointInRect: (x, y, rect) => {
        return x >= rect.x && x <= rect.x + rect.width &&
            y >= rect.y && y <= rect.y + rect.height;
    }
};

const Constants = {
    GRAVITY: 800, // pixels per second squared - adjusted for game feel
    TERMINAL_VELOCITY: 1000,
    PLAYER_SPEED: 300,
    JUMP_FORCE: -450,
    TILE_SIZE: 48,
    SCREEN_WIDTH: 1280,
    SCREEN_HEIGHT: 720
};
