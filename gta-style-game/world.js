// World generation and representation module

class World {
    constructor(width = 20, height = 20) {
        this.width = width;
        this.height = height;
        this.grid = [];
        this.roads = [];
        this.buildings = [];
        this.trafficLights = [];
        this.generate();
    }

    generate() {
        // Initialize empty grid
        this.grid = Array(this.height).fill().map(() => Array(this.width).fill('E'));

        // Generate roads (horizontal and vertical)
        const roadSpacing = Math.floor(this.width / 4);
        for (let y = roadSpacing; y < this.height; y += roadSpacing) {
            for (let x = 0; x < this.width; x++) {
                this.grid[y][x] = 'R';
            }
        }
        for (let x = roadSpacing; x < this.width; x += roadSpacing) {
            for (let y = 0; y < this.height; y++) {
                this.grid[y][x] = 'R';
            }
        }

        // Generate buildings
        const numBuildings = Math.floor((this.width * this.height) * 0.3);
        for (let i = 0; i < numBuildings; i++) {
            let x, y;
            let attempts = 0;
            do {
                x = Math.floor(Math.random() * this.width);
                y = Math.floor(Math.random() * this.height);
                attempts++;
            } while (this.grid[y][x] !== 'E' && attempts < 50);

            if (attempts < 50) {
                this.grid[y][x] = 'B';
            }
        }

        // Generate traffic lights at intersections
        for (let x = roadSpacing; x < this.width; x += roadSpacing) {
            for (let y = roadSpacing; y < this.height; y += roadSpacing) {
                this.grid[y][x] = 'T';
            }
        }

        // Convert grid to objects for game use
        this.convertToObjects();
    }

    convertToObjects() {
        const cellSize = 96; // Each cell represents 96x96 pixels in game world
        this.roads = [];
        this.buildings = [];
        this.trafficLights = [];

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const gameX = x * cellSize;
                const gameY = y * cellSize;

                switch (this.grid[y][x]) {
                    case 'R':
                        this.roads.push({
                            x: gameX,
                            y: gameY,
                            width: cellSize,
                            height: cellSize
                        });
                        break;
                    case 'B':
                        this.buildings.push({
                            x: gameX,
                            y: gameY,
                            width: cellSize,
                            height: cellSize
                        });
                        break;
                    case 'T':
                        this.trafficLights.push({
                            x: gameX + cellSize / 2,
                            y: gameY + cellSize / 2,
                            state: 'red',
                            timer: 0
                        });
                        break;
                }
            }
        }
    }

    toString() {
        let result = `World Map (${this.width}x${this.height})\n\n`;

        // Top border
        result += '+' + '---+'.repeat(this.width) + '\n';

        for (let y = 0; y < this.height; y++) {
            result += '|';
            for (let x = 0; x < this.width; x++) {
                result += ` ${this.grid[y][x]} |`;
            }
            result += '\n';

            // Separator line
            if (y < this.height - 1) {
                result += '+' + '---+'.repeat(this.width) + '\n';
            }
        }

        // Bottom border
        result += '+' + '---+'.repeat(this.width) + '\n';

        return result;
    }

    getWorldSize() {
        return {
            width: this.width * 96,
            height: this.height * 96
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = World;
}
