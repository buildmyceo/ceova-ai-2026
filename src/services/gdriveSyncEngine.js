import { supabase } from './supabase';

/**
 * CEOVA Google Drive Sync Engine
 * -------------------------------------------------------------
 * Principle: Zero File Duplication
 * Google Drive is the source of truth.
 * Only metadata is synchronized into CEOVA DB.
 */

// Category MimeType Normalizer
export function categorizeMimeType(mimeType = '', fileName = '') {
  if (!mimeType) mimeType = '';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (mimeType.startsWith('image/')) return 'images';
  if (mimeType.startsWith('video/')) return 'videos';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf' || ext === 'pdf') return 'pdfs';

  if (
    mimeType.includes('presentation') ||
    mimeType.includes('powerpoint') ||
    ['ppt', 'pptx', 'key'].includes(ext)
  ) return 'presentations';

  if (
    mimeType.includes('sheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('csv') ||
    ['xls', 'xlsx', 'csv'].includes(ext)
  ) return 'spreadsheets';

  if (
    mimeType.includes('zip') ||
    mimeType.includes('tar') ||
    mimeType.includes('rar') ||
    mimeType.includes('compressed') ||
    ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)
  ) return 'archives';

  if (
    mimeType.includes('document') ||
    mimeType.includes('word') ||
    mimeType.includes('text/') ||
    ['doc', 'docx', 'txt', 'rtf', 'md'].includes(ext)
  ) return 'documents';

  return 'documents';
}

import APP_CONFIG from '../config/appConfig';

/**
 * Connect / Re-authenticate Google Drive, Gmail, & Calendar via OAuth
 */
export async function connectGoogleDrive() {
  localStorage.setItem('oauth_provider', 'google');
  const redirectUrl = APP_CONFIG.getRedirectUrl('/auth/callback');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent'
      },
      scopes: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar'
    }
  });
  if (error) console.error('[GoogleDrive] OAuth connection error:', error);
}

/**
 * Fetch Google OAuth Access Token with multiple robust fallbacks and expiration check
 */
export async function getGoogleAccessToken(userId) {
  let dbToken = null;
  // 1. Fetch from user_google_tokens database table first
  if (userId) {
    try {
      const { data, error } = await supabase
        .from('user_google_tokens')
        .select('access_token, expiry_date, refresh_token')
        .eq('user_id', userId)
        .maybeSingle();

      if (data?.access_token) {
        dbToken = data.access_token;
        const now = Date.now();
        const isExpired = data.expiry_date ? now >= (data.expiry_date - 60000) : false;
        if (!isExpired) {
          localStorage.setItem('google_provider_token', data.access_token);
          return data.access_token;
        }
      }
    } catch (err) {}
  }

  // 2. Check current Supabase active session for provider_token
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.provider_token) {
      localStorage.setItem('google_provider_token', sessionData.session.provider_token);
      return sessionData.session.provider_token;
    }
  } catch (e) {}

  // 3. Fallback to cached localStorage token
  const cachedToken = localStorage.getItem('google_provider_token');
  if (cachedToken) return cachedToken;

  // 4. Return DB token as last resort if exists
  if (dbToken) return dbToken;

  return null;
}

/**
 * Full Initial Sync or Delta Sync with Google Drive Changes API
 */
