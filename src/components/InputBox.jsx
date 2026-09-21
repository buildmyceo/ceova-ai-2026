import React, { useRef, useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, Smile, Square, Plus, X, Maximize2, Minimize2, AudioLines, Link, Zap, ChevronLeft, Scissors, Eye, Calendar as CalendarIcon, HardDrive, RefreshCw, Edit2, Scan, Globe, FileText, Key, Palette, Calculator, Receipt, Film, LayoutGrid, Folder, Paperclip, Brain, BookOpen, Cloud, Mail, MoreVertical, Sparkles, Search, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../services/supabase';
import { fetchGoogleEmails } from '../services/gmailSyncEngine';
import { fetchGoogleCalendarEvents } from '../services/gcalendarSyncEngine';
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
    const [err, setErr] = useState(false);
    const driveId = item.drive_id || (item.id && !String(item.id).includes('-') ? item.id : null);
    const src = err ? null : (item.thumbnail_url || item.url || (driveId ? `https://lh3.googleusercontent.com/d/${driveId}=s400` : null));

    return (
        <div 
            className="lib-picker-img-card" 
            onClick={() => onClick(item)}
            title={`Click to attach ${item.name}`}
        >
            <div className="lib-picker-img-wrap">
                {src && !err ? (
                    <img
                        src={src}
                        alt={item.name}
                        className="lib-picker-img"
                        loading="lazy"
                        onError={() => setErr(true)}
                    />
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
    const isMail = item.type === 'email' || item.source === 'gmail';
    const isCal = item.type === 'event' || item.source === 'gcalendar';
    const isImg = item.kind === 'image' || item.mime_type?.startsWith('image/');

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
                    {item.created_at && <span>{fmtDate(item.created_at)}</span>}
                </div>
            </div>
            <span className="lib-picker-row-action">+ Attach</span>
        </div>
    );
}

export default function InputBox({ 
    input, setInput, handleSend, isLoading, handleStop, isHome,
    localDirectoryHandle, setLocalDirectoryHandle, onOpenLibrary
}) {
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

    useEffect(() => {
        const checkGmailConnection = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('user_google_tokens')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();
                if (data) setIsGmailConnected(true);
            }
        };
        checkGmailConnection();
    }, []);

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

    // Fetch library items from Supabase for the picker
    const openLibraryPicker = async () => {
        setIsLibraryPickerOpen(true);
        setLibrarySearch('');
        setLibraryLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const items = [];

            // 1. Drive files (files table: Google Drive + synced local files)
            try {
                const { data: driveFiles } = await supabase
                    .from('files')
                    .select('id, drive_id, name, mime_type, category, storage_source, web_view_link, web_download_link, thumbnail_url, size, created_at')
                    .eq('user_id', user.id)
                    .not('is_trashed', 'eq', true)
                    .order('created_at', { ascending: false })
                    .limit(300);

                const pathsToSign = [];
                (driveFiles || []).forEach(df => {
                    if (df.web_view_link && !df.web_view_link.startsWith('http')) {
                        const cleanLink = df.web_view_link.startsWith('/') ? df.web_view_link.substring(1) : df.web_view_link;
                        pathsToSign.push(cleanLink);
                    }
                });
                let signedUrlsMap = {};
                if (pathsToSign.length > 0) {
                    for (let i = 0; i < pathsToSign.length; i += 50) {
                        const chunk = pathsToSign.slice(i, i + 50);
                        const { data: signedData } = await supabase.storage.from('user_files').createSignedUrls(chunk, 3600);
                        if (signedData) {
                            signedData.forEach(item => {
                                if (!item.error) signedUrlsMap[item.path] = item.signedUrl;
                            });
                        }
                    }
                }

                (driveFiles || []).forEach(f => {
                    const isImg = f.category === 'images' || f.mime_type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(f.name || '');
                    const driveId = f.drive_id || (f.id && !String(f.id).includes('-') ? f.id : null);
                    
                    const getFullUrl = (link) => {
                        if (!link) return null;
                        if (link.startsWith('http')) return link;
                        const cleanLink = link.startsWith('/') ? link.substring(1) : link;
                        if (signedUrlsMap[cleanLink]) return signedUrlsMap[cleanLink];
                        return `${supabase.supabaseUrl}/storage/v1/object/public/user_files/${cleanLink}`;
                    };

                    const resolvedUrl = getFullUrl(f.web_view_link) || (driveId ? `https://lh3.googleusercontent.com/d/${driveId}=s400` : null);
                    const isAi = f.storage_source === 'ai_generated' || f.category === 'ai_generated';
                    const isDrive = f.storage_source === 'gdrive' || (driveId && !f.storage_source);
                    const source = isAi ? 'ai' : (isDrive ? 'gdrive' : 'ceova');

                    items.push({
                        id: f.id,
                        drive_id: driveId,
                        name: f.name || 'Untitled File',
                        mime_type: f.mime_type || (isImg ? 'image/jpeg' : 'application/octet-stream'),
                        category: f.category || (isImg ? 'images' : 'documents'),
                        url: resolvedUrl,
                        web_view_link: resolvedUrl,
                        thumbnail_url: f.thumbnail_url || (driveId ? `https://lh3.googleusercontent.com/d/${driveId}=s400` : resolvedUrl),
                        source,
                        kind: isImg ? 'image' : 'file',
                        type: 'file',
                        created_at: f.created_at,
                        size: f.size
                    });
                });
            } catch (errFiles) {
                console.warn('[LibraryPicker] Files fetch warning:', errFiles);
            }

            // 2. User files table (Ceova Storage)
            try {
                const { data: userFiles } = await supabase
                    .from('user_files')
                    .select('id, file_name, file_type, storage_path, size_bytes, created_at')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(150);

                (userFiles || []).forEach(uf => {
                    const isImg = uf.file_type?.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(uf.file_name || '');
                    let fileUrl = null;
                    if (uf.storage_path) {
                        const { data: pubData } = supabase.storage.from('user_files').getPublicUrl(uf.storage_path);
                        fileUrl = pubData?.publicUrl || null;
                    }
                    items.push({
                        id: `uf-${uf.id}`,
                        name: uf.file_name || 'Uploaded File',
                        mime_type: uf.file_type || (isImg ? 'image/jpeg' : 'application/octet-stream'),
                        category: isImg ? 'images' : 'documents',
                        url: fileUrl,
                        web_view_link: fileUrl,
                        thumbnail_url: fileUrl,
                        source: 'ceova',
                        kind: isImg ? 'image' : 'file',
                        type: 'file',
                        created_at: uf.created_at,
                        size: uf.size_bytes
                    });
                });
            } catch (errUserFiles) {
                console.warn('[LibraryPicker] User files fetch warning:', errUserFiles);
            }

            // 3. AI Generated Files table
            try {
                const { data: aiFiles } = await supabase
                    .from('ai_generated_files')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(100);

                (aiFiles || []).forEach(af => {
                    const name = af.file_name || af.name || 'AI File';
                    const isImg = af.mime_type?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(name);
                    items.push({
                        id: `aig-${af.id}`,
                        name,
                        mime_type: af.mime_type || (isImg ? 'image/png' : 'text/plain'),
                        category: af.category || 'ai_generated',
                        url: af.file_url || af.url,
                        thumbnail_url: af.file_url || af.url,
                        source: 'ai',
                        kind: isImg ? 'image' : 'file',
                        type: 'file',
                        created_at: af.created_at,
                        size: af.size
                    });
                });
            } catch (errAi) {
                console.warn('[LibraryPicker] AI files fetch warning:', errAi);
            }

            // 4. Chat attachments and AI markdown images
            try {
                const { data: chats } = await supabase
                    .from('chats')
                    .select('id, title')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(20);

                if (chats && chats.length > 0) {
                    const chatIds = chats.map(c => c.id);
                    const { data: messages } = await supabase
                        .from('messages')
                        .select('id, role, content, attachments, created_at, chat_id')
                        .in('chat_id', chatIds)
                        .order('created_at', { ascending: false })
                        .limit(200);

                    (messages || []).forEach(msg => {
                        const isAI = msg.role === 'assistant' || msg.role === 'ai';
                        const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
                        attachments.forEach(att => {
                            const isImg = att.type?.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(att.name || att.url || '');
                            items.push({
                                id: `att-${msg.id}-${att.name || Math.random()}`,
                                name: att.name || 'Attachment',
                                url: att.url || att.preview,
                                thumbnail_url: att.url || att.preview,
                                mime_type: att.type || (isImg ? 'image/jpeg' : 'application/octet-stream'),
                                size: att.size,
                                created_at: msg.created_at,
                                source: isAI ? 'ai' : 'ceova',
                                kind: isImg ? 'image' : 'file',
                                type: 'file'
                            });
                        });

                        if (isAI && msg.content) {
                            const imgRegex = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
                            let m;
                            while ((m = imgRegex.exec(msg.content)) !== null) {
                                items.push({
                                    id: `img-${msg.id}-${m.index}`,
                                    name: m[1] || 'AI Generated Image',
                                    url: m[2],
                                    thumbnail_url: m[2],
                                    mime_type: 'image/png',
                                    created_at: msg.created_at,
                                    source: 'ai',
                                    kind: 'image',
                                    type: 'file'
                                });
                            }
                        }
                    });
                }
            } catch (errChat) {
                console.warn('[LibraryPicker] Chat attachments fetch warning:', errChat);
            }

            // 5. Gmail emails
            try {
                let emails = [];
                const { data: dbEmails } = await supabase
                    .from('gmail_emails')
                    .select('id, gmail_id, name, snippet, from_sender, web_view_link, created_at')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(100);

                if (dbEmails && dbEmails.length > 0) {
                    emails = dbEmails;
                } else {
                    try {
                        const live = await fetchGoogleEmails(user.id);
                        if (live?.success && live?.emails) emails = live.emails;
                    } catch (eLive) {}
                }

                (emails || []).forEach(e => items.push({
                    id: `gmail-${e.id || e.gmail_id}`,
                    name: e.name || 'Email',
                    mime_type: 'message/rfc822',
                    url: e.web_view_link,
                    web_view_link: e.web_view_link,
                    snippet: e.snippet,
                    from_sender: e.from_sender,
                    source: 'gmail',
                    type: 'email',
                    created_at: e.created_at
                }));
            } catch (errMail) {
                console.warn('[LibraryPicker] Gmail fetch warning:', errMail);
            }

            // 6. Calendar events
            try {
                let events = [];
                const { data: dbEvents } = await supabase
                    .from('calendar_events')
                    .select('id, gcal_id, name, start_time, end_time, location, html_link, created_at')
                    .eq('user_id', user.id)
                    .order('start_time', { ascending: true })
                    .limit(100);

                if (dbEvents && dbEvents.length > 0) {
                    events = dbEvents;
                } else {
                    try {
                        const live = await fetchGoogleCalendarEvents(user.id);
                        if (live?.success && live?.events) events = live.events;
                    } catch (eCalLive) {}
                }

                (events || []).forEach(ev => items.push({
                    id: `cal-${ev.id || ev.gcal_id}`,
                    name: ev.name || 'Event',
                    mime_type: 'text/calendar',
                    url: ev.html_link || null,
                    web_view_link: ev.html_link,
                    snippet: ev.start_time ? new Date(ev.start_time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '',
                    location: ev.location,
                    source: 'gcalendar',
                    type: 'event',
                    created_at: ev.created_at
                }));
            } catch (errCal) {
                console.warn('[LibraryPicker] Calendar fetch warning:', errCal);
            }

            // Deduplicate items
            const seen = new Set();
            const deduped = items.filter(it => {
                const key = it.drive_id || (it.name ? `${it.name}-${it.size || ''}` : null) || it.url || it.id;
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            setLibraryItems(deduped);
        } catch(e) {
            console.error('Library picker load error:', e);
        } finally {
            setLibraryLoading(false);
        }
    };

    // Calculate tab counts
    const libraryCounts = useMemo(() => {
        const counts = { ceova: 0, gdrive: 0, gmail: 0, gcalendar: 0, ai: 0, total: libraryItems.length };
        libraryItems.forEach(it => {
            const isAi = it.source === 'ai' || it.source === 'ai_generated' || it.category === 'ai_generated';
            if (isAi) {
                counts.ai++;
            } else if (it.source === 'gdrive') {
                counts.gdrive++;
            } else if (it.source === 'gmail') {
                counts.gmail++;
            } else if (it.source === 'gcalendar') {
                counts.gcalendar++;
            } else {
                counts.ceova++;
            }
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

    // Filter items based on active tab and search
    const filteredLibraryItems = useMemo(() => {
        return libraryItems.filter(it => {
            const isAi = it.source === 'ai' || it.source === 'ai_generated' || it.category === 'ai_generated';
            if (libraryTab === 'ceova' && (isAi || it.source === 'gdrive' || it.source === 'gmail' || it.source === 'gcalendar')) return false;
            if (libraryTab === 'gdrive' && it.source !== 'gdrive') return false;
            if (libraryTab === 'gmail' && it.source !== 'gmail') return false;
            if (libraryTab === 'gcalendar' && it.source !== 'gcalendar') return false;
            if (libraryTab === 'ai' && !isAi) return false;

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
        const pseudoFile = {
            name: item.name || 'Library File',
            type: item.mime_type || (isImg ? 'image/jpeg' : 'application/octet-stream'),
            url: item.url || item.web_view_link || item.thumbnail_url || '',
            thumbnail_url: item.thumbnail_url || item.url || '',
            source: item.source,
            snippet: item.snippet,
            from_sender: item.from_sender,
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
                        <div style={{ position: 'relative' }}>
                            <button 
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

                                {isPlusOpen && !isToolsSubmenuOpen && !isConnectorsSubmenuOpen && (
                                <div className="plus-dropdown-menu">
                                    <button onClick={(e) => {
                                            e.stopPropagation();
                                            setIsThinking(!isThinking);
                                            setIsPlusOpen(false);
                                        }}>
                                            <Brain size={18} color={isThinking ? 'var(--brand-color)' : 'currentColor'} /> 
                                            {isThinking ? 'Detailed Thinking: ON' : 'Enable Deep Thinking'}
                                        </button>
                                    <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
                                    <button onClick={(e) => {
                                            e.stopPropagation();
                                            setIsConnectorsSubmenuOpen(true);
                                        }}>
                                            <Link size={18} /> Connectors
                                        </button>
                                    <button onClick={() => { 
                                            setIsPlusOpen(false); 
                                            fileInputRef.current?.click(); 
                                        }}>
                                            <Plus size={18} /> Upload files
                                        </button>
                                    <button onClick={(e) => {
                                            e.stopPropagation();
                                            setIsPlusOpen(false);
                                            openLibraryPicker();
                                        }}>
                                            <BookOpen size={18} /> Select from Library
                                        </button>

                                </div>
                            )}
                            {isPlusOpen && isToolsSubmenuOpen && (
                                <div className="plus-dropdown-menu">

                                    <button onClick={() => {
                                        setIsPlusOpen(false);
                                        setIsToolsSubmenuOpen(false);
                                        setInput(prev => prev + (prev.trim() ? " " : "") + "/generate_image ");
                                        textareaRef.current?.focus();
                                    }}>
                                        <Sparkles size={18} /> Generate Image
                                    </button>
                                    <button onClick={() => {
                                        setIsPlusOpen(false);
                                        setIsToolsSubmenuOpen(false);
                                        setInput(prev => prev + (prev.trim() ? " " : "") + "/background_remover ");
                                        textareaRef.current?.focus();
                                    }}>
                                        <Scissors size={18} /> Background Remover
                                    </button>
                                    <button onClick={() => {
                                        setIsPlusOpen(false);
                                        setIsToolsSubmenuOpen(false);
                                        setInput(prev => prev + (prev.trim() ? " " : "") + "/qr_barcode ");
                                        textareaRef.current?.focus();
                                    }}>
                                        <Scan size={18} /> QR & Barcode
                                    </button>
                                    <button onClick={() => {
                                        setIsPlusOpen(false);
                                        setIsToolsSubmenuOpen(false);
                                        setInput(prev => prev + (prev.trim() ? " " : "") + "/invoice_generator ");
                                        textareaRef.current?.focus();
                                    }}>
                                        <Receipt size={18} /> Invoice Generator
                                    </button>
                                    <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
                                    <button onClick={() => {
                                        setIsPlusOpen(false);
                                        setIsToolsSubmenuOpen(false);
                                        setExtensionsModalTab('tools');
                                        setIsExtensionsModalOpen(true);
                                    }} style={{ color: '#a1a1aa' }}>
                                        <LayoutGrid size={18} /> More Tools...
                                    </button>
                                </div>
                            )}
                            {isPlusOpen && isConnectorsSubmenuOpen && (
                                <div className="plus-dropdown-menu">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                        <button onClick={(e) => {
                                            e.stopPropagation();
                                            setIsConnectorsSubmenuOpen(false);
                                        }} style={{ opacity: 0.7, padding: '4px 8px' }}>
                                            <ChevronLeft size={18} /> Back
                                        </button>
                                        {isGmailConnected && (
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsEditingConnectors(!isEditingConnectors);
                                                }}
                                                style={{ padding: '4px 8px', opacity: 0.7 }}
                                                title="Edit Connectors"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
                                    <button onClick={async (e) => {
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
                                    }} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                <img src="/gmail.png" alt="Gmail" style={{ width: 18, height: 18, objectFit: 'contain' }} /> 
                                                <span>{isGmailConnected ? "Gmail" : "Connect Gmail"}</span>
                                            </div>
                                            {isGmailConnected && isEditingConnectors && (
                                                <div 
                                                    style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
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
                                                    <div style={{
                                                        width: '28px',
                                                        height: '16px',
                                                        borderRadius: '8px',
                                                        background: '#10a37f',
                                                        position: 'relative',
                                                        transition: 'all 0.2s',
                                                        flexShrink: 0
                                                    }}>
                                                        <div style={{
                                                            width: '12px',
                                                            height: '12px',
                                                            borderRadius: '50%',
                                                            background: 'white',
                                                            position: 'absolute',
                                                            top: '2px',
                                                            left: '14px',
                                                            transition: 'all 0.2s'
                                                        }} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </button>

                                    <button onClick={async (e) => {
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
                                    }} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                <img src="/drive.png" alt="Google Drive" style={{ width: 18, height: 18, objectFit: 'contain' }} /> 
                                                <span>{isGmailConnected ? "Google Drive" : "Connect Drive"}</span>
                                            </div>
                                            {isGmailConnected && isEditingConnectors && (
                                                <div 
                                                    style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
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
                                                    <div style={{
                                                        width: '28px',
                                                        height: '16px',
                                                        borderRadius: '8px',
                                                        background: '#10a37f',
                                                        position: 'relative',
                                                        transition: 'all 0.2s',
                                                        flexShrink: 0
                                                    }}>
                                                        <div style={{
                                                            width: '12px',
                                                            height: '12px',
                                                            borderRadius: '50%',
                                                            background: 'white',
                                                            position: 'absolute',
                                                            top: '2px',
                                                            left: '14px',
                                                            transition: 'all 0.2s'
                                                        }} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </button>

                                    <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
                                    <button onClick={() => {
                                        setIsPlusOpen(false);
                                        setIsConnectorsSubmenuOpen(false);
                                        setExtensionsModalTab('connectors');
                                        setIsExtensionsModalOpen(true);
                                    }} style={{ color: '#a1a1aa' }}>
                                        <LayoutGrid size={18} /> More Connectors...
                                    </button>
                                </div>
                            )}
                        </div>
                        
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

                        {isLoading ? (
                            <button className="send-action-btn active stop-btn" onClick={handleStop} title="Stop generation">
                                <Square size={14} fill="currentColor" />
                            </button>
                        ) : (
                            <button 
                                className={`send-action-btn ${(input.trim() || files.length > 0) ? 'active' : ''}`} 
                                onClick={onSendClick}
                                disabled={!(input.trim() || files.length > 0)}
                            >
                                <ArrowUp size={20} strokeWidth={2.5} />
                            </button>
                        )}
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
