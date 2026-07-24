import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@arq/design-system/src/tokens.css';
// shell-controls.css was never imported anywhere - every .arq-shell-button and
// .arq-shell-panel class name in the shell (top-bar, tool-rail, model-panel, ...)
// was applied to unstyled elements. shell-tokens.css comes in transitively (it's
// @imported by shell-controls.css).
import '@arq/design-system/src/shell/shell-controls.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('missing #root element');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
