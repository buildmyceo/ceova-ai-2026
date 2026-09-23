import { Tool, ToolMetadata, ToolContext, ToolResult } from '../types.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2';
import { Buffer } from 'node:buffer';

// ── PNG & Mask Helpers ────────────────────────────────────────────────────────

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c;
}

function crc32(buf: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function makePngChunk(type: string, data: Uint8Array): Uint8Array {
  const len = data.length;
  const chunk = new Uint8Array(8 + len + 4);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, len);
  for (let i = 0; i < 4; i++) {
    chunk[4 + i] = type.charCodeAt(i);
  }
  chunk.set(data, 8);
  const crcTarget = new Uint8Array(4 + len);
  for (let i = 0; i < 4; i++) {
    crcTarget[i] = type.charCodeAt(i);
  }
  crcTarget.set(data, 4);
  view.setUint32(8 + len, crc32(crcTarget));
  return chunk;
}

/** Extract width and height from PNG, JPEG, WebP, or GIF image buffer */
function getImageDimensions(bytes: Uint8Array): { width: number; height: number; format: string } {
  // PNG: signature 0x89 0x50 0x4E 0x47
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16);
    const height = view.getUint32(20);
    if (width > 0 && height > 0) return { width, height, format: 'png' };
  }

  // JPEG: starts with 0xFF 0xD8
  if (bytes.length >= 4 && bytes[0] === 0xFF && bytes[1] === 0xD8) {
    let offset = 2;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    while (offset < bytes.length - 8) {
      if (bytes[offset] !== 0xFF) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1];
      if ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC5 && marker <= 0xC7) || (marker >= 0xC9 && marker <= 0xCB) || (marker >= 0xCD && marker <= 0xCF)) {
        const height = view.getUint16(offset + 5);
        const width = view.getUint16(offset + 7);
        if (width > 0 && height > 0) return { width, height, format: 'jpeg' };
      }
      if (marker === 0xD9 || marker === 0xDA) break;
      const length = view.getUint16(offset + 2);
      if (length < 2) break;
      offset += 2 + length;
    }
  }

  // WebP: starts with RIFF ... WEBP
  if (bytes.length >= 30 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x20) {
      const width = (view.getUint16(26, true) & 0x3FFF);
      const height = (view.getUint16(28, true) & 0x3FFF);
      if (width > 0 && height > 0) return { width, height, format: 'webp' };
    }
    if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x4C) {
      const b0 = bytes[21], b1 = bytes[22], b2 = bytes[23], b3 = bytes[24];
      const width = 1 + (((b1 & 0x3F) << 8) | b0);
      const height = 1 + (((b3 & 0xF) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6));
      if (width > 0 && height > 0) return { width, height, format: 'webp' };
    }
    if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x58) {
      const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
      const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
      if (width > 0 && height > 0) return { width, height, format: 'webp' };
    }
  }

  return { width: 1024, height: 1024, format: 'unknown' };
}

