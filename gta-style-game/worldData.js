// World Data Generator with 6 Themed Districts, Water Shoreline, and Landmarks

function generateCityGrid() {
    const cols = 56;
    const rows = 40;
    let grid = [];

    // Initialize grid
    for (let y = 0; y < rows; y++) {
        grid[y] = [];
        for (let x = 0; x < cols; x++) {
            grid[y][x] = 'B';
        }
    }

    // Determine district for each tile
    // 1. Ocean & Beach: East coast (cols 48 to 55)
    // 2. Downtown: North-East (cols 28 to 47, rows 0 to 18)
    // 3. Port / Industrial: North-West (cols 0 to 27, rows 0 to 16)
    // 4. Central Park: Center-South (cols 20 to 36, rows 19 to 30)
    // 5. Chinatown / Neon: Center-West (cols 0 to 19, rows 17 to 28)
    // 6. Suburbs: South-West & South (cols 0 to 47, rows 29 to 39)

    // Build Road Network (Avenues every 6 tiles, with coastal boulevard)
    let hRoads = [3, 9, 15, 21, 27, 33, 38];
    let vRoads = [3, 9, 15, 21, 27, 33, 39, 46];

    for (let r of hRoads) {
        if (r < rows) {
            for (let x = 0; x < cols; x++) {
                grid[r][x] = 'H';
            }
        }
    }

    for (let c of vRoads) {
        if (c < cols) {
            for (let y = 0; y < rows; y++) {
                if (grid[y][c] === 'H') {
                    grid[y][c] = (Math.random() < 0.25) ? 'T' : 'C'; // Intersection
                } else {
                    grid[y][c] = 'V';
                }
            }
        }
    }

    // Fill Ocean & Beach on the East
    for (let y = 0; y < rows; y++) {
        for (let x = 48; x < cols; x++) {
            if (x >= 51) {
                grid[y][x] = 'W'; // Deep animated ocean
            } else if (x === 50) {
                grid[y][x] = 'W_COAST'; // Shoreline wave foam
            } else if (x === 48 || x === 49) {
                grid[y][x] = 'SAND'; // Beach sand with palm trees & deck chairs
            }
        }
    }

    // Central Park & Pond (cols 22 to 32, rows 22 to 26)
    for (let y = 22; y <= 26; y++) {
        for (let x = 22; x <= 32; x++) {
            if (grid[y][x] !== 'H' && grid[y][x] !== 'V' && grid[y][x] !== 'C' && grid[y][x] !== 'T') {
                if (x >= 25 && x <= 29 && y >= 23 && y <= 25) {
                    grid[y][x] = 'W_POND'; // Central park pond
                } else {
                    grid[y][x] = 'PARK'; // Lush park grass
                }
            }
        }
    }

    // Industrial Port Docks (North-West: cols 4 to 14, rows 4 to 8)
    for (let y = 4; y <= 8; y++) {
        for (let x = 4; x <= 14; x++) {
            if (grid[y][x] !== 'H' && grid[y][x] !== 'V' && grid[y][x] !== 'C' && grid[y][x] !== 'T') {
                if ((x + y) % 3 === 0) {
                    grid[y][x] = 'CONT'; // Cargo container stack
                } else if ((x + y) % 3 === 1) {
                    grid[y][x] = 'B_IND'; // Warehouse
                } else {
                    grid[y][x] = 'E_DOCK'; // Concrete dockyard
                }
            }
        }
    }

    // Chinatown District (cols 4 to 14, rows 18 to 20)
    for (let y = 16; y <= 20; y++) {
        for (let x = 4; x <= 14; x++) {
            if (grid[y][x] !== 'H' && grid[y][x] !== 'V' && grid[y][x] !== 'C' && grid[y][x] !== 'T') {
                grid[y][x] = 'B_CT'; // Chinatown red/gold building
            }
        }
    }

    // Downtown Skyscrapers (cols 28 to 45, rows 4 to 14)
    for (let y = 4; y <= 14; y++) {
        for (let x = 28; x <= 45; x++) {
            if (grid[y][x] !== 'H' && grid[y][x] !== 'V' && grid[y][x] !== 'C' && grid[y][x] !== 'T') {
                grid[y][x] = 'B_DT'; // Glass skyscraper
            }
        }
    }

    // Suburbs Residential (rows 29 to 37)
    for (let y = 28; y <= 37; y++) {
        for (let x = 4; x <= 45; x++) {
            if (grid[y][x] !== 'H' && grid[y][x] !== 'V' && grid[y][x] !== 'C' && grid[y][x] !== 'T') {
                if (Math.random() < 0.15) {
                    grid[y][x] = 'POOL'; // Backyard swimming pool
                } else if (Math.random() < 0.2) {
                    grid[y][x] = 'GARDEN'; // Lawn garden
                } else {
                    grid[y][x] = 'B_SUB'; // Suburban home
                }
            }
        }
    }

    // Place Key Landmarks & Interactive Services
    // 1. Pay 'n' Spray Garage (Downtown near highway: x:34, y:8)
    grid[8][34] = 'PNS';

    // 2. Ammu-Nation Gun Store (Chinatown: x:10, y:18)
    grid[18][10] = 'AMMU';

    // 3. Burger Shot Diner (Central Plaza: x:22, y:20)
    grid[20][22] = 'DINER';

    // 4. General Hospital (Suburbs / East: x:40, y:30)
    grid[30][40] = 'HOSP';

    // 5. Police Headquarters (North Port: x:16, y:8)
    grid[8][16] = 'PD';

    // 6. Stunt Ramps in strategic spots
    grid[9][45] = 'RAMP_E';  // Ocean jump towards beach
    grid[21][20] = 'RAMP_E'; // Canal jump over park
    grid[15][14] = 'RAMP_W'; // Port alley jump
    grid[27][38] = 'RAMP_N'; // Highway overpass jump

    // World Border Walls
    for (let y = 0; y < rows; y++) {
        grid[y][0] = 'B_BORDER';
        grid[y][cols - 1] = 'W'; // Outer ocean edge
    }
    for (let x = 0; x < cols; x++) {
        grid[0][x] = 'B_BORDER';
        grid[rows - 1][x] = 'B_BORDER';
    }

    // Convert to lines
    let lines = [];
    for (let y = 0; y < rows; y++) {
        lines.push(grid[y].join(' '));
    }
    return lines.join('\n');
}

function getDistrictNameAt(worldX, worldY) {
    let col = Math.floor(worldX / 96);
    let row = Math.floor(worldY / 96);

    if (col >= 48) return "Ocean Beach & Marina";
    if (row <= 16 && col <= 20) return "Port Authority Docks";
    if (row <= 16 && col > 20) return "Downtown Financial District";
    if (row > 16 && row <= 27 && col <= 20) return "Chinatown & Red Light";
    if (row > 18 && row <= 28 && col > 20 && col <= 36) return "Central Park & Plaza";
    return "Sunrise Suburbs";
}

const WORLD_DATA = generateCityGrid();
