import React, { useRef, useEffect, useState, useMemo } from 'react';
import { ArrowUp, Smile, Square, Plus, X, Maximize2, Minimize2, AudioLines, Link, Zap, ChevronLeft, ChevronRight, Scissors, Eye, Calendar as CalendarIcon, HardDrive, RefreshCw, Edit2, Scan, FileText, Key, Palette, Calculator, Receipt, Film, LayoutGrid, Folder, Paperclip, Brain, BookOpen, Cloud, Mail, MoreVertical, Sparkles, Search, Image as ImageIcon, Wrench, Video } from 'lucide-react';
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
import GoogleConnectModal from './GoogleConnectModal';
import TelegramConnectModal from './TelegramConnectModal';
import CctvDashboardOverlay from './CctvDashboardOverlay';
import { openCctvApp } from '../utils/cctvLauncher';
import { cctvAgent } from '../services/cctvAgentService';
import { connectGoogleDrive } from '../services/gdriveSyncEngine';
import './LibraryPickerModal.css';

const ALL_TOOLS = [
    { title: "Generate Image", desc: "AI image generator", command: "/generate_image", icon: Sparkles },
    { title: "Background Remover", desc: "Cutout & remove BG", command: "/background_remover", icon: Scissors },
    { title: "QR & Barcode", desc: "Generator & scanner", command: "/qr_barcode", icon: Scan },
    { title: "Invoice Generator", desc: "Create PDF invoices", command: "/invoice_generator", icon: Receipt },
    { title: "Image Analysis", desc: "OCR & extract text", command: "/image_analysis", icon: Eye },
    { title: "PDF Toolkit", desc: "Merge, split & edit", command: "/pdf_toolkit", icon: FileText },
    { title: "Password & Hash", desc: "Secure passwords", command: "/password_hash", icon: Key },
    { title: "Color Toolkit", desc: "Palettes & extractor", command: "/color_toolkit", icon: Palette },
    { title: "Media Converter", desc: "Audio & video convert", command: "/media_converter", icon: Film },
    { title: "Reduce File Size", desc: "Compress media & files", command: "/file_size_reduction", icon: Minimize2 },
    { title: "File Converter", desc: "Convert file formats", command: "/file_converter", icon: RefreshCw },
];

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
    const imageInputRef = useRef(null);
    const docInputRef = useRef(null);
    const [isEmojiOpen, setIsEmojiOpen] = useState(false);
    const [isPlusOpen, setIsPlusOpen] = useState(false);
    const [isToolsSubmenuOpen, setIsToolsSubmenuOpen] = useState(false);
    const [isConnectorsSubmenuOpen, setIsConnectorsSubmenuOpen] = useState(false);
    const [isUploadSubmenuOpen, setIsUploadSubmenuOpen] = useState(false);
    const [isLibrarySubmenuOpen, setIsLibrarySubmenuOpen] = useState(false);
    const [isGoogleConnected, setIsGoogleConnected] = useState(false);
    const [isTelegramConnected, setIsTelegramConnected] = useState(false);
    const [isCctvConnected, setIsCctvConnected] = useState(false);
    const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
    const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
    const [isEditingConnectors, setIsEditingConnectors] = useState(false);
    const [isCctvDashboardOpen, setIsCctvDashboardOpen] = useState(false);
    const [files, setFiles] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [isGmailConnected, setIsGmailConnected] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
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
                setIsUploadSubmenuOpen(false);
                setIsLibrarySubmenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isPlusOpen]);

    const checkGoogleAndTelegramStatus = async () => {
        const uid = effectiveSession?.user?.id || authUser?.id;
        if (!uid) return;

        try {
            // 1. Check Google Status
            let hasGoogle = false;
            const cachedGoogleToken = typeof window !== 'undefined' ? localStorage.getItem('google_provider_token') : null;
            const isDisconnected = typeof window !== 'undefined' ? localStorage.getItem('google_disconnected') === 'true' : false;

            if (cachedGoogleToken && !isDisconnected) {
                hasGoogle = true;
            } else if (effectiveSession?.provider_token && !isDisconnected) {
                hasGoogle = true;
            } else {
                const { data: googleTokenData } = await supabase
                    .from('user_google_tokens')
                    .select('access_token')
                    .eq('user_id', uid)
                    .maybeSingle();
                if (googleTokenData?.access_token && !isDisconnected) {
                    hasGoogle = true;
                }
            }
            setIsGoogleConnected(hasGoogle);
            setIsGmailConnected(hasGoogle);

            // 2. Check Telegram Status
            const { data: tgData } = await supabase
                .from('user_telegram')
                .select('connected')
                .eq('user_id', uid)
                .eq('connected', true)
                .maybeSingle();

            setIsTelegramConnected(Boolean(tgData?.connected));
        } catch (err) {
            console.error('[InputBox] Error checking connection statuses:', err);
        }
    };

    const checkCctvStatus = async () => {
        try {
            // 1. Direct fast check via cctvAgent
            const ctx = await cctvAgent.getCctvContext();
            if (ctx && (ctx.connected || ctx.cameraCount > 0 || (Array.isArray(ctx.cameras) && ctx.cameras.length > 0))) {
                setIsCctvConnected(true);
                return;
            }

            // 2. Direct probe to local CCTV daemon
            const ctrl = new AbortController();
            const tid = setTimeout(() => ctrl.abort(), 800);
            const res = await fetch('http://127.0.0.1:3080/api/cctv/details', { signal: ctrl.signal }).catch(() => null);
            clearTimeout(tid);
            if (res && res.ok) {
                const data = await res.json().catch(() => null);
                if (data && (data.connected || data.cameraCount > 0 || (Array.isArray(data.cameras) && data.cameras.length > 0))) {
                    setIsCctvConnected(true);
                    return;
                }
            }

            // 3. Fallback to localStorage
            if (typeof window !== 'undefined') {
                const hasLocalCreds = !!localStorage.getItem('ceova_cctv_local_credentials');
                const isConnFlag = localStorage.getItem('ceova_cctv_connected') === 'true';
                if (hasLocalCreds || isConnFlag) {
                    setIsCctvConnected(true);
                    return;
                }
            }
            setIsCctvConnected(false);
        } catch (_err) {
            if (typeof window !== 'undefined' && (localStorage.getItem('ceova_cctv_local_credentials') || localStorage.getItem('ceova_cctv_connected') === 'true')) {
                setIsCctvConnected(true);
            } else {
                setIsCctvConnected(false);
            }
        }
    };

    useEffect(() => {
        checkGoogleAndTelegramStatus();
        checkCctvStatus();
    }, [effectiveSession?.user?.id, authUser?.id]);

    useEffect(() => {
        if (isConnectorsSubmenuOpen) {
            checkGoogleAndTelegramStatus();
            checkCctvStatus();
        }
    }, [isConnectorsSubmenuOpen]);

    useEffect(() => {
        checkCctvStatus();
        const interval = setInterval(checkCctvStatus, 6000);
        const onFocus = () => checkCctvStatus();
        const handleCctvMessage = (e) => {
            if (e.data?.type === 'CEOVA_CCTV_CONNECTED' || e.data?.type === 'CCTV_CREDENTIALS_SAVED') {
                setIsCctvConnected(true);
            } else if (e.data?.type === 'CEOVA_CCTV_CLEARED' || e.data?.type === 'CEOVA_CCTV_DISCONNECTED') {
                setIsCctvConnected(false);
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('ceova_cctv_local_credentials');
                    localStorage.removeItem('ceova_cctv_connected');
                }
            }
        };
        window.addEventListener('focus', onFocus);
        window.addEventListener('message', handleCctvMessage);
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('message', handleCctvMessage);
        };
    }, []);

    const handleGoogleConnect = async () => {
        try {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('google_disconnected');
            }
            await connectGoogleDrive();
        } catch (err) {
            console.error("Failed to connect Google account:", err);
            alert("Could not start Google sign in: " + err.message);
        }
    };

    const handleGoogleDisconnect = async (e) => {
        if (e) e.stopPropagation();
        if (!window.confirm("Are you sure you want to disconnect Google Services? This will remove synced files, emails, and events.")) return;
        try {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('google_provider_token');
                localStorage.setItem('google_disconnected', 'true');
            }
            const uid = effectiveSession?.user?.id || authUser?.id;
            if (uid) {
                await supabase.from('user_google_tokens').delete().eq('user_id', uid);
                await supabase.from('gmail_emails').delete().eq('user_id', uid);
                await supabase.from('calendar_events').delete().eq('user_id', uid);
                await supabase.from('files').delete().eq('user_id', uid).eq('storage_source', 'gdrive');
            }
            setIsGoogleConnected(false);
            setIsGmailConnected(false);
            setIsEditingConnectors(false);
        } catch (err) {
            console.error("Failed to disconnect Google:", err);
            alert("Failed to disconnect Google: " + err.message);
        }
    };

    const handleTelegramDisconnect = async (e) => {
        if (e) e.stopPropagation();
        if (!window.confirm("Are you sure you want to disconnect Telegram from CEOVA?")) return;
        try {
            const uid = effectiveSession?.user?.id || authUser?.id;
            if (uid) {
                await supabase.from('user_telegram').delete().eq('user_id', uid);
            }
            setIsTelegramConnected(false);
            setIsEditingConnectors(false);
        } catch (err) {
            console.error("Failed to disconnect Telegram:", err);
            alert("Failed to disconnect Telegram: " + err.message);
        }
    };

    const handleCctvDisconnect = async (e) => {
        if (e) e.stopPropagation();
        if (!window.confirm("Are you sure you want to disconnect CCTV?")) return;
        try {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('ceova_cctv_local_credentials');
                localStorage.removeItem('ceova_cctv_connected');
            }
            await fetch('http://127.0.0.1:3080/api/cctv/credentials', {
                method: 'DELETE'
            }).catch(() => {});
            await fetch('http://127.0.0.1:3080/api/cctv/credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'disconnect' })
            }).catch(() => {});
            await fetch('http://127.0.0.1:3080/api/cameras', {
                method: 'DELETE'
            }).catch(() => {});
            setIsCctvConnected(false);
            setIsEditingConnectors(false);
        } catch (err) {
            console.error("Failed to disconnect CCTV:", err);
            alert("Failed to disconnect CCTV: " + err.message);
        }
    };

    // Close on escape key
    useEffect(() => {
        if (!isPlusOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsPlusOpen(false);
                setIsConnectorsSubmenuOpen(false);
                setIsToolsSubmenuOpen(false);
                setIsUploadSubmenuOpen(false);
                setIsLibrarySubmenuOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlusOpen]);

    // Fetch library items using unified engine
    const openLibraryPicker = async () => {
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
        setIsPlusOpen(false);
        setIsLibrarySubmenuOpen(false);
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
            if (isPlusOpen && !isConnectorsSubmenuOpen && !isUploadSubmenuOpen && !isLibrarySubmenuOpen && !isEmojiOpen) {
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
        setIsUploadSubmenuOpen(false);
        setIsLibrarySubmenuOpen(false);
        setIsEmojiOpen(false);
        handleSend(files, null, false, isThinking, false);
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
        if (imageInputRef.current) imageInputRef.current.value = "";
        if (docInputRef.current) docInputRef.current.value = "";
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
                            {!isToolsSubmenuOpen && !isConnectorsSubmenuOpen && !isUploadSubmenuOpen && !isLibrarySubmenuOpen && (
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
                                            <div className="sliding-tab-title-line">
                                                <span className="sliding-tab-card-title">Connectors</span>
                                                {(isGoogleConnected || isTelegramConnected || isCctvConnected) && <span className="sliding-tab-status-dot" title="Connected" />}
                                            </div>
                                            <span className="sliding-tab-card-desc">
                                                {(isGoogleConnected || isTelegramConnected || isCctvConnected) ? "Active Integrations" : "Google, Telegram & CCTV"}
                                            </span>
                                        </div>
                                    </button>

                                    <button 
                                        type="button"
                                        className="sliding-tab-card"
                                        onClick={(e) => { 
                                            e.stopPropagation();
                                            setIsUploadSubmenuOpen(true);
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
                                            openLibraryPicker();
                                            setIsLibrarySubmenuOpen(true);
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
                                        {(isGoogleConnected || isTelegramConnected || isCctvConnected) && (
                                            <button 
                                                type="button"
                                                className={`sliding-tab-edit-btn ${isEditingConnectors ? 'active' : ''}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsEditingConnectors(!isEditingConnectors);
                                                }}
                                                title={isEditingConnectors ? "Done Editing" : "Edit Connectors"}
                                            >
                                                <Edit2 size={15} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="sliding-tab-grid">
                                        {/* Option 1: Google */}
                                        <button
                                            type="button"
                                            className={`sliding-tab-card ${isGoogleConnected ? 'is-connected' : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isEditingConnectors && isGoogleConnected) {
                                                    handleGoogleDisconnect(e);
                                                    return;
                                                }
                                                setIsGoogleModalOpen(true);
                                            }}
                                        >
                                            <div className="sliding-tab-card-icon">
                                                <img src="/google-logo.png" alt="Google" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                                            </div>
                                            <div className="sliding-tab-card-content">
                                                <div className="sliding-tab-title-line">
                                                    <span className="sliding-tab-card-title">Google</span>
                                                    {isGoogleConnected && <span className="sliding-tab-status-dot" title="Connected" />}
                                                </div>
                                                <span className="sliding-tab-card-desc">
                                                    {isGoogleConnected ? "Connected • Gmail & Drive" : "Gmail, Drive & Calendar"}
                                                </span>
                                            </div>
                                            {isGoogleConnected && isEditingConnectors && (
                                                <span 
                                                    className="sliding-tab-disconnect"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleGoogleDisconnect(e);
                                                    }}
                                                >
                                                    Disconnect
                                                </span>
                                            )}
                                        </button>

                                        {/* Option 2: Telegram */}
                                        <button
                                            type="button"
                                            className={`sliding-tab-card ${isTelegramConnected ? 'is-connected' : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isEditingConnectors && isTelegramConnected) {
                                                    handleTelegramDisconnect(e);
                                                    return;
                                                }
                                                setIsTelegramModalOpen(true);
                                            }}
                                        >
                                            <div className="sliding-tab-card-icon">
                                                <img src="/telegram.png" alt="Telegram" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                                            </div>
                                            <div className="sliding-tab-card-content">
                                                <div className="sliding-tab-title-line">
                                                    <span className="sliding-tab-card-title">Telegram</span>
                                                    {isTelegramConnected && <span className="sliding-tab-status-dot" title="Connected" />}
                                                </div>
                                                <span className="sliding-tab-card-desc">
                                                    {isTelegramConnected ? "Connected • Bot active" : "Connect Telegram bot"}
                                                </span>
                                            </div>
                                            {isTelegramConnected && isEditingConnectors && (
                                                <span 
                                                    className="sliding-tab-disconnect"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleTelegramDisconnect(e);
                                                    }}
                                                >
                                                    Disconnect
                                                </span>
                                            )}
                                        </button>

                                        {/* Option 3: CCTV Apps */}
                                        <button
                                            type="button"
                                            className={`sliding-tab-card ${isCctvConnected ? 'is-connected' : ''}`}
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (isEditingConnectors && isCctvConnected) {
                                                    handleCctvDisconnect(e);
                                                    return;
                                                }
                                                setIsConnectorsSubmenuOpen(false);
                                                setIsPlusOpen(false);
                                                await openCctvApp(setIsCctvDashboardOpen);
                                            }}
                                        >
                                            <div className="sliding-tab-card-icon" style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff' }}>
                                                <Video size={17} />
                                            </div>
                                            <div className="sliding-tab-card-content">
                                                <div className="sliding-tab-title-line">
                                                    <span className="sliding-tab-card-title">CCTV (Apps)</span>
                                                    {isCctvConnected && <span className="sliding-tab-status-dot" title="Connected" />}
                                                </div>
                                                <span className="sliding-tab-card-desc">
                                                    {isCctvConnected ? "Connected • Active" : "AI Camera Monitoring"}
                                                </span>
                                            </div>
                                            {isCctvConnected && isEditingConnectors ? (
                                                <span 
                                                    className="sliding-tab-disconnect"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCctvDisconnect(e);
                                                    }}
                                                >
                                                    Disconnect
                                                </span>
                                            ) : (
                                                <ChevronRight size={15} style={{ color: '#71717a', marginLeft: 'auto', flexShrink: 0 }} />
                                            )}
                                        </button>

                                        {/* Option 4: Tools */}
                                        <button
                                            type="button"
                                            className="sliding-tab-card"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsConnectorsSubmenuOpen(false);
                                                setIsToolsSubmenuOpen(true);
                                            }}
                                        >
                                            <div className="sliding-tab-card-icon">
                                                <Wrench size={17} />
                                            </div>
                                            <div className="sliding-tab-card-content">
                                                <span className="sliding-tab-card-title">Tools</span>
                                                <span className="sliding-tab-card-desc">11 AI utilities & tools</span>
                                            </div>
                                            <ChevronRight size={15} style={{ color: '#71717a', marginLeft: 'auto', flexShrink: 0 }} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {isToolsSubmenuOpen && (
                                <div className="sliding-tab-submenu">
                                    <div className="sliding-tab-submenu-header">
                                        <button 
                                            type="button"
                                            className="sliding-tab-back-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsToolsSubmenuOpen(false);
                                                setIsConnectorsSubmenuOpen(true);
                                            }}
                                        >
                                            <ChevronLeft size={16} /> Back
                                        </button>
                                        <span className="sliding-tab-submenu-title">Tools</span>
                                        <div style={{ width: 48 }} />
                                    </div>
                                    <div className="sliding-tab-tools-grid">
                                        {ALL_TOOLS.map((tool) => {
                                            const IconComponent = tool.icon;
                                            return (
                                                <button
                                                    key={tool.command}
                                                    type="button"
                                                    className="sliding-tab-card sliding-tab-tool-card"
                                                    onClick={() => {
                                                        setIsPlusOpen(false);
                                                        setIsToolsSubmenuOpen(false);
                                                        setIsConnectorsSubmenuOpen(false);
                                                        setInput(prev => prev + (prev.trim() ? " " : "") + tool.command + " ");
                                                        textareaRef.current?.focus();
                                                    }}
                                                >
                                                    <div className="sliding-tab-card-icon">
                                                        <IconComponent size={16} />
                                                    </div>
                                                    <div className="sliding-tab-card-content">
                                                        <span className="sliding-tab-card-title">{tool.title}</span>
                                                        <span className="sliding-tab-card-desc">{tool.desc}</span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {isUploadSubmenuOpen && (
                                <div className="sliding-tab-submenu">
                                    <div className="sliding-tab-submenu-header">
                                        <button 
                                            type="button"
                                            className="sliding-tab-back-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsUploadSubmenuOpen(false);
                                            }}
                                        >
                                            <ChevronLeft size={16} /> Back
                                        </button>
                                        <span className="sliding-tab-submenu-title">Upload Files</span>
                                        <div style={{ width: 48 }} />
                                    </div>

                                    <div className="sliding-tab-upload-grid">
                                        {/* 1. All Files / Device */}
                                        <button
                                            type="button"
                                            className="sliding-tab-card"
                                            onClick={() => {
                                                setIsPlusOpen(false);
                                                setIsUploadSubmenuOpen(false);
                                                fileInputRef.current?.click();
                                            }}
                                        >
                                            <div className="sliding-tab-card-icon">
                                                <Paperclip size={18} />
                                            </div>
                                            <div className="sliding-tab-card-content">
                                                <span className="sliding-tab-card-title">All Files</span>
                                                <span className="sliding-tab-card-desc">Images, docs & PDFs</span>
                                            </div>
                                        </button>

                                        {/* 2. Photos & Images */}
                                        <button
                                            type="button"
                                            className="sliding-tab-card"
                                            onClick={() => {
                                                setIsPlusOpen(false);
                                                setIsUploadSubmenuOpen(false);
                                                imageInputRef.current?.click();
                                            }}
                                        >
                                            <div className="sliding-tab-card-icon">
                                                <ImageIcon size={18} />
                                            </div>
                                            <div className="sliding-tab-card-content">
                                                <span className="sliding-tab-card-title">Photos & Images</span>
                                                <span className="sliding-tab-card-desc">PNG, JPG, WebP, GIF</span>
                                            </div>
                                        </button>

                                        {/* 3. Documents & PDFs */}
                                        <button
                                            type="button"
                                            className="sliding-tab-card"
                                            onClick={() => {
                                                setIsPlusOpen(false);
                                                setIsUploadSubmenuOpen(false);
                                                docInputRef.current?.click();
                                            }}
                                        >
                                            <div className="sliding-tab-card-icon">
                                                <FileText size={18} />
                                            </div>
                                            <div className="sliding-tab-card-content">
                                                <span className="sliding-tab-card-title">Documents & PDFs</span>
                                                <span className="sliding-tab-card-desc">PDF, Word, TXT, Excel</span>
                                            </div>
                                        </button>

                                        {/* 4. Local Folder */}
                                        <button
                                            type="button"
                                            className={`sliding-tab-card ${localDirectoryHandle ? 'is-connected' : ''}`}
                                            onClick={() => {
                                                setIsUploadSubmenuOpen(false);
                                                handleConnectFolder();
                                            }}
                                        >
                                            <div className="sliding-tab-card-icon">
                                                <Folder size={18} />
                                            </div>
                                            <div className="sliding-tab-card-content">
                                                <div className="sliding-tab-title-line">
                                                    <span className="sliding-tab-card-title">Connect Folder</span>
                                                    {localDirectoryHandle && <span className="sliding-tab-status-dot" title="Connected" />}
                                                </div>
                                                <span className="sliding-tab-card-desc">
                                                    {localDirectoryHandle 
                                                        ? (typeof localDirectoryHandle === 'string' ? localDirectoryHandle.split(/[/\\\\]/).pop() : localDirectoryHandle.name || 'Folder Linked')
                                                        : "Sync project workspace"}
                                                </span>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {isLibrarySubmenuOpen && (
                                <div className="sliding-tab-submenu sliding-tab-lib-submenu">
                                    <div className="sliding-tab-submenu-header">
                                        <button 
                                            type="button"
                                            className="sliding-tab-back-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsLibrarySubmenuOpen(false);
                                            }}
                                        >
                                            <ChevronLeft size={16} /> Back
                                        </button>
                                        <div className="sliding-tab-title-line">
                                            <span className="sliding-tab-submenu-title">Select from Library</span>
                                            <span className="sliding-tab-lib-count-badge">{libraryCounts.total} items</span>
                                        </div>
                                        {onOpenLibrary ? (
                                            <button
                                                type="button"
                                                className="sliding-tab-lib-link-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsPlusOpen(false);
                                                    setIsLibrarySubmenuOpen(false);
                                                    onOpenLibrary();
                                                }}
                                                title="Open Full Library Page"
                                            >
                                                Full Library ↗
                                            </button>
                                        ) : <div style={{ width: 48 }} />}
                                    </div>

                                    {/* Search & Tabs Controls */}
                                    <div className="sliding-tab-lib-toolbar">
                                        <div className="sliding-tab-lib-search-box">
                                            <Search size={13} className="sliding-tab-lib-search-icon" />
                                            <input
                                                className="sliding-tab-lib-search-input"
                                                placeholder={`Search in ${libraryTabs.find(t => t.id === libraryTab)?.label || 'library'}...`}
                                                value={librarySearch}
                                                onChange={e => setLibrarySearch(e.target.value)}
                                            />
                                            {librarySearch && (
                                                <button 
                                                    type="button"
                                                    className="sliding-tab-lib-search-clear" 
                                                    onClick={() => setLibrarySearch('')}
                                                    title="Clear search"
                                                >
                                                    <X size={12} />
                                                </button>
                                            )}
                                        </div>

                                        <div className="sliding-tab-lib-tabs-row">
                                            {libraryTabs.map(tab => (
                                                <button
                                                    key={tab.id}
                                                    type="button"
                                                    className={`sliding-tab-lib-tab ${libraryTab === tab.id ? 'active' : ''}`}
                                                    onClick={() => setLibraryTab(tab.id)}
                                                >
                                                    <span>{tab.label}</span>
                                                    <span className="sliding-tab-lib-tab-num">{tab.count}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Scrollable Viewport */}
                                    <div className="sliding-tab-lib-viewport">
                                        {libraryLoading ? (
                                            <div className="sliding-tab-lib-loading">
                                                <div className="lib-picker-spinner" />
                                                <span>Loading library items...</span>
                                            </div>
                                        ) : filteredLibraryItems.length === 0 ? (
                                            <div className="sliding-tab-lib-empty">
                                                <div className="sliding-tab-lib-empty-icon">
                                                    {libraryTab === 'gcalendar' ? <CalendarIcon size={20} /> :
                                                     libraryTab === 'gmail' ? <Mail size={20} /> :
                                                     libraryTab === 'ai' ? <Sparkles size={20} /> :
                                                     libraryTab === 'gdrive' ? <Cloud size={20} /> :
                                                     <Folder size={20} />}
                                                </div>
                                                <span className="sliding-tab-lib-empty-title">
                                                    {librarySearch ? "No matching files" : "No files in this category"}
                                                </span>
                                                <span className="sliding-tab-lib-empty-sub">
                                                    {librarySearch ? "Try searching for a different keyword." : "Items will appear here once saved or synced."}
                                                </span>
                                            </div>
                                        ) : (() => {
                                            const images = filteredLibraryItems.filter(it => it.kind === 'image' || it.mime_type?.startsWith('image/'));
                                            const others = filteredLibraryItems.filter(it => !(it.kind === 'image' || it.mime_type?.startsWith('image/')));

                                            return (
                                                <div className="sliding-tab-lib-items-list">
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
                                                </div>
                                            );
                                        })()}
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
                                setIsPlusOpen(prev => {
                                    setIsToolsSubmenuOpen(false);
                                    setIsConnectorsSubmenuOpen(false);
                                    setIsUploadSubmenuOpen(false);
                                    setIsLibrarySubmenuOpen(false);
                                    return !prev;
                                });
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
                            accept="*/*"
                            multiple
                        />
                        <input 
                            type="file" 
                            ref={imageInputRef} 
                            style={{ display: 'none' }} 
                            onChange={(e) => onFilesSelected(Array.from(e.target.files))}
                            accept="image/*"
                            multiple
                        />
                        <input 
                            type="file" 
                            ref={docInputRef} 
                            style={{ display: 'none' }} 
                            onChange={(e) => onFilesSelected(Array.from(e.target.files))}
                            accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.pptx,.ppt,.json,.md"
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
            
            <GoogleConnectModal 
                isOpen={isGoogleModalOpen} 
                onClose={() => {
                    setIsGoogleModalOpen(false);
                    checkGoogleAndTelegramStatus();
                }} 
                onProceed={() => {
                    setIsGoogleModalOpen(false);
                    handleGoogleConnect();
                }} 
            />

            <TelegramConnectModal 
                isOpen={isTelegramModalOpen} 
                onClose={() => {
                    setIsTelegramModalOpen(false);
                    checkGoogleAndTelegramStatus();
                }}
                onStatusChange={() => {
                    checkGoogleAndTelegramStatus();
                }}
            />

            <CctvDashboardOverlay 
                isOpen={isCctvDashboardOpen}
                onClose={() => setIsCctvDashboardOpen(false)}
            />
        </motion.div>
    );
}
