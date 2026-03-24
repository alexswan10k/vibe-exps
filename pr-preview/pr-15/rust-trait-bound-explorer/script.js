// rust-trait-bound-explorer/script.js

const State = {
    // Current bounds applied to the generic T
    functionBounds: new Set(),

    // Type currently placed in the call site
    callSiteType: null,

    // Traits manually implemented on MyStruct
    myStructTraits: new Set(),

    // Tracks current drag item info
    draggedItem: null
};

// Data Model: Traits and their descriptions/requirements
const TRAITS = {
    'Clone': {
        name: 'Clone',
        desc: 'Explicitly duplicates an object.',
        requires: []
    },
    'Copy': {
        name: 'Copy',
        desc: 'Types whose values can be duplicated simply by copying bits.',
        requires: ['Clone'] // Copy requires Clone
    },
    'Debug': {
        name: 'Debug',
        desc: 'Format output for debugging purposes (the `{:?}` formatter).',
        requires: []
    },
    'Display': {
        name: 'Display',
        desc: 'Format output for user-facing display (the `{}` formatter).',
        requires: []
    },
    'Read': {
        name: 'Read',
        desc: 'Allows reading bytes from a source.',
        requires: []
    },
    'Write': {
        name: 'Write',
        desc: 'Allows writing bytes to a sink.',
        requires: []
    },
    'IntoIterator': {
        name: 'IntoIterator',
        desc: 'Conversion into an Iterator.',
        requires: []
    }
};

// Data Model: Built-in types and the traits they naturally implement
const TYPES = {
    'i32': {
        name: 'i32',
        traits: ['Clone', 'Copy', 'Debug', 'Display']
    },
    'f64': {
        name: 'f64',
        traits: ['Clone', 'Copy', 'Debug', 'Display']
    },
    'String': {
        name: 'String',
        traits: ['Clone', 'Debug', 'Display'] // Not Copy!
    },
    'Vec<T>': {
        name: 'Vec<T>',
        traits: ['Clone', 'Debug', 'IntoIterator'] // Not Copy, Not Display
    },
    'File': {
        name: 'File',
        traits: ['Debug', 'Read', 'Write'] // Not Clone or Copy
    },
    'TcpStream': {
        name: 'TcpStream',
        traits: ['Debug', 'Read', 'Write']
    }
};

// DOM Elements
const stdTraitsContainer = document.getElementById('std-traits-container');
const builtinTypesContainer = document.getElementById('builtin-types-container');
const tooltip = document.getElementById('tooltip');

// Drop Zones
const functionBoundsZone = document.getElementById('function-bounds-zone');
const functionBounds = document.getElementById('function-bounds');

const structImplZone = document.getElementById('struct-impl-zone');
const structTraits = document.getElementById('struct-traits');

const callSiteZone = document.getElementById('call-site-zone');
const callSiteArgs = document.getElementById('call-site-args');

const compileBtn = document.getElementById('compile-btn');
const terminalOutput = document.getElementById('terminal-output');

// Initialization
function init() {
    renderTraits();
    renderBuiltinTypes();
    setupDragAndDrop();
    setupTooltips();
    setupCompileButton();
}

// Render available traits
function renderTraits() {
    for (const [key, trait] of Object.entries(TRAITS)) {
        const el = document.createElement('div');
        el.className = 'draggable-item trait-item';
        el.draggable = true;
        el.textContent = trait.name;
        el.dataset.kind = 'trait';
        el.dataset.name = trait.name;
        stdTraitsContainer.appendChild(el);
    }
}

// Render built-in types
function renderBuiltinTypes() {
    for (const [key, type] of Object.entries(TYPES)) {
        const el = document.createElement('div');
        el.className = 'draggable-item type-item';
        el.draggable = true;
        el.textContent = type.name;
        el.dataset.kind = 'type';
        el.dataset.name = type.name;
        builtinTypesContainer.appendChild(el);
    }
}

// Core Drag and Drop Logic
function setupDragAndDrop() {
    // 1. Setup all draggable items (Types and Traits)
    document.addEventListener('dragstart', (e) => {
        if (!e.target.classList.contains('draggable-item')) return;

        e.target.classList.add('dragging');
        State.draggedItem = {
            kind: e.target.dataset.kind,
            name: e.target.dataset.name,
            sourceElement: e.target
        };

        // Prepare drag image (optional styling)
        e.dataTransfer.effectAllowed = 'copyMove';
        e.dataTransfer.setData('text/plain', e.target.dataset.name);
    });

    document.addEventListener('dragend', (e) => {
        if (!e.target.classList.contains('draggable-item')) return;
        e.target.classList.remove('dragging');
        State.draggedItem = null;

        // Remove active states from zones
        document.querySelectorAll('.drop-zone').forEach(z => {
            z.classList.remove('drag-over', 'invalid-drop');
        });
    });

    // 2. Setup Drop Zones
    const zones = [
        { el: functionBoundsZone, accept: 'trait', onDrop: addFunctionBound },
        { el: structImplZone, accept: 'trait', onDrop: addStructTrait },
        { el: callSiteZone, accept: 'type', onDrop: setCallSiteType }
    ];

    zones.forEach(zone => {
        zone.el.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow dropping
            if (!State.draggedItem) return;

            if (State.draggedItem.kind === zone.accept) {
                zone.el.classList.add('drag-over');
                e.dataTransfer.dropEffect = 'copy';
            } else {
                zone.el.classList.add('invalid-drop');
                e.dataTransfer.dropEffect = 'none';
            }
        });

        zone.el.addEventListener('dragleave', () => {
            zone.el.classList.remove('drag-over', 'invalid-drop');
        });

        zone.el.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.el.classList.remove('drag-over', 'invalid-drop');

            if (!State.draggedItem) return;
            if (State.draggedItem.kind !== zone.accept) return;

            zone.onDrop(State.draggedItem.name);
        });
    });

    // Handle generic drop cancellation
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());
}

