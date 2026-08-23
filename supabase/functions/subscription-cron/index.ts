import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID")!;
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;

const basicAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

function getAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

serve(async (req) => {
  // Only accept POST requests for vercel cron or manual triggers
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Authorization for the cron (if triggered externally)
  // Ensure the request has Bearer matching the service role key or a custom secret
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${SUPABASE_SERVICE_KEY}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const adminClient = getAdminClient();

  try {
    // 1. Fetch the Free plan ID to use for downgrades
    const { data: freePlan } = await adminClient
      .from("subscription_plans")
      .select("id")
      .eq("slug", "free")
      .single();

    if (!freePlan) {
      throw new Error("Free plan not found in database");
    }

    // 2. Get all subscriptions that are past their current_period_end OR past_due
    // We filter for active/past_due and plan_id != free_plan_id
    const { data: expiredSubs, error: fetchError } = await adminClient
      .from("user_subscriptions")
      .select("id, user_id, razorpay_subscription_id, status, current_period_end")
      .neq("plan_id", freePlan.id)
      .in("status", ["active", "past_due"])
      .lt("current_period_end", new Date().toISOString());

    if (fetchError) {
      throw fetchError;
    }

    console.log(`[CRON] Found ${expiredSubs?.length || 0} subscriptions to verify`);

    let processedCount = 0;
    let downgradeCount = 0;

    if (expiredSubs && expiredSubs.length > 0) {
      for (const sub of expiredSubs) {
        if (!sub.razorpay_subscription_id) continue;

        try {
          // Fetch status from Razorpay
          const rzpRes = await fetch(`https://api.razorpay.com/v1/subscriptions/${sub.razorpay_subscription_id}`, {
            method: "GET",
            headers: {
              "Authorization": `Basic ${basicAuth}`
            }
          });

          if (!rzpRes.ok) {
            console.error(`[CRON] Failed to fetch Razorpay sub ${sub.razorpay_subscription_id}`);
            continue;
          }

          const rzpSub = await rzpRes.json();
          const rzpStatus = rzpSub.status; // active, pending, halted, cancelled, completed, expired

          let shouldDowngrade = false;

          if (["cancelled", "completed", "expired", "halted"].includes(rzpStatus)) {
            shouldDowngrade = true;
          } else {
            // Check if 24-hour grace period has expired
            const gracePeriodEnd = new Date(sub.current_period_end);
            gracePeriodEnd.setHours(gracePeriodEnd.getHours() + 24);
            
            if (new Date() > gracePeriodEnd) {
              shouldDowngrade = true;
            }
          }

          if (shouldDowngrade) {
            // Ensure recurring subscription is cancelled on Razorpay so autopay stops immediately
            if (!["cancelled", "completed", "expired"].includes(rzpStatus) && sub.razorpay_subscription_id) {
              try {
                console.log(`[CRON] Cancelling active Razorpay sub ${sub.razorpay_subscription_id}...`);
                await fetch(`https://api.razorpay.com/v1/subscriptions/${sub.razorpay_subscription_id}/cancel`, {
                  method: "POST",
                  headers: {
                    "Authorization": `Basic ${basicAuth}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ cancel_at_cycle_end: 0 }),
                });
              } catch (cancelErr) {
                console.error(`[CRON] Failed to cancel Razorpay sub ${sub.razorpay_subscription_id}:`, cancelErr);
              }
            }

            // Downgrade to Spark
            await adminClient.from("user_subscriptions")
              .update({
                plan_id: freePlan.id,
                status: "active",
                cancel_at_period_end: false,
                billing_cycle: "monthly",
                current_period_start: new Date().toISOString(),
                current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                updated_at: new Date().toISOString(),
                razorpay_subscription_id: null
              })
              .eq("id", sub.id);

            // Provision a fresh Free-tier usage row
            await adminClient.from("subscription_usage").insert({
              subscription_id: sub.id,
              user_id: sub.user_id,
              cycle_start: new Date().toISOString(),
              cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              total_tokens: 0,
              total_requests: 0,
            });

            console.log(`[CRON] Downgraded user ${sub.user_id} (Razorpay Status: ${rzpStatus})`);
            downgradeCount++;
          }

        } catch (err) {
          console.error(`[CRON] Error verifying sub ${sub.id}:`, err);
        }
        processedCount++;
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: processedCount, 
      downgraded: downgradeCount 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("[CRON] Fatal error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
