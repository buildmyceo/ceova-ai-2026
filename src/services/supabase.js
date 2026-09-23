import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || "https://jqpbgcmrlpfqnellznhz.supabase.co";
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcGJnY21ybHBmcW5lbGx6bmh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDkyMjcsImV4cCI6MjA4NzY4NTIyN30.rFHThZwo-caz0vFUUCoBeNFlUsTlOHqiQY_ds9vTwzw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // SECURITY FIX: Guard localStorage to prevent crashes in SSR/test/service-worker environments
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: 'ceova-auth-token' // Custom key to avoid collisions
    }
});

// DEBUG: Verify storage on load
console.log("Supabase initialized with version 1.1.5 persistence logic.");
if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('ceova-auth-token');
    console.log("Auth persistence check:", token ? "Found existing session" : "No session in storage");
}