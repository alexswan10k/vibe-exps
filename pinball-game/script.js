// pinball-game/script.js

// Initialize Matter.js
const Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      Body = Matter.Body,
      Composite = Matter.Composite,
      Constraint = Matter.Constraint,
      Events = Matter.Events,
      Vector = Matter.Vector;

// Game Settings
const WIDTH = 600;
const HEIGHT = 800;
const WALL_THICKNESS = 40;
const MAX_BALLS = 3;

// Game State
let score = 0;
let ballsRemaining = MAX_BALLS;
let isPlaying = true;
let ball = null;
let plungeForce = 0;
const MAX_PLUNGE = 4; // Massively increased to handle heavy ball mass
const PLUNGE_RATE = 0.1;

// Elements
const scoreElement = document.getElementById('score');
const ballsElement = document.getElementById('balls');
const canvas = document.getElementById('pinball-canvas');

// Create Engine
const engine = Engine.create({
    positionIterations: 12,
    velocityIterations: 10,
    constraintIterations: 6,
    gravity: { x: 0, y: 1.5, scale: 0.001 } // Strong downward gravity
});
const world = engine.world;

// Create Render
const render = Render.create({
    canvas: canvas,
    engine: engine,
    options: {
        width: WIDTH,
        height: HEIGHT,
        wireframes: false, // Turn off wireframes for colors
        background: '#1a1a2e',
        hasBounds: true
    }
});

// Setup Collision Groups/Categories
const GROUP_DEFAULT = 0x0001;
const GROUP_BALL = 0x0002;
const GROUP_FLIPPER = 0x0004;
const GROUP_WALL = 0x0008;
const GROUP_SENSOR = 0x0010; // For bottom drain

// --- Map Building ---
const buildWalls = () => {
    // Left wall
    const leftWall = Bodies.rectangle(WALL_THICKNESS / 2, HEIGHT / 2, WALL_THICKNESS, HEIGHT, {
        isStatic: true,
        render: { fillStyle: '#0f3460' },
        collisionFilter: { category: GROUP_WALL }
    });

    // Right wall (Outer)
    const rightWall = Bodies.rectangle(WIDTH - WALL_THICKNESS / 2, HEIGHT / 2, WALL_THICKNESS, HEIGHT, {
        isStatic: true,
        render: { fillStyle: '#0f3460' },
        collisionFilter: { category: GROUP_WALL }
    });

    // Top wall
    const topWall = Bodies.rectangle(WIDTH / 2, WALL_THICKNESS / 2, WIDTH, WALL_THICKNESS, {
        isStatic: true,
        render: { fillStyle: '#0f3460' },
        collisionFilter: { category: GROUP_WALL }
    });

    // Shooter lane divider (inner right wall)
    // Shifted slightly left to give ball more clearance in the lane
    const shooterWall = Bodies.rectangle(WIDTH - 70, HEIGHT / 2 + 100, 10, HEIGHT - 200, {
        isStatic: true,
        render: { fillStyle: '#0f3460' },
        collisionFilter: { category: GROUP_WALL }
    });

    // Slanted corners at top
    const topLeftCorner = Bodies.polygon(60, 60, 3, 70, {
        isStatic: true,
        angle: Math.PI / 4,
        render: { fillStyle: '#0f3460' },
        collisionFilter: { category: GROUP_WALL }
    });
    const topRightCorner = Bodies.polygon(WIDTH - 80, 60, 3, 70, {
        isStatic: true,
        angle: -Math.PI / 4,
        render: { fillStyle: '#0f3460' },
        collisionFilter: { category: GROUP_WALL }
    });

    // Slanted walls down to flippers
    const leftSlant = Bodies.rectangle(100, HEIGHT - 150, 200, 20, {
        isStatic: true,
        angle: Math.PI / 6,
        render: { fillStyle: '#0f3460' },
        collisionFilter: { category: GROUP_WALL }
    });
    const rightSlant = Bodies.rectangle(WIDTH - 150, HEIGHT - 150, 200, 20, {
        isStatic: true,
        angle: -Math.PI / 6,
        render: { fillStyle: '#0f3460' },
        collisionFilter: { category: GROUP_WALL }
    });

    // Outlanes/Inlanes Dividers
    const leftLaneDiv = Bodies.rectangle(130, HEIGHT - 250, 10, 100, {
         isStatic: true,
         render: { fillStyle: '#e94560' }
    });
    const rightLaneDiv = Bodies.rectangle(WIDTH - 180, HEIGHT - 250, 10, 100, {
         isStatic: true,
         render: { fillStyle: '#e94560' }
    });

    // Floor of the shooter lane so the ball doesn't fall out
    const shooterFloor = Bodies.rectangle(WIDTH - 30, HEIGHT - 10, 50, 20, {
         isStatic: true,
         render: { fillStyle: '#0f3460' },
         collisionFilter: { category: GROUP_WALL }
    });

    Composite.add(world, [
        leftWall, rightWall, topWall, shooterWall,
        topLeftCorner, topRightCorner,
        leftSlant, rightSlant,
        leftLaneDiv, rightLaneDiv, shooterFloor
    ]);
};