export async function syncGoogleDrive(userId) {
  if (!userId) return { success: false, error: 'User session required' };

  const accessToken = await getGoogleAccessToken(userId);
  if (!accessToken) {
    return {
      success: false,
      needsAuth: true,
      error: 'Google Drive is not connected. Click "Connect Google Drive" to grant access.'
    };
  }

  try {
    // Check if user has ANY files synced already
    const { count: existingFilesCount } = await supabase
      .from('files')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('storage_source', 'gdrive');

    // If 0 files in DB, ALWAYS do a full sync (even if a pageToken exists)
    if (!existingFilesCount || existingFilesCount === 0) {
      console.log('[GDriveSyncEngine] No files in DB for user. Forcing Full Sync...');
      // Clear any stale sync logs so we get a clean start
      await supabase.from('drive_sync_logs').delete().eq('user_id', userId);
      return await executeFullSync(userId, accessToken);
    }

    // Check for previous pageToken
    const { data: syncLog } = await supabase
      .from('drive_sync_logs')
      .select('page_token')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let pageToken = syncLog?.page_token || null;

    if (pageToken) {
      console.log('[GDriveSyncEngine] Executing Delta Sync with pageToken:', pageToken);
      return await executeDeltaSync(userId, accessToken, pageToken);
    } else {
      console.log('[GDriveSyncEngine] Executing Full Metadata Sync...');
      return await executeFullSync(userId, accessToken);
    }
  } catch (err) {
    console.error('[GDriveSyncEngine] Sync failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Initial Full Metadata Fetch from Google Drive API
 */
async function executeFullSync(userId, accessToken) {
  let nextPageToken = null;
  let totalSynced = 0;
  const syncedFiles = [];
  const syncedFolders = [];

  // Create sync log entry
  const { data: logEntry } = await supabase
    .from('drive_sync_logs')
    .insert([{ user_id: userId, status: 'in_progress', start_time: new Date().toISOString() }])
    .select()
    .maybeSingle();

  try {
    do {
      const url = new URL('https://www.googleapis.com/drive/v3/files');
      url.searchParams.set('pageSize', '100');
      url.searchParams.set('q', 'trashed = false');
      url.searchParams.set('fields', 'nextPageToken, files(id, name, mimeType, size, thumbnailLink, webViewLink, webContentLink, parents, owners, starred, shared, trashed, createdTime, modifiedTime)');
      url.searchParams.set('supportsAllDrives', 'true');
      url.searchParams.set('includeItemsFromAllDrives', 'true');
      if (nextPageToken) url.searchParams.set('pageToken', nextPageToken);

      const resp = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        if (resp.status === 401 || resp.status === 403) {
          localStorage.removeItem('google_provider_token');
          return { needsAuth: true, error: 'Google Drive session expired. Please reconnect.' };
        }
        throw new Error(errData.error?.message || `Drive API error HTTP ${resp.status}`);
      }

      const data = await resp.json();
      const driveItems = data.files || [];
      nextPageToken = data.nextPageToken;

      for (const item of driveItems) {
        if (item.mimeType === 'application/vnd.google-apps.folder') {
          syncedFolders.push({
            user_id: userId,
            drive_id: item.id,
            name: item.name,
            is_favorite: !!item.starred,
            is_trashed: !!item.trashed,
            created_at: item.createdTime || new Date().toISOString(),
            updated_at: item.modifiedTime || new Date().toISOString()
          });
        } else {
          const category = categorizeMimeType(item.mimeType, item.name);
          syncedFiles.push({
            user_id: userId,
            drive_id: item.id,
            storage_source: 'gdrive',
            name: item.name || 'Untitled File',
            mime_type: item.mimeType || 'application/octet-stream',
            category: category,
            size: parseInt(item.size || '0', 10),
            thumbnail_url: item.thumbnailLink || `https://lh3.googleusercontent.com/d/${item.id}=s400`,
            web_view_link: item.webViewLink || `https://drive.google.com/file/d/${item.id}/view`,
            web_download_link: item.webContentLink || null,
            owner_email: item.owners?.[0]?.emailAddress || null,
            owner_name: item.owners?.[0]?.displayName || null,
            is_starred: !!item.starred,
            is_favorite: !!item.starred,
            is_shared: !!item.shared,
            is_trashed: !!item.trashed,
            created_at: item.createdTime || new Date().toISOString(),
            updated_at: item.modifiedTime || new Date().toISOString()
          });
        }
      }

      // Upsert into Supabase DB page by page to avoid payload limits
      if (syncedFolders.length > 0) {
        // Deduplicate to prevent Postgres ON CONFLICT errors within the same batch
        const dedupedFolders = Array.from(new Map(syncedFolders.map(f => [f.drive_id, f])).values());
        const { error: fErr } = await supabase.from('folders').upsert(dedupedFolders, { onConflict: 'user_id,drive_id' });
        if (fErr) {
          console.error('[GDriveSyncEngine] Folder batch upsert error, falling back to individual:', fErr);
          for (const folder of dedupedFolders) {
            const { error: indErr } = await supabase.from('folders').upsert([folder], { onConflict: 'user_id,drive_id' });
            if (indErr) console.error('[GDriveSyncEngine] Folder individual upsert error:', indErr);
          }
        }
        syncedFolders.length = 0; // Clear array after upsert
      }

      if (syncedFiles.length > 0) {
        // Deduplicate files within this batch
        const dedupedFiles = Array.from(new Map(syncedFiles.map(f => [f.drive_id, f])).values());
        
        // Try batch upsert first
        const { error: fErr, data: upsertedData } = await supabase
          .from('files')
          .upsert(dedupedFiles, { onConflict: 'user_id,drive_id', ignoreDuplicates: false });
        
        if (fErr) {
          console.error('[GDriveSyncEngine] Batch upsert error:', JSON.stringify(fErr));
          // Fall back to individual inserts, skipping any that fail
          for (const file of dedupedFiles) {
            // Try upsert first, then plain insert
            const { error: iErr } = await supabase.from('files').upsert([file], { onConflict: 'user_id,drive_id', ignoreDuplicates: false });
            if (iErr) {
              console.error('[GDriveSyncEngine] Individual file error:', file.name, JSON.stringify(iErr));
              // Last resort: delete existing and re-insert
              await supabase.from('files').delete().eq('drive_id', file.drive_id).eq('user_id', userId);
              const { error: riErr } = await supabase.from('files').insert([file]);
              if (riErr) console.error('[GDriveSyncEngine] Re-insert failed:', file.name, JSON.stringify(riErr));
            }
          }
        } else {
          console.log(`[GDriveSyncEngine] ✅ Upserted ${dedupedFiles.length} files successfully`);
        }
        syncedFiles.length = 0; // Clear array after upsert
      }

      totalSynced += driveItems.length;
    } while (nextPageToken);

    // Fetch startPageToken for delta sync
    const tokenResp = await fetch('https://www.googleapis.com/drive/v3/changes/startPageToken', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const tokenData = await tokenResp.json().catch(() => ({}));
    const newPageToken = tokenData.startPageToken || null;

    if (logEntry?.id) {
      await supabase.from('drive_sync_logs').update({
        status: 'completed',
        end_time: new Date().toISOString(),
        synced_count: totalSynced,
        page_token: newPageToken
      }).eq('id', logEntry.id);
    }

    return { success: true, count: totalSynced, pageToken: newPageToken, files: syncedFiles, folders: syncedFolders };
  } catch (err) {
    if (logEntry?.id) {
      await supabase.from('drive_sync_logs').update({
        status: 'failed',
        end_time: new Date().toISOString(),
        error_message: err.message
      }).eq('id', logEntry.id);
    }
    throw err;
  }
}

/**
 * Delta Sync using Google Drive Changes API
 */
async function executeDeltaSync(userId, accessToken, pageToken) {
  let nextPageToken = pageToken;
  let totalChanges = 0;
  let hasMore = false;

  try {
    do {
      const url = new URL('https://www.googleapis.com/drive/v3/changes');
      url.searchParams.set('pageToken', nextPageToken);
      url.searchParams.set('supportsAllDrives', 'true');
      url.searchParams.set('includeItemsFromAllDrives', 'true');
      url.searchParams.set('fields', 'nextPageToken, newStartPageToken, changes(fileId, removed, file(id, name, mimeType, size, thumbnailLink, webViewLink, webContentLink, starred, shared, trashed, createdTime, modifiedTime))');

      const resp = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!resp.ok) {
        console.warn('[GDriveSyncEngine] PageToken expired. Re-triggering full sync...');
        return await executeFullSync(userId, accessToken);
      }

      const data = await resp.json();
      const changes = data.changes || [];

      for (const change of changes) {
        const fileId = change.fileId;
        if (change.removed) {
          await supabase.from('files').delete().eq('drive_id', fileId);
          await supabase.from('folders').delete().eq('drive_id', fileId);
        } else if (change.file) {
          const item = change.file;
          if (item.mimeType === 'application/vnd.google-apps.folder') {
            const { error: fErr } = await supabase.from('folders').upsert([{
              user_id: userId,
              drive_id: item.id,
              name: item.name || 'Untitled Folder',
              is_favorite: !!item.starred,
              is_trashed: !!item.trashed,
              updated_at: item.modifiedTime || new Date().toISOString()
            }], { onConflict: 'user_id,drive_id' });
            if (fErr) console.error('[GDriveSyncEngine] Folder delta upsert error:', fErr);
          } else {
            const category = categorizeMimeType(item.mimeType, item.name);
            const { error: fErr } = await supabase.from('files').upsert([{
              user_id: userId,
              drive_id: item.id,
              storage_source: 'gdrive',
              name: item.name || 'Untitled File',
              mime_type: item.mimeType || 'application/octet-stream',
              category: category,
              size: parseInt(item.size || '0', 10),
              thumbnail_url: item.thumbnailLink || `https://lh3.googleusercontent.com/d/${item.id}=s400`,
              web_view_link: item.webViewLink || `https://drive.google.com/file/d/${item.id}/view`,
              web_download_link: item.webContentLink || null,
              is_starred: !!item.starred,
              is_favorite: !!item.starred,
              is_shared: !!item.shared,
              is_trashed: !!item.trashed,
              updated_at: item.modifiedTime || new Date().toISOString()
            }], { onConflict: 'user_id,drive_id' });
            if (fErr) console.error('[GDriveSyncEngine] File delta upsert error:', fErr);
          }
        }
      }

      totalChanges += changes.length;
      hasMore = !!data.nextPageToken;
      nextPageToken = data.nextPageToken || data.newStartPageToken;
    } while (hasMore);

    await supabase.from('drive_sync_logs').insert([{
      user_id: userId,
      status: 'completed',
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      synced_count: totalChanges,
      page_token: nextPageToken
    }]);

    return { success: true, count: totalChanges, pageToken: nextPageToken };
  } catch (err) {
    console.error('[GDriveSyncEngine] Delta sync error:', err);
    throw err;
  }
}
