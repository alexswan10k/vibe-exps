// Data Structures Explorer - Enhanced React Version
const { useState, useEffect, useRef, useCallback, useMemo } = React;

function App() {
    const [structureType, setStructureType] = useState('linked-list');
    const [currentStructure, setCurrentStructure] = useState(null);
    const [operationHistory, setOperationHistory] = useState([]);
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [animating, setAnimating] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [currentOperation, setCurrentOperation] = useState(null);
    const canvasRef = useRef(null);
    const animationFrameRef = useRef(null);

    // Initialize structure with error handling
    useEffect(() => {
        try {
            initializeStructure(structureType);
            setStatusMessage(`Initialized ${getStructureName(structureType)}`);
        } catch (error) {
            setStatusMessage(`Error initializing: ${error.message}`);
        }
    }, [structureType]);

    // Continuous drawing loop for animations
    useEffect(() => {
        const animate = () => {
            draw();
            animationFrameRef.current = requestAnimationFrame(animate);
        };
        animate();
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [currentStructure, selectedNodes, animating]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                undo();
            } else if (e.key === 'Delete' && selectedNodes.length > 0) {
                executeOperation('delete', { value: selectedNodes[0] });
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [selectedNodes, operationHistory]);

    const initializeStructure = (type) => {
        let structure;
        switch(type) {
            case 'linked-list':
                structure = new EnhancedLinkedList();
                break;
            case 'binary-tree':
                structure = new EnhancedBinaryTree();
                break;
            case 'graph':
                structure = new EnhancedGraph();
                break;
            case 'hash-table':
                structure = new EnhancedHashTable();
                break;
            default:
                throw new Error('Unknown structure type');
        }
        setCurrentStructure(structure);
        setSelectedNodes([]);
        setOperationHistory([]);
    };

    const executeOperation = useCallback(async (operation, params) => {
        if (!currentStructure || animating) return;

        setAnimating(true);
        setCurrentOperation(operation);

        try {
            let result;
            switch(operation) {
                case 'insert':
                    result = await currentStructure.insert(params.value);
                    setStatusMessage(`Inserted: ${params.value}`);
                    break;
                case 'delete':
                    result = await currentStructure.delete(params.value);
                    setStatusMessage(result ? `Deleted: ${params.value}` : `Not found: ${params.value}`);
                    break;
                case 'search':
                    result = await currentStructure.search(params.value);
                    setStatusMessage(result ? `✓ Found: ${params.value}` : `✗ Not found: ${params.value}`);
                    break;
                case 'traverse':
                    const traversal = currentStructure.traverse();
                    setStatusMessage(`Traversal: ${traversal.join(' → ')}`);
                    break;
                case 'add-edge':
                    if (structureType === 'graph' && params.from && params.to) {
                        currentStructure.addEdge(params.from, params.to);
                        setStatusMessage(`Added edge: ${params.from} → ${params.to}`);
                    }
                    break;
                case 'remove-edge':
                    if (structureType === 'graph' && params.from && params.to) {
                        currentStructure.removeEdge(params.from, params.to);
                        setStatusMessage(`Removed edge: ${params.from} → ${params.to}`);
                    }
                    break;
            }

            // Add to history for undo functionality
            setOperationHistory(prev => [...prev, { operation, params, timestamp: Date.now() }]);
        } catch (error) {
            setStatusMessage(`Error: ${error.message}`);
        } finally {
            setTimeout(() => {
                setAnimating(false);
                setCurrentOperation(null);
            }, 300);
        }
    }, [currentStructure, animating, structureType]);

    const undo = () => {
        if (operationHistory.length === 0) return;
        setOperationHistory(prev => prev.slice(0, -1));
        initializeStructure(structureType);
        // Replay all operations except the last one
        operationHistory.slice(0, -1).forEach(({ operation, params }) => {
            currentStructure[operation](params.value || params);
        });
    };

    const clearStructure = () => {
        initializeStructure(structureType);
        setStatusMessage('Structure cleared');
    };

    const exportData = () => {
        const data = currentStructure.toJSON();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${structureType}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setStatusMessage('Exported data');
    };

    const draw = () => {
        if (!canvasRef.current || !currentStructure) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        // High DPI support
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, rect.width, rect.height);

        // Draw grid for better visual reference
        drawGrid(ctx, rect.width, rect.height);

        if (currentStructure.draw) {
            currentStructure.draw(ctx, rect.width, rect.height, selectedNodes);
        }
    };

    const drawGrid = (ctx, width, height) => {
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 0.5;
        const gridSize = 50;
        
        for (let x = 0; x < width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y < height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    };

    const handleCanvasClick = (event) => {
        if (animating) return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        if (structureType === 'graph') {
            for (let [value, node] of currentStructure.nodes) {
                const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
                if (distance < 25) {
                    setSelectedNodes(prev => {
                        if (prev.includes(value)) {
                            return prev.filter(v => v !== value);
                        } else if (prev.length < 2) {
                            return [...prev, value];
                        } else {
                            return [prev[1], value];
                        }
                    });
                    return;
                }
            }
        }
    };

    const getStructureName = (type) => {
        const names = {
            'linked-list': 'Linked List',
            'binary-tree': 'Binary Search Tree',
            'graph': 'Graph',
            'hash-table': 'Hash Table'
        };
        return names[type] || type;
    };

    const getComplexity = (type, operation) => {
        const complexities = {
            'linked-list': {
                insert: 'O(n)', delete: 'O(n)', search: 'O(n)', space: 'O(n)'
            },
            'binary-tree': {
                insert: 'O(log n)', delete: 'O(log n)', search: 'O(log n)', space: 'O(n)'
            },
            'graph': {
                insert: 'O(1)', delete: 'O(V+E)', search: 'O(1)', space: 'O(V+E)'
            },
            'hash-table': {
                insert: 'O(1)', delete: 'O(1)', search: 'O(1)', space: 'O(n)'
            }
        };
        return complexities[type] || { insert: 'O(1)', delete: 'O(1)', search: 'O(1)', space: 'O(n)' };
    };

    const complexity = getComplexity(structureType, currentOperation);

    return React.createElement('div', { className: 'container' },
        React.createElement('header', { className: 'app-header' },
            React.createElement('h1', null, '🔍 Data Structures Explorer'),
            React.createElement('div', { className: 'status-bar' },
                statusMessage && React.createElement('span', { className: 'status-message' }, statusMessage)
            )
        ),
        React.createElement(Controls, {
            structureType: structureType,
            selectedNodes: selectedNodes,
            animating: animating,
            onStructureChange: setStructureType,
            onOperation: executeOperation,
            onClear: clearStructure,
            onExport: exportData,
            onUndo: undo,
            canUndo: operationHistory.length > 0
        }),
        React.createElement('div', { className: 'visualization-area' },
            React.createElement('canvas', {
                ref: canvasRef,
                className: 'main-canvas',
                onClick: handleCanvasClick,
                style: { width: '100%', height: '600px', cursor: animating ? 'wait' : 'pointer' }
            }),
            structureType === 'graph' && React.createElement('div', { className: 'graph-instructions' },
                '💡 Click nodes to select them for edge operations. Use force-directed layout for better visualization.'
            )
        ),
        React.createElement(InfoPanel, {
            operationCount: operationHistory.length,
            structureSize: currentStructure ? currentStructure.size() : 0,
            structureType: structureType,
            complexity: complexity,
            currentOperation: currentOperation
        })
    );
}

function Controls({ structureType, selectedNodes, animating, onStructureChange, onOperation, onClear, onExport, onUndo, canUndo }) {
    const [operation, setOperation] = useState('insert');
    const [value, setValue] = useState('');

    const operations = useMemo(() => {
        const baseOps = [
            { value: 'insert', label: '➕ Insert', icon: '➕' },
            { value: 'delete', label: '➖ Delete', icon: '➖' },
            { value: 'search', label: '🔍 Search', icon: '🔍' },
            { value: 'traverse', label: '🔄 Traverse', icon: '🔄' }
        ];

        if (structureType === 'graph') {
            return [
                ...baseOps,
                { value: 'add-edge', label: '🔗 Add Edge', icon: '🔗' },
                { value: 'remove-edge', label: '✂️ Remove Edge', icon: '✂️' }
            ];
        }

        return baseOps;
    }, [structureType]);

    const handleExecute = (e) => {
        e.preventDefault();
        if (animating) return;

        if (operation === 'add-edge' || operation === 'remove-edge') {
            if (selectedNodes.length === 2) {
                onOperation(operation, { from: selectedNodes[0], to: selectedNodes[1] });
            } else {
                alert('Please select exactly 2 nodes for edge operations');
            }
        } else if (operation === 'traverse') {
            onOperation(operation, {});
        } else if (value.trim()) {
            onOperation(operation, { value: value.trim() });
            setValue('');
        } else {
            alert('Please enter a value');
        }
    };

    const handleRandomFill = () => {
        const values = Array.from({ length: 8 }, () => Math.floor(Math.random() * 100));
        values.forEach(v => onOperation('insert', { value: v.toString() }));
    };

    return React.createElement('div', { className: 'controls' },
        React.createElement('form', { onSubmit: handleExecute, className: 'controls-form' },
            React.createElement('div', { className: 'control-row' },
                React.createElement('div', { className: 'control-group' },
                    React.createElement('label', null, 'Data Structure:'),
                    React.createElement('select', {
                        value: structureType,
                        onChange: (e) => onStructureChange(e.target.value),
                        disabled: animating
                    },
                        React.createElement('option', { value: 'linked-list' }, '📋 Linked List'),
                        React.createElement('option', { value: 'binary-tree' }, '🌳 Binary Search Tree'),
                        React.createElement('option', { value: 'graph' }, '🕸️ Graph'),
                        React.createElement('option', { value: 'hash-table' }, '🗂️ Hash Table')
                    )
                ),
                React.createElement('div', { className: 'control-group' },
                    React.createElement('label', null, 'Operation:'),
                    React.createElement('select', {
                        value: operation,
                        onChange: (e) => setOperation(e.target.value),
                        disabled: animating
                    }, ...operations.map(op =>
                        React.createElement('option', { key: op.value, value: op.value }, op.label)
                    ))
                )
            ),
            (operation !== 'add-edge' && operation !== 'remove-edge' && operation !== 'traverse') &&
                React.createElement('div', { className: 'control-row' },
                    React.createElement('div', { className: 'control-group full-width' },
                        React.createElement('label', null, 'Value:'),
                        React.createElement('input', {
                            type: 'text',
                            value: value,
                            onChange: (e) => setValue(e.target.value),
                            placeholder: 'Enter value (e.g., 42)',
                            disabled: animating,
                            autoFocus: true
                        })
                    )
                ),
            (operation === 'add-edge' || operation === 'remove-edge') &&
                React.createElement('div', { className: 'control-row' },
                    React.createElement('div', { className: 'selected-nodes-display' },
                        React.createElement('label', null, 'Selected Nodes:'),
                        React.createElement('div', { className: 'selected-nodes' },
                            selectedNodes.length > 0 ? 
                                selectedNodes.map((n, i) => 
                                    React.createElement('span', { key: i, className: 'node-badge' }, n)
                                ) : 
                                React.createElement('span', { className: 'empty-state' }, 'No nodes selected')
                        )
                    )
                ),
            React.createElement('div', { className: 'button-group' },
                React.createElement('button', { 
                    type: 'submit',
                    className: 'btn btn-primary',
                    disabled: animating 
                }, animating ? '⏳ Processing...' : '▶️ Execute'),
                React.createElement('button', { 
                    type: 'button',
                    className: 'btn btn-secondary',
                    onClick: handleRandomFill,
                    disabled: animating 
                }, '🎲 Random Fill'),
                React.createElement('button', { 
                    type: 'button',
                    className: 'btn btn-secondary',
                    onClick: onUndo,
                    disabled: !canUndo || animating 
                }, '↩️ Undo'),
                React.createElement('button', { 
                    type: 'button',
                    className: 'btn btn-secondary',
                    onClick: onExport,
                    disabled: animating 
                }, '💾 Export'),
                React.createElement('button', { 
                    type: 'button',
                    className: 'btn btn-danger',
                    onClick: onClear,
                    disabled: animating 
                }, '🗑️ Clear')
            )
        )
    );
}

function InfoPanel({ operationCount, structureSize, structureType, complexity, currentOperation }) {
    const getStructureName = (type) => {
        const names = {
            'linked-list': 'Linked List',
            'binary-tree': 'Binary Search Tree',
            'graph': 'Graph',
            'hash-table': 'Hash Table'
        };
        return names[type] || type;
    };

    const currentComplexity = currentOperation ? complexity[currentOperation] : complexity.insert;

    return React.createElement('div', { className: 'info-panel' },
        React.createElement('div', { className: 'info-section' },
            React.createElement('h3', null, '📊 Metrics'),
            React.createElement('div', { className: 'metrics-grid' },
                React.createElement('div', { className: 'metric-card' },
                    React.createElement('div', { className: 'metric-label' }, 'Operations'),
                    React.createElement('div', { className: 'metric-value' }, operationCount)
                ),
                React.createElement('div', { className: 'metric-card' },
                    React.createElement('div', { className: 'metric-label' }, 'Size'),
                    React.createElement('div', { className: 'metric-value' }, structureSize)
                ),
                React.createElement('div', { className: 'metric-card' },
                    React.createElement('div', { className: 'metric-label' }, 'Time Complexity'),
                    React.createElement('div', { className: 'metric-value complexity' }, currentComplexity)
                ),
                React.createElement('div', { className: 'metric-card' },
                    React.createElement('div', { className: 'metric-label' }, 'Space Complexity'),
                    React.createElement('div', { className: 'metric-value complexity' }, complexity.space)
                )
            )
        ),
        React.createElement('div', { className: 'info-section' },
            React.createElement('h3', null, 'ℹ️ Structure Info'),
            React.createElement('p', null, React.createElement('strong', null, 'Type: '), getStructureName(structureType)),
            React.createElement('p', null, React.createElement('strong', null, 'Operations: '),
                'Insert: ', complexity.insert, ', ',
                'Delete: ', complexity.delete, ', ',
                'Search: ', complexity.search
            )
        )
    );
}

// Enhanced Data Structure Implementations

class EnhancedLinkedList {
    constructor() {
        this.head = null;
        this.length = 0;
    }

    async insert(value) {
        const newNode = new ListNode(value);
        newNode.animating = true;
        
        if (!this.head) {
            this.head = newNode;
        } else {
            let current = this.head;
            while (current.next) {
                current = current.next;
            }
            current.next = newNode;
        }
        this.length++;
        
        await new Promise(resolve => setTimeout(resolve, 300));
        newNode.animating = false;
        return true;
    }

    async delete(value) {
        if (!this.head) return false;

        if (this.head.value === value) {
            this.head.animating = true;
            await new Promise(resolve => setTimeout(resolve, 300));
            this.head = this.head.next;
            this.length--;
            return true;
        }

        let current = this.head;
        while (current.next && current.next.value !== value) {
            current = current.next;
        }

        if (current.next) {
            current.next.animating = true;
            await new Promise(resolve => setTimeout(resolve, 300));
            current.next = current.next.next;
            this.length--;
            return true;
        }
        return false;
    }

    async search(value) {
        let current = this.head;
        while (current) {
            current.highlighted = true;
            await new Promise(resolve => setTimeout(resolve, 100));
            if (current.value === value) {
                current.highlighted = false;
                return true;
            }
            current.highlighted = false;
            current = current.next;
        }
        return false;
    }

    traverse() {
        const result = [];
        let current = this.head;
        while (current) {
            result.push(current.value);
            current = current.next;
        }
        return result;
    }

    size() {
        return this.length;
    }

    toJSON() {
        return { type: 'linked-list', data: this.traverse() };
    }

    draw(ctx, width, height) {
        if (!this.head) {
            ctx.fillStyle = '#666';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Empty list - add some nodes!', width / 2, height / 2);
            return;
        }

        const nodeRadius = 30;
        const spacing = 100;
        const startX = 60;
        const centerY = height / 2;
        let x = startX;
        let current = this.head;
        let index = 0;

        while (current) {
            // Calculate position with wrapping
            if (x > width - 60) {
                x = startX;
                // You could add vertical offset here for multi-row layout
            }

            // Draw node with animation
            const scale = current.animating ? 1.2 : (current.highlighted ? 1.1 : 1);
            const radius = nodeRadius * scale;

            ctx.save();
            ctx.translate(x, centerY);
            
            // Shadow
            ctx.shadowColor = 'rgba(0,0,0,0.2)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 5;

            // Node circle
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, 2 * Math.PI);
            
            if (current.highlighted) {
                ctx.fillStyle = '#f39c12';
            } else if (current.animating) {
                ctx.fillStyle = '#e74c3c';
            } else {
                ctx.fillStyle = '#3498db';
            }
            ctx.fill();
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Value text
            ctx.shadowColor = 'transparent';
            ctx.fillStyle = 'white';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(current.value, 0, 0);

            // Index label
            ctx.fillStyle = '#7f8c8d';
            ctx.font = '12px Arial';
            ctx.fillText(`[${index}]`, 0, radius + 20);

            ctx.restore();

            // Draw arrow to next node
            if (current.next) {
                const arrowStartX = x + radius;
                const arrowEndX = x + spacing - radius;
                
                ctx.beginPath();
                ctx.moveTo(arrowStartX, centerY);
                ctx.lineTo(arrowEndX, centerY);
                ctx.strokeStyle = '#34495e';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Arrow head
                ctx.beginPath();
                ctx.moveTo(arrowEndX - 10, centerY - 6);
                ctx.lineTo(arrowEndX, centerY);
                ctx.lineTo(arrowEndX - 10, centerY + 6);
                ctx.fillStyle = '#34495e';
                ctx.fill();
            } else {
                // NULL indicator
                ctx.fillStyle = '#95a5a6';
                ctx.font = '14px Arial';
                ctx.fillText('NULL', x + radius + 30, centerY);
            }

            x += spacing;
            current = current.next;
            index++;
        }
    }
}

