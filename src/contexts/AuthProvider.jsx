import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { cacheManager } from '../services/CacheManager';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let unlistenDeepLink = null;

    const handleDeepLinkUrl = async (rawUrl) => {
      if (!rawUrl || typeof rawUrl !== 'string') return;
      console.log('[AuthProvider DeepLink] Received URL:', rawUrl);

      try {
        let params = null;
        const hashIdx = rawUrl.indexOf('#');
        const queryIdx = rawUrl.indexOf('?');

        if (hashIdx !== -1) {
          params = new URLSearchParams(rawUrl.substring(hashIdx + 1));
        } else if (queryIdx !== -1) {
          params = new URLSearchParams(rawUrl.substring(queryIdx + 1));
        }

        if (!params) return;

        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        if (access_token && refresh_token) {
          console.log('[AuthProvider DeepLink] Setting session from tokens...');
          const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) {
            console.error('[AuthProvider DeepLink] Error setting session:', error);
          } else if (data?.session && mounted) {
            console.log('[AuthProvider DeepLink] Session set successfully for:', data.session.user.email);
            setSession(data.session);
            setUser(data.session.user);
            setLoading(false);
          }
        } else {
          const code = params.get('code');
          if (code) {
            console.log('[AuthProvider DeepLink] Exchanging code for session...');
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
              console.error('[AuthProvider DeepLink] Error exchanging code:', error);
            } else if (data?.session && mounted) {
              console.log('[AuthProvider DeepLink] Session established via code for:', data.session.user.email);
              setSession(data.session);
              setUser(data.session.user);
              setLoading(false);
            }
          }
        }

        // Focus and bring app window to front
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const appWindow = getCurrentWindow();
          await appWindow.unminimize();
          await appWindow.setFocus();
        } catch (e) {
          // Ignore if window focus API not accessible
        }
      } catch (e) {
        console.error('[AuthProvider DeepLink] Failed to process URL:', e);
      }
    };

    // Initialize Deep Link listener for desktop app
    const isTauri = typeof window !== 'undefined' && (
      window.__TAURI__ !== undefined ||
      window.__TAURI_INTERNALS__ !== undefined
    );

    if (isTauri) {
      import('@tauri-apps/plugin-deep-link')
        .then(async ({ onOpenUrl, getCurrent }) => {
          try {
            const currentUrls = await getCurrent();
            if (currentUrls && currentUrls.length > 0) {
              for (const url of currentUrls) {
                await handleDeepLinkUrl(url);
              }
            }
          } catch (e) {
            console.warn('[AuthProvider DeepLink] getCurrent error:', e);
          }

          unlistenDeepLink = await onOpenUrl(async (urls) => {
            console.log('[AuthProvider DeepLink] onOpenUrl triggered:', urls);
            if (Array.isArray(urls)) {
              for (const url of urls) {
                await handleDeepLinkUrl(url);
              }
            }
          });
        })
        .catch(err => console.warn('[AuthProvider DeepLink] Plugin import error:', err));
    }

    // Detect if we are in an OAuth redirect flow
    const isOAuthRedirect = window.location.hash.includes('access_token=') || 
                           window.location.search.includes('code=');

    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session) {
          console.log("[AuthProvider] Session restored successfully for:", session.user?.email);
          // Refresh session if token is near expiration
          if (session.expires_at && (session.expires_at * 1000) < (Date.now() + 60000)) {
            console.log("[AuthProvider] Token expiring soon, refreshing session...");
            try {
              const { data: refreshed, error: refErr } = await supabase.auth.refreshSession();
              if (!refErr && refreshed?.session) {
                if (mounted) {
                  setSession(refreshed.session);
                  setUser(refreshed.session.user);
                }
                return;
              }
            } catch (rErr) {
              console.warn("[AuthProvider] Refresh session error:", rErr);
            }
          }
          if (mounted) {
            setSession(session);
            setUser(session.user);
          }
        } else {
          // Fallback check for user (sometimes more reliable in some environments)
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          if (!userError && user && mounted) {
            console.log("[AuthProvider] User found via getUser fallback:", user.email);
            setUser(user);
          }
        }
      } catch (err) {
        console.error("[AuthProvider] Session check error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        console.log("[AuthProvider] Auth event:", event, session ? "Session: YES" : "Session: NO");

        if (session) {
          setSession(session);
          setUser(session.user);
          setLoading(false);

          // Handle Google Token Capture strictly on SIGNED_IN
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            
            // --- NEW DEVICE LOGIN DETECTION ---
            const deviceKnownKey = `ceova_device_known_${session.user.id}`;
            const deviceKnown = localStorage.getItem(deviceKnownKey);
            if (!deviceKnown) {
              const userAgent = navigator.userAgent;
              const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
              
              const deviceInfo = {
                device: /Mac/i.test(userAgent) ? 'Mac' : /Win/i.test(userAgent) ? 'Windows' : /Linux/i.test(userAgent) ? 'Linux' : /Mobi/i.test(userAgent) ? 'Mobile' : 'Unknown Device',
                location: timezone || 'Unknown Location',
                login_time: new Date().toLocaleString()
              };

              fetch(`${supabase.supabaseUrl}/functions/v1/email-engine`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                  event: 'new_device_login',
                  user_id: session.user.id,
                  data: deviceInfo
                })
              }).catch(e => console.error("Error triggering new device login email:", e));

              localStorage.setItem(deviceKnownKey, 'true');
            }
            // ----------------------------------

            const access_token = session.provider_token;
            const refresh_token = session.provider_refresh_token;
            const user_id = session.user.id;

            console.log("ACCESS:", access_token);
            console.log("REFRESH:", refresh_token);
            
            if (access_token) {
              console.log('[AuthProvider] Google token found in session.');
              // We deliberately do NOT auto-upsert to user_google_tokens here. 
              // AuthCallback.jsx handles saving the token when the user explicitly connects it.
              // Auto-upserting here would prevent the user from ever disconnecting their Google integrations.

            } else {
              const isGoogle = session.user?.app_metadata?.provider === 'google';
              if (isGoogle && event === 'SIGNED_IN') {
                  console.warn('[AuthProvider] SIGNED_IN event detected for Google but provider_token is MISSING. Ensure "prompt=consent" was used.');
              }
            }
          }
        } else if (event === 'SIGNED_OUT') {
          console.log("[AuthProvider] Explicit SIGNED_OUT event received. Clearing session and cache.");
          setSession(null);
          setUser(null);
          setLoading(false);
          
          try {
            await cacheManager.clearAll();
            localStorage.removeItem('chat_id');
            console.log("[AuthProvider] Cleared local cache on explicit sign out");
          } catch(e) {
            console.error("[AuthProvider] Error clearing cache:", e);
          }
        } else if (event === 'INITIAL_SESSION') {
          console.log("[AuthProvider] INITIAL_SESSION with null session. Awaiting checkSession completion.");
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (unlistenDeepLink) unlistenDeepLink();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
