# Sequence editor regression harness

Drives `../mermaid-studio/index.html` in headless Chromium and asserts every
sequence-editor interaction works (canvas selection pill, rows sheet, drags,
undo, autonumber, plus the Gantt/Pie pills that share the same components).

## Run

    npm i playwright-core   # already vendored in node_modules/
    node loop.mjs           # full suite (19 checks)
    node loop.mjs "pill"    # subset by name substring

Requires a Playwright Chromium in `~/Library/Caches/ms-playwright/`
(executable path is resolved at the top of `loop.mjs`).

Exit code is non-zero if any check fails.
