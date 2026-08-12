import { Tool, ToolContext, ToolResult } from '../types.ts';

function rejectPrivate(url: string): boolean {
  return /localhost|127\.|192\.168\.|10\.\d+\.\d+\.|0\.0\.0\.0/.test(url) || url.startsWith('file://');
}

export class PrepareVideoDownloadTool implements Tool {
  metadata = {
    id: 'prepare_video_download',
    name: 'Prepare Video Download',
    description: `Prepare a downloadable video file from a supported public direct video URL (.mp4, .webm, .mov).
    NOTE: CEOVA Web currently supports only direct video URLs. YouTube, Instagram, and TikTok require the CEOVA Desktop App.`,
    category: 'Media',
    icon: 'Video',
    requiresImage: false,
    requiresAuth: true,
    enabled: true,
    parameters: {
      type: "object" as const,
      properties: {
        url: {
          type: 'string',
          description: 'The direct public video URL to download (.mp4, .webm, .mov)',
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

    const actionMeta = {
      type: 'client_video_downloader',
      url,
      provider: 'direct',
    };

    return {
      success: true,
      data: {
        text: `<!-- ACTION_META: ${JSON.stringify(actionMeta)} -->`,
        message: `Opening video downloader for direct URL.`,
      }
    };
  }
}
