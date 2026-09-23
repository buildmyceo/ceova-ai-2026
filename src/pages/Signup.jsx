import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { initiateGoogleSignIn } from '../services/mobileAuth';
import { useAuth } from '../contexts/AuthProvider';
import '../App.css';
import './Login.css';

export default function Signup() {
    const navigate = useNavigate();
    const { session, loading } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // If already authenticated, go straight to dashboard
    useEffect(() => {
        if (session) {
            navigate('/dashboard', { replace: true });
        }
    }, [session, navigate]);

    const handleEmailSignup = async (e) => {
        if (e) e.preventDefault();
        if (!name || !email || !password) return setAuthError("Please fill in all fields.");
        setAuthError("Creating account...");
        setIsSubmitting(true);
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { 
                    emailRedirectTo: window.location.origin,
                    data: { full_name: name }
                }
            });
            if (error) throw error;
            if (data?.session) {
                navigate('/dashboard', { replace: true });
            } else {
                setAuthError("✓ Verification email sent! Please check your inbox.");
            }
        } catch (err) {
            setAuthError(err.message || "Signup failed.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoogleLogin = async () => {
        setAuthError("Connecting to Google...");
        setIsSubmitting(true);
        try {
            const res = await initiateGoogleSignIn();
            if (res?.type === 'signed_in') {
                setAuthError("");
                navigate('/dashboard', { replace: true });
                return;
            }
            if (res?.type === 'cancelled') {
                setAuthError("");
                return;
            }
            if (res?.type === 'browser_opened') {
                setAuthError("✓ Complete Google sign-in. Returning to CEOVA automatically...");
            }
        } catch (e) {
            const msg = e?.message || JSON.stringify(e) || "Unknown error";
            setAuthError("Failed to connect: " + msg);
            console.error("Google Login Error:", e);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="auth-split-container">
            <div className="animated-bg">
                <div className="glow glow-1"></div>
                <div className="glow glow-2"></div>
                <div className="grid-overlay dots"></div>
            </div>

            <div className="auth-full-panel">
                <img src="/ceova-logo.png" alt="CEOVA" className="brand-logo-small" />

                <div className="auth-form-wrapper">
                    <h1 className="auth-heading">Create your account</h1>
                    
                    {authError && (
                        <div className={`auth-error-chip ${authError.includes("Connecting") || authError.includes("Creating") || authError.includes("✓") ? "info" : ""}`}>
                            {authError}
                        </div>
                    )}
                    
                    <button className="auth-provider-btn" onClick={handleGoogleLogin} disabled={isSubmitting}>
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width="20" height="20" />
                        <span>Sign up with Google</span>
                    </button>
                    
                    <div className="auth-divider">
                        <span>or register with email</span>
                    </div>

                    <form onSubmit={handleEmailSignup} className="auth-email-form">
                        <input 
                            className="auth-input-pill"
                            type="text" 
                            placeholder="Full Name" 
                            required 
                            autoComplete="name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                        <input 
                            className="auth-input-pill"
                            type="email" 
                            placeholder="Email address" 
                            required 
                            autoComplete="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                        <input 
                            className="auth-input-pill"
                            type="password" 
                            placeholder="Password" 
                            required 
                            autoComplete="new-password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                        <button type="submit" className="auth-submit-btn" disabled={isSubmitting}>
                            {isSubmitting ? "Creating account..." : "Sign up"}
                        </button>
                    </form>

                    <div className="auth-switch-text">
                        Already have an account? <Link to="/login" className="auth-link">Sign in</Link>
                    </div>
                </div>
                
                <div className="auth-footer-terms">
                    By continuing you agree to our <Link to="/legal/terms-conditions">Terms & Conditions</Link> and acknowledge our <Link to="/legal/privacy-policy">Privacy Policy</Link>.
                </div>
            </div>
        </div>
    );
}
