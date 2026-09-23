import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Finalizing connection...");
  const [deepLinkUrl, setDeepLinkUrl] = useState(null);

  useEffect(() => {
    let mounted = true;
    let handled = false;

    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const searchParams = new URLSearchParams(window.location.search);

    const hashProviderToken = hashParams.get('provider_token') || searchParams.get('provider_token');
    const hashProviderRefreshToken = hashParams.get('provider_refresh_token') || searchParams.get('provider_refresh_token');

    if (hashProviderToken) {
      console.log("[AuthCallback] Found provider_token directly in URL!");
      localStorage.setItem('google_provider_token', hashProviderToken);
      if (hashProviderRefreshToken) {
        localStorage.setItem('google_refresh_token', hashProviderRefreshToken);
      }
    }

    const processSession = async (session) => {
      if (!session || handled) return;
      handled = true;

      const isTauri = typeof window !== 'undefined' && (
        window.__TAURI__ !== undefined ||
        window.__TAURI_INTERNALS__ !== undefined
      );

      const provider_token = session.provider_token || hashProviderToken || localStorage.getItem('google_provider_token');
      const provider_refresh_token = session.provider_refresh_token || hashProviderRefreshToken || localStorage.getItem('google_refresh_token');

      console.log("[AuthCallback] Session received, Provider Token present:", !!provider_token, "isTauri:", isTauri);

      const storedProvider = localStorage.getItem('oauth_provider');
      const isConnectorFlow = !!storedProvider;
      const providerName = storedProvider || session.user?.app_metadata?.provider || "google";
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

          const tableName = "user_google_tokens";
          localStorage.setItem('google_provider_token', provider_token);

          const { error: dbError } = await supabase
            .from(tableName)
            .upsert(upsertData, { onConflict: 'user_id' });

          if (dbError) {
            console.error(`[AuthCallback] DB save error for ${providerName}:`, dbError);
          } else {
            console.log(`[AuthCallback] Successfully saved ${providerName} tokens to database!`);
          }
        } catch (err) {
          console.error("[AuthCallback] Failed to save tokens:", err);
        }
      }

      // If running in browser outside of Tauri, bounce session into Tauri desktop app!
      if (!isTauri && session.access_token && session.refresh_token) {
        const appDeepLink = `ceova://auth/callback#access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}`;
        if (mounted) {
          setDeepLinkUrl(appDeepLink);
          setStatus("Signed in! Redirecting to CEOVA desktop app...");
        }

        try {
          window.location.href = appDeepLink;
        } catch (e) {
          console.warn("[AuthCallback] Auto deep link failed:", e);
        }
        return;
      }

      if (mounted) {
        setStatus("Redirecting to dashboard...");
        if (isConnectorFlow) {
          navigate("/dashboard", { replace: true, state: { triggerSync: true, openLibrary: true } });
        } else {
          navigate("/dashboard", { replace: true, state: { triggerSync: true } });
        }
      }
    };

    // 1. Check for PKCE authorization code (?code=...)
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
      // 2. Try to get session immediately
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (error) console.error("[AuthCallback] getSession error:", error);
        if (session) processSession(session);
      });
    }

    // 3. Also listen for state change
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[AuthCallback] Auth state event:", event);
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
        processSession(session);
      }
    });

    // 4. Liveness fallback timeout to prevent staying stuck on screen
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', maxWidth: '400px', textAlign: 'center', padding: '24px' }}>
        <p style={{ color: 'var(--text-muted, #fff)', fontSize: '1.2rem', fontWeight: 500 }}>{status}</p>
        
        {deepLinkUrl ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
            <a
              href={deepLinkUrl}
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                background: '#ffffff',
                color: '#000000',
                borderRadius: '8px',
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                cursor: 'pointer'
              }}
            >
              Open CEOVA Desktop App
            </a>
            <span style={{ fontSize: '0.85rem', color: '#888' }}>
              If the CEOVA app didn't open automatically, click the button above.
            </span>
          </div>
        ) : (
          <div className="spinner" />
        )}
      </div>
    </div>
  );
}
