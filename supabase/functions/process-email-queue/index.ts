import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Interpolates {{variable}} into template string
function interpolate(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // Use service role key to bypass RLS for background processing
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch up to 50 pending emails from the queue
    const { data: queueItems, error: queueError } = await supabase
      .from("email_queue")
      .select(`
        id, user_id, to_email, to_name, variables, attempts,
        email_campaigns (slug, subject, html_body)
      `)
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(50);

    if (queueError) throw queueError;

    if (!queueItems || queueItems.length === 0) {
      return new Response(JSON.stringify({ message: "No pending emails to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log(`Processing ${queueItems.length} emails...`);

    const results = [];

    // Process each item
    for (const item of queueItems) {
      const rawCampaign = item.email_campaigns;
      const campaign: any = Array.isArray(rawCampaign) ? rawCampaign[0] : rawCampaign;
      
      try {
        // Mark as sending
        await supabase
          .from("email_queue")
          .update({ status: "sending", attempts: item.attempts + 1 })
          .eq("id", item.id);

        // Interpolate variables
        const subject = interpolate(campaign.subject, item.variables || {});
        const html = interpolate(campaign.html_body, item.variables || {});

        // Call send-system-email
        const sendResponse = await fetch(`${supabaseUrl}/functions/v1/send-system-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader, // Pass through the service role auth
          },
          body: JSON.stringify({
            to: item.to_email,
            subject: subject,
            html: html,
          }),
        });

        if (!sendResponse.ok) {
          const errorText = await sendResponse.text();
          throw new Error(`send-system-email failed: ${errorText}`);
        }

        const sendData = await sendResponse.json();

        if (!sendData.success) {
          throw new Error(sendData.error || "Unknown send error");
        }

        // Success: Update queue and log
        await supabase.from("email_queue").update({ 
          status: "sent", 
          sent_at: new Date().toISOString() 
        }).eq("id", item.id);

        await supabase.from("email_logs").insert({
          user_id: item.user_id,
          queue_id: item.id,
          to_email: item.to_email,
          campaign_slug: campaign.slug,
          provider_id: sendData.id,
          status: "sent",
        });

        results.push({ id: item.id, status: "success" });

      } catch (err: any) {
        console.error(`Failed to process email queue item ${item.id}:`, err);
        
        // Failure: Update queue attempts and apply jittered exponential backoff
        const isPermanentFailure = item.attempts + 1 >= 3;
        
        const nextAttempt = new Date();
        // Exponential backoff: (2^attempts * 5 minutes) + jitter (0-60 seconds)
        const delayMs = Math.pow(2, item.attempts) * 5 * 60 * 1000 + (Math.random() * 60000);
        nextAttempt.setTime(nextAttempt.getTime() + delayMs);
        
        await supabase.from("email_queue").update({ 
          status: isPermanentFailure ? "failed" : "pending",
          error_message: err.message,
          scheduled_at: nextAttempt.toISOString()
        }).eq("id", item.id);

        if (isPermanentFailure) {
          await supabase.from("email_logs").insert({
            user_id: item.user_id,
            queue_id: item.id,
            to_email: item.to_email,
            campaign_slug: campaign.slug,
            status: "failed",
            metadata: { error: err.message },
          });
        }

        results.push({ id: item.id, status: "failed", error: err.message });
      }
    }

    return new Response(JSON.stringify({ processed: queueItems.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Queue processor error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
