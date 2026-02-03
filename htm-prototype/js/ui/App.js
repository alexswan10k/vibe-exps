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
        const [inputString, setInputString] = useState("ABCABC");
        const [currentChar, setCurrentChar] = useState("");

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
            const char = inputString[inputIdx.current % inputString.length];
            setCurrentChar(char);

            // Encode
            const sdr = encoderRef.current.encode(char);

            // Run Region
            regionRef.current.compute(sdr);

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

            h('div', { className: 'card' },
                h('h2', { className: 'text-xl' }, 'Current Input'),
                h('div', { className: 'text-4xl text-center font-mono my-4 text-yellow-400' },
                    currentChar || "-"
                ),
                h('div', { className: 'text-sm text-gray-400 text-center' }, `Step: ${step}`)
            ),

            h(window.RegionView, { region: regionRef.current })
        );
    }

    // Global Export
    window.App = App;
    console.log('App defined:', window.App);
})();
