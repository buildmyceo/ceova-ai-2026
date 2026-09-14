import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthProvider';
import '../App.css';
import './Login.css';
import APP_CONFIG from '../config/appConfig';

export default function Login({ onClose }) {
    const { session, loading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [themeMod, setThemeMod] = useState('dark');

    // Theme detection
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
        setThemeMod(mediaQuery.matches ? 'light' : 'dark');
        const handleChange = (e) => setThemeMod(e.matches ? 'light' : 'dark');
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const handleEmailLogin = async () => {
        if (!email || !password) return setAuthError("Fill in both fields.");
        setAuthError("Signing in...");
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setAuthError(error.message);
        else setAuthError("");
    };



    // Listen for the oauth-callback deep link event from Tauri (ceova://auth/callback#access_token=...)
    useEffect(() => {
        let unlisten = null;

        const setupDeepLinkListener = async () => {
            const isTauri = typeof window !== 'undefined' && window.__TAURI__ !== undefined;
            if (!isTauri) return;

            try {
                const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
                unlisten = await onOpenUrl(async (urls) => {
                    const rawUrl = urls[0];
                    if (!rawUrl) return;
                    console.log('[DeepLink] onOpenUrl received:', rawUrl);

                    try {
                        // Parse the URL: ceova://auth/callback#access_token=...&refresh_token=...
                        // Or it might be a query string: ceova://auth/callback?access_token=...
                        let params = null;
                        const hashIdx = rawUrl.indexOf('#');
                        const queryIdx = rawUrl.indexOf('?');

                        if (hashIdx !== -1) {
                            params = new URLSearchParams(rawUrl.substring(hashIdx + 1));
                        } else if (queryIdx !== -1) {
                            params = new URLSearchParams(rawUrl.substring(queryIdx + 1));
                        }

                        if (!params) throw new Error('No params in deep link URL');

                        const access_token = params.get('access_token');
                        const refresh_token = params.get('refresh_token');

                        if (access_token && refresh_token) {
                            setAuthError("Completing login...");
                            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
                            if (error) throw error;
                            setAuthError("");
                        } else {
                            // PKCE flow: might have a 'code' param
                            const code = params.get('code');
                            if (code) {
                                setAuthError("Completing login...");
                                const { error } = await supabase.auth.exchangeCodeForSession(code);
                                if (error) throw error;
                                setAuthError("");
                            } else {
                                throw new Error('No auth tokens found in callback URL');
                            }
                        }
                    } catch (e) {
                        setAuthError("Login failed: " + (e.message || "Unknown error"));
                        console.error('[DeepLink] Token exchange error:', e);
                    }
                });
            } catch (e) {
                console.error('[DeepLink] Failed to setup listener:', e);
            }
        };

        setupDeepLinkListener();
        return () => { if (unlisten) unlisten(); };
    }, []);

    const handleGoogleLogin = async () => {
        setAuthError("Connecting to Google...");
        try {
            // Tauri v2 with withGlobalTauri:true injects window.__TAURI__
            // Also check for __TAURI_INTERNALS__ as fallback
            const isTauri = typeof window !== 'undefined' && (
                window.__TAURI__ !== undefined ||
                window.__TAURI_INTERNALS__ !== undefined
            );

            console.log('[Login] isTauri:', isTauri, '__TAURI__:', typeof window.__TAURI__, '__TAURI_INTERNALS__:', typeof window.__TAURI_INTERNALS__);

            if (isTauri) {
                console.log('[Login] Using Tauri deep-link OAuth flow');
                
                // Step 1: Get the OAuth URL from Supabase without redirecting
                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: 'ceova://auth/callback',
                        skipBrowserRedirect: true,
                    }
                });

                if (error) {
                    setAuthError(error.message);
                    return;
                }

                // Step 2: Open the URL in the system browser
                const { open } = await import('@tauri-apps/plugin-shell');
                await open(data.url);
                setAuthError("✓ Browser opened — complete Google sign-in there. This window will update automatically.");
            } else {
                console.log('[Login] Using web OAuth flow');
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: APP_CONFIG.getRedirectUrl('/auth/callback')
                    }
                });

                if (error) {
                    setAuthError(error.message);
                }
            }
        } catch (e) {
            const msg = e?.message || JSON.stringify(e) || "Unknown error";
            setAuthError("Failed to connect: " + msg);
            console.error("Google Login Error (full):", e);
        }
    };



    const logoSrc = '/ceova logo dark.png';
    
    return (
        <div className="auth-split-container">
            <div className="animated-bg">
                <div className="glow glow-1"></div>
                <div className="glow glow-2"></div>
                <div className="grid-overlay dots"></div>
            </div>
            <div className="auth-full-panel">
                <img src={logoSrc} alt="Ceova Logo" className="brand-logo-small" style={{ filter: 'var(--logo-filter)' }} />
                <div className="auth-form-wrapper">
                    <h1 className="auth-heading">Sign in to your account</h1>
                    
                    {authError && (
                        <div className={`auth-error-chip ${authError.includes("Connecting") || authError.includes("Signing") ? "info" : ""}`}>
                            {authError}
                        </div>
                    )}
                    
                    <button className="auth-provider-btn" onClick={handleGoogleLogin}>
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width="20" height="20" style={{ marginRight: '8px' }} />
                        Sign in with Google
                    </button>
                    
                    <div className="auth-divider">
                        <span>or</span>
                    </div>

                    <form onSubmit={(e) => e.preventDefault()} className="auth-email-form">
                        <input 
                            className="auth-input-pill"
                            type="email" 
                            placeholder="Email address" 
                            required 
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                        <input 
                            className="auth-input-pill"
                            type="password" 
                            placeholder="Password" 
                            required 
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                        <button className="auth-submit-btn" onClick={handleEmailLogin}>Sign in with email</button>
                    </form>

                    <div className="auth-switch-text">
                        Don't have an account? <Link to="/signup" className="auth-link">Sign up</Link>
                    </div>

                </div>
                
                <div className="auth-footer-terms" style={{ marginTop: '20px', fontSize: '0.8rem', color: '#888', textAlign: 'center' }}>
                    By continuing you agree to our <Link to="/legal/terms-conditions" target="_blank">Terms & Conditions</Link> and acknowledge our <Link to="/legal/privacy-policy" target="_blank">Privacy Policy</Link>.
                </div>
            </div>
        </div>
    );
}
