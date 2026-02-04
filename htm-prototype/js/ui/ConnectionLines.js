/**
 * SVG Connection Lines Component
 * Renders lines between input bits, columns, and cells based on HTM connectivity.
 */
(function () {
    const { createElement: h, useState, useEffect, useLayoutEffect, useRef } = React;

    function ConnectionLines({ region, selectedCell, hoveredColIdx, hoveredCellPos, hoveredInputBit, showAll = false }) {
        const [tick, setTick] = useState(0);
        const svgRef = useRef(null);

        // Force a re-render after mount to ensure DOM elements are actually there
        useLayoutEffect(() => {
            const timer = setTimeout(() => setTick(t => t + 1), 50);
            return () => clearTimeout(timer);
        }, [region, selectedCell, hoveredColIdx, hoveredCellPos, hoveredInputBit, showAll]);

        // Helper to get center of an element
        const getCenter = (selector) => {
            if (!svgRef.current) return null;
            const el = document.querySelector(selector);
            if (!el) return null;

            const rect = el.getBoundingClientRect();
            const svgRect = svgRef.current.getBoundingClientRect();

            // If the element has no size, it's not ready
            if (rect.width === 0 || rect.height === 0) return null;

            return {
                x: rect.left + rect.width / 2 - svgRect.left,
                y: rect.top + rect.height / 2 - svgRect.top
            };
        };

        useEffect(() => {
            const handleResize = () => setTick(t => t + 1);
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }, []);

        if (!region) return null;

        // Render empty SVG if ref not ready yet
        if (!svgRef.current) {
            return h('svg', {
                ref: svgRef,
                className: 'absolute inset-0 pointer-events-none w-full h-full z-0',
                style: { minHeight: '100%', pointerEvents: 'none' }
            });
        }

        const lines = [];

        // 1. Proximal Connections (Input bits -> Columns)
        // Only show for selected/hovered column to keep it clean (or if showAll)
        const focusColIdx = hoveredColIdx !== null ? hoveredColIdx : (selectedCell ? selectedCell.column.index : null);

        region.columns.forEach((col, cIdx) => {
            const isFocused = cIdx === focusColIdx;
            if (showAll || isFocused) {
                const colCenter = getCenter(`[data-col-idx="${cIdx}"]`);
                if (!colCenter) return;

                col.proximalSynapses.forEach(syn => {
                    if (syn.isConnected) {
                        const bitIdx = syn.inputSource.index;
                        const bitCenter = getCenter(`[data-bit-idx="${bitIdx}"]`);
                        if (bitCenter) {
                            lines.push(h('line', {
                                key: `prox-${cIdx}-${bitIdx}`,
                                x1: bitCenter.x,
                                y1: bitCenter.y,
                                x2: colCenter.x,
                                y2: colCenter.y,
                                stroke: 'rgba(34, 211, 238, 0.4)', // Cyan
                                strokeWidth: isFocused ? 2 : 0.5,
                                strokeDasharray: isFocused ? '' : '2 2'
                            }));
                        }
                    }
                });
            }
        });

        // 2. Distal Connections (Cells -> Cells)
        const focusCell = hoveredCellPos || (selectedCell ? { col: selectedCell.column.index, cell: selectedCell.index } : null);

        region.columns.forEach((col, cIdx) => {
            col.cells.forEach((cell, cellIdx) => {
                const isFocused = focusCell && focusCell.col === cIdx && focusCell.cell === cellIdx;
                if (showAll || isFocused) {
                    const targetCenter = getCenter(`[data-col-idx="${cIdx}"][data-cell-idx="${cellIdx}"]`);
                    if (!targetCenter) return;

                    cell.segments.forEach((seg, sIdx) => {
                        seg.synapses.forEach((syn, synIdx) => {
                            if (syn.isConnected && syn.inputSource instanceof Cell) {
                                const sourceCell = syn.inputSource;
                                const sourceCenter = getCenter(`[data-col-idx="${sourceCell.column.index}"][data-cell-idx="${sourceCell.index}"]`);

                                if (sourceCenter) {
                                    // Use bezier curve for distal to make it look "organic"
                                    const midX = (sourceCenter.x + targetCenter.x) / 2;
                                    const midY = (sourceCenter.y + targetCenter.y) / 2 - 20; // Arc upwards

                                    lines.push(h('path', {
                                        key: `distal-${cIdx}-${cellIdx}-${sourceCell.column.index}-${sourceCell.index}`,
                                        d: `M ${sourceCenter.x} ${sourceCenter.y} Q ${midX} ${midY} ${targetCenter.x} ${targetCenter.y}`,
                                        fill: 'none',
                                        stroke: 'rgba(168, 85, 247, 0.4)', // Purple
                                        strokeWidth: isFocused ? 1.5 : 0.3,
                                        opacity: isFocused ? 1 : 0.5
                                    }));
                                }
                            }
                        });
                    });
                }
            });
        });

        // 3. Prediction Connections (Predictive Cells -> Prediction UI)
        const predictionCenter = getCenter('[data-prediction-card]');
        if (predictionCenter) {
            region.columns.forEach((col, cIdx) => {
                col.cells.forEach((cell, cellIdx) => {
                    if (cell.isPredictive) {
                        const cellCenter = getCenter(`[data-col-idx="${cIdx}"][data-cell-idx="${cellIdx}"]`);
                        if (cellCenter) {
                            lines.push(h('line', {
                                key: `pred-${cIdx}-${cellIdx}`,
                                x1: cellCenter.x,
                                y1: cellCenter.y,
                                x2: predictionCenter.x,
                                y2: predictionCenter.y,
                                stroke: 'rgba(34, 197, 94, 0.4)', // Green
                                strokeWidth: 1,
                                strokeDasharray: '4 4'
                            }));
                        }
                    }
                });
            });
        }

        return h('svg', {
            ref: svgRef,
            className: 'absolute inset-0 pointer-events-none w-full h-full z-0',
            style: { height: '100%', pointerEvents: 'none', overflow: 'visible' }
        }, lines);
    }

    window.ConnectionLines = ConnectionLines;
})();
