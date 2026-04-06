// pinball-game/script.js

// Aliases
const Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      Body = Matter.Body,
      Composite = Matter.Composite,
      Constraint = Matter.Constraint,
      Events = Matter.Events,
      Vector = Matter.Vector;

// Constants
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

// UI
const scoreEl = document.getElementById('score');
const ballsEl = document.getElementById('balls');
const canvas = document.getElementById('pinball-canvas');

// Engine with high iteration count for fast-moving small objects
const engine = Engine.create({
    positionIterations: 20,
    velocityIterations: 20,
    constraintIterations: 10,
    gravity: { x: 0, y: 1.5, scale: 0.001 }
});
const world = engine.world;

const render = Render.create({
    canvas: canvas,
    engine: engine,
    options: {
        width: WIDTH,
        height: HEIGHT,
        wireframes: false,
        background: '#1a1a2e'
    }
});

// Collision Categories
const CAT_DEFAULT = 0x0001;
const CAT_BALL = 0x0002;
const CAT_FLIPPER = 0x0004;
const CAT_WALL = 0x0008;
const CAT_STOPPER = 0x0010;

// --- BUILD WORLD ---

// 1. Static Geometry (Walls, Shooter Lane, Deflector)
const buildGeometry = () => {
    const wallOpt = {
        isStatic: true,
        render: { fillStyle: '#0f3460' },
        collisionFilter: { category: CAT_WALL },
        friction: 0,
        restitution: 0.4
    };

    // Outer bounds
    const leftWall = Bodies.rectangle(10, HEIGHT/2, 20, HEIGHT, wallOpt);
    const rightWall = Bodies.rectangle(WIDTH - 10, HEIGHT/2, 20, HEIGHT, wallOpt);
    const topWall = Bodies.rectangle(WIDTH/2, 10, WIDTH, 20, wallOpt);

    // Shooter lane (40px wide on the right)
    // Wall separates playfield from shooter lane
    const shooterDivider = Bodies.rectangle(WIDTH - 60, HEIGHT - 250, 10, 500, wallOpt);

    // Top right deflector (Guides plunged ball smoothly into playfield)
    // Arc is complex, so we use a large angled rectangle
    const deflector = Bodies.rectangle(WIDTH - 80, 80, 200, 20, {
        ...wallOpt,
        angle: -Math.PI / 6, // Tilt up and left
        restitution: 0.1 // Low bounce so it rolls along it
    });

    // Bottom angled walls guiding to flippers
    const leftSlant = Bodies.rectangle(120, HEIGHT - 200, 250, 20, {
        ...wallOpt,
        angle: Math.PI / 5.5
    });
    const rightSlant = Bodies.rectangle(WIDTH - 180, HEIGHT - 200, 250, 20, {
        ...wallOpt,
        angle: -Math.PI / 5.5
    });

    Composite.add(world, [
        leftWall, rightWall, topWall, shooterDivider, deflector, leftSlant, rightSlant
    ]);
};

// 2. Physical Plunger
let plungerBody = null;
let plungerSpring = null;
const buildPlunger = () => {
    const startY = HEIGHT - 40;
    const plungerX = WIDTH - 35; // Center of 40px shooter lane

    plungerBody = Bodies.rectangle(plungerX, startY, 30, 40, {
        label: 'plunger',
        density: 0.05,
        frictionAir: 0.05, // Slows it down slightly when snapping back
        render: { fillStyle: '#e94560' },
        collisionFilter: { category: CAT_WALL | CAT_BALL } // Hits the ball
    });

    // Spring pulls it up to rest position
    plungerSpring = Constraint.create({
        pointA: { x: plungerX, y: startY - 20 },
        bodyB: plungerBody,
        pointB: { x: 0, y: -20 },
        stiffness: 0.1,
        damping: 0.1,
        length: 0,
        render: { visible: false }
    });

    // Bottom floor to stop plunger falling forever
    const plungerFloor = Bodies.rectangle(plungerX, HEIGHT + 50, 50, 20, {
        isStatic: true, render: { visible: false }
    });

    Composite.add(world, [plungerBody, plungerSpring, plungerFloor]);
};

// 3. Flippers with physical stoppers
const flippers = { left: null, right: null };
const buildFlippers = () => {
    const flipWidth = 80; // Shortened to leave a drain gap
    const flipHeight = 18;
    const yPos = HEIGHT - 100;
    const gap = 180; // Widen gap between pivots slightly

    const flipOpt = {
        friction: 0.1,
        frictionAir: 0,
        density: 0.05,
        render: { fillStyle: '#ff0055' },
        collisionFilter: { category: CAT_FLIPPER, mask: CAT_BALL | CAT_STOPPER }
    };

    // Left Flipper
    const leftX = (WIDTH - gap) / 2 - 20; // Shift left slightly
    const leftFlip = Bodies.rectangle(leftX + flipWidth/2, yPos, flipWidth, flipHeight, { ...flipOpt, label: 'flipper_left' });

    const leftHinge = Constraint.create({
        pointA: { x: leftX, y: yPos },
        bodyB: leftFlip,
        pointB: { x: -flipWidth/2 + 10, y: 0 },
        stiffness: 1, length: 0, render: { visible: false }
    });

    // Physical Stoppers for Left
    // Added collisionFilter so only the flippers hit them, not the ball
    const stopOpt = { isStatic: true, render: { visible: false }, collisionFilter: { category: CAT_STOPPER, mask: CAT_FLIPPER }};
    const lStopUp = Bodies.circle(leftX + flipWidth - 20, yPos - 35, 15, stopOpt);
    const lStopDown = Bodies.circle(leftX + flipWidth - 20, yPos + 35, 15, stopOpt);

    // Right Flipper
    const rightX = leftX + gap;
    const rightFlip = Bodies.rectangle(rightX - flipWidth/2, yPos, flipWidth, flipHeight, { ...flipOpt, label: 'flipper_right' });

    const rightHinge = Constraint.create({
        pointA: { x: rightX, y: yPos },
        bodyB: rightFlip,
        pointB: { x: flipWidth/2 - 10, y: 0 },
        stiffness: 1, length: 0, render: { visible: false }
    });

    // Physical Stoppers for Right
    const rStopUp = Bodies.circle(rightX - flipWidth + 20, yPos - 35, 15, stopOpt);
    const rStopDown = Bodies.circle(rightX - flipWidth + 20, yPos + 35, 15, stopOpt);

    flippers.left = leftFlip;
    flippers.right = rightFlip;

    Composite.add(world, [
        leftFlip, leftHinge, lStopUp, lStopDown,
        rightFlip, rightHinge, rStopUp, rStopDown
    ]);
};

