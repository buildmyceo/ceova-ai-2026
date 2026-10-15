import { Tool, ToolMetadata, ToolContext, ToolResult } from '../types.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2';

export class FileSizeReductionTool implements Tool {
  metadata: ToolMetadata = {
    id: 'file_size_reduction',
    name: 'File Size Reduction',
    description: 'Reduces the size of images and PDFs while preserving quality. Use this when the user asks to compress a file, reduce image/PDF size, make a file smaller, or optimize a file for sharing/upload.',
    category: 'AI Utilities',
    icon: 'minimize2',
    requiresImage: false,
    requiresAuth: false,
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        targetSizeKB: {
          type: 'number',
          description: 'The target file size in KB.'
        }
      }
    }
  };

  async execute(context: ToolContext): Promise<ToolResult> {
    const updateStatus = context.onStatusUpdate || (() => {});
    const params = context.args || {};

    const targetFile = context.attachments?.[0];
    if (!targetFile) {
        return { success: false, error: { code: 'MISSING_FILE', message: 'No file provided in attachments.' } };
    }

    updateStatus('Preparing file...');
    
    // We need a public URL for the file to pass to external APIs.
    // If the file is base64, we upload it to Supabase first.
    let fileUrl = targetFile.url;
    let contentType = targetFile.type;
    
    if (!fileUrl && targetFile.content && targetFile.content.startsWith('data:')) {
        updateStatus('Uploading to temporary storage...');
        const base64Data = targetFile.content.split(',')[1];
        const binaryStr = atob(base64Data);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        const tempPath = `temp/${Date.now()}-${targetFile.name || 'file'}`;
        const { error: uploadError } = await supabase.storage
            .from('processed_images')
            .upload(tempPath, bytes.buffer, { contentType });
            
        if (uploadError) {
             return { success: false, error: { code: 'UPLOAD_FAILED', message: 'Failed to upload file to temporary storage: ' + uploadError.message } };
        }
        
        const { data: urlData } = await supabase.storage.from('processed_images').getPublicUrl(tempPath);
        fileUrl = urlData.publicUrl;
    }

    if (!fileUrl) {
         return { success: false, error: { code: 'INVALID_FILE', message: 'Could not obtain a valid URL for the file.' } };
    }

    const originalSize = (context.attachments && context.attachments.length > 0) ? (context.attachments[0] as any).size || 0 : 0;
    
    updateStatus('Initiating local compression...');
    
    const actionMeta = {
        type: 'client_file_compression',
        fileName: targetFile.name || 'compressed_file',
        url: fileUrl,
        originalSize,
        fileType: contentType,
        targetSizeKB: params.targetSizeKB
    };

    return {
        success: true,
        data: {
            text: `<!-- ACTION_META: ${JSON.stringify(actionMeta)} -->`,
            message: `Instructed frontend to compress ${targetFile.name || 'file'} locally.`,
            originalUrl: fileUrl
        },
        ui: {
            type: 'message',
            props: { text: `Processing file locally...` }
        }
    };
  }
}
