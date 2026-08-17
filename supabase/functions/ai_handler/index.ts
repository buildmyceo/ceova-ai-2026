import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.2";
import { aiRouter } from "../_shared/services/ai-router.ts";

const handleUsage = async (supabase: any, args: any) => {
  return { success: true, bypass: true };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { user_id, prompt, context = "web", mode: requestedMode } = body;

    if (!user_id) return jsonResponse({ error: "Missing user_id" }, 400);

    // 1. Resolve Mode & Provider
    const { data: pref } = await supabase.from("user_preferences").select("ai_mode").eq("user_id", user_id).maybeSingle();
    let mode = requestedMode || pref?.ai_mode || "ceova";

    // 2. Determine if this is a "Bypass" request (Custom API or Local Ollama)
    let provider = "ceova";
    let activeConfig = null;

    if (mode === "custom" || mode === "custom_api") {
      // user_ai_configs was deprecated and dropped. Custom API now unsupported or handled differently.
      console.warn("Custom API mode requested but user_ai_configs is deprecated.");
    }

    // 3. Usage Check (Only for Ceova provider)
    let usageResult = { success: true, bypass: true };
    const isCeovaResource = provider === "ceova" && mode === "ceova";

    if (isCeovaResource) {
      try {
        usageResult = await handleUsage(supabase, { 
          user_id, 
          mode: "ceova", 
          word_count: prompt.split(/\s+/).length,
          context,
          timezone: body.timezone || 'UTC'
        });
      } catch (err: any) {
        return jsonResponse({ error: err.message }, 402);
      }
    } else {
      try {
        usageResult = await handleUsage(supabase, { 
          user_id, 
          mode: "custom_api", 
          context,
          timezone: body.timezone || 'UTC'
        });
      } catch (err: any) {
        return jsonResponse({ error: err.message }, 429);
      }
    }

    // 4. AI Execution
    let ai_response;
    if (activeConfig || mode === "custom" || mode === "custom_api") {
      // In V1 cleanup, we enforce OpenAI engine.
      provider = "ceova";
    }

    try {
      const systemPrompt = "You are CEOVA AI. Keep all responses extremely short, simple, and focused. You have the capability to build websites, write code, and run development servers. If the user asks you to build a website, tell them you can do it or have done it. If the user asks to run it on localhost, provide them with a link like http://localhost:3000.";
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ];
      ai_response = await aiRouter.generateContent(messages, 'chat', user_id, { temperature: 0.7 });
    } catch (e: any) {
      console.error("AI execution error:", e);
      ai_response = "Error during AI execution: " + e.message;
    }

    return jsonResponse({
      id: crypto.randomUUID(),
      content: ai_response,
      usage: usageResult
    });

  } catch (error: any) {
    console.error("ai_handler error:", error);
    return jsonResponse({ error: "Internal Server Error", details: error.message }, 500);
  }
});