class ListNode {
    constructor(value) {
        this.value = value;
        this.next = null;
        this.animating = false;
        this.highlighted = false;
    }
}

class EnhancedBinaryTree {
    constructor() {
        this.root = null;
        this.nodeCount = 0;
    }

    async insert(value) {
        const newNode = new TreeNode(value);
        newNode.animating = true;
        
        if (!this.root) {
            this.root = newNode;
        } else {
            await this.insertNode(this.root, newNode);
        }
        this.nodeCount++;
        
        await new Promise(resolve => setTimeout(resolve, 300));
        newNode.animating = false;
        return true;
    }

    async insertNode(node, newNode) {
        node.highlighted = true;
        await new Promise(resolve => setTimeout(resolve, 100));
        node.highlighted = false;

        if (newNode.value < node.value) {
            if (!node.left) {
                node.left = newNode;
            } else {
                await this.insertNode(node.left, newNode);
            }
        } else {
            if (!node.right) {
                node.right = newNode;
            } else {
                await this.insertNode(node.right, newNode);
            }
        }
    }

    async delete(value) {
        const result = await this.deleteNode(this.root, value, null, null);
        this.root = result.root;
        return result.deleted;
    }

    async deleteNode(node, value, parent, direction) {
        if (!node) return { root: null, deleted: false };

        node.highlighted = true;
        await new Promise(resolve => setTimeout(resolve, 100));
        node.highlighted = false;

        if (value < node.value) {
            const result = await this.deleteNode(node.left, value, node, 'left');
            node.left = result.root;
            return { root: node, deleted: result.deleted };
        } else if (value > node.value) {
            const result = await this.deleteNode(node.right, value, node, 'right');
            node.right = result.root;
            return { root: node, deleted: result.deleted };
        } else {
            node.animating = true;
            await new Promise(resolve => setTimeout(resolve, 300));

            if (!node.left && !node.right) {
                this.nodeCount--;
                return { root: null, deleted: true };
            } else if (!node.left) {
                this.nodeCount--;
                return { root: node.right, deleted: true };
            } else if (!node.right) {
                this.nodeCount--;
                return { root: node.left, deleted: true };
            }

            const minNode = this.findMinNode(node.right);
            node.value = minNode.value;
            const result = await this.deleteNode(node.right, minNode.value, node, 'right');
            node.right = result.root;
            return { root: node, deleted: true };
        }
    }

