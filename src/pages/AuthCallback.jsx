import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Finalizing connection...");

  useEffect(() => {
    let mounted = true;

    // VERY IMPORTANT: Grab from hash immediately before Supabase strips it!
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const hashProviderToken = hashParams.get('provider_token');
    const hashProviderRefreshToken = hashParams.get('provider_refresh_token');

    if (hashProviderToken) {
      console.log("[AuthCallback] Found provider_token directly in hash!");
      localStorage.setItem('google_provider_token', hashProviderToken);
      if (hashProviderRefreshToken) {
        localStorage.setItem('google_refresh_token', hashProviderRefreshToken);
      }
    }

    const processSession = async (session) => {
      if (!session) return;
      
      const provider_token = session.provider_token || hashProviderToken || localStorage.getItem('google_provider_token');
      const provider_refresh_token = session.provider_refresh_token || hashProviderRefreshToken || localStorage.getItem('google_refresh_token');

      console.log("[AuthCallback] Session received, Provider Token present:", !!provider_token);

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

          const storedProvider = localStorage.getItem('oauth_provider');
          const providerName = storedProvider || session.user.app_metadata?.provider || "google";
          if (storedProvider) localStorage.removeItem('oauth_provider');

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
      } else {
        console.warn("[AuthCallback] No provider_token found.");
      }

      if (mounted) {
        // Return to library
        navigate("/library", { replace: true });
      }
    };

    // 1. Try to get session immediately
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) console.error("[AuthCallback] getSession error:", error);
      if (session) processSession(session);
    });

    // 2. Also listen for state change
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        processSession(session);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
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
