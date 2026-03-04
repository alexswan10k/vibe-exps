class Track {
    constructor(config) {
        this.name = config.name;
        this.laps = config.laps || 3;
        this.startLines = config.startLines;
        this.finishLine = config.finishLine;
        this.waypoints = config.waypoints;
        this.pathCommands = config.pathCommands;
        this.clutter = config.clutter || []; // array of obstacles
        this.grassColor = config.grassColor || '#2a2a2a'; // Concrete base
        this.asphaltColor = config.asphaltColor || '#1a1a1a'; // Darker road
        this.curbColor = config.curbColor || '#ff9800'; // Orange/Yellow construction curbs
        this.lineWidth = config.lineWidth || 80;

        this.logicalWidth = config.logicalWidth || 1000;
        this.logicalHeight = config.logicalHeight || 1000;
    }

    draw(ctx, isCollisionMap = false) {
        if (isCollisionMap) {
            ctx.fillStyle = '#000000'; // Off-track
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.strokeStyle = '#FFFFFF'; // On-track
        } else {
            ctx.fillStyle = this.grassColor;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.strokeStyle = this.asphaltColor;
        }

        ctx.lineWidth = this.lineWidth;
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        if (this.pathCommands && this.pathCommands.length > 0) {
            ctx.moveTo(this.pathCommands[0].x, this.pathCommands[0].y);
            for (let i = 1; i < this.pathCommands.length; i++) {
                const cmd = this.pathCommands[i];
                if (cmd.type === 'line') {
                    ctx.lineTo(cmd.x, cmd.y);
                } else if (cmd.type === 'bezier') {
                    ctx.bezierCurveTo(cmd.cp1x, cmd.cp1y, cmd.cp2x, cmd.cp2y, cmd.x, cmd.y);
                } else if (cmd.type === 'quadratic') {
                    ctx.quadraticCurveTo(cmd.cpx, cmd.cpy, cmd.x, cmd.y);
                }
            }
            ctx.closePath();
            ctx.stroke();

            // Outline curbs and draw finish line if not collision map
            if (!isCollisionMap) {
                ctx.lineWidth = this.lineWidth + 10;
                ctx.strokeStyle = '#fff';
                ctx.setLineDash([20, 20]);
                ctx.stroke();

                ctx.lineWidth = this.lineWidth + 10;
                ctx.strokeStyle = this.curbColor;
                ctx.lineDashOffset = 20;
                ctx.stroke();

                // Cover inner part with asphalt again
                ctx.setLineDash([]);
                ctx.lineWidth = this.lineWidth;
                ctx.strokeStyle = this.asphaltColor;
                ctx.stroke();

                // Draw finish line checkerboard
                ctx.lineWidth = 10;
                ctx.strokeStyle = '#fff';
                ctx.setLineDash([10, 10]);
                ctx.beginPath();
                ctx.moveTo(this.finishLine.p1.x, this.finishLine.p1.y);
                ctx.lineTo(this.finishLine.p2.x, this.finishLine.p2.y);
                ctx.stroke();

                ctx.strokeStyle = '#000';
                ctx.lineDashOffset = 10;
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        // Draw Clutter
        if (this.clutter.length > 0) {
            this.clutter.forEach(c => {
                if (isCollisionMap) {
                    ctx.fillStyle = '#000000'; // Obstacles are collidable
                } else {
                    ctx.fillStyle = c.color || '#444';
                    ctx.strokeStyle = '#222';
                    ctx.lineWidth = 4;
                    ctx.setLineDash([]);
                }

                ctx.beginPath();
                if (c.type === 'rect') {
                    ctx.rect(c.x, c.y, c.w, c.h);
                } else if (c.type === 'circle') {
                    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
                }
                ctx.fill();
                if (!isCollisionMap) ctx.stroke();
            });
        }
    }
}

const TrackData = [
    // Track 1: Beginner Oval
    new Track({
        name: "Beginner Oval",
        logicalWidth: 800,
        logicalHeight: 600,
        laps: 3,
        startLines: [
            { x: 400, y: 500, angle: 0 },
            { x: 400, y: 530, angle: 0 },
            { x: 350, y: 500, angle: 0 },
            { x: 350, y: 530, angle: 0 }
        ],
        finishLine: { p1: { x: 450, y: 460 }, p2: { x: 450, y: 540 } },
        waypoints: [
            { x: 450, y: 500 },
            { x: 650, y: 500 },
            { x: 700, y: 450 },
            { x: 700, y: 150 },
            { x: 650, y: 100 },
            { x: 150, y: 100 },
            { x: 100, y: 150 },
            { x: 100, y: 450 },
            { x: 150, y: 500 }
        ],
        pathCommands: [
            { type: 'line', x: 200, y: 500 },
            { type: 'line', x: 600, y: 500 },
            { type: 'quadratic', cpx: 700, cpy: 500, x: 700, y: 400 },
            { type: 'line', x: 700, y: 200 },
            { type: 'quadratic', cpx: 700, cpy: 100, x: 600, y: 100 },
            { type: 'line', x: 200, y: 100 },
            { type: 'quadratic', cpx: 100, cpy: 100, x: 100, y: 200 },
            { type: 'line', x: 100, y: 400 },
            { type: 'quadratic', cpx: 100, cpy: 500, x: 200, y: 500 }
        ],
        lineWidth: 80
    }),

    // Track 2: Peanut Cross
    new Track({
        name: "Peanut Cross",
        logicalWidth: 850,
        logicalHeight: 600,
        laps: 3,
        startLines: [
            { x: 360, y: 110, angle: 0 },
            { x: 360, y: 140, angle: 0 },
            { x: 320, y: 110, angle: 0 },
            { x: 320, y: 140, angle: 0 }
        ],
        finishLine: { p1: { x: 400, y: 70 }, p2: { x: 400, y: 150 } },
        waypoints: [
            { x: 400, y: 110 },
            { x: 600, y: 110 },
            { x: 700, y: 200 },
            { x: 600, y: 300 },
            { x: 400, y: 300 },
            { x: 200, y: 300 },
            { x: 100, y: 400 },
            { x: 200, y: 490 },
            { x: 600, y: 490 },
            { x: 700, y: 400 },
            { x: 200, y: 110 }
        ],
        pathCommands: [
            { type: 'line', x: 400, y: 110 },
            { type: 'line', x: 600, y: 110 },
            { type: 'quadratic', cpx: 750, cpy: 110, x: 750, y: 200 },
            { type: 'quadratic', cpx: 750, cpy: 300, x: 600, y: 300 },
            { type: 'line', x: 200, y: 300 },
            { type: 'quadratic', cpx: 50, cpy: 300, x: 50, y: 400 },
            { type: 'quadratic', cpx: 50, cpy: 490, x: 200, y: 490 },
            { type: 'line', x: 600, y: 490 },
            { type: 'quadratic', cpx: 750, cpy: 490, x: 750, y: 400 },
            { type: 'bezier', cp1x: 750, cp1y: 350, cp2x: 200, cp2y: 200, x: 200, y: 110 },
            { type: 'line', x: 400, y: 110 }
        ],
        lineWidth: 70
    }),

    // Track 3: Snake Run
    new Track({
        name: "Snake Run",
        logicalWidth: 850,
        logicalHeight: 600,
        laps: 3,
        startLines: [
            { x: 150, y: 460, angle: -Math.PI / 2 },
            { x: 180, y: 460, angle: -Math.PI / 2 },
            { x: 150, y: 500, angle: -Math.PI / 2 },
            { x: 180, y: 500, angle: -Math.PI / 2 }
        ],
        finishLine: { p1: { x: 110, y: 420 }, p2: { x: 190, y: 420 } },
        waypoints: [
            { x: 150, y: 420 },
            { x: 150, y: 200 },
            { x: 250, y: 100 },
            { x: 350, y: 200 },
            { x: 450, y: 300 },
            { x: 550, y: 200 },
            { x: 650, y: 100 },
            { x: 750, y: 300 },
            { x: 550, y: 500 },
            { x: 250, y: 500 },
            { x: 150, y: 420 }
        ],
        pathCommands: [
            { type: 'line', x: 150, y: 420 },
            { type: 'line', x: 150, y: 200 },
            { type: 'quadratic', cpx: 150, cpy: 100, x: 250, y: 100 },
            { type: 'quadratic', cpx: 350, cpy: 100, x: 350, y: 200 },
            { type: 'quadratic', cpx: 350, cpy: 300, x: 450, y: 300 },
            { type: 'quadratic', cpx: 550, cpy: 300, x: 550, y: 200 },
            { type: 'quadratic', cpx: 550, cpy: 100, x: 650, y: 100 },
            { type: 'quadratic', cpx: 750, cpy: 100, x: 750, y: 300 },
            { type: 'quadratic', cpx: 750, cpy: 500, x: 550, y: 500 },
            { type: 'line', x: 250, y: 500 },
            { type: 'quadratic', cpx: 150, cpy: 500, x: 150, y: 420 }
        ],
        lineWidth: 70
    }),

    // Track 4: Downtown Drift
    new Track({
        name: "Downtown Drift",
        logicalWidth: 900,
        logicalHeight: 950,
        laps: 3,
        startLines: [
            { x: 450, y: 650, angle: -Math.PI / 2 },
            { x: 480, y: 650, angle: -Math.PI / 2 },
            { x: 450, y: 700, angle: -Math.PI / 2 },
            { x: 480, y: 700, angle: -Math.PI / 2 }
        ],
        finishLine: { p1: { x: 410, y: 600 }, p2: { x: 490, y: 600 } },
        waypoints: [
            { x: 450, y: 600 },
            { x: 450, y: 300 },
            { x: 600, y: 200 },
            { x: 800, y: 300 },
            { x: 800, y: 600 },
            { x: 650, y: 750 },
            { x: 350, y: 750 },
            { x: 200, y: 600 },
            { x: 200, y: 400 },
            { x: 350, y: 250 },
            { x: 350, y: 100 },
            { x: 200, y: 100 },
            { x: 100, y: 250 },
            { x: 100, y: 700 },
            { x: 250, y: 850 },
            { x: 600, y: 850 },
            { x: 450, y: 600 }
        ],
        pathCommands: [
            { type: 'line', x: 450, y: 600 },
            { type: 'line', x: 450, y: 300 },
            { type: 'quadratic', cpx: 450, cpy: 200, x: 600, y: 200 },
            { type: 'quadratic', cpx: 800, cpy: 200, x: 800, y: 300 },
            { type: 'line', x: 800, y: 600 },
            { type: 'quadratic', cpx: 800, cpy: 750, x: 650, y: 750 },
            { type: 'line', x: 350, y: 750 },
            { type: 'quadratic', cpx: 200, cpy: 750, x: 200, y: 600 },
            { type: 'line', x: 200, y: 400 },
            { type: 'quadratic', cpx: 200, cpy: 250, x: 350, y: 250 },
            { type: 'line', x: 350, y: 100 },
            { type: 'quadratic', cpx: 350, cpy: 50, x: 200, y: 50 },
            { type: 'quadratic', cpx: 100, cpy: 50, x: 100, y: 250 },
            { type: 'line', x: 100, y: 700 },
            { type: 'quadratic', cpx: 100, cpy: 850, x: 250, y: 850 },
            { type: 'line', x: 600, y: 850 },
            { type: 'quadratic', cpx: 600, cpy: 600, x: 450, y: 600 } // Merge back to center
        ],
        clutter: [
            { type: 'rect', x: 250, y: 400, w: 80, h: 200, color: '#3f51b5' }, // building block
            { type: 'rect', x: 550, y: 400, w: 120, h: 200, color: '#f44336' }, // building block
            { type: 'circle', x: 200, y: 200, r: 30, color: '#9e9e9e' } // pillar
        ],
        lineWidth: 65
    }),

    // Track 5: Industrial Zone
    new Track({
        name: "Industrial Zone",
        logicalWidth: 1000,
        logicalHeight: 900,
        laps: 3,
        startLines: [
            { x: 150, y: 150, angle: 0 },
            { x: 150, y: 180, angle: 0 },
            { x: 110, y: 150, angle: 0 },
            { x: 110, y: 180, angle: 0 }
        ],
        finishLine: { p1: { x: 200, y: 110 }, p2: { x: 200, y: 220 } },
        waypoints: [
            { x: 200, y: 165 },
            { x: 800, y: 165 },
            { x: 800, y: 800 },
            { x: 150, y: 800 },
            { x: 150, y: 450 },
            { x: 600, y: 450 },
            { x: 450, y: 300 },
            { x: 150, y: 300 },
            { x: 150, y: 165 }
        ],
        pathCommands: [
            { type: 'line', x: 200, y: 165 },
            { type: 'line', x: 800, y: 165 },
            { type: 'quadratic', cpx: 900, cpy: 165, x: 900, y: 265 },
            { type: 'line', x: 900, y: 700 },
            { type: 'quadratic', cpx: 900, cpy: 800, x: 800, y: 800 },
            { type: 'line', x: 150, y: 800 },
            { type: 'quadratic', cpx: 50, cpy: 800, x: 50, y: 700 },
            { type: 'line', x: 50, y: 450 },
            { type: 'quadratic', cpx: 50, cpy: 350, x: 150, y: 350 },
            { type: 'line', x: 550, y: 350 },
            { type: 'quadratic', cpx: 650, cpy: 350, x: 650, y: 250 },
            { type: 'bezier', cp1x: 650, cp1y: 150, cp2x: 450, cp2y: 150, x: 450, y: 250 },
            { type: 'line', x: 150, y: 250 },
            { type: 'quadratic', cpx: 50, cpy: 250, x: 50, y: 165 },
            { type: 'line', x: 200, y: 165 }
        ],
        clutter: [
            { type: 'rect', x: 250, y: 450, w: 200, h: 250, color: '#607d8b' }, // large factory
            { type: 'rect', x: 400, y: 650, w: 300, h: 80, color: '#795548' }, // warehouse
            { type: 'circle', x: 450, y: 550, r: 60, color: '#bdbdbd' }, // silo
            { type: 'circle', x: 600, y: 550, r: 40, color: '#bdbdbd' }, // tank
            { type: 'rect', x: 750, y: 300, w: 50, h: 350, color: '#ff9800' } // pipe system
        ],
        lineWidth: 60,
        asphaltColor: '#222',
        curbColor: '#4CAF50' // greenish toxic kerbs for industrial zone
    })
];
