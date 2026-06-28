import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Mitigate third-party or cross-origin "Script error." occurrences inside sandboxed preview iframes
if (typeof window !== 'undefined') {
  window.onerror = function (msg, url, line, col, error) {
    const messageStr = String(msg || "");
    if (messageStr.includes('Script error') || !url || url === "") {
      console.warn('Muted cross-origin window.onerror event:', messageStr);
      return true; // suppresses error in browser/test runners
    }
    return false;
  };

  window.addEventListener('error', (event) => {
    const msg = event.message || "";
    if (msg.includes('Script error')) {
      console.warn('Muted external or cross-origin iframe error:', msg);
      event.preventDefault();
      event.stopPropagation();
    }
  }, { capture: true });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason ? String(event.reason.message || event.reason) : "";
    if (reason.includes('Script error') || reason.includes('auth/popup-closed-by-user') || reason.includes('auth/cancelled-popup-request')) {
      console.warn('Muted unhandled promise rejection in sandbox iframe:', reason);
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

