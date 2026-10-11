import { createClient } from "@supabase/supabase-js";
import { openDB } from "idb";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || "https://jqpbgcmrlpfqnellznhz.supabase.co";
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcGJnY21ybHBmcW5lbGx6bmh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDkyMjcsImV4cCI6MjA4NzY4NTIyN30.rFHThZwo-caz0vFUUCoBeNFlUsTlOHqiQY_ds9vTwzw";

// Resilient dual-layer storage (localStorage + IndexedDB backup)
// This guarantees auth tokens survive across desktop app restarts even if macOS WKWebView clears transient localStorage.
const AUTH_DB_NAME = 'ceova-auth-store';
const AUTH_STORE_NAME = 'auth_tokens';

let idbPromise = null;
function getAuthDB() {
    if (typeof window === 'undefined' || !window.indexedDB) return null;
    if (!idbPromise) {
        idbPromise = openDB(AUTH_DB_NAME, 1, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(AUTH_STORE_NAME)) {
                    db.createObjectStore(AUTH_STORE_NAME);
                }
            }
        }).catch(err => {
            console.warn("[Auth Storage] IndexedDB initialization error:", err);
            return null;
        });
    }
    return idbPromise;
}

const isTauriEnv = () => typeof window !== 'undefined' && (
    window.__TAURI__ !== undefined ||
    window.__TAURI_INTERNALS__ !== undefined
);

async function loadFromDesktopDisk() {
    if (!isTauriEnv()) return null;
    try {
        const { invoke } = await import('@tauri-apps/api/core');
        const token = await invoke('load_desktop_session');
        if (token && typeof token === 'string' && token.trim()) {
            console.log("[Auth Storage] Successfully restored session from ~/.ceova/session.json!");
            return token.trim();
        }
    } catch (e) {
        console.warn("[Auth Storage] load_desktop_session error:", e);
    }
    return null;
}

async function saveToDesktopDisk(token) {
    if (!isTauriEnv() || !token) return;
    try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('save_desktop_session', { token: String(token) });
        console.log("[Auth Storage] Mirrored session to ~/.ceova/session.json");
    } catch (e) {
        console.warn("[Auth Storage] save_desktop_session error:", e);
    }
}

async function clearFromDesktopDisk() {
    if (!isTauriEnv()) return;
    try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('clear_desktop_session');
        console.log("[Auth Storage] Cleared ~/.ceova/session.json on explicit logout");
    } catch (e) {
        console.warn("[Auth Storage] clear_desktop_session error:", e);
    }
}

export const persistentAuthStorage = {
    async getItem(key) {
        if (typeof window === 'undefined') return null;

        // 1. Try synchronous localStorage first for fastest retrieval
        try {
            const val = window.localStorage.getItem(key);
            if (val) {
                // Ensure desktop disk is kept in sync
                saveToDesktopDisk(val);
                return val;
            }
        } catch (e) {
            console.warn("[Auth Storage] localStorage getItem error:", e);
        }

        // 2. Fallback to IndexedDB
        try {
            const db = await getAuthDB();
            if (db) {
                const storedVal = await db.get(AUTH_STORE_NAME, key);
                if (storedVal) {
                    console.log(`[Auth Storage] Recovered ${key} from IndexedDB backup!`);
                    try {
                        window.localStorage.setItem(key, storedVal);
                    } catch (e) {}
                    saveToDesktopDisk(storedVal);
                    return storedVal;
                }
            }
        } catch (e) {
            console.warn("[Auth Storage] IndexedDB getItem error:", e);
        }

        // 3. Fallback to native OS disk (~/.ceova/session.json) - survives app deletion & reinstallation!
        const desktopDiskVal = await loadFromDesktopDisk();
        if (desktopDiskVal) {
            try {
                window.localStorage.setItem(key, desktopDiskVal);
                const db = await getAuthDB();
                if (db) await db.put(AUTH_STORE_NAME, desktopDiskVal, key);
            } catch (e) {}
            return desktopDiskVal;
        }

        return null;
    },

    async setItem(key, value) {
        if (typeof window === 'undefined') return;

        // 1. Save to localStorage
        try {
            window.localStorage.setItem(key, value);
        } catch (e) {
            console.warn("[Auth Storage] localStorage setItem error:", e);
        }

        // 2. Mirror into IndexedDB
        try {
            const db = await getAuthDB();
            if (db) {
                await db.put(AUTH_STORE_NAME, value, key);
            }
        } catch (e) {
            console.warn("[Auth Storage] IndexedDB setItem error:", e);
        }

        // 3. Mirror into native OS disk ~/.ceova/session.json
        await saveToDesktopDisk(value);
    },

    async removeItem(key) {
        if (typeof window === 'undefined') return;

        // 1. Remove from localStorage
        try {
            window.localStorage.removeItem(key);
        } catch (e) {
            console.warn("[Auth Storage] localStorage removeItem error:", e);
        }

        // 2. Remove from IndexedDB
        try {
            const db = await getAuthDB();
            if (db) {
                await db.delete(AUTH_STORE_NAME, key);
            }
        } catch (e) {
            console.warn("[Auth Storage] IndexedDB removeItem error:", e);
        }

        // 3. Remove from native OS disk ~/.ceova/session.json
        await clearFromDesktopDisk();
    }
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: persistentAuthStorage,
        storageKey: 'ceova-auth-token'
    }
});

// Check existing session in background
if (typeof window !== 'undefined') {
    persistentAuthStorage.getItem('ceova-auth-token').then(token => {
        console.log("Auth persistence check:", token ? "Found existing session" : "No session in storage");
    });
}