import re

with open("modular-synth/index.html", "r") as f:
    text = f.read()

# 1. Fix Cable Z-Index
# Originally: z-index: 5; for .cables-layer.
# Modules have z-index: 10, or 100 when dragging.
# If cables are in front of panels, they need z-index: 50.
text = text.replace(
"""        .cables-layer {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 5;
        }""",
"""        .cables-layer {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 50;
        }"""
)

# 2. Fix Sequencer GUI Overrun
# The step-sequencer-grid is a flex container with gap 5px.
# We have 8 items. Let's make it wrap or adjust sizing.
# The step buttons are 30px width. 8 * 30 + 7 * 5 = 240 + 35 = 275px.
# The sequencer width is currently set to 320 in module definitions (which we updated in previous step).
# Wait, did we actually update the width of sequencer to 320?
# Let's check module definition:
# name: 'Sequencer',
# width: 320,
# If it's 320, 275 should fit. But the screenshot showed it overlapping the right edge.
# Let's add flex-wrap to step-sequencer-grid just in case, or adjust spacing.
text = text.replace(
"""        .step-sequencer-grid {
            display: flex;
            gap: 5px;
            justify-content: center;
            margin-bottom: 10px;
        }""",
"""        .step-sequencer-grid {
            display: flex;
            gap: 5px;
            justify-content: center;
            margin-bottom: 10px;
            flex-wrap: wrap;
        }"""
)

with open("modular-synth/index.html", "w") as f:
    f.write(text)
