// =============================================================
// email-sender/index.ts — Queue Processor → Gmail
// Picks up pending emails from email_queue and sends via Gmail
// Migrated from Resend → ceova.ai@gmail.com (CEOVA V1)
// =============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.2.45.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BATCH_SIZE           = 50;

// Replace {{variable}} placeholders
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`
  );
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const specificQueueId = body?.queue_id;

    // 1. Fetch pending emails from queue
    let query = admin
      .from("email_queue")
      .select("*, email_campaigns(subject, html_body, name)")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .lt("attempts", 3)
      .order("scheduled_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (specificQueueId) {
      query = admin
        .from("email_queue")
        .select("*, email_campaigns(subject, html_body, name)")
        .eq("id", specificQueueId)
        .eq("status", "pending")
        .limit(1);
    }

    const { data: pendingEmails, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No pending emails" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log(`[email-sender] Processing ${pendingEmails.length} emails via Gmail`);

    let sent = 0;
    let failed = 0;

    for (const item of pendingEmails) {
      try {
        // Mark as sending (prevent concurrent processing)
        await admin
          .from("email_queue")
          .update({ status: "sending", attempts: item.attempts + 1 })
          .eq("id", item.id)
          .eq("status", "pending");

        const campaign = item.email_campaigns;
        if (!campaign) throw new Error("Campaign template not found");

        const vars = (item.variables || {}) as Record<string, string>;
        const subject = interpolate(campaign.subject, vars);
        const htmlBody = interpolate(campaign.html_body, vars);

        // Send via centralized send-system-email function
        const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/send-system-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({
            to: item.to_email,
            subject,
            html: htmlBody,
            text: subject,
            userId: item.user_id,
            logEmail: false, // We log it below ourselves
          }),
        });

        const sendData = await sendRes.json();
        if (!sendRes.ok || !sendData.success) {
          throw new Error(sendData.error || `send-system-email returned ${sendRes.status}`);
        }

        // Mark queue item as sent
        await admin
          .from("email_queue")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", item.id);

        // Audit log
        await admin.from("email_logs").insert({
          user_id: item.user_id,
          queue_id: item.id,
          to_email: item.to_email,
          campaign_slug: item.campaign_slug,
          status: "sent",
          sent_at: new Date().toISOString(),
          metadata: { messageId: sendData.id, provider: "gmail", campaign_name: campaign.name },
        });

        console.log(`[email-sender] ✅ Sent ${item.campaign_slug} to ${item.to_email}`);
        sent++;

      } catch (err: any) {
        console.error(`[email-sender] ❌ Failed ${item.campaign_slug} to ${item.to_email}: ${err.message}`);

        const newStatus = (item.attempts + 1) >= 3 ? "failed" : "pending";
        await admin
          .from("email_queue")
          .update({ status: newStatus, error_message: err.message })
          .eq("id", item.id);

        await admin.from("email_logs").insert({
          user_id: item.user_id,
          queue_id: item.id,
          to_email: item.to_email,
          campaign_slug: item.campaign_slug,
          status: "failed",
          sent_at: new Date().toISOString(),
          metadata: { error: err.message },
        }).catch(console.error);

        failed++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: sent + failed, sent, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (err: any) {
    console.error(`[email-sender ERROR] ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
