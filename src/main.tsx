import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { applyPalette, readPrefs } from './store/prefsStore';

// §2.1: stamp the stored palette on <html> before the first paint, so a
// colourblind-safe or high-contrast reader never sees a frame of the default
// twenty-hue palette on load.
applyPalette(readPrefs().palette);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
