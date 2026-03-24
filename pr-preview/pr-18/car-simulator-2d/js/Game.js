class Game {
    constructor() {
        this.init();
    }

    init() {
        // Module aliases
        const Engine = Matter.Engine,
            Render = Matter.Render,
            Runner = Matter.Runner,
            Composite = Matter.Composite,
            Composites = Matter.Composites,
            Common = Matter.Common,
            MouseConstraint = Matter.MouseConstraint,
            Mouse = Matter.Mouse,
            World = Matter.World,
            Bodies = Matter.Bodies;

        // Create engine
        this.engine = Engine.create();
        this.world = this.engine.world;

        // Create renderer
        this.render = Render.create({
            element: document.body,
            engine: this.engine,
            options: {
                width: window.innerWidth,
                height: window.innerHeight,
                showAngleIndicator: false,
                wireframes: false,
                background: '#1a1a1a',
                hasBounds: true
            }
        });

        Render.run(this.render);

        // Create runner
        this.runner = Runner.create();
        Runner.run(this.runner, this.engine);

        // Add mouse control
        const mouse = Mouse.create(this.render.canvas);
        const mouseConstraint = MouseConstraint.create(this.engine, {
            mouse: mouse,
            constraint: {
                stiffness: 0.2,
                render: {
                    visible: false
                }
            }
        });

        Composite.add(this.world, mouseConstraint);

        // Keep the mouse in sync with rendering
        this.render.mouse = mouse;

        // Resize handler
        window.addEventListener('resize', () => {
            this.render.canvas.width = window.innerWidth;
            this.render.canvas.height = window.innerHeight;
        });

        // Initialize sub-systems
        this.input = new Input();
        this.worldGen = new WorldGen(this.world);
        this.vehicle = new Vehicle(400, 300, this.world);
        this.entityManager = new EntityManager(this.world);
        this.ui = new UI(this.entityManager);

        // Game loop events
        Matter.Events.on(this.engine, 'beforeUpdate', () => {
            this.update();
        });

        Matter.Events.on(this.engine, 'collisionStart', (event) => {
            const pairs = event.pairs;
            for (let i = 0; i < pairs.length; i++) {
                const pair = pairs[i];
                // Check for destructible
                if (pair.bodyA.label === 'destructible' && pair.collision.depth > 1) {
                    // Check force/velocity?
                    // Collision start doesn't always have impulse immediately available in some versions, 
                    // but usually we can check relative velocity.
                    // Or just break on any hard impact.
                    this.entityManager.explodeCrate(pair.bodyA);
                } else if (pair.bodyB.label === 'destructible' && pair.collision.depth > 1) {
                    this.entityManager.explodeCrate(pair.bodyB);
                }
            }
        });

        // Initial world generation logic will be in WorldGen
        this.worldGen.init();
    }

    update() {
        // Vehicle controls
        this.vehicle.update(this.input);

        // Camera follow
        const vehiclePos = this.vehicle.getPosition();
        if (vehiclePos) {
            Matter.Render.lookAt(this.render, vehiclePos, {
                x: window.innerWidth / 2,
                y: window.innerHeight / 2
            });

            // Infinite scrolling trigger
            this.worldGen.update(vehiclePos.x);
        }
    }
}

// Start game when page loads
window.onload = () => {
    window.game = new Game();
};
