import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, ArrowLeft, Scissors, Eye, Minimize2, RefreshCw, Scan, FileText, 
    Key, Palette, Calculator, Receipt, Film, Link, Zap, Calendar, HardDrive, Mail,
    Check, LogIn, CircleDashed, ExternalLink, Sparkles, ShieldCheck, Trash2
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { connectGoogleDrive } from '../services/gdriveSyncEngine';
import { connectDropbox } from '../services/dropboxSyncEngine';

export default function ExtensionsModal({ isOpen, onClose, initialTab = 'tools', onSelectTool }) {
    const [view, setView] = useState(initialTab); // 'tools' or 'connectors'
    
    // Connection statuses for apps
    const [connections, setConnections] = useState({
        google: false, // Google Drive, Gmail, Google Calendar
        dropbox: false,
        checking: false
    });

    useEffect(() => {
        if (isOpen) {
            setView(initialTab);
            checkConnectionStatuses();
        }
    }, [isOpen, initialTab]);

    const checkConnectionStatuses = async () => {
        setConnections(prev => ({ ...prev, checking: true }));
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            
            let hasGoogle = false;
            let hasDropbox = false;

            // 1. Check Google Connection
            const cachedGoogleToken = typeof window !== 'undefined' ? localStorage.getItem('google_provider_token') : null;
            if (session?.provider_token || cachedGoogleToken) {
                hasGoogle = true;
            } else if (user?.id) {
                const { data: googleTokenData } = await supabase
                    .from('user_google_tokens')
                    .select('access_token, expiry_date')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (googleTokenData?.access_token) {
                    hasGoogle = true;
                }
            }

            // 2. Check Dropbox Connection
            const cachedDropboxToken = typeof window !== 'undefined' ? localStorage.getItem('dropbox_provider_token') : null;
            if (cachedDropboxToken) {
                hasDropbox = true;
            } else if (user?.id) {
                const { data: dropboxTokenData } = await supabase
                    .from('user_dropbox_tokens')
                    .select('access_token, expiry_date')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (dropboxTokenData?.access_token) {
                    hasDropbox = true;
                }
            }

            setConnections({
                google: hasGoogle,
                dropbox: hasDropbox,
                checking: false
            });
        } catch (err) {
            console.error("Error checking connection status:", err);
            setConnections(prev => ({ ...prev, checking: false }));
        }
    };

    const handleGoogleConnect = async () => {
        try {
            await connectGoogleDrive();
        } catch (err) {
            console.error("Failed to connect Google account:", err);
            alert("Could not start Google sign in.");
        }
    };

    const handleDropboxConnect = async () => {
        try {
            await connectDropbox();
        } catch (err) {
            console.error("Failed to connect Dropbox account:", err);
            alert("Could not start Dropbox sign in.");
        }
    };

    const handleGoogleDisconnect = async () => {
        if (!confirm("Are you sure you want to disconnect Google Services? This will remove synced files, emails, and events.")) return;
        try {
            localStorage.removeItem('google_provider_token');
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) {
                await supabase.from('user_google_tokens').delete().eq('user_id', session.user.id);
                await supabase.from('gmail_emails').delete().eq('user_id', session.user.id);
                await supabase.from('calendar_events').delete().eq('user_id', session.user.id);
                await supabase.from('files').delete().eq('user_id', session.user.id).eq('storage_source', 'gdrive');
            }
            checkConnectionStatuses();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDropboxDisconnect = async () => {
        if (!confirm("Are you sure you want to disconnect Dropbox? This will remove synced files.")) return;
        try {
            localStorage.removeItem('dropbox_provider_token');
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) {
                await supabase.from('user_dropbox_tokens').delete().eq('user_id', session.user.id);
                await supabase.from('files').delete().eq('user_id', session.user.id).eq('storage_source', 'dropbox');
            }
            checkConnectionStatuses();
        } catch (e) {
            console.error(e);
        }
    };

    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    const desktopAnimation = {
        initial: { opacity: 0, scale: 0.95, y: '-48%', x: '-50%' },
        animate: { opacity: 1, scale: 1, y: '-50%', x: '-50%' },
        exit: { opacity: 0, scale: 0.95, y: '-48%', x: '-50%' }
    };

    const mobileAnimation = {
        initial: { opacity: 0, y: "100%" },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: "100%" }
    };

    const handleToolSelect = (command) => {
        onSelectTool(command);
        onClose();
    };

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <>
                {/* Embedded style for pulsing green indicator */}
                <style>{`
                    .connector-live-dot {
                        width: 6px;
                        height: 6px;
                        border-radius: 50%;
                        background-color: #22c55e;
                        box-shadow: 0 0 8px #22c55e;
                        animation: connectorPulse 2s infinite ease-in-out;
                    }
                    @keyframes connectorPulse {
                        0% { transform: scale(0.95); opacity: 0.8; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
                        70% { transform: scale(1.1); opacity: 1; box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
                        100% { transform: scale(0.95); opacity: 0.8; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
                    }
                `}</style>
                <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
                <motion.div 
                    className="settings-card extensions-modal-card"
                    {...(isMobile ? mobileAnimation : desktopAnimation)}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    style={!isMobile ? { top: "50%", left: "50%", position: "fixed" } : { bottom: 0, left: 0, position: "fixed" }}
                >
                    <header className="settings-header">
                        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <button 
                                    className={`tab-btn ${view === 'tools' ? 'active' : ''}`} 
                                    onClick={() => setView('tools')}
                                    style={{ background: 'none', border: 'none', color: view === 'tools' ? '#fff' : '#a1a1aa', fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer', paddingBottom: '4px', borderBottom: view === 'tools' ? '2px solid #3b82f6' : '2px solid transparent' }}
                                >
                                    Tools
                                </button>
                                <button 
                                    className={`tab-btn ${view === 'connectors' ? 'active' : ''}`} 
                                    onClick={() => setView('connectors')}
                                    style={{ background: 'none', border: 'none', color: view === 'connectors' ? '#fff' : '#a1a1aa', fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer', paddingBottom: '4px', borderBottom: view === 'connectors' ? '2px solid #3b82f6' : '2px solid transparent' }}
                                >
                                    Connectors
                                </button>
                            </div>
                            <button className="settings-close-btn" onClick={onClose} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                    </header>

                    <div className="settings-body" style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
                        
                        {view === 'tools' && (
                            <div className="extensions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                                
                                <ExtensionCard 
                                    icon={<Scissors size={22} color="#60a5fa" />} 
                                    title="Background Remover" 
                                    desc="Remove backgrounds from images instantly." 
                                    onClick={() => handleToolSelect('/background_remover')} 
                                />
                                <ExtensionCard 
                                    icon={<Scan size={22} color="#a78bfa" />} 
                                    title="QR & Barcode" 
                                    desc="Generate or decode QR codes & barcodes." 
                                    onClick={() => handleToolSelect('/qr_barcode')} 
                                />
                                <ExtensionCard 
                                    icon={<Receipt size={22} color="#34d399" />} 
                                    title="Invoice Generator" 
                                    desc="Create beautiful PDF invoices in seconds." 
                                    onClick={() => handleToolSelect('/invoice_generator')} 
                                />
                                <ExtensionCard 
                                    icon={<Eye size={22} color="#f472b6" />} 
                                    title="Image Analysis" 
                                    desc="Analyze images and extract text (OCR)." 
                                    onClick={() => handleToolSelect('/image_analysis')} 
                                />
                                <ExtensionCard 
                                    icon={<FileText size={22} color="#fb923c" />} 
                                    title="PDF Toolkit" 
                                    desc="Merge, split, compress, and edit PDFs." 
                                    onClick={() => handleToolSelect('/pdf_toolkit')} 
                                />
                                <ExtensionCard 
                                    icon={<Key size={22} color="#facc15" />} 
                                    title="Password & Hash" 
                                    desc="Generate strong passwords securely." 
                                    onClick={() => handleToolSelect('/password_hash')} 
                                />
                                <ExtensionCard 
                                    icon={<Palette size={22} color="#ec4899" />} 
                                    title="Color Toolkit" 
                                    desc="Extract colors, generate palettes." 
                                    onClick={() => handleToolSelect('/color_toolkit')} 
                                />

                                <ExtensionCard 
                                    icon={<Film size={22} color="#38bdf8" />} 
                                    title="Media Converter" 
                                    desc="Convert audio/video and compress media." 
                                    onClick={() => handleToolSelect('/media_converter')} 
                                />
                                <ExtensionCard 
                                    icon={<Minimize2 size={22} color="#818cf8" />} 
                                    title="Reduce File Size" 
                                    desc="Compress images to save space." 
                                    onClick={() => handleToolSelect('/file_size_reduction')} 
                                />
                                <ExtensionCard 
                                    icon={<RefreshCw size={22} color="#4ade80" />} 
                                    title="File Converter" 
                                    desc="Convert between PNG, JPG, WEBP, etc." 
                                    onClick={() => handleToolSelect('/file_converter')} 
                                />
                            </div>
                        )}

                        {view === 'connectors' && (
                            <div className="extensions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                                <ExtensionCard 
                                    type="connector"
                                    icon={<img src="/drive.png" alt="Google Drive" width="24" height="24" style={{ objectFit: 'contain' }} />} 
                                    title="Google Drive" 
                                    desc="Access and manage your Drive files." 
                                    isConnected={connections.google}
                                    isChecking={connections.checking}
                                    onConnect={handleGoogleConnect}
                                    onClick={() => {
                                        if (connections.google) {
                                            handleToolSelect('/gdrive');
                                        } else {
                                            handleGoogleConnect();
                                        }
                                    }}
                                    onDisconnect={handleGoogleDisconnect}
                                />
                                <ExtensionCard 
                                    type="connector"
                                    icon={<HardDrive size={24} color="#60a5fa" />} 
                                    title="Dropbox" 
                                    desc="Sync and search your Dropbox files." 
                                    isConnected={connections.dropbox}
                                    isChecking={connections.checking}
                                    onConnect={handleDropboxConnect}
                                    onClick={() => {
                                        if (connections.dropbox) {
                                            handleToolSelect('/dropbox');
                                        } else {
                                            handleDropboxConnect();
                                        }
                                    }}
                                    onDisconnect={handleDropboxDisconnect}
                                />
                                <ExtensionCard 
                                    type="connector"
                                    icon={<img src="/gmail.png" alt="Gmail" width="24" height="24" style={{ objectFit: 'contain' }} />} 
                                    title="Gmail" 
                                    desc="Read and draft emails directly from chat." 
                                    isConnected={connections.google}
                                    isChecking={connections.checking}
                                    onConnect={handleGoogleConnect}
                                    onClick={() => {
                                        if (connections.google) {
                                            handleToolSelect('/gmail');
                                        } else {
                                            handleGoogleConnect();
                                        }
                                    }}
                                    onDisconnect={handleGoogleDisconnect}
                                />
                                <ExtensionCard 
                                    type="connector"
                                    icon={<img src="/google_calendar.png" alt="Google Calendar" width="24" height="24" style={{ objectFit: 'contain' }} />} 
                                    title="Google Calendar" 
                                    desc="Manage your schedule and events." 
                                    isConnected={connections.google}
                                    isChecking={connections.checking}
                                    onConnect={handleGoogleConnect}
                                    onClick={() => {
                                        if (connections.google) {
                                            handleToolSelect('/google_calendar');
                                        } else {
                                            handleGoogleConnect();
                                        }
                                    }}
                                    onDisconnect={handleGoogleDisconnect}
                                />
                                <ExtensionCard 
                                    type="connector"
                                    icon={<Zap size={24} color="#71717a" />} 
                                    title="Notion" 
                                    desc="Connect your workspaces." 
                                    disabled={true}
                                />
                            </div>
                        )}

                    </div>
                </motion.div>
                </>
            )}
        </AnimatePresence>
    );

    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}

