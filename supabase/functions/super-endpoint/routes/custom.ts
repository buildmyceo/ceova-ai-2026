import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.2";
import { decrypt } from "../../_utils/encryption.ts";

export async function handleCustomApps(supabase: any, userId: string, prompt: string, history: any[] = []) {
    // 1. Fetch user's custom apps
    const { data: apps } = await supabase
        .from("user_custom_apps")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true);

    if (!apps || apps.length === 0) return null;

    // 2. Quick check: does the prompt mention any of these apps?
    const p = prompt.toLowerCase();
    const matchingApp = apps.find(app => 
        p.includes(app.name.toLowerCase()) || 
        (app.instructions && p.includes(app.name.toLowerCase()))
    );

    if (!matchingApp) return null;

    console.log(`[CUSTOM APP] Matched: ${matchingApp.name}`);

    // 3. Load secrets for this app
    const { data: secrets } = await supabase
        .from("user_app_secrets")
        .select("secret_name, secret_value")
        .eq("app_id", matchingApp.id);

    const decryptedSecrets: Record<string, string> = {};
    if (secrets) {
        for (const s of secrets) {
            try {
                const encryptedObj = typeof s.secret_value === 'string' ? JSON.parse(s.secret_value) : s.secret_value;
                decryptedSecrets[s.secret_name] = await decrypt(encryptedObj);
            } catch (e: any) {
                console.error(`[CUSTOM APP] Decryption failed for ${s.secret_name}:`, e.message);
            }
        }
    }

    // 4. Use AI to decide how to call this API based on the user's instructions
    const systemPrompt = `You are an API orchestrator. The user has a custom app called "${matchingApp.name}".
Instructions for this app: "${matchingApp.instructions}"
Base URL: "${matchingApp.base_url || 'None provided'}"
Available Secrets: ${Object.keys(decryptedSecrets).join(", ") || 'None'}

User Request: "${prompt}"

Your task:
1. Determine the exact HTTP request needed to fulfill the user's request using the instructions.
2. Return a JSON object with:
   {
     "method": "GET" | "POST" | "PUT" | "DELETE",
     "url": "full_url_including_query_params",
     "headers": { "Key": "Value" },
     "body": { ... } | null
   }

RULES:
- Use the provided Secrets if needed (e.g. for Authorization headers).
- If the URL in instructions is relative, append it to the Base URL.
- Return ONLY the JSON object.`;

    // We use the main AI handler to generate the request structure
    // (Note: This assumes we can call the AI from here, in a real scenario we'd use the keys from env)
    // For now, let's assume we have a helper in the main function
    return {
        app: matchingApp,
        secrets: decryptedSecrets,
        instructionPrompt: systemPrompt
    };
}

export async function executeCustomApi(request: any) {
    try {
        const { method, url, headers, body } = request;
        
        console.log(`[CUSTOM API] Executing ${method} ${url}`);
        
        const options: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };
        
        if (body && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(body);
        }

        const res = await fetch(url, options);
        const data = await res.text();
        
        try {
            return JSON.parse(data);
        } catch {
            return data;
        }
    } catch (err: any) {
        console.error("[CUSTOM API] Execution failed:", err);
        return { error: err.message };
    }
}
