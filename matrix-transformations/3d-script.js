const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 600 / 600, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(400, 400);
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

// Shape management
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

function updateShape(shapeType, showOriginal) {
    // Remove existing shapes
    if (currentShape) scene.remove(currentShape);
    if (originalShape) scene.remove(originalShape);

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
    if (showOriginal) {
        scene.add(originalShape);
    }
}

function getCombinedMatrix(transforms) {
    const matrix = new THREE.Matrix4();

    for (let transform of transforms) {
        let transformMatrix;
        if (transform.type === 'translate') {
            transformMatrix = new THREE.Matrix4().makeTranslation(transform.translateX, transform.translateY, transform.translateZ);
        } else if (transform.type === 'rotateX') {
            const rad = THREE.MathUtils.degToRad(transform.angle);
            transformMatrix = new THREE.Matrix4().makeRotationX(rad);
        } else if (transform.type === 'rotateY') {
            const rad = THREE.MathUtils.degToRad(transform.angle);
            transformMatrix = new THREE.Matrix4().makeRotationY(rad);
        } else if (transform.type === 'rotateZ') {
            const rad = THREE.MathUtils.degToRad(transform.angle);
            transformMatrix = new THREE.Matrix4().makeRotationZ(rad);
        } else if (transform.type === 'scale') {
            transformMatrix = new THREE.Matrix4().makeScale(transform.scaleX, transform.scaleY, transform.scaleZ);
        }
        matrix.multiply(transformMatrix);
    }

    return matrix;
}

function updateTransformDisplay(transforms) {
    if (!currentShape) return;

    const matrix = getCombinedMatrix(transforms);
    currentShape.matrix.copy(matrix);
    currentShape.matrixAutoUpdate = false;

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
    document.getElementById('matrixDisplay').innerHTML = formatted;
}

function getSingleTransformMatrix(transform) {
    const matrix = new THREE.Matrix4();
    if (transform.type === 'translate') {
        matrix.makeTranslation(transform.translateX, transform.translateY, transform.translateZ);
    } else if (transform.type === 'rotateX') {
        const rad = THREE.MathUtils.degToRad(transform.angle);
        matrix.makeRotationX(rad);
    } else if (transform.type === 'rotateY') {
        const rad = THREE.MathUtils.degToRad(transform.angle);
        matrix.makeRotationY(rad);
    } else if (transform.type === 'rotateZ') {
        const rad = THREE.MathUtils.degToRad(transform.angle);
        matrix.makeRotationZ(rad);
    } else if (transform.type === 'scale') {
        matrix.makeScale(transform.scaleX, transform.scaleY, transform.scaleZ);
    }
    return matrix;
}

