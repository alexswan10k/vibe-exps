document.addEventListener('DOMContentLoaded', () => {
    // Snippets
    const snippets = {
        basic: `console.log('Start');\nconsole.log('Middle');\nconsole.log('End');`,
        timeout: `console.log('Start');\n\nsetTimeout(() => {\n    console.log('Timeout callback');\n}, 0);\n\nconsole.log('End');`,
        promise: `console.log('Start');\n\nPromise.resolve().then(() => {\n    console.log('Promise resolved');\n});\n\nconsole.log('End');`,
        complex: `console.log('Script start');\n\nsetTimeout(() => {\n  console.log('setTimeout 1');\n}, 0);\n\nPromise.resolve()\n  .then(() => {\n    console.log('promise 1');\n  })\n  .then(() => {\n    console.log('promise 2');\n  });\n\nconsole.log('Script end');`
    };

    // State machine simulation of the event loop
    const state = {
        steps: [],
        currentStep: 0,
        isPlaying: false,
        timeoutId: null
    };

    // DOM Elements
    const stackEl = document.querySelector('#call-stack .items-container');
    const apiEl = document.querySelector('#web-apis .items-container');
    const macroEl = document.querySelector('#macro-queue .items-container');
    const microEl = document.querySelector('#micro-queue .items-container');
    const consoleEl = document.getElementById('console-output');

    const codeInput = document.getElementById('code-input');
    const snippetSelect = document.getElementById('snippet-select');

    const stepBtn = document.getElementById('step-btn');
    const playBtn = document.getElementById('play-btn');
    const resetBtn = document.getElementById('reset-btn');

    // UI Update Helper
    function renderState(currentState) {
        if (!currentState) return;

        // Render Stack
        stackEl.innerHTML = currentState.stack.map(item =>
            `<div class="stack-item">${item}</div>`
        ).join('');

        // Render APIs
        apiEl.innerHTML = currentState.apis.map(item =>
            `<div class="api-item">${item}</div>`
        ).join('');

        // Render Macro
        macroEl.innerHTML = currentState.macro.map(item =>
            `<div class="queue-item">${item}</div>`
        ).join('');

        // Render Micro
        microEl.innerHTML = currentState.micro.map(item =>
            `<div class="micro-item">${item}</div>`
        ).join('');

        // Render Console
        consoleEl.innerHTML = '<div style="color: #888; font-style: italic; margin-bottom: 10px;">// Console Output</div>' +
            currentState.logs.map(item =>
            `<div class="log-entry">> ${item}</div>`
        ).join('');

        // Disable Step/Play if finished
        if (state.currentStep >= state.steps.length - 1) {
            stepBtn.disabled = true;
            playBtn.disabled = true;
            playBtn.classList.remove('run-btn');
        } else {
            stepBtn.disabled = false;
            playBtn.disabled = false;
            playBtn.classList.add('run-btn');
        }
    }

    // Step generation logic based on snippets
    function generateSteps(snippetKey) {
        let baseState = { stack: [], apis: [], macro: [], micro: [], logs: [] };
        let steps = [];

        const pushStep = (updates) => {
            if (updates) {
                if (updates.stack !== undefined) baseState.stack = updates.stack;
                if (updates.apis !== undefined) baseState.apis = updates.apis;
                if (updates.macro !== undefined) baseState.macro = updates.macro;
                if (updates.micro !== undefined) baseState.micro = updates.micro;
                if (updates.logs !== undefined) baseState.logs = updates.logs;
            }
            steps.push(JSON.parse(JSON.stringify(baseState)));
        };

        // Initial empty state
        pushStep();

        // Add anonymous main to stack
        pushStep({ stack: ['anonymous'] });

        if (snippetKey === 'basic') {
            pushStep({ stack: ['console.log("Start")', 'anonymous'] });
            pushStep({ stack: ['anonymous'], logs: ['Start'] });

            pushStep({ stack: ['console.log("Middle")', 'anonymous'] });
            pushStep({ stack: ['anonymous'], logs: ['Start', 'Middle'] });

            pushStep({ stack: ['console.log("End")', 'anonymous'] });
            pushStep({ stack: ['anonymous'], logs: ['Start', 'Middle', 'End'] });

            // Script finished, clear stack
            pushStep({ stack: [] });

        } else if (snippetKey === 'timeout') {
            pushStep({ stack: ['console.log("Start")', 'anonymous'] });
            pushStep({ stack: ['anonymous'], logs: ['Start'] });

            pushStep({ stack: ['setTimeout(cb, 0)', 'anonymous'] });
            pushStep({ stack: ['anonymous'], apis: ['timer(0ms) -> cb'] });

            pushStep({ stack: ['console.log("End")', 'anonymous'] });
            // Timer resolves immediately, cb moves to macro queue
            pushStep({ stack: ['console.log("End")', 'anonymous'], apis: [], macro: ['cb'] });
            pushStep({ stack: ['anonymous'], logs: ['Start', 'End'] });

            // Script finished, clear stack
            pushStep({ stack: [] });

            // Event loop checks macro queue
            pushStep({ stack: ['cb'], macro: [] });
            pushStep({ stack: ['console.log("Timeout callback")', 'cb'] });
            pushStep({ stack: ['cb'], logs: ['Start', 'End', 'Timeout callback'] });
            pushStep({ stack: [] });

        } else if (snippetKey === 'promise') {
            pushStep({ stack: ['console.log("Start")', 'anonymous'] });
            pushStep({ stack: ['anonymous'], logs: ['Start'] });

            pushStep({ stack: ['Promise.resolve()', 'anonymous'] });
            pushStep({ stack: ['Promise.resolve().then(cb)', 'anonymous'] });
            pushStep({ stack: ['anonymous'], micro: ['cb'] });

            pushStep({ stack: ['console.log("End")', 'anonymous'] });
            pushStep({ stack: ['anonymous'], logs: ['Start', 'End'] });

            // Script finished, clear stack
            pushStep({ stack: [] });

            // Event loop checks MICRO queue FIRST
            pushStep({ stack: ['cb'], micro: [] });
            pushStep({ stack: ['console.log("Promise resolved")', 'cb'] });
            pushStep({ stack: ['cb'], logs: ['Start', 'End', 'Promise resolved'] });
            pushStep({ stack: [] });

        } else if (snippetKey === 'complex') {
            pushStep({ stack: ['console.log("Script start")', 'anonymous'] });
            pushStep({ stack: ['anonymous'], logs: ['Script start'] });

            pushStep({ stack: ['setTimeout(cb1, 0)', 'anonymous'] });
            pushStep({ stack: ['anonymous'], apis: ['timer(0ms) -> cb1'] });

            pushStep({ stack: ['Promise.resolve()', 'anonymous'] });
            // API resolves cb1 while promise handles
            pushStep({ stack: ['Promise.resolve().then(cb2)', 'anonymous'], apis: [], macro: ['cb1'] });
            pushStep({ stack: ['anonymous'], micro: ['cb2'] });

            pushStep({ stack: ['console.log("Script end")', 'anonymous'] });
            pushStep({ stack: ['anonymous'], logs: ['Script start', 'Script end'] });

            // Script finished, clear stack
            pushStep({ stack: [] });

            // Micro queue executes BEFORE macro
            pushStep({ stack: ['cb2'], micro: [] });
            pushStep({ stack: ['console.log("promise 1")', 'cb2'] });
            pushStep({ stack: ['cb2'], logs: ['Script start', 'Script end', 'promise 1'] });

            // .then chained, adding new callback to micro queue
            pushStep({ stack: ['.then(cb3)', 'cb2'] });
            pushStep({ stack: ['cb2'], micro: ['cb3'] });
            pushStep({ stack: [] });

            // Check micro queue again
            pushStep({ stack: ['cb3'], micro: [] });
            pushStep({ stack: ['console.log("promise 2")', 'cb3'] });
            pushStep({ stack: ['cb3'], logs: ['Script start', 'Script end', 'promise 1', 'promise 2'] });
            pushStep({ stack: [] });

            // Now check macro queue
            pushStep({ stack: ['cb1'], macro: [] });
            pushStep({ stack: ['console.log("setTimeout 1")', 'cb1'] });
            pushStep({ stack: ['cb1'], logs: ['Script start', 'Script end', 'promise 1', 'promise 2', 'setTimeout 1'] });
            pushStep({ stack: [] });
        }

        return steps;
    }

    function init(snippetKey) {
        codeInput.value = snippets[snippetKey];
        state.steps = generateSteps(snippetKey);
        state.currentStep = 0;
        state.isPlaying = false;
        if(state.timeoutId) clearTimeout(state.timeoutId);

        renderState(state.steps[state.currentStep]);
    }

    // Event Listeners
    snippetSelect.addEventListener('change', (e) => {
        init(e.target.value);
    });

    stepBtn.addEventListener('click', () => {
        if (state.currentStep < state.steps.length - 1) {
            state.currentStep++;
            renderState(state.steps[state.currentStep]);
        }
    });

    playBtn.addEventListener('click', () => {
        if (state.isPlaying) return;
        state.isPlaying = true;

        const playNext = () => {
            if (!state.isPlaying) return;
            if (state.currentStep < state.steps.length - 1) {
                state.currentStep++;
                renderState(state.steps[state.currentStep]);
                state.timeoutId = setTimeout(playNext, 800);
            } else {
                state.isPlaying = false;
                renderState(state.steps[state.currentStep]);
            }
        };

        playNext();
    });

    resetBtn.addEventListener('click', () => {
        state.isPlaying = false;
        if(state.timeoutId) clearTimeout(state.timeoutId);
        init(snippetSelect.value);
    });

    // Initialize
    init('basic');
    snippetSelect.value = 'basic';
});
