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

## 3. Rules & Gotchas

- **No `import` / `export`**: Unless you use `<script type="module">` (which we generally avoid for compatibility/simplicity in this pattern), everything is global.
- **ClassName**: Remember to use `className` instead of `class`.
- **Style Objects**: Styles must be passed as objects: `style: { display: 'flex' }` not strings.
- **Event Handlers**: Use camelCase events: `onClick`, `onChange`.
- **Keys**: Don't forget `key` props when mapping arrays.
