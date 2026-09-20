import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jqpbgcmrlpfqnellznhz.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcGJnY21ybHBmcW5lbGx6bmh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjEwOTIyNywiZXhwIjoyMDg3Njg1MjI3fQ.87TvzMkkZb8t4vhOdhdzRQ19vQklVYF382uhUJR73jE';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function generateTitleForMessages(messages) {
    if (!messages || messages.length === 0) return null;

    const formatted = messages.slice(0, 4).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: typeof m.content === 'string' ? m.content : ''
    })).filter(m => m.content.trim().length > 0);

    if (formatted.length === 0) return null;

    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/super-endpoint/generate-title`, {
            method: 'POST',
            headers: {
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: formatted
            })
        });

        if (res.ok) {
            const data = await res.json();
            if (data?.title) {
                let cleaned = data.title.replace(/^["'`]|["'`]$/g, '').replace(/[.!?:;]+$/g, '').trim();
                const words = cleaned.split(/\s+/).filter(Boolean);
                if (words.length > 4) {
                    cleaned = words.slice(0, 4).join(' ');
                }
                return cleaned;
            }
        } else {
            const err = await res.text();
            console.error("Endpoint error:", err);
        }
    } catch (e) {
        console.error("Failed to generate title:", e);
    }
    return null;
}

async function renameAllPastChats() {
    console.log("Fetching all chats from Supabase...");
    const { data: chats, error } = await supabase
        .from('chats')
        .select('id, user_id, title, is_pinned, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching chats:", error);
        return;
    }

    console.log(`Found ${chats.length} chats in database.`);

    for (const chat of chats) {
        // Fetch first 4 messages for this chat
        const { data: msgs, error: msgErr } = await supabase
            .from('messages')
            .select('role, content, created_at')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: true })
            .limit(4);

        if (msgErr || !msgs || msgs.length === 0) {
            console.log(`[SKIP] Chat ${chat.id} has no messages. Current title: "${chat.title}"`);
            continue;
        }

        console.log(`\nProcessing Chat: "${chat.title}" (ID: ${chat.id})`);
        console.log(`  1st message: [${msgs[0].role}] ${msgs[0].content.slice(0, 60)}...`);
        if (msgs[1]) {
            console.log(`  2nd message: [${msgs[1].role}] ${msgs[1].content.slice(0, 60)}...`);
        }

        const newTitle = await generateTitleForMessages(msgs);
        if (newTitle && newTitle !== 'New Chat') {
            const { error: updateErr } = await supabase
                .from('chats')
                .update({ title: newTitle })
                .eq('id', chat.id);

            if (updateErr) {
                console.error(`  [FAILED] Could not update chat ${chat.id}:`, updateErr);
            } else {
                console.log(`  [SUCCESS] Renamed "${chat.title}" -> "${newTitle}"`);
            }
        } else {
            console.log(`  [UNCHANGED] Generated title was empty or 'New Chat'`);
        }

        // Delay to avoid bursting
        await new Promise(r => setTimeout(r, 400));
    }

    console.log("\nAll past chats processed!");
}

renameAllPastChats();
