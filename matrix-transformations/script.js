const canvas = document.getElementById('transformCanvas');
const ctx = canvas.getContext('2d');

const centerX = canvas.width / 2;
const centerY = canvas.height / 2;
const scale = 1;

const showGridCheck = document.getElementById('showGrid');

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

function updateMatrixDisplay(matrix, element) {
    const formatted = matrix.map(row =>
        `[${row.map(val => val.toFixed(2)).join(', ')}]`
    ).join('<br>');
    if (element) element.innerHTML = formatted;
}

function draw(transforms, shape, showOriginal) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawGrid();

    const currentShape = shapes[shape];
    const matrix = getCombinedMatrix(transforms);
    const transformedShape = transformPoints(matrix, currentShape);

    // Draw original shape if checked
    if (showOriginal) {
        drawShape(currentShape, 'rgba(255, 0, 0, 0.5)', true);
    }

    // Draw transformed shape
    drawShape(transformedShape, 'blue', false);

    return matrix;
}

function getCombinedMatrix(transforms) {
    let matrix = createIdentityMatrix();

    for (let transform of transforms) {
        let transformMatrix;
        if (transform.type === 'scale') {
            transformMatrix = createScalingMatrix(transform.scaleX, transform.scaleY);
        } else if (transform.type === 'shear') {
            transformMatrix = createShearMatrix(transform.shearX, transform.shearY);
        } else if (transform.type === 'rotate') {
            transformMatrix = createRotationMatrix(transform.angle);
        } else if (transform.type === 'translate') {
            transformMatrix = createTranslationMatrix(transform.translateX, transform.translateY);
        }
        matrix = multiplyMatrices(transformMatrix, matrix);
    }

    return matrix;
}

// React Components
function TransformBlock({ transform, index, onUpdate, onMoveUp, onMoveDown, onDelete }) {
    const handleChange = (field, value) => {
        onUpdate(index, { ...transform, [field]: parseFloat(value) });
    };

    const renderControls = () => {
        if (transform.type === 'rotate') {
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
                })
            );
        } else if (transform.type === 'translate') {
            return React.createElement('div', null,
                React.createElement('label', null, 'Translate X: ',
                    React.createElement('input', {
                        type: 'number',
                        min: -100,
                        max: 100,
                        value: transform.translateX,
                        step: 5,
                        onChange: (e) => handleChange('translateX', e.target.value)
                    }),
                    ' ',
                    React.createElement('span', null, transform.translateX)
                ),
                React.createElement('input', {
                    type: 'range',
                    min: -100,
                    max: 100,
                    value: transform.translateX,
                    onChange: (e) => handleChange('translateX', e.target.value)
                }),
                React.createElement('label', null, 'Translate Y: ',
                    React.createElement('input', {
                        type: 'number',
                        min: -100,
                        max: 100,
                        value: transform.translateY,
                        step: 5,
                        onChange: (e) => handleChange('translateY', e.target.value)
                    }),
                    ' ',
                    React.createElement('span', null, transform.translateY)
                ),
                React.createElement('input', {
                    type: 'range',
                    min: -100,
                    max: 100,
                    value: transform.translateY,
                    onChange: (e) => handleChange('translateY', e.target.value)
                })
            );
        } else if (transform.type === 'shear') {
            return React.createElement('div', null,
                React.createElement('label', null, 'Shear X: ',
                    React.createElement('input', {
                        type: 'number',
                        min: -1,
                        max: 1,
                        value: transform.shearX,
                        step: 0.1,
                        onChange: (e) => handleChange('shearX', e.target.value)
                    }),
                    ' ',
                    React.createElement('span', null, transform.shearX)
                ),
                React.createElement('input', {
                    type: 'range',
                    min: -1,
                    max: 1,
                    value: transform.shearX,
                    step: 0.1,
                    onChange: (e) => handleChange('shearX', e.target.value)
                }),
                React.createElement('label', null, 'Shear Y: ',
                    React.createElement('input', {
                        type: 'number',
                        min: -1,
                        max: 1,
                        value: transform.shearY,
                        step: 0.1,
                        onChange: (e) => handleChange('shearY', e.target.value)
                    }),
                    ' ',
                    React.createElement('span', null, transform.shearY)
                ),
                React.createElement('input', {
                    type: 'range',
                    min: -1,
                    max: 1,
                    value: transform.shearY,
                    step: 0.1,
                    onChange: (e) => handleChange('shearY', e.target.value)
                })
            );
        }
    };

    return React.createElement('div', { className: 'control-group' },
        React.createElement('h3', null,
            transform.type.charAt(0).toUpperCase() + transform.type.slice(1),
            React.createElement('button', { onClick: () => onMoveUp(index) }, '↑'),
            React.createElement('button', { onClick: () => onMoveDown(index) }, '↓'),
            React.createElement('button', { onClick: () => onDelete(index) }, 'X')
        ),
        renderControls()
    );
}

