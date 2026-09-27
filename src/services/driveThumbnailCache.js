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
    if (item.includes('drive.google.com') || item.includes('googleusercontent.com')) {
      const match = item.match(/[-\w]{25,}/);
      return match ? match[0] : null;
    }
    // Only return if it's a raw drive ID string without slashes/dots
    if (!item.includes('/') && !item.includes('.') && item.length >= 25 && item.length <= 50) {
      return item.split('?')[0].split('&')[0];
    }
    return null;
  }
  if (item.drive_id) {
    return String(item.drive_id).split('?')[0].split('&')[0];
  }
  if (item.source === 'gdrive' && item.id) {
    if (!String(item.id).startsWith('att-')) {
      return String(item.id).split('?')[0].split('&')[0];
    }
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
 * Return high-resolution thumbnail URL for Google Drive items
 */
export function getDriveThumbnailUrl(item) {
  if (!item) return null;
  const driveId = extractDriveId(item);
  if (item.thumbnail_url && !item.thumbnail_url.includes('undefined')) {
    return item.thumbnail_url;
  }
  if (item.thumbnailLink) {
    return item.thumbnailLink;
  }
  if (driveId) {
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w600`;
  }
  return item.url || null;
}

/**
 * React hook to get a reliable image source for Google Drive or regular items
 */
export function useDriveThumbnail(item, fallbackSrc = null) {
  const isDriveItem = item?.source === 'gdrive' || !!item?.drive_id;
  const driveId = isDriveItem ? extractDriveId(item) : null;

  // Immediate thumbnail URL from Google CDN if available
  const driveThumbUrl = isDriveItem && driveId ? getDriveThumbnailUrl(item) : null;
  const nonDriveSrc = item?.thumbnail_url || item?.url || fallbackSrc;
  const initialSrc = isDriveItem ? (driveId && blobCache.has(driveId) ? blobCache.get(driveId) : driveThumbUrl || nonDriveSrc) : nonDriveSrc;

  const [src, setSrc] = useState(initialSrc);
  const [loading, setLoading] = useState(false);
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

    // Set immediate Google Drive CDN thumbnail if we don't have a blob yet
    const cdnThumb = getDriveThumbnailUrl(item);
    if (cdnThumb && src !== cdnThumb) {
      setSrc(cdnThumb);
    }

    let isMounted = true;

    // Fetch authenticated blob in background for maximum fidelity
    getDriveImageBlob(driveId)
      .then(blobUrl => {
        if (!isMounted) return;
        if (blobUrl) {
          setSrc(blobUrl);
          setError(false);
        } else {
          // If blob fetch failed, fallback to CDN thumbnail
          if (cdnThumb) {
            setSrc(cdnThumb);
            setError(false);
          } else if (!src) {
            setError(true);
          }
        }
      })
      .catch(() => {
        if (!isMounted) return;
        if (cdnThumb) {
          setSrc(cdnThumb);
        } else if (!src) {
          setError(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [driveId, isDriveItem, item?.thumbnail_url, item?.url, nonDriveSrc]);

  return { src, loading, error, driveId };
}

