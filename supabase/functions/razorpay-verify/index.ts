import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

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

// Verify Razorpay signature for frontend subscription success
async function verifySignature(paymentId: string, subscriptionId: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  // Payload for subscription verification is payment_id + "|" + subscription_id
  const payload = `${paymentId}|${subscriptionId}`;
  const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const computedHex = Array.from(new Uint8Array(signatureBytes)).map(b => b.toString(16).padStart(2, "0")).join("");
  return computedHex === signature;
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

    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = await req.json();

    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      return new Response(JSON.stringify({ error: "Missing required Razorpay parameters" }), { status: 400, headers: corsHeaders });
    }

    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    
    // 2. Verify signature
    const isValid = await verifySignature(razorpay_payment_id, razorpay_subscription_id, razorpay_signature, RAZORPAY_KEY_SECRET);
    
    if (!isValid) {
      console.error("[VERIFY] Invalid signature", { razorpay_payment_id, razorpay_subscription_id });
      return new Response(JSON.stringify({ error: "Invalid payment signature" }), { status: 400, headers: corsHeaders });
    }

    // 3. Fetch Subscription details from Razorpay
    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID")!;
    const basicAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    
    const rzpResponse = await fetch(`https://api.razorpay.com/v1/subscriptions/${razorpay_subscription_id}`, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      }
    });

    if (!rzpResponse.ok) {
      const errorData = await rzpResponse.json();
      console.error("[VERIFY] Failed to fetch subscription from Razorpay:", errorData);
      return new Response(JSON.stringify({ error: "Failed to fetch subscription from Razorpay" }), { status: 500, headers: corsHeaders });
    }

    const subData = await rzpResponse.json();
    const planSlug = subData.notes?.plan_slug;
    
    if (!planSlug) {
      return new Response(JSON.stringify({ error: "Subscription missing plan_slug in notes" }), { status: 400, headers: corsHeaders });
    }

    const adminClient = getAdminClient();

    // 4. Look up plan ID
    const { data: plan, error: planError } = await adminClient
      .from("subscription_plans")
      .select("id")
      .eq("slug", planSlug)
      .single();

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: "Plan not found" }), { status: 404, headers: corsHeaders });
    }

    // 5. Update user_subscriptions
    const cycleStart = new Date(subData.current_start * 1000).toISOString();
    const cycleEnd = new Date(subData.current_end * 1000).toISOString();

    const { error: upsertError } = await adminClient.from("user_subscriptions").upsert({
      user_id: user.id,
      plan_id: plan.id,
      status: "active",
      razorpay_subscription_id: subData.id,
      current_period_start: cycleStart,
      current_period_end: cycleEnd,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (upsertError) {
      console.error("[VERIFY] Failed to update user_subscriptions:", upsertError);
      return new Response(JSON.stringify({ error: "Failed to update database" }), { status: 500, headers: corsHeaders });
    }
    
    // Note: We don't need to manually insert payment_history here because the webhook will eventually process `payment.captured`
    // However, if the webhook fails, the subscription is still active and working.

    console.log(`[VERIFY] Successfully verified and activated plan ${planSlug} for user ${user.id}`);

    return new Response(JSON.stringify({ success: true, message: "Subscription activated successfully" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[RAZORPAY-VERIFY] Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
