import { supabase } from './supabase';

/**
 * CEOVA Dropbox Storage Provider Sync Engine
 * -------------------------------------------------------------
 * Storage Policy:
 * 1. Dropbox is the source of truth.
 * 2. Never permanently download Dropbox files.
 * 3. Never copy Dropbox files into Supabase Storage.
 * 4. Never duplicate Dropbox files on the server.
 * 5. Synchronize metadata only.
 */

// Category MimeType Normalizer for Dropbox
export function categorizeDropboxMimeType(fileName = '', mimeType = '') {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return { mimeType: mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`, category: 'images' };
  }
  if (mimeType.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) {
    return { mimeType: mimeType || `video/${ext}`, category: 'videos' };
  }
  if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) {
    return { mimeType: mimeType || `audio/${ext}`, category: 'audio' };
  }
  if (mimeType === 'application/pdf' || ext === 'pdf') {
    return { mimeType: 'application/pdf', category: 'pdfs' };
  }
  if (['ppt', 'pptx', 'key'].includes(ext) || mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
    return { mimeType: mimeType || 'application/vnd.ms-powerpoint', category: 'presentations' };
  }
  if (['xls', 'xlsx', 'csv'].includes(ext) || mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
    return { mimeType: mimeType || 'text/csv', category: 'spreadsheets' };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mimeType.includes('compressed') || mimeType.includes('zip')) {
    return { mimeType: mimeType || 'application/zip', category: 'archives' };
  }
  if (['doc', 'docx', 'txt', 'rtf', 'md'].includes(ext) || mimeType.includes('word') || mimeType.includes('text/')) {
    return { mimeType: mimeType || 'text/plain', category: 'documents' };
  }

  return { mimeType: mimeType || 'application/octet-stream', category: 'documents' };
}

import APP_CONFIG from '../config/appConfig';

/**
 * Connect / Authenticate Dropbox via OAuth 2.0
 */
export async function connectDropbox() {
  localStorage.setItem('oauth_provider', 'dropbox');
  const redirectUrl = APP_CONFIG.getRedirectUrl('/auth/callback');
  
  // Try Supabase Auth OAuth with provider 'dropbox'
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'dropbox',
    options: {
      redirectTo: redirectUrl,
      queryParams: {
        token_access_type: 'offline'
      }
    }
  });

  if (error) {
    console.warn('[DropboxSyncEngine] Supabase OAuth fallback to direct Dropbox OAuth:', error);
    // Fallback: If custom client ID is configured for direct Dropbox OAuth
    const clientId = import.meta.env.VITE_DROPBOX_CLIENT_ID || 'ceova_dropbox_app';
    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${clientId}&response_type=code&token_access_type=offline&redirect_uri=${encodeURIComponent(redirectUrl)}`;
    window.location.href = authUrl;
  }
}

/**
 * Fetch Dropbox Access Token with multiple robust fallbacks and database lookup
 */
export async function getDropboxAccessToken(userId) {
  // 1. Fetch from user_dropbox_tokens database table first
  if (userId) {
    try {
      const { data } = await supabase
        .from('user_dropbox_tokens')
        .select('access_token, expiry_date, cursor')
        .eq('user_id', userId)
        .maybeSingle();

      if (data?.access_token) {
        const now = Date.now();
        const isExpired = data.expiry_date ? now >= (data.expiry_date - 60000) : false;
        if (!isExpired) {
          localStorage.setItem('dropbox_provider_token', data.access_token);
          return data.access_token;
        }
      }
    } catch (err) {}
  }

  // 2. Check current active session for provider_token if provider was dropbox
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    const storedProvider = localStorage.getItem('oauth_provider');
    if (session?.provider_token && (storedProvider === 'dropbox' || session?.user?.app_metadata?.provider === 'dropbox')) {
      localStorage.setItem('dropbox_provider_token', session.provider_token);
      return session.provider_token;
    }
  } catch (e) {}

  // 3. Fallback to cached localStorage token
  const cachedToken = localStorage.getItem('dropbox_provider_token');
  if (cachedToken) return cachedToken;

  return null;
}

/**
 * Full Initial Sync or Incremental Delta Sync with Dropbox API v2
 */
