// =============================================================
// send-sms-hook/index.ts — Supabase Send SMS Auth Hook
// Dual-Channel Delivery: Dispatches identical 6-digit OTP to
// both user's Phone (SMS via Twilio) and Gmail (via Gmail OAuth2)
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

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const payload = await req.json().catch(() => ({}));
    console.log("[send-sms-hook] Received hook invocation:", JSON.stringify({
      hasUser: !!payload?.user,
      hasSms: !!payload?.sms,
      userId: payload?.user?.id,
      phone: payload?.user?.phone || payload?.phone,
      isDiagnostic: !!payload?.diagnostic,
    }));

    // Twilio Config
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const senderParam = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") || 
                        Deno.env.get("TWILIO_PHONE_NUMBER") || 
                        Deno.env.get("TWILIO_FROM_NUMBER");

    // ── Diagnostic Mode ──
    if (payload?.diagnostic === true) {
      const diagPhone = payload?.phone || "+919229950815";
      const diagOtp = payload?.otp || "481920";

      // Test Twilio dispatch
      let twilioTestResult: any = null;
      if (twilioAccountSid && twilioAuthToken) {
        // Test 1: If senderParam starts with VA, test Twilio Verify API!
        if (senderParam?.startsWith("VA")) {
          try {
            const verifyUrl = `https://verify.twilio.com/v2/Services/${senderParam}/Verifications`;
            const verifyParams = new URLSearchParams();
            verifyParams.append("To", diagPhone);
            verifyParams.append("Channel", "sms");
            verifyParams.append("CustomCode", diagOtp);

            const vRes = await fetch(verifyUrl, {
              method: "POST",
              headers: {
                "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: verifyParams.toString(),
            });
            const vText = await vRes.text();
            twilioTestResult = { mode: "Twilio_Verify_API", ok: vRes.ok, status: vRes.status, response: vText };
          } catch (e: any) {
            twilioTestResult = { mode: "Twilio_Verify_API", ok: false, error: e.message };
          }
        } else {
          // Standard Messages API
          try {
            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
            const params = new URLSearchParams();
            params.append("To", diagPhone);
            if (senderParam?.startsWith("MG")) {
              params.append("MessagingServiceSid", senderParam);
            } else if (senderParam) {
              const formattedFrom = senderParam.startsWith("+") ? senderParam : `+${senderParam}`;
              params.append("From", formattedFrom);
            }
            params.append("Body", `[CEOVA Test] Verification code is: ${diagOtp}`);

            const res = await fetch(twilioUrl, {
              method: "POST",
              headers: {
                "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: params.toString(),
            });
            const text = await res.text();
            twilioTestResult = { mode: "Twilio_Messages_API", ok: res.ok, status: res.status, response: text };
          } catch (e: any) {
            twilioTestResult = { mode: "Twilio_Messages_API", ok: false, error: e.message };
          }
        }
      }

      // Test Gmail token refresh with available secrets
      const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
      const gmailTestResults: any[] = [];
      const testPairs = [
        { id: Deno.env.get("GMAIL_CLIENT_ID"), secret: Deno.env.get("GMAIL_CLIENT_SECRET"), label: "GMAIL_CLIENT" },
        { id: Deno.env.get("GOOGLE_CLIENT_ID"), secret: Deno.env.get("GOOGLE_CLIENT_SECRET"), label: "GOOGLE_CLIENT" },
      ];

      for (const p of testPairs) {
        if (p.id && p.secret && refreshToken) {
          try {
            const res = await fetch("https://oauth2.googleapis.com/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: p.id.trim(),
                client_secret: p.secret.trim(),
                refresh_token: refreshToken.trim(),
                grant_type: "refresh_token",
              }),
            });
            const txt = await res.text();
            gmailTestResults.push({ label: p.label, clientIdPrefix: p.id.substring(0, 10), ok: res.ok, status: res.status, response: txt });
          } catch (e: any) {
            gmailTestResults.push({ label: p.label, ok: false, error: e.message });
          }
        }
      }

      // Check user_google_tokens in DB
      const { data: dbTokens, error: tokenErr } = await supabaseAdmin
        .from("user_google_tokens")
        .select("user_id, expiry_date, updated_at")
        .order("updated_at", { ascending: false })
        .limit(3);

      return new Response(
        JSON.stringify({
          diagnostic: true,
          twilioTestResult,
          gmailTestResults,
          refreshTokenInfo: {
            exists: !!refreshToken,
            length: refreshToken?.length,
            prefix: refreshToken?.substring(0, 5),
            suffix: refreshToken?.substring(refreshToken.length - 4),
          },
          googleTokens: { count: dbTokens?.length || 0, error: tokenErr?.message, tokens: dbTokens },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // 1. Extract OTP
    const otp = payload?.sms?.otp || payload?.otp;
    if (!otp) {
      console.warn("[send-sms-hook] No OTP found in payload. Payload:", payload);
      return new Response(JSON.stringify({ error: "Missing OTP in payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Extract Phone & User info
    const user = payload?.user || {};
    const phone = user?.phone || payload?.phone || "";
    const userId = user?.id || payload?.userId || "";

    // 3. Resolve User's Gmail / Email
    let email = user?.email || payload?.email || "";

    // Priority A: Check user.identities
    if (!email && Array.isArray(user?.identities)) {
      for (const identity of user.identities) {
        if (identity?.identity_data?.email) {
          email = identity.identity_data.email;
          break;
        }
      }
    }

    // Priority B: Fetch from Supabase Auth Admin by ID (pulls linked Google account)
    if (!email && userId) {
      try {
        const { data: userData, error: uErr } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (!uErr && userData?.user?.email) {
          email = userData.user.email;
        }
      } catch (e: any) {
        console.warn("[send-sms-hook] Could not fetch user by ID:", e.message);
      }
    }

    // Priority C: Search auth.users by phone number
    if (!email && phone) {
      try {
        const { data: listData, error: lErr } = await supabaseAdmin.auth.admin.listUsers();
        if (!lErr && listData?.users) {
          const matched = listData.users.find((u: any) => u.phone === phone && u.email);
          if (matched?.email) {
            email = matched.email;
          }
        }
      } catch (e: any) {
        console.warn("[send-sms-hook] Could not search users by phone:", e.message);
      }
    }

    // Priority D: Query public.users table
    if (!email && userId) {
      try {
        const { data: dbUser } = await supabaseAdmin
          .from("users")
          .select("email")
          .eq("id", userId)
          .maybeSingle();
        if (dbUser?.email) email = dbUser.email;
      } catch (_) { /* noop */ }
    }

    console.log(`[send-sms-hook] Resolved user info — Phone: ${phone || "none"}, Email: ${email || "none"}, OTP: ${otp}`);

    // 4. Dispatch identical OTP to Gmail
    let emailSent = false;
    let emailError: string | null = null;
    if (email) {
      try {
        console.log(`[send-sms-hook] 📧 Dispatching OTP ${otp} to Gmail: ${email}`);
        const emailResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-system-email`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            emailType: "OTP_VERIFICATION",
            to: email,
            userId: userId || undefined,
            logEmail: false,
            forceRealRecipient: true,
            variables: {
              otp: String(otp),
              phone: phone || "Your phone number",
              email,
            },
          }),
        });

        const emailResult = await emailResponse.json().catch(() => ({}));
        if (emailResponse.ok && emailResult.success) {
          emailSent = true;
          console.log(`[send-sms-hook] ✅ OTP successfully sent to Gmail (${email})`);
        } else {
          emailError = emailResult?.error || "Unknown email dispatch error";
          console.error(`[send-sms-hook] ⚠️ Gmail dispatch response:`, emailResult);
        }
      } catch (emailErr: any) {
        emailError = emailErr.message;
        console.error(`[send-sms-hook] ❌ Failed to dispatch email:`, emailErr.message);
      }
    } else {
      console.warn(`[send-sms-hook] ⚠️ No email address found for user. Skipping Gmail dispatch.`);
    }

    // 5. Dispatch OTP via Twilio SMS (if credentials configured)
    let smsSent = false;
    let smsError: string | null = null;
    if (twilioAccountSid && twilioAuthToken && senderParam && phone) {
      if (senderParam.startsWith("VA")) {
        // ── Twilio Verify Service API ──
        try {
          console.log(`[send-sms-hook] 📱 Dispatching SMS via Twilio Verify (${senderParam}) to ${phone}...`);
          const verifyUrl = `https://verify.twilio.com/v2/Services/${senderParam}/Verifications`;
          const verifyParams = new URLSearchParams();
          verifyParams.append("To", phone);
          verifyParams.append("Channel", "sms");
          verifyParams.append("CustomCode", String(otp));

          const vRes = await fetch(verifyUrl, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: verifyParams.toString(),
          });

          const vText = await vRes.text();
          if (vRes.ok) {
            smsSent = true;
            console.log(`[send-sms-hook] ✅ Twilio Verify SMS sent successfully:`, vText);
          } else {
            smsError = vText;
            console.error(`[send-sms-hook] ❌ Twilio Verify API error:`, vText);
          }
        } catch (vErr: any) {
          smsError = vErr.message;
          console.error(`[send-sms-hook] ❌ Twilio Verify dispatch exception:`, vErr.message);
        }
      } else {
        // ── Twilio Standard Messages API ──
        try {
          console.log(`[send-sms-hook] 📱 Dispatching SMS via Twilio Messages API to ${phone}...`);
          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
          const params = new URLSearchParams();
          params.append("To", phone);

          if (senderParam.startsWith("MG")) {
            params.append("MessagingServiceSid", senderParam);
          } else {
            const formattedFrom = senderParam.startsWith("+") ? senderParam : `+${senderParam}`;
            params.append("From", formattedFrom);
          }
          params.append("Body", `Your CEOVA verification code is: ${otp}. Valid for 10 minutes. Thank you for logging into Ceova.`);

          const twilioRes = await fetch(twilioUrl, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
          });

          const twilioDataText = await twilioRes.text();
          if (twilioRes.ok) {
            smsSent = true;
            console.log(`[send-sms-hook] ✅ Twilio SMS sent successfully:`, twilioDataText);
          } else {
            smsError = twilioDataText;
            console.error(`[send-sms-hook] ❌ Twilio API error:`, twilioDataText);
          }
        } catch (tErr: any) {
          smsError = tErr.message;
          console.error(`[send-sms-hook] ❌ Twilio SMS dispatch exception:`, tErr.message);
        }
      }
    } else {
      console.log(`[send-sms-hook] ℹ️ Twilio secrets incomplete: SID=${!!twilioAccountSid}, Token=${!!twilioAuthToken}, Sender=${!!senderParam}, Phone=${!!phone}`);
    }

    // 6. Log attempt and OTP to email_logs for traceability & debugging
    try {
      await supabaseAdmin.from("email_logs").insert({
        user_id: userId || null,
        to_email: email || phone || "otp-request",
        campaign_slug: "OTP_VERIFICATION",
        status: emailSent ? "delivered" : (smsSent ? "sms_sent" : "failed"),
        sent_at: new Date().toISOString(),
        metadata: {
          otp,
          phone,
          email,
          emailSent,
          smsSent,
          smsError,
          emailError,
          twilioConfigured: !!(twilioAccountSid && twilioAuthToken && senderParam),
        },
      });
    } catch (logErr: any) {
      console.warn("[send-sms-hook] Could not insert to email_logs:", logErr.message);
    }

    // 7. Return 200 OK to Supabase Auth
    return new Response(
      JSON.stringify({
        success: true,
        email_sent: emailSent,
        sms_sent: smsSent,
        sms_error: smsError,
        email_error: emailError,
        phone: phone || null,
        email: email ? email.replace(/(.{2})(.*)(@.*)/, "$1***$3") : null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (err: any) {
    console.error(`[send-sms-hook ERROR]`, err.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});
