import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { getGoogleAccessToken } from './gdriveSyncEngine';

// In-memory cache for resolved Drive image blob URLs to avoid re-fetching
const blobCache = new Map(); // driveId -> blobUrl
const inFlightCache = new Map(); // driveId -> Promise<string | null>
const failedCache = new Set(); // driveIds that permanently failed (e.g. 404 or unreadable)

// Limit concurrency to prevent Google API rate limits and network congestion
const MAX_CONCURRENT = 4;
let activeRequests = 0;
const queue = [];

function enqueueRequest(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    processQueue();
  });
}

function processQueue() {
  if (activeRequests >= MAX_CONCURRENT || queue.length === 0) return;
  const { fn, resolve, reject } = queue.shift();
  activeRequests++;
  fn()
    .then(resolve)
    .catch(reject)
    .finally(() => {
      activeRequests--;
      processQueue();
    });
}

/**
 * Clean and extract a valid Google Drive file ID
 */
export function extractDriveId(item) {
  if (!item) return null;
  if (typeof item === 'string') {
    return item.split('?')[0].split('&')[0].split('#')[0];
  }
  if (item.drive_id) {
    return String(item.drive_id).split('?')[0].split('&')[0];
  }
  if (item.source === 'gdrive' && item.id) {
    return String(item.id).split('?')[0].split('&')[0];
  }
  // Drive file IDs are alphanumeric and usually ~28-44 chars without dashes (unlike UUIDs)
  if (item.id && !String(item.id).includes('-') && String(item.id).length >= 15) {
    return String(item.id).split('?')[0].split('&')[0];
  }
  return null;
}

/**
 * Fetch Google Drive image file bytes using authenticated API and create a local Blob URL
 */
export async function getDriveImageBlob(driveId, userId = null) {
  const cleanId = extractDriveId(driveId);
  if (!cleanId) return null;

  // 1. Check in-memory cache
  if (blobCache.has(cleanId)) {
    return blobCache.get(cleanId);
  }

  // 2. If it already failed, don't keep retrying
  if (failedCache.has(cleanId)) {
    return null;
  }

  // 3. If request is already in-flight, reuse promise
  if (inFlightCache.has(cleanId)) {
    return await inFlightCache.get(cleanId);
  }

  const promise = enqueueRequest(async () => {
    try {
      let token = await getGoogleAccessToken(userId);
      if (!token) {
        console.warn('[driveThumbnailCache] No Google access token available for driveId:', cleanId);
        return null;
      }

      let res = await fetch(`https://www.googleapis.com/drive/v3/files/${cleanId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Handle 401 token expiration with silent refresh
      if (res.status === 401) {
        try {
          const { data: refreshData } = await supabase.functions.invoke('refresh-google-token');
          if (refreshData?.access_token) {
            token = refreshData.access_token;
            localStorage.setItem('google_provider_token', token);
            res = await fetch(`https://www.googleapis.com/drive/v3/files/${cleanId}?alt=media`, {
              headers: { Authorization: `Bearer ${token}` }
            });
          }
        } catch (refreshErr) {
          console.warn('[driveThumbnailCache] Token refresh failed:', refreshErr);
        }
      }

      if (!res.ok) {
        // If file not found or permission issue
        if (res.status === 404 || res.status === 403) {
          failedCache.add(cleanId);
        }
        return null;
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      blobCache.set(cleanId, blobUrl);
      return blobUrl;
    } catch (err) {
      console.warn('[driveThumbnailCache] Error loading drive image:', err);
      return null;
    } finally {
      inFlightCache.delete(cleanId);
    }
  });

  inFlightCache.set(cleanId, promise);
  return await promise;
}

/**
 * React hook to get a reliable image source for Google Drive or regular items
 */
export function useDriveThumbnail(item, fallbackSrc = null) {
  const driveId = extractDriveId(item);
  const isDriveItem = !!driveId || item?.source === 'gdrive';

  // Compute non-drive default src
  const nonDriveSrc = item?.thumbnail_url || item?.url || fallbackSrc;

  const [src, setSrc] = useState(() => {
    if (!isDriveItem) return nonDriveSrc;
    if (driveId && blobCache.has(driveId)) return blobCache.get(driveId);
    // If we have an existing thumbnail_url that isn't a known failing pattern, can try as initial
    return item?.thumbnail_url || null;
  });

  const [loading, setLoading] = useState(() => {
    if (!isDriveItem) return false;
    if (driveId && blobCache.has(driveId)) return false;
    return true;
  });

  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isDriveItem || !driveId) {
      setSrc(nonDriveSrc);
      setLoading(false);
      setError(false);
      return;
    }

    if (blobCache.has(driveId)) {
      setSrc(blobCache.get(driveId));
      setLoading(false);
      setError(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    getDriveImageBlob(driveId)
      .then(blobUrl => {
        if (!isMounted) return;
        if (blobUrl) {
          setSrc(blobUrl);
          setError(false);
        } else {
          // If blob fetch failed, try whatever fallback or thumbnail link exists
          if (!src && !item?.thumbnail_url) {
            setError(true);
          }
        }
      })
      .catch(() => {
        if (!isMounted) return;
        if (!src) setError(true);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [driveId, isDriveItem, item?.thumbnail_url, item?.url, nonDriveSrc]);

  return { src, loading, error, driveId };
}