// Drain Sensor (bottom area)
const buildDrain = () => {
    const drain = Bodies.rectangle(WIDTH / 2, HEIGHT + 50, WIDTH, 100, {
        isStatic: true,
        isSensor: true,
        label: 'drain',
        collisionFilter: { category: GROUP_SENSOR },
        render: { visible: false } // Hidden
    });
    Composite.add(world, drain);
};

// Flippers
const flippers = { left: null, right: null };
const flipperConstraints = { left: null, right: null };

const buildFlippers = () => {
    // Re-adjust flipper width to leave a gap in the middle
    const flipperWidth = 100;
    const flipperHeight = 16;
    // Lower them a bit to match the longer slants we will add
    const yPos = HEIGHT - 80;

    // We make flippers kinematic so we can control them explicitly
    // without physics going crazy from applied forces.

    // Left Flipper
    const leftFlipper = Bodies.rectangle(160 + flipperWidth/2, yPos, flipperWidth, flipperHeight, {
        label: 'flipper_left',
        friction: 0.1,
        frictionAir: 0,
        isKinematic: true, // We control position/rotation directly
        render: { fillStyle: '#e94560' },
        collisionFilter: { category: GROUP_FLIPPER, mask: GROUP_BALL }
    });

    // Right Flipper
    const rightFlipper = Bodies.rectangle(WIDTH - 210 - flipperWidth/2, yPos, flipperWidth, flipperHeight, {
        label: 'flipper_right',
        friction: 0.1,
        frictionAir: 0,
        isKinematic: true, // We control position/rotation directly
        render: { fillStyle: '#e94560' },
        collisionFilter: { category: GROUP_FLIPPER, mask: GROUP_BALL }
    });

    // Set initial resting angles
    Body.setAngle(leftFlipper, Math.PI / 6); // 30 degrees down
    Body.setAngle(rightFlipper, -Math.PI / 6);

    flippers.left = leftFlipper;
    flippers.right = rightFlipper;

    // Store pivot points for rotation logic
    flippers.left.pivot = { x: 160, y: yPos };
    flippers.right.pivot = { x: WIDTH - 210, y: yPos };

    // Store limits
    flippers.left.restAngle = Math.PI / 6;
    flippers.left.upAngle = -Math.PI / 8; // -22.5 deg

    flippers.right.restAngle = -Math.PI / 6;
    flippers.right.upAngle = Math.PI / 8;

    Composite.add(world, [leftFlipper, rightFlipper]);
};

// Bumpers and additional world body
const buildBumpers = () => {
    const bumperOpts = {
        isStatic: true,
        label: 'bumper',
        restitution: 1.5, // Very bouncy!
        render: {
            fillStyle: '#00ffcc',
            strokeStyle: '#fff',
            lineWidth: 2
        }
    };

    // Main Triangle formation of bumpers
    const bumpers = [
        Bodies.circle(WIDTH / 2 - 80, HEIGHT / 2 - 180, 30, bumperOpts),
        Bodies.circle(WIDTH / 2 + 30, HEIGHT / 2 - 180, 30, bumperOpts),
        Bodies.circle(WIDTH / 2 - 25, HEIGHT / 2 - 80, 30, bumperOpts),
        // Additional smaller bumpers to add body
        Bodies.circle(WIDTH / 2 - 130, HEIGHT / 2 - 250, 20, bumperOpts),
        Bodies.circle(WIDTH / 2 + 80, HEIGHT / 2 - 250, 20, bumperOpts),
        Bodies.circle(WIDTH / 2 - 25, HEIGHT / 2 + 40, 25, bumperOpts)
    ];

    Composite.add(world, bumpers);

    // Sling shots (bouncy walls near flippers)
    const slingOpt = {
        isStatic: true,
        label: 'slingshot',
        restitution: 1.8,
        render: { fillStyle: '#ffcc00' }
    };

    // Left Slingshot
    const leftSling = Bodies.polygon(140, HEIGHT - 180, 3, 40, slingOpt);
    Body.setAngle(leftSling, Math.PI / 6);

    // Right Slingshot
    const rightSling = Bodies.polygon(WIDTH - 190, HEIGHT - 180, 3, 40, slingOpt);
    Body.setAngle(rightSling, -Math.PI / 6);

    // Some extra static "islands" to keep the ball bouncing
    const leftIsland = Bodies.polygon(90, HEIGHT / 2 - 20, 5, 30, { isStatic: true, render: { fillStyle: '#e94560' }});
    const rightIsland = Bodies.polygon(WIDTH - 140, HEIGHT / 2 - 20, 5, 30, { isStatic: true, render: { fillStyle: '#e94560' }});

    Composite.add(world, [leftSling, rightSling, leftIsland, rightIsland]);
};

