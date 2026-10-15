import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// Fire-and-forget email via centralized send-system-email (ceova.ai@gmail.com)
async function fireEmail(
  emailType: string,
  to: string,
  variables: Record<string, string> = {},
  userId?: string
) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-system-email`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ emailType, to, variables, userId }),
    });
    const result = await res.json();
    if (result.success) {
      console.log(`[WEBHOOK] ✅ Email ${emailType} sent to ${to}`);
    } else {
      console.error(`[WEBHOOK] ❌ Email ${emailType} failed: ${result.error}`);
    }
  } catch (err: any) {
    console.error(`[WEBHOOK] Failed to send email ${emailType}:`, err.message);
  }
}

// Verify Razorpay webhook HMAC-SHA256 signature
async function verifyWebhookSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const computedHex = Array.from(new Uint8Array(signatureBytes)).map(b => b.toString(16).padStart(2, "0")).join("");
  return computedHex === signature;
}

// ── Idempotency: record processed webhook events ─────────────────────────────
// Returns true if this event was already processed (should be skipped)
async function markEventProcessed(adminClient: any, eventId: string): Promise<boolean> {
  const { error } = await adminClient
    .from("webhook_events_processed")
    .insert({ event_id: eventId, processed_at: new Date().toISOString() });

  // If insert fails with unique constraint violation, event was already processed
  if (error && error.code === "23505") {
    console.warn(`[WEBHOOK] Duplicate event ${eventId} — skipping`);
    return true;
  }
  if (error) {
    // Log but don't block — better to process twice than miss an event
    console.error(`[WEBHOOK] Failed to record event ${eventId}:`, error.message);
  }
  return false;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")!;
  const adminClient = getAdminClient();

  // 0. Rate Limiting (Global bucket to prevent CPU exhaustion via HMAC brute force / DDoS)
  const { checkRateLimit } = await import("../_shared/rate-limit.ts");
  const rateLimit = await checkRateLimit(
      adminClient,
      `razorpay-webhook:global`,
      100, // max burst
      10   // refill 10 token every 1 seconds
  );

  if (!rateLimit.allowed) {
      console.warn(`[razorpay-webhook] Global Rate limit exceeded.`);
      return new Response("Too Many Requests", { status: 429 });
  }

  // Verify signature
  const isValid = await verifyWebhookSignature(rawBody, signature, webhookSecret);
  if (!isValid) {
    console.error("[WEBHOOK] Invalid signature — rejecting");
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(rawBody);
  const eventType = event.event;
  const eventId = event.id || `${eventType}_${Date.now()}`;
  const payload = event.payload;
  // SECURITY FIX: Removed duplicate `const adminClient = getAdminClient()` that crashed every webhook call.
  // adminClient is already initialized on line 77.

  // ── Idempotency check ─────────────────────────────────────────────────────
  const alreadyProcessed = await markEventProcessed(adminClient, eventId);
  if (alreadyProcessed) {
    return new Response(JSON.stringify({ received: true, skipped: "duplicate" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // ─────────────────────────────────────────────
    // subscription.activated
    // First payment succeeded. Activate the plan.
    // ─────────────────────────────────────────────
    if (eventType === "subscription.activated") {
      const sub = payload.subscription.entity;
      const userId = sub.notes?.user_id;
      const planSlug = sub.notes?.plan_slug;

      if (!userId || !planSlug) {
        console.error("[WEBHOOK] Missing user_id or plan_slug in notes");
        return new Response("Missing notes", { status: 400 });
      }

      // Get the plan record
      const { data: plan } = await adminClient
        .from("subscription_plans")
        .select("id")
        .eq("slug", planSlug)
        .single();

      if (!plan) return new Response("Plan not found", { status: 404 });

      const cycleStart = new Date(sub.current_start * 1000).toISOString();
      const cycleEnd = new Date(sub.current_end * 1000).toISOString();

      // Upsert user_subscriptions
      await adminClient.from("user_subscriptions").upsert({
        user_id: userId,
        plan_id: plan.id,
        status: "active",
        razorpay_subscription_id: sub.id,
        current_period_start: cycleStart,
        current_period_end: cycleEnd,
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      console.log(`[WEBHOOK] Activated subscription for user ${userId} on plan ${planSlug}`);

      // Fire subscription_activated email
      const payment = payload.payment?.entity;
      const { data: activatedUser } = await adminClient.auth.admin.getUserById(userId);
      if (activatedUser?.user?.email) {
        const planName = planSlug.charAt(0).toUpperCase() + planSlug.slice(1);
        const amount = payment ? `₹${payment.amount / 100}` : "—";
        const renewalDate = new Date(sub.current_end * 1000).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
        const startDate = new Date(sub.current_start * 1000).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
        fireEmail("SUBSCRIPTION_ACTIVATED", activatedUser.user.email, {
          name: activatedUser.user.user_metadata?.full_name || activatedUser.user.email.split("@")[0],
          plan: planName,
          amount,
          start_date: startDate,
          renewal_date: renewalDate,
        }, userId);
        if (payment) {
          fireEmail("PAYMENT_SUCCESSFUL", activatedUser.user.email, {
            plan: planName,
            amount,
            transaction_id: payment?.id || "—",
            date: startDate,
            payment_method: payment?.method || "—",
          }, userId);
        }
      }
    }

    // ─────────────────────────────────────────────
    // subscription.charged
    // Monthly renewal succeeded. Update cycle dates.
    // ─────────────────────────────────────────────
    else if (eventType === "subscription.charged") {
      const sub = payload.subscription.entity;
      const payment = payload.payment.entity;

      const cycleStart = new Date(sub.current_start * 1000).toISOString();
      const cycleEnd = new Date(sub.current_end * 1000).toISOString();

      const { data: rpcResult, error: rpcError } = await adminClient.rpc('process_subscription_payment', {
          p_razorpay_sub_id: sub.id,
          p_payment_id: payment.id,
          p_amount: payment.amount / 100,
          p_currency: payment.currency,
          p_method: payment.method || 'unknown',
          p_status: payment.status,
          p_captured_at: new Date(payment.created_at * 1000).toISOString(),
          p_cycle_start: cycleStart,
          p_cycle_end: cycleEnd
      });

      if (rpcError) {
          console.error(`[WEBHOOK] RPC Error charging sub ${sub.id}:`, rpcError.message);
      } else if (rpcResult?.success && rpcResult.status === 'processed') {
          console.log(`[WEBHOOK] Charged renewal for subscription ${sub.id} atomically`);

          // Fire subscription_renewed email
          if (rpcResult.user_id) {
             const { data: planData } = await adminClient.from("user_subscriptions").select("subscription_plans(name)").eq("razorpay_subscription_id", sub.id).single();
             const planName = (planData as any)?.subscription_plans?.name || "Pro";
             
             const { data: renewedUser } = await adminClient.auth.admin.getUserById(rpcResult.user_id);
             if (renewedUser?.user?.email) {
                 const renewalDate = new Date(sub.current_start * 1000).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
                 const nextRenewal = new Date(sub.current_end * 1000).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
                 fireEmail("SUBSCRIPTION_RENEWED", renewedUser.user.email, {
                     plan: planName,
                     amount: `₹${payment.amount / 100}`,
                     renewal_date: renewalDate,
                     next_renewal_date: nextRenewal,
                 }, rpcResult.user_id);
             }
          }
      }
    }

    // ─────────────────────────────────────────────
    // subscription.cancelled
    // User or Razorpay cancelled. Downgrade to Free.
    // BUG FIX: Read the user data BEFORE nullifying sub ID.
    // ─────────────────────────────────────────────
    else if (eventType === "subscription.cancelled") {
      const sub = payload.subscription.entity;

      // Step 1: Read the subscription data BEFORE the update
      const { data: cancelledSub } = await adminClient
        .from("user_subscriptions")
        .select("user_id, current_period_end, subscription_plans(name)")
        .eq("razorpay_subscription_id", sub.id)
        .single();

      // Step 2: Look up the free plan
      const { data: freePlan } = await adminClient
        .from("subscription_plans")
        .select("id")
        .eq("slug", "free")
        .single();

      if (freePlan) {
        // Step 3: Now perform the update (this nullifies razorpay_subscription_id)
        await adminClient.from("user_subscriptions")
          .update({
            plan_id: freePlan.id,
            status: "canceled",
            cancel_at_period_end: false,
            razorpay_subscription_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("razorpay_subscription_id", sub.id);

        console.log(`[WEBHOOK] Cancelled subscription ${sub.id} — downgraded to Free`);

        // Step 4: Send email using pre-fetched data
        if (cancelledSub?.user_id) {
          const accessUntil = cancelledSub.current_period_end
            ? new Date(cancelledSub.current_period_end).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })
            : "now";
          const { data: cancelledUser } = await adminClient.auth.admin.getUserById(cancelledSub.user_id);
          if (cancelledUser?.user?.email) {
            fireEmail("SUBSCRIPTION_CANCELLED", cancelledUser.user.email, {
              plan: (cancelledSub as any)?.subscription_plans?.name || "Pro",
              cancel_date: new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }),
              access_until: accessUntil,
            }, cancelledSub.user_id);
          }
        }
      }
    }

    // ─────────────────────────────────────────────
    // payment.captured
    // Store payment details in history (idempotent).
    // ─────────────────────────────────────────────
    else if (eventType === "payment.captured") {
      const payment = payload.payment.entity;
      const subId = payment.subscription_id;

      if (subId) {
        const { data: rpcResult, error: rpcError } = await adminClient.rpc('process_subscription_payment', {
          p_razorpay_sub_id: subId,
          p_payment_id: payment.id,
          p_amount: payment.amount / 100,
          p_currency: payment.currency,
          p_method: payment.method || 'unknown',
          p_status: "captured",
          p_captured_at: new Date().toISOString()
        });

        if (rpcError) {
          console.error(`[WEBHOOK] RPC Error storing payment ${payment.id}:`, rpcError.message);
        } else if (rpcResult?.success && rpcResult.status === 'processed') {
          console.log(`[WEBHOOK] Stored payment ${payment.id} atomically`);
        }
      }
    }

    // ─────────────────────────────────────────────
    // payment.failed
    // Mark subscription as past_due.
    // ─────────────────────────────────────────────
    else if (eventType === "payment.failed") {
      const payment = payload.payment.entity;
      const subId = payment.subscription_id;

      if (subId) {
        // Read user data before update
        const { data: failedSub } = await adminClient
          .from("user_subscriptions")
          .select("user_id, subscription_plans(name)")
          .eq("razorpay_subscription_id", subId)
          .single();

        await adminClient.from("user_subscriptions")
          .update({
            status: "past_due",
            updated_at: new Date().toISOString(),
          })
          .eq("razorpay_subscription_id", subId);

        console.log(`[WEBHOOK] Payment failed for subscription ${subId} — marked past_due`);

        // Fire payment_failed email
        if (failedSub?.user_id) {
          const errorDesc = payment.error_description || "Payment could not be processed";
          const { data: failedUser } = await adminClient.auth.admin.getUserById(failedSub.user_id);
          if (failedUser?.user?.email) {
            fireEmail("PAYMENT_FAILED", failedUser.user.email, {
              plan: (failedSub as any)?.subscription_plans?.name || "Pro",
              amount: `₹${payment.amount / 100}`,
              reason: errorDesc,
              date: new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }),
            }, failedSub.user_id);
          }
        }
      }
    }

    // Return 200 immediately — never return 500 to Razorpay on logic errors
    // (500 would trigger retry loops)
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[WEBHOOK] Error processing event:", err.message);
    // Still return 200 to prevent Razorpay from retrying on our processing errors
    // Log the event ID so we can manually investigate
    return new Response(JSON.stringify({ received: true, error: "processing_failed", event_id: eventId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
