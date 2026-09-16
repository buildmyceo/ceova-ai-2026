import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const VERIFY_TOKEN = Deno.env.get("META_VERIFY_TOKEN") || "ceova_verify_token";

serve(async (req) => {
  const { method } = req;
  const url = new URL(req.url);

  // 1. Handle Webhook Verification (GET)
  if (method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("[META] Webhook Verified successfully.");
      // MUST return the challenge as plain text, NOT JSON
      return new Response(challenge, { 
        status: 200,
        headers: { "Content-Type": "text/plain" }
      });
    } else {
      console.error("[META] Verification failed. Token mismatch or invalid mode.");
      return new Response("Verification failed", { status: 403 });
    }
  }

  // 2. Handle Webhook Events (POST)
  if (method === "POST") {
    try {
      const body = await req.json();
      console.log("[META] Received Webhook Event:", JSON.stringify(body, null, 2));

      // Add your event processing logic here (e.g., messaging_events)
      
      return new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err: any) {
      console.error("[META] Error parsing webhook body:", err.message);
      return new Response("Invalid JSON", { status: 400 });
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
});