function updatePipelineDisplay(transforms) {
    const element = document.getElementById('pipelineDisplay');
    if (!element) return;

    let html = '';
    for (let i = 0; i < transforms.length; i++) {
        const transform = transforms[i];
        const matrix = getSingleTransformMatrix(transform);
        const elements = matrix.elements;
        const name = transform.type === 'rotateX' ? `Rotate X(${transform.angle}°)` :
                     transform.type === 'rotateY' ? `Rotate Y(${transform.angle}°)` :
                     transform.type === 'rotateZ' ? `Rotate Z(${transform.angle}°)` :
                     transform.type === 'scale' ? `Scale(${transform.scaleX}, ${transform.scaleY}, ${transform.scaleZ})` :
                     transform.type === 'translate' ? `Translate(${transform.translateX}, ${transform.translateY}, ${transform.translateZ})` : transform.type;
        html += `<div><strong>${name}</strong><br>`;
        html += [
            `[${elements[0].toFixed(2)}, ${elements[4].toFixed(2)}, ${elements[8].toFixed(2)}, ${elements[12].toFixed(2)}]`,
            `[${elements[1].toFixed(2)}, ${elements[5].toFixed(2)}, ${elements[9].toFixed(2)}, ${elements[13].toFixed(2)}]`,
            `[${elements[2].toFixed(2)}, ${elements[6].toFixed(2)}, ${elements[10].toFixed(2)}, ${elements[14].toFixed(2)}]`,
            `[${elements[3].toFixed(2)}, ${elements[7].toFixed(2)}, ${elements[11].toFixed(2)}, ${elements[15].toFixed(2)}]`
        ].join('<br>');
        html += '</div>';
        if (i < transforms.length - 1) {
            html += '<div style="text-align: center; margin: 5px 0;">×</div>';
        }
    }
    if (transforms.length > 0) {
        const combined = getCombinedMatrix(transforms);
        const elements = combined.elements;
        html += '<div style="text-align: center; margin: 10px 0; font-weight: bold;">=</div>';
        html += '<div><strong>Combined Matrix</strong><br>';
        html += [
            `[${elements[0].toFixed(2)}, ${elements[4].toFixed(2)}, ${elements[8].toFixed(2)}, ${elements[12].toFixed(2)}]`,
            `[${elements[1].toFixed(2)}, ${elements[5].toFixed(2)}, ${elements[9].toFixed(2)}, ${elements[13].toFixed(2)}]`,
            `[${elements[2].toFixed(2)}, ${elements[6].toFixed(2)}, ${elements[10].toFixed(2)}, ${elements[14].toFixed(2)}]`,
            `[${elements[3].toFixed(2)}, ${elements[7].toFixed(2)}, ${elements[11].toFixed(2)}, ${elements[15].toFixed(2)}]`
        ].join('<br>');
        html += '</div>';
    } else {
        html = 'No transformations applied.';
    }
    element.innerHTML = html;
}

