import { Tool, ToolMetadata, ToolContext, ToolResult } from '../types.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2';
import { Buffer } from 'node:buffer';

// ── Inpainting Intent Helpers ─────────────────────────────────────────────────

/** Detect if user wants to remove/erase a specific object from an image */
function detectInpaintingIntent(message: string, history?: any[]): boolean {
  const msg = (message || '').trim();
  
  // Direct removal commands
  if (/\b(?:remove|erase|delete|take\s*out|cut\s*out|crop\s*out|clear|get\s*rid\s*of|without)\b/i.test(msg)) {
    // Make sure it's about an object, not background removal
    if (/(?:transparent|bg|background)\s*(?:png|removal|remover)?$/i.test(msg)) {
      return false; // This is background removal, not object inpainting
    }
    return true;
  }
  
  // Confirmation after a previous removal discussion
  if (/^(?:ok|okay|yes|yep|yeah|sure|proceed|do\s*it|go\s*ahead|generate\s*it)\b/i.test(msg) && history) {
    const recentAssistant = [...(history || [])].reverse().find((m: any) => 
      m.role === 'assistant' && typeof m.content === 'string' &&
      /(?:remov|eras|delet|inpaint|take\s*out)/i.test(m.content)
    );
    if (recentAssistant) return true;
  }
  
  return false;
}

/** Extract the object name that the user wants removed */
function extractObjectToRemove(message: string, history?: any[]): string {
  const msg = (message || '').trim();
  
  // Pattern: "remove the red bottle", "erase that person", "delete the laptop"
  const patterns = [
    /\b(?:remove|erase|delete|take\s*out|cut\s*out|crop\s*out|clear|get\s*rid\s*of)\s+(?:the\s+)?(?:that\s+)?(?:both\s+)?(?:all\s+)?(.+?)(?:\s+from\s+(?:the\s+)?(?:image|photo|picture|scene))?$/i,
    /\bwithout\s+(?:the\s+)?(.+?)$/i,
  ];
  
  for (const pattern of patterns) {
    const match = msg.match(pattern);
    if (match && match[1]) {
      // Clean up the extracted object name
      let obj = match[1].trim()
        .replace(/\s+(?:in|from|on|at)\s+(?:the\s+)?(?:image|photo|picture|scene).*$/i, '')
        .replace(/[.!?,;]+$/, '')
        .trim();
      if (obj.length > 2 && obj.length < 200) return obj;
    }
  }
  
  // Fallback: look in history for what was discussed
  if (history && Array.isArray(history)) {
    for (const m of [...history].reverse()) {
      if (m.role === 'assistant' && typeof m.content === 'string') {
        const assistantMatch = m.content.match(/(?:remov|eras|delet)\w*\s+(?:the\s+)?(?:that\s+)?(.+?)(?:\s+from|\s+in|\s*[.!?])/i);
        if (assistantMatch?.[1]) return assistantMatch[1].trim();
      }
    }
  }
  
  return '';
}

/** Build a surgical inpainting prompt that maximizes pixel preservation */
function buildInpaintingPrompt(objectToRemove: string): string {
  return [
    `CRITICAL INSTRUCTION: This is an INPAINTING task. You MUST keep this EXACT photograph completely unchanged.`,
    `ONLY remove: "${objectToRemove}".`,
    `Fill the space where "${objectToRemove}" was with the natural background, surface, or texture that would logically be behind it (e.g., floor, wall, table surface, grass).`,
    `ABSOLUTE RULES:`,
    `- Do NOT change ANY other object, person, furniture, or element in the image.`,
    `- Do NOT change the lighting, color temperature, exposure, or white balance.`,
    `- Do NOT change the camera angle, perspective, or focal length.`,
    `- Do NOT add any new objects or elements.`,
    `- Do NOT alter textures, patterns, or materials of remaining objects.`,
    `- The result must look like the original photo with "${objectToRemove}" surgically erased.`,
    `- Match the exact photographic style: same noise level, same depth of field, same sharpness.`,
  ].join('\n');
}


