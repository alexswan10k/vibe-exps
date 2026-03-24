# Mobile Canvas UX Implementation Template

## Component: [App/Game Name]

### 1. Touch & Event Handling
- **Active Listeners**: [List the listeners where { passive: false } is used.]
- **CSS Touch Actions**: [Which elements have touch-action: none?]

### 2. Layout & UI
- **Body & Overflow**: [How is scrolling trapped?]
- **Mobile Breakpoints**: [Layout adjustments for smaller screens.]
- **Touch Targets**: [Confirming button sizes >= 48px.]

### 3. Implementation Checklist
- [ ] Explicitly set `{ passive: false }` for touch event listeners.
- [ ] Set `touch-action: none` on interactive canvas elements.
- [ ] Ensure minimum interactive size is `48px`.
- [ ] Set `16px` font size for inputs to prevent iOS zoom.
