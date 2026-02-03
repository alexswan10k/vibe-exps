/**
 * Input SDR Visualization
 */
(function () {
    const { createElement: h } = React;

    function InputView({ sdr, char }) {
        if (!sdr) return null;

        return h('div', { className: 'card' },
            h('h3', { className: 'text-lg font-semibold mb-3' }, `Input SDR: ${char === '\n' ? '↵' : char}`),
            h('div', {
                className: 'grid gap-1',
                style: { gridTemplateColumns: 'repeat(8, 1fr)' }
            },
                sdr.map((isActive, idx) =>
                    h('div', {
                        key: idx,
                        className: `w-3 h-3 rounded-sm ${isActive ? 'bg-blue-500' : 'bg-slate-700'}`,
                        title: `Bit ${idx}`
                    })
                )
            )
        );
    }

    window.InputView = InputView;
})();
