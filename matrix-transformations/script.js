const canvas = document.getElementById('transformCanvas');
const ctx = canvas.getContext('2d');

const centerX = canvas.width / 2;
const centerY = canvas.height / 2;
const scale = 1;

// Get control elements
const rotationSlider = document.getElementById('rotationSlider');
const rotationInput = document.getElementById('rotationInput');
const rotationValue = document.getElementById('rotationValue');

const scaleXSlider = document.getElementById('scaleXSlider');
const scaleXInput = document.getElementById('scaleXInput');
const scaleXValue = document.getElementById('scaleXValue');

const scaleYSlider = document.getElementById('scaleYSlider');
const scaleYInput = document.getElementById('scaleYInput');
const scaleYValue = document.getElementById('scaleYValue');

const translateXSlider = document.getElementById('translateXSlider');
const translateXInput = document.getElementById('translateXInput');
const translateXValue = document.getElementById('translateXValue');

const translateYSlider = document.getElementById('translateYSlider');
const translateYInput = document.getElementById('translateYInput');
const translateYValue = document.getElementById('translateYValue');

const shearXSlider = document.getElementById('shearXSlider');
const shearXInput = document.getElementById('shearXInput');
const shearXValue = document.getElementById('shearXValue');

const shearYSlider = document.getElementById('shearYSlider');
const shearYInput = document.getElementById('shearYInput');
const shearYValue = document.getElementById('shearYValue');

const showOriginalCheck = document.getElementById('showOriginal');
const showGridCheck = document.getElementById('showGrid');
const matrixDisplay = document.getElementById('matrixDisplay');
const shapeSelect = document.getElementById('shapeSelect');

// Preset buttons
const identityBtn = document.getElementById('identityBtn');
const rotate45Btn = document.getElementById('rotate45Btn');
const scale2xBtn = document.getElementById('scale2xBtn');
const translate50Btn = document.getElementById('translate50Btn');
const shearBtn = document.getElementById('shearBtn');
const reflectXBtn = document.getElementById('reflectXBtn');
const complexBtn = document.getElementById('complexBtn');

// Matrix operations
function createIdentityMatrix() {
    return [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
    ];
}

function createRotationMatrix(angle) {
    const rad = angle * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return [
        [cos, -sin, 0],
        [sin, cos, 0],
        [0, 0, 1]
    ];
}

function createScalingMatrix(sx, sy) {
    return [
        [sx, 0, 0],
        [0, sy, 0],
        [0, 0, 1]
    ];
}

function createTranslationMatrix(tx, ty) {
    return [
        [1, 0, tx],
        [0, 1, ty],
        [0, 0, 1]
    ];
}

function createShearMatrix(shx, shy) {
    return [
        [1, shx, 0],
        [shy, 1, 0],
        [0, 0, 1]
    ];
}

function createReflectionXMatrix() {
    return [
        [1, 0, 0],
        [0, -1, 0],
        [0, 0, 1]
    ];
}

function multiplyMatrices(a, b) {
    const result = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
    ];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            for (let k = 0; k < 3; k++) {
                result[i][j] += a[i][k] * b[k][j];
            }
        }
    }
    return result;
}

function transformPoint(matrix, point) {
    const x = point[0];
    const y = point[1];
    const w = 1;
    const newX = matrix[0][0] * x + matrix[0][1] * y + matrix[0][2] * w;
    const newY = matrix[1][0] * x + matrix[1][1] * y + matrix[1][2] * w;
    return [newX, newY];
}

function transformPoints(matrix, points) {
    return points.map(point => transformPoint(matrix, point));
}

// Shape definitions
const shapes = {
    square: [
        [-50, -50],
        [50, -50],
        [50, 50],
        [-50, 50]
    ],
    triangle: [
        [0, -50],
        [-50, 50],
        [50, 50]
    ],
    circle: (() => {
        const points = [];
        for (let i = 0; i < 32; i++) {
            const angle = (i / 32) * 2 * Math.PI;
            points.push([Math.cos(angle) * 50, Math.sin(angle) * 50]);
        }
        return points;
    })(),
    arrow: [
        [0, -50],
        [-20, -20],
        [-10, -20],
        [-10, 50],
        [10, 50],
        [10, -20],
        [20, -20]
    ]
};

function drawShape(points, color, fill = false) {
    if (points.length === 0) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX + points[0][0] * scale, centerY + points[0][1] * scale);

    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(centerX + points[i][0] * scale, centerY + points[i][1] * scale);
    }

    if (fill) {
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    } else {
        ctx.closePath();
        ctx.stroke();
    }
}

function drawGrid() {
    if (!showGridCheck.checked) return;

    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x <= canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= canvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(canvas.width, centerY);
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, canvas.height);
    ctx.stroke();
}

function updateMatrixDisplay(matrix) {
    const formatted = matrix.map(row =>
        `[${row.map(val => val.toFixed(2)).join(', ')}]`
    ).join('<br>');
    matrixDisplay.innerHTML = formatted;
}

