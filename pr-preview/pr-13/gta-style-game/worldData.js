function generateCityGrid() {
    let gridRows = [];
    const cols = 50;
    const rows = 35;

    for (let y = 0; y < rows; y++) {
        let row = [];
        for (let x = 0; x < cols; x++) {
            // Create a border of buildings around the world
            if (y === 0 || y === rows - 1 || x === 0 || x === cols - 1) {
                row.push('B');
                continue;
            }

            // Grid of roads every 6 tiles
            let isHoriz = (y % 6 === 0);
            let isVert = (x % 6 === 0);

            if (isHoriz && isVert) {
                // Intersections
                if (Math.random() < 0.2) {
                    row.push('T'); // Traffic light intersection occasionally
                } else {
                    row.push('C'); // Standard crossroad
                }
            } else if (isHoriz) {
                row.push('H');
            } else if (isVert) {
                row.push('V');
            } else {
                // Inside blocks
                if (Math.random() < 0.1) {
                    row.push('E'); // Empty parks/alleys inside blocks
                } else {
                    row.push('B'); // Buildings
                }
            }
        }
        gridRows.push(row.join(' '));
    }
    return gridRows.join('\n');
}

const WORLD_DATA = generateCityGrid();
