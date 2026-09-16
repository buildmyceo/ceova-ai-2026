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

    // Detect if we are in an OAuth redirect flow
    const isOAuthRedirect = window.location.hash.includes('access_token=') || 
                           window.location.search.includes('code=');

    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session) {
          console.log("[AuthProvider] Session restored successfully for:", session.user.email);
          setSession(session);
          setUser(session.user);
        } else {
          // Fallback check for user (sometimes more reliable in some environments)
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          if (!userError && user) {
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
        } else {
          setSession(null);
          setUser(null);
          
          try {
            await cacheManager.clearAll();
            localStorage.removeItem('chat_id');
            console.log("[AuthProvider] Cleared local cache on sign out / missing session");
          } catch(e) {
            console.error("[AuthProvider] Error clearing cache:", e);
          }

          if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION' || !isOAuthRedirect) {
            setLoading(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
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