// Action: Add bound to function
function addFunctionBound(traitName) {
    if (State.functionBounds.has(traitName)) return; // Prevent duplicates

    State.functionBounds.add(traitName);
    renderDroppedItems(functionBounds, State.functionBounds, 'trait', (name) => {
        State.functionBounds.delete(name);
        updateUI();
    });

    updateUI();
}

// Action: Impl trait on MyStruct
function addStructTrait(traitName) {
    if (State.myStructTraits.has(traitName)) return; // Prevent duplicates

    // Dependency Check (e.g., Copy requires Clone)
    const traitDef = TRAITS[traitName];
    if (traitDef.requires.length > 0) {
        for (const req of traitDef.requires) {
            if (!State.myStructTraits.has(req)) {
                printTerminalError(`error[E0277]: the trait bound \`MyStruct: ${req}\` is not satisfied`);
                printTerminalInfo(`note: required by \`${traitName}\``);
                printTerminalInfo(`help: try implementing \`${req}\` on \`MyStruct\` first`);
                return; // Prevent drop
            }
        }
    }

    State.myStructTraits.add(traitName);
    renderDroppedItems(structTraits, State.myStructTraits, 'trait', (name) => {
        State.myStructTraits.delete(name);
        // Cascade delete dependents (if remove Clone, remove Copy)
        for (const [tName, def] of Object.entries(TRAITS)) {
            if (State.myStructTraits.has(tName) && def.requires.includes(name)) {
                 State.myStructTraits.delete(tName);
            }
        }
        updateUI();
    });

    updateUI();
}

// Action: Set type at call site
function setCallSiteType(typeName) {
    State.callSiteType = typeName;
    const items = new Set([typeName]);
    renderDroppedItems(callSiteArgs, items, 'type', () => {
        State.callSiteType = null;
        updateUI();
    });

    updateUI();
}

// Helper: Render items inside a drop zone
function renderDroppedItems(container, itemSet, kind, onRemove) {
    container.innerHTML = '';

    if (itemSet.size > 0) {
        // Hide placeholder
        container.previousElementSibling.style.display = 'none';

        // Render + Joiner
        let i = 0;
        for (const item of itemSet) {
            if (i > 0 && kind === 'trait' && container === functionBounds) {
                const plus = document.createElement('span');
                plus.textContent = ' + ';
                plus.style.color = 'var(--text-main)';
                container.appendChild(plus);
            }

            const el = document.createElement('div');
            el.className = `draggable-item ${kind}-item`;
            el.textContent = item;

            // Allow removal by clicking
            el.addEventListener('click', () => {
                onRemove(item);
                if (itemSet.size === 0) {
                     container.previousElementSibling.style.display = 'block';
                }
            });

            container.appendChild(el);
            i++;
        }
    } else {
        // Show placeholder
        container.previousElementSibling.style.display = 'block';
    }
}

// Check if a specific type satisfies all currently selected function bounds
function typeSatisfiesBounds(typeName) {
    if (State.functionBounds.size === 0) return true;

    // Get traits for the type
    let typeTraits;
    if (typeName === 'MyStruct') {
        typeTraits = Array.from(State.myStructTraits);
    } else {
        typeTraits = TYPES[typeName].traits;
    }

    // Check if every bound is present in the type's traits
    for (const bound of State.functionBounds) {
        if (!typeTraits.includes(bound)) {
            return false;
        }
    }
    return true;
}

// Update UI state based on bounds (Visual Filtering)
function updateUI() {
    // Visual filtering: Dim types that don't satisfy bounds
    const typeItems = document.querySelectorAll('.type-item');
    typeItems.forEach(item => {
        // Skip dropped items
        if (item.closest('.dropped-items')) return;

        const typeName = item.dataset.name || item.textContent.trim();

        if (!typeSatisfiesBounds(typeName)) {
            item.classList.add('dimmed');
            item.title = "Does not satisfy current trait bounds";
            item.draggable = false; // Prevent dragging
        } else {
            item.classList.remove('dimmed');
            item.title = "";
            item.draggable = true;
        }
    });

    // Check if the currently dropped call site type still satisfies bounds
    if (State.callSiteType && !typeSatisfiesBounds(State.callSiteType)) {
        printTerminalInfo(`Warning: '${State.callSiteType}' no longer satisfies the function bounds. Click Run Compiler to see details.`);
    } else {
        // Reset terminal info message if things look okay
        terminalOutput.innerHTML = '<div class="terminal-line info">Waiting for compilation... Click Run Compiler to verify.</div>';
    }
}