function App({ initialTransforms, initialShape, initialShowOriginal }) {
    const [transforms, setTransforms] = React.useState(initialTransforms || [
        { type: 'scale', scaleX: 1, scaleY: 1 },
        { type: 'shear', shearX: 0, shearY: 0 },
        { type: 'rotate', angle: 0 },
        { type: 'translate', translateX: 0, translateY: 0 }
    ]);
    const [shape, setShape] = React.useState(initialShape || 'square');
    const [showOriginal, setShowOriginal] = React.useState(initialShowOriginal || false);
    const matrixDisplayRef = React.useRef();

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
        if (type === 'scale') {
            newTransform = { type: 'scale', scaleX: 1, scaleY: 1 };
        } else if (type === 'shear') {
            newTransform = { type: 'shear', shearX: 0, shearY: 0 };
        } else if (type === 'rotate') {
            newTransform = { type: 'rotate', angle: 0 };
        } else if (type === 'translate') {
            newTransform = { type: 'translate', translateX: 0, translateY: 0 };
        }
        setTransforms([...transforms, newTransform]);
    };

    React.useEffect(() => {
        const matrix = draw(transforms, shape, showOriginal);
        updateMatrixDisplay(matrix, matrixDisplayRef.current);
        window.currentTransforms = transforms;
        window.currentShape = shape;
        window.currentShowOriginal = showOriginal;
    }, [transforms, shape, showOriginal]);

    return React.createElement('div', { className: 'controls' },
        React.createElement('div', { className: 'transform-controls' },
            React.createElement('h2', null, 'Transformation Matrix'),
            React.createElement('div', { className: 'matrix-display' },
                React.createElement('div', { ref: matrixDisplayRef, id: 'matrixDisplay' },
                    '[1, 0, 0]<br>[0, 1, 0]<br>[0, 0, 1]'
                )
            )
        ),
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
        React.createElement('div', { className: 'shape-selector' },
            React.createElement('h2', null, 'Shape'),
            React.createElement('select', {
                value: shape,
                onChange: (e) => setShape(e.target.value)
            },
                React.createElement('option', { value: 'square' }, 'Square'),
                React.createElement('option', { value: 'triangle' }, 'Triangle'),
                React.createElement('option', { value: 'circle' }, 'Circle'),
                React.createElement('option', { value: 'arrow' }, 'Arrow')
            )
        ),
        React.createElement('div', { className: 'add-transform' },
            React.createElement('select', { id: 'addTransformSelect' },
                React.createElement('option', { value: 'scale' }, 'Scale'),
                React.createElement('option', { value: 'shear' }, 'Shear'),
                React.createElement('option', { value: 'rotate' }, 'Rotate'),
                React.createElement('option', { value: 'translate' }, 'Translate')
            ),
            React.createElement('button', { id: 'addTransformBtn', onClick: () => addTransform(document.getElementById('addTransformSelect').value) }, 'Add Transform')
        )
    );
}

