import { supabase, SUPABASE_URL, SUPABASE_KEY } from './supabase';
import { cacheManager } from './CacheManager';

/**
 * Generates a concise 3-4 word title using GPT-6 Luna via super-endpoint.
 * @param {Array} messages - List of message objects ({ role/sender, content/text })
 * @param {string} [token] - Supabase auth token
 * @returns {Promise<string>} Clean 3-4 word title
 */
export async function generateChatTitle(messages = [], token, userMemories = []) {
    if (!messages || messages.length === 0) return "New Chat";

    try {
        let authToken = token;
        if (!authToken) {
            const { data } = await supabase.auth.getSession();
            authToken = data?.session?.access_token;
        }

        const formatted = messages.slice(0, 4).map(m => ({
            role: m.role === 'assistant' || m.sender === 'ai' || m.sender === 'assistant' ? 'assistant' : 'user',
            content: typeof m.content === 'string' ? m.content : (typeof m.text === 'string' ? m.text : '')
        })).filter(m => m.content.trim().length > 0);

        if (formatted.length === 0) return "New Chat";

        const hour = new Date().getHours();
        let timeOfDay = 'morning';
        if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
        else if (hour >= 17 && hour < 22) timeOfDay = 'evening';
        else if (hour >= 22 || hour < 5) timeOfDay = 'night';

        const profileMemories = Array.isArray(userMemories)
            ? userMemories.filter(m => String(m.category || '').toLowerCase().trim() === 'profile')
            : [];
        const memorySnippet = profileMemories.length > 0
            ? profileMemories.map(m => `${m.title || m.category}: ${m.value}`).slice(0, 3).join(', ')
            : '';

        const res = await fetch(`${SUPABASE_URL}/functions/v1/super-endpoint/generate-title`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${authToken || SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: formatted,
                time_of_day: timeOfDay,
                user_memory: memorySnippet
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
 * using GPT-6 Luna so past user chat history gets clean 3-4 word titles.
 */
export async function renameLegacyChats({ chats, chatMetadata, setChatMetadata, token, userMemories = [] }) {
    if (!chatMetadata && !chats) return;

    // Consider all chats known in chatMetadata or chats state
    const allChatIds = Array.from(new Set([
        ...Object.keys(chatMetadata || {}),
        ...Object.keys(chats || {})
    ])).filter(id => !id.startsWith('temp_'));

    const chatIdsToRename = allChatIds.filter(id => {
        // Skip if already processed with AI in this session
        if (sessionStorage.getItem(`ai_titled_v6_${id}`)) return false;

        const currentTitle = (chatMetadata?.[id]?.title || '').trim();

        // Detect if title needs AI generation:
        // 1. Generic placeholder or missing
        // 2. Starts with Telegram topic pattern like "Topic 3099", "Topic #..."
        // 3. Starts with raw user greetings like "hy", "hello", "hi"
        // 4. Raw prompt starts like "genarte", "genrate", "generate", "creat", "create", "make"
        // 5. Ends with ellipsis "..." or dangling prepositions like " of", " the", " a", " to", " in"
        // 6. Contains more than 4 words or is entirely lowercase raw text
        const isDefaultOrRaw = (
            !currentTitle ||
            currentTitle === 'New Chat' ||
            currentTitle === 'Telegram Chat' ||
            currentTitle.startsWith('Topic ') ||
            currentTitle.startsWith('Topic #') ||
            currentTitle.endsWith('...') ||
            /\b(of|the|a|an|in|on|at|for|to|with)\s*$/i.test(currentTitle) ||
            /^(hy|hey|hi|hello|whats|what is|whta)\b/i.test(currentTitle) ||
            /^(genarte|genrate|generate|creat|create|make)\b/i.test(currentTitle) ||
            currentTitle.split(/\s+/).length > 4 ||
            (currentTitle.length > 5 && currentTitle === currentTitle.toLowerCase())
        );

        return isDefaultOrRaw;
    });

    if (chatIdsToRename.length === 0) return;

    // Process sequentially in the background with a 350ms delay
    (async () => {
        for (const chatId of chatIdsToRename) {
            try {
                let chatMsgs = chats?.[chatId] || [];
                if (chatMsgs.length === 0) {
                    // Fetch first 4 messages directly from Supabase if not yet in state
                    const { data: dbMsgs } = await supabase
                        .from('messages')
                        .select('role, content')
                        .eq('chat_id', chatId)
                        .order('created_at', { ascending: true })
                        .limit(4);

                    if (dbMsgs && dbMsgs.length > 0) {
                        chatMsgs = dbMsgs;
                    } else {
                        // Truly empty chat, leave it for when messages exist
                        continue;
                    }
                }

                const newTitle = await generateChatTitle(chatMsgs.slice(0, 4), token, userMemories);
                if (newTitle && newTitle !== 'New Chat' && !newTitle.startsWith('Topic ') && !/\b(of|the|a|an|in|on|at|for|to|with)\s*$/i.test(newTitle)) {
                    // Update Supabase
                    await supabase.from('chats').update({ title: newTitle }).eq('id', chatId);

                    // Update local cache
                    const cached = await cacheManager.getChat(chatId);
                    if (cached) {
                        await cacheManager.setChat({ ...cached, title: newTitle });
                    }

                    // Update React state immediately
                    if (setChatMetadata) {
                        setChatMetadata(prev => ({
                            ...prev,
                            [chatId]: { ...(prev[chatId] || {}), title: newTitle }
                        }));
                    }
                    sessionStorage.setItem(`ai_titled_v6_${chatId}`, 'true');
                }
                await new Promise(r => setTimeout(r, 350));
            } catch (err) {
                console.warn(`[titleGenerator] Error renaming legacy chat ${chatId}:`, err);
            }
        }
    })();
}