function getCombinedMatrix() {
    const rotation = parseFloat(rotationSlider.value);
    const scaleX = parseFloat(scaleXSlider.value);
    const scaleY = parseFloat(scaleYSlider.value);
    const translateX = parseFloat(translateXSlider.value);
    const translateY = parseFloat(translateYSlider.value);
    const shearX = parseFloat(shearXSlider.value);
    const shearY = parseFloat(shearYSlider.value);

    // Apply transformations in order: scale -> shear -> rotate -> translate
    const scaleMatrix = createScalingMatrix(scaleX, scaleY);
    const shearMatrix = createShearMatrix(shearX, shearY);
    const rotationMatrix = createRotationMatrix(rotation);
    const translationMatrix = createTranslationMatrix(translateX, translateY);

    let matrix = multiplyMatrices(shearMatrix, scaleMatrix);
    matrix = multiplyMatrices(rotationMatrix, matrix);
    matrix = multiplyMatrices(translationMatrix, matrix);

    return matrix;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawGrid();

    const currentShape = shapes[shapeSelect.value];
    const matrix = getCombinedMatrix();
    const transformedShape = transformPoints(matrix, currentShape);

    // Draw original shape if checked
    if (showOriginalCheck.checked) {
        drawShape(currentShape, 'rgba(255, 0, 0, 0.5)', true);
    }

    // Draw transformed shape
    drawShape(transformedShape, 'blue', false);

    // Update matrix display
    updateMatrixDisplay(matrix);

    // Update UI values
    rotationValue.textContent = rotationSlider.value;
    rotationInput.value = rotationSlider.value;

    scaleXValue.textContent = scaleXSlider.value;
    scaleXInput.value = scaleXSlider.value;

    scaleYValue.textContent = scaleYSlider.value;
    scaleYInput.value = scaleYSlider.value;

    translateXValue.textContent = translateXSlider.value;
    translateXInput.value = translateXSlider.value;

    translateYValue.textContent = translateYSlider.value;
    translateYInput.value = translateYSlider.value;

    shearXValue.textContent = shearXSlider.value;
    shearXInput.value = shearXSlider.value;

    shearYValue.textContent = shearYSlider.value;
    shearYInput.value = shearYSlider.value;
}

// Event listeners for sliders
rotationSlider.addEventListener('input', () => {
    rotationInput.value = rotationSlider.value;
    draw();
});

scaleXSlider.addEventListener('input', () => {
    scaleXInput.value = scaleXSlider.value;
    draw();
});

scaleYSlider.addEventListener('input', () => {
    scaleYInput.value = scaleYSlider.value;
    draw();
});

translateXSlider.addEventListener('input', () => {
    translateXInput.value = translateXSlider.value;
    draw();
});

translateYSlider.addEventListener('input', () => {
    translateYInput.value = translateYSlider.value;
    draw();
});

// Event listeners for number inputs
rotationInput.addEventListener('input', () => {
    rotationSlider.value = rotationInput.value;
    draw();
});

scaleXInput.addEventListener('input', () => {
    scaleXSlider.value = scaleXInput.value;
    draw();
});

scaleYInput.addEventListener('input', () => {
    scaleYSlider.value = scaleYSlider.value;
    draw();
});

translateXInput.addEventListener('input', () => {
    translateXSlider.value = translateXInput.value;
    draw();
});

translateYInput.addEventListener('input', () => {
    translateYSlider.value = translateYInput.value;
    draw();
});

shearXSlider.addEventListener('input', () => {
    shearXInput.value = shearXSlider.value;
    draw();
});

shearXInput.addEventListener('input', () => {
    shearXSlider.value = shearXInput.value;
    draw();
});

shearYSlider.addEventListener('input', () => {
    shearYInput.value = shearYSlider.value;
    draw();
});

shearYInput.addEventListener('input', () => {
    shearYSlider.value = shearYInput.value;
    draw();
});

// Checkbox listeners
showOriginalCheck.addEventListener('change', draw);
showGridCheck.addEventListener('change', draw);

// Shape selector
shapeSelect.addEventListener('change', draw);

// Preset buttons
identityBtn.addEventListener('click', () => {
    rotationSlider.value = 0;
    scaleXSlider.value = 1;
    scaleYSlider.value = 1;
    translateXSlider.value = 0;
    translateYSlider.value = 0;
    shearXSlider.value = 0;
    shearYSlider.value = 0;
    draw();
});

rotate45Btn.addEventListener('click', () => {
    rotationSlider.value = 45;
    draw();
});

scale2xBtn.addEventListener('click', () => {
    scaleXSlider.value = 2;
    scaleYSlider.value = 2;
    draw();
});

translate50Btn.addEventListener('click', () => {
    translateXSlider.value = 50;
    translateYSlider.value = 30;
    draw();
});

shearBtn.addEventListener('click', () => {
    shearXSlider.value = 0.5;
    shearYSlider.value = 0.3;
    draw();
});

reflectXBtn.addEventListener('click', () => {
    scaleYSlider.value = -1;
    draw();
});

complexBtn.addEventListener('click', () => {
    rotationSlider.value = 30;
    scaleXSlider.value = 1.5;
    scaleYSlider.value = 0.8;
    translateXSlider.value = 20;
    translateYSlider.value = -15;
    shearXSlider.value = 0.2;
    shearYSlider.value = -0.1;
    draw();
});

// Initial draw
draw();