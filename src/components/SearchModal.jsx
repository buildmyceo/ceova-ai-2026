import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, MessageSquare, Edit, Pin, MessageCircle, X } from 'lucide-react';

export default function SearchModal({ isOpen, onClose, chats = {}, switchChat, chatMetadata = {}, currentChatId }) {
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setSearchQuery('');
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const getChatTitle = (id) => {
        if (chatMetadata[id]?.title) return chatMetadata[id].title;
        const firstUserMsg = chats[id]?.find(m => m.sender === 'user')?.text;
        return firstUserMsg || (chats[id]?.[0]?.isTitleFallback ? chats[id][0].text : "New Chat");
    };

    // Filter and sort logic
    const sortedChatIds = Object.keys(chats).filter(id => {
        if (id.startsWith('temp_')) return false;
        if (!chats[id] || chats[id].length === 0) return false;
        
        if (searchQuery.trim() !== '') {
            const q = searchQuery.trim().toLowerCase();
            const title = getChatTitle(id).toLowerCase();
            const firstUserMsg = (chats[id].find(m => m.sender === 'user')?.text || '').toLowerCase();
            return title.includes(q) || firstUserMsg.includes(q);
        }
        return true;
    }).sort((a, b) => {
        const getTime = (id) => {
            if (chatMetadata[id]?.created_at) return new Date(chatMetadata[id].created_at).getTime();
            if (chats[id]?.length > 0) return new Date(chats[id][chats[id].length - 1].time || Date.now()).getTime();
            return Date.now();
        };
        return getTime(b) - getTime(a);
    });

    const pinnedChatIds = sortedChatIds.filter(id => !!chatMetadata[id]?.is_pinned);
    const recentChatIds = sortedChatIds.filter(id => !chatMetadata[id]?.is_pinned);

    const renderChatRow = (chatId, isPinned) => {
        const title = getChatTitle(chatId);
        const isActive = chatId === currentChatId;

        return (
            <button 
                key={chatId}
                onClick={() => {
                    switchChat(chatId);
                    onClose();
                }}
                style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    width: '100%',
                    padding: '10px 14px', borderRadius: '10px',
                    color: isActive ? '#ffffff' : '#e5e7eb', 
                    textAlign: 'left', cursor: 'pointer',
                    background: isActive ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.02)', 
                    border: isActive ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid transparent',
                    transition: 'all 0.15s ease'
                }}
                onMouseOver={(e) => {
                    if (!isActive) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    }
                }}
                onMouseOut={(e) => {
                    if (!isActive) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                        e.currentTarget.style.borderColor = 'transparent';
                    }
                }}
            >
                {isPinned ? (
                    <MessageCircle size={16} style={{ color: 'rgba(255, 255, 255, 0.75)', flexShrink: 0 }} />
                ) : (
                    <MessageSquare size={16} style={{ color: 'rgba(255, 255, 255, 0.45)', flexShrink: 0 }} />
                )}
                
                <span style={{ 
                    flex: 1,
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis',
                    fontSize: '14.5px',
                    fontWeight: isActive ? 500 : 400
                }}>
                    {title}
                </span>

                {isPinned && (
                    <Pin size={12} style={{ color: 'rgba(255, 255, 255, 0.4)', flexShrink: 0, marginLeft: 'auto' }} />
                )}
            </button>
        );
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div 
                    onClick={onClose} 
                    style={{ 
                        position: 'fixed', inset: 0, 
                        background: 'rgba(0, 0, 0, 0.65)', 
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
                        paddingTop: '11vh',
                        zIndex: 3000 
                    }}
                >
                    <motion.div 
                        onClick={e => e.stopPropagation()}
                        initial={{ opacity: 0, scale: 0.97, y: -16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: -16 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        style={{ 
                            width: '92%', maxWidth: '580px', 
                            background: 'rgba(22, 22, 26, 0.84)', 
                            backdropFilter: 'blur(28px) saturate(190%)',
                            WebkitBackdropFilter: 'blur(28px) saturate(190%)',
                            border: '1px solid rgba(255, 255, 255, 0.12)', 
                            borderRadius: '16px',
                            display: 'flex', flexDirection: 'column',
                            maxHeight: '78vh',
                            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Search Input Bar */}
                        <div style={{ 
                            position: 'relative', 
                            display: 'flex',
                            alignItems: 'center',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                            background: 'rgba(255, 255, 255, 0.02)'
                        }}>
                            <Search size={18} style={{ position: 'absolute', left: '16px', color: 'rgba(255, 255, 255, 0.5)', pointerEvents: 'none' }} />
                            <input 
                                type="text" 
                                placeholder="Search chats..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                                style={{
                                    flex: 1,
                                    padding: '16px 16px 16px 46px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#ffffff',
                                    fontSize: '15px',
                                    outline: 'none',
                                    fontFamily: 'inherit'
                                }}
                            />
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '16px' }}>
                                {searchQuery && (
                                    <button 
                                        onClick={() => setSearchQuery('')}
                                        style={{ 
                                            background: 'rgba(255, 255, 255, 0.06)', 
                                            border: 'none', 
                                            color: 'rgba(255, 255, 255, 0.6)', 
                                            cursor: 'pointer', 
                                            padding: '4px',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.15s ease'
                                        }}
                                        onMouseOver={e => e.currentTarget.style.color = '#ffffff'}
                                        onMouseOut={e => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'}
                                        title="Clear search"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                                <kbd style={{
                                    fontSize: '10.5px',
                                    fontWeight: 500,
                                    color: 'rgba(255, 255, 255, 0.45)',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '5px',
                                    padding: '2px 6px',
                                    fontFamily: 'inherit',
                                    lineHeight: 1.2
                                }}>ESC</kbd>
                            </div>
                        </div>

                        {/* List Area */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {/* New Chat Action */}
                            <button 
                                onClick={() => {
                                    switchChat(null);
                                    onClose();
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '10px 14px', borderRadius: '10px',
                                    color: '#ffffff', textAlign: 'left', cursor: 'pointer',
                                    background: 'rgba(255, 255, 255, 0.04)', 
                                    border: '1px solid rgba(255, 255, 255, 0.06)',
                                    transition: 'all 0.15s ease'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                                }}
                            >
                                <div style={{
                                    width: '26px', height: '26px', borderRadius: '6px',
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <Edit size={14} color="#ffffff" />
                                </div>
                                <span style={{ fontSize: '14.5px', fontWeight: 500 }}>New chat</span>
                            </button>

                            {/* Pinned Chats Section */}
                            {pinnedChatIds.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px' }}>
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        padding: '4px 10px',
                                        fontSize: '11px', fontWeight: 600,
                                        textTransform: 'uppercase', letterSpacing: '0.07em',
                                        color: 'rgba(255, 255, 255, 0.45)'
                                    }}>
                                        <Pin size={11} />
                                        <span>Pinned</span>
                                        <span style={{
                                            marginLeft: 'auto', fontSize: '10px',
                                            background: 'rgba(255, 255, 255, 0.06)',
                                            padding: '1px 6px', borderRadius: '10px',
                                            color: 'rgba(255, 255, 255, 0.5)'
                                        }}>{pinnedChatIds.length}</span>
                                    </div>
                                    {pinnedChatIds.map(chatId => renderChatRow(chatId, true))}
                                </div>
                            )}

                            {/* Recents Section */}
                            {recentChatIds.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: pinnedChatIds.length > 0 ? '6px' : '4px' }}>
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        padding: '4px 10px',
                                        fontSize: '11px', fontWeight: 600,
                                        textTransform: 'uppercase', letterSpacing: '0.07em',
                                        color: 'rgba(255, 255, 255, 0.45)'
                                    }}>
                                        <MessageSquare size={11} />
                                        <span>Recents</span>
                                    </div>
                                    {recentChatIds.map(chatId => renderChatRow(chatId, false))}
                                </div>
                            )}

                            {/* Empty Results */}
                            {sortedChatIds.length === 0 && (
                                <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.45)', padding: '36px 16px' }}>
                                    <Search size={28} style={{ opacity: 0.35, marginBottom: '8px' }} />
                                    <p style={{ margin: 0, fontSize: '14px' }}>
                                        {searchQuery ? `No chats match "${searchQuery}"` : 'No chats found'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
