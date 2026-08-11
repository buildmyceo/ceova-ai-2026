import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handle = async () => {
      // Small delay to ensure session is available
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("[AuthCallback] Error getting session:", error);
        navigate("/login");
        return;
      }

      const session = data.session;
      if (!session) {
        console.warn("[AuthCallback] No session found, redirecting to login.");
        navigate("/login");
        return;
      }

      const provider_token = session.provider_token;
      const provider_refresh_token = session.provider_refresh_token;

      console.log("ACCESS:", provider_token);
      console.log("REFRESH:", provider_refresh_token);

      if (provider_token) {
        try {
          const newExpiry = Date.now() + (3500 * 1000); // roughly 1 hour

          // IMPORTANT: provider_refresh_token may be null on subsequent logins
          // Only save/update refresh_token if we actually received one
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

          const isDropbox = providerName === 'dropbox';
          const tableName = isDropbox ? "user_dropbox_tokens" : "user_google_tokens";
          if (isDropbox) {
            localStorage.setItem('dropbox_provider_token', provider_token);
          } else {
            localStorage.setItem('google_provider_token', provider_token);
          }

          const { error: dbError } = await supabase
            .from(tableName)
            .upsert(upsertData, { onConflict: 'user_id' });

          if (dbError) {
            console.error(`[AuthCallback] DB save error for ${providerName}:`, dbError);
          } else {
            console.log(`[AuthCallback] Successfully saved ${providerName} tokens to database!`, 
              provider_refresh_token ? "(with refresh token)" : "(access token only — will need reconnect when expired)");
          }
        } catch (err) {
          console.error("[AuthCallback] Failed to save tokens:", err);
        }
      } else {
        console.warn("[AuthCallback] No provider_token in session. Check if prompt=consent was used.");
      }

      // Finish by redirecting to dashboard
      navigate("/dashboard", { replace: true });
    };

    handle();
  }, [navigate]);

  return (
    <div className="auth-overlay">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', fontWeight: 500 }}>Finalizing connection...</p>
        <div className="spinner" /> 
      </div>
    </div>
  );
}
