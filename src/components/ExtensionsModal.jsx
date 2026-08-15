import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, ArrowLeft, Scissors, Eye, Minimize2, RefreshCw, Scan, FileText, 
    Key, Palette, Calculator, Receipt, Film, Link, Zap, Calendar, HardDrive, Mail,
    Check, LogIn, CircleDashed, ExternalLink, Sparkles, ShieldCheck, Trash2, Video
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { connectGoogleDrive } from '../services/gdriveSyncEngine';

export default function ExtensionsModal({ isOpen, onClose, initialTab = 'tools', onSelectTool }) {
    const [view, setView] = useState(initialTab); // 'tools' or 'connectors'
    
    // Connection statuses for apps
    const [connections, setConnections] = useState({
        google: false, // Google Drive, Gmail, Google Calendar
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

            setConnections({
                google: hasGoogle,
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
                <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1000, background: 'rgba(0, 0, 0, 0.4)' }}>
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '70vw',
                        height: '70vh',
                        background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(168,85,247,0.1) 50%, rgba(0,0,0,0) 70%)',
                        filter: 'blur(80px)',
                        pointerEvents: 'none',
                    }} />
                </motion.div>
                <motion.div 
                    className="settings-card extensions-modal-card"
                    {...(isMobile ? mobileAnimation : desktopAnimation)}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                        ...(!isMobile ? { top: "50%", left: "50%", position: "fixed" } : { bottom: 0, left: 0, position: "fixed", width: '100%', height: '85vh', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }),
                        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.6))',
                        backdropFilter: 'blur(40px) saturate(200%)',
                        WebkitBackdropFilter: 'blur(40px) saturate(200%)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        boxShadow: '0 24px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
                        zIndex: 1001
                    }}
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
                                    icon={<Video size={22} color="#ef4444" />} 
                                    title="Video Downloader" 
                                    desc="Download temporary videos from URLs." 
                                    onClick={() => handleToolSelect('/download_video')} 
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
                    ? 'rgba(255,255,255,0.01)' 
                    : isConnected 
                        ? (isHovered ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.04)') 
                        : (isHovered ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)'), 
                border: disabled 
                    ? '1px solid rgba(255,255,255,0.03)' 
                    : isConnected 
                        ? (isHovered ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(34, 197, 94, 0.2)') 
                        : (isHovered ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.06)'), 
                borderRadius: '16px', 
                padding: '18px', 
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                opacity: disabled ? 0.4 : 1,
                position: 'relative',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                boxShadow: isHovered && !disabled 
                    ? (isConnected ? '0 12px 30px -5px rgba(34, 197, 94, 0.2)' : '0 12px 30px -5px rgba(0, 0, 0, 0.4)')
                    : 'none',
                transform: isHovered && !disabled ? 'translateY(-3px)' : 'none',
            }}
        >
            {/* Top Row: Icon + Status Badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ 
                    width: '44px', 
                    height: '44px', 
                    borderRadius: '12px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    background: isConnected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255,255,255,0.06)',
                    border: isConnected ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(255,255,255,0.1)',
                    boxShadow: isHovered ? (isConnected ? '0 0 15px rgba(34, 197, 94, 0.3)' : '0 0 15px rgba(255,255,255,0.15)') : 'none',
                    transition: 'all 0.3s ease'
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

            {/* Bottom Row: Title + Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 600, color: disabled ? '#71717a' : '#ffffff', letterSpacing: '-0.01em' }}>{title}</span>
                <span style={{ fontSize: '0.82rem', color: disabled ? '#52525b' : '#a1a1aa', lineHeight: '1.45', fontWeight: 400 }}>{desc}</span>
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
