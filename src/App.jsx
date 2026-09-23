import React, { useEffect, useState, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './services/supabase';
import { useAuth } from './contexts/AuthProvider';
import { useTheme } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingScreen from './components/LoadingScreen';
import './App.css';

// Lazy loaded routes for bundle splitting and performance optimization
const Home = lazy(() => import('./pages/Home'));
const Welcome = lazy(() => import('./pages/Welcome'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Landing = lazy(() => import('./pages/Landing'));
const LegalCenter = lazy(() => import('./pages/LegalCenter'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Subscription = lazy(() => import('./pages/Subscription'));
const Download = lazy(() => import('./pages/Download'));

const RESERVED_APP_PATHS = new Set([
    'dashboard', 'legal', 'privacy', 'terms', 'subscription', 'library',
    'auth', 'login', 'signup', 'download', 'api', 'p', 'sites', 'assets', 'favicon.ico'
]);

function NotFoundOrProjectRedirect() {
    return <Navigate to="/" replace />;
}

export default function App() {
    const { session, loading } = useAuth();
    const { resolvedTheme } = useTheme();
    const [welcomeDismissed, setWelcomeDismissed] = useState(false);

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
                    <Route 
                        path="/" 
                        element={
                            session ? (
                                <Navigate to="/dashboard" replace />
                            ) : !welcomeDismissed ? (
                                <Welcome onContinue={() => setWelcomeDismissed(true)} />
                            ) : (
                                <Login />
                            )
                        } 
                    />
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
                    <Route path="/download" element={<Download />} />
                    <Route path="/download/*" element={<Download />} />
                    <Route path="*" element={<NotFoundOrProjectRedirect />} />
                </Routes>
            </Suspense>
        </div>
    );
}

