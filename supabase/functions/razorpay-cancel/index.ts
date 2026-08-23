import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1. Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    let body = {};
    try {
      body = await req.json();
    } catch {
      // Body may be empty
    }

    const { cancel_immediately = false } = body as any;
    const adminClient = getAdminClient();

    // 2. Fetch the user's active subscription
    const { data: sub, error: subError } = await adminClient
      .from("user_subscriptions")
      .select("id, user_id, razorpay_subscription_id, current_period_end, status, cancel_at_period_end")
      .eq("user_id", user.id)
      .single();

    if (subError || !sub) {
      return new Response(JSON.stringify({ error: "Subscription not found" }), { status: 404, headers: corsHeaders });
    }

    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID")!;
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    const basicAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

    // If there is an active Razorpay subscription ID, notify Razorpay
    if (sub.razorpay_subscription_id) {
      console.log(`[RAZORPAY-CANCEL] Cancelling subscription ${sub.razorpay_subscription_id} on Razorpay...`);

      const isPeriodExpired = sub.current_period_end ? new Date(sub.current_period_end) < new Date() : false;
      const cancelAtCycleEnd = (!cancel_immediately && !isPeriodExpired) ? 1 : 0;

      const rzpRes = await fetch(`https://api.razorpay.com/v1/subscriptions/${sub.razorpay_subscription_id}/cancel`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basicAuth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cancel_at_cycle_end: cancelAtCycleEnd,
        }),
      });

      if (!rzpRes.ok) {
        const errorData = await rzpRes.json();
        console.warn(`[RAZORPAY-CANCEL] Razorpay API response:`, errorData);
        // If it's already cancelled or completed on Razorpay, proceed to update DB
        const isAlreadyInactive = errorData.error?.description?.toLowerCase().includes("cancelled") ||
                                  errorData.error?.description?.toLowerCase().includes("completed") ||
                                  errorData.error?.description?.toLowerCase().includes("not active");
        if (!isAlreadyInactive) {
          return new Response(JSON.stringify({ 
            error: "Failed to cancel subscription on Razorpay", 
            details: errorData.error?.description || errorData 
          }), { status: 500, headers: corsHeaders });
        }
      } else {
        const rzpData = await rzpRes.json();
        console.log(`[RAZORPAY-CANCEL] Razorpay cancellation confirmed:`, rzpData.id, `Status: ${rzpData.status}`);
      }
    }

    // 3. Update database record
    if (cancel_immediately) {
      const { data: freePlan } = await adminClient
        .from("subscription_plans")
        .select("id")
        .eq("slug", "free")
        .single();

      await adminClient.from("user_subscriptions").update({
        plan_id: freePlan?.id,
        status: "canceled",
        cancel_at_period_end: false,
        razorpay_subscription_id: null,
        updated_at: new Date().toISOString(),
      }).eq("id", sub.id);
    } else {
      await adminClient.from("user_subscriptions").update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      }).eq("id", sub.id);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: cancel_immediately 
        ? "Subscription cancelled immediately and autopay stopped." 
        : "Subscription will cancel at the end of the billing period. Autopay has been stopped on Razorpay." 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[RAZORPAY-CANCEL] Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
