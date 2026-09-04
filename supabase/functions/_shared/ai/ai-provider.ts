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
  content: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: any[];
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
  rawToolCalls?: any[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedPromptTokens?: number;
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

    // Retry loop with exponential backoff (Max 4 attempts)
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        Logger.INFO(`[AIProvider] Requesting ${resolvedModel} (Attempt ${attempt}/4)`);

        const isLuna = resolvedModel.includes('luna');
        const requestBody: Record<string, any> = {
          model: resolvedModel,
          messages: messages,
          max_completion_tokens: maxTokens,
        };

        if (!isLuna && options.temperature !== undefined) {
          requestBody.temperature = options.temperature;
        }

        if (options.tools && options.tools.length > 0) {
          requestBody.tools = options.tools;
          requestBody.tool_choice = options.toolChoice || "auto";
          if (isLuna) {
            requestBody.reasoning_effort = "none";
          }
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
          
          // 1. If temperature is unsupported, remove temperature and retry
          if (errText.includes("temperature") && requestBody.temperature !== undefined) {
            Logger.WARN(`[AIProvider] Temperature unsupported by model ${resolvedModel}, retrying without temperature.`);
            delete requestBody.temperature;
            const retryRes = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(requestBody),
              signal: AbortSignal.timeout(timeoutMs),
            });
            if (retryRes.ok) {
              const data = await retryRes.json();
              return this.parseResponse(data, userId, resolvedModel);
            }
          }

          // 2. If reasoning_effort needed for tools, retry with reasoning_effort: 'none'
          if (errText.includes("reasoning_effort") && !requestBody.reasoning_effort) {
            Logger.WARN(`[AIProvider] Setting reasoning_effort: none for ${resolvedModel}`);
            requestBody.reasoning_effort = "none";
            delete requestBody.temperature;
            const retryRes = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(requestBody),
              signal: AbortSignal.timeout(timeoutMs),
            });
            if (retryRes.ok) {
              const data = await retryRes.json();
              return this.parseResponse(data, userId, resolvedModel);
            }
          }

          // 3. If model genuinely not found on key (404), fallback gracefully to FALLBACK_MODEL (gpt-4o)
          if ((response.status === 404 || errText.includes("model_not_found")) && resolvedModel !== this.FALLBACK_MODEL) {
            Logger.WARN(`[AIProvider] ${resolvedModel} not found on key, falling back to ${this.FALLBACK_MODEL}`);
            resolvedModel = this.FALLBACK_MODEL;
            requestBody.model = this.FALLBACK_MODEL;
            delete requestBody.reasoning_effort;
            delete requestBody.temperature;
            
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

          // 3. If rate limited (429), wait and retry dynamically
          if (response.status === 429 || errText.includes("rate_limit")) {
            let waitTimeMs = Math.pow(2, attempt) * 4000;
            const match = errText.match(/try again in ([\d\.]+)s/i);
            if (match && match[1]) {
              waitTimeMs = Math.min(25000, Math.ceil(parseFloat(match[1]) * 1000) + 1500);
            }
            Logger.WARN(`[AIProvider] 429 Rate limited. Waiting ${waitTimeMs}ms before attempt ${attempt + 1}...`);
            await new Promise((r) => setTimeout(r, waitTimeMs));
            continue;
          }

          throw new Error(`OpenAI HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();
        return this.parseResponse(data, userId, resolvedModel);

      } catch (error: any) {
        Logger.WARN(`[AIProvider] Attempt ${attempt} failed: ${error.message}`);
        errorMsg = error.message;

        if (attempt >= 4) break;
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1500));
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
    const cachedPromptTokens = data.usage?.prompt_tokens_details?.cached_tokens || 0;

    if (cachedPromptTokens > 0) {
      Logger.INFO(`[AIProvider] OpenAI Prompt Cache Hit: ${cachedPromptTokens} / ${promptTokens} tokens cached (${Math.round(cachedPromptTokens / promptTokens * 100)}%)`);
    }

    // Estimate cost ($5 / million tokens, with 50% discount for cached prompt tokens per OpenAI pricing)
    const uncachedPromptTokens = Math.max(0, promptTokens - cachedPromptTokens);
    const estimatedCost = ((uncachedPromptTokens * 5.0) + (cachedPromptTokens * 2.5) + (completionTokens * 15.0)) / 1_000_000;

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
      rawToolCalls: message?.tool_calls || undefined,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
        cachedPromptTokens,
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

    const isLuna = this.MODEL_NAME.includes('luna');
    const requestBody: Record<string, any> = {
      model: this.MODEL_NAME,
      messages: messages,
      max_completion_tokens: maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    };

    if (!isLuna) {
      requestBody.temperature = temperature;
    }

    if (options.tools && options.tools.length > 0) {
      requestBody.tools = options.tools;
      requestBody.tool_choice = options.toolChoice || "auto";
      if (isLuna) {
        requestBody.reasoning_effort = "none";
      }
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
