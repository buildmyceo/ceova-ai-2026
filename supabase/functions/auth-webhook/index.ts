// =============================================================
// auth-webhook/index.ts — Supabase Auth Webhook
// Fires when a user signs up → triggers welcome email
// Register this URL in: Supabase Dashboard → Auth → Webhooks
// =============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("AUTH_WEBHOOK_SECRET") || "";

serve(async (req: Request) => {
  try {
    // Validate webhook secret — REQUIRED, not optional
    if (!WEBHOOK_SECRET) {
      console.error("[auth-webhook] AUTH_WEBHOOK_SECRET is not set — rejecting all requests");
      return new Response(JSON.stringify({ error: "Webhook not configured" }), { status: 503 });
    }

    const authHeader = req.headers.get("authorization") || "";
    const secret = authHeader.replace("Bearer ", "");
    if (!secret || secret !== WEBHOOK_SECRET) {
      console.warn("[auth-webhook] Rejected request with invalid secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const payload = await req.json();
    console.log("[auth-webhook] Received event:", payload.type);

    // Only handle new user signups
    if (payload.type !== "INSERT" || payload.table !== "users") {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const user = payload.record;
    if (!user?.id || !user?.email) {
      return new Response(JSON.stringify({ error: "No user data in payload" }), { status: 400 });
    }

    // Small delay to ensure user is fully created in DB
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const name = user.raw_user_meta_data?.full_name || user.email.split("@")[0];
    const joinDate = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });

    // Trigger welcome email via centralized send-system-email (ceova.ai@gmail.com)
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-system-email`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        emailType: "WELCOME",
        to: user.email,
        userId: user.id,
        variables: {
          name,
          email: user.email,
          date: joinDate,
          plan: "Spark (Free)",
        },
      }),
    });

    const result = await response.json();
    console.log("[auth-webhook] Welcome email sent:", result);

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    console.error(`[auth-webhook ERROR] ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
