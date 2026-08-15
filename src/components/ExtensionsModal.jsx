import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, ArrowLeft, Scissors, Eye, Minimize2, RefreshCw, Scan, FileText, 
    Key, Palette, Calculator, Receipt, Film, Link, Zap, Calendar, HardDrive, Mail,
    Check, LogIn, CircleDashed, ExternalLink, Sparkles, ShieldCheck, Trash2, Plus
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { connectGoogleDrive } from '../services/gdriveSyncEngine';
import GoogleConnectModal from './GoogleConnectModal';

export default function ExtensionsModal({ isOpen, onClose, initialTab = 'tools', onSelectTool }) {
    const [view, setView] = useState(initialTab); // 'tools' or 'connectors'
    const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
    
    const [connections, setConnections] = useState({
        google: false, // Google Drive, Gmail, Google Calendar
        googleEmail: null,
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

            const googleIdentity = user?.identities?.find(i => i.provider === 'google');
            const googleEmail = googleIdentity?.identity_data?.email || null;

            setConnections({
                google: hasGoogle,
                googleEmail: googleEmail,
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
        <>
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
                        background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 50%, rgba(0,0,0,0) 70%)',
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
                                    style={{ background: 'none', border: 'none', color: view === 'tools' ? '#fff' : '#a1a1aa', fontSize: '0.95rem', fontWeight: 500, cursor: 'pointer', paddingBottom: '8px', borderBottom: view === 'tools' ? '2px solid #fff' : '2px solid transparent', transition: 'all 0.2s' }}
                                >
                                    Tools
                                </button>
                                <button 
                                    className={`tab-btn ${view === 'connectors' ? 'active' : ''}`} 
                                    onClick={() => setView('connectors')}
                                    style={{ background: 'none', border: 'none', color: view === 'connectors' ? '#fff' : '#a1a1aa', fontSize: '0.95rem', fontWeight: 500, cursor: 'pointer', paddingBottom: '8px', borderBottom: view === 'connectors' ? '2px solid #fff' : '2px solid transparent', transition: 'all 0.2s' }}
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
                            <div className="extensions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                                
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
                            <div className="extensions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                                <ExtensionCard 
                                    type="connector"
                                    icon={
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="22" height="22">
                                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                                    </svg>
                                } 

                                    title="Google" 
                                    desc="Gmail, Drive & Calendar" 
                                    email={connections.googleEmail}
                                    isConnected={connections.google}
                                    isChecking={connections.checking}
                                    onConnect={() => setIsGoogleModalOpen(true)}
                                    onClick={() => {
                                        if (connections.google) {
                                            // Optional: Handle action if already connected. 
                                            // Wait, where do they go? They used to go to `/gdrive` or `/gmail`. 
                                            // If they click the card, maybe we just alert them they can use tools, or open settings.
                                            alert("Google is connected. Use the tools above to interact with Gmail, Drive, or Calendar.");
                                        } else {
                                            setIsGoogleModalOpen(true);
                                        }
                                    }}
                                    onDisconnect={handleGoogleDisconnect}
                                />
                                <ExtensionCard 
                                    type="connector"
                                    icon={<Zap size={22} color="#71717a" />} 
                                    title="Notion" 
                                    desc="Connect your workspaces." 
                                    disabled={true}
                                />
                                <ExtensionCard 
                                    type="connector"
                                    icon={<img src="/telegram.png" alt="Telegram" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />} 
                                    title="Telegram" 
                                    desc="Connect your Telegram chats." 
                                    disabled={true}
                                />
                            </div>
                        )}

                    </div>
                </motion.div>
                </>
            )}
        </AnimatePresence>
        <GoogleConnectModal 
            isOpen={isGoogleModalOpen} 
            onClose={() => setIsGoogleModalOpen(false)} 
            onProceed={() => {
                setIsGoogleModalOpen(false);
                handleGoogleConnect();
            }} 
        />
    </>
    );

    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}

function ExtensionCard({ 
    icon, 
    title, 
    desc, 
    email,
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
                    : (isHovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.015)'), 
                border: disabled 
                    ? '1px solid rgba(255,255,255,0.03)' 
                    : (isHovered ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.04)'), 
                borderRadius: '12px', 
                padding: '16px', 
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: '16px',
                transition: 'all 0.2s',
                opacity: disabled ? 0.6 : 1,
                position: 'relative'
            }}
        >
            {/* Icon */}
            <div style={{ 
                width: '42px', 
                height: '42px', 
                borderRadius: '10px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.05)',
                flexShrink: 0
            }}>
                {icon}
            </div>

            {/* Title & Description */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 500, color: '#ffffff', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {title}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#a1a1aa', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {desc}
                </span>
            </div>

            {/* Right Action */}
            <div style={{ flexShrink: 0, marginLeft: '8px', display: 'flex', alignItems: 'center' }}>
                {type === 'connector' ? (
                    <div 
                        onClick={(e) => {
                            e.stopPropagation();
                            if (disabled) return;
                            if (isConnected) {
                                if (onDisconnect) onDisconnect();
                            } else {
                                if (onConnect) onConnect();
                            }
                        }}
                        style={{
                            width: '36px',
                            height: '20px',
                            backgroundColor: isConnected ? '#fff' : 'rgba(255,255,255,0.1)',
                            borderRadius: '10px',
                            position: 'relative',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            transition: 'background-color 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            opacity: disabled ? 0.5 : 1
                        }}
                    >
                        <div style={{
                            width: '16px',
                            height: '16px',
                            backgroundColor: isConnected ? '#000' : '#a1a1aa',
                            borderRadius: '50%',
                            position: 'absolute',
                            left: isConnected ? '18px' : '2px',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }} />
                    </div>
                ) : (
                    <div style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '26px',
                        height: '26px',
                        borderRadius: '8px',
                        background: 'rgba(255,255,255,0.03)',
                        color: '#52525b',
                        opacity: isHovered ? 1 : 0.5,
                        transition: 'opacity 0.2s'
                    }}>
                        <Plus size={14} />
                    </div>
                )}
            </div>
        </div>
    );
}
