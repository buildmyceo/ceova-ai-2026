import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { AuthProvider } from './contexts/AuthProvider'
import { ThemeProvider } from './contexts/ThemeContext'
import { ErrorBoundary } from './components/ErrorBoundary'

// Vite dynamic chunk failure listener (auto-reloads if outdated chunk hash fails)
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[CEOVA] Outdated bundle chunk detected. Reloading for newest UI...', event);
  window.location.reload();
});

// Immediate Service Worker & CacheStorage purge to ensure clean state
try {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    }).catch(() => {});
  }
  if ('caches' in window) {
    caches.keys().then((keys) => {
      for (const key of keys) {
        caches.delete(key);
      }
    }).catch(() => {});
  }
} catch (e) {
  console.warn('[CEOVA] Cache purge notice:', e);
}

// Track active build version & detect new server deployments
const CURRENT_BUILD = typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : '2.1.0';
try {
  const previousBuild = localStorage.getItem('ceova_active_build');
  if (previousBuild && previousBuild !== CURRENT_BUILD) {
    console.log(`[CEOVA] Upgraded client build: ${previousBuild} -> ${CURRENT_BUILD}`);
    sessionStorage.clear();
  }
  localStorage.setItem('ceova_active_build', CURRENT_BUILD);
} catch (e) {}

let isAutoUpdating = false;
async function checkForNewDeployment() {
  if (isAutoUpdating) return;
  try {
    const res = await fetch(`/version.json?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache' }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.buildTime && data.buildTime !== CURRENT_BUILD) {
      console.log(`[CEOVA] New version detected on server (${data.buildTime} vs ${CURRENT_BUILD}). Updating UI/UX...`);
      isAutoUpdating = true;
      if ('caches' in window) {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        } catch (_) {}
      }
      window.location.reload();
    }
  } catch (_) {}
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkForNewDeployment();
  }
});
window.addEventListener('focus', () => {
  checkForNewDeployment();
});
setInterval(checkForNewDeployment, 3 * 60 * 1000);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

