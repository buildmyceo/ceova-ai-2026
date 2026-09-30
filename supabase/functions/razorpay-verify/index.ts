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

// Constant-time string comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
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
  return timingSafeEqual(computedHex.toLowerCase(), signature.toLowerCase());
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

    const adminClient = getAdminClient();

    // 2. Rate Limiting: Prevent automated brute-force / race attacks via Burp Suite
    const { checkRateLimit } = await import("../_shared/rate-limit.ts");
    const rateLimit = await checkRateLimit(
      adminClient,
      `razorpay-verify:${user.id}`,
      5,   // max burst 5 requests
      0.1  // refill 1 token every 10 seconds
    );

    if (!rateLimit.allowed) {
      console.warn(`[VERIFY] Rate limit exceeded for user ${user.id}`);
      return new Response(JSON.stringify({ error: "Too many verification requests. Please wait a moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = await req.json();

    // Strict parameter validation
    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      return new Response(JSON.stringify({ error: "Missing required Razorpay parameters" }), { status: 400, headers: corsHeaders });
    }

    if (
      typeof razorpay_payment_id !== "string" || !razorpay_payment_id.startsWith("pay_") ||
      typeof razorpay_subscription_id !== "string" || !razorpay_subscription_id.startsWith("sub_") ||
      typeof razorpay_signature !== "string"
    ) {
      return new Response(JSON.stringify({ error: "Invalid parameter format" }), { status: 400, headers: corsHeaders });
    }

    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID")!;
    const basicAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    
    // 3. Timing-safe cryptographic signature verification
    const isValid = await verifySignature(razorpay_payment_id, razorpay_subscription_id, razorpay_signature, RAZORPAY_KEY_SECRET);
    if (!isValid) {
      console.error("[VERIFY] Invalid signature attempt", { userId: user.id, razorpay_payment_id, razorpay_subscription_id });
      return new Response(JSON.stringify({ error: "Invalid payment signature" }), { status: 400, headers: corsHeaders });
    }

    // 4. Replay Protection: Check if this payment ID was already used
    const paymentIdempotencyKey = `payment_${razorpay_payment_id}`;
    const { error: idempotencyErr } = await adminClient
      .from("webhook_events_processed")
      .insert({ event_id: paymentIdempotencyKey, processed_at: new Date().toISOString() });

    if (idempotencyErr && idempotencyErr.code === "23505") {
      console.warn(`[VERIFY] Replay detected! Payment ${razorpay_payment_id} was already processed.`);
      return new Response(JSON.stringify({ success: true, message: "Payment has already been processed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 5. Query Razorpay API directly to verify the Payment is CAPTURED
    const payResponse = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      }
    });

    if (!payResponse.ok) {
      const errorData = await payResponse.json();
      console.error("[VERIFY] Razorpay payment check failed:", errorData);
      return new Response(JSON.stringify({ error: "Payment verification failed with provider" }), { status: 400, headers: corsHeaders });
    }

    const payData = await payResponse.json();
    if (payData.status !== "captured") {
      console.error(`[VERIFY] Payment status not captured: ${payData.status}`);
      return new Response(JSON.stringify({ error: `Payment is not captured (status: ${payData.status})` }), { status: 400, headers: corsHeaders });
    }

    // 6. Fetch Subscription details from Razorpay
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

    // 7. Security Check: Validate user ownership
    if (subData.notes?.user_id && subData.notes.user_id !== user.id) {
      console.error("[VERIFY] Security Alert: User ID mismatch! Possible subscription hijacking attempt:", {
        authenticatedUser: user.id,
        subscriptionOwner: subData.notes.user_id
      });
      return new Response(JSON.stringify({ error: "Unauthorized subscription ownership" }), { status: 403, headers: corsHeaders });
    }

    // 8. Security Check: Ensure subscription status is actually active/authenticated
    if (subData.status !== "active" && subData.status !== "authenticated") {
      console.error(`[VERIFY] Subscription is not in active state (status: ${subData.status})`);
      return new Response(JSON.stringify({ error: `Subscription is not active (status: ${subData.status})` }), { status: 400, headers: corsHeaders });
    }

    const planSlug = subData.notes?.plan_slug;
    if (!planSlug) {
      return new Response(JSON.stringify({ error: "Subscription missing plan_slug in notes" }), { status: 400, headers: corsHeaders });
    }

    // 9. Look up plan ID
    const { data: plan, error: planError } = await adminClient
      .from("subscription_plans")
      .select("id")
      .eq("slug", planSlug)
      .single();

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: "Plan not found" }), { status: 404, headers: corsHeaders });
    }

    // 10. Update user_subscriptions
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

    // 11. Atomically record payment in history using RPC
    await adminClient.rpc('process_subscription_payment', {
      p_razorpay_sub_id: subData.id,
      p_payment_id: razorpay_payment_id,
      p_amount: (payData.amount || 0) / 100,
      p_currency: payData.currency || "INR",
      p_method: payData.method || "unknown",
      p_status: payData.status,
      p_captured_at: new Date((payData.created_at || Date.now() / 1000) * 1000).toISOString(),
      p_cycle_start: cycleStart,
      p_cycle_end: cycleEnd,
    });

    console.log(`[VERIFY] Successfully verified and activated plan ${planSlug} for user ${user.id} with payment ${razorpay_payment_id}`);

    return new Response(JSON.stringify({ success: true, message: "Subscription activated successfully" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[RAZORPAY-VERIFY] Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
