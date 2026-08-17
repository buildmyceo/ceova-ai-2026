import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.2.45.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { to, subject, body, userId } = await req.json();
    if (!to || !subject || !body || !userId) throw new Error("Missing required fields (to, subject, body, userId)");

    // 1. Get OAuth Token
    const { data: tokenData } = await supabase
      .from("user_google_tokens")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!tokenData) throw new Error("Google account not connected.");
    
    let token = tokenData.access_token;

    // 2. Refresh Token if needed
    if (Date.now() > (tokenData.expiry_date - 300000)) {
        console.log("[SEND-EMAIL] Refreshing token...");
        const refreshResp = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
                client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
                refresh_token: tokenData.refresh_token,
                grant_type: "refresh_token",
            }).toString(),
        });
        const refreshData = await refreshResp.json();
        token = refreshData.access_token;
        await supabase.from("user_google_tokens").update({
            access_token: token,
            expiry_date: Date.now() + (refreshData.expires_in * 1000)
        }).eq("user_id", userId);
    }

    // 3. Build RFC822 Email & Encode Base64
    const emailContent = [
        `To: ${to}`,
        `Subject: ${subject}`,
        `Content-Type: text/plain; charset="UTF-8"`,
        ``,
        body
    ].join("\r\n");

    const raw = btoa(emailContent).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // 4. Call Gmail API
    console.log(`[SEND-EMAIL] Sending to: ${to}`);
    const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${token}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ raw })
    });

    const result = await gmailRes.json();
    if (!gmailRes.ok) throw new Error(result.error?.message || "Gmail API failed");

    return new Response(JSON.stringify({ success: true, messageId: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    console.error(`[SEND-EMAIL ERROR] ${err.message}`);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
