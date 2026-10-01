import { supabase } from './supabase';
import { cacheManager } from './CacheManager';
import { fetchGoogleEmails } from './gmailSyncEngine';
import { fetchGoogleCalendarEvents } from './gcalendarSyncEngine';

// Categorization helper predicates matching Library.jsx exactly
export const isAiItem = (it) => !!it && (
    it.source === 'ai' || 
    it.source === 'ai_generated' || 
    it.category === 'ai_generated' || 
    it.category === 'action'
);

export const isGdriveItem = (it) => !!it && (
    it.source === 'gdrive'
);

export const isGmailItem = (it) => !!it && (
    it.source === 'gmail' || 
    it.category === 'mail' || 
    it.mime_type === 'message/rfc822'
);

export const isCalendarItem = (it) => !!it && (
    it.source === 'gcalendar' || 
    it.category === 'calendar' || 
    it.mime_type === 'text/calendar'
);

export const isCeovaItem = (it) => !!it && (
    !isGdriveItem(it) && 
    !isGmailItem(it) && 
    !isCalendarItem(it) && 
    !isAiItem(it) && 
    it.source !== 'dropbox'
);

/**
 * Fetch all library items for a user across chats/messages, files table,
 * ai_generated_files, gmail_emails, and calendar_events.
 * Deduplicates and updates cacheManager.
 */
