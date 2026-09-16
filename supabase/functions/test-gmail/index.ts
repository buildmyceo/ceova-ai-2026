import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Using the exact secret names from your screenshot
const GMAIL_CLIENT_ID = Deno.env.get("GMAIL_GMAIL_CLIENT_ID") || Deno.env.get("GMAIL_CLIENT_ID");
const GMAIL_CLIENT_SECRET = Deno.env.get("GMAIL_CLIENT_SECRET");
const GMAIL_REFRESH_TOKEN = Deno.env.get("GMAIL_REFRESH_TOKEN");
const EMAIL_SENDER = Deno.env.get("EMAIL_SENDER_GMAIL") || Deno.env.get("EMAIL_SENDER");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN || !EMAIL_SENDER) {
      throw new Error(`Missing secrets. ID: ${!!GMAIL_CLIENT_ID}, Secret: ${!!GMAIL_CLIENT_SECRET}, Token: ${!!GMAIL_REFRESH_TOKEN}, Sender: ${!!EMAIL_SENDER}`);
    }

    const { to } = await req.json();
    if (!to) throw new Error("Missing 'to' email address in request body");

    console.log("Getting new access token...");
    
    // 1. Get Access Token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: GMAIL_CLIENT_ID,
        client_secret: GMAIL_CLIENT_SECRET,
        refresh_token: GMAIL_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Failed to get access token: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    
    console.log("Access token retrieved successfully");

    // 2. Construct Email
    const subject = "Test from Ceova Gmail API";
    const bodyText = "Hello! If you are reading this, the Gmail API integration is working perfectly.";
    
    const emailStr = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      "",
      bodyText
    ].join("\r\n");

    // Base64url encode the email
    const encodedEmail = btoa(emailStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    console.log(`Sending email to ${to}...`);

    // 3. Send Email
    const sendResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: encodedEmail,
      }),
    });

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const sendData = await sendResponse.json();
    
    return new Response(JSON.stringify({ success: true, messageId: sendData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Test Error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
