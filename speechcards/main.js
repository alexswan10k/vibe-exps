/**
 * main.js - SpeechCards React Mounting Entry Point
 */

window.addEventListener('load', () => {
  const rootElement = document.getElementById('root');
  if (rootElement && typeof ReactDOM !== 'undefined') {
    const root = ReactDOM.createRoot(rootElement);
    root.render(React.createElement(window.AppShell));
  } else {
    console.error('ReactDOM is not loaded or #root is missing.');
  }
});
