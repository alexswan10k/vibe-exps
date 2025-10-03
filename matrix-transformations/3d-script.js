const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 600 / 600, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(600, 600);
document.getElementById('threejs-container').appendChild(renderer.domElement);

camera.position.set(150, 150, 150);
camera.lookAt(0, 0, 0);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.update();

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

// Axes
const axesHelper = new THREE.AxesHelper(100);
scene.add(axesHelper);

// Grid
const gridHelper = new THREE.GridHelper(200, 20);
scene.add(gridHelper);

// Get control elements
const rotationXSlider = document.getElementById('rotationXSlider');
const rotationXInput = document.getElementById('rotationXInput');
const rotationXValue = document.getElementById('rotationXValue');

const rotationYSlider = document.getElementById('rotationYSlider');
const rotationYInput = document.getElementById('rotationYInput');
const rotationYValue = document.getElementById('rotationYValue');

const rotationZSlider = document.getElementById('rotationZSlider');
const rotationZInput = document.getElementById('rotationZInput');
const rotationZValue = document.getElementById('rotationZValue');

const scaleXSlider = document.getElementById('scaleXSlider');
const scaleXInput = document.getElementById('scaleXInput');
const scaleXValue = document.getElementById('scaleXValue');

const scaleYSlider = document.getElementById('scaleYSlider');
const scaleYInput = document.getElementById('scaleYInput');
const scaleYValue = document.getElementById('scaleYValue');

const scaleZSlider = document.getElementById('scaleZSlider');
const scaleZInput = document.getElementById('scaleZInput');
const scaleZValue = document.getElementById('scaleZValue');

const translateXSlider = document.getElementById('translateXSlider');
const translateXInput = document.getElementById('translateXInput');
const translateXValue = document.getElementById('translateXValue');

const translateYSlider = document.getElementById('translateYSlider');
const translateYInput = document.getElementById('translateYInput');
const translateYValue = document.getElementById('translateYValue');

const translateZSlider = document.getElementById('translateZSlider');
const translateZInput = document.getElementById('translateZInput');
const translateZValue = document.getElementById('translateZValue');

const showOriginalCheck = document.getElementById('showOriginal');
const matrixDisplay = document.getElementById('matrixDisplay');
const shapeSelect = document.getElementById('shapeSelect');

// Preset buttons
const identityBtn = document.getElementById('identityBtn');
const rotateX45Btn = document.getElementById('rotateX45Btn');
const rotateY45Btn = document.getElementById('rotateY45Btn');
const rotateZ45Btn = document.getElementById('rotateZ45Btn');
const scale2xBtn = document.getElementById('scale2xBtn');
const translateBtn = document.getElementById('translateBtn');
const complexBtn = document.getElementById('complexBtn');

// 3D Shapes
let currentShape;
let originalShape;

function createCube() {
    const geometry = new THREE.BoxGeometry(50, 50, 50);
    const material = new THREE.MeshLambertMaterial({ color: 0x00ff00, transparent: true, opacity: 0.7 });
    return new THREE.Mesh(geometry, material);
}

function createPyramid() {
    const geometry = new THREE.ConeGeometry(35, 70, 4);
    const material = new THREE.MeshLambertMaterial({ color: 0x00ff00, transparent: true, opacity: 0.7 });
    return new THREE.Mesh(geometry, material);
}

function createSphere() {
    const geometry = new THREE.SphereGeometry(35, 16, 16);
    const material = new THREE.MeshLambertMaterial({ color: 0x00ff00, transparent: true, opacity: 0.7 });
    return new THREE.Mesh(geometry, material);
}

function createWireframe(shape) {
    const wireframe = new THREE.LineSegments(
        new THREE.EdgesGeometry(shape.geometry),
        new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
    );
    return wireframe;
}

function updateShape() {
    // Remove existing shapes
    if (currentShape) scene.remove(currentShape);
    if (originalShape) scene.remove(originalShape);

    const shapeType = shapeSelect.value;

    if (shapeType === 'cube') {
        currentShape = createCube();
        originalShape = createCube();
        originalShape.material = new THREE.MeshLambertMaterial({ color: 0xff0000, transparent: true, opacity: 0.3 });
    } else if (shapeType === 'pyramid') {
        currentShape = createPyramid();
        originalShape = createPyramid();
        originalShape.material = new THREE.MeshLambertMaterial({ color: 0xff0000, transparent: true, opacity: 0.3 });
    } else if (shapeType === 'sphere') {
        currentShape = createSphere();
        originalShape = createSphere();
        originalShape.material = new THREE.MeshLambertMaterial({ color: 0xff0000, transparent: true, opacity: 0.3 });
    }

    scene.add(currentShape);
    if (showOriginalCheck.checked) {
        scene.add(originalShape);
    }

    updateTransform();
}

