import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthProvider';
import '../App.css';
import './Login.css';

import APP_CONFIG from '../config/appConfig';

export default function Signup({ onClose, onSwitchToLogin }) {
    const { session, loading } = useAuth();
    const [name, setName] = useState('');
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

    const [cooldownSeconds, setCooldownSeconds] = useState(0);

    // Cooldown countdown timer
    useEffect(() => {
        if (cooldownSeconds <= 0) return;
        const timer = setInterval(() => setCooldownSeconds((prev) => prev - 1), 1000);
        return () => clearInterval(timer);
    }, [cooldownSeconds]);

    const handleEmailSignup = async () => {
        if (!name || !email || !password) return setAuthError("Fill in all fields.");
        if (cooldownSeconds > 0) {
            return setAuthError(`Too many attempts. Please wait ${cooldownSeconds}s before trying again.`);
        }

        // Per-user / per-email rate limiter
        const normalizedEmail = email.trim().toLowerCase();
        const rateLimitKey = `signup_attempts_${normalizedEmail}`;
        const now = Date.now();
        let userAttempts = [];
        try {
            userAttempts = JSON.parse(localStorage.getItem(rateLimitKey) || '[]')
                .filter((timestamp) => now - timestamp < 60000); // 1-minute rolling window
        } catch (e) {
            userAttempts = [];
        }

        if (userAttempts.length >= 3) {
            setCooldownSeconds(60);
            return setAuthError("Too many signup attempts for this email. Please wait 60 seconds.");
        }

        userAttempts.push(now);
        try {
            localStorage.setItem(rateLimitKey, JSON.stringify(userAttempts));
        } catch (e) {}

        setAuthError("Signing up...");
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { 
                emailRedirectTo: window.location.origin,
                data: { full_name: name }
            }
        });
        if (error) {
            const msg = error.message || "";
            if (msg.toLowerCase().includes("rate limit")) {
                setAuthError("Email verification limit reached on server. Try 'Sign up with Google' or try again in a few minutes.");
            } else {
                setAuthError(msg);
            }
        } else if (data?.session) {
            setAuthError("");
            // Session established immediately
        } else {
            setAuthError("Check your email verification link!");
        }
    };

    // Listen for the oauth-callback deep link event from Tauri (ceova://auth/callback#access_token=...)
    useEffect(() => {
        let unlisten = null;

        const setupDeepLinkListener = async () => {
            const isTauri = typeof window !== 'undefined' && window.__TAURI__ !== undefined;
            if (!isTauri) return;

            try {
                const { listen } = await import('@tauri-apps/api/event');
                unlisten = await listen('oauth-callback', async (event) => {
                    const rawUrl = event.payload;
                    console.log('[DeepLink] oauth-callback received:', rawUrl);

                    try {
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
            const isTauri = typeof window !== 'undefined' && (
                window.__TAURI__ !== undefined ||
                window.__TAURI_INTERNALS__ !== undefined
            );

            console.log('[Login] isTauri:', isTauri, '__TAURI__:', typeof window.__TAURI__, '__TAURI_INTERNALS__:', typeof window.__TAURI_INTERNALS__);

            if (isTauri) {
                console.log('[Login] Using Tauri deep-link OAuth flow');
                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: 'ceova://auth/callback',
                        skipBrowserRedirect: true,
                    }
                });
                
                console.log('[Login] OAuth data:', data, 'error:', error);
                if (error) throw new Error('Supabase error: ' + error.message);
                if (!data?.url) throw new Error('No OAuth URL returned from Supabase');

                console.log('[Login] Opening URL in browser:', data.url);
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
                if (error) throw error;
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
                    <h1 className="auth-heading">Create your account</h1>
                    
                    {authError && (
                        <div className={`auth-error-chip ${authError.includes("Connecting") || authError.includes("Signing") || authError.includes("Check") ? "info" : ""}`}>
                            {authError}
                        </div>
                    )}
                    
                    <button className="auth-provider-btn" onClick={handleGoogleLogin}>
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width="20" height="20" style={{ marginRight: '8px' }} />
                        Sign up with Google
                    </button>
                    
                    <div className="auth-divider">
                        <span>or</span>
                    </div>

                    <form onSubmit={(e) => e.preventDefault()} className="auth-email-form">
                        <input 
                            className="auth-input-pill"
                            type="text" 
                            placeholder="Full Name" 
                            required 
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
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
                        <button className="auth-submit-btn" onClick={handleEmailSignup}>Sign up with email</button>
                    </form>

                    <div className="auth-switch-text">
                        Already have an account? <Link to="/login" className="auth-link">Sign in</Link>
                    </div>

                </div>
                
                <div className="auth-footer-terms" style={{ marginTop: '20px', fontSize: '0.8rem', color: '#888', textAlign: 'center' }}>
                    By continuing you agree to our <Link to="/legal/terms-conditions" target="_blank">Terms & Conditions</Link> and acknowledge our <Link to="/legal/privacy-policy" target="_blank">Privacy Policy</Link>.
                </div>
            </div>
        </div>
    );
}