function ExtensionCard({ 
    icon, 
    title, 
    desc, 
    onClick, 
    onConnect,
    disabled = false, 
    type = 'tool',
    isConnected = false,
    isChecking = false,
    isConnecting = false,
    onDisconnect
}) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div 
            onClick={!disabled ? onClick : undefined}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{ 
                background: disabled 
                    ? 'rgba(255,255,255,0.02)' 
                    : isConnected 
                        ? (isHovered ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255,255,255,0.035)') 
                        : (isHovered ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)'), 
                border: disabled 
                    ? '1px solid rgba(255,255,255,0.05)' 
                    : isConnected 
                        ? (isHovered ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid rgba(34, 197, 94, 0.22)') 
                        : (isHovered ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.08)'), 
                borderRadius: '14px', 
                padding: '16px', 
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                opacity: disabled ? 0.45 : 1,
                position: 'relative',
                backdropFilter: 'blur(10px)',
                boxShadow: isHovered && !disabled 
                    ? (isConnected ? '0 10px 25px -5px rgba(34, 197, 94, 0.15)' : '0 10px 25px -5px rgba(0, 0, 0, 0.3)')
                    : 'none',
                transform: isHovered && !disabled ? 'translateY(-2px)' : 'none',
            }}
        >
            {/* Top Row: Icon + Status Badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ 
                    width: '42px', 
                    height: '42px', 
                    borderRadius: '12px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    background: isConnected ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.05)',
                    border: isConnected ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(255,255,255,0.08)'
                }}>
                    {icon}
                </div>

                {type === 'connector' && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {disabled ? (
                            <span style={{
                                padding: '3px 9px',
                                borderRadius: '9999px',
                                fontSize: '0.7rem',
                                fontWeight: 500,
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: '#71717a',
                                border: '1px solid rgba(255, 255, 255, 0.08)'
                            }}>
                                Coming Soon
                            </span>
                        ) : isChecking ? (
                            <span style={{
                                padding: '3px 9px',
                                borderRadius: '9999px',
                                fontSize: '0.7rem',
                                color: '#a1a1aa',
                                background: 'rgba(255, 255, 255, 0.05)'
                            }}>
                                Checking...
                            </span>
                        ) : isConnected ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div 
                                    title="Connected & Authorized"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '3px 10px',
                                        borderRadius: '9999px',
                                        fontSize: '0.72rem',
                                        fontWeight: 600,
                                        background: 'rgba(34, 197, 94, 0.14)',
                                        color: '#4ade80',
                                        border: '1px solid rgba(34, 197, 94, 0.3)',
                                        boxShadow: '0 0 10px rgba(34, 197, 94, 0.15)',
                                        letterSpacing: '0.01em'
                                    }}
                                >
                                    <span className="connector-live-dot" />
                                    <Check size={12} strokeWidth={2.5} />
                                    Connected
                                </div>
                                {onDisconnect && (
                                    <button 
                                        className="disconnect-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDisconnect();
                                        }}
                                        style={{
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            border: '1px solid rgba(239, 68, 68, 0.2)',
                                            color: '#ef4444',
                                            borderRadius: '6px',
                                            padding: '4px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        title="Disconnect"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onConnect) onConnect();
                                    else if (onClick) onClick();
                                }}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '4px 11px',
                                    borderRadius: '9999px',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    background: isHovered ? '#2563eb' : 'rgba(59, 130, 246, 0.14)',
                                    color: isHovered ? '#ffffff' : '#60a5fa',
                                    border: '1px solid rgba(59, 130, 246, 0.35)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: isHovered ? '0 0 12px rgba(59, 130, 246, 0.4)' : 'none'
                                }}
                            >
                                <LogIn size={12} />
                                Sign in
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Title & Description */}
            <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.98rem', color: '#f3f4f6', fontWeight: 600 }}>{title}</h4>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#a1a1aa', lineHeight: 1.45 }}>{desc}</p>
            </div>

            {/* Connector Footer Action Status */}
            {type === 'connector' && !disabled && (
                <div style={{ 
                    marginTop: '4px', 
                    paddingTop: '8px', 
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.74rem'
                }}>
                    {isConnected ? (
                        <>
                            <span style={{ color: '#4ade80', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <ShieldCheck size={12} /> Account Connected
                            </span>
                            <span style={{ color: isHovered ? '#93c5fd' : '#60a5fa', fontWeight: 500 }}>
                                Tap to chat →
                            </span>
                        </>
                    ) : (
                        <>
                            <span style={{ color: '#9ca3af' }}>
                                Not signed in
                            </span>
                            <span style={{ color: '#60a5fa', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                Sign in to connect →
                            </span>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
