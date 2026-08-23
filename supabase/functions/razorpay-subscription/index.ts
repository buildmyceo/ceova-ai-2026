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

    const { plan_slug, billing_cycle = "monthly" } = await req.json();
    if (!plan_slug || plan_slug === "free") {
      return new Response(JSON.stringify({ error: "Invalid plan" }), { status: 400, headers: corsHeaders });
    }

    const adminClient = getAdminClient();

    // 2. Get plan details + razorpay_plan_id
    let { data: plan, error: planError } = await adminClient
      .from("subscription_plans")
      .select("id, name, slug, monthly_price, annual_price, razorpay_plan_id, razorpay_yearly_plan_id")
      .eq("slug", plan_slug)
      .maybeSingle();

    // Graceful fallback if razorpay_yearly_plan_id column does not exist yet in schema
    if (planError && (planError.code === "42703" || planError.message?.includes("razorpay_yearly_plan_id"))) {
      console.warn("[RAZORPAY-SUBSCRIPTION] razorpay_yearly_plan_id column not found in database schema, falling back...");
      const fallback = await adminClient
        .from("subscription_plans")
        .select("id, name, slug, monthly_price, annual_price, razorpay_plan_id")
        .eq("slug", plan_slug)
        .maybeSingle();
      plan = fallback.data ? { ...fallback.data, razorpay_yearly_plan_id: null } : null;
      planError = fallback.error;
    }

    if (planError) {
      console.error("[RAZORPAY-SUBSCRIPTION] Database query error:", planError);
      return new Response(JSON.stringify({ error: `Database error: ${planError.message}` }), { status: 500, headers: corsHeaders });
    }

    if (!plan) {
      return new Response(JSON.stringify({ error: `Plan '${plan_slug}' not found` }), { status: 404, headers: corsHeaders });
    }

    const isYearly = billing_cycle === "annual" || billing_cycle === "yearly";
    const targetPlanId = isYearly ? plan.razorpay_yearly_plan_id : plan.razorpay_plan_id;
    const targetAmount = isYearly ? plan.annual_price : plan.monthly_price;

    if (!targetPlanId) {
      return new Response(JSON.stringify({ error: `Razorpay ${isYearly ? 'yearly' : 'monthly'} plan not configured for this tier` }), { status: 400, headers: corsHeaders });
    }

    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID")!;
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    const basicAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

    // 3. Create Razorpay Subscription
    const rzpResponse = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plan_id: targetPlanId,
        total_count: isYearly ? 10 : 120, // 10 years
        quantity: 1,
        customer_notify: 1,
        notes: {
          user_id: user.id,
          plan_slug: plan.slug,
          billing_cycle: isYearly ? "annual" : "monthly"
        },
      }),
    });

    if (!rzpResponse.ok) {
      const rzpError = await rzpResponse.json();
      console.error("[RAZORPAY] Create subscription error:", rzpError);
      return new Response(JSON.stringify({ error: "Failed to create Razorpay subscription", details: rzpError }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const rzpSubscription = await rzpResponse.json();
    console.log(`[RAZORPAY] Created subscription ${rzpSubscription.id} for user ${user.id}`);

    // 4. Return subscription details for frontend checkout
    return new Response(JSON.stringify({
      subscription_id: rzpSubscription.id,
      razorpay_key_id: RAZORPAY_KEY_ID,
      plan_name: plan.name,
      amount: Math.round(targetAmount * 100), // in paise
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[RAZORPAY-SUBSCRIPTION] Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
