// pinball-game/script.js

const Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      Body = Matter.Body,
      Composite = Matter.Composite,
      Constraint = Matter.Constraint,
      Events = Matter.Events,
      Vector = Matter.Vector;

const WIDTH = 600;
const HEIGHT = 800;
const MAX_BALLS = 3;
const BALL_RADIUS = 12;

// State
let score = 0;
let ballsRemaining = MAX_BALLS;
let ball = null;
let isPlaying = true;
let isPlunging = false;
let plungeForce = 0;

// UI
const scoreEl = document.getElementById('score');
const ballsEl = document.getElementById('balls');
const canvas = document.getElementById('pinball-canvas');

// Engine
const engine = Engine.create({
    positionIterations: 12,
    velocityIterations: 10,
    constraintIterations: 8,
    gravity: { x: 0, y: 1.5, scale: 0.001 } // Stronger gravity feels better
});
const world = engine.world;

const render = Render.create({
    canvas: canvas,
    engine: engine,
    options: {
        width: WIDTH,
        height: HEIGHT,
        wireframes: false,
        background: '#111' // Darker arcade background
    }
});

// Collision Masks
const CAT_DEFAULT = 0x0001;
const CAT_BALL = 0x0002;
const CAT_FLIPPER = 0x0004;
const CAT_STOPPER = 0x0008;

// Map Geometry
const buildMap = () => {
    const wallOpt = {
        isStatic: true,
        render: { fillStyle: '#333' },
        friction: 0
    };

    // Outer Walls
    const leftWall = Bodies.rectangle(10, HEIGHT/2, 20, HEIGHT, wallOpt);
    const rightWall = Bodies.rectangle(WIDTH-10, HEIGHT/2, 20, HEIGHT, wallOpt);
    const topWall = Bodies.rectangle(WIDTH/2, 10, WIDTH, 20, wallOpt);

    // Shooter Lane Divider (40px lane)
    const shooterDivider = Bodies.rectangle(WIDTH - 50, HEIGHT - 250, 10, 500, wallOpt);

    // Top Right Deflector Arc (Simulation using angled blocks)
    const deflector1 = Bodies.rectangle(WIDTH - 60, 50, 150, 20, { ...wallOpt, angle: Math.PI / 4 });
    const deflector2 = Bodies.rectangle(WIDTH - 150, 30, 100, 20, { ...wallOpt, angle: Math.PI / 8 });

    // Lower Slants
    const leftSlant = Bodies.rectangle(100, HEIGHT - 180, 220, 20, { ...wallOpt, angle: Math.PI / 6 });
    const rightSlant = Bodies.rectangle(WIDTH - 160, HEIGHT - 180, 220, 20, { ...wallOpt, angle: -Math.PI / 6 });

    // Shooter Floor
    const shooterFloor = Bodies.rectangle(WIDTH - 25, HEIGHT - 10, 50, 20, wallOpt);

    Composite.add(world, [
        leftWall, rightWall, topWall,
        shooterDivider, deflector1, deflector2,
        leftSlant, rightSlant, shooterFloor
    ]);
};

// Flippers
const flippers = { left: null, right: null };
const buildFlippers = () => {
    const fWidth = 90;
    const fHeight = 16;
    const y = HEIGHT - 80;

    const leftPivotX = 170;
    const rightPivotX = WIDTH - 230; // 60px gap for drain

    const fOpt = {
        density: 0.1, // Heavy so ball doesn't push them down
        friction: 0.1,
        render: { fillStyle: '#e74c3c' },
        collisionFilter: { category: CAT_FLIPPER, mask: CAT_DEFAULT | CAT_BALL | CAT_STOPPER }
    };

    // Left Flipper
    const leftF = Bodies.rectangle(leftPivotX + fWidth/2, y, fWidth, fHeight, fOpt);
    const leftHinge = Constraint.create({
        pointA: { x: leftPivotX, y: y },
        bodyB: leftF,
        pointB: { x: -fWidth/2 + 10, y: 0 },
        stiffness: 1, length: 0, render: { visible: false }
    });

    // Right Flipper
    const rightF = Bodies.rectangle(rightPivotX - fWidth/2, y, fWidth, fHeight, fOpt);
    const rightHinge = Constraint.create({
        pointA: { x: rightPivotX, y: y },
        bodyB: rightF,
        pointB: { x: fWidth/2 - 10, y: 0 },
        stiffness: 1, length: 0, render: { visible: false }
    });

    // Stoppers (Invisible limits)
    const stopOpt = {
        isStatic: true,
        render: { visible: false },
        collisionFilter: { category: CAT_STOPPER, mask: CAT_FLIPPER } // ONLY hit flippers
    };

    const lStopUp = Bodies.circle(leftPivotX + fWidth - 10, y - 40, 15, stopOpt);
    const lStopDown = Bodies.circle(leftPivotX + fWidth - 10, y + 40, 15, stopOpt);

    const rStopUp = Bodies.circle(rightPivotX - fWidth + 10, y - 40, 15, stopOpt);
    const rStopDown = Bodies.circle(rightPivotX - fWidth + 10, y + 40, 15, stopOpt);

    flippers.left = leftF;
    flippers.right = rightF;

    Composite.add(world, [
        leftF, leftHinge, lStopUp, lStopDown,
        rightF, rightHinge, rStopUp, rStopDown
    ]);
};

