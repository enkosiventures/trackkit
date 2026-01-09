import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { analytics } from './analytics';

declare global {
  interface Window {
    __analytics?: typeof analytics;
  }
}

// Expose for quick console poking in this example only
window.__analytics = analytics;

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);