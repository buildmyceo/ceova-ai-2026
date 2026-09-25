import React, { useState, useEffect, useRef } from 'react';
import { 
    LogOut, Plus, Search, Settings, PanelLeft, 
    MoreHorizontal, Trash2, Check, X, Pin, PinOff, Edit, 
    BookOpen, MessageSquare, MessageCircle 
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function Sidebar({ 
    chats, chatMetadata = {}, currentChatId, switchChat, createNewChat, createTemporaryChat, 
    onTaskClick, togglePinChat, deleteChat, renameChat, userEmail, userMetadata, onLogout, 
    temporaryChatId, onToggleSettings, onOpenSearch, onOpenLibrary, isSidebarOpen, setSidebarOpen 
}) {
    const userName = userMetadata?.full_name || userMetadata?.name || (userEmail ? userEmail.split('@')[0] : "User");
    const { resolvedTheme } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [isLogoHovered, setIsLogoHovered] = useState(false);
    const [activeMenuChatId, setActiveMenuChatId] = useState(null);
    const [menuPlacement, setMenuPlacement] = useState('bottom');
    const [renamingChatId, setRenamingChatId] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const renameInputRef = useRef(null);
    const menuRef = useRef(null);

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (activeMenuChatId && !e.target.closest('.chat-item-menu-container')) {
                setActiveMenuChatId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeMenuChatId]);

    // Keyboard shortcut for toggling sidebar: Cmd/Ctrl + B
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                setSidebarOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setSidebarOpen]);

    const handleStartRename = (chatId, currentTitle) => {
        setRenamingChatId(chatId);
        setRenameValue(currentTitle);
        setTimeout(() => {
            if (renameInputRef.current) {
                renameInputRef.current.focus();
                renameInputRef.current.select();
            }
        }, 50);
    };

    const handleSaveRename = (chatId) => {
        if (renameValue.trim()) {
            renameChat?.(chatId, renameValue.trim());
        }
        setRenamingChatId(null);
        setRenameValue('');
    };

    const handleCancelRename = () => {
        setRenamingChatId(null);
        setRenameValue('');
    };

    const toggleMenu = (e, chatId) => {
        e.stopPropagation();
        if (activeMenuChatId === chatId) {
            setActiveMenuChatId(null);
        } else {
            const rect = e.currentTarget.getBoundingClientRect();
            const isNearBottom = rect.bottom > window.innerHeight - 160;
            setMenuPlacement(isNearBottom ? 'top' : 'bottom');
            setActiveMenuChatId(chatId);
        }
    };

    // Auto-close handler for mobile
    const handleAction = (callback) => {
        if (callback) callback();
        if (window.innerWidth <= 768) {
            setSidebarOpen(false);
        }
    };

    const getChatTitle = (chatId) => {
        if (chatMetadata[chatId]?.title) return chatMetadata[chatId].title;
        const firstUserMsg = chats[chatId]?.find(m => m.sender === 'user')?.text;
        return firstUserMsg || (chats[chatId]?.[0]?.isTitleFallback ? chats[chatId][0].text : "New Chat");
    };

    const sortedChatIds = Object.keys(chats).filter(id => {
        if (id.startsWith('temp_')) return false;
        return chats[id]?.length > 0;
    }).sort((a, b) => {
        const isAPinned = !!chatMetadata[a]?.is_pinned;
        const isBPinned = !!chatMetadata[b]?.is_pinned;
        if (isAPinned && !isBPinned) return -1;
        if (!isAPinned && isBPinned) return 1;
        
        const msgA = chats[a]?.[chats[a].length - 1];
        const msgB = chats[b]?.[chats[b].length - 1];
        const timeA = msgA?.time ? new Date(msgA.time).getTime() : new Date(chatMetadata[a]?.created_at || Date.now()).getTime();
        const timeB = msgB?.time ? new Date(msgB.time).getTime() : new Date(chatMetadata[b]?.created_at || Date.now()).getTime();
        return timeB - timeA;
    });

    const filteredChatIds = sortedChatIds.filter(chatId => {
        const title = getChatTitle(chatId);
        return title.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const pinnedChatIds = filteredChatIds.filter(id => !!chatMetadata[id]?.is_pinned);
    const recentChatIds = filteredChatIds.filter(id => !chatMetadata[id]?.is_pinned);

    const renderChatItem = (chatId, isPinned) => {
        const title = getChatTitle(chatId);
        const isRenaming = renamingChatId === chatId;
        const isMenuActive = activeMenuChatId === chatId;
        const isActive = currentChatId === chatId;

        return (
            <div 
                key={chatId} 
                className={`chat-item ${isActive ? 'active' : ''} ${isPinned ? 'pinned-item' : ''}`}
                onClick={() => {
                    if (!isRenaming) {
                        handleAction(() => switchChat(chatId));
                    }
                }}
            >
                {isRenaming ? (
                    <div className="chat-rename-wrapper" onClick={e => e.stopPropagation()}>
                        <input 
                            ref={renameInputRef}
                            type="text"
                            className="chat-rename-input"
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveRename(chatId);
                                else if (e.key === 'Escape') handleCancelRename();
                            }}
                            autoFocus
                        />
                        <div className="chat-rename-actions">
                            <button 
                                type="button"
                                className="chat-rename-btn save" 
                                title="Save" 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveRename(chatId);
                                }}
                            >
                                <Check size={13} />
                            </button>
                            <button 
                                type="button"
                                className="chat-rename-btn cancel" 
                                title="Cancel" 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelRename();
                                }}
                            >
                                <X size={13} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="chat-item-content">
                            {isPinned ? (
                                <Pin size={14} className="chat-pinned-icon" />
                            ) : (
                                <MessageSquare size={14} className="chat-row-icon" />
                            )}
                            <span className="chat-title" title={title}>{title}</span>
                        </div>
                        
                        <div className="chat-item-menu-container" onClick={e => e.stopPropagation()}>
                            <button 
                                type="button"
                                className={`chat-item-more-btn ${isMenuActive ? 'active' : ''}`}
                                title="Chat options"
                                onClick={(e) => toggleMenu(e, chatId)}
                            >
                                <MoreHorizontal size={15} />
                            </button>

                            {isMenuActive && (
                                <div className={`chat-item-dropdown placement-${menuPlacement}`} ref={menuRef}>
                                    <button 
                                        type="button"
                                        className="chat-dropdown-item" 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveMenuChatId(null);
                                            togglePinChat(chatId, isPinned);
                                        }}
                                    >
                                        {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                                        <span>{isPinned ? 'Unpin' : 'Pin'}</span>
                                    </button>
                                    <button 
                                        type="button"
                                        className="chat-dropdown-item" 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveMenuChatId(null);
                                            handleStartRename(chatId, title);
                                        }}
                                    >
                                        <Edit size={14} />
                                        <span>Rename</span>
                                    </button>
                                    <button 
                                        type="button"
                                        className="chat-dropdown-item danger" 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveMenuChatId(null);
                                            deleteChat(chatId);
                                        }}
                                    >
                                        <Trash2 size={14} />
                                        <span>Delete</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        );
    };

    return (
        <aside id="sidebar" className={`sidebar-container ${isSidebarOpen ? 'is-open' : 'is-collapsed'}`}>
            {/* Header: Logo and Toggle Button */}
            <div className="sidebar-header">
                {isSidebarOpen ? (
                    <div className="sidebar-header-open">
                        <div className="sidebar-brand-group">
                            <img 
                                src="/ceova app.png" 
                                alt="Ceova" 
                                className="brand-logo-icon"
                                onError={(e) => { e.currentTarget.src = '/ceova logo dark.png'; }}
                            />
                            <span className="sidebar-brand-title">Ceova</span>
                        </div>
                        <button 
                            type="button"
                            onClick={() => setSidebarOpen(false)} 
                            title="Collapse sidebar (⌘B)"
                            className="sidebar-toggle-btn"
                        >
                            <PanelLeft size={18} />
                        </button>
                    </div>
                ) : (
                    <div
                        className="sidebar-header-collapsed ceova-tooltip-container"
                        onMouseEnter={() => setIsLogoHovered(true)}
                        onMouseLeave={() => setIsLogoHovered(false)}
                        onClick={() => setSidebarOpen(true)}
                        title="Expand sidebar (⌘B)"
                    >
                        <div className="sidebar-collapsed-brand-box">
                            <img 
                                src="/ceova app.png" 
                                alt="Ceova" 
                                className="brand-logo-icon"
                                style={{
                                    opacity: isLogoHovered ? 0 : 1,
                                    transform: isLogoHovered ? 'scale(0.85)' : 'scale(1)'
                                }}
                                onError={(e) => { e.currentTarget.src = '/ceova logo dark.png'; }}
                            />
                            <div 
                                className="sidebar-expand-icon-overlay"
                                style={{
                                    opacity: isLogoHovered ? 1 : 0,
                                    transform: isLogoHovered ? 'scale(1)' : 'scale(0.85)'
                                }}
                            >
                                <PanelLeft size={18} />
                            </div>
                        </div>
                        <div className="ceova-tooltip">Expand sidebar (⌘B)</div>
                    </div>
                )}
            </div>

            {/* Main Action Group: New Chat, Search, Library */}
            <div className="sidebar-action-group">
                <button 
                    type="button"
                    className={`sidebar-nav-btn primary ${!isSidebarOpen ? 'ceova-tooltip-container' : ''} ${currentChatId === temporaryChatId ? 'dimmed' : ''}`} 
                    onClick={() => handleAction(createNewChat)}
                    title={isSidebarOpen ? undefined : "New chat"}
                >
                    <div className="sidebar-nav-icon-box">
                        <Plus size={18} strokeWidth={2.2} />
                    </div>
                    {isSidebarOpen && (
                        <>
                            <span className="sidebar-nav-label">New chat</span>
                            <span className="sidebar-kbd-hint">⌘N</span>
                        </>
                    )}
                    {!isSidebarOpen && <div className="ceova-tooltip">New chat</div>}
                </button>

                <button 
                    type="button"
                    className={`sidebar-nav-btn ${!isSidebarOpen ? 'ceova-tooltip-container' : ''}`} 
                    onClick={() => handleAction(onOpenSearch)}
                    title={isSidebarOpen ? undefined : "Search"}
                >
                    <div className="sidebar-nav-icon-box">
                        <Search size={17} strokeWidth={2} />
                    </div>
                    {isSidebarOpen && (
                        <>
                            <span className="sidebar-nav-label">Search</span>
                            <span className="sidebar-kbd-hint">⌘K</span>
                        </>
                    )}
                    {!isSidebarOpen && <div className="ceova-tooltip">Search (⌘K)</div>}
                </button>

                <button 
                    type="button"
                    className={`sidebar-nav-btn ${!isSidebarOpen ? 'ceova-tooltip-container' : ''}`} 
                    onClick={() => handleAction(onOpenLibrary)}
                    title={isSidebarOpen ? undefined : "Library"}
                >
                    <div className="sidebar-nav-icon-box">
                        <BookOpen size={17} strokeWidth={2} />
                    </div>
                    {isSidebarOpen && (
                        <span className="sidebar-nav-label">Library</span>
                    )}
                    {!isSidebarOpen && <div className="ceova-tooltip">Library</div>}
                </button>
            </div>

            {/* Chat History Section */}
            {isSidebarOpen && (
                <div className="chats-section">
                    {pinnedChatIds.length > 0 && (
                        <div className="chat-group">
                            <div className="section-title">
                                <span>Pinned</span>
                            </div>
                            <div className="chat-list">
                                {pinnedChatIds.map(chatId => renderChatItem(chatId, true))}
                            </div>
                        </div>
                    )}

                    <div className="chat-group">
                        <div className="section-title">
                            <span>Recents</span>
                            <span className="section-count-badge">{recentChatIds.length}</span>
                        </div>
                        <div className="chat-list">
                            {recentChatIds.map(chatId => renderChatItem(chatId, false))}
                        </div>
                    </div>

                    {pinnedChatIds.length === 0 && recentChatIds.length === 0 && (
                        <div className="chat-empty-state">
                            <span className="chat-empty-text">No conversations yet</span>
                        </div>
                    )}
                </div>
            )}

            {/* Spacer when collapsed */}
            {!isSidebarOpen && <div style={{ flex: 1 }} />}

            {/* Bottom Footer Section */}
            <div className="sidebar-bottom">
                <button 
                    type="button"
                    className={`sidebar-nav-btn ${!isSidebarOpen ? 'ceova-tooltip-container' : ''}`} 
                    onClick={() => handleAction(onToggleSettings)} 
                    title={isSidebarOpen ? undefined : "Settings"} 
                >
                    <div className="sidebar-nav-icon-box">
                        <Settings size={18} strokeWidth={1.9} />
                    </div>
                    {isSidebarOpen && (
                        <span className="sidebar-nav-label">Settings</span>
                    )}
                    {!isSidebarOpen && <div className="ceova-tooltip">Settings</div>}
                </button>

                {userEmail && (
                    <div className={`sidebar-user-card ${!isSidebarOpen ? 'collapsed ceova-tooltip-container' : ''}`}>
                        {isSidebarOpen ? (
                            <>
                                <div className="sidebar-user-avatar-wrap">
                                    {userMetadata?.avatar_url ? (
                                        <img src={userMetadata.avatar_url} alt={userName} className="sidebar-user-avatar" />
                                    ) : (
                                        <div className="sidebar-user-avatar fallback">
                                            {userName.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className="sidebar-user-info">
                                    <span className="sidebar-user-name" title={userName}>{userName}</span>
                                    <span className="sidebar-user-email" title={userEmail}>{userEmail}</span>
                                </div>
                                <button 
                                    type="button"
                                    className="sidebar-logout-btn" 
                                    onClick={onLogout}
                                    title="Log out"
                                >
                                    <LogOut size={15} />
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="sidebar-user-avatar-wrap" onClick={onToggleSettings}>
                                    {userMetadata?.avatar_url ? (
                                        <img src={userMetadata.avatar_url} alt={userName} className="sidebar-user-avatar" />
                                    ) : (
                                        <div className="sidebar-user-avatar fallback">
                                            {userName.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className="ceova-tooltip">{userName}</div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </aside>
    );
}
