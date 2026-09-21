// =============================================================
// send-sms-hook/index.ts — CEOVA Unified Phone Auth & Hook Engine
// 1. Serves as Supabase Auth "Send SMS Hook" if called by Supabase
// 2. Serves direct API endpoints for 100% reliable OTP delivery:
//    - "send-link-otp": Sends OTP to Phone + Gmail, enforces plan limit
//    - "verify-link-otp": Verifies OTP and officially links phone
//    - "send-login-otp": Checks linked accounts and sends OTP
//    - "verify-login-otp": Verifies OTP and returns auth session
// =============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, webhook-signature",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const payload = await req.json().catch(() => ({}));
    const action = payload?.action;

    // Log to sms_hook_logs for auditing
    try {
      await supabaseAdmin.from("sms_hook_logs").insert({
        payload,
        headers: Object.fromEntries(req.headers),
        created_at: new Date().toISOString(),
      });
    } catch (_) { /* noop */ }

    // Twilio Config
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const senderParam = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") || 
                        Deno.env.get("TWILIO_PHONE_NUMBER") || 
                        Deno.env.get("TWILIO_FROM_NUMBER");

    // Helper: Normalize phone to E.164
    const formatPhone = (raw: string) => {
      const trimmed = String(raw || "").trim();
      if (!trimmed) return "";
      return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
    };

    // Helper: Send SMS via Twilio
    const sendTwilioSms = async (targetPhone: string, code: string) => {
      if (!twilioAccountSid || !twilioAuthToken || !senderParam || !targetPhone) {
        return { sent: false, error: "Twilio credentials not configured or phone missing" };
      }
      if (senderParam.startsWith("VA")) {
        try {
          const verifyUrl = `https://verify.twilio.com/v2/Services/${senderParam}/Verifications`;
          const params = new URLSearchParams();
          params.append("To", targetPhone);
          params.append("Channel", "sms");
          params.append("CustomCode", String(code));

          const res = await fetch(verifyUrl, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
          });
          const text = await res.text();
          return { sent: res.ok, response: text, error: res.ok ? null : text };
        } catch (e: any) {
          return { sent: false, error: e.message };
        }
      } else {
        try {
          const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
          const params = new URLSearchParams();
          params.append("To", targetPhone);
          if (senderParam.startsWith("MG")) {
            params.append("MessagingServiceSid", senderParam);
          } else {
            params.append("From", senderParam.startsWith("+") ? senderParam : `+${senderParam}`);
          }
          params.append("Body", `Your CEOVA verification code is: ${code}. Valid for 10 minutes.`);

          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
          });
          const text = await res.text();
          return { sent: res.ok, response: text, error: res.ok ? null : text };
        } catch (e: any) {
          return { sent: false, error: e.message };
        }
      }
    };

    // Helper: Send Email via Gmail OAuth2
    const sendGmailOtp = async (targetEmail: string, code: string, targetPhone: string) => {
      if (!targetEmail) return { sent: false, error: "No email provided" };
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-system-email`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            emailType: "OTP_VERIFICATION",
            to: targetEmail,
            logEmail: true,
            forceRealRecipient: true,
            variables: {
              otp: String(code),
              phone: targetPhone || "Your phone number",
              email: targetEmail,
            },
          }),
        });
        const result = await res.json().catch(() => ({}));
        return { sent: res.ok && result.success, error: result?.error || (res.ok ? null : "Email send failed") };
      } catch (e: any) {
        return { sent: false, error: e.message };
      }
    };

    // =========================================================================
    // DIRECT ACTION: "send-link-otp" (Called by PhoneLinkModal)
    // =========================================================================
    if (action === "send-link-otp") {
      const rawPhone = payload?.phone;
      const targetUserId = payload?.userId;
      const cleanPhone = formatPhone(rawPhone);

      if (!cleanPhone || cleanPhone.replace(/\D/g, "").length < 7) {
        return new Response(JSON.stringify({ success: false, error: "Please provide a valid phone number." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!targetUserId) {
        return new Response(JSON.stringify({ success: false, error: "Missing user session." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check Plan Limit (Spark: max 1 email, Flow: max 5 emails)
      const { data: limitCheck, error: limitErr } = await supabaseAdmin.rpc("check_phone_link_limit", {
        target_phone: cleanPhone,
        check_user_id: targetUserId,
      });

      if (!limitErr && limitCheck && limitCheck.allowed === false) {
        return new Response(JSON.stringify({
          success: false,
          error: limitCheck.reason,
          plan: limitCheck.plan,
          max_allowed: limitCheck.max_allowed,
        }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Resolve user's email
      let userEmail = "";
      const { data: uData } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      if (uData?.user?.email) {
        userEmail = uData.user.email;
      }

      // Generate 6-digit OTP
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // Store in phone_verification_codes
      await supabaseAdmin.from("phone_verification_codes").insert({
        user_id: targetUserId,
        phone: cleanPhone,
        email: userEmail,
        otp,
        expires_at: expiresAt,
      });

      // Dispatch to Phone (Twilio)
      const smsResult = await sendTwilioSms(cleanPhone, otp);

      // Dispatch to Gmail (Gmail OAuth)
      const emailResult = await sendGmailOtp(userEmail, otp, cleanPhone);

      // Log to email_logs
      try {
        await supabaseAdmin.from("email_logs").insert({
          user_id: targetUserId,
          to_email: userEmail || cleanPhone,
          campaign_slug: "OTP_VERIFICATION",
          status: (smsResult.sent || emailResult.sent) ? "sent" : "failed",
          sent_at: new Date().toISOString(),
          metadata: {
            otp,
            phone: cleanPhone,
            email: userEmail,
            smsSent: smsResult.sent,
            smsError: smsResult.error,
            emailSent: emailResult.sent,
            emailError: emailResult.error,
            action: "send-link-otp",
          },
        });
      } catch (_) { /* noop */ }

      return new Response(JSON.stringify({
        success: true,
        phone: cleanPhone,
        email: userEmail ? userEmail.replace(/(.{2})(.*)(@.*)/, "$1***$3") : null,
        sms_sent: smsResult.sent,
        email_sent: emailResult.sent,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========================================================================
    // DIRECT ACTION: "verify-link-otp" (Called by PhoneLinkModal)
    // =========================================================================
    if (action === "verify-link-otp") {
      const cleanPhone = formatPhone(payload?.phone);
      const inputOtp = String(payload?.otp || "").trim();
      const targetUserId = payload?.userId;

      if (!cleanPhone || !inputOtp || inputOtp.length !== 6) {
        return new Response(JSON.stringify({ success: false, error: "Please enter the complete 6-digit code." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check code in phone_verification_codes
      const { data: codeRow } = await supabaseAdmin
        .from("phone_verification_codes")
        .select("*")
        .eq("phone", cleanPhone)
        .eq("otp", inputOtp)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!codeRow) {
        return new Response(JSON.stringify({ success: false, error: "Invalid or expired verification code." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark code as used
      await supabaseAdmin.from("phone_verification_codes").update({ used: true }).eq("id", codeRow.id);

      // Resolve user details
      const { data: uData } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      const userEmail = uData?.user?.email || codeRow.email;

      // Officially update phone on Supabase Auth user record
      try {
        await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
          phone: cleanPhone,
          phone_confirm: true,
        });
      } catch (adminErr: any) {
        console.warn("[send-sms-hook] admin.updateUserById warning:", adminErr.message);
      }

      // Record in public.user_phone_links
      await supabaseAdmin.rpc("record_phone_link", {
        link_user_id: targetUserId,
        link_phone: cleanPhone,
        link_email: userEmail,
      });

      return new Response(JSON.stringify({
        success: true,
        message: "Phone number linked successfully.",
        phone: cleanPhone,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========================================================================
    // DIRECT ACTION: "send-login-otp" (Called by Login.jsx)
    // =========================================================================
    if (action === "send-login-otp") {
      const cleanPhone = formatPhone(payload?.phone);
      const targetEmail = payload?.email;

      if (!cleanPhone || cleanPhone.replace(/\D/g, "").length < 7) {
        return new Response(JSON.stringify({ success: false, error: "Please enter a valid phone number." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Look up linked accounts
      const { data: linkedAccounts } = await supabaseAdmin.rpc("get_linked_accounts_for_phone", {
        target_phone: cleanPhone,
      });

      const accounts: any[] = Array.isArray(linkedAccounts) ? linkedAccounts : [];

      if (accounts.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: "No account found with this phone number. Please sign in with Google first to link your phone number.",
        }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If multiple accounts and none chosen yet, prompt user to select
      if (accounts.length > 1 && !targetEmail) {
        return new Response(JSON.stringify({
          success: true,
          require_account_selection: true,
          accounts,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const activeAccount = targetEmail 
        ? accounts.find((a: any) => a.email.toLowerCase() === targetEmail.toLowerCase()) || accounts[0]
        : accounts[0];

      const userEmail = activeAccount.email;
      const targetUserId = activeAccount.user_id;

      // Generate 6-digit OTP
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await supabaseAdmin.from("phone_verification_codes").insert({
        user_id: targetUserId,
        phone: cleanPhone,
        email: userEmail,
        otp,
        expires_at: expiresAt,
      });

      // Dispatch to Phone + Gmail
      const smsResult = await sendTwilioSms(cleanPhone, otp);
      const emailResult = await sendGmailOtp(userEmail, otp, cleanPhone);

      return new Response(JSON.stringify({
        success: true,
        phone: cleanPhone,
        email: userEmail.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
        full_email: userEmail,
        sms_sent: smsResult.sent,
        email_sent: emailResult.sent,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========================================================================
    // DIRECT ACTION: "verify-login-otp" (Called by Login.jsx)
    // =========================================================================
    if (action === "verify-login-otp") {
      const cleanPhone = formatPhone(payload?.phone);
      const inputOtp = String(payload?.otp || "").trim();
      const targetEmail = payload?.email;

      if (!cleanPhone || !inputOtp || inputOtp.length !== 6) {
        return new Response(JSON.stringify({ success: false, error: "Please enter the full 6-digit code." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check code
      const { data: codeRow } = await supabaseAdmin
        .from("phone_verification_codes")
        .select("*")
        .eq("phone", cleanPhone)
        .eq("otp", inputOtp)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!codeRow) {
        return new Response(JSON.stringify({ success: false, error: "Invalid or expired verification code." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin.from("phone_verification_codes").update({ used: true }).eq("id", codeRow.id);

      const loginEmail = targetEmail || codeRow.email;
      if (!loginEmail) {
        return new Response(JSON.stringify({ success: false, error: "Linked email address could not be resolved." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate magic link token hash for seamless client session
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: loginEmail,
      });

      if (linkErr || !linkData?.properties?.hashed_token) {
        return new Response(JSON.stringify({ success: false, error: linkErr?.message || "Failed to generate session." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        token_hash: linkData.properties.hashed_token,
        email: loginEmail,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========================================================================
    // FALLBACK / HOOK INVOCATION: (When called directly by Supabase Auth Hook)
    // =========================================================================
    const otp = payload?.sms?.otp || payload?.otp || payload?.token;
    if (!otp) {
      return new Response(JSON.stringify({ error: "Missing OTP or action in payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = payload?.user || {};
    const rawPhone = user?.phone || user?.phone_change || payload?.phone || payload?.sms?.phone || "";
    const cleanPhone = formatPhone(rawPhone);
    const userId = user?.id || payload?.userId || "";
    let email = user?.email || payload?.email || "";

    if (!email && userId) {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (userData?.user?.email) email = userData.user.email;
    }

    if (!email && cleanPhone) {
      const { data: linkRow } = await supabaseAdmin
        .from("user_phone_links")
        .select("email")
        .eq("phone", cleanPhone)
        .limit(1)
        .maybeSingle();
      if (linkRow?.email) email = linkRow.email;
    }

    const smsRes = await sendTwilioSms(cleanPhone, otp);
    const emailRes = await sendGmailOtp(email, otp, cleanPhone);

    return new Response(JSON.stringify({
      success: true,
      phone: cleanPhone || null,
      email: email ? email.replace(/(.{2})(.*)(@.*)/, "$1***$3") : null,
      sms_sent: smsRes.sent,
      email_sent: emailRes.sent,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[send-sms-hook ERROR]", err.message);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