// Setup Tooltips for items
function setupTooltips() {
    document.addEventListener('mouseover', (e) => {
        const item = e.target.closest('.draggable-item');
        if (!item || item.closest('.dropped-items')) return;

        const kind = item.dataset.kind;
        const name = item.dataset.name;

        let content = '';
        if (kind === 'trait' && TRAITS[name]) {
            content = `<h4>Trait: ${name}</h4><p>${TRAITS[name].desc}</p>`;
            if (TRAITS[name].requires.length > 0) {
                content += `<p style="margin-top:5px;color:var(--rust-keyword)">Requires: ${TRAITS[name].requires.join(', ')}</p>`;
            }
        } else if (kind === 'type' && TYPES[name]) {
            content = `<h4>Type: ${name}</h4><p>Implements: <code>${TYPES[name].traits.join(', ')}</code></p>`;
        } else if (name === 'MyStruct') {
            const impls = Array.from(State.myStructTraits);
            content = `<h4>Type: MyStruct</h4><p>Implements: <code>${impls.length > 0 ? impls.join(', ') : 'None'}</code></p>`;
        }

        if (content) {
            tooltip.innerHTML = content;
            tooltip.classList.remove('hidden');
        }
    });

    document.addEventListener('mouseout', (e) => {
        if (e.target.closest('.draggable-item')) {
            tooltip.classList.add('hidden');
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!tooltip.classList.contains('hidden')) {
            // Position near cursor
            let x = e.pageX + 15;
            let y = e.pageY + 15;

            // Boundary checks
            const rect = tooltip.getBoundingClientRect();
            if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 10;
            if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 10;

            tooltip.style.left = x + 'px';
            tooltip.style.top = y + 'px';
        }
    });
}

// Terminal Helpers
function clearTerminal() {
    terminalOutput.innerHTML = '';
}
function printTerminalError(msg) {
    const line = document.createElement('div');
    line.className = 'terminal-line error';
    line.textContent = msg;
    terminalOutput.appendChild(line);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}
function printTerminalSuccess(msg) {
    const line = document.createElement('div');
    line.className = 'terminal-line success';
    line.textContent = msg;
    terminalOutput.appendChild(line);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}
function printTerminalInfo(msg) {
    const line = document.createElement('div');
    line.className = 'terminal-line info';
    line.textContent = msg;
    terminalOutput.appendChild(line);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

// Compilation Logic
function setupCompileButton() {
    compileBtn.addEventListener('click', () => {
        clearTerminal();

        if (!State.callSiteType) {
            printTerminalError("error: Please drop a Type into the Call Site to compile.");
            return;
        }

        const typeName = State.callSiteType;

        // Get traits for the type
        let typeTraits;
        if (typeName === 'MyStruct') {
            typeTraits = Array.from(State.myStructTraits);
        } else {
            typeTraits = TYPES[typeName].traits;
        }

        let hasError = false;

        // Check each bound against the type's traits
        for (const bound of State.functionBounds) {
            if (!typeTraits.includes(bound)) {
                hasError = true;

                // Print a realistic rustc error message
                printTerminalError(`error[E0277]: the trait bound \`${typeName}: ${bound}\` is not satisfied`);
                printTerminalInfo(`  --> src/main.rs`);
                printTerminalInfo(`   |`);
                printTerminalInfo(`   |     do_something(${typeName});`);
                printTerminalInfo(`   |     ^^^^^^^^^^^^ the trait \`${bound}\` is not implemented for \`${typeName}\``);
                printTerminalInfo(`   |`);
                printTerminalInfo(`note: required by a bound in \`do_something\``);

                // Add a helpful suggestion based on context
                if (typeName === 'MyStruct') {
                    printTerminalInfo(`help: consider implementing \`${bound}\` for \`${typeName}\``);
                } else if (bound === 'Copy' && typeTraits.includes('Clone')) {
                    printTerminalInfo(`help: consider using \`.clone()\` instead of \`Copy\``);
                }

                printTerminalInfo(''); // Empty line for spacing between errors
            }
        }

        if (!hasError) {
            printTerminalSuccess(`   Compiling playground v0.0.1`);
            printTerminalSuccess(`    Finished \`dev\` profile [unoptimized + debuginfo] target(s) in 0.42s`);
            printTerminalSuccess(`     Running \`target/debug/playground\``);
            printTerminalInfo(`Execution successful. \`${typeName}\` satisfies all bounds.`);
        } else {
            printTerminalError(`error: aborting due to previous error(s)`);
            printTerminalInfo(`For more information about this error, try \`rustc --explain E0277\`.`);
        }
    });
}

// Start app
document.addEventListener('DOMContentLoaded', init);