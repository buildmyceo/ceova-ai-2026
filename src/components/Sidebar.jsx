import React, { useState, useEffect, useRef } from 'react';
import { 
    LogOut, Plus, Search, Settings, HelpCircle, Archive, X, Clock, Pin, PinOff, 
    SquareCheck, Glasses, Code2, PanelLeft, PanelLeftClose, Edit, BookOpen, 
    MoreHorizontal, Trash2, Check, MessageCircle, Image, Sparkles
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function Sidebar({ 
    chats, chatMetadata = {}, currentChatId, switchChat, createNewChat, createTemporaryChat, 
    onTaskClick, togglePinChat, deleteChat, renameChat, userEmail, userMetadata, onLogout, 
    temporaryChatId, onToggleSettings, onOpenSearch, onOpenLibrary, isSidebarOpen, setSidebarOpen 
}) {
    const userName = userMetadata?.full_name || (userEmail ? userEmail.split('@')[0] : "User");
    const { resolvedTheme } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [isLogoHovered, setIsLogoHovered] = useState(false);
    const [activeMenuChatId, setActiveMenuChatId] = useState(null);
    const [menuPlacement, setMenuPlacement] = useState('bottom');
    const [renamingChatId, setRenamingChatId] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const renameInputRef = useRef(null);
    const menuRef = useRef(null);
    const userMenuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (activeMenuChatId && !e.target.closest('.chat-item-menu-container')) {
                setActiveMenuChatId(null);
            }
            if (isUserMenuOpen && !e.target.closest('.dock-user-area')) {
                setIsUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [activeMenuChatId, isUserMenuOpen]);

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

    const logoSrc = '/ceova-logo.png';
    const isLightMode = resolvedTheme === 'light';

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

        return (
            <div 
                key={chatId} 
                className={`chat-item ${currentChatId === chatId ? 'active' : ''} ${isPinned ? 'pinned-item' : ''}`}
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
                            <MessageCircle size={17} strokeWidth={1.8} className={`chat-item-bubble-icon ${isPinned ? 'pinned' : ''}`} />
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
        <aside 
            id="sidebar" 
            className={`ceova-sidebar ${isLightMode ? 'theme-light' : 'theme-dark'} ${isSidebarOpen ? 'is-open' : 'is-collapsed'}`}
        >
            {/* 1. HEADER (BRAND TITLE + TOP SEARCH BUTTON) */}
            <div className="sidebar-header">
                {isSidebarOpen ? (
                    <div className="sidebar-header-open">
                        <div className="sidebar-brand-group">
                            <span className="brand-title">Ceova</span>
                        </div>
                        
                        <div className="sidebar-header-actions">
                            <button 
                                type="button"
                                className="header-icon-btn search-trigger-btn"
                                onClick={() => handleAction(onOpenSearch)}
                                title="Search chats"
                                aria-label="Search chats"
                            >
                                <Search size={20} />
                            </button>

                            <button 
                                type="button"
                                className="header-icon-btn close-sidebar-btn"
                                onClick={() => setSidebarOpen(false)} 
                                title="Close sidebar"
                                aria-label="Close sidebar"
                            >
                                <PanelLeft size={20} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div
                        className="ceova-tooltip-container collapsed-logo-btn"
                        onMouseEnter={() => setIsLogoHovered(true)}
                        onMouseLeave={() => setIsLogoHovered(false)}
                        onClick={() => setSidebarOpen(true)}
                    >
                        <div className="collapsed-hover-icon" style={{ opacity: 1 }}>
                            <PanelLeft size={22} />
                        </div>
                        <div className="ceova-tooltip">Open sidebar</div>
                    </div>
                )}
            </div>

            {/* 2. TOP NAVIGATION ITEMS */}
            {isSidebarOpen ? (
                <div className="sidebar-nav-group">
                    <button 
                        type="button"
                        className="nav-item-btn"
                        onClick={() => handleAction(onOpenLibrary)}
                    >
                        <Image size={18} className="nav-item-icon" />
                        <span>Images</span>
                    </button>

                    <button 
                        type="button"
                        className="nav-item-btn"
                        onClick={() => handleAction(onOpenLibrary)}
                    >
                        <BookOpen size={18} className="nav-item-icon" />
                        <span>Library</span>
                    </button>

                    <button 
                        type="button"
                        className="nav-item-btn"
                        onClick={() => handleAction(onTaskClick)}
                    >
                        <SquareCheck size={18} className="nav-item-icon" />
                        <span>Tasks & Projects</span>
                    </button>
                </div>
            ) : (
                /* Collapsed action rail for Desktop */
                <div className="collapsed-action-rail">
                    <button 
                        className={`icon-nav-btn ceova-tooltip-container ${currentChatId === temporaryChatId ? 'dimmed' : ''}`}
                        onClick={() => handleAction(createNewChat)}
                    >
                        <Edit size={20} />
                        <div className="ceova-tooltip">New chat</div>
                    </button>
                    <button 
                        className="icon-nav-btn ceova-tooltip-container"
                        onClick={() => handleAction(onOpenSearch)}
                    >
                        <Search size={20} />
                        <div className="ceova-tooltip">Search</div>
                    </button>
                    <button 
                        className="icon-nav-btn ceova-tooltip-container"
                        onClick={() => handleAction(onOpenLibrary)}
                    >
                        <BookOpen size={20} />
                        <div className="ceova-tooltip">Library</div>
                    </button>
                    <button 
                        className="icon-nav-btn ceova-tooltip-container"
                        onClick={() => handleAction(onTaskClick)}
                    >
                        <SquareCheck size={20} />
                        <div className="ceova-tooltip">Tasks</div>
                    </button>
                </div>
            )}

            {/* 3. CHATS SECTION (PINNED & RECENTS) */}
            {isSidebarOpen && (
                <div className="chats-section">
                    {pinnedChatIds.length > 0 && (
                        <div className="chat-group">
                            <div className="section-title">Pinned</div>
                            <div className="chat-list">
                                {pinnedChatIds.map(chatId => renderChatItem(chatId, true))}
                            </div>
                        </div>
                    )}

                    <div className="chat-group">
                        <div className="section-title">Recents</div>
                        <div className="chat-list">
                            {recentChatIds.length > 0 ? (
                                recentChatIds.map(chatId => renderChatItem(chatId, false))
                            ) : (
                                <div className="chat-empty-state">No recent chats</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {!isSidebarOpen && <div style={{ flexGrow: 1 }} />}

            {/* 4. BOTTOM FLOATING DOCK (CHATGPT-STYLE PILL + USER PROFILE) */}
            {isSidebarOpen ? (
                <div className="sidebar-bottom-dock">
                    <button 
                        type="button"
                        className="dock-chat-btn"
                        onClick={() => handleAction(createNewChat)}
                        title="New Chat"
                    >
                        <Edit size={16} strokeWidth={2.4} />
                        <span>Chat</span>
                    </button>

                    <div className="dock-user-area" ref={userMenuRef}>
                        <button 
                            type="button"
                            className="dock-settings-btn"
                            onClick={() => handleAction(onToggleSettings)}
                            title="Settings"
                        >
                            <Settings size={18} />
                        </button>

                        {userEmail && (
                            <button 
                                type="button"
                                className={`dock-avatar-btn ${isUserMenuOpen ? 'active' : ''}`}
                                onClick={() => setIsUserMenuOpen(prev => !prev)}
                                title={userName}
                                aria-label="Account details"
                            >
                                {userMetadata?.avatar_url ? (
                                    <img src={userMetadata.avatar_url} alt={userName} className="dock-avatar-img" />
                                ) : (
                                    <div className="dock-avatar-placeholder">
                                        {userName.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </button>
                        )}

                        {isUserMenuOpen && (
                            <div className="user-dropdown-popover">
                                <div className="user-dropdown-header">
                                    <div className="user-dropdown-name">{userName}</div>
                                    <div className="user-dropdown-email">{userEmail}</div>
                                </div>
                                <div className="user-dropdown-divider" />
                                <button 
                                    type="button"
                                    className="user-dropdown-item"
                                    onClick={() => {
                                        setIsUserMenuOpen(false);
                                        handleAction(onToggleSettings);
                                    }}
                                >
                                    <Settings size={15} />
                                    <span>Settings</span>
                                </button>
                                <button 
                                    type="button"
                                    className="user-dropdown-item danger"
                                    onClick={() => {
                                        setIsUserMenuOpen(false);
                                        onLogout?.();
                                    }}
                                >
                                    <LogOut size={15} />
                                    <span>Log out</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* Collapsed bottom icons for Desktop */
                <div className="collapsed-bottom-rail">
                    <button 
                        className="icon-nav-btn ceova-tooltip-container"
                        onClick={() => handleAction(onToggleSettings)} 
                    >
                        <Settings size={20} />
                        <div className="ceova-tooltip">Settings</div>
                    </button>
                    {userEmail && (
                        <div 
                            className="collapsed-avatar ceova-tooltip-container"
                            onClick={() => handleAction(onToggleSettings)}
                        >
                            {userMetadata?.avatar_url ? (
                                <img src={userMetadata.avatar_url} alt={userName} style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                            ) : (
                                <div style={{ width: '32px', height: '32px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--input-bg)', color: 'var(--text-main)', borderRadius: '50%', border: '1px solid var(--border-color)', fontWeight: 600 }}>
                                    {userName.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className="ceova-tooltip">{userName}</div>
                        </div>
                    )}
                </div>
            )}
        </aside>
    );
}
