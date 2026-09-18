import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, Smile, Square, Plus, X, Maximize2, Minimize2, AudioLines, Link, Zap, ChevronLeft, Scissors, Eye, Calendar as CalendarIcon, HardDrive, RefreshCw, Edit2, Scan, Globe, FileText, Key, Palette, Calculator, Receipt, Film, LayoutGrid, Folder, Paperclip, Brain, BookOpen, Cloud, Mail, MoreVertical, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../services/supabase';
import ExtensionsModal from './ExtensionsModal';
import { ImageCard, FileCard, MailCard, CalendarCard } from '../pages/Library';
import '../pages/Library.css';

const COMMON_EMOJIS = [
    "😊", "😂", "🥰", "😎", "🤔", "😅", "🔥", "✨", 
    "🚀", "👍", "🙌", "💡", "🤖", "✅", "❌", "👋",
    "🎉", "❤️", "⭐", "🌈", "⚡", "🎯", "📝", "🌍"
];

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

    // Fetch library items from Supabase for the picker
    const openLibraryPicker = async () => {
        setIsLibraryPickerOpen(true);
        setLibrarySearch('');
        setLibraryLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const items = [];

            // 1. Drive files (CEOVA + Google Drive)
            const { data: driveFiles } = await supabase
                .from('files')
                .select('id, drive_id, name, mime_type, category, storage_source, web_view_link, web_download_link, thumbnail_url, size, created_at')
                .eq('user_id', user.id)
                .not('is_trashed', 'eq', true)
                .order('created_at', { ascending: false })
                .limit(200);

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
                const isImg = f.category === 'images' || f.mime_type?.startsWith('image/');
                const driveId = f.drive_id || (f.id && !String(f.id).includes('-') ? f.id : null);
                
                const getFullUrl = (link) => {
                   if (!link) return null;
                   if (link.startsWith('http')) return link;
                   const cleanLink = link.startsWith('/') ? link.substring(1) : link;
                   if (signedUrlsMap[cleanLink]) return signedUrlsMap[cleanLink];
                   return `${supabase.supabaseUrl}/storage/v1/object/public/user_files/${cleanLink}`;
                };

                const resolvedUrl = getFullUrl(f.web_view_link);
                items.push({
                    id: f.id,
                    drive_id: driveId,
                    name: f.name,
                    mime_type: f.mime_type,
                    category: f.category,
                    url: resolvedUrl,
                    web_view_link: resolvedUrl,
                    thumbnail_url: f.thumbnail_url,
                    source: f.storage_source || 'gdrive',
                    kind: isImg ? 'image' : 'file',
                    type: 'file',
                    created_at: f.created_at,
                    size: f.size
                });
            });

            // 2. Gmail emails
            const { data: emails } = await supabase
                .from('gmail_emails')
                .select('id, name, snippet, from_sender, web_view_link')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(100);
            (emails || []).forEach(e => items.push({
                id: `gmail-${e.id}`,
                name: e.name || 'Email',
                mime_type: 'message/rfc822',
                url: e.web_view_link,
                snippet: e.snippet,
                from_sender: e.from_sender,
                source: 'gmail',
                type: 'email'
            }));

            // 3. Calendar events
            const { data: events } = await supabase
                .from('calendar_events')
                .select('id, name, start_time, location')
                .eq('user_id', user.id)
                .order('start_time', { ascending: true })
                .limit(100);
            (events || []).forEach(ev => items.push({
                id: `cal-${ev.id}`,
                name: ev.name || 'Event',
                mime_type: 'text/calendar',
                url: null,
                snippet: ev.start_time ? new Date(ev.start_time).toLocaleString() : '',
                source: 'gcalendar',
                type: 'event'
            }));

            const seen = new Set();
            const deduped = items.filter(it => {
                const key = it.drive_id || (it.name ? `${it.name}-${it.size || ''}` : null) || it.url || it.id;
                if (seen.has(key)) return false;
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

    const attachLibraryItem = (item) => {
        // Build a lightweight pseudo-file object compatible with handleSend
        const pseudoFile = {
            name: item.name,
            type: item.mime_type || 'application/octet-stream',
            url: item.url,
            thumbnail_url: item.thumbnail_url,
            source: item.source,
            snippet: item.snippet,
            from_sender: item.from_sender,
            isLibraryItem: true,
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
                                    {file.type.startsWith('image/') ? (
                                        <img src={file.url} alt="preview" className="preview-img" />
                                    ) : (
                                        <div className="file-icon-box">
                                            <span className="file-ext">{file.name.split('.').pop().toUpperCase()}</span>
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
            <div className="input-footer">
                Ceova can make mistakes. Check important info.
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

            {/* ── Library Picker Modal ─────────────────────────── */}
            {isLibraryPickerOpen && typeof document !== 'undefined' && createPortal(
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    onClick={() => setIsLibraryPickerOpen(false)}
                >
                    <div
                        style={{
                            background: 'var(--bg-secondary, #1a1a2e)',
                            border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                            borderRadius: '18px',
                            width: '560px',
                            maxWidth: '95vw',
                            maxHeight: '75vh',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <BookOpen size={18} color="var(--brand-color, #10a37f)" />
                            <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-main)' }}>Select from Library</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsLibraryPickerOpen(false); }}
                                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', padding: '8px', zIndex: 10, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Search */}
                        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))' }}>
                            <input
                                autoFocus
                                placeholder="Search files, emails, events…"
                                value={librarySearch}
                                onChange={e => setLibrarySearch(e.target.value)}
                                style={{
                                    width: '100%', boxSizing: 'border-box',
                                    background: 'var(--bg-primary, #0d0d1a)',
                                    border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                                    borderRadius: '10px', padding: '9px 14px',
                                    color: 'var(--text-main)', fontSize: '14px', outline: 'none'
                                }}
                            />
                        </div>

                        {/* Tabs */}
                        <div className="lib-tabs" style={{ padding: '0 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary, #1a1a2e)', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                            <button className={`lib-tab ${libraryTab === 'ceova' ? 'active' : ''}`} onClick={() => setLibraryTab('ceova')}>CEOVA Drive</button>
                            <button className={`lib-tab ${libraryTab === 'gdrive' ? 'active' : ''}`} onClick={() => setLibraryTab('gdrive')}>Google Drive</button>
                            <button className={`lib-tab ${libraryTab === 'gmail' ? 'active' : ''}`} onClick={() => setLibraryTab('gmail')}>Google Mail</button>
                            <button className={`lib-tab ${libraryTab === 'gcalendar' ? 'active' : ''}`} onClick={() => setLibraryTab('gcalendar')}>Google Calendar</button>
                            <button className={`lib-tab ${libraryTab === 'ai' ? 'active' : ''}`} onClick={() => setLibraryTab('ai')}>AI Generated</button>
                        </div>

                        {/* Items */}
                        <div style={{ 
                            overflowY: 'auto', flex: 1, minHeight: 0, padding: '16px',
                            background: 'var(--bg-primary, #0d0d1a)'
                        }}>
                            {libraryLoading ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                    <div style={{ marginBottom: '10px' }}>Loading library…</div>
                                </div>
                            ) : (() => {
                                const filtered = libraryItems.filter(it => {
                                    if (librarySearch) {
                                        const term = librarySearch.toLowerCase();
                                        if (!(it.name?.toLowerCase().includes(term) || it.snippet?.toLowerCase().includes(term) || it.from_sender?.toLowerCase().includes(term))) return false;
                                    }
                                    if (libraryTab === 'ceova') return it.source === 'local' || it.source === 'ceova';
                                    if (libraryTab === 'gdrive') return it.source === 'gdrive';
                                    if (libraryTab === 'gmail') return it.source === 'gmail';
                                    if (libraryTab === 'gcalendar') return it.source === 'gcalendar';
                                    if (libraryTab === 'ai') return it.source === 'ai_generated' || it.source === 'ai';
                                    return true;
                                });
                                
                                const images = filtered.filter(it => it.kind === 'image' || it.mime_type?.startsWith('image/'));
                                const others = filtered.filter(it => !(it.kind === 'image' || it.mime_type?.startsWith('image/')));

                                if (filtered.length === 0) {
                                    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '14px' }}>No items found</div>;
                                }

                                return (
                                    <>
                                        {images.length > 0 && (
                                            <div className="lib-grid-images" style={{ marginBottom: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                                                {images.map(item => (
                                                    <ImageCard key={item.id} item={item} onClick={attachLibraryItem} onPreview={() => {}} onDownload={() => {}} onVisit={() => {}} />
                                                ))}
                                            </div>
                                        )}
                                        {others.length > 0 && (
                                            <div className="lib-grid-files">
                                                {others.map(item => {
                                                    if (item.type === 'email') return <MailCard key={item.id} item={item} onClick={attachLibraryItem} onPreview={() => {}} onVisit={() => {}} onSummarize={() => {}} />;
                                                    if (item.type === 'event') return <CalendarCard key={item.id} item={item} onClick={attachLibraryItem} onPreview={() => {}} onVisit={() => {}} onSummarize={() => {}} />;
                                                    return <FileCard key={item.id} item={item} onClick={attachLibraryItem} onPreview={() => {}} onDownload={() => {}} onVisit={() => {}} onSummarize={() => {}} onOCR={() => {}} />;
                                                })}
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-color, rgba(255,255,255,0.06))', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                            Click any item to attach it to your message
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </motion.div>
    );
}
