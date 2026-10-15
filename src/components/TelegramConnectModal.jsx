import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, ExternalLink, Check, Copy, CircleDashed, Globe, Wrench, Mail, ShieldCheck, Unlink } from 'lucide-react';
import { supabase, SUPABASE_URL } from '../services/supabase';

export default function TelegramConnectModal({ isOpen, onClose, onStatusChange }) {
    const [isConnected, setIsConnected] = useState(false);
    const [tgData, setTgData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [waitingForStart, setWaitingForStart] = useState(false);
    const [connectInfo, setConnectInfo] = useState(null);
    const [copied, setCopied] = useState(false);
    const pollTimerRef = useRef(null);

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

    useEffect(() => {
        if (isOpen) {
            checkTelegramStatus();
        } else {
            cleanupPolling();
            setWaitingForStart(false);
            setConnectInfo(null);
        }
        return () => cleanupPolling();
    }, [isOpen]);

    const cleanupPolling = () => {
        if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }
    };

    const checkTelegramStatus = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) {
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('user_telegram')
                .select('*')
                .eq('user_id', session.user.id)
                .eq('connected', true)
                .maybeSingle();

            if (!error && data?.connected) {
                setIsConnected(true);
                setTgData(data);
                cleanupPolling();
                setWaitingForStart(false);
                if (onStatusChange) onStatusChange(true);
            } else {
                setIsConnected(false);
                setTgData(null);
                if (onStatusChange) onStatusChange(false);
            }
        } catch (err) {
            console.error('[TelegramConnectModal] Status check error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = async () => {
        setConnecting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) {
                alert("Please log in to link your Telegram account.");
                setConnecting(false);
                return;
            }

            // Call telegram-webhook/connect or super-endpoint/telegram-connect
            let connectionData = null;
            const token = session.access_token;

            try {
                const res = await fetch(`${SUPABASE_URL}/functions/v1/telegram-webhook/connect`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ user_id: session.user.id })
                });
                if (res.ok) {
                    connectionData = await res.json();
                }
            } catch (fnErr) {
                console.warn('[TelegramConnectModal] webhook endpoint failed, trying super-endpoint:', fnErr);
            }

            if (!connectionData?.link) {
                // Fallback to super-endpoint
                const resFallback = await fetch(`${SUPABASE_URL}/functions/v1/super-endpoint/telegram-connect`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ user_id: session.user.id })
                });
                if (resFallback.ok) {
                    connectionData = await resFallback.json();
                }
            }

            if (!connectionData?.link) {
                throw new Error("Could not generate Telegram connect link.");
            }

            setConnectInfo(connectionData);
            setWaitingForStart(true);

            // Open Telegram link in new window
            window.open(connectionData.link, '_blank');

            // Begin polling for user_telegram verification
            cleanupPolling();
            pollTimerRef.current = setInterval(async () => {
                const { data } = await supabase
                    .from('user_telegram')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .eq('connected', true)
                    .maybeSingle();

                if (data?.connected) {
                    setIsConnected(true);
                    setTgData(data);
                    setWaitingForStart(false);
                    cleanupPolling();
                    if (onStatusChange) onStatusChange(true);
                }
            }, 2500);

        } catch (err) {
            console.error('[TelegramConnectModal] Connect error:', err);
            alert("Could not start Telegram connection. Please try again.");
        } finally {
            setConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm("Are you sure you want to disconnect Telegram from CEOVA?")) return;
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) {
                await supabase
                    .from('user_telegram')
                    .delete()
                    .eq('user_id', session.user.id);
            }
            setIsConnected(false);
            setTgData(null);
            setConnectInfo(null);
            setWaitingForStart(false);
            if (onStatusChange) onStatusChange(false);
        } catch (err) {
            console.error('[TelegramConnectModal] Disconnect error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        if (connectInfo?.link) {
            navigator.clipboard.writeText(connectInfo.link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div 
                        className="modal-backdrop" 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }} 
                        onClick={onClose} 
                        style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2000, background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
                    />
                    <motion.div 
                        className="settings-card"
                        {...(isMobile ? mobileAnimation : desktopAnimation)}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                            ...(!isMobile ? { top: "50%", left: "50%", position: "fixed", width: '600px' } : { bottom: 0, left: 0, position: "fixed", width: '100%', height: 'auto', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }),
                            background: 'rgba(20, 20, 24, 0.84)',
                            backdropFilter: 'blur(28px) saturate(190%)',
                            WebkitBackdropFilter: 'blur(28px) saturate(190%)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '20px',
                            boxShadow: '0 28px 70px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
                            zIndex: 2001,
                            padding: '32px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                            maxHeight: isMobile ? '90vh' : '90vh',
                            overflowY: 'auto'
                        }}
                    >
                        {/* Close Button */}
                        <button 
                            onClick={onClose} 
                            style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: '8px' }}
                        >
                            <X size={20} />
                        </button>

                        {/* Telegram Logo */}
                        <div style={{ 
                            background: 'rgba(255,255,255,0.06)', 
                            borderRadius: '16px', 
                            width: '64px', 
                            height: '64px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            marginBottom: '16px',
                            marginTop: '8px',
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <img src="/telegram.png" alt="Telegram" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
                        </div>

                        {/* Title & Description */}
                        <h2 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 600, color: '#fff' }}>Telegram</h2>
                        <p style={{ color: '#a1a1aa', fontSize: '0.9rem', lineHeight: '1.5', margin: '0 0 24px 0', textAlign: 'center', maxWidth: '480px' }}>
                            Talk to CEOVA right from Telegram. Run utility tools, manage your Google Workspace, and get instant answers anywhere on any device.
                        </p>

                        {/* Connection State Actions */}
                        {loading ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a1a1aa', marginBottom: '32px' }}>
                                <CircleDashed size={18} className="spinning" />
                                <span style={{ fontSize: '0.85rem' }}>Checking connection status…</span>
                            </div>
                        ) : isConnected ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '32px', width: '100%' }}>
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '10px', 
                                    background: 'rgba(34, 197, 94, 0.1)', 
                                    border: '1px solid rgba(34, 197, 94, 0.25)', 
                                    borderRadius: '10px', 
                                    padding: '10px 18px',
                                    color: '#4ade80',
                                    fontSize: '0.85rem',
                                    fontWeight: 500
                                }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
                                    <span>Connected to CEOVA Telegram Bot</span>
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <a 
                                        href={connectInfo?.botUsername ? `https://t.me/${connectInfo.botUsername}` : "https://t.me/CeovaAiBot"}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            padding: '8px 20px',
                                            borderRadius: '8px',
                                            background: '#fff',
                                            color: '#000',
                                            fontSize: '0.85rem',
                                            fontWeight: 500,
                                            textDecoration: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        Open Telegram <ExternalLink size={14} />
                                    </a>
                                    <button 
                                        onClick={handleDisconnect}
                                        style={{
                                            padding: '8px 18px',
                                            borderRadius: '8px',
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            border: '1px solid rgba(239, 68, 68, 0.25)',
                                            color: '#f87171',
                                            fontSize: '0.85rem',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        <Unlink size={14} /> Disconnect
                                    </button>
                                </div>
                            </div>
                        ) : waitingForStart ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', marginBottom: '32px', width: '100%' }}>
                                <div style={{ 
                                    background: 'rgba(59, 130, 246, 0.08)', 
                                    border: '1px solid rgba(59, 130, 246, 0.2)', 
                                    borderRadius: '12px', 
                                    padding: '16px', 
                                    width: '100%', 
                                    boxSizing: 'border-box',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#60a5fa', fontSize: '0.9rem', fontWeight: 500 }}>
                                        <CircleDashed size={16} className="spinning" />
                                        <span>Waiting for you to tap "Start" in Telegram…</span>
                                    </div>
                                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0, lineHeight: 1.4 }}>
                                        We opened the CEOVA bot in Telegram. Simply press <b>Start</b> in the chat to pair your account automatically.
                                    </p>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                        <a 
                                            href={connectInfo?.link || '#'}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                padding: '6px 14px',
                                                borderRadius: '6px',
                                                background: '#2563eb',
                                                color: '#fff',
                                                fontSize: '0.8rem',
                                                textDecoration: 'none',
                                                fontWeight: 500,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            Open in Telegram <ExternalLink size={12} />
                                        </a>
                                        <button 
                                            onClick={handleCopy}
                                            style={{
                                                padding: '6px 14px',
                                                borderRadius: '6px',
                                                background: 'rgba(255,255,255,0.06)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                color: '#e2e8f0',
                                                fontSize: '0.8rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            {copied ? <Check size={12} color="#22c55e" /> : <Copy size={12} />}
                                            {copied ? "Copied!" : "Copy Link"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <button 
                                onClick={handleConnect}
                                disabled={connecting}
                                style={{
                                    padding: '8px 24px',
                                    borderRadius: '8px',
                                    background: '#fff',
                                    border: 'none',
                                    color: '#000',
                                    fontSize: '0.9rem',
                                    fontWeight: 500,
                                    cursor: connecting ? 'not-allowed' : 'pointer',
                                    transition: 'opacity 0.2s',
                                    marginBottom: '40px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    opacity: connecting ? 0.7 : 1
                                }}
                                onMouseEnter={(e) => { if (!connecting) e.target.style.opacity = 0.9; }}
                                onMouseLeave={(e) => { if (!connecting) e.target.style.opacity = 1; }}
                            >
                                {connecting ? (
                                    <>
                                        <CircleDashed size={16} className="spinning" />
                                        Connecting…
                                    </>
                                ) : (
                                    "Connect Telegram"
                                )}
                            </button>
                        )}

                        {/* Capabilities & Example Prompts Section */}
                        <div style={{ width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            {/* What You Can Do in Telegram */}
                            <div>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>What you can do on Telegram</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                                    {[
                                        {
                                            icon: <Globe size={16} color="#38bdf8" />,
                                            title: "Build Websites (Paused)",
                                            desc: "Website development is temporarily paused for upgrades. Check back soon for updates."
                                        },
                                        {
                                            icon: <Wrench size={16} color="#f59e0b" />,
                                            title: "Run All CEOVA Tools",
                                            desc: "Generate QR codes, create invoices, merge PDFs, remove image backgrounds on the go."
                                        },
                                        {
                                            icon: <Mail size={16} color="#ef4444" />,
                                            title: "Google Workspace Actions",
                                            desc: "Search & draft Gmail, check calendar schedules, and access Google Drive files."
                                        },
                                        {
                                            icon: <ShieldCheck size={16} color="#22c55e" />,
                                            title: "Persistent AI Memory",
                                            desc: "Context and memories stay synced between the CEOVA web app and Telegram."
                                        }
                                    ].map((item, i) => (
                                        <div key={i} style={{ 
                                            background: 'rgba(255,255,255,0.03)', 
                                            border: '1px solid rgba(255,255,255,0.08)', 
                                            borderRadius: '12px', 
                                            padding: '16px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {item.icon}
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>{item.title}</span>
                                            </div>
                                            <span style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4' }}>{item.desc}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Example Prompts */}
                            <div>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>Example prompts</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                                    {[
                                        "Create a business proposal for a new client project.",
                                        "Generate a QR code for https://mybusiness.com",
                                        "Create an invoice for $650 for UX design services.",
                                        "Summarize my unread emails from today."
                                    ].map((prompt, i) => (
                                        <div key={i} style={{ 
                                            background: 'rgba(255,255,255,0.03)', 
                                            border: '1px solid rgba(255,255,255,0.08)', 
                                            borderRadius: '12px', 
                                            padding: '16px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '12px'
                                        }}>
                                            <MessageSquare size={16} color="#a1a1aa" />
                                            <span style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: '1.4' }}>{prompt}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Details */}
                            <div>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>Details</h3>
                                <div style={{ 
                                    background: 'rgba(255,255,255,0.03)', 
                                    border: '1px solid rgba(255,255,255,0.08)', 
                                    borderRadius: '12px', 
                                    padding: '20px',
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                                    gap: '24px'
                                }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '4px' }}>Connector Type</div>
                                            <div style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>Telegram Bot API (Direct Webhook)</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '4px' }}>Security</div>
                                            <div style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: '1.4' }}>
                                                Cryptographically signed one-time pairing tokens. Only your authenticated user account can access your chats.
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '4px' }}>Author</div>
                                            <div style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>CEOVA AI Platform</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '4px' }}>Commands</div>
                                            <div style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: '1.4' }}>
                                                Use <code>/apps</code>, <code>/usage</code>, <code>/help</code>, or <code>/disconnect</code> anytime in Telegram.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ marginTop: '24px', fontSize: '0.8rem', color: '#a1a1aa', textAlign: 'center' }}>
                            Questions or feedback? Chat with CEOVA anytime.
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );

    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