export async function fetchUserLibraryItems(userId, options = {}) {
    if (!userId) return [];

    const items = [];

    // 1. Pull CEOVA Chat messages + attachments + actions
    try {
        const { data: chats } = await supabase
            .from('chats')
            .select('id, title')
            .eq('user_id', userId);

        const chatMap = new Map((chats || []).map(c => [c.id, c.title]));
        const chatIds = Array.from(chatMap.keys());

        if (chatIds.length > 0) {
            const { data: messages } = await supabase
                .from('messages')
                .select('id, role, content, attachments, created_at, chat_id')
                .in('chat_id', chatIds)
                .order('created_at', { ascending: false })
                .limit(2000);

            (messages || []).forEach(msg => {
                const chatTitle = chatMap.get(msg.chat_id) || 'Untitled Chat';
                const isAI = msg.role === 'assistant' || msg.role === 'ai';
                const isUser = msg.role === 'user';

                // Attachments
                const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
                attachments.forEach(att => {
                    const isImg = att.type?.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(att.name || att.url || '');
                    const isVid = att.type?.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(att.name || att.url || '');
                    const isAud = att.type?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(att.name || att.url || '');

                    let kind = 'file';
                    let category = 'documents';
                    if (isImg) { kind = 'image'; category = 'images'; }
                    else if (isVid) { kind = 'file'; category = 'videos'; }
                    else if (isAud) { kind = 'file'; category = 'audio'; }

                    items.push({
                        id: `att-${msg.id}-${att.name || Math.random()}`,
                        kind,
                        category,
                        name: att.name || 'Untitled',
                        url: att.url || att.preview || att.dataUrl,
                        thumbnail_url: isImg ? (att.url || att.preview || att.dataUrl) : null,
                        mime_type: att.type || '',
                        size: att.size,
                        created_at: msg.created_at,
                        chat_id: msg.chat_id,
                        chat_title: chatTitle,
                        source: isUser ? 'user' : 'ai',
                        content: null,
                        path: att.path || null,
                        public_url: att.public_url || null,
                        data: att.data || null,
                    });
                });

                // AI Markdown Images
                if (isAI && msg.content) {
                    const imgRegex = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
                    let m;
                    while ((m = imgRegex.exec(msg.content)) !== null) {
                        items.push({
                            id: `img-${msg.id}-${m.index}`,
                            kind: 'image',
                            category: 'images',
                            name: m[1] || 'AI Generated Image',
                            url: m[2],
                            thumbnail_url: m[2],
                            mime_type: 'image/png',
                            size: null,
                            created_at: msg.created_at,
                            chat_id: msg.chat_id,
                            chat_title: chatTitle,
                            source: 'ai',
                            content: null,
                        });
                    }

                    // AI Actions
                    const actionMatch = /<!--\s*ACTION_META:\s*({.*?})\s*-->/.exec(msg.content);
                    if (actionMatch && actionMatch[1]) {
                        try {
                            const meta = JSON.parse(actionMatch[1]);
                            items.push({
                                id: `act-${msg.id}`,
                                kind: 'action',
                                category: 'action',
                                name: meta.type || 'AI Action',
                                url: null,
                                mime_type: 'application/json',
                                size: null,
                                created_at: msg.created_at,
                                chat_id: msg.chat_id,
                                chat_title: chatTitle,
                                source: 'ai',
                                content: actionMatch[1],
                                meta: meta
                            });
                        } catch (e) {}
                    }
                }
            });
        }
    } catch (chatErr) {
        console.warn('[libraryFetchEngine] Error fetching chat messages:', chatErr);
    }

    // 2. Pull AI Generated Files table
    try {
        const { data: aiFiles } = await supabase
            .from('ai_generated_files')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        (aiFiles || []).forEach(af => {
            const isImg = af.mime_type?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(af.file_name || af.name || '');
            items.push({
                id: `aig-${af.id}`,
                kind: isImg ? 'image' : 'file',
                category: af.category || 'ai_generated',
                name: af.file_name || af.name || 'AI Generated File',
                url: af.file_url || af.url,
                thumbnail_url: af.file_url || af.url,
                mime_type: af.mime_type || 'text/plain',
                size: af.size,
                created_at: af.created_at,
                source: 'ai',
                summary: af.prompt_used || af.summary
            });
        });
    } catch (aigErr) {
        console.warn('[libraryFetchEngine] AI files fetch warning:', aigErr);
    }

    // 3. Pull Google Drive / Local synced metadata from public.files table
    try {
        const { data: driveFiles, error: driveErr } = await supabase
            .from('files')
            .select('*')
            .eq('user_id', userId)
            .not('is_trashed', 'eq', true)
            .order('created_at', { ascending: false });

        if (driveErr) {
            console.error('[libraryFetchEngine] Drive files fetch error:', driveErr);
        } else if (driveFiles) {
            const pathsToSign = [];
            driveFiles.forEach(df => {
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

            driveFiles.forEach(df => {
                const isImg = df.category === 'images' || df.mime_type?.startsWith('image/');
                const driveId = df.drive_id || (df.id && !String(df.id).includes('-') ? df.id : null);
                const directThumb = df.thumbnail_url || (driveId ? `https://lh3.googleusercontent.com/d/${driveId}=s400` : null);
                const isAiSource = df.storage_source === 'ai_generated' || df.category === 'ai_generated';

                const getFullUrl = (link) => {
                    if (!link) return null;
                    if (link.startsWith('http')) return link;
                    const cleanLink = link.startsWith('/') ? link.substring(1) : link;
                    if (signedUrlsMap[cleanLink]) return signedUrlsMap[cleanLink];
                    return `${supabase.supabaseUrl}/storage/v1/object/public/user_files/${cleanLink}`;
                };

                const resolvedWebView = getFullUrl(df.web_view_link);
                const resolvedWebDownload = getFullUrl(df.web_download_link);

                items.push({
                    id: df.id,
                    drive_id: driveId,
                    kind: isImg ? 'image' : 'file',
                    category: df.category || 'documents',
                    name: df.name,
                    url: directThumb || resolvedWebView,
                    thumbnail_url: directThumb || resolvedWebView,
                    web_view_link: resolvedWebView || (driveId ? `https://drive.google.com/file/d/${driveId}/view` : null),
                    web_download_link: resolvedWebDownload || (driveId ? `https://drive.google.com/uc?export=download&id=${driveId}` : null),
                    mime_type: df.mime_type || '',
                    size: df.size,
                    created_at: df.created_at,
                    chat_id: null,
                    chat_title: null,
                    source: isAiSource ? 'ai' : (df.storage_source || 'gdrive'),
                    summary: df.summary,
                    ocr_text: df.ocr_text,
                    is_temporary: df.is_temporary,
                    expires_at: df.expires_at,
                });
            });
        }
    } catch (filesErr) {
        console.warn('[libraryFetchEngine] Files fetch error:', filesErr);
    }

    // 4. Pull Google Mail from Database with Live Fallback
    try {
        let mailList = [];
        const { data: dbEmails, error: mailErr } = await supabase
            .from('gmail_emails')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (!mailErr && dbEmails && dbEmails.length > 0) {
            mailList = dbEmails.map(e => ({
                id: `db-gmail-${e.id}`,
                gmail_id: e.gmail_id,
                thread_id: e.thread_id,
                kind: 'file',
                category: 'mail',
                name: e.name,
                from_sender: e.from_sender,
                snippet: e.snippet,
                created_at: e.created_at,
                label_ids: e.label_ids || [],
                source: 'gmail',
                web_view_link: e.web_view_link,
                mime_type: 'message/rfc822'
            }));
        }

        // If forceLiveGoogle or if database has no emails, fetch live from Gmail
        if (options.forceLiveGoogle || mailList.length === 0) {
            try {
                const liveMailRes = await fetchGoogleEmails(userId);
                if (liveMailRes?.success && liveMailRes?.emails && liveMailRes.emails.length > 0) {
                    mailList = liveMailRes.emails;
                }
            } catch (mErr) {
                console.warn('[libraryFetchEngine] Live mail fetch error:', mErr);
            }
        }
        mailList.forEach(e => items.push(e));
    } catch (mailErr) {
        console.warn('[libraryFetchEngine] Gmail fetch error:', mailErr);
    }

    // 5. Pull Google Calendar from Database with Live Fallback
    try {
        let calList = [];
        const { data: dbEvents, error: calErr } = await supabase
            .from('calendar_events')
            .select('*')
            .eq('user_id', userId)
            .order('start_time', { ascending: true });

        if (!calErr && dbEvents && dbEvents.length > 0) {
            calList = dbEvents.map(evt => {
                const evtStart = new Date(evt.start_time);
                const now = new Date();
                const isUpcoming = evtStart >= now;
                const isToday = evtStart.toDateString() === now.toDateString();
                const isMeeting = (evt.attendees || []).length > 0 || evt.html_link?.includes('meet');

                return {
                    id: `db-gcal-${evt.id}`,
                    gcal_id: evt.gcal_id,
                    kind: 'file',
                    category: 'calendar',
                    name: evt.name,
                    description: evt.description,
                    location: evt.location,
                    start_time: evt.start_time,
                    end_time: evt.end_time,
                    created_at: evt.created_at,
                    source: 'gcalendar',
                    web_view_link: evt.html_link,
                    attendees: evt.attendees || [],
                    is_upcoming: isUpcoming,
                    is_today: isToday,
                    is_meeting: isMeeting,
                    mime_type: 'text/calendar'
                };
            });
        }

        // If forceLiveGoogle or if database has no events, fetch live from Calendar
        if (options.forceLiveGoogle || calList.length === 0) {
            try {
                const liveCalRes = await fetchGoogleCalendarEvents(userId);
                if (liveCalRes?.success && liveCalRes?.events && liveCalRes.events.length > 0) {
                    calList = liveCalRes.events;
                }
            } catch (cErr) {
                console.warn('[libraryFetchEngine] Live calendar fetch error:', cErr);
            }
        }
        calList.forEach(evt => items.push(evt));
    } catch (calErr) {
        console.warn('[libraryFetchEngine] Calendar fetch error:', calErr);
    }

    // Deduplicate items
    const seen = new Set();
    const deduped = items.filter(it => {
        const key = it.gcal_id || it.gmail_id || it.drive_id || (it.name ? `${it.name}-${it.size || ''}` : null) || it.url || it.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    // Update Cache in background
    cacheManager.setLibraryItems(deduped).catch(err => console.warn('[libraryFetchEngine] Cache save error:', err));

    return deduped;
}
