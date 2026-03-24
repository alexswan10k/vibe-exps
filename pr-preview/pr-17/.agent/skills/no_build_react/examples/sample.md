# Simple Counter App

## Component: Main Application

### 1. HTML Setup
- **React/ReactDOM Builds**: Uses unpkg.com development builds for 18.2.0.
- **Script Order**: `react.js` -> `react-dom.js` -> `App.js` (Mount).

### 2. Component Architecture
- **Hooks Destructuring**: `const { useState } = React;`
- **Component Pattern**: Uses a functional component `Counter` that returns `React.createElement('div', ...)`.

### 3. Implementation Checklist
- [x] No `import` or `export` statements used.
- [x] No `<script type="mod-ule">` used.
- [x] React and ReactDOM loaded via UMD builds.
- [x] UI rendered via `ReactDOM.createRoot`.
