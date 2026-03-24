// rust-trait-bound-explorer/script.js

const State = {
    // Current bounds applied to the generic T
    functionBounds: new Set(),

    // Tracks current drag item info
    draggedItem: null
};

// Data Model: Traits and their descriptions
const TRAITS = {
    'Clone': { name: 'Clone', desc: 'Can be explicitly duplicated.' },
    'Copy': { name: 'Copy', desc: 'Can be duplicated implicitly by copying bits. (Requires Clone)' },
    'Debug': { name: 'Debug', desc: 'Can be formatted with `{:?}` for debugging.' },
    'Display': { name: 'Display', desc: 'Can be formatted with `{}` for user-facing output.' },
    'Send': { name: 'Send', desc: 'Safe to transfer ownership between threads.' },
    'Sync': { name: 'Sync', desc: 'Safe to share references between threads.' },
    'Read': { name: 'Read', desc: 'Allows reading bytes from a source.' },
    'Write': { name: 'Write', desc: 'Allows writing bytes to a sink.' },
    'Default': { name: 'Default', desc: 'Can be initialized with a default value.' }
};

// Data Model: A broad set of types and the traits they implement
const TYPES = [
    {
        name: 'i32',
        desc: 'A 32-bit signed integer.',
        traits: ['Clone', 'Copy', 'Debug', 'Display', 'Send', 'Sync', 'Default']
    },
    {
        name: 'f64',
        desc: 'A 64-bit floating point number.',
        traits: ['Clone', 'Copy', 'Debug', 'Display', 'Send', 'Sync', 'Default']
    },
    {
        name: 'String',
        desc: 'A heap-allocated, growable UTF-8 string.',
        traits: ['Clone', 'Debug', 'Display', 'Send', 'Sync', 'Default']
        // Not Copy
    },
    {
        name: '&str',
        desc: 'A string slice (reference).',
        traits: ['Clone', 'Copy', 'Debug', 'Display', 'Send', 'Sync']
        // Not Default
    },
    {
        name: 'Vec<T>',
        desc: 'A growable array (assuming T is Send/Sync).',
        traits: ['Clone', 'Debug', 'Send', 'Sync', 'Default']
        // Not Copy, Not Display
    },
    {
        name: 'File',
        desc: 'A reference to an open file on the filesystem.',
        traits: ['Debug', 'Send', 'Sync', 'Read', 'Write']
        // Not Clone, Copy, Display, Default
    },
    {
        name: 'Rc<String>',
        desc: 'A single-threaded reference-counting pointer.',
        traits: ['Clone', 'Debug', 'Display', 'Default']
        // Not Send, Not Sync, Not Copy
    },
    {
        name: 'Arc<String>',
        desc: 'A thread-safe reference-counting pointer.',
        traits: ['Clone', 'Debug', 'Display', 'Send', 'Sync', 'Default']
        // Not Copy
    },
    {
        name: 'MutexGuard<T>',
        desc: 'An RAII guard that unlocks a Mutex when dropped.',
        traits: ['Debug', 'Sync']
        // Specifically NOT Send!
    }
];

// DOM Elements
const stdTraitsContainer = document.getElementById('std-traits-container');
const functionBoundsZone = document.getElementById('function-bounds-zone');
const functionBounds = document.getElementById('function-bounds');
const validTypesContainer = document.getElementById('valid-types-container');
const rejectedTypesContainer = document.getElementById('rejected-types-container');
const validCount = document.getElementById('valid-count');
const rejectedCount = document.getElementById('rejected-count');
const tooltip = document.getElementById('tooltip');

// Initialization
function init() {
    renderTraitPalette();
    setupDragAndDrop();
    setupTooltips();
    updateTypeFiltering(); // Initial render of all types in Valid section
}

// Render available traits into the palette
function renderTraitPalette() {
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

// Core Drag and Drop Logic
function setupDragAndDrop() {
    document.addEventListener('dragstart', (e) => {
        if (!e.target.classList.contains('draggable-item')) return;

        e.target.classList.add('dragging');
        State.draggedItem = {
            kind: e.target.dataset.kind,
            name: e.target.dataset.name
        };
        e.dataTransfer.effectAllowed = 'copyMove';
        e.dataTransfer.setData('text/plain', e.target.dataset.name);
    });

    document.addEventListener('dragend', (e) => {
        if (!e.target.classList.contains('draggable-item')) return;
        e.target.classList.remove('dragging');
        State.draggedItem = null;

        functionBoundsZone.classList.remove('drag-over', 'invalid-drop');
    });

    // Setup Function Bounds Drop Zone
    functionBoundsZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!State.draggedItem) return;

        if (State.draggedItem.kind === 'trait') {
            functionBoundsZone.classList.add('drag-over');
            e.dataTransfer.dropEffect = 'copy';
        } else {
            functionBoundsZone.classList.add('invalid-drop');
            e.dataTransfer.dropEffect = 'none';
        }
    });

    functionBoundsZone.addEventListener('dragleave', () => {
        functionBoundsZone.classList.remove('drag-over', 'invalid-drop');
    });

    functionBoundsZone.addEventListener('drop', (e) => {
        e.preventDefault();
        functionBoundsZone.classList.remove('drag-over', 'invalid-drop');

        if (!State.draggedItem || State.draggedItem.kind !== 'trait') return;

        addFunctionBound(State.draggedItem.name);
    });

    // Prevent default drop elsewhere
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());
}

