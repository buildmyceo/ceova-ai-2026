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
    Lock
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
        navigate('/login');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (inputPrompt.trim()) {
                handleTriggerAuth(inputPrompt.trim());
            }
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
                            <Link 
                                to="/login"
                                className="guest-promo-login-btn"
                                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                Log in
                            </Link>
                        </div>
                    )}

                    <div className="guest-sidebar-nav">
                        <Link to="/subscription" className="guest-nav-item">
                            <span className="guest-nav-icon"><Sparkles size={18} /></span>
                            {sidebarOpen && <span className="guest-nav-label">See plans and pricing</span>}
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
                            to="/login"
                            className="guest-login-btn-top"
                            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            Log in
                        </Link>
                        <Link 
                            to="/signup"
                            className="guest-signup-btn-top"
                            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            Sign up for free
                        </Link>
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
        </div>
    );
}