    findMinNode(node) {
        while (node.left) {
            node = node.left;
        }
        return node;
    }

    async search(value) {
        return await this.searchNode(this.root, value);
    }

    async searchNode(node, value) {
        if (!node) return false;
        
        node.highlighted = true;
        await new Promise(resolve => setTimeout(resolve, 150));
        
        if (value === node.value) {
            node.highlighted = false;
            return true;
        }
        
        node.highlighted = false;
        return value < node.value ?
            await this.searchNode(node.left, value) :
            await this.searchNode(node.right, value);
    }

    traverse() {
        const result = [];
        this.inOrderTraversal(this.root, result);
        return result;
    }

    inOrderTraversal(node, result) {
        if (node) {
            this.inOrderTraversal(node.left, result);
            result.push(node.value);
            this.inOrderTraversal(node.right, result);
        }
    }

    size() {
        return this.nodeCount;
    }

    toJSON() {
        return { type: 'binary-tree', data: this.traverse() };
    }

    draw(ctx, width, height) {
        if (!this.root) {
            ctx.fillStyle = '#666';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Empty tree - add some nodes!', width / 2, height / 2);
            return;
        }

        const levelHeight = 90;
        const nodeRadius = 28;

        this.drawNode(ctx, this.root, width / 2, 50, width / 4, levelHeight, nodeRadius);
    }

