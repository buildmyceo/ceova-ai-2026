import { createClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || "https://jqpbgcmrlpfqnellznhz.supabase.co";
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcGJnY21ybHBmcW5lbGx6bmh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDkyMjcsImV4cCI6MjA4NzY4NTIyN30.rFHThZwo-caz0vFUUCoBeNFlUsTlOHqiQY_ds9vTwzw";

export const capacitorAuthStorage = {
    async getItem(key) {
        if (typeof window === "undefined") return null;

        // 1. Try localStorage first for fast retrieval
        try {
            const val = window.localStorage.getItem(key);
            if (val) {
                if (Capacitor.isNativePlatform()) {
                    Preferences.set({ key, value: val }).catch(() => {});
                }
                return val;
            }
        } catch (e) {
            console.warn("[Auth Storage] localStorage getItem error:", e);
        }

        // 2. Fallback to Android Native SharedPreferences (Capacitor Preferences)
        // Automatically backed up and restored by Android Auto Backup across app reinstallation!
        if (Capacitor.isNativePlatform()) {
            try {
                const { value } = await Preferences.get({ key });
                if (value && typeof value === "string" && value.trim()) {
                    console.log("[Auth Storage] Successfully restored session from native SharedPreferences across reinstallation!");
                    try {
                        window.localStorage.setItem(key, value);
                    } catch (e) {}
                    return value;
                }
            } catch (e) {
                console.warn("[Auth Storage] Preferences getItem error:", e);
            }
        }

        return null;
    },

    async setItem(key, value) {
        if (typeof window === "undefined") return;

        try {
            window.localStorage.setItem(key, value);
        } catch (e) {
            console.warn("[Auth Storage] localStorage setItem error:", e);
        }

        if (Capacitor.isNativePlatform() && value) {
            try {
                await Preferences.set({ key, value });
                console.log("[Auth Storage] Mirrored session to native SharedPreferences");
            } catch (e) {
                console.warn("[Auth Storage] Preferences setItem error:", e);
            }
        }
    },

    async removeItem(key) {
        if (typeof window === "undefined") return;

        try {
            window.localStorage.removeItem(key);
        } catch (e) {
            console.warn("[Auth Storage] localStorage removeItem error:", e);
        }

        if (Capacitor.isNativePlatform()) {
            try {
                await Preferences.remove({ key });
                console.log("[Auth Storage] Cleared native SharedPreferences on explicit logout");
            } catch (e) {
                console.warn("[Auth Storage] Preferences removeItem error:", e);
            }
        }
    }
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: capacitorAuthStorage,
        storageKey: "ceova-auth-token"
    }
});

if (typeof window !== "undefined") {
    capacitorAuthStorage.getItem("ceova-auth-token").then(token => {
        console.log("Auth persistence check:", token ? "Found existing session" : "No session in storage");
    });
}
