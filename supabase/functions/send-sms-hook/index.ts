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

// Twilio Config (optional if sending via Twilio REST API)
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || Deno.env.get("TWILIO_FROM_NUMBER");
const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");

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
    }));

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
          console.error(`[send-sms-hook] ⚠️ Gmail dispatch response:`, emailResult);
        }
      } catch (emailErr: any) {
        console.error(`[send-sms-hook] ❌ Failed to dispatch email:`, emailErr.message);
      }
    } else {
      console.warn(`[send-sms-hook] ⚠️ No email address found for user. Skipping Gmail dispatch.`);
    }

    // 5. Dispatch OTP via Twilio SMS (if credentials configured)
    let smsSent = false;
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && (TWILIO_FROM_NUMBER || TWILIO_MESSAGING_SERVICE_SID) && phone) {
      try {
        console.log(`[send-sms-hook] 📱 Dispatching SMS via Twilio to ${phone}...`);
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
        const params = new URLSearchParams();
        params.append("To", phone);
        if (TWILIO_MESSAGING_SERVICE_SID) {
          params.append("MessagingServiceSid", TWILIO_MESSAGING_SERVICE_SID);
        } else if (TWILIO_FROM_NUMBER) {
          params.append("From", TWILIO_FROM_NUMBER);
        }
        params.append("Body", `Your CEOVA verification code is: ${otp}. Valid for 10 minutes.`);

        const twilioRes = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });

        if (twilioRes.ok) {
          const twilioData = await twilioRes.json();
          smsSent = true;
          console.log(`[send-sms-hook] ✅ Twilio SMS sent successfully. SID: ${twilioData.sid}`);
        } else {
          const errText = await twilioRes.text();
          console.error(`[send-sms-hook] ❌ Twilio API returned error:`, errText);
        }
      } catch (tErr: any) {
        console.error(`[send-sms-hook] ❌ Twilio SMS dispatch exception:`, tErr.message);
      }
    } else {
      console.log(`[send-sms-hook] ℹ️ Direct Twilio secrets not configured. SMS provider handled externally.`);
    }

    // 6. Return 200 OK to Supabase Auth
    return new Response(
      JSON.stringify({
        success: true,
        email_sent: emailSent,
        sms_sent: smsSent,
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
    // Returning 200 with error info so Supabase Auth hook doesn't crash the auth process if email fails
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