// The Ball
const spawnBall = () => {
    if (ballsRemaining <= 0) {
        gameOver();
        return;
    }

    ballsRemaining--;
    ballsElement.innerText = ballsRemaining;

    // Start in shooter lane, resting just above the shooter floor
    // Shifted x to WIDTH - 40 to be exactly in the center of the new wider shooter lane
    const radius = 12;
    ball = Bodies.circle(WIDTH - 40, HEIGHT - 30, radius, {
        label: 'ball',
        restitution: 0.5, // Natural bounce
        friction: 0.001,
        frictionAir: 0.001,
        density: 0.05,
        render: { fillStyle: '#ffffff' },
        collisionFilter: { category: GROUP_BALL }
    });

    Composite.add(world, ball);
};

// --- Input Handling ---

// Keyboard state
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    Space: false
};

document.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.code) || keys.hasOwnProperty(e.key)) {
        // Handle Space vs ' ' vs Spacebar
        const keyName = e.code === 'Space' ? 'Space' : e.key;
        if (keys[keyName] !== undefined) keys[keyName] = true;

        // Plunger buildup
        if (keyName === 'Space' && ball) {
             // Only charge if ball is in the shooter lane (very far right and near bottom)
             if (ball.position.x > WIDTH - 60 && ball.position.y > HEIGHT - 150) {
                 e.preventDefault(); // Stop scrolling
             }
        }
    }
});

document.addEventListener('keyup', (e) => {
    const keyName = e.code === 'Space' ? 'Space' : e.key;
    if (keys[keyName] !== undefined) {
        keys[keyName] = false;

        // Release Plunger
        if (keyName === 'Space' && ball) {
            if (ball.position.x > WIDTH - 60 && ball.position.y > HEIGHT - 150) {
                // Apply the accumulated plunge force upwards
                Body.applyForce(ball, ball.position, { x: 0, y: -plungeForce });
                plungeForce = 0; // Reset
            }
        }
    }
});

