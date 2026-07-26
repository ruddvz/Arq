import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
/*
 * workspace-shell.css is the head of the stylesheet chain: it imports
 * shell-controls.css, which imports tokens.css and shell-tokens.css. Importing
 * it here is what gives the shell its control states (hover, focus-visible,
 * pressed, disabled) and the 44px touch targets - before this the app pulled in
 * tokens.css alone, so every `.arq-shell-button` in the shell was rendering
 * unstyled.
 */
import '@arq/design-system/src/workspace/workspace-shell.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('missing #root element');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