// 4. Bumpers
const buildBumpers = () => {
    const bumperOpt = {
        isStatic: true,
        label: 'bumper',
        restitution: 1.5,
        render: { fillStyle: '#00ffcc', strokeStyle: '#fff', lineWidth: 3 }
    };

    // Center cluster
    const cx = WIDTH / 2 - 20; // Shift left accounting for shooter lane
    const bumpers = [
        Bodies.circle(cx, 250, 25, bumperOpt),
        Bodies.circle(cx - 70, 320, 25, bumperOpt),
        Bodies.circle(cx + 70, 320, 25, bumperOpt),
        Bodies.circle(cx, 400, 25, bumperOpt)
    ];

    // Bouncy slingshots above flippers
    const slingOpt = { isStatic: true, label: 'slingshot', restitution: 1.5, render: { fillStyle: '#ffcc00' } };
    const lSling = Bodies.polygon(100, HEIGHT - 260, 3, 30, slingOpt);
    Body.setAngle(lSling, Math.PI / 4);
    const rSling = Bodies.polygon(WIDTH - 160, HEIGHT - 260, 3, 30, slingOpt);
    Body.setAngle(rSling, -Math.PI / 4);

    Composite.add(world, [...bumpers, lSling, rSling]);
};

// 5. Drain (Death Zone)
const buildDrain = () => {
    const drain = Bodies.rectangle(WIDTH / 2, HEIGHT + 100, WIDTH * 2, 100, {
        isStatic: true, isSensor: true, label: 'drain'
    });
    Composite.add(world, drain);
};

// --- GAME LOGIC ---

const spawnBall = () => {
    if (ballsRemaining <= 0) {
        gameOver();
        return;
    }

    ballsRemaining--;
    ballsEl.innerText = ballsRemaining;

    // Spawn resting exactly on top of the physical plunger
    ball = Bodies.circle(WIDTH - 35, HEIGHT - 80, BALL_RADIUS, {
        label: 'ball',
        restitution: 0.4,
        density: 0.02,
        render: { fillStyle: '#ffffff' },
        collisionFilter: { category: CAT_BALL, mask: CAT_WALL | CAT_FLIPPER | CAT_DEFAULT }
    });

    Composite.add(world, ball);
};

const gameOver = () => {
    isPlaying = false;
    const msg = document.createElement('div');
    msg.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#e94560;font-size:48px;font-weight:bold;text-shadow:0 0 10px #0f3460;text-align:center;pointer-events:auto;z-index:100;';
    msg.innerHTML = `GAME OVER<br><span style="font-size:24px;color:#fff">Score: ${score}</span><br><span style="font-size:16px;color:#fff;cursor:pointer;text-decoration:underline" onclick="location.reload()">Play Again</span>`;
    document.getElementById('game-container').appendChild(msg);
};

// --- INPUT & UPDATE ---

const keys = { ArrowLeft: false, ArrowRight: false, Space: false };

document.addEventListener('keydown', e => {
    const k = e.code === 'Space' ? 'Space' : e.key;
    if (keys[k] !== undefined) keys[k] = true;
});

document.addEventListener('keyup', e => {
    const k = e.code === 'Space' ? 'Space' : e.key;
    if (keys[k] !== undefined) keys[k] = false;
});

Events.on(engine, 'beforeUpdate', () => {
    if (!isPlaying) return;

    // Plunger Pull
    if (keys.Space) {
        // Apply strong downward force to spring-loaded plunger block
        Body.applyForce(plungerBody, plungerBody.position, { x: 0, y: 2 });
    }

    // Flipper activation (Massive torque applied at tip)
    if (keys.ArrowLeft) {
        Body.applyForce(flippers.left, { x: flippers.left.position.x + 50, y: flippers.left.position.y }, { x: 0, y: -20 });
    }
    if (keys.ArrowRight) {
        Body.applyForce(flippers.right, { x: flippers.right.position.x - 50, y: flippers.right.position.y }, { x: 0, y: -20 });
    }
});

// --- COLLISIONS ---
Events.on(engine, 'collisionStart', event => {
    event.pairs.forEach(pair => {
        const a = pair.bodyA.label;
        const b = pair.bodyB.label;

        // Drain check
        if (a === 'drain' || b === 'drain') {
            if (a === 'ball' || b === 'ball') {
                Composite.remove(world, ball);
                ball = null;
                setTimeout(spawnBall, 1000);
            }
        }

        // Bumper Score
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

// INIT
buildGeometry();
buildPlunger();
buildFlippers();
buildBumpers();
buildDrain();
spawnBall();

Render.run(render);
const runner = Runner.create({ isFixed: true }); // Fixed timestep for better collision accuracy
Runner.run(runner, engine);