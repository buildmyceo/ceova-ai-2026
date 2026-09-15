import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
    PanelLeft, 
    PanelLeftClose, 
    Search, 
    SquarePen, 
    Image as ImageIcon, 
    Blocks, 
    Compass, 
    Sparkles, 
    Settings, 
    HelpCircle, 
    Plus, 
    Mic, 
    AudioLines, 
    ArrowUp, 
    ChevronDown, 
    X, 
    Mail, 
    Calendar, 
    Check, 
    Film, 
    User,
    Lock,
    Download
} from 'lucide-react';
import { supabase } from '../services/supabase';
import APP_CONFIG from '../config/appConfig';
import './GuestHome.css';

const SUGGESTIONS = [
    {
        id: 'profile_pic',
        icon: <ImageIcon size={18} />,
        label: 'Turn photo into profile pic',
        prompt: 'Can you help me turn a portrait photo into a professional studio executive profile picture?'
    },
    {
        id: 'movies',
        icon: <Film size={18} />,
        label: 'New movies releasing in India',
        prompt: 'What are the top new movies releasing in India this month across theatres and OTT platforms?'
    },
    {
        id: 'pet_human',
        icon: <User size={18} />,
        label: 'Turn my pet into a human',
        prompt: 'Imagine and describe my pet as a stylish human executive with matching personality and attire.'
    },
    {
        id: 'email_digest',
        icon: <Mail size={18} />,
        label: 'Summarize urgent unread emails',
        prompt: 'Review my unread executive emails, prioritize high-importance threads, and prepare action items.'
    },
    {
        id: 'calendar_schedule',
        icon: <Calendar size={18} />,
        label: 'Schedule meetings & resolve conflicts',
        prompt: 'Analyze my schedule for tomorrow, find optimal meeting slots, and flag overlapping calendar events.'
    }
];

