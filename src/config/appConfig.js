/**
 * CEOVA Central Application Configuration
 * -------------------------------------------------------------
 * Standardized local development & production environment configuration.
 * Default Development Server: http://localhost:12827 (Host: 0.0.0.0, Port: 12827)
 */

export const APP_CONFIG = {
  port: parseInt(import.meta.env?.PORT || '12827', 10),
  host: import.meta.env?.HOST || '0.0.0.0',
  
  // App URL resolution with fallback order:
  // 1. VITE_APP_URL / NEXT_PUBLIC_APP_URL environment variable
  // 2. window.location.origin (runtime browser location when not localhost/tauri)
  // 3. https://app.ceova.online fallback
  getAppUrl() {
    if (import.meta.env?.VITE_APP_URL) return import.meta.env.VITE_APP_URL;
    if (import.meta.env?.NEXT_PUBLIC_APP_URL) return import.meta.env.NEXT_PUBLIC_APP_URL;
    if (typeof window !== 'undefined' && window.location?.origin) {
      const origin = window.location.origin;
      if (!origin.startsWith('tauri://') && !origin.startsWith('http://localhost') && !origin.startsWith('http://127.0.0.1')) {
        return origin;
      }
    }
    return 'https://app.ceova.online';
  },

  getRedirectUrl(path = '/auth/callback') {
    const baseUrl = this.getAppUrl();
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`;
  },

  isDev: Boolean(import.meta.env?.DEV)
};

export default APP_CONFIG;
