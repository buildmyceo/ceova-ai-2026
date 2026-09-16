import { Tool, ToolContext, ToolResult, ToolMetadata } from '../types.ts';

export class MediaConverterTool implements Tool {
  metadata: ToolMetadata = {
    id: 'media_converter',
    name: 'Audio & Video Converter',
    description: 'Convert video/audio formats, extract audio, resize videos, and trim media. Uses client-side WebAssembly to process files of any size safely and privately.',
    category: 'Media Utilities',
    icon: 'film',
    requiresImage: false,
    requiresAuth: false,
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        action: { 
          type: 'string', 
          description: 'The primary action to perform',
          enum: ['convert', 'extract_audio', 'trim', 'resize', 'compress'] 
        },
        target_format: { type: 'string', description: 'The format to convert to (e.g., mp4, mp3, wav, avi)' },
        resolution: { type: 'string', description: 'Target resolution for video (e.g., 720p, 1080p, 480p)' },
        start_time: { type: 'string', description: 'Start time for trimming (e.g., 00:00:10)' },
        end_time: { type: 'string', description: 'End time for trimming (e.g., 00:00:20)' },
      },
      required: ['action']
    }
  };

  async execute(context: ToolContext): Promise<ToolResult> {
    const startTime = Date.now();
    const params = context.args || {};
    const updateStatus = context.onStatusUpdate || (() => {});
    
    try {
      updateStatus(`Analyzing media request...`);

      // We need at least one media attachment to process
      let fileUrl = null;
      let filename = null;
      let fileType = null;
      
      if (context.attachments && context.attachments.length > 0) {
          const mediaAttachments = context.attachments.filter(a => a.type.startsWith('video/') || a.type.startsWith('audio/'));
          if (mediaAttachments.length > 0) {
              fileUrl = mediaAttachments[0].url;
              filename = mediaAttachments[0].name || 'input_media';
              fileType = mediaAttachments[0].type;
          }
      }

      if (!fileUrl) {
          throw new Error("No video or audio file found in the request. Please upload a file to convert.");
      }

      updateStatus(`Preparing FFmpeg instructions for ${params.action}...`);

      let ffmpegArgs: string[] = [];
      let outputFilename = `output_${Math.floor(Math.random() * 1000)}`;

      if (params.action === 'extract_audio') {
          const outExt = params.target_format || 'mp3';
          outputFilename += `.${outExt}`;
          // Extract audio: -vn removes video, -acodec libmp3lame (or copy/aac) encodes audio
          if (outExt === 'mp3') {
              ffmpegArgs = ['-i', 'input_file', '-vn', '-acodec', 'libmp3lame', '-q:a', '2', outputFilename];
          } else {
              ffmpegArgs = ['-i', 'input_file', '-vn', outputFilename];
          }
      } else if (params.action === 'trim') {
          const outExt = params.target_format || (filename.split('.').pop() || 'mp4');
          outputFilename += `.${outExt}`;
          
          if (!params.start_time || !params.end_time) {
              throw new Error("Start time and end time are required for trimming.");
          }
          ffmpegArgs = ['-i', 'input_file', '-ss', params.start_time, '-to', params.end_time, '-c', 'copy', outputFilename];
      } else if (params.action === 'resize' || params.action === 'compress') {
          const outExt = params.target_format || (filename.split('.').pop() || 'mp4');
          outputFilename += `.${outExt}`;
          
          // -vf scale=-2:720 (height 720, width proportional)
          let scaleFilter = '';
          if (params.resolution === '1080p') scaleFilter = '-vf scale=-2:1080';
          else if (params.resolution === '720p') scaleFilter = '-vf scale=-2:720';
          else if (params.resolution === '480p') scaleFilter = '-vf scale=-2:480';
          else scaleFilter = '-vf scale=-2:720'; // default
          
          const crf = params.action === 'compress' ? '28' : '23'; // Higher CRF = more compression

          const args = ['-i', 'input_file'];
          if (scaleFilter) {
              args.push(...scaleFilter.split(' '));
          }
          args.push('-c:v', 'libx264', '-crf', crf, '-preset', 'fast', '-c:a', 'aac', '-b:a', '128k', outputFilename);
          ffmpegArgs = args;
      } else {
          // generic convert
          const outExt = params.target_format || 'mp4';
          outputFilename += `.${outExt}`;
          if (outExt === 'mp4') {
             ffmpegArgs = ['-i', 'input_file', '-c:v', 'libx264', '-crf', '23', '-preset', 'fast', '-c:a', 'aac', '-b:a', '128k', outputFilename];
          } else if (outExt === 'mp3') {
             ffmpegArgs = ['-i', 'input_file', '-acodec', 'libmp3lame', '-q:a', '2', outputFilename];
          } else {
             // Fallback for general formats (let ffmpeg decide codecs based on extension)
             ffmpegArgs = ['-i', 'input_file', outputFilename];
          }
      }

      const actionMeta = {
          type: 'client_media_converter',
          mediaData: {
              fileUrl,
              filename,
              fileType,
              action: params.action,
              targetFormat: params.target_format,
              ffmpegArgs,
              outputFilename
          }
      };

      return {
          success: true,
          data: {
              text: `I've prepared the conversion task. The process will run securely in your browser.\n\n<!-- ACTION_META: ${JSON.stringify(actionMeta)} -->`,
              processingTimeMs: Date.now() - startTime
          }
      };

    } catch (e: any) {
      return {
        success: false,
        error: { code: 'EXECUTION_ERROR', message: e.message || 'An error occurred during media conversion setup' },
        data: {
            text: `Failed to prepare media conversion: ${e.message}`,
            processingTimeMs: Date.now() - startTime
        }
      };
    }
  }
}
