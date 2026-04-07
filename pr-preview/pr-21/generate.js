const fs = require('fs');

let html = fs.readFileSync('modular-synth/index.html', 'utf8');

// We will inject CSS
const cssToInject = `
        /* Keyboard */
        .keyboard {
            display: flex;
            height: 80px;
            margin-top: 10px;
            border: 1px solid #111;
            background: #222;
            padding: 2px;
            border-radius: 4px;
            position: relative;
        }
        .key {
            flex: 1;
            background: white;
            margin: 1px;
            border-radius: 0 0 3px 3px;
            cursor: pointer;
            box-sizing: border-box;
            border: 1px solid #ccc;
        }
        .key.active { background: #ddd; }
        .key.black {
            background: black;
            height: 60%;
            width: 8%;
            position: absolute;
            top: 2px;
            margin-left: -4%;
            z-index: 2;
            border-radius: 0 0 2px 2px;
        }
        .key.black.active { background: #333; }

        /* Sequencer */
        .step-col {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 5px;
        }
        .step-knob-container {
            transform: scale(0.7);
            height: 40px;
        }

        /* Dragging Cable */
        .dragging-cable {
            pointer-events: none;
            stroke: #fff;
            stroke-dasharray: 5,5;
            opacity: 0.8;
            stroke-width: 3;
            fill: none;
        }
`;

html = html.replace('</style>', cssToInject + '\n    </style>');

// Inject modules
const modulesToInject = `
            delay: {
                name: 'Delay',
                width: 180,
                controls: [
                    { id: 'time', name: 'Time', type: 'knob', default: 0.3 },
                    { id: 'fb', name: 'Fback', type: 'knob', default: 0.4 },
                    { id: 'mix', name: 'Mix', type: 'knob', default: 0.3 }
                ],
                inputs: [
                    { id: 'in', name: 'In' }
                ],
                outputs: [
                    { id: 'out', name: 'Out' }
                ]
            },
            keyboard: {
                name: 'Keyboard',
                width: 260,
                controls: [],
                inputs: [],
                outputs: [
                    { id: 'cv', name: 'CV' },
                    { id: 'gate', name: 'Gate' }
                ]
            },
            midi_in: {
                name: 'MIDI In',
                width: 140,
                controls: [],
                inputs: [],
                outputs: [
                    { id: 'cv', name: 'CV' },
                    { id: 'gate', name: 'Gate' }
                ]
            },`;
html = html.replace("vcf: {", modulesToInject + '\n            vcf: {');

// Update sequencer def
html = html.replace(
    "name: 'Sequencer',\n                width: 220,",
    "name: 'Sequencer',\n                width: 320,"
);

// We need to overwrite the AudioEngine logic for oscillator V/Oct, VCA scaling, and Delay node.
const audioEngineStart = `class AudioEngine {`;
const audioEngineEnd = `// --- React Components ---`;

