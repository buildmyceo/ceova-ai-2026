import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, MessageSquare, Edit } from 'lucide-react';

export default function SearchModal({ isOpen, onClose, chats, switchChat, chatMetadata = {}, currentChatId }) {
    const [searchQuery, setSearchQuery] = useState('');

    if (!isOpen) return null;

    // Filter logic
    const sortedChatIds = Object.keys(chats).filter(id => {
        if (id.startsWith('temp_')) return false;
        if (chats[id].length === 0) return false;
        
        if (searchQuery.trim() !== '') {
            const firstUserMsg = chats[id].find(m => m.sender === 'user')?.text || '';
            const isMatch = firstUserMsg.toLowerCase().includes(searchQuery.toLowerCase());
            if (!isMatch) return false;
        }
        return true;
    }).sort((a, b) => {
        // Fallback to last message time if metadata isn't available (e.g. optimistic new chats)
        const getTime = (id) => {
            if (chatMetadata[id]?.created_at) return new Date(chatMetadata[id].created_at).getTime();
            if (chats[id]?.length > 0) return new Date(chats[id][chats[id].length - 1].time || Date.now()).getTime();
            return Date.now();
        };
        return getTime(b) - getTime(a);
    });

    return (
        <AnimatePresence>
            {isOpen && (
                <div 
                    onClick={onClose} 
                    style={{ 
                        position: 'fixed', inset: 0, 
                        background: 'rgba(0, 0, 0, 0.5)', 
                        backdropFilter: 'blur(2px)',
                        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
                        paddingTop: '10vh',
                        zIndex: 3000 
                    }}
                >
                    <motion.div 
                        onClick={e => e.stopPropagation()}
                        initial={{ opacity: 0, scale: 0.98, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: -20 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        style={{ 
                            width: '100%', maxWidth: '600px', 
                            background: '#202123', 
                            border: '1px solid rgba(255, 255, 255, 0.1)', 
                            borderRadius: '12px',
                            display: 'flex', flexDirection: 'column',
                            maxHeight: '80vh',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                            overflow: 'hidden'
                        }}
                    >
                        <div style={{ position: 'relative', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                            <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input 
                                type="text" 
                                placeholder="Search chats..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                                style={{
                                    width: '100%',
                                    padding: '16px 16px 16px 48px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#ececf1',
                                    fontSize: '16px',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <button 
                                    onClick={() => {
                                        switchChat(null);
                                        onClose();
                                    }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '12px',
                                        padding: '12px', borderRadius: '8px',
                                        color: '#ececf1', textAlign: 'left', cursor: 'pointer',
                                        background: 'transparent', border: 'none',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <Edit size={16} color="var(--text-muted)" />
                                    <span style={{ fontSize: '15px' }}>New chat</span>
                                </button>
                                
                                {sortedChatIds.length > 0 && <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />}

                                {sortedChatIds.map(chatId => {
                                    const firstUserMsg = chats[chatId].find(m => m.sender === 'user')?.text;
                                    const title = firstUserMsg || (chats[chatId][0]?.isTitleFallback ? chats[chatId][0].text : "New Chat");
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
                                                padding: '12px', borderRadius: '8px',
                                                color: '#ececf1', textAlign: 'left', cursor: 'pointer',
                                                background: isActive ? 'rgba(255,255,255,0.1)' : 'rgba(0, 0, 0, 0.15)', border: 'none',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.background = isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'}
                                            onMouseOut={(e) => e.currentTarget.style.background = isActive ? 'rgba(255,255,255,0.1)' : 'rgba(0, 0, 0, 0.15)'}
                                        >
                                            <MessageSquare size={16} color="var(--text-muted)" />
                                            <span style={{ 
                                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                fontSize: '15px' 
                                            }}>
                                                {title}
                                            </span>
                                        </button>
                                    );
                                })}
                                
                                {sortedChatIds.length === 0 && searchQuery && (
                                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0' }}>
                                        <p>No chats match your search.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
