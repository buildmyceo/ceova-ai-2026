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
    try {
      // Step A: Generate fresh signed URL with 24-hour expiration
      try {
        const { data: signData, error: signErr } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 86400);

        if (!signErr && signData?.signedUrl) {
          supabaseImageCache.set(cacheKey, signData.signedUrl);
          return signData.signedUrl;
        }
      } catch (e) {
        console.warn('[supabaseStorageHelper] Signed URL generation error:', e);
      }

      // Step B: Authenticated Blob download via Supabase Client (works on private buckets & bypasses CORS)
      try {
        const { data: blob, error: blobErr } = await supabase.storage
          .from(bucket)
          .download(path);

        if (!blobErr && blob) {
          const blobUrl = URL.createObjectURL(blob);
          supabaseImageCache.set(cacheKey, blobUrl);
          return blobUrl;
        }
      } catch (e) {
        console.warn('[supabaseStorageHelper] Download blob error:', e);
      }

      // Step C: Try public URL
      try {
        const { data: pubData } = supabase.storage
          .from(bucket)
          .getPublicUrl(path);

        if (pubData?.publicUrl) {
          supabaseImageCache.set(cacheKey, pubData.publicUrl);
          return pubData.publicUrl;
        }
      } catch (e) {}

      return url;
    } catch (err) {
      console.warn('[supabaseStorageHelper] Failed to resolve storage image:', cacheKey, err);
      return url;
    } finally {
      supabaseInFlight.delete(cacheKey);
    }
  })();

  supabaseInFlight.set(cacheKey, promise);
  return await promise;
}
