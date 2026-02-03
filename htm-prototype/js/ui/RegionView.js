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

    function CellView({ cell }) {
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
            // Did ANY cell in this column predict?
            const columnPredicted = cell.column.cells.some(c => c.wasPredictive);
            if (!columnPredicted) {
                classes.push('unexpected');
            }
        }

        return h('div', {
            className: classes.join(' '),
            title: `Cell ${cell.index}: ${classes.join(', ')}`
        });
    }

    function ColumnView({ column }) {
        // Column overall state
        const isActive = column.isActive;

        return h('div', {
            className: `column flex-col items-center justify-center p-2 ${isActive ? 'active' : ''}`
        },
            // We render cells inside the column
            h('div', { className: 'cell-grid' },
                column.cells.map((cell, idx) =>
                    h(CellView, { key: idx, cell: cell })
                )
            )
        );
    }

    function RegionView({ region }) {
        if (!region) return null;

        return h('div', { className: 'card' },
            h('h2', { className: 'text-xl mb-4' }, 'Region Activity'),
            h('div', {
                className: 'region-grid',
                style: {
                    gridTemplateColumns: `repeat(${region.width}, 1fr)`
                }
            },
                region.columns.map((col, idx) =>
                    h(ColumnView, { key: idx, column: col })
                )
            )
        );
    }

    // Global Export
    window.RegionView = RegionView;
    console.log('RegionView defined:', window.RegionView);
})();
