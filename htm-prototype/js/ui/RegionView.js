/**
 * Region Visualization Components
 */
console.log('Loading RegionView.js');

(function () {
    if (typeof React === 'undefined') {
        console.error("React is undefined in RegionView.js");
        return;
    }

    const { createElement: h } = React;

    function CellView({ cell, isSelected }) {
        // Determine class based on state
        let classes = ['cell'];
        if (cell.isActive) classes.push('active');
        if (cell.isPredictive) classes.push('predictive');

        // Check for correct prediction (Active AND wasPredictive)
        if (cell.isActive && cell.wasPredictive) {
            classes.push('correct');
        }

        // Check active but not predicted (Unexpected)
        if (cell.isActive && !cell.wasPredictive) {
            const columnPredicted = cell.column.cells.some(c => c.wasPredictive);
            if (!columnPredicted) {
                classes.push('unexpected');
            }
        }

        if (isSelected) classes.push('selected');

        return h('div', {
            className: classes.join(' '),
            title: `Cell ${cell.index}\nCol: ${cell.column.index}\n${classes.join(', ')}`,
            style: isSelected ? { ring: '2px solid white', transform: 'scale(1.1)', zIndex: 10 } : {},
            onClick: (e) => {
                e.stopPropagation();
                if (window.onCellClick) window.onCellClick(cell);
            }
        });
    }

    function ColumnView({ column, selectedCell }) {
        const isActive = column.isActive;
        const isFocused = selectedCell && selectedCell.column.index === column.index;

        return h('div', {
            className: `column flex-col items-center justify-center ${isActive ? 'active-col' : ''} ${isFocused ? 'focused' : ''}`,
            onClick: () => {
                // Focus first cell in column if not already looking at this column
                if (!isFocused && window.onCellClick) {
                    window.onCellClick(column.cells[0]);
                }
            }
        },
            h('div', { className: 'cell-grid' },
                column.cells.map((cell, idx) =>
                    h(CellView, {
                        key: idx,
                        cell: cell,
                        isSelected: selectedCell && selectedCell.column.index === column.index && selectedCell.index === idx
                    })
                )
            )
        );
    }

    function RegionView({ region, selectedCell }) {
        if (!region) return null;

        return h('div', { className: 'card glass relative p-6' },
            h('div', { className: 'flex justify-between items-center mb-4' },
                h('h2', { className: 'text-sm font-bold uppercase tracking-widest text-slate-400' }, 'Network Activity'),
                h('div', { className: 'text-[10px] text-slate-500 uppercase' },
                    'Click cells to inspect architecture'
                )
            ),
            h('div', {
                className: 'region-grid',
                style: {
                    gridTemplateColumns: `repeat(${region.width}, 1fr)`
                }
            },
                region.columns.map((col, idx) =>
                    h(ColumnView, {
                        key: idx,
                        column: col,
                        selectedCell: selectedCell
                    })
                )
            )
        );
    }

    // Global Export
    window.RegionView = RegionView;
    console.log('RegionView defined:', window.RegionView);
})();
