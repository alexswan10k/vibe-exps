/**
 * Legend Component
 */
(function () {
    const { createElement: h } = React;

    function LegendItem({ color, label, desc }) {
        return h('div', { className: 'flex items-center gap-2 mb-2' },
            h('div', {
                className: `w-4 h-4 rounded-sm border border-slate-600 ${color}`
            }),
            h('div', null,
                h('div', { className: 'text-sm font-bold text-slate-200' }, label),
                h('div', { className: 'text-xs text-slate-400' }, desc)
            )
        );
    }

    function Legend() {
        return h('div', { className: 'card' },
            h('h3', { className: 'text-lg font-semibold mb-3' }, 'Legend'),
            h(LegendItem, {
                color: 'bg-yellow-400',
                label: 'Active',
                desc: 'Cell is currently firing (Burst or Predicted).'
            }),
            h(LegendItem, {
                color: 'bg-orange-500',
                label: 'Predictive',
                desc: 'Cell expects to be active next step.'
            }),
            h(LegendItem, {
                color: 'bg-green-500',
                label: 'Correctly Predicted',
                desc: 'Was Predictive and became Active.'
            }),
            h(LegendItem, {
                color: 'bg-red-500',
                label: 'Unexpected',
                desc: 'Active but was not predicted (Bursting).'
            })
        );
    }

    window.Legend = Legend;
})();
