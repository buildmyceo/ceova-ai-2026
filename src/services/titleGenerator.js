import { supabase, SUPABASE_URL } from './supabase';
import { cacheManager } from './CacheManager';

/**
 * Generates a concise 3-4 word title using gpt-4o-mini via super-endpoint.
 * @param {Array} messages - List of message objects ({ role/sender, content/text })
 * @param {string} [token] - Supabase auth token
 * @returns {Promise<string>} Clean 3-4 word title
 */
export async function generateChatTitle(messages = [], token) {
    if (!messages || messages.length === 0) return "New Chat";

    try {
        let authToken = token;
        if (!authToken) {
            const { data } = await supabase.auth.getSession();
            authToken = data?.session?.access_token;
        }

        if (!authToken) {
            return fallbackTitle(messages);
        }

        const formatted = messages.slice(0, 4).map(m => ({
            role: m.role === 'assistant' || m.sender === 'ai' || m.sender === 'assistant' ? 'assistant' : 'user',
            content: typeof m.content === 'string' ? m.content : (typeof m.text === 'string' ? m.text : '')
        })).filter(m => m.content.trim().length > 0);

        if (formatted.length === 0) return "New Chat";

        const res = await fetch(`${SUPABASE_URL}/functions/v1/super-endpoint/generate-title`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'generate-title',
                messages: formatted
            })
        });

        if (res.ok) {
            const data = await res.json();
            if (data?.title) {
                return cleanTitle(data.title);
            }
        }
    } catch (err) {
        console.warn("[titleGenerator] Failed to generate AI title via edge function:", err);
    }

    return fallbackTitle(messages);
}

/**
 * Formats a clean 3-4 word title
 */
function cleanTitle(raw) {
    if (!raw) return "New Chat";
    let cleaned = raw.replace(/^["'`]|["'`]$/g, '').replace(/[.!?:;]+$/g, '').trim();
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length > 4) {
        cleaned = words.slice(0, 4).join(' ');
    }
    return cleaned;
}

/**
 * Fallback heuristic title if edge function is unreachable
 */
function fallbackTitle(messages) {
    const firstUser = messages.find(m => m.role === 'user' || m.sender === 'user');
    const text = (firstUser?.content || firstUser?.text || '').trim();
    if (!text) return "New Chat";

    // Clean markdown headings
    const cleaned = text.replace(/^#+\s*/, '').replace(/[\n\r]+/g, ' ').trim();
    const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 4);
    if (words.length === 0) return "New Chat";

    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

/**
 * Automatically renames legacy or raw chat titles in the background
 * using gpt-4o-mini so past user chat history gets clean 3-4 word titles.
 */
export async function renameLegacyChats({ chats, chatMetadata, setChatMetadata, token }) {
    if (!chats || typeof chats !== 'object') return;

    const chatIds = Object.keys(chats).filter(id => {
        if (id.startsWith('temp_')) return false;
        const msgList = chats[id] || [];
        if (msgList.length === 0) return false;

        // Skip if already processed in this browser session
        if (sessionStorage.getItem(`ai_titled_${id}`)) return false;

        const currentTitle = (chatMetadata[id]?.title || '').trim();

        // Detect if title needs AI generation:
        // 1. Generic placeholder
        // 2. Starts with raw user greetings like "hy", "hello"
        // 3. Raw prompt starts like "genarte a logo", "genrate a image"
        // 4. Ends with ellipsis "..." (was truncated by slice(0, 30))
        // 5. Contains more than 4 words or is entirely lowercase raw text
        const isDefaultOrRaw = (
            !currentTitle ||
            currentTitle === 'New Chat' ||
            currentTitle.startsWith('Topic ') ||
            currentTitle.endsWith('...') ||
            /^(hy|hey|hi|hello|whats|what is|whta)\b/i.test(currentTitle) ||
            /^(genarte|genrate|generate)\b/i.test(currentTitle) ||
            currentTitle.split(/\s+/).length > 4 ||
            (currentTitle.length > 5 && currentTitle === currentTitle.toLowerCase())
        );

        return isDefaultOrRaw;
    });

    if (chatIds.length === 0) return;

    // Process sequentially in the background with a 350ms delay
    (async () => {
        for (const chatId of chatIds) {
            try {
                const chatMsgs = chats[chatId] || [];
                if (chatMsgs.length === 0) {
                    sessionStorage.setItem(`ai_titled_${chatId}`, 'true');
                    continue;
                }

                const newTitle = await generateChatTitle(chatMsgs.slice(0, 4), token);
                if (newTitle && newTitle !== 'New Chat') {
                    // Update Supabase
                    await supabase.from('chats').update({ title: newTitle }).eq('id', chatId);

                    // Update local cache
                    const cached = await cacheManager.getChat(chatId);
                    if (cached) {
                        await cacheManager.setChat({ ...cached, title: newTitle });
                    }

                    // Update React state immediately
                    setChatMetadata(prev => ({
                        ...prev,
                        [chatId]: { ...(prev[chatId] || {}), title: newTitle }
                    }));
                }

                sessionStorage.setItem(`ai_titled_${chatId}`, 'true');
                await new Promise(r => setTimeout(r, 350));
            } catch (err) {
                console.warn(`[titleGenerator] Error renaming legacy chat ${chatId}:`, err);
                sessionStorage.setItem(`ai_titled_${chatId}`, 'true');
            }
        }
    })();
}
