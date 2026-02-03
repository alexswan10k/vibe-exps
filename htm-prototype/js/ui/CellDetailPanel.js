/**
 * Cell Detail Panel Component
 */
(function () {
    const { createElement: h } = React;

    function SynapseList({ synapses, title }) {
        if (!synapses || synapses.length === 0) return null;

        return h('div', { className: 'mt-2' },
            h('h4', { className: 'text-sm font-bold text-slate-300' }, title),
            h('div', { className: 'max-h-32 overflow-y-auto bg-slate-800 p-2 rounded text-xs font-mono' },
                synapses.map((syn, idx) =>
                    h('div', { key: idx, className: 'flex justify-between' },
                        h('span', { className: syn.isActive ? 'text-yellow-400' : 'text-slate-500' },
                            `Source: ${syn.inputSource.index || 'Input'}`
                        ),
                        h('span', { className: syn.permanence >= 0.2 ? 'text-green-400' : 'text-red-400' },
                            `Perm: ${syn.permanence.toFixed(3)}`
                        )
                    )
                )
            )
        );
    }

    function SegmentList({ segments }) {
        if (!segments || segments.length === 0) {
            return h('div', { className: 'text-sm text-slate-500 italic mt-2' }, 'No distal segments.');
        }

        return h('div', { className: 'mt-2' },
            h('h4', { className: 'text-sm font-bold text-slate-300' }, 'Distal Segments'),
            segments.map((seg, idx) =>
                h('div', { key: idx, className: 'border border-slate-700 p-2 mb-1 rounded' },
                    h('div', { className: 'flex justify-between text-xs' },
                        h('span', null, `Segment ${idx}`),
                        h('span', { className: seg.isActive ? 'text-yellow-400' : 'text-slate-500' },
                            `Active: ${seg.getActiveSynapseCount()}`
                        )
                    ),
                    h(SynapseList, { synapses: seg.synapses, title: 'Synapses' })
                )
            )
        );
    }

    function CellDetailPanel({ cell, onClose }) {
        if (!cell) return null;

        return h('div', { className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50', onClick: onClose },
            h('div', {
                className: 'bg-slate-900 border border-slate-700 p-4 rounded shadow-xl w-96 max-h-[80vh] overflow-y-auto',
                onClick: (e) => e.stopPropagation() // Prevent close when clicking panel
            },
                h('div', { className: 'flex justify-between items-center mb-4' },
                    h('h2', { className: 'text-xl font-bold' }, `Cell Inspector`),
                    h('button', { className: 'text-slate-400 hover:text-white', onClick: onClose }, '✕')
                ),

                h('div', { className: 'mb-4' },
                    h('div', { className: 'text-lg' }, `Column: ${cell.column.index}, Cell: ${cell.index}`),
                    h('div', { className: 'flex gap-2 mt-2' },
                        cell.isActive && h('span', { className: 'px-2 py-1 bg-yellow-500 text-black text-xs rounded font-bold' }, 'ACTIVE'),
                        cell.isPredictive && h('span', { className: 'px-2 py-1 bg-orange-500 text-black text-xs rounded font-bold' }, 'PREDICTIVE'),
                        cell.isLearning && h('span', { className: 'px-2 py-1 bg-blue-500 text-white text-xs rounded font-bold' }, 'LEARNING'),
                        !cell.isActive && !cell.isPredictive && h('span', { className: 'text-slate-500 text-sm' }, 'No Activity')
                    )
                ),

                h('hr', { className: 'border-slate-700 my-4' }),

                // Proximal (Input) Connections (Column Level)
                h('h3', { className: 'text-md font-bold text-slate-200' }, 'Proximal Connections (Column)'),
                h('div', { className: 'text-xs text-slate-400 mb-2' }, `Overlap: ${cell.column.overlap}, Boost: ${cell.column.boost.toFixed(2)}`),
                h(SynapseList, { synapses: cell.column.proximalSynapses, title: 'Input Synapses' }),

                h('hr', { className: 'border-slate-700 my-4' }),

                // Distal Segments
                h('h3', { className: 'text-md font-bold text-slate-200' }, 'Distal Connections (Segments)'),
                h(SegmentList, { segments: cell.segments })
            )
        );
    }

    window.CellDetailPanel = CellDetailPanel;
})();
