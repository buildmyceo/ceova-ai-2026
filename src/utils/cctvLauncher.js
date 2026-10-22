/**
 * CEOVA CCTV App Launcher
 * 
 * Provides unified, reliable opening of the CEOVA CCTV application:
 * 1. Native desktop window (via Tauri WebviewWindowBuilder) when running in Tauri desktop.
 * 2. In-app modal overlay / web fallback when running in a standard browser environment.
 */

export const CCTV_HTTP_URL = "http://127.0.0.1:3080";

export async function openCctvApp(fallbackOverlaySetter) {
  // 1. Ensure internal background CCTV service is active
  try {
    if (typeof window !== 'undefined' && (window.__TAURI__ || window.__TAURI_INTERNALS__)) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("start_cctv_service");
    }
  } catch (err) {
    console.warn("[CCTV] start_cctv_service notice:", err);
  }

  // 2. Always open the CCTV interface inside our main app tab/overlay
  if (typeof fallbackOverlaySetter === 'function') {
    fallbackOverlaySetter(true);
    return true;
  }

  return false;
}

export default openCctvApp;