// Render React app
const root = ReactDOM.createRoot(document.getElementById('react-root'));
root.render(React.createElement(App));

// Event listeners for non-React elements
showGridCheck.addEventListener('change', () => {
    const matrix = draw(window.currentTransforms || [], window.currentShape || 'square', window.currentShowOriginal || false);
    updateMatrixDisplay(matrix, document.getElementById('matrixDisplay'));
});

// Preset buttons
identityBtn.addEventListener('click', () => {
    const newTransforms = [
        { type: 'scale', scaleX: 1, scaleY: 1 },
        { type: 'shear', shearX: 0, shearY: 0 },
        { type: 'rotate', angle: 0 },
        { type: 'translate', translateX: 0, translateY: 0 }
    ];
    root.render(React.createElement(App, { initialTransforms: newTransforms, initialShape: window.currentShape, initialShowOriginal: window.currentShowOriginal }));
});

rotate45Btn.addEventListener('click', () => {
    const newTransforms = [
        { type: 'scale', scaleX: 1, scaleY: 1 },
        { type: 'shear', shearX: 0, shearY: 0 },
        { type: 'rotate', angle: 45 },
        { type: 'translate', translateX: 0, translateY: 0 }
    ];
    root.render(React.createElement(App, { initialTransforms: newTransforms, initialShape: window.currentShape, initialShowOriginal: window.currentShowOriginal }));
});

scale2xBtn.addEventListener('click', () => {
    const newTransforms = [
        { type: 'scale', scaleX: 2, scaleY: 2 },
        { type: 'shear', shearX: 0, shearY: 0 },
        { type: 'rotate', angle: 0 },
        { type: 'translate', translateX: 0, translateY: 0 }
    ];
    root.render(React.createElement(App, { initialTransforms: newTransforms, initialShape: window.currentShape, initialShowOriginal: window.currentShowOriginal }));
});

translate50Btn.addEventListener('click', () => {
    const newTransforms = [
        { type: 'scale', scaleX: 1, scaleY: 1 },
        { type: 'shear', shearX: 0, shearY: 0 },
        { type: 'rotate', angle: 0 },
        { type: 'translate', translateX: 50, translateY: 30 }
    ];
    root.render(React.createElement(App, { initialTransforms: newTransforms, initialShape: window.currentShape, initialShowOriginal: window.currentShowOriginal }));
});

shearBtn.addEventListener('click', () => {
    const newTransforms = [
        { type: 'scale', scaleX: 1, scaleY: 1 },
        { type: 'shear', shearX: 0.5, shearY: 0.3 },
        { type: 'rotate', angle: 0 },
        { type: 'translate', translateX: 0, translateY: 0 }
    ];
    root.render(React.createElement(App, { initialTransforms: newTransforms, initialShape: window.currentShape, initialShowOriginal: window.currentShowOriginal }));
});

reflectXBtn.addEventListener('click', () => {
    const newTransforms = [
        { type: 'scale', scaleX: 1, scaleY: -1 },
        { type: 'shear', shearX: 0, shearY: 0 },
        { type: 'rotate', angle: 0 },
        { type: 'translate', translateX: 0, translateY: 0 }
    ];
    root.render(React.createElement(App, { initialTransforms: newTransforms, initialShape: window.currentShape, initialShowOriginal: window.currentShowOriginal }));
});

complexBtn.addEventListener('click', () => {
    const newTransforms = [
        { type: 'scale', scaleX: 1.5, scaleY: 0.8 },
        { type: 'shear', shearX: 0.2, shearY: -0.1 },
        { type: 'rotate', angle: 30 },
        { type: 'translate', translateX: 20, translateY: -15 }
    ];
    root.render(React.createElement(App, { initialTransforms: newTransforms, initialShape: window.currentShape, initialShowOriginal: window.currentShowOriginal }));
});

// Initial draw handled by React useEffect