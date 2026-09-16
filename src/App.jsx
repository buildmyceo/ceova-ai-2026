import React, { useEffect, useState, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { supabase } from './services/supabase';
import { useAuth } from './contexts/AuthProvider';
import { useTheme } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingScreen from './components/LoadingScreen';
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
                    <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <GuestHome />} />
                    <Route path="/legal" element={<Navigate to="/legal/privacy-policy" replace />} />
                    <Route path="/legal/:docId" element={<LegalCenter />} />
                    <Route path="/privacy" element={<Navigate to="/legal/privacy-policy" replace />} />
                    <Route path="/terms" element={<Navigate to="/legal/terms-conditions" replace />} />
                    <Route path="/dashboard" element={<ProtectedRoute><Home session={session} /></ProtectedRoute>} />

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

