/**
 * CEOVA Centralized AI Provider Abstraction
 * 
 * MODEL RULE:
 * - AI_PROVIDER: openai
 * - AI_MODEL: gpt-5.6-luna
 * 
 * Exclusively used for all Ceova Cloud Development & Hosting operations.
 * Groq, Gemini, and other providers are strictly prohibited in this workflow.
 */

import { Logger } from "../services/logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2';

export const AI_PROVIDER = 'openai' as const;
export const AI_MODEL = 'gpt-5.6-luna' as const;

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

export interface AIProviderOptions {
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  timeoutMs?: number;
}

export interface AIProviderResult {
  content: string;
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: Record<string, any>;
    };
  }>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
}

export class AIProviderService {
  private static readonly MODEL_NAME = AI_MODEL;
  private static readonly FALLBACK_MODEL = 'gpt-4o'; // OpenAI fallback if luna endpoint alias resolves standard

  /**
   * Executes a complete chat completion via GPT-5.6 Luna
   */
  static async generate(
    messages: ChatMessage[],
    userId: string = 'system',
    options: AIProviderOptions = {}
  ): Promise<AIProviderResult> {
    const apiKey = Deno.env.get("OPEN_AI") || Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      throw new Error("OpenAI API key (OPEN_AI or OPENAI_API_KEY) is not configured.");
    }

    const temperature = options.temperature ?? 0.2;
    const maxTokens = options.maxTokens ?? 4000;
    const timeoutMs = options.timeoutMs ?? 90000;

    let success = false;
    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let content = "";
    let toolCalls: AIProviderResult['toolCalls'] = undefined;
    let errorMsg = "";
    let resolvedModel = this.MODEL_NAME;

    // Retry loop with exponential backoff (Max 3 attempts)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        Logger.INFO(`[AIProvider] Requesting ${this.MODEL_NAME} (Attempt ${attempt}/3)`);

        const requestBody: Record<string, any> = {
          model: this.MODEL_NAME,
          messages: messages,
          max_completion_tokens: maxTokens,
          temperature: temperature,
        };

        if (options.tools && options.tools.length > 0) {
          requestBody.tools = options.tools;
          requestBody.tool_choice = options.toolChoice || "auto";
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (!response.ok) {
          const errText = await response.text();
          // If the model alias fails with 404/model_not_found, try fallback model gracefully
          if ((response.status === 404 || errText.includes("model_not_found")) && resolvedModel !== this.FALLBACK_MODEL) {
            Logger.WARN(`[AIProvider] ${this.MODEL_NAME} not directly supported on current OpenAI key, using ${this.FALLBACK_MODEL}`);
            resolvedModel = this.FALLBACK_MODEL;
            requestBody.model = this.FALLBACK_MODEL;
            
            const fallbackRes = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(requestBody),
              signal: AbortSignal.timeout(timeoutMs),
            });

            if (!fallbackRes.ok) {
              throw new Error(`OpenAI HTTP ${fallbackRes.status}: ${await fallbackRes.text()}`);
            }

            const data = await fallbackRes.json();
            return this.parseResponse(data, userId, resolvedModel);
          }

          throw new Error(`OpenAI HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();
        return this.parseResponse(data, userId, resolvedModel);

      } catch (error: any) {
        Logger.WARN(`[AIProvider] Attempt ${attempt} failed: ${error.message}`);
        errorMsg = error.message;

        if (attempt === 3) break;
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }

    throw new Error(`AI Provider (${this.MODEL_NAME}) invocation failed: ${errorMsg}`);
  }

  /**
   * Helper to parse and log OpenAI response format
   */
  private static async parseResponse(
    data: any,
    userId: string,
    model: string
  ): Promise<AIProviderResult> {
    const choice = data.choices?.[0];
    const message = choice?.message;
    const content = message?.content || "";
    let toolCalls: AIProviderResult['toolCalls'] = undefined;

    if (message?.tool_calls && Array.isArray(message.tool_calls)) {
      toolCalls = message.tool_calls.map((tc: any) => {
        let args = {};
        try {
          args = typeof tc.function.arguments === 'string' 
            ? JSON.parse(tc.function.arguments) 
            : tc.function.arguments;
        } catch {
          args = {};
        }
        return {
          id: tc.id || crypto.randomUUID(),
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: args,
          },
        };
      });
    }

    const promptTokens = data.usage?.prompt_tokens || 0;
    const completionTokens = data.usage?.completion_tokens || 0;
    const totalTokens = data.usage?.total_tokens || (promptTokens + completionTokens);

    // Estimate cost ($5 / million tokens)
    const estimatedCost = (totalTokens / 1_000_000) * 5.0;

    if (userId && userId !== 'system') {
      try {
        await supabaseAdmin.from('api_request_logs').insert({
          user_id: userId,
          provider: AI_PROVIDER,
          model: model,
          tokens: totalTokens,
          estimated_cost: estimatedCost,
          success: true,
        });
      } catch (e: any) {
        Logger.WARN(`[AIProvider] Failed to log usage metrics: ${e.message}`);
      }
    }

    return {
      content,
      toolCalls,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
      },
      model,
      provider: AI_PROVIDER,
    };
  }

  /**
   * Streams chat completion for real-time SSE user chat
   */
  static async stream(
    messages: ChatMessage[],
    options: AIProviderOptions = {}
  ): Promise<Response> {
    const apiKey = Deno.env.get("OPEN_AI") || Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OpenAI API key is not configured.");

    const maxTokens = options.maxTokens ?? 4000;
    const temperature = options.temperature ?? 0.7;

    const requestBody: Record<string, any> = {
      model: this.MODEL_NAME,
      messages: messages,
      max_completion_tokens: maxTokens,
      temperature: temperature,
      stream: true,
      stream_options: { include_usage: true },
    };

    if (options.tools && options.tools.length > 0) {
      requestBody.tools = options.tools;
      requestBody.tool_choice = options.toolChoice || "auto";
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(90000),
    });

    if (!res.ok && res.status === 404) {
      // Fallback model if alias not on current key
      requestBody.model = this.FALLBACK_MODEL;
      return await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(90000),
      });
    }

    return res;
  }
}
