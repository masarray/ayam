import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './game/runtimeFixes.js';
import './game/smoothTrafficFixes.js';
import './game/stageBalanceFixes.js';
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
    navigator.serviceWorker
      .register(`${baseUrl}sw.js`, { scope: baseUrl })
      .catch((error) => {
        console.warn('Ayam SD service worker registration failed:', error);
      });
  });
}
