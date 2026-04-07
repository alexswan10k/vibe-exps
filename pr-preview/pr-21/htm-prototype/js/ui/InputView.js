/**
 * Input SDR Visualization
 */
(function () {
    const { createElement: h } = React;

    function InputView({ sdr, char, highlightedBits = [] }) {
        if (!sdr) return null;

        return h('div', { className: 'card glass h-full flex flex-col p-2' },
            h('h3', { className: 'text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1' }, `Input SDR: ${char === '\n' ? '↵' : char}`),
            h('div', {
                className: 'grid gap-0.5 flex-1',
                style: {
                    gridTemplateColumns: 'repeat(16, 1fr)',
                    minHeight: '60px'
                }
            },
                Array.from({ length: 64 }).map((_, idx) => {
                    const isActive = sdr && sdr[idx];
                    const isHighlighted = highlightedBits.includes(idx);
                    return h('div', {
                        key: idx,
                        'data-bit-idx': idx,
                        className: `bit w-full h-full aspect-square rounded-[1px] transition-all duration-300 border border-white/5 ${isActive ? 'bg-blue-500 shadow-[0_1px_4px_rgba(59,130,246,0.5)]' : 'bg-slate-800'} ${isHighlighted ? 'ring-1 ring-cyan-400 scale-110 z-20' : ''}`,
                        onMouseEnter: () => window.onInputBitHover && window.onInputBitHover(idx),
                        onMouseLeave: () => window.onInputBitHover && window.onInputBitHover(null)
                    });
                })
            )
        );
    }

    window.InputView = InputView;
})();
