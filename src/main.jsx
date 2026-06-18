import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './game/runtimeFixes.js';
import './game/waterPlankSinkFixes.js';
import './game/smoothTrafficFixes.js';
import './game/stageBalanceFixes.js';
import './game/stageTrainVisibilityFixes.js';
import './game/desktopShadowFixes.js';
import './game/mobileContactShadowFixes.js';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);


if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const baseUrl = import.meta.env.BASE_URL || '/';
    navigator.serviceWorker.register(`${baseUrl}sw.js`).then((registration) => {
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('ayam:update-ready'));
          }
        });
      });
    }).catch(() => {
      // Offline or private contexts may block service workers; the game remains playable.
    });
  });
}
