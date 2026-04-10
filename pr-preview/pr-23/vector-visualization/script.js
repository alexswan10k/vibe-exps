const canvas = document.getElementById('vectorCanvas');
const ctx = canvas.getContext('2d');

const angleASlider = document.getElementById('angleASlider');
const angleAInput = document.getElementById('angleAInput');
const angleAValue = document.getElementById('angleA');
const magASlider = document.getElementById('magASlider');
const magAInput = document.getElementById('magAInput');
const magAValue = document.getElementById('magA');
const compAX = document.getElementById('compAX');
const compAY = document.getElementById('compAY');

const angleBSlider = document.getElementById('angleBSlider');
const angleBInput = document.getElementById('angleBInput');
const angleBValue = document.getElementById('angleB');
const magBSlider = document.getElementById('magBSlider');
const magBInput = document.getElementById('magBInput');
const magBValue = document.getElementById('magB');
const compBX = document.getElementById('compBX');
const compBY = document.getElementById('compBY');

const normalizeCheck = document.getElementById('normalizeCheck');

const dotProductValue = document.getElementById('dotProduct');
const crossProductValue = document.getElementById('crossProduct');
const angleBetweenValue = document.getElementById('angleBetween');

const sameBtn = document.getElementById('sameBtn');
const thirtyBtn = document.getElementById('thirtyBtn');
const fortyFiveBtn = document.getElementById('fortyFiveBtn');
const ninetyBtn = document.getElementById('ninetyBtn');
const oneThirtyFiveBtn = document.getElementById('oneThirtyFiveBtn');
const invertedBtn = document.getElementById('invertedBtn');

const centerX = canvas.width / 2;
const centerY = canvas.height / 2;
const scale = 1; // pixels per unit

function degreesToRadians(deg) {
    return deg * Math.PI / 180;
}

function radiansToDegrees(rad) {
    return rad * 180 / Math.PI;
}

function getVector(angle, magnitude) {
    const rad = degreesToRadians(angle);
    return {
        x: magnitude * Math.cos(rad),
        y: -magnitude * Math.sin(rad) // negative because canvas y is down
    };
}

function dotProduct(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y;
}

function crossProduct(v1, v2) {
    return v1.x * v2.y - v1.y * v2.x;
}

function magnitude(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y);
}

function angleBetween(v1, v2) {
    const dot = dotProduct(v1, v2);
    const mag1 = magnitude(v1);
    const mag2 = magnitude(v2);
    return radiansToDegrees(Math.acos(dot / (mag1 * mag2)));
}

function drawArrow(fromX, fromY, toX, toY, color) {
    const headlen = 15;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // arrowhead
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
}

function drawAngleArc(v1, v2) {
    const angle1 = Math.atan2(v1.y, v1.x);
    const angle2 = Math.atan2(v2.y, v2.x);
    let delta = angle2 - angle1;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    const angleBet = Math.abs(delta) * 180 / Math.PI; // degrees
    const start = angle1;
    const end = delta >= 0 ? angle1 + (angleBet * Math.PI / 180) : angle1 - (angleBet * Math.PI / 180);
    const radius = 20; // even smaller radius to be more inside
    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, start, end);
    ctx.stroke();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(canvas.width, centerY);
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, canvas.height);
    ctx.stroke();

    let angleA = parseFloat(angleASlider.value);
    let magA = parseFloat(magASlider.value);
    let angleB = parseFloat(angleBSlider.value);
    let magB = parseFloat(magBSlider.value);

    if (normalizeCheck.checked) {
        magA = 1;
        magB = 1;
    }

    const v1 = getVector(angleA, magA);
    const v2 = getVector(angleB, magB);

    // Draw vectors
    drawArrow(centerX, centerY, centerX + v1.x * scale, centerY + v1.y * scale, 'red');
    drawArrow(centerX, centerY, centerX + v2.x * scale, centerY + v2.y * scale, 'green');

    // Draw angle arc
    drawAngleArc(v1, v2);

    // Update displays
    angleAValue.textContent = angleA;
    angleAInput.value = angleA;
    magAValue.textContent = magA;
    magAInput.value = magA;
    compAX.textContent = v1.x.toFixed(2);
    compAY.textContent = v1.y.toFixed(2);

    angleBValue.textContent = angleB;
    angleBInput.value = angleB;
    magBValue.textContent = magB;
    magBInput.value = magB;
    compBX.textContent = v2.x.toFixed(2);
    compBY.textContent = v2.y.toFixed(2);

    const dot = dotProduct(v1, v2);
    const cross = crossProduct(v1, v2);
    const angleBet = angleBetween(v1, v2);

    dotProductValue.textContent = dot.toFixed(2);
    crossProductValue.textContent = cross.toFixed(2);
    angleBetweenValue.textContent = angleBet.toFixed(2);
}

function updateSliders() {
    draw();
}

angleASlider.addEventListener('input', () => {
    angleAInput.value = angleASlider.value;
    updateSliders();
});
magASlider.addEventListener('input', () => {
    magAInput.value = magASlider.value;
    updateSliders();
});
angleBSlider.addEventListener('input', () => {
    angleBInput.value = angleBSlider.value;
    updateSliders();
});
magBSlider.addEventListener('input', () => {
    magBInput.value = magBSlider.value;
    updateSliders();
});

angleAInput.addEventListener('input', () => {
    angleASlider.value = angleAInput.value;
    updateSliders();
});
magAInput.addEventListener('input', () => {
    magASlider.value = magAInput.value;
    updateSliders();
});
angleBInput.addEventListener('input', () => {
    angleBSlider.value = angleBInput.value;
    updateSliders();
});
magBInput.addEventListener('input', () => {
    magBSlider.value = magBInput.value;
    updateSliders();
});

normalizeCheck.addEventListener('change', updateSliders);

sameBtn.addEventListener('click', () => {
    angleBSlider.value = angleASlider.value;
    angleBInput.value = angleBSlider.value;
    draw();
});

thirtyBtn.addEventListener('click', () => {
    angleBSlider.value = (parseFloat(angleASlider.value) + 30) % 360;
    angleBInput.value = angleBSlider.value;
    draw();
});

fortyFiveBtn.addEventListener('click', () => {
    angleBSlider.value = (parseFloat(angleASlider.value) + 45) % 360;
    angleBInput.value = angleBSlider.value;
    draw();
});

ninetyBtn.addEventListener('click', () => {
    angleBSlider.value = (parseFloat(angleASlider.value) + 90) % 360;
    angleBInput.value = angleBSlider.value;
    draw();
});

oneThirtyFiveBtn.addEventListener('click', () => {
    angleBSlider.value = (parseFloat(angleASlider.value) + 135) % 360;
    angleBInput.value = angleBSlider.value;
    draw();
});

invertedBtn.addEventListener('click', () => {
    angleBSlider.value = (parseFloat(angleASlider.value) + 180) % 360;
    angleBInput.value = angleBSlider.value;
    draw();
});

// Initial draw
draw();