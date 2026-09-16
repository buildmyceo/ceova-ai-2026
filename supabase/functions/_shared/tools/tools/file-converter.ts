import { Tool, ToolMetadata, ToolContext, ToolResult } from '../types.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2';

export class FileConverterTool implements Tool {
  metadata: ToolMetadata = {
    id: 'file_converter',
    name: 'File Converter',
    description: 'Converts files between different formats (e.g. PDF to Image, Image to PDF, Word/Excel/CSV to PDF, JPG to PNG to WebP). Can also ZIP or Unzip files. Use this when the user asks to convert, zip, or unzip a file. IMPORTANT: Do not use this for PDF manipulation (merge, split, delete pages) - use pdf_toolkit instead.',
    category: 'AI Utilities',
    icon: 'refresh-cw',
    requiresImage: false,
    requiresAuth: false,
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['convert_to_pdf', 'convert_to_image', 'convert_image_format', 'zip', 'unzip'],
          description: 'The primary operation to perform on the file.'
        },
        targetFormat: {
          type: 'string',
          description: 'The target format to convert to (e.g., "pdf", "jpg", "png", "webp", "zip").'
        }
      },
      required: ['operation', 'targetFormat']
    }
  };

  async execute(context: ToolContext): Promise<ToolResult> {
    const updateStatus = context.onStatusUpdate || (() => {});
    const params = context.args || {};

    const attachments = context.attachments || [];
    if (attachments.length === 0) {
        return { success: false, error: { code: 'MISSING_FILE', message: 'No file provided for conversion.' } };
    }

    updateStatus('Preparing files for conversion...');
    
    const files = [];
    
    // We only need the raw file URL and type to send to the client. If they are base64, we upload them.
    for (const file of attachments) {
        let fileUrl = file.url;
        if (!fileUrl && file.content && file.content.startsWith('data:')) {
            updateStatus(`Uploading ${file.name || 'file'} to temporary storage...`);
            const base64Data = file.content.split(',')[1];
            const binaryStr = atob(base64Data);
            const len = binaryStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            
            const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
            const supabase = createClient(supabaseUrl, supabaseKey);
            
            const tempPath = `temp/${Date.now()}-${file.name || 'file'}`;
            const { error: uploadError } = await supabase.storage
                .from('processed_images')
                .upload(tempPath, bytes.buffer, { contentType: file.type });
                
            if (uploadError) {
                 return { success: false, error: { code: 'UPLOAD_FAILED', message: `Failed to upload ${file.name}: ` + uploadError.message } };
            }
            
            const { data: urlData } = await supabase.storage.from('processed_images').getPublicUrl(tempPath);
            fileUrl = urlData.publicUrl;
        }
        
        if (fileUrl) {
            files.push({
                url: fileUrl,
                name: file.name,
                type: file.type,
                size: (file as any).size || 0
            });
        }
    }

    if (files.length === 0) {
         return { success: false, error: { code: 'INVALID_FILE', message: 'Could not obtain valid URLs for the provided files.' } };
    }

    updateStatus(`Initiating local ${params.operation}...`);
    
    const actionMeta = {
        type: 'client_file_conversion',
        operation: params.operation,
        targetFormat: params.targetFormat,
        files: files
    };

    return {
        success: true,
        data: {
            text: `<!-- ACTION_META: ${JSON.stringify(actionMeta)} -->`,
            message: `Instructed frontend to perform ${params.operation} to ${params.targetFormat}.`,
            originalUrl: files[0].url
        },
        ui: {
            type: 'message',
            props: { text: `Processing file locally...` }
        }
    };
  }
}