    drawNode(ctx, node, x, y, xOffset, levelHeight, radius) {
        if (!node) return;

        // Draw connections first (so they appear behind nodes)
        if (node.left) {
            const leftX = x - xOffset;
            const leftY = y + levelHeight;
            
            ctx.beginPath();
            ctx.moveTo(x, y + radius);
            ctx.lineTo(leftX, leftY - radius);
            ctx.strokeStyle = '#34495e';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            this.drawNode(ctx, node.left, leftX, leftY, xOffset / 2, levelHeight, radius);
        }

        if (node.right) {
            const rightX = x + xOffset;
            const rightY = y + levelHeight;
            
            ctx.beginPath();
            ctx.moveTo(x, y + radius);
            ctx.lineTo(rightX, rightY - radius);
            ctx.strokeStyle = '#34495e';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            this.drawNode(ctx, node.right, rightX, rightY, xOffset / 2, levelHeight, radius);
        }

        // Draw node
        const scale = node.animating ? 1.2 : (node.highlighted ? 1.1 : 1);
        const adjustedRadius = radius * scale;

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 5;

        ctx.beginPath();
        ctx.arc(x, y, adjustedRadius, 0, 2 * Math.PI);
        
        if (node.highlighted) {
            ctx.fillStyle = '#f39c12';
        } else if (node.animating) {
            ctx.fillStyle = '#e74c3c';
        } else {
            ctx.fillStyle = '#e74c3c';
        }
        ctx.fill();
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.shadowColor = 'transparent';
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.value, x, y);

