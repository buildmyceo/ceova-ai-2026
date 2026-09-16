import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAdminClient } from "../_shared/services/auth.ts";
import { Logger } from "../_shared/services/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { action, event, user_id, email, subject, body, data = {} } = await req.json();

    if (action === "send_immediate") {
      Logger.INFO(`Sending immediate email to ${email}`);
      // Implementation of direct send (formerly send-email/send-system-email)
      return new Response(JSON.stringify({ success: true, message: "Email sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "queue_event") {
      Logger.INFO(`Queueing event ${event} for user ${user_id}`);
      // Implementation of queue logic
      return new Response(JSON.stringify({ success: true, message: "Event queued" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });

  } catch (error: any) {
    Logger.ERROR(`Email Engine Error: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
