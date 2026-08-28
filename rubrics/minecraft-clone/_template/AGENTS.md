# Sandbox Scope — DO NOT VIOLATE

You are working inside `rubrics/minecraft-clone/<model-name>/` (your sandbox).

**Allowed reads outside this folder:**
- `../prompt.md` — the task brief (canonical)
- `../rubric.md` — grading criteria
- `../_template/` — reference starter (if needed)

**Forbidden:**
- Do NOT read, list, `glob`, `grep`, or `fetch` any sibling `../<other-model>/` folder.
- Do NOT read the repository root `index.html` to discover other submissions.
- Do NOT search `rubrics/` for other implementations.
- Do NOT copy code from any other model sandbox.

Your work must be **original and self-contained**. A post-run check diffs your output against other sandboxes for plagiarism. If you need context, ask the user — do not scan siblings.

Deliverable: `index.html` (and optionally `style.css` / `script.js`) in this folder that works via double-click `file://` with no build step. See `../prompt.md` section 2 for hard constraints (no `type="module"` / `importmap` / `fetch('./…')`).