const newAudioEngine = `
        class AudioEngine {
            constructor() {
                this.ctx = null;
                this.nodes = new Map();
                this.initialized = false;
            }

            async init() {
                if (this.initialized) {
                    if (this.ctx && this.ctx.state === 'suspended') {
                        await this.ctx.resume();
                    }
                    return;
                }
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AudioContext();
                this.initialized = true;
            }

            createModule(module) {
                if (!this.ctx) return;
                const id = module.id;

                switch(module.type) {
                    case 'oscillator': {
                        const osc = this.ctx.createOscillator();
                        const oscGain = this.ctx.createGain();
                        const fmGain = this.ctx.createGain();
                        const voctGain = this.ctx.createGain();

                        osc.type = 'sine';
                        osc.start();
                        osc.connect(oscGain);

                        fmGain.gain.value = 500;
                        fmGain.connect(osc.frequency);

                        // 1V/Oct scaling: Assume CV 0-1 maps to 0-5V.
                        // 1V = 1 octave = 1200 cents. Max 5 octaves = 6000 cents.
                        voctGain.gain.value = 6000;
                        voctGain.connect(osc.detune);

                        // Base pitch at C2 (65.4 Hz)
                        osc.frequency.value = 65.4;

                        this.nodes.set(id, {
                            main: oscGain,
                            inputs: { voct: voctGain, fm: fmGain },
                            core: osc
                        });
                        break;
                    }
                    case 'vcf': {
                        const filter = this.ctx.createBiquadFilter();
                        const modGain = this.ctx.createGain();

                        filter.type = 'lowpass';
                        modGain.connect(filter.frequency);
                        modGain.gain.value = 5000; // wider sweep

                        this.nodes.set(id, {
                            main: filter,
                            inputs: { in: filter, mod: modGain },
                            core: filter
                        });
                        break;
                    }
                    case 'vca': {
                        const vca = this.ctx.createGain();
                        const cvGain = this.ctx.createGain();
                        vca.gain.value = 0;

                        // Using linear mapping. CV scales the VCA gain directly.
                        cvGain.connect(vca.gain);

                        this.nodes.set(id, {
                            main: vca,
                            inputs: { in: vca, cv: cvGain },
                            core: vca
                        });
                        break;
                    }
                    case 'envelope': {
                        const envOut = this.ctx.createConstantSource();
                        envOut.offset.value = 0;
                        envOut.start();
                        this.nodes.set(id, {
                            main: envOut,
                            inputs: { gate: null },
                            core: envOut,
                            params: { a:0.1, d:0.2, s:0.5, r:0.3 }
                        });
                        break;
                    }
                    case 'mixer': {
                        const master = this.ctx.createGain();
                        const ch1 = this.ctx.createGain();
                        const ch2 = this.ctx.createGain();
                        const ch3 = this.ctx.createGain();
                        ch1.connect(master);
                        ch2.connect(master);
                        ch3.connect(master);
                        this.nodes.set(id, {
                            main: master,
                            inputs: { in1: ch1, in2: ch2, in3: ch3 },
                            chGains: [ch1, ch2, ch3]
                        });
                        break;
                    }
                    case 'lfo': {
                        const lfo = this.ctx.createOscillator();
                        const lfoAmp = this.ctx.createGain();
                        lfo.connect(lfoAmp);
                        lfo.start();
                        this.nodes.set(id, { main: lfoAmp, core: lfo, amp: lfoAmp });
                        break;
                    }
                    case 'output': {
                        const outGain = this.ctx.createGain();
                        outGain.connect(this.ctx.destination);
                        this.nodes.set(id, { main: null, inputs: { in: outGain }, core: outGain });
                        break;
                    }
                    case 'oscilloscope': {
                        const analyser = this.ctx.createAnalyser();
                        analyser.fftSize = 2048;
                        this.nodes.set(id, { main: null, inputs: { in: analyser }, core: analyser });
                        break;
                    }
                    case 'sequencer':
                    case 'keyboard':
                    case 'midi_in': {
                        const cv = this.ctx.createConstantSource();
                        const gate = this.ctx.createConstantSource();
                        cv.start();
                        gate.start();
                        cv.offset.value = 0;
                        gate.offset.value = 0;
                        this.nodes.set(id, { main: null, outputs: { cv, gate }, inputs: {} });
                        break;
                    }
                    case 'delay': {
                        const delayNode = this.ctx.createDelay(5.0); // max 5s
                        const fbGain = this.ctx.createGain();
                        const mixGainDry = this.ctx.createGain();
                        const mixGainWet = this.ctx.createGain();
                        const outGain = this.ctx.createGain();
                        const inGain = this.ctx.createGain();

                        // Routing
                        inGain.connect(mixGainDry);
                        inGain.connect(delayNode);

                        delayNode.connect(fbGain);
                        fbGain.connect(delayNode); // feedback loop

                        delayNode.connect(mixGainWet);

                        mixGainDry.connect(outGain);
                        mixGainWet.connect(outGain);

                        this.nodes.set(id, {
                            main: outGain,
                            inputs: { in: inGain },
                            core: { delayNode, fbGain, mixGainDry, mixGainWet }
                        });
                        break;
                    }
                }
            }

            updateModule(module) {
                if (!this.ctx || !this.nodes.has(module.id)) return;
                const nodeData = this.nodes.get(module.id);
                const getVal = (id) => {
                    const c = module.controls.find(c => c.id === id);
                    return c ? c.value : 0;
                }

                switch(module.type) {
                    case 'oscillator':
                        const freqVal = getVal('freq'); // Knob acts as manual pitch offset (detune)
                        const waveVal = getVal('wave');

                        // We use the knob to offset detune by another 2 octaves
                        const baseDetune = (freqVal - 0.5) * 2400;
                        nodeData.core.detune.setTargetAtTime(baseDetune, this.ctx.currentTime, 0.05);

                        if (waveVal < 0.25) nodeData.core.type = 'sine';
                        else if (waveVal < 0.5) nodeData.core.type = 'triangle';
                        else if (waveVal < 0.75) nodeData.core.type = 'square';
                        else nodeData.core.type = 'sawtooth';
                        break;

                    case 'vcf':
                        const cutoff = getVal('cutoff');
                        const res = getVal('res');
                        // Min 20Hz, max 10kHz exponential mapping
                        const freq = 20 * Math.pow(500, cutoff);
                        nodeData.core.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
                        nodeData.core.Q.value = res * 20;
                        break;

                    case 'vca':
                        nodeData.core.gain.setTargetAtTime(getVal('level'), this.ctx.currentTime, 0.05);
                        break;

                    case 'mixer':
                        nodeData.chGains[0].gain.value = getVal('lvl1');
                        nodeData.chGains[1].gain.value = getVal('lvl2');
                        nodeData.chGains[2].gain.value = getVal('lvl3');
                        nodeData.main.gain.value = getVal('master');
                        break;

                    case 'lfo':
                        const lfoFreq = 0.1 + (getVal('freq') * 20);
                        nodeData.core.frequency.value = lfoFreq;
                        nodeData.amp.gain.value = getVal('amt') * 1000;
                        break;

                    case 'output':
                        nodeData.core.gain.value = getVal('vol');
                        break;

                    case 'envelope':
                        nodeData.params = {
                            a: getVal('a') * 2,
                            d: getVal('d') * 2,
                            s: getVal('s'),
                            r: getVal('r') * 3
                        };
                        break;

                    case 'delay':
                        const t = getVal('time') * 2.0; // max 2s
                        const fb = getVal('fb') * 0.95; // max 0.95
                        const mix = getVal('mix');

                        nodeData.core.delayNode.delayTime.setTargetAtTime(t + 0.001, this.ctx.currentTime, 0.05);
                        nodeData.core.fbGain.gain.setTargetAtTime(fb, this.ctx.currentTime, 0.05);
                        nodeData.core.mixGainDry.gain.setTargetAtTime(1 - mix, this.ctx.currentTime, 0.05);
                        nodeData.core.mixGainWet.gain.setTargetAtTime(mix, this.ctx.currentTime, 0.05);
                        break;
                }
            }

            triggerEnvelope(moduleId, gateOpen) {
                if (!this.ctx) return;
                const nodeData = this.nodes.get(moduleId);
                if (!nodeData || !nodeData.params) return;

                const { a, d, s, r } = nodeData.params;
                const now = this.ctx.currentTime;
                const target = nodeData.core.offset;

                target.cancelScheduledValues(now);

                if (gateOpen) {
                    target.setValueAtTime(target.value, now);
                    // Attack
                    target.linearRampToValueAtTime(1, now + a + 0.005);
                    // Decay
                    target.linearRampToValueAtTime(s, now + a + d + 0.005);
                } else {
                    target.setValueAtTime(target.value, now);
                    target.linearRampToValueAtTime(0, now + r + 0.005);
                }
            }

            updateCVGate(moduleId, cvValue, gateValue) {
                const nodeData = this.nodes.get(moduleId);
                if (nodeData && nodeData.outputs) {
                    if (cvValue !== null) nodeData.outputs.cv.offset.setTargetAtTime(cvValue, this.ctx.currentTime, 0.01);
                    if (gateValue !== null) nodeData.outputs.gate.offset.setTargetAtTime(gateValue, this.ctx.currentTime, 0.01);
                }
            }

            connect(fromId, fromPatch, toId, toPatch) {
                const source = this.nodes.get(fromId);
                const dest = this.nodes.get(toId);
                if (!source || !dest) return;

                let srcNode = source.main;
                if (source.outputs && source.outputs[fromPatch]) srcNode = source.outputs[fromPatch];

                let dstNode = null;
                if (dest.inputs && dest.inputs[toPatch]) {
                    dstNode = dest.inputs[toPatch];
                } else if (toPatch === 'gate' && dest.inputs.gate === null) {
                    return;
                }

                if (srcNode && dstNode) {
                    try { srcNode.connect(dstNode); } catch(e) { console.error(e) }
                }
            }

            disconnectAll() {
                if(!this.ctx) return;
                this.nodes.forEach(n => {
                    if (n.main && n.main.disconnect) n.main.disconnect();
                    if (n.outputs) Object.values(n.outputs).forEach(o => {
                        try { o.disconnect(); } catch(e) {}
                    });
                });
            }
        }
`;

