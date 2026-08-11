import React, { useState } from 'react';
import { LogOut, Plus, Search, Settings, HelpCircle, Archive, X, Clock, Pin, PinOff, SquareCheck, Glasses, Code2, PanelLeft, PanelLeftClose, Edit, BookOpen } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function Sidebar({ 
    chats, chatMetadata = {}, currentChatId, switchChat, createNewChat, createTemporaryChat, 
    onTaskClick, togglePinChat, deleteChat, userEmail, userMetadata, onLogout, 
    temporaryChatId, onToggleSettings, onOpenSearch, onOpenLibrary, isSidebarOpen, setSidebarOpen 
}) {
    const userName = userMetadata?.full_name || (userEmail ? userEmail.split('@')[0] : "User");
    const { resolvedTheme } = useTheme();
    const themeMod = resolvedTheme;
    const [searchQuery, setSearchQuery] = useState('');
    const [isLogoHovered, setIsLogoHovered] = useState(false);

    const fullLogoSrc = '/ceova logo dark.png';
    const logoSrc = fullLogoSrc;
    const isLightMode = resolvedTheme === 'light';

    // Auto-close handler for mobile
    const handleAction = (callback) => {
        if (callback) callback();
        if (window.innerWidth <= 768) {
            setSidebarOpen(false);
        }
    };

    const sortedChatIds = Object.keys(chats).filter(id => {
        // Hide temporary chats from sidebar
        if (id.startsWith('temp_')) return false;
        return chats[id].length > 0;
    }).sort((a, b) => {
        const isAPinned = chatMetadata[a]?.is_pinned;
        const isBPinned = chatMetadata[b]?.is_pinned;
        if (isAPinned && !isBPinned) return -1;
        if (!isAPinned && isBPinned) return 1;
        
        const msgA = chats[a]?.[chats[a].length - 1];
        const msgB = chats[b]?.[chats[b].length - 1];
        const timeA = msgA?.time ? new Date(msgA.time).getTime() : new Date(chatMetadata[a]?.created_at || Date.now()).getTime();
        const timeB = msgB?.time ? new Date(msgB.time).getTime() : new Date(chatMetadata[b]?.created_at || Date.now()).getTime();
        return timeB - timeA;
    });

    const filteredChatIds = sortedChatIds.filter(chatId => {
        // Handle sync titles - if it has messages, use the first user message, else use placeholder
        const firstUserMsg = chats[chatId].find(m => m.sender === 'user')?.text;
        const title = firstUserMsg || (chats[chatId][0]?.isTitleFallback ? chats[chatId][0].text : "New Chat");
        return title.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
        <aside id="sidebar" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="sidebar-brand" style={{ padding: isSidebarOpen ? '12px 20px' : '20px 0', justifyContent: isSidebarOpen ? 'space-between' : 'center', alignItems: 'center', display: 'flex', marginBottom: isSidebarOpen ? '32px' : '16px' }}>
                {isSidebarOpen ? (
                    <>
                        <img 
                            src={logoSrc} 
                            alt="Ceova Logo" 
                            className="brand-logo" 
                            style={{ 
                                maxHeight: '32px', 
                                width: 'auto',
                                objectFit: 'contain',
                                borderRadius: '0',
                                filter: 'var(--logo-filter)'
                            }} 
                        />
                        <button 
                            onClick={() => setSidebarOpen(false)} 
                            title="Close sidebar"
                            style={{ background: 'none', border: 'none', color: 'var(--text-color)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', transition: 'opacity 0.2s', opacity: 0.7 }}
                        >
                            <PanelLeft size={24} />
                        </button>
                    </>
                ) : (
                    <div
                        className="ceova-tooltip-container"
                        onMouseEnter={() => setIsLogoHovered(true)}
                        onMouseLeave={() => setIsLogoHovered(false)}
                        onClick={() => setSidebarOpen(true)}
                        style={{
                            width: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            position: 'relative'
                        }}
                    >
                        <img 
                            src={logoSrc} 
                            alt="Ceova Logo" 
                            style={{ 
                                maxHeight: '32px', 
                                width: 'auto',
                                maxWidth: '32px',
                                objectFit: 'contain',
                                borderRadius: '0',
                                position: 'absolute',
                                left: '50%',
                                top: '50%',
                                transform: 'translate(-50%, -50%)',
                                opacity: isLogoHovered ? 0 : 1,
                                transition: 'opacity 0.2s',
                                filter: 'var(--logo-filter)'
                            }} 
                        />
                        <div style={{
                            position: 'absolute',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'opacity 0.15s ease',
                            opacity: isLogoHovered ? 0.7 : 0,
                            color: 'var(--text-color)'
                        }}>
                            <PanelLeft size={24} />
                        </div>
                        <div className="ceova-tooltip">Open sidebar</div>
                    </div>
                )}
            </div>

            {/* Workspace Switcher Removed */}

            <div className="sidebar-action-group" style={{ 
                padding: isSidebarOpen ? '0 12px' : '0', 
                alignItems: isSidebarOpen ? 'stretch' : 'center', 
                gap: '8px', 
                display: 'flex', 
                flexDirection: 'column',
                marginTop: isSidebarOpen ? '8px' : '0'
            }}>
                <button 
                    className={`icon-nav-btn ${!isSidebarOpen ? 'ceova-tooltip-container' : ''} ${currentChatId === temporaryChatId ? 'dimmed' : ''}`} 
                    onClick={() => handleAction(createNewChat)}
                    title={isSidebarOpen ? "New Chat" : undefined}
                    style={{ 
                        padding: isSidebarOpen ? '10px 14px' : '12px', 
                        width: isSidebarOpen ? '100%' : 'max-content', 
                        display: 'flex', 
                        justifyContent: isSidebarOpen ? 'flex-start' : 'center',
                        alignItems: 'center',
                        gap: '12px'
                    }}
                >
                    {isSidebarOpen ? (
                        <>
                            <Edit size={18} />
                            <span>New chat</span>
                        </>
                    ) : (
                        <>
                            <Edit size={20} />
                            <div className="ceova-tooltip">New chat</div>
                        </>
                    )}
                </button>

                <button 
                    className={`icon-nav-btn ${!isSidebarOpen ? 'ceova-tooltip-container' : ''}`} 
                    onClick={() => handleAction(onOpenSearch)}
                    title={isSidebarOpen ? "Search chats" : undefined}
                    style={{ 
                        padding: isSidebarOpen ? '10px 14px' : '12px', 
                        width: isSidebarOpen ? '100%' : 'max-content',
                        display: 'flex',
                        justifyContent: isSidebarOpen ? 'flex-start' : 'center',
                        alignItems: 'center',
                        gap: '12px'
                    }}
                >
                    {isSidebarOpen ? (
                        <>
                            <Search size={18} />
                            <span>Search</span>
                        </>
                    ) : (
                        <>
                            <Search size={20} />
                            <div className="ceova-tooltip">Search</div>
                        </>
                    )}
                </button>

                <button 
                    className={`icon-nav-btn ${!isSidebarOpen ? 'ceova-tooltip-container' : ''}`} 
                    onClick={() => handleAction(onOpenLibrary)}
                    title={isSidebarOpen ? "Library" : undefined}
                    style={{ 
                        padding: isSidebarOpen ? '10px 14px' : '12px', 
                        width: isSidebarOpen ? '100%' : 'max-content',
                        display: 'flex',
                        justifyContent: isSidebarOpen ? 'flex-start' : 'center',
                        alignItems: 'center',
                        gap: '12px'
                    }}
                >
                    {isSidebarOpen ? (
                        <>
                            <BookOpen size={18} />
                            <span>Library</span>
                        </>
                    ) : (
                        <>
                            <BookOpen size={20} />
                            <div className="ceova-tooltip">Library</div>
                        </>
                    )}
                </button>
            </div>

            {isSidebarOpen && (
                <>
                    <div className="chats-section" style={{ padding: '0 12px', flexGrow: 1, overflowY: 'auto' }}>
                        <div className="section-title">Recent</div>
                        <div className="chat-list">
                            {filteredChatIds.slice(0, 15).map(chatId => {
                                const firstUserMsg = chats[chatId].find(m => m.sender === 'user')?.text;
                                const title = firstUserMsg || (chats[chatId][0]?.isTitleFallback ? chats[chatId][0].text : "New Chat");
                                
                                return (
                                    <div 
                                        key={chatId} 
                                        className={`chat-item ${currentChatId === chatId ? 'active' : ''}`}
                                        onClick={() => handleAction(() => switchChat(chatId))}
                                    >
                                        <span className="chat-title">{title}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* When sidebar is closed, flexGrow to push bottom to bottom */}
            {!isSidebarOpen && <div style={{ flexGrow: 1 }} />}

            <div className="sidebar-bottom" style={{ padding: isSidebarOpen ? '12px' : '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isSidebarOpen ? '8px' : '16px' }}>
                <div style={{ width: '100%', padding: isSidebarOpen ? '0 12px' : '0', display: 'flex', justifyContent: 'center' }}>
                    <button 
                        className={`icon-nav-btn ${!isSidebarOpen ? 'ceova-tooltip-container' : ''}`} 
                        onClick={() => handleAction(onToggleSettings)} 
                        title={isSidebarOpen ? "Settings" : undefined} 
                        style={{ padding: isSidebarOpen ? '10px 14px' : '12px', width: isSidebarOpen ? '100%' : 'max-content' }}
                    >
                        {isSidebarOpen ? (
                            <>
                                <Settings size={20} />
                                <span>Settings</span>
                            </>
                        ) : (
                            <>
                                <Settings size={20} />
                                <div className="ceova-tooltip">Settings</div>
                            </>
                        )}
                    </button>
                </div>
                
                {userEmail && (
                    <div className={`user-info ${!isSidebarOpen ? 'ceova-tooltip-container' : ''}`} style={{ justifyContent: isSidebarOpen ? 'flex-start' : 'center', width: '100%' }}>
                        {userMetadata?.avatar_url ? (
                            <img src={userMetadata.avatar_url} alt={userName} className="user-avatar" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                        ) : (
                            <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--input-bg)', color: 'var(--text-main)', borderRadius: '50%', border: '1px solid var(--border-color)' }}>
                                {userName.charAt(0).toUpperCase()}
                            </div>
                        )}
                        {isSidebarOpen ? (
                            <div className="user-text">
                                <span className="user-email" style={{ fontSize: '0.7rem' }}>{userName}</span>
                                <button className="logout-link" onClick={onLogout}>Log out</button>
                            </div>
                        ) : (
                            <div className="ceova-tooltip">{userName}</div>
                        )}
                    </div>
                )}
            </div>
        </aside>
    );
}