export class GenerateImageTool implements Tool {
  metadata: ToolMetadata = {
    id: 'generate_image',
    name: 'Image Generator',
    description: 'Generates high-quality AI images, illustrations, artworks, and visuals from a text prompt using OpenAI (gpt-image-1). Use this tool when the user commands to generate, create, draw, design, or visualize an image. Do NOT call this tool for informational questions about models, tools, or how images are made.',
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
          description: 'A detailed text description of the image to generate. For modifying existing photos or removing objects/people, describe the entire scene in photographic detail as it should look, preserving the room, furniture, lighting, and environment, while completely omitting the removed objects or people.'
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
      prompt = context.message
        .replace(/^\/?(?:generate_image|genrate_image)\s*/i, '')
        .replace(/^(?:please\s+)?(?:generate|genrate|create|make|draw|paint|sketch|render)\s+(?:a |an |me |the )?(?:image|picture|photo|illustration|artwork|graphic|logo|wallpaper|portrait|banner|avatar)?(?:\s+of|\s+for)?\s*/i, '')
        .trim();
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

    // 2. Detect if this is an inpainting (object removal) request
    const userMessage = context.message || prompt;
    const isInpainting = detectInpaintingIntent(userMessage, context.history);
    const targetImage = context.attachments?.find((a: any) => a.type?.startsWith('image/'));
    const hasImageForEdit = !!targetImage;

    // Choose status stages based on operation type
    const statusStages = (isInpainting && hasImageForEdit)
      ? ['Analyzing image…', 'Removing object…', 'Almost done…', 'Adding final touches…']
      : ['Generating image…', 'Adding design…', 'Just completed…', 'Last edit…'];

    let currentStageIdx = 0;
    updateStatus(statusStages[currentStageIdx]);

    const stageTimer = setInterval(() => {
      if (currentStageIdx < statusStages.length - 1) {
        currentStageIdx++;
        updateStatus(statusStages[currentStageIdx]);
      }
    }, 3500);

    const isPhotoRequest = /photo|realistic|real|camera|shot|scene|room|cubicle|desk|person|people/i.test(prompt);
    const size = context.args?.size || '1024x1024';
    const quality = context.args?.quality || (isPhotoRequest ? 'hd' : 'standard');
    const style = context.args?.style || (isPhotoRequest ? 'natural' : 'vivid');

    try {
      let lastErrorMsg = 'Image generation failed.';
      let b64Data: string | null = null;
      let revisedPrompt: string = prompt;
      let generatedUrl: string | null = null;

      // ══════════════════════════════════════════════════════════════════════════
      // PATH A: INPAINTING — Object removal with pixel preservation
      // ══════════════════════════════════════════════════════════════════════════
      if (isInpainting && hasImageForEdit) {
        console.info('[GenerateImageTool] INPAINTING MODE — object removal detected');
        const objectToRemove = extractObjectToRemove(userMessage, context.history);
        const inpaintPrompt = objectToRemove
          ? buildInpaintingPrompt(objectToRemove)
          : prompt; // Fallback to the raw prompt if we can't extract object name

        console.info(`[GenerateImageTool] Object to remove: "${objectToRemove}"`);
        console.info(`[GenerateImageTool] Inpaint prompt: ${inpaintPrompt.slice(0, 200)}…`);

        // Decode the attached image into a buffer
        let imgBuffer: ArrayBuffer | null = null;
        const rawDataUrl = targetImage.data || targetImage.content;
        if (rawDataUrl && typeof rawDataUrl === 'string') {
          const base64Data = rawDataUrl.includes(',') ? rawDataUrl.split(',')[1] : rawDataUrl;
          const binaryStr = atob(base64Data);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          imgBuffer = bytes.buffer;
        } else if (targetImage.url) {
          const imgRes = await fetch(targetImage.url);
          if (imgRes.ok) {
            imgBuffer = await imgRes.arrayBuffer();
          }
        }

        if (imgBuffer) {
          const imageBlob = new Blob([imgBuffer], { type: 'image/png' });

          // Attempt inpainting edit with gpt-image-1
          try {
            const formData = new FormData();
            formData.append('image', imageBlob, 'source.png');
            formData.append('prompt', inpaintPrompt);
            formData.append('model', 'gpt-image-1');
            formData.append('n', '1');
            formData.append('size', '1024x1024');

            console.info('[GenerateImageTool] Calling /v1/images/edits (inpainting mode) with gpt-image-1…');
            const editResponse = await fetch('https://api.openai.com/v1/images/edits', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${apiKey}` },
              body: formData,
              signal: AbortSignal.timeout(60000) // 60s for inpainting
            });

            const editResText = await editResponse.text();
            let editJson: any = null;
            try { editJson = JSON.parse(editResText); } catch {}

            if (editResponse.ok && editJson?.data?.[0]) {
              const imageObj = editJson.data[0];
              b64Data = imageObj.b64_json || null;
              revisedPrompt = imageObj.revised_prompt || inpaintPrompt;
              generatedUrl = imageObj.url || null;
              console.info('[GenerateImageTool] ✅ Inpainting SUCCESS with gpt-image-1');
            } else {
              console.warn(`[GenerateImageTool] Inpainting failed (${editResponse.status}): ${editResText.slice(0, 300)}`);
              lastErrorMsg = editJson?.error?.message || `Inpainting error (${editResponse.status})`;
            }
          } catch (editErr: any) {
            console.warn('[GenerateImageTool] Inpainting error:', editErr.message);
            lastErrorMsg = editErr.message;
          }
        }
      }

      // ══════════════════════════════════════════════════════════════════════════
      // PATH B: STANDARD EDIT — Image attached but NOT inpainting
      // ══════════════════════════════════════════════════════════════════════════
      if (!b64Data && !generatedUrl && hasImageForEdit && !isInpainting) {
        try {
          let imgBuffer: ArrayBuffer | null = null;
          const rawDataUrl = targetImage.data || targetImage.content;
          if (rawDataUrl && typeof rawDataUrl === 'string') {
            const base64Data = rawDataUrl.includes(',') ? rawDataUrl.split(',')[1] : rawDataUrl;
            const binaryStr = atob(base64Data);
            const len = binaryStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            imgBuffer = bytes.buffer;
          } else if (targetImage.url) {
            const imgRes = await fetch(targetImage.url);
            if (imgRes.ok) {
              imgBuffer = await imgRes.arrayBuffer();
            }
          }

          if (imgBuffer) {
            const imageBlob = new Blob([imgBuffer], { type: targetImage.type || 'image/png' });
            try {
              const formData = new FormData();
              formData.append('image', imageBlob, targetImage.name || 'image.png');
              formData.append('prompt', prompt);
              formData.append('model', 'gpt-image-1');
              formData.append('n', '1');
              formData.append('size', '1024x1024');

              console.info('[GenerateImageTool] Attempting standard /v1/images/edits with gpt-image-1');
              const editResponse = await fetch('https://api.openai.com/v1/images/edits', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}` },
                body: formData,
                signal: AbortSignal.timeout(30000)
              });

              const editResText = await editResponse.text();
              let editJson: any = null;
              try { editJson = JSON.parse(editResText); } catch {}

              if (editResponse.ok && editJson?.data?.[0]) {
                const imageObj = editJson.data[0];
                b64Data = imageObj.b64_json || null;
                revisedPrompt = imageObj.revised_prompt || prompt;
                generatedUrl = imageObj.url || null;
                console.info('[GenerateImageTool] ✅ Standard edit SUCCESS with gpt-image-1');
              } else {
                console.warn(`[GenerateImageTool] Standard edit failed (${editResponse.status}): ${editResText.slice(0, 200)}`);
              }
            } catch (editErr: any) {
              console.warn('[GenerateImageTool] Standard edit error:', editErr.message);
            }
          }
        } catch (e: any) {
          console.warn('[GenerateImageTool] Error processing attachment for edit:', e.message);
        }
      }

      // ══════════════════════════════════════════════════════════════════════════
      // PATH C: GENERATION — No image attached, or edit failed → generate fresh
      // ══════════════════════════════════════════════════════════════════════════
      if (!b64Data && !generatedUrl) {
        const candidateModels = ['dall-e-3', 'gpt-image-1', 'dall-e-2'];

        for (const model of candidateModels) {
          let requestBody: Record<string, any>;
          if (model === 'gpt-image-1') {
            requestBody = {
              model: 'gpt-image-1',
              prompt: prompt,
              n: 1,
              size: '1024x1024'
            };
          } else if (model === 'dall-e-3') {
            requestBody = {
              model: 'dall-e-3',
              prompt: prompt,
              n: 1,
              size: size,
              quality: quality,
              style: style,
              response_format: 'b64_json'
            };
          } else {
            requestBody = {
              model: 'dall-e-2',
              prompt: prompt.slice(0, 1000),
              n: 1,
              size: '1024x1024',
              response_format: 'b64_json'
            };
          }

          try {
            console.info(`[GenerateImageTool] Attempting image generation with model: ${model}`);
            const response = await fetch('https://api.openai.com/v1/images/generations', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(requestBody),
              signal: AbortSignal.timeout(90000)
            });

          const resText = await response.text();
          let resJson: any = null;
          try {
            resJson = JSON.parse(resText);
          } catch {}

          if (response.ok && resJson?.data?.[0]) {
            const imageObj = resJson.data[0];
            b64Data = imageObj.b64_json || null;
            revisedPrompt = imageObj.revised_prompt || prompt;
            generatedUrl = imageObj.url || null;
            console.info(`[GenerateImageTool] Successfully generated image with ${model}`);
            break;
          } else {
            lastErrorMsg = resJson?.error?.message || `Error (${response.status}): ${resText.slice(0, 200)}`;
            console.warn(`[GenerateImageTool] Model ${model} failed (${response.status}): ${lastErrorMsg}`);
            
            // Fatal auth or billing error -> stop trying
            if (response.status === 401 || (resText && (resText.includes('insufficient_quota') || resText.includes('billing_hard_limit_reached')))) {
              throw new Error(lastErrorMsg);
            }
          }
          } catch (fetchErr: any) {
            lastErrorMsg = fetchErr.message;
            if (fetchErr.message?.includes('insufficient_quota') || fetchErr.message?.includes('invalid_api_key')) {
              throw fetchErr;
            }
          }
        }
      }

      if (!b64Data && !generatedUrl) {
        throw new Error(lastErrorMsg || 'No image returned from generation provider.');
      }

      updateStatus('Just adding details…');

      // 3. Persist to Supabase Storage
      let publicUrl = generatedUrl || '';

      if (b64Data) {
        try {
          const buffer = Buffer.from(b64Data, 'base64');
          const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://jqpbgcmrlpfqnellznhz.supabase.co';
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';

          if (supabaseUrl && supabaseKey) {
            const supabase = createClient(supabaseUrl, supabaseKey);
            const userFolder = context.userId || 'system';
            const fileName = `${userFolder}/${Date.now()}-ai-image.png`;

            const { error: uploadError } = await supabase.storage
              .from('processed_images')
              .upload(fileName, buffer, {
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
                    size: buffer.byteLength,
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
            const imgBuffer = Buffer.from(await imgFetch.arrayBuffer());
            const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://jqpbgcmrlpfqnellznhz.supabase.co';
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
            if (supabaseUrl && supabaseKey) {
              const supabase = createClient(supabaseUrl, supabaseKey);
              const userFolder = context.userId || 'system';
              const fileName = `${userFolder}/${Date.now()}-ai-image.png`;
              const { error: uploadError } = await supabase.storage
                .from('processed_images')
                .upload(fileName, imgBuffer, {
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
          isInpainting: isInpainting && hasImageForEdit,
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
    } finally {
      clearInterval(stageTimer);
    }
  }
}
