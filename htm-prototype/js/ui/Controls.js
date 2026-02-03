/**
 * Controls Component
 */
const { createElement: h, useState } = React;

function Controls({ onStep, onReset, isPlaying, setIsPlaying, inputString, setInputString }) {

    return h('div', { className: 'card flex flex-col gap-4' },
        h('h2', { className: 'text-xl' }, 'Controls'),

        // Input
        h('div', { className: 'flex flex-col gap-2' },
            h('label', null, 'Input Sequence:'),
            h('input', {
                type: 'text',
                value: inputString,
                onChange: (e) => setInputString(e.target.value),
                className: 'p-2 bg-slate-800 border rounded text-white'
            })
        ),

        // Buttons
        h('div', { className: 'flex gap-2' },
            h('button', {
                className: 'btn',
                onClick: onStep,
                disabled: isPlaying
            }, 'Step >>'),

            h('button', {
                className: 'btn',
                onClick: () => setIsPlaying(!isPlaying)
            }, isPlaying ? 'Pause ||' : 'Play >'),

            h('button', {
                className: 'btn bg-slate-800',
                onClick: onReset
            }, 'Reset')
        )
    );
}

// Global Export
window.Controls = Controls;
