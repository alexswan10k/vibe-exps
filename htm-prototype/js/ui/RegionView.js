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

    function CellView({ cell, isSelected, isRelated, isFocusCol, colIdx }) {
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
        if (isRelated) classes.push('related');

        let style = {};
        if (isFocusCol && !isSelected && !isRelated) {
            style = { border: '1px solid rgba(255,255,255,0.1)' };
        }

        return h('div', {
            className: classes.join(' '),
            'data-col-idx': colIdx,
            'data-cell-idx': cell.index,
            title: `Cell ${cell.index}\nCol: ${cell.column.index}\n${classes.join(', ')}`,
            style: style,
            onMouseEnter: () => window.onCellHover && window.onCellHover(cell),
            onMouseLeave: () => window.onCellHover && window.onCellHover(null),
            onClick: (e) => {
                e.stopPropagation();
                if (window.onCellClick) window.onCellClick(cell);
            }
        });
    }

    function ColumnView({ column, selectedCell, hoveredColIdx, hoveredInputBit, isRelated }) {
        const isActive = column.isActive;
        const isSelected = selectedCell && selectedCell.column.index === column.index;
        const isHovered = hoveredColIdx === column.index;

        const isConnectedToInput = hoveredInputBit !== null && column.proximalSynapses.some(
            syn => syn.isConnected && syn.inputSource.index === hoveredInputBit
        );

        const focusClass = (isSelected || isHovered || isConnectedToInput) ? 'focused' : '';

        return h('div', {
            className: `column flex-col items-center justify-center ${isActive ? 'active-col' : ''} ${focusClass}`,
            'data-col-idx': column.index,
            style: isConnectedToInput ? { borderColor: 'hsl(180, 70%, 50%)', background: 'rgba(6, 182, 212, 0.1)' } : {},
            onMouseEnter: () => window.onColumnHover && window.onColumnHover(column.index),
            onMouseLeave: () => window.onColumnHover && window.onColumnHover(null),
            onClick: () => {
                if (!isSelected && window.onCellClick) {
                    window.onCellClick(column.cells[0]);
                }
            }
        },
            h('div', { className: 'cell-grid' },
                column.cells.map((cell, idx) => {
                    const cellIsSelected = isSelected && selectedCell.index === idx;
                    const cellIsRelated = isRelated && isRelated.includes(cell);
                    return h(CellView, {
                        key: idx,
                        colIdx: column.index,
                        cell: cell,
                        isSelected: cellIsSelected,
                        isRelated: cellIsRelated,
                        isFocusCol: isSelected || isHovered
                    });
                })
            )
        );
    }

    function RegionView({ region, selectedCell, hoveredColIdx, hoveredCellPos, hoveredInputBit }) {
        if (!region) return null;

        // Determine "Related Cells" for distal connections
        const relatedCells = (function () {
            const focus = hoveredCellPos || (selectedCell ? { col: selectedCell.column.index, cell: selectedCell.index } : null);
            if (focus && region) {
                const cell = region.columns[focus.col].cells[focus.cell];
                const sources = [];
                cell.segments.forEach(seg => {
                    seg.synapses.forEach(syn => {
                        if (syn.isConnected && syn.inputSource instanceof Cell) {
                            sources.push(syn.inputSource);
                        }
                    });
                });
                return sources;
            }
            return [];
        })();

        return h('div', { className: 'card glass relative p-4 h-full flex flex-col' },
            h('div', { className: 'flex justify-between items-center mb-2' },
                h('h2', { className: 'text-[10px] font-bold uppercase tracking-widest text-slate-500' }, 'Network Activity'),
                h('div', { className: 'text-[9px] text-slate-600 uppercase' },
                    hoveredInputBit !== null ? `Bit ${hoveredInputBit}` : 'Hover cells for connections'
                )
            ),
            h('div', {
                className: 'region-grid flex-1',
                style: {
                    gridTemplateColumns: `repeat(${region.width}, 1fr)`
                }
            },
                region.columns.map((col, idx) =>
                    h(ColumnView, {
                        key: idx,
                        column: col,
                        selectedCell: selectedCell,
                        hoveredColIdx: hoveredColIdx,
                        hoveredInputBit: hoveredInputBit,
                        isRelated: relatedCells
                    })
                )
            )
        );
    }

    // Global Export
    window.RegionView = RegionView;
    console.log('RegionView defined:', window.RegionView);
})();