function getCombinedMatrix() {
    const rotX = THREE.MathUtils.degToRad(parseFloat(rotationXSlider.value));
    const rotY = THREE.MathUtils.degToRad(parseFloat(rotationYSlider.value));
    const rotZ = THREE.MathUtils.degToRad(parseFloat(rotationZSlider.value));

    const scaleX = parseFloat(scaleXSlider.value);
    const scaleY = parseFloat(scaleYSlider.value);
    const scaleZ = parseFloat(scaleZSlider.value);

    const transX = parseFloat(translateXSlider.value);
    const transY = parseFloat(translateYSlider.value);
    const transZ = parseFloat(translateZSlider.value);

    // Create transformation matrix
    const matrix = new THREE.Matrix4();

    // Apply transformations in order: translate -> rotate Z -> rotate Y -> rotate X -> scale
    matrix.makeTranslation(transX, transY, transZ);

    const rotZMatrix = new THREE.Matrix4().makeRotationZ(rotZ);
    matrix.multiply(rotZMatrix);

    const rotYMatrix = new THREE.Matrix4().makeRotationY(rotY);
    matrix.multiply(rotYMatrix);

    const rotXMatrix = new THREE.Matrix4().makeRotationX(rotX);
    matrix.multiply(rotXMatrix);

    const scaleMatrix = new THREE.Matrix4().makeScale(scaleX, scaleY, scaleZ);
    matrix.multiply(scaleMatrix);

    return matrix;
}

function updateTransform() {
    if (!currentShape) return;

    const matrix = getCombinedMatrix();
    currentShape.matrix.copy(matrix);
    currentShape.matrixAutoUpdate = false;

    // Update matrix display
    updateMatrixDisplay(matrix);

    renderer.render(scene, camera);
}

function updateMatrixDisplay(matrix) {
    const elements = matrix.elements;
    const formatted = [
        `[${elements[0].toFixed(2)}, ${elements[4].toFixed(2)}, ${elements[8].toFixed(2)}, ${elements[12].toFixed(2)}]`,
        `[${elements[1].toFixed(2)}, ${elements[5].toFixed(2)}, ${elements[9].toFixed(2)}, ${elements[13].toFixed(2)}]`,
        `[${elements[2].toFixed(2)}, ${elements[6].toFixed(2)}, ${elements[10].toFixed(2)}, ${elements[14].toFixed(2)}]`,
        `[${elements[3].toFixed(2)}, ${elements[7].toFixed(2)}, ${elements[11].toFixed(2)}, ${elements[15].toFixed(2)}]`
    ].join('<br>');
    matrixDisplay.innerHTML = formatted;
}

function updateUI() {
    rotationXValue.textContent = rotationXSlider.value;
    rotationXInput.value = rotationXSlider.value;

    rotationYValue.textContent = rotationYSlider.value;
    rotationYInput.value = rotationYSlider.value;

    rotationZValue.textContent = rotationZSlider.value;
    rotationZInput.value = rotationZSlider.value;

    scaleXValue.textContent = scaleXSlider.value;
    scaleXInput.value = scaleXSlider.value;

    scaleYValue.textContent = scaleYSlider.value;
    scaleYInput.value = scaleYSlider.value;

    scaleZValue.textContent = scaleZSlider.value;
    scaleZInput.value = scaleZSlider.value;

    translateXValue.textContent = translateXSlider.value;
    translateXInput.value = translateXSlider.value;

    translateYValue.textContent = translateYSlider.value;
    translateYInput.value = translateYSlider.value;

    translateZValue.textContent = translateZSlider.value;
    translateZInput.value = translateZSlider.value;
}

// Event listeners
rotationXSlider.addEventListener('input', () => {
    rotationXInput.value = rotationXSlider.value;
    updateTransform();
    updateUI();
});

rotationXInput.addEventListener('input', () => {
    rotationXSlider.value = rotationXInput.value;
    updateTransform();
    updateUI();
});

