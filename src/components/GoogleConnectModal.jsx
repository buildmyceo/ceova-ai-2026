import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, Mail, HardDrive, Calendar, ArrowRight, Lock } from 'lucide-react';

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
                        style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2000, background: 'rgba(0, 0, 0, 0.6)' }}
                    />
                    <motion.div 
                        className="settings-card"
                        {...(isMobile ? mobileAnimation : desktopAnimation)}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                            ...(!isMobile ? { top: "50%", left: "50%", position: "fixed", width: '500px' } : { bottom: 0, left: 0, position: "fixed", width: '100%', height: 'auto', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }),
                            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
                            backdropFilter: 'blur(40px) saturate(200%)',
                            WebkitBackdropFilter: 'blur(40px) saturate(200%)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            boxShadow: '0 24px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
                            zIndex: 2001,
                            padding: '32px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '24px'
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {/* Using Lucide icons for logo fallback, or generic image */}
                                <div style={{ 
                                    background: '#fff', 
                                    borderRadius: '50%', 
                                    width: '32px', 
                                    height: '32px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    fontSize: '1.2rem',
                                    fontWeight: 'bold',
                                    color: '#ea4335'
                                }}>G</div>
                                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#fff' }}>Connect Google</h2>
                            </div>
                            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: '4px' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Description */}
                        <div>
                            <p style={{ color: '#e2e8f0', fontSize: '0.95rem', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                                Connecting your Google account allows CEOVA to provide a unified, intelligent workspace across your apps.
                            </p>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <Mail size={18} color="#ef4444" style={{ marginTop: '2px' }} />
                                    <div>
                                        <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 500 }}>Gmail</div>
                                        <div style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>Read and draft emails directly from chat.</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <HardDrive size={18} color="#3b82f6" style={{ marginTop: '2px' }} />
                                    <div>
                                        <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 500 }}>Google Drive</div>
                                        <div style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>Sync metadata and interact with your files.</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <Calendar size={18} color="#4ade80" style={{ marginTop: '2px' }} />
                                    <div>
                                        <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 500 }}>Google Calendar</div>
                                        <div style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>Manage your schedule and events.</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Privacy / Security Notice */}
                        <div style={{ display: 'flex', gap: '12px', background: 'rgba(34, 197, 94, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                            <ShieldCheck size={24} color="#4ade80" style={{ flexShrink: 0 }} />
                            <div>
                                <div style={{ color: '#4ade80', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Bank-grade Security</div>
                                <div style={{ color: '#a1a1aa', fontSize: '0.75rem', lineHeight: '1.4' }}>
                                    CEOVA uses secure OAuth protocols. We <b>never</b> expose or store raw access or refresh tokens on the frontend. Files remain in your Google Drive and are not downloaded into our storage.
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                            <button 
                                onClick={onClose}
                                style={{
                                    padding: '10px 16px',
                                    borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: '#e2e8f0',
                                    fontSize: '0.9rem',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => {
                                    onProceed();
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    background: '#3b82f6',
                                    border: 'none',
                                    color: '#fff',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'background 0.2s, transform 0.1s'
                                }}
                                onMouseEnter={(e) => e.target.style.background = '#2563eb'}
                                onMouseLeave={(e) => e.target.style.background = '#3b82f6'}
                                onMouseDown={(e) => e.target.style.transform = 'scale(0.98)'}
                                onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
                            >
                                <Lock size={16} />
                                Proceed to Google
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );

    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