// React Components
function TransformBlock({ transform, index, onUpdate, onMoveUp, onMoveDown, onDelete }) {
    const handleChange = (field, value) => {
        onUpdate(index, { ...transform, [field]: parseFloat(value) });
    };

    const renderControls = () => {
        if (transform.type === 'rotateX' || transform.type === 'rotateY' || transform.type === 'rotateZ') {
            return React.createElement('div', null,
                React.createElement('label', null, 'Angle: ',
                    React.createElement('input', {
                        type: 'number',
                        min: 0,
                        max: 360,
                        value: transform.angle,
                        step: 1,
                        onChange: (e) => handleChange('angle', e.target.value)
                    }),
                    '° ',
                    React.createElement('span', null, transform.angle + '°')
                ),
                React.createElement('input', {
                    type: 'range',
                    min: 0,
                    max: 360,
                    value: transform.angle,
                    onChange: (e) => handleChange('angle', e.target.value)
                })
            );
        } else if (transform.type === 'scale') {
            return React.createElement('div', null,
                React.createElement('label', null, 'Scale X: ',
                    React.createElement('input', {
                        type: 'number',
                        min: 0.1,
                        max: 3,
                        value: transform.scaleX,
                        step: 0.1,
                        onChange: (e) => handleChange('scaleX', e.target.value)
                    }),
                    ' ',
                    React.createElement('span', null, transform.scaleX)
                ),
                React.createElement('input', {
                    type: 'range',
                    min: 0.1,
                    max: 3,
                    value: transform.scaleX,
                    step: 0.1,
                    onChange: (e) => handleChange('scaleX', e.target.value)
                }),
                React.createElement('label', null, 'Scale Y: ',
                    React.createElement('input', {
                        type: 'number',
                        min: 0.1,
                        max: 3,
                        value: transform.scaleY,
                        step: 0.1,
                        onChange: (e) => handleChange('scaleY', e.target.value)
                    }),
                    ' ',
                    React.createElement('span', null, transform.scaleY)
                ),
                React.createElement('input', {
                    type: 'range',
                    min: 0.1,
                    max: 3,
                    value: transform.scaleY,
                    step: 0.1,
                    onChange: (e) => handleChange('scaleY', e.target.value)
                }),
                React.createElement('label', null, 'Scale Z: ',
                    React.createElement('input', {
                        type: 'number',
                        min: 0.1,
                        max: 3,
                        value: transform.scaleZ,
                        step: 0.1,
                        onChange: (e) => handleChange('scaleZ', e.target.value)
                    }),
                    ' ',
                    React.createElement('span', null, transform.scaleZ)
                ),
                React.createElement('input', {
                    type: 'range',
                    min: 0.1,
                    max: 3,
                    value: transform.scaleZ,
                    step: 0.1,
                    onChange: (e) => handleChange('scaleZ', e.target.value)
                })
            );
        } else if (transform.type === 'translate') {
            return React.createElement('div', null,
                React.createElement('label', null, 'Translate X: ',
                    React.createElement('input', {
                        type: 'number',
                        min: -50,
                        max: 50,
                        value: transform.translateX,
                        step: 5,
                        onChange: (e) => handleChange('translateX', e.target.value)
                    }),
                    ' ',
                    React.createElement('span', null, transform.translateX)
                ),
                React.createElement('input', {
                    type: 'range',
                    min: -50,
                    max: 50,
                    value: transform.translateX,
                    onChange: (e) => handleChange('translateX', e.target.value)
                }),
                React.createElement('label', null, 'Translate Y: ',
                    React.createElement('input', {
                        type: 'number',
                        min: -50,
                        max: 50,
                        value: transform.translateY,
                        step: 5,
                        onChange: (e) => handleChange('translateY', e.target.value)
                    }),
                    ' ',
                    React.createElement('span', null, transform.translateY)
                ),
                React.createElement('input', {
                    type: 'range',
                    min: -50,
                    max: 50,
                    value: transform.translateY,
                    onChange: (e) => handleChange('translateY', e.target.value)
                }),
                React.createElement('label', null, 'Translate Z: ',
                    React.createElement('input', {
                        type: 'number',
                        min: -50,
                        max: 50,
                        value: transform.translateZ,
                        step: 5,
                        onChange: (e) => handleChange('translateZ', e.target.value)
                    }),
                    ' ',
                    React.createElement('span', null, transform.translateZ)
                ),
                React.createElement('input', {
                    type: 'range',
                    min: -50,
                    max: 50,
                    value: transform.translateZ,
                    onChange: (e) => handleChange('translateZ', e.target.value)
                })
            );
        }
    };

    const displayName = transform.type === 'rotateX' ? 'Rotate X' :
                       transform.type === 'rotateY' ? 'Rotate Y' :
                       transform.type === 'rotateZ' ? 'Rotate Z' :
                       transform.type.charAt(0).toUpperCase() + transform.type.slice(1);

    return React.createElement('div', { className: 'control-group' },
        React.createElement('h3', null,
            displayName,
            React.createElement('button', { onClick: () => onMoveUp(index) }, '↑'),
            React.createElement('button', { onClick: () => onMoveDown(index) }, '↓'),
            React.createElement('button', { onClick: () => onDelete(index) }, 'X')
        ),
        renderControls()
    );
}