        ctx.restore();
    }
}

class TreeNode {
    constructor(value) {
        this.value = value;
        this.left = null;
        this.right = null;
        this.animating = false;
        this.highlighted = false;
    }
}

class EnhancedGraph {
    constructor() {
        this.nodes = new Map();
        this.edges = new Set();
        this.forces = new Map();
    }

    async insert(value) {
        if (!this.nodes.has(value)) {
            this.nodes.set(value, {
                x: Math.random() * 600 + 100,
                y: Math.random() * 400 + 100,
                vx: 0,
                vy: 0,
                animating: true
            });
            
            await new Promise(resolve => setTimeout(resolve, 300));
            this.nodes.get(value).animating = false;
            return true;
        }
        return false;
    }

    async delete(value) {
        if (!this.nodes.has(value)) return false;
        
        const node = this.nodes.get(value);
        node.animating = true;
        await new Promise(resolve => setTimeout(resolve, 300));
        
        this.nodes.delete(value);
        this.edges = new Set([...this.edges].filter(e => e.from !== value && e.to !== value));
        return true;
    }

    addEdge(from, to) {
        if (this.nodes.has(from) && this.nodes.has(to)) {
            this.edges.add({ from, to });
        }
    }

    removeEdge(from, to) {
        this.edges = new Set([...this.edges].filter(e => 
            !(e.from === from && e.to === to) && !(e.from === to && e.to === from)
        ));
    }