export default function GuestHome() {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
    const [inputPrompt, setInputPrompt] = useState('');
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
    const [selectedModel, setSelectedModel] = useState('CEOVA 3.0 Executive');
    const [authModalMode, setAuthModalMode] = useState(null); // 'login' | 'signup' | null
    const [authError, setAuthError] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [isAuthLoading, setIsAuthLoading] = useState(false);

    const inputRef = useRef(null);
    const dropdownRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsModelDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle user prompt submission or feature click
    const handleTriggerAuth = (initialPrompt = '') => {
        if (initialPrompt) {
            localStorage.setItem('pending_guest_prompt', initialPrompt);
        } else if (inputPrompt.trim()) {
            localStorage.setItem('pending_guest_prompt', inputPrompt.trim());
        }
        setAuthModalMode('login');
        setAuthError('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (inputPrompt.trim()) {
                handleTriggerAuth(inputPrompt.trim());
            }
        }
    };

    // Google Sign-In with web/Tauri compatibility
    const handleGoogleLogin = async () => {
        setAuthError('Connecting to Google...');
        setIsAuthLoading(true);
        try {
            const isTauri = typeof window !== 'undefined' && (
                window.__TAURI__ !== undefined ||
                window.__TAURI_INTERNALS__ !== undefined
            );

            if (isTauri) {
                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: 'ceova://auth/callback',
                        skipBrowserRedirect: true,
                    }
                });

                if (error) throw error;
                const { open } = await import('@tauri-apps/plugin-shell');
                await open(data.url);
                setAuthError('✓ Browser opened. Complete sign-in there.');
            } else {
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: APP_CONFIG.getRedirectUrl('/auth/callback')
                    }
                });
                if (error) throw error;
            }
        } catch (e) {
            setAuthError(e.message || 'Failed to connect to Google');
        } finally {
            setIsAuthLoading(false);
        }
    };

    // Email Sign In / Sign Up
    const handleEmailAuthSubmit = async (e) => {
        e.preventDefault();
        setAuthError('');
        setIsAuthLoading(true);

        try {
            if (authModalMode === 'login') {
                if (!email || !password) {
                    setAuthError('Please enter both email and password.');
                    setIsAuthLoading(false);
                    return;
                }
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                if (data?.session) {
                    navigate('/dashboard');
                }
            } else {
                if (!fullName || !email || !password) {
                    setAuthError('Please fill in all fields.');
                    setIsAuthLoading(false);
                    return;
                }
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: window.location.origin,
                        data: { full_name: fullName }
                    }
                });
                if (error) throw error;
                setAuthError('Verification email sent! Check your inbox.');
            }
        } catch (err) {
            setAuthError(err.message || 'Authentication failed');
        } finally {
            setIsAuthLoading(false);
        }
    };

    return (
        <div className="guest-root">
            {/* Mobile Backdrop */}
            {sidebarOpen && window.innerWidth <= 768 && (
                <div className="guest-mobile-backdrop" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Left Sidebar */}
            <aside className={`guest-sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
                <div className="guest-sidebar-top">
                    <div className="guest-sidebar-header">
                        {sidebarOpen && (
                            <div className="guest-sidebar-logo-group" onClick={() => navigate('/')}>
                                <img src="/ceova logo dark.png" alt="CEOVA Logo" className="guest-brand-logo" />
                                <span className="guest-brand-name">CEOVA</span>
                            </div>
                        )}
                        <div className="guest-sidebar-actions-row">
                            <button 
                                className="guest-icon-btn"
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
                            >
                                {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
                            </button>
                            {sidebarOpen && (
                                <>
                                    <button 
                                        className="guest-icon-btn" 
                                        onClick={() => handleTriggerAuth()}
                                        title="Search"
                                    >
                                        <Search size={18} />
                                    </button>
                                    <button 
                                        className="guest-icon-btn" 
                                        onClick={() => handleTriggerAuth()}
                                        title="New chat"
                                    >
                                        <SquarePen size={18} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Navigation Items */}
                    <div className="guest-sidebar-nav">
                        <button className="guest-nav-item active" onClick={() => handleTriggerAuth()}>
                            <span className="guest-nav-icon"><SquarePen size={18} /></span>
                            {sidebarOpen && <span className="guest-nav-label">New chat</span>}
                        </button>
                        <button className="guest-nav-item" onClick={() => handleTriggerAuth('Generate an image: ')}>
                            <span className="guest-nav-icon"><ImageIcon size={18} /></span>
                            {sidebarOpen && <span className="guest-nav-label">Images</span>}
                        </button>
                        <button className="guest-nav-item" onClick={() => handleTriggerAuth()}>
                            <span className="guest-nav-icon"><Blocks size={18} /></span>
                            {sidebarOpen && <span className="guest-nav-label">Plugins</span>}
                        </button>
                        <button className="guest-nav-item" onClick={() => handleTriggerAuth('Conduct deep research on: ')}>
                            <span className="guest-nav-icon"><Compass size={18} /></span>
                            {sidebarOpen && <span className="guest-nav-label">Deep research</span>}
                        </button>
                    </div>
                </div>

                {/* Sidebar Bottom Area */}
                <div className="guest-sidebar-bottom">
                    {sidebarOpen && (
                        <div className="guest-promo-card">
                            <div className="guest-promo-title">Get responses tailored to you</div>
                            <div className="guest-promo-desc">
                                Log in to get answers based on saved chats, plus create images and upload files.
                            </div>
                            <button 
                                className="guest-promo-login-btn"
                                onClick={() => { setAuthModalMode('login'); setAuthError(''); }}
                            >
                                Log in
                            </button>
                        </div>
                    )}

                    <div className="guest-sidebar-nav">
                        <Link to="/subscription" className="guest-nav-item">
                            <span className="guest-nav-icon"><Sparkles size={18} /></span>
                            {sidebarOpen && <span className="guest-nav-label">See plans and pricing</span>}
                        </Link>
                        <Link to="/download" className="guest-nav-item">
                            <span className="guest-nav-icon"><Download size={18} /></span>
                            {sidebarOpen && <span className="guest-nav-label">Download Desktop App</span>}
                        </Link>
                        <button className="guest-nav-item" onClick={() => handleTriggerAuth()}>
                            <span className="guest-nav-icon"><Settings size={18} /></span>
                            {sidebarOpen && <span className="guest-nav-label">Settings</span>}
                        </button>
                        <a href="mailto:contact@ceova.online" className="guest-nav-item">
                            <span className="guest-nav-icon"><HelpCircle size={18} /></span>
                            {sidebarOpen && <span className="guest-nav-label">Help</span>}
                        </a>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="guest-main">
                {/* Topbar */}
                <header className="guest-topbar">
                    <div className="guest-topbar-left" ref={dropdownRef}>
                        {!sidebarOpen && (
                            <button 
                                className="guest-icon-btn"
                                onClick={() => setSidebarOpen(true)}
                                title="Open sidebar"
                                style={{ marginRight: '4px' }}
                            >
                                <PanelLeft size={20} />
                            </button>
                        )}
                        <button 
                            className="guest-model-selector-btn"
                            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                        >
                            <span>{selectedModel.split(' ')[0]}</span>
                            <span className="guest-model-tag">v3.0</span>
                            <ChevronDown size={16} />
                        </button>

                        {/* Model Dropdown Menu */}
                        {isModelDropdownOpen && (
                            <div className="guest-dropdown-menu">
                                <button 
                                    className={`guest-dropdown-item ${selectedModel.includes('Executive') ? 'active' : ''}`}
                                    onClick={() => { setSelectedModel('CEOVA 3.0 Executive'); setIsModelDropdownOpen(false); }}
                                >
                                    <Sparkles size={18} style={{ color: '#fff', marginTop: '2px' }} />
                                    <div>
                                        <div className="guest-dropdown-title">
                                            CEOVA 3.0 Executive
                                            <Check size={14} style={{ color: '#10b981' }} />
                                        </div>
                                        <div className="guest-dropdown-desc">
                                            Our flagship assistant for Gmail, Calendar, research & daily execution.
                                        </div>
                                    </div>
                                </button>
                                <button 
                                    className={`guest-dropdown-item ${selectedModel.includes('Deep Research') ? 'active' : ''}`}
                                    onClick={() => { setSelectedModel('CEOVA Deep Research'); setIsModelDropdownOpen(false); }}
                                >
                                    <Compass size={18} style={{ color: '#a78bfa', marginTop: '2px' }} />
                                    <div>
                                        <div className="guest-dropdown-title">
                                            CEOVA Deep Research
                                            <span style={{ fontSize: '0.65rem', background: '#3b0764', color: '#e9d5ff', padding: '1px 5px', borderRadius: '4px' }}>PLUS</span>
                                        </div>
                                        <div className="guest-dropdown-desc">
                                            Multi-source investigation and comprehensive structured reports.
                                        </div>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="guest-topbar-right">
                        <Link 
                            to="/download" 
                            className="guest-download-btn-top"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '7px 14px',
                                borderRadius: '8px',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                color: '#e4e4e7',
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                textDecoration: 'none',
                                transition: 'all 0.2s',
                                marginRight: '6px'
                            }}
                        >
                            <Download size={15} />
                            <span>Download App</span>
                        </Link>
                        <button 
                            className="guest-login-btn-top"
                            onClick={() => { setAuthModalMode('login'); setAuthError(''); }}
                        >
                            Log in
                        </button>
                        <button 
                            className="guest-signup-btn-top"
                            onClick={() => { setAuthModalMode('signup'); setAuthError(''); }}
                        >
                            Sign up for free
                        </button>
                    </div>
                </header>

                {/* Central Canvas (Welcome & Chat Area) */}
                <div className="guest-canvas">
                    <h1 className="guest-hero-heading">What's on your mind today?</h1>

                    {/* Pill Input Box */}
                    <div className="guest-input-box-wrapper" onClick={() => inputRef.current?.focus()}>
                        <button 
                            className="guest-input-action-btn"
                            onClick={(e) => { e.stopPropagation(); handleTriggerAuth(); }}
                            title="Add attachments or tools"
                        >
                            <Plus size={20} />
                        </button>

                        <input 
                            ref={inputRef}
                            type="text" 
                            className="guest-input-field"
                            placeholder="Ask anything"
                            value={inputPrompt}
                            onChange={(e) => setInputPrompt(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />

                        <div className="guest-input-right-controls">
                            <button 
                                className="guest-input-action-btn"
                                onClick={(e) => { e.stopPropagation(); handleTriggerAuth(); }}
                                title="Voice input"
                            >
                                <Mic size={19} />
                            </button>
                            <button 
                                className="guest-input-action-btn"
                                onClick={(e) => { e.stopPropagation(); handleTriggerAuth(); }}
                                title="Voice mode"
                            >
                                <AudioLines size={19} />
                            </button>
                            <button 
                                className={`guest-submit-btn ${!inputPrompt.trim() ? 'disabled' : ''}`}
                                onClick={(e) => { e.stopPropagation(); if (inputPrompt.trim()) handleTriggerAuth(); }}
                                title="Send prompt"
                            >
                                <ArrowUp size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Suggested Prompt Chips */}
                    <div className="guest-suggestions-grid">
                        {SUGGESTIONS.map((s) => (
                            <button 
                                key={s.id} 
                                className="guest-suggestion-pill"
                                onClick={() => handleTriggerAuth(s.prompt)}
                            >
                                <span className="guest-suggestion-icon">{s.icon}</span>
                                <span>{s.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer Disclaimer */}
                <footer className="guest-footer">
                    CEOVA is AI. By using it, you agree to our{' '}
                    <Link to="/legal/terms-conditions">Terms</Link> &{' '}
                    <Link to="/legal/privacy-policy">Privacy Policy</Link>. Chats may be reviewed and used to improve our AI models.{' '}
                    <Link to="/legal/privacy-policy">Learn more</Link>
                </footer>
            </main>

            {/* Auth Modal */}
            {authModalMode && (
                <div className="guest-modal-backdrop" onClick={() => setAuthModalMode(null)}>
                    <div className="guest-modal-dialog" onClick={(e) => e.stopPropagation()}>
                        <button 
                            className="guest-modal-close-btn"
                            onClick={() => setAuthModalMode(null)}
                        >
                            <X size={20} />
                        </button>

                        <img src="/ceova logo dark.png" alt="CEOVA" className="guest-modal-logo" />

                        <h2 className="guest-modal-title">
                            {authModalMode === 'login' ? 'Welcome back to CEOVA' : 'Create your CEOVA account'}
                        </h2>
                        <p className="guest-modal-subtitle">
                            {authModalMode === 'login' 
                                ? 'Sign in to save your conversation, connect Gmail & Calendar, and unlock full executive powers.' 
                                : 'Get started with your free AI executive assistant in seconds.'}
                        </p>

                        {authError && (
                            <div className="guest-modal-error">
                                {authError}
                            </div>
                        )}

                        {/* Google Sign In */}
                        <button 
                            className="guest-modal-google-btn"
                            onClick={handleGoogleLogin}
                            disabled={isAuthLoading}
                        >
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width="18" height="18" />
                            Continue with Google
                        </button>

                        <div className="guest-modal-divider">
                            <span>or</span>
                        </div>

                        {/* Email Form */}
                        <form className="guest-modal-form" onSubmit={handleEmailAuthSubmit}>
                            {authModalMode === 'signup' && (
                                <input 
                                    type="text" 
                                    className="guest-modal-input"
                                    placeholder="Full Name"
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                />
                            )}
                            <input 
                                type="email" 
                                className="guest-modal-input"
                                placeholder="Email address"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <input 
                                type="password" 
                                className="guest-modal-input"
                                placeholder="Password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />

                            <button 
                                type="submit" 
                                className="guest-modal-submit-btn"
                                disabled={isAuthLoading}
                            >
                                {isAuthLoading 
                                    ? 'Processing...' 
                                    : authModalMode === 'login' ? 'Sign in with email' : 'Sign up with email'}
                            </button>
                        </form>

                        <div className="guest-modal-footer-switch">
                            {authModalMode === 'login' ? (
                                <>
                                    Don't have an account?{' '}
                                    <button onClick={() => { setAuthModalMode('signup'); setAuthError(''); }}>
                                        Sign up
                                    </button>
                                </>
                            ) : (
                                <>
                                    Already have an account?{' '}
                                    <button onClick={() => { setAuthModalMode('login'); setAuthError(''); }}>
                                        Sign in
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
