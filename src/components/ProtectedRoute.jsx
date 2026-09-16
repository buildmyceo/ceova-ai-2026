import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthProvider';

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();

  console.log("Session:", session);
  console.log("Loading:", loading);

  if (loading) {
    const themeMod = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    const logoSrc = themeMod === 'light' ? '/ceova logo light.png' : '/ceova logo dark.png';
    return (
        <div className="auth-overlay">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
                <img src={logoSrc} alt="Ceova Loading" className="blinking-logo" style={{ width: '90px', height: 'auto' }} />
                <span style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase' }}>Authenticating</span>
            </div>
        </div>
    );
  }

  if (!loading && !session) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