    async search(value) {
        if (this.nodes.has(value)) {
            const node = this.nodes.get(value);
            node.highlighted = true;
            await new Promise(resolve => setTimeout(resolve, 500));
            node.highlighted = false;
            return true;
        }
        return false;
    }

    traverse() {
        return Array.from(this.nodes.keys());
    }

    size() {
        return this.nodes.size;
    }

    toJSON() {
        return {
            type: 'graph',
            nodes: Array.from(this.nodes.keys()),
            edges: Array.from(this.edges)
        };
    }

    // Force-directed layout algorithm
    updateForces(width, height) {
        const nodes = Array.from(this.nodes.entries());
        const repulsion = 5000;
        const attraction = 0.01;
        const damping = 0.85;

        // Apply repulsive forces between all nodes
        for (let i = 0; i < nodes.length; i++) {
            const [id1, node1] = nodes[i];
            let fx = 0, fy = 0;

            for (let j = 0; j < nodes.length; j++) {
                if (i === j) continue;
                const [id2, node2] = nodes[j];
                
                const dx = node1.x - node2.x;
                const dy = node1.y - node2.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                
                const force = repulsion / (dist * dist);
                fx += (dx / dist) * force;
                fy += (dy / dist) * force;
            }

            // Apply attractive forces along edges
            for (let edge of this.edges) {
                let connected = null;
                if (edge.from === id1 && this.nodes.has(edge.to)) {
                    connected = this.nodes.get(edge.to);
                } else if (edge.to === id1 && this.nodes.has(edge.from)) {
                    connected = this.nodes.get(edge.from);
                }

                if (connected) {
                    const dx = connected.x - node1.x;
                    const dy = connected.y - node1.y;
                    fx += dx * attraction;
                    fy += dy * attraction;
                }
            }

            // Center attraction
            const centerX = width / 2;
            const centerY = height / 2;
            fx += (centerX - node1.x) * 0.001;
            fy += (centerY - node1.y) * 0.001;

            node1.vx = (node1.vx + fx) * damping;
            node1.vy = (node1.vy + fy) * damping;
        }

        // Update positions
        for (let [id, node] of nodes) {
            node.x += node.vx;
            node.y += node.vy;

            // Boundary constraints
            node.x = Math.max(50, Math.min(width - 50, node.x));
            node.y = Math.max(50, Math.min(height - 50, node.y));
        }
    }