// Action: Add bound to function
function addFunctionBound(traitName) {
    if (State.functionBounds.has(traitName)) return; // Prevent duplicates

    // Copy implicitly requires Clone in Rust. Let's auto-add Clone for educational clarity
    if (traitName === 'Copy' && !State.functionBounds.has('Clone')) {
        State.functionBounds.add('Clone');
    }

    State.functionBounds.add(traitName);
    renderDroppedBounds();
    updateTypeFiltering(); // Re-evaluate all types
}

// Render items inside the bounds drop zone
function renderDroppedBounds() {
    functionBounds.innerHTML = '';

    if (State.functionBounds.size > 0) {
        // Hide placeholder
        functionBounds.previousElementSibling.style.display = 'none';

        let i = 0;
        for (const item of State.functionBounds) {
            if (i > 0) {
                const plus = document.createElement('span');
                plus.textContent = ' + ';
                plus.style.color = 'var(--text-main)';
                functionBounds.appendChild(plus);
            }

            const el = document.createElement('div');
            el.className = `draggable-item trait-item`;
            el.textContent = item;

            // Allow removal by clicking
            el.addEventListener('click', () => {
                State.functionBounds.delete(item);

                // If removing Clone, must remove Copy too
                if (item === 'Clone' && State.functionBounds.has('Copy')) {
                    State.functionBounds.delete('Copy');
                }

                renderDroppedBounds();
                updateTypeFiltering();
            });

            functionBounds.appendChild(el);
            i++;
        }
    } else {
        // Show placeholder
        functionBounds.previousElementSibling.style.display = 'block';
    }
}

// --- CORE LOGIC WILL GO HERE IN NEXT STEP ---
function updateTypeFiltering() {
    // Clear both containers
    validTypesContainer.innerHTML = '';
    rejectedTypesContainer.innerHTML = '';

    let validCountNum = 0;
    let rejectedCountNum = 0;

    // Evaluate each type
    for (const type of TYPES) {
        let isRejected = false;
        let missingTraits = [];

        // Check against current bounds
        for (const bound of State.functionBounds) {
            if (!type.traits.includes(bound)) {
                isRejected = true;
                missingTraits.push(bound);
            }
        }

        // Create the card
        const card = document.createElement('div');
        card.className = 'type-card';

        let cardHTML = `
            <div class="type-name">${type.name}</div>
            <div class="type-desc">${type.desc}</div>
            <div class="type-traits">Implements: ${type.traits.join(', ')}</div>
        `;

        if (isRejected) {
            // It lacks a trait, show the failure reason
            cardHTML += `
                <div class="failure-reason">
                    <strong>Error:</strong> Lacks \`${missingTraits.join('\`, \`')}\`
                </div>
            `;
            card.innerHTML = cardHTML;
            rejectedTypesContainer.appendChild(card);
            rejectedCountNum++;
        } else {
            // It's valid!
            card.innerHTML = cardHTML;
            validTypesContainer.appendChild(card);
            validCountNum++;
        }
    }

    // Update counters
    validCount.textContent = validCountNum;
    rejectedCount.textContent = rejectedCountNum;

    // Animate the valid container slightly to show an update happened
    validTypesContainer.style.opacity = 0.5;
    setTimeout(() => {
        validTypesContainer.style.opacity = 1;
        validTypesContainer.style.transition = 'opacity 0.2s ease';
    }, 50);
}

// Setup Tooltips for items
function setupTooltips() {
    document.addEventListener('mouseover', (e) => {
        const item = e.target.closest('.draggable-item');
        if (!item || item.closest('.dropped-items')) return;

        const kind = item.dataset.kind;
        const name = item.dataset.name;

        if (kind === 'trait' && TRAITS[name]) {
            tooltip.innerHTML = `<h4>Trait: ${name}</h4><p>${TRAITS[name].desc}</p>`;
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
            let x = e.pageX + 15;
            let y = e.pageY + 15;

            const rect = tooltip.getBoundingClientRect();
            if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 10;
            if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 10;

            tooltip.style.left = x + 'px';
            tooltip.style.top = y + 'px';
        }
    });
}

document.addEventListener('DOMContentLoaded', init);