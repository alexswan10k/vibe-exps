// World generation and representation module

class World {
    constructor(grid) {
        this.grid = grid;
        this.height = grid.length;
        this.width = grid[0].length;
        this.roads = [];
        this.horizontalRoads = [];
        this.verticalRoads = [];
        this.crossroads = [];
        this.buildings = [];
        this.trafficLights = [];
        this.convertToObjects();
    }

    static loadFromEmbedded() {
        const lines = WORLD_DATA.trim().split('\n');
        const grid = lines.map(line => line.trim().split(/\s+/));
        return new World(grid);
    }

    static async loadFromFile(filePath) {
        const response = await fetch(filePath);
        const text = await response.text();
        const lines = text.trim().split('\n');
        const grid = lines.map(line => line.trim().split(/\s+/));
        return new World(grid);
    }

    convertToObjects() {
        const cellSize = 96; // Each cell represents 96x96 pixels in game world
        this.roads = [];
        this.horizontalRoads = [];
        this.verticalRoads = [];
        this.crossroads = [];
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
                    case 'H':
                        this.horizontalRoads.push({
                            x: gameX,
                            y: gameY,
                            width: cellSize,
                            height: cellSize
                        });
                        break;
                    case 'V':
                        this.verticalRoads.push({
                            x: gameX,
                            y: gameY,
                            width: cellSize,
                            height: cellSize
                        });
                        break;
                    case 'C':
                        this.crossroads.push({
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