    draw(ctx, width, height, selectedNodes = []) {
        if (this.nodes.size === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Empty graph - add some nodes!', width / 2, height / 2);
            return;
        }

        // Update layout
        this.updateForces(width, height);

        // Draw edges with improved styling
        ctx.lineWidth = 2;
        for (let edge of this.edges) {
            const fromNode = this.nodes.get(edge.from);
            const toNode = this.nodes.get(edge.to);
            if (fromNode && toNode) {
                const gradient = ctx.createLinearGradient(
                    fromNode.x, fromNode.y,
                    toNode.x, toNode.y
                );
                gradient.addColorStop(0, '#3498db');
                gradient.addColorStop(1, '#2ecc71');
                
                ctx.strokeStyle = gradient;
                ctx.beginPath();
                ctx.moveTo(fromNode.x, fromNode.y);
                ctx.lineTo(toNode.x, toNode.y);
                ctx.stroke();

                // Draw arrow
                const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
                const arrowSize = 15;
                const midX = (fromNode.x + toNode.x) / 2;
                const midY = (fromNode.y + toNode.y) / 2;

                ctx.save();
                ctx.translate(midX, midY);
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(-arrowSize, -arrowSize / 2);
                ctx.lineTo(-arrowSize, arrowSize / 2);
                ctx.closePath();
                ctx.fillStyle = '#34495e';
                ctx.fill();
                ctx.restore();
            }
        }

        // Draw nodes with improved styling
        for (let [value, node] of this.nodes) {
            const isSelected = selectedNodes.includes(value);
            const scale = node.animating ? 1.2 : (node.highlighted ? 1.1 : 1);
            const radius = 28 * scale;

            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.2)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 5;

            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
            
            if (node.highlighted) {
                ctx.fillStyle = '#f39c12';
            } else if (isSelected) {
                ctx.fillStyle = '#e74c3c';
            } else if (node.animating) {
                ctx.fillStyle = '#9b59b6';
            } else {
                ctx.fillStyle = '#27ae60';
            }
            ctx.fill();
            
            ctx.strokeStyle = isSelected ? '#c0392b' : '#1e8449';
            ctx.lineWidth = isSelected ? 4 : 3;
            ctx.stroke();

            ctx.shadowColor = 'transparent';
            ctx.fillStyle = 'white';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(value, node.x, node.y);

            ctx.restore();
        }
    }
}

class EnhancedHashTable {
    constructor(size = 10) {
        this.table = new Array(size).fill(null).map(() => []);
        this.size_count = 0;
        this.collisions = 0;
    }