const reAudioEngine = new RegExp(audioEngineStart.replace(/[.*+?^$\{()|[\\]\\\\]/g, '\\\\$&') + '[\\\\s\\\\S]*?' + audioEngineEnd.replace(/[.*+?^$\{()|[\\]\\\\]/g, '\\\\$&'));
html = html.replace(reAudioEngine, newAudioEngine + '\\n        // --- React Components ---');

// Replace SequencerDisplay
const newSeq = `
        function SequencerDisplay({ stepValues, cvValues, currentStep, onStepToggle, onCvChange }) {
            return (
                <div className="step-sequencer-grid">
                    {stepValues.map((val, idx) => (
                        <div key={idx} className="step-col">
                            <div className="step-knob-container" onMouseDown={(e)=>e.stopPropagation()}>
                                <Knob label="" value={cvValues[idx]} onChange={(v) => onCvChange(idx, v)} />
                            </div>
                            <div
                                className={\`step-btn \${val > 0 ? 'active' : ''} \${currentStep === idx ? 'current' : ''}\`}
                                onClick={(e) => { e.stopPropagation(); onStepToggle(idx); }}
                            >
                                {idx + 1}
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        // Keys for keyboard (C4 to G5 approx)
        const PIANO_KEYS = [
            { note: 60, type: 'white' },
            { note: 61, type: 'black', pos: 1 },
            { note: 62, type: 'white' },
            { note: 63, type: 'black', pos: 2 },
            { note: 64, type: 'white' },
            { note: 65, type: 'white' },
            { note: 66, type: 'black', pos: 4 },
            { note: 67, type: 'white' },
            { note: 68, type: 'black', pos: 5 },
            { note: 69, type: 'white' },
            { note: 70, type: 'black', pos: 6 },
            { note: 71, type: 'white' },
            { note: 72, type: 'white' },
            { note: 73, type: 'black', pos: 8 },
            { note: 74, type: 'white' },
            { note: 75, type: 'black', pos: 9 },
            { note: 76, type: 'white' },
            { note: 77, type: 'white' }
        ];

        function Keyboard({ moduleId, updateCVGate, triggerEnv }) {
            const [activeNote, setActiveNote] = useState(null);

            const handleNoteOn = (note) => {
                setActiveNote(note);
                // Convert midi note to CV (0-1). Base C2 = note 36.
                // 1V/oct means 1 octave = 12 notes = 0.2 CV (since 5 octaves = 1.0)
                const baseNote = 36;
                const cv = (note - baseNote) / 60; // 60 notes range
                updateCVGate(moduleId, cv, 1);
                triggerEnv(moduleId, 1);
            };

            const handleNoteOff = (note) => {
                if (activeNote === note) {
                    setActiveNote(null);
                    updateCVGate(moduleId, null, 0);
                    triggerEnv(moduleId, 0);
                }
            };

            return (
                <div className="keyboard" onMouseLeave={() => activeNote && handleNoteOff(activeNote)}>
                    {PIANO_KEYS.map((k, i) => {
                        if (k.type === 'white') {
                            return <div key={i} className={\`key \${activeNote===k.note?'active':''}\`}
                                onMouseDown={(e)=>{ e.stopPropagation(); handleNoteOn(k.note); }}
                                onMouseUp={(e)=>{ e.stopPropagation(); handleNoteOff(k.note); }}
                                onMouseEnter={(e)=>{ if(e.buttons === 1) handleNoteOn(k.note); }}
                            />
                        }
                        return null;
                    })}
                    {PIANO_KEYS.map((k, i) => {
                        if (k.type === 'black') {
                            return <div key={i} className={\`key black \${activeNote===k.note?'active':''}\`}
                                style={{left: \`\${k.pos * (100 / 10)}%\`}}
                                onMouseDown={(e)=>{ e.stopPropagation(); handleNoteOn(k.note); }}
                                onMouseUp={(e)=>{ e.stopPropagation(); handleNoteOff(k.note); }}
                                onMouseEnter={(e)=>{ if(e.buttons === 1) handleNoteOn(k.note); }}
                            />
                        }
                        return null;
                    })}
                </div>
            );
        }

        function MidiIn({ moduleId, updateCVGate, triggerEnv }) {
            const [status, setStatus] = useState('Waiting...');
            useEffect(() => {
                if (navigator.requestMIDIAccess) {
                    navigator.requestMIDIAccess().then((access) => {
                        setStatus('Connected');
                        for (let input of access.inputs.values()) {
                            input.onmidimessage = (msg) => {
                                const [cmd, note, vel] = msg.data;
                                if (cmd === 144 && vel > 0) { // Note on
                                    const cv = (note - 36) / 60;
                                    updateCVGate(moduleId, cv, 1);
                                    triggerEnv(moduleId, 1);
                                } else if (cmd === 128 || (cmd === 144 && vel === 0)) { // Note off
                                    updateCVGate(moduleId, null, 0);
                                    triggerEnv(moduleId, 0);
                                }
                            };
                        }
                    }).catch(() => setStatus('No Access'));
                } else {
                    setStatus('Not Supported');
                }
            }, [moduleId]);
            return <div style={{textAlign:'center', marginTop: '10px', fontSize:'0.8rem'}}>{status}</div>;
        }

`;
html = html.replace('function SequencerDisplay({ stepValues, currentStep, onStepToggle }) {', newSeq + '\n        function OldSeq() {');


// Inject Keyboard & Midi in rendering in Module
html = html.replace("{data.type === 'oscilloscope' && extra && (", `
                        {data.type === 'keyboard' && extra && (
                            <Keyboard moduleId={data.id} updateCVGate={extra.updateCVGate} triggerEnv={extra.triggerEnv} />
                        )}
                        {data.type === 'midi_in' && extra && (
                            <MidiIn moduleId={data.id} updateCVGate={extra.updateCVGate} triggerEnv={extra.triggerEnv} />
                        )}
                        {data.type === 'oscilloscope' && extra && (`);


// Update Module extra props logic inside <Module ... extra={...}>
html = html.replace(
    "stepValues: (sequencerStates[m.id] || {stepValues:[0,0,0,0]}).stepValues,",
    "stepValues: (sequencerStates[m.id] || {stepValues:[0,0,0,0,0,0,0,0], cvValues:[0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5]}).stepValues,\n                                            cvValues: (sequencerStates[m.id] || {stepValues:[], cvValues:[0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5]}).cvValues,"
);
html = html.replace(
    "onStepToggle: (idx) => handleSequencerStep(m.id, idx)",
    "onStepToggle: (idx) => handleSequencerStep(m.id, idx),\n                                            onCvChange: (idx, v) => handleSequencerCv(m.id, idx, v)"
);

html = html.replace(
    "audioEngine: audio\n                                        } : null",
    "audioEngine: audio\n                                        } : (m.type === 'keyboard' || m.type === 'midi_in') ? {\n                                            updateCVGate: (id, cv, gate) => audio.updateCVGate(id, cv, gate),\n                                            triggerEnv: (srcId, gate) => {\n                                                cables.forEach(c => {\n                                                    if(c.from === \`\${srcId}-out-gate\` && c.to.includes('-in-gate')) {\n                                                        audio.triggerEnvelope(c.to.split('-in-')[0], gate);\n                                                    }\n                                                });\n                                            }\n                                        } : null"
);

// We need to fix the sequencer step amount and loop logic
html = html.replace(
    "state.currentStep = (state.currentStep + 1) % 4;",
    "state.currentStep = (state.currentStep + 1) % 8;"
);

html = html.replace(
    "const gate = state.stepValues[state.currentStep] ? 1 : 0;\n                                    audio.updateSequencer(seq.id, 0, gate);",
    "const gate = state.stepValues[state.currentStep] ? 1 : 0;\n                                    const cv = state.cvValues ? state.cvValues[state.currentStep] : 0;\n                                    audio.updateCVGate(seq.id, cv, gate);"
);

html = html.replace(
    "const st = prev[seqId] || { stepValues: [0,0,0,0], currentStep:0 };",
    "const st = prev[seqId] || { stepValues: [0,0,0,0,0,0,0,0], cvValues: [0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5], currentStep:0 };"
);

html = html.replace(
    "const handleDragStart",
    `
            const handleSequencerCv = (seqId, idx, v) => {
                setSequencerStates(prev => {
                    const st = prev[seqId] || { stepValues: [0,0,0,0,0,0,0,0], cvValues: [0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5], currentStep:0 };
                    const newCvs = [...st.cvValues];
                    newCvs[idx] = v;
                    return { ...prev, [seqId]: { ...st, cvValues: newCvs } };
                });
            };
            const handleDragStart`
);


// Update default patch
html = html.replace(
    "'seq1': { stepValues: [1,0,1,0], currentStep: 0, lastTime: 0 }",
    "'seq1': { stepValues: [1,1,0,1,1,0,1,0], cvValues: [0.2,0.3,0.2,0.4,0.5,0.4,0.3,0.2], currentStep: 0, lastTime: 0 }"
);

// Dragging Cable State and Rendering
html = html.replace(
    "const [cableStart, setCableStart] = useState(null);",
    "const [cableStart, setCableStart] = useState(null);\n            const [mousePos, setMousePos] = useState({x:0, y:0});"
);

html = html.replace(
    "// Drag from sidebar",
    `
            const handleRackMouseMove = (e) => {
                if (cableStart) {
                    const rect = document.querySelector('.rack-area').getBoundingClientRect();
                    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                }
            };
            // Drag from sidebar
`
);

html = html.replace(
    `<div className="rack-area" onDragOver={e => e.preventDefault()} onDrop={handleDrop}>`,
    `<div className="rack-area" onDragOver={e => e.preventDefault()} onDrop={handleDrop} onMouseMove={handleRackMouseMove}>`
);

const draggingCableRender = `
                                {cableStart && (
                                    <path
                                        className="dragging-cable"
                                        d={\`M \${(() => {
                                            const el = document.getElementById(cableStart.id);
                                            if (!el) return '0 0';
                                            const r = el.getBoundingClientRect();
                                            const cR = document.querySelector('.rack-area').getBoundingClientRect();
                                            return \`\${r.left - cR.left + r.width/2} \${r.top - cR.top + r.height/2}\`;
                                        })()} L \${mousePos.x} \${mousePos.y}\`}
                                    />
                                )}
`;
html = html.replace(
    `{cableStart && (
                                    // Visual line for pending connection could go here
                                    // For now, simpler UI is fine
                                    null
                                )}`,
    draggingCableRender
);

// Double-click to delete cable instead of single click
html = html.replace(
    `onClick={onRemove}`,
    `onDoubleClick={onRemove}`
);

fs.writeFileSync('modular-synth/index.html', html);
