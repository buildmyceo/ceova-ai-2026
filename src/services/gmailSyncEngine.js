import { supabase } from './supabase';
import { getGoogleAccessToken } from './gdriveSyncEngine';

/**
 * CEOVA Gmail Sync Engine
 * -------------------------------------------------------------
 * Principle: Zero File / Email Duplication
 * Gmail API is the live source of truth.
 * Fetches mail metadata (Subject, Sender, Snippet, Date, Labels) at request time.
 */

export async function fetchGoogleEmails(userId) {
  if (!userId) return { success: false, error: 'User session required' };

  const accessToken = await getGoogleAccessToken(userId);
  if (!accessToken) {
    return {
      success: false,
      needsAuth: true,
      error: 'Google Mail is not connected. Click "Connect Google Mail" to grant access.'
    };
  }

  try {
    // 1. Fetch message IDs list from Gmail API
    const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    listUrl.searchParams.set('maxResults', '40');

    const listResp = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!listResp.ok) {
      if (listResp.status === 401 || listResp.status === 403) {
        return { needsAuth: true, error: 'Google Mail permission required.' };
      }
      throw new Error(`Gmail API error HTTP ${listResp.status}`);
    }

    const listData = await listResp.json();
    const messageIds = (listData.messages || []).map(m => m.id);

    if (messageIds.length === 0) {
      return { success: true, emails: [] };
    }

    // 2. Fetch details for each message in parallel
    const emailPromises = messageIds.slice(0, 30).map(async (msgId) => {
      try {
        const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`;
        const dResp = await fetch(detailUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!dResp.ok) return null;
        const msg = await dResp.json();

        // Parse headers (Subject, From, Date)
        const headers = msg.payload?.headers || [];
        const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

        const subject = getHeader('Subject') || '(No Subject)';
        const from = getHeader('From') || 'Unknown Sender';
        const dateStr = getHeader('Date');
        const snippet = msg.snippet || '';
        const labelIds = msg.labelIds || [];

        let createdAt = new Date().toISOString();
        if (dateStr) {
          try {
            const cleanDateStr = dateStr.replace(/\s*\([^)]*\)\s*$/g, '');
            const parsedDate = new Date(cleanDateStr);
            if (!isNaN(parsedDate.getTime())) {
              createdAt = parsedDate.toISOString();
            }
          } catch (e) {}
        }

        return {
          id: `gmail-${msg.id}`,
          gmail_id: msg.id,
          thread_id: msg.threadId,
          kind: 'file',
          category: 'mail',
          name: subject,
          from_sender: from,
          snippet: snippet,
          created_at: createdAt,
          label_ids: labelIds,
          source: 'gmail',
          web_view_link: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
          mime_type: 'message/rfc822'
        };
      } catch (err) {
        return null;
      }
    });

    const results = await Promise.all(emailPromises);
    const validEmails = results.filter(Boolean);

    if (validEmails.length > 0) {
      // Persist to database
      const dbEmails = validEmails.map(e => ({
        user_id: userId,
        gmail_id: e.gmail_id,
        thread_id: e.thread_id,
        name: e.name,
        from_sender: e.from_sender,
        snippet: e.snippet,
        label_ids: e.label_ids,
        web_view_link: e.web_view_link,
        created_at: e.created_at
      }));

      const { error: dbErr } = await supabase
        .from('gmail_emails')
        .upsert(dbEmails, { onConflict: 'gmail_id' });

      if (dbErr) {
        console.error('[GmailSyncEngine] Error saving to DB:', dbErr);
      }
    }

    return { success: true, emails: validEmails };
  } catch (err) {
    console.error('[GmailSyncEngine] Error fetching emails:', err);
    return { success: false, error: err.message };
  }
}