function App({ initialTransforms, initialShape, initialShowOriginal }) {
    const [transforms, setTransforms] = React.useState(initialTransforms || [
        { type: 'translate', translateX: 0, translateY: 0, translateZ: 0 },
        { type: 'rotateZ', angle: 0 },
        { type: 'rotateY', angle: 0 },
        { type: 'rotateX', angle: 0 },
        { type: 'scale', scaleX: 1, scaleY: 1, scaleZ: 1 }
    ]);
    const [shape, setShape] = React.useState(initialShape || 'cube');
    const [showOriginal, setShowOriginal] = React.useState(initialShowOriginal || false);

    React.useEffect(() => {
        if (initialTransforms) {
            setTransforms(initialTransforms);
        }
    }, [initialTransforms]);

    React.useEffect(() => {
        if (initialShape) {
            setShape(initialShape);
        }
    }, [initialShape]);

    React.useEffect(() => {
        setShowOriginal(initialShowOriginal || false);
    }, [initialShowOriginal]);

    const updateTransform = (index, newTransform) => {
        const newTransforms = [...transforms];
        newTransforms[index] = newTransform;
        setTransforms(newTransforms);
    };

    const moveUp = (index) => {
        if (index > 0) {
            const newTransforms = [...transforms];
            [newTransforms[index], newTransforms[index - 1]] = [newTransforms[index - 1], newTransforms[index]];
            setTransforms(newTransforms);
        }
    };

    const moveDown = (index) => {
        if (index < transforms.length - 1) {
            const newTransforms = [...transforms];
            [newTransforms[index], newTransforms[index + 1]] = [newTransforms[index + 1], newTransforms[index]];
            setTransforms(newTransforms);
        }
    };

    const deleteTransform = (index) => {
        const newTransforms = transforms.filter((_, i) => i !== index);
        setTransforms(newTransforms);
    };

    const addTransform = (type) => {
        let newTransform;
        if (type === 'translate') {
            newTransform = { type: 'translate', translateX: 0, translateY: 0, translateZ: 0 };
        } else if (type === 'rotateX') {
            newTransform = { type: 'rotateX', angle: 0 };
        } else if (type === 'rotateY') {
            newTransform = { type: 'rotateY', angle: 0 };
        } else if (type === 'rotateZ') {
            newTransform = { type: 'rotateZ', angle: 0 };
        } else if (type === 'scale') {
            newTransform = { type: 'scale', scaleX: 1, scaleY: 1, scaleZ: 1 };
        }
        setTransforms([...transforms, newTransform]);
    };

    React.useEffect(() => {
        updateShape(shape, showOriginal);
        updateTransformDisplay(transforms);
        updatePipelineDisplay(transforms);
        window.currentTransforms = transforms;
        window.currentShape = shape;
        window.currentShowOriginal = showOriginal;
    }, [transforms, shape, showOriginal]);

    return React.createElement('div', { className: 'controls' },
        React.createElement('div', { className: 'parameter-controls' },
            React.createElement('h2', null, 'Transformation Parameters'),
            transforms.map((transform, index) =>
                React.createElement(TransformBlock, {
                    key: index,
                    transform: transform,
                    index: index,
                    onUpdate: updateTransform,
                    onMoveUp: moveUp,
                    onMoveDown: moveDown,
                    onDelete: deleteTransform
                })
            )
        ),
        React.createElement('div', { className: 'options' },
            React.createElement('label', null,
                React.createElement('input', {
                    type: 'checkbox',
                    checked: showOriginal,
                    onChange: (e) => setShowOriginal(e.target.checked)
                }), ' Show original shape'
            )
        ),
        React.createElement('div', { className: 'add-transform' },
            React.createElement('select', { id: 'addTransformSelect' },
                React.createElement('option', { value: 'translate' }, 'Translate'),
                React.createElement('option', { value: 'rotateX' }, 'Rotate X'),
                React.createElement('option', { value: 'rotateY' }, 'Rotate Y'),
                React.createElement('option', { value: 'rotateZ' }, 'Rotate Z'),
                React.createElement('option', { value: 'scale' }, 'Scale')
            ),
            React.createElement('button', { id: 'addTransformBtn', onClick: () => addTransform(document.getElementById('addTransformSelect').value) }, 'Add Transform')
        )
    );
}

// Render React app
const root = ReactDOM.createRoot(document.getElementById('react-root'));
root.render(React.createElement(App));

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// Event listeners for non-React elements
const shapeSelect = document.getElementById('shapeSelect');
shapeSelect.addEventListener('change', () => {
    window.currentShape = shapeSelect.value;
    updateShape(window.currentShape, window.currentShowOriginal || false);
    updateTransformDisplay(window.currentTransforms || []);
});

// Preset buttons
const identityBtn = document.getElementById('identityBtn');
identityBtn.addEventListener('click', () => {
    const newTransforms = [
        { type: 'translate', translateX: 0, translateY: 0, translateZ: 0 },
        { type: 'rotateZ', angle: 0 },
        { type: 'rotateY', angle: 0 },
        { type: 'rotateX', angle: 0 },
        { type: 'scale', scaleX: 1, scaleY: 1, scaleZ: 1 }
    ];
    root.render(React.createElement(App, { initialTransforms: newTransforms, initialShape: window.currentShape, initialShowOriginal: window.currentShowOriginal }));
});

