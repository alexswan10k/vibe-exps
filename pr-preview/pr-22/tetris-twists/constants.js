const CONSTANTS = {
    COLS: 10,
    ROWS: 20,
    BLOCK_SIZE: 30, // 30px per block
    WIDTH: 300,     // 10 * 30
    HEIGHT: 600,    // 20 * 30

    BASE_DROP_INTERVAL: 1000, // Starting speed (ms)
    MIN_DROP_INTERVAL: 100,
    SPEED_MULTIPLIER: 0.85,
    LINES_PER_LEVEL: 10
};

// Colors scheme for blocks with neon feel
const COLORS = {
    0: null,
    1: '#00ffff', // I - Cyan
    2: '#0000ff', // J - Blue
    3: '#ff7f00', // L - Orange
    4: '#ffff00', // O - Yellow
    5: '#00ff00', // S - Green
    6: '#800080', // T - Purple
    7: '#ff0000', // Z - Red
    8: '#ffffff'  // BOMB - White
};

// We define shapes as coordinates within their local bounding box matrix.
// 0=empty, non-zero=color index
const SHAPES = [
    null, // Index 0 is empty
    [ // I - 1
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ],
    [ // J - 2
        [2, 0, 0],
        [2, 2, 2],
        [0, 0, 0]
    ],
    [ // L - 3
        [0, 0, 3],
        [3, 3, 3],
        [0, 0, 0]
    ],
    [ // O - 4
        [4, 4],
        [4, 4]
    ],
    [ // S - 5
        [0, 5, 5],
        [5, 5, 0],
        [0, 0, 0]
    ],
    [ // T - 6
        [0, 6, 0],
        [6, 6, 6],
        [0, 0, 0]
    ],
    [ // Z - 7
        [7, 7, 0],
        [0, 7, 7],
        [0, 0, 0]
    ],
    [ // BOMB - 8
        [8]
    ]
];
