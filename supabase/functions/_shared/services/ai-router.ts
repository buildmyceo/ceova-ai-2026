import { Logger } from "./logger.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export type TaskType = 
    | 'chat' | 'conversation' | 'memory' | 'gmail' | 'calendar' 
    | 'drive' | 'telegram' | 'library' | 'ocr' | 'pdf' | 'vision'
    | 'coding' | 'ide' | 'debugging' | 'architecture';

export interface AIResponse {
    content: string;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
    model: string;
}

export class AIRouter {
    private getModelsForTask(taskType: TaskType): string[] {
        return ['gpt-5.6-luna', 'gpt-5.4-nano', 'gpt-4o-mini'];
    }

    async generateContent(
        messages: any[],
        taskType: TaskType,
        userId: string,
        options: { temperature?: number, maxTokens?: number, tools?: any[] } = {}
    ): Promise<string> {
        const apiKey = Deno.env.get("OPEN_AI") || Deno.env.get("OPENAI_API_KEY");
        if (!apiKey) throw new Error("OPEN_AI is not configured.");

        const models = this.getModelsForTask(taskType);
        const temperature = options.temperature ?? 0.7;
        const maxTokens = options.maxTokens ?? 2000;

        const startTime = Date.now();
        let success = false;
        let totalTokens = 0;
        let promptTokens = 0;
        let completionTokens = 0;
        let content = "";
        let errorMsg = "";
        let finalModel = models[0];

        for (let attempt = 1; attempt <= 3; attempt++) {
            const currentModel = models[attempt - 1] || models[models.length - 1];
            finalModel = currentModel;
            try {
                Logger.INFO(`[AIRouter] Calling OpenAI (${currentModel}) attempt ${attempt}/3...`);
                
                const requestBody: any = {
                    model: currentModel,
                    messages: messages,
                    max_completion_tokens: maxTokens
                };
                
                // Only add temperature if it's not a model that restricts it
                if (!currentModel.includes('gpt-5.6') && !currentModel.includes('gpt-5.4') && !currentModel.startsWith('o1-')) {
                    requestBody.temperature = temperature;
                }

                if (options.tools && options.tools.length > 0) {
                    requestBody.tools = options.tools;
                    requestBody.tool_choice = "auto";
                }

                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(requestBody),
                    signal: AbortSignal.timeout(60000)
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`OpenAI HTTP ${response.status}: ${errText}`);
                }

                const data = await response.json();
                
                if (data.choices[0]?.message?.tool_calls && data.choices[0].message.tool_calls.length > 0) {
                    const tc = data.choices[0].message.tool_calls[0];
                    let parsedArgs = {};
                    try { parsedArgs = JSON.parse(tc.function.arguments); } catch(e) {}
                    content = JSON.stringify({
                        tool_call: {
                            tool: tc.function.name,
                            args: parsedArgs
                        }
                    });
                } else {
                    content = data.choices[0]?.message?.content || "";
                }
                
                promptTokens = data.usage?.prompt_tokens || 0;
                completionTokens = data.usage?.completion_tokens || 0;
                totalTokens = data.usage?.total_tokens || 0;
                success = true;
                break;
            } catch (error: any) {
                Logger.WARN(`[AIRouter] Error on attempt ${attempt}: ${error.message}`);
                errorMsg = error.message;
                if (attempt === 3) throw error;
                if (!error.message.includes("404")) {
                    await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
                }
            }
        }

        const latency = Date.now() - startTime;
        const estimatedCost = (totalTokens / 1_000_000) * (finalModel === 'gpt-4o' ? 5.00 : 0.15);

        if (userId && userId !== 'system') {
            try {
                await supabaseAdmin.from('api_request_logs').insert({
                    user_id: userId,
                    provider: 'openai',
                    model: finalModel,
                    tokens: totalTokens,
                    estimated_cost: estimatedCost,
                    success: success
                });
            } catch (e: any) {
                Logger.WARN(`[AIRouter] Failed to log usage metrics: ${e.message}`);
            }
        }

        if (!success) {
            throw new Error(`AI Router failed: ${errorMsg}`);
        }

        return content;
    }
    
    async generateStream(
        messages: any[],
        taskType: TaskType,
        options: { temperature?: number, maxTokens?: number } = {}
    ): Promise<Response> {
        const apiKey = Deno.env.get("OPEN_AI") || Deno.env.get("OPENAI_API_KEY");
        if (!apiKey) throw new Error("OPEN_AI is not configured.");
        
        const models = this.getModelsForTask(taskType);
        const model = models[0];
        const temperature = options.temperature ?? 0.7;
        const maxTokens = options.maxTokens ?? 2000;
        
        Logger.INFO(`[AIRouter] Streaming OpenAI (${model})...`);

        const requestBody: any = {
            model: model,
            messages: messages,
            max_completion_tokens: maxTokens,
            stream: true,
            stream_options: { include_usage: true }
        };

        if (!model.includes('gpt-5.6') && !model.includes('gpt-5.4') && !model.startsWith('o1-')) {
            requestBody.temperature = temperature;
        }

        return await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(60000)
        });
    }

    async logUsage(userId: string, taskType: TaskType, totalTokens: number, success: boolean = true) {
        if (!userId || userId === 'system') return;
        const models = this.getModelsForTask(taskType);
        const model = models[0];
        const estimatedCost = (totalTokens / 1_000_000) * (model === 'gpt-4o' ? 5.00 : 0.15);
        try {
            await supabaseAdmin.from('api_request_logs').insert({
                user_id: userId,
                provider: 'openai',
                model: model,
                tokens: totalTokens,
                estimated_cost: estimatedCost,
                success: success
            });
        } catch (e: any) {
            Logger.WARN(`[AIRouter] Failed to log usage metrics: ${e.message}`);
        }
    }
}

export const aiRouter = new AIRouter();
