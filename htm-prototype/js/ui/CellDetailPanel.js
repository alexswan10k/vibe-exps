/**
 * Cell Detail Panel Component
 */
(function () {
    const { createElement: h } = React;

    function SynapseList({ synapses, title }) {
        if (!synapses || synapses.length === 0) return null;

        return h('div', { className: 'mt-3' },
            h('h4', { className: 'text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1' }, title),
            h('div', { className: 'flex flex-col gap-1' },
                synapses.map((syn, idx) =>
                    h('div', { key: idx, className: 'flex items-center justify-between text-[11px] font-mono leading-none' },
                        h('div', { className: 'flex items-center' },
                            h('span', {
                                className: 'synapse-pip',
                                style: { backgroundColor: syn.isActive ? 'hsl(var(--color-active))' : 'hsl(var(--text-muted))', opacity: syn.isActive ? 1 : 0.3 }
                            }),
                            h('span', { className: syn.isActive ? 'text-yellow-400' : 'text-slate-500' },
                                `S${syn.inputSource.index || '?'}`
                            )
                        ),
                        h('span', { className: syn.permanence >= 0.2 ? 'text-green-400' : 'text-slate-400' },
                            syn.permanence.toFixed(2)
                        )
                    )
                )
            )
        );
    }

    function SegmentList({ segments }) {
        if (!segments || segments.length === 0) {
            return h('div', { className: 'text-xs text-slate-500 italic mt-2' }, 'No distal segments');
        }

        return h('div', { className: 'mt-3 flex flex-col gap-2' },
            segments.map((seg, idx) =>
                h('div', { key: idx, className: 'glass p-2 border-slate-700/50' },
                    h('div', { className: 'flex justify-between items-center text-[10px] uppercase font-bold text-slate-400 mb-1' },
                        h('span', null, `Segment ${idx}`),
                        h('span', { className: seg.isActive ? 'text-yellow-400' : 'text-slate-500' },
                            `${seg.getActiveSynapseCount()} Active`
                        )
                    ),
                    h(SynapseList, { synapses: seg.synapses, title: 'Synapses' })
                )
            )
        );
    }

    function CellDetailPanel({ cell, onClose }) {
        if (!cell) return null;

        return h('div', { className: 'card glass h-full flex flex-col p-4 border-l-0 overflow-hidden' },
            h('div', { className: 'flex justify-between items-center mb-4' },
                h('div', null,
                    h('h2', { className: 'text-sm font-bold uppercase tracking-wider text-slate-300' }, 'Cell Inspector'),
                    h('div', { className: 'text-xs text-slate-500' }, `Col ${cell.column.index} • Cell ${cell.index}`)
                ),
                h('button', {
                    className: 'text-slate-500 hover:text-white transition-colors p-1',
                    onClick: onClose
                }, '✕')
            ),

            h('div', { className: 'flex flex-wrap gap-1 mb-4' },
                cell.isActive && h('span', { className: 'px-1.5 py-0.5 bg-yellow-500/10 text-yellow-500 text-[10px] rounded font-bold border border-yellow-500/20' }, 'ACTIVE'),
                cell.isPredictive && h('span', { className: 'px-1.5 py-0.5 bg-orange-500/10 text-orange-500 text-[10px] rounded font-bold border border-orange-500/20' }, 'PREDICTIVE'),
                cell.isLearning && h('span', { className: 'px-1.5 py-0.5 bg-blue-500/10 text-blue-500 text-[10px] rounded font-bold border border-blue-500/20' }, 'LEARNING')
            ),

            h('div', { className: 'flex-1 overflow-y-auto pr-2 custom-scrollbar' },
                // Proximal (Input) Connections
                h('div', { className: 'mb-6' },
                    h('h3', { className: 'text-xs font-bold text-slate-200 border-b border-slate-700/50 pb-1 mb-2' }, 'Proximal (Column)'),
                    h('div', { className: 'grid grid-cols-2 gap-2 mb-2 p-2 bg-slate-800/30 rounded' },
                        h('div', { className: 'flex flex-col' },
                            h('span', { className: 'text-[9px] uppercase text-slate-500 font-bold' }, 'Overlap'),
                            h('span', { className: 'text-xs font-mono' }, cell.column.overlap)
                        ),
                        h('div', { className: 'flex flex-col' },
                            h('span', { className: 'text-[9px] uppercase text-slate-500 font-bold' }, 'Boost'),
                            h('span', { className: 'text-xs font-mono' }, cell.column.boost.toFixed(2))
                        )
                    ),
                    h(SynapseList, { synapses: cell.column.proximalSynapses, title: 'Input Connections' })
                ),

                // Distal Segments
                h('div', null,
                    h('h3', { className: 'text-xs font-bold text-slate-200 border-b border-slate-700/50 pb-1 mb-2' }, 'Distal (Segments)'),
                    h(SegmentList, { segments: cell.segments })
                )
            )
        );
    }

    window.CellDetailPanel = CellDetailPanel;
})();
