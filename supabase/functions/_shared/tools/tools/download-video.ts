import { Tool, ToolContext, ToolResult } from '../types.ts';

export class DownloadVideoTool implements Tool {
  metadata = {
    id: 'download_video',
    name: 'Video Downloader',
    description: `Extracts video metadata and qualities from public URLs (YouTube, Instagram, MP4).
WARNING: Never attempt to download copyrighted or private content without explicit user permission.
Only process publicly accessible URLs.
Downloads are saved temporarily to CEOVA Drive and auto-delete after 20 minutes.`,
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
          description: 'The public URL of the video to extract',
        },
      },
      required: ['url'],
    }
  };

  async execute(context: ToolContext): Promise<ToolResult> {
    try {
      const url = context.args?.url;
      if (!url) {
        return { success: false, error: { code: 'bad_request', message: 'URL is required' } };
      }

      // Check for backend API URL, default to Vercel production if not local
      let apiUrl = Deno.env.get('VERCEL_URL') || 'ceova.online';
      if (!apiUrl.startsWith('http')) {
        apiUrl = `https://${apiUrl}`;
      }

      const response = await fetch(`${apiUrl}/api/video_extractor?action=extract&url=${encodeURIComponent(url)}`);
      
      if (!response.ok) {
        throw new Error(`Extraction failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        return { success: false, error: { code: 'extraction_failed', message: data.error || 'Failed to extract video' } };
      }

      const actionMeta = {
        type: 'client_video_downloader',
        title: data.title,
        thumbnail: data.thumbnail,
        duration: data.duration,
        provider: data.provider,
        qualities: data.qualities,
        url: url
      };

      return {
        success: true,
        data: {
          text: `<!-- ACTION_META: ${JSON.stringify(actionMeta)} -->`,
          message: 'Video metadata extracted successfully. The frontend should display a Video Downloader card with quality options.'
        }
      };
    } catch (e: any) {
      return { success: false, error: { code: 'server_error', message: e.message } };
    }
  }
}
