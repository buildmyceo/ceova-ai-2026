// =============================================================
// send-system-email/index.ts — CEOVA V1 Centralized Email Sender
// Uses ceova.ai@gmail.com via Gmail OAuth2 Refresh Token
// Provider-agnostic: swap provider by changing this file only
// =============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.2";
import { buildEmail, interpolate } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Gmail OAuth Config (from Supabase secrets) ──
const GMAIL_CLIENT_ID     = Deno.env.get("GMAIL_GMAIL_CLIENT_ID") || Deno.env.get("GMAIL_CLIENT_ID") || Deno.env.get("GOOGLE_CLIENT_ID");
const GMAIL_CLIENT_SECRET = Deno.env.get("GMAIL_CLIENT_SECRET") || Deno.env.get("GOOGLE_CLIENT_SECRET");
const GMAIL_REFRESH_TOKEN = Deno.env.get("GMAIL_REFRESH_TOKEN");
const GMAIL_ACCESS_TOKEN  = Deno.env.get("GMAIL_ACCESS_TOKEN");
const EMAIL_SENDER        = Deno.env.get("EMAIL_SENDER_GMAIL") || Deno.env.get("EMAIL_SENDER") || "ceova.ai@gmail.com";
const REPLY_TO            = "contact@ceova.online";
const FROM_NAME           = "CEOVA";

// ── TEST MODE: redirect ALL emails to this address ──
// Set EMAIL_TEST_MODE=true in Supabase secrets to enable.
// Remove or set to false when going live.
const TEST_MODE       = Deno.env.get("EMAIL_TEST_MODE") === "true";
const TEST_RECIPIENT  = Deno.env.get("EMAIL_TEST_RECIPIENT") || "buildmyceo@gmail.com";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── Obtain Gmail Access Token ──
async function getGmailAccessToken(): Promise<string> {
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!refreshToken) {
    throw new Error("Missing GMAIL_REFRESH_TOKEN in secrets");
  }

  // Credential pairs to attempt:
  const credentialPairs = [
    {
      id: Deno.env.get("GMAIL_CLIENT_ID") || Deno.env.get("GMAIL_GMAIL_CLIENT_ID"),
      secret: Deno.env.get("GMAIL_CLIENT_SECRET"),
      label: "GMAIL_CLIENT",
    },
    {
      id: Deno.env.get("GOOGLE_CLIENT_ID"),
      secret: Deno.env.get("GOOGLE_CLIENT_SECRET"),
      label: "GOOGLE_CLIENT",
    },
  ];

  for (const pair of credentialPairs) {
    if (pair.id && pair.secret) {
      try {
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: pair.id,
            client_secret: pair.secret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
          }),
        });
        if (res.ok) {
          const data = await res.json();
          console.log(`[send-system-email] ✅ Successfully refreshed Gmail access token using ${pair.label}`);
          return data.access_token;
        } else {
          const err = await res.text();
          console.warn(`[send-system-email] Refresh with ${pair.label} failed: ${err}`);
        }
      } catch (e: any) {
        console.warn(`[send-system-email] Exception during refresh with ${pair.label}: ${e.message}`);
      }
    }
  }

  // Fallback to static GMAIL_ACCESS_TOKEN from secrets if refresh token failed or expired
  if (GMAIL_ACCESS_TOKEN) {
    console.log("[send-system-email] Using GMAIL_ACCESS_TOKEN from secrets as fallback");
    return GMAIL_ACCESS_TOKEN;
  }

  throw new Error("Gmail token refresh failed for all client ID/secret pairs");
}

