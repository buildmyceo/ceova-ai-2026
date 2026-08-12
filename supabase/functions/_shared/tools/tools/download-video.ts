import { Tool, ToolContext, ToolResult } from '../types.ts';

// Allowed video URL patterns
const VIDEO_DOMAINS = [
  'youtube.com', 'youtu.be', 'instagram.com', 'tiktok.com',
  'vimeo.com', 'twitter.com', 'x.com', 'dailymotion.com',
  'reddit.com', 'facebook.com', 'twitch.tv',
];

function isPublicVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    // Allow direct media links
    if (url.match(/\.(mp4|webm|m3u8|mkv)(\?|$)/i)) return true;
    return VIDEO_DOMAINS.some(d => host === d || host.endsWith('.' + d));
  } catch {
    return false;
  }
}

function rejectPrivate(url: string): boolean {
  return /localhost|127\.|192\.168\.|10\.\d+\.\d+\.|0\.0\.0\.0/.test(url);
}

export class DownloadVideoTool implements Tool {
  metadata = {
    id: 'download_video',
    name: 'Video Downloader',
    description: `Shows a video download panel for public URLs (YouTube, Instagram, TikTok, Vimeo, Twitter/X, MP4 links).
The user can choose the format (MP4 or MP3/audio) and quality (1080p / 720p / 480p / Audio Only) before downloading.
Downloads are temporary and auto-delete after 20 minutes.
WARNING: Never process copyrighted or private content without explicit user permission. Only use public URLs.`,
    category: 'Media',
    icon: 'Video',
    requiresImage: false,
    requiresAuth: false,
    enabled: true,
    parameters: {
      type: "object" as const,
      properties: {
        url: {
          type: 'string',
          description: 'The public video URL to download (YouTube, Instagram, TikTok, Vimeo, Twitter/X, or direct .mp4/.webm link)',
        },
      },
      required: ['url'],
    }
  };

  async execute(context: ToolContext): Promise<ToolResult> {
    const url = context.args?.url;
    if (!url) {
      return { success: false, error: { code: 'bad_request', message: 'URL is required' } };
    }

    if (rejectPrivate(url)) {
      return { success: false, error: { code: 'forbidden', message: 'Private or local network URLs are not permitted.' } };
    }

    if (!isPublicVideoUrl(url)) {
      return { success: false, error: { code: 'unsupported', message: `URL not supported. Supported: YouTube, Instagram, TikTok, Vimeo, Twitter/X, and direct .mp4/.webm links.` } };
    }

    // Detect provider name for the UI badge
    let provider = 'Video';
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      if (host.includes('youtube') || host.includes('youtu.be')) provider = 'YouTube';
      else if (host.includes('instagram')) provider = 'Instagram';
      else if (host.includes('tiktok')) provider = 'TikTok';
      else if (host.includes('vimeo')) provider = 'Vimeo';
      else if (host.includes('twitter') || host.includes('x.com')) provider = 'Twitter/X';
      else if (host.includes('dailymotion')) provider = 'Dailymotion';
      else if (url.match(/\.(mp4|webm)/i)) provider = 'Direct MP4';
    } catch {}

    // Return an ACTION_META that tells the frontend to render the picker widget.
    // Metadata extraction (title, thumbnail, qualities) happens in the browser
    // via the /api/video_extractor endpoint — NOT from the edge function.
    const actionMeta = {
      type: 'client_video_downloader',
      url,
      provider,
      // These will be populated by the frontend widget after it calls the extractor API
      title: null,
      thumbnail: null,
      duration: null,
      qualities: null,
    };

    return {
      success: true,
      data: {
        text: `<!-- ACTION_META: ${JSON.stringify(actionMeta)} -->`,
        message: `Opening video downloader for ${provider} URL. The user can now choose quality and format.`,
      }
    };
  }
}
