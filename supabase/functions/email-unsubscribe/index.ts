// =============================================================
// email-unsubscribe/index.ts — Public Unsubscribe Handler
// No auth required. Accepts ?token=xxx&category=marketing
// =============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.2.45.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const UNSUBSCRIBE_SUCCESS_HTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Unsubscribed — Ceova</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0a0a0a;font-family:'Inter',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}.card{background:#111;border:1px solid #1e1e1e;border-radius:16px;padding:48px 40px;text-align:center;max-width:480px;width:100%}.icon{font-size:48px;margin-bottom:20px}.title{color:#fff;font-size:22px;font-weight:700;margin-bottom:12px}.desc{color:#94a3b8;font-size:15px;line-height:1.7;margin-bottom:28px}.btn{display:inline-block;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:15px}</style></head><body><div class="card"><div class="icon">✅</div><h1 class="title">You've been unsubscribed</h1><p class="desc">You will no longer receive marketing emails from Ceova. You can resubscribe anytime from your account settings.<br><br>Important account and billing emails will still be delivered.</p><a href="https://ceova.online" class="btn">Back to Ceova</a></div></body></html>`;

const UNSUBSCRIBE_ERROR_HTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Error — Ceova</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0a0a0a;font-family:'Inter',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}.card{background:#111;border:1px solid #1e1e1e;border-radius:16px;padding:48px 40px;text-align:center;max-width:480px;width:100%}.icon{font-size:48px;margin-bottom:20px}.title{color:#fff;font-size:22px;font-weight:700;margin-bottom:12px}.desc{color:#94a3b8;font-size:15px;line-height:1.7;margin-bottom:28px}.btn{display:inline-block;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:15px}</style></head><body><div class="card"><div class="icon">❌</div><h1 class="title">Invalid unsubscribe link</h1><p class="desc">This link is invalid or has expired. Please log into your Ceova account to manage your email preferences.</p><a href="https://ceova.online" class="btn">Go to Ceova</a></div></body></html>`;

serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const category = url.searchParams.get("category") || "marketing";

  // Handle Resend webhook events (opened, clicked, bounced)
  if (req.method === "POST") {
    try {
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const payload = await req.json();

      if (payload.type === "email.opened" && payload.data?.tags?.user_id) {
        await admin.from("email_logs")
          .update({ status: "opened", opened_at: new Date().toISOString() })
          .eq("resend_id", payload.data.email_id);
      }

      if (payload.type === "email.clicked" && payload.data?.tags?.user_id) {
        await admin.from("email_logs")
          .update({ status: "clicked", clicked_at: new Date().toISOString() })
          .eq("resend_id", payload.data.email_id);
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch (err) {
      console.error("[email-unsubscribe] Webhook error:", err.message);
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  // GET request — process unsubscribe
  if (!token) {
    return new Response(UNSUBSCRIBE_ERROR_HTML, {
      headers: { "Content-Type": "text/html" },
      status: 400,
    });
  }

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Find user by unsubscribe token
    const { data: prefs, error } = await admin
      .from("user_email_preferences")
      .select("user_id")
      .eq("unsubscribe_token", token)
      .single();

    if (error || !prefs) {
      return new Response(UNSUBSCRIBE_ERROR_HTML, {
        headers: { "Content-Type": "text/html" },
        status: 404,
      });
    }

    // Build update object based on category
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      unsubscribed_at: new Date().toISOString(),
    };

    if (category === "marketing") updateData.marketing_emails = false;
    else if (category === "educational") updateData.educational_emails = false;
    else {
      // Unsubscribe from all marketing & educational
      updateData.marketing_emails = false;
      updateData.educational_emails = false;
    }

    await admin
      .from("user_email_preferences")
      .update(updateData)
      .eq("user_id", prefs.user_id);

    console.log(`[email-unsubscribe] User ${prefs.user_id} unsubscribed from ${category}`);

    return new Response(UNSUBSCRIBE_SUCCESS_HTML, {
      headers: { "Content-Type": "text/html" },
      status: 200,
    });

  } catch (err) {
    console.error(`[email-unsubscribe ERROR] ${err.message}`);
    return new Response(UNSUBSCRIBE_ERROR_HTML, {
      headers: { "Content-Type": "text/html" },
      status: 500,
    });
  }
});
