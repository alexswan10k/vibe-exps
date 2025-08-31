// Physics Sandbox using Matter.js

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Set canvas to fill viewport
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Create Matter.js engine
const engine = Matter.Engine.create();
const world = engine.world;

// Create renderer
const render = Matter.Render.create({
    canvas: canvas,
    engine: engine,
    options: {
        width: canvas.width,
        height: canvas.height,
        wireframes: false,
        background: 'transparent'
    }
});

// Add walls
const wallThickness = 50;
const ground = Matter.Bodies.rectangle(canvas.width / 2, canvas.height + wallThickness / 2, canvas.width, wallThickness, { isStatic: true });
const leftWall = Matter.Bodies.rectangle(-wallThickness / 2, canvas.height / 2, wallThickness, canvas.height, { isStatic: true });
const rightWall = Matter.Bodies.rectangle(canvas.width + wallThickness / 2, canvas.height / 2, wallThickness, canvas.height, { isStatic: true });
const ceiling = Matter.Bodies.rectangle(canvas.width / 2, -wallThickness / 2, canvas.width, wallThickness, { isStatic: true });

Matter.World.add(world, [ground, leftWall, rightWall, ceiling]);

// Add mouse control
const mouse = Matter.Mouse.create(canvas);
const mouseConstraint = Matter.MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
        stiffness: 0.2,
        render: {
            visible: false
        }
    }
});
Matter.World.add(world, mouseConstraint);

// Run the engine and renderer
Matter.Engine.run(engine);
Matter.Render.run(render);

// Function to add a square
function addSquare() {
    const size = Math.random() * 40 + 20;
    const x = Math.random() * (canvas.width - size * 2) + size;
    const y = 50;
    const square = Matter.Bodies.rectangle(x, y, size, size, {
        render: {
            fillStyle: `hsl(${Math.random() * 360}, 70%, 60%)`
        }
    });
    Matter.World.add(world, square);
}

// Function to add a circle
function addCircle() {
    const radius = Math.random() * 20 + 10;
    const x = Math.random() * (canvas.width - radius * 2) + radius;
    const y = 50;
    const circle = Matter.Bodies.circle(x, y, radius, {
        render: {
            fillStyle: `hsl(${Math.random() * 360}, 70%, 60%)`
        }
    });
    Matter.World.add(world, circle);
}

// Function to clear all bodies
function clearAll() {
    const bodies = Matter.Composite.allBodies(world);
    bodies.forEach(body => {
        if (!body.isStatic) {
            Matter.World.remove(world, body);
        }
    });
}

// Add some initial objects
for (let i = 0; i < 5; i++) {
    addSquare();
    addCircle();
}

// Variables for continuous application
let windInterval = null;
let vacuumInterval = null;
let currentMousePos = { x: 0, y: 0 };

// Event listeners for wind and vacuum
canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mouseup', handleMouseUp);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('contextmenu', (event) => event.preventDefault());

// Handle mouse down for wind or vacuum
function handleMouseDown(event) {
    const rect = canvas.getBoundingClientRect();
    currentMousePos.x = event.clientX - rect.left;
    currentMousePos.y = event.clientY - rect.top;

    if (event.button === 0) { // Left button for wind
        startWind();
    } else if (event.button === 2) { // Right button for vacuum
        startVacuum();
    }
}

// Handle mouse up to stop
function handleMouseUp(event) {
    if (event.button === 0) {
        stopWind();
    } else if (event.button === 2) {
        stopVacuum();
    }
}

// Handle mouse move to update position
function handleMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    currentMousePos.x = event.clientX - rect.left;
    currentMousePos.y = event.clientY - rect.top;
}

// Start continuous wind
function startWind() {
    if (windInterval) return;
    windInterval = setInterval(() => {
        applyWind(currentMousePos.x, currentMousePos.y);
    }, 50); // Apply every 50ms
}

// Stop wind
function stopWind() {
    if (windInterval) {
        clearInterval(windInterval);
        windInterval = null;
    }
}

// Start continuous vacuum
function startVacuum() {
    if (vacuumInterval) return;
    vacuumInterval = setInterval(() => {
        applyVacuum(currentMousePos.x, currentMousePos.y);
    }, 50); // Apply every 50ms
}

// Stop vacuum
function stopVacuum() {
    if (vacuumInterval) {
        clearInterval(vacuumInterval);
        vacuumInterval = null;
    }
}

// Apply wind force away from mouse point
function applyWind(mouseX, mouseY) {
    const bodies = Matter.Composite.allBodies(world).filter(body => !body.isStatic);
    bodies.forEach(body => {
        const dx = body.position.x - mouseX;
        const dy = body.position.y - mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0) {
            const forceMagnitude = 0.005; // Adjust for wind strength
            const forceX = (dx / distance) * forceMagnitude;
            const forceY = (dy / distance) * forceMagnitude;
            Matter.Body.applyForce(body, body.position, { x: forceX, y: forceY });
        }
    });
}

// Apply vacuum force towards mouse point
function applyVacuum(mouseX, mouseY) {
    const bodies = Matter.Composite.allBodies(world).filter(body => !body.isStatic);
    bodies.forEach(body => {
        const dx = mouseX - body.position.x;
        const dy = mouseY - body.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0) {
            const forceMagnitude = 0.005; // Adjust for vacuum strength
            const forceX = (dx / distance) * forceMagnitude;
            const forceY = (dy / distance) * forceMagnitude;
            Matter.Body.applyForce(body, body.position, { x: forceX, y: forceY });
        }
    });
}
