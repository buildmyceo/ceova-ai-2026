import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthProvider';
import '../App.css';
import './Login.css';
import APP_CONFIG from '../config/appConfig';
import { COUNTRY_CODES } from '../constants/countryCodes';

export default function Login({ onClose }) {
    const { session, loading } = useAuth();
    const [loginMethod, setLoginMethod] = useState('phone'); // 'phone' or 'email'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [countryCode, setCountryCode] = useState('+91');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [phoneStep, setPhoneStep] = useState('phone'); // 'phone' or 'otp'
    const [phoneOtp, setPhoneOtp] = useState(['', '', '', '', '', '']);
    const [phoneLoading, setPhoneLoading] = useState(false);
    const [resendTimer, setResendTimer] = useState(60);
    const [canResend, setCanResend] = useState(false);
    const [authError, setAuthError] = useState('');
    const [themeMod, setThemeMod] = useState('dark');
    const otpRefs = useRef([]);

    // Timer for OTP resend countdown
    useEffect(() => {
        let interval = null;
        if (phoneStep === 'otp' && resendTimer > 0) {
            interval = setInterval(() => {
                setResendTimer(prev => {
                    if (prev <= 1) {
                        setCanResend(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [phoneStep, resendTimer]);

    // Theme detection
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
        setThemeMod(mediaQuery.matches ? 'light' : 'dark');
        const handleChange = (e) => setThemeMod(e.matches ? 'light' : 'dark');
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const fullPhone = `${countryCode}${phoneNumber.replace(/\D/g, '')}`;

    const [linkedAccounts, setLinkedAccounts] = useState([]);
    const [selectedLoginEmail, setSelectedLoginEmail] = useState('');

    const handleSendPhoneOtp = async (overrideEmail = '') => {
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        if (cleanNumber.length < 7) {
            setAuthError("Please enter a valid phone number.");
            return;
        }

        const emailToSend = overrideEmail || selectedLoginEmail;

        setAuthError("Sending OTP code...");
        setPhoneLoading(true);

        try {
            const { data: res, error: fnErr } = await supabase.functions.invoke('send-sms-hook', {
                body: {
                    action: 'send-login-otp',
                    phone: fullPhone,
                    email: emailToSend || undefined
                }
            });

            if (fnErr || (res && res.success === false)) {
                throw new Error(res?.error || fnErr?.message || "Failed to send OTP.");
            }

            if (res?.require_account_selection && Array.isArray(res?.accounts)) {
                setLinkedAccounts(res.accounts);
                setAuthError("Select which account you wish to sign in with:");
                return;
            }

            if (res?.full_email) {
                setSelectedLoginEmail(res.full_email);
            }

            setAuthError("");
            setPhoneStep('otp');
            setResendTimer(60);
            setCanResend(false);
            setPhoneOtp(['', '', '', '', '', '']);
            setTimeout(() => otpRefs.current[0]?.focus(), 100);
        } catch (err) {
            setAuthError(err?.message || "Failed to send OTP.");
        } finally {
            setPhoneLoading(false);
        }
    };

    const handlePhoneOtpChange = (index, value) => {
        const digit = value.replace(/\D/g, '').slice(-1);
        const newOtp = [...phoneOtp];
        newOtp[index] = digit;
        setPhoneOtp(newOtp);

        if (digit && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handlePhoneOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !phoneOtp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleVerifyPhoneOtp = async () => {
        const token = phoneOtp.join('');
        if (token.length !== 6) {
            setAuthError("Please enter the full 6-digit OTP code.");
            return;
        }

        setAuthError("Verifying OTP...");
        setPhoneLoading(true);

        try {
            const { data: res, error: fnErr } = await supabase.functions.invoke('send-sms-hook', {
                body: {
                    action: 'verify-login-otp',
                    phone: fullPhone,
                    otp: token,
                    email: selectedLoginEmail || undefined
                }
            });

            if (fnErr || (res && res.success === false)) {
                throw new Error(res?.error || fnErr?.message || "Invalid or expired verification code.");
            }

            if (!res?.token_hash) {
                throw new Error("Could not authenticate session.");
            }

            const { error: verifyError } = await supabase.auth.verifyOtp({
                token_hash: res.token_hash,
                type: 'magiclink'
            });

            if (verifyError) {
                throw verifyError;
            }

            setAuthError("");
            // AuthProvider will automatically detect session and redirect
        } catch (err) {
            setAuthError(err?.message || "Verification failed. Please try again.");
        } finally {
            setPhoneLoading(false);
        }
    };

    const handleResendPhoneOtp = async () => {
        if (!canResend) return;
        setAuthError("Resending OTP...");
        setPhoneLoading(true);
        try {
            const { data: res, error: fnErr } = await supabase.functions.invoke('send-sms-hook', {
                body: {
                    action: 'send-login-otp',
                    phone: fullPhone,
                    email: selectedLoginEmail || undefined
                }
            });
            if (fnErr || (res && res.success === false)) {
                throw new Error(res?.error || fnErr?.message || "Failed to resend OTP.");
            }
            setAuthError("");
            setResendTimer(60);
            setCanResend(false);
        } catch (err) {
            setAuthError(err?.message || "Failed to resend OTP.");
        } finally {
            setPhoneLoading(false);
        }
    };

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
                        <span>or continue with</span>
                    </div>

                    <div className="auth-tabs">
                        <button 
                            type="button"
                            className={`auth-tab-btn ${loginMethod === 'phone' ? 'active' : ''}`}
                            onClick={() => { setLoginMethod('phone'); setAuthError(''); }}
                        >
                            Phone (OTP)
                        </button>
                        <button 
                            type="button"
                            className={`auth-tab-btn ${loginMethod === 'email' ? 'active' : ''}`}
                            onClick={() => { setLoginMethod('email'); setAuthError(''); }}
                        >
                            Email
                        </button>
                    </div>

                    {loginMethod === 'phone' ? (
                        phoneStep === 'phone' ? (
                            <form onSubmit={(e) => { e.preventDefault(); handleSendPhoneOtp(); }} className="auth-email-form">
                                <div className="auth-phone-row">
                                    <select 
                                        className="auth-country-select"
                                        value={countryCode}
                                        onChange={(e) => setCountryCode(e.target.value)}
                                    >
                                        {COUNTRY_CODES.map((c) => (
                                            <option key={`${c.code}-${c.country}`} value={c.code}>
                                                {c.flag} {c.code}
                                            </option>
                                        ))}
                                    </select>
                                    <input 
                                        className="auth-input-pill"
                                        type="tel" 
                                        placeholder="Phone number" 
                                        required 
                                        value={phoneNumber}
                                        onChange={e => setPhoneNumber(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                {linkedAccounts.length > 1 && (
                                    <div style={{ margin: '12px 0', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                                        <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Multiple accounts found. Select one to sign in:</div>
                                        {linkedAccounts.map(acc => (
                                            <button
                                                key={acc.email}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedLoginEmail(acc.email);
                                                    handleSendPhoneOtp(acc.email);
                                                }}
                                                style={{
                                                    padding: '10px 14px',
                                                    borderRadius: '8px',
                                                    border: selectedLoginEmail === acc.email ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.12)',
                                                    background: selectedLoginEmail === acc.email ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                                                    color: '#fff',
                                                    cursor: 'pointer',
                                                    fontSize: '0.85rem',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <span>{acc.email}</span>
                                                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Send OTP &rarr;</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <button 
                                    className="auth-submit-btn" 
                                    type="submit"
                                    disabled={phoneLoading || !phoneNumber.trim()}
                                >
                                    {phoneLoading ? "Sending OTP..." : "Send OTP"}
                                </button>
                            </form>
                        ) : (
                            <div className="auth-otp-container">
                                <div style={{ fontSize: '0.85rem', color: '#a0a0a0', marginBottom: '4px' }}>
                                    Enter 6-digit code sent to <strong>{fullPhone}</strong> and linked <strong>Gmail</strong>
                                </div>

                                <div className="auth-otp-inputs">
                                    {phoneOtp.map((digit, idx) => (
                                        <input 
                                            key={idx}
                                            ref={(el) => (otpRefs.current[idx] = el)}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            className="auth-otp-box"
                                            value={digit}
                                            onChange={(e) => handlePhoneOtpChange(idx, e.target.value)}
                                            onKeyDown={(e) => handlePhoneOtpKeyDown(idx, e)}
                                        />
                                    ))}
                                </div>

                                <div className="auth-resend-row">
                                    <button 
                                        type="button" 
                                        className="auth-change-phone-btn"
                                        onClick={() => { setPhoneStep('phone'); setAuthError(''); }}
                                    >
                                        Change number
                                    </button>

                                    {canResend ? (
                                        <button 
                                            type="button" 
                                            className="auth-resend-btn"
                                            onClick={handleResendPhoneOtp}
                                            disabled={phoneLoading}
                                        >
                                            Resend OTP
                                        </button>
                                    ) : (
                                        <span>Resend in {resendTimer}s</span>
                                    )}
                                </div>

                                <button 
                                    className="auth-submit-btn" 
                                    type="button"
                                    onClick={handleVerifyPhoneOtp}
                                    disabled={phoneLoading || phoneOtp.join('').length !== 6}
                                >
                                    {phoneLoading ? "Verifying..." : "Verify & Sign In"}
                                </button>
                            </div>
                        )
                    ) : (
                        <form onSubmit={(e) => { e.preventDefault(); handleEmailLogin(); }} className="auth-email-form">
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
                            <button className="auth-submit-btn" type="submit">Sign in with email</button>
                        </form>
                    )}

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
