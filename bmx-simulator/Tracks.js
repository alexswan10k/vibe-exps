class Track {
    constructor(config) {
        this.name = config.name;
        this.laps = config.laps || 3;
        this.startLines = config.startLines;
        this.finishLine = config.finishLine;
        this.waypoints = config.waypoints;
        this.pathCommands = config.pathCommands;
        this.grassColor = config.grassColor || '#4CAF50';
        this.asphaltColor = config.asphaltColor || '#555';
        this.curbColor = config.curbColor || '#f00';
        this.lineWidth = config.lineWidth || 80;
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
    }
}

const TrackData = [
    // Track 1: Beginner Oval
    new Track({
        name: "Beginner Oval",
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
        lineWidth: 70,
        grassColor: '#3c8f3f'
    }),

    // Track 3: Snake Run
    new Track({
        name: "Snake Run",
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
        lineWidth: 70,
        grassColor: '#6da04b',
        curbColor: '#fff',
        asphaltColor: '#333'
    })
];
