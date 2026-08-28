# Rubrics — Model Evaluation Harness

This directory is a **test rubric**: a repeatable, model-vs-model harness for evaluating code generation against a single shared prompt.

## Structure

```
rubrics/
├── index.html                  # Hub — lists every test
├── README.md                   # This file — format spec
├── run-rubric.sh               # Isolated runner (tmp or microsandbox) — canonical location
└── <test-slug>/
    ├── index.html              # Test dashboard — lists all model sandboxes + links to prompt/rubric
    ├── prompt.md               # The exact prompt pasted to each model (canonical source of truth)
    ├── rubric.md               # (optional) Grading checklist
    ├── _template/
    │   ├── index.html          # Starter template — copy this to create a new submission
    │   └── AGENTS.md           # Scope guard — copied into each model
    └── <model-name>/
        └── index.html          # Standalone demo. May also contain style.css / script.js / assets
                                # Must run by opening index.html directly (file:// and http://)
```

### Naming conventions

* `test-slug` — kebab-case, short, stable (e.g. `minecraft-clone`). Renaming is a breaking change.
* `model-name` — `<provider>-<model>-<date>` or `<model>-<variant>` (e.g. `claude-opus-4-20250514`, `gpt-5-high`, `gemini-2.5-pro`). Keep lowercase, no spaces.
* A test **owns** its prompt. Never edit `prompt.md` after submissions exist without bumping the slug (e.g. `minecraft-clone-v2`).

## Adding a new test

1. `mkdir rubrics/<test-slug> && mkdir rubrics/<test-slug>/_template`
2. Write `prompt.md` — must include the `## Technical constraints` block below verbatim (or stricter).
3. Write `rubric.md` if you want scored evaluation.
4. Create `index.html` from the minecraft-clone example (copy and change title, description, prompt link).
5. Add a card to `rubrics/index.html` linking to the new test.
6. Add an entry to the top-level `index.html` if you want it surfaced as a featured card (optional).

## Adding a model submission

### Isolated (recommended — prevents cross-model peeking)

Use the helper that stages only one test+one model so siblings don't exist:

```bash
# interactive (default in a terminal): pick test → pick model by number (or type text to filter) → confirm & run
rubrics/run-rubric.sh                 # full menu
rubrics/run-rubric.sh minecraft-clone # straight to the model menu

# enumerate without the menu (also what happens automatically when piped / in CI)
rubrics/run-rubric.sh minecraft-clone --list   # submissions + every harness model, ✔ done / ○ not run
rubrics/run-rubric.sh --list          # all tests + models

# tmp isolation (default) — no microsandbox install needed
rubrics/run-rubric.sh minecraft-clone claude-opus-4-20250514 -- opencode run "Build per ../prompt.md — work only in this folder"

# pi and opencode as first-class harnesses (auto-reads prompt.md)
rubrics/run-rubric.sh minecraft-clone my-model --harness pi          # or --pi
rubrics/run-rubric.sh minecraft-clone my-model --harness opencode    # or --opencode
rubrics/run-rubric.sh minecraft-clone gpt-5-high -- pi -p "Build per ../prompt.md"  # explicit pi
rubrics/run-rubric.sh minecraft-clone my-model --msb --harness pi

# run same command for every model in a test
rubrics/run-rubric.sh minecraft-clone --all -- touch hello.txt
rubrics/run-rubric.sh minecraft-clone --all --harness pi   # pi for each model

# shim also available at scripts/run-rubric.sh
```

The script (`rubrics/run-rubric.sh`; shim at `scripts/run-rubric.sh`):
1. Ensures `rubrics/<test>/<model>/` exists (seeded from `_template/` — includes `AGENTS.md` scope guard)
2. Copies only `prompt.md`, `rubric.md`, `_template/` and that one model into a `mktemp` stage (`/tmp/rubric-XXXX`) — no siblings
3. Runs your `<agent command>` (or `--harness pi|opencode` auto-built from `prompt.md`) with `cwd` = the staged model folder
4. `pi` harness: `pi -p "$(cat ../prompt.md)"` inside the isolated model; `opencode` harness: `opencode run "$(cat ../prompt.md)"`. Both work with `--msb` mounting.
5. Rsyncs the result back, checks for `type="module"` / `importmap` violations
6. In `--msb` mode the staged dir is mounted as `/workspace` inside a microVM (`msb run --volume $STAGE:/workspace`)
7. `--all` loops over every model in the test, invoking the script per-model

