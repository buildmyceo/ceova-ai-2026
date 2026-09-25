import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase, SUPABASE_KEY, SUPABASE_URL } from '../services/supabase';
import Sidebar from '../components/Sidebar';
import Chat from '../components/Chat';
import InputBox from '../components/InputBox';
import SettingsModal from '../components/SettingsModalV2';
import SearchModal from '../components/SearchModal';
import Library from './Library';
import { cacheManager } from '../services/CacheManager';
import { Search, MoreVertical, Menu, Share2, Check, Camera, BarChart3, Zap, Brain, Link, Send, Glasses, Edit, ChevronDown, Compass, Image, Globe, MessageCircleDashed, CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Login from './Login';
import { buildSystemPrompt } from '../lib/systemPromptBuilder';
import { generateChatTitle, renameLegacyChats } from '../services/titleGenerator';
import { getGreetingName, getGreetingHeadline, getTimePeriod, getGreetingSubtitle } from '../constants/greetings';
import PhoneLinkModal from '../components/PhoneLinkModal';

const CURRENT_CHAT_KEY = "chat_id";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertStringUuid(name, value) {
    if (typeof value !== 'string' || !UUID_RE.test(value)) {
        throw new Error(`${name} must be a string UUID. Received ${value === undefined ? 'undefined' : JSON.stringify(value)} (${value === null ? 'null' : typeof value})`);
    }
}

export function sortMessagesChronologically(msgs) {
    if (!Array.isArray(msgs) || msgs.length === 0) return [];
    return [...msgs].sort((a, b) => {
        const timeA = new Date(a.created_at || a.time || 0).getTime();
        const timeB = new Date(b.created_at || b.time || 0).getTime();
        if (timeA !== timeB) return timeA - timeB;
        const isUserA = (a.role === 'user' || a.sender === 'user');
        const isUserB = (b.role === 'user' || b.sender === 'user');
        if (isUserA && !isUserB) return -1;
        if (!isUserA && isUserB) return 1;
        return 0;
    });
}

export default function Home({ session }) {
    const location = useLocation();
    const [chats, setChats] = useState({});
    const [chatMetadata, setChatMetadata] = useState({}); // Stores { is_pinned, is_archived, title }
    const [currentChatId, setCurrentChatId] = useState(() => {
        try {
            // Clean up any legacy localStorage entry
            localStorage.removeItem(CURRENT_CHAT_KEY);
            return sessionStorage.getItem(CURRENT_CHAT_KEY) || null;
        } catch (e) {
            return null;
        }
    });
    const [temporaryChatId, setTemporaryChatId] = useState(null);
    const [localDirectoryHandle, setLocalDirectoryHandle] = useState(null);
    const localDirectoryHandleRef = useRef(null);
    const pendingFileWritesRef = useRef(null); // stores {filesList, chatId, msgId} when folder not yet selected
    
    const [pendingCommand, setPendingCommand] = useState(null);
    const requestTerminalPermission = (cmd) => {
        return new Promise((resolve) => {
            setPendingCommand({ cmd, resolve });
        });
    };

    const [input, setInput] = useState(() => {
        try {
            const pending = localStorage.getItem('pending_guest_prompt');
            if (pending) {
                localStorage.removeItem('pending_guest_prompt');
                return pending;
            }
        } catch (e) {}
        return "";
    });
    const [editingMessage, setEditingMessage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        const saved = localStorage.getItem('ceova_sidebar_state');
        if (saved !== null) {
            return saved === 'open';
        }
        return window.innerWidth > 768;
    });
    const [isSidebarAnimating, setIsSidebarAnimating] = useState(false);
    
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [isLibraryOpen, setIsLibraryOpen] = useState(() => Boolean(location?.state?.openLibrary));
    const [shareCopied, setShareCopied] = useState(false);
    const [shareStatus, setShareStatus] = useState("");
    const abortControllerRef = useRef(null);
    
    const [toast, setToast] = useState(null);

    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    
    const [inGracePeriod, setInGracePeriod] = useState(false);
    const [isRetryingPayment, setIsRetryingPayment] = useState(false);
    const [userMemories, setUserMemories] = useState([]);
    const [greetingIndex, setGreetingIndex] = useState(() => Math.floor(Math.random() * 10));
    const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);

    // If navigation state requests library to open, open it
    useEffect(() => {
        if (location?.state?.openLibrary) {
            setIsLibraryOpen(true);
        }
    }, [location?.state?.openLibrary]);

    useEffect(() => {
        localStorage.setItem('ceova_sidebar_state', isSidebarOpen ? 'open' : 'closed');
    }, [isSidebarOpen]);

    useEffect(() => {
        localDirectoryHandleRef.current = localDirectoryHandle;
    }, [localDirectoryHandle]);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth <= 768;
            setIsMobile(prev => {
                // If transitioning from desktop to mobile, auto-close sidebar
                if (!prev && mobile) {
                    setIsSidebarOpen(false);
                }
                return mobile;
            });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const edgeFunctionUrl = (fn) => `${SUPABASE_URL}/functions/v1/${fn}`;

    useEffect(() => {
        if (!session) return;
        const checkGrace = async () => {
            try {
                const { data } = await supabase.rpc('get_usage_and_limits', { p_user_id: session.user.id });
                if (data && data.in_grace_period) {
                    setInGracePeriod(true);
                } else {
                    setInGracePeriod(false);
                }
            } catch (e) {
                console.error("Grace period check failed", e);
            }
        };
        checkGrace();

        const onFocus = () => checkGrace();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [session]);

    const handleRetryPayment = async () => {
        try {
            setIsRetryingPayment(true);
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            const res = await fetch(edgeFunctionUrl('razorpay-retry'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${currentSession.access_token}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await res.json();
            if (data.url) {
                window.open(data.url, '_blank');
            } else {
                showToast(data.error || "Failed to initiate retry", "error");
            }
        } catch (e) {
            showToast("Error processing payment retry", "error");
        } finally {
            setIsRetryingPayment(false);
        }
    };

    useEffect(() => {
        if (!session) return;

        // Fetch user memories to personalize greeting and AI context
        supabase
            .from('user_memory_longterm')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })
            .then(({ data, error }) => {
                if (!error && data) setUserMemories(data);
            });
        
        async function fetchChats() {
            try {
                // Fast Sync: Fetch just chat metadata to populate sidebar instantly for new logins
                const { data: mData, error: mError } = await supabase
                    .from('chats')
                    .select('*')
                    .eq('user_id', session.user.id);
                
                if (mError) throw mError;
                
                const metaMap = {};
                if (mData) {
                    await cacheManager.setChats(mData);
                    mData.forEach(m => {
                        metaMap[m.id] = {
                            is_pinned: m.is_pinned,
                            is_archived: m.is_archived,
                            title: m.title,
                            created_at: m.created_at
                        };
                    });
                    setChatMetadata(metaMap);
                }

                // Fast Sync: Fetch messages just for the current active chat if one is set (e.g. on page reload)
                let activeChatId = currentChatId;

                if (activeChatId) {
                    const { data: currentChatMessages, error: activeErr } = await supabase
                        .from('messages')
                        .select('*')
                        .eq('chat_id', activeChatId)
                        .order('created_at', { ascending: true });
                        
                    if (currentChatMessages) {
                        const sortedCurrent = sortMessagesChronologically(currentChatMessages);
                        const formattedMessages = sortedCurrent.map(msg => {
                            const cloudProjectAttachment = msg.attachments?.find?.((a) => a.type === 'cloud_project');
                            return {
                                id: msg.id,
                                sender: msg.role === 'user' ? 'user' : 'ai',
                                text: msg.content,
                                time: msg.created_at,
                                mode: msg.mode,
                                attachments: msg.attachments || [],
                                cloudProject: cloudProjectAttachment ? cloudProjectAttachment.data : null
                            };
                        });
                        setChats(prev => {
                            const existing = prev[activeChatId] || [];
                            const pending = existing.filter(m => m.isTyping || m.isLive || m.tempId);
                            if (pending.length === 0) {
                                return { ...prev, [activeChatId]: formattedMessages };
                            }
                            const dbIds = new Set(formattedMessages.map(m => m.id));
                            const uniquePending = pending.filter(m => !m.id || !dbIds.has(m.id));
                            return { ...prev, [activeChatId]: [...formattedMessages, ...uniquePending] };
                        });
                        // We do NOT await this so the UI doesn't block
                        cacheManager.setMessages(sortedCurrent).catch(console.error);
                    }
                }

                // Async Background Sync: Fetch everything else without blocking the main render
                supabase
                    .from('messages')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .order('created_at', { ascending: true })
                    .then(async ({ data, error }) => {
                        if (error || !data) return;
                        
                        const sortedData = sortMessagesChronologically(data);
                        await cacheManager.setMessages(sortedData);
                        
                        const grouped = sortedData.reduce((acc, msg) => {
                            if (!acc[msg.chat_id]) acc[msg.chat_id] = [];
                            const cloudProjectAttachment = msg.attachments?.find?.((a) => a.type === 'cloud_project');
                            acc[msg.chat_id].push({
                                id: msg.id,
                                sender: msg.role === 'user' ? 'user' : 'ai',
                                text: msg.content,
                                time: msg.created_at,
                                mode: msg.mode,
                                attachments: msg.attachments || [],
                                cloudProject: cloudProjectAttachment ? cloudProjectAttachment.data : null
                            });
                            return acc;
                        }, {});

                        setChats(prev => {
                            const merged = { ...grouped };
                            Object.keys(prev).forEach(key => {
                                const existing = prev[key] || [];
                                const pending = existing.filter(m => m.isTyping || m.isLive || m.tempId);
                                if (!merged[key]) {
                                    if (existing.length > 0 || key === currentChatId) {
                                        merged[key] = existing;
                                    }
                                } else if (pending.length > 0) {
                                    const dbIds = new Set(merged[key].map(m => m.id));
                                    const uniquePending = pending.filter(m => !m.id || !dbIds.has(m.id));
                                    merged[key] = [...merged[key], ...uniquePending];
                                }
                            });
                            // Automatically rename legacy or raw chat titles in the background
                            renameLegacyChats({
                                chats: merged,
                                chatMetadata: metaMap,
                                setChatMetadata,
                                token: session?.access_token,
                                userMemories
                            });
                            return merged;
                        });
                    }).catch(console.error);

            } catch (err) {
                console.error("Error fetching chats:", err);
                showToast("Failed to load chat history", "error");
            }
        }
        fetchChats();
    }, [session?.user?.id]);

    const handleSend = async (files = [], overrideText = null, isHidden = false, isThinking = false, isWebSearch = false) => {
        const textToUse = overrideText !== null ? overrideText : input;
        if (!textToUse.trim() && files.length === 0) return;
        if (isLoading) return;
        
        abortControllerRef.current = new AbortController();
        const text = textToUse.trim();
        if (overrideText === null) setInput("");
        setIsLoading(true);

        const idToUse = currentChatId || crypto.randomUUID();
        sessionStorage.setItem(CURRENT_CHAT_KEY, idToUse);
        if (!currentChatId) {
            createNewChat(idToUse, false);
        }

        let currentMessages = chats[idToUse] || [];

        // --- HANDLE EDITING ---
        if (editingMessage && editingMessage.chatId === idToUse) {
            const indexToSlice = editingMessage.index;
            const messagesToDelete = currentMessages.slice(indexToSlice).filter(m => m.id);
            
            // Delete removed messages from Supabase asynchronously
            if (messagesToDelete.length > 0) {
                const idsToDelete = messagesToDelete.map(m => m.id);
                supabase.from('messages').delete().in('id', idsToDelete).then(({error}) => {
                    if (error) console.error("Error deleting edited messages", error);
                });
            }
            
            // Truncate the local array
            currentMessages = currentMessages.slice(0, indexToSlice);
            setEditingMessage(null); // Clear editing state
        }

        const initialMessageCount = currentMessages.filter(m => !m.isTitleFallback).length;
        
        // --- OPTIMISTIC UI RENDER ---
        const localAttachments = files.map(file => ({
            name: file.name,
            url: (file instanceof Blob || file instanceof File)
                ? (file.type?.startsWith('image/') ? URL.createObjectURL(file) : '')
                : (file.url || file.thumbnail_url || ''),
            type: file.type || 'application/octet-stream',
            size: file.size || 0
        }));

        const tempId = crypto.randomUUID();
        const optimisticUserMsg = { sender: "user", text, time: new Date().toISOString(), attachments: localAttachments, isHidden };
        const aiPlaceholder = { 
            sender: "ai", 
            text: "", 
            tempId, 
            isTyping: true, 
            isLive: true, 
            toolStatus: files.length > 0 ? "Uploading files..." : "Thinking..." 
        };

        setChats(prev => {
            const updatedMessages = [...currentMessages];
            if (!isHidden) {
                updatedMessages.push(optimisticUserMsg);
            }
            updatedMessages.push(aiPlaceholder);
            return {
                ...prev,
                [idToUse]: updatedMessages
            };
        });

        // --- BACKGROUND UPLOAD ---
        const currentAttachments = [];
        const uploadErrors = [];
        const isTemporary = Boolean(temporaryChatId && idToUse === temporaryChatId);

        if (files.length > 0) {
            // Check storage limit before upload
            const { data: usageData, error: usageError } = await supabase.rpc('get_usage_and_limits', { p_user_id: session.user.id });
            if (!usageError && usageData) {
                if (usageData.usage.storage_used_mb >= usageData.limits.storage_limit_mb) {
                    showToast("Storage limit reached. Please delete old files or upgrade your plan to upload new ones.", 'error');
                    setIsLoading(false);
                    setChats(prev => ({
                        ...prev,
                        [idToUse]: (prev[idToUse] || []).filter(m => m.tempId !== tempId)
                    }));
                    return;
                }
            }

            for (let file of files) {
                if (file.isLibraryItem || (file.url && !((file instanceof Blob) || (file instanceof File)))) {
                    let libraryContent = file.content || file.snippet || null;
                    let libraryData = file.data || null;
                    const driveId = file.drive_id || (file.id && !String(file.id).includes('-') ? file.id : null);
                    const isLibPdf = (file.type && file.type.includes('pdf')) || (file.name && file.name.toLowerCase().endsWith('.pdf'));

                    // If it's a PDF from Google Drive or library and content hasn't been extracted yet, fetch and extract it!
                    if (!libraryContent && isLibPdf) {
                        try {
                            const { extractPdfContent } = await import('../utils/pdfExtractor.js');
                            let blob = null;

                            // If it's from Google Drive, use Google access token
                            const googleToken = localStorage.getItem('google_provider_token');
                            if (driveId && googleToken) {
                                const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${driveId}?alt=media`, {
                                    headers: { Authorization: `Bearer ${googleToken}` }
                                });
                                if (driveRes.ok) {
                                    blob = await driveRes.blob();
                                }
                            }

                            // If not Google Drive or token fetch failed, try direct file.url
                            if (!blob && file.url) {
                                const pdfRes = await fetch(file.url);
                                if (pdfRes.ok) {
                                    blob = await pdfRes.blob();
                                }
                            }

                            if (blob) {
                                const extracted = await extractPdfContent(blob);
                                if (extracted?.text) {
                                    libraryContent = extracted.text;
                                }
                                if (!libraryData && extracted?.pageImages?.length > 0) {
                                    libraryData = extracted.pageImages[0];
                                }
                            }
                        } catch (libPdfErr) {
                            console.warn("Failed to extract library PDF text:", libPdfErr);
                        }
                    }

                    currentAttachments.push({
                        name: file.name,
                        url: file.url || file.web_view_link || '',
                        drive_id: driveId,
                        data: libraryData,
                        content: libraryContent,
                        type: file.type || (isLibPdf ? 'application/pdf' : 'application/octet-stream'),
                        size: file.size || 0,
                        source: file.source || (driveId ? 'gdrive' : undefined),
                        snippet: file.snippet,
                        from_sender: file.from_sender,
                        thread_id: file.thread_id || null,
                        gmail_id: file.gmail_id || null
                    });
                    continue;
                }
                if (isTemporary) {
                    uploadErrors.push(`Cannot upload ${file.name} in a temporary session.`);
                    continue;
                }
                const fileExt = (file.name || 'file').split('.').pop();
                const fileName = `${crypto.randomUUID()}.${fileExt}`;
                const filePath = `${session.user.id}/${idToUse}/${fileName}`;
                
                try {
                    // 1. Read Base64 Data URL for images under 8MB (instant multimodal vision)
                    let dataUrl = null;
                    if (file.type && file.type.startsWith('image/') && file.size < 8 * 1024 * 1024) {
                        try {
                            dataUrl = await new Promise((resolve) => {
                                const reader = new FileReader();
                                reader.onload = () => resolve(reader.result);
                                reader.onerror = () => resolve(null);
                                reader.readAsDataURL(file);
                            });
                        } catch (e) {
                            console.warn("Failed to read image dataUrl", e);
                        }
                    }

                    // 2. Read text content for text/code/csv/json/log files under 500KB
                    let textContent = null;
                    const isTextLike = file.type && (
                        file.type.startsWith('text/') ||
                        file.type.includes('json') ||
                        file.type.includes('csv') ||
                        file.type.includes('javascript') ||
                        file.type.includes('typescript') ||
                        (file.name && file.name.match(/\.(txt|md|csv|json|js|jsx|ts|tsx|py|html|css|sql|sh|log|env|yml|yaml|xml)$/i))
                    );
                    if (isTextLike && file.size < 500 * 1024 && typeof file.text === 'function') {
                        try {
                            textContent = await file.text();
                        } catch (e) {
                            console.warn("Failed to read text content", e);
                        }
                    }

                    // 2.5. Extract text & visual renders from PDF documents under 25MB
                    const isPdf = (file.type && file.type.includes('pdf')) || (file.name && file.name.toLowerCase().endsWith('.pdf'));
                    if (isPdf && file.size < 25 * 1024 * 1024) {
                        try {
                            const { extractPdfContent } = await import('../utils/pdfExtractor.js');
                            const extracted = await extractPdfContent(file);
                            if (extracted.text) {
                                textContent = extracted.text;
                            }
                            if (!dataUrl && extracted.pageImages && extracted.pageImages.length > 0) {
                                dataUrl = extracted.pageImages[0];
                            }
                        } catch (pdfErr) {
                            console.warn("Failed to extract PDF content:", pdfErr);
                        }
                    }

                    const { error: uploadError } = await supabase.storage
                        .from('attachments')
                        .upload(filePath, file);

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage
                        .from('attachments')
                        .getPublicUrl(filePath);

                    // 3. Create signed URL (24 hours) as effective authenticated URL
                    let effectiveUrl = publicUrl;
                    try {
                        const { data: signedData } = await supabase.storage
                            .from('attachments')
                            .createSignedUrl(filePath, 86400);
                        if (signedData?.signedUrl) {
                            effectiveUrl = signedData.signedUrl;
                        }
                    } catch (e) {
                        // ignore and use publicUrl
                    }

                    const fileCategory = file.type?.startsWith('image/') ? 'images' 
                                       : file.type?.startsWith('video/') ? 'videos' 
                                       : file.type?.startsWith('audio/') ? 'audio' 
                                       : isPdf ? 'pdfs' 
                                       : 'documents';
                                       
                    const { error: dbError } = await supabase.from('files').insert({
                        user_id: session.user.id,
                        storage_source: 'local',
                        name: file.name,
                        mime_type: file.type || (isPdf ? 'application/pdf' : 'application/octet-stream'),
                        category: fileCategory,
                        size: file.size,
                        ocr_text: textContent ? textContent.slice(0, 10000) : null,
                        web_download_link: effectiveUrl,
                        web_view_link: effectiveUrl,
                    });
                    
                    if (dbError) {
                        console.error("Error saving file to library:", dbError);
                    }

                    currentAttachments.push({
                        name: file.name,
                        url: effectiveUrl,
                        public_url: publicUrl,
                        data: dataUrl,
                        content: textContent,
                        type: file.type || (isPdf ? 'application/pdf' : 'application/octet-stream'),
                        size: file.size,
                        path: filePath
                    });
                } catch (err) {
                    console.error("File upload error:", err);
                    uploadErrors.push(`Failed to upload ${file.name}`);
                }
            }
        }

        if (uploadErrors.length > 0) {
            showToast(uploadErrors.join('\n'), 'warning');
            setIsLoading(false);
            // Revert AI placeholder since upload failed
            setChats(prev => ({
                ...prev,
                [idToUse]: (prev[idToUse] || []).filter(m => m.tempId !== tempId)
            }));
            return;
        }

        // Update optimistic user message with actual uploaded attachments
        setChats(prev => {
            const msgs = [...(prev[idToUse] || [])];
            const aiIdx = msgs.findIndex(m => m.tempId === tempId);
            if (aiIdx !== -1) {
                msgs[aiIdx] = { ...msgs[aiIdx], toolStatus: "Thinking..." };
            }
            // Update the user message that was just added right before AI placeholder
            const userIdx = aiIdx - 1;
            if (userIdx >= 0 && msgs[userIdx].sender === 'user') {
                msgs[userIdx] = { ...msgs[userIdx], attachments: currentAttachments.length > 0 ? currentAttachments : [] };
            }
            return { ...prev, [idToUse]: msgs };
        });

        if (!isTemporary) {
            try {
                // 1. Generate title and save chat if first message
                if (currentMessages.length === 0 || (currentMessages.length === 1 && currentMessages[0].isTitleFallback)) {
                    let summary = text.slice(0, 30);
                    const titleMatch = text.match(/^# (.*)/);
                    if (titleMatch) { summary = titleMatch[1]; }
                    const shortTitle = summary + (text.length > 30 ? "..." : "");
                    
                    const finalTitle = shortTitle.trim() || (currentAttachments.length > 0 ? `Image Upload` : "New Chat");
                    
                    const chatObj = {
                        id: idToUse,
                        user_id: session.user.id,
                        title: finalTitle,
                        created_at: new Date().toISOString()
                    };
                    await cacheManager.setChat(chatObj);

                    const { error: metaErr } = await supabase.from('chats').upsert({
                        id: idToUse,
                        user_id: session.user.id,
                        title: finalTitle
                    });
                    if (metaErr) console.error("Local chat save error:", metaErr);
                    if (!metaErr) {
                        setChatMetadata(prev => ({
                            ...prev,
                            [idToUse]: { ...prev[idToUse], title: finalTitle, created_at: chatObj.created_at }
                        }));
                    }
                }

                // 2. Save User Message
                const userMsgObj = {
                    id: crypto.randomUUID(),
                    chat_id: idToUse,
                    user_id: session.user.id,
                    role: 'user', // We still keep role user so backend processes it natively
                    content: isHidden ? `<ceova_hidden_tool_output>\n${text}\n</ceova_hidden_tool_output>` : text,
                    attachments: currentAttachments.length > 0 ? currentAttachments : null,
                    created_at: new Date().toISOString()
                };
                
                await cacheManager.setMessage(userMsgObj);

                const { error: userMsgErr } = await supabase.from('messages').insert(userMsgObj);

                if (userMsgErr) {
                    console.error("Local user msg save error:", userMsgErr);
                    showToast("Failed to save message to database: " + userMsgErr.message, "error");
                }
            } catch (dbErr) {
                console.error("Local Persistence Error (User Msg):", dbErr);
                showToast("Failed to connect to database.", "error");
            }
        }

        const historyForAI = currentMessages.length > 0 
            ? currentMessages.filter(m => !m.isTitleFallback).map(m => ({
                role: m.sender === 'user' ? 'user' : 'assistant',
                content: m.text || "",
                attachments: m.attachments || []
            })) 
            : [];

        const activeCloudProject = currentMessages.slice().reverse().find(m => 
            m.cloudProject?.projectId || m.attachments?.some(a => a.type === 'cloud_project' && a.data?.projectId)
        );
        const activeProjectId = activeCloudProject?.cloudProject?.projectId || 
            activeCloudProject?.attachments?.find(a => a.type === 'cloud_project')?.data?.projectId;

        // Check if user is approving a new website implementation plan
        const lastAssistantMsg = currentMessages.slice().reverse().find(m => m.sender === 'assistant');
        const isApprovingNewSitePlan = lastAssistantMsg && 
            typeof lastAssistantMsg.text === 'string' &&
            /Website Implementation Plan/i.test(lastAssistantMsg.text) &&
            !/Revised Website Implementation Plan/i.test(lastAssistantMsg.text) &&
            /^(?:proceed|yes|build it|go ahead|approved|approve|sure|ok|start|do it|let's do it|lets do it)\b/i.test(text.trim());

        // Check if user explicitly requests or describes creating a brand-new website
        const isNewWebsiteRequest = /^\s*(?:please\s+)?(?:creat|create|build|make|start|generate|design)\s+(?:a\s+)?(?:completely\s+)?(?:new\s+)?(?:website|web\s*app|site|landing|portfolio|restaurant|resturent|store|bakery|project|page)/i.test(text)
            || /\b(?:start|begin)\s+(?:from\s+scratch|fresh|over|anew)\b/i.test(text)
            || /\b(?:create|build|make)\s+(?:a\s+)?brand\s+new\b/i.test(text);

        const effectiveProjectId = (isNewWebsiteRequest || isApprovingNewSitePlan) ? undefined : activeProjectId;

        try {
            const token = session?.access_token || SUPABASE_KEY;
            let aiRawText = "";
            let autoFollowUpText = null;
            let currentCloudProject = null;
            let activeToolStatus = files.length > 0 
                ? "Uploading files..." 
                : (isWebSearch ? "Searching the web..." : (isThinking ? "Thinking deeply..." : "Thinking..."));

            // Cloud fetch directly to super-endpoint
                const reqBody = {
                    message: text,
                    project_id: effectiveProjectId || undefined,
                    history: historyForAI,
                    attachments: currentAttachments.length > 0 ? currentAttachments : [],
                    is_temporary: isTemporary,
                    has_local_folder: !!localDirectoryHandleRef.current,
                    is_thinking: isThinking,
                    is_web_search: isWebSearch,
                    user_context: {
                        date: new Date().toLocaleDateString(),
                        time: new Date().toLocaleTimeString(),
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        dayOfWeek: new Date().toLocaleDateString(undefined, { weekday: 'long' })
                    }
                };

                let res;
                let fetchError;
                // Safari Keep-Alive bug workaround: Retry once on native network failure ("Load failed")
                for (let attempt = 0; attempt < 2; attempt++) {
                    try {
                        res = await fetch(edgeFunctionUrl('super-endpoint'), {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(reqBody),
                            signal: abortControllerRef.current.signal
                        });
                        fetchError = null;
                        break;
                    } catch (err) {
                        fetchError = err;
                        if (err.name === 'AbortError') break;
                        if (attempt < 2) {
                            console.warn("Fetch failed, retrying...", err);
                            await new Promise(r => setTimeout(r, 500)); // 500ms backoff
                        }
                    }
                }

                if (fetchError) throw fetchError;

                if (!res.ok) {
                    const errBody = await res.json().catch(() => ({}));
                    throw new Error(errBody.error || `Server error: ${res.status}`);
                }

                if (res.headers.get('content-type')?.includes('text/event-stream')) {
                    const reader = res.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = "";
                    
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        if (abortControllerRef.current?.signal.aborted) {
                            reader.cancel();
                            break;
                        }
                        
                        buffer += decoder.decode(value, { stream: true });
                        
                        let newlineIndex;
                        while ((newlineIndex = buffer.indexOf('\n\n')) >= 0) {
                            const chunk = buffer.slice(0, newlineIndex);
                            buffer = buffer.slice(newlineIndex + 2);
                            
                            if (chunk.startsWith('data: ')) {
                                try {
                                    const parsed = JSON.parse(chunk.slice(6));
                                    
                                    if (parsed.type === 'project_progress' || parsed.type === 'cloud_project_ready') {
                                        currentCloudProject = {
                                            stage: parsed.stage || (parsed.type === 'cloud_project_ready' ? 'READY' : 'BUILDING'),
                                            projectId: parsed.projectId,
                                            name: parsed.name || currentCloudProject?.name || null,
                                            description: parsed.description || currentCloudProject?.description || null,
                                            slug: parsed.slug,
                                            deploymentUrl: parsed.deploymentUrl,
                                            isUpdate: parsed.isUpdate !== undefined ? parsed.isUpdate : (currentCloudProject?.isUpdate || false),
                                            files: parsed.files || currentCloudProject?.files || [],
                                            logs: parsed.logs || currentCloudProject?.logs || '',
                                            content: parsed.content || '',
                                            error: parsed.error || null,
                                            startedAt: currentCloudProject?.startedAt || Date.now(),
                                        };
                                        if (parsed.content) {
                                            aiRawText = parsed.content;
                                        }
                                    } else if (parsed.type === 'status') {
                                        activeToolStatus = parsed.stage;
                                    } else if (parsed.type === 'text') {
                                        aiRawText += parsed.content;
                                        if (activeToolStatus) {
                                            if (aiRawText.includes('![') || !/image|design|completed|edit|detail|almost done/i.test(activeToolStatus)) {
                                                activeToolStatus = null;
                                            }
                                        }
                                    } else if (parsed.type === 'error') {
                                        aiRawText += `\n\n**Error:** ${parsed.error}`;
                                        if (currentCloudProject) {
                                            currentCloudProject = { ...currentCloudProject, stage: 'FAILED', error: parsed.error };
                                        }
                                     } else if (parsed.type === 'tool_call' && parsed.tool === 'write_local_files') {
                                         let filesList = [];
                                         if (Array.isArray(parsed.args?.files)) {
                                             filesList = parsed.args.files;
                                         } else if (Array.isArray(parsed.args)) {
                                             filesList = parsed.args;
                                         } else if (parsed.args?.path || parsed.args?.filename || parsed.args?.file) {
                                             filesList = [{
                                                 path: parsed.args.path || parsed.args.filename || parsed.args.file,
                                                 content: parsed.args.content || parsed.args.code || ""
                                             }];
                                         } else if (typeof parsed.args?.files === 'object' && parsed.args?.files !== null) {
                                             filesList = [parsed.args.files];
                                         }

                                         const fileNames = filesList.map(f => f.path || f.filename || f.file || 'file').join(', ');
                                         activeToolStatus = fileNames ? `Writing ${fileNames}...` : "Writing files...";
                                         
                                         // Guard: if AI sent empty files array, ask it to regenerate silently (only once)
                                         if (filesList.length === 0) {
                                             if (isHidden) {
                                                 aiRawText += "\n\n⚠️ I was unable to generate the file content. Please provide more specific instructions on what files to create.";
                                                 activeToolStatus = null;
                                             } else {
                                                 autoFollowUpText = "You called write_local_files with an empty files array. Please regenerate the FULL source code for all files and call write_local_files again with the complete file content in the 'files' array. Do NOT send empty files.";
                                                 activeToolStatus = "Generating file content (retry)...";
                                             }
                                         } else {
                                         try {
                                             const currentFolderHandle = localDirectoryHandleRef.current;

                                             if (!currentFolderHandle) {
                                                 // No folder connected — store pending writes and ask user to select folder
                                                 pendingFileWritesRef.current = { filesList, fileNames };
                                                 aiRawText += `\n\n📁 **To write your project files, I need access to a folder on your device.**\n\nPlease click the **"Connect Local Folder"** button that will appear below to select where to save your files. Once you select a folder, I'll write all ${filesList.length} file(s) automatically.\n\n[CONNECT_FOLDER_BUTTON]`;
                                             } else {
                                                 // Folder already connected — write files immediately
                                                 const isTauri = typeof currentFolderHandle === 'string';
                                                 if (isTauri) {
                                                     const { writeTextFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');
                                                     const { join, dirname } = await import('@tauri-apps/api/path');
                                                     for (const file of filesList) {
                                                         const targetPath = file.path || file.filename || file.file || 'file.txt';
                                                         const filePath = await join(currentFolderHandle, targetPath);
                                                         const dirPath = await dirname(filePath);
                                                         if (!(await exists(dirPath))) {
                                                             await mkdir(dirPath, { recursive: true });
                                                         }
                                                         await writeTextFile(filePath, file.content || "");
                                                     }
                                                 } else {
                                                     for (const file of filesList) {
                                                         const targetPath = file.path || file.filename || file.file || 'file.txt';
                                                         const fileHandle = await currentFolderHandle.getFileHandle(targetPath, { create: true });
                                                         const writable = await fileHandle.createWritable();
                                                         await writable.write(file.content || "");
                                                         await writable.close();
                                                     }
                                                 }
                                                 aiRawText += `\n\n✅ Successfully wrote ${filesList.length} file(s) to your local folder!`;
                                                 autoFollowUpText = `Successfully wrote the files (${fileNames}) to local disk. Please summarize what you created for the user.`;
                                             }
                                         } catch (err) {
                                             aiRawText += `\n\n**Error writing files:** ${err.message}`;
                                         } finally {
                                             activeToolStatus = null;
                                         }
                                         } // end else (filesList.length > 0)
                                     } else if (parsed.type === 'tool_call' && parsed.tool === 'run_terminal_command') {
                                         activeToolStatus = "Executing terminal command...";
                                         const cmdStr = parsed.args?.command || parsed.args?.cmd || "";
                                         
                                         // SECURITY FIX: Block dangerous shell commands to prevent destructive operations
                                         const dangerousPatterns = [
                                             /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--recursive|--force)\b/i,  // rm -rf
                                             /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*r)\b/i,                       // rm -fr
                                             /\bformat\b/i,                                                // format drive
                                             /\bmkfs\b/i,                                                  // make filesystem
                                             /\bdd\s+if=/i,                                                // disk destroyer
                                             /\b:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;/,                          // fork bomb
                                             /\bshutdown\b/i,                                              // shutdown system
                                             /\breboot\b/i,                                                // reboot
                                             /\bsudo\s+rm\b/i,                                             // sudo rm
                                             /\bchmod\s+777\s+\//,                                         // chmod 777 /
                                             /\bcurl\b.*\|\s*(ba)?sh/i,                                    // pipe to shell
                                             /\bwget\b.*\|\s*(ba)?sh/i,                                    // pipe to shell
                                             />\s*\/dev\/[sh]da/i,                                         // overwrite disk
                                         ];
                                         
                                         const isDangerous = dangerousPatterns.some(p => p.test(cmdStr));
                                         if (isDangerous) {
                                             aiRawText += `\n\n🛡️ **Command Blocked!** This command was flagged as potentially dangerous and was NOT executed.\n\n\`\`\`bash\n$ ${cmdStr}\n\`\`\`\n\n🤖 *"I'm an AI, not a chaos agent! I won't rm -rf your life away!"* 😎`;
                                             activeToolStatus = null;
                                         } else {
                                         
                                         aiRawText += `\n\n\`\`\`bash\n$ ${cmdStr}\n\`\`\`\n\n⚡ Executed in terminal!`;
                                         
                                         let currentFolderHandle = localDirectoryHandleRef.current;
                                         
                                         if (!currentFolderHandle || typeof currentFolderHandle !== 'string') {
                                             try {
                                                 const { open } = await import('@tauri-apps/plugin-dialog');
                                                 const dirPath = await open({
                                                     directory: true,
                                                     multiple: false,
                                                     title: "Select Workspace Folder to Run Commands"
                                                 });
                                                 if (dirPath) {
                                                     currentFolderHandle = dirPath;
                                                     setLocalDirectoryHandle(dirPath);
                                                     localDirectoryHandleRef.current = dirPath;
                                                 }
                                             } catch (e) {}
                                         }

                                         try {
                                             const { Command } = await import('@tauri-apps/plugin-shell');
                                             const isWindows = navigator.userAgent.includes('Windows');
                                             const cmdWithCwd = (currentFolderHandle && typeof currentFolderHandle === 'string') 
                                                 ? `cd "${currentFolderHandle}" && ${cmdStr}` 
                                                 : cmdStr;
                                             const finalCmd = isWindows ? Command.create('run-cmd', ['/c', cmdWithCwd]) : Command.create('run-sh', ['-c', cmdWithCwd]);
                                             const output = await finalCmd.execute();
                                             
                                             const termOutput = [output.stdout, output.stderr].filter(Boolean).join('\n');
                                             autoFollowUpText = termOutput ? `Command execution output:\n\`\`\`\n${termOutput.slice(0, 3000)}\n\`\`\`` : "Command finished with exit code 0.";
                                         } catch (err) {
                                             aiRawText += `\n\n**Error executing command:** ${err.message}`;
                                         } finally {
                                             activeToolStatus = null;
                                         }
                                         } // end else (not dangerous)
                                     } else if (parsed.type === 'tool_call' && parsed.tool === 'read_local_files') {
                                         activeToolStatus = "Reading local files...";
                                         let currentFolderHandle = localDirectoryHandleRef.current;
                                         
                                         if (!currentFolderHandle) {
                                             try {
                                                 const { open } = await import('@tauri-apps/plugin-dialog');
                                                 const dirPath = await open({
                                                     directory: true,
                                                     multiple: false,
                                                     title: "Select Folder to Read Files"
                                                 });
                                                 if (dirPath) {
                                                     currentFolderHandle = dirPath;
                                                     setLocalDirectoryHandle(dirPath);
                                                     localDirectoryHandleRef.current = dirPath;
                                                 }
                                             } catch (tauriErr) {
                                                 if (window.showDirectoryPicker) {
                                                     try {
                                                         const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                                                         if (dirHandle) {
                                                             currentFolderHandle = dirHandle;
                                                             setLocalDirectoryHandle(dirHandle);
                                                             localDirectoryHandleRef.current = dirHandle;
                                                         }
                                                     } catch (e) {}
                                                 }
                                             }
                                         }

                                         try {
                                             if (!currentFolderHandle) {
                                                 aiRawText += "\n\n**Action Required:** Please Connect Local Folder first so I can read these files. [Connect Local Folder]";
                                                 autoFollowUpText = JSON.stringify({ error: "No local folder connected" });
                                             } else {
                                                 const isTauri = typeof currentFolderHandle === 'string';
                                                 let results = {};
                                                 let pathsList = [];
                                                 if (Array.isArray(parsed.args?.paths)) {
                                                     pathsList = parsed.args.paths;
                                                 } else if (Array.isArray(parsed.args?.files)) {
                                                     pathsList = parsed.args.files;
                                                 } else if (typeof parsed.args?.path === 'string') {
                                                     pathsList = [parsed.args.path];
                                                 } else if (typeof parsed.args?.file === 'string') {
                                                     pathsList = [parsed.args.file];
                                                 }

                                                 if (isTauri) {
                                                     const { readTextFile } = await import('@tauri-apps/plugin-fs');
                                                     const { join } = await import('@tauri-apps/api/path');
                                                     for (const file of pathsList) {
                                                         try {
                                                             const filePath = await join(currentFolderHandle, file);
                                                             results[file] = await readTextFile(filePath);
                                                         } catch (e) { results[file] = `Error: ${e.message}`; }
                                                     }
                                                 } else {
                                                     for (const file of pathsList) {
                                                         try {
                                                             const fileHandle = await currentFolderHandle.getFileHandle(file);
                                                             const fileData = await fileHandle.getFile();
                                                             results[file] = await fileData.text();
                                                         } catch (e) { results[file] = `Error: ${e.message}`; }
                                                     }
                                                 }
                                                 autoFollowUpText = "File contents:\n" + JSON.stringify(results, null, 2);
                                             }
                                         } catch (err) {
                                             autoFollowUpText = JSON.stringify({ error: err.message });
                                         } finally {
                                             activeToolStatus = null;
                                         }
                                     } else if (parsed.type === 'tool_call' && parsed.tool === 'list_local_files') {
                                         activeToolStatus = "Listing local files...";
                                         let currentFolderHandle = localDirectoryHandleRef.current;
                                         
                                         if (!currentFolderHandle) {
                                             try {
                                                 const { open } = await import('@tauri-apps/plugin-dialog');
                                                 const dirPath = await open({
                                                     directory: true,
                                                     multiple: false,
                                                     title: "Select Folder to List Files"
                                                 });
                                                 if (dirPath) {
                                                     currentFolderHandle = dirPath;
                                                     setLocalDirectoryHandle(dirPath);
                                                     localDirectoryHandleRef.current = dirPath;
                                                 }
                                             } catch (tauriErr) {
                                                 if (window.showDirectoryPicker) {
                                                     try {
                                                         const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                                                         if (dirHandle) {
                                                             currentFolderHandle = dirHandle;
                                                             setLocalDirectoryHandle(dirHandle);
                                                             localDirectoryHandleRef.current = dirHandle;
                                                         }
                                                     } catch (e) {}
                                                 }
                                             }
                                         }

                                         try {
                                             if (!currentFolderHandle) {
                                                 aiRawText += "\n\n**Action Required:** Please Connect Local Folder first so I can list your files. [Connect Local Folder]";
                                                 autoFollowUpText = JSON.stringify({ error: "No local folder connected" });
                                             } else {
                                                 const isTauri = typeof currentFolderHandle === 'string';
                                                 let resultList = [];
                                                 if (isTauri) {
                                                     const { readDir } = await import('@tauri-apps/plugin-fs');
                                                     const { join } = await import('@tauri-apps/api/path');
                                                     const targetPath = parsed.args?.path ? await join(currentFolderHandle, parsed.args.path) : currentFolderHandle;
                                                     const entries = await readDir(targetPath);
                                                     resultList = entries.map(e => ({ name: e.name, type: e.isDirectory ? 'directory' : 'file' }));
                                                 } else {
                                                     for await (const [name, handle] of currentFolderHandle.entries()) {
                                                         resultList.push({ name, type: handle.kind });
                                                     }
                                                 }
                                                 autoFollowUpText = "Directory contents:\n" + JSON.stringify(resultList, null, 2);
                                             }
                                         } catch (err) {
                                             autoFollowUpText = JSON.stringify({ error: err.message });
                                         } finally {
                                             activeToolStatus = null;
                                         }
                                     }
                                                          // Live update UI
                                    setChats(prev => {
                                        const messages = [...(prev[idToUse] || [])];
                                        const aiIdx = messages.findIndex(m => m.tempId === tempId);
                                        if (aiIdx !== -1) {
                                            messages[aiIdx] = { 
                                                ...messages[aiIdx], 
                                                text: aiRawText, 
                                                isTyping: true, 
                                                isLive: true, 
                                                toolStatus: activeToolStatus,
                                                cloudProject: currentCloudProject
                                            };
                                        }
                                        return { ...prev, [idToUse]: messages };
                                    });
                                } catch (e) {}
                            }
                        }
                    }
                    
                    // Finalize typing state
                    const finalAiText = aiRawText.trim() || (currentCloudProject ? "" : "I couldn't complete that request. Please try again.");
                    setChats(prev => {
                        const messages = [...(prev[idToUse] || [])];
                        const aiIdx = messages.findIndex(m => m.tempId === tempId);
                        if (aiIdx !== -1) {
                            messages[aiIdx] = { 
                                ...messages[aiIdx], 
                                text: finalAiText, 
                                isTyping: false, 
                                isLive: true, 
                                toolStatus: null,
                                cloudProject: currentCloudProject
                            };
                        }
                        return { ...prev, [idToUse]: messages };
                    });
                    
                } else {
                    const data = await res.json();
                    aiRawText = data.text || "[No response]";
                    
                    // Stream simulation for non-SSE legacy fallback
                    let fullText = "";
                    for (let i = 0; i < aiRawText.length; i++) {
                        if (abortControllerRef.current?.signal.aborted) break;
                        
                        fullText += aiRawText[i];
                        setChats(prev => {
                            const messages = [...(prev[idToUse] || [])];
                            const aiIdx = messages.findIndex(m => m.tempId === tempId);
                            if (aiIdx !== -1) {
                                messages[aiIdx] = { ...messages[aiIdx], text: fullText, isTyping: false, isLive: true };
                            }
                            return { ...prev, [idToUse]: messages };
                        });
                        
                        await new Promise(r => setTimeout(r, 5));
                    }
                }

            if (!isTemporary) {
                try {
                    const aiMsgObj = {
                        id: crypto.randomUUID(),
                        chat_id: idToUse,
                        user_id: session.user.id,
                        role: 'assistant',
                        content: aiRawText,
                        mode: 'ceova',
                        attachments: currentCloudProject ? [{ type: 'cloud_project', data: currentCloudProject }] : [],
                        created_at: new Date().toISOString()
                    };
                    
                    await cacheManager.setMessage(aiMsgObj);
                    await supabase.from('messages').insert(aiMsgObj);
                } catch (dbErr) {
                    console.error("Local Persistence Error (AI Msg):", dbErr);
                }

                // Dynamic AI Title Generation using gpt-4o-mini (Turn 1 & Turn 2)
                if (!isTemporary && !localStorage.getItem('user_renamed_' + idToUse)) {
                    if (initialMessageCount === 0) {
                        // Turn 1: Generate clean 3-4 word title right after 1st chat exchange
                        generateChatTitle([
                            { role: 'user', content: text },
                            { role: 'assistant', content: aiRawText }
                        ], session?.access_token, userMemories).then(async (newTitle) => {
                            if (newTitle && newTitle !== 'New Chat') {
                                await supabase.from('chats').update({ title: newTitle }).eq('id', idToUse);
                                const cached = await cacheManager.getChat(idToUse);
                                if (cached) await cacheManager.setChat({ ...cached, title: newTitle });
                                setChatMetadata(prev => ({
                                    ...prev,
                                    [idToUse]: { ...(prev[idToUse] || {}), title: newTitle }
                                }));
                            }
                        }).catch(console.error);
                    } else if (initialMessageCount <= 3 && !sessionStorage.getItem('ai_titled_final_' + idToUse)) {
                        // Turn 2: Finalize 3-4 word title with full 2-turn conversation context
                        const firstTurns = [
                            ...(currentMessages.filter(m => !m.isTitleFallback).slice(0, 2).map(m => ({
                                role: m.sender === 'user' ? 'user' : 'assistant',
                                content: m.text
                            }))),
                            { role: 'user', content: text },
                            { role: 'assistant', content: aiRawText }
                        ];
                        generateChatTitle(firstTurns, session?.access_token, userMemories).then(async (finalTitle) => {
                            if (finalTitle && finalTitle !== 'New Chat') {
                                await supabase.from('chats').update({ title: finalTitle }).eq('id', idToUse);
                                const cached = await cacheManager.getChat(idToUse);
                                if (cached) await cacheManager.setChat({ ...cached, title: finalTitle });
                                setChatMetadata(prev => ({
                                    ...prev,
                                    [idToUse]: { ...(prev[idToUse] || {}), title: finalTitle }
                                }));
                            }
                            sessionStorage.setItem('ai_titled_final_' + idToUse, 'true');
                        }).catch(console.error);
                    }
                }
            }

            const now = new Date().toISOString();
            setChats(prev => {
                const messages = [...(prev[idToUse] || [])];
                const aiIdx = messages.findIndex(m => m.tempId === tempId);
                if (aiIdx !== -1) {
                    messages[aiIdx] = { ...messages[aiIdx], isLive: false, time: now };
                }
                return { ...prev, [idToUse]: messages };
            });
            
            if (typeof autoFollowUpText === 'string') {
                setTimeout(() => handleSend([], autoFollowUpText, true), 50);
            }
            
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error("Send Error:", error);
                    
                    const errorMessage = error?.message || error?.toString() || 'Unknown error';
                    const isTokenLimit = errorMessage.toLowerCase().includes('token limit reached');
                    
                    let displayError = errorMessage;
                    if (errorMessage === "Load failed" || errorMessage === "Failed to fetch") {
                        displayError = "Network error: Could not connect to the AI server. Please try again.";
                    }
                    
                    setChats(prev => {
                        const messages = [...(prev[idToUse] || [])];
                        const aiIdx = messages.findIndex(m => m.tempId === tempId);
                        
                        if (aiIdx !== -1) {
                            if (isTokenLimit) {
                                const funnyMessages = [
                                    "I'm out of breath for today! Upgrade your plan to keep talking, or I'll see you tomorrow.",
                                    "My talk-o-meter hit zero! Upgrade now to add more fuel, or we can chat again tomorrow.",
                                    "You used up all my words for today! Upgrade your plan to buy me more, or wait until tomorrow.",
                                    "My daily battery is dead. 🔋 Upgrade your plan to plug me in, or come back tomorrow!"
                                ];
                                const randomMsg = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];
                                const fullMsg = `${randomMsg}\n\n[Check your usage & upgrade plan](/subscription)`;
                                
                                const newMsgId = crypto.randomUUID();
                                const timeNow = new Date().toISOString();
                                
                                messages[aiIdx] = { 
                                ...messages[aiIdx], 
                                id: newMsgId,
                                isLive: true, 
                                isTyping: true, 
                                toolStatus: null,
                                text: fullMsg,
                                time: timeNow
                            };
                            
                            // Save this message to DB and cache so it persists
                            const aiMsgObj = {
                                id: newMsgId,
                                chat_id: idToUse,
                                user_id: session?.user?.id,
                                role: 'assistant',
                                content: fullMsg,
                                mode: 'ceova',
                                created_at: timeNow
                            };
                            cacheManager.setMessage(aiMsgObj).catch(console.error);
                            if (!isTemporary) {
                                supabase.from('messages').insert(aiMsgObj).then(({ error }) => {
                                    if (error) console.error("Error saving fallback message:", error);
                                });
                            }
                            
                            // Turn off typing animation after a short delay so cursor stops blinking
                            setTimeout(() => {
                                setChats(prev => {
                                    const latest = [...(prev[idToUse] || [])];
                                    const updateIdx = latest.findIndex(m => m.id === newMsgId);
                                    if (updateIdx !== -1) {
                                        latest[updateIdx] = { ...latest[updateIdx], isLive: false, isTyping: false };
                                    }
                                    return { ...prev, [idToUse]: latest };
                                });
                            }, 1500);
                            
                        } else if (messages[aiIdx].isTyping) {
                            // Do not delete the message; preserve it and show an error state so nothing disappears
                            messages[aiIdx] = {
                                ...messages[aiIdx],
                                isTyping: false,
                                isLive: false,
                                toolStatus: null,
                                text: messages[aiIdx].text || displayError || "Connection interrupted. Please try again."
                            };
                        }
                    }
                    return { ...prev, [idToUse]: messages };
                });
                
                if (!isTokenLimit) {
                    // Debug: Show detailed error to help diagnose "Load failed"
                    const errorStr = (error?.stack && !error.stack.includes(displayError)) 
                        ? `${displayError}\n${error.stack}` 
                        : (error?.stack || displayError);
                    showToast(displayError.substring(0, 150), 'error');
                }
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsLoading(false);
            
            setChats(prev => {
                const messages = [...(prev[currentChatId] || [])];
                const activeIdx = messages.findIndex(m => m.isLive);
                if (activeIdx !== -1) {
                    messages[activeIdx] = { ...messages[activeIdx], isLive: false, isTyping: false };
                }
                return { ...prev, [currentChatId]: messages };
            });
        }
    };

    const switchChat = async (id) => {
        setCurrentChatId(id);
        setEditingMessage(null);
        setInput("");
        sessionStorage.setItem(CURRENT_CHAT_KEY, id);
        if (isMobile) setIsSidebarOpen(false);

        if (id && !id.startsWith('temp_') && (!chats[id] || chats[id].length === 0)) {
            try {
                const { data: chatMsgs } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('chat_id', id)
                    .order('created_at', { ascending: true });

                if (chatMsgs && chatMsgs.length > 0) {
                    const sortedChatMsgs = sortMessagesChronologically(chatMsgs);
                    const formatted = sortedChatMsgs.map(msg => {
                        const cloudProjectAttachment = msg.attachments?.find?.((a) => a.type === 'cloud_project');
                        return {
                            id: msg.id,
                            sender: msg.role === 'user' ? 'user' : 'ai',
                            text: msg.content,
                            time: msg.created_at,
                            mode: msg.mode,
                            attachments: msg.attachments || [],
                            cloudProject: cloudProjectAttachment ? cloudProjectAttachment.data : null
                        };
                    });
                    setChats(prev => ({ ...prev, [id]: formatted }));
                }
            } catch (e) {
                console.error("Error switching chat:", e);
            }
        }
    };

    const createNewChat = (specificId = null, skipSwitch = false) => {
        setGreetingIndex(prev => (prev + 1) % 10);
        // ensure specificId is a string, not an event object if called from onClick
        const idToUse = (typeof specificId === 'string' && specificId) ? specificId : crypto.randomUUID();
        setChats(prev => ({ ...prev, [idToUse]: prev[idToUse] || [] }));
        if (!skipSwitch) {
            switchChat(idToUse);
            if (!specificId || typeof specificId !== 'string') {
                sessionStorage.removeItem(CURRENT_CHAT_KEY);
                localStorage.removeItem(CURRENT_CHAT_KEY);
            }
        }
    };

    const createTemporaryChat = () => {
        const newId = `temp_${crypto.randomUUID()}`;
        setChats(prev => ({ ...prev, [newId]: [] }));
        setTemporaryChatId(newId);
        switchChat(newId);
    };

    const deleteChat = async (id) => {
        if (!id) return;

        // 1. Optimistically update UI immediately so sidebar updates seamlessly
        setChats(prev => {
            const newChats = { ...prev };
            delete newChats[id];
            return newChats;
        });
        
        setChatMetadata(prev => {
            const newMeta = { ...prev };
            delete newMeta[id];
            return newMeta;
        });

        // 2. Clear IndexedDB cache
        try {
            await cacheManager.deleteChat(id);
        } catch (e) {
            console.warn("Failed to delete chat from cache:", e);
        }

        // 3. If currently viewing the deleted chat, switch to another chat or create a new one
        if (currentChatId === id) {
            const remaining = Object.keys(chats).filter(k => k !== id && !k.startsWith('temp_'));
            if (remaining.length > 0) {
                switchChat(remaining[0]);
            } else {
                createNewChat();
            }
        }

        // 4. Temporary chats exist only locally
        if (id.startsWith('temp_')) {
            showToast("Chat deleted", "success");
            return;
        }

        // 5. Delete from Supabase backend
        try {
            // Delete messages first to satisfy any foreign key constraints
            const { error: msgErr } = await supabase
                .from('messages')
                .delete()
                .eq('chat_id', id);

            if (msgErr) {
                console.warn("Notice deleting messages for chat:", msgErr);
            }

            // Delete chat metadata row
            const { error: chatErr } = await supabase
                .from('chats')
                .delete()
                .eq('id', id);

            if (chatErr) {
                console.warn("Notice deleting chat record:", chatErr);
            }

            showToast("Chat deleted", "success");
        } catch (e) {
            console.error("Failed to delete chat from server:", e);
            // Even if server request had an issue, local chat is already cleared
            showToast("Chat deleted", "success");
        }
    };

    const handleBulkDelete = async () => {
        try {
            if (session?.user?.id) {
                await supabase.from('messages').delete().eq('user_id', session.user.id);
                await supabase.from('chats').delete().eq('user_id', session.user.id);
            }
            try {
                await supabase.rpc('force_bulk_delete_chats');
            } catch (e) {}
            
            try { await cacheManager.clearChats(); } catch(e) {}
            
            setChats({});
            setChatMetadata({});
            createNewChat();
            setIsSettingsOpen(false);
            showToast("All chats deleted", "success");
        } catch (e) {
            console.error("Failed to bulk delete", e);
            setChats({});
            setChatMetadata({});
            createNewChat();
            setIsSettingsOpen(false);
            showToast("All chats deleted", "success");
        }
    };

    const handleBulkArchive = async () => {
        try {
            await supabase.from('chats').update({ is_archived: true }).eq('user_id', session.user.id);
            setChatMetadata(prev => {
                const newMeta = { ...prev };
                for (const key in newMeta) {
                    newMeta[key].is_archived = true;
                }
                return newMeta;
            });
            createNewChat();
            setIsSettingsOpen(false);
            showToast("All chats archived", "success");
        } catch (e) {
            console.error("Failed to bulk archive", e);
            showToast("Failed to archive all chats", "error");
        }
    };

    const togglePinChat = async (id, isPinned) => {
        const newStatus = !isPinned;
        try {
            const { error: pinErr } = await supabase.from('chats').upsert({
                id: id,
                user_id: session.user.id,
                is_pinned: newStatus
            });
            if (pinErr) throw pinErr;

            setChatMetadata(prev => ({
                ...prev,
                [id]: { ...(prev[id] || {}), is_pinned: newStatus }
            }));

            try {
                const cached = await cacheManager.getChat(id);
                if (cached) {
                    await cacheManager.setChat({ ...cached, is_pinned: newStatus });
                }
            } catch (e) {}

            showToast(newStatus ? "Chat pinned" : "Chat unpinned", "success");
        } catch (e) {
            console.error("Pin error", e);
            showToast("Failed to update pin", "error");
        }
    };

    const renameChat = async (id, newTitle) => {
        if (!id || !newTitle || !newTitle.trim()) return;
        const trimmedTitle = newTitle.trim();
        localStorage.setItem('user_renamed_' + id, 'true');
        sessionStorage.setItem('ai_titled_' + id, 'true');
        try {
            const { error: metaErr } = await supabase.from('chats').upsert({
                id: id,
                user_id: session.user.id,
                title: trimmedTitle
            });
            if (metaErr) throw metaErr;

            setChatMetadata(prev => ({
                ...prev,
                [id]: { ...(prev[id] || {}), title: trimmedTitle }
            }));

            try {
                const cached = await cacheManager.getChat(id);
                if (cached) {
                    await cacheManager.setChat({ ...cached, title: trimmedTitle });
                }
            } catch (e) {}

            showToast("Chat renamed", "success");
        } catch (e) {
            console.error("Rename error", e);
            showToast("Failed to rename chat", "error");
        }
    };

    if (!session) return <Login />;

    return (
        <div className={`app-container ${isSidebarOpen ? 'is-sidebar-open' : ''}`}>
            <AnimatePresence>
                {toast && (
                    <motion.div
                        key="app-toast"
                        initial={{ opacity: 0, y: -24, x: '-50%', scale: 0.94, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, y: 0, x: '-50%', scale: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -16, x: '-50%', scale: 0.96, filter: 'blur(4px)' }}
                        transition={{ type: "spring", stiffness: 450, damping: 30 }}
                        className={`share-toast ${toast.type || 'success'}`}
                        onClick={() => setToast(null)}
                    >
                        <div className={`toast-icon-badge ${toast.type || 'success'}`}>
                            {toast.type === 'error' ? (
                                <AlertCircle size={14} strokeWidth={2.4} />
                            ) : toast.type === 'warning' ? (
                                <AlertTriangle size={14} strokeWidth={2.4} />
                            ) : toast.type === 'info' ? (
                                <Info size={14} strokeWidth={2.4} />
                            ) : (
                                <CheckCircle2 size={14} strokeWidth={2.4} />
                            )}
                        </div>
                        <span className="toast-message">{toast.message}</span>
                        <button 
                            type="button" 
                            className="toast-close-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                setToast(null);
                            }}
                            title="Dismiss"
                        >
                            <X size={12} strokeWidth={2.2} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
            
            <motion.div
                initial={false}
                animate={{ width: isSidebarOpen ? 320 : 68 }}
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                onAnimationStart={() => setIsSidebarAnimating(true)}
                onAnimationComplete={() => setIsSidebarAnimating(false)}
                className="sidebar-wrapper"
                style={{ overflow: isSidebarOpen || isSidebarAnimating ? 'hidden' : 'visible' }}
            >
                <Sidebar 
                    chats={chats}
                    chatMetadata={chatMetadata}
                    currentChatId={currentChatId}
                    temporaryChatId={temporaryChatId}
                    switchChat={switchChat}
                    createNewChat={createNewChat}
                    createTemporaryChat={createTemporaryChat}
                    onToggleSettings={() => setIsSettingsOpen(true)}
                    onOpenSearch={() => setIsSearchModalOpen(true)}
                    onOpenLibrary={() => { setIsLibraryOpen(true); if (window.innerWidth <= 768) setIsSidebarOpen(false); }}
                    togglePinChat={togglePinChat}
                    deleteChat={deleteChat}
                    renameChat={renameChat}
                    userEmail={session?.user?.email}
                    userMetadata={session?.user?.user_metadata}
                    isSidebarOpen={isSidebarOpen}
                    setSidebarOpen={setIsSidebarOpen}
                    onLogout={() => supabase.auth.signOut()}
                />
            </motion.div>

            <main className={`main-content ${(chats[currentChatId] || []).length === 0 ? 'is-home-view' : ''}`}>
                {inGracePeriod && (
                    <div className="grace-period-banner" style={{ 
                        background: 'rgba(239, 68, 68, 0.1)', 
                        borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#ef4444', 
                        padding: '12px 20px', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        zIndex: 100,
                        fontSize: '14px'
                    }}>
                        <span>Your renewal payment failed. Please update your payment method within 24 hours to continue using Flow.</span>
                        <button onClick={handleRetryPayment} disabled={isRetryingPayment} style={{ 
                            background: '#ef4444', 
                            color: 'white', 
                            border: 'none', 
                            padding: '6px 12px', 
                            borderRadius: '4px', 
                            cursor: 'pointer', 
                            fontWeight: '500',
                            opacity: isRetryingPayment ? 0.7 : 1
                        }}>
                            {isRetryingPayment ? 'Loading...' : 'Retry Payment'}
                        </button>
                    </div>
                )}
                
                <header className="mobile-header">
                    <button className="mobile-header-btn" onClick={() => setIsSidebarOpen(true)}>
                        <Menu size={24} />
                    </button>
                    <div className="mobile-header-title"></div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button 
                            className={`mobile-header-btn ${currentChatId?.startsWith('temp_') ? 'active-temp' : ''}`} 
                            onClick={() => currentChatId?.startsWith('temp_') ? createNewChat() : createTemporaryChat()}
                        >
                            {currentChatId?.startsWith('temp_') ? <CheckCircle2 size={22} /> : <MessageCircleDashed size={22} />}
                        </button>
                        <button className="mobile-header-btn" onClick={createNewChat}>
                            <Edit size={22} />
                        </button>
                    </div>
                </header>

                <div className="desktop-temp-chat-toggle">
                    <button 
                        className={`desktop-temp-btn ceova-tooltip-container ${currentChatId?.startsWith('temp_') ? 'active' : ''}`}
                        onClick={() => currentChatId?.startsWith('temp_') ? createNewChat() : createTemporaryChat()}
                    >
                        {currentChatId?.startsWith('temp_') ? <CheckCircle2 size={24} /> : <MessageCircleDashed size={24} />}
                        <div className="ceova-tooltip ceova-tooltip-bottom-right">Temporary Chat</div>
                    </button>
                </div>

            <div className="main-chat-container">

            
                <Chat 
                    messages={chats[currentChatId] || []}
                    isLoading={isLoading} 
                    onSuggestionClick={(text) => handleSend([], text)}
                    localDirectoryHandle={localDirectoryHandle}
                    setLocalDirectoryHandle={setLocalDirectoryHandle}
                    onEditRequest={(msg) => {
                        setInput(msg.text);
                        const currentMessages = chats[currentChatId] || [];
                        const msgIndex = currentMessages.findIndex(m => m.id === msg.id || m.tempId === msg.tempId);
                        if (msgIndex !== -1) {
                            setEditingMessage({
                                chatId: currentChatId,
                                index: msgIndex
                            });
                        }
                    }}
                    onFolderConnected={async (folderHandle) => {
                        // If there are pending file writes queued up before folder was selected, flush them now
                        if (pendingFileWritesRef.current) {
                            const { filesList, fileNames } = pendingFileWritesRef.current;
                            pendingFileWritesRef.current = null;
                            try {
                                const isTauri = typeof folderHandle === 'string';
                                if (isTauri) {
                                    const { writeTextFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');
                                    const { join, dirname } = await import('@tauri-apps/api/path');
                                    for (const file of filesList) {
                                        const targetPath = file.path || file.filename || file.file || 'file.txt';
                                        const filePath = await join(folderHandle, targetPath);
                                        const dirPath = await dirname(filePath);
                                        if (!(await exists(dirPath))) {
                                            await mkdir(dirPath, { recursive: true });
                                        }
                                        await writeTextFile(filePath, file.content || '');
                                    }
                                } else {
                                    for (const file of filesList) {
                                        const targetPath = file.path || file.filename || file.file || 'file.txt';
                                        const fileHandle = await folderHandle.getFileHandle(targetPath, { create: true });
                                        const writable = await fileHandle.createWritable();
                                        await writable.write(file.content || '');
                                        await writable.close();
                                    }
                                }
                                // Notify user files were written
                                handleSend([], `✅ Folder connected! Successfully wrote ${filesList.length} file(s): ${fileNames}. Please summarize what was created.`);
                            } catch (err) {
                                console.error('Error flushing pending writes:', err);
                            }
                        }
                    }}
                />

                {(chats[currentChatId] || []).length === 0 && (
                    <div className="home-empty-state-wrapper">
                        <div className="home-greeting">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentChatId?.startsWith('temp_') ? 'temp' : 'normal'}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                >
                                        {currentChatId?.startsWith('temp_') ? (
                                            <>
                                                <h2>Temporary Chat</h2>
                                                <p>This chat won't appear in history or be used to train our models. For safety purposes, we may keep a copy of this chat for up to 30 days.</p>
                                            </>
                                        ) : (
                                            <h2>
                                                {(() => {
                                                    const timePeriod = getTimePeriod();
                                                    const userName = getGreetingName(session, userMemories);
                                                    return getGreetingHeadline(timePeriod, greetingIndex, userName);
                                                })()}
                                            </h2>
                                        )}
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </div>
                    )}

                    <AnimatePresence>
                        {pendingCommand && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="mx-auto w-full max-w-3xl px-4 mb-4"
                            >
                                <div className="p-4 border rounded-xl bg-gray-900 border-gray-700 shadow-lg">
                                    <p className="text-sm text-gray-300 mb-2 flex items-center gap-2">
                                        <Zap size={16} className="text-yellow-500" />
                                        Ceova wants to run a terminal command:
                                    </p>
                                    <pre className="bg-black p-3 rounded-lg text-green-400 text-sm overflow-x-auto font-mono border border-gray-800">
                                        $ {pendingCommand.cmd}
                                    </pre>
                                    <div className="flex gap-3 mt-4">
                                        <button 
                                            onClick={() => { pendingCommand.resolve('once'); setPendingCommand(null); }} 
                                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 transition-colors rounded-lg text-sm font-medium text-white"
                                        >
                                            Allow Once
                                        </button>
                                        <button 
                                            onClick={() => { pendingCommand.resolve('always'); setPendingCommand(null); }} 
                                            className="px-4 py-1.5 bg-green-600 hover:bg-green-500 transition-colors rounded-lg text-sm font-medium text-white"
                                        >
                                            Allow Always
                                        </button>
                                        <button 
                                            onClick={() => { pendingCommand.resolve('deny'); setPendingCommand(null); }} 
                                            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 transition-colors rounded-lg text-sm font-medium text-white ml-auto"
                                        >
                                            Deny
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <InputBox 
                        input={input}
                        setInput={setInput}
                        handleSend={handleSend}
                        isLoading={isLoading}
                        handleStop={handleStop}
                        isHome={(chats[currentChatId] || []).length === 0}
                        localDirectoryHandle={localDirectoryHandle}
                        setLocalDirectoryHandle={setLocalDirectoryHandle}
                        onOpenLibrary={() => { setIsLibraryOpen(true); if (window.innerWidth <= 768) setIsSidebarOpen(false); }}
                        session={session}
                    />

                </div>
                <SearchModal 
                    isOpen={isSearchModalOpen}
                    onClose={() => setIsSearchModalOpen(false)}
                    chats={chats}
                    chatMetadata={chatMetadata}
                    switchChat={switchChat}
                    currentChatId={currentChatId}
                />
            </main>

            <AnimatePresence>
                {isSettingsOpen && (
                    <SettingsModal 
                        isOpen={isSettingsOpen} 
                        onClose={() => setIsSettingsOpen(false)} 
                        session={session}
                        userEmail={session?.user?.email}
                        userId={session?.user?.id}
                        onOpenPhoneModal={() => setIsPhoneModalOpen(true)}
                        onLogout={() => supabase.auth.signOut()}
                        onBulkDelete={handleBulkDelete}
                        onBulkArchive={handleBulkArchive}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isPhoneModalOpen && (
                    <PhoneLinkModal 
                        isOpen={isPhoneModalOpen}
                        onClose={() => {
                            setIsPhoneModalOpen(false);
                            sessionStorage.setItem('ceova_phone_prompt_dismissed', 'true');
                        }}
                        initialPhone={session?.user?.phone || ''}
                        userEmail={session?.user?.email || ''}
                        userId={session?.user?.id || ''}
                        onSuccess={(verifiedPhone) => {
                            showToast(`Phone number linked successfully! (${verifiedPhone})`, 'success');
                            setIsPhoneModalOpen(false);
                            sessionStorage.setItem('ceova_phone_prompt_dismissed', 'true');
                        }}
                        onDisconnect={() => {
                            showToast('Phone number disconnected successfully.', 'info');
                            setIsPhoneModalOpen(false);
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Library Overlay */}
            <AnimatePresence>
                {isLibraryOpen && (
                    <motion.div
                        key="library-overlay"
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 40 }}
                        transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 1200,
                            background: 'var(--bg-main)',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        <Library
                            session={session}
                            onBack={() => setIsLibraryOpen(false)}
                            switchChat={switchChat}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