const rotateX45Btn = document.getElementById('rotateX45Btn');
rotateX45Btn.addEventListener('click', () => {
    const newTransforms = [
        { type: 'translate', translateX: 0, translateY: 0, translateZ: 0 },
        { type: 'rotateZ', angle: 0 },
        { type: 'rotateY', angle: 0 },
        { type: 'rotateX', angle: 45 },
        { type: 'scale', scaleX: 1, scaleY: 1, scaleZ: 1 }
    ];
    root.render(React.createElement(App, { initialTransforms: newTransforms, initialShape: window.currentShape, initialShowOriginal: window.currentShowOriginal }));
});

const rotateY45Btn = document.getElementById('rotateY45Btn');
rotateY45Btn.addEventListener('click', () => {
    const newTransforms = [
        { type: 'translate', translateX: 0, translateY: 0, translateZ: 0 },
        { type: 'rotateZ', angle: 0 },
        { type: 'rotateY', angle: 45 },
        { type: 'rotateX', angle: 0 },
        { type: 'scale', scaleX: 1, scaleY: 1, scaleZ: 1 }
    ];
    root.render(React.createElement(App, { initialTransforms: newTransforms, initialShape: window.currentShape, initialShowOriginal: window.currentShowOriginal }));
});

const rotateZ45Btn = document.getElementById('rotateZ45Btn');
rotateZ45Btn.addEventListener('click', () => {
    const newTransforms = [
        { type: 'translate', translateX: 0, translateY: 0, translateZ: 0 },
        { type: 'rotateZ', angle: 45 },
        { type: 'rotateY', angle: 0 },
        { type: 'rotateX', angle: 0 },
        { type: 'scale', scaleX: 1, scaleY: 1, scaleZ: 1 }
    ];
    root.render(React.createElement(App, { initialTransforms: newTransforms, initialShape: window.currentShape, initialShowOriginal: window.currentShowOriginal }));
});

const scale2xBtn = document.getElementById('scale2xBtn');
scale2xBtn.addEventListener('click', () => {
    const newTransforms = [
        { type: 'translate', translateX: 0, translateY: 0, translateZ: 0 },
        { type: 'rotateZ', angle: 0 },
        { type: 'rotateY', angle: 0 },
        { type: 'rotateX', angle: 0 },
        { type: 'scale', scaleX: 2, scaleY: 2, scaleZ: 2 }
    ];
    root.render(React.createElement(App, { initialTransforms: newTransforms, initialShape: window.currentShape, initialShowOriginal: window.currentShowOriginal }));
});

const translateBtn = document.getElementById('translateBtn');
translateBtn.addEventListener('click', () => {
    const newTransforms = [
        { type: 'translate', translateX: 20, translateY: 15, translateZ: 10 },
        { type: 'rotateZ', angle: 0 },
        { type: 'rotateY', angle: 0 },
        { type: 'rotateX', angle: 0 },
        { type: 'scale', scaleX: 1, scaleY: 1, scaleZ: 1 }
    ];
    root.render(React.createElement(App, { initialTransforms: newTransforms, initialShape: window.currentShape, initialShowOriginal: window.currentShowOriginal }));
});

const complexBtn = document.getElementById('complexBtn');
complexBtn.addEventListener('click', () => {
    const newTransforms = [
        { type: 'translate', translateX: 10, translateY: -5, translateZ: 8 },
        { type: 'rotateZ', angle: 15 },
        { type: 'rotateY', angle: 45 },
        { type: 'rotateX', angle: 30 },
        { type: 'scale', scaleX: 1.5, scaleY: 0.8, scaleZ: 1.2 }
    ];
    root.render(React.createElement(App, { initialTransforms: newTransforms, initialShape: window.currentShape, initialShowOriginal: window.currentShowOriginal }));
});