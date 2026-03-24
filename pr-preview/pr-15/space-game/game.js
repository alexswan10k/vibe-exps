class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(v) {
        return new Vector2(this.x + v.x, this.y + v.y);
    }

    multiply(scalar) {
        return new Vector2(this.x * scalar, this.y * scalar);
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    normalize() {
        const len = this.length();
        return len > 0 ? new Vector2(this.x / len, this.y / len) : new Vector2(0, 0);
    }
}

class Ship {
    constructor(x, y) {
        this.position = new Vector2(x, y);
        this.velocity = new Vector2(0, 0);
        this.angle = 0;
        this.thrust = 0.1;
        this.fuel = 100;
        this.maxFuel = 100;
        this.credits = 1000;
        this.cargo = {};
        this.size = 20;
    }

    update(canvas) {
        // Apply thrust
        if (keys.w || keys.a || keys.s || keys.d) {
            const thrustVector = new Vector2(
                Math.cos(this.angle) * this.thrust,
                Math.sin(this.angle) * this.thrust
            );

            if (keys.w) this.velocity = this.velocity.add(thrustVector);
            if (keys.s) this.velocity = this.velocity.add(thrustVector.multiply(-0.5));
            if (keys.a) this.angle -= 0.05;
            if (keys.d) this.angle += 0.05;

            this.fuel = Math.max(0, this.fuel - 0.1);
        }

        // Brake
        if (keys[' ']) {
            this.velocity = this.velocity.multiply(0.95);
        }

        // Update position
        this.position = this.position.add(this.velocity);
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.angle);

        // Draw ship
        ctx.fillStyle = '#00ff00';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.size, 0);
        ctx.lineTo(-this.size/2, -this.size/2);
        ctx.lineTo(-this.size/4, 0);
        ctx.lineTo(-this.size/2, this.size/2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw thrust
        if (keys.w) {
            ctx.fillStyle = '#ff4400';
            ctx.beginPath();
            ctx.moveTo(-this.size/4, -this.size/4);
            ctx.lineTo(-this.size * 1.5, 0);
            ctx.lineTo(-this.size/4, this.size/4);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }
}

class Planet {
    constructor(x, y, radius, name, type = 'planet') {
        this.position = new Vector2(x, y);
        this.radius = radius;
        this.name = name;
        this.type = type;
        this.color = type === 'station' ? '#ffff00' : '#4444ff';
        this.resources = this.generateResources();
    }