    hash(key) {
        let hash = 0;
        for (let i = 0; i < key.toString().length; i++) {
            hash = ((hash << 5) - hash) + key.toString().charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash) % this.table.length;
    }

    async insert(value) {
        const index = this.hash(value);
        
        if (!this.table[index].includes(value)) {
            if (this.table[index].length > 0) {
                this.collisions++;
            }
            this.table[index].push({ value, animating: true });
            this.size_count++;
            
            await new Promise(resolve => setTimeout(resolve, 300));
            this.table[index][this.table[index].length - 1].animating = false;
            return true;
        }
        return false;
    }

    async delete(value) {
        const index = this.hash(value);
        const bucketIndex = this.table[index].findIndex(item => item.value === value);
        
        if (bucketIndex > -1) {
            this.table[index][bucketIndex].animating = true;
            await new Promise(resolve => setTimeout(resolve, 300));
            this.table[index].splice(bucketIndex, 1);
            this.size_count--;
            return true;
        }
        return false;
    }

    async search(value) {
        const index = this.hash(value);
        const found = this.table[index].some(item => item.value === value);
        
        if (found) {
            const item = this.table[index].find(item => item.value === value);
            item.highlighted = true;
            await new Promise(resolve => setTimeout(resolve, 500));
            item.highlighted = false;
        }
        return found;
    }

    traverse() {
        const result = [];
        for (let bucket of this.table) {
            result.push(...bucket.map(item => item.value));
        }
        return result;
    }

    size() {
        return this.size_count;
    }

    toJSON() {
        return { type: 'hash-table', data: this.traverse(), collisions: this.collisions };
    }

    draw(ctx, width, height) {
        const bucketWidth = Math.max(60, width / this.table.length);
        const bucketHeight = 50;
        const startY = height / 2 - bucketHeight;

        // Draw table background
        ctx.fillStyle = '#ecf0f1';
        ctx.fillRect(0, startY, width, bucketHeight * 2);

        for (let i = 0; i < this.table.length; i++) {
            const x = i * bucketWidth;
            const y = startY;

            // Draw bucket
            ctx.strokeStyle = '#34495e';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, bucketWidth, bucketHeight);

            // Draw bucket index
            ctx.fillStyle = '#7f8c8d';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`[${i}]`, x + bucketWidth / 2, y - 10);

            // Draw collision indicator
            if (this.table[i].length > 1) {
                ctx.fillStyle = '#e74c3c';
                ctx.fillText(`⚠ ${this.table[i].length}`, x + bucketWidth / 2, y + bucketHeight + 20);
            }

            // Draw values in bucket
            if (this.table[i].length > 0) {
                const itemY = y + bucketHeight + 50;
                
                this.table[i].forEach((item, idx) => {
                    const itemX = x + bucketWidth / 2;
                    const offsetY = itemY + (idx * 50);

                    // Draw connection line
                    ctx.beginPath();
                    ctx.moveTo(itemX, y + bucketHeight);
                    ctx.lineTo(itemX, offsetY - 20);
                    ctx.strokeStyle = '#95a5a6';
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    // Draw item circle
                    const scale = item.animating ? 1.2 : (item.highlighted ? 1.1 : 1);
                    const radius = 20 * scale;

                    ctx.save();
                    ctx.shadowColor = 'rgba(0,0,0,0.2)';
                    ctx.shadowBlur = 5;
                    
                    ctx.beginPath();
                    ctx.arc(itemX, offsetY, radius, 0, 2 * Math.PI);
                    
                    if (item.highlighted) {
                        ctx.fillStyle = '#f39c12';
                    } else if (item.animating) {
                        ctx.fillStyle = '#e74c3c';
                    } else {
                        ctx.fillStyle = '#9b59b6';
                    }
                    ctx.fill();
                    ctx.strokeStyle = '#8e44ad';
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    ctx.shadowColor = 'transparent';
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 12px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(item.value, itemX, offsetY);
                    ctx.restore();
                });
            }
        }

        // Draw statistics
        ctx.fillStyle = '#2c3e50';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Load Factor: ${(this.size_count / this.table.length).toFixed(2)}`, 10, 30);
        ctx.fillText(`Collisions: ${this.collisions}`, 10, 50);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(App));
});
