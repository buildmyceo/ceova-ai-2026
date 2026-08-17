import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID")!;
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;

const basicAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1. Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const userClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 2. Fetch the user's active/past_due subscription
    const { data: sub, error: subError } = await adminClient
      .from("user_subscriptions")
      .select("razorpay_subscription_id, status")
      .eq("user_id", user.id)
      .in("status", ["active", "past_due"])
      .not("razorpay_subscription_id", "is", null)
      .single();

    if (subError || !sub) {
      return new Response(JSON.stringify({ error: "No active Razorpay subscription found" }), { status: 404, headers: corsHeaders });
    }

    // 3. Fetch from Razorpay
    const rzpRes = await fetch(`https://api.razorpay.com/v1/subscriptions/${sub.razorpay_subscription_id}`, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${basicAuth}`
      }
    });

    if (!rzpRes.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch from Razorpay" }), { status: 500, headers: corsHeaders });
    }

    const rzpSub = await rzpRes.json();
    
    // 4. Return the short URL so the frontend can redirect the user to retry payment
    if (rzpSub.short_url) {
      return new Response(JSON.stringify({ url: rzpSub.short_url }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } else {
      return new Response(JSON.stringify({ error: "No retry URL available for this subscription" }), { status: 400, headers: corsHeaders });
    }

  } catch (err) {
    console.error("[RAZORPAY-RETRY] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
