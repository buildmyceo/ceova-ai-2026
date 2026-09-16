const fs = require('fs');
let content = fs.readFileSync('/Users/chintukumar/AIAvatarApp/src/pages/Home.jsx', 'utf8');

// Disable cache load
const cacheBlockStart = content.indexOf('// 1. Instant Cache Load');
const cacheBlockEnd = content.indexOf('// Fast Sync: Fetch just chat metadata');
if (cacheBlockStart !== -1 && cacheBlockEnd !== -1) {
    content = content.slice(0, cacheBlockStart) + content.slice(cacheBlockEnd);
}

// Ensure cacheManager is called on delete
content = content.replace(
    /const \{ error: chatErr \} = await supabase.from\('chats'\)\.delete\(\)\.eq\('id', id\);([\s\S]*?)setChats\(/m,
    `const { error: chatErr } = await supabase.from('chats').delete().eq('id', id);
            if (chatErr) {
                console.error("Chats delete error:", chatErr);
                throw chatErr;
            }
            // Clear from cache
            try { await cacheManager.deleteChat(id); } catch(e) {}
            
            setChats(`
);

fs.writeFileSync('/Users/chintukumar/AIAvatarApp/src/pages/Home.jsx', content);
