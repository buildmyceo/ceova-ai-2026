import React, { useState, useEffect, useRef } from 'react';
import { 
    Plus, 
    Globe, 
    Mic, 
    ArrowUp, 
    Square, 
    Maximize2, 
    RotateCcw, 
    X, 
    Pin, 
    PinOff, 
    Sparkles, 
    Copy, 
    Check 
} from 'lucide-react';
import { supabase, SUPABASE_URL, SUPABASE_KEY } from '../services/supabase';
import { getGreetingName } from '../constants/greetings';
import './QuickBar.css';

// Lightweight, safe markdown formatter for companion window
function renderQuickMarkdown(text) {
    if (!text) return '';

    const codeBlocks = [];
    let processed = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        const escaped = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        const langLabel = lang ? `<span class="quick-code-lang">${lang}</span>` : '';
        const blockId = `cb_${codeBlocks.length}`;
        codeBlocks.push(
            `<div class="quick-code-block">
                <div class="quick-code-header">
                    ${langLabel}
                    <button class="quick-code-copy" onclick="(function(btn){const code=btn.closest('.quick-code-block').querySelector('code');navigator.clipboard.writeText(code.innerText);btn.textContent='Copied!';setTimeout(()=>btn.textContent='Copy',2000);})(this)">Copy</button>
                </div>
                <pre><code>${escaped}</code></pre>
            </div>`
        );
        return `%%CODE_BLOCK_${blockId}%%`;
    });

    processed = processed
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    processed = processed
        .replace(/`([^`]+)`/g, '<code class="quick-inline-code">$1</code>')
        .replace(/^### (.+)$/gm, '<h3 class="quick-h3">$1</h3>')
        .replace(/^## (.+)$/gm, '<h2 class="quick-h2">$1</h2>')
        .replace(/^# (.+)$/gm, '<h1 class="quick-h1">$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
        .replace(/^[\*\-] (.+)$/gm, '<li class="quick-li">$1</li>')
        .replace(/(<li[^>]*>.*<\/li>\n?)+/g, (match) => `<ul class="quick-ul">${match}</ul>`)
        .replace(/^\d+\. (.+)$/gm, '<li class="quick-li">$1</li>')
        .replace(/^---$/gm, '<hr class="quick-hr" />')
        .replace(/\n\n/g, '</p><p class="quick-p">')
        .replace(/\n/g, '<br />')
        .replace(/(?!!)\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText, rawUrl) => {
            return `<a href="${rawUrl}" target="_blank" rel="noopener noreferrer" class="quick-link">${linkText}</a>`;
        });

    codeBlocks.forEach((block, i) => {
        processed = processed.replace(`%%CODE_BLOCK_cb_${i}%%`, block);
    });

    return `<div class="quick-md-content">${processed}</div>`;
}

export default function QuickBar() {
    const [text, setText] = useState('');
    const [messages, setMessages] = useState([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [statusText, setStatusText] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
    const [session, setSession] = useState(null);
    const [userName, setUserName] = useState('');

    const textareaRef = useRef(null);
    const recognitionRef = useRef(null);
    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);

    // 1. Fetch user session and personalized name
    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            const currentSession = data?.session || null;
            setSession(currentSession);
            if (currentSession) {
                const name = getGreetingName(currentSession);
                if (name) setUserName(name);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
            setSession(sess || null);
            if (sess) {
                const name = getGreetingName(sess);
                if (name) setUserName(name);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // 2. Auto-focus input on mount and on window focus
    useEffect(() => {
        const focusInput = () => {
            if (textareaRef.current) {
                textareaRef.current.focus();
            }
        };

        focusInput();
        window.addEventListener('focus', focusInput);
        return () => window.removeEventListener('focus', focusInput);
    }, []);

    // 3. Scroll to bottom whenever messages update
    useEffect(() => {
        if (messages.length > 0 && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, statusText]);

    // 4. Speech Recognition setup
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map(r => r[0].transcript)
                    .join('');
                setText(transcript);
            };

            recognition.onend = () => setIsListening(false);
            recognition.onerror = () => setIsListening(false);
            recognitionRef.current = recognition;
        }
    }, []);

    const toggleSpeech = () => {
        if (!recognitionRef.current) return;
        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch (err) {
                console.error("Speech Recognition Error:", err);
            }
        }
    };

    // 5. Submit prompt and stream AI response directly in the companion popup
    const handleSend = async () => {
        const trimmed = text.trim();
        if (!trimmed || isStreaming) return;

        const userMsg = {
            id: 'u_' + Date.now(),
            role: 'user',
            content: trimmed
        };

        const aiMsgId = 'a_' + Date.now();
        const placeholderAiMsg = {
            id: aiMsgId,
            role: 'assistant',
            content: '',
            isStreaming: true
        };

        const updatedMessages = [...messages, userMsg, placeholderAiMsg];
        setMessages(updatedMessages);
        setText('');
        setIsStreaming(true);
        setStatusText("Thinking...");

        // Auto-resize textarea back to normal
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        abortControllerRef.current = new AbortController();

        try {
            const token = session?.access_token || SUPABASE_KEY;
            const historyForAI = messages.map(m => ({
                role: m.role,
                content: m.content
            }));

            const response = await fetch(`${SUPABASE_URL}/functions/v1/super-endpoint`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: trimmed,
                    history: historyForAI,
                    user_context: {
                        date: new Date().toLocaleDateString(),
                        time: new Date().toLocaleTimeString(),
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        dayOfWeek: new Date().toLocaleDateString(undefined, { weekday: 'long' })
                    }
                }),
                signal: abortControllerRef.current.signal
            });

            if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                throw new Error(errJson.error || `Server error: ${response.status}`);
            }

            if (response.headers.get('content-type')?.includes('text/event-stream')) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let accumulatedAiText = '';

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
                                if (parsed.type === 'text') {
                                    accumulatedAiText += parsed.content;
                                    setStatusText(null);
                                    setMessages(prev => prev.map(m => 
                                        m.id === aiMsgId ? { ...m, content: accumulatedAiText } : m
                                    ));
                                } else if (parsed.type === 'status') {
                                    setStatusText(parsed.stage || "Thinking...");
                                } else if (parsed.type === 'error') {
                                    accumulatedAiText += `\n\n**Error:** ${parsed.error}`;
                                    setMessages(prev => prev.map(m => 
                                        m.id === aiMsgId ? { ...m, content: accumulatedAiText } : m
                                    ));
                                }
                            } catch (e) {
                                // Ignore json parse errors for incomplete chunks
                            }
                        }
                    }
                }
            } else {
                const json = await response.json();
                const reply = json.reply || json.text || json.content || "Done.";
                setMessages(prev => prev.map(m => 
                    m.id === aiMsgId ? { ...m, content: reply } : m
                ));
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("Companion streaming error:", err);
                setMessages(prev => prev.map(m => 
                    m.id === aiMsgId ? { ...m, content: `Error: ${err.message || 'Unable to connect to CEOVA.'}` } : m
                ));
            }
        } finally {
            setIsStreaming(false);
            setStatusText(null);
            setMessages(prev => prev.map(m => 
                m.id === aiMsgId ? { ...m, isStreaming: false } : m
            ));
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setIsStreaming(false);
        setStatusText(null);
    };

    const handleNewChat = () => {
        if (isStreaming) {
            handleStop();
        }
        setMessages([]);
        setStatusText(null);
        setText('');
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleHideWindow();
        }
    };

    const handleHideWindow = async () => {
        try {
            const isTauri = typeof window !== 'undefined' && (
                window.__TAURI__ !== undefined ||
                window.__TAURI_INTERNALS__ !== undefined
            );
            if (isTauri) {
                const { invoke } = await import('@tauri-apps/api/core');
                await invoke('hide_quickbar');
            }
        } catch (err) {
            console.error("Hide window error:", err);
        }
    };

    const handleOpenMain = async () => {
        try {
            const isTauri = typeof window !== 'undefined' && (
                window.__TAURI__ !== undefined ||
                window.__TAURI_INTERNALS__ !== undefined
            );
            if (isTauri) {
                const { invoke } = await import('@tauri-apps/api/core');
                await invoke('open_main_window_with_prompt', { prompt: text.trim() || null });
            }
        } catch (err) {
            console.error("Open main error:", err);
        }
    };

    const handleTogglePin = async () => {
        const nextPinned = !isPinned;
        setIsPinned(nextPinned);
        try {
            const isTauri = typeof window !== 'undefined' && (
                window.__TAURI__ !== undefined ||
                window.__TAURI_INTERNALS__ !== undefined
            );
            if (isTauri) {
                const { invoke } = await import('@tauri-apps/api/core');
                await invoke('set_quickbar_pinned', { pinned: nextPinned });
            }
        } catch (err) {
            console.error("Toggle pin error:", err);
        }
    };

    const handleTextChange = (e) => {
        setText(e.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
    };

    // Greeting text format matching screenshot: "Hi Harshit. What are we working on today?"
    const greetingHeadline = userName 
        ? `Hi ${userName}. What are we working on today?`
        : `Hi there. What are we working on today?`;

    return (
        <div className="quickbar-page-root">
            <div className="quickbar-window-container">
                {/* Header with macOS drag region and companion window actions */}
                <div className="quickbar-header" data-tauri-drag-region>
                    <div className="quickbar-brand" data-tauri-drag-region>
                        <div className="quickbar-brand-icon">
                            <Sparkles size={14} />
                        </div>
                        <span className="quickbar-brand-name">CEOVA</span>
                    </div>

                    <div className="quickbar-actions">
                        <button
                            type="button"
                            className={`quickbar-action-btn ${isPinned ? 'pinned' : ''}`}
                            title={isPinned ? "Unpin window (currently stays open on click outside)" : "Pin window to keep open"}
                            onClick={handleTogglePin}
                        >
                            {isPinned ? <Pin size={13} /> : <PinOff size={13} />}
                        </button>
                        <button
                            type="button"
                            className="quickbar-action-btn"
                            title="New Chat (Clear)"
                            onClick={handleNewChat}
                        >
                            <RotateCcw size={13} />
                        </button>
                        <button
                            type="button"
                            className="quickbar-action-btn"
                            title="Open in CEOVA (Full Window)"
                            onClick={handleOpenMain}
                        >
                            <Maximize2 size={13} />
                        </button>
                        <button
                            type="button"
                            className="quickbar-action-btn close"
                            title="Close (Esc)"
                            onClick={handleHideWindow}
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {/* Conversation area: greeting when empty, scrollable messages when chatting */}
                <div className="quickbar-body">
                    {messages.length === 0 ? (
                        <div className="quickbar-greeting-container">
                            <h2 className="quickbar-greeting-text">{greetingHeadline}</h2>
                        </div>
                    ) : (
                        <div className="quickbar-messages-list">
                            {messages.map((msg) => (
                                <div 
                                    key={msg.id} 
                                    className={`quickbar-msg-row ${msg.role === 'user' ? 'user' : 'assistant'}`}
                                >
                                    {msg.role === 'user' ? (
                                        <div className="quickbar-user-bubble">
                                            {msg.content}
                                        </div>
                                    ) : (
                                        <div className="quickbar-ai-container">
                                            <div className="quickbar-ai-avatar">
                                                <Sparkles size={13} />
                                            </div>
                                            <div className="quickbar-ai-body">
                                                <div 
                                                    className="quickbar-ai-markdown"
                                                    dangerouslySetInnerHTML={{ 
                                                        __html: renderQuickMarkdown(msg.content) 
                                                    }}
                                                />
                                                {msg.isStreaming && (
                                                    <span className="quickbar-typing-cursor">▋</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Tool / Thinking status indicator */}
                            {statusText && (
                                <div className="quickbar-status-indicator">
                                    <Sparkles size={12} className="spin-slow" />
                                    <span>{statusText}</span>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* Bottom Input Capsule matching ChatGPT for Mac screenshot */}
                <div className="quickbar-input-capsule">
                    <div className="quickbar-textarea-wrapper">
                        <textarea
                            ref={textareaRef}
                            className="quickbar-textarea"
                            placeholder="Ask anything"
                            value={text}
                            rows={1}
                            onChange={handleTextChange}
                            onKeyDown={handleKeyDown}
                        />
                    </div>

                    <div className="quickbar-bottom-row">
                        <div className="quickbar-bottom-left">
                            <button
                                type="button"
                                className="quickbar-tool-btn"
                                title="Attach or open full studio"
                                onClick={handleOpenMain}
                            >
                                <Plus size={16} />
                            </button>
                            <div className="quickbar-model-badge" title="CEOVA 5.6 Luna active">
                                <Globe size={13} style={{ opacity: 0.85 }} />
                                <span>5.6 Luna</span>
                            </div>
                        </div>

                        <div className="quickbar-bottom-right">
                            <button
                                type="button"
                                className={`quickbar-tool-btn ${isListening ? 'listening' : ''}`}
                                title={isListening ? "Listening..." : "Voice input"}
                                onClick={toggleSpeech}
                            >
                                <Mic size={15} />
                            </button>

                            {isStreaming ? (
                                <button
                                    type="button"
                                    className="quickbar-submit-btn streaming"
                                    title="Stop generating"
                                    onClick={handleStop}
                                >
                                    <Square size={13} fill="#ffffff" stroke="none" />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className={`quickbar-submit-btn ${text.trim() ? 'active' : ''}`}
                                    title="Send prompt (Enter)"
                                    disabled={!text.trim()}
                                    onClick={handleSend}
                                >
                                    <ArrowUp size={16} strokeWidth={2.8} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
