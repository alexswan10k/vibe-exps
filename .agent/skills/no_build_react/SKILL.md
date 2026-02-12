---
description: How to create No-Build React applications without Babel or JSX
---

# No-Build React Pattern

This pattern allows creating React applications that run directly in the browser without any build steps, bundlers, or runtime transpilation (like Babel). This makes the code completely standalone and "view source" friendly.

## 1. HTML Setup

Include React and ReactDOM UMD builds via script tags. Do NOT include Babel.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My App</title>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <style>
        /* CSS goes here */
    </style>
</head>
<body>
    <div id="root"></div>
    <script src="app.js"></script>
</body>
</html>
```

## 2. JavaScript Setup (`app.js`)

Since there is no JSX, you must use `React.createElement`.

### Basic Hooks Destructuring
At the top of your script, destructure what you need from the global `React` object.

```javascript
const { useState, useEffect, useCallback, useRef } = React;
```

### Creating Components
Components are just functions. Use `React.createElement(component, props, ...children)` to render.

```javascript
const MyComponent = ({ title, active }) => {
    return React.createElement('div', { className: 'my-component' },
        React.createElement('h1', { style: { color: active ? 'blue' : 'gray' } }, title),
        React.createElement('p', null, 'This is a no-build component')
    );
};
```

### Nesting Elements
Nesting can get verbose. A helper function `h` is often used, but explicit `React.createElement` is clearer for strict adherence to standard APIs.

```javascript
// Example of nested structure
const Container = () => {
    return React.createElement('div', { className: 'container' },
        React.createElement('header', null, 'My Header'),
        React.createElement(MyComponent, { title: 'Hello', active: true }),
        React.createElement('footer', null, 'My Footer')
    );
};
```

### Rendering
Render the root component to the DOM.

```javascript
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(Container));
```

## 3. Standalone & Script Order (Critical)

When running via `file://` protocol or as a simple HTML file:

1.  **NO Modules**: Do not use `<script type="module">`. It causes CORS issues with `file://` and requires a server. Use standard `<script>` tags.
2.  **Global Scope**: Since there are no modules, everything in your scripts becomes global.
    -   Tip: Wrap your app code in an IIFE `(() => { ... })();` if you want to avoid polluting the global scope, OR just embrace it for simple tools.
3.  **Execution Order**:
    -   Libraries MUST come first (React, ReactDOM, etc.).
    -   Domain/Logic scripts next.
    -   UI Components next.
    -   Main/Mount script last (often at the bottom of `<body>`).

**Example Structure:**

```html
<head>
    <!-- 1. Libraries -->
    <script src="react.js"></script>
    <script src="react-dom.js"></script>
</head>
<body>
    <div id="root"></div>

    <!-- 2. Logic (if separated) -->
    <script src="domain-logic.js"></script>

    <!-- 3. Components (depend on React) -->
    <script src="components.js"></script>

    <!-- 4. Main (Mounts the app) -->
    <script src="main.js"></script>
</body>
```

## 4. Rules & Gotchas

- **No `import` / `export`**: Standard JS only.
- **ClassName**: Remember to use `className` instead of `class`.
- **Style Objects**: Styles must be passed as objects: `style: { display: 'flex' }` not strings.
- **Event Handlers**: Use camelCase events: `onClick`, `onChange`.
- **Keys**: Don't forget `key` props when mapping arrays.

## 5. Common Integrations

### Markdown Rendering
To render Markdown without a build step, use a library like `marked` from a CDN.

1.  **Include Script**: `<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>`
2.  **Render**: Use `marked.parse(content)` combined with `dangerouslySetInnerHTML`.

```javascript
h('div', {
    dangerouslySetInnerHTML: { __html: marked.parse(markdownContent) }
})
```

