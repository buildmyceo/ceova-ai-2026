import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Finalizing connection...");

  useEffect(() => {
    let mounted = true;
    let handled = false;

    // 1. Check if tokens or code exist in URL
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const searchParams = new URLSearchParams(window.location.search);

    const hashAccessToken = hashParams.get('access_token');
    const hashRefreshToken = hashParams.get('refresh_token');

    // If implicit flow returned access_token and refresh_token, set session immediately
    if (hashAccessToken && hashRefreshToken) {
      supabase.auth.setSession({
        access_token: hashAccessToken,
        refresh_token: hashRefreshToken
      }).catch(err => {
        console.warn("[AuthCallback] setSession error:", err);
      });
    }

    // 2. Grab provider tokens from hash or search before they are stripped
    const hashProviderToken = hashParams.get('provider_token') || searchParams.get('provider_token');
    const hashProviderRefreshToken = hashParams.get('provider_refresh_token') || searchParams.get('provider_refresh_token');

    if (hashProviderToken) {
      console.log("[AuthCallback] Found provider_token in callback URL!");
      localStorage.setItem('google_provider_token', hashProviderToken);
      if (hashProviderRefreshToken) {
        localStorage.setItem('google_refresh_token', hashProviderRefreshToken);
      }
    }

    const processSession = async (session) => {
      if (!session || handled) return;
      handled = true;

      const provider_token = session.provider_token || hashProviderToken || localStorage.getItem('google_provider_token');
      const provider_refresh_token = session.provider_refresh_token || hashProviderRefreshToken || localStorage.getItem('google_refresh_token');

      console.log("[AuthCallback] Session received, Provider Token present:", !!provider_token);

      const storedProvider = localStorage.getItem('oauth_provider');
      const isConnectorFlow = !!storedProvider;
      if (storedProvider) localStorage.removeItem('oauth_provider');

      if (provider_token) {
        try {
          const newExpiry = Date.now() + (3500 * 1000); // roughly 1 hour

          const upsertData = {
            user_id: session.user.id,
            access_token: provider_token,
            expiry_date: newExpiry,
            updated_at: new Date().toISOString()
          };

          if (provider_refresh_token) {
            upsertData.refresh_token = provider_refresh_token;
          }

          localStorage.setItem('google_provider_token', provider_token);

          const { error: dbError } = await supabase
            .from("user_google_tokens")
            .upsert(upsertData, { onConflict: 'user_id' });

          if (dbError) {
            console.error("[AuthCallback] DB save error for google tokens:", dbError);
          } else {
            console.log("[AuthCallback] Successfully saved Google tokens to database!");
          }
        } catch (err) {
          console.error("[AuthCallback] Failed to save tokens:", err);
        }
      }

      // If running in an external browser, bounce session directly into native CEOVA app!
      const isNative = typeof window !== 'undefined' && (
        (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
        window.__TAURI__ !== undefined
      );

      if (!isNative && session.access_token && session.refresh_token) {
        let appDeepLink = `ceova://auth/callback#access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}`;
        if (provider_token) {
          appDeepLink += `&provider_token=${encodeURIComponent(provider_token)}`;
        }
        if (provider_refresh_token) {
          appDeepLink += `&provider_refresh_token=${encodeURIComponent(provider_refresh_token)}`;
        }
        if (mounted) {
          setStatus("Signed in! Returning to CEOVA app...");
        }
        try {
          window.location.href = appDeepLink;
          setTimeout(() => {
            if (mounted) navigate("/dashboard", { replace: true });
          }, 2500);
          return;
        } catch (e) {
          console.warn("[AuthCallback] Deep link bounce failed:", e);
        }
      }

      if (mounted) {
        setStatus("Redirecting to dashboard...");
        if (isConnectorFlow) {
          navigate("/dashboard", { replace: true, state: { triggerSync: true, openLibrary: true } });
        } else {
          navigate("/dashboard", { replace: true });
        }
      }
    };

    // 3. Check for PKCE authorization code (?code=...)
    const code = searchParams.get('code');
    if (code) {
      console.log("[AuthCallback] Detected PKCE auth code, exchanging for session...");
      setStatus("Exchanging authorization code...");
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error) {
          console.error("[AuthCallback] exchangeCodeForSession error:", error);
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
              processSession(session);
            } else {
              setStatus(`Login failed: ${error.message}`);
              setTimeout(() => { if (mounted) navigate("/login", { replace: true }); }, 2500);
            }
          });
        } else if (data?.session) {
          console.log("[AuthCallback] PKCE Code exchanged successfully!");
          processSession(data.session);
        }
      }).catch(err => {
        console.error("[AuthCallback] Code exchange exception:", err);
      });
    } else {
      // 4. Try to get session immediately if implicit flow or already active
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (error) console.error("[AuthCallback] getSession error:", error);
        if (session) processSession(session);
      });
    }

    // 5. Also listen for auth state change
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[AuthCallback] Auth state event:", event);
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
        processSession(session);
      }
    });

    // 6. Liveness fallback timeout to prevent staying stuck on screen
    const timeoutId = setTimeout(async () => {
      if (!mounted || handled) return;
      console.log("[AuthCallback] Fallback timer fired, checking session...");
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await processSession(session);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          if (mounted) navigate("/dashboard", { replace: true });
          return;
        }

        const localAuth = localStorage.getItem('ceova-auth-token');
        if (localAuth) {
          if (mounted) navigate("/dashboard", { replace: true });
          return;
        }

        setStatus("Session not found. Redirecting to login...");
        setTimeout(() => {
          if (mounted) navigate("/login", { replace: true });
        }, 1500);
      } catch (timeoutErr) {
        console.warn("[AuthCallback] Fallback error:", timeoutErr);
        if (mounted) navigate("/login", { replace: true });
      }
    }, 4000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [navigate]);

  return (
    <div className="auth-overlay">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', fontWeight: 500 }}>{status}</p>
        <div className="spinner" /> 
      </div>
    </div>
  );
}
