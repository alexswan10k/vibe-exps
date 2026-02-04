/**
 * Main App Component
 */
console.log('Loading App.js');

(function () {
    if (typeof React === 'undefined') {
        console.error("React is undefined in App.js");
        return;
    }

    const { createElement: h, useState, useEffect, useRef } = React;

    function App() {
        const [step, setStep] = useState(0);
        const [isPlaying, setIsPlaying] = useState(false);
        const [inputString, setInputString] = useState(
            "Once upon a time, there was a sophisticated AI. " +
            "The AI loved to learn. The AI loved to predict. " +
            "It saw patterns everywhere. It saw the future."
        );
        const [currentChar, setCurrentChar] = useState("");
        const [currentSDR, setCurrentSDR] = useState(null);
        const [prediction, setPrediction] = useState(null);
        const [selectedCell, setSelectedCell] = useState(null);
        const [hoveredColIdx, setHoveredColIdx] = useState(null);
        const [hoveredCellPos, setHoveredCellPos] = useState(null); // {col: x, cell: y}

        const [showAllConnections, setShowAllConnections] = useState(false);

        // Expose selection/hover handlers globally
        useEffect(() => {
            window.onCellClick = (cell) => setSelectedCell(cell);
            window.onCellHover = (cell) => setHoveredCellPos(cell ? { col: cell.column.index, cell: cell.index } : null);
            window.onColumnHover = (idx) => setHoveredColIdx(idx);

            // For hovering input bits
            window.onInputBitHover = (idx) => setHoveredInputBit(idx);
        }, []);

        const [hoveredInputBit, setHoveredInputBit] = useState(null);

        // Refs for HTM objects to persist across renders
        const regionRef = useRef(null);
        const encoderRef = useRef(null);
        const inputIdx = useRef(0);

        // Initialization
        useEffect(() => {
            const inputSize = 64;
            encoderRef.current = new Encoder(inputSize);

            const region = new Region(16, 8); // 16x8 = 128 cols
            region.initialize(inputSize);
            regionRef.current = region;

            // Force re-render
            setStep(1);
        }, []);

        // Step Logic
        const performStep = () => {
            if (!regionRef.current || !inputString) return;

            // Get current character
            if (inputString.length === 0) return;
            const char = inputString[inputIdx.current % inputString.length];
            setCurrentChar(char === '\n' ? '↵' : char);

            // Encode
            const sdr = encoderRef.current.encode(char);
            setCurrentSDR(sdr);

            // Run Region
            regionRef.current.compute(sdr);

            // Decode Prediction for *NEXT* step
            const predictedIndices = regionRef.current.getPredictedColumnIndices();
            const decoded = encoderRef.current.decode(predictedIndices);
            setPrediction(decoded);

            // Update selected cell if it exists (to refresh data in panel)
            if (selectedCell) {
                // Find the updated cell object in the current region state
                const updatedCol = regionRef.current.columns[selectedCell.column.index];
                const updatedCell = updatedCol.cells[selectedCell.index];
                setSelectedCell(updatedCell);
            }

            // Advance
            inputIdx.current++;
            setStep(s => s + 1);
        };

        // Play/Loop
        useEffect(() => {
            let interval;
            if (isPlaying) {
                interval = setInterval(performStep, 150);
            }
            return () => clearInterval(interval);
        }, [isPlaying, inputString, selectedCell]); // Re-bind when selection changes to ensure update loop

        const handleReset = () => {
            inputIdx.current = 0;
            setStep(0);
            const region = new Region(16, 8);
            region.initialize(64);
            regionRef.current = region;
            setCurrentChar("");
            setSelectedCell(null);
        };

        // Ensure sub-components are defined
        if (!window.Controls) return h('div', null, 'Error: Controls not defined');
        if (!window.RegionView) return h('div', null, 'Error: RegionView not defined');

        return [
            h('header', { className: 'flex justify-between items-center' },
                h('div', null,
                    h('h1', { className: 'text-2xl font-bold m-0' }, 'HTM Prototype'),
                    h('div', { className: 'text-sm text-slate-400' }, `Step: ${step}`)
                ),
                h(window.Controls, {
                    onStep: performStep,
                    onReset: handleReset,
                    isPlaying,
                    setIsPlaying,
                    inputString,
                    setInputString
                }),
                h('button', {
                    className: `btn ${showAllConnections ? '' : 'btn-secondary'} ml-2`,
                    onClick: () => setShowAllConnections(!showAllConnections),
                    title: 'Toggle all connection lines'
                }, showAllConnections ? 'Hide Lines' : 'Show All Lines')
            ),

            h('main', { className: 'main-layout' },
                // Zone 1: Dashboard Row (Top)
                h('div', { className: 'dashboard-row' },
                    h('div', { className: 'card glass flex items-center justify-center min-w-[100px]' },
                        h('div', { className: 'text-center' },
                            h('h2', { className: 'text-[9px] uppercase tracking-wider text-slate-500 mb-1' }, 'Input'),
                            h('div', { className: 'text-3xl font-mono text-yellow-500' }, currentChar || "-")
                        )
                    ),
                    h('div', { className: 'card glass flex items-center justify-center min-w-[140px]', 'data-prediction-card': true },
                        h('div', { className: 'text-center' },
                            h('h2', { className: 'text-[9px] uppercase tracking-wider text-slate-500 mb-1' }, 'Prediction'),
                            h('div', { className: 'text-3xl font-mono text-green-500' },
                                prediction && prediction.char ? (prediction.char === '\n' ? '↵' : prediction.char) : "?"
                            )
                        )
                    ),
                    h('div', { className: 'flex-1' },
                        h(window.InputView, {
                            sdr: currentSDR || new Array(64).fill(false),
                            char: currentChar || " ",
                            highlightedBits: (function () {
                                const colIdx = hoveredColIdx !== null ? hoveredColIdx : (selectedCell ? selectedCell.column.index : null);
                                if (colIdx !== null && regionRef.current) {
                                    const col = regionRef.current.columns[colIdx];
                                    return col.proximalSynapses.filter(s => s.isConnected).map(s => s.inputSource.index);
                                }
                                return [];
                            })()
                        })
                    )
                ),

                // Zone 2 & 3: Content Row (Middle/Bottom)
                h('div', { className: 'content-row' },
                    // Visualizer
                    h('div', { className: 'visualizer-zone' },
                        h(window.RegionView, {
                            region: regionRef.current,
                            selectedCell,
                            hoveredColIdx,
                            hoveredCellPos,
                            hoveredInputBit
                        })
                    ),

                    // Sidebar
                    h('aside', { className: 'sidebar-zone' },
                        h('div', { className: 'card glass p-0 overflow-hidden shrink-0' },
                            h(window.Legend)
                        ),
                        h('div', { className: 'flex-1 min-h-0 sidebar-scroll' },
                            selectedCell ?
                                h(window.CellDetailPanel, {
                                    cell: selectedCell,
                                    onClose: () => setSelectedCell(null)
                                }) :
                                h('div', { className: 'card glass h-full flex items-center justify-center text-slate-500 italic text-center p-6' },
                                    'Select a cell to inspect connections'
                                )
                        )
                    )
                ),

                // SVG Overlay
                h(window.ConnectionLines, {
                    region: regionRef.current,
                    selectedCell,
                    hoveredColIdx,
                    hoveredCellPos,
                    hoveredInputBit,
                    showAll: showAllConnections
                })
            )
        ];
    }

    // Global Export
    window.App = App;
    console.log('App defined:', window.App);
})();
