const TILE_SIZE = 64;
const MAP_WIDTH = 16; // 1024 / 64
const MAP_HEIGHT = 12; // 768 / 64
const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 768;

const TOWERS = {
    basic: {
        name: 'Basic',
        cost: 50,
        range: 3.5, // in tiles
        damage: 10,
        rate: 1.0, // shots per second
        color: '#3498db',
        projectileSpeed: 8,
        description: 'Balanced damage and fire rate.'
    },
    rapid: {
        name: 'Rapid',
        cost: 120,
        range: 3,
        damage: 4,
        rate: 4.0,
        color: '#e67e22',
        projectileSpeed: 10,
        description: 'Fast firing, low damage.'
    },
    sniper: {
        name: 'Sniper',
        cost: 200,
        range: 7,
        damage: 50,
        rate: 0.5,
        color: '#9b59b6',
        projectileSpeed: 20,
        description: 'Long range, high damage, slow fire.'
    },
    aoe: {
        name: 'Cannon',
        cost: 300,
        range: 4,
        damage: 20,
        rate: 0.8,
        color: '#e74c3c',
        projectileSpeed: 6,
        radius: 2, // AoE radius in tiles
        description: 'Area of effect damage.'
    }
};

const ENEMIES = {
    basic: {
        hp: 20,
        speed: 2, // pixels per frame
        reward: 5,
        color: '#2ecc71',
        radius: 12
    },
    fast: {
        hp: 15,
        speed: 4,
        reward: 8,
        color: '#f1c40f',
        radius: 10
    },
    tank: {
        hp: 100,
        speed: 1,
        reward: 20,
        color: '#34495e',
        radius: 18
    },
    boss: {
        hp: 500,
        speed: 0.5,
        reward: 100,
        color: '#8e44ad',
        radius: 25
    }
};

const WAVES = [
    { count: 5, type: 'basic', interval: 1500 },
    { count: 10, type: 'basic', interval: 1000 },
    { count: 5, type: 'fast', interval: 1000 },
    { count: 10, type: 'fast', interval: 800 },
    { count: 5, type: 'tank', interval: 2000 },
    { count: 15, type: 'basic', interval: 500 },
    { count: 10, type: 'tank', interval: 1500 },
    { count: 30, type: 'fast', interval: 300 },
    { count: 1, type: 'boss', interval: 1000 },
    { count: 50, type: 'basic', interval: 200 }
];