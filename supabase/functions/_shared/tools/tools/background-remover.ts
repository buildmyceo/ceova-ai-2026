import { Tool, ToolMetadata, ToolContext, ToolResult } from '../types.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2.45.2';

export class BackgroundRemoverTool implements Tool {
  metadata: ToolMetadata = {
    id: 'background_remover',
    name: 'Background Remover',
    description: 'Removes the background from an uploaded image and returns a transparent PNG.',
    category: 'AI Utilities',
    icon: 'scissors',
    requiresImage: true,
    requiresAuth: false,
    enabled: true
  };

  async execute(context: ToolContext): Promise<ToolResult> {
    const startTime = Date.now();
    const updateStatus = context.onStatusUpdate || (() => {});

    // 1. Preparing Image
    updateStatus('Preparing image');
    
    const targetImage = context.attachments?.find(a => a.type.startsWith('image/'));
    if (!targetImage) {
      return {
        success: false,
        error: { code: 'INVALID_FILE', message: 'No valid image found in attachments.' }
      };
    }

    try {
      // Note: `targetImage.content` usually contains the base64 or it's a URL we can fetch
      let imageBuffer: ArrayBuffer;
      let contentType = targetImage.type;
      
      if (targetImage.content && targetImage.content.startsWith('data:')) {
        const base64Data = targetImage.content.split(',')[1];
        const binaryStr = atob(base64Data);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        imageBuffer = bytes.buffer;
      } else if (targetImage.url) {
        const imgRes = await fetch(targetImage.url);
        if (!imgRes.ok) throw new Error("Could not fetch the uploaded image.");
        imageBuffer = await imgRes.arrayBuffer();
        contentType = imgRes.headers.get('content-type') || contentType;
      } else {
        throw new Error("No image data provided.");
      }

      // 2. Removing Background
      updateStatus('Removing background');
      
      const apiKey = Deno.env.get('REMOVE_BG_API_KEY');
      if (!apiKey) {
        throw new Error('REMOVE_BG_API_KEY is not configured in Supabase secrets.');
      }

      const formData = new FormData();
      formData.append('image_file', new Blob([imageBuffer], { type: contentType }), targetImage.name || 'image.png');
      formData.append('size', 'auto');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const bgRes = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key': apiKey
        },
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!bgRes.ok) {
        const errorText = await bgRes.text();
        console.error("Remove.bg error:", errorText);
        throw new Error(`Background removal API failed: ${bgRes.statusText}`);
      }

      const resultBuffer = await bgRes.arrayBuffer();

      // 3. Optimizing and Uploading PNG
      updateStatus('Optimizing PNG');
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const fileId = `${context.userId}/${Date.now()}-bg-removed.png`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('processed_images') // Requires a 'processed_images' bucket to exist
        .upload(fileId, resultBuffer, {
          contentType: 'image/png',
          upsert: false
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw new Error(`Failed to save processed image: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('processed_images')
        .getPublicUrl(fileId);

      updateStatus('Finished');

      return {
        success: true,
        data: {
          url: publicUrl,
          fileId: fileId,
          mimeType: 'image/png',
          processingTimeMs: Date.now() - startTime
        }
      };

    } catch (e: any) {
      updateStatus('Failed');
      
      if (e.name === 'AbortError') {
        return {
          success: false,
          error: { code: 'TIMEOUT', message: 'The background removal process timed out.' }
        };
      }
      
      return {
        success: false,
        error: { code: 'API_ERROR', message: e.message || 'Background removal failed.' }
      };
    }
  }
}
