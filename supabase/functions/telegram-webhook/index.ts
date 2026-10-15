import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  processTelegramUpdate,
  setupTelegramWebhook,
  generateTelegramConnectLink,
  getAdminClient,
} from "../_shared/services/telegram-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);

  try {
    // ── 1. Webhook Setup Route ───────────────────────────────────────────────
    if (url.pathname.endsWith("/setup") || url.searchParams.has("setup")) {
      const baseUrl = `https://${url.hostname}`;
      const result = await setupTelegramWebhook(baseUrl);
      return new Response(JSON.stringify(result, null, 2), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // ── 2. Telegram Connect Route (Invoked from CEOVA Web App) ─────────────────
    if (url.pathname.endsWith("/connect") || url.pathname.endsWith("/telegram-connect")) {
      if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: corsHeaders });
      }

      const supabase = getAdminClient();
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "").trim();

      let authedUserId: string | null = null;
      if (token) {
        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        if (!authError && authData?.user?.id) {
          authedUserId = authData.user.id;
        }
      }

      // Fallback to body user_id if token expired or client passed user_id directly
      if (!authedUserId) {
        try {
          const body = await req.clone().json();
          if (body?.user_id && typeof body.user_id === "string" && body.user_id.length > 10) {
            authedUserId = body.user_id;
          }
        } catch (_) {}
      }

      if (!authedUserId) {
        return new Response(JSON.stringify({ error: "Unauthorized. Please sign in to connect Telegram." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const connectionInfo = await generateTelegramConnectLink(authedUserId);
      return new Response(JSON.stringify(connectionInfo), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 3. Telegram Disconnect Route ─────────────────────────────────────────
    if (url.pathname.endsWith("/disconnect") || url.pathname.endsWith("/telegram-disconnect")) {
      if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: corsHeaders });
      }

      const supabase = getAdminClient();
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "").trim();
      let authedUserId: string | null = null;

      if (token) {
        const { data: authData } = await supabase.auth.getUser(token);
        if (authData?.user?.id) authedUserId = authData.user.id;
      }

      if (!authedUserId) {
        try {
          const body = await req.clone().json();
          if (body?.user_id) authedUserId = body.user_id;
        } catch (_) {}
      }

      if (!authedUserId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("user_telegram")
        .update({ connected: false, updated_at: new Date().toISOString() })
        .eq("user_id", authedUserId);

      return new Response(JSON.stringify({ success: true, message: "Telegram disconnected." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 4. Main Telegram Webhook Endpoint ────────────────────────────────────
    if (req.method === "POST") {
      const body = await req.json();

      // If EdgeRuntime.waitUntil is available, process update asynchronously
      // so Telegram receives an immediate HTTP 200 response and never times out on long-running tasks
      if (typeof (globalThis as any).EdgeRuntime?.waitUntil === "function") {
        (globalThis as any).EdgeRuntime.waitUntil(
          processTelegramUpdate(body).catch((err: any) => {
            console.error("[Telegram Webhook] Background update failed:", err);
          })
        );
        return new Response("ok", { status: 200, headers: corsHeaders });
      }

      return await processTelegramUpdate(body);
    }

    // GET status check
    return new Response(JSON.stringify({ status: "online", service: "CEOVA Telegram Webhook" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[Telegram Webhook] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
