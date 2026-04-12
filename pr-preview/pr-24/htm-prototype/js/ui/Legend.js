/**
 * Legend Component
 */
(function () {
    const { createElement: h } = React;

    function LegendItem({ color, label, desc }) {
        return h('div', { className: 'flex items-center gap-2 mb-1.5' },
            h('div', {
                className: `w-3 h-3 rounded-sm border border-slate-700/50 ${color}`
            }),
            h('div', null,
                h('div', { className: 'text-[11px] font-bold text-slate-200' }, label),
                h('div', { className: 'text-[10px] text-slate-500 leading-tight' }, desc)
            )
        );
    }

    function Legend() {
        return h('div', { className: 'p-2' },
            h('h3', { className: 'text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2' }, 'Legend'),
            h(LegendItem, {
                color: 'bg-yellow-400',
                label: 'Active',
                desc: 'Firing (Burst/Predicted).'
            }),
            h(LegendItem, {
                color: 'bg-orange-500',
                label: 'Predictive',
                desc: 'Expects update next.'
            }),
            h(LegendItem, {
                color: 'bg-green-500',
                label: 'Correct',
                desc: 'Predicted & Active.'
            }),
            h(LegendItem, {
                color: 'bg-red-500',
                label: 'Unexpected',
                desc: 'Active but not predicted.'
            })
        );
    }

    window.Legend = Legend;
})();
