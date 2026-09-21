import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import { ThemeProvider } from './theme.jsx';
import { CartProvider } from './cart.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { NotificationProvider } from './notifications.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import BackendWakeToast from './components/BackendWakeToast.jsx';
import './index.css';

// Register service worker (production builds only — Vite dev doesn't expose /sw.js)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <CartProvider>
              <ToastProvider>
                <NotificationProvider>
                  <App />
                </NotificationProvider>
              </ToastProvider>
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
      <BackendWakeToast />
    </ErrorBoundary>
  </React.StrictMode>
);
