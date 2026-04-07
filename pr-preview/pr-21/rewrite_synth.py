import re

with open('modular-synth/index.html', 'r') as f:
    html = f.read()

# I will rewrite the whole HTML in python directly using write_file instead
