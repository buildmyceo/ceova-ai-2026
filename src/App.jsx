import React, { useEffect, useState, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Browser } from '@capacitor/browser';
import { supabase } from './services/supabase';
import { useAuth } from './contexts/AuthProvider';
import { useTheme } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingScreen from './components/LoadingScreen';
import { initSocialLogin } from './services/mobileAuth';
import { initBackgroundService } from './services/backgroundService';
import './App.css';

// Lazy loaded routes for bundle splitting and performance optimization
const Home = lazy(() => import('./pages/Home'));
const GuestHome = lazy(() => import('./pages/GuestHome'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Landing = lazy(() => import('./pages/Landing'));
const LegalCenter = lazy(() => import('./pages/LegalCenter'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Subscription = lazy(() => import('./pages/Subscription'));

const RESERVED_APP_PATHS = new Set([
    'dashboard', 'legal', 'privacy', 'terms', 'subscription',
    'auth', 'login', 'signup', 'api', 'p', 'sites', 'assets', 'favicon.ico'
]);

function NotFoundOrProjectRedirect() {
    return <Navigate to="/" replace />;
}

export default function App() {
    const { session, loading } = useAuth();
    const { resolvedTheme } = useTheme();
    const navigate = useNavigate();

    // Pre-warm Native Google Credential Manager & Background Service
    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            initSocialLogin();
            initBackgroundService();
        }
    }, []);

    // Android Hardware Back Button integration
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        let backListener;
        CapApp.addListener('backButton', ({ canGoBack }) => {
            const path = window.location.pathname;
            if (path === '/dashboard' || path === '/' || path === '/login') {
                CapApp.exitApp();
            } else if (canGoBack) {
                window.history.back();
            } else {
                navigate('/dashboard');
            }
        }).then(listener => {
            backListener = listener;
        });

        return () => {
            if (backListener && backListener.remove) {
                backListener.remove();
            }
        };
    }, [navigate]);

    // Capacitor In-App OAuth Deep Link Handler (ceova://auth/callback#access_token=...)
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        let appUrlListener;
        CapApp.addListener('appUrlOpen', async (data) => {
            console.log('[Capacitor] appUrlOpen triggered:', data.url);

            try {
                await Browser.close();
            } catch (e) {
                // Ignore if browser was already closed
            }

            const rawUrl = data.url;
            if (!rawUrl) return;

            if (rawUrl.includes('auth/callback') || rawUrl.includes('access_token=') || rawUrl.includes('code=')) {
                try {
                    // Parse both search query params (?code=...) and hash fragment (#access_token=...)
                    let queryParams = new URLSearchParams();
                    let hashParams = new URLSearchParams();

                    const queryIdx = rawUrl.indexOf('?');
                    const hashIdx = rawUrl.indexOf('#');

                    if (queryIdx !== -1) {
                        const queryStr = hashIdx > queryIdx 
                            ? rawUrl.substring(queryIdx + 1, hashIdx) 
                            : rawUrl.substring(queryIdx + 1);
                        queryParams = new URLSearchParams(queryStr);
                    }

                    if (hashIdx !== -1) {
                        hashParams = new URLSearchParams(rawUrl.substring(hashIdx + 1));
                    }

                    const access_token = hashParams.get('access_token') || queryParams.get('access_token');
                    const refresh_token = hashParams.get('refresh_token') || queryParams.get('refresh_token');
                    const provider_token = hashParams.get('provider_token') || queryParams.get('provider_token');
                    const provider_refresh_token = hashParams.get('provider_refresh_token') || queryParams.get('provider_refresh_token');
                    const code = queryParams.get('code') || hashParams.get('code');

                    if (provider_token) {
                        localStorage.setItem('google_provider_token', provider_token);
                    }
                    if (provider_refresh_token) {
                        localStorage.setItem('google_refresh_token', provider_refresh_token);
                    }

                    if (access_token && refresh_token) {
                        console.log('[Capacitor] Setting session from deep link tokens...');
                        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
                        if (error) throw error;
                        console.log('[Capacitor] Signed in! Navigating to /dashboard');
                        navigate('/dashboard', { replace: true });
                    } else if (code) {
                        console.log('[Capacitor] Exchanging auth code for session...');
                        const { error } = await supabase.auth.exchangeCodeForSession(code);
                        if (error) throw error;
                        console.log('[Capacitor] Signed in! Navigating to /dashboard');
                        navigate('/dashboard', { replace: true });
                    } else {
                        console.warn('[Capacitor] No valid tokens or code found in URL:', rawUrl);
                    }
                } catch (err) {
                    console.error('[Capacitor] Deep link auth error:', err);
                }
            }
        }).then(listener => {
            appUrlListener = listener;
        });

        return () => {
            if (appUrlListener && appUrlListener.remove) {
                appUrlListener.remove();
            }
        };
    }, [navigate]);

    // Match Android Status Bar with active theme
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        const updateStatusBar = async () => {
            try {
                if (resolvedTheme === 'dark') {
                    await StatusBar.setStyle({ style: Style.Dark });
                    await StatusBar.setBackgroundColor({ color: '#0f172a' });
                } else {
                    await StatusBar.setStyle({ style: Style.Light });
                    await StatusBar.setBackgroundColor({ color: '#ffffff' });
                }
            } catch (e) {
                console.warn('StatusBar update failed:', e);
            }
        };

        updateStatusBar();
    }, [resolvedTheme]);

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log("DEBUG: Auth State Changed [Event:", event, "]");
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    if (loading) {
        return (
            <div className={`theme-${resolvedTheme}`}>
                <LoadingScreen text="Authenticating Session..." />
            </div>
        );
    }

    return (
        <div className={`theme-${resolvedTheme}`}>
            <Suspense fallback={<LoadingScreen text="Loading..." />}>
                <Routes>
                    <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />
                    <Route path="/legal" element={<Navigate to="/legal/privacy-policy" replace />} />
                    <Route path="/legal/:docId" element={<LegalCenter />} />
                    <Route path="/privacy" element={<Navigate to="/legal/privacy-policy" replace />} />
                    <Route path="/terms" element={<Navigate to="/legal/terms-conditions" replace />} />
                    <Route path="/dashboard" element={<ProtectedRoute><Home session={session} /></ProtectedRoute>} />
                    <Route path="/library" element={<Navigate to="/dashboard" replace state={{ openLibrary: true }} />} />

                    <Route path="/subscription" element={<ProtectedRoute><Subscription session={session} /></ProtectedRoute>} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />
                    <Route path="/signup" element={session ? <Navigate to="/dashboard" replace /> : <Signup />} />
                    <Route path="*" element={<NotFoundOrProjectRedirect />} />
                </Routes>
            </Suspense>
        </div>
    );
}

