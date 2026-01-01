function getDistance(obj1, obj2) {
    const dx = obj1.x - obj2.x;
    const dy = obj1.y - obj2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function isColliding(circle1, circle2) {
    const distance = getDistance(circle1, circle2);
    return distance < (circle1.radius + circle2.radius);
}

// Convert grid coordinates to pixel coordinates (center of tile)
function gridToPixel(col, row, tileSize) {
    return {
        x: col * tileSize + tileSize / 2,
        y: row * tileSize + tileSize / 2
    };
}

// Convert pixel coordinates to grid coordinates
function pixelToGrid(x, y, tileSize) {
    return {
        col: Math.floor(x / tileSize),
        row: Math.floor(y / tileSize)
    };
}