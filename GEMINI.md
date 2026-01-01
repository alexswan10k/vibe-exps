# Project Development Guidelines

## 1. Standalone Prototypes
- **Strict Requirement:** All prototypes must be completely standalone and runnable directly from the file system (e.g., double-clicking `index.html`).
- **No Build Tools:** Do not use build steps, bundlers (Webpack, Vite, Parcel), or local servers (`http-server`, `live-server`).
- **No NPM Dependencies:** Do not rely on `package.json` dependencies for runtime code. Use CDNs if absolutely necessary, but prefer inline or local code.

## 2. Code Structure & Syntax
- **No ES Modules:** Do **NOT** use `import` or `export` statements. Do **NOT** use `<script type="module">`.
  - All scripts must be loaded sequentially via `<script src="...">` tags in `index.html`.
  - Variables and classes will be global.
- **No JSX:** Do not use JSX syntax.
- **Classic Component Syntax:**
  - Organize code into Vanilla JavaScript classes or objects that act as components.
  - Example Pattern: `class UIManager { ... }` or `function createPlayer() { ... }`.
  - **Reference:** Check the `tower-defense` directory for the canonical example of this project structure.

## 3. Programming Paradigm
- **Functional & Reactive:** Prefer functional programming patterns and reactive flows over heavy imperative logic where possible.
- **Immutability:** Avoid mutable state where feasible. If state is necessary, encapsulate it cleanly within the class/component constraints.

## 4. Environment
- **Browser Compatibility:** Ensure code works in modern browsers without transpilation.
