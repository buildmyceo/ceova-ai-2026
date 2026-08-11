import { Tool, ToolMetadata, ToolContext, ToolResult } from '../types.ts';
import { aiRouter } from '../../services/ai-router.ts';

export class ImageAnalysisTool implements Tool {
  metadata: ToolMetadata = {
    id: 'image_analysis',
    name: 'Image Analysis',
    description: 'Analyzes an uploaded image and answers the user\'s question about it.',
    category: 'AI Utilities',
    icon: 'eye',
    requiresImage: true,
    requiresAuth: false,
    enabled: true
  };

  async execute(context: ToolContext): Promise<ToolResult> {
    const startTime = Date.now();
    const updateStatus = context.onStatusUpdate || (() => {});

    updateStatus('Preparing image for analysis');
    
    const targetImage = context.attachments?.find(a => a.type.startsWith('image/'));
    if (!targetImage) {
      return {
        success: false,
        error: { code: 'INVALID_FILE', message: 'No valid image found in attachments.' }
      };
    }

    try {
      let base64Data: string;
      let mimeType = targetImage.type;
      
      if (targetImage.content && targetImage.content.startsWith('data:')) {
        base64Data = targetImage.content.split(',')[1];
      } else if (targetImage.url) {
        const imgRes = await fetch(targetImage.url);
        if (!imgRes.ok) throw new Error("Could not fetch the uploaded image.");
        const buffer = await imgRes.arrayBuffer();
        const uint8 = new Uint8Array(buffer);
        let binaryStr = '';
        for (let i = 0; i < uint8.length; i++) {
          binaryStr += String.fromCharCode(uint8[i]);
        }
        base64Data = btoa(binaryStr);
        mimeType = imgRes.headers.get('content-type') || mimeType;
      } else {
        throw new Error("No image data provided.");
      }

      updateStatus('Analyzing image');

      const apiKey = Deno.env.get("OPEN_AI") || Deno.env.get("OPENAI_API_KEY");
      if (!apiKey) throw new Error("OPEN_AI is not configured.");

      const promptText = context.message || "Describe this image in detail.";
      
      let aiResponse = "";
      
      const url = "https://api.openai.com/v1/chat/completions";
      const body = {
        model: "gpt-5.6-luna",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: promptText },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Data}`
                }
              }
            ]
          }
        ],
        max_completion_tokens: 2000,
        temperature: 0.2
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        const data = await res.json();
        aiResponse = data.choices[0]?.message?.content || "";
        
        // Log usage if user_id is provided
        if (context.userId) {
          const totalTokens = data.usage?.total_tokens || 0;
          await aiRouter.logUsage(context.userId, 'vision', totalTokens, true);
        }
      } else {
        const errText = await res.text();
        throw new Error(`OpenAI Vision error: ${res.status} ${errText}`);
      }



      updateStatus('Finished');

      return {
        success: true,
        data: {
          text: aiResponse,
          processingTimeMs: Date.now() - startTime
        }
      };

    } catch (e: any) {
      updateStatus('Failed');
      return {
        success: false,
        error: { code: 'ANALYSIS_ERROR', message: e.message || 'Image analysis failed.' }
      };
    }
  }
}