// Update loop (runs before physics tick)
Events.on(engine, 'beforeUpdate', () => {
    if (!isPlaying) return;

    // Kinematic Flipper Control
    // We explicitly calculate and set the angle around the pivot point to avoid physics engine instability
    const flipperSpeed = 0.4;

    // Left Flipper Logic
    if (keys.ArrowLeft) {
        // Move towards upAngle
        let currentAngle = flippers.left.angle;
        if (currentAngle > flippers.left.upAngle) {
            let nextAngle = Math.max(currentAngle - flipperSpeed, flippers.left.upAngle);
            Body.setAngle(flippers.left, nextAngle);
            Body.setAngularVelocity(flippers.left, -flipperSpeed); // Impart momentum to ball
        } else {
             Body.setAngularVelocity(flippers.left, 0);
        }
    } else {
        // Return to restAngle
        let currentAngle = flippers.left.angle;
        if (currentAngle < flippers.left.restAngle) {
            let nextAngle = Math.min(currentAngle + flipperSpeed, flippers.left.restAngle);
            Body.setAngle(flippers.left, nextAngle);
             Body.setAngularVelocity(flippers.left, flipperSpeed);
        } else {
             Body.setAngularVelocity(flippers.left, 0);
        }
    }

    // Fix Left Position to Pivot
    Body.setPosition(flippers.left, {
        x: flippers.left.pivot.x + (Math.cos(flippers.left.angle) * 50), // half width
        y: flippers.left.pivot.y + (Math.sin(flippers.left.angle) * 50)
    });

    // Right Flipper Logic
    if (keys.ArrowRight) {
        let currentAngle = flippers.right.angle;
        if (currentAngle < flippers.right.upAngle) {
            let nextAngle = Math.min(currentAngle + flipperSpeed, flippers.right.upAngle);
            Body.setAngle(flippers.right, nextAngle);
            Body.setAngularVelocity(flippers.right, flipperSpeed); // Impart momentum to ball
        } else {
             Body.setAngularVelocity(flippers.right, 0);
        }
    } else {
        let currentAngle = flippers.right.angle;
        if (currentAngle > flippers.right.restAngle) {
            let nextAngle = Math.max(currentAngle - flipperSpeed, flippers.right.restAngle);
            Body.setAngle(flippers.right, nextAngle);
            Body.setAngularVelocity(flippers.right, -flipperSpeed);
        } else {
             Body.setAngularVelocity(flippers.right, 0);
        }
    }

    // Fix Right Position to Pivot
    Body.setPosition(flippers.right, {
        x: flippers.right.pivot.x - (Math.cos(flippers.right.angle) * 50), // half width
        y: flippers.right.pivot.y - (Math.sin(flippers.right.angle) * 50)
    });

    // Plunger Charge
    if (keys.Space && ball && ball.position.x > WIDTH - 60 && ball.position.y > HEIGHT - 150) {
        plungeForce = Math.min(plungeForce + PLUNGE_RATE, MAX_PLUNGE);
        // Visual feedback - tint ball red while charging
        const chargeRatio = plungeForce / MAX_PLUNGE;
        ball.render.fillStyle = `rgb(255, ${255 - (chargeRatio*255)}, ${255 - (chargeRatio*255)})`;
    } else if (ball && ball.position.x > WIDTH - 60) {
         // reset ball color if not plunging
         ball.render.fillStyle = '#ffffff';
    }
});

// Collision Events (Scoring & Drain)
Events.on(engine, 'collisionStart', (event) => {
    const pairs = event.pairs;

    for (let i = 0, j = pairs.length; i < j; ++i) {
        const pair = pairs[i];

        // Drain Collision
        if ((pair.bodyA.label === 'ball' && pair.bodyB.label === 'drain') ||
            (pair.bodyB.label === 'ball' && pair.bodyA.label === 'drain')) {

            // Ball lost
            Composite.remove(world, ball);
            ball = null;
            setTimeout(spawnBall, 1000);
        }

        // Bumper Collision
        const isBumperA = pair.bodyA.label === 'bumper' || pair.bodyA.label === 'slingshot';
        const isBumperB = pair.bodyB.label === 'bumper' || pair.bodyB.label === 'slingshot';
        const isBall = pair.bodyA.label === 'ball' || pair.bodyB.label === 'ball';

        if ((isBumperA || isBumperB) && isBall) {
            // Score!
            const pts = pair.bodyA.label === 'bumper' || pair.bodyB.label === 'bumper' ? 100 : 50;
            score += pts;
            scoreElement.innerText = score;

            // Flash effect on bumper
            const bumper = isBumperA ? pair.bodyA : pair.bodyB;
            const originalColor = bumper.render.fillStyle;
            bumper.render.fillStyle = '#ffffff';
            setTimeout(() => { bumper.render.fillStyle = originalColor; }, 100);
        }
    }
});

const gameOver = () => {
    isPlaying = false;
    // Show game over message
    const goText = document.createElement('div');
    goText.style.position = 'absolute';
    goText.style.top = '50%';
    goText.style.left = '50%';
    goText.style.transform = 'translate(-50%, -50%)';
    goText.style.color = '#e94560';
    goText.style.fontSize = '48px';
    goText.style.fontWeight = 'bold';
    goText.style.textShadow = '0 0 10px #0f3460';
    goText.style.textAlign = 'center';
    goText.style.pointerEvents = 'none';
    goText.innerHTML = `GAME OVER<br><span style="font-size:24px; color:#fff">Score: ${score}</span><br><span style="font-size:16px; color:#fff; cursor:pointer; text-decoration:underline" onclick="location.reload()">Play Again</span>`;

    // Enable pointer events just for the text to click play again
    goText.style.pointerEvents = 'auto';

    document.getElementById('game-container').appendChild(goText);
};

// Initialize
buildWalls();
buildDrain();
buildFlippers();
buildBumpers();
spawnBall();

// Run Game
Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);
