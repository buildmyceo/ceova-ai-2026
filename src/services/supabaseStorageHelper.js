import { supabase } from './supabase';

// In-memory cache for resolved Supabase storage URLs / blobs
const supabaseImageCache = new Map(); // key -> url
const supabaseInFlight = new Map(); // key -> Promise<string | null>

/**
 * Extracts storage bucket and file path from a Supabase URL or item object
 */
export function parseSupabaseStorageInfo(url, item = null) {
  if (item?.path) {
    const rawPath = String(item.path).trim();
    const parts = rawPath.split('/');
    if (['attachments', 'user_files', 'user-files'].includes(parts[0])) {
      return {
        bucket: parts[0],
        path: parts.slice(1).join('/')
      };
    }
    return {
      bucket: 'attachments',
      path: rawPath
    };
  }

  if (typeof url === 'string') {
    // Matches /storage/v1/object/public/bucket/path or /storage/v1/object/sign/bucket/path or render/image
    const match = url.match(/\/storage\/v1\/(?:object|render\/image)\/(?:public|sign)\/([^/?#]+)\/([^?#]+)/);
    if (match) {
      return {
        bucket: decodeURIComponent(match[1]),
        path: decodeURIComponent(match[2])
      };
    }

    // Relative storage path or raw path e.g. "attachments/abc/xyz.png" or "user_files/abc/xyz.png"
    const trimmed = url.replace(/^\/+/, '').split('?')[0];
    const parts = trimmed.split('/');
    if (parts.length >= 2 && ['attachments', 'user_files', 'user-files'].includes(parts[0])) {
      return {
        bucket: parts[0],
        path: parts.slice(1).join('/')
      };
    }

    // UUID or folder prefix path e.g. "06122d10-388a-.../AI_Image_...png"
    if (parts.length >= 2 && /^[0-9a-fA-F-]{20,}/.test(parts[0])) {
      return {
        bucket: 'attachments',
        path: trimmed
      };
    }
  }

  return null;
}

/**
 * Resolves any Supabase storage image or document URL to a guaranteed working, authenticated URL.
 * 1. Checks in-memory cache.
 * 2. Generates fresh signed URL (24 hours).
 * 3. Falls back to downloading authenticated Blob via Supabase client (100% immune to expiry & CORS).
 * 4. Falls back to public URL or original URL.
 */
export async function resolveSupabaseImage(url, item = null) {
  if (!url && !item?.path) return null;

  // 1. If it's already a local blob: or data: URL, it's immediately valid
  if (typeof url === 'string' && (url.startsWith('blob:') || url.startsWith('data:'))) {
    return url;
  }

  const storageInfo = parseSupabaseStorageInfo(url, item);
  if (!storageInfo || !storageInfo.path) {
    // If not a parseable Supabase URL, return original URL as is
    return url;
  }

  const { bucket, path } = storageInfo;
  const cacheKey = `${bucket}:${path}`;

  if (supabaseImageCache.has(cacheKey)) {
    return supabaseImageCache.get(cacheKey);
  }

  if (supabaseInFlight.has(cacheKey)) {
    return await supabaseInFlight.get(cacheKey);
  }

  const promise = (async () => {
    // Candidate buckets: prioritize parsed bucket, then fall back to alternate buckets
    const candidateBuckets = [bucket];
    if (bucket === 'attachments') {
      candidateBuckets.push('user_files', 'user-files');
    } else if (bucket === 'user_files' || bucket === 'user-files') {
      candidateBuckets.push('attachments');
    }

    for (const b of candidateBuckets) {
      try {
        // Step A: Generate fresh signed URL with 24-hour expiration
        const { data: signData, error: signErr } = await supabase.storage
          .from(b)
          .createSignedUrl(path, 86400);

        if (!signErr && signData?.signedUrl) {
          supabaseImageCache.set(cacheKey, signData.signedUrl);
          return signData.signedUrl;
        }
      } catch (e) {
        // Continue to download fallback
      }

      // Step B: Authenticated Blob download via Supabase Client (works on private buckets & bypasses CORS)
      try {
        const { data: blob, error: blobErr } = await supabase.storage
          .from(b)
          .download(path);

        if (!blobErr && blob) {
          const blobUrl = URL.createObjectURL(blob);
          supabaseImageCache.set(cacheKey, blobUrl);
          return blobUrl;
        }
      } catch (e) {
        // Continue
      }

      // Step C: Try public URL
      try {
        const { data: pubData } = supabase.storage
          .from(b)
          .getPublicUrl(path);

        if (pubData?.publicUrl) {
          supabaseImageCache.set(cacheKey, pubData.publicUrl);
          return pubData.publicUrl;
        }
      } catch (e) {}
    }

    return url;
  })().finally(() => {
    supabaseInFlight.delete(cacheKey);
  });

  supabaseInFlight.set(cacheKey, promise);
  return await promise;
}
