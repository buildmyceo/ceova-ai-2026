import React, { useRef, useEffect, useState } from 'react';
import { ArrowUp, Smile, Square, Plus, X, Maximize2, Minimize2, AudioLines, Link, Zap, ChevronLeft, Scissors, Eye, Calendar, HardDrive, RefreshCw, Edit2, Scan, Globe, FileText, Key, Palette, Calculator, Receipt, Film, LayoutGrid, Folder, Paperclip } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../services/supabase';
import ExtensionsModal from './ExtensionsModal';

const COMMON_EMOJIS = [
    "😊", "😂", "🥰", "😎", "🤔", "😅", "🔥", "✨", 
    "🚀", "👍", "🙌", "💡", "🤖", "✅", "❌", "👋",
    "🎉", "❤️", "⭐", "🌈", "⚡", "🎯", "📝", "🌍"
];

export default function InputBox({ 
    input, setInput, handleSend, isLoading, handleStop, isHome,
    localDirectoryHandle, setLocalDirectoryHandle
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
        handleSend(files);
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

                            <button
                                className="toolbar-btn"
                                onClick={() => fileInputRef.current?.click()}
                                title="Choose File"
                            >
                                <Paperclip size={18} />
                            </button>

                                {isPlusOpen && !isToolsSubmenuOpen && !isConnectorsSubmenuOpen && (
                                <div className="plus-dropdown-menu">
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
                                    <button onClick={handleConnectFolder}>
                                        <Folder size={18} /> {localDirectoryHandle ? "Change Workspace" : "Connect Workspace"}
                                    </button>
                                </div>
                            )}
                            {isPlusOpen && isToolsSubmenuOpen && (
                                <div className="plus-dropdown-menu">

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
                                    }} style={{ color: '#3b82f6' }}>
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
                                                    scopes: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive',
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
                                                    scopes: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive',
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
                                    }} style={{ color: '#3b82f6' }}>
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
        </motion.div>
    );
}
