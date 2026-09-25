import React, { useRef, useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, Smile, Square, Plus, X, Maximize2, Minimize2, AudioLines, Link, Zap, ChevronLeft, Scissors, Eye, Calendar as CalendarIcon, HardDrive, RefreshCw, Edit2, Scan, Globe, FileText, Key, Palette, Calculator, Receipt, Film, LayoutGrid, Folder, Paperclip, Brain, BookOpen, Cloud, Mail, MoreVertical, Sparkles, Search, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthProvider';
import { cacheManager } from '../services/CacheManager';
import { 
    fetchUserLibraryItems,
    isAiItem,
    isGdriveItem,
    isGmailItem,
    isCalendarItem,
    isCeovaItem
} from '../services/libraryFetchEngine';
import { useDriveThumbnail } from '../services/driveThumbnailCache';
import ExtensionsModal from './ExtensionsModal';
import './LibraryPickerModal.css';

const COMMON_EMOJIS = [
    "😊", "😂", "🥰", "😎", "🤔", "😅", "🔥", "✨", 
    "🚀", "👍", "🙌", "💡", "🤖", "✅", "❌", "👋",
    "🎉", "❤️", "⭐", "🌈", "⚡", "🎯", "📝", "🌍"
];

const fmtDate = (d) => {
    if (!d) return '';
    try {
        const date = new Date(d);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
};

const fmtSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return '';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
};

function PickerImageCard({ item, onClick }) {
    const { src, loading, error } = useDriveThumbnail(item);
    const [imgErr, setImgErr] = useState(false);

    const hasFailed = error || imgErr;

    return (
        <div 
            className="lib-picker-img-card" 
            onClick={() => onClick(item)}
            title={`Click to attach ${item.name}`}
        >
            <div className="lib-picker-img-wrap">
                {src && !hasFailed ? (
                    <img
                        src={src}
                        alt={item.name}
                        className="lib-picker-img"
                        loading="lazy"
                        onError={() => setImgErr(true)}
                    />
                ) : loading ? (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)' }}>
                        <div className="lib-skeleton-shimmer" style={{ width: '100%', height: '100%' }} />
                    </div>
                ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a' }}>
                        <ImageIcon size={28} />
                    </div>
                )}
                <div className="lib-picker-img-overlay">
                    <span className="lib-picker-attach-pill">+ Attach</span>
                </div>
            </div>
            <div className="lib-picker-img-meta">
                <span className="lib-picker-item-name">{item.name}</span>
                <span className="lib-picker-item-sub">
                    {item.size ? fmtSize(item.size) + ' • ' : ''}
                    {item.created_at ? fmtDate(item.created_at) : 'Image'}
                </span>
            </div>
        </div>
    );
}

function PickerRowCard({ item, onClick }) {
    const isMail = isGmailItem(item);
    const isCal = isCalendarItem(item);
    const isImg = item.kind === 'image' || item.mime_type?.startsWith('image/');
    const isAi = isAiItem(item);

    let Icon = FileText;
    let label = 'File';
    if (isMail) {
        Icon = Mail;
        label = 'Gmail';
    } else if (isCal) {
        Icon = CalendarIcon;
        label = 'Calendar';
    } else if (isImg) {
        Icon = ImageIcon;
        label = 'Image';
    } else if (isAi) {
        Icon = Sparkles;
        label = 'AI';
    } else if (item.mime_type?.includes('pdf') || item.name?.endsWith('.pdf')) {
        label = 'PDF';
    } else if (item.mime_type?.includes('sheet') || item.name?.endsWith('.csv') || item.name?.endsWith('.xlsx')) {
        label = 'Sheet';
    } else if (item.mime_type?.includes('presentation') || item.name?.endsWith('.pptx')) {
        label = 'Slides';
    } else if (item.mime_type?.includes('word') || item.name?.endsWith('.docx')) {
        label = 'Doc';
    }

    return (
        <div 
            className="lib-picker-row-card" 
            onClick={() => onClick(item)}
            title={`Click to attach ${item.name}`}
        >
            <div className="lib-picker-row-icon-box">
                <Icon size={16} />
            </div>
            <div className="lib-picker-row-info">
                <span className="lib-picker-row-name">{item.name}</span>
                {item.snippet && (
                    <p className="lib-picker-row-snippet">{item.snippet}</p>
                )}
                <div className="lib-picker-row-meta">
                    <span className="lib-picker-badge-label">{label}</span>
                    {item.size ? <span>{fmtSize(item.size)}</span> : null}
                    {item.from_sender && <span>From: {item.from_sender.split('<')[0].trim()}</span>}
                    {item.location && <span>📍 {item.location}</span>}
                    {item.start_time ? (
                        <span>📅 {fmtDate(item.start_time)}</span>
                    ) : item.created_at ? (
                        <span>{fmtDate(item.created_at)}</span>
                    ) : null}
                </div>
            </div>
            <span className="lib-picker-row-action">+ Attach</span>
        </div>
    );
}