export async function syncDropbox(userId) {
  if (!userId) return { success: false, error: 'User session required' };

  const accessToken = await getDropboxAccessToken(userId);
  if (!accessToken) {
    return {
      success: false,
      needsAuth: true,
      error: 'Dropbox is not connected. Click "Connect Dropbox" to grant access.'
    };
  }

  try {
    // Check for previous cursor in user_dropbox_tokens or dropbox_sync_logs
    const { data: tokenData } = await supabase
      .from('user_dropbox_tokens')
      .select('cursor')
      .eq('user_id', userId)
      .maybeSingle();

    let cursor = tokenData?.cursor || null;

    if (!cursor) {
      const { data: syncLog } = await supabase
        .from('dropbox_sync_logs')
        .select('cursor')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      cursor = syncLog?.cursor || null;
    }

    if (cursor) {
      console.log('[DropboxSyncEngine] Executing Incremental Delta Sync with cursor:', cursor);
      return await executeDropboxDeltaSync(userId, accessToken, cursor);
    } else {
      console.log('[DropboxSyncEngine] Executing Full Metadata Sync...');
      return await executeDropboxFullSync(userId, accessToken);
    }
  } catch (err) {
    console.error('[DropboxSyncEngine] Sync failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Initial Full Metadata Fetch from Dropbox API v2 (/2/files/list_folder)
 */
async function executeDropboxFullSync(userId, accessToken) {
  let hasMore = false;
  let cursor = null;
  let totalSynced = 0;
  const syncedFiles = [];
  const syncedFolders = [];

  // Create sync log entry
  const { data: logEntry } = await supabase
    .from('dropbox_sync_logs')
    .insert([{ user_id: userId, status: 'in_progress', start_time: new Date().toISOString() }])
    .select()
    .maybeSingle();

  try {
    let url = 'https://api.dropboxapi.com/2/files/list_folder';
    let body = {
      path: '',
      recursive: true,
      include_media_info: true,
      include_has_explicit_shared_members: true,
      include_mounted_folders: true
    };

    do {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
          localStorage.removeItem('dropbox_provider_token');
          return { needsAuth: true, error: 'Dropbox session expired. Please reconnect.' };
        }
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error_summary || `Dropbox API error HTTP ${resp.status}`);
      }

      const data = await resp.json();
      const entries = data.entries || [];
      hasMore = !!data.has_more;
      cursor = data.cursor || cursor;

      for (const entry of entries) {
        if (entry['.tag'] === 'folder') {
          syncedFolders.push({
            user_id: userId,
            drive_id: entry.id,
            name: entry.name,
            is_favorite: false,
            is_trashed: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        } else if (entry['.tag'] === 'file') {
          const { mimeType, category } = categorizeDropboxMimeType(entry.name);
          syncedFiles.push({
            user_id: userId,
            drive_id: entry.id,
            storage_source: 'dropbox',
            name: entry.name,
            mime_type: mimeType,
            category: category,
            size: entry.size || 0,
            thumbnail_url: null,
            web_view_link: `https://www.dropbox.com/home${entry.path_display || ''}`,
            web_download_link: null,
            owner_email: null,
            owner_name: null,
            is_starred: false,
            is_favorite: false,
            is_shared: !!entry.has_explicit_shared_members,
            is_trashed: false,
            created_at: entry.client_modified || new Date().toISOString(),
            updated_at: entry.server_modified || new Date().toISOString()
          });
        }
      }

      totalSynced += entries.length;

      // Prepare continuation request if has_more is true
      if (hasMore) {
        url = 'https://api.dropboxapi.com/2/files/list_folder/continue';
        body = { cursor };
      }
    } while (hasMore);

    // Upsert into Supabase DB
    if (syncedFolders.length > 0) {
      await supabase.from('folders').upsert(syncedFolders, { onConflict: 'drive_id' });
    }

    if (syncedFiles.length > 0) {
      await supabase.from('files').upsert(syncedFiles, { onConflict: 'drive_id' });
    }

    // Save cursor into user_dropbox_tokens & sync logs
    if (cursor) {
      await supabase.from('user_dropbox_tokens').upsert([{
        user_id: userId,
        access_token: accessToken,
        cursor: cursor,
        updated_at: new Date().toISOString()
      }], { onConflict: 'user_id' });
    }

    if (logEntry?.id) {
      await supabase.from('dropbox_sync_logs').update({
        status: 'completed',
        end_time: new Date().toISOString(),
        synced_count: totalSynced,
        cursor: cursor
      }).eq('id', logEntry.id);
    }

    return { success: true, count: totalSynced, cursor, files: syncedFiles, folders: syncedFolders };
  } catch (err) {
    if (logEntry?.id) {
      await supabase.from('dropbox_sync_logs').update({
        status: 'failed',
        end_time: new Date().toISOString(),
        error_message: err.message
      }).eq('id', logEntry.id);
    }
    throw err;
  }
}

/**
 * Incremental Delta Sync using Dropbox Cursors (/2/files/list_folder/continue)
 * Detects additions, modifications, and deletions automatically.
 */
async function executeDropboxDeltaSync(userId, accessToken, cursor) {
  let hasMore = false;
  let nextCursor = cursor;
  let totalChanges = 0;

  try {
    do {
      const resp = await fetch('https://api.dropboxapi.com/2/files/list_folder/continue', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cursor: nextCursor })
      });

      if (!resp.ok) {
        console.warn('[DropboxSyncEngine] Cursor reset. Re-triggering full sync...');
        return await executeDropboxFullSync(userId, accessToken);
      }

      const data = await resp.json();
      const entries = data.entries || [];
      hasMore = !!data.has_more;
      nextCursor = data.cursor || nextCursor;

      for (const entry of entries) {
        const tag = entry['.tag'];

        // Deletion detection
        if (tag === 'deleted') {
          const pathLower = entry.path_lower;
          if (pathLower) {
            // Delete matching file or folder from Supabase DB
            await supabase.from('files').delete().eq('drive_id', entry.id || pathLower);
            await supabase.from('folders').delete().eq('drive_id', entry.id || pathLower);
          }
        } else if (tag === 'folder') {
          await supabase.from('folders').upsert([{
            user_id: userId,
            drive_id: entry.id,
            name: entry.name,
            updated_at: new Date().toISOString()
          }], { onConflict: 'drive_id' });
        } else if (tag === 'file') {
          const { mimeType, category } = categorizeDropboxMimeType(entry.name);
          await supabase.from('files').upsert([{
            user_id: userId,
            drive_id: entry.id,
            storage_source: 'dropbox',
            name: entry.name,
            mime_type: mimeType,
            category: category,
            size: entry.size || 0,
            web_view_link: `https://www.dropbox.com/home${entry.path_display || ''}`,
            is_shared: !!entry.has_explicit_shared_members,
            updated_at: entry.server_modified || new Date().toISOString()
          }], { onConflict: 'drive_id' });
        }
      }

      totalChanges += entries.length;
    } while (hasMore);

    // Save updated cursor
    await supabase.from('user_dropbox_tokens').upsert([{
      user_id: userId,
      access_token: accessToken,
      cursor: nextCursor,
      updated_at: new Date().toISOString()
    }], { onConflict: 'user_id' });

    await supabase.from('dropbox_sync_logs').insert([{
      user_id: userId,
      status: 'completed',
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      synced_count: totalChanges,
      cursor: nextCursor
    }]);

    return { success: true, count: totalChanges, cursor: nextCursor };
  } catch (err) {
    console.error('[DropboxSyncEngine] Delta sync error:', err);
    throw err;
  }
}