/** Generate an RGBA PNG mask where the bounding box is transparent (alpha = 0) and the rest is opaque white (alpha = 255) */
export async function createMaskPng(
  width: number,
  height: number,
  box: { ymin: number; xmin: number; ymax: number; xmax: number }
): Promise<Uint8Array> {
  const yStart = Math.max(0, Math.floor((box.ymin / 100) * height));
  const yEnd = Math.min(height - 1, Math.ceil((box.ymax / 100) * height));
  const xStart = Math.max(0, Math.floor((box.xmin / 100) * width));
  const xEnd = Math.min(width - 1, Math.ceil((box.xmax / 100) * width));

  const rawLineLen = 1 + width * 4;
  const rawData = new Uint8Array(rawLineLen * height);

  for (let y = 0; y < height; y++) {
    const lineOffset = y * rawLineLen;
    rawData[lineOffset] = 0; // Filter byte: None
    const isYInBox = (y >= yStart && y <= yEnd);

    for (let x = 0; x < width; x++) {
      const pxOffset = lineOffset + 1 + x * 4;
      if (isYInBox && x >= xStart && x <= xEnd) {
        // Transparent: area for the AI to inpaint/regenerate
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      } else {
        // Opaque white: area to strictly preserve
        rawData[pxOffset] = 255;
        rawData[pxOffset + 1] = 255;
        rawData[pxOffset + 2] = 255;
        rawData[pxOffset + 3] = 255;
      }
    }
  }

  // Compress using native Web Streams API
  const stream = new Response(
    new Blob([rawData]).stream().pipeThrough(new CompressionStream('deflate'))
  );
  const compressedData = new Uint8Array(await stream.arrayBuffer());

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = new Uint8Array(13);
  const ihdrView = new DataView(ihdrData.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdrData[8] = 8;  // 8-bit depth
  ihdrData[9] = 6;  // RGBA
  ihdrData[10] = 0; // Compression method
  ihdrData[11] = 0; // Filter method
  ihdrData[12] = 0; // Interlace method
  const ihdrChunk = makePngChunk('IHDR', ihdrData);

  const idatChunk = makePngChunk('IDAT', compressedData);
  const iendChunk = makePngChunk('IEND', new Uint8Array(0));

  const totalLen = signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
  const pngBytes = new Uint8Array(totalLen);
  let pos = 0;
  pngBytes.set(signature, pos); pos += signature.length;
  pngBytes.set(ihdrChunk, pos); pos += ihdrChunk.length;
  pngBytes.set(idatChunk, pos); pos += idatChunk.length;
  pngBytes.set(iendChunk, pos); pos += iendChunk.length;

  return pngBytes;
}

// ── Inpainting Intent Helpers ─────────────────────────────────────────────────

/** Detect if user wants to remove/erase a specific object from an image */
function detectInpaintingIntent(message: string, history?: any[]): boolean {
  const msg = (message || '').trim();
  
  if (/\b(?:remove|erase|delete|take\s*out|cut\s*out|crop\s*out|clear|get\s*rid\s*of|without)\b/i.test(msg)) {
    if (/(?:transparent|bg|background)\s*(?:png|removal|remover)?$/i.test(msg)) {
      return false; // Background removal, not inpainting
    }
    return true;
  }
  
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
  
  const patterns = [
    /\b(?:remove|erase|delete|take\s*out|cut\s*out|crop\s*out|clear|get\s*rid\s*of)\s+(?:the\s+)?(?:that\s+)?(?:this\s+)?(.+?)(?:\s+from\s+(?:the\s+)?(?:image|photo|picture|scene))?$/i,
    /\bwithout\s+(?:the\s+)?(.+?)$/i,
  ];
  
  for (const pattern of patterns) {
    const match = msg.match(pattern);
    if (match && match[1]) {
      let obj = match[1].trim()
        .replace(/\s+(?:in|from|on|at)\s+(?:the\s+)?(?:image|photo|picture|scene).*$/i, '')
        .replace(/[.!?,;]+$/, '')
        .trim();
      if (obj.length > 1 && obj.length < 200) return obj;
    }
  }
  
  if (history && Array.isArray(history)) {
    for (const m of [...history].reverse()) {
      if (m.role === 'assistant' && typeof m.content === 'string') {
        const assistantMatch = m.content.match(/(?:remov|eras|delet)\w*\s+(?:the\s+)?(?:that\s+)?(.+?)(?:\s+from|\s+in|\s*[.!?])/i);
        if (assistantMatch?.[1]) return assistantMatch[1].trim();
      }
    }
  }
  
  return msg;
}

/** Build a surgical inpainting prompt that maximizes pixel preservation */
function buildInpaintingPrompt(objectToRemove: string): string {
  return `Remove the ${objectToRemove} from the image. Reconstruct the background behind it with matching texture, perspective, lighting, and shadow. Keep all people, faces, identities, expressions, hairstyles, clothing, skin tones, furniture, background wall, room decor, camera angle, lighting, and framing 100% identical and unchanged to the original photo.`;
}


export class GenerateImageTool implements Tool {
  metadata: ToolMetadata = {
    id: 'generate_image',
    name: 'Image Generator',
    description: 'Generates high-quality AI images, illustrations, and performs surgical object removal / inpainting on photos using OpenAI ChatGPT image models (chatgpt-image-latest). Use this tool when the user commands to generate, create, draw, design, or remove objects/people from images.',
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
          description: 'A detailed text description of the image to generate or the edit/removal to perform.'
        },
        size: {
          type: 'string',
          enum: ['1024x1024', '1024x1792', '1792x1024'],
          description: 'The aspect ratio/resolution of the image.'
        },
        quality: {
          type: 'string',
          enum: ['standard', 'hd'],
          description: 'The quality level.'
        },
        style: {
          type: 'string',
          enum: ['vivid', 'natural'],
          description: 'The style.'
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
          message: 'Please describe the image you want to generate or modify.'
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
      ? ['Analyzing image with ChatGPT…', 'Removing object…', 'Preserving details…', 'Finalizing output…']
      : (hasImageForEdit
        ? ['Editing image with ChatGPT…', 'Applying changes…', 'Preserving details…', 'Finalizing output…']
        : ['Generating image with ChatGPT…', 'Adding design…', 'Refining details…', 'Finalizing…']);

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
      let lastErrorMsg = 'Image operation failed.';
      let b64Data: string | null = null;
      let revisedPrompt: string = prompt;
      let generatedUrl: string | null = null;

      // ══════════════════════════════════════════════════════════════════════════
      // PATH 1: CHATGPT NATIVE MULTIMODAL IMAGE EDITING (Image Attached)
      // Directly uses OpenAI's official ChatGPT image model: chatgpt-image-latest
      // No artificial bounding box detection, no synthetic mask holes, no black boxes.
      // ══════════════════════════════════════════════════════════════════════════
      if (hasImageForEdit) {
        console.info('[GenerateImageTool] CHATGPT MULTIMODAL IMAGE EDITING MODE (chatgpt-image-latest)');
        updateStatus(isInpainting ? 'Removing object with ChatGPT…' : 'Editing image with ChatGPT…');

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
          
          // User's natural instruction for the edit
          const editPrompt = (userMessage || prompt).trim()
            .replace(/^\/?(?:generate_image|genrate_image)\s*/i, '')
            .trim();

          // Check if user manually supplied an explicit brush mask attachment (e.g. from canvas brush tool)
          const userMaskAttachment = context.attachments?.find((a: any) => 
            a !== targetImage && (a.isMask === true || (typeof a.name === 'string' && a.name.toLowerCase().includes('mask')))
          );
          let userMaskBlob: Blob | null = null;
          if (userMaskAttachment) {
            try {
              const maskRaw = userMaskAttachment.data || userMaskAttachment.content;
              if (maskRaw && typeof maskRaw === 'string') {
                const b64 = maskRaw.includes(',') ? maskRaw.split(',')[1] : maskRaw;
                const bStr = atob(b64);
                const uBytes = new Uint8Array(bStr.length);
                for (let i = 0; i < bStr.length; i++) uBytes[i] = bStr.charCodeAt(i);
                userMaskBlob = new Blob([uBytes.buffer], { type: 'image/png' });
              } else if (userMaskAttachment.url) {
                const mRes = await fetch(userMaskAttachment.url);
                if (mRes.ok) userMaskBlob = await mRes.blob();
              }
            } catch (mErr: any) {
              console.warn('[GenerateImageTool] Could not process user mask attachment:', mErr.message);
            }
          }

          // OpenAI ChatGPT model cascade: chatgpt-image-latest is the primary ChatGPT model
          const editCandidates = [
            'chatgpt-image-latest',
            'gpt-image-2.5-sunburst',
            'gpt-image-2',
            'gpt-image-1'
          ];

          for (const cand of editCandidates) {
            try {
              const formData = new FormData();
              formData.append('image', imageBlob, targetImage.name || 'image.png');
              if (userMaskBlob) {
                formData.append('mask', userMaskBlob, 'mask.png');
              }
              formData.append('prompt', editPrompt);
              formData.append('model', cand);
              formData.append('n', '1');

              console.info(`[GenerateImageTool] Calling /v1/images/edits with ${cand} (hasUserMask: ${!!userMaskBlob})…`);
              const editResponse = await fetch('https://api.openai.com/v1/images/edits', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}` },
                body: formData,
                signal: AbortSignal.timeout(60000)
              });

              const editResText = await editResponse.text();
              let editJson: any = null;
              try { editJson = JSON.parse(editResText); } catch {}

              if (editResponse.ok && editJson?.data?.[0]) {
                const imageObj = editJson.data[0];
                b64Data = imageObj.b64_json || null;
                revisedPrompt = imageObj.revised_prompt || editPrompt;
                generatedUrl = imageObj.url || null;
                console.info(`[GenerateImageTool] ✅ ChatGPT Edit SUCCESS with ${cand}`);
                break;
              } else {
                console.warn(`[GenerateImageTool] ${cand} failed (${editResponse.status}): ${editResText.slice(0, 300)}`);
                lastErrorMsg = editJson?.error?.message || `Edit error with ${cand} (${editResponse.status})`;
                if (editResponse.status === 401 || (editResText && (editResText.includes('insufficient_quota') || editResText.includes('billing_hard_limit_reached')))) {
                  throw new Error(lastErrorMsg);
                }
              }
            } catch (candErr: any) {
              console.warn(`[GenerateImageTool] Error calling ${cand}:`, candErr.message);
              lastErrorMsg = candErr.message;
              if (candErr.message?.includes('insufficient_quota') || candErr.message?.includes('invalid_api_key')) {
                throw candErr;
              }
            }
          }
        }
      }

      // If an image was provided for editing but editing failed, STOP.
      // NEVER fall back to DALL-E 3 text-to-image from scratch when the user asked to edit an existing photo!
      if (!b64Data && !generatedUrl && hasImageForEdit) {
        console.error(`[GenerateImageTool] Image edit failed across all models: ${lastErrorMsg}`);
        return {
          success: false,
          error: {
            code: 'EDIT_FAILED',
            message: `Could not edit the photo: ${lastErrorMsg || 'The edit model failed to process the request'}. Please try again.`
          }
        };
      }

      // ══════════════════════════════════════════════════════════════════════════
      // PATH 2: TEXT-TO-IMAGE GENERATION — Strictly for brand new prompts without an image
      // ══════════════════════════════════════════════════════════════════════════
      if (!b64Data && !generatedUrl) {
        const candidateModels = ['chatgpt-image-latest', 'gpt-image-2.5-sunburst', 'gpt-image-2.5-flare', 'gpt-image-1', 'dall-e-3', 'dall-e-2'];

        for (const model of candidateModels) {
          let requestBody: Record<string, any>;
          if (model === 'chatgpt-image-latest' || model === 'gpt-image-2.5-sunburst' || model === 'gpt-image-2.5-flare' || model === 'gpt-image-1') {
            requestBody = {
              model: model,
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
