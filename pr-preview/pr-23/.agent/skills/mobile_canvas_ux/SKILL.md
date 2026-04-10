---
description: Best practices for implementing mobile-friendly canvas applications, robust touch controls, and avoiding passive listener errors.
---

# Mobile Canvas & Touch UX

When building interactive, full-screen canvas applications (like games, visualizers, or simulators) for mobile devices, standard web layouts and event listener defaults often lead to poor user experiences or browser intervention errors. Follow these patterns to ensure a robust mobile experience.

## 1. JavaScript: Active Event Listeners (Fixing Interventions)
Modern browsers default touch event listeners (`touchstart`, `touchmove`, `wheel`) to `passive: true` to improve scroll performance. If your application needs to stop default browser behavior (e.g., using `e.preventDefault()` to stop pull-to-refresh or page scrolling when dragging on a 3D element), you **must** explicitly set `passive: false`. 

Avoid using direct property assignments (like `element.ontouchstart = fn`) as you cannot configure the passive flag.

```javascript
// ❌ BAD: May result in "[Intervention] Unable to preventDefault inside passive event listener"
canvas.ontouchstart = (e) => {
    e.preventDefault(); 
};

// ✅ GOOD: Explicitly non-passive
canvas.addEventListener('touchstart', (e) => {
    // Only prevent default if we actually are handling the interaction
    if (shouldHandleTouch) {
        e.preventDefault();
    }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    // Handle specific swipe/drag logic
    e.preventDefault(); // Allowed because passive: false
}, { passive: false });
```

## 2. CSS: Preventing Default Gestures
To prevent the browser from interpreting canvas touches as page scrolling or pinch-to-zoom gestures, explicitly disable touch actions on the canvas element via CSS. This signals to the browser that your JavaScript will handle the gestures.

```css
canvas {
    touch-action: none; /* Crucial for custom touch handling */
}
```

## 3. Layout: App-Like Feel
For canvas-heavy applications, standard document flow often breaks down on mobile. Adopt an app-like layout structure:

- **Body Overflow**: Set `body { overflow: hidden; height: 100vh; }` on mobile breakpoints to trap scrolling within the app and prevent bounce effects.
- **Fixed Navigation**: Use a fixed bottom tab bar (`position: fixed; bottom: 0; width: 100%;`) instead of toggling sidebars that shift the layout.
- **Full-Screen Overlays**: For settings or stats panels, use bottom-sheet or full-screen overlays (`position: fixed; z-index: high;`) that sit above the canvas rather than trying to fit them alongside it on small screens. Ensure these overlays have `overflow-y: auto` themselves if their content is long.

## 4. Touch Targets & Typography
Ensure all UI controls are accessible for touch.
- **Minimum interactive size**: Buttons and interactive elements should be at least `48px` high.
- **Input text size**: Use a minimum font size of `16px` on inputs to prevent iOS Safari from automatically zooming in when the input is focused.
