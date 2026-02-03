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

        // Expose selection handler globally for RegionView to call
        useEffect(() => {
            window.onCellClick = (cell) => setSelectedCell(cell);
        }, []);

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

        return h('div', { className: 'container' },
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
                })
            ),

            h('main', { className: 'main-layout' },
                // Left Column: visualization and input stats
                h('div', { className: 'flex flex-col gap-6' },
                    // Top stats row
                    h('div', { className: 'flex gap-6' },
                        h('div', { className: 'card flex-1 flex flex-col items-center glass' },
                            h('h2', { className: 'text-xs uppercase tracking-wider text-slate-400 mb-2' }, 'Current Input'),
                            h('div', { className: 'text-5xl font-mono text-yellow-400' },
                                currentChar || "-"
                            )
                        ),
                        h('div', { className: 'card flex-1 flex flex-col items-center glass' },
                            h('h2', { className: 'text-xs uppercase tracking-wider text-slate-400 mb-2' }, 'Next Prediction'),
                            h('div', { className: 'text-5xl font-mono text-green-400' },
                                prediction && prediction.char ? (prediction.char === '\n' ? '↵' : prediction.char) : "?"
                            ),
                            h('div', { className: 'text-xs text-slate-400 mt-1' },
                                prediction ? `${(prediction.confidence * 100).toFixed(0)}% confidence` : "..."
                            )
                        )
                    ),

                    // Visualization
                    h(window.RegionView, {
                        region: regionRef.current,
                        selectedCell: selectedCell
                    }),

                    h('div', { className: 'flex gap-6' },
                        h('div', { className: 'w-64' }, h(window.Legend)),
                        currentSDR && h('div', { className: 'flex-1' },
                            h(window.InputView, { sdr: currentSDR, char: currentChar })
                        )
                    )
                ),

                // Right Column: Detail Panel
                h('aside', { className: 'sidebar' },
                    selectedCell ?
                        h(window.CellDetailPanel, {
                            cell: selectedCell,
                            onClose: () => setSelectedCell(null)
                        }) :
                        h('div', { className: 'card glass h-full flex items-center justify-center text-slate-500 italic text-center' },
                            'Click a cell to inspect its synapses and state'
                        )
                )
            )
        );
    }

    // Global Export
    window.App = App;
    console.log('App defined:', window.App);
})();