// ── Encode subject for RFC2047 MIME ──
function encodeMimeSubject(str: string): string {
  return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(str)))}?=`;
}

// ── Build raw RFC822 email (HTML + plain-text multipart) ──
function buildRawEmail(params: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
}): string {
  const { to, toName, subject, html, text } = params;
  const boundary = `ceova_boundary_${Date.now()}`;
  const toField = toName ? `${toName} <${to}>` : to;

  const lines = [
    `From: ${FROM_NAME} <${EMAIL_SENDER}>`,
    `Reply-To: ${REPLY_TO}`,
    `To: ${toField}`,
    `Subject: ${encodeMimeSubject(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    text,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    html,
    ``,
    `--${boundary}--`,
  ];

  const rawStr = lines.join("\r\n");
  const encoder = new TextEncoder();
  const bytes = encoder.encode(rawStr);
  const binary = Array.from(bytes).map((b) => String.fromCharCode(b)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ── Send via Gmail API ──
async function sendViaGmail(params: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ messageId: string; provider: string }> {
  const accessToken = await getGmailAccessToken();
  const raw = buildRawEmail(params);

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gmail API error: ${errText}`);
  }

  const data = await res.json();
  return { messageId: data.id, provider: "gmail" };
}

// ================================================================
// MAIN HANDLER
// ================================================================
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // SECURITY FIX: Require authentication — service_role key (internal) or valid user JWT
  const authHeader = req.headers.get('Authorization') || '';
  const bearerToken = authHeader.replace('Bearer ', '').trim();
  const isServiceRole = bearerToken === SUPABASE_SERVICE_KEY;
  
  if (!isServiceRole) {
    // Check if it's a valid user JWT
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') || '', {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ 
        error: '🛡️ Access denied! System emails require authorization. 🚫📧 Nice try though! 😏' 
      }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const {
      // Option A: Use a pre-built email type from the template library
      emailType,
      variables = {},

      // Option B: Raw send (pass subject + html + text directly)
      to,
      toName,
      subject: rawSubject,
      html: rawHtml,
      text: rawText,

      // Meta
      userId,
      logEmail = true,
      forceRealRecipient = false,
    } = await req.json();

    if (!to) throw new Error("Missing required field: 'to'");

    let subject: string;
    let html: string;
    let text: string;

    if (emailType) {
      // ── Template-based email ──
      const tpl = buildEmail(emailType, { ...variables, email: to });
      if (!tpl) throw new Error(`Unknown emailType: '${emailType}'. Check email-templates.ts for valid types.`);
      subject = tpl.subject;
      html = tpl.html;
      text = tpl.text;
    } else if (rawSubject && (rawHtml || rawText)) {
      // ── Raw email (for legacy callers or custom messages) ──
      subject = rawSubject;
      html = rawHtml || `<pre>${rawText}</pre>`;
      text = rawText || rawSubject;
    } else {
      throw new Error("Provide either 'emailType' + 'variables', or 'subject' + 'html'/'text'");
    }

    // ── Deduplication: skip if same email+type sent in last 5 minutes (except transactional OTPs) ──
    if (emailType && emailType !== "OTP_VERIFICATION" && userId && logEmail) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recentLog } = await supabase
        .from("email_logs")
        .select("id")
        .eq("to_email", to)
        .eq("campaign_slug", emailType)
        .gte("sent_at", fiveMinutesAgo)
        .maybeSingle();

      if (recentLog) {
        console.log(`[send-system-email] Skipping duplicate ${emailType} to ${to}`);
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "duplicate_prevented" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    // ── Send ──
    // Transactional OTPs must always go to the actual recipient even if test mode is enabled
    const isOtp = emailType === "OTP_VERIFICATION" || forceRealRecipient;
    const actualTo = (TEST_MODE && !isOtp) ? TEST_RECIPIENT : to;
    const actualToName = (TEST_MODE && !isOtp) ? undefined : toName;
    const actualSubject = (TEST_MODE && !isOtp)
      ? `[TEST → ${to}] ${subject}`
      : subject;

    if (TEST_MODE && !isOtp) {
      console.log(`[send-system-email] 🧪 TEST MODE — redirecting ${emailType || "raw"} from ${to} → ${TEST_RECIPIENT}`);
    } else {
      console.log(`[send-system-email] Sending ${emailType || "raw"} to ${to}`);
    }

    const { messageId, provider } = await sendViaGmail({
      to: actualTo,
      toName: actualToName,
      subject: actualSubject,
      html,
      text,
    });
    console.log(`[send-system-email] ✅ Sent. messageId: ${messageId}`);
    // ── Log ──
    if (logEmail) {
      await supabase.from("email_logs").insert({
        user_id: userId || null,
        to_email: to,
        campaign_slug: emailType || "raw",
        status: "sent",
        sent_at: new Date().toISOString(),
        metadata: { messageId, provider, subject },
      }).then(({ error }) => {
        if (error) console.error("[send-system-email] Log error:", error.message);
      });
    }

    return new Response(
      JSON.stringify({ success: true, id: messageId, provider }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    console.error(`[send-system-email ERROR] ${error.message}`);

    // Log failure
    try {
      const body = await req.json().catch(() => ({}));
      if (body.userId) {
        await supabase.from("email_logs").insert({
          user_id: body.userId,
          to_email: body.to || "unknown",
          campaign_slug: body.emailType || "raw",
          status: "failed",
          sent_at: new Date().toISOString(),
          metadata: { error: error.message },
        });
      }
    } catch (_) { /* noop */ }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