    generateResources() {
        const goods = ['Fuel', 'Food', 'Water', 'Minerals', 'Technology'];
        const resources = {};
        goods.forEach(good => {
            resources[good] = {
                price: Math.floor(Math.random() * 100) + 10,
                quantity: Math.floor(Math.random() * 100) + 10
            };
        });
        return resources;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw name
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, this.position.x, this.position.y - this.radius - 10);
    }

    checkCollision(point) {
        const distance = Math.sqrt(
            Math.pow(point.x - this.position.x, 2) +
            Math.pow(point.y - this.position.y, 2)
        );
        return distance < this.radius;
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();

        this.ship = new Ship(0, 0);
        this.camera = new Vector2(0, 0);
        this.planets = this.generatePlanets();
        this.mousePos = new Vector2(0, 0);
        this.paused = false;

        this.setupEventListeners();
        this.gameLoop();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.canvas.style.width = window.innerWidth + 'px';
        this.canvas.style.height = window.innerHeight + 'px';
    }

    generatePlanets() {
        const planets = [];
        const numPlanets = 8;

        for (let i = 0; i < numPlanets; i++) {
            const x = Math.random() * this.canvas.width;
            const y = Math.random() * this.canvas.height;
            const radius = Math.random() * 30 + 20;
            const name = ['Earth', 'Mars', 'Venus', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'][i] || `Planet ${i}`;
            const type = Math.random() > 0.7 ? 'station' : 'planet';

            planets.push(new Planet(x, y, radius, name, type));
        }

        return planets;
    }

    setupEventListeners() {
        // Keyboard
        window.addEventListener('keydown', (e) => {
            keys[e.key.toLowerCase()] = true;
        });

        window.addEventListener('keyup', (e) => {
            keys[e.key.toLowerCase()] = false;
        });

        // Mouse
        this.canvas.addEventListener('mousemove', (e) => {
            this.mousePos.x = e.clientX + this.camera.x;
            this.mousePos.y = e.clientY + this.camera.y;

            // Calculate angle to mouse
            const dx = this.mousePos.x - this.ship.position.x;
            const dy = this.mousePos.y - this.ship.position.y;
            this.ship.angle = Math.atan2(dy, dx);
        });

        // Click to land
        this.canvas.addEventListener('click', (e) => {
            const clickPos = new Vector2(e.clientX + this.camera.x, e.clientY + this.camera.y);

            for (const planet of this.planets) {
                if (planet.checkCollision(clickPos)) {
                    this.landOnPlanet(planet);
                    break;
                }
            }
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
    }

    landOnPlanet(planet) {
        // Check if close enough
        const distance = this.ship.position.add(planet.position.multiply(-1)).length();
        if (distance < planet.radius + 50) {
            this.currentPlanet = planet;
            this.showTradePanel(planet);
        }
    }

    showTradePanel(planet) {
        const panel = document.getElementById('trade-panel');
        const stationName = document.getElementById('station-name');
        const tradeGoods = document.getElementById('trade-goods');

        stationName.textContent = planet.name;
        tradeGoods.innerHTML = '';

        Object.entries(planet.resources).forEach(([good, data]) => {
            const div = document.createElement('div');
            div.innerHTML = `
                ${good}: ${data.price} credits (${data.quantity} available)
                <button class="button" onclick="buyGood('${good}', ${data.price})">Buy</button>
                <button class="button" onclick="sellGood('${good}', ${data.price})">Sell</button>
            `;
            tradeGoods.appendChild(div);
        });

        panel.style.display = 'block';
        this.paused = true;
    }

    updateUI() {
        document.getElementById('fuel').textContent = Math.floor(this.ship.fuel);
        document.getElementById('credits').textContent = this.ship.credits;
        document.getElementById('velocity').textContent = Math.floor(this.ship.velocity.length() * 10) / 10;

        // Find nearest planet
        let nearestPlanet = null;
        let minDistance = Infinity;

        for (const planet of this.planets) {
            const distance = this.ship.position.add(planet.position.multiply(-1)).length();
            if (distance < minDistance) {
                minDistance = distance;
                nearestPlanet = planet;
            }
        }

        document.getElementById('location').textContent = nearestPlanet ? nearestPlanet.name : 'Deep Space';
    }

    gameLoop() {
        // Update only if not paused
        if (!this.paused) {
            this.ship.update(this.canvas);

            // Update camera to follow ship
            this.camera.x = this.ship.position.x - this.canvas.width / 2;
            this.camera.y = this.ship.position.y - this.canvas.height / 2;
        }

        // Draw
        this.ctx.fillStyle = '#000011';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Save context for camera transform
        this.ctx.save();
        this.ctx.translate(-this.camera.x, -this.camera.y);

        // Draw stars (fixed to world space, not camera)
        this.ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 200; i++) {
            const x = (i * 37 + this.camera.x * 0.1) % this.canvas.width + this.camera.x;
            const y = (i * 23 + this.camera.y * 0.1) % this.canvas.height + this.camera.y;
            this.ctx.fillRect(x, y, 1, 1);
        }

        // Draw planets
        this.planets.forEach(planet => planet.draw(this.ctx));

        // Draw ship
        this.ship.draw(this.ctx);

        // Restore context
        this.ctx.restore();

        // Update UI
        this.updateUI();

        requestAnimationFrame(() => this.gameLoop());
    }
}

// Global functions for trading
function buyGood(good, price) {
    if (game.ship.credits >= price) {
        game.ship.credits -= price;
        game.currentPlanet.resources[good].quantity--;
        game.ship.cargo[good] = (game.ship.cargo[good] || 0) + 1;
        updateTradePanel();
    }
}

function sellGood(good, price) {
    if (game.ship.cargo[good] > 0) {
        game.ship.credits += price;
        game.currentPlanet.resources[good].quantity++;
        game.ship.cargo[good]--;
        updateTradePanel();
    }
}

function closeTrade() {
    document.getElementById('trade-panel').style.display = 'none';
    game.paused = false;
}

function updateTradePanel() {
    if (game.currentPlanet) {
        game.showTradePanel(game.currentPlanet);
    }
}

// Initialize game
const keys = {};
let game;

window.addEventListener('load', () => {
    game = new Game();
});
