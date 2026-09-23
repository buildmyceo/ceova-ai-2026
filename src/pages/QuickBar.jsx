import React, { useState, useEffect, useRef } from 'react';
import { Plus, Globe, Mic, ArrowUp } from 'lucide-react';
import './QuickBar.css';

export default function QuickBar() {
    const [text, setText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const textareaRef = useRef(null);
    const recognitionRef = useRef(null);

    // Auto-focus input on mount and on window focus
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

    // Speech Recognition setup
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

    const handleSubmit = async () => {
        const trimmed = text.trim();
        if (!trimmed) return;

        try {
            const isTauri = typeof window !== 'undefined' && (
                window.__TAURI__ !== undefined ||
                window.__TAURI_INTERNALS__ !== undefined
            );

            if (isTauri) {
                const { invoke } = await import('@tauri-apps/api/core');
                await invoke('open_main_window_with_prompt', { prompt: trimmed });
            }
            setText('');
        } catch (err) {
            console.error("Submit quick prompt error:", err);
        }
    };

    const handleKeyDown = async (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
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
                console.error("Hide quickbar error:", err);
            }
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
                await invoke('open_main_window_with_prompt', { prompt: text.trim() });
            }
        } catch (err) {
            console.error("Open main error:", err);
        }
    };

    return (
        <div className="quickbar-page-root">
            <div className="quickbar-capsule">
                <div className="quickbar-input-row">
                    <textarea
                        ref={textareaRef}
                        className="quickbar-textarea"
                        placeholder="Ask anything"
                        value={text}
                        rows={1}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </div>

                <div className="quickbar-bottom-row">
                    <div className="quickbar-bottom-left">
                        <button
                            type="button"
                            className="quickbar-icon-btn"
                            title="Add attachment / Open CEOVA"
                            onClick={handleOpenMain}
                        >
                            <Plus size={16} />
                        </button>
                        <div className="quickbar-model-badge">
                            <Globe size={13} style={{ opacity: 0.8 }} />
                            <span>5.6 Luna</span>
                        </div>
                    </div>

                    <div className="quickbar-bottom-right">
                        <span className="quickbar-hint">ESC to close</span>
                        <button
                            type="button"
                            className={`quickbar-icon-btn ${isListening ? 'listening' : ''}`}
                            title={isListening ? "Listening..." : "Voice input"}
                            onClick={toggleSpeech}
                            style={{ color: isListening ? '#ef4444' : undefined }}
                        >
                            <Mic size={16} />
                        </button>
                        <button
                            type="button"
                            className={`quickbar-submit-btn ${text.trim() ? 'active' : ''}`}
                            title="Send prompt (Enter)"
                            disabled={!text.trim()}
                            onClick={handleSubmit}
                        >
                            <ArrowUp size={16} strokeWidth={2.6} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
