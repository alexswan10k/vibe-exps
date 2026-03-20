const canvas = document.getElementById('fireworksCanvas');
const ctx = canvas.getContext('2d');
const controls = document.getElementById('controls');
const color1 = document.getElementById('color1');
const color2 = document.getElementById('color2');
const color3 = document.getElementById('color3');
const sizeSlider = document.getElementById('sizeSlider');
const decaySlider = document.getElementById('decaySlider');
const choreographBtn = document.getElementById('choreographBtn');
const playSequenceBtn = document.getElementById('playSequenceBtn');
const saveSequenceBtn = document.getElementById('saveSequenceBtn');
const loadSequenceBtn = document.getElementById('loadSequenceBtn');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particles = [];
let isChoreographMode = false;
let sequence = [];
let isPlayingSequence = false;

class Particle {
    constructor(x, y, vx, vy, color, size, life) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
        this.life = life;
        this.maxLife = life;
        this.trail = [{x: x, y: y}]; // For spark trail
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1; // gravity
        this.life -= parseFloat(decaySlider.value);
        // Add to trail
        this.trail.push({x: this.x, y: this.y});
        if (this.trail.length > 5) this.trail.shift(); // Keep last 5 positions
    }

    draw() {
        if (this.life > 0) {
            ctx.save();
            ctx.globalAlpha = this.life / this.maxLife;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 5;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.size;
            ctx.lineCap = 'round';
            // Draw trail as connected lines
            ctx.beginPath();
            for (let i = 0; i < this.trail.length - 1; i++) {
                const alpha = (i + 1) / this.trail.length * (this.life / this.maxLife);
                ctx.globalAlpha = alpha;
                ctx.moveTo(this.trail[i].x, this.trail[i].y);
                ctx.lineTo(this.trail[i + 1].x, this.trail[i + 1].y);
            }
            ctx.stroke();
            ctx.restore();
        }
    }
}

function createBurst(x, y) {
    const numParticles = 50;
    const colors = [color1.value, color2.value, color3.value];
    const size = Math.max(1, parseInt(sizeSlider.value) - 2); // Smaller size for sparks
    for (let i = 0; i < numParticles; i++) {
        const angle = (Math.PI * 2 * i) / numParticles + (Math.random() - 0.5) * 0.5; // Add some randomness
        const speed = Math.random() * 6 + 3;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        const life = 120;
        const color = colors[i % 3];
        particles.push(new Particle(x, y, vx, vy, color, size, life));
    }
}

canvas.addEventListener('mousedown', (e) => {
    if (!isChoreographMode) {
        createBurst(e.clientX, e.clientY);
    } else {
        // Record burst in sequence
        sequence.push({ x: e.clientX, y: e.clientY, time: Date.now() });
    }
});

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        p.update();
        p.draw();
    });
    requestAnimationFrame(animate);
}

animate();

choreographBtn.addEventListener('click', () => {
    isChoreographMode = !isChoreographMode;
    choreographBtn.textContent = isChoreographMode ? 'Exit Choreograph Mode' : 'Enter Choreograph Mode';
    playSequenceBtn.disabled = !isChoreographMode;
    saveSequenceBtn.disabled = !isChoreographMode;
});

playSequenceBtn.addEventListener('click', () => {
    if (sequence.length > 0) {
        isPlayingSequence = true;
        let startTime = Date.now();
        sequence.forEach((burst, index) => {
            setTimeout(() => {
                createBurst(burst.x, burst.y);
                if (index === sequence.length - 1) {
                    isPlayingSequence = false;
                }
            }, burst.time - startTime);
        });
    }
});

saveSequenceBtn.addEventListener('click', () => {
    const dataStr = JSON.stringify(sequence);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'fireworks-sequence.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
});

loadSequenceBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            sequence = JSON.parse(e.target.result);
            playSequenceBtn.disabled = false;
            saveSequenceBtn.disabled = false;
        };
        reader.readAsText(file);
    };
    input.click();
});
