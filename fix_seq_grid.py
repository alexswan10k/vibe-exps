with open("modular-synth/index.html", "r") as f:
    text = f.read()

# Let's adjust step sequencer wrapper
text = text.replace(
"""        .step-sequencer-grid {
            display: flex;
            gap: 5px;
            justify-content: center;
            margin-bottom: 10px;
            flex-wrap: wrap;
        }""",
"""        .step-sequencer-grid {
            display: grid;
            grid-template-columns: repeat(8, 1fr);
            gap: 2px;
            justify-content: center;
            margin-bottom: 10px;
        }"""
)

text = text.replace(
"""        .step-col {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 5px;
            width: 32px;
        }
        .step-knob-container {
            transform: scale(0.7);
            transform-origin: top center;
            height: 40px;
            width: 40px;
        }""",
"""        .step-col {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0px;
        }
        .step-knob-container {
            transform: scale(0.65);
            transform-origin: top center;
            height: 35px;
            width: 40px;
            margin-bottom: -10px;
        }"""
)

# And make the sequencer slightly wider to give breathing room
text = text.replace(
"""                name: 'Sequencer',
                width: 320,""",
"""                name: 'Sequencer',
                width: 340,"""
)


with open("modular-synth/index.html", "w") as f:
    f.write(text)