export default function InputBox({ 
    input, setInput, handleSend, isLoading, handleStop, isHome,
    localDirectoryHandle, setLocalDirectoryHandle, onOpenLibrary,
    session: sessionProp
}) {
    const { session: authSession, user: authUser } = useAuth() || {};
    const effectiveSession = sessionProp || authSession;

    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const [isEmojiOpen, setIsEmojiOpen] = useState(false);
    const [isPlusOpen, setIsPlusOpen] = useState(false);
    const [isToolsSubmenuOpen, setIsToolsSubmenuOpen] = useState(false);
    const [isConnectorsSubmenuOpen, setIsConnectorsSubmenuOpen] = useState(false);
    const [isExtensionsModalOpen, setIsExtensionsModalOpen] = useState(false);
    const [extensionsModalTab, setExtensionsModalTab] = useState('tools');
    const [isEditingConnectors, setIsEditingConnectors] = useState(false);
    const [isWebSearchActive, setIsWebSearchActive] = useState(false);
    const [files, setFiles] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [isGmailConnected, setIsGmailConnected] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [isLibraryPickerOpen, setIsLibraryPickerOpen] = useState(false);
    const [libraryTab, setLibraryTab] = useState('ceova');
    const [libraryItems, setLibraryItems] = useState([]);
    const [libraryLoading, setLibraryLoading] = useState(false);
    const [librarySearch, setLibrarySearch] = useState('');
    const recognitionRef = useRef(null);

    // Preload library items from cache on mount for instant zero-latency opening
    useEffect(() => {
        cacheManager.getLibraryItems().then(cached => {
            if (cached && cached.length > 0) {
                setLibraryItems(cached);
            }
        }).catch(() => {});
    }, []);

    const inputBoxPositionerRef = useRef(null);

    useEffect(() => {
        if (!isPlusOpen) return;
        const handleClickOutside = (e) => {
            if (inputBoxPositionerRef.current && !inputBoxPositionerRef.current.contains(e.target)) {
                setIsPlusOpen(false);
                setIsConnectorsSubmenuOpen(false);
                setIsToolsSubmenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isPlusOpen]);

    useEffect(() => {
        const checkGmailConnection = async () => {
            const uid = effectiveSession?.user?.id || authUser?.id;
            if (uid) {
                const { data } = await supabase
                    .from('user_google_tokens')
                    .select('*')
                    .eq('user_id', uid)
                    .single();
                if (data) setIsGmailConnected(true);
            }
        };
        checkGmailConnection();
    }, [effectiveSession?.user?.id, authUser?.id]);

    // Close on escape key
    useEffect(() => {
        if (!isLibraryPickerOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsLibraryPickerOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLibraryPickerOpen]);

    // Fetch library items using unified engine
    const openLibraryPicker = async () => {
        setIsLibraryPickerOpen(true);
        setLibrarySearch('');

        // Step 1: Immediate cache retrieval for instant UI
        try {
            const cached = await cacheManager.getLibraryItems();
            if (cached && cached.length > 0) {
                setLibraryItems(cached);
                setLibraryLoading(false);
            } else {
                setLibraryLoading(true);
            }
        } catch (e) {
            setLibraryLoading(true);
        }

        // Step 2: Resolve user ID with multiple fallbacks
        let userId = effectiveSession?.user?.id || authUser?.id;
        if (!userId) {
            try {
                const { data: sessData } = await supabase.auth.getSession();
                userId = sessData?.session?.user?.id;
            } catch (e) {}
        }
        if (!userId) {
            try {
                const { data: uData } = await supabase.auth.getUser();
                userId = uData?.user?.id;
            } catch (e) {}
        }
        if (!userId) {
            try {
                const localAuth = JSON.parse(localStorage.getItem('ceova-auth-token') || '{}');
                userId = localAuth?.user?.id;
            } catch (e) {}
        }

        if (!userId) {
            setLibraryLoading(false);
            return;
        }

        // Step 3: Fetch latest library items and sync cache
        try {
            const fresh = await fetchUserLibraryItems(userId);
            if (fresh && fresh.length > 0) {
                setLibraryItems(fresh);
            }
        } catch (err) {
            console.error('[LibraryPicker] Load error:', err);
        } finally {
            setLibraryLoading(false);
        }
    };

    // Calculate tab counts matching Library.jsx exactly
    const libraryCounts = useMemo(() => {
        const counts = { ceova: 0, gdrive: 0, gmail: 0, gcalendar: 0, ai: 0, total: libraryItems.length };
        libraryItems.forEach(it => {
            if (isAiItem(it)) counts.ai++;
            else if (isGdriveItem(it)) counts.gdrive++;
            else if (isGmailItem(it)) counts.gmail++;
            else if (isCalendarItem(it)) counts.gcalendar++;
            else counts.ceova++;
        });
        return counts;
    }, [libraryItems]);

    const libraryTabs = useMemo(() => [
        { id: 'ceova', label: 'CEOVA Drive', count: libraryCounts.ceova },
        { id: 'gdrive', label: 'Google Drive', count: libraryCounts.gdrive },
        { id: 'gmail', label: 'Google Mail', count: libraryCounts.gmail },
        { id: 'gcalendar', label: 'Google Calendar', count: libraryCounts.gcalendar },
        { id: 'ai', label: 'AI Generated', count: libraryCounts.ai },
    ], [libraryCounts]);

    // Filter items based on active tab and search matching Library.jsx
    const filteredLibraryItems = useMemo(() => {
        return libraryItems.filter(it => {
            if (libraryTab === 'ceova' && !isCeovaItem(it)) return false;
            if (libraryTab === 'gdrive' && !isGdriveItem(it)) return false;
            if (libraryTab === 'gmail' && !isGmailItem(it)) return false;
            if (libraryTab === 'gcalendar' && !isCalendarItem(it)) return false;
            if (libraryTab === 'ai' && !isAiItem(it)) return false;

            if (librarySearch.trim()) {
                const q = librarySearch.toLowerCase();
                const matchName = it.name?.toLowerCase().includes(q);
                const matchSnippet = it.snippet?.toLowerCase().includes(q);
                const matchSender = it.from_sender?.toLowerCase().includes(q);
                const matchLoc = it.location?.toLowerCase().includes(q);
                if (!matchName && !matchSnippet && !matchSender && !matchLoc) return false;
            }
            return true;
        });
    }, [libraryItems, libraryTab, librarySearch]);

    const attachLibraryItem = (item) => {
        const isImg = item.kind === 'image' || item.mime_type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(item.name || '');
        const isEmail = item.source === 'gmail' || item.category === 'mail' || item.mime_type === 'message/rfc822' || !!item.from_sender;
        const driveId = item.drive_id || (item.id && !String(item.id).includes('-') ? item.id : null);
        const resolvedUrl = item.url || item.web_view_link || item.thumbnail_url || (driveId ? `https://drive.google.com/file/d/${driveId}/view` : '');
        const isPdf = item.mime_type === 'application/pdf' || (item.name && item.name.toLowerCase().endsWith('.pdf'));
        const pseudoFile = {
            name: item.name || (isEmail ? 'Attached Email' : 'Library File'),
            type: item.mime_type || (isImg ? 'image/jpeg' : (isEmail ? 'message/rfc822' : (isPdf ? 'application/pdf' : 'application/octet-stream'))),
            url: resolvedUrl,
            thumbnail_url: item.thumbnail_url || resolvedUrl,
            source: item.source || (driveId ? 'gdrive' : (isEmail ? 'gmail' : undefined)),
            drive_id: driveId,
            web_view_link: item.web_view_link,
            web_download_link: item.web_download_link,
            snippet: item.snippet,
            from_sender: item.from_sender,
            thread_id: item.thread_id,
            gmail_id: item.gmail_id,
            content: item.content || item.body || item.snippet || item.ocr_text || null,
            isLibraryItem: true,
            size: item.size || 0,
        };
        setFiles(prev => [...prev, pseudoFile]);
        setIsLibraryPickerOpen(false);
    };

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = Math.min(scrollHeight, 120) + 'px';
            textareaRef.current.style.overflowY = scrollHeight > 120 ? 'auto' : 'hidden';
        }
    }, [input]);

    const handleInputChange = (e) => {
        const val = e.target.value;
        setInput(val);
        if (val.endsWith('/')) {
            setIsPlusOpen(true);
            setIsToolsSubmenuOpen(true);
        } else if (!val.includes('/')) {
            setIsToolsSubmenuOpen(false);
            if (isPlusOpen && !isConnectorsSubmenuOpen && !isEmojiOpen) {
                setIsPlusOpen(false);
            }
        }
    };

    const onEnterPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSendClick();
        }
    };

    const onSendClick = () => {
        if (!input.trim() && files.length === 0) return;
        setIsPlusOpen(false);
        setIsToolsSubmenuOpen(false);
        setIsConnectorsSubmenuOpen(false);
        setIsEmojiOpen(false);
        handleSend(files, null, false, isThinking);
        // Revoke preview URLs before clearing
        files.forEach(f => {
            if (f.url && f.url.startsWith('blob:')) URL.revokeObjectURL(f.url);
        });
        setFiles([]);
    };

    const insertEmoji = (emoji) => {
        setInput(prev => prev + emoji);
        setIsEmojiOpen(false);
        textareaRef.current?.focus();
    };

    const onFilesSelected = (selected) => {
        const newFiles = selected.map(file => {
            const url = URL.createObjectURL(file);
            return Object.assign(file, { url });
        });
        setFiles(prev => [...prev, ...newFiles]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeFile = (e, index) => {
        e.stopPropagation();
        setFiles(prev => {
            const fileToRemove = prev[index];
            if (fileToRemove?.url && fileToRemove.url.startsWith('blob:')) {
                URL.revokeObjectURL(fileToRemove.url);
            }
            return prev.filter((_, i) => i !== index);
        });
    };

    // Voice recognition
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const r = new SpeechRecognition();
            r.continuous = true;
            r.interimResults = true;
            r.onresult = (e) => {
                let interimTranscript = '';
                let finalTranscript = '';
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    const transcript = e.results[i][0].transcript;
                    if (e.results[i].isFinal) finalTranscript += transcript + ' ';
                    else interimTranscript += transcript;
                }
                if (finalTranscript) setInput(prev => prev + finalTranscript);
            };
            r.onend = () => setIsListening(false);
            recognitionRef.current = r;
        }
        return () => {
            if (recognitionRef.current) recognitionRef.current.abort();
        };
    }, []);

    useEffect(() => {
        // Cleanup remaining files on unmount
        return () => {
            files.forEach(f => {
                if (f.url && f.url.startsWith('blob:')) URL.revokeObjectURL(f.url);
            });
        };
    }, [files]);

    const startListening = () => {
        if (!recognitionRef.current) return alert("Speech recognition not supported");
        setIsListening(true);
        recognitionRef.current.start();
    };
    const stopListening = () => {
        if (recognitionRef.current) recognitionRef.current.stop();
        setIsListening(false);
    };

    const [isDragging, setIsDragging] = useState(false);

    const handleConnectFolder = async () => {
        try {
            setIsPlusOpen(false);
            if (window.__TAURI__) {
                const { open } = await import('@tauri-apps/plugin-dialog');
                const selected = await open({ directory: true, multiple: false });
                if (selected) setLocalDirectoryHandle(selected);
            } else {
                const dirHandle = await window.showDirectoryPicker();
                setLocalDirectoryHandle(dirHandle);
            }
        } catch (err) {
            console.error("Folder selection cancelled or failed", err);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFilesSelected(Array.from(e.dataTransfer.files));
            e.dataTransfer.clearData();
        }
    };


    return (
        <motion.div 
            className={`input-container ${isHome ? 'is-home' : 'is-chat'}`}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
        >
            <div className="input-box-positioner" ref={inputBoxPositionerRef}>
                <AnimatePresence>
                    {isPlusOpen && (
                        <motion.div 
                            className={`attachment-sliding-tab ${isHome ? 'slide-down' : 'slide-up'}`}
                            initial={isHome 
                                ? { y: -50, opacity: 0, scale: 0.98 } 
                                : { y: 50, opacity: 0, scale: 0.98 }
                            }
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={isHome 
                                ? { y: -50, opacity: 0, scale: 0.98 } 
                                : { y: 50, opacity: 0, scale: 0.98 }
                            }
                            transition={{ type: "spring", stiffness: 360, damping: 28 }}
                        >
                            {!isToolsSubmenuOpen && !isConnectorsSubmenuOpen && (
                                <div className="sliding-tab-grid">
                                    <button 
                                        type="button"
                                        className="sliding-tab-card"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsConnectorsSubmenuOpen(true);
                                        }}
                                    >
                                        <div className="sliding-tab-card-icon">
                                            <Link size={18} />
                                        </div>
                                        <div className="sliding-tab-card-content">
                                            <span className="sliding-tab-card-title">Connectors</span>
                                            <span className="sliding-tab-card-desc">Gmail, Drive & apps</span>
                                        </div>
                                    </button>

                                    <button 
                                        type="button"
                                        className="sliding-tab-card"
                                        onClick={() => { 
                                            setIsPlusOpen(false); 
                                            fileInputRef.current?.click(); 
                                        }}
                                    >
                                        <div className="sliding-tab-card-icon">
                                            <Plus size={18} />
                                        </div>
                                        <div className="sliding-tab-card-content">
                                            <span className="sliding-tab-card-title">Upload files</span>
                                            <span className="sliding-tab-card-desc">Images, docs & PDFs</span>
                                        </div>
                                    </button>

                                    <button 
                                        type="button"
                                        className="sliding-tab-card"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsPlusOpen(false);
                                            openLibraryPicker();
                                        }}
                                    >
                                        <div className="sliding-tab-card-icon">
                                            <BookOpen size={18} />
                                        </div>
                                        <div className="sliding-tab-card-content">
                                            <span className="sliding-tab-card-title">Select from Library</span>
                                            <span className="sliding-tab-card-desc">History & saved files</span>
                                        </div>
                                    </button>
                                </div>
                            )}

                            {isConnectorsSubmenuOpen && (
                                <div className="sliding-tab-submenu">
                                    <div className="sliding-tab-submenu-header">
                                        <button 
                                            type="button"
                                            className="sliding-tab-back-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsConnectorsSubmenuOpen(false);
                                            }}
                                        >
                                            <ChevronLeft size={16} /> Back
                                        </button>
                                        <span className="sliding-tab-submenu-title">Connectors</span>
                                        {isGmailConnected && (
                                            <button 
                                                type="button"
                                                className="sliding-tab-edit-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsEditingConnectors(!isEditingConnectors);
                                                }}
                                                title="Edit Connectors"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="sliding-tab-grid">
                                        <button
                                            type="button"
                                            className="sliding-tab-card"
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                setIsPlusOpen(false);
                                                setIsConnectorsSubmenuOpen(false);
                                                try {
                                                    localStorage.setItem('oauth_provider', 'google');
                                                    const { error } = await supabase.auth.signInWithOAuth({
                                                        provider: 'google',
                                                        options: {
                                                            redirectTo: `${window.location.origin}/auth/callback`,
                                                            scopes: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive',
                                                            queryParams: {
                                                                access_type: 'offline',
                                                                prompt: 'consent'
                                                            }
                                                        }
                                                    });
                                                    if (error) throw error;
                                                } catch (err) {
                                                    console.error("Failed to connect Gmail:", err);
                                                    alert("Failed to connect Gmail: " + err.message);
                                                }
                                            }}
                                        >
                                            <div className="sliding-tab-card-icon">
                                                <img src="/gmail.png" alt="Gmail" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                                            </div>
                                            <div className="sliding-tab-card-content">
                                                <span className="sliding-tab-card-title">{isGmailConnected ? "Gmail" : "Connect Gmail"}</span>
                                                <span className="sliding-tab-card-desc">{isGmailConnected ? "Connected" : "Google Mail"}</span>
                                            </div>
                                            {isGmailConnected && isEditingConnectors && (
                                                <div 
                                                    className="sliding-tab-disconnect"
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm("Are you sure you want to disconnect all Google tools?")) {
                                                            const { data: { user } } = await supabase.auth.getUser();
                                                            if (user) {
                                                                await supabase.from('user_google_tokens').delete().eq('user_id', user.id);
                                                                setIsGmailConnected(false);
                                                                setIsEditingConnectors(false);
                                                            }
                                                        }
                                                    }}
                                                >
                                                    Disconnect
                                                </div>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            className="sliding-tab-card"
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                setIsPlusOpen(false);
                                                setIsConnectorsSubmenuOpen(false);
                                                try {
                                                    localStorage.setItem('oauth_provider', 'google');
                                                    const { error } = await supabase.auth.signInWithOAuth({
                                                        provider: 'google',
                                                        options: {
                                                            redirectTo: `${window.location.origin}/auth/callback`,
                                                            scopes: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive',
                                                            queryParams: {
                                                                access_type: 'offline',
                                                                prompt: 'consent'
                                                            }
                                                        }
                                                    });
                                                    if (error) throw error;
                                                } catch (err) {
                                                    console.error("Failed to connect Drive:", err);
                                                    alert("Failed to connect Drive: " + err.message);
                                                }
                                            }}
                                        >
                                            <div className="sliding-tab-card-icon">
                                                <img src="/drive.png" alt="Google Drive" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                                            </div>
                                            <div className="sliding-tab-card-content">
                                                <span className="sliding-tab-card-title">{isGmailConnected ? "Google Drive" : "Connect Drive"}</span>
                                                <span className="sliding-tab-card-desc">{isGmailConnected ? "Connected" : "Google Cloud"}</span>
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            className="sliding-tab-card"
                                            onClick={() => {
                                                setIsPlusOpen(false);
                                                setIsConnectorsSubmenuOpen(false);
                                                setExtensionsModalTab('connectors');
                                                setIsExtensionsModalOpen(true);
                                            }}
                                        >
                                            <div className="sliding-tab-card-icon">
                                                <LayoutGrid size={18} />
                                            </div>
                                            <div className="sliding-tab-card-content">
                                                <span className="sliding-tab-card-title">More Connectors</span>
                                                <span className="sliding-tab-card-desc">Integrations library</span>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {isToolsSubmenuOpen && (
                                <div className="sliding-tab-submenu">
                                    <div className="sliding-tab-submenu-header">
                                        <span className="sliding-tab-submenu-title">Quick Actions</span>
                                    </div>
                                    <div className="sliding-tab-tools-grid">
                                        <button
                                            type="button"
                                            className="sliding-tab-card"
                                            onClick={() => {
                                                setIsPlusOpen(false);
                                                setIsToolsSubmenuOpen(false);
                                                setInput(prev => prev + (prev.trim() ? " " : "") + "/generate_image ");
                                                textareaRef.current?.focus();
                                            }}
                                        >
                                            <div className="sliding-tab-card-icon"><Sparkles size={16} /></div>
                                            <div className="sliding-tab-card-content">
                                                <span className="sliding-tab-card-title">Generate Image</span>
                                                <span className="sliding-tab-card-desc">AI image tool</span>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            className="sliding-tab-card"
                                            onClick={() => {
                                                setIsPlusOpen(false);
                                                setIsToolsSubmenuOpen(false);
                                                setInput(prev => prev + (prev.trim() ? " " : "") + "/background_remover ");
                                                textareaRef.current?.focus();
                                            }}
                                        >
                                            <div className="sliding-tab-card-icon"><Scissors size={16} /></div>
                                            <div className="sliding-tab-card-content">
                                                <span className="sliding-tab-card-title">Remove Background</span>
                                                <span className="sliding-tab-card-desc">Cutout tool</span>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            className="sliding-tab-card"
                                            onClick={() => {
                                                setIsPlusOpen(false);
                                                setIsToolsSubmenuOpen(false);
                                                setInput(prev => prev + (prev.trim() ? " " : "") + "/qr_barcode ");
                                                textareaRef.current?.focus();
                                            }}
                                        >
                                            <div className="sliding-tab-card-icon"><Scan size={16} /></div>
                                            <div className="sliding-tab-card-content">
                                                <span className="sliding-tab-card-title">QR & Barcode</span>
                                                <span className="sliding-tab-card-desc">Generator & scanner</span>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            className="sliding-tab-card"
                                            onClick={() => {
                                                setIsPlusOpen(false);
                                                setIsToolsSubmenuOpen(false);
                                                setInput(prev => prev + (prev.trim() ? " " : "") + "/invoice_generator ");
                                                textareaRef.current?.focus();
                                            }}
                                        >
                                            <div className="sliding-tab-card-icon"><Receipt size={16} /></div>
                                            <div className="sliding-tab-card-content">
                                                <span className="sliding-tab-card-title">Invoice Generator</span>
                                                <span className="sliding-tab-card-desc">Billing tool</span>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            className="sliding-tab-card"
                                            onClick={() => {
                                                setIsPlusOpen(false);
                                                setIsToolsSubmenuOpen(false);
                                                setExtensionsModalTab('tools');
                                                setIsExtensionsModalOpen(true);
                                            }}
                                        >
                                            <div className="sliding-tab-card-icon"><LayoutGrid size={16} /></div>
                                            <div className="sliding-tab-card-content">
                                                <span className="sliding-tab-card-title">More Tools...</span>
                                                <span className="sliding-tab-card-desc">Extensions directory</span>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div 
                    className={`input-wrapper ${isDragging ? 'dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {isEmojiOpen && (
                    <div className="emoji-picker-menu">
                        {COMMON_EMOJIS.map(emoji => (
                            <button key={emoji} onClick={() => insertEmoji(emoji)}>{emoji}</button>
                        ))}
                    </div>
                )}
                {files.length > 0 && (
                    <div className="file-preview-list">
                        {files.map((file, idx) => (
                            <div key={idx} className="file-preview-item">
                                <div className="preview-media-box">
                                    {(file.type?.startsWith('image/') || file.thumbnail_url) ? (
                                        <img src={file.thumbnail_url || file.url} alt="preview" className="preview-img" />
                                    ) : (
                                        <div className="file-icon-box">
                                            <span className="file-ext">{(file.name || 'FILE').split('.').pop().toUpperCase()}</span>
                                        </div>
                                    )}
                                </div>
                                <button className="remove-file-btn" onClick={(e) => removeFile(e, idx)} title="Remove file">
                                    <X size={12} />
                                </button>
                                <span className="file-name-tag">{file.name}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="input-main-row">
                    <div className="toolbar-left" style={{ gap: '8px' }}>
                        <button 
                            type="button"
                            className={`toolbar-btn ${isPlusOpen ? 'active' : ''}`} 
                            onClick={() => {
                                setIsPlusOpen(!isPlusOpen);
                                if (isPlusOpen) {
                                    setIsToolsSubmenuOpen(false);
                                    setIsConnectorsSubmenuOpen(false);
                                }
                            }} 
                            title="Add attachment"
                        >
                            <Plus size={18} />
                        </button>
                        
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            style={{ display: 'none' }} 
                            onChange={(e) => onFilesSelected(Array.from(e.target.files))}
                            accept="image/*,.pdf,.txt"
                            multiple
                        />
                    </div>

                    <textarea
                        id="userInput"
                        ref={textareaRef}
                        placeholder="Ask Ceova anything..."
                        rows={1}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={onEnterPress}
                    />

                    <div className="toolbar-right">
                        <button
                            type="button"
                            className={`think-mode-btn ${isThinking ? 'active' : ''}`}
                            onClick={() => setIsThinking(!isThinking)}
                            title={isThinking ? "Think mode enabled" : "Enable Think mode"}
                        >
                            <Brain size={17} strokeWidth={2} className="think-mode-icon" />
                            <span className="think-mode-label">Think</span>
                        </button>

                        {isLoading ? (
                            <button className="send-action-btn active stop-btn" onClick={handleStop} title="Stop generation">
                                <Square size={12} fill="currentColor" />
                            </button>
                        ) : (
                            <button 
                                className={`send-action-btn ${(input.trim() || files.length > 0) ? 'active' : ''}`} 
                                onClick={onSendClick}
                                disabled={!(input.trim() || files.length > 0)}
                            >
                                <ArrowUp size={18} strokeWidth={2.5} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
            
            <ExtensionsModal 
                isOpen={isExtensionsModalOpen} 
                onClose={() => setIsExtensionsModalOpen(false)} 
                initialTab={extensionsModalTab}
                onSelectTool={(command) => {
                    setInput(prev => prev + (prev.trim() ? " " : "") + command + " ");
                    textareaRef.current?.focus();
                }}
            />

            {/* ── High-End Glassmorphic Library Picker Modal ─────────────────────────── */}
            {isLibraryPickerOpen && typeof document !== 'undefined' && createPortal(
                <div
                    className="lib-picker-overlay"
                    onClick={() => setIsLibraryPickerOpen(false)}
                >
                    <div
                        className="lib-picker-modal"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="lib-picker-header">
                            <div className="lib-picker-icon-badge">
                                <BookOpen size={17} />
                            </div>
                            <div className="lib-picker-title-group">
                                <h3 className="lib-picker-title">Select from Library</h3>
                                <span className="lib-picker-total-badge">
                                    {libraryCounts.total} items
                                </span>
                            </div>
                            <button
                                className="lib-picker-close-btn"
                                onClick={() => setIsLibraryPickerOpen(false)}
                                title="Close (Esc)"
                            >
                                <X size={17} />
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="lib-picker-search-wrap">
                            <div className="lib-picker-search-inner">
                                <Search size={14} className="lib-picker-search-icon" />
                                <input
                                    autoFocus
                                    className="lib-picker-search-input"
                                    placeholder={`Search in ${libraryTabs.find(t => t.id === libraryTab)?.label || 'library'}...`}
                                    value={librarySearch}
                                    onChange={e => setLibrarySearch(e.target.value)}
                                />
                                {librarySearch && (
                                    <button 
                                        className="lib-picker-search-clear" 
                                        onClick={() => setLibrarySearch('')}
                                        title="Clear search"
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Minimalist Pill Tabs */}
                        <div className="lib-picker-tabs-bar">
                            {libraryTabs.map(tab => (
                                <button
                                    key={tab.id}
                                    className={`lib-picker-pill-tab ${libraryTab === tab.id ? 'active' : ''}`}
                                    onClick={() => setLibraryTab(tab.id)}
                                >
                                    <span>{tab.label}</span>
                                    <span className="lib-picker-tab-count">{tab.count}</span>
                                </button>
                            ))}
                        </div>

                        {/* Items Viewport */}
                        <div className="lib-picker-viewport">
                            {libraryLoading ? (
                                <div className="lib-picker-loading">
                                    <div className="lib-picker-spinner" />
                                    <span>Loading library items...</span>
                                </div>
                            ) : (() => {
                                if (filteredLibraryItems.length === 0) {
                                    const emptyInfo = {
                                        ceova: {
                                            title: "No CEOVA files found",
                                            desc: librarySearch ? "No files match your search query." : "Upload files or drop attachments in chat to store them in your CEOVA Drive."
                                        },
                                        gdrive: {
                                            title: "No Google Drive files",
                                            desc: librarySearch ? "No drive files match your search query." : "Connect Google in Connectors menu to access your files here."
                                        },
                                        gmail: {
                                            title: "No Gmail messages",
                                            desc: librarySearch ? "No emails match your search query." : "Connect your Google account to browse and attach email threads."
                                        },
                                        gcalendar: {
                                            title: "No calendar events",
                                            desc: librarySearch ? "No events match your search query." : "Sync Google Calendar to attach meetings and schedules."
                                        },
                                        ai: {
                                            title: "No AI generated files",
                                            desc: librarySearch ? "No AI files match your search query." : "Ask Ceova to generate images, charts or documents to see them here."
                                        }
                                    }[libraryTab] || { title: "No items found", desc: "No matching items found." };

                                    return (
                                        <div className="lib-picker-empty">
                                            <div className="lib-picker-empty-icon">
                                                {libraryTab === 'gcalendar' ? <CalendarIcon size={24} /> :
                                                 libraryTab === 'gmail' ? <Mail size={24} /> :
                                                 libraryTab === 'ai' ? <Sparkles size={24} /> :
                                                 libraryTab === 'gdrive' ? <Cloud size={24} /> :
                                                 <Folder size={24} />}
                                            </div>
                                            <h4 className="lib-picker-empty-title">{emptyInfo.title}</h4>
                                            <p className="lib-picker-empty-desc">{emptyInfo.desc}</p>
                                        </div>
                                    );
                                }

                                const images = filteredLibraryItems.filter(it => it.kind === 'image' || it.mime_type?.startsWith('image/'));
                                const others = filteredLibraryItems.filter(it => !(it.kind === 'image' || it.mime_type?.startsWith('image/')));

                                return (
                                    <>
                                        {images.length > 0 && (
                                            <div className="lib-picker-grid-images">
                                                {images.map(item => (
                                                    <PickerImageCard
                                                        key={item.id}
                                                        item={item}
                                                        onClick={attachLibraryItem}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                        {others.length > 0 && (
                                            <div className="lib-picker-grid-files">
                                                {others.map(item => (
                                                    <PickerRowCard
                                                        key={item.id}
                                                        item={item}
                                                        onClick={attachLibraryItem}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>

                        {/* Footer */}
                        <div className="lib-picker-footer">
                            <span className="lib-picker-footer-tip">
                                💡 Click any file to attach it to your message
                            </span>
                            <button
                                className="lib-picker-footer-close"
                                onClick={() => setIsLibraryPickerOpen(false)}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </motion.div>
    );
}