Without a command it only stages and prints the next step:
```bash
rubrics/run-rubric.sh minecraft-clone my-model
```

### Manual (no isolation)

```bash
cp -r rubrics/<test-slug>/_template rubrics/<test-slug>/<model-name>
# then let the model write into that folder — but it CAN see siblings via ../
```

* The sandbox is **fully owned** by that generation run. No shared code across models.
* The submission must be self-contained — a reviewer opens `rubrics/<test-slug>/<model-name>/index.html` and it just works.

## Technical constraints (file:// safe)

Every submission **must** satisfy these. They are repeated in each `prompt.md` but summarised here:

* **No build step.** No npm, no bundler, no Vite/Webpack/Parcel, no `npm install`.
* **No Babel / TypeScript / JSX transforms.** Plain HTML + CSS + vanilla JS. The browser parses what you wrote.
* **CDN-only for libraries.** If you need Three.js, PixiJS, etc., load it with a plain UMD `<script src="https://...">` tag, e.g.:
  ```html
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://unpkg.com/pixi.js@7.4.0/dist/pixi.min.js"></script>
  ```
  Do **NOT** use `<script type="module">`, `importmap`, `es-module-shims`, or bare `import "three"` — they break `file://` via CORS.
* **No `fetch()` of local files** unless you guard for `file://` CORS failure. Prefer inlining data or generating procedurally.
* **Relative paths only** inside the sandbox. Everything must work both as `file:///…/index.html` (double-click) **and** via `http://` (GitHub Pages).
* **Max 2–3 files ideally** (`index.html` alone is perfect; `index.html` + `style.css` + `script.js` is fine). No deep `src/` trees.
* **Assets:** prefer procedurally generated textures (Canvas) or CDN images. If you ship image files, keep them inside the sandbox folder.

## Navigation tree

```
index.html (root)  ──→  rubrics/index.html  ──→  rubrics/<test>/index.html  ──→  rubrics/<test>/<model>/index.html
   Project Navigator        Rubric Hub               Test Dashboard                  Model Demo (sandbox)
```

* The root `index.html` has a featured card that links to the Rubric Hub.
* The Hub lists every test with prompt + count of submissions.
* Each test dashboard lists every `<model-name>` sandbox as a playable card/iframe link.

## Isolation — why `rubrics/run-rubric.sh` exists

Running `opencode .` or `pi` at the repo root lets the agent `read`/`glob` `rubrics/minecraft-clone/*` and copy a prior model. Two layers prevent that:

1. **Prompt + `AGENTS.md` guard** — every `_template/AGENTS.md` (copied into each model) says: you may only read `../prompt.md`, `../rubric.md`, `../_template/`; do NOT read sibling `../<other-model>/`. This is a soft guard.
2. **Filesystem staging** — `rubrics/run-rubric.sh` builds a `mktemp` tree that mirrors `rubrics/<test>/` but contains only the one model. Siblings don't exist on disk, so even an escaping `read ../other-model/index.html` fails.

Hardened mode: `microsandbox` (`msb`) — https://crates.io/crates/microsandbox — wraps the same staging in a microVM (`msb` runs untrusted workloads in hardware-isolated microVMs, ~100ms boot, OCI images, `msb run --volume $STAGE:/workspace`). On macOS it needs Apple Silicon (you're on `arm64`), on Linux KVM. Install: `curl -fsSL https://install.microsandbox.dev | sh` or `brew install superradcompany/tap/microsandbox` (and optionally `npx skills add superradcompany/skills` for agent-native sandboxing). The script auto-detects `msb` — use `--msb` to force it, `--tmp` to force the lightweight fallback. For the `minecraft-clone` static site the `tmp` mode already gives the sibling-blindness guarantee; `msb` is worthwhile when you also want to sandbox execution of generated code or run many models in parallel CI.

## Grading (optional but recommended)

Each `rubric.md` defines a checklist (e.g. 0–3 per criterion). Keep evaluation **manual and visual** — open each demo, score, note failure modes. Do not automate headless checks that would themselves need `file://` CORS workarounds.

## Why this exists

We want repeatable, fair comparisons: **one prompt → N models → N sandboxes → side-by-side judging**. The folder structure makes the comparison trivially navigable on GitHub Pages and locally.
