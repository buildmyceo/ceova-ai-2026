import { Tool, ToolMetadata, ToolContext, ToolResult } from '../types.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2';

export class GenerateImageTool implements Tool {
  metadata: ToolMetadata = {
    id: 'generate_image',
    name: 'Image Generator',
    description: 'Generates high-quality AI images, illustrations, artworks, and visuals from a text prompt using OpenAI (DALL-E). Use this tool whenever the user wants to generate, create, draw, design, or visualize an image or picture.',
    category: 'AI Utilities',
    icon: 'sparkles',
    requiresImage: false,
    requiresAuth: false,
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'A detailed text description of the image you want to generate. Include details like subject, artistic style, lighting, color tone, mood, and composition.'
        },
        size: {
          type: 'string',
          enum: ['1024x1024', '1024x1792', '1792x1024'],
          description: 'The aspect ratio/resolution of the image. 1024x1024 (square, default), 1024x1792 (portrait / wallpaper), 1792x1024 (landscape / banner).'
        },
        quality: {
          type: 'string',
          enum: ['standard', 'hd'],
          description: 'The quality level. "hd" creates finer details and greater consistency. Defaults to "standard".'
        },
        style: {
          type: 'string',
          enum: ['vivid', 'natural'],
          description: 'The style. "vivid" causes the model to lean towards hyper-real and dramatic visuals. "natural" produces more natural, muted looks. Defaults to "vivid".'
        }
      },
      required: ['prompt']
    }
  };

  async execute(context: ToolContext): Promise<ToolResult> {
    const startTime = Date.now();
    const updateStatus = context.onStatusUpdate || (() => {});

    // 1. Resolve and validate prompt
    let prompt = context.args?.prompt;
    if (!prompt && context.message) {
      // Strip slash commands if user wrote "/generate_image <prompt>"
      prompt = context.message.replace(/^\/?generate_image\s*/i, '').trim();
    }

    if (!prompt || prompt.length === 0) {
      return {
        success: false,
        error: {
          code: 'MISSING_PROMPT',
          message: 'Please describe the image you want to generate (e.g., "A futuristic cityscape at sunset in cyberpunk style").'
        }
      };
    }

    updateStatus('Generating image with AI…');

    const apiKey = Deno.env.get('OPEN_AI') || Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return {
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'OpenAI API key is not configured.'
        }
      };
    }

    const size = context.args?.size || '1024x1024';
    const quality = context.args?.quality || 'standard';
    const style = context.args?.style || 'vivid';

    try {
      // 2. Call OpenAI Images API (DALL-E 3 with DALL-E 2 fallback)
      let b64Data: string | null = null;
      let revisedPrompt: string = prompt;
      let generatedUrl: string | null = null;

      const requestBody: Record<string, any> = {
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: size,
        quality: quality,
        style: style,
        response_format: 'b64_json'
      };

      let response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(90000)
      });

      let resText = await response.text();
      let resJson: any = null;
      try {
        resJson = JSON.parse(resText);
      } catch {}

      if (!response.ok) {
        console.warn(`[GenerateImageTool] DALL-E 3 error (${response.status}): ${resText}`);

        // Try DALL-E 2 fallback unless it is an outright invalid API key or insufficient quota
        const isFatalAuthOrQuota = response.status === 401 || 
          (resText && (resText.includes('insufficient_quota') || resText.includes('billing_hard_limit_reached')));

        if (!isFatalAuthOrQuota) {
          console.info('[GenerateImageTool] Falling back to dall-e-2...');
          const fallbackBody = {
            model: 'dall-e-2',
            prompt: prompt.slice(0, 1000), // DALL-E 2 max prompt length is 1000
            n: 1,
            size: '1024x1024',
            response_format: 'b64_json'
          };

          const fallbackResponse = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(fallbackBody),
            signal: AbortSignal.timeout(90000)
          });

          const fallbackText = await fallbackResponse.text();
          let fallbackJson: any = null;
          try {
            fallbackJson = JSON.parse(fallbackText);
          } catch {}

          if (fallbackResponse.ok && fallbackJson?.data?.[0]) {
            response = fallbackResponse;
            resJson = fallbackJson;
            resText = fallbackText;
          } else {
            console.warn(`[GenerateImageTool] DALL-E 2 fallback also failed (${fallbackResponse.status}): ${fallbackText}`);
            if (fallbackJson?.error?.message) {
              resJson = fallbackJson;
            }
          }
        }

        if (!response.ok) {
          const parsedError = resJson?.error?.message || `Image generation failed (${response.status}): ${resText.slice(0, 300)}`;
          throw new Error(parsedError);
        }
      }

      const resData = resJson;
      const imageObj = resData?.data?.[0];
      if (!imageObj) {
        throw new Error('No image returned from generation provider.');
      }

      b64Data = imageObj.b64_json || null;
      revisedPrompt = imageObj.revised_prompt || prompt;
      generatedUrl = imageObj.url || null;

      updateStatus('Saving generated image…');

      // 3. Persist to Supabase Storage if binary data available
      let publicUrl = generatedUrl || '';

      if (b64Data) {
        try {
          const binaryStr = atob(b64Data);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }

          const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';

          if (supabaseUrl && supabaseKey) {
            const supabase = createClient(supabaseUrl, supabaseKey);
            const userFolder = context.userId || 'system';
            const fileName = `${userFolder}/${Date.now()}-ai-image.png`;

            const { error: uploadError } = await supabase.storage
              .from('processed_images')
              .upload(fileName, bytes.buffer, {
                contentType: 'image/png',
                upsert: true
              });

            if (!uploadError) {
              const { data: { publicUrl: pUrl } } = supabase.storage
                .from('processed_images')
                .getPublicUrl(fileName);
              publicUrl = pUrl;

              // Also record in files table if authenticated user
              if (context.userId && context.userId !== 'system') {
                try {
                  await supabase.from('files').insert({
                    user_id: context.userId,
                    storage_source: 'local',
                    name: `AI_Image_${Date.now()}.png`,
                    mime_type: 'image/png',
                    category: 'images',
                    size: bytes.byteLength,
                    web_download_link: publicUrl,
                    web_view_link: publicUrl
                  });
                } catch (dbErr: any) {
                  console.warn('[GenerateImageTool] Could not add to files table:', dbErr.message);
                }
              }
            } else {
              console.warn('[GenerateImageTool] Storage upload failed:', uploadError.message);
            }
          }
        } catch (storageErr: any) {
          console.warn('[GenerateImageTool] Failed processing image for storage:', storageErr.message);
        }

        // Fallback to data URL if upload failed and no URL
        if (!publicUrl) {
          publicUrl = `data:image/png;base64,${b64Data}`;
        }
      } else if (generatedUrl) {
        // If provider returned a temporary remote URL, cache it in Supabase storage so it persists
        try {
          const imgFetch = await fetch(generatedUrl);
          if (imgFetch.ok) {
            const imgBytes = new Uint8Array(await imgFetch.arrayBuffer());
            const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
            if (supabaseUrl && supabaseKey) {
              const supabase = createClient(supabaseUrl, supabaseKey);
              const userFolder = context.userId || 'system';
              const fileName = `${userFolder}/${Date.now()}-ai-image.png`;
              const { error: uploadError } = await supabase.storage
                .from('processed_images')
                .upload(fileName, imgBytes.buffer, {
                  contentType: 'image/png',
                  upsert: true
                });
              if (!uploadError) {
                const { data: { publicUrl: pUrl } } = supabase.storage
                  .from('processed_images')
                  .getPublicUrl(fileName);
                publicUrl = pUrl;
              }
            }
          }
        } catch (storageErr: any) {
          console.warn('[GenerateImageTool] Could not cache remote URL:', storageErr.message);
        }
      }

      updateStatus('Finished');

      return {
        success: true,
        data: {
          url: publicUrl,
          prompt: prompt,
          revised_prompt: revisedPrompt,
          size: size,
          processingTimeMs: Date.now() - startTime
        }
      };

    } catch (e: any) {
      updateStatus('Failed');
      return {
        success: false,
        error: {
          code: 'GENERATION_ERROR',
          message: e.message || 'Image generation failed.'
        }
      };
    }
  }
}
