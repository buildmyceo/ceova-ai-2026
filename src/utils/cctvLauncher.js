/**
 * CEOVA CCTV App Launcher
 * 
 * Provides unified, reliable opening of the CEOVA CCTV application:
 * 1. Native desktop window (via Tauri WebviewWindowBuilder) when running in Tauri desktop.
 * 2. In-app modal overlay / web fallback when running in a standard browser environment.
 */

export const CCTV_HTTP_URL = "http://127.0.0.1:3080";

export async function openCctvApp(fallbackOverlaySetter) {
  // Always try Tauri native window command first
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_cctv_window");
    return true;
  } catch (err) {
    console.warn("[CCTV] Native Tauri open_cctv_window failed or not in desktop environment:", err);
  }

  // Fallback if not running in desktop Tauri or if native window invocation fails
  if (typeof fallbackOverlaySetter === 'function') {
    fallbackOverlaySetter(true);
    return true;
  }

  if (typeof window !== 'undefined') {
    window.open(CCTV_HTTP_URL, "_blank");
    return true;
  }

  return false;
}

export default openCctvApp;
