/**
 * CEOVA Central Application Configuration
 * -------------------------------------------------------------
 * Standardized local development & production environment configuration.
 * Default Development Server: http://localhost:12827 (Host: 0.0.0.0, Port: 12827)
 */

export const APP_CONFIG = {
  port: parseInt(import.meta.env.PORT || '12827', 10),
  host: import.meta.env.HOST || '0.0.0.0',
  
  // App URL resolution with fallback order:
  // 1. VITE_APP_URL / NEXT_PUBLIC_APP_URL environment variable
  // 2. window.location.origin (runtime browser location)
  // 3. http://localhost:12827 fallback
  getAppUrl() {
    if (import.meta.env.VITE_APP_URL) return import.meta.env.VITE_APP_URL;
    if (import.meta.env.NEXT_PUBLIC_APP_URL) return import.meta.env.NEXT_PUBLIC_APP_URL;
    if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
    return 'http://localhost:12827';
  },

  getRedirectUrl(path = '/auth/callback') {
    const baseUrl = this.getAppUrl();
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`;
  },

  isDev: import.meta.env.DEV
};

export default APP_CONFIG;