/**
 * Ephemeral In-Memory Dropbox File Content Fetcher
 * Used ONLY when user requests Preview, Summarize, OCR, Translate, or AI Chat.
 * NEVER persists files to disk or Supabase storage!
 */
export async function fetchDropboxFileContent(userId, dropboxFileIdOrPath, mimeType = '') {
  if (!userId || !dropboxFileIdOrPath) return null;
  const accessToken = await getDropboxAccessToken(userId);
  if (!accessToken) {
    throw new Error('Dropbox access token not available.');
  }

  const resp = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Dropbox-API-Arg': JSON.stringify({ path: dropboxFileIdOrPath })
    }
  });

  if (!resp.ok) {
    throw new Error(`Failed to fetch file content from Dropbox (HTTP ${resp.status})`);
  }

  if (mimeType.includes('text') || mimeType.includes('json') || mimeType.includes('csv') || mimeType.includes('document')) {
    return await resp.text();
  }

  return await resp.arrayBuffer();
}

/**
 * Fetch Temporary Direct View/Preview Link from Dropbox API (/2/files/get_temporary_link)
 * Returns a 4-hour direct streaming URL without duplicating the file.
 */
export async function getDropboxTemporaryLink(userId, dropboxFileIdOrPath) {
  if (!userId || !dropboxFileIdOrPath) return null;
  const accessToken = await getDropboxAccessToken(userId);
  if (!accessToken) return null;

  try {
    const resp = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ path: dropboxFileIdOrPath })
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    return data.link || null;
  } catch (e) {
    console.warn('[DropboxSyncEngine] Failed to get temporary link:', e);
    return null;
  }
}
