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
        // (A bit hacky but avoids passing props through everything for now)
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

            // Advance
            inputIdx.current++;
            setStep(s => s + 1);
        };

        // Play/Loop
        useEffect(() => {
            let interval;
            if (isPlaying) {
                interval = setInterval(performStep, 200);
            }
            return () => clearInterval(interval);
        }, [isPlaying, inputString]);

        const handleReset = () => {
            inputIdx.current = 0;
            setStep(0);
            // Re-init region?
            const region = new Region(16, 8);
            region.initialize(64);
            regionRef.current = region;
            setCurrentChar("");
        };

        // Ensure sub-components are defined
        if (!window.Controls) return h('div', null, 'Error: Controls not defined');
        if (!window.RegionView) return h('div', null, 'Error: RegionView not defined');

        return h('div', { className: 'flex flex-col gap-4' },
            h('h1', { className: 'text-2xl font-bold' }, 'HTM Prototype (Vanilla React)'),

            h(window.Controls, {
                onStep: performStep,
                onReset: handleReset,
                isPlaying,
                setIsPlaying,
                inputString,
                setInputString
            }),

            h('div', { className: 'card flex flex-col items-center' },
                h('h2', { className: 'text-xl' }, 'Current Input'),
                h('div', { className: 'text-4xl text-center font-mono my-4 text-yellow-400' },
                    currentChar || "-"
                ),
                h('div', { className: 'text-sm text-gray-400 text-center' }, `Step: ${step}`),

                h('hr', { className: 'w-full border-slate-700 my-4' }),

                h('h2', { className: 'text-xl' }, 'Next Prediction'),
                h('div', { className: 'flex flex-col items-center mt-2' },
                    h('div', { className: 'text-4xl font-mono text-green-400' },
                        prediction && prediction.char ? (prediction.char === '\n' ? '↵' : prediction.char) : "?"
                    ),
                    h('div', { className: 'text-sm text-gray-400' },
                        prediction ? `Confidence: ${(prediction.confidence * 100).toFixed(1)}%` : "Waiting..."
                    )
                )
            ),

            // Vis Row
            h('div', { className: 'flex gap-4' },
                h('div', { className: 'flex flex-col gap-4 w-1/4' },
                    h(window.Legend),
                    currentSDR && h(window.InputView, { sdr: currentSDR, char: currentChar })
                ),
                h('div', { className: 'flex-1' },
                    h(window.RegionView, { region: regionRef.current })
                )
            ),

            selectedCell && h(window.CellDetailPanel, {
                cell: selectedCell,
                onClose: () => setSelectedCell(null)
            })
        );
    }

    // Global Export
    window.App = App;
    console.log('App defined:', window.App);
})();
