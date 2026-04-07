with open("modular-synth/index.html", "r") as f:
    text = f.read()

# Fix the SequencerDisplay call which was missing cvValues
text = text.replace(
"""<SequencerDisplay
                                stepValues={extra.stepValues}
                                currentStep={extra.currentStep}
                                onStepToggle={extra.onStepToggle}
                            />""",
"""<SequencerDisplay
                                stepValues={extra.stepValues}
                                cvValues={extra.cvValues}
                                currentStep={extra.currentStep}
                                onStepToggle={extra.onStepToggle}
                                onCvChange={extra.onCvChange}
                            />"""
)

with open("modular-synth/index.html", "w") as f:
    f.write(text)