// Bumpers
const buildBumpers = () => {
    const bOpt = {
        isStatic: true,
        label: 'bumper',
        restitution: 1.8, // Bouncy
        render: { fillStyle: '#2ecc71', strokeStyle: '#fff', lineWidth: 2 }
    };

    const cx = (WIDTH - 50) / 2; // Center of playfield
    const bumpers = [
        Bodies.circle(cx, 200, 30, bOpt),
        Bodies.circle(cx - 80, 280, 30, bOpt),
        Bodies.circle(cx + 80, 280, 30, bOpt),
        Bodies.circle(cx, 360, 30, bOpt)
    ];

    // Slingshots (triangles above flippers)
    const sOpt = { ...bOpt, label: 'slingshot', render: { fillStyle: '#f1c40f' }};
    const lSling = Bodies.polygon(130, HEIGHT - 220, 3, 30, sOpt);
    Body.setAngle(lSling, Math.PI / 4.5);

    const rSling = Bodies.polygon(WIDTH - 190, HEIGHT - 220, 3, 30, sOpt);
    Body.setAngle(rSling, -Math.PI / 4.5);

    Composite.add(world, [...bumpers, lSling, rSling]);
};

// Drain
const buildDrain = () => {
    const drain = Bodies.rectangle(WIDTH/2, HEIGHT + 50, WIDTH, 100, {
        isStatic: true, isSensor: true, label: 'drain', render: { visible: false }
    });
    Composite.add(world, drain);
};

// The Ball
const spawnBall = () => {
    if (ballsRemaining <= 0) {
        gameOver();
        return;
    }

    ballsRemaining--;
    ballsEl.innerText = ballsRemaining;

    // Spawn resting directly on the shooter floor
    ball = Bodies.circle(WIDTH - 25, HEIGHT - 35, BALL_RADIUS, {
        label: 'ball',
        restitution: 0.4,
        density: 0.05, // Heavy ball to smash through things
        render: { fillStyle: '#ecf0f1' },
        collisionFilter: { category: CAT_BALL, mask: CAT_DEFAULT | CAT_FLIPPER }
    });

    Composite.add(world, ball);
    plungeForce = 0; // Reset plunger charge
};

// Game Over Screen
const gameOver = () => {
    isPlaying = false;
    const msg = document.createElement('div');
    msg.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#e74c3c;font-size:48px;font-weight:bold;text-shadow:0 0 10px #000;text-align:center;pointer-events:auto;z-index:100;';
    msg.innerHTML = `GAME OVER<br><span style="font-size:24px;color:#fff">Score: ${score}</span><br><span style="font-size:16px;color:#fff;cursor:pointer;text-decoration:underline" onclick="location.reload()">Play Again</span>`;
    document.getElementById('game-container').appendChild(msg);
};

// Input
const keys = { ArrowLeft: false, ArrowRight: false, Space: false };
document.addEventListener('keydown', e => {
    const k = e.code === 'Space' ? 'Space' : e.key;
    if (keys[k] !== undefined) keys[k] = true;
});
document.addEventListener('keyup', e => {
    const k = e.code === 'Space' ? 'Space' : e.key;
    if (keys[k] !== undefined) {
        keys[k] = false;

        // Release Plunger (Direct Impulse)
        if (k === 'Space' && ball && ball.position.x > WIDTH - 50 && ball.position.y > HEIGHT - 100) {
            // Apply upward impulse proportional to charge time
            Body.applyForce(ball, ball.position, { x: 0, y: -plungeForce });
            plungeForce = 0;
            ball.render.fillStyle = '#ecf0f1'; // Reset color
        }
    }
});

// Update Loop
Events.on(engine, 'beforeUpdate', () => {
    if (!isPlaying) return;

    // Charge Plunger
    if (keys.Space && ball && ball.position.x > WIDTH - 50 && ball.position.y > HEIGHT - 100) {
        // Massively increased force to launch the heavy ball against strong gravity
        plungeForce = Math.min(plungeForce + 0.1, 5.0); // Max charge 5.0
        // Visual indicator: ball turns red
        const ratio = plungeForce / 5.0;
        ball.render.fillStyle = `rgb(255, ${255 - ratio*255}, ${255 - ratio*255})`;
    }

    // Flipper Torques
    if (keys.ArrowLeft) {
        // Massive upward force to counteract density and swing up fast
        Body.applyForce(flippers.left, { x: flippers.left.position.x + 40, y: flippers.left.position.y }, { x: 0, y: -50 });
    }
    if (keys.ArrowRight) {
        Body.applyForce(flippers.right, { x: flippers.right.position.x - 40, y: flippers.right.position.y }, { x: 0, y: -50 });
    }
});

// Collisions
Events.on(engine, 'collisionStart', event => {
    event.pairs.forEach(pair => {
        const a = pair.bodyA.label;
        const b = pair.bodyB.label;

        // Drain
        if (a === 'drain' || b === 'drain') {
            if (a === 'ball' || b === 'ball') {
                Composite.remove(world, ball);
                ball = null;
                setTimeout(spawnBall, 1000);
            }
        }

        // Bumper
        if ((a === 'ball' && (b === 'bumper' || b === 'slingshot')) ||
            (b === 'ball' && (a === 'bumper' || a === 'slingshot'))) {

            score += (a === 'bumper' || b === 'bumper') ? 100 : 50;
            scoreEl.innerText = score;

            // Flash effect
            const bumper = a === 'bumper' || a === 'slingshot' ? pair.bodyA : pair.bodyB;
            const origColor = bumper.render.fillStyle;
            bumper.render.fillStyle = '#ffffff';
            setTimeout(() => { bumper.render.fillStyle = origColor; }, 100);
        }
    });
});

// Init
buildMap();
buildFlippers();
buildBumpers();
buildDrain();
spawnBall();

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);