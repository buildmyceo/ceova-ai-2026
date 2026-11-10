/**
 * Unified Downloader for Web and Native Mobile (Android WebView / Capacitor)
 * Solves the issue where Android WebView ignores `<a download>` and `blob:` URL clicks.
 */

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Downloads a file from a URL, Blob, or base64 data string.
 * Works seamlessly in both mobile apps (saves to Android Downloads) and web browsers.
 *
 * @param {string|Blob|File} urlOrBlob - Target to download
 * @param {string} [filename='download'] - Desired filename
 * @param {string} [mimeType=''] - Optional MIME type
 */
export async function downloadFile(urlOrBlob, filename = 'download', mimeType = '') {
  if (!urlOrBlob) {
    console.warn('[Downloader] No URL or Blob provided for download');
    return;
  }

  // 1. Check if running inside Android app with our native bridge
  if (typeof window !== 'undefined' && window.AndroidDownloader) {
    try {
      // Case A: Blob or File object
      if (urlOrBlob instanceof Blob) {
        const type = mimeType || urlOrBlob.type || 'application/octet-stream';
        const name = filename || urlOrBlob.name || 'download';
        const base64 = await blobToBase64(urlOrBlob);
        window.AndroidDownloader.downloadBase64(base64, name, type);
        return;
      }

      const str = String(urlOrBlob).trim();

      // Case B: Data URI (e.g. data:image/png;base64,...)
      if (str.startsWith('data:')) {
        const type = mimeType || (str.match(/data:([^;]+);/)?.[1] || 'application/octet-stream');
        window.AndroidDownloader.downloadBase64(str, filename, type);
        return;
      }

      // Case C: Blob URL (e.g. blob:https://...)
      if (str.startsWith('blob:')) {
        try {
          const res = await fetch(str);
          const blob = await res.blob();
          const type = mimeType || blob.type || 'application/octet-stream';
          const base64 = await blobToBase64(blob);
          window.AndroidDownloader.downloadBase64(base64, filename, type);
          return;
        } catch (fetchErr) {
          console.warn('[Downloader] Failed to resolve blob URL:', fetchErr);
        }
      }

      // Case D: HTTP or HTTPS URL
      if (str.startsWith('http://') || str.startsWith('https://')) {
        // Try fetching as Blob first (ensures authenticated images, private Supabase urls, etc. download directly)
        try {
          const res = await fetch(str, { mode: 'cors' });
          if (res.ok) {
            const blob = await res.blob();
            const type = mimeType || blob.type || 'application/octet-stream';
            const base64 = await blobToBase64(blob);
            window.AndroidDownloader.downloadBase64(base64, filename, type);
            return;
          }
        } catch {
          // If fetch fails (e.g. CORS restrictions), fallback to native Android DownloadManager
        }

        window.AndroidDownloader.downloadUrl(str, filename, mimeType || 'application/octet-stream');
        return;
      }

      // Fallback: pass directly to downloadUrl
      window.AndroidDownloader.downloadUrl(str, filename, mimeType || 'application/octet-stream');
      return;
    } catch (nativeErr) {
      console.error('[Downloader] Native download error, falling back to browser download:', nativeErr);
    }
  }

  // 2. Standard Browser Fallback
  try {
    let finalUrl = urlOrBlob;
    let revoke = false;

    if (urlOrBlob instanceof Blob) {
      finalUrl = URL.createObjectURL(urlOrBlob);
      revoke = true;
    }

    const a = document.createElement('a');
    a.href = finalUrl;
    a.download = filename || 'download';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (revoke) {
      setTimeout(() => URL.revokeObjectURL(finalUrl), 10000);
    }
  } catch (err) {
    console.error('[Downloader] Browser download error:', err);
    if (typeof urlOrBlob === 'string') {
      window.open(urlOrBlob, '_blank');
    }
  }
}

/**
 * Initializes automatic interception of `<a download>` and programmatic `.click()`
 * so that any library or component downloading files works automatically in the mobile app.
 */
export function initDownloadInterceptor() {
  if (typeof window === 'undefined') return;

  // Expose downloadFile globally
  window.downloadFile = downloadFile;

  // 1. Intercept user click events on elements with download attribute
  document.addEventListener(
    'click',
    (e) => {
      const target = e.target.closest && e.target.closest('a[download]');
      if (!target) return;

      if (window.AndroidDownloader) {
        const href = target.getAttribute('href') || target.href;
        const filename = target.getAttribute('download') || 'download';
        if (href) {
          e.preventDefault();
          e.stopPropagation();
          downloadFile(href, filename);
        }
      }
    },
    true
  );

  // 2. Patch HTMLAnchorElement.prototype.click so document.createElement('a').click() works
  try {
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (window.AndroidDownloader && this.hasAttribute('download')) {
        const href = this.getAttribute('href') || this.href;
        const filename = this.getAttribute('download') || 'download';
        if (href) {
          downloadFile(href, filename);
          return;
        }
      }
      return originalClick.apply(this, arguments);
    };
  } catch (patchErr) {
    console.warn('[Downloader] Could not patch HTMLAnchorElement.prototype.click:', patchErr);
  }
}
