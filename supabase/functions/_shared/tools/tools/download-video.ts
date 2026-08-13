import { Tool, ToolContext, ToolResult, ToolMetadata } from '../types.ts';

// Providers handled client-side via cobalt.tools widget
const COBALT_PROVIDERS = ['youtube.com', 'youtu.be', 'instagram.com', 'tiktok.com', 'twitter.com', 'x.com', 'reddit.com', 'twitch.tv'];

function detectCobaltProvider(url: string): string | null {
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'YouTube';
  if (lower.includes('instagram.com')) return 'Instagram';
  if (lower.includes('tiktok.com')) return 'TikTok';
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'X / Twitter';
  if (lower.includes('reddit.com')) return 'Reddit';
  if (lower.includes('twitch.tv')) return 'Twitch';
  return null;
}

function detectDirectVideo(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('.mp4') || lower.includes('.webm') || lower.includes('.mov');
}

export class DownloadVideoTool implements Tool {
  metadata: ToolMetadata = {
    id: 'prepare_video_download',
    name: 'Video Downloader',
    description: 'Download videos from YouTube, Instagram, TikTok, Twitter/X, Reddit, Twitch using cobalt.tools (free), or save direct .mp4/.webm/.mov files to CEOVA Drive.',
    category: 'Media Utilities',
    icon: 'download',
    requiresImage: false,
    requiresAuth: false,
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL of the video to download (YouTube, Instagram, TikTok, or direct .mp4/.webm/.mov link)'
        },
        quality: {
          type: 'string',
          description: 'Video quality preference',
          enum: ['max', '1080', '720', '480', '360', '144']
        },
        format: {
          type: 'string',
          description: 'Output format preference',
          enum: ['mp4', 'mp3', 'best']
        }
      },
      required: ['url']
    }
  };

  async execute(context: ToolContext): Promise<ToolResult> {
    const startTime = Date.now();
    const updateStatus = context.onStatusUpdate || (() => {});
    const params = context.args || {};

    try {
      // Try to extract URL from params or from the user message
      let url = params.url as string;

      // If no explicit URL param, try to extract from the user message
      if (!url && context.userMessage) {
        const urlMatch = context.userMessage.match(/https?:\/\/[^\s]+/);
        if (urlMatch) url = urlMatch[0];
      }

      if (!url) {
        return {
          success: false,
          error: 'No URL provided. Please share the video URL you want to download.',
          executionTime: Date.now() - startTime
        };
      }

      updateStatus('Analyzing video URL...');

      const cobaltProvider = detectCobaltProvider(url);
      const isDirectVideo = detectDirectVideo(url);

      // ── Social media: cobalt.tools widget ─────────────────────────────────
      if (cobaltProvider) {
        const quality = params.quality || '1080';
        const format = params.format || 'mp4';

        return {
          success: true,
          data: {
            type: 'video_downloader_widget',
            url,
            provider: cobaltProvider,
            quality,
            format,
            method: 'cobalt',
          },
          message: `Ready to download from ${cobaltProvider}. Using cobalt.tools — a free, open-source downloader. The download will go directly to your device.`,
          executionTime: Date.now() - startTime
        };
      }

      // ── Direct video file ──────────────────────────────────────────────────
      if (isDirectVideo) {
        return {
          success: true,
          data: {
            type: 'video_downloader_widget',
            url,
            provider: 'Direct',
            method: 'direct',
          },
          message: `Ready to prepare this direct video file for download and save it to your CEOVA Drive.`,
          executionTime: Date.now() - startTime
        };
      }

      // ── Unknown URL ────────────────────────────────────────────────────────
      return {
        success: false,
        error: `I couldn't recognize this as a supported video URL. Supported: YouTube, Instagram, TikTok, X/Twitter, Reddit, Twitch, or direct .mp4/.webm/.mov links. URL received: ${url}`,
        executionTime: Date.now() - startTime
      };

    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      return {
        success: false,
        error: `Video download error: ${err}`,
        executionTime: Date.now() - startTime
      };
    }
  }
}
