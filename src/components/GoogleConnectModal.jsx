import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, ExternalLink } from 'lucide-react';

export default function GoogleConnectModal({ isOpen, onClose, onProceed }) {
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
                        style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2000, background: 'rgba(0, 0, 0, 0.7)' }}
                    />
                    <motion.div 
                        className="settings-card"
                        {...(isMobile ? mobileAnimation : desktopAnimation)}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                            ...(!isMobile ? { top: "50%", left: "50%", position: "fixed", width: '600px' } : { bottom: 0, left: 0, position: "fixed", width: '100%', height: 'auto', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }),
                            background: '#111111',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '16px',
                            boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
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

                        {/* Logo */}
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
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="34" height="34">
                                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                                <path fill="none" d="M0 0h48v48H0z"/>
                            </svg>
                        </div>

                        {/* Title & Description */}
                        <h2 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 600, color: '#fff' }}>Google</h2>
                        <p style={{ color: '#a1a1aa', fontSize: '0.9rem', lineHeight: '1.5', margin: '0 0 24px 0', textAlign: 'center', maxWidth: '480px' }}>
                            Manage your Gmail, access Google Drive files, and coordinate your Google Calendar directly from CEOVA to streamline your workflows.
                        </p>

                        {/* Connect Button */}
                        <button 
                            onClick={onProceed}
                            style={{
                                padding: '8px 24px',
                                borderRadius: '8px',
                                background: '#fff',
                                border: 'none',
                                color: '#000',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'opacity 0.2s',
                                marginBottom: '40px'
                            }}
                            onMouseEnter={(e) => e.target.style.opacity = 0.9}
                            onMouseLeave={(e) => e.target.style.opacity = 1}
                        >
                            Connect
                        </button>

                        <div style={{ width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            {/* Example Prompts */}
                            <div>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>Example prompts</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                                    {[
                                        "Summarize my unread emails from today.",
                                        "Find the latest financial report in my Drive.",
                                        "Draft a reply to Sarah about the new project.",
                                        "What are my meetings for tomorrow morning?"
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
                                            <div style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>OAuth 2.0</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '4px' }}>More info</div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <a href="https://google.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    Website <ExternalLink size={12} />
                                                </a>
                                                <a href="#" style={{ fontSize: '0.85rem', color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    Documentation <ExternalLink size={12} />
                                                </a>
                                                <a href="#" style={{ fontSize: '0.85rem', color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    Privacy Policy <ExternalLink size={12} />
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '4px' }}>Author</div>
                                            <div style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>Google</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '4px' }}>Security</div>
                                            <div style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: '1.4' }}>
                                                Tokens are managed securely. CEOVA never exposes raw tokens to the frontend.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Feedback */}
                        <div style={{ marginTop: '24px', fontSize: '0.8rem', color: '#a1a1aa', cursor: 'pointer', textDecoration: 'underline' }}>
                            Provide feedback
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );

    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
