class GameMap {
    constructor() {
        this.width = MAP_WIDTH;
        this.height = MAP_HEIGHT;
        this.grid = [];
        this.waypoints = [];
        this.init();
    }

    init() {
        // Initialize empty grid (0 = buildable, 1 = path/blocked)
        for (let y = 0; y < this.height; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.width; x++) {
                this.grid[y][x] = 0;
            }
        }

        // Define a simple winding path
        // Start from left, go right, down, left, down, right to end
        this.waypoints = [
            { col: 0, row: 2 },
            { col: 3, row: 2 },
            { col: 3, row: 8 },
            { col: 8, row: 8 },
            { col: 8, row: 4 },
            { col: 12, row: 4 },
            { col: 12, row: 9 },
            { col: 15, row: 9 }
        ];

        this.carvePath();
    }

    carvePath() {
        if (this.waypoints.length < 2) return;

        for (let i = 0; i < this.waypoints.length - 1; i++) {
            const start = this.waypoints[i];
            const end = this.waypoints[i + 1];

            let currCol = start.col;
            let currRow = start.row;

            // Mark start point
            this.grid[currRow][currCol] = 1;

            while (currCol !== end.col || currRow !== end.row) {
                if (currCol < end.col) currCol++;
                else if (currCol > end.col) currCol--;
                else if (currRow < end.row) currRow++;
                else if (currRow > end.row) currRow--;

                this.grid[currRow][currCol] = 1;
            }
        }
    }

    isBuildable(col, row) {
        if (col < 0 || col >= this.width || row < 0 || row >= this.height) return false;
        return this.grid[row][col] === 0;
    }

    setOccupied(col, row) {
        if (this.isBuildable(col, row)) {
            this.grid[row][col] = 2; // 2 = tower
            return true;
        }
        return false;
    }

    getWaypointsPixels() {
        return this.waypoints.map(p => ({
            x: p.col * TILE_SIZE + TILE_SIZE / 2,
            y: p.row * TILE_SIZE + TILE_SIZE / 2
        }));
    }
}