rotationYSlider.addEventListener('input', () => {
    rotationYInput.value = rotationYSlider.value;
    updateTransform();
    updateUI();
});

rotationYInput.addEventListener('input', () => {
    rotationYSlider.value = rotationYInput.value;
    updateTransform();
    updateUI();
});

rotationZSlider.addEventListener('input', () => {
    rotationZInput.value = rotationZSlider.value;
    updateTransform();
    updateUI();
});

rotationZInput.addEventListener('input', () => {
    rotationZSlider.value = rotationZInput.value;
    updateTransform();
    updateUI();
});

scaleXSlider.addEventListener('input', () => {
    scaleXInput.value = scaleXSlider.value;
    updateTransform();
    updateUI();
});

scaleXInput.addEventListener('input', () => {
    scaleXSlider.value = scaleXInput.value;
    updateTransform();
    updateUI();
});

scaleYSlider.addEventListener('input', () => {
    scaleYInput.value = scaleYSlider.value;
    updateTransform();
    updateUI();
});

scaleYInput.addEventListener('input', () => {
    scaleYSlider.value = scaleYInput.value;
    updateTransform();
    updateUI();
});

scaleZSlider.addEventListener('input', () => {
    scaleZInput.value = scaleZSlider.value;
    updateTransform();
    updateUI();
});

scaleZInput.addEventListener('input', () => {
    scaleZSlider.value = scaleZInput.value;
    updateTransform();
    updateUI();
});

translateXSlider.addEventListener('input', () => {
    translateXInput.value = translateXSlider.value;
    updateTransform();
    updateUI();
});

translateXInput.addEventListener('input', () => {
    translateXSlider.value = translateXInput.value;
    updateTransform();
    updateUI();
});

translateYSlider.addEventListener('input', () => {
    translateYInput.value = translateYSlider.value;
    updateTransform();
    updateUI();
});

translateYInput.addEventListener('input', () => {
    translateYSlider.value = translateYInput.value;
    updateTransform();
    updateUI();
});

translateZSlider.addEventListener('input', () => {
    translateZInput.value = translateZSlider.value;
    updateTransform();
    updateUI();
});

translateZInput.addEventListener('input', () => {
    translateZSlider.value = translateZInput.value;
    updateTransform();
    updateUI();
});

showOriginalCheck.addEventListener('change', () => {
    if (showOriginalCheck.checked && originalShape) {
        scene.add(originalShape);
    } else if (originalShape) {
        scene.remove(originalShape);
    }
    renderer.render(scene, camera);
});

shapeSelect.addEventListener('change', updateShape);

// Preset buttons
identityBtn.addEventListener('click', () => {
    rotationXSlider.value = 0;
    rotationYSlider.value = 0;
    rotationZSlider.value = 0;
    scaleXSlider.value = 1;
    scaleYSlider.value = 1;
    scaleZSlider.value = 1;
    translateXSlider.value = 0;
    translateYSlider.value = 0;
    translateZSlider.value = 0;
    updateTransform();
    updateUI();
});

rotateX45Btn.addEventListener('click', () => {
    rotationXSlider.value = 45;
    updateTransform();
    updateUI();
});

rotateY45Btn.addEventListener('click', () => {
    rotationYSlider.value = 45;
    updateTransform();
    updateUI();
});

rotateZ45Btn.addEventListener('click', () => {
    rotationZSlider.value = 45;
    updateTransform();
    updateUI();
});

scale2xBtn.addEventListener('click', () => {
    scaleXSlider.value = 2;
    scaleYSlider.value = 2;
    scaleZSlider.value = 2;
    updateTransform();
    updateUI();
});

translateBtn.addEventListener('click', () => {
    translateXSlider.value = 20;
    translateYSlider.value = 15;
    translateZSlider.value = 10;
    updateTransform();
    updateUI();
});

complexBtn.addEventListener('click', () => {
    rotationXSlider.value = 30;
    rotationYSlider.value = 45;
    rotationZSlider.value = 15;
    scaleXSlider.value = 1.5;
    scaleYSlider.value = 0.8;
    scaleZSlider.value = 1.2;
    translateXSlider.value = 10;
    translateYSlider.value = -5;
    translateZSlider.value = 8;
    updateTransform();
    updateUI();
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Initialize
updateShape();
updateUI();
animate();