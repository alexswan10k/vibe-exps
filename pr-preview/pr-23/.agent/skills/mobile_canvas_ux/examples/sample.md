# Starship Navigator Pro

## Component: Main Navigation Canvas

### 1. Touch & Event Handling
- **Active Listeners**: `canvas.addEventListener('touchstart', ... , { passive: false })` and `touchmove` similarly to allow `preventDefault()` for camera rotation.
- **CSS Touch Actions**: `canvas#renderSurface { touch-action: none; }` applied in `styles.css`.

### 2. Layout & UI
- **Body & Overflow**: `html, body { overflow: hidden; height: 100%; position: fixed; }` used to prevent bounce.
- **Mobile Breakpoints**: Uses a `grid-template-areas` shift to move controls from sidebar (desktop) to bottom-overlay (mobile).
- **Touch Targets**: All control buttons have `min-height: 48px` and `padding: 12px`.

### 3. Implementation Checklist
- [x] Explicitly set `{ passive: false }` for touch event listeners.
- [x] Set `touch-action: none` on interactive canvas elements.
- [x] Ensure minimum interactive size is `48px`.
- [x] Set `16px` font size for inputs to prevent iOS zoom.